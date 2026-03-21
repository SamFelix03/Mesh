# Mesh × Somnia Reactivity — feasibility (v1)

## Verdict

**Feasible on Somnia testnet**, with scope staged: core primitives in your docs align with the PRD; the largest build risk is the **workflow compiler** (DAG validation, Solidity codegen, subscription orchestration), not Somnia itself.

## What lines up

- **On-chain handlers**: `SomniaEventHandler` + `_onEvent` match the PRD’s `WorkflowNode` pattern; `@somnia-chain/reactivity-contracts` is published and pins Solidity **0.8.30**.
- **Subscriptions**: `createSoliditySubscription`, `createOnchainBlockTickSubscription`, `scheduleOnchainCronJob`, `cancelSoliditySubscription`, `getSubscriptionInfo` are documented and available in `@somnia-chain/reactivity` (≥ 0.1.9 for cron helpers).
- **Off-chain trace / conditions**: `sdk.subscribe` with `ethCalls` and `simulationResults[]` matches the PRD’s trace engine and condition evaluator.
- **System events**: `BlockTick`, `Schedule`, precompile `0x0100`, and `emitter = SOMNIA_REACTIVITY_PRECOMPILE_ADDRESS` are documented — cron triggers are implementable.
- **Operational constraints** (32 SOMI minimum balance, gas in gwei via `parseGwei`, testnet-only) are explicit in the docs and PRD.

## Gaps and decisions

1. **Registry vs subscription owner**  
   On-chain subscriptions created via the SDK are owned by the **EOA** that sent the tx. `WorkflowRegistry.pauseWorkflow` in this repo only updates **status**; **`cancelSoliditySubscription` must run from the backend/CLI with the same wallet** (as the PRD’s manager API describes). On-chain `unsubscribe` from a contract would require the **registry (or manager contract)** to be the subscription owner — a possible v2 design.

2. **`WorkflowRegistry.registerWorkflow` length constraint**  
   Nodes and `subscriptionIds` arrays are required to have equal length so each node row has a subscription id slot (use `0` for nodes invoked only via upstream calls, if you standardise that convention).

3. **Compiler complexity**  
   Cycle detection, gas estimation for fan-out, ABI/topic encoding, and template-generated `_onEvent` bodies are non-trivial but ordinary engineering — not blocked by Somnia.

4. **Wildcard trace filtering**  
   Production trace routing will filter decoded logs for `WorkflowStepExecuted` / `WorkflowNoOp` topic0 values once ABIs are stable.

## Suggested extra references

- Official **Somnia network info** (RPC/WebSocket URLs, chain id if it diverges from docs in-repo).
- **Forge + npm** workflow for `@somnia-chain/reactivity-contracts` (or a released Foundry dep) if you move off local `node_modules` remappings.
- Any **internal** Reactivity changelog if topic layouts or SDK types change between versions.
