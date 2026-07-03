import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const workerSourceUrl = new URL('../stage/worker/stage-worker.js', import.meta.url);
const runtimeSourceUrl = new URL('../stage/worker/StageWorkerRuntime.js', import.meta.url);
const preflightSourceUrl = new URL('../stage/worker/StageRvmBinaryPreflight.js', import.meta.url);
const sampleJobUrl = new URL('../stage/samples/sample-stage-worker-job-v1.js', import.meta.url);

test('browser worker entry contains self.onmessage', () => {
  assert.match(readText(workerSourceUrl), /self\.onmessage\s*=/);
});

test('worker source avoids forbidden imports and globals', () => {
  const source = `${readText(workerSourceUrl)}\n${readText(runtimeSourceUrl)}\n${readText(preflightSourceUrl)}`;
  for (const pattern of forbiddenPatterns()) assert.doesNotMatch(source, pattern);
});

test('new worker shell JS files remain under 300 lines', () => {
  for (const url of [workerSourceUrl, runtimeSourceUrl, preflightSourceUrl, sampleJobUrl]) {
    assert.ok(readText(url).split('\n').length < 300, `${url.pathname} exceeds line limit`);
  }
});

function readText(url) {
  return readFileSync(url, 'utf8');
}

function forbiddenPatterns() {
  return [
    /viewer\/tabs\//,
    /viewer\/stage\/render\//,
    /from\s+['"][^'"]*three[^'"]*['"]/,
    /\bindexedDB\b/,
    /\bnew\s+Worker\b/,
    /parseRvm/,
    /readRvm/,
    /RvmParser/,
    /RvmDeferredBridgeLoader/,
    /RvmSupportGeometryBridge/,
    /RvmPrimitiveFallbackBridge/,
    /RvmVisualQualityControlsBridge/,
    /RvmZoneLodContextBridge/,
    /BrowserRvmRenderSceneBuilder/,
    /BrowserRvmCode4ElbowRenderBridge/,
    /BrowserRvmTransformParser/,
    /BrowserRvmHierarchyTransformParser/,
  ];
}
