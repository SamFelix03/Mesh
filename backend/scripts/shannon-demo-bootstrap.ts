#!/usr/bin/env npx tsx
/**
 * Shannon demo: optional new TriggerEmitter (or DEMO_TRIGGER_EMITTER), deploy
 *   demo-01 (hybrid single executor) + demo-02 (per-node fan-out),
 * merge into workflows-index.json (drops prior rows for those two ids).
 *
 * If a workflow id is already on-chain, keeps the existing index row when present.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createWalletClient, getAddress, http, isAddress, zeroAddress, type Address } from "viem";
import { triggerEmitterArtifact } from "../src/artifacts.js";
import type { WorkflowDefinition } from "../src/dsl/types.js";
import { definitionForOnChainCompile, needsHybridEvaluation, validateHybridWorkflow } from "../src/hybridWorkflow.js";
import { loadBackendEnv } from "../src/loadEnv.js";
import { shannonTestnet } from "../src/shannonChain.js";
import { createPublicHttpClient, httpRpcUrl, meshContractDeployGas, requireDeployAccount } from "../src/sdk.js";
import { deployCompiledWorkflow } from "../src/services/deployCompiledWorkflow.js";
import { deployPerNodeFanoutWorkflow } from "../src/services/deployPerNodeFanout.js";
import { getWorkflowIndexFilePath, loadWorkflowIndex, type IndexedWorkflow } from "../src/services/workflowIndex.js";

loadBackendEnv();

const DEMO_IDS = new Set(["mesh-showcase-shannon", "mesh-demo-fanout-shannon"]);

function backendPackageRoot(): string {
  return join(dirname(fileURLToPath(import.meta.url)), "..");
}

function deployGas(): bigint {
  const g = meshContractDeployGas();
  return g ?? 30_000_000n;
}

function isAlreadyRegistered(err: unknown): boolean {
  return err instanceof Error && err.message.includes("already registered");
}

function injectEmitter(defPath: string, emitter: Address): WorkflowDefinition {
  const raw = JSON.parse(readFileSync(defPath, "utf8")) as WorkflowDefinition;
  const json = JSON.stringify(raw).replace(/0x1111111111111111111111111111111111111111/gi, emitter);
  return JSON.parse(json) as WorkflowDefinition;
}

async function resolveEmitter(): Promise<Address> {
  const reuse = process.env.DEMO_TRIGGER_EMITTER?.trim();
  if (reuse && isAddress(reuse)) {
    const a = getAddress(reuse);
    console.log("Using DEMO_TRIGGER_EMITTER:", a);
    return a;
  }
  const account = requireDeployAccount();
  const art = triggerEmitterArtifact();
  const publicClient = createPublicHttpClient();
  const walletClient = createWalletClient({
    account,
    chain: shannonTestnet,
    transport: http(httpRpcUrl()),
  });
  const gas = deployGas();
  console.log("Deploying TriggerEmitter…");
  const hash = await walletClient.deployContract({
    abi: art.abi,
    bytecode: art.bytecode.object,
    args: [],
    chain: shannonTestnet,
    account,
    gas,
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  const addr = receipt.contractAddress;
  if (!addr) throw new Error("TriggerEmitter deployment missing contract address");
  const out = getAddress(addr);
  console.log("TriggerEmitter:", out);
  return out;
}

async function deployHybrid(emitter: Address, previous: IndexedWorkflow | undefined): Promise<IndexedWorkflow> {
  const path = join(repoRoot(), "templates", "demo-01-hybrid-executor.workflow.json");
  const def = injectEmitter(path, emitter);
  validateHybridWorkflow(def);
  const hybrid = needsHybridEvaluation(def);
  try {
    const result = await deployCompiledWorkflow(definitionForOnChainCompile(def));
    const root = result.rootTrigger;
    return {
      workflowStringId: def.id,
      workflowId: result.workflowId,
      status: "active",
      emitter: root.type === "event" ? root.emitter : zeroAddress,
      sink: zeroAddress,
      workflowNode: result.executor,
      subscriptionId: result.subscriptionId,
      registeredAt: new Date().toISOString(),
      name: def.name,
      kind: "compiled",
      transactionHashes: result.transactionHashes,
      definition: def,
      hybridEvaluation: hybrid,
      deployMode: "executor",
    };
  } catch (e) {
    if (!isAlreadyRegistered(e)) throw e;
    if (!previous) {
      throw new Error(
        "mesh-showcase-shannon is already on the registry but not in workflows-index.json — fix the index or use a fresh registry",
      );
    }
    console.log("Keeping existing index row for mesh-showcase-shannon (already on-chain).");
    return previous;
  }
}

async function deployFanout(emitter: Address, previous: IndexedWorkflow | undefined): Promise<IndexedWorkflow> {
  const path = join(backendPackageRoot(), "templates", "demo-02-fanout-pipeline.workflow.json");
  const def = injectEmitter(path, emitter);
  try {
    const result = await deployPerNodeFanoutWorkflow(def);
    const root = result.rootTrigger;
    return {
      workflowStringId: def.id,
      workflowId: result.workflowId,
      status: "active",
      emitter: root.type === "event" ? root.emitter : zeroAddress,
      sink: zeroAddress,
      workflowNode: result.nodeAddresses[0]!,
      subscriptionId: result.subscriptionIds[0]!,
      subscriptionIds: result.subscriptionIds,
      nodeAddresses: result.nodeAddresses,
      registeredAt: new Date().toISOString(),
      name: def.name,
      kind: "compiled",
      transactionHashes: result.transactionHashes,
      definition: def,
      hybridEvaluation: false,
      deployMode: "perNodeFanout",
    };
  } catch (e) {
    if (!isAlreadyRegistered(e)) throw e;
    if (!previous) {
      throw new Error(
        "mesh-demo-fanout-shannon is already on the registry but not in workflows-index.json — fix the index or use a fresh registry",
      );
    }
    console.log("Keeping existing index row for mesh-demo-fanout-shannon (already on-chain).");
    return previous;
  }
}

async function main() {
  if (!process.env.WORKFLOW_REGISTRY_ADDRESS?.trim()) {
    throw new Error("WORKFLOW_REGISTRY_ADDRESS must be set (deploy WorkflowRegistry on Shannon first)");
  }

  const { workflows } = loadWorkflowIndex();
  const prevHybrid = workflows.find((w) => w.workflowStringId === "mesh-showcase-shannon");
  const prevFanout = workflows.find((w) => w.workflowStringId === "mesh-demo-fanout-shannon");
  const kept = workflows.filter((w) => !DEMO_IDS.has(w.workflowStringId));

  const emitter = await resolveEmitter();

  console.log("\n== Demo 1: hybrid executor (mesh-showcase-shannon) ==");
  const hybridEntry = await deployHybrid(emitter, prevHybrid);

  console.log("\n== Demo 2: per-node fan-out (mesh-demo-fanout-shannon) ==");
  const fanoutEntry = await deployFanout(emitter, prevFanout);

  const merged: IndexedWorkflow[] = [...kept, hybridEntry, fanoutEntry];
  const indexPath = getWorkflowIndexFilePath();
  writeFileSync(indexPath, JSON.stringify({ workflows: merged }, (_, v) => (typeof v === "bigint" ? v.toString() : v), 2));
  console.log("\nWrote index:", indexPath);

  const deploymentDir = join(backendPackageRoot(), "contracts", "deployments");
  mkdirSync(deploymentDir, { recursive: true });
  const deploymentPath = join(deploymentDir, "shannon-demo.json");
  writeFileSync(
    deploymentPath,
    JSON.stringify(
      {
        chainId: 50312,
        rpc: "https://dream-rpc.somnia.network",
        explorer: "https://shannon-explorer.somnia.network",
        triggerEmitter: emitter,
        workflowRegistry: process.env.WORKFLOW_REGISTRY_ADDRESS,
        auditLog: "0x41ffe131489F874B1759a2EeF5C9795AF4C9d50A",
        demo01HybridExecutor: {
          dslId: hybridEntry.workflowStringId,
          workflowId: hybridEntry.workflowId,
          contract: "MeshWorkflowExecutor",
          address: hybridEntry.workflowNode,
          rootSubscriptionId: hybridEntry.subscriptionId,
        },
        demo02Fanout: {
          dslId: fanoutEntry.workflowStringId,
          workflowId: fanoutEntry.workflowId,
          contract: "MeshSimpleStepNode",
          nodeAddresses: fanoutEntry.nodeAddresses ?? [],
          subscriptionIds: fanoutEntry.subscriptionIds ?? [],
        },
      },
      null,
      2,
    ),
  );
  console.log("Wrote:", deploymentPath);

  console.log("\n— UI —");
  console.log("  http://localhost:3000/demo");
  console.log(`  http://localhost:3000/workflows/${hybridEntry.workflowStringId}`);
  console.log(`  http://localhost:3000/workflows/${fanoutEntry.workflowStringId}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
