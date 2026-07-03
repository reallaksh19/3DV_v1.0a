import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { classifyRvmWorkerResult, createRvmUiDiagnostics, summarizeRvmUiHandoff } from '../stage/ui/RvmUiHandoff.js';

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const rendererSource = fs.readFileSync(path.join(root, 'tabs/viewer3d-json-tab-renderer.js'), 'utf8');
const shellSource = fs.readFileSync(path.join(root, 'stage/ui/JsonViewerShell.js'), 'utf8');
const handoffSource = fs.readFileSync(path.join(root, 'stage/ui/RvmUiHandoff.js'), 'utf8');

const evidenceSuccess = {
  ok: true,
  stageModel: { schema: 'RvmStageModel.v1' },
  readerReport: { schema: 'RvmWideRecordReaderReport.v1', records: [{ tag: 'HEAD' }] },
  nativeRecordLedger: { schema: 'RvmNativeRecordLedger.v1', nodes: [{}], primitiveRecords: [{ nativeCode: 8 }] },
  primitiveDecodeReport: { schema: 'RvmPrimitiveDecodeReport.v1', coverage: { decodedByCode: { 8: 1 } } },
};
const success = classifyRvmWorkerResult(evidenceSuccess);
assert.equal(success.kind, 'evidence-success');
assert.equal(success.statusText, 'RVM StageModel generated successfully.');
assert.ok(createRvmUiDiagnostics(evidenceSuccess).some((item) => item.code === 'STAGE_RVM_WIDE_READER_SUMMARY'));
assert.ok(createRvmUiDiagnostics(evidenceSuccess).some((item) => item.code === 'STAGE_RVM_PRIMITIVE_DECODE_SUMMARY'));

const diagnosticsOnly = classifyRvmWorkerResult({ ok: false, error: { code: 'STAGE_RVM_PARSING_NOT_IMPLEMENTED' } });
assert.equal(diagnosticsOnly.kind, 'diagnostics-only');
assert.match(diagnosticsOnly.statusText, /RVM diagnostics only/);

const preflightFailed = classifyRvmWorkerResult({ ok: false, error: { code: 'STAGE_RVM_PREFLIGHT_FAILED', context: { preflight: { errors: [{ code: 'BAD' }] } } } });
assert.equal(preflightFailed.kind, 'preflight-failed');
assert.equal(preflightFailed.statusText, 'RVM preflight failed');

const summary = summarizeRvmUiHandoff({
  error: { context: { preflightSummary: { valid: true } } },
  readerReport: { schema: 'reader', records: [] },
  nativeRecordLedger: { schema: 'ledger', nodes: [], primitiveRecords: [] },
  primitiveDecodeReport: { schema: 'decode', coverage: { decodedByCode: { 8: 1 } } },
});
assert.deepEqual(summary.preflightSummary, { valid: true });
assert.equal(summary.readerSummary.schema, 'reader');
assert.equal(summary.ledgerSummary.schema, 'ledger');
assert.deepEqual(summary.primitiveDecodeSummary.coverage.decodedByCode, { 8: 1 });

assert.ok(shellSource.includes('Open RVM'));
assert.ok(shellSource.includes('Download RvmStageModel JSON'));
assert.ok(rendererSource.includes("applyWorkerResult(result, file.name, handles, state, 'rvm-binary')"));
assert.ok(rendererSource.includes('RVM binary selected'));
assert.ok(handoffSource.includes('RVM StageModel generated successfully.'));
for (const forbidden of ['Native RVM support complete', 'Loaded RVM', 'Navis parity', 'Review parity', 'code 11 complete', 'MVP parser slice']) {
  assert.equal((rendererSource + shellSource + handoffSource).includes(forbidden), false, forbidden);
}

console.log('3D Json Viewer RVM UI handoff tests passed');
