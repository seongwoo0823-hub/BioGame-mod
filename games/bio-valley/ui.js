// 바이오 밸리: 종이 아이콘·화면 조각(HTML). 아이콘은 2~3겹 오린 종이(얇은 갈색 테두리 + 짧은 그림자), 글자 없음.
import { paperSheet } from './lib/paperkit-2d.js';

const L = (d, c, o = {}) => `<path d="${d}" fill="${c}" ${o.s === false ? '' : 'stroke="rgba(66,40,24,.82)" stroke-width=".7" stroke-linejoin="round"'} ${o.extra || ''}/>`;
const S = (d, c, w = 1.4) => `<path d="${d}" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
const circle = (x, y, r) => `M${x - r} ${y}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0z`;
const ICONS = {
  road: L('M3 21C6 14 9 12 11 8s2-5 3-6h4c-1 2-2 4-4 8s-3 7-5 11z', '#e2c9a0') + S('M12.4 5.2l-.8 1.8M10.6 9.4l-1 2M8.6 13.8l-1 2.2', '#a8885a', 1.1),
  home: L('M4 11.5L12 4.5l8 7V20H4z', '#efe0c4') + L('M2.5 12L12 3.5l9.5 8.5-1.4 1.6L12 6.4l-8.1 7.2z', '#c8553a') + L('M10 20v-5.2h4V20z', '#8a5a3a') + L('M15.5 12.2h2.6v2.6h-2.6z', '#f6d98a'),
  leaf: L('M4 20C4 10 10 4 20 4c0 10-6 16-16 16z', '#7fa65a') + S('M5.5 18.5C9 15 12 12 17 7', '#4f7a3a', 1.2) + L('M12 6.5c1.5.5 2.5 1.5 3 3', 'none', { s: false }),
  factory: L('M3 20V11l5 3v-3l5 3v-3l5 3V5h3v15z', '#c8c0b0') + L('M18 5h3V2.8h-3z', '#a8543a') + L('M5.5 16h2.2v2H5.5zM10.5 16h2.2v2h-2.2zM15.5 16h2.2v2h-2.2z', '#9fd0c8'),
  flask: L('M9 3h6v6l5 9a2 2 0 0 1-1.7 3H5.7A2 2 0 0 1 4 18l5-9z', '#e6eef0') + L('M6.2 15h11.6l1.4 2.6a1.4 1.4 0 0 1-1.2 2H6a1.4 1.4 0 0 1-1.2-2z', '#6fb05a') + L('M8 2.2h8v1.8H8z', '#8a8478'),
  heart: L('M12 20.5C5 15.5 3 12 3 8.6A4.6 4.6 0 0 1 12 6.6a4.6 4.6 0 0 1 9 2c0 3.4-2 6.9-9 11.9z', '#d8705a') + L('M7.2 7.4a2.2 2.2 0 0 1 2.6 1', 'none', { extra: 'stroke="#fbe8d8" stroke-width="1.2"', s: false }),
  tree: L('M10.8 13h2.4v8h-2.4z', '#6b4630') + L(circle(12, 9.5, 6.8), '#6f9a50') + L('M8 7.5l1.6 1M14.5 6l1.4 1.2M15 11.5l1.5.8M8.8 12l1.4-.4', 'none', { extra: 'stroke="#c8402e" stroke-width="1.6" stroke-linecap="round"', s: false }),
  shovel: L('M10.4 2.5h3.2l-.4 10h-2.4z', '#a8784a') + L('M7.5 12.5h9l-1 6.5c-.3 2-1.7 2.8-3.5 2.8s-3.2-.8-3.5-2.8z', '#b8bcc0') + L('M9.2 2h5.6v1.8H9.2z', '#6b4630'),
  flag: L('M5 2.5h1.8V22H5z', '#6b4630') + L('M6.8 3.5H19l-2.6 4 2.6 4H6.8z', '#b9603f') + L('M9.2 6.2l1.4 1.4 2.6-2.6', 'none', { extra: 'stroke="#fbf6ea" stroke-width="1.3" fill="none" stroke-linecap="round"', s: false }),
  micro: L('M5 20h14v2H5z', '#5a6a7a') + L('M10 17h4v3h-4z', '#5a6a7a') + L('M9.5 3.5l3-1.4 3.6 8-3 1.4z', '#3f5a7a') + L('M13.3 11.6a5 5 0 0 1-4.6 5.4h6.5', 'none', { extra: 'stroke="#3f5a7a" stroke-width="1.8" fill="none" stroke-linecap="round"', s: false }) + L('M8.4 2.6l3.6-1.6.7 1.5-3.6 1.6z', '#e0a840'),
  coin: L(circle(12, 12, 9), '#e0b04a') + L(circle(12, 12, 6.3), '#f0c860') + L('M9.2 13.8c2-.2 4-2 4.8-5-1.8.4-4 1.6-4.8 5zm0 0l-1 1.6', 'none', { extra: 'stroke="#8a5a1a" stroke-width="1.3" fill="#8a9a3a" stroke-linecap="round"', s: false }),
  people: L(circle(8.5, 7.5, 3.2), '#f2c9a0') + L('M2.5 20a6 6 0 0 1 12 0z', '#4f8f8a') + L(circle(16.5, 8.5, 2.8), '#e8b88a') + L('M12 20.5a5 5 0 0 1 10 0z', '#d8705a'),
  smile: L(circle(12, 12, 9), '#f2cc5a') + `<circle cx="9" cy="10" r="1.2" fill="#4a3020"/><circle cx="15" cy="10" r="1.2" fill="#4a3020"/>` + S('M8 14c2 2.6 6 2.6 8 0', '#4a3020', 1.4),
  frown: L(circle(12, 12, 9), '#e8b07a') + `<circle cx="9" cy="10" r="1.2" fill="#4a3020"/><circle cx="15" cy="10" r="1.2" fill="#4a3020"/>` + S('M8 16.5c2-2.4 6-2.4 8 0', '#4a3020', 1.4),
  sprout: L('M7 15h10l-1.4 6.5H8.4z', '#b8784a') + L('M11.2 15c0-4-1-6-5.5-7 0 4 2 6 5.5 7z', '#7fa65a') + L('M12.8 15c0-5 1.5-8 6.5-9.5 0 5-2 8.5-6.5 9.5z', '#5f8f45'),
  cal: L('M3.5 5h17v15.5h-17z', '#f2e8d4') + L('M3.5 5h17v4h-17z', '#b9603f') + L('M7 3v4M17 3v4', 'none', { extra: 'stroke="#4a3020" stroke-width="1.6" stroke-linecap="round"', s: false }) + `<g fill="#8a6a4a"><rect x="6.5" y="11.5" width="2.4" height="2"/><rect x="10.8" y="11.5" width="2.4" height="2"/><rect x="15" y="11.5" width="2.4" height="2"/><rect x="6.5" y="15.5" width="2.4" height="2"/><rect x="10.8" y="15.5" width="2.4" height="2"/></g>`,
  pause: L('M6.5 4.5h3.8v15H6.5zM13.7 4.5h3.8v15h-3.8z', '#efe2c6'),
  play: L('M7 4l12 8-12 8z', '#efe2c6'),
  ff: L('M3 5l9 7-9 7zM12 5l9 7-9 7z', '#efe2c6'),
  fff: L('M1.5 6l7 6-7 6zM8.5 6l7 6-7 6zM15.5 6l7 6-7 6z', '#efe2c6'),
  menu: L('M4 5.5h16v2.8H4zM4 10.6h16v2.8H4zM4 15.7h16v2.8H4z', '#efe2c6'),
  x: L('M5.6 3.8L12 10.2l6.4-6.4 1.8 1.8-6.4 6.4 6.4 6.4-1.8 1.8-6.4-6.4-6.4 6.4-1.8-1.8 6.4-6.4-6.4-6.4z', '#d8705a'),
  rotl: S('M18.5 13.5A7 7 0 1 1 13 5.6', '#4a3020', 2.2) + L('M11 2.2l5 3.4-5 3.6z', '#b9603f'),
  rotr: S('M5.5 13.5A7 7 0 1 0 11 5.6', '#4a3020', 2.2) + L('M13 2.2l-5 3.4 5 3.6z', '#b9603f'),
  zin: L(circle(10.5, 10.5, 7), '#e6eef0') + S('M15.6 15.6l5 5', '#6b4630', 3) + S('M7.5 10.5h6M10.5 7.5v6', '#4a3020', 1.8),
  zout: L(circle(10.5, 10.5, 7), '#e6eef0') + S('M15.6 15.6l5 5', '#6b4630', 3) + S('M7.5 10.5h6', '#4a3020', 1.8),
  star: L('M12 2.5l2.9 6.2 6.6.7-5 4.5 1.5 6.6L12 17l-6 3.5 1.5-6.6-5-4.5 6.6-.7z', '#e0b04a'),
  chart: L('M3 20.5h18v1.5H3z', '#4a3020') + L('M4.5 13h3.5v7H4.5z', '#d8705a') + L('M10.2 8h3.5v12h-3.5z', '#6f9a50') + L('M16 4h3.5v16H16z', '#4f8f8a'),
  gear: L('M10.5 2h3l.5 2.6 2.2 1 2.2-1.5 2.1 2.1-1.5 2.2 1 2.2 2.6.5v3l-2.6.5-1 2.2 1.5 2.2-2.1 2.1-2.2-1.5-2.2 1-.5 2.6h-3l-.5-2.6-2.2-1-2.2 1.5-2.1-2.1 1.5-2.2-1-2.2L2 13.5v-3l2.6-.5 1-2.2-1.5-2.2 2.1-2.1 2.2 1.5 2.2-1z', '#b8bcc0') + L(circle(12, 12, 3.4), '#efe2c6'),
  smoke: L('M6 19a4 4 0 0 1-.4-8 6 6 0 0 1 11.6-1.4A4.4 4.4 0 0 1 17.5 19z', '#c8c0b0') + L(circle(16, 6, 2.4), '#ddd6c8'),
  check: L('M3.5 12.5l2.2-2.2 4 4L18.3 5.7l2.2 2.2L9.7 18.7z', '#6f9a50'),
  dot: L(circle(12, 12, 5), 'rgba(74,48,32,.25)', { s: false }),
  save: L('M4 3.5h13l3 3V20.5H4z', '#4f8f8a') + L('M7 3.5h9v6H7z', '#efe2c6') + L('M7 13h10v7.5H7z', '#efe2c6'),
  bank: L('M3 9l9-5.5L21 9z', '#b9603f') + L('M5 10h2.4v7.5H5zM10.8 10h2.4v7.5h-2.4zM16.6 10H19v7.5h-2.4z', '#efe2c6') + L('M3 18h18v2.5H3z', '#8a8478'),
  home2: L('M3 11L12 3.5 21 11v9.5H3z', '#efe0c4') + L('M9.5 20.5v-6h5v6z', '#b9603f'),
  sound: L('M3 9h4l5-4.5v15L7 15H3z', '#efe2c6') + S('M15 8.5a5 5 0 0 1 0 7M17.8 6a8.6 8.6 0 0 1 0 12', '#4a3020', 1.6),
  info: L(circle(12, 12, 9), '#4f8f8a') + L('M10.8 10.5h2.4v7h-2.4z', '#fbf6ea', { s: false }) + L(circle(12, 7.4, 1.4), '#fbf6ea', { s: false }),
  lock: L('M5 10.5h14V21H5z', '#8a8478') + S('M8 10.5V7.5a4 4 0 0 1 8 0v3', '#5a5048', 2),
};
export const icon = (k, cls = '') => `<span class="ic ${cls}"><svg viewBox="0 0 24 24" style="filter:drop-shadow(.5px 1.2px .6px rgba(50,28,12,.45))">${ICONS[k] || ICONS.dot}</svg></span>`;

/** 종이 바탕(카드지) 무늬를 CSS 배경으로 */
export function paperBackground() {
  try {
    const c = paperSheet({ size: 256, color: '#efe2c6', seed: 11, fibres: 1.1, mottle: 0.06 });
    document.documentElement.style.setProperty('--paper', `url(${c.toDataURL('image/png')})`);
  } catch {}
}
export const $ = (s, r = document) => r.querySelector(s);
export const fmt = (n) => (Math.round(n) < 0 ? '-' : '') + Math.abs(Math.round(n)).toLocaleString('ko-KR');
export function toast(text, sub = '', ms = 4200) {
  const box = $('#toasts'), d = document.createElement('div');
  d.className = 'toast sheet'; d.innerHTML = text + (sub ? `<small>${sub}</small>` : '');
  box.prepend(d);
  while (box.children.length > 4) box.lastChild.remove();
  setTimeout(() => { d.classList.add('out'); setTimeout(() => d.remove(), 420); }, ms);
}
export function modal(html, onReady) {
  const m = $('#modal'), b = $('#mbox');
  b.innerHTML = html; m.classList.remove('hidden');
  const close = () => m.classList.add('hidden');
  m.onclick = (e) => { if (e.target === m) close(); };
  if (onReady) onReady(b, close);
  return close;
}
export function veil(on, text = '종이를 접는 중…') { $('#vtext').textContent = text; $('#veil').classList.toggle('off', !on); }
