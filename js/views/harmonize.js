(function () {
  'use strict';
  const GA = window.GA, T = GA.Theory, U = GA.UI, R = GA.Render, V = GA.Voicings, A = GA.Audio;
  const h = U.h;

  GA.views.push({
    id: 'harmonize',
    num: '05',
    group: 'Connect',
    title: 'Scales → Chords',
    short: 'The chords that live inside a scale.',
    blurb: 'Harmonise any scale: the diatonic triads and sevenths with Roman numerals, plus every chord that fits.',
    keywords: 'diatonic chords in key harmonize roman numerals',
    sections: [
      { id: 'scale', title: 'Scale' },
      { id: 'triads', title: 'Triads' },
      { id: 'sevenths', title: 'Seventh chords' },
      { id: 'fits', title: 'Every chord that fits', collapsed: true },
    ],
    render(el, p, ctx) {
      const root = p.root != null ? +p.root : 7;
      const id = T.SCALE_BY_ID[p.scale] ? p.scale : 'major';
      const kind = p.k === '7' ? '7' : p.k === '3' ? '3' : 'both';
      const tuning = GA.settings.tuning().notes;
      const harm = T.harmonize(root, id, U.pref());
      const sc = T.scale(root, id, U.pref());
      const fits = T.chordsInScale(root, id, U.pref());

      const card = (c, roman) => {
        if (!c) return h('div', { class: 'ccard ccard-s ccard-none' }, '—');
        const ch = T.chord(c.rootPc, c.typeId, U.pref());
        const v = V.best(c.rootPc, c.typeId, tuning);
        return h('div', { class: 'ccard ccard-s' },
          h('div', { class: 'roman' }, roman),
          h('a', { href: GA.href('chords', { root: c.rootPc, type: c.typeId }), class: 'ccard-name' }, U.chordName(ch.rootName, ch.type.sym)),
          v ? h('button', { type: 'button', class: 'ccard-diag', title: 'Strum', onclick: () => A.strum(v.midis) }, R.chordDiagram(v, { rootPc: c.rootPc, names: new Map(ch.pcs.map((x, i) => [x, ch.names[i]])) })) : U.empty('—'));
      };

      const playAll = (which) => {
        harm.rows.forEach((r, i) => {
          const c = which === '7' ? r.seventh : r.triad;
          if (!c) return;
          const v = V.best(r.rootPc, c.typeId, tuning);
          if (v) A.strum(v.midis, { when: i * 0.75, duration: 0.7 });
        });
      };

      U.mount(el, 
        U.pageHead(this),
        h('div', { class: 'picker' },
          U.rootPicker({ value: root, onChange: (v) => ctx.update({ root: v }) }),
          U.select({ value: id, options: U.scaleOptions(), onChange: (v) => ctx.update({ scale: v }), fk: 'scale', wide: true })),
        U.renderSections(this, {
          scale: () => h('div', { class: 'hero-block' },
            h('h2', { class: 'sh-name' }, h('span', { class: 'cn-root' }, T.fmt(sc.rootName)), ' ', sc.type.name),
            U.formula(sc.names, sc.intervals),
            harm ? h('div', { class: 'ch-actions' }, h('a', { class: 'textlink', href: GA.href('progressions', { root, scale: id === 'minor' || id === 'harmminor' ? 'minor' : 'major' }) }, 'Build a progression in this key →'))
              : h('p', { class: 'note muted' }, 'No seven-note harmony for this scale — see every chord that fits.')),
          triads: () => (harm ? h('div', { class: 'degrees' }, harm.rows.map((r) => card(r.triad && { rootPc: r.rootPc, typeId: r.triad.typeId }, r.triad ? r.triad.roman : r.degree))) : null),
          sevenths: () => (harm ? h('div', { class: 'degrees' }, harm.rows.map((r) => card(r.seventh && { rootPc: r.rootPc, typeId: r.seventh.typeId }, r.seventh ? r.seventh.roman : r.degree))) : null),
          fits: () => h('div', { class: 'fitlist' }, fits.map((row) => h('div', { class: 'fitrow' },
            h('div', { class: 'fit-root' }, h('span', { class: 'fnote' }, T.fmt(row.rootName)), h('span', { class: 'fiv' }, T.fmt(row.interval))),
            h('div', { class: 'fit-chips' }, row.chords.length ? row.chords.map((c) => h('a', {
              class: 'chip', href: GA.href('chords', { root: row.rootPc, type: c.id }), title: c.name,
            }, T.fmt(row.rootName + c.sym))) : h('span', { class: 'muted' }, 'none'))))),
        }, {
          triads: () => U.button('Play', () => playAll('3'), { icon: 'play', kind: 'quiet-text' }),
          sevenths: () => U.button('Play', () => playAll('7'), { icon: 'play', kind: 'quiet-text' }),
        }),
      );
    },
  });
})();
