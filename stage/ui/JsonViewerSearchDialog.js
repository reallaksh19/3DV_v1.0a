import { searchJsonIndex } from '../render/StagePreviewObjectSearch.js';

export function openSearch(searchIndex, onSelect) {
  let dialog = document.getElementById('json-viewer-search-dialog');
  if (!dialog) dialog = buildDialog(onSelect);
  dialog._index = searchIndex;
  dialog.setAttribute('aria-hidden', 'false');
  dialog.querySelector('[data-jvs-query]')?.focus();
  renderResults(dialog, onSelect);
}

export function closeSearch() {
  const dialog = document.getElementById('json-viewer-search-dialog');
  if (dialog) dialog.setAttribute('aria-hidden', 'true');
}

function buildDialog(onSelect) {
  const dialog = document.createElement('div');
  dialog.id = 'json-viewer-search-dialog';
  dialog.className = 'json-viewer-search-dialog';
  dialog.setAttribute('aria-hidden', 'true');
  dialog.innerHTML = `
    <div class="json-viewer-search-dialog-header">
      <h3 class="json-viewer-search-dialog-title">Find Objects</h3>
      <button class="json-viewer-search-dialog-close" data-action="close">×</button>
    </div>
    <div class="json-viewer-search-dialog-body">
      <div class="json-viewer-search-dialog-controls">
        <input type="text" data-jvs-query placeholder="Search by ID or name..." class="json-viewer-search-input">
        <select data-jvs-kind class="json-viewer-search-select">
          <option value="all">All Types</option>
          <option value="node">Nodes</option>
          <option value="comp">Components</option>
        </select>
      </div>
      <div class="json-viewer-search-dialog-results" data-jvs-results></div>
    </div>
  `;
  document.body.appendChild(dialog);

  dialog.querySelector('[data-action="close"]').addEventListener('click', closeSearch);
  const queryInput = dialog.querySelector('[data-jvs-query]');
  const kindSelect = dialog.querySelector('[data-jvs-kind]');
  
  const refresh = () => renderResults(dialog, onSelect);
  queryInput.addEventListener('input', refresh);
  kindSelect.addEventListener('change', refresh);

  dialog.addEventListener('click', (e) => {
    const actionBtn = e.target.closest('[data-result-action]');
    if (actionBtn) {
      const refType = actionBtn.dataset.refType;
      const refId = actionBtn.dataset.refId;
      const action = actionBtn.dataset.resultAction;
      onSelect({ action, ref: { type: refType, id: refId } });
    }
  });

  return dialog;
}

function renderResults(dialog, onSelect) {
  const resultsContainer = dialog.querySelector('[data-jvs-results]');
  const query = dialog.querySelector('[data-jvs-query]').value;
  const kind = dialog.querySelector('[data-jvs-kind]').value;
  const index = dialog._index || [];
  
  const results = searchJsonIndex(index, query, kind);
  
  if (results.length === 0) {
    resultsContainer.innerHTML = '<div class="json-viewer-search-empty">No objects found.</div>';
    return;
  }
  
  resultsContainer.innerHTML = '';
  const list = document.createElement('ul');
  list.className = 'json-viewer-search-list';
  
  for (const r of results) {
    const li = document.createElement('li');
    li.className = 'json-viewer-search-list-item';
    li.innerHTML = `
      <div class="json-viewer-search-list-label" title="${r.label}">
        <span class="json-viewer-search-list-kind">${r.kind}</span>
        <span class="json-viewer-search-list-id">${r.label}</span>
      </div>
      <div class="json-viewer-search-list-actions">
        <button data-result-action="fit" data-ref-type="${r.ref.type}" data-ref-id="${r.ref.id}" title="Select and Fit">Fit</button>
        <button data-result-action="isolate" data-ref-type="${r.ref.type}" data-ref-id="${r.ref.id}" title="Isolate Object">Isolate</button>
        <button data-result-action="hide" data-ref-type="${r.ref.type}" data-ref-id="${r.ref.id}" title="Hide Object">Hide</button>
        <button data-result-action="copy" data-ref-type="${r.ref.type}" data-ref-id="${r.ref.id}" title="Copy ID">Copy ID</button>
      </div>
    `;
    list.appendChild(li);
  }
  resultsContainer.appendChild(list);
}
