# Demo: UI walkthrough (beginner, click-by-click)

This guide assumes you already started the **backend** (`cd backend && npm run dev`) and **frontend** (`cd frontend && npm run dev`), and ran **`npm run demo:bootstrap:shannon`** at least once so workflows appear in the list.

**Local URLs (default):**

- Frontend: **http://localhost:3000**
- API (for reference): **http://127.0.0.1:8787**

If your Next app uses another port, replace `3000` in the paths below.

---

## Pitch: who needs Mesh? (example story)

**Situation:** You run a **lending protocol** on Somnia. When a user **repays a loan** on Contract A, you need to (1) **update a risk score** stored in Contract B, (2) **only notify your risk API** if their collateral ratio (read from a view function) is still below a threshold—**using the same block context as the repayment event**, and (3) **emit an audit event** from your own workflow contract so indexers and your dashboard stay in sync.

**Without Mesh / reactivity:** You run a **bot** that watches logs via RPC, then calls other contracts. That bot can **miss events**, **race** with chain reorgs, or read **stale state** because the follow-up `eth_call` is not tied to the same execution context as the event.

**With Somnia + Mesh:** The chain’s reactivity layer **delivers the event and bundled view calls together**, then **invokes your Solidity workflow steps** on schedule. Mesh gives you the **DSL + compiler + registry + dashboard** so your team defines that flow as a **workflow**, deploys it once, and **monitors** it from the UI—instead of maintaining fragile off-chain automation.

The **bundled demo** is a prototyle that uses a mock **TriggerEmitter** instead of a real lending contract, but the **same mechanics** apply: one on-chain signal → **subscriptions fire** → **handlers run** → you **see traces and (for hybrid flows) off-chain evaluation** in the UI.

---

## Page 1 — Home (`/`)

1. Open your browser and go to **http://localhost:3000** (or your deployed site root).
2. You should see the **Mesh** title and short subtitle.
3. Find the purple button **“Live demo (testnet)”** and **click it**.  
   - This takes you to **`/demo`**.  
   - (Optional: the other button **“Workflows”** goes to the workflow list—we use that later.)

**If the button does nothing or you get an error page:** check that the frontend dev server is running and the URL is correct.

---

## Page 2 — Live demo hub (`/demo`)

**Goal:** Fire a test transaction and watch **trace** and **evaluation** streams.

### Top of the page

1. You should see the title **“Shannon live demo”** and a short explanation of Demo 1 vs Demo 2.
2. Links **“← Home”** and **“All workflows”** are at the top left:
   - **← Home** → back to `/`
   - **All workflows** → `/workflows` (we use this in [Page 4](#page-4--workflow-list-workflows))

### If you see a yellow box (“Demo data not loaded”)

- The frontend could not load workflows from the API, or the expected demo ids are missing.
- Fix: confirm **`NEXT_PUBLIC_MESH_API`** in `frontend/.env` points to your backend (e.g. `http://127.0.0.1:8787`), backend is running, and you ran **`demo:bootstrap:shannon`**. Then **refresh** the page.

### Section: “Fire a test Ping”

1. Read the short text: it explains that both demos listen for **`Ping`** on the **TriggerEmitter** address shown in the gray box.
2. Click the purple button **“Ping (on-chain)”** once.
3. Wait a second or two.
4. Below the button you should see either:
   - **“Submitted · 0x…”** (a transaction hash) → good,  
   - or an **error message** → often means backend **`PRIVATE_KEY`** missing, wrong network, or CORS (`FRONTEND_ORIGIN`).

**What this button does:** it calls the backend **`POST /chain/ping`**, which sends a real **`ping`** transaction to the demo emitter using the server’s wallet—not your browser wallet.

### Left card — “Demo 1 — Hybrid executor”

1. Read the card title and subtitle (hybrid = ethCalls + condition + emit path).
2. Click **“Open full monitor →”** when you want the big detail view (see [Page 5](#page-5--workflow-detail-monitor)).
3. **“Off-chain evaluation”** (green panel):  
   - After a successful Ping, new lines should appear (e.g. **PASS**), if **`EVALUATION_ENGINE=1`** on the backend.  
   - You can tick **“raw JSON”** to see the full payload.
4. **“Live trace”** (dark panel):  
   - After Ping, new lines should appear if **`TRACE_ENGINE=1`**.  
   - Status in the corner may show **CONNECTING** then **OPEN**.  
   - Same **raw JSON** checkbox as above.

### Right card — “Demo 2 — Per-node fan-out”

1. This card explains **three** on-chain step contracts, each with its **own** subscription (same Ping filter).
2. **“Open full monitor →”** opens that workflow’s detail page.
3. **“Live trace”** only (no green evaluation panel)—fan-out demo is not hybrid.

**Tip:** Click **Ping** two or three times and watch both trace panels; you should see activity repeatedly.

---

## Page 4 — Workflow list (`/workflows`)

1. From **`/demo`**, click **“All workflows”** at the top, **or** from home click **“Workflows”**.
2. You land on **`/workflows`** with the heading **“Workflows”**.
3. You should see **cards** (one per indexed workflow). Each card shows:
   - **Name** (or id),
   - **Status** (e.g. active),
   - **Kind** (e.g. compiled),
   - **Subscription** id,
   - **Date** and **“View Monitor →”**.
4. Click anywhere on a card (or **“View Monitor →”**) to open that workflow’s **detail** page.

**Top right buttons:**

- **“Live demo”** → `/demo` again.
- **“Create Workflow”** → opens the **builder** ([Page 6](#page-6--visual-builder-workflowsbuild)).

---

## Page 5 — Workflow detail (“full monitor”) (`/workflows/[id]`)

**How to get here:** from **`/demo`** click **“Open full monitor →”** on a card, or from **`/workflows`** click a workflow card.

The URL looks like:

- `http://localhost:3000/workflows/mesh-showcase-shannon` (string id), or  
- `http://localhost:3000/workflows/0x49bc…` (bytes32 id).

### Top area (hero)

1. **“← Workflows”** — back to the list.
2. Large **title** (workflow name).
3. **Badges:** e.g. **Status: Active**, **Kind: compiled**, **Single executor** or **Per-node fan-out**, **Hybrid evaluation** or **On-chain steps only**.

### “Registry & identity”

- **WorkflowRegistry** address with **Copy** and **Explorer**.
- **Workflow id (bytes32)**, **Owner**, optional **String id** — use **Copy** if you need them in docs or support chats.

### “Deployment index”

- **Registered** time, **Emitter**, **Primary node** (executor or first node), **Root subscription** with a link **“GET subscription info”** (opens JSON from the API in a new tab).

### “Steps & subscriptions”

- Table: each **row** is a registry step with **node contract** and **subscription** id. Use **Explorer** / **Open JSON** as needed.

### “DSL snapshot” (if present)

- **Stats** (nodes, edges, hybrid count).
- **Table** of each node: trigger type, action type, hybrid yes/no.
- **“Show full definition JSON”** — expands the raw JSON export.

### Bottom panels

- **“Off-chain evaluation (live)”** — only for **hybrid** workflows; same idea as on `/demo`.
- **“Execution trace (live)”** — WebSocket trace for **this** `workflowId`.

**Try this:** keep this page open, open **`/demo`** in another tab, click **Ping**, then switch back—trace/eval lines should update here too.

---

## Page 6 — Visual builder (`/workflows/build`)

1. From **`/workflows`**, click **“Create Workflow”** (top right).
2. You are on **`/workflows/build`** — the **canvas** where you drag nodes and edges.
3. Typical flow (depends on your UI version):
   - Set **workflow id / name** in the panel.
   - Add **nodes**, connect **edges**.
   - Use actions like **Validate**, **Compile**, **Deploy** — they talk to the backend API using your **`NEXT_PUBLIC_MESH_API`**.

**For a first demo you can skip deploying** and just show that **workflows can be designed visually** and exported as JSON.

---

## Quick troubleshooting

| What you see | What to check |
| ------------ | ------------- |
| Empty workflow list | Backend running; `GET /workflows` returns data; bootstrap wrote `backend/data/workflows-index.json`. |
| `/demo` yellow warning | `NEXT_PUBLIC_MESH_API`; demo ids `mesh-showcase-shannon` / `mesh-demo-fanout-shannon` in index. |
| Ping fails | `PRIVATE_KEY` in backend `.env`; emitter address matches indexed workflows; `FRONTEND_ORIGIN` includes your frontend URL. |
| Trace stuck / empty | `TRACE_ENGINE=1`; WS URL reachable from browser; wait a few seconds after Ping. |
| No evaluation lines | `EVALUATION_ENGINE=1`; workflow has **hybrid** flag (Demo 1 only). |

---

## Related docs

- README **How to demo**: [../README.md](../README.md)  
- Shot list for recording: [demo-video-flow.md](./demo-video-flow.md)  
- Shannon mechanics: [demo-showcase-shannon.md](./demo-showcase-shannon.md)
