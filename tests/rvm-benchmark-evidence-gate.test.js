import assert from 'node:assert/strict';
import test from 'node:test';
import {
  RVM_BENCHMARK_EVIDENCE_GATE_SCHEMA,
  RVM_BENCHMARK_EVIDENCE_GATE_VERSION,
  RVM_BENCHMARK_EVIDENCE_LEVELS,
  createRvmBenchmarkEvidenceCase,
  evaluateRvmBenchmarkEvidence,
  summarizeRvmBenchmarkEvidence,
  validateRvmBenchmarkEvidenceResult,
} from '../stage/benchmark/RvmBenchmarkEvidenceGate.js';

test('exports exist', () => {
  assert.equal(RVM_BENCHMARK_EVIDENCE_GATE_SCHEMA, 'RvmBenchmarkEvidenceGate.v1');
  assert.equal(typeof RVM_BENCHMARK_EVIDENCE_GATE_VERSION, 'string');
  assert.equal(RVM_BENCHMARK_EVIDENCE_LEVELS.syntheticCode4, 'synthetic-code4-stage-evidence');
  assert.equal(typeof evaluateRvmBenchmarkEvidence, 'function');
});

test('empty input fails safely', () => {
  const result = evaluateRvmBenchmarkEvidence({}, benchmarkCase());
  assert.equal(result.pass, false);
  assert.ok(result.errors.some((item) => item.code === 'RVM_BENCHMARK_EVIDENCE_EMPTY_INPUT'));
});

test('diagnostics-only input passes only diagnostics categories, not parser success', () => {
  const result = evaluateRvmBenchmarkEvidence({ fileName: 'x.rvm', diagnosticsReport: diagnosticsReport() }, benchmarkCase());
  assert.equal(result.categories.diagnostics.pass, true);
  assert.equal(result.categories.parser.present, false);
  assert.equal(result.claims.diagnosticsOnly, true);
  assert.equal(result.claims.parserSucceeded, false);
  assert.equal(result.evidenceLevel, RVM_BENCHMARK_EVIDENCE_LEVELS.diagnostics);
});

test('synthetic code 4 worker result produces staged synthetic-only claims', () => {
  const result = evaluateRvmBenchmarkEvidence(workerInput(), benchmarkCase());
  assert.equal(result.claims.parserAttempted, true);
  assert.equal(result.claims.parserSucceeded, true);
  assert.equal(result.claims.stageModelProduced, true);
  assert.equal(result.claims.renderPlanProduced, true);
  assert.equal(result.claims.code4SyntheticOnly, true);
  assert.equal(result.claims.realCompatibilityProven, false);
  assert.equal(result.claims.visualParityClaimed, false);
});

test('diagnostics scanner and record-reader counts are reflected', () => {
  const result = evaluateRvmBenchmarkEvidence(workerInput(), benchmarkCase());
  assert.equal(result.counts.cntb, 2);
  assert.equal(result.counts.cnte, 2);
  assert.equal(result.counts.prim, 4);
  assert.equal(result.counts.code11Candidates, 1);
});

test('parser decoded code 4 and direct decoder summaries are reflected', () => {
  const result = evaluateRvmBenchmarkEvidence(workerInput(), benchmarkCase());
  assert.equal(result.counts.code4Candidates, 2);
  assert.equal(result.counts.code4DecodeSuccess, 1);
  assert.equal(result.counts.code4DecodeFailure, 1);
});

test('parser report decoder summaries are reflected', () => {
  const base = workerInput();
  const input = {
    ...base,
    code4DecoderSummaries: [],
    parserReport: { ...base.parserReport, decoderSummaries: [{ decodedOk: true }, { decodedOk: false }] },
  };
  const result = evaluateRvmBenchmarkEvidence(input, benchmarkCase());
  assert.equal(result.counts.code4DecodeSuccess, 1);
  assert.equal(result.counts.code4DecodeFailure, 1);
});

test('worker parser report decoder summaries are reflected', () => {
  const base = workerInput();
  const input = {
    ...base,
    code4DecoderSummaries: [],
    workerResult: { ...base.workerResult, rvmParserReport: { ...base.workerResult.rvmParserReport, decoderSummaries: [{ decodedOk: true }] } },
  };
  const result = evaluateRvmBenchmarkEvidence(input, benchmarkCase());
  assert.equal(result.counts.code4DecodeSuccess, 1);
  assert.equal(result.counts.code4DecodeFailure, 0);
});

test('code 11 candidates are evidence-only', () => {
  const result = evaluateRvmBenchmarkEvidence(workerInput(), benchmarkCase());
  assert.equal(result.counts.code11Candidates, 1);
  assert.equal(result.claims.realCompatibilityProven, false);
  assert.equal(result.claims.visualParityClaimed, false);
});

test('geometryChunks do not imply visual parity', () => {
  const input = { ...workerInput(), geometryChunks: [{ id: 'chunk-1' }] };
  const result = evaluateRvmBenchmarkEvidence(input, benchmarkCase());
  assert.equal(result.claims.visualParityClaimed, false);
  assert.ok(result.warnings.some((item) => item.code === 'RVM_BENCHMARK_GEOMETRY_CHUNKS_IGNORED'));
});

test('summarizeRvmBenchmarkEvidence returns deterministic summary', () => {
  const summary = summarizeRvmBenchmarkEvidence(evaluateRvmBenchmarkEvidence(workerInput(), benchmarkCase()));
  assert.deepEqual(summary, {
    schema: RVM_BENCHMARK_EVIDENCE_GATE_SCHEMA,
    gateVersion: RVM_BENCHMARK_EVIDENCE_GATE_VERSION,
    benchmarkId: 'SYNTHETIC-CODE4',
    family: 'synthetic-mvp',
    evidenceLevel: RVM_BENCHMARK_EVIDENCE_LEVELS.syntheticCode4,
    pass: true,
    parserSucceeded: true,
    stageModelProduced: true,
    renderPlanProduced: true,
    code4SyntheticOnly: true,
    realCompatibilityProven: false,
    visualParityClaimed: false,
    counts: { cntb: 2, cnte: 2, prim: 4, code4Candidates: 2, code4DecodeSuccess: 1, code4DecodeFailure: 1, code11Candidates: 1, unsupportedNativeCodes: 2 },
    warningCount: 0,
    errorCount: 0,
  });
});

test('validateRvmBenchmarkEvidenceResult validates shape', () => {
  const validation = validateRvmBenchmarkEvidenceResult(evaluateRvmBenchmarkEvidence(workerInput(), benchmarkCase()));
  assert.equal(validation.valid, true, validation.errors.join('\n'));
});

function benchmarkCase() {
  return createRvmBenchmarkEvidenceCase({ id: 'SYNTHETIC-CODE4', label: 'Synthetic code 4 evidence', family: 'synthetic-mvp' });
}

function workerInput() {
  return {
    fileName: 'synthetic-code4.rvm',
    fileHash: 'sha256-synthetic-code4',
    fileSize: 128,
    preflightReport: { valid: true },
    diagnosticsReport: diagnosticsReport(),
    recordReaderReport: { candidateRecords: { cntb: 2, cnte: 2, prim: 4 }, nativeCodeCounts: { 4: 2, 11: 1 } },
    parserReport: { decodedCodes: { 4: 2 }, unsupportedCodes: { 99: 1 } },
    code4DecoderSummaries: [{ decodedOk: true }, { decodedOk: false }],
    workerResult: { ok: true, rvmParserReport: { decodedCodes: { 4: 2 } }, stageModel: { schema: 'RvmStageModel.v1' }, renderPlan: { schema: 'StageRenderPlan.v1' } },
  };
}

function diagnosticsReport() {
  return { counts: { cntb: 1, cnte: 1, prim: 3, code4: 1, code11: 1, unknownNativeCodes: 1 }, nativeCodeCounts: { 4: 1, 11: 1 } };
}
