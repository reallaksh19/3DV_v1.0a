import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const productionSources = [
  '../stage/benchmark/RvmEvidenceReportRunner.js',
];
const lineLimitSources = [
  ...productionSources,
  './rvm-evidence-report-runner.test.js',
  './rvm-evidence-report-runner-source-guards.test.js',
];

test('evidence runner avoids render, UI, tabs, styles, cache, and legacy viewer tokens', () => {
  const source = productionSources.map(readText).join('\n');
  for (const token of forbiddenTokens()) assert.equal(source.includes(token), false, `forbidden token found: ${token}`);
});

test('evidence runner avoids compatibility and parity claims', () => {
  const source = productionSources.map(readText).join('\n').toLowerCase();
  for (const token of forbiddenClaimTokens()) assert.equal(source.includes(token), false, `forbidden claim token found: ${token}`);
});

test('new evidence runner JS files remain under 300 lines', () => {
  for (const file of lineLimitSources) assert.ok(readText(file).split('\n').length < 300, `${file} exceeds line limit`);
});

function readText(relativePath) {
  return readFileSync(new URL(relativePath, import.meta.url), 'utf8');
}

function forbiddenTokens() {
  const r = 'Rvm';
  const b = 'Browser' + r;
  return [
    'stage/render/',
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
    ['review', 'parity'].join(' '),
    ['navis', 'parity'].join(' '),
    ['gas', 'compatibility', 'proven'].join(' '),
    ['rmss', 'compatibility', 'proven'].join(' '),
  ];
}
