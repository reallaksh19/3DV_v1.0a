import assert from 'node:assert/strict';
import test from 'node:test';
import {
  STAGE_GEOMETRY_ATTRIBUTE_KINDS,
  STAGE_GEOMETRY_CHUNK_ENCODINGS,
  STAGE_GEOMETRY_CHUNK_KINDS,
  STAGE_GEOMETRY_CHUNK_SCHEMA,
  createGeometryAttributeRef,
  createGeometryBBoxRange,
  createGeometryBufferView,
  createGeometryChunk,
  createGeometryMaterialRange,
  summarizeGeometryChunks,
  validateGeometryChunk,
} from '../stage/contracts/RvmStageModelContract.js';

test('geometry chunk contract exports exist', () => {
  assert.equal(STAGE_GEOMETRY_CHUNK_SCHEMA, 'StageGeometryChunk.v1');
  assert.ok(STAGE_GEOMETRY_CHUNK_KINDS.includes('facet-group'));
  assert.ok(STAGE_GEOMETRY_CHUNK_ENCODINGS.includes('inline-metadata-only'));
  assert.ok(STAGE_GEOMETRY_ATTRIBUTE_KINDS.includes('position'));
});

test('valid metadata-only facet chunk validates', () => {
  const result = validateGeometryChunk(validFacetChunk(), 'chunk');
  assert.equal(result.valid, true, result.errors.join('\n'));
});

test('missing chunk id fails', () => {
  const chunk = validFacetChunk();
  chunk.id = '';
  assertChunkError(chunk, '.id is required');
});

test('invalid byte ranges fail', () => {
  const chunk = validFacetChunk();
  chunk.buffers[0].byteOffset = -1;
  assertChunkError(chunk, 'byteOffset must be a non-negative integer');
});

test('buffer view outside source byteLength fails', () => {
  const chunk = validFacetChunk();
  chunk.source.byteLength = 4;
  chunk.buffers[0].byteLength = 8;
  assertChunkError(chunk, 'byte range exceeds source.byteLength');
});

test('missing required position attribute for renderable facet chunk fails', () => {
  const chunk = validFacetChunk();
  chunk.attributes = {};
  assertChunkError(chunk, 'attributes.position is required');
});

test('invalid material range fails', () => {
  const chunk = validFacetChunk();
  chunk.materialRanges[0].materialId = '';
  assertChunkError(chunk, 'materialId is required');
});

test('invalid bboxLocal and bboxWorld fail', () => {
  const chunk = validFacetChunk();
  chunk.bboxLocal = [1, 0, 0, 0, 1, 1];
  chunk.bboxWorld = [0, 0, 0, Infinity, 1, 1];
  const result = validateGeometryChunk(chunk, 'chunk');
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((line) => line.includes('bboxLocal')));
  assert.ok(result.errors.some((line) => line.includes('bboxWorld')));
});

test('summarizeGeometryChunks returns deterministic totals', () => {
  const summary = summarizeGeometryChunks([validFacetChunk(), diagnosticChunk()]);
  assert.deepEqual(summary, {
    totalChunks: 2,
    byKind: { 'facet-group': 1, diagnostic: 1 },
    byEncoding: { 'inline-metadata-only': 2 },
    componentCount: 1,
    primitiveCount: 1,
    byteLength: 0,
    diagnosticCount: 1,
  });
});

function validFacetChunk() {
  const buffer = createGeometryBufferView({ id: 'bv-pos', role: 'position', byteOffset: 0, byteLength: 0, componentType: 'float32', count: 4 });
  return createGeometryChunk({
    id: 'chunk-facet-001',
    kind: 'facet-group',
    encoding: 'inline-metadata-only',
    source: { fileName: 'sample.rvm', fileHash: 'sha256-sample', byteOffset: 0, byteLength: 0, nativeRecordType: 'SAMPLE_METADATA_ONLY', nativeCode: 11 },
    ownership: { nodeIds: ['node-1'], componentIds: ['comp-1'], primitiveIds: ['prim-1'] },
    buffers: [buffer],
    attributes: { position: createGeometryAttributeRef({ kind: 'position', bufferViewId: buffer.id, componentType: 'float32', itemSize: 3, count: 4 }) },
    materialRanges: [createGeometryMaterialRange({ start: 0, count: 4, materialId: 'mat-1' })],
    bboxLocal: [0, 0, 0, 1, 1, 1],
    bboxWorld: [0, 0, 0, 1, 1, 1],
    bboxRanges: [createGeometryBBoxRange({ start: 0, count: 4, bboxLocal: [0, 0, 0, 1, 1, 1] })],
    diagnostics: [],
  });
}

function diagnosticChunk() {
  return createGeometryChunk({ id: 'chunk-diagnostic', kind: 'diagnostic', encoding: 'inline-metadata-only', ownership: { nodeIds: [], componentIds: [], primitiveIds: [] }, diagnostics: [{ code: 'DIAG' }] });
}

function assertChunkError(chunk, expected) {
  const result = validateGeometryChunk(chunk, 'chunk');
  assert.equal(result.valid, false, 'chunk should fail validation');
  assert.ok(result.errors.some((line) => line.includes(expected)), result.errors.join('\n'));
}
