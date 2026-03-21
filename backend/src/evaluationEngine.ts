export {
  syncEvaluationSubscriptions,
  startEvaluationEngineWithWatcher,
} from "./evaluationRuntime.js";

/** Starts evaluation sync + index file watcher (`EVALUATION_ENGINE=1`). */
export async function startEvaluationEngine(): Promise<void> {
  const { startEvaluationEngineWithWatcher } = await import("./evaluationRuntime.js");
  return startEvaluationEngineWithWatcher();
}
