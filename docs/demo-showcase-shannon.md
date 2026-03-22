# Shannon demo: full showcase workflow

This walkthrough matches [`templates/demo-01-hybrid-executor.workflow.json`](../templates/demo-01-hybrid-executor.workflow.json) (id `mesh-showcase-shannon`): **event subscription**, **hybrid `ethCalls` + `simulationResults`**, **on-chain `emit`**, and **trace + evaluation** WebSockets. Add [`demo-02-fanout-pipeline`](../templates/demo-02-fanout-pipeline.workflow.json) for per-node fan-out.

## Prerequisites

- **Contracts:** `WorkflowRegistry` + (optional) `AuditLog` deployed on Shannon — see the README table *Shannon testnet — deployed Mesh contracts* and [`contracts/script/deploy-mesh-shannon.sh`](../contracts/script/deploy-mesh-shannon.sh) (fixed high gas per tx).
- **Fast path:** from `backend/` run `npm run demo:bootstrap:shannon` (uses `WORKFLOW_REGISTRY_ADDRESS` + `PRIVATE_KEY` from `.env`). Addresses are written to [`contracts/deployments/shannon-demo.json`](../contracts/deployments/shannon-demo.json).
- **TriggerEmitter:** deploy the version with `pingCount()` (same `Ping(uint256)` topic as before). From `contracts/`:

  ```bash
  forge create src/demo/TriggerEmitter.sol:TriggerEmitter \
    --rpc-url https://dream-rpc.somnia.network \
    --private-key "$PRIVATE_KEY"
  ```

- **Backend env:** set `WORKFLOW_REGISTRY_ADDRESS`, `PRIVATE_KEY`, `SOMNIA_RPC_URL` / `SOMNIA_WS_URL`, and for the demo:

  - `TRACE_ENGINE=1` — wildcard `sdk.subscribe` → `/ws/trace` (workflow-filtered on the detail page).
  - `EVALUATION_ENGINE=1` — per-workflow hybrid subscribe → `/ws/evaluation`.

## Wire the template

Replace **both** occurrences of `0x1111111111111111111111111111111111111111` with your **TriggerEmitter** address (same address for `trigger.emitter` and `ethCalls[0].to`).

The topic `0x48257…` is **`Ping(uint256)`**. Calldata `0x87704569` is **`pingCount()`** (public getter).

## Deploy and index

Use the Workflow Manager API or CLI, for example:

```bash
# from backend/ with API running and env loaded (paths relative to backend/)
npx tsx scripts/mesh-cli.ts deploy-dsl --file ../templates/demo-01-hybrid-executor.workflow.json
# or POST /workflows/from-definition with the JSON body
```

Open the workflow **detail** page in the dashboard (`/workflows/<id>`). You should see registry fields, index metadata, the DSL snapshot, and the large **trace** / **evaluation** panels.

## Prove subscription + indexing + hybrid

1. **Trigger:** call `ping(uint256)` on your TriggerEmitter (any sequence value), e.g. with `cast`:

   ```bash
   cast send "$EMITTER" "ping(uint256)" 42 \
     --rpc-url https://dream-rpc.somnia.network \
     --private-key "$PRIVATE_KEY"
   ```

2. **Trace (`TRACE_ENGINE=1`):** the detail page’s **Execution trace** stream should show lines for this workflow (e.g. step execution / handler activity), demonstrating that the reactive subscription fired and the trace engine observed the push.

3. **Evaluation (`EVALUATION_ENGINE=1`):** **Off-chain evaluation** should show a **PASS** for the root condition (`pingCount > 0` after the ping), proving `ethCalls` + `simulationResults` decoding in the same push as the event.

4. **On-chain emit:** the compiled root step includes an **emit** action (`Notify(uint256)`), so executor logs should reflect that step when the workflow runs.

## Optional: evaluation webhook

To demo `evaluationHooks.onPass`, add a `webhook` entry to the definition and redeploy; the server must be able to reach the URL. Keep demo URLs private or use a throwaway request inspector.
