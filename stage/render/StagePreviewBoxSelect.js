import * as THREE from 'three';
import { makeStageSelectionRefFromObject } from './StagePreviewPicking.js';

/**
 * Functionality: box-selects visible Stage preview objects by projected bounds.
 * Parameters: renderer state and a callback receiving selected Stage refs.
 * Outputs: a marquee rectangle plus a unique ref list for multi-selection.
 * Fallback: tiny drags or empty rectangles return no refs without errors.
 */

export function attachStagePreviewBoxSelect(rendererState, onSelectRefs) {
  if (!rendererState || rendererState.boxSelect) return rendererState?.boxSelect;
  const canvas = rendererState.renderer.domElement;
  const rectEl = document.createElement('div');
  rectEl.className = 'json-viewer-box-select-rect';
  rectEl.hidden = true;
  rendererState.canvasHost.appendChild(rectEl);
  const state = { active: false, dragging: false, startX: 0, startY: 0, rectEl, onSelectRefs };
  state.onPointerDown = (event) => startBoxSelect(event, canvas, state);
  state.onPointerMove = (event) => { if (state.dragging) updateRect(state, event.clientX, event.clientY); };
  state.onPointerUp = (event) => finishBoxSelect(event, rendererState, state);
  canvas.addEventListener('pointerdown', state.onPointerDown);
  canvas.addEventListener('pointermove', state.onPointerMove);
  canvas.addEventListener('pointerup', state.onPointerUp);
  rendererState.boxSelect = state;
  return state;
}

export function setStagePreviewBoxSelectActive(rendererState, active) {
  const state = rendererState?.boxSelect;
  if (!state) return;
  state.active = Boolean(active);
  rendererState.renderer.domElement.classList.toggle('mode-box-select', Boolean(active));
  if (!active) { state.dragging = false; state.rectEl.hidden = true; }
}

export function detachStagePreviewBoxSelect(rendererState) {
  const state = rendererState?.boxSelect;
  if (!state) return;
  const canvas = rendererState.renderer.domElement;
  canvas.removeEventListener('pointerdown', state.onPointerDown);
  canvas.removeEventListener('pointermove', state.onPointerMove);
  canvas.removeEventListener('pointerup', state.onPointerUp);
  state.rectEl.remove();
  rendererState.boxSelect = null;
}

function startBoxSelect(event, canvas, state) {
  if (!state.active) return;
  event.preventDefault();
  state.dragging = true;
  state.startX = event.clientX;
  state.startY = event.clientY;
  updateRect(state, event.clientX, event.clientY);
  state.rectEl.hidden = false;
  canvas.setPointerCapture?.(event.pointerId);
}

function finishBoxSelect(event, rendererState, state) {
  if (!state.dragging) return;
  state.dragging = false;
  state.rectEl.hidden = true;
  const refs = collectRefsInDrag(rendererState, state, event.clientX, event.clientY);
  if (refs.length) state.onSelectRefs?.(refs);
}

function updateRect(state, x, y) {
  const left = Math.min(state.startX, x), top = Math.min(state.startY, y);
  const width = Math.abs(x - state.startX), height = Math.abs(y - state.startY);
  const hostBounds = state.rectEl.parentElement.getBoundingClientRect();
  Object.assign(state.rectEl.style, { left: `${left - hostBounds.left}px`, top: `${top - hostBounds.top}px`, width: `${width}px`, height: `${height}px` });
}

function collectRefsInDrag(rendererState, state, endX, endY) {
  const width = Math.abs(endX - state.startX), height = Math.abs(endY - state.startY);
  if (width < 6 || height < 6) return [];
  const left = Math.min(state.startX, endX), top = Math.min(state.startY, endY);
  return collectRefsInRect(rendererState, { left, top, right: left + width, bottom: top + height });
}

function collectRefsInRect(rendererState, rect) {
  const bounds = rendererState.renderer.domElement.getBoundingClientRect();
  const refs = new Map();
  rendererState.rootGroup.traverse((object) => {
    if ((!object.isMesh && !object.isLine && !object.isLineSegments) || object.visible === false) return;
    const box = new THREE.Box3().setFromObject(object);
    if (box.isEmpty() || !boxProjectsIntoRect(box, rendererState.camera, bounds, rect)) return;
    const ref = makeStageSelectionRefFromObject(object);
    if (ref) refs.set(`${ref.type}:${ref.id}`, ref);
  });
  return Array.from(refs.values());
}

function boxProjectsIntoRect(box, camera, bounds, rect) {
  return boxCorners(box).map((corner) => projectToScreen(corner, camera, bounds))
    .some((point) => point.x >= rect.left && point.x <= rect.right && point.y >= rect.top && point.y <= rect.bottom);
}

function boxCorners(box) {
  const { min, max } = box;
  return [
    new THREE.Vector3(min.x, min.y, min.z), new THREE.Vector3(max.x, min.y, min.z),
    new THREE.Vector3(min.x, max.y, min.z), new THREE.Vector3(max.x, max.y, min.z),
    new THREE.Vector3(min.x, min.y, max.z), new THREE.Vector3(max.x, min.y, max.z),
    new THREE.Vector3(min.x, max.y, max.z), new THREE.Vector3(max.x, max.y, max.z),
  ];
}

function projectToScreen(point, camera, bounds) {
  const projected = point.clone().project(camera);
  return { x: bounds.left + (projected.x * 0.5 + 0.5) * bounds.width, y: bounds.top + (1 - (projected.y * 0.5 + 0.5)) * bounds.height };
}
