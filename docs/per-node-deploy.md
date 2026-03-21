# Per-node deploy (PRD-aligned fan-out)

Besides the default **single `MeshWorkflowExecutor` + one root subscription**, Mesh can deploy **one lightweight handler contract per compiler step** and **one `createSoliditySubscription` per step**, all sharing the **same root event** as the DAG entry. The registry is updated once with parallel **`nodeAddresses[]`** and **`subscriptionIds[]`**.

## When to use it

- You want **PRD-style** “one subscription per step” without encoding the whole graph into one executor.
- Your workflow is a **linear or DAG** that passes **`validateWorkflowForCompiler`** after stripping hybrid fields, with **no** root `ethCalls` / `condition` / `conditionTree` / `evaluationHooks` (per-node mode **rejects** hybrid).

## Contract

- **`MeshSimpleStepNode`** ([`contracts/src/compiler/MeshSimpleStepNode.sol`](../contracts/src/compiler/MeshSimpleStepNode.sol)) — implements one step: optional external `call`, optional `LOG1` emit, then `WorkflowStepExecuted`. Constructor takes target, calldata, log topic, and next-step routing metadata the deployer wires consistently with the compiled plan.

## Backend

- **Validation:** [`perNodeFanoutValidate.ts`](../backend/src/services/perNodeFanoutValidate.ts) — same event trigger on every node (as root), caps (e.g. 16 nodes), compiler-clean definition.
- **Deploy:** [`deployPerNodeFanout.ts`](../backend/src/services/deployPerNodeFanout.ts) — deploys N nodes, N subscriptions, one `registerWorkflow`.
- **Index:** rows store **`deployMode: "perNodeFanout"`**, **`nodeAddresses`**, **`subscriptionIds`** (and keep **`subscriptionId`** as the first id for list UIs).

## API / CLI

- `POST /workflows/compile` — body `{ "definition", "deployMode": "perNodeFanout" }` for a dry-run summary (`nodeCount`, `rootTrigger`, etc.).
- `POST /workflows/from-definition` — same `deployMode` to deploy.
- CLI: **`npm run mesh -- deploy-dsl --file workflows/example.workflow.json --fanout`**

## Default mode

**`deployMode: "executor"`** (omitted) — unchanged single `MeshWorkflowExecutor` path. See [`current-state-and-next.md`](current-state-and-next.md) for the feature matrix.
