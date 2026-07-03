import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const files = [
  'stage/render/StagePreviewPicking.js',
  'stage/render/StageThreePreviewRenderer.js',
  'tabs/viewer3d-json-tab-renderer.js',
  'tests/viewer3d-json-preview-picking.test.js',
];
const sourceFiles = files.filter((file) => !file.endsWith('.test.js'));
const blacklist = [
  'RvmDeferredBridgeLoader',
  'RvmSupportGeometryBridge',
  'RvmPrimitiveFallbackBridge',
  'RvmVisualQualityControlsBridge',
  'RvmZoneLodContextBridge',
  'BrowserRvmRenderSceneBuilder',
  'BrowserRvmCode4ElbowRenderBridge',
  'BrowserRvmTransformParser',
  'BrowserRvmHierarchyTransformParser',
  'MutationObserver',
  'OrbitControls',
  'parseRvm',
  'RvmParser',
  'readRvm',
];
const semanticTokens = ['ownerPath', '.name', '/PS-', 'VALVE', 'FLANGE', 'SUPPORT'];

function read(file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

const picking = read('stage/render/StagePreviewPicking.js');
const renderer = read('stage/render/StageThreePreviewRenderer.js');
const tabRenderer = read('tabs/viewer3d-json-tab-renderer.js');

assert.match(picking, /import \* as THREE from 'three'/);
assert.match(picking, /Raycaster/);
for (const name of ['attachStagePreviewPicking', 'detachStagePreviewPicking', 'pickStagePreviewObject', 'makeStageSelectionRefFromObject']) {
  assert.match(picking, new RegExp(`export function ${name}`));
}
for (const token of ['pointerdown', 'click', 'addEventListener', 'removeEventListener']) assert.ok(picking.includes(token));
for (const token of ['rootGroup.children', 'primitiveId', 'componentId', 'nodeId']) assert.ok(picking.includes(token));
for (const token of semanticTokens) assert.equal(picking.includes(token), false, `picking uses ${token}`);

assert.match(renderer, /StagePreviewPicking\.js/);
assert.match(renderer, /attachStagePreviewPicking/);
assert.match(renderer, /detachStagePreviewPicking/);
assert.match(renderer, /setStagePreviewSelectionCallback/);
assert.match(renderer, /renderEntryId/);
assert.match(tabRenderer, /setStagePreviewSelectionCallback/);
assert.match(tabRenderer, /applyPreviewSelection/);
assert.match(tabRenderer, /Selected \$\{ref\.type\}/);

for (const token of blacklist) {
  for (const file of sourceFiles) assert.equal(read(file).includes(token), false, `${file} contains ${token}`);
}
for (const file of files) {
  const lineCount = read(file).split('\n').length;
  assert.ok(lineCount < 300, `${file} has ${lineCount} lines`);
}

console.log('3D Json Viewer preview picking source tests passed');
