import assert from 'node:assert/strict';
import test from 'node:test';
import { createStageWorkerRuntime, runStageWorkerJob } from '../stage/worker/StageWorkerRuntime.js';

test('wide-tag RVM worker preserves decoded and unsupported primitives', async () => {
  const result = await runStageWorkerJob(createStageWorkerRuntime(), makeJob());
  assert.equal(result.ok, true, result.error?.message || 'expected worker success');
  assert.equal(result.stageModel.schema, 'RvmStageModel.v1');
  assert.equal(result.stageModel.source.kind, 'rvm-binary');
  assert.equal(result.stageModel.source.attAvailable, false);
  assert.equal(result.stageModel.parser.parserComplete, false);
  assert.equal(result.stageModel.parser.visualParityClaimed, false);
  assert.equal(result.stageModel.primitives.length, 3);
  assert.equal(result.stageModel.primitives.find((p) => p.nativeCode === 8).decodeStatus, 'decoded-native');
  assert.equal(result.stageModel.primitives.find((p) => p.nativeCode === 11).geometry.facetGroup.decoded, true);
  assert.equal(result.stageModel.primitives.find((p) => p.nativeCode === 7).decodeStatus, 'decoded-native');
  assert.equal(JSON.stringify(result).includes('STAGE_RVM_PARSING_NOT_IMPLEMENTED'), false);
  assert.equal(JSON.stringify(result.stageModel).includes('"renderReady":true'), false);
});

function makeJob() {
  const arrayBuffer = makeWideRvm([head(), cntb('ROUTE-A'), prim8(), prim11(), prim7(), cnte(), end()]);
  return { kind: 'rvm-binary', jobId: 'job-wide-rvm-route', fileName: 'tiny.rvm', fileHash: 'sha256-wide-route', fileSize: arrayBuffer.byteLength, arrayBuffer };
}

function makeWideRvm(records) {
  const sized = records.map((record) => ({ ...record, byteLength: 32 + payloadLength(record) }));
  const buffer = new ArrayBuffer(sized.reduce((sum, record) => sum + record.byteLength, 0));
  const view = new DataView(buffer);
  let offset = 0;
  for (const record of sized) {
    writeRecord(view, offset, record, offset + record.byteLength);
    writePayload(view, offset + 32, record);
    offset += record.byteLength;
  }
  return buffer;
}

function writeRecord(view, offset, record, nextOffset) {
  [...record.tag].forEach((char, index) => view.setUint32(offset + index * 4, char.charCodeAt(0), false));
  view.setUint32(offset + 16, nextOffset, false);
  view.setUint32(offset + 20, 1, false);
  view.setUint32(offset + 24, 0, false);
  view.setUint32(offset + 28, record.code || 0, false);
}

function writePayload(view, offset, record) {
  if (record.text) [...record.text].forEach((char, index) => view.setUint8(offset + index, char.charCodeAt(0)));
  if (record.floats) record.floats.forEach((value, index) => view.setFloat32(offset + index * 4, value, false));
  if (record.facet) writeFacet(view, offset + record.floats.length * 4, record.facet.vertices);
}

function writeFacet(view, offset, vertices) {
  view.setUint32(offset, 1, false);
  view.setUint32(offset + 4, 1, false);
  view.setUint32(offset + 8, vertices.length, false);
  let cursor = offset + 12;
  for (const vertex of vertices) for (const value of [...vertex, 0, 0, 1]) {
    view.setFloat32(cursor, value, false);
    cursor += 4;
  }
}

function payloadLength(record) {
  const textLength = new TextEncoder().encode(record.text || '').byteLength;
  const floatLength = record.floats ? record.floats.length * 4 : 0;
  const facetLength = record.facet ? 12 + record.facet.vertices.length * 24 : 0;
  return Math.max(textLength, floatLength + facetLength);
}

function head() { return { tag: 'HEAD' }; }
function cntb(text) { return { tag: 'CNTB', text }; }
function cnte() { return { tag: 'CNTE' }; }
function end() { return { tag: 'END:' }; }
function prim8() { return { tag: 'PRIM', code: 8, floats: [...identity(), 0, 0, 0, 2, 2, 10, 1, 10] }; }
function prim11() { return { tag: 'PRIM', code: 11, floats: [...identity(), 0, 0, 0, 1, 1, 0], facet: { vertices: [[0, 0, 0], [1, 0, 0], [0, 1, 0]] } }; }
function prim7() { return { tag: 'PRIM', code: 7, floats: [...identity(), 0, 0, 0, 2, 2, 6, 4, 2.5, 6, 0, 0, 0, 0, 0, 0] }; }
function identity() { return [1, 0, 0, 0, 1, 0, 0, 0, 1, 10, 20, 30]; }
