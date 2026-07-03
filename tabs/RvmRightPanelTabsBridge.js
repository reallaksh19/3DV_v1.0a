const VERSION = '20260629-rvm-right-panel-tabs-1';
const GLOBAL_KEY = '__PCF_GLB_RVM_RIGHT_PANEL_TABS__';
const ROOT_SELECTOR = '[data-rvm-viewer]';

const TAB_DEFS = Object.freeze([
  { id: 'properties', label: 'Properties' },
  { id: 'tags', label: 'Tags' },
  { id: 'diagnostics', label: 'Diagnostics' },
  { id: 'exports', label: 'Exports' },
]);

const DIAGNOSTIC_RE = /diagnostic|health|issue|performance|fallback|tessellation|browser|action/i;
const EXPORT_RE = /export|stagedjson|staged|glb|round.?trip|acceptance|policy|validation|report/i;

let observer = null;
let refreshTimer = 0;
let moving = false;

export function installRvmRightPanelTabsBridge() {
  if (typeof document === 'undefined') return null;
  const existing = globalThis[GLOBAL_KEY];
  if (existing?.version === VERSION) return existing;
  injectStyles();
  const api = {
    version: VERSION,
    ensureTab,
    moveToTab,
    activate,
    refresh: (root = document.querySelector(ROOT_SELECTOR), reason = 'api') => refresh(root, reason),
  };
  globalThis[GLOBAL_KEY] = api;
  bindEvents();
  refreshAll('install');
  for (const delay of [80, 250, 750, 1500, 3000]) setTimeout(() => refreshAll(`install-${delay}`), delay);
  return api;
}

function bindEvents() {
  if (observer) return;
  document.addEventListener('click', onTabClick, true);
  for (const eventName of ['rvm-model-loaded', 'rvm-tree-rendered', 'rvm-tag-created', 'rvm-tag-deleted']) {
    globalThis.addEventListener?.(eventName, () => scheduleRefresh(eventName));
  }
  observer = new MutationObserver(() => {
    if (!moving) scheduleRefresh('mutation');
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
}

function onTabClick(event) {
  const button = event.target?.closest?.('[data-rvm-right-panel-tab-button]');
  if (!button) return;
  const root = button.closest?.(ROOT_SELECTOR);
  if (!root) return;
  event.preventDefault();
  activate(root, button.dataset.rvmRightPanelTabButton || 'properties');
}

function scheduleRefresh(reason) {
  clearTimeout(refreshTimer);
  refreshTimer = setTimeout(() => refreshAll(reason), 40);
}

function refreshAll(reason = 'manual') {
  for (const root of document.querySelectorAll?.(ROOT_SELECTOR) || []) refresh(root, reason);
}

function refresh(root = document.querySelector(ROOT_SELECTOR), reason = 'manual') {
  const right = root?.querySelector?.('.rvm-right-panel');
  if (!root || !right) return null;
  ensureShell(root);
  routeDirectChildren(root);
  const active = activeTabId(root);
  activate(root, active, { persist: false });
  root.dataset.rvmRightPanelTabs = VERSION;
  root.dataset.rvmRightPanelTabsRefreshReason = reason;
  return { version: VERSION, reason, active };
}

function ensureShell(root) {
  const right = root?.querySelector?.('.rvm-right-panel');
  if (!right) return null;
  right.classList.add('rvm-right-panel-tabs-ready');
  let tablist = right.querySelector(':scope > [data-rvm-right-panel-tablist]');
  let panels = right.querySelector(':scope > [data-rvm-right-panel-tab-panels]');
  if (!tablist) {
    tablist = document.createElement('div');
    tablist.className = 'rvm-right-panel-tablist';
    tablist.dataset.rvmRightPanelTablist = VERSION;
    tablist.setAttribute('role', 'tablist');
    tablist.setAttribute('aria-label', 'RVM right panel tabs');
  }
  if (!panels) {
    panels = document.createElement('div');
    panels.className = 'rvm-right-panel-tab-panels';
    panels.dataset.rvmRightPanelTabPanels = VERSION;
  }
  if (tablist.parentElement !== right) right.insertBefore(tablist, firstNonResizeChild(right));
  if (panels.parentElement !== right) right.insertBefore(panels, tablist.nextSibling);
  for (const def of TAB_DEFS) ensureTab(root, def.id, def.label);
  orderTabs({ tablist, panels });
  return { tablist, panels };
}

function firstNonResizeChild(right) {
  for (const child of right.children || []) {
    if (!child.classList?.contains('rvm-right-panel-resize-handle')) return child;
  }
  return null;
}

function ensureTab(root, id, label = '') {
  const right = root?.querySelector?.('.rvm-right-panel');
  if (!right) return null;
  const shell = ensureShellShallow(right);
  const tabId = cleanId(id);
  const tabLabel = label || labelFor(tabId);
  let button = shell.tablist.querySelector(`[data-rvm-right-panel-tab-button="${cssEscape(tabId)}"]`);
  if (!button) {
    button = document.createElement('button');
    button.type = 'button';
    button.className = 'rvm-right-panel-tab-button';
    button.dataset.rvmRightPanelTabButton = tabId;
    button.setAttribute('role', 'tab');
    button.setAttribute('aria-controls', panelDomId(tabId));
    button.textContent = tabLabel;
    shell.tablist.appendChild(button);
  }
  let panel = shell.panels.querySelector(`[data-rvm-right-panel-tab="${cssEscape(tabId)}"]`);
  if (!panel) {
    panel = document.createElement('section');
    panel.className = 'rvm-right-panel-tab-panel';
    panel.id = panelDomId(tabId);
    panel.dataset.rvmRightPanelTab = tabId;
    panel.setAttribute('role', 'tabpanel');
    shell.panels.appendChild(panel);
  }
  return panel;
}

function orderTabs(shell) {
  for (const def of TAB_DEFS) {
    const button = shell.tablist.querySelector(`[data-rvm-right-panel-tab-button="${cssEscape(def.id)}"]`);
    const panel = shell.panels.querySelector(`[data-rvm-right-panel-tab="${cssEscape(def.id)}"]`);
    if (button) shell.tablist.appendChild(button);
    if (panel) shell.panels.appendChild(panel);
  }
}

function ensureShellShallow(right) {
  let tablist = right.querySelector(':scope > [data-rvm-right-panel-tablist]');
  let panels = right.querySelector(':scope > [data-rvm-right-panel-tab-panels]');
  if (!tablist) {
    tablist = document.createElement('div');
    tablist.className = 'rvm-right-panel-tablist';
    tablist.dataset.rvmRightPanelTablist = VERSION;
    tablist.setAttribute('role', 'tablist');
    right.insertBefore(tablist, firstNonResizeChild(right));
  }
  if (!panels) {
    panels = document.createElement('div');
    panels.className = 'rvm-right-panel-tab-panels';
    panels.dataset.rvmRightPanelTabPanels = VERSION;
    right.insertBefore(panels, tablist.nextSibling);
  }
  return { tablist, panels };
}

function moveToTab(root, target, tabId = 'properties') {
  const node = typeof target === 'string' ? root?.querySelector?.(target) : target;
  if (!root || !node || !node.parentElement) return null;
  const panel = ensureTab(root, tabId);
  if (!panel || node.parentElement === panel || node.closest?.('[data-rvm-right-panel-tab]') === panel) return node;
  moving = true;
  try {
    panel.appendChild(node);
    node.dataset.rvmRightPanelTabTarget = tabId;
  } finally {
    moving = false;
  }
  return node;
}

function routeDirectChildren(root) {
  const right = root?.querySelector?.('.rvm-right-panel');
  if (!right) return;
  const direct = [...right.children].filter((node) => {
    if (node.matches?.('[data-rvm-right-panel-tablist], [data-rvm-right-panel-tab-panels]')) return false;
    if (node.classList?.contains('rvm-right-panel-resize-handle')) return false;
    return true;
  });
  let pendingHeader = null;
  for (const node of direct) {
    if (node.classList?.contains('rvm-panel-header')) {
      pendingHeader = node;
      continue;
    }
    const tab = classifyNode(node, pendingHeader);
    if (pendingHeader) moveToTab(root, pendingHeader, tab);
    moveToTab(root, node, tab);
    pendingHeader = null;
  }
  if (pendingHeader) moveToTab(root, pendingHeader, classifyNode(pendingHeader, null));
}

function classifyNode(node, header = null) {
  const text = `${node?.id || ''} ${node?.className || ''} ${Object.values(node?.dataset || {}).join(' ')} ${header?.textContent || ''} ${node?.textContent || ''}`;
  if (/tag/i.test(text) && !/staged/i.test(text)) return 'tags';
  if (/attributes|selected entity|selection details|properties/i.test(text)) return 'properties';
  if (DIAGNOSTIC_RE.test(text)) return 'diagnostics';
  if (EXPORT_RE.test(text)) return 'exports';
  return 'properties';
}

function activate(root, id = 'properties', options = {}) {
  const tabId = cleanId(id);
  const right = root?.querySelector?.('.rvm-right-panel');
  if (!right) return null;
  ensureTab(root, tabId);
  const buttons = right.querySelectorAll('[data-rvm-right-panel-tab-button]');
  const panels = right.querySelectorAll('[data-rvm-right-panel-tab]');
  for (const button of buttons) {
    const active = button.dataset.rvmRightPanelTabButton === tabId;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-selected', String(active));
    button.tabIndex = active ? 0 : -1;
  }
  for (const panel of panels) {
    const active = panel.dataset.rvmRightPanelTab === tabId;
    panel.hidden = !active;
    panel.dataset.active = String(active);
  }
  root.dataset.rvmRightPanelActiveTab = tabId;
  if (options.persist !== false) {
    try { localStorage.setItem('rvm_right_panel_active_tab', tabId); } catch (_) {}
  }
  return tabId;
}

function activeTabId(root) {
  const current = cleanId(root?.dataset?.rvmRightPanelActiveTab || '');
  if (current) return current;
  try {
    const saved = cleanId(localStorage.getItem('rvm_right_panel_active_tab') || '');
    if (saved) return saved;
  } catch (_) {}
  return 'properties';
}

function cleanId(value) {
  const id = String(value || '').toLowerCase().replace(/[^a-z0-9_-]+/g, '');
  return id || 'properties';
}

function labelFor(id) {
  return TAB_DEFS.find((def) => def.id === id)?.label || id;
}

function panelDomId(id) {
  return `rvm-right-tab-${id}`;
}

function cssEscape(value) {
  if (globalThis.CSS?.escape) return globalThis.CSS.escape(String(value));
  return String(value).replace(/"/g, '\\"');
}

function injectStyles() {
  if (document.getElementById('rvm-right-panel-tabs-style')) return;
  const style = document.createElement('style');
  style.id = 'rvm-right-panel-tabs-style';
  style.textContent = `
    [data-rvm-viewer] .rvm-right-panel-tabs-ready{display:flex;flex-direction:column;min-width:260px;}
    [data-rvm-viewer] .rvm-right-panel-tablist{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:3px;padding:6px;border-bottom:1px solid rgba(126,190,255,.16);background:rgba(7,13,24,.92);}
    [data-rvm-viewer] .rvm-right-panel-tab-button{min-width:0;height:28px;padding:0 6px;border:1px solid rgba(126,190,255,.20);border-radius:6px;background:rgba(15,23,42,.78);color:#bcd8ff;font:700 10px/1 system-ui,sans-serif;text-transform:uppercase;letter-spacing:.04em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;cursor:pointer;}
    [data-rvm-viewer] .rvm-right-panel-tab-button:hover{border-color:rgba(147,197,253,.48);background:rgba(30,58,138,.24);color:#e8f3ff;}
    [data-rvm-viewer] .rvm-right-panel-tab-button.is-active{border-color:rgba(96,165,250,.72);background:rgba(37,99,235,.34);color:#fff;box-shadow:inset 0 -2px 0 rgba(96,165,250,.85);}
    [data-rvm-viewer] .rvm-right-panel-tab-panels{flex:1;min-height:0;overflow:hidden;display:flex;flex-direction:column;}
    [data-rvm-viewer] .rvm-right-panel-tab-panel{flex:1;min-height:0;overflow:auto;padding:7px;scrollbar-color:rgba(129,177,230,.42) transparent;}
    [data-rvm-viewer] .rvm-right-panel-tab-panel[hidden]{display:none!important;}
    [data-rvm-viewer] .rvm-right-panel-tab-panel>.rvm-panel-header:first-child{margin-top:0;}
    [data-rvm-viewer] .rvm-right-panel-tab-panel .rvm-panel-header{border:1px solid rgba(148,163,184,.12);border-radius:7px 7px 0 0;margin:7px 0 0;padding:6px 7px;background:rgba(15,23,42,.72);}
    [data-rvm-viewer] .rvm-right-panel-tab-panel .rvm-attributes-panel,
    [data-rvm-viewer] .rvm-right-panel-tab-panel .rvm-tag-list{min-height:0;overflow:visible;}
  `;
  document.head.appendChild(style);
}
