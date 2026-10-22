// 화면 그리기와 조작
(function () {
  var cfg = MODU_CONFIG;
  var L = ModuLogic;
  var COLS = cfg.cols, ROWS = cfg.rows;
  var SAVE_KEY = 'modu-toilet-board-v3';
  var OLD_SAVE_KEY = 'modu-toilet-board-v2';  // 손잡이 기본 방향이 가로였던 때
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var $ = function (id) { return document.getElementById(id); };
  var canvas = $('board'), ctx = canvas.getContext('2d');
  var wrap = $('board-wrap');

  var state = {
    board: load() || L.createBoard(cfg),
    tool: 'select',
    selected: -1,    // 선택한 설비 번호
    band: 2,         // 새로 붙일 벽 물건의 높이 단 (높이를 고를 수 있는 물건만)
    cam: { scale: 20, ox: 0, oy: 0, fit: 20 },
    hover: null,
    pan: false,
    run: null,       // 테스트 진행 상태
    results: {},     // 이용객별 마지막 결과
    picked: MODU_CONFIG.visitors[0].id,  // 테스트하기로 시험할 이용객
    dirty: true
  };

  // ---------- 그림 불러오기 (없으면 임시 그림) ----------
  var images = {};
  function tryImage(name, src) {
    var img = new Image();
    img.onload = function () { images[name] = img; state.dirty = true; drawPalette(); };
    img.src = src;
  }
  cfg.items.forEach(function (it) {
    tryImage('item:' + it.id, 'assets/items/' + it.id + '.png');
    // a: 위쪽 벽(방향 0), b: 왼쪽 벽(3), c: 아래쪽 벽(2), d: 오른쪽 벽(1). c·d가 없으면 a·b를 씀
    if (it.layer === 'floor' || it.layer === 'wall') ['a', 'b', 'c', 'd'].forEach(function (d) { tryImage('iso:' + it.id + ':' + d, 'assets/items/' + it.id + '_iso_' + d + '.png'); });
  });
  ['floor', 'wall', 'entrance', 'tactile'].forEach(function (id) { tryImage('item:' + id, 'assets/items/' + id + '.png'); });
  tryImage('iso:tactile:a', 'assets/items/tactile_iso_a.png');  // 마름모 보기용 점자블록 타일
  cfg.visitors.forEach(function (v) {
    // walk_a: ↗ 오른쪽 위로 갈 때, walk_b: ↖ 왼쪽 위로 갈 때 쓰는 뒷모습, happy/sad: 도착했을 때
    // front_a: ↘ 오른쪽 아래로 갈 때, front_b: ↙ 왼쪽 아래로 갈 때 쓰는 앞모습 (없으면 직전 뒷모습 유지)
    ['normal', 'happy', 'sad', 'walk_a', 'walk_b', 'front_a', 'front_b'].forEach(function (f) { tryImage('visitor:' + v.id + ':' + f, 'assets/visitors/' + v.id + '_' + f + '.png'); });
  });

  // ---------- 저장 ----------
  // 바뀔 때마다 이전 판을 쌓아 두어 되돌리기·다시하기에 씀
  var history = { undo: [], redo: [], last: null, max: 100 };
  function save(fromHistory) {
    var now = JSON.stringify(state.board);
    if (!fromHistory && history.last !== null && now !== history.last) {
      history.undo.push(history.last);
      if (history.undo.length > history.max) history.undo.shift();
      history.redo = [];
    }
    history.last = now;
    updateUndoButtons();
    try { localStorage.setItem(SAVE_KEY, now); } catch (e) {}
  }
  function restore(json) {
    state.board = JSON.parse(json);
    select(-1); changed(); save(true);
  }
  function undo() {
    if (state.run || !history.undo.length) return;
    history.redo.push(history.last);
    restore(history.undo.pop());
    showInfo('<b>↶ 되돌리기</b> · 한 단계 전으로 돌아갔어요.');
  }
  function redo() {
    if (state.run || !history.redo.length) return;
    history.undo.push(history.last);
    restore(history.redo.pop());
    showInfo('<b>↷ 다시하기</b> · 되돌린 것을 다시 했어요.');
  }
  function updateUndoButtons() {
    var u = document.getElementById('btn-undo'), r = document.getElementById('btn-redo');
    if (!u || !r) return;
    u.disabled = !!state.run || !history.undo.length;
    r.disabled = !!state.run || !history.redo.length;
  }
  function load() {
    try {
      var d = JSON.parse(localStorage.getItem(SAVE_KEY)), old = false;
      if (!d) { d = JSON.parse(localStorage.getItem(OLD_SAVE_KEY)); old = true; }
      if (!d || d.cols !== COLS || d.rows !== ROWS || !Array.isArray(d.objects)) return null;
      d.objects = d.objects.filter(function (o) { return L.itemById(cfg, o.id); });
      // 돌릴 수 있는 방향이 줄어든 설비(예: 오스토미 세척대)는 첫 방향으로 맞춤
      d.objects.forEach(function (o) {
        var rots = L.itemById(cfg, o.id).rotations;
        if (rots && rots.indexOf(o.rot) === -1) o.rot = rots[0];
      });
      // 예전 저장본의 손잡이는 한 번 돌려야 같은 자리를 차지함
      if (old) d.objects.forEach(function (o) { if (o.id === 'grabBar') o.rot = (o.rot + 1) % 4; });
      // 예전 저장본: 바깥 벽 칸에 붙어 있던 비상벨은 벽 옆 칸의 가운데 높이 물건으로 옮김
      for (var y = 0; y < ROWS; y++) for (var x = 0; x < COLS; x++) {
        if (d.wall[y][x] !== 'bell') continue;
        d.wall[y][x] = null;
        if (y === 0 && x > 0) d.objects.push({ id: 'bell', x: x, y: 1, rot: 0, band: 2 });
        else if (x === 0 && y > 0) d.objects.push({ id: 'bell', x: 1, y: y, rot: 3, band: 2 });
      }
      // 규칙이 바뀌어 지금은 놓을 수 없는 설비(예: 예전 2×2 휴지걸이)는 버림
      var objs = d.objects;
      d.objects = [];
      objs.forEach(function (o) { if (L.fits(d, cfg, o, -1).ok) d.objects.push(o); });
      return d;
    } catch (e) { return null; }
  }

  // ---------- 타일 그리기 ----------
  var C = {
    floor: '#f4f2ec', floorLine: '#e2ded3',
    wall: '#3f4654', wallTop: '#575f6f',
    tactile: '#f2c230', tactileDot: '#c99a12',
    entrance: '#3fa66b'
  };

  function roundRect(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
  }

  function drawFloor(c, x, y, s) {
    var img = images['item:floor'];
    if (img) { c.drawImage(img, x, y, s, s); return; }
    c.fillStyle = C.floor; c.fillRect(x, y, s, s);
    c.strokeStyle = C.floorLine; c.lineWidth = 1;
    c.strokeRect(x + 0.5, y + 0.5, s - 1, s - 1);
  }

  function drawWall(c, x, y, s) {
    var img = images['item:wall'];
    if (img) { c.drawImage(img, x, y, s, s); return; }
    c.fillStyle = C.wall; c.fillRect(x, y, s, s);
    c.fillStyle = C.wallTop; c.fillRect(x, y, s, s * 0.22);
  }

  function drawTactile(c, x, y, s) {
    var img = images['item:tactile'];
    if (img) { c.drawImage(img, x, y, s, s); return; }
    c.fillStyle = C.tactile; c.fillRect(x, y, s, s);
    c.fillStyle = C.tactileDot;
    for (var i = 0; i < 3; i++) for (var j = 0; j < 3; j++) {
      c.beginPath(); c.arc(x + s * (0.2 + i * 0.3), y + s * (0.2 + j * 0.3), s * 0.07, 0, 7); c.fill();
    }
  }

  // 바깥 벽에 붙이는 물건 (점자 안내판, 비상벨)
  function drawWallItem(c, id, x, y, s) {
    var img = images['item:' + id];
    if (img) { c.drawImage(img, x, y, s, s); return; }
    if (id === 'braille') return drawBraille(c, x, y, s);
    var it = L.itemById(cfg, id);
    c.fillStyle = '#ffffff'; roundRect(c, x + s * 0.14, y + s * 0.14, s * 0.72, s * 0.72, s * 0.1); c.fill();
    drawEmoji(c, it.emoji, x + s / 2, y + s / 2, s * 0.5);
  }

  function drawBraille(c, x, y, s) {
    c.fillStyle = '#ffffff'; roundRect(c, x + s * 0.14, y + s * 0.14, s * 0.72, s * 0.72, s * 0.1); c.fill();
    c.fillStyle = '#1d5fb8';
    [[0, 0], [0, 1], [1, 1], [0, 2], [1, 0]].forEach(function (p) {
      c.beginPath(); c.arc(x + s * (0.4 + p[0] * 0.2), y + s * (0.32 + p[1] * 0.18), s * 0.06, 0, 7); c.fill();
    });
  }

  function drawEmoji(c, e, cx, cy, size) {
    c.font = Math.round(size) + 'px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillStyle = '#000';
    c.fillText(e, cx, cy + size * 0.06);
  }

  // 설비 하나 그리기. (x, y)는 픽셀 좌표, rot은 0~3
  function drawObject(c, id, rot, x, y, s, alpha) {
    var it = L.itemById(cfg, id);
    var bw = it.w * s, bh = it.h * s;         // 기본 방향 크기
    var w = rot % 2 ? bh : bw, h = rot % 2 ? bw : bh;
    c.save();
    if (alpha !== undefined) c.globalAlpha = alpha;
    var img = images['item:' + id];
    if (img) {
      c.translate(x + w / 2, y + h / 2);
      c.rotate(rot * Math.PI / 2);
      c.drawImage(img, -bw / 2, -bh / 2, bw, bh);
      c.restore();
      return;
    }
    var pad = s * 0.08;
    if (id === 'grabBar') {
      var horizontal = w > h;
      c.strokeStyle = it.color; c.lineWidth = s * 0.3; c.lineCap = 'round';
      c.beginPath();
      if (horizontal) { c.moveTo(x + s * 0.4, y + h / 2); c.lineTo(x + w - s * 0.4, y + h / 2); }
      else { c.moveTo(x + w / 2, y + s * 0.4); c.lineTo(x + w / 2, y + h - s * 0.4); }
      c.stroke();
      c.restore();
      return;
    }
    c.fillStyle = it.color || '#ffffff';
    roundRect(c, x + pad, y + pad, w - pad * 2, h - pad * 2, s * 0.3); c.fill();
    c.strokeStyle = 'rgba(0,0,0,0.22)'; c.lineWidth = 1.5; c.stroke();
    // 벽에 붙는 쪽 표시 (기본 방향은 위쪽)
    c.fillStyle = 'rgba(40,52,70,0.55)';
    var t = Math.max(2, s * 0.22);
    if (rot === 0) c.fillRect(x + pad * 2, y + pad, w - pad * 4, t);
    if (rot === 1) c.fillRect(x + w - pad - t, y + pad * 2, t, h - pad * 4);
    if (rot === 2) c.fillRect(x + pad * 2, y + h - pad - t, w - pad * 4, t);
    if (rot === 3) c.fillRect(x + pad, y + pad * 2, t, h - pad * 4);
    drawEmoji(c, it.emoji, x + w / 2, y + h / 2, Math.min(w, h) * 0.55);
    if (id === 'sinkLow') {
      c.fillStyle = '#1f7f66';
      c.font = '800 ' + Math.round(s * 0.8) + 'px sans-serif';
      c.textAlign = 'right'; c.textBaseline = 'bottom';
      c.fillText('↓', x + w - pad * 1.5, y + h - pad * 0.5);
    }
    c.restore();
  }

  // ---------- 보기 방식: 마름모(쿼터뷰)만 씀. 'flat'(네모) 그리기 코드는 남겨 둠 ----------
  var WALL_H = 1.7;  // 마름모 보기에서 뒤쪽 벽 높이 (칸 너비 기준)
  // 벽 색: 블루블랙. 뒤쪽 높은 벽(back)과 앞쪽 낮은 벽(front)
  var WALL_C = { back: '#5a6273', front: '#4a5160', line: 'rgba(160,172,196,0.45)', rows: 3 };
  state.view = 'iso';

  // 보드 전체가 화면에서 차지하는 크기와, 그 안에서 (0,0) 칸 모서리의 위치 (모두 scale에 비례)
  function layout(s) {
    if (state.view === 'flat') return { w: COLS * s, h: ROWS * s, ax: 0, ay: 0 };
    return { w: (COLS + ROWS) * s / 2, h: (COLS + ROWS) * s / 4 + WALL_H * s, ax: ROWS * s / 2, ay: WALL_H * s };
  }
  // 마름모 보기: 바닥 좌표 → 화면 좌표
  function P(x, y, s) { return { x: (x - y) * s / 2, y: (x + y) * s / 4 }; }

  function setView(v) {
    state.view = v;
    state.cam.zoomed = false;
    resize();
  }

  // ---------- 화면 크기와 카메라 ----------
  var dpr = 1;
  var hintHidden = false;
  function resize() {
    dpr = window.devicePixelRatio || 1;
    var r = wrap.getBoundingClientRect();
    canvas.width = Math.round(r.width * dpr);
    canvas.height = Math.round(r.height * dpr);
    var prevFit = state.cam.fit, unit = layout(1);
    state.cam.fit = Math.min(r.width / unit.w, r.height / unit.h);
    if (!state.cam.zoomed || !prevFit) fitView(); else clampCam();
    updateHint();
    state.dirty = true;
  }
  function updateHint() {
    $('rotate-hint').hidden = !(window.innerWidth < 600 && window.innerHeight > window.innerWidth && !hintHidden && state.selected === -1);
  }
  function fitView() {
    var r = wrap.getBoundingClientRect();
    var s = state.cam.fit, lay = layout(s);
    state.cam.scale = s;
    state.cam.ox = (r.width - lay.w) / 2;
    state.cam.oy = (r.height - lay.h) / 2;
    state.cam.zoomed = false;
    state.dirty = true;
  }
  function clampCam() {
    var r = wrap.getBoundingClientRect(), cam = state.cam, lay = layout(cam.scale);
    cam.ox = lay.w <= r.width ? (r.width - lay.w) / 2 : Math.min(0, Math.max(r.width - lay.w, cam.ox));
    cam.oy = lay.h <= r.height ? (r.height - lay.h) / 2 : Math.min(0, Math.max(r.height - lay.h, cam.oy));
  }
  function zoomAt(factor, px, py) {
    var cam = state.cam;
    var ns = Math.max(cam.fit, Math.min(cam.fit * 5, cam.scale * factor));
    var wx = (px - cam.ox) / cam.scale, wy = (py - cam.oy) / cam.scale;
    cam.scale = ns;
    cam.ox = px - wx * ns; cam.oy = py - wy * ns;
    cam.zoomed = ns > cam.fit * 1.01;
    clampCam();
    state.dirty = true;
  }
  function rawCell(px, py) {
    var cam = state.cam, s = cam.scale, lay = layout(s);
    var lx = px - cam.ox - lay.ax, ly = py - cam.oy - lay.ay;
    if (state.view === 'flat') return { x: Math.floor(lx / s), y: Math.floor(ly / s) };
    var u = lx / (s / 2), v = ly / (s / 4);
    return { x: Math.floor((u + v) / 2), y: Math.floor((v - u) / 2) };
  }
  function toCell(px, py) {
    var c = rawCell(px, py);
    var ok = function (c) { return c.x >= 0 && c.y >= 0 && c.x < COLS && c.y < ROWS; };
    if (ok(c)) return c;
    // 마름모 보기: 뒤쪽 벽의 세워진 면을 누르면 그 벽 칸으로
    if (state.view === 'iso') {
      var s = state.cam.scale;
      for (var d = s / 8; d <= WALL_H * s; d += s / 8) {
        var w = rawCell(px, py + d);
        if (ok(w) && (w.x === 0 || w.y === 0)) return w;
      }
    }
    return null;
  }

  // ---------- 보드 그리기 ----------
  function draw() {
    var cam = state.cam, s = cam.scale, lay = layout(s);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingQuality = 'high';
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    state.tx = cam.ox + lay.ax; state.ty = cam.oy + lay.ay;
    ctx.translate(state.tx, state.ty);
    if (state.view === 'iso') drawIso(s); else drawFlat(s);
    ctx.restore();
  }

  function drawFlat(s) {
    var b = state.board, x, y;
    for (y = 0; y < ROWS; y++) for (x = 0; x < COLS; x++) {
      var px = x * s, py = y * s;
      if (L.isEntrance(cfg, x, y)) {
        if (images['item:entrance']) ctx.drawImage(images['item:entrance'], px, py, s, s);
        else { ctx.fillStyle = C.entrance; ctx.fillRect(px, py, s, s); }
      } else if (L.isBorder(b, x, y)) {
        drawWall(ctx, px, py, s);
        if (b.wall[y][x]) drawWallItem(ctx, b.wall[y][x], px, py, s);
      } else {
        drawFloor(ctx, px, py, s);
        if (b.tactile[y][x]) drawTactile(ctx, px, py, s);
      }
    }
    // 입구 글자
    var e = cfg.entrance, mid = (e[0].x + e[e.length - 1].x + 1) / 2;
    ctx.fillStyle = '#ffffff';
    ctx.font = '400 ' + Math.round(s * 0.7) + 'px ' + getComputedStyle(document.documentElement).getPropertyValue('--display');
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('입구', mid * s, (e[0].y + 0.55) * s);

    ['floor', 'w1', 'w2', 'w3'].forEach(function (level) {
      b.objects.forEach(function (o) {
        if (L.levelOf(cfg, o) !== level) return;
        drawObject(ctx, o.id, o.rot, o.x * s, o.y * s, s);
        if (L.itemById(cfg, o.id).bands && L.itemById(cfg, o.id).bands.length > 1) drawBandBadge(o, s);
      });
    });

    // 선택한 설비
    if (state.selected !== -1 && b.objects[state.selected]) {
      var so = b.objects[state.selected], sz = L.sizeOf(cfg, so);
      ctx.strokeStyle = '#1d5fb8'; ctx.lineWidth = 3; ctx.setLineDash([6, 4]);
      ctx.strokeRect(so.x * s - 2, so.y * s - 2, sz.w * s + 4, sz.h * s + 4);
      ctx.setLineDash([]);
    }
    // 놓을 자리 미리보기 (마우스)
    if (state.hover && !state.run && !state.pan) drawGhost(s);
    if (state.run) {
      var rv = runVisitor();
      if (rv) {
        var px = rv.wx * s, py = rv.wy * s, size = s * Math.max(1.8, rv.r.size * 0.95);
        drawVisitor(rv.v, px, py, size, rv.face);
        if (rv.arrived) drawBubble(rv.r.reason, px, headTop(rv.v, py, size) - s * 0.1, s, rv.r.ok);
      }
    }
  }

  // 높이를 고를 수 있는 벽 물건: 네모 보기에서 몇 단인지 작은 숫자로 표시
  function drawBandBadge(o, s) {
    var r = Math.max(6, s * 0.2), cx = (o.x + 1) * s - r, cy = o.y * s + r;
    ctx.fillStyle = '#1d5fb8'; ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.fill();
    ctx.fillStyle = '#ffffff'; ctx.font = '800 ' + Math.round(r * 1.3) + 'px sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(String(L.bandOf(cfg, o)), cx, cy + 0.5);
  }

  // 마우스를 올린 자리에 놓일 설비 (놓을 수 없는 칸이면 null)
  function ghostObject() {
    var it = L.itemById(cfg, state.tool), h = state.hover;
    if (it.layer !== 'floor' || sameLevelAt(h, it) !== -1) return null;
    var o = L.placement(state.board, cfg, it.id, h.x, h.y, 0, state.band);
    o.ok = L.fits(state.board, cfg, o, -1).ok;
    return o;
  }

  function drawGhost(s) {
    var o = ghostObject(), h = state.hover;
    if (o) {
      var sz = L.sizeOf(cfg, o);
      drawObject(ctx, o.id, 0, o.x * s, o.y * s, s, o.ok ? 0.55 : 0.25);
      ctx.strokeStyle = o.ok ? '#24855a' : '#c2453a'; ctx.lineWidth = 2;
      ctx.strokeRect(o.x * s + 1, o.y * s + 1, sz.w * s - 2, sz.h * s - 2);
    } else {
      ctx.strokeStyle = '#1d5fb8'; ctx.lineWidth = 2;
      ctx.strokeRect(h.x * s + 1, h.y * s + 1, s - 2, s - 2);
    }
  }

  // ---------- 마름모(아이소메트릭) 보기 ----------
  // 설비 높이 (칸 너비 기준). 임시 상자와 그림 크기에 씀
  var ISO_H = { childToilet: 0.6, toilet: 0.9, sink: 1.0, sinkLow: 0.7, diaper: 1.0, babySeat: 0.7, ostomy: 1.0, grabBar: 0.8, paperHolder: 0.6 };

  function shade(hex, k) {
    var n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    return 'rgb(' + Math.round(r * k) + ',' + Math.round(g * k) + ',' + Math.round(b * k) + ')';
  }

  function polygon(pts, dz) {
    ctx.beginPath();
    pts.forEach(function (p, i) { if (i) ctx.lineTo(p.x, p.y - (dz || 0)); else ctx.moveTo(p.x, p.y - (dz || 0)); });
    ctx.closePath();
  }

  // 바닥 (x, y)부터 w×h칸 상자의 네 모서리: 위, 오른쪽, 아래, 왼쪽
  function corners(x, y, w, h, s) { return [P(x, y, s), P(x + w, y, s), P(x + w, y + h, s), P(x, y + h, s)]; }

  function isoBox(x, y, w, h, z, color, s, alpha) {
    var c = corners(x, y, w, h, s);
    ctx.save();
    if (alpha !== undefined) ctx.globalAlpha = alpha;
    // 왼쪽 앞면
    ctx.beginPath(); ctx.moveTo(c[3].x, c[3].y); ctx.lineTo(c[2].x, c[2].y); ctx.lineTo(c[2].x, c[2].y - z); ctx.lineTo(c[3].x, c[3].y - z); ctx.closePath();
    ctx.fillStyle = shade(color, 0.78); ctx.fill();
    // 오른쪽 앞면
    ctx.beginPath(); ctx.moveTo(c[2].x, c[2].y); ctx.lineTo(c[1].x, c[1].y); ctx.lineTo(c[1].x, c[1].y - z); ctx.lineTo(c[2].x, c[2].y - z); ctx.closePath();
    ctx.fillStyle = shade(color, 0.64); ctx.fill();
    // 윗면
    polygon(c, z); ctx.fillStyle = color; ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 1; ctx.stroke();
    ctx.restore();
    return c;
  }

  function drawIsoFloor(x, y, s) {
    var b = state.board, c = corners(x, y, 1, 1, s);
    polygon(c);
    if (L.isEntrance(cfg, x, y)) ctx.fillStyle = C.entrance;
    else ctx.fillStyle = C.floor;
    ctx.fill();
    ctx.strokeStyle = C.floorLine; ctx.lineWidth = 1; ctx.stroke();
    var tile = images['iso:tactile:a'];
    if (b.tactile[y][x] && tile) {
      // 타일 그림의 윗면 마름모를 칸 마름모에 맞춤 (두께는 아래로)
      var top = P(x, y, s), th = s * tile.height / tile.width;
      ctx.drawImage(tile, top.x - s / 2, top.y, s, th);
    } else if (b.tactile[y][x]) {
      var i = corners(x + 0.06, y + 0.06, 0.88, 0.88, s);
      polygon(i); ctx.fillStyle = C.tactile; ctx.fill();
      ctx.fillStyle = C.tactileDot;
      for (var a = 0; a < 3; a++) for (var d = 0; d < 3; d++) {
        var p = P(x + 0.2 + a * 0.3, y + 0.2 + d * 0.3, s);
        ctx.beginPath(); ctx.ellipse(p.x, p.y, s * 0.05, s * 0.025, 0, 0, 7); ctx.fill();
      }
    }
  }

  // 벽 칸: 뒤쪽(위·왼쪽 테두리)은 높게, 앞쪽은 낮게
  // 벽 면: 바닥 모서리 a→b 위로 높이 z만큼 세운 면. 칸마다 테두리, rows단으로 가로줄
  function wallFace(a, b, z, color, s, rows) {
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(b.x, b.y - z); ctx.lineTo(a.x, a.y - z); ctx.closePath();
    ctx.fillStyle = color; ctx.fill();
    ctx.strokeStyle = WALL_C.line; ctx.lineWidth = Math.max(1, s * 0.03); ctx.stroke();
    ctx.beginPath();
    for (var r = 1; r < rows; r++) {
      var h = z * r / rows;
      ctx.moveTo(a.x, a.y - h); ctx.lineTo(b.x, b.y - h);
    }
    ctx.stroke();
  }

  function drawIsoWall(x, y, s) {
    var back = x === 0 || y === 0;
    var z = (back ? WALL_H : 0.3) * s;
    var c = corners(x, y, 1, 1, s);
    // 보이는 두 면(왼쪽 앞, 오른쪽 앞)과 윗면
    var base = back ? WALL_C.back : WALL_C.front, rows = back ? WALL_C.rows : 1;
    wallFace(c[3], c[2], z, shade(base, 0.78), s, rows);
    wallFace(c[2], c[1], z, shade(base, 0.64), s, rows);
    polygon(c, z); ctx.fillStyle = base; ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.18)'; ctx.lineWidth = 1; ctx.stroke();
    var id = state.board.wall[y][x];
    if (!id) return;
    // 벽에 붙인 물건: 뒤쪽 벽은 방 쪽을 향한 면 가운데에, 앞쪽 낮은 벽은 벽 위에 세워서
    var p, onTop = false;
    if (back && y === 0 && x !== 0) { p = P(x + 0.5, y + 1, s); p.y -= z * 0.55; }
    else if (back && x === 0 && y !== 0) { p = P(x + 1, y + 0.5, s); p.y -= z * 0.55; }
    else { p = P(x + 0.5, y + 0.5, s); p.y -= z; onTop = true; }
    // 방향별 그림: 가로로 뻗은 벽(위·아래 테두리)은 a, 세로로 뻗은 벽(왼쪽·오른쪽 테두리)은 b
    var alongX = y === 0 || y === ROWS - 1;
    var img = images['iso:' + id + ':' + (alongX ? 'a' : 'b')];
    if (img) {
      var iw = s * 0.75, ih = iw * img.height / img.width;
      ctx.drawImage(img, p.x - iw / 2, onTop ? p.y - ih : p.y - ih / 2, iw, ih);
    } else {
      if (onTop) p.y -= s * 0.3;
      drawWallItem(ctx, id, p.x - s * 0.3, p.y - s * 0.3, s * 0.6);
    }
  }

  // 벽 가운데 단에 붙은 물건: 벽 면과 칸이 만나는 선에서 벽 높이의 절반만큼 올려 그림
  function drawIsoWallMounted(o, s, alpha) {
    var it = L.itemById(cfg, o.id), sz = L.sizeOf(cfg, o);
    var wallSide = o.rot === 3 ? 'left' : 'top';
    var p = wallSide === 'top' ? P(o.x + sz.w / 2, o.y, s) : P(o.x, o.y + sz.h / 2, s);
    p.y -= WALL_H * s * (L.bandOf(cfg, o) - 0.5) / 3;  // 3단 중 해당 단의 가운데 높이
    var img = images['iso:' + o.id + ':' + 'adcb'[o.rot % 4]] || images['iso:' + o.id + ':' + (o.rot % 2 ? 'b' : 'a')];
    ctx.save();
    if (alpha !== undefined) ctx.globalAlpha = alpha;
    if (img) {
      var iw = s * (it.isoW || 0.85), ih = iw * img.height / img.width;
      if (it.anchor === 'center') {
        // 벽에서 튀어나온 큰 물건: 차지한 칸들 가운데 위, 해당 단 높이에
        var cp = P(o.x + sz.w / 2, o.y + sz.h / 2, s);
        cp.y -= WALL_H * s * (L.bandOf(cfg, o) - 0.5) / 3;
        ctx.drawImage(img, cp.x - iw / 2, cp.y - ih * 0.55, iw, ih);
      } else if (it.along) {
        // 벽을 따라 붙는 물건: 그림 가운데를 벽 선 가운데에
        ctx.drawImage(img, p.x - iw / 2, p.y - ih / 2, iw, ih);
      } else {
        // 벽에 닿는 쪽(그림의 받침)이 벽 선에 오도록: 위쪽 벽이면 그림 오른쪽, 왼쪽 벽이면 그림 왼쪽
        var x0 = wallSide === 'top' ? p.x - iw * 0.8 : p.x - iw * 0.2;
        ctx.drawImage(img, x0, p.y - ih * 0.3, iw, ih);
      }
    } else {
      ctx.fillStyle = '#ffffff'; roundRect(ctx, p.x - s * 0.3, p.y - s * 0.3, s * 0.6, s * 0.6, s * 0.1); ctx.fill();
      drawEmoji(ctx, it.emoji, p.x, p.y, s * 0.42);
    }
    ctx.restore();
  }

  function drawIsoObject(o, s, alpha) {
    if (L.isMounted(cfg, o)) return drawIsoWallMounted(o, s, alpha);
    var it = L.itemById(cfg, o.id), sz = L.sizeOf(cfg, o);
    var z = (ISO_H[o.id] || 0.8) * s;
    var c = corners(o.x, o.y, sz.w, sz.h, s);
    // 방향별 그림: 방향 0, 2는 a(왼쪽 아래를 봄), 1, 3은 b(오른쪽 아래를 봄)
    var dirImg = images['iso:' + o.id + ':' + 'adcb'[o.rot % 4]] || images['iso:' + o.id + ':' + (o.rot % 2 ? 'b' : 'a')];
    var img = dirImg || images['item:' + o.id];
    ctx.save();
    if (alpha !== undefined) ctx.globalAlpha = alpha;
    if (img) {
      // 그림은 세워서 그림. 방향별 그림이 없으면 옆 방향(1, 3)은 좌우를 뒤집음
      polygon(c); ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.fill();
      var maxW = c[1].x - c[3].x, maxH = (c[2].y - c[0].y) + z * (dirImg ? 1.5 : 1.3);
      var k = Math.min(maxW / img.width, maxH / img.height);
      var iw = img.width * k, ih = img.height * k, cx = (c[1].x + c[3].x) / 2;
      // 방향별 그림은 바닥 칸 가운데보다 조금 앞에 세움
      ctx.translate(cx, dirImg ? c[0].y + (c[2].y - c[0].y) * 0.8 : c[2].y);
      if (!dirImg && o.rot % 2) ctx.scale(-1, 1);
      ctx.drawImage(img, -iw / 2, -ih, iw, ih);
    } else if (o.id === 'grabBar') {
      var a = P(o.x + (sz.w > sz.h ? 0.2 : 0.5), o.y + (sz.w > sz.h ? 0.5 : 0.2), s);
      var e = P(o.x + (sz.w > sz.h ? sz.w - 0.2 : 0.5), o.y + (sz.w > sz.h ? 0.5 : sz.h - 0.2), s);
      ctx.strokeStyle = it.color; ctx.lineWidth = s * 0.16; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(a.x, a.y - z * 0.6); ctx.lineTo(e.x, e.y - z * 0.6); ctx.stroke();
    } else {
      isoBox(o.x, o.y, sz.w, sz.h, z, it.color || '#ffffff', s);
      // 벽에 붙는 쪽 표시
      var edge = [[0, 1], [1, 2], [2, 3], [3, 0]][o.rot];
      ctx.strokeStyle = 'rgba(40,52,70,0.6)'; ctx.lineWidth = Math.max(2, s * 0.12);
      ctx.beginPath(); ctx.moveTo(c[edge[0]].x, c[edge[0]].y - z); ctx.lineTo(c[edge[1]].x, c[edge[1]].y - z); ctx.stroke();
      var top = P(o.x + sz.w / 2, o.y + sz.h / 2, s);
      drawEmoji(ctx, it.emoji, top.x, top.y - z - s * 0.15, Math.min(sz.w, sz.h) * s * 0.45);
    }
    ctx.restore();
  }

  function drawIso(s) {
    var b = state.board, x, y, items = [];
    for (y = 0; y < ROWS; y++) for (x = 0; x < COLS; x++) {
      if (L.isEntrance(cfg, x, y) || !L.isBorder(b, x, y)) drawIsoFloor(x, y, s);
      // 뒤쪽 벽은 모든 것보다 뒤라 가장 먼저 그림 (벽에 붙인 물건이 옆 벽 칸에 가려지지 않게)
      else items.push({ d: (x === 0 || y === 0) ? -1 + (x + y) * 0.001 : x + y, draw: drawIsoWall.bind(null, x, y, s) });
    }
    // 입구 글자
    var e = cfg.entrance, ep = P((e[0].x + e[e.length - 1].x + 1) / 2, e[0].y + 0.5, s);
    ctx.fillStyle = '#ffffff';
    ctx.font = '400 ' + Math.round(s * 0.5) + 'px ' + getComputedStyle(document.documentElement).getPropertyValue('--display');
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('입구', ep.x, ep.y);

    // 선택한 설비, 놓을 자리는 바닥에 먼저 표시
    if (state.selected !== -1 && b.objects[state.selected]) {
      var so = b.objects[state.selected], sz = L.sizeOf(cfg, so);
      polygon(corners(so.x, so.y, sz.w, sz.h, s));
      ctx.fillStyle = 'rgba(29,95,184,0.18)'; ctx.fill();
      ctx.strokeStyle = '#1d5fb8'; ctx.lineWidth = 3; ctx.setLineDash([6, 4]); ctx.stroke(); ctx.setLineDash([]);
    }
    var ghost = null;
    if (state.hover && !state.run && !state.pan) {
      ghost = ghostObject();
      var gc = ghost ? corners(ghost.x, ghost.y, L.sizeOf(cfg, ghost).w, L.sizeOf(cfg, ghost).h, s) : corners(state.hover.x, state.hover.y, 1, 1, s);
      polygon(gc);
      ctx.strokeStyle = ghost ? (ghost.ok ? '#24855a' : '#c2453a') : '#1d5fb8'; ctx.lineWidth = 2; ctx.stroke();
    }

    // 뒤에 있는 것부터 그림
    var depthOf = function (o) { var sz = L.sizeOf(cfg, o); return o.x + o.y + (sz.w + sz.h) / 2; };
    b.objects.forEach(function (o) {
      var d = depthOf(o);
      if (L.isMounted(cfg, o)) {
        // 벽에 붙은 물건은 벽 바로 앞 깊이(높은 단이 나중에). 같은 칸에 바닥 설비가 있으면 그보다 앞에 그려서 보이게 함
        d = depthOf(o) - 0.95 + L.bandOf(cfg, o) * 0.001;
        // 앞쪽 벽(아래·오른쪽)에 붙은 물건은 그 낮은 벽보다 앞에 그림
        var msz = L.sizeOf(cfg, o);
        if (o.rot === 2) d = o.x + msz.w - 1 + ROWS - 1 + 0.1;
        if (o.rot === 1) d = COLS - 1 + o.y + msz.h - 1 + 0.1;
        var cells = L.cellsOf(cfg, o);
        b.objects.forEach(function (f) {
          if (L.levelOf(cfg, f) !== 'floor') return;
          var hit = L.cellsOf(cfg, f).some(function (c) { return cells.some(function (m) { return m.x === c.x && m.y === c.y; }); });
          if (hit) d = Math.max(d, depthOf(f) + 0.01);
        });
      }
      items.push({ d: d, draw: drawIsoObject.bind(null, o, s, undefined) });
    });
    if (ghost && ghost.ok) items.push({ d: 999, draw: drawIsoObject.bind(null, ghost, s, 0.5) });
    var rv = state.run ? runVisitor() : null;
    var vp = null, vsize = s * (rv && rv.r.size === 3 ? 1.9 : 1.4);
    if (rv) {
      vp = P(rv.wx, rv.wy, s);
      vp.y -= vsize * 0.45;
      items.push({ d: rv.wx + rv.wy, draw: function () { drawVisitor(rv.v, vp.x, vp.y, vsize, rv.face); } });
    }
    items.sort(function (a, c) { return a.d - c.d; });
    items.forEach(function (it) { it.draw(); });
    if (rv && rv.arrived) drawBubble(rv.r.reason, vp.x, headTop(rv.v, vp.y, vsize) - s * 0.1, s, rv.r.ok);
  }

  function visitorById(id) {
    for (var i = 0; i < cfg.visitors.length; i++) if (cfg.visitors[i].id === id) return cfg.visitors[i];
  }

  function drawVisitor(v, px, py, size, face) {
    var img = images['visitor:' + v.id + ':' + face] || images['visitor:' + v.id + ':normal'];
    var faceImg = !!images['visitor:' + v.id + ':' + face];
    if (img) {
      // 그림 비율을 지키고 발(바퀴)이 바닥 위치(py + size * 0.45)에 닿게
      var ih = size * 1.3 * (v.scale || 1), iw = ih * img.width / img.height;
      ctx.drawImage(img, px - iw / 2, py + size * 0.45 - ih, iw, ih);
    } else {
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.beginPath(); ctx.ellipse(px, py + size * 0.42, size * 0.38, size * 0.1, 0, 0, 7); ctx.fill();
      ctx.fillStyle = v.color;
      ctx.beginPath(); ctx.arc(px, py, size * 0.46, 0, 7); ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(px, py, size * 0.38, 0, 7); ctx.fill();
      drawEmoji(ctx, v.emoji, px, py, size * 0.52);
    }
    if ((face === 'happy' || face === 'sad') && !faceImg) {
      var fx = px + size * 0.36, fy = py - size * 0.36, fr = size * 0.24;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(fx, fy, fr, 0, 7); ctx.fill();
      drawEmoji(ctx, face === 'happy' ? '😄' : '😢', fx, fy, fr * 1.6);
    }
  }

  // 캐릭터 그림의 머리 꼭대기 (drawVisitor와 같은 계산). 말풍선은 이 위에 띄움
  function headTop(v, py, size) {
    var img = images['visitor:' + v.id + ':normal'];
    return img ? py + size * 0.45 - size * 1.3 * (v.scale || 1) : py - size * 0.5;
  }

  // 말풍선: 아래 끝이 py보다 조금 위에 오도록 그림
  function drawBubble(text, px, py, s, ok) {
    var fs = Math.max(12, Math.min(16, s * 0.6));
    ctx.font = '600 ' + fs + 'px ' + getComputedStyle(document.body).fontFamily;
    var lines = wrapText(text, Math.min(s * 12, 260));
    var w = 0;
    lines.forEach(function (l) { w = Math.max(w, ctx.measureText(l).width); });
    var pad = fs * 0.6, lh = fs * 1.3;
    var bw = w + pad * 2, bh = lines.length * lh + pad * 1.4;
    var bx = Math.max(-state.tx + 4, Math.min(px - bw / 2, -state.tx + wrap.clientWidth - bw - 4));
    var by = py - bh - s * 0.2;
    if (by < -state.ty + 4) by = py + s;
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = ok ? '#24855a' : '#c2453a'; ctx.lineWidth = 2;
    roundRect(ctx, bx, by, bw, bh, fs * 0.5); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#18222e'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    lines.forEach(function (l, i) { ctx.fillText(l, bx + pad, by + pad * 0.7 + i * lh); });
  }

  function wrapText(text, maxW) {
    var words = text.split(' '), lines = [], cur = '';
    words.forEach(function (w) {
      var t = cur ? cur + ' ' + w : w;
      if (ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t;
    });
    if (cur) lines.push(cur);
    return lines;
  }

  // ---------- 테스트 진행 ----------
  var STEP = reduceMotion ? 0.02 : 0.07;  // 1칸 이동 시간(초)
  var REACT = 1.8;

  // 테스트하기: 고른 이용객 한 명만 / 도전하기: 모두 차례로, 끝나면 결과 발표
  function startRun(mode, onlyId) {
    if (state.run) { finishRun(); return; }
    select(-1);
    var res = L.evaluate(state.board, cfg);
    if (mode === 'single') res = res.filter(function (r) { return r.id === onlyId; });
    else state.results = {};
    state.run = { list: res, idx: 0, t: 0, mode: mode };
    renderVisitors();
    var skipBtn = mode === 'single' ? 'btn-test' : 'btn-challenge';
    $(skipBtn).textContent = '⏭ 건너뛰기';
    ['btn-test', 'btn-challenge', 'btn-reset'].forEach(function (id) { if (id !== skipBtn) $(id).disabled = true; });
    updateUndoButtons();
    showInfo('<span class="muted">' + (mode === 'single' ? esc(visitorById(onlyId).name) + '이(가) 화장실을 이용해요…' : '이용객이 한 명씩 들어와요…') + '</span>');
  }
  function startTest() { startRun('single', state.picked); }
  function startChallenge() { startRun('all'); }

  function stepRun(dt) {
    var run = state.run, r = run.list[run.idx];
    run.t += dt;
    if (run.t >= (r.path.length - 1) * STEP + REACT) {
      state.results[r.id] = r;
      run.idx++;
      run.t = 0;
      renderVisitors();
      if (run.idx >= run.list.length) finishRun();
    }
    state.dirty = true;
  }

  // 지금 걷고 있는 이용객의 바닥 위치 (칸 단위)
  function runVisitor() {
    var run = state.run, r = run.list[run.idx];
    if (!r) return null;
    var walkTime = (r.path.length - 1) * STEP;
    var f = Math.min(run.t, walkTime) / STEP;
    var i = Math.min(Math.floor(f), r.path.length - 1), k = f - i;
    var a = r.path[i], b2 = r.path[Math.min(i + 1, r.path.length - 1)];
    var off = r.size / 2, arrived = run.t >= walkTime;
    // 가는 방향: ↗(y 감소) walk_a, ↖(x 감소) walk_b, ↘(x 증가) front_a, ↙(y 증가) front_b.
    // 앞모습 그림이 없는 이용객은 앞쪽으로 갈 때 직전 뒷모습을 유지
    var dir = 'walk_a';
    for (var j = Math.min(i + 1, r.path.length - 1); j > 0; j--) {
      var p0 = r.path[j - 1], p1 = r.path[j], cand = null;
      if (p1.y < p0.y) cand = 'walk_a';
      else if (p1.x < p0.x) cand = 'walk_b';
      else if (p1.x > p0.x) cand = 'front_a';
      else if (p1.y > p0.y) cand = 'front_b';
      if (cand && (cand.indexOf('walk') === 0 || images['visitor:' + r.id + ':' + cand])) { dir = cand; break; }
    }
    // 설비 앞에 멈춰 이용할 때는 설비를 바라봄
    var face = r.path[i].face;
    if (face && (face.indexOf('walk') === 0 || images['visitor:' + r.id + ':' + face])) dir = face;
    return {
      r: r, v: visitorById(r.id), arrived: arrived, face: arrived ? (r.ok ? 'happy' : 'sad') : dir,
      wx: a.x + (b2.x - a.x) * k + off, wy: a.y + (b2.y - a.y) * k + off
    };
  }

  function finishRun() {
    var run = state.run;
    run.list.forEach(function (r) { state.results[r.id] = r; });
    state.run = null;
    $('btn-test').textContent = '▶ 테스트하기';
    $('btn-challenge').textContent = '🏁 도전하기';
    ['btn-test', 'btn-challenge', 'btn-reset'].forEach(function (id) { $(id).disabled = false; });
    updateUndoButtons();
    renderVisitors();
    if (run.mode === 'single') showVisitor(visitorById(run.list[0].id));
    else showResult(run.list);
    state.dirty = true;
  }

  function showResult(list) {
    var fails = list.filter(function (r) { return !r.ok; }).length;
    $('result-title').textContent = fails === 0
      ? '🎉 모두가 이용할 수 있는 화장실이에요!'
      : fails + '명이 아직 이용하지 못했어요';
    var ul = $('result-list');
    ul.innerHTML = '';
    list.forEach(function (r) {
      var v = visitorById(r.id);
      var li = document.createElement('li');
      li.innerHTML = '<span class="av"></span><div><div class="who"></div><div class="why"></div></div><span class="face"></span>';
      li.querySelector('.av').textContent = v.emoji;
      li.querySelector('.av').style.background = v.color + '33';
      li.querySelector('.who').textContent = v.name;
      li.querySelector('.why').textContent = r.reason;
      li.querySelector('.face').textContent = r.ok ? '😄' : '😢';
      ul.appendChild(li);
    });
    $('result').hidden = false;
    $('result-close').focus();
    showInfo(fails === 0
      ? '<b>성공!</b> 모두가 이용할 수 있어요. 더 꾸며 보거나 다른 배치도 시험해 보세요.'
      : '<span class="warn">' + fails + '명이 이용하지 못했어요.</span> 위쪽 이용객을 고르고 ▶ 테스트하기로 한 명씩 다시 시험해 보세요.');
  }

  // ---------- 이용객 칩 ----------
  function renderVisitors() {
    var box = $('visitors');
    box.innerHTML = '';
    cfg.visitors.forEach(function (v) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'vchip';
      var r = state.results[v.id];
      var cur = state.run && state.run.list[state.run.idx];
      btn.dataset.state = cur && cur.id === v.id ? 'active' : r ? (r.ok ? 'ok' : 'bad') : '';
      btn.innerHTML = '<span class="av"></span><span class="name"></span><span class="face"></span>';
      btn.querySelector('.av').textContent = v.emoji;
      btn.querySelector('.av').style.background = v.color + '33';
      btn.querySelector('.name').textContent = v.name;
      btn.querySelector('.face').textContent = r ? (r.ok ? '😄' : '😢') : '';
      btn.title = v.name;
      btn.setAttribute('aria-pressed', String(state.picked === v.id));
      // 이용객을 누르면 고르고 필요한 것만 보여 줌. 시험은 ▶ 테스트하기로
      btn.addEventListener('click', function () {
        if (state.run) return;
        state.picked = v.id;
        renderVisitors();
        showVisitor(v);
      });
      box.appendChild(btn);
    });
  }

  function showVisitor(v) {
    var r = state.results[v.id];
    var html = '<b>' + esc(v.name) + '</b>에게 필요한 것: ' + v.needs.map(esc).join(' · ');
    if (r) html += '<br><span class="' + (r.ok ? 'muted' : 'warn') + '">' + (r.ok ? '😄 ' : '😢 ') + esc(r.reason) + '</span>';
    showInfo(html);
  }

  // ---------- 팔레트 ----------
  function renderPalette() {
    var nav = $('palette');
    nav.innerHTML = '';
    var group = null;
    cfg.items.forEach(function (it) {
      if (it.group !== group) {
        group = it.group;
        var h = document.createElement('div');
        h.className = 'pgroup';
        h.textContent = group;
        nav.appendChild(h);
      }
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'tool';
      btn.dataset.id = it.id;
      btn.setAttribute('aria-pressed', String(state.tool === it.id));
      var cv = document.createElement('canvas');
      cv.width = 60; cv.height = 60;
      btn.appendChild(cv);
      var label = document.createElement('span');
      label.textContent = it.name;
      btn.appendChild(label);
      if (it.layer === 'floor') {
        var size = document.createElement('span');
        size.className = 'size';
        size.textContent = it.w + '×' + it.h;
        btn.appendChild(size);
      }
      btn.addEventListener('click', function () { selectTool(it.id); });
      nav.appendChild(btn);
    });
    drawPalette();
  }

  function drawPalette() {
    Array.prototype.forEach.call(document.querySelectorAll('.tool'), function (btn) {
      var it = L.itemById(cfg, btn.dataset.id);
      var c = btn.querySelector('canvas').getContext('2d');
      c.clearRect(0, 0, 60, 60);
      if (it.layer === 'tactile' && images['iso:tactile:a']) {
        var ti = images['iso:tactile:a'];
        c.drawImage(ti, 2, 30 - 28 * ti.height / ti.width, 56, 56 * ti.height / ti.width);
      } else if (it.layer === 'tactile') { drawTactile(c, 0, 0, 60); }
      else if (it.layer === 'wall') { drawWall(c, 0, 0, 60); drawWallItem(c, it.id, 0, 0, 60); }
      else if (it.layer === 'floor' && images['iso:' + it.id + ':a']) {
        // 보드에 놓았을 때와 같은 그림(기본 방향)을 아이콘으로
        var pi = images['iso:' + it.id + ':a'], k = 56 / Math.max(pi.width, pi.height);
        c.drawImage(pi, (60 - pi.width * k) / 2, (60 - pi.height * k) / 2, pi.width * k, pi.height * k);
      } else if (it.layer === 'floor') {
        var s = 56 / Math.max(it.w, it.h);
        c.fillStyle = C.floor; c.fillRect(0, 0, 60, 60);
        drawObject(c, it.id, 0, (60 - it.w * s) / 2, (60 - it.h * s) / 2, s);
      } else { c.fillStyle = '#ffffff'; c.fillRect(0, 0, 60, 60); drawEmoji(c, it.emoji, 30, 30, 38); }
    });
  }

  function selectTool(id) {
    state.tool = id;
    setPan(false);
    select(-1);
    Array.prototype.forEach.call(document.querySelectorAll('.tool'), function (b) {
      b.setAttribute('aria-pressed', String(b.dataset.id === id));
    });
    var it = L.itemById(cfg, id);
    var size = it.layer === 'floor' ? ' (가로 ' + it.w + ' × 세로 ' + it.h + '칸)' : '';
    showInfo('<b>' + esc(it.name) + '</b>' + size + ' · ' + esc(it.desc));
    renderBandBar(it);
  }

  // 높이를 고를 수 있는 물건을 고른 동안 보드 아래에 높이 버튼 [아래][가운데][위]
  function renderBandBar(it) {
    var bar = $('band-bar');
    if (!it.bands || it.bands.length < 2) { bar.hidden = true; return; }
    if (it.bands.indexOf(state.band) === -1) state.band = it.bands[0];
    bar.innerHTML = '<span>붙일 높이</span>' + it.bands.map(function (n) {
      return '<button type="button" class="chip" data-band="' + n + '" aria-pressed="' + (n === state.band) + '">' + BAND_NAME[n] + '</button>';
    }).join('');
    bar.hidden = false;
  }
  $('band-bar').addEventListener('click', function (e) {
    var btn = e.target.closest && e.target.closest('[data-band]');
    if (!btn) return;
    state.band = Number(btn.dataset.band);
    renderBandBar(L.itemById(cfg, state.tool));
    state.dirty = true;
  });

  // ---------- 선택한 설비: 돌리기, 지우기 ----------
  function select(i) {
    state.selected = i;
    var bar = $('selbar');
    if (i === -1) { bar.hidden = true; updateHint(); state.dirty = true; return; }
    var it = L.itemById(cfg, state.board.objects[i].id);
    $('sel-name').textContent = it.name;
    $('btn-rotate').disabled = it.rotatable === false;
    $('btn-rotate').title = it.rotatable === false ? '방향을 바꿀 수 없어요' : '';
    updateBandButton();
    bar.hidden = false;
    updateHint();
    state.dirty = true;
  }
  // 높이를 고를 수 있는 벽 물건이면 '⇕ 높이 N단' 버튼을 보여 줌
  var BAND_NAME = { 1: '아래', 2: '가운데', 3: '위' };
  function updateBandButton() {
    var o = state.board.objects[state.selected], it = o && L.itemById(cfg, o.id);
    var show = !!(it && it.bands && it.bands.length > 1);
    $('btn-band').hidden = !show;
    if (show) $('btn-band').textContent = '⇕ 높이: ' + BAND_NAME[L.bandOf(cfg, o)];
  }
  $('btn-band').addEventListener('click', function () {
    if (state.selected === -1) return;
    var r = L.cycleBand(state.board, cfg, state.selected);
    if (r.ok) {
      state.band = L.bandOf(cfg, state.board.objects[state.selected]);  // 다음에 붙일 때도 이 높이로
      updateBandButton(); renderBandBar(L.itemById(cfg, state.tool)); changed(); save();
    } else warn(r.msg);
  });
  $('btn-rotate').addEventListener('click', function () {
    if (state.selected === -1) return;
    var r = L.rotateObject(state.board, cfg, state.selected);
    if (r.ok) { changed(); save(); } else if (r.msg) showInfo('<span class="warn">' + esc(r.msg) + '</span>');
  });
  $('btn-delete').addEventListener('click', function () {
    if (state.selected === -1) return;
    L.removeObject(state.board, state.selected);
    select(-1); changed(); save();
  });
  $('btn-deselect').addEventListener('click', function () { select(-1); });

  function changed() { state.results = {}; renderVisitors(); state.dirty = true; }

  // ---------- 안내줄, 확인창 ----------
  function showInfo(html) { $('info').innerHTML = html; }
  function esc(t) { return String(t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function warn(msg) { if (msg) showInfo('<span class="warn">' + esc(msg) + '</span>'); }

  var confirmCb = null;
  function ask(text, cb) {
    $('confirm-text').textContent = text;
    confirmCb = cb;
    $('confirm').hidden = false;
    $('confirm-yes').focus();
  }
  $('confirm-yes').addEventListener('click', function () { $('confirm').hidden = true; if (confirmCb) confirmCb(); });
  $('confirm-no').addEventListener('click', function () { $('confirm').hidden = true; });
  $('result-close').addEventListener('click', function () { $('result').hidden = true; });

  // ---------- 보드 누르기 ----------
  var gesture = null;

  // 누르기 시작: 도구에 따라 할 일이 다름
  function pressStart(cell) {
    if (!cell || state.run) return null;
    var b = state.board, it = L.itemById(cfg, state.tool);
    // 선택 도구: 누른 칸의 설비(벽 물건 먼저)를 고르고 끌어서 옮김. 빈 곳이면 선택 해제
    if (it.id === 'select') {
      var si = L.objectAt(b, cfg, cell.x, cell.y);
      if (si === -1) { select(-1); return null; }
      select(si);
      var so = b.objects[si];
      showInfo('<b>' + esc(L.itemById(cfg, so.id).name) + '</b>을(를) 골랐어요. 끌어서 옮기거나 위쪽 버튼으로 돌리기·지우기를 해요.');
      return { type: 'move', index: si, offX: cell.x - so.x, offY: cell.y - so.y, changed: false };
    }
    if (it.layer === 'tactile' || it.layer === 'tool') {
      var g = { type: 'brush', done: {}, changed: false, warned: false };
      brush(g, cell);
      return g;
    }
    if (it.layer === 'wall') {
      var r = L.placeWall(b, cfg, it.id, cell.x, cell.y);
      if (r.ok) { changed(); save(); } else warn(r.msg);
      return null;
    }
    // 설비 도구: 같은 높이 층의 설비를 누르면 선택하고 끌어서 옮김, 아니면 새로 놓기
    var i = sameLevelAt(cell, it);
    if (i === -1) {
      var add = L.addObject(b, cfg, it.id, cell.x, cell.y, 0, state.band);
      if (!add.ok) { warn(add.msg); return null; }
      i = add.index;
      changed();
      showInfo('<b>' + esc(it.name) + '</b>을(를) 놓았어요. 끌어서 옮기고, 위쪽 <b>⟳ 돌리기</b>로 방향을 바꿀 수 있어요.');
    }
    select(i);
    var o = b.objects[i];
    return { type: 'move', index: i, offX: cell.x - o.x, offY: cell.y - o.y, changed: true };
  }

  // 그 칸에서 도구와 같은 높이 층에 있는 설비 번호 (없으면 -1)
  function sameLevelAt(cell, it) {
    var b = state.board, i = L.objectAt(b, cfg, cell.x, cell.y);
    var toolLevel = L.levelOf(cfg, { id: it.id, band: state.band });
    if (i !== -1 && L.levelOf(cfg, b.objects[i]) === toolLevel) return i;
    // 위층 물건이 가리고 있으면 바닥 설비를 다시 찾음
    if (i !== -1 && toolLevel === 'floor') {
      for (var k = 0; k < b.objects.length; k++) {
        var o = b.objects[k];
        if (L.levelOf(cfg, o) !== 'floor') continue;
        if (L.cellsOf(cfg, o).some(function (c) { return c.x === cell.x && c.y === cell.y; })) return k;
      }
    }
    return -1;
  }

  function brush(g, cell) {
    if (!cell) return;
    var k = cell.x + ',' + cell.y;
    if (g.done[k]) return;
    g.done[k] = true;
    var r = state.tool === 'eraser'
      ? L.eraseAt(state.board, cfg, cell.x, cell.y)
      : L.paintTactile(state.board, cell.x, cell.y);
    if (r.ok) { g.changed = true; if (state.tool === 'eraser') select(-1); changed(); }
    else if (r.msg && !g.warned) { g.warned = true; warn(r.msg); }
  }

  function pressMove(g, cell) {
    if (!cell) return;
    if (g.type === 'brush') brush(g, cell);
    if (g.type === 'move') {
      var r = L.moveObject(state.board, cfg, g.index, cell.x - g.offX, cell.y - g.offY);
      if (r.ok) { g.changed = true; changed(); }
    }
  }

  // ---------- 포인터 (탭, 드래그, 두 손가락 확대) ----------
  var pointers = {};
  function local(e) {
    var r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }
  function pointerList() { return Object.keys(pointers).map(function (k) { return pointers[k]; }); }

  canvas.addEventListener('pointerdown', function (e) {
    canvas.setPointerCapture(e.pointerId);
    pointers[e.pointerId] = local(e);
    var list = pointerList();
    if (list.length === 1) {
      if (state.pan || e.button === 1 || e.button === 2) gesture = { type: 'pan', last: list[0] };
      else gesture = pressStart(toCell(list[0].x, list[0].y));
    } else if (list.length === 2) {
      var a = list[0], b = list[1];
      gesture = { type: 'pinch', d: Math.hypot(a.x - b.x, a.y - b.y), mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, wasChanged: gesture && gesture.changed };
    }
  });
  canvas.addEventListener('pointermove', function (e) {
    var p = local(e);
    if (e.pointerType === 'mouse') {
      var hc = toCell(p.x, p.y);
      if ((hc && (!state.hover || hc.x !== state.hover.x || hc.y !== state.hover.y)) || (!hc && state.hover)) { state.hover = hc; state.dirty = true; }
    }
    if (!pointers[e.pointerId]) return;
    pointers[e.pointerId] = p;
    if (!gesture) return;
    var list = pointerList();
    if ((gesture.type === 'brush' || gesture.type === 'move') && list.length === 1) {
      pressMove(gesture, toCell(p.x, p.y));
    } else if (gesture.type === 'pan' && list.length === 1) {
      state.cam.ox += p.x - gesture.last.x; state.cam.oy += p.y - gesture.last.y;
      gesture.last = p; clampCam(); state.dirty = true;
    } else if (gesture.type === 'pinch' && list.length === 2) {
      var a = list[0], b = list[1];
      var d = Math.hypot(a.x - b.x, a.y - b.y), mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      state.cam.ox += mid.x - gesture.mid.x; state.cam.oy += mid.y - gesture.mid.y;
      if (gesture.d > 0) zoomAt(d / gesture.d, mid.x, mid.y);
      gesture.d = d; gesture.mid = mid;
      clampCam(); state.dirty = true;
    }
  });
  function endPointer(e) {
    delete pointers[e.pointerId];
    if (Object.keys(pointers).length === 0) {
      if (gesture && (gesture.changed || gesture.wasChanged)) save();
      gesture = null;
    }
  }
  canvas.addEventListener('pointerup', endPointer);
  canvas.addEventListener('pointercancel', endPointer);
  canvas.addEventListener('pointerleave', function (e) {
    if (e.pointerType === 'mouse' && state.hover) { state.hover = null; state.dirty = true; }
  });
  canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  canvas.addEventListener('wheel', function (e) {
    e.preventDefault();
    var p = local(e);
    // 스크롤 양에 비례해 부드럽게 확대 (터치패드에서 갑자기 크게 확대되지 않게). ctrl+휠은 터치패드 핀치
    var dy = e.deltaY * (e.deltaMode === 1 ? 16 : 1);
    var f = Math.exp(-Math.max(-60, Math.min(60, dy)) * (e.ctrlKey ? 0.01 : 0.002));
    zoomAt(f, p.x, p.y);
  }, { passive: false });

  function setPan(on) {
    state.pan = on;
    $('btn-pan').setAttribute('aria-pressed', String(on));
    canvas.style.cursor = on ? 'grab' : 'crosshair';
    state.dirty = true;
  }
  $('btn-pan').addEventListener('click', function () {
    setPan(!state.pan);
    if (state.pan) showInfo('<b>화면 옮기기</b> · 보드를 끌어서 옮겨요. 다시 누르면 설치로 돌아가요. 두 손가락으로 끌어도 옮길 수 있어요.');
  });
  function zoomCenter(f) { var r = wrap.getBoundingClientRect(); zoomAt(f, r.width / 2, r.height / 2); }
  $('btn-zoom-in').addEventListener('click', function () { zoomCenter(1.3); });
  $('btn-zoom-out').addEventListener('click', function () { zoomCenter(1 / 1.3); });
  $('btn-fit').addEventListener('click', fitView);

  // 전체 화면: 페이지 전체를 화면 가득. 지원하지 않는 기기에서는 안내만
  function fsElement() { return document.fullscreenElement || document.webkitFullscreenElement; }
  function updateFullButton() {
    var on = !!fsElement();
    $('btn-full').textContent = on ? '🗗' : '⛶';
    $('btn-full').title = on ? '전체 화면 끝내기' : '전체 화면';
  }
  $('btn-full').addEventListener('click', function () {
    var el = document.documentElement;
    try {
      if (fsElement()) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
      else {
        var req = el.requestFullscreen || el.webkitRequestFullscreen;
        if (!req) { showInfo('<span class="warn">이 기기·브라우저는 전체 화면을 지원하지 않아요.</span> 휴대폰은 가로로 돌리면 더 크게 보여요.'); return; }
        var r = req.call(el);
        if (r && r.catch) r.catch(function () { showInfo('<span class="warn">전체 화면으로 바꿀 수 없어요.</span> 브라우저에서 직접 열어 보세요.'); });
      }
    } catch (e) { showInfo('<span class="warn">전체 화면으로 바꿀 수 없어요.</span>'); }
  });
  ['fullscreenchange', 'webkitfullscreenchange'].forEach(function (ev) {
    document.addEventListener(ev, function () { updateFullButton(); state.cam.zoomed = false; setTimeout(resize, 50); });
  });
  // iOS 사파리의 두 손가락 페이지 확대 막기 (보드 안 확대는 따로 처리)
  document.addEventListener('gesturestart', function (e) { e.preventDefault(); });

  // ---------- 버튼 ----------
  $('btn-test').addEventListener('click', startTest);
  $('btn-challenge').addEventListener('click', startChallenge);
  $('btn-undo').addEventListener('click', undo);
  $('btn-redo').addEventListener('click', redo);
  document.addEventListener('keydown', function (e) {
    if (!(e.ctrlKey || e.metaKey)) return;
    var k = e.key.toLowerCase();
    if (k === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
    else if (k === 'y' || (k === 'z' && e.shiftKey)) { e.preventDefault(); redo(); }
  });
  $('btn-reset').addEventListener('click', function () {
    ask('보드를 비우고 처음부터 꾸밀까요?', function () {
      state.board = L.createBoard(cfg); select(-1); changed(); save();
      showInfo('빈 화장실이에요. 설비를 골라 보드를 눌러 놓아 보세요.');
    });
  });
  $('btn-hide-hint').addEventListener('click', function () { hintHidden = true; updateHint(); });

  // ---------- 루프 ----------
  var last = 0;
  function loop(t) {
    var dt = last ? Math.min(0.1, (t - last) / 1000) : 0;
    last = t;
    if (state.run) stepRun(dt);
    if (state.dirty) { state.dirty = false; draw(); }
    requestAnimationFrame(loop);
  }

  // 단체 이름 글씨 크기를 제목(무지개 줄) 너비에 꼭 맞춤
  function fitOrg() {
    var org = document.querySelector('.org'), title = document.querySelector('.title');
    if (!org || !title) return;
    org.style.fontSize = '8px';  // 먼저 작게 해서 제목 너비만 재고
    var tw = title.getBoundingClientRect().width, w = org.getBoundingClientRect().width;
    if (w && tw) org.style.fontSize = (8 * tw / w) + 'px';
  }
  window.addEventListener('resize', fitOrg);
  window.addEventListener('resize', resize);
  if (window.ResizeObserver) new ResizeObserver(resize).observe(wrap);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { state.dirty = true; drawPalette(); fitOrg(); });
  fitOrg();

  renderPalette();
  renderVisitors();
  history.last = JSON.stringify(state.board);  // 시작 판 (되돌리기의 출발점)
  updateUndoButtons();
  setView(state.view);
  canvas.style.cursor = 'crosshair';
  showInfo('빈 화장실이에요. 이용객은 오른쪽 아래 <b>입구</b>로 들어와요. 설비를 골라 보드에 놓고, 위쪽 이용객을 고르고 <b>▶ 테스트하기</b>로 한 명씩, <b>🏁 도전하기</b>로 모두를 시험해 보세요.');
  requestAnimationFrame(loop);
})();
