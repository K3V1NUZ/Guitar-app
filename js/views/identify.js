(function () {
  'use strict';
  const GA = window.GA, T = GA.Theory, U = GA.UI, R = GA.Render, V = GA.Voicings, A = GA.Audio;
  const h = U.h;

  function parseFrets(str, n) {
    if (!str) return new Array(n).fill(-1);
    let parts;
    if (str.includes(',') || str.includes(' ') || str.includes('-')) parts = str.split(/[,\s-]+/).filter(Boolean);
    else parts = (str.match(/\(\d+\)|\d|x|X/g) || []);
    const out = parts.map((x) => (/x/i.test(x) ? -1 : parseInt(x.replace(/[()]/g, ''), 10))).slice(0, n);
    while (out.length < n) out.push(-1);
    return out.map((x) => (isNaN(x) ? -1 : x));
  }

  GA.views.push({
    id: 'identify',
    num: '02',
    group: 'Look up',
    title: 'Chord Identifier',
    short: 'Tap a shape or pick notes to name it.',
    blurb: 'Tap a shape on the neck or pick notes, and get the chord’s name — slash chords and inversions included.',
    keywords: 'name that chord finder what chord is this reverse',
    sections: [
      { id: 'input', title: 'Your notes' },
      { id: 'result', title: 'Result' },
    ],
    render(el, p, ctx) {
      const tuning = GA.settings.tuning().notes;
      const n = tuning.length;
      const mode = p.m === 'notes' ? 'notes' : 'neck';
      const frets = parseFrets(p.f, n);
      const picked = new Set((p.n || '').split(',').filter((x) => x !== '').map(Number));
      const bassSel = p.b != null && p.b !== '' ? +p.b : null;

      let pcs, bass, midis = [];
      if (mode === 'neck') {
        midis = frets.map((f, s) => (f < 0 ? null : tuning[s] + f));
        const sounding = midis.filter((m) => m != null);
        pcs = [...new Set(sounding.map((m) => m % 12))];
        bass = sounding.length ? Math.min(...sounding) % 12 : null;
      } else {
        pcs = [...picked];
        bass = bassSel != null && picked.has(bassSel) ? bassSel : null;
      }
      const results = T.identifyChord(pcs, bass, U.pref());
      const exact = results.filter((r) => !r.incomplete);
      const partial = results.filter((r) => r.incomplete).slice(0, 6);
      const top = exact[0] || partial[0];
      const topChord = top ? T.chord(top.rootPc, top.typeId, U.pref()) : null;
      const ivOf = (pc) => {
        if (!topChord) return null;
        const i = topChord.pcs.indexOf(pc);
        return i >= 0 ? topChord.intervals[i] : T.SEMI_SHORT[T.mod(pc - topChord.rootPc)];
      };
      const nameOf = (pc) => {
        if (topChord) { const i = topChord.pcs.indexOf(pc); if (i >= 0) return topChord.names[i]; }
        return U.namePc(pc);
      };

      const setFrets = (arr) => ctx.update({ f: arr.map((f) => (f < 0 ? 'x' : f)).join('-') });
      const fretsText = V.toText(frets);

      const input = mode === 'neck'
        ? [
          !pcs.length ? h('p', { class: 'note' }, 'Click a fret to place a finger; click again to mute. Left of the nut is an open string.') : null,
          R.fretboard({
            tuning,
            onCell: (s, f) => {
              const next = frets.slice();
              next[s] = next[s] === f ? -1 : f;
              if (next[s] >= 0) A.pluck(tuning[s] + f);
              setFrets(next);
            },
            mark: (s, f, midi) => {
              if (frets[s] === f) return { label: T.fmt(GA.settings.get('labels') === 'intervals' ? ivOf(midi % 12) : nameOf(midi % 12)), role: topChord ? T.ivRole(ivOf(midi % 12)) : 'plain' };
              if (f === 0 && frets[s] < 0) return { label: '×', role: 'mute' };
              return null;
            },
          }),
          h('div', { class: 'controls-row' },
            h('label', { class: 'field' }, h('span', { class: 'label' }, 'Frets, low to high'),
              h('input', { class: 'textin mono', value: fretsText, 'data-fk': 'ftext', placeholder: 'x32010', spellcheck: 'false',
                onchange: (e) => setFrets(parseFrets(e.target.value, n)) })),
            U.button('Play', () => A.strum(midis), { icon: 'play', kind: 'primary', disabled: !pcs.length }),
            pcs.length ? U.button('Clear', () => ctx.update({ f: null }), { kind: 'ghost' }) : null),
        ]
        : [
          U.noteToggles({ selected: picked, rootPc: bass, onToggle: (pc) => {
            const nx = new Set(picked);
            nx.has(pc) ? nx.delete(pc) : nx.add(pc);
            if (nx.has(pc)) A.pluck(60 + pc);
            ctx.update({ n: [...nx].join(','), b: bassSel != null && nx.has(bassSel) ? bassSel : null });
          } }),
          h('div', { class: 'controls-row' },
            U.select({ label: 'Bass note', value: bassSel == null ? '' : bassSel, fk: 'bsel',
              options: [{ value: '', label: 'Any / unknown' }].concat([...picked].sort((a, b) => a - b).map((pc) => ({ value: pc, label: T.fmt(U.namePc(pc)) }))),
              onChange: (v) => ctx.update({ b: v === '' ? null : v }) }),
            U.button('Play notes', () => { const base = bass != null ? bass : Math.min(...pcs); A.sequence([...pcs].map((pc) => 48 + base + T.mod(pc - base)).sort((a, b) => a - b), { step: 0.18 }); }, { icon: 'play', kind: 'primary', disabled: !pcs.length }),
            pcs.length ? U.button('Clear', () => ctx.update({ n: null, b: null }), { kind: 'ghost' }) : null),
        ];

      const resultBlock = !pcs.length
        ? h('p', { class: 'note muted' }, 'Nothing selected yet.')
        : pcs.length === 1
          ? h('div', { class: 'idresult' }, h('div', { class: 'id-big' }, T.fmt(U.namePc(pcs[0]))), h('p', { class: 'note' }, 'A single note. Add at least one more.'))
          : h('div', { class: 'idresult' },
            pcs.length === 2 ? h('p', { class: 'eyebrow' }, 'Interval: ' + T.SEMI_LONG[T.mod(pcs[1] - pcs[0])] + ' / ' + T.SEMI_LONG[T.mod(pcs[0] - pcs[1])]) : null,
            top ? h('div', { class: 'id-top' },
              h('a', { class: 'id-big', href: GA.href('chords', { root: top.rootPc, type: top.typeId, bass: top.bassPc !== top.rootPc ? top.bassPc : null }) },
                U.chordName(top.symbol.slice(0, topChord.rootName.length), top.symbol.slice(topChord.rootName.length))),
              h('div', { class: 'id-long' }, T.fmt(topChord.rootName) + ' ' + topChord.type.name.toLowerCase() + (top.bassPc !== top.rootPc ? ' with ' + T.fmt(nameOf(top.bassPc)) + ' in the bass' : '') + (top.incomplete ? ' (incomplete)' : '')),
              top.missing.length ? h('p', { class: 'note' }, (top.incomplete ? 'Missing ' : 'Omitted (fine to leave out): ') + top.missing.map(T.fmt).join(', ')) : null,
              U.formula(pcs.slice().sort((a, b) => T.mod(a - top.rootPc) - T.mod(b - top.rootPc)).map(nameOf), pcs.slice().sort((a, b) => T.mod(a - top.rootPc) - T.mod(b - top.rootPc)).map(ivOf)))
              : h('div', { class: 'id-top' }, h('div', { class: 'id-big muted' }, 'No standard name'), h('p', { class: 'note' }, 'These notes don’t form a chord in the library. Try removing a note, or check the Scale Identifier.')),
            exact.length > 1 || (partial.length > 1 && !exact.length) ? h('div', { class: 'id-alts' },
              exact.length > 1 ? [h('div', { class: 'label' }, 'Also could be'), h('div', { class: 'altlist' }, exact.slice(1, 9).map(altLink))] : null,
              partial.length > 1 && !exact.length ? [h('div', { class: 'label' }, 'Other close matches'), h('div', { class: 'altlist' }, partial.slice(1).map(altLink))] : null) : null);

      function altLink(r) {
        const c = T.chord(r.rootPc, r.typeId, U.pref());
        return h('a', { class: 'alt', href: GA.href('chords', { root: r.rootPc, type: r.typeId, bass: r.bassPc !== r.rootPc ? r.bassPc : null }) },
          h('span', { class: 'alt-sym' }, T.fmt(r.symbol)), h('span', { class: 'alt-name' }, c.type.name + (r.incomplete ? ' · no ' + r.missing.filter((m) => !c.type.optional.includes(m)).map(T.fmt).join(',') : '')));
      }

      U.mount(el, 
        U.pageHead(this),
        h('div', { class: 'picker' }, U.seg({ value: mode, fk: 'mode', options: [{ value: 'neck', label: 'On the fretboard' }, { value: 'notes', label: 'From notes' }], onChange: (v) => ctx.update({ m: v === 'notes' ? 'notes' : null }) })),
        U.renderSections(this, {
          input: () => h('div', { class: 'id-input' }, input),
          result: () => h('div', { class: 'id-out' }, resultBlock,
            mode === 'neck' && pcs.length >= 2 ? h('div', { class: 'id-diagram' }, R.chordDiagram({
              frets, fingers: V.fingering(frets).fingers, barre: V.fingering(frets).barre, midis,
              intervals: midis.map((m) => (m == null ? null : ivOf(m % 12))),
            }, { names: new Map(pcs.map((pc) => [pc, nameOf(pc)])) })) : null),
        }),
      );
    },
  });
})();
