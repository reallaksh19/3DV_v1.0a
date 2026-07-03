import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const productionSources = [
  new URL('../stage/contracts/StageGeometryChunkContract.js', import.meta.url),
  new URL('../stage/contracts/StageValidation.js', import.meta.url),
  new URL('../stage/samples/sample-geometry-chunk-stage-model-v1.js', import.meta.url),
];

const lineLimitSources = [
  ...productionSources,
  new URL('./rvm-stage-geometry-chunk-contract.test.js', import.meta.url),
  new URL('./rvm-stage-geometry-chunk-validation.test.js', import.meta.url),
  new URL('./rvm-stage-geometry-chunk-source-guards.test.js', import.meta.url),
];

test('geometry chunk sources avoid forbidden imports and parser tokens', () => {
  const source = productionSources.map(readText).join('\n');
  for (const pattern of forbiddenPatterns()) assert.doesNotMatch(source, pattern);
});

test('new and modified geometry chunk JS files remain under 300 lines', () => {
  for (const url of lineLimitSources) assert.ok(readText(url).split('\n').length < 300, `${url.pathname} exceeds line limit`);
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
    new RegExp('parse' + 'Rvm'),
    new RegExp('read' + 'Rvm'),
    new RegExp('Rvm' + 'Parser'),
    new RegExp('Rvm' + 'DeferredBridgeLoader'),
    new RegExp('Rvm' + 'SupportGeometryBridge'),
    new RegExp('Rvm' + 'PrimitiveFallbackBridge'),
    new RegExp('Rvm' + 'VisualQualityControlsBridge'),
    new RegExp('Rvm' + 'ZoneLodContextBridge'),
    new RegExp('BrowserRvm' + 'RenderSceneBuilder'),
    new RegExp('BrowserRvm' + 'Code4ElbowRenderBridge'),
    new RegExp('BrowserRvm' + 'TransformParser'),
    new RegExp('BrowserRvm' + 'HierarchyTransformParser'),
  ];
}
