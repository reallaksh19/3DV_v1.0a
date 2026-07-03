import assert from 'node:assert/strict';
import test from 'node:test';
import {
  STAGE_GEOMETRY_FALLBACK_KINDS,
  STAGE_GEOMETRY_PROVENANCE,
  STAGE_NATIVE_GEOMETRY_SCHEMA,
  STAGE_NATIVE_RECORD_TYPES,
  createDiagnosticFallback,
  createGeometryChunkRef,
  createNativeGeometryMetadata,
  createNativeRecordRef,
  validateDiagnosticFallback,
  validateGeometryChunkRef,
  validateNativeGeometryMetadata,
  validateNativeRecordRef,
} from '../stage/contracts/RvmStageModelContract.js';

test('native geometry contract exports exist', () => {
  assert.equal(STAGE_NATIVE_GEOMETRY_SCHEMA, 'StageNativeGeometryContract.v1');
  assert.ok(STAGE_NATIVE_RECORD_TYPES.includes('RVM_PRIMITIVE'));
  assert.ok(STAGE_GEOMETRY_PROVENANCE.includes('native'));
  assert.ok(STAGE_GEOMETRY_FALLBACK_KINDS.includes('unknown-native-code'));
});

test('valid nativeRecord passes', () => {
  const record = createNativeRecordRef({ recordType: 'RVM_PRIMITIVE', recordOffset: 128, nativeCode: 8 });
  const result = validateNativeRecordRef(record, 'record');
  assert.equal(result.valid, true, result.errors.join('\n'));
});

test('invalid nativeRecord fails without throw', () => {
  const result = validateNativeRecordRef({ recordType: 'BAD', recordOffset: -1 }, 'record');
  assert.equal(result.valid, false);
  assert.ok(result.errors.length >= 1);
});

test('valid transform3x4 passes', () => {
  const metadata = createNativeGeometryMetadata({ transform3x4: identity(), bboxLocal: bbox(), bboxWorld: bbox() });
  const result = validateNativeGeometryMetadata(metadata, 'metadata');
  assert.equal(result.valid, true, result.errors.join('\n'));
});

test('transform with non-finite values fails', () => {
  const metadata = createNativeGeometryMetadata({ transform3x4: [1, 0, 0, 0, 1, NaN, 0, 0, 1, 0, 0, 0] });
  const result = validateNativeGeometryMetadata(metadata, 'metadata');
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((line) => line.includes('transform3x4')));
});

test('invalid bboxLocal and bboxWorld fail', () => {
  const metadata = createNativeGeometryMetadata({ bboxLocal: [1, 0, 0, 0, 1, 1], bboxWorld: [0, 0, 0, Infinity, 1, 1] });
  const result = validateNativeGeometryMetadata(metadata, 'metadata');
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((line) => line.includes('bboxLocal')));
  assert.ok(result.errors.some((line) => line.includes('bboxWorld')));
});

test('valid geometryChunk reference passes', () => {
  const chunk = createGeometryChunkRef({ id: 'chunk-001', byteOffset: 0, byteLength: 128, primitiveIds: ['prim-1'] });
  const result = validateGeometryChunkRef(chunk, 'chunk');
  assert.equal(result.valid, true, result.errors.join('\n'));
});

test('diagnostic fallback reference passes', () => {
  const fallback = createDiagnosticFallback({ kind: 'unknown-native-code', visible: true, message: 'Diagnostic bbox only.' });
  const result = validateDiagnosticFallback(fallback, 'fallback');
  assert.equal(result.valid, true, result.errors.join('\n'));
});

function identity() {
  return [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0];
}

function bbox() {
  return [0, 0, 0, 1, 1, 1];
}
