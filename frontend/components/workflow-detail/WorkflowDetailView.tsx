"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { EvalFeed } from "../EvalFeed";
import { TraceFeed } from "../TraceFeed";
import { CopyButton } from "./CopyButton";
import { meshApiBase, shannonExplorerAddressUrl, shannonExplorerTxUrl } from "../../lib/meshConfig";

type IndexMeta = {
  workflowStringId: string;
  name?: string;
  kind?: string;
  registeredAt: string;
  indexStatus: string;
  definition?: Record<string, unknown>;
  hybridEvaluation?: boolean;
  deployMode?: "executor" | "perNodeFanout";
  subscriptionIds?: string[];
  nodeAddresses?: string[];
  emitter?: string;
  sink?: string;
  workflowNode?: string;
  subscriptionId?: string;
  transactionHashes?: Record<string, string>;
};

type OnChain = {
  workflowId: string;
  registryAddress?: string | null;
  owner: string;
  status: string;
  nodes: string[];
  subscriptionIds: string[];
  indexMeta?: IndexMeta | null;
};

type DefNode = {
  id?: string;
  trigger?: { type?: string; emitter?: string };
  action?: { type?: string };
  ethCalls?: unknown[];
  condition?: unknown;
  conditionTree?: unknown;
};

function defNodes(def: Record<string, unknown> | undefined): DefNode[] {
  const raw = def?.nodes;
  if (!Array.isArray(raw)) return [];
  return raw as DefNode[];
}

function Section({
  title,
  subtitle,
  children,
  className = "",
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-2xl border border-zinc-200/90 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/70 md:p-8 ${className}`}
    >
      <div className="mb-5 border-b border-zinc-100 pb-4 dark:border-zinc-800/80">
        <h2 className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">{title}</h2>
        {subtitle ? <p className="mt-1.5 max-w-3xl text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">{subtitle}</p> : null}
      </div>
      {children}
    </section>
  );
}

function Row({
  label,
  children,
  dense,
}: {
  label: string;
  children: ReactNode;
  dense?: boolean;
}) {
  return (
    <div className={`flex flex-col gap-1.5 sm:flex-row sm:items-start sm:gap-6 ${dense ? "py-2" : "py-3"} border-b border-zinc-100 last:border-0 dark:border-zinc-800/60`}>
      <div className="w-40 shrink-0 text-xs font-medium uppercase tracking-wide text-zinc-400 dark:text-zinc-500">{label}</div>
      <div className="min-w-0 flex-1 text-sm text-zinc-800 dark:text-zinc-200">{children}</div>
    </div>
  );
}

function AddressBlock({ label, address }: { label?: string; address: string }) {
  const trimmed = address.trim();
  const explorer = shannonExplorerAddressUrl(trimmed);
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 flex-1">
        {label ? <div className="text-[0.65rem] font-medium uppercase tracking-wide text-zinc-400">{label}</div> : null}
        <code className={`block break-all rounded-lg bg-zinc-100 px-2 py-1.5 text-xs text-zinc-900 dark:bg-zinc-900 dark:text-zinc-100 ${label ? "mt-1" : ""}`}>{trimmed}</code>
      </div>
      <div className="flex shrink-0 flex-wrap gap-2">
        <CopyButton value={trimmed} />
        <a
          href={explorer}
          target="_blank"
          rel="noreferrer"
          className="rounded-md border border-zinc-300 px-2 py-1 text-[0.65rem] font-medium uppercase tracking-wide text-zinc-600 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          Explorer
        </a>
      </div>
    </div>
  );
}

function Badge({ children, tone }: { children: ReactNode; tone: "neutral" | "ok" | "warn" | "brand" }) {
  const tones = {
    neutral: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200",
    ok: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-200",
    warn: "bg-amber-100 text-amber-950 dark:bg-amber-950/40 dark:text-amber-100",
    brand: "bg-violet-100 text-violet-900 dark:bg-violet-950/50 dark:text-violet-200",
  };
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${tones[tone]}`}>{children}</span>;
}

export function WorkflowDetailView({ pageId, data }: { pageId: string; data: OnChain }) {
  const meta = data.indexMeta ?? null;
  const title = meta?.name?.trim() ? meta.name : pageId;
  const def = meta?.definition;
  const nodesDef = defNodes(def);
  const hybrid = meta?.hybridEvaluation === true;
  const deployMode = meta?.deployMode ?? "executor";
  const api = meshApiBase();

  const statusTone =
    data.status.toLowerCase() === "active" ? "ok" : data.status.toLowerCase() === "paused" ? "warn" : "neutral";

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 md:py-16">
      <Link href="/workflows" className="mb-8 inline-block text-sm text-zinc-500 transition hover:text-zinc-800 dark:hover:text-zinc-200">
        ← Workflows
      </Link>

      {/* Hero */}
      <header className="mb-10 rounded-2xl border border-zinc-200/90 bg-gradient-to-br from-zinc-50 to-white p-6 shadow-sm dark:border-zinc-800 dark:from-zinc-950 dark:to-zinc-900/80 md:p-10">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 space-y-3">
            <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 md:text-4xl">{title}</h1>
            <p className="max-w-2xl text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
              On-chain workflow registered in the Mesh registry. Live sections below show indexed metadata, step contracts, DSL snapshot, and real-time trace /
              evaluation streams when enabled on the API.
            </p>
            <div className="flex flex-wrap gap-2">
              <Badge tone={statusTone}>Status: {data.status}</Badge>
              {meta?.kind ? <Badge tone="neutral">Kind: {meta.kind}</Badge> : null}
              <Badge tone="brand">{deployMode === "perNodeFanout" ? "Per-node fan-out" : "Single executor"}</Badge>
              {hybrid ? <Badge tone="ok">Hybrid evaluation</Badge> : <Badge tone="neutral">On-chain steps only</Badge>}
              {meta?.indexStatus ? <Badge tone="neutral">Index: {meta.indexStatus}</Badge> : null}
            </div>
          </div>
          <div className="flex shrink-0 flex-col gap-2 rounded-xl border border-zinc-200/80 bg-white/80 p-4 dark:border-zinc-700 dark:bg-zinc-950/50">
            <span className="text-[0.65rem] font-medium uppercase tracking-wide text-zinc-400">Route id</span>
            <code className="break-all text-xs text-zinc-800 dark:text-zinc-200">{pageId}</code>
            <CopyButton value={pageId} label="Copy id" />
          </div>
        </div>
      </header>

      <div className="flex flex-col gap-10">
        <div className="grid gap-8 lg:grid-cols-2">
          <Section
            title="Registry & identity"
            subtitle="Resolved from WorkflowRegistry.getWorkflow. Use these ids when debugging subscriptions and traces."
          >
            {data.registryAddress ? <AddressBlock label="WorkflowRegistry" address={data.registryAddress} /> : null}
            <div className="mt-4 space-y-0">
              <Row label="Workflow id (bytes32)" dense>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <code className="break-all text-xs">{data.workflowId}</code>
                  <div className="flex gap-2">
                    <CopyButton value={data.workflowId} />
                  </div>
                </div>
              </Row>
              <Row label="Owner" dense>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <code className="break-all text-xs">{data.owner}</code>
                  <div className="flex gap-2">
                    <CopyButton value={data.owner} />
                    <a
                      href={shannonExplorerAddressUrl(data.owner)}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-md border border-zinc-300 px-2 py-1 text-[0.65rem] font-medium uppercase tracking-wide text-zinc-600 dark:border-zinc-600 dark:text-zinc-300"
                    >
                      Explorer
                    </a>
                  </div>
                </div>
              </Row>
              {meta?.workflowStringId ? (
                <Row label="String id" dense>
                  <div className="flex flex-wrap items-center gap-2">
                    <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs dark:bg-zinc-900">{meta.workflowStringId}</code>
                    <CopyButton value={meta.workflowStringId} />
                  </div>
                </Row>
              ) : null}
            </div>
          </Section>

          <Section
            title="Deployment index"
            subtitle="Snapshot from Workflow Manager (data/workflows-index.json). Filled when you deploy via the API or CLI."
          >
            {meta ? (
              <div className="space-y-0">
                <Row label="Registered" dense>
                  <time dateTime={meta.registeredAt}>{new Date(meta.registeredAt).toLocaleString()}</time>
                </Row>
                {meta.emitter && meta.emitter !== "0x0000000000000000000000000000000000000000" ? (
                  <Row label="Emitter" dense>
                    <AddressBlock address={meta.emitter} />
                  </Row>
                ) : null}
                {meta.workflowNode ? (
                  <Row label="Primary node" dense>
                    <AddressBlock address={meta.workflowNode} />
                  </Row>
                ) : null}
                {meta.sink && meta.sink !== "0x0000000000000000000000000000000000000000" ? (
                  <Row label="Sink (demo)" dense>
                    <AddressBlock address={meta.sink} />
                  </Row>
                ) : null}
                {meta.subscriptionId ? (
                  <Row label="Root subscription" dense>
                    <div className="flex flex-wrap items-center gap-2">
                      <code className="text-xs">{meta.subscriptionId}</code>
                      <CopyButton value={meta.subscriptionId} />
                      <a
                        href={`${api}/workflows/${encodeURIComponent(pageId)}/subscriptions/${encodeURIComponent(meta.subscriptionId)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs font-medium text-violet-600 underline-offset-2 hover:underline dark:text-violet-400"
                      >
                        GET subscription info
                      </a>
                    </div>
                  </Row>
                ) : null}
              </div>
            ) : (
              <p className="text-sm leading-relaxed text-zinc-500">
                This workflow exists on-chain but is not in the local index. Deploy with{" "}
                <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-900">POST /workflows/from-definition</code> (or the CLI) on this machine to attach
                metadata, DSL, and subscription wiring for the dashboard.
              </p>
            )}
            {meta?.transactionHashes && Object.keys(meta.transactionHashes).length > 0 ? (
              <div className="mt-6 border-t border-zinc-100 pt-4 dark:border-zinc-800">
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-400">Transaction hashes</h3>
                <ul className="space-y-2">
                  {Object.entries(meta.transactionHashes).map(([k, h]) => (
                    <li key={k} className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                      <span className="text-xs text-zinc-500">{k}</span>
                      <div className="flex flex-wrap items-center gap-2">
                        <code className="break-all text-[0.65rem] text-zinc-800 dark:text-zinc-200">{h}</code>
                        <CopyButton value={h} />
                        <a href={shannonExplorerTxUrl(h)} target="_blank" rel="noreferrer" className="text-[0.65rem] font-medium text-violet-600 dark:text-violet-400">
                          Tx
                        </a>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </Section>
        </div>

        <Section
          title="Steps & subscriptions"
          subtitle="Registry node addresses aligned with subscription ids (same order as getWorkflow). Each row links to the precompile subscription inspector endpoint."
        >
          <div className="overflow-x-auto rounded-xl border border-zinc-100 dark:border-zinc-800">
            <table className="w-full min-w-[32rem] text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-100 bg-zinc-50/80 dark:border-zinc-800 dark:bg-zinc-900/50">
                  <th className="px-4 py-3 font-medium text-zinc-600 dark:text-zinc-400">#</th>
                  <th className="px-4 py-3 font-medium text-zinc-600 dark:text-zinc-400">Node contract</th>
                  <th className="px-4 py-3 font-medium text-zinc-600 dark:text-zinc-400">Subscription</th>
                </tr>
              </thead>
              <tbody>
                {data.nodes.map((n, i) => {
                  const sub = data.subscriptionIds[i] ?? "—";
                  const subLink =
                    sub !== "—" ? `${api}/workflows/${encodeURIComponent(pageId)}/subscriptions/${encodeURIComponent(sub)}` : null;
                  return (
                    <tr key={`${n}-${i}`} className="border-b border-zinc-100 last:border-0 dark:border-zinc-800/80">
                      <td className="px-4 py-4 align-top text-zinc-500">{i + 1}</td>
                      <td className="px-4 py-4 align-top">
                        <code className="break-all text-xs">{n}</code>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <CopyButton value={n} />
                          <a
                            href={shannonExplorerAddressUrl(n)}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-md border border-zinc-300 px-2 py-1 text-[0.65rem] uppercase tracking-wide dark:border-zinc-600"
                          >
                            Explorer
                          </a>
                        </div>
                      </td>
                      <td className="px-4 py-4 align-top">
                        <code className="text-xs">{sub}</code>
                        {subLink ? (
                          <div className="mt-2">
                            <a href={subLink} target="_blank" rel="noreferrer" className="text-xs font-medium text-violet-600 underline-offset-2 hover:underline dark:text-violet-400">
                              Open JSON
                            </a>
                          </div>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {deployMode === "perNodeFanout" && meta?.nodeAddresses?.length ? (
            <p className="mt-4 text-xs text-zinc-500">
              Fan-out mode also recorded {meta.nodeAddresses.length} node address(es) in the index; compare with the registry table above.
            </p>
          ) : null}
        </Section>

        {def ? (
          <Section
            title="DSL snapshot"
            subtitle="Definition stored at deploy time (nodes, triggers, hybrid fields). Use the JSON panel for a full export."
          >
            <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl border border-zinc-100 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
                <div className="text-[0.65rem] font-medium uppercase text-zinc-400">Nodes</div>
                <div className="mt-1 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">{nodesDef.length}</div>
              </div>
              <div className="rounded-xl border border-zinc-100 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
                <div className="text-[0.65rem] font-medium uppercase text-zinc-400">Edges</div>
                <div className="mt-1 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
                  {Array.isArray(def.edges) ? def.edges.length : 0}
                </div>
              </div>
              <div className="rounded-xl border border-zinc-100 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
                <div className="text-[0.65rem] font-medium uppercase text-zinc-400">Hybrid roots</div>
                <div className="mt-1 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
                  {nodesDef.filter((n) => (n.ethCalls?.length ?? 0) > 0 || n.condition != null || n.conditionTree != null).length}
                </div>
              </div>
              <div className="rounded-xl border border-zinc-100 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
                <div className="text-[0.65rem] font-medium uppercase text-zinc-400">Workflow id (DSL)</div>
                <div className="mt-1 break-all font-mono text-sm text-zinc-800 dark:text-zinc-200">{String(def.id ?? "—")}</div>
              </div>
            </div>

            <div className="mb-6 overflow-x-auto rounded-xl border border-zinc-100 dark:border-zinc-800">
              <table className="w-full min-w-[36rem] text-left text-sm">
                <thead>
                  <tr className="border-b border-zinc-100 bg-zinc-50/80 dark:border-zinc-800 dark:bg-zinc-900/50">
                    <th className="px-4 py-3 font-medium text-zinc-600 dark:text-zinc-400">Node id</th>
                    <th className="px-4 py-3 font-medium text-zinc-600 dark:text-zinc-400">Trigger</th>
                    <th className="px-4 py-3 font-medium text-zinc-600 dark:text-zinc-400">Action</th>
                    <th className="px-4 py-3 font-medium text-zinc-600 dark:text-zinc-400">Hybrid</th>
                  </tr>
                </thead>
                <tbody>
                  {nodesDef.map((n) => {
                    const hid = n.id ?? "—";
                    const isHybrid = (n.ethCalls?.length ?? 0) > 0 || n.condition != null || n.conditionTree != null;
                    return (
                      <tr key={hid} className="border-b border-zinc-100 last:border-0 dark:border-zinc-800/80">
                        <td className="px-4 py-3 font-mono text-xs">{hid}</td>
                        <td className="px-4 py-3 text-xs text-zinc-700 dark:text-zinc-300">{n.trigger?.type ?? "—"}</td>
                        <td className="px-4 py-3 text-xs text-zinc-700 dark:text-zinc-300">{n.action?.type ?? "—"}</td>
                        <td className="px-4 py-3 text-xs">{isHybrid ? <Badge tone="ok">Yes</Badge> : <Badge tone="neutral">No</Badge>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <details className="group rounded-xl border border-zinc-200 bg-zinc-50/50 dark:border-zinc-800 dark:bg-zinc-900/30">
              <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium text-zinc-700 marker:hidden dark:text-zinc-300 [&::-webkit-details-marker]:hidden">
                <span className="group-open:hidden">Show full definition JSON</span>
                <span className="hidden group-open:inline">Hide full definition JSON</span>
              </summary>
              <pre className="max-h-[min(28rem,50vh)] overflow-auto border-t border-zinc-200 p-4 text-xs leading-relaxed text-zinc-800 dark:border-zinc-800 dark:text-zinc-200">
                {JSON.stringify(def, null, 2)}
              </pre>
            </details>
          </Section>
        ) : null}

        {hybrid ? (
          <Section
            title="Off-chain evaluation (live)"
            subtitle="Verdict stream from Somnia sdk.subscribe with root ethCalls + conditions. Requires EVALUATION_ENGINE=1 on the API and a hybrid workflow in the index. After you trigger the root event, you should see PASS/FAIL lines here."
          >
            <div className="min-h-[14rem]">
              <EvalFeed workflowIdBytes32={data.workflowId} variant="comfortable" />
            </div>
          </Section>
        ) : null}

        <Section
          title="Execution trace (live)"
          subtitle="Workflow-scoped trace from the backend wildcard subscription. When TRACE_ENGINE=1, firing the root trigger should produce WorkflowStepExecuted / related lines here — proof the reactive path and indexer are wired."
        >
          <div className="min-h-[16rem]">
            <TraceFeed workflowIdBytes32={data.workflowId} variant="comfortable" />
          </div>
        </Section>
      </div>
    </div>
  );
}
