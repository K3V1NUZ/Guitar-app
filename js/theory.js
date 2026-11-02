/* Fretbook — music theory engine.
 * Pure functions, no DOM. Works in the browser (window.GA.Theory) and in Node (for tests).
 */
(function (root) {
  'use strict';
  const GA = (root.GA = root.GA || {});
  const T = (GA.Theory = {});

  const mod = (n, m = 12) => ((n % m) + m) % m;
  T.mod = mod;

  const LETTERS = 'CDEFGAB';
  const LETTER_PC = [0, 2, 4, 5, 7, 9, 11];
  const SHARP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const FLAT = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
  T.SHARP = SHARP;
  T.FLAT = FLAT;
  T.isBlack = (pc) => [1, 3, 6, 8, 10].includes(mod(pc));

  /* ---------- Intervals ---------- */
  // name: [semitones, scale degree]
  const IV = {
    '1': [0, 1], 'b2': [1, 2], '2': [2, 2], '#2': [3, 2], 'bb3': [2, 3], 'b3': [3, 3], '3': [4, 3],
    'b4': [4, 4], '4': [5, 4], '#4': [6, 4], 'b5': [6, 5], '5': [7, 5], '#5': [8, 5], 'b6': [8, 6],
    '6': [9, 6], '#6': [10, 6], 'bb7': [9, 7], 'b7': [10, 7], '7': [11, 7],
    'b9': [1, 9], '9': [2, 9], '#9': [3, 9], '11': [5, 11], '#11': [6, 11], 'b13': [8, 13], '13': [9, 13],
  };
  T.IV = IV;
  T.INTERVAL_NAMES = {
    '1': 'Root', 'b2': 'Minor 2nd', '2': 'Major 2nd', '#2': 'Augmented 2nd', 'bb3': 'Diminished 3rd',
    'b3': 'Minor 3rd', '3': 'Major 3rd', 'b4': 'Diminished 4th', '4': 'Perfect 4th', '#4': 'Augmented 4th',
    'b5': 'Diminished 5th', '5': 'Perfect 5th', '#5': 'Augmented 5th', 'b6': 'Minor 6th', '6': 'Major 6th',
    '#6': 'Augmented 6th', 'bb7': 'Diminished 7th', 'b7': 'Minor 7th', '7': 'Major 7th', 'b9': 'Minor 9th',
    '9': 'Major 9th', '#9': 'Augmented 9th', '11': 'Perfect 11th', '#11': 'Augmented 11th',
    'b13': 'Minor 13th', '13': 'Major 13th',
  };
  T.SEMI_SHORT = ['1', 'b2', '2', 'b3', '3', '4', 'b5', '5', 'b6', '6', 'b7', '7'];
  T.SEMI_LONG = ['Unison / Octave', 'Minor 2nd', 'Major 2nd', 'Minor 3rd', 'Major 3rd', 'Perfect 4th',
    'Tritone', 'Perfect 5th', 'Minor 6th', 'Major 6th', 'Minor 7th', 'Major 7th'];

  /** Colour family for an interval: root / third / fifth / seventh / ext */
  T.ivRole = function (iv) {
    if (iv == null) return 'ext';
    const deg = IV[iv] ? IV[iv][1] : 0;
    if (deg === 1) return 'root';
    if (deg === 3) return 'third';
    if (deg === 5) return 'fifth';
    if (deg === 7) return 'seventh';
    return 'ext';
  };

  /* ---------- Notes ---------- */
  // A spelled note is { l: letterIndex 0-6, a: accidental (-2..2) }
  T.parseNote = function (str) {
    const m = /^\s*([A-Ga-g])(##|bb|#|b|♯♯|♭♭|♯|♭|x)?/.exec(str || '');
    if (!m) return null;
    const l = LETTERS.indexOf(m[1].toUpperCase());
    const accStr = (m[2] || '').replace(/♯/g, '#').replace(/♭/g, 'b').replace('x', '##');
    const a = accStr.startsWith('#') ? accStr.length : -accStr.length;
    return { l, a, len: m[0].length };
  };
  T.notePc = (n) => mod(LETTER_PC[n.l] + n.a);
  T.noteName = (n) => LETTERS[n.l] + (n.a > 0 ? '#'.repeat(n.a) : 'b'.repeat(-n.a));

  /** Name of a bare pitch class, using the user's accidental preference. */
  T.pcName = (pc, pref = 'flat') => (pref === 'sharp' ? SHARP : FLAT)[mod(pc)];

  T.spellInterval = function (rootNote, iv) {
    const [semi, deg] = IV[iv];
    const l = (rootNote.l + deg - 1) % 7;
    const target = mod(T.notePc(rootNote) + semi);
    let a = target - LETTER_PC[l];
    if (a > 6) a -= 12;
    if (a < -6) a += 12;
    return { l, a };
  };

  function rootCandidates(pc) {
    const out = [T.parseNote(SHARP[pc])];
    if (FLAT[pc] !== SHARP[pc]) out.push(T.parseNote(FLAT[pc]));
    return out.map((n) => ({ l: n.l, a: n.a }));
  }

  /**
   * Choose the most readable enharmonic spelling for a root pitch class and an
   * interval structure (fewest accidentals, no double accidentals if possible).
   */
  T.spell = function (pc, intervals, pref = 'auto') {
    pc = mod(pc);
    let best = null;
    for (const r of rootCandidates(pc)) {
      const notes = intervals.map((iv) => T.spellInterval(r, iv));
      let cost = 0;
      for (const n of notes) cost += Math.abs(n.a) + (Math.abs(n.a) > 1 ? 8 : 0);
      if (pref === 'sharp' && r.a < 0) cost += 0.5;
      if (pref === 'flat' && r.a > 0) cost += 0.5;
      if (pref === 'auto' && r.a > 0) cost += pc === 6 ? -0.1 : 0.1; // ties: flats, except F#
      if (!best || cost < best.cost) best = { cost, root: r, notes };
    }
    return {
      root: best.root,
      rootName: T.noteName(best.root),
      notes: best.notes,
      names: best.notes.map(T.noteName),
    };
  };

  /** Pretty print: sharps/flats as unicode. Works for note names, chord names, intervals. */
  T.fmt = function (s) {
    if (s == null) return '';
    return String(s)
      .replace(/##/g, '♯♯')
      .replace(/#/g, '♯')
      .replace(/([A-G])bb/g, '$1♭♭')
      .replace(/([A-G])b/g, '$1♭')
      .replace(/(^|[^a-z])bb(?=\d)/g, '$1♭♭')
      .replace(/(^|[^a-z])b(?=\d)/g, '$1♭');
  };

  /* ---------- Chords ---------- */
  // [id, symbol(ascii), name, intervals, optional intervals, group, aliases]
  const CHORD_DATA = [
    ['maj', '', 'Major', '1 3 5', '', 'Triads', ['M', 'maj', 'major']],
    ['min', 'm', 'Minor', '1 b3 5', '', 'Triads', ['min', '-', 'minor', 'mi']],
    ['dim', 'dim', 'Diminished', '1 b3 b5', '', 'Triads', ['°', 'o', 'mb5']],
    ['aug', 'aug', 'Augmented', '1 3 #5', '', 'Triads', ['+', '#5', '+5']],
    ['sus2', 'sus2', 'Suspended 2nd', '1 2 5', '', 'Triads', []],
    ['sus4', 'sus4', 'Suspended 4th', '1 4 5', '', 'Triads', ['sus']],
    ['5', '5', 'Power chord', '1 5', '', 'Triads', []],
    ['6', '6', 'Major 6th', '1 3 5 6', '5', 'Sixths & adds', ['M6', 'maj6']],
    ['m6', 'm6', 'Minor 6th', '1 b3 5 6', '5', 'Sixths & adds', ['min6', '-6']],
    ['69', '6/9', 'Six-nine', '1 3 5 6 9', '5', 'Sixths & adds', ['69']],
    ['m69', 'm6/9', 'Minor six-nine', '1 b3 5 6 9', '5', 'Sixths & adds', ['m69']],
    ['add9', 'add9', 'Added 9th', '1 3 5 9', '', 'Sixths & adds', ['add2', '2']],
    ['madd9', 'm(add9)', 'Minor added 9th', '1 b3 5 9', '', 'Sixths & adds', ['madd9', 'madd2', 'm2']],
    ['add11', 'add11', 'Added 11th', '1 3 5 11', '', 'Sixths & adds', ['add4']],
    ['7', '7', 'Dominant 7th', '1 3 5 b7', '5', 'Sevenths', ['dom7', 'dom']],
    ['maj7', 'maj7', 'Major 7th', '1 3 5 7', '5', 'Sevenths', ['M7', 'Δ7', 'Δ', 'ma7', 'j7']],
    ['m7', 'm7', 'Minor 7th', '1 b3 5 b7', '5', 'Sevenths', ['min7', '-7', 'mi7']],
    ['m7b5', 'm7b5', 'Half-diminished', '1 b3 b5 b7', '', 'Sevenths', ['ø', 'ø7', 'min7b5', '-7b5']],
    ['dim7', 'dim7', 'Diminished 7th', '1 b3 b5 bb7', '', 'Sevenths', ['°7', 'o7']],
    ['mmaj7', 'm(maj7)', 'Minor-major 7th', '1 b3 5 7', '5', 'Sevenths', ['mM7', 'mmaj7', 'minmaj7', '-maj7', 'm/maj7']],
    ['7sus4', '7sus4', 'Dominant 7th sus4', '1 4 5 b7', '5', 'Sevenths', ['7sus']],
    ['7sus2', '7sus2', 'Dominant 7th sus2', '1 2 5 b7', '5', 'Sevenths', []],
    ['maj7sus2', 'maj7sus2', 'Major 7th sus2', '1 2 5 7', '5', 'Sevenths', []],
    ['9', '9', 'Dominant 9th', '1 3 5 b7 9', '5', 'Extended', ['dom9']],
    ['maj9', 'maj9', 'Major 9th', '1 3 5 7 9', '5', 'Extended', ['M9', 'Δ9']],
    ['m9', 'm9', 'Minor 9th', '1 b3 5 b7 9', '5', 'Extended', ['min9', '-9']],
    ['mmaj9', 'm(maj9)', 'Minor-major 9th', '1 b3 5 7 9', '5', 'Extended', ['mM9']],
    ['9sus4', '9sus4', 'Dominant 9th sus4', '1 4 5 b7 9', '5', 'Extended', ['9sus']],
    ['11', '11', 'Dominant 11th', '1 3 5 b7 9 11', '3 5 9', 'Extended', []],
    ['m11', 'm11', 'Minor 11th', '1 b3 5 b7 9 11', '5 9', 'Extended', ['min11', '-11']],
    ['maj11', 'maj11', 'Major 11th', '1 3 5 7 9 11', '5 9', 'Extended', ['M11']],
    ['13', '13', 'Dominant 13th', '1 3 5 b7 9 13', '5 9', 'Extended', []],
    ['maj13', 'maj13', 'Major 13th', '1 3 5 7 9 13', '5 9', 'Extended', ['M13']],
    ['m13', 'm13', 'Minor 13th', '1 b3 5 b7 9 11 13', '5 9 11', 'Extended', ['min13', '-13']],
    ['7b5', '7b5', 'Dominant 7th ♭5', '1 3 b5 b7', '', 'Altered', []],
    ['aug7', '7#5', 'Augmented 7th', '1 3 #5 b7', '', 'Altered', ['+7', 'aug7', '7+']],
    ['maj7#5', 'maj7#5', 'Augmented major 7th', '1 3 #5 7', '', 'Altered', ['+M7', 'maj7+']],
    ['7b9', '7b9', 'Dominant 7th ♭9', '1 3 5 b7 b9', '5', 'Altered', []],
    ['7#9', '7#9', 'Dominant 7th ♯9', '1 3 5 b7 #9', '5', 'Altered', []],
    ['7#11', '7#11', 'Dominant 7th ♯11', '1 3 5 b7 #11', '5', 'Altered', []],
    ['maj7#11', 'maj7#11', 'Major 7th ♯11', '1 3 5 7 #11', '5', 'Altered', ['M7#11']],
    ['7b13', '7b13', 'Dominant 7th ♭13', '1 3 5 b7 b13', '5', 'Altered', []],
    ['13b9', '13b9', 'Dominant 13th ♭9', '1 3 5 b7 b9 13', '5', 'Altered', []],
    ['m9b5', 'm9b5', 'Half-diminished 9th', '1 b3 b5 b7 9', '', 'Altered', ['ø9']],
  ];

  T.CHORDS = CHORD_DATA.map(([id, sym, name, ivs, opt, group, aliases], order) => {
    const intervals = ivs.split(' ');
    const optional = opt ? opt.split(' ') : [];
    const pcs = intervals.map((iv) => IV[iv][0] % 12);
    const req = intervals.filter((iv) => !optional.includes(iv)).map((iv) => IV[iv][0] % 12);
    return { id, sym, name, intervals, optional, pcs, req, group, aliases, order };
  });
  T.CHORD_BY_ID = Object.fromEntries(T.CHORDS.map((c) => [c.id, c]));
  T.CHORD_GROUPS = [...new Set(T.CHORDS.map((c) => c.group))];

  /** Spelled chord: { rootName, names[], intervals[], symbol } */
  T.chord = function (rootPc, typeId, pref) {
    const type = T.CHORD_BY_ID[typeId];
    const sp = T.spell(rootPc, type.intervals, pref);
    return {
      rootPc: mod(rootPc),
      type,
      rootName: sp.rootName,
      names: sp.names,
      pcs: type.pcs.map((p) => mod(p + rootPc)),
      intervals: type.intervals,
      symbol: sp.rootName + type.sym,
    };
  };

  /** Parse a chord symbol like "F#m7b5/E" -> { rootPc, typeId, bassPc, rootName } */
  T.parseChord = function (str) {
    if (!str) return null;
    const s = String(str).trim();
    const root = T.parseNote(s);
    if (!root) return null;
    let rest = s.slice(root.len);
    let bass = null;
    const slash = rest.match(/\/([A-G](?:##|bb|#|b|♯|♭)?)$/);
    if (slash) {
      bass = T.parseNote(slash[1]);
      rest = rest.slice(0, rest.length - slash[0].length);
    }
    const norm = rest.replace(/♯/g, '#').replace(/♭/g, 'b').replace(/\s+/g, '');
    let type = null;
    for (const c of T.CHORDS) {
      if (c.sym === norm || c.id === norm || c.aliases.includes(norm)) { type = c; break; }
    }
    if (!type) {
      const lower = norm.toLowerCase();
      type = T.CHORDS.find((c) => c.sym.toLowerCase() === lower && c.sym !== 'M') || null;
      if (!type && (lower === 'maj' || lower === 'major')) type = T.CHORD_BY_ID.maj;
    }
    if (!type) return null;
    return {
      rootPc: T.notePc(root),
      rootName: T.noteName(root),
      typeId: type.id,
      bassPc: bass ? T.notePc(bass) : null,
      bassName: bass ? T.noteName(bass) : null,
    };
  };

  /**
   * Identify chords from a set of pitch classes.
   * Returns ranked [{ rootPc, typeId, bassPc, symbol, missing:[iv], exact, score, incomplete }]
   */
  T.identifyChord = function (pcsIn, bassPc, pref) {
    const pcs = [...new Set(pcsIn.map((p) => mod(p)))];
    if (pcs.length < 2) return [];
    const results = [];
    for (const r of pcs) {
      const rel = new Set(pcs.map((p) => mod(p - r)));
      for (const type of T.CHORDS) {
        const all = new Set(type.pcs);
        let fits = true;
        for (const x of rel) if (!all.has(x)) { fits = false; break; }
        if (!fits) continue;
        const missingReq = type.req.filter((p) => !rel.has(p));
        if (missingReq.length > 1 || (missingReq.length === 1 && rel.size < 3)) continue;
        if (missingReq.length && type.intervals.length < 3) continue;
        const missing = type.intervals.filter((iv) => !rel.has(IV[iv][0] % 12));
        const incomplete = missingReq.length > 0;
        if (incomplete && missingReq.includes(0)) continue;
        let score = 100;
        score -= missing.length * 7;
        if (incomplete) score -= 30;
        score -= type.order * 0.35;
        if (bassPc != null && mod(bassPc) !== r) score -= 18;
        const sp = T.spell(r, type.intervals, pref);
        let symbol = sp.rootName + type.sym;
        if (bassPc != null && mod(bassPc) !== r) {
          const idx = type.pcs.findIndex((p) => mod(p + r) === mod(bassPc));
          symbol += '/' + (idx >= 0 ? sp.names[idx] : T.pcName(bassPc, pref));
        }
        results.push({
          rootPc: r, typeId: type.id, bassPc: bassPc == null ? r : mod(bassPc), symbol,
          missing, incomplete, exact: missing.length === 0, score,
        });
      }
    }
    results.sort((a, b) => b.score - a.score);
    const seen = new Set();
    return results.filter((r) => (seen.has(r.symbol) ? false : seen.add(r.symbol)));
  };

  /* ---------- Scales ---------- */
  // [id, name, intervals, family, rank(lower = more common), aka]
  const SCALE_DATA = [
    ['major', 'Major (Ionian)', '1 2 3 4 5 6 7', 'Diatonic modes', 1, 'Ionian'],
    ['minor', 'Natural Minor (Aeolian)', '1 2 b3 4 5 b6 b7', 'Diatonic modes', 1, 'Aeolian'],
    ['dorian', 'Dorian', '1 2 b3 4 5 6 b7', 'Diatonic modes', 2],
    ['phrygian', 'Phrygian', '1 b2 b3 4 5 b6 b7', 'Diatonic modes', 3],
    ['lydian', 'Lydian', '1 2 3 #4 5 6 7', 'Diatonic modes', 3],
    ['mixolydian', 'Mixolydian', '1 2 3 4 5 6 b7', 'Diatonic modes', 2],
    ['locrian', 'Locrian', '1 b2 b3 4 b5 b6 b7', 'Diatonic modes', 4],
    ['majpent', 'Major Pentatonic', '1 2 3 5 6', 'Pentatonic & blues', 1],
    ['minpent', 'Minor Pentatonic', '1 b3 4 5 b7', 'Pentatonic & blues', 1],
    ['blues', 'Blues', '1 b3 4 b5 5 b7', 'Pentatonic & blues', 1, 'Minor blues'],
    ['majblues', 'Major Blues', '1 2 b3 3 5 6', 'Pentatonic & blues', 2],
    ['egyptian', 'Egyptian (Suspended Pentatonic)', '1 2 4 5 b7', 'Pentatonic & blues', 5],
    ['harmminor', 'Harmonic Minor', '1 2 b3 4 5 b6 7', 'Harmonic minor', 2],
    ['locrian6', 'Locrian ♮6', '1 b2 b3 4 b5 6 b7', 'Harmonic minor', 6],
    ['ionian5', 'Ionian ♯5', '1 2 3 4 #5 6 7', 'Harmonic minor', 6],
    ['dorian4', 'Dorian ♯4', '1 2 b3 #4 5 6 b7', 'Harmonic minor', 6, 'Ukrainian Dorian'],
    ['phrygdom', 'Phrygian Dominant', '1 b2 3 4 5 b6 b7', 'Harmonic minor', 3, 'Spanish Phrygian'],
    ['lydian2', 'Lydian ♯2', '1 #2 3 #4 5 6 7', 'Harmonic minor', 6],
    ['ultraloc', 'Ultralocrian', '1 b2 b3 b4 b5 b6 bb7', 'Harmonic minor', 7],
    ['melminor', 'Melodic Minor', '1 2 b3 4 5 6 7', 'Melodic minor', 2, 'Jazz minor'],
    ['dorianb2', 'Dorian ♭2', '1 b2 b3 4 5 6 b7', 'Melodic minor', 6, 'Phrygian ♮6'],
    ['lydaug', 'Lydian Augmented', '1 2 3 #4 #5 6 7', 'Melodic minor', 5],
    ['lyddom', 'Lydian Dominant', '1 2 3 #4 5 6 b7', 'Melodic minor', 4, 'Overtone'],
    ['mixb6', 'Mixolydian ♭6', '1 2 3 4 5 b6 b7', 'Melodic minor', 5, 'Aeolian dominant'],
    ['locrian2', 'Locrian ♮2', '1 2 b3 4 b5 b6 b7', 'Melodic minor', 5, 'Half-diminished'],
    ['altered', 'Altered (Super Locrian)', '1 b2 b3 b4 b5 b6 b7', 'Melodic minor', 4],
    ['wholetone', 'Whole Tone', '1 2 3 #4 #5 b7', 'Symmetric', 4],
    ['dimhw', 'Diminished (Half–Whole)', '1 b2 b3 3 #4 5 6 b7', 'Symmetric', 4, 'Dominant diminished'],
    ['dimwh', 'Diminished (Whole–Half)', '1 2 b3 4 b5 b6 6 7', 'Symmetric', 4],
    ['augmented', 'Augmented', '1 #2 3 5 #5 7', 'Symmetric', 7],
    ['chromatic', 'Chromatic', '1 b2 2 b3 3 4 #4 5 b6 6 b7 7', 'Symmetric', 9],
    ['bebopdom', 'Bebop Dominant', '1 2 3 4 5 6 b7 7', 'Bebop', 5],
    ['bebopmaj', 'Bebop Major', '1 2 3 4 5 #5 6 7', 'Bebop', 6],
    ['bebopmin', 'Bebop Minor (Dorian)', '1 2 b3 3 4 5 6 b7', 'Bebop', 6],
    ['hungminor', 'Hungarian Minor', '1 2 b3 #4 5 b6 7', 'World & exotic', 6, 'Gypsy minor'],
    ['hungmajor', 'Hungarian Major', '1 #2 3 #4 5 6 b7', 'World & exotic', 7],
    ['dblharm', 'Double Harmonic Major', '1 b2 3 4 5 b6 7', 'World & exotic', 6, 'Byzantine, Arabic'],
    ['neapmaj', 'Neapolitan Major', '1 b2 b3 4 5 6 7', 'World & exotic', 7],
    ['neapmin', 'Neapolitan Minor', '1 b2 b3 4 5 b6 7', 'World & exotic', 7],
    ['persian', 'Persian', '1 b2 3 4 b5 b6 7', 'World & exotic', 8],
    ['hirajoshi', 'Hirajoshi', '1 2 b3 5 b6', 'World & exotic', 6],
    ['insen', 'In Sen', '1 b2 4 5 b7', 'World & exotic', 6],
    ['iwato', 'Iwato', '1 b2 4 b5 b7', 'World & exotic', 8],
    ['pelog', 'Pelog (approx.)', '1 b2 b3 5 b6', 'World & exotic', 8],
  ];
  T.SCALES = SCALE_DATA.map(([id, name, ivs, family, rank, aka], order) => {
    const intervals = ivs.split(' ');
    return { id, name, intervals, pcs: intervals.map((iv) => IV[iv][0] % 12), family, rank, aka: aka || '', order };
  });
  T.SCALE_BY_ID = Object.fromEntries(T.SCALES.map((s) => [s.id, s]));
  T.SCALE_FAMILIES = [...new Set(T.SCALES.map((s) => s.family))];

  T.scale = function (rootPc, typeId, pref) {
    const type = T.SCALE_BY_ID[typeId];
    const sp = T.spell(rootPc, type.intervals, pref);
    return {
      rootPc: mod(rootPc), type, rootName: sp.rootName, names: sp.names, notes: sp.notes,
      pcs: type.pcs.map((p) => mod(p + rootPc)), intervals: type.intervals,
    };
  };

  /** Find scales containing all given pitch classes. */
  T.identifyScales = function (pcsIn, opts = {}) {
    const pcs = [...new Set(pcsIn.map((p) => mod(p)))];
    if (!pcs.length) return [];
    const out = [];
    const roots = opts.rootPc != null ? [mod(opts.rootPc)] : [...Array(12).keys()];
    for (const r of roots) {
      for (const type of T.SCALES) {
        if (type.id === 'chromatic' && pcs.length < 9) continue;
        const set = new Set(type.pcs.map((p) => mod(p + r)));
        if (!pcs.every((p) => set.has(p))) continue;
        const extra = set.size - pcs.length;
        let score = 100 - extra * 6 - type.rank * 2.5;
        if (!pcs.includes(r)) score -= 12;
        if (opts.firstIsRoot && pcs[0] === r) score += 8;
        out.push({ rootPc: r, typeId: type.id, extra, exact: extra === 0, score });
      }
    }
    out.sort((a, b) => b.score - a.score);
    return out;
  };

  /* ---------- Harmony ---------- */
  const TRIAD_IDS = ['maj', 'min', 'dim', 'aug', 'sus4', 'sus2'];
  const SEVENTH_IDS = ['7', 'maj7', 'm7', 'm7b5', 'dim7', 'mmaj7', 'aug7', 'maj7#5', '7b5', '7sus4', 'maj7sus2'];
  const MAJOR_SEMIS = [0, 2, 4, 5, 7, 9, 11];
  const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];

  function matchType(relPcs, ids) {
    const key = [...relPcs].sort((a, b) => a - b).join(',');
    for (const id of ids) {
      const t = T.CHORD_BY_ID[id];
      if ([...t.pcs].sort((a, b) => a - b).join(',') === key) return t;
    }
    return null;
  }

  T.romanFor = function (degreeIndex, degreeSemis, typeId) {
    const diff = degreeSemis - MAJOR_SEMIS[degreeIndex];
    const acc = diff === -1 ? '♭' : diff === 1 ? '♯' : diff === -2 ? '♭♭' : diff === 2 ? '♯♯' : '';
    const t = T.CHORD_BY_ID[typeId];
    const minorish = t && t.pcs.includes(3) && !t.pcs.includes(4);
    let num = ROMAN[degreeIndex];
    if (minorish) num = num.toLowerCase();
    const suffix = {
      maj: '', min: '', dim: '°', aug: '+', sus4: 'sus4', sus2: 'sus2',
      '7': '7', maj7: 'maj7', m7: '7', m7b5: 'ø7', dim7: '°7', mmaj7: '(maj7)', aug7: '+7',
      'maj7#5': '+maj7', '7b5': '7♭5', '7sus4': '7sus4', maj7sus2: 'maj7sus2',
    }[typeId];
    return acc + num + (suffix != null ? suffix : t ? T.fmt(t.sym) : '');
  };

  /** Diatonic triads & sevenths for a heptatonic scale. */
  T.harmonize = function (rootPc, scaleId, pref) {
    const sc = T.scale(rootPc, scaleId, pref);
    const n = sc.pcs.length;
    if (n !== 7) return null;
    const semis = sc.type.pcs;
    const rows = [];
    for (let i = 0; i < 7; i++) {
      const deg = (k) => semis[(i + k) % 7];
      const rel = (k) => mod(deg(k) - deg(0));
      const triad = matchType([0, rel(2), rel(4)], TRIAD_IDS);
      const seventh = matchType([0, rel(2), rel(4), rel(6)], SEVENTH_IDS);
      const rPc = mod(rootPc + semis[i]);
      const rName = sc.names[i];
      rows.push({
        degree: i + 1,
        rootPc: rPc,
        rootName: rName,
        triad: triad && { typeId: triad.id, symbol: rName + triad.sym, roman: T.romanFor(i, semis[i], triad.id) },
        seventh: seventh && { typeId: seventh.id, symbol: rName + seventh.sym, roman: T.romanFor(i, semis[i], seventh.id) },
      });
    }
    return { scale: sc, rows };
  };

  /** Every chord type (from the library) that fits inside the scale, per scale note. */
  T.chordsInScale = function (rootPc, scaleId, pref) {
    const sc = T.scale(rootPc, scaleId, pref);
    const set = new Set(sc.pcs);
    return sc.pcs.map((p, i) => {
      const fits = T.CHORDS.filter((c) => c.pcs.every((x) => set.has(mod(x + p))));
      return { rootPc: p, rootName: sc.names[i], interval: sc.intervals[i], chords: fits };
    });
  };

  /** Scales that contain every note of the chord. */
  T.scalesForChord = function (rootPc, typeId) {
    const ch = T.CHORD_BY_ID[typeId];
    const pcs = ch.pcs.map((p) => mod(p + rootPc));
    const out = [];
    for (let r = 0; r < 12; r++) {
      for (const s of T.SCALES) {
        if (s.id === 'chromatic') continue;
        const set = new Set(s.pcs.map((p) => mod(p + r)));
        if (!pcs.every((p) => set.has(p))) continue;
        const sameRoot = r === mod(rootPc);
        out.push({ rootPc: r, typeId: s.id, sameRoot, score: (sameRoot ? 50 : 0) - s.rank * 3 - (set.size - pcs.length) });
      }
    }
    out.sort((a, b) => b.score - a.score);
    return out;
  };

  /* ---------- Keys & circle of fifths ---------- */
  T.CIRCLE = [0, 7, 2, 9, 4, 11, 6, 1, 8, 3, 10, 5];
  // Conventional key spelling around the circle (index = position)
  T.CIRCLE_MAJOR = ['C', 'G', 'D', 'A', 'E', 'B', 'F#', 'Db', 'Ab', 'Eb', 'Bb', 'F'];
  T.CIRCLE_MAJOR_ALT = [null, null, null, null, null, 'Cb', 'Gb', 'C#', null, null, null, null];
  T.CIRCLE_MINOR = ['A', 'E', 'B', 'F#', 'C#', 'G#', 'D#', 'Bb', 'F', 'C', 'G', 'D'];
  T.CIRCLE_MINOR_ALT = [null, null, null, null, null, 'Ab', 'Eb', 'A#', null, null, null, null];

  /** Key signature of a major key spelled with rootName. Returns { sharps, flats, notes[] } */
  T.keySignature = function (rootName, scaleId = 'major') {
    const r = T.parseNote(rootName);
    const notes = T.SCALE_BY_ID[scaleId].intervals.map((iv) => T.spellInterval(r, iv));
    let sharps = 0, flats = 0;
    for (const n of notes) { if (n.a > 0) sharps += n.a; if (n.a < 0) flats -= n.a; }
    return { sharps, flats, names: notes.map(T.noteName) };
  };

  /* ---------- Transposition ---------- */
  T.transposeSymbol = function (sym, semis, pref = 'auto') {
    const p = T.parseChord(sym);
    if (!p) return null;
    const type = T.CHORD_BY_ID[p.typeId];
    const sp = T.spell(p.rootPc + semis, type.intervals, pref);
    let out = sp.rootName + type.sym;
    if (p.bassPc != null) {
      const bpc = mod(p.bassPc + semis);
      const idx = type.pcs.findIndex((x) => mod(x + p.rootPc + semis) === bpc);
      out += '/' + (idx >= 0 ? sp.names[idx] : T.pcName(bpc, pref === 'sharp' ? 'sharp' : 'flat'));
    }
    return out;
  };

  /* ---------- Tunings ---------- */
  // MIDI numbers, low string to high string
  T.TUNINGS = [
    { id: 'standard', name: 'Standard', notes: [40, 45, 50, 55, 59, 64] },
    { id: 'dropd', name: 'Drop D', notes: [38, 45, 50, 55, 59, 64] },
    { id: 'halfdown', name: 'Half step down', notes: [39, 44, 49, 54, 58, 63] },
    { id: 'wholedown', name: 'Whole step down', notes: [38, 43, 48, 53, 57, 62] },
    { id: 'dropc', name: 'Drop C', notes: [36, 43, 48, 53, 57, 62] },
    { id: 'dadgad', name: 'DADGAD', notes: [38, 45, 50, 55, 57, 62] },
    { id: 'openg', name: 'Open G', notes: [38, 43, 50, 55, 59, 62] },
    { id: 'opend', name: 'Open D', notes: [38, 45, 50, 54, 57, 62] },
    { id: 'opene', name: 'Open E', notes: [40, 47, 52, 56, 59, 64] },
    { id: 'openc', name: 'Open C', notes: [36, 43, 48, 55, 60, 64] },
    { id: 'opena', name: 'Open A', notes: [40, 45, 52, 57, 61, 64] },
    { id: 'seven', name: '7-string (B standard)', notes: [35, 40, 45, 50, 55, 59, 64] },
    { id: 'uke', name: 'Ukulele (GCEA)', notes: [67, 60, 64, 69] },
    { id: 'bass', name: 'Bass (EADG)', notes: [28, 33, 38, 43] },
  ];
  T.TUNING_BY_ID = Object.fromEntries(T.TUNINGS.map((t) => [t.id, t]));
  T.midiName = (m, pref) => T.pcName(m, pref) + (Math.floor(m / 12) - 1);
  T.midiFreq = (m) => 440 * Math.pow(2, (m - 69) / 12);

  if (typeof module !== 'undefined' && module.exports) module.exports = T;
})(typeof window !== 'undefined' ? window : globalThis);
