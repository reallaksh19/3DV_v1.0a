const INSTALL_FLAG = Symbol.for('pcf-glb-rvm-left-panel-resize-collapse-v3');
const STYLE_ID = 'rvm-left-panel-resize-collapse-style';
const VERSION = '20260628-rvm-adaptive-hierarchy-columns-1';

const PANEL_SELECTORS = [
  '[data-rvm-support-att-panel]',
  '[data-rvm-support-engine-panel]',
];

const PANEL_WIDTH_KEYS = Object.freeze({
  left: 'rvm.panel.leftWidth',
  right: 'rvm.panel.rightWidth',
});

const RETIRED_HIERARCHY_WIDTH_VARIABLES = [
  '--rvm-hierarchy-w',
  '--rvm-tree-kind-w',
  '--rvm-tree-count-w',
  '--rvm-tree-action-w',
];

export function installRvmLeftPanelResizeCollapseBridge() {
  if (typeof document === 'undefined') return null;
  if (globalThis[INSTALL_FLAG]) return globalThis[INSTALL_FLAG];
  injectStyles();
  const state = { version: VERSION, runs: 0, scan };
  globalThis[INSTALL_FLAG] = state;
  scan();
  const observer = new MutationObserver(() => scan());
  observer.observe(document.documentElement, { childList: true, subtree: true });
  state.observer = observer;
  return state;
}

function scan() {
  const root = document.querySelector('[data-rvm-viewer]');
  const left = root?.querySelector?.('.rvm-left-panel');
  if (!root || !left) return;
  left.dataset.rvmLeftPanelResizable = 'true';
  enhanceMainPanelResizers(root);
  const tree = left.querySelector('#rvm-tree');
  if (tree) {
    tree.dataset.rvmResizablePanel = 'hierarchy-adaptive';
    tree.dataset.rvmHierarchyAdaptiveColumns = VERSION;
    removeHierarchyWidthControls(left, tree);
    applyAdaptiveHierarchyLayout(tree);
  }
  movePanelsToLeft(root, left);
  for (const selector of PANEL_SELECTORS) {
    root.querySelectorAll(selector).forEach((panel) => enhancePanel(panel));
  }
}

function enhanceMainPanelResizers(root) {
  const body = root?.querySelector?.('.rvm-body');
  const left = root?.querySelector?.('.rvm-left-panel');
  const right = root?.querySelector?.('.rvm-right-panel');
  if (!root || !body || !left || !right) return;
  left.dataset.rvmLeftPanelResizable = 'true';
  right.dataset.rvmRightPanelResizable = 'true';
  applyStoredPanelWidth(root, 'left');
  applyStoredPanelWidth(root, 'right');
  ensurePanelResizer(root, left, 'left');
  ensurePanelResizer(root, right, 'right');
}

function ensurePanelResizer(root, panel, side) {
  if (!panel || panel.querySelector(`[data-rvm-panel-resizer="${side}"]`)) return;
  const handle = document.createElement('div');
  handle.className = `rvm-panel-resizer rvm-panel-resizer-${side}`;
  handle.dataset.rvmPanelResizer = side;
  handle.setAttribute('role', 'separator');
  handle.setAttribute('aria-orientation', 'vertical');
  handle.setAttribute('aria-label', side === 'left' ? 'Resize hierarchy panel' : 'Resize properties panel');
  panel.appendChild(handle);
  let drag = null;
  handle.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    const body = root.querySelector('.rvm-body');
    const rect = body?.getBoundingClientRect?.();
    if (!rect?.width) return;
    drag = { pointerId: event.pointerId, side, rect };
    handle.classList.add('is-dragging');
    handle.setPointerCapture?.(event.pointerId);
    document.body.style.cursor = 'col-resize';
    event.preventDefault();
  });
  handle.addEventListener('pointermove', (event) => {
    if (!drag || drag.pointerId !== event.pointerId) return;
    const width = panelWidthFromPointer(drag.side, drag.rect, event.clientX);
    setPanelWidth(root, drag.side, `${width}px`);
  });
  handle.addEventListener('pointerup', (event) => {
    if (!drag || drag.pointerId !== event.pointerId) return;
    drag = null;
    handle.classList.remove('is-dragging');
    document.body.style.cursor = '';
  });
  handle.addEventListener('pointercancel', () => {
    drag = null;
    handle.classList.remove('is-dragging');
    document.body.style.cursor = '';
  });
}

function panelWidthFromPointer(side, rect, clientX) {
  const raw = side === 'left' ? clientX - rect.left : rect.right - clientX;
  const min = side === 'left' ? 220 : 210;
  const max = side === 'left' ? 620 : 760;
  return Math.max(min, Math.min(max, Math.round(raw)));
}

function applyStoredPanelWidth(root, side) {
  const key = PANEL_WIDTH_KEYS[side];
  if (!key) return;
  const value = readCssSize(key, side === 'left' ? '320px' : '300px');
  setPanelWidth(root, side, value);
}

function setPanelWidth(root, side, value) {
  const variable = side === 'left' ? '--rvm-left-w' : '--rvm-right-w';
  const contractVariable = side === 'left' ? '--rvm-left-panel-width' : '--rvm-right-panel-width';
  const body = root?.querySelector?.('.rvm-body');
  root?.style?.setProperty(variable, value);
  root?.style?.setProperty(contractVariable, value);
  body?.style?.setProperty(variable, value);
  body?.style?.setProperty(contractVariable, value);
  try { localStorage.setItem(PANEL_WIDTH_KEYS[side], value); } catch (_) {}
  try { window.dispatchEvent(new Event('resize')); } catch (_) {}
  try { globalThis.__3D_RVM_VIEWER__?.onWindowResize?.(); } catch (_) {}
  try { globalThis.__3D_RVM_VIEWER__?.resize?.(); } catch (_) {}
}

function movePanelsToLeft(root, left) {
  for (const selector of PANEL_SELECTORS) {
    const panel = root.querySelector(selector);
    if (panel && panel.parentElement !== left) left.appendChild(panel);
  }
}

function removeHierarchyWidthControls(left, tree) {
  left?.querySelectorAll?.('[data-rvm-hierarchy-width-controls], .rvm-hierarchy-width-controls').forEach((controls) => controls.remove());
  tree?.querySelectorAll?.('[data-rvm-hierarchy-width-controls], .rvm-hierarchy-width-controls').forEach((controls) => controls.remove());
}

function applyAdaptiveHierarchyLayout(tree) {
  if (!tree) return;
  for (const variable of RETIRED_HIERARCHY_WIDTH_VARIABLES) tree.style.removeProperty(variable);
}

function readCssSize(key, fallback) {
  try {
    const raw = String(localStorage.getItem(key) || '').trim();
    if (/^\d+(?:\.\d+)?px$/.test(raw)) return raw;
  } catch (_) {}
  return fallback;
}

function enhancePanel(panel) {
  if (!panel || panel.dataset.rvmResizeCollapseEnhanced === VERSION) return;
  panel.dataset.rvmResizeCollapseEnhanced = VERSION;
  panel.classList.add('rvm-left-collapsible-panel');
  const title = panel.querySelector('h3') || firstHeading(panel);
  if (!title) return;
  title.classList.add('rvm-left-collapsible-title');
  if (!title.querySelector('[data-rvm-left-panel-collapse]')) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'rvm-left-panel-collapse-btn';
    button.dataset.rvmLeftPanelCollapse = 'true';
    button.setAttribute('aria-label', `Toggle ${title.textContent || 'panel'}`);
    button.textContent = '▸';
    title.insertBefore(button, title.firstChild);
    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      setCollapsed(panel, panel.dataset.rvmCollapsed !== 'true');
    });
  }
  setCollapsed(panel, true);
}

function firstHeading(panel) {
  for (const child of [...panel.children]) {
    if (/^H[1-6]$/i.test(child.tagName)) return child;
  }
  return null;
}

function setCollapsed(panel, collapsed) {
  panel.dataset.rvmCollapsed = collapsed ? 'true' : 'false';
  panel.classList.toggle('is-collapsed', collapsed);
  const btn = panel.querySelector('[data-rvm-left-panel-collapse]');
  if (btn) btn.textContent = collapsed ? '▸' : '▾';
}

function injectStyles() {
  let style = document.getElementById(STYLE_ID);
  if (!style) {
    style = document.createElement('style');
    style.id = STYLE_ID;
    document.head.appendChild(style);
  }
  if (style.dataset.rvmLeftPanelResizeCollapse === VERSION) return;
  style.dataset.rvmLeftPanelResizeCollapse = VERSION;
  style.textContent = `
    .rvm-tab-root{--rvm-left-panel-width:var(--rvm-left-w,320px);--rvm-right-panel-width:var(--rvm-right-w,300px);}
    .rvm-body{min-width:0;}
    .rvm-left-panel[data-rvm-left-panel-resizable="true"]{position:relative;overflow:auto;gap:6px;padding-bottom:8px;width:var(--rvm-left-panel-width,var(--rvm-left-w,320px))!important;min-width:220px;max-width:min(620px,calc(100% - 420px));flex:0 0 var(--rvm-left-panel-width,var(--rvm-left-w,320px))!important;}
    .rvm-right-panel[data-rvm-right-panel-resizable="true"]{position:relative;width:var(--rvm-right-panel-width,var(--rvm-right-w,300px))!important;min-width:210px;max-width:min(760px,calc(100% - 420px));flex:0 0 var(--rvm-right-panel-width,var(--rvm-right-w,300px))!important;}
    .rvm-viewport{min-width:240px;}
    .rvm-hierarchy-width-controls{display:none!important;}
    .rvm-left-panel[data-rvm-left-panel-resizable="true"] #rvm-tree[data-rvm-resizable-panel="hierarchy-adaptive"]{flex:1 1 auto;min-width:0;width:100%!important;max-width:100%;min-height:120px;height:clamp(180px,42vh,520px);max-height:70vh;resize:vertical;overflow:auto;border-bottom:1px solid rgba(126,190,255,.22);}
    .rvm-left-panel[data-rvm-left-panel-resizable="true"] #rvm-tree .rvm-navis-row{grid-template-columns:20px minmax(0,1fr) max-content max-content;}
    .rvm-left-panel[data-rvm-left-panel-resizable="true"] #rvm-tree .rvm-navis-select{grid-template-columns:16px minmax(38px,max-content) minmax(0,1fr) minmax(24px,max-content);}
    .rvm-left-panel[data-rvm-left-panel-resizable="true"] #rvm-tree .rvm-kind{min-width:0;max-width:clamp(36px,18%,90px);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
    .rvm-left-panel[data-rvm-left-panel-resizable="true"] #rvm-tree .rvm-navis-label,.rvm-left-panel[data-rvm-left-panel-resizable="true"] #rvm-tree .rvm-tree-label{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
    .rvm-left-panel[data-rvm-left-panel-resizable="true"] #rvm-tree .rvm-tree-count{min-width:18px;max-width:52px;justify-self:end;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
    .rvm-left-panel[data-rvm-left-panel-resizable="true"] #rvm-tree .rvm-navis-branch-off,.rvm-left-panel[data-rvm-left-panel-resizable="true"] #rvm-tree .rvm-navis-branch-on{width:auto;min-width:30px;max-width:42px;padding:0 4px;}
    @media (max-width:1100px){.rvm-left-panel[data-rvm-left-panel-resizable="true"] #rvm-tree .rvm-navis-select{grid-template-columns:16px minmax(0,1fr) minmax(22px,max-content);}.rvm-left-panel[data-rvm-left-panel-resizable="true"] #rvm-tree .rvm-kind{display:none;}}
    .rvm-left-collapsible-panel{flex:0 0 auto;min-height:34px;max-height:60vh;resize:vertical;overflow:auto;margin:6px 6px 0;border:1px solid rgba(96,165,250,.28);border-radius:10px;background:rgba(15,23,42,.70);}
    .rvm-left-collapsible-panel.is-collapsed{height:auto!important;min-height:32px;max-height:36px;resize:none;overflow:hidden;}
    .rvm-left-collapsible-panel.is-collapsed > :not(.rvm-left-collapsible-title):not(h3){display:none!important;}
    .rvm-left-collapsible-title{display:flex!important;align-items:center;gap:6px;margin:0!important;padding:8px 9px!important;cursor:default;}
    .rvm-left-panel-collapse-btn{width:20px;height:20px;display:inline-grid;place-items:center;border:1px solid rgba(126,190,255,.35);border-radius:5px;background:#101a2b;color:#dbeafe;cursor:pointer;font-size:11px;padding:0;}
    .rvm-left-panel-collapse-btn:hover{background:#1d3150;border-color:#60a5fa;}
    .rvm-panel-resizer{position:absolute;top:0;bottom:0;width:8px;z-index:35;cursor:col-resize;background:linear-gradient(90deg,transparent,rgba(78,140,214,.24),transparent);opacity:.42;touch-action:none;}
    .rvm-panel-resizer:hover,.rvm-panel-resizer.is-dragging{opacity:1;background:rgba(74,158,255,.34);}
    .rvm-panel-resizer-left{right:-4px;}
    .rvm-panel-resizer-right{left:-4px;}
  `;
}
