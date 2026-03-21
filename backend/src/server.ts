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

  return app;
}
