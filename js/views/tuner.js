(function () {
  'use strict';
  const GA = window.GA, T = GA.Theory, U = GA.UI, A = GA.Audio;
  const h = U.h, s = U.s;

  GA.views.push({
    id: 'tuner',
    num: '10',
    group: 'Play',
    title: 'Tuner',
    short: 'Microphone tuner and reference tones.',
    blurb: 'A chromatic tuner using your microphone, plus reference tones for every string of your tuning.',
    keywords: 'tune tuning microphone pitch reference tone',
    render(el) {
      const tuning = GA.settings.tuning();
      let a4 = U.storage.get('a4', 440);
      let stopMic = null, stopTone = null, toneIdx = -1;
      const hist = [];

      const noteEl = h('div', { class: 'tn-note' }, '–');
      const octEl = h('span', { class: 'tn-oct' }, '');
      const freqEl = h('div', { class: 'tn-freq mono' }, 'Start the tuner and play a string');
      const centsEl = h('div', { class: 'tn-cents mono' }, '');
      const needle = s('line', { class: 'tn-needle', x1: 150, y1: 160, x2: 150, y2: 34 });
      const ticks = [];
      for (let c = -50; c <= 50; c += 5) {
        const a = (c / 50) * (Math.PI / 3);
        const r1 = c % 25 === 0 ? 112 : 120, r2 = 130;
        ticks.push(s('line', { class: 'tn-tick' + (c === 0 ? ' zero' : ''), x1: 150 + r1 * Math.sin(a), y1: 160 - r1 * Math.cos(a), x2: 150 + r2 * Math.sin(a), y2: 160 - r2 * Math.cos(a) }));
      }
      const labels = [-50, -25, 0, 25, 50].map((c) => {
        const a = (c / 50) * (Math.PI / 3);
        return s('text', { class: 'tn-lab', x: 150 + 145 * Math.sin(a), y: 164 - 145 * Math.cos(a), 'text-anchor': 'middle' }, c > 0 ? '+' + c : String(c));
      });
      const gauge = s('svg', { class: 'tn-gauge', viewBox: '0 0 300 180' },
        s('path', { class: 'tn-arc', d: `M${150 - 130 * Math.sin(Math.PI / 3)} ${160 - 130 * Math.cos(Math.PI / 3)} A130 130 0 0 1 ${150 + 130 * Math.sin(Math.PI / 3)} ${160 - 130 * Math.cos(Math.PI / 3)}` }),
        s('path', { class: 'tn-zone', d: `M${150 - 130 * Math.sin(Math.PI / 30)} ${160 - 130 * Math.cos(Math.PI / 30)} A130 130 0 0 1 ${150 + 130 * Math.sin(Math.PI / 30)} ${160 - 130 * Math.cos(Math.PI / 30)}` }),
        ticks, labels, needle, s('circle', { class: 'tn-hub', cx: 150, cy: 160, r: 7 }));
      const stringBtns = tuning.notes.map((m, i) => h('button', {
        type: 'button', class: 'tn-string', 'data-i': i,
        onclick: () => toggleTone(i),
      }, h('b', null, T.fmt(U.namePc(m))), h('span', null, String(Math.floor(m / 12) - 1))));

      function toggleTone(i) {
        if (stopTone) { stopTone(); stopTone = null; }
        stringBtns.forEach((b) => b.classList.remove('on'));
        if (toneIdx === i) { toneIdx = -1; return; }
        toneIdx = i;
        const m = tuning.notes[i];
        if (mode === 'pluck') { A.pluck(m); toneIdx = -1; return; }
        const offset = 12 * Math.log2(a4 / 440);
        stopTone = A.tone(m + offset);
        stringBtns[i].classList.add('on');
      }

      function update(r) {
        if (r.freq <= 0) {
          gaugeWrap.classList.add('idle');
          return;
        }
        hist.push(r.freq);
        if (hist.length > 5) hist.shift();
        const f = hist.slice().sort((x, y) => x - y)[Math.floor(hist.length / 2)];
        const midiF = 69 + 12 * Math.log2(f / a4);
        const midi = Math.round(midiF);
        const cents = Math.round((midiF - midi) * 100);
        gaugeWrap.classList.remove('idle');
        noteEl.textContent = T.fmt(U.namePc(midi));
        octEl.textContent = String(Math.floor(midi / 12) - 1);
        freqEl.textContent = f.toFixed(1) + ' Hz';
        centsEl.textContent = (cents > 0 ? '+' : '') + cents + ' ¢';
        const ang = (Math.max(-50, Math.min(50, cents)) / 50) * 60;
        needle.setAttribute('transform', `rotate(${ang} 150 160)`);
        gaugeWrap.classList.toggle('intune', Math.abs(cents) <= 4);
        gaugeWrap.classList.toggle('sharp', cents > 4);
        gaugeWrap.classList.toggle('flat', cents < -4);
        // nearest string
        let best = -1, bd = Infinity;
        tuning.notes.forEach((m, i) => { const d = Math.abs(midiF - m); if (d < bd) { bd = d; best = i; } });
        stringBtns.forEach((b, i) => b.classList.toggle('near', i === best && bd < 1.5));
      }

      const micBtn = U.button('Start tuner', async () => {
        if (stopMic) { stopMic(); stopMic = null; micBtn.replaceChildren(U.icon('mic'), h('span', null, 'Start tuner')); gaugeWrap.classList.add('idle'); return; }
        try {
          stopMic = await A.listen(update);
          micBtn.replaceChildren(U.icon('stop'), h('span', null, 'Stop tuner'));
          freqEl.textContent = 'Listening…';
        } catch (e) {
          freqEl.textContent = 'Microphone unavailable: ' + (e.message || e.name);
        }
      }, { kind: 'primary', icon: 'mic' });

      let mode = 'tone';
      const gaugeWrap = h('div', { class: 'tn-wrap idle' }, gauge, h('div', { class: 'tn-read' }, h('div', { class: 'tn-name' }, noteEl, octEl), centsEl, freqEl));

      U.mount(el, 
        U.pageHead(this),
        h('div', { class: 'tn-grid' },
          h('div', { class: 'tn-main' }, gaugeWrap, h('div', { class: 'ch-actions center' }, micBtn)),
          h('div', { class: 'tn-side' },
            h('div', { class: 'label' }, 'Reference — ' + tuning.name),
            h('div', { class: 'tn-strings' }, stringBtns),
            U.seg({ small: true, value: mode, fk: 'tmode', options: [{ value: 'tone', label: 'Sustained tone' }, { value: 'pluck', label: 'Plucked' }], onChange: (v) => { mode = v; if (stopTone) toggleTone(toneIdx); el.querySelectorAll('[data-fk^="tmode"]').forEach((b) => b.classList.toggle('on', b.dataset.fk === 'tmode' + v)); } }),
            h('label', { class: 'field' }, h('span', { class: 'label' }, 'Calibration (A4)'),
              h('span', { class: 'inline' }, h('input', { type: 'number', class: 'textin num', min: 415, max: 466, value: a4, onchange: (e) => { a4 = Math.max(415, Math.min(466, +e.target.value || 440)); U.storage.set('a4', a4); } }), ' Hz')),
            h('p', { class: 'note' }, 'Change the tuning in Settings to get reference tones for drop, open or other instrument tunings. Microphone audio never leaves your device.'))),
      );
      return () => { if (stopMic) stopMic(); if (stopTone) stopTone(); };
    },
  });
})();
