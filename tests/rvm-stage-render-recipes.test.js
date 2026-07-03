import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  getStageRenderRecipeForComponent,
  getStageRenderRecipeForPrimitive,
  validateStageRenderRecipe,
  validateStageRenderRecipesForModel,
} from '../stage/contracts/RvmStageModelContract.js';
import {
  createInvalidRenderKindStageModel,
  createSemanticOnlySupportStageModel,
  createUndecodedNativeVisibleStageModel,
} from '../stage/samples/invalid-stage-fixtures.js';
import { createSampleRvmStageModelV1 } from '../stage/samples/sample-rvm-stage-model-v1.js';

const jsonFixtureUrl = new URL('../stage/samples/sample-rvm-stage-model-v1.json', import.meta.url);

test('static JSON sample validates render recipes for all primitives and components', () => {
  const result = validateStageRenderRecipesForModel(readJsonFixture());
  assert.equal(result.valid, true, result.errors.join('\n'));
});

test('JS sample validates render recipes for all primitives and components', () => {
  const result = validateStageRenderRecipesForModel(createSampleRvmStageModelV1());
  assert.equal(result.valid, true, result.errors.join('\n'));
});

test('primitive render kinds resolve to deterministic full-quality recipes', () => {
  const model = readJsonFixture();
  assertRecipe(getPrimitive(model, 'CYLINDER'), 'full', 'primitive-cylinder-native');
  assertRecipe(getPrimitive(model, 'ELBOW'), 'full', 'primitive-code4-elbow-native');
  assertRecipe(getPrimitive(model, 'FACET_GROUP'), 'full', 'primitive-facet-group-native');
  assertRecipe(getPrimitive(model, 'UNKNOWN_DIAGNOSTIC'), 'full', 'primitive-unknown-diagnostic-bbox');
});

test('hidden quality resolves any primitive to primitive-hidden', () => {
  const model = readJsonFixture();
  for (const primitive of model.primitives) assertRecipe(primitive, 'hidden', 'primitive-hidden');
});

test('component quality recipes are deterministic', () => {
  const component = readJsonFixture().components.find((item) => item.semanticType === 'PIPE');
  assert.equal(getStageRenderRecipeForComponent(component, 'light').id, 'component-proxy-bbox');
  assert.equal(getStageRenderRecipeForComponent(component, 'skeleton').id, 'component-centerline-symbol');
});

test('diagnostic component full quality remains diagnostic-only', () => {
  const component = readJsonFixture().components.find((item) => item.confidence.geometry === 'diagnostic');
  assert.equal(getStageRenderRecipeForComponent(component, 'full').id, 'component-diagnostic-only');
});

test('recipe schema validator accepts selected recipes', () => {
  const recipe = getStageRenderRecipeForPrimitive(getPrimitive(readJsonFixture(), 'CYLINDER'), 'full');
  const result = validateStageRenderRecipe(recipe);
  assert.equal(result.valid, true, result.errors.join('\n'));
});

test('semantic-proxy visible native recipe is rejected', () => {
  assertRecipeValidationCode(createSemanticOnlySupportStageModel(), 'STAGE_FALLBACK_SEMANTIC_ONLY_GEOMETRY');
});

test('undecoded native visible recipe is rejected', () => {
  assertRecipeValidationCode(createUndecodedNativeVisibleStageModel(), 'STAGE_UNDECODED_NATIVE_PRIMITIVE');
});

test('invalid renderKind fails render recipe validation', () => {
  assertRecipeValidationCode(createInvalidRenderKindStageModel(), 'STAGE_INVALID_RENDER_KIND');
});

function readJsonFixture() {
  return JSON.parse(readFileSync(jsonFixtureUrl, 'utf8'));
}

function getPrimitive(model, renderKind) {
  return model.primitives.find((primitive) => primitive.renderKind === renderKind);
}

function assertRecipe(primitive, quality, expectedId) {
  assert.equal(getStageRenderRecipeForPrimitive(primitive, quality).id, expectedId);
}

function assertRecipeValidationCode(model, code) {
  const result = validateStageRenderRecipesForModel(model);
  assert.equal(result.valid, false, 'model should fail recipe validation');
  assert.ok(result.errors.some((line) => line.includes(code)), result.errors.join('\n'));
}
