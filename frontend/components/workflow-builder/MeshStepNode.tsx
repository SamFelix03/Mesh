"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "reactflow";
import { Box, Radio, Zap, GitBranch } from "lucide-react";
import type { MeshStepData } from "@/lib/workflowBuilder/meshStepData";

const actionIcon = (t: string) => {
  if (t === "call") return <Zap className="h-4 w-4" />;
  if (t === "emit") return <Radio className="h-4 w-4" />;
  return <Box className="h-4 w-4" />;
};

const triggerShort = (d: MeshStepData) => {
  if (d.triggerType === "event") return "Event";
  if (d.triggerType === "cron:block") return "Block";
  return "Schedule";
};

export const MeshStepNode = memo(({ data, isConnectable }: NodeProps<MeshStepData>) => {
  const d = data;
  return (
    <div className="min-w-[168px] rounded-md border-2 border-violet-500 bg-white px-3 py-2 shadow-md dark:border-violet-400 dark:bg-zinc-900">
      <Handle
        type="target"
        position={Position.Top}
        isConnectable={isConnectable}
        className="h-3 w-3 border-2 border-white bg-violet-500"
      />
      <div className="flex items-start gap-2">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-100 text-violet-600 dark:bg-violet-950 dark:text-violet-300">
          {actionIcon(d.actionType)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1 text-sm font-bold text-zinc-900 dark:text-zinc-50">
            {d.hybridEnabled ? <GitBranch className="h-3.5 w-3.5 text-amber-500" aria-label="Hybrid" /> : null}
            <span className="truncate">{d.label}</span>
          </div>
          <div className="text-[11px] text-zinc-500">
            {triggerShort(d)} · {d.actionType}
          </div>
          <div className="truncate font-mono text-[10px] text-zinc-400">{d.dslId}</div>
        </div>
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        isConnectable={isConnectable}
        className="h-3 w-3 border-2 border-white bg-violet-500"
      />
    </div>
  );
});

MeshStepNode.displayName = "MeshStepNode";
