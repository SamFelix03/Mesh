"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { Activity, Radio, Zap } from "lucide-react";
import { EvalFeed } from "../EvalFeed";
import { TraceFeed } from "../TraceFeed";
import { meshApiBase } from "../../lib/meshConfig";
import { buildStepNodeLabelMap } from "../../lib/workflowNodeLabels";

type Wf = {
  workflowStringId: string;
  workflowId: string;
  name?: string;
  hybridEvaluation?: boolean;
  deployMode?: string;
  emitter: string;
  /** Executor or step contract(s) — used to HTTP-backfill `WorkflowStepExecuted` after Ping. */
  workflowNode?: string;
  nodeAddresses?: string[];
  /** Set by `GET /workflows?full=1` when registry enrichment fills addresses (fixes sparse index rows). */
  traceLogContracts?: string;
  definition?: { nodes?: { id: string; name?: string }[] };
};

type Props = {
  workflows: Wf[];
  /** Shared Ping emitter (from any indexed workflow that has a non-zero emitter). */
  emitter: string | null;
  hybrid: Wf | null;
  fanout: Wf | null;
  /** Indexed workflows other than the two Shannon bootstrap ids — shown with their own trace cards. */
  extraWorkflows: Wf[];
};

function httpTraceContractsFor(wf: Wf): string | undefined {
  const enriched = wf.traceLogContracts?.trim();
  if (enriched) return enriched;
  if (wf.deployMode === "perNodeFanout" && wf.nodeAddresses?.length) return wf.nodeAddresses.join(",");
  if (wf.workflowNode?.trim()) return wf.workflowNode.trim();
  return undefined;
}

export function DemoExperience({ workflows, emitter, hybrid, fanout, extraWorkflows }: Props) {
  const [pingMsg, setPingMsg] = useState<string | null>(null);
  const [pingBusy, setPingBusy] = useState(false);
  const [pingPullNonce, setPingPullNonce] = useState(0);
  const [pingAnchorBlock, setPingAnchorBlock] = useState<string | null>(null);

  const ping = useCallback(async () => {
    if (!emitter) return;
    setPingBusy(true);
    setPingMsg(null);
    try {
      const r = await fetch(`${meshApiBase()}/chain/ping`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ emitterAddress: emitter, seq: String(Date.now() % 1_000_000) }),
      });
      const j = (await r.json().catch(() => ({}))) as {
        error?: string;
        txHash?: string;
        blockNumber?: string;
      };
      if (!r.ok) throw new Error(j.error ?? r.statusText);
      const blk = j.blockNumber;
      setPingMsg(blk ? `Submitted · ${j.txHash} · block ${blk}` : `Submitted · ${j.txHash}`);
      setPingAnchorBlock(blk ?? null);
      setPingPullNonce((n) => n + 1);
    } catch (e) {
      setPingMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setPingBusy(false);
    }
  }, [emitter]);

  if (workflows.length === 0 || !emitter) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-8 dark:border-amber-900/50 dark:bg-amber-950/30">
        <h2 className="text-lg font-semibold text-amber-950 dark:text-amber-100">Demo data not loaded</h2>
        <p className="mt-2 text-sm text-amber-900/80 dark:text-amber-200/90">
          The API returned no indexed workflows, or no row has a non-zero <code className="rounded bg-black/10 px-1 dark:bg-black/30">emitter</code> (needed for Ping).
          Bootstrap with{" "}
          <code className="rounded bg-black/10 px-1 dark:bg-black/30">cd backend && npm run demo:bootstrap:shannon</code> or deploy from the builder, ensure{" "}
          <code className="rounded bg-black/10 px-1">NEXT_PUBLIC_MESH_API</code> points at this backend, then refresh.
        </p>
      </div>
    );
  }

  if (!hybrid && !fanout && extraWorkflows.length === 0) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-8 dark:border-amber-900/50 dark:bg-amber-950/30">
        <h2 className="text-lg font-semibold text-amber-950 dark:text-amber-100">No workflows to show</h2>
        <p className="mt-2 text-sm text-amber-900/80 dark:text-amber-200/90">
          Nothing in the index except entries that were filtered out, or bootstrap demos are missing and you have no other workflows. Deploy a workflow and ensure it appears in{" "}
          <code className="rounded bg-black/10 px-1 dark:bg-black/30">GET /workflows</code>.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-12">
      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/80 md:p-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              <Zap className="h-5 w-5 text-violet-500" />
              Fire a test Ping
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
              Workflows on this page listen for <code className="rounded bg-zinc-100 px-1 text-xs dark:bg-zinc-900">Ping(uint256)</code> on this emitter (same topic as the
              bootstrap templates). The backend submits <code className="rounded bg-zinc-100 px-1 text-xs dark:bg-zinc-900">POST /chain/ping</code> (needs{" "}
              <code className="rounded bg-zinc-100 px-1 text-xs dark:bg-zinc-900">PRIVATE_KEY</code>). Your UI-deployed workflow must use this emitter address in its root
              trigger.
            </p>
            <code className="mt-3 block break-all rounded-lg bg-zinc-100 px-3 py-2 text-xs text-zinc-800 dark:bg-zinc-900 dark:text-zinc-200">{emitter}</code>
          </div>
          <button
            type="button"
            onClick={() => void ping()}
            disabled={pingBusy}
            className="shrink-0 rounded-xl bg-violet-600 px-6 py-3 text-sm font-medium text-white shadow transition hover:bg-violet-500 disabled:opacity-50 dark:bg-violet-500 dark:hover:bg-violet-400"
          >
            {pingBusy ? "Sending…" : "Ping (on-chain)"}
          </button>
        </div>
        {pingMsg ? <p className="mt-4 text-sm text-zinc-700 dark:text-zinc-300">{pingMsg}</p> : null}
        <p className="mt-4 text-xs text-zinc-500">
          Alternative:{" "}
          <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-900">
            cast send {emitter} &quot;ping(uint256)&quot; 42 --rpc-url https://dream-rpc.somnia.network --private-key $PRIVATE_KEY
          </code>
        </p>
      </section>

      {(hybrid || fanout) && (
        <div className="grid gap-8 lg:grid-cols-2">
          {hybrid ? (
            <DemoCard
              title="Demo 1 — Hybrid executor"
              subtitle="Single MeshWorkflowExecutor: subscription + ethCalls + condition + emit. Evaluation stream (green) when EVALUATION_ENGINE=1."
              wf={hybrid}
              traceId={hybrid.workflowId}
              showEval={hybrid.hybridEvaluation === true}
              httpTraceContracts={httpTraceContractsFor(hybrid)}
              httpPullNonce={pingPullNonce}
              httpAnchorBlock={pingAnchorBlock}
            />
          ) : (
            <div className="rounded-2xl border border-dashed border-zinc-300 p-6 text-sm text-zinc-500 dark:border-zinc-600">
              Demo 1 (mesh-showcase-shannon) — not in index.
            </div>
          )}
          {fanout ? (
            <DemoCard
              title="Demo 2 — Per-node fan-out"
              subtitle="Three MeshSimpleStepNode contracts, three subscriptions, same Ping filter. Trace shows activity across workflow-scoped streams."
              wf={fanout}
              traceId={fanout.workflowId}
              showEval={false}
              httpTraceContracts={httpTraceContractsFor(fanout)}
              httpPullNonce={pingPullNonce}
              httpAnchorBlock={pingAnchorBlock}
            />
          ) : (
            <div className="rounded-2xl border border-dashed border-zinc-300 p-6 text-sm text-zinc-500 dark:border-zinc-600">
              Demo 2 (mesh-demo-fanout-shannon) — not in index.
            </div>
          )}
        </div>
      )}

      {extraWorkflows.length > 0 ? (
        <section className="flex flex-col gap-6">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Your other indexed workflows</h2>
          <p className="-mt-2 max-w-3xl text-sm text-zinc-600 dark:text-zinc-400">
            Each card filters trace lines by that workflow&apos;s <code className="rounded bg-zinc-100 px-1 text-xs dark:bg-zinc-900">workflowId</code>. After Ping, HTTP
            backfill scans the executor / step contracts from the index.
          </p>
          <div className="grid gap-8 lg:grid-cols-2">
            {extraWorkflows.map((w) => (
              <DemoCard
                key={w.workflowStringId}
                title={w.name?.trim() || w.workflowStringId}
                subtitle={`Open full monitor for DSL and registry detail. Hybrid: ${w.hybridEvaluation ? "yes" : "no"} · ${w.deployMode ?? "executor"}`}
                wf={w}
                traceId={w.workflowId}
                showEval={w.hybridEvaluation === true}
                httpTraceContracts={httpTraceContractsFor(w)}
                httpPullNonce={pingPullNonce}
                httpAnchorBlock={pingAnchorBlock}
              />
            ))}
          </div>
        </section>
      ) : null}

      <section className="rounded-2xl border border-zinc-200 bg-zinc-50/80 p-6 dark:border-zinc-800 dark:bg-zinc-900/40 md:p-8">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">End-user path (deployed frontend)</h2>
        <ol className="mt-4 list-decimal space-y-3 pl-5 text-sm text-zinc-700 dark:text-zinc-300">
          <li>
            Open this <strong>/demo</strong> page (bookmark for your Vercel / production URL).
          </li>
          <li>
            Confirm <code className="rounded bg-white px-1 dark:bg-zinc-950">NEXT_PUBLIC_MESH_API</code> targets your public Workflow Manager (CORS + same Shannon
            registry).
          </li>
          <li>
            Click <strong>Ping</strong> (or use <code className="rounded bg-white px-1 dark:bg-zinc-950">cast</code> above).
          </li>
          <li>
            Watch <strong>Live trace</strong> — Somnia WebSocket stream needs <code className="rounded bg-white px-1 dark:bg-zinc-950">TRACE_ENGINE=1</code>; after each Ping we also
            HTTP-pull steps around that block so you still see lines when the push stream is quiet.
          </li>
          <li>
            On Demo 1, watch <strong>Off-chain evaluation</strong> — requires <code className="rounded bg-white px-1 dark:bg-zinc-950">EVALUATION_ENGINE=1</code>.
          </li>
        </ol>
      </section>
    </div>
  );
}

function DemoCard({
  title,
  subtitle,
  wf,
  traceId,
  showEval,
  httpTraceContracts,
  httpPullNonce,
  httpAnchorBlock,
}: {
  title: string;
  subtitle: string;
  wf: Wf | null;
  traceId?: string;
  showEval: boolean;
  httpTraceContracts?: string;
  httpPullNonce: number;
  httpAnchorBlock: string | null;
}) {
  if (!wf) {
    return (
      <div className="rounded-2xl border border-dashed border-zinc-300 p-6 text-sm text-zinc-500 dark:border-zinc-700">
        {title} — not in index (run bootstrap).
      </div>
    );
  }

  const stepNodeLabels = useMemo(() => {
    const nodes = wf.definition?.nodes;
    if (!nodes?.length) return undefined;
    const withId = nodes.filter((n): n is { id: string; name?: string } => typeof n.id === "string" && n.id.length > 0);
    if (!withId.length) return undefined;
    return buildStepNodeLabelMap(withId);
  }, [wf.definition]);

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/80">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-violet-100 dark:bg-violet-900/40">
          <Activity className="h-5 w-5 text-violet-600 dark:text-violet-400" />
        </div>
        <div>
          <h3 className="font-semibold text-zinc-900 dark:text-zinc-50">{title}</h3>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{subtitle}</p>
          <p className="mt-2 font-mono text-xs text-zinc-500">{wf.workflowStringId}</p>
        </div>
      </div>
      <Link
        href={`/workflows/${encodeURIComponent(wf.workflowStringId)}`}
        className="inline-flex w-fit items-center gap-1 text-sm font-medium text-violet-600 hover:underline dark:text-violet-400"
      >
        Open full monitor →
      </Link>
      {showEval ? (
        <div>
          <h4 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
            <Radio className="h-3.5 w-3.5" />
            Off-chain evaluation
          </h4>
          <EvalFeed workflowIdBytes32={traceId} variant="comfortable" />
        </div>
      ) : null}
      <div>
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">Live trace</h4>
        <TraceFeed
          key={`trace-${traceId ?? "none"}`}
          workflowIdBytes32={traceId}
          variant="comfortable"
          httpTraceContracts={httpTraceContracts}
          httpPullNonce={httpPullNonce}
          httpAnchorBlock={httpAnchorBlock}
          stepNodeLabels={stepNodeLabels}
        />
      </div>
    </div>
  );
}
