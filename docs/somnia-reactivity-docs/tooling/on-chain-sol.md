# On-chain (Solidity)

### Somnia Reactivity Precompile

The Somnia Reactivity Precompile is located at address `0x0100`. It provides an interface for managing event subscriptions.

#### Interface

The interface for the precompile is defined in `ISomniaReactivityPrecompile.sol`:

```solidity
interface ISomniaReactivityPrecompile {
    struct SubscriptionData {
        bytes32[4] eventTopics;      // Topic filter (0x0 for wildcard)
        address origin;              // Origin (tx.origin) filter (address(0) for wildcard)
        address caller;              // Reserved for future use (address(0) for wildcard)
        address emitter;             // Contract emitting the event (address(0) for wildcard)
        address handlerContractAddress; // Address of the contract to handle the event
        bytes4 handlerFunctionSelector; // Function selector in the handler contract
        uint64 priorityFeePerGas;    // Extra fee to prioritize handling, in nanoSOMI
        uint64 maxFeePerGas;         // Max fee willing to pay, in nanoSOMI
        uint64 gasLimit;             // Maximum gas that will be provisioned per subscription callback
        bool isGuaranteed;           // If true, moves to next block if current is full
        bool isCoalesced;            // If true, multiple events can be coalesced
    }

    // System events
    event BlockTick(uint64 indexed blockNumber);
    event EpochTick(uint64 indexed epochNumber, uint64 indexed blockNumber);
    event Schedule(uint256 indexed timestampMillis);

    event SubscriptionCreated(uint64 indexed subscriptionId, address indexed owner);
    event SubscriptionRemoved(uint64 indexed subscriptionId, address indexed owner);

    function subscribe(SubscriptionData calldata subscriptionData) external returns (uint256 subscriptionId);
    function unsubscribe(uint256 subscriptionId) external;
    function getSubscriptionInfo(uint256 subscriptionId) external view returns (SubscriptionData memory subscriptionData, address owner);
}
```

{% hint style="info" %}
**Validation rules:** At least one filter field must be non-zero — that is, at least one of `eventTopics[0..3]`, `origin`, or `emitter` must be specified. A subscription with all wildcard filters will be rejected. The `handlerContractAddress` must also be non-zero, and `gasLimit` must be greater than zero.
{% endhint %}
