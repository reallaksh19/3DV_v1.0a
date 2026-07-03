import {
  RVM_FORMAT_POLICY_VERSION,
  RVM_RIGHT_PANEL_SECTIONS,
  hasRvmRightPanelSection,
  resolveRvmFormatContext,
} from './RvmFormatPolicy.js?v=20260628-rvm-right-panel-core-policy-1';

export const RVM_RIGHT_PANEL_FORMAT_POLICY_SCHEMA = 'rvm-right-panel-format-policy/v4-ui';

const INSTALL_FLAG = Symbol.for('pcf-glb-rvm-right-panel-format-policy-v4-ui');
const STYLE_FLAG = Symbol.for('pcf-glb-rvm-right-panel-format-policy-style-v4-ui');
const GLOBAL_KEY = '__PCF_GLB_RVM_RIGHT_PANEL_FORMAT_POLICY__';
const VERSION = '20260628-rvm-right-panel-ui-v2-1';
const PREVIOUS_VERSION = '20260628-rvm-right-panel-layout-1';
const ROOT_SELECTOR = '[data-rvm-viewer]';
const FORMAT_PANEL_ID = 'rvm-format-policy-panel';
const STAGED_PANEL_ID = 'rvm-stagedjson-review-panel';

const PANEL_META = Object.freeze({
  selectedEntity: Object.freeze({ label: 'Selected Entity', badge: 'SEL', tone: 'selection' }),
  [RVM_RIGHT_PANEL_SECTIONS.SOURCE_TOOLS]: Object.freeze({ label: 'Source Tools', badge: 'SRC', tone: 'source' }),
  [RVM_RIGHT_PANEL_SECTIONS.SUPPORT_DETAILS]: Object.freeze({ label: 'Support Details', badge: 'SUP', tone: 'support' }),
  [RVM_RIGHT_PANEL_SECTIONS.NODE_MARKERS]: Object.freeze({ label: 'Node Markers', badge: 'NOD', tone: 'node' }),
  [RVM_RIGHT_PANEL_SECTIONS.STAGEDJSON_REVIEW]: Object.freeze({ label: 'StagedJSON Review', badge: 'STG', tone: 'staged' }),
  formatPolicy: Object.freeze({ label: 'Panel Policy', badge: 'POL', tone: 'policy' }),
  [RVM_RIGHT_PANEL_SECTIONS.BROWSER_DIAGNOSTICS]: Object.freeze({ label: 'Browser Diagnostics', badge: 'DBG', tone: 'diagnostics' }),
});

const SECTION_SELECTORS = Object.freeze({
  [RVM_RIGHT_PANEL_SECTIONS.SOURCE_TOOLS]: Object.freeze([
    '#rvm-nonprimitive-source-tools-panel',
    '[data-rvm-non-primitive-source-tools-header]',
  ]),
  [RVM_RIGHT_PANEL_SECTIONS.SUPPORT_DETAILS]: Object.freeze([
    '#rvm-nonprimitive-support-details-panel',
    '[data-rvm-non-primitive-support-details-header]',
  ]),
  [RVM_RIGHT_PANEL_SECTIONS.NODE_MARKERS]: Object.freeze([
    '#rvm-nonprimitive-node-marker-details-panel',
    '[data-rvm-non-primitive-node-marker-details-header]',
  ]),
  [RVM_RIGHT_PANEL_SECTIONS.STAGEDJSON_REVIEW]: Object.freeze([
    `#${STAGED_PANEL_ID}`,
    `[data-rvm-right-panel-format-header="${STAGED_PANEL_ID}"]`,
  ]),
  [RVM_RIGHT_PANEL_SECTIONS.BROWSER_DIAGNOSTICS]: Object.freeze([
    '[data-rvm-browser-diagnostics-header="true"]',
    '#rvm-browser-parse-diagnostics',
  ]),
});

const SOURCE_SECTION_IDS = Object.freeze([
  RVM_RIGHT_PANEL_SECTIONS.SOURCE_TOOLS,
  RVM_RIGHT_PANEL_SECTIONS.SUPPORT_DETAILS,
  RVM_RIGHT_PANEL_SECTIONS.NODE_MARKERS,
]);

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function rootEl() {
  return globalThis.document?.querySelector?.(ROOT_SELECTOR) || null;
}

function viewer() {
  return globalThis.__3D_RVM_VIEWER__ || null;
}

function ensurePanelPair(root, id, title, beforeSelector = '[data-rvm-browser-diagnostics-header="true"]') {
  const right = root?.querySelector?.('.rvm-right-panel');
  if (!right || !globalThis.document?.createElement) return null;
  let panel = right.querySelector(`#${id}`);
  if (panel) return panel;
  const header = globalThis.document.createElement('div');
  panel = globalThis.document.createElement('div');
  header.className = 'rvm-panel-header rvm-right-section-header';
  header.dataset.rvmRightPanelFormatHeader = id;
  header.innerHTML = `<span class="rvm-panel-title">${esc(title)}</span>`;
  panel.id = id;
  panel.className = 'rvm-right-format-panel rvm-right-section-card rvm-tag-list';
  panel.dataset.rvmRightPanelFormatBody = id;
  const before = beforeSelector ? right.querySelector(beforeSelector) : null;
  if (before && before.parentElement === right) {
    right.insertBefore(header, before);
    right.insertBefore(panel, before);
  } else {
    right.append(header, panel);
  }
  return panel;
}

function setPairHidden(root, id, hidden) {
  const panel = root?.querySelector?.(`#${id}`);
  const header = root?.querySelector?.(`[data-rvm-right-panel-format-header="${id}"]`);
  if (panel) panel.hidden = hidden;
  if (header) header.hidden = hidden;
}

function setSelectorHidden(root, selector, hidden, reason = '') {
  root?.querySelectorAll?.(selector).forEach((el) => {
    el.hidden = hidden;
    if (hidden) el.dataset.rvmRightPanelPolicyHidden = reason || VERSION;
    else delete el.dataset.rvmRightPanelPolicyHidden;
  });
}

function setSectionHidden(root, section, hidden, reason = '') {
  for (const selector of SECTION_SELECTORS[section] || []) setSelectorHidden(root, selector, hidden, reason);
}

function markActiveSections(root, context) {
  if (!root?.dataset) return;
  root.dataset.rvmRightPanelSections = (context.sections || []).join(',');
  root.dataset.rvmRightPanelLayout = VERSION;
  root.dataset.rvmRightPanelUi = VERSION;
  root.dataset.rvmRightPanelPreviousLayout = PREVIOUS_VERSION;
  root.dataset.rvmRightPanelShowSourceTools = String(hasRvmRightPanelSection(context.policy, RVM_RIGHT_PANEL_SECTIONS.SOURCE_TOOLS));
  root.dataset.rvmRightPanelShowSupportDetails = String(hasRvmRightPanelSection(context.policy, RVM_RIGHT_PANEL_SECTIONS.SUPPORT_DETAILS));
  root.dataset.rvmRightPanelShowNodeMarkers = String(hasRvmRightPanelSection(context.policy, RVM_RIGHT_PANEL_SECTIONS.NODE_MARKERS));
  root.dataset.rvmRightPanelShowStagedJsonReview = String(hasRvmRightPanelSection(context.policy, RVM_RIGHT_PANEL_SECTIONS.STAGEDJSON_REVIEW));
  root.dataset.rvmRightPanelShowNativeDiagnostics = String(hasRvmRightPanelSection(context.policy, RVM_RIGHT_PANEL_SECTIONS.NATIVE_DIAGNOSTICS));
  root.dataset.rvmRightPanelShowBrowserDiagnostics = String(hasRvmRightPanelSection(context.policy, RVM_RIGHT_PANEL_SECTIONS.BROWSER_DIAGNOSTICS));
}

function policyChip(label, enabled) {
  return `<span class="rvm-format-policy-chip ${enabled ? 'is-on' : 'is-off'}">${esc(label)} ${enabled ? 'on' : 'off'}</span>`;
}

function sectionChip(section, enabled) {
  const label = String(section || '').replace(/-/g, ' ');
  return `<span class="rvm-format-section-chip ${enabled ? 'is-on' : 'is-off'}" data-rvm-right-panel-section-chip="${esc(section)}">${esc(label)}</span>`;
}

function row(key, value) {
  return `<div class="rvm-format-row"><span>${esc(key)}</span><b title="${esc(value)}">${esc(value === undefined || value === null || value === '' ? '-' : value)}</b></div>`;
}

function headerForPanel(right, panel) {
  if (!right || !panel) return null;
  let current = panel.previousElementSibling;
  while (current && current.parentElement === right) {
    if (current.classList?.contains('rvm-panel-header')) return current;
    current = current.previousElementSibling;
  }
  return null;
}

function pairFromPanel(root, panelSelector, headerSelector = '', section = '') {
  const right = root?.querySelector?.('.rvm-right-panel');
  if (!right) return null;
  const panel = root.querySelector(panelSelector);
  if (!panel || panel.parentElement !== right) return null;
  const header = headerSelector ? root.querySelector(headerSelector) : headerForPanel(right, panel);
  if (header && header.parentElement !== right) return { section, header: null, panel };
  return { section, header, panel };
}

function orderedRightPanelPairs(root) {
  return [
    pairFromPanel(root, '#rvm-attributes-panel', '', 'selectedEntity'),
    pairFromPanel(root, '#rvm-nonprimitive-source-tools-panel', '[data-rvm-non-primitive-source-tools-header]', RVM_RIGHT_PANEL_SECTIONS.SOURCE_TOOLS),
    pairFromPanel(root, '#rvm-nonprimitive-support-details-panel', '[data-rvm-non-primitive-support-details-header]', RVM_RIGHT_PANEL_SECTIONS.SUPPORT_DETAILS),
    pairFromPanel(root, '#rvm-nonprimitive-node-marker-details-panel', '[data-rvm-non-primitive-node-marker-details-header]', RVM_RIGHT_PANEL_SECTIONS.NODE_MARKERS),
    pairFromPanel(root, `#${STAGED_PANEL_ID}`, `[data-rvm-right-panel-format-header="${STAGED_PANEL_ID}"]`, RVM_RIGHT_PANEL_SECTIONS.STAGEDJSON_REVIEW),
    pairFromPanel(root, `#${FORMAT_PANEL_ID}`, `[data-rvm-right-panel-format-header="${FORMAT_PANEL_ID}"]`, 'formatPolicy'),
    pairFromPanel(root, '#rvm-browser-parse-diagnostics', '[data-rvm-browser-diagnostics-header="true"]', RVM_RIGHT_PANEL_SECTIONS.BROWSER_DIAGNOSTICS),
  ].filter(Boolean);
}

function sectionBadge(section) {
  const meta = PANEL_META[section] || Object.freeze({ label: String(section || 'Section'), badge: 'UI', tone: 'default' });
  return `<span class="rvm-right-section-badge" data-rvm-right-section-tone="${esc(meta.tone)}">${esc(meta.badge)}</span>`;
}

function decorateSectionHeader(header, section) {
  if (!header) return;
  const meta = PANEL_META[section] || Object.freeze({ label: String(section || 'Section'), badge: 'UI', tone: 'default' });
  header.classList?.add('rvm-right-section-header');
  header.dataset.rvmRightPanelSection = section || 'unknown';
  header.dataset.rvmRightPanelTone = meta.tone;
  let title = header.querySelector?.('.rvm-panel-title');
  if (!title) {
    const raw = String(header.textContent || meta.label).trim() || meta.label;
    header.textContent = '';
    title = globalThis.document?.createElement?.('span');
    if (title) {
      title.className = 'rvm-panel-title';
      title.textContent = raw;
      header.appendChild(title);
    }
  }
  if (title && /^(Properties|RVM selection details)$/i.test(String(title.textContent || '').trim())) title.textContent = meta.label;
  let badge = header.querySelector?.('.rvm-right-section-badge');
  if (!badge && globalThis.document?.createElement) {
    const wrap = globalThis.document.createElement('span');
    wrap.innerHTML = sectionBadge(section);
    badge = wrap.firstElementChild;
    if (badge) header.insertBefore(badge, header.firstChild);
  }
}

function decorateSectionPanel(panel, section) {
  if (!panel) return;
  const meta = PANEL_META[section] || Object.freeze({ tone: 'default' });
  panel.classList?.add('rvm-right-section-card');
  panel.dataset.rvmRightPanelSection = section || 'unknown';
  panel.dataset.rvmRightPanelTone = meta.tone;
}

function decorateRightPanelUi(root) {
  const right = root?.querySelector?.('.rvm-right-panel');
  if (!right) return 0;
  right.classList?.add('rvm-right-panel-v2');
  right.dataset.rvmRightPanelUi = VERSION;
  let decorated = 0;
  for (const pair of orderedRightPanelPairs(root)) {
    decorateSectionHeader(pair.header, pair.section);
    decorateSectionPanel(pair.panel, pair.section);
    decorated += 1;
  }
  root.dataset.rvmRightPanelUiDecorated = String(decorated);
  return decorated;
}

function orderRightPanelSections(root) {
  const right = root?.querySelector?.('.rvm-right-panel');
  if (!right) return 0;
  let moved = 0;
  for (const pair of orderedRightPanelPairs(root)) {
    if (pair.header) { right.appendChild(pair.header); moved += 1; }
    right.appendChild(pair.panel);
    moved += 1;
  }
  root.dataset.rvmRightPanelOrdered = VERSION;
  return moved;
}

function hideEmptyRightPanelHeaders(root) {
  const right = root?.querySelector?.('.rvm-right-panel');
  if (!right) return 0;
  let hidden = 0;
  for (const header of right.querySelectorAll('.rvm-panel-header')) {
    const panel = header.nextElementSibling;
    if (!panel || panel.classList?.contains('rvm-panel-header')) continue;
    const emptyBody = !panel.hidden && !String(panel.textContent || '').trim() && !panel.querySelector?.('button,input,select,textarea,svg,canvas');
    const shouldHide = Boolean(panel.hidden || emptyBody);
    header.hidden = shouldHide;
    if (shouldHide) {
      header.dataset.rvmRightPanelEmptyHeaderHidden = VERSION;
      hidden += 1;
    } else {
      delete header.dataset.rvmRightPanelEmptyHeaderHidden;
    }
  }
  root.dataset.rvmRightPanelEmptyHeadersHidden = String(hidden);
  return hidden;
}

function updateSelectionTitle(root) {
  const title = root?.querySelector?.('#rvm-attributes-panel [data-rvm-selection-details-inspector="true"] .rvm-selection-details-title span');
  if (title && /RVM selection details/i.test(title.textContent || '')) title.textContent = 'Selected Entity';
  const right = root?.querySelector?.('.rvm-right-panel');
  const attributesPanel = root?.querySelector?.('#rvm-attributes-panel');
  if (!right || !attributesPanel) return;
  const header = headerForPanel(right, attributesPanel) || right.querySelector('.rvm-panel-header');
  if (header && /^(Properties|RVM selection details)$/i.test(String(header.textContent || '').trim())) header.textContent = 'Selected Entity';
}

function applyRightPanelSectionPolicy(root, context) {
  const policy = context.policy || {};
  markActiveSections(root, context);
  updateSelectionTitle(root);

  for (const section of SOURCE_SECTION_IDS) {
    const enabled = hasRvmRightPanelSection(policy, section);
    setSectionHidden(root, section, !enabled, `section-disabled:${section}`);
  }
  setSectionHidden(root, RVM_RIGHT_PANEL_SECTIONS.BROWSER_DIAGNOSTICS, !hasRvmRightPanelSection(policy, RVM_RIGHT_PANEL_SECTIONS.BROWSER_DIAGNOSTICS), 'section-disabled:browser-diagnostics');

  if (!hasRvmRightPanelSection(policy, RVM_RIGHT_PANEL_SECTIONS.SUPPORT_DETAILS)) {
    try { globalThis.__PCF_GLB_RVM_NON_PRIMITIVE_SUPPORT_DETAILS_PANEL__?.clear?.(context.viewer, 'right-panel-section-disabled'); } catch (_) {}
  }
  if (!hasRvmRightPanelSection(policy, RVM_RIGHT_PANEL_SECTIONS.NODE_MARKERS)) {
    try { globalThis.__PCF_GLB_RVM_NON_PRIMITIVE_NODE_MARKERS__?.clear?.(context.viewer, 'right-panel-section-disabled'); } catch (_) {}
  }
  if (!hasRvmRightPanelSection(policy, RVM_RIGHT_PANEL_SECTIONS.SOURCE_TOOLS)) {
    try { globalThis.__PCF_GLB_RVM_NON_PRIMITIVE_SOURCE_TOOLS_UI__?.clear?.(root?.querySelector?.('#rvm-nonprimitive-source-tools-panel'), context.viewer, 'right-panel-section-disabled'); } catch (_) {}
  }
}

function renderFormatPanel(root, context) {
  const panel = ensurePanelPair(root, FORMAT_PANEL_ID, 'Panel Policy');
  if (!panel) return null;
  panel.hidden = false;
  const p = context.policy || {};
  const sectionSet = new Set(context.sections || []);
  panel.dataset.rvmRightPanelPolicyVersion = VERSION;
  panel.dataset.rvmRightPanelSourceKind = context.sourceKind || 'unknown';
  panel.innerHTML = `
    <div class="rvm-format-policy-card rvm-right-ui-summary-card" data-rvm-format-policy-version="${esc(VERSION)}" data-rvm-right-panel-section-policy="true">
      <div class="rvm-right-card-title"><span>Right Panel</span><small>${esc(context.sourceKind || 'unknown')} · ${esc(context.primitiveMode || 'model')}</small></div>
      <div class="rvm-right-status-strip" data-rvm-right-status-strip="true">
        <span data-state="${context.isSourcePreview ? 'on' : 'off'}">${context.isSourcePreview ? 'Source preview active' : 'Native model mode'}</span>
        <span>${esc(context.fileName || 'current model')}</span>
      </div>
      <div class="rvm-format-grid rvm-format-grid--compact">
        ${row('File', context.fileName || 'current model')}
        ${row('Mode', context.primitiveMode || '-')}
        ${row('Source preview', context.isSourcePreview ? 'yes' : 'no')}
      </div>
      <div class="rvm-format-policy-chips">
        ${policyChip('source tools', p.showSourceTools)}
        ${policyChip('support details', p.showSupportDetails)}
        ${policyChip('node markers', p.showNodeMarkers)}
        ${policyChip('stagedJSON', p.showStagedJsonReview)}
        ${policyChip('native diagnostics', p.showNativeDiagnostics)}
      </div>
      <div class="rvm-format-section-list" data-rvm-right-panel-sections="true">
        ${Object.values(RVM_RIGHT_PANEL_SECTIONS).map((section) => sectionChip(section, sectionSet.has(section))).join('')}
      </div>
    </div>`;
  return panel;
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function collectStagedSource(context) {
  const source = context.source || context.supportSource || null;
  if (source && typeof source === 'object') return source;
  const exported = globalThis.__PCF_GLB_RVM_STAGEDJSON_EXPORT_DIAGNOSTICS__;
  if (exported && typeof exported === 'object') return exported;
  return null;
}

function isStagedJsonSource(source) {
  if (!source || typeof source !== 'object') return false;
  if (String(source.schema || '').toLowerCase().includes('stagedjson')) return true;
  if (Array.isArray(source.branches) || Array.isArray(source.supportRecords)) return true;
  if (source.model && (Array.isArray(source.model.branches) || Array.isArray(source.model.supportRecords))) return true;
  return false;
}

function flattenChildren(node, out = []) {
  if (!node || typeof node !== 'object') return out;
  for (const child of asArray(node.children)) {
    out.push(child);
    flattenChildren(child, out);
  }
  return out;
}

function countBy(rows, keyPicker) {
  const map = new Map();
  for (const rowItem of rows || []) {
    const key = String(keyPicker(rowItem) || 'UNKNOWN').toUpperCase();
    map.set(key, (map.get(key) || 0) + 1);
  }
  return [...map.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

function stagedStats(source) {
  const branches = asArray(source?.branches || source?.model?.branches);
  const supports = asArray(source?.supportRecords || source?.model?.supportRecords);
  const components = branches.flatMap((branch) => flattenChildren(branch, []));
  const componentTypes = countBy(components, (item) => item.TYPE || item.type || item.COMPONENT_TYPE || item.stagedJsonRole || 'COMPONENT');
  const supportKinds = countBy(supports, (item) => item.SUPPORT_KIND || item.RVM_BROWSER_SUPPORT_KIND || item.supportKind || item.TYPE || 'SUPPORT');
  const diagnostics = source?.diagnostics || {};
  return {
    schema: source?.schema || source?.schemaVersion || 'stagedjson/unknown',
    modelName: source?.model?.name || source?.modelName || source?.name || 'StagedJSON model',
    branches,
    supports,
    components,
    componentTypes,
    supportKinds,
    diagnostics,
    primitiveCount: Number(source?.model?.primitiveCount ?? source?.primitiveCount ?? 0) || 0,
  };
}

function listRows(rows, emptyLabel) {
  if (!rows.length) return `<li class="is-empty"><span>${esc(emptyLabel)}</span><b>0</b></li>`;
  return rows.slice(0, 8).map(([name, count]) => `<li><span>${esc(name)}</span><b>${esc(count)}</b></li>`).join('');
}

function kpi(value, label, tone = '') {
  return `<span data-rvm-right-kpi="${esc(label.toLowerCase())}" data-tone="${esc(tone)}"><b>${esc(value)}</b><small>${esc(label)}</small></span>`;
}

function renderStagedJsonPanel(root, context) {
  const panel = ensurePanelPair(root, STAGED_PANEL_ID, 'StagedJSON Review');
  if (!panel) return null;
  const shouldShow = hasRvmRightPanelSection(context.policy, RVM_RIGHT_PANEL_SECTIONS.STAGEDJSON_REVIEW);
  setPairHidden(root, STAGED_PANEL_ID, !shouldShow);
  if (!shouldShow) {
    panel.innerHTML = '';
    return panel;
  }
  const source = collectStagedSource(context);
  if (!isStagedJsonSource(source)) {
    panel.hidden = false;
    panel.innerHTML = '<div class="rvm-empty-state rvm-right-empty-state">No stagedJSON source is attached to this model.</div>';
    return panel;
  }
  const stats = stagedStats(source);
  panel.hidden = false;
  panel.dataset.rvmStagedJsonReview = VERSION;
  panel.innerHTML = `
    <div class="rvm-stagedjson-card rvm-stagedjson-card--clear rvm-right-ui-summary-card" data-rvm-stagedjson-source="true">
      <div class="rvm-right-card-title"><span>${esc(stats.modelName)}</span><small>${esc(stats.schema)}</small></div>
      <div class="rvm-stagedjson-kpis" data-rvm-stagedjson-kpis="true">
        ${kpi(stats.branches.length, 'Branches', 'branch')}
        ${kpi(stats.components.length, 'Components', 'component')}
        ${kpi(stats.supports.length, 'Supports', 'support')}
        ${kpi(stats.primitiveCount || 0, 'Primitives', 'primitive')}
      </div>
      <div class="rvm-stagedjson-columns">
        <section><h4>Component types</h4><ul>${listRows(stats.componentTypes, 'No components')}</ul></section>
        <section><h4>Support kinds</h4><ul>${listRows(stats.supportKinds, 'No support records')}</ul></section>
      </div>
      <div class="rvm-format-actions rvm-right-action-bar">
        <button type="button" data-rvm-right-panel-action="copy-stagedjson">Copy JSON</button>
        <button type="button" data-rvm-right-panel-action="download-stagedjson">Download</button>
        <button class="is-secondary" type="button" data-rvm-right-panel-action="copy-stagedjson-diagnostics">Diag JSON</button>
      </div>
    </div>`;
  return panel;
}

function fileStem(context, suffix) {
  const base = String(context.fileName || context.sourceKind || 'rvm-model').replace(/\.[^.]+$/, '').replace(/[^A-Za-z0-9._-]+/g, '_') || 'rvm-model';
  return `${base}-${suffix}`;
}

async function copyText(text) {
  if (globalThis.navigator?.clipboard?.writeText) {
    await globalThis.navigator.clipboard.writeText(text);
    return { status: 'copied', bytes: text.length };
  }
  return { status: 'unavailable', reason: 'clipboard-api-missing', bytes: text.length };
}

function downloadText(text, fileName, mimeType = 'application/json') {
  const doc = globalThis.document;
  if (!doc?.createElement || !globalThis.Blob || !globalThis.URL?.createObjectURL) return { status: 'unavailable', reason: 'download-api-missing', bytes: text.length };
  const url = globalThis.URL.createObjectURL(new globalThis.Blob([text], { type: mimeType }));
  const link = doc.createElement('a');
  link.href = url;
  link.download = fileName;
  link.style.display = 'none';
  doc.body?.appendChild?.(link);
  link.click?.();
  link.remove?.();
  setTimeout(() => globalThis.URL.revokeObjectURL?.(url), 0);
  return { status: 'downloaded', fileName, bytes: text.length };
}

function currentStagedJsonPayload() {
  const context = resolveRvmFormatContext({ root: rootEl(), viewer: viewer() });
  const source = collectStagedSource(context);
  return { context, source, stats: isStagedJsonSource(source) ? stagedStats(source) : null };
}

function setStatus(message, warning = false) {
  const status = rootEl()?.querySelector?.('#rvm-sb-msg');
  if (!status) return;
  status.textContent = message;
  status.style.color = warning ? '#ffcf70' : '';
}

function handleClick(event) {
  const action = event.target?.closest?.('[data-rvm-right-panel-action]')?.dataset?.rvmRightPanelAction;
  if (!action) return;
  event.preventDefault();
  const { context, source, stats } = currentStagedJsonPayload();
  if (!source) {
    setStatus('Right panel: no stagedJSON payload available.', true);
    return;
  }
  if (action === 'copy-stagedjson') {
    copyText(JSON.stringify(source, null, 2)).then((result) => setStatus(result.status === 'copied' ? 'Right panel: copied stagedJSON.' : 'Right panel: clipboard unavailable.', result.status !== 'copied'));
  } else if (action === 'download-stagedjson') {
    const result = downloadText(JSON.stringify(source, null, 2), fileStem(context, 'right-panel.stagedjson'));
    setStatus(result.status === 'downloaded' ? `Right panel: downloaded ${result.fileName}.` : 'Right panel: download unavailable.', result.status !== 'downloaded');
  } else if (action === 'copy-stagedjson-diagnostics') {
    const payload = { schema: 'rvm-right-panel-stagedjson-diagnostics/v1', version: VERSION, stats, diagnostics: source?.diagnostics || null };
    copyText(JSON.stringify(payload, null, 2)).then((result) => setStatus(result.status === 'copied' ? 'Right panel: copied stagedJSON diagnostics.' : 'Right panel: clipboard unavailable.', result.status !== 'copied'));
  }
}

function render(root = rootEl(), activeViewer = viewer()) {
  if (!root) return null;
  const context = resolveRvmFormatContext({ root, viewer: activeViewer });
  root.dataset.rvmRightPanelFormatPolicy = VERSION;
  root.dataset.rvmRightPanelSourceKind = context.sourceKind;
  root.dataset.rvmRightPanelPolicyVersion = RVM_FORMAT_POLICY_VERSION;
  renderFormatPanel(root, context);
  renderStagedJsonPanel(root, context);
  applyRightPanelSectionPolicy(root, context);
  orderRightPanelSections(root);
  decorateRightPanelUi(root);
  hideEmptyRightPanelHeaders(root);
  try { globalThis.__PCF_GLB_RVM_RIGHT_PANEL_TABS__?.refresh?.(root, 'right-panel-format-policy'); } catch (_) {}
  return context;
}

function installStyles() {
  if (globalThis[STYLE_FLAG]) return;
  globalThis[STYLE_FLAG] = true;
  const doc = globalThis.document;
  if (!doc?.createElement) return;
  const style = doc.createElement('style');
  style.dataset.rvmRightPanelFormatPolicyStyle = VERSION;
  style.textContent = `
    .rvm-right-panel.rvm-right-panel-v2{--rvm-ui-card:rgba(8,15,27,.82);--rvm-ui-card-2:rgba(12,22,38,.9);--rvm-ui-line:rgba(126,190,255,.16);--rvm-ui-soft:rgba(126,190,255,.08);display:flex;flex-direction:column;gap:7px;padding:7px;background:linear-gradient(180deg,rgba(5,10,18,.94),rgba(9,15,28,.92));}
    .rvm-right-panel-v2 .rvm-panel-header.rvm-right-section-header{display:flex;align-items:center;gap:6px;min-height:0;margin:0;padding:6px 7px 4px;border:1px solid rgba(148,163,184,.12);border-bottom:0;border-radius:10px 10px 0 0;background:linear-gradient(180deg,rgba(30,41,59,.56),rgba(15,23,42,.72));font-size:10px;letter-spacing:.065em;text-transform:uppercase;}
    .rvm-right-panel-v2 .rvm-panel-header.rvm-right-section-header[hidden]{display:none!important;}.rvm-right-panel-v2 .rvm-panel-title{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#dbeafe;font-weight:800;}
    .rvm-right-section-badge{flex:0 0 auto;display:inline-grid;place-items:center;min-width:28px;height:17px;padding:0 5px;border-radius:999px;border:1px solid rgba(147,197,253,.24);background:rgba(59,130,246,.13);color:#bfdbfe;font-size:8.5px;font-weight:900;letter-spacing:.055em;}
    .rvm-right-section-card,.rvm-right-format-panel{margin:0 0 5px;padding:7px;border:1px solid rgba(148,163,184,.13);border-top-color:rgba(148,163,184,.08);border-radius:0 0 10px 10px;background:linear-gradient(180deg,var(--rvm-ui-card),rgba(6,12,22,.82));box-shadow:inset 0 1px 0 rgba(255,255,255,.025);}
    .rvm-right-panel-v2 #rvm-attributes-panel,.rvm-right-panel-v2 #rvm-nonprimitive-source-tools-panel,.rvm-right-panel-v2 #rvm-nonprimitive-support-details-panel,.rvm-right-panel-v2 #rvm-nonprimitive-node-marker-details-panel{margin:0 0 5px;padding:7px;border:1px solid rgba(148,163,184,.13);border-radius:0 0 10px 10px;background:linear-gradient(180deg,var(--rvm-ui-card),rgba(6,12,22,.82));}
    .rvm-right-panel-v2 .rvm-source-tools-grid--grouped{gap:6px;}.rvm-right-panel-v2 .rvm-source-tools-group{padding:6px;gap:5px;border-radius:8px;border:1px solid var(--rvm-ui-line);background:rgba(15,23,42,.54);}.rvm-right-panel-v2 .rvm-source-tools-row{min-height:19px;font-size:10.5px;}.rvm-right-panel-v2 .rvm-source-tools-actions{padding:6px;gap:5px;border-radius:8px;background:rgba(15,23,42,.48);}.rvm-right-panel-v2 .rvm-source-tools-actions button,.rvm-right-panel-v2 .rvm-source-tools-group button{min-height:22px;padding:3px 7px;font-size:10px;border-radius:6px;}
    .rvm-right-panel-v2 .rvm-source-tools-detail{padding:6px;gap:5px;border-radius:8px;border:1px solid var(--rvm-ui-line);background:rgba(15,23,42,.5);}
    .rvm-format-policy-card,.rvm-stagedjson-card,.rvm-right-ui-summary-card{display:grid;gap:6px;min-width:0;}.rvm-right-card-title{display:flex;align-items:flex-start;justify-content:space-between;gap:8px;color:#bfdbfe;font-size:11px;font-weight:850;letter-spacing:.04em;text-transform:uppercase;}.rvm-right-card-title span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}.rvm-right-card-title small{font-size:9px;color:#8fa5c7;font-weight:650;text-transform:none;letter-spacing:0;text-align:right;}
    .rvm-right-status-strip{display:flex;flex-wrap:wrap;gap:5px;}.rvm-right-status-strip span{display:inline-flex;max-width:100%;border:1px solid rgba(147,197,253,.16);border-radius:999px;padding:2px 6px;background:rgba(15,23,42,.58);color:#cbd5e1;font-size:9px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}.rvm-right-status-strip span[data-state="on"]{color:#bbf7d0;border-color:rgba(34,197,94,.32);background:rgba(22,101,52,.18);}.rvm-right-status-strip span[data-state="off"]{color:#c4b5fd;border-color:rgba(167,139,250,.24);background:rgba(76,29,149,.16);}
    .rvm-format-grid{display:grid;gap:3px;}.rvm-format-grid--compact{grid-template-columns:1fr;}.rvm-format-row{display:grid;grid-template-columns:minmax(72px,.62fr) minmax(0,1.38fr);gap:5px;padding:4px 6px;border:1px solid rgba(126,190,255,.11);border-radius:6px;background:rgba(255,255,255,.026);font-size:9.8px;}.rvm-format-row span{color:#9eb7d8;}.rvm-format-row b{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#edf6ff;font-weight:650;}
    .rvm-format-policy-chips,.rvm-format-section-list{display:flex;flex-wrap:wrap;gap:4px;}.rvm-format-policy-chip,.rvm-format-section-chip{display:inline-flex;border-radius:999px;border:1px solid rgba(148,163,184,.22);padding:2px 6px;font-size:9px;color:#cbd5e1;background:rgba(15,23,42,.62);}.rvm-format-policy-chip.is-on,.rvm-format-section-chip.is-on{color:#bbf7d0;border-color:rgba(34,197,94,.32);background:rgba(22,101,52,.18);}.rvm-format-policy-chip.is-off,.rvm-format-section-chip.is-off{color:#fca5a5;border-color:rgba(248,113,113,.25);background:rgba(127,29,29,.13);}
    .rvm-stagedjson-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:5px;}.rvm-stagedjson-kpis span{display:grid;gap:1px;padding:7px 5px;border:1px solid rgba(126,190,255,.15);border-radius:9px;background:linear-gradient(180deg,rgba(59,130,246,.1),rgba(255,255,255,.022));text-align:center;}.rvm-stagedjson-kpis b{font-size:15px;line-height:1;color:#edf6ff;}.rvm-stagedjson-kpis small{font-size:8.3px;color:#8fa5c7;text-transform:uppercase;letter-spacing:.04em;}
    .rvm-stagedjson-columns{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;}.rvm-stagedjson-columns section{min-width:0;border:1px solid rgba(126,190,255,.13);border-radius:9px;background:rgba(255,255,255,.025);padding:6px;}.rvm-stagedjson-columns h4{margin:0 0 5px;color:#bfdbfe;font-size:10.5px;}.rvm-stagedjson-columns ul{list-style:none;margin:0;padding:0;display:grid;gap:3px;}.rvm-stagedjson-columns li{display:flex;justify-content:space-between;gap:8px;color:#cbd5e1;font-size:9.8px;}.rvm-stagedjson-columns li span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}.rvm-stagedjson-columns li.is-empty{color:#64748b;}
    .rvm-format-actions,.rvm-right-action-bar{display:flex;flex-wrap:wrap;gap:5px;}.rvm-format-actions button{border:1px solid rgba(126,190,255,.3);border-radius:7px;background:#132238;color:#dbeafe;padding:5px 8px;font-size:10px;cursor:pointer;}.rvm-format-actions button.is-secondary{opacity:.78;background:#101827;border-color:rgba(148,163,184,.2);}.rvm-format-actions button:hover{border-color:rgba(147,197,253,.52);background:#1b2f4c;}
    .rvm-right-empty-state{border:1px dashed rgba(148,163,184,.24);border-radius:9px;padding:8px;color:#94a3b8;background:rgba(15,23,42,.42);font-size:10.5px;}
    @media(max-width:1150px){.rvm-stagedjson-columns,.rvm-stagedjson-kpis{grid-template-columns:1fr 1fr;}.rvm-right-panel.rvm-right-panel-v2{gap:5px;padding:5px;}}
  `;
  doc.head?.appendChild?.(style);
}

export function installRvmRightPanelFormatPolicyBridge() {
  if (typeof document === 'undefined') return null;
  if (globalThis[INSTALL_FLAG] && globalThis[GLOBAL_KEY]) return globalThis[GLOBAL_KEY];
  globalThis[INSTALL_FLAG] = true;
  installStyles();
  const api = { schema: RVM_RIGHT_PANEL_FORMAT_POLICY_SCHEMA, version: VERSION, previousVersion: PREVIOUS_VERSION, render, resolve: resolveRvmFormatContext };
  globalThis[GLOBAL_KEY] = api;
  document.addEventListener('click', handleClick, true);
  globalThis.addEventListener?.('rvm-model-loaded', () => setTimeout(() => render(), 120));
  globalThis.addEventListener?.('rvm-node-selected', () => setTimeout(() => render(), 0));
  globalThis.addEventListener?.('rvm-nonprimitive-support-details-selected', () => setTimeout(() => render(), 0));
  setTimeout(() => render(), 0);
  setTimeout(() => render(), 500);
  return api;
}
