(function () {
  'use strict';
  const GA = window.GA, T = GA.Theory, U = GA.UI, A = GA.Audio;
  const h = U.h;

  const INTERVALS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) => ({ id: String(n), label: n === 12 ? 'Octave' : T.SEMI_LONG[n], short: n === 12 ? '8ve' : T.fmt(T.SEMI_SHORT[n]), semis: n }));
  const QUALITIES = ['maj', 'min', 'dim', 'aug', 'sus2', 'sus4', '7', 'maj7', 'm7', 'm7b5', 'dim7', '6', 'm6', '9'].map((id) => ({ id, label: T.CHORD_BY_ID[id].name, short: T.CHORD_BY_ID[id].sym ? T.fmt(T.CHORD_BY_ID[id].sym) : 'maj' }));
  const SCALEQ = ['major', 'minor', 'dorian', 'phrygian', 'lydian', 'mixolydian', 'locrian', 'harmminor', 'melminor', 'majpent', 'minpent', 'blues'].map((id) => ({ id, label: T.SCALE_BY_ID[id].name, short: T.SCALE_BY_ID[id].name.replace(/\s*\(.*\)/, '') }));
  const SETS = { intervals: INTERVALS, chords: QUALITIES, scales: SCALEQ };
  const DEFAULT_ON = { intervals: ['3', '4', '5', '7', '12'], chords: ['maj', 'min', 'dim', 'aug'], scales: ['major', 'minor', 'dorian', 'mixolydian'] };

  const st = Object.assign({ kind: 'intervals', dir: 'up', on: DEFAULT_ON }, U.storage.get('ear', {}));
  st.on = Object.assign({}, DEFAULT_ON, st.on);
  let q = null; // current question
  const score = { right: 0, total: 0, streak: 0 };

  function newQuestion() {
    const pool = SETS[st.kind].filter((x) => st.on[st.kind].includes(x.id));
    if (!pool.length) return null;
    const item = pool[Math.floor(Math.random() * pool.length)];
    const base = 48 + Math.floor(Math.random() * 12);
    q = { item, base, answered: null };
    return q;
  }
  function playQ() {
    if (!q) return;
    const { item, base } = q;
    if (st.kind === 'intervals') {
      const a = base, b = base + item.semis;
      if (st.dir === 'up') { A.pluck(a, 0, 0.6, { duration: 1.1 }); A.pluck(b, 0.7, 0.6, { duration: 1.4 }); }
      else if (st.dir === 'down') { A.pluck(b, 0, 0.6, { duration: 1.1 }); A.pluck(a, 0.7, 0.6, { duration: 1.4 }); }
      else { A.pluck(a, 0, 0.5); A.pluck(b, 0, 0.5); }
    } else if (st.kind === 'chords') {
      const t = T.CHORD_BY_ID[item.id];
      const notes = t.intervals.map((iv) => base + T.IV[iv][0]);
      if (st.dir === 'harm') A.strum(notes, { gap: 0.02 });
      else { A.sequence(notes, { step: 0.28 }); A.strum(notes, { when: notes.length * 0.28 + 0.2, gap: 0.03 }); }
    } else {
      const s = T.SCALE_BY_ID[item.id];
      const notes = s.pcs.map((x) => base + x).concat([base + 12]);
      A.strum([base - 12, base - 5, base], { gap: 0.02, gain: 0.35 });
      A.sequence(st.dir === 'down' ? notes.reverse() : notes, { step: 0.26, when: 0.8 });
    }
  }

  GA.views.push({
    id: 'ear',
    num: '13',
    group: 'Play',
    title: 'Ear Trainer',
    short: 'Hear it, name it.',
    blurb: 'Hear it, name it: intervals, chord qualities and modes, with your own selection of what to practise.',
    keywords: 'ear training intervals chord quality quiz listening',
    render(el, p, ctx) {
      const pool = SETS[st.kind];
      const save = () => U.storage.set('ear', { kind: st.kind, dir: st.dir, on: st.on });
      if (!q || !pool.includes(q.item)) newQuestion();

      const answer = (item) => {
        if (!q || q.answered) return;
        q.answered = item;
        score.total++;
        if (item === q.item) { score.right++; score.streak++; } else score.streak = 0;
        GA.rerender();
      };
      const next = () => { newQuestion(); GA.rerender(); setTimeout(playQ, 60); };

      const dirOpts = st.kind === 'intervals'
        ? [{ value: 'up', label: 'Ascending' }, { value: 'down', label: 'Descending' }, { value: 'harm', label: 'Together' }]
        : st.kind === 'chords' ? [{ value: 'up', label: 'Arpeggio + chord' }, { value: 'harm', label: 'Chord only' }]
          : [{ value: 'up', label: 'Ascending' }, { value: 'down', label: 'Descending' }];
      if (!dirOpts.find((o) => o.value === st.dir)) st.dir = dirOpts[0].value;

      U.mount(el, 
        U.pageHead(this),
        h('div', { class: 'controls' },
          h('div', { class: 'controls-row' },
            U.seg({ label: 'Practise', value: st.kind, fk: 'ek', options: [{ value: 'intervals', label: 'Intervals' }, { value: 'chords', label: 'Chord qualities' }, { value: 'scales', label: 'Scales & modes' }], onChange: (v) => { st.kind = v; save(); q = null; score.right = score.total = score.streak = 0; GA.rerender(); } }),
            U.seg({ label: 'Playback', value: st.dir, fk: 'ed', options: dirOpts, onChange: (v) => { st.dir = v; save(); GA.rerender(); } })),
          h('div', { class: 'field' }, h('div', { class: 'label' }, 'Include'),
            h('div', { class: 'chips' }, pool.map((it) => h('button', {
              type: 'button', class: ['chip', st.on[st.kind].includes(it.id) ? 'on' : ''], title: it.label, 'data-fk': 'inc' + it.id,
              onclick: () => {
                const list = st.on[st.kind];
                const i = list.indexOf(it.id);
                if (i >= 0) { if (list.length > 2) list.splice(i, 1); } else list.push(it.id);
                save(); if (q && !list.includes(q.item.id)) newQuestion(); GA.rerender();
              },
            }, it.short))))),
        h('div', { class: 'ear-stage' },
          h('div', { class: 'ear-score' },
            h('div', { class: 'qstat' }, h('span', { class: 'label' }, 'Correct'), h('b', null, score.right + ' / ' + score.total)),
            h('div', { class: 'qstat' }, h('span', { class: 'label' }, 'Accuracy'), h('b', null, score.total ? Math.round((score.right / score.total) * 100) + '%' : '—')),
            h('div', { class: 'qstat' }, h('span', { class: 'label' }, 'Streak'), h('b', null, String(score.streak)))),
          h('div', { class: 'ear-play' },
            h('button', { type: 'button', class: 'ear-big', onclick: playQ, 'data-fk': 'eplay', 'aria-label': 'Play the question' }, U.icon('play', 34)),
            h('div', { class: 'ear-prompt' + (q && q.answered ? (q.answered === q.item ? ' ok' : ' bad') : '') },
              !q ? 'Choose at least two options.' : !q.answered ? 'Listen, then choose.' : q.answered === q.item ? 'Yes — ' + q.item.label : 'No — it was ' + q.item.label),
            q && q.answered ? U.button('Next', next, { kind: 'primary', icon: 'right', fk: 'enext' }) : U.button('Replay', playQ, { kind: 'ghost', icon: 'loop' })),
          h('div', { class: 'ear-answers' }, pool.filter((it) => st.on[st.kind].includes(it.id)).map((it) => h('button', {
            type: 'button', 'data-fk': 'ans' + it.id,
            class: ['ear-ans', q && q.answered && it === q.item ? 'right' : '', q && q.answered === it && it !== q.item ? 'wrong' : ''],
            onclick: () => answer(it), disabled: !!(q && q.answered),
          }, h('b', null, it.short), h('span', null, it.label))))),
        h('p', { class: 'note center' }, 'Tip: sing the interval back before answering — it trains recall, not just recognition.'),
      );
    },
  });
})();
