import {
  createWalletClient,
  http,
  isAddress,
  keccak256,
  parseGwei,
  stringToBytes,
  toEventSelector,
  type Address,
  type Hex,
} from "viem";
import { parseSubscriptionIdFromReceipt } from "../abis/precompile.js";
import { workflowRegistryAbi } from "../abis/workflowRegistry.js";
import {
  meshEventWorkflowNodeArtifact,
  reactionSinkArtifact,
  triggerEmitterArtifact,
} from "../artifacts.js";
import { shannonTestnet } from "../shannonChain.js";
import {
  createMeshSdkHttpPublic,
  createPublicHttpClient,
  httpRpcUrl,
  requireDeployAccount,
} from "../sdk.js";
import { workflowIdFromString } from "../workflowId.js";
import { assertReactivityOwnerBalance } from "./reactivityBalance.js";

export type DeployDemoWorkflowParams = {
  /** DSL-style workflow id (hashed with UTF-8 bytes, same as Solidity `keccak256(bytes(string))`). */
  workflowStringId: string;
  /** If set, this emitter is used instead of deploying a new `TriggerEmitter`. */
  emitterAddress?: Address;
};

export type DeployDemoWorkflowResult = {
  workflowId: Hex;
  emitter: Address;
  sink: Address;
  workflowNode: Address;
  subscriptionId: string;
  transactionHashes: Record<string, Hex>;
};

const DEMO_NODE_KEY = "mesh-demo-root";

const pingEventSelector = toEventSelector({
  type: "event",
  name: "Ping",
  inputs: [{ type: "uint256", name: "seq", indexed: true }],
});

function requireRegistryAddress(): Address {
  const raw = process.env.WORKFLOW_REGISTRY_ADDRESS?.trim();
  if (!raw || !isAddress(raw)) {
    throw new Error("WORKFLOW_REGISTRY_ADDRESS must be set to a deployed WorkflowRegistry on Shannon");
  }
  return raw;
}

/**
 * Full Shannon path: deploy sink + workflow node, wire trust, deploy or bind emitter,
 * create Solidity subscription via Reactivity SDK, register in WorkflowRegistry.
 */
export async function deployDemoWorkflow(params: DeployDemoWorkflowParams): Promise<DeployDemoWorkflowResult> {
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

  const sinkArt = reactionSinkArtifact();
  const nodeArt = meshEventWorkflowNodeArtifact();
  const emitterArt = triggerEmitterArtifact();

  const wfBytes32 = workflowIdFromString(params.workflowStringId);
  const nodeBytes32 = keccak256(stringToBytes(DEMO_NODE_KEY));

  const exists = await publicClient.readContract({
    address: registryAddress,
    abi: workflowRegistryAbi,
    functionName: "workflowExists",
    args: [wfBytes32],
  });
  if (exists) {
    throw new Error(
      `Workflow "${params.workflowStringId}" is already registered; choose a new workflowStringId`,
    );
  }

  const sinkHash = await walletClient.deployContract({
    abi: sinkArt.abi,
    bytecode: sinkArt.bytecode.object,
    args: [],
    chain: shannonTestnet,
    account,
  });
  txHashes.deploySink = sinkHash;
  const sinkReceipt = await publicClient.waitForTransactionReceipt({ hash: sinkHash });
  const sinkAddr = sinkReceipt.contractAddress;
  if (!sinkAddr) throw new Error("ReactionSink deployment missing contract address");

  const nodeHash = await walletClient.deployContract({
    abi: nodeArt.abi,
    bytecode: nodeArt.bytecode.object,
    args: [wfBytes32, nodeBytes32, sinkAddr],
    chain: shannonTestnet,
    account,
  });
  txHashes.deployWorkflowNode = nodeHash;
  const nodeReceipt = await publicClient.waitForTransactionReceipt({ hash: nodeHash });
  const nodeAddr = nodeReceipt.contractAddress;
  if (!nodeAddr) throw new Error("MeshEventWorkflowNode deployment missing contract address");

  const trustHash = await walletClient.writeContract({
    address: sinkAddr,
    abi: sinkArt.abi,
    functionName: "setTrustedHandler",
    args: [nodeAddr],
    chain: shannonTestnet,
    account,
  });
  txHashes.setTrustedHandler = trustHash;
  await publicClient.waitForTransactionReceipt({ hash: trustHash });

  let emitterAddr: Address;
  if (params.emitterAddress) {
    emitterAddr = params.emitterAddress;
  } else {
    const emHash = await walletClient.deployContract({
      abi: emitterArt.abi,
      bytecode: emitterArt.bytecode.object,
      args: [],
      chain: shannonTestnet,
      account,
    });
    txHashes.deployTriggerEmitter = emHash;
    const emReceipt = await publicClient.waitForTransactionReceipt({ hash: emHash });
    const em = emReceipt.contractAddress;
    if (!em) throw new Error("TriggerEmitter deployment missing contract address");
    emitterAddr = em;
  }

  const subTx = await sdk.createSoliditySubscription({
    emitter: emitterAddr,
    eventTopics: [pingEventSelector],
    handlerContractAddress: nodeAddr,
    priorityFeePerGas: parseGwei(process.env.MESH_PRIORITY_FEE_GWEI ?? "2"),
    maxFeePerGas: parseGwei(process.env.MESH_MAX_FEE_GWEI ?? "10"),
    gasLimit: process.env.MESH_SUBSCRIPTION_GAS_LIMIT
      ? BigInt(process.env.MESH_SUBSCRIPTION_GAS_LIMIT)
      : 2_000_000n,
    isGuaranteed: true,
    isCoalesced: false,
  });
  if (subTx instanceof Error) throw subTx;
  txHashes.createSoliditySubscription = subTx;
  const subReceipt = await publicClient.waitForTransactionReceipt({ hash: subTx });
  const subscriptionId = parseSubscriptionIdFromReceipt(subReceipt);

  const regHash = await walletClient.writeContract({
    address: registryAddress,
    abi: workflowRegistryAbi,
    functionName: "registerWorkflow",
    args: [wfBytes32, [nodeAddr], [subscriptionId]],
    chain: shannonTestnet,
    account,
  });
  txHashes.registerWorkflow = regHash;
  await publicClient.waitForTransactionReceipt({ hash: regHash });

  return {
    workflowId: wfBytes32,
    emitter: emitterAddr,
    sink: sinkAddr,
    workflowNode: nodeAddr,
    subscriptionId: subscriptionId.toString(),
    transactionHashes: txHashes,
  };
}
