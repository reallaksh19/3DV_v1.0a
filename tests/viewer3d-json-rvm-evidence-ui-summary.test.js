import assert from 'node:assert/strict';
import test from 'node:test';
import { createStageWorkerRuntime, runStageWorkerJob } from '../stage/worker/StageWorkerRuntime.js';
import { buildStageModelDownload, deriveRvmStageUiSummary, hasUnsafeRenderClaim, stageModelDownloadFileName } from '../stage/ui/RvmStageModelUiSummary.js';

test('RVM worker result derives UI summary and coverage', async () => {
  const result = await runStageWorkerJob(createStageWorkerRuntime(), makeJob());
  assert.equal(result.ok, true, result.error?.message || 'expected worker success');
  const summary = deriveRvmStageUiSummary(result.stageModel, result.messages);
  assert.equal(result.stageModel.schema, 'RvmStageModel.v1');
  assert.equal(summary.source.kind, 'rvm-binary');
  assert.equal(summary.source.attAvailable, false);
  assert.equal(summary.source.byteLength, result.stageModel.source.byteLength);
  assert.equal(summary.parser.parserComplete, false);
  assert.equal(summary.parser.visualParityClaimed, false);
  assert.equal(summary.counts.totalPrimitives, 3);
  assert.equal(summary.counts.decodedPrimitives, 2);
  assert.equal(summary.counts.unsupportedPrimitives, 1);
  assert.ok(summary.coverage.some((row) => row.code === '8' && row.status === 'decoded'));
  assert.ok(summary.coverage.some((row) => row.code === '11' && row.status === 'decoded'));
  assert.ok(summary.coverage.some((row) => row.code === '1' && row.status === 'diagnostic'));
  assert.equal(JSON.stringify(result).includes('STAGE_RVM_PARSING_NOT_IMPLEMENTED'), false);
  assert.equal(hasUnsafeRenderClaim(result.stageModel), false);
  assert.equal(hasUnsafeRenderClaim(result.renderPlan), false);
  assert.equal(hasUnsafeRenderClaim(summary), false);
  assert.equal(hasUnsafeRenderClaim(summary.diagnostics), false);
});

test('StageModel download naming and JSON payload are stable', () => {
  const model = { schema: 'RvmStageModel.v1', source: { fileName: 'RMSS.rvm', kind: 'rvm-binary' }, hierarchy: { nodes: [] }, primitives: [] };
  const download = buildStageModelDownload(model, 'RMSS.rvm');
  assert.equal(download.fileName, 'RMSS.stage-model.json');
  assert.equal(stageModelDownloadFileName('pipe.model.rvm'), 'pipe.model.stage-model.json');
  assert.equal(JSON.parse(download.text).schema, 'RvmStageModel.v1');
  assert.equal(JSON.parse(download.text).source.kind, 'rvm-binary');
});

test('UI summary detects unsafe parser/render claims', () => {
  assert.equal(hasUnsafeRenderClaim({ parser: { parserComplete: false, visualParityClaimed: false }, geometry: { renderReady: false } }), false);
  assert.equal(hasUnsafeRenderClaim({ parser: { parserComplete: true } }), true);
  assert.equal(hasUnsafeRenderClaim({ geometry: { renderReady: true } }), true);
});

function makeJob() {
  const arrayBuffer = makeWideRvm([head(), cntb('ROUTE-A'), prim8(), prim11(), prim1(), cnte(), end()]);
  return { kind: 'rvm-binary', jobId: 'job-rvm-ui-summary', fileName: 'RMSS.rvm', fileHash: 'sha256-ui-summary', fileSize: arrayBuffer.byteLength, arrayBuffer };
}
function makeWideRvm(records) {
  const sized = records.map((record) => ({ ...record, byteLength: 32 + payloadLength(record) }));
  const buffer = new ArrayBuffer(sized.reduce((sum, record) => sum + record.byteLength, 0));
  const view = new DataView(buffer); let offset = 0;
  for (const record of sized) { writeRecord(view, offset, record, offset + record.byteLength); writePayload(view, offset + 32, record); offset += record.byteLength; }
  return buffer;
}
function writeRecord(view, offset, record, nextOffset) { [...record.tag].forEach((char, index) => view.setUint32(offset + index * 4, char.charCodeAt(0), false)); view.setUint32(offset + 16, nextOffset, false); view.setUint32(offset + 20, 1, false); view.setUint32(offset + 24, 0, false); view.setUint32(offset + 28, record.code || 0, false); }
function writePayload(view, offset, record) { if (record.text) [...record.text].forEach((char, index) => view.setUint8(offset + index, char.charCodeAt(0))); if (record.floats) record.floats.forEach((value, index) => view.setFloat32(offset + index * 4, value, false)); if (record.facet) writeFacet(view, offset + record.floats.length * 4, record.facet.vertices); }
function writeFacet(view, offset, vertices) { view.setUint32(offset, 1, false); view.setUint32(offset + 4, 1, false); view.setUint32(offset + 8, vertices.length, false); let cursor = offset + 12; for (const vertex of vertices) for (const value of [...vertex, 0, 0, 1]) { view.setFloat32(cursor, value, false); cursor += 4; } }
function payloadLength(record) { const textLength = new TextEncoder().encode(record.text || '').byteLength; const floatLength = record.floats ? record.floats.length * 4 : 0; const facetLength = record.facet ? 12 + record.facet.vertices.length * 24 : 0; return Math.max(textLength, floatLength + facetLength); }
function head() { return { tag: 'HEAD' }; }
function cntb(text) { return { tag: 'CNTB', text }; }
function cnte() { return { tag: 'CNTE' }; }
function end() { return { tag: 'END:' }; }
function prim8() { return { tag: 'PRIM', code: 8, floats: [...identity(), 0, 0, 0, 2, 2, 10, 1, 10] }; }
function prim11() { return { tag: 'PRIM', code: 11, floats: [...identity(), 0, 0, 0, 1, 1, 0], facet: { vertices: [[0, 0, 0], [1, 0, 0], [0, 1, 0]] } }; }
function prim1() { return { tag: 'PRIM', code: 1, floats: [...identity(), 0, 0, 0, 1, 1, 1, 1, 2, 3] }; }
function identity() { return [1, 0, 0, 0, 1, 0, 0, 0, 1, 10, 20, 30]; }
