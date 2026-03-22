# Demo video flow (full product tour)

Use this as a shot list for a **5–8 minute** screen recording. Target audience: developers evaluating Mesh on **Somnia Shannon** (chain id `50312`).

**Prerequisites on screen (brief):** backend `.env` with registry, `PRIVATE_KEY`, `TRACE_ENGINE=1`, `EVALUATION_ENGINE=1`, `DEMO_TRIGGER_EMITTER`, frontend `NEXT_PUBLIC_MESH_API`; both servers running.

---

### 1. Problem & positioning (30–45s)

- Optional hook: tell the **lending / repayment + risk check** story from [demo-ui-walkthrough § Pitch](demo-ui-walkthrough.md#pitch-who-needs-mesh-example-story) (or your own vertical).
- Then: reactive workflows without bots; Somnia pushes logs + `simulationResults`; Mesh = DSL, compiler, API, UI, trace + hybrid evaluation.
- Mention **Shannon testnet** only.

### 2. Contracts & addresses (45–60s)

- Show [`backend/contracts/deployments/shannon-demo.json`](../backend/contracts/deployments/shannon-demo.json) or README table.
- Call out: **WorkflowRegistry**, **AuditLog** (governance-style), **TriggerEmitter** (demo signal), **MeshWorkflowExecutor** (demo 1), **MeshSimpleStepNode** ×3 (demo 2 after full bootstrap).
- Optional: open [Shannon explorer](https://shannon-explorer.somnia.network/) on registry + executor.

### 3. Live demo hub — `/demo` (90–120s)

- Follow the **click-by-click** script in [`demo-ui-walkthrough.md`](./demo-ui-walkthrough.md) (sections *Page 1* → *Page 2*) so you don’t miss buttons.
- Narrate **Demo 1** vs **Demo 2** while pointing at each card.
- Click **Ping (on-chain)**; show **Submitted · 0x…**.
- **Demo 1:** green **Off-chain evaluation** → **PASS** after ping (`EVALUATION_ENGINE=1`).
- **Both cards:** **Live trace** new lines (`TRACE_ENGINE=1`).

### 4. Workflow monitor — detail page (60–90s)

- Click **Open full monitor** for Demo 1.
- Walk **Registry & identity**, **Deployment index**, **DSL snapshot** (nodes table + JSON).
- Reiterate **trace** + **evaluation** streams on the full page.

### 5. Workflow list & builder (90–120s)

- **`/workflows`**: list from index; status, kind, subscription id.
- **`/workflows/build`**: visual DAG; mention validate / compile / deploy to API (don’t need to deploy live if time is short).
- Optional: `mesh-cli` in terminal — `validate` / `compile` on `demo-01` JSON.

### 6. API & ops (45s)

- `GET /health`, `GET /workflows`, `POST /chain/ping` (already shown in UI).
- Mention `POST /workflows/from-definition`, pause/delete, `GET /workflows/:id/subscriptions/:subId` for debugging.

### 7. Close (20s)

- Recap: **one Ping** drives **on-chain reactive handlers**, **trace**, and **hybrid evaluation**; second workflow shows **fan-out** deploy mode.
- Point to README **How to demo** and [`demo-showcase-shannon.md`](demo-showcase-shannon.md).

---

**B-roll / backup if subs are slow:** show explorer tx; show backend logs with `[trace]` when `TRACE_ENGINE` logs to stdout.
