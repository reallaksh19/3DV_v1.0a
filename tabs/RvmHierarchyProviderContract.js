export const RVM_HIERARCHY_PROVIDER_CONTRACT_VERSION = '20260628-rvm-hierarchy-provider-contract-1';

const SOURCE_KINDS = new Set(['stagedjson', 'uxml', 'json', 'jscon', 'txt', 'source-preview', 'inputxml']);
const NATIVE_KINDS = new Set(['rvm', 'att', 'rev', 'binary-rvm']);

function text(value) { return String(value ?? '').trim(); }
function lower(value) { return text(value).toLowerCase(); }
function isObject(value) { return !!value && typeof value === 'object' && !Array.isArray(value); }
function array(value) { return Array.isArray(value) ? value : []; }

export function isSourceHierarchyProviderKind(value) { return SOURCE_KINDS.has(lower(value)); }
export function isNativeHierarchyProviderKind(value) { return NATIVE_KINDS.has(lower(value)); }
export function normalizeHierarchyProviderKind(value) {
  const kind = lower(value) || 'unknown';
  if (isSourceHierarchyProviderKind(kind)) return kind;
  if (isNativeHierarchyProviderKind(kind)) return kind === 'binary-rvm' ? 'rvm' : kind;
  return kind;
}

export function makeHierarchyProviderNode(node = {}, fallback = {}) {
  const attrs = isObject(node.attributes) ? node.attributes : {};
  const id = text(node.canonicalObjectId || node.id || node.nodeId || node.sourceObjectId || fallback.id);
  const parentId = text(node.parentCanonicalObjectId || node.parentId || node.parent || fallback.parentId);
  const label = text(node.name || node.label || node.displayName || node.sourceObjectId || attrs.NAME || attrs.TAG || id || 'Node');
  const kind = text(node.kind || node.type || attrs.TYPE || fallback.kind || 'NODE').toUpperCase();
  return {
    id,
    parentId: parentId || null,
    label,
    kind,
    sourceKind: normalizeHierarchyProviderKind(node.sourceKind || fallback.sourceKind),
    attributes: attrs,
    renderObjectIds: array(node.renderObjectIds).map(text).filter(Boolean),
    metadata: isObject(node.metadata) ? node.metadata : {},
    raw: node,
  };
}

export function makeHierarchyProviderResult({ providerId = '', sourceKind = '', fileName = '', nodes = [], metadata = {}, native = false } = {}) {
  const normalizedKind = normalizeHierarchyProviderKind(sourceKind);
  const providerNodes = array(nodes).map((node, index) => makeHierarchyProviderNode(node, { id: `node-${index + 1}`, sourceKind: normalizedKind }));
  return {
    version: RVM_HIERARCHY_PROVIDER_CONTRACT_VERSION,
    providerId: text(providerId) || `${normalizedKind || 'unknown'}-provider`,
    sourceKind: normalizedKind,
    sourceAuthority: native || isNativeHierarchyProviderKind(normalizedKind) ? 'native-rvm' : 'source-document',
    fileName: text(fileName),
    nodeCount: providerNodes.length,
    nodes: providerNodes,
    metadata: isObject(metadata) ? metadata : {},
  };
}

export function providerResultFromFormatNeutralState(state = {}) {
  return makeHierarchyProviderResult({
    providerId: 'format-neutral-source',
    sourceKind: state.sourceKind,
    fileName: state.fileName,
    nodes: state.nodes,
    metadata: state.metadata,
    native: false,
  });
}

export function providerResultFromNativeRvmPayload(payload = {}) {
  const nodes = payload?.manifest?.nodes || payload?.manifest?.items || payload?.indexJson?.nodes || [];
  return makeHierarchyProviderResult({
    providerId: 'native-rvm',
    sourceKind: 'rvm',
    fileName: payload?.fileName || payload?.manifest?.fileName || '',
    nodes,
    metadata: payload?.manifest || {},
    native: true,
  });
}
