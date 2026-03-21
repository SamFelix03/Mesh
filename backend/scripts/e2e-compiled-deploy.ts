/**
 * One-shot: deploy `MeshWorkflowExecutor` + root subscription from `templates/example.workflow.json`
 * (unique DSL id per run). Requires same env as `e2e-shannon.ts`.
 *
 *   cd backend && npx tsx scripts/e2e-compiled-deploy.ts
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { WorkflowDefinition } from "../src/dsl/types.js";
import { loadBackendEnv } from "../src/loadEnv.js";
import { deployCompiledWorkflow } from "../src/services/deployCompiledWorkflow.js";

async function main() {
  loadBackendEnv();
  const here = dirname(fileURLToPath(import.meta.url));
  const path = join(here, "..", "..", "templates", "example.workflow.json");
  const def = JSON.parse(readFileSync(path, "utf8")) as WorkflowDefinition;
  def.id = `mesh-compiled-e2e-${Date.now()}`;
  console.log("Deploying compiled workflow DSL id:", def.id);
  const r = await deployCompiledWorkflow(def);
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
