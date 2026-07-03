import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const guardedFiles = [
  new URL('../stage/parser/RvmCode4ElbowDecoder.js', import.meta.url),
  new URL('../stage/samples/sample-rvm-code4-elbow-binary-v1.js', import.meta.url),
  new URL('../docs/3d-json-viewer-phase43a-code4-payload-decoder.md', import.meta.url),
];

const lineLimitFiles = [
  ...guardedFiles,
  new URL('./rvm-code4-elbow-decoder.test.js', import.meta.url),
  new URL('./rvm-code4-elbow-decoder-source-guards.test.js', import.meta.url),
];

test('code 4 decoder sources avoid forbidden imports and legacy tokens', () => {
  const source = guardedFiles.map(readText).join('\n');
  for (const token of forbiddenTokens()) assert.equal(source.includes(token), false, `forbidden token found: ${token}`);
});

test('code 4 decoder sources avoid stage-output and code-11 claims', () => {
  const source = guardedFiles.map(readText).join('\n');
  for (const token of forbiddenClaimTokens()) assert.equal(source.includes(token), false, `forbidden claim token found: ${token}`);
});

test('new code 4 decoder JS files remain under 300 lines', () => {
  for (const file of lineLimitFiles) assert.ok(readText(file).split('\n').length < 300, `${file.pathname} exceeds line limit`);
});

function readText(fileUrl) {
  return readFileSync(fileUrl, 'utf8');
}

function forbiddenTokens() {
  const rvm = 'Rvm';
  const browser = 'Browser' + rvm;
  return [
    'stage/worker/',
    'stage/render/',
    'stage/ui/',
    'tabs/',
    'styles/',
    'three',
    'indexedDB',
    rvm + 'DeferredBridgeLoader',
    rvm + 'SupportGeometryBridge',
    rvm + 'PrimitiveFallbackBridge',
    rvm + 'VisualQualityControlsBridge',
    rvm + 'ZoneLodContextBridge',
    browser + 'RenderSceneBuilder',
    browser + 'Code4ElbowRenderBridge',
    browser + 'TransformParser',
    browser + 'HierarchyTransformParser',
  ];
}

function forbiddenClaimTokens() {
  return [
    'RvmStageModel.v1',
    'StageRenderPlan.v1',
    'geometryChunks:',
    'code11RenderComplete',
    'FACET_GROUP native complete',
    'GAS/RMSS compatibility proven',
    'Review parity',
    'Navis parity',
  ];
}
