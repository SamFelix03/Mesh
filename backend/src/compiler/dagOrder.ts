import type { WorkflowDefinition } from "../dsl/types.js";
import { WorkflowValidationError } from "../dsl/validateWorkflow.js";

/** Deterministic Kahn topological order (lexicographic tie-break on id). */
export function topologicalSortIds(def: WorkflowDefinition): string[] {
  const ids = new Set(def.nodes.map((n) => n.id));
  const adj = new Map<string, string[]>();
  for (const id of ids) adj.set(id, []);
  for (const e of def.edges ?? []) adj.get(e.from)!.push(e.to);

  const indeg = new Map<string, number>();
  for (const id of ids) indeg.set(id, 0);
  for (const e of def.edges ?? []) indeg.set(e.to, (indeg.get(e.to) ?? 0) + 1);

  const q = [...ids].filter((id) => (indeg.get(id) ?? 0) === 0).sort((a, b) => a.localeCompare(b));
  const order: string[] = [];

  while (q.length) {
    q.sort((a, b) => a.localeCompare(b));
    const u = q.shift()!;
    order.push(u);
    const outs = [...(adj.get(u) ?? [])].sort((a, b) => a.localeCompare(b));
    for (const v of outs) {
      const next = (indeg.get(v) ?? 0) - 1;
      indeg.set(v, next);
      if (next === 0) q.push(v);
    }
  }

  if (order.length !== ids.size) {
    throw new WorkflowValidationError("workflow graph must be acyclic (DAG)", "CYCLE");
  }
  return order;
}

export function findSingleRootId(def: WorkflowDefinition): string {
  const ids = new Set(def.nodes.map((n) => n.id));
  const indeg = new Map<string, number>();
  for (const id of ids) indeg.set(id, 0);
  for (const e of def.edges ?? []) indeg.set(e.to, (indeg.get(e.to) ?? 0) + 1);

  const roots = [...ids].filter((id) => (indeg.get(id) ?? 0) === 0).sort((a, b) => a.localeCompare(b));
  if (roots.length !== 1) {
    throw new WorkflowValidationError(
      `compiler requires exactly one root (indegree 0); found ${roots.length}: ${roots.join(", ") || "(none)"}`,
      "ROOT_COUNT",
    );
  }
  return roots[0]!;
}

export function orderWithRootFirst(def: WorkflowDefinition, rootId: string): string[] {
  const topo = topologicalSortIds(def);
  const candidate = [rootId, ...topo.filter((id) => id !== rootId)];
  const pos = new Map(candidate.map((id, i) => [id, i]));
  for (const e of def.edges ?? []) {
    const a = pos.get(e.from) ?? -1;
    const b = pos.get(e.to) ?? -1;
    if (a >= b) {
      throw new WorkflowValidationError(
        `cannot order DAG with root "${rootId}" first: violates edge ${e.from} → ${e.to}`,
        "TOPO_ROOT",
      );
    }
  }
  return candidate;
}

export function assertAllReachableFromRoot(def: WorkflowDefinition, rootId: string): void {
  const children = new Map<string, string[]>();
  for (const n of def.nodes) children.set(n.id, []);
  for (const e of def.edges ?? []) children.get(e.from)!.push(e.to);

  const seen = new Set<string>();
  const st = [rootId];
  while (st.length) {
    const u = st.pop()!;
    if (seen.has(u)) continue;
    seen.add(u);
    for (const v of children.get(u) ?? []) st.push(v);
  }
  if (seen.size !== def.nodes.length) {
    throw new WorkflowValidationError(
      "every node must be reachable from the unique root via edges",
      "UNREACHABLE",
    );
  }
}
