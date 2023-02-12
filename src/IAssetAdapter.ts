import {
    TransactionDetails as NimiqTransactionDetails,
    NimiqClient,
} from './NimiqAssetAdapter';
import {
    TransactionDetails as BitcoinTransactionDetails,
    BitcoinClient,
} from './BitcoinAssetAdapter';
import {
    GenericEvent as UsdcTransactionDetails,
    Web3Client,
} from './UsdcAssetAdapter';
import {
    HtlcDetails as EuroHtlcDetails,
    OasisClient,
} from './EuroAssetAdapter';

export enum SwapAsset {
    NIM = 'NIM',
    BTC = 'BTC',
    USDC = 'USDC',
    EUR = 'EUR',
}

export type Transaction<TAsset extends SwapAsset> =
    TAsset extends SwapAsset.NIM ? NimiqTransactionDetails
    : TAsset extends SwapAsset.BTC ? BitcoinTransactionDetails
    : TAsset extends SwapAsset.USDC ? UsdcTransactionDetails
    : TAsset extends SwapAsset.EUR ? EuroHtlcDetails
    : never;

export type Client<TAsset extends SwapAsset> =
    TAsset extends SwapAsset.NIM ? NimiqClient
    : TAsset extends SwapAsset.BTC ? BitcoinClient
    : TAsset extends SwapAsset.USDC ? Web3Client
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
