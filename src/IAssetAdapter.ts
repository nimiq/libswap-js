import { BitcoinClient, TransactionDetails as BitcoinTransactionDetails } from './BitcoinAssetAdapter';
import { GenericEvent as Erc20TransactionDetails, Web3Client } from './Erc20AssetAdapter';
import { HtlcDetails, OasisClient } from './FiatAssetAdapter';
import { NimiqClient, TransactionDetails as NimiqTransactionDetails } from './NimiqAssetAdapter';

export enum SwapAsset {
    NIM = 'NIM',
    BTC = 'BTC',
    USDC = 'USDC',
    USDC_MATIC = 'USDC_MATIC',
    USDT = 'USDT', // Alternatively USDT_MATIC
    EUR = 'EUR',
    CRC = 'CRC',
}

export type FiatSwapAsset = SwapAsset.EUR | SwapAsset.CRC;

export type Transaction<TAsset extends SwapAsset> = TAsset extends SwapAsset.NIM ? NimiqTransactionDetails
    : TAsset extends SwapAsset.BTC ? BitcoinTransactionDetails
    : TAsset extends SwapAsset.USDC | SwapAsset.USDC_MATIC | SwapAsset.USDT ? Erc20TransactionDetails
    : TAsset extends FiatSwapAsset ? HtlcDetails
    : never;

export type Client<TAsset extends SwapAsset> = TAsset extends SwapAsset.NIM ? NimiqClient
    : TAsset extends SwapAsset.BTC ? BitcoinClient
    : TAsset extends SwapAsset.USDC | SwapAsset.USDC_MATIC | SwapAsset.USDT ? Web3Client
    : TAsset extends FiatSwapAsset ? OasisClient
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
