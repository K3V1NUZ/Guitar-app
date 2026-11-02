(function () {
  'use strict';
  const GA = window.GA, U = GA.UI, A = GA.Audio;
  const h = U.h;

  const st = Object.assign({ bpm: 100, beats: 4, sub: 1, accent: true, ramp: false, rampBy: 5, rampEvery: 4, rampMax: 160 }, U.storage.get('metro', {}));
  const save = () => U.storage.set('metro', st);
  let run = null;
  const taps = [];

  GA.views.push({
    id: 'metronome',
    num: '11',
    group: 'Play',
    title: 'Metronome',
    blurb: 'Rock-steady clicks with accents, subdivisions, tap tempo and a speed trainer that ramps up as you play.',
    keywords: 'tempo bpm click timing practice speed trainer tap',
    render(el) {
      const bpmEl = h('div', { class: 'mt-bpm' }, String(st.bpm));
      const nameEl = h('div', { class: 'mt-name' }, tempoName(st.bpm));
      const dotsEl = h('div', { class: 'mt-dots' });
      const barEl = h('div', { class: 'mt-bar mono' }, '');
      const slider = h('input', { type: 'range', class: 'range mt-slider', min: 30, max: 260, value: st.bpm, 'aria-label': 'Tempo', oninput: (e) => setBpm(+e.target.value) });

      function drawDots(active) {
        dotsEl.replaceChildren(...[...Array(st.beats).keys()].map((i) => h('span', { class: ['mt-dot', i === 0 && st.accent ? 'acc' : '', i === active ? 'on' : ''] })));
      }
      function setBpm(v) {
        st.bpm = Math.max(30, Math.min(260, Math.round(v)));
        bpmEl.textContent = String(st.bpm);
        nameEl.textContent = tempoName(st.bpm);
        slider.value = st.bpm;
        save();
      }
      function start() {
        const c = A.context();
        if (!c) return;
        let next = c.currentTime + 0.06, tick = 0, bars = 0;
        run = { timer: null };
        const loop = () => {
          while (next < c.currentTime + 0.12) {
            const per = st.sub;
            const beat = Math.floor(tick / per) % st.beats;
            const isBeat = tick % per === 0;
            A.click(next, isBeat ? (beat === 0 && st.accent ? 2 : 1) : 0);
            if (isBeat) {
              const delay = Math.max(0, (next - c.currentTime) * 1000);
              const b = beat;
              setTimeout(() => { if (run) drawDots(b); }, delay);
              if (beat === st.beats - 1 && tick % per === 0) {
                // end of bar after this beat
              }
            }
            tick++;
            if (tick % (per * st.beats) === 0) {
              bars++;
              barEl.textContent = 'bar ' + (bars + 1);
              if (st.ramp && bars % st.rampEvery === 0 && st.bpm < st.rampMax) setBpm(Math.min(st.rampMax, st.bpm + st.rampBy));
            }
            next += 60 / st.bpm / per;
          }
        };
        run.timer = setInterval(loop, 25);
        loop();
        playBtn.replaceChildren(U.icon('stop', 22), h('span', null, 'Stop'));
        playBtn.classList.add('running');
      }
      function stop() {
        if (run) clearInterval(run.timer);
        run = null;
        drawDots(-1);
        barEl.textContent = '';
        playBtn.replaceChildren(U.icon('play', 22), h('span', null, 'Start'));
        playBtn.classList.remove('running');
      }
      const playBtn = h('button', { type: 'button', class: 'btn btn-primary mt-play', onclick: () => (run ? stop() : start()) }, U.icon('play', 22), h('span', null, 'Start'));
      const tap = () => {
        const now = performance.now();
        if (taps.length && now - taps[taps.length - 1] > 2000) taps.length = 0;
        taps.push(now);
        if (taps.length > 6) taps.shift();
        if (taps.length >= 2) {
          const d = (taps[taps.length - 1] - taps[0]) / (taps.length - 1);
          setBpm(60000 / d);
        }
      };
      const onKey = (e) => {
        if (/INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)) return;
        if (e.code === 'Space') { e.preventDefault(); run ? stop() : start(); }
        else if (e.key === 't' || e.key === 'T') tap();
        else if (e.key === 'ArrowUp') { e.preventDefault(); setBpm(st.bpm + 1); }
        else if (e.key === 'ArrowDown') { e.preventDefault(); setBpm(st.bpm - 1); }
      };
      document.addEventListener('keydown', onKey);

      const opt = (label, node) => h('div', { class: 'field' }, h('div', { class: 'label' }, label), node);
      const segs = () => [
        opt('Beats per bar', h('div', { class: 'seg seg-s' }, [2, 3, 4, 5, 6, 7].map((b) => h('button', { type: 'button', class: st.beats === b ? 'on' : '', onclick: (e) => { st.beats = b; save(); drawDots(-1); markOn(e.target); } }, String(b))))),
        opt('Subdivision', h('div', { class: 'seg seg-s' }, [[1, '♩'], [2, '♪♪'], [3, '3'], [4, '♬♬']].map(([v, l]) => h('button', { type: 'button', class: st.sub === v ? 'on' : '', title: ['', 'Quarters', 'Eighths', 'Triplets', 'Sixteenths'][v], onclick: (e) => { st.sub = v; save(); markOn(e.target); } }, l)))),
      ];
      function markOn(btn) { btn.parentNode.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b === btn)); }

      drawDots(-1);
      U.mount(el, 
        U.pageHead(this),
        h('div', { class: 'mt-grid' },
          h('div', { class: 'mt-main' },
            h('div', { class: 'mt-readout' },
              h('button', { type: 'button', class: 'iconbtn mt-step', 'aria-label': 'Slower', onclick: () => setBpm(st.bpm - 1) }, '−'),
              h('div', null, bpmEl, h('div', { class: 'mt-unit' }, 'BPM · ', nameEl)),
              h('button', { type: 'button', class: 'iconbtn mt-step', 'aria-label': 'Faster', onclick: () => setBpm(st.bpm + 1) }, '+')),
            slider,
            dotsEl,
            h('div', { class: 'ch-actions center' }, playBtn, U.button('Tap tempo', tap, { kind: 'ghost' })),
            barEl,
            h('p', { class: 'note center' }, h('kbd', null, 'Space'), ' start/stop · ', h('kbd', null, 'T'), ' tap · ', h('kbd', null, '↑'), h('kbd', null, '↓'), ' tempo')),
          h('div', { class: 'mt-side' },
            segs(),
            U.toggle({ label: 'Accent the first beat', checked: st.accent, onChange: (v) => { st.accent = v; save(); drawDots(-1); } }),
            h('div', { class: 'mt-ramp' },
              U.toggle({ label: 'Speed trainer', checked: st.ramp, onChange: (v) => { st.ramp = v; save(); } }),
              h('div', { class: 'mt-ramp-row' },
                'Add ', h('input', { type: 'number', class: 'textin num', min: 1, max: 20, value: st.rampBy, onchange: (e) => { st.rampBy = +e.target.value || 5; save(); } }),
                ' BPM every ', h('input', { type: 'number', class: 'textin num', min: 1, max: 32, value: st.rampEvery, onchange: (e) => { st.rampEvery = +e.target.value || 4; save(); } }),
                ' bars, up to ', h('input', { type: 'number', class: 'textin num', min: 40, max: 260, value: st.rampMax, onchange: (e) => { st.rampMax = +e.target.value || 160; save(); } })),
            ),
            h('div', { class: 'mt-presets' }, h('div', { class: 'label' }, 'Quick tempos'),
              h('div', { class: 'chips' }, [60, 72, 80, 92, 100, 120, 140, 160].map((b) => h('button', { type: 'button', class: 'chip', onclick: () => setBpm(b) }, String(b))))))),
      );
      return () => { stop(); document.removeEventListener('keydown', onKey); };
    },
  });

  function tempoName(b) {
    if (b < 40) return 'Grave'; if (b < 60) return 'Largo'; if (b < 66) return 'Larghetto'; if (b < 76) return 'Adagio';
    if (b < 108) return 'Andante'; if (b < 120) return 'Moderato'; if (b < 156) return 'Allegro'; if (b < 176) return 'Vivace';
    if (b < 200) return 'Presto'; return 'Prestissimo';
  }
})();
