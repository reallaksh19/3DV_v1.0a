import assert from 'node:assert/strict';
import test from 'node:test';
import { createStageWorkerRuntime, runStageWorkerJob } from '../stage/worker/StageWorkerRuntime.js';
import { validateStageWorkerMessage, validateStageWorkerOutput } from '../stage/contracts/RvmStageModelContract.js';
import { createSampleStageJsonWorkerJobV1 } from '../stage/samples/sample-stage-worker-job-v1.js';

test('sample stage-json job succeeds and passes worker acceptance', async () => {
  const result = await runStageWorkerJob(createStageWorkerRuntime(), createSampleStageJsonWorkerJobV1());
  assert.equal(result.ok, true, result.error?.message || 'expected success');
  const acceptance = validateStageWorkerOutput(result);
  assert.equal(acceptance.valid, true, acceptance.errors.join('\n'));
});

test('runtime emits READY/START/PROGRESS/STAGE_READY/PACKAGE_READY', async () => {
  const emitted = [];
  const runtime = createStageWorkerRuntime({ onMessage: (message) => emitted.push(message) });
  const result = await runStageWorkerJob(runtime, createSampleStageJsonWorkerJobV1());
  assert.equal(result.ok, true);
  assertHasTypes(emitted, ['STAGE_WORKER_READY', 'STAGE_WORKER_START', 'STAGE_WORKER_PROGRESS', 'STAGE_WORKER_STAGE_READY', 'STAGE_WORKER_PACKAGE_READY']);
});

test('valid wide-tag RVM binary routes through evidence StageModel pipeline', async () => {
  const job = makeRvmJob([head(), cntb('ROUTE-A'), prim8(), prim11(), cnte(), end()]);
  const result = await runStageWorkerJob(createStageWorkerRuntime(), job);
  assert.equal(result.ok, true, result.error?.message || 'expected RVM worker success');
  assert.equal(result.stageModel.schema, 'RvmStageModel.v1');
  assert.equal(result.stageModel.source.kind, 'rvm-binary');
  assert.equal(result.stageModel.source.attAvailable, false);
  assert.equal(result.stageModel.parser.parserComplete, false);
  assert.equal(result.stageModel.parser.visualParityClaimed, false);
  assert.equal(result.stageModel.primitives.length, 2);
  assert.equal(result.stageModel.primitives.find((p) => p.nativeCode === 8).decodeStatus, 'decoded-native');
  assert.equal(result.stageModel.primitives.find((p) => p.nativeCode === 11).geometry.facetGroup.decoded, true);
  assertNoMessageCode(result.messages, 'STAGE_RVM_PARSING_NOT_IMPLEMENTED');
});

test('ATT-managed hierarchy JSON is accepted as a hierarchy-only StageModel', async () => {
  const job = { ...createSampleStageJsonWorkerJobV1(), text: JSON.stringify([{ name: '/LINE/B1', type: 'BRANCH', children: [] }]) };
  const result = await runStageWorkerJob(createStageWorkerRuntime(), job);
  assert.equal(result.ok, true, result.error?.message || 'expected worker success');
  assert.equal(result.stageModel.schema, 'RvmStageModel.v1');
  assert.equal(result.stageModel.source.kind, 'att-managed-hierarchy');
  assert.equal(result.stageModel.primitives.length, 0);
  assert.ok(result.stageModel.hierarchy.nodes.some((node) => node.name === '/LINE/B1'));
  assert.ok(result.stageModel.diagnostics.messages.some((message) => message.code === 'STAGE_ATT_HIERARCHY_NO_GEOMETRY'));
});

test('malformed JSON returns controlled protocol error', async () => {
  const job = { ...createSampleStageJsonWorkerJobV1(), text: '{ not valid json' };
  const result = await runStageWorkerJob(createStageWorkerRuntime(), job);
  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'STAGE_JSON_PARSE_FAILED');
  assertHasTypes(result.messages, ['STAGE_WORKER_ERROR']);
});

test('invalid stage model returns controlled validation error', async () => {
  const job = { ...createSampleStageJsonWorkerJobV1(), text: JSON.stringify({ schema: 'BadModel.v1' }) };
  const result = await runStageWorkerJob(createStageWorkerRuntime(), job);
  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'STAGE_MODEL_VALIDATION_FAILED');
  assert.ok(result.validationErrors.length > 0);
});

test('rvm-binary job with invalid preflight returns preflight failure', async () => {
  const job = { kind: 'rvm-binary', jobId: 'bad-rvm', fileName: 'bad.rvm', fileHash: '', arrayBuffer: new ArrayBuffer(0), fileSize: 0 };
  const result = await runStageWorkerJob(createStageWorkerRuntime(), job);
  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'STAGE_RVM_PREFLIGHT_FAILED');
  assert.ok(result.error.context.preflight.errors.length >= 1);
});

test('RVM worker result keeps evidence-only parser/render claims false', async () => {
  const result = await runStageWorkerJob(createStageWorkerRuntime(), makeRvmJob([head(), cntb('E'), prim8(), cnte(), end()]));
  assert.equal(result.ok, true);
  assert.equal(JSON.stringify(result.stageModel).includes('"parserComplete":true'), false);
  assert.equal(JSON.stringify(result.stageModel).includes('"visualParityClaimed":true'), false);
  assert.equal(JSON.stringify(result.stageModel).includes('"renderReady":true'), false);
});

test('all emitted stage-json and rvm-binary messages validate through protocol contract', async () => {
  assertMessagesValid((await runStageWorkerJob(createStageWorkerRuntime(), createSampleStageJsonWorkerJobV1())).messages);
  assertMessagesValid((await runStageWorkerJob(createStageWorkerRuntime(), makeRvmJob([head(), cntb('P'), prim8(), cnte(), end()]))).messages);
});

function makeRvmJob(records) {
  const arrayBuffer = makeWideRvm(records);
  return { kind: 'rvm-binary', jobId: 'job-rvm-wide-001', fileName: 'tiny.rvm', fileHash: 'sha256-tiny-wide', fileSize: arrayBuffer.byteLength, arrayBuffer };
}

function makeWideRvm(records) {
  const sized = records.map((record) => ({ ...record, byteLength: 32 + payloadLength(record) }));
  const buffer = new ArrayBuffer(sized.reduce((sum, record) => sum + record.byteLength, 0));
  const view = new DataView(buffer);
  let offset = 0;
  for (const record of sized) { writeRecord(view, offset, record, offset + record.byteLength); writePayload(view, offset + 32, record); offset += record.byteLength; }
  return buffer;
}

function writeRecord(view, offset, record, nextOffset) { [...record.tag].forEach((char, index) => view.setUint32(offset + index * 4, char.charCodeAt(0), false)); view.setUint32(offset + 16, nextOffset, false); view.setUint32(offset + 20, 1, false); view.setUint32(offset + 24, 0, false); view.setUint32(offset + 28, record.code || 0, false); }
function writePayload(view, offset, record) { if (record.text) [...record.text].forEach((char, index) => view.setUint8(offset + index, char.charCodeAt(0))); if (record.floats) record.floats.forEach((value, index) => view.setFloat32(offset + index * 4, value, false)); if (record.facet) writeFacet(view, offset + record.floats.length * 4, record.facet); }
function writeFacet(view, offset, facet) { const vertices = facet.vertices; view.setUint32(offset, 1, false); view.setUint32(offset + 4, 1, false); view.setUint32(offset + 8, vertices.length, false); let p = offset + 12; for (const vertex of vertices) for (const value of [...vertex, 0, 0, 1]) { view.setFloat32(p, value, false); p += 4; } }
function payloadLength(record) { const textLength = new TextEncoder().encode(record.text || '').byteLength; const floatLength = record.floats ? record.floats.length * 4 : 0; const facetLength = record.facet ? 12 + record.facet.vertices.length * 24 : 0; return Math.max(textLength, floatLength + facetLength); }
function head() { return { tag: 'HEAD' }; }
function cntb(text) { return { tag: 'CNTB', text }; }
function cnte() { return { tag: 'CNTE' }; }
function end() { return { tag: 'END:' }; }
function prim8() { return { tag: 'PRIM', code: 8, floats: [...identity(), 0, 0, 0, 2, 2, 10, 1, 10] }; }
function prim11() { return { tag: 'PRIM', code: 11, floats: [...identity(), 0, 0, 0, 1, 1, 0], facet: { vertices: [[0, 0, 0], [1, 0, 0], [0, 1, 0]] } }; }
function identity() { return [1, 0, 0, 0, 1, 0, 0, 0, 1, 10, 20, 30]; }
function assertMessagesValid(messages) { for (const message of messages) assert.equal(validateStageWorkerMessage(message).valid, true, JSON.stringify(message)); }
function assertNoMessageCode(messages, code) { assert.equal(messages.some((message) => message?.payload?.code === code), false); }
function assertHasTypes(messages, types) { const actual = new Set(messages.map((message) => message.type)); for (const type of types) assert.ok(actual.has(type), `missing ${type}`); }
