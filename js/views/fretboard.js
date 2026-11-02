(function () {
  'use strict';
  const GA = window.GA, T = GA.Theory, U = GA.UI, R = GA.Render, A = GA.Audio;
  const h = U.h;

  let quiz = null; // { s, f, answer, score, total, streak, feedback }

  GA.views.push({
    id: 'fretboard',
    num: '08',
    group: 'Connect',
    title: 'Fretboard Map',
    short: 'Learn where every note lives.',
    blurb: 'Learn the neck: every note, interval maps from any root, and a note-finding quiz.',
    keywords: 'notes on the neck learn fretboard intervals quiz memorise',
    render(el, p, ctx) {
      const tuning = GA.settings.tuning().notes;
      const N = GA.settings.get('frets');
      const mode = ['notes', 'intervals', 'quiz'].includes(p.m) ? p.m : 'notes';
      const focus = p.n != null && p.n !== '' ? +p.n : null;
      const root = p.root != null ? +p.root : 4;
      const naturalsOnly = p.nat === '1';

      let body;
      if (mode === 'notes') {
        body = [
          h('div', { class: 'controls-row' },
            U.toggle({ label: 'Natural notes only', checked: naturalsOnly, fk: 'nat', onChange: (v) => ctx.update({ nat: v ? '1' : null }) }),
            h('span', { class: 'hint' }, 'Pick a note to find it everywhere:')),
          U.noteToggles({ selected: new Set(focus != null ? [focus] : []), rootPc: focus, onToggle: (pc) => ctx.update({ n: focus === pc ? null : pc }) }),
          R.fretboard({
            tuning, frets: N,
            mark: (s, f, midi) => {
              const pc = midi % 12;
              if (naturalsOnly && T.isBlack(pc)) return null;
              if (focus != null) return pc === focus ? { label: T.fmt(U.namePc(pc)), role: 'root' } : null;
              return { label: T.fmt(U.namePc(pc)), role: T.isBlack(pc) ? 'faint' : 'plain' };
            },
            onCell: (s, f, midi) => A.pluck(midi),
          }),
          focus != null ? h('p', { class: 'note' }, 'Octave shapes: the same note sits two strings up and two frets over (three frets across the G–B pair in standard tuning).') : null,
        ];
      } else if (mode === 'intervals') {
        body = [
          U.rootPicker({ value: root, onChange: (v) => ctx.update({ root: v }) }),
          R.fretboard({
            tuning, frets: N,
            mark: (s, f, midi) => {
              const d = T.mod(midi - root);
              const iv = T.SEMI_SHORT[d];
              return { label: T.fmt(iv), role: d === 0 ? 'root' : [3, 4].includes(d) ? 'third' : d === 7 ? 'fifth' : [10, 11].includes(d) ? 'seventh' : 'faint' };
            },
            onCell: (s, f, midi) => { A.pluck(48 + root + (root < 4 ? 12 : 0)); A.pluck(midi, 0.45); },
          }),
          h('div', { class: 'ivtable' }, T.SEMI_LONG.map((nm, i) => h('div', { class: 'ivrow' }, h('b', null, T.fmt(T.SEMI_SHORT[i])), h('span', null, nm), h('span', { class: 'mono muted' }, i + ' st')))),
        ];
      } else {
        if (!quiz) quiz = { score: 0, total: 0, streak: 0, best: U.storage.get('quizBest', 0) };
        const fresh = () => {
          const s = Math.floor(Math.random() * tuning.length);
          const f = Math.floor(Math.random() * (Math.min(N, 12) + 1));
          quiz.s = s; quiz.f = f; quiz.answer = (tuning[s] + f) % 12; quiz.feedback = null;
        };
        if (quiz.s == null || quiz.s >= tuning.length) fresh();
        const answer = (pc) => {
          quiz.total++;
          const ok = pc === quiz.answer;
          if (ok) { quiz.score++; quiz.streak++; quiz.best = Math.max(quiz.best, quiz.streak); U.storage.set('quizBest', quiz.best); A.pluck(tuning[quiz.s] + quiz.f); }
          else quiz.streak = 0;
          quiz.feedback = { ok, pc, correct: quiz.answer };
          GA.rerender();
          setTimeout(() => { if (GA.views && location.hash.includes('m=quiz')) { fresh(); GA.rerender(); } }, ok ? 650 : 1500);
        };
        body = [
          h('div', { class: 'quizbar' },
            h('div', { class: 'qstat' }, h('span', { class: 'label' }, 'Score'), h('b', null, quiz.score + ' / ' + quiz.total)),
            h('div', { class: 'qstat' }, h('span', { class: 'label' }, 'Streak'), h('b', null, String(quiz.streak))),
            h('div', { class: 'qstat' }, h('span', { class: 'label' }, 'Best streak'), h('b', null, String(quiz.best))),
            h('div', { class: 'qprompt' + (quiz.feedback ? (quiz.feedback.ok ? ' ok' : ' bad') : '') },
              quiz.feedback ? (quiz.feedback.ok ? 'Correct — ' + T.fmt(U.namePc(quiz.feedback.correct)) : 'It was ' + T.fmt(U.namePc(quiz.feedback.correct))) : 'Which note is marked?')),
          R.fretboard({
            tuning, frets: Math.min(N, 12),
            mark: (s, f) => (s === quiz.s && f === quiz.f ? { label: quiz.feedback ? T.fmt(U.namePc(quiz.answer)) : '?', role: quiz.feedback ? (quiz.feedback.ok ? 'third' : 'root') : 'quiz' } : null),
          }),
          h('div', { class: 'quizkeys' }, [...Array(12).keys()].map((pc) => h('button', {
            type: 'button', class: ['nt', T.isBlack(pc) ? 'nt-b' : '', quiz.feedback && pc === quiz.feedback.correct ? 'on' : '', quiz.feedback && !quiz.feedback.ok && pc === quiz.feedback.pc ? 'wrong' : ''],
            disabled: !!quiz.feedback, 'data-fk': 'q' + pc, onclick: () => answer(pc),
          }, T.fmt(T.isBlack(pc) ? T.SHARP[pc] + '/' + T.FLAT[pc] : T.SHARP[pc])))),
          h('div', { class: 'controls-row' }, U.button('Reset score', () => { quiz = null; GA.rerender(); }, { kind: 'ghost' }), h('span', { class: 'hint' }, 'Frets 0–12 on all strings.')),
        ];
      }

      U.mount(el, 
        U.pageHead(this),
        h('div', { class: 'controls' }, U.seg({ value: mode, fk: 'mode', options: [{ value: 'notes', label: 'Notes' }, { value: 'intervals', label: 'Interval map' }, { value: 'quiz', label: 'Quiz' }], onChange: (v) => ctx.update({ m: v === 'notes' ? null : v }) })),
        h('div', { class: 'fbview' }, body),
      );
    },
  });
})();
