/**
 * Shannon demo bootstrap: deploy / reconcile demo-01 + demo-02, merge workflows-index.json,
 * write contracts/deployments/shannon-demo.json. Shared by CLI script and POST /admin/shannon-demo-bootstrap.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createWalletClient, getAddress, http, isAddress, zeroAddress, type Address, type Hex } from "viem";
import { workflowRegistryAbi } from "../abis/workflowRegistry.js";
import { triggerEmitterArtifact } from "../artifacts.js";
import type { WorkflowDefinition } from "../dsl/types.js";
import { definitionForOnChainCompile, needsHybridEvaluation, validateHybridWorkflow } from "../hybridWorkflow.js";
import { shannonTestnet } from "../shannonChain.js";
import { createPublicHttpClient, httpRpcUrl, meshContractDeployGas, requireDeployAccount } from "../sdk.js";
import { workflowIdFromString } from "../workflowId.js";
import { deployCompiledWorkflow } from "./deployCompiledWorkflow.js";
import { deployPerNodeFanoutWorkflow } from "./deployPerNodeFanout.js";
import { getWorkflowIndexFilePath, loadWorkflowIndex, type IndexedWorkflow } from "./workflowIndex.js";

const DEMO_IDS = new Set(["mesh-showcase-shannon", "mesh-demo-fanout-shannon"]);

function backendPackageRoot(): string {
  return join(dirname(fileURLToPath(import.meta.url)), "..", "..");
}

function deployGas(): bigint {
  const g = meshContractDeployGas();
  return g ?? 30_000_000n;
}

function isAlreadyRegistered(err: unknown): boolean {
  return err instanceof Error && err.message.includes("already registered");
}

function registryStatusToIndexed(onChainStatus: number): IndexedWorkflow["status"] {
  if (onChainStatus === 2) return "paused";
  if (onChainStatus === 3) return "deleted";
  return "active";
}

/** Read registry row for a DSL workflow id (keccak256(string)). */
async function fetchRegistryRowForDslId(dslId: string): Promise<{
  workflowId: Hex;
  nodes: readonly Address[];
  subscriptionIds: readonly bigint[];
  onChainStatus: number;
}> {
  const raw = process.env.WORKFLOW_REGISTRY_ADDRESS?.trim();
  if (!raw || !isAddress(raw)) {
    throw new Error("WORKFLOW_REGISTRY_ADDRESS must be set");
  }
  const registry = getAddress(raw);
  const workflowId = workflowIdFromString(dslId);
  const publicClient = createPublicHttpClient();
  const [_owner, status, nodes, subscriptionIds] = await publicClient.readContract({
    address: registry,
    abi: workflowRegistryAbi,
    functionName: "getWorkflow",
    args: [workflowId],
  });
  if (nodes.length === 0) {
    throw new Error(
      `Workflow "${dslId}" is not on this registry (${workflowId}) — cannot backfill index from chain`,
    );
  }
  return {
    workflowId,
    nodes,
    subscriptionIds,
    onChainStatus: Number(status),
  };
}

function indexedFromRegistryExecutor(
  def: WorkflowDefinition,
  hybrid: boolean,
  row: Awaited<ReturnType<typeof fetchRegistryRowForDslId>>,
): IndexedWorkflow {
  const rootTrigger = def.nodes[0]?.trigger;
  const emitter = rootTrigger?.type === "event" ? rootTrigger.emitter : zeroAddress;
  return {
    workflowStringId: def.id,
    workflowId: row.workflowId,
    status: registryStatusToIndexed(row.onChainStatus),
    emitter,
    sink: zeroAddress,
    workflowNode: row.nodes[0]!,
    subscriptionId: row.subscriptionIds[0]!.toString(),
    registeredAt: new Date().toISOString(),
    name: def.name,
    kind: "compiled",
    transactionHashes: {},
    definition: def,
    hybridEvaluation: hybrid,
    deployMode: "executor",
  };
}

function indexedFromRegistryFanout(
  def: WorkflowDefinition,
  row: Awaited<ReturnType<typeof fetchRegistryRowForDslId>>,
): IndexedWorkflow {
  const rootTrigger = def.nodes[0]?.trigger;
  const emitter = rootTrigger?.type === "event" ? rootTrigger.emitter : zeroAddress;
  return {
    workflowStringId: def.id,
    workflowId: row.workflowId,
    status: registryStatusToIndexed(row.onChainStatus),
    emitter,
    sink: zeroAddress,
    workflowNode: row.nodes[0]!,
    subscriptionId: row.subscriptionIds[0]!.toString(),
    subscriptionIds: row.subscriptionIds.map((id) => id.toString()),
    nodeAddresses: [...row.nodes],
    registeredAt: new Date().toISOString(),
    name: def.name,
    kind: "compiled",
    transactionHashes: {},
    definition: def,
    hybridEvaluation: false,
    deployMode: "perNodeFanout",
  };
}

function injectEmitter(defPath: string, emitter: Address): WorkflowDefinition {
  const raw = JSON.parse(readFileSync(defPath, "utf8")) as WorkflowDefinition;
  const json = JSON.stringify(raw).replace(/0x1111111111111111111111111111111111111111/gi, emitter);
  return JSON.parse(json) as WorkflowDefinition;
}

async function resolveEmitter(): Promise<Address> {
  const reuse = process.env.DEMO_TRIGGER_EMITTER?.trim();
  if (reuse && isAddress(reuse)) {
    return getAddress(reuse);
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
  return getAddress(addr);
}

async function deployHybrid(emitter: Address, previous: IndexedWorkflow | undefined): Promise<IndexedWorkflow> {
  const path = join(backendPackageRoot(), "templates", "demo-01-hybrid-executor.workflow.json");
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
    if (previous) return previous;
    const row = await fetchRegistryRowForDslId(def.id);
    return indexedFromRegistryExecutor(def, hybrid, row);
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
    if (previous) return previous;
    const row = await fetchRegistryRowForDslId(def.id);
    return indexedFromRegistryFanout(def, row);
  }
}

export type ShannonDemoBootstrapResult = {
  ok: true;
  triggerEmitter: Address;
  indexPath: string;
  deploymentJsonPath: string;
  hybrid: { workflowStringId: string; workflowId: string };
  fanout: { workflowStringId: string; workflowId: string };
};

/** Requires WORKFLOW_REGISTRY_ADDRESS, PRIVATE_KEY; uses DEMO_TRIGGER_EMITTER when set. */
export async function runShannonDemoBootstrap(log?: (msg: string) => void): Promise<ShannonDemoBootstrapResult> {
  const L = log ?? (() => {});
  if (!process.env.WORKFLOW_REGISTRY_ADDRESS?.trim()) {
    throw new Error("WORKFLOW_REGISTRY_ADDRESS must be set (deploy WorkflowRegistry on Shannon first)");
  }

  const { workflows } = loadWorkflowIndex();
  const prevHybrid = workflows.find((w) => w.workflowStringId === "mesh-showcase-shannon");
  const prevFanout = workflows.find((w) => w.workflowStringId === "mesh-demo-fanout-shannon");
  const kept = workflows.filter((w) => !DEMO_IDS.has(w.workflowStringId));

  const emitter = await resolveEmitter();
  if (process.env.DEMO_TRIGGER_EMITTER?.trim() && isAddress(process.env.DEMO_TRIGGER_EMITTER.trim())) {
    L(`Using DEMO_TRIGGER_EMITTER: ${emitter}`);
  } else {
    L(`Deployed TriggerEmitter: ${emitter}`);
  }

  L("\n== Demo 1: hybrid executor (mesh-showcase-shannon) ==");
  const hybridEntry = await deployHybrid(emitter, prevHybrid);

  L("\n== Demo 2: per-node fan-out (mesh-demo-fanout-shannon) ==");
  const fanoutEntry = await deployFanout(emitter, prevFanout);

  const merged: IndexedWorkflow[] = [...kept, hybridEntry, fanoutEntry];
  const indexPath = getWorkflowIndexFilePath();
  writeFileSync(indexPath, JSON.stringify({ workflows: merged }, (_, v) => (typeof v === "bigint" ? v.toString() : v), 2));
  L(`\nWrote index: ${indexPath}`);

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
  L(`Wrote: ${deploymentPath}`);

  return {
    ok: true,
    triggerEmitter: emitter,
    indexPath,
    deploymentJsonPath: deploymentPath,
    hybrid: { workflowStringId: hybridEntry.workflowStringId, workflowId: hybridEntry.workflowId },
    fanout: { workflowStringId: fanoutEntry.workflowStringId, workflowId: fanoutEntry.workflowId },
  };
}
