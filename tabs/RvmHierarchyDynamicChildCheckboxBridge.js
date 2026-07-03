const VERSION = '20260630-rvm-hierarchy-dynamic-child-checkbox-1';
const GLOBAL_KEY = '__PCF_GLB_RVM_HIERARCHY_DYNAMIC_CHILD_CHECKBOX__';
const ROOT_SELECTOR = '[data-rvm-viewer]';
const TREE_SELECTOR = '#rvm-tree';
let observer = null;
let refreshTimer = 0;
let cascading = false;

export function installRvmHierarchyDynamicChildCheckboxBridge() {
  if (typeof document === 'undefined') return null;
  const existing = globalThis[GLOBAL_KEY];
  if (existing?.version === VERSION) return existing;
  injectStyles();
  const api = { version: VERSION, refresh: (reason = 'api') => refreshAll(reason) };
  globalThis[GLOBAL_KEY] = api;
  document.addEventListener('change', onCheckboxChange, true);
  document.addEventListener('rvm-hierarchy-multiselect-change', () => scheduleRefresh('multiselect-change'), true);
  for (const name of ['rvm-model-loaded', 'rvm-tree-rendered', 'rvm-source-model-loaded', 'rvm-native-rvm-loaded']) {
    globalThis.addEventListener?.(name, () => scheduleRefresh(name));
  }
  observer = new MutationObserver(() => scheduleRefresh('tree-mutation'));
  observer.observe(document.documentElement, { childList: true, subtree: true });
  for (const delay of [0, 80, 250, 750, 1500, 3000]) setTimeout(() => refreshAll(`install-${delay}`), delay);
  return api;
}

function scheduleRefresh(reason) {
  clearTimeout(refreshTimer);
  refreshTimer = setTimeout(() => refreshAll(reason), 35);
}

function refreshAll(reason = 'manual') {
  let rows = 0;
  for (const root of document.querySelectorAll?.(ROOT_SELECTOR) || []) rows += enhanceRoot(root, reason);
  return { version: VERSION, rows, reason };
}

function enhanceRoot(root, reason = 'manual') {
  const tree = root?.querySelector?.(TREE_SELECTOR);
  if (!tree) return 0;
  const rows = [...tree.querySelectorAll('li[data-node-id]')];
  for (const row of rows) ensureRowCheckbox(row);
  syncIndeterminate(tree);
  root.dataset.rvmHierarchyDynamicChildCheckbox = VERSION;
  root.dataset.rvmHierarchyDynamicChildCheckboxReason = reason;
  root.dataset.rvmHierarchyDynamicChildCheckboxRows = String(rows.length);
  return rows.length;
}

function ensureRowCheckbox(row) {
  if (!row || row.querySelector(':scope > [data-rvm-hierarchy-row-checkbox], :scope > .rvm-navis-row > [data-rvm-hierarchy-row-checkbox]')) return;
  const navisRow = row.querySelector(':scope > .rvm-navis-row');
  const treeNode = row.querySelector(':scope > .rvm-tree-node');
  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.className = 'rvm-hierarchy-row-checkbox';
  checkbox.dataset.rvmHierarchyRowCheckbox = 'true';
  checkbox.dataset.rvmHierarchyDynamicChildCheckbox = VERSION;
  checkbox.dataset.nodeId = row.dataset.nodeId || '';
  checkbox.setAttribute('aria-label', `Select ${labelForRow(row)} and children`);
  checkbox.title = `Select ${labelForRow(row)} and children`;
  checkbox.addEventListener('click', (event) => event.stopPropagation());
  if (navisRow) {
    const expander = navisRow.querySelector(':scope > .rvm-navis-expander');
    if (expander?.nextSibling) navisRow.insertBefore(checkbox, expander.nextSibling);
    else navisRow.insertBefore(checkbox, navisRow.firstChild);
    navisRow.dataset.rvmCheckboxMultiselectRow = 'true';
  } else if (treeNode) {
    row.dataset.rvmCheckboxTreeRow = 'true';
    row.insertBefore(checkbox, treeNode);
  }
}

function onCheckboxChange(event) {
  const checkbox = event.target?.closest?.('[data-rvm-hierarchy-row-checkbox]');
  if (!checkbox || cascading) return;
  const row = checkbox.closest?.('li[data-node-id]');
  if (!row) return;
  const children = [...row.querySelectorAll(':scope li[data-node-id] [data-rvm-hierarchy-row-checkbox]')];
  if (!children.length) {
    scheduleRefresh('leaf-change');
    return;
  }
  cascading = true;
  try {
    for (const child of children) {
      if (child.checked === checkbox.checked && !child.indeterminate) continue;
      child.checked = checkbox.checked;
      child.indeterminate = false;
      child.dispatchEvent(new Event('change', { bubbles: true }));
    }
  } finally {
    cascading = false;
  }
  scheduleRefresh('cascade-change');
}

function syncIndeterminate(tree) {
  const rows = [...tree.querySelectorAll('li[data-node-id]')].reverse();
  for (const row of rows) {
    const checkbox = row.querySelector(':scope > [data-rvm-hierarchy-row-checkbox], :scope > .rvm-navis-row > [data-rvm-hierarchy-row-checkbox]');
    if (!checkbox) continue;
    const childBoxes = [...row.querySelectorAll(':scope li[data-node-id] [data-rvm-hierarchy-row-checkbox]')];
    const checked = childBoxes.filter((box) => box.checked).length;
    const partial = childBoxes.some((box) => box.indeterminate) || (checked > 0 && checked < childBoxes.length);
    checkbox.indeterminate = !checkbox.checked && partial;
    row.classList.toggle('is-multi-partial', Boolean(checkbox.indeterminate));
    row.dataset.rvmHierarchyDynamicChildCount = String(childBoxes.length);
    row.dataset.rvmHierarchyDynamicChildSelected = String(checked);
  }
}

function labelForRow(row) {
  return String(row?.querySelector?.(':scope > .rvm-navis-row .rvm-navis-label, :scope > .rvm-tree-node [data-rvm-tree-label], :scope > .rvm-tree-node .rvm-tree-label')?.textContent || row?.dataset?.nodeId || 'hierarchy row').replace(/\s+/g, ' ').trim();
}

function injectStyles() {
  if (document.getElementById('rvm-hierarchy-dynamic-child-checkbox-style')) return;
  const style = document.createElement('style');
  style.id = 'rvm-hierarchy-dynamic-child-checkbox-style';
  style.textContent = `
    [data-rvm-viewer] #rvm-tree .rvm-hierarchy-row-checkbox[data-rvm-hierarchy-dynamic-child-checkbox]{accent-color:#60a5fa;}
    [data-rvm-viewer] #rvm-tree .rvm-hierarchy-row-checkbox:indeterminate{accent-color:#fbbf24;}
    [data-rvm-viewer] #rvm-tree li.is-multi-partial > .rvm-navis-row .rvm-navis-select,
    [data-rvm-viewer] #rvm-tree li.is-multi-partial > .rvm-tree-node{background:rgba(251,191,36,.10);outline:1px dashed rgba(251,191,36,.42);box-shadow:inset 3px 0 0 rgba(251,191,36,.55);}
  `;
  document.head.appendChild(style);
}
