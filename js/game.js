// 화면 그리기와 조작
(function () {
  var cfg = MODU_CONFIG;
  var L = ModuLogic;
  var COLS = cfg.cols, ROWS = cfg.rows;
  var SAVE_KEY = 'modu-toilet-board-v1';
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var $ = function (id) { return document.getElementById(id); };
  var canvas = $('board'), ctx = canvas.getContext('2d');
  var wrap = $('board-wrap');

  var state = {
    board: load() || L.sampleBoard(cfg),
    tool: 'wall',
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
  ['floor', 'entrance'].forEach(function (id) { tryImage('item:' + id, 'assets/items/' + id + '.png'); });
  cfg.visitors.forEach(function (v) {
    ['normal', 'happy', 'sad'].forEach(function (f) { tryImage('visitor:' + v.id + ':' + f, 'assets/visitors/' + v.id + '_' + f + '.png'); });
  });

  // ---------- 저장 ----------
  function save() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify({ base: state.board.base, obj: state.board.obj })); } catch (e) {}
  }
  function load() {
    try {
      var d = JSON.parse(localStorage.getItem(SAVE_KEY));
      if (!d || d.base.length !== ROWS || d.base[0].length !== COLS) return null;
      var b = L.createBoard(cfg);
      b.base = d.base; b.obj = d.obj;
      return b;
    } catch (e) { return null; }
  }

  // ---------- 타일 그리기 ----------
  var C = {
    floor: '#f4f2ec', floorLine: '#e2ded3',
    wall: '#3f4654', wallTop: '#575f6f',
    partFull: '#7d8ca6', partLow: '#aab6c9',
    door: '#b47a46', doorDark: '#8a5a30',
    tactile: '#f2c230', tactileDot: '#c99a12',
    entrance: '#3fa66b'
  };

  function roundRect(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
  }

  function drawBase(c, id, x, y, s) {
    var img = images['item:' + id];
    if (id !== 'floor' && id !== 'entrance') drawFloor(c, x, y, s);
    if (img) { c.drawImage(img, x, y, s, s); return; }
    if (id === 'floor') return drawFloor(c, x, y, s);
    if (id === 'wall') {
      c.fillStyle = C.wall; c.fillRect(x, y, s, s);
      c.fillStyle = C.wallTop; c.fillRect(x, y, s, s * 0.22);
    } else if (id === 'partFull') {
      c.fillStyle = C.partFull; c.fillRect(x + s * 0.12, y, s * 0.76, s);
      c.fillStyle = 'rgba(255,255,255,0.35)'; c.fillRect(x + s * 0.12, y, s * 0.12, s);
    } else if (id === 'partLow') {
      c.fillStyle = C.partLow; c.fillRect(x + s * 0.12, y + s * 0.18, s * 0.76, s * 0.6);
      c.strokeStyle = C.partFull; c.lineWidth = Math.max(1, s * 0.06);
      c.setLineDash([s * 0.12, s * 0.1]);
      c.beginPath(); c.moveTo(x + s * 0.12, y + s * 0.9); c.lineTo(x + s * 0.88, y + s * 0.9); c.stroke();
      c.beginPath(); c.moveTo(x + s * 0.12, y + s * 0.07); c.lineTo(x + s * 0.88, y + s * 0.07); c.stroke();
      c.setLineDash([]);
    } else if (id === 'door') {
      c.fillStyle = C.door; roundRect(c, x + s * 0.08, y + s * 0.08, s * 0.84, s * 0.84, s * 0.12); c.fill();
      c.fillStyle = C.doorDark; c.beginPath(); c.arc(x + s * 0.72, y + s * 0.5, s * 0.08, 0, 7); c.fill();
    } else if (id === 'tactile') {
      c.fillStyle = C.tactile; c.fillRect(x, y, s, s);
      c.fillStyle = C.tactileDot;
      for (var i = 0; i < 3; i++) for (var j = 0; j < 3; j++) {
        c.beginPath(); c.arc(x + s * (0.2 + i * 0.3), y + s * (0.2 + j * 0.3), s * 0.07, 0, 7); c.fill();
      }
    } else if (id === 'entrance') {
      c.fillStyle = C.entrance; c.fillRect(x, y, s, s);
    }
  }

  function drawFloor(c, x, y, s) {
    var img = images['item:floor'];
    if (img) { c.drawImage(img, x, y, s, s); return; }
    c.fillStyle = C.floor; c.fillRect(x, y, s, s);
    c.strokeStyle = C.floorLine; c.lineWidth = 1;
    c.strokeRect(x + 0.5, y + 0.5, s - 1, s - 1);
  }

  function drawObj(c, id, x, y, s, baseId) {
    var img = images['item:' + id];
    if (img) { c.drawImage(img, x, y, s, s); return; }
    var it = L.itemById(cfg, id);
    if (id === 'grabBar') {
      c.strokeStyle = '#f08a24'; c.lineWidth = s * 0.16; c.lineCap = 'round';
      c.beginPath(); c.moveTo(x + s * 0.2, y + s * 0.5); c.lineTo(x + s * 0.8, y + s * 0.5); c.stroke();
      c.strokeStyle = '#ffd09a'; c.lineWidth = s * 0.05;
      c.beginPath(); c.moveTo(x + s * 0.25, y + s * 0.46); c.lineTo(x + s * 0.75, y + s * 0.46); c.stroke();
      c.lineCap = 'butt';
      return;
    }
    if (id === 'braille') {
      c.fillStyle = '#ffffff'; roundRect(c, x + s * 0.18, y + s * 0.18, s * 0.64, s * 0.64, s * 0.1); c.fill();
      c.fillStyle = '#1d5fb8';
      [[0, 0], [0, 1], [1, 1], [0, 2], [1, 0]].forEach(function (p) {
        c.beginPath(); c.arc(x + s * (0.4 + p[0] * 0.2), y + s * (0.32 + p[1] * 0.18), s * 0.06, 0, 7); c.fill();
      });
      return;
    }
    if (it && it.layer === 'wall') {
      c.fillStyle = '#ffffff'; roundRect(c, x + s * 0.12, y + s * 0.12, s * 0.76, s * 0.76, s * 0.12); c.fill();
    } else {
      c.fillStyle = id === 'sinkLow' ? '#cfeee6' : '#ffffff';
      roundRect(c, x + s * 0.06, y + s * 0.06, s * 0.88, s * 0.88, s * 0.18); c.fill();
      c.strokeStyle = 'rgba(0,0,0,0.18)'; c.lineWidth = 1; c.stroke();
    }
    drawEmoji(c, it ? it.emoji : '?', x + s / 2, y + s / 2, s * 0.62);
    if (id === 'sinkLow') {
      c.fillStyle = '#1f7f66';
      c.font = '800 ' + Math.round(s * 0.34) + 'px ' + getComputedStyle(document.body).fontFamily;
      c.textAlign = 'right'; c.textBaseline = 'bottom';
      c.fillText('↓', x + s * 0.96, y + s * 1.0);
    }
  }

  function drawEmoji(c, e, cx, cy, size) {
    c.font = Math.round(size) + 'px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillStyle = '#000';
    c.fillText(e, cx, cy + size * 0.06);
  }

  // ---------- 화면 크기와 카메라 ----------
  var dpr = 1;
  function resize() {
    dpr = window.devicePixelRatio || 1;
    var r = wrap.getBoundingClientRect();
    canvas.width = Math.round(r.width * dpr);
    canvas.height = Math.round(r.height * dpr);
    var prevFit = state.cam.fit;
    var fit = Math.min(r.width / COLS, r.height / ROWS);
    state.cam.fit = fit;
    if (!state.cam.zoomed || !prevFit) fitView(); else clampCam();
    $('rotate-hint').hidden = !(window.innerWidth < 600 && window.innerHeight > window.innerWidth && !hintHidden);
    state.dirty = true;
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
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(cam.ox, cam.oy);
    var x, y;
    for (y = 0; y < ROWS; y++) for (x = 0; x < COLS; x++) drawBase(ctx, b.base[y][x], x * s, y * s, s);
    // 입구 글자
    var e = cfg.entrance;
    ctx.fillStyle = '#ffffff';
    ctx.font = '400 ' + Math.round(s * 0.62) + 'px ' + getComputedStyle(document.documentElement).getPropertyValue('--display');
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('입구', (e[0].x + 1) * s, (e[0].y + 0.55) * s);
    for (y = 0; y < ROWS; y++) for (x = 0; x < COLS; x++) {
      if (b.obj[y][x]) drawObj(ctx, b.obj[y][x], x * s, y * s, s, b.base[y][x]);
    }
    // 놓을 자리 미리보기
    if (state.hover && !state.run && !state.pan) {
      ctx.strokeStyle = '#1d5fb8'; ctx.lineWidth = 2;
      ctx.strokeRect(state.hover.x * s + 1, state.hover.y * s + 1, s - 2, s - 2);
    }
    if (state.run) drawRun(s);
    ctx.restore();
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
    var fs = Math.max(12, Math.min(16, s * 0.5));
    ctx.font = '600 ' + fs + 'px ' + getComputedStyle(document.body).fontFamily;
    var maxW = Math.min(s * 11, 260);
    var lines = wrapText(text, maxW);
    var w = 0;
    lines.forEach(function (l) { w = Math.max(w, ctx.measureText(l).width); });
    var pad = fs * 0.6, lh = fs * 1.3;
    var bw = w + pad * 2, bh = lines.length * lh + pad * 1.4;
    var bx = Math.max(-state.cam.ox + 4, Math.min(px - bw / 2, -state.cam.ox + wrap.clientWidth - bw - 4));
    var by = py - bh - s * 0.9;
    if (by < -state.cam.oy + 4) by = py + s * 0.9;
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
  var STEP = reduceMotion ? 0.03 : 0.13;  // 1칸 이동 시간(초)
  var REACT = 1.8;

  function startTest() {
    if (state.run) { finishRun(); return; }
    var res = L.evaluate(state.board, cfg);
    state.results = {};
    state.run = { list: res, idx: 0, t: 0 };
    renderVisitors();
    $('btn-test').textContent = '⏭ 건너뛰기';
    setControlsDisabled(true);
    showInfo('<span class="muted">이용객이 한 명씩 들어와요…</span>');
  }

  function setControlsDisabled(on) {
    ['btn-sample', 'btn-reset'].forEach(function (id) { $(id).disabled = on; });
  }

  function stepRun(dt) {
    var run = state.run, r = run.list[run.idx];
    run.t += dt;
    var walkTime = (r.path.length - 1) * STEP;
    if (run.t >= walkTime + REACT) {
      state.results[r.id] = r;
      renderVisitors();
      run.idx++;
      run.t = 0;
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
    var size = s * (r.size === 2 ? 1.9 : 1.25);
    drawVisitor(v, px, py, size, arrived ? (r.ok ? 'happy' : 'sad') : 'normal');
    if (arrived) drawBubble(r.reason, px, py - size * 0.2, s, r.ok);
  }

  function finishRun() {
    var run = state.run;
    run.list.forEach(function (r) { state.results[r.id] = r; });
    state.run = null;
    $('btn-test').textContent = '▶ 테스트하기';
    setControlsDisabled(false);
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
    cfg.visitors.forEach(function (v, i) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'vchip';
      var r = state.results[v.id];
      var active = state.run && state.run.list[state.run.idx] && state.run.list[state.run.idx].id === v.id;
      btn.dataset.state = active ? 'active' : r ? (r.ok ? 'ok' : 'bad') : '';
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
      btn.addEventListener('click', function () { selectTool(it.id); });
      nav.appendChild(btn);
    });
    drawPalette();
  }

  function drawPalette() {
    var nodes = document.querySelectorAll('.tool');
    Array.prototype.forEach.call(nodes, function (btn) {
      var id = btn.dataset.id, it = L.itemById(cfg, id);
      var c = btn.querySelector('canvas').getContext('2d');
      c.clearRect(0, 0, 60, 60);
      if (it.layer === 'base') drawBase(c, id, 0, 0, 60);
      else if (it.layer === 'wall') { drawBase(c, 'wall', 0, 0, 60); drawObj(c, id, 0, 0, 60); }
      else if (it.layer === 'floor') { drawFloor(c, 0, 0, 60); drawObj(c, id, 0, 0, 60); }
      else { c.fillStyle = '#ffffff'; c.fillRect(0, 0, 60, 60); drawEmoji(c, it.emoji, 30, 30, 38); }
    });
  }

  function selectTool(id) {
    state.tool = id;
    setPan(false);
    Array.prototype.forEach.call(document.querySelectorAll('.tool'), function (b) {
      b.setAttribute('aria-pressed', String(b.dataset.id === id));
    });
    var it = L.itemById(cfg, id);
    showInfo('<b>' + esc(it.name) + '</b> · ' + esc(it.desc));
  }

  // ---------- 안내줄, 확인창 ----------
  function showInfo(html) { $('info').innerHTML = html; }
  function esc(t) { return String(t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

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

  // ---------- 설치 ----------
  var gesture = null;
  function paint(cell) {
    if (!cell || state.run) return;
    var key = cell.x + ',' + cell.y;
    if (gesture && gesture.done[key]) return;
    if (gesture) gesture.done[key] = true;
    var res = L.place(state.board, cfg, state.tool, cell.x, cell.y);
    if (res.ok) {
      state.results = {};
      if (gesture) gesture.changed = true;
      state.dirty = true;
    } else if (res.msg && gesture && !gesture.warned) {
      gesture.warned = true;
      showInfo('<span class="warn">' + esc(res.msg) + '</span>');
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
      if (state.pan || e.button === 1 || e.button === 2) {
        gesture = { type: 'pan', last: list[0] };
      } else {
        gesture = { type: 'paint', done: {}, changed: false, warned: false };
        paint(toCell(list[0].x, list[0].y));
      }
    } else if (list.length === 2) {
      // 두 손가락: 확대·이동
      var a = list[0], b = list[1];
      gesture = { type: 'pinch', d: Math.hypot(a.x - b.x, a.y - b.y), mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, wasPaint: gesture && gesture.changed };
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
    if (gesture.type === 'paint' && list.length === 1) {
      paint(toCell(p.x, p.y));
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
      if (gesture && (gesture.changed || gesture.wasPaint)) save();
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
  $('btn-sample').addEventListener('click', function () {
    ask('지금 꾸민 화장실을 지우고 예시를 불러올까요?', function () {
      state.board = L.sampleBoard(cfg); state.results = {}; save(); renderVisitors(); state.dirty = true;
      showInfo('<b>예시</b> · 왼쪽 위가 누구나 이용할 수 있는 칸이에요. 물건을 지워 보고 테스트해 보세요.');
    });
  });
  $('btn-reset').addEventListener('click', function () {
    ask('보드를 비우고 처음부터 꾸밀까요?', function () {
      state.board = L.createBoard(cfg); state.results = {}; save(); renderVisitors(); state.dirty = true;
      showInfo('빈 공간이에요. <b>벽</b>과 <b>문</b>으로 칸을 만들고, 설비를 놓아 보세요.');
    });
  });
  var hintHidden = false;
  $('btn-hide-hint').addEventListener('click', function () { hintHidden = true; $('rotate-hint').hidden = true; });

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
  showInfo('<b>벽</b>, <b>문</b>, 설비를 골라 보드를 눌러 설치하고 <b>▶ 테스트하기</b>를 눌러 보세요. 위쪽 이용객을 누르면 필요한 것이 보여요.');
  requestAnimationFrame(loop);
})();
