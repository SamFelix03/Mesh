import cors from "@fastify/cors";
import websocket from "@fastify/websocket";
import Fastify from "fastify";
import { URL } from "node:url";
import { registerTraceClient } from "./traceBroadcaster.js";
import { registerEvaluationClient } from "./evaluationBroadcaster.js";
import { normalizeTraceWorkflowIdFilter } from "./traceClientTypes.js";
import { syncEvaluationSubscriptions } from "./evaluationRuntime.js";
import { registerChainRoutes } from "./routes/chain.js";
import { registerWorkflowRoutes } from "./routes/workflows.js";
import { replyJsonStringify } from "./jsonSafe.js";
import { runShannonDemoBootstrap } from "./services/shannonDemoBootstrap.js";

export async function buildServer() {
  const app = Fastify({ logger: true });

  const origin = process.env.FRONTEND_ORIGIN;
  await app.register(cors, {
    origin: origin === "*" || !origin ? true : origin.split(",").map((s) => s.trim()),
  });

  await app.register(websocket);

  app.get("/health", async () => ({ ok: true, network: "somnia-shannon-testnet", chainId: 50312 }));

  registerWorkflowRoutes(app);
  registerChainRoutes(app);

  const adminTok = process.env.MESH_ADMIN_TOKEN?.trim();
  if (adminTok) {
    app.post("/admin/evaluation/sync", async (request, reply) => {
      const auth = request.headers.authorization ?? "";
      if (auth !== `Bearer ${adminTok}`) {
        return reply.code(401).send({ error: "unauthorized" });
      }
      await syncEvaluationSubscriptions();
      return { ok: true as const };
    });
  }

  /**
   * Same as `npm run demo:bootstrap:shannon` — writes `data/workflows-index.json` on this host.
   * If `MESH_ADMIN_TOKEN` is set, require `Authorization: Bearer <token>`. If unset, the route is **unauthenticated**
   * (convenient for private demos; do not expose a funded `PRIVATE_KEY` on the public internet without a token).
   */
  if (!adminTok) {
    app.log.warn(
      "MESH_ADMIN_TOKEN unset — POST /admin/shannon-demo-bootstrap accepts unauthenticated requests (uses server PRIVATE_KEY).",
    );
  }
  app.post("/admin/shannon-demo-bootstrap", async (request, reply) => {
    if (adminTok) {
      const auth = request.headers.authorization ?? "";
      if (auth !== `Bearer ${adminTok}`) {
        return reply.code(401).send({ error: "unauthorized" });
      }
    }
    if (!process.env.PRIVATE_KEY?.trim()) {
      return reply.code(503).send({ error: "PRIVATE_KEY is required for bootstrap" });
    }
    try {
      const result = await runShannonDemoBootstrap((msg) => {
        request.log.info({ bootstrap: true }, msg);
      });
      return result;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      request.log.error(e);
      return reply.code(500).send({ error: msg });
    }
  });

  app.get("/ws/trace", { websocket: true }, (connection, req) => {
    const sock = connection.socket;
    const wf = new URL(req.url, "http://127.0.0.1").searchParams.get("workflowId");
    const workflowIdFilter = normalizeTraceWorkflowIdFilter(wf);
    const client = {
      send: (s: string) => {
        sock.send(s);
      },
      close: () => {
        try {
          sock.close();
        } catch {
          /* ignore */
        }
      },
      workflowIdFilter,
    };
    const off = registerTraceClient(client);
    sock.on("close", off);
    sock.on("error", off);
  });

  app.get("/ws/evaluation", { websocket: true }, (connection, req) => {
    const sock = connection.socket;
    const wf = new URL(req.url, "http://127.0.0.1").searchParams.get("workflowId");
    const workflowIdFilter = normalizeTraceWorkflowIdFilter(wf);
    const client = {
      send: (s: string) => {
        sock.send(s);
      },
      close: () => {
        try {
          sock.close();
        } catch {
          /* ignore */
        }
      },
      workflowIdFilter,
    };
    const off = registerEvaluationClient(client);
    sock.on("close", off);
    sock.on("error", off);
  });

  /**
   * Thrown errors (e.g. viem `RpcRequestError`) may carry non-JSON-safe fields; Fastify's default error
   * path uses `JSON.stringify` and crashes on BigInt. Normal replies use {@link replyJsonStringify} via
   * `setReplySerializer` (including non-2xx bodies from `reply.send()`).
   */
  app.setErrorHandler((error, request, reply) => {
    request.log.error(error);
    const err = error as Error & { statusCode?: number };
    const statusCode =
      typeof err.statusCode === "number" && err.statusCode >= 400 && err.statusCode < 600 ? err.statusCode : 500;
    reply.code(statusCode).send({
      statusCode,
      error: statusCode >= 500 ? "Internal Server Error" : "Bad Request",
      message: err.message || "Unknown error",
    });
  });

  /** viem returns `bigint` for many on-chain fields; default Fastify JSON serialization throws on BigInt. */
  app.setReplySerializer((payload) => {
    if (typeof payload === "string") return payload;
    return replyJsonStringify(payload);
  });

  return app;
}
