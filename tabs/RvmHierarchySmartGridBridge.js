const VERSION = '20260630-rvm-hierarchy-path-grid-compact-font-1';
const ROOT_SELECTOR = '[data-rvm-viewer]';
const TREE_SELECTOR = '#rvm-tree';
const INSTALL_KEY = '__PCF_GLB_RVM_HIERARCHY_SMART_GRID__';

export function installRvmHierarchySmartGridBridge() {
  if (typeof document === 'undefined') return null;
  const existing = globalThis[INSTALL_KEY];
  if (existing?.version === VERSION) return existing;
  injectStyles();
  const state = { version: VERSION, runCount: 0, rowCount: 0, labelFallbackCount: 0, lastReason: 'install', observer: null, refresh: (reason = 'api') => refreshAll(reason) };
  globalThis[INSTALL_KEY] = state;
  const refreshSoon = debounce((reason) => refreshAll(reason), 40);
  state.observer = new MutationObserver(() => refreshSoon('tree-mutation'));
  state.observer.observe(document.documentElement, { childList: true, subtree: true });
  for (const delay of [0, 80, 250, 750, 1500, 3000]) setTimeout(() => refreshAll(`install-${delay}`), delay);
  try { globalThis.addEventListener?.('rvm-model-loaded', () => refreshAll('model-loaded')); } catch (_) {}
  try { document.addEventListener?.('rvm-selection-synced-to-tree', () => refreshAll('selection-sync'), true); } catch (_) {}
  state.dispose = () => { state.observer?.disconnect?.(); if (globalThis[INSTALL_KEY] === state) delete globalThis[INSTALL_KEY]; };
  return state;
}

function refreshAll(reason = 'manual') {
  const state = globalThis[INSTALL_KEY];
  if (!state) return null;
  let total = 0;
  let fallback = 0;
  for (const root of document.querySelectorAll?.(ROOT_SELECTOR) || []) {
    const tree = root.querySelector?.(TREE_SELECTOR);
    if (!tree) continue;
    tree.dataset.rvmHierarchyAdaptiveColumns = VERSION;
    const result = normalizeTree(root, tree);
    total += result.rows;
    fallback += result.fallbacks;
    root.dataset.rvmHierarchySmartGrid = VERSION;
    root.dataset.rvmHierarchySmartGridRows = String(result.rows);
    root.dataset.rvmHierarchySmartGridFallbacks = String(result.fallbacks);
  }
  state.runCount += 1;
  state.rowCount = total;
  state.labelFallbackCount = fallback;
  state.lastReason = reason;
  return { version: VERSION, reason, rows: total, fallbacks: fallback };
}

function normalizeTree(root, tree) {
  let rows = 0;
  let fallbacks = 0;
  for (const row of tree.querySelectorAll('li[data-node-id]')) {
    rows += 1;
    row.dataset.rvmSmartHierarchyRow = VERSION;
    const depth = Number(row.dataset.rvmNavisDepth || row.dataset.depth || row.querySelector?.('.rvm-navis-row')?.style?.getPropertyValue?.('--rvm-navis-depth') || 0);
    row.style.setProperty('--rvm-smart-depth', String(Number.isFinite(depth) ? depth : 0));
    const navisRow = row.querySelector(':scope > .rvm-navis-row');
    if (navisRow) {
      navisRow.dataset.rvmSmartHierarchyGrid = VERSION;
      const select = navisRow.querySelector('.rvm-navis-select');
      if (select) select.dataset.rvmSmartSelect = 'true';
      const label = navisRow.querySelector('.rvm-navis-label');
      if (label) {
        const text = cleanText(label.textContent);
        if (!text) { label.textContent = fallbackLabel(row); fallbacks += 1; }
        label.setAttribute('title', label.textContent || row.dataset.nodeId || 'Hierarchy node');
      }
      const kind = navisRow.querySelector('.rvm-kind');
      if (kind) kind.setAttribute('title', kind.textContent || 'Kind');
      const count = navisRow.querySelector('.rvm-tree-count');
      if (count) count.setAttribute('title', `Objects: ${count.textContent || '0'}`);
      continue;
    }
    const legacy = row.querySelector(':scope > .rvm-tree-node');
    if (legacy) {
      legacy.dataset.rvmSmartHierarchyGrid = VERSION;
      let label = legacy.querySelector('[data-rvm-tree-label], .rvm-tree-label');
      if (!label) {
        const spans = [...legacy.querySelectorAll('span')].filter((span) => !span.classList.contains('rvm-kind') && !span.classList.contains('rvm-tree-count'));
        label = spans[0] || null;
      }
      if (label) {
        label.classList.add('rvm-tree-label');
        label.dataset.rvmTreeLabel = 'true';
        if (!cleanText(label.textContent)) { label.textContent = fallbackLabel(row); fallbacks += 1; }
        label.setAttribute('title', cleanText(label.textContent) || row.dataset.nodeId || 'Hierarchy node');
      }
      ensurePathLabel(row, legacy);
    }
  }
  return { rows, fallbacks };
}

function ensurePathLabel(row, button) {
  if (!row || !button) return null;
  const path = cleanPath(row.dataset.rvmTreePath || row.getAttribute('data-rvm-tree-path') || '');
  if (!path) return null;
  let pathLabel = button.querySelector(':scope > [data-rvm-tree-path-label], :scope > .rvm-tree-path');
  if (!pathLabel) {
    pathLabel = document.createElement('span');
    pathLabel.className = 'rvm-tree-path';
    pathLabel.dataset.rvmTreePathLabel = 'true';
    button.appendChild(pathLabel);
  }
  pathLabel.textContent = path;
  pathLabel.setAttribute('title', path);
  return pathLabel;
}

function fallbackLabel(row) { const id = row?.dataset?.nodeId || ''; const parts = String(id).split('/').map((part) => part.trim()).filter(Boolean); return parts[parts.length - 1] || id || 'Hierarchy node'; }
function cleanText(value) { return String(value || '').replace(/\b(On|Off)\b/g, ' ').replace(/\s+/g, ' ').trim(); }
function cleanPath(value) { return String(value || '').replace(/\s*>\s*/g, ' > ').replace(/\s+/g, ' ').trim(); }
function debounce(fn, wait) { let timer = 0; return (reason) => { clearTimeout(timer); timer = setTimeout(() => fn(reason), wait); }; }

function injectStyles() {
  let style = document.getElementById('rvm-hierarchy-smart-grid-style');
  if (!style) { style = document.createElement('style'); style.id = 'rvm-hierarchy-smart-grid-style'; document.head.appendChild(style); }
  style.dataset.rvmHierarchySmartGrid = VERSION;
  style.textContent = `
    [data-rvm-viewer] .rvm-left-panel{width:clamp(320px,30vw,620px);min-width:220px;max-width:min(620px,46vw);resize:horizontal;overflow:auto;scrollbar-gutter:stable;}
    [data-rvm-viewer] #rvm-tree{box-sizing:border-box;width:100%;max-width:100%;overflow-x:hidden;overflow-y:auto;padding:4px 6px 10px;font-size:9px;line-height:1.15;}
    [data-rvm-viewer] #rvm-tree, [data-rvm-viewer] #rvm-tree *{box-sizing:border-box;}
    [data-rvm-viewer] #rvm-tree li[data-node-id]{max-width:100%;min-width:0;overflow:visible;padding:1px 0;display:grid;grid-template-columns:minmax(0,1fr) max-content;gap:4px;align-items:start;}
    [data-rvm-viewer] #rvm-tree li[data-node-id] > ul,[data-rvm-viewer] #rvm-tree li[data-node-id] > .rvm-navis-row,[data-rvm-viewer] #rvm-tree li[data-node-id] > .rvm-navis-children{grid-column:1 / -1;}
    [data-rvm-viewer] #rvm-tree .rvm-navis-row{width:100%;min-width:0;display:grid;grid-template-columns:20px minmax(0,1fr) max-content max-content;gap:4px;align-items:center;padding-left:min(120px,calc(var(--rvm-navis-depth,0) * 12px));font-size:9px;}
    [data-rvm-viewer] #rvm-tree .rvm-navis-expander{grid-column:1;width:18px;min-width:18px;height:18px;padding:0;display:grid;place-items:center;border-radius:4px;font-size:8px;}
    [data-rvm-viewer] #rvm-tree .rvm-navis-select{grid-column:2;min-width:0;width:100%;height:20px;display:grid;grid-template-columns:14px minmax(34px,max-content) minmax(0,1fr) minmax(20px,max-content);align-items:center;gap:4px;padding:1px 5px;border-radius:5px;text-align:left;overflow:hidden;font-size:9px;}
    [data-rvm-viewer] #rvm-tree .rvm-navis-icon{width:14px;min-width:14px;text-align:center;opacity:.9;font-size:8px;}
    [data-rvm-viewer] #rvm-tree .rvm-navis-select .rvm-kind{min-width:0;max-width:clamp(32px,18%,76px);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:8px;color:#93c5fd;}
    [data-rvm-viewer] #rvm-tree .rvm-navis-label{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#dbeafe;font-size:9px;line-height:1.15;}
    [data-rvm-viewer] #rvm-tree .rvm-tree-count{justify-self:end;min-width:16px;max-width:48px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#bfdbfe;font-size:8px;text-align:right;}
    [data-rvm-viewer] #rvm-tree .rvm-navis-branch-off,[data-rvm-viewer] #rvm-tree .rvm-navis-branch-on{width:auto;min-width:28px;max-width:38px;height:20px;padding:0 4px;font-size:8px;border-radius:5px;}
    [data-rvm-viewer] #rvm-tree .rvm-navis-branch-off{grid-column:3;}
    [data-rvm-viewer] #rvm-tree .rvm-navis-branch-on{grid-column:4;}
    [data-rvm-viewer] #rvm-tree .rvm-navis-children{width:100%;min-width:0;margin:2px 0 0 0;padding-left:0;border-left:0;}
    [data-rvm-viewer] #rvm-tree .rvm-tree-node{width:100%;min-width:0;display:grid;grid-template-columns:minmax(34px,max-content) minmax(0,1fr) minmax(20px,max-content);grid-template-rows:auto auto;gap:1px 4px;align-items:center;overflow:hidden;font-size:9px;min-height:20px;}
    [data-rvm-viewer] #rvm-tree .rvm-tree-node>.rvm-kind{grid-column:1;grid-row:1 / span 2;align-self:start;margin-top:2px;font-size:8px;}
    [data-rvm-viewer] #rvm-tree .rvm-tree-node>[data-rvm-tree-label],[data-rvm-viewer] #rvm-tree .rvm-tree-node>.rvm-tree-label{grid-column:2;grid-row:1;font-size:9px;line-height:1.15;}
    [data-rvm-viewer] #rvm-tree .rvm-tree-node>.rvm-tree-count{grid-column:3;grid-row:1;}
    [data-rvm-viewer] #rvm-tree .rvm-tree-path{grid-column:2 / -1;grid-row:2;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#8fa5c7;font-size:8px;line-height:1.1;font-weight:500;}
    [data-rvm-viewer] #rvm-tree .rvm-tree-visibility-toggle{grid-column:2;width:auto;min-width:38px;height:20px;padding:0 5px;border:1px solid rgba(148,163,184,.24);border-radius:5px;background:rgba(15,23,42,.86);color:#bbf7d0;font-size:8px;font-weight:700;cursor:pointer;}
    [data-rvm-viewer] #rvm-tree li.is-hidden-by-row-toggle > .rvm-tree-node{opacity:.48;}
    [data-rvm-viewer] #rvm-tree li.is-hidden-by-row-toggle > .rvm-tree-visibility-toggle{color:#fecaca;}
    [data-rvm-viewer] #rvm-tree .rvm-tree-label,[data-rvm-viewer] #rvm-tree [data-rvm-tree-label]{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
    [data-rvm-viewer] #rvm-tree .rvm-navis-row.is-selected .rvm-navis-select,[data-rvm-viewer] #rvm-tree li.is-selected > .rvm-tree-node{outline:1px solid rgba(96,165,250,.95);border-color:rgba(96,165,250,.95);background:rgba(37,99,235,.30);box-shadow:inset 3px 0 0 rgba(96,165,250,.95);}
    @media (max-width:1100px){[data-rvm-viewer] .rvm-left-panel{width:clamp(280px,36vw,520px);}[data-rvm-viewer] #rvm-tree .rvm-navis-row{grid-template-columns:20px minmax(0,1fr) max-content max-content;gap:3px;}[data-rvm-viewer] #rvm-tree .rvm-navis-select{grid-template-columns:14px minmax(0,1fr) minmax(20px,max-content);gap:4px;padding:1px 4px;}[data-rvm-viewer] #rvm-tree .rvm-navis-select .rvm-kind{display:none;}[data-rvm-viewer] #rvm-tree .rvm-navis-branch-off,[data-rvm-viewer] #rvm-tree .rvm-navis-branch-on{min-width:27px;font-size:8px;}}
  `;
}
