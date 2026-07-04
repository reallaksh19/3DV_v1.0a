import { createRvmUiDiagnostics as createHandoffDiagnostics } from './RvmUiHandoff.js';

export const STAGE_WORKER_FAILURE_ID = 'STAGE_WORKER_FAILED';
export const STAGE_WORKER_PREFLIGHT_ID = 'STAGE_RVM_PREFLIGHT_FAILED';

/**
 * Normalizes RVM worker evidence into 3D Json Viewer diagnostic rows.
 * Parameters: a StageWorker result or failure payload from the RVM evidence pipeline.
 * Output: UI-safe diagnostic rows with severity, code, and message fields.
 * Fallback: delegates to RvmUiHandoff summaries and returns an empty list when no evidence exists.
 */
export function createRvmUiDiagnostics(result = {}) {
  return createHandoffDiagnostics(result);
}
