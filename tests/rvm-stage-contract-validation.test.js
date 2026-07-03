import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createDiagnosticFallback,
  createGeometryAttributeRef,
  createGeometryBufferView,
  createGeometryChunk,
  createNativeRecordRef,
  validateRvmStageModel,
} from '../stage/contracts/RvmStageModelContract.js';
import { createSampleNativeGeometryStageModelV1 } from '../stage/samples/sample-native-geometry-stage-model-v1.js';
import { createSampleRvmStageModelV1 } from '../stage/samples/sample-rvm-stage-model-v1.js';

test('existing sample still validates', () => {
  assertModelValid(createSampleRvmStageModelV1());
});

test('native geometry provenance sample validates', () => {
  assertModelValid(createSampleNativeGeometryStageModelV1());
});

test('diagnostic fallback sample validates', () => {
  const model = createSampleNativeGeometryStageModelV1();
  const diagnostic = model.primitives.at(-1);
  assert.equal(diagnostic.diagnosticFallback.visible, true);
  assertModelValid(model);
});

test('native recipe source requires native geometry metadata', () => {
  const model = createSampleNativeGeometryStageModelV1();
  delete model.primitives[0].nativeGeometry;
  assertModelError(model, 'STAGE_NATIVE_GEOMETRY_MISSING_METADATA');
});

test('visible diagnostic fallback cannot keep non-diagnostic render kind', () => {
  const model = createSampleNativeGeometryStageModelV1();
  const primitive = model.primitives[0];
  primitive.diagnosticFallback = createDiagnosticFallback({ kind: 'not-implemented', visible: true, message: 'Fallback only.' });
  primitive.recipeSource = { source: 'diagnostic-fallback', output: 'bbox', recipeId: 'diagnostic-bbox' };
  primitive.confidence.geometry = 'diagnostic';
  primitive.renderKind = 'CYLINDER';
  assertModelError(model, 'STAGE_DIAGNOSTIC_FALLBACK_RENDER_KIND');
});

test('MESH_CHUNK without geometryChunk cannot claim native full output', () => {
  const model = createSampleNativeGeometryStageModelV1();
  const primitive = model.primitives[0];
  primitive.renderKind = 'MESH_CHUNK';
  primitive.geometryChunk = undefined;
  primitive.recipeSource = { source: 'native', quality: 'full', output: 'procedural', recipeId: 'mesh-native' };
  assertModelError(model, 'STAGE_GEOMETRY_CHUNK_REQUIRED');
});

test('FACET_GROUP without decoded facet or chunk metadata cannot claim native full output', () => {
  const model = createSampleNativeGeometryStageModelV1();
  const primitive = model.primitives.find((item) => item.renderKind === 'FACET_GROUP');
  primitive.params = {};
  primitive.nativeParams = {};
  primitive.nativeRecord = createNativeRecordRef({ recordType: 'RVM_FACET_GROUP', recordOffset: 640, nativeCode: 11 });
  primitive.recipeSource = { source: 'native', quality: 'full', output: 'procedural', recipeId: 'facet-native' };
  assertModelError(model, 'STAGE_FACET_METADATA_REQUIRED');
});

test('MESH_CHUNK with geometryChunk metadata can claim geometry chunk output', () => {
  const model = createSampleNativeGeometryStageModelV1();
  const primitive = model.primitives[0];
  primitive.renderKind = 'MESH_CHUNK';
  primitive.recipeSource = { source: 'geometry-chunk', quality: 'full', output: 'mesh-chunk', recipeId: 'mesh-chunk' };
  primitive.geometryChunk = createValidMeshChunkForPrimitive(primitive);
  assertModelValid(model);
});

test('semantic-proxy visible geometry fails unless diagnostic fallback', () => {
  const model = createSampleNativeGeometryStageModelV1();
  const primitive = model.primitives[0];
  primitive.confidence.geometry = 'semantic-proxy';
  primitive.renderKind = 'CYLINDER';
  primitive.diagnosticFallback = undefined;
  assertModelError(model, 'STAGE_FALLBACK_SEMANTIC_ONLY_GEOMETRY');
});

test('component assembly references are validated', () => {
  const model = createSampleNativeGeometryStageModelV1();
  model.components[0].componentAssembly.primitiveIds = ['prim-missing'];
  assertModelError(model, 'componentAssembly.primitiveId is unknown');
});

test('invalid primitive transform3x4 fails', () => {
  const model = createSampleNativeGeometryStageModelV1();
  model.primitives[0].transform3x4 = [1, 0, 0, 0, 1, Infinity, 0, 0, 1, 0, 0, 0];
  assertModelError(model, 'transform3x4 must have 12 finite numbers');
});

test('invalid primitive bboxLocal and bboxWorld fail', () => {
  const model = createSampleNativeGeometryStageModelV1();
  model.primitives[0].bboxLocal = [1, 0, 0, 0, 1, 1];
  model.primitives[0].bboxWorld = [0, 0, 0, NaN, 1, 1];
  assertModelError(model, 'bboxLocal');
  assertModelError(model, 'bboxWorld');
});

function createValidMeshChunkForPrimitive(primitive) {
  const vertex = createGeometryBufferView({ id: 'bv-test-mesh-position', role: 'position', byteOffset: 0, byteLength: 48, byteStride: 12, componentType: 'float32', count: 4 });
  const index = createGeometryBufferView({ id: 'bv-test-mesh-index', role: 'index', byteOffset: 48, byteLength: 12, byteStride: 2, componentType: 'uint16', count: 6 });
  return createGeometryChunk({
    id: 'chunk-test-mesh-001',
    kind: 'mesh',
    encoding: 'inline-metadata-only',
    source: { byteOffset: 0, byteLength: 60, nativeCode: primitive.native.code, nativeRecordType: 'SAMPLE_NATIVE' },
    ownership: { nodeIds: [primitive.nodeId], componentIds: [primitive.componentId], primitiveIds: [primitive.id] },
    buffers: [vertex, index],
    attributes: {
      position: createGeometryAttributeRef({ kind: 'position', bufferViewId: vertex.id, componentType: 'float32', itemSize: 3, count: 4 }),
      index: createGeometryAttributeRef({ kind: 'index', bufferViewId: index.id, componentType: 'uint16', itemSize: 1, count: 6 }),
    },
    bboxLocal: primitive.transform.bboxLocal,
    bboxWorld: primitive.transform.bboxWorld,
  });
}

function assertModelValid(model) {
  const result = validateRvmStageModel(model);
  assert.equal(result.valid, true, result.errors.join('\n'));
}

function assertModelError(model, expected) {
  const result = validateRvmStageModel(model);
  assert.equal(result.valid, false, 'model should fail validation');
  assert.ok(result.errors.some((line) => line.includes(expected)), result.errors.join('\n'));
}
