(function () {
  'use strict';
  const GA = window.GA, T = GA.Theory, U = GA.UI, R = GA.Render, V = GA.Voicings;
  const h = U.h;

  const EASY = new Set(['C', 'A', 'G', 'E', 'D', 'Am', 'Em', 'Dm', 'E7', 'A7', 'D7', 'G7', 'C7', 'B7', 'Cmaj7', 'Fmaj7', 'Amaj7', 'Dmaj7', 'Gmaj7', 'Am7', 'Em7', 'Dm7', 'Asus2', 'Asus4', 'Dsus2', 'Dsus4', 'Esus4', 'Cadd9', 'Gadd9', 'A6', 'E5', 'A5', 'D5', 'G6', 'C6', 'Em9', 'Am9']);
  const OK = new Set(['F', 'Bm', 'Fmaj7', 'Bm7', 'F#m', 'Bb', 'Bdim', 'Em6']);
  const SAMPLE = `[Verse]
G        D         Em      C
Walking down the old road home
G        D            C
Fingers on the rosewood board

[Chorus]
Am7      D7/F#     G     G/B
Every chord a little story
C        Cm        G
Every scale a place to go`;

  const CHORD_TOKEN = /^[A-G](?:#|b|♯|♭)?[^\s/]*(?:\/[A-G](?:#|b|♯|♭)?)?$/;
  const isChord = (tok) => CHORD_TOKEN.test(tok) && !!T.parseChord(tok);

  /** Split text into lines; chord lines get transposed token by token, bracketed [C] chords anywhere. */
  function transposeText(text, semis, pref) {
    return text.split('\n').map((line) => {
      const bracket = /\[([^\]]+)\]/g;
      if (bracket.test(line) && !/^\s*\[[A-Za-z ]+\]\s*$/.test(line.replace(/\[([A-G][^\]]*)\]/g, ''))) {
        return { type: 'mixed', parts: splitBrackets(line, semis, pref) };
      }
      const toks = line.split(/(\s+)/);
      const words = toks.filter((t) => t.trim());
      const chordLine = words.length > 0 && words.every((w) => isChord(w) || /^[|\-–x0-9%.()]+$/.test(w));
      if (!chordLine) return { type: 'text', text: line };
      // keep columns aligned: pad/trim whitespace after changed chords
      let carry = 0;
      const parts = toks.map((t) => {
        if (!t.trim()) {
          let w = t.length - carry;
          carry = 0;
          if (w < 1) { carry = 1 - w; w = 1; }
          return { text: ' '.repeat(w) };
        }
        if (!isChord(t)) return { text: t };
        const out = T.transposeSymbol(t.replace(/♯/g, '#').replace(/♭/g, 'b'), semis, pref) || t;
        carry += out.length - t.length;
        return { text: out, chord: true, orig: t };
      });
      return { type: 'chords', parts };
    });
  }
  function splitBrackets(line, semis, pref) {
    const parts = [];
    let last = 0;
    line.replace(/\[([^\]]+)\]/g, (m, inner, idx) => {
      if (idx > last) parts.push({ text: line.slice(last, idx) });
      const tr = isChord(inner) ? T.transposeSymbol(inner, semis, pref) : null;
      parts.push(tr ? { text: '[' + tr + ']', chord: true, bracket: true } : { text: m });
      last = idx + m.length;
      return m;
    });
    if (last < line.length) parts.push({ text: line.slice(last) });
    return parts;
  }

  function chordsIn(text) {
    const set = [];
    for (const line of transposeText(text, 0, 'auto')) {
      if (!line.parts) continue;
      for (const p of line.parts) if (p.chord) {
        const sym = p.text.replace(/[[\]]/g, '');
        if (!set.includes(sym)) set.push(sym);
      }
    }
    return set;
  }

  function guessKey(chords) {
    let best = null;
    for (let r = 0; r < 12; r++) {
      for (const sid of ['major', 'minor']) {
        const hm = T.harmonize(r, sid);
        let score = 0;
        chords.forEach((c, i) => {
          const p = T.parseChord(c);
          if (!p) return;
          const row = hm.rows.find((x) => x.rootPc === p.rootPc);
          if (!row) return;
          const tri = T.CHORD_BY_ID[row.triad.typeId], ty = T.CHORD_BY_ID[p.typeId];
          const sameQuality = (tri.pcs.includes(3) === ty.pcs.includes(3)) && (tri.pcs.includes(6) === ty.pcs.includes(6));
          if (sameQuality) score += 1 + (i === 0 && row.degree === 1 ? 0.6 : 0) + (row.degree === 1 ? 0.3 : 0);
        });
        if (sid === 'minor') score -= 0.2;
        if (!best || score > best.score) best = { r, sid, score, name: hm.scale.rootName };
      }
    }
    return best;
  }

  GA.views.push({
    id: 'transpose',
    num: '12',
    group: 'Play',
    title: 'Transposer & Capo',
    blurb: 'Paste a chord sheet, shift it to any key, and find the capo position with the easiest shapes.',
    keywords: 'transpose key change capo chord sheet lyrics song',
    render(el, p, ctx) {
      const text = U.storage.get('sheet', SAMPLE);
      const semis = p.t != null ? +p.t : 0;
      const pref = p.acc === 'sharp' ? 'sharp' : p.acc === 'flat' ? 'flat' : 'auto';
      const lines = transposeText(text, semis, pref);
      const chords = chordsIn(text);
      const shifted = chords.map((c) => T.transposeSymbol(c, semis, pref)).filter(Boolean);
      const key0 = chords.length ? guessKey(chords) : null;
      const key1 = shifted.length ? guessKey(shifted) : null;
      const tuning = GA.settings.tuning().notes;

      // capo table for the transposed chords
      const capos = [];
      for (let c = 0; c <= 9; c++) {
        const shapes = shifted.map((x) => T.transposeSymbol(x, -c, 'sharp')).map((x) => x && x.replace(/\/.*/, ''));
        const shapesNice = shifted.map((x) => {
          const a = T.transposeSymbol(x, -c, 'sharp'), b = T.transposeSymbol(x, -c, 'flat');
          const core = (s) => s && s.replace(/\/.*/, '');
          return EASY.has(core(a)) || OK.has(core(a)) ? a : EASY.has(core(b)) || OK.has(core(b)) ? b : a;
        });
        const easy = shapes.filter((s, i) => EASY.has(s) || EASY.has(T.transposeSymbol(shifted[i], -c, 'flat').replace(/\/.*/, ''))).length;
        const ok = shapes.filter((s) => OK.has(s)).length;
        capos.push({ c, shapes: shapesNice, score: easy + ok * 0.4 - c * 0.03, easy, ok });
      }
      const bestCapo = capos.slice().sort((a, b) => b.score - a.score)[0];

      const editor = h('textarea', { class: 'sheet-in mono', spellcheck: 'false', 'data-fk': 'sheet', rows: 14,
        oninput: (e) => { U.storage.set('sheet', e.target.value); clearTimeout(editor._t); editor._t = setTimeout(() => GA.rerender(), 400); } }, text);
      editor.value = text;

      U.mount(el, 
        U.pageHead(this),
        h('div', { class: 'tp-bar' },
          h('div', { class: 'field' }, h('div', { class: 'label' }, 'Transpose'),
            h('div', { class: 'stepper' },
              h('button', { type: 'button', class: 'iconbtn', 'aria-label': 'Down a semitone', 'data-fk': 'tdown', onclick: () => ctx.update({ t: semis - 1 <= -12 ? 0 : semis - 1 }) }, '−'),
              h('span', { class: 'stepper-v mono' }, (semis > 0 ? '+' : '') + semis),
              h('button', { type: 'button', class: 'iconbtn', 'aria-label': 'Up a semitone', 'data-fk': 'tup', onclick: () => ctx.update({ t: semis + 1 >= 12 ? 0 : semis + 1 }) }, '+'))),
          U.seg({ label: 'Spelling', value: pref, fk: 'acc', options: [{ value: 'auto', label: 'Auto' }, { value: 'sharp', label: '♯' }, { value: 'flat', label: '♭' }], onChange: (v) => ctx.update({ acc: v === 'auto' ? null : v }) }),
          key0 ? h('div', { class: 'tp-key' }, h('span', { class: 'label' }, 'Key'), h('b', null, T.fmt(key0.name) + (key0.sid === 'minor' ? 'm' : '')), semis ? [' → ', h('b', { class: 'accent' }, T.fmt(key1.name) + (key1.sid === 'minor' ? 'm' : ''))] : null) : null,
          U.button('Reset', () => ctx.update({ t: null }), { kind: 'ghost' })),
        h('div', { class: 'tp-grid' },
          h('div', null, h('div', { class: 'label' }, 'Your chord sheet (chord lines above lyrics, or inline [C] brackets)'), editor,
            h('div', { class: 'controls-row' }, U.button('Load example', () => { U.storage.set('sheet', SAMPLE); GA.rerender(); }, { kind: 'ghost' }), U.button('Clear', () => { U.storage.set('sheet', ''); GA.rerender(); }, { kind: 'ghost' }))),
          h('div', null, h('div', { class: 'label' }, semis ? 'Transposed ' + (semis > 0 ? 'up ' : 'down ') + Math.abs(semis) + ' semitone' + (Math.abs(semis) > 1 ? 's' : '') : 'Preview'),
            h('pre', { class: 'sheet-out mono' }, lines.map((ln) => h('div', { class: 'sl sl-' + ln.type }, ln.parts ? ln.parts.map((pt) => (pt.chord ? h('a', { class: 'sc', href: chordHref(pt.text) }, T.fmt(pt.text)) : pt.text)) : (ln.text || ' ')))))),
        shifted.length ? U.section('Capo helper', [
          h('p', { class: 'note' }, 'Same sound, different shapes. Capo positions ranked by how many chords become easy open shapes.' + (bestCapo.c ? ' Best: capo ' + bestCapo.c + '.' : '')),
          h('div', { class: 'capotable' }, capos.map((cp) => h('div', { class: ['caporow', cp === bestCapo ? 'best' : ''] },
            h('span', { class: 'capo-n' }, cp.c ? 'Capo ' + cp.c : 'No capo'),
            h('span', { class: 'capo-shapes' }, cp.shapes.map((s) => h('span', { class: EASY.has((s || '').replace(/\/.*/, '')) ? 'easy' : OK.has((s || '').replace(/\/.*/, '')) ? 'ok' : 'hard' }, T.fmt(s)))),
            h('span', { class: 'capo-score mono' }, cp.easy + '/' + shifted.length + ' easy')))),
        ]) : null,
        shifted.length ? U.section('Chords used', h('div', { class: 'cardrow' }, shifted.slice(0, 16).map((sym) => {
          const pc = T.parseChord(sym);
          if (!pc) return null;
          const v = V.best(pc.rootPc, pc.typeId, tuning, pc.bassPc != null && pc.bassPc !== pc.rootPc ? { bassPc: pc.bassPc } : {}) || V.best(pc.rootPc, pc.typeId, tuning);
          const ch = T.chord(pc.rootPc, pc.typeId, U.pref());
          return R.chordCard({ rootPc: pc.rootPc, typeId: pc.typeId, voicing: v, compact: true, title: h('a', { href: chordHref(sym), class: 'ccard-name' }, U.chordName(sym.slice(0, pc.rootName.length), sym.slice(pc.rootName.length))), names: new Map(ch.pcs.map((x, i) => [x, ch.names[i]])) });
        }))) : null,
      );
    },
  });

  function chordHref(sym) {
    const p = T.parseChord(sym.replace(/[[\]]/g, ''));
    if (!p) return '#/chords';
    return GA.href('chords', { root: p.rootPc, type: p.typeId, bass: p.bassPc != null && p.bassPc !== p.rootPc ? p.bassPc : null });
  }
})();
