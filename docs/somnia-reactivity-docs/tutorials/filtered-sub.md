# Off-Chain Reactivity: Filtered Subscriptions tutorial

This tutorial builds on basic off-chain reactivity by adding filters to your WebSocket subscriptions. While wildcard (all events) is great for quick testing and seeing reactivity in action, it's often too verbose for production—flooding logs with irrelevant data. Instead, use filters to target specific emitters or events, making your app more efficient and focused.

We'll subscribe to Transfer events from a specific ERC20 contract, include a view call (e.g., balanceOf), and enable `onlyPushChanges` to notify only on state changes. This is ideal for real-time UIs or monitoring without noise.

#### Overview

Off-chain subscriptions push filtered events + state via WebSockets to TypeScript apps. Filters reduce volume:

* **eventContractSources**: Limit to specific emitter addresses.
* **topicOverrides**: Filter by event topics (e.g., keccak256 signatures like Transfer's `0xddf...`).
* **onlyPushChanges**: Skip notifications if ethCalls results match the previous one.
* **ethCalls**: Optional view calls for bundled state.
* **onError**: Handle failures gracefully.

No gas costs; runs off-chain.

Prerequisites:

* Same as wildcard tutorial: Node.js, `npm i @somnia-chain/reactivity viem`.
* Know your target contract/event (e.g., ERC20 Transfer).

#### Key Objectives

1. **Set Up Chain and SDK**: Configure viem and initialize SDK.
2. **Define Filters and ETH Calls**: Specify emitters, topics, and views.
3. **Create Filtered Subscription**: Use params for targeted listening.
4. **Decode and Handle Data**: Parse with viem; add error handling.
5. **Run and Optimize**: Test with `onlyPushChanges`.

#### Step 1: Install Dependencies

```bash
npm i @somnia-chain/reactivity viem
```

#### Step 2: Define the Somnia Chain

(Reuse from wildcard tutorial.)

```typescript
import { defineChain } from 'viem';

const somniaTestnet = defineChain({
  id: 50312,
  name: 'Somnia Testnet',
  // ... full config as before
});
```

#### Step 3: Initialize the SDK

```typescript
import { SDK } from '@somnia-chain/reactivity';
import { createPublicClient, webSocket } from 'viem';

const publicClient = createPublicClient({
  chain: somniaTestnet,
  transport: webSocket(),
});

const sdk = new SDK({ public: publicClient });
```

#### Step 4: Define ETH Calls and Filters

* **ethCalls**: Query balanceOf on an ERC20.
* **eventContractSources**: Array of emitter addresses (e.g., one ERC20 contract).
* **topicOverrides**: Hex for event signatures (e.g., Transfer: `0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef`).

```typescript
import { encodeFunctionData, erc20Abi, keccak256, toHex } from 'viem';

// Example: Transfer topic (keccak256('Transfer(address,address,uint256)'))
const transferTopic = keccak256(toHex('Transfer(address,address,uint256)'));

const ethCall = {
  to: '0xExampleERC20Address', // Your target ERC20
  data: encodeFunctionData({
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: ['0xYourWalletAddress'], // Monitor this balance
  }),
};

const filters = {
  eventContractSources: ['0xExampleERC20Address'], // Filter to this emitter
  topicOverrides: [transferTopic], // Only Transfer events
};
```

#### Step 5: Create the Filtered Subscription

Include `onlyPushChanges: true` to notify only on balance changes. Add `onError` for robustness.

```typescript
const subscription = await sdk.subscribe({
  ethCalls: [ethCall], // Bundled state query
  ...filters, // From Step 4
  onlyPushChanges: true, // Efficient: Skip if balance unchanged
  onData: (data) => {
    console.log('Filtered Notification:', data);
    // Decoding here (Step 6)
  },
  onError: (error) => {
    console.error('Subscription Error:', error.message);
    // Retry logic or alert
  },
});

// Unsubscribe: subscription.unsubscribe();
```

#### Step 6: Decode Data in the Callback

Parse the event (Transfer) and view result (balanceOf).

```typescript
import { decodeEventLog, decodeFunctionResult } from 'viem';

// Inside onData:
const decodedLog = decodeEventLog({
  abi: erc20Abi,
  topics: data.result.topics,
  data: data.result.data,
});

const decodedBalance = decodeFunctionResult({
  abi: erc20Abi,
  functionName: 'balanceOf',
  data: data.result.simulationResults[0],
});

console.log('Decoded Transfer:', decodedLog.args); // { from, to, value }
console.log('New Balance:', decodedBalance);
```

#### Step 7: Put It All Together and Run

Full script (`main.ts`):

```typescript
// Imports...

async function main() {
  // Chain, client, SDK from Steps 2-3...

  // ethCall and filters from Step 4...

  const subscription = await sdk.subscribe({
    ethCalls: [ethCall],
    ...filters,
    onlyPushChanges: true,
    onData: (data) => {
      // Decoding from Step 6...
    },
    onError: (error) => console.error(error),
  });

  // Run indefinitely or unsubscribe on signal
}

main().catch(console.error);
```

Run: `ts-node main.ts`.

#### Testing

1. Run the script.
2. Trigger a Transfer on the filtered contract (e.g., send tokens).
3. See notifications only on relevant events/changes.

* If too quiet: Remove `onlyPushChanges` or broaden filters.
* Prod Tip: Start with wildcard for debugging, then add filters.

#### Troubleshooting

* **No Notifications?** Verify topics/address (use explorers for keccak). Check WS connection.
* **Errors?** Handle in onError; common: Invalid filters or RPC issues.
* **Too Many?** Tighten topicOverrides or eventContractSources.

#### Next Steps

* Multi-emitters: Add more to eventContractSources.
* Custom Events: Compute topics for your ABI.
* Advanced: Combine with React for live UIs.
* Compare to On-Chain: On-Chain Tutorial.
