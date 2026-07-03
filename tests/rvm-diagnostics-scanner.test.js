import assert from 'node:assert/strict';
import {
  RVM_DIAGNOSTICS_LIMITS,
  RVM_DIAGNOSTICS_RECORD_TYPES,
  RVM_DIAGNOSTICS_SCANNER_VERSION,
  createRvmDiagnosticsReport,
  scanRvmBinaryDiagnostics,
  summarizeRvmDiagnostics,
  validateRvmDiagnosticsReport,
} from '../stage/parser/RvmDiagnosticsScanner.js';
import {
  createSampleRvmDiagnosticsBinaryV1,
  expectedSampleRvmDiagnosticsSummaryV1,
} from '../stage/samples/sample-rvm-diagnostics-binary-v1.js';

assert.equal(typeof RVM_DIAGNOSTICS_SCANNER_VERSION, 'string');
assert.equal(RVM_DIAGNOSTICS_RECORD_TYPES.CNTB, 'CNTB');
assert.ok(RVM_DIAGNOSTICS_LIMITS.maxScanBytes > 0);
assert.equal(createRvmDiagnosticsReport({ jobId: 'job-empty' }).schema, 'RvmDiagnosticsReport.v1');

const empty = scanRvmBinaryDiagnostics({ jobId: 'job-empty', fileName: 'empty.rvm', fileHash: 'sha256-empty', arrayBuffer: new ArrayBuffer(0) });
assert.equal(empty.schema, 'RvmDiagnosticsReport.v1');
assert.equal(empty.errors.length, 1);
assert.equal(validateRvmDiagnosticsReport(empty).valid, true);

const malformed = scanRvmBinaryDiagnostics({ jobId: 'job-malformed', fileName: 'malformed.rvm', fileHash: 'sha256-malformed', arrayBuffer: null });
assert.equal(malformed.errors.length, 1);
assert.equal(validateRvmDiagnosticsReport(malformed).valid, true);

const sampleReport = scanRvmBinaryDiagnostics({
  jobId: 'job-sample-rvm-diag',
  fileName: 'sample-diagnostics.rvm',
  fileHash: 'sha256-sample-rvm-diagnostics',
  arrayBuffer: createSampleRvmDiagnosticsBinaryV1(),
});
const validation = validateRvmDiagnosticsReport(sampleReport);
assert.equal(validation.valid, true, validation.errors.join('\n'));
assert.equal(sampleReport.counts.cntb, 1);
assert.equal(sampleReport.counts.cnte, 1);
assert.equal(sampleReport.counts.prim, 3);
assert.equal(sampleReport.counts.code4, 1);
assert.equal(sampleReport.counts.code11, 1);
assert.equal(sampleReport.nativeCodeCounts['4'], 1);
assert.equal(sampleReport.nativeCodeCounts['8'], 1);
assert.equal(sampleReport.nativeCodeCounts['11'], 1);
assert.equal(sampleReport.counts.candidateBboxRecords, 1);

const summary = summarizeRvmDiagnostics(sampleReport);
assert.deepEqual({
  byteLength: summary.byteLength,
  totalCandidateRecords: summary.totalCandidateRecords,
  cntb: summary.cntb,
  cnte: summary.cnte,
  prim: summary.prim,
  nativePrimitiveRecords: summary.nativePrimitiveRecords,
  code4: summary.code4,
  code11: summary.code11,
  unknownNativeCodes: summary.unknownNativeCodes,
  undecodedRecords: summary.undecodedRecords,
  candidateBboxRecords: summary.candidateBboxRecords,
  invalidBboxRecords: summary.invalidBboxRecords,
  nativeCodeCounts: summary.nativeCodeCounts,
  candidateRootCount: summary.candidateRootCount,
  maxCandidateDepth: summary.maxCandidateDepth,
  namedRecordCount: summary.namedRecordCount,
  warningCount: summary.warningCount,
  errorCount: summary.errorCount,
}, expectedSampleRvmDiagnosticsSummaryV1());

console.log('RVM diagnostics scanner tests passed');
