import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const files = [
  'tabs/viewer3d-json-tab.js',
  'tabs/viewer3d-json-tab-renderer.js',
  'stage/ui/JsonViewerShell.js',
  'stage/ui/JsonViewerHierarchyTree.js',
  'stage/ui/JsonViewerPropertiesPanel.js',
  'stage/ui/JsonViewerDiagnosticsPanel.js',
  'stage/ui/RvmUiHandoff.js',
  'stage/ui/RvmStageModelUiSummary.js',
  'stage/worker/StageWorkerClient.js',
  'stage/worker/StageWorkerJob.js',
  'tests/viewer3d-json-tab-shell.test.js',
];
const guardedSourceFiles = files.filter((file) => !file.endsWith('.test.js'));
const blacklist = ['RvmDeferredBridgeLoader', 'RvmSupportGeometryBridge', 'RvmPrimitiveFallbackBridge', 'RvmVisualQualityControlsBridge', 'RvmZoneLodContextBridge', 'BrowserRvmRenderSceneBuilder', 'BrowserRvmCode4ElbowRenderBridge', 'BrowserRvmTransformParser', 'BrowserRvmHierarchyTransformParser', 'indexedDB'];
function read(file) { return fs.readFileSync(path.join(root, file), 'utf8'); }

const tabSource = read('tabs/viewer3d-json-tab.js');
const rendererSource = read('tabs/viewer3d-json-tab-renderer.js');
const shellSource = read('stage/ui/JsonViewerShell.js');
const handoffSource = read('stage/ui/RvmUiHandoff.js');
const diagnosticsSource = read('stage/ui/JsonViewerDiagnosticsPanel.js');
const propertiesSource = read('stage/ui/JsonViewerPropertiesPanel.js');
const summarySource = read('stage/ui/RvmStageModelUiSummary.js');
const css = read('tabs/viewer3d-json-tab.css');
const index = read('index.html');
const combined = [tabSource, rendererSource, shellSource, handoffSource, diagnosticsSource, propertiesSource, summarySource].join('\n');

assert.match(combined, /3D Json Viewer/);
assert.match(combined, /Open Stage JSON/);
assert.match(combined, /Load Sample/);
assert.match(shellSource, /Open RVM/);
assert.match(shellSource, /Download RvmStageModel JSON/);
assert.match(handoffSource, /RVM StageModel generated successfully/);
assert.match(handoffSource, /RVM diagnostics only/);
assert.match(handoffSource, /RVM preflight failed/);
assert.match(rendererSource, /deriveRvmStageUiSummary/);
assert.match(rendererSource, /buildStageModelDownload/);
assert.match(rendererSource, /RVM binary selected/);
assert.match(tabSource + rendererSource, /RvmStageModelContract\.js/);
assert.match(rendererSource, /sample-rvm-stage-model-v1\.js/);
assert.match(rendererSource, /StageWorkerClient\.js/);
assert.match(rendererSource, /StageWorkerJob\.js/);
assert.match(rendererSource, /activeJobId/);
assert.match(diagnosticsSource, /Native Code/);
assert.match(shellSource, /rvmFileInput/);
assert.doesNotMatch(shellSource, /openRvmButton\.disabled = true/);
assert.doesNotMatch(shellSource + rendererSource, /Loaded RVM/);
assert.match(index, /3D Json Viewer/);

for (const token of blacklist) for (const file of guardedSourceFiles) assert.equal(read(file).includes(token), false, `${file} contains ${token}`);
for (const file of files) { const lineCount = read(file).split('\n').length; assert.ok(lineCount < 300, `${file} has ${lineCount} lines`); }
assert.ok(css.split('\n').length < 300, 'CSS line count must stay under 300');
for (const className of ['json-viewer-shell', 'json-viewer-toolbar', 'json-viewer-evidence-panel', 'json-viewer-summary-panel', 'json-viewer-coverage-table', 'json-viewer-status-strip']) assert.ok(css.includes(className), `CSS missing ${className}`);
for (const token of ['severityCounts', 'fallbackCounts', 'renderKindCounts', 'validation:']) assert.ok(diagnosticsSource.includes(token), `Diagnostics missing ${token}`);
for (const token of ['confidence.geometry', 'confidence.semantic', 'primitive count', 'bboxWorld', 'renderPolicy']) assert.ok(propertiesSource.includes(token), `Properties missing ${token}`);

console.log('3D Json Viewer tab shell certification tests passed');
