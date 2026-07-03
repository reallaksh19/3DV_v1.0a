const INSTALL_FLAG = Symbol.for('pcf-glb-rvm-hierarchy-provider-validation-recipe-1');
export const RVM_HIERARCHY_PROVIDER_VALIDATION_RECIPE_VERSION = '20260628-rvm-provider-validation-recipe-1';

function ensurePanel(root) {
  const anchor = root?.querySelector?.('#rvm-hierarchy-provider-diagnostics-export') || root?.querySelector?.('#rvm-hierarchy-provider-parity-audit') || root?.querySelector?.('#rvm-hierarchy-provider-health') || root?.querySelector?.('#rvm-hierarchy-provider-debug');
  if (!anchor) return null;
  let panel = root.querySelector('#rvm-hierarchy-provider-validation-recipe');
  if (!panel) {
    panel = document.createElement('details');
    panel.id = 'rvm-hierarchy-provider-validation-recipe';
    panel.className = 'rvm-tag-list rvm-hierarchy-provider-validation-recipe';
    panel.dataset.rvmHierarchyProviderValidationRecipe = 'true';
    anchor.insertAdjacentElement('afterend', panel);
  }
  return panel;
}

function render(root) {
  const panel = ensurePanel(root);
  if (!panel) return;
  panel.innerHTML = `<summary>Provider tree validation recipe</summary><ol><li>Load stagedJSON/source-preview with provider tree disabled.</li><li>Confirm legacy tree selection, branch fit, and source diagnostics still work.</li><li>Check Hierarchy Provider, Health, and Parity panels.</li><li>Export provider diagnostics before changing mode.</li><li>Enable Provider tree read path only when parity is OK.</li><li>Click Apply provider tree on reload and reload through the explicit debug flow.</li><li>Recheck branch/component selection and export diagnostics again.</li><li>If parity guard blocks reload, export diagnostics and do not override unless intentionally testing.</li></ol>`;
}

export function installRvmHierarchyProviderValidationRecipeBridge() {
  if (globalThis[INSTALL_FLAG]) return;
  globalThis[INSTALL_FLAG] = true;
  globalThis.__PCF_GLB_RVM_HIERARCHY_PROVIDER_VALIDATION_RECIPE__ = { version: RVM_HIERARCHY_PROVIDER_VALIDATION_RECIPE_VERSION };
  const update = (event) => {
    const root = event.target?.closest?.('[data-rvm-viewer]') || event.target;
    if (!root?.querySelector) return;
    render(root);
  };
  document.addEventListener('rvm-tree-rendered', update, true);
  document.addEventListener('rvm-hierarchy-provider-attached', update, true);
  document.addEventListener('rvm-hierarchy-provider-health', update, true);
  document.addEventListener('rvm-hierarchy-provider-parity-audit', update, true);
  document.addEventListener('rvm-hierarchy-provider-diagnostics-exported', update, true);
}
