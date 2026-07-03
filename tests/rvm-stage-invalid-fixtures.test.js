import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createInvalidBboxStageModel,
  createInvalidRenderKindStageModel,
  createSemanticOnlySupportStageModel,
  createUndecodedNativeVisibleStageModel,
} from '../stage/samples/invalid-stage-fixtures.js';
import { validateRvmStageModel } from '../stage/contracts/RvmStageModelContract.js';

test('invalid render kind fixture fails with STAGE_INVALID_RENDER_KIND', () => {
  assertValidationCode(createInvalidRenderKindStageModel(), 'STAGE_INVALID_RENDER_KIND');
});

test('invalid bbox fixture fails with STAGE_INVALID_BBOX', () => {
  assertValidationCode(createInvalidBboxStageModel(), 'STAGE_INVALID_BBOX');
});

test('semantic-only support fixture fails with STAGE_FALLBACK_SEMANTIC_ONLY_GEOMETRY', () => {
  assertValidationCode(createSemanticOnlySupportStageModel(), 'STAGE_FALLBACK_SEMANTIC_ONLY_GEOMETRY');
});

test('undecoded native visible fixture fails with STAGE_UNDECODED_NATIVE_PRIMITIVE', () => {
  assertValidationCode(createUndecodedNativeVisibleStageModel(), 'STAGE_UNDECODED_NATIVE_PRIMITIVE');
});

function assertValidationCode(model, code) {
  const result = validateRvmStageModel(model);
  assert.equal(result.valid, false, 'fixture should fail validation');
  assert.ok(result.errors.some((line) => line.includes(code)), result.errors.join('\n'));
}
