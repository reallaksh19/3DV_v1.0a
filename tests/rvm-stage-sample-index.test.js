import assert from 'node:assert/strict';
import test from 'node:test';
import {
  STAGE_SAMPLE_FIXTURES,
  getStageSampleFixtureById,
} from '../stage/samples/stage-sample-index.js';

test('sample index includes static RvmStageModel.v1 fixture', () => {
  const fixture = getStageSampleFixtureById('sample-rvm-stage-model-v1');
  assert.ok(STAGE_SAMPLE_FIXTURES.includes(fixture));
  assert.equal(fixture.schema, 'RvmStageModel.v1');
  assert.ok(fixture.href.endsWith('.json'));
});

test('sample index lookup returns expected fixture and safely misses unknown IDs', () => {
  const fixture = getStageSampleFixtureById('sample-rvm-stage-model-v1');
  assert.equal(fixture.id, 'sample-rvm-stage-model-v1');
  assert.equal(getStageSampleFixtureById('missing-fixture-id'), undefined);
});
