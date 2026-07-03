import assert from 'node:assert/strict';
import { readRvmWideRecords } from '../stage/parser/RvmWideRecordReader.js';
import { buildRvmNativeRecordLedger } from '../stage/parser/RvmNativeRecordLedgerBuilder.js';
import { buildRvmPrimitiveDecodeReport } from '../stage/parser/RvmPrimitiveDecodeReportBuilder.js';
import { validateRvmPrimitiveDecodeReport } from '../stage/contracts/RvmPrimitiveDecodeContract.js';

function makeOnePrimitiveReport(code, params = [], bbox = [0, 0, 0, 2, 2, 10]) {
  const buffer = makeWideRvm([
    { tag: 'HEAD' },
    { tag: 'CNTB', payloadText: 'TEST-ZONE' },
    { tag: 'PRIM', code, floats: [...identityTransform(), ...bbox, ...params] },
    { tag: 'CNTE' },
    { tag: 'END:' },
  ]);
  const readerReport = readRvmWideRecords({ arrayBuffer: buffer, fileName: `code-${code}.rvm` });
  const ledger = buildRvmNativeRecordLedger(readerReport);
  return { buffer, readerReport, ledger, report: buildRvmPrimitiveDecodeReport({ arrayBuffer: buffer, readerReport, ledger }) };
}

function identityTransform() {
  return [1, 0, 0, 0, 1, 0, 0, 0, 1, 10, 20, 30];
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
  if (record.floats) return record.floats.forEach((value, index) => view.setFloat32(offset + index * 4, value, false));
  [...(record.payloadText || '')].forEach((char, index) => view.setUint8(offset + index, char.charCodeAt(0)));
}

function payloadLength(record) {
  if (record.floats) return record.floats.length * 4;
  return new TextEncoder().encode(record.payloadText || '').byteLength;
}

const cylinder = makeOnePrimitiveReport(8, [3.5, 12]);
assert.equal(cylinder.report.decodedPrimitives[0].decodeStatus, 'decoded-native');
assert.equal(cylinder.report.decodedPrimitives[0].geometryDecoded, true);
assert.equal(cylinder.report.decodedPrimitives[0].nativeCode, 8);
assert.equal(cylinder.report.decodedPrimitives[0].nativeParams.radius, 3.5);
assert.equal(cylinder.report.decodedPrimitives[0].nativeParams.height, 12);
assert.ok(cylinder.report.decodedPrimitives[0].worldBbox.every(Number.isFinite));
assert.equal(cylinder.report.parser.parserComplete, false);
assert.equal(cylinder.report.parser.visualParityClaimed, false);
assert.equal(validateRvmPrimitiveDecodeReport(cylinder.report).valid, true);

const torus = makeOnePrimitiveReport(4, [1.25, 5.5, Math.PI / 2]);
assert.equal(torus.report.decodedPrimitives[0].nativeParams.offset, 1.25);
assert.equal(torus.report.decodedPrimitives[0].nativeParams.radius, 5.5);
assert.ok(Number.isFinite(torus.report.decodedPrimitives[0].nativeParams.angleDeg));
assert.equal(torus.report.decodedPrimitives[0].geometryBasis.confidence, 'native-evidence');
assert.equal(torus.report.parser.visualParityClaimed, false);

const box = makeOnePrimitiveReport(2, [], [-1, -2, -3, 3, 4, 5]);
assert.deepEqual(box.report.decodedPrimitives[0].nativeParams.sizeFromLocalBbox, { x: 4, y: 6, z: 8 });
assert.ok(box.report.decodedPrimitives[0].localBbox.every(Number.isFinite));

const sphere = makeOnePrimitiveReport(9, [14], [-7, -7, -7, 7, 7, 7]);
assert.equal(sphere.report.decodedPrimitives[0].nativeParams.diameter, 14);
assert.equal(sphere.report.decodedPrimitives[0].nativeParams.radius, 7);
assert.equal(sphere.report.decodedPrimitives[0].nativeParams.radiusSource, 'derived-from-native-diameter');

const snout = makeOnePrimitiveReport(7, [4, 2.5, 6, 0, 0, 0, 0, 0, 0]);
assert.equal(snout.report.decodedPrimitives[0].decodeStatus, 'decoded-native');
assert.equal(snout.report.decodedPrimitives[0].nativeParams.radiusBottom, 4);
assert.equal(snout.report.decodedPrimitives[0].nativeParams.radiusTop, 2.5);
assert.equal(snout.report.decodedPrimitives[0].nativeParams.height, 6);

const unsupported = makeOnePrimitiveReport(1, [1, 2, 3, 4, 5, 6, 7]);
assert.equal(unsupported.report.unsupportedPrimitives[0].decodeStatus, 'unsupported-diagnostic');
assert.equal(unsupported.report.unsupportedPrimitives[0].geometryDecoded, false);
assert.equal(unsupported.report.coverage.unsupportedCount, 1);
assert.equal(unsupported.report.coverage.unsupportedByCode['1'], 1);

const mismatchLedger = { ...cylinder.ledger, primitiveRecords: [{ ...cylinder.ledger.primitiveRecords[0], nativeCode: 4, nativeKind: 'CircularTorus' }] };
const mismatch = buildRvmPrimitiveDecodeReport({ arrayBuffer: cylinder.buffer, readerReport: cylinder.readerReport, ledger: mismatchLedger });
assert.equal(mismatch.unsupportedPrimitives[0].decodeStatus, 'failed-diagnostic');
assert.equal(mismatch.coverage.failedCount, 1);
assert.equal(mismatch.coverage.failedByCode['4'], 1);

console.log('RVM primitive payload decode evidence tests passed');
