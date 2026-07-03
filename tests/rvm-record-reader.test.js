import assert from 'node:assert/strict';
import test from 'node:test';
import { createSampleRvmParserMvpBinaryV1 } from '../stage/samples/sample-rvm-parser-mvp-binary-v1.js';
import {
  RVM_RECORD_EVIDENCE_LEVELS,
  RVM_RECORD_READER_SCHEMA,
  RVM_RECORD_READER_VERSION,
  readRvmRecordEvidence,
  summarizeRvmRecordEvidence,
  validateRvmRecordReaderReport,
} from '../stage/parser/RvmRecordReader.js';

test('record reader exports exist', () => {
  assert.equal(RVM_RECORD_READER_SCHEMA, 'RvmRecordReaderReport.v1');
  assert.equal(typeof RVM_RECORD_READER_VERSION, 'string');
  assert.equal(RVM_RECORD_EVIDENCE_LEVELS.bounded, 'bounded-candidate');
  assert.equal(typeof readRvmRecordEvidence, 'function');
});

test('empty input returns report with errors and does not throw', () => {
  const report = readRvmRecordEvidence({ fileName: 'empty.rvm', fileHash: 'sha256-empty', arrayBuffer: new ArrayBuffer(0) });
  assert.equal(report.errors.length, 1);
  assert.equal(report.parserComplete, false);
});

test('synthetic MVP fixture produces candidate CNTB CNTE PRIM evidence', () => {
  const report = readRvmRecordEvidence(createSampleRvmParserMvpBinaryV1());
  assert.equal(report.candidateRecords.cntb, 1);
  assert.equal(report.candidateRecords.cnte, 1);
  assert.equal(report.candidateRecords.prim, 2);
  assert.equal(report.containerStack.balanced, true);
});

test('PRIM payload slices are bounded for synthetic MVP fixture', () => {
  const report = readRvmRecordEvidence(createSampleRvmParserMvpBinaryV1());
  assert.equal(report.primPayloadSlices.length, 2);
  assert.equal(report.primPayloadSlices.every((slice) => slice.bounded), true);
  assert.equal(report.primPayloadSlices[0].evidenceLevel, 'bounded-candidate');
});

test('candidate native code counts include code 8 for synthetic MVP fixture', () => {
  const report = readRvmRecordEvidence(createSampleRvmParserMvpBinaryV1());
  assert.equal(report.nativeCodeCounts[8], 1);
  assert.equal(report.nativeCodeCounts[99], 1);
});

test('unmatched CNTB and CNTE are counted on malformed synthetic fixtures', () => {
  const openReport = readRvmRecordEvidence(malformedContainer('CNTB'));
  assert.equal(openReport.containerStack.unmatchedCntb, 1);
  assert.equal(openReport.containerStack.unmatchedCnte, 0);
  const closeReport = readRvmRecordEvidence(malformedContainer('CNTE'));
  assert.equal(closeReport.containerStack.unmatchedCntb, 0);
  assert.equal(closeReport.containerStack.unmatchedCnte, 1);
});

test('confirmedRecords total remains 0 and parser flags remain false', () => {
  const report = readRvmRecordEvidence(createSampleRvmParserMvpBinaryV1());
  assert.equal(report.confirmedRecords.total, 0);
  assert.equal(report.parserComplete, false);
  assert.equal(report.visualParityClaimed, false);
});

test('record reader report contains no staged outputs', () => {
  const report = readRvmRecordEvidence(createSampleRvmParserMvpBinaryV1());
  assert.equal('stageModel' in report, false);
  assert.equal('renderPlan' in report, false);
  assert.equal('manifest' in report, false);
  assert.equal('geometryChunks' in report, false);
});

test('summarizeRvmRecordEvidence returns deterministic summary', () => {
  const report = readRvmRecordEvidence(createSampleRvmParserMvpBinaryV1());
  assert.deepEqual(summarizeRvmRecordEvidence(report), {
    schema: RVM_RECORD_READER_SCHEMA,
    readerVersion: RVM_RECORD_READER_VERSION,
    byteLength: 116,
    candidateRecords: { total: 4, cntb: 1, cnte: 1, prim: 2, bbox: 0, unknown: 0 },
    confirmedRecords: { total: 0 },
    containerStack: { balanced: true, maxDepth: 1, unmatchedCntb: 0, unmatchedCnte: 0 },
    primPayloadSliceCount: 2,
    nativeCodeCounts: { 8: 1, 99: 1 },
    byteRangeCount: 4,
    warningCount: 0,
    errorCount: 0,
  });
});

test('report validation accepts record reader report', () => {
  const report = readRvmRecordEvidence(createSampleRvmParserMvpBinaryV1());
  const validation = validateRvmRecordReaderReport(report);
  assert.equal(validation.valid, true, validation.errors.join('\n'));
});

function malformedContainer(tag) {
  const buffer = new ArrayBuffer(4);
  const view = new DataView(buffer);
  for (let index = 0; index < 4; index += 1) view.setUint8(index, tag.charCodeAt(index));
  return { jobId: `job-${tag}`, fileName: `${tag}.rvm`, fileHash: `sha256-${tag}`, arrayBuffer: buffer };
}
