import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const guardedFiles = [
  new URL('../stage/benchmark/RvmBenchmarkEvidenceGate.js', import.meta.url),
  new URL('../docs/3d-json-viewer-phase44a-rvm-benchmark-evidence-gate.md', import.meta.url),
  new URL('./rvm-benchmark-evidence-gate.test.js', import.meta.url),
];

const lineLimitFiles = [
  ...guardedFiles,
  new URL('./rvm-benchmark-evidence-gate-source-guards.test.js', import.meta.url),
];

test('benchmark evidence gate sources avoid forbidden imports and paths', () => {
  const source = guardedFiles.map(readText).join('\n');
  for (const token of forbiddenPathTokens()) assert.equal(source.includes(token), false, `forbidden token found: ${token}`);
});

test('benchmark evidence gate sources avoid old viewer tokens', () => {
  const source = guardedFiles.map(readText).join('\n');
  for (const token of oldViewerTokens()) assert.equal(source.includes(token), false, `old viewer token found: ${token}`);
});

test('new benchmark evidence gate JS files remain under 300 lines', () => {
  for (const file of lineLimitFiles) assert.ok(readText(file).split('\n').length < 300, `${file.pathname} exceeds line limit`);
});

function readText(fileUrl) {
  return readFileSync(fileUrl, 'utf8');
}

function forbiddenPathTokens() {
  return [
    'stage/parser/',
    '../stage/parser/',
    'stage/worker/',
    '../stage/worker/',
    'stage/render/',
    '../stage/render/',
    'stage/ui/',
    'tabs/',
    '../tabs/',
  ];
}

function oldViewerTokens() {
  const rvm = 'Rvm';
  const browser = 'Browser' + rvm;
  return [
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
