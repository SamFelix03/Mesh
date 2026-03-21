/**
 * End-to-end Shannon testnet flow:
 *
 *   cd backend && npx tsx scripts/e2e-shannon.ts
 *
 * Requires: `WORKFLOW_REGISTRY_ADDRESS`, `PRIVATE_KEY` (STT for gas; reactivity min balance per Somnia docs),
 * and `forge build` in ../contracts.
 *
 * Deploy registry first: `npx tsx scripts/deploy-registry.ts` or `forge script ... DeployMesh.s.sol`.
 */
import { loadBackendEnv } from "../src/loadEnv.js";
import { deployDemoWorkflow } from "../src/services/deployDemoWorkflow.js";
import { pingTriggerEmitter } from "../src/services/pingEmitter.js";
import { createPublicHttpClient } from "../src/sdk.js";
import { reactionSinkArtifact } from "../src/artifacts.js";

async function main() {
  loadBackendEnv();
  if (!process.env.PRIVATE_KEY) {
    throw new Error("PRIVATE_KEY required");
  }
  if (!process.env.WORKFLOW_REGISTRY_ADDRESS?.trim()) {
    throw new Error(
      "WORKFLOW_REGISTRY_ADDRESS required — run: npx tsx scripts/deploy-registry.ts (or forge script DeployMesh.s.sol)",
    );
  }

  const workflowStringId = `mesh-e2e-${Date.now()}`;
  console.log("Deploying demo workflow:", workflowStringId);
  const deployed = await deployDemoWorkflow({ workflowStringId });
  console.log(JSON.stringify(deployed, null, 2));

  console.log("Emitting Ping on trigger…");
  await pingTriggerEmitter(deployed.emitter, 1n);

  const publicClient = createPublicHttpClient();
  const art = reactionSinkArtifact();
  const deadline = Date.now() + 120_000;
  let hits = 0n;
  while (Date.now() < deadline) {
    hits = await publicClient.readContract({
      address: deployed.sink,
      abi: art.abi,
      functionName: "hitCount",
    });
    if (hits > 0n) break;
    await new Promise((r) => setTimeout(r, 2000));
  }

  if (hits === 0n) {
    throw new Error(
      "Timeout: ReactionSink.hitCount never increased — check reactivity subscription, gas, and STT balance",
    );
  }

  console.log("E2E OK — handler ran; hitCount =", hits.toString());
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
