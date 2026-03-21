import type { Hex } from "viem";

export type EvaluationPush = {
  t: number;
  workflowStringId: string;
  workflowId: Hex;
  nodeId: string;
  pass: boolean;
  reason: string;
  observed?: string;
  threshold?: string;
  simulationResultsCount?: number;
  topics?: readonly Hex[];
  error?: boolean;
};

type EvalClient = {
  send: (s: string) => void;
  close: () => void;
  workflowIdFilter: `0x${string}` | null;
};

const clients = new Set<EvalClient>();

export function broadcastEvaluation(p: EvaluationPush): void {
  const line = JSON.stringify(p);
  for (const c of clients) {
    try {
      if (c.workflowIdFilter && c.workflowIdFilter !== p.workflowId.toLowerCase()) continue;
      c.send(line);
    } catch {
      clients.delete(c);
    }
  }
}

export function registerEvaluationClient(c: EvalClient): () => void {
  clients.add(c);
  return () => {
    clients.delete(c);
  };
}
