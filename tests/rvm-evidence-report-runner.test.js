import assert from 'node:assert/strict';
import test from 'node:test';
import {
  RVM_EVIDENCE_REPORT_RUNNER_VERSION,
  RVM_EVIDENCE_REPORT_SCHEMA,
  createRvmEvidenceReport,
  runRvmEvidenceReport,
  summarizeRvmEvidenceReport,
  validateRvmEvidenceReport,
} from '../stage/benchmark/RvmEvidenceReportRunner.js';
import { createSampleRvmCode4ElbowBinaryV1 } from '../stage/samples/sample-rvm-code4-elbow-binary-v1.js';

const GENERATED_AT = '2026-07-02T00:00:00.000Z';

test('runner exports exist', () => {
  assert.equal(RVM_EVIDENCE_REPORT_SCHEMA, 'RvmEvidenceReport.v1');
  assert.equal(typeof RVM_EVIDENCE_REPORT_RUNNER_VERSION, 'string');
  assert.equal(typeof createRvmEvidenceReport, 'function');
  assert.equal(typeof runRvmEvidenceReport, 'function');
  assert.equal(typeof summarizeRvmEvidenceReport, 'function');
  assert.equal(typeof validateRvmEvidenceReport, 'function');
});

test('invalid input fails safely without throwing', () => {
  const report = runRvmEvidenceReport({ jobId: '', fileName: '', fileHash: '', fileSize: 0, arrayBuffer: new ArrayBuffer(0) }, { generatedAt: GENERATED_AT });
  assert.equal(report.preflight.valid, false);
  assert.equal(report.parser.attempted, false);
  assert.equal(report.decision.category, 'preflight-failed');
  assert.equal(report.claims.realCompatibilityProven, false);
  assert.ok(report.errors.length >= 1);
});

test('synthetic code 4 fixture produces synthetic MVP success evidence', () => {
  const report = runRvmEvidenceReport(createSampleRvmCode4ElbowBinaryV1(), { generatedAt: GENERATED_AT });
  assert.equal(report.preflight.valid, true);
  assert.equal(report.diagnostics.available, true);
  assert.equal(report.recordReader.available, true);
  assert.equal(report.parser.attempted, true);
  assert.equal(report.parser.ok, true);
  assert.equal(report.parser.stageModelProduced, true);
  assert.ok(report.codeEvidence.code4.candidateCount >= 1);
  assert.ok(report.codeEvidence.code4.decodeSuccess >= 1);
  assert.equal(report.decision.category, 'synthetic-mvp-success');
  assert.equal(report.claims.realCompatibilityProven, false);
});

test('nonmatching binary produces evidence-only report', () => {
  const report = runRvmEvidenceReport(nonmatchingJob(), { generatedAt: GENERATED_AT });
  assert.equal(report.preflight.valid, true);
  assert.equal(report.diagnostics.available, true);
  assert.equal(report.recordReader.available, true);
  assert.equal(report.parser.attempted, true);
  assert.equal(report.parser.ok, false);
  assert.equal(report.decision.category, 'evidence-only');
});

test('report contains diagnostics, record reader, and parser summaries', () => {
  const report = runRvmEvidenceReport(createSampleRvmCode4ElbowBinaryV1(), { generatedAt: GENERATED_AT });
  assert.ok(report.diagnostics.summary);
  assert.ok(report.recordReader.summary);
  assert.ok(report.parser.summary);
  assert.equal(Array.isArray(report.parser.summary.decoderSummaries), true);
});

test('code 4 decode counts are extracted from parser decoder summaries', () => {
  const report = runRvmEvidenceReport(createSampleRvmCode4ElbowBinaryV1(), { generatedAt: GENERATED_AT });
  assert.ok(report.codeEvidence.code4.decoderSummaries.length >= 1);
  assert.equal(report.codeEvidence.code4.decodeSuccess, report.codeEvidence.code4.decoderSummaries.filter((item) => item.decodedOk).length);
  assert.equal(report.codeEvidence.code4.decodeFailure, report.codeEvidence.code4.decoderSummaries.filter((item) => item.decodedOk === false).length);
});

test('code 11 remains counted only and undecoded', () => {
  const report = runRvmEvidenceReport(code11CandidateJob(), { generatedAt: GENERATED_AT });
  assert.equal(report.codeEvidence.code11.candidateCount, 1);
  assert.equal(report.codeEvidence.code11.decoded, false);
  assert.equal(report.decision.category, 'evidence-only');
});

test('report top-level excludes stageModel/renderPlan/manifest/geometryChunks', () => {
  const report = runRvmEvidenceReport(createSampleRvmCode4ElbowBinaryV1(), { generatedAt: GENERATED_AT });
  for (const key of ['stageModel', 'renderPlan', 'manifest', 'geometryChunks']) assert.equal(Object.hasOwn(report, key), false);
});

test('summary is deterministic with generatedAt override', () => {
  const report = runRvmEvidenceReport(createSampleRvmCode4ElbowBinaryV1(), { generatedAt: GENERATED_AT });
  const summary = summarizeRvmEvidenceReport(report);
  assert.equal(summary.generatedAt, GENERATED_AT);
  assert.equal(summary.schema, RVM_EVIDENCE_REPORT_SCHEMA);
  assert.equal(summary.preflightValid, true);
  assert.equal(summary.parserOk, true);
  assert.equal(summary.decision.category, 'synthetic-mvp-success');
});

test('shape validation accepts valid report', () => {
  const report = runRvmEvidenceReport(createSampleRvmCode4ElbowBinaryV1(), { generatedAt: GENERATED_AT });
  const validation = validateRvmEvidenceReport(report);
  assert.equal(validation.valid, true, validation.errors.join('\n'));
});

function nonmatchingJob() {
  return { jobId: 'job-rvm-evidence-nonmatching', fileName: 'nonmatching.rvm', fileHash: 'sha256-nonmatching', fileSize: 8, arrayBuffer: new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]).buffer };
}

function code11CandidateJob() {
  const buffer = new ArrayBuffer(20);
  const view = new DataView(buffer);
  writeTag(view, 0, 'CNTB');
  writeTag(view, 4, 'PRIM');
  view.setUint32(8, 11, true);
  view.setUint32(12, 0, true);
  writeTag(view, 16, 'CNTE');
  return { jobId: 'job-rvm-evidence-code11', fileName: 'code11-candidate.rvm', fileHash: 'sha256-code11-candidate', fileSize: buffer.byteLength, arrayBuffer: buffer };
}

function writeTag(view, offset, tag) {
  for (let index = 0; index < 4; index += 1) view.setUint8(offset + index, tag.charCodeAt(index));
}
