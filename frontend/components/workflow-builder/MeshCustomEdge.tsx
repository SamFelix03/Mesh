"use client";

import type React from "react";
import { useCallback } from "react";
import { BaseEdge, type EdgeProps, getBezierPath, useReactFlow } from "reactflow";

export default function MeshCustomEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  markerEnd,
  style = {},
}: EdgeProps) {
  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const { setEdges } = useReactFlow();

  const onEdgeClick = useCallback(
    (evt: React.MouseEvent<SVGGElement>) => {
      evt.stopPropagation();
      setEdges((edges) => edges.filter((edge) => edge.id !== id));
    },
    [setEdges, id],
  );

  return (
    <>
      <BaseEdge path={edgePath} markerEnd={markerEnd} style={{ ...style, strokeWidth: 2 }} />
      <path
        d={edgePath}
        fill="none"
        strokeOpacity={0}
        strokeWidth={20}
        className="cursor-pointer"
        onClick={onEdgeClick}
      />
    </>
  );
}
