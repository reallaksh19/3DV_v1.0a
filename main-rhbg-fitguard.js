// Guarded startup for the standalone 3DV app.
function startupMount() {
  return document.getElementById('app') || document.getElementById('app-layout') || document.getElementById('app-shell') || document.body;
}

function reportStartupError(error) {
  console.error('3DV startup error', error);
  const root = startupMount();
  if (!root) return;
  root.innerHTML = '<div class="tab-error"><h2>3DV startup error</h2><pre>' + String(error?.message || error) + '</pre></div>';
}

async function startStandaloneApp() {
  const module = await import('./core/app.js?v=standalone-1');
  await module.init(startupMount());
}

startStandaloneApp().catch(reportStartupError);
