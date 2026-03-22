import type { WorkflowDefinition } from "./types.js";

/** Ensures every node has a non-empty `name` (falls back to trimmed `id`). Pure / idempotent. */
export function normalizeWorkflowDefinition(def: WorkflowDefinition): WorkflowDefinition {
  return {
    ...def,
    nodes: def.nodes.map((n) => ({
      ...n,
      name: n.name?.trim() || n.id?.trim() || "",
    })),
  };
}

export class WorkflowValidationError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = "WorkflowValidationError";
  }
}

/** DAG checks only — ABI/topic/calldata validation comes with the compiler. */
export function validateWorkflowDefinition(input: WorkflowDefinition): void {
  const def = normalizeWorkflowDefinition(input);
  if (!def.id?.trim()) throw new WorkflowValidationError("workflow id required", "EMPTY_ID");
  if (!def.name?.trim()) throw new WorkflowValidationError("workflow name required", "EMPTY_NAME");
  if (!def.nodes?.length) throw new WorkflowValidationError("at least one node required", "NO_NODES");

  const ids = new Set<string>();
  for (const n of def.nodes) {
    if (!n.id?.trim()) throw new WorkflowValidationError("node id required", "EMPTY_NODE_ID");
    if (!n.name?.trim()) throw new WorkflowValidationError(`node ${n.id}: name required`, "EMPTY_NODE_NAME");
    if (ids.has(n.id)) throw new WorkflowValidationError(`duplicate node id: ${n.id}`, "DUP_NODE");
    ids.add(n.id);
    if (!n.trigger) throw new WorkflowValidationError(`node ${n.id}: trigger required`, "NO_TRIGGER");
    if (!n.action) throw new WorkflowValidationError(`node ${n.id}: action required`, "NO_ACTION");
  }

  for (const e of def.edges ?? []) {
    if (!ids.has(e.from)) throw new WorkflowValidationError(`edge unknown from: ${e.from}`, "BAD_EDGE_FROM");
    if (!ids.has(e.to)) throw new WorkflowValidationError(`edge unknown to: ${e.to}`, "BAD_EDGE_TO");
  }

  const adj = new Map<string, string[]>();
  for (const id of ids) adj.set(id, []);
  for (const e of def.edges ?? []) adj.get(e.from)!.push(e.to);

  const indeg = new Map<string, number>();
  for (const id of ids) indeg.set(id, 0);
  for (const e of def.edges ?? []) indeg.set(e.to, (indeg.get(e.to) ?? 0) + 1);

  const q: string[] = [];
  for (const id of ids) if ((indeg.get(id) ?? 0) === 0) q.push(id);

  let seen = 0;
  while (q.length) {
    const u = q.shift()!;
    seen++;
    for (const v of adj.get(u) ?? []) {
      const next = (indeg.get(v) ?? 0) - 1;
      indeg.set(v, next);
      if (next === 0) q.push(v);
    }
  }
  if (seen !== ids.size) {
    throw new WorkflowValidationError("workflow graph must be acyclic (DAG)", "CYCLE");
  }
}
