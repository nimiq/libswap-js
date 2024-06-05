# libswap - Fastspot Atomic Swap Library

A Typescript handler class to handle and process atomic swaps with Fastspot.

The library does not work _only_ with Fastspot, but it uses the Fastspot API types.

## Package

This package can be installed from NPM as

```
@nimiq/libswap
```

https://www.npmjs.com/package/@nimiq/libswap

## API

```js
import { SwapHandler } from '@nimiq/libswap'

// Setup for swaps from NIM to BTC

// This fulfills the `Swap` type from @nimiq/fastspot-api
const swap = {
    from: {
        asset: 'NIM',
        amount: 1000e5, // 1000 NIM
    },
    to: {
        asset: 'BTC',
        amount: 0.001e8, // 1 mBTC
    },
    hash: '<swap hash (hashRoot) as HEX>',
    contracts: {
        NIM: {
            htlc: {
                address: '<HTLC address>',
                data: '<HTLC creation data as HEX>',
            }
        },
        BTC: {
            htlc: {
                address: '<HTLC address>',
                script: '<HTLC script as HEX>',
            }
        },
        /* For EUR: */
        // EUR: {
        //     htlc: {
        //         address: '<HTLC ID>',
        //     }
        // },
    }
}

/**
 * Initialize a SwapHandler with the swap object, the client for
 * the FROM asset and the client for the TO asset:
 */
const swapHandler = new SwapHandler(swap, nimiqClient, electrumClient)

/****************************************
 ** General process for any swap pair: **
 ****************************************/

/**
 * 1. Wait for swap partner to create their HTLC
 *
 * This method validates the HTLC data against the swap object
 * and resolves when the HTLC is valid.
 *
 * The optional `onUpdate` callback receives the transaction/HTLC object:
 * @type {(tx: Transaction<ToAsset>) => any} onUpdate
 */
await swapHandler.awaitIncoming(onUpdate)

/**
 * 2.A Create our HTLC
 *
 * The optional `onPending` callback receives the transaction object:
 * @type {(tx: Transaction<FromAsset>) => any} onPending
 */
await swapHandler.createOutgoing(serializedFundingTx, onPending)

/**
 * 2.B Alternatively, await HTLC funding from external wallet
 *
 * The optional `onUpdate` callback receives the transaction object:
 * @type {(tx: Transaction<FromAsset>) => any} onUpdate
 */
await swapHandler.awaitOutgoing(onUpdate)

/**
 * 3. Wait for the swap secret to be published on-chain
 */
const secret = await swapHandler.awaitSecret()

/**
 * 4. Settle the incoming HTLC with the swap secret
 *
 * The `serializedSettlementTx` (HEX string) must have a string of 0s (zeros) in place of
 * the swap secret, which will be replaced with the secret automatically.
 */
await swapHandler.settleIncoming(serializedSettlementTx, secret)

/**
 * 5. Await confirmation of settled HTLC
 *
 * This is especially relevant for EUR and CRC contracts, as they may take a
 * few minutes to confirm after they were settled.
 *
 * The optional `onUpdate` callback receives the transaction object:
 * @type {(tx: Transaction<ToAsset>) => any} onUpdate
 */
await swapHandler.awaitIncomingConfirmation(onUpdate)

// Done!
```
