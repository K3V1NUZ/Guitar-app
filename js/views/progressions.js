(function () {
  'use strict';
  const GA = window.GA, T = GA.Theory, U = GA.UI, R = GA.Render, V = GA.Voicings, A = GA.Audio;
  const h = U.h;
  const MAJOR = [0, 2, 4, 5, 7, 9, 11];
  const MINOR = [0, 2, 3, 5, 7, 8, 10];

  // token: { d: degree 0-6, o: semitones from tonic, t: chord type }
  const tk = (d, o, t) => ({ d, o, t });
  const PRESETS = {
    major: [
      ['Axis of awesome', 'I–V–vi–IV', [tk(0, 0, 'maj'), tk(4, 7, 'maj'), tk(5, 9, 'min'), tk(3, 5, 'maj')]],
      ['Fifties doo‑wop', 'I–vi–IV–V', [tk(0, 0, 'maj'), tk(5, 9, 'min'), tk(3, 5, 'maj'), tk(4, 7, 'maj')]],
      ['Jazz turnaround', 'ii7–V7–Imaj7', [tk(1, 2, 'm7'), tk(4, 7, '7'), tk(0, 0, 'maj7'), tk(0, 0, 'maj7')]],
      ['Rhythm changes', 'I–vi–ii–V', [tk(0, 0, 'maj7'), tk(5, 9, 'm7'), tk(1, 2, 'm7'), tk(4, 7, '7')]],
      ['Canon', 'I–V–vi–iii–IV–I–IV–V', [tk(0, 0, 'maj'), tk(4, 7, 'maj'), tk(5, 9, 'min'), tk(2, 4, 'min'), tk(3, 5, 'maj'), tk(0, 0, 'maj'), tk(3, 5, 'maj'), tk(4, 7, 'maj')]],
      ['Mixolydian rock', 'I–♭VII–IV–I', [tk(0, 0, 'maj'), tk(6, 10, 'maj'), tk(3, 5, 'maj'), tk(0, 0, 'maj')]],
      ['Royal road', 'IV–V–iii–vi', [tk(3, 5, 'maj7'), tk(4, 7, '7'), tk(2, 4, 'm7'), tk(5, 9, 'min')]],
      ['12‑bar blues', 'I7 ×4, IV7 ×2, I7 ×2, V7–IV7–I7–V7', [0, 0, 0, 0, 3, 3, 0, 0, 4, 3, 0, 4].map((d) => tk(d, MAJOR[d], '7'))],
    ],
    minor: [
      ['Andalusian cadence', 'i–♭VII–♭VI–V', [tk(0, 0, 'min'), tk(6, 10, 'maj'), tk(5, 8, 'maj'), tk(4, 7, 'maj')]],
      ['Epic minor', 'i–♭VI–♭III–♭VII', [tk(0, 0, 'min'), tk(5, 8, 'maj'), tk(2, 3, 'maj'), tk(6, 10, 'maj')]],
      ['Minor blues', 'i–iv–v', [tk(0, 0, 'min'), tk(3, 5, 'min'), tk(4, 7, 'min'), tk(0, 0, 'min')]],
      ['Minor ii–V–i', 'iiø7–V7–i', [tk(1, 2, 'm7b5'), tk(4, 7, '7'), tk(0, 0, 'm7'), tk(0, 0, 'm7')]],
      ['Dorian vamp', 'i7–IV7', [tk(0, 0, 'm7'), tk(3, 5, '7')]],
      ['Stairway down', 'i–♭VII–♭VI–♭VII', [tk(0, 0, 'min'), tk(6, 10, 'maj'), tk(5, 8, 'maj'), tk(6, 10, 'maj')]],
    ],
  };

  const STRUMS = [
    { id: 'hold', name: 'One strum', beats: (b) => [[0, 'D']] },
    { id: 'quarters', name: 'Quarter notes', beats: (b) => [...Array(b).keys()].map((i) => [i, 'D']) },
    { id: 'folk', name: 'D · DU · UDU', beats: (b) => [[0, 'D'], [1, 'D'], [1.5, 'U'], [2.5, 'U'], [3, 'D'], [3.5, 'U']].filter((x) => x[0] < b) },
    { id: 'arp', name: 'Arpeggio', beats: (b) => [...Array(b * 2).keys()].map((i) => [i / 2, 'A' + i]) },
  ];

  const state = Object.assign({
    root: 0, mode: 'major', chords: PRESETS.major[0][2], bpm: 92, beats: 4, strum: 'folk', loop: true, close: true, saved: [],
  }, U.storage.get('prog', {}));
  const save = () => U.storage.set('prog', state);
  let player = null;
  let selected = -1;

  function chordAt(i) {
    const c = state.chords[i];
    const rootPc = T.mod(state.root + c.o);
    const base = (state.mode === 'minor' ? MINOR : MAJOR)[c.d];
    // roman numerals are written relative to the key (minor keys relative to natural minor)
    const majRef = c.o - base + MAJOR[c.d];
    const roman = T.romanFor(c.d, majRef + (state.mode === 'minor' ? base - MAJOR[c.d] : 0), c.t);
    return { rootPc, typeId: c.t, roman };
  }

  function voicingsFor() {
    const tuning = GA.settings.tuning().notes;
    let prev = null;
    return state.chords.map((c, i) => {
      const ch = chordAt(i);
      const list = V.generate(ch.rootPc, ch.typeId, tuning, { maxFret: 12 });
      if (!list.length) return null;
      let best = null, bs = Infinity;
      for (const v of list) {
        const sc = v.score + (state.close && prev ? Math.abs(v.minFret - prev.minFret) * 0.9 : 0);
        if (sc < bs) { bs = sc; best = v; }
      }
      prev = best;
      return best;
    });
  }

  function stop() {
    if (player) { clearInterval(player.timer); player = null; }
    A.stopAll();
    document.querySelectorAll('.pcard.playing').forEach((x) => x.classList.remove('playing'));
    const b = document.querySelector('[data-fk="pplay"]');
    if (b) b.replaceChildren(U.icon('play'), h('span', null, 'Play'));
  }

  function play(voicings) {
    stop();
    const c = A.context();
    if (!c || !state.chords.length) return;
    const spb = 60 / state.bpm;
    const pattern = STRUMS.find((s) => s.id === state.strum) || STRUMS[0];
    let bar = 0;
    let next = c.currentTime + 0.08;
    player = { timer: null };
    const schedule = () => {
      while (next < c.currentTime + 0.25) {
        const idx = bar % state.chords.length;
        if (!state.loop && bar >= state.chords.length) { setTimeout(stop, (next - c.currentTime) * 1000); clearInterval(player.timer); return; }
        const v = voicings[idx];
        const at = next - c.currentTime;
        if (v) {
          for (const [beat, kind] of pattern.beats(state.beats)) {
            const when = at + beat * spb;
            if (kind === 'D') A.strum(v.midis, { when, gain: beat % 1 === 0 && beat === 0 ? 0.55 : 0.42, duration: spb * (state.strum === 'hold' ? state.beats : 1) });
            else if (kind === 'U') A.strum(v.midis.slice(2), { when, up: true, gain: 0.3, gap: 0.018, duration: spb * 0.6 });
            else {
              const notes = v.midis.filter((m) => m != null);
              const k = +kind.slice(1);
              const order = [0, 2, 1, 3, notes.length - 1, 2, 1, 3];
              A.pluck(notes[Math.min(notes.length - 1, order[k % 8])], when, 0.5, { duration: spb * 1.5 });
            }
          }
        }
        const delay = Math.max(0, at * 1000);
        setTimeout(() => {
          document.querySelectorAll('.pcard').forEach((x, i) => x.classList.toggle('playing', i === idx));
        }, delay);
        next += spb * state.beats;
        bar++;
      }
    };
    player.timer = setInterval(schedule, 60);
    schedule();
    const b = document.querySelector('[data-fk="pplay"]');
    if (b) b.replaceChildren(U.icon('stop'), h('span', null, 'Stop'));
  }

  GA.views.push({
    id: 'progressions',
    num: '09',
    group: 'Play',
    title: 'Progression Builder',
    short: 'Write, transpose and play back.',
    blurb: 'Write chord progressions by Roman numeral, transpose them instantly and play them back with a strum pattern.',
    keywords: 'chord progression song writer playback loop backing',
    sections: [
      { id: 'progression', title: 'Progression' },
      { id: 'playback', title: 'Playback' },
      { id: 'add', title: 'Add a chord' },
      { id: 'saved', title: 'Saved progressions' },
    ],
    render(el, p) {
      if (p.root != null) { state.root = T.mod(+p.root); }
      if (p.scale === 'minor' || p.scale === 'major') {
        if (state.mode !== p.scale) state.chords = PRESETS[p.scale][0][2].slice();
        state.mode = p.scale;
      }
      if (p.root != null || p.scale) { save(); history.replaceState(null, '', GA.href('progressions')); }
      const view = this;

      const draw = () => {
        const tuning = GA.settings.tuning().notes;
        const harm = T.harmonize(state.root, state.mode === 'minor' ? 'minor' : 'major', U.pref());
        const voicings = voicingsFor();
        const keyName = harm.scale.rootName;
        const nameOf = (ch) => T.chord(ch.rootPc, ch.typeId, U.pref());
        const add = (t) => { state.chords.push(t); save(); draw(); const v = voicingsFor()[state.chords.length - 1]; v && A.strum(v.midis); };

        const semis = state.mode === 'minor' ? MINOR : MAJOR;
        const diatonic = harm.rows.map((r, i) => [tk(i, semis[i], r.triad.typeId), tk(i, semis[i], r.seventh.typeId)]);
        const borrowed = state.mode === 'major'
          ? [tk(6, 10, 'maj'), tk(3, 5, 'min'), tk(5, 8, 'maj'), tk(2, 3, 'maj'), tk(1, 2, '7'), tk(2, 4, '7'), tk(0, 0, '7'), tk(1, 1, 'maj')]
          : [tk(4, 7, 'maj'), tk(4, 7, '7'), tk(3, 5, 'maj'), tk(1, 1, 'maj'), tk(0, 0, 'mmaj7'), tk(6, 11, 'dim7')];
        const tokLabel = (t) => {
          const base = semis[t.d];
          const roman = T.romanFor(t.d, t.o - base + MAJOR[t.d] + (state.mode === 'minor' ? base - MAJOR[t.d] : 0), t.t);
          const ch = T.chord(state.root + t.o, t.t, U.pref());
          return [h('span', { class: 'roman' }, roman), h('span', null, T.fmt(ch.symbol))];
        };

        el.replaceChildren();
        U.mount(el,
          U.pageHead(view),
          h('div', { class: 'picker' },
            U.rootPicker({ value: state.root, onChange: (v) => { state.root = v; save(); stop(); draw(); } }),
            h('div', { class: 'controls-row center-row' },
              U.seg({ value: state.mode, fk: 'pmode', options: [{ value: 'major', label: 'Major' }, { value: 'minor', label: 'Minor' }], onChange: (v) => { state.mode = v; state.chords = PRESETS[v][0][2].slice(); save(); stop(); draw(); } }),
              U.select({ value: '', fk: 'preset', options: [{ value: '', label: 'Start from a classic…' }].concat(PRESETS[state.mode].map((x, i) => ({ value: i, label: x[0] + ' — ' + x[1] }))), onChange: (v) => { if (v === '') return; state.chords = PRESETS[state.mode][+v][2].slice(); save(); stop(); draw(); } }))),

          U.renderSections(view, {
            progression: () => [
              h('div', { class: 'prog-head' },
                h('h2', { class: 'sh-name' }, 'In ', h('span', { class: 'cn-root' }, T.fmt(keyName)), ' ', state.mode),
                U.button('Play', () => (player ? stop() : play(voicings)), { kind: 'primary', icon: 'play', fk: 'pplay' })),
          state.chords.length ? h('div', { class: 'progression' }, state.chords.map((c, i) => {
            const ch = chordAt(i);
            const nm = nameOf(ch);
            const v = voicings[i];
            return h('div', { class: ['pcard', selected === i ? 'sel' : ''] },
              h('div', { class: 'pcard-top' }, h('span', { class: 'pcard-n' }, String(i + 1).padStart(2, '0')), h('span', { class: 'roman' }, ch.roman)),
              h('button', { type: 'button', class: 'pcard-body', onclick: () => { selected = i; v && A.strum(v.midis); draw(); }, title: 'Strum' },
                U.chordName(nm.rootName, nm.type.sym),
                v ? R.chordDiagram(v, { rootPc: ch.rootPc, names: new Map(nm.pcs.map((x, k) => [x, nm.names[k]])), bottom: false }) : U.empty('no shape')),
              h('div', { class: 'pcard-tools' },
                h('button', { type: 'button', class: 'iconbtn sm', title: 'Move left', disabled: i === 0, onclick: () => { [state.chords[i - 1], state.chords[i]] = [state.chords[i], state.chords[i - 1]]; save(); draw(); } }, U.icon('left', 15)),
                h('button', { type: 'button', class: 'iconbtn sm', title: 'Duplicate', onclick: () => { state.chords.splice(i + 1, 0, Object.assign({}, c)); save(); draw(); } }, U.icon('copy', 15)),
                h('button', { type: 'button', class: 'iconbtn sm', title: 'Remove', onclick: () => { state.chords.splice(i, 1); save(); stop(); draw(); } }, U.icon('trash', 15)),
                h('button', { type: 'button', class: 'iconbtn sm', title: 'Move right', disabled: i === state.chords.length - 1, onclick: () => { [state.chords[i + 1], state.chords[i]] = [state.chords[i], state.chords[i + 1]]; save(); draw(); } }, U.icon('right', 15))));
          })) : U.empty('Empty. Add chords from the palette below or pick a classic progression.'),
          h('div', { class: 'controls-row' },
            U.button('Clear', () => { state.chords = []; save(); stop(); draw(); }, { kind: 'ghost', icon: 'trash' }),
            U.button('Copy as text', () => {
              const txt = state.chords.map((c, i) => nameOf(chordAt(i)).symbol).join(' | ');
              (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(() => U.toast('Copied: ' + txt), () => U.toast(txt));
            }, { kind: 'ghost', icon: 'copy' }),
            U.button('Save', () => {
              const name = prompt('Name this progression', state.chords.map((c, i) => chordAt(i).roman).join(' '));
              if (!name) return;
              state.saved.unshift({ name, root: state.root, mode: state.mode, chords: state.chords.slice() });
              save(); draw(); U.toast('Saved');
            }, { kind: 'ghost', icon: 'heart' })),
            ],
            playback: () =>
            h('div', { class: 'prog-transport' },
              h('label', { class: 'field field-inline' }, h('span', { class: 'label' }, 'BPM'),
                h('input', { type: 'number', min: 40, max: 220, value: state.bpm, class: 'textin num', 'data-fk': 'bpm', onchange: (e) => { state.bpm = Math.max(40, Math.min(220, +e.target.value || 90)); save(); if (player) play(voicings); } })),
              U.select({ label: 'Beats / chord', value: state.beats, fk: 'beats', options: [2, 3, 4, 8].map((b) => ({ value: b, label: String(b) })), onChange: (v) => { state.beats = +v; save(); if (player) play(voicings); } }),
              U.select({ label: 'Strum', value: state.strum, fk: 'strum', options: STRUMS.map((s) => ({ value: s.id, label: s.name })), onChange: (v) => { state.strum = v; save(); if (player) play(voicings); } }),
              U.toggle({ label: 'Loop', checked: state.loop, fk: 'loop', onChange: (v) => { state.loop = v; save(); } }),
              U.toggle({ label: 'Keep shapes close', checked: state.close, fk: 'close', onChange: (v) => { state.close = v; save(); draw(); } })),
            add: () => [
            h('div', { class: 'label' }, 'Diatonic'),
            h('div', { class: 'palette-grid' }, diatonic.map((pair) => h('div', { class: 'palette-col' }, pair.map((t) => h('button', { type: 'button', class: 'pchip', onclick: () => add(t) }, tokLabel(t)))))),
            h('div', { class: 'label' }, state.mode === 'major' ? 'Borrowed & secondary' : 'Harmonic & borrowed'),
            h('div', { class: 'chips' }, borrowed.map((t) => h('button', { type: 'button', class: 'pchip', onclick: () => add(t) }, tokLabel(t)))),
          ],
            saved: () => (state.saved.length ? h('div', { class: 'savedlist' }, state.saved.map((sv, i) => h('div', { class: 'saved' },
            h('button', { type: 'button', class: 'saved-load', onclick: () => { Object.assign(state, { root: sv.root, mode: sv.mode, chords: sv.chords.slice() }); save(); stop(); draw(); } },
              h('b', null, sv.name), h('span', null, T.fmt(T.scale(sv.root, sv.mode, U.pref()).rootName) + ' ' + sv.mode + ' · ' + sv.chords.length + ' chords')),
            h('button', { type: 'button', class: 'iconbtn sm', title: 'Delete', onclick: () => { state.saved.splice(i, 1); save(); draw(); } }, U.icon('trash', 15))))) : null),
          }),
        );
        if (player) { const b = el.querySelector('[data-fk="pplay"]'); if (b) b.replaceChildren(U.icon('stop'), h('span', null, 'Stop')); }
      };
      draw();
      return stop;
    },
  });
})();
