import { Htlc, HtlcStatus, SettlementTokens } from '@nimiq/oasis-api';
import type { AssetAdapter, FiatSwapAsset } from './IAssetAdapter';
export { Htlc as OasisHtlcDetails, SettlementTokens as OasisSettlementTokens };
export interface OasisClient {
    getHtlc(id: string): Promise<Htlc>;
    settleHtlc(id: string, secret: string, settlementJWS: string, tokens?: SettlementTokens): Promise<Htlc>;
}
export declare class FiatAssetAdapter implements AssetAdapter<FiatSwapAsset> {
    client: OasisClient;
    private cancelCallback;
    private stopped;
    constructor(client: OasisClient);
    private findTransaction;
    awaitHtlcFunding(id: string, value: number, data?: string, confirmations?: number, onUpdate?: (htlc: Htlc) => any): Promise<Htlc>;
    fundHtlc(): Promise<Htlc>;
    awaitHtlcSettlement(id: string): Promise<Htlc<HtlcStatus.SETTLED>>;
    awaitSwapSecret(id: string): Promise<string>;
    settleHtlc(settlementJWS: string, secret: string, hash: string, tokens?: SettlementTokens): Promise<Htlc>;
    awaitSettlementConfirmation(id: string, onUpdate?: (tx: Htlc) => any): Promise<Htlc>;
    stop(reason: Error): void;
}
