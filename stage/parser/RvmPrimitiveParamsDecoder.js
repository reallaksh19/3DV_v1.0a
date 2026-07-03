import { bboxDimensions } from './RvmPrimitiveTransformMath.js';

export const RVM_PRIMITIVE_PARAM_SUPPORTED_CODES = Object.freeze([2, 4, 7, 8, 9, 11]);

export function isSupportedPrimitiveCode(code) {
  return RVM_PRIMITIVE_PARAM_SUPPORTED_CODES.includes(Number(code));
}

export function decodeRvmPrimitiveParams(code, values = [], context = {}) {
  const nativeCode = Number(code);
  const scale = normalizedColumnScales(context.columnScales);
  if (nativeCode === 8) return decodeCylinder(values, scale);
  if (nativeCode === 4) return decodeCircularTorus(values, scale);
  if (nativeCode === 2) return decodeBox(context.localBbox, scale);
  if (nativeCode === 7) return decodeSnout(values, scale);
  if (nativeCode === 9) return decodeSphere(values, scale);
  if (nativeCode === 11) return { decoded: false, reason: 'code11-routed-to-facet-group-decoder' };
  return { decoded: false, reason: 'unsupported-native-code' };
}

// RVM native primitive params are encoded in local/object space (same raw units as the record's
// own transform3x4), which is not necessarily the same scale as the world-space bboxWorld the
// transform produces (e.g. a 0.001 scale converts native mm values into world-space meters).
// Without this, geometry built directly from raw params can be orders of magnitude too large.
function normalizedColumnScales(columnScales) {
  const [sx, sy, sz] = Array.isArray(columnScales) ? columnScales : [];
  const valid = [sx, sy, sz].every((value) => Number.isFinite(value) && value > 0);
  if (!valid) return { x: 1, y: 1, z: 1, avg: 1 };
  return { x: sx, y: sy, z: sz, avg: (sx + sy + sz) / 3 };
}

function decodeCylinder(values, scale) {
  if (values.length < 2) return { decoded: false, reason: 'code8-requires-radius-height' };
  const radius = finite(values[0]);
  const height = finite(values[1]);
  if (!Number.isFinite(radius) || !Number.isFinite(height)) return { decoded: false, reason: 'code8-invalid-radius-height' };
  return { decoded: true, radius: radius * ((scale.x + scale.y) / 2), height: height * scale.z, localAxis: 'z' };
}

function decodeCircularTorus(values, scale) {
  if (values.length < 3) return { decoded: false, reason: 'code4-requires-offset-radius-angle' };
  const offset = finite(values[0]);
  const radius = finite(values[1]);
  const angleRad = finite(values[2]);
  if (![offset, radius, angleRad].every(Number.isFinite)) return { decoded: false, reason: 'code4-invalid-offset-radius-angle' };
  return { decoded: true, offset: offset * scale.avg, radius: radius * scale.avg, angleRad, angleDeg: angleRad * 180 / Math.PI, basis: 'circular-torus' };
}

function decodeSnout(values, scale) {
  if (values.length < 9) return { decoded: false, reason: 'code7-requires-nine-values' };
  const radiusBottom = finite(values[0]);
  const radiusTop = finite(values[1]);
  const height = finite(values[2]);
  const offsetX = finite(values[3]);
  const offsetY = finite(values[4]);
  const bottomShearX = finite(values[5]);
  const bottomShearY = finite(values[6]);
  const topShearX = finite(values[7]);
  const topShearY = finite(values[8]);
  if (![radiusBottom, radiusTop, height].every(Number.isFinite)) return { decoded: false, reason: 'code7-invalid-radius-height' };
  const xyScale = (scale.x + scale.y) / 2;
  return {
    decoded: true,
    radiusBottom: radiusBottom * xyScale,
    radiusTop: radiusTop * xyScale,
    height: height * scale.z,
    offsetX: offsetX * scale.x,
    offsetY: offsetY * scale.y,
    bottomShearX, bottomShearY, topShearX, topShearY,
    basis: 'snout-frustum',
  };
}

function decodeBox(localBbox, scale) {
  const size = bboxDimensions(localBbox);
  if (![size.x, size.y, size.z].every(Number.isFinite)) return { decoded: false, reason: 'code2-invalid-local-bbox' };
  return { decoded: true, sizeFromLocalBbox: { x: size.x * scale.x, y: size.y * scale.y, z: size.z * scale.z } };
}

function decodeSphere(values, scale) {
  if (values.length < 1) return { decoded: false, reason: 'code9-requires-diameter' };
  const diameter = finite(values[0]);
  if (!Number.isFinite(diameter)) return { decoded: false, reason: 'code9-invalid-diameter' };
  const scaledDiameter = diameter * scale.avg;
  return { decoded: true, diameter: scaledDiameter, radius: scaledDiameter / 2, radiusSource: 'derived-from-native-diameter' };
}

function finite(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : NaN;
}
