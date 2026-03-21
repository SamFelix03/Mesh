import type { Address, Hex } from "viem";

/** PRD §4.1 — shared gas for subscription txs */
export type GasConfig = {
  priorityFeePerGas?: bigint;
  maxFeePerGas?: bigint;
  gasLimit?: bigint;
};

export type TriggerEvent = {
  type: "event";
  emitter: Address;
  /** `keccak256` of event signature, e.g. Ping(uint256) */
  eventTopic0: Hex;
  /** ABI JSON for decode in compiler (future) */
  abi?: readonly unknown[];
};

export type TriggerBlockTick = {
  type: "cron:block";
  /** Omit for every block */
  blockNumber?: bigint;
};

export type TriggerSchedule = {
  type: "cron:timestamp";
  timestampMs: number;
};

export type TriggerConfig = TriggerEvent | TriggerBlockTick | TriggerSchedule;

/** Off-chain condition using ethCall bundle (PRD §3.3.3) */
export type EthCallSpec = {
  to: Address;
  data: Hex;
};

/** v1 hybrid evaluator: compare decoded `uint256` from `simulationResults[index]`. */
export type ConditionOpV1 =
  | "uint256Gt"
  | "uint256Gte"
  | "uint256Lt"
  | "uint256Lte"
  | "uint256Eq"
  | "uint256Neq";

export type ConditionConfig = {
  /** Index into Somnia push `simulationResults[]` (aligned with root `ethCalls` order). */
  simulationResultIndex: number;
  description?: string;
  /** Required when using hybrid off-chain evaluation with a predicate. */
  op?: ConditionOpV1;
  /** Decimal integer string compared against decoded uint256, e.g. "0", "1000000". */
  compareDecimal?: string;
};

/** Multi-clause condition: `all` = AND, `any` = OR (same `simulationResults` slice). */
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

/** Fired when hybrid evaluation **passes** (sequential). */
export type EvaluationOnPassHook =
  | { type: "webhook"; url: string; headers?: Record<string, string> }
  | { type: "rawTx"; to: Address; data: Hex; valueWei?: string };

export type ActionCall = {
  type: "call";
  target: Address;
  data: Hex;
};

export type ActionEmit = {
  type: "emit";
  /**
   * Canonical ABI event signature for **topic0** (viem `toEventHash`). Examples: `Notify(uint256)`, `PairCreated(address,address,uint256)`.
   * Indexed keyword optional in the string; viem normalizes to the standard hash.
   */
  eventSig: string;
  /** Log **data** field (opaque bytes). Typically `encodeAbiParameters` for the non-indexed event inputs. Max 10,240 bytes (see `MAX_EMIT_PAYLOAD_BYTES`). Use `0x` for empty. */
  payload: Hex;
};

export type ActionNoop = { type: "noop" };

export type ActionConfig = ActionCall | ActionEmit | ActionNoop;

export type WorkflowNodeDef = {
  id: string;
  trigger: TriggerConfig;
  condition?: ConditionConfig;
  /** XOR with `condition` for hybrid root: compound uint256 checks. */
  conditionTree?: ConditionTree;
  action: ActionConfig;
  ethCalls?: EthCallSpec[];
};

export type WorkflowEdgeDef = {
  from: string;
  to: string;
  label?: string;
};

/** PRD §4.1 `WorkflowDefinition` */
export type WorkflowDefinition = {
  id: string;
  name: string;
  nodes: WorkflowNodeDef[];
  edges: WorkflowEdgeDef[];
  gasConfig?: GasConfig;
  /** Hybrid: hooks after a passing off-chain verdict (webhook and/or gated on-chain tx). */
  evaluationHooks?: {
    onPass?: EvaluationOnPassHook[];
  };
};
