import type { Hex, TransactionReceipt } from "viem";
import { decodeEventLog, getAbiItem, getAddress, hexToBigInt, toEventHash } from "viem";

export const SOMNIA_REACTIVITY_PRECOMPILE = getAddress(
  "0x0000000000000000000000000000000000000100",
) as `0x${string}`;

/** Matches Shannon precompile logs: `owner` is topic1, `subscriptionId` is topic2 (see cast receipt on subscribe txs). */
const subscriptionCreatedAbi = [
  {
    type: "event",
    name: "SubscriptionCreated",
    anonymous: false,
    inputs: [
      { name: "owner", type: "address", indexed: true, internalType: "address" },
      { name: "subscriptionId", type: "uint256", indexed: true, internalType: "uint256" },
      {
        name: "subscriptionData",
        type: "tuple",
        indexed: false,
        internalType: "struct ISomniaReactivityPrecompile.SubscriptionData",
        components: [
          { name: "eventTopics", type: "bytes32[4]", internalType: "bytes32[4]" },
          { name: "origin", type: "address", internalType: "address" },
          { name: "caller", type: "address", internalType: "address" },
          { name: "emitter", type: "address", internalType: "address" },
          { name: "handlerContractAddress", type: "address", internalType: "address" },
          { name: "handlerFunctionSelector", type: "bytes4", internalType: "bytes4" },
          { name: "priorityFeePerGas", type: "uint64", internalType: "uint64" },
          { name: "maxFeePerGas", type: "uint64", internalType: "uint64" },
          { name: "gasLimit", type: "uint64", internalType: "uint64" },
          { name: "isGuaranteed", type: "bool", internalType: "bool" },
          { name: "isCoalesced", type: "bool", internalType: "bool" },
        ],
      },
    ],
  },
] as const;

const subscriptionCreatedEvent = getAbiItem({
  abi: subscriptionCreatedAbi,
  name: "SubscriptionCreated",
});
/** Canonical hash from our ABI (may differ from chain if Somnia changes the event). */
const subscriptionCreatedTopic0FromAbi = toEventHash(subscriptionCreatedEvent);

/**
 * Observed `SubscriptionCreated` topic0 on Shannon `subscribe` receipts (owner = topic1, id = topic2).
 * When this matches, we can read `subscriptionId` from `topics[2]` even if the tuple `data` layout drifts from our ABI.
 */
export const SUBSCRIPTION_CREATED_TOPIC0_SHANNON_OBSERVED =
  "0xbc0119748179fb662c3d98d621fca33ec3346492d1992ced6a1d9f3cf65a997a" as Hex;

/**
 * Parse `SubscriptionCreated` from the reactivity precompile after `subscribe` / `createSoliditySubscription`.
 * Decodes full log when possible; falls back to indexed `subscriptionId` (topic 2) if decode fails.
 */
export function parseSubscriptionIdFromReceipt(receipt: TransactionReceipt): bigint {
  if (receipt.status === "reverted") {
    throw new Error(
      `Reactivity subscribe transaction reverted (tx ${receipt.transactionHash}). Check gas, fees, and handler bytecode.`,
    );
  }

  const precompileLogs = receipt.logs.filter((l) => getAddress(l.address) === SOMNIA_REACTIVITY_PRECOMPILE);

  for (const log of precompileLogs) {
    const t0 = log.topics[0]?.toLowerCase();
    const tShannon = SUBSCRIPTION_CREATED_TOPIC0_SHANNON_OBSERVED.toLowerCase();
    const tAbi = subscriptionCreatedTopic0FromAbi.toLowerCase();
    if (t0 !== tShannon && t0 !== tAbi) continue;

    /* Shannon precompile uses an event signature whose topic0 does not match viem's hash of our ABI; id is always topic2. */
    if (t0 === tShannon && log.topics[2]) {
      return hexToBigInt(log.topics[2] as Hex);
    }

    if (!log.topics[2]) continue;

    try {
      const decoded = decodeEventLog({
        abi: subscriptionCreatedAbi,
        data: log.data,
        topics: log.topics as [Hex, ...Hex[]],
      });
      if (decoded.eventName === "SubscriptionCreated") {
        return decoded.args.subscriptionId as bigint;
      }
    } catch {
      return hexToBigInt(log.topics[2] as Hex);
    }
  }

  const hint = precompileLogs.length
    ? precompileLogs.map((l) => `addr=${l.address} topics=${l.topics.length}`).join("; ")
    : receipt.logs.length
      ? `no logs from ${SOMNIA_REACTIVITY_PRECOMPILE}; other log addrs: ${[...new Set(receipt.logs.map((l) => getAddress(l.address)))].join(", ")}`
      : "receipt has no logs (RPC may omit them — try another SOMNIA_RPC_URL)";
  throw new Error(`SubscriptionCreated log not found on precompile for tx ${receipt.transactionHash}. ${hint}`);
}
