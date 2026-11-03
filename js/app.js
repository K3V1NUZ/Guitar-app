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
    const scroller = document.querySelector('.main') || document.scrollingElement;
    const keepScroll = !changedView ? scroller.scrollTop : 0;

    if (cleanup) { try { cleanup(); } catch (e) { console.error(e); } cleanup = null; }
    current = { id: view.id, params };
    document.body.dataset.view = view.id;
    const tt = document.getElementById('topTitle');
    if (tt) tt.textContent = view.id === 'home' ? '' : view.title;
    const tc = document.getElementById('topCustom');
    if (tc) tc.hidden = !(view.sections && view.sections.length);

    const ctx = {
      params,
      update: (patch) => GA.go(view.id, Object.assign({}, params, patch), { replace: true }),
      go: GA.go,
    };
    const frag = h('div', { class: 'view view-' + view.id + (changedView ? ' view-enter' : '') });
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
    if (document.activeElement && document.activeElement.closest && document.activeElement.closest('.side')) document.activeElement.blur();
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
  // Line icons for each tool (24px grid, stroked)
  const NAV_ICONS = {
    home: 'M4 10.5 12 4l8 6.5V20h-5.5v-5.5h-5V20H4z',
    chords: 'M6 4h12v16H6zM6 9h12M6 14h12M10 4v16M14 4v16',
    identify: 'M11 4a7 7 0 1 1 0 14 7 7 0 0 1 0-14zM20.5 20.5 16 16M11 9v2.5M11 14h.01',
    scales: 'M4 19h4v-4h4v-4h4V7h4',
    scaleid: 'M4 17h3v-3h3v-3h3M16.5 8a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7zM21 19l-2-2',
    harmonize: 'M6 20V12M12 20V5M18 20v-9M4 20h16',
    chordscales: 'M5 6h14M5 12h9M5 18h5M17 14l3 3-3 3',
    circle: 'M12 4a8 8 0 1 1 0 16 8 8 0 0 1 0-16zM12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8zM12 4v4',
    fretboard: 'M3 8h18M3 12h18M3 16h18M7 6v12M12 6v12M17 6v12',
    progressions: 'M4 7h4v10H4zM10 7h4v10h-4zM16 7h4v10h-4z',
    tuner: 'M4 17a8 8 0 0 1 16 0M12 17l4-6M12 17h.01',
    metronome: 'M9 4h6l3 16H6zM12 15l5-7M8 15h8',
    transpose: 'M8 20V5M5 8l3-3 3 3M16 4v15M13 16l3 3 3-3',
    ear: 'M3 12h2.5l2-5 3 10 3-13 3 11 1.5-3H21',
    settings: 'M12 9a3 3 0 1 1 0 6 3 3 0 0 1 0-6zM12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8',
    sidebar: 'M4 5h16v14H4zM9.5 5v14',
  };
  const navIcon = (id) => U.s('svg', { class: 'nicon', viewBox: '0 0 24 24', width: 20, height: 20, 'aria-hidden': 'true' }, U.s('path', { d: NAV_ICONS[id] || NAV_ICONS.home }));
  GA.navIcon = navIcon;

  function buildNav() {
    const groups = [{ name: null, items: [{ id: 'home', title: 'Home' }] }];
    for (const v of GA.views) {
      if (!v.group) continue;
      let g = groups.find((x) => x.name === v.group);
      if (!g) groups.push((g = { name: v.group, items: [] }));
      g.items.push(v);
    }
    return h('nav', { class: 'nav', 'aria-label': 'Tools' }, groups.map((g) => h('div', { class: 'nav-group' },
      g.name ? h('div', { class: 'nav-group-name' }, h('span', null, g.name)) : null,
      g.items.map((v) => h('a', { href: buildHash(v.id), 'data-id': v.id, title: v.title }, navIcon(v.id), h('span', { class: 'nav-t' }, v.title))))));
  }

  function setCollapsed(v) {
    document.body.classList.toggle('side-collapsed', v);
    U.storage.set('sideCollapsed', v);
  }
  GA.toggleSidebar = () => {
    if (matchMedia('(max-width: 900px)').matches) document.body.classList.toggle('nav-open');
    else setCollapsed(!document.body.classList.contains('side-collapsed'));
  };

  function buildShell() {
    const app = document.getElementById('app');
    const mac = navigator.platform && /Mac/.test(navigator.platform);
    const side = h('aside', { class: 'side' },
      h('div', { class: 'side-top' },
        h('button', { class: 'navbtn side-toggle', type: 'button', title: 'Toggle sidebar (' + (mac ? '⌘' : 'Ctrl') + ' B)', 'aria-label': 'Toggle sidebar', onclick: GA.toggleSidebar }, navIcon('sidebar'))),
      buildNav());
    const top = h('div', { class: 'topbar' },
      h('button', { class: 'iconbtn menu-btn', type: 'button', title: 'Show sidebar (' + (mac ? '⌘' : 'Ctrl') + ' B)', 'aria-label': 'Show sidebar', onclick: GA.toggleSidebar }, navIcon('sidebar')),
      h('div', { class: 'top-title', id: 'topTitle' }),
      h('button', { class: 'searchbtn', type: 'button', onclick: openPalette },
        U.icon('search', 15), h('span', null, 'Search'), h('kbd', null, mac ? '⌘K' : 'Ctrl K')),
      h('div', { class: 'top-right' },
        h('button', { class: 'iconbtn', type: 'button', id: 'topCustom', title: 'Customize this page', 'aria-label': 'Customize this page', hidden: true, onclick: () => GA.openLayout(current.id) },
          U.s('svg', { viewBox: '0 0 24 24', width: 19, height: 19, class: 'nicon' }, U.s('path', { d: 'M4 7h10M18 7h2M4 17h4M12 17h8M16 4.5v5M10 14.5v5' }))),
        h('button', { class: 'iconbtn', type: 'button', title: 'Settings', 'aria-label': 'Settings', onclick: openSettings }, navIcon('settings'))));
    const main = h('div', { class: 'main' }, top, h('main', { id: 'view', tabindex: '-1' }));
    const scrim = h('div', { class: 'scrim', onclick: () => document.body.classList.remove('nav-open', 'settings-open') });
    app.replaceChildren(h('div', { class: 'side-hot', 'aria-hidden': 'true' }), side, main, scrim, buildSettings(), buildPalette());
    if (U.storage.get('sideCollapsed', false)) document.body.classList.add('side-collapsed');
  }

  /* ---------- Settings drawer ---------- */
  let layoutView = null;
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
          ),
          layoutGroup(),
          h('section', { class: 'set-group' }, h('h3', null, 'Sound'),
            U.toggle({ label: 'Play sounds', checked: t.sound, onChange: (v) => S.set('sound', v) }),
            h('input', { type: 'range', min: 0, max: 1, step: 0.05, value: t.volume, class: 'range', 'aria-label': 'Volume', oninput: (e) => { S.set('volume', +e.target.value); GA.Audio.setVolume(+e.target.value); } })),
          h('p', { class: 'settings-note' }, (GA.offlineReady === 'disk' ? 'Running from disk. ' : GA.offlineReady ? 'Saved for offline use. ' : '') + 'Settings are stored on this device.'),
        ));
    };
    function layoutGroup() {
      const views = GA.views.filter((v) => v.sections && v.sections.length);
      if (!layoutView || !views.find((v) => v.id === layoutView)) layoutView = (views.find((v) => v.id === current.id) || views[0]).id;
      const view = views.find((v) => v.id === layoutView);
      return h('section', { class: 'set-group', id: 'layoutGroup' }, h('h3', null, 'Page layout'),
        h('p', { class: 'settings-note' }, 'Drag sections to reorder them, or move them to Hidden.'),
        U.select({ label: 'Page', value: layoutView, fk: 'laypage', options: views.map((v) => ({ value: v.id, label: v.title })), onChange: (v) => { layoutView = v; draw(); } }),
        U.layoutEditor(view, () => { if (current.id === view.id) render(); draw(); }));
    }
    GA.redrawSettings = (viewId) => { if (viewId) layoutView = viewId; draw(); };
    draw();
    S.on((k) => {
      if (k === 'volume') return;
      draw();
      if (k === 'theme') applyTheme();
      if (k !== 'sound') render();
    });
    return panel;
  }
  GA.openLayout = (viewId) => {
    GA.redrawSettings(viewId);
    document.body.classList.add('settings-open');
    setTimeout(() => { const g = document.getElementById('layoutGroup'); if (g) g.scrollIntoView({ block: 'start', behavior: 'smooth' }); }, 60);
  };
  function openSettings() { GA.redrawSettings(current.id); document.body.classList.add('settings-open'); }
  function closeSettings() { document.body.classList.remove('settings-open'); }
  GA.openSettings = openSettings;

  function applyTheme() {
    const t = S.get('theme');
    if (t === 'auto') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', t);
    const meta = document.querySelector('meta[name="theme-color"]');
    const dark = t === 'dark' || (t === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
    if (meta) meta.setAttribute('content', dark ? '#0c0c0e' : '#ececee');
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
      else if ((e.key === 'b' || e.key === 'B') && (e.metaKey || e.ctrlKey)) { e.preventDefault(); GA.toggleSidebar(); }
      else if (e.key === 'Escape') { closeSettings(); document.body.classList.remove('nav-open'); }
    });
    render();
    // offline support (service worker can't run from file://)
    if ('serviceWorker' in navigator && /^https?:/.test(location.protocol)) {
      navigator.serviceWorker.register('sw.js').then(() => { GA.offlineReady = true; }).catch(() => { GA.offlineReady = false; });
    } else if (location.protocol === 'file:') {
      GA.offlineReady = 'disk';
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(window);
