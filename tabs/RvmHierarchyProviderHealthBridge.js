const INSTALL_FLAG = Symbol.for('pcf-glb-rvm-hierarchy-provider-health-1');
export const RVM_HIERARCHY_PROVIDER_HEALTH_VERSION = '20260628-rvm-provider-health-check-1';

function text(value) { return String(value ?? '').trim(); }
function lower(value) { return text(value).toLowerCase(); }
function numberOrNull(value) { const n = Number(value); return Number.isFinite(n) ? n : null; }
function escapeHtml(value) { return text(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;'); }
function isNativeRvm(root, detail = {}) { const kind = lower(detail?.sourceKind || root?.dataset?.rvmHierarchySourceKind || root?.dataset?.rvmLoadedSourceKind); const mode = lower(root?.dataset?.rvmModelPrimitiveMode); return kind === 'rvm' || mode === 'rvm-native'; }
function isSourceDocument(root, detail = {}) { const kind = lower(detail?.sourceKind || root?.dataset?.rvmHierarchySourceKind || root?.dataset?.rvmLoadedSourceKind); return ['stagedjson', 'uxml', 'json', 'jscon', 'txt', 'source-preview', 'inputxml'].includes(kind); }
function providerResult(root) { return root?.__rvmHierarchyProviderResult || root?.__rvmNativeHierarchyProvider?.providerResult || root?.__rvmFormatNeutralHierarchy?.providerResult || root?.__rvmFormatNeutralHierarchy?.hierarchyProviderResult || null; }
function expectedTreeCount(root, detail = {}) { return numberOrNull(root?.dataset?.rvmHierarchyNodeCount) ?? numberOrNull(detail?.nodeCount) ?? numberOrNull(root?.__rvmFormatNeutralHierarchy?.nodeCount); }

export function evaluateRvmHierarchyProviderHealth(root, detail = {}) {
  const provider = providerResult(root);
  const expected = expectedTreeCount(root, detail);
  const actual = numberOrNull(provider?.nodeCount);
  const issues = [];
  if (isSourceDocument(root, detail) && !provider) issues.push('source-provider-missing');
  if (isNativeRvm(root, detail) && !root?.__rvmNativeHierarchyProvider) issues.push('native-rvm-provider-missing');
  if (provider && expected !== null && actual !== null && expected !== actual) issues.push('provider-node-count-mismatch');
  return {
    version: RVM_HIERARCHY_PROVIDER_HEALTH_VERSION,
    ok: issues.length === 0,
    status: issues.length ? 'warn' : 'ok',
    issues,
    sourceKind: lower(detail?.sourceKind || root?.dataset?.rvmHierarchySourceKind || root?.dataset?.rvmLoadedSourceKind) || 'unknown',
    expectedNodeCount: expected,
    providerNodeCount: actual,
    providerId: provider?.providerId || root?.__rvmNativeHierarchyProvider?.providerId || '',
  };
}

function ensureHealthPanel(root) {
  const providerPanel = root?.querySelector?.('#rvm-hierarchy-provider-debug');
  if (!providerPanel) return null;
  let panel = root.querySelector('#rvm-hierarchy-provider-health');
  if (!panel) {
    panel = document.createElement('div');
    panel.id = 'rvm-hierarchy-provider-health';
    panel.className = 'rvm-browser-diag-warning rvm-hierarchy-provider-health';
    panel.dataset.rvmHierarchyProviderHealth = 'true';
    providerPanel.insertAdjacentElement('afterend', panel);
  }
  return panel;
}

function renderHealth(root, health) {
  const panel = ensureHealthPanel(root);
  if (!panel) return;
  panel.dataset.rvmHierarchyProviderHealthStatus = health.status;
  panel.innerHTML = health.ok ? 'Hierarchy provider health: OK' : `Hierarchy provider health: ${escapeHtml(health.issues.join(', '))}`;
}

function update(root, detail = {}) {
  if (!root?.dataset) return null;
  const health = evaluateRvmHierarchyProviderHealth(root, detail);
  root.__rvmHierarchyProviderHealth = health;
  root.dataset.rvmHierarchyProviderHealth = health.status;
  root.dataset.rvmHierarchyProviderHealthVersion = RVM_HIERARCHY_PROVIDER_HEALTH_VERSION;
  renderHealth(root, health);
  try { root.dispatchEvent(new CustomEvent('rvm-hierarchy-provider-health', { bubbles: true, detail: health })); } catch (_) {}
  return health;
}

export function installRvmHierarchyProviderHealthBridge() {
  if (globalThis[INSTALL_FLAG]) return;
  globalThis[INSTALL_FLAG] = true;
  globalThis.__PCF_GLB_RVM_HIERARCHY_PROVIDER_HEALTH__ = { version: RVM_HIERARCHY_PROVIDER_HEALTH_VERSION, evaluate: evaluateRvmHierarchyProviderHealth };
  const onEvent = (event) => {
    const root = event.target?.closest?.('[data-rvm-viewer]') || event.target;
    if (!root?.querySelector) return;
    requestAnimationFrame(() => update(root, event.detail || {}));
  };
  document.addEventListener('rvm-tree-rendered', onEvent, true);
  document.addEventListener('rvm-hierarchy-provider-attached', onEvent, true);
}
