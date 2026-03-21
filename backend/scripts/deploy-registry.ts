/**
 * Deploy WorkflowRegistry to Shannon (requires PRIVATE_KEY, forge-built artifacts).
 *
 *   cd backend && npx tsx scripts/deploy-registry.ts
 */
import { loadBackendEnv } from "../src/loadEnv.js";
import { deployWorkflowRegistry } from "../src/services/deployWorkflowRegistry.js";

async function main() {
  loadBackendEnv();
  const { address, txHash } = await deployWorkflowRegistry();
  console.log("WorkflowRegistry deployed:", address);
  console.log("Transaction:", txHash);
  console.log("\nSet in .env:\nWORKFLOW_REGISTRY_ADDRESS=" + address);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
