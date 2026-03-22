import type { Node } from "reactflow";
import type { ConditionOpV1 } from "./dsl";

function uniqueDomId(): string {
  return `mesh-step-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/** React Flow `data` for each Mesh step node (maps to `WorkflowNodeDef`). */
export type MeshStepData = {
  /** Maps to `WorkflowNodeDef.name` in exported JSON. */
  name: string;
  /** Becomes `WorkflowNodeDef.id` — must be unique, DAG-safe id. */
  dslId: string;
  triggerType: "event" | "cron:block" | "cron:timestamp";
  emitter: string;
  eventTopic0: string;
  /** `cron:block` — empty = every block */
  blockNumber: string;
  /** Unix ms for `cron:timestamp` */
  timestampMs: string;
  actionType: "noop" | "call" | "emit";
  callTarget: string;
  callData: string;
  emitEventSig: string;
  emitPayload: string;
  /** Root-only hybrid fields (ignored on export for non-root). */
  hybridEnabled: boolean;
  hybridEthCallTo: string;
  hybridEthCallData: string;
  hybridUseTree: boolean;
  hybridOp: ConditionOpV1;
  hybridCompareDecimal: string;
  hybridSimIndex: number;
  hybridTreeCombinator: "all" | "any";
  hybridTreeClause2Enabled: boolean;
  hybridTreeOp2: ConditionOpV1;
  hybridTreeCompare2: string;
  onPassWebhookUrl: string;
};

export const WORKFLOW_START_NODE_ID = "mesh-workflow-start";

let stepCounter = 0;

export function resetStepCounter(): void {
  stepCounter = 0;
}

function meshStepDataForIndex(n: number): MeshStepData {
  return {
    name: `Step ${n}`,
    dslId: `step_${n}`,
    triggerType: "event",
    emitter: "0x0000000000000000000000000000000000000001",
    eventTopic0: "0x48257dc961b6f792c2b78a080dacfed693b660960a702de21cee364e20270e2f",
    blockNumber: "",
    timestampMs: String(Date.now() + 120_000),
    actionType: "noop",
    callTarget: "0x0000000000000000000000000000000000000001",
    callData: "0x",
    emitEventSig: "Notify(uint256)",
    emitPayload: "0x",
    hybridEnabled: false,
    hybridEthCallTo: "0x0000000000000000000000000000000000000001",
    hybridEthCallData: "0x",
    hybridUseTree: false,
    hybridOp: "uint256Gt",
    hybridCompareDecimal: "0",
    hybridSimIndex: 0,
    hybridTreeCombinator: "all",
    hybridTreeClause2Enabled: false,
    hybridTreeOp2: "uint256Gte",
    hybridTreeCompare2: "0",
    onPassWebhookUrl: "",
  };
}

export function createMeshStepNode(position: { x: number; y: number }): Node<MeshStepData> {
  stepCounter += 1;
  return {
    id: uniqueDomId(),
    type: "meshStep",
    position,
    data: meshStepDataForIndex(stepCounter),
  };
}
