import { SDK, type SubscriptionCallback } from "@somnia-chain/reactivity";
import { createPublicWsClient } from "./sdk.js";
import { startTraceSubscription } from "./traceEngine.js";
import type { TraceWsClient } from "./traceClientTypes.js";

const clients = new Set<TraceWsClient>();
let subscribePromise: Promise<unknown> | null = null;

function ensureTracePipeline(): void {
  if (subscribePromise) return;
  const sdk = new SDK({ public: createPublicWsClient() });
  subscribePromise = startTraceSubscription(
    sdk,
    (data: SubscriptionCallback) => {
      const payload = JSON.stringify({ t: Date.now(), result: data.result });
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
