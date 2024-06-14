import { BigNumber, Contract, Event as EthersEvent, EventFilter } from 'ethers';
import { AssetAdapter, SwapAsset } from './IAssetAdapter';
export declare enum EventType {
    OPEN = "Open",
    REDEEM = "Redeem",
    REFUND = "Refund"
}
type OpenEventArgs = [
    string,
    string,
    BigNumber,
    string,
    string,
    BigNumber
];
type RedeemEventArgs = [
    string,
    string
];
type RefundEventArgs = [
    string
];
type EventArgs<T extends EventType> = T extends EventType.OPEN ? OpenEventArgs : T extends EventType.REDEEM ? RedeemEventArgs : T extends EventType.REFUND ? RefundEventArgs : never;
type OpenResult = ReadonlyArray<any> & OpenEventArgs & {
    id: string;
    token: string;
    amount: BigNumber;
    recipient: string;
    hash: string;
    timeout: BigNumber;
};
type RedeemResult = ReadonlyArray<any> & RedeemEventArgs & {
    id: string;
    secret: string;
};
type RefundResult = ReadonlyArray<any> & RefundEventArgs & {
    id: string;
};
export interface Event<T extends EventType> extends EthersEvent {
    args: T extends EventType.OPEN ? OpenResult : T extends EventType.REDEEM ? RedeemResult : T extends EventType.REFUND ? RefundResult : never;
}
export type GenericEvent = Event<EventType>;
export interface Web3Client {
    htlcContract: Contract;
    currentBlock: () => number | Promise<number>;
    startBlock: number;
    endBlock?: number;
}
export declare class Erc20AssetAdapter implements AssetAdapter<SwapAsset.USDC | SwapAsset.USDC_MATIC | SwapAsset.USDT> {
    client: Web3Client;
    private cancelCallback;
    private stopped;
    constructor(client: Web3Client);
    findLog<T extends EventType>(filter: EventFilter, test?: (...args: [...EventArgs<T>, Event<T>]) => boolean | Promise<boolean>): Promise<Event<T>>;
    awaitHtlcFunding(htlcId: string, value: number, data?: string, confirmations?: number, onPending?: (tx: GenericEvent) => any): Promise<Event<EventType.OPEN>>;
    fundHtlc(_serializedTx: string): Promise<Event<EventType.OPEN>>;
    awaitHtlcSettlement(htlcId: string): Promise<Event<EventType.REDEEM>>;
    awaitSwapSecret(htlcId: string): Promise<string>;
    settleHtlc(_serializedTx: string, _secret: string): Promise<Event<EventType.REDEEM>>;
    awaitSettlementConfirmation(htlcId: string): Promise<Event<EventType.REDEEM>>;
    stop(reason: Error): void;
}
export {};
