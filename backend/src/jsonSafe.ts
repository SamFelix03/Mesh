/** Safe for `JSON.stringify` / Fastify bodies (viem uses `bigint` everywhere). */
export function replyJsonStringify(payload: unknown): string {
  return JSON.stringify(payload, (_, value) => (typeof value === "bigint" ? value.toString() : value));
}
