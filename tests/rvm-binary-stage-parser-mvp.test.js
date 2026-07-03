import assert from 'node:assert/strict';
import test from 'node:test';
import {
  RVM_BINARY_STAGE_PARSER_SCHEMA,
  RVM_BINARY_STAGE_PARSER_VERSION,
  parseRvmBinaryToStageModel,
  summarizeRvmBinaryParserReport,
  validateRvmBinaryParserReport,
} from '../stage/parser/RvmBinaryStageParser.js';
import { createSampleRvmParserMvpBinaryV1 } from '../stage/samples/sample-rvm-parser-mvp-binary-v1.js';
import { validateRvmStageModel } from '../stage/contracts/RvmStageModelContract.js';

test('parser exports exist', () => {
  assert.equal(RVM_BINARY_STAGE_PARSER_SCHEMA, 'RvmBinaryParserReport.v1');
  assert.equal(typeof RVM_BINARY_STAGE_PARSER_VERSION, 'string');
  assert.equal(typeof parseRvmBinaryToStageModel, 'function');
});

test('malformed or empty input returns ok false without throw', () => {
  const result = parseRvmBinaryToStageModel({ fileName: 'empty.rvm', fileHash: 'sha256-empty', arrayBuffer: new ArrayBuffer(0) });
  assert.equal(result.ok, false);
  assert.ok(result.report.errors.length >= 1);
});

test('synthetic MVP fixture returns ok true and valid stage model', () => {
  const result = parseRvmBinaryToStageModel(createSampleRvmParserMvpBinaryV1());
  assert.equal(result.ok, true, JSON.stringify(result.report.errors));
  const validation = validateRvmStageModel(result.stageModel);
  assert.equal(validation.valid, true, validation.errors.join('\n'));
});

test('parser report keeps MVP limits explicit', () => {
  const { report } = parseRvmBinaryToStageModel(createSampleRvmParserMvpBinaryV1());
  assert.equal(report.parserComplete, false);
  assert.equal(report.visualParityClaimed, false);
  assert.ok(report.records.decodedPrimitiveCount >= 1);
  assert.ok(report.records.unsupportedPrimitiveCount >= 1);
});

test('supported primitive has native provenance and non-semantic geometry confidence', () => {
  const { stageModel } = parseRvmBinaryToStageModel(createSampleRvmParserMvpBinaryV1());
  const primitive = stageModel.primitives.find((item) => item.renderKind === 'CYLINDER');
  assert.ok(primitive.nativeRecord);
  assert.ok(primitive.nativeGeometry);
  assert.equal(primitive.confidence.geometry, 'native');
});

test('unsupported primitive becomes UNKNOWN_DIAGNOSTIC with diagnostic fallback', () => {
  const { stageModel } = parseRvmBinaryToStageModel(createSampleRvmParserMvpBinaryV1());
  const primitive = stageModel.primitives.find((item) => item.renderKind === 'UNKNOWN_DIAGNOSTIC');
  assert.ok(primitive);
  assert.equal(primitive.native.decoded, false);
  assert.equal(primitive.diagnosticFallback.visible, true);
  assert.equal(primitive.confidence.geometry, 'diagnostic');
});

test('no geometryChunks or code 11 mesh/facet output are produced', () => {
  const { stageModel } = parseRvmBinaryToStageModel(createSampleRvmParserMvpBinaryV1());
  assert.deepEqual(stageModel.geometryChunks, []);
  assert.equal(stageModel.primitives.some((item) => item.renderKind === 'FACET_GROUP' || item.renderKind === 'MESH_CHUNK'), false);
});

test('validateRvmBinaryParserReport validates report shape', () => {
  const { report } = parseRvmBinaryToStageModel(createSampleRvmParserMvpBinaryV1());
  const validation = validateRvmBinaryParserReport(report);
  assert.equal(validation.valid, true, validation.errors.join('\n'));
});

test('summarizeRvmBinaryParserReport returns deterministic summary', () => {
  const { report } = parseRvmBinaryToStageModel(createSampleRvmParserMvpBinaryV1());
  assert.deepEqual(summarizeRvmBinaryParserReport(report), {
    schema: RVM_BINARY_STAGE_PARSER_SCHEMA,
    parserVersion: RVM_BINARY_STAGE_PARSER_VERSION,
    mode: 'mvp-vertical-slice',
    parserComplete: false,
    visualParityClaimed: false,
    candidateCntb: 1,
    candidateCnte: 1,
    candidatePrim: 2,
    balancedHierarchy: true,
    decodedPrimitiveCount: 1,
    unsupportedPrimitiveCount: 1,
    diagnosticPrimitiveCount: 1,
    decodedCodes: { 4: 0, 8: 1 },
    unsupportedCodes: { 99: 1 },
    decoderSummaries: [],
    errorCount: 0,
    warningCount: 0,
  });
});
