const INSTALL_FLAG = Symbol.for('pcf-glb-rvm-hierarchy-provider-selection-parity-1');
export const RVM_HIERARCHY_PROVIDER_SELECTION_PARITY_VERSION = '20260629-rvm-provider-selection-parity-1';
const ROOT_SELECTOR = '[data-rvm-viewer]';
const MAX_RENDER_SCAN = 20000;

function text(value) { return String(value ?? '').trim(); }
function escapeHtml(value) { return text(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;'); }
function normalize(value) { return text(value).toLowerCase(); }
function uniq(values = []) { return Array.from(new Set(values.map(text).filter(Boolean))); }
function row(label, value) { return `<div class="rvm-browser-diag-row"><span>${escapeHtml(label)}</span><b>${escapeHtml(value || '-')}</b></div>`; }

function viewer() { return globalThis.__3D_RVM_VIEWER__ || null; }
function providerResult(root) { return root?.__rvmFormatNeutralHierarchy?.providerResult || root?.__rvmFormatNeutralHierarchy?.hierarchyProviderResult || root?.__rvmHierarchyProviderResult || root?.__rvmNativeHierarchyProvider?.providerResult || root?.__rvmNativeHierarchyProvider || null; }
function runtimeTelemetry(root) { return root?.__rvmHierarchyProviderRuntimeTelemetry || globalThis.__PCF_GLB_RVM_HIERARCHY_READ_PATH_TELEMETRY__ || null; }
function providerNodes(root) { const nodes = providerResult(root)?.nodes || []; return Array.isArray(nodes) ? nodes : []; }
function providerIds(root) { return providerNodes(root).map((node) => text(node.canonicalObjectId || node.id || node.nodeId)).filter(Boolean); }
function duplicateIds(ids = []) { const seen = new Set(); const dupes = new Set(); for (const id of ids) { if (seen.has(id)) dupes.add(id); else seen.add(id); } return Array.from(dupes); }
function selectedTreeNodeId(root, detail = {}) { return text(detail.nodeId || root?.dataset?.rvmSelectionTreeSyncLastNode || root?.querySelector?.('#rvm-tree li.is-selected[data-node-id], #rvm-tree li.is-canvas-selected[data-node-id]')?.dataset?.nodeId || ''); }

function attrsFor(obj) { const data = obj?.userData || {}; const props = data.browserRvmProperties || {}; return data.browserRvmAttributes || data.attributes || props.attributes || {}; }
function aliasesForObject(obj) {
  const data = obj?.userData || {};
  const props = data.browserRvmProperties || {};
  const attrs = attrsFor(obj);
  return uniq([obj?.name, obj?.uuid, data.name, data.canonicalObjectId, data.sourceObjectId, data.sourcePath, data.sourceName, data.displayName, props.name, props.sourcePath, props.displayName, attrs.NAME, attrs.TAG, attrs.RVM_OWNER_NAME, attrs.RVM_OWNER_PATH, attrs.RVM_REVIEW_NAME]);
}

function selectedAliases(root, detail = {}) {
  const v = viewer();
  const out = [selectedTreeNodeId(root, detail), detail.canonicalId, detail.renderObjectId];
  for (const id of detail.canonicalIds || []) out.push(id);
  for (const id of detail.renderObjectIds || []) out.push(id);
  for (const id of v?.selection?.getSelectedCanonicalIds?.() || []) out.push(id);
  for (const id of v?.selection?.getSelectionRenderIds?.() || []) out.push(id);
  for (const obj of Array.isArray(v?._rvmCanvasSelectedMeshes) ? v._rvmCanvasSelectedMeshes : []) out.push(...aliasesForObject(obj));
  return uniq(out);
}

function renderAliasSet() {
  const v = viewer();
  const aliases = new Set();
  let scanned = 0;
  v?.modelGroup?.traverse?.((obj) => {
    if (scanned >= MAX_RENDER_SCAN) return;
    if (!(obj?.isMesh || obj?.isLine || obj?.isPoints)) return;
    scanned += 1;
    for (const alias of aliasesForObject(obj)) aliases.add(normalize(alias));
  });
  return { aliases, scanned };
}

function ensurePanel(root) {
  const anchor = root?.querySelector?.('#rvm-hierarchy-provider-debug') || root?.querySelector?.('#rvm-browser-parse-diagnostics');
  if (!anchor) return null;
  let panel = root.querySelector('#rvm-hierarchy-provider-selection-parity');
  if (!panel) {
    panel = document.createElement('div');
    panel.id = 'rvm-hierarchy-provider-selection-parity';
    panel.className = 'rvm-tag-list rvm-hierarchy-provider-selection-parity';
    panel.dataset.rvmHierarchyProviderSelectionParity = RVM_HIERARCHY_PROVIDER_SELECTION_PARITY_VERSION;
    anchor.insertAdjacentElement('afterend', panel);
  }
  return panel;
}

export function computeHierarchyProviderSelectionParity(root, detail = {}) {
  const ids = providerIds(root);
  const providerSet = new Set(ids.map(normalize));
  const duplicates = duplicateIds(ids);
  const selectedNodeId = selectedTreeNodeId(root, detail);
  const selected = selectedAliases(root, detail);
  const render = renderAliasSet();
  const providerNodeMatched = !selectedNodeId || providerSet.has(normalize(selectedNodeId));
  const selectedMissingInProvider = selected.filter((id) => id && !providerSet.has(normalize(id)));
  const selectedMissingInRender = selected.filter((id) => id && !render.aliases.has(normalize(id)));
  const matchedRenderCount = selected.length - selectedMissingInRender.length;
  const mismatchCount = (providerNodeMatched ? 0 : 1) + selectedMissingInProvider.length + selectedMissingInRender.length + duplicates.length;
  return {
    version: RVM_HIERARCHY_PROVIDER_SELECTION_PARITY_VERSION,
    readPath: runtimeTelemetry(root)?.readPath || root?.dataset?.rvmHierarchyReadPath || 'unknown',
    selectedNodeId,
    selectedCanonicalIds: selected,
    selectedCount: selected.length,
    providerNodeCount: ids.length,
    providerDuplicateCount: duplicates.length,
    providerDuplicateIds: duplicates.slice(0, 25),
    providerNodeMatched,
    matchedRenderCount,
    renderObjectScanCount: render.scanned,
    selectedMissingInProvider: selectedMissingInProvider.slice(0, 25),
    selectedMissingInRender: selectedMissingInRender.slice(0, 25),
    mismatchCount,
  };
}

function stamp(root, parity) {
  if (!root?.dataset || !parity) return;
  root.__rvmHierarchyProviderSelectionParity = parity;
  root.dataset.rvmHierarchyProviderSelectionParity = parity.version;
  root.dataset.rvmHierarchyProviderSelectionMismatchCount = String(parity.mismatchCount || 0);
  root.dataset.rvmHierarchyProviderSelectionSelectedCount = String(parity.selectedCount || 0);
  root.dataset.rvmHierarchyProviderSelectionRenderMatches = String(parity.matchedRenderCount || 0);
  root.dataset.rvmHierarchyProviderSelectionProviderDuplicates = String(parity.providerDuplicateCount || 0);
  root.dataset.rvmHierarchyProviderSelectionReadPath = parity.readPath || 'unknown';
}

function render(root, parity) {
  const panel = ensurePanel(root);
  if (!panel || !parity) return;
  const rows = [
    ['Selection read path', parity.readPath],
    ['Selected node', parity.selectedNodeId || '-'],
    ['Selected aliases', String(parity.selectedCount)],
    ['Provider nodes', String(parity.providerNodeCount)],
    ['Provider duplicate IDs', String(parity.providerDuplicateCount)],
    ['Render matches', String(parity.matchedRenderCount)],
    ['Render objects scanned', String(parity.renderObjectScanCount)],
    ['Selection mismatches', String(parity.mismatchCount)],
  ];
  panel.innerHTML = `<div class="rvm-panel-header">Provider Selection Parity</div><div class="rvm-browser-diag-grid">${rows.map(([label, value]) => row(label, value)).join('')}</div>`;
}

function refresh(root, detail = {}) {
  if (!root?.querySelector) return null;
  const parity = computeHierarchyProviderSelectionParity(root, detail);
  stamp(root, parity);
  render(root, parity);
  try { root.dispatchEvent(new CustomEvent('rvm-hierarchy-provider-selection-parity', { bubbles: true, detail: parity })); } catch (_) {}
  return parity;
}

export function installRvmHierarchyProviderSelectionParityBridge() {
  if (globalThis[INSTALL_FLAG]) return;
  globalThis[INSTALL_FLAG] = true;
  globalThis.__PCF_GLB_RVM_HIERARCHY_PROVIDER_SELECTION_PARITY__ = { version: RVM_HIERARCHY_PROVIDER_SELECTION_PARITY_VERSION, compute: computeHierarchyProviderSelectionParity };
  const update = (event) => { const root = event.target?.closest?.(ROOT_SELECTOR) || document.querySelector(ROOT_SELECTOR); if (root) refresh(root, event.detail || {}); };
  document.addEventListener('rvm-tree-rendered', update, true);
  document.addEventListener('rvm-selection-synced-to-tree', update, true);
  document.addEventListener('rvm-hierarchy-selection', update, true);
  document.addEventListener('rvm-canvas-selection', update, true);
  document.addEventListener('rvm-provider-tree-read-path-toggle', update, true);
}
