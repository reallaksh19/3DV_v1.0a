import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const docUrl = new URL('../docs/3d-json-viewer-agent-guardrails.md', import.meta.url);

test('agent guardrail document contains bridge and file-size rules', () => {
  const text = readFileSync(docUrl, 'utf8');
  assert.match(text, /Do not import existing RVM Viewer bridge\/hotfix modules/);
  assert.match(text, /No JS file over 300 lines/);
});
