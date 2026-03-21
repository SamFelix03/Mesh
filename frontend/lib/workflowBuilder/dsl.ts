/**
 * JSON shape for Mesh `WorkflowDefinition` (mirrors `backend/src/dsl/types.ts`).
 * Used by the visual builder export / API calls.
 */
export type TriggerEvent = {
  type: "event";
  emitter: string;
  eventTopic0: string;
  abi?: readonly unknown[];
};

export type TriggerBlockTick = {
  type: "cron:block";
  /** JSON-safe; backend accepts number from HTTP JSON. */
  blockNumber?: number;
};

export type TriggerSchedule = {
  type: "cron:timestamp";
  timestampMs: number;
};

export type TriggerConfig = TriggerEvent | TriggerBlockTick | TriggerSchedule;

export type EthCallSpec = { to: string; data: string };

export type ConditionOpV1 =
  | "uint256Gt"
  | "uint256Gte"
  | "uint256Lt"
  | "uint256Lte"
  | "uint256Eq"
  | "uint256Neq";

export type ConditionConfig = {
  simulationResultIndex: number;
  description?: string;
  op?: ConditionOpV1;
  compareDecimal?: string;
};

export type ConditionClause = {
  simulationResultIndex: number;
  op: ConditionOpV1;
  compareDecimal: string;
  description?: string;
};

export type ConditionTree = {
  combinator: "all" | "any";
  clauses: ConditionClause[];
};

export type EvaluationOnPassHook =
  | { type: "webhook"; url: string; headers?: Record<string, string> }
  | { type: "rawTx"; to: string; data: string; valueWei?: string };

export type ActionCall = { type: "call"; target: string; data: string };
export type ActionEmit = { type: "emit"; eventSig: string; payload: string };
export type ActionNoop = { type: "noop" };
export type ActionConfig = ActionCall | ActionEmit | ActionNoop;

export type WorkflowNodeDef = {
  id: string;
  trigger: TriggerConfig;
  condition?: ConditionConfig;
  conditionTree?: ConditionTree;
  action: ActionConfig;
  ethCalls?: EthCallSpec[];
};

export type WorkflowEdgeDef = { from: string; to: string; label?: string };

export type WorkflowDefinition = {
  id: string;
  name: string;
  nodes: WorkflowNodeDef[];
  edges: WorkflowEdgeDef[];
  evaluationHooks?: { onPass?: EvaluationOnPassHook[] };
};
