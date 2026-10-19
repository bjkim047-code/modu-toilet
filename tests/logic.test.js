// 실행: node tests/logic.test.js
var assert = require('assert');
var cfg = require('../js/config.js');
var L = require('../js/logic.js');

// 오른쪽 일반 칸의 변기를 지워서 모두의 화장실 칸만 남김
function onlyUniversal() {
  var b = L.sampleBoard(cfg);
  [21, 24, 27].forEach(function (x) { L.place(b, cfg, 'eraser', x, 1); });
  return b;
}

function results(b) {
  var out = {};
  L.evaluate(b, cfg).forEach(function (r) { out[r.id] = r; });
  return out;
}

var tests = {
  '빈 보드는 모두 실패': function () {
    var r = results(L.createBoard(cfg));
    Object.keys(r).forEach(function (id) {
      assert.strictEqual(r[id].ok, false);
      assert.match(r[id].reason, /칸이 없어요/);
    });
  },
  '예시 보드는 5명 모두 성공': function () {
    var r = results(L.sampleBoard(cfg));
    Object.keys(r).forEach(function (id) { assert.strictEqual(r[id].ok, true, id + ': ' + r[id].reason); });
    assert.ok(r.wheelchair.path.length > 5);
    assert.ok(r.blind.path.length > 5);
  },
  '성별 표시를 붙이면 트랜스젠더·논바이너리 이용자만 실패': function () {
    var b = onlyUniversal();
    assert.ok(L.place(b, cfg, 'signMale', 6, 7).ok);
    var r = results(b);
    assert.strictEqual(r.trans.ok, false);
    assert.match(r.trans.reason, /성별 표시/);
    assert.strictEqual(r.family.ok, true);
  },
  '다른 성중립 칸이 있으면 성별 표시가 있어도 성공': function () {
    var b = L.sampleBoard(cfg);
    L.place(b, cfg, 'signMale', 6, 7);
    assert.strictEqual(results(b).trans.ok, true);
  },
  '아래 뚫린 칸막이는 트랜스젠더·논바이너리 이용자 실패': function () {
    var b = onlyUniversal();
    L.place(b, cfg, 'partLow', 9, 3);
    assert.match(results(b).trans.reason, /칸막이 아래/);
  },
  '문이 1칸이면 휠체어 실패': function () {
    var b = L.sampleBoard(cfg);
    L.place(b, cfg, 'wall', 5, 7);
    var r = results(b);
    assert.strictEqual(r.wheelchair.ok, false);
    assert.match(r.wheelchair.reason, /휠체어가 못 들어가요/);
    assert.strictEqual(r.ostomy.ok, true);
  },
  '손잡이를 지우면 휠체어 실패': function () {
    var b = L.sampleBoard(cfg);
    L.place(b, cfg, 'eraser', 0, 1);
    L.place(b, cfg, 'eraser', 1, 0);
    assert.match(results(b).wheelchair.reason, /손잡이/);
  },
  '점자블록이 끊기면 시각장애인 실패': function () {
    var b = L.sampleBoard(cfg);
    L.place(b, cfg, 'eraser', 14, 12);
    assert.match(results(b).blind.reason, /점자블록/);
  },
  '오스토미 세척대를 지우면 장루·요루 이용자 실패': function () {
    var b = L.sampleBoard(cfg);
    L.place(b, cfg, 'eraser', 8, 6);
    assert.match(results(b).ostomy.reason, /오스토미/);
  },
  '설치 규칙': function () {
    var b = L.createBoard(cfg);
    assert.strictEqual(L.place(b, cfg, 'toilet', 0, 5).ok, false);
    assert.strictEqual(L.place(b, cfg, 'grabBar', 5, 5).ok, false);
    assert.strictEqual(L.place(b, cfg, 'grabBar', 0, 5).ok, true);
    assert.strictEqual(L.place(b, cfg, 'wall', 14, 19).ok, false);
    assert.strictEqual(L.place(b, cfg, 'eraser', 0, 5).ok, true);
    assert.strictEqual(b.obj[5][0], null);
    assert.strictEqual(b.base[5][0], 'wall');
  }
};

var failed = 0;
Object.keys(tests).forEach(function (name) {
  try { tests[name](); console.log('✓ ' + name); }
  catch (e) { failed++; console.log('✗ ' + name + '\n  ' + e.message); }
});
process.exit(failed ? 1 : 0);
