import assert from 'node:assert/strict';
import { readRvmWideRecords, validateRvmWideRecordReaderReport } from '../stage/parser/RvmWideRecordReader.js';
import { buildRvmNativeRecordLedger } from '../stage/parser/RvmNativeRecordLedgerBuilder.js';
import { validateRvmNativeRecordLedger } from '../stage/contracts/RvmNativeRecordLedgerContract.js';

function makeWideRvm(records) {
  const sized = records.map((record) => ({ ...record, byteLength: 32 + byteLength(record.payload || '') }));
  const total = sized.reduce((sum, record) => sum + record.byteLength, 0);
  const buffer = new ArrayBuffer(total);
  const view = new DataView(buffer);
  let offset = 0;
  for (const record of sized) {
    writeRecord(view, offset, record, offset + record.byteLength);
    writePayload(view, offset + 32, record.payload || '');
    offset += record.byteLength;
  }
  return buffer;
}

function writeRecord(view, offset, record, nextOffset) {
  writeWideTag(view, offset, record.tag);
  view.setUint32(offset + 16, nextOffset, false);
  view.setUint32(offset + 20, record.major || 1, false);
  view.setUint32(offset + 24, record.minor || 0, false);
  view.setUint32(offset + 28, record.code || 0, false);
}

function writeWideTag(view, offset, tag) {
  [...tag].forEach((char, index) => view.setUint32(offset + index * 4, char.charCodeAt(0), false));
}

function writePayload(view, offset, text) {
  [...text].forEach((char, index) => view.setUint8(offset + index, char.charCodeAt(0)));
}

function byteLength(text) {
  return new TextEncoder().encode(text).byteLength;
}

const validBuffer = makeWideRvm([
  { tag: 'HEAD' },
  { tag: 'MODL', payload: 'MODEL-A' },
  { tag: 'CNTB', payload: 'PIPE-ZONE-A' },
  { tag: 'PRIM', code: 8, payload: 'native-cylinder-payload' },
  { tag: 'CNTE' },
  { tag: 'END:' },
]);
const validReport = readRvmWideRecords({ arrayBuffer: validBuffer, fileName: 'tiny-wide.rvm' });

assert.equal(validReport.records.byTag.HEAD, 1);
assert.equal(validReport.records.byTag.MODL, 1);
assert.equal(validReport.records.byTag.CNTB, 1);
assert.equal(validReport.records.byTag.PRIM, 1);
assert.equal(validReport.records.byTag.CNTE, 1);
assert.equal(validReport.records.byTag['END:'], 1);
assert.equal(validReport.primitiveCodes['8'], 1);
assert.equal(validReport.hierarchy.balanced, true);
assert.equal(validReport.primSlices[0].parentPath, '/PIPE-ZONE-A');
assert.equal(validateRvmWideRecordReaderReport(validReport).valid, true);

const badReport = readRvmWideRecords({
  arrayBuffer: makeWideRvm([{ tag: 'HEAD' }, { tag: 'CNTB', payload: 'OPEN-ZONE' }, { tag: 'PRIM', code: 8 }, { tag: 'END:' }]),
  fileName: 'bad-wide.rvm',
});
assert.equal(badReport.hierarchy.balanced, false);
assert.ok(badReport.warnings.some((item) => item.code === 'RVM_WIDE_READER_UNBALANCED_HIERARCHY'));
assert.equal(badReport.errors.length, 0);

const ledger = buildRvmNativeRecordLedger(validReport);
const validation = validateRvmNativeRecordLedger(ledger);
assert.equal(validation.valid, true, validation.errors.join('\n'));
assert.equal(ledger.schema, 'RvmNativeRecordLedger.v1');
assert.equal(ledger.nodes.length, 2);
assert.equal(ledger.primitiveRecords.length, 1);
assert.equal(ledger.primitiveRecords[0].parentPath, '/PIPE-ZONE-A');
assert.equal(ledger.primitiveRecords[0].geometryDecoded, false);
assert.equal(ledger.primitiveRecords[0].semanticSource, 'rvm-only');
assert.equal(validReport.parserComplete, false);
assert.equal(validReport.visualParityClaimed, false);
assert.equal(ledger.parser.parserComplete, false);
assert.equal(ledger.parser.visualParityClaimed, false);

console.log('RVM wide-record reader and native ledger tests passed');
