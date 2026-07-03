import assert from 'node:assert/strict';
import test from 'node:test';
import { validateRvmStageModel } from '../stage/contracts/RvmStageModelContract.js';
import { createSampleGeometryChunkStageModelV1 } from '../stage/samples/sample-geometry-chunk-stage-model-v1.js';
import { createSampleRvmStageModelV1 } from '../stage/samples/sample-rvm-stage-model-v1.js';

test('model.geometryChunks validates', () => {
  const model = createSampleGeometryChunkStageModelV1();
  assert.equal(model.geometryChunks.length, 2);
  assertModelValid(model);
});

test('duplicate geometry chunk IDs fail', () => {
  const model = createSampleGeometryChunkStageModelV1();
  model.geometryChunks.push({ ...model.geometryChunks[0] });
  assertModelError(model, 'STAGE_GEOMETRY_CHUNK_DUPLICATE_ID');
});

test('primitive geometryChunk reference to missing chunk ID fails', () => {
  const model = createSampleGeometryChunkStageModelV1();
  const facet = model.primitives.find((item) => item.renderKind === 'FACET_GROUP');
  facet.geometryChunk = { ...facet.geometryChunk, id: 'chunk-missing' };
  assertModelError(model, 'STAGE_GEOMETRY_CHUNK_UNKNOWN_ID');
});

test('FACET_GROUP with valid geometry chunk reference can claim chunk-backed output', () => {
  const model = createSampleGeometryChunkStageModelV1();
  const facet = model.primitives.find((item) => item.renderKind === 'FACET_GROUP');
  facet.params = {};
  facet.nativeParams = {};
  facet.recipeSource = { source: 'geometry-chunk', quality: 'full', output: 'mesh-chunk', recipeId: 'facet-chunk' };
  assertModelValid(model);
});

test('MESH_CHUNK without valid chunk reference cannot claim native full output', () => {
  const model = createSampleRvmStageModelV1();
  const primitive = model.primitives[0];
  primitive.renderKind = 'MESH_CHUNK';
  primitive.recipeSource = { source: 'geometry-chunk', quality: 'full', output: 'mesh-chunk', recipeId: 'mesh-chunk' };
  assertModelError(model, 'STAGE_GEOMETRY_CHUNK_REQUIRED');
});

test('existing sample still validates', () => {
  assertModelValid(createSampleRvmStageModelV1());
});

test('geometry-chunk sample validates', () => {
  assertModelValid(createSampleGeometryChunkStageModelV1());
});

function assertModelValid(model) {
  const result = validateRvmStageModel(model);
  assert.equal(result.valid, true, result.errors.join('\n'));
}

function assertModelError(model, expected) {
  const result = validateRvmStageModel(model);
  assert.equal(result.valid, false, 'model should fail validation');
  assert.ok(result.errors.some((line) => line.includes(expected)), result.errors.join('\n'));
}
