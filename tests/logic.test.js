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
  add('sink', 10, 1);           // x9~11, y1~2
  add('diaper', 2, 12);         // x1~4, y11~13
  add('babySeat', 7, 12);       // x7~8, y11~13
  add('ostomy', 14, 2);         // x14~15, y1~2
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
    L.addObject(b, cfg, 'sink', 12, 5);
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
    // 변기 주변을 2칸 폭 통로만 남기고 막기
    b.objects = b.objects.filter(function (o) { return o.id !== 'sinkLow' && o.id !== 'sink'; });
    L.addObject(b, cfg, 'sink', 4, 4, 1);  // 세로로 돌린 세면대 x4~5, y3~5 → 변기 앞을 좁힘
    L.addObject(b, cfg, 'ostomy', 2, 7);   // x2~3? (중심 2,7 → x2~3, y7~8)
    var r = results(b);
    assert.strictEqual(r.wheelchair.ok, false);
  },
  '6×6 공간이 없으면 휠체어 실패': function () {
    // 5칸 폭 통로(아래쪽 가로 y9~13, 왼쪽 세로 x3~6)만 남기고 모두 채움
    var b = L.createBoard(cfg);
    L.addObject(b, cfg, 'toilet', 1, 1);       // x1~2, y1~3
    L.addObject(b, cfg, 'grabBar', 1, 5);      // 세로 손잡이 x1, y4~6
    L.addObject(b, cfg, 'sinkLow', 8, 1);      // x7~9, y1~2
    for (var y = 1; y <= 7; y += 2) for (var x = 1; x <= 17; x += 2) {
      if (x + 1 >= 3 && x <= 6) continue;
      L.addObject(b, cfg, 'ostomy', x, y);
    }
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
    var s = L.addObject(b, cfg, 'diaper', 12, 8);
    assert.ok(L.rotateObject(b, cfg, s.index).ok);
    assert.deepStrictEqual(L.sizeOf(cfg, b.objects[s.index]), { w: 3, h: 4 });
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
    // 비상벨도 바깥 벽에만, 같은 칸에 붙이면 바꿔 붙임
    assert.strictEqual(L.placeWall(b, cfg, 'bell', 5, 5).ok, false);
    assert.ok(L.placeWall(b, cfg, 'bell', 13, 14).ok);
    assert.strictEqual(b.wall[14][13], 'bell');
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

var failed = 0;
Object.keys(tests).forEach(function (name) {
  try { tests[name](); console.log('✓ ' + name); }
  catch (e) { failed++; console.log('✗ ' + name + '\n  ' + e.message); }
});
process.exit(failed ? 1 : 0);
