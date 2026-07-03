import * as THREE from 'three';

/**
 * Stage JSON preview tag overlay helpers.
 * Parameters: renderer state plus saved and draft tag records with world-space anchor/label points.
 * Outputs: leader lines, anchor markers, and sprite labels in the Three.js scene.
 * Fallback: invalid points are skipped so malformed imported tags do not break rendering.
 */

const SEVERITY_COLORS = { info: 0x60a5fa, warning: 0xf59e0b, high: 0xef4444, draft: 0x22c55e };

export function renderStagePreviewTags(rendererState, tags, draft) {
  if (!rendererState?.scene) return;
  const group = ensureTagGroup(rendererState);
  clearGroup(group);
  for (const tag of tags || []) if (!tag.hidden) addTagObject(group, tag, tag.severity || 'info');
  if (draft?.anchor && draft?.labelPoint) addTagObject(group, { id: 'draft', text: 'Draft tag', anchor: draft.anchor, labelPoint: draft.labelPoint }, 'draft');
}

export function disposeStagePreviewTags(rendererState) {
  clearGroup(rendererState?.tagGroup);
}

export function tagOverlaySummary(tags, draft) {
  const count = Array.isArray(tags) ? tags.length : 0;
  const hidden = Array.isArray(tags) ? tags.filter((tag) => tag.hidden).length : 0;
  const suffix = hidden ? `, ${hidden} hidden` : '';
  return draft ? `${count} saved${suffix}, 1 draft` : `${count} saved${suffix}`;
}

function ensureTagGroup(rendererState) {
  if (rendererState.tagGroup?.parent) return rendererState.tagGroup;
  rendererState.tagGroup = new THREE.Group();
  rendererState.tagGroup.name = 'STAGE_JSON_TAGS';
  rendererState.tagGroup.userData = { ignoreBounds: true, stageTagHelper: true };
  rendererState.scene.add(rendererState.tagGroup);
  return rendererState.tagGroup;
}

function addTagObject(group, tag, severity) {
  const anchor = vectorFromPoint(tag.anchor);
  const labelPoint = vectorFromPoint(tag.labelPoint);
  if (!anchor || !labelPoint) return;
  const color = SEVERITY_COLORS[severity] || SEVERITY_COLORS.info;
  const geometry = new THREE.BufferGeometry().setFromPoints([anchor, labelPoint]);
  const line = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.95 }));
  line.userData = helperData(tag);
  const marker = new THREE.Mesh(new THREE.SphereGeometry(markerSize(anchor, labelPoint), 12, 8), new THREE.MeshBasicMaterial({ color }));
  marker.position.copy(anchor);
  marker.userData = helperData(tag);
  const label = labelSprite(tag.text || tag.id || 'Tag', color);
  label.position.copy(labelPoint);
  label.userData = helperData(tag);
  group.add(line, marker, label);
}

function labelSprite(text, color) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const label = String(text).slice(0, 80);
  const width = Math.max(160, Math.min(360, label.length * 8 + 34));
  canvas.width = width;
  canvas.height = 54;
  ctx.fillStyle = 'rgba(8, 13, 23, 0.92)';
  roundRect(ctx, 0, 0, canvas.width, canvas.height, 8);
  ctx.fill();
  ctx.strokeStyle = `#${color.toString(16).padStart(6, '0')}`;
  ctx.lineWidth = 3;
  roundRect(ctx, 1.5, 1.5, canvas.width - 3, canvas.height - 3, 8);
  ctx.stroke();
  ctx.fillStyle = '#f8fafc';
  ctx.font = '700 18px system-ui, Segoe UI, Arial';
  ctx.fillText(label, 16, 34);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false }));
  sprite.scale.set(canvas.width * 0.012, canvas.height * 0.012, 1);
  sprite.renderOrder = 30;
  return sprite;
}

function roundRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
}

function clearGroup(group) {
  if (!group) return;
  while (group.children.length) {
    const child = group.children.pop();
    child.parent = null;
    child.geometry?.dispose?.();
    if (Array.isArray(child.material)) child.material.forEach((material) => disposeMaterial(material));
    else disposeMaterial(child.material);
  }
}

function disposeMaterial(material) {
  material?.map?.dispose?.();
  material?.dispose?.();
}

function vectorFromPoint(point) {
  const x = Number(point?.x);
  const y = Number(point?.y);
  const z = Number(point?.z);
  return [x, y, z].every(Number.isFinite) ? new THREE.Vector3(x, y, z) : null;
}

function markerSize(anchor, labelPoint) {
  return Math.max(anchor.distanceTo(labelPoint) * 0.025, 0.15);
}

function helperData(tag) {
  return { ignoreBounds: true, stageTagHelper: true, tagId: tag.id || '' };
}
