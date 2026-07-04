import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const files = [
  'tabs/viewer3d-json-tab-renderer.js',
  'stage/worker/StageWorkerJob.js',
  'stage/worker/StageWorkerClient.js',
  'stage/worker/StageWorkerRuntime.js',
  'stage/ui/JsonViewerDiagnosticsPanel.js',
  'stage/ui/JsonViewerShell.js',
  'stage/ui/RvmStageModelUiSummary.js',
  'tests/viewer3d-json-worker-integration.test.js',
];
const sourceFiles = files.filter((file) => !file.endsWith('.test.js'));
const banned = ['RvmDeferredBridgeLoader', 'RvmSupportGeometryBridge', 'RvmPrimitiveFallbackBridge', 'RvmVisualQualityControlsBridge', 'RvmZoneLodContextBridge', 'BrowserRvmRenderSceneBuilder', 'BrowserRvmCode4ElbowRenderBridge', 'BrowserRvmTransformParser', 'BrowserRvmHierarchyTransformParser', 'parseRvm', 'RvmParser', 'readRvm', 'indexedDB'];

function read(file) { return fs.readFileSync(path.join(root, file), 'utf8'); }

const tab = read('tabs/viewer3d-json-tab-renderer.js');
const job = read('stage/worker/StageWorkerJob.js');
const client = read('stage/worker/StageWorkerClient.js');
const runtime = read('stage/worker/StageWorkerRuntime.js');
const diagnostics = read('stage/ui/JsonViewerDiagnosticsPanel.js');
const shell = read('stage/ui/JsonViewerShell.js');
const summary = read('stage/ui/RvmStageModelUiSummary.js');

assert.match(tab, /StageWorkerClient\.js/);
assert.match(tab, /StageWorkerJob\.js/);
assert.match(tab, /createStageJsonWorkerJob/);
assert.match(tab, /createRvmBinaryWorkerJob/);
assert.match(tab, /arrayBuffer/);
assert.match(tab, /activeJobId/);
assert.match(tab, /workerDiagnostics/);
assert.match(tab, /workerDiagnosticKeys/);
assert.match(tab, /addWorkerMessageDiagnostic/);
assert.match(tab, /disposeWorkerClient/);
assert.match(tab, /STAGE_WORKER_PROGRESS/);
assert.match(tab, /reading-file/);
assert.doesNotMatch(tab, /Preview rendering is diagnostic-only \/ not implemented yet/);
assert.match(runtime, /runStageRvmEvidencePipeline/);
assert.match(runtime, /STAGE_WORKER_STAGE_READY/);
assert.match(runtime, /STAGE_WORKER_PACKAGE_READY/);
assert.doesNotMatch(runtime, /parseRvmBinaryToStageModel/);
assert.match(diagnostics, /Native Code/);
assert.match(tab, /createSampleRvmStageModelV1/);
assert.match(tab, /loadSample/);
assert.match(shell, /Open RVM/);
assert.match(shell, /Download RvmStageModel JSON/);
assert.match(summary, /deriveRvmStageUiSummary/);
assert.match(summary, /stageModelDownloadFileName/);
assert.match(client, /terminate/);
assert.match(client, /onMessage/);
assert.match(job, /StageWorkerJob\.v1/);
assert.match(job, /rvm-binary/);

for (const token of banned) for (const file of sourceFiles) assert.equal(read(file).includes(token), false, `${file} contains ${token}`);
for (const file of files) {
  const lineCount = read(file).split('\n').length;
  const limit = (file.includes('viewer3d-json-tab-renderer.js') || file.includes('JsonViewerShell.js')) ? 500 : 300;
  assert.ok(lineCount < limit, `${file} has ${lineCount} lines`);
}

const renderPreviewBlock = tab.match(/function renderPreview[\s\S]*?function renderEvidencePanels/)?.[0] || '';
assert.match(renderPreviewBlock, /state\.previewDiagnostics = \[previewDiagnostic\(error\)\]/);
assert.match(renderPreviewBlock, /state\.activePanel = 'diagnostics'/);
assert.doesNotMatch(renderPreviewBlock, /clearLoadedModel|state\.model = null|downloadButton\.disabled = true/);

console.log('3D Json Viewer worker integration source tests passed');
