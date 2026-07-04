export const VIEW_CUBE_DEFS = [
  { action: 'view-iso',   title: 'Isometric view',    icon: cubeIsoSvg(),     label: 'ISO',   active: true },
  { action: 'view-top',   title: 'Top view',           icon: cubeTopSvg(),     label: 'TOP'   },
  { action: 'view-front', title: 'Front view',         icon: cubeFrontSvg(),   label: 'FRONT' },
  { action: 'view-side',  title: 'Right view',         icon: cubeSideSvg(),    label: 'SIDE'  },
  { divider: true },
  { action: 'fit',        title: 'Fit all',            icon: cornersSvg(),     label: 'Fit'   },
  { action: 'fit-selection', title: 'Fit selection',   icon: fitSelSvg(),      label: 'FitSel'},
];

export function buildViewCubeBar() {
  const bar = document.createElement('nav');
  bar.className = 'json-viewer-viewcube-bar';
  bar.setAttribute('aria-label', 'View shortcuts');
  for (const def of VIEW_CUBE_DEFS) {
    if (def.divider) { const sep = document.createElement('hr'); sep.className = 'json-viewer-viewcube-sep'; bar.appendChild(sep); continue; }
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'json-viewer-viewcube-btn' + (def.active ? ' is-active' : '');
    btn.dataset.action = def.action;
    btn.title = def.title;
    btn.setAttribute('aria-label', def.title);
    btn.innerHTML = `${def.icon}<span class="json-viewer-sr">${def.label}</span>`;
    bar.appendChild(btn);
  }
  return bar;
}

function svgIcon(body) {
  return `<svg class="json-viewer-viewcube-icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
}
function cubeIsoSvg()   { return svgIcon('<polygon points="12 3.8 19 7.7 12 11.7 5 7.7" fill="rgba(116,201,255,.22)"/><polygon points="5 7.7 12 11.7 12 20 5 16" fill="rgba(88,166,255,.16)"/><polygon points="19 7.7 12 11.7 12 20 19 16" fill="rgba(255,199,96,.14)"/>'); }
function cubeTopSvg()   { return svgIcon('<polygon points="6 8 12 4 18 8 12 12" fill="rgba(116,201,255,.22)"/><path d="M6 8v6l6 4 6-4V8" opacity=".6"/><path d="M12 12v6" opacity=".4"/>'); }
function cubeFrontSvg() { return svgIcon('<rect x="6" y="7" width="12" height="10" rx="1.5" fill="rgba(116,201,255,.22)"/><path d="M8 10h8M8 14h8" opacity=".5"/>'); }
function cubeSideSvg()  { return svgIcon('<polygon points="8 6 17 9 17 18 8 15" fill="rgba(116,201,255,.22)"/><path d="M8 6l-2 3v9l2-3M6 9l9 3" opacity=".5"/>'); }
function cornersSvg()   { return svgIcon('<path d="M7 4H4v3M17 4h3v3M7 20H4v-3M17 20h3v-3"/><rect x="8" y="8" width="8" height="8" rx="1.5" opacity=".5"/>'); }
function fitSelSvg()    { return svgIcon('<rect x="6" y="6" width="12" height="12" rx="2" opacity=".5"/><path d="M12 3v4M12 17v4M3 12h4M17 12h4"/><circle cx="12" cy="12" r="2" fill="currentColor" opacity=".5"/>'); }
