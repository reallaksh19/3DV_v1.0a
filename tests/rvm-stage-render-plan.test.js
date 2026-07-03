import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createSampleRvmStageModelV1 } from '../stage/samples/sample-rvm-stage-model-v1.js';
import { validateRvmStageModel } from '../stage/contracts/RvmStageModelContract.js';
import {
  STAGE_RENDER_PLAN_SCHEMA,
  buildStageRenderPlan,
  summarizeStageRenderPlan,
  validateStageRenderPlan,
} from '../stage/render/StageRenderPlan.js';

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const staticSample = JSON.parse(fs.readFileSync(path.join(root, 'stage/samples/sample-rvm-stage-model-v1.json'), 'utf8'));

function assertValidPlan(plan) {
  assert.equal(plan.schema, STAGE_RENDER_PLAN_SCHEMA);
  const result = validateStageRenderPlan(plan);
  assert.equal(result.valid, true, result.errors.join('\n'));
}

function recipeIds(plan) {
  return new Set(plan.entries.map((entry) => entry.recipeId));
}

const sample = createSampleRvmStageModelV1();
assert.equal(validateRvmStageModel(sample).valid, true);
const fullPlan = buildStageRenderPlan(sample, 'full');
assertValidPlan(fullPlan);
assert.equal(fullPlan.source.quality, 'full');
assert.equal(fullPlan.entries.length, sample.primitives.length);

const ids = recipeIds(fullPlan);
assert.ok(ids.has('primitive-cylinder-native'));
assert.ok(ids.has('primitive-code4-elbow-native'));
assert.ok(ids.has('primitive-facet-group-native'));
assert.ok(ids.has('primitive-unknown-diagnostic-bbox'));
assert.ok(fullPlan.entries.some((entry) => entry.diagnosticOnly && entry.recipeId === 'primitive-unknown-diagnostic-bbox'));
assert.ok(fullPlan.summary.byRecipe['primitive-cylinder-native'] >= 1);
assert.ok(fullPlan.summary.byOutput.procedural >= 1);
assert.equal(summarizeStageRenderPlan(fullPlan).totalEntries, fullPlan.entries.length);

const staticValidation = validateRvmStageModel(staticSample);
assert.equal(staticValidation.valid, true, staticValidation.errors.join('\n'));
const staticPlan = buildStageRenderPlan(staticSample, 'full');
assertValidPlan(staticPlan);
assert.equal(staticPlan.entries.length, staticSample.primitives.length);

const hiddenPlan = buildStageRenderPlan(sample, 'hidden');
assertValidPlan(hiddenPlan);
assert.equal(hiddenPlan.summary.hidden, sample.primitives.length);
assert.equal(hiddenPlan.summary.byOutput.hidden, sample.primitives.length);
assert.ok(hiddenPlan.entries.every((entry) => entry.recipeId === 'primitive-hidden'));

const invalidKindModel = structuredClone(sample);
invalidKindModel.primitives[0].renderKind = 'INVALID_KIND_FOR_TEST';
const invalidKindPlan = buildStageRenderPlan(invalidKindModel, 'full');
assertValidPlan(invalidKindPlan);
assert.ok(invalidKindPlan.diagnostics.some((item) => item.code === 'STAGE_RENDER_PLAN_RECIPE_MISSING'));
assert.equal(invalidKindPlan.entries[0].diagnosticOnly, true);
assert.equal(invalidKindPlan.entries[0].recipeId, 'render-plan-diagnostic-missing-recipe');

console.log('StageRenderPlan.v1 adapter tests passed');
