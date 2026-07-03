import assert from 'node:assert/strict';
import test from 'node:test';
import { createSampleRvmParserMvpBinaryV1 } from '../stage/samples/sample-rvm-parser-mvp-binary-v1.js';
import { createStageWorkerRuntime, runStageWorkerJob } from '../stage/worker/StageWorkerRuntime.js';
import { validateRvmStageModel } from '../stage/contracts/RvmStageModelContract.js';

test('valid synthetic parser fixture through worker returns ok true', async () => {
  const result = await runStageWorkerJob(createStageWorkerRuntime(), createSampleRvmParserMvpBinaryV1());
  assert.equal(result.ok, true, result.error?.message || '');
  assert.ok(result.stageModel);
  assert.ok(result.renderPlan);
  assert.ok(result.manifest);
  assert.equal(result.readerReport.schema, 'RvmWideRecordReaderReport.v1');
  assert.equal(result.primitiveDecodeReport.coverage.primitiveRecordCount, 0);
  assert.ok(!JSON.stringify(result).includes('STAGE_RVM_PARSING_NOT_IMPLEMENTED'));
});

test('worker emits stage and package ready for valid parser fixture', async () => {
  const result = await runStageWorkerJob(createStageWorkerRuntime(), createSampleRvmParserMvpBinaryV1());
  const types = result.messages.map((message) => message.type);
  assert.ok(types.includes('STAGE_WORKER_STAGE_READY'));
  assert.ok(types.includes('STAGE_WORKER_PACKAGE_READY'));
});

test('worker stageModel validates for valid parser fixture', async () => {
  const result = await runStageWorkerJob(createStageWorkerRuntime(), createSampleRvmParserMvpBinaryV1());
  const validation = validateRvmStageModel(result.stageModel);
  assert.equal(validation.valid, true, validation.errors.join('\n'));
});

test('invalid preflight still returns STAGE_RVM_PREFLIGHT_FAILED', async () => {
  const job = { ...createSampleRvmParserMvpBinaryV1(), fileHash: '', arrayBuffer: new ArrayBuffer(0), fileSize: 0 };
  const result = await runStageWorkerJob(createStageWorkerRuntime(), job);
  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'STAGE_RVM_PREFLIGHT_FAILED');
});

test('nonmatching binary returns evidence output with ready messages', async () => {
  const result = await runStageWorkerJob(createStageWorkerRuntime(), nonmatchingJob());
  assert.equal(result.ok, true);
  assert.equal(result.readerReport.errors[0].code, 'RVM_WIDE_READER_NO_WIDE_TAG');
  assert.equal(result.stageModel.parser.parserComplete, false);
  assert.equal(result.stageModel.parser.visualParityClaimed, false);
  assertReady(result);
  assert.ok(!JSON.stringify(result).includes('STAGE_RVM_PARSING_NOT_IMPLEMENTED'));
});

test('nonmatching binary evidence output includes reader and decode reports', async () => {
  const result = await runStageWorkerJob(createStageWorkerRuntime(), nonmatchingJob());
  assert.ok(result.readerReport);
  assert.ok(result.nativeRecordLedger);
  assert.ok(result.primitiveDecodeReport);
  assert.equal(result.primitiveDecodeReport.coverage.primitiveRecordCount, 0);
});

function nonmatchingJob() {
  return {
    jobId: 'job-nonmatching-rvm-parser-mvp',
    kind: 'rvm-binary',
    fileName: 'nonmatching-rvm-parser-mvp.rvm',
    fileHash: 'sha256-nonmatching-rvm-parser-mvp',
    fileSize: 8,
    arrayBuffer: new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]).buffer,
  };
}

function assertReady(result) {
  const types = result.messages.map((message) => message.type);
  assert.equal(types.includes('STAGE_WORKER_STAGE_READY'), true);
  assert.equal(types.includes('STAGE_WORKER_PACKAGE_READY'), true);
}
