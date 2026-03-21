import { formatEther, type Address, type PublicClient } from "viem";

/** Somnia precompile `SUBSCRIPTION_OWNER_MINIMUM_BALANCE` (32 native token, STT on Shannon). */
export const REACTIVITY_MIN_OWNER_BALANCE_WEI = 32n * 10n ** 18n;

export async function assertReactivityOwnerBalance(
  publicClient: PublicClient,
  owner: Address,
): Promise<void> {
  const balance = await publicClient.getBalance({ address: owner });
  if (balance < REACTIVITY_MIN_OWNER_BALANCE_WEI) {
    throw new Error(
      `Reactivity on-chain subscriptions require the owner EOA to hold at least 32 STT (native test token on Shannon). ` +
        `Current balance: ${formatEther(balance)} STT. Top up via the Somnia testnet faucet, then retry.`,
    );
  }
}
