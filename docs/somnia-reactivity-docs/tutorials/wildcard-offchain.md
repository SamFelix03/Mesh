# Wildcard Off-Chain Reactivity Tutorial

This tutorial shows how to set up an off-chain subscription in TypeScript to listen for *all* events emitted on the Somnia blockchain (wildcard mode). Notifications will push event data plus results from Solidity view calls (e.g., querying contract state like balances) in a single atomic payload. This reduces RPC roundtrips compared to traditional event listening + separate state fetches.

We'll use the Reactivity SDK for WebSocket subscriptions and viem for chain setup, ABI handling, and decoding. For familiarity, we'll subscribe to all events but decode a common one (ERC20 Transfer) in the callback.

Whilst most developers are unlikely to use reactivity in this way in production, there are scenarios where this will be useful:

* Testing reactivity before applying more filters (see our other tutorials)
* Building an indexer which scrapes required information from the chain into a secondary database that would serve other applications that want large volumes of historical chain data

#### Overview

Off-chain reactivity uses WebSockets to push notifications to your TypeScript app. Key features:

* **Wildcard Listening**: Catch every event without filters.
* **Bundled State**: Include ETH view calls executed at the event's block height.
* **Real-Time**: Low-latency updates for UIs, backends, or scripts.
* **No Gas Costs**: Off-chain, so free per notification (after setup).

This enables reactive apps like live dashboards or automated alerts.

Prerequisites:

* Node.js 20+
* Somnia testnet access (RPC: <https://dream-rpc.somnia.network>)
* Install dependencies: `npm i @somnia-chain/reactivity viem`

#### Key Objectives

1. **Set Up the Chain and SDK**: Configure viem for Somnia Testnet and initialize the SDK.
2. **Define ETH Calls**: Specify view functions to run on events (e.g., balanceOf).
3. **Create the Subscription**: Start a wildcard WebSocket sub with a data callback.
4. **Decode Notifications**: Use viem to parse event logs and function results.
5. **Run and Test**: Handle incoming data in real-time.

#### Step 1: Install Dependencies

```bash
npm i @somnia-chain/reactivity viem
```

#### Step 2: Define the Somnia Chain

Use viem's `defineChain` to configure the testnet.

```typescript
import { defineChain } from 'viem';

const somniaTestnet = defineChain({
  id: 50312,
  name: 'Somnia Testnet',
  network: 'testnet',
  nativeCurrency: {
    decimals: 18,
    name: 'STT',
    symbol: 'STT',
  },
  rpcUrls: {
    default: {
      http: ['https://dream-rpc.somnia.network'],
      webSocket: ['ws://api.infra.testnet.somnia.network/ws'],
    },
    public: {
      http: ['https://dream-rpc.somnia.network'],
      webSocket: ['ws://api.infra.testnet.somnia.network/ws'],
    },
  },
});
```

#### Step 3: Initialize the SDK

Create a public client with WebSocket transport and pass it to the SDK.

```typescript
import { SDK } from '@somnia-chain/reactivity';
import { createPublicClient, webSocket } from 'viem';

const publicClient = createPublicClient({
  chain: somniaTestnet,
  transport: webSocket(),
});

const sdk = new SDK({ public: publicClient });
```

#### Step 4: Define ETH Calls

Specify view calls to execute when events emit. Here, we query an ERC721 balanceOf (adjust addresses as needed).

```typescript
import { encodeFunctionData, erc721Abi } from 'viem';

const ethCall = {
  to: '0x23B66B772AE29708a884cca2f9dec0e0c278bA2c', // Example Somnia ERC721 contract
  data: encodeFunctionData({
    abi: erc721Abi,
    functionName: 'balanceOf',
    args: ['0x3dC360e0389683cA0341a11Fc3bC26252b5AF9bA'], // Example owner address
  }),
};
```

#### Step 5: Create the Wildcard Subscription

Subscribe with `ethCalls` and an `onData` callback. Omit filters for wildcard (all events).

```typescript
const subscription = await sdk.subscribe({
  ethCalls: [ethCall], // Array of calls; add more if needed
  onData: (data) => {
    console.log('Raw Notification:', data);
    // Decoding happens here (Step 6)
  },
});
```

* **Unsubscribe Later**: `subscription.unsubscribe();`

#### Step 6: Decode Data in the Callback

Use viem to decode the event log and function results. For example, assuming an ERC20 Transfer event (use `erc20Abi` from viem).

```typescript
import { decodeEventLog, decodeFunctionResult, erc20Abi } from 'viem';

// Inside onData:
const decodedLog = decodeEventLog({
  abi: erc20Abi, // Or your custom ABI
  topics: data.result.topics,
  data: data.result.data,
});

const decodedFunctionResult = decodeFunctionResult({
  abi: erc721Abi, // Match the call's ABI
  functionName: 'balanceOf',
  data: data.result.simulationResults[0], // First call's result
});

console.log('Decoded Event:', decodedLog); // e.g., { eventName: 'Transfer', args: { from, to, value } }
console.log('Decoded Balance:', decodedFunctionResult); // e.g., 42n
```

* **Notes**: `data.result` contains `topics`, `data` (event payload), and `simulationResults` (view call outputs). Handle errors if decoding fails (e.g., non-matching ABI).

#### Step 7: Put It All Together and Run

Full script (`main.ts`):

```typescript
// Imports from above...

async function main() {
  // Chain, client, SDK setup from Steps 2-3...

  // EthCall from Step 4...

  const subscription = await sdk.subscribe({
    ethCalls: [ethCall],
    onData: (data) => {
      // Decoding from Step 6...
    },
  });

  // Keep running (e.g., for a server) or unsubscribe after testing
}

main().catch(console.error);
```

Run: `ts-node main.ts` (install ts-node if needed).

#### Testing

1. Run the script.
2. Trigger events on Somnia Testnet (e.g., transfer ERC20 tokens via a wallet).
3. Watch console for decoded notifications.

* If no events: Deploy a test contract and emit manually.

#### Troubleshooting

* **No Data?** Ensure WebSocket RPC is connected; check filters (none for wildcard).
* **Decoding Errors?** Verify ABI matches the event/contract.
* **Connection Issues?** Use HTTP fallback if WS fails, but prefer WS for reactivity.

#### Next Steps

* Add filters (e.g., `eventTopics: ['0xddf...']` for Transfer keccak).
* Integrate with React (future hooks).
* Handle multiple ethCalls/decodes.
* Explore on-chain version: On-Chain Tutorial.
