import assert from 'node:assert/strict';
import test from 'node:test';
import {
  STAGE_PACKAGE_SCHEMA,
  createStagePackageManifest,
  makeStagePackageCacheKey,
  summarizeStagePackageManifest,
  validateStagePackageManifest,
} from '../stage/contracts/RvmStageModelContract.js';
import { createSampleStagePackageManifestV1 } from '../stage/samples/sample-stage-package-manifest-v1.js';

test('sample package manifest validates', () => {
  const manifest = createSampleStagePackageManifestV1();
  const result = validateStagePackageManifest(manifest);
  assert.equal(result.valid, true, result.errors.join('\n'));
  assert.equal(manifest.schema, STAGE_PACKAGE_SCHEMA);
});

test('wrong package schema fails', () => {
  const manifest = clone(createSampleStagePackageManifestV1());
  manifest.schema = 'WrongManifest.v1';
  assertManifestError(manifest, 'schema must be RvmStagePackageManifest.v1');
});

test('missing source fileHash fails', () => {
  const manifest = clone(createSampleStagePackageManifestV1());
  manifest.source.fileHash = '';
  assertManifestError(manifest, 'source.fileHash is required');
});

test('unknown artifact kind fails', () => {
  const manifest = clone(createSampleStagePackageManifestV1());
  manifest.artifacts[0].kind = 'raw-rvm-bytes';
  assertManifestError(manifest, 'artifact.kind is invalid');
});

test('unknown chunk kind fails', () => {
  const manifest = clone(createSampleStagePackageManifestV1());
  manifest.chunks[0].kind = 'three-mesh-cache';
  assertManifestError(manifest, 'chunk.kind is invalid');
});

test('missing artifact href fails', () => {
  const manifest = clone(createSampleStagePackageManifestV1());
  manifest.artifacts[0].href = '';
  assertManifestError(manifest, 'artifact.href is required');
});

test('cache key includes fileHash, stage schema, and converter version', () => {
  const manifest = createSampleStagePackageManifestV1();
  assert.ok(manifest.cache.key.includes(manifest.source.fileHash));
  assert.ok(manifest.cache.key.includes(manifest.stageSchema));
  assert.ok(manifest.cache.key.includes(manifest.cache.converterVersion));
  assert.equal(makeStagePackageCacheKey({
    fileHash: 'sha256-demo',
    converterVersion: 'converter-v1',
  }), 'sha256-demo::RvmStageModel.v1::converter-v1');
});

test('JSON-only package with empty chunks is valid', () => {
  const manifest = createStagePackageManifest({
    source: { fileName: 'json-only.rvm', fileSize: 1, fileHash: 'sha256-json-only' },
    chunks: [],
  });
  const result = validateStagePackageManifest(manifest);
  assert.equal(result.valid, true, result.errors.join('\n'));
  assert.equal(summarizeStagePackageManifest(manifest).chunkCount, 0);
});

function assertManifestError(manifest, expected) {
  const result = validateStagePackageManifest(manifest);
  assert.equal(result.valid, false, 'manifest should fail validation');
  assert.ok(result.errors.some((line) => line.includes(expected)), result.errors.join('\n'));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}
