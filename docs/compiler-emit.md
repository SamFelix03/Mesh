# Compiler: `emit` actions (`MeshWorkflowExecutor`)

Mesh **v1.1** extends the compiled executor so a DAG step can record an **anonymous EVM log with one topic** (`LOG1`) plus arbitrary **data**. This matches integrators who expect a normal Solidity `event` **topic0** and ABI-encoded non-indexed fields in the log body.

---

## What gets deployed

For each DSL node with `action.type === "emit"`:

| Field | On-chain use |
| ----- | ---------------- |
| `eventSig` | Hashed with viem’s **`toEventHash`** (same rule as Solidity’s event **topic0**). |
| `payload` | Becomes the log’s **data** field (opaque bytes). Often `encodeAbiParameters` for the event’s non-indexed arguments. |

The executor step still runs **`WorkflowStepExecuted`** after the optional `call`/`emit`/`noop` body so the Mesh trace stream remains consistent.

**Mutual exclusion:** a step is either an **emit** (`logTopic0 ≠ 0`, `target = 0`) or a **call** (`target ≠ 0` and calldata non-empty) or a **noop**. The Solidity constructor reverts if emit and call are combined.

---

## Solidity reference

Source: [`contracts/src/compiler/MeshWorkflowExecutor.sol`](../contracts/src/compiler/MeshWorkflowExecutor.sol).

- `Step.logTopic0` — `bytes32`; zero means “not an emit step”.
- Non-zero `logTopic0` → `assembly { log1(ptr, len, topic0) }` on the **memory copy** of `Step.data`.
- Order of operations inside `_runStep`: **emit or call** → **`WorkflowStepExecuted`** → recurse to child indices.

---

## DSL shape

```json
{
  "action": {
    "type": "emit",
    "eventSig": "Notify(uint256)",
    "payload": "0x0000000000000000000000000000000000000000000000000000000000000001"
  }
}
```

### `eventSig`

- Must parse as a valid ABI-style event definition (viem normalizes names / `indexed` keywords).
- Examples: `Transfer(address,address,uint256)`, `Notify(uint256)`.

### `payload`

- Hex string; use `0x` for **zero-length** data (topic-only style log).
- Maximum length: **`MAX_EMIT_PAYLOAD_BYTES` (10,240)** in [`validateForCompiler.ts`](../backend/src/compiler/validateForCompiler.ts).

### Encoding payload off-chain (TypeScript)

```ts
import { encodeAbiParameters, parseAbiParameters } from "viem";

const payload = encodeAbiParameters(parseAbiParameters("uint256 value"), [42n]);
// pass `payload` into WorkflowDefinition node action
```

---

## API / CLI

- `POST /workflows/validate` with `{ "definition", "forCompiler": true }` — validates `eventSig` and `payload`.
- `POST /workflows/compile` — each compiled step includes `logTopic0` (`0x00…00` for noop/call).
- `POST /workflows/from-definition` — deploys bytecode that includes emit steps.

```bash
cd backend
npm run mesh -- validate --file ../templates/example.workflow.emit.json --compiler
npm run mesh -- compile --file ../templates/example.workflow.emit.json
```

---

## Consuming logs

- **Indexers / subgraphs:** treat the log as an **anonymous** event with **one topic** equal to your event hash; decode `data` with the same ABI you used to build `payload`.
- **Trace dashboard:** you still get `WorkflowStepExecuted` from `WorkflowNode`; the custom `LOG1` is additional signal for protocol-specific analytics.

---

## Security notes

- **Re-entrancy:** emit does not call external contracts; `call` steps still use `.call` (unchanged).
- **Log size:** large payloads cost gas; the compiler enforces a conservative byte cap before deploy.
- **Handler re-fires:** Somnia docs warn about subscriptions that re-trigger the same handler; design `eventSig` / filters so your workflow does not create unintended feedback loops.

---

## Testing

Foundry: [`contracts/test/MeshWorkflowExecutor.t.sol`](../contracts/test/MeshWorkflowExecutor.t.sol) (`test_emit_step_emits_log1`).  
`onEvent` is gated to `msg.sender == 0x0100`; the test uses `vm.prank(SomniaExtensions.SOMNIA_REACTIVITY_PRECOMPILE_ADDRESS)`.
