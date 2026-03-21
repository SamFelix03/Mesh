/** HTTP Workflow Manager API (Fastify backend). */
export function meshApiBase(): string {
  return (process.env.NEXT_PUBLIC_MESH_API ?? "http://127.0.0.1:8787").replace(/\/$/, "");
}

/**
 * WebSocket URL for trace stream (`/ws/trace`).
 * Pass resolved on-chain `workflowId` (bytes32 hex) to filter server-side to that workflow’s `WorkflowStepExecuted` / `WorkflowNoOp` logs.
 */
export function meshTraceWebSocketUrl(workflowIdBytes32?: string): string {
  const u = new URL(meshApiBase());
  u.protocol = u.protocol === "https:" ? "wss:" : "ws:";
  u.pathname = "/ws/trace";
  u.search = "";
  if (workflowIdBytes32?.trim()) {
    u.searchParams.set("workflowId", workflowIdBytes32.trim());
  }
  u.hash = "";
  return u.toString();
}

/** Hybrid evaluation stream (`/ws/evaluation`) — requires `EVALUATION_ENGINE=1` on the API. */
export function meshEvaluationWebSocketUrl(workflowIdBytes32?: string): string {
  const u = new URL(meshApiBase());
  u.protocol = u.protocol === "https:" ? "wss:" : "ws:";
  u.pathname = "/ws/evaluation";
  u.search = "";
  if (workflowIdBytes32?.trim()) {
    u.searchParams.set("workflowId", workflowIdBytes32.trim());
  }
  u.hash = "";
  return u.toString();
}
