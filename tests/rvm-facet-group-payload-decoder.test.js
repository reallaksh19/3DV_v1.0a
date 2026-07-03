import assert from 'node:assert/strict';
import { readRvmWideRecords } from '../stage/parser/RvmWideRecordReader.js';
import { buildRvmNativeRecordLedger } from '../stage/parser/RvmNativeRecordLedgerBuilder.js';
import { buildRvmPrimitiveDecodeReport } from '../stage/parser/RvmPrimitiveDecodeReportBuilder.js';
import { validateRvmFacetGroupEvidence } from '../stage/contracts/RvmFacetGroupDecodeContract.js';
import { validateRvmPrimitiveDecodeReport } from '../stage/contracts/RvmPrimitiveDecodeContract.js';

function makeReport(records) {
  const buffer = makeWideRvm([{ tag: 'HEAD' }, { tag: 'CNTB', text: 'FACET-ZONE' }, ...records, { tag: 'CNTE' }, { tag: 'END:' }]);
  const readerReport = readRvmWideRecords({ arrayBuffer: buffer, fileName: 'facet-test.rvm' });
  const ledger = buildRvmNativeRecordLedger(readerReport);
  return { buffer, report: buildRvmPrimitiveDecodeReport({ arrayBuffer: buffer, readerReport, ledger }) };
}

function primitive(code, params = [], bbox = [0, 0, 0, 1, 1, 1]) {
  return { tag: 'PRIM', code, floats: [...identityTransform(), ...bbox, ...params] };
}

function facetPrimitive(options = {}) {
  return { tag: 'PRIM', code: 11, floats: [...identityTransform(), 0, 0, 0, 1, 1, 0], facet: options };
}

function identityTransform() { return [1, 0, 0, 0, 1, 0, 0, 0, 1, 10, 20, 30]; }

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

function writeFacet(view, offset, facet) {
  if (facet.truncated) { view.setUint32(offset, 1, false); view.setUint32(offset + 4, 1, false); view.setUint32(offset + 8, 3, false); return; }
  const vertices = facet.vertices || [[0, 0, 0], [1, 0, 0], [0, 1, 0]];
  const polygonCount = facet.polygonCount || 1;
  view.setUint32(offset, polygonCount, false);
  let p = offset + 4;
  for (let polygon = 0; polygon < polygonCount; polygon += 1) p = writeFacetPolygon(view, p, vertices);
}

function writeFacetPolygon(view, offset, vertices) {
  view.setUint32(offset, 1, false); view.setUint32(offset + 4, vertices.length, false);
  let p = offset + 8;
  for (const vertex of vertices) for (const value of [...vertex, 0, 0, 1]) { view.setFloat32(p, value, false); p += 4; }
  return p;
}

function payloadLength(record) {
  const textLength = new TextEncoder().encode(record.text || '').byteLength;
  const floatLength = record.floats ? record.floats.length * 4 : 0;
  const facetLength = record.facet ? facetPayloadLength(record.facet) : 0;
  return Math.max(textLength, floatLength + facetLength);
}

function facetPayloadLength(facet) {
  if (facet.truncated) return 12;
  const vertices = facet.vertices || [[0], [0], [0]];
  return 4 + (facet.polygonCount || 1) * (8 + vertices.length * 24);
}

const facet = makeReport([facetPrimitive()]).report;
const decodedFacet = facet.decodedPrimitives[0];
assert.equal(decodedFacet.nativeCode, 11);
assert.equal(decodedFacet.decodeStatus, 'decoded-native');
assert.equal(decodedFacet.geometryDecoded, true);
assert.equal(decodedFacet.facetGroup.decoded, true);
assert.equal(decodedFacet.facetGroup.vertexCount, 3);
assert.equal(decodedFacet.facetGroup.polygonCount, 1);
assert.equal(decodedFacet.facetGroup.faceCount, 1);
assert.ok(decodedFacet.facetGroup.bboxLocal.every(Number.isFinite));
assert.ok(decodedFacet.facetGroup.bboxWorld.every(Number.isFinite));
assert.equal(decodedFacet.geometryBasis.renderReady, false);
assert.equal(facet.parser.parserComplete, false);
assert.equal(facet.parser.visualParityClaimed, false);
assert.equal(validateRvmFacetGroupEvidence(decodedFacet.facetGroup).valid, true);
assert.equal(validateRvmPrimitiveDecodeReport(facet).valid, true);

const highPolygon = makeReport([facetPrimitive({ polygonCount: 401 })]).report;
assert.equal(highPolygon.decodedPrimitives[0].facetGroup.polygonCount, 401);
assert.equal(highPolygon.coverage.decodedByCode['11'], 1);
assert.deepEqual(highPolygon.coverage.failedByCode, {});

const malformed = makeReport([facetPrimitive({ truncated: true })]).report;
assert.equal(malformed.unsupportedPrimitives[0].decodeStatus, 'failed-diagnostic');
assert.equal(malformed.coverage.failedByCode['11'], 1);
assert.equal(malformed.parser.visualParityClaimed, false);

const snout = makeReport([primitive(7, [4, 2.5, 6, 0, 0, 0, 0, 0, 0])]).report;
assert.equal(snout.decodedPrimitives[0].decodeStatus, 'decoded-native');
assert.equal(snout.coverage.decodedByCode['7'], 1);

const unsupported = makeReport([primitive(1, [1, 2, 3, 4, 5, 6, 7])]).report;
assert.equal(unsupported.unsupportedPrimitives[0].decodeStatus, 'unsupported-diagnostic');
assert.equal(unsupported.coverage.unsupportedByCode['1'], 1);

const regression = makeReport([
  primitive(2, [], [-1, -2, -3, 3, 4, 5]),
  primitive(4, [1.25, 5.5, Math.PI / 2]),
  primitive(8, [3.5, 12]),
  primitive(9, [14], [-7, -7, -7, 7, 7, 7]),
]).report;
assert.deepEqual(regression.coverage.decodedByCode, { '2': 1, '4': 1, '8': 1, '9': 1 });
const sphere = regression.decodedPrimitives.find((entry) => entry.nativeCode === 9);
assert.equal(sphere.nativeParams.diameter, 14);
assert.equal(sphere.nativeParams.radius, 7);
assert.equal(sphere.nativeParams.radiusSource, 'derived-from-native-diameter');

console.log('RVM code 11 facet group decode evidence tests passed');
