const VERSION = '20260628-rvm-tab-startup-selection-fix-1';

const ACTION_LABELS = Object.freeze({
  NAV_SELECT: 'Select'
});

function reportRvmStartupHelperError(error, context = {}) {
  if (typeof globalThis.__PCF_GLB_RVM_REPORT_ACTION_ERROR__ === 'function') {
    return globalThis.__PCF_GLB_RVM_REPORT_ACTION_ERROR__(error, {
      helperVersion: VERSION,
      ...context,
    });
  }
  console.warn('[RVM tab startup helper] action failed', { helperVersion: VERSION, ...context }, error);
  return null;
}

function setInitialSelectMode(root, viewer) {
  root?.querySelectorAll?.('[data-action]').forEach((button) => {
    button.classList.toggle('is-active', button.dataset.action === 'NAV_SELECT');
  });
  const modeChip = root?.querySelector?.('#rvm-mode-chip');
  if (modeChip) modeChip.textContent = ACTION_LABELS.NAV_SELECT;
  try {
    if (typeof viewer?.handleToolbarAction === 'function') viewer.handleToolbarAction('NAV_SELECT');
    else if (typeof viewer?.dispatchAction === 'function') viewer.dispatchAction('NAV_SELECT');
    else globalThis.dispatchEvent?.(new CustomEvent('viewer3d:rvm:toolbar-action', {
      detail: { action: 'NAV_SELECT', viewer, helperVersion: VERSION },
    }));
  } catch (error) {
    reportRvmStartupHelperError(error, { action: 'initial-select-mode' });
  }
}

function clearRvmSelectionState(root, viewer, reason = 'reset') {
  try { viewer?.selection?.clear?.(); } catch (error) { reportRvmStartupHelperError(error, { action: 'selection-clear', reason }); }
  try { viewer?.selection?.set?.([]); } catch (_) {}
  try { viewer?.clearSelection?.(); } catch (_) {}
  root?.querySelectorAll?.('.is-selected,[aria-selected="true"]').forEach((node) => {
    node.classList.remove('is-selected');
    node.removeAttribute('aria-selected');
  });
  const selectedCount = root?.querySelector?.('#rvm-sel-count');
  if (selectedCount) selectedCount.textContent = '0';
  const selectedChip = root?.querySelector?.('[data-rvm-status-chip="selected"]');
  if (selectedChip) selectedChip.textContent = 'Selected: 0';
}

function makeDiagnosticsSeed(fileName = '') {
  return {
    schema: 'BrowserRvmTabDiagnostics.v1',
    helperVersion: VERSION,
    fileName,
    browserRvmLoadState: 'queued',
    browserRvmWorkerLoaded: false,
    browserRvmWorkerMessageReceived: false,
    browserRvmRenderableCount: 0,
    browserRvmSkippedCount: 0,
    browserRvmTreeNodesRendered: 0,
  };
}

globalThis.setInitialSelectMode = typeof globalThis.setInitialSelectMode === 'function'
  ? globalThis.setInitialSelectMode
  : setInitialSelectMode;
globalThis.clearRvmSelectionState = typeof globalThis.clearRvmSelectionState === 'function'
  ? globalThis.clearRvmSelectionState
  : clearRvmSelectionState;
globalThis.makeDiagnosticsSeed = typeof globalThis.makeDiagnosticsSeed === 'function'
  ? globalThis.makeDiagnosticsSeed
  : makeDiagnosticsSeed;

globalThis.__PCF_GLB_RVM_TAB_STARTUP_HELPERS__ = Object.freeze({
  version: VERSION,
  setInitialSelectMode: globalThis.setInitialSelectMode,
  clearRvmSelectionState: globalThis.clearRvmSelectionState,
  makeDiagnosticsSeed: globalThis.makeDiagnosticsSeed,
});

export { VERSION, clearRvmSelectionState, makeDiagnosticsSeed, setInitialSelectMode };
