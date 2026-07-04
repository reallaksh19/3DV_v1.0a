export function createBottomDrawer(parent) {
  const drawer = document.createElement('div');
  drawer.className = 'json-viewer-bottom-drawer is-collapsed';
  
  const header = document.createElement('div');
  header.className = 'json-viewer-drawer-header';
  
  const title = document.createElement('h3');
  title.className = 'json-viewer-drawer-title';
  title.textContent = 'Diagnostics & Console';
  
  const controls = document.createElement('div');
  controls.className = 'json-viewer-drawer-controls';
  
  const toggleBtn = document.createElement('button');
  toggleBtn.className = 'json-viewer-drawer-toggle';
  toggleBtn.dataset.action = 'toggle-drawer';
  toggleBtn.innerHTML = '&#9650;'; // Up arrow
  
  controls.appendChild(toggleBtn);
  header.appendChild(title);
  header.appendChild(controls);
  
  const content = document.createElement('div');
  content.className = 'json-viewer-drawer-content';
  
  drawer.appendChild(header);
  drawer.appendChild(content);
  parent.appendChild(drawer);
  
  return { drawer, content, toggleBtn };
}

export function renderDrawerContent(content, state) {
  content.innerHTML = '';
  
  if (state.previewDiagnostics?.length || state.workerDiagnostics?.length || state.validationErrors?.length) {
    const list = document.createElement('ul');
    list.className = 'json-viewer-drawer-list';
    
    for (const diag of [...(state.validationErrors || []), ...(state.workerDiagnostics || []), ...(state.previewDiagnostics || [])]) {
      const li = document.createElement('li');
      li.className = `json-viewer-drawer-item severity-${diag.severity || 'error'}`;
      li.textContent = `[${diag.code || 'ERR'}] ${diag.message || diag}`;
      list.appendChild(li);
    }
    
    content.appendChild(list);
  } else {
    content.innerHTML = '<div class="json-viewer-empty-state">No diagnostics available.</div>';
  }
}
