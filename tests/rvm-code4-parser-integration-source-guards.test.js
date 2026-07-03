import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const productionSources = [
  '../stage/parser/RvmBinaryStageParser.js',
  '../stage/worker/StageWorkerRuntime.js',
  '../stage/samples/sample-rvm-parser-code4-binary-v1.js',
];
const lineLimitSources = [
  ...productionSources,
  './rvm-binary-stage-parser-code4.test.js',
  './rvm-stage-worker-rvm-parser-code4.test.js',
  './rvm-code4-parser-integration-source-guards.test.js',
  './rvm-binary-stage-parser-mvp.test.js',
];

test('code 4 parser integration sources avoid blocked dependency paths', () => {
  const source = productionSources.map(readText).join('\n');
  for (const token of forbiddenTokens()) assert.equal(source.includes(token), false, `forbidden token found: ${token}`);
});

test('code 4 parser integration avoids code 11, mesh, and parity claims', () => {
  const source = productionSources.map(readText).join('\n').toLowerCase();
  for (const token of forbiddenClaimTokens()) assert.equal(source.includes(token), false, `forbidden claim token found: ${token}`);
});

test('code 4 parser integration JS files remain under 300 lines', () => {
  for (const file of lineLimitSources) assert.ok(readText(file).split('\n').length < 300, `${file} exceeds line limit`);
});

function readText(relativePath) {
  return readFileSync(new URL(relativePath, import.meta.url), 'utf8');
}

function forbiddenTokens() {
  const r = 'Rvm';
  const b = 'Browser' + r;
  return [
    'stage/ui/',
    'tabs/',
    'styles/',
    'three',
    'indexedDB',
    r + 'Deferred' + 'BridgeLoader',
    r + 'Support' + 'GeometryBridge',
    r + 'Primitive' + 'FallbackBridge',
    r + 'Visual' + 'QualityControlsBridge',
    r + 'Zone' + 'LodContextBridge',
    b + 'Render' + 'SceneBuilder',
    b + 'Code4' + 'ElbowRenderBridge',
    b + 'Transform' + 'Parser',
    b + 'Hierarchy' + 'TransformParser',
  ];
}

function forbiddenClaimTokens() {
  return [
    'code 11 decoded',
    'code11decoded',
    ['facet_group', 'native complete'].join(' '),
    ['mesh', 'parity'].join(' '),
    ['review', 'parity'].join(' '),
    ['navis', 'parity'].join(' '),
  ];
}
