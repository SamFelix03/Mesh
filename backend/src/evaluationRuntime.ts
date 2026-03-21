import { watchFile } from "node:fs";
import { SDK } from "@somnia-chain/reactivity";
import { getAddress, type Hex } from "viem";
import { findSingleRootId } from "./compiler/dagOrder.js";
import type { WorkflowDefinition } from "./dsl/types.js";
import { evaluateRootCondition } from "./evaluateCondition.js";
import { broadcastEvaluation } from "./evaluationBroadcaster.js";
import { runEvaluationOnPassHooks } from "./evaluationHooks.js";
import { getWorkflowIndexFilePath, loadWorkflowIndex } from "./services/workflowIndex.js";
import { createPublicWsClient } from "./sdk.js";
import { workflowIdFromString } from "./workflowId.js";

type SubRecord = {
  stop: () => Promise<void>;
};

const active = new Map<string, SubRecord>();

async function startOneHybrid(
  def: WorkflowDefinition,
  sdk: SDK,
  _workflowStringId: string,
): Promise<() => Promise<void>> {
  let rootId: string;
  try {
    rootId = findSingleRootId(def);
  } catch (e) {
    throw new Error(`findSingleRootId: ${e instanceof Error ? e.message : e}`);
  }
  const root = def.nodes.find((n) => n.id === rootId);
  if (!root || root.trigger.type !== "event") {
    throw new Error("invalid hybrid root");
  }

  const ethCalls = (root.ethCalls ?? []).map((spec) => ({
    to: getAddress(spec.to),
    data: spec.data === "0x" || spec.data === undefined ? undefined : (spec.data as Hex),
  }));

  const workflowIdHex = workflowIdFromString(def.id);

  const sub = await sdk.subscribe({
    ethCalls,
    eventContractSources: [getAddress(root.trigger.emitter)],
    topicOverrides: [root.trigger.eventTopic0],
    onData: async (cb) => {
      const sim = (cb.result?.simulationResults ?? []) as Hex[];
      const verdict = evaluateRootCondition(root, sim);
      broadcastEvaluation({
        t: Date.now(),
        workflowStringId: def.id,
        workflowId: workflowIdHex,
        nodeId: rootId,
        pass: verdict.pass,
        reason: verdict.reason,
        observed: verdict.observed,
        threshold: verdict.threshold,
        simulationResultsCount: sim.length,
        topics: cb.result?.topics,
      });
      if (verdict.pass) {
        await runEvaluationOnPassHooks(def, verdict, cb.result?.topics);
      }
    },
    onError: (err) => {
      broadcastEvaluation({
        t: Date.now(),
        workflowStringId: def.id,
        workflowId: workflowIdHex,
        nodeId: rootId,
        pass: false,
        reason: `subscribe error: ${err.message}`,
        error: true,
      });
    },
  });

  if (sub instanceof Error) {
    throw sub;
  }

  return async () => {
    await sub.unsubscribe();
  };
}

/** Diff index vs active subscriptions; add/remove hybrid workflows. */
export async function syncEvaluationSubscriptions(): Promise<void> {
  const publicClient = createPublicWsClient();
  const sdk = new SDK({ public: publicClient });

  const { workflows } = loadWorkflowIndex();
  const desiredIds = new Set(
    workflows
      .filter((w) => w.hybridEvaluation && w.definition && w.status === "active")
      .map((w) => w.workflowStringId),
  );

  for (const [id, rec] of [...active.entries()]) {
    if (!desiredIds.has(id)) {
      await rec.stop().catch(() => {});
      active.delete(id);
      console.log(`[evaluation] removed subscription · ${id}`);
    }
  }

  for (const row of workflows) {
    if (!row.hybridEvaluation || !row.definition || row.status !== "active") continue;
    const id = row.workflowStringId;
    if (active.has(id)) continue;

    const def = row.definition as WorkflowDefinition;
    try {
      const stop = await startOneHybrid(def, sdk, id);
      active.set(id, { stop });
      console.log(`[evaluation] subscribed · ${id} · ${workflowIdFromString(def.id)}`);
    } catch (e) {
      console.error(`[evaluation] failed to start ${id}:`, e instanceof Error ? e.message : e);
    }
  }
}

/** Initial sync + watch `workflows-index.json` for adds/pauses/deletes. */
export async function startEvaluationEngineWithWatcher(): Promise<void> {
  await syncEvaluationSubscriptions();

  const p = getWorkflowIndexFilePath();
  watchFile(p, { interval: 2500 }, () => {
    void syncEvaluationSubscriptions().catch((err) => console.error("[evaluation] sync error:", err));
  });
  console.log(`[evaluation] watching index file for changes: ${p}`);
}
