import assert from 'node:assert/strict';
import test from 'node:test';
import {
  STAGE_WORKER_MESSAGE_TYPES,
  createStageWorkerError,
  createStageWorkerMessage,
  createStageWorkerProgress,
  validateStageWorkerMessage,
  validateStageWorkerProgress,
} from '../stage/contracts/RvmStageModelContract.js';

test('ready/start/progress/stage-ready/package-ready/error/cancelled messages validate', () => {
  const messages = [
    createStageWorkerMessage('STAGE_WORKER_READY', { phase: 'idle' }),
    createStageWorkerMessage('STAGE_WORKER_START', { fileName: 'model.rvm' }),
    createStageWorkerProgress('decoding-primitives', { loaded: 50, total: 100, message: 'Decoding native primitive records' }),
    createStageWorkerMessage('STAGE_WORKER_DIAGNOSTIC', { severity: 'warning', code: 'STAGE_FALLBACK_UNKNOWN_NATIVE_CODE' }),
    createStageWorkerMessage('STAGE_WORKER_STAGE_READY', { stageSchema: 'RvmStageModel.v1' }),
    createStageWorkerMessage('STAGE_WORKER_PACKAGE_READY', { manifestSchema: 'RvmStagePackageManifest.v1' }),
    createStageWorkerError({ message: 'Parser failed', code: 'STAGE_PARSE_FAILED' }, { phase: 'parsing-records' }),
    createStageWorkerMessage('STAGE_WORKER_CANCELLED', { phase: 'cancelled' }),
  ];
  for (const message of messages) assertMessageValid(message);
});

test('all declared message types are accepted with basic payloads', () => {
  for (const type of STAGE_WORKER_MESSAGE_TYPES) {
    const message = type === 'STAGE_WORKER_ERROR'
      ? createStageWorkerError({ message: 'Failed', code: 'STAGE_FAILED' }, {})
      : createStageWorkerMessage(type, { ok: true });
    if (type === 'STAGE_WORKER_PROGRESS') message.payload = { phase: 'reading-file', loaded: 0, total: 1, percent: 0, message: '' };
    assertMessageValid(message);
  }
});

test('invalid message type fails', () => {
  assertMessageError(createStageWorkerMessage('WORKER_DONE_MAYBE', {}), 'type is invalid');
});

test('invalid worker phase fails', () => {
  const message = createStageWorkerProgress('inventing-geometry', { loaded: 1, total: 2 });
  assertMessageError(message, 'phase is invalid');
});

test('percent below 0 or above 100 fails', () => {
  assertProgressError({ phase: 'reading-file', loaded: 0, total: 10, percent: -1 }, 'percent must be between 0 and 100');
  assertProgressError({ phase: 'reading-file', loaded: 10, total: 10, percent: 101 }, 'percent must be between 0 and 100');
});

test('loaded greater than finite total fails', () => {
  const message = createStageWorkerProgress('reading-file', { loaded: 11, total: 10, percent: 100 });
  assertMessageError(message, 'loaded must not exceed total');
});

test('progress message with valid phase and percent passes', () => {
  const message = createStageWorkerProgress('building-components', { loaded: 25, total: 100, percent: 25 });
  assertMessageValid(message);
});

test('error message includes message, code, and context', () => {
  const message = createStageWorkerError({ message: 'Could not decode primitive', code: 'STAGE_DECODE_FAILED' }, { primitiveId: 'prim-000001' });
  assert.equal(message.payload.message, 'Could not decode primitive');
  assert.equal(message.payload.code, 'STAGE_DECODE_FAILED');
  assert.deepEqual(message.payload.context, { primitiveId: 'prim-000001' });
  assertMessageValid(message);
});

test('validation uses plain data and no DOM or Worker globals', () => {
  const message = createStageWorkerProgress('hashing-source', { loaded: 1, total: 2, percent: 50 });
  assert.equal(validateStageWorkerMessage(message).valid, true);
  assert.equal(Object.hasOwn(message, 'payload'), true);
});

function assertMessageValid(message) {
  const result = validateStageWorkerMessage(message);
  assert.equal(result.valid, true, result.errors.join('\n'));
}

function assertMessageError(message, expected) {
  const result = validateStageWorkerMessage(message);
  assert.equal(result.valid, false, 'message should fail validation');
  assert.ok(result.errors.some((line) => line.includes(expected)), result.errors.join('\n'));
}

function assertProgressError(progress, expected) {
  const result = validateStageWorkerProgress(progress);
  assert.equal(result.valid, false, 'progress should fail validation');
  assert.ok(result.errors.some((line) => line.includes(expected)), result.errors.join('\n'));
}
