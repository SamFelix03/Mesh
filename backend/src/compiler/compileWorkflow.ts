import { keccak256, stringToBytes, toEventHash, zeroAddress, type Address, type Hex } from "viem";
import type { TriggerConfig, WorkflowDefinition } from "../dsl/types.js";
import { workflowIdFromString } from "../workflowId.js";
import { WorkflowValidationError } from "../dsl/validateWorkflow.js";
import { findSingleRootId, orderWithRootFirst } from "./dagOrder.js";
import { validateWorkflowForCompiler } from "./validateForCompiler.js";

const ZERO_TOPIC32 = "0x0000000000000000000000000000000000000000000000000000000000000000" as Hex;

export type CompiledStepArg = {
  target: Address;
  data: Hex;
  /** Non-zero iff this step emits `LOG1(data, logTopic0)` on-chain (`MeshWorkflowExecutor`). */
  logTopic0: Hex;
  nextIndices: readonly number[];
};

export type CompiledWorkflow = {
  definition: WorkflowDefinition;
  workflowId: Hex;
  /** Immutable `nodeId` on the executor contract (= keccak256(utf8(root DSL node id))). */
  rootStepNodeId: Hex;
  stepNodeIds: Hex[];
  steps: CompiledStepArg[];
  rootTrigger: TriggerConfig;
};

/**
 * Full compiler: validate → unique root → topological order with root at index 0 →
 * encode `MeshWorkflowExecutor` constructor args + subscription descriptor for the root trigger.
 */
export function compileWorkflowDefinition(def: WorkflowDefinition): CompiledWorkflow {
  validateWorkflowForCompiler(def);

  const rootId = findSingleRootId(def);
  const orderedNodeIds = orderWithRootFirst(def, rootId);
  const idToIndex = new Map(orderedNodeIds.map((id, i) => [id, i]));

  const stepNodeIds = orderedNodeIds.map((id) => keccak256(stringToBytes(id)) as Hex);

  const steps: CompiledStepArg[] = orderedNodeIds.map((id) => {
    const node = def.nodes.find((n) => n.id === id)!;
    const nextIndices = (def.edges ?? [])
      .filter((e) => e.from === id)
      .map((e) => {
        const ix = idToIndex.get(e.to);
        if (ix === undefined) {
          throw new WorkflowValidationError(`internal: missing edge target ${e.to}`, "INTERNAL");
        }
        if (ix > 255) {
          throw new WorkflowValidationError("DAG too large: max 255 steps for uint8 indices", "DAG_SIZE");
        }
        return ix;
      });

    if (node.action.type === "noop") {
      return { target: zeroAddress, data: "0x" as Hex, logTopic0: ZERO_TOPIC32, nextIndices };
    }
    if (node.action.type === "call") {
      return {
        target: node.action.target,
        data: node.action.data,
        logTopic0: ZERO_TOPIC32,
        nextIndices,
      };
    }
    if (node.action.type === "emit") {
      const sig = node.action.eventSig.trim();
      let topic0: Hex;
      try {
        topic0 = toEventHash(sig) as Hex;
      } catch {
        throw new WorkflowValidationError(
          `node "${id}": eventSig must be a valid ABI event signature (e.g. "Notify(uint256,address)")`,
          "BAD_EVENT_SIG",
        );
      }
      if (topic0.toLowerCase() === ZERO_TOPIC32) {
        throw new WorkflowValidationError(`node "${id}": derived event topic0 must be non-zero`, "BAD_EMIT_TOPIC0");
      }
      const payload = node.action.payload.trim() === "" ? ("0x" as Hex) : node.action.payload;
      return {
        target: zeroAddress,
        data: payload,
        logTopic0: topic0,
        nextIndices,
      };
    }
    throw new WorkflowValidationError(`node "${id}": unsupported action`, "ACTION");
  });

  const wfId = workflowIdFromString(def.id);
  const rootStepNodeId = keccak256(stringToBytes(rootId)) as Hex;
  const rootTrigger = def.nodes.find((n) => n.id === rootId)!.trigger;

  return {
    definition: def,
    workflowId: wfId,
    rootStepNodeId,
    stepNodeIds,
    steps,
    rootTrigger,
  };
}
