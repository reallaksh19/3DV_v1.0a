export const RVM_SOURCE_FORMAT_INPUT_BRIDGE_SCHEMA = 'rvm-source-format-input-bridge/v1';

const INSTALL_FLAG = Symbol.for('pcf-glb-rvm-source-format-input-bridge-v1');
const GLOBAL_KEY = '__PCF_GLB_RVM_SOURCE_FORMAT_INPUT__';
const VERSION = '20260627-rvm-source-format-input-1';
const ACCEPT_EXTENSIONS = ['.json', '.jscon', '.stagedjson', '.staged.json', '.uxml', '.uxml.json', '.txt', '.rvm', '.rev', '.att'];

function normalizeAccept(value = '') {
  return String(value || '')
    .split(',')
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);
}

export function widenRvmSourceFileInput(root = globalThis.document?.querySelector?.('[data-rvm-viewer]')) {
  const input = root?.querySelector?.('#rvm-file-input') || globalThis.document?.querySelector?.('#rvm-file-input');
  if (!input) return { status: 'skipped', reason: 'input-missing' };
  const current = normalizeAccept(input.getAttribute('accept') || '');
  const merged = Array.from(new Set([...current, ...ACCEPT_EXTENSIONS]));
  input.setAttribute('accept', merged.join(','));
  input.dataset.rvmSourceFormatInputBridge = VERSION;
  return { status: 'updated', accept: merged };
}

export function installRvmSourceFormatInputBridge() {
  if (typeof document === 'undefined') return null;
  if (globalThis[INSTALL_FLAG] && globalThis[GLOBAL_KEY]) return globalThis[GLOBAL_KEY];
  globalThis[INSTALL_FLAG] = true;
  const api = { schema: RVM_SOURCE_FORMAT_INPUT_BRIDGE_SCHEMA, version: VERSION, widen: widenRvmSourceFileInput, acceptExtensions: ACCEPT_EXTENSIONS.slice() };
  globalThis[GLOBAL_KEY] = api;
  const run = () => widenRvmSourceFileInput();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run, { once: true });
  else run();
  globalThis.addEventListener?.('rvm-model-loaded', () => setTimeout(run, 0));
  setTimeout(run, 250);
  return api;
}
