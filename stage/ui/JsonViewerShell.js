import { iconSvg } from './JsonViewerToolIcons.js';

/**
 * Builds the Stage JSON viewer UI shell.
 * Parameters: the tab root element that owns the viewer DOM.
 * Outputs: stable DOM handles for file loading, command routing, panels, and status updates.
 * Fallback: controls stay visible even before a model is loaded; actions report status in the renderer.
 */

const QUALITY_LABELS = [['full', 'Full'], ['medium', 'Medium'], ['light', 'Light'], ['skeleton', 'Skeleton'], ['hidden', 'Hidden']];

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function button(className, text, action) {
  const node = el('button', className, text);
  node.type = 'button';
  if (action) node.dataset.action = action;
  return node;
}

function iconButton(icon, label, action, title) {
  const node = button('json-viewer-tool-btn', '', action);
  node.title = title;
  node.setAttribute('aria-label', title);
  node.innerHTML = `<span class="json-viewer-tool-icon">${iconSvg(icon)}</span><span>${label}</span>`;
  return node;
}

function statusChip(text) {
  const node = el('span', 'json-viewer-status-chip', text);
  return node;
}

function addOptions(select) {
  for (const [value, text] of QUALITY_LABELS) {
    const option = el('option', '', text);
    option.value = value;
    select.appendChild(option);
  }
}

function commandGroup(label, buttons) {
  const group = el('section', 'json-viewer-command-group');
  group.setAttribute('aria-label', `${label} tools`);
  group.append(el('span', 'json-viewer-command-label', label));
  const row = el('div', 'json-viewer-command-buttons');
  row.append(...buttons);
  group.append(row);
  return group;
}

function filterButton(label, filter, active) {
  const node = button(`json-viewer-filter-chip${active ? ' is-active' : ''}`, label, '');
  node.dataset.componentFilter = filter;
  return node;
}

export function createJsonViewerShell(root) {
  root.classList.add('json-viewer-tab-root');
  const shell = el('section', 'json-viewer-shell json-viewer-shell-revamp', '');
  shell.setAttribute('aria-label', '3D Json Viewer');

  const toolbar = el('header', 'json-viewer-toolbar', '');
  const openStageButton = button('json-viewer-button is-primary', 'Open Stage JSON', 'open-stage-json');
  const loadSampleButton = button('json-viewer-button', 'Load Sample', 'load-sample');
  const fileInput = el('input', 'json-viewer-file-input', '');
  fileInput.type = 'file'; fileInput.accept = '.json,application/json'; fileInput.hidden = true;
  const openRvmButton = button('json-viewer-button', 'Open RVM', 'open-rvm');
  const rvmFileInput = el('input', 'json-viewer-file-input', '');
  rvmFileInput.type = 'file'; rvmFileInput.accept = '.rvm'; rvmFileInput.hidden = true;
  const tagFileInput = el('input', 'json-viewer-file-input', '');
  tagFileInput.type = 'file'; tagFileInput.accept = '.xml,text/xml,application/xml'; tagFileInput.hidden = true;
  const downloadButton = button('json-viewer-button', 'Download RvmStageModel JSON', 'download-stage-model');
  downloadButton.disabled = true;
  const qualityLabel = el('label', 'json-viewer-quality-label', 'Render Quality');
  const qualitySelect = el('select', 'json-viewer-quality-select', '');
  qualitySelect.dataset.action = 'render-quality'; addOptions(qualitySelect); qualityLabel.appendChild(qualitySelect);
  const diagnosticsButton = button('json-viewer-button', 'Diagnostics', 'show-diagnostics');
  toolbar.append(openStageButton, loadSampleButton, fileInput, openRvmButton, rvmFileInput, tagFileInput, downloadButton, qualityLabel, diagnosticsButton);

  const navRow = el('div', 'json-viewer-tool-row json-viewer-command-ribbon', '');
  const selectToolButton = iconButton('select', 'Select', 'tool-select', 'Select objects');
  const boxSelectButton = iconButton('boxSelect', 'Box Sel', 'tool-box-select', 'Box select objects');
  const orbitToolButton = iconButton('orbit', 'Orbit', 'tool-orbit', 'Orbit camera');
  const panToolButton = iconButton('pan', 'Pan', 'tool-pan', 'Pan camera');
  const undoButton = iconButton('undo', 'Undo', 'undo', 'Undo last viewer command');
  const redoButton = iconButton('redo', 'Redo', 'redo', 'Redo viewer command');
  const fitButton = iconButton('fit', 'Fit', 'fit', 'Fit all');
  const fitSelectionButton = iconButton('fit', 'Fit Sel', 'fit-selection', 'Fit selected object');
  const isoViewButton = iconButton('orbit', 'ISO', 'view-iso', 'Isometric view');
  const topViewButton = iconButton('top', 'Top', 'view-top', 'Top view');
  const frontViewButton = iconButton('top', 'Front', 'view-front', 'Front view');
  const sideViewButton = iconButton('top', 'Side', 'view-side', 'Side view');
  const hideButton = iconButton('hide', 'Hide', 'hide-selection', 'Hide selected');
  const unhideButton = iconButton('show', 'Unhide', 'unhide-selection', 'Unhide selected');
  const showAllButton = iconButton('show', 'Show All', 'show-all', 'Show all hidden geometry');
  const isolateButton = iconButton('isolate', 'Isolate', 'isolate-selection', 'Show only selected');
  const clearSelectionButton = iconButton('clear', 'Clear Sel', 'clear-selection', 'Clear selection');
  const clipSelectionButton = iconButton('box', 'Sel Box', 'clip-box-selection', 'Clip box from selection');
  const clipModelButton = iconButton('box', 'Model Box', 'clip-box-model', 'Clip box from visible model');
  const clipPlaneButton = iconButton('plane', 'Plane', 'clip-plane', 'Apply clip plane');
  const clipClearButton = iconButton('clear', 'Clip Off', 'clip-clear', 'Clear clipping');
  const tagCreateButton = iconButton('tag', 'Tag', 'tag-create', 'Create two-click tag');
  const tagViewButton = iconButton('view', 'View', 'tag-view', 'Open tag panel');
  const tagHideAllButton = iconButton('hide', 'Hide Tags', 'tag-hide-all', 'Hide all tag labels');
  const tagShowAllButton = iconButton('show', 'Show Tags', 'tag-show-all', 'Show all tag labels');
  const tagImportButton = iconButton('open', 'Import', 'tag-import', 'Import tag XML');
  const tagExportButton = iconButton('export', 'Export', 'tag-export', 'Export tag XML');
  const enrichButton = iconButton('enrich', 'E Work', 'enrich-open', 'Open selected geometry enrichment workflow');
  const exportModelButton = iconButton('export', 'Model', 'export-stage', 'Export StageModel JSON');
  const exportSelectionButton = iconButton('export', 'Sel JSON', 'export-selection', 'Export selected geometry JSON');
  const exportSnapshotButton = iconButton('snapshot', 'Image', 'export-snapshot', 'Export viewport snapshot');
  const marqueeZoomButton = iconButton('fit', 'Marquee', 'tool-marquee', 'Marquee zoom');
  const measureToolButton = iconButton('axis', 'Measure', 'tool-measure', 'Measure distance');
  const measureReadout = el('span', 'json-viewer-measure-readout', ''); measureReadout.hidden = true;
  navRow.append(
    commandGroup('Navigate', [selectToolButton, boxSelectButton, orbitToolButton, panToolButton, fitButton, fitSelectionButton, marqueeZoomButton, measureToolButton]),
    commandGroup('History', [undoButton, redoButton]),
    commandGroup('Views', [isoViewButton, topViewButton, frontViewButton, sideViewButton]),
    commandGroup('Visibility', [hideButton, unhideButton, showAllButton, isolateButton, clearSelectionButton]),
    commandGroup('Clip', [clipSelectionButton, clipModelButton, clipPlaneButton, clipClearButton]),
    commandGroup('Tags', [tagCreateButton, tagViewButton, tagHideAllButton, tagShowAllButton, tagImportButton, tagExportButton]),
    commandGroup('Enrich', [enrichButton]),
    commandGroup('Exports', [exportModelButton, exportSelectionButton, exportSnapshotButton]),
    measureReadout,
  );

  const body = el('div', 'json-viewer-body', '');
  const leftPanel = el('aside', 'json-viewer-left-panel json-viewer-component-panel', '');
  const leftHeader = el('div', 'json-viewer-panel-head', '');
  const leftCollapseButton = iconButton('collapse', 'Left', 'toggle-left-panel', 'Collapse component panel');
  leftCollapseButton.classList.add('json-viewer-panel-collapse');
  leftHeader.append(el('h2', 'json-viewer-panel-title', 'Components'), leftCollapseButton);
  leftPanel.append(leftHeader);
  const treeFilterInput = el('input', 'json-viewer-tree-filter', '');
  treeFilterInput.type = 'search'; treeFilterInput.placeholder = 'Search components, nodes, tags...';
  const componentFilters = el('div', 'json-viewer-filter-row', '');
  componentFilters.append(filterButton('All', 'all', true), filterButton('Components', 'components', false), filterButton('Hidden', 'hidden', false), filterButton('Tagged', 'tagged', false), filterButton('Selected', 'selected', false));
  const hiddenList = el('div', 'json-viewer-hidden-list', '');
  const hierarchyList = el('div', 'json-viewer-hierarchy-list', ''); hierarchyList.setAttribute('role', 'tree');
  const leftResize = el('div', 'json-viewer-panel-resizer is-left', '');
  leftResize.dataset.panelResize = 'left';
  leftPanel.append(treeFilterInput, componentFilters, hiddenList, hierarchyList, leftResize);

  const centerPanel = el('main', 'json-viewer-center-panel', '');
  const canvasHost = el('div', 'json-viewer-canvas-host', '');
  canvasHost.setAttribute('aria-label', '3D canvas host placeholder');
  const canvasMessage = el('div', 'json-viewer-canvas-message', ''); canvasHost.appendChild(canvasMessage);
  const axisHud = el('div', 'json-viewer-axis-hud', '');
  axisHud.setAttribute('aria-label', 'Viewport axis');
  axisHud.innerHTML = '<span class="axis-z">Z</span><span class="axis-y">Y</span><span class="axis-x">X</span>';
  canvasHost.appendChild(axisHud);
  centerPanel.append(canvasHost);

  const rightPanel = el('aside', 'json-viewer-right-panel', '');
  const tabs = el('div', 'json-viewer-right-tabs', '');
  const propertiesTab = button('json-viewer-right-tab is-active', 'Properties', 'right-properties'); propertiesTab.dataset.panel = 'properties';
  const tagsTab = button('json-viewer-right-tab', 'Tags', 'right-tags'); tagsTab.dataset.panel = 'tags';
  const clipTab = button('json-viewer-right-tab', 'Clip', 'right-clip'); clipTab.dataset.panel = 'clip';
  const diagnosticsTab = button('json-viewer-right-tab', 'Diagnostics', 'right-diagnostics'); diagnosticsTab.dataset.panel = 'diagnostics';
  const rightCollapseButton = iconButton('collapse', 'Right', 'toggle-right-panel', 'Collapse detail panel');
  rightCollapseButton.classList.add('json-viewer-panel-collapse');
  tabs.append(propertiesTab, tagsTab, clipTab, diagnosticsTab, rightCollapseButton);
  const propertiesPanel = el('div', 'json-viewer-properties-panel', '');
  const tagsPanel = el('div', 'json-viewer-tags-panel', '');
  const clipPanel = el('div', 'json-viewer-clip-panel', '');
  const diagnosticsPanel = el('div', 'json-viewer-diagnostics-panel', '');
  const rightResize = el('div', 'json-viewer-panel-resizer is-right', '');
  rightResize.dataset.panelResize = 'right';
  rightPanel.append(tabs, propertiesPanel, tagsPanel, clipPanel, diagnosticsPanel, rightResize);
  body.append(leftPanel, centerPanel, rightPanel);
  const enrichmentPanel = el('div', 'json-viewer-enrichment-panel', '');
  enrichmentPanel.hidden = true;

  const evidenceDetails = el('details', 'json-viewer-evidence-details', '');
  const evidenceSummaryToggle = el('summary', 'json-viewer-evidence-toggle', 'StageModel Summary & Primitive Code Coverage');
  const evidencePanel = el('section', 'json-viewer-evidence-panel', '');
  const summaryPanel = el('div', 'json-viewer-summary-panel', '');
  const coveragePanel = el('div', 'json-viewer-coverage-panel', '');
  evidencePanel.append(summaryPanel, coveragePanel); evidenceDetails.append(evidenceSummaryToggle, evidencePanel);

  const status = el('footer', 'json-viewer-status-strip', '');
  const statusText = el('span', 'json-viewer-status-text', 'Ready');
  const selectedText = statusChip('selected: none'), objectsText = statusChip('objects: 0'), visibleText = statusChip('visible: 0'), hiddenText = statusChip('hidden: 0'), clipText = statusChip('clip: off'), tagText = statusChip('tags: 0'), coordText = statusChip('XYZ: -'), unitsText = statusChip('units: mm');
  const schemaText = statusChip(''), sourceText = statusChip(''), nodeText = statusChip(''), componentText = statusChip(''), primitiveText = statusChip('');
  const decodedText = statusChip(''), unsupportedText = statusChip(''), failedText = statusChip(''), diagnosticsText = statusChip(''), qualityText = statusChip(''), planEntryText = statusChip(''), planDiagnosticText = statusChip('');
  status.append(statusText, selectedText, objectsText, visibleText, hiddenText, clipText, tagText, coordText, unitsText, schemaText, sourceText, nodeText, componentText, primitiveText, decodedText, unsupportedText, failedText, diagnosticsText, qualityText, planEntryText, planDiagnosticText);
  shell.append(toolbar, navRow, body, enrichmentPanel, evidenceDetails, status); root.replaceChildren(shell);

  return { shell, toolbar, navRow, body, leftPanel, rightPanel, fileInput, rvmFileInput, tagFileInput, downloadButton, qualitySelect, diagnosticsButton, hierarchyList, treeFilterInput, hiddenList, summaryPanel, coveragePanel, canvasHost, canvasMessage, axisHud, enrichmentPanel, propertiesTab, tagsTab, clipTab, diagnosticsTab, propertiesPanel, tagsPanel, clipPanel, diagnosticsPanel, statusText, schemaText, sourceText, nodeText, primitiveText, decodedText, unsupportedText, failedText, componentText, diagnosticsText, qualityText, planEntryText, planDiagnosticText, selectToolButton, boxSelectButton, orbitToolButton, panToolButton, undoButton, redoButton, fitButton, fitSelectionButton, isoViewButton, topViewButton, frontViewButton, sideViewButton, hideButton, unhideButton, showAllButton, isolateButton, clipSelectionButton, clipModelButton, clipPlaneButton, clipClearButton, tagCreateButton, tagViewButton, tagHideAllButton, tagShowAllButton, tagImportButton, tagExportButton, enrichButton, exportModelButton, exportSelectionButton, exportSnapshotButton, marqueeZoomButton, measureToolButton, measureReadout, selectedText, objectsText, visibleText, hiddenText, clipText, tagText, coordText, unitsText };
}
