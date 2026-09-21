'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const E = require('../public/foldEngine.js');

const STEPS_2x2 = [
  { axis: 'v', line: 1, dir: 'r' },
  { axis: 'h', line: 1, dir: 'd' }
];
const LABELS_2x2 = {
  '0,0': { front: '4', back: '5' }, '1,0': { front: '6', back: '3' },
  '0,1': { front: '8', back: '1' }, '1,1': { front: '7', back: '2' }
};

const at = (cells, x, y) => cells.find((c) => c.px === x && c.py === y);

test('双面预览：正面版按原格摆放、页码正立，标注与当前方案一致', () => {
  const r = E.duplexPreview(2, 2, LABELS_2x2, STEPS_2x2, 'long');
  assert.equal(r.ok, true);
  assert.equal(r.front.length, 4);
  for (const [origin, lab] of Object.entries(LABELS_2x2)) {
    const [x, y] = origin.split(',').map(Number);
    const c = at(r.front, x, y);
    assert.equal(c.origin, origin);
    assert.equal(c.face, 'front');
    assert.equal(c.label, lab.front);
    assert.equal(c.blank, false);
    assert.equal(c.rotation, 0);
  }
});

test('双面预览：方形纸格长边翻转 → 背面版左右镜像、页码正立', () => {
  const r = E.duplexPreview(2, 2, LABELS_2x2, STEPS_2x2, 'long');
  assert.equal(r.axis, 'v');
  assert.equal(r.rotation, 0);
  // 原格(0,0)反面 5 → 背面版 (1,0)；原格(1,0)反面 3 → (0,0)
  const c = at(r.back, 1, 0);
  assert.equal(c.origin, '0,0');
  assert.equal(c.face, 'back');
  assert.equal(c.blank, false);
  assert.equal(c.label, '5');
  assert.equal(at(r.back, 0, 0).label, '3');
  assert.equal(at(r.back, 0, 0).origin, '1,0');
  assert.equal(at(r.back, 1, 1).label, '1');
  assert.equal(at(r.back, 0, 1).label, '2');
  assert.ok(r.back.every((c) => c.face === 'back' && c.rotation === 0));
});

test('双面预览：方形纸格短边翻转 → 背面版上下镜像、页码旋转 180°', () => {
  const r = E.duplexPreview(2, 2, LABELS_2x2, STEPS_2x2, 'short');
  assert.equal(r.axis, 'h');
  assert.equal(r.rotation, 180);
  assert.equal(at(r.back, 0, 1).origin, '0,0');
  assert.equal(at(r.back, 0, 1).label, '5');
  assert.equal(at(r.back, 1, 1).label, '3');
  assert.equal(at(r.back, 0, 0).label, '1');
  assert.equal(at(r.back, 1, 0).label, '2');
  assert.ok(r.back.every((c) => c.rotation === 180));
});

test('双面预览：宽纸（1×2）长边为水平边，短边为竖直边', () => {
  const steps = [{ axis: 'v', line: 1, dir: 'r' }];
  const labels = { '0,0': { front: '4', back: '1' }, '1,0': { front: '2', back: '3' } };
  // 长边翻转：绕水平边 → 上下镜像（单行不变）、页码旋转 180°
  const lng = E.duplexPreview(1, 2, labels, steps, 'long');
  assert.equal(lng.axis, 'h');
  assert.equal(lng.rotation, 180);
  assert.equal(at(lng.back, 0, 0).origin, '0,0');
  assert.equal(at(lng.back, 0, 0).label, '1');
  assert.equal(at(lng.back, 1, 0).label, '3');
  // 短边翻转：绕竖直边 → 左右镜像、页码正立
  const sht = E.duplexPreview(1, 2, labels, steps, 'short');
  assert.equal(sht.axis, 'v');
  assert.equal(sht.rotation, 0);
  assert.equal(at(sht.back, 1, 0).origin, '0,0');
  assert.equal(at(sht.back, 1, 0).label, '1');
  assert.equal(at(sht.back, 0, 0).label, '3');
});

test('双面预览：高纸（2×1）长边为竖直边，短边为水平边', () => {
  const steps = [{ axis: 'h', line: 1, dir: 'd' }];
  const lng = E.duplexPreview(2, 1, {}, steps, 'long');
  assert.equal(lng.axis, 'v');
  assert.equal(lng.rotation, 0);
  const sht = E.duplexPreview(2, 1, {}, steps, 'short');
  assert.equal(sht.axis, 'h');
  assert.equal(sht.rotation, 180);
  assert.equal(at(sht.back, 0, 1).origin, '0,0');
  assert.equal(at(sht.back, 0, 0).origin, '0,1');
});

test('双面预览：两种翻转边展开同一张物理印张（背面版互为整版 180° 旋转）', () => {
  const lng = E.duplexPreview(2, 2, LABELS_2x2, STEPS_2x2, 'long');
  const sht = E.duplexPreview(2, 2, LABELS_2x2, STEPS_2x2, 'short');
  assert.equal(lng.back.length, sht.back.length);
  for (const c of lng.back) {
    // 长边版整体旋转 180°（位置与格内页码一起转）即得短边版
    const m = at(sht.back, 2 - 1 - c.px, 2 - 1 - c.py);
    assert.equal(m.origin, c.origin);
    assert.equal(m.label, c.label);
    assert.equal((c.rotation + 180) % 360, m.rotation);
  }
  // 正面版与翻转边无关
  assert.deepEqual(lng.front, sht.front);
});

test('双面预览：背面版位置覆盖整个网格且无重复（双射）', () => {
  for (const mode of ['long', 'short']) {
    const r = E.duplexPreview(2, 2, LABELS_2x2, STEPS_2x2, mode);
    const seen = new Set(r.back.map((c) => `${c.px},${c.py}`));
    assert.equal(seen.size, 4);
    for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) assert.ok(seen.has(`${x},${y}`));
    // 每个原格的反面恰好出现一次
    assert.deepEqual(r.back.map((c) => c.origin).sort(), ['0,0', '0,1', '1,0', '1,1']);
  }
});

test('双面预览：空白面保留占位（label:null、blank:true，格子仍在）', () => {
  const r = E.duplexPreview(2, 2, {}, STEPS_2x2, 'long');
  assert.equal(r.ok, true);
  assert.equal(r.front.length, 4);
  assert.equal(r.back.length, 4);
  for (const c of r.front.concat(r.back)) {
    assert.equal(c.label, null);
    assert.equal(c.blank, true);
  }
  // 部分标注：未标注的面为空白占位，已标注面正常
  const r2 = E.duplexPreview(2, 2, { '0,0': { front: '7', back: '' } }, STEPS_2x2, 'long');
  assert.equal(at(r2.front, 0, 0).label, '7');
  assert.equal(at(r2.back, 1, 0).origin, '0,0');
  assert.equal(at(r2.back, 1, 0).blank, true);
});

test('双面预览：sequence 与当前回放的阅读顺序一致', () => {
  const r = E.duplexPreview(2, 2, LABELS_2x2, STEPS_2x2, 'long');
  const rep = E.replay(2, 2, LABELS_2x2, STEPS_2x2);
  assert.equal(rep.error, null);
  const seq = E.pageSequence(rep.state);
  assert.equal(seq.folded, true);
  assert.deepEqual(r.sequence, seq.stacks[0].sequence);
  assert.deepEqual(r.sequence, ['3', '4', '1', '7', '2', '8', '5', '6']);
});

test('双面预览：非法折叠时禁用并说明原因（含步骤号）', () => {
  const steps = [
    { axis: 'v', line: 1, dir: 'r' },
    { axis: 'v', line: 2, dir: 'l' }   // 1×3 厚度冲突
  ];
  const r = E.duplexPreview(1, 3, {}, steps, 'long');
  assert.equal(r.ok, false);
  assert.equal(r.code, 'thickness');
  assert.equal(r.stepIndex, 1);
  assert.ok(r.message.includes('第 2 步'));
  assert.ok(r.message.includes('无法生成双面印刷版预览'));
});

test('双面预览：未收成单叠时禁用并说明原因', () => {
  const r = E.duplexPreview(2, 3, {}, [{ axis: 'v', line: 1, dir: 'r' }], 'short');
  assert.equal(r.ok, false);
  assert.equal(r.code, 'not_single_stack');
  assert.equal(r.stackCount, 4);
  assert.ok(r.message.includes('尚未收成单叠'));
});

test('双面预览：网格非法 / 翻转方式非法均被拒', () => {
  assert.equal(E.duplexPreview(0, 2, {}, [], 'long').code, 'bad_grid');
  const r = E.duplexPreview(2, 2, {}, STEPS_2x2, 'sideways');
  assert.equal(r.ok, false);
  assert.equal(r.code, 'bad_flip');
  assert.ok(r.message.includes('long'));
  assert.ok(r.message.includes('short'));
});

test('双面预览：纯函数，不改写传入的标注与步骤', () => {
  const labels = { '0,0': { front: '4', back: '5' } };
  const steps = STEPS_2x2.map((s) => ({ ...s }));
  const snapL = JSON.stringify(labels);
  const snapS = JSON.stringify(steps);
  E.duplexPreview(2, 2, labels, steps, 'long');
  E.duplexPreview(2, 2, labels, steps, 'short');
  assert.equal(JSON.stringify(labels), snapL);
  assert.equal(JSON.stringify(steps), snapS);
});
