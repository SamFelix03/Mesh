"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { HelpCircle, X } from "lucide-react";

function HelpModalContent({ onClose }: { onClose: () => void }) {
  return (
    <div className="space-y-3 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
      <p>
        <strong className="text-zinc-900 dark:text-zinc-100">On-chain (deploy)</strong> — After <strong>Deploy</strong>, Somnia calls your{" "}
        <code className="rounded bg-zinc-200/80 px-1 font-mono text-xs dark:bg-zinc-800">MeshWorkflowExecutor</code> when the <strong>root</strong> trigger fires.
        Each step&apos;s <strong>Action</strong> (
        <code className="rounded bg-zinc-200/80 px-1 font-mono text-xs dark:bg-zinc-800">noop</code> /{" "}
        <code className="rounded bg-zinc-200/80 px-1 font-mono text-xs dark:bg-zinc-800">call</code> /{" "}
        <code className="rounded bg-zinc-200/80 px-1 font-mono text-xs dark:bg-zinc-800">emit</code>) runs <strong>inside that contract</strong>. Use a real{" "}
        <strong>emitter</strong> address if you expect it to fire on Shannon.
      </p>
      <p>
        <strong className="text-zinc-900 dark:text-zinc-100">Off-chain hybrid (optional)</strong> — Only on the step connected from <strong>Start</strong>. The{" "}
        <strong>backend</strong> opens a separate <code className="rounded bg-zinc-200/80 px-1 font-mono text-xs dark:bg-zinc-800">sdk.subscribe</code> with your bundled{" "}
        <code className="rounded bg-zinc-200/80 px-1 font-mono text-xs dark:bg-zinc-800">ethCall</code>, evaluates a <strong>uint256 condition</strong>, and can POST a webhook. It
        does <strong>not</strong> change on-chain execution. Requires <code className="rounded bg-zinc-200/80 px-1 font-mono text-xs dark:bg-zinc-800">EVALUATION_ENGINE=1</code>{" "}
        on the API. See repo <code className="rounded bg-zinc-200/80 px-1 font-mono text-xs dark:bg-zinc-800">docs/evaluation-engine.md</code>.
      </p>
      <p>
        <strong className="text-zinc-900 dark:text-zinc-100">See it run</strong> — After deploy, open{" "}
        <Link
          href="/workflows"
          className="font-medium text-violet-600 underline underline-offset-2 dark:text-violet-400"
          onClick={() => onClose()}
        >
          Workflows
        </Link>{" "}
        → your workflow → <strong>Live trace</strong> (needs <code className="rounded bg-zinc-200/80 px-1 font-mono text-xs dark:bg-zinc-800">TRACE_ENGINE=1</code> on the API).
        Hybrid verdicts appear under <strong>Off-chain evaluation</strong> when the index marks the workflow hybrid and the eval engine is on.
      </p>
    </div>
  );
}

export default function WorkflowBuilderHelp() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const modal = open
    ? createPortal(
      <div
        className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4 backdrop-blur-[1px]"
        role="presentation"
        onClick={() => setOpen(false)}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="workflow-help-title"
          className="flex max-h-[min(85vh,640px)] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-xl dark:border-zinc-700 dark:bg-zinc-900"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-zinc-200 px-4 py-3 dark:border-zinc-700">
            <h2 id="workflow-help-title" className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
              How workflows run &amp; how to test
            </h2>
            <button
              type="button"
              aria-label="Close"
              onClick={() => setOpen(false)}
              className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            <HelpModalContent onClose={() => setOpen(false)} />
          </div>
        </div>
      </div>,
      document.body,
    )
    : null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-left text-xs font-medium text-zinc-800 shadow-sm hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
      >
        <HelpCircle className="h-4 w-4 shrink-0 text-violet-600 dark:text-violet-400" aria-hidden />
        How workflows run &amp; how to test
      </button>
      {modal}
    </>
  );
}
