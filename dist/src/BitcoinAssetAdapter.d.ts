import type { ConsensusState, TransactionDetails } from '@nimiq/electrum-client';
import { AssetAdapter, SwapAsset } from './IAssetAdapter';
export { ConsensusState, TransactionDetails };
export interface BitcoinClient {
    addTransactionListener(listener: (tx: TransactionDetails) => any, addresses: string[]): number | Promise<number>;
    getTransactionsByAddress(address: string, sinceBlockHeight?: number, knownTransactions?: TransactionDetails[]): Promise<TransactionDetails[]>;
    removeListener(handle: number): void | Promise<void>;
    sendTransaction(tx: TransactionDetails | string): Promise<TransactionDetails>;
    addConsensusChangedListener(listener: (consensusState: ConsensusState) => any): number | Promise<number>;
}
export declare class BitcoinAssetAdapter implements AssetAdapter<SwapAsset.BTC> {
    client: BitcoinClient;
    private cancelCallback;
    private stopped;
    constructor(client: BitcoinClient);
    private findTransaction;
    awaitHtlcFunding(address: string, value: number, data?: string, confirmations?: number, onPending?: (tx: TransactionDetails) => any): Promise<TransactionDetails>;
    fundHtlc(serializedTx: string): Promise<TransactionDetails>;
    awaitHtlcSettlement(address: string, data: string): Promise<TransactionDetails>;
    awaitSwapSecret(address: string, data: string): Promise<string>;
    settleHtlc(serializedTx: string, secret: string): Promise<TransactionDetails>;
    awaitSettlementConfirmation(address: string, onUpdate?: (tx: TransactionDetails) => any): Promise<TransactionDetails>;
    stop(reason: Error): void;
    private sendTransaction;
}
