import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const files = [
  'tabs/viewer3d-json-tab-renderer.js',
  'stage/ui/JsonViewerShell.js',
  'stage/ui/RvmUiHandoff.js',
  'stage/ui/RvmStageModelUiSummary.js',
  'stage/worker/StageWorkerJob.js',
  'stage/worker/StageWorkerClient.js',
  'stage/worker/StageWorkerRuntime.js',
  'stage/worker/StageRvmBinaryPreflight.js',
  'tests/viewer3d-json-rvm-dry-run.test.js',
];
const sourceFiles = files.filter((file) => !file.endsWith('.test.js'));
const banned = ['parseRvmBinaryToStageModel', 'RvmDeferredBridgeLoader', 'RvmSupportGeometryBridge', 'RvmPrimitiveFallbackBridge', 'RvmVisualQualityControlsBridge', 'RvmZoneLodContextBridge', 'BrowserRvmRenderSceneBuilder', 'BrowserRvmCode4ElbowRenderBridge', 'BrowserRvmTransformParser', 'BrowserRvmHierarchyTransformParser', 'indexedDB'];
function read(file) { return fs.readFileSync(path.join(root, file), 'utf8'); }

const tab = read('tabs/viewer3d-json-tab-renderer.js');
const shell = read('stage/ui/JsonViewerShell.js');
const handoff = read('stage/ui/RvmUiHandoff.js');
const summary = read('stage/ui/RvmStageModelUiSummary.js');
const job = read('stage/worker/StageWorkerJob.js');
const client = read('stage/worker/StageWorkerClient.js');
const runtime = read('stage/worker/StageWorkerRuntime.js');
const preflight = read('stage/worker/StageRvmBinaryPreflight.js');

assert.match(tab, /createRvmBinaryWorkerJob/);
assert.match(tab, /arrayBuffer/);
assert.match(tab, /hashArrayBuffer/);
assert.match(tab, /RVM binary selected/);
assert.match(tab, /buildStageModelDownload/);
assert.match(tab, /clearLoadedModel/);
assert.match(tab, /model = null/);
assert.match(tab, /renderPlan = null/);
assert.match(tab, /activeJobId/);
assert.match(tab, /createStageJsonWorkerJob/);
assert.match(tab, /loadSample/);
assert.match(shell, /Open RVM/);
assert.match(shell, /Download RvmStageModel JSON/);
assert.match(shell, /accept = '.rvm'/);
assert.doesNotMatch(shell + tab, /Loaded RVM/);
assert.match(handoff, /RVM StageModel generated successfully/);
assert.match(summary, /stageModelDownloadFileName/);
assert.match(job, /createRvmBinaryWorkerJob/);
assert.match(job, /rvm-binary/);
assert.match(client, /runStageWorkerClientJob/);
assert.match(runtime, /runStageRvmEvidencePipeline/);
assert.match(runtime, /STAGE_RVM_PREFLIGHT_FAILED/);
assert.doesNotMatch(runtime, /STAGE_RVM_PARSING_NOT_IMPLEMENTED/);
assert.match(preflight, /STAGE_RVM_PREFLIGHT_EMPTY_BINARY/);

for (const token of banned) for (const file of sourceFiles) assert.equal(read(file).includes(token), false, `${file} contains ${token}`);
for (const file of files) { const lineCount = read(file).split('\n').length; assert.ok(lineCount < 300, `${file} has ${lineCount} lines`); }

console.log('3D Json Viewer RVM evidence UI source tests passed');
