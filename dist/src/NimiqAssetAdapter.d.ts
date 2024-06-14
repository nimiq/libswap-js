import { AssetAdapter, SwapAsset } from './IAssetAdapter';
type RawTransactionDetails = import('@nimiq/core-web').Client.TransactionDetails;
export type TransactionDetails = ReturnType<import('@nimiq/core-web').Client.TransactionDetails['toPlain']>;
export type ConsensusState = import('@nimiq/core-web').Client.ConsensusState;
export interface NimiqClient {
    addTransactionListener(listener: (tx: TransactionDetails | RawTransactionDetails) => any, addresses: string[]): number | Promise<number>;
    getTransactionsByAddress(address: string, sinceBlockHeight?: number, knownTransactions?: TransactionDetails[] | RawTransactionDetails[]): Promise<TransactionDetails[] | RawTransactionDetails[]>;
    removeListener(handle: number): void | Promise<void>;
    sendTransaction(tx: TransactionDetails | RawTransactionDetails | string): Promise<TransactionDetails | RawTransactionDetails>;
    addConsensusChangedListener(listener: (consensusState: ConsensusState) => any): number | Promise<number>;
}
export declare class NimiqAssetAdapter implements AssetAdapter<SwapAsset.NIM> {
    client: NimiqClient;
    private cancelCallback;
    private stopped;
    constructor(client: NimiqClient);
    private findTransaction;
    awaitHtlcFunding(address: string, value: number, data: string, confirmations?: number, onPending?: (tx: TransactionDetails) => any): Promise<TransactionDetails>;
    fundHtlc(serializedTx: string, onPending?: (tx: TransactionDetails) => any, serializedProxyTx?: string): Promise<TransactionDetails>;
    awaitHtlcSettlement(address: string): Promise<TransactionDetails>;
    awaitSwapSecret(address: string): Promise<string>;
    settleHtlc(serializedTx: string, secret: string, hash: string): Promise<TransactionDetails>;
    awaitSettlementConfirmation(address: string, onUpdate?: (tx: TransactionDetails) => any): Promise<TransactionDetails>;
    stop(reason: Error): void;
    private sendTransaction;
}
export {};
