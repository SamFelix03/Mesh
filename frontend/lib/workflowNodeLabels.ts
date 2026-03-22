import { keccak256, stringToBytes } from "viem";

/**
 * On-chain `nodeId` for Mesh compiler output = `keccak256(bytes(string))` of the DSL node `id`
 * (same as `workflowIdFromString` in the backend, but per node).
 */
export function onChainStepNodeId(dslNodeId: string): `0x${string}` {
  return keccak256(stringToBytes(dslNodeId));
}

/** Map lowercase `bytes32` step id → human-readable label (`name` or `id`) for trace UI. */
export function buildStepNodeLabelMap(nodes: { id: string; name?: string }[]): Record<string, string> {
  const m: Record<string, string> = {};
  for (const n of nodes) {
    if (!n?.id) continue;
    const label = n.name?.trim() || n.id;
    m[onChainStepNodeId(n.id).toLowerCase()] = label;
  }
  return m;
}
