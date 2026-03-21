"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "reactflow";
import { Play } from "lucide-react";

export type MeshStartNodeData = { label: string };

export const MeshStartNode = memo(({ data, isConnectable }: NodeProps<MeshStartNodeData>) => {
  return (
    <div
      className="rounded-lg p-1 shadow-md"
      style={{
        background: "linear-gradient(to bottom right, #34d399, #065f46)",
      }}
    >
      <div className="flex h-[100px] w-[120px] flex-col items-center justify-center gap-2 rounded-md bg-white dark:bg-zinc-900">
        <Play className="h-7 w-7 text-emerald-600" aria-hidden />
        <div className="text-center text-xs font-bold text-zinc-800 dark:text-zinc-100">{data.label}</div>
        <p className="px-1 text-center text-[10px] leading-tight text-zinc-500">Entry → first step</p>
        <Handle type="source" position={Position.Bottom} isConnectable={isConnectable} className="h-3 w-3 border-2 border-white bg-emerald-600" />
      </div>
    </div>
  );
});

MeshStartNode.displayName = "MeshStartNode";
