import { decodeEventLog, type Hex } from "viem";

/** Mesh `WorkflowStepExecuted` / `WorkflowNoOp` (same as on-chain `WorkflowNode`). */
const meshTraceAbi = [
  {
    type: "event",
    name: "WorkflowStepExecuted",
    inputs: [
      { name: "workflowId", type: "bytes32", indexed: true },
      { name: "nodeId", type: "bytes32", indexed: true },
      { name: "timestamp", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "WorkflowNoOp",
    inputs: [
      { name: "workflowId", type: "bytes32", indexed: true },
      { name: "nodeId", type: "bytes32", indexed: true },
      { name: "reason", type: "string", indexed: false },
    ],
  },
] as const;

type TracePush = {
  t?: number;
  result?: { topics?: readonly Hex[]; data?: Hex; simulationResults?: readonly Hex[] };
  error?: string;
};

/** Turn a WebSocket JSON line into a short human-readable summary when it is a known Mesh log. */
export function formatTraceLine(jsonStr: string): string {
  let o: TracePush;
  try {
    o = JSON.parse(jsonStr) as TracePush;
  } catch {
    return jsonStr;
  }
  if (o.error) return `error · ${o.error}`;
  const topics = o.result?.topics;
  const data = o.result?.data ?? "0x";
  if (!topics?.length) return jsonStr;

  try {
    const decoded = decodeEventLog({
      abi: meshTraceAbi,
      data,
      topics: [...topics] as [Hex, ...Hex[]],
      strict: false,
    });
    if (decoded.eventName === "WorkflowStepExecuted") {
      const { workflowId, nodeId, timestamp } = decoded.args as {
        workflowId: Hex;
        nodeId: Hex;
        timestamp: bigint;
      };
      return `WorkflowStepExecuted · wf=${workflowId} · step=${nodeId} · ts=${timestamp.toString()}`;
    }
    if (decoded.eventName === "WorkflowNoOp") {
      const { workflowId, nodeId, reason } = decoded.args as {
        workflowId: Hex;
        nodeId: Hex;
        reason: string;
      };
      return `WorkflowNoOp · wf=${workflowId} · step=${nodeId} · ${reason}`;
    }
  } catch {
    /* not a Mesh trace event */
  }

  const sim = o.result?.simulationResults?.length
    ? ` · ${o.result.simulationResults.length} simulationResults`
    : "";
  return `log · topics=${topics.length}${sim}\n${jsonStr}`;
}
