import Link from "next/link";
import { notFound } from "next/navigation";
import { EvalFeed } from "../../../components/EvalFeed";
import { TraceFeed } from "../../../components/TraceFeed";
import { meshApiBase } from "../../../lib/meshConfig";

type IndexMeta = {
  workflowStringId: string;
  name?: string;
  kind?: string;
  registeredAt: string;
  indexStatus: string;
  /** Present for workflows deployed with `POST /workflows/from-definition` after this feature shipped. */
  definition?: Record<string, unknown>;
  hybridEvaluation?: boolean;
  deployMode?: "executor" | "perNodeFanout";
  subscriptionIds?: string[];
  nodeAddresses?: string[];
};

type OnChain = {
  workflowId: string;
  owner: string;
  status: string;
  nodes: string[];
  subscriptionIds: string[];
  /** Present when Workflow Manager has indexed this deployment (`data/workflows-index.json`). */
  indexMeta?: IndexMeta | null;
};

async function fetchOnChain(id: string): Promise<OnChain | null> {
  const r = await fetch(`${meshApiBase()}/workflows/${encodeURIComponent(id)}`, { cache: "no-store" });
  if (r.status === 404) return null;
  if (!r.ok) return null;
  return (await r.json()) as OnChain;
}

export default async function WorkflowDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await fetchOnChain(id);
  if (!data) notFound();

  const meta = data.indexMeta ?? null;
  const title = meta?.name?.trim() ? meta.name : id;
  const deployHint =
    meta?.deployMode === "perNodeFanout"
      ? `per-node fan-out${meta.subscriptionIds?.length ? ` (${meta.subscriptionIds.length} subs)` : ""}`
      : meta?.deployMode === "executor"
        ? "single executor"
        : null;
  const kindLine =
    meta &&
    [meta.kind && `${meta.kind}`, meta.indexStatus && `index: ${meta.indexStatus}`, deployHint]
      .filter(Boolean)
      .join(" · ");

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8 px-6 py-16">
      <header className="flex flex-col gap-2">
        <Link href="/workflows" className="text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200">
          ← Workflows
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">{title}</h1>
        {meta?.name?.trim() && (
          <p className="text-xs text-zinc-500">
            Id <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-900">{meta.workflowStringId}</code> ·{" "}
            <code className="rounded bg-zinc-100 px-1 text-[0.65rem] dark:bg-zinc-900">{data.workflowId}</code>
          </p>
        )}
        <p className="text-sm text-zinc-500">
          On-chain <span className="text-zinc-700 dark:text-zinc-300">{data.status}</span>
          {kindLine ? (
            <>
              {" "}
              · <span className="text-zinc-600 dark:text-zinc-400">{kindLine}</span>
            </>
          ) : null}{" "}
          · owner{" "}
          <code className="rounded bg-zinc-100 px-1 text-xs dark:bg-zinc-900">{data.owner}</code>
        </p>
      </header>

      {meta?.definition != null && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-medium uppercase tracking-wide text-zinc-500">Workflow definition</h2>
          <p className="text-sm text-zinc-500">
            Snapshot from the Workflow Manager index (deployed via <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-900">from-definition</code>).
          </p>
          <details className="rounded-lg border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/40">
            <summary className="cursor-pointer px-3 py-2 text-sm text-zinc-700 dark:text-zinc-300">
              Show JSON
            </summary>
            <pre className="max-h-80 overflow-auto border-t border-zinc-200 p-3 text-xs text-zinc-800 dark:border-zinc-800 dark:text-zinc-200">
              {JSON.stringify(meta.definition, null, 2)}
            </pre>
          </details>
        </section>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium uppercase tracking-wide text-zinc-500">Nodes</h2>
        <ul className="list-inside list-disc text-sm text-zinc-700 dark:text-zinc-300">
          {data.nodes.map((n, i) => (
            <li key={n}>
              <code className="text-xs">{n}</code> · sub {data.subscriptionIds[i] ?? "—"}
            </li>
          ))}
        </ul>
      </section>

      {meta?.hybridEvaluation ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-medium uppercase tracking-wide text-zinc-500">Off-chain evaluation</h2>
          <p className="text-sm text-zinc-500">
            Structured pass/fail from Somnia <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-900">sdk.subscribe</code> with root{" "}
            <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-900">ethCalls</code>.
          </p>
          <EvalFeed workflowIdBytes32={data.workflowId} />
        </section>
      ) : null}

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium uppercase tracking-wide text-zinc-500">Live trace</h2>
        <p className="text-sm text-zinc-500">
          Stream from the backend <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-900">sdk.subscribe</code>{" "}
          fan-out. This page uses <strong>workflow-scoped</strong> filtering when possible (see query on the WebSocket
          URL).
        </p>
        <TraceFeed workflowIdBytes32={data.workflowId} />
      </section>
    </div>
  );
}
