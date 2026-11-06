/* BIO ARCADE 픽토그램
 * 사이트와 게임에 쓰인 이모지를 단순한 선 그림(24×24 SVG)으로 바꿉니다.
 *   - 화면 글자(HTML): 이모지를 <svg class="pg">로 바꿈 (나중에 바뀌는 글자도 자동으로)
 *   - 캔버스 글자(fillText): 같은 그림을 Path2D로 바로 그림
 *   - 알림창·제목·옵션처럼 그림을 넣을 수 없는 곳: 이모지만 지움
 *   BioIcon.svg('home')  → svg 문자열,  <i data-ic="home"></i> → 자동으로 채움
 * <head> 맨 앞에서 불러야 게임 코드보다 먼저 캔버스를 바꿀 수 있어요.
 */
(function () {
  'use strict';
  if (window.BioIcon) return;
  // ---------- 모양 도우미 ----------
  function C(x, y, r) { return 'M' + (x - r) + ' ' + y + 'a' + r + ' ' + r + ' 0 1 0 ' + 2 * r + ' 0a' + r + ' ' + r + ' 0 1 0 ' + -2 * r + ' 0z'; }
  function R(x, y, w, h, q) {
    q = q || 0;
    return 'M' + (x + q) + ' ' + y + 'h' + (w - 2 * q) + (q ? 'a' + q + ' ' + q + ' 0 0 1 ' + q + ' ' + q : '') + 'v' + (h - 2 * q) +
      (q ? 'a' + q + ' ' + q + ' 0 0 1 ' + -q + ' ' + q : '') + 'h' + (2 * q - w) + (q ? 'a' + q + ' ' + q + ' 0 0 1 ' + -q + ' ' + -q : '') +
      'v' + (2 * q - h) + (q ? 'a' + q + ' ' + q + ' 0 0 1 ' + q + ' ' + -q : '') + 'z';
  }
  function E(x, y, rx, ry) { return 'M' + (x - rx) + ' ' + y + 'a' + rx + ' ' + ry + ' 0 1 0 ' + 2 * rx + ' 0a' + rx + ' ' + ry + ' 0 1 0 ' + -2 * rx + ' 0z'; }
  var HEART = 'M12 20C5 15 3 12 3 8.5A4.5 4.5 0 0 1 12 6.5A4.5 4.5 0 0 1 21 8.5C21 12 19 15 12 20z';
  var CLOUD = 'M7 18a4 4 0 0 1-.6-7.95A6 6 0 0 1 18 9.6 4.2 4.2 0 0 1 17.5 18z';
  // 한 그림 = 조각 목록. 'f:' 채우기, 'f#색:' 그 색으로 채우기, 나머지는 선
  var I = {
    shield: ['M12 3l7 3v5c0 4.6-3 8.2-7 10-4-1.8-7-5.4-7-10V6z'],
    x: ['M6 6l12 12M18 6L6 18'],
    check: ['M5 12.5l4.5 4.5L19 7'],
    home: ['M3.5 11L12 4l8.5 7', 'M6 9.5V20h12V9.5', 'M10 20v-5h4v5'],
    bolt: ['M13 2L5 14h6l-1 8 8-12h-6z'],
    globe: [C(12, 12, 9), 'M3 12h18M12 3c3.2 3 3.2 15 0 18M12 3c-3.2 3-3.2 15 0 18'],
    crown: ['M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5z'],
    sword: ['M20 4l-10.5 10.5', 'M20 4h-4.5M20 4v4.5', 'M6 11.5l6.5 6.5M9 15l-5 5'],
    swords: ['M4 4l11 11M4 4h4M4 4v4M20 4L9 15M20 4h-4M20 4v4', 'M13 17l4-4M11 17l-4-4M16 16l4 4M8 16l-4 4'],
    dna: ['M8 3c0 4.5 8 4.5 8 9s-8 4.5-8 9M16 3c0 4.5-8 4.5-8 9s8 4.5 8 9', 'M9.2 5.2h5.6M8 12h8M9.2 18.8h5.6'],
    target: [C(12, 12, 9), C(12, 12, 5), 'f:' + C(12, 12, 1.6)],
    flask: ['M9 3h6M10 3v6l-5.2 9.2A2 2 0 0 0 6.5 21h11a2 2 0 0 0 1.7-2.8L14 9V3', 'M7.2 15h9.6'],
    hourglass: ['M6.5 3h11M6.5 21h11', 'M8 3v3.5l4 5.5 4-5.5V3M8 21v-3.5l4-5.5 4 5.5V21'],
    spiral: ['M12 12.5a1.5 1.5 0 1 1 1.5-1.5 3.5 3.5 0 0 1-3.5 3.5A5 5 0 0 1 5 9.5 6.5 6.5 0 0 1 11.5 3 8 8 0 0 1 19.5 11 9 9 0 0 1 12 20'],
    rocket: ['M12 2.5c3.8 2.8 5 7.6 4 12.5H8C7 10.1 8.2 5.3 12 2.5z', C(12, 9, 1.7), 'M8 15l-3 4h4M16 15l3 4h-4M10.5 19l1.5 2.5 1.5-2.5'],
    trophy: ['M7 4h10v5a5 5 0 0 1-10 0z', 'M7 6H4v1a3 3 0 0 0 3 3M17 6h3v1a3 3 0 0 1-3 3M12 14v4M8 21h8M9.5 18h5'],
    microbe: [C(12, 12, 5), 'M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.9 2.9M15.5 15.5l2.9 2.9M5.6 18.4l2.9-2.9M15.5 8.5l2.9-2.9', 'f:' + C(10.5, 11, 1.1), 'f:' + C(13.5, 13.5, .8)],
    search: [C(10.5, 10.5, 6.5), 'M20 20l-4.8-4.8'],
    microscope: ['M8.5 3.5l4 2-3.5 7-4-2z', 'M11 9a6 6 0 0 1 5.5 8.5M5 21h14M8 17.5h8M10.5 12.5L12 14'],
    user: [C(12, 8, 4), 'M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7'],
    users: [C(9, 8, 3.5), 'M2 20c0-3.6 3.1-6 7-6s7 2.4 7 6', 'M15.5 4.6a3.5 3.5 0 0 1 0 6.8M18 14.2c2.4.6 4 2.8 4 5.8'],
    warning: ['M12 3.5l9.5 17h-19z', 'M12 10v4.5M12 17.5v.5'],
    skull: ['M12 3a8 8 0 0 0-8 8c0 3 1.5 4.6 3 5.5V20h10v-3.5c1.5-.9 3-2.5 3-5.5a8 8 0 0 0-8-8z', 'f:' + C(9, 11.5, 1.7), 'f:' + C(15, 11.5, 1.7), 'M10.5 20v-2.5M13.5 20v-2.5'],
    ghost: ['M5 21V10a7 7 0 0 1 14 0v11l-2.3-1.8L14.3 21 12 19.2 9.7 21l-2.4-1.8z', 'f:' + C(9.5, 10.5, 1.1), 'f:' + C(14.5, 10.5, 1.1)],
    speaker: ['M4 9h4l5-4v14l-5-4H4z', 'M16.5 9a4 4 0 0 1 0 6M19 6.5a7.5 7.5 0 0 1 0 11'],
    mute: ['M4 9h4l5-4v14l-5-4H4z', 'M16.5 9.5l5 5M21.5 9.5l-5 5'],
    snow: ['M12 2.5v19M3.8 7.2l16.4 9.6M3.8 16.8l16.4-9.6', 'M9.5 4l2.5 2 2.5-2M9.5 20l2.5-2 2.5 2'],
    hazard: ['f:' + C(12, 12, 1.8), 'M10 8.6L7 3.4A10 10 0 0 0 2 12h6M14 8.6l3-5.2A10 10 0 0 1 22 12h-6M10.2 15.3L7.1 20.6a10 10 0 0 0 9.8 0l-3.1-5.3'],
    wind: ['M3 8h11a3 3 0 1 0-3-3M3 12h16a3 3 0 1 1-3 3M3 16h7'],
    coin: [C(12, 12, 9), C(12, 12, 5.5)],
    bow: ['M6 3c7.5.5 14.5 7.5 15 15', 'M6 3l15 15', 'M3 21l10-10M3 21h4M3 21v-4'],
    repeat: ['M4 11V9a3 3 0 0 1 3-3h12M16 3l3 3-3 3M20 13v2a3 3 0 0 1-3 3H5M8 21l-3-3 3-3'],
    shuffle: ['M3 7h4l10 10h4M3 17h4l3-3M14 10l3-3h4M18 4l3 3-3 3M18 14l3 3-3 3'],
    music: ['M9 18V5l11-2v13', C(6, 18, 3), C(17, 16, 3)],
    headphones: ['M4 15v-3a8 8 0 0 1 16 0v3', R(3, 14, 4, 6.5, 1.5), R(17, 14, 4, 6.5, 1.5)],
    robot: [R(5, 8, 14, 11, 3), 'M12 4.5V8M9 13v1.5M15 13v1.5M2.5 12v3.5M21.5 12v3.5', 'f:' + C(12, 3.5, 1.2)],
    burst: ['M12 2.5l1.9 5.6 5.4-2.5-2.5 5.4 5.6 1.9-5.6 1.9 2.5 5.4-5.4-2.5L12 21.5l-1.9-5.6-5.4 2.5 2.5-5.4L1.6 11.1l5.6-1.9L4.7 3.8l5.4 2.5z'],
    sparkle: ['M11 3c.8 4.6 2.6 6.4 7 7.2-4.4.8-6.2 2.6-7 7.2-.8-4.6-2.6-6.4-7-7.2 4.4-.8 6.2-2.6 7-7.2z', 'M19 15.5v5M16.5 18h5'],
    drop: ['M12 3c4 5 6 8.2 6 11a6 6 0 0 1-12 0c0-2.8 2-6 6-11z'],
    heart: [HEART],
    web: ['M12 3v18M3 12h18M5.6 5.6l12.8 12.8M18.4 5.6L5.6 18.4', 'M12 7l3.5 1.5L17 12l-1.5 3.5L12 17l-3.5-1.5L7 12l1.5-3.5z'],
    spider: [C(12, 14, 3.2), C(12, 8.3, 2.2), 'M9 12.5l-5-3M9 14.5H3M9.3 16l-4.3 4M15 12.5l5-3M15 14.5h6M14.7 16l4.3 4'],
    fire: ['M12 2.5c1 4 6 6 6 11.5a6 6 0 0 1-12 0c0-3 1.8-5 3-6 0 2 1 3 2 3 0-3-1-5.8 1-8.5z'],
    timer: [C(12, 13, 8), 'M12 9v4l2.8 2M9 2.5h6'],
    phone: [R(7, 2.5, 10, 19, 2), 'M11 18.5h2'],
    phoneoff: [R(7, 2.5, 10, 19, 2), 'M3.5 3.5l17 17'],
    clipboard: [R(5, 4, 14, 17.5, 2), 'M9 4V2.5h6V4M9 10h6M9 14h6M9 18h3.5'],
    book: ['M3 5c3-1 6-1 9 1 3-2 6-2 9-1v14c-3-1-6-1-9 1-3-2-6-2-9-1z', 'M12 6v14'],
    map: ['M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3z', 'M9 3v15M15 6v15'],
    orb: [C(12, 10, 7), 'M6 21h12M8.5 16.2L7 21M15.5 16.2L17 21', 'M9 8.5a3 3 0 0 1 3-2.5'],
    brick: [R(3, 5, 18, 14, 1.5), 'M3 12h18M9.5 5v7M14.5 12v7'],
    rock: ['M4 18.5l2.2-8 5-5.2 6.2 2 3 6-2.2 5.2z', 'M11.2 5.3L13 12l-6.8-1.5M13 12l7.4 1.3'],
    leaf: ['M5 19C5 10 11 4 20 4c0 9-6 15-15 15z', 'M5 19l9-9'],
    tree: ['M12 2.5l6 8.5h-3l4 6H5l4-6H6z', 'M12 17v4.5'],
    hammer: ['M13.5 3.5l7 7-3 3-7-7z', 'M12 8.5l-8.5 8.5 3 3L15 11.5'],
    boot: ['M7 3h6v9l5 2.3a3.2 3.2 0 0 1 2 3V20H6z', 'M6 16.5h14'],
    dice: [R(4, 4, 16, 16, 3.5), 'f:' + C(8.5, 8.5, 1.4), 'f:' + C(12, 12, 1.4), 'f:' + C(15.5, 15.5, 1.4)],
    key: [C(8, 15.5, 4.5), 'M11.2 12.3L20 3.5M16.5 7l3 3M14 9.5l2 2'],
    door: ['M5.5 21V4a1 1 0 0 1 1-1h11a1 1 0 0 1 1 1v17M3 21h18', 'f:' + C(15, 12.5, 1.1)],
    castle: ['M4 21V6.5h3v2.5h3V6.5h4V9h3V6.5h3V21z', 'M10 21v-4.5a2 2 0 0 1 4 0V21'],
    gear: [C(12, 12, 3), C(12, 12, 7), 'M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9L7 7M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1'],
    lock: [R(5, 11, 14, 10, 2), 'M8 11V7.5a4 4 0 0 1 8 0V11', 'M12 15v2'],
    unlock: [R(5, 11, 14, 10, 2), 'M8 11V7.5a4 4 0 0 1 7.6-1.7', 'M12 15v2'],
    megaphone: ['M3 10v4h3l10 5V5L6 10z', 'M19 9.5a3.5 3.5 0 0 1 0 5M7 14l1.2 5.5h3L10.5 15'],
    satellite: ['M4 10.5A9.5 9.5 0 0 0 13.5 20z', 'M8.8 15.2l4.2-4.2', 'M14 4a6 6 0 0 1 6 6M14 7.5a2.5 2.5 0 0 1 2.5 2.5'],
    signal: ['M5 20v-3M10 20v-7M15 20V9M20 20V4.5'],
    syringe: ['M18 2.5l3.5 3.5M19.8 4.2l-3.3 3.3M16.5 7.5l-9 9-3 1 1-3 9-9zM13 4.5l6.5 6.5M3 21l2.5-2.5', 'M10 10.5l1.5 1.5M8 12.5l1.5 1.5'],
    pill: ['M10.5 3.5a5 5 0 0 1 7.07 7.07l-7 7a5 5 0 0 1-7.07-7.07z', 'M7 7l10 10'],
    bubble: [C(10, 13.5, 6), C(17.5, 6.5, 3), 'M7.5 11.5a2.5 2.5 0 0 1 2.5-2'],
    chat: ['M4 5h16v11H9.5L4 20z', 'M8 9.5h8M8 12.5h5'],
    plus: ['M12 5v14M5 12h14'],
    divide: ['M5 12h14', 'f:' + C(12, 6.5, 1.5), 'f:' + C(12, 17.5, 1.5)],
    eye: ['M2 12s3.8-7 10-7 10 7 10 7-3.8 7-10 7S2 12 2 12z', C(12, 12, 3)],
    hand: ['M7.5 11.5V6a1.5 1.5 0 0 1 3 0v5M10.5 10.5V4.5a1.5 1.5 0 0 1 3 0v6M13.5 10.5V5.5a1.5 1.5 0 0 1 3 0v6.5M16.5 11.5v-3a1.5 1.5 0 0 1 3 0V14a8 8 0 0 1-8 8 6.5 6.5 0 0 1-5.4-3L3.4 14.6A1.5 1.5 0 0 1 6 13.1l1.5 2.4'],
    dumbbell: ['M6.5 6.5v11M3 9v6M17.5 6.5v11M21 9v6M6.5 12h11'],
    runner: [C(14.5, 4.5, 2), 'M7 21l3.5-6 3 2.5V21M6 11.5l3.5-3.5h5l2 4 3 1M10 8l1.5 7'],
    bulb: ['M9 18h6M10 21h4', 'M12 3a6 6 0 0 0-4 10.5c1 1 1 2 1 3.5h6c0-1.5 0-2.5 1-3.5A6 6 0 0 0 12 3z'],
    paw: ['f:' + C(6.5, 10, 1.9), 'f:' + C(10, 5.8, 1.9), 'f:' + C(14.5, 5.8, 1.9), 'f:' + C(18, 10, 1.9), 'M12.3 11c3 0 5.5 4 5.5 6.5 0 2-1.8 3-3.4 2.4-1.5-.6-2.6-.6-4.2 0-1.6.6-3.4-.4-3.4-2.4 0-2.5 2.5-6.5 5.5-6.5z'],
    gem: ['M6.5 3.5h11l4 5.5L12 20.5 2.5 9z', 'M2.5 9h19M9.5 3.5L12 9l2.5-5.5M12 9v11.5'],
    diamond: ['M12 3l8.5 9L12 21l-8.5-9z'],
    triangle: ['M12 4.5l8.5 15h-17z'],
    lungs: ['M12 3v7.5M12 9.5c-.8 1.5-2.5 2-2.5 2M12 9.5c.8 1.5 2.5 2 2.5 2', 'M8.5 7C5.5 7 3 12 3 17c0 2 1 3 3 3 2.5 0 3.5-2 3.5-4V9c0-1.2-.4-2-1-2zM15.5 7c3 0 5.5 5 5.5 10 0 2-1 3-3 3-2.5 0-3.5-2-3.5-4V9c0-1.2.4-2 1-2z'],
    brain: ['M12 4.5a3 3 0 0 0-5 1 3 3 0 0 0-3 4 3 3 0 0 0 0 5 3 3 0 0 0 3 4 3 3 0 0 0 5 1zM12 4.5a3 3 0 0 1 5 1 3 3 0 0 1 3 4 3 3 0 0 1 0 5 3 3 0 0 1-3 4 3 3 0 0 1-5 1z', 'M12 4.5v15'],
    car: ['M3 15.5l2-5.2C5.5 9 6.5 8 8 8h8c1.5 0 2.5 1 3 2.3l2 5.2V18H3z', C(7.5, 18, 2), C(16.5, 18, 2), 'M5.5 12.5h13'],
    cloud: [CLOUD],
    storm: ['M7 15a4 4 0 0 1-.6-7.95A6 6 0 0 1 18 6.6 4.2 4.2 0 0 1 17.5 15', 'M12.5 12l-2 4h3l-2 4.5'],
    moon: ['M20 14.5A8.5 8.5 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z'],
    wave: ['M2 10c2-2 4-2 6 0s4 2 6 0 4-2 6 0M2 15.5c2-2 4-2 6 0s4 2 6 0 4-2 6 0'],
    bomb: [C(10, 14, 7), 'M15 9l2-2M17 7c.5-1.5 1.5-2.5 3-2.5', 'M7 12a3 3 0 0 1 3-2.5'],
    chain: ['M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1'],
    shirt: ['M8.5 3L3 6l2 5 3-1v11h8V10l3 1 2-5-5.5-3a3.5 3.5 0 0 1-7 0z'],
    helmet: ['M3.5 17a8.5 8.5 0 0 1 17 0z', 'M2 17h20M12 8.5V12'],
    medal: [C(12, 15, 5.5), 'M8 3l4 6.5L16 3', 'M12 12.5v5M10 15h4'],
    ring: [C(12, 15, 6), 'M9 4.5h6l-3 4z'],
    gift: [R(3, 8, 18, 4.5, 1), 'M5 12.5V21h14v-8.5M12 8v13', 'M12 8C10.5 4.5 6.8 4.3 7.3 6.8 7.6 8 12 8 12 8s4.4 0 4.7-1.2C17.2 4.3 13.5 4.5 12 8z'],
    box: ['M3 7l9-4 9 4v10l-9 4-9-4z', 'M3 7l9 4 9-4M12 11v10'],
    plug: ['M9 2.5v5M15 2.5v5M6 7.5h12v3.5a6 6 0 0 1-12 0zM12 17v4.5'],
    battery: [R(2, 7, 17, 10, 2), 'M22 10.5v3M6 10.5v3M10 10.5v3M14 10.5v3'],
    pin: ['M12 21.5s7-6.5 7-12a7 7 0 0 0-14 0c0 5.5 7 12 7 12z', C(12, 9.5, 2.5)],
    chart: ['M3.5 3.5v17h17', 'M7.5 15l4-4 3 3 5.5-6.5'],
    sleep: ['M4 8.5h6l-6 8h6M14 4h6l-6 7h6'],
    info: [C(12, 12, 9), 'M12 11v6M12 7.5v.5'],
    pause: ['M8.5 5v14M15.5 5v14'],
    full: ['M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5'],
    up: ['M12 20V4.5M5.5 11L12 4.5 18.5 11'],
    food: ['M7 3v8M5 3v5a2 2 0 0 0 4 0V3M7 11v10M17.5 3c-2 0-3.5 3-3.5 7.5h3.5V21'],
    face: [C(12, 12, 9), 'f:' + C(9, 10, 1.2), 'f:' + C(15, 10, 1.2), 'M8.5 14.5c2 2 5 2 7 0'],
    candle: [R(9, 10, 6, 11, 1), 'M12 10V7.5', 'M12 2.5c1.6 1.6 1.6 3.3 0 4.4-1.6-1.1-1.6-2.8 0-4.4z'],
    balloon: ['M12 3a6 6 0 0 1 6 6.2c0 3.9-3 6.8-6 6.8S6 13.1 6 9.2A6 6 0 0 1 12 3z', 'M12 16l-1 1.6h2L12 16v5.5'],
    star: ['M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z'],
    exclaim: ['M12 4v10.5M12 18.5v1'],
    question: ['M9 9a3 3 0 1 1 6 0c0 2.2-3 2.5-3 5M12 18v1'],
    circle: [C(12, 12, 8)],
    bone: ['M8.8 7.2l8 8', 'f:' + C(6, 7, 2), 'f:' + C(7.2, 4.8, 2), 'f:' + C(18, 17.2, 2), 'f:' + C(16.8, 19.4, 2)],
    wand: ['M4 20L15.5 8.5', 'M18 2.5v4M16 4.5h4M20.5 9v2M19.5 10h2M13 3v2M12 4h2'],
    compass: [C(12, 12, 9), 'M15.5 8.5l-2 5-5 2 2-5z'],
    hole: ['f:' + E(12, 15, 8.5, 3.6), 'M3.5 15a8.5 3.6 0 0 1 17 0'],
    scissors: [C(6, 6, 3), C(6, 18, 3), 'M8.5 7.6L20 18M8.5 16.4L20 6'],
    blaster: ['M3 8.5h15l2.5 2.5-2.5 2.5h-7l-2 6H6l1-6H3z'],
    sun: [C(12, 12, 4), 'M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8'],
    download: ['M12 3.5v12M7 11l5 5 5-5', 'M4 20.5h16'],
    grid: [R(3.5, 3.5, 7, 7, 1.5), R(13.5, 3.5, 7, 7, 1.5), R(3.5, 13.5, 7, 7, 1.5), R(13.5, 13.5, 7, 7, 1.5)],
    play: ['f:M8 5.5v13l10.5-6.5z'],
    chevron: ['M9 5.5l6.5 6.5L9 18.5'],
    gamepad: ['M7 7.5h10a5 5 0 0 1 4.8 6.4l-1 3.4a2.4 2.4 0 0 1-4.1 1L14.5 16h-5l-2.2 2.3a2.4 2.4 0 0 1-4.1-1l-1-3.4A5 5 0 0 1 7 7.5z', 'M7.5 10.5v3M6 12h3', 'f:' + C(15.5, 11, 1.1), 'f:' + C(17.5, 13, 1.1)],
    clock: [C(12, 12, 9), 'M12 7v5l3 2']
  };
  function dot(c) { return ['f' + c + ':' + C(12, 12, 7.5)]; }
  function sq(c) { return ['f' + c + ':' + R(4.5, 4.5, 15, 15, 3)]; }
  // ---------- 이모지 → 그림 이름 ----------
  var MAP = {
    shield: '🛡🔰', x: '❌✖', check: '✅✔☑', home: '🏠🏡', bolt: '⚡', globe: '🌐🌍🌎🌏', crown: '👑', sword: '🗡🔪🤺', swords: '⚔',
    dna: '🧬', target: '🎯', flask: '🧪⚗🧫🫙🧴', hourglass: '⏳⌛', spiral: '🌀💫', rocket: '🚀', trophy: '🏆', microbe: '🦠🍄',
    search: '🔎🔍', microscope: '🔬', user: '👤👼🙂', users: '👥🤝', warning: '⚠', skull: '☠💀😵', ghost: '👻', speaker: '🔊🔉🔈',
    mute: '🔇', snow: '❄🌨🥶', hazard: '☣☢', wind: '💨🌫🌪', coin: '🪙💰', bow: '🏹', repeat: '🔁🔄🔃', shuffle: '🔀', music: '🎵🎶🎼',
    headphones: '🎧', robot: '🤖', burst: '💥💢🎉', sparkle: '✨✳✴🎆🎇', drop: '💧💦', web: '🕸', spider: '🕷🦟', fire: '🔥♨☄',
    timer: '⏱⏲', phone: '📱📲', phoneoff: '📴', clipboard: '📋', book: '📖📕📜', map: '🗺', orb: '🔮', brick: '🧱',
    rock: '🪨🗿', leaf: '🌿🌱🥀🌵🍃', tree: '🌳🌲', hammer: '⚒🔨⛏🪓', boot: '👢🥾👟🥿🩴🩰🦿🦵', dice: '🎲', key: '🔑🗝', door: '🚪',
    castle: '🏰⛩🏢🗼🏮', gear: '⚙', lock: '🔒🔐', unlock: '🔓', megaphone: '📢📣📯🗣', satellite: '📡', signal: '📶', syringe: '💉',
    pill: '💊🩹', bubble: '🫧', chat: '💬', plus: '➕✚', divide: '➗', eye: '👁🥽', hand: '👋✋🖐🙋👍🧤', dumbbell: '💪🦾👊',
    runner: '🏃🤸🥷', bulb: '💡', paw: '🐾🐌🐢🦬', gem: '💎', lungs: '🫁', brain: '🧠', car: '🏎🚗', cloud: '☁', storm: '🌧🌩⛈',
    moon: '🌙', wave: '🌊', bomb: '💣🧨', chain: '⛓🔗', shirt: '🦺🥼🧥👘🧣', helmet: '🪖⛑🧢🎩', medal: '🎖🎗🎀📿🏅', ring: '💍',
    gift: '🎁', box: '📦🛒🎒🧶', plug: '🔌', battery: '🔋', pin: '📍', chart: '📈', sleep: '💤', info: 'ℹ', pause: '⏸',
    full: '⛶', up: '⬆', food: '🍽🥖🍬🧃🍷🌽🍇🌰', face: '😊😐😈😷😋😀😄', candle: '🕯', balloon: '🎈', star: '⭐🌟',
    exclaim: '❗❕', question: '❔❓', circle: '⭕', bone: '🦴', wand: '🪄🔱🦯', compass: '🧭', hole: '🕳', scissors: '✂',
    blaster: '🔫', gamepad: '🎮🕹', clock: '⏰🕒', sun: '☀🌞'
  };
  var COLOR = {
    '🔴': dot('#ef4444'), '🟢': dot('#22c55e'), '🔵': dot('#3b82f6'), '🟡': dot('#eab308'), '🟠': dot('#f97316'), '🟣': dot('#a855f7'),
    '⚪': dot('#e5e7eb'), '⚫': dot('#1f2937'), '🌑': dot('#374151'), '🟤': dot('#92400e'),
    '🟥': sq('#ef4444'), '🟧': sq('#f97316'), '🟨': sq('#eab308'), '🟩': sq('#22c55e'), '🟦': sq('#3b82f6'), '🟪': sq('#a855f7'),
    '🟫': sq('#92400e'), '⬛': sq('#1f2937'), '⬜': sq('#f3f4f6'),
    '❤': ['f#ef4444:' + HEART], '💚': ['f#22c55e:' + HEART], '💜': ['f#a855f7:' + HEART], '💗': ['f#ec4899:' + HEART],
    '💛': ['f#eab308:' + HEART], '💙': ['f#3b82f6:' + HEART], '🧡': ['f#f97316:' + HEART], '🩸': ['f#dc2626:' + I.drop[0]],
    '🔺': ['f#ef4444:M12 5l8 13.5H4z'], '🔻': ['f#ef4444:M12 19L4 5.5h16z'], '🔶': ['f#f97316:' + I.diamond[0]],
    '🔸': ['f#f97316:M12 7l5 5-5 5-5-5z'], '💠': ['f#38bdf8:' + I.diamond[0]]
  };
  var EMO = {};
  Object.keys(MAP).forEach(function (n) { Array.from(MAP[n]).forEach(function (ch) { EMO[ch] = I[n]; }); });
  Object.keys(COLOR).forEach(function (ch) { EMO[ch] = COLOR[ch]; });
  // 숫자 키캡(🔟, 1️⃣ …)은 그냥 숫자 글자로
  var KEYCAP = {'🔟': '10'};
  function esc(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
  var keys = Object.keys(EMO).sort(function (a, b) { return b.length - a.length; });
  // 지도에 없는 그림 이모지도 지우거나 점으로 바꿈 (화살표·★·♥ 같은 일반 기호는 그대로 둠)
  var RE_SRC = '(?:' + keys.map(esc).join('|') + '|🔟|[\\u0030-\\u0039#*]\\uFE0F?\\u20E3|\\p{Extended_Pictographic}(?=\\uFE0F)|\\p{Emoji_Presentation})\\uFE0F?(?:\\u200D\\p{Extended_Pictographic}\\uFE0F?)*[\\u{1F3FB}-\\u{1F3FF}]?';
  var RE;
  try { RE = new RegExp(RE_SRC, 'gu'); } catch (e) { RE = new RegExp('(?:' + keys.map(esc).join('|') + ')\\uFE0F?', 'g'); }
  var KEEP = /^[#*0-9]$/;          // Emoji_Presentation이 아닌 숫자·기호는 남김
  var QUICK = /[ℹ←-⯿〰〽㊗㊙\uD83C-\uD83E]/;
  var DOT = ['f:' + C(12, 12, 3.5)];
  var EP; try { EP = new RegExp('\\p{Emoji_Presentation}', 'u'); } catch (e) { EP = /[\uD83C-\uD83E]/; }
  // 토큰 하나 → {t: 글자} 또는 {p: 그림 조각}
  function resolve(tok) {
    var plain = tok.replace(/\uFE0F/g, '');
    if (KEYCAP[plain]) return {t: KEYCAP[plain]};
    var m = /^([0-9#*])\u20E3/.exec(plain); if (m) return {t: m[1]};
    var base = plain.replace(/[\u{1F3FB}-\u{1F3FF}]/gu, '');
    if (EMO[base]) return {p: EMO[base]};
    var first = Array.from(base)[0];
    if (EMO[first]) return {p: EMO[first]};
    if (KEEP.test(first) || !EP.test(first)) return {t: first};   // ♥️ ↔️ 같은 일반 기호는 글자로 남김
    return {p: DOT};
  }
  // ---------- SVG 문자열 ----------
  function svgInner(parts) {
    return parts.map(function (p) {
      var m = /^f(#[0-9a-fA-F]{3,8})?:/.exec(p);
      if (m) return '<path d="' + p.slice(m[0].length) + '" fill="' + (m[1] || 'currentColor') + '" stroke="none"/>';
      return '<path d="' + p + '"/>';
    }).join('');
  }
  var SVG_HEAD = '<svg class="pg" viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">';
  function svg(name) { var p = typeof name === 'string' ? I[name] : name; return p ? SVG_HEAD + svgInner(p) + '</svg>' : ''; }
  // ---------- 글자 바꾸기 ----------
  function strip(s) {
    if (!s || !QUICK.test(s)) return s;
    RE.lastIndex = 0;
    return s.replace(RE, function (t) { var r = resolve(t); return r.t != null ? r.t : ''; }).replace(/ {2,}/g, ' ').replace(/^\s+(?=\S)/, function (w) { return w.indexOf('\n') >= 0 ? w : ''; });
  }
  var tplCache = {};
  function svgNode(parts) {
    var key = parts.join('|');
    var t = tplCache[key];
    if (!t) { var d = document.createElement('div'); d.innerHTML = SVG_HEAD + svgInner(parts) + '</svg>'; t = tplCache[key] = d.firstChild; }
    return t.cloneNode(true);
  }
  var SKIP = {SCRIPT: 1, STYLE: 1, TEXTAREA: 1, NOSCRIPT: 1, TEMPLATE: 1, CODE: 1, PRE: 0};
  var STRIP_ONLY = {TITLE: 1, OPTION: 1, OPTGROUP: 1, SELECT: 1};
  function fixText(n) {
    var s = n.nodeValue;
    if (!s || !QUICK.test(s)) return;
    var p = n.parentNode; if (!p) return;
    var tag = p.nodeName;
    if (SKIP[tag]) return;
    RE.lastIndex = 0;
    if (!RE.test(s)) return;
    if (STRIP_ONLY[tag] || p.namespaceURI === 'http://www.w3.org/2000/svg' || (p.closest && p.closest('svg,select'))) { n.nodeValue = strip(s); return; }
    RE.lastIndex = 0;
    var frag = document.createDocumentFragment(), last = 0, m, any = false;
    while ((m = RE.exec(s))) {
      var tok = m[0]; if (!tok) { RE.lastIndex++; continue; }
      var r = resolve(tok);
      if (r.t === tok) continue;
      if (m.index > last) frag.appendChild(document.createTextNode(s.slice(last, m.index)));
      frag.appendChild(r.p ? svgNode(r.p) : document.createTextNode(r.t));
      last = m.index + tok.length; any = true;
    }
    if (!any) return;
    if (last < s.length) frag.appendChild(document.createTextNode(s.slice(last)));
    p.replaceChild(frag, n);
  }
  var ATTRS = ['title', 'placeholder', 'aria-label', 'alt', 'data-tip'];
  function fixAttrs(el) {
    for (var i = 0; i < ATTRS.length; i++) {
      var v = el.getAttribute && el.getAttribute(ATTRS[i]);
      if (v && QUICK.test(v)) { var w = strip(v); if (w !== v) el.setAttribute(ATTRS[i], w.trim()); }
    }
    if (el.tagName === 'INPUT' && /^(button|submit|reset)$/i.test(el.type) && QUICK.test(el.value)) el.value = strip(el.value).trim();
  }
  function fillIc(el) {
    var n = el.getAttribute('data-ic');
    if (n && I[n] && !el.firstChild) el.innerHTML = svg(n);
  }
  function scan(root) {
    if (!root) return;
    if (root.nodeType === 3) { fixText(root); return; }
    if (root.nodeType !== 1 && root.nodeType !== 11) return;
    if (root.nodeType === 1) {
      if (SKIP[root.nodeName]) return;
      fixAttrs(root);
      if (root.hasAttribute('data-ic')) fillIc(root);
    }
    var els = root.querySelectorAll ? root.querySelectorAll('[title],[placeholder],[aria-label],[alt],[data-tip],input,[data-ic]') : [];
    for (var i = 0; i < els.length; i++) { fixAttrs(els[i]); if (els[i].hasAttribute('data-ic')) fillIc(els[i]); }
    var w = document.createTreeWalker(root, 4, null), list = [], t;
    while ((t = w.nextNode())) if (QUICK.test(t.nodeValue)) list.push(t);
    for (var j = 0; j < list.length; j++) fixText(list[j]);
  }
  function css() {
    if (document.getElementById('bioIconCss')) return;
    var s = document.createElement('style'); s.id = 'bioIconCss';
    s.textContent = 'svg.pg{display:inline-block;width:1.05em;height:1.05em;vertical-align:-.16em;flex:none;overflow:visible}';
    (document.head || document.documentElement).appendChild(s);
  }
  var started = false;
  function start() {
    if (started) return; started = true;
    css();
    if (document.title) document.title = strip(document.title).trim();
    scan(document.body || document.documentElement);
    new MutationObserver(function (ms) {
      for (var i = 0; i < ms.length; i++) {
        var m = ms[i];
        if (m.type === 'characterData') fixText(m.target);
        else if (m.type === 'attributes') fixAttrs(m.target);
        else for (var j = 0; j < m.addedNodes.length; j++) scan(m.addedNodes[j]);
      }
    }).observe(document.documentElement, {childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS});
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
  // 알림창은 그림을 못 넣으니 이모지만 지움
  ['alert', 'confirm', 'prompt'].forEach(function (k) {
    var f = window[k]; if (typeof f !== 'function') return;
    window[k] = function (msg) { var a = Array.prototype.slice.call(arguments); if (typeof msg === 'string') a[0] = strip(msg); return f.apply(window, a); };
  });
  // ---------- 캔버스 ----------
  var pathCache = {};
  function paths(parts) {
    var key = parts.join('|'), c = pathCache[key];
    if (!c) {
      c = pathCache[key] = parts.map(function (p) {
        var m = /^f(#[0-9a-fA-F]{3,8})?:/.exec(p);
        return m ? {fill: m[1] || true, p: new Path2D(p.slice(m[0].length))} : {p: new Path2D(p)};
      });
    }
    return c;
  }
  function fontPx(ctx) { var m = /(\d+(?:\.\d+)?)px/.exec(ctx.font); return m ? +m[1] : 10; }
  function tokens(s) {
    RE.lastIndex = 0;
    var out = [], last = 0, m;
    while ((m = RE.exec(s))) {
      var tok = m[0]; if (!tok) { RE.lastIndex++; continue; }
      var r = resolve(tok);
      if (!r.p) continue;
      if (m.index > last) out.push(s.slice(last, m.index));
      out.push(r.p);
      last = m.index + tok.length;
    }
    if (!out.length) return null;
    if (last < s.length) out.push(s.slice(last));
    return out;
  }
  function patch(P) {
    if (!P || P.__bioIcon) return;
    P.__bioIcon = true;
    var oFill = P.fillText, oStroke = P.strokeText, oMeasure = P.measureText;
    function layout(ctx, toks, size) {
      var w = 0, ws = [];
      for (var i = 0; i < toks.length; i++) { var t = toks[i]; var a = typeof t === 'string' ? oMeasure.call(ctx, t).width : size * 1.08; ws.push(a); w += a; }
      return {w: w, ws: ws};
    }
    function draw(ctx, text, x, y, maxW, stroke) {
      var toks = tokens(String(text));
      if (!toks) return false;
      var size = fontPx(ctx), L = layout(ctx, toks, size);
      var al = ctx.textAlign, dir = ctx.direction === 'rtl';
      var x0 = x;
      if (al === 'center') x0 = x - L.w / 2;
      else if (al === 'right' || (al === 'end' && !dir) || (al === 'start' && dir)) x0 = x - L.w;
      var k = maxW != null && maxW > 0 && L.w > maxW ? maxW / L.w : 1;
      var bl = ctx.textBaseline, top;
      if (bl === 'top' || bl === 'hanging') top = y + size * .04;
      else if (bl === 'middle') top = y - size * .5;
      else if (bl === 'bottom' || bl === 'ideographic') top = y - size * 1.0;
      else top = y - size * .86;
      ctx.save();
      ctx.textAlign = 'left';
      if (k !== 1) { ctx.translate(x0, 0); ctx.scale(k, 1); ctx.translate(-x0, 0); }
      var cx = x0, col = ctx.fillStyle;
      for (var i = 0; i < toks.length; i++) {
        var t = toks[i];
        if (typeof t === 'string') { (stroke ? oStroke : oFill).call(ctx, t, cx, y); }
        else if (!stroke) {
          var d = size * .98, s = d / 24;
          ctx.save();
          ctx.translate(cx + (L.ws[i] - d) / 2, top);
          ctx.scale(s, s);
          ctx.lineWidth = 2.1; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
          ctx.strokeStyle = col; ctx.setLineDash && ctx.setLineDash([]);
          var ps = paths(t);
          for (var j = 0; j < ps.length; j++) {
            var q = ps[j];
            if (q.fill) { ctx.fillStyle = q.fill === true ? col : q.fill; ctx.fill(q.p); }
            else ctx.stroke(q.p);
          }
          ctx.restore();
        }
        cx += L.ws[i];
      }
      ctx.restore();
      return true;
    }
    P.fillText = function (text, x, y, maxW) {
      if (typeof text === 'string' && QUICK.test(text) && draw(this, text, x, y, maxW, false)) return;
      return arguments.length > 3 ? oFill.call(this, text, x, y, maxW) : oFill.call(this, text, x, y);
    };
    P.strokeText = function (text, x, y, maxW) {
      if (typeof text === 'string' && QUICK.test(text) && draw(this, text, x, y, maxW, true)) return;
      return arguments.length > 3 ? oStroke.call(this, text, x, y, maxW) : oStroke.call(this, text, x, y);
    };
    P.measureText = function (text) {
      var m = oMeasure.call(this, text);
      if (typeof text !== 'string' || !QUICK.test(text)) return m;
      var toks = tokens(text); if (!toks) return m;
      var w = layout(this, toks, fontPx(this)).w, o = {};
      for (var key in m) { try { o[key] = m[key]; } catch (e) {} }
      ['actualBoundingBoxAscent', 'actualBoundingBoxDescent', 'actualBoundingBoxLeft', 'fontBoundingBoxAscent', 'fontBoundingBoxDescent'].forEach(function (key) { if (o[key] == null && m[key] != null) o[key] = m[key]; });
      o.width = w; o.actualBoundingBoxRight = w;
      return o;
    };
  }
  try { patch(window.CanvasRenderingContext2D && CanvasRenderingContext2D.prototype); } catch (e) {}
  try { patch(window.OffscreenCanvasRenderingContext2D && OffscreenCanvasRenderingContext2D.prototype); } catch (e) {}
  window.BioIcon = {svg: svg, names: Object.keys(I), strip: strip, scan: scan, map: EMO};
})();
