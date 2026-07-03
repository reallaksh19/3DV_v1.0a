import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createSampleRvmStageModelV1 } from '../stage/samples/sample-rvm-stage-model-v1.js';
import { RVM_STAGE_SCHEMA, validateRvmStageModel } from '../stage/contracts/RvmStageModelContract.js';

const fixtureUrl = new URL('../stage/samples/sample-rvm-stage-model-v1.json', import.meta.url);

test('static JSON fixture parses and validates', () => {
  const model = readJsonFixture();
  const result = validateRvmStageModel(model);
  assert.equal(result.valid, true, result.errors.join('\n'));
  assert.equal(model.schema, RVM_STAGE_SCHEMA);
});

test('static JSON fixture includes diagnostic fallback coverage', () => {
  const model = readJsonFixture();
  assert.ok(model.primitives.some((primitive) => primitive.renderKind === 'UNKNOWN_DIAGNOSTIC'));
  assert.ok(model.diagnostics.messages.some((message) => message.fallback));
});

test('static JSON fixture counts match JS sample factory output', () => {
  const jsonModel = readJsonFixture();
  const jsModel = createSampleRvmStageModelV1();
  assert.equal(jsonModel.components.length, jsModel.components.length);
  assert.equal(jsonModel.primitives.length, jsModel.primitives.length);
});

function readJsonFixture() {
  const text = readFileSync(fixtureUrl, 'utf8');
  return JSON.parse(text);
}
