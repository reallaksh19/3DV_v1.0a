import { normalizeRenderQuality } from '../contracts/RvmStageModelContract.js';

/**
 * Functionality: creates the large-model load planner used by the 3D Json Viewer before
 * the full render plan is built. Parameters: a StageModel plus explicit quality options.
 * Outputs: render-plan-ready quality overrides keyed as node:/component:/primitive: refs.
 * Fallback: collapsed or shallow hierarchy models use spatial area rows derived from
 * primitive bounding boxes so rectangle selection still has useful targets.
 */

const QUALITY_OPTIONS = Object.freeze(['full', 'medium', 'light', 'skeleton', 'hidden']);
const QUALITY_LABELS = Object.freeze({
  full: 'Full',
  medium: 'Medium',
  light: 'Light',
  skeleton: 'Skeleton',
  hidden: 'Hidden',
});
const VIEW_AXES = Object.freeze({
  xy: { label: 'Top', axisX: 0, axisY: 1 },
});
const DEFAULT_MAX_SPATIAL_ROWS = 64;
const DEFAULT_TILE_TARGET_PRIMITIVES = 120;

export async function showJsonViewerZoneDensitySelector(model, options) {
  const plan = createJsonViewerZoneDensityPlan(model, options);
  if (typeof document === 'undefined') {
    return createJsonViewerZoneDensityResult(plan, {
      defaultQuality: plan.initialQuality,
      selectedQuality: plan.selectedQuality,
      selectedRowIds: [],
      qualityByRowId: {},
    });
  }
  return new Promise((resolve) => {
    const previousFocus = document.activeElement;
    const state = createDialogState(plan);
    const root = createBackdrop();
    const dialog = createDialog(plan);
    const header = createHeader(plan);
    const main = document.createElement('div');
    main.className = 'json-zone-main';
    applyStyle(main, {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
      gap: '14px',
      minHeight: '0',
      flex: '1',
      overflow: 'auto',
    });

    const preview = createPreviewPanel(plan, state);
    const rowsPanel = createRowsPanel(plan, state);
    main.append(preview.panel, rowsPanel.panel);

    const footer = createFooter(plan, state, close);
    dialog.append(header, main, footer.footer);
    root.appendChild(dialog);
    document.body.appendChild(root);

    state.canvas = preview.canvas;
    state.selectedCount = rowsPanel.selectedCount;
    state.tableBody = rowsPanel.tableBody;
    state.outsideSelect = footer.outsideSelect;
    state.applyButton = footer.applyButton;
    state.close = close;
    bindDialogEvents(root, dialog, plan, state, close);
    renderRows(plan, state);
    drawPreview(plan, state);
    dialog.focus();

    function close(result) {
      root.remove();
      previousFocus?.focus?.();
      resolve(result);
    }
  });
}

export function createJsonViewerZoneDensityPlan(model, options) {
  const resolved = selectorOptions(options);
  const primitiveIndex = createPrimitiveIndex(model);
  const hierarchyRows = buildHierarchyRows(model, primitiveIndex);
  const spatialRows = shouldUseSpatialRows(hierarchyRows, primitiveIndex.primitives, resolved)
    ? buildSpatialRows(primitiveIndex.primitives, resolved)
    : [];
  const rows = spatialRows.length ? spatialRows : hierarchyRows;
  const bboxWorld = aggregateBboxes(rows.map((row) => row.bboxWorld)) || aggregateBboxes(primitiveIndex.primitives.map(primitiveBbox));
  return {
    schema: 'JsonViewerZoneDensityPlan.v1',
    sourceMode: spatialRows.length ? 'spatial-area' : 'hierarchy-zone',
    rootId: model?.hierarchy?.rootId || 'node-root',
    primitiveCount: primitiveIndex.primitives.length,
    rowCount: rows.length,
    rows,
    bboxWorld,
    initialQuality: resolved.outsideQuality,
    selectedQuality: resolved.selectedQuality,
  };
}

export function createJsonViewerZoneDensityResult(plan, input) {
  const selectedRowIds = new Set(Array.isArray(input?.selectedRowIds) ? input.selectedRowIds : []);
  const qualityByRowId = input?.qualityByRowId && typeof input.qualityByRowId === 'object' ? input.qualityByRowId : {};
  const defaultQuality = normalizeRenderQuality(input?.defaultQuality || plan?.initialQuality || 'full');
  const selectedQuality = normalizeRenderQuality(input?.selectedQuality || plan?.selectedQuality || 'full');
  const qualityOverrides = {};
  const selectedNodeIds = [];
  const selectedPrimitiveIds = new Set();

  for (const row of plan?.rows || []) {
    const rowQuality = normalizeRenderQuality(qualityByRowId[row.id] || (selectedRowIds.has(row.id) ? selectedQuality : defaultQuality));
    if (selectedRowIds.has(row.id) && row.ref?.type === 'node') selectedNodeIds.push(row.ref.id);
    if (selectedRowIds.has(row.id)) for (const primitiveId of row.primitiveIds || []) selectedPrimitiveIds.add(primitiveId);
    if (rowQuality === defaultQuality) continue;
    addRowQualityOverride(qualityOverrides, row, rowQuality);
  }

  return {
    quality: defaultQuality,
    qualityOverrides,
    selection: {
      sourceMode: plan?.sourceMode || 'none',
      selectedRowIds: Array.from(selectedRowIds),
      selectedNodeIds,
      selectedPrimitiveCount: selectedPrimitiveIds.size,
    },
  };
}

function selectorOptions(options) {
  const source = typeof options === 'string' ? { defaultQuality: options } : (options && typeof options === 'object' ? options : {});
  const defaultQuality = normalizeRenderQuality(source.defaultQuality || 'full');
  return {
    defaultQuality,
    outsideQuality: normalizeRenderQuality(source.outsideQuality || (defaultQuality === 'full' ? 'light' : defaultQuality)),
    selectedQuality: normalizeRenderQuality(source.selectedQuality || 'full'),
    maxSpatialRows: positiveInteger(source.maxSpatialRows, DEFAULT_MAX_SPATIAL_ROWS),
    tileTargetPrimitives: positiveInteger(source.tileTargetPrimitives, DEFAULT_TILE_TARGET_PRIMITIVES),
    minHierarchyRows: positiveInteger(source.minHierarchyRows, 2),
  };
}

function createPrimitiveIndex(model) {
  const primitives = Array.isArray(model?.primitives) ? model.primitives.filter((primitive) => primitive?.id) : [];
  const primitiveById = new Map(primitives.map((primitive) => [primitive.id, primitive]));
  const primitiveIdsByNode = new Map();
  for (const primitive of primitives) {
    if (!primitive.nodeId) continue;
    pushMapValue(primitiveIdsByNode, primitive.nodeId, primitive.id);
  }
  return { primitives, primitiveById, primitiveIdsByNode };
}

function buildHierarchyRows(model, primitiveIndex) {
  const nodes = Array.isArray(model?.hierarchy?.nodes) ? model.hierarchy.nodes.filter((node) => node?.id) : [];
  if (!nodes.length) return [];
  const rootId = model?.hierarchy?.rootId || 'node-root';
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const childrenByParent = new Map();
  for (const node of nodes) if (node.parentId) pushMapValue(childrenByParent, node.parentId, node.id);
  const candidates = topHierarchyNodes(nodes, rootId);
  return candidates.map((node) => hierarchyRow(node, nodeById, childrenByParent, primitiveIndex)).filter(Boolean);
}

function topHierarchyNodes(nodes, rootId) {
  const direct = nodes.filter((node) => node.id !== rootId && (node.parentId === rootId || (!node.parentId && node.id !== rootId)));
  if (direct.length) return direct.sort(sortRowsByLabel);
  const depths = nodes.filter((node) => node.id !== rootId).map((node) => Number.isFinite(Number(node.depth)) ? Number(node.depth) : null).filter((depth) => depth !== null);
  const minDepth = depths.length ? Math.min(...depths) : null;
  if (minDepth !== null) return nodes.filter((node) => node.id !== rootId && Number(node.depth) === minDepth).sort(sortRowsByLabel);
  return nodes.filter((node) => node.id !== rootId).sort(sortRowsByLabel);
}

function hierarchyRow(node, nodeById, childrenByParent, primitiveIndex) {
  const primitiveIds = collectNodePrimitiveIds(node.id, nodeById, childrenByParent, primitiveIndex);
  const bboxWorld = isBbox(node.bboxWorld) ? node.bboxWorld : aggregateBboxes(primitiveIds.map((id) => primitiveBbox(primitiveIndex.primitiveById.get(id))));
  if (!isBbox(bboxWorld) && !primitiveIds.length) return null;
  return {
    id: `node:${node.id}`,
    ref: { type: 'node', id: node.id },
    sourceType: 'node',
    label: node.name || node.path || node.id,
    path: node.path || node.name || node.id,
    primitiveIds,
    primitiveCount: primitiveIds.length,
    bboxWorld,
  };
}

function collectNodePrimitiveIds(nodeId, nodeById, childrenByParent, primitiveIndex) {
  const ids = new Set();
  const stack = [nodeId];
  const seen = new Set();
  while (stack.length) {
    const current = stack.pop();
    if (!current || seen.has(current)) continue;
    seen.add(current);
    const node = nodeById.get(current);
    for (const primitiveId of primitiveIndex.primitiveIdsByNode.get(current) || []) ids.add(primitiveId);
    for (const primitiveId of Array.isArray(node?.primitiveIds) ? node.primitiveIds : []) {
      if (primitiveIndex.primitiveById.has(primitiveId)) ids.add(primitiveId);
    }
    for (const childId of childrenByParent.get(current) || []) stack.push(childId);
  }
  return Array.from(ids);
}

function shouldUseSpatialRows(hierarchyRows, primitives, options) {
  if (!primitives.length) return false;
  if (hierarchyRows.length < options.minHierarchyRows) return true;
  return hierarchyRows.length === 1 && hierarchyRows[0].primitiveCount > options.tileTargetPrimitives;
}

function buildSpatialRows(primitives, options) {
  const source = primitives.map((primitive) => ({ primitive, bbox: primitiveBbox(primitive) })).filter((item) => isBbox(item.bbox));
  const modelBbox = aggregateBboxes(source.map((item) => item.bbox));
  if (!isBbox(modelBbox)) return [];
  const grid = spatialGridSize(source.length, options);
  const cells = new Map();
  for (const item of source) {
    const center = bboxCenter(item.bbox);
    const col = gridIndex(center[0], modelBbox[0], modelBbox[3], grid.cols);
    const row = gridIndex(center[1], modelBbox[1], modelBbox[4], grid.rows);
    const key = `${row}:${col}`;
    if (!cells.has(key)) cells.set(key, { row, col, primitiveIds: [], bboxes: [] });
    const cell = cells.get(key);
    cell.primitiveIds.push(item.primitive.id);
    cell.bboxes.push(item.bbox);
  }
  return Array.from(cells.values()).map((cell) => {
    const bboxWorld = aggregateBboxes(cell.bboxes);
    return {
      id: `area:${cell.row + 1}:${cell.col + 1}`,
      ref: { type: 'area', id: `area-${cell.row + 1}-${cell.col + 1}` },
      sourceType: 'area',
      label: `Area ${cell.row + 1}.${cell.col + 1}`,
      path: areaPath(bboxWorld),
      primitiveIds: cell.primitiveIds,
      primitiveCount: cell.primitiveIds.length,
      bboxWorld,
    };
  }).sort((a, b) => b.primitiveCount - a.primitiveCount || a.label.localeCompare(b.label));
}

function spatialGridSize(count, options) {
  const targetCells = Math.min(options.maxSpatialRows, Math.max(4, Math.ceil(count / options.tileTargetPrimitives)));
  const cols = Math.max(2, Math.ceil(Math.sqrt(targetCells)));
  const rows = Math.max(2, Math.ceil(targetCells / cols));
  return { rows, cols };
}

function addRowQualityOverride(target, row, quality) {
  if (row.ref?.type === 'node') {
    target[`node:${row.ref.id}`] = quality;
    return;
  }
  if (row.ref?.type === 'component') {
    target[`component:${row.ref.id}`] = quality;
    return;
  }
  for (const primitiveId of row.primitiveIds || []) target[`primitive:${primitiveId}`] = quality;
}

function createDialogState(plan) {
  const selectedRowIds = new Set();
  const qualityByRowId = {};
  for (const row of plan.rows) qualityByRowId[row.id] = plan.initialQuality;
  return {
    selectedRowIds,
    qualityByRowId,
    viewMode: 'xy',
    drag: null,
    canvas: null,
    tableBody: null,
    selectedCount: null,
    outsideSelect: null,
    applyButton: null,
    close: null,
  };
}

function createBackdrop() {
  const root = document.createElement('div');
  root.className = 'json-viewer-modal-backdrop';
  applyStyle(root, {
    position: 'fixed',
    inset: '0',
    backgroundColor: 'rgba(2, 6, 23, .76)',
    zIndex: '9999',
    display: 'grid',
    placeItems: 'center',
    fontFamily: 'system-ui, sans-serif',
  });
  return root;
}

function createDialog(plan) {
  const dialog = document.createElement('section');
  dialog.className = 'json-viewer-modal-dialog';
  dialog.tabIndex = -1;
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  dialog.setAttribute('aria-labelledby', 'json-zone-density-title');
  applyStyle(dialog, {
    width: 'min(1120px, calc(100vw - 28px))',
    height: 'min(760px, calc(100vh - 28px))',
    backgroundColor: '#0f172a',
    color: '#e2e8f0',
    border: '1px solid #26364f',
    borderRadius: '8px',
    boxShadow: '0 24px 80px rgba(0, 0, 0, .55)',
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
    padding: '16px',
  });
  if (!plan.rows.length) dialog.dataset.empty = 'true';
  return dialog;
}

function createHeader(plan) {
  const header = document.createElement('header');
  applyStyle(header, { display: 'flex', justifyContent: 'space-between', gap: '14px', alignItems: 'flex-start' });
  const text = document.createElement('div');
  const title = document.createElement('h2');
  title.id = 'json-zone-density-title';
  title.textContent = 'Select Load Area';
  applyStyle(title, { margin: '0', fontSize: '18px', color: '#f8fafc' });
  const meta = document.createElement('p');
  meta.textContent = `${plan.primitiveCount.toLocaleString()} primitives - ${plan.rowCount.toLocaleString()} ${plan.sourceMode === 'spatial-area' ? 'preview areas' : 'zones'}`;
  applyStyle(meta, { margin: '4px 0 0', color: '#9fb2cc', fontSize: '12px' });
  text.append(title, meta);
  const badge = document.createElement('span');
  badge.textContent = plan.sourceMode === 'spatial-area' ? 'Spatial preview' : 'Hierarchy preview';
  applyStyle(badge, {
    border: '1px solid #315176',
    borderRadius: '999px',
    padding: '5px 9px',
    color: '#bfdbfe',
    backgroundColor: '#0b2442',
    fontSize: '12px',
    fontWeight: '700',
  });
  header.append(text, badge);
  return header;
}

function createPreviewPanel(plan, state) {
  const panel = document.createElement('section');
  applyStyle(panel, { minHeight: '0', display: 'flex', flexDirection: 'column', gap: '10px' });
  const toolbar = document.createElement('div');
  applyStyle(toolbar, { display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' });
  const planBadge = document.createElement('span');
  planBadge.textContent = 'Plan EW/NS';
  applyStyle(planBadge, {
    border: '1px solid #315176',
    borderRadius: '999px',
    padding: '6px 9px',
    color: '#bfdbfe',
    backgroundColor: '#0b2442',
    fontSize: '12px',
    fontWeight: '700',
  });
  const clear = toolButton('Clear Box');
  clear.addEventListener('click', () => {
    state.selectedRowIds.clear();
    setAllRowQualities(plan, state, state.outsideSelect?.value || plan.initialQuality);
    renderRows(plan, state);
    drawPreview(plan, state);
  });
  const all = toolButton('All Full');
  all.addEventListener('click', () => {
    state.selectedRowIds.clear();
    for (const row of plan.rows) state.qualityByRowId[row.id] = 'full';
    if (state.outsideSelect) state.outsideSelect.value = 'full';
    renderRows(plan, state);
    drawPreview(plan, state);
  });
  toolbar.append(planBadge, clear, all);

  const canvasWrap = document.createElement('div');
  applyStyle(canvasWrap, {
    position: 'relative',
    flex: '1',
    minHeight: '320px',
    border: '1px solid #27405f',
    borderRadius: '6px',
    backgroundColor: '#020617',
    overflow: 'hidden',
  });
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-label', 'Zone preview rectangle selector');
  applyStyle(canvas, { display: 'block', width: '100%', height: '100%', cursor: 'crosshair' });
  canvasWrap.appendChild(canvas);
  panel.append(toolbar, canvasWrap);
  return { panel, canvas };
}

function createRowsPanel(plan, state) {
  const panel = document.createElement('section');
  applyStyle(panel, {
    minHeight: '0',
    border: '1px solid #26364f',
    borderRadius: '6px',
    backgroundColor: '#0b1220',
    display: 'flex',
    flexDirection: 'column',
  });
  const head = document.createElement('div');
  applyStyle(head, { display: 'flex', justifyContent: 'space-between', gap: '8px', padding: '9px 10px', borderBottom: '1px solid #26364f' });
  const label = document.createElement('strong');
  label.textContent = 'Zones';
  applyStyle(label, { color: '#dbeafe', fontSize: '13px' });
  const selectedCount = document.createElement('span');
  applyStyle(selectedCount, { color: '#93c5fd', fontSize: '12px' });
  head.append(label, selectedCount);
  const tableWrap = document.createElement('div');
  applyStyle(tableWrap, { overflow: 'auto', minHeight: '0', flex: '1' });
  const table = document.createElement('table');
  applyStyle(table, { width: '100%', borderCollapse: 'collapse', fontSize: '12px' });
  table.innerHTML = '<thead><tr><th></th><th>Area</th><th>Prims</th><th>Quality</th></tr></thead>';
  const tableBody = document.createElement('tbody');
  table.appendChild(tableBody);
  tableWrap.appendChild(table);
  panel.append(head, tableWrap);
  return { panel, selectedCount, tableBody };
}

function createFooter(plan, state, close) {
  const footer = document.createElement('footer');
  applyStyle(footer, { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' });
  const policy = document.createElement('div');
  applyStyle(policy, { display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' });
  const outsideLabel = document.createElement('label');
  outsideLabel.textContent = 'Outside';
  applyStyle(outsideLabel, { display: 'flex', alignItems: 'center', gap: '6px', color: '#9fb2cc', fontSize: '12px' });
  const outsideSelect = qualitySelect(plan.initialQuality);
  outsideSelect.addEventListener('change', () => {
    for (const row of plan.rows) if (!state.selectedRowIds.has(row.id)) state.qualityByRowId[row.id] = outsideSelect.value;
    renderRows(plan, state);
    drawPreview(plan, state);
  });
  outsideLabel.appendChild(outsideSelect);
  const selectedFull = toolButton('Inside Full');
  selectedFull.addEventListener('click', () => {
    for (const rowId of state.selectedRowIds) state.qualityByRowId[rowId] = 'full';
    renderRows(plan, state);
    drawPreview(plan, state);
  });
  policy.append(outsideLabel, selectedFull);

  const actions = document.createElement('div');
  applyStyle(actions, { display: 'flex', justifyContent: 'flex-end', gap: '10px' });
  const cancel = actionButton('Cancel', false);
  cancel.addEventListener('click', () => close({ quality: plan.selectedQuality, qualityOverrides: {}, selection: { cancelled: true } }));
  const apply = actionButton('Apply & Load', true);
  apply.addEventListener('click', () => close(createJsonViewerZoneDensityResult(plan, {
    defaultQuality: outsideSelect.value,
    selectedQuality: plan.selectedQuality,
    selectedRowIds: Array.from(state.selectedRowIds),
    qualityByRowId: state.qualityByRowId,
  })));
  actions.append(cancel, apply);
  footer.append(policy, actions);
  return { footer, outsideSelect, applyButton: apply };
}

function bindDialogEvents(root, dialog, plan, state, close) {
  root.addEventListener('click', (event) => { if (event.target === root) close({ quality: plan.selectedQuality, qualityOverrides: {}, selection: { cancelled: true } }); });
  dialog.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') close({ quality: plan.selectedQuality, qualityOverrides: {}, selection: { cancelled: true } });
  });
  const canvas = state.canvas;
  const start = (event) => {
    if (!plan.rows.length) return;
    event.preventDefault();
    const point = canvasPoint(canvas, event);
    state.drag = { start: point, end: point };
    canvas.setPointerCapture?.(event.pointerId);
    drawPreview(plan, state);
  };
  const move = (event) => {
    if (!state.drag) return;
    state.drag.end = canvasPoint(canvas, event);
    drawPreview(plan, state);
  };
  const end = (event) => {
    if (!state.drag) return;
    state.drag.end = canvasPoint(canvas, event);
    const selected = rowsInsideRect(plan, state, dragRect(state.drag));
    state.selectedRowIds = new Set(selected.map((row) => row.id));
    setAllRowQualities(plan, state, state.outsideSelect?.value || plan.initialQuality);
    for (const row of selected) state.qualityByRowId[row.id] = plan.selectedQuality;
    state.drag = null;
    renderRows(plan, state);
    drawPreview(plan, state);
  };
  canvas.addEventListener('pointerdown', start);
  canvas.addEventListener('pointermove', move);
  canvas.addEventListener('pointerup', end);
  window.addEventListener('resize', () => drawPreview(plan, state), { passive: true });
}

function renderRows(plan, state) {
  if (!state.tableBody) return;
  state.tableBody.replaceChildren();
  if (!plan.rows.length) {
    const row = document.createElement('tr');
    const cell = document.createElement('td');
    cell.colSpan = 4;
    cell.textContent = 'No selectable bounds found.';
    applyStyle(cell, { padding: '18px', textAlign: 'center', color: '#64748b' });
    row.appendChild(cell);
    state.tableBody.appendChild(row);
    updateSelectedCount(plan, state);
    return;
  }
  for (const row of plan.rows) state.tableBody.appendChild(createTableRow(row, plan, state));
  updateSelectedCount(plan, state);
}

function createTableRow(row, plan, state) {
  const tr = document.createElement('tr');
  tr.dataset.rowId = row.id;
  const checked = state.selectedRowIds.has(row.id);
  tr.className = checked ? 'is-selected' : '';
  applyStyle(tr, { borderBottom: '1px solid #1e293b' });
  const checkCell = document.createElement('td');
  applyStyle(checkCell, { padding: '7px 6px', width: '28px' });
  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.checked = checked;
  checkbox.addEventListener('change', () => {
    if (checkbox.checked) {
      state.selectedRowIds.add(row.id);
      state.qualityByRowId[row.id] = plan.selectedQuality;
    } else {
      state.selectedRowIds.delete(row.id);
      state.qualityByRowId[row.id] = state.outsideSelect?.value || plan.initialQuality;
    }
    renderRows(plan, state);
    drawPreview(plan, state);
  });
  checkCell.appendChild(checkbox);
  const nameCell = document.createElement('td');
  applyStyle(nameCell, { padding: '7px 6px', color: '#dbeafe', minWidth: '120px' });
  const name = document.createElement('div');
  name.textContent = row.label;
  applyStyle(name, { maxWidth: '230px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: checked ? '700' : '600' });
  name.title = row.path || row.label;
  const path = document.createElement('div');
  path.textContent = row.sourceType === 'area' ? row.path : row.sourceType;
  applyStyle(path, { color: '#70839d', fontSize: '11px', maxWidth: '230px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' });
  nameCell.append(name, path);
  const countCell = document.createElement('td');
  countCell.textContent = String(row.primitiveCount || 0);
  applyStyle(countCell, { padding: '7px 6px', color: '#bfdbfe', textAlign: 'right' });
  const qualityCell = document.createElement('td');
  applyStyle(qualityCell, { padding: '7px 6px' });
  const select = qualitySelect(state.qualityByRowId[row.id] || plan.initialQuality);
  select.addEventListener('change', () => {
    state.qualityByRowId[row.id] = select.value;
    if (select.value === plan.selectedQuality) state.selectedRowIds.add(row.id);
    drawPreview(plan, state);
    updateSelectedCount(plan, state);
  });
  qualityCell.appendChild(select);
  tr.append(checkCell, nameCell, countCell, qualityCell);
  return tr;
}

function drawPreview(plan, state) {
  const canvas = state.canvas;
  if (!canvas) return;
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(Math.floor(rect.width), 320);
  const height = Math.max(Math.floor(rect.height), 240);
  const ratio = window.devicePixelRatio || 1;
  canvas.width = Math.floor(width * ratio);
  canvas.height = Math.floor(height * ratio);
  const ctx = canvas.getContext('2d');
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#020617';
  ctx.fillRect(0, 0, width, height);
  drawGrid(ctx, width, height);
  for (const row of plan.rows) drawRowBox(ctx, row, plan, state, width, height);
  if (state.drag) drawDragRect(ctx, dragRect(state.drag));
}

function drawGrid(ctx, width, height) {
  ctx.strokeStyle = 'rgba(51, 65, 85, .38)';
  ctx.lineWidth = 1;
  for (let x = 32; x < width; x += 48) line(ctx, x, 0, x, height);
  for (let y = 32; y < height; y += 48) line(ctx, 0, y, width, y);
}

function drawRowBox(ctx, row, plan, state, width, height) {
  const projected = projectBbox(row.bboxWorld, plan.bboxWorld, state.viewMode, width, height);
  if (!projected) return;
  const quality = state.qualityByRowId[row.id] || plan.initialQuality;
  const selected = state.selectedRowIds.has(row.id);
  ctx.fillStyle = selected ? 'rgba(250, 204, 21, .24)' : qualityFill(quality);
  ctx.strokeStyle = selected ? '#facc15' : qualityStroke(quality);
  ctx.lineWidth = selected ? 2 : 1;
  ctx.fillRect(projected.left, projected.top, projected.width, projected.height);
  ctx.strokeRect(projected.left, projected.top, projected.width, projected.height);
}

function drawDragRect(ctx, rect) {
  ctx.fillStyle = 'rgba(96, 165, 250, .16)';
  ctx.strokeStyle = '#60a5fa';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([6, 4]);
  ctx.fillRect(rect.left, rect.top, rect.width, rect.height);
  ctx.strokeRect(rect.left, rect.top, rect.width, rect.height);
  ctx.setLineDash([]);
}

function rowsInsideRect(plan, state, rect) {
  const canvasRect = state.canvas.getBoundingClientRect();
  const width = Math.max(canvasRect.width, 320);
  const height = Math.max(canvasRect.height, 240);
  return plan.rows.filter((row) => {
    const projected = projectBbox(row.bboxWorld, plan.bboxWorld, state.viewMode, width, height);
    return projected && rectsOverlap(projected, rect);
  });
}

function projectBbox(bbox, modelBbox, viewMode, width, height) {
  if (!isBbox(bbox) || !isBbox(modelBbox)) return null;
  const axes = VIEW_AXES[viewMode] || VIEW_AXES.xy;
  const pad = 26;
  const minX = modelBbox[axes.axisX], maxX = modelBbox[axes.axisX + 3];
  const minY = modelBbox[axes.axisY], maxY = modelBbox[axes.axisY + 3];
  const rangeX = Math.max(maxX - minX, 0.001);
  const rangeY = Math.max(maxY - minY, 0.001);
  const leftWorld = bbox[axes.axisX], rightWorld = bbox[axes.axisX + 3];
  const bottomWorld = bbox[axes.axisY], topWorld = bbox[axes.axisY + 3];
  const left = pad + ((leftWorld - minX) / rangeX) * (width - pad * 2);
  const right = pad + ((rightWorld - minX) / rangeX) * (width - pad * 2);
  const top = pad + (1 - ((topWorld - minY) / rangeY)) * (height - pad * 2);
  const bottom = pad + (1 - ((bottomWorld - minY) / rangeY)) * (height - pad * 2);
  return {
    left: Math.min(left, right),
    top: Math.min(top, bottom),
    width: Math.max(Math.abs(right - left), 3),
    height: Math.max(Math.abs(bottom - top), 3),
  };
}

function qualitySelect(value) {
  const select = document.createElement('select');
  applyStyle(select, {
    backgroundColor: '#162235',
    color: '#e2e8f0',
    border: '1px solid #334155',
    borderRadius: '4px',
    padding: '5px 8px',
    fontSize: '12px',
  });
  for (const quality of QUALITY_OPTIONS) {
    const option = document.createElement('option');
    option.value = quality;
    option.textContent = QUALITY_LABELS[quality] || quality;
    option.selected = quality === normalizeRenderQuality(value);
    select.appendChild(option);
  }
  return select;
}

function toolButton(text) {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = text;
  applyStyle(button, {
    border: '1px solid #334155',
    borderRadius: '6px',
    backgroundColor: '#142033',
    color: '#dbeafe',
    padding: '6px 9px',
    fontWeight: '700',
    cursor: 'pointer',
    fontSize: '12px',
  });
  return button;
}

function actionButton(text, primary) {
  const button = toolButton(text);
  if (primary) applyStyle(button, { backgroundColor: '#2563eb', borderColor: '#2563eb', color: '#fff' });
  else applyStyle(button, { backgroundColor: 'transparent', color: '#9fb2cc' });
  return button;
}

function setAllRowQualities(plan, state, quality) {
  const normalized = normalizeRenderQuality(quality);
  for (const row of plan.rows) state.qualityByRowId[row.id] = normalized;
}

function updateSelectedCount(plan, state) {
  if (!state.selectedCount) return;
  const primitiveCount = plan.rows.filter((row) => state.selectedRowIds.has(row.id)).reduce((sum, row) => sum + (row.primitiveCount || 0), 0);
  state.selectedCount.textContent = `${state.selectedRowIds.size} selected / ${primitiveCount.toLocaleString()} primitives`;
}

function canvasPoint(canvas, event) {
  const rect = canvas.getBoundingClientRect();
  return { x: event.clientX - rect.left, y: event.clientY - rect.top };
}

function dragRect(drag) {
  const left = Math.min(drag.start.x, drag.end.x);
  const top = Math.min(drag.start.y, drag.end.y);
  return { left, top, width: Math.abs(drag.end.x - drag.start.x), height: Math.abs(drag.end.y - drag.start.y) };
}

function rectsOverlap(a, b) {
  return a.left <= b.left + b.width && a.left + a.width >= b.left && a.top <= b.top + b.height && a.top + a.height >= b.top;
}

function qualityFill(quality) {
  if (quality === 'hidden') return 'rgba(71, 85, 105, .10)';
  if (quality === 'skeleton') return 'rgba(148, 163, 184, .13)';
  if (quality === 'light') return 'rgba(56, 189, 248, .13)';
  if (quality === 'medium') return 'rgba(52, 211, 153, .15)';
  return 'rgba(96, 165, 250, .18)';
}

function qualityStroke(quality) {
  if (quality === 'hidden') return 'rgba(100, 116, 139, .50)';
  if (quality === 'skeleton') return '#94a3b8';
  if (quality === 'light') return '#38bdf8';
  if (quality === 'medium') return '#34d399';
  return '#60a5fa';
}

function primitiveBbox(primitive) {
  return isBbox(primitive?.transform?.bboxWorld) ? primitive.transform.bboxWorld : (isBbox(primitive?.bboxWorld) ? primitive.bboxWorld : null);
}

function aggregateBboxes(bboxes) {
  const valid = bboxes.filter(isBbox);
  if (!valid.length) return null;
  return valid.reduce((acc, bbox) => [
    Math.min(acc[0], bbox[0]),
    Math.min(acc[1], bbox[1]),
    Math.min(acc[2], bbox[2]),
    Math.max(acc[3], bbox[3]),
    Math.max(acc[4], bbox[4]),
    Math.max(acc[5], bbox[5]),
  ], [...valid[0]]);
}

function bboxCenter(bbox) {
  return [(bbox[0] + bbox[3]) / 2, (bbox[1] + bbox[4]) / 2, (bbox[2] + bbox[5]) / 2];
}

function gridIndex(value, min, max, count) {
  const range = Math.max(max - min, 0.001);
  return Math.max(0, Math.min(count - 1, Math.floor(((value - min) / range) * count)));
}

function areaPath(bbox) {
  if (!isBbox(bbox)) return 'spatial area';
  return `X ${formatCoord(bbox[0])}..${formatCoord(bbox[3])} / Y ${formatCoord(bbox[1])}..${formatCoord(bbox[4])}`;
}

function formatCoord(value) {
  return Number(value).toLocaleString(undefined, { maximumFractionDigits: 1 });
}

function isBbox(value) {
  return Array.isArray(value) && value.length === 6 && value.every((item) => Number.isFinite(Number(item))) && value[0] <= value[3] && value[1] <= value[4] && value[2] <= value[5];
}

function positiveInteger(value, fallback) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : fallback;
}

function pushMapValue(map, key, value) {
  if (!map.has(key)) map.set(key, []);
  map.get(key).push(value);
}

function sortRowsByLabel(a, b) {
  return String(a.name || a.path || a.id).localeCompare(String(b.name || b.path || b.id), undefined, { numeric: true, sensitivity: 'base' });
}

function line(ctx, x1, y1, x2, y2) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

function applyStyle(node, styles) {
  Object.assign(node.style, styles);
}
