import { createWalletClient, http, isAddress, keccak256, stringToBytes, type Address, type Hex } from "viem";
import { parseSubscriptionIdFromReceipt } from "../abis/precompile.js";
import { workflowRegistryAbi } from "../abis/workflowRegistry.js";
import { compileWorkflowDefinition } from "../compiler/compileWorkflow.js";
import { findSingleRootId, orderWithRootFirst } from "../compiler/dagOrder.js";
import { createSubscriptionForRootTrigger, subscriptionGas } from "../compiler/subscriptionFromTrigger.js";
import type { TriggerConfig, WorkflowDefinition } from "../dsl/types.js";
import { meshSimpleStepNodeArtifact } from "../artifacts.js";
import { shannonTestnet } from "../shannonChain.js";
import {
  createMeshSdkHttpPublic,
  createPublicHttpClient,
  httpRpcUrl,
  requireDeployAccount,
} from "../sdk.js";
import { assertReactivityOwnerBalance } from "./reactivityBalance.js";
import { validatePerNodeFanout } from "./perNodeFanoutValidate.js";

function requireRegistryAddress(): Address {
  const raw = process.env.WORKFLOW_REGISTRY_ADDRESS?.trim();
  if (!raw || !isAddress(raw)) {
    throw new Error("WORKFLOW_REGISTRY_ADDRESS must be set to a deployed WorkflowRegistry on Shannon");
  }
  return raw as Address;
}

export type DeployPerNodeFanoutResult = {
  workflowId: Hex;
  nodeAddresses: Address[];
  subscriptionIds: string[];
  rootTrigger: TriggerConfig;
  transactionHashes: Record<string, Hex>;
  compiled: ReturnType<typeof compileWorkflowDefinition>;
};

/**
 * PRD-style **per-node** deploy: one `MeshSimpleStepNode` + one `createSoliditySubscription` per DAG step,
 * same event filter on every subscription. Registry stores all node + sub ids.
 */
export async function deployPerNodeFanoutWorkflow(def: WorkflowDefinition): Promise<DeployPerNodeFanoutResult> {
  validatePerNodeFanout(def);

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
  const rootId = findSingleRootId(def);
  const orderedIds = orderWithRootFirst(def, rootId);

  const exists = await publicClient.readContract({
    address: registryAddress,
    abi: workflowRegistryAbi,
    functionName: "workflowExists",
    args: [compiled.workflowId],
  });
  if (exists) {
    throw new Error(`Workflow id "${def.id}" is already registered on-chain; choose another DSL id`);
  }

  const art = meshSimpleStepNodeArtifact();
  const nodeAddresses: Address[] = [];

  for (let i = 0; i < orderedIds.length; i++) {
    const step = compiled.steps[i]!;
    const nodeIdBytes = keccak256(stringToBytes(orderedIds[i]!)) as Hex;
    const deployHash = await walletClient.deployContract({
      abi: art.abi,
      bytecode: art.bytecode.object,
      args: [compiled.workflowId, nodeIdBytes, step.target, step.data, step.logTopic0],
      chain: shannonTestnet,
      account,
    });
    txHashes[`deployNode_${i}`] = deployHash;
    const receipt = await publicClient.waitForTransactionReceipt({ hash: deployHash });
    const addr = receipt.contractAddress;
    if (!addr) throw new Error(`MeshSimpleStepNode deploy ${i} missing address`);
    nodeAddresses.push(addr);
  }

  const gas = subscriptionGas(def.gasConfig);
  const subscriptionIds: string[] = [];

  for (let i = 0; i < nodeAddresses.length; i++) {
    const subTx = await createSubscriptionForRootTrigger(sdk, compiled.rootTrigger, nodeAddresses[i]!, gas);
    if (subTx instanceof Error) throw subTx;
    txHashes[`subscribeNode_${i}`] = subTx;
    const subReceipt = await publicClient.waitForTransactionReceipt({ hash: subTx });
    subscriptionIds.push(parseSubscriptionIdFromReceipt(subReceipt).toString());
  }

  const regHash = await walletClient.writeContract({
    address: registryAddress,
    abi: workflowRegistryAbi,
    functionName: "registerWorkflow",
    args: [
      compiled.workflowId,
      nodeAddresses,
      subscriptionIds.map((s) => BigInt(s)),
    ],
    chain: shannonTestnet,
    account,
  });
  txHashes.registerWorkflow = regHash;
  await publicClient.waitForTransactionReceipt({ hash: regHash });

  return {
    workflowId: compiled.workflowId,
    nodeAddresses,
    subscriptionIds,
    rootTrigger: compiled.rootTrigger,
    transactionHashes: txHashes,
    compiled,
  };
}
