(function () {
  'use strict';
  const GA = window.GA, T = GA.Theory, U = GA.UI, R = GA.Render, V = GA.Voicings;
  const h = U.h;

  // A small rotating "chord of the day", picked deterministically from the date.
  const POOL = [[9, 'm9'], [2, 'maj9'], [4, '7#9'], [7, '13'], [0, 'add9'], [5, 'maj7#11'], [11, 'm7b5'], [3, '69'], [10, '7sus4'], [1, 'maj7'], [6, 'm11'], [8, 'mmaj7']];

  GA.views.push({
    id: 'home',
    title: 'Contents',
    render(el) {
      const day = Math.floor(Date.now() / 86400000);
      const [r, t] = POOL[day % POOL.length];
      const tuning = GA.settings.tuning().notes;
      const v = V.best(r, t, tuning);
      const ch = T.chord(r, t, U.pref());

      const groups = [];
      for (const view of GA.views) {
        if (!view.group) continue;
        let g = groups.find((x) => x.name === view.group);
        if (!g) groups.push((g = { name: view.group, items: [] }));
        g.items.push(view);
      }

      U.mount(el, 
        h('section', { class: 'hero' },
          h('div', { class: 'hero-text' },
            h('p', { class: 'eyebrow' }, 'Fretbook · ' + GA.views.filter((x) => x.group).length + ' tools, no connection required'),
            h('h1', { class: 'hero-h' }, 'Every chord, every scale, ', h('em', null, 'on your own neck.')),
            h('p', { class: 'hero-p' }, 'Look chords up, name the shape under your fingers, map scales across the fretboard and see which chords live inside them. Voicings are worked out for whatever tuning you play in — including drop, open and left‑handed setups.'),
            h('div', { class: 'hero-cta' },
              U.button('Open the chord library', () => GA.go('chords'), { kind: 'primary', icon: 'right' }),
              U.button('Name a chord', () => GA.go('identify'), { kind: 'ghost' }),
              h('span', { class: 'hint' }, 'or press ', h('kbd', null, '/'), ' to search'))),
          h('aside', { class: 'hero-card' },
            h('div', { class: 'eyebrow' }, 'Chord of the day'),
            h('a', { href: GA.href('chords', { root: r, type: t }), class: 'cotd-name' }, U.chordName(ch.rootName, ch.type.sym)),
            h('div', { class: 'cotd-sub' }, ch.type.name + ' — ' + ch.names.map(T.fmt).join(' · ')),
            v ? h('button', { type: 'button', class: 'cotd-diagram', title: 'Strum', onclick: () => GA.Audio.strum(v.midis) }, R.chordDiagram(v, { rootPc: r, names: new Map(ch.pcs.map((p, i) => [p, ch.names[i]])) })) : null)),
        h('div', { class: 'toc' }, groups.map((g) => h('section', { class: 'toc-group' },
          h('h2', { class: 'toc-h' }, g.name),
          h('ol', { class: 'toc-list' }, g.items.map((view) => h('li', null,
            h('a', { href: GA.href(view.id), class: 'toc-item' },
              h('span', { class: 'toc-num' }, view.num),
              h('span', { class: 'toc-main' }, h('span', { class: 'toc-t' }, view.title), h('span', { class: 'toc-b' }, view.blurb)),
              h('span', { class: 'toc-arrow', 'aria-hidden': 'true' }, '→')))))))));
    },
  });
})();
