import assert from 'node:assert/strict';
import { createSampleRvmDiagnosticsBinaryV1 } from '../stage/samples/sample-rvm-diagnostics-binary-v1.js';
import { createStageWorkerRuntime, runStageWorkerJob } from '../stage/worker/StageWorkerRuntime.js';

function rvmJob(arrayBuffer, overrides = {}) {
  return {
    schema: 'StageWorkerJob.v1',
    jobId: overrides.jobId || 'job-rvm-diagnostics',
    kind: 'rvm-binary',
    fileName: overrides.fileName || 'sample-diagnostics.rvm',
    fileSize: overrides.fileSize ?? arrayBuffer.byteLength,
    fileHash: overrides.fileHash || 'sha256-rvm-diagnostics-test',
    arrayBuffer,
    byteLength: arrayBuffer.byteLength,
    createdAt: '2026-07-01T00:00:00.000Z',
  };
}

const messages = [];
const runtime = createStageWorkerRuntime({ onMessage: (message) => messages.push(message) });
const result = await runStageWorkerJob(runtime, rvmJob(createSampleRvmDiagnosticsBinaryV1()));
assert.equal(result.ok, true, result.error?.message || 'expected RVM evidence success');
assert.equal(result.stageModel.schema, 'RvmStageModel.v1');
assert.equal(result.stageModel.source.kind, 'rvm-binary');
assert.equal(result.stageModel.source.attAvailable, false);
assert.equal(result.stageModel.parser.parserComplete, false);
assert.equal(result.stageModel.parser.visualParityClaimed, false);
assert.equal(result.readerReport.schema, 'RvmWideRecordReaderReport.v1');
assert.equal(result.readerReport.errors[0].code, 'RVM_WIDE_READER_NO_WIDE_TAG');
assert.equal(result.primitiveDecodeReport.coverage.primitiveRecordCount, 0);
assert.ok(result.messages.some((message) => message?.payload?.phase === 'parsing-records'));
assert.ok(result.messages.some((message) => message?.payload?.phase === 'building-diagnostics'));
assert.equal(result.messages.some((message) => message?.type === 'STAGE_WORKER_STAGE_READY'), true);
assert.equal(result.messages.some((message) => message?.type === 'STAGE_WORKER_PACKAGE_READY'), true);
assert.equal(Object.hasOwn(result, 'stageModel'), true);
assert.equal(Object.hasOwn(result, 'renderPlan'), true);
assert.equal(Object.hasOwn(result, 'manifest'), true);
assert.ok(!JSON.stringify(result).includes('STAGE_RVM_PARSING_NOT_IMPLEMENTED'));
assert.deepEqual(messages.map((message) => message.type), result.messages.map((message) => message.type));

const invalid = await runStageWorkerJob(createStageWorkerRuntime(), rvmJob(new ArrayBuffer(0), { fileSize: 0, fileHash: 'sha256-empty-rvm' }));
assert.equal(invalid.ok, false);
assert.equal(invalid.error.code, 'STAGE_RVM_PREFLIGHT_FAILED');
assert.ok(invalid.error.context.preflight);
assert.equal(Object.hasOwn(invalid.error.context, 'rvmDiagnosticsReport'), false);
assert.equal(invalid.messages.some((message) => message?.type === 'STAGE_WORKER_STAGE_READY'), false);
assert.equal(invalid.messages.some((message) => message?.type === 'STAGE_WORKER_PACKAGE_READY'), false);

console.log('RVM worker diagnostics evidence tests passed');
