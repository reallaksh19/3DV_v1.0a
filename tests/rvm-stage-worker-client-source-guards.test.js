import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const clientUrl = new URL('../stage/worker/StageWorkerClient.js', import.meta.url);
const jobUrl = new URL('../stage/worker/StageWorkerJob.js', import.meta.url);
const sampleUrl = new URL('../stage/samples/sample-stage-worker-client-v1.js', import.meta.url);

test('StageWorkerClient avoids forbidden imports', () => {
  const source = readText(clientUrl);
  for (const pattern of forbiddenClientPatterns()) assert.doesNotMatch(source, pattern);
});

test('StageWorkerJob contains no parser tokens', () => {
  const source = readText(jobUrl);
  for (const pattern of forbiddenJobPatterns()) assert.doesNotMatch(source, pattern);
});

test('new worker client JS files remain under 300 lines', () => {
  for (const url of [clientUrl, jobUrl, sampleUrl]) {
    assert.ok(readText(url).split('\n').length < 300, `${url.pathname} exceeds line limit`);
  }
});

function readText(url) {
  return readFileSync(url, 'utf8');
}

function forbiddenClientPatterns() {
  return [
    /viewer\/tabs\//,
    /viewer\/stage\/render\//,
    /from\s+['"][^'"]*three[^'"]*['"]/,
    /\bindexedDB\b/,
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

function forbiddenJobPatterns() {
  return [/parseRvm/, /readRvm/, /RvmParser/];
}
