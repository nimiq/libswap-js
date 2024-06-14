import { shim as shimPromiseFinally } from 'promise.prototype.finally';
shimPromiseFinally();
export class NimiqAssetAdapter {
    constructor(client) {
        this.client = client;
        this.cancelCallback = null;
        this.stopped = false;
    }
    async findTransaction(address, test) {
        return new Promise(async (resolve, reject) => {
            const listener = (tx) => {
                if ('toPlain' in tx)
                    tx = tx.toPlain();
                if (!test(tx))
                    return false;
                cleanup();
                resolve(tx);
                return true;
            };
            const transactionListener = await this.client.addTransactionListener(listener, [address]);
            let history = [];
            const checkHistory = async () => {
                history = await this.client.getTransactionsByAddress(address, 0, history);
                for (const tx of history) {
                    if (listener(tx))
                        break;
                }
            };
            checkHistory();
            const consensusListener = await this.client.addConsensusChangedListener((consensusState) => consensusState === 'established' && checkHistory());
            const historyCheckInterval = window.setInterval(checkHistory, 60 * 1000);
            const cleanup = () => {
                this.client.removeListener(transactionListener);
                this.client.removeListener(consensusListener);
                window.clearInterval(historyCheckInterval);
                this.cancelCallback = null;
            };
            this.cancelCallback = (reason) => {
                cleanup();
                reject(reason);
            };
        });
    }
    async awaitHtlcFunding(address, value, data, confirmations = 0, onPending) {
        return this.findTransaction(address, (tx) => {
            if (tx.recipient !== address)
                return false;
            if (tx.value !== value)
                return false;
            if (typeof tx.data.raw !== 'string' || tx.data.raw !== data)
                return false;
            if (tx.state === 'mined' || tx.state === 'confirmed') {
                if (tx.confirmations >= confirmations)
                    return true;
            }
            if (typeof onPending === 'function')
                onPending(tx);
            return false;
        });
    }
    async fundHtlc(serializedTx, onPending, serializedProxyTx) {
        if (serializedProxyTx) {
            const proxyTx = await this.sendTransaction(serializedProxyTx, false);
            const resendInterval = window.setInterval(() => this.sendTransaction(serializedProxyTx, false), 60 * 1000);
            await this.findTransaction(proxyTx.recipient, (tx) => tx.transactionHash === proxyTx.transactionHash
                && (tx.state === 'mined' || tx.state === 'confirmed')).finally(() => window.clearInterval(resendInterval));
        }
        const htlcTx = await this.sendTransaction(serializedTx, false);
        if (htlcTx.state === 'new' || htlcTx.state === 'pending') {
            if (typeof onPending === 'function')
                onPending(htlcTx);
            const resendInterval = window.setInterval(() => this.sendTransaction(serializedTx, false), 60 * 1000);
            return this.awaitHtlcFunding(htlcTx.recipient, htlcTx.value, htlcTx.data.raw)
                .finally(() => window.clearInterval(resendInterval));
        }
        return htlcTx;
    }
    async awaitHtlcSettlement(address) {
        return this.findTransaction(address, (tx) => tx.sender === address
            && typeof tx.proof.preImage === 'string');
    }
    async awaitSwapSecret(address) {
        const tx = await this.awaitHtlcSettlement(address);
        return tx.proof.preImage;
    }
    async settleHtlc(serializedTx, secret, hash) {
        serializedTx = serializedTx
            .replace(`${hash}0000000000000000000000000000000000000000000000000000000000000000`, `${hash}${secret}`)
            .replace('66687aadf862bd776c8fc18b8e9f8e20089714856ee233b3902a591d0d5f2925'
            + '0000000000000000000000000000000000000000000000000000000000000000', `${hash}${secret}`);
        return this.sendTransaction(serializedTx);
    }
    async awaitSettlementConfirmation(address, onUpdate) {
        return this.findTransaction(address, (tx) => {
            if (tx.sender !== address)
                return false;
            if (typeof tx.proof.preImage !== 'string')
                return false;
            if (tx.state === 'mined' || tx.state === 'confirmed')
                return true;
            if (typeof onUpdate === 'function')
                onUpdate(tx);
            return false;
        });
    }
    stop(reason) {
        if (this.cancelCallback)
            this.cancelCallback(reason);
        this.stopped = true;
    }
    async sendTransaction(serializedTx, throwOnFailure = true) {
        if (this.stopped)
            throw new Error('NimiqAssetAdapter called while stopped');
        let tx = await this.client.sendTransaction(serializedTx);
        if ('toPlain' in tx)
            tx = tx.toPlain();
        if (throwOnFailure && tx.state === 'new')
            throw new Error('Failed to send transaction');
        return tx;
    }
}
