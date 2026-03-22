import Link from "next/link";
import { notFound } from "next/navigation";
import { WorkflowDetailView } from "../../../components/workflow-detail/WorkflowDetailView";
import { meshApiBase } from "../../../lib/meshConfig";

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

export default async function WorkflowDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await fetch(`${meshApiBase()}/workflows/${encodeURIComponent(id)}`, { cache: "no-store" });
  if (r.status === 404) notFound();
  if (!r.ok) {
    return (
      <div className="mx-auto max-w-lg px-6 py-24 text-center">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Could not load workflow</h1>
        <p className="mt-3 text-sm text-zinc-500">
          The Workflow Manager returned HTTP {r.status}. Check that the API is running,{" "}
          <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-900">WORKFLOW_REGISTRY_ADDRESS</code> is set on the server, and{" "}
          <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-900">NEXT_PUBLIC_MESH_API</code> points at it.
        </p>
        <Link href="/workflows" className="mt-8 inline-block text-sm text-violet-600 hover:underline dark:text-violet-400">
          ← Back to workflows
        </Link>
      </div>
    );
  }
  const data = (await r.json()) as OnChain;
  return <WorkflowDetailView pageId={id} data={data} />;
}
