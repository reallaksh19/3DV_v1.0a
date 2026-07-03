import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const files = [
  'stage/parser/RvmDiagnosticsScanner.js',
  'stage/worker/StageWorkerRuntime.js',
  'stage/samples/sample-rvm-diagnostics-binary-v1.js',
  'tests/rvm-diagnostics-scanner.test.js',
  'tests/rvm-stage-worker-rvm-diagnostics.test.js',
  'tests/rvm-diagnostics-scanner-source-guards.test.js',
];
const guarded = [
  'stage/parser/RvmDiagnosticsScanner.js',
  'stage/samples/sample-rvm-diagnostics-binary-v1.js',
];
const banned = [
  'tabs/',
  'stage/render/',
  'stage/ui/',
  'three',
  'indexedDB',
  'createEmptyRvmStageModel',
  'buildStageRenderPlan',
  'createGeometryChunk',
  'geometryChunks',
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
];

function read(file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

const scanner = read('stage/parser/RvmDiagnosticsScanner.js');
const runtime = read('stage/worker/StageWorkerRuntime.js');

assert.match(scanner, /DataView/);
assert.match(scanner, /scanRvmBinaryDiagnostics/);
assert.match(scanner, /RvmDiagnosticsReport\.v1/);
assert.match(runtime, /runStageRvmEvidencePipeline/);
assert.doesNotMatch(runtime, /STAGE_RVM_PARSING_NOT_IMPLEMENTED/);
assert.doesNotMatch(scanner, /RvmStageModel\.v1/);
assert.doesNotMatch(scanner, /renderPlan/);
assert.doesNotMatch(scanner, /stageModel/);

for (const token of banned) {
  for (const file of guarded) assert.equal(read(file).includes(token), false, `${file} contains ${token}`);
}
for (const file of files) {
  const lineCount = read(file).split('\n').length;
  assert.ok(lineCount < 300, `${file} has ${lineCount} lines`);
}

console.log('RVM diagnostics scanner source guards passed');
