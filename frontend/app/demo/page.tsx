import Link from "next/link";
import { DemoExperience } from "../../components/demo/DemoExperience";
import { meshApiBase } from "../../lib/meshConfig";

type Row = {
  workflowStringId: string;
  workflowId: string;
  name?: string;
  emitter: string;
  hybridEvaluation?: boolean;
  deployMode?: string;
  workflowNode?: string;
  nodeAddresses?: string[];
};

async function fetchWorkflows(): Promise<Row[]> {
  const r = await fetch(`${meshApiBase()}/workflows`, { cache: "no-store" });
  if (!r.ok) return [];
  const j = (await r.json()) as { workflows: Row[] };
  return j.workflows ?? [];
}

export default async function DemoPage() {
  const workflows = await fetchWorkflows();
  const hybrid = workflows.find((w) => w.workflowStringId === "mesh-showcase-shannon") ?? null;
  const fanout = workflows.find((w) => w.workflowStringId === "mesh-demo-fanout-shannon") ?? null;
  const emitter =
    hybrid?.emitter && hybrid.emitter !== "0x0000000000000000000000000000000000000000"
      ? hybrid.emitter
      : fanout?.emitter && fanout.emitter !== "0x0000000000000000000000000000000000000000"
        ? fanout.emitter
        : null;

  return (
    <main className="min-h-screen bg-zinc-50 dark:bg-black">
      <div
        className="pointer-events-none absolute inset-0 z-0 opacity-40 dark:opacity-10"
        style={{
          backgroundImage: "url(/hero-bg.svg)",
          backgroundSize: "cover",
          backgroundPosition: "center 80px",
          backgroundRepeat: "no-repeat",
        }}
      />
      <div className="relative z-10 mx-auto max-w-6xl px-4 py-16 md:py-20">
        <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200">
          ← Home
        </Link>
        <Link href="/workflows" className="ml-4 text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200">
          All workflows
        </Link>

        <header className="mt-6 max-w-3xl">
          <h1 className="text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">Shannon live demo</h1>
          <p className="mt-4 text-lg text-zinc-600 dark:text-zinc-400">
            Two production-style workflows on testnet: a <strong>hybrid executor</strong> (ethCalls + evaluation + emit) and a{" "}
            <strong>per-node fan-out</strong> pipeline. Ping once to drive subscriptions, traces, and (for demo 1) hybrid verdicts.
          </p>
        </header>

        <div className="mt-12">
          <DemoExperience workflows={workflows} emitter={emitter} hybrid={hybrid} fanout={fanout} />
        </div>
      </div>
    </main>
  );
}
