import { createWalletClient, http, getAddress, isAddress, isHex, type Address, type Hex } from "viem";
import { workflowRegistryAbi } from "../abis/workflowRegistry.js";
import { shannonTestnet } from "../shannonChain.js";
import {
  createMeshSdkHttpPublic,
  createPublicHttpClient,
  httpRpcUrl,
  requireDeployAccount,
} from "../sdk.js";
import { workflowIdFromString } from "../workflowId.js";

function requireRegistryAddress(): Address {
  const raw = process.env.WORKFLOW_REGISTRY_ADDRESS?.trim();
  if (!raw || !isAddress(raw)) {
    throw new Error("WORKFLOW_REGISTRY_ADDRESS must be set");
  }
  return getAddress(raw);
}

export function resolveWorkflowIdParam(id: string): Hex {
  if (id.startsWith("0x") && isHex(id) && id.length === 66) return id as Hex;
  return workflowIdFromString(id);
}

async function ensureWorkflowOwner(
  workflowId: Hex,
): Promise<{
  owner: Address;
  nodes: readonly Address[];
  subscriptionIds: readonly bigint[];
  status: number;
}> {
  const account = requireDeployAccount();
  const registry = requireRegistryAddress();
  const publicClient = createPublicHttpClient();
  const [owner, status, nodes, subscriptionIds] = await publicClient.readContract({
    address: registry,
    abi: workflowRegistryAbi,
    functionName: "getWorkflow",
    args: [workflowId],
  });
  if (owner.toLowerCase() !== account.address.toLowerCase()) {
    throw new Error("Caller wallet is not the workflow owner on WorkflowRegistry");
  }
  return { owner, nodes, subscriptionIds, status };
}

async function cancelAllSubscriptions(subscriptionIds: readonly bigint[]) {
  const account = requireDeployAccount();
  const publicClient = createPublicHttpClient();
  const sdk = createMeshSdkHttpPublic({ account });
  const out: Hex[] = [];
  for (const id of subscriptionIds) {
    if (id === 0n) continue;
    const tx = await sdk.cancelSoliditySubscription(id);
    if (tx instanceof Error) throw new Error(`cancelSoliditySubscription(${id}): ${tx.message}`);
    await publicClient.waitForTransactionReceipt({ hash: tx });
    out.push(tx);
  }
  return out;
}

function zeros(len: number): bigint[] {
  return Array.from({ length: len }, () => 0n);
}

export async function pauseWorkflowOnChain(workflowIdParam: string) {
  const workflowId = resolveWorkflowIdParam(workflowIdParam);
  const { subscriptionIds, status, nodes } = await ensureWorkflowOwner(workflowId);
  if (status !== 1) {
    throw new Error("Workflow is not Active; cannot pause (on-chain status must be Active)");
  }
  const cancelTxs = await cancelAllSubscriptions(subscriptionIds);

  const account = requireDeployAccount();
  const registry = requireRegistryAddress();
  const walletClient = createWalletClient({
    account,
    chain: shannonTestnet,
    transport: http(httpRpcUrl()),
  });
  const clearHash = await walletClient.writeContract({
    address: registry,
    abi: workflowRegistryAbi,
    functionName: "updateSubscriptionIds",
    args: [workflowId, zeros(nodes.length)],
    chain: shannonTestnet,
    account,
  });
  const publicClient = createPublicHttpClient();
  await publicClient.waitForTransactionReceipt({ hash: clearHash });

  const pauseHash = await walletClient.writeContract({
    address: registry,
    abi: workflowRegistryAbi,
    functionName: "pauseWorkflow",
    args: [workflowId],
    chain: shannonTestnet,
    account,
  });
  await publicClient.waitForTransactionReceipt({ hash: pauseHash });
  return { workflowId, cancelTxs, clearSubsTx: clearHash, pauseTx: pauseHash };
}

export async function deleteWorkflowOnChain(workflowIdParam: string) {
  const workflowId = resolveWorkflowIdParam(workflowIdParam);
  const { subscriptionIds, status, nodes } = await ensureWorkflowOwner(workflowId);
  if (status === 3) {
    throw new Error("Workflow already Deleted");
  }
  const cancelTxs = await cancelAllSubscriptions(subscriptionIds);

  const account = requireDeployAccount();
  const registry = requireRegistryAddress();
  const walletClient = createWalletClient({
    account,
    chain: shannonTestnet,
    transport: http(httpRpcUrl()),
  });
  const publicClient = createPublicHttpClient();

  const clearHash = await walletClient.writeContract({
    address: registry,
    abi: workflowRegistryAbi,
    functionName: "updateSubscriptionIds",
    args: [workflowId, zeros(nodes.length)],
    chain: shannonTestnet,
    account,
  });
  await publicClient.waitForTransactionReceipt({ hash: clearHash });

  const delHash = await walletClient.writeContract({
    address: registry,
    abi: workflowRegistryAbi,
    functionName: "deleteWorkflow",
    args: [workflowId],
    chain: shannonTestnet,
    account,
  });
  await publicClient.waitForTransactionReceipt({ hash: delHash });
  return { workflowId, cancelTxs, clearSubsTx: clearHash, deleteTx: delHash };
}
