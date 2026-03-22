#!/usr/bin/env npx tsx
/**
 * Mesh CLI — talks to the Workflow Manager HTTP API.
 *
 *   MESH_API_URL=http://127.0.0.1:8787 npx tsx scripts/mesh-cli.ts <command>
 */
import { readFileSync, mkdirSync, copyFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { loadBackendEnv } from "../src/loadEnv.js";

loadBackendEnv();

const apiBase = () => (process.env.MESH_API_URL ?? "http://127.0.0.1:8787").replace(/\/$/, "");

async function req(path: string, init?: RequestInit) {
  const r = await fetch(`${apiBase()}${path}`, {
    ...init,
    headers: { "content-type": "application/json", ...init?.headers },
  });
  const text = await r.text();
  let body: unknown;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!r.ok) {
    throw new Error(typeof body === "object" && body && "error" in body ? String((body as { error: string }).error) : r.statusText);
  }
  return body;
}

function workflowsDir(): string {
  return join(process.cwd(), "workflows");
}

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      id: { type: "string" },
      file: { type: "string" },
      emitter: { type: "string" },
      compiler: { type: "boolean", default: false },
      hybrid: { type: "boolean", default: false },
      fanout: { type: "boolean", default: false },
    },
  });

  const cmd = positionals[0];
  if (!cmd) {
    console.log(`Usage:
  mesh-cli init   (writes demo-01-hybrid-executor.workflow.json, demo-02-fanout-pipeline.workflow.json)
  mesh-cli validate --file workflows/demo-01-hybrid-executor.workflow.json [--compiler] [--hybrid]
  mesh-cli compile --file workflows/demo-01-hybrid-executor.workflow.json
  mesh-cli deploy-dsl --file workflows/demo-01-hybrid-executor.workflow.json
  mesh-cli deploy-dsl --file workflows/demo-02-fanout-pipeline.workflow.json --fanout
  mesh-cli deploy --id <workflowStringId> [--emitter 0x...]
  mesh-cli list
  mesh-cli status --id <workflowStringId|0xbytes32>
  mesh-cli pause --id <id>
  mesh-cli delete --id <id>
`);
    process.exit(1);
  }

  if (cmd === "init") {
    const dir = workflowsDir();
    mkdirSync(dir, { recursive: true });
    const backendRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
    const templatesRoot = join(backendRoot, "..", "templates");
    const pairs = [
      ["demo-01-hybrid-executor.workflow.json", "demo-01-hybrid-executor.workflow.json"],
      ["demo-02-fanout-pipeline.workflow.json", "demo-02-fanout-pipeline.workflow.json"],
    ] as const;
    for (const [name, destName] of pairs) {
      const src = join(templatesRoot, name);
      if (!existsSync(src)) throw new Error(`Missing template: ${src}`);
      const dest = join(dir, destName);
      copyFileSync(src, dest);
      console.log("Wrote", dest);
    }
    return;
  }

  if (cmd === "validate") {
    const f = values.file;
    if (!f) throw new Error("--file required");
    const definition = JSON.parse(readFileSync(f, "utf8"));
    const body = await req("/workflows/validate", {
      method: "POST",
      body: JSON.stringify({
        definition,
        forCompiler: values.compiler === true,
        forHybrid: values.hybrid === true,
      }),
    });
    console.log(JSON.stringify(body, null, 2));
    return;
  }

  if (cmd === "compile") {
    const f = values.file;
    if (!f) throw new Error("--file required");
    const definition = JSON.parse(readFileSync(f, "utf8"));
    const body = await req("/workflows/compile", { method: "POST", body: JSON.stringify({ definition }) });
    console.log(JSON.stringify(body, null, 2));
    return;
  }

  if (cmd === "deploy-dsl") {
    const f = values.file;
    if (!f) throw new Error("--file required");
    const definition = JSON.parse(readFileSync(f, "utf8"));
    const payload: Record<string, unknown> = { definition };
    if (values.fanout === true) payload.deployMode = "perNodeFanout";
    const body = await req("/workflows/from-definition", { method: "POST", body: JSON.stringify(payload) });
    console.log(JSON.stringify(body, null, 2));
    return;
  }

  if (cmd === "deploy") {
    const id = values.id;
    if (!id) throw new Error("--id required");
    const body: Record<string, string> = { workflowStringId: id };
    if (values.emitter) body.emitterAddress = values.emitter;
    const res = await req("/workflows", { method: "POST", body: JSON.stringify(body) });
    console.log(JSON.stringify(res, null, 2));
    return;
  }

  if (cmd === "list") {
    const res = (await req("/workflows")) as { workflows: unknown[] };
    console.log(JSON.stringify(res.workflows, null, 2));
    return;
  }

  if (cmd === "status") {
    const id = values.id;
    if (!id) throw new Error("--id required");
    const res = await req(`/workflows/${encodeURIComponent(id)}`);
    console.log(JSON.stringify(res, null, 2));
    return;
  }

  if (cmd === "pause") {
    const id = values.id;
    if (!id) throw new Error("--id required");
    const res = await req(`/workflows/${encodeURIComponent(id)}/pause`, { method: "POST", body: "{}" });
    console.log(JSON.stringify(res, null, 2));
    return;
  }

  if (cmd === "delete") {
    const id = values.id;
    if (!id) throw new Error("--id required");
    const res = await req(`/workflows/${encodeURIComponent(id)}`, { method: "DELETE" });
    console.log(JSON.stringify(res, null, 2));
    return;
  }

  throw new Error(`Unknown command: ${cmd}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
