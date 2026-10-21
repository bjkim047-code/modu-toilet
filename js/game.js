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
    tool: 'toilet',
    selected: -1,    // 선택한 설비 번호
    cam: { scale: 20, ox: 0, oy: 0, fit: 20 },
    hover: null,
    pan: false,
    run: null,       // 테스트 진행 상태
    results: {},     // 이용객별 마지막 결과
    dirty: true
  };

  // ---------- 그림 불러오기 (없으면 임시 그림) ----------
  var images = {};
  function tryImage(name, src) {
    var img = new Image();
    img.onload = function () { images[name] = img; state.dirty = true; drawPalette(); };
    img.src = src;
  }
  cfg.items.forEach(function (it) { tryImage('item:' + it.id, 'assets/items/' + it.id + '.png'); });
  ['floor', 'wall', 'entrance', 'tactile'].forEach(function (id) { tryImage('item:' + id, 'assets/items/' + id + '.png'); });
  cfg.visitors.forEach(function (v) {
    ['normal', 'happy', 'sad'].forEach(function (f) { tryImage('visitor:' + v.id + ':' + f, 'assets/visitors/' + v.id + '_' + f + '.png'); });
  });

  // ---------- 저장 ----------
  function save() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(state.board)); } catch (e) {}
  }
  function load() {
    try {
      var d = JSON.parse(localStorage.getItem(SAVE_KEY)), old = false;
      if (!d) { d = JSON.parse(localStorage.getItem(OLD_SAVE_KEY)); old = true; }
      if (!d || d.cols !== COLS || d.rows !== ROWS || !Array.isArray(d.objects)) return null;
      d.objects = d.objects.filter(function (o) { return L.itemById(cfg, o.id); });
      // 예전 저장본의 손잡이는 한 번 돌려야 같은 자리를 차지함
      if (old) d.objects.forEach(function (o) { if (o.id === 'grabBar') o.rot = (o.rot + 1) % 4; });
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

  // ---------- 화면 크기와 카메라 ----------
  var dpr = 1;
  var hintHidden = false;
  function resize() {
    dpr = window.devicePixelRatio || 1;
    var r = wrap.getBoundingClientRect();
    canvas.width = Math.round(r.width * dpr);
    canvas.height = Math.round(r.height * dpr);
    var prevFit = state.cam.fit;
    state.cam.fit = Math.min(r.width / COLS, r.height / ROWS);
    if (!state.cam.zoomed || !prevFit) fitView(); else clampCam();
    updateHint();
    state.dirty = true;
  }
  function updateHint() {
    $('rotate-hint').hidden = !(window.innerWidth < 600 && window.innerHeight > window.innerWidth && !hintHidden && state.selected === -1);
  }
  function fitView() {
    var r = wrap.getBoundingClientRect();
    var s = state.cam.fit;
    state.cam.scale = s;
    state.cam.ox = (r.width - s * COLS) / 2;
    state.cam.oy = (r.height - s * ROWS) / 2;
    state.cam.zoomed = false;
    state.dirty = true;
  }
  function clampCam() {
    var r = wrap.getBoundingClientRect(), cam = state.cam;
    var w = cam.scale * COLS, h = cam.scale * ROWS;
    cam.ox = w <= r.width ? (r.width - w) / 2 : Math.min(0, Math.max(r.width - w, cam.ox));
    cam.oy = h <= r.height ? (r.height - h) / 2 : Math.min(0, Math.max(r.height - h, cam.oy));
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
  function toCell(px, py) {
    var cam = state.cam;
    var x = Math.floor((px - cam.ox) / cam.scale), y = Math.floor((py - cam.oy) / cam.scale);
    if (x < 0 || y < 0 || x >= COLS || y >= ROWS) return null;
    return { x: x, y: y };
  }

  // ---------- 보드 그리기 ----------
  function draw() {
    var cam = state.cam, s = cam.scale, b = state.board;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingQuality = 'high';
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(cam.ox, cam.oy);
    var x, y;
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

    b.objects.forEach(function (o) { drawObject(ctx, o.id, o.rot, o.x * s, o.y * s, s); });

    // 선택한 설비
    if (state.selected !== -1 && b.objects[state.selected]) {
      var so = b.objects[state.selected], sz = L.sizeOf(cfg, so);
      ctx.strokeStyle = '#1d5fb8'; ctx.lineWidth = 3; ctx.setLineDash([6, 4]);
      ctx.strokeRect(so.x * s - 2, so.y * s - 2, sz.w * s + 4, sz.h * s + 4);
      ctx.setLineDash([]);
    }
    // 놓을 자리 미리보기 (마우스)
    if (state.hover && !state.run && !state.pan) drawGhost(s);
    if (state.run) drawRun(s);
    ctx.restore();
  }

  function drawGhost(s) {
    var it = L.itemById(cfg, state.tool), h = state.hover;
    if (it.layer === 'floor' && L.objectAt(state.board, cfg, h.x, h.y) === -1) {
      var o = { id: it.id, x: 0, y: 0, rot: 0 };
      var sz = L.sizeOf(cfg, o);
      o.x = Math.max(1, Math.min(COLS - 1 - sz.w, h.x - Math.floor((sz.w - 1) / 2)));
      o.y = Math.max(1, Math.min(ROWS - 1 - sz.h, h.y - Math.floor((sz.h - 1) / 2)));
      var ok = L.fits(state.board, cfg, o, -1).ok;
      drawObject(ctx, o.id, 0, o.x * s, o.y * s, s, ok ? 0.55 : 0.25);
      ctx.strokeStyle = ok ? '#24855a' : '#c2453a'; ctx.lineWidth = 2;
      ctx.strokeRect(o.x * s + 1, o.y * s + 1, sz.w * s - 2, sz.h * s - 2);
    } else {
      ctx.strokeStyle = '#1d5fb8'; ctx.lineWidth = 2;
      ctx.strokeRect(h.x * s + 1, h.y * s + 1, s - 2, s - 2);
    }
  }

  function visitorById(id) {
    for (var i = 0; i < cfg.visitors.length; i++) if (cfg.visitors[i].id === id) return cfg.visitors[i];
  }

  function drawVisitor(v, px, py, size, face) {
    var img = images['visitor:' + v.id + ':' + face] || images['visitor:' + v.id + ':normal'];
    if (img) {
      ctx.drawImage(img, px - size / 2, py - size / 2, size, size);
    } else {
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.beginPath(); ctx.ellipse(px, py + size * 0.42, size * 0.38, size * 0.1, 0, 0, 7); ctx.fill();
      ctx.fillStyle = v.color;
      ctx.beginPath(); ctx.arc(px, py, size * 0.46, 0, 7); ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(px, py, size * 0.38, 0, 7); ctx.fill();
      drawEmoji(ctx, v.emoji, px, py, size * 0.52);
    }
    if (face !== 'normal') {
      var fx = px + size * 0.36, fy = py - size * 0.36, fr = size * 0.24;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(fx, fy, fr, 0, 7); ctx.fill();
      drawEmoji(ctx, face === 'happy' ? '😄' : '😢', fx, fy, fr * 1.6);
    }
  }

  function drawBubble(text, px, py, s, ok) {
    var fs = Math.max(12, Math.min(16, s * 0.6));
    ctx.font = '600 ' + fs + 'px ' + getComputedStyle(document.body).fontFamily;
    var lines = wrapText(text, Math.min(s * 12, 260));
    var w = 0;
    lines.forEach(function (l) { w = Math.max(w, ctx.measureText(l).width); });
    var pad = fs * 0.6, lh = fs * 1.3;
    var bw = w + pad * 2, bh = lines.length * lh + pad * 1.4;
    var bx = Math.max(-state.cam.ox + 4, Math.min(px - bw / 2, -state.cam.ox + wrap.clientWidth - bw - 4));
    var by = py - bh - s;
    if (by < -state.cam.oy + 4) by = py + s;
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

  function startTest() {
    if (state.run) { finishRun(); return; }
    select(-1);
    var res = L.evaluate(state.board, cfg);
    state.results = {};
    state.run = { list: res, idx: 0, t: 0 };
    renderVisitors();
    $('btn-test').textContent = '⏭ 건너뛰기';
    $('btn-reset').disabled = true;
    showInfo('<span class="muted">이용객이 한 명씩 들어와요…</span>');
  }

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

  function drawRun(s) {
    var run = state.run, r = run.list[run.idx];
    if (!r) return;
    var v = visitorById(r.id);
    var walkTime = (r.path.length - 1) * STEP;
    var f = Math.min(run.t, walkTime) / STEP;
    var i = Math.min(Math.floor(f), r.path.length - 1), k = f - i;
    var a = r.path[i], b2 = r.path[Math.min(i + 1, r.path.length - 1)];
    var off = r.size / 2;
    var px = (a.x + (b2.x - a.x) * k + off) * s, py = (a.y + (b2.y - a.y) * k + off) * s;
    var arrived = run.t >= walkTime;
    var size = s * Math.max(1.8, r.size * 0.95);
    drawVisitor(v, px, py, size, arrived ? (r.ok ? 'happy' : 'sad') : 'normal');
    if (arrived) drawBubble(r.reason, px, py - size * 0.2, s, r.ok);
  }

  function finishRun() {
    var run = state.run;
    run.list.forEach(function (r) { state.results[r.id] = r; });
    state.run = null;
    $('btn-test').textContent = '▶ 테스트하기';
    $('btn-reset').disabled = false;
    renderVisitors();
    showResult(run.list);
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
      : '<span class="warn">' + fails + '명이 이용하지 못했어요.</span> 위쪽 이용객을 누르면 필요한 것을 볼 수 있어요.');
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
      btn.addEventListener('click', function () { showVisitor(v); });
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
      if (it.layer === 'tactile') { drawTactile(c, 0, 0, 60); }
      else if (it.layer === 'wall') { drawWall(c, 0, 0, 60); drawWallItem(c, it.id, 0, 0, 60); }
      else if (it.layer === 'floor') {
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
  }

  // ---------- 선택한 설비: 돌리기, 지우기 ----------
  function select(i) {
    state.selected = i;
    var bar = $('selbar');
    if (i === -1) { bar.hidden = true; updateHint(); state.dirty = true; return; }
    var it = L.itemById(cfg, state.board.objects[i].id);
    $('sel-name').textContent = it.name;
    $('btn-rotate').disabled = it.rotatable === false;
    $('btn-rotate').title = it.rotatable === false ? '방향을 바꿀 수 없어요' : '';
    bar.hidden = false;
    updateHint();
    state.dirty = true;
  }
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
    // 설비 도구: 설비를 누르면 선택하고 끌어서 옮김, 빈 곳이면 새로 놓기
    var i = L.objectAt(b, cfg, cell.x, cell.y);
    if (i === -1) {
      var add = L.addObject(b, cfg, it.id, cell.x, cell.y, 0);
      if (!add.ok) { warn(add.msg); return null; }
      i = add.index;
      changed();
      showInfo('<b>' + esc(it.name) + '</b>을(를) 놓았어요. 끌어서 옮기고, 위쪽 <b>⟳ 돌리기</b>로 방향을 바꿀 수 있어요.');
    }
    select(i);
    var o = b.objects[i];
    return { type: 'move', index: i, offX: cell.x - o.x, offY: cell.y - o.y, changed: true };
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
      if (r.ok) { changed(); }
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
    zoomAt(e.deltaY < 0 ? 1.15 : 1 / 1.15, p.x, p.y);
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

  // ---------- 버튼 ----------
  $('btn-test').addEventListener('click', startTest);
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

  window.addEventListener('resize', resize);
  if (window.ResizeObserver) new ResizeObserver(resize).observe(wrap);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { state.dirty = true; drawPalette(); });

  renderPalette();
  renderVisitors();
  resize();
  canvas.style.cursor = 'crosshair';
  showInfo('빈 화장실이에요. 이용객은 오른쪽 아래 <b>입구</b>로 들어와요. 설비를 골라 보드를 눌러 놓고 <b>▶ 테스트하기</b>를 눌러 보세요.');
  requestAnimationFrame(loop);
})();
