"use client";

import { useEffect, useRef, useState } from "react";
import { meshEvaluationWebSocketUrl } from "../lib/meshConfig";

type Line = { t: number; raw: string; pretty: string };

function formatEvalLine(raw: string): string {
  try {
    const o = JSON.parse(raw) as {
      pass?: boolean;
      reason?: string;
      workflowStringId?: string;
      observed?: string;
      threshold?: string;
      error?: boolean;
      simulationResultsCount?: number;
    };
    if (o.error) return `error · ${o.reason ?? raw}`;
    const verdict = o.pass === true ? "PASS" : o.pass === false ? "FAIL" : "?";
    const bits = [verdict, o.workflowStringId, o.reason, o.observed != null ? `obs=${o.observed}` : "", o.threshold != null ? `thr=${o.threshold}` : ""].filter(
      Boolean,
    );
    return bits.join(" · ");
  } catch {
    return raw;
  }
}

type Props = {
  workflowIdBytes32?: string;
  variant?: "compact" | "comfortable";
};

export function EvalFeed({ workflowIdBytes32, variant = "compact" }: Props) {
  const [lines, setLines] = useState<Line[]>([]);
  const [showRaw, setShowRaw] = useState(false);
  const [status, setStatus] = useState<"idle" | "connecting" | "open" | "error">("idle");
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const url = meshEvaluationWebSocketUrl(workflowIdBytes32);
    setStatus("connecting");
    const ws = new WebSocket(url);
    ws.onopen = () => setStatus("open");
    ws.onerror = () => setStatus("error");
    ws.onmessage = (ev) => {
      const raw = typeof ev.data === "string" ? ev.data : "(binary)";
      setLines((prev) => [...prev, { t: Date.now(), raw, pretty: formatEvalLine(raw) }].slice(-80));
    };
    return () => {
      ws.close();
      setStatus("idle");
    };
  }, [workflowIdBytes32]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth" });
  }, [lines.length]);

  const filtered = Boolean(workflowIdBytes32?.trim());

  const box =
    variant === "comfortable"
      ? "rounded-xl border border-emerald-900/40 bg-emerald-950/40 p-5 font-mono text-sm text-emerald-100"
      : "rounded-lg border border-emerald-900/40 bg-emerald-950/40 p-3 font-mono text-xs text-emerald-100";
  const scrollMax = variant === "comfortable" ? "max-h-[min(24rem,50vh)]" : "max-h-48";

  return (
    <div className={box}>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-emerald-300/80">
        <span>
          Off-chain evaluation (ethCalls + condition)
          {filtered ? <span className="ml-2 text-emerald-400">· scoped</span> : null}
        </span>
        <span className="flex items-center gap-3">
          <label className="flex cursor-pointer items-center gap-1.5 text-[0.65rem] uppercase tracking-wide">
            <input type="checkbox" checked={showRaw} onChange={(e) => setShowRaw(e.target.checked)} className="rounded" />
            raw JSON
          </label>
          <span className="uppercase">{status}</span>
        </span>
      </div>
      <p className="mb-2 text-[0.65rem] text-emerald-400/70">
        Requires API <code className="rounded bg-black/30 px-1">EVALUATION_ENGINE=1</code> and a hybrid workflow in the index.
      </p>
      <div className={`${scrollMax} overflow-y-auto whitespace-pre-wrap break-all`}>
        {lines.length === 0 ? (
          <span className="text-emerald-600/80">No verdicts yet…</span>
        ) : (
          lines.map((l, i) => (
            <div key={`${l.t}-${i}`} className="border-b border-emerald-900/50 py-1 last:border-0">
              {showRaw ? l.raw : l.pretty}
            </div>
          ))
        )}
        <div ref={bottom} />
      </div>
    </div>
  );
}
