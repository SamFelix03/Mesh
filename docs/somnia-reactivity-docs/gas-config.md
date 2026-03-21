# Gas Configuration

Properly configuring gas parameters is critical for on-chain reactivity subscriptions. If gas values are too low, validators will silently skip your subscription — no error, no warning, just nothing happens.

{% hint style="danger" %}
**This is the #1 cause of "reactivity not working."** Most developers set up their contracts and subscriptions correctly, but use gas values that are too low for validators to process.
{% endhint %}

## Understanding the Parameters

On-chain reactivity subscriptions require three gas parameters:

| Parameter           | Description                                                 | Unit            |
| ------------------- | ----------------------------------------------------------- | --------------- |
| `priorityFeePerGas` | Tip paid to validators to prioritize your handler execution | gwei (nanoSOMI) |
| `maxFeePerGas`      | Maximum total fee per gas (base fee + priority fee)         | gwei (nanoSOMI) |
| `gasLimit`          | Maximum gas provisioned per handler invocation              | gas units       |

### How They Work Together

{% stepper %}
{% step %}

#### priorityFeePerGas

This is essentially the "tip" for validators. The default value is 0 nanoSOMI. Increase it to make sure your handler is executed before others.
{% endstep %}

{% step %}

#### maxFeePerGas

The ceiling on what you'll pay per gas unit. The minimum is `baseFee + priorityFeePerGas` , where the base fee in Somnia is 6 nanoSOMI. Setting this too low will cause your handler invocation to fail in peak times. If set to `0`, the protocol automatically sets it to the maximum allowed value.
{% endstep %}

{% step %}

#### gasLimit

How much gas your `_onEvent` handler is allowed to consume. If your handler runs out of gas, it reverts.
{% endstep %}
{% endstepper %}

## Recommended Values

### Standard Use Cases

```typescript
import { parseGwei } from 'viem';

await sdk.createSoliditySubscription({
  handlerContractAddress: '0x...',
  emitter: '0x...',
  eventTopics: [eventSignature],
  priorityFeePerGas: parseGwei('0'), // 0 gwei — typically, no priority is required 
  maxFeePerGas: parseGwei('10'),     // 10 gwei — comfortable ceiling
  gasLimit: 2_000_000n,              // Sufficient for simple state updates
  isGuaranteed: true,
  isCoalesced: false,
});
```

### By Handler Complexity

<table data-header-hidden><thead><tr><th></th><th align="right"></th><th align="right"></th><th width="133.265625" align="right"></th><th></th></tr></thead><tbody><tr><td>Handler Type</td><td align="right"><code>priorityFeePerGas</code></td><td align="right"><code>maxFeePerGas</code></td><td align="right"><code>gasLimit</code></td><td>Example</td></tr><tr><td><strong>Simple</strong> (state updates, emit event)</td><td align="right"><code>parseGwei('0')</code></td><td align="right"><code>parseGwei('10')</code></td><td align="right"><code>2_000_000n</code></td><td>Counter, token reward</td></tr><tr><td><strong>Medium</strong> (cross-contract calls)</td><td align="right"><code>parseGwei('0')</code></td><td align="right"><code>parseGwei('10')</code></td><td align="right"><code>3_000_000n</code></td><td>Game logic with external calls</td></tr><tr><td><strong>Complex</strong> (multiple external calls, loops)</td><td align="right"><code>parseGwei('10')</code></td><td align="right"><code>parseGwei('20')</code></td><td align="right"><code>10_000_000n</code></td><td>Settlement, multi-step workflows</td></tr></tbody></table>

### Quick Reference Table (Raw BigInt Values)

If you prefer raw values instead of `parseGwei()`:

| Level               | `priorityFeePerGas` |    `maxFeePerGas` |    `gasLimit` |
| ------------------- | ------------------: | ----------------: | ------------: |
| Minimum recommended |                `0n` | `10_000_000_000n` |  2`_000_000n` |
| Comfortable         |                `0n` | `10_000_000_000n` |  3`_000_000n` |
| High priority       |   `10_000_000_000n` | `20_000_000_000n` | `10_000_000n` |

## Common Mistakes

### Using wei instead of gwei

```typescript
// WRONG — these are 10 wei and 20 wei, essentially zero
priorityFeePerGas: 10n,
maxFeePerGas: 20n,

// CORRECT — these are 2 gwei and 10 gwei
priorityFeePerGas: parseGwei('2'),    // = 2_000_000_000n
maxFeePerGas: parseGwei('10'),         // = 10_000_000_000n
```

{% hint style="warning" %}
`10n` is **10 wei** = 0.00000001 gwei. This is 200 million times less than the recommended 2 gwei. Always use `parseGwei()` to avoid unit confusion. See [somi-coin](https://docs.somnia.network/developer/network-info/somi-coin "mention") for details on how this is calculated.
{% endhint %}

### Computing from gasPrice with too-small divisors

```typescript
// RISKY — gas price fluctuates and dividing by 10 may yield too-low values
const gasPrice = await publicClient.getGasPrice();
priorityFeePerGas: gasPrice / 10n,

// SAFER — use fixed proven values
priorityFeePerGas: parseGwei('2'),
```

### Setting gasLimit too low

Somnia operates on a different gas model to Ethereum. One of the key differences is that the 1,000,000 gas reserve is required for any storage operations, see [#storage-evm-operations](https://docs.somnia.network/deployment-and-production/somnia-gas-differences-to-ethereum#storage-evm-operations "mention"). It is safe to up your gas limit to meet the reserve requirements. If your handler reverts due to out-of-gas, the subscription still charges you but the state change doesn't happen.

```typescript
// TOO LOW for any storage operations
gasLimit: 100_000n,

// SAFE for most handlers
gasLimit: 2_000_000n,

// SAFE for complex handlers with external calls
gasLimit: 10_000_000n,
```

### Forgetting to recreate subscription after redeploying

Subscriptions are tied to specific contract addresses. If you redeploy your contract, you get a new address. The old subscription won't trigger for the new contract.

```
Deploy contract → address A
Create subscription → emitter: A, handler: A  ✅

Redeploy contract → address B
Old subscription still points to A → ❌ won't work
Must create NEW subscription → emitter: B, handler: B  ✅
```

## Cost Estimation

The subscription owner pays for each handler invocation. The cost per invocation is:

```
cost = gasUsed × effectiveGasPrice
```

Where `effectiveGasPrice` is at most `maxFeePerGas` and at least `baseFee + priorityFeePerGas`.

### Example

For a simple handler using \~50,000 gas at 10 gwei max fee:

```
cost ≈ 50,000 × 10 gwei = 500,000 gwei = 0.0005 SOMI per invocation
```

The subscription owner must maintain at least **32 SOMI** balance. This is not spent — it's a minimum holding requirement. Actual costs are deducted per invocation.

## Debugging Gas Issues

If your subscription was created successfully but the handler is never invoked:

{% stepper %}
{% step %}

#### Check subscription info

```typescript
const info = await sdk.getSubscriptionInfo(subscriptionId);
console.log(JSON.stringify(info, (_, v) => typeof v === 'bigint' ? v.toString() : v, 2));
```

Verify that the fee fields (e.g., `priorityFeePerGas`, `maxFeePerGas`) are gwei‑denominated — i.e., multiples of 1 gwei = 1\_000\_000\_000 wei (nanoSOMI‑scale). For example, `2000000000` is 2 gwei; a raw value like `2` is effectively zero even though it is still expressed in wei.
{% endstep %}

{% step %}

#### Test with a CLI script first

Before debugging frontend issues, confirm reactivity works via a Hardhat script:

```typescript
// 1. Call your contract function that emits the event
const tx = await contract.myFunction();
await tx.wait();

// 2. Poll for state change
for (let i = 0; i < 15; i++) {
  await new Promise(r => setTimeout(r, 2000));
  const result = await contract.myStateVariable();
  if (result !== previousValue) {
    console.log('Reactivity worked!');
    break;
  }
}
```

{% endstep %}

{% step %}

#### Look for validator transactions

On-chain reactivity is executed by validators from the address `0x0000000000000000000000000000000000000100`. Check the block explorer for transactions from this address to your handler contract after your event was emitted.
{% endstep %}
{% endstepper %}

## Summary

| Do                                                                     | Don't                                                          |
| ---------------------------------------------------------------------- | -------------------------------------------------------------- |
| Use `parseGwei()` for fee fields (`priorityFeePerGas`, `maxFeePerGas`) | Use raw small numbers like `10n` or `100n` for fee values      |
| Start with `parseGwei('10')` for `maxFeePerGas` on testnets            | Compute `maxFeePerGas` from `gasPrice` with arbitrary divisors |
| Set gasLimit based on handler complexity                               | Use a one-size-fits-all low gasLimit                           |
| Recreate subscription after redeploying                                | Assume old subscription works with new contract                |
| Test via CLI before building frontend                                  | Debug reactivity issues through the browser                    |
