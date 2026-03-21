"use client";

import type React from "react";
import { useCallback, useMemo, useRef, useState } from "react";
import Link from "next/link";
import ReactFlow, {
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  Panel,
  addEdge,
  useNodesState,
  useEdgesState,
  type Connection,
  type Edge,
  type Node,
  type NodeTypes,
  type EdgeTypes,
  type OnNodesChange,
} from "reactflow";
import "reactflow/dist/style.css";

import { meshApiBase } from "@/lib/meshConfig";
import { createMeshStepNode, WORKFLOW_START_NODE_ID } from "@/lib/workflowBuilder/meshStepData";
import {
  graphToWorkflowDefinition,
  workflowDefinitionToGraph,
  findRootDomId,
  GraphExportError,
} from "@/lib/workflowBuilder/graphToWorkflowDefinition";
import type { WorkflowDefinition } from "@/lib/workflowBuilder/dsl";
import MeshNodeLibrary from "./MeshNodeLibrary";
import MeshNodeConfigPanel from "./MeshNodeConfigPanel";
import MeshCustomEdge from "./MeshCustomEdge";
import { MeshStartNode, type MeshStartNodeData } from "./MeshStartNode";
import { MeshStepNode } from "./MeshStepNode";
import type { MeshStepData } from "@/lib/workflowBuilder/meshStepData";
import { ArrowLeft, CheckCircle2, Copy, Download, Loader2, Upload } from "lucide-react";

const nodeTypes: NodeTypes = {
  meshStart: MeshStartNode,
  meshStep: MeshStepNode,
};

const edgeTypes: EdgeTypes = {
  meshCustom: MeshCustomEdge,
};

const defaultEdgeOptions = { type: "meshCustom" as const };
const snapGridTuple: [number, number] = [16, 16];
const reactFlowProOptions = { hideAttribution: true as const };

function createStartNode(): Node<MeshStartNodeData> {
  return {
    id: WORKFLOW_START_NODE_ID,
    type: "meshStart",
    position: { x: 120, y: 200 },
    data: { label: "Start" },
    draggable: true,
    deletable: false,
  };
}

function definitionNeedsHybrid(def: WorkflowDefinition): boolean {
  const nodesHybrid = def.nodes.some(
    (n) => (n.ethCalls?.length ?? 0) > 0 || n.condition != null || n.conditionTree != null,
  );
  const hooks = (def.evaluationHooks?.onPass?.length ?? 0) > 0;
  return nodesHybrid || hooks;
}

export default function MeshWorkflowBuilder() {
  const wrapper = useRef<HTMLDivElement>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState([createStartNode()]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [rf, setRf] = useState<unknown>(null);
  const [selected, setSelected] = useState<Node | null>(null);
  const [workflowId, setWorkflowId] = useState("builder-workflow-1");
  const [workflowName, setWorkflowName] = useState("My workflow");
  const [deployMode, setDeployMode] = useState<"executor" | "perNodeFanout">("executor");
  const [jsonImport, setJsonImport] = useState("");
  const [banner, setBanner] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [loading, setLoading] = useState<null | "validate" | "compile" | "deploy">(null);

  const showBanner = useCallback((type: "ok" | "err", text: string) => {
    setBanner({ type, text });
    setTimeout(() => setBanner(null), 8000);
  }, []);

  const handleNodesChange: OnNodesChange = useCallback(
    (changes) => {
      const filtered = changes.filter((ch) => !(ch.type === "remove" && ch.id === WORKFLOW_START_NODE_ID));
      onNodesChange(filtered);
    },
    [onNodesChange],
  );

  const onConnect = useCallback(
    (params: Connection | Edge) => setEdges((eds) => addEdge({ ...params, type: "meshCustom" }, eds)),
    [setEdges],
  );

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const type = e.dataTransfer.getData("application/reactflow");
      if (type !== "meshStep" || !wrapper.current || !rf) return;
      const bounds = wrapper.current.getBoundingClientRect();
      const inst = rf as { screenToFlowPosition: (p: { x: number; y: number }) => { x: number; y: number } };
      const position = inst.screenToFlowPosition({
        x: e.clientX - bounds.left,
        y: e.clientY - bounds.top,
      });
      const newNode = createMeshStepNode(position);
      setEdges((eds) => {
        const hasStartEdge = eds.some((ed) => ed.source === WORKFLOW_START_NODE_ID);
        if (!hasStartEdge) {
          return [
            ...eds,
            {
              id: `e-start-${newNode.id}`,
              source: WORKFLOW_START_NODE_ID,
              target: newNode.id,
              type: "meshCustom",
            },
          ];
        }
        return eds;
      });
      setNodes((nds) => nds.concat(newNode));
    },
    [rf, setNodes, setEdges],
  );

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => setSelected(node), []);
  const onPaneClick = useCallback(() => setSelected(null), []);

  const updateNodeData = useCallback(
    (nodeId: string, data: Partial<MeshStepData>) => {
      setNodes((nds) =>
        nds.map((n) => (n.id === nodeId ? { ...n, data: { ...(n.data as MeshStepData), ...data } } : n)),
      );
    },
    [setNodes],
  );

  const rootDomId = useMemo(() => findRootDomId(nodes, edges), [nodes, edges]);

  const exportedDefinition = useMemo((): WorkflowDefinition | null => {
    try {
      return graphToWorkflowDefinition(nodes, edges, workflowId, workflowName);
    } catch {
      return null;
    }
  }, [nodes, edges, workflowId, workflowName]);

  const jsonPretty = useMemo(() => (exportedDefinition ? JSON.stringify(exportedDefinition, null, 2) : ""), [exportedDefinition]);

  const copyJson = useCallback(async () => {
    if (!jsonPretty) {
      showBanner("err", "Fix the graph before exporting (see validation hints).");
      return;
    }
    try {
      await navigator.clipboard.writeText(jsonPretty);
      showBanner("ok", "JSON copied to clipboard.");
    } catch {
      showBanner("err", "Could not copy to clipboard.");
    }
  }, [jsonPretty, showBanner]);

  const downloadJson = useCallback(() => {
    if (!exportedDefinition) return;
    const blob = new Blob([JSON.stringify(exportedDefinition, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${workflowId.replace(/[^a-zA-Z0-9_-]/g, "_")}.workflow.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }, [exportedDefinition, workflowId]);

  const applyImport = useCallback(() => {
    let def: WorkflowDefinition;
    try {
      def = JSON.parse(jsonImport) as WorkflowDefinition;
    } catch {
      showBanner("err", "Invalid JSON.");
      return;
    }
    if (!def?.nodes?.length) {
      showBanner("err", "JSON must be a WorkflowDefinition with nodes[].");
      return;
    }
    try {
      const { nodes: n, edges: ed } = workflowDefinitionToGraph(def);
      setNodes(n);
      setEdges(ed);
      setWorkflowId(def.id);
      setWorkflowName(def.name);
      setSelected(null);
      showBanner("ok", "Imported workflow onto canvas.");
      setTimeout(() => {
        const inst = rf as { fitView?: (o: { padding: number }) => void } | null;
        inst?.fitView?.({ padding: 0.2 });
      }, 100);
    } catch (e) {
      showBanner("err", e instanceof Error ? e.message : "Import failed.");
    }
  }, [jsonImport, setNodes, setEdges, rf, showBanner]);

  const postDefinition = useCallback(
    async (path: string, extra: Record<string, unknown> = {}) => {
      if (!exportedDefinition) {
        const msg =
          graphTryError(nodes, edges, workflowId, workflowName) ?? "Build a valid graph first.";
        showBanner("err", msg);
        return null;
      }
      const base = meshApiBase();
      const r = await fetch(`${base}${path}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ definition: exportedDefinition, ...extra }),
      });
      const text = await r.text();
      let body: unknown;
      try {
        body = text ? JSON.parse(text) : null;
      } catch {
        body = text;
      }
      if (!r.ok) {
        const err =
          typeof body === "object" && body && "error" in body ? String((body as { error: string }).error) : r.statusText;
        throw new Error(err);
      }
      return body;
    },
    [exportedDefinition, nodes, edges, workflowId, workflowName, showBanner],
  );

  const runValidate = useCallback(async () => {
    setLoading("validate");
    try {
      const def = requireDef(exportedDefinition, nodes, edges, workflowId, workflowName, showBanner);
      const forHybrid = definitionNeedsHybrid(def);
      await postDefinition("/workflows/validate", {
        forCompiler: true,
        ...(forHybrid ? { forHybrid: true } : {}),
      });
      showBanner("ok", forHybrid ? "Valid for compiler + hybrid." : "Valid for compiler.");
    } catch (e) {
      showBanner("err", e instanceof Error ? e.message : "Validate failed.");
    } finally {
      setLoading(null);
    }
  }, [exportedDefinition, postDefinition, showBanner, nodes, edges, workflowId, workflowName]);

  const runCompile = useCallback(async () => {
    setLoading("compile");
    try {
      requireDef(exportedDefinition, nodes, edges, workflowId, workflowName, showBanner);
      const body = await postDefinition("/workflows/compile", { deployMode });
      showBanner("ok", `Compile OK (${deployMode}). See browser console for plan.`);
      console.log("[mesh compile]", body);
    } catch (e) {
      showBanner("err", e instanceof Error ? e.message : "Compile failed.");
    } finally {
      setLoading(null);
    }
  }, [exportedDefinition, postDefinition, showBanner, deployMode, nodes, edges, workflowId, workflowName]);

  const runDeploy = useCallback(async () => {
    setLoading("deploy");
    try {
      requireDef(exportedDefinition, nodes, edges, workflowId, workflowName, showBanner);
      const body = (await postDefinition("/workflows/from-definition", { deployMode })) as {
        workflowId?: string;
      } | null;
      const wid = body?.workflowId;
      showBanner("ok", wid ? `Deployed. Workflow id: ${wid}` : "Deploy request succeeded.");
      if (wid) console.log("[mesh deploy]", body);
    } catch (e) {
      showBanner("err", e instanceof Error ? e.message : "Deploy failed.");
    } finally {
      setLoading(null);
    }
  }, [exportedDefinition, postDefinition, showBanner, deployMode, nodes, edges, workflowId, workflowName]);

  const selectedIsRoot = selected?.type === "meshStep" && selected.id === rootDomId;

  return (
    <div className="flex h-[100dvh] flex-col bg-zinc-100 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
      <header className="flex shrink-0 flex-wrap items-center gap-3 border-b border-zinc-200 bg-white px-4 py-2 dark:border-zinc-800 dark:bg-zinc-900">
        <Link
          href="/workflows"
          className="inline-flex items-center gap-1 text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          <ArrowLeft className="h-4 w-4" />
          Workflows
        </Link>
        <span className="text-zinc-300 dark:text-zinc-700">|</span>
        <h1 className="text-sm font-semibold">Create workflow</h1>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <input
            className="w-40 rounded border border-zinc-200 bg-white px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-950"
            value={workflowId}
            onChange={(e) => setWorkflowId(e.target.value)}
            placeholder="workflow id"
            title="DSL id string"
          />
          <input
            className="w-44 rounded border border-zinc-200 bg-white px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-950"
            value={workflowName}
            onChange={(e) => setWorkflowName(e.target.value)}
            placeholder="name"
          />
          <select
            className="rounded border border-zinc-200 bg-white px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-950"
            value={deployMode}
            onChange={(e) => setDeployMode(e.target.value as "executor" | "perNodeFanout")}
          >
            <option value="executor">Deploy: executor</option>
            <option value="perNodeFanout">Deploy: per-node fan-out</option>
          </select>
        </div>
      </header>

      {banner ? (
        <div
          className={`shrink-0 px-4 py-2 text-sm ${
            banner.type === "ok" ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100" : "bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-100"
          }`}
        >
          {banner.text}
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1">
        <aside className="w-56 shrink-0 border-r border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
          <MeshNodeLibrary />
          <div className="mt-6 space-y-2 border-t border-zinc-200 pt-4 dark:border-zinc-800">
            <p className="text-xs font-medium text-zinc-500">Import JSON</p>
            <textarea
              className="h-28 w-full rounded border border-zinc-200 bg-zinc-50 p-2 font-mono text-[10px] dark:border-zinc-700 dark:bg-zinc-950"
              value={jsonImport}
              onChange={(e) => setJsonImport(e.target.value)}
              placeholder='Paste { "id", "name", "nodes", "edges" }'
            />
            <button
              type="button"
              onClick={applyImport}
              className="flex w-full items-center justify-center gap-1 rounded-lg bg-zinc-200 py-2 text-xs font-medium hover:bg-zinc-300 dark:bg-zinc-800 dark:hover:bg-zinc-700"
            >
              <Upload className="h-3.5 w-3.5" />
              Apply to canvas
            </button>
          </div>
        </aside>

        <div className="relative min-h-0 min-w-0 flex-1" ref={wrapper}>
          <ReactFlowProvider>
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={handleNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onInit={setRf}
              onDrop={onDrop}
              onDragOver={onDragOver}
              onNodeClick={onNodeClick}
              onPaneClick={onPaneClick}
              nodeTypes={nodeTypes}
              edgeTypes={edgeTypes}
              fitView
              snapToGrid
              snapGrid={snapGridTuple}
              defaultEdgeOptions={defaultEdgeOptions}
              proOptions={reactFlowProOptions}
              className="bg-zinc-50 dark:bg-zinc-950"
            >
              <Background gap={16} />
              <Controls />
              <MiniMap
                nodeStrokeWidth={3}
                zoomable
                pannable
                className="rounded border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900"
              />
              <Panel position="top-right" className="flex flex-col gap-2">
                <div className="flex flex-wrap justify-end gap-2 rounded-lg border border-zinc-200 bg-white/95 p-2 shadow-sm backdrop-blur dark:border-zinc-700 dark:bg-zinc-900/95">
                  <button
                    type="button"
                    onClick={copyJson}
                    disabled={!jsonPretty}
                    className="inline-flex items-center gap-1 rounded-md border border-zinc-200 px-2 py-1.5 text-xs font-medium hover:bg-zinc-50 disabled:opacity-40 dark:border-zinc-600 dark:hover:bg-zinc-800"
                  >
                    <Copy className="h-3.5 w-3.5" />
                    Copy JSON
                  </button>
                  <button
                    type="button"
                    onClick={downloadJson}
                    disabled={!exportedDefinition}
                    className="inline-flex items-center gap-1 rounded-md border border-zinc-200 px-2 py-1.5 text-xs font-medium hover:bg-zinc-50 disabled:opacity-40 dark:border-zinc-600 dark:hover:bg-zinc-800"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Download
                  </button>
                  <button
                    type="button"
                    onClick={runValidate}
                    disabled={loading !== null}
                    className="inline-flex items-center gap-1 rounded-md bg-zinc-900 px-2 py-1.5 text-xs font-medium text-white hover:bg-zinc-800 disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
                  >
                    {loading === "validate" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                    Validate
                  </button>
                  <button
                    type="button"
                    onClick={runCompile}
                    disabled={loading !== null}
                    className="inline-flex items-center gap-1 rounded-md border border-violet-300 bg-violet-50 px-2 py-1.5 text-xs font-medium text-violet-900 hover:bg-violet-100 disabled:opacity-40 dark:border-violet-700 dark:bg-violet-950 dark:text-violet-100 dark:hover:bg-violet-900"
                  >
                    {loading === "compile" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                    Compile
                  </button>
                  <button
                    type="button"
                    onClick={runDeploy}
                    disabled={loading !== null}
                    className="inline-flex items-center gap-1 rounded-md bg-violet-600 px-2 py-1.5 text-xs font-medium text-white hover:bg-violet-500 disabled:opacity-40"
                  >
                    {loading === "deploy" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                    Deploy
                  </button>
                </div>
                <p className="max-w-xs text-right text-[10px] text-zinc-500">
                  API: <code className="rounded bg-zinc-200/80 px-1 dark:bg-zinc-800">{meshApiBase()}</code>
                  <br />
                  Deploy requires backend <code className="rounded bg-zinc-200/80 px-1 dark:bg-zinc-800">PRIVATE_KEY</code> + registry.
                </p>
              </Panel>
            </ReactFlow>
          </ReactFlowProvider>
        </div>

        {selected ? (
          <aside className="w-80 shrink-0 overflow-hidden border-l border-zinc-200 dark:border-zinc-800">
            <MeshNodeConfigPanel
              node={selected}
              isRoot={Boolean(selectedIsRoot)}
              updateNodeData={updateNodeData}
              onClose={() => setSelected(null)}
            />
          </aside>
        ) : null}
      </div>

      <footer className="max-h-36 shrink-0 overflow-auto border-t border-zinc-200 bg-white px-4 py-2 dark:border-zinc-800 dark:bg-zinc-900">
        <p className="mb-1 text-xs font-medium text-zinc-500">Generated JSON (live)</p>
        <pre className="font-mono text-[10px] leading-relaxed text-zinc-600 dark:text-zinc-400">
          {jsonPretty || graphTryError(nodes, edges, workflowId, workflowName) || "—"}
        </pre>
      </footer>
    </div>
  );
}

function graphTryError(nodes: Node[], edges: Edge[], workflowId: string, workflowName: string): string | null {
  try {
    graphToWorkflowDefinition(nodes, edges, workflowId, workflowName);
    return null;
  } catch (e) {
    return e instanceof GraphExportError ? e.message : e instanceof Error ? e.message : String(e);
  }
}

function requireDef(
  def: WorkflowDefinition | null,
  nodes: Node[],
  edges: Edge[],
  workflowId: string,
  workflowName: string,
  showBanner: (t: "ok" | "err", m: string) => void,
): WorkflowDefinition {
  if (def) return def;
  const msg = graphTryError(nodes, edges, workflowId, workflowName) ?? "Invalid graph";
  showBanner("err", msg);
  throw new Error(msg);
}
