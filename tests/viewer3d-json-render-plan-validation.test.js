import assert from 'node:assert/strict';
import { createSampleRvmStageModelV1 } from '../stage/samples/sample-rvm-stage-model-v1.js';
import {
  buildStageRenderPlan,
  createComponentRenderPlanEntry,
  createPrimitiveRenderPlanEntry,
  validateStageRenderPlan,
} from '../stage/render/StageRenderPlan.js';

const source = { schema: 'RvmStageModel.v1', fileName: 'validation.json', fileHash: 'sha256-validation', quality: 'full' };

function planWith(entries) {
  return { schema: 'StageRenderPlan.v1', source, entries, summary: {}, diagnostics: [] };
}

function validPrimitive(overrides = {}) {
  return createPrimitiveRenderPlanEntry({
    id: 'render-valid-001', sourceRef: { type: 'primitive', id: 'prim-valid-001' }, nodeId: 'node-valid-001', componentId: 'comp-valid-001', primitiveId: 'prim-valid-001', renderKind: 'CYLINDER', semanticType: 'PIPE', recipeId: 'primitive-cylinder-native', recipeSource: 'native', supportLevel: 'supported', output: 'procedural', diagnosticOnly: false, hidden: false, bboxWorld: [0, 0, 0, 1, 1, 1], reasonCodes: [], nativeGeometryRef: { type: 'primitive-native', id: 'prim-valid-001' },
    ...overrides,
  });
}

const validPlan = planWith([validPrimitive()]);
assert.equal(validateStageRenderPlan(validPlan).valid, true);

const missingEntryKind = planWith([{ ...validPrimitive(), entryKind: undefined }]);
assert.equal(validateStageRenderPlan(missingEntryKind).valid, false);
assert.ok(validateStageRenderPlan(missingEntryKind).errors.some((line) => line.includes('entryKind')));

const missingSourceRef = planWith([{ ...validPrimitive(), sourceRef: null }]);
assert.equal(validateStageRenderPlan(missingSourceRef).valid, false);
assert.ok(validateStageRenderPlan(missingSourceRef).errors.some((line) => line.includes('sourceRef')));

const duplicateIds = planWith([validPrimitive(), validPrimitive({ sourceRef: { type: 'primitive', id: 'prim-valid-002' }, primitiveId: 'prim-valid-002' })]);
assert.equal(validateStageRenderPlan(duplicateIds).valid, false);
assert.ok(validateStageRenderPlan(duplicateIds).errors.some((line) => line.includes('duplicate')));

const malformedBbox = planWith([validPrimitive({ bboxWorld: [0, 0, 0] })]);
assert.equal(validateStageRenderPlan(malformedBbox).valid, false);
assert.ok(validateStageRenderPlan(malformedBbox).errors.some((line) => line.includes('bboxWorld')));

const nativeMissingRef = planWith([validPrimitive({ nativeGeometryRef: null })]);
assert.equal(validateStageRenderPlan(nativeMissingRef).valid, false);
assert.ok(validateStageRenderPlan(nativeMissingRef).errors.some((line) => line.includes('native recipeSource')));

const meshInvalid = planWith([validPrimitive({ renderKind: 'MESH_CHUNK', recipeId: 'primitive-mesh-chunk-native', output: 'mesh-chunk', geometryChunkRef: null })]);
assert.equal(validateStageRenderPlan(meshInvalid).valid, false);
assert.ok(validateStageRenderPlan(meshInvalid).errors.some((line) => line.includes('MESH_CHUNK')));

const facetInvalid = planWith([validPrimitive({ renderKind: 'FACET_GROUP', recipeId: 'primitive-facet-group-native', output: 'mesh-chunk', facetMetadataRef: null, geometryChunkRef: null })]);
assert.equal(validateStageRenderPlan(facetInvalid).valid, false);
assert.ok(validateStageRenderPlan(facetInvalid).errors.some((line) => line.includes('FACET_GROUP')));

const badUnsupported = planWith([createComponentRenderPlanEntry({
  id: 'render-bad-component', sourceRef: { type: 'component', id: 'comp-bad' }, nodeId: 'node-bad', componentId: 'comp-bad', renderKind: 'FOUNDATION', semanticType: 'FOUNDATION', recipeId: 'component-foundation-native', recipeSource: 'component', supportLevel: 'unsupported', output: 'bbox', diagnosticOnly: true, hidden: false, bboxWorld: [0, 0, 0, 1, 1, 1], reasonCodes: ['STAGE_FOUNDATION_RENDERER_INCOMPLETE'],
})]);
assert.equal(validateStageRenderPlan(badUnsupported).valid, false);
assert.ok(validateStageRenderPlan(badUnsupported).errors.some((line) => line.includes('diagnostic fallback')));

const sample = createSampleRvmStageModelV1();
const meshMissingModel = structuredClone(sample);
meshMissingModel.primitives[0].renderKind = 'MESH_CHUNK';
meshMissingModel.primitives[0].geometryChunk = null;
const meshPlan = buildStageRenderPlan(meshMissingModel, 'full');
assert.equal(meshPlan.entries[0].diagnosticOnly, true);
assert.equal(validateStageRenderPlan(meshPlan).valid, true);

const facetMissingModel = structuredClone(sample);
const facet = facetMissingModel.primitives.find((primitive) => primitive.renderKind === 'FACET_GROUP');
facet.params = {};
facet.facetMetadata = null;
facet.geometryChunk = null;
const facetPlan = buildStageRenderPlan(facetMissingModel, 'full');
const facetEntry = facetPlan.entries.find((entry) => entry.renderKind === 'FACET_GROUP');
assert.equal(facetEntry.diagnosticOnly, true);
assert.equal(validateStageRenderPlan(facetPlan).valid, true);

console.log('StageRenderPlan validation hardening tests passed');
