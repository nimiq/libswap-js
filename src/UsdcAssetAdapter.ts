import { BigNumber, Contract, Event as EthersEvent, EventFilter, providers } from 'ethers';
import { AssetAdapter, SwapAsset } from './IAssetAdapter';

export enum EventType {
    OPEN = 'Open',
    REDEEM = 'Redeem',
    REFUND = 'Refund',
}

type OpenEventArgs = [
    /* id */ string,
    /* token */ string,
    /* amount */ BigNumber,
    /* recipient */ string,
    /* hash */ string,
    /* timeout */ BigNumber,
];

type RedeemEventArgs = [
    /* id */ string,
    /* secret */ string,
];

type RefundEventArgs = [
    /* id */ string,
];

type EventArgs<T extends EventType> = T extends EventType.OPEN ? OpenEventArgs
    : T extends EventType.REDEEM ? RedeemEventArgs
    : T extends EventType.REFUND ? RefundEventArgs
    : never;

type OpenResult = ReadonlyArray<any> & OpenEventArgs & {
    id: string,
    token: string,
    amount: BigNumber,
    recipient: string,
    hash: string,
    timeout: BigNumber,
};

type RedeemResult = ReadonlyArray<any> & RedeemEventArgs & {
    id: string,
    secret: string,
};

type RefundResult = ReadonlyArray<any> & RefundEventArgs & {
    id: string,
};

export interface Event<T extends EventType> extends EthersEvent {
    args: T extends EventType.OPEN ? OpenResult
        : T extends EventType.REDEEM ? RedeemResult
        : T extends EventType.REFUND ? RefundResult
        : never;
}

export type GenericEvent = Event<EventType>;

// type EventTester<T extends EventType> = (...args: EventArgs<T>) => boolean;

export interface Web3Client {
    htlcContract: Contract;
    currentBlock: () => number | Promise<number>;
    startBlock: number;
    endBlock?: number;
}

export class UsdcAssetAdapter implements AssetAdapter<SwapAsset.USDC | SwapAsset.USDC_MATIC> {
    private cancelCallback: ((reason: Error) => void) | null = null;
    private stopped = false;

    constructor(public client: Web3Client) {}

    public async findLog<T extends EventType>(
        filter: EventFilter,
        test?: (...args: [...EventArgs<T>, Event<T>]) => boolean | Promise<boolean>,
    ): Promise<Event<T>> {
        // eslint-disable-next-line no-async-promise-executor
        return new Promise(async (resolve, reject) => {
            const listener = async (...args: [...EventArgs<T>, Event<T>]) => {
                if (test && !(await test.apply(this, args))) return false;

                cleanup();
                resolve(args[args.length - 1] as Event<T>);
                return true;
            };

            // First subscribe to new logs
            this.client.htlcContract.on(filter, listener as unknown as providers.Listener);

            // Setup a log history check function
            const checkHistory = async () => {
                const history = await this.client.htlcContract.queryFilter(
                    filter,
                    this.client.startBlock,
                    this.client.endBlock,
                );
                for (const event of history) {
                    if (!event.args) continue;
                    if (await listener(...event.args as EventArgs<T>, event as Event<T>)) break;
                }
            };

            // Then check log history
            checkHistory();

            // Also re-check log history every minute to catch cases where subscription fails
            // or a short connection outage happened that didn't register as a consensus event.
            const historyCheckInterval = window.setInterval(checkHistory, 60 * 1000); // Every minute

            const cleanup = () => {
                this.client.htlcContract.off(filter, listener as unknown as providers.Listener);
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
        htlcId: string,
        value: number,
        data?: string,
        confirmations = 0,
        onPending?: (tx: GenericEvent) => any,
    ): Promise<Event<EventType.OPEN>> {
        const filter = this.client.htlcContract.filters.Open(htlcId);

        return this.findLog<EventType.OPEN>(
            filter,
            async (id, token, amount, recipient, hash, timeout, log) => {
                if (amount.toNumber() !== value) {
                    console.warn(
                        `Found USDC HTLC, but amount does not match. Expected ${value}, found ${amount.toNumber()}`,
                    );
                    return false;
                }

                if (confirmations > 0) {
                    const logConfirmations = await this.client.currentBlock() - log.blockNumber + 1;
                    if (logConfirmations < confirmations) {
                        if (typeof onPending === 'function') onPending(log);

                        return false;
                    }
                }

                // Only logs that are already included in the blockchain can be returned by the filter
                return true;
            },
        );
    }

    public async fundHtlc(_serializedTx: string): Promise<Event<EventType.OPEN>> {
        throw new Error('Method "fundHtlc" not available for USDC HTLCs');
    }

    public async awaitHtlcSettlement(htlcId: string): Promise<Event<EventType.REDEEM>> {
        const filter = this.client.htlcContract.filters.Redeem(htlcId);
        return this.findLog<EventType.REDEEM>(filter);
    }

    public async awaitSwapSecret(htlcId: string): Promise<string> {
        const log = await this.awaitHtlcSettlement(htlcId);
        return log.args.secret.substring(2);
    }

    public async settleHtlc(
        _serializedTx: string,
        _secret: string,
    ): Promise<Event<EventType.REDEEM>> {
        throw new Error('Method "settleHtlc" not available for USDC HTLCs');
    }

    public async awaitSettlementConfirmation(htlcId: string): Promise<Event<EventType.REDEEM>> {
        return this.awaitHtlcSettlement(htlcId);
    }

    public stop(reason: Error): void {
        if (this.cancelCallback) this.cancelCallback(reason);
        this.stopped = true;
    }
}
