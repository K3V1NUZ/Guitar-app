(function () {
  'use strict';
  const GA = window.GA, T = GA.Theory, U = GA.UI, R = GA.Render, A = GA.Audio;
  const h = U.h;
  const STEP = { 1: 'H', 2: 'W', 3: 'W+H', 4: '2W', 5: '2W+H' };

  /** All scales that are rotations (modes) of the given one. */
  function modesOf(rootPc, scaleId) {
    const sc = T.SCALE_BY_ID[scaleId];
    const out = [];
    sc.pcs.forEach((off, i) => {
      if (i === 0) return;
      const rot = sc.pcs.map((p) => T.mod(p - off)).sort((a, b) => a - b).join(',');
      const match = T.SCALES.find((s) => s.pcs.slice().sort((a, b) => a - b).join(',') === rot);
      if (match) out.push({ rootPc: T.mod(rootPc + off), typeId: match.id, degree: i + 1 });
    });
    return out;
  }

  GA.views.push({
    id: 'scales',
    num: '03',
    group: 'Look up',
    title: 'Scale Explorer',
    short: 'Any scale, anywhere on the neck.',
    blurb: T.SCALES.length + ' scales and modes mapped across the neck, with positions, step patterns and playback.',
    keywords: 'scales modes pentatonic blues fretboard positions boxes',
    sections: [
      { id: 'scale', title: 'Scale' },
      { id: 'neck', title: 'On the neck' },
      { id: 'related', title: 'Related scales' },
      { id: 'modes', title: 'Modes of this scale', collapsed: true },
      { id: 'piano', title: 'Piano keyboard', hidden: true },
    ],
    render(el, p, ctx) {
      const root = p.root != null ? +p.root : 9;
      const id = T.SCALE_BY_ID[p.scale] ? p.scale : 'minpent';
      const pos = p.pos != null ? +p.pos : -1;
      const colorBy = p.color === 'iv' ? 'iv' : 'root';
      const sc = T.scale(root, id, U.pref());
      const tuning = GA.settings.tuning().notes;
      const N = GA.settings.get('frets');
      const names = new Map(sc.pcs.map((pc, i) => [pc, sc.names[i]]));
      const ivs = new Map(sc.pcs.map((pc, i) => [pc, sc.intervals[i]]));
      const steps = sc.type.pcs.map((pc, i, a) => (i < a.length - 1 ? a[i + 1] : 12) - pc).map((d) => STEP[d] || d);

      // positions: windows starting at each scale degree on the lowest string
      const low = tuning.reduce((a, b) => Math.min(a, b));
      const lowIdx = tuning.indexOf(low);
      const positions = sc.pcs.map((pc) => T.mod(pc - tuning[lowIdx])).sort((a, b) => a - b)
        .filter((f, i, arr) => sc.pcs.length <= 7 || i % 2 === 0).map((f) => (f === 0 ? 0 : f));
      const win = pos >= 0 && positions[pos] != null ? [Math.max(0, positions[pos] - (positions[pos] > 0 ? 1 : 0)), positions[pos] + 3 + (positions[pos] > 0 ? 0 : 1)] : null;

      const play = (dir) => {
        const base = 48 + root + (root < 4 ? 12 : 0);
        let seq = sc.type.pcs.map((x) => base + x).concat([base + 12]);
        if (dir === 'down') seq = seq.reverse();
        if (dir === 'both') seq = seq.concat(seq.slice(0, -1).reverse());
        A.sequence(seq, { step: 0.2 });
      };

      const rel = [];
      if (id === 'major') rel.push({ label: 'Relative minor', root: T.mod(root + 9), id: 'minor' }, { label: 'Parallel minor', root, id: 'minor' });
      if (id === 'minor') rel.push({ label: 'Relative major', root: T.mod(root + 3), id: 'major' }, { label: 'Parallel major', root, id: 'major' });
      if (id === 'minpent') rel.push({ label: 'Relative major pentatonic', root: T.mod(root + 3), id: 'majpent' }, { label: 'Add the blue note', root, id: 'blues' });
      if (id === 'majpent') rel.push({ label: 'Relative minor pentatonic', root: T.mod(root + 9), id: 'minpent' }, { label: 'Major blues', root, id: 'majblues' });

      U.mount(el, 
        U.pageHead(this),
        h('div', { class: 'picker' },
          U.rootPicker({ value: root, onChange: (v) => ctx.update({ root: v, pos: null }) }),
          U.select({ value: id, options: U.scaleOptions(), onChange: (v) => ctx.update({ scale: v, pos: null }), fk: 'scale', wide: true })),
        U.renderSections(this, {
          scale: () => h('div', { class: 'hero-block' },
            h('div', { class: 'hb-name' },
              h('h2', { class: 'sh-name' }, h('span', { class: 'cn-root' }, T.fmt(sc.rootName)), ' ', sc.type.name),
              h('div', { class: 'steps', title: 'Steps between notes (W = whole, H = half)' }, steps.join(' · '))),
            U.formula(sc.names, sc.intervals, { onNote: (i) => A.pluck(48 + root + (root < 4 ? 12 : 0) + sc.type.pcs[i]) }),
            h('div', { class: 'ch-actions' },
              U.button('Play', () => play('both'), { icon: 'play', kind: 'primary' }),
              U.button(null, () => play('up'), { icon: 'up', kind: 'quiet', title: 'Ascend' }),
              U.button(null, () => play('down'), { icon: 'down', kind: 'quiet', title: 'Descend' }),
              h('a', { class: 'textlink', href: GA.href('harmonize', { root, scale: id }) }, 'Chords in this scale →'))),
          neck: () => [
            U.opts(
              U.seg({ small: true, value: String(pos), fk: 'pos',
                options: [{ value: '-1', label: 'Whole neck' }].concat(positions.map((f, i) => ({ value: String(i), label: 'P' + (i + 1), title: 'Starting around fret ' + f }))),
                onChange: (v) => ctx.update({ pos: v === '-1' ? null : v }) }),
              U.seg({ small: true, value: colorBy, fk: 'col', options: [{ value: 'root', label: 'Root only' }, { value: 'iv', label: 'By interval' }], onChange: (v) => ctx.update({ color: v === 'iv' ? 'iv' : null }) }),
              U.seg({ small: true, value: GA.settings.get('labels'), fk: 'lbl', options: [{ value: 'notes', label: 'Notes' }, { value: 'intervals', label: 'Intervals' }], onChange: (v) => GA.settings.set('labels', v) })),
            R.fretboard({
              tuning, frets: N,
              highlightFrets: win,
              mark: (s, f, midi) => {
                const pc = midi % 12;
                if (!ivs.has(pc)) return null;
                const iv = ivs.get(pc);
                const inWin = !win || (f >= win[0] && f <= win[1]);
                const label = GA.settings.get('labels') === 'intervals' ? T.fmt(iv) : T.fmt(names.get(pc));
                const role = iv === '1' ? 'root' : colorBy === 'iv' ? T.ivRole(iv) : 'plain';
                return inWin ? { label, role } : { label: '', role: 'ghost' };
              },
              onCell: (s, f, midi) => { if (ivs.has(midi % 12)) A.pluck(midi); },
            }),
          ],
          related: () => (rel.length ? h('div', { class: 'related' }, rel.map((r) => h('a', { class: 'rel', href: GA.href('scales', { root: r.root, scale: r.id }) }, h('span', null, r.label), h('b', null, T.fmt(T.scale(r.root, r.id, U.pref()).rootName) + ' ' + T.SCALE_BY_ID[r.id].name)))) : null),
          modes: () => (modesOf(root, id).length ? h('div', { class: 'modes' }, modesOf(root, id).map((m) => {
            const ms = T.scale(m.rootPc, m.typeId, U.pref());
            return h('a', { class: 'mode', href: GA.href('scales', { root: m.rootPc, scale: m.typeId }) },
              h('span', { class: 'mode-deg' }, 'from degree ' + m.degree),
              h('span', { class: 'mode-name' }, T.fmt(ms.rootName) + ' ' + ms.type.name),
              h('span', { class: 'mode-notes' }, ms.names.map(T.fmt).join(' ')));
          })) : null),
          piano: () => R.piano({ pcs: sc.pcs, rootPc: root, names }),
        }, { neck: () => [pos >= 0 ? h('span', { class: 'block-aside' }, 'Position ' + (pos + 1)) : null, U.optsButton()] }),
      );
    },
  });
})();
