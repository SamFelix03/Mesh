# Quickstart

{% hint style="warning" %}
**Reactivity is currently only available on TESTNET**
{% endhint %}

### Off-chain (TypeScript)

#### 📦 SDK Installation

```bash
npm i @somnia-chain/reactivity
```

#### 🔌 Plugging into the SDK

You'll need `viem` installed for the public and or wallet client. Install it with `npm i viem`.

```typescript
import { createPublicClient, createWalletClient, http, defineChain } from 'viem'
import { SDK } from '@somnia-chain/reactivity'

// Example: Public client (required for reading data)
const chain = defineChain() // see viem docs for defining a chain
const publicClient = createPublicClient({
  chain, 
  transport: http(),
})

// Optional: Wallet client for writes
const walletClient = createWalletClient({
  account,
  chain,
  transport: http(),
})

const sdk = new SDK({
  public: publicClient,
  wallet: walletClient, // Omit if not executing transactions on-chain
})
```

#### 📡 Activating Websocket Reactivity Subscriptions

Use WebSocket subscriptions for real-time updates to contract event and state updates atomically. Define params and subscribe — the SDK handles the rest via WebSockets.

```typescript
import { SDK, WebsocketSubscriptionInitParams, SubscriptionCallback } from '@somnia-chain/reactivity'

const initParams: WebsocketSubscriptionInitParams = {
  ethCalls: [], // State to read when events are emitted
  onData: (data: SubscriptionCallback) => console.log('Received:', data),
}

const subscription = await sdk.subscribe(initParams)
```

### On-chain (Solidity handlers)

Developers can build Solidity smart contracts that get invoked when other contracts emit events—allowing smart contracts to "react" to what's happening on-chain.

In order to achieve this, we need two things:

1. A Somnia event handler smart contract (standard Solidity syntax).
2. A valid subscription with funds to pay for Solidity handler invocations. Creators of on-chain subscriptions are required to hold minimum balances (currently 32 SOMI) that pay for handler invocations executed by validators.

#### Creating the Handler Smart Contract

Very basic contract with the `@somnia-chain/reactivity-contracts` npm package installed

```solidity
pragma solidity ^0.8.20;

import { SomniaEventHandler } from "@somnia-chain/reactivity-contracts/contracts/SomniaEventHandler.sol";

contract ExampleEventHandler is SomniaEventHandler {

    function _onEvent(
        address emitter,
        bytes32[] calldata eventTopics,
        bytes calldata data
    ) internal override {
        // Execute your logic here
        // Be careful about emitting events to avoid infinite loops
    }

}
```

Once the handler is complete, deploy it using Foundry or Hardhat, and note the address — this will be required for creating a subscription.

#### Setting Up an On-Chain Subscription (Using the SDK)

The following uses the TypeScript SDK to create and pay for a subscription that will invoke a handler contract for events emitted by other smart contracts. Another approach would be for the subscribing smart contract to directly hold the required SOMI balance and have the logic for creating the subscription baked into one place, but that may not always be optimal.

```typescript
import { SDK } from '@somnia-chain/reactivity';
import { parseGwei } from 'viem';

// Initialize the SDK
const sdk = new SDK({
  public: publicClient,
  wallet: walletClient,
})

// Create a Solidity subscription
// This is an example of a wildcard subscription to all events
// We do not need to supply SOMI—the chain ensures min balance
await sdk.createSoliditySubscription({
  handlerContractAddress: '0x123...',
  priorityFeePerGas: parseGwei('2'),   // 2 gwei — minimum recommended for validators to process
  maxFeePerGas: parseGwei('10'),       // 10 gwei — max you're willing to pay (base + priority)
  gasLimit: 2_000_000n,                // Minimum recommended for state changes, increase for complex logic
  isGuaranteed: true,
  isCoalesced: false,
});
```
