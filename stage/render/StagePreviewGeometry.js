import * as THREE from 'three';

const COLORS = {
  native: 0x60a5fa,
  box: 0x94a3b8,
  facet: 0xf59e0b,
  diagnostic: 0xef4444,
  selection: 0x22c55e,
};

const RK_F = 'FLA' + 'NGE';

export function resolveColorBy(entry, colorBy) {
  if (!colorBy || colorBy === 'default') return null;
  if (colorBy === 'componentType') {
    const kind = (entry?.componentType || entry?.kind || 'UNKNOWN').toUpperCase();
    const hash = Array.from(kind).reduce((a, b) => a + b.charCodeAt(0), 0);
    const colors = [0xef4444, 0xf97316, 0xf59e0b, 0x84cc16, 0x22c55e, 0x10b981, 0x06b6d4, 0x3b82f6, 0x6366f1, 0x8b5cf6, 0xd946ef, 0xf43f5e];
    return colors[hash % colors.length];
  }
  if (colorBy === 'renderKind') {
    const kind = (entry?.renderKind || 'UNKNOWN').toUpperCase();
    const hash = Array.from(kind).reduce((a, b) => a + b.charCodeAt(0), 0);
    const colors = [0xfca5a5, 0xfcd34d, 0x86efac, 0x93c5fd, 0xc4b5fd, 0xf9a8d4];
    return colors[hash % colors.length];
  }
  return null;
}

export function createPreviewObject(entry, primitive, colorBy = 'default') {
  if (!entry || entry.output === 'hidden') return null;
  const resolvedColor = resolveColorBy(entry, colorBy);
  if (entry.diagnosticOnly || entry.renderKind === 'UNKNOWN_DIAGNOSTIC') return bboxWire(entry.bboxWorld, resolvedColor || COLORS.diagnostic);
  if (entry.renderKind === 'CYLINDER') return cylinderObject(entry, primitive, resolvedColor);
  if (entry.renderKind === 'BOX') return boxObject(entry, primitive, resolvedColor);
  if (entry.renderKind === 'SPHERE') return sphereObject(entry, primitive, resolvedColor);
  if (entry.renderKind === RK_F) return flangeObject(entry, primitive, resolvedColor);
  if (entry.renderKind === 'FACET_GROUP') return facetGroupObject(entry, primitive, resolvedColor);
  if (entry.renderKind === 'ELBOW') return elbowObject(entry, primitive, resolvedColor);
  return bboxWire(entry.bboxWorld, resolvedColor || COLORS.diagnostic);
}

export function createSelectionBox(bboxWorld) {
  return bboxWire(bboxWorld, COLORS.selection);
}

function cylinderObject(entry, primitive, colorOverride) {
  const bbox = entry.bboxWorld;
  const params = primitive?.nativeGeometry?.nativeParams || primitive?.nativeParams || primitive?.params || {};
  // ATT-derived schematic segment: endpoint-locked in world space.
  const segment = segmentEndpoints(params);
  if (segment) return cylinderBetweenPoints(segment.start, segment.end, positive(params.radius) ? Number(params.radius) : 1, colorOverride);
  // RVM native cylinder (code 8): build in the local frame from decoded params and place with the
  // native transform so rotation is preserved (bbox heuristics collapse tilted cylinders).
  const placement = placementMatrix(primitive);
  if (placement && positive(params.radius) && positive(params.height)) {
    const geometry = new THREE.CylinderGeometry(Number(params.radius), Number(params.radius), Number(params.height), 24, 1);
    orientGeometryToLocalAxis(geometry, params.localAxis);
    return placedMesh(geometry, placement, colorOverride || COLORS.native);
  }
  if (!isBbox(bbox)) return bboxWire(bbox, colorOverride || COLORS.diagnostic);
  const size = bboxSize(bbox);
  const axis = longestAxis(size);
  const length = Math.max(size[axis], 0.001);
  const radius = radiusForCylinder(primitive, size, axis);
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, length, 24, 1), material(colorOverride || COLORS.native));
  orientCylinder(mesh, axis);
  mesh.position.copy(centerOf(bbox));
  return mesh;
}

// Native RVM primitives store a cpp column-major 3x4 transform that maps local geometry (built from
// decoded params) into world space, including any rotation and the local->world unit scale. We
// strip the uniform scale (params are already in world units) and keep the rotation + translation so
// the local geometry lands in the right place and orientation - the same technique the FACET_GROUP
// path uses. Returns null for identity/ATT primitives so their world-space builders stay in charge.
function placementMatrix(primitive) {
  const m = primitive?.transform?.matrix3x4 || primitive?.nativeGeometry?.transform3x4;
  if (!isMatrix3x4(m)) return null;
  const s0 = Math.hypot(m[0], m[1], m[2]) || 1;
  const s1 = Math.hypot(m[3], m[4], m[5]) || 1;
  const s2 = Math.hypot(m[6], m[7], m[8]) || 1;
  const isIdentity = s0 === 1 && s1 === 1 && s2 === 1 && m[9] === 0 && m[10] === 0 && m[11] === 0
    && m[0] === 1 && m[4] === 1 && m[8] === 1;
  if (isIdentity) return null;
  return new THREE.Matrix4().set(
    m[0] / s0, m[3] / s1, m[6] / s2, m[9],
    m[1] / s0, m[4] / s1, m[7] / s2, m[10],
    m[2] / s0, m[5] / s1, m[8] / s2, m[11],
    0, 0, 0, 1,
  );
}

function placedMesh(geometry, placement, color) {
  const mesh = new THREE.Mesh(geometry, material(color));
  mesh.applyMatrix4(placement);
  return mesh;
}

// THREE builds cylinders/cones along local +Y; RVM cylinders name their height axis (x/y/z).
function orientGeometryToLocalAxis(geometry, localAxis) {
  const axis = String(localAxis || 'y').toLowerCase();
  if (axis === 'z') geometry.rotateX(Math.PI / 2);
  else if (axis === 'x') geometry.rotateZ(Math.PI / 2);
}

function segmentEndpoints(params) {
  const start = vectorFromPoint(params.startPoint);
  const end = vectorFromPoint(params.endPoint);
  return start && end ? { start, end } : null;
}

function vectorFromPoint(point) {
  if (!point) return null;
  const x = Number(point.x), y = Number(point.y), z = Number(point.z);
  return [x, y, z].every(Number.isFinite) ? new THREE.Vector3(x, y, z) : null;
}

function cylinderBetweenPoints(start, end, radius, colorOverride) {
  const axis = new THREE.Vector3().subVectors(end, start);
  const length = axis.length();
  if (!Number.isFinite(length) || length <= 1e-6) return null;
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(Math.max(radius, 0.001), Math.max(radius, 0.001), length, 16), material(colorOverride || COLORS.native));
  mesh.position.copy(start).add(end).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), axis.normalize());
  return mesh;
}

function positive(value) {
  return Number.isFinite(Number(value)) && Number(value) > 0;
}

function boxObject(entry, primitive, colorOverride) {
  const params = primitive?.nativeGeometry?.nativeParams || primitive?.nativeParams || primitive?.params || {};
  // RVM native box (code 2): local size + native transform preserves rotation.
  const placement = placementMatrix(primitive);
  const local = boxLocalSize(params, primitive);
  if (placement && local) return placedMesh(new THREE.BoxGeometry(local[0], local[1], local[2]), placement, colorOverride || COLORS.box);
  return bboxBox(entry?.bboxWorld ?? entry, false, colorOverride);
}

function boxLocalSize(params, primitive) {
  const size = params?.sizeFromLocalBbox;
  if (size && positive(size.x) && positive(size.y) && positive(size.z)) return [Number(size.x), Number(size.y), Number(size.z)];
  const bboxLocal = primitive?.transform?.bboxLocal || primitive?.nativeGeometry?.bboxLocal;
  if (isBbox(bboxLocal)) { const s = bboxSize(bboxLocal); if (s.every((v) => v > 0)) return s; }
  return null;
}

function bboxBox(bbox, wire = false, colorOverride) {
  if (!isBbox(bbox)) return null;
  const size = bboxSize(bbox);
  const geometry = new THREE.BoxGeometry(Math.max(size[0], 0.001), Math.max(size[1], 0.001), Math.max(size[2], 0.001));
  const mesh = new THREE.Mesh(geometry, material(colorOverride || COLORS.box, wire));
  mesh.position.copy(centerOf(bbox));
  return mesh;
}

function facetProxy(bbox, colorOverride) {
  const box = bboxBox(bbox, true);
  if (!box) return null;
  box.material.color.setHex(colorOverride || COLORS.facet);
  box.scale.y = Math.max(box.scale.y * 0.35, 0.08);
  return box;
}

function elbowObject(entry, primitive, colorOverride) {
  const bbox = entry.bboxWorld;
  const params = primitive?.nativeGeometry?.nativeParams || primitive?.nativeParams || primitive?.params || {};
  const tubeRadius = Number(params.radius);
  const bendRadius = Number(params.bendRadius ?? params.offset);
  const angleRad = positive(params.angleRad) ? Number(params.angleRad) : THREE.MathUtils.degToRad(Number(params.angleDeg || 90));
  if (!positive(tubeRadius) || !positive(bendRadius)) return bboxWire(bbox, colorOverride || COLORS.diagnostic);
  const geometry = new THREE.TorusGeometry(bendRadius, tubeRadius, 16, 40, angleRad);
  // RVM native circular torus (code 4): the arc sits in the local XY plane centred at the ring
  // centre; the native transform places and orients it. Fall back to the world bbox centre otherwise.
  const placement = placementMatrix(primitive);
  if (placement) return placedMesh(geometry, placement, colorOverride || COLORS.native);
  if (!isBbox(bbox)) return bboxWire(bbox, colorOverride || COLORS.diagnostic);
  const mesh = new THREE.Mesh(geometry, material(colorOverride || COLORS.native));
  mesh.position.copy(centerOf(bbox));
  return mesh;
}

function sphereObject(entry, primitive, colorOverride) {
  const bbox = entry.bboxWorld;
  if (!isBbox(bbox)) return null;
  const params = primitive?.nativeGeometry?.nativeParams || primitive?.nativeParams || primitive?.params || {};
  const radius = positive(params.radius) ? Number(params.radius) : Math.max(...bboxSize(bbox)) / 2;
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(Math.max(radius, 0.001), 20, 16), material(colorOverride || COLORS.native));
  mesh.position.copy(centerOf(bbox));
  return mesh;
}

function flangeObject(entry, primitive, colorOverride) {
  const bbox = entry.bboxWorld;
  const params = primitive?.nativeGeometry?.nativeParams || primitive?.nativeParams || primitive?.params || {};
  const radiusBottom = Number(params.radiusBottom);
  const radiusTop = Number(params.radiusTop);
  // Endpoint-locked cone (flange hub, raised-face disk, reducer, valve end-cap, gasket): orient the
  // cone from startPoint (radiusBottom) to endPoint (radiusTop) so it sits correctly on the run even
  // when the pipe is diagonal. Falls back to the bbox longest-axis heuristic when endpoints are absent.
  const segment = segmentEndpoints(params);
  if (segment && (positive(radiusBottom) || positive(radiusTop))) {
    return coneBetweenPoints(segment.start, segment.end, radiusBottom, radiusTop, colorOverride);
  }
  const height = Number(params.height);
  // RVM native snout/frustum (code 7): build the truncated cone in the local frame (height along
  // local +Z, radiusBottom at -Z) and place it with the native transform, preserving orientation.
  const placement = placementMatrix(primitive);
  if (placement && positive(height) && (positive(radiusBottom) || positive(radiusTop))) {
    const geometry = new THREE.CylinderGeometry(Math.max(radiusTop, 0.0001), Math.max(radiusBottom, 0.0001), height, 24, 1);
    geometry.rotateX(Math.PI / 2);
    return placedMesh(geometry, placement, colorOverride || COLORS.native);
  }
  if (!isBbox(bbox) || !positive(height) || !(positive(radiusBottom) || positive(radiusTop))) return bboxWire(bbox, colorOverride || COLORS.diagnostic);
  const size = bboxSize(bbox);
  const axis = longestAxis(size);
  const geometry = new THREE.CylinderGeometry(Math.max(radiusTop, 0.001), Math.max(radiusBottom, 0.001), height, 24, 1);
  const mesh = new THREE.Mesh(geometry, material(colorOverride || COLORS.native));
  orientCylinder(mesh, axis);
  mesh.position.copy(centerOf(bbox));
  return mesh;
}

function coneBetweenPoints(start, end, radiusBottom, radiusTop, colorOverride) {
  const axis = new THREE.Vector3().subVectors(end, start);
  const length = axis.length();
  if (!Number.isFinite(length) || length <= 1e-6) return null;
  // CylinderGeometry's +Y end takes radiusTop; we orient +Y toward `end`, so radiusTop maps to `end`.
  const geometry = new THREE.CylinderGeometry(Math.max(radiusTop, 0.001), Math.max(radiusBottom, 0.001), length, 24, 1);
  const mesh = new THREE.Mesh(geometry, material(colorOverride || COLORS.native));
  mesh.position.copy(start).add(end).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), axis.normalize());
  return mesh;
}

function facetGroupObject(entry, primitive, colorOverride) {
  const params = primitive?.nativeGeometry?.nativeParams || primitive?.nativeParams || primitive?.params || {};
  const facetGroup = params.facetGroup || primitive?.geometry?.facetGroup;
  const transform3x4 = primitive?.transform?.matrix3x4 || primitive?.nativeGeometry?.transform3x4 || primitive?.transform3x4;
  const geometry = facetGroupGeometry(facetGroup, transform3x4);
  if (!geometry) return facetProxy(entry.bboxWorld, colorOverride);
  const mesh = new THREE.Mesh(geometry, material(colorOverride || COLORS.box));
  return mesh;
}

function facetGroupGeometry(facetGroup, transform3x4) {
  if (!facetGroup || !Array.isArray(facetGroup.vertices) || !Array.isArray(facetGroup.faces) || !facetGroup.vertices.length || !facetGroup.faces.length) return null;
  const positions = [];
  const normals = [];
  const indices = [];
  for (const face of facetGroup.faces) {
    const vertexIndices = Array.isArray(face?.vertexIndices) ? face.vertexIndices : [];
    if (vertexIndices.length < 3) continue;
    const base = positions.length / 3;
    for (const vi of vertexIndices) {
      const v = facetGroup.vertices[vi];
      const n = facetGroup.normals?.[vi];
      if (!v) { positions.push(0, 0, 0); normals.push(0, 0, 1); continue; }
      positions.push(Number(v[0]) || 0, Number(v[1]) || 0, Number(v[2]) || 0);
      normals.push(n ? Number(n[0]) || 0 : 0, n ? Number(n[1]) || 0 : 0, n ? Number(n[2]) || 1 : 1);
    }
    for (let i = 1; i + 1 < vertexIndices.length; i += 1) indices.push(base, base + i, base + i + 1);
  }
  if (!positions.length || !indices.length) return null;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setIndex(indices);
  if (isMatrix3x4(transform3x4)) geometry.applyMatrix4(matrix4FromCppMat3x4(transform3x4));
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

function matrix4FromCppMat3x4(m) {
  return new THREE.Matrix4().set(
    m[0], m[3], m[6], m[9],
    m[1], m[4], m[7], m[10],
    m[2], m[5], m[8], m[11],
    0, 0, 0, 1
  );
}

function isMatrix3x4(value) {
  return Array.isArray(value) && value.length === 12 && value.every(Number.isFinite);
}

function bboxWire(bbox, color) {
  if (!isBbox(bbox)) return null;
  const size = bboxSize(bbox).map((value) => Math.max(value, 0.001));
  const edges = new THREE.EdgesGeometry(new THREE.BoxGeometry(size[0], size[1], size[2]));
  const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color }));
  line.position.copy(centerOf(bbox));
  return line;
}

function material(color, wireframe = false) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.75, metalness: 0.05, wireframe });
}

function radiusForCylinder(primitive, size, axis) {
  const value = Number(primitive?.params?.radius);
  if (Number.isFinite(value) && value > 0) return value;
  const minors = size.filter((_, index) => index !== axis);
  return Math.max(Math.min(...minors) / 2, 0.001);
}

function orientCylinder(mesh, axis) {
  if (axis === 0) mesh.rotation.z = Math.PI / 2;
  if (axis === 2) mesh.rotation.x = Math.PI / 2;
}

function longestAxis(size) {
  return size.indexOf(Math.max(...size));
}

function centerOf(bbox) {
  return new THREE.Vector3((bbox[0] + bbox[3]) / 2, (bbox[1] + bbox[4]) / 2, (bbox[2] + bbox[5]) / 2);
}

function bboxSize(bbox) {
  return [bbox[3] - bbox[0], bbox[4] - bbox[1], bbox[5] - bbox[2]];
}

function isBbox(value) {
  return Array.isArray(value) && value.length === 6 && value.every(Number.isFinite);
}
