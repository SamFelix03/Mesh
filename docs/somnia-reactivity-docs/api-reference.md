# API Reference

{% hint style="warning" %}
**Somnia Reactivity is currently only available on TESTNET**
{% endhint %}

### Off-chain (TypeScript)

#### WebSocket Subscription Initialization Params

```typescript
/**
 * @property The notification result data containing information about the event topic, data and view results
 */
export type SubscriptionCallback = {
  result: {
    topics: Hex[],
    data: Hex,
    simulationResults: Hex[]
  }
}

/**
 * @property ethCalls Fixed set of ETH calls that must be executed before onData callback is triggered. Multicall3 is recommended. Can be an empty array
 * @property context Event sourced selectors to be added to the data field of ETH calls, possible values: topic0, topic1, topic2, topic3, data and address
 * @property onData Callback for a successful reactivity notification
 * @property onError Callback for a failed attempt 
 * @property eventContractSources Alternative contract event source(s) (any on somnia) that will be emitting the logs specified by topicOverrides
 * @property topicOverrides Optional filter for specifying topics of interest, otherwise wildcard filter is applied (all events watched)
 * @property onlyPushChanges Whether the data should be pushed to the subscriber only if eth_call results are different from the previous
 */
export type WebsocketSubscriptionInitParams = {
    ethCalls: EthCall[]
    context?: string
    onData: (data: SubscriptionCallback) => void
    onError?: (error: Error) => void
    eventContractSources?: Address[]
    topicOverrides?: Hex[]
    onlyPushChanges?: boolean
}
```

An object of type `WebsocketSubscriptionInitParams` is the only required argument to the `subscribe` function required to create a subscription to a Somnia node to become notified about event + state changes that take place on-chain

Example:

```typescript
const subscription = await sdk.subscribe({
  ethCalls: [], // State to read when events are emitted
  onData: (data: SubscriptionCallback) => console.log('Received:', data),
})
```

#### Solidity Subscription Creation from SDK

```typescript
/**
 * @property eventTopics Optional event filters
 * @property origin Optional tx.origin filter
 * @property caller Reserved for future use (not currently active in event matching)
 * @property emitter Optional contract event emitter filter
 * @property handlerContractAddress Contract that will handle subscription callback
 * @property handlerFunctionSelector Optional override for specifying callback handler function
 * @property priorityFeePerGas Additional priority fee that will be paid per gas consumed by callback
 * @property maxFeePerGas Maximum fee per gas the subscriber is willing to pay (base fee + priority fee)
 * @property gasLimit Maximum gas that will be provisioned per subscription callback
 * @property isGuaranteed Whether event notification must be delivered regardless of block inclusion distance from emission
 * @property isCoalesced Whether multiple events can be coalesced into a single handling call per block
 */
export type SoliditySubscriptionData = {
    eventTopics?: Hex[];
    origin?: Address;
    caller?: Address;
    emitter?: Address;
    handlerContractAddress: Address;
    handlerFunctionSelector?: Hex;
    priorityFeePerGas: bigint;      
    maxFeePerGas: bigint;
    gasLimit: bigint;
    isGuaranteed: boolean;
    isCoalesced: boolean;
}
```

Example:

```typescript
import { parseGwei } from 'viem';

await sdk.createSoliditySubscription({
  handlerContractAddress: '0x123...',
  priorityFeePerGas: parseGwei('2'),   // 2 nanoSOMI — use parseGwei, not raw values
  maxFeePerGas: parseGwei('10'),       // 10 nanoSOMI
  gasLimit: 2_000_000n,                // Minimum recommended for state changes
  isGuaranteed: true,
  isCoalesced: false,
});
```

#### Solidity subscription info query from SDK

```typescript
export type SoliditySubscriptionInfo = {
  subscriptionData: SoliditySubscriptionData,
  owner: Address
}
```

Example:

```typescript
const subscriptionId = 1n;
const subscriptionInfo: SoliditySubscriptionInfo = await sdk.getSubscriptionInfo(
    subscriptionId
);
```
