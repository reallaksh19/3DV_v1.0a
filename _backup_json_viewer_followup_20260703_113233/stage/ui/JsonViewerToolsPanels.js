/**
 * Renders secondary tool panels for the Stage JSON viewer.
 * Parameters: target DOM nodes plus visibility, clipping, and tag state.
 * Outputs: panel markup with data attributes consumed by the tab renderer.
 * Fallback: empty lists render concise empty states without throwing.
 */

export function renderHiddenList(target, rows) {
  target.replaceChildren();
  const title = document.createElement('div');
  title.className = 'json-viewer-hidden-title';
  title.textContent = rows.length ? `Hidden (${rows.length})` : 'Hidden (0)';
  target.appendChild(title);
  for (const row of rows) {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'json-viewer-hidden-row';
    item.dataset.restoreRefType = row.ref?.type || '';
    item.dataset.restoreRefId = row.ref?.id || '';
    item.textContent = row.label;
    target.appendChild(item);
  }
}

export function renderTagsPanel(target, tags, draft, capture, sourceName) {
  target.innerHTML = `
    <h2 class="json-viewer-panel-title">Tags</h2>
    <div class="json-viewer-tool-card">
      <div class="json-viewer-card-title">Session Tags</div>
      <div class="json-viewer-muted">${esc(tags.length)} tag${tags.length === 1 ? '' : 's'} in ${esc(sourceName || 'current session')}</div>
      <div class="json-viewer-panel-actions">
        <button type="button" class="json-viewer-mini-btn" data-action="tag-create">${capture?.active ? 'Cancel Create' : 'Create Tag'}</button>
        <button type="button" class="json-viewer-mini-btn" data-action="tag-import">Import XML</button>
        <button type="button" class="json-viewer-mini-btn" data-action="tag-export" ${tags.length ? '' : 'disabled'}>Export XML</button>
      </div>
    </div>
    ${draft ? renderDraftForm(draft) : renderCaptureHint(capture)}
    <div class="json-viewer-tag-list">
      ${tags.length ? tags.map(renderTagRow).join('') : '<div class="json-viewer-empty-state">No tags yet.</div>'}
    </div>`;
}

export function renderClipPanel(target, clip, clipResult) {
  const percent = Number.isFinite(Number(clip?.percent)) ? Number(clip.percent) : 50;
  const axis = ['x', 'y', 'z'].includes(clip?.axis) ? clip.axis : 'x';
  target.innerHTML = `
    <h2 class="json-viewer-panel-title">Clip Tools</h2>
    <div class="json-viewer-tool-card">
      <div class="json-viewer-card-title">${esc(clipResult?.summary || 'Clip: off')}</div>
      <div class="json-viewer-muted">Box clips use six planes. Plane clips use one adjustable axis plane.</div>
      <div class="json-viewer-panel-actions">
        <button type="button" class="json-viewer-mini-btn" data-action="clip-box-selection">Sel Box</button>
        <button type="button" class="json-viewer-mini-btn" data-action="clip-box-model">Model Box</button>
        <button type="button" class="json-viewer-mini-btn" data-action="clip-clear">Clear</button>
      </div>
    </div>
    <div class="json-viewer-clip-controls">
      <div class="json-viewer-axis-row">
        ${['x', 'y', 'z'].map((item) => `<button type="button" class="json-viewer-axis-btn${item === axis ? ' is-active' : ''}" data-clip-axis="${item}">${item.toUpperCase()}</button>`).join('')}
      </div>
      <label class="json-viewer-range-row"><span>Plane</span><input data-clip-percent type="range" min="0" max="100" value="${esc(percent)}"><input data-clip-percent-number type="number" min="0" max="100" value="${esc(percent)}"></label>
      <label class="json-viewer-check-row"><input data-clip-invert type="checkbox" ${clip?.inverted ? 'checked' : ''}> Invert plane</label>
      <button type="button" class="json-viewer-mini-btn is-wide" data-action="clip-plane">Apply Plane</button>
    </div>`;
}

function renderCaptureHint(capture) {
  const text = capture?.active && capture?.anchor ? 'Anchor set. Click a label point in the viewport.' : capture?.active ? 'Click a model point for the tag anchor.' : 'Create Tag uses two viewport clicks: anchor, then label.';
  return `<div class="json-viewer-tag-hint${capture?.active ? ' is-active' : ''}">${esc(text)}</div>`;
}

function renderDraftForm(draft) {
  return `
    <form class="json-viewer-tag-draft" data-tag-draft-form>
      <label>Text<textarea data-tag-draft-text rows="3">Manual tag</textarea></label>
      <label>Severity<select data-tag-draft-severity><option value="info">Info</option><option value="warning">Warning</option><option value="high">High</option></select></label>
      <div class="json-viewer-panel-actions">
        <button type="submit" class="json-viewer-mini-btn">Save Tag</button>
        <button type="button" class="json-viewer-mini-btn" data-action="tag-cancel-draft">Cancel</button>
      </div>
      <small>Anchor ${pointText(draft.anchor)} to label ${pointText(draft.labelPoint)}</small>
    </form>`;
}

function renderTagRow(tag) {
  return `
    <article class="json-viewer-tag-row severity-${esc(tag.severity || 'info')}">
      <button type="button" data-tag-focus="${esc(tag.id)}"><b>${esc(tag.text || tag.id)}</b><span>${esc(tag.severity || 'info')} - ${esc(tag.ref?.type || 'point')}</span></button>
      <button type="button" data-tag-delete="${esc(tag.id)}">Delete</button>
    </article>`;
}

function pointText(point) {
  if (!point) return '-';
  return `${fmt(point.x)}, ${fmt(point.y)}, ${fmt(point.z)}`;
}

function fmt(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number.toFixed(1) : '-';
}

function esc(value) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
