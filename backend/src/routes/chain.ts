import type { FastifyInstance } from "fastify";
import { getAddress, isAddress, type Address, type Hex } from "viem";
import { createPublicHttpClient } from "../sdk.js";
import { reactionSinkArtifact } from "../artifacts.js";
import { pingTriggerEmitter } from "../services/pingEmitter.js";

export function registerChainRoutes(app: FastifyInstance) {
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
      const hash = await pingTriggerEmitter(getAddress(addr) as Address, seq);
      return { txHash: hash, emitterAddress: getAddress(addr), seq: seq.toString() };
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
}
