# Cron subscriptions via SDK

Starting from `@somnia-chain/reactivity@0.1.9`, the typescript SDK introduces two new convenience functions to streamline creating subscriptions for [system-generated events](https://docs.somnia.network/developer/reactivity/system-events): `BlockTick` and `Schedule`. These functions reduce boilerplate by handling the underlying `SubscriptionData` structure and precompile interactions for you, while still allowing customization of gas fees, guarantees, and other parameters.

For a deeper understanding of how these system events work under the hood (including event signatures and behaviors), refer to the [System Events documentation](https://docs.somnia.network/developer/reactivity/system-events).

### Block Tick Subscription

The `BlockTick` event triggers at the end of every block if no specific block number is provided, or at a targeted block if specified.

#### Using the SDK

Use `createOnchainBlockTickSubscription` to set up the subscription with minimal code:

```typescript
import { SDK } from '@somnia-chain/reactivity';

// Assuming you have an instance of SomniaReactivity SDK
const reactivity = new SDK(/* your config */);

async function setupBlockTick() {
  try {
    const txHash = await reactivity.createOnchainBlockTickSubscription({
      // Optional: Specify a future block number; omit for every block
      // blockNumber: BigInt(123456789),
      handlerContractAddress: '0xYourHandlerContractAddress',
      // Optional: Override default handler selector (defaults to onEvent)
      // handlerFunctionSelector: '0xYourSelector',
      priorityFeePerGas: BigInt(1000000000), // 1 nanoSOMI
      maxFeePerGas: BigInt(20000000000), // 20 nanoSOMI
      gasLimit: BigInt(2000000),
      isGuaranteed: true, // Ensure delivery even if delayed
      isCoalesced: false // Handle each event separately
    });
    console.log('Subscription created with tx hash:', txHash);
  } catch (error) {
    console.error('Error creating subscription:', error);
  }
}

setupBlockTick();
```

This returns the transaction hash on success or an error if the subscription fails.

#### Equivalent in Solidity

For comparison, here's the lower-level Solidity equivalent (as in the core docs):

```solidity
ISomniaReactivityPrecompile.SubscriptionData
    memory subscriptionData = ISomniaReactivityPrecompile
        .SubscriptionData({
            eventTopics: [BlockTick.selector, bytes32(0), bytes32(0), bytes32(0)], // Or specify blockNumber in topics[1]
            emitter: SomniaExtensions.SOMNIA_REACTIVITY_PRECOMPILE_ADDRESS,
            handlerContractAddress: address(this),
            handlerFunctionSelector: ISomniaEventHandler.onEvent.selector,
            /* Add gas params, isGuaranteed, isCoalesced here */
    });
// Then call subscribe(subscriptionData) on the precompile
```

### Schedule Event (One-Off Cron Job)

The `Schedule` event is ideal for one-time future actions. Key notes:

* Timestamp must be in the future (at least 12 seconds from n ow).
* It's a one-off subscription—automatically deleted after triggering.
* Use milliseconds (e.g., via [currentmillis.com](https://currentmillis.com/)).

#### Using the SDK

Use `scheduleOnchainCronJob` for a simple setup:

```typescript
import { SDK } from '@somnia-chain/reactivity';

// Assuming you have an instance of SomniaReactivity
const reactivity = new SDK(/* your config */);

async function setupSchedule() {
  try {
    const txHash = await reactivity.scheduleOnchainCronJob({
      timestampMs: 1794395471011, // e.g., Nov 11, 2026, 11:11:11.011
      handlerContractAddress: '0xYourHandlerContractAddress',
      // Optional: Override default handler selector (defaults to onEvent)
      // handlerFunctionSelector: '0xYourSelector',
      priorityFeePerGas: BigInt(1000000000), // 1 nanoSOMI
      maxFeePerGas: BigInt(20000000000), // 20 nanoSOMI
      gasLimit: BigInt(2000000),
      isGuaranteed: true, // Ensure delivery even if delayed
      isCoalesced: false // N/A for one-off, but included for consistency
    });
    console.log('Cron job scheduled with tx hash:', txHash);
  } catch (error) {
    console.error('Error scheduling cron job:', error);
  }
}

setupSchedule();
```

This returns the transaction hash on success or an error if the subscription fails.

#### Equivalent in Solidity

For comparison, here's the lower-level Solidity equivalent (as in the core docs):

```solidity
ISomniaReactivityPrecompile.SubscriptionData
    memory subscriptionData = ISomniaReactivityPrecompile
        .SubscriptionData({
            eventTopics: [Schedule.selector, bytes32(uint256(1794395471011)), bytes32(0), bytes32(0)],
            emitter: SomniaExtensions.SOMNIA_REACTIVITY_PRECOMPILE_ADDRESS,
            handlerContractAddress: address(this),
            handlerFunctionSelector: ISomniaEventHandler.onEvent.selector,
            /* Add gas params, isGuaranteed, isCoalesced here */
    });
// Then call subscribe(subscriptionData) on the precompile
```

{% hint style="info" %}
These SDK functions default the `emitter` to `SOMNIA_REACTIVITY_PRECOMPILE_ADDRESS` and handle event topics automatically, ensuring your handler only responds to genuine system events.
{% endhint %}

To get started, update your typescript SDK package to `@somnia-chain/reactivity@0.1.9` or later and integrate these functions into your dApp.\
\
If you need more advanced customizations (e.g., additional filters like origin or caller), you can still use the full `SoliditySubscriptionData` type directly with the `createSoliditySubscription` SDK function (scheduleOnchainCronJob is calling that internally).

See [solidity-on-chain-reactivity-tutorial](https://docs.somnia.network/developer/reactivity/tutorials/solidity-on-chain-reactivity-tutorial "mention") for a tutorial on how to create a regular subscription to any event emitted by any smart contract.
