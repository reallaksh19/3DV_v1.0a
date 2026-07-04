import * as THREE from 'three';

export function attachStagePreviewMeasureTool(rendererState, onReadout) {
  if (!rendererState || rendererState.measureTool) return rendererState?.measureTool;
  const canvas = rendererState.renderer.domElement;
  const group = new THREE.Group();
  group.name = 'STAGE_PREVIEW_MEASURE_GROUP';
  rendererState.scene.add(group);
  const tool = { active: false, points: [], group, onReadout };
  tool.onClick = (event) => {
    if (!tool.active) return;
    event.stopPropagation();
    const hit = pickPoint(rendererState, event.clientX, event.clientY);
    if (hit) addPoint(rendererState, tool, hit);
  };
  canvas.addEventListener('pointerup', tool.onClick);
  rendererState.measureTool = tool;
  return tool;
}

export function setStagePreviewMeasureActive(rendererState, active) {
  const tool = rendererState?.measureTool;
  if (!tool) return;
  tool.active = active;
  if (!active) clearMeasure(rendererState, tool);
}

export function detachStagePreviewMeasureTool(rendererState) {
  const tool = rendererState?.measureTool;
  if (!tool) return;
  rendererState.renderer.domElement.removeEventListener('pointerup', tool.onClick);
  clearMeasure(rendererState, tool);
  rendererState.scene.remove(tool.group);
  rendererState.measureTool = null;
}

function pickPoint(rendererState, clientX, clientY) {
  const bounds = rendererState.renderer.domElement.getBoundingClientRect();
  const pointer = new THREE.Vector2(
    ((clientX - bounds.left) / Math.max(bounds.width, 1)) * 2 - 1,
    -(((clientY - bounds.top) / Math.max(bounds.height, 1)) * 2 - 1),
  );
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(pointer, rendererState.camera);
  const hit = raycaster.intersectObjects(rendererState.rootGroup.children, true)[0];
  return hit?.point || null;
}

function addPoint(rendererState, tool, point) {
  tool.points.push(point.clone());
  addMarker(tool, point, rendererState);
  if (tool.points.length < 2) { tool.onReadout?.('Measure: select second point'); render(rendererState); return; }
  const [a, b] = tool.points;
  const distance = a.distanceTo(b);
  drawLine(tool, a, b);
  tool.onReadout?.(`Distance: ${distance.toFixed(2)} units (${(distance / 1000).toFixed(3)} m)`);
  tool.points = [];
  render(rendererState);
}

function addMarker(tool, point, rendererState) {
  const radius = Math.max((rendererState.cameraControls?.radius || 10) * 0.004, 0.05);
  const marker = new THREE.Mesh(new THREE.SphereGeometry(radius, 12, 8), new THREE.MeshBasicMaterial({ color: 0xfbbf24, depthTest: false }));
  marker.position.copy(point);
  marker.renderOrder = 50;
  tool.group.add(marker);
}

function drawLine(tool, a, b) {
  const geometry = new THREE.BufferGeometry().setFromPoints([a, b]);
  const line = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: 0xfbbf24, depthTest: false }));
  line.renderOrder = 50;
  tool.group.add(line);
}

function clearMeasure(rendererState, tool) {
  tool.points = [];
  for (const child of [...tool.group.children]) {
    child.geometry?.dispose?.();
    child.material?.dispose?.();
    tool.group.remove(child);
  }
  render(rendererState);
}

function render(rendererState) {
  rendererState.renderer.render(rendererState.scene, rendererState.camera);
}
