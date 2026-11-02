(function () {
  'use strict';
  const GA = window.GA, T = GA.Theory, U = GA.UI, R = GA.Render, V = GA.Voicings, A = GA.Audio;
  const h = U.h, s = U.s;

  function arcPath(cx, cy, r1, r2, a1, a2) {
    const p = (r, a) => [cx + r * Math.sin(a), cy - r * Math.cos(a)];
    const [x1, y1] = p(r2, a1), [x2, y2] = p(r2, a2), [x3, y3] = p(r1, a2), [x4, y4] = p(r1, a1);
    return `M${x1} ${y1} A${r2} ${r2} 0 0 1 ${x2} ${y2} L${x3} ${y3} A${r1} ${r1} 0 0 0 ${x4} ${y4} Z`;
  }

  GA.views.push({
    id: 'circle',
    num: '07',
    group: 'Connect',
    title: 'Circle of Fifths',
    short: 'Keys and how they relate.',
    blurb: 'Keys, signatures, relative minors and the chords of each key — click around the wheel.',
    keywords: 'circle of fifths fourths key signature relative minor',
    sections: [
      { id: 'wheel', title: 'Wheel & key' },
      { id: 'chords', title: 'Chords of the key' },
      { id: 'related', title: 'Related keys' },
    ],
    render(el, p, ctx) {
      const pos = p.k != null ? T.mod(+p.k) : 0;
      const minor = p.q === 'm';
      const tuning = GA.settings.tuning().notes;
      const majName = T.CIRCLE_MAJOR[pos];
      const minName = T.CIRCLE_MINOR[pos];
      const majPc = T.CIRCLE[pos];
      const minPc = T.mod(majPc + 9);
      const sig = T.keySignature(majName);
      const tonicPc = minor ? minPc : majPc;
      const tonicName = minor ? minName : majName;
      const scaleId = minor ? 'minor' : 'major';
      const harm = T.harmonize(tonicPc, scaleId);
      // respell chords with the key's own spelling
      const keyNames = T.keySignature(tonicName, scaleId).names;

      const cx = 260, cy = 260;
      const step = (Math.PI * 2) / 12;
      const kids = [];
      // relationship highlights: tonic, IV (pos-1), V (pos+1)
      const rel = new Map([[pos, 'k-tonic'], [T.mod(pos + 1), 'k-near'], [T.mod(pos - 1), 'k-near']]);
      for (let i = 0; i < 12; i++) {
        const a1 = (i - 0.5) * step, a2 = (i + 0.5) * step;
        const cls = rel.get(i) || '';
        const isSelMaj = i === pos && !minor, isSelMin = i === pos && minor;
        const go = (q) => () => ctx.update({ k: i, q: q ? 'm' : null });
        kids.push(s('path', { class: ['cf-seg cf-maj', cls, isSelMaj ? 'sel' : ''].join(' '), d: arcPath(cx, cy, 168, 248, a1, a2), onclick: go(false), tabindex: 0, role: 'button', 'aria-label': T.fmt(T.CIRCLE_MAJOR[i]) + ' major' }));
        kids.push(s('path', { class: ['cf-seg cf-min', cls, isSelMin ? 'sel' : ''].join(' '), d: arcPath(cx, cy, 104, 168, a1, a2), onclick: go(true), tabindex: 0, role: 'button', 'aria-label': T.fmt(T.CIRCLE_MINOR[i]) + ' minor' }));
        kids.push(s('path', { class: ['cf-seg cf-dim', cls].join(' '), d: arcPath(cx, cy, 70, 104, a1, a2) }));
        const ang = i * step;
        const lp = (r) => [cx + r * Math.sin(ang), cy - r * Math.cos(ang)];
        const [mx, my] = lp(212);
        kids.push(s('text', { class: 'cf-t cf-t-maj', x: mx, y: my + 8, 'text-anchor': 'middle' }, T.fmt(T.CIRCLE_MAJOR[i])));
        if (T.CIRCLE_MAJOR_ALT[i]) kids.push(s('text', { class: 'cf-t cf-t-alt', x: mx, y: my + 24, 'text-anchor': 'middle' }, T.fmt(T.CIRCLE_MAJOR_ALT[i])));
        const [nx, ny] = lp(137);
        kids.push(s('text', { class: 'cf-t cf-t-min', x: nx, y: ny + 6, 'text-anchor': 'middle' }, T.fmt(T.CIRCLE_MINOR[i] + 'm')));
        const [dx, dy] = lp(87);
        const dimRoot = T.keySignature(T.CIRCLE_MAJOR[i]).names[6];
        kids.push(s('text', { class: 'cf-t cf-t-dim', x: dx, y: dy + 4, 'text-anchor': 'middle' }, T.fmt(dimRoot) + '°'));
        const [kx, ky] = lp(266);
        const ks = T.keySignature(T.CIRCLE_MAJOR[i]);
        kids.push(s('text', { class: 'cf-t cf-t-sig', x: kx, y: ky + 4, 'text-anchor': 'middle' }, ks.sharps ? ks.sharps + '♯' : ks.flats ? ks.flats + '♭' : '0'));
      }
      kids.push(s('circle', { class: 'cf-hub', cx, cy, r: 70 }));
      kids.push(s('text', { class: 'cf-hub-t', x: cx, y: cy - 4, 'text-anchor': 'middle' }, T.fmt(tonicName) + (minor ? 'm' : '')));
      kids.push(s('text', { class: 'cf-hub-s', x: cx, y: cy + 18, 'text-anchor': 'middle' }, minor ? 'minor' : 'major'));
      const wheel = s('svg', { class: 'circle', viewBox: '-26 -26 572 572', role: 'group', 'aria-label': 'Circle of fifths' }, kids);
      wheel.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.target.dispatchEvent(new MouseEvent('click')); } });

      const rows = harm.rows.map((r, i) => {
        const nm = keyNames[i];
        const ch = T.chord(r.rootPc, r.triad.typeId);
        const v = V.best(r.rootPc, r.triad.typeId, tuning);
        return h('button', { type: 'button', class: 'cf-chord', onclick: () => v && A.strum(v.midis), title: 'Strum' },
          h('span', { class: 'roman' }, r.triad.roman),
          U.chordName(nm, ch.type.sym),
          h('span', { class: 'cf-func' }, minor ? ['tonic', 'supertonic', 'mediant', 'subdominant', 'dominant', 'submediant', 'subtonic'][i] : ['tonic', 'supertonic', 'mediant', 'subdominant', 'dominant', 'submediant', 'leading tone'][i]));
      });

      const relName = minor ? T.fmt(majName) + ' major' : T.fmt(minName) + ' minor';
      U.mount(el, 
        U.pageHead(this),
        U.renderSections(this, {
          wheel: () => h('div', { class: 'cf-grid' },
            h('div', { class: 'cf-wheel' }, wheel),
            h('div', { class: 'cf-info' },
              h('div', { class: 'eyebrow' }, 'Key of'),
              h('h2', { class: 'cf-key' }, T.fmt(tonicName), ' ', h('em', null, minor ? 'minor' : 'major')),
              h('div', { class: 'cf-sig' }, R.keySig(sig), h('div', null,
                h('div', { class: 'cf-sigcount' }, sig.sharps ? sig.sharps + ' sharp' + (sig.sharps > 1 ? 's' : '') : sig.flats ? sig.flats + ' flat' + (sig.flats > 1 ? 's' : '') : 'No sharps or flats'),
                h('div', { class: 'note muted' }, (sig.sharps ? sig.names.filter((n) => n.includes('#')) : sig.names.filter((n) => /b/.test(n.slice(1)))).map(T.fmt).join(' ')))),
              U.formula(keyNames, T.SCALE_BY_ID[scaleId].intervals),
              h('div', { class: 'ch-actions' },
                h('a', { class: 'textlink', href: GA.href('scales', { root: tonicPc, scale: scaleId }) }, 'Open scale →'),
                h('a', { class: 'textlink', href: GA.href('progressions', { root: tonicPc, scale: minor ? 'minor' : 'major' }) }, 'Write a progression →')))),
          chords: () => h('div', { class: 'cf-chords' }, rows),
          related: () => h('div', { class: 'cf-rel' },
            h('a', { href: GA.href('circle', { k: pos, q: minor ? null : 'm' }) }, h('span', null, 'Relative ' + (minor ? 'major' : 'minor')), h('b', null, relName)),
            h('a', { href: GA.href('circle', { k: T.mod(pos + 1), q: minor ? 'm' : null }) }, h('span', null, 'Dominant key'), h('b', null, T.fmt(minor ? T.CIRCLE_MINOR[T.mod(pos + 1)] + 'm' : T.CIRCLE_MAJOR[T.mod(pos + 1)]))),
            h('a', { href: GA.href('circle', { k: T.mod(pos - 1), q: minor ? 'm' : null }) }, h('span', null, 'Subdominant key'), h('b', null, T.fmt(minor ? T.CIRCLE_MINOR[T.mod(pos - 1)] + 'm' : T.CIRCLE_MAJOR[T.mod(pos - 1)])))),
        }),
      );
    },
  });
})();
