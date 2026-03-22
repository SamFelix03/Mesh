"use client";

import { useEffect, useRef, useState } from "react";
import { formatTraceLine } from "../lib/traceDecode";
import { meshTraceWebSocketUrl } from "../lib/meshConfig";

type Line = { id: number; t: number; raw: string; pretty: string };

type Props = {
  /** Resolved workflow id (bytes32 hex) — connects with `?workflowId=` for server-side filtering. */
  workflowIdBytes32?: string;
  /** Larger panel + scroll area for workflow detail and demos. */
  variant?: "compact" | "comfortable";
};

export function TraceFeed({ workflowIdBytes32, variant = "compact" }: Props) {
  const [lines, setLines] = useState<Line[]>([]);
  const [showRaw, setShowRaw] = useState(false);
  const [status, setStatus] = useState<"idle" | "connecting" | "open" | "error">("idle");
  const bottom = useRef<HTMLDivElement>(null);
  const lineId = useRef(0);

  useEffect(() => {
    const url = meshTraceWebSocketUrl(workflowIdBytes32);
    setStatus("connecting");
    const ws = new WebSocket(url);
    ws.onopen = () => setStatus("open");
    ws.onerror = () => setStatus("error");
    ws.onmessage = (ev) => {
      const raw = typeof ev.data === "string" ? ev.data : "(binary)";
      const pretty = formatTraceLine(raw);
      setLines((prev) => {
        const id = ++lineId.current;
        const next = [...prev, { id, t: Date.now(), raw, pretty }];
        return next.slice(-80);
      });
    };
    return () => {
      ws.close();
      lineId.current = 0;
      setStatus("idle");
    };
  }, [workflowIdBytes32]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth" });
  }, [lines]);

  const filtered = Boolean(workflowIdBytes32?.trim());

  const box =
    variant === "comfortable"
      ? "rounded-xl border border-zinc-200 bg-zinc-950 p-5 font-mono text-sm text-zinc-100 dark:border-zinc-800"
      : "rounded-lg border border-zinc-200 bg-zinc-950 p-3 font-mono text-xs text-zinc-100 dark:border-zinc-800";
  const scrollMax = variant === "comfortable" ? "max-h-[min(28rem,55vh)]" : "max-h-64";

  return (
    <div className={box}>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-zinc-400">
        <span>
          Live trace (Somnia reactivity push)
          {filtered ? (
            <span className="ml-2 text-emerald-400/90">· filtered to this workflow</span>
          ) : null}
        </span>
        <span className="flex items-center gap-3">
          <label className="flex cursor-pointer items-center gap-1.5 text-[0.65rem] uppercase tracking-wide">
            <input type="checkbox" checked={showRaw} onChange={(e) => setShowRaw(e.target.checked)} className="rounded" />
            raw JSON
          </label>
          <span className="uppercase">{status}</span>
        </span>
      </div>
      <div className={`${scrollMax} overflow-y-auto whitespace-pre-wrap break-all`}>
        {lines.length === 0 ? (
          <span className="text-zinc-500">Waiting for events…</span>
        ) : (
          lines.map((l) => (
            <div key={l.id} className="border-b border-zinc-800/80 py-1 last:border-0">
              {showRaw ? l.raw : l.pretty}
            </div>
          ))
        )}
        <div ref={bottom} />
      </div>
    </div>
  );
}
