import { decodeAbiParameters, hexToBigInt, isHex, size, type Hex } from "viem";
import type { ConditionClause, ConditionConfig, ConditionOpV1, ConditionTree, WorkflowNodeDef } from "./dsl/types.js";

function decodeUint256FromSimulation(hex: Hex): bigint {
  if (!hex || hex === "0x") return 0n;
  if (!isHex(hex)) throw new Error("simulation result is not hex");
  const byteLen = size(hex);
  if (byteLen === 0) return 0n;
  if (byteLen <= 32) {
    return hexToBigInt(hex);
  }
  const decoded = decodeAbiParameters([{ type: "uint256" }], hex);
  return decoded[0] as bigint;
}

function compare(op: ConditionOpV1, left: bigint, right: bigint): boolean {
  switch (op) {
    case "uint256Gt":
      return left > right;
    case "uint256Gte":
      return left >= right;
    case "uint256Lt":
      return left < right;
    case "uint256Lte":
      return left <= right;
    case "uint256Eq":
      return left === right;
    case "uint256Neq":
      return left !== right;
    default:
      return false;
  }
}

export type EvaluationVerdict = {
  pass: boolean;
  reason: string;
  /** Decoded primary value when condition ran */
  observed?: string;
  threshold?: string;
};

/**
 * Evaluate a v1 uint256 condition against Somnia `simulationResults[]` from an off-chain subscribe push.
 * If `condition` is absent, returns pass (observability-only ethCalls).
 */
export function evaluateCondition(
  condition: ConditionConfig | undefined,
  simulationResults: readonly Hex[],
): EvaluationVerdict {
  if (!condition) {
    return { pass: true, reason: "no condition (ethCalls observability only)" };
  }
  if (condition.op === undefined || condition.compareDecimal === undefined) {
    return {
      pass: false,
      reason: "condition.op and condition.compareDecimal are required for hybrid evaluation",
    };
  }
  const idx = condition.simulationResultIndex;
  if (idx < 0 || idx >= simulationResults.length) {
    return {
      pass: false,
      reason: `simulationResultIndex ${idx} out of range (len=${simulationResults.length})`,
    };
  }
  const raw = simulationResults[idx]!;
  let observed: bigint;
  try {
    observed = decodeUint256FromSimulation(raw);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { pass: false, reason: `decode uint256 failed: ${msg}` };
  }
  let threshold: bigint;
  try {
    threshold = BigInt(condition.compareDecimal.trim());
  } catch {
    return { pass: false, reason: `invalid compareDecimal: ${condition.compareDecimal}` };
  }
  const pass = compare(condition.op, observed, threshold);
  return {
    pass,
    reason: `${condition.op}: ${observed.toString()} vs ${threshold.toString()} → ${pass ? "pass" : "fail"}`,
    observed: observed.toString(),
    threshold: threshold.toString(),
  };
}

function evaluateClause(clause: ConditionClause, simulationResults: readonly Hex[]): EvaluationVerdict {
  return evaluateCondition(
    {
      simulationResultIndex: clause.simulationResultIndex,
      op: clause.op,
      compareDecimal: clause.compareDecimal,
      description: clause.description,
    },
    simulationResults,
  );
}

export function evaluateConditionTree(tree: ConditionTree, simulationResults: readonly Hex[]): EvaluationVerdict {
  if (!tree.clauses.length) {
    return { pass: false, reason: "conditionTree has no clauses" };
  }
  const parts = tree.clauses.map((c) => evaluateClause(c, simulationResults));
  const pass =
    tree.combinator === "all" ? parts.every((p) => p.pass) : parts.some((p) => p.pass);
  const joiner = tree.combinator === "all" ? " AND " : " OR ";
  return {
    pass,
    reason: `(${parts.map((p) => p.reason).join(joiner)}) → ${pass ? "pass" : "fail"}`,
  };
}

/** Root hybrid: `conditionTree` wins over legacy `condition` if both present should have been rejected at validate. */
export function evaluateRootCondition(root: WorkflowNodeDef, simulationResults: readonly Hex[]): EvaluationVerdict {
  if (root.conditionTree) {
    return evaluateConditionTree(root.conditionTree, simulationResults);
  }
  return evaluateCondition(root.condition, simulationResults);
}
