import { shim as shimPromiseFinally } from 'promise.prototype.finally';
import { AssetAdapter, SwapAsset } from './IAssetAdapter';

shimPromiseFinally();

type RawTransactionDetails = import('@nimiq/core-web').Client.TransactionDetails;
export type TransactionDetails = ReturnType<import('@nimiq/core-web').Client.TransactionDetails['toPlain']>;
export type ConsensusState = import('@nimiq/core-web').Client.ConsensusState;

export interface NimiqClient {
    addTransactionListener(
        listener: (tx: TransactionDetails | RawTransactionDetails) => any,
        addresses: string[],
    ): number | Promise<number>;
    getTransactionsByAddress(
        address: string,
        sinceBlockHeight?: number,
        knownTransactions?: TransactionDetails[] | RawTransactionDetails[],
    ): Promise<TransactionDetails[] | RawTransactionDetails[]>;
    removeListener(handle: number): void | Promise<void>;
    sendTransaction(
        tx: TransactionDetails | RawTransactionDetails | string,
    ): Promise<TransactionDetails | RawTransactionDetails>;
    addConsensusChangedListener(listener: (consensusState: ConsensusState) => any): number | Promise<number>;
}

export class NimiqAssetAdapter implements AssetAdapter<SwapAsset.NIM> {
    private cancelCallback: ((reason: Error) => void) | null = null;
    private stopped = false;

    constructor(public client: NimiqClient) {}

    private async findTransaction(
        address: string,
        test: (tx: TransactionDetails) => boolean,
    ): Promise<TransactionDetails> {
        // eslint-disable-next-line no-async-promise-executor
        return new Promise(async (resolve, reject) => {
            const listener = (tx: TransactionDetails | RawTransactionDetails) => {
                if ('toPlain' in tx) tx = tx.toPlain();
                if (!test(tx)) return false;

                cleanup();
                resolve(tx);
                return true;
            };

            // First subscribe to new transactions
            const transactionListener = await this.client.addTransactionListener(listener, [address]);

            // Setup a transaction history check function
            let history: TransactionDetails[] | RawTransactionDetails[] = [];
            const checkHistory = async () => {
                history = await this.client.getTransactionsByAddress(address, 0, history);
                for (const tx of history) {
                    if (listener(tx)) break;
                }
            };

            // Then check transaction history
            checkHistory();

            // Re-check transaction history when consensus is re-established
            const consensusListener = await this.client.addConsensusChangedListener(
                (consensusState: ConsensusState) => consensusState === 'established' && checkHistory(),
            );

            // Also re-check transaction history every minute to catch cases where subscription fails
            // or a short connection outage happened that didn't register as a consensus event.
            const historyCheckInterval = window.setInterval(checkHistory, 60 * 1000); // Every minute

            const cleanup = () => {
                this.client.removeListener(transactionListener);
                this.client.removeListener(consensusListener);
                window.clearInterval(historyCheckInterval);
                this.cancelCallback = null;
            };

            // Assign global cancel callback
            this.cancelCallback = (reason: Error) => {
                cleanup();
                reject(reason);
            };
        });
    }

    public async awaitHtlcFunding(
        address: string,
        value: number,
        data: string,
        confirmations = 0,
        onPending?: (tx: TransactionDetails) => any,
    ): Promise<TransactionDetails> {
        return this.findTransaction(
            address,
            (tx) => {
                if (tx.recipient !== address) return false;
                if (tx.value !== value) return false;
                if (typeof tx.data.raw !== 'string' || tx.data.raw !== data) return false;

                // Must wait until mined
                if (tx.state === 'mined' || tx.state === 'confirmed') {
                    if (tx.confirmations! >= confirmations) return true;
                }

                if (typeof onPending === 'function') onPending(tx);

                return false;
            },
        );
    }

    public async fundHtlc(
        serializedTx: string,
        onPending?: (tx: TransactionDetails) => any,
        serializedProxyTx?: string,
    ): Promise<TransactionDetails> {
        if (serializedProxyTx) {
            // Wait for proxy to be funded before forwarding funds into htlc.
            // The proxy funding tx had already been broadcast by the hub but send it again just to be sure.
            const proxyTx = await this.sendTransaction(serializedProxyTx, false);
            const resendInterval = window.setInterval(
                () => this.sendTransaction(serializedProxyTx, false),
                60 * 1000, // Every 1 minute
            );
            await this.findTransaction(proxyTx.recipient, (tx) =>
                tx.transactionHash === proxyTx.transactionHash
                && (tx.state === 'mined' || tx.state === 'confirmed')).finally(() =>
                    window.clearInterval(resendInterval)
                );
        }

        const htlcTx = await this.sendTransaction(serializedTx, false);

        if (htlcTx.state === 'new' || htlcTx.state === 'pending') {
            if (typeof onPending === 'function') onPending(htlcTx);
            const resendInterval = window.setInterval(
                () => this.sendTransaction(serializedTx, false),
                60 * 1000, // Every 1 minute
            );
            return this.awaitHtlcFunding(htlcTx.recipient, htlcTx.value, htlcTx.data.raw)
                .finally(() => window.clearInterval(resendInterval));
        }

        return htlcTx;
    }

    public async awaitHtlcSettlement(address: string): Promise<TransactionDetails> {
        return this.findTransaction(
            address,
            (tx) =>
                tx.sender === address
                && typeof (tx.proof as any as { preImage: unknown }).preImage === 'string',
        );
    }

    public async awaitSwapSecret(address: string): Promise<string> {
        const tx = await this.awaitHtlcSettlement(address);
        return (tx.proof as any as { preImage: string }).preImage;
    }

    public async settleHtlc(
        serializedTx: string,
        secret: string,
        hash: string,
    ): Promise<TransactionDetails> {
        serializedTx = serializedTx
            .replace(
                `${hash}0000000000000000000000000000000000000000000000000000000000000000`,
                `${hash}${secret}`,
            )
            // Also handle "valid" transactions, where the hashRoot is the hash of the dummy secret
            .replace(
                '66687aadf862bd776c8fc18b8e9f8e20089714856ee233b3902a591d0d5f2925' // SHA256 hash of dummy secret
                    + '0000000000000000000000000000000000000000000000000000000000000000', // Dummy secret
                `${hash}${secret}`,
            );
        return this.sendTransaction(serializedTx);
    }

    public async awaitSettlementConfirmation(
        address: string,
        onUpdate?: (tx: TransactionDetails) => any,
    ): Promise<TransactionDetails> {
        return this.findTransaction(address, (tx) => {
            if (tx.sender !== address) return false;
            if (typeof (tx.proof as any as { preImage: unknown }).preImage !== 'string') return false;
            if (tx.state === 'mined' || tx.state === 'confirmed') return true;
            if (typeof onUpdate === 'function') onUpdate(tx);
            return false;
        });
    }

    public stop(reason: Error): void {
        if (this.cancelCallback) this.cancelCallback(reason);
        this.stopped = true;
    }

    private async sendTransaction(serializedTx: string, throwOnFailure = true): Promise<TransactionDetails> {
        if (this.stopped) throw new Error('NimiqAssetAdapter called while stopped');
        let tx = await this.client.sendTransaction(serializedTx);
        if ('toPlain' in tx) tx = tx.toPlain();
        if (throwOnFailure && tx.state === 'new') throw new Error('Failed to send transaction');
        return tx;
    }
}
