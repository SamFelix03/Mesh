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
  tracePull?: boolean;
};

export type TraceSource = "ws" | "http";

export type ParsedTraceRow =
  | {
      kind: "WorkflowStepExecuted";
      workflowId: Hex;
      nodeId: Hex;
      timestamp: string;
      receivedAtMs?: number;
      source: TraceSource;
    }
  | {
      kind: "WorkflowNoOp";
      workflowId: Hex;
      nodeId: Hex;
      reason: string;
      receivedAtMs?: number;
      source: TraceSource;
    }
  | { kind: "error"; message: string; receivedAtMs?: number }
  | { kind: "other"; title: string; detail?: string; raw: string };

export function shortHex(hex: string, lead = 8, tail = 6): string {
  const h = hex.trim();
  if (!h.startsWith("0x") || h.length <= 2 + lead + tail) return h;
  return `${h.slice(0, 2 + lead)}…${h.slice(-tail)}`;
}

/** Format on-chain `block.timestamp`-style uint as local time when it fits safely in JS `Date`. */
export function formatChainTimestamp(secondsOrMs: string): { label: string; sub?: string } {
  const n = BigInt(secondsOrMs);
  const maxSafe = BigInt(Number.MAX_SAFE_INTEGER);
  if (n > maxSafe) {
    return { label: `${secondsOrMs} (raw)` };
  }
  const num = Number(n);
  // Heuristic: chain timestamps are unix seconds (< year 2100 in seconds)
  const asSec = num < 1e11 ? num * 1000 : num;
  const d = new Date(asSec);
  if (Number.isNaN(d.getTime())) {
    return { label: secondsOrMs };
  }
  return {
    label: d.toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "medium",
    }),
    sub: `${secondsOrMs} ${num < 1e11 ? "unix s" : "ms"}`,
  };
}

/** Structured parse for UI cards (and one-line fallback via {@link formatTraceLine}). */
export function parseTraceMessage(jsonStr: string): ParsedTraceRow {
  let o: TracePush;
  try {
    o = JSON.parse(jsonStr) as TracePush;
  } catch {
    return { kind: "other", title: "Raw message", raw: jsonStr };
  }
  const source: TraceSource = o.tracePull ? "http" : "ws";
  const receivedAtMs = o.t;

  if (o.error) {
    return { kind: "error", message: o.error, receivedAtMs };
  }

  const topics = o.result?.topics;
  const data = o.result?.data ?? "0x";
  if (!topics?.length) {
    return { kind: "other", title: "Empty topics", raw: jsonStr };
  }

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
      return {
        kind: "WorkflowStepExecuted",
        workflowId,
        nodeId,
        timestamp: timestamp.toString(),
        receivedAtMs,
        source,
      };
    }
    if (decoded.eventName === "WorkflowNoOp") {
      const { workflowId, nodeId, reason } = decoded.args as {
        workflowId: Hex;
        nodeId: Hex;
        reason: string;
      };
      return {
        kind: "WorkflowNoOp",
        workflowId,
        nodeId,
        reason,
        receivedAtMs,
        source,
      };
    }
  } catch {
    /* fall through */
  }

  const sim = o.result?.simulationResults?.length
    ? `${o.result.simulationResults.length} simulationResults`
    : undefined;
  return {
    kind: "other",
    title: `Log · ${topics.length} topic(s)`,
    detail: sim,
    raw: jsonStr,
  };
}

/** One-line summary (e.g. logs, tests). */
export function formatTraceLine(jsonStr: string): string {
  const row = parseTraceMessage(jsonStr);
  if (row.kind === "error") return `error · ${row.message}`;
  if (row.kind === "WorkflowStepExecuted") {
    const ts = formatChainTimestamp(row.timestamp);
    const recv = row.receivedAtMs != null ? ` · recvMs=${row.receivedAtMs}` : "";
    const src = row.source === "http" ? " · source=http" : "";
    return `WorkflowStepExecuted · wf=${row.workflowId} · step=${row.nodeId} · ts=${ts.label}${recv}${src}`;
  }
  if (row.kind === "WorkflowNoOp") {
    const recv = row.receivedAtMs != null ? ` · recvMs=${row.receivedAtMs}` : "";
    const src = row.source === "http" ? " · source=http" : "";
    return `WorkflowNoOp · wf=${row.workflowId} · step=${row.nodeId} · ${row.reason}${recv}${src}`;
  }
  if (row.detail) return `${row.title} · ${row.detail}\n${row.raw}`;
  return row.raw;
}
