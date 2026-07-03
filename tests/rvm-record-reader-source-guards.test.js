import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const guardedFiles = [
  new URL('../stage/parser/RvmRecordReader.js', import.meta.url),
  new URL('../docs/3d-json-viewer-phase42a-rvm-record-reader.md', import.meta.url),
];

const lineLimitFiles = [
  ...guardedFiles,
  new URL('./rvm-record-reader.test.js', import.meta.url),
  new URL('./rvm-record-reader-source-guards.test.js', import.meta.url),
];

test('record reader sources avoid forbidden imports and legacy tokens', () => {
  const source = guardedFiles.map(readText).join('\n');
  for (const token of forbiddenTokens()) assert.equal(source.includes(token), false, `forbidden token found: ${token}`);
});

test('new record reader JS files remain under 300 lines', () => {
  for (const file of lineLimitFiles) assert.ok(readText(file).split('\n').length < 300, `${file.pathname} exceeds line limit`);
});

function readText(fileUrl) {
  return readFileSync(fileUrl, 'utf8');
}

function forbiddenTokens() {
  const rvm = 'Rvm';
  const browser = 'Browser' + rvm;
  return [
    'stage/render/',
    'stage/ui/',
    'tabs/',
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
