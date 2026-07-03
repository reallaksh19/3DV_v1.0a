import {
  isRvmPrimitiveSourceKind,
  isRvmSourcePreviewKind,
  normalizeRvmSourceKind,
  sourceKindFromFileName,
} from '../RvmSourceKindPolicy.js';

export const RVM_FORMAT_POLICY_VERSION = '20260628-rvm-right-panel-core-policy-1';
export const RVM_FORMAT_POLICY_SOURCE_EXTENSIONS = Object.freeze(['.stagedjson', '.staged.json', '.uxml.json', '.inputxml']);

export const RVM_RIGHT_PANEL_SECTIONS = Object.freeze({
  SELECTED_ENTITY: 'selected-entity',
  SOURCE_TOOLS: 'source-tools',
  SUPPORT_DETAILS: 'support-details',
  NODE_MARKERS: 'node-markers',
  STAGEDJSON_REVIEW: 'stagedjson-review',
  NATIVE_DIAGNOSTICS: 'native-diagnostics',
  BROWSER_DIAGNOSTICS: 'browser-diagnostics',
});

const SOURCE_PREVIEW_SECTIONS = Object.freeze([
  RVM_RIGHT_PANEL_SECTIONS.SELECTED_ENTITY,
  RVM_RIGHT_PANEL_SECTIONS.SOURCE_TOOLS,
  RVM_RIGHT_PANEL_SECTIONS.SUPPORT_DETAILS,
  RVM_RIGHT_PANEL_SECTIONS.NODE_MARKERS,
  RVM_RIGHT_PANEL_SECTIONS.BROWSER_DIAGNOSTICS,
]);

const NATIVE_SECTIONS = Object.freeze([
  RVM_RIGHT_PANEL_SECTIONS.SELECTED_ENTITY,
  RVM_RIGHT_PANEL_SECTIONS.NATIVE_DIAGNOSTICS,
  RVM_RIGHT_PANEL_SECTIONS.BROWSER_DIAGNOSTICS,
]);

const TXT_SECTIONS = Object.freeze([
  RVM_RIGHT_PANEL_SECTIONS.SELECTED_ENTITY,
  RVM_RIGHT_PANEL_SECTIONS.SOURCE_TOOLS,
  RVM_RIGHT_PANEL_SECTIONS.BROWSER_DIAGNOSTICS,
]);

const UNKNOWN_SECTIONS = Object.freeze([
  RVM_RIGHT_PANEL_SECTIONS.SELECTED_ENTITY,
  RVM_RIGHT_PANEL_SECTIONS.BROWSER_DIAGNOSTICS,
]);

const BASE_SELECTION_POLICY = Object.freeze({
  showSelection: true,
  showNativeDiagnostics: false,
  showSourceTools: false,
  showSupportDetails: false,
  showNodeMarkers: false,
  showStagedJsonReview: false,
  showBrowserDiagnostics: true,
  sections: UNKNOWN_SECTIONS,
});

function buildPolicy(overrides = {}, sections = UNKNOWN_SECTIONS) {
  const sectionSet = new Set(sections);
  return Object.freeze({
    ...BASE_SELECTION_POLICY,
    ...overrides,
    showSelection: sectionSet.has(RVM_RIGHT_PANEL_SECTIONS.SELECTED_ENTITY),
    showNativeDiagnostics: sectionSet.has(RVM_RIGHT_PANEL_SECTIONS.NATIVE_DIAGNOSTICS),
    showSourceTools: sectionSet.has(RVM_RIGHT_PANEL_SECTIONS.SOURCE_TOOLS),
    showSupportDetails: sectionSet.has(RVM_RIGHT_PANEL_SECTIONS.SUPPORT_DETAILS),
    showNodeMarkers: sectionSet.has(RVM_RIGHT_PANEL_SECTIONS.NODE_MARKERS),
    showStagedJsonReview: sectionSet.has(RVM_RIGHT_PANEL_SECTIONS.STAGEDJSON_REVIEW),
    showBrowserDiagnostics: sectionSet.has(RVM_RIGHT_PANEL_SECTIONS.BROWSER_DIAGNOSTICS),
    sections: Object.freeze([...sections]),
  });
}

const STAGEDJSON_SECTIONS = Object.freeze([
  RVM_RIGHT_PANEL_SECTIONS.SELECTED_ENTITY,
  RVM_RIGHT_PANEL_SECTIONS.SOURCE_TOOLS,
  RVM_RIGHT_PANEL_SECTIONS.SUPPORT_DETAILS,
  RVM_RIGHT_PANEL_SECTIONS.NODE_MARKERS,
  RVM_RIGHT_PANEL_SECTIONS.STAGEDJSON_REVIEW,
  RVM_RIGHT_PANEL_SECTIONS.BROWSER_DIAGNOSTICS,
]);

const POLICY_BY_KIND = Object.freeze({
  rvm: buildPolicy({}, NATIVE_SECTIONS),
  rev: buildPolicy({}, NATIVE_SECTIONS),
  glb: buildPolicy({}, NATIVE_SECTIONS),
  gltf: buildPolicy({}, NATIVE_SECTIONS),
  json: buildPolicy({}, SOURCE_PREVIEW_SECTIONS),
  jscon: buildPolicy({}, SOURCE_PREVIEW_SECTIONS),
  inputxml: buildPolicy({}, SOURCE_PREVIEW_SECTIONS),
  txt: buildPolicy({}, TXT_SECTIONS),
  'source-preview': buildPolicy({}, SOURCE_PREVIEW_SECTIONS),
  stagedjson: buildPolicy({}, STAGEDJSON_SECTIONS),
  unknown: buildPolicy({}, UNKNOWN_SECTIONS),
});

export { normalizeRvmSourceKind, sourceKindFromFileName, isRvmPrimitiveSourceKind, isRvmSourcePreviewKind };

export function getRvmRightPanelSections(policy = {}) {
  return Array.isArray(policy.sections) ? policy.sections : [];
}

export function hasRvmRightPanelSection(policy = {}, section = '') {
  return getRvmRightPanelSections(policy).includes(section);
}

export function getRvmRightPanelPolicy(kind, primitiveMode = '') {
  const sourceKind = normalizeRvmSourceKind(kind || 'unknown');
  const mode = String(primitiveMode || '').toLowerCase();
  if (isRvmPrimitiveSourceKind(sourceKind)) return POLICY_BY_KIND[sourceKind] || POLICY_BY_KIND.unknown;
  if (isRvmSourcePreviewKind(sourceKind)) {
    if (mode === 'source-preview') return POLICY_BY_KIND[sourceKind] || POLICY_BY_KIND.unknown;
    return POLICY_BY_KIND.unknown;
  }
  return POLICY_BY_KIND[sourceKind] || POLICY_BY_KIND.unknown;
}

export function resolveRvmFormatContext({ root = null, viewer = globalThis.__3D_RVM_VIEWER__ } = {}) {
  const activeRoot = root || globalThis.document?.querySelector?.('[data-rvm-viewer]') || null;
  const model = viewer?.modelGroup || viewer?.scene || null;
  const userData = model?.userData || {};
  const fileName = String(
    userData.fileName
      || viewer?.loadedFileName
      || viewer?.sourceFileName
      || activeRoot?.dataset?.rvmFileName
      || ''
  );
  const fileKind = sourceKindFromFileName(fileName);
  const stampedKind = normalizeRvmSourceKind(
    activeRoot?.dataset?.rvmLoadedSourceKind
      || userData.__rvmNonPrimitiveSourceKind
      || userData.__rvmNonPrimitiveAutoBendSourceKind
      || userData.sourceKind
      || viewer?.sourceKind
      || ''
  );
  const detectedKind = fileKind === 'stagedjson' && (!stampedKind || stampedKind === 'json' || stampedKind === 'source-preview')
    ? 'stagedjson'
    : normalizeRvmSourceKind(stampedKind || fileKind || 'unknown');
  const primitiveMode = String(activeRoot?.dataset?.rvmModelPrimitiveMode || viewer?.modelPrimitiveMode || '').toLowerCase();
  const source = userData.__rvmNonPrimitiveAutoBendSourceHierarchy || userData.__rvmNonPrimitiveSourceHierarchy || null;
  const supportSource = userData.__rvmNonPrimitiveSourceHierarchy || source;
  const policy = getRvmRightPanelPolicy(detectedKind, primitiveMode);
  const sections = getRvmRightPanelSections(policy);
  return {
    root: activeRoot,
    viewer,
    model,
    userData,
    sourceKind: detectedKind,
    primitiveMode,
    fileName,
    source,
    supportSource,
    policy,
    sections,
    isPrimitive: isRvmPrimitiveSourceKind(detectedKind),
    isSourcePreview: primitiveMode === 'source-preview' && isRvmSourcePreviewKind(detectedKind),
    version: RVM_FORMAT_POLICY_VERSION,
  };
}
