import * as THREE from 'three';
import { RvmTagXmlStore } from '../rvm/RvmTagXmlStore.js';
import { RuntimeEvents } from '../contracts/runtime-events.js';
import { on } from '../core/event-bus.js';
import { state } from '../core/state.js';
import { createTextPlane } from '../converters/inputxml-basic-glb/InputXmlBasicGeometry.js';

const VERSION = '20260630-rvm-tag-tools-2';
const GLOBAL_KEY = '__PCF_GLB_RVM_TAGS__';
const ROOT_SELECTOR = '[data-rvm-viewer]';
const TAG_LAYER_NAME = 'RVM_NAVIS_TAG_DISPLAY_LAYER';
const PENDING_LAYER_NAME = 'RVM_NAVIS_TAG_PENDING_LAYER';
const IMPORT_INPUT_ID = 'rvm-tag-import-file';

const tagState = {
  active: false,
  anchor: null,
  draft: null,
  store: null,
  storeKey: '',
  rendererCanvas: null,
  unsubscribe: [],
};

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

/**
 * Installs the RVM tag UI and scene helpers.
 * Parameters: none; it discovers the active RVM root/viewer from the page.
 * Outputs: a global API for create/import/export/focus/render actions.
 * Fallback: missing viewer/model state reports status text and leaves parsing/export untouched.
 */
export function installRvmTagToolsBridge() {
  if (typeof document === 'undefined') return null;
  const existing = globalThis[GLOBAL_KEY];
  if (existing?.version === VERSION) return existing;
  injectStyles();
  const api = {
    version: VERSION,
    createManualTag,
    importXmlText,
    exportXmlText,
    deleteTag,
    focusTag,
    render: () => renderAll('api'),
    getDiagnostics,
  };
  globalThis[GLOBAL_KEY] = api;
  tagState.unsubscribe.push(on(RuntimeEvents.RVM_TAG_CREATED, () => renderAll('tag-created')));
  tagState.unsubscribe.push(on(RuntimeEvents.RVM_TAG_DELETED, () => renderAll('tag-deleted')));
  bindDocumentEvents();
  renderAll('install');
  for (const delay of [100, 350, 900, 1800, 3200]) setTimeout(() => renderAll(`install-${delay}`), delay);
  return api;
}

function bindDocumentEvents() {
  document.addEventListener('click', onDocumentClick, true);
  document.addEventListener('change', onDocumentChange, true);
  document.addEventListener('submit', onDocumentSubmit, true);
  globalThis.addEventListener?.('rvm-model-loaded', () => {
    resetCapture('model-loaded');
    renderAll('model-loaded');
  });
}

function currentRoot() {
  return document.querySelector(ROOT_SELECTOR);
}

function currentViewer() {
  const root = currentRoot();
  return root?.__rvmViewer3D || root?.__rvmViewer || globalThis.__3D_RVM_VIEWER__ || null;
}

function currentStore() {
  const root = currentRoot();
  const viewer = currentViewer();
  const key = bundleId(root, viewer);
  if (!tagState.store || tagState.storeKey !== key) {
    tagState.store = new RvmTagXmlStore(viewer?.ctx?.identityMap || state.rvm?.identityMap || null, key);
    tagState.storeKey = key;
    if (viewer) viewer.tagStore = tagState.store;
  }
  return tagState.store;
}

function bundleId(root, viewer) {
  return String(
    state.rvm?.activeBundle
    || root?.dataset?.rvmLoadedFileName
    || viewer?.modelGroup?.children?.[0]?.userData?.fileName
    || viewer?.modelGroup?.children?.[0]?.userData?.browserRvmParser?.fileName
    || viewer?.modelGroup?.userData?.fileName
    || root?.dataset?.rvmLoadedSourceKind
    || 'rvm-session'
  );
}

function renderAll(reason = 'manual') {
  const root = currentRoot();
  const viewer = currentViewer();
  if (!root) return null;
  ensureToolbar(root);
  ensureTagsPanel(root);
  bindCanvas(viewer);
  renderTagsPanel(root, viewer, reason);
  renderTagLayer(viewer);
  faceTagLabels(viewer);
  root.dataset.rvmTagTools = VERSION;
  root.dataset.rvmTagToolsReason = reason;
  return getDiagnostics();
}

function ensureToolbar(root) {
  const ribbon = root?.querySelector?.('.geo-top-ribbon');
  if (!ribbon || ribbon.querySelector('[data-rvm-tag-toolbar]')) return;
  const group = document.createElement('div');
  group.className = 'rvm-ribbon-section rvm-tool-group rvm-tag-toolbar';
  group.dataset.rvmTagToolbar = VERSION;
  group.dataset.rvmToolbarAlwaysTop = 'true';
  group.setAttribute('aria-label', 'Tags tools');
  group.innerHTML = `
    <span class="rvm-ribbon-label">Tags</span>
    <div class="rvm-ribbon-button-row">
      <button class="rvm-tool-btn" type="button" data-rvm-tag-action="create" title="Create a two-click Navis tag"><span>Tag</span></button>
      <button class="rvm-tool-btn" type="button" data-rvm-tag-action="view" title="Open tag view"><span>View</span></button>
      <button class="rvm-tool-btn" type="button" data-rvm-tag-action="import" title="Import Navis tag XML"><span>Import</span></button>
      <button class="rvm-tool-btn" type="button" data-rvm-tag-action="export" title="Export Navis tag XML"><span>Export</span></button>
      <input id="${IMPORT_INPUT_ID}" type="file" accept=".xml,text/xml,application/xml" hidden>
    </div>`;
  const viewGroup = [...ribbon.querySelectorAll(':scope > .rvm-tool-group')].find((node) => /view/i.test(node.getAttribute('aria-label') || node.textContent || ''));
  if (viewGroup?.nextSibling) ribbon.insertBefore(group, viewGroup.nextSibling);
  else ribbon.insertBefore(group, ribbon.querySelector('.rvm-ribbon-load') || ribbon.firstChild);
}

function ensureTagsPanel(root) {
  const tabApi = globalThis.__PCF_GLB_RVM_RIGHT_PANEL_TABS__;
  const panel = tabApi?.ensureTab?.(root, 'tags', 'Tags') || root?.querySelector?.('[data-rvm-right-panel-tab="tags"]');
  if (!panel || panel.querySelector('#rvm-tags-panel')) return panel;
  const host = document.createElement('div');
  host.id = 'rvm-tags-panel';
  host.className = 'rvm-tags-panel';
  host.dataset.rvmTagsPanel = VERSION;
  panel.appendChild(host);
  return panel;
}

function renderTagsPanel(root, viewer, reason = 'render') {
  const host = root?.querySelector?.('#rvm-tags-panel');
  if (!host) return;
  const store = currentStore();
  const tags = store.getAllTags();
  host.dataset.rvmTagsPanelReason = reason;
  const draft = tagState.draft;
  host.innerHTML = `
    <div class="rvm-tags-head">
      <div><strong>Navis Tags</strong><span>${tags.length} tag${tags.length === 1 ? '' : 's'} in ${escapeHtml(bundleId(root, viewer))}</span></div>
      <button type="button" class="rvm-btn" data-rvm-tag-action="create">${tagState.active ? 'Cancel' : 'Create'}</button>
    </div>
    ${draft ? renderDraftForm(draft) : renderCaptureHint()}
    <div class="rvm-tags-actions">
      <button type="button" class="rvm-btn" data-rvm-tag-action="import">Import XML</button>
      <button type="button" class="rvm-btn" data-rvm-tag-action="export" ${tags.length ? '' : 'disabled'}>Export XML</button>
    </div>
    <div class="rvm-tags-list">
      ${tags.length ? tags.map(renderTagRow).join('') : '<div class="rvm-empty-state">No tags yet. Use Create Tag or import a Navis XML file.</div>'}
    </div>`;
}

function renderCaptureHint() {
  if (tagState.active && tagState.anchor) return '<div class="rvm-tag-capture-hint is-active">Anchor set. Click the label location in the viewport.</div>';
  if (tagState.active) return '<div class="rvm-tag-capture-hint is-active">Click a model point for the tag anchor.</div>';
  return '<div class="rvm-tag-capture-hint">Create Tag uses two clicks: anchor point, then label location.</div>';
}

function renderDraftForm(draft) {
  return `
    <form class="rvm-tag-draft" data-rvm-tag-draft-form>
      <label>Text<textarea data-rvm-tag-draft-text rows="3">Manual tag</textarea></label>
      <label>Severity<select data-rvm-tag-draft-severity><option value="info">Info</option><option value="warning">Warning</option><option value="high">High</option></select></label>
      <div class="rvm-tags-actions">
        <button type="submit" class="rvm-btn">Save Tag</button>
        <button type="button" class="rvm-btn is-secondary" data-rvm-tag-action="cancel-draft">Cancel</button>
      </div>
      <small>Anchor ${formatPoint(draft.anchor)} -> label ${formatPoint(draft.labelPoint)}</small>
    </form>`;
}

function renderTagRow(tag) {
  const status = tag.status || 'active';
  return `
    <article class="rvm-tag-row severity-${escapeHtml(tag.severity || 'info')}" data-rvm-tag-id="${escapeHtml(tag.id)}" data-status="${escapeHtml(status)}">
      <button type="button" data-rvm-tag-focus="${escapeHtml(tag.id)}">
        <span class="rvm-tag-row-title">${escapeHtml(tag.text || tag.id)}</span>
        <span class="rvm-tag-row-meta">${escapeHtml(tag.severity || 'info')} - ${escapeHtml(status)}</span>
      </button>
      <button type="button" class="rvm-tag-delete" data-rvm-tag-delete="${escapeHtml(tag.id)}" title="Delete tag">Delete</button>
    </article>`;
}

function onDocumentClick(event) {
  const action = event.target?.closest?.('[data-rvm-tag-action]')?.dataset?.rvmTagAction;
  if (action) {
    event.preventDefault();
    event.stopPropagation();
    handleAction(action);
    return;
  }
  const focusId = event.target?.closest?.('[data-rvm-tag-focus]')?.dataset?.rvmTagFocus;
  if (focusId) {
    event.preventDefault();
    focusTag(focusId);
    return;
  }
  const deleteId = event.target?.closest?.('[data-rvm-tag-delete]')?.dataset?.rvmTagDelete;
  if (deleteId) {
    event.preventDefault();
    deleteTag(deleteId);
  }
}

function onDocumentSubmit(event) {
  const form = event.target?.closest?.('[data-rvm-tag-draft-form]');
  if (!form) return;
  event.preventDefault();
  const text = form.querySelector('[data-rvm-tag-draft-text]')?.value || 'Manual tag';
  const severity = form.querySelector('[data-rvm-tag-draft-severity]')?.value || 'info';
  createManualTag({ text, severity, anchor: tagState.draft?.anchor, labelPoint: tagState.draft?.labelPoint });
}

function onDocumentChange(event) {
  if (event.target?.id !== IMPORT_INPUT_ID) return;
  const file = event.target.files?.[0];
  event.target.value = '';
  if (!file) return;
  file.text().then((text) => importXmlText(text, file.name)).catch((error) => setStatus(`Tag import failed: ${error?.message || error}`, true));
}

function handleAction(action) {
  if (action === 'create') {
    if (tagState.active) resetCapture('cancel-create');
    else startCapture();
    renderAll('create-toggle');
    globalThis.__PCF_GLB_RVM_RIGHT_PANEL_TABS__?.activate?.(currentRoot(), 'tags');
    return;
  }
  if (action === 'view') {
    globalThis.__PCF_GLB_RVM_RIGHT_PANEL_TABS__?.activate?.(currentRoot(), 'tags');
    renderAll('view');
    return;
  }
  if (action === 'import') {
    document.getElementById(IMPORT_INPUT_ID)?.click();
    return;
  }
  if (action === 'export') {
    const xml = exportXmlText();
    if (xml) downloadText(xml, tagFileName('navis-tags.xml'), 'application/xml');
    return;
  }
  if (action === 'cancel-draft') {
    tagState.draft = null;
    resetCapture('cancel-draft');
    renderAll('cancel-draft');
  }
}

function startCapture() {
  const viewer = currentViewer();
  if (!viewer?.renderer?.domElement || !viewer?.modelGroup?.children?.length) {
    setStatus('Load a model before creating a tag.', true);
    return false;
  }
  tagState.active = true;
  tagState.anchor = null;
  tagState.draft = null;
  viewer.controls.enabled = false;
  viewer.renderer.domElement.style.cursor = 'crosshair';
  setStatus('Create Tag: click the anchor point.');
  return true;
}

function resetCapture(reason = 'reset') {
  const viewer = currentViewer();
  tagState.active = false;
  tagState.anchor = null;
  clearPendingLayer(viewer);
  if (viewer?.renderer?.domElement) viewer.renderer.domElement.style.cursor = '';
  if (viewer?.controls) viewer.controls.enabled = true;
  if (reason !== 'model-loaded') setStatus('Tag capture cancelled.');
}

function bindCanvas(viewer) {
  const canvas = viewer?.renderer?.domElement;
  if (!canvas || tagState.rendererCanvas === canvas) return;
  if (tagState.rendererCanvas) tagState.rendererCanvas.removeEventListener('pointerdown', onCanvasPointerDown, true);
  tagState.rendererCanvas = canvas;
  canvas.addEventListener('pointerdown', onCanvasPointerDown, true);
  viewer?.controls?.addEventListener?.('change', () => faceTagLabels(viewer));
}

function onCanvasPointerDown(event) {
  if (!tagState.active) return;
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation?.();
  const viewer = currentViewer();
  const point = pickPoint(event, viewer, tagState.anchor);
  if (!point) {
    setStatus('Tag point pick failed. Click closer to model geometry.', true);
    return;
  }
  if (!tagState.anchor) {
    tagState.anchor = point;
    drawPendingAnchor(viewer, point);
    setStatus('Create Tag: click the label location.');
    renderAll('anchor-picked');
    return;
  }
  tagState.draft = { anchor: tagState.anchor.clone(), labelPoint: point.clone() };
  tagState.active = false;
  if (viewer?.controls) viewer.controls.enabled = true;
  if (viewer?.renderer?.domElement) viewer.renderer.domElement.style.cursor = '';
  drawPendingDraft(viewer, tagState.draft);
  globalThis.__PCF_GLB_RVM_RIGHT_PANEL_TABS__?.activate?.(currentRoot(), 'tags');
  setStatus('Tag leader captured. Enter text and save.');
  renderAll('draft-ready');
}

function pickPoint(event, viewer, fallbackPoint = null) {
  const canvas = viewer?.renderer?.domElement;
  if (!viewer || !canvas) return null;
  const rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return null;
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, viewer.camera);
  const candidates = [];
  viewer.modelGroup?.traverse?.((object) => {
    if (!object.visible || object.userData?.isRvmTagHelper) return;
    if (object.isMesh || object.isLine || object.isLineSegments || object.isPoints) candidates.push(object);
  });
  const hit = raycaster.intersectObjects(candidates, false)[0];
  if (hit?.point) return hit.point.clone();
  const center = fallbackPoint || modelCenter(viewer);
  const normal = viewer.camera.getWorldDirection(new THREE.Vector3()).normalize();
  const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(normal, center);
  const point = new THREE.Vector3();
  return raycaster.ray.intersectPlane(plane, point) ? point : null;
}

function createManualTag(config = {}) {
  const viewer = currentViewer();
  const anchor = vectorFrom(config.anchor);
  const labelPoint = vectorFrom(config.labelPoint);
  if (!viewer || !anchor || !labelPoint) {
    setStatus('Tag creation failed: missing captured points.', true);
    return null;
  }
  const text = String(config.text || 'Manual tag').trim() || 'Manual tag';
  const severity = String(config.severity || 'info').trim() || 'info';
  const store = currentStore();
  const tag = store.createTag({
    canonicalObjectId: selectedCanonicalId(viewer),
    sourceObjectId: selectedSourceObjectId(viewer),
    text,
    severity,
    worldPosition: pointObject(anchor),
    cameraState: cameraState(viewer),
    navis: {
      format: 'navisworks-exchange-12.0',
      redline: {
        colour: colourForSeverity(severity),
        pos1: projectPoint(anchor, viewer),
        pos2: projectPoint(labelPoint, viewer),
        pos3d: pointObject(anchor),
        bounds: boxObject(boundsAround(anchor, labelPoint)),
      },
      rvmViewer: {
        labelPoint: pointObject(labelPoint),
        source: 'manual-two-click',
      },
    },
  });
  tagState.draft = null;
  clearPendingLayer(viewer);
  renderAll('manual-tag-created');
  setStatus(`Created tag: ${text}`);
  return tag;
}

function importXmlText(xmlText, fileName = 'tags.xml') {
  const store = currentStore();
  const imported = store.importFromXml(String(xmlText || ''));
  renderAll('xml-import');
  setStatus(`Imported ${imported.length} tag${imported.length === 1 ? '' : 's'} from ${fileName}.`);
  globalThis.__PCF_GLB_RVM_RIGHT_PANEL_TABS__?.activate?.(currentRoot(), 'tags');
  return imported;
}

function exportXmlText() {
  const store = currentStore();
  const xml = store.exportToXml();
  setStatus(`Exported ${store.getAllTags().length} tag${store.getAllTags().length === 1 ? '' : 's'} to Navis XML.`);
  return xml;
}

function deleteTag(id) {
  const ok = currentStore().deleteTag(id);
  if (ok) {
    renderAll('delete');
    setStatus(`Deleted tag ${id}.`);
  }
  return ok;
}

function focusTag(id) {
  const viewer = currentViewer();
  const tag = currentStore().getTag(id);
  if (!viewer || !tag) return false;
  if (tag.cameraState) viewer.setCameraState?.(toThreeCameraState(tag.cameraState));
  if (tag.canonicalObjectId) {
    try { viewer.selectByCanonicalId?.(tag.canonicalObjectId); } catch (_) {}
  }
  const anchor = tagAnchorPoint(tag, viewer);
  if (anchor) {
    const box = boundsAround(anchor, labelPointForTag(tag, viewer, anchor));
    if (typeof viewer._fitBox === 'function') viewer._fitBox(box);
  } else if (tag.canonicalObjectId) {
    viewer.fitSelection?.();
  }
  highlightTag(id, viewer);
  setStatus(`Focused tag: ${tag.text || tag.id}`);
  return true;
}

function renderTagLayer(viewer) {
  if (!viewer?.scene) return;
  clearLayer(viewer, TAG_LAYER_NAME);
  const layer = ensureLayer(viewer, TAG_LAYER_NAME);
  for (const tag of currentStore().getAllTags()) {
    const group = buildTagObject(tag, viewer);
    if (group) layer.add(group);
  }
  viewer.requestRender?.();
}

function buildTagObject(tag, viewer) {
  const anchor = tagAnchorPoint(tag, viewer);
  if (!anchor) return null;
  const labelPoint = labelPointForTag(tag, viewer, anchor);
  const group = new THREE.Group();
  group.name = `RVM_TAG_${tag.id}`;
  group.userData = { isRvmTagHelper: true, ignoreBounds: true, tagId: tag.id };
  const colour = severityHex(tag.severity);
  const line = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([anchor, labelPoint]),
    new THREE.LineBasicMaterial({ color: colour, depthTest: false, depthWrite: false })
  );
  line.name = `RVM_TAG_LEADER_${tag.id}`;
  line.renderOrder = 1300;
  const marker = new THREE.Mesh(
    new THREE.SphereGeometry(markerRadius(anchor, viewer), 16, 8),
    new THREE.MeshBasicMaterial({ color: colour, depthTest: false, depthWrite: false })
  );
  marker.name = `RVM_TAG_ANCHOR_${tag.id}`;
  marker.position.copy(anchor);
  marker.renderOrder = 1301;
  const label = createTextPlane(tag.text || tag.id, {
    width: 480,
    height: 150,
    fontSize: 30,
    scale: Math.max(markerRadius(anchor, viewer) * 8, 0.55),
    bg: 'rgba(9,16,28,0.94)',
    border: borderForSeverity(tag.severity),
    fg: '#eef6ff',
    name: `RVM_TAG_TEXT_${tag.id}`,
    maxLineLength: 26,
  });
  label.position.copy(labelPoint);
  label.renderOrder = 1302;
  label.userData = { isRvmTagHelper: true, ignoreBounds: true, tagId: tag.id, isRvmTagLabel: true };
  label.lookAt(viewer.camera.position);
  group.add(line, marker, label);
  return group;
}

function labelPointForTag(tag, viewer, anchorPoint = null) {
  const saved = vectorFrom(tag.navis?.rvmViewer?.labelPoint);
  if (saved) return saved;
  const bounds = tag.navis?.redline?.bounds;
  const center = bounds?.min && bounds?.max ? new THREE.Vector3(
    (Number(bounds.min.x) + Number(bounds.max.x)) / 2,
    (Number(bounds.min.y) + Number(bounds.max.y)) / 2,
    (Number(bounds.min.z) + Number(bounds.max.z)) / 2
  ) : null;
  const anchor = anchorPoint || tagAnchorPoint(tag, viewer) || modelCenter(viewer);
  if (center && center.distanceTo(anchor) > 1e-6) return center;
  const navisLabel = navisPointForTag(tag, viewer, 'pos2');
  if (navisLabel && navisLabel.distanceTo(anchor) > 1e-6) return navisLabel;
  const distance = Math.max(markerRadius(anchor, viewer) * 12, 1);
  return anchor.clone().add(new THREE.Vector3(distance, distance * 0.55, distance * 0.35));
}

function tagAnchorPoint(tag, viewer) {
  return vectorFrom(tag.worldPosition || tag.navis?.redline?.pos3d) || navisPointForTag(tag, viewer, 'pos1');
}

function drawPendingAnchor(viewer, point) {
  clearPendingLayer(viewer);
  const layer = ensureLayer(viewer, PENDING_LAYER_NAME);
  const marker = new THREE.Mesh(
    new THREE.SphereGeometry(markerRadius(point, viewer) * 1.2, 16, 8),
    new THREE.MeshBasicMaterial({ color: 0xffd166, depthTest: false })
  );
  marker.name = 'RVM_TAG_PENDING_ANCHOR';
  marker.position.copy(point);
  marker.userData = { isRvmTagHelper: true, ignoreBounds: true };
  layer.add(marker);
}

function drawPendingDraft(viewer, draft) {
  clearPendingLayer(viewer);
  const layer = ensureLayer(viewer, PENDING_LAYER_NAME);
  const line = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([draft.anchor, draft.labelPoint]),
    new THREE.LineBasicMaterial({ color: 0xffd166, depthTest: false })
  );
  line.userData = { isRvmTagHelper: true, ignoreBounds: true };
  layer.add(line);
}

function clearPendingLayer(viewer) {
  clearLayer(viewer, PENDING_LAYER_NAME);
}

function ensureLayer(viewer, name) {
  let layer = viewer.scene.getObjectByName(name);
  if (!layer) {
    layer = new THREE.Group();
    layer.name = name;
    layer.userData = { isRvmTagHelper: true, ignoreBounds: true };
    viewer.scene.add(layer);
  }
  return layer;
}

function clearLayer(viewer, name) {
  const layer = viewer?.scene?.getObjectByName?.(name);
  if (!layer) return;
  while (layer.children.length) {
    const child = layer.children.pop();
    disposeObject(child);
  }
}

function disposeObject(object) {
  object?.traverse?.((child) => {
    child.geometry?.dispose?.();
    if (Array.isArray(child.material)) child.material.forEach((material) => material?.dispose?.());
    else child.material?.dispose?.();
  });
}

function faceTagLabels(viewer) {
  if (!viewer?.camera) return;
  viewer.scene?.traverse?.((object) => {
    if (object.userData?.isRvmTagLabel) object.lookAt(viewer.camera.position);
  });
}

function highlightTag(id, viewer) {
  viewer?.scene?.traverse?.((object) => {
    if (object.name === `RVM_TAG_${id}`) object.userData.highlighted = true;
  });
}

function selectedCanonicalId(viewer) {
  return viewer?.selection?.getSelectedCanonicalId?.() || '';
}

function selectedSourceObjectId(viewer) {
  const selected = selectedCanonicalId(viewer);
  if (!selected) return '';
  return viewer?.ctx?.identityMap?.lookupByCanonical?.(selected)?.sourceObjectId || '';
}

function cameraState(viewer) {
  return {
    position: pointObject(viewer.camera.position),
    target: pointObject(viewer.controls.target),
    rotationQuaternion: quaternionObject(viewer.camera.quaternion),
  };
}

function toThreeCameraState(cameraState) {
  return {
    ...cameraState,
    position: vectorFrom(cameraState.position) || cameraState.position,
    target: vectorFrom(cameraState.target) || cameraState.target,
  };
}

function projectPoint(point, viewer) {
  if (!point || !viewer?.camera) return { x: 0, y: 0 };
  const projected = point.clone().project(viewer.camera);
  return {
    x: clamp(projected.x, -1, 1),
    y: clamp(projected.y, -1, 1),
  };
}

// Reconstructs app helper positions from Navis screen-space redline points.
function navisPointForTag(tag, viewer, pointKey) {
  const point2d = tag?.navis?.redline?.[pointKey];
  if (!point2d || !viewer) return null;
  const camera = navisCameraForTag(tag, viewer);
  if (!camera) return null;
  const ndc = new THREE.Vector2(clamp(point2d.x, -1, 1), clamp(point2d.y, -1, 1));

  if (pointKey === 'pos1') {
    const modelHit = navisModelHit(viewer, ndc, camera);
    if (modelHit) return modelHit;
  }

  const tagRaycaster = new THREE.Raycaster();
  tagRaycaster.setFromCamera(ndc, camera);
  const center = modelCenter(viewer);
  const normal = camera.getWorldDirection(new THREE.Vector3()).normalize();
  const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(normal, center);
  const point = new THREE.Vector3();

  if (tagRaycaster.ray.intersectPlane(plane, point)) return point;

  const distance = Math.max(camera.position.distanceTo(center), 1);
  return tagRaycaster.ray.at(distance, point);
}

function navisModelHit(viewer, ndc, camera) {
  const group = viewer?.modelGroup;
  if (!group) return null;
  group.updateMatrixWorld?.(true);
  const tagRaycaster = new THREE.Raycaster();
  tagRaycaster.setFromCamera(ndc, camera);
  const hit = tagRaycaster.intersectObject(group, true).find((item) => !item.object?.userData?.isRvmTagHelper);
  return hit?.point?.clone?.() || null;
}

function navisCameraForTag(tag, viewer) {
  const cameraStateValue = tag?.cameraState || {};
  const navis = tag?.navis || {};
  const attrs = cameraStateValue.navisCameraAttrs || navis.cameraAttrs || {};
  const camera = new THREE.PerspectiveCamera(navisCameraFov(attrs, viewer), navisCameraAspect(attrs, viewer), navisCameraNear(attrs), navisCameraFar(attrs));
  const position = vectorFrom(cameraStateValue.position || navis.cameraPosition) || viewer?.camera?.position?.clone?.();
  if (!position) return null;
  const up = vectorFrom(navis.upVector) || viewer?.camera?.up?.clone?.();
  if (up) camera.up.copy(up.normalize());
  camera.position.copy(position);

  const quaternion = navisQuaternion(cameraStateValue.rotationQuaternion || navis.cameraRotationQuaternion);
  if (quaternion) {
    camera.quaternion.copy(quaternion);
  } else {
    const target = vectorFrom(cameraStateValue.target);
    if (target) camera.lookAt(target);
    else if (viewer?.camera?.quaternion) camera.quaternion.copy(viewer.camera.quaternion);
  }

  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);
  return camera;
}

function navisCameraFov(attrs, viewer) {
  const height = Number(attrs?.height);
  if (Number.isFinite(height) && height > 0 && height <= Math.PI) return THREE.MathUtils.radToDeg(height);
  if (Number.isFinite(height) && height > 0 && height <= 180) return height;
  const fov = Number(viewer?.camera?.fov);
  return Number.isFinite(fov) && fov > 0 ? fov : 45;
}

function navisCameraAspect(attrs, viewer) {
  const aspect = Number(attrs?.aspect);
  if (Number.isFinite(aspect) && aspect > 0) return aspect;
  const canvas = viewer?.renderer?.domElement || tagState.rendererCanvas;
  const width = Number(canvas?.clientWidth || canvas?.width);
  const height = Number(canvas?.clientHeight || canvas?.height);
  if (Number.isFinite(width) && Number.isFinite(height) && height > 0) return width / height;
  const cameraAspectValue = Number(viewer?.camera?.aspect);
  return Number.isFinite(cameraAspectValue) && cameraAspectValue > 0 ? cameraAspectValue : 4 / 3;
}

function navisCameraNear(attrs) {
  const near = Number(attrs?.near);
  return Number.isFinite(near) && near > 0 ? near : 0.1;
}

function navisCameraFar(attrs) {
  const far = Number(attrs?.far);
  return Number.isFinite(far) && far > 0 ? far : 1000;
}

function navisQuaternion(value) {
  const a = Number(value?.a);
  const b = Number(value?.b);
  const c = Number(value?.c);
  const d = Number(value?.d);
  if (![a, b, c, d].every(Number.isFinite)) return null;
  const lengthSquared = a * a + b * b + c * c + d * d;
  if (lengthSquared <= 1e-12) return null;
  return new THREE.Quaternion(a, b, c, d).normalize();
}

function boundsAround(a, b) {
  const box = new THREE.Box3().setFromPoints([a, b || a]);
  box.expandByScalar(Math.max(a.distanceTo(b || a) * 0.08, 0.05));
  return box;
}

function boxObject(box) {
  return { min: pointObject(box.min), max: pointObject(box.max) };
}

function modelCenter(viewer) {
  const box = new THREE.Box3().setFromObject(viewer?.modelGroup || new THREE.Group());
  return box.isEmpty() ? new THREE.Vector3() : box.getCenter(new THREE.Vector3());
}

function pointObject(point) {
  return { x: Number(point?.x) || 0, y: Number(point?.y) || 0, z: Number(point?.z) || 0 };
}

function quaternionObject(quaternion) {
  return {
    a: Number(quaternion?.x) || 0,
    b: Number(quaternion?.y) || 0,
    c: Number(quaternion?.z) || 0,
    d: Number(quaternion?.w) || 1,
  };
}

function vectorFrom(value) {
  if (!value) return null;
  if (value.isVector3) return value.clone();
  const x = Number(value.x);
  const y = Number(value.y);
  const z = Number(value.z);
  if (![x, y, z].every(Number.isFinite)) return null;
  return new THREE.Vector3(x, y, z);
}

function markerRadius(point, viewer) {
  if (!viewer?.camera || !point) return 0.1;
  return Math.max(viewer.camera.position.distanceTo(point) * 0.004, 0.06);
}

function severityHex(severity) {
  const text = String(severity || '').toLowerCase();
  if (text === 'high') return 0xff4d4d;
  if (text === 'warning' || text === 'medium') return 0xffd166;
  return 0x66c2ff;
}

function borderForSeverity(severity) {
  const text = String(severity || '').toLowerCase();
  if (text === 'high') return '#ff4d4d';
  if (text === 'warning' || text === 'medium') return '#ffd166';
  return '#66c2ff';
}

function colourForSeverity(severity) {
  const text = String(severity || '').toLowerCase();
  if (text === 'high') return { red: 1, green: 0, blue: 0 };
  if (text === 'warning' || text === 'medium') return { red: 1, green: 0.75, blue: 0 };
  return { red: 0.2, green: 0.65, blue: 1 };
}

function formatPoint(point) {
  return `${fmt(point?.x)}, ${fmt(point?.y)}, ${fmt(point?.z)}`;
}

function fmt(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n.toFixed(2) : '0.00';
}

function clamp(value, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.min(max, Math.max(min, n));
}

function tagFileName(suffix) {
  const base = bundleId(currentRoot(), currentViewer()).replace(/\.[^.]+$/, '').replace(/[^A-Za-z0-9._-]+/g, '_') || 'rvm';
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  return `${base}-${stamp}-${suffix}`;
}

function downloadText(text, filename, type) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function setStatus(message, warning = false) {
  const status = currentRoot()?.querySelector?.('#rvm-sb-msg');
  if (status) {
    status.textContent = message;
    status.style.color = warning ? '#ffcf70' : '';
  }
}

function getDiagnostics() {
  const store = tagState.store || currentStore();
  return {
    version: VERSION,
    active: tagState.active,
    hasAnchor: Boolean(tagState.anchor),
    hasDraft: Boolean(tagState.draft),
    bundleId: tagState.storeKey,
    tagCount: store.getAllTags().length,
  };
}

function escapeHtml(value) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function injectStyles() {
  if (document.getElementById('rvm-tag-tools-style')) return;
  const style = document.createElement('style');
  style.id = 'rvm-tag-tools-style';
  style.textContent = `
    [data-rvm-viewer] .rvm-tag-toolbar{border-color:rgba(96,165,250,.22);}
    [data-rvm-viewer] .rvm-tags-panel{display:grid;gap:8px;min-width:0;}
    [data-rvm-viewer] .rvm-tags-head{display:flex;justify-content:space-between;align-items:flex-start;gap:8px;padding:8px;border:1px solid rgba(126,190,255,.16);border-radius:7px;background:rgba(15,23,42,.56);}
    [data-rvm-viewer] .rvm-tags-head strong{display:block;color:#e8f3ff;font-size:13px;}
    [data-rvm-viewer] .rvm-tags-head span{display:block;margin-top:2px;color:#8fa5c7;font-size:10px;}
    [data-rvm-viewer] .rvm-tag-capture-hint{padding:8px;border:1px dashed rgba(126,190,255,.20);border-radius:7px;color:#a8bdd8;background:rgba(8,15,27,.48);font-size:11px;}
    [data-rvm-viewer] .rvm-tag-capture-hint.is-active{color:#ffecb3;border-color:rgba(255,209,102,.42);background:rgba(47,36,24,.52);}
    [data-rvm-viewer] .rvm-tag-draft{display:grid;gap:8px;padding:8px;border:1px solid rgba(255,209,102,.28);border-radius:7px;background:rgba(47,36,24,.36);}
    [data-rvm-viewer] .rvm-tag-draft label{display:grid;gap:4px;color:#bfdbfe;font-size:11px;font-weight:700;}
    [data-rvm-viewer] .rvm-tag-draft textarea,[data-rvm-viewer] .rvm-tag-draft select{width:100%;box-sizing:border-box;border:1px solid rgba(126,190,255,.24);border-radius:6px;background:#08111c;color:#e8f3ff;padding:7px;font:12px/1.35 system-ui,sans-serif;}
    [data-rvm-viewer] .rvm-tag-draft small{color:#8fa5c7;font-size:10px;}
    [data-rvm-viewer] .rvm-tags-actions{display:flex;flex-wrap:wrap;gap:6px;}
    [data-rvm-viewer] .rvm-tags-actions .rvm-btn,[data-rvm-viewer] .rvm-tags-head .rvm-btn{min-height:24px;padding:4px 8px;border-radius:6px;font-size:11px;}
    [data-rvm-viewer] .rvm-tags-list{display:grid;gap:6px;}
    [data-rvm-viewer] .rvm-tag-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:6px;align-items:stretch;border:1px solid rgba(126,190,255,.16);border-left-width:3px;border-radius:7px;background:rgba(8,15,27,.74);overflow:hidden;}
    [data-rvm-viewer] .rvm-tag-row.severity-high{border-left-color:#ff4d4d;}
    [data-rvm-viewer] .rvm-tag-row.severity-warning{border-left-color:#ffd166;}
    [data-rvm-viewer] .rvm-tag-row.severity-info{border-left-color:#66c2ff;}
    [data-rvm-viewer] .rvm-tag-row>button{min-width:0;border:0;background:transparent;color:inherit;text-align:left;padding:8px;cursor:pointer;}
    [data-rvm-viewer] .rvm-tag-row>button:hover{background:rgba(59,130,246,.14);}
    [data-rvm-viewer] .rvm-tag-row-title{display:block;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#e8f3ff;font-size:12px;font-weight:800;}
    [data-rvm-viewer] .rvm-tag-row-meta{display:block;margin-top:3px;color:#9db4d4;font-size:10px;text-transform:uppercase;letter-spacing:.04em;}
    [data-rvm-viewer] .rvm-tag-delete{color:#fecaca!important;border-left:1px solid rgba(148,163,184,.12)!important;}
    [data-rvm-viewer] .rvm-btn.is-secondary{opacity:.8;background:#101827;}
  `;
  document.head.appendChild(style);
}
