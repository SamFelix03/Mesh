"use client";

import type { ReactNode } from "react";
import type { Node } from "reactflow";
import { X } from "lucide-react";
import type { MeshStepData } from "@/lib/workflowBuilder/meshStepData";
import { WORKFLOW_START_NODE_ID } from "@/lib/workflowBuilder/meshStepData";
import type { ConditionOpV1 } from "@/lib/workflowBuilder/dsl";

const OPS: ConditionOpV1[] = [
  "uint256Gt",
  "uint256Gte",
  "uint256Lt",
  "uint256Lte",
  "uint256Eq",
  "uint256Neq",
];

type Props = {
  node: Node;
  isRoot: boolean;
  updateNodeData: (nodeId: string, data: Partial<MeshStepData>) => void;
  onClose: () => void;
};

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">{label}</label>
      {children}
    </div>
  );
}

const inputClass =
  "rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100";

export default function MeshNodeConfigPanel({ node, isRoot, updateNodeData, onClose }: Props) {
  if (node.id === WORKFLOW_START_NODE_ID) {
    return (
      <div className="flex h-full flex-col border-l border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Start</h2>
          <button type="button" onClick={onClose} className="rounded p-1 text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-800">
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-3 text-xs text-zinc-500">
          Connect Start to exactly one step — that step becomes the DAG root (subscription entry for the compiler).
        </p>
      </div>
    );
  }

  const d = node.data as MeshStepData;
  const set = (patch: Partial<MeshStepData>) => updateNodeData(node.id, patch);

  return (
    <div className="flex h-full max-h-screen flex-col border-l border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex shrink-0 items-center justify-between border-b border-zinc-200 p-3 dark:border-zinc-800">
        <h2 className="text-sm font-semibold">Step configuration</h2>
        <button type="button" onClick={onClose} className="rounded p-1 text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-800">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="flex-1 space-y-4 overflow-y-auto p-3">
        <Field label="Display label">
          <input className={inputClass} value={d.label} onChange={(e) => set({ label: e.target.value })} />
        </Field>
        <Field label="Node id (DSL) — unique in graph">
          <input className={`${inputClass} font-mono text-xs`} value={d.dslId} onChange={(e) => set({ dslId: e.target.value })} />
        </Field>

        <div className="border-t border-zinc-200 pt-3 dark:border-zinc-800">
          <h3 className="mb-2 text-xs font-semibold uppercase text-zinc-500">Trigger</h3>
          <Field label="Type">
            <select
              className={inputClass}
              value={d.triggerType}
              onChange={(e) => set({ triggerType: e.target.value as MeshStepData["triggerType"] })}
            >
              <option value="event">event</option>
              <option value="cron:block">cron:block</option>
              <option value="cron:timestamp">cron:timestamp</option>
            </select>
          </Field>
          {d.triggerType === "event" ? (
            <>
              <Field label="Emitter (address)">
                <input className={`${inputClass} font-mono text-xs`} value={d.emitter} onChange={(e) => set({ emitter: e.target.value })} />
              </Field>
              <Field label="eventTopic0 (hex)">
                <input className={`${inputClass} font-mono text-xs`} value={d.eventTopic0} onChange={(e) => set({ eventTopic0: e.target.value })} />
              </Field>
            </>
          ) : null}
          {d.triggerType === "cron:block" ? (
            <Field label="blockNumber (empty = every block)">
              <input className={inputClass} value={d.blockNumber} onChange={(e) => set({ blockNumber: e.target.value })} placeholder="optional" />
            </Field>
          ) : null}
          {d.triggerType === "cron:timestamp" ? (
            <Field label="timestampMs (unix ms)">
              <input className={inputClass} value={d.timestampMs} onChange={(e) => set({ timestampMs: e.target.value })} />
            </Field>
          ) : null}
        </div>

        <div className="border-t border-zinc-200 pt-3 dark:border-zinc-800">
          <h3 className="mb-2 text-xs font-semibold uppercase text-zinc-500">Action</h3>
          <Field label="Type">
            <select
              className={inputClass}
              value={d.actionType}
              onChange={(e) => set({ actionType: e.target.value as MeshStepData["actionType"] })}
            >
              <option value="noop">noop</option>
              <option value="call">call</option>
              <option value="emit">emit</option>
            </select>
          </Field>
          {d.actionType === "call" ? (
            <>
              <Field label="target">
                <input className={`${inputClass} font-mono text-xs`} value={d.callTarget} onChange={(e) => set({ callTarget: e.target.value })} />
              </Field>
              <Field label="data (hex)">
                <input className={`${inputClass} font-mono text-xs`} value={d.callData} onChange={(e) => set({ callData: e.target.value })} />
              </Field>
            </>
          ) : null}
          {d.actionType === "emit" ? (
            <>
              <Field label="eventSig (e.g. Notify(uint256))">
                <input className={inputClass} value={d.emitEventSig} onChange={(e) => set({ emitEventSig: e.target.value })} />
              </Field>
              <Field label="payload (hex)">
                <input className={`${inputClass} font-mono text-xs`} value={d.emitPayload} onChange={(e) => set({ emitPayload: e.target.value })} />
              </Field>
            </>
          ) : null}
        </div>

        {isRoot ? (
          <div className="border-t border-amber-200 bg-amber-50/80 p-3 dark:border-amber-900 dark:bg-amber-950/30">
            <h3 className="mb-2 text-xs font-semibold uppercase text-amber-800 dark:text-amber-200">Hybrid (root only)</h3>
            <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
              <input type="checkbox" checked={d.hybridEnabled} onChange={(e) => set({ hybridEnabled: e.target.checked })} />
              Off-chain ethCall + condition (Somnia subscribe)
            </label>
            {d.hybridEnabled ? (
              <div className="mt-3 space-y-3">
                <Field label="Bundled ethCall `to`">
                  <input className={`${inputClass} font-mono text-xs`} value={d.hybridEthCallTo} onChange={(e) => set({ hybridEthCallTo: e.target.value })} />
                </Field>
                <Field label="Bundled ethCall `data`">
                  <input className={`${inputClass} font-mono text-xs`} value={d.hybridEthCallData} onChange={(e) => set({ hybridEthCallData: e.target.value })} />
                </Field>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={d.hybridUseTree} onChange={(e) => set({ hybridUseTree: e.target.checked })} />
                  Use condition tree (2 clauses max in UI)
                </label>
                <Field label="simulationResultIndex">
                  <input
                    type="number"
                    min={0}
                    className={inputClass}
                    value={d.hybridSimIndex}
                    onChange={(e) => set({ hybridSimIndex: Number(e.target.value) || 0 })}
                  />
                </Field>
                {!d.hybridUseTree ? (
                  <>
                    <Field label="Operator">
                      <select className={inputClass} value={d.hybridOp} onChange={(e) => set({ hybridOp: e.target.value as ConditionOpV1 })}>
                        {OPS.map((op) => (
                          <option key={op} value={op}>
                            {op}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="compareDecimal">
                      <input className={inputClass} value={d.hybridCompareDecimal} onChange={(e) => set({ hybridCompareDecimal: e.target.value })} />
                    </Field>
                  </>
                ) : (
                  <>
                    <Field label="Tree combinator">
                      <select
                        className={inputClass}
                        value={d.hybridTreeCombinator}
                        onChange={(e) => set({ hybridTreeCombinator: e.target.value as "all" | "any" })}
                      >
                        <option value="all">all (AND)</option>
                        <option value="any">any (OR)</option>
                      </select>
                    </Field>
                    <p className="text-[11px] text-zinc-500">Clause 1</p>
                    <Field label="op">
                      <select className={inputClass} value={d.hybridOp} onChange={(e) => set({ hybridOp: e.target.value as ConditionOpV1 })}>
                        {OPS.map((op) => (
                          <option key={op} value={op}>
                            {op}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="compareDecimal">
                      <input className={inputClass} value={d.hybridCompareDecimal} onChange={(e) => set({ hybridCompareDecimal: e.target.value })} />
                    </Field>
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={d.hybridTreeClause2Enabled} onChange={(e) => set({ hybridTreeClause2Enabled: e.target.checked })} />
                      Second clause (same index)
                    </label>
                    {d.hybridTreeClause2Enabled ? (
                      <>
                        <Field label="Clause 2 op">
                          <select className={inputClass} value={d.hybridTreeOp2} onChange={(e) => set({ hybridTreeOp2: e.target.value as ConditionOpV1 })}>
                            {OPS.map((op) => (
                              <option key={op} value={op}>
                                {op}
                              </option>
                            ))}
                          </select>
                        </Field>
                        <Field label="Clause 2 compareDecimal">
                          <input className={inputClass} value={d.hybridTreeCompare2} onChange={(e) => set({ hybridTreeCompare2: e.target.value })} />
                        </Field>
                      </>
                    ) : null}
                  </>
                )}
                <Field label="On-pass webhook URL (optional)">
                  <input className={inputClass} value={d.onPassWebhookUrl} onChange={(e) => set({ onPassWebhookUrl: e.target.value })} placeholder="https://..." />
                </Field>
              </div>
            ) : null}
          </div>
        ) : (
          <p className="text-xs text-zinc-500">Hybrid evaluation can only be configured on the root step (the one connected from Start).</p>
        )}
      </div>
    </div>
  );
}
