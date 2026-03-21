# Dashboard, index, and live trace

## Workflow index

Deployments made through the Workflow Manager are appended to `backend/data/workflows-index.json` (gitignored). Each row includes identifiers, subscription id, optional **`definition`** (full DSL snapshot for workflows deployed with `POST /workflows/from-definition`), and metadata used by the UI.

### Listing workflows

- `GET /workflows` — returns indexed rows **without** `definition` by default (keeps the list payload small).
- `GET /workflows?full=true` — includes `definition` on each row when present.

### Workflow detail

- `GET /workflows/:id` — on-chain registry data plus `indexMeta` when the workflow is in the local index. `indexMeta.definition` is included when it was stored at deploy time.

## Off-chain evaluation WebSocket (`/ws/evaluation`)

When **`EVALUATION_ENGINE=1`** is set on the API, hybrid workflows (root `ethCalls` / `condition` in the stored definition) each get a dedicated **`sdk.subscribe`** with those `ethCalls`. Verdict JSON is fan-out to WebSocket clients.

- **URL:** `ws://<api-host>/ws/evaluation` or `wss://…`
- **Filter:** `?workflowId=0x<64 hex>` (same bytes32 as `keccak256(utf8(dsl.id))`).

See [`evaluation-engine.md`](evaluation-engine.md).

## Live trace WebSocket

- **URL:** `ws://<api-host>/ws/trace` (or `wss://` when the API is HTTPS).
- **Optional filter:** `?workflowId=0x<64 hex>` — only pushes notifications whose log has **`topics[1]`** equal to that bytes32. This matches Mesh **`WorkflowStepExecuted`** and **`WorkflowNoOp`** (indexed `workflowId`).

The backend keeps **one** wildcard `sdk.subscribe` connection and fans out to all WebSocket clients, applying the filter per client.

## Next.js dashboard

- **Workflow list** — `GET /workflows` (no definitions).
- **Workflow detail** — stored definition, **EvalFeed** when `indexMeta.hybridEvaluation`, **TraceFeed** with `workflowId` filter.
- **Trace lines** — decoded Mesh events; **raw JSON** toggle.
- **Visual builder** — [`/workflows/build`](../../frontend/app/workflows/build/page.tsx) drag-and-drop DAG → JSON + `POST /workflows/validate|compile|from-definition`. See [`workflow-builder.md`](workflow-builder.md).
