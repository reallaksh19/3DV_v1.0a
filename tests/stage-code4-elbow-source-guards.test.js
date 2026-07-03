import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const files = [
  'stage/render/StageRenderPlan.js',
  'stage/render/StagePreviewGeometry.js',
  'stage/samples/sample-code4-elbow-stage-model-v1.js',
  'tests/stage-code4-elbow-render-readiness.test.js',
  'tests/stage-code4-elbow-source-guards.test.js',
  'tests/viewer3d-json-component-aware-render-plan.test.js',
];
const production = files.filter((file) => !file.endsWith('.test.js'));
const banned = [
  'stage/parser/',
  'stage/worker/',
  'stage/ui/',
  'tabs/',
  'indexedDB',
  'parseRvm',
  'readRvm',
  'RvmParser',
  'RvmDeferredBridgeLoader',
  'RvmSupportGeometryBridge',
  'RvmPrimitiveFallbackBridge',
  'RvmVisualQualityControlsBridge',
  'RvmZoneLodContextBridge',
  'BrowserRvmRenderSceneBuilder',
  'BrowserRvmCode4ElbowRenderBridge',
  'BrowserRvmTransformParser',
  'BrowserRvmHierarchyTransformParser',
  'code 11 complete',
  'Review parity',
  'Navis parity',
];

function read(file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

const sample = read('stage/samples/sample-code4-elbow-stage-model-v1.js');
const plan = read('stage/render/StageRenderPlan.js');
const preview = read('stage/render/StagePreviewGeometry.js');

assert.ok(sample.includes('nativeCode: 4'));
assert.ok(sample.includes('recordType: \'RVM_PRIMITIVE\''));
assert.ok(sample.includes('not binary decoded'));
assert.ok(sample.includes('not GAS/RMSS evidence'));
assert.ok(plan.includes('STAGE_CODE4_ELBOW_NATIVE_PARAMS_REQUIRED'));
assert.ok(plan.includes('hasCode4ElbowMetadata'));
assert.ok(plan.includes('hasCompleteElbowParams'));
assert.ok(preview.includes('nativeGeometry?.nativeParams'));

for (const token of banned) {
  for (const file of production) assert.equal(read(file).includes(token), false, `${file} contains ${token}`);
}
for (const file of files) {
  const lineCount = read(file).split('\n').length;
  assert.ok(lineCount < 300, `${file} has ${lineCount} lines`);
}

console.log('Code 4 elbow render readiness source guards passed');
