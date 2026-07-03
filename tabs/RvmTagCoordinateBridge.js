import * as THREE from 'three';
import { RvmTagXmlStore } from '../rvm/RvmTagXmlStore.js';

const VERSION = '20260630-rvm-tag-coordinate-bridge-1';
const GLOBAL_KEY = '__PCF_GLB_RVM_TAG_COORDINATE_BRIDGE__';
const PATCH_KEY = '__rvmTagCoordinateBridgePatched__';
const RAW_MODE_KEY = '__rvmTagCoordinateBridgeRawMode__';
const ROOT_SELECTOR = '[data-rvm-viewer]';

/**
 * Keeps Navis XML tag data in native RVM/Navis model coordinates while the
 * browser renders the Z-up RVM through a Three.js scene-space modelGroup
 * transform. The tag UI continues to consume scene-space copies through
 * getTag()/getAllTags(); exportToXml() receives the raw native values.
 */
export function installRvmTagCoordinateBridge() {
  if (typeof document === 'undefined') return null;
  const existing = globalThis[GLOBAL_KEY];
  if (existing?.version === VERSION) return existing;

  patchRvmTagStorePrototype();

  const api = {
    version: VERSION,
    scenePointToNativeRvm,
    nativeRvmPointToScene,
    getDiagnostics,
  };
  globalThis[GLOBAL_KEY] = api;
  refreshRootDiagnostics('install');
  globalThis.addEventListener?.('rvm-model-loaded', () => refreshRootDiagnostics('model-loaded'));
  return api;
}

function patchRvmTagStorePrototype() {
  const proto = RvmTagXmlStore?.prototype;
  if (!proto || proto[PATCH_KEY]) return;

  const originalCreateTag = proto.createTag;
  const originalGetAllTags = proto.getAllTags;
  const originalGetTag = proto.getTag;
  const originalExportToXml = proto.exportToXml;
  const originalPersist = proto._persist;

  if (typeof originalPersist === 'function') {
    proto._persist = function persistRawTagCoordinates() {
      this[RAW_MODE_KEY] = true;
      try {
        return originalPersist.call(this);
      } finally {
        this[RAW_MODE_KEY] = false;
      }
    };
  }

  proto.createTag = function createTagWithNativeCoordinates(config = {}) {
    return originalCreateTag.call(this, normalizeManualTagConfig(config));
  };

  proto.getAllTags = function getSceneDisplayTags() {
    const tags = originalGetAllTags.call(this);
    if (this[RAW_MODE_KEY]) return tags;
    return tags.map((tag) => tagForSceneDisplay(tag));
  };

  proto.getTag = function getSceneDisplayTag(id) {
    const tag = originalGetTag.call(this, id);
    if (this[RAW_MODE_KEY]) return tag;
    return tagForSceneDisplay(tag);
  };

  proto.exportToXml = function exportNativeNavisXml() {
    this[RAW_MODE_KEY] = true;
    try {
      const xml = originalExportToXml.call(this);
      const rawTags = Array.from(this.tags?.values?.() || []);
      return injectNativeNavisXmlData(xml, rawTags);
    } finally {
      this[RAW_MODE_KEY] = false;
    }
  };

  Object.defineProperty(proto, PATCH_KEY, { value: true, enumerable: false });
}

function normalizeManualTagConfig(config = {}) {
  const viewer = currentViewer();
  if (!viewer || !isSceneManualTagConfig(config)) return config;

  const anchorScene = vectorFrom(config.worldPosition || config.navis?.redline?.pos3d);
  const labelScene = vectorFrom(config.navis?.rvmViewer?.labelPoint);
  if (!anchorScene) return config;

  const anchorNative = scenePointToNativeRvm(viewer, anchorScene);
  const labelNative = labelScene ? scenePointToNativeRvm(viewer, labelScene) : anchorNative.clone();
  const cameraNative = nativeCameraStateFromViewer(viewer, config.cameraState);
  const boundsNative = boxObject(boundsAround(anchorNative, labelNative));

  return {
    ...config,
    worldPosition: pointObject(anchorNative),
    cameraState: cameraNative,
    navis: {
      ...(config.navis || {}),
      coordinateSpace: 'rvm-native',
      coordinateBridgeVersion: VERSION,
      upVector: cameraNative.upVector || config.navis?.upVector || { x: 0, y: 0, z: 1 },
      redline: {
        ...(config.navis?.redline || {}),
        coordinateSpace: 'rvm-native',
        pos3d: pointObject(anchorNative),
        bounds: boundsNative,
      },
      rvmViewer: {
        ...(config.navis?.rvmViewer || {}),
        coordinateSpace: 'scene',
        nativeAnchorPoint: pointObject(anchorNative),
        nativeLabelPoint: pointObject(labelNative),
      },
    },
  };
}

function isSceneManualTagConfig(config = {}) {
  if (config.navis?.coordinateSpace === 'rvm-native') return false;
  return config.navis?.rvmViewer?.source === 'manual-two-click' || config.anchorType === 'object';
}

function tagForSceneDisplay(tag) {
  if (!tag || !isNativeNavisTag(tag)) return tag;
  const viewer = currentViewer();
  if (!viewer) return tag;

  const nativeAnchor = vectorFrom(tag.worldPosition || tag.navis?.redline?.pos3d);
  const sceneAnchor = nativeAnchor ? nativeRvmPointToScene(viewer, nativeAnchor) : null;
  const sceneBounds = nativeBoundsToScene(viewer, tag.navis?.redline?.bounds);
  const sceneCameraState = cameraStateForSceneDisplay(viewer, tag.cameraState || {});

  return {
    ...tag,
    worldPosition: sceneAnchor ? pointObject(sceneAnchor) : tag.worldPosition,
    cameraState: sceneCameraState || tag.cameraState,
    navis: {
      ...(tag.navis || {}),
      redline: {
        ...(tag.navis?.redline || {}),
        pos3d: sceneAnchor ? pointObject(sceneAnchor) : tag.navis?.redline?.pos3d,
        bounds: sceneBounds || tag.navis?.redline?.bounds,
      },
      rvmViewer: {
        ...(tag.navis?.rvmViewer || {}),
        // Manual labels are already scene-space; imported Navis tags derive a
        // scene label from converted bounds/2D redline data.
        coordinateSpace: 'scene',
      },
    },
  };
}

function isNativeNavisTag(tag = {}) {
  if (tag.navis?.coordinateSpace === 'rvm-native') return true;
  if (tag.navis?.rvmViewer?.source === 'manual-two-click' && tag.navis?.coordinateSpace !== 'rvm-native') return false;
  return tag.anchorType === 'navis-redline-tag';
}

function nativeCameraStateFromViewer(viewer, fallback = {}) {
  const scenePosition = vectorFrom(viewer?.camera?.position || fallback.position);
  const sceneTarget = vectorFrom(viewer?.controls?.target || fallback.target);
  if (!scenePosition) return fallback;

  const nativePosition = scenePointToNativeRvm(viewer, scenePosition);
  const nativeTarget = sceneTarget ? scenePointToNativeRvm(viewer, sceneTarget) : null;
  const sceneForward = sceneTarget
    ? sceneTarget.clone().sub(scenePosition).normalize()
    : viewer.camera.getWorldDirection(new THREE.Vector3()).normalize();
  const sceneUp = new THREE.Vector3(0, 1, 0).applyQuaternion(viewer.camera.quaternion).normalize();
  const nativeForward = sceneDirectionToNativeRvm(viewer, sceneForward);
  const nativeUp = sceneDirectionToNativeRvm(viewer, sceneUp);
  const rotationQuaternion = quaternionFromForwardUp(nativeForward, nativeUp);

  return {
    ...fallback,
    position: pointObject(nativePosition),
    ...(nativeTarget ? { target: pointObject(nativeTarget) } : {}),
    forward: pointObject(nativeForward),
    upVector: pointObject(nativeUp),
    ...(rotationQuaternion ? { rotationQuaternion } : {}),
    coordinateSpace: 'rvm-native',
  };
}

function cameraStateForSceneDisplay(viewer, cameraState = {}) {
  if (!cameraState || !isNativeCameraState(cameraState)) return cameraState;
  const nativePosition = vectorFrom(cameraState.position);
  const nativeTarget = vectorFrom(cameraState.target);
  if (!nativePosition) return cameraState;
  const scenePosition = nativeRvmPointToScene(viewer, nativePosition);
  const sceneTarget = nativeTarget ? nativeRvmPointToScene(viewer, nativeTarget) : null;
  return {
    ...cameraState,
    position: pointObject(scenePosition),
    ...(sceneTarget ? { target: pointObject(sceneTarget) } : {}),
    coordinateSpace: 'scene',
  };
}

function isNativeCameraState(cameraState = {}) {
  return cameraState.coordinateSpace === 'rvm-native';
}

function injectNativeNavisXmlData(xml, tags = []) {
  if (typeof DOMParser === 'undefined' || typeof XMLSerializer === 'undefined') return xml;
  const doc = new DOMParser().parseFromString(String(xml || ''), 'application/xml');
  if (doc.querySelector?.('parsererror') || !doc.documentElement) return xml;

  doc.documentElement.setAttribute('units', doc.documentElement.getAttribute('units') || 'm');
  const views = Array.from(doc.getElementsByTagName('view'));

  views.forEach((viewEl, index) => {
    const tag = tags[index];
    if (!tag) return;
    const rltagEl = firstDescendant(viewEl, 'rltag');
    if (rltagEl) {
      const pos3d = tag.worldPosition || tag.navis?.redline?.pos3d;
      if (pos3d) replacePoint3f(doc, rltagEl, 'pos3d', pos3d);
      if (tag.navis?.redline?.bounds) replaceBox3f(doc, rltagEl, 'bounds', tag.navis.redline.bounds);
      setOptionalAttr(rltagEl, 'bundleId', tag.bundleId);
      setOptionalAttr(rltagEl, 'canonicalObjectId', tag.canonicalObjectId);
      setOptionalAttr(rltagEl, 'sourceObjectId', tag.sourceObjectId);
    }

    const cameraEl = firstDescendant(viewEl, 'camera');
    const target = tag.cameraState?.target;
    if (cameraEl && target) {
      cameraEl.setAttribute('target_x', formatNum(target.x));
      cameraEl.setAttribute('target_y', formatNum(target.y));
      cameraEl.setAttribute('target_z', formatNum(target.z));
    }
  });

  return `<?xml version="1.0" encoding="UTF-8"?>\n${new XMLSerializer().serializeToString(doc)}`;
}

function replacePoint3f(doc, parent, wrapperName, point) {
  removeDirectChildren(parent, wrapperName);
  const wrapper = doc.createElement(wrapperName);
  const pos = doc.createElement('pos3f');
  pos.setAttribute('x', formatNum(point.x));
  pos.setAttribute('y', formatNum(point.y));
  pos.setAttribute('z', formatNum(point.z));
  wrapper.appendChild(pos);
  parent.appendChild(wrapper);
}

function replaceBox3f(doc, parent, wrapperName, box) {
  if (!box?.min || !box?.max) return;
  removeDirectChildren(parent, wrapperName);
  const wrapper = doc.createElement(wrapperName);
  const box3f = doc.createElement('box3f');
  appendBoxPoint(doc, box3f, 'min', box.min);
  appendBoxPoint(doc, box3f, 'max', box.max);
  wrapper.appendChild(box3f);
  parent.appendChild(wrapper);
}

function appendBoxPoint(doc, box3f, name, point) {
  const el = doc.createElement(name);
  const pos = doc.createElement('pos3f');
  pos.setAttribute('x', formatNum(point.x));
  pos.setAttribute('y', formatNum(point.y));
  pos.setAttribute('z', formatNum(point.z));
  el.appendChild(pos);
  box3f.appendChild(el);
}

function removeDirectChildren(parent, name) {
  for (const child of Array.from(parent?.children || [])) {
    if (String(child.localName || child.tagName || '').toLowerCase() === name.toLowerCase()) child.remove();
  }
}

function firstDescendant(parent, name) {
  return Array.from(parent?.getElementsByTagName?.(name) || [])[0] || null;
}

function setOptionalAttr(el, name, value) {
  if (value !== null && value !== undefined && value !== '') el.setAttribute(name, String(value));
}

function scenePointToNativeRvm(viewer, value) {
  const point = vectorFrom(value);
  if (!viewer?.modelGroup || !point) return point || new THREE.Vector3();
  viewer.modelGroup.updateMatrixWorld(true);
  return viewer.modelGroup.worldToLocal(point.clone());
}

function nativeRvmPointToScene(viewer, value) {
  const point = vectorFrom(value);
  if (!viewer?.modelGroup || !point) return point || new THREE.Vector3();
  viewer.modelGroup.updateMatrixWorld(true);
  return viewer.modelGroup.localToWorld(point.clone());
}

function sceneDirectionToNativeRvm(viewer, value) {
  const vector = vectorFrom(value);
  if (!viewer?.modelGroup || !vector) return vector || new THREE.Vector3(0, 0, -1);
  viewer.modelGroup.updateMatrixWorld(true);
  const matrix = new THREE.Matrix3().setFromMatrix4(viewer.modelGroup.matrixWorld).invert();
  return vector.clone().applyMatrix3(matrix).normalize();
}

function nativeBoundsToScene(viewer, bounds) {
  if (!bounds?.min || !bounds?.max) return null;
  const min = vectorFrom(bounds.min);
  const max = vectorFrom(bounds.max);
  if (!min || !max) return null;
  const sceneBox = new THREE.Box3().setFromPoints([
    nativeRvmPointToScene(viewer, min),
    nativeRvmPointToScene(viewer, max),
  ]);
  return boxObject(sceneBox);
}

function boundsAround(a, b) {
  const box = new THREE.Box3().setFromPoints([a, b || a]);
  box.expandByScalar(Math.max(a.distanceTo(b || a) * 0.08, 0.05));
  return box;
}

function boxObject(box) {
  return { min: pointObject(box.min), max: pointObject(box.max) };
}

function pointObject(point) {
  return { x: Number(point?.x) || 0, y: Number(point?.y) || 0, z: Number(point?.z) || 0 };
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

function quaternionFromForwardUp(forward, up) {
  const f = vectorFrom(forward)?.normalize();
  const u = vectorFrom(up)?.normalize();
  if (!f || !u || f.lengthSq() <= 1e-12 || u.lengthSq() <= 1e-12) return null;
  let right = new THREE.Vector3().crossVectors(f, u).normalize();
  if (right.lengthSq() <= 1e-12) right = new THREE.Vector3(1, 0, 0);
  const correctedUp = new THREE.Vector3().crossVectors(right, f).normalize();
  const backward = f.clone().multiplyScalar(-1);
  return quaternionFromRotationMatrix(
    right.x, correctedUp.x, backward.x,
    right.y, correctedUp.y, backward.y,
    right.z, correctedUp.z, backward.z
  );
}

function quaternionFromRotationMatrix(m00, m01, m02, m10, m11, m12, m20, m21, m22) {
  const trace = m00 + m11 + m22;
  let x, y, z, w;
  if (trace > 0) {
    const s = Math.sqrt(trace + 1) * 2;
    x = (m21 - m12) / s; y = (m02 - m20) / s; z = (m10 - m01) / s; w = 0.25 * s;
  } else if (m00 > m11 && m00 > m22) {
    const s = Math.sqrt(1 + m00 - m11 - m22) * 2;
    x = 0.25 * s; y = (m01 + m10) / s; z = (m02 + m20) / s; w = (m21 - m12) / s;
  } else if (m11 > m22) {
    const s = Math.sqrt(1 + m11 - m00 - m22) * 2;
    x = (m01 + m10) / s; y = 0.25 * s; z = (m12 + m21) / s; w = (m02 - m20) / s;
  } else {
    const s = Math.sqrt(1 + m22 - m00 - m11) * 2;
    x = (m02 + m20) / s; y = (m12 + m21) / s; z = 0.25 * s; w = (m10 - m01) / s;
  }
  const q = new THREE.Quaternion(x || 0, y || 0, z || 0, w || 1).normalize();
  return { a: q.x, b: q.y, c: q.z, d: q.w };
}

function currentRoot() {
  return document.querySelector(ROOT_SELECTOR);
}

function currentViewer() {
  const root = currentRoot();
  return root?.__rvmViewer3D || root?.__rvmViewer || globalThis.__3D_RVM_VIEWER__ || null;
}

function refreshRootDiagnostics(reason) {
  const root = currentRoot();
  if (!root) return;
  root.dataset.rvmTagCoordinateBridge = VERSION;
  root.dataset.rvmTagCoordinateBridgeReason = reason;
}

function getDiagnostics() {
  return {
    version: VERSION,
    patched: Boolean(RvmTagXmlStore?.prototype?.[PATCH_KEY]),
    hasViewer: Boolean(currentViewer()),
  };
}

function formatNum(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '0.0000000000';
  return n.toFixed(10);
}
