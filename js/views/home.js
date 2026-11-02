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
          h('h1', { class: 'hero-h' }, 'Every chord and scale, ', h('em', null, 'on your neck.')),
          h('button', { type: 'button', class: 'hero-search', onclick: () => GA.openPalette() },
            U.icon('search', 18), h('span', null, 'Try “Am7”, “D dorian” or “tuner”'), h('kbd', null, '/'))),
        h('div', { class: 'toc' }, groups.map((g) => h('section', { class: 'toc-group' },
          h('h2', { class: 'toc-h' }, g.name),
          h('ul', { class: 'toc-list' }, g.items.map((view) => h('li', null,
            h('a', { href: GA.href(view.id), class: 'toc-item' },
              h('span', { class: 'toc-ic' }, GA.navIcon(view.id)),
              h('span', { class: 'toc-main' },
                h('span', { class: 'toc-t' }, view.title),
                h('span', { class: 'toc-b' }, view.short || view.blurb))))))))),
        v ? h('a', { class: 'cotd', href: GA.href('chords', { root: r, type: t }) },
          h('span', { class: 'label' }, 'Chord of the day'),
          U.chordName(ch.rootName, ch.type.sym),
          h('span', { class: 'cotd-sub' }, ch.type.name)) : null);
    },
  });
})();
