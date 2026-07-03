#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createStageWorkerRuntime, runStageWorkerJob } from '../stage/worker/StageWorkerRuntime.js';

async function main(argv) {
  const args = parseArgs(argv);
  if (!args.input) return usage(1);
  const filePath = path.resolve(args.input);
  const buffer = await fs.readFile(filePath);
  const job = { kind: 'rvm-binary', jobId: 'bench-stage-worker-rvm-route', fileName: path.basename(filePath), fileHash: args.hash || 'sha256-local-benchmark', fileSize: buffer.byteLength, arrayBuffer: toArrayBuffer(buffer) };
  const result = await runStageWorkerJob(createStageWorkerRuntime(), job);
  const summary = summarizeWorkerRoute(result);
  printSummary(summary);
  if (args.out) await writeReport(args.out, summary);
}

function parseArgs(argv) {
  const args = { input: '', out: '', hash: '' };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--out') { args.out = argv[index + 1] || ''; index += 1; continue; }
    if (argv[index] === '--hash') { args.hash = argv[index + 1] || ''; index += 1; continue; }
    if (!args.input) args.input = argv[index];
  }
  return args;
}

function summarizeWorkerRoute(result) {
  const model = result.stageModel || {};
  const primitives = model.primitives || [];
  return {
    ok: result.ok === true,
    schema: model.schema || '',
    sourceKind: model.source?.kind || '',
    attAvailable: model.source?.attAvailable === true,
    parserComplete: model.parser?.parserComplete === true,
    visualParityClaimed: model.parser?.visualParityClaimed === true,
    counts: {
      nodes: Array.isArray(model.hierarchy?.nodes) ? model.hierarchy.nodes.length : 0,
      primitives: primitives.length,
      decoded: primitives.filter((p) => p.geometryDecoded === true).length,
      unsupported: primitives.filter((p) => p.decodeStatus === 'unsupported-diagnostic').length,
      failed: primitives.filter((p) => p.decodeStatus === 'failed-diagnostic').length,
    },
    decodedByCode: countBy(primitives.filter((p) => p.geometryDecoded === true), 'nativeCode'),
    unsupportedByCode: countBy(primitives.filter((p) => p.decodeStatus === 'unsupported-diagnostic'), 'nativeCode'),
    failedByCode: countBy(primitives.filter((p) => p.decodeStatus === 'failed-diagnostic'), 'nativeCode'),
    messages: (result.messages || []).map((message) => messageSummary(message)),
  };
}

function printSummary(summary) {
  console.log(JSON.stringify(summary, null, 2));
}

async function writeReport(outPath, payload) {
  const target = path.resolve(outPath);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, JSON.stringify(payload, null, 2));
}

function countBy(items, key) { return items.reduce((out, item) => { const text = String(item?.[key] ?? ''); if (text) out[text] = (out[text] || 0) + 1; return out; }, {}); }
function messageSummary(message) { return { type: message?.type || '', phase: message?.payload?.phase || '', code: message?.payload?.code || '', message: message?.payload?.message || '' }; }
function toArrayBuffer(buffer) { return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength); }
function usage(code) { const script = path.relative(process.cwd(), fileURLToPath(import.meta.url)); console.error(`Usage: node ${script} /path/to/RMSS.rvm [--out report.json] [--hash sha256-local]`); process.exitCode = code; }
main(process.argv.slice(2)).catch((error) => { console.error(error?.stack || error?.message || String(error)); process.exitCode = 1; });
