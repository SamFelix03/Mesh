import { getAddress } from "viem";
import type { WorkflowDefinition } from "../dsl/types.js";
import { WorkflowValidationError } from "../dsl/validateWorkflow.js";
import { assertAllReachableFromRoot, findSingleRootId } from "../compiler/dagOrder.js";
import { validateWorkflowForCompiler } from "../compiler/validateForCompiler.js";
import { needsHybridEvaluation } from "../hybridWorkflow.js";

const MAX_PER_NODE = 16;

function eventTriggersEqual(
  a: Extract<WorkflowDefinition["nodes"][0]["trigger"], { type: "event" }>,
  b: Extract<WorkflowDefinition["nodes"][0]["trigger"], { type: "event" }>,
): boolean {
  return (
    getAddress(a.emitter).toLowerCase() === getAddress(b.emitter).toLowerCase() &&
    a.eventTopic0.toLowerCase() === b.eventTopic0.toLowerCase()
  );
}

/** Same root `event` filter on every node — required so each subscription uses identical Somnia filters. */
export function validatePerNodeFanout(def: WorkflowDefinition): void {
  if ((def.evaluationHooks?.onPass?.length ?? 0) > 0) {
    throw new WorkflowValidationError(
      "evaluationHooks are only supported on hybrid executor deploys, not perNodeFanout",
      "HOOKS_NOT_PER_NODE",
    );
  }
  if (needsHybridEvaluation(def)) {
    throw new WorkflowValidationError(
      "perNodeFanout cannot be combined with hybrid root ethCalls/condition; use deployMode executor",
      "PER_NODE_NO_HYBRID",
    );
  }

  validateWorkflowForCompiler(def);

  if (def.nodes.length > MAX_PER_NODE) {
    throw new WorkflowValidationError(
      `perNodeFanout supports at most ${MAX_PER_NODE} nodes`,
      "PER_NODE_TOO_MANY",
    );
  }

  const rootId = findSingleRootId(def);
  assertAllReachableFromRoot(def, rootId);
  const root = def.nodes.find((n) => n.id === rootId)!;
  if (root.trigger.type !== "event") {
    throw new WorkflowValidationError("perNodeFanout requires root trigger type event", "PER_NODE_EVENT_ONLY");
  }

  for (const n of def.nodes) {
    if (n.trigger.type !== "event") {
      throw new WorkflowValidationError(
        `perNodeFanout: node "${n.id}" must use event trigger (same as root)`,
        "PER_NODE_EVENT_ONLY",
      );
    }
    if (!eventTriggersEqual(root.trigger, n.trigger)) {
      throw new WorkflowValidationError(
        `perNodeFanout: node "${n.id}" trigger must match root emitter + topic0`,
        "PER_NODE_TRIGGER_MISMATCH",
      );
    }
  }
}
