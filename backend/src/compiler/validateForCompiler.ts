import { getAddress, isAddress, isHex, size, toEventHash, zeroAddress, type Hex } from "viem";
import type { WorkflowDefinition } from "../dsl/types.js";
import { validateWorkflowDefinition, WorkflowValidationError } from "../dsl/validateWorkflow.js";
import { assertAllReachableFromRoot, findSingleRootId } from "./dagOrder.js";

const ZERO_TOPIC = "0x0000000000000000000000000000000000000000000000000000000000000000" as const;

/** EVM / RPC practical cap for a single log’s data field (conservative). */
export const MAX_EMIT_PAYLOAD_BYTES = 10_240;

/** Stricter checks for on-chain compilation (call / noop / emit; no off-chain conditions). */
export function validateWorkflowForCompiler(def: WorkflowDefinition): void {
  validateWorkflowDefinition(def);

  for (const n of def.nodes) {
    if (n.condition) {
      throw new WorkflowValidationError(
        `node "${n.id}": on-chain compiler v1 does not support condition (use future off-chain evaluator)`,
        "CONDITION_UNSUPPORTED",
      );
    }
    if (n.ethCalls?.length) {
      throw new WorkflowValidationError(`node "${n.id}": ethCalls not supported in compiler v1`, "ETHCALLS_UNSUPPORTED");
    }
    if (n.action.type === "emit") {
      const sig = n.action.eventSig?.trim() ?? "";
      if (!sig) {
        throw new WorkflowValidationError(`node "${n.id}": emit.eventSig is required`, "BAD_EVENT_SIG");
      }
      try {
        toEventHash(sig);
      } catch {
        throw new WorkflowValidationError(
          `node "${n.id}": emit.eventSig must be a valid ABI-style event signature (e.g. "Notify(uint256,address)")`,
          "BAD_EVENT_SIG",
        );
      }
      const raw = typeof n.action.payload === "string" ? n.action.payload.trim() : "";
      const payload = (raw === "" ? "0x" : raw) as Hex;
      if (!isHex(payload)) {
        throw new WorkflowValidationError(`node "${n.id}": emit.payload must be hex (0x...)`, "BAD_EMIT_PAYLOAD");
      }
      if (size(payload) > MAX_EMIT_PAYLOAD_BYTES) {
        throw new WorkflowValidationError(
          `node "${n.id}": emit.payload exceeds ${MAX_EMIT_PAYLOAD_BYTES} bytes`,
          "EMIT_PAYLOAD_TOO_LARGE",
        );
      }
    }
    if (n.action.type === "call") {
      if (!isAddress(n.action.target)) {
        throw new WorkflowValidationError(`node "${n.id}": invalid call target`, "BAD_TARGET");
      }
    }
  }

  const rootId = findSingleRootId(def);
  assertAllReachableFromRoot(def, rootId);

  const root = def.nodes.find((n) => n.id === rootId)!;
  const t = root.trigger;
  if (t.type === "event") {
    if (!isAddress(t.emitter) || getAddress(t.emitter) === getAddress(zeroAddress)) {
      throw new WorkflowValidationError("root event trigger requires non-zero emitter", "BAD_EMITTER");
    }
    if (t.eventTopic0.toLowerCase() === ZERO_TOPIC) {
      throw new WorkflowValidationError("root event trigger requires non-zero topic0", "BAD_TOPIC0");
    }
  }
  if (t.type === "cron:timestamp") {
    const min = Date.now() + 13_000;
    if (t.timestampMs <= min) {
      throw new WorkflowValidationError(
        `schedule timestamp must be >12s in the future (ms since epoch); need after ${min}`,
        "BAD_SCHEDULE_TIME",
      );
    }
  }
}
