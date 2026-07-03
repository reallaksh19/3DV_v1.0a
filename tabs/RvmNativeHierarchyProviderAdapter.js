import { RVM_HIERARCHY_PROVIDER_CONTRACT_VERSION, providerResultFromNativeRvmPayload } from './RvmHierarchyProviderContract.js';

export const RVM_NATIVE_HIERARCHY_PROVIDER_ADAPTER_VERSION = '20260628-rvm-native-provider-adapter-1';

function text(value) { return String(value ?? '').trim(); }

export function makeNativeRvmHierarchyProvider(payload = {}) {
  const providerResult = providerResultFromNativeRvmPayload(payload);
  return {
    version: RVM_NATIVE_HIERARCHY_PROVIDER_ADAPTER_VERSION,
    providerContractVersion: RVM_HIERARCHY_PROVIDER_CONTRACT_VERSION,
    providerId: 'native-rvm',
    sourceKind: 'rvm',
    sourceAuthority: 'native-rvm',
    fileName: text(providerResult.fileName),
    nodeCount: providerResult.nodeCount,
    providerResult,
    readOnly: true,
  };
}

export function attachNativeRvmHierarchyProvider(target, payload = {}) {
  if (!target || typeof target !== 'object') return null;
  const provider = makeNativeRvmHierarchyProvider(payload);
  target.rvmNativeHierarchyProvider = provider;
  target.rvmHierarchyProviderResult = provider.providerResult;
  return provider;
}
