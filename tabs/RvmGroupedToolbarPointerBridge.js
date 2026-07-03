const VERSION = '20260627-rvm-grouped-toolbar-pointer-1';
const PREVIOUS_TOOLBAR_VERSION = '20260627-rvm-toolbar-secondary-groups-restore-1';
const ROOT_SELECTOR = '[data-rvm-viewer]';
const BUTTON_SELECTOR = '[data-rvm-toolbar-more]';
const MENU_SELECTOR = '[data-rvm-tools-menu]';
const INSTALL_KEY = '__PCF_GLB_RVM_GROUPED_TOOLBAR_POINTER__';

export function installRvmGroupedToolbarPointerBridge() {
  if (typeof document === 'undefined') return null;
  const existing = globalThis[INSTALL_KEY];
  if (existing?.version === VERSION) return existing;
  const state = {
    version: VERSION,
    previousToolbarVersion: PREVIOUS_TOOLBAR_VERSION,
    pointerToggleCount: 0,
    suppressedClickCount: 0,
    missingApiCount: 0,
    lastMenuId: '',
    lastReason: 'install',
    suppressClickButton: null,
    onPointerDown: null,
    onClick: null,
  };
  state.onPointerDown = (event) => {
    const button = event?.target?.closest?.(BUTTON_SELECTOR);
    if (!button) return;
    const root = button.closest?.(ROOT_SELECTOR);
    if (!root) return;
    const menuId = menuIdForButton(button);
    if (!menuId) return;
    event.preventDefault?.();
    event.stopPropagation?.();
    event.stopImmediatePropagation?.();
    const api = globalThis.__PCF_GLB_RVM_TOOLBAR_OVERFLOW__;
    if (!api?.setOpen) {
      state.missingApiCount += 1;
      return;
    }
    const isOpen = button.getAttribute?.('aria-expanded') === 'true' && root.dataset?.rvmToolbarOverflowOpenMenu === menuId;
    api.setOpen(root, !isOpen, 'pointerdown-deterministic', menuId);
    state.pointerToggleCount += 1;
    state.lastMenuId = menuId;
    state.lastReason = 'pointerdown-deterministic';
    state.suppressClickButton = button;
    stamp(root, state);
  };
  state.onClick = (event) => {
    const button = event?.target?.closest?.(BUTTON_SELECTOR);
    if (!button || state.suppressClickButton !== button) return;
    event.preventDefault?.();
    event.stopPropagation?.();
    event.stopImmediatePropagation?.();
    state.suppressedClickCount += 1;
    state.suppressClickButton = null;
    const root = button.closest?.(ROOT_SELECTOR);
    if (root) stamp(root, state);
  };
  document.addEventListener('pointerdown', state.onPointerDown, true);
  document.addEventListener('click', state.onClick, true);
  state.dispose = () => {
    document.removeEventListener('pointerdown', state.onPointerDown, true);
    document.removeEventListener('click', state.onClick, true);
    if (globalThis[INSTALL_KEY] === state) delete globalThis[INSTALL_KEY];
  };
  globalThis[INSTALL_KEY] = state;
  for (const root of document.querySelectorAll?.(ROOT_SELECTOR) || []) stamp(root, state);
  injectStyles();
  return state;
}

function menuIdForButton(button) {
  return button?.dataset?.rvmToolbarMoreGroup
    || button?.closest?.('[data-rvm-toolbar-more-root]')?.dataset?.rvmToolbarMoreGroup
    || button?.getAttribute?.('aria-controls')
    || '';
}

function stamp(root, state) {
  if (!root?.dataset) return;
  root.dataset.rvmGroupedToolbarPointerBridge = VERSION;
  root.dataset.rvmGroupedToolbarPointerPrevious = PREVIOUS_TOOLBAR_VERSION;
  root.dataset.rvmGroupedToolbarPointerToggles = String(state.pointerToggleCount || 0);
  root.dataset.rvmGroupedToolbarPointerSuppressedClicks = String(state.suppressedClickCount || 0);
  root.dataset.rvmGroupedToolbarPointerLastMenu = state.lastMenuId || '';
}

function injectStyles() {
  let style = document.getElementById('rvm-grouped-toolbar-pointer-style');
  if (!style) {
    style = document.createElement('style');
    style.id = 'rvm-grouped-toolbar-pointer-style';
    document.head.appendChild(style);
  }
  style.dataset.rvmGroupedToolbarPointerBridge = VERSION;
  style.textContent = `
    [data-rvm-viewer] [data-rvm-toolbar-more]{pointer-events:auto;touch-action:manipulation;position:relative;z-index:80;}
    [data-rvm-viewer] [data-rvm-toolbar-more] *{pointer-events:none;}
    [data-rvm-viewer] [data-rvm-toolbar-more-root]{pointer-events:auto;}
    [data-rvm-viewer] [data-rvm-tools-menu]{pointer-events:auto;}
    [data-rvm-viewer] [data-rvm-tools-menu] *{pointer-events:auto;}
  `;
}
