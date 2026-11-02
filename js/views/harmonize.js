(function () {
  'use strict';
  const GA = window.GA, T = GA.Theory, U = GA.UI, R = GA.Render, V = GA.Voicings, A = GA.Audio;
  const h = U.h;

  GA.views.push({
    id: 'harmonize',
    num: '05',
    group: 'Connect',
    title: 'Scales → Chords',
    blurb: 'Harmonise any scale: the diatonic triads and sevenths with Roman numerals, plus every chord that fits.',
    keywords: 'diatonic chords in key harmonize roman numerals',
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
        h('div', { class: 'controls' },
          U.rootPicker({ value: root, onChange: (v) => ctx.update({ root: v }) }),
          h('div', { class: 'controls-row' },
            U.select({ label: 'Scale', value: id, options: U.scaleOptions(), onChange: (v) => ctx.update({ scale: v }), fk: 'scale', wide: true }),
            harm ? U.seg({ label: 'Show', value: kind, fk: 'k', options: [{ value: 'both', label: 'Triads & 7ths' }, { value: '3', label: 'Triads' }, { value: '7', label: 'Sevenths' }], onChange: (v) => ctx.update({ k: v === 'both' ? null : v }) }) : null)),
        h('div', { class: 'keyline' },
          h('h2', { class: 'sh-name' }, h('span', { class: 'cn-root' }, T.fmt(sc.rootName)), ' ', sc.type.name),
          U.formula(sc.names, sc.intervals)),
        harm ? [
          kind !== '7' ? U.section('Triads', h('div', { class: 'degrees' }, harm.rows.map((r) => card(r.triad && { rootPc: r.rootPc, typeId: r.triad.typeId }, r.triad ? r.triad.roman : r.degree))),
            { aside: U.button('Play I → vii', () => playAll('3'), { icon: 'play', kind: 'ghost' }) }) : null,
          kind !== '3' ? U.section('Seventh chords', h('div', { class: 'degrees' }, harm.rows.map((r) => card(r.seventh && { rootPc: r.rootPc, typeId: r.seventh.typeId }, r.seventh ? r.seventh.roman : r.degree))),
            { aside: U.button('Play all', () => playAll('7'), { icon: 'play', kind: 'ghost' }) }) : null,
          h('div', { class: 'controls-row' }, U.button('Build a progression in this key', () => GA.go('progressions', { root, scale: id === 'minor' || id === 'harmminor' ? 'minor' : 'major' }), { icon: 'right', kind: 'ghost' })),
        ] : h('p', { class: 'note' }, 'This scale doesn’t have seven notes, so there’s no stack-of-thirds harmony. Here is every chord from the library that fits inside it:'),

        U.section('Every chord that fits', h('div', { class: 'fitlist' }, fits.map((row) => h('div', { class: 'fitrow' },
          h('div', { class: 'fit-root' }, h('span', { class: 'fnote' }, T.fmt(row.rootName)), h('span', { class: 'fiv' }, T.fmt(row.interval))),
          h('div', { class: 'fit-chips' }, row.chords.length ? row.chords.map((c) => h('a', {
            class: 'chip', href: GA.href('chords', { root: row.rootPc, type: c.id }), title: c.name,
          }, T.fmt(row.rootName + c.sym))) : h('span', { class: 'muted' }, 'none'))))),
        { aside: h('span', { class: 'block-aside' }, 'Chords built only from notes of the scale') }),
      );
    },
  });
})();
