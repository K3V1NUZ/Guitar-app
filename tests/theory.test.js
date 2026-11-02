// Run with: node --test tests/
const test = require('node:test');
const assert = require('node:assert/strict');
const T = require('../js/theory.js');
const V = require('../js/voicings.js');
const STD = [40, 45, 50, 55, 59, 64];

test('enharmonic spelling picks readable keys', () => {
  assert.deepEqual(T.scale(1, 'major').names, ['Db', 'Eb', 'F', 'Gb', 'Ab', 'Bb', 'C']);
  assert.deepEqual(T.scale(1, 'minor').names, ['C#', 'D#', 'E', 'F#', 'G#', 'A', 'B']);
  assert.deepEqual(T.scale(6, 'major').names, ['F#', 'G#', 'A#', 'B', 'C#', 'D#', 'E#']);
  assert.equal(T.chord(8, 'min').symbol, 'G#m');
  assert.deepEqual(T.chord(0, 'dim7').names, ['C', 'Eb', 'Gb', 'Bbb']);
});

test('chord identification', () => {
  const name = (pcs, bass) => T.identifyChord(pcs, bass)[0].symbol;
  assert.equal(name([0, 4, 7], 0), 'C');
  assert.equal(name([9, 0, 4, 7], 9), 'Am7');
  assert.equal(name([7, 11, 2, 5], 11), 'G7/B');
  assert.equal(name([11, 2, 5, 9], 11), 'Bm7b5');
  assert.equal(name([0, 4, 10], 0), 'C7'); // 5th omitted
  assert.equal(name([2, 9], 2), 'D5');
});

test('parse and transpose chord symbols', () => {
  assert.deepEqual(T.parseChord('F#m7b5/E'), { rootPc: 6, rootName: 'F#', typeId: 'm7b5', bassPc: 4, bassName: 'E' });
  assert.equal(T.parseChord('Bbmaj7').typeId, 'maj7');
  assert.equal(T.parseChord('Hello'), null);
  assert.equal(T.transposeSymbol('Am7/G', 3), 'Cm7/Bb');
  assert.equal(T.transposeSymbol('D7/F#', 2), 'E7/G#');
});

test('harmonization and roman numerals', () => {
  const h = T.harmonize(0, 'major');
  assert.deepEqual(h.rows.map((r) => r.seventh.symbol), ['Cmaj7', 'Dm7', 'Em7', 'Fmaj7', 'G7', 'Am7', 'Bm7b5']);
  assert.deepEqual(h.rows.map((r) => r.triad.roman), ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°']);
  assert.equal(T.harmonize(9, 'minor').rows[6].triad.roman, '♭VII');
});

test('scale identification', () => {
  const top = T.identifyScales([0, 2, 4, 5, 7, 9, 11]).filter((r) => r.exact).map((r) => r.rootPc + r.typeId);
  assert.ok(top.includes('0major') && top.includes('9minor') && top.includes('2dorian'));
});

test('key signatures', () => {
  assert.equal(T.keySignature('F#').sharps, 6);
  assert.equal(T.keySignature('Db').flats, 5);
  assert.equal(T.keySignature('C').sharps + T.keySignature('C').flats, 0);
});

test('voicing generator finds the classic open shapes', () => {
  const best = (r, t, tun = STD) => V.toText(V.best(r, t, tun).frets);
  assert.equal(best(0, 'maj'), 'x32010');
  assert.equal(best(9, 'min'), 'x02210');
  assert.equal(best(7, 'maj'), '320003');
  assert.equal(best(2, 'maj'), 'xx0232');
  assert.equal(best(4, 'min'), '022000');
  assert.equal(best(5, 'maj'), '133211');
  assert.equal(best(2, 'maj', [38, 45, 50, 55, 59, 64]), '000232'); // drop D
  assert.equal(best(0, 'maj', [67, 60, 64, 69]), '0003'); // ukulele
});

test('every chord type has at least one voicing on every root (standard tuning)', () => {
  for (let r = 0; r < 12; r++) for (const c of T.CHORDS) {
    assert.ok(V.generate(r, c.id, STD).length > 0, `${T.chord(r, c.id).symbol} has no voicing`);
  }
});

test('fingerings stay within four fingers', () => {
  for (const c of ['maj', 'min', '7', 'm7', 'maj7', '9', '13']) for (let r = 0; r < 12; r++) {
    for (const v of V.generate(r, c, STD)) assert.ok(Math.max(...v.fingers) <= 4);
  }
});
