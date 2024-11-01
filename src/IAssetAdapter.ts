import { BitcoinClient, TransactionDetails as BitcoinTransactionDetails } from './BitcoinAssetAdapter';
import { GenericEvent as Erc20TransactionDetails, Web3Client } from './Erc20AssetAdapter';
import { HtlcDetails as EuroHtlcDetails, OasisClient } from './EuroAssetAdapter';
import { NimiqClient, TransactionDetails as NimiqTransactionDetails } from './NimiqAssetAdapter';

export enum SwapAsset {
    NIM = 'NIM',
    BTC = 'BTC',
    /**
     * Legacy bridged USDC.e on Polygon.
     */
    USDC = 'USDC',
    /**
     * Native USDC on Polygon.
     */
    USDC_MATIC = 'USDC_MATIC',
    /**
     * Bridged USDT on Polygon.
     */
    USDT_MATIC = 'USDT_MATIC',
    EUR = 'EUR',
}

export type Transaction<TAsset extends SwapAsset> = TAsset extends SwapAsset.NIM ? NimiqTransactionDetails
    : TAsset extends SwapAsset.BTC ? BitcoinTransactionDetails
    : TAsset extends SwapAsset.USDC | SwapAsset.USDC_MATIC | SwapAsset.USDT_MATIC ? Erc20TransactionDetails
    : TAsset extends SwapAsset.EUR ? EuroHtlcDetails
    : never;

export type Client<TAsset extends SwapAsset> = TAsset extends SwapAsset.NIM ? NimiqClient
    : TAsset extends SwapAsset.BTC ? BitcoinClient
    : TAsset extends SwapAsset.USDC | SwapAsset.USDC_MATIC | SwapAsset.USDT_MATIC ? Web3Client
    : TAsset extends SwapAsset.EUR ? OasisClient
    : never;

export interface AssetAdapter<TAsset extends SwapAsset> {
    client: Client<TAsset>;

    awaitHtlcFunding(
        address: string,
        value: number,
        data: string,
        confirmations: number,
        onPending?: (tx: Transaction<TAsset>) => any,
    ): Promise<Transaction<TAsset>>;

    fundHtlc(
        serializedTx: string,
        onPending: (tx: Transaction<TAsset>) => any,
        serializedProxyTx?: string,
    ): Promise<Transaction<TAsset>>;

    awaitHtlcSettlement(address: string, data: string): Promise<Transaction<TAsset>>;

    awaitSwapSecret(address: string, data: string): Promise<string>;

    settleHtlc(
        serializedTx: string,
        secret: string,
        hash: string,
        authorizationToken?: string,
    ): Promise<Transaction<TAsset>>;

    awaitSettlementConfirmation(
        address: string,
        onUpdate?: (tx: Transaction<TAsset>) => any,
    ): Promise<Transaction<TAsset>>;

    stop(reason: Error): void;
}
