# What is Reactivity?

Reactivity is Somnia's event-driven paradigm for dApps. It pushes notifications—combining emitted events and related blockchain state—to subscribers in real-time, enabling "reactive" logic without polling.

{% hint style="warning" %}
**Reactivity is currently only available on TESTNET**
{% endhint %}

#### Core Concepts

* **Events**: Triggers from smart contracts (e.g., Transfer, Approval).
* **State**: View calls for contract data fetched at the event's block height.
* **Push Delivery**: Chain validators / nodes handle notifications, invoking handlers or WebSocket callbacks directly.
* **Subscribers**: Off-chain apps (TypeScript) or on-chain contracts (Solidity).

This shifts dApps from reactive querying to proactive responses, like a pub/sub system baked into the blockchain.
