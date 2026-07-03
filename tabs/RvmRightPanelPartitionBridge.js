const VERSION = '20260630-rvm-right-panel-partition-1';
const GLOBAL_KEY = '__PCF_GLB_RVM_RIGHT_PANEL_PARTITION__';
const ROOT_SELECTOR = '[data-rvm-viewer]';
let observer = null;
let timer = 0;
let moving = false;

const ROUTES = Object.freeze([
  { tab: 'tags', selectors: ['#rvm-tags-panel', '[data-rvm-tags-panel]', '.rvm-tags-panel', '[data-rvm-tag-draft-form]'] },
  { tab: 'diagnostics', selectors: ['#rvm-browser-parse-diagnostics', '#rvm-native-diagnostics-panel', '[data-rvm-diagnostics-panel]', '[data-rvm-native-diagnostics]', '[data-rvm-browser-diagnostics]', '[data-rvm-provider-debug-panel]', '.rvm-diagnostics-panel'] },
  { tab: 'properties', selectors: ['#rvm-attributes-panel', '[data-rvm-selection-details-ui]', '[data-rvm-selection-kpis]', '.rvm-selection-details-card', '.rvm-canvas-selection-card'] },
  { tab: 'exports', selectors: ['[data-rvm-stagedjson-kpis]', '[data-rvm-export-panel]', '[data-rvm-validation-panel]', '.rvm-stagedjson-card', '.rvm-export-panel'] },
]);

export function installRvmRightPanelPartitionBridge() {
  if (typeof document === 'undefined') return null;
  const existing = globalThis[GLOBAL_KEY];
  if (existing?.version === VERSION) return existing;
  injectStyles();
  const api = { version: VERSION, refresh: (reason = 'api') => refreshAll(reason) };
  globalThis[GLOBAL_KEY] = api;
  for (const name of ['rvm-model-loaded', 'rvm-tag-created', 'rvm-tag-deleted', 'rvm-selection-synced-to-tree']) {
    globalThis.addEventListener?.(name, () => scheduleRefresh(name));
    document.addEventListener(name, () => scheduleRefresh(name), true);
  }
  observer = new MutationObserver(() => { if (!moving) scheduleRefresh('mutation'); });
  observer.observe(document.documentElement, { childList: true, subtree: true });
  for (const delay of [0, 100, 350, 900, 1800, 3200]) setTimeout(() => refreshAll(`install-${delay}`), delay);
  return api;
}

function scheduleRefresh(reason) {
  clearTimeout(timer);
  timer = setTimeout(() => refreshAll(reason), 45);
}

function refreshAll(reason = 'manual') {
  let moved = 0;
  for (const root of document.querySelectorAll?.(ROOT_SELECTOR) || []) moved += partitionRoot(root, reason);
  return { version: VERSION, moved, reason };
}

function partitionRoot(root, reason = 'manual') {
  const right = root?.querySelector?.('.rvm-right-panel');
  const tabApi = globalThis.__PCF_GLB_RVM_RIGHT_PANEL_TABS__;
  if (!root || !right || !tabApi?.ensureTab) return 0;
  let movedCount = 0;
  moving = true;
  try {
    for (const route of ROUTES) {
      const panel = tabApi.ensureTab(root, route.tab, labelForTab(route.tab));
      if (!panel) continue;
      for (const selector of route.selectors) {
        for (const node of [...right.querySelectorAll(selector)]) {
          if (!node || node.closest('[data-rvm-right-panel-tab]') === panel) continue;
          if (node.closest('[data-rvm-right-panel-tablist]')) continue;
          const header = associatedHeader(node);
          if (header && header.closest('[data-rvm-right-panel-tab]') !== panel) moveNode(panel, header, route.tab);
          moveNode(panel, node, route.tab);
          movedCount += 1;
        }
      }
    }
    sanitizeTab(root, 'tags', isTagNode);
    sanitizeTab(root, 'diagnostics', isDiagnosticNode);
  } finally {
    moving = false;
  }
  root.dataset.rvmRightPanelPartition = VERSION;
  root.dataset.rvmRightPanelPartitionReason = reason;
  root.dataset.rvmRightPanelPartitionMoved = String(movedCount);
  tabApi.refresh?.(root, `partition-${reason}`);
  return movedCount;
}

function sanitizeTab(root, tabId, allowedPredicate) {
  const panel = root.querySelector(`[data-rvm-right-panel-tab="${cssEscape(tabId)}"]`);
  if (!panel) return;
  for (const child of [...panel.children]) {
    if (child.matches?.('[data-rvm-right-panel-tablist], [data-rvm-right-panel-tab-panels]')) continue;
    if (allowedPredicate(child)) continue;
    const tab = classifyKnownNode(child);
    if (tab && tab !== tabId) globalThis.__PCF_GLB_RVM_RIGHT_PANEL_TABS__?.moveToTab?.(root, child, tab);
  }
}

function moveNode(panel, node, tab) {
  if (!panel || !node || node.parentElement === panel) return;
  panel.appendChild(node);
  node.dataset.rvmRightPanelPartitionTab = tab;
  node.dataset.rvmRightPanelPartition = VERSION;
}

function associatedHeader(node) {
  const prev = node?.previousElementSibling;
  if (prev?.classList?.contains('rvm-panel-header')) return prev;
  return null;
}

function classifyKnownNode(node) {
  if (isTagNode(node)) return 'tags';
  if (isDiagnosticNode(node)) return 'diagnostics';
  if (node.matches?.('#rvm-attributes-panel, [data-rvm-selection-details-ui], .rvm-selection-details-card, .rvm-canvas-selection-card')) return 'properties';
  if (node.matches?.('[data-rvm-stagedjson-kpis], [data-rvm-export-panel], [data-rvm-validation-panel], .rvm-stagedjson-card, .rvm-export-panel')) return 'exports';
  return '';
}

function isTagNode(node) {
  return Boolean(node?.matches?.('#rvm-tags-panel, [data-rvm-tags-panel], .rvm-tags-panel, [data-rvm-tag-draft-form]') || node?.querySelector?.('#rvm-tags-panel, [data-rvm-tags-panel], .rvm-tags-panel, [data-rvm-tag-draft-form]'));
}

function isDiagnosticNode(node) {
  return Boolean(node?.matches?.('#rvm-browser-parse-diagnostics, #rvm-native-diagnostics-panel, [data-rvm-diagnostics-panel], [data-rvm-native-diagnostics], [data-rvm-browser-diagnostics], [data-rvm-provider-debug-panel], .rvm-diagnostics-panel') || node?.querySelector?.('#rvm-browser-parse-diagnostics, #rvm-native-diagnostics-panel, [data-rvm-diagnostics-panel], [data-rvm-native-diagnostics], [data-rvm-browser-diagnostics], [data-rvm-provider-debug-panel], .rvm-diagnostics-panel'));
}

function labelForTab(tab) {
  return tab === 'tags' ? 'Tags' : tab === 'diagnostics' ? 'Diagnostics' : tab === 'exports' ? 'Exports' : 'Properties';
}

function cssEscape(value) {
  return globalThis.CSS?.escape ? globalThis.CSS.escape(String(value)) : String(value).replace(/"/g, '\\"');
}

function injectStyles() {
  if (document.getElementById('rvm-right-panel-partition-style')) return;
  const style = document.createElement('style');
  style.id = 'rvm-right-panel-partition-style';
  style.textContent = `
    [data-rvm-viewer] [data-rvm-right-panel-partition-tab="tags"]{--rvm-panel-accent:#38bdf8;}
    [data-rvm-viewer] [data-rvm-right-panel-partition-tab="diagnostics"]{--rvm-panel-accent:#f59e0b;}
    [data-rvm-viewer] [data-rvm-right-panel-tab="tags"] #rvm-browser-parse-diagnostics,
    [data-rvm-viewer] [data-rvm-right-panel-tab="diagnostics"] #rvm-tags-panel{display:none!important;}
  `;
  document.head.appendChild(style);
}
