export var EventType;
(function (EventType) {
    EventType["OPEN"] = "Open";
    EventType["REDEEM"] = "Redeem";
    EventType["REFUND"] = "Refund";
})(EventType || (EventType = {}));
export class Erc20AssetAdapter {
    constructor(client) {
        this.client = client;
        this.cancelCallback = null;
        this.stopped = false;
    }
    async findLog(filter, test) {
        return new Promise(async (resolve, reject) => {
            const listener = async (...args) => {
                if (test && !(await test.apply(this, args)))
                    return false;
                cleanup();
                resolve(args[args.length - 1]);
                return true;
            };
            this.client.htlcContract.on(filter, listener);
            const checkHistory = async () => {
                const history = await this.client.htlcContract.queryFilter(filter, this.client.startBlock, this.client.endBlock);
                for (const event of history) {
                    if (!event.args)
                        continue;
                    if (await listener(...event.args, event))
                        break;
                }
            };
            checkHistory();
            const historyCheckInterval = window.setInterval(checkHistory, 60 * 1000);
            const cleanup = () => {
                this.client.htlcContract.off(filter, listener);
                window.clearInterval(historyCheckInterval);
                this.cancelCallback = null;
            };
            this.cancelCallback = (reason) => {
                cleanup();
                reject(reason);
            };
        });
    }
    async awaitHtlcFunding(htlcId, value, data, confirmations = 0, onPending) {
        const filter = this.client.htlcContract.filters.Open(htlcId);
        return this.findLog(filter, async (id, token, amount, recipient, hash, timeout, log) => {
            if (amount.toNumber() !== value) {
                console.warn(`Found ERC-20 HTLC, but amount does not match. Expected ${value}, found ${amount.toNumber()}`);
                return false;
            }
            if (confirmations > 0) {
                const logConfirmations = await this.client.currentBlock() - log.blockNumber + 1;
                if (logConfirmations < confirmations) {
                    if (typeof onPending === 'function')
                        onPending(log);
                    return false;
                }
            }
            return true;
        });
    }
    async fundHtlc(_serializedTx) {
        throw new Error('Method "fundHtlc" not available for ERC-20 HTLCs');
    }
    async awaitHtlcSettlement(htlcId) {
        const filter = this.client.htlcContract.filters.Redeem(htlcId);
        return this.findLog(filter);
    }
    async awaitSwapSecret(htlcId) {
        const log = await this.awaitHtlcSettlement(htlcId);
        return log.args.secret.substring(2);
    }
    async settleHtlc(_serializedTx, _secret) {
        throw new Error('Method "settleHtlc" not available for ERC-20 HTLCs');
    }
    async awaitSettlementConfirmation(htlcId) {
        return this.awaitHtlcSettlement(htlcId);
    }
    stop(reason) {
        if (this.cancelCallback)
            this.cancelCallback(reason);
        this.stopped = true;
    }
}
