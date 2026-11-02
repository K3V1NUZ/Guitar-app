/* Fretbook — chord voicing generator.
 * Searches the neck for playable shapes of any chord in any tuning,
 * scores them for ergonomics, and assigns fingerings.
 */
(function (root) {
  'use strict';
  const GA = (root.GA = root.GA || {});
  const T = GA.Theory;
  const V = (GA.Voicings = {});
  const mod = T.mod;
  const cache = new Map();

  /** Work out barre + finger numbers for a set of frets. */
  V.fingering = function (frets) {
    const fretted = [];
    frets.forEach((f, s) => { if (f > 0) fretted.push({ s, f }); });
    const fingers = frets.map(() => 0);
    if (!fretted.length) return { fingers, barre: null, count: 0 };
    const minF = Math.min(...fretted.map((n) => n.f));
    const atMin = fretted.filter((n) => n.f === minF);
    let barre = null;
    if (atMin.length >= 2 && fretted.length > 4) {
      const from = atMin[0].s;
      const to = atMin[atMin.length - 1].s;
      // a barre must not cross open or muted strings
      let ok = true;
      for (let s = from; s <= to; s++) if (frets[s] < minF) { ok = false; break; }
      // if notes above the barre sit between barre strings that's fine (fingers on top)
      if (ok) barre = { fret: minF, from, to };
    }
    let next = 1;
    const order = fretted.slice().sort((a, b) => a.f - b.f || a.s - b.s);
    if (barre) {
      for (let s = barre.from; s <= barre.to; s++) if (frets[s] === minF) fingers[s] = 1;
      next = 2;
    }
    const rest = order.filter((n) => !fingers[n.s]);
    rest.forEach((n, i) => {
      const remaining = rest.length - i - 1;
      let f = Math.max(next, n.f - minF + 1);
      f = Math.min(f, 4 - remaining);
      f = Math.max(f, next);
      fingers[n.s] = f;
      next = f + 1;
    });
    const count = (barre ? 1 : 0) + rest.length;
    return { fingers, barre, count };
  };

  /**
   * Generate voicings.
   * @param {number} rootPc
   * @param {string} typeId
   * @param {number[]} tuning MIDI notes low->high (by string order)
   * @param {object} opts { maxFret, rootBass, limit, bassPc }
   */
  V.generate = function (rootPc, typeId, tuning, opts = {}) {
    const maxFret = opts.maxFret || 15;
    const limit = opts.limit || 14;
    const rootBass = opts.rootBass !== false;
    const bassPc = opts.bassPc != null ? mod(opts.bassPc) : mod(rootPc);
    const key = [rootPc, typeId, tuning.join('.'), maxFret, limit, rootBass, bassPc].join('|');
    if (cache.has(key)) return cache.get(key);

    const type = T.CHORD_BY_ID[typeId];
    const chordPcs = new Set(type.pcs.map((p) => mod(p + rootPc)));
    const reqPcs = new Set(type.req.map((p) => mod(p + rootPc)));
    if (opts.bassPc != null) chordPcs.add(bassPc), reqPcs.add(bassPc);
    const n = tuning.length;
    const minStrings = Math.min(n, type.pcs.length <= 2 ? 2 : 3);
    const span = 3; // max fret distance between fretted notes
    const found = new Map();

    const ivOf = (pc) => {
      const rel = mod(pc - rootPc);
      const i = type.pcs.indexOf(rel);
      return i >= 0 ? type.intervals[i] : T.SEMI_SHORT[rel];
    };

    for (let base = 1; base <= maxFret - 0; base++) {
      // options per string within window [base, base+span] plus open & mute
      const options = tuning.map((open) => {
        const o = [-1];
        if (chordPcs.has(mod(open))) o.push(0);
        for (let f = base; f <= Math.min(base + span, maxFret); f++) if (chordPcs.has(mod(open + f))) o.push(f);
        return o;
      });
      const frets = new Array(n);
      const rec = (s) => {
        if (s === n) { evaluate(frets.slice()); return; }
        for (const f of options[s]) { frets[s] = f; rec(s + 1); }
      };
      rec(0);
    }

    function evaluate(frets) {
      const sounding = [];
      for (let s = 0; s < n; s++) if (frets[s] >= 0) sounding.push(s);
      if (sounding.length < minStrings) return;
      const k = frets.join(',');
      if (found.has(k)) return;
      // must actually use a fretted note in the window or be an all-open shape
      const fretted = frets.filter((f) => f > 0);
      if (fretted.length) {
        const lo = Math.min(...fretted), hi = Math.max(...fretted);
        if (hi - lo > span) return;
      }
      // pitch content
      const midis = sounding.map((s) => tuning[s] + frets[s]);
      const pcsHere = new Set(midis.map((m) => mod(m)));
      for (const p of reqPcs) if (!pcsHere.has(p)) return;
      const lowest = Math.min(...midis);
      if (rootBass && mod(lowest) !== bassPc) return;
      // gaps between sounding strings
      const first = sounding[0], last = sounding[sounding.length - 1];
      let inner = 0;
      for (let s = first; s <= last; s++) if (frets[s] < 0) inner++;
      if (inner > 1) return;
      const fing = V.fingering(frets);
      if (fing.count > 4) return;
      // barre with an inner mute is unplayable
      if (fing.barre && inner) {
        for (let s = fing.barre.from; s <= fing.barre.to; s++) if (frets[s] < 0) return;
      }
      const minF = fretted.length ? Math.min(...fretted) : 0;
      const maxF = fretted.length ? Math.max(...fretted) : 0;
      const opens = frets.filter((f) => f === 0).length;
      const missingOpt = type.pcs.filter((p) => !pcsHere.has(mod(p + rootPc))).length;
      const trebleMutes = n - 1 - last;
      // unison doubling of the same midi note is wasteful
      const uniq = new Set(midis).size;

      let score = 0;
      score += minF * 0.55;
      score += (maxF - minF) * 0.6;
      score += inner * 3.2;
      score += trebleMutes * 1.6;
      score += (n - sounding.length) * 0.9;
      score += missingOpt * 1.4;
      score += (midis.length - uniq) * 1.2;
      score += fing.count === 4 ? 0.6 : 0;
      score += fing.barre ? 0.4 : 0;
      if (opens && minF > 4) score += opens * 1.1; else score -= opens * 0.35;
      if (!fretted.length) score += 1.5;

      found.set(k, {
        frets,
        fingers: fing.fingers,
        barre: fing.barre,
        minFret: minF,
        maxFret: maxF,
        midis: frets.map((f, s) => (f < 0 ? null : tuning[s] + f)),
        intervals: frets.map((f, s) => (f < 0 ? null : ivOf(tuning[s] + f))),
        score,
      });
    }

    // rank and prune near-duplicates
    const all = [...found.values()].sort((a, b) => a.score - b.score);
    const picked = [];
    const isSubShape = (a, b) => {
      // a is b with some extra strings muted
      for (let s = 0; s < n; s++) if (a.frets[s] >= 0 && a.frets[s] !== b.frets[s]) return false;
      return true;
    };
    for (const v of all) {
      if (picked.length >= limit) break;
      if (picked.some((p) => isSubShape(v, p) || isSubShape(p, v))) continue;
      // keep diversity: at most 3 voicings starting in the same fret zone
      const zone = picked.filter((p) => Math.abs(p.minFret - v.minFret) <= 1).length;
      if (zone >= 3) continue;
      picked.push(v);
    }
    picked.sort((a, b) => a.minFret - b.minFret || a.score - b.score);
    cache.set(key, picked);
    return picked;
  };

  /** The single most practical voicing (lowest score). */
  V.best = function (rootPc, typeId, tuning, opts = {}) {
    const list = V.generate(rootPc, typeId, tuning, Object.assign({ maxFret: 12 }, opts));
    if (!list.length) return null;
    return list.slice().sort((a, b) => a.score - b.score)[0];
  };

  /** Short text form like x32010 (frets above 9 shown in parentheses) */
  V.toText = (frets) => frets.map((f) => (f < 0 ? 'x' : f > 9 ? `(${f})` : String(f))).join('');

  if (typeof module !== 'undefined' && module.exports) module.exports = V;
})(typeof window !== 'undefined' ? window : globalThis);
