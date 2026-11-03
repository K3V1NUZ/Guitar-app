(function () {
  'use strict';
  const GA = window.GA, T = GA.Theory, U = GA.UI, R = GA.Render, V = GA.Voicings, A = GA.Audio;
  const h = U.h;

  GA.views.push({
    id: 'chords',
    num: '01',
    group: 'Look up',
    title: 'Chord Library',
    short: 'Pick a root and a type.',
    blurb: 'Every root, ' + T.CHORDS.length + ' chord types, many shapes each — with formulas, notes and where the tones sit on the neck.',
    keywords: 'all chords chart voicing shapes',
    sections: [
      { id: 'chord', title: 'Chord' },
      { id: 'shapes', title: 'Shapes' },
      { id: 'neck', title: 'On the neck' },
      { id: 'bass', title: 'Bass note & inversions', collapsed: true },
      { id: 'piano', title: 'Piano keyboard', hidden: true },
    ],
    render(el, p, ctx) {
      const root = p.root != null ? +p.root : 0;
      const typeId = T.CHORD_BY_ID[p.type] ? p.type : 'maj';
      const bass = p.bass != null && p.bass !== '' ? +p.bass : null;
      const inv = p.inv === '1';
      const sel = p.v != null ? +p.v : null;
      const tuning = GA.settings.tuning().notes;
      const ch = T.chord(root, typeId, U.pref());
      const names = new Map(ch.pcs.map((pc, i) => [pc, ch.names[i]]));
      const ivByPc = new Map(ch.pcs.map((pc, i) => [pc, ch.intervals[i]]));
      const voicings = V.generate(root, typeId, tuning, { bassPc: bass, rootBass: !inv, limit: 16, maxFret: Math.max(15, GA.settings.get('frets')) });
      const active = sel != null && voicings[sel] ? voicings[sel] : null;

      let bassName = null;
      if (bass != null) bassName = names.get(bass) || U.namePc(bass);
      const fullSym = ch.symbol + (bassName ? '/' + bassName : '');

      const limit = p.all === '1' ? voicings.length : 8;

      const neck = () => [
        R.fretboard({
          tuning,
          mark: (s, f, midi) => {
            const pc = midi % 12;
            if (!ivByPc.has(pc)) return null;
            const iv = ivByPc.get(pc);
            const lab = GA.settings.get('labels') === 'intervals' ? T.fmt(iv) : T.fmt(names.get(pc));
            if (active) return active.frets[s] === f ? { label: lab, role: T.ivRole(iv) } : { label: '', role: 'ghost' };
            return { label: lab, role: T.ivRole(iv) };
          },
          onCell: (s, f, midi) => A.pluck(midi),
          highlightFrets: active ? [active.minFret || 0, Math.max(active.maxFret, (active.minFret || 1) + 3)] : null,
        }),
        labelLegend(),
      ];

      U.mount(el,
        U.pageHead(this),
        h('div', { class: 'picker' },
          U.rootPicker({ value: root, onChange: (v) => ctx.update({ root: v, v: null, bass: null, all: null }) }),
          U.typePicker({ value: typeId, onChange: (v) => ctx.update({ type: v, v: null, bass: null, all: null }) })),
        U.renderSections(this, {
          chord: () => h('div', { class: 'hero-block' },
            h('div', { class: 'hb-name' },
              h('div', { class: 'ch-big' }, U.chordName(ch.rootName, ch.type.sym + (bassName ? '/' + bassName : ''))),
              h('div', { class: 'ch-long' }, T.fmt(ch.rootName) + ' ' + ch.type.name.toLowerCase() + (bassName ? ' over ' + T.fmt(bassName) : ''))),
            U.formula(ch.names, ch.intervals, { onNote: (i) => A.pluck(48 + root + (root < 4 ? 12 : 0) + T.IV[ch.intervals[i]][0]) }),
            h('div', { class: 'ch-actions' },
              U.button('Play', () => { const v = active || voicings[0]; v && A.strum(v.midis); }, { kind: 'primary', icon: 'play', fk: 'strum' }),
              U.button(null, () => { const v = active || voicings[0]; v && A.sequence(v.midis.filter((m) => m != null), { step: 0.16 }); }, { kind: 'quiet', icon: 'arp', title: 'Arpeggio' }),
              h('a', { class: 'textlink', href: GA.href('chordscales', { root, type: typeId }) }, 'Scales that fit →'))),
          shapes: () => [
            voicings.length ? h('div', { class: 'voicings' }, voicings.slice(0, limit).map((v, i) => h('button', {
              type: 'button', class: ['vcard', sel === i ? 'on' : ''], 'data-fk': 'v' + i,
              onclick: () => { A.strum(v.midis); ctx.update({ v: sel === i ? null : i }); },
              title: 'Play and show on the neck',
            }, R.chordDiagram(v, { rootPc: root, names }), h('span', { class: 'vtab' }, V.toText(v.frets)))))
              : U.empty('No comfortable shape for ' + T.fmt(fullSym) + ' in this tuning. Try allowing inversions.'),
          ],
          neck,
          bass: () => h('div', { class: 'controls-row' },
            U.select({ label: 'Bass note', value: bass == null ? '' : bass, fk: 'bass',
              options: [{ value: '', label: 'Root in bass' }].concat([...Array(12).keys()].map((pc) => ({ value: pc, label: '/' + T.fmt(names.get(pc) || U.namePc(pc)) + (names.has(pc) ? '  (chord tone)' : '') }))),
              onChange: (v) => ctx.update({ bass: v === '' ? null : v, v: null }) }),
            U.toggle({ label: 'Allow inversions', checked: inv, fk: 'inv', onChange: (v) => ctx.update({ inv: v ? '1' : null, v: null }) })),
          piano: () => R.piano({ pcs: ch.pcs, rootPc: root, names }),
        }, {
          shapes: () => (voicings.length > limit
            ? h('button', { type: 'button', class: 'morelink', onclick: () => ctx.update({ all: '1' }) }, 'Show all ' + voicings.length)
            : h('span', { class: 'block-aside' }, voicings.length + ' shapes')),
        }),
      );
    },
  });

  function labelLegend() {
    const S = GA.settings;
    return h('div', { class: 'legendrow' },
      h('div', { class: 'legend' },
        [['root', 'Root'], ['third', '3rd'], ['fifth', '5th'], ['seventh', '7th'], ['ext', 'Other']].map(([r, l]) => h('span', { class: 'lg r-' + r }, h('i'), l))),
      U.seg({ small: true, value: S.get('labels'), fk: 'lbl', options: [{ value: 'notes', label: 'Notes' }, { value: 'intervals', label: 'Intervals' }], onChange: (v) => S.set('labels', v) }));
  }
  GA.UI.labelLegend = labelLegend;
})();
