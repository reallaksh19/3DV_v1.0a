import { normalizeRvmSourceKind } from '../RvmSourceKindPolicy.js';

export const RVM_SOURCE_TOOLS_STAGEDJSON_KIND_GATE_SCHEMA = 'rvm-source-tools-stagedjson-kind-gate/v2';

const VERSION = '20260628-rvm-source-tools-stagedjson-native-kind-1';
const INSTALL_FLAG = Symbol.for('pcf-glb-rvm-source-tools-stagedjson-kind-gate-2');
const SOURCE_TOOLS_KEY = '__PCF_GLB_RVM_NON_PRIMITIVE_SOURCE_TOOLS_UI__';
const SOURCE_KINDS = new Set(['stagedjson', 'staged.json']);

function normalizeKind(value = '') {
  return normalizeRvmSourceKind(value);
}

function activeKind(root, viewer) {
  return normalizeKind(root?.dataset?.rvmLoadedSourceKind || viewer?.sourceKind || viewer?.modelGroup?.userData?.__rvmNonPrimitiveSourceKind || '');
}

function withNativeKind(root, viewer, callback) {
  const kind = activeKind(root, viewer);
  if (!SOURCE_KINDS.has(kind) || !root?.dataset) return callback();
  const previous = root.dataset.rvmLoadedSourceKind || '';
  root.dataset.rvmSourceToolsOriginalKind = kind;
  root.dataset.rvmSourceToolsStagedJsonGate = VERSION;
  root.dataset.rvmLoadedSourceKind = kind;
  try {
    return callback();
  } finally {
    if (previous) root.dataset.rvmLoadedSourceKind = previous;
    else delete root.dataset.rvmLoadedSourceKind;
  }
}

function installNow() {
  const api = globalThis[SOURCE_TOOLS_KEY];
  if (!api || api.__stagedJsonKindGate === VERSION) return Boolean(api);
  const render = api.render;
  const sync = api.sync;
  const reapply = api.reapply;
  const reapplyAuto = api.reapplyAutoBendOnly;
  const reapplySupport = api.reapplySupportOverlayOnly;
  api.render = (root = globalThis.document?.querySelector?.('[data-rvm-viewer]'), viewer = globalThis.__3D_RVM_VIEWER__) => withNativeKind(root, viewer, () => render?.(root, viewer));
  api.sync = () => {
    const roots = Array.from(globalThis.document?.querySelectorAll?.('[data-rvm-viewer]') || []);
    if (!roots.length) return sync?.();
    const viewer = globalThis.__3D_RVM_VIEWER__;
    return { status: 'synced', version: VERSION, roots: roots.length, results: roots.map((root) => withNativeKind(root, viewer, () => render?.(root, viewer))) };
  };
  api.reapply = (root, viewer = globalThis.__3D_RVM_VIEWER__) => withNativeKind(root, viewer, () => reapply?.(root, viewer));
  api.reapplyAutoBendOnly = (root, viewer = globalThis.__3D_RVM_VIEWER__) => withNativeKind(root, viewer, () => reapplyAuto?.(root, viewer));
  api.reapplySupportOverlayOnly = (root, viewer = globalThis.__3D_RVM_VIEWER__) => withNativeKind(root, viewer, () => reapplySupport?.(root, viewer));
  api.__stagedJsonKindGate = VERSION;
  api.stagedJsonKindGateKinds = Array.from(SOURCE_KINDS);
  api.stagedJsonKindGateNativeKind = true;
  try { api.sync?.(); } catch (_) {}
  return true;
}

export function installRvmSourceToolsStagedJsonKindGateBridge() {
  if (globalThis[INSTALL_FLAG]) return globalThis.__PCF_GLB_RVM_SOURCE_TOOLS_STAGEDJSON_KIND_GATE__;
  globalThis[INSTALL_FLAG] = true;
  const api = { schema: RVM_SOURCE_TOOLS_STAGEDJSON_KIND_GATE_SCHEMA, version: VERSION, installNow, sourceKinds: Array.from(SOURCE_KINDS), nativeSourceKind: true };
  globalThis.__PCF_GLB_RVM_SOURCE_TOOLS_STAGEDJSON_KIND_GATE__ = api;
  const retry = (attempt = 0) => {
    if (installNow() || attempt >= 20) return;
    setTimeout(() => retry(attempt + 1), 50);
  };
  retry();
  globalThis.addEventListener?.('rvm-model-loaded', () => setTimeout(() => retry(), 0));
  return api;
}
