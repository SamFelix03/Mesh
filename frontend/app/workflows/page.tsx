import Link from "next/link";
import { Plus, Activity, Workflow } from "lucide-react";
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
    <main className="min-h-screen bg-zinc-50 dark:bg-black relative">
      <div 
        className="absolute inset-0 z-0 opacity-40 dark:opacity-10 pointer-events-none"
        style={{
          backgroundImage: 'url(/hero-bg.svg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center 80px',
          backgroundRepeat: 'no-repeat'
        }}
      />
      <div className="container mx-auto px-4 py-24 max-w-6xl relative z-10">
        {/* Header */}
        <div className="mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <Link href="/" className="mb-2 inline-block text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200">
              ← Back to Home
            </Link>
            <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
              Workflows
            </h1>
            <p className="text-zinc-600 dark:text-zinc-400 mt-2">
              Manage and monitor your reactive workflows
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/demo"
              className="inline-flex items-center justify-center rounded-md bg-violet-600 px-6 py-3 text-sm font-medium text-white shadow transition-colors hover:bg-violet-500"
            >
              Live demo
            </Link>
            <Link
              href="/workflows/build"
              className="inline-flex items-center justify-center rounded-md bg-zinc-900 px-6 py-3 text-sm font-medium text-zinc-50 shadow transition-colors hover:bg-zinc-900/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-950 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-50/90"
            >
              <Plus className="h-5 w-5 mr-2" />
              Create Workflow
            </Link>
          </div>
        </div>

        {/* Workflows Grid */}
        {workflows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center rounded-xl border border-dashed border-zinc-300 bg-white/50 dark:border-zinc-800 dark:bg-zinc-950/50 backdrop-blur-sm">
            <Workflow className="h-16 w-16 text-zinc-400 mb-4" />
            <h3 className="text-xl font-semibold mb-2 text-zinc-900 dark:text-zinc-50">No workflows yet</h3>
            <p className="text-zinc-500 mb-6 max-w-md">
              Create your first workflow to start automating on Somnia Shannon.
            </p>
            <Link
              href="/workflows/build"
              className="inline-flex items-center justify-center rounded-md bg-zinc-900 px-6 py-3 text-sm font-medium text-zinc-50 shadow transition-colors hover:bg-zinc-900/90 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-50/90"
            >
              <Plus className="h-5 w-5 mr-2" />
              Create Your First Workflow
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {workflows.map((w) => (
              <Link
                key={w.workflowId}
                href={`/workflows/${encodeURIComponent(w.workflowStringId)}`}
                className="group flex flex-col justify-between rounded-xl border border-zinc-200 bg-white p-6 transition-all hover:shadow-md hover:border-violet-500/50 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-violet-400/50"
              >
                <div>
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3 flex-1">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-violet-100 dark:bg-violet-900/30">
                        <Activity className="h-5 w-5 text-violet-600 dark:text-violet-400" />
                      </div>
                      <div className="flex-1 overflow-hidden">
                        <h3 className="text-lg font-semibold truncate text-zinc-900 dark:text-zinc-50">
                          {w.name || w.workflowStringId}
                        </h3>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Status</span>
                      <span className="font-medium capitalize">{w.status}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Kind</span>
                      <span className="font-medium capitalize">
                        {w.kind === "compiled" ? "compiled" : w.kind === "demo" ? "demo" : "workflow"}
                        {w.deployMode === "perNodeFanout" ? " (fan-out)" : ""}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Subscription</span>
                      <span className="font-medium">
                        #{w.subscriptionId}
                        {w.subscriptionIds && w.subscriptionIds.length > 1
                          ? ` (+${w.subscriptionIds.length - 1})`
                          : ""}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="mt-6 pt-4 border-t border-zinc-100 dark:border-zinc-800 text-xs text-zinc-500 flex justify-between items-center">
                  <span>{new Date(w.registeredAt).toLocaleDateString()}</span>
                  <span className="text-violet-600 dark:text-violet-400 font-medium group-hover:underline">
                    View Monitor →
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
