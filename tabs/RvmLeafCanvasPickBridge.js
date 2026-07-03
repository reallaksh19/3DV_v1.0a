import * as THREE from 'three';
import { emit } from '../core/event-bus.js';
import { RuntimeEvents } from '../contracts/runtime-events.js';

const INSTALL_FLAG = Symbol.for('pcf-glb-rvm-leaf-canvas-pick-v2-navigation-safe');
const VERSION = '20260630-rvm-leaf-canvas-multiselect-tree-sync-1';
const CLICK_TOLERANCE = 5;
const SELECTED_COLOR = 0x60a5fa;
const SELECTED_EMISSIVE = 0x2563eb;
const MAX_NATIVE_OWNER_GROUP_OBJECTS = 500;
const GROUP_SELECTABLE_TYPES = new Set(['SUPPORT', 'FLANGE', 'GASK', 'VALVE', 'ELBOW', 'BEND', 'TEE', 'OLET', 'REDUCER', 'NOZZLE', 'CAP', 'STRAINER', 'INSTRUMENT']);

export function installRvmLeafCanvasPickBridge() {
  if (typeof document === 'undefined') return null;
  if (globalThis[INSTALL_FLAG]) return globalThis[INSTALL_FLAG];
  const state = { version: VERSION, runs: 0, bind: bindActiveViewer };
  globalThis[INSTALL_FLAG] = state;
  const attempt = () => {
    state.runs += 1;
    bindActiveViewer(state);
    if (!globalThis.__3D_RVM_VIEWER__ && state.runs < 180) setTimeout(attempt, 300);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', attempt, { once: true });
  else attempt();
  try { globalThis.addEventListener?.('rvm-model-loaded', () => setTimeout(() => bindActiveViewer(state), 0)); } catch (_) {}
  return state;
}

function bindActiveViewer(state = globalThis[INSTALL_FLAG]) {
  const viewer = globalThis.__3D_RVM_VIEWER__;
  const root = document.querySelector('[data-rvm-viewer]');
  const canvas = viewer?.renderer?.domElement;
  if (!viewer || !canvas || canvas.dataset.rvmLeafCanvasPickBridge === VERSION) return viewer || null;
  canvas.dataset.rvmLeafCanvasPickBridge = VERSION;
  viewer._rvmLeafCanvasPickVersion = VERSION;
  patchSelectionAdapter(viewer.selection);
  repairPointerStack(viewer, 'leaf-bind');
  let down = null;

  canvas.addEventListener('pointerdown', (event) => {
    repairPointerStack(viewer, 'leaf-pointerdown');
    if (event.button !== 0) return;
    if (isSelectMode(viewer, root)) {
      down = { x: event.clientX, y: event.clientY, time: now(), additive: isAdditiveEvent(event) };
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
    } else {
      down = null;
    }
  }, true);

  canvas.addEventListener('pointerup', (event) => {
    repairPointerStack(viewer, 'leaf-pointerup');
    if (event.button !== 0) return;
    if (!isSelectMode(viewer, root)) {
      down = null;
      return;
    }
    if (!down) return;
    const moved = Math.hypot(event.clientX - down.x, event.clientY - down.y);
    const additive = down.additive || isAdditiveEvent(event);
    down = null;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
    if (moved > CLICK_TOLERANCE) return;
    const hit = pickLeafObject(viewer, event.clientX, event.clientY);
    if (!hit) {
      if (!additive) clearLeafSelection(viewer, root);
      return;
    }
    selectLeafObject(viewer, root, hit.object, hit.point, { additive });
  }, true);

  canvas.addEventListener('pointercancel', () => { down = null; }, true);
  canvas.addEventListener('lostpointercapture', () => { down = null; }, true);
  return viewer;
}

function patchSelectionAdapter(selection) {
  if (!selection || selection.__rvmLeafCanvasPickVersion === VERSION) return;
  selection.__rvmLeafCanvasPickVersion = VERSION;
  selection.selectRenderObjectIds = function selectRenderObjectIds(renderIds = [], canonicalIds = renderIds, options = {}) {
    const rids = unique(renderIds.map(String).filter(Boolean));
    const cids = unique(canonicalIds.map(String).filter(Boolean));
    if (!options.additive) this.clearSelection?.();
    this._selectedRenderIds = options.additive ? unique([...(this._selectedRenderIds || []), ...rids]) : rids;
    this._selectedCanonicalIds = options.additive ? unique([...(this._selectedCanonicalIds || []), ...cids]) : cids;
    this._selectedCanonicalId = this._selectedCanonicalIds[0] || null;
    this._restoreMaterials?.();
    this._highlight?.(this._selectedRenderIds, 0x2244cc);
    this._emitSelection?.();
  };
  selection.selectByRenderObjectId = function selectByRenderObjectId(renderId, canonicalId = renderId, options = {}) {
    this.selectRenderObjectIds?.([renderId].filter(Boolean), [canonicalId || renderId].filter(Boolean), options);
  };
}

function pickLeafObject(viewer, clientX, clientY) {
  if (!viewer?.camera || !viewer?.modelGroup || !viewer?.renderer?.domElement) return null;
  const rect = viewer.renderer.domElement.getBoundingClientRect();
  if (!rect.width || !rect.height) return null;
  const mouse = new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
  const raycaster = viewer._rvmLeafCanvasRaycaster || (viewer._rvmLeafCanvasRaycaster = new THREE.Raycaster());
  raycaster.params.Line = { threshold: 2 };
  raycaster.params.Points = { threshold: 2 };
  raycaster.setFromCamera(mouse, viewer.camera);
  const hits = raycaster.intersectObject(viewer.modelGroup, true);
  return hits.find((hit) => isSelectableLeaf(hit.object)) || null;
}

function selectLeafObject(viewer, root, object, point, options = {}) {
  if (!object) return false;
  const selectionObjects = nativeOwnerGroupObjects(viewer, object);
  if (options.additive && selectionIncludesObjects(viewer, selectionObjects)) {
    removeSelectionObjects(viewer, root, selectionObjects, { point, pickedObject: object, additive: true });
    return true;
  }
  if (!options.additive) clearLeafSelection(viewer, root, { keepPanel: true, silent: true });
  for (const item of selectionObjects) applySelectedMaterial(item);
  viewer._rvmActiveHierarchySelection = null;
  viewer._rvmHierarchySelectedMeshes = [];
  viewer._rvmCanvasSelectedMeshes = unique([...(viewer._rvmCanvasSelectedMeshes || []), ...selectionObjects]);
  syncSelectionAdapter(viewer, viewer._rvmCanvasSelectedMeshes);
  dispatchCanvasSelection(root, viewer, object, point, { additive: options.additive, pickedObjects: selectionObjects });
  renderDetails(root, object, point, viewer._rvmCanvasSelectedMeshes, selectionObjects);
  updateSelectedCount(root, viewer._rvmCanvasSelectedMeshes.length);
  requestRender(viewer);
  return true;
}

function removeSelectionObjects(viewer, root, objects = [], options = {}) {
  const removeSet = new Set(objects.filter(Boolean));
  for (const item of removeSet) restoreMaterial(item);
  viewer._rvmCanvasSelectedMeshes = (viewer._rvmCanvasSelectedMeshes || []).filter((item) => item && !removeSet.has(item));
  viewer._rvmHierarchySelectedMeshes = [];
  viewer._rvmActiveHierarchySelection = null;
  syncSelectionAdapter(viewer, viewer._rvmCanvasSelectedMeshes);
  dispatchCanvasSelection(root, viewer, options.pickedObject || null, options.point || null, { additive: true, removedObjects: [...removeSet] });
  if (viewer._rvmCanvasSelectedMeshes.length) renderDetails(root, viewer._rvmCanvasSelectedMeshes[0], options.point || null, viewer._rvmCanvasSelectedMeshes, []);
  else renderEmptySelection(root);
  updateSelectedCount(root, viewer._rvmCanvasSelectedMeshes.length);
  requestRender(viewer);
}

function clearLeafSelection(viewer, root = null, options = {}) {
  const selected = Array.isArray(viewer?._rvmCanvasSelectedMeshes) ? viewer._rvmCanvasSelectedMeshes : [];
  for (const object of selected) restoreMaterial(object);
  viewer._rvmCanvasSelectedMeshes = [];
  viewer._rvmHierarchySelectedMeshes = [];
  viewer._rvmActiveHierarchySelection = null;
  try { viewer?.selection?.clearSelection?.(); } catch (_) {}
  if (root) {
    updateSelectedCount(root, 0);
    clearCanvasTreeHighlight(root);
    if (!options.silent) dispatchCanvasSelection(root, viewer, null, null, { cleared: true });
  }
  if (!options.keepPanel) renderEmptySelection(root);
  requestRender(viewer);
}

function renderEmptySelection(root) {
  const panel = root?.querySelector?.('#rvm-attributes-panel');
  if (panel) panel.innerHTML = '<div class="rvm-empty-state">No object selected.</div>';
}

function renderDetails(root, object, point, selectedObjects = [object], pickedObjects = [object]) {
  const panel = root?.querySelector?.('#rvm-attributes-panel');
  if (!panel) return;
  const data = object?.userData || {};
  const props = data.browserRvmProperties || {};
  const attrs = data.browserRvmAttributes || props.attributes || data.attributes || {};
  const box = safeBoxForObjects(selectedObjects);
  const size = box ? box.getSize(new THREE.Vector3()) : null;
  const owner = nativeOwnerName(object);
  const rows = [
    ['Picked', pickedObjects.length > 1 && owner ? owner : (props.displayName || data.displayName || object?.name || object?.uuid || '-')],
    ['Source path', attrs.RVM_OWNER_PATH || props.sourcePath || data.sourcePath || '-'],
    ['Type', pickedObjects.length > 1 ? 'Group' : (props.type || data.type || attrs.TYPE || '-')],
    ['Kind', props.kind || data.kind || attrs.RVM_PRIMITIVE_KIND || '-'],
    ['Render primitive', props.effectiveRenderPrimitive || data.effectiveRenderPrimitive || data.renderKind || data.renderPrimitive || '-'],
    ['Picked meshes', pickedObjects.length],
    ['Total selected meshes', selectedObjects.length],
    ['Selection mode', selectedObjects.length > pickedObjects.length ? 'Canvas multi-select' : (pickedObjects.length > 1 ? 'Native RVM owner group' : 'Leaf object')],
    ['Size', size ? `${fmt(size.x)} × ${fmt(size.y)} × ${fmt(size.z)}` : '-'],
    ['Pick point', point ? `${fmt(point.x)}, ${fmt(point.y)}, ${fmt(point.z)}` : '-'],
  ];
  const groupAttrs = pickedObjects.length > 1 && owner ? { ...attrs, NAME: owner, TYPE: 'Group', RVM_GROUP_OBJECT_COUNT: String(pickedObjects.length), RVM_CANVAS_MULTI_SELECTED_COUNT: String(selectedObjects.length) } : attrs;
  const attrRows = Object.entries(groupAttrs || {}).slice(0, 28).map(([key, value]) => [key, value]);
  panel.innerHTML = `
    <div class="rvm-canvas-selection-card">
      <div class="rvm-tree-selection-title">Canvas selection</div>
      <div class="rvm-browser-diag-grid">${rows.map(([key, value]) => row(key, value)).join('')}</div>
      <div class="rvm-tree-selection-title">Attributes</div>
      <div class="rvm-browser-diag-grid">${attrRows.length ? attrRows.map(([key, value]) => row(key, value)).join('') : row('Attributes', 'No attributes on picked mesh')}</div>
    </div>`;
}

function isSelectableLeaf(obj) {
  if (!(obj?.isMesh || obj?.isLine || obj?.isLineSegments || obj?.isPoints)) return false;
  const data = obj.userData || {};
  return obj.visible !== false && data.supportSymbol !== true && data.rvmHiddenByUser !== true && data.rvmInteractionIgnore !== true && data.pickable !== false && data.selectable !== false && !data.nonSelectableReason;
}

function applySelectedMaterial(object) {
  if (!object?.material || object.userData?.rvmCanvasSelectionHighlighted) return;
  const materials = Array.isArray(object.material) ? object.material : [object.material];
  object.userData.rvmCanvasSelectionOriginalMaterial = object.material;
  const cloned = materials.map((mat) => {
    const copy = mat?.clone ? mat.clone() : mat;
    if (copy?.emissive) copy.emissive.setHex(SELECTED_EMISSIVE);
    if (copy?.color) copy.color.lerp(new THREE.Color(SELECTED_COLOR), 0.45);
    if (copy) copy.needsUpdate = true;
    return copy;
  });
  object.material = Array.isArray(object.material) ? cloned : cloned[0];
  object.userData.rvmCanvasSelectionHighlighted = true;
}

function restoreMaterial(object) {
  if (!object?.userData?.rvmCanvasSelectionHighlighted) return;
  const current = Array.isArray(object.material) ? object.material : [object.material];
  const original = object.userData.rvmCanvasSelectionOriginalMaterial;
  object.material = original || object.material;
  for (const mat of current) {
    const originalList = Array.isArray(original) ? original : [original];
    if (originalList.includes(mat)) continue;
    mat?.dispose?.();
  }
  delete object.userData.rvmCanvasSelectionHighlighted;
  delete object.userData.rvmCanvasSelectionOriginalMaterial;
}

function syncSelectionAdapter(viewer, objects = []) {
  const renderIds = objects.map(renderIdFor).filter(Boolean);
  const canonicalIds = objects.map((item, index) => canonicalIdFor(viewer, item, renderIds[index])).filter(Boolean);
  try {
    if (viewer?.selection?.selectRenderObjectIds) viewer.selection.selectRenderObjectIds(renderIds, canonicalIds, { additive: false });
    else if (viewer?.selection) {
      viewer.selection.clearSelection?.();
      viewer.selection._selectedRenderIds = renderIds;
      viewer.selection._selectedCanonicalIds = canonicalIds;
      viewer.selection._selectedCanonicalId = canonicalIds[0] || null;
      viewer.selection._emitSelection?.();
    }
  } catch (_) {}
}

function dispatchCanvasSelection(root, viewer, object, point, detail = {}) {
  if (!root) return;
  const objects = Array.isArray(viewer?._rvmCanvasSelectedMeshes) ? viewer._rvmCanvasSelectedMeshes.filter(Boolean) : [];
  const renderObjectIds = objects.map(renderIdFor).filter(Boolean);
  const canonicalIds = objects.map((item, index) => canonicalIdFor(viewer, item, renderObjectIds[index])).filter(Boolean);
  const eventDetail = { version: VERSION, source: 'canvas', object, point, objects, matches: objects, renderObjectIds, canonicalIds, selectedCount: objects.length, ...detail };
  try { root.dispatchEvent(new CustomEvent('rvm-canvas-selection', { bubbles: true, detail: eventDetail })); } catch (_) {}
  emit(RuntimeEvents.RVM_NODE_SELECTED, { canonicalId: canonicalIds[0] || null, canonicalIds, renderObjectIds, leafObjectOnly: objects.length === 1, nativeOwnerGroupPick: Boolean(detail.pickedObjects?.length > 1), objects });
}

function clearCanvasTreeHighlight(root) {
  root?.querySelectorAll?.('#rvm-tree li.is-selected, #rvm-tree li.is-canvas-selected').forEach((row) => row.classList.remove('is-selected', 'is-canvas-selected'));
}

function selectionIncludesObjects(viewer, objects = []) {
  const selected = new Set((viewer?._rvmCanvasSelectedMeshes || []).filter(Boolean));
  return objects.length > 0 && objects.every((item) => selected.has(item));
}

function renderIdFor(object) {
  const data = object?.userData || {};
  return String(data.renderObjectId || data.leafRenderObjectId || object?.uuid || data.name || object?.name || '').trim();
}

function canonicalIdFor(viewer, object, renderId) {
  const data = object?.userData || {};
  return viewer?.selection?.identityMap?.canonicalFromRender?.(renderId) || data.canonicalId || data.sourcePath || data.browserRvmProperties?.sourcePath || renderId;
}

function attrsFor(object) {
  const data = object?.userData || {};
  const props = data.browserRvmProperties || {};
  return data.browserRvmAttributes || props.attributes || data.attributes || {};
}

function nativeOwnerKey(object) {
  const attrs = attrsFor(object);
  return String(attrs.RVM_NATIVE_CONTAINER_PARENT || attrs.RVM_OWNER_PATH || '').trim();
}

function nativeOwnerName(object) {
  const attrs = attrsFor(object);
  return String(attrs.RVM_OWNER_NAME || attrs.RVM_REVIEW_NAME || '').trim();
}

function isComponentOwnerSelectable(object) {
  const attrs = attrsFor(object);
  const type = String(attrs.TYPE || object?.userData?.type || '').toUpperCase();
  const owner = nativeOwnerName(object).toUpperCase();
  if (GROUP_SELECTABLE_TYPES.has(type)) return true;
  if (/^\/(PS|SL)-/.test(owner)) return true;
  return /\b(FLANGE|GASK|VALVE|ELBOW|BEND|TEE|OLET|REDUCER|NOZZLE|CAP|STRAINER|SUPPORT|INSTRUMENT)\b/.test(owner);
}

function nativeOwnerGroupObjects(viewer, object) {
  if (!isComponentOwnerSelectable(object)) return [object];
  const key = nativeOwnerKey(object);
  if (!viewer?.modelGroup || !key) return [object];
  const out = [];
  viewer.modelGroup.traverse?.((item) => {
    if (out.length >= MAX_NATIVE_OWNER_GROUP_OBJECTS) return;
    if (!(item?.isMesh || item?.isLine || item?.isLineSegments || item?.isPoints) || item.visible === false) return;
    if (nativeOwnerKey(item) === key) out.push(item);
  });
  return out.length > 1 ? out : [object];
}

function isSelectMode(viewer, root) {
  const activeAction = String(root?.querySelector?.('[data-action].is-active')?.dataset?.action || '').toUpperCase();
  if (activeAction === 'NAV_SELECT') return true;
  const mode = String(viewer?.__rvmInteractionCurrentMode || viewer?._rvmInteractionMode || viewer?._navMode || 'select').trim().toLowerCase();
  return !mode || mode === 'select' || mode === 'nav_select' || mode === 'selection';
}

function isAdditiveEvent(event) { return Boolean(event?.ctrlKey || event?.shiftKey || event?.metaKey); }
function repairPointerStack(viewer, reason) { try { globalThis.__PCF_GLB_RVM_NAVIGATION_ARBITER__?.repair?.(viewer, reason); } catch (_) {} }
function requestRender(viewer) { try { viewer?.requestRender?.(); } catch (_) {} }

function safeBox(object) { try { const box = new THREE.Box3().setFromObject(object); return box && !box.isEmpty() ? box : null; } catch (_) { return null; } }
function safeBoxForObjects(objects = []) { const box = new THREE.Box3(); let any = false; for (const object of objects) { const item = safeBox(object); if (item && !item.isEmpty()) { box.union(item); any = true; } } return any ? box : null; }
function updateSelectedCount(root, count) { const chip = root?.querySelector?.('[data-rvm-status-chip="selected"]'); const footer = root?.querySelector?.('#rvm-sel-count'); if (chip) chip.textContent = `Selected: ${count || 0}`; if (footer) footer.textContent = String(count || 0); }
function row(key, value) { return `<div class="rvm-browser-diag-row"><span>${escapeHtml(key)}</span><b>${escapeHtml(value === undefined || value === null || value === '' ? '-' : String(value))}</b></div>`; }
function escapeHtml(value) { return String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch])); }
function fmt(value) { const n = Number(value); return Number.isFinite(n) ? n.toFixed(3) : '-'; }
function unique(values) { return Array.from(new Set((values || []).filter(Boolean))); }
function now() { return (typeof performance !== 'undefined' && typeof performance.now === 'function') ? performance.now() : Date.now(); }
