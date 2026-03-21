# State Consistency Guarantees

Somnia ensures notifications deliver events and state that are consistent—sourced from the exact same block. This eliminates race conditions common in pull models.

#### How It Works

* **Atomic Delivery**: Event + state (via ETH calls) processed in one validator-executed bundle.
* **Guarantees**:
  * Non-coalesced: One notification per event.
  * Coalesced: Batched, but state reflects the latest in the batch.

#### Example Impact

In a DeFi app, a "Transfer" event pushes the new balance immediately—no extra balanceOf call needed.

This makes dApps more reliable and easier to reason about.
