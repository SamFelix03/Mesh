import { createWalletClient, http, isAddress, isHex, type Address, type Hex } from "viem";
import type { WorkflowDefinition } from "./dsl/types.js";
import { shannonTestnet } from "./shannonChain.js";
import { httpRpcUrl, requireDeployAccount } from "./sdk.js";
import type { EvaluationVerdict } from "./evaluateCondition.js";

const WEBHOOK_TIMEOUT_MS = 12_000;

function assertRawTxAllowed(): void {
  if (process.env.MESH_ALLOW_EVAL_RAW_TX !== "1") {
    throw new Error("rawTx hooks require MESH_ALLOW_EVAL_RAW_TX=1 in the API environment");
  }
}

/**
 * Run `definition.evaluationHooks.onPass` when hybrid evaluation passed.
 * Failures are logged; they do not revert the evaluation broadcast.
 */
export async function runEvaluationOnPassHooks(
  def: WorkflowDefinition,
  verdict: EvaluationVerdict,
  topics: readonly Hex[] | undefined,
): Promise<void> {
  const hooks = def.evaluationHooks?.onPass;
  if (!hooks?.length) return;

  const payload = {
    workflowId: def.id,
    pass: verdict.pass,
    reason: verdict.reason,
    observed: verdict.observed,
    threshold: verdict.threshold,
    topics,
  };

  for (const hook of hooks) {
    try {
      if (hook.type === "webhook") {
        const u = new URL(hook.url);
        if (u.protocol !== "http:" && u.protocol !== "https:") {
          throw new Error(`webhook url must be http(s): ${hook.url}`);
        }
        const ac = new AbortController();
        const t = setTimeout(() => ac.abort(), WEBHOOK_TIMEOUT_MS);
        await fetch(hook.url, {
          method: "POST",
          headers: { "content-type": "application/json", ...hook.headers },
          body: JSON.stringify(payload),
          signal: ac.signal,
        });
        clearTimeout(t);
      } else if (hook.type === "rawTx") {
        assertRawTxAllowed();
        if (!isAddress(hook.to) || !isHex(hook.data)) {
          throw new Error("rawTx.to / rawTx.data invalid");
        }
        const account = requireDeployAccount();
        const walletClient = createWalletClient({
          account,
          chain: shannonTestnet,
          transport: http(httpRpcUrl()),
        });
        const value = hook.valueWei ? BigInt(hook.valueWei) : 0n;
        await walletClient.sendTransaction({
          account,
          chain: shannonTestnet,
          to: hook.to as Address,
          data: hook.data as Hex,
          value,
        });
      }
    } catch (e) {
      console.error(`[evaluation] onPass hook failed (${def.id}):`, e instanceof Error ? e.message : e);
    }
  }
}
