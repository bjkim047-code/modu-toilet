// 게임 규칙 (화면과 상관없는 순수 로직)
// 보드 만들기, 설비 설치·이동·회전, 이용객 성공/실패 판정을 담당합니다.
//
// 보드 데이터
//   tactile[y][x] : 점자블록 여부
//   wall[y][x]    : 바깥 벽에 붙인 물건 id (점자 안내판)
//   objects       : [{ id, x, y, rot }]  x,y는 왼쪽 위 칸, rot는 0~3 (시계 방향 90도씩)

var ModuLogic = (function () {
  var DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

  function itemById(cfg, id) {
    for (var i = 0; i < cfg.items.length; i++) if (cfg.items[i].id === id) return cfg.items[i];
    return null;
  }

  function grid(cols, rows, v) {
    var g = [];
    for (var y = 0; y < rows; y++) {
      var row = [];
      for (var x = 0; x < cols; x++) row.push(v);
      g.push(row);
    }
    return g;
  }

  function createBoard(cfg) {
    return { cols: cfg.cols, rows: cfg.rows, tactile: grid(cfg.cols, cfg.rows, false), wall: grid(cfg.cols, cfg.rows, null), objects: [] };
  }

  function isBorder(b, x, y) { return x === 0 || y === 0 || x === b.cols - 1 || y === b.rows - 1; }
  function inside(b, x, y) { return x >= 0 && y >= 0 && x < b.cols && y < b.rows; }
  function interior(b, x, y) { return inside(b, x, y) && !isBorder(b, x, y); }
  function isEntrance(cfg, x, y) {
    return cfg.entrance.some(function (e) { return e.x === x && e.y === y; });
  }
  function key(b, x, y) { return y * b.cols + x; }

  // 회전을 반영한 크기
  function sizeOf(cfg, o) {
    var it = itemById(cfg, o.id);
    return o.rot % 2 ? { w: it.h, h: it.w } : { w: it.w, h: it.h };
  }

  function cellsOf(cfg, o) {
    var s = sizeOf(cfg, o), out = [];
    for (var dy = 0; dy < s.h; dy++) for (var dx = 0; dx < s.w; dx++) out.push({ x: o.x + dx, y: o.y + dy });
    return out;
  }

  // 높이 층: 'floor'(바닥 설비) 또는 'w1'~'w3'(벽 높이 단에 붙는 물건). 다른 층끼리는 겹칠 수 있음
  function isMounted(cfg, o) { return !!itemById(cfg, o.id).mount; }
  function bandOf(cfg, o) { var it = itemById(cfg, o.id); return it.bands.indexOf(o.band) !== -1 ? o.band : it.bands[0]; }
  function levelOf(cfg, o) { return isMounted(cfg, o) ? 'w' + bandOf(cfg, o) : 'floor'; }
  var WALL_LEVELS = ['w3', 'w2', 'w1'];

  // 칸마다 차지한 설비 번호 (-1은 빈 칸). level 층만 셈 (기본은 바닥)
  function occupancy(b, cfg, skip, level) {
    var g = grid(b.cols, b.rows, -1);
    level = level || 'floor';
    b.objects.forEach(function (o, i) {
      if (i === skip || levelOf(cfg, o) !== level) return;
      cellsOf(cfg, o).forEach(function (c) { if (inside(b, c.x, c.y)) g[c.y][c.x] = i; });
    });
    return g;
  }

  // 그 칸의 설비 번호. 벽에 붙은 물건(높은 단부터)을 먼저 찾고, 뒤쪽 벽 칸을 누르면 그 벽에 붙은 물건을 찾음
  function objectAt(b, cfg, x, y) {
    if (!inside(b, x, y)) return -1;
    for (var k = 0; k < WALL_LEVELS.length; k++) {
      var w = occupancy(b, cfg, -1, WALL_LEVELS[k]);
      if (y === 0 && x > 0 && inside(b, x, 1) && w[1][x] !== -1 && b.objects[w[1][x]].rot === 0) return w[1][x];
      if (x === 0 && y > 0 && inside(b, 1, y) && w[y][1] !== -1 && b.objects[w[y][1]].rot === 3) return w[y][1];
      if (w[y][x] !== -1) return w[y][x];
    }
    return occupancy(b, cfg)[y][x];
  }

  // 벽 가운데 단 물건이 붙는 벽: 방향 0은 위쪽 벽(y=0), 3은 왼쪽 벽(x=0)
  function onBackWall(o) { return o.rot === 0 ? o.y === 1 : o.rot === 3 ? o.x === 1 : false; }

  // 설비를 그 자리에 놓을 수 있는지
  function fits(b, cfg, o, skip) {
    var level = levelOf(cfg, o);
    var occ = occupancy(b, cfg, skip, level);
    var cs = cellsOf(cfg, o);
    for (var i = 0; i < cs.length; i++) {
      if (!interior(b, cs[i].x, cs[i].y)) return { ok: false, msg: '화장실 안쪽에만 놓을 수 있어요.' };
      if (occ[cs[i].y][cs[i].x] !== -1) return { ok: false, msg: level !== 'floor' ? '같은 높이에 다른 물건이 있어요.' : '다른 설비와 겹쳐요.' };
    }
    if (level !== 'floor' && !onBackWall(o)) return { ok: false, msg: itemById(cfg, o.id).name + '은(는) 뒤쪽 벽 바로 옆 칸에만 붙일 수 있어요.' };
    return { ok: true };
  }

  // 벽 가운데 단 물건: 누른 칸에서 붙일 벽과 칸을 정함 (벽 칸을 눌러도 바로 옆 칸으로)
  function snapToWall(o, cx, cy) {
    if (cy <= 1 && cx >= 1) { o.x = cx; o.y = 1; o.rot = 0; return true; }
    if (cx <= 1 && cy >= 1) { o.x = 1; o.y = cy; o.rot = 3; return true; }
    o.x = cx; o.y = cy;
    return false;
  }

  // 안쪽으로 밀어 넣기
  function clampIn(b, cfg, o) {
    var s = sizeOf(cfg, o);
    o.x = Math.max(1, Math.min(b.cols - 1 - s.w, o.x));
    o.y = Math.max(1, Math.min(b.rows - 1 - s.h, o.y));
  }

  // (cx, cy)를 가운데로 하여 놓일 설비 자리 (놓지는 않음)
  function placement(b, cfg, id, cx, cy, rot, band) {
    var it = itemById(cfg, id);
    var o = { id: id, x: 0, y: 0, rot: it.rotatable === false ? 0 : (rot || 0) };
    if (it.mount) {
      o.band = it.bands.indexOf(band) !== -1 ? band : it.bands[0];
      snapToWall(o, cx, cy);
      // 벽을 따라 긴 물건은 누른 칸이 가운데가 되도록
      var ms = sizeOf(cfg, o);
      if (o.rot === 0) o.x -= Math.floor((ms.w - 1) / 2); else o.y -= Math.floor((ms.h - 1) / 2);
      clampIn(b, cfg, o);
      return o;
    }
    var s = sizeOf(cfg, o);
    o.x = cx - Math.floor((s.w - 1) / 2);
    o.y = cy - Math.floor((s.h - 1) / 2);
    clampIn(b, cfg, o);
    return o;
  }

  function addObject(b, cfg, id, cx, cy, rot, band) {
    var it = itemById(cfg, id);
    if (!it || it.layer !== 'floor') return { ok: false };
    var o = placement(b, cfg, id, cx, cy, rot, band);
    var f = fits(b, cfg, o, -1);
    if (!f.ok) return f;
    b.objects.push(o);
    return { ok: true, index: b.objects.length - 1 };
  }

  function moveObject(b, cfg, i, x, y) {
    var o = b.objects[i];
    var n = { id: o.id, x: x, y: y, rot: o.rot, band: o.band };
    if (isMounted(cfg, o) && !snapToWall(n, x, y)) return { ok: false };
    clampIn(b, cfg, n);
    if (n.x === o.x && n.y === o.y && n.rot === o.rot) return { ok: false };
    var f = fits(b, cfg, n, i);
    if (!f.ok) return f;
    o.x = n.x; o.y = n.y; o.rot = n.rot;
    return { ok: true };
  }

  function rotateObject(b, cfg, i) {
    var o = b.objects[i];
    var it = itemById(cfg, o.id);
    if (it.rotatable === false) return { ok: false, msg: it.name + '은(는) 방향을 바꿀 수 없어요.' };
    var rots = it.rotations || [0, 1, 2, 3];
    var s = sizeOf(cfg, o);
    var n = { id: o.id, x: 0, y: 0, rot: rots[(rots.indexOf(o.rot) + 1) % rots.length], band: o.band };
    var ns = sizeOf(cfg, n);
    // 가운데를 기준으로 돌리되, 반 칸은 버려서 다시 돌리면 제자리로 돌아오게 함
    n.x = o.x + ((s.w - ns.w) / 2 | 0); n.y = o.y + ((s.h - ns.h) / 2 | 0);
    clampIn(b, cfg, n);
    var f = fits(b, cfg, n, i);
    if (!f.ok && isMounted(cfg, o)) return { ok: false, msg: '벽 모서리 칸에서만 방향을 바꿀 수 있어요.' };
    if (!f.ok) return { ok: false, msg: '돌릴 자리가 없어요. 주변을 비워 주세요.' };
    b.objects[i] = n;
    return { ok: true };
  }

  // 벽에 붙은 물건의 높이 단을 다음 단으로 (붙일 수 있는 단만 돌아가며)
  function cycleBand(b, cfg, i) {
    var o = b.objects[i], it = itemById(cfg, o.id);
    if (!it.mount || it.bands.length < 2) return { ok: false, msg: it.name + '은(는) 높이를 바꿀 수 없어요.' };
    var cur = bandOf(cfg, o);
    for (var k = 1; k < it.bands.length; k++) {
      var n = { id: o.id, x: o.x, y: o.y, rot: o.rot, band: it.bands[(it.bands.indexOf(cur) + k) % it.bands.length] };
      if (fits(b, cfg, n, i).ok) { o.band = n.band; return { ok: true }; }
    }
    return { ok: false, msg: '다른 높이에도 물건이 있어서 바꿀 수 없어요.' };
  }

  function removeObject(b, i) { b.objects.splice(i, 1); }

  // 지우개: 설비 → 벽 물건 → 점자블록 순서로 지움
  function eraseAt(b, cfg, x, y) {
    if (!inside(b, x, y)) return { ok: false };
    var i = objectAt(b, cfg, x, y);
    if (i !== -1) { removeObject(b, i); return { ok: true }; }
    if (b.wall[y][x]) { b.wall[y][x] = null; return { ok: true }; }
    if (b.tactile[y][x]) { b.tactile[y][x] = false; return { ok: true }; }
    return { ok: false };
  }

  function paintTactile(b, x, y) {
    if (!interior(b, x, y)) return { ok: false, msg: '점자블록은 화장실 바닥에 깔아 주세요.' };
    if (b.tactile[y][x]) return { ok: false };
    b.tactile[y][x] = true;
    return { ok: true };
  }

  function placeWall(b, cfg, id, x, y) {
    var it = itemById(cfg, id);
    if (!it || it.layer !== 'wall') return { ok: false };
    if (!inside(b, x, y) || !isBorder(b, x, y) || isEntrance(cfg, x, y)) {
      return { ok: false, msg: it.name + '은(는) 바깥 벽에 붙여 주세요.' };
    }
    if (b.wall[y][x] === id) return { ok: false };  // 다른 물건이 있으면 바꿔 붙임
    b.wall[y][x] = id;
    return { ok: true };
  }

  // ---------- 판정 ----------

  // k×k 크기로 움직이는 이용객의 이동 (왼쪽 위 좌표 기준 BFS)
  // starts가 있으면 그 위치들에서, 없으면 입구에서 출발
  function bfs(b, cfg, k, walk, starts) {
    function ok(x, y) {
      for (var dy = 0; dy < k; dy++) for (var dx = 0; dx < k; dx++) if (!walk(x + dx, y + dy)) return false;
      return true;
    }
    var parent = {}, order = [];
    if (starts) starts.forEach(function (s) {
      var kk = key(b, s.x, s.y);
      if (parent[kk] === undefined && ok(s.x, s.y)) { parent[kk] = -1; order.push({ x: s.x, y: s.y }); }
    });
    else cfg.entrance.forEach(function (e) {
      for (var dy = 0; dy < k; dy++) for (var dx = 0; dx < k; dx++) {
        var x = e.x - dx, y = e.y - dy, kk = key(b, x, y);
        if (parent[kk] === undefined && ok(x, y)) { parent[kk] = -1; order.push({ x: x, y: y }); }
      }
    });
    for (var i = 0; i < order.length; i++) {
      var c = order[i];
      DIRS.forEach(function (d) {
        var nx = c.x + d[0], ny = c.y + d[1], nk = key(b, nx, ny);
        if (parent[nk] === undefined && ok(nx, ny)) { parent[nk] = key(b, c.x, c.y); order.push({ x: nx, y: ny }); }
      });
    }
    var covered = {};
    order.forEach(function (s) {
      for (var dy = 0; dy < k; dy++) for (var dx = 0; dx < k; dx++) covered[key(b, s.x + dx, s.y + dy)] = true;
    });
    return { k: k, parent: parent, order: order, covered: covered };
  }

  function pathTo(b, walk, s) {
    var path = [], kk = key(b, s.x, s.y);
    while (kk !== -1 && kk !== undefined) {
      path.push({ x: kk % b.cols, y: Math.floor(kk / b.cols) });
      kk = walk.parent[kk];
    }
    return path.reverse();
  }

  function evaluate(b, cfg) {
    var occ = occupancy(b, cfg);
    function walkable(x, y) {
      if (!inside(b, x, y)) return false;
      if (isEntrance(cfg, x, y)) return true;
      return !isBorder(b, x, y) && occ[y][x] === -1;
    }

    var walk3 = bfs(b, cfg, 3, walkable);   // 휠체어 (약 75cm 폭)
    var walk2 = bfs(b, cfg, 2, walkable);   // 다른 이용객 (약 50cm 폭)
    var walkT = bfs(b, cfg, 1, function (x, y) {  // 점자블록 따라 걷기
      return walkable(x, y) && (isEntrance(cfg, x, y) || b.tactile[y][x]);
    });

    var objs = b.objects.map(function (o) { return { id: o.id, cells: cellsOf(cfg, o) }; });
    function ofType(ids) { return objs.filter(function (o) { return ids.indexOf(o.id) !== -1; }); }
    function touches(o, set) {
      return o.cells.some(function (c) {
        return DIRS.some(function (d) { return set[key(b, c.x + d[0], c.y + d[1])]; });
      });
    }
    function reachable(ids, walk) { return ofType(ids).some(function (o) { return touches(o, walk.covered); }); }
    function cellSet(o) { var s = {}; o.cells.forEach(function (c) { s[key(b, c.x, c.y)] = true; }); return s; }

    var toilets = ofType(['toilet']);
    var grabBars = ofType(['grabBar']);
    var wheelToilets = toilets.filter(function (t) { return touches(t, walk3.covered); });

    // 휠체어 회전 공간: 6×6칸이 모두 비어 있고 휠체어가 닿는 곳
    function hasTurnSpace() {
      for (var y = 1; y < b.rows - 6; y++) for (var x = 1; x < b.cols - 6; x++) {
        if (!walk3.parent.hasOwnProperty(key(b, x, y))) continue;
        var free = true;
        for (var dy = 0; dy < 6 && free; dy++) for (var dx = 0; dx < 6; dx++) if (!walkable(x + dx, y + dy)) { free = false; break; }
        if (free) return true;
      }
      return false;
    }

    // 점자 안내판: 입구에서 2칸 이내의 벽
    var brailleNearEntrance = false;
    for (var y = 0; y < b.rows; y++) for (var x = 0; x < b.cols; x++) {
      if (b.wall[y][x] !== 'braille') continue;
      if (cfg.entrance.some(function (e) { return Math.abs(e.x - x) <= 2 && Math.abs(e.y - y) <= 2; })) brailleNearEntrance = true;
    }

    function c(test, fail) { return { test: test, fail: fail }; }
    var hasToilet = c(function () { return toilets.length > 0; }, '변기가 없어요.');
    var toilet2 = c(function () { return reachable(['toilet'], walk2); }, '변기까지 가는 길이 막혀 있어요.');
    var sink2 = c(function () { return reachable(['sink', 'sinkLow'], walk2); }, '손 씻을 세면대가 없어요. (있다면 가는 길이 막혀 있어요)');

    var rules = {
      wheelchair: [
        hasToilet,
        c(function () { return wheelToilets.length > 0; }, '길이 좁아 휠체어가 변기 옆까지 갈 수 없어요. (3칸 폭 필요)'),
        c(hasTurnSpace, '휠체어가 돌 수 있는 넓은 빈 공간(6×6칸)이 없어요.'),
        c(function () {
          return wheelToilets.some(function (t) { var s = cellSet(t); return grabBars.some(function (g) { return touches(g, s); }); });
        }, '변기 바로 옆에 손잡이가 없어요.'),
        c(function () { return reachable(['sinkLow'], walk3); }, '휠체어에서 손이 닿는 낮은 세면대가 없어요.')
      ],
      family: [
        hasToilet, toilet2,
        c(function () { return reachable(['childToilet'], walk2); }, '아이가 쓸 아동용 변기가 없어요.'),
        c(function () { return reachable(['babySeat', 'diaper'], walk2); }, '아이를 앉히거나 기저귀를 갈 곳이 없어요.'),
        c(function () { return reachable(['sinkLow'], walk2); }, '아이 손이 닿는 낮은 세면대가 없어요.')
      ],
      trans: [hasToilet, toilet2, sink2],
      ostomy: [
        hasToilet, toilet2,
        c(function () { return reachable(['ostomy'], walk2); }, '오스토미 세척대가 없어요.'),
        sink2
      ],
      blind: [
        hasToilet, toilet2,
        c(function () { return reachable(['toilet'], walkT); }, '입구부터 변기 앞까지 점자블록이 이어지지 않았어요.'),
        c(function () { return brailleNearEntrance; }, '입구 옆 벽에 점자 안내판이 없어요.'),
        sink2
      ]
    };

    // ---------- 이동 경로 ----------
    // 1) 변기 → 2) 각자 필요한 설비 → 3) 각자에게 맞는 세면대 → 4) 입구로 돌아와 결과 발표
    // 갈 수 없는 단계는 건너뜀. 각 목적지에서 잠깐 멈춤(같은 점을 PAUSE번 반복)
    var PAUSE = 6;
    function covOf(s, k) {
      var cov = {};
      for (var dy = 0; dy < k; dy++) for (var dx = 0; dx < k; dx++) cov[key(b, s.x + dx, s.y + dy)] = true;
      return cov;
    }
    function tactileWalk(x, y) { return walkable(x, y) && (isEntrance(cfg, x, y) || b.tactile[y][x]); }
    var STEP2 = { ostomy: ['ostomy'], family: ['diaper', 'babySeat'] };
    var SINK = { wheelchair: ['sinkLow'], family: ['sinkLow'] };

    function route(v) {
      var k = v.id === 'wheelchair' ? 3 : v.id === 'blind' ? 1 : 2;
      var first = bfs(b, cfg, k, walkable);
      if (!first.order.length) { var e = cfg.entrance[0]; return { path: [{ x: e.x, y: e.y - k + 1 }], k: k }; }
      var home = first.order[0], cur = home, path = [home];
      // 입구에 들어와 바로 꺾지 않고 화장실 안쪽으로 몇 칸 곧장 걸어 들어감
      var LEAD = 5, leadFn = v.id === 'blind' ? tactileWalk : walkable, lead = home;
      var okState = function (x, y) {
        for (var dy = 0; dy < k; dy++) for (var dx = 0; dx < k; dx++) if (!leadFn(x + dx, y + dy)) return false;
        return true;
      };
      for (var n = 0; n < LEAD && okState(lead.x, lead.y - 1); n++) {
        lead = { x: lead.x, y: lead.y - 1 };
        path.push(lead);
      }
      cur = lead;
      // front: 설비 정면(벽 반대쪽) 한가운데에 서서 설비를 바라보며 이용
      function go(ids, walkFn, front) {
        if (!ofType(ids).length) return false;
        var w = bfs(b, cfg, k, walkFn, [cur]), target = null, face = null;
        if (front) {
          var best = Infinity;
          b.objects.forEach(function (o) {
            if (ids.indexOf(o.id) === -1) return;
            var f = frontOf(o), fset = {};
            f.cells.forEach(function (c) { fset[key(b, c.x, c.y)] = true; });
            w.order.forEach(function (s) {
              var cov = covOf(s, k);
              if (!Object.keys(cov).some(function (kk) { return fset[kk]; })) return;
              var d = Math.abs(s.x + k / 2 - f.cx) + Math.abs(s.y + k / 2 - f.cy);
              if (d < best) { best = d; target = s; face = f.face; }
            });
          });
        }
        for (var i = 0; i < w.order.length && !target; i++) {
          var cov = covOf(w.order[i], k);
          if (ofType(ids).some(function (o) { return touches(o, cov); })) target = w.order[i];
        }
        if (!target) return false;
        path = path.concat(pathTo(b, w, target).slice(1));
        for (var p = 0; p < PAUSE; p++) path.push(face ? { x: target.x, y: target.y, face: face } : target);
        cur = target;
        return true;
      }
      // 설비 정면 칸들, 정면 가운데, 설비를 바라보는 방향(이동 그림 이름)
      function frontOf(o) {
        var sz = sizeOf(cfg, o), cells = [], i, r = o.rot % 4;
        if (r === 0) { for (i = 0; i < sz.w; i++) cells.push({ x: o.x + i, y: o.y + sz.h }); return { cells: cells, cx: o.x + sz.w / 2, cy: o.y + sz.h + k / 2, face: 'walk_a' }; }
        if (r === 3) { for (i = 0; i < sz.h; i++) cells.push({ x: o.x + sz.w, y: o.y + i }); return { cells: cells, cx: o.x + sz.w + k / 2, cy: o.y + sz.h / 2, face: 'walk_b' }; }
        if (r === 1) { for (i = 0; i < sz.h; i++) cells.push({ x: o.x - 1, y: o.y + i }); return { cells: cells, cx: o.x - k / 2, cy: o.y + sz.h / 2, face: 'front_a' }; }
        for (i = 0; i < sz.w; i++) cells.push({ x: o.x + i, y: o.y - 1 });
        return { cells: cells, cx: o.x + sz.w / 2, cy: o.y - k / 2, face: 'front_b' };
      }
      // 1) 변기: 시각장애인은 점자블록을 따라서만
      go(['toilet'], v.id === 'blind' ? tactileWalk : walkable);
      // 2) 각자 필요한 설비
      if (STEP2[v.id]) go(STEP2[v.id], walkable, v.id === 'ostomy');
      // 3) 세면대: 휠체어 이용자·보호자는 낮은 세면대, 그 밖은 세면대 (없으면 낮은 세면대)
      if (!go(SINK[v.id] || ['sink'], walkable) && !SINK[v.id]) go(['sinkLow'], walkable);
      // 4) 입구로: 들어온 길처럼 안쪽 지점을 거쳐 곧장 나감
      var back = bfs(b, cfg, k, walkable, [cur]);
      if (back.parent[key(b, lead.x, lead.y)] !== undefined) {
        path = path.concat(pathTo(b, back, lead).slice(1));
        for (var y2 = lead.y + 1; y2 <= home.y; y2++) path.push({ x: home.x, y: y2 });
      } else if (back.parent[key(b, home.x, home.y)] !== undefined) path = path.concat(pathTo(b, back, home).slice(1));
      return { path: path, k: k };
    }

    return cfg.visitors.map(function (v) {
      var list = rules[v.id] || [hasToilet, toilet2, sink2];
      var fail = null;
      for (var i = 0; i < list.length && !fail; i++) if (!list[i].test()) fail = list[i].fail;
      var r = route(v);
      return { id: v.id, ok: !fail, reason: fail || v.happy, path: r.path, size: r.k };
    });
  }

  return {
    createBoard: createBoard, itemById: itemById, isBorder: isBorder, isEntrance: isEntrance,
    sizeOf: sizeOf, cellsOf: cellsOf, objectAt: objectAt, fits: fits, levelOf: levelOf, placement: placement,
    isMounted: isMounted, bandOf: bandOf, cycleBand: cycleBand,
    addObject: addObject, moveObject: moveObject, rotateObject: rotateObject, removeObject: removeObject,
    eraseAt: eraseAt, paintTactile: paintTactile, placeWall: placeWall, evaluate: evaluate
  };
})();

if (typeof module !== 'undefined') module.exports = ModuLogic;
