import type { Edge, Node } from "reactflow";
import type { WorkflowDefinition, WorkflowEdgeDef, WorkflowNodeDef } from "./dsl";
import type { MeshStepData } from "./meshStepData";
import { WORKFLOW_START_NODE_ID } from "./meshStepData";

export class GraphExportError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = "GraphExportError";
  }
}

function isStepNode(n: Node): n is Node<MeshStepData> {
  return n.type === "meshStep" && n.id !== WORKFLOW_START_NODE_ID;
}

/** For UI (e.g. hybrid panel): which canvas step id is the DAG root, if unambiguous. */
export function findRootDomId(nodes: Node[], edges: Edge[]): string | null {
  const steps = nodes.filter(isStepNode);
  if (steps.length === 0) return null;
  const stepIds = new Set(steps.map((s) => s.id));
  const fromStart = edges.filter((e) => e.source === WORKFLOW_START_NODE_ID && stepIds.has(e.target));
  if (fromStart.length !== 1) return null;
  const rootDomId = fromStart[0]!.target;
  const indeg = new Map<string, number>();
  for (const s of steps) indeg.set(s.id, 0);
  for (const e of edges) {
    if (e.source === WORKFLOW_START_NODE_ID || e.target === WORKFLOW_START_NODE_ID) continue;
    if (!stepIds.has(e.source) || !stepIds.has(e.target)) continue;
    indeg.set(e.target, (indeg.get(e.target) ?? 0) + 1);
  }
  const roots = steps.filter((s) => (indeg.get(s.id) ?? 0) === 0);
  if (roots.length !== 1 || roots[0]!.id !== rootDomId) return null;
  return rootDomId;
}

function buildTrigger(d: MeshStepData): WorkflowNodeDef["trigger"] {
  if (d.triggerType === "event") {
    return {
      type: "event",
      emitter: d.emitter.trim(),
      eventTopic0: d.eventTopic0.trim(),
    };
  }
  if (d.triggerType === "cron:block") {
    const bn = d.blockNumber.trim();
    if (!bn) return { type: "cron:block" };
    const n = Number(bn);
    if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) {
      throw new GraphExportError("Block tick: blockNumber must be a non-negative integer", "BAD_BLOCK");
    }
    return { type: "cron:block", blockNumber: n };
  }
  const ms = Number(d.timestampMs);
  if (!Number.isFinite(ms)) {
    throw new GraphExportError("Schedule trigger: invalid timestampMs", "BAD_TIMESTAMP");
  }
  return { type: "cron:timestamp", timestampMs: Math.round(ms) };
}

function buildAction(d: MeshStepData): WorkflowNodeDef["action"] {
  if (d.actionType === "noop") return { type: "noop" };
  if (d.actionType === "call") {
    return {
      type: "call",
      target: d.callTarget.trim(),
      data: d.callData.trim() || "0x",
    };
  }
  return {
    type: "emit",
    eventSig: d.emitEventSig.trim(),
    payload: d.emitPayload.trim() || "0x",
  };
}

/**
 * Convert React Flow canvas state → `WorkflowDefinition` for `POST /workflows/*`.
 * Expects a fixed start node id {@link WORKFLOW_START_NODE_ID} and `meshStep` nodes.
 */
export function graphToWorkflowDefinition(
  nodes: Node[],
  edges: Edge[],
  workflowId: string,
  workflowName: string,
): WorkflowDefinition {
  const id = workflowId.trim();
  const name = workflowName.trim();
  if (!id) throw new GraphExportError("Workflow id is required", "EMPTY_ID");
  if (!name) throw new GraphExportError("Workflow name is required", "EMPTY_NAME");

  const steps = nodes.filter(isStepNode);
  if (steps.length === 0) {
    throw new GraphExportError("Add at least one step from the library", "NO_STEPS");
  }

  const stepIds = new Set(steps.map((s) => s.id));
  const dslIds = new Set<string>();
  for (const s of steps) {
    const dsl = (s.data as MeshStepData).dslId?.trim();
    if (!dsl) throw new GraphExportError(`Step ${s.id}: DSL id is empty`, "EMPTY_DSL_ID");
    if (dslIds.has(dsl)) throw new GraphExportError(`Duplicate DSL node id: ${dsl}`, "DUP_DSL_ID");
    dslIds.add(dsl);
  }

  const fromStart = edges.filter((e) => e.source === WORKFLOW_START_NODE_ID && stepIds.has(e.target));
  if (fromStart.length === 0) {
    throw new GraphExportError("Connect the green Start node to your first step", "NO_START_EDGE");
  }
  if (fromStart.length > 1) {
    throw new GraphExportError("Start node must connect to exactly one first step", "MULTI_ROOT");
  }
  const rootDomId = fromStart[0]!.target;

  const stepEdges: WorkflowEdgeDef[] = [];
  for (const e of edges) {
    if (e.source === WORKFLOW_START_NODE_ID || e.target === WORKFLOW_START_NODE_ID) continue;
    if (!stepIds.has(e.source) || !stepIds.has(e.target)) continue;
    const from = (nodes.find((n) => n.id === e.source)?.data as MeshStepData).dslId.trim();
    const to = (nodes.find((n) => n.id === e.target)?.data as MeshStepData).dslId.trim();
    stepEdges.push({ from, to, label: e.data?.label as string | undefined });
  }

  const indeg = new Map<string, number>();
  for (const s of steps) indeg.set(s.id, 0);
  for (const e of edges) {
    if (e.source === WORKFLOW_START_NODE_ID || e.target === WORKFLOW_START_NODE_ID) continue;
    if (!stepIds.has(e.source) || !stepIds.has(e.target)) continue;
    indeg.set(e.target, (indeg.get(e.target) ?? 0) + 1);
  }

  const roots = steps.filter((s) => (indeg.get(s.id) ?? 0) === 0);
  if (roots.length !== 1) {
    throw new GraphExportError(
      roots.length === 0
        ? "Invalid graph: no root step (cycle or missing links)"
        : "Exactly one step must have no incoming links from other steps (single DAG root)",
      "ROOT_COUNT",
    );
  }
  if (roots[0]!.id !== rootDomId) {
    throw new GraphExportError(
      "The step connected from Start must be the only step with no incoming step-to-step edges",
      "START_NOT_ROOT",
    );
  }

  const rootDomIdResolved = roots[0]!.id;
  const adj = new Map<string, string[]>();
  for (const s of steps) adj.set(s.id, []);
  for (const e of edges) {
    if (e.source === WORKFLOW_START_NODE_ID || e.target === WORKFLOW_START_NODE_ID) continue;
    if (!stepIds.has(e.source) || !stepIds.has(e.target)) continue;
    adj.get(e.source)!.push(e.target);
  }
  const seen = new Set<string>();
  const q = [rootDomIdResolved];
  while (q.length) {
    const u = q.shift()!;
    if (seen.has(u)) continue;
    seen.add(u);
    for (const v of adj.get(u) ?? []) q.push(v);
  }
  if (seen.size !== steps.length) {
    throw new GraphExportError("All steps must be reachable from the first step", "UNREACHABLE");
  }

  const wfNodes: WorkflowNodeDef[] = steps.map((s) => {
    const d = s.data as MeshStepData;
    const node: WorkflowNodeDef = {
      id: d.dslId.trim(),
      name: d.name?.trim() || d.dslId.trim(),
      trigger: buildTrigger(d),
      action: buildAction(d),
    };

    const isRoot = s.id === rootDomIdResolved;
    if (isRoot && d.hybridEnabled) {
      const to = d.hybridEthCallTo.trim();
      const data = d.hybridEthCallData.trim() || "0x";
      node.ethCalls = [{ to, data }];

      if (d.hybridUseTree) {
        const clauses = [
          {
            simulationResultIndex: d.hybridSimIndex,
            op: d.hybridOp,
            compareDecimal: d.hybridCompareDecimal.trim(),
            description: "Clause 1",
          },
        ];
        if (d.hybridTreeClause2Enabled) {
          clauses.push({
            simulationResultIndex: d.hybridSimIndex,
            op: d.hybridTreeOp2,
            compareDecimal: d.hybridTreeCompare2.trim(),
            description: "Clause 2",
          });
        }
        node.conditionTree = { combinator: d.hybridTreeCombinator, clauses };
      } else {
        node.condition = {
          simulationResultIndex: d.hybridSimIndex,
          op: d.hybridOp,
          compareDecimal: d.hybridCompareDecimal.trim(),
          description: "Hybrid condition",
        };
      }
    }

    return node;
  });

  const rootData = roots[0]!.data as MeshStepData;
  const hookUrl = rootData.onPassWebhookUrl.trim();
  const evaluationHooks =
    rootData.hybridEnabled && hookUrl ? { onPass: [{ type: "webhook" as const, url: hookUrl }] } : undefined;

  const def: WorkflowDefinition = { id, name, nodes: wfNodes, edges: stepEdges };
  if (evaluationHooks) def.evaluationHooks = evaluationHooks;

  return def;
}

function topoSortIds(def: WorkflowDefinition): string[] {
  const ids = new Set(def.nodes.map((n) => n.id));
  const indeg = new Map<string, number>();
  for (const n of def.nodes) indeg.set(n.id, 0);
  for (const e of def.edges ?? []) {
    if (ids.has(e.from) && ids.has(e.to)) indeg.set(e.to, (indeg.get(e.to) ?? 0) + 1);
  }
  const q: string[] = [];
  for (const n of def.nodes) if ((indeg.get(n.id) ?? 0) === 0) q.push(n.id);
  const topo: string[] = [];
  while (q.length) {
    const u = q.shift()!;
    topo.push(u);
    for (const e of def.edges ?? []) {
      if (e.from !== u) continue;
      const v = e.to;
      const next = (indeg.get(v) ?? 0) - 1;
      indeg.set(v, next);
      if (next === 0) q.push(v);
    }
  }
  if (topo.length !== def.nodes.length) return def.nodes.map((n) => n.id);
  return topo;
}

function firstWebhookUrl(def: WorkflowDefinition): string {
  const hooks = def.evaluationHooks?.onPass;
  if (!hooks) return "";
  const w = hooks.find((h) => h.type === "webhook");
  return w && w.type === "webhook" ? w.url : "";
}

/**
 * Load a `WorkflowDefinition` onto the canvas: start node + mesh steps + edges.
 */
export function workflowDefinitionToGraph(def: WorkflowDefinition): { nodes: Node[]; edges: Edge[] } {
  const start: Node = {
    id: WORKFLOW_START_NODE_ID,
    type: "meshStart",
    position: { x: 80, y: 160 },
    data: { label: "Start" },
    draggable: true,
    deletable: false,
  };

  const topo = topoSortIds(def);
  const byId = new Map(def.nodes.map((n) => [n.id, n] as const));
  const domByDsl = new Map<string, string>();
  const webhook = firstWebhookUrl(def);

  const stepNodes: Node<MeshStepData>[] = topo.map((dslId, i) => {
    const n = byId.get(dslId);
    if (!n) throw new Error(`Missing node ${dslId}`);
    const domId = `mesh-step-import-${i}-${dslId.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
    domByDsl.set(dslId, domId);
    return {
      id: domId,
      type: "meshStep",
      position: { x: 280 + i * 260, y: 140 },
      data: meshStepDataFromWorkflowNode(n, dslId === topo[0], webhook),
    };
  });

  const nodesOut: Node[] = [start, ...stepNodes];
  const edgesOut: Edge[] = [];
  if (topo[0]) {
    edgesOut.push({
      id: `e-start-${domByDsl.get(topo[0]!)}`,
      source: WORKFLOW_START_NODE_ID,
      target: domByDsl.get(topo[0]!)!,
      type: "meshCustom",
    });
  }
  for (const e of def.edges ?? []) {
    const s = domByDsl.get(e.from);
    const t = domByDsl.get(e.to);
    if (!s || !t) continue;
    edgesOut.push({
      id: `e-${s}-${t}`,
      source: s,
      target: t,
      type: "meshCustom",
    });
  }

  return { nodes: nodesOut, edges: edgesOut };
}

function meshStepDataFromWorkflowNode(n: WorkflowNodeDef, isRoot: boolean, rootWebhook: string): MeshStepData {
  const triggerType = n.trigger.type as MeshStepData["triggerType"];
  return {
    name: n.name?.trim() || n.id,
    dslId: n.id,
    triggerType,
    emitter: n.trigger.type === "event" ? n.trigger.emitter : "0x0000000000000000000000000000000000000001",
    eventTopic0:
      n.trigger.type === "event"
        ? n.trigger.eventTopic0
        : "0x48257dc961b6f792c2b78a080dacfed693b660960a702de21cee364e20270e2f",
    blockNumber:
      n.trigger.type === "cron:block" && n.trigger.blockNumber != null ? String(n.trigger.blockNumber) : "",
    timestampMs:
      n.trigger.type === "cron:timestamp" ? String(n.trigger.timestampMs) : String(Date.now() + 120_000),
    actionType: n.action.type as MeshStepData["actionType"],
    callTarget: n.action.type === "call" ? n.action.target : "0x0000000000000000000000000000000000000001",
    callData: n.action.type === "call" ? n.action.data : "0x",
    emitEventSig: n.action.type === "emit" ? n.action.eventSig : "Notify(uint256)",
    emitPayload: n.action.type === "emit" ? n.action.payload : "0x",
    hybridEnabled: isRoot && Boolean(n.ethCalls?.length || n.condition || n.conditionTree),
    hybridEthCallTo: n.ethCalls?.[0]?.to ?? "0x0000000000000000000000000000000000000001",
    hybridEthCallData: n.ethCalls?.[0]?.data ?? "0x",
    hybridUseTree: Boolean(n.conditionTree),
    hybridOp: (n.condition?.op ?? n.conditionTree?.clauses[0]?.op ?? "uint256Gt") as MeshStepData["hybridOp"],
    hybridCompareDecimal: n.condition?.compareDecimal ?? n.conditionTree?.clauses[0]?.compareDecimal ?? "0",
    hybridSimIndex: n.condition?.simulationResultIndex ?? n.conditionTree?.clauses[0]?.simulationResultIndex ?? 0,
    hybridTreeCombinator: n.conditionTree?.combinator ?? "all",
    hybridTreeClause2Enabled: Boolean(n.conditionTree && n.conditionTree.clauses.length > 1),
    hybridTreeOp2: (n.conditionTree?.clauses[1]?.op ?? "uint256Gte") as MeshStepData["hybridTreeOp2"],
    hybridTreeCompare2: n.conditionTree?.clauses[1]?.compareDecimal ?? "0",
    onPassWebhookUrl: isRoot ? rootWebhook : "",
  };
}
