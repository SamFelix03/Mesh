# Mesh contracts (Somnia **Shannon** testnet)

Solidity 0.8.30, aligned with `@somnia-chain/reactivity-contracts` / `SomniaEventHandler`. Shannon = Somnia testnet ([network overview](../../docs/somnia-reactivity-docs/network-info/network-config.md)).

## Setup

```bash
npm install
forge build
forge test
```

## Deploy (Shannon)

Set `PRIVATE_KEY` in the environment, then use the fixed–gas-limit helper (recommended on Shannon — `forge script` can OOG when RPC underestimates CREATE gas):

```bash
export PRIVATE_KEY=0x...
export SOMNIA_RPC_URL=https://dream-rpc.somnia.network   # optional
# optional: export MESH_DEPLOY_GAS_LIMIT=50000000
./script/deploy-mesh-shannon.sh
```

Alternatively, `forge script script/DeployMesh.s.sol:DeployMeshScript --rpc-url … --broadcast --private-key …` — if txs revert with full gas used, switch to the script above.

Record `WorkflowRegistry` and `AuditLog` addresses; set `WORKFLOW_REGISTRY_ADDRESS` in the backend.

## Contracts

| Contract               | Role |
| ---------------------- | ---- |
| `WorkflowNode`         | Abstract base for per-node handlers; emits trace events. |
| `WorkflowRegistry`     | Owner, node addresses, subscription IDs, pause/delete. |
| `AuditLog`             | Append-only log for governance templates. |
| `TriggerEmitter`       | Emits `Ping(uint256 indexed)`; exposes `pingCount()` for hybrid `ethCall` demos. |
| `ReactionSink`         | Records handler hits (trusted `MeshEventWorkflowNode` only). |
| `MeshEventWorkflowNode`| Production-style node: updates sink + `WorkflowStepExecuted`. |
| `MeshWorkflowExecutor` | **Default compiler output:** single contract per workflow; step 0 = subscription entry; per step: optional `call`, or **`LOG1` emit** (`logTopic0` + payload, see [`docs/compiler-emit.md`](../docs/compiler-emit.md)), or noop; branching via `uint8[]`; emits `WorkflowStepExecuted` each step. |
| `MeshSimpleStepNode` | **Per-node fan-out** (`deployMode: perNodeFanout`): one reactive step per deployed contract; optional call + optional `LOG1`; see [`docs/per-node-deploy.md`](../docs/per-node-deploy.md). |

For custom per-step handlers, contracts should inherit `WorkflowNode` and implement `_onEvent`. The default compiler encodes the whole DAG into one `MeshWorkflowExecutor`; the fan-out path deploys one `MeshSimpleStepNode` per compiled step instead.
