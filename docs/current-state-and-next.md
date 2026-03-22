# Mesh — current implementation and what comes next

Engineering inventory: what exists, how it maps to the PRD ([`mesh_prd.md`](mesh_prd.md)), and **prioritized** next work. Update when a milestone lands.

**Scope:** **MVP + hybrid evaluator + optional per-node fan-out** — default **`MeshWorkflowExecutor`** + compiler with **`emit`**, root **`ethCalls`** + **`condition` / `conditionTree`** + optional **`evaluationHooks.onPass`** for Somnia off-chain subscribe + `/ws/evaluation`, index hot-reload for eval subs, dashboard (trace + eval). **Per-node** path: **`MeshSimpleStepNode`** × N + N subs ([`per-node-deploy.md`](per-node-deploy.md)). **Not done:** arbitrary Solidity codegen for custom per-node handlers; on-chain gating of executor by off-chain verdict ([`evaluation-engine.md`](evaluation-engine.md)).

---

## 1. What is implemented today

### 1.1 Smart contracts (`contracts/`)

| Piece | Role |
| ----- | ---- |
| `WorkflowNode` | Abstract `SomniaEventHandler`; `WorkflowStepExecuted` / `WorkflowNoOp` for trace. |
| `WorkflowRegistry` | `registerWorkflow`, pause/delete, subscription id bookkeeping, owner checks. |
| `AuditLog` | Append-only governance log. |
| Demo stack | `TriggerEmitter`, `ReactionSink`, `MeshEventWorkflowNode` for Shannon E2E demos. |
| **`MeshWorkflowExecutor`** | **Default compiler output:** one handler per workflow; step `0` = subscription entry; per step: `call`, **`emit` (`LOG1`)**, or `noop`; `uint8` child indices; DFS; `WorkflowStepExecuted` per step. See [`compiler-emit.md`](compiler-emit.md). |
| **`MeshSimpleStepNode`** | **Per-node fan-out:** one step per contract; optional call + optional `LOG1`; same trace event pattern. |

**PRD note:** Default shipping model remains **one executor + one root subscription**; **optional** `deployMode: "perNodeFanout"` matches PRD N-contract + N-sub shape for compiler-simple graphs.

### 1.2 Backend (`backend/`)

| Area | Details |
| ---- | ------- |
| **API** | Fastify: health, chain info, workflow lifecycle, validation, compile (`deployMode`), deploy demo, deploy from DSL, subscription info, WebSocket trace + evaluation. |
| **DSL** | [`types.ts`](../backend/src/dsl/types.ts): triggers, actions, **`condition`**, **`conditionTree`**, **`ethCalls`** on root, **`evaluationHooks`**. |
| **Validation** | DAG + [`validateForCompiler.ts`](../backend/src/compiler/validateForCompiler.ts) on stripped defs. [`hybridWorkflow.ts`](../backend/src/hybridWorkflow.ts): hybrid caps, hooks require hybrid, strip for compile. [`perNodeFanoutValidate.ts`](../backend/src/services/perNodeFanoutValidate.ts): fan-out rules. |
| **Compiler** | [`compileWorkflow.ts`](../backend/src/compiler/compileWorkflow.ts) on **`definitionForOnChainCompile`**. [`subscriptionFromTrigger.ts`](../backend/src/compiler/subscriptionFromTrigger.ts): root subscription. |
| **Deploy** | [`deployCompiledWorkflow.ts`](../backend/src/services/deployCompiledWorkflow.ts): executor path. [`deployPerNodeFanout.ts`](../backend/src/services/deployPerNodeFanout.ts): N `MeshSimpleStepNode` + N subs. Demo path unchanged. |
| **Index** | [`workflowIndex.ts`](../backend/src/services/workflowIndex.ts): `definition`, **`hybridEvaluation`**, **`deployMode`**, **`nodeAddresses`**, **`subscriptionIds`**, etc. |
| **Lifecycle** | [`workflowLifecycle.ts`](../backend/src/services/workflowLifecycle.ts): cancel all subscription ids from registry. |
| **Trace** | [`traceEngine.ts`](../backend/src/traceEngine.ts) + broadcaster: `/ws/trace`. |
| **Evaluation** | [`evaluationRuntime.ts`](../backend/src/evaluationRuntime.ts): per-hybrid subscribe, **index file watcher** + **`syncEvaluationSubscriptions`**, on-pass hooks. **`POST /admin/evaluation/sync`** when `MESH_ADMIN_TOKEN` set. |
| **CLI** | [`mesh-cli.ts`](../backend/scripts/mesh-cli.ts): `deploy-dsl [--fanout]`, validate, compile, etc. |

### 1.3 Frontend (`frontend/`)

| Piece | Details |
| ----- | ------- |
| Landing + `/workflows` | Lists indexed workflows; shows kind, status, subscription id (+ fan-out hint when indexed). |
| `/workflows/build` | React Flow DAG builder → `WorkflowDefinition` JSON; **Validate / Compile / Deploy** to API ([`workflow-builder.md`](workflow-builder.md)). |
| `/workflows/[id]` | Detail + `EvalFeed` (hybrid) + `TraceFeed`; nodes ↔ subs from registry; index meta includes deploy mode when present. |

### 1.4 Templates & docs

- [`templates/demo-01-hybrid-executor.workflow.json`](../templates/demo-01-hybrid-executor.workflow.json) — hybrid + **`emit`** (`mesh-showcase-shannon`).  
- [`templates/demo-02-fanout-pipeline.workflow.json`](../templates/demo-02-fanout-pipeline.workflow.json) — per-node fan-out pipeline.  
- [`docs/compiler-emit.md`](compiler-emit.md) — **`emit`** reference.
- Root [`README.md`](../README.md) — product + quick start.
- [`contracts/README.md`](../contracts/README.md) — contract roles + deploy.

---

## 2. PRD vs repo (honest map)

| PRD theme | Status |
| --------- | ------ |
| DSL DAG | **Yes** — JSON/types + validation. |
| Compile to per-node handlers + **per-node** subscriptions | **Optional** — `deployMode: "perNodeFanout"` + `MeshSimpleStepNode`; default remains single executor. |
| `isGuaranteed` / `isCoalesced` on subscriptions | **Yes** — [`subscriptionGas`](../backend/src/compiler/subscriptionFromTrigger.ts). |
| Block tick / schedule triggers | **Yes** — compiler + SDK wiring. |
| **Wildcard trace** | **Yes** — WebSocket fan-out. |
| **Subscription `ethCalls` + condition evaluator** | **Yes** — root fields + **`conditionTree`** + **`/ws/evaluation`**. |
| **On-pass webhook / gated raw tx** | **Yes** — `evaluationHooks.onPass`; raw tx behind **`MESH_ALLOW_EVAL_RAW_TX=1`**. |
| **Rich trace UI** | **Minimal** — raw feed. |
| Workflow composability | **No.** |

---

## 3. Recommended next steps (ordered)

1. **Richer conditions** — bytes / ABI decode of `simulationResults`, more ops, clearer error surfaces in UI.

2. **On-chain / off-chain coordination** — executor opcode or keeper pattern for gating on verdict (advanced).

3. **Trace / eval UX** — latency, log decode, export.

4. **Hardening** — index deduplication, Shannon integration tests.

---

## 4. API quick reference (implemented)

| Method | Path | Purpose |
| ------ | ---- | ------- |
| GET | `/workflows` | Indexed deployments; `?full=true` includes stored **`definition`** per row. |
| POST | `/workflows/validate` | DAG validate; `forCompiler` / `forHybrid`. |
| POST | `/workflows/compile` | Plan JSON; body **`deployMode`**: `executor` \| `perNodeFanout`. |
| POST | `/workflows/from-definition` | Deploy compiled or per-node fan-out (+ index snapshot). |
| POST | `/workflows` | Demo deploy. |
| GET | `/workflows/:id` | Registry + **`indexMeta`** (`hybridEvaluation`, **`deployMode`**, optional **`subscriptionIds` / `nodeAddresses`**). |
| GET | `/workflows/:id/subscriptions/:subId` | Subscription info. |
| POST | `/workflows/:id/pause`, DELETE | Lifecycle. |
| POST | `/admin/evaluation/sync` | Bearer **`MESH_ADMIN_TOKEN`** — refresh eval subs vs index (when token set). |
| WS | `/ws/trace` | Wildcard trace; **`?workflowId=<bytes32>`**. |
| WS | `/ws/evaluation` | Hybrid verdict stream (`EVALUATION_ENGINE=1`); **`?workflowId=<bytes32>`**. |

---

*Last aligned with repo: executor + hybrid eval + per-node fan-out deploy mode, Shannon-focused backend, Next.js dashboard.*
