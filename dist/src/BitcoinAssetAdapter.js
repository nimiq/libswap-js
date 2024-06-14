export class BitcoinAssetAdapter {
    constructor(client) {
        this.client = client;
        this.cancelCallback = null;
        this.stopped = false;
    }
    async findTransaction(address, test) {
        return new Promise(async (resolve, reject) => {
            const listener = (tx) => {
                if (!test(tx))
                    return false;
                cleanup();
                resolve(tx);
                return true;
            };
            const transactionListener = await this.client.addTransactionListener(listener, [address]);
            let history = [];
            const checkHistory = async () => {
                history = await this.client.getTransactionsByAddress(address, 0, history);
                for (const tx of history) {
                    if (listener(tx))
                        break;
                }
            };
            checkHistory();
            const consensusListener = await this.client.addConsensusChangedListener((consensusState) => consensusState === 'established' && checkHistory());
            const historyCheckInterval = window.setInterval(checkHistory, 60 * 1000);
            const cleanup = () => {
                this.client.removeListener(transactionListener);
                this.client.removeListener(consensusListener);
                window.clearInterval(historyCheckInterval);
                this.cancelCallback = null;
            };
            this.cancelCallback = (reason) => {
                cleanup();
                reject(reason);
            };
        });
    }
    async awaitHtlcFunding(address, value, data, confirmations = 0, onPending) {
        return this.findTransaction(address, (tx) => {
            const htlcOutput = tx.outputs.find((out) => out.address === address);
            if (!htlcOutput)
                return false;
            if (htlcOutput.value !== value)
                return false;
            if (tx.confirmations < confirmations) {
                if (typeof onPending === 'function')
                    onPending(tx);
                return false;
            }
            if (tx.replaceByFee) {
                if (tx.state === 'mined' || tx.state === 'confirmed')
                    return true;
                if (typeof onPending === 'function')
                    onPending(tx);
                return false;
            }
            return true;
        });
    }
    async fundHtlc(serializedTx) {
        if (this.stopped)
            throw new Error('BitcoinAssetAdapter called while stopped');
        return this.sendTransaction(serializedTx);
    }
    async awaitHtlcSettlement(address, data) {
        return this.findTransaction(address, (tx) => tx.inputs.some((input) => input.address === address
            && typeof input.witness[4] === 'string' && input.witness[4] === data));
    }
    async awaitSwapSecret(address, data) {
        const tx = await this.awaitHtlcSettlement(address, data);
        return tx.inputs[0].witness[2];
    }
    async settleHtlc(serializedTx, secret) {
        serializedTx = serializedTx.replace('000000000000000000000000000000000000000000000000000000000000000001', `${secret}01`);
        return this.sendTransaction(serializedTx);
    }
    async awaitSettlementConfirmation(address, onUpdate) {
        return this.findTransaction(address, (tx) => {
            if (!tx.inputs.some((input) => input.address === address && input.witness.length === 5))
                return false;
            if (tx.state === 'mined' || tx.state === 'confirmed')
                return true;
            if (typeof onUpdate === 'function')
                onUpdate(tx);
            return false;
        });
    }
    stop(reason) {
        if (this.cancelCallback)
            this.cancelCallback(reason);
        this.stopped = true;
    }
    async sendTransaction(serializedTx) {
        return this.client.sendTransaction(serializedTx);
    }
}
