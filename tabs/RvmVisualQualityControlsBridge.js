const VERSION = '20260630-rvm-visual-quality-controls-1';
const INSTALL_KEY = '__PCF_GLB_RVM_VISUAL_QUALITY_CONTROLS__';
const ROOT_SELECTOR = '[data-rvm-viewer]';

const OPTIONS = [
  ['full', 'Full'],
  ['medium', 'Medium'],
  ['light', 'Light'],
  ['skeleton', 'Skeleton'],
  ['hidden', 'Hidden'],
];

export function installRvmVisualQualityControlsBridge() {
  if (typeof document === 'undefined') return null;
  if (globalThis[INSTALL_KEY]?.version === VERSION) return globalThis[INSTALL_KEY];
  const state = { version: VERSION, refresh };
  globalThis[INSTALL_KEY] = state;
  injectStyles();
  const run = () => refresh('install');
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run, { once: true });
  else run();
  const observer = new MutationObserver(() => refresh('mutation'));
  observer.observe(document.documentElement, { childList: true, subtree: true });
  state.dispose = () => observer.disconnect();
  return state;
}

function refresh(reason = 'manual') {
  let count = 0;
  for (const root of document.querySelectorAll?.(ROOT_SELECTOR) || []) {
    const controls = root.querySelector('[data-rvm-hierarchy-multiselect-controls]');
    const select = controls?.querySelector?.('[data-rvm-hierarchy-lod-detail]');
    if (!select || select.dataset.rvmVisualQualityControls === VERSION) continue;
    const current = normalizeQuality(select.value || 'full');
    select.innerHTML = OPTIONS.map(([value, label]) => `<option value="${value}"${value === current ? ' selected' : ''}>${label}</option>`).join('');
    select.dataset.rvmVisualQualityControls = VERSION;
    select.setAttribute('aria-label', 'Visual Quality for selected hierarchy rows');
    select.title = 'Visual Quality: Full / Medium / Light / Skeleton / Hidden';
    const apply = controls.querySelector('[data-rvm-hierarchy-lod-apply]');
    if (apply) {
      apply.textContent = 'Apply Quality';
      apply.title = 'Apply Visual Quality to selected hierarchy rows';
      apply.dataset.rvmVisualQualityApply = VERSION;
    }
    let label = controls.querySelector('[data-rvm-visual-quality-label]');
    if (!label) {
      label = document.createElement('span');
      label.className = 'rvm-visual-quality-label';
      label.dataset.rvmVisualQualityLabel = VERSION;
      label.textContent = 'Visual Quality';
      select.insertAdjacentElement('beforebegin', label);
    }
    root.dataset.rvmVisualQualityControls = VERSION;
    root.dataset.rvmVisualQualityControlsReason = reason;
    count += 1;
  }
  return { version: VERSION, count, reason };
}

function normalizeQuality(value) {
  const text = String(value || '').trim().toLowerCase();
  if (text === '250' || text === '100' || text === 'full') return 'full';
  if (text === '75' || text === 'medium') return 'medium';
  if (text === '50' || text === 'light') return 'light';
  if (text === '25' || text === 'skeleton') return 'skeleton';
  if (text === '0' || text === 'hidden' || text === 'hide' || text === 'off') return 'hidden';
  return OPTIONS.some(([value]) => value === text) ? text : 'full';
}

function injectStyles() {
  if (document.getElementById('rvm-visual-quality-controls-style')) return;
  const style = document.createElement('style');
  style.id = 'rvm-visual-quality-controls-style';
  style.textContent = `[data-rvm-viewer] .rvm-visual-quality-label{font-size:9px;color:#93c5fd;text-transform:uppercase;letter-spacing:.04em;margin-left:2px}`;
  document.head.appendChild(style);
}
