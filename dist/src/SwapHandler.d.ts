import type { OasisSettlementTokens } from './FiatAssetAdapter';
import { SwapAsset } from './IAssetAdapter';
import type { AssetAdapter, Client, Transaction } from './IAssetAdapter';
export { Client, SwapAsset, Transaction };
export type Contract<TAsset extends SwapAsset> = {
    htlc: {
        address: string;
        data: TAsset extends SwapAsset.NIM ? string : never;
        script: TAsset extends SwapAsset.BTC ? string : never;
        contract: TAsset extends SwapAsset.USDC | SwapAsset.USDC_MATIC | SwapAsset.USDT ? string : never;
    };
};
export type Swap<FromAsset extends SwapAsset, ToAsset extends SwapAsset> = {
    from: {
        asset: FromAsset;
        amount: number;
    };
    to: {
        asset: ToAsset;
        amount: number;
        serviceEscrowFee: number;
    };
    hash: string;
    contracts: {
        [asset in FromAsset | ToAsset]: Contract<FromAsset | ToAsset>;
    };
};
export declare class SwapHandler<FromAsset extends SwapAsset, ToAsset extends SwapAsset> {
    private swap;
    fromAssetAdapter: AssetAdapter<FromAsset>;
    toAssetAdapter: AssetAdapter<ToAsset>;
    private static makeAssetAdapter;
    constructor(swap: Swap<FromAsset, ToAsset>, fromClient: Client<FromAsset>, toClient: Client<ToAsset>);
    setSwap(swap: Swap<FromAsset, ToAsset>): void;
    awaitIncoming(onUpdate: (tx: Transaction<ToAsset>) => any, confirmations?: number): Promise<Transaction<ToAsset>>;
    createOutgoing(serializedTx: string, onPending: (tx: Transaction<FromAsset>) => any, serializedProxyTx?: string): Promise<Transaction<FromAsset>>;
    awaitOutgoing(onUpdate: (tx: Transaction<FromAsset>) => any, confirmations?: number): Promise<Transaction<FromAsset>>;
    awaitSecret(): Promise<string>;
    settleIncoming(serializedTx: string, secret: string, tokens?: OasisSettlementTokens): Promise<Transaction<ToAsset>>;
    awaitIncomingConfirmation(onUpdate?: (tx: Transaction<ToAsset>) => any): Promise<Transaction<ToAsset>>;
    stop(reason: Error): void;
}
