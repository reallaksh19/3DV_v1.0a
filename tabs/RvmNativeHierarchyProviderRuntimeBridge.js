import { attachNativeRvmHierarchyProvider, RVM_NATIVE_HIERARCHY_PROVIDER_ADAPTER_VERSION } from './RvmNativeHierarchyProviderAdapter.js';

const INSTALL_FLAG = Symbol.for('pcf-glb-rvm-native-provider-runtime-1');
export const RVM_NATIVE_HIERARCHY_PROVIDER_RUNTIME_VERSION = '20260628-rvm-native-provider-runtime-1';

function isNativeRvmTree(root, detail = {}) {
  const kind = String(detail?.sourceKind || root?.dataset?.rvmHierarchySourceKind || root?.dataset?.rvmLoadedSourceKind || '').toLowerCase();
  const mode = String(root?.dataset?.rvmModelPrimitiveMode || '').toLowerCase();
  return kind === 'rvm' || mode === 'rvm-native';
}

function attachProvider(root, detail = {}) {
  if (!root || !isNativeRvmTree(root, detail)) return null;
  const state = root.__rvmFormatNeutralHierarchy || detail || {};
  const nodes = Array.isArray(state.nodes) ? state.nodes : [];
  const payload = {
    fileName: state.fileName || detail.fileName || '',
    manifest: {
      fileName: state.fileName || detail.fileName || '',
      nodes,
      metadata: state.metadata || null,
    },
  };
  const provider = attachNativeRvmHierarchyProvider(state, payload);
  if (!provider) return null;
  root.__rvmNativeHierarchyProvider = provider;
  root.__rvmHierarchyProviderResult = provider.providerResult;
  root.dataset.rvmHierarchyProvider = provider.providerId;
  root.dataset.rvmHierarchyProviderVersion = RVM_NATIVE_HIERARCHY_PROVIDER_RUNTIME_VERSION;
  root.dataset.rvmHierarchyProviderContract = provider.providerContractVersion;
  try {
    root.dispatchEvent(new CustomEvent('rvm-hierarchy-provider-attached', { bubbles: true, detail: { provider, adapterVersion: RVM_NATIVE_HIERARCHY_PROVIDER_ADAPTER_VERSION, runtimeVersion: RVM_NATIVE_HIERARCHY_PROVIDER_RUNTIME_VERSION } }));
  } catch (_) {}
  return provider;
}

export function installRvmNativeHierarchyProviderRuntimeBridge() {
  if (globalThis[INSTALL_FLAG]) return;
  globalThis[INSTALL_FLAG] = true;
  globalThis.__PCF_GLB_RVM_NATIVE_HIERARCHY_PROVIDER_RUNTIME__ = { version: RVM_NATIVE_HIERARCHY_PROVIDER_RUNTIME_VERSION };
  document.addEventListener('rvm-tree-rendered', (event) => {
    const root = event.target?.closest?.('[data-rvm-viewer]') || event.target;
    attachProvider(root, event.detail || {});
  }, true);
}
