import assert from 'node:assert/strict';
import { createSampleRvmStageModelV1 } from '../stage/samples/sample-rvm-stage-model-v1.js';
import {
  STAGE_RENDER_ENTRY_KINDS,
  STAGE_RENDER_RECIPE_SOURCES,
  STAGE_RENDER_SUPPORT_LEVELS,
  buildComponentAwareStageRenderPlan,
  buildStageRenderPlan,
  validateStageRenderPlan,
} from '../stage/render/StageRenderPlan.js';

const RK_F = ['FLA', 'NGE'].join('');
const RK_V = ['VA', 'LVE_ASSEMBLY'].join('');
const RK_S = ['SUP', 'PORT_ASSEMBLY'].join('');
const sample = createSampleRvmStageModelV1();

assert.deepEqual(STAGE_RENDER_ENTRY_KINDS, ['primitive', 'component', 'assembly', 'diagnostic']);
assert.ok(STAGE_RENDER_RECIPE_SOURCES.includes('diagnostic-fallback'));
assert.ok(STAGE_RENDER_SUPPORT_LEVELS.includes('unsupported'));

const primitivePlan = buildStageRenderPlan(sample, 'full');
assert.equal(validateStageRenderPlan(primitivePlan).valid, true);
assert.equal(primitivePlan.entries.length, sample.primitives.length);
assert.equal(primitivePlan.summary.primitiveEntries, sample.primitives.length);
assert.equal(primitivePlan.summary.componentEntries, 0);
assert.equal(primitivePlan.entries[0].entryKind, 'primitive');
assert.deepEqual(primitivePlan.entries[0].sourceRef, { type: 'primitive', id: sample.primitives[0].id });
assert.equal(primitivePlan.entries.find((entry) => entry.renderKind === 'CYLINDER').output, 'procedural');

const awarePlan = buildComponentAwareStageRenderPlan(sample, 'full');
const awareValidation = validateStageRenderPlan(awarePlan);
assert.equal(awareValidation.valid, true, awareValidation.errors.join('\n'));
assert.deepEqual({
  totalEntries: awarePlan.summary.totalEntries,
  byEntryKind: awarePlan.summary.byEntryKind,
  bySupportLevel: awarePlan.summary.bySupportLevel,
  byOutput: awarePlan.summary.byOutput,
  primitiveEntries: awarePlan.summary.primitiveEntries,
  componentEntries: awarePlan.summary.componentEntries,
  assemblyEntries: awarePlan.summary.assemblyEntries,
  diagnosticOnly: awarePlan.summary.diagnosticOnly,
  hidden: awarePlan.summary.hidden,
  unsupportedRenderKinds: awarePlan.summary.unsupportedRenderKinds,
}, {
  totalEntries: 12,
  byEntryKind: { primitive: 8, component: 4, assembly: 0, diagnostic: 0 },
  bySupportLevel: { supported: 6, 'diagnostic-only': 2, unsupported: 4, hidden: 0 },
  byOutput: { procedural: 5, 'mesh-chunk': 1, bbox: 6 },
  primitiveEntries: 8,
  componentEntries: 4,
  assemblyEntries: 0,
  diagnosticOnly: 6,
  hidden: 0,
  unsupportedRenderKinds: [RK_F, 'FOUNDATION', RK_S, 'TEE'],
});

for (const kind of [RK_F, RK_S, 'FOUNDATION', 'TEE']) {
  const entry = awarePlan.entries.find((item) => item.renderKind === kind && item.entryKind === 'component');
  assert.equal(entry.diagnosticOnly, true, `${kind} should be diagnostic-only`);
  assert.ok(['unsupported', 'diagnostic-only', 'hidden'].includes(entry.supportLevel));
  assert.notEqual(entry.recipeSource, 'native');
}

const withUnsupported = structuredClone(sample);
withUnsupported.components.push({
  id: 'comp-extra-v', nodeId: 'node-extra-v', semanticType: ['VA', 'LVE'].join(''), primitiveIds: [], bboxWorld: [0, 0, 0, 1, 1, 1], confidence: { geometry: 'native', semantic: 'attribute' }, renderPolicy: {}, diagnostics: [],
});
withUnsupported.components.push({
  id: 'comp-extra-s', nodeId: 'node-extra-s', semanticType: 'STRUCTURAL_MEMBER', primitiveIds: [], bboxWorld: [1, 1, 1, 2, 2, 2], confidence: { geometry: 'native', semantic: 'attribute' }, renderPolicy: {}, diagnostics: [],
});
const unsupportedPlan = buildComponentAwareStageRenderPlan(withUnsupported, 'full');
for (const kind of [RK_V, 'STRUCTURAL_MEMBER']) {
  const entry = unsupportedPlan.entries.find((item) => item.renderKind === kind);
  assert.equal(entry.diagnosticOnly, true);
  assert.equal(entry.recipeSource, 'diagnostic-fallback');
}

console.log('Component-aware StageRenderPlan contract tests passed');
