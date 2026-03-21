import Link from "next/link";
import { meshApiBase } from "../../lib/meshConfig";

type Indexed = {
  workflowStringId: string;
  workflowId: string;
  status: string;
  emitter: string;
  sink: string;
  workflowNode: string;
  subscriptionId: string;
  /** Present when `deployMode === "perNodeFanout"` (parallel subs). */
  subscriptionIds?: string[];
  deployMode?: "executor" | "perNodeFanout";
  registeredAt: string;
  name?: string;
  kind?: string;
};

async function fetchWorkflows(): Promise<Indexed[]> {
  const r = await fetch(`${meshApiBase()}/workflows`, { cache: "no-store" });
  if (!r.ok) return [];
  const j = (await r.json()) as { workflows: Indexed[] };
  return j.workflows ?? [];
}

export default async function WorkflowsPage() {
  const workflows = await fetchWorkflows();

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8 px-6 py-16">
      <header className="flex flex-col gap-2">
        <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200">
          ← Mesh
        </Link>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">Workflows</h1>
          <Link
            href="/workflows/build"
            className="text-sm font-medium text-violet-600 underline-offset-4 hover:text-violet-800 hover:underline dark:text-violet-400 dark:hover:text-violet-200"
          >
            Create workflow (builder)
          </Link>
        </div>
        <p className="text-zinc-600 dark:text-zinc-400">
          Deployed via the Mesh API (indexed in <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-900">backend/data/</code>
          ). On-chain source of truth remains <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-900">WorkflowRegistry</code>.
        </p>
      </header>

      {workflows.length === 0 ? (
        <p className="text-zinc-500">No workflows indexed yet. Run <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-900">npm run mesh -- deploy --id my-flow</code> from <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-900">backend/</code>.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {workflows.map((w) => (
            <li key={w.workflowId}>
              <Link
                href={`/workflows/${encodeURIComponent(w.workflowStringId)}`}
                className="block rounded-lg border border-zinc-200 p-4 transition hover:border-zinc-400 dark:border-zinc-800 dark:hover:border-zinc-600"
              >
                <div className="font-medium text-zinc-900 dark:text-zinc-50">
                  {w.name ? `${w.name} · ` : ""}
                  {w.workflowStringId}
                </div>
                <div className="mt-1 text-sm text-zinc-500">
                  {w.kind === "compiled" ? "compiled" : w.kind === "demo" ? "demo" : "workflow"}
                  {w.deployMode === "perNodeFanout" ? " · fan-out" : ""} · {w.status} · sub #{w.subscriptionId}
                  {w.subscriptionIds && w.subscriptionIds.length > 1
                    ? ` (+${w.subscriptionIds.length - 1} more)`
                    : ""}{" "}
                  · {new Date(w.registeredAt).toLocaleString()}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
