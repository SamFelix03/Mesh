#!/usr/bin/env npx tsx
/**
 * Shannon demo: optional new TriggerEmitter (or DEMO_TRIGGER_EMITTER), deploy
 *   demo-01 (hybrid single executor) + demo-02 (per-node fan-out),
 * merge into workflows-index.json (drops prior rows for those two ids).
 *
 * If a workflow id is already on-chain, keeps the existing index row when present.
 *
 * On a remote host (e.g. Render), use POST /admin/shannon-demo-bootstrap with MESH_ADMIN_TOKEN instead.
 */
import { loadBackendEnv } from "../src/loadEnv.js";
import { runShannonDemoBootstrap } from "../src/services/shannonDemoBootstrap.js";

loadBackendEnv();

runShannonDemoBootstrap(console.log)
  .then((r) => {
    console.log("\n— result —", JSON.stringify(r, null, 2));
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
