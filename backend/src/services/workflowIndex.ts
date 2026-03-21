import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Address, Hex } from "viem";
import type { WorkflowDefinition } from "../dsl/types.js";

export type WorkflowIndexStatus = "active" | "paused" | "deleted";

export type IndexedWorkflow = {
  workflowStringId: string;
  workflowId: Hex;
  status: WorkflowIndexStatus;
  /** Event emitter for `event` roots; zero address for pure cron roots. */
  emitter: Address;
  /** Demo path only; compiled workflows use zero address. */
  sink: Address;
  workflowNode: Address;
  subscriptionId: string;
  registeredAt: string;
  /** Human-readable name from DSL. */
  name?: string;
  kind?: "demo" | "compiled";
  transactionHashes?: Record<string, Hex>;
  /** Snapshot of the DSL when deployed via `POST /workflows/from-definition` (for dashboard + reproducibility). */
  definition?: WorkflowDefinition;
  /** Root `ethCalls` / `condition` / `conditionTree` — off-chain Somnia subscribe when `EVALUATION_ENGINE=1`. */
  hybridEvaluation?: boolean;
  deployMode?: "executor" | "perNodeFanout";
  /** All step contract addresses when `deployMode === perNodeFanout`. */
  nodeAddresses?: Address[];
  /** Parallel subscription ids for per-node fan-out. */
  subscriptionIds?: string[];
};

type IndexFile = { workflows: IndexedWorkflow[] };

export function getWorkflowIndexFilePath(): string {
  const backendRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
  return join(backendRoot, "data", "workflows-index.json");
}

function indexPath(): string {
  return getWorkflowIndexFilePath();
}

export function loadWorkflowIndex(): IndexFile {
  const p = indexPath();
  if (!existsSync(p)) return { workflows: [] };
  return JSON.parse(readFileSync(p, "utf8")) as IndexFile;
}

function saveWorkflowIndex(data: IndexFile): void {
  const p = indexPath();
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, JSON.stringify(data, (_, v) => (typeof v === "bigint" ? v.toString() : v), 2));
}

export function indexDeployedWorkflow(entry: IndexedWorkflow): void {
  const data = loadWorkflowIndex();
  data.workflows.push(entry);
  saveWorkflowIndex(data);
}

/** Match local index row by resolved `workflowId` and/or the raw `:id` route param (string id or 0x-prefixed bytes32). */
export function findWorkflowIndexEntry(params: { workflowId: Hex; idParam?: string }): IndexedWorkflow | null {
  const wid = params.workflowId.toLowerCase();
  const param = params.idParam?.trim();
  for (const w of loadWorkflowIndex().workflows) {
    if (w.workflowId.toLowerCase() === wid) return w;
    if (param && w.workflowStringId === param) return w;
  }
  return null;
}

export function updateWorkflowIndexStatus(
  workflowStringIdOrHex: string,
  status: WorkflowIndexStatus,
): boolean {
  const data = loadWorkflowIndex();
  const target = workflowStringIdOrHex.toLowerCase();
  let hit = false;
  for (const w of data.workflows) {
    const match =
      w.workflowStringId === workflowStringIdOrHex ||
      w.workflowId.toLowerCase() === target;
    if (match) {
      w.status = status;
      hit = true;
    }
  }
  if (hit) saveWorkflowIndex(data);
  return hit;
}
