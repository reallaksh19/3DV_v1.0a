import assert from 'node:assert/strict';
import { readRvmWideRecords } from '../stage/parser/RvmWideRecordReader.js';
import { buildRvmNativeRecordLedger } from '../stage/parser/RvmNativeRecordLedgerBuilder.js';
import { buildRvmPrimitiveDecodeReport } from '../stage/parser/RvmPrimitiveDecodeReportBuilder.js';
import { buildRvmStageModelFromEvidence } from '../stage/parser/RvmStageModelEmitter.js';
import { validateRvmStageModelFromEvidence } from '../stage/contracts/RvmStageModelEvidenceContract.js';

function runPipeline(records) {
  const buffer = makeWideRvm(records);
  const readerReport = readRvmWideRecords({ arrayBuffer: buffer, fileName: 'stage-model-test.rvm' });
  const ledger = buildRvmNativeRecordLedger(readerReport);
  const primitiveDecodeReport = buildRvmPrimitiveDecodeReport({ arrayBuffer: buffer, readerReport, ledger });
  const stageModel = buildRvmStageModelFromEvidence({ readerReport, ledger, primitiveDecodeReport });
  return { buffer, readerReport, ledger, primitiveDecodeReport, stageModel };
}

function makeWideRvm(records) {
  const sized = records.map((record) => ({ ...record, byteLength: 32 + payloadLength(record) }));
  const buffer = new ArrayBuffer(sized.reduce((sum, record) => sum + record.byteLength, 0));
  const view = new DataView(buffer);
  let offset = 0;
  for (const record of sized) { writeRecord(view, offset, record, offset + record.byteLength); writePayload(view, offset + 32, record); offset += record.byteLength; }
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
  if (record.facet) writeFacet(view, offset + record.floats.length * 4, record.facet);
}

function primitive(code, params = [], bbox = [0, 0, 0, 1, 1, 1]) { return { tag: 'PRIM', code, floats: [...identityTransform(), ...bbox, ...params] }; }
function facetPrimitive() { return { tag: 'PRIM', code: 11, floats: [...identityTransform(), 0, 0, 0, 1, 1, 0], facet: { vertices: [[0, 0, 0], [1, 0, 0], [0, 1, 0]] } }; }
function identityTransform() { return [1, 0, 0, 0, 1, 0, 0, 0, 1, 10, 20, 30]; }

function writeFacet(view, offset, facet) {
  const vertices = facet.vertices;
  view.setUint32(offset, 1, false); view.setUint32(offset + 4, 1, false); view.setUint32(offset + 8, vertices.length, false);
  let p = offset + 12;
  for (const vertex of vertices) for (const value of [...vertex, 0, 0, 1]) { view.setFloat32(p, value, false); p += 4; }
}

function payloadLength(record) {
  const textLength = new TextEncoder().encode(record.text || '').byteLength;
  const floatLength = record.floats ? record.floats.length * 4 : 0;
  const facetLength = record.facet ? 12 + record.facet.vertices.length * 24 : 0;
  return Math.max(textLength, floatLength + facetLength);
}

const emitted = runPipeline([{ tag: 'HEAD' }, { tag: 'CNTB', text: 'ROOT-A' }, primitive(8, [3.5, 12]), facetPrimitive(), primitive(7, [1, 2, 3, 4, 5, 6, 7, 8, 9]), { tag: 'CNTE' }, { tag: 'END:' }]);
const model = emitted.stageModel;
assert.equal(model.schema, 'RvmStageModel.v1');
assert.equal(model.source.kind, 'rvm-binary');
assert.equal(model.source.attAvailable, false);
assert.equal(model.parser.parserComplete, false);
assert.equal(model.parser.visualParityClaimed, false);
assert.equal(model.primitives.length, emitted.ledger.primitiveRecords.length);
assert.equal(model.primitives.find((p) => p.nativeCode === 8).decodeStatus, 'decoded-native');
assert.equal(model.primitives.find((p) => p.nativeCode === 11).geometry.facetGroup.decoded, true);
assert.equal(model.primitives.find((p) => p.nativeCode === 7).decodeStatus, 'decoded-native');
assert.equal(model.primitives.find((p) => p.nativeCode === 7).renderKind, 'FLANGE');
assert.equal(model.primitives.some((p) => JSON.stringify(p).includes('"renderReady":true')), false);
assert.equal(validateRvmStageModelFromEvidence(model).valid, true);

const nested = runPipeline([{ tag: 'HEAD' }, { tag: 'CNTB', text: 'A' }, { tag: 'CNTB', text: 'B' }, primitive(8, [1, 2]), { tag: 'CNTE' }, { tag: 'CNTE' }, { tag: 'END:' }]).stageModel;
const child = nested.hierarchy.nodes.find((node) => node.depth === 2);
assert.ok(child);
assert.ok(nested.hierarchy.nodes.some((node) => node.id === child.parentId));
assert.ok(nested.primitives.every((primitive) => [nested.hierarchy.rootId, ...nested.hierarchy.nodes.map((node) => node.id)].includes(primitive.nodeId)));

const invalid = structuredClone(model);
invalid.hierarchy.nodes = invalid.hierarchy.nodes.filter((node) => node.id !== model.primitives[0].nodeId);
const bad = validateRvmStageModelFromEvidence(invalid);
assert.equal(bad.valid, false);
assert.ok(bad.errors.some((error) => error.includes('nodeId is unknown')));

assert.equal(JSON.stringify(model).toLowerCase().includes('attavailable:true'), false);
assert.equal(model.primitives.every((primitive) => primitive.semantic?.source === 'rvm-only' && primitive.semantic?.confidence === 'limited'), true);

const sphere = runPipeline([{ tag: 'HEAD' }, { tag: 'CNTB', text: 'S' }, primitive(9, [14], [-7, -7, -7, 7, 7, 7]), { tag: 'CNTE' }, { tag: 'END:' }]).stageModel.primitives[0];
assert.equal(sphere.geometry.nativeParams.diameter, 14);
assert.equal(sphere.geometry.nativeParams.radius, 7);
assert.equal(sphere.geometry.nativeParams.radiusSource, 'derived-from-native-diameter');

console.log('RVM-only StageModel emitter tests passed');
