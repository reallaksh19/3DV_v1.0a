import { normalizeRvmSourceKind } from '../RvmSourceKindPolicy.js';
import { RvmViewer3D } from '../rvm-viewer/RvmViewer3D.js?v=20260622-rvm-leaf-picking-2';

export const RVM_STAGEDJSON_SUPPORT_RUNTIME_GATE_SCHEMA = 'rvm-stagedjson-support-runtime-gate/v2';

const VERSION = '20260628-rvm-stagedjson-support-runtime-native-kind-1';
const INSTALL_FLAG = Symbol.for('pcf-glb-rvm-stagedjson-support-runtime-gate-2');
const VIEWER_PATCH_FLAG = Symbol.for('pcf-glb-rvm-stagedjson-support-runtime-gate-viewer-2');
const SUPPORT_OVERLAY_KEY = '__PCF_GLB_RVM_NON_PRIMITIVE_SUPPORT_OVERLAY__';
const SUPPORT_DETAILS_KEY = '__PCF_GLB_RVM_NON_PRIMITIVE_SUPPORT_DETAILS_PANEL__';
const SOURCE_KINDS = new Set(['stagedjson', 'staged.json']);

function normalizeKind(value = '') {
  return normalizeRvmSourceKind(value);
}

function isStagedKind(value) {
  return SOURCE_KINDS.has(String(value || '').trim().toLowerCase().replace(/^\./, '')) || normalizeKind(value) === 'stagedjson';
}

function stagedContextFrom(root, viewer) {
  const model = viewer?.modelGroup || viewer?.scene || null;
  const modelKind = model?.userData?.__rvmNonPrimitiveSourceKind || model?.userData?.sourceKind || '';
  const sourceKind = normalizeKind(modelKind || viewer?.sourceKind || root?.dataset?.rvmLoadedSourceKind || '');
  const source = model?.userData?.__rvmNonPrimitiveSourceHierarchy || model?.userData?.__rvmNonPrimitiveAutoBendSourceHierarchy || null;
  const fileName = model?.userData?.fileName || root?.dataset?.rvmLoadedFileName || '';
  return { model, source, sourceKind, fileName, staged: isStagedKind(sourceKind) && Boolean(source) };
}

function withRootKind(root, viewer, callback) {
  const context = stagedContextFrom(root, viewer);
  if (!context.staged || !root?.dataset) return callback(context);
  const previous = root.dataset.rvmLoadedSourceKind || '';
  root.dataset.rvmSupportRuntimeOriginalKind = context.sourceKind;
  root.dataset.rvmSupportRuntimeStagedJsonGate = VERSION;
  root.dataset.rvmLoadedSourceKind = context.sourceKind;
  try {
    return callback(context);
  } finally {
    if (previous) root.dataset.rvmLoadedSourceKind = previous;
    else delete root.dataset.rvmLoadedSourceKind;
  }
}

function normalizeApplyArgs(args = {}) {
  if (!isStagedKind(args.sourceKind)) return args;
  return { ...args, sourceKind: normalizeKind(args.sourceKind), stagedJsonSupportRuntimeGate: VERSION };
}

function installSupportOverlayGate() {
  const api = globalThis[SUPPORT_OVERLAY_KEY];
  if (!api || api.__stagedJsonSupportRuntimeGate === VERSION || typeof api.applyFromSource !== 'function') return Boolean(api);
  const applyFromSource = api.applyFromSource;
  api.applyFromSource = (args = {}) => applyFromSource(normalizeApplyArgs(args));
  api.__stagedJsonSupportRuntimeGate = VERSION;
  api.stagedJsonSupportRuntimeGateKinds = Array.from(SOURCE_KINDS);
  api.stagedJsonSupportRuntimeNativeKind = true;
  return true;
}

function installSupportDetailsGate() {
  const api = globalThis[SUPPORT_DETAILS_KEY];
  if (!api || api.__stagedJsonSupportRuntimeGate === VERSION) return Boolean(api);
  const render = api.render;
  const sync = api.sync;
  api.render = (root = globalThis.document?.querySelector?.('[data-rvm-viewer]'), viewer = globalThis.__3D_RVM_VIEWER__) => withRootKind(root, viewer, () => render?.(root, viewer));
  api.sync = () => {
    const roots = Array.from(globalThis.document?.querySelectorAll?.('[data-rvm-viewer]') || []);
    if (!roots.length) return sync?.();
    const viewer = globalThis.__3D_RVM_VIEWER__;
    return { status: 'synced', version: VERSION, roots: roots.length, results: roots.map((root) => withRootKind(root, viewer, () => render?.(root, viewer))) };
  };
  api.__stagedJsonSupportRuntimeGate = VERSION;
  api.stagedJsonSupportRuntimeNativeKind = true;
  return true;
}

function patchViewerSetModel() {
  const proto = RvmViewer3D?.prototype;
  if (!proto || proto[VIEWER_PATCH_FLAG] || typeof proto.setModel !== 'function') return false;
  const originalSetModel = proto.setModel;
  proto.setModel = function setModelWithStagedJsonSupportRuntimeGate(model, upAxis = 'Y') {
    const result = originalSetModel.call(this, model, upAxis);
    const sourceKind = normalizeKind(model?.userData?.__rvmNonPrimitiveSourceKind || model?.userData?.sourceKind || this?.sourceKind || '');
    const source = model?.userData?.__rvmNonPrimitiveSourceHierarchy || null;
    if (isStagedKind(sourceKind) && source) {
      queueMicrotask(() => {
        installSupportOverlayGate();
        installSupportDetailsGate();
        globalThis[SUPPORT_OVERLAY_KEY]?.applyFromSource?.({ viewer: this, source, sourceKind, fileName: model?.userData?.fileName || '' });
        globalThis[SUPPORT_DETAILS_KEY]?.sync?.();
      });
    }
    return result;
  };
  proto[VIEWER_PATCH_FLAG] = true;
  return true;
}

export function installRvmStagedJsonSupportRuntimeGateBridge() {
  if (globalThis[INSTALL_FLAG]) return globalThis.__PCF_GLB_RVM_STAGEDJSON_SUPPORT_RUNTIME_GATE__;
  globalThis[INSTALL_FLAG] = true;
  const api = { schema: RVM_STAGEDJSON_SUPPORT_RUNTIME_GATE_SCHEMA, version: VERSION, installNow, sourceKinds: Array.from(SOURCE_KINDS), nativeSourceKind: true };
  globalThis.__PCF_GLB_RVM_STAGEDJSON_SUPPORT_RUNTIME_GATE__ = api;
  patchViewerSetModel();
  const retry = (attempt = 0) => {
    const ok = installNow();
    if (ok || attempt >= 20) return;
    setTimeout(() => retry(attempt + 1), 50);
  };
  retry();
  globalThis.addEventListener?.('rvm-model-loaded', () => setTimeout(() => retry(), 0));
  return api;
}

export function installNow() {
  const overlay = installSupportOverlayGate();
  const details = installSupportDetailsGate();
  return Boolean(overlay && details);
}
