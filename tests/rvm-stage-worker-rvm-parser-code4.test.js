import assert from 'node:assert/strict';
import test from 'node:test';
import { createSampleRvmParserCode4BinaryV1 } from '../stage/samples/sample-rvm-parser-code4-binary-v1.js';
import { createStageWorkerRuntime, runStageWorkerJob } from '../stage/worker/StageWorkerRuntime.js';
import { validateRvmStageModel } from '../stage/contracts/RvmStageModelContract.js';

const PREFLIGHT_FAILED = 'STAGE_RVM_PREFLIGHT_FAILED';

test('wide-tag code 4 fixture through worker returns ok true', async () => {
  const result = await runStageWorkerJob(createStageWorkerRuntime(), makeWideCode4Job());
  assert.equal(result.ok, true, result.error?.message || '');
  assert.ok(result.stageModel);
  assert.ok(result.renderPlan);
  assert.ok(result.manifest);
  assert.equal(result.readerReport.schema, 'RvmWideRecordReaderReport.v1');
  assert.equal(result.primitiveDecodeReport.coverage.decodedByCode['4'], 1);
  assert.ok(!JSON.stringify(result).includes('STAGE_RVM_PARSING_NOT_IMPLEMENTED'));
});

test('worker emits stage and package ready for code 4 fixture', async () => {
  const result = await runStageWorkerJob(createStageWorkerRuntime(), makeWideCode4Job());
  const types = result.messages.map((message) => message.type);
  assert.ok(types.includes('STAGE_WORKER_STAGE_READY'));
  assert.ok(types.includes('STAGE_WORKER_PACKAGE_READY'));
});

test('worker stage model and render plan contain diagnostic code 4 handoff', async () => {
  const result = await runStageWorkerJob(createStageWorkerRuntime(), makeWideCode4Job());
  const modelValidation = validateRvmStageModel(result.stageModel);
  assert.equal(modelValidation.valid, true, modelValidation.errors.join('\n'));
  const elbow = result.stageModel.primitives.find((primitive) => primitive.nativeCode === 4);
  assert.ok(elbow);
  assert.equal(elbow.decodeStatus, 'decoded-native');
  assert.equal(elbow.renderKind, 'ELBOW');
  assert.equal(elbow.geometry.renderReady, false);
  const entry = result.renderPlan.entries.find((item) => item.renderKind === 'ELBOW');
  assert.ok(entry);
  assert.equal(entry.supportLevel, 'supported');
  assert.equal(entry.recipeSource, 'native');
  assert.equal(entry.diagnosticOnly, false);
  assert.ok(entry.nativeGeometryRef);
});

test('unsupported malformed binary still returns evidence output', async () => {
  const result = await runStageWorkerJob(createStageWorkerRuntime(), nonmatchingJob());
  assert.equal(result.ok, true);
  assert.equal(result.readerReport.errors[0].code, 'RVM_WIDE_READER_NO_WIDE_TAG');
  assert.equal(result.stageModel.parser.parserComplete, false);
  assert.equal(result.stageModel.parser.visualParityClaimed, false);
  assertReady(result);
  assert.ok(!JSON.stringify(result).includes('STAGE_RVM_PARSING_NOT_IMPLEMENTED'));
});

test('invalid preflight still returns preflight failed', async () => {
  const job = { ...createSampleRvmParserCode4BinaryV1(), fileHash: '', fileSize: 0, arrayBuffer: new ArrayBuffer(0) };
  const result = await runStageWorkerJob(createStageWorkerRuntime(), job);
  assert.equal(result.ok, false);
  assert.equal(result.error.code, PREFLIGHT_FAILED);
});

function nonmatchingJob() {
  return { jobId: 'job-nonmatching-rvm-parser-code4', kind: 'rvm-binary', fileName: 'nonmatching-rvm-parser-code4.rvm', fileHash: 'sha256-nonmatching-rvm-parser-code4', fileSize: 8, arrayBuffer: new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]).buffer };
}

function makeWideCode4Job() {
  const arrayBuffer = makeWideRvm([head(), cntb('CODE4'), prim4(), cnte(), end()]);
  return { schema: 'StageWorkerJob.v1', jobId: 'job-wide-code4', kind: 'rvm-binary', fileName: 'wide-code4.rvm', fileHash: 'sha256-wide-code4', fileSize: arrayBuffer.byteLength, arrayBuffer, createdAt: '2026-07-01T00:00:00.000Z' };
}

function makeWideRvm(records) {
  const sized = records.map((record) => ({ ...record, byteLength: 32 + payloadLength(record) }));
  const buffer = new ArrayBuffer(sized.reduce((sum, record) => sum + record.byteLength, 0));
  const view = new DataView(buffer);
  let offset = 0;
  for (const record of sized) {
    writeRecord(view, offset, record, offset + record.byteLength);
    writePayload(view, offset + 32, record);
    offset += record.byteLength;
  }
  return buffer;
}

function writeRecord(view, offset, record, nextOffset) {
  [...record.tag].forEach((char, index) => view.setUint32(offset + index * 4, char.charCodeAt(0), false));
  view.setUint32(offset + 16, nextOffset, false);
  view.setUint32(offset + 20, 1, false);
  view.setUint32(offset + 24, 0, false);
  view.setUint32(offset + 28, record.code || 0, false);
}

function writePayload(view, offset, record) {
  if (record.text) [...record.text].forEach((char, index) => view.setUint8(offset + index, char.charCodeAt(0)));
  if (record.floats) record.floats.forEach((value, index) => view.setFloat32(offset + index * 4, value, false));
}

function payloadLength(record) {
  const textLength = new TextEncoder().encode(record.text || '').byteLength;
  const floatLength = record.floats ? record.floats.length * 4 : 0;
  return Math.max(textLength, floatLength);
}

function assertReady(result) {
  const types = result.messages.map((message) => message.type);
  assert.equal(types.includes('STAGE_WORKER_STAGE_READY'), true);
  assert.equal(types.includes('STAGE_WORKER_PACKAGE_READY'), true);
}

function head() { return { tag: 'HEAD' }; }
function cntb(text) { return { tag: 'CNTB', text }; }
function cnte() { return { tag: 'CNTE' }; }
function end() { return { tag: 'END:' }; }
function prim4() { return { tag: 'PRIM', code: 4, floats: [...identity(), 0, 0, -0.25, 1.5, 1.5, 0.25, 0.25, 1.5, Math.PI / 2] }; }
function identity() { return [1, 0, 0, 0, 1, 0, 0, 0, 1, 10, 20, 30]; }
