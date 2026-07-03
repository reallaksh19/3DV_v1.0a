const INSTALL_FLAG = Symbol.for('pcf-glb-rvm-hierarchy-provider-parity-audit-1');
export const RVM_HIERARCHY_PROVIDER_PARITY_AUDIT_VERSION = '20260628-rvm-provider-parity-audit-1';

function text(value) { return String(value ?? '').trim(); }
function keyFor(node) { return text(node?.canonicalObjectId || node?.id || node?.nodeId); }
function parentFor(node) { return text(node?.parentCanonicalObjectId || node?.parentId || node?.parent); }
function escapeHtml(value) { return text(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;'); }
function legacyNodes(root) { const nodes = root?.__rvmFormatNeutralHierarchy?.nodes; return Array.isArray(nodes) ? nodes : []; }
function providerNodes(root) { const provider = root?.__rvmHierarchyProviderResult || root?.__rvmNativeHierarchyProvider?.providerResult || root?.__rvmFormatNeutralHierarchy?.providerResult || root?.__rvmFormatNeutralHierarchy?.hierarchyProviderResult; const nodes = provider?.nodes; return Array.isArray(nodes) ? nodes : []; }
function duplicateKeys(nodes) { const seen = new Set(); const duplicates = new Set(); for (const node of nodes) { const key = keyFor(node); if (!key) continue; if (seen.has(key)) duplicates.add(key); seen.add(key); } return Array.from(duplicates); }
function missingKeys(source, target) { const targetKeys = new Set(target.map(keyFor).filter(Boolean)); return source.map(keyFor).filter(Boolean).filter((key) => !targetKeys.has(key)); }
function parentMismatches(legacy = [], provider = []) { const providerById = new Map(provider.map((node) => [keyFor(node), node]).filter(([key]) => key)); const out = []; for (const node of legacy) { const id = keyFor(node); const other = providerById.get(id); if (!id || !other) continue; const left = parentFor(node); const right = parentFor(other); if (left !== right) out.push({ id, legacyParent: left, providerParent: right }); } return out; }

export function evaluateRvmHierarchyProviderParity(root) {
  const legacy = legacyNodes(root);
  const provider = providerNodes(root);
  const report = {
    version: RVM_HIERARCHY_PROVIDER_PARITY_AUDIT_VERSION,
    legacyNodeCount: legacy.length,
    providerNodeCount: provider.length,
    countDelta: provider.length - legacy.length,
    missingInProvider: missingKeys(legacy, provider),
    missingInLegacy: missingKeys(provider, legacy),
    duplicateLegacyIds: duplicateKeys(legacy),
    duplicateProviderIds: duplicateKeys(provider),
    parentMismatches: parentMismatches(legacy, provider),
  };
  report.ok = !report.countDelta && !report.missingInProvider.length && !report.missingInLegacy.length && !report.duplicateLegacyIds.length && !report.duplicateProviderIds.length && !report.parentMismatches.length;
  return report;
}

function ensurePanel(root) {
  const health = root?.querySelector?.('#rvm-hierarchy-provider-health');
  const anchor = health || root?.querySelector?.('#rvm-hierarchy-provider-debug');
  if (!anchor) return null;
  let panel = root.querySelector('#rvm-hierarchy-provider-parity-audit');
  if (!panel) {
    panel = document.createElement('div');
    panel.id = 'rvm-hierarchy-provider-parity-audit';
    panel.className = 'rvm-browser-diag-warning rvm-hierarchy-provider-parity-audit';
    panel.dataset.rvmHierarchyProviderParityAudit = 'true';
    anchor.insertAdjacentElement('afterend', panel);
  }
  return panel;
}

function render(root, report) {
  const panel = ensurePanel(root);
  if (!panel) return;
  const summary = report.ok ? 'OK' : `delta ${report.countDelta}; missing provider ${report.missingInProvider.length}; missing legacy ${report.missingInLegacy.length}; duplicate provider ${report.duplicateProviderIds.length}; parent mismatch ${report.parentMismatches.length}`;
  panel.dataset.rvmHierarchyProviderParityStatus = report.ok ? 'ok' : 'warn';
  panel.innerHTML = `Hierarchy provider parity: ${escapeHtml(summary)}`;
}

function update(root) {
  if (!root?.querySelector) return null;
  const report = evaluateRvmHierarchyProviderParity(root);
  root.__rvmHierarchyProviderParityAudit = report;
  root.dataset.rvmHierarchyProviderParity = report.ok ? 'ok' : 'warn';
  root.dataset.rvmHierarchyProviderParityVersion = RVM_HIERARCHY_PROVIDER_PARITY_AUDIT_VERSION;
  render(root, report);
  try { root.dispatchEvent(new CustomEvent('rvm-hierarchy-provider-parity-audit', { bubbles: true, detail: report })); } catch (_) {}
  return report;
}

export function installRvmHierarchyProviderParityAuditBridge() {
  if (globalThis[INSTALL_FLAG]) return;
  globalThis[INSTALL_FLAG] = true;
  globalThis.__PCF_GLB_RVM_HIERARCHY_PROVIDER_PARITY_AUDIT__ = { version: RVM_HIERARCHY_PROVIDER_PARITY_AUDIT_VERSION, evaluate: evaluateRvmHierarchyProviderParity };
  const onEvent = (event) => {
    const root = event.target?.closest?.('[data-rvm-viewer]') || event.target;
    requestAnimationFrame(() => update(root));
  };
  document.addEventListener('rvm-tree-rendered', onEvent, true);
  document.addEventListener('rvm-hierarchy-provider-attached', onEvent, true);
  document.addEventListener('rvm-hierarchy-provider-health', onEvent, true);
}
