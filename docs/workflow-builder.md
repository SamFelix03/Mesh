# Visual workflow builder (Next.js)

The dashboard includes a **drag-and-drop DAG editor** at **`/workflows/build`** that mirrors the interaction model of the Mantle “agent builder” reference (node library + React Flow canvas + side config panel + custom edges), but **emits Mesh `WorkflowDefinition` JSON** and calls the **Workflow Manager** HTTP API.

**Reference UI patterns** (external repo, read-only inspiration):

- Canvas layout: `app/agent-builder/page.tsx` → `components/workflow-builder.tsx`
- Palette: `components/node-library.tsx`
- Edges: `components/custom-edge.tsx`
- Node chrome: `components/nodes/*`

Mesh implementation lives under:

| Area | Location |
| ---- | -------- |
| Page route | [`frontend/app/workflows/build/page.tsx`](../frontend/app/workflows/build/page.tsx) |
| Main shell + API wiring | [`frontend/components/workflow-builder/MeshWorkflowBuilder.tsx`](../frontend/components/workflow-builder/MeshWorkflowBuilder.tsx) |
| Start / step nodes | [`MeshStartNode.tsx`](../frontend/components/workflow-builder/MeshStartNode.tsx), [`MeshStepNode.tsx`](../frontend/components/workflow-builder/MeshStepNode.tsx) |
| Palette + help | [`MeshNodeLibrary.tsx`](../frontend/components/workflow-builder/MeshNodeLibrary.tsx), [`WorkflowBuilderHelp.tsx`](../frontend/components/workflow-builder/WorkflowBuilderHelp.tsx) (button → modal) |
| Inspector | [`MeshNodeConfigPanel.tsx`](../frontend/components/workflow-builder/MeshNodeConfigPanel.tsx) |
| Graph ↔ DSL | [`frontend/lib/workflowBuilder/graphToWorkflowDefinition.ts`](../frontend/lib/workflowBuilder/graphToWorkflowDefinition.ts) |
| DSL JSON types (client) | [`frontend/lib/workflowBuilder/dsl.ts`](../frontend/lib/workflowBuilder/dsl.ts) |

## UX rules (what the canvas enforces)

1. **Start node** — Fixed green “Start” node (like the reference’s non-deletable agent hub). It is **not** part of the exported JSON.
2. **Exactly one edge** from Start → the **first** step. That step is the **DAG root** (compiler subscription entry).
3. **Exactly one root** among steps: the step linked from Start must be the only step with **no incoming** step→step edges.
4. **Acyclic graph** — all steps must be reachable from the root following edges **from → to** (export validates reachability).
5. **Drag** “Workflow step” from the library onto the canvas. If there is **no** edge from Start yet, the first dropped step is **auto-wired** from Start.
6. **Connect** steps with handles (top/bottom). **Click an edge** to delete it (wide invisible hit path + `useReactFlow`, same idea as the reference custom edge).
7. **Select** a step to edit trigger (`event` / `cron:block` / `cron:timestamp`), action (`noop` / `call` / `emit`), DSL `id`, and optional **hybrid** fields on the **root** only (`ethCalls`, condition or small condition tree, optional on-pass webhook).

## Generated JSON

The footer shows **live** `WorkflowDefinition` JSON (`id`, `name`, `nodes`, `edges`, optional `evaluationHooks`). **Copy** and **Download** use the same object.

**Import** — Paste JSON into the left panel and **Apply to canvas** to reverse-map nodes/edges (topological layout; Start is re-created).

## API calls (browser → backend)

All requests use `Content-Type: application/json` and **`NEXT_PUBLIC_MESH_API`** (see [`frontend/lib/meshConfig.ts`](../frontend/lib/meshConfig.ts), default `http://127.0.0.1:8787`).

| Button | Method | Path | Body |
| ------ | ------ | ---- | ---- |
| **Validate** | `POST` | `/workflows/validate` | `{ definition, forCompiler: true, forHybrid?: true }` — `forHybrid` is set when the definition includes hybrid fields or hooks. |
| **Compile** | `POST` | `/workflows/compile` | `{ definition, deployMode }` — `deployMode` is `executor` or `perNodeFanout` (toolbar). |
| **Deploy** | `POST` | `/workflows/from-definition` | `{ definition, deployMode }` — requires server **`PRIVATE_KEY`**, **`WORKFLOW_REGISTRY_ADDRESS`**, and Somnia RPC as for any deploy. |

CORS: set **`FRONTEND_ORIGIN`** on the API to include your Next dev origin (e.g. `http://localhost:3000`).

## Dependencies

- **`reactflow`** — canvas (same family as the reference stack).
- **`lucide-react`** — icons for nodes/toolbar (aligned with the reference look).

## Inspector / React Flow gotcha (fixed)

The step config panel must read node **`data` from the live `nodes` array** (keyed by `selectedId`), not the `node` object passed into `onNodeClick`. React Flow does not mutate that object when `useNodesState` updates — otherwise dropdowns (e.g. **Action** type) appear stuck on the first value even though JSON at the bottom updates.

## Limitations (v1 UI)

- Hybrid panel supports **one** bundled `ethCall` and either a **single** legacy condition or a **two-clause** tree (same `simulationResultIndex`) to keep the form small; advanced JSON still works via **Import**.
- **Per-node fan-out** deploy mode must satisfy backend validation (no hybrid on that path); the builder does not block incompatible combinations until **Compile** / **Deploy**.
