# Subscription management

{% hint style="warning" %}
**Reactivity is currently only available on TESTNET**
{% endhint %}

Manage your reactivity subscriptions efficiently using the SDK, or do the same via Solidity by directly accessing the Somnia Reactivity Precompile. This covers creation, listing, querying, and cancellation for both off-chain (WebSocket) and on-chain (Solidity) types. Off-chain subscriptions are local to your app; on-chain are chain-managed and require funding (min 32 SOMI).

#### Off-Chain (WebSocket) Subscriptions

Off-chain subs use WebSockets for push notifications. Management is app-side—no chain queries needed.

**Creating a Subscription**

Use `sdk.subscribe()` to start listening. Returns an object with `unsubscribe()`.

```typescript
import { SDK, SubscriptionCallback } from '@somnia-chain/reactivity';

const subscription = await sdk.subscribe({
  ethCalls: [], // Optional: ETH view calls
  onData: (data: SubscriptionCallback) => {
    console.log('Event:', data);
  },
  // Other filters: eventTopics, origin, etc.
});

// Store subscription for later management
```

**Unsubscribing**

Call the returned method to stop.

```typescript
subscription.unsubscribe();
```

**Tips**

* Track subs in your app state (e.g., array of subscription objects).
* No listing/querying via SDK—handle locally as they're not persisted on-chain.

#### On-Chain (Solidity) Subscriptions

On-chain subs invoke handlers via EVM. Managed by the chain; owner must fund.

**Subscription Data Structure**

```typescript
export type SoliditySubscriptionData = {
  eventTopics?: Hex[]; // Optional filters
  origin?: Address;
  caller?: Address;
  emitter?: Address;
  handlerContractAddress: Address; // Required
  handlerFunctionSelector?: Hex; // Optional override
  priorityFeePerGas: bigint;
  maxFeePerGas: bigint;
  gasLimit: bigint;
  isGuaranteed: boolean;
  isCoalesced: boolean;
};

export type SoliditySubscriptionInfo = {
  subscriptionData: SoliditySubscriptionData,
  owner: Address
};
```

**Creating a Subscription**

Returns tx hash on success.

```typescript
const subData: SoliditySubscriptionData = {
  handlerContractAddress: '0x123...',
  priorityFeePerGas: parseGwei('2'),
  maxFeePerGas: parseGwei('10'),
  gasLimit: 2_000_000n,
  isGuaranteed: true,
  isCoalesced: false,
  // Add filters as needed
};

const txHash = await sdk.createSoliditySubscription(subData);
if (txHash instanceof Error) {
  console.error(txHash.message);
} else {
  console.log('Created:', txHash);
}
```

**Getting Subscription Info**

Fetch details by ID.

```typescript
const info = await sdk.getSubscriptionInfo(123n); // bigint ID
if (info instanceof Error) {
  console.error(info.message);
} else {
  console.log('Info:', info);
}
```

**Cancelling a Subscription**

Returns txn hash on success. Only owner can cancel.

```typescript
const txHash = await sdk.cancelSoliditySubscription(123n);
if (txHash instanceof Error) {
  console.error(txHash.message);
} else {
  console.log('Canceled:', txHash);
}
```

#### Best Practices

* **Funding**: Ensure owner has 32+ SOMI; subs pause if low.
* **Error Handling**: Always check for Error instances.
* **Monitoring**: For on-chain, periodically list and query to monitor status.
* **Security**: Use private keys securely; avoid over-provisioning gas.

For full SDK reference, see API Reference.

### Solidity Subscription management

#### Creating Subscriptions

Whoever calls the `subscribe` function becomes the owner of the subscription. The owner can be EOA or a smart contract. In either case, the owner is required to hold a minimum amount of SOMI and is responsible for paying the gas fees associated with handling events.

The `SubscriptionData` struct defines the criteria for the event subscription and how it should be handled:

* **eventTopics**: An array of 4 bytes32 values representing the event topics to filter by. Use `bytes32(0)` for wildcards.
* **origin**: Filters by the transaction origin (`tx.origin`). Use `address(0)` for any origin.
* **caller**: Reserved for future use. Currently not active in event matching. Use `address(0)`.
* **emitter**: The address of the contract emitting the event. Use `address(0)` for any emitter.
* **handlerContractAddress**: The address of the contract that will be called when a matching event occurs.
* **handlerFunctionSelector**: The 4-byte function selector of the method to call on the handler contract.
* **priorityFeePerGas**: Additional gas fee paid to validators to prioritize this event handling. This is expressed in nanoSOMI (gwei equivalent).
* **maxFeePerGas**: The maximum total gas fee (base + priority) the subscriber is willing to pay. This is expressed in nanoSOMI (gwei equivalent).
* **gasLimit**: The maximum gas that will be provisioned per subscription callback
* **isGuaranteed**: If `true`, the event handling is guaranteed to execute, potentially moving to the next block if the current block is full.
* **isCoalesced**: If `true`, multiple matching events in the same block can be coalesced into a single handler call (implementation dependent).

A subscription can be handled by any smart contract (no special op codes). Additionally, the optional function selector can be used, that is prefixed to the event data when calling the handler contract.

**Handling Events**

When an event matching the subscription criteria is emitted, the Somnia Reactivity Precompile will invoke the specified handler contract and function. The handler contract can implement a function that matches the `handlerFunctionSelector` specified in the subscription. This function will be called with the event data when a matching event occurs. The owner of the subscription is charged the gas fees specified in the subscription for each event handled. The two fields indicate that the call the to handler has been initialized by the precompile:

* **msg.sender**: The Somnia Reactivity Precompile address (`0x0100`).
* **tx.origin**: The owner of the subscription.

#### Examples

**1. Fully On-Chain Subscription**

You can create subscriptions directly from another smart contract. This is useful for creating autonomous agents or protocols that react to network activity.

**Key Snippet:**

```solidity
ISomniaReactivityPrecompile.SubscriptionData memory subscriptionData = ISomniaReactivityPrecompile.SubscriptionData({
    eventTopics: [Transfer.selector, bytes32(0), bytes32(0), bytes32(0)],
    origin: address(0),
    caller: address(0),
    emitter: address(tokenAddress),
    handlerContractAddress: address(this),
    handlerFunctionSelector: ISomniaEventHandler.onEvent.selector,
    priorityFeePerGas: 2 gwei,       // 2 nanoSOMI
    maxFeePerGas: 10 gwei,           // 10 nanoSOMI
    gasLimit: 2_000_000,             // Sufficient for simple state updates
    isGuaranteed: true,
    isCoalesced: false
});

uint256 subscriptionId = somniaReactivityPrecompile.subscribe(subscriptionData);
```
