import assert from 'node:assert/strict';
import test from 'node:test';
import {
  STAGE_WORKER_JOB_SCHEMA,
  createRvmBinaryWorkerJob,
  createStageJsonWorkerJob,
  summarizeStageWorkerJob,
  validateStageWorkerJob,
} from '../stage/worker/StageWorkerJob.js';

test('valid stage-json job passes', () => {
  const job = createStageJsonWorkerJob({ fileName: 'model.json', fileHash: 'sha256-stage-json', text: '{"schema":"RvmStageModel.v1"}' });
  const result = validateStageWorkerJob(job);
  assert.equal(result.valid, true, result.errors.join('\n'));
});

test('valid rvm-binary job passes', () => {
  const job = createRvmBinaryWorkerJob({ fileName: 'model.rvm', fileHash: 'sha256-rvm', arrayBuffer: new ArrayBuffer(4) });
  const result = validateStageWorkerJob(job);
  assert.equal(result.valid, true, result.errors.join('\n'));
});

test('missing fileHash fails', () => {
  const job = createStageJsonWorkerJob({ fileName: 'model.json', text: '{}' });
  assertJobError(job, 'fileHash is required');
});

test('unknown kind fails', () => {
  const job = createStageJsonWorkerJob({ fileHash: 'sha256-kind', text: '{}' });
  job.kind = 'stage-wishful-thinking';
  assertJobError(job, 'kind is invalid');
});

test('stage-json without text fails', () => {
  const job = createStageJsonWorkerJob({ fileHash: 'sha256-empty', text: '' });
  assertJobError(job, 'stage-json text is required');
});

test('summarizeStageWorkerJob returns stable envelope fields', () => {
  const job = createStageJsonWorkerJob({ fileName: 'sample.json', fileSize: 10, fileHash: 'sha256-summary', text: '{}' });
  assert.deepEqual(summarizeStageWorkerJob(job), {
    schema: STAGE_WORKER_JOB_SCHEMA,
    jobId: job.jobId,
    kind: 'stage-json',
    fileName: 'sample.json',
    fileSize: 10,
    fileHash: 'sha256-summary',
    hasText: true,
    byteLength: 0,
  });
});

function assertJobError(job, expected) {
  const result = validateStageWorkerJob(job);
  assert.equal(result.valid, false, 'job should fail validation');
  assert.ok(result.errors.some((line) => line.includes(expected)), result.errors.join('\n'));
}
