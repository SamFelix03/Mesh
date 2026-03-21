"use client";

import type React from "react";
import { GitBranch } from "lucide-react";

const DRAG_TYPE = "meshStep";

export default function MeshNodeLibrary() {
  const onDragStart = (event: React.DragEvent<HTMLButtonElement>) => {
    event.dataTransfer.setData("application/reactflow", DRAG_TYPE);
    event.dataTransfer.effectAllowed = "move";
  };

  return (
    <div className="flex flex-col gap-3">
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Library</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Drag a step onto the canvas. Connect <strong>Start</strong> → first step, then chain steps. One root only.
        </p>
      </div>
      <button
        type="button"
        draggable
        onDragStart={onDragStart}
        className="flex h-auto min-h-16 w-full cursor-grab flex-col items-start gap-1 rounded-lg border border-zinc-200 bg-white px-3 py-3 text-left shadow-sm active:cursor-grabbing dark:border-zinc-700 dark:bg-zinc-900"
      >
        <div className="flex items-center gap-2 text-sm font-medium text-zinc-900 dark:text-zinc-50">
          <GitBranch className="h-4 w-4 text-violet-500" />
          Workflow step
        </div>
        <span className="text-xs text-zinc-500">Trigger + action (configure after drop)</span>
      </button>
      <p className="text-xs text-zinc-400">Tip: click an edge to delete it.</p>
    </div>
  );
}
