/* Fretbook — audio: Karplus–Strong plucked strings, clicks, and pitch detection.
 * Everything is synthesised in the browser; no samples, works offline.
 */
(function (root) {
  'use strict';
  const GA = (root.GA = root.GA || {});
  const A = (GA.Audio = {});
  let ctx = null, master = null, out = null;
  const buffers = new Map();
  const live = new Set();
  let volume = 0.8;

  A.context = function () {
    if (!ctx) {
      const AC = root.AudioContext || root.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC({ latencyHint: 'interactive' });
      master = ctx.createGain();
      master.gain.value = volume;
      const body = ctx.createBiquadFilter();
      body.type = 'peaking'; body.frequency.value = 190; body.Q.value = 1.1; body.gain.value = 5;
      const air = ctx.createBiquadFilter();
      air.type = 'highshelf'; air.frequency.value = 3800; air.gain.value = -5;
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -16; comp.ratio.value = 3; comp.attack.value = 0.004; comp.release.value = 0.25;
      master.connect(body); body.connect(air); air.connect(comp); comp.connect(ctx.destination);
      out = master;
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  };

  A.setVolume = function (v) {
    volume = v;
    if (master) master.gain.setTargetAtTime(v, ctx.currentTime, 0.02);
  };

  function pluckBuffer(midi, bright) {
    const key = midi + ':' + bright;
    if (buffers.has(key)) return buffers.get(key);
    const sr = ctx.sampleRate;
    const f = 440 * Math.pow(2, (midi - 69) / 12);
    const N = Math.max(2, Math.floor(sr / f - 0.5));
    const actual = sr / (N + 0.5);
    const t60 = Math.max(1.1, 4.2 - (midi - 40) * 0.06);
    const dur = Math.min(3.2, t60 + 0.3);
    const len = Math.floor(sr * dur);
    const d = Math.pow(0.001, 1 / (t60 * actual));
    const y = new Float32Array(len);
    // excitation: filtered noise burst, with pick-position comb
    let lp = 0;
    const exc = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      lp += ((Math.random() * 2 - 1) - lp) * bright;
      exc[i] = lp;
    }
    const pick = Math.max(1, Math.floor(N * 0.13));
    let mean = 0;
    for (let i = 0; i < N; i++) { y[i] = exc[i] - 0.6 * exc[(i + pick) % N]; mean += y[i]; }
    mean /= N;
    for (let i = 0; i < N; i++) y[i] -= mean;
    for (let i = N + 1; i < len; i++) y[i] = d * 0.5 * (y[i - N] + y[i - N - 1]);
    // normalise and fade tail
    let peak = 0;
    for (let i = 0; i < len; i++) peak = Math.max(peak, Math.abs(y[i]));
    const fade = Math.floor(sr * 0.25);
    for (let i = 0; i < len; i++) {
      let g = 0.9 / (peak || 1);
      if (i > len - fade) g *= (len - i) / fade;
      y[i] *= g;
    }
    const buf = ctx.createBuffer(1, len, sr);
    buf.copyToChannel ? buf.copyToChannel(y, 0) : buf.getChannelData(0).set(y);
    const entry = { buf, rate: f / actual };
    buffers.set(key, entry);
    return entry;
  }

  /** Pluck a single MIDI note. when = seconds from now. */
  A.pluck = function (midi, when = 0, gain = 0.55, opts = {}) {
    if (!GA.settings || GA.settings.get('sound') === false) return;
    const c = A.context();
    if (!c || midi == null) return;
    const { buf, rate } = pluckBuffer(Math.round(midi), opts.bright || 0.55);
    const src = c.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = rate;
    const g = c.createGain();
    g.gain.value = gain;
    const pan = c.createStereoPanner ? c.createStereoPanner() : null;
    src.connect(g);
    if (pan) { pan.pan.value = opts.pan || 0; g.connect(pan); pan.connect(out); } else g.connect(out);
    const t = c.currentTime + Math.max(0, when);
    src.start(t);
    if (opts.duration) {
      g.gain.setValueAtTime(gain, t + opts.duration);
      g.gain.exponentialRampToValueAtTime(0.0001, t + opts.duration + 0.12);
      src.stop(t + opts.duration + 0.15);
    }
    live.add(src);
    src.onended = () => live.delete(src);
    return src;
  };

  /** Strum an array of MIDI notes (string order, nulls for muted). */
  A.strum = function (midis, opts = {}) {
    const list = midis.map((m, i) => ({ m, i })).filter((x) => x.m != null);
    if (opts.up) list.reverse();
    const gap = opts.gap != null ? opts.gap : 0.032;
    const n = list.length;
    list.forEach((x, k) => {
      const pan = n > 1 ? (x.i / (midis.length - 1) - 0.5) * 0.5 : 0;
      A.pluck(x.m, (opts.when || 0) + k * gap, (opts.gain || 0.5) * (1 - k * 0.03), { pan, duration: opts.duration });
    });
  };

  /** Play notes one after another. */
  A.sequence = function (midis, opts = {}) {
    const step = opts.step || 0.22;
    midis.forEach((m, i) => A.pluck(m, (opts.when || 0) + i * step, opts.gain || 0.55, { duration: opts.duration || step * 2.5 }));
    return midis.length * step;
  };

  A.stopAll = function () {
    for (const s of live) { try { s.stop(); } catch (e) { /* already stopped */ } }
    live.clear();
  };

  /** Metronome click at absolute context time t. */
  A.click = function (t, level = 1) {
    const c = A.context();
    if (!c) return;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = 'square';
    osc.frequency.value = level === 2 ? 1760 : level === 1 ? 1175 : 880;
    const peak = level === 2 ? 0.5 : level === 1 ? 0.32 : 0.18;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + 0.001);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.045);
    const hp = c.createBiquadFilter();
    hp.type = 'bandpass'; hp.frequency.value = osc.frequency.value; hp.Q.value = 2;
    osc.connect(hp); hp.connect(g); g.connect(c.destination);
    osc.start(t); osc.stop(t + 0.06);
  };

  /** Steady reference tone (for tuning by ear). Returns a stop function. */
  A.tone = function (midi) {
    const c = A.context();
    if (!c) return () => {};
    const f = 440 * Math.pow(2, (midi - 69) / 12);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.22 * volume, c.currentTime + 0.04);
    const oscs = [1, 2, 3].map((h, i) => {
      const o = c.createOscillator();
      o.type = i === 0 ? 'triangle' : 'sine';
      o.frequency.value = f * h;
      const og = c.createGain();
      og.gain.value = [1, 0.35, 0.12][i];
      o.connect(og); og.connect(g); o.start();
      return o;
    });
    g.connect(c.destination);
    return () => {
      const t = c.currentTime;
      g.gain.cancelScheduledValues(t);
      g.gain.setValueAtTime(g.gain.value, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
      oscs.forEach((o) => o.stop(t + 0.1));
    };
  };

  /* ---------- Pitch detection (tuner) ---------- */
  function detectPitch(buf, sr) {
    const SIZE = buf.length;
    let rms = 0;
    for (let i = 0; i < SIZE; i++) rms += buf[i] * buf[i];
    rms = Math.sqrt(rms / SIZE);
    if (rms < 0.008) return { freq: -1, rms };
    const minLag = Math.floor(sr / 1400);
    const maxLag = Math.min(Math.floor(sr / 50), SIZE >> 1);
    const W = SIZE - maxLag;
    // normalised square difference (McLeod style)
    const nsdf = new Float32Array(maxLag + 1);
    for (let lag = minLag; lag <= maxLag; lag++) {
      let acf = 0, m = 0;
      for (let i = 0; i < W; i++) {
        const a = buf[i], b = buf[i + lag];
        acf += a * b;
        m += a * a + b * b;
      }
      nsdf[lag] = m ? (2 * acf) / m : 0;
    }
    // pick first peak above threshold of global max
    let gmax = 0;
    for (let l = minLag; l <= maxLag; l++) if (nsdf[l] > gmax) gmax = nsdf[l];
    if (gmax < 0.5) return { freq: -1, rms };
    const thr = gmax * 0.88;
    let lag = -1;
    for (let l = minLag + 1; l < maxLag; l++) {
      if (nsdf[l] > thr && nsdf[l] >= nsdf[l - 1] && nsdf[l] >= nsdf[l + 1]) { lag = l; break; }
    }
    if (lag < 0) return { freq: -1, rms };
    const a = nsdf[lag - 1], b = nsdf[lag], c = nsdf[lag + 1];
    const shift = (a - c) / (2 * (a - 2 * b + c) || 1);
    return { freq: sr / (lag + (isFinite(shift) ? shift : 0)), rms, clarity: b };
  }
  A.detectPitch = detectPitch;

  /** Start listening to the microphone. cb({freq, rms}) ~25x per second. Returns stop(). */
  A.listen = async function (cb) {
    const c = A.context();
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error('Microphone not available in this browser.');
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    });
    const src = c.createMediaStreamSource(stream);
    const an = c.createAnalyser();
    an.fftSize = 4096;
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 1500;
    src.connect(lp); lp.connect(an);
    const buf = new Float32Array(an.fftSize);
    let stopped = false;
    const tick = () => {
      if (stopped) return;
      an.getFloatTimeDomainData(buf);
      cb(detectPitch(buf, c.sampleRate));
      setTimeout(tick, 40);
    };
    tick();
    return () => {
      stopped = true;
      stream.getTracks().forEach((t) => t.stop());
      src.disconnect();
    };
  };
})(typeof window !== 'undefined' ? window : globalThis);
