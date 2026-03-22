/** HTTP Workflow Manager API (Fastify backend). */
export function meshApiBase(): string {
  return (process.env.NEXT_PUBLIC_MESH_API ?? "http://127.0.0.1:8787").replace(/\/$/, "");
}

/** Shannon testnet explorer (Blockscout). Override with `NEXT_PUBLIC_SHANNON_EXPLORER`. */
export function shannonExplorerBase(): string {
  return (process.env.NEXT_PUBLIC_SHANNON_EXPLORER ?? "https://shannon-explorer.somnia.network").replace(/\/$/, "");
}

export function shannonExplorerAddressUrl(address: string): string {
  const a = address.trim();
  if (!/^0x[a-fA-F0-9]{40}$/.test(a)) return shannonExplorerBase();
  return `${shannonExplorerBase()}/address/${a}`;
}

export function shannonExplorerTxUrl(txHash: string): string {
  const h = txHash.trim();
  if (!/^0x[a-fA-F0-9]{64}$/.test(h)) return shannonExplorerBase();
  return `${shannonExplorerBase()}/tx/${h}`;
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
