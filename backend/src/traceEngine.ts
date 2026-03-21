import type { SDK, SubscriptionCallback } from "@somnia-chain/reactivity";

/**
 * Wildcard off-chain subscription for WorkflowStepExecuted / WorkflowNoOp (PRD §3.3.2).
 * Wire callbacks to your WebSocket fan-out for the dashboard.
 */
export async function startTraceSubscription(
  sdk: SDK,
  onData: (data: SubscriptionCallback) => void,
  onError?: (err: Error) => void,
) {
  return sdk.subscribe({
    ethCalls: [],
    onData,
    onError,
  });
}
