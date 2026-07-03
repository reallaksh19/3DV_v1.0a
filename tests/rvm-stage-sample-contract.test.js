import assert from 'node:assert/strict';
import test from 'node:test';
import { createSampleRvmStageModelV1 } from '../stage/samples/sample-rvm-stage-model-v1.js';
import { validateRvmStageModel } from '../stage/contracts/RvmStageModelContract.js';

test('sample RvmStageModel.v1 fixture validates', () => {
  const model = createSampleRvmStageModelV1();
  const result = validateRvmStageModel(model);
  assert.equal(result.valid, true, result.errors.join('\n'));
});

test('sample includes required Phase 1 renderer contract cases', () => {
  const model = createSampleRvmStageModelV1();
  assert.ok(hasComponent(model, 'PIPE'));
  assert.ok(hasComponent(model, 'ELBOW'));
  assert.ok(hasComponent(model, 'TEE'));
  assert.ok(hasComponent(model, 'FLANGE'));
  assert.ok(hasComponent(model, 'SUPPORT'));
  assert.ok(hasComponent(model, 'FOUNDATION'));
  assert.ok(hasPrimitive(model, 'CYLINDER'));
  assert.ok(hasPrimitive(model, 'ELBOW'));
  assert.ok(hasPrimitive(model, 'FACET_GROUP'));
  assert.ok(hasPrimitive(model, 'BOX'));
  assert.ok(hasPrimitive(model, 'UNKNOWN_DIAGNOSTIC'));
});

test('sample unknown native code fallback is counted and diagnostic-scoped', () => {
  const model = createSampleRvmStageModelV1();
  const unknownComponent = model.components.find((component) => component.semanticType === 'UNKNOWN');
  assert.equal(model.diagnostics.severityCounts.warning, 1);
  assert.equal(model.diagnostics.fallbackCounts['unknown-native-code'], 1);
  assert.equal(model.diagnostics.renderKindCounts.UNKNOWN_DIAGNOSTIC, 1);
  assert.equal(unknownComponent.confidence.geometry, 'diagnostic');
  assert.equal(unknownComponent.confidence.semantic, 'unknown');
  assert.equal(unknownComponent.diagnostics.length, 1);
});

function hasComponent(model, semanticType) {
  return model.components.some((component) => component.semanticType === semanticType);
}

function hasPrimitive(model, renderKind) {
  return model.primitives.some((primitive) => primitive.renderKind === renderKind);
}
