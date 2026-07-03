import { isRvmSourcePreviewKind, normalizeRvmSourceKind } from '../RvmSourceKindPolicy.js';

const VERSION = '20260629-rvm-deferred-support-details-polish-1';
const PREVIOUS_VERSION = '20260628-rvm-deferred-source-tools-dashboard-1';
// Audit compatibility key retained for UI-contract tests: right-panel-policy-sync.
const API_KEY = '__PCF_GLB_RVM_BRIDGE_LOADER__';
const ACTION_DIAGNOSTICS_KEY = '__PCF_GLB_RVM_ACTION_DIAGNOSTICS__';

const BRIDGE_GROUPS = Object.freeze({
  sourcePreview: [
    { id: 'nonprimitive-support-overlay', specifier: './RvmNonPrimitiveSupportOverlayBridge.js?v=20260623-nonprimitive-support-overlay-9', install: 'installRvmNonPrimitiveSupportOverlayBridge' },
    { id: 'nonprimitive-support-hard-disable', specifier: './RvmNonPrimitiveSupportOverlayHardDisableBridge.js?v=20260623-nonprimitive-support-hard-disable-1', install: 'installRvmNonPrimitiveSupportOverlayHardDisableBridge' },
    { id: 'nonprimitive-support-details-panel', specifier: './RvmNonPrimitiveSupportOverlayDetailsPanelBridge.js?v=20260629-rvm-support-details-polish-1', previousSpecifier: './RvmNonPrimitiveSupportOverlayDetailsPanelBridge.js?v=20260623-nonprimitive-support-details-panel-4', install: 'installRvmNonPrimitiveSupportOverlayDetailsPanelBridge' },
    { id: 'nonprimitive-support-hover', specifier: './RvmNonPrimitiveSupportOverlayHoverBridge.js?v=20260623-nonprimitive-support-hover-2', install: 'installRvmNonPrimitiveSupportOverlayHoverBridge' },
    { id: 'nonprimitive-auto-bend', specifier: './RvmNonPrimitiveAutoBendBridge.js?v=20260623-nonprimitive-auto-bend-preview-2', install: 'installRvmNonPrimitiveAutoBendBridge' },
    { id: 'nonprimitive-node-markers', specifier: './RvmNonPrimitiveNodeMarkerBridge.js?v=20260625-node-marker-deferred-1', install: 'installRvmNonPrimitiveNodeMarkerBridge' },
    { id: 'nonprimitive-source-tools-ui', specifier: './RvmNonPrimitiveSourceToolsUiBridge.js?v=20260628-rvm-source-tools-dashboard-1', previousSpecifier: './RvmNonPrimitiveSourceToolsUiBridge.js?v=20260628-rvm-source-tools-shared-kind-policy-1', install: 'installRvmNonPrimitiveSourceToolsUiBridge' },
  ],
  postModel: [
    { id: 'right-panel-tabs', specifier: './RvmRightPanelTabsBridge.js?v=20260629-rvm-right-panel-tabs-1', install: 'installRvmRightPanelTabsBridge' },
    { id: 'right-panel-partition', specifier: './RvmRightPanelPartitionBridge.js?v=20260630-rvm-right-panel-partition-1', install: 'installRvmRightPanelPartitionBridge' },
    { id: 'hierarchy-dynamic-child-checkbox', specifier: './RvmHierarchyDynamicChildCheckboxBridge.js?v=20260630-rvm-hierarchy-dynamic-child-checkbox-1', install: 'installRvmHierarchyDynamicChildCheckboxBridge' },
    { id: 'code4-elbow-render', specifier: '../rvm/BrowserRvmCode4ElbowRenderBridge.js?v=20260630-rvm-code4-elbow-native-overlay-2', install: 'installBrowserRvmCode4ElbowRenderBridge' },
    { id: 'tag-tools', specifier: './RvmTagToolsBridge.js?v=20260630-rvm-tag-tools-2', install: 'installRvmTagToolsBridge' },
    { id: 'tag-coordinate-bridge', specifier: './RvmTagCoordinateBridge.js?v=20260630-rvm-tag-coordinate-bridge-1', install: 'installRvmTagCoordinateBridge' },
    { id: 'stagedjson-export', specifier: './RvmStagedJsonExportBridge.js?v=20260624-rvm-stagedjson-support-policy-1', install: 'installRvmStagedJsonExportBridge' },
    { id: 'stagedjson-validation', specifier: './RvmStagedJsonValidationBridge.js?v=20260624-rvm-stagedjson-support-policy-1', install: 'installRvmStagedJsonValidationBridge' },
    { id: 'right-panel-format-policy', specifier: './RvmRightPanelFormatPolicyBridge.js?v=20260628-rvm-right-panel-ui-v2-1', previousSpecifier: './RvmRightPanelFormatPolicyBridge.js?v=20260628-rvm-right-panel-layout-1', install: 'installRvmRightPanelFormatPolicyBridge' },
    { id: 'source-format-input', specifier: './RvmSourceFormatInputBridge.js?v=20260627-rvm-source-format-input-1', install: 'installRvmSourceFormatInputBridge' },
    { id: 'primitive-fallback', specifier: './RvmPrimitiveFallbackBridge.js?v=20260620-rvm-primitive-fallback-clickable-1', install: 'installRvmPrimitiveFallbackBridge' },
    { id: 'native-glb-export', specifier: './RvmNativeSceneGlbExportBridge.js?v=20260620-rvm-glb-component-hierarchy-v3-1', install: 'installRvmNativeSceneGlbExportBridge' },
    { id: 'glb-export-profile', specifier: './RvmGlbExportProfileBridge.js?v=20260620-rvm-glb-export-profile-units-1', install: 'installRvmGlbExportProfileBridge' },
    { id: 'glb-export-validation', specifier: './RvmGlbExportValidationBridge.js?v=20260620-rvm-glb-export-validation-1', install: 'installRvmGlbExportValidationBridge' },
    { id: 'glb-roundtrip-validation', specifier: './RvmGlbRoundTripValidationBridge.js?v=20260620-rvm-glb-roundtrip-validation-1', install: 'installRvmGlbRoundTripValidationBridge' },
    { id: 'glb-selection-parity', specifier: './RvmGlbSelectionParityBridge.js?v=20260620-rvm-glb-selection-details-parity-1', install: 'installRvmGlbSelectionParityBridge' },
    { id: 'glb-acceptance-pack', specifier: './RvmGlbAcceptancePackBridge.js?v=20260620-rvm-stagedjson-validation-1', install: 'installRvmGlbAcceptancePackBridge' },
    { id: 'native-tessellation-diagnostics', specifier: './RvmNativeTessellationDiagnosticsBridge.js?v=20260620-rvm-native-diagnostics-1', install: 'installRvmNativeTessellationDiagnosticsBridge' },
    { id: 'object-search', specifier: './RvmObjectSearchBridge.js?v=20260621-rvm-object-search-1', install: 'installRvmObjectSearchBridge' },
    { id: 'visibility-snapshots', specifier: './RvmVisibilitySnapshotsBridge.js?v=20260621-rvm-visibility-snapshots-1', install: 'installRvmVisibilitySnapshotsBridge' },
    { id: 'selection-sets', specifier: './RvmSelectionSetsBridge.js?v=20260621-rvm-selection-sets-1', install: 'installRvmSelectionSetsBridge' },
    { id: 'report-export', specifier: './RvmReportExportBridge.js?v=20260627-rvm-report-misc-compact-1', previousSpecifier: './RvmReportExportBridge.js?v=20260621-rvm-report-export-1', install: 'installRvmReportExportBridge' },
    { id: 'model-health', specifier: './RvmModelHealthBridge.js?v=20260627-rvm-health-misc-compact-1', previousSpecifier: './RvmModelHealthBridge.js?v=20260621-rvm-health-issues-1', install: 'installRvmModelHealthBridge' },
    { id: 'model-health-issues', specifier: './RvmModelHealthIssuesBridge.js?v=20260627-rvm-health-issues-misc-compact-1', previousSpecifier: './RvmModelHealthIssuesBridge.js?v=20260621-rvm-health-issues-1', install: 'installRvmModelHealthIssuesBridge' },
  ],
});

const loadedSpecs = new Map();
const groupPromises = new Map();
let activeRoot = null;
let modelLoadedListenerInstalled = false;
let modelReadyPollStarted = false;
let actionDiagnosticsInstalled = false;

export function installRvmDeferredBridgeLoader() {
  refreshRootInstallEpoch();
  const api = globalThis[API_KEY] || {
    version: VERSION,
    previousVersion: PREVIOUS_VERSION,
    groups: Object.keys(BRIDGE_GROUPS),
    ensureGroup: (groupName, reason = 'api') => ensureRvmBridgeGroup(groupName, reason),
    ensurePostModel: (reason = 'api') => ensureRvmBridgeGroup('postModel', reason),
    ensureSourcePreview: (reason = 'api') => ensureSourcePreviewGroupIfNeeded(reason),
    getLoadedBridgeIds: () => [...loadedSpecs.keys()],
    getDiagnostics: () => globalThis[ACTION_DIAGNOSTICS_KEY] || null,
  };
  api.version = VERSION;
  api.previousVersion = PREVIOUS_VERSION;
  api.groups = Object.keys(BRIDGE_GROUPS);
  api.ensureSourcePreview = (reason = 'api') => ensureSourcePreviewGroupIfNeeded(reason);
  globalThis[API_KEY] = api;
  installRvmBridgeActionDiagnostics();
  installModelLoadedListener();
  startModelReadyPolling(api);
  afterFirstPaint(() => {
    const root = document.querySelector('[data-rvm-viewer]');
    if (root?.dataset?.rvmModelLoaded === 'true') {
      api.ensurePostModel('already-loaded-after-first-paint');
      api.ensureSourcePreview('already-loaded-after-first-paint');
    }
  });
  return api;
}

export function ensureRvmBridgeGroup(groupName, reason = 'manual') {
  refreshRootInstallEpoch();
  const group = BRIDGE_GROUPS[groupName];
  if (!group) return Promise.reject(new Error(`Unknown RVM bridge group: ${groupName}`));
  const existing = groupPromises.get(groupName);
  if (existing) return existing;
  const promise = Promise.allSettled(group.map((spec) => loadAndInstall(spec, reason))).then((results) => {
    const failures = results.map((result, index) => ({ result, spec: group[index] })).filter(({ result }) => result.status === 'rejected');
    if (failures.length) for (const { result, spec } of failures) reportRvmActionError(result.reason, { action: 'bridge-install', bridge: spec.id, group: groupName, reason });
    if (groupName === 'sourcePreview' && !failures.length) refreshSourcePreviewRuntime(reason);
    refreshDiagnosticsDrawer();
    return { group: groupName, reason, results, failures };
  });
  groupPromises.set(groupName, promise);
  return promise;
}

async function loadAndInstall(spec, reason) {
  if (loadedSpecs.has(spec.id)) return loadedSpecs.get(spec.id);
  spec.beforeInstall?.();
  const module = await import(spec.specifier);
  const installer = module?.[spec.install];
  if (typeof installer !== 'function') throw new Error(`RVM bridge ${spec.id} missing installer ${spec.install}`);
  const api = installer();
  const entry = { id: spec.id, version: VERSION, reason, installedAt: new Date().toISOString(), api: Boolean(api) };
  loadedSpecs.set(spec.id, entry);
  return entry;
}

function refreshRootInstallEpoch() {
  const root = document.querySelector('[data-rvm-viewer]');
  if (!root || root === activeRoot) return;
  activeRoot = root;
  groupPromises.clear();
  loadedSpecs.clear();
}

function installModelLoadedListener() {
  if (modelLoadedListenerInstalled || typeof globalThis.addEventListener !== 'function') return;
  modelLoadedListenerInstalled = true;
  globalThis.addEventListener('rvm-model-loaded', (event) => {
    const reason = event?.detail?.reason || 'rvm-model-loaded';
    afterFirstPaint(() => {
      ensureRvmBridgeGroup('postModel', reason);
      ensureSourcePreviewGroupIfNeeded(reason);
    });
  });
}

function startModelReadyPolling(api) {
  if (modelReadyPollStarted) return;
  modelReadyPollStarted = true;
  let attempts = 0;
  const tick = () => {
    attempts += 1;
    const root = document.querySelector('[data-rvm-viewer]');
    const viewer = globalThis.__3D_RVM_VIEWER__;
    const modelReady = Boolean(root && viewer?.modelGroup?.children?.length);
    if (modelReady) {
      root.dataset.rvmModelLoaded = 'true';
      afterFirstPaint(() => {
        api.ensurePostModel('model-ready-poll');
        api.ensureSourcePreview('model-ready-poll');
      });
      return;
    }
    if (attempts < 90) setTimeout(tick, 350);
  };
  setTimeout(tick, 250);
}

function ensureSourcePreviewGroupIfNeeded(reason = 'manual') {
  const root = document.querySelector('[data-rvm-viewer]');
  const sourceKind = normalizeRvmSourceKind(root?.dataset?.rvmLoadedSourceKind || '');
  if (!isRvmSourcePreviewKind(sourceKind)) return Promise.resolve({ group: 'sourcePreview', reason, skipped: true, sourceKind });
  return ensureRvmBridgeGroup('sourcePreview', reason);
}

function refreshSourcePreviewRuntime(reason = 'manual') {
  const root = document.querySelector('[data-rvm-viewer]');
  const sourceKind = normalizeRvmSourceKind(root?.dataset?.rvmLoadedSourceKind || '');
  if (!root || !isRvmSourcePreviewKind(sourceKind)) return;
  try { globalThis.__PCF_GLB_RVM_RIGHT_PANEL_FORMAT_POLICY__?.refresh?.(root, `source-preview-${reason}`); } catch (_) {}
  try { globalThis.__PCF_GLB_RVM_NON_PRIMITIVE_SOURCE_TOOLS_UI__?.refresh?.(root, `source-preview-${reason}`); } catch (_) {}
}

function installRvmBridgeActionDiagnostics() {
  if (actionDiagnosticsInstalled) return;
  actionDiagnosticsInstalled = true;
  globalThis.addEventListener?.('error', (event) => reportRvmActionError(event.error || event.message, { action: 'window-error' }));
  globalThis.addEventListener?.('unhandledrejection', (event) => reportRvmActionError(event.reason, { action: 'unhandledrejection' }));
}

function reportRvmActionError(error, context = {}) {
  const entry = { at: new Date().toISOString(), message: error?.message || String(error || 'Unknown RVM action error'), stack: error?.stack || '', ...context };
  const existing = globalThis[ACTION_DIAGNOSTICS_KEY] || { errors: [] };
  existing.errors = [...(existing.errors || []), entry].slice(-20);
  globalThis[ACTION_DIAGNOSTICS_KEY] = existing;
  refreshDiagnosticsDrawer();
}

function refreshDiagnosticsDrawer() {
  try { globalThis.__PCF_GLB_RVM_BOTTOM_DIAGNOSTICS_DRAWER__?.refresh?.('bridge-action-diagnostics'); } catch (_) {}
}

function afterFirstPaint(callback) {
  requestAnimationFrame(() => requestAnimationFrame(callback));
}
