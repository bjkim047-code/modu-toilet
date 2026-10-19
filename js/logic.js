// 게임 규칙 (화면과 상관없는 순수 로직)
// 보드 만들기, 물건 설치, 이용객 성공/실패 판정을 담당합니다.

var ModuLogic = (function () {
  var WALLISH = { wall: 1, partFull: 1, partLow: 1 };
  var OPEN = { floor: 1, tactile: 1, entrance: 1 };
  var WALKABLE_BASE = { floor: 1, tactile: 1, door: 1, entrance: 1 };
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
    var b = { cols: cfg.cols, rows: cfg.rows, base: grid(cfg.cols, cfg.rows, 'floor'), obj: grid(cfg.cols, cfg.rows, null) };
    for (var y = 0; y < b.rows; y++) {
      for (var x = 0; x < b.cols; x++) {
        if (isBorder(b, x, y)) b.base[y][x] = 'wall';
      }
    }
    cfg.entrance.forEach(function (e) { b.base[e.y][e.x] = 'entrance'; });
    return b;
  }

  function isBorder(b, x, y) {
    return x === 0 || y === 0 || x === b.cols - 1 || y === b.rows - 1;
  }

  function inside(b, x, y) {
    return x >= 0 && y >= 0 && x < b.cols && y < b.rows;
  }

  // 설치. 결과: { ok: true } 또는 { ok: false, msg }
  function place(b, cfg, itemId, x, y) {
    if (!inside(b, x, y)) return { ok: false };
    var item = itemById(cfg, itemId);
    if (!item) return { ok: false };
    var base = b.base[y][x];
    if (base === 'entrance') return { ok: false, msg: '입구에는 설치할 수 없어요.' };

    if (item.layer === 'tool') {
      if (b.obj[y][x]) { b.obj[y][x] = null; return { ok: true }; }
      if (isBorder(b, x, y)) return { ok: false, msg: '바깥 벽은 지울 수 없어요.' };
      if (base === 'floor') return { ok: false };
      b.base[y][x] = 'floor';
      return { ok: true };
    }

    if (item.layer === 'base') {
      if (isBorder(b, x, y)) return { ok: false, msg: '바깥 벽은 바꿀 수 없어요. 벽에 붙이는 물건은 설치할 수 있어요.' };
      if (base === item.id) return { ok: false };
      var o = b.obj[y][x] && itemById(cfg, b.obj[y][x]);
      var nowWallish = !!WALLISH[item.id];
      // 바닥이 벽이 되면 바닥 설비는 사라지고, 벽이 바닥이 되면 벽 부착물은 사라짐
      if (o && ((o.layer === 'floor' && (nowWallish || item.id === 'door')) || (o.layer === 'wall' && !nowWallish))) {
        b.obj[y][x] = null;
      }
      b.base[y][x] = item.id;
      return { ok: true };
    }

    if (item.layer === 'floor') {
      if (base !== 'floor' && base !== 'tactile') return { ok: false, msg: item.name + '은(는) 바닥에만 놓을 수 있어요.' };
      if (b.obj[y][x] === item.id) return { ok: false };
      b.obj[y][x] = item.id;
      return { ok: true };
    }

    if (item.layer === 'wall') {
      if (!WALLISH[base]) return { ok: false, msg: item.name + '은(는) 벽이나 칸막이에 붙여 주세요.' };
      if (b.obj[y][x] === item.id) return { ok: false };
      b.obj[y][x] = item.id;
      return { ok: true };
    }
    return { ok: false };
  }

  function walkable(b, x, y) {
    return inside(b, x, y) && !!WALKABLE_BASE[b.base[y][x]] && !b.obj[y][x];
  }

  function key(b, x, y) { return y * b.cols + x; }

  // 벽·칸막이·문으로 나뉜 영역 찾기
  function findRegions(b) {
    var rid = grid(b.cols, b.rows, -1);
    var regions = [];
    for (var y = 0; y < b.rows; y++) {
      for (var x = 0; x < b.cols; x++) {
        if (rid[y][x] !== -1 || !OPEN[b.base[y][x]]) continue;
        var id = regions.length;
        var cells = [], stack = [[x, y]];
        rid[y][x] = id;
        while (stack.length) {
          var c = stack.pop();
          cells.push({ x: c[0], y: c[1] });
          DIRS.forEach(function (d) {
            var nx = c[0] + d[0], ny = c[1] + d[1];
            if (inside(b, nx, ny) && rid[ny][nx] === -1 && OPEN[b.base[ny][nx]]) {
              rid[ny][nx] = id;
              stack.push([nx, ny]);
            }
          });
        }
        regions.push({ id: id, cells: cells });
      }
    }
    return { rid: rid, regions: regions };
  }

  // 1칸 크기 이용객의 이동 (BFS)
  function bfs(b, starts, passFn) {
    var parent = {}, order = [];
    starts.forEach(function (s) {
      var k = key(b, s.x, s.y);
      if (parent[k] === undefined && passFn(s.x, s.y)) { parent[k] = -1; order.push(s); }
    });
    for (var i = 0; i < order.length; i++) {
      var c = order[i];
      DIRS.forEach(function (d) {
        var nx = c.x + d[0], ny = c.y + d[1];
        var k = key(b, nx, ny);
        if (inside(b, nx, ny) && parent[k] === undefined && passFn(nx, ny)) {
          parent[k] = key(b, c.x, c.y);
          order.push({ x: nx, y: ny });
        }
      });
    }
    return { parent: parent, order: order };
  }

  function pathTo(b, parent, x, y) {
    var path = [], k = key(b, x, y);
    while (k !== -1 && k !== undefined) {
      path.push({ x: k % b.cols, y: Math.floor(k / b.cols) });
      k = parent[k];
    }
    return path.reverse();
  }

  function free2x2(b, x, y) {
    return walkable(b, x, y) && walkable(b, x + 1, y) && walkable(b, x, y + 1) && walkable(b, x + 1, y + 1);
  }

  function cells2x2(x, y) {
    return [{ x: x, y: y }, { x: x + 1, y: y }, { x: x, y: y + 1 }, { x: x + 1, y: y + 1 }];
  }

  function neighbors(b, x, y) {
    var out = [];
    DIRS.forEach(function (d) {
      var nx = x + d[0], ny = y + d[1];
      if (inside(b, nx, ny)) out.push({ x: nx, y: ny });
    });
    return out;
  }

  function evaluate(b, cfg) {
    var reg = findRegions(b);
    var ent = cfg.entrance;
    var hallId = reg.rid[ent[0].y][ent[0].x];

    // 칸(room) 만들기: 입구가 없는 영역 중 문이 붙어 있는 곳
    var rooms = [];
    reg.regions.forEach(function (r) {
      if (r.id === hallId) return;
      var set = {}, doors = {}, boundary = {};
      r.cells.forEach(function (c) { set[key(b, c.x, c.y)] = true; });
      r.cells.forEach(function (c) {
        neighbors(b, c.x, c.y).forEach(function (n) {
          var k = key(b, n.x, n.y);
          if (set[k]) return;
          boundary[k] = n;
          if (b.base[n.y][n.x] === 'door') doors[k] = n;
        });
      });
      var doorList = Object.keys(doors).map(function (k) { return doors[k]; });
      if (!doorList.length) return;
      rooms.push({ cells: r.cells, set: set, doors: doorList, boundary: Object.keys(boundary).map(function (k) { return boundary[k]; }) });
    });

    // 1칸 이동
    var walk1 = bfs(b, ent, function (x, y) { return walkable(b, x, y); });
    var reached1 = {};
    walk1.order.forEach(function (c) { reached1[key(b, c.x, c.y)] = c; });

    // 휠체어 이동 (2x2 크기, 왼쪽 위 좌표 기준)
    var wStarts = [];
    ent.forEach(function (e) {
      [[0, 0], [-1, 0], [0, -1], [-1, -1]].forEach(function (o) { wStarts.push({ x: e.x + o[0], y: e.y + o[1] }); });
    });
    var walk2 = bfs(b, wStarts, function (x, y) { return free2x2(b, x, y); });
    var covered2 = {};
    walk2.order.forEach(function (s) {
      cells2x2(s.x, s.y).forEach(function (c) { covered2[key(b, c.x, c.y)] = true; });
    });

    // 점자블록 길
    var tactileWalk = bfs(b, ent, function (x, y) {
      return walkable(b, x, y) && (b.base[y][x] === 'tactile' || b.base[y][x] === 'entrance');
    });
    var tactileReached = {};
    tactileWalk.order.forEach(function (c) { tactileReached[key(b, c.x, c.y)] = true; });

    function objAdjacentTo(ids, cellSet) {
      for (var y = 0; y < b.rows; y++) for (var x = 0; x < b.cols; x++) {
        if (ids.indexOf(b.obj[y][x]) === -1) continue;
        var ns = neighbors(b, x, y);
        for (var i = 0; i < ns.length; i++) if (cellSet[key(b, ns[i].x, ns[i].y)]) return true;
      }
      return false;
    }
    var sinkAny = objAdjacentTo(['sink', 'sinkLow'], reached1);
    var sinkLowWheel = objAdjacentTo(['sinkLow'], covered2);

    function roomInfo(room) {
      var info = { room: room, objs: {}, free: 0, reached: {}, reachedList: [], wheelCovered: {}, wheelStates: [] };
      room.cells.forEach(function (c) {
        var o = b.obj[c.y][c.x];
        if (o) info.objs[o] = (info.objs[o] || 0) + 1; else info.free++;
        var k = key(b, c.x, c.y);
        if (reached1[k]) { info.reached[k] = true; info.reachedList.push(c); }
      });
      walk2.order.forEach(function (s) {
        var cs = cells2x2(s.x, s.y);
        if (cs.every(function (c) { return room.set[key(b, c.x, c.y)]; })) {
          info.wheelStates.push(s);
          cs.forEach(function (c) { info.wheelCovered[key(b, c.x, c.y)] = true; });
        }
      });
      info.has2x2 = room.cells.some(function (c) { return free2x2(b, c.x, c.y) && cells2x2(c.x, c.y).every(function (d) { return room.set[key(b, d.x, d.y)]; }); });
      info.toilets = room.cells.filter(function (c) { return b.obj[c.y][c.x] === 'toilet'; });
      info.toiletFrom = function (cellSet) {
        return info.toilets.some(function (t) {
          return neighbors(b, t.x, t.y).some(function (n) { return cellSet[key(b, n.x, n.y)]; });
        });
      };
      info.grabBar = info.toilets.some(function (t) {
        return neighbors(b, t.x, t.y).some(function (n) { return b.obj[n.y][n.x] === 'grabBar'; });
      });
      // 칸 둘레 + 문 둘레 벽
      var around = {};
      room.boundary.forEach(function (c) { around[key(b, c.x, c.y)] = c; });
      room.doors.forEach(function (d) {
        neighbors(b, d.x, d.y).forEach(function (n) { around[key(b, n.x, n.y)] = n; });
      });
      info.aroundObj = function (id) {
        return Object.keys(around).some(function (k) { var c = around[k]; return b.obj[c.y][c.x] === id; });
      };
      info.lowPartition = room.boundary.some(function (c) { return b.base[c.y][c.x] === 'partLow'; });
      info.tactileToDoor = room.doors.some(function (d) {
        return neighbors(b, d.x, d.y).some(function (n) {
          return !room.set[key(b, n.x, n.y)] && b.base[n.y][n.x] === 'tactile' && tactileReached[key(b, n.x, n.y)];
        });
      });
      return info;
    }

    var infos = rooms.map(roomInfo);

    function c(test, fail) { return { test: test, fail: fail }; }
    var reach = c(function (i) { return i.reachedList.length > 0; }, '칸까지 가는 길이 막혀 있어요.');
    var toilet = c(function (i) { return i.toiletFrom(i.reached); }, '칸 안에 이용할 수 있는 변기가 없어요.');
    var sink = c(function () { return sinkAny; }, '손 씻을 세면대가 없어요.');

    var rules = {
      wheelchair: [
        c(function (i) { return i.has2x2; }, '칸이 좁아서 휠체어를 돌릴 수 없어요.'),
        c(function (i) { return i.wheelStates.length > 0; }, '길이나 문이 좁아서 휠체어가 못 들어가요. (2칸 폭 필요)'),
        c(function (i) { return i.toiletFrom(i.wheelCovered); }, '휠체어에서 변기로 옮겨 앉을 수 없어요.'),
        c(function (i) { return i.grabBar; }, '변기 바로 옆 벽에 손잡이가 없어요.'),
        c(function () { return sinkLowWheel; }, '휠체어에서 손이 닿는 낮은 세면대가 없어요.')
      ],
      family: [
        reach, toilet,
        c(function (i) { return i.free >= 6; }, '칸이 좁아서 아이와 함께 들어갈 수 없어요.'),
        c(function (i) { return i.objs.babySeat || i.objs.diaper; }, '칸 안에 유아 의자나 기저귀 교환대가 없어요.'),
        sink
      ],
      trans: [
        reach, toilet,
        c(function (i) { return !i.aroundObj('signMale') && !i.aroundObj('signFemale'); }, '칸에 성별 표시가 붙어 있어 들어가기 망설여져요.'),
        c(function (i) { return !i.lowPartition; }, '칸막이 아래가 뚫려 있어 불안해요.'),
        sink
      ],
      ostomy: [
        reach, toilet,
        c(function (i) { return i.objs.ostomy; }, '칸 안에 오스토미 세척대가 없어요.'),
        sink
      ],
      blind: [
        reach, toilet,
        c(function (i) { return i.tactileToDoor; }, '입구부터 칸 문 앞까지 점자블록이 이어지지 않았어요.'),
        c(function (i) { return i.aroundObj('braille'); }, '칸 문 옆에 점자 안내판이 없어요.'),
        sink
      ]
    };

    return cfg.visitors.map(function (v) {
      var list = rules[v.id] || [reach, toilet, sink];
      var size = v.id === 'wheelchair' ? 2 : 1;
      var startPath = size === 2 ? [{ x: ent[0].x, y: ent[0].y - 1 }] : [{ x: ent[0].x, y: ent[0].y }];
      if (!infos.length) {
        return { id: v.id, ok: false, reason: '문이 달린 칸이 없어요. 벽과 문으로 칸을 만들어 보세요.', path: startPath, size: size };
      }
      var best = null, bestScore = -1, bestFail = null;
      infos.forEach(function (info) {
        var score = 0, fail = null;
        for (var i = 0; i < list.length; i++) {
          if (list[i].test(info)) score++;
          else if (!fail) fail = list[i].fail;
        }
        if (score > bestScore) { best = info; bestScore = score; bestFail = fail; }
      });

      // 이동 경로: 가장 알맞은 칸까지
      var path = startPath;
      if (size === 2 && best.wheelStates.length) {
        var target = pickTarget(best.wheelStates, function (s) { return cells2x2(s.x, s.y); });
        path = pathTo(b, walk2.parent, target.x, target.y);
      } else if (size === 1 && best.reachedList.length) {
        var t1 = pickTarget(best.reachedList, function (s) { return [s]; });
        path = pathTo(b, walk1.parent, t1.x, t1.y);
      }
      return { id: v.id, ok: !bestFail, reason: bestFail || v.happy, path: path, size: size };

      // 변기 옆 자리를 우선으로 고름
      function pickTarget(list, cellsOf) {
        for (var i = 0; i < list.length; i++) {
          var cs = cellsOf(list[i]);
          for (var j = 0; j < cs.length; j++) {
            if (neighbors(b, cs[j].x, cs[j].y).some(function (n) { return b.obj[n.y][n.x] === 'toilet'; })) return list[i];
          }
        }
        return list[0];
      }
    });
  }

  // 모든 이용객이 성공하는 예시
  function sampleBoard(cfg) {
    var b = createBoard(cfg);
    function put(id, x, y) { place(b, cfg, id, x, y); }
    var x, y;
    // 왼쪽 위: 모두의 화장실 (넓은 1인 칸)
    for (x = 1; x <= 9; x++) put('wall', x, 7);
    for (y = 1; y <= 6; y++) put('wall', 9, y);
    put('door', 4, 7); put('door', 5, 7);
    put('toilet', 1, 1); put('grabBar', 0, 1); put('grabBar', 1, 0);
    put('sinkLow', 8, 1); put('ostomy', 8, 6); put('diaper', 1, 6); put('babySeat', 2, 6);
    put('braille', 3, 7);
    // 오른쪽 위: 일반 칸 3개
    for (x = 19; x <= 28; x++) put('partFull', x, 5);
    for (y = 1; y <= 4; y++) { put('partFull', 19, y); put('partFull', 22, y); put('partFull', 25, y); }
    put('door', 20, 5); put('door', 23, 5); put('door', 26, 5);
    put('toilet', 21, 1); put('toilet', 24, 1); put('toilet', 27, 1);
    // 세면대
    put('sink', 28, 9); put('sink', 28, 10); put('sinkLow', 28, 11);
    // 점자블록: 입구 → 위로 → 왼쪽 → 모두의 화장실 문 앞
    for (y = 8; y <= 18; y++) put('tactile', 14, y);
    for (x = 4; x <= 13; x++) put('tactile', x, 8);
    return b;
  }

  return { createBoard: createBoard, place: place, evaluate: evaluate, sampleBoard: sampleBoard, isBorder: isBorder, itemById: itemById };
})();

if (typeof module !== 'undefined') module.exports = ModuLogic;
