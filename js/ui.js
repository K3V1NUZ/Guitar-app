/* Fretbook — DOM helpers, settings store and shared UI components. */
(function (root) {
  'use strict';
  const GA = (root.GA = root.GA || {});
  const T = GA.Theory;
  const U = (GA.UI = {});

  /* ---------- DOM builders ---------- */
  function append(el, kids) {
    for (const k of kids) {
      if (k == null || k === false) continue;
      if (Array.isArray(k)) append(el, k);
      else if (k instanceof Node) el.appendChild(k);
      else el.appendChild(document.createTextNode(String(k)));
    }
  }
  function setProps(el, props, isSvg) {
    if (!props) return;
    for (const [k, v] of Object.entries(props)) {
      if (v == null || v === false) continue;
      if (k === 'class') el.setAttribute('class', Array.isArray(v) ? v.filter(Boolean).join(' ') : v);
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k === 'html') el.innerHTML = v;
      else if (!isSvg && (k === 'value' || k === 'checked' || k === 'disabled' || k === 'selected')) el[k] = v;
      else el.setAttribute(k, v === true ? '' : v);
    }
  }
  U.h = function (tag, props, ...kids) {
    const el = document.createElement(tag);
    if (props && (props instanceof Node || Array.isArray(props) || typeof props !== 'object')) { kids.unshift(props); props = null; }
    setProps(el, props, false);
    append(el, kids);
    return el;
  };
  const SVGNS = 'http://www.w3.org/2000/svg';
  U.s = function (tag, props, ...kids) {
    const el = document.createElementNS(SVGNS, tag);
    setProps(el, props, true);
    append(el, kids);
    return el;
  };
  const h = U.h;
  U.fmt = T.fmt;
  /** Append children, flattening arrays and skipping null/false. */
  U.mount = (el, ...kids) => { append(el, kids); return el; };

  /* ---------- Settings ---------- */
  const DEFAULTS = {
    tuning: 'standard', lefty: false, labels: 'notes', pref: 'auto', theme: 'auto',
    frets: 15, volume: 0.8, sound: true, diagramLabel: 'fingers', strum: 'down',
  };
  const store = (() => {
    try { return Object.assign({}, DEFAULTS, JSON.parse(localStorage.getItem('fretbook.settings') || '{}')); }
    catch (e) { return Object.assign({}, DEFAULTS); }
  })();
  const listeners = new Set();
  GA.settings = {
    get: (k) => store[k],
    all: () => Object.assign({}, store),
    set(k, v) {
      store[k] = v;
      try { localStorage.setItem('fretbook.settings', JSON.stringify(store)); } catch (e) { /* private mode */ }
      listeners.forEach((fn) => fn(k, v));
    },
    on: (fn) => listeners.add(fn),
    tuning() {
      return T.TUNING_BY_ID[store.tuning] || T.TUNINGS[0];
    },
  };
  U.pref = () => GA.settings.get('pref');
  U.namePc = (pc) => T.pcName(pc, GA.settings.get('pref') === 'sharp' ? 'sharp' : 'flat');

  U.storage = {
    get(k, d) { try { const v = localStorage.getItem('fretbook.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('fretbook.' + k, JSON.stringify(v)); } catch (e) { /* ignore */ } },
  };

  /* ---------- Components ---------- */

  /** Chord/scale names rendered with a raised suffix. */
  U.chordName = function (rootName, sym, cls) {
    return h('span', { class: ['chordname', cls] },
      h('span', { class: 'cn-root' }, T.fmt(rootName)),
      sym ? h('span', { class: 'cn-sym' }, T.fmt(sym)) : null);
  };

  /** A 12-key root picker shaped like a piano octave. */
  U.rootPicker = function ({ value, onChange, label = 'Root', fk = 'root' }) {
    const keys = [];
    for (let pc = 0; pc < 12; pc++) {
      const black = T.isBlack(pc);
      keys.push(h('button', {
        class: ['rk', black ? 'rk-b' : 'rk-w', pc === value ? 'on' : ''],
        type: 'button',
        'aria-pressed': pc === value ? 'true' : 'false',
        'data-fk': fk + pc,
        title: black ? T.fmt(T.SHARP[pc] + ' / ' + T.FLAT[pc]) : T.SHARP[pc],
        onclick: () => onChange(pc),
      }, black
        ? [h('span', null, T.fmt(T.SHARP[pc])), h('span', null, T.fmt(T.FLAT[pc]))]
        : h('span', null, T.SHARP[pc])));
    }
    return h('div', { class: 'field' }, label ? h('div', { class: 'label' }, label) : null, h('div', { class: 'rootpicker', role: 'group', 'aria-label': label }, keys));
  };

  /** Segmented control. options: [{value,label,title}] */
  U.seg = function ({ options, value, onChange, label, fk = 'seg', small }) {
    return h('div', { class: 'field' },
      label ? h('div', { class: 'label' }, label) : null,
      h('div', { class: ['seg', small ? 'seg-s' : ''], role: 'group' }, options.map((o) => h('button', {
        type: 'button', class: o.value === value ? 'on' : '', 'aria-pressed': o.value === value ? 'true' : 'false',
        title: o.title || null, 'data-fk': fk + o.value,
        onclick: () => onChange(o.value),
      }, o.label))));
  };

  /** Native select with optional groups: options [{value,label,group}] */
  U.select = function ({ options, value, onChange, label, fk = 'sel', wide }) {
    const groups = new Map();
    for (const o of options) {
      const g = o.group || '';
      if (!groups.has(g)) groups.set(g, []);
      groups.get(g).push(o);
    }
    const sel = h('select', { 'data-fk': fk, onchange: (e) => onChange(e.target.value) });
    for (const [g, list] of groups) {
      const parent = g ? h('optgroup', { label: g }) : sel;
      for (const o of list) parent.appendChild(h('option', { value: o.value, selected: String(o.value) === String(value) }, o.label));
      if (g) sel.appendChild(parent);
    }
    return h('label', { class: ['field', wide ? 'field-wide' : ''] }, label ? h('span', { class: 'label' }, label) : null, h('span', { class: 'selectwrap' }, sel));
  };

  /** Grouped chips, e.g. for chord types. groups: [{name, items:[{value,label,title}]}] */
  U.chipGroups = function ({ groups, value, onChange, fk = 'chip' }) {
    return h('div', { class: 'chipgroups' }, groups.map((g) => h('div', { class: 'chipgroup' },
      h('div', { class: 'chipgroup-name' }, g.name),
      h('div', { class: 'chips' }, g.items.map((it) => h('button', {
        type: 'button', class: ['chip', it.value === value ? 'on' : ''], title: it.title || null,
        'aria-pressed': it.value === value ? 'true' : 'false', 'data-fk': fk + it.value,
        onclick: () => onChange(it.value),
      }, it.label))))));
  };

  U.toggle = function ({ checked, onChange, label, fk = 'tg' }) {
    return h('label', { class: 'toggle' },
      h('input', { type: 'checkbox', checked, 'data-fk': fk, onchange: (e) => onChange(e.target.checked) }),
      h('span', { class: 'toggle-track' }), h('span', null, label));
  };

  U.button = function (label, onClick, opts = {}) {
    return h('button', { type: 'button', class: ['btn', opts.kind ? 'btn-' + opts.kind : '', opts.cls], onclick: onClick, title: opts.title || null, 'data-fk': opts.fk || null, disabled: opts.disabled }, opts.icon ? U.icon(opts.icon) : null, label ? h('span', null, label) : null);
  };

  const ICONS = {
    play: 'M7 5v14l11-7z',
    stop: 'M6 6h12v12H6z',
    arp: 'M4 18h3v-4H4zm5 0h3V10H9zm5 0h3V6h-3zm5 0h1v-9h-1z',
    plus: 'M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6z',
    x: 'M6.4 5 12 10.6 17.6 5 19 6.4 13.4 12 19 17.6 17.6 19 12 13.4 6.4 19 5 17.6 10.6 12 5 6.4z',
    up: 'M12 5l7 7h-4v7H9v-7H5z',
    down: 'M12 19l-7-7h4V5h6v7h4z',
    left: 'M15.5 5 8.5 12l7 7-1.4 1.4L5.7 12l8.4-8.4z',
    right: 'M8.5 5l7 7-7 7 1.4 1.4 8.4-8.4-8.4-8.4z',
    search: 'M10 4a6 6 0 1 1-3.7 10.7l-3.6 3.6-1.4-1.4 3.6-3.6A6 6 0 0 1 10 4zm0 2a4 4 0 1 0 0 8 4 4 0 0 0 0-8z',
    menu: 'M3 6h18v2H3zm0 5h18v2H3zm0 5h18v2H3z',
    gear: 'M12 8.5a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7zM10.6 2h2.8l.5 2.6 1.6.7 2.2-1.5 2 2-1.5 2.2.7 1.6 2.6.5v2.8l-2.6.5-.7 1.6 1.5 2.2-2 2-2.2-1.5-1.6.7-.5 2.6h-2.8l-.5-2.6-1.6-.7-2.2 1.5-2-2 1.5-2.2-.7-1.6L2 13.4v-2.8l2.6-.5.7-1.6-1.5-2.2 2-2 2.2 1.5 1.6-.7z',
    mic: 'M12 3a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3zm-7 9h2a5 5 0 0 0 10 0h2a7 7 0 0 1-6 6.9V21h-2v-2.1A7 7 0 0 1 5 12z',
    shuffle: 'M4 7h3.5l7 10H20v-2l3 3-3 3v-2h-6.5l-7-10H4zm10.5 0H20V5l3 3-3 3V9h-4.5l-1.7 2.4-1.2-1.7zM4 17h3.5l1.7-2.4 1.2 1.7L8.5 19H4z',
    trash: 'M9 3h6l1 2h4v2H4V5h4zm-3 6h12l-1 12H7z',
    copy: 'M8 3h11v13h-2V5H8zM5 7h10v14H5z',
    heart: 'M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z',
    loop: 'M7 7h10l-2-2 1.4-1.4L20.8 8l-4.4 4.4L15 11l2-2H7a3 3 0 0 0-3 3H2a5 5 0 0 1 5-5zm10 10H7l2 2-1.4 1.4L3.2 16l4.4-4.4L9 13l-2 2h10a3 3 0 0 0 3-3h2a5 5 0 0 1-5 5z',
    sun: 'M12 7a5 5 0 1 1 0 10 5 5 0 0 1 0-10zM11 1h2v3h-2zm0 19h2v3h-2zM1 11h3v2H1zm19 0h3v2h-3zM4.2 2.8l2.1 2.1-1.4 1.4-2.1-2.1zm14.9 14.9 2.1 2.1-1.4 1.4-2.1-2.1zM2.8 19.8l2.1-2.1 1.4 1.4-2.1 2.1zM17.7 4.9l2.1-2.1 1.4 1.4-2.1 2.1z',
  };
  U.icon = function (name, size = 18) {
    return U.s('svg', { class: 'icon', viewBox: '0 0 24 24', width: size, height: size, 'aria-hidden': 'true' }, U.s('path', { d: ICONS[name] || '' }));
  };

  /** Notes + formula strip: big spelled notes over their interval names. */
  U.formula = function (names, intervals, opts = {}) {
    return h('div', { class: 'formula' }, names.map((n, i) => h('button', {
      type: 'button',
      class: ['fcell', 'r-' + T.ivRole(intervals[i])],
      title: T.INTERVAL_NAMES[intervals[i]] || '',
      onclick: opts.onNote ? () => opts.onNote(i) : null,
    }, h('span', { class: 'fnote' }, T.fmt(n)), h('span', { class: 'fiv' }, T.fmt(intervals[i])))));
  };

  U.section = function (title, kids, opts = {}) {
    return h('section', { class: ['block', opts.cls] },
      title ? h('header', { class: 'block-h' }, h('h2', null, title), opts.aside || null) : null,
      kids);
  };

  U.pageHead = function (view, extra) {
    return h('header', { class: 'pagehead' },
      h('div', { class: 'ph-num' }, view.num),
      h('div', { class: 'ph-main' },
        h('h1', null, view.title),
        view.blurb ? h('p', { class: 'ph-blurb' }, view.blurb) : null),
      extra || null);
  };

  U.empty = function (text) {
    return h('div', { class: 'empty' }, text);
  };

  let toastTimer = null;
  U.toast = function (msg) {
    let el = document.getElementById('toast');
    if (!el) { el = h('div', { id: 'toast', role: 'status' }); document.body.appendChild(el); }
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
  };

  /** Selected-notes picker: 12 toggle buttons (used by identifiers). */
  U.noteToggles = function ({ selected, onToggle, rootPc, fk = 'nt' }) {
    return h('div', { class: 'notetoggles' }, [...Array(12).keys()].map((pc) => h('button', {
      type: 'button', class: ['nt', selected.has(pc) ? 'on' : '', rootPc === pc && selected.has(pc) ? 'root' : '', T.isBlack(pc) ? 'nt-b' : ''],
      'aria-pressed': selected.has(pc) ? 'true' : 'false', 'data-fk': fk + pc,
      onclick: () => onToggle(pc),
    }, T.fmt(U.namePc(pc)))));
  };

  U.chordTypeGroups = function () {
    return T.CHORD_GROUPS.map((g) => ({
      name: g,
      items: T.CHORDS.filter((c) => c.group === g).map((c) => ({ value: c.id, label: c.sym ? T.fmt(c.sym) : 'maj', title: c.name })),
    }));
  };
  U.scaleOptions = function () {
    return T.SCALES.map((s) => ({ value: s.id, label: s.name, group: s.family }));
  };
})(typeof window !== 'undefined' ? window : globalThis);
