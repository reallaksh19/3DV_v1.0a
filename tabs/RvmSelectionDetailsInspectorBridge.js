import * as THREE from 'three';

import { RuntimeEvents } from '../contracts/runtime-events.js';
import { on } from '../core/event-bus.js';

const INSTALL_FLAG = Symbol.for('pcf-glb-rvm-selection-details-inspector-v3-restore');
const BRIDGE_VERSION = '20260629-rvm-selected-entity-restore-1';
const PREVIOUS_VERSION = '20260629-rvm-selection-details-syntax-fix-1';
const MAX_SELECTED_OBJECTS = 1500;
const MAX_ALIAS_SCAN_OBJECTS = 20000;
const MAX_ATTRIBUTE_ROWS = 42;
const GROUP_SELECTABLE_TYPES = new Set(['SUPPORT', 'FLANGE', 'GASK', 'VALVE', 'ELBOW', 'BEND', 'TEE', 'OLET', 'REDUCER', 'NOZZLE', 'CAP', 'STRAINER', 'INSTRUMENT']);

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[ch]));
}

function rootEl() { return typeof document === 'undefined' ? null : document.querySelector('[data-rvm-viewer]'); }
function viewer() { return globalThis.__3D_RVM_VIEWER__ || null; }
function attrsFor(obj) { const data = obj?.userData || {}; const props = data.browserRvmProperties || {}; return data.browserRvmAttributes || data.attributes || props.attributes || data.rawAttributes || {}; }
function propsFor(obj) { return obj?.userData?.browserRvmProperties || {}; }
function renderIdFor(obj) { return String(obj?.userData?.name || obj?.name || obj?.uuid || '').trim(); }
function normalizePath(value) { return String(value || '').split('\\').join('/'); }
function sourcePathFor(obj) { const data = obj?.userData || {}; const props = propsFor(obj); const attrs = attrsFor(obj); return normalizePath(attrs.RVM_OWNER_PATH || data.sourcePath || props.sourcePath || attrs.RVM_OWNER_NAME || data.displayName || obj?.name || '-'); }
function typeFor(obj) { const data = obj?.userData || {}; const attrs = attrsFor(obj); return data.type || data.kind || attrs.TYPE || attrs.RVM_TYPE || '-'; }
function primitiveFor(obj) { const data = obj?.userData || {}; const attrs = attrsFor(obj); return data.effectiveRenderPrimitive || data.renderPrimitive || attrs.RVM_BROWSER_RENDER_PRIMITIVE || attrs.RVM_PRIMITIVE_KIND || '-'; }
function fmt(value, digits = 3) { const n = Number(value); return Number.isFinite(n) ? n.toFixed(digits) : '-'; }
function fmtVec(vec) { return vec ? `${fmt(vec.x)} , ${fmt(vec.y)} , ${fmt(vec.z)}` : '-'; }

function status(root, message, warning = false) {
  const el = root?.querySelector?.('#rvm-sb-msg');
  if (!el) return;
  el.textContent = message;
  el.style.color = warning ? '#ffcf70' : '';
}

function commonPrefix(values = []) {
  const clean = values.map((value) => String(value || '').replace(/\\/g, '/').split('/').filter(Boolean)).filter((parts) => parts.length);
  if (!clean.length) return '';
  const out = [];
  for (let i = 0; i < clean[0].length; i += 1) {
    const part = clean[0][i];
    if (clean.every((parts) => parts[i] === part)) out.push(part);
    else break;
  }
  return out.length ? `/${out.join('/')}` : '';
}

function aliasesFor(obj) {
  const data = obj?.userData || {};
  const props = propsFor(obj);
  const attrs = attrsFor(obj);
  return [renderIdFor(obj), obj?.uuid, obj?.name, data.canonicalObjectId, data.sourceObjectId, data.sourcePath, data.sourceName, data.displayName, props.sourcePath, props.displayName, props.sourceName, attrs.RVM_OWNER_PATH, attrs.RVM_OWNER_NAME, attrs.RVM_REVIEW_NAME, attrs.RVM_CANONICAL_PATH, attrs.NAME, attrs.RVM_BYTE_OFFSET]
    .map((value) => String(value ?? '').trim()).filter(Boolean);
}

function selectedIdsFromPayload(payload = {}) {
  const selected = new Set();
  for (const value of [payload.canonicalId, payload.renderObjectId, ...(payload.canonicalIds || []), ...(payload.renderObjectIds || [])]) if (value) selected.add(String(value));
  const v = viewer();
  for (const value of v?.selection?.getSelectedCanonicalIds?.() || []) if (value) selected.add(String(value));
  for (const value of v?.selection?.getSelectionRenderIds?.() || []) if (value) selected.add(String(value));
  return selected;
}

function nativeOwnerKey(obj) {
  const attrs = attrsFor(obj);
  return String(attrs.RVM_NATIVE_CONTAINER_PARENT || attrs.RVM_OWNER_PATH || '').trim();
}

function nativeOwnerName(obj) {
  const attrs = attrsFor(obj);
  return String(attrs.RVM_OWNER_NAME || attrs.RVM_REVIEW_NAME || '').trim();
}

function isComponentOwnerSelectable(obj) {
  const attrs = attrsFor(obj);
  const type = String(typeFor(obj) || '').toUpperCase();
  const owner = nativeOwnerName(obj).toUpperCase();
  if (GROUP_SELECTABLE_TYPES.has(type)) return true;
  if (/^\/(PS|SL)-/.test(owner)) return true;
  return /\b(FLANGE|GASK|VALVE|ELBOW|BEND|TEE|OLET|REDUCER|NOZZLE|CAP|STRAINER|SUPPORT|INSTRUMENT)\b/.test(owner);
}

function expandNativeOwnerGroup(objects = []) {
  const v = viewer();
  const seed = objects.filter(Boolean);
  if (!v?.modelGroup || seed.length !== 1 || !isComponentOwnerSelectable(seed[0])) return seed;
  const key = nativeOwnerKey(seed[0]);
  if (!key) return seed;
  const group = [];
  let scanned = 0;
  v.modelGroup.traverse?.((obj) => {
    if (group.length >= MAX_SELECTED_OBJECTS || scanned > MAX_ALIAS_SCAN_OBJECTS) return;
    if (!(obj?.isMesh || obj?.isLine || obj?.isLineSegments || obj?.isPoints) || obj.visible === false) return;
    scanned += 1;
    if (nativeOwnerKey(obj) === key) group.push(obj);
  });
  return group.length > 1 ? group : seed;
}

function collectSelectedObjects(payload = {}) {
  if (Array.isArray(payload.objects) && payload.objects.length) return payload.objects.slice(0, MAX_SELECTED_OBJECTS);
  if (Array.isArray(payload.matches) && payload.matches.length) return payload.matches.slice(0, MAX_SELECTED_OBJECTS);
  const v = viewer();
  if (!v?.modelGroup) return [];
  const hierarchy = Array.isArray(v._rvmHierarchySelectedMeshes) ? v._rvmHierarchySelectedMeshes.filter((obj) => obj && (obj.isMesh || obj.isLine || obj.isLineSegments || obj.isPoints)) : [];
  if (hierarchy.length && v._rvmActiveHierarchySelection) return hierarchy.slice(0, MAX_SELECTED_OBJECTS);
  const direct = Array.isArray(v._rvmCanvasSelectedMeshes) ? v._rvmCanvasSelectedMeshes.filter((obj) => obj && (obj.isMesh || obj.isLine || obj.isLineSegments || obj.isPoints)) : [];
  if (direct.length) return expandNativeOwnerGroup(direct).slice(0, MAX_SELECTED_OBJECTS);
  const ids = selectedIdsFromPayload(payload);
  if (!ids.size) return [];
  const matches = [];
  let scanned = 0;
  v.modelGroup.traverse?.((obj) => {
    if (matches.length >= MAX_SELECTED_OBJECTS || scanned > MAX_ALIAS_SCAN_OBJECTS) return;
    if (!(obj?.isMesh || obj?.isLine || obj?.isLineSegments || obj?.isPoints)) return;
    scanned += 1;
    if (aliasesFor(obj).some((alias) => ids.has(alias))) matches.push(obj);
  });
  return expandNativeOwnerGroup(matches).slice(0, MAX_SELECTED_OBJECTS);
}

function boxForObjects(objects = []) {
  const box = new THREE.Box3();
  let any = false;
  for (const obj of objects) {
    try {
      const itemBox = new THREE.Box3().setFromObject(obj);
      if (itemBox && !itemBox.isEmpty()) { box.union(itemBox); any = true; }
    } catch (_) {}
  }
  return any ? box : null;
}

function sameOwnerName(objects = []) {
  const names = Array.from(new Set(objects.map(nativeOwnerName).filter(Boolean)));
  return names.length === 1 ? names[0] : '';
}

function selectionSource(objects = []) {
  if (!objects.length) return 'none';
  const v = viewer();
  if (v?._rvmActiveHierarchySelection) return 'hierarchy';
  const owner = sameOwnerName(objects);
  if (owner && objects.length > 1) return 'native-rvm-group';
  const direct = v?._rvmCanvasSelectedMeshes;
  return Array.isArray(direct) && direct.length ? 'canvas' : 'hierarchy';
}

function selectionKpis(objects = []) {
  const visible = objects.filter((obj) => obj?.visible !== false).length;
  const hidden = objects.length - visible;
  const types = new Set(objects.map(typeFor).filter((value) => value && value !== '-'));
  const primitives = new Set(objects.map(primitiveFor).filter((value) => value && value !== '-'));
  return [['Objects', objects.length], ['Visible', visible], ['Hidden', hidden], ['Types', types.size || 0], ['Prims', primitives.size || 0]];
}

function firstObjectLabel(objects = []) {
  const active = viewer()?._rvmActiveHierarchySelection;
  if (active?.label) return active.label;
  const owner = sameOwnerName(objects);
  if (owner) return owner;
  const first = objects[0] || null;
  const attrs = attrsFor(first);
  const data = first?.userData || {};
  const props = propsFor(first);
  return data.displayName || data.sourceName || props.displayName || attrs.RVM_OWNER_NAME || attrs.NAME || first?.name || '-';
}

function sourcePathForSelection(objects = []) {
  const active = viewer()?._rvmActiveHierarchySelection;
  if (active?.node?.canonicalObjectId || active?.node?.attributes?.RVM_BROWSER_BRANCH_PATH) return normalizePath(active.node.attributes?.RVM_BROWSER_BRANCH_PATH || active.node.canonicalObjectId);
  const owner = sameOwnerName(objects);
  if (owner) {
    const path = sourcePathFor(objects[0]).replace(/\s+\/\s+/g, '/');
    return path && path !== '-' ? path : owner;
  }
  const paths = objects.map(sourcePathFor).filter((path) => path && path !== '-');
  return commonPrefix(paths) || sourcePathFor(objects[0]);
}

function summaryRows(objects = []) {
  const first = objects[0] || null;
  const visible = objects.filter((obj) => obj?.visible !== false).length;
  const hidden = objects.length - visible;
  const box = boxForObjects(objects);
  const size = box ? box.getSize(new THREE.Vector3()) : null;
  const center = box ? box.getCenter(new THREE.Vector3()) : null;
  const attrs = attrsFor(first);
  const primitives = new Set(objects.map(primitiveFor).filter(Boolean));
  const types = new Set(objects.map(typeFor).filter(Boolean));
  const codes = new Set(objects.map((obj) => attrsFor(obj).RVM_PRIMITIVE_CODE).filter(Boolean));
  return [
    ['Selection objects', objects.length],
    ['Selection source', selectionSource(objects)],
    ['Visible / hidden', `${visible} / ${hidden}`],
    ['First object', firstObjectLabel(objects)],
    ['Source path', sourcePathForSelection(objects)],
    ['Type(s)', [...types].slice(0, 6).join(', ') || '-'],
    ['Primitive(s)', [...primitives].slice(0, 6).join(', ') || '-'],
    ['RVM primitive code', codes.size > 1 ? [...codes].slice(0, 6).join(', ') : (attrs.RVM_PRIMITIVE_CODE || attrs.RVM_CODE || first?.userData?.primitiveCode || '-')],
    ['Size XYZ', size ? `${fmt(size.x)} × ${fmt(size.y)} × ${fmt(size.z)}` : '-'],
    ['Center XYZ', fmtVec(center)],
    ['Bbox min', box ? fmtVec(box.min) : '-'],
    ['Bbox max', box ? fmtVec(box.max) : '-'],
  ];
}

function attributeRows(objects = []) {
  const active = viewer()?._rvmActiveHierarchySelection;
  if (active?.node?.attributes) return Object.entries(active.node.attributes).slice(0, MAX_ATTRIBUTE_ROWS);
  const first = objects[0] || null;
  const attrs = { ...attrsFor(first) };
  const owner = sameOwnerName(objects);
  if (owner) {
    attrs.NAME = owner;
    attrs.TYPE = attrs.TYPE || 'Group';
    attrs.RVM_REVIEW_NAME = owner;
    attrs.RVM_REVIEW_PATH = sourcePathForSelection(objects);
    attrs.RVM_GROUP_OBJECT_COUNT = String(objects.length);
  }
  const rows = Object.entries(attrs || {}).slice(0, MAX_ATTRIBUTE_ROWS);
  return rows.length ? rows : [['Attributes', 'No attributes attached to selected object']];
}

function row(key, value) { return `<div class="rvm-selection-detail-row"><span>${esc(key)}</span><b title="${esc(value)}">${esc(value === undefined || value === null || value === '' ? '-' : String(value))}</b></div>`; }
function kpi(label, value) { return `<span class="rvm-selection-kpi"><b>${esc(value)}</b><small>${esc(label)}</small></span>`; }

function updateSelectionCount(root, count) {
  const chip = root?.querySelector?.('[data-rvm-status-chip="selected"]');
  const footer = root?.querySelector?.('#rvm-sel-count');
  if (chip) chip.textContent = `Selected: ${count}`;
  if (footer) footer.textContent = String(count || 0);
}

function renderPanel(objects = [], reason = '') {
  const root = rootEl();
  const panel = root?.querySelector?.('#rvm-attributes-panel');
  if (!root || !panel) return;
  panel.dataset.rvmSelectionDetailsUi = BRIDGE_VERSION;
  if (!objects.length) {
    panel.innerHTML = `<div class="rvm-selection-details-card rvm-selection-details-card--empty" data-rvm-selection-details-inspector="true" data-rvm-selection-details-ui="${esc(BRIDGE_VERSION)}" data-rvm-selection-source="none"><div class="rvm-selection-details-title"><span>Selected Entity</span><small>${esc(reason || 'no selection')}</small></div><div class="rvm-selection-empty-state">Pick an object in the canvas or hierarchy to inspect its attributes, path, bbox, and primitive summary.</div></div>`;
    updateSelectionCount(root, 0);
    return;
  }
  const source = selectionSource(objects);
  const summary = summaryRows(objects);
  const attrs = attributeRows(objects);
  panel.innerHTML = `<div class="rvm-selection-details-card rvm-selection-details-card--v2" data-rvm-selection-details-inspector="true" data-rvm-selection-details-ui="${esc(BRIDGE_VERSION)}" data-rvm-selection-source="${esc(source)}"><div class="rvm-selection-details-title"><span>Selected Entity</span><small>${esc(source)} · ${esc(BRIDGE_VERSION)}</small></div><div class="rvm-selection-kpi-strip" data-rvm-selection-kpis="true">${selectionKpis(objects).map(([label, value]) => kpi(label, value)).join('')}</div><div class="rvm-tree-action-row rvm-selection-details-actions"><button type="button" class="rvm-btn is-primary" data-rvm-selection-detail-action="fit-selection">Fit</button><button type="button" class="rvm-btn" data-rvm-selection-detail-action="hide-selection">Hide</button><button type="button" class="rvm-btn" data-rvm-selection-detail-action="show-hidden">Show Hidden</button><button type="button" class="rvm-btn" data-rvm-selection-detail-action="copy-path">Copy Path</button><button type="button" class="rvm-btn is-secondary" data-rvm-selection-detail-action="clear-selection">Clear</button></div><div class="rvm-selection-details-title rvm-selection-subtitle"><span>Summary</span><small>${esc(reason || 'selected object')}</small></div><div class="rvm-selection-detail-grid">${summary.map(([key, value]) => row(key, value)).join('')}</div><div class="rvm-selection-details-title rvm-selection-subtitle"><span>Attributes</span><small>${esc(attrs.length)} row(s)</small></div><div class="rvm-selection-detail-grid">${attrs.map(([key, value]) => row(key, value)).join('')}</div></div>`;
  updateSelectionCount(root, objects.length);
}

function currentSelectionObjects() { return collectSelectedObjects({}); }

function fitObjects(objects = []) {
  const v = viewer();
  const box = boxForObjects(objects.filter((obj) => obj?.visible !== false));
  try {
    if (box && !box.isEmpty() && typeof v?._fitBox === 'function') { v._fitBox(box); return true; }
    v?.fitSelection?.();
    return true;
  } catch (_) { return false; }
}

function hideObjects(objects = []) {
  let count = 0;
  for (const obj of objects) {
    if (!obj || obj.visible === false) continue;
    obj.visible = false;
    obj.userData = obj.userData || {};
    obj.userData.rvmHiddenBySelectionDetails = true;
    count += 1;
  }
  viewer()?.requestRender?.();
  return count;
}

function showHiddenObjects() {
  const v = viewer();
  let count = 0;
  v?.modelGroup?.traverse?.((obj) => {
    if (obj?.userData?.rvmHiddenBySelectionDetails || obj?.userData?.rvmHiddenByUser) {
      obj.visible = obj.userData.rvmZoneLodOriginalVisible === false ? false : true;
      delete obj.userData.rvmHiddenBySelectionDetails;
      delete obj.userData.rvmHiddenByUser;
      count += 1;
    }
  });
  v?.requestRender?.();
  return count;
}

function clearSelection() {
  const root = rootEl();
  const v = viewer();
  try { v?.selection?.clearSelection?.(); } catch (_) {}
  if (v) { v._rvmCanvasSelectedMeshes = []; v._rvmHierarchySelectedMeshes = []; v._rvmActiveHierarchySelection = null; }
  root?.querySelectorAll?.('#rvm-tree li.is-selected').forEach((rowEl) => rowEl.classList.remove('is-selected'));
  renderPanel([], 'clear-selection');
}

async function copySelectionPath(objects = []) {
  const path = sourcePathForSelection(objects);
  if (!path || path === '-') return false;
  try { await navigator.clipboard?.writeText?.(path); return true; } catch (_) { return false; }
}

function handleAction(event) {
  const action = event.target?.closest?.('[data-rvm-selection-detail-action]')?.dataset?.rvmSelectionDetailAction;
  if (!action) return;
  const root = rootEl();
  const objects = currentSelectionObjects();
  if (action === 'fit-selection') { status(root, fitObjects(objects) ? `Fit ${objects.length} selected object(s).` : 'Fit selection unavailable.', !objects.length); return; }
  if (action === 'hide-selection') { const count = hideObjects(objects); renderPanel([], 'hide-selection'); status(root, count ? `Hidden ${count} selected object(s).` : 'No visible selected objects to hide.', !count); return; }
  if (action === 'show-hidden') { const count = showHiddenObjects(); renderPanel(currentSelectionObjects(), 'show-hidden'); status(root, count ? `Shown ${count} hidden object(s).` : 'No selection-hidden objects found.', !count); return; }
  if (action === 'clear-selection') { clearSelection(); status(root, 'Selection cleared.'); return; }
  if (action === 'copy-path') copySelectionPath(objects).then((ok) => status(root, ok ? 'Copied selected RVM source path.' : 'No path available to copy.', !ok));
}

function refresh(payload = {}, reason = 'selection-event') { renderPanel(collectSelectedObjects(payload), reason); }

function installStyles() {
  if (typeof document === 'undefined' || document.getElementById('rvm-selection-details-inspector-style')) return;
  const style = document.createElement('style');
  style.id = 'rvm-selection-details-inspector-style';
  style.textContent = `.rvm-selection-details-card{display:grid;gap:8px;min-width:0}.rvm-selection-details-title{display:flex;align-items:center;justify-content:space-between;gap:8px;color:#93c5fd;font-weight:800;font-size:12px;letter-spacing:.04em;text-transform:uppercase}.rvm-selection-details-title small{font-size:8px;color:#7f94b7;text-transform:none;font-weight:500;letter-spacing:0}.rvm-selection-subtitle{margin-top:2px}.rvm-selection-kpi-strip{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:5px}.rvm-selection-kpi{display:grid;gap:1px;padding:6px 4px;border:1px solid rgba(126,190,255,.13);border-radius:8px;background:rgba(255,255,255,.025);text-align:center}.rvm-selection-kpi b{color:#edf6ff;font-size:13px;line-height:1}.rvm-selection-kpi small{color:#8fa5c7;font-size:8px;text-transform:uppercase;letter-spacing:.04em}.rvm-selection-detail-grid{display:grid;gap:3px}.rvm-selection-detail-row{display:grid;grid-template-columns:minmax(90px,.64fr) minmax(0,1.36fr);gap:6px;align-items:start;padding:4px 6px;border:1px solid rgba(126,190,255,.12);border-radius:6px;background:rgba(255,255,255,.026);font-size:10px}.rvm-selection-detail-row span{color:#9eb7d8}.rvm-selection-detail-row b{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#edf6ff;font-weight:600}.rvm-selection-details-actions{display:flex;flex-wrap:wrap;gap:5px}.rvm-selection-details-actions .rvm-btn{padding:4px 7px;font-size:11px}.rvm-selection-details-actions .rvm-btn.is-primary{border-color:rgba(147,197,253,.45);background:#15304f}.rvm-selection-details-actions .rvm-btn.is-secondary{opacity:.82}.rvm-selection-empty-state{border:1px dashed rgba(148,163,184,.24);border-radius:9px;padding:8px;color:#94a3b8;background:rgba(15,23,42,.42);font-size:10.5px;line-height:1.4}@media(max-width:1150px){.rvm-selection-kpi-strip{grid-template-columns:repeat(2,minmax(0,1fr))}.rvm-selection-detail-row{grid-template-columns:1fr}}`;
  document.head.appendChild(style);
}

export function installRvmSelectionDetailsInspectorBridge() {
  if (typeof document === 'undefined') return;
  if (globalThis[INSTALL_FLAG]) return;
  globalThis[INSTALL_FLAG] = true;
  installStyles();
  document.addEventListener('click', handleAction, true);
  document.addEventListener('rvm-hierarchy-selection', (event) => setTimeout(() => refresh(event.detail || {}, 'hierarchy-selection'), 0), true);
  on(RuntimeEvents.RVM_NODE_SELECTED, (payload) => setTimeout(() => refresh(payload, 'rvm-node-selected'), 0));
  globalThis.addEventListener?.('rvm-model-loaded', () => setTimeout(() => refresh({}, 'model-loaded'), 180));
  globalThis.__PCF_GLB_RVM_SELECTION_DETAILS_INSPECTOR__ = { version: BRIDGE_VERSION, previousVersion: PREVIOUS_VERSION, refresh, collectSelectedObjects };
}
