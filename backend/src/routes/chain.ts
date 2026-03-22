import type { FastifyInstance } from "fastify";
import { getAddress, isAddress, isHex, type Address, type Hex } from "viem";
import { createPublicHttpClient } from "../sdk.js";
import { reactionSinkArtifact } from "../artifacts.js";
import { pingTriggerEmitter } from "../services/pingEmitter.js";
import { pullMeshTraceLogs } from "../services/meshTraceLogs.js";

export function registerChainRoutes(app: FastifyInstance) {
  app.get("/chain/head-block", async () => {
    const client = createPublicHttpClient();
    const blockNumber = await client.getBlockNumber();
    return { blockNumber: blockNumber.toString() };
  });

  app.post<{
    Body: { emitterAddress?: string; seq?: string };
  }>("/chain/ping", async (request, reply) => {
    if (!process.env.PRIVATE_KEY) {
      return reply.code(503).send({ error: "PRIVATE_KEY is required" });
    }
    const addr = request.body?.emitterAddress;
    if (!addr || !isAddress(addr)) {
      return reply.code(400).send({ error: "Body must include emitterAddress (checksummed or hex)" });
    }
    const seqRaw = request.body?.seq ?? "1";
    const seq = BigInt(seqRaw);
    try {
      const { hash, blockNumber } = await pingTriggerEmitter(getAddress(addr) as Address, seq);
      return {
        txHash: hash,
        blockNumber: blockNumber.toString(),
        emitterAddress: getAddress(addr),
        seq: seq.toString(),
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      request.log.error(e);
      return reply.code(500).send({ error: msg });
    }
  });

  app.get<{
    Querystring: { address?: string };
  }>("/chain/sink", async (request, reply) => {
    const addr = request.query.address;
    if (!addr || !isAddress(addr)) {
      return reply.code(400).send({ error: "Query ?address= must be a ReactionSink contract address" });
    }
    const client = createPublicHttpClient();
    const art = reactionSinkArtifact();
    const sink = getAddress(addr) as Address;
    const [hitCount, lastEmitter, lastTopic0] = await Promise.all([
      client.readContract({
        address: sink,
        abi: art.abi,
        functionName: "hitCount",
      }) as Promise<bigint>,
      client.readContract({
        address: sink,
        abi: art.abi,
        functionName: "lastEmitter",
      }) as Promise<Address>,
      client.readContract({
        address: sink,
        abi: art.abi,
        functionName: "lastTopic0",
      }) as Promise<Hex>,
    ]);
    return {
      sink,
      hitCount: hitCount.toString(),
      lastEmitter,
      lastTopic0,
    };
  });

  app.get<{
    Querystring: { workflowId?: string; contracts?: string; fromBlock?: string; toBlock?: string };
  }>("/chain/trace-logs", async (request, reply) => {
    const wf = request.query.workflowId?.trim();
    const contractsRaw = request.query.contracts?.trim();
    if (!wf || !wf.startsWith("0x") || wf.length !== 66 || !isHex(wf)) {
      return reply.code(400).send({ error: "Query workflowId must be a 32-byte hex string (0x + 64 hex)" });
    }
    if (!contractsRaw) {
      return reply.code(400).send({ error: "Query contracts is required (comma-separated addresses)" });
    }
    const parts = contractsRaw.split(",").map((s) => s.trim()).filter(Boolean);
    const contractAddresses: Address[] = [];
    for (const p of parts) {
      if (!isAddress(p)) {
        return reply.code(400).send({ error: `Invalid contract address: ${p}` });
      }
      contractAddresses.push(getAddress(p) as Address);
    }
    const fromB = request.query.fromBlock?.trim();
    const toB = request.query.toBlock?.trim();
    if (!fromB || !toB || !/^\d+$/.test(fromB) || !/^\d+$/.test(toB)) {
      return reply.code(400).send({ error: "fromBlock and toBlock are required decimal integers" });
    }
    let fromBlock = BigInt(fromB);
    let toBlock = BigInt(toB);
    if (fromBlock > toBlock) {
      const t = fromBlock;
      fromBlock = toBlock;
      toBlock = t;
    }
    if (toBlock - fromBlock > 999n) {
      return reply.code(400).send({ error: "Block span must be at most 999 (RPC limit)" });
    }
    try {
      const logs = await pullMeshTraceLogs({
        workflowId: wf as Hex,
        contractAddresses,
        fromBlock,
        toBlock,
      });
      return { logs };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      request.log.error(e);
      return reply.code(500).send({ error: msg });
    }
  });
}
