import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createStageWorkerError,
  createStageWorkerMessage,
  createStageWorkerProgress,
  createStageWorkerAcceptanceReport,
  summarizeStageWorkerAcceptance,
  validateStageWorkerOutput,
} from '../stage/contracts/RvmStageModelContract.js';
import { createSampleWorkerAcceptanceOutputV1 } from '../stage/samples/sample-worker-acceptance-output-v1.js';

test('sample worker acceptance output passes', () => {
  const report = createStageWorkerAcceptanceReport(createSampleWorkerAcceptanceOutputV1());
  assert.equal(report.valid, true, report.errors.join('\n'));
});

test('missing messages fails', () => {
  const output = createSampleWorkerAcceptanceOutputV1();
  delete output.messages;
  assertAcceptanceError(output, 'messages must be an array');
});

test('invalid worker message fails', () => {
  const output = createSampleWorkerAcceptanceOutputV1();
  output.messages[0].type = 'STAGE_WORKER_CONFUSED';
  assertAcceptanceError(output, 'type is invalid');
});

test('missing terminal message fails', () => {
  const output = createSampleWorkerAcceptanceOutputV1();
  output.messages = output.messages.filter((message) => !message.type.endsWith('_READY'));
  assertAcceptanceError(output, 'terminal worker message is required');
});

test('package-ready without stage-ready fails successful output acceptance', () => {
  const output = createSampleWorkerAcceptanceOutputV1();
  output.messages = output.messages.filter((message) => message.type !== 'STAGE_WORKER_STAGE_READY');
  assertAcceptanceError(output, 'STAGE_WORKER_STAGE_READY message is required for successful output');
});

test('successful output without valid stageModel fails', () => {
  const output = createSampleWorkerAcceptanceOutputV1();
  output.stageModel = {};
  assertAcceptanceError(output, 'stageModel');
});

test('successful output with invalid package manifest fails', () => {
  const output = createSampleWorkerAcceptanceOutputV1();
  output.manifest.schema = 'BadManifest.v1';
  assertAcceptanceError(output, 'manifest: schema must be RvmStagePackageManifest.v1');
});

test('fileHash mismatch between manifest and stage model fails', () => {
  const output = createSampleWorkerAcceptanceOutputV1();
  output.manifest.source.fileHash = 'sha256-mismatch';
  assertAcceptanceError(output, 'fileHash mismatch between manifest and stageModel');
});

test('invalid render plan fails', () => {
  const output = createSampleWorkerAcceptanceOutputV1();
  output.renderPlan.schema = 'BadRenderPlan.v1';
  assertAcceptanceError(output, 'renderPlan: schema must be StageRenderPlan.v1');
});

test('omitted renderPlan is built and accepted when stageModel is valid', () => {
  const output = createSampleWorkerAcceptanceOutputV1();
  const primitiveCount = output.stageModel.primitives.length;
  delete output.renderPlan;
  const result = validateStageWorkerOutput(output);
  assert.equal(result.valid, true, result.errors.join('\n'));
  assert.equal(result.summary.renderPlanEntryCount, primitiveCount);
});

test('failed worker message can pass without stageModel when error payload is valid', () => {
  const result = validateStageWorkerOutput({
    messages: [
      createStageWorkerMessage('STAGE_WORKER_READY', {}),
      createStageWorkerMessage('STAGE_WORKER_START', { fileName: 'bad.rvm' }),
      createStageWorkerError({ message: 'Parse failed', code: 'STAGE_PARSE_FAILED' }, { phase: 'parsing-records' }),
    ],
  });
  assert.equal(result.valid, true, result.errors.join('\n'));
});

test('cancelled worker message can pass without stageModel when cancel payload is valid', () => {
  const result = validateStageWorkerOutput({
    messages: [
      createStageWorkerMessage('STAGE_WORKER_READY', {}),
      createStageWorkerMessage('STAGE_WORKER_START', { fileName: 'cancel.rvm' }),
      createStageWorkerMessage('STAGE_WORKER_CANCELLED', { phase: 'cancelled' }),
    ],
  });
  assert.equal(result.valid, true, result.errors.join('\n'));
});

test('diagnostic fallback primitive without model diagnostic message fails clearly', () => {
  const output = createSampleWorkerAcceptanceOutputV1();
  output.stageModel.diagnostics.messages = [];
  output.stageModel.diagnostics.severityCounts.warning = 0;
  output.diagnostics = undefined;
  assertAcceptanceError(output, 'fallback primitives require model diagnostic fallback messages');
});

test('report summary includes counts for messages, model, package, and render plan', () => {
  const output = createSampleWorkerAcceptanceOutputV1();
  const report = createStageWorkerAcceptanceReport(output);
  const summary = summarizeStageWorkerAcceptance(report);
  assert.equal(summary.messageCount, output.messages.length);
  assert.equal(summary.modelPrimitiveCount, output.stageModel.primitives.length);
  assert.equal(summary.componentCount, output.stageModel.components.length);
  assert.equal(summary.packageArtifactCount, output.manifest.artifacts.length);
  assert.equal(summary.renderPlanEntryCount, output.renderPlan.entries.length);
});

test('progress messages remain valid in accepted output', () => {
  const output = createSampleWorkerAcceptanceOutputV1();
  output.messages.splice(2, 0, createStageWorkerProgress('building-components', { loaded: 4, total: 8, percent: 50 }));
  const result = validateStageWorkerOutput(output);
  assert.equal(result.valid, true, result.errors.join('\n'));
});

function assertAcceptanceError(output, expected) {
  const result = validateStageWorkerOutput(output);
  assert.equal(result.valid, false, 'output should fail acceptance');
  assert.ok(result.errors.some((line) => line.includes(expected)), result.errors.join('\n'));
}
