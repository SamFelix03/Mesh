# Paste-friendly workflow demos (Ping)

These JSON files match the **same `Ping(uint256)` subscription** as `backend/templates/demo-01-*.json` and `demo-02-*.json`:

- **topic0:** `0x48257dc961b6f792c2b78a080dacfed693b660960a702de21cee364e20270e2f`

## Before you deploy or paste

Replace every **`0x1111111111111111111111111111111111111111`** with your **TriggerEmitter** address — the same one you use for `POST /chain/ping` and (if set) **`DEMO_TRIGGER_EMITTER`**.

The bootstrap script does this replacement automatically; for manual copy-paste you must edit the emitter yourself.

## Files

| File | Use case |
|------|----------|
| `mesh-ui-demo-ping-single-noop.workflow.json` | One executor step: reacts to Ping, **noop** (good for trace smoke tests). |
| `mesh-ui-demo-ping-two-step.workflow.json` | Two-step **executor** DAG: Ping → noop → noop (two `WorkflowStepExecuted` lines in trace). |

Workflow **`id`** values are unique from the Shannon bootstrap demos (`mesh-showcase-shannon`, `mesh-demo-fanout-shannon`) so you can register both without id clashes.

Deploy with **`POST /workflows/from-definition`** (default `deployMode: "executor"`), or import/paste into the UI builder if your flow supports raw JSON.
