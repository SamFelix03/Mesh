/**
 * One-shot: deploy `MeshWorkflowExecutor` + root subscription from `backend/templates/demo-01-hybrid-executor.workflow.json`
 * (unique DSL id per run). Requires same env as `e2e-shannon.ts`.
 *
 *   cd backend && npx tsx scripts/e2e-compiled-deploy.ts
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getAddress, isAddress } from "viem";
import type { WorkflowDefinition } from "../src/dsl/types.js";
import { definitionForOnChainCompile, validateHybridWorkflow } from "../src/hybridWorkflow.js";
import { loadBackendEnv } from "../src/loadEnv.js";
import { deployCompiledWorkflow } from "../src/services/deployCompiledWorkflow.js";

async function main() {
  loadBackendEnv();
  const here = dirname(fileURLToPath(import.meta.url));
  const path = join(here, "..", "templates", "demo-01-hybrid-executor.workflow.json");
  let def = JSON.parse(readFileSync(path, "utf8")) as WorkflowDefinition;
  const em = process.env.E2E_EMITTER?.trim();
  if (em && isAddress(em)) {
    const a = getAddress(em);
    def = JSON.parse(JSON.stringify(def).replace(/0x1111111111111111111111111111111111111111/gi, a)) as WorkflowDefinition;
  }
  def.id = `mesh-compiled-e2e-${Date.now()}`;
  console.log("Deploying compiled workflow DSL id:", def.id);
  validateHybridWorkflow(def); // after optional emitter injection
  const r = await deployCompiledWorkflow(definitionForOnChainCompile(def));
  console.log(
    JSON.stringify(
      {
        workflowId: r.workflowId,
        executor: r.executor,
        subscriptionId: r.subscriptionId,
        rootTrigger: r.rootTrigger,
        transactionHashes: r.transactionHashes,
      },
      (_, v) => (typeof v === "bigint" ? v.toString() : v),
      2,
    ),
  );
  console.log("Compiled deploy OK.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
