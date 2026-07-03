import assert from 'node:assert/strict';
import test from 'node:test';
import { validateRvmStageModel } from '../stage/contracts/RvmStageModelContract.js';
import { parseRvmBinaryToStageModel, summarizeRvmBinaryParserReport, validateRvmBinaryParserReport } from '../stage/parser/RvmBinaryStageParser.js';
import { buildStageRenderPlan, validateStageRenderPlan } from '../stage/render/StageRenderPlan.js';
import { createSampleRvmParserCode4BinaryV1, expectedSampleRvmParserCode4SummaryV1 } from '../stage/samples/sample-rvm-parser-code4-binary-v1.js';

test('synthetic code 4 parser fixture returns ok true and validates', () => {
  const result = parseRvmBinaryToStageModel(createSampleRvmParserCode4BinaryV1());
  assert.equal(result.ok, true, JSON.stringify(result.report.errors));
  const validation = validateRvmStageModel(result.stageModel);
  assert.equal(validation.valid, true, validation.errors.join('\n'));
});

test('stage model contains one staged ELBOW primitive with native code 4 metadata', () => {
  const { stageModel } = parseRvmBinaryToStageModel(createSampleRvmParserCode4BinaryV1());
  const elbow = stageModel.primitives.find((primitive) => primitive.renderKind === 'ELBOW');
  assert.ok(elbow);
  assert.equal(elbow.native.code, 4);
  assert.equal(elbow.nativeRecord.nativeCode, 4);
  assert.equal(elbow.nativeRecord.decoded, true);
  assert.equal(elbow.nativeGeometry.provenance, 'native');
  assert.ok(elbow.nativeGeometry.nativeParams.radius > 0);
  assert.ok(elbow.nativeGeometry.nativeParams.bendRadius > 0);
  assert.ok(elbow.nativeGeometry.nativeParams.angleDeg > 0);
  assert.equal(elbow.nativeGeometry.transform3x4.length, 12);
  assert.equal(elbow.nativeGeometry.bboxLocal.length, 6);
  assert.equal(elbow.nativeGeometry.bboxWorld.length, 6);
  assert.equal(elbow.confidence.geometry, 'native');
});

test('render plan classifies staged ELBOW as supported native output', () => {
  const { stageModel } = parseRvmBinaryToStageModel(createSampleRvmParserCode4BinaryV1());
  const plan = buildStageRenderPlan(stageModel, 'full');
  const validation = validateStageRenderPlan(plan);
  assert.equal(validation.valid, true, validation.errors.join('\n'));
  const entry = plan.entries.find((item) => item.renderKind === 'ELBOW');
  assert.ok(entry);
  assert.equal(entry.supportLevel, 'supported');
  assert.equal(entry.recipeSource, 'native');
  assert.ok(entry.nativeGeometryRef);
});

test('unsupported primitive candidate remains UNKNOWN_DIAGNOSTIC', () => {
  const { stageModel } = parseRvmBinaryToStageModel(createSampleRvmParserCode4BinaryV1());
  const diagnostic = stageModel.primitives.find((primitive) => primitive.renderKind === 'UNKNOWN_DIAGNOSTIC');
  assert.ok(diagnostic);
  assert.equal(diagnostic.native.decoded, false);
  assert.equal(diagnostic.confidence.geometry, 'diagnostic');
  assert.deepEqual(stageModel.geometryChunks, []);
  assert.equal(stageModel.primitives.some((item) => item.renderKind === 'FACET_GROUP' || item.renderKind === 'MESH_CHUNK'), false);
});

test('parser report records code 4 decoder evidence and keeps parity flags false', () => {
  const { report } = parseRvmBinaryToStageModel(createSampleRvmParserCode4BinaryV1());
  const summary = summarizeRvmBinaryParserReport(report);
  const expected = expectedSampleRvmParserCode4SummaryV1();
  assert.equal(report.parserComplete, false);
  assert.equal(report.visualParityClaimed, false);
  assert.ok(summary.decodedCodes['4'] >= expected.decodedCodes[4]);
  assert.ok(summary.unsupportedCodes['99'] >= expected.unsupportedCodes[99]);
  assert.ok(summary.decoderSummaries.some((item) => item.decodedOk && item.nativeCode === 4));
  const validation = validateRvmBinaryParserReport(report);
  assert.equal(validation.valid, true, validation.errors.join('\n'));
});
