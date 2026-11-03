/* Fretbook — SVG renderers: chord boxes, the fretboard, a piano strip, a key-signature staff. */
(function (root) {
  'use strict';
  const GA = (root.GA = root.GA || {});
  const T = GA.Theory;
  const U = GA.UI;
  const R = (GA.Render = {});
  const s = U.s;
  const mod = T.mod;

  /**
   * Vertical chord box.
   * v: voicing from GA.Voicings; opts: { rootPc, label: 'fingers'|'notes'|'intervals'|'none', names: Map pc->name, lefty }
   */
  R.chordDiagram = function (v, opts = {}) {
    const n = v.frets.length;
    const lefty = opts.lefty != null ? opts.lefty : GA.settings.get('lefty');
    const label = opts.label || GA.settings.get('diagramLabel');
    const rows = 5;
    const sg = n > 6 ? 15 : 18; // string gap
    const fg = 23; // fret gap
    const padL = 32, padT = 30;
    const width = padL + sg * (n - 1) + 18;
    const height = padT + fg * rows + 24;
    const fretted = v.frets.filter((f) => f > 0);
    const maxF = fretted.length ? Math.max(...fretted) : 0;
    const start = maxF <= rows ? 1 : Math.min(...fretted);
    const xOf = (str) => padL + sg * (lefty ? n - 1 - str : str);
    const yOf = (fret) => padT + fg * (fret - start + 0.5);
    const kids = [];

    // grid
    for (let r = 0; r <= rows; r++) {
      kids.push(s('line', { class: 'cd-fret', x1: padL, x2: padL + sg * (n - 1), y1: padT + fg * r, y2: padT + fg * r }));
    }
    for (let i = 0; i < n; i++) {
      kids.push(s('line', { class: 'cd-string', x1: padL + sg * i, x2: padL + sg * i, y1: padT, y2: padT + fg * rows, 'stroke-width': 0.8 + (lefty ? i : n - 1 - i) * 0.18 }));
    }
    if (start === 1) kids.push(s('rect', { class: 'cd-nut', x: padL - 1.5, y: padT - 4.5, width: sg * (n - 1) + 3, height: 5, rx: 1 }));
    else kids.push(s('text', { class: 'cd-pos', x: padL - 9, y: padT + fg * 0.5 + 4, 'text-anchor': 'end' }, start + 'fr'));

    const nameFor = (str) => {
      const m = v.midis[str];
      if (m == null) return '';
      const pc = mod(m);
      return opts.names && opts.names.has(pc) ? T.fmt(opts.names.get(pc)) : T.fmt(U.namePc(pc));
    };
    const textFor = (str) => {
      if (label === 'fingers') return v.fingers[str] ? String(v.fingers[str]) : '';
      if (label === 'notes') return nameFor(str);
      if (label === 'intervals') return T.fmt(v.intervals[str] || '');
      return '';
    };

    // barre
    if (v.barre && v.barre.to > v.barre.from) {
      const x1 = xOf(v.barre.from), x2 = xOf(v.barre.to);
      const y = yOf(v.barre.fret);
      kids.push(s('rect', { class: 'cd-barre', x: Math.min(x1, x2) - 7.5, y: y - 7.5, width: Math.abs(x2 - x1) + 15, height: 15, rx: 7.5 }));
    }
    // markers
    v.frets.forEach((f, str) => {
      const x = xOf(str);
      const iv = v.intervals[str];
      const isRoot = iv === '1';
      if (f < 0) {
        kids.push(s('path', { class: 'cd-mute', d: `M${x - 4} ${padT - 16}l8 8m0 -8l-8 8` }));
      } else if (f === 0) {
        kids.push(s('circle', { class: ['cd-open', isRoot ? 'is-root' : ''].join(' '), cx: x, cy: padT - 12, r: 4.6 }));
      } else {
        const y = yOf(f);
        const onBarre = v.barre && f === v.barre.fret && str >= v.barre.from && str <= v.barre.to;
        if (!onBarre || isRoot || str === v.barre.from || str === v.barre.to) {
          kids.push(s('circle', { class: ['cd-dot', 'r-' + T.ivRole(iv)].join(' '), cx: x, cy: y, r: 7.6 }));
        }
        const t = textFor(str);
        if (t && (!onBarre || str === v.barre.from || label !== 'fingers')) {
          kids.push(s('text', { class: 'cd-dot-t', x, y: y + 3.4, 'text-anchor': 'middle', 'font-size': t.length > 2 ? 7 : 9 }, t));
        }
      }
      // note names along the bottom
      if (opts.bottom !== false) {
        kids.push(s('text', { class: ['cd-bottom', isRoot ? 'is-root' : ''].join(' '), x, y: padT + fg * rows + 15, 'text-anchor': 'middle' }, f < 0 ? '' : (label === 'intervals' ? nameFor(str) : T.fmt(iv || ''))));
      }
    });

    return s('svg', { class: 'chorddiagram', viewBox: `0 0 ${width} ${height}`, role: 'img', 'aria-label': opts.aria || 'Chord diagram ' + GA.Voicings.toText(v.frets) }, kids);
  };

  /**
   * Horizontal fretboard.
   * opts: {
   *   tuning: midi[], frets: number,
   *   mark(str, fret, midi) -> null | { label, role, cls }
   *   onCell(str, fret, midi), lefty, compact, highlightFrets: [lo, hi]
   * }
   */
  R.fretboard = function (opts) {
    opts = Object.assign({}, opts, { large: true, compact: false }); // one size everywhere
    const tuning = opts.tuning;
    const n = tuning.length;
    const N = opts.frets || GA.settings.get('frets') || 15;
    const lefty = opts.lefty != null ? opts.lefty : GA.settings.get('lefty');
    const gap = opts.compact ? 22 : opts.large ? 36 : 27;
    const openW = 44;
    const padT = 16, padB = 30, padL = 30, padR = 12;
    const boardW = Math.max(560, N * 62);
    const W = padL + openW + boardW + padR;
    const H = padT + gap * (n - 1) + padB + 16 + (opts.large ? 8 : 0);
    const top = padT + 8;
    const edge = opts.large ? 18 : 12;
    const boardTop = top - edge, boardBot = top + gap * (n - 1) + edge;
    // fret x positions: blend of real (logarithmic) and linear spacing
    const real = (f) => (1 - Math.pow(2, -f / 12)) / (1 - Math.pow(2, -N / 12));
    const fx = (f) => padL + openW + boardW * (0.62 * real(f) + 0.38 * (f / N));
    const X = (x) => (lefty ? W - x : x);
    const cellX = (f) => (f === 0 ? padL + openW / 2 - 4 : (fx(f - 1) + fx(f)) / 2);
    const yOf = (str) => top + gap * (n - 1 - str);
    const kids = [];

    // board
    const bx1 = X(fx(0)), bx2 = X(fx(N) + 4);
    kids.push(s('rect', { class: 'fb-wood', x: Math.min(bx1, bx2), y: boardTop, width: Math.abs(bx2 - bx1), height: boardBot - boardTop, rx: 10 }));
    if (opts.highlightFrets) {
      const [lo, hi] = opts.highlightFrets;
      const a = X(lo <= 0 ? fx(0) - openW + 4 : fx(lo - 1)), b = X(fx(hi));
      kids.push(s('rect', { class: 'fb-window', x: Math.min(a, b), y: boardTop - 6, width: Math.abs(b - a), height: boardBot - boardTop + 12, rx: 12 }));
    }
    // inlays: quiet dots on the board
    const inlays = [3, 5, 7, 9, 15, 17, 19, 21];
    const midY = (boardTop + boardBot) / 2;
    for (let f = 1; f <= N; f++) {
      const cx = X((fx(f - 1) + fx(f)) / 2);
      if (inlays.includes(f)) kids.push(s('circle', { class: 'fb-inlay', cx, cy: midY, r: 4 }));
      if (f === 12 || f === 24) {
        kids.push(s('circle', { class: 'fb-inlay', cx, cy: midY - gap, r: 4 }));
        kids.push(s('circle', { class: 'fb-inlay', cx, cy: midY + gap, r: 4 }));
      }
    }
    // frets
    for (let f = 1; f <= N; f++) {
      kids.push(s('line', { class: 'fb-fret', x1: X(fx(f)), x2: X(fx(f)), y1: boardTop + 3, y2: boardBot - 3 }));
    }
    kids.push(s('rect', { class: 'fb-nut', x: X(fx(0)) - (lefty ? -1 : 5), y: boardTop + 3, width: 4, height: boardBot - boardTop - 6, rx: 2 }));
    // fret numbers
    for (let f = 1; f <= N; f++) {
      const strong = inlays.includes(f) || f === 12 || f === 24;
      kids.push(s('text', { class: ['fb-num', strong ? 'strong' : ''].join(' '), x: X((fx(f - 1) + fx(f)) / 2), y: boardBot + 18, 'text-anchor': 'middle' }, String(f)));
    }
    // strings + tuning labels
    for (let str = 0; str < n; str++) {
      const y = yOf(str);
      const thick = 0.7 + Math.max(0, (66 - tuning[str]) / 18);
      kids.push(s('line', { class: 'fb-string', x1: X(padL + 14), x2: X(fx(N) + 4), y1: y, y2: y, 'stroke-width': Math.max(0.7, thick) }));
      kids.push(s('text', { class: 'fb-tune', x: X(padL - 6), y: y + 4, 'text-anchor': lefty ? 'start' : 'end' }, T.fmt(U.namePc(tuning[str]))));
    }

    // cells + marks
    const R0 = opts.compact ? 9 : opts.large ? 13.5 : 10.5;
    for (let str = 0; str < n; str++) {
      for (let f = 0; f <= N; f++) {
        const midi = tuning[str] + f;
        const cx = X(cellX(f));
        const cy = yOf(str);
        const m = opts.mark ? opts.mark(str, f, midi) : null;
        if (opts.onCell) {
          const w = f === 0 ? openW - 8 : fx(f) - fx(f - 1);
          kids.push(s('g', { class: 'fb-hit', 'data-s': str, 'data-f': f },
            s('rect', { x: cx - w / 2, y: cy - gap / 2, width: w, height: gap }),
            s('circle', { cx, cy, r: R0 })));
        }
        if (m) {
          const g = s('g', { class: ['fb-mark', 'r-' + (m.role || 'plain'), m.cls || ''].join(' '), transform: `translate(${cx} ${cy})` });
          g.appendChild(s('circle', { r: R0 }));
          if (m.label) g.appendChild(s('text', { y: opts.large ? 4.4 : 3.6, 'text-anchor': 'middle', 'font-size': (String(m.label).length > 2 ? 8 : 10) * (opts.large ? 1.25 : 1) }, m.label));
          kids.push(g);
        }
      }
    }
    const svg = s('svg', { class: 'fretboard' + (opts.large ? ' fb-large' : ''), viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': opts.aria || 'Fretboard' }, kids);
    svg.style.minWidth = Math.round(W * 0.78) + 'px';
    if (opts.onCell) {
      svg.classList.add('interactive');
      svg.addEventListener('click', (e) => {
        const t = e.target.closest('[data-s]') || hitFromPoint(svg, e);
        if (!t) return;
        const str = +t.getAttribute('data-s'), f = +t.getAttribute('data-f');
        opts.onCell(str, f, tuning[str] + f);
      });
    }
    const wrap = U.h('div', { class: 'fb-scroll' }, svg);
    return wrap;
  };
  function hitFromPoint(svg, e) {
    // the click might land on a mark drawn over the hit rect
    const els = document.elementsFromPoint(e.clientX, e.clientY);
    return els.find((x) => x.hasAttribute && x.hasAttribute('data-s')) || null;
  }

  /** Two-octave piano strip highlighting pitch classes. */
  R.piano = function ({ pcs, rootPc, names, octaves = 2, startPc = 0, onKey }) {
    const set = new Set(pcs.map((p) => mod(p)));
    const ww = 22, wh = 78, bw = 14, bh = 48;
    const whites = [0, 2, 4, 5, 7, 9, 11];
    const kids = [];
    let x = 0;
    const blacks = [];
    for (let o = 0; o < octaves; o++) {
      for (const w of whites) {
        const pc = w;
        const on = set.has(pc);
        const g = s('g', { class: ['pk pk-w', on ? 'on' : '', on && pc === rootPc ? 'root' : ''].join(' '), 'data-pc': pc });
        g.appendChild(s('rect', { x: x + 0.5, y: 0.5, width: ww - 1, height: wh, rx: 2.5 }));
        if (on) g.appendChild(s('text', { x: x + ww / 2, y: wh - 9, 'text-anchor': 'middle' }, T.fmt(names && names.get(pc) ? names.get(pc) : U.namePc(pc))));
        kids.push(g);
        if ([0, 2, 5, 7, 9].includes(w)) blacks.push({ pc: w + 1, x: x + ww - bw / 2 });
        x += ww;
      }
    }
    for (const b of blacks) {
      const on = set.has(b.pc);
      const g = s('g', { class: ['pk pk-b', on ? 'on' : '', on && b.pc === rootPc ? 'root' : ''].join(' '), 'data-pc': b.pc });
      g.appendChild(s('rect', { x: b.x, y: 0.5, width: bw, height: bh, rx: 2 }));
      if (on) g.appendChild(s('circle', { cx: b.x + bw / 2, cy: bh - 9, r: 3.2 }));
      kids.push(g);
    }
    const svg = s('svg', { class: 'piano', viewBox: `0 0 ${x + 1} ${wh + 1}`, role: 'img', 'aria-label': 'Piano keyboard' }, kids);
    if (onKey) svg.addEventListener('click', (e) => { const k = e.target.closest('[data-pc]'); if (k) onKey(+k.getAttribute('data-pc')); });
    return svg;
  };

  /** Treble staff with a key signature. */
  R.keySig = function ({ sharps = 0, flats = 0 }) {
    const lineGap = 8, top = 14, left = 8, w = 150;
    const kids = [];
    for (let i = 0; i < 5; i++) kids.push(s('line', { class: 'st-line', x1: left, x2: left + w, y1: top + i * lineGap, y2: top + i * lineGap }));
    // stylised clef: a simple G-clef-like curl
    kids.push(s('path', { class: 'st-clef', d: `M${left + 16} ${top + 44} C ${left + 8} ${top + 40}, ${left + 10} ${top + 30}, ${left + 18} ${top + 30} C ${left + 30} ${top + 30}, ${left + 30} ${top + 46}, ${left + 18} ${top + 46} C ${left + 4} ${top + 46}, ${left + 2} ${top + 24}, ${left + 20} ${top + 12} C ${left + 30} ${top + 4}, ${left + 26} ${top - 10}, ${left + 20} ${top - 6} C ${left + 14} ${top - 2}, ${left + 16} ${top + 30}, ${left + 18} ${top + 52} C ${left + 19} ${top + 58}, ${left + 12} ${top + 58}, ${left + 12} ${top + 54}` }));
    // staff step from top line F5: 0 = F5, 1 = E5 ... 8 = E4
    const sharpSteps = [0, 3, -1, 2, 5, 1, 4]; // F C G D A E B
    const flatSteps = [4, 1, 5, 2, 6, 3, 7]; // B E A D G C F
    const list = sharps ? sharpSteps.slice(0, sharps) : flatSteps.slice(0, flats);
    list.forEach((st, i) => {
      kids.push(s('text', { class: 'st-acc', x: left + 40 + i * 13, y: top + st * (lineGap / 2) + (sharps ? 5 : 3), 'text-anchor': 'middle' }, sharps ? '♯' : '♭'));
    });
    return s('svg', { class: 'keysig', viewBox: `0 0 ${left + w + 4} ${top + 4 * lineGap + 26}`, role: 'img', 'aria-label': sharps ? sharps + ' sharps' : flats + ' flats' }, kids);
  };

  /** Convenience: a chord card with diagram, name and play. */
  R.chordCard = function ({ rootPc, typeId, voicing, title, sub, onOpen, compact, names }) {
    const h = U.h;
    const ch = T.chord(rootPc, typeId, U.pref());
    const nm = names || new Map(ch.pcs.map((p, i) => [p, ch.names[i]]));
    const card = h('div', { class: ['ccard', compact ? 'ccard-s' : ''] },
      h('div', { class: 'ccard-top' },
        title || U.chordName(ch.rootName, ch.type.sym),
        sub ? h('span', { class: 'ccard-sub' }, sub) : null),
      voicing ? R.chordDiagram(voicing, { rootPc, names: nm }) : U.empty('No playable shape in this tuning'),
      h('div', { class: 'ccard-actions' },
        voicing ? U.button(null, () => GA.Audio.strum(voicing.midis), { icon: 'play', kind: 'ghost', title: 'Strum' }) : null,
        voicing ? h('span', { class: 'ccard-tab' }, GA.Voicings.toText(voicing.frets)) : null,
        onOpen ? U.button(null, onOpen, { icon: 'right', kind: 'ghost', title: 'Open in chord library' }) : null));
    return card;
  };
})(typeof window !== 'undefined' ? window : globalThis);
