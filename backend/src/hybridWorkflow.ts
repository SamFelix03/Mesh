import { getAddress, isAddress, isHex } from "viem";
import type { ConditionTree, EvaluationOnPassHook, WorkflowDefinition } from "./dsl/types.js";
import {
  normalizeWorkflowDefinition,
  validateWorkflowDefinition,
  WorkflowValidationError,
} from "./dsl/validateWorkflow.js";
import { assertAllReachableFromRoot, findSingleRootId } from "./compiler/dagOrder.js";

const MAX_ETH_CALLS = 16;
const MAX_CONDITION_CLAUSES = 32;
const MAX_ON_PASS_HOOKS = 8;

export function needsHybridEvaluation(def: WorkflowDefinition): boolean {
  return def.nodes.some(
    (n) =>
      (n.ethCalls?.length ?? 0) > 0 ||
      n.condition !== undefined ||
      (n.conditionTree !== undefined && (n.conditionTree.clauses?.length ?? 0) > 0),
  );
}

export function assertNoOrphanEvaluationHooks(def: WorkflowDefinition): void {
  if ((def.evaluationHooks?.onPass?.length ?? 0) > 0 && !needsHybridEvaluation(def)) {
    throw new WorkflowValidationError(
      "evaluationHooks.onPass requires hybrid root ethCalls / condition / conditionTree",
      "HOOKS_NEED_HYBRID",
    );
  }
}

/** Deep clone: strip per-node off-chain fields before on-chain compile (hooks stay on `definition`). */
export function stripOffchainGuards(def: WorkflowDefinition): WorkflowDefinition {
  return {
    ...def,
    nodes: def.nodes.map((n) => {
      const { ethCalls: _e, condition: _c, conditionTree: _t, ...rest } = n;
      return { ...rest };
    }),
  };
}

function validateConditionTree(tree: ConditionTree, ethCallCount: number): void {
  if (tree.combinator !== "all" && tree.combinator !== "any") {
    throw new WorkflowValidationError("conditionTree.combinator must be all or any", "HYBRID_TREE_BAD");
  }
  if (!tree.clauses.length || tree.clauses.length > MAX_CONDITION_CLAUSES) {
    throw new WorkflowValidationError(
      `conditionTree needs 1–${MAX_CONDITION_CLAUSES} clauses`,
      "HYBRID_TREE_CLAUSES",
    );
  }
  for (let i = 0; i < tree.clauses.length; i++) {
    const c = tree.clauses[i]!;
    if (c.simulationResultIndex < 0 || c.simulationResultIndex >= ethCallCount) {
      throw new WorkflowValidationError(
        `conditionTree.clauses[${i}].simulationResultIndex out of range`,
        "HYBRID_TREE_INDEX",
      );
    }
    if (!c.op || c.compareDecimal === undefined) {
      throw new WorkflowValidationError(`conditionTree.clauses[${i}] needs op + compareDecimal`, "HYBRID_TREE_CLAUSE");
    }
  }
}

function validateEvaluationHooks(def: WorkflowDefinition): void {
  const hooks = def.evaluationHooks?.onPass;
  if (!hooks?.length) return;
  if (hooks.length > MAX_ON_PASS_HOOKS) {
    throw new WorkflowValidationError(`at most ${MAX_ON_PASS_HOOKS} evaluationHooks.onPass entries`, "HOOKS_LIMIT");
  }
  for (let i = 0; i < hooks.length; i++) {
    validateOneHook(hooks[i]!, i);
  }
}

function validateOneHook(h: EvaluationOnPassHook, i: number): void {
  if (h.type === "webhook") {
    try {
      const u = new URL(h.url);
      if (u.protocol !== "http:" && u.protocol !== "https:") {
        throw new WorkflowValidationError(`hooks[${i}].url must be http(s)`, "HOOK_BAD_URL");
      }
    } catch (e) {
      if (e instanceof WorkflowValidationError) throw e;
      throw new WorkflowValidationError(`hooks[${i}].url invalid`, "HOOK_BAD_URL");
    }
  } else if (h.type === "rawTx") {
    if (process.env.MESH_ALLOW_EVAL_RAW_TX !== "1") {
      throw new WorkflowValidationError(
        "rawTx hooks require MESH_ALLOW_EVAL_RAW_TX=1 on the API server",
        "RAW_TX_DISABLED",
      );
    }
    if (!isAddress(h.to) || !isHex(h.data)) {
      throw new WorkflowValidationError(`hooks[${i}] rawTx to/data invalid`, "HOOK_BAD_TX");
    }
    getAddress(h.to);
    if (h.valueWei !== undefined) {
      try {
        BigInt(h.valueWei);
      } catch {
        throw new WorkflowValidationError(`hooks[${i}].valueWei invalid`, "HOOK_BAD_VALUE");
      }
    }
  } else {
    throw new WorkflowValidationError(`hooks[${i}] unknown type`, "HOOK_BAD_TYPE");
  }
}

/**
 * Hybrid path: root may carry `ethCalls` + `condition` / `conditionTree` for Somnia off-chain subscribe.
 * v1: only the **root** node; root trigger must be `event`.
 */
export function validateHybridWorkflow(input: WorkflowDefinition): void {
  const def = normalizeWorkflowDefinition(input);
  validateWorkflowDefinition(def);
  if (!needsHybridEvaluation(def)) {
    throw new WorkflowValidationError(
      "hybrid: add root ethCalls and/or condition / conditionTree, or omit forHybrid / hybrid compile path",
      "HYBRID_EMPTY",
    );
  }

  validateEvaluationHooks(def);

  const rootId = findSingleRootId(def);
  assertAllReachableFromRoot(def, rootId);

  for (const n of def.nodes) {
    const hasEth = (n.ethCalls?.length ?? 0) > 0;
    const hasCond = n.condition !== undefined || (n.conditionTree?.clauses?.length ?? 0) > 0;
    if ((hasEth || hasCond) && n.id !== rootId) {
      throw new WorkflowValidationError(
        `hybrid v1: only root node "${rootId}" may define ethCalls or condition fields (offending: "${n.id}")`,
        "HYBRID_NON_ROOT_GUARD",
      );
    }
  }

  const root = def.nodes.find((x) => x.id === rootId)!;
  if (root.trigger.type !== "event") {
    throw new WorkflowValidationError(
      'hybrid v1: root trigger must be type "event" (off-chain subscribe uses emitter + topic0)',
      "HYBRID_EVENT_ROOT_ONLY",
    );
  }

  const calls = root.ethCalls ?? [];
  if (calls.length > MAX_ETH_CALLS) {
    throw new WorkflowValidationError(`hybrid v1: at most ${MAX_ETH_CALLS} ethCalls on root`, "HYBRID_TOO_MANY_ETHCALLS");
  }

  for (let i = 0; i < calls.length; i++) {
    const c = calls[i]!;
    if (!isAddress(c.to)) {
      throw new WorkflowValidationError(`hybrid: ethCalls[${i}].to invalid address`, "HYBRID_BAD_ETHCALL");
    }
    getAddress(c.to);
    const d = c.data?.trim() ?? "0x";
    if (d !== "0x" && !isHex(d)) {
      throw new WorkflowValidationError(`ethCalls[${i}].data must be hex`, "HYBRID_BAD_ETHCALL_DATA");
    }
  }

  if (root.condition && root.conditionTree) {
    throw new WorkflowValidationError("hybrid: use either condition or conditionTree on root, not both", "HYBRID_COND_DUP");
  }

  if (root.conditionTree) {
    if (calls.length === 0) {
      throw new WorkflowValidationError("hybrid: conditionTree requires ethCalls for simulationResults", "HYBRID_TREE_NO_ETH");
    }
    validateConditionTree(root.conditionTree, calls.length);
  } else if (root.condition) {
    const cond = root.condition;
    if (cond.op === undefined || cond.compareDecimal === undefined) {
      throw new WorkflowValidationError(
        "hybrid: root.condition requires op and compareDecimal (v1 uint256 compare)",
        "HYBRID_CONDITION_INCOMPLETE",
      );
    }
    if (cond.simulationResultIndex < 0) {
      throw new WorkflowValidationError("hybrid: condition.simulationResultIndex must be >= 0", "HYBRID_BAD_COND_INDEX");
    }
    if (calls.length === 0) {
      throw new WorkflowValidationError(
        "hybrid: condition requires at least one ethCall to populate simulationResults",
        "HYBRID_COND_NO_ETHCALLS",
      );
    }
    if (cond.simulationResultIndex >= calls.length) {
      throw new WorkflowValidationError(
        `hybrid: condition.simulationResultIndex ${cond.simulationResultIndex} >= ethCalls length ${calls.length}`,
        "HYBRID_COND_INDEX_RANGE",
      );
    }
  }
}

/** Compile `definition` for executor, stripping per-node guards when hybrid fields are present. */
export function definitionForOnChainCompile(def: WorkflowDefinition): WorkflowDefinition {
  return needsHybridEvaluation(def) ? stripOffchainGuards(def) : def;
}
