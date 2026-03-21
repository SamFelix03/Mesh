# FAQs & Troubleshooting

### FAQs

{% hint style="warning" %}
**Somnia Reactivity is currently only available on TESTNET**
{% endhint %}

#### How Do I Fetch Historical Data?

To get event and state data from before an application subscription was created there are a few approaches:

* Use a traditional indexer or tooling such as a subgraph
* Build a custom indexer which starts at an earlier block and persists data received from Somnia reactivity into a DB that can be queried from the chain
* Directly query historical data from the chain from within your application (generally inefficient)

### Troubleshooting

#### Issues starting websocket subscriptions

Two core reasons for this:

1. The chain definition for the Somnia testnet or mainnet does not contain a wss url
2. The wss url does not support the reactivity feature set or the rpc provider is having issues

#### Too many active websocket subscriptions

Often seen in React applications where `useEffect` is not being used correctly or not used at all to start an event subscription leading to attempts to create a subscription every time the page renders

#### Solidity handler not being invoked

Four core reasons for this:

1. **Incorrect gas configuration** — this is the most common cause. Using raw values like `10n` instead of `parseGwei('10')` results in fees that are too low for validators to process. See [gas-configuration](https://docs.somnia.network/developer/reactivity/gas-configuration "mention") for recommended values.
2. Invalid implementation of `SomniaEventHandler` interface
3. No active subscription
4. Insufficient subscription balance
