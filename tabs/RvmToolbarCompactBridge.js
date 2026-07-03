import { installRvmToolbarOverflow, syncRvmToolbarOverflow } from './RvmToolbarOverflowController.js?v=20260627-rvm-toolbar-overflow-controller-grouped-restore-1';

const VERSION = '20260627-rvm-toolbar-scroll-misc-1';
const PREVIOUS_VERSION = '20260627-rvm-toolbar-view-expanded-nonempty-1';
const INSTALL_FLAG = Symbol.for('pcf-glb-rvm-toolbar-scroll-misc-1');
const GLOBAL_KEY = '__PCF_GLB_RVM_TOOLBAR_POLICY__';
const ROOT_SELECTOR = '[data-rvm-viewer]';
const CORE_LABELS = new Set(['navigate', 'view', 'navigate / view', 'review']);
const SECONDARY_MENU_DEFS = Object.freeze([
  { id: 'orient', label: 'Orient', title: 'Orientation Views', order: 1, terms: ['orient', 'top', 'front', 'right', 'iso', 'north', 'east', 'south', 'west'] },
  { id: 'visibility', label: 'Visibility', title: 'Visibility / Selection', order: 2, terms: ['visibility', 'visible', 'hide', 'show', 'isolate', 'snapshot'] },
  { id: 'misc', label: 'Misc', title: 'Misc Tools', order: 3, terms: ['report', 'health', 'health+', 'issues', 'model health'] },
  { id: 'inspect', label: 'Inspect', title: 'Inspect / Analysis', order: 4, terms: ['search', 'selection sets', 'material', 'inspect', 'analysis'] },
  { id: 'export', label: 'Export', title: 'Export', order: 5, terms: ['export', 'pcf', 'mapping', 'validation', 'staged', 'acceptance'] },
  { id: 'source', label: 'Source', title: 'Source Preview', order: 6, terms: ['source', 'support', 'supports', 'node marker', 'marker', 'auto bend', 'bend', 'nonprimitive', 'non-primitive'] },
  { id: 'diag', label: 'Diag', title: 'Diagnostics', order: 7, terms: ['diagnostic', 'diagnostics', 'runtime', 'parser', 'fallback', 'policy', 'perf', 'performance'] },
]);
const VIEW_TOP_LEVEL_RE = /\bview\b|fit|zoom|ortho|projection|camera|section|sec.?box|sec.?off|sec.?up/i;
let scheduledReconcile = 0;
let scheduledReason = '';

export function installRvmToolbarCompactBridge() {
  if (typeof document === 'undefined') return null;
  if (globalThis[INSTALL_FLAG]) return globalThis[INSTALL_FLAG];
  injectStyles();
  const state = {
    version: VERSION,
    previousVersion: PREVIOUS_VERSION,
    groupedSecondaryMenus: SECONDARY_MENU_DEFS.map((def) => def.id),
    runs: 0,
    movedCount: 0,
    duplicateCount: 0,
    hiddenEmptyMenuCount: 0,
    lastRunAt: '',
    reconcile: () => reconcileToolbar('api'),
    getDiagnostics: () => globalThis[GLOBAL_KEY]?.diagnostics || null,
  };
  globalThis[INSTALL_FLAG] = state;
  globalThis[GLOBAL_KEY] = state;
  scheduleToolbarReconcile('install');
  for (const delay of [80, 250, 750, 1500, 3000]) setTimeout(() => reconcileToolbar(`install-${delay}`), delay);
  try { globalThis.addEventListener?.('rvm-model-loaded', () => scheduleToolbarReconcile('model-loaded')); } catch (_) {}
  try { globalThis.addEventListener?.('rvm-action-diagnostics', () => scheduleToolbarReconcile('action-diagnostics')); } catch (_) {}
  const observer = new MutationObserver(() => scheduleToolbarReconcile('toolbar-mutation'));
  observer.observe(document.documentElement, { childList: true, subtree: true });
  state.observer = observer;
  return state;
}

function scheduleToolbarReconcile(reason) {
  scheduledReason = scheduledReason || reason;
  if (scheduledReconcile) return;
  scheduledReconcile = setTimeout(() => {
    const nextReason = scheduledReason || 'scheduled';
    scheduledReason = '';
    scheduledReconcile = 0;
    reconcileToolbar(nextReason);
  }, 0);
}

function reconcileToolbar(reason = 'manual') {
  const state = globalThis[INSTALL_FLAG];
  const root = document.querySelector(ROOT_SELECTOR);
  const ribbon = root?.querySelector?.('.geo-top-ribbon');
  if (!state || !root || !ribbon) return null;
  const menus = ensureSecondaryToolMenus(ribbon);
  installRvmToolbarOverflow(root, { reason: `toolbar-${reason}` });
  let moved = 0;
  let duplicates = 0;
  const seen = new Set();

  for (const section of [...ribbon.querySelectorAll(':scope > .rvm-ribbon-section')]) {
    if (isSecondaryMenuRoot(section) || section.closest('[data-rvm-tools-menu], [data-rvm-toolbar-more-panel]')) continue;
    const label = sectionLabel(section);
    section.dataset.rvmToolbarGroupLabel = label;
    if (isCoreTopLevelSection(section, label)) {
      section.hidden = false;
      section.dataset.rvmToolbarPolicy = 'core';
      clearSecondaryDataset(section);
      seen.add(groupKey(section, label));
      continue;
    }
    const key = groupKey(section, label);
    if (seen.has(key)) {
      section.hidden = true;
      section.dataset.rvmToolbarPolicy = 'duplicate-hidden';
      section.dataset.rvmToolbarDuplicate = 'true';
      duplicates += 1;
      continue;
    }
    seen.add(key);
    const targetMenuId = classifySecondaryMenu(section, label);
    section.hidden = false;
    section.dataset.rvmToolbarPolicy = 'secondary-grouped';
    section.dataset.rvmSecondaryToolGroup = targetMenuId;
    section.dataset.rvmToolsMenuItem = label;
    const panel = menus.get(targetMenuId)?.querySelector('[data-rvm-tools-menu]') || menus.get('misc')?.querySelector('[data-rvm-tools-menu]') || menus.get('inspect')?.querySelector('[data-rvm-tools-menu]');
    panel?.appendChild(section);
    moved += 1;
  }

  let hiddenEmptyMenuCount = 0;
  for (const [menuId, menuRoot] of menus) {
    const panel = menuRoot.querySelector('[data-rvm-tools-menu]');
    const sections = [...(panel?.querySelectorAll?.('.rvm-ribbon-section') || [])].filter((el) => !el.hidden);
    const empty = panel?.querySelector?.('[data-rvm-tools-empty]');
    const hasSections = sections.length > 0;
    menuRoot.hidden = !hasSections;
    menuRoot.dataset.rvmToolbarMenuEmpty = hasSections ? 'false' : 'true';
    menuRoot.setAttribute('aria-hidden', hasSections ? 'false' : 'true');
    if (!hasSections) hiddenEmptyMenuCount += 1;
    if (empty) empty.hidden = true;
    if (!hasSections && menuRoot.classList.contains('is-open')) {
      menuRoot.classList.remove('is-open');
      panel.hidden = true;
    }
    for (const section of sections) {
      const label = sectionLabel(section);
      section.dataset.rvmToolsMenuItem = section.dataset.rvmToolsMenuItem || label;
      section.dataset.rvmToolbarGroupLabel = section.dataset.rvmToolbarGroupLabel || label;
      section.dataset.rvmToolbarPolicy = section.dataset.rvmToolbarPolicy || 'secondary-grouped';
      section.dataset.rvmSecondaryToolGroup = section.dataset.rvmSecondaryToolGroup || menuId;
    }
  }

  const overflowDiagnostics = syncRvmToolbarOverflow(root, { reason: `toolbar-${reason}` });
  state.runs += 1;
  state.movedCount = Number(state.movedCount || 0) + moved;
  state.duplicateCount = Number(state.duplicateCount || 0) + duplicates;
  state.hiddenEmptyMenuCount = hiddenEmptyMenuCount;
  state.lastRunAt = new Date().toISOString();
  const diagnostics = {
    version: VERSION,
    previousVersion: PREVIOUS_VERSION,
    reason,
    runs: state.runs,
    groupedSecondaryMenus: SECONDARY_MENU_DEFS.map((def) => def.id),
    visibleSecondaryMenus: [...menus].filter(([, menuRoot]) => !menuRoot.hidden).map(([id]) => id),
    hiddenEmptyMenus: [...menus].filter(([, menuRoot]) => menuRoot.hidden).map(([id]) => id),
    topLevelGroups: [...ribbon.querySelectorAll(':scope > .rvm-ribbon-section')].filter((el) => !isSecondaryMenuRoot(el) && !el.hidden).map(sectionLabel),
    secondaryGroups: Object.fromEntries([...menus].map(([id, menuRoot]) => [id, [...menuRoot.querySelectorAll('.rvm-ribbon-section')].filter((el) => !el.hidden).map(sectionLabel)])),
    movedThisRun: moved,
    duplicatesThisRun: duplicates,
    hiddenEmptyMenuCount,
    totalMoved: state.movedCount,
    totalDuplicates: state.duplicateCount,
    overflow: overflowDiagnostics,
  };
  state.diagnostics = diagnostics;
  root.dataset.rvmToolbarPolicyVersion = VERSION;
  root.dataset.rvmToolbarPolicyPreviousVersion = PREVIOUS_VERSION;
  root.dataset.rvmToolbarSecondaryGroups = String(SECONDARY_MENU_DEFS.length);
  root.dataset.rvmToolbarVisibleSecondaryGroups = String(diagnostics.visibleSecondaryMenus.length);
  root.dataset.rvmToolbarHiddenEmptyGroups = String(hiddenEmptyMenuCount);
  root.dataset.rvmToolbarAdvancedGroups = String(Object.values(diagnostics.secondaryGroups).flat().length);
  root.dataset.rvmToolbarTopLevelGroups = String(diagnostics.topLevelGroups.length);
  return diagnostics;
}

function ensureSecondaryToolMenus(ribbon) {
  const menus = new Map();
  const modeChip = ribbon.querySelector('.mode-chip') || null;
  const validIds = new Set(SECONDARY_MENU_DEFS.map((def) => def.id));
  const salvage = [];
  for (const legacy of [...ribbon.querySelectorAll(':scope > [data-rvm-toolbar-more-root], :scope > details[data-rvm-toolbar-more]')]) {
    const id = legacy.dataset?.rvmToolbarMoreGroup || '';
    if (validIds.has(id) && legacy.dataset.rvmToolbarMoreRoot === VERSION) continue;
    const legacyPanel = legacy.querySelector?.('[data-rvm-tools-menu], [data-rvm-toolbar-more-panel]');
    salvage.push(...[...(legacyPanel?.querySelectorAll?.('.rvm-ribbon-section') || [])]);
    legacy.remove();
  }
  for (const def of SECONDARY_MENU_DEFS) {
    let menuRoot = ribbon.querySelector(`:scope > [data-rvm-toolbar-more-root][data-rvm-toolbar-more-group="${def.id}"]`);
    if (!menuRoot) {
      menuRoot = document.createElement('div');
      menuRoot.className = `rvm-toolbar-more rvm-toolbar-secondary-group rvm-ribbon-section rvm-toolbar-secondary-${def.id}`;
      menuRoot.dataset.rvmToolbarMoreRoot = VERSION;
      menuRoot.dataset.rvmToolbarMorePrevious = PREVIOUS_VERSION;
      menuRoot.dataset.rvmToolbarMoreGroup = def.id;
      menuRoot.dataset.rvmToolbarOrder = String(def.order);
      menuRoot.hidden = true;
      menuRoot.innerHTML = `<button type="button" class="rvm-tool-btn rvm-toolbar-more-summary" data-rvm-toolbar-more data-rvm-toolbar-more-group="${escapeAttr(def.id)}" aria-expanded="false"><span>${escapeHtml(def.label)}</span><span aria-hidden="true" class="rvm-toolbar-caret">v</span></button><div class="rvm-toolbar-more-panel rvm-toolbar-secondary-panel" data-rvm-tools-menu data-rvm-tools-menu-group="${escapeAttr(def.id)}" data-rvm-toolbar-more-panel hidden><div class="rvm-toolbar-secondary-title">${escapeHtml(def.title)}</div><div class="rvm-toolbar-secondary-empty" data-rvm-tools-empty hidden></div></div>`;
    }
    menus.set(def.id, menuRoot);
    if (!menuRoot.parentElement) ribbon.insertBefore(menuRoot, modeChip);
  }
  for (const def of [...SECONDARY_MENU_DEFS].sort((a, b) => a.order - b.order)) {
    const root = menus.get(def.id);
    if (root && root.nextSibling !== modeChip) ribbon.insertBefore(root, modeChip);
  }
  for (const section of salvage) {
    const label = sectionLabel(section);
    if (isCoreTopLevelSection(section, label)) {
      section.hidden = false;
      section.dataset.rvmToolbarPolicy = 'core';
      clearSecondaryDataset(section);
      ribbon.insertBefore(section, modeChip || null);
      continue;
    }
    const target = classifySecondaryMenu(section, label);
    section.dataset.rvmToolbarPolicy = 'secondary-grouped';
    section.dataset.rvmSecondaryToolGroup = target;
    menus.get(target)?.querySelector('[data-rvm-tools-menu]')?.appendChild(section);
  }
  return menus;
}

function isSecondaryMenuRoot(section) { return section?.matches?.('[data-rvm-toolbar-more-root]') || section?.dataset?.rvmToolbarMoreRoot; }

function classifySecondaryMenu(section, label) {
  const haystack = `${label} ${section?.className || ''} ${Object.values(section?.dataset || {}).join(' ')}`.toLowerCase();
  if (/\borient\b|\btop\b|\bfront\b|\bright\b|\biso\b|\bnw\b|\bne\b|\bsw\b|\bse\b/.test(haystack)) return 'orient';
  if (/\breport\b|\bhealth\+?\b|model.?health|health.?issues|\bissues\b/.test(haystack)) return 'misc';
  if (/visibility|visible|hide|show|isolate|snapshot/.test(haystack)) return 'visibility';
  if (/source|support|node.?marker|auto.?bend|non.?primitive/.test(haystack)) return 'source';
  if (/export|pcf|mapping|validation|staged|acceptance/.test(haystack)) return 'export';
  if (/diag|runtime|parser|fallback|policy|perf|performance/.test(haystack)) return 'diag';
  if (/search|selection.?set|material|inspect|analysis/.test(haystack)) return 'inspect';
  return 'inspect';
}

function isCoreTopLevelSection(section, label) {
  if (section.classList.contains('rvm-ribbon-load')) return true;
  if (section.dataset.rvmToolbarAlwaysTop === 'true') return true;
  if (!section.classList.contains('rvm-tool-group')) return false;
  const normalizedLabel = String(label || '').toLowerCase();
  if (CORE_LABELS.has(normalizedLabel)) return true;
  const haystack = `${label} ${section?.className || ''} ${Object.values(section?.dataset || {}).join(' ')}`;
  return VIEW_TOP_LEVEL_RE.test(haystack) && !/\borient\b|\btop\b|\bfront\b|\bright\b|\biso\b/.test(haystack.toLowerCase());
}

function clearSecondaryDataset(section) {
  if (!section?.dataset) return;
  delete section.dataset.rvmSecondaryToolGroup;
  delete section.dataset.rvmToolsMenuItem;
  delete section.dataset.rvmToolbarDuplicate;
}

function sectionLabel(section) {
  const label = section?.querySelector?.('.rvm-ribbon-label')?.textContent || section?.getAttribute?.('aria-label') || section?.className || 'Tools';
  return String(label).replace(/\s+tools$/i, '').replace(/\s+/g, ' ').trim() || 'Tools';
}

function groupKey(section, label) {
  const datasetKey = section?.dataset?.rvmToolbarKey || section?.dataset?.rvmMeasureToolbar || section?.dataset?.rvmStagedjsonExport || section?.dataset?.rvmStagedjsonValidation || section?.dataset?.rvmGlbAcceptancePack || '';
  return `${label.toLowerCase()}::${String(datasetKey || section?.className || '').replace(/\s+/g, '.')}`;
}

function escapeHtml(value) { return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;'); }
function escapeAttr(value) { return escapeHtml(value); }

function injectStyles() {
  let style = document.getElementById('rvm-toolbar-compact-policy-style');
  if (!style) {
    style = document.createElement('style');
    style.id = 'rvm-toolbar-compact-policy-style';
    document.head.appendChild(style);
  }
  style.dataset.rvmToolbarCompactPolicy = VERSION;
  style.textContent = `
    [data-rvm-viewer] .geo-top-ribbon{position:relative;align-items:flex-start;flex-wrap:nowrap;overflow-x:auto;overflow-y:visible;max-width:100%;scrollbar-width:thin;padding-bottom:4px;}
    [data-rvm-viewer] .geo-top-ribbon::-webkit-scrollbar{height:7px;}
    [data-rvm-viewer] .geo-top-ribbon::-webkit-scrollbar-thumb{background:rgba(126,190,255,.35);border-radius:999px;}
    [data-rvm-viewer] .geo-top-ribbon > .rvm-ribbon-section{flex:0 0 auto;}
    [data-rvm-viewer] .rvm-toolbar-secondary-group{position:relative;display:inline-flex;align-items:flex-start;z-index:60;}
    [data-rvm-viewer] .rvm-toolbar-secondary-group > .rvm-toolbar-more-summary{list-style:none;user-select:none;gap:4px;}
    [data-rvm-viewer] .rvm-toolbar-secondary-group.is-open > .rvm-toolbar-more-summary{background:var(--geo-accent,#4a9eff);color:#fff;border-color:var(--geo-accent,#4a9eff);}
    [data-rvm-viewer] .rvm-toolbar-secondary-group[hidden]{display:none!important;}
    [data-rvm-viewer] .rvm-toolbar-caret{font-size:9px;line-height:1;opacity:.9;}
    [data-rvm-viewer] .rvm-toolbar-secondary-panel{position:fixed;left:0;top:0;display:grid;grid-template-columns:1fr;gap:6px;min-width:190px;max-width:min(360px,calc(100vw - 40px));max-height:min(60vh,520px);overflow:auto;padding:8px;border:1px solid rgba(126,190,255,.30);border-radius:10px;background:rgba(10,18,32,.98);box-shadow:0 18px 60px rgba(0,0,0,.45);z-index:9999;}
    [data-rvm-viewer] .rvm-toolbar-secondary-panel[hidden], [data-rvm-viewer] .rvm-toolbar-secondary-group:not(.is-open) .rvm-toolbar-secondary-panel{display:none!important;}
    [data-rvm-viewer] .rvm-toolbar-secondary-title{font-size:10px;color:#9ec5ff;text-transform:uppercase;letter-spacing:.06em;border-bottom:1px solid rgba(148,163,184,.18);padding:0 0 5px;}
    [data-rvm-viewer] .rvm-toolbar-secondary-empty{display:none!important;}
    [data-rvm-viewer] .rvm-toolbar-secondary-panel .rvm-ribbon-section{display:grid;grid-template-columns:auto 1fr;align-items:center;gap:6px;padding:6px;border:1px solid rgba(148,163,184,.18);border-radius:8px;background:rgba(15,23,42,.62);}
    [data-rvm-viewer] .rvm-toolbar-secondary-panel .rvm-ribbon-label{min-width:68px;color:#9ec5ff;font-size:10px;text-transform:uppercase;letter-spacing:.05em;}
    [data-rvm-viewer] .rvm-toolbar-secondary-panel .rvm-ribbon-button-row,[data-rvm-viewer] .rvm-toolbar-secondary-panel .rvm-stagedjson-buttons,[data-rvm-viewer] .rvm-toolbar-secondary-panel .rvm-stagedjson-validation-buttons{display:flex;flex-wrap:wrap;gap:4px;}
    [data-rvm-viewer] .rvm-toolbar-secondary-orient .rvm-toolbar-secondary-panel .rvm-tool-btn.is-icon-only::after{content:attr(aria-label);font-size:11px;margin-left:4px;}
    [data-rvm-viewer] .rvm-toolbar-secondary-orient .rvm-toolbar-secondary-panel .rvm-tool-btn.is-icon-only{min-width:64px;justify-content:flex-start;}
  `;
}
