import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const modifiedFiles = [
  'stage/render/StageRenderPlan.js',
  'stage/ui/JsonViewerShell.js',
  'stage/ui/JsonViewerDiagnosticsPanel.js',
  'tabs/viewer3d-json-tab-renderer.js',
  'tabs/viewer3d-json-tab.css',
  'tests/rvm-stage-render-plan.test.js',
  'tests/viewer3d-json-render-plan-shell.test.js',
];
const guardedSourceFiles = modifiedFiles.filter((file) => !file.endsWith('.test.js'));
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
  'three',
];

function read(file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

const rendererSource = read('tabs/viewer3d-json-tab-renderer.js');
const renderPlanSource = read('stage/render/StageRenderPlan.js');
const shellSource = read('stage/ui/JsonViewerShell.js');
const diagnosticsSource = read('stage/ui/JsonViewerDiagnosticsPanel.js');
const css = read('tabs/viewer3d-json-tab.css');
const combined = [rendererSource, renderPlanSource, shellSource, diagnosticsSource].join('\n');

assert.match(rendererSource, /StageRenderPlan\.js/);
assert.match(combined, /StageRenderPlan\.v1/);
assert.match(rendererSource, /plan entries/);
assert.match(rendererSource, /render diagnostic/);
assert.match(rendererSource, /canvasMessage\.textContent/);
assert.match(rendererSource, /buildStageRenderPlan/);
assert.match(renderPlanSource, /getStageRenderRecipeForPrimitive/);
assert.match(diagnosticsSource, /source: 'render-plan'/);
assert.match(shellSource, /planEntryText/);
assert.match(css, /white-space: pre-line/);

for (const token of blacklist) {
  for (const file of guardedSourceFiles) assert.equal(read(file).includes(token), false, `${file} contains ${token}`);
}

for (const file of modifiedFiles) {
  const lineCount = read(file).split('\n').length;
  assert.ok(lineCount < 300, `${file} has ${lineCount} lines`);
}

console.log('3D Json Viewer render plan shell source tests passed');
