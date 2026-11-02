(function () {
  'use strict';
  const GA = window.GA, T = GA.Theory, U = GA.UI, R = GA.Render, V = GA.Voicings, A = GA.Audio;
  const h = U.h;

  GA.views.push({
    id: 'chords',
    num: '01',
    group: 'Look up',
    title: 'Chord Library',
    blurb: 'Every root, ' + T.CHORDS.length + ' chord types, many shapes each — with formulas, notes and where the tones sit on the neck.',
    keywords: 'all chords chart voicing shapes',
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

      U.mount(el, 
        U.pageHead(this),
        h('div', { class: 'controls' },
          U.rootPicker({ value: root, onChange: (v) => ctx.update({ root: v, v: null, bass: null }) }),
          h('div', { class: 'controls-row' },
            U.select({ label: 'Bass note (slash chord)', value: bass == null ? '' : bass, fk: 'bass',
              options: [{ value: '', label: 'Root in bass' }].concat([...Array(12).keys()].map((pc) => ({ value: pc, label: '/' + T.fmt(names.get(pc) || U.namePc(pc)) + (names.has(pc) ? '  (chord tone)' : '') }))),
              onChange: (v) => ctx.update({ bass: v === '' ? null : v, v: null }) }),
            U.toggle({ label: 'Include inversions', checked: inv, fk: 'inv', onChange: (v) => ctx.update({ inv: v ? '1' : null, v: null }) }))),
        h('div', { class: 'typepicker' }, U.chipGroups({ groups: U.chordTypeGroups(), value: typeId, onChange: (v) => ctx.update({ type: v, v: null, bass: null }) })),

        h('div', { class: 'chordhero' },
          h('div', { class: 'ch-name' },
            h('div', { class: 'ch-big' }, U.chordName(ch.rootName, ch.type.sym + (bassName ? '/' + bassName : ''))),
            h('div', { class: 'ch-long' }, T.fmt(ch.rootName) + ' ' + ch.type.name.toLowerCase() + (bassName ? ' over ' + T.fmt(bassName) : '')),
            ch.type.aliases.length ? h('div', { class: 'ch-alias' }, 'Also written ', ch.type.aliases.slice(0, 4).map((a) => T.fmt(ch.rootName + a)).join(' · ')) : null,
            h('div', { class: 'ch-actions' },
              U.button('Strum', () => { const v = active || voicings[0]; v && A.strum(v.midis); }, { kind: 'primary', icon: 'play', fk: 'strum' }),
              U.button('Arpeggio', () => { const v = active || voicings[0]; v && A.sequence(v.midis.filter((m) => m != null), { step: 0.16 }); }, { kind: 'ghost', icon: 'arp' }),
              U.button('Scales that fit', () => GA.go('chordscales', { root, type: typeId }), { kind: 'ghost', icon: 'right' }))),
          h('div', { class: 'ch-theory' },
            h('div', { class: 'label' }, 'Formula'),
            U.formula(ch.names, ch.intervals, { onNote: (i) => A.pluck(48 + root + (root < 4 ? 12 : 0) + T.IV[ch.intervals[i]][0]) }),
            ch.type.optional.length ? h('p', { class: 'note' }, 'Optional when voicing: ', ch.type.optional.map((iv) => T.fmt(iv)).join(', '), '.') : null,
            R.piano({ pcs: ch.pcs, rootPc: root, names }))),

        U.section(voicings.length + ' shapes' + (active ? '' : ''), [
          voicings.length ? h('div', { class: 'voicings' }, voicings.map((v, i) => h('button', {
            type: 'button', class: ['vcard', sel === i ? 'on' : ''], 'data-fk': 'v' + i,
            onclick: () => { A.strum(v.midis); ctx.update({ v: sel === i ? null : i }); },
            title: 'Play and show on the neck',
          }, R.chordDiagram(v, { rootPc: root, names }), h('span', { class: 'vtab' }, V.toText(v.frets)))))
            : U.empty('No comfortable shape found for ' + T.fmt(fullSym) + ' in this tuning. Try including inversions.'),
        ], { aside: h('span', { class: 'block-aside' }, 'Click a shape to hear it and see it on the neck') }),

        U.section('On the neck', [
          h('p', { class: 'note' }, active ? 'Showing shape ' + V.toText(active.frets) + ' — other chord tones are faded.' : 'Every ' + T.fmt(fullSym) + ' chord tone across the fretboard, coloured by role.'),
          R.fretboard({
            tuning,
            mark: (s, f, midi) => {
              const pc = midi % 12;
              if (!ivByPc.has(pc)) return null;
              const iv = ivByPc.get(pc);
              const lab = GA.settings.get('labels') === 'intervals' ? T.fmt(iv) : T.fmt(names.get(pc));
              if (active) {
                if (active.frets[s] === f) return { label: lab, role: T.ivRole(iv) };
                return { label: '', role: 'ghost' };
              }
              return { label: lab, role: T.ivRole(iv) };
            },
            onCell: (s, f, midi) => A.pluck(midi),
            highlightFrets: active ? [active.minFret || 0, Math.max(active.maxFret, (active.minFret || 1) + 3)] : null,
          }),
          labelLegend(),
        ]),
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
