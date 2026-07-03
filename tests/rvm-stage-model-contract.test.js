import assert from 'node:assert/strict';
import test from 'node:test';
import {
  RVM_STAGE_SCHEMA,
  STAGE_RENDER_KINDS,
  STAGE_SEMANTIC_TYPES,
  addStageDiagnostic,
  countStageDiagnostics,
  createEmptyRvmStageModel,
  makeStageId,
  normalizeRenderQuality,
  validateRvmStageModel,
  validateStageComponent,
  validateStageNode,
  validateStagePrimitive,
} from '../stage/contracts/RvmStageModelContract.js';

test('empty stage model exposes strict schema and identity helpers', () => {
  const model = createEmptyRvmStageModel({ fileName: 'sample.rvm', fileSize: 1024, fileHash: 'sha256-demo' });
  assert.equal(model.schema, RVM_STAGE_SCHEMA);
  assert.equal(model.source.fileName, 'sample.rvm');
  assert.equal(model.hierarchy.rootId, 'node-root');
  assert.equal(makeStageId('node', 7), 'node-000007');
  assert.ok(STAGE_RENDER_KINDS.includes('UNKNOWN_DIAGNOSTIC'));
  assert.ok(STAGE_SEMANTIC_TYPES.includes('SUPPORT'));
});

test('valid native pipe component passes validation', () => {
  const model = createNativePipeModel();
  const result = validateRvmStageModel(model);
  assert.equal(result.valid, true, result.errors.join('\n'));
});

test('invalid renderKind is rejected', () => {
  const model = createNativePipeModel();
  model.primitives[0].renderKind = 'GIANT_SUPPORT_STAND';
  const result = validateRvmStageModel(model);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((line) => line.includes('STAGE_INVALID_RENDER_KIND')));
});

test('invalid bbox is rejected', () => {
  const model = createNativePipeModel();
  model.primitives[0].transform.bboxWorld = [4, 0, 0, 1, 1, 1];
  const result = validateRvmStageModel(model);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((line) => line.includes('STAGE_INVALID_BBOX')));
});

test('missing renderPolicy quality is rejected', () => {
  const model = createNativePipeModel();
  delete model.components[0].renderPolicy.medium;
  const result = validateRvmStageModel(model);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((line) => line.includes('STAGE_MISSING_RENDER_POLICY')));
});

test('semantic-only support geometry is rejected unless downgraded to diagnostic', () => {
  const model = createNativePipeModel();
  model.components[0].semanticType = 'SUPPORT';
  model.components[0].confidence.geometry = 'semantic-proxy';
  model.primitives[0].confidence.geometry = 'semantic-proxy';
  model.primitives[0].renderKind = 'SUPPORT_ASSEMBLY';
  const result = validateRvmStageModel(model);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((line) => line.includes('STAGE_FALLBACK_SEMANTIC_ONLY_GEOMETRY')));
});

test('diagnostic fallback increments fallbackCounts and severityCounts', () => {
  const model = createNativePipeModel();
  const message = {
    severity: 'warning',
    code: 'STAGE_FALLBACK_UNKNOWN_NATIVE_CODE',
    message: 'Unknown primitive uses diagnostic bbox fallback.',
    ref: { nodeId: 'node-000001', componentId: 'comp-000001', primitiveId: 'prim-000001', nativeCode: 99 },
    fallback: { reason: 'unknown-native-code', renderKind: 'UNKNOWN_DIAGNOSTIC', recipe: 'bbox-wireframe' },
  };
  const diagnostics = addStageDiagnostic(model.diagnostics, message);
  assert.equal(diagnostics.severityCounts.warning, 1);
  assert.equal(diagnostics.fallbackCounts['unknown-native-code'], 1);
  assert.equal(diagnostics.renderKindCounts.UNKNOWN_DIAGNOSTIC, 1);
  assert.equal(countStageDiagnostics(diagnostics).severityCounts.warning, 1);
});

test('invalid diagnostic severity is rejected', () => {
  assert.throws(() => addStageDiagnostic(undefined, {
    severity: 'notice',
    code: 'STAGE_BAD',
    message: 'bad severity',
    ref: {},
  }), /invalid diagnostic severity/);
});

test('individual validators and render quality normalization remain exported', () => {
  const model = createNativePipeModel();
  assert.equal(validateStageNode(model.hierarchy.nodes[0], new Set(['node-root'])).length, 0);
  assert.equal(validateStageComponent(model.components[0], new Set()).length, 0);
  assert.equal(validateStagePrimitive(model.primitives[0], new Set(), new Set(['comp-000001'])).length, 0);
  assert.equal(normalizeRenderQuality('100'), 'full');
  assert.equal(normalizeRenderQuality('50'), 'light');
  assert.equal(normalizeRenderQuality('hide'), 'hidden');
});

function createNativePipeModel() {
  const model = createEmptyRvmStageModel({ fileName: 'sample.rvm', fileSize: 1024, fileHash: 'sha256-demo' });
  model.hierarchy.nodes.push({
    id: 'node-000001',
    parentId: 'node-root',
    name: '/PIPE-001',
    path: '/AREA/PIPE-001',
    kind: 'RVM_NATIVE_CONTAINER',
    componentIds: ['comp-000001'],
    primitiveIds: ['prim-000001'],
    bboxWorld: [0, 0, 0, 2, 1, 1],
  });
  model.components.push({
    id: 'comp-000001',
    nodeId: 'node-000001',
    semanticType: 'PIPE',
    name: '/PIPE-001',
    ownerPath: '/AREA/PIPE-001',
    primitiveIds: ['prim-000001'],
    bboxWorld: [0, 0, 0, 2, 1, 1],
    confidence: { geometry: 'native', semantic: 'attribute' },
    renderPolicy: createRenderPolicy(),
    diagnostics: [],
  });
  model.primitives.push({
    id: 'prim-000001',
    nodeId: 'node-000001',
    componentId: 'comp-000001',
    native: { recordOffset: 128, code: 8, kind: 'Cylinder', decoded: true },
    transform: { matrix3x4: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0], bboxLocal: [0, 0, 0, 2, 1, 1], bboxWorld: [0, 0, 0, 2, 1, 1] },
    params: { radius: 0.1 },
    confidence: { geometry: 'native', semantic: 'attribute' },
    renderKind: 'CYLINDER',
    materialId: 'mat-001',
    diagnostics: [],
  });
  return model;
}

function createRenderPolicy() {
  return {
    full: 'native-assembly',
    medium: 'simplified-assembly',
    light: 'proxy',
    skeleton: 'centerline-symbol',
    hidden: 'hide',
  };
}
