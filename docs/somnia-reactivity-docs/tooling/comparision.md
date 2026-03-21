# No, this is not like regular EVM event subscriptions

Think event subscriptions are old news? On Ethereum or other EVM chains, they're just events, no state, and no on-chain reactions. Somnia's push subscriptions deliver state along side event data, something other EVMs cannot offer.

#### Chain Comparison

* **Other Chains**: `eth_subscribe` gives events only—you still pull state separately, risking inconsistency.
* **Somnia**: Pushes event + state atomically; invokes Solidity handlers directly.

#### Code Comparison

**Ethereum (Pull)**:

```javascript
web3.eth.subscribe('logs', { address: '0x...' }, (err, log) => {
  // Now pull state manually
  contract.methods.balanceOf(...).call();
});
```

**Somnia (Push)**:

```typescript
sdk.subscribe({
  ethCalls: [{
    to: contractAddress,
    data: encodeFunctionData({ abi, functionName: 'balanceOf', args: [userAddress] })
  }],
  onData: (data) => {
    // Event + state (including balanceOf result) delivered atomically with `data`
  }
});
```
