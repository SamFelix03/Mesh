import { createWalletClient, http, type Address, type Hex } from "viem";
import { workflowRegistryArtifact } from "../artifacts.js";
import { shannonTestnet } from "../shannonChain.js";
import { createPublicHttpClient, httpRpcUrl, requireDeployAccount } from "../sdk.js";

export async function deployWorkflowRegistry(): Promise<{ address: Address; txHash: Hex }> {
  const account = requireDeployAccount();
  const publicClient = createPublicHttpClient();
  const art = workflowRegistryArtifact();
  const walletClient = createWalletClient({
    account,
    chain: shannonTestnet,
    transport: http(httpRpcUrl()),
  });
  const hash = await walletClient.deployContract({
    abi: art.abi,
    bytecode: art.bytecode.object,
    args: [],
    chain: shannonTestnet,
    account,
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  const address = receipt.contractAddress;
  if (!address) throw new Error("WorkflowRegistry deployment failed: no contract address");
  return { address, txHash: hash };
}
