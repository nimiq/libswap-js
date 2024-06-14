import { BitcoinAssetAdapter } from './BitcoinAssetAdapter';
import { Erc20AssetAdapter } from './Erc20AssetAdapter';
import { FiatAssetAdapter } from './FiatAssetAdapter';
import { SwapAsset } from './IAssetAdapter';
import { NimiqAssetAdapter } from './NimiqAssetAdapter';
export { SwapAsset };
export class SwapHandler {
    static makeAssetAdapter(asset, client) {
        switch (asset) {
            case SwapAsset.NIM:
                return new NimiqAssetAdapter(client);
            case SwapAsset.BTC:
                return new BitcoinAssetAdapter(client);
            case SwapAsset.USDC:
            case SwapAsset.USDC_MATIC:
            case SwapAsset.USDT:
                return new Erc20AssetAdapter(client);
            case SwapAsset.EUR:
                return new FiatAssetAdapter(client);
            case SwapAsset.CRC:
                return new FiatAssetAdapter(client);
            default:
                throw new Error(`Unsupported asset: ${asset}`);
        }
    }
    constructor(swap, fromClient, toClient) {
        this.swap = swap;
        this.fromAssetAdapter = SwapHandler.makeAssetAdapter(this.swap.from.asset, fromClient);
        this.toAssetAdapter = SwapHandler.makeAssetAdapter(this.swap.to.asset, toClient);
    }
    setSwap(swap) {
        this.swap = swap;
    }
    async awaitIncoming(onUpdate, confirmations = 0) {
        const contract = this.swap.contracts[this.swap.to.asset];
        return this.toAssetAdapter.awaitHtlcFunding(contract.htlc.address, this.swap.to.amount + this.swap.to.serviceEscrowFee, this.swap.to.asset === SwapAsset.NIM ? contract.htlc.data : '', confirmations, onUpdate);
    }
    async createOutgoing(serializedTx, onPending, serializedProxyTx) {
        return this.fromAssetAdapter.fundHtlc(serializedTx, onPending, serializedProxyTx);
    }
    async awaitOutgoing(onUpdate, confirmations = 0) {
        const contract = this.swap.contracts[this.swap.from.asset];
        return this.fromAssetAdapter.awaitHtlcFunding(contract.htlc.address, this.swap.from.amount, this.swap.from.asset === SwapAsset.NIM ? contract.htlc.data : '', confirmations, onUpdate);
    }
    async awaitSecret() {
        const contract = this.swap.contracts[this.swap.from.asset];
        return this.fromAssetAdapter.awaitSwapSecret(contract.htlc.address, this.swap.from.asset === SwapAsset.BTC ? contract.htlc.script : '');
    }
    async settleIncoming(serializedTx, secret, tokens) {
        return this.toAssetAdapter.settleHtlc(serializedTx, secret, this.swap.hash, tokens);
    }
    async awaitIncomingConfirmation(onUpdate) {
        const contract = this.swap.contracts[this.swap.to.asset];
        return this.toAssetAdapter.awaitSettlementConfirmation(contract.htlc.address, onUpdate);
    }
    stop(reason) {
        this.fromAssetAdapter.stop(reason);
        this.toAssetAdapter.stop(reason);
    }
}
