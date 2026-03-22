"use client";

import { useEffect, useRef, useState } from "react";
import { formatTraceLine } from "../lib/traceDecode";
import { meshApiBase, meshTraceWebSocketUrl } from "../lib/meshConfig";

type Line = { id: number; t: number; raw: string; pretty: string };

type Props = {
  /** Resolved workflow id (bytes32 hex) — connects with `?workflowId=` for server-side filtering. */
  workflowIdBytes32?: string;
  /**
   * Comma-separated Mesh contracts that emit `WorkflowStepExecuted` for this workflow (executor or per-node addresses).
   * When set with {@link httpPullNonce} / {@link httpAnchorBlock}, refetches logs after Ping (HTTP backfill).
   */
  httpTraceContracts?: string;
  /** Increment after a successful Ping so we can scan blocks around the ping tx. */
  httpPullNonce?: number;
  /** Block number of the ping tx (from `POST /chain/ping`). */
  httpAnchorBlock?: string | null;
  /** Larger panel + scroll area for workflow detail and demos. */
  variant?: "compact" | "comfortable";
};

export function TraceFeed({
  workflowIdBytes32,
  httpTraceContracts,
  httpPullNonce = 0,
  httpAnchorBlock,
  variant = "compact",
}: Props) {
  const [lines, setLines] = useState<Line[]>([]);
  const [showRaw, setShowRaw] = useState(false);
  const [status, setStatus] = useState<"idle" | "connecting" | "open" | "error">("idle");
  /** Set when HTTP trace backfill fails (e.g. wrong API URL, 500, or RPC error). */
  const [pullNote, setPullNote] = useState<string | null>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const lineId = useRef(0);
  const seenPullKeys = useRef(new Set<string>());

  useEffect(() => {
    seenPullKeys.current.clear();
    lineId.current = 0;
    setLines([]);
    setPullNote(null);
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
      setStatus("idle");
    };
  }, [workflowIdBytes32]);

  useEffect(() => {
    const wf = workflowIdBytes32?.trim();
    const contracts = httpTraceContracts?.trim();
    if (!httpPullNonce || !wf || !contracts || !httpAnchorBlock?.trim()) return;

    let anchor: bigint;
    try {
      anchor = BigInt(httpAnchorBlock.trim());
    } catch {
      return;
    }

    setPullNote(null);

    const span = BigInt(999);
    const half = BigInt(499);
    /** ~symmetric window around ping block (RPC max 999-block span on Shannon). */
    const earlyFrom = anchor > half ? anchor - half : BigInt(0);
    const earlyTo = earlyFrom + span;
    /** Second pass: blocks after ping (handler tx often lands later). */
    const lateFrom = anchor;
    const lateTo = anchor + span;

    const mergeBatch = (batch: { transactionHash: string; logIndex: number; topics: string[]; data: string }[]) => {
      setLines((prev) => {
        let next = [...prev];
        for (const log of batch) {
          const key = `${log.transactionHash}-${log.logIndex}`;
          if (seenPullKeys.current.has(key)) continue;
          seenPullKeys.current.add(key);
          const raw = JSON.stringify({
            t: Date.now(),
            tracePull: true,
            result: {
              topics: log.topics,
              data: log.data,
              simulationResults: [],
            },
          });
          const pretty = formatTraceLine(raw);
          next.push({ id: ++lineId.current, t: Date.now(), raw, pretty });
        }
        return next.slice(-80);
      });
    };

    const pull = async (from: bigint, to: bigint, label: string) => {
      const u = new URL(`${meshApiBase()}/chain/trace-logs`);
      u.searchParams.set("workflowId", wf);
      u.searchParams.set("contracts", contracts);
      u.searchParams.set("fromBlock", from.toString());
      u.searchParams.set("toBlock", to.toString());
      try {
        const r = await fetch(u.toString());
        let j: { error?: string; logs?: { transactionHash: string; logIndex: number; topics: string[]; data: string }[] } =
          {};
        try {
          j = (await r.json()) as typeof j;
        } catch {
          /* non-JSON body */
        }
        if (!r.ok) {
          setPullNote(`${label}: HTTP ${r.status}${j.error ? ` · ${j.error}` : ""}`);
          return;
        }
        if (j.error) {
          setPullNote(`${label}: ${j.error}`);
          return;
        }
        mergeBatch(j.logs ?? []);
      } catch (e) {
        setPullNote(`${label}: ${e instanceof Error ? e.message : String(e)}`);
      }
    };

    const t1 = setTimeout(() => void pull(earlyFrom, earlyTo, "Trace backfill (≈ping block)"), 2000);
    const t2 = setTimeout(() => void pull(lateFrom, lateTo, "Trace backfill (after ping)"), 12000);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [httpPullNonce, httpAnchorBlock, httpTraceContracts, workflowIdBytes32]);

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
          Live trace (Somnia push + HTTP backfill after Ping)
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
        {pullNote ? (
          <div className="mb-2 rounded border border-amber-800/60 bg-amber-950/40 px-2 py-1.5 text-xs text-amber-200/90">
            {pullNote}
          </div>
        ) : null}
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
