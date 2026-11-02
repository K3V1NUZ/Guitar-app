/* Fretbook — application shell: router, navigation, settings drawer, command palette. */
(function (root) {
  'use strict';
  const GA = root.GA;
  const T = GA.Theory;
  const U = GA.UI;
  const h = U.h;
  const S = GA.settings;

  GA.views = GA.views || [];
  const byId = () => Object.fromEntries(GA.views.map((v) => [v.id, v]));

  /* ---------- Routing ---------- */
  function parseHash() {
    const raw = location.hash.replace(/^#\/?/, '');
    const [path, qs] = raw.split('?');
    const params = {};
    if (qs) for (const part of qs.split('&')) {
      const [k, v] = part.split('=');
      if (k) params[decodeURIComponent(k)] = decodeURIComponent(v || '');
    }
    return { id: path || 'home', params };
  }
  function buildHash(id, params) {
    const qs = Object.entries(params || {})
      .filter(([, v]) => v != null && v !== '')
      .map(([k, v]) => encodeURIComponent(k) + '=' + encodeURIComponent(v)).join('&');
    return '#/' + (id === 'home' ? '' : id) + (qs ? '?' + qs : '');
  }
  GA.href = buildHash;

  let current = { id: null, params: {} };
  let cleanup = null;

  GA.go = function (id, params = {}, opts = {}) {
    const hash = buildHash(id, params);
    if (opts.replace) {
      history.replaceState(null, '', hash);
      render();
    } else if (location.hash !== hash) {
      location.hash = hash;
    } else render();
  };

  function render() {
    const { id, params } = parseHash();
    const views = byId();
    const view = views[id] || views.home;
    const main = document.getElementById('view');
    const changedView = current.id !== view.id;
    const ae = document.activeElement;
    const focusKey = ae && ae.getAttribute && ae.getAttribute('data-fk');
    const sel = ae && 'selectionStart' in ae && /text|textarea|search/.test(ae.type || ae.tagName.toLowerCase()) ? [ae.selectionStart, ae.selectionEnd, ae.scrollTop] : null;
    const scroller = document.scrollingElement;
    const keepScroll = !changedView ? scroller.scrollTop : 0;

    if (cleanup) { try { cleanup(); } catch (e) { console.error(e); } cleanup = null; }
    current = { id: view.id, params };
    document.body.dataset.view = view.id;

    const ctx = {
      params,
      update: (patch) => GA.go(view.id, Object.assign({}, params, patch), { replace: true }),
      go: GA.go,
    };
    const frag = h('div', { class: 'view view-' + view.id });
    try {
      const res = view.render(frag, params, ctx);
      if (typeof res === 'function') cleanup = res;
    } catch (e) {
      console.error(e);
      frag.appendChild(U.empty('Something went wrong rendering this page. ' + e.message));
    }
    main.replaceChildren(frag);
    document.title = (view.id === 'home' ? 'Fretbook — guitar theory, offline' : view.title + ' · Fretbook');

    // nav state
    document.querySelectorAll('.nav a').forEach((a) => a.classList.toggle('on', a.dataset.id === view.id));
    document.body.classList.remove('nav-open');

    if (changedView) {
      scroller.scrollTop = 0;
      main.focus({ preventScroll: true });
    } else {
      scroller.scrollTop = keepScroll;
      if (focusKey) {
        const el = main.querySelector(`[data-fk="${CSS.escape(focusKey)}"]`);
        if (el) {
          el.focus({ preventScroll: true });
          if (sel && 'setSelectionRange' in el) { try { el.setSelectionRange(sel[0], sel[1]); el.scrollTop = sel[2]; } catch (e) { /* not a text field */ } }
        }
      }
    }
  }
  GA.rerender = render;

  /* ---------- Shell ---------- */
  function buildNav() {
    const groups = [];
    for (const v of GA.views) {
      if (!v.group) continue;
      let g = groups.find((x) => x.name === v.group);
      if (!g) groups.push((g = { name: v.group, items: [] }));
      g.items.push(v);
    }
    return h('nav', { class: 'nav', 'aria-label': 'Tools' }, groups.map((g) => h('div', { class: 'nav-group' },
      h('div', { class: 'nav-group-name' }, g.name),
      g.items.map((v) => h('a', { href: buildHash(v.id), 'data-id': v.id }, h('span', { class: 'nav-t' }, v.title))))));
  }

  function tuningLabel() {
    const t = S.tuning();
    return t.notes.map((m) => T.fmt(U.namePc(m))).join(' ');
  }

  function buildShell() {
    const app = document.getElementById('app');
    const side = h('aside', { class: 'side' },
      h('a', { class: 'brand', href: '#/' },
        h('span', { class: 'brand-mark', 'aria-hidden': 'true' }, brandMark()),
        h('span', { class: 'brand-t' }, 'Fretbook'),
      ),
      buildNav(),
      h('div', { class: 'side-foot' },
        h('span', { class: 'offline-dot', id: 'offlineState' }, 'Works offline'),
      ));
    const top = h('div', { class: 'topbar' },
      h('button', { class: 'iconbtn menu-btn', type: 'button', 'aria-label': 'Menu', onclick: () => document.body.classList.toggle('nav-open') }, U.icon('menu', 20)),
      h('a', { class: 'brand brand-mobile', href: '#/' }, h('span', { class: 'brand-mark' }, brandMark()), h('span', { class: 'brand-t' }, 'Fretbook')),
      h('button', { class: 'searchbtn', type: 'button', onclick: openPalette },
        U.icon('search', 16), h('span', null, 'Search chords, scales, tools'), h('kbd', null, navigator.platform && /Mac/.test(navigator.platform) ? '⌘K' : 'Ctrl K')),
      h('div', { class: 'top-right' },
        h('button', { class: 'tuning-pill', type: 'button', id: 'tuningPill', onclick: openSettings, title: 'Tuning' }, h('span', { class: 'tp-name' }, S.tuning().name), h('span', { class: 'tp-notes' }, tuningLabel())),
        h('button', { class: 'iconbtn', type: 'button', 'aria-label': 'Settings', onclick: openSettings }, U.icon('gear', 19))));
    const main = h('div', { class: 'main' }, top, h('main', { id: 'view', tabindex: '-1' }));
    const scrim = h('div', { class: 'scrim', onclick: () => document.body.classList.remove('nav-open', 'settings-open') });
    app.replaceChildren(side, main, scrim, buildSettings(), buildPalette());
  }

  function brandMark() {
    // a tiny chord box
    const s = U.s;
    return s('svg', { viewBox: '0 0 24 24', width: 26, height: 26 },
      s('rect', { x: 3, y: 3, width: 18, height: 18, rx: 2, class: 'bm-box' }),
      s('line', { x1: 3, x2: 21, y1: 9, y2: 9, class: 'bm-l' }), s('line', { x1: 3, x2: 21, y1: 15, y2: 15, class: 'bm-l' }),
      s('line', { x1: 9, x2: 9, y1: 3, y2: 21, class: 'bm-l' }), s('line', { x1: 15, x2: 15, y1: 3, y2: 21, class: 'bm-l' }),
      s('circle', { cx: 15, cy: 12, r: 3, class: 'bm-dot' }));
  }

  /* ---------- Settings drawer ---------- */
  function buildSettings() {
    const panel = h('aside', { class: 'settings', id: 'settings', 'aria-label': 'Settings' });
    const draw = () => {
      const t = S.all();
      panel.replaceChildren(
        h('header', { class: 'settings-h' }, h('h2', null, 'Settings'), h('button', { class: 'iconbtn', type: 'button', 'aria-label': 'Close settings', onclick: closeSettings }, U.icon('x'))),
        h('div', { class: 'settings-b' },
          h('section', { class: 'set-group' }, h('h3', null, 'Instrument'),
            U.select({ label: 'Tuning', value: t.tuning, onChange: (v) => S.set('tuning', v), wide: true,
              options: T.TUNINGS.map((x) => ({ value: x.id, label: `${x.name} — ${x.notes.map((m) => U.namePc(m)).join(' ')}`, group: x.id === 'uke' || x.id === 'bass' || x.id === 'seven' ? 'Other instruments' : 'Guitar' })) }),
            U.seg({ label: 'Handedness', value: t.lefty ? 'L' : 'R', options: [{ value: 'R', label: 'Right' }, { value: 'L', label: 'Left' }], onChange: (v) => S.set('lefty', v === 'L') }),
            U.seg({ label: 'Frets on the neck', value: String(t.frets), options: ['12', '15', '19', '22', '24'].map((x) => ({ value: x, label: x })), onChange: (v) => S.set('frets', +v) })),
          h('section', { class: 'set-group' }, h('h3', null, 'Display'),
            U.seg({ label: 'Theme', value: t.theme, options: [{ value: 'auto', label: 'System' }, { value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }], onChange: (v) => S.set('theme', v) }),
            U.seg({ label: 'Chord diagram labels', value: t.diagramLabel, options: [{ value: 'fingers', label: 'Fingers' }, { value: 'notes', label: 'Notes' }, { value: 'intervals', label: 'Intervals' }], onChange: (v) => S.set('diagramLabel', v) }),
            U.seg({ label: 'Accidentals', value: t.pref, options: [{ value: 'auto', label: 'Auto' }, { value: 'sharp', label: '♯' }, { value: 'flat', label: '♭' }], onChange: (v) => S.set('pref', v) }),
            U.toggle({ label: 'Show piano keyboard', checked: t.piano, onChange: (v) => S.set('piano', v) })),
          h('section', { class: 'set-group' }, h('h3', null, 'Sound'),
            U.toggle({ label: 'Play sounds', checked: t.sound, onChange: (v) => S.set('sound', v) }),
            h('input', { type: 'range', min: 0, max: 1, step: 0.05, value: t.volume, class: 'range', 'aria-label': 'Volume', oninput: (e) => { S.set('volume', +e.target.value); GA.Audio.setVolume(+e.target.value); } })),
          h('p', { class: 'settings-note' }, 'Saved on this device. Works without a connection — use your browser’s Install option to keep it as an app.'),
        ));
    };
    draw();
    S.on((k) => {
      if (k === 'volume') return;
      draw();
      if (k === 'theme') applyTheme();
      const pill = document.getElementById('tuningPill');
      if (pill) pill.replaceChildren(h('span', { class: 'tp-name' }, S.tuning().name), h('span', { class: 'tp-notes' }, tuningLabel()));
      if (k !== 'sound') render();
    });
    return panel;
  }
  function openSettings() { document.body.classList.add('settings-open'); setTimeout(() => { const f = document.querySelector('#settings select'); f && f.focus(); }, 50); }
  function closeSettings() { document.body.classList.remove('settings-open'); }
  GA.openSettings = openSettings;

  function applyTheme() {
    const t = S.get('theme');
    if (t === 'auto') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', t);
    const meta = document.querySelector('meta[name="theme-color"]');
    const dark = t === 'dark' || (t === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
    if (meta) meta.setAttribute('content', dark ? '#1a1511' : '#f1ebe0');
  }

  /* ---------- Command palette ---------- */
  let palette, palInput, palList, palItems = [], palIndex = 0;
  function buildPalette() {
    palInput = h('input', { type: 'text', placeholder: 'Try “F#m7”, “D dorian”, “tuner”…', 'aria-label': 'Search', autocomplete: 'off', spellcheck: 'false' });
    palList = h('ul', { class: 'pal-list', role: 'listbox' });
    palette = h('div', { class: 'palette', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Search', onclick: (e) => { if (e.target === palette) closePalette(); } },
      h('div', { class: 'pal-box' }, h('div', { class: 'pal-in' }, U.icon('search', 18), palInput, h('kbd', null, 'Esc')), palList));
    palInput.addEventListener('input', updatePalette);
    palInput.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') { palIndex = Math.min(palItems.length - 1, palIndex + 1); paintPal(); e.preventDefault(); }
      else if (e.key === 'ArrowUp') { palIndex = Math.max(0, palIndex - 1); paintPal(); e.preventDefault(); }
      else if (e.key === 'Enter') { const it = palItems[palIndex]; if (it) { closePalette(); it.go(); } }
      else if (e.key === 'Escape') closePalette();
    });
    return palette;
  }
  function openPalette() {
    palette.classList.add('open');
    palInput.value = '';
    updatePalette();
    palInput.focus();
  }
  function closePalette() { palette.classList.remove('open'); }
  GA.openPalette = openPalette;

  function searchResults(q) {
    const out = [];
    const qq = q.trim();
    const low = qq.toLowerCase();
    // chord?
    const ch = T.parseChord(qq.replace(/\s+/g, ''));
    if (ch) {
      const c = T.chord(ch.rootPc, ch.typeId, U.pref());
      out.push({ kind: 'Chord', label: T.fmt(c.symbol + (ch.bassName ? '/' + ch.bassName : '')), sub: c.type.name + ' · ' + c.names.map(T.fmt).join(' '), go: () => GA.go('chords', { root: ch.rootPc, type: ch.typeId }) });
      out.push({ kind: 'Scales', label: 'Scales for ' + T.fmt(c.symbol), sub: 'Chords → Scales', go: () => GA.go('chordscales', { root: ch.rootPc, type: ch.typeId }) });
    }
    // scale?
    const note = T.parseNote(qq);
    if (note) {
      const rest = qq.slice(note.len).trim().toLowerCase();
      const rootPc = T.notePc(note);
      const words = rest.split(/\s+/).filter(Boolean);
      const scales = T.SCALES.filter((s) => {
        if (!words.length) return ['major', 'minor', 'majpent', 'minpent'].includes(s.id);
        const hay = (s.name + ' ' + s.aka + ' ' + s.id).toLowerCase();
        return words.every((w) => hay.includes(w));
      }).slice(0, 5);
      for (const s of scales) {
        const sc = T.scale(rootPc, s.id, U.pref());
        out.push({ kind: 'Scale', label: T.fmt(sc.rootName) + ' ' + s.name, sub: sc.names.map(T.fmt).join(' '), go: () => GA.go('scales', { root: rootPc, scale: s.id }) });
      }
    }
    // tools
    for (const v of GA.views) {
      if (!v.group) continue;
      const hay = (v.title + ' ' + (v.keywords || '') + ' ' + v.group).toLowerCase();
      if (!low || low.split(/\s+/).every((w) => hay.includes(w))) out.push({ kind: v.num, label: v.title, sub: v.blurb, go: () => GA.go(v.id) });
    }
    return out.slice(0, 12);
  }
  function updatePalette() {
    palItems = searchResults(palInput.value);
    palIndex = 0;
    paintPal();
  }
  function paintPal() {
    palList.replaceChildren(...palItems.map((it, i) => h('li', {
      class: i === palIndex ? 'on' : '', role: 'option', 'aria-selected': i === palIndex ? 'true' : 'false',
      onmousemove: () => { if (palIndex !== i) { palIndex = i; paintPal(); } },
      onclick: () => { closePalette(); it.go(); },
    }, h('span', { class: 'pal-kind' }, it.kind), h('span', { class: 'pal-label' }, it.label), it.sub ? h('span', { class: 'pal-sub' }, it.sub) : null)));
    if (!palItems.length) palList.replaceChildren(h('li', { class: 'pal-none' }, 'Nothing matches. Try a chord symbol like “Bbmaj7”.'));
  }

  /* ---------- Boot ---------- */
  function boot() {
    applyTheme();
    matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);
    buildShell();
    GA.Audio.setVolume(S.get('volume'));
    window.addEventListener('hashchange', render);
    document.addEventListener('keydown', (e) => {
      const typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName);
      if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || (e.key === '/' && !typing)) { e.preventDefault(); openPalette(); }
      else if (e.key === 'Escape') { closeSettings(); document.body.classList.remove('nav-open'); }
    });
    render();
    // offline support (service worker can't run from file://)
    const st = document.getElementById('offlineState');
    if ('serviceWorker' in navigator && /^https?:/.test(location.protocol)) {
      navigator.serviceWorker.register('sw.js').then(() => { st && st.classList.add('ready'); st && (st.textContent = 'Saved for offline use'); })
        .catch(() => { st && (st.textContent = 'Offline cache unavailable'); });
    } else if (location.protocol === 'file:') {
      st && st.classList.add('ready'); st && (st.textContent = 'Running from disk');
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(window);
