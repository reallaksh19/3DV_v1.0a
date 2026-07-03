const INSTALL_FLAG = Symbol.for('pcf-glb-rvm-hierarchy-provider-diagnostics-export-1');
export const RVM_HIERARCHY_PROVIDER_DIAGNOSTICS_EXPORT_VERSION = '20260628-rvm-provider-diagnostics-export-1';

function text(value) { return String(value ?? '').trim(); }
function safeFilePart(value) { return text(value).replace(/[^a-z0-9._-]+/gi, '-').replace(/^-+|-+$/g, '') || 'rvm-provider-diagnostics'; }
function providerResult(root) { return root?.__rvmHierarchyProviderResult || root?.__rvmNativeHierarchyProvider?.providerResult || root?.__rvmFormatNeutralHierarchy?.providerResult || root?.__rvmFormatNeutralHierarchy?.hierarchyProviderResult || null; }

export function buildRvmHierarchyProviderDiagnosticsExport(root) {
  const provider = providerResult(root);
  const health = root?.__rvmHierarchyProviderHealth || null;
  const parity = root?.__rvmHierarchyProviderParityAudit || null;
  return {
    version: RVM_HIERARCHY_PROVIDER_DIAGNOSTICS_EXPORT_VERSION,
    generatedAt: new Date().toISOString(),
    sourceKind: root?.dataset?.rvmHierarchySourceKind || root?.dataset?.rvmLoadedSourceKind || provider?.sourceKind || 'unknown',
    provider: provider ? {
      providerId: provider.providerId || '',
      sourceKind: provider.sourceKind || '',
      sourceAuthority: provider.sourceAuthority || '',
      nodeCount: provider.nodeCount ?? null,
      version: provider.version || '',
    } : null,
    health,
    parity,
  };
}

function ensurePanel(root) {
  const anchor = root?.querySelector?.('#rvm-hierarchy-provider-parity-audit') || root?.querySelector?.('#rvm-hierarchy-provider-health') || root?.querySelector?.('#rvm-hierarchy-provider-debug');
  if (!anchor) return null;
  let panel = root.querySelector('#rvm-hierarchy-provider-diagnostics-export');
  if (!panel) {
    panel = document.createElement('div');
    panel.id = 'rvm-hierarchy-provider-diagnostics-export';
    panel.className = 'rvm-hierarchy-provider-diagnostics-export';
    panel.dataset.rvmHierarchyProviderDiagnosticsExport = 'true';
    anchor.insertAdjacentElement('afterend', panel);
  }
  return panel;
}

function downloadJson(root) {
  const data = buildRvmHierarchyProviderDiagnosticsExport(root);
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${safeFilePart(data.sourceKind)}-hierarchy-provider-diagnostics.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  try { root.dispatchEvent(new CustomEvent('rvm-hierarchy-provider-diagnostics-exported', { bubbles: true, detail: data })); } catch (_) {}
}

function render(root) {
  const panel = ensurePanel(root);
  if (!panel) return;
  panel.innerHTML = '<button type="button" class="rvm-mini-btn" data-rvm-provider-diagnostics-export="true">Export provider diagnostics</button>';
}

function onClick(event) {
  const button = event.target?.closest?.('[data-rvm-provider-diagnostics-export]');
  if (!button) return;
  const root = button.closest?.('[data-rvm-viewer]');
  if (!root) return;
  downloadJson(root);
}

export function installRvmHierarchyProviderDiagnosticsExportBridge() {
  if (globalThis[INSTALL_FLAG]) return;
  globalThis[INSTALL_FLAG] = true;
  globalThis.__PCF_GLB_RVM_HIERARCHY_PROVIDER_DIAGNOSTICS_EXPORT__ = { version: RVM_HIERARCHY_PROVIDER_DIAGNOSTICS_EXPORT_VERSION, build: buildRvmHierarchyProviderDiagnosticsExport };
  const update = (event) => {
    const root = event.target?.closest?.('[data-rvm-viewer]') || event.target;
    if (!root?.querySelector) return;
    render(root);
  };
  document.addEventListener('click', onClick, true);
  document.addEventListener('rvm-tree-rendered', update, true);
  document.addEventListener('rvm-hierarchy-provider-attached', update, true);
  document.addEventListener('rvm-hierarchy-provider-health', update, true);
  document.addEventListener('rvm-hierarchy-provider-parity-audit', update, true);
}
