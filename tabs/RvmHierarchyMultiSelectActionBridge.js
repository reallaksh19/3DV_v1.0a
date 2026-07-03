const VERSION = '20260629-rvm-hierarchy-multiselect-action-status-2';
const INSTALL_KEY = '__PCF_GLB_RVM_HIERARCHY_MULTISELECT_ACTIONS__';
const ROOT_SELECTOR = '[data-rvm-viewer]';
const ACTIONS = new Set(['fit', 'isolate', 'hide', 'show']);

export function installRvmHierarchyMultiSelectActionBridge() {
  if (typeof document === 'undefined') return null;
  const existing = globalThis[INSTALL_KEY];
  if (existing?.version === VERSION) return existing;
  const state = { version: VERSION, dispatch: dispatchHierarchyMultiSelectAction };
  globalThis[INSTALL_KEY] = state;
  document.addEventListener('rvm-hierarchy-multiselect-action', onAction, true);
  state.dispose = () => {
    document.removeEventListener('rvm-hierarchy-multiselect-action', onAction, true);
    if (globalThis[INSTALL_KEY] === state) delete globalThis[INSTALL_KEY];
  };
  return state;
}

function onAction(event) {
  const root = event.target?.closest?.(ROOT_SELECTOR) || event.target;
  const result = dispatchHierarchyMultiSelectAction(root, event.detail || {});
  if (result?.handled) {
    event.stopPropagation?.();
    event.preventDefault?.();
  }
}

function currentViewer(root) {
  return root?.__rvmViewer3D || root?.__rvmViewer || root?.viewer || globalThis.__3D_RVM_VIEWER__ || null;
}

function visibilityState(viewer) {
  const state = viewer?.visibility?.getVisibilityState?.();
  if (state) return state;
  const hiddenCanonicalIds = viewer?.visibility?.getHiddenCanonicalIds?.() || [];
  const isolatedCanonicalIds = viewer?.visibility?.getIsolatedCanonicalIds?.() || [];
  return {
    hiddenCanonicalIds,
    isolatedCanonicalIds,
    hiddenCount: hiddenCanonicalIds.length,
    isolatedCount: isolatedCanonicalIds.length,
    isolatedMode: isolatedCanonicalIds.length > 0,
  };
}

function actionLabel(action) {
  if (action === 'fit') return 'Fit';
  if (action === 'isolate') return 'Isolate';
  if (action === 'hide') return 'Hide';
  if (action === 'show') return 'Show';
  return action || 'Action';
}

function statusMessage(result) {
  const label = actionLabel(result.action);
  if (result.error === 'viewer-not-found') return `${label} selected failed: viewer not ready.`;
  if (result.error === 'empty-selection') return `${label} selected ignored: no checked hierarchy rows.`;
  if (result.error) return `${label} selected failed: ${result.error}`;
  if (!result.handled) return `${label} selected ignored.`;
  const count = result.selectedCount || 0;
  if (result.action === 'fit') return `Fit ${count} checked hierarchy item(s).`;
  if (result.action === 'isolate') return `Isolated ${count} checked hierarchy item(s).`;
  if (result.action === 'hide') return `Hidden ${count} checked hierarchy item(s).`;
  if (result.action === 'show') return `Shown ${count} checked hierarchy item(s).`;
  return `${label} applied to ${count} checked hierarchy item(s).`;
}

function updateStatus(root, result) {
  const message = statusMessage(result);
  const warning = !!result.error || !result.handled;
  const targets = [root?.querySelector?.('#rvm-sb-msg'), root?.querySelector?.('[data-rvm-hierarchy-multiselect-status]')].filter(Boolean);
  for (const target of targets) {
    target.textContent = message;
    if (warning) target.dataset.rvmStatusWarning = 'true';
    else delete target.dataset.rvmStatusWarning;
  }
  if (root?.dataset) {
    root.dataset.rvmHierarchyMultiselectLastMessage = message;
    root.dataset.rvmHierarchyMultiselectLastError = result.error || '';
  }
}

export function dispatchHierarchyMultiSelectAction(root, detail = {}) {
  const action = String(detail.action || '').toLowerCase();
  const selectedIds = Array.isArray(detail.selectedIds) ? detail.selectedIds.filter(Boolean) : [];
  const viewer = currentViewer(root);
  const result = { version: VERSION, action, selectedIds, selectedCount: selectedIds.length, handled: false, method: '', error: '' };
  if (!ACTIONS.has(action)) return emitResult(root, result, viewer);
  if (!viewer) return emitResult(root, { ...result, error: 'viewer-not-found' }, viewer);
  if (!selectedIds.length) return emitResult(root, { ...result, error: 'empty-selection' }, viewer);
  try {
    if (action === 'fit') {
      viewer.selectCanonicalIds?.(selectedIds, { additive: false });
      viewer.fitSelection?.();
      return emitResult(root, { ...result, handled: true, method: 'selectCanonicalIds+fitSelection' }, viewer);
    }
    if (action === 'isolate') {
      viewer.visibility?.isolate?.(selectedIds);
      return emitResult(root, { ...result, handled: true, method: 'visibility.isolate' }, viewer);
    }
    if (action === 'hide') {
      viewer.visibility?.hide?.(selectedIds);
      return emitResult(root, { ...result, handled: true, method: 'visibility.hide' }, viewer);
    }
    if (action === 'show') {
      if (typeof viewer.visibility?.show === 'function') viewer.visibility.show(selectedIds);
      else viewer.showAll?.();
      return emitResult(root, { ...result, handled: true, method: 'visibility.show' }, viewer);
    }
  } catch (error) {
    return emitResult(root, { ...result, error: error?.message || String(error) }, viewer);
  }
  return emitResult(root, result, viewer);
}

function emitResult(root, result, viewer = null) {
  const visibility = visibilityState(viewer);
  const enriched = {
    ...result,
    hiddenCount: visibility.hiddenCount,
    isolatedCount: visibility.isolatedCount,
    isolatedMode: visibility.isolatedMode,
    hiddenCanonicalIds: visibility.hiddenCanonicalIds,
    isolatedCanonicalIds: visibility.isolatedCanonicalIds,
  };
  if (root?.dataset) {
    root.dataset.rvmHierarchyMultiselectActionVersion = VERSION;
    root.dataset.rvmHierarchyMultiselectLastAction = enriched.action || '';
    root.dataset.rvmHierarchyMultiselectLastActionHandled = enriched.handled ? 'true' : 'false';
    root.dataset.rvmHierarchyMultiselectSelectedCount = String(enriched.selectedCount || 0);
    root.dataset.rvmHierarchyMultiselectHiddenCount = String(enriched.hiddenCount || 0);
    root.dataset.rvmHierarchyMultiselectIsolatedCount = String(enriched.isolatedCount || 0);
  }
  updateStatus(root, enriched);
  try { root?.dispatchEvent?.(new CustomEvent('rvm-hierarchy-multiselect-action-applied', { bubbles: true, detail: enriched })); } catch (_) {}
  return enriched;
}
