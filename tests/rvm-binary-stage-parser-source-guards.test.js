import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const productionSources = [
  new URL('../stage/parser/RvmBinaryStageParser.js', import.meta.url),
  new URL('../stage/worker/StageWorkerRuntime.js', import.meta.url),
  new URL('../stage/samples/sample-rvm-parser-mvp-binary-v1.js', import.meta.url),
];

const lineLimitSources = [
  ...productionSources,
  new URL('./rvm-binary-stage-parser-mvp.test.js', import.meta.url),
  new URL('./rvm-stage-worker-rvm-parser-mvp.test.js', import.meta.url),
  new URL('./rvm-binary-stage-parser-source-guards.test.js', import.meta.url),
];

test('RVM parser MVP sources avoid UI, style, legacy viewer, cache, and 3D library tokens', () => {
  const source = productionSources.map(readText).join('\n');
  for (const token of forbiddenTokens()) assert.equal(source.includes(token), false, `forbidden token found: ${token}`);
});

test('RVM parser MVP sources avoid semantic-name geometry and code 11 render claims', () => {
  const source = productionSources.map(readText).join('\n').toLowerCase();
  for (const token of forbiddenClaimTokens()) assert.equal(source.includes(token), false, `forbidden claim token found: ${token}`);
});

test('new and modified RVM parser MVP JS files remain under 300 lines', () => {
  for (const url of lineLimitSources) assert.ok(readText(url).split('\n').length < 300, `${url.pathname} exceeds line limit`);
});

function readText(fileUrl) {
  return readFileSync(fileUrl, 'utf8');
}

function forbiddenTokens() {
  const rvm = 'Rvm';
  const browser = 'Browser' + rvm;
  return [
    'tabs/',
    'stage/ui/',
    'styles/',
    'three',
    'indexedDB',
    rvm + 'DeferredBridgeLoader',
    rvm + 'SupportGeometryBridge',
    rvm + 'PrimitiveFallbackBridge',
    rvm + 'VisualQualityControlsBridge',
    rvm + 'ZoneLodContextBridge',
    browser + 'RenderSceneBuilder',
    browser + 'Code4ElbowRenderBridge',
    browser + 'TransformParser',
    browser + 'HierarchyTransformParser',
  ];
}

function forbiddenClaimTokens() {
  return [
    ['support name', 'creates geometry'].join(' '),
    ['valve name', 'creates geometry'].join(' '),
    ['flange name', 'creates geometry'].join(' '),
    ['semantic', 'geometry'].join(' '),
    'code11rendercomplete',
    ['facet_group', 'native complete'].join(' '),
    ['mesh', 'parity'].join(' '),
  ];
}
