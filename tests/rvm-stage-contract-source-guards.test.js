import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const guardedSources = [
  new URL('../stage/contracts/StageNativeGeometryContract.js', import.meta.url),
  new URL('../stage/contracts/StageValidation.js', import.meta.url),
  new URL('../stage/samples/sample-native-geometry-stage-model-v1.js', import.meta.url),
  new URL('./rvm-stage-native-geometry-contract.test.js', import.meta.url),
  new URL('./rvm-stage-contract-validation.test.js', import.meta.url),
];

test('native geometry contract sources avoid forbidden imports and parser tokens', () => {
  const source = guardedSources.map(readText).join('\n');
  for (const pattern of forbiddenPatterns()) assert.doesNotMatch(source, pattern);
});

test('new and modified native geometry JS files remain under 300 lines', () => {
  for (const url of guardedSources) assert.ok(readText(url).split('\n').length < 300, `${url.pathname} exceeds line limit`);
});

function readText(url) {
  return readFileSync(url, 'utf8');
}

function forbiddenPatterns() {
  return [
    /viewer\/tabs\//,
    /viewer\/stage\/render\//,
    /viewer\/stage\/ui\//,
    /viewer\/stage\/worker\//,
    /from\s+['"][^'"]*three[^'"]*['"]/,
    /\bindexedDB\b/,
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
