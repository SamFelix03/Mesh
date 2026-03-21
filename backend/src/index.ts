import { loadBackendEnv } from "./loadEnv.js";

loadBackendEnv();
import { SDK } from "@somnia-chain/reactivity";
import { buildServer } from "./server.js";
import { createPublicWsClient } from "./sdk.js";
import { startTraceSubscription } from "./traceEngine.js";

const port = Number(process.env.PORT ?? "8787");

buildServer()
  .then((app) =>
    app.listen({ port, host: "0.0.0.0" }).then(() => {
      console.log(`Mesh backend listening on http://0.0.0.0:${port} (Somnia Shannon testnet)`);
    }),
  )
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });

if (process.env.TRACE_ENGINE === "1") {
  const traceSdk = new SDK({ public: createPublicWsClient() });
  startTraceSubscription(
    traceSdk,
    (data) => {
      console.log("[trace]", JSON.stringify(data.result));
    },
    (err) => console.error("[trace error]", err),
  ).then(
    () => console.log("Trace engine wildcard subscription active"),
    (e) => console.error("Trace engine failed to start:", e),
  );
}

if (process.env.EVALUATION_ENGINE === "1") {
  import("./evaluationEngine.js")
    .then((m) => m.startEvaluationEngine())
    .then(() => console.log("Evaluation engine started (hybrid workflows)"))
    .catch((e) => console.error("Evaluation engine failed:", e));
}
