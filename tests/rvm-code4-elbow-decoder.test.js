import assert from 'node:assert/strict';
import test from 'node:test';
import { readRvmRecordEvidence } from '../stage/parser/RvmRecordReader.js';
import {
  RVM_CODE4_ELBOW_DECODER_SCHEMA,
  RVM_CODE4_ELBOW_DECODER_VERSION,
  RVM_CODE4_ELBOW_LAYOUTS,
  decodeRvmCode4ElbowPayload,
  summarizeRvmCode4DecodeReport,
  validateRvmCode4DecodeReport,
} from '../stage/parser/RvmCode4ElbowDecoder.js';
import {
  createMalformedSampleRvmCode4ElbowBinaryV1,
  createSampleRvmCode4ElbowBinaryV1,
  expectedSampleRvmCode4NativeParams,
  expectedSampleRvmCode4PrimSlice,
} from '../stage/samples/sample-rvm-code4-elbow-binary-v1.js';

test('code 4 decoder exports exist', () => {
  assert.equal(RVM_CODE4_ELBOW_DECODER_SCHEMA, 'RvmCode4ElbowDecodeReport.v1');
  assert.equal(typeof RVM_CODE4_ELBOW_DECODER_VERSION, 'string');
  assert.equal(RVM_CODE4_ELBOW_LAYOUTS.mvpFloat32TransformBboxParams, 'mvp-float32-transform-bbox-elbow-params-v1');
  assert.equal(typeof decodeRvmCode4ElbowPayload, 'function');
});

test('malformed input returns decoded false and does not throw', () => {
  const report = decodeRvmCode4ElbowPayload({ fileName: 'empty.rvm', fileHash: 'sha256-empty', arrayBuffer: new ArrayBuffer(0) });
  assert.equal(report.decoded.ok, false);
  assert.equal(report.decoderComplete, false);
  assert.equal(report.visualParityClaimed, false);
});

test('non code 4 slice is rejected', () => {
  const input = sampleInput();
  const report = decodeRvmCode4ElbowPayload({ ...input, primSlice: { ...input.primSlice, candidateNativeCode: 8 } });
  assert.equal(report.decoded.ok, false);
  assert.ok(report.layout.reasonCodes.includes('CODE4_NATIVE_CODE_REQUIRED'));
});

test('unbounded slice is rejected', () => {
  const input = sampleInput();
  const report = decodeRvmCode4ElbowPayload({ ...input, primSlice: { ...input.primSlice, bounded: false } });
  assert.equal(report.decoded.ok, false);
  assert.ok(report.layout.reasonCodes.includes('CODE4_BOUNDED_SLICE_REQUIRED'));
});

test('short payload is rejected', () => {
  const input = sampleInput();
  const report = decodeRvmCode4ElbowPayload({ ...input, primSlice: { ...input.primSlice, candidatePayloadLength: 24 } });
  assert.equal(report.decoded.ok, false);
  assert.ok(report.layout.reasonCodes.includes('CODE4_PAYLOAD_TOO_SHORT'));
});

test('malformed synthetic fixture is rejected safely', () => {
  const job = createMalformedSampleRvmCode4ElbowBinaryV1();
  const recordReaderReport = readRvmRecordEvidence(job);
  const report = decodeRvmCode4ElbowPayload({ ...job, primSlice: recordReaderReport.primPayloadSlices[0], recordReaderReport });
  assert.equal(report.decoded.ok, false);
  assert.ok(report.layout.reasonCodes.includes('CODE4_PAYLOAD_TOO_SHORT'));
});

test('synthetic code 4 fixture decodes MVP layout', () => {
  const input = sampleInput();
  assert.deepEqual(input.primSlice, expectedSampleRvmCode4PrimSlice());
  const report = decodeRvmCode4ElbowPayload(input);
  assert.equal(report.decoded.ok, true, report.layout.reasonCodes.join(', '));
  assert.equal(report.layout.supported, true);
  assert.deepEqual(roundParams(report.decoded.nativeParams), roundParams(expectedSampleRvmCode4NativeParams()));
  assert.equal(report.decoded.nativeParams.provenance, 'code4-mvp-layout');
  assert.equal(report.decoded.nativeParams.layoutName, RVM_CODE4_ELBOW_LAYOUTS.mvpFloat32TransformBboxParams);
  assert.equal(report.decoded.transform3x4.length, 12);
  assert.deepEqual(report.decoded.bboxLocal, [0, 0, -0.25, 1.5, 1.5, 0.25]);
});

test('decoder report has no staged outputs', () => {
  const report = decodeRvmCode4ElbowPayload(sampleInput());
  assert.equal('stageModel' in report, false);
  assert.equal('renderPlan' in report, false);
  assert.equal('manifest' in report, false);
  assert.equal('geometryChunks' in report, false);
});

test('validateRvmCode4DecodeReport validates report shape', () => {
  const validation = validateRvmCode4DecodeReport(decodeRvmCode4ElbowPayload(sampleInput()));
  assert.equal(validation.valid, true, validation.errors.join('\n'));
});

test('summarizeRvmCode4DecodeReport returns deterministic summary', () => {
  const summary = summarizeRvmCode4DecodeReport(decodeRvmCode4ElbowPayload(sampleInput()));
  assert.deepEqual(summary, {
    schema: RVM_CODE4_ELBOW_DECODER_SCHEMA,
    decoderVersion: RVM_CODE4_ELBOW_DECODER_VERSION,
    byteLength: 108,
    decoderComplete: false,
    visualParityClaimed: false,
    layoutName: RVM_CODE4_ELBOW_LAYOUTS.mvpFloat32TransformBboxParams,
    layoutSupported: true,
    decodedOk: true,
    nativeCode: 4,
    payloadLength: 88,
    reasonCodes: ['CODE4_MVP_LAYOUT_SUPPORTED'],
    warningCount: 0,
    errorCount: 0,
  });
});

function sampleInput() {
  const job = createSampleRvmCode4ElbowBinaryV1();
  const recordReaderReport = readRvmRecordEvidence(job);
  const primSlice = recordReaderReport.primPayloadSlices.find((slice) => slice.candidateNativeCode === 4);
  return { ...job, primSlice, recordReaderReport };
}

function roundParams(params) {
  return Object.fromEntries(Object.entries(params).map(([key, value]) => [key, typeof value === 'number' ? Number(value.toFixed(6)) : value]));
}
