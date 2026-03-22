import { createWalletClient, http, type Address, type Hex } from "viem";
import { triggerEmitterArtifact } from "../artifacts.js";
import { shannonTestnet } from "../shannonChain.js";
import { createPublicHttpClient, httpRpcUrl, requireDeployAccount } from "../sdk.js";

export async function pingTriggerEmitter(
  emitter: Address,
  seq: bigint,
): Promise<{ hash: Hex; blockNumber: bigint }> {
  const account = requireDeployAccount();
  const art = triggerEmitterArtifact();
  const walletClient = createWalletClient({
    account,
    chain: shannonTestnet,
    transport: http(httpRpcUrl()),
  });
  const hash = await walletClient.writeContract({
    address: emitter,
    abi: art.abi,
    functionName: "ping",
    args: [seq],
    chain: shannonTestnet,
    account,
  });
  const publicClient = createPublicHttpClient();
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  return { hash, blockNumber: receipt.blockNumber };
}
