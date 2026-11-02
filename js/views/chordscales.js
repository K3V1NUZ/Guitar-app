(function () {
  'use strict';
  const GA = window.GA, T = GA.Theory, U = GA.UI, R = GA.Render, A = GA.Audio;
  const h = U.h;

  function keysContaining(rootPc, typeId) {
    const out = [];
    for (const sid of ['major', 'minor', 'harmminor', 'melminor']) {
      for (let r = 0; r < 12; r++) {
        const hm = T.harmonize(r, sid, U.pref());
        for (const row of hm.rows) {
          if (row.rootPc !== rootPc) continue;
          if (row.triad && row.triad.typeId === typeId) out.push({ r, sid, roman: row.triad.roman, name: hm.scale.rootName });
          else if (row.seventh && row.seventh.typeId === typeId) out.push({ r, sid, roman: row.seventh.roman, name: hm.scale.rootName });
        }
      }
    }
    return out;
  }

  GA.views.push({
    id: 'chordscales',
    num: '06',
    group: 'Connect',
    title: 'Chords → Scales',
    blurb: 'Pick a chord and see which scales to solo over it, and which keys it naturally belongs to.',
    keywords: 'chord scale improvisation solo over what scale key',
    render(el, p, ctx) {
      const root = p.root != null ? +p.root : 2;
      const typeId = T.CHORD_BY_ID[p.type] ? p.type : 'm7';
      const ch = T.chord(root, typeId, U.pref());
      const chordSet = new Set(ch.pcs);
      const all = T.scalesForChord(root, typeId);
      const same = all.filter((s) => s.sameRoot);
      const other = all.filter((s) => !s.sameRoot && T.SCALE_BY_ID[s.typeId].rank <= 3);
      const keys = keysContaining(root, typeId);

      const card = (r) => {
        const sc = T.scale(r.rootPc, r.typeId, U.pref());
        return h('a', { class: 'scard', href: GA.href('scales', { root: r.rootPc, scale: r.typeId }) },
          h('div', { class: 'scard-name' }, h('b', null, T.fmt(sc.rootName)), ' ', sc.type.name),
          h('div', { class: 'scard-notes' }, sc.names.map((nm, i) => h('span', { class: chordSet.has(sc.pcs[i]) ? 'in' : 'out', title: chordSet.has(sc.pcs[i]) ? 'Chord tone' : 'Passing / colour tone' }, T.fmt(nm)))),
          h('div', { class: 'scard-extra' }, sc.type.family));
      };

      U.mount(el, 
        U.pageHead(this),
        h('div', { class: 'controls' },
          U.rootPicker({ value: root, onChange: (v) => ctx.update({ root: v }) })),
        h('div', { class: 'typepicker' }, U.chipGroups({ groups: U.chordTypeGroups(), value: typeId, onChange: (v) => ctx.update({ type: v }) })),
        h('div', { class: 'keyline' },
          h('a', { class: 'id-big', href: GA.href('chords', { root, type: typeId }) }, U.chordName(ch.rootName, ch.type.sym)),
          U.formula(ch.names, ch.intervals),
          U.button('Hear it', () => { const v = GA.Voicings.best(root, typeId, GA.settings.tuning().notes); v && A.strum(v.midis); }, { icon: 'play', kind: 'ghost' })),
        keys.length ? U.section('Diatonic in these keys', h('div', { class: 'keychips' }, keys.map((k) => h('a', { class: 'keychip', href: GA.href('harmonize', { root: k.r, scale: k.sid }) },
          h('span', { class: 'kc-roman' }, k.roman), h('span', { class: 'kc-key' }, T.fmt(k.name) + ' ' + T.SCALE_BY_ID[k.sid].name.replace(' (Ionian)', '').replace(' (Aeolian)', '')))))) : null,
        U.section('Scales built on ' + T.fmt(ch.rootName), same.length ? h('div', { class: 'scards' }, same.map(card)) : U.empty('No scale in the library contains every note of this chord from its root.'),
          { aside: h('span', { class: 'block-aside' }, 'Chord tones in bold') }),
        other.length ? U.section('Common scales from other roots', h('div', { class: 'scards' }, other.slice(0, 24).map(card))) : null,
      );
    },
  });
})();
