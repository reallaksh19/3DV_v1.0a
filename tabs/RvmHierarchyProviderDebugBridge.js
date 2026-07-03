const INSTALL_FLAG = Symbol.for('pcf-glb-rvm-hierarchy-provider-debug-1');
const SESSION_OPT_IN_KEY = 'pcf-glb-rvm-provider-tree-read-path';
const SESSION_PARITY_OVERRIDE_KEY = 'pcf-glb-rvm-provider-tree-parity-override';
export const RVM_HIERARCHY_PROVIDER_DEBUG_VERSION = '20260629-rvm-provider-runtime-telemetry-1';

function text(value) { return String(value ?? '').trim(); }
function escapeHtml(value) { return text(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;'); }
function row(label, value) { return `<div class="rvm-browser-diag-row"><span>${escapeHtml(label)}</span><b>${escapeHtml(value || '-')}</b></div>`; }
function yesNo(value) { return value ? 'yes' : 'no'; }
function sessionFlag(key) { try { return sessionStorage.getItem(key) === 'enabled'; } catch (_) { return false; } }
function sessionOptInEnabled() { return sessionFlag(SESSION_OPT_IN_KEY); }
function providerTreeOptInEnabled(root) { return globalThis.__PCF_GLB_RVM_PROVIDER_TREE_READ_PATH__ === true || root?.dataset?.rvmProviderTreeReadPath === 'enabled' || sessionOptInEnabled(); }
function parityOverrideEnabled(root) { return root?.dataset?.rvmProviderTreeParityOverride === 'enabled' || sessionFlag(SESSION_PARITY_OVERRIDE_KEY); }

function applyProviderTreeOptIn(root, enabled) {
  globalThis.__PCF_GLB_RVM_PROVIDER_TREE_READ_PATH__ = !!enabled;
  try { sessionStorage.setItem(SESSION_OPT_IN_KEY, enabled ? 'enabled' : 'disabled'); } catch (_) {}
  if (root?.dataset) {
    root.dataset.rvmProviderTreeReadPath = enabled ? 'enabled' : 'disabled';
    root.dataset.rvmProviderTreeReadPathDebugToggle = RVM_HIERARCHY_PROVIDER_DEBUG_VERSION;
  }
}

function applyParityOverride(root, enabled) {
  try { sessionStorage.setItem(SESSION_PARITY_OVERRIDE_KEY, enabled ? 'enabled' : 'disabled'); } catch (_) {}
  if (root?.dataset) root.dataset.rvmProviderTreeParityOverride = enabled ? 'enabled' : 'disabled';
}

function providerFromRoot(root, detail = {}) {
  return detail?.provider || root?.__rvmNativeHierarchyProvider || root?.__rvmFormatNeutralHierarchy?.providerResult || root?.__rvmFormatNeutralHierarchy?.hierarchyProviderResult || root?.__rvmHierarchyProviderResult || null;
}

function runtimeTelemetry(root, detail = {}) {
  return detail?.runtimeTelemetry
    || detail?.providerRuntimeTelemetry
    || root?.__rvmHierarchyProviderRuntimeTelemetry
    || globalThis.__PCF_GLB_RVM_HIERARCHY_READ_PATH_TELEMETRY__
    || null;
}

function stampRuntimeTelemetry(root, telemetry) {
  if (!root?.dataset || !telemetry) return telemetry;
  root.__rvmHierarchyProviderRuntimeTelemetry = telemetry;
  root.dataset.rvmHierarchyProviderRuntimeTelemetry = telemetry.version || RVM_HIERARCHY_PROVIDER_DEBUG_VERSION;
  root.dataset.rvmHierarchyReadPath = telemetry.readPath || 'unknown';
  root.dataset.rvmHierarchyReadPathReason = telemetry.reason || '';
  root.dataset.rvmHierarchyProviderReadPathOptedIn = yesNo(telemetry.providerReadPathOptedIn);
  root.dataset.rvmHierarchyProviderCandidateCount = String(telemetry.providerCandidateCount ?? 0);
  root.dataset.rvmHierarchyRenderedNodeCount = String(telemetry.renderedNodeCount ?? root?.dataset?.rvmHierarchyNodeCount ?? 0);
  return telemetry;
}

function parityHardFailures(root) {
  const parity = root?.__rvmHierarchyProviderParityAudit;
  if (!parity) return [];
  const failures = [];
  if (parity.countDelta) failures.push(`count delta ${parity.countDelta}`);
  if (Array.isArray(parity.missingInProvider) && parity.missingInProvider.length) failures.push(`missing provider IDs ${parity.missingInProvider.length}`);
  if (Array.isArray(parity.missingInLegacy) && parity.missingInLegacy.length) failures.push(`missing legacy IDs ${parity.missingInLegacy.length}`);
  if (Array.isArray(parity.duplicateProviderIds) && parity.duplicateProviderIds.length) failures.push(`duplicate provider IDs ${parity.duplicateProviderIds.length}`);
  if (Array.isArray(parity.duplicateLegacyIds) && parity.duplicateLegacyIds.length) failures.push(`duplicate legacy IDs ${parity.duplicateLegacyIds.length}`);
  if (Array.isArray(parity.parentMismatches) && parity.parentMismatches.length) failures.push(`parent mismatches ${parity.parentMismatches.length}`);
  return failures;
}

function providerTreeReloadAllowed(root) {
  const failures = parityHardFailures(root);
  return !failures.length || parityOverrideEnabled(root);
}

function ensurePanel(root) {
  const diagnostics = root?.querySelector?.('#rvm-browser-parse-diagnostics');
  if (!diagnostics) return null;
  let panel = root.querySelector('#rvm-hierarchy-provider-debug');
  if (!panel) {
    panel = document.createElement('div');
    panel.id = 'rvm-hierarchy-provider-debug';
    panel.className = 'rvm-tag-list rvm-hierarchy-provider-debug';
    panel.dataset.rvmHierarchyProviderDebug = 'true';
    diagnostics.insertAdjacentElement('afterend', panel);
  }
  return panel;
}

function parityGuardHtml(root) {
  const failures = parityHardFailures(root);
  if (!failures.length) return row('Provider tree parity guard', 'OK');
  const override = parityOverrideEnabled(root) ? ' checked' : '';
  return `<label class="rvm-browser-diag-row rvm-provider-tree-parity-override"><span><input type="checkbox" data-rvm-provider-tree-parity-override="true"${override}> Override parity guard</span><b>${escapeHtml(failures.join('; '))}</b></label>`;
}

function debugToggleHtml(root) {
  const enabled = providerTreeOptInEnabled(root);
  const allowed = providerTreeReloadAllowed(root);
  const checked = enabled ? ' checked' : '';
  const status = enabled ? 'enabled for next explicit reload/render' : 'disabled';
  const disabled = enabled && allowed ? '' : ' disabled';
  return `<label class="rvm-browser-diag-row rvm-provider-tree-toggle"><span><input type="checkbox" data-rvm-provider-tree-toggle="true"${checked}> Provider tree read path</span><b>${escapeHtml(status)}</b></label>${parityGuardHtml(root)}<button type="button" class="rvm-mini-btn" data-rvm-provider-tree-apply-reload="true"${disabled}>Apply provider tree on reload</button>`;
}

function telemetryRows(root, detail = {}) {
  const telemetry = stampRuntimeTelemetry(root, runtimeTelemetry(root, detail));
  if (!telemetry) return [
    ['Tree read path', 'unknown'],
    ['Provider candidates', '0'],
  ];
  return [
    ['Tree read path', telemetry.readPath || 'unknown'],
    ['Read-path reason', telemetry.reason || '-'],
    ['Provider read opt-in', yesNo(telemetry.providerReadPathOptedIn)],
    ['Source pilot eligible', yesNo(telemetry.sourceProviderPilotEligible)],
    ['Provider candidates', String(telemetry.providerCandidateCount ?? 0)],
    ['Rendered tree nodes', String(telemetry.renderedNodeCount ?? '-')],
  ];
}

function renderProviderDebug(root, detail = {}) {
  const panel = ensurePanel(root);
  if (!panel) return;
  const provider = providerFromRoot(root, detail);
  const providerResult = provider?.providerResult || provider;
  const sourceKind = provider?.sourceKind || providerResult?.sourceKind || root?.dataset?.rvmHierarchySourceKind || root?.dataset?.rvmLoadedSourceKind || '';
  const authority = provider?.sourceAuthority || providerResult?.sourceAuthority || (sourceKind === 'rvm' ? 'native-rvm' : 'source-document');
  const nodeCount = provider?.nodeCount ?? providerResult?.nodeCount ?? root?.dataset?.rvmHierarchyNodeCount ?? '';
  const rows = [
    ['Provider', provider?.providerId || providerResult?.providerId || root?.dataset?.rvmHierarchyProvider || '-'],
    ['Source kind', sourceKind],
    ['Authority', authority],
    ['Node count', String(nodeCount || '-')],
    ['Contract', provider?.providerContractVersion || providerResult?.version || root?.dataset?.rvmHierarchyProviderContract || '-'],
    ...telemetryRows(root, detail),
  ];
  panel.innerHTML = `<div class="rvm-panel-header">Hierarchy Provider</div><div class="rvm-browser-diag-grid">${rows.map(([label, value]) => row(label, value)).join('')}${debugToggleHtml(root)}</div>`;
}

function handleToggle(event) {
  const toggle = event.target?.closest?.('[data-rvm-provider-tree-toggle]');
  if (!toggle) return;
  const root = toggle.closest?.('[data-rvm-viewer]');
  if (!root?.dataset) return;
  const enabled = !!toggle.checked;
  applyProviderTreeOptIn(root, enabled);
  try { root.dispatchEvent(new CustomEvent('rvm-provider-tree-read-path-toggle', { bubbles: true, detail: { enabled, version: RVM_HIERARCHY_PROVIDER_DEBUG_VERSION } })); } catch (_) {}
  renderProviderDebug(root, {});
}

function handleParityOverride(event) {
  const toggle = event.target?.closest?.('[data-rvm-provider-tree-parity-override]');
  if (!toggle) return;
  const root = toggle.closest?.('[data-rvm-viewer]');
  if (!root?.dataset) return;
  const enabled = !!toggle.checked;
  applyParityOverride(root, enabled);
  try { root.dispatchEvent(new CustomEvent('rvm-provider-tree-parity-override-toggle', { bubbles: true, detail: { enabled, version: RVM_HIERARCHY_PROVIDER_DEBUG_VERSION } })); } catch (_) {}
  renderProviderDebug(root, {});
}

function handleApplyReload(event) {
  const button = event.target?.closest?.('[data-rvm-provider-tree-apply-reload]');
  if (!button) return;
  const root = button.closest?.('[data-rvm-viewer]');
  if (!root?.dataset || !providerTreeOptInEnabled(root)) return;
  const failures = parityHardFailures(root);
  if (failures.length && !parityOverrideEnabled(root)) {
    root.dataset.rvmProviderTreeReloadBlocked = RVM_HIERARCHY_PROVIDER_DEBUG_VERSION;
    try { root.dispatchEvent(new CustomEvent('rvm-provider-tree-read-path-reload-blocked', { bubbles: true, detail: { failures, version: RVM_HIERARCHY_PROVIDER_DEBUG_VERSION } })); } catch (_) {}
    renderProviderDebug(root, {});
    return;
  }
  root.dataset.rvmProviderTreeReloadRequested = RVM_HIERARCHY_PROVIDER_DEBUG_VERSION;
  try { root.dispatchEvent(new CustomEvent('rvm-provider-tree-read-path-reload-request', { bubbles: true, detail: { enabled: true, parityOverride: parityOverrideEnabled(root), version: RVM_HIERARCHY_PROVIDER_DEBUG_VERSION } })); } catch (_) {}
  try { location.reload(); } catch (_) {}
}

function restoreSessionOptIn(root) {
  if (sessionOptInEnabled()) applyProviderTreeOptIn(root, true);
  if (sessionFlag(SESSION_PARITY_OVERRIDE_KEY)) applyParityOverride(root, true);
}

export function installRvmHierarchyProviderDebugBridge() {
  if (globalThis[INSTALL_FLAG]) return;
  globalThis[INSTALL_FLAG] = true;
  globalThis.__PCF_GLB_RVM_HIERARCHY_PROVIDER_DEBUG__ = { version: RVM_HIERARCHY_PROVIDER_DEBUG_VERSION };
  const update = (event) => {
    const root = event.target?.closest?.('[data-rvm-viewer]') || event.target;
    if (!root?.querySelector) return;
    restoreSessionOptIn(root);
    renderProviderDebug(root, event.detail || {});
  };
  document.addEventListener('change', handleToggle, true);
  document.addEventListener('change', handleParityOverride, true);
  document.addEventListener('click', handleApplyReload, true);
  document.addEventListener('rvm-tree-rendered', update, true);
  document.addEventListener('rvm-hierarchy-provider-attached', update, true);
  document.addEventListener('rvm-hierarchy-provider-parity-audit', update, true);
}
