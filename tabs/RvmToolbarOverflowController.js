const VERSION = '20260627-rvm-toolbar-overflow-controller-grouped-restore-1';
const PREVIOUS_VERSION = '20260626-rvm-toolbar-overflow-controller-4';
const CONTROLLER_KEY = '__PCF_GLB_RVM_TOOLBAR_OVERFLOW__';
const MENU_PREFIX = 'rvm-tools-menu';
const TRACE_LIMIT = 30;

export const RVM_TOOLBAR_OVERFLOW_SELECTORS = Object.freeze({
  root: '[data-rvm-viewer]',
  overflowRoot: '[data-rvm-toolbar-more-root]',
  button: '[data-rvm-toolbar-more]',
  menu: '[data-rvm-tools-menu]',
  legacyMenu: '[data-rvm-toolbar-more-panel]',
  menuItem: '[data-rvm-tools-menu-item], .rvm-ribbon-section',
});

const states = new WeakMap();
const installedRoots = new Set();
let nextMenuId = 1;
let nextTraceSeq = 1;

export function installRvmToolbarOverflow(root, options = {}) {
  const resolvedRoot = resolveRoot(root);
  if (!resolvedRoot || typeof document === 'undefined') return null;
  const existing = states.get(resolvedRoot);
  if (existing) {
    existing.installCount += 1;
    recordTrace(existing, 'repeat-install', { reason: options.reason || 'repeat-install' });
    return syncRvmToolbarOverflow(resolvedRoot, { ...options, reason: options.reason || 'repeat-install' });
  }

  const state = {
    version: VERSION,
    previousVersion: PREVIOUS_VERSION,
    root: resolvedRoot,
    open: false,
    openMenuId: '',
    installCount: 1,
    clickCount: 0,
    closeCount: 0,
    syncCount: 0,
    positionedCount: 0,
    traces: [],
    lastReason: options.reason || 'install',
    onClick: null,
    onKeyDown: null,
    onPointerDown: null,
  };

  state.onClick = (event) => {
    const button = closest(event?.target, RVM_TOOLBAR_OVERFLOW_SELECTORS.button);
    if (!button || !contains(resolvedRoot, button)) return;
    const entry = getEntryForButton(resolvedRoot, button);
    if (!entry) return;
    event.preventDefault?.();
    event.stopPropagation?.();
    event.stopImmediatePropagation?.();
    state.clickCount += 1;
    const nextOpen = state.openMenuId !== entry.id || !state.open;
    recordTrace(state, 'button-click', { menuId: entry.id, nextOpen });
    setRvmToolbarOverflowOpen(resolvedRoot, nextOpen, 'button-click', entry.id);
  };

  state.onKeyDown = (event) => {
    if (event?.key !== 'Escape' || !state.open) return;
    event.preventDefault?.();
    event.stopPropagation?.();
    event.stopImmediatePropagation?.();
    const active = getEntryById(resolvedRoot, state.openMenuId);
    recordTrace(state, 'escape-close', { key: event.key, menuId: state.openMenuId });
    setRvmToolbarOverflowOpen(resolvedRoot, false, 'escape', state.openMenuId);
    active?.button?.focus?.();
  };

  state.onPointerDown = (event) => {
    if (!state.open) return;
    const active = getEntryById(resolvedRoot, state.openMenuId);
    const target = event?.target;
    if ((active?.button && contains(active.button, target)) || (active?.menu && contains(active.menu, target))) return;
    recordTrace(state, 'outside-close', { targetTag: String(target?.tagName || ''), menuId: state.openMenuId });
    setRvmToolbarOverflowOpen(resolvedRoot, false, 'outside-pointerdown', state.openMenuId);
  };

  resolvedRoot.addEventListener?.('click', state.onClick, true);
  document.addEventListener?.('keydown', state.onKeyDown, true);
  document.addEventListener?.('pointerdown', state.onPointerDown, true);
  states.set(resolvedRoot, state);
  installedRoots.add(resolvedRoot);
  resolvedRoot.dataset.rvmToolbarOverflowController = VERSION;
  resolvedRoot.dataset.rvmToolbarOverflowPreviousController = PREVIOUS_VERSION;
  recordTrace(state, 'install', { reason: options.reason || 'install' });
  publishApi();
  return syncRvmToolbarOverflow(resolvedRoot, { ...options, reason: options.reason || 'install' });
}

export function disposeRvmToolbarOverflow(root) {
  const resolvedRoot = resolveRoot(root);
  const state = resolvedRoot ? states.get(resolvedRoot) : null;
  if (!resolvedRoot || !state) return false;
  recordTrace(state, 'dispose', { reason: 'dispose' });
  resolvedRoot.removeEventListener?.('click', state.onClick, true);
  document.removeEventListener?.('keydown', state.onKeyDown, true);
  document.removeEventListener?.('pointerdown', state.onPointerDown, true);
  for (const entry of getMenuEntries(resolvedRoot)) resetMenuPosition(entry.menu);
  states.delete(resolvedRoot);
  installedRoots.delete(resolvedRoot);
  delete resolvedRoot.dataset.rvmToolbarOverflowController;
  delete resolvedRoot.dataset.rvmToolbarOverflowPreviousController;
  return true;
}

export function syncRvmToolbarOverflow(root, options = {}) {
  const resolvedRoot = resolveRoot(root);
  if (!resolvedRoot) return null;
  const state = states.get(resolvedRoot) || null;
  const entries = getMenuEntries(resolvedRoot);
  if (!entries.length) return null;
  const currentOpenId = state?.openMenuId || entries.find((entry) => entry.button?.getAttribute?.('aria-expanded') === 'true' && !entry.menu?.hidden)?.id || '';
  const activeOpen = Boolean(state ? state.open && currentOpenId : currentOpenId);

  for (const entry of entries) {
    const open = activeOpen && entry.id === currentOpenId;
    if (!entry.menu.id) entry.menu.id = options.menuId || `${MENU_PREFIX}-${entry.id}-${nextMenuId++}`;
    entry.button.setAttribute?.('aria-haspopup', 'menu');
    entry.button.setAttribute?.('aria-controls', entry.menu.id);
    entry.button.setAttribute?.('aria-expanded', String(open));
    if (String(entry.button.tagName || '').toLowerCase() === 'button' && !entry.button.getAttribute?.('type')) entry.button.setAttribute?.('type', 'button');
    entry.menu.hidden = !open;
    entry.menu.setAttribute?.('aria-hidden', String(!open));
    entry.menu.setAttribute?.('role', 'menu');
    entry.rootNode?.classList?.toggle?.('is-open', open);
    entry.rootNode?.classList?.toggle?.('is-closed', !open);
    if (entry.rootNode?.dataset) entry.rootNode.dataset.rvmToolbarOverflowOpen = String(open);
    updateButtonCaret(entry.button, open);
    if (open) {
      positionMenu(entry);
      if (state) state.positionedCount += 1;
    } else {
      resetMenuPosition(entry.menu);
    }
  }

  resolvedRoot.dataset.rvmToolbarOverflowOpen = String(activeOpen);
  resolvedRoot.dataset.rvmToolbarOverflowOpenMenu = activeOpen ? currentOpenId : '';
  resolvedRoot.dataset.rvmToolbarOverflowAudit = validateRvmToolbarOverflowDom(resolvedRoot).ok ? 'ok' : 'invalid';
  if (state) {
    state.open = activeOpen;
    state.openMenuId = activeOpen ? currentOpenId : '';
    state.syncCount += 1;
    state.lastReason = options.reason || state.lastReason || 'sync';
    recordTrace(state, 'sync', { reason: options.reason || 'sync', open: activeOpen, menuId: state.openMenuId });
    state.diagnostics = buildDiagnostics(resolvedRoot, state, activeOpen, options.reason || 'sync');
    return state.diagnostics;
  }
  return buildDiagnostics(resolvedRoot, null, activeOpen, options.reason || 'sync');
}

export function setRvmToolbarOverflowOpen(root, open, reason = 'api', menuId = '') {
  const resolvedRoot = resolveRoot(root);
  const state = resolvedRoot ? states.get(resolvedRoot) : null;
  if (!resolvedRoot || !state) return null;
  const entries = getMenuEntries(resolvedRoot);
  const targetId = menuId || state.openMenuId || entries[0]?.id || '';
  const nextOpen = Boolean(open && targetId);
  if (state.open !== nextOpen && !nextOpen) state.closeCount += 1;
  state.open = nextOpen;
  state.openMenuId = nextOpen ? targetId : '';
  state.lastReason = reason;
  recordTrace(state, 'set-open', { reason, open: nextOpen, menuId: state.openMenuId });
  return syncRvmToolbarOverflow(resolvedRoot, { reason });
}

export function getRvmToolbarOverflowDiagnostics(root) {
  const resolvedRoot = resolveRoot(root);
  const state = resolvedRoot ? states.get(resolvedRoot) : null;
  if (!resolvedRoot) return null;
  return state?.diagnostics || syncRvmToolbarOverflow(resolvedRoot, { reason: 'diagnostics' });
}

export function validateRvmToolbarOverflowDom(root) {
  const resolvedRoot = resolveRoot(root);
  const buttonCount = resolvedRoot?.querySelectorAll?.(RVM_TOOLBAR_OVERFLOW_SELECTORS.button)?.length || 0;
  const menuCount = resolvedRoot?.querySelectorAll?.(RVM_TOOLBAR_OVERFLOW_SELECTORS.menu)?.length || 0;
  const overflowRootCount = resolvedRoot?.querySelectorAll?.(RVM_TOOLBAR_OVERFLOW_SELECTORS.overflowRoot)?.length || 0;
  const legacyPanelCount = resolvedRoot?.querySelectorAll?.(RVM_TOOLBAR_OVERFLOW_SELECTORS.legacyMenu)?.length || 0;
  return {
    version: VERSION,
    previousVersion: PREVIOUS_VERSION,
    ok: buttonCount >= 1 && buttonCount === menuCount && overflowRootCount === buttonCount,
    buttonCount,
    menuCount,
    overflowRootCount,
    legacyPanelCount,
    groupedMenus: true,
    fixedPositionedMenus: true,
  };
}

function publishApi() {
  globalThis[CONTROLLER_KEY] = {
    version: VERSION,
    previousVersion: PREVIOUS_VERSION,
    selectors: RVM_TOOLBAR_OVERFLOW_SELECTORS,
    install: installRvmToolbarOverflow,
    dispose: disposeRvmToolbarOverflow,
    sync: syncRvmToolbarOverflow,
    setOpen: setRvmToolbarOverflowOpen,
    validateDom: validateRvmToolbarOverflowDom,
    getDiagnostics: getRvmToolbarOverflowDiagnostics,
    getInstalledRootCount: () => installedRoots.size,
  };
}

function buildDiagnostics(root, state, open, reason) {
  const entries = getMenuEntries(root);
  const active = getEntryById(root, state?.openMenuId || '') || entries.find((entry) => entry.button?.getAttribute?.('aria-expanded') === 'true') || null;
  return {
    version: VERSION,
    previousVersion: PREVIOUS_VERSION,
    reason,
    open,
    openMenuId: active?.id || '',
    installed: Boolean(state),
    installCount: state?.installCount || 0,
    clickCount: state?.clickCount || 0,
    closeCount: state?.closeCount || 0,
    syncCount: state?.syncCount || 0,
    positionedCount: state?.positionedCount || 0,
    hasButton: entries.length > 0,
    hasMenu: entries.length > 0,
    buttonExpanded: active?.button?.getAttribute?.('aria-expanded') || '',
    menuHidden: Boolean(active?.menu?.hidden),
    menuCount: entries.length,
    menuIds: entries.map((entry) => entry.id),
    menuItemCount: entries.reduce((sum, entry) => sum + (entry.menu?.querySelectorAll?.(RVM_TOOLBAR_OVERFLOW_SELECTORS.menuItem)?.length || 0), 0),
    domAudit: validateRvmToolbarOverflowDom(root),
    trace: [...(state?.traces || [])],
  };
}

function positionMenu(entry) {
  const menu = entry?.menu;
  const button = entry?.button;
  if (!menu || !button || typeof button.getBoundingClientRect !== 'function') return false;
  const rect = button.getBoundingClientRect();
  const viewportWidth = Math.max(document.documentElement?.clientWidth || 0, globalThis.innerWidth || 0, 320);
  const viewportHeight = Math.max(document.documentElement?.clientHeight || 0, globalThis.innerHeight || 0, 240);
  const maxWidth = Math.min(360, Math.max(220, viewportWidth - 20));
  const left = clamp(rect.left, 8, Math.max(8, viewportWidth - maxWidth - 8));
  const top = clamp(rect.bottom + 6, 8, Math.max(8, viewportHeight - 120));
  menu.style.position = 'fixed';
  menu.style.left = `${Math.round(left)}px`;
  menu.style.top = `${Math.round(top)}px`;
  menu.style.right = 'auto';
  menu.style.bottom = 'auto';
  menu.style.zIndex = '9999';
  menu.style.maxWidth = `${Math.round(maxWidth)}px`;
  menu.style.maxHeight = `${Math.max(160, Math.round(viewportHeight - top - 12))}px`;
  menu.dataset.rvmToolbarMenuPositioned = 'fixed';
  return true;
}

function resetMenuPosition(menu) {
  if (!menu?.style) return;
  for (const prop of ['position', 'left', 'top', 'right', 'bottom', 'zIndex', 'maxWidth', 'maxHeight']) menu.style[prop] = '';
  delete menu.dataset.rvmToolbarMenuPositioned;
}

function updateButtonCaret(button, open) {
  const caret = button?.querySelector?.('.rvm-toolbar-caret');
  if (caret) caret.textContent = open ? '\u25B2' : '\u25BC';
  if (button?.dataset) button.dataset.rvmToolbarMenuOpen = String(open);
}

function recordTrace(state, event, detail = {}) {
  const entry = { seq: nextTraceSeq++, event, reason: detail.reason || state?.lastReason || '', open: Boolean(state?.open), menuId: state?.openMenuId || detail.menuId || '', detail };
  state.traces.push(entry);
  if (state.traces.length > TRACE_LIMIT) state.traces.splice(0, state.traces.length - TRACE_LIMIT);
  return entry;
}

function getMenuEntries(root) {
  const roots = [...(root?.querySelectorAll?.(RVM_TOOLBAR_OVERFLOW_SELECTORS.overflowRoot) || [])];
  return roots.map((rootNode, index) => {
    const button = rootNode.querySelector?.(RVM_TOOLBAR_OVERFLOW_SELECTORS.button) || null;
    const menu = rootNode.querySelector?.(RVM_TOOLBAR_OVERFLOW_SELECTORS.menu) || rootNode.querySelector?.(RVM_TOOLBAR_OVERFLOW_SELECTORS.legacyMenu) || null;
    const id = rootNode.dataset?.rvmToolbarMoreGroup || button?.dataset?.rvmToolbarMoreGroup || menu?.dataset?.rvmToolsMenuGroup || String(index + 1);
    return { id, rootNode, button, menu };
  }).filter((entry) => entry.button && entry.menu);
}

function getEntryById(root, id) { return getMenuEntries(root).find((entry) => entry.id === id) || null; }
function getEntryForButton(root, button) { return getMenuEntries(root).find((entry) => entry.button === button || contains(entry.button, button)) || null; }
function resolveRoot(root) { if (root && typeof root.querySelector === 'function') return root; if (typeof document !== 'undefined') return document.querySelector?.(RVM_TOOLBAR_OVERFLOW_SELECTORS.root) || null; return null; }
function closest(target, selector) { return target?.closest?.(selector) || null; }
function contains(parent, child) { if (!parent || !child) return false; if (parent === child) return true; if (typeof parent.contains === 'function') return parent.contains(child); let cursor = child; while (cursor) { if (cursor === parent) return true; cursor = cursor.parentElement || cursor.parentNode || null; } return false; }
function clamp(value, min, max) { return Math.min(Math.max(Number.isFinite(value) ? value : min, min), max); }
