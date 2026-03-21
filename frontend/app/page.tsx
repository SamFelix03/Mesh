import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-full flex-col bg-zinc-50 text-zinc-900 dark:bg-black dark:text-zinc-50">
      <header className="border-b border-zinc-200 bg-white px-6 py-4 dark:border-zinc-800 dark:bg-zinc-950">
        <nav className="mx-auto flex max-w-3xl items-center justify-between gap-4">
          <span className="font-semibold tracking-tight">Mesh</span>
          <div className="flex items-center gap-4">
            <Link
              href="/workflows/build"
              className="text-sm text-zinc-600 underline-offset-4 hover:text-zinc-900 hover:underline dark:text-zinc-400 dark:hover:text-zinc-100"
            >
              Create workflow
            </Link>
            <Link
              href="/workflows"
              className="text-sm text-zinc-600 underline-offset-4 hover:text-zinc-900 hover:underline dark:text-zinc-400 dark:hover:text-zinc-100"
            >
              Workflows
            </Link>
          </div>
        </nav>
      </header>
      <main className="mx-auto flex max-w-3xl flex-col gap-10 px-6 py-16">
        <div className="flex flex-col gap-4">
          <h1 className="text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
            Reactive workflows on Somnia Shannon
          </h1>
          <p className="text-lg leading-relaxed text-zinc-600 dark:text-zinc-400">
            Cross-contract automation without bots: validators invoke your <code className="rounded bg-zinc-200/80 px-1 dark:bg-zinc-900">SomniaEventHandler</code>{" "}
            nodes when subscribed events fire. Observability uses the same reactivity WebSocket push model.
          </p>
        </div>
        <div className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="text-sm font-medium uppercase tracking-wide text-zinc-500">Dashboard</h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Open the workflow list and a live trace panel (connects to the backend <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-900">/ws/trace</code>
            ).
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/workflows/build"
              className="inline-flex w-fit items-center rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-50 dark:hover:bg-zinc-800"
            >
              Open workflow builder
            </Link>
            <Link
              href="/workflows"
              className="inline-flex w-fit items-center rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
            >
              View workflows
            </Link>
          </div>
        </div>
        <p className="text-sm text-zinc-500">
          Product overview: <code className="rounded bg-zinc-200/80 px-1 dark:bg-zinc-900">README.md</code>. PRD:{" "}
          <code className="rounded bg-zinc-200/80 px-1 dark:bg-zinc-900">docs/mesh_prd.md</code>. Implementation status:{" "}
          <code className="rounded bg-zinc-200/80 px-1 dark:bg-zinc-900">docs/current-state-and-next.md</code>.           Dashboard / trace: <code className="rounded bg-zinc-200/80 px-1 dark:bg-zinc-900">docs/dashboard-and-trace.md</code>. Hybrid eval:{" "}
          <code className="rounded bg-zinc-200/80 px-1 dark:bg-zinc-900">docs/evaluation-engine.md</code>.
        </p>
      </main>
    </div>
  );
}
