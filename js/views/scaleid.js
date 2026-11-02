(function () {
  'use strict';
  const GA = window.GA, T = GA.Theory, U = GA.UI, R = GA.Render, A = GA.Audio;
  const h = U.h;

  GA.views.push({
    id: 'scaleid',
    num: '04',
    group: 'Look up',
    title: 'Scale Identifier',
    short: 'Find scales that contain your notes.',
    blurb: 'Enter the notes of a riff or melody and find every scale and mode that contains them.',
    keywords: 'scale finder what scale which key detect',
    sections: [
      { id: 'input', title: 'Your notes' },
      { id: 'exact', title: 'Exact matches' },
      { id: 'contains', title: 'Scales containing these notes' },
    ],
    render(el, p, ctx) {
      const tuning = GA.settings.tuning().notes;
      const picked = new Set((p.n || '').split(',').filter((x) => x !== '').map(Number));
      const rootSel = p.r != null && p.r !== '' ? +p.r : null;
      const mode = p.m === 'neck' ? 'neck' : 'notes';
      const showAll = p.all === '1';
      const pcs = [...picked];
      const res = pcs.length ? T.identifyScales(pcs, { rootPc: rootSel }) : [];
      const exact = res.filter((r) => r.exact);
      const contains = res.filter((r) => !r.exact);

      const toggle = (pc, midi) => {
        const nx = new Set(picked);
        nx.has(pc) ? nx.delete(pc) : nx.add(pc);
        if (nx.has(pc)) A.pluck(midi != null ? midi : 60 + pc);
        ctx.update({ n: [...nx].join(',') || null, r: rootSel != null && nx.has(rootSel) ? rootSel : null });
      };

      const card = (r) => {
        const sc = T.scale(r.rootPc, r.typeId, U.pref());
        return h('a', { class: 'scard', href: GA.href('scales', { root: r.rootPc, scale: r.typeId }) },
          h('div', { class: 'scard-name' }, h('b', null, T.fmt(sc.rootName)), ' ', sc.type.name),
          h('div', { class: 'scard-notes' }, sc.names.map((nm, i) => h('span', { class: picked.has(sc.pcs[i]) ? 'in' : 'out', title: picked.has(sc.pcs[i]) ? 'In your notes' : 'Extra note' }, T.fmt(nm)))),
          r.extra ? h('div', { class: 'scard-extra' }, '+' + r.extra + ' note' + (r.extra > 1 ? 's' : '')) : h('div', { class: 'scard-extra exact' }, 'exact'));
      };

      U.mount(el, 
        U.pageHead(this),
        h('div', { class: 'picker' },
          U.seg({ value: mode, fk: 'mode', options: [{ value: 'notes', label: 'Pick notes' }, { value: 'neck', label: 'Tap the fretboard' }], onChange: (v) => ctx.update({ m: v === 'neck' ? 'neck' : null }) })),
        U.renderSections(this, {
          input: () => [
            mode === 'notes'
              ? U.noteToggles({ selected: picked, rootPc: rootSel, onToggle: (pc) => toggle(pc) })
              : R.fretboard({ tuning, onCell: (s, f, midi) => toggle(midi % 12, midi),
                mark: (s, f, midi) => (picked.has(midi % 12) ? { label: T.fmt(U.namePc(midi % 12)), role: midi % 12 === rootSel ? 'root' : 'plain' } : null) }),
            h('div', { class: 'controls-row' },
              U.select({ label: 'Tonal centre', value: rootSel == null ? '' : rootSel, fk: 'rsel',
                options: [{ value: '', label: 'Any root' }].concat([...Array(12).keys()].map((pc) => ({ value: pc, label: T.fmt(U.namePc(pc)) + (picked.has(pc) ? '' : '  (not in your notes)') }))),
                onChange: (v) => ctx.update({ r: v === '' ? null : v }) }),
              pcs.length ? U.button('Clear', () => ctx.update({ n: null, r: null }), { kind: 'ghost' }) : null,
              h('span', { class: 'hint' }, pcs.length ? pcs.length + ' note' + (pcs.length > 1 ? 's' : '') + ' selected' : 'Select at least two notes')),
          ],
          exact: () => (!pcs.length ? h('p', { class: 'note muted' }, 'Pick some notes to begin.') : exact.length ? h('div', { class: 'scards' }, exact.slice(0, 24).map(card)) : h('p', { class: 'note muted' }, 'No scale has exactly these notes — see the larger ones.')),
          contains: () => (!pcs.length ? null : contains.length ? [
            h('div', { class: 'scards' }, contains.slice(0, showAll ? 120 : 18).map(card)),
            contains.length > 18 && !showAll ? h('div', { class: 'center-row' }, h('button', { type: 'button', class: 'morelink', onclick: () => ctx.update({ all: '1' }) }, 'Show all ' + contains.length)) : null,
          ] : h('p', { class: 'note muted' }, 'No larger scales contain these notes.')),
        }, {
          exact: () => (pcs.length ? h('span', { class: 'block-aside' }, exact.length + ' found') : null),
          contains: () => h('span', { class: 'block-aside' }, contains.length + ' found'),
        }),
      );
    },
  });
})();
