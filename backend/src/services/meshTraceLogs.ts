import { type Address, type Hex, type PublicClient, parseAbiItem, toEventSelector } from "viem";
import { createPublicHttpClient } from "../sdk.js";

const stepTopic0 = toEventSelector(
  parseAbiItem("event WorkflowStepExecuted(bytes32 indexed workflowId, bytes32 indexed nodeId, uint256 timestamp)"),
);

function isMissingBlockDataError(e: unknown): boolean {
  const msg = (e instanceof Error ? e.message : String(e)).toLowerCase();
  return msg.includes("missing block") || msg.includes("missingtrienode");
}

/**
 * Somnia's public HTTP RPC often rejects wide `eth_getLogs` ranges with "missing block data".
 * Clamp to chain tip, then shrink ranges: chunk into ≤100 blocks, then binary-split failing slices.
 */
async function getLogsRobust(
  client: PublicClient,
  address: Address,
  from: bigint,
  to: bigint,
): Promise<Awaited<ReturnType<PublicClient["getLogs"]>>> {
  if (from > to) return [];
  try {
    return await client.getLogs({
      address,
      fromBlock: from,
      toBlock: to,
    });
  } catch (e) {
    if (!isMissingBlockDataError(e)) {
      throw e;
    }
    if (from === to) {
      return [];
    }

    const span = to - from + 1n;
    if (span > 100n) {
      const out: Awaited<ReturnType<PublicClient["getLogs"]>> = [];
      let cur = from;
      while (cur <= to) {
        const end = cur + 99n > to ? to : cur + 99n;
        out.push(...(await getLogsRobust(client, address, cur, end)));
        cur = end + 1n;
      }
      return out;
    }

    const mid = from + (to - from) / 2n;
    const left = await getLogsRobust(client, address, from, mid);
    const right = await getLogsRobust(client, address, mid + 1n, to);
    return [...left, ...right];
  }
}

export type PulledMeshTraceLine = {
  blockNumber: string;
  transactionHash: Hex;
  /** JSON-safe index (viem may use number or bigint depending on types). */
  logIndex: number;
  address: Address;
  topics: readonly Hex[];
  data: Hex;
};

function normWf(wf: string): string {
  return wf.trim().toLowerCase();
}

/** Shannon HTTP RPC limits log ranges (e.g. 1000 blocks). */
const MAX_SPAN = 999n;

/**
 * Fetch `WorkflowStepExecuted` logs for a workflow from specific contracts via HTTP `eth_getLogs`.
 * Used to backfill the demo trace when Somnia WS is quiet or the handler lands after the ping tx.
 */
export async function pullMeshTraceLogs(params: {
  workflowId: Hex;
  contractAddresses: readonly Address[];
  fromBlock: bigint;
  toBlock: bigint;
  client?: PublicClient;
}): Promise<PulledMeshTraceLine[]> {
  const wf = normWf(params.workflowId);
  if (!params.contractAddresses.length) return [];

  let from = params.fromBlock;
  let to = params.toBlock;
  if (from > to) [from, to] = [to, from];
  if (to - from > MAX_SPAN) {
    to = from + MAX_SPAN;
  }

  const client = params.client ?? createPublicHttpClient();
  const latest = await client.getBlockNumber();
  if (to > latest) to = latest;
  if (from > to) return [];
  const out: PulledMeshTraceLine[] = [];

  for (const addr of params.contractAddresses) {
    const logs = await getLogsRobust(client, addr, from, to);
    for (const log of logs) {
      if (log.blockNumber == null || log.transactionHash == null || log.logIndex == null) continue;
      const t0 = log.topics[0]?.toLowerCase();
      const t1 = log.topics[1]?.toLowerCase();
      if (t0 !== stepTopic0 || t1 !== wf) continue;
      const logIndex =
        typeof log.logIndex === "bigint" ? Number(log.logIndex) : log.logIndex;
      out.push({
        blockNumber: log.blockNumber.toString(),
        transactionHash: log.transactionHash,
        logIndex,
        address: log.address,
        topics: log.topics,
        data: log.data,
      });
    }
  }

  out.sort((a, b) => {
    const bn = BigInt(a.blockNumber) - BigInt(b.blockNumber);
    if (bn !== 0n) return bn < 0n ? -1 : 1;
    return a.logIndex - b.logIndex;
  });

  return out;
}
