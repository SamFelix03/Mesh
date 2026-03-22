import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 dark:bg-black relative">
      <div 
        className="absolute inset-0 z-0 opacity-40 dark:opacity-10 pointer-events-none"
        style={{
          backgroundImage: 'url(/hero-bg.svg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center 80px',
          backgroundRepeat: 'no-repeat'
        }}
      />
      <div className="flex flex-col items-center justify-center gap-8 px-4 text-center w-full relative z-10">
        <div className="space-y-4 flex flex-col items-center justify-center text-center w-full">
          <h1 className="text-5xl font-bold tracking-tight sm:text-6xl flex flex-col items-center justify-center text-zinc-900 dark:text-zinc-50">
            <span className="bg-gradient-to-r from-violet-600 to-indigo-600 dark:from-violet-400 dark:to-indigo-400 text-transparent bg-clip-text">
              Mesh
            </span>
            <span className="block mt-2">
              Reactive Workflows
            </span>
          </h1>
          <p className="text-xl text-zinc-600 dark:text-zinc-400 max-w-2xl mx-auto">
            Cross-contract automation without bots. Build powerful reactive workflows on Somnia Shannon.
          </p>
        </div>
        <div className="flex flex-col gap-4 sm:flex-row">
          <Link
            href="/workflows"
            className="inline-flex items-center justify-center rounded-md bg-zinc-900 px-8 py-6 text-lg font-medium text-zinc-50 shadow transition-colors hover:bg-zinc-900/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-950 disabled:pointer-events-none disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-50/90 dark:focus-visible:ring-zinc-300"
          >
            Get Started
          </Link>
        </div>
      </div>
    </main>
  );
}

