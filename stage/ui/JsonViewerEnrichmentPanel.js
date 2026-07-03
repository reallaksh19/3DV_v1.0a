/**
 * Functionality: renders the selected-geometry enrichment workflow shell for
 * the Stage JSON viewer. Parameters: active StageModel, selected refs, and UI
 * config. Outputs: tabbed workflow markup modelled on the RVM viewer workflow.
 * Fallback: no selection uses the model root as the branch preview source.
 */

const TABS = [
  ['regex', '1 Regex'], ['masters', '2 Import Masters'], ['preview', '4 Preview'],
  ['diagnostics', '5 Diagnostics'], ['weight', '5A Weight Match'], ['run', '6 Run'], ['config', '8 Config'],
];

export function createJsonViewerEnrichmentState() {
  return { open: false, activeTab: 'regex', delimiter: '-', lineKeyPosition: 4, pipingClassPosition: 5, sizePosition: 3, masters: {}, masterFiles: {}, lastRun: null };
}

export function renderJsonViewerEnrichmentPanel(target, model, selectedRef, enrichment) {
  if (!target) return;
  if (!enrichment?.open) { target.hidden = true; target.replaceChildren(); return; }
  const branch = branchNameFor(model, selectedRef);
  const tokens = tokenize(branch, enrichment.delimiter);
  target.hidden = false;
  target.innerHTML = `
    <section class="json-viewer-enrichment-dialog${enrichment.fullscreen ? ' is-fullscreen' : ''}" role="dialog" aria-label="Selected Geometry Enrichment">
      <header class="json-viewer-enrichment-head">
        <div><h2>Selected Geometry Enrichment</h2><p>Branch-driven XML-&gt;CII enrichment for selected JSON viewer geometry.</p></div>
        <div class="json-viewer-enrichment-actions">
          <button type="button" data-action="enrich-refresh">Refresh</button>
          <button type="button" data-action="enrich-fullscreen">Fullscreen</button>
          <button type="button" data-action="enrich-close">Close</button>
        </div>
      </header>
      <nav class="json-viewer-enrichment-tabs">${TABS.map(([id, label]) => `<button type="button" class="${id === enrichment.activeTab ? 'is-active' : ''}" data-enrich-tab="${id}">${esc(label)}</button>`).join('')}</nav>
      <main class="json-viewer-enrichment-body">${tabBody(enrichment, branch, tokens)}</main>
    </section>`;
}

function tabBody(enrichment, branch, tokens) {
  if (enrichment.activeTab === 'masters') return mastersTab(enrichment);
  if (enrichment.activeTab === 'preview') return previewTab(enrichment, branch, tokens);
  if (enrichment.activeTab === 'diagnostics') return diagnosticsTab(tokens);
  if (enrichment.activeTab === 'weight') return weightTab(enrichment, tokens);
  if (enrichment.activeTab === 'run') return runTab(enrichment, branch, tokens);
  if (enrichment.activeTab === 'config') return configTab(enrichment);
  return regexTab(enrichment, branch, tokens);
}

function regexTab(enrichment, branch, tokens) {
  return `
    <section class="json-viewer-enrichment-grid">
      <div class="json-viewer-enrichment-card">
        <h3>Regex</h3>
        <label>Sample Branchname<input data-enrich-input="sample" value="${esc(branch)}" readonly></label>
        <label>Common Delimiter<input data-enrich-input="delimiter" value="${esc(enrichment.delimiter)}"></label>
        <label>Line Key Position(s)<input data-enrich-input="lineKeyPosition" type="number" value="${esc(enrichment.lineKeyPosition)}"></label>
        <label>Piping Class Position<input data-enrich-input="pipingClassPosition" type="number" value="${esc(enrichment.pipingClassPosition)}"></label>
        <label>Size Position<input data-enrich-input="sizePosition" type="number" value="${esc(enrichment.sizePosition)}"></label>
      </div>
      <div class="json-viewer-enrichment-card"><h3>Branch Preview</h3>${tokenTable(tokens)}</div>
    </section>`;
}

function mastersTab(enrichment) {
  const masters = [['lineList', 'Line List'], ['pipingClass', 'Piping Class'], ['materialMap', 'Material Map'], ['weightMaster', 'Weight Master']];
  return `<section class="json-viewer-enrichment-grid">${masters.map(([kind, label]) => {
    const file = enrichment.masterFiles?.[kind];
    const count = Array.isArray(enrichment.masters?.[kind]) ? enrichment.masters[kind].length : 0;
    return `<div class="json-viewer-enrichment-card"><h3>${esc(label)}</h3><input type="file" data-enrich-master="${esc(kind)}"><p>${file ? `${esc(file.fileName)} - ${count} row(s)` : 'Not loaded'}</p></div>`;
  }).join('')}</section>`;
}

function previewTab(enrichment, branch, tokens) {
  return `<section class="json-viewer-enrichment-card"><h3>Preview</h3><table class="json-viewer-enrichment-table"><tbody>
    <tr><th>Branch</th><td>${esc(branch)}</td></tr>
    <tr><th>Line Key</th><td>${esc(tokenAt(tokens, enrichment.lineKeyPosition))}</td></tr>
    <tr><th>Piping Class</th><td>${esc(tokenAt(tokens, enrichment.pipingClassPosition))}</td></tr>
    <tr><th>Size</th><td>${esc(tokenAt(tokens, enrichment.sizePosition))}</td></tr>
  </tbody></table></section>`;
}

function diagnosticsTab(tokens) {
  const status = tokens.length ? 'OK' : 'WARN';
  return `<section class="json-viewer-enrichment-card"><h3>Diagnostics</h3><table class="json-viewer-enrichment-table"><tbody><tr><th>Token extraction</th><td>${status}</td></tr><tr><th>Token count</th><td>${tokens.length}</td></tr></tbody></table></section>`;
}

function weightTab(enrichment, tokens) {
  return `<section class="json-viewer-enrichment-card"><h3>Weight Match</h3><table class="json-viewer-enrichment-table"><tbody><tr><th>Size basis</th><td>${esc(tokenAt(tokens, enrichment.sizePosition))}</td></tr><tr><th>Master status</th><td>Not loaded</td></tr></tbody></table></section>`;
}

function runTab(enrichment, branch, tokens) {
  const lastRun = enrichment.lastRun ? `Last run: ${esc(enrichment.lastRun)}` : 'No run yet';
  return `<section class="json-viewer-enrichment-card"><h3>Run</h3><button type="button" data-action="enrich-run">Run Enrichment</button><button type="button" data-action="enrich-export-config">Export Config</button><p>${lastRun}</p><pre>${esc(JSON.stringify({ branch, tokens, masterCounts: masterCounts(enrichment) }, null, 2))}</pre></section>`;
}

function configTab(enrichment) {
  return `<section class="json-viewer-enrichment-card"><h3>Config</h3><textarea data-enrich-config rows="12">${esc(JSON.stringify(enrichment, null, 2))}</textarea></section>`;
}

function tokenTable(tokens) {
  return `<table class="json-viewer-enrichment-table"><thead><tr><th>Position</th><th>Token</th></tr></thead><tbody>${tokens.map((token, index) => `<tr><td>${index + 1}</td><td>${esc(token)}</td></tr>`).join('') || '<tr><td colspan="2">No tokens</td></tr>'}</tbody></table>`;
}

function branchNameFor(model, selectedRef) {
  const item = itemForRef(model, selectedRef);
  return item?.path || item?.name || item?.id || model?.hierarchy?.rootId || '';
}

function itemForRef(model, ref) {
  if (!model || !ref) return null;
  if (ref.type === 'node') return model.hierarchy?.nodes?.find((node) => node.id === ref.id) || null;
  if (ref.type === 'component') return model.components?.find((component) => component.id === ref.id) || null;
  if (ref.type === 'primitive') return model.primitives?.find((primitive) => primitive.id === ref.id) || null;
  return { id: model.hierarchy?.rootId || 'root' };
}

function tokenize(value, delimiter) {
  return String(value || '').split(delimiter || '-').map((part) => part.trim()).filter(Boolean);
}

function tokenAt(tokens, oneBasedPosition) {
  return tokens[Math.max(Number(oneBasedPosition) - 1, 0)] || '';
}

function masterCounts(enrichment) {
  return Object.fromEntries(['lineList', 'pipingClass', 'materialMap', 'weightMaster'].map((kind) => [kind, Array.isArray(enrichment.masters?.[kind]) ? enrichment.masters[kind].length : 0]));
}

function esc(value) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
