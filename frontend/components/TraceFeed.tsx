"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  formatChainTimestamp,
  parseTraceMessage,
  shortHex,
  type ParsedTraceRow,
} from "../lib/traceDecode";
import { meshApiBase, meshTraceWebSocketUrl, shannonExplorerBlockUrl, shannonExplorerTxLogUrl } from "../lib/meshConfig";

type TraceLine = { id: number; t: number; raw: string; parsed: ParsedTraceRow };

const CACHE_V = 1;

function storageKeyForWorkflow(workflowIdBytes32?: string): string {
  const id = workflowIdBytes32?.trim() || "__all__";
  return `mesh-trace:v${CACHE_V}:${id}`;
}

function loadTraceCache(key: string): TraceLine[] {
  if (typeof window === "undefined") return [];
  try {
    const s = localStorage.getItem(key);
    if (!s) return [];
    const o = JSON.parse(s) as { v?: number; lines?: { id: number; t: number; raw: string }[] };
    if (!Array.isArray(o.lines)) return [];
    return o.lines.map((l) => ({
      id: l.id,
      t: l.t,
      raw: l.raw,
      parsed: parseTraceMessage(l.raw),
    }));
  } catch {
    return [];
  }
}

function saveTraceCache(key: string, lines: TraceLine[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(
      key,
      JSON.stringify({
        v: CACHE_V,
        lines: lines.map((l) => ({ id: l.id, t: l.t, raw: l.raw })),
      }),
    );
  } catch {
    /* quota / private mode */
  }
}

function formatPrettyJson(raw: string): string {
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}

function ExplorerMetaRow({
  txHash,
  blockNumber,
  logIndex,
  labelCls,
  linkTone,
}: {
  txHash?: string;
  blockNumber?: string;
  logIndex?: number;
  labelCls: string;
  linkTone: "violet" | "sky";
}) {
  const txOk = txHash && /^0x[a-fA-F0-9]{64}$/i.test(txHash);
  const blkOk = blockNumber && /^\d+$/.test(blockNumber);
  if (!txOk && !blkOk) return null;
  const txCls =
    linkTone === "violet"
      ? "text-violet-400 hover:text-violet-300"
      : "text-sky-400 hover:text-sky-300";
  const blkCls =
    linkTone === "violet"
      ? "text-violet-400/90 hover:text-violet-300"
      : "text-sky-400/90 hover:text-sky-300";
  return (
    <div className="grid grid-cols-[5.5rem_1fr] gap-2 sm:grid-cols-[7rem_1fr]">
      <dt className={labelCls}>Explorer</dt>
      <dd className="flex flex-wrap gap-x-3 gap-y-1 text-[0.8rem]">
        {txOk ? (
          <a
            href={shannonExplorerTxLogUrl(txHash!, logIndex)}
            target="_blank"
            rel="noopener noreferrer"
            className={`font-medium underline-offset-2 hover:underline ${txCls}`}
          >
            Tx / log
          </a>
        ) : null}
        {blkOk ? (
          <a
            href={shannonExplorerBlockUrl(blockNumber!)}
            target="_blank"
            rel="noopener noreferrer"
            className={`font-medium underline-offset-2 hover:underline ${blkCls}`}
          >
            Block {blockNumber}
          </a>
        ) : null}
      </dd>
    </div>
  );
}

function TraceRowView({
  line,
  showRaw,
  dense,
  stepNodeLabels,
}: {
  line: TraceLine;
  showRaw: boolean;
  dense: boolean;
  stepNodeLabels?: Record<string, string>;
}) {
  const p = line.parsed;
  const pad = dense ? "py-1.5 px-2" : "py-2.5 px-3";
  const labelCls = dense ? "text-[0.65rem] uppercase tracking-wide text-zinc-500" : "text-[0.65rem] uppercase tracking-wide text-zinc-500";

  if (showRaw) {
    return (
      <div className={`rounded-lg border border-zinc-800 bg-black/40 ${pad} font-mono text-[0.7rem] leading-relaxed text-zinc-300`}>
        <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-all">{formatPrettyJson(line.raw)}</pre>
      </div>
    );
  }

  if (p.kind === "WorkflowStepExecuted") {
    const stepName = stepNodeLabels?.[p.nodeId.toLowerCase()];
    const ts = formatChainTimestamp(p.timestamp);
    const recv =
      p.receivedAtMs != null
        ? (() => {
            const d = new Date(p.receivedAtMs);
            return (
              d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" }) +
              `.${String(d.getMilliseconds()).padStart(3, "0")}`
            );
          })()
        : "—";
    return (
      <div className={`rounded-lg border border-violet-900/50 bg-violet-950/25 ${pad}`}>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <span className="text-[0.7rem] font-semibold uppercase tracking-wide text-violet-300/95">WorkflowStepExecuted</span>
          <span
            className={`rounded px-1.5 py-0.5 text-[0.6rem] font-medium uppercase ${
              p.source === "http" ? "bg-amber-900/50 text-amber-200" : "bg-emerald-900/40 text-emerald-200"
            }`}
          >
            {p.source === "http" ? "HTTP pull" : "WS push"}
          </span>
        </div>
        <dl className={`grid gap-1.5 ${dense ? "text-xs" : "text-sm"}`}>
          <div className="grid grid-cols-[5.5rem_1fr] gap-2 sm:grid-cols-[7rem_1fr]">
            <dt className={labelCls}>Workflow</dt>
            <dd className="font-mono text-zinc-200" title={p.workflowId}>
              {shortHex(p.workflowId, 10, 8)}
            </dd>
          </div>
          <div className="grid grid-cols-[5.5rem_1fr] gap-2 sm:grid-cols-[7rem_1fr]">
            <dt className={labelCls}>Step</dt>
            <dd title={p.nodeId}>
              {stepName ? (
                <div className="mb-0.5 font-sans text-sm font-semibold text-zinc-100">{stepName}</div>
              ) : null}
              <div className="font-mono text-xs text-zinc-300">{shortHex(p.nodeId, 10, 8)}</div>
            </dd>
          </div>
          <ExplorerMetaRow
            txHash={p.transactionHash}
            blockNumber={p.blockNumber}
            logIndex={p.logIndex}
            labelCls={labelCls}
            linkTone="violet"
          />
          <div className="grid grid-cols-[5.5rem_1fr] gap-2 sm:grid-cols-[7rem_1fr]">
            <dt className={labelCls}>Chain time</dt>
            <dd className="text-zinc-100">
              <span className="block">{ts.label}</span>
              {ts.sub ? <span className="text-[0.65rem] text-zinc-500">{ts.sub}</span> : null}
            </dd>
          </div>
          <div className="grid grid-cols-[5.5rem_1fr] gap-2 sm:grid-cols-[7rem_1fr]">
            <dt className={labelCls}>Received</dt>
            <dd className="font-mono text-zinc-400">{recv}</dd>
          </div>
        </dl>
      </div>
    );
  }

  if (p.kind === "WorkflowNoOp") {
    const stepName = stepNodeLabels?.[p.nodeId.toLowerCase()];
    const recv =
      p.receivedAtMs != null
        ? (() => {
            const d = new Date(p.receivedAtMs);
            return (
              d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" }) +
              `.${String(d.getMilliseconds()).padStart(3, "0")}`
            );
          })()
        : "—";
    return (
      <div className={`rounded-lg border border-sky-900/50 bg-sky-950/20 ${pad}`}>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <span className="text-[0.7rem] font-semibold uppercase tracking-wide text-sky-300/95">WorkflowNoOp</span>
          <span
            className={`rounded px-1.5 py-0.5 text-[0.6rem] font-medium uppercase ${
              p.source === "http" ? "bg-amber-900/50 text-amber-200" : "bg-emerald-900/40 text-emerald-200"
            }`}
          >
            {p.source === "http" ? "HTTP pull" : "WS push"}
          </span>
        </div>
        <dl className={`grid gap-1.5 ${dense ? "text-xs" : "text-sm"}`}>
          <div className="grid grid-cols-[5.5rem_1fr] gap-2 sm:grid-cols-[7rem_1fr]">
            <dt className={labelCls}>Workflow</dt>
            <dd className="font-mono text-zinc-200">{shortHex(p.workflowId, 10, 8)}</dd>
          </div>
          <div className="grid grid-cols-[5.5rem_1fr] gap-2 sm:grid-cols-[7rem_1fr]">
            <dt className={labelCls}>Step</dt>
            <dd title={p.nodeId}>
              {stepName ? (
                <div className="mb-0.5 font-sans text-sm font-semibold text-zinc-100">{stepName}</div>
              ) : null}
              <div className="font-mono text-xs text-zinc-300">{shortHex(p.nodeId, 10, 8)}</div>
            </dd>
          </div>
          <ExplorerMetaRow
            txHash={p.transactionHash}
            blockNumber={p.blockNumber}
            logIndex={p.logIndex}
            labelCls={labelCls}
            linkTone="sky"
          />
          <div className="grid grid-cols-[5.5rem_1fr] gap-2 sm:grid-cols-[7rem_1fr]">
            <dt className={labelCls}>Reason</dt>
            <dd className="text-zinc-200">{p.reason}</dd>
          </div>
          <div className="grid grid-cols-[5.5rem_1fr] gap-2 sm:grid-cols-[7rem_1fr]">
            <dt className={labelCls}>Received</dt>
            <dd className="font-mono text-zinc-400">{recv}</dd>
          </div>
        </dl>
      </div>
    );
  }

  if (p.kind === "error") {
    return (
      <div className={`rounded-lg border border-red-900/50 bg-red-950/25 ${pad} text-sm text-red-200/90`}>
        <span className="text-[0.65rem] font-semibold uppercase text-red-400/90">Error</span>
        <p className="mt-1 font-mono text-xs">{p.message}</p>
      </div>
    );
  }

  return (
    <div className={`rounded-lg border border-zinc-800 bg-zinc-900/40 ${pad}`}>
      <div className="text-[0.65rem] font-semibold uppercase text-zinc-500">{p.title}</div>
      {p.detail ? <p className="mt-1 text-xs text-zinc-400">{p.detail}</p> : null}
      <pre className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap break-all font-mono text-[0.65rem] text-zinc-500">
        {p.raw}
      </pre>
    </div>
  );
}

type Props = {
  workflowIdBytes32?: string;
  httpTraceContracts?: string;
  httpPullNonce?: number;
  httpAnchorBlock?: string | null;
  /** Lowercase `bytes32` step id → step display name (from {@link buildStepNodeLabelMap}). */
  stepNodeLabels?: Record<string, string>;
  variant?: "compact" | "comfortable";
};

export function TraceFeed({
  workflowIdBytes32,
  httpTraceContracts,
  httpPullNonce = 0,
  httpAnchorBlock,
  stepNodeLabels,
  variant = "compact",
}: Props) {
  const cacheKey = useMemo(() => storageKeyForWorkflow(workflowIdBytes32), [workflowIdBytes32]);
  const [lines, setLines] = useState<TraceLine[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [showRaw, setShowRaw] = useState(false);
  const [status, setStatus] = useState<"idle" | "connecting" | "open" | "error">("idle");
  const [pullNote, setPullNote] = useState<string | null>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const lineId = useRef(0);
  const seenPullKeys = useRef(new Set<string>());

  useEffect(() => {
    const loaded = loadTraceCache(cacheKey);
    setLines(loaded);
    lineId.current = loaded.reduce((m, l) => Math.max(m, l.id), 0);
    seenPullKeys.current.clear();
    setHydrated(true);
  }, [cacheKey]);

  useEffect(() => {
    if (!hydrated) return;
    saveTraceCache(cacheKey, lines);
  }, [cacheKey, lines, hydrated]);

  const clearTrace = useCallback(() => {
    setLines([]);
    lineId.current = 0;
    seenPullKeys.current.clear();
    try {
      localStorage.removeItem(cacheKey);
    } catch {
      /* ignore */
    }
  }, [cacheKey]);

  useEffect(() => {
    if (!hydrated) return undefined;
    const url = meshTraceWebSocketUrl(workflowIdBytes32);
    setStatus("connecting");
    const ws = new WebSocket(url);
    ws.onopen = () => setStatus("open");
    ws.onerror = () => setStatus("error");
    ws.onmessage = (ev) => {
      const raw = typeof ev.data === "string" ? ev.data : "(binary)";
      setLines((prev) => {
        const id = ++lineId.current;
        return [...prev, { id, t: Date.now(), raw, parsed: parseTraceMessage(raw) }];
      });
    };
    return () => {
      ws.close();
      setStatus("idle");
    };
  }, [workflowIdBytes32, hydrated]);

  useEffect(() => {
    if (!hydrated) return undefined;
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
    const earlyFrom = anchor > half ? anchor - half : BigInt(0);
    const earlyTo = earlyFrom + span;
    const lateFrom = anchor;
    const lateTo = anchor + span;

    const mergeBatch = (
      batch: {
        transactionHash: string;
        logIndex: number;
        blockNumber: string;
        topics: string[];
        data: string;
      }[],
    ) => {
      setLines((prev) => {
        let next = [...prev];
        for (const log of batch) {
          const key = `${log.transactionHash}-${log.logIndex}`;
          if (seenPullKeys.current.has(key)) continue;
          seenPullKeys.current.add(key);
          const raw = JSON.stringify({
            t: Date.now(),
            tracePull: true,
            transactionHash: log.transactionHash,
            blockNumber: log.blockNumber,
            logIndex: log.logIndex,
            result: {
              topics: log.topics,
              data: log.data,
              simulationResults: [],
            },
          });
          next.push({ id: ++lineId.current, t: Date.now(), raw, parsed: parseTraceMessage(raw) });
        }
        return next;
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
        let j: {
          error?: string;
          logs?: {
            transactionHash: string;
            logIndex: number;
            blockNumber: string;
            topics: string[];
            data: string;
          }[];
        } = {};
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
  }, [httpPullNonce, httpAnchorBlock, httpTraceContracts, workflowIdBytes32, hydrated]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth" });
  }, [lines.length]);

  const filtered = Boolean(workflowIdBytes32?.trim());
  const dense = variant === "compact";

  const box =
    variant === "comfortable"
      ? "rounded-xl border border-zinc-200 bg-zinc-950 p-5 font-mono text-sm text-zinc-100 dark:border-zinc-800"
      : "rounded-lg border border-zinc-200 bg-zinc-950 p-3 font-mono text-xs text-zinc-100 dark:border-zinc-800";
  const scrollMax = variant === "comfortable" ? "max-h-[min(28rem,55vh)]" : "max-h-64";

  return (
    <div className={box}>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-zinc-400">
        <span>
          Live trace
          {filtered ? (
            <span className="ml-2 text-emerald-400/90">· filtered to this workflow</span>
          ) : null}
        </span>
        <span className="flex flex-wrap items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={clearTrace}
            className="rounded-md border border-zinc-600 px-2 py-1 text-[0.65rem] font-medium uppercase tracking-wide text-zinc-300 transition hover:border-zinc-500 hover:bg-zinc-800/80"
          >
            Clear
          </button>
          <label className="flex cursor-pointer items-center gap-1.5 text-[0.65rem] uppercase tracking-wide">
            <input type="checkbox" checked={showRaw} onChange={(e) => setShowRaw(e.target.checked)} className="rounded" />
            raw JSON
          </label>
          <span className="uppercase">{status}</span>
        </span>
      </div>
      <div className={`${scrollMax} space-y-2 overflow-y-auto`}>
        {pullNote ? (
          <div className="rounded border border-amber-800/60 bg-amber-950/40 px-2 py-1.5 text-xs text-amber-200/90">
            {pullNote}
          </div>
        ) : null}
        {lines.length === 0 ? (
          <span className="text-zinc-500">Waiting for events…</span>
        ) : (
          lines.map((l) => (
            <TraceRowView key={l.id} line={l} showRaw={showRaw} dense={dense} stepNodeLabels={stepNodeLabels} />
          ))
        )}
        <div ref={bottom} />
      </div>
    </div>
  );
}
