const VERSION = '20260630-rvm-hierarchy-checkbox-tree-controls-1';
const INSTALL_KEY = '__PCF_GLB_RVM_HIERARCHY_CHECKBOX_MULTISELECT__';
const STYLE_ID = 'rvm-hierarchy-checkbox-multiselect-style';
const ROOT_SELECTOR = '[data-rvm-viewer]';
const TREE_SELECTOR = '#rvm-tree';
const MODEL_RESET_EVENTS = ['rvm-model-loaded', 'rvm-source-model-loaded', 'rvm-stagedjson-loaded', 'rvm-native-rvm-loaded'];
const rootStates = new WeakMap();

export function installRvmHierarchyCheckboxMultiSelectBridge() {
  if (typeof document === 'undefined') return null;
  const existing = globalThis[INSTALL_KEY];
  if (existing?.version === VERSION) return existing;
  injectStyles();
  const state = {
    version: VERSION,
    refresh: (reason = 'api') => refreshAll(reason),
    getSelectedIds: (root = document.querySelector(ROOT_SELECTOR)) => selectedIdsFor(root),
    clear: (root = document.querySelector(ROOT_SELECTOR)) => clearSelection(root, 'api-clear'),
  };
  globalThis[INSTALL_KEY] = state;
  document.addEventListener('click', handleClick, true);
  document.addEventListener('change', handleChange, true);
  document.addEventListener('rvm-selection-synced-to-tree', handleSelectionSyncedToTree, true);
  for (const eventName of MODEL_RESET_EVENTS) document.addEventListener(eventName, handleModelReset, true);
  const refreshSoon = debounce((reason) => refreshAll(reason), 40);
  state.observer = new MutationObserver(() => refreshSoon('tree-mutation'));
  state.observer.observe(document.documentElement, { childList: true, subtree: true });
  for (const delay of [0, 80, 250, 750, 1500]) setTimeout(() => refreshAll(`install-${delay}`), delay);
  state.dispose = () => {
    state.observer?.disconnect?.();
    document.removeEventListener('click', handleClick, true);
    document.removeEventListener('change', handleChange, true);
    document.removeEventListener('rvm-selection-synced-to-tree', handleSelectionSyncedToTree, true);
    for (const eventName of MODEL_RESET_EVENTS) document.removeEventListener(eventName, handleModelReset, true);
    if (globalThis[INSTALL_KEY] === state) delete globalThis[INSTALL_KEY];
  };
  return state;
}

function stateFor(root) {
  if (!root) return null;
  let state = rootStates.get(root);
  if (!state) {
    state = { selectedIds: new Set(), staleIds: new Set(), lastIndex: -1, lastRowSignature: '' };
    rootStates.set(root, state);
  }
  return state;
}

function selectedIdsFor(root) {
  return Array.from(stateFor(root)?.selectedIds || []);
}

function refreshAll(reason = 'manual') {
  let rows = 0;
  for (const root of document.querySelectorAll?.(ROOT_SELECTOR) || []) {
    rows += enhanceRoot(root, reason);
  }
  return { version: VERSION, rows, reason };
}

function enhanceRoot(root, reason = 'manual') {
  const tree = root?.querySelector?.(TREE_SELECTOR);
  if (!root || !tree) return 0;
  const state = stateFor(root);
  root.dataset.rvmHierarchyCheckboxMultiselect = VERSION;
  tree.dataset.rvmHierarchyCheckboxMultiselect = VERSION;
  ensureControls(root, tree);
  const rows = rowList(tree);
  const rowIds = new Set(rows.map(nodeId).filter(Boolean));
  reconcileSelectionState(root, state, rowIds, reason);
  rows.forEach((row, index) => enhanceRow(row, state, index));
  syncRows(root, tree);
  updateControls(root, tree);
  stampDiagnostics(root, tree, state);
  return rows.length;
}

function ensureControls(root, tree) {
  if (root.querySelector('[data-rvm-hierarchy-multiselect-controls]')) return;
  const controls = document.createElement('div');
  controls.className = 'rvm-hierarchy-multiselect-controls';
  controls.dataset.rvmHierarchyMultiselectControls = 'true';
  controls.innerHTML = `
    <label class="rvm-hierarchy-multiselect-select-visible"><input type="checkbox" data-rvm-hierarchy-select-visible="true"> Select visible</label>
    <span class="rvm-hierarchy-multiselect-count" data-rvm-hierarchy-selected-count>0 selected</span>
    <button type="button" data-rvm-hierarchy-multi-action="fit" disabled>Fit</button>
    <button type="button" data-rvm-hierarchy-multi-action="isolate" disabled>Isolate</button>
    <button type="button" data-rvm-hierarchy-multi-action="hide" disabled>Hide</button>
    <button type="button" data-rvm-hierarchy-multi-action="show" disabled>Show</button>
    <select data-rvm-hierarchy-lod-detail aria-label="Render selected hierarchy rows">
      <option value="250">250%</option>
      <option value="100" selected>100%</option>
      <option value="50">50%</option>
      <option value="25">25%</option>
      <option value="hidden">Hidden</option>
    </select>
    <button type="button" data-rvm-hierarchy-lod-apply disabled>Apply Render</button>
  `;
  tree.insertAdjacentElement('beforebegin', controls);
}

function enhanceRow(row, state, index) {
  const id = nodeId(row);
  if (!id) return;
  row.dataset.rvmHierarchyMultiselectRow = VERSION;
  row.dataset.rvmHierarchyMultiselectIndex = String(index);
  const navisRow = row.querySelector(':scope > .rvm-navis-row');
  const legacyRow = row.querySelector(':scope > .rvm-tree-node');
  if (!navisRow && !legacyRow) return;
  const nativeTreeRow = Boolean(legacyRow && !navisRow);
  const host = navisRow || row;
  if (navisRow) navisRow.dataset.rvmCheckboxMultiselectRow = 'true';
  if (nativeTreeRow) {
    row.dataset.rvmCheckboxTreeRow = 'true';
    ensureNativeExpander(row);
  }
  let checkbox = nativeTreeRow ? row.querySelector(':scope > [data-rvm-hierarchy-row-checkbox]') : host.querySelector(':scope > [data-rvm-hierarchy-row-checkbox]');
  if (!checkbox) {
    checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'rvm-hierarchy-row-checkbox';
    checkbox.dataset.rvmHierarchyRowCheckbox = 'true';
    checkbox.setAttribute('aria-label', 'Select hierarchy row');
    checkbox.addEventListener('click', (event) => event.stopPropagation());
    if (nativeTreeRow) {
      const label = labelText(row);
      checkbox.title = `Select ${label}`;
      const before = legacyRow || row.firstChild;
      row.insertBefore(checkbox, before);
    } else {
      const expander = navisRow?.querySelector?.(':scope > .rvm-navis-expander');
      if (expander?.nextSibling) host.insertBefore(checkbox, expander.nextSibling);
      else host.insertBefore(checkbox, host.firstChild);
    }
  }
  checkbox.dataset.nodeId = id;
  checkbox.checked = state.selectedIds.has(id);
  row.classList.toggle('is-multi-selected', checkbox.checked);
  row.dataset.rvmHierarchyMultiSelected = checkbox.checked ? 'true' : 'false';
}

function ensureNativeExpander(row) {
  const childList = row.querySelector(':scope > ul');
  const expandable = Boolean(childList?.querySelector?.(':scope > li[data-node-id]'));
  let expander = row.querySelector(':scope > [data-rvm-hierarchy-expander]');
  if (!expander) {
    expander = document.createElement('button');
    expander.type = 'button';
    expander.className = 'rvm-hierarchy-row-expander';
    expander.dataset.rvmHierarchyExpander = 'true';
    expander.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      toggleNativeRow(row);
    });
    row.insertBefore(expander, row.firstChild);
  }
  expander.disabled = !expandable;
  expander.setAttribute('aria-hidden', expandable ? 'false' : 'true');
  expander.setAttribute('aria-label', row.dataset.rvmHierarchyCollapsed === 'true' ? 'Expand hierarchy row' : 'Collapse hierarchy row');
  expander.title = expandable ? (row.dataset.rvmHierarchyCollapsed === 'true' ? 'Expand' : 'Collapse') : '';
  expander.textContent = expandable ? (row.dataset.rvmHierarchyCollapsed === 'true' ? '+' : '-') : '';
  row.classList.toggle('is-tree-expandable', expandable);
  row.classList.toggle('is-tree-collapsed', row.dataset.rvmHierarchyCollapsed === 'true');
}

function toggleNativeRow(row) {
  const collapsed = row.dataset.rvmHierarchyCollapsed !== 'true';
  row.dataset.rvmHierarchyCollapsed = collapsed ? 'true' : 'false';
  ensureNativeExpander(row);
}

function rowList(tree) {
  return Array.from(tree?.querySelectorAll?.('li[data-node-id]') || []);
}

function nodeId(row) {
  return String(row?.dataset?.nodeId || '').trim();
}

function rowSignature(rowIds) {
  const ids = Array.from(rowIds).sort();
  return `${ids.length}:${ids.slice(0, 12).join('|')}::${ids.slice(-12).join('|')}`;
}

function reconcileSelectionState(root, state, rowIds, reason = 'refresh') {
  if (!state) return;
  const signature = rowSignature(rowIds);
  const previousSignature = state.lastRowSignature;
  state.lastRowSignature = signature;
  state.staleIds.clear();
  if (!rowIds.size) return;
  const before = Array.from(state.selectedIds);
  for (const id of before) {
    if (!rowIds.has(id)) {
      state.selectedIds.delete(id);
      state.staleIds.add(id);
    }
  }
  if (previousSignature && previousSignature !== signature && before.length && !state.selectedIds.size) {
    state.lastIndex = -1;
    root.dataset.rvmHierarchyMultiselectClearedForModel = 'true';
    root.dataset.rvmHierarchyMultiselectClearReason = reason;
  }
}

function handleClick(event) {
  const lodApply = event.target?.closest?.('[data-rvm-hierarchy-lod-apply]');
  if (lodApply) {
    event.preventDefault();
    event.stopPropagation();
    const root = lodApply.closest?.(ROOT_SELECTOR);
    const ids = selectedIdsFor(root);
    if (!root || !ids.length) return;
    const detail = root.querySelector?.('[data-rvm-hierarchy-lod-detail]')?.value || '100';
    root.dispatchEvent(new CustomEvent('rvm-hierarchy-lod-action', {
      bubbles: true,
      detail: { version: VERSION, selectedIds: ids, selectedCount: ids.length, renderDetail: detail },
    }));
    return;
  }
  const action = event.target?.closest?.('[data-rvm-hierarchy-multi-action]');
  if (!action) return;
  event.preventDefault();
  event.stopPropagation();
  const root = action.closest?.(ROOT_SELECTOR);
  if (!root) return;
  const ids = selectedIdsFor(root);
  if (!ids.length) return;
  dispatchAction(root, action.dataset.rvmHierarchyMultiAction, ids);
}

function handleChange(event) {
  const rowCheckbox = event.target?.closest?.('[data-rvm-hierarchy-row-checkbox]');
  if (rowCheckbox) {
    event.preventDefault();
    event.stopPropagation();
    const root = rowCheckbox.closest?.(ROOT_SELECTOR);
    const row = rowCheckbox.closest?.('li[data-node-id]');
    updateRowSelection(root, row, rowCheckbox.checked, event.shiftKey);
    return;
  }
  const header = event.target?.closest?.('[data-rvm-hierarchy-select-visible]');
  if (header) {
    event.preventDefault();
    event.stopPropagation();
    const root = header.closest?.(ROOT_SELECTOR);
    setVisibleSelection(root, header.checked);
  }
}

function handleModelReset(event) {
  const root = event.target?.closest?.(ROOT_SELECTOR) || document.querySelector(ROOT_SELECTOR);
  if (root) clearSelection(root, event.type || 'model-reset');
}

function handleSelectionSyncedToTree(event) {
  const root = event.target?.closest?.(ROOT_SELECTOR) || document.querySelector(ROOT_SELECTOR);
  const tree = root?.querySelector?.(TREE_SELECTOR);
  const nodeIdValue = String(event?.detail?.nodeId || '').trim();
  const state = stateFor(root);
  if (!root || !tree || !state || !nodeIdValue) return;
  if (!tree.querySelector(`li[data-node-id="${cssEscape(nodeIdValue)}"]`)) return;
  state.selectedIds.clear();
  state.selectedIds.add(nodeIdValue);
  state.staleIds.clear();
  syncRows(root, tree);
  dispatchChange(root, tree, 'selection-sync');
}

function updateRowSelection(root, row, checked, shiftKey = false) {
  const tree = root?.querySelector?.(TREE_SELECTOR);
  const state = stateFor(root);
  if (!root || !tree || !state || !row) return;
  const rows = rowList(tree);
  const index = rows.indexOf(row);
  if (shiftKey && state.lastIndex >= 0 && index >= 0) {
    const start = Math.min(state.lastIndex, index);
    const end = Math.max(state.lastIndex, index);
    for (const item of rows.slice(start, end + 1)) setNodeSelected(state, nodeId(item), checked);
  } else {
    setNodeSelected(state, nodeId(row), checked);
  }
  state.lastIndex = index;
  syncRows(root, tree);
  dispatchChange(root, tree, 'row-change');
}

function setVisibleSelection(root, checked) {
  const tree = root?.querySelector?.(TREE_SELECTOR);
  const state = stateFor(root);
  if (!root || !tree || !state) return;
  for (const row of visibleRows(tree)) setNodeSelected(state, nodeId(row), checked);
  syncRows(root, tree);
  dispatchChange(root, tree, 'select-visible');
}

function clearSelection(root, reason = 'clear') {
  const tree = root?.querySelector?.(TREE_SELECTOR);
  const state = stateFor(root);
  if (!root || !tree || !state) return [];
  state.selectedIds.clear();
  state.staleIds.clear();
  state.lastIndex = -1;
  syncRows(root, tree);
  dispatchChange(root, tree, reason);
  return [];
}

function setNodeSelected(state, id, checked) {
  if (!id) return;
  if (checked) state.selectedIds.add(id);
  else state.selectedIds.delete(id);
  state.staleIds.delete(id);
}

function syncRows(root, tree) {
  const state = stateFor(root);
  if (!state) return;
  for (const row of rowList(tree)) {
    const id = nodeId(row);
    const checked = state.selectedIds.has(id);
    const checkbox = row.querySelector(':scope > [data-rvm-hierarchy-row-checkbox], :scope > .rvm-navis-row > [data-rvm-hierarchy-row-checkbox], :scope > .rvm-tree-node > [data-rvm-hierarchy-row-checkbox]');
    if (checkbox) checkbox.checked = checked;
    row.classList.toggle('is-multi-selected', checked);
    row.dataset.rvmHierarchyMultiSelected = checked ? 'true' : 'false';
  }
  updateControls(root, tree);
  stampDiagnostics(root, tree, state);
}

function visibleRows(tree) {
  return rowList(tree).filter((row) => row.offsetParent !== null || !row.hidden);
}

function updateControls(root, tree) {
  const state = stateFor(root);
  const controls = root?.querySelector?.('[data-rvm-hierarchy-multiselect-controls]');
  if (!state || !controls) return;
  const visible = visibleRows(tree);
  const selectedVisible = visible.filter((row) => state.selectedIds.has(nodeId(row)));
  const header = controls.querySelector('[data-rvm-hierarchy-select-visible]');
  if (header) {
    header.checked = visible.length > 0 && selectedVisible.length === visible.length;
    header.indeterminate = selectedVisible.length > 0 && selectedVisible.length < visible.length;
  }
  const count = controls.querySelector('[data-rvm-hierarchy-selected-count]');
  if (count) count.textContent = `${state.selectedIds.size} selected`;
  controls.querySelectorAll('[data-rvm-hierarchy-multi-action]').forEach((button) => {
    button.disabled = state.selectedIds.size === 0;
  });
  controls.querySelectorAll('[data-rvm-hierarchy-lod-apply]').forEach((button) => {
    button.disabled = state.selectedIds.size === 0;
  });
}

function diagnostics(root, tree, state = stateFor(root)) {
  const visible = visibleRows(tree);
  const selectedVisible = visible.filter((row) => state?.selectedIds?.has(nodeId(row)));
  return {
    version: VERSION,
    selectedIds: selectedIdsFor(root),
    selectedCount: state?.selectedIds?.size || 0,
    staleCount: state?.staleIds?.size || 0,
    staleIds: Array.from(state?.staleIds || []),
    visibleCount: visible.length,
    visibleSelectedCount: selectedVisible.length,
    rowCount: rowList(tree).length,
  };
}

function stampDiagnostics(root, tree, state = stateFor(root)) {
  const info = diagnostics(root, tree, state);
  if (root?.dataset) {
    root.dataset.rvmHierarchyMultiselectCount = String(info.selectedCount);
    root.dataset.rvmHierarchyMultiselectStaleCount = String(info.staleCount);
    root.dataset.rvmHierarchyMultiselectVisibleSelectedCount = String(info.visibleSelectedCount);
    root.dataset.rvmHierarchyMultiselectVisibleCount = String(info.visibleCount);
    root.dataset.rvmHierarchyMultiselectRowCount = String(info.rowCount);
  }
  root.__rvmHierarchyMultiselectDiagnostics = info;
  return info;
}

function dispatchChange(root, tree, reason = 'change') {
  const info = stampDiagnostics(root, tree);
  root.dispatchEvent(new CustomEvent('rvm-hierarchy-multiselect-change', {
    bubbles: true,
    detail: { ...info, reason },
  }));
}

function dispatchAction(root, action, ids) {
  root.dispatchEvent(new CustomEvent('rvm-hierarchy-multiselect-action', {
    bubbles: true,
    detail: { version: VERSION, action, selectedIds: ids, selectedCount: ids.length },
  }));
}

function cssEscape(value) {
  if (globalThis.CSS?.escape) return globalThis.CSS.escape(value);
  return String(value).replace(/"/g, '\\"');
}

function labelText(row) {
  return String(row?.querySelector?.(':scope > .rvm-tree-node [data-rvm-tree-label], :scope > .rvm-tree-node .rvm-tree-label')?.textContent || row?.dataset?.nodeId || 'hierarchy row').replace(/\s+/g, ' ').trim();
}

function debounce(fn, wait) {
  let timer = 0;
  return (reason) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(reason), wait);
  };
}

function injectStyles() {
  let style = document.getElementById(STYLE_ID);
  if (!style) {
    style = document.createElement('style');
    style.id = STYLE_ID;
    document.head.appendChild(style);
  }
  style.dataset.rvmHierarchyCheckboxMultiselect = VERSION;
  style.textContent = `
    [data-rvm-viewer] .rvm-hierarchy-multiselect-controls{display:flex;align-items:center;gap:5px;flex-wrap:wrap;margin:4px 6px;padding:5px 6px;border:1px solid rgba(126,190,255,.20);border-radius:8px;background:rgba(15,23,42,.62);font:600 10px/1.1 system-ui,sans-serif;color:#bfdbfe;}
    [data-rvm-viewer] .rvm-hierarchy-multiselect-controls label{display:inline-flex;align-items:center;gap:4px;white-space:nowrap;}
    [data-rvm-viewer] .rvm-hierarchy-multiselect-controls select{height:21px;max-width:78px;border:1px solid rgba(126,190,255,.28);border-radius:5px;background:#0f172a;color:#dbeafe;font:600 10px/1 system-ui,sans-serif;}
    [data-rvm-viewer] .rvm-hierarchy-multiselect-controls button{height:21px;padding:0 6px;border:1px solid rgba(126,190,255,.28);border-radius:5px;background:#111827;color:#dbeafe;font:600 10px/1 system-ui,sans-serif;cursor:pointer;}
    [data-rvm-viewer] .rvm-hierarchy-multiselect-controls button:disabled{opacity:.45;cursor:not-allowed;}
    [data-rvm-viewer] .rvm-hierarchy-multiselect-count{margin-left:auto;color:#93c5fd;}
    [data-rvm-viewer] #rvm-tree .rvm-navis-row[data-rvm-checkbox-multiselect-row="true"]{grid-template-columns:20px 18px minmax(0,1fr) max-content max-content;}
    [data-rvm-viewer] #rvm-tree .rvm-navis-row[data-rvm-checkbox-multiselect-row="true"] > .rvm-hierarchy-row-checkbox{grid-column:2;justify-self:center;align-self:center;width:14px;height:14px;margin:0;accent-color:#60a5fa;}
    [data-rvm-viewer] #rvm-tree .rvm-navis-row[data-rvm-checkbox-multiselect-row="true"] > .rvm-navis-select{grid-column:3;}
    [data-rvm-viewer] #rvm-tree .rvm-navis-row[data-rvm-checkbox-multiselect-row="true"] > .rvm-navis-branch-off{grid-column:4;}
    [data-rvm-viewer] #rvm-tree .rvm-navis-row[data-rvm-checkbox-multiselect-row="true"] > .rvm-navis-branch-on{grid-column:5;}
    [data-rvm-viewer] #rvm-tree li[data-rvm-checkbox-tree-row="true"]{display:grid;grid-template-columns:18px 18px minmax(0,1fr) max-content;gap:4px;align-items:start;}
    [data-rvm-viewer] #rvm-tree li[data-rvm-checkbox-tree-row="true"] > .rvm-hierarchy-row-expander{grid-column:1;width:16px;height:22px;margin:1px 0 0;padding:0;border:1px solid rgba(96,165,250,.35);border-radius:4px;background:#0f172a;color:#dbeafe;font:700 12px/1 system-ui,sans-serif;cursor:pointer;}
    [data-rvm-viewer] #rvm-tree li[data-rvm-checkbox-tree-row="true"] > .rvm-hierarchy-row-expander[disabled]{opacity:.25;cursor:default;}
    [data-rvm-viewer] #rvm-tree li[data-rvm-checkbox-tree-row="true"] > .rvm-hierarchy-row-checkbox{grid-column:2;justify-self:center;align-self:center;width:14px;height:14px;margin:5px 0 0;accent-color:#60a5fa;}
    [data-rvm-viewer] #rvm-tree li[data-rvm-checkbox-tree-row="true"] > .rvm-tree-node{grid-column:3;grid-row:1;}
    [data-rvm-viewer] #rvm-tree li[data-rvm-checkbox-tree-row="true"] > .rvm-tree-visibility-toggle{grid-column:4;grid-row:1;}
    [data-rvm-viewer] #rvm-tree li[data-rvm-checkbox-tree-row="true"] > ul{grid-column:3 / -1;margin:2px 0 0 6px;padding-left:8px;border-left:1px solid rgba(96,165,250,.20);}
    [data-rvm-viewer] #rvm-tree li[data-rvm-checkbox-tree-row="true"][data-rvm-hierarchy-collapsed="true"] > ul{display:none;}
    [data-rvm-viewer] #rvm-tree li.is-multi-selected > .rvm-navis-row .rvm-navis-select,[data-rvm-viewer] #rvm-tree li.is-multi-selected > .rvm-tree-node{background:rgba(22,163,74,.18);outline:1px solid rgba(74,222,128,.50);box-shadow:inset 3px 0 0 rgba(74,222,128,.70);}
    @media (max-width:1100px){[data-rvm-viewer] #rvm-tree .rvm-navis-row[data-rvm-checkbox-multiselect-row="true"]{grid-template-columns:20px 18px minmax(0,1fr) max-content max-content;}[data-rvm-viewer] .rvm-hierarchy-multiselect-count{margin-left:0;}}
  `;
}
