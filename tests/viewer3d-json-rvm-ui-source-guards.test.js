import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const files = [
  'stage/ui/RvmUiHandoff.js',
  'stage/ui/JsonViewerShell.js',
  'tabs/viewer3d-json-tab-renderer.js',
  'tests/viewer3d-json-rvm-ui-handoff.test.js',
  'tests/viewer3d-json-rvm-ui-source-guards.test.js',
];
const guarded = [
  'stage/ui/RvmUiHandoff.js',
  'stage/ui/JsonViewerShell.js',
  'tabs/viewer3d-json-tab-renderer.js',
];
const banned = [
  'stage/parser/',
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
  'Native RVM support complete',
  'Loaded RVM',
  'Navis parity',
  'Review parity',
  'code 11 complete',
];

function read(file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

const handoff = read('stage/ui/RvmUiHandoff.js');
const shell = read('stage/ui/JsonViewerShell.js');
const renderer = read('tabs/viewer3d-json-tab-renderer.js');

assert.ok(handoff.includes('RVM StageModel generated successfully'));
assert.ok(handoff.includes('RVM diagnostics only'));
assert.ok(handoff.includes('RVM preflight failed'));
assert.equal(handoff.includes('MVP parser slice'), false);
assert.ok(shell.includes("'Open RVM'"));
assert.equal(shell.includes('Open RVM (dry-run)'), false);
assert.ok(renderer.includes('classifyRvmWorkerResult'));
assert.ok(renderer.includes("'rvm-binary'"));
assert.equal(handoff.includes("from '../parser"), false);
assert.equal(handoff.includes("from '../render"), false);
assert.equal(handoff.includes("from 'three'"), false);

for (const token of banned) {
  for (const file of guarded) assert.equal(read(file).includes(token), false, `${file} contains ${token}`);
}
for (const file of files) {
  const lineCount = read(file).split('\n').length;
  assert.ok(lineCount < 300, `${file} has ${lineCount} lines`);
}

console.log('3D Json Viewer RVM UI source guards passed');
