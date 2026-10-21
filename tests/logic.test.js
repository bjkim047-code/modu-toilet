// 실행: node tests/logic.test.js
var assert = require('assert');
var cfg = require('../js/config.js');
var L = require('../js/logic.js');

// 5명 모두 성공하는 배치 (입구는 오른쪽 아래 x=14~17, y=14)
function goodBoard() {
  var b = L.createBoard(cfg);
  function add(id, cx, cy, rot) { var r = L.addObject(b, cfg, id, cx, cy, rot); assert.ok(r.ok, id + ' ' + r.msg); return r.index; }
  add('toilet', 2, 2);          // x1~2, y1~3
  add('grabBar', 1, 4, 1);      // 변기 아래 가로로 돌린 손잡이 x1~3, y4
  add('sinkLow', 6, 1);         // x5~7, y1~2
  add('sink', 10, 1);           // 벽걸이, x9~11, y1~2
  add('diaper', 0, 9);          // 왼쪽 벽 벽걸이, x1~2, y8~10
  add('babySeat', 0, 13);       // 왼쪽 벽 벽걸이, x1~2, y13
  add('ostomy', 14, 2);
  add('childToilet', 8, 10);    // x8~9, y10~11         // x14~15, y1~2
  L.placeWall(b, cfg, 'braille', 13, 14);
  // 점자블록: 입구(15,14) 위로 → 왼쪽 → 손잡이를 돌아 변기 오른쪽 (3,2)까지
  for (var y = 6; y <= 13; y++) L.paintTactile(b, 15, y);
  for (var x = 4; x <= 15; x++) L.paintTactile(b, x, 6);
  for (y = 2; y <= 6; y++) L.paintTactile(b, 4, y);
  L.paintTactile(b, 3, 2);
  return b;
}

function results(b) {
  var out = {};
  L.evaluate(b, cfg).forEach(function (r) { out[r.id] = r; });
  return out;
}

function remove(b, id) {
  b.objects = b.objects.filter(function (o) { return o.id !== id; });
}

var tests = {
  '빈 보드는 모두 실패': function () {
    var r = results(L.createBoard(cfg));
    Object.keys(r).forEach(function (id) {
      assert.strictEqual(r[id].ok, false);
      assert.match(r[id].reason, /변기가 없어요/);
    });
  },
  '잘 꾸민 보드는 5명 모두 성공': function () {
    var r = results(goodBoard());
    Object.keys(r).forEach(function (id) { assert.strictEqual(r[id].ok, true, id + ': ' + r[id].reason); });
    assert.ok(r.wheelchair.path.length > 10);
    assert.strictEqual(r.blind.size, 1, '시각장애인은 점자블록을 따라 걸음');
  },
  '변기와 세면대만 있으면 트랜스젠더·논바이너리 이용자는 성공': function () {
    var b = L.createBoard(cfg);
    L.addObject(b, cfg, 'toilet', 5, 5);
    L.addObject(b, cfg, 'sink', 12, 1);
    var r = results(b);
    assert.strictEqual(r.trans.ok, true);
    assert.strictEqual(r.family.ok, false);
  },
  '손잡이를 지우면 휠체어 실패': function () {
    var b = goodBoard();
    remove(b, 'grabBar');
    assert.match(results(b).wheelchair.reason, /손잡이/);
  },
  '길이 좁으면 휠체어 실패, 다른 사람은 통과': function () {
    var b = goodBoard();
    // 변기 오른쪽(x4~5) 통로를 2칸 폭으로 좁힘: 오스토미 세척대 두 개를 x6~8, y1~4에 둠
    // (낮은 세면대는 벽걸이라 바닥을 막지 않으므로 통로를 좁히지 않음)
    b.objects = b.objects.filter(function (o) { return o.id !== 'ostomy'; });
    assert.ok(L.addObject(b, cfg, 'ostomy', 7, 1).ok);   // x6~8, y1~2
    assert.ok(L.addObject(b, cfg, 'ostomy', 7, 3).ok);   // x6~8, y3~4
    var r = results(b);
    assert.strictEqual(r.wheelchair.ok, false);
    assert.match(r.wheelchair.reason, /3칸 폭/);
    assert.strictEqual(r.ostomy.ok, true);
    assert.strictEqual(r.family.ok, true);
  },
  '6×6 공간이 없으면 휠체어 실패': function () {
    // 통로(아래쪽 가로 y9~13, 왼쪽 세로 x3~6)만 남기고 오른쪽 위(x7~18, y1~8)를 3×2 세척대로 채움
    var b = L.createBoard(cfg);
    L.addObject(b, cfg, 'toilet', 1, 1);       // x1~2, y1~3
    L.addObject(b, cfg, 'grabBar', 1, 5);      // 세로 손잡이 x1, y4~6
    L.addObject(b, cfg, 'sinkLow', 8, 1);      // 벽걸이, x7~9, y1~2
    for (var y = 1; y <= 7; y += 2) for (var x = 7; x <= 16; x += 3) {
      var o = { id: 'ostomy', x: x, y: y, rot: 0 };
      assert.ok(L.fits(b, cfg, o, -1).ok, x + ',' + y);
      b.objects.push(o);
    }
    b.objects.push({ id: 'ostomy', x: 1, y: 7, rot: 3 });    // 왼쪽 아래 구석(x1~2, y7~9)도 바닥 설비로 막음
    var r = results(b);
    assert.strictEqual(r.wheelchair.ok, false);
    assert.match(r.wheelchair.reason, /6×6/);
  },
  '점자블록이 끊기면 시각장애인 실패': function () {
    var b = goodBoard();
    L.eraseAt(b, cfg, 15, 10);
    assert.match(results(b).blind.reason, /점자블록/);
  },
  '점자 안내판이 입구에서 멀면 시각장애인 실패': function () {
    var b = goodBoard();
    L.eraseAt(b, cfg, 13, 14);
    L.placeWall(b, cfg, 'braille', 5, 14);
    assert.match(results(b).blind.reason, /점자 안내판/);
  },
  '오스토미 세척대를 지우면 장루·요루 이용자 실패': function () {
    var b = goodBoard();
    remove(b, 'ostomy');
    assert.match(results(b).ostomy.reason, /오스토미/);
  },
  '설치·이동·회전 규칙': function () {
    var b = L.createBoard(cfg);
    var t = L.addObject(b, cfg, 'toilet', 5, 5);
    assert.ok(t.ok);
    assert.deepStrictEqual(L.sizeOf(cfg, b.objects[0]), { w: 2, h: 3 });
    // 변기는 두 방향(0, 3)만 오감
    assert.ok(L.rotateObject(b, cfg, 0).ok);
    assert.strictEqual(b.objects[0].rot, 3);
    assert.deepStrictEqual(L.sizeOf(cfg, b.objects[0]), { w: 3, h: 2 });
    assert.ok(L.rotateObject(b, cfg, 0).ok);
    assert.strictEqual(b.objects[0].rot, 0);
    assert.deepStrictEqual([b.objects[0].x, b.objects[0].y], [5, 4], '두 번 돌리면 제자리');
    assert.strictEqual(L.addObject(b, cfg, 'sink', 5, 5).ok, false, '겹치면 안 됨');
    var s = L.addObject(b, cfg, 'ostomy', 12, 8);
    assert.ok(s.ok, s.msg);
    assert.ok(L.rotateObject(b, cfg, s.index).ok);
    assert.deepStrictEqual(L.sizeOf(cfg, b.objects[s.index]), { w: 2, h: 3 });
    assert.ok(L.moveObject(b, cfg, s.index, 14, 2).ok);
    // 가장자리 클릭도 안쪽으로 밀어 넣음
    var g = L.addObject(b, cfg, 'grabBar', 0, 0);
    assert.ok(g.ok);
    assert.strictEqual(b.objects[g.index].x, 1);
    // 점자블록은 설비 아래에도 깔림
    assert.ok(L.paintTactile(b, 5, 5).ok);
    assert.strictEqual(L.paintTactile(b, 0, 5).ok, false);
    // 지우개: 설비 먼저, 그다음 점자블록
    assert.ok(L.eraseAt(b, cfg, 5, 5).ok);
    assert.strictEqual(L.objectAt(b, cfg, 5, 5), -1);
    assert.strictEqual(b.tactile[5][5], true);
    assert.ok(L.eraseAt(b, cfg, 5, 5).ok);
    assert.strictEqual(b.tactile[5][5], false);
    // 점자 안내판은 바깥 벽(입구 제외)에만
    assert.strictEqual(L.placeWall(b, cfg, 'braille', 5, 5).ok, false);
    assert.strictEqual(L.placeWall(b, cfg, 'braille', 15, 14).ok, false);
    assert.ok(L.placeWall(b, cfg, 'braille', 13, 14).ok);
    // 같은 칸에 다른 벽 물건이 오면 바꿔 붙임 (지금은 점자 안내판만 벽 칸에 붙음)
    assert.strictEqual(L.placeWall(b, cfg, 'bell', 13, 14).ok, false, '비상벨은 이제 벽 옆 칸에 붙는 물건');
    // 휴지걸이는 1×1, 벽 바로 옆 칸에만
    assert.strictEqual(L.addObject(b, cfg, 'paperHolder', 10, 10).ok, false);
  }
};

tests['휴지걸이: 벽 가운데 단 층, 바닥 설비와 겹침 가능'] = function () {
  var b = L.createBoard(cfg);
  var t = L.addObject(b, cfg, 'toilet', 5, 2);           // x5~6, y1~3
  assert.ok(t.ok);
  // 위쪽 벽 바로 옆(y=1), 변기와 같은 칸에 겹쳐 놓을 수 있음
  var p = L.addObject(b, cfg, 'paperHolder', 5, 1);
  assert.ok(p.ok, p.msg);
  assert.deepStrictEqual(L.sizeOf(cfg, b.objects[p.index]), { w: 1, h: 1 });
  assert.strictEqual(b.objects[p.index].rot, 0);
  // 같은 층에는 두 개를 겹칠 수 없음
  assert.strictEqual(L.addObject(b, cfg, 'paperHolder', 5, 1).ok, false);
  // 벽 칸을 누르면 바로 옆 칸으로, 왼쪽 벽이면 방향 3
  var q = L.addObject(b, cfg, 'paperHolder', 0, 8);
  assert.ok(q.ok);
  assert.deepStrictEqual([b.objects[q.index].x, b.objects[q.index].y, b.objects[q.index].rot], [1, 8, 3]);
  // 벽 칸을 누르면 그 벽에 붙은 물건을 찾음, 같은 칸이면 위층 물건을 먼저
  assert.strictEqual(L.objectAt(b, cfg, 0, 8), q.index);
  assert.strictEqual(L.objectAt(b, cfg, 5, 1), p.index);
  // 방향은 모서리 칸에서만 바꿀 수 있음
  assert.strictEqual(L.rotateObject(b, cfg, q.index).ok, false);
  var c = L.addObject(b, cfg, 'paperHolder', 1, 1);
  assert.ok(c.ok);
  assert.ok(L.rotateObject(b, cfg, c.index).ok);
  assert.strictEqual(b.objects[c.index].rot, 3);
  // 끌어서 옮기면 붙는 벽도 바뀜
  assert.ok(L.moveObject(b, cfg, c.index, 9, 1).ok);
  assert.deepStrictEqual([b.objects[c.index].x, b.objects[c.index].y, b.objects[c.index].rot], [9, 1, 0]);
  assert.strictEqual(L.moveObject(b, cfg, c.index, 9, 6).ok, false);
  // 바닥을 막지 않음: 휴지걸이만 있는 칸은 지나갈 수 있음
  var walkB = L.createBoard(cfg);
  L.addObject(walkB, cfg, 'toilet', 2, 2);
  L.addObject(walkB, cfg, 'sink', 10, 1);
  var before = JSON.stringify(L.evaluate(walkB, cfg));
  L.addObject(walkB, cfg, 'paperHolder', 3, 1);
  L.addObject(walkB, cfg, 'paperHolder', 1, 5);
  assert.strictEqual(JSON.stringify(L.evaluate(walkB, cfg)), before);
  // 지우개는 위층(휴지걸이)부터
  L.eraseAt(b, cfg, 5, 1);
  assert.strictEqual(b.objects.filter(function (o) { return o.id === 'toilet'; }).length, 1);
  assert.strictEqual(L.objectAt(b, cfg, 5, 1), 0);
};

tests['수건걸이: 벽을 따라 2칸, 휴지걸이와 같은 층'] = function () {
  var b = L.createBoard(cfg);
  var t = L.addObject(b, cfg, 'towelBar', 6, 0);         // 위쪽 벽 면을 누름 → x6~7, y1
  assert.ok(t.ok, t.msg);
  var o = b.objects[t.index];
  assert.deepStrictEqual([o.x, o.y, o.rot], [6, 1, 0]);
  assert.deepStrictEqual(L.sizeOf(cfg, o), { w: 2, h: 1 });
  // 같은 층(휴지걸이)과는 겹칠 수 없고, 바닥 설비와는 겹칠 수 있음
  assert.strictEqual(L.addObject(b, cfg, 'paperHolder', 7, 1).ok, false);
  assert.ok(L.addObject(b, cfg, 'paperHolder', 8, 1).ok);
  assert.ok(L.addObject(b, cfg, 'toilet', 7, 2).ok);
  // 왼쪽 벽에서는 세로로 2칸
  var l = L.addObject(b, cfg, 'towelBar', 0, 9);
  assert.ok(l.ok);
  assert.deepStrictEqual(L.sizeOf(cfg, b.objects[l.index]), { w: 1, h: 2 });
  // 오른쪽 끝에서는 안쪽으로 밀어 넣음
  var e = L.addObject(b, cfg, 'towelBar', 18, 1);
  assert.ok(e.ok);
  assert.strictEqual(b.objects[e.index].x, 17);
  // 모서리에서 돌리기
  var c = L.addObject(b, cfg, 'towelBar', 1, 1);
  assert.ok(c.ok, c.msg);
  assert.ok(L.rotateObject(b, cfg, c.index).ok);
  assert.deepStrictEqual([b.objects[c.index].x, b.objects[c.index].y, b.objects[c.index].rot], [1, 1, 3]);
};

tests['비상벨: 1×1, 벽 높이 3단 어디든, 단마다 따로 겹침'] = function () {
  var b = L.createBoard(cfg);
  var p = L.addObject(b, cfg, 'paperHolder', 5, 1);          // 가운데 단
  assert.ok(p.ok);
  // 같은 칸 가운데 단에는 안 되고, 아래·위 단에는 됨
  assert.strictEqual(L.addObject(b, cfg, 'bell', 5, 1, 0, 2).ok, false);
  var lo = L.addObject(b, cfg, 'bell', 5, 1, 0, 1);
  var hi = L.addObject(b, cfg, 'bell', 5, 0, 0, 3);          // 벽 면을 눌러도 됨
  assert.ok(lo.ok && hi.ok);
  assert.deepStrictEqual(L.sizeOf(cfg, b.objects[hi.index]), { w: 1, h: 1 });
  assert.deepStrictEqual([b.objects[hi.index].x, b.objects[hi.index].y, L.bandOf(cfg, b.objects[hi.index])], [5, 1, 3]);
  // 세 단이 다 차면 높이를 바꿀 수 없음
  assert.strictEqual(L.cycleBand(b, cfg, lo.index).ok, false);
  // 한 칸 비우면 높이 바꾸기: 비어 있는 단으로 감
  L.removeObject(b, p.index);
  var lo2 = b.objects.findIndex(function (o) { return o.id === 'bell' && o.band === 1; });
  assert.ok(L.cycleBand(b, cfg, lo2).ok);
  assert.strictEqual(b.objects[lo2].band, 2);
  // 휴지걸이는 높이 고정
  var q = L.addObject(b, cfg, 'paperHolder', 9, 1);
  assert.strictEqual(L.cycleBand(b, cfg, q.index).ok, false);
  // 벽에서 먼 칸은 안 됨, 왼쪽 벽은 방향 3
  assert.strictEqual(L.addObject(b, cfg, 'bell', 8, 8, 0, 1).ok, false);
  var l = L.addObject(b, cfg, 'bell', 1, 7, 0, 1);
  assert.strictEqual(b.objects[l.index].rot, 3);
  // 옮겨도 높이 단은 그대로
  assert.ok(L.moveObject(b, cfg, l.index, 1, 9).ok);
  assert.strictEqual(L.bandOf(cfg, b.objects[l.index]), 1);
};

tests['벽걸이 세면대: 가운데 단, 바닥을 막지 않음'] = function () {
  var b = L.createBoard(cfg);
  assert.strictEqual(L.addObject(b, cfg, 'sink', 10, 6).ok, false, '벽에서 먼 칸은 안 됨');
  var w = L.addObject(b, cfg, 'sink', 10, 0);              // 위쪽 벽 면을 누름 → 가운데가 x10
  assert.ok(w.ok, w.msg);
  var o = b.objects[w.index];
  assert.deepStrictEqual([o.x, o.y, L.bandOf(cfg, o)], [9, 1, 2]);
  // 같은 가운데 단의 휴지걸이와는 겹칠 수 없고, 비상벨 아래 단과는 겹칠 수 있음
  assert.strictEqual(L.addObject(b, cfg, 'paperHolder', 10, 1).ok, false);
  assert.ok(L.addObject(b, cfg, 'bell', 10, 1, 0, 1).ok);
  // 왼쪽 벽에서는 세로로 3칸
  var l = L.addObject(b, cfg, 'sink', 0, 8);
  assert.ok(l.ok);
  assert.deepStrictEqual(L.sizeOf(cfg, b.objects[l.index]), { w: 2, h: 3 });
  // 세면대 아래 칸은 지나갈 수 있음: 벽에 붙인 세면대만으로 손 씻기 성공
  var t = L.createBoard(cfg);
  L.addObject(t, cfg, 'toilet', 3, 2);
  L.addObject(t, cfg, 'sink', 12, 1);
  var r = L.evaluate(t, cfg).filter(function (x) { return x.id === 'trans'; })[0];
  assert.strictEqual(r.ok, true, r.reason);
};

tests['낮은 세면대: 벽걸이 아래 단, 가운데 단 세면대와 겹침 가능'] = function () {
  var b = L.createBoard(cfg);
  var lo = L.addObject(b, cfg, 'sinkLow', 10, 0);
  assert.ok(lo.ok, lo.msg);
  assert.deepStrictEqual([b.objects[lo.index].x, b.objects[lo.index].y, L.bandOf(cfg, b.objects[lo.index])], [9, 1, 1]);
  // 일반 세면대(가운데 단)는 같은 자리에 겹쳐 걸 수 있고, 아래 단 비상벨은 안 됨
  assert.ok(L.addObject(b, cfg, 'sink', 10, 1).ok);
  assert.strictEqual(L.addObject(b, cfg, 'bell', 10, 1, 0, 1).ok, false);
  assert.strictEqual(L.addObject(b, cfg, 'sinkLow', 10, 7).ok, false, '벽에서 먼 칸은 안 됨');
  // 휠체어가 낮은 세면대 아래로 다가가 손을 씻을 수 있음
  var t = L.createBoard(cfg);
  L.addObject(t, cfg, 'toilet', 3, 2);
  L.addObject(t, cfg, 'grabBar', 5, 2);
  L.addObject(t, cfg, 'sinkLow', 12, 1);
  var r = L.evaluate(t, cfg).filter(function (x) { return x.id === 'wheelchair'; })[0];
  assert.strictEqual(r.ok, true, r.reason);
};

tests['기저귀 교환대·유아 의자: 벽걸이 가운데 단'] = function () {
  var b = L.createBoard(cfg);
  assert.strictEqual(L.addObject(b, cfg, 'diaper', 10, 8).ok, false, '벽에서 먼 칸은 안 됨');
  var d = L.addObject(b, cfg, 'diaper', 10, 0);
  assert.ok(d.ok, d.msg);
  assert.deepStrictEqual(L.sizeOf(cfg, b.objects[d.index]), { w: 3, h: 2 });
  assert.strictEqual(L.bandOf(cfg, b.objects[d.index]), 2);
  // 같은 가운데 단의 세면대와 겹치면 안 되고, 바닥 설비(변기)와는 겹칠 수 있음
  assert.strictEqual(L.addObject(b, cfg, 'sink', 10, 1).ok, false);
  assert.ok(L.addObject(b, cfg, 'toilet', 10, 2).ok);
  var s = L.addObject(b, cfg, 'babySeat', 0, 6);
  assert.ok(s.ok, s.msg);
  assert.deepStrictEqual(L.sizeOf(cfg, b.objects[s.index]), { w: 2, h: 1 });
  // 보호자는 벽에 건 유아 의자로도 성공
  var t = L.createBoard(cfg);
  L.addObject(t, cfg, 'toilet', 6, 2);
  L.addObject(t, cfg, 'sinkLow', 12, 1);
  L.addObject(t, cfg, 'childToilet', 10, 8);
  L.addObject(t, cfg, 'babySeat', 0, 6);
  var r = L.evaluate(t, cfg).filter(function (x) { return x.id === 'family'; })[0];
  assert.strictEqual(r.ok, true, r.reason);
};

tests['보호자: 아동용 변기와 낮은 세면대가 필요'] = function () {
  var b = goodBoard();
  assert.strictEqual(results(b).family.ok, true);
  var noChild = goodBoard();
  noChild.objects = noChild.objects.filter(function (o) { return o.id !== 'childToilet'; });
  assert.match(results(noChild).family.reason, /아동용 변기/);
  var noLow = goodBoard();
  noLow.objects = noLow.objects.filter(function (o) { return o.id !== 'sinkLow'; });
  var r = results(noLow);
  assert.match(r.family.reason, /낮은 세면대/);
  assert.strictEqual(r.trans.ok, true, '일반 세면대만 있어도 다른 이용객은 성공');
};

var failed = 0;
Object.keys(tests).forEach(function (name) {
  try { tests[name](); console.log('✓ ' + name); }
  catch (e) { failed++; console.log('✗ ' + name + '\n  ' + e.message); }
});
process.exit(failed ? 1 : 0);
