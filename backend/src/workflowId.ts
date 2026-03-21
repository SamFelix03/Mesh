import { keccak256, stringToBytes } from "viem";

/** Derive on-chain workflow id from DSL `id: string` (UTF-8 bytes, same as `keccak256(bytes(string))` in Solidity). */
export function workflowIdFromString(id: string): `0x${string}` {
  return keccak256(stringToBytes(id));
}
