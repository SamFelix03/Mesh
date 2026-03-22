import { SDK, type SubscriptionCallback } from "@somnia-chain/reactivity";
import { replyJsonStringify } from "./jsonSafe.js";
import { createPublicWsClient } from "./sdk.js";
import { startTraceSubscription } from "./traceEngine.js";
import type { TraceWsClient } from "./traceClientTypes.js";

function traceEnvelopeFromPush(data: SubscriptionCallback): string {
  const result = data.result as Record<string, unknown>;
  const txRaw = result.transactionHash ?? result.txHash;
  const transactionHash = typeof txRaw === "string" ? txRaw : undefined;
  const bn = result.blockNumber;
  const blockNumber =
    bn === undefined || bn === null
      ? undefined
      : typeof bn === "bigint"
        ? bn.toString()
        : String(bn);
  const li = result.logIndex;
  const logIndex =
    li === undefined || li === null
      ? undefined
      : typeof li === "bigint"
        ? Number(li)
        : Number(li);

  const envelope: Record<string, unknown> = { t: Date.now(), result: data.result };
  if (transactionHash) envelope.transactionHash = transactionHash;
  if (blockNumber !== undefined) envelope.blockNumber = blockNumber;
  if (logIndex !== undefined && !Number.isNaN(logIndex)) envelope.logIndex = logIndex;

  return replyJsonStringify(envelope);
}

const clients = new Set<TraceWsClient>();
let subscribePromise: Promise<unknown> | null = null;

function ensureTracePipeline(): void {
  if (subscribePromise) return;
  const sdk = new SDK({ public: createPublicWsClient() });
  subscribePromise = startTraceSubscription(
    sdk,
    (data: SubscriptionCallback) => {
      const payload = traceEnvelopeFromPush(data);
      for (const c of clients) {
        try {
          if (c.workflowIdFilter) {
            const topics = data.result?.topics;
            if (!Array.isArray(topics) || topics.length < 2) continue;
            if (String(topics[1]).toLowerCase() !== c.workflowIdFilter) continue;
          }
          c.send(payload);
        } catch {
          clients.delete(c);
        }
      }
    },
    (err) => {
      const msg = JSON.stringify({ t: Date.now(), error: err.message });
      for (const c of clients) {
        try {
          c.send(msg);
        } catch {
          clients.delete(c);
        }
      }
    },
  );
}

export function registerTraceClient(c: TraceWsClient): () => void {
  clients.add(c);
  ensureTracePipeline();
  return () => {
    clients.delete(c);
  };
}
