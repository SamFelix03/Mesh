# Off-chain evaluation engine (hybrid workflows)

Implements the PRD slice **subscription `ethCalls` + condition evaluator** using Somnia’s off-chain `sdk.subscribe`: each push includes `simulationResults[]` aligned with the root node’s `ethCalls` array.

## Behaviour

1. **DSL** — On the **root** node only (v1), you may set:
   - `ethCalls[]` — `{ to, data }` static calls executed atomically with the matching log in the push.
   - **`condition`** — optional legacy single clause: `uint256` compare against `simulationResults[simulationResultIndex]` (`op` + `compareDecimal`).
   - **`conditionTree`** — optional AND/OR tree of clauses (same operands as legacy `condition`). If both are present, **both** must pass (tree AND legacy).
   - **`evaluationHooks`** — only valid when the workflow **needs hybrid evaluation** (`ethCalls` / `condition` / `conditionTree`). After a **pass**, the runtime runs `evaluationHooks.onPass[]` in order:
     - **`{ "type": "webhook", "url": "https://..." }`** — `POST` JSON `{ verdict, workflowId, topics }` with a 12s timeout.
     - **`{ "type": "rawTx", "to", "data", "value"?, "chainId"? }`** — optional follow-up tx from the deploy account. **Disabled unless** `MESH_ALLOW_EVAL_RAW_TX=1` in the API environment (throws if unset).

2. **On-chain deploy** — `POST /workflows/from-definition` still deploys `MeshWorkflowExecutor` + root subscription from a **stripped** copy (`ethCalls`, `condition`, `conditionTree`, `evaluationHooks` removed before `validateForCompiler`). The executor runs on every chain callback; it does **not** wait for off-chain evaluation. For true gating, use noop / trace-only executor graphs today, or future on-chain condition support.

3. **Index** — Full definition is stored with **`hybridEvaluation: true`** when the original DSL had any hybrid field above.

4. **Runtime** — With **`EVALUATION_ENGINE=1`** in `.env`, the backend keeps one **`sdk.subscribe`** per active indexed hybrid workflow (same emitter + `topicOverrides` as the root event, plus `ethCalls`). Each notification is evaluated with **`evaluateRootCondition`** and broadcast as JSON to **`/ws/evaluation`** (optional `?workflowId=<bytes32>` filter). On pass, **`runEvaluationOnPassHooks`** runs (failures are logged only).

5. **Hot reload** — On startup, subscriptions are synced from `data/workflows-index.json`. The process also **`fs.watchFile`**s that index: when the file changes, **`syncEvaluationSubscriptions()`** diffs active hybrid rows vs the previous snapshot and starts/stops subs. If you mutate the index out-of-band and want an immediate sync without touching the file, call **`POST /admin/evaluation/sync`** with header **`Authorization: Bearer <MESH_ADMIN_TOKEN>`** (route is registered only when `MESH_ADMIN_TOKEN` is set).

## Configuration

```bash
# backend/.env
EVALUATION_ENGINE=1
# Optional: force re-sync without relying on file watcher
MESH_ADMIN_TOKEN=your-secret
# Optional: allow rawTx onPass hooks (dangerous — only in trusted envs)
MESH_ALLOW_EVAL_RAW_TX=1
```

Requires a working **WebSocket RPC** (`SOMNIA_WS_URL` / chain defaults).

## API / validation

- `POST /workflows/validate` with `{ "definition", "forHybrid": true }` — hybrid rules (tree depth/clause limits, hooks require hybrid, etc.); add `"forCompiler": true` for on-chain compile checks on the stripped graph.
- `POST /workflows/compile` / `from-definition` — hybrid path when `ethCalls`, `condition`, or `conditionTree` appear.
- `GET /workflows/:id` → `indexMeta.hybridEvaluation`, `deployMode`, etc.

## WebSocket

`ws://<api>/ws/evaluation?workflowId=0x…` — same bytes32 as `workflowIdFromString(dsl.id)`.

## CLI

```bash
npm run mesh -- validate --file workflows/example.workflow.hybrid.json --hybrid --compiler
```

## References

- [`hybridWorkflow.ts`](../backend/src/hybridWorkflow.ts) — validation + strip for compile.
- [`evaluateCondition.ts`](../backend/src/evaluateCondition.ts) — tree + legacy compare.
- [`evaluationHooks.ts`](../backend/src/evaluationHooks.ts) — webhook + gated raw tx.
- [`evaluationRuntime.ts`](../backend/src/evaluationRuntime.ts) — subscribe map, watcher, sync.
- [`evaluationEngine.ts`](../backend/src/evaluationEngine.ts) — `startEvaluationEngine()`.
