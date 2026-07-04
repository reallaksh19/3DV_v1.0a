import * as THREE from 'three';
import { collectObjectsForRef } from './StagePreviewVisibilityTools.js';

/**
 * Stage JSON preview clip helpers.
 * Parameters: renderer state, StageModel, selected ref, and clip state commands.
 * Outputs: renderer clipping planes plus visual box/plane helper overlays.
 * Fallback: invalid bounds clear clipping and report an inactive/off state.
 */

export function createStageClipState() {
  return { mode: 'off', axis: 'x', percent: 50, inverted: false, box: null, source: 'off' };
}

export function createNextClipState(clip, command, context) {
  const next = { ...clip, box: cloneBbox(clip?.box) };
  if (command === 'clear') return createStageClipState();
  if (command === 'axis') next.axis = validAxis(context?.value);
  if (command === 'percent') next.percent = clampPercent(context?.value);
  if (command === 'invert') next.inverted = Boolean(context?.value);
  if (command === 'plane') {
    next.mode = 'plane';
    next.source = `plane ${validAxis(next.axis).toUpperCase()}`;
  }
  if (command === 'box-selection' || command === 'box-model') {
    const box = command === 'box-selection'
      ? boxForObjects(collectObjectsForRef(context?.rendererState, context?.model, context?.selectedRef))
      : boxFromBbox(context?.rendererState?.currentBbox);
    if (!box) return next;
    next.mode = 'box';
    next.box = bboxFromBox(box);
    next.source = command === 'box-selection' ? 'selection box' : 'model box';
  }
  return next;
}

export function applyStagePreviewClip(rendererState, clip) {
  if (!rendererState?.renderer) return { active: false, summary: 'Clip: off' };
  clearClipHelpers(rendererState);
  rendererState.renderer.localClippingEnabled = true;
  rendererState.renderer.clippingPlanes = [];
  const box = activeBox(rendererState, clip);
  if (clip?.mode === 'box' && box) {
    rendererState.renderer.clippingPlanes = planesForBox(box);
    addClipHelper(rendererState, new THREE.Box3Helper(box, 0xfbbf24));
    return { active: true, summary: `Clip: ${clip.source}` };
  }
  if (clip?.mode === 'plane' && box) {
    const plane = planeForBox(box, validAxis(clip.axis), clampPercent(clip.percent), Boolean(clip.inverted));
    rendererState.renderer.clippingPlanes = [plane];
    addClipHelper(rendererState, planeHelperForBox(box, plane, validAxis(clip.axis), clampPercent(clip.percent)));
    return { active: true, summary: `Clip: ${validAxis(clip.axis).toUpperCase()} ${clampPercent(clip.percent)}%${clip.inverted ? ' inverted' : ''}` };
  }
  return { active: false, summary: 'Clip: off' };
}

export function disposeStagePreviewClip(rendererState) {
  clearClipHelpers(rendererState);
  if (rendererState?.renderer) rendererState.renderer.clippingPlanes = [];
}

export function clipSummary(clip) {
  if (!clip || clip.mode === 'off') return 'Clip: off';
  if (clip.mode === 'box') return `Clip: ${clip.source || 'box'}`;
  return `Clip: ${validAxis(clip.axis).toUpperCase()} plane at ${clampPercent(clip.percent)}%`;
}

function ensureClipGroup(rendererState) {
  if (rendererState.clipGroup?.parent) return rendererState.clipGroup;
  rendererState.clipGroup = new THREE.Group();
  rendererState.clipGroup.name = 'STAGE_JSON_CLIP_HELPERS';
  rendererState.clipGroup.userData = { ignoreBounds: true, stageClipHelper: true };
  rendererState.scene.add(rendererState.clipGroup);
  return rendererState.clipGroup;
}

function addClipHelper(rendererState, helper) {
  helper.traverse(obj => {
    if (obj.material) obj.material.clippingPlanes = [];
  });
  ensureClipGroup(rendererState).add(helper);
}

function clearClipHelpers(rendererState) {
  const group = rendererState?.clipGroup;
  if (!group) return;
  while (group.children.length) {
    const child = group.children.pop();
    child.parent = null;
    child.geometry?.dispose?.();
    if (Array.isArray(child.material)) child.material.forEach((material) => material.dispose?.());
    else child.material?.dispose?.();
  }
}

function activeBox(rendererState, clip) {
  return clip?.box ? boxFromBbox(clip.box) : boxFromBbox(rendererState?.currentBbox);
}

function boxForObjects(objects) {
  const box = new THREE.Box3();
  let found = false;
  for (const object of objects || []) {
    const itemBox = new THREE.Box3().setFromObject(object);
    if (!itemBox.isEmpty()) {
      box.union(itemBox);
      found = true;
    }
  }
  return found ? box : null;
}

function boxFromBbox(bbox) {
  if (!Array.isArray(bbox) || bbox.length !== 6 || !bbox.every(Number.isFinite)) return null;
  return new THREE.Box3(new THREE.Vector3(bbox[0], bbox[1], bbox[2]), new THREE.Vector3(bbox[3], bbox[4], bbox[5]));
}

function bboxFromBox(box) {
  return [box.min.x, box.min.y, box.min.z, box.max.x, box.max.y, box.max.z];
}

function cloneBbox(bbox) {
  return Array.isArray(bbox) ? [...bbox] : null;
}

function planesForBox(box) {
  return [
    new THREE.Plane(new THREE.Vector3(1, 0, 0), -box.min.x),
    new THREE.Plane(new THREE.Vector3(-1, 0, 0), box.max.x),
    new THREE.Plane(new THREE.Vector3(0, 1, 0), -box.min.y),
    new THREE.Plane(new THREE.Vector3(0, -1, 0), box.max.y),
    new THREE.Plane(new THREE.Vector3(0, 0, 1), -box.min.z),
    new THREE.Plane(new THREE.Vector3(0, 0, -1), box.max.z),
  ];
}

function planeForBox(box, axis, percent, inverted) {
  const min = box.min[axis];
  const max = box.max[axis];
  const cut = min + (max - min) * (percent / 100);
  const normal = new THREE.Vector3(axis === 'x' ? 1 : 0, axis === 'y' ? 1 : 0, axis === 'z' ? 1 : 0);
  if (inverted) normal.negate();
  return new THREE.Plane(normal, inverted ? cut : -cut);
}

function planeHelperForBox(box, plane, axis, percent) {
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const cut = box.min[axis] + (box.max[axis] - box.min[axis]) * (percent / 100);
  const geometry = axis === 'x'
    ? new THREE.PlaneGeometry(Math.max(size.z, 0.001), Math.max(size.y, 0.001))
    : new THREE.PlaneGeometry(Math.max(size.x, 0.001), Math.max(axis === 'y' ? size.z : size.y, 0.001));
  const material = new THREE.MeshBasicMaterial({ color: 0xfbbf24, transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'STAGE_JSON_CLIP_PLANE';
  mesh.renderOrder = 20;
  mesh.userData = { ignoreBounds: true, stageClipHelper: true, planeConstant: plane.constant };
  if (axis === 'x') {
    mesh.rotation.y = Math.PI / 2;
    mesh.position.set(cut, center.y, center.z);
  } else if (axis === 'y') {
    mesh.rotation.x = Math.PI / 2;
    mesh.position.set(center.x, cut, center.z);
  } else {
    mesh.position.set(center.x, center.y, cut);
  }
  return mesh;
}

function validAxis(value) {
  return ['x', 'y', 'z'].includes(value) ? value : 'x';
}

function clampPercent(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 50;
  return Math.min(100, Math.max(0, number));
}
