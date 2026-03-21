/** Normalize `workflowId` query for `/ws/trace` (bytes32 hex). */
export function normalizeTraceWorkflowIdFilter(raw: string | undefined | null): `0x${string}` | null {
  if (raw === undefined || raw === null) return null;
  const t = raw.trim();
  if (!t.startsWith("0x") || t.length !== 66) return null;
  if (!/^0x[0-9a-fA-F]{64}$/.test(t)) return null;
  return t.toLowerCase() as `0x${string}`;
}

export type TraceWsClient = {
  send: (s: string) => void;
  close: () => void;
  /** When set, only `WorkflowStepExecuted` / `WorkflowNoOp`-style pushes where `topics[1]` equals this id. */
  workflowIdFilter: `0x${string}` | null;
};
