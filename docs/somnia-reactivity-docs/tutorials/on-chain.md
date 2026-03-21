# Solidity on-chain Reactivity Tutorial

This tutorial guides you through building on-chain reactivity on Somnia. You'll create a smart contract that reacts to events from other contracts automatically—invoked by chain validators. Subscriptions trigger handler logic directly in the EVM.

### Overview

On-chain reactivity lets Solidity contracts "subscribe" to events emitted by other contracts. When an event fires, your handler contract gets called with the event data, enabling automated business logic like auto-swaps or updates. This is powered by Somnia's native push mechanism, funded by a minimum SOMI balance (currently 32 SOMI) held by the subscription owner.

Key benefits:

* Atomic: Event + state from the same block (state reads have to be handled by your own contract unlike off-chain subscriptions).
* Decentralized: Runs on-chain without off-chain servers removing liveness assumptions.
* Efficient: Pay only for invocations via gas params.

Prerequisites:

* Solidity basics (e.g., Remix, Hardhat, or Foundry).
* Somnia testnet wallet with 32+ SOMI (faucet: <https://docs.somnia.network/developer/network-info>).
* TypeScript SDK for subscription management (install: `npm i @somnia-chain/reactivity`) or manage the subscription directly with the precompile contract on-chain

#### Key Objectives

1. **Create a SomniaEventHandler Contract**: Inherit from the abstract contract and override `_onEvent` virtual function with your logic.
2. **Deploy the Handler**: Use your tool of choice (e.g., Remix or Hardhat).
3. **Create a Subscription**: Use the SDK to set up and fund the sub (owner must hold min SOMI) or setup the subscription in Solidity.
4. **Handle Callbacks**: The chain invokes your handler on matching filters based on subscription configuration.

#### Step 1: Install Dependencies

Install the reactivity contracts package for the `SomniaEventHandler` abstract contract:

```bash
npm i @somnia-chain/reactivity-contracts
```

This provides the interface to import. (Public Foundry repo coming soon for easier Forge integration.)

#### Step 2: Create the Handler Contract

Inherit from `SomniaEventHandler` and implement `_onEvent`. This is where your business logic goes—e.g., update state or call other contracts.

Example: A simple handler that logs or reacts to any event (wildcard).

```solidity
pragma solidity ^0.8.20;

import { SomniaEventHandler } from "@somnia-chain/reactivity-contracts/contracts/SomniaEventHandler.sol";

contract MyEventHandler is SomniaEventHandler {

    event ReactedToEvent(address emitter, bytes32 topic);

    function _onEvent(
        address emitter,
        bytes32[] calldata eventTopics,
        bytes calldata data
    ) internal override {
        // Your business logic here
        // Example: Emit a new event or update storage
        emit ReactedToEvent(emitter, eventTopics[0]);

        // Be cautious: Avoid reentrancy or infinite loops (e.g., don't emit events that trigger this handler)
    }
}
```

* **Customization**: Filter in the subscription (Step 4) or add checks in `_onEvent` (e.g., if `emitter == specificAddress`).
* **Warnings**: Keep gas usage low; handlers run in validator context. Test for reentrancy.

#### Step 3: Deploy the Handler

* **Using Remix**: Paste code, compile, deploy to Somnia testnet RPC (<https://docs.somnia.network/developer/network-info>).
* **Using Hardhat**: Set up a project, add the contract, and deploy script.

Example Hardhat deploy script (`scripts/deploy.ts`):

```typescript
import { ethers } from "hardhat";

async function main() {
  const Handler = await ethers.getContractFactory("MyEventHandler");
  const handler = await Handler.deploy();
  await handler.deployed();
  console.log("Handler deployed to:", handler.address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
```

Run: `npx hardhat run scripts/deploy.ts --network somniaTestnet` (configure networks in `hardhat.config.ts`).

Note the deployed address (e.g., `0x123...`).

#### Step 4: Create and Manage the Subscription

Use the TypeScript SDK to create the subscription. The caller becomes the owner and must hold 32+ SOMI.

```typescript
import { SDK } from '@somnia-chain/reactivity';
import { somniaTestnet } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts'; 
import { createPublicClient, createWalletClient, http } from 'viem';

// Initialize SDK with the required clients
const sdk = new SDK({
  public: createPublicClient({
    chain: somniaTestnet,
    transport: http()
  }),
  wallet: createWalletClient({
      account: privateKeyToAccount(process.env.PRIVATE_KEY),
      chain: somniaTestnet,
      transport: http(),
  })
});

const subData = {
  handlerContractAddress: '0xYourDeployedHandlerAddress',
  priorityFeePerGas: parseGwei('2'),
  maxFeePerGas: parseGwei('10'),
  gasLimit: 2_000_000n, // Minimum recommended for state changes
  isGuaranteed: true, // Retry on failure
  isCoalesced: false, // One call per event
  // Optional filters: eventTopics: ['0x...'], emitter: '0xTargetContract'
};

const txHash = await sdk.createSoliditySubscription(subData);
if (txHash instanceof Error) {
  console.error('Creation failed:', txHash.message);
} else {
  console.log('Subscription created! Tx:', txHash);
}
```

* **Funding**: Chain enforces min SOMI; top up if needed.
* **Filters:** See API reference for more filters that can be passed to createSoliditySubscription

#### Step 5: Test the Callback

1. Deploy an emitter contract that emits events (e.g., simple ERC20 with Transfer).
2. Trigger an event (e.g., transfer tokens).
3. Check your handler: Use explorers or logs to see `_onEvent` executed (e.g., your `ReactedToEvent` emitted).

#### Troubleshooting

* **No Invocation?** Verify sub ID (via `sdk.getSubscriptionInfo`), filters match, and balance funded.
* **Gas Errors?** Increase `gasLimit` or optimize handler.
* **Cancel**: `await sdk.cancelSoliditySubscription(subId);` (get ID from listing).

#### Next Steps

* Add filters for targeted reactivity.
* Integrate with DeFi/NFT logic.
* Explore hybrid: Off-chain monitoring + on-chain actions.
