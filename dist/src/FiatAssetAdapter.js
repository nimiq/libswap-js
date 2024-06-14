import { HtlcStatus, SettlementStatus } from '@nimiq/oasis-api';
export class FiatAssetAdapter {
    constructor(client) {
        this.client = client;
        this.cancelCallback = null;
        this.stopped = false;
    }
    async findTransaction(id, test) {
        const check = async () => {
            try {
                const htlc = await this.client.getHtlc(id);
                if (test(htlc))
                    return htlc;
            }
            catch (error) {
                console.error(error);
                if (error.message !== 'HTLC not found') {
                }
            }
            return null;
        };
        const htlc = await check();
        if (htlc)
            return htlc;
        return new Promise((resolve, reject) => {
            const interval = window.setInterval(() => {
                check().then((htlc) => {
                    if (!htlc)
                        return;
                    cleanup();
                    resolve(htlc);
                });
            }, 5 * 1000);
            const cleanup = () => {
                window.clearInterval(interval);
                this.cancelCallback = null;
            };
            this.cancelCallback = (reason) => {
                cleanup();
                reject(reason);
            };
        });
    }
    async awaitHtlcFunding(id, value, data, confirmations, onUpdate) {
        return this.findTransaction(id, (htlc) => {
            if (htlc.status === HtlcStatus.CLEARED || htlc.status === HtlcStatus.SETTLED)
                return true;
            if (typeof onUpdate === 'function')
                onUpdate(htlc);
            return false;
        });
    }
    async fundHtlc() {
        throw new Error('Method "fundHtlc" not available for EUR/CRC HTLCs');
    }
    async awaitHtlcSettlement(id) {
        return this.findTransaction(id, (htlc) => typeof htlc.preimage.value === 'string');
    }
    async awaitSwapSecret(id) {
        const tx = await this.awaitHtlcSettlement(id);
        return tx.preimage.value;
    }
    async settleHtlc(settlementJWS, secret, hash, tokens) {
        if (this.stopped)
            throw new Error('FiatAssetAdapter called while stopped');
        const jwsBody = settlementJWS.split('.')[1];
        const jsonBody = atob(jwsBody.replace(/_/g, '/').replace(/-/g, '+'));
        const payload = JSON.parse(jsonBody);
        let htlc;
        try {
            htlc = await this.client.settleHtlc(payload.contractId, secret, settlementJWS, tokens);
        }
        catch (error) {
            console.error(error);
            htlc = await this.client.getHtlc(payload.contractId);
        }
        if (htlc.status !== HtlcStatus.SETTLED || htlc.settlement.status === SettlementStatus.WAITING) {
            throw new Error('Could not settle OASIS HTLC (invalid secret or authorization token?)');
        }
        return htlc;
    }
    async awaitSettlementConfirmation(id, onUpdate) {
        return this.findTransaction(id, (htlc) => {
            if (htlc.status !== HtlcStatus.SETTLED)
                return false;
            if (htlc.settlement.status === SettlementStatus.ACCEPTED
                || htlc.settlement.status === SettlementStatus.CONFIRMED)
                return true;
            if (typeof onUpdate === 'function')
                onUpdate(htlc);
            return false;
        });
    }
    stop(reason) {
        if (this.cancelCallback)
            this.cancelCallback(reason);
        this.stopped = true;
    }
}
