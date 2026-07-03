const BRIDGE_VERSION = '20260630-rvm-canvas-multiselect-tree-sync-1';
const PREVIOUS_VERSION = '20260627-rvm-hierarchy-selection-sync-dispose-1';
const TREE_SYNC_INTERVAL_MS = 140;

export function installRvmSelectionTreeSyncBridge() {
  injectStyles();
  let attempts = 0;
  const attach = () => {
    attempts += 1;
    const root = document.querySelector('[data-rvm-viewer]');
    const viewer = globalThis.__3D_RVM_VIEWER__;
    if (root && viewer) bind(root, viewer);
    if ((!root || !viewer) && attempts < 180) setTimeout(attach, 350);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', attach, { once: true });
  else attach();
}

function bind(root, viewer) {
  if (!root || root.dataset.rvmSelectionTreeSync === BRIDGE_VERSION) return;
  root.dataset.rvmSelectionTreeSync = BRIDGE_VERSION;
  root.dataset.rvmSelectionTreeSyncPrevious = PREVIOUS_VERSION;
  let lastKey = '';
  let disposed = false;
  const tick = (reason = 'interval') => {
    if (disposed) return;
    const key = selectionKey(viewer);
    if (key !== lastKey || reason !== 'interval') {
      lastKey = key;
      syncTreeToSelection(root, viewer, reason);
    }
  };
  const timer = setInterval(() => tick('interval'), TREE_SYNC_INTERVAL_MS);
  const onHierarchySelection = () => tick('hierarchy-selection');
  const onCanvasSelection = () => tick('canvas-selection');
  const cleanup = () => {
    if (disposed) return;
    disposed = true;
    clearInterval(timer);
    root.removeEventListener('rvm-hierarchy-selection', onHierarchySelection);
    root.removeEventListener('rvm-canvas-selection', onCanvasSelection);
    root.removeEventListener('rvm-tab-dispose', cleanup);
    if (root._rvmSelectionTreeSyncCleanup === cleanup) root._rvmSelectionTreeSyncCleanup = null;
  };
  root.addEventListener('rvm-hierarchy-selection', onHierarchySelection);
  root.addEventListener('rvm-canvas-selection', onCanvasSelection);
  root.addEventListener('rvm-tab-dispose', cleanup, { once: true });
  root._rvmSelectionTreeSyncCleanup = cleanup;
  tick('bind');
}

function selectionKey(viewer) {
  const meshes = Array.isArray(viewer?._rvmCanvasSelectedMeshes) ? viewer._rvmCanvasSelectedMeshes.filter(Boolean) : [];
  if (meshes.length) return meshes.map((mesh) => stableObjectId(mesh) || mesh.uuid).sort().join('|');
  const ids = [...(viewer?.selection?.getSelectionRenderIds?.() || []), ...(viewer?.selection?.getSelectedCanonicalIds?.() || [])];
  return ids.map(String).sort().join('|');
}

function syncTreeToSelection(root, viewer, reason = 'sync') {
  const tree = root.querySelector('#rvm-tree');
  if (!tree) return;
  tree.querySelectorAll('li.is-selected, li.is-canvas-selected').forEach((row) => row.classList.remove('is-selected', 'is-canvas-selected'));
  const groups = selectedAliasGroups(viewer).map((group) => group.map(normalize).filter(Boolean)).filter((group) => group.length);
  if (!groups.length) return;
  const rows = Array.from(tree.querySelectorAll('li[data-node-id]'));
  const selectedRows = [];
  const seen = new Set();
  for (const aliases of groups) {
    const ranked = rows.map((row) => ({ row, score: rowMatchScore(row, aliases) })).filter((entry) => entry.score > 0).sort((a, b) => b.score - a.score);
    const match = ranked[0]?.row || null;
    if (!match) continue;
    const key = match.dataset.nodeId || labelForRow(match) || String(selectedRows.length);
    if (seen.has(key)) continue;
    seen.add(key);
    selectedRows.push(match);
  }
  for (const row of selectedRows) row.classList.add('is-selected', 'is-canvas-selected');
  selectedRows[0]?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  if (root.dataset) {
    root.dataset.rvmSelectionTreeSyncLastReason = reason;
    root.dataset.rvmSelectionTreeSyncLastNode = selectedRows[0]?.dataset.nodeId || '';
    root.dataset.rvmSelectionTreeSyncLastCount = String(selectedRows.length);
  }
  try { root.dispatchEvent(new CustomEvent('rvm-selection-synced-to-tree', { bubbles: true, detail: { reason, nodeIds: selectedRows.map((row) => row.dataset.nodeId || ''), count: selectedRows.length, version: BRIDGE_VERSION } })); } catch (_) {}
}

function selectedAliasGroups(viewer) {
  const meshes = Array.isArray(viewer?._rvmCanvasSelectedMeshes) ? viewer._rvmCanvasSelectedMeshes.filter(Boolean) : [];
  if (meshes.length) {
    const byOwner = new Map();
    for (const mesh of meshes) {
      const key = normalize(ownerKey(mesh) || stableObjectId(mesh) || mesh.uuid);
      if (!byOwner.has(key)) byOwner.set(key, []);
      byOwner.get(key).push(...aliasesForObject(mesh));
    }
    return [...byOwner.values()].map(unique);
  }
  const ids = [...(viewer?.selection?.getSelectionRenderIds?.() || []), ...(viewer?.selection?.getSelectedCanonicalIds?.() || [])];
  return ids.map((id) => [id]);
}

function aliasesForObject(obj) {
  const data = obj?.userData || {};
  const props = data.browserRvmProperties || {};
  const attrs = data.browserRvmAttributes || data.attributes || props.attributes || {};
  return [
    obj?.name, obj?.uuid, data.name, data.sourcePath, data.sourceName, data.displayName, stableObjectId(obj),
    data.canonicalId, data.canonicalObjectId, data.renderObjectId, data.leafRenderObjectId,
    props.sourcePath, props.displayName, props.name, props.canonicalId,
    attrs.NAME, attrs.TAG, attrs.RVM_OWNER_NAME, attrs.RVM_OWNER_PATH, attrs.RVM_NATIVE_CONTAINER_PARENT, attrs.RVM_CANONICAL_PATH, attrs.CANONICAL_ID,
    attrs.TYPE, attrs.RVM_PRIMITIVE_KIND, attrs.RVM_PRIMITIVE_CODE ? `RVM_PRIM_CODE_${attrs.RVM_PRIMITIVE_CODE}` : ''
  ].filter(Boolean);
}

function rowMatchScore(row, aliases) {
  const rowId = normalize(row.dataset.nodeId || '');
  const label = normalize(labelForRow(row));
  const path = normalize(row.dataset.rvmTreePath || row.getAttribute('data-rvm-tree-path') || '');
  const last = normalize(lastSegment(rowId || label));
  if (!rowId && !label && !path) return 0;
  let score = 0;
  for (const alias of aliases) {
    if (!alias || alias.length < 2) continue;
    const aliasLast = normalize(lastSegment(alias));
    if (rowId && alias === rowId) score = Math.max(score, 120);
    if (path && alias === path) score = Math.max(score, 116);
    if (label && alias === label) score = Math.max(score, 110);
    if (label && aliasLast && label === aliasLast) score = Math.max(score, 106);
    if (path && aliasLast && path.endsWith(`/${aliasLast}`)) score = Math.max(score, 100);
    if (rowId && aliasLast && rowId.endsWith(`/${aliasLast}`)) score = Math.max(score, 98);
    if (rowId && alias.endsWith(`/${rowId}`)) score = Math.max(score, 88);
    if (rowId && alias.includes(`/${rowId}/`)) score = Math.max(score, 82);
    if (last && last.length >= 4 && alias.includes(last)) score = Math.max(score, 70);
    if (rowId && rowId.length >= 4 && alias.includes(rowId)) score = Math.max(score, 60);
    if (label && label.length >= 4 && alias.includes(label)) score = Math.max(score, 55);
    if (rowId && alias.length >= 4 && rowId.includes(alias)) score = Math.max(score, 40);
  }
  return score;
}

function labelForRow(row) {
  const navis = row?.querySelector?.(':scope > .rvm-navis-row .rvm-navis-label');
  if (navis?.textContent) return cleanLabel(navis.textContent);
  const direct = row?.querySelector?.(':scope > .rvm-tree-node [data-rvm-tree-label], :scope > .rvm-tree-node .rvm-tree-label');
  if (direct?.textContent) return cleanLabel(direct.textContent);
  const node = row?.querySelector?.(':scope > .rvm-tree-node');
  if (!node) return row?.dataset?.nodeId || '';
  const clone = node.cloneNode?.(true);
  clone?.querySelectorAll?.('.rvm-kind,.rvm-tree-count,[data-rvm-row-toggle],[data-rvm-visibility-toggle],button,select,input').forEach((el) => el.remove?.());
  return cleanLabel(clone?.textContent || node.textContent || row?.dataset?.nodeId || '');
}

function ownerKey(obj) {
  const data = obj?.userData || {};
  const props = data.browserRvmProperties || {};
  const attrs = data.browserRvmAttributes || data.attributes || props.attributes || {};
  return attrs.RVM_NATIVE_CONTAINER_PARENT || attrs.RVM_OWNER_PATH || attrs.RVM_OWNER_NAME || data.sourcePath || props.sourcePath || '';
}

function stableObjectId(obj) {
  const data = obj?.userData || {};
  const props = data.browserRvmProperties || {};
  const attrs = data.browserRvmAttributes || data.attributes || props.attributes || {};
  return String(data.sourcePath || props.sourcePath || data.displayName || props.displayName || data.sourceName || attrs.RVM_NATIVE_CONTAINER_PARENT || attrs.RVM_OWNER_PATH || attrs.RVM_OWNER_NAME || attrs.RVM_CANONICAL_PATH || attrs.NAME || data.name || obj?.name || obj?.uuid || '').trim();
}

function normalize(value) { return String(value || '').replace(/\\/g, '/').replace(/\s*>\s*/g, '/').replace(/\s+/g, ' ').trim().toLowerCase(); }
function cleanLabel(value) { return String(value || '').replace(/\b(On|Off)\b/g, ' ').replace(/\s+/g, ' ').trim(); }
function lastSegment(value) { const parts = String(value || '').replace(/\\/g, '/').split('/').map((part) => part.trim()).filter(Boolean); return parts[parts.length - 1] || String(value || ''); }
function unique(values) { return Array.from(new Set((values || []).filter(Boolean))); }
function injectStyles() {
  let style = document.getElementById('rvm-selection-tree-sync-style');
  if (!style) {
    style = document.createElement('style');
    style.id = 'rvm-selection-tree-sync-style';
    document.head.appendChild(style);
  }
  style.dataset.rvmSelectionTreeSync = BRIDGE_VERSION;
  style.textContent = `[data-rvm-viewer] #rvm-tree li.is-canvas-selected > .rvm-tree-node,[data-rvm-viewer] #rvm-tree li.is-canvas-selected > .rvm-navis-row .rvm-navis-select{border-color:rgba(52,211,153,.95)!important;box-shadow:inset 3px 0 0 rgba(52,211,153,.95),0 0 0 1px rgba(52,211,153,.18)!important;background:rgba(16,185,129,.16)!important;}[data-rvm-viewer] #rvm-tree li.is-canvas-selected > .rvm-tree-node .rvm-tree-label,[data-rvm-viewer] #rvm-tree li.is-canvas-selected > .rvm-tree-node [data-rvm-tree-label],[data-rvm-viewer] #rvm-tree li.is-canvas-selected > .rvm-navis-row .rvm-navis-label{color:#d1fae5!important;}`;
}
