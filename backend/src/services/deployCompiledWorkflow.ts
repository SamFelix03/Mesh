import { createWalletClient, http, isAddress, type Address, type Hex } from "viem";
import { parseSubscriptionIdFromReceipt } from "../abis/precompile.js";
import { workflowRegistryAbi } from "../abis/workflowRegistry.js";
import {
  compileWorkflowDefinition,
  createSubscriptionForRootTrigger,
  subscriptionGas,
} from "../compiler/index.js";
import type { TriggerConfig, WorkflowDefinition } from "../dsl/types.js";
import { meshWorkflowExecutorArtifact } from "../artifacts.js";
import { shannonTestnet } from "../shannonChain.js";
import {
  createMeshSdkHttpPublic,
  createPublicHttpClient,
  httpRpcUrl,
  meshContractDeployGas,
  requireDeployAccount,
} from "../sdk.js";
import { assertReactivityOwnerBalance } from "./reactivityBalance.js";

function requireRegistryAddress(): Address {
  const raw = process.env.WORKFLOW_REGISTRY_ADDRESS?.trim();
  if (!raw || !isAddress(raw)) {
    throw new Error("WORKFLOW_REGISTRY_ADDRESS must be set to a deployed WorkflowRegistry on Shannon");
  }
  return raw as Address;
}


export type DeployCompiledWorkflowResult = {
  workflowId: Hex;
  executor: Address;
  subscriptionId: string;
  rootTrigger: TriggerConfig;
  transactionHashes: Record<string, Hex>;
  compiled: ReturnType<typeof compileWorkflowDefinition>;
};

/**
 * Deploy `MeshWorkflowExecutor`, create root subscription (event / BlockTick / Schedule), register on `WorkflowRegistry`.
 */
export async function deployCompiledWorkflow(def: WorkflowDefinition): Promise<DeployCompiledWorkflowResult> {
  const account = requireDeployAccount();
  const registryAddress = requireRegistryAddress();
  const publicClient = createPublicHttpClient();
  const walletClient = createWalletClient({
    account,
    chain: shannonTestnet,
    transport: http(httpRpcUrl()),
  });

  const sdk = createMeshSdkHttpPublic({ account });
  const txHashes: Record<string, Hex> = {};

  await assertReactivityOwnerBalance(publicClient, account.address);

  const compiled = compileWorkflowDefinition(def);
  const art = meshWorkflowExecutorArtifact();

  const exists = await publicClient.readContract({
    address: registryAddress,
    abi: workflowRegistryAbi,
    functionName: "workflowExists",
    args: [compiled.workflowId],
  });
  if (exists) {
    throw new Error(`Workflow id "${def.id}" is already registered on-chain; choose another DSL id`);
  }

  const stepTuples = compiled.steps.map((s) => ({
    target: s.target,
    data: s.data,
    logTopic0: s.logTopic0,
    nextIndices: s.nextIndices.map((i) => Number(i)),
  }));

  const deployGas = meshContractDeployGas();
  const deployHash = await walletClient.deployContract({
    abi: art.abi,
    bytecode: art.bytecode.object,
    args: [compiled.workflowId, compiled.rootStepNodeId, compiled.stepNodeIds, stepTuples],
    chain: shannonTestnet,
    account,
    ...(deployGas !== undefined ? { gas: deployGas } : {}),
  });
  txHashes.deployMeshWorkflowExecutor = deployHash;
  const depReceipt = await publicClient.waitForTransactionReceipt({ hash: deployHash });
  const executor = depReceipt.contractAddress;
  if (!executor) throw new Error("MeshWorkflowExecutor deployment missing contract address");

  const gas = subscriptionGas(def.gasConfig);
  const subTx = await createSubscriptionForRootTrigger(sdk, compiled.rootTrigger, executor, gas);
  if (subTx instanceof Error) throw subTx;
  txHashes.createSubscription = subTx;
  const subReceipt = await publicClient.waitForTransactionReceipt({ hash: subTx });
  const subscriptionId = parseSubscriptionIdFromReceipt(subReceipt);

  const regHash = await walletClient.writeContract({
    address: registryAddress,
    abi: workflowRegistryAbi,
    functionName: "registerWorkflow",
    args: [compiled.workflowId, [executor], [subscriptionId]],
    chain: shannonTestnet,
    account,
  });
  txHashes.registerWorkflow = regHash;
  await publicClient.waitForTransactionReceipt({ hash: regHash });

  return {
    workflowId: compiled.workflowId,
    executor,
    subscriptionId: subscriptionId.toString(),
    rootTrigger: compiled.rootTrigger,
    transactionHashes: txHashes,
    compiled,
  };
}
