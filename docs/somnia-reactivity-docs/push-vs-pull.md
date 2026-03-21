# Push vs Pull: An Architectural Shift

Traditional EVM dApps "pull" data via polling (e.g., repeated getLogs or state rpc queries), leading to inefficiency and high rpc costs. Somnia Reactivity's "push" model notifies you proactively, transforming app architecture.

#### Highlights

| Aspect     | Pull (Traditional)                 | Push (Somnia Reactivity)          |
| ---------- | ---------------------------------- | --------------------------------- |
| Data Fetch | Poll RPCs periodically             | Passive notifications             |
| Latency    | Seconds to minutes (poll interval) | Near-instant (block time)         |
| RPC Calls  | High (loops, retries)              | Minimal (one sub setup)           |
| Complexity | Manage loops, error handling       | Simple callback/handler           |
| Use Cases  | Basic event listening              | Real-time reactions, auto-updates |

#### Why It Matters

* **Simplified Front-Ends**: No more `setInterval` for balances—push updates UIs directly.
* **Efficient Indexers**: Push to DBs instead of scanning blocks.
* **Cost Savings**: Avoid redundant queries.

Let the chain push changes to you and build realtime blockchain applications
