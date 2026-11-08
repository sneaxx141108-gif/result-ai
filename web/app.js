/* Result AI – App. Hash-Routen: #/ Start, #/scan Wettschein wird gelesen, #/slip Wettschein nachgerechnet, #/r/<id> Ergebnis, #/acc Erfolgsquote,
   #/bilanz Bilanz der Tipps, #/tips Top-Tipps, #/bets Geld-Tracker, #/pick Spiel auswählen, #/hist Verlauf, #/ki KI-Zentrale.
   Die Prozente rechnet engine.js (RE) – exakt, ohne Zufall, ohne KI. Nur das Lesen der Wettscheine macht eine KI
   (Cloudflare-Server worker/worker.js, Adresse in API). Angezeigte Quoten kommen nur von Tipico, unbekannt = „k. A.“.
   Seiten liegen wie in einer iPhone-App übereinander: neue Seiten schieben sich von rechts herein, zurück geht es per Knopf
   oder Wischen vom linken Rand. Animiert wird nur transform/opacity (iPhone-12-Regeln aus der BVB-App). */
(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const store = {
    get(k, d) { try { const v = localStorage.getItem('ra_' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('ra_' + k, JSON.stringify(v)); } catch (e) { /* privater Modus */ } },
  };
  // Cloudflare-Server (worker/worker.js): liest Wettscheine mit Gemini und stößt die Tipp-Suche an – leer = noch nicht eingerichtet
  const API = 'https://result-ai.sneaxx141108.workers.dev';
  const nf1 = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const nf2 = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const eurF = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' });
  const eur = (v) => eurF.format(v || 0);
  const signed = (v) => (v > 0.004 ? '+' : v < -0.004 ? '−' : '') + eurF.format(Math.abs(v || 0));
  // Eingaben wie „1,85“, „10 €“ oder „1.234,50“ → Zahl
  const dec = (s) => {
    let x = String(s == null ? '' : s).replace(/[\s€]/g, '');
    if (x.includes(',')) x = x.replace(/\./g, '').replace(',', '.');
    const v = parseFloat(x);
    return Number.isFinite(v) ? v : null;
  };
  const pct1 = (p) => (p < 0.001 ? '<0,1 %' : nf1.format(p * 100) + ' %');
  const pct0 = (p) => (p < 0.005 ? '<1 %' : Math.round(p * 100) + ' %');
  const pctR = (p) => Math.round(p * 100) + ' %'; // Trefferquoten: 0 von 3 = „0 %“, nicht „<1 %“
  // Ganze Prozente, die zusammen genau 100 ergeben (größter Rest bekommt den Punkt)
  function round100(ps) {
    const raw = ps.map((p) => p * 100);
    const out = raw.map(Math.floor);
    let left = 100 - out.reduce((a, b) => a + b, 0);
    raw.map((v, i) => [v - Math.floor(v), i]).sort((a, b) => (b[0] - a[0]) || (a[1] - b[1])).forEach(([, i]) => { if (left > 0) { out[i]++; left--; } });
    return out;
  }

  // Haptik: iOS 18+ gibt beim Umschalten eines Schalters ein kurzes Tick – ein unsichtbarer Schalter macht das nutzbar
  const hapEl = document.createElement('label');
  hapEl.className = 'hap';
  hapEl.setAttribute('aria-hidden', 'true');
  hapEl.innerHTML = '<input type="checkbox" switch tabindex="-1">';
  document.body.appendChild(hapEl);
  const haptic = () => { try { hapEl.click(); } catch (e) { /* kein Haptik-Support */ } };

  // ------------------------------------------------------------------ Icons
  const I = {
    photo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-9 9"/></svg>',
    cam: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13" r="3.5"/></svg>',
    scan: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2"/><path d="M7 12h10"/></svg>',
    back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>',
    gear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
    search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>',
    swap: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 20V4M4 8l4-4 4 4M16 4v16M12 16l4 4 4-4"/></svg>',
    target: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/></svg>',
    home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 10.5L12 4l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5.5h-5V20H5a1 1 0 0 1-1-1z"/></svg>',
    flame: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3c.6 3.2 5.5 5.6 5.5 10.6A5.5 5.5 0 0 1 12 19.1a5.5 5.5 0 0 1-5.5-5.5c0-2.6 1.4-4.3 2.6-5.4.2 1.9 1 3 2.1 3.4C11 8.6 10.6 5.6 12 3z"/></svg>',
    spark: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M10 2.5l1.7 5.1 5.1 1.7-5.1 1.7L10 16.1l-1.7-5.1-5.1-1.7 5.1-1.7z"/><path d="M18 13.5l.9 2.6 2.6.9-2.6.9-.9 2.6-.9-2.6-2.6-.9 2.6-.9z"/></svg>',
    chart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19V10M10 19V5M16 19v-6M22 19H2"/></svg>',
    homeF: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M11.3 3.6a1 1 0 0 1 1.4 0l7.7 6.4c.4.3.6.8.6 1.3V19a1.5 1.5 0 0 1-1.5 1.5h-4v-5.2a1 1 0 0 0-1-1h-5a1 1 0 0 0-1 1v5.2h-4A1.5 1.5 0 0 1 3 19v-7.7c0-.5.2-1 .6-1.3z"/></svg>',
    flameF: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.6c.7 3.4 5.9 5.9 5.9 11.1A5.9 5.9 0 0 1 12 19.6a5.9 5.9 0 0 1-5.9-5.9c0-2.8 1.5-4.6 2.8-5.8.2 2 1.1 3.2 2.2 3.6C10.9 8.4 10.5 5.2 12 2.6z"/></svg>',
    searchF: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><circle cx="11" cy="11" r="6.8"/><path d="M20 20l-3.6-3.6"/></svg>',
    clockF: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9.6" fill="currentColor"/><path d="M12 7.2V12l3.2 2.1" fill="none" stroke="var(--card)" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg>',
    ticket: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 6h15a1 1 0 0 1 1 1v3a2 2 0 0 0 0 4v3a1 1 0 0 1-1 1h-15a1 1 0 0 1-1-1v-3a2 2 0 0 0 0-4V7a1 1 0 0 1 1-1z"/><path d="M15 6.5v2M15 11v2M15 15.5v2"/></svg>',
    ticketF: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M4.5 5.4h15A1.6 1.6 0 0 1 21.1 7v3.4a1.7 1.7 0 0 0 0 3.2V17a1.6 1.6 0 0 1-1.6 1.6h-15A1.6 1.6 0 0 1 2.9 17v-3.4a1.7 1.7 0 0 0 0-3.2V7a1.6 1.6 0 0 1 1.6-1.6z"/><path d="M15 7.2v1.6M15 11.2v1.6M15 15.2v1.6" stroke="var(--card)" stroke-width="2" stroke-linecap="round"/></svg>',
    save: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 4h10a1 1 0 0 1 1 1v15l-6-4-6 4V5a1 1 0 0 1 1-1z"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
    pen: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4L19.2 8.8a2.8 2.8 0 0 0-4-4L4 16z"/><path d="M13.5 6.5l4 4"/></svg>',
  };
  const logo = (cls = '') => `<svg class="${cls}" viewBox="0 0 36 36" aria-hidden="true"><g fill="none" stroke-width="5" stroke-linecap="round" transform="rotate(-90 18 18)">
    <circle class="ring-a" cx="18" cy="18" r="13" pathLength="100" stroke="var(--text)" stroke-dasharray="44 56"/>
    <circle class="ring-b" cx="18" cy="18" r="13" pathLength="100" stroke="var(--faint)" stroke-dasharray="20 80" stroke-dashoffset="-52"/>
    <circle class="ring-c" cx="18" cy="18" r="13" pathLength="100" stroke="var(--draw)" stroke-dasharray="16 84" stroke-dashoffset="-80"/></g></svg>`;

  // ------------------------------------------------------------------ Darstellung: hell (Standard) oder dunkel
  const isDark = () => document.documentElement.dataset.theme === 'dark';
  const mqDark = matchMedia('(prefers-color-scheme: dark)');
  function applyTheme(t) {
    const dark = t === 'dark' || (t === 'auto' && mqDark.matches);
    if (dark) document.documentElement.dataset.theme = 'dark'; else delete document.documentElement.dataset.theme;
    const mt = $('meta[name="theme-color"]');
    if (mt) mt.setAttribute('content', dark ? '#000000' : '#F2F2F7');
    store.set('theme', t === 'auto' ? 'auto' : dark ? 'dark' : 'light');
  }
  // „Automatisch“: folgt dem iPhone (hell am Tag, dunkel nachts – je nach Einstellung)
  try { mqDark.addEventListener('change', () => { if (store.get('theme') === 'auto') { applyTheme('auto'); redrawAll(); } }); } catch (e) { /* ältere Browser */ }

  // ------------------------------------------------------------------ Teams: Wappen (ESPN) und Vereinsfarben
  const TEAMS = {
    Arsenal: [359, '#EF0107'], Chelsea: [363, '#034694'], Bayern: [132, '#DC052D'], Dortmund: [124, '#F5C800'],
    'Real Madrid': [86, '#2B2B6B'], Barcelona: [83, '#A50044'], Leipzig: [11420, '#DD0741'], Freiburg: [126, '#1A1A1A'],
    Leverkusen: [131, '#E32221'], Stuttgart: [134, '#C8102E'], Bremen: [137, '#1D9053'], Mainz: [2950, '#C3141E'],
    Union: [598, '#D4011D'], HSV: [127, '#0A3F86'],
  };
  function hslHex(h, s, l) {
    const f = (n) => {
      const k = (n + h / 30) % 12;
      const a = s * Math.min(l, 1 - l);
      return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)))).toString(16).padStart(2, '0');
    };
    return '#' + f(0) + f(8) + f(4);
  }
  function teamColor(name) {
    if (TEAMS[name]) return TEAMS[name][1];
    if (REG[name] && REG[name].color) return REG[name].color;
    let h = 0;
    for (const ch of String(name)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return hslHex(h % 360, 0.55, 0.42);
  }
  const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const lum = (hex) => { const [r, g, b] = rgb(hex).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  const onColor = (hex) => (lum(hex) > 0.45 ? '#111111' : '#FFFFFF');
  const rgba = (hex, a) => { const [r, g, b] = rgb(hex); return `rgba(${r},${g},${b},${a})`; };
  const initials = (n) => String(n).split(/\s+/).map((w) => w[0]).join('').slice(0, 3).toUpperCase();
  // Farben eines Spiels für Balken/Punkte: sind beide Teamfarben zu ähnlich, bekommt der Gast Schwarz (dunkel: Weiß)
  function pair(m) {
    const h = teamColor(m.home);
    let a = teamColor(m.away);
    if (Math.hypot(...rgb(h).map((v, i) => v - rgb(a)[i])) < 110) a = isDark() ? '#F5F5F7' : '#0B0B0C';
    return { h, a };
  }
  const logoUrl = (id, dark, px) => `https://a.espncdn.com/combiner/i?img=/i/teamlogos/soccer/${dark ? '500-dark' : '500'}/${id}.png&w=${px}&h=${px}`;
  // Teams aus den Stärken (selbst ausgewählte Spiele, Verlauf): Name -> Wappen-Adresse und Farbe
  const REG = {};
  function logoSrc(name, dark, px) {
    if (TEAMS[name]) return logoUrl(TEAMS[name][0], dark, px);
    const r = REG[name];
    if (!r || !r.logo) return null;
    const m = /\/i\/teamlogos\/soccer\/500\/(\d+)\.png/.exec(r.logo);
    return m ? logoUrl(m[1], dark, px) : r.logo;
  }
  // ESPN-Wappen mit CORS (der Service Worker speichert sie dauerhaft); FotMob-Wappen ohne – deren Server erlaubt das nicht
  const cors = (src) => (/espncdn\.com/.test(src) ? ' crossorigin="anonymous"' : '');
  function crest(name, s = 30, onPlate = false) {
    const c = teamColor(name);
    const src = logoSrc(name, isDark() && !onPlate, s > 44 ? 200 : 128);
    if (src) return `<span class="crest" style="--s:${s}px"><img src="${src}" alt="" decoding="async"${cors(src)} data-fb="${esc(initials(name))}" data-c="${c}"></span>`;
    return `<span class="crest fb" style="--s:${s}px;background:${c};color:${onColor(c)}" aria-hidden="true">${esc(initials(name))}</span>`;
  }
  const plate = (name, p, extra = '') => `<span class="plate" style="--p:${p}px">${crest(name, Math.round(p * 0.66), true)}${extra}</span>`;
  // Spiel-Karte: scharfer Schnitt zwischen den Vereinsfarben mit feiner heller Naht (wie eine TV-Grafik)
  const teamBg = (m) => {
    const h = teamColor(m.home);
    const w = teamColor(m.away);
    return `linear-gradient(102deg, ${h} 0%, ${h} 49.7%, rgba(255,255,255,.6) 49.7%, rgba(255,255,255,.6) 50.2%, ${w} 50.2%, ${w} 100%)`;
  };
  // großes Wappen als Wasserzeichen in der Spiel-Karte
  const wm = (name, side) => { const src = logoSrc(name, false, 200); return src && !src.includes('/countries/') ? `<span class="wm ${side}" aria-hidden="true"><img src="${src}" alt="" decoding="async"${cors(src)}></span>` : ''; };
  // farbiges Licht oben auf jeder Seite
  const aura = (kind) => `<div class="aura aura-${kind}" aria-hidden="true"></div>`;
  const decoRing = '<svg class="deco" viewBox="0 0 36 36" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" transform="rotate(-90 18 18)"><circle cx="18" cy="18" r="13" pathLength="100" stroke-dasharray="44 56"/><circle cx="18" cy="18" r="13" pathLength="100" stroke-dasharray="20 80" stroke-dashoffset="-52"/><circle cx="18" cy="18" r="13" pathLength="100" stroke-dasharray="16 84" stroke-dashoffset="-80"/></g></svg>';
  // rote Karten: Kärtchen am Wappen und „zu zehnt“ im Untertitel
  const redCards = (m, i) => { const n = (m.reds && m.reds[i]) || 0; return n ? `<span class="rcs" role="img" aria-label="${n} Rote Karte${n > 1 ? 'n' : ''}">${'<i></i>'.repeat(Math.min(n, 3))}</span>` : ''; };
  const shortHanded = (m) => [0, 1].map((i) => { const n = (m.reds && m.reds[i]) || 0; return n ? ` · ${esc(i ? m.away : m.home)} zu ${['', 'zehnt', 'neunt', 'acht'][Math.min(n, 3)]}` : ''; }).join('');
  // Wappen lädt nicht (z. B. offline) → Kreis mit Kürzel in Vereinsfarbe
  document.addEventListener('error', (e) => {
    const im = e.target;
    if (!im || im.tagName !== 'IMG' || im.dataset.fb == null) return;
    const sp = im.parentElement;
    sp.classList.add('fb');
    sp.style.background = im.dataset.c;
    sp.style.color = onColor(im.dataset.c);
    sp.textContent = im.dataset.fb;
  }, true);

  // gespeicherte Wappen/Farben eines Spiels wieder anmelden (Verlauf nach dem Neustart der App)
  const regTeams = (m) => { if (m && m.teams) Object.keys(m.teams).forEach((n) => { REG[n] = m.teams[n]; }); };
  function findMatch(id) {
    if (id.startsWith('t_')) return tipMatchById(id);
    const m = store.get('history', []).find((h) => h.id === id) || null;
    regTeams(m);
    return m;
  }
  // Verlauf: „Bundesliga · 1:0 in der 70. · heute, 14:05“
  function agoText(ts) {
    if (!ts) return '';
    const d = new Date(ts);
    const now = new Date();
    const y = new Date(now); y.setDate(now.getDate() - 1);
    const hm = d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
    if (d.toDateString() === now.toDateString()) return `heute, ${hm}`;
    if (d.toDateString() === y.toDateString()) return `gestern, ${hm}`;
    return d.toLocaleDateString('de-DE', { day: 'numeric', month: 'short' });
  }
  const histRow = (h) => { regTeams(h); return `<a class="row" href="#/r/${esc(h.id)}"><span class="duo">${crest(h.home, 30, true)}${crest(h.away, 30, true)}</span><span class="grow"><div class="t">${esc(h.home)} – ${esc(h.away)}</div><div class="s">${esc(histSub(h))}</div></span><span class="chev">›</span></a>`; };
  const histSub = (h) => [h.comp, h.kind === 'live' && h.score ? `${h.score[0]}:${h.score[1]} in der ${h.minute}.` : h.kind === 'odds' ? 'Quoten' : 'vor dem Spiel', agoText(h.at)].filter(Boolean).join(' · ');
  const analyze = (m) => RE.analyze({ lh: m.lh, la: m.la, minute: m.minute, half: m.half, score: m.score, reds: m.reds, finished: m.finished, market: !!m.market });
  // die wahrscheinlichste der drei Möglichkeiten
  function lead(m, a) {
    const o = [['home', a.probs.home, `Siegchance ${m.home}`], ['draw', a.probs.draw, 'Chance auf Remis'], ['away', a.probs.away, `Siegchance ${m.away}`]];
    return o.sort((x, y) => y[1] - x[1])[0];
  }

  // ------------------------------------------------------------------ Seiten
  const S = { stack: [], busy: false, pending: false, swipe: null, url: null, file: null, slip: null, tabScroll: {} };
  // Leiste unten: vier Bereiche mit eigener Startseite (wie die Tab-Leiste einer iPhone-App)
  const TABS = [['/', 'Start', 'home'], ['/tips', 'Top-Tipps', 'flame'], ['/bets', 'Wetten', 'ticket'], ['/pick', 'Auswählen', 'search'], ['/hist', 'Verlauf', 'clock']];
  const isTab = (p) => TABS.some((t) => t[0] === p);
  const TITLES = { '/': '', '/ki': 'KI-Zentrale', '/scan': 'Wettschein', '/slip': 'Wettschein', '/bilanz': 'Bilanz', '/acc': 'Erfolgsquote', '/pick': 'Spiel auswählen', '/tips': 'Top-Tipps', '/hist': 'Verlauf', '/bets': 'Wetten' };
  const titleOf = (path) => (path in TITLES ? TITLES[path] : 'Ergebnis');
  function barHtml(path) {
    let tt = esc(titleOf(path));
    if (path.startsWith('/r/')) { const m = findMatch(decodeURIComponent(path.slice(3))); if (m) tt = miniMatch(m); }
    const lead = path === '/' ? `<span class="brand">${logo()}<span>Result AI</span></span>`
      : isTab(path) ? '' : `<button class="round" data-act="back" aria-label="Zurück">${I.back}</button>`;
    return `<header class="bar">${lead}<span class="tt">${tt}</span>
      <span class="end">${path === '/' ? `<button class="kib" data-act="ki" aria-label="KI-Zentrale">${kiBadge()}</button>` : ''}<button class="round" data-act="settings" aria-label="Einstellungen">${I.gear}</button></span></header>`;
  }
  function viewHtml(path) {
    if (path === '/') return vHome();
    if (path === '/scan') return vScan();
    if (path === '/slip') return vSlip();
    if (path === '/bilanz') return vBilanz();
    if (path === '/acc') return vAccuracy();
    if (path === '/pick') return vPick();
    if (path === '/tips') return vTips();
    if (path === '/hist') return vHist();
    if (path === '/bets') return vBets();
    if (path === '/ki') return vKI();
    if (path.startsWith('/r/')) return vResult(decodeURIComponent(path.slice(3)));
    return vHome();
  }

  // ------------------------------------------------------------------ Startseite
  const RG_TEXT = 'Keine Garantie. Wetten erst ab 18 · Glücksspiel kann süchtig machen – Hilfe bei check-dein-spiel.de oder kostenlos unter 0800 1 37 27 00 (BZgA).';
  const scanBtns = () => `<div class="acts"><label class="sbtn">${I.photo}<span>Fotos</span><input type="file" accept="image/*" data-act="scanbet" aria-label="Wettschein aus den Fotos wählen"></label>
    <label class="sbtn alt">${I.cam}<span>Kamera</span><input type="file" accept="image/*" capture="environment" data-act="scanbet" aria-label="Wettschein fotografieren"></label></div>`;
  function vHome() {
    const hist = store.get('history', []);
    return `${aura('home')}<section class="hello"><h1>${esc(greet())}</h1><p>${esc(todayLong())}</p></section>
      <div class="spot-slot">${spotlight()}</div>
      <section class="sec"><div class="sec-h"><h2>Top-Tipps</h2><button class="link" data-act="tab" data-tab="/tips">Alle</button></div><div class="tips-prev">${tipCarousel()}</div></section>
      <section class="sec"><div class="sec-h"><h2>Bilanz</h2><span class="note">letzte 30 Tage</span></div><div class="bil-slot">${bilanzCard()}</div></section>
      <section class="scan-card">${decoRing}
        <div class="sc-phone" aria-hidden="true"><div class="sc-screen"><span class="sc-lg">PREMIER LEAGUE</span><div class="sc-sb"><i style="background:#EF0107"></i><b>1 – 1</b><i style="background:#034694"></i></div><span class="sc-min">63'</span><span class="sc-box"></span><span class="sc-line"></span></div></div>
        <div class="sc-text"><span class="sc-eb">${I.scan}Wettschein scannen</span><h2>Schein rein.<br><span>Prozente raus.</span></h2><p>Result AI liest jede Wette und rechnet nach, wie gut sie wirklich ist.</p></div>
        ${scanBtns()}</section>
      <section class="sec"><div class="group"><a class="row" href="#/pick"><span class="round">${I.search}</span><span class="grow"><div class="t">Spiel selbst auswählen</div><div class="s">Vereine und Länder aus ${Object.keys(R.leagues).length || 'über 50'} Ligen</div></span><span class="chev">›</span></a>${homeBets()}</div></section>
      ${hist.length ? `<section class="sec"><div class="sec-h"><h2>Zuletzt</h2>${hist.length > 3 ? '<button class="link" data-act="tab" data-tab="/hist">Alle</button>' : ''}</div><div class="group">${hist.slice(0, 3).map(histRow).join('')}</div></section>` : ''}
      <p class="foot">${RG_TEXT}</p>`;
  }

  // ------------------------------------------------------------------ Wettschein-Scan: KI liest den Schein, Result AI rechnet jede Wette nach
  const SCAN_STEPS = ['Bild laden', 'Wettschein lesen', 'Spiele zuordnen', 'Chancen rechnen'];
  const sleep = (ms) => new Promise((r) => setTimeout(r, reduce ? 0 : ms));
  function vScan() {
    if (!S.url) return `<h1 class="ptitle">Wettschein</h1><div class="empty" style="margin-top:18px">Kein Bild gewählt.</div><div class="card scan-card" style="margin-top:12px">${scanBtns()}</div>`;
    return `<div class="scan-frame" id="frame"><img src="${S.url}" alt="Dein Wettschein"><span class="beam"></span>
        <span class="corner tl"></span><span class="corner tr"></span><span class="corner bl"></span><span class="corner br"></span></div>
      <div class="steps">${SCAN_STEPS.map((t, i) => `<div class="step"><i>${i + 1}</i><span>${t}</span></div>`).join('')}</div>
      <div class="notice-slot"></div>`;
  }
  // Abgehakt wird nur, was wirklich passiert ist
  async function runScan(el) {
    const fr = $('#frame', el);
    if (!fr || !S.file) return;
    const token = (S.scanToken = {});
    const alive = () => S.scanToken === token && el.isConnected;
    const steps = $$('.step', el);
    const done = (i) => { steps[i].classList.remove('on'); steps[i].classList.add('done'); $('i', steps[i]).textContent = '✓'; if (steps[i + 1]) steps[i + 1].classList.add('on'); };
    const fail = (title, text) => {
      if (!alive()) return;
      fr.classList.remove('scanning');
      $('.notice-slot', el).innerHTML = `<div class="notice"><b>${esc(title)}</b><p>${esc(text)}</p>
        <label class="btn">Anderes Bild wählen<input type="file" accept="image/*" data-act="scanbet" aria-label="Anderes Bild wählen"></label><button class="btn soft" data-act="newbet">Wette selbst eintragen</button></div>`;
    };
    fr.classList.add('scanning');
    steps[0].classList.add('on');
    let image;
    try { image = await shrink(S.file); } catch (e) { fail('Bild nicht lesbar', 'Dieses Bild konnte nicht geöffnet werden. Nimm am besten einen normalen Screenshot.'); return; }
    if (!alive()) return;
    done(0);
    let d = null;
    let ok = false;
    try {
      const r = await fetch(API + '/bet', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Invite': String(store.get('invite', '') || '').trim() }, body: JSON.stringify({ image }) });
      d = await r.json().catch(() => null);
      ok = !!(r.ok && d && d.ok && d.bet);
    } catch (e) { d = null; }
    if (!alive()) return;
    if (!ok) { fail('Das hat nicht geklappt', (d && d.error) || 'Der KI-Server ist gerade nicht erreichbar. Prüf die Verbindung und versuch es noch mal.'); return; }
    if (!d.bet.isBetSlip) { fail('Kein Wettschein erkannt', 'Auf dem Bild hat die KI keine Wette gefunden. Nimm am besten einen Screenshot vom Wettschein in deiner Wett-App.'); return; }
    done(1);
    await Promise.all([loadTips(60e3).catch(() => {}), loadRatings().catch(() => {})]);
    if (!alive()) return;
    S.slip = buildSlip(d.bet);
    await sleep(350);
    if (!alive()) return;
    done(2);
    await sleep(350);
    if (!alive()) return;
    done(3);
    fr.classList.remove('scanning');
    fr.classList.add('found');
    await sleep(420);
    if (alive()) location.replace('#/slip');
  }
  function startScan(file) {
    const go = () => {
      if (S.url) URL.revokeObjectURL(S.url);
      S.url = URL.createObjectURL(file);
      S.file = file;
      S.slip = null;
      if (curPath() === '/scan') { const p = S.stack[S.stack.length - 1]; p.el.innerHTML = barHtml('/scan') + `<div class="wrap">${vScan()}</div>`; runScan(p.el); } else location.hash = '#/scan';
    };
    if (!String(store.get('invite', '') || '').trim()) inviteSheet(go); else go();
  }
  // Die KI hat ein begrenztes Gratis-Kontingent: einmal der Einladungscode, danach bleibt er gespeichert
  function inviteSheet(then) {
    if ($('.sheet')) return;
    S.afterInvite = then;
    const sh = document.createElement('div');
    sh.className = 'sheet';
    sh.innerHTML = `<div class="bg" data-act="close"></div><div class="panel" role="dialog" aria-label="Einladungscode"><div class="grip" data-grip></div><h2>Einladungscode</h2>
      <p class="bf-note" style="margin-top:-6px">Den Wettschein liest eine KI mit begrenztem Gratis-Kontingent. Dafür brauchst du einmal deinen Code, den bekommst du von Niklas.</p>
      <input class="search" type="text" placeholder="Code eingeben" data-act="invcode" maxlength="40" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" enterkeyhint="done">
      <button class="btn" data-act="invgo" style="margin-top:12px">Weiter</button></div>`;
    document.body.appendChild(sh);
    $('input', sh).focus();
  }
  async function inviteGo() {
    const sh = $('.sheet');
    const inp = sh && $('[data-act="invcode"]', sh);
    const code = inp ? inp.value.trim() : '';
    if (!code) { toast('Bitte den Code eintragen.'); return; }
    let ok = false;
    try { ok = (await fetch(API + '/check', { headers: { 'X-Invite': code } })).ok; } catch (e) { toast('Der Server ist gerade nicht erreichbar.'); return; }
    if (!ok) { toast('Dieser Code passt nicht.'); return; }
    store.set('invite', code);
    const then = S.afterInvite;
    S.afterInvite = null;
    closeSheet();
    if (then) setTimeout(then, reduce ? 0 : 300);
  }
  // Teamname vom Wettschein → Team in den Stärken („FC Bayern München“, „Bor. Dortmund“, „1. FC Köln“ …)
  // Lieber „k. A.“ als das falsche Team: ein einzelnes Wort zählt nur, wenn es eindeutig ist und nicht bloß ein Vereins-Vorname („Hapoel“, „Real“ …).
  const TEAM_FILLER = new Set('hapoel maccabi beitar ironi bnei real sporting sportiva dynamo dinamo inter internacional athletic atletico deportivo racing union united city town rovers wanderers albion county olympique olympic borussia eintracht fortuna rapid slavia spartak lokomotiv torpedo stade royal young'.split(' '));
  function resolveTeam(name) {
    if (!R.data || !name) return null;
    const clean = String(name).replace(/['’`´]/g, '');
    const stripped = clean.replace(/\b\d+\.?(?=\s|$)/g, ' ').replace(/\b(fc|sv|sc|vfb|vfl|tsg|tsv|bsc|fsv|ssv|spvgg|rb|ac|as|afc|cf|cd|rc|ud|ssc|us|fk|sk)\b\.?/gi, ' ').replace(/\s+/g, ' ').trim();
    for (const q of [clean, stripped]) {
      const hit = q && searchTeams(q, 1)[0];
      if (hit) return hit;
    }
    const words = norm(clean).split(' ').filter((w) => w.length > 4 && !TEAM_FILLER.has(w)).sort((a, b) => b.length - a.length);
    const hits = words.length ? searchTeams(words[0], 2) : [];
    return hits.length === 1 ? hits[0] : null;
  }
  // passendes kommendes Spiel aus der Tipp-Suche (Anstoß darf 36 Stunden abweichen, falls der Schein keine Uhrzeit nennt)
  function findGame(H, A, home, away, kick) {
    const rows = (T.data && T.data.all) || [];
    const same = (t, id, nm, raw) => (t && t.id === id) || norm(nm) === norm(raw) || (t && t._k.includes(norm(nm)));
    const when = kick ? new Date(kick).getTime() : null;
    return rows.find((r) => same(H, r[4], r[6], home) && same(A, r[5], r[7], away) && (when == null || Math.abs(new Date(r[2]).getTime() - when) < 36 * 36e5)) || null;
  }
  // Wie gut passt ein Team zum Text der Wette? 3 = voller Name, 2 = ganzes Wort, 1 = Wortanfang, 0 = gar nicht
  function sideScore(text, name) {
    const t = resolveTeam(name);
    const keys = (t ? t._k : []).concat(norm(name)).filter((k) => k.length > 2);
    if (keys.some((k) => ` ${text} `.includes(` ${k} `))) return 3;
    const words = text.split(' ');
    const own = norm(name).split(' ').filter((w) => w.length > 3);
    if (own.some((w) => words.includes(w))) return 2;
    if (own.some((w) => words.some((x) => x.length > 3 && (x.startsWith(w) || w.startsWith(x))))) return 1;
    return 0;
  }
  function sideOf(text, home, away) {
    const a = sideScore(text, home);
    const b = sideScore(text, away);
    return a > b ? 'H' : b > a ? 'A' : null;
  }
  // Text der Wette → Wett-Code wie in tips.py; was Result AI nicht nachrechnen kann, gibt null (wird „k. A.“)
  function pickCode(x, home, away) {
    const mk = norm(x.market);
    const pk = norm(x.pick);
    const all = `${mk} ${pk}`;
    if (/halbzeit|\bhz\b|ecken|karten|handicap|torschutz|spieler|genaues|exaktes|korrektes|ergebniswette|zeitpunkt|qualifik|weiterkomm/.test(all)) return null;
    const ou = /(uber|over|unter|under|mehr als|weniger als)\s+(\d)\s+(\d)/.exec(all);
    if (ou) { if (/team|heim|gast/.test(mk)) return null; return (/^(uber|over|mehr)/.test(ou[1]) ? 'O' : 'U') + ou[2] + ou[3]; }
    if (/beide|btts|both teams/.test(all)) return /nein|\bno\b|nicht/.test(pk) ? 'BN' : 'BY';
    const c = pk.replace(/\s+/g, '');
    if (/doppelt|double/.test(mk) || ['1x', 'x2', '12', '2x', 'x1', '21'].includes(c)) {
      const m = { '1x': 'HD', x1: 'HD', x2: 'DA', '2x': 'DA', 12: 'HA', 21: 'HA' }[c];
      if (m) return m;
      const draw = /unentschieden|remis|draw/.test(pk);
      const sd = sideOf(pk, home, away);
      if (draw && sd) return sd === 'H' ? 'HD' : 'DA';
      if (!draw && sideScore(pk, home) && sideScore(pk, away)) return 'HA';
      return null;
    }
    if (c === '1') return 'H';
    if (c === '2') return 'A';
    if (c === 'x' || (/unentschieden|remis|draw/.test(pk) && !/oder/.test(pk))) return 'D';
    const sd = sideOf(pk, home, away);
    if (!sd) return null;
    if (/trifft|tor erzielt|to score/.test(all)) return sd === 'H' ? 'HS' : 'AS';
    return sd;
  }
  function slipLeg(x) {
    const leg = { home: x.home || null, away: x.away || null, event: x.event || null, comp: x.competition || null, market: x.market || null, pick: x.pick || 'Wette', q: x.odds || null, t: kickIso(x.kickoff), res: null };
    const item = { leg, p: null, src: null, value: null, why: 'Spiel nicht erkannt' };
    if (!x.home || !x.away) return item;
    const H = resolveTeam(x.home);
    const A = resolveTeam(x.away);
    const code = pickCode(x, x.home, x.away);
    const row = findGame(H, A, x.home, x.away, leg.t);
    let lam = null;
    if (row) {
      lam = [row[8], row[9]];
      item.src = row[10] ? 'model' : 'market';
      leg.t = row[2];
      leg.comp = row[3] || leg.comp;
      if (code) { leg.g = row[0]; leg.slug = row[1]; leg.m = code; }
    } else if (H && A && H.grp === A.grp && H.lg === A.lg) { // ohne Marktpreise nur innerhalb einer Liga: über Ligen hinweg wären die Prozente zu ungenau
      const l = lamOf(H, A, false);
      lam = [l.lh, l.la];
      item.src = 'model';
    }
    if (H) leg.home = reg(H);
    if (A) leg.away = reg(A);
    if (!lam) { item.why = 'Spiel nicht in den Daten'; return item; }
    const mk = item.src === 'market';
    const p = code ? RE.codeProb(RE.analyze({ lh: lam[0], la: lam[1], market: mk }), code, mk) : null;
    if (p == null) { item.src = null; item.why = 'Diese Wettart rechnet Result AI nicht nach'; return item; }
    item.p = p;
    leg.p = p;
    item.value = mk && leg.q ? p * leg.q - 1 : null; // „Wert“ nur gegen echte Marktpreise, die Team-Stärken allein sind dafür nicht genau genug
    return item;
  }
  function buildSlip(x) {
    const items = (x.legs || []).map(slipLeg);
    const games = items.map((i) => i.leg.g || `${norm(i.leg.home)}|${norm(i.leg.away)}`);
    const sameGame = new Set(games).size < games.length; // Wetten aufs selbe Spiel hängen zusammen, das Produkt wäre falsch
    const prod = items.length && items.every((i) => i.leg.q) ? items.reduce((a, i) => a * i.leg.q, 1) : null;
    const q0 = x.totalOdds || prod;
    const q = q0 ? Math.round(q0 * 100) / 100 : null;
    const p = items.length && !sameGame && items.every((i) => i.p != null) ? items.reduce((a, i) => a * i.p, 1) : null;
    return { items, q, p, value: p != null && q && items.every((i) => i.src === 'market') ? p * q - 1 : null, stake: x.stake || null, win: x.potentialWin || null,
      status: ['won', 'lost', 'void'].includes(x.status) ? x.status : 'open', bookie: x.bookmaker || null, note: x.note || null,
      key: 'scan|' + items.map((i) => `${norm(i.leg.pick)}:${i.leg.q || ''}`).join(',') + '|' + (x.stake || ''),
      track: items.length > 0 && items.every((i) => i.leg.g && i.leg.m) };
  }
  const SRC_TXT = { market: 'aus den Marktpreisen', model: 'aus den Team-Stärken' };
  const pctSigned = (v) => `${v > 0.0005 ? '+' : v < -0.0005 ? '−' : ''}${nf1.format(Math.abs(v) * 100)} %`;
  const valueCls = (v) => (v > 0.03 ? 'up' : v < -0.03 ? 'down' : '');
  function vSlip() {
    const s = S.slip;
    if (!s) return `<h1 class="ptitle">Wettschein</h1><div class="empty" style="margin-top:18px">Noch kein Wettschein gescannt.</div><div class="card scan-card" style="margin-top:12px">${scanBtns()}</div>`;
    if (!s.items.length) return `<h1 class="ptitle">Wettschein</h1><div class="empty" style="margin-top:18px">Auf dem Schein konnte keine einzelne Wette gelesen werden.</div>`;
    const fair = s.p ? nf2.format(1 / s.p) : 'k. A.';
    const verdict = s.p == null ? 'Nicht jede Wette lässt sich nachrechnen, deshalb hier keine Gesamtzahl.'
      : s.value == null ? 'Mindestens ein Spiel ist nur aus den Team-Stärken geschätzt, deshalb hier kein Vergleich mit der Quote.'
      : s.value > 0.03 ? 'Die Quote auf dem Schein ist besser als der faire Preis.' : s.value < -0.03 ? 'Die Quote auf dem Schein ist schlechter als der faire Preis.' : 'Die Quote auf dem Schein liegt etwa beim fairen Preis.';
    const legs = s.items.map((x) => {
      const l = x.leg;
      return `<article class="card sl"><div class="sl-top">${l.home && l.away ? `<span class="duo">${crest(l.home, 26, true)}${crest(l.away, 26, true)}</span>` : `<span class="bl-ic">${I.ticket}</span>`}
        <span class="grow"><b>${esc(l.pick)}</b><span>${esc([legTeams(l), l.comp, l.t ? kickoff(l.t) : ''].filter(Boolean).join(' · '))}</span></span></div>
        <div class="tiles t3 short"><div class="tile"><span>Chance</span><b>${x.p != null ? pct0(x.p) : 'k. A.'}</b></div><div class="tile"><span>Quote</span><b>${l.q ? nf2.format(l.q) : 'k. A.'}</b></div><div class="tile"><span>Fair</span><b>${x.p ? nf2.format(1 / x.p) : 'k. A.'}</b></div></div>
        <p class="sl-why">${x.p != null ? `Chance ${SRC_TXT[x.src]}${x.value != null ? ` · Wert <b class="${valueCls(x.value)}">${pctSigned(x.value)}</b>` : ''}` : esc(x.why)}</p></article>`;
    }).join('');
    return `<h1 class="ptitle">Wettschein</h1><p class="psub">${esc([s.bookie, `${s.items.length} ${s.items.length === 1 ? 'Wette' : 'Wetten'}`].filter(Boolean).join(' · '))}</p>
      <section class="card slip-sum"><div class="rec-hero">${s.p != null ? ring(s.p) : '<span class="ring-na">k. A.</span>'}<div class="grow"><b>Chance, dass alles aufgeht</b><span>${esc(verdict)}</span></div></div>
        <div class="tiles t3 short"><div class="tile"><span>Quote</span><b>${s.q ? nf2.format(s.q) : 'k. A.'}</b></div><div class="tile"><span>Fair</span><b>${fair}</b></div><div class="tile"><span>Wert</span><b class="${s.value != null ? valueCls(s.value) : ''}">${s.value != null ? pctSigned(s.value) : 'k. A.'}</b></div></div></section>
      <div class="cards" style="margin-top:12px">${legs}</div>
      <div style="margin-top:16px"><button class="btn" data-act="slipsave">In meine Wetten übernehmen</button></div>
      <p class="foot">Fair = die Quote, bei der die Wette auf lange Sicht weder Gewinn noch Verlust bringt. Wert = so viel Prozent vom Einsatz bringt die Quote auf dem Schein im Schnitt mehr oder weniger.<br>${RG_TEXT}</p>`;
  }
  function saveSlip() {
    const s = S.slip;
    if (!s) return;
    if (savedKeys().has(s.key)) { location.replace('#/bets'); return; }
    openBetSheet({ src: 'scan', legs: s.items.map((x) => x.leg), q: s.q, stake: s.stake, win: s.win, title: s.items.length > 1 ? 'Kombi' : null, status: s.status, bookie: s.bookie, note: s.note, p: s.p, key: s.key, track: s.track });
  }

  // ------------------------------------------------------------------ Ergebnis
  // Zahl als Zählwerk: jede Ziffer ist eine Rolle 0–9 0–9, die auf ihre Ziffer im zweiten Durchlauf rollt (nur transform)
  function roller(n) {
    const ds = String(n).split('');
    const strip = '01234567890123456789'.split('').map((x) => `<span>${x}</span>`).join('');
    return `<span class="roll" aria-hidden="true">${ds.map((d, i) => `<span class="rc"><span class="rs" style="--to:${10 + +d};--dl:${(i * 0.1).toFixed(2)}s">${strip}</span></span>`).join('')}</span><span class="sr">${n} Prozent</span>`;
  }
  const oneIn = (p) => { const n = Math.round(1 / Math.max(p, 1e-6)); return n <= 1 ? 'fast jedes Spiel' : `etwa jedes ${n}. Spiel`; };
  // kleine Dreier-Aufteilung mit Balken (Halbzeit, nächstes Tor)
  function mini(title, note, ps, c, names) {
    const rr = round100(ps);
    return `<div class="mini"><div class="lab"><b>${title}</b><span>${note}</span></div>
      <div class="split"><i style="flex:${ps[0]};background:${c.h}"></i><i style="flex:${ps[1]};background:var(--draw)"></i><i style="flex:${ps[2]};background:${c.a}"></i></div>
      <div class="nums"><span>${rr[0]} % <span class="m">${esc(names[0])}</span></span><span>${rr[1]} % <span class="m">${esc(names[1])}</span></span><span>${rr[2]} % <span class="m">${esc(names[2])}</span></span></div></div>`;
  }
  // Sprung-Leiste: Abschnitte der Ergebnis-Seite (klebt oben, zeigt beim Scrollen, wo man ist)
  function secNav(m, a) {
    const hasTips = m.src === 'tips' && T.data && T.data.safe.concat(T.data.top).some((t) => t.g === m.gid);
    const secs = [['ov', 'Übersicht'], hasTips ? ['tp', 'Tipps'] : null, ['er', 'Ergebnisse'], m.kind === 'odds' ? ['mk', 'Tipico'] : null,
      ['to', 'Tore'], ['hz', a.ht ? 'Halbzeit' : 'Doppelchance'], ['nt', 'Nächstes Tor'], ['ex', 'Erklärung']].filter(Boolean);
    return `<nav class="snav" aria-label="Abschnitte">${secs.map(([k, l], i) => `<button class="${i ? '' : 'on'}" data-act="sec" data-sec="${k}">${l}</button>`).join('')}</nav>`;
  }
  const shortName = (n) => (n.length > 11 ? n.split(' ').pop() : n);
  const miniMatch = (m) => `<span class="mm">${crest(m.home, 22)}<b>${esc(shortName(m.home))}</b><em>${m.kind === 'live' && m.score ? `${m.score[0]}:${m.score[1]}` : 'vs'}</em><b>${esc(shortName(m.away))}</b>${crest(m.away, 22)}</span>`;
  function vResult(id) {
    const m = findMatch(id);
    if (!m) return '<div class="empty" style="margin-top:24px">Diese Analyse gibt es nicht (mehr).</div>';
    const a = analyze(m);
    const c = pair(m);
    const r = round100([a.probs.home, a.probs.draw, a.probs.away]);
    const [k, , label] = lead(m, a);
    const kIdx = { home: 0, draw: 1, away: 2 }[k];
    const live = m.kind === 'live';
    const favHome = a.probs.home >= a.probs.away;
    const favP = Math.max(a.probs.home, a.probs.away);
    const favCol = favHome ? c.h : c.a;
    const badge = k === 'draw' ? ['Offenes Spiel', 'var(--fill)', 'var(--text)']
      : favP > 0.7 ? ['Klarer Favorit', favCol, onColor(favCol)] : favP > 0.5 ? ['Favorit', favCol, onColor(favCol)] : ['Leicht vorne', favCol, onColor(favCol)];
    const hc = teamColor(m.home);
    const ac = teamColor(m.away);
    const fcol = favHome ? hc : ac;
    let out = `<div class="res" style="--hgl:${rgba(hc, 0.3)};--agl:${rgba(ac, 0.3)};--hgd:${rgba(hc, 0.55)};--agd:${rgba(ac, 0.55)};--fvl:${rgba(fcol, 0.1)};--fvd:${rgba(fcol, 0.24)}"><div class="glow" aria-hidden="true"></div><section class="match teamcard" style="background:${teamBg(m)}">${wm(m.home, 'l')}${wm(m.away, 'r')}
      <div class="match-top">${live ? `<span class="chip live">LIVE ${m.minute}'</span>` : `<span class="chip glass">${m.kind === 'odds' ? 'Tipico-Quoten' : 'Vor dem Spiel'}</span>`}<span class="chip glass">${esc(m.comp)}</span><span class="when">${esc(live ? (m.half === 2 ? '2. Halbzeit' : '1. Halbzeit') : m.when || '')}</span></div>
      <div class="versus"><div class="side">${plate(m.home, 80, redCards(m, 0))}<span class="nm">${esc(m.home)}</span></div>
        <div class="mid">${live ? `<div class="sc">${m.score[0]}:${m.score[1]}</div><div class="sub">${m.minute}. Minute</div>` : '<div class="vs">VS</div>'}</div>
        <div class="side">${plate(m.away, 80, redCards(m, 1))}<span class="nm">${esc(m.away)}</span></div></div></section>
      ${secNav(m, a)}<div class="cards">`;

    // 1) Prognose mit der großen Zahl
    out += `<section class="card prob big" data-sec="ov" style="--i:0"><div class="top"><div class="big-n">${roller(r[kIdx])}<span class="pc">%</span></div>
        <span class="badge" style="background:${badge[1]};color:${badge[2]};--bgc:${badge[1]}">${badge[0]}</span></div>
      <div class="big-l">${esc(label)}</div><div class="big-s">${live ? `beim Stand von ${m.score[0]}:${m.score[1]} in der ${m.minute}. Minute${shortHanded(m)}` : 'vor dem Anpfiff'}</div>
      <div class="split" role="img" aria-label="Sieg ${esc(m.home)} ${r[0]} Prozent, Remis ${r[1]} Prozent, Sieg ${esc(m.away)} ${r[2]} Prozent">
        <i style="flex:${a.probs.home};background:${c.h};color:${c.h}"></i><i style="flex:${a.probs.draw};background:var(--draw);color:var(--draw)"></i><i style="flex:${a.probs.away};background:${c.a};color:${c.a}"></i></div>
      <div class="legend3"><div class="it">${crest(m.home, 24)}<div class="tx"><b>${r[0]} %</b><span>${esc(m.home)}</span></div></div>
        <div class="it"><span class="dot">X</span><div class="tx"><b>${r[1]} %</b><span>Remis</span></div></div>
        <div class="it"><div class="tx"><b>${r[2]} %</b><span>${esc(m.away)}</span></div>${crest(m.away, 24)}</div></div></section>`;

    // 1b) Top-Tipps zu diesem Spiel (man kommt ja über einen Tipp hierher)
    if (m.src === 'tips') out += tipsForGame(m, 1);

    // 2) Wahrscheinlichstes Ergebnis als Anzeigetafel, darunter die nächsten
    const t0 = a.top[0];
    const sCol = (s) => (s.h > s.a ? c.h : s.h < s.a ? c.a : 'var(--draw)');
    out += `<section class="card tip" data-sec="er" style="--i:1"><div class="eyebrow">Wahrscheinlichstes Ergebnis</div>
      <div class="board">${crest(m.home, 42)}<b>${t0.h}</b><span class="colon">:</span><b>${t0.a}</b>${crest(m.away, 42)}</div>
      <div class="meta"><span class="chip">${pct1(t0.p)}</span><span>${oneIn(t0.p)} endet so</span></div>
      <div class="scores">${a.top.slice(1).map((s) => `<div class="row srow"><span class="r">${s.h}:${s.a}</span><span class="mbar"><i style="width:${(s.p / t0.p * 100).toFixed(1)}%;background:${sCol(s)}"></i></span><span class="v">${pct1(s.p)}</span></div>`).join('')}</div></section>`;

    // 3) Alle Ergebnisse als Karte in Teamfarben
    out += `<section class="card" style="--i:2"><div class="card-h"><h3>Alle Ergebnisse</h3><span class="note">Chance in %</span></div>${heatmap(a, m, c)}</section>`;

    // 4) Quoten: Markt gegen eigene Rechnung
    if (m.kind === 'odds') out += oddsBlock(m, a, 3);

    // 5) Tore
    out += goalsCard(a, 4, favCol);

    // 6) Halbzeit & Doppelchance
    out += `<section class="card" data-sec="hz" style="--i:5"><div class="card-h"><h3>${a.ht ? 'Halbzeit & Doppelchance' : 'Doppelchance'}</h3></div>
      ${a.ht ? mini('Stand zur Halbzeit', `am ehesten ${a.ht.top[0].h}:${a.ht.top[0].a}`, [a.ht.home, a.ht.draw, a.ht.away], c, [m.home, 'Remis', m.away]) : ''}
      <div class="tiles t3" style="${a.ht ? '' : 'margin-top:0'}"><div class="tile"><span>${esc(m.home)} oder Remis</span><b>${pct0(a.double['1X'])}</b></div>
        <div class="tile"><span>kein Remis</span><b>${pct0(a.double['12'])}</b></div><div class="tile"><span>${esc(m.away)} oder Remis</span><b>${pct0(a.double.X2)}</b></div></div></section>`;

    // 7) Nächstes Tor: wer, und wann (Kurve)
    const nx = a.next;
    out += `<section class="card" data-sec="nt" style="--i:6"><div class="card-h"><h3>Nächstes Tor</h3><span class="note">${live ? `ab der ${m.minute}. Minute` : 'ab Anpfiff'}</span></div>
      ${mini('Wer trifft als Nächstes?', '', [nx.home, nx.none, nx.away], c, [m.home, 'keins', m.away])}
      ${curveSvg(nx, live ? m.minute : 0, favCol, m.id)}
      <div class="tiles t3 short"><div class="tile"><span>in 10 Min.</span><b>${pct0(nx.in10)}</b></div><div class="tile"><span>in 20 Min.</span><b>${pct0(nx.in20)}</b></div><div class="tile"><span>in 30 Min.</span><b>${pct0(nx.in30)}</b></div></div>
      <p class="muted" style="font-size:13px;margin-top:12px">${nx.median != null ? `50:50-Marke: Bis zur ${nx.median}. Minute ist mit halber Chance ein Tor gefallen.` : 'Eher fällt in diesem Spiel kein Tor mehr.'}</p></section>`;

    // 8) Erklärung
    out += `<section class="card explain" data-sec="ex" style="--i:7"><div class="card-h"><h3>So kommt die Zahl zustande</h3></div>${explain(m, a)}</section>`;
    out += `</div><p class="foot">${m.src === 'tips' ? `${m.mo ? 'Für dieses Spiel gibt es keine Marktpreise, die Chancen kommen allein aus den Team-Stärken.' : 'Chancen aus den Marktpreisen ohne die Marge der Buchmacher, Tore zusätzlich mit Result AI.'} Angezeigte Quoten nur von Tipico.<br>` : ''}${m.src === 'ratings' ? `Mit den Team-Stärken vom ${esc(fmtDay(m.day))} (${Object.keys(R.leagues).length || 'viele'} Ligen + Europapokal).<br>` : ''}Poisson-Tormodell mit Dixon-Coles · exakt, ohne Zufall.<br>Gleiches Spiel am selben Tag = gleiche Zahlen.</p></div>`;
    return out;
  }
  function heatmap(a, m, c) {
    const mx = Math.max(...a.matrix.flat());
    const tint = (x, y) => (x > y ? c.h : x < y ? c.a : '#8E8E93');
    let h = '<div class="heat"><span class="corner-cell"></span>' + [0, 1, 2, 3, 4, 5].map((y) => `<span class="ax">${y}</span>`).join('');
    for (let x = 0; x <= 5; x++) {
      h += `<span class="ax">${x}</span>`;
      for (let y = 0; y <= 5; y++) {
        const p = (a.matrix[x] || [])[y] || 0;
        const k = p / mx;
        const col = tint(x, y);
        h += `<span class="c${p === mx ? ' top' : ''}" style="--tc:${col}"><i style="background:${col};opacity:${(0.1 + 0.9 * k).toFixed(3)}"></i><em style="color:${k > 0.55 ? onColor(col) : 'var(--text)'}">${p >= 0.005 ? Math.round(p * 100) : ''}</em></span>`;
      }
    }
    return h + `</div><div class="heat-cap"><span>${crest(m.home, 18)}↓ Tore ${esc(m.home)}</span><span>Tore ${esc(m.away)} →${crest(m.away, 18)}</span></div>`;
  }
  // Tore im Spiel: Balken für 0, 1, … 6+ Tore, dazu Über/Unter und „beide treffen“
  function goalsCard(a, i, col) {
    const mx = Math.max(...a.totals);
    const cols = a.totals.map((p, n) => `<div class="col ${p === mx ? 'max' : ''}"><span class="pv">${p < 0.0005 ? '–' : pct0(p)}</span><i style="height:${Math.max(4, Math.round(p / mx * 108))}px"></i><span class="lb">${n === 6 ? '6+' : n}</span></div>`).join('');
    const ov = a.over.length > 3 ? a.over.slice(1, 4) : a.over.slice(0, 3); // „über 0,5“ sagt wenig – lieber 1,5 bis 3,5
    const tiles = ov.map((o) => `<div class="tile"><span>Über ${nf1.format(o.line)} Tore</span><b>${pct0(o.over)}</b></div>`).join('')
      + `<div class="tile"><span>Beide treffen</span><b>${a.btts > 0.9995 ? '✓' : pct0(a.btts)}</b></div>`;
    return `<section class="card" data-sec="to" style="--i:${i}"><div class="card-h"><h3>Tore im Spiel</h3><span class="note">insgesamt am Ende</span></div>
      <div class="bars7" style="--bc:${col || 'var(--text)'}" role="img" aria-label="Wahrscheinlichkeit für die Gesamtzahl der Tore">${cols}</div><div class="tiles">${tiles}</div></section>`;
  }
  // Kurve: Chance, dass bis zur Minute x (noch) ein Tor fällt
  function curveSvg(nx, from, col = 'var(--text)', uid = 'x') {
    const gid = 'cg-' + String(uid).replace(/[^a-z0-9_-]/gi, '');
    const pts = nx.curve || [];
    if (!pts.length) return '';
    const W = 330;
    const H = 132;
    const L = 34;
    const R = 12;
    const T = 14;
    const B = 22;
    const span = Math.max(1, 95 - from);
    const X = (mm) => L + ((mm - from) / span) * (W - L - R);
    const Y = (p) => T + (1 - p) * (H - T - B);
    const line = [[from, 0]].concat(pts.map((q) => [q.m, q.p]));
    const d = line.map(([mm, p], i) => `${i ? 'L' : 'M'}${X(mm).toFixed(1)} ${Y(p).toFixed(1)}`).join(' ');
    const area = `${d} L${X(95).toFixed(1)} ${Y(0).toFixed(1)} L${X(from).toFixed(1)} ${Y(0).toFixed(1)} Z`;
    const end = pts[pts.length - 1];
    const ticks = [from, 45, 90].filter((t, i, arr) => t >= from && arr.indexOf(t) === i && !(i > 0 && t - from < 12));
    return `<svg class="curve" viewBox="0 0 ${W} ${H}" role="img" aria-label="Chance auf ein Tor bis zur jeweiligen Minute">
      ${[0, 0.5, 1].map((p) => `<line class="grid" x1="${L}" x2="${W - R}" y1="${Y(p).toFixed(1)}" y2="${Y(p).toFixed(1)}"/><text x="${L - 6}" y="${(Y(p) + 4).toFixed(1)}" text-anchor="end">${Math.round(p * 100)} %</text>`).join('')}
      <defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${col}" stop-opacity=".34"/><stop offset="1" stop-color="${col}" stop-opacity="0"/></linearGradient></defs>
      <path class="area" d="${area}" style="fill:url(#${gid});opacity:1"/><path class="ln" d="${d}" style="stroke:${col}"/>
      ${ticks.map((t) => `<text x="${X(t).toFixed(1)}" y="${H - 4}" text-anchor="middle">${t}'</text>`).join('')}
      <circle class="pt" cx="${X(95).toFixed(1)}" cy="${Y(end.p).toFixed(1)}" r="4.5" style="stroke:${col}"/>
      <text class="pl" x="${(X(95) - 8).toFixed(1)}" y="${(Y(end.p) - 9).toFixed(1)}" text-anchor="end">${Math.round(end.p * 100)} % bis Abpfiff</text></svg>`;
  }
  function oddsBlock(m, a, i) {
    const q = RE.fromOdds(m.odds);
    const mk = RE.analyze({ lh: q.lh, la: q.la });
    // Result AI = eigene Rechnung aus den Team-Stärken; bei Top-Tipps steht die Ergebnis-Seite selbst auf den Quoten
    const own = m.model ? RE.analyze({ lh: m.model.lh, la: m.model.la }) : m.src === 'tips' ? null : a;
    const v = (x) => (x == null ? '–' : pct0(x));
    const ov = (r) => { const o = r && r.over.find((x) => x.line === 2.5); return o ? o.over : null; };
    const row = (l, x, y) => `<div class="cmp-row"><span>${l}</span><span class="v">${v(x)}</span><span class="v">${v(y)}</span></div>`;
    return `<section class="card" data-sec="mk" style="--i:${i}"><div class="card-h"><h3>Tipico vs. Result AI</h3><span class="note">${nf2.format(m.odds.home)} · ${nf2.format(m.odds.draw)} · ${nf2.format(m.odds.away)}</span></div>
      <div class="cmp-row h"><span>Ausgang</span><span class="v">Tipico</span><span class="v">Result AI</span></div>
      ${row(`Sieg ${esc(m.home)}`, q.market.home, own && own.probs.home)}${row('Remis', q.market.draw, own && own.probs.draw)}${row(`Sieg ${esc(m.away)}`, q.market.away, own && own.probs.away)}
      ${row('Über 2,5 Tore', ov(mk), ov(own))}
      <p class="muted" style="font-size:13px;margin-top:10px">Tipico = aus den Tipico-Quoten, ohne die Marge (${nf1.format(q.market.margin * 100)} %). Result AI = eigene Rechnung aus den Team-Stärken${own ? '' : ' – für dieses Spiel zu wenig Daten'}.</p></section>`;
  }
  function explain(m, a) {
    const xg = (v) => nf1.format(v);
    const live = m.kind === 'live';
    const fav = a.probs.home >= a.probs.away ? m.home : m.away;
    const facts = `<div class="facts"><span class="fact">${crest(m.home, 24)}<b>${xg(live ? a.rest.home : a.xg.home)}</b>${live ? 'Tore noch erwartet' : 'Tore erwartet'}</span>
      <span class="fact">${crest(m.away, 24)}<b>${xg(live ? a.rest.away : a.xg.away)}</b>${live ? 'Tore noch erwartet' : 'Tore erwartet'}</span></div>`;
    const ps = [];
    if (live) {
      const pre = RE.analyze({ lh: m.lh, la: m.la });
      ps.push(`Vor dem Anpfiff lag ${esc(m.home)} bei ${pct0(pre.probs.home)} Siegchance. Beim Stand von ${m.score[0]}:${m.score[1]} in der ${m.minute}. Minute fallen im Schnitt nur noch ${xg(a.rest.home + a.rest.away)} Tore – deshalb steht ${esc(m.home)} jetzt bei ${pct0(a.probs.home)}, und ein Remis ist auf ${pct0(a.probs.draw)} gestiegen.`);
    } else {
      ps.push(`${esc(m.home)} trifft in diesem Spiel im Schnitt ${xg(a.xg.home)}-mal, ${esc(m.away)} ${xg(a.xg.away)}-mal. Daraus ergeben sich ${pct0(Math.max(a.probs.home, a.probs.away))} für ${esc(fav)}.`);
    }
    ps.push(`Das wahrscheinlichste einzelne Ergebnis ist ${a.top[0].h}:${a.top[0].a} – aber auch das tritt nur in ${pct0(a.top[0].p)} der Fälle ein.`);
    return facts + ps.map((p) => `<p>${p}</p>`).join('');
  }

  // ------------------------------------------------------------------ Team-Stärken von heute (scripts/ratings.py, jeden Morgen neu)
  const R = { data: null, byId: {}, leagues: {}, loading: null };
  const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/ß/g, 'ss').replace(/[^a-z0-9]+/g, ' ').trim();
  // deutsche Spitznamen und Schreibweisen -> ESPN-Team-ID bzw. englischer Name
  const NICK = { bvb: '124', fcb: '132', 'fc bayern': '132', 'bayern munchen': '132', hsv: '127', b04: '131', rbl: '11420', svw: '137',
    vfb: '134', 'fc koln': '122', koln: '122', effzeh: '122', sge: '125', gladbach: '268', bmg: '268', s04: '133', fck: '130', ksc: '4471',
    tsg: '7911', fcu: '598', fca: '3841', scf: '126', wob: '138', m05: '2950', bsc: '129', fcn: '269', h96: '2428', fcsp: '270', svd: '3812', scp: '3307',
    mailand: 'milan', 'inter mailand': 'internazionale', 'ac mailand': 'ac milan', turin: 'torino', rom: 'roma', neapel: 'napoli', lissabon: 'lisbon',
    'paris saint germain': 'paris saint germain', psg: 'paris saint germain', 'real': 'real madrid', barca: 'barcelona', 'man utd': 'manchester united',
    'man city': 'manchester city', 'atletico': 'atletico madrid', juve: 'juventus' };
  // deutsche Anzeigenamen (wie bei kicker/Sportschau) – Schlüssel = Name in den Stärken (ESPN bzw. football-data)
  const DE = { 'FC Cologne': 'Köln', 'Hamburg SV': 'Hamburger SV', 'Fortuna Dusseldorf': 'Fortuna Düsseldorf', 'SpVgg Greuther Fürth': 'Greuther Fürth',
    'VfL Osnabruck': 'VfL Osnabrück', 'TSV Eintracht Braunschweig': 'Eintracht Braunschweig', 'Hertha Berlin': 'Hertha BSC',
    'Rapid Vienna': 'Rapid Wien', 'Austria Vienna': 'Austria Wien', 'SC Rheindorf Altach': 'Altach', 'WSG Swarovski Tirol': 'WSG Tirol',
    'BW Linz': 'Blau-Weiß Linz', 'SV Josko Ried': 'SV Ried', Wolfsberger: 'Wolfsberger AC', Zurich: 'FC Zürich', Sion: 'FC Sion',
    Internazionale: 'Inter Mailand', 'AC Milan': 'AC Mailand', Napoli: 'SSC Neapel', 'AS Roma': 'AS Rom', Lazio: 'Lazio Rom', Torino: 'FC Turin',
    Genoa: 'CFC Genua', Fiorentina: 'AC Florenz', 'Athletic Club': 'Athletic Bilbao', 'Real Betis': 'Betis Sevilla', Sevilla: 'FC Sevilla',
    Barcelona: 'FC Barcelona', Valencia: 'FC Valencia', 'Sporting CP': 'Sporting Lissabon', Benfica: 'Benfica Lissabon', Braga: 'Sporting Braga',
    'Club Brugge': 'FC Brügge', 'Union St.-Gilloise': 'Union Saint-Gilloise', 'F.C. København': 'FC Kopenhagen',
    'Red Star Belgrade': 'Roter Stern Belgrad', 'Slavia Prague': 'Slavia Prag', 'Sparta Prague': 'Sparta Prag', 'Viktoria Plzen': 'Viktoria Pilsen',
    'Dynamo Kyiv': 'Dynamo Kiew', 'Shakhtar Donetsk': 'Schachtar Donezk', 'Lech Poznan': 'Lech Posen', 'Legia Warsaw': 'Legia Warschau',
    Ferencvaros: 'Ferencváros', Olympiacos: 'Olympiakos Piräus', 'AEK Athens': 'AEK Athen', Fenerbahce: 'Fenerbahçe', Besiktas: 'Beşiktaş',
    'Istanbul Basaksehir': 'Başakşehir', Celtic: 'Celtic Glasgow', Rangers: 'Glasgow Rangers', Lyon: 'Olympique Lyon', Marseille: 'Olympique Marseille',
    Nice: 'OGC Nizza', 'Stade Rennais': 'Stade Rennes', Strasbourg: 'Racing Straßburg', Lille: 'OSC Lille', Lens: 'RC Lens', Toulouse: 'FC Toulouse',
    Brest: 'Stade Brest', 'Saint-Étienne': 'AS Saint-Étienne', 'Tottenham Hotspur': 'Tottenham', 'Wolverhampton Wanderers': 'Wolverhampton',
    'Brighton & Hove Albion': 'Brighton', 'Spartak Moscow': 'Spartak Moskau', 'Lokomotiv Moscow': 'Lokomotive Moskau', 'Dinamo Moscow': 'Dynamo Moskau',
    'CSKA Moscow': 'ZSKA Moskau', 'Rodina Moscow': 'Rodina Moskau', 'Zenit St Petersburg': 'Zenit St. Petersburg', 'Widzew Lodz': 'Widzew Łódź',
    'Lechia Gdansk': 'Lechia Danzig', 'Slask Wroclaw': 'Śląsk Breslau', 'Wieczysta Krakow': 'Wieczysta Krakau', 'Sparta Rotterdam': 'Sparta Rotterdam',
    'Metaloglobus Bucharest': 'Metaloglobus Bukarest' };
  function loadRatings() {
    if (R.data) return Promise.resolve(R.data);
    if (!R.loading) {
      R.loading = fetch('data/ratings.json', { cache: 'no-cache' }).then((r) => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); }).then((d) => {
        d.teams.forEach((t) => { R.byId[t.id] = t; t._k = [DE[t.name], t.name, t.short, t.abbr].concat(t.alias || []).filter(Boolean).map(norm); });
        (d.leagues || []).forEach((l) => { R.leagues[l.id] = l; });
        // eindeutige Anzeigenamen: Kurzname → bei Doppelung voller Name → sonst mit Land („Santos (Mexiko)“)
        const count = (f) => d.teams.reduce((c, t) => { const k = f(t); c[k] = (c[k] || 0) + 1; return c; }, {});
        const c1 = count(baseName);
        const lvl2 = (t) => (c1[baseName(t)] > 1 && !DE[t.name] ? t.name : baseName(t));
        const c2 = count(lvl2);
        d.teams.forEach((t) => { t._d = c2[lvl2(t)] > 1 ? `${lvl2(t)} (${R.leagues[t.lg] ? R.leagues[t.lg].country : 'Europapokal'})` : lvl2(t); });
        R.data = d;
        return d;
      }).catch((e) => { R.loading = null; throw e; });
    }
    return R.loading;
  }
  // Anzeigename: deutsch, sonst der kurze Name – außer ESPN-Kürzeln wie „D Dresden“, „C Palace“ oder „Nottm Forest“
  const baseName = (t) => DE[t.name] || (t.short && !/^[A-Z] |Nottm/.test(t.short) ? t.short : t.name);
  const tName = (t) => t._d || baseName(t);
  const lgName = (lg) => (R.leagues[lg] ? `${R.leagues[lg].name} · ${R.leagues[lg].country}` : 'Europapokal');
  const reg = (t) => { REG[tName(t)] = { logo: t.logo, color: t.color }; return tName(t); };
  // Suche: exakter Name > Anfang > alle Wörter enthalten; bei Gleichstand das Team mit mehr Spielen (größerer Verein)
  function searchTeams(q, n) {
    const raw = norm(q);
    if (!raw || !R.data) return [];
    const nick = NICK[raw];
    const pinned = nick && R.byId[nick] ? R.byId[nick] : null; // Spitzname mit fester Team-ID (z. B. „BVB“) steht ganz oben
    const k = nick && !pinned ? nick : raw;
    const words = k.split(' ');
    const hits = [];
    for (const t of R.data.teams) {
      if (t === pinned) continue;
      let best = 0;
      for (const a of t._k) {
        if (a === k) best = Math.max(best, 100);
        else if (a.startsWith(k)) best = Math.max(best, 80);
        else if (words.every((w) => a.split(' ').some((x) => x.startsWith(w)))) best = Math.max(best, 60);
        else if (k.length > 3 && a.includes(k)) best = Math.max(best, 40);
      }
      if (best) hits.push([best + Math.min(15, t.n / 6), t]);
    }
    const list = hits.sort((x, y) => (y[0] - x[0]) || (x[1].name < y[1].name ? -1 : 1)).map((x) => x[1]);
    return (pinned ? [pinned].concat(list) : list).slice(0, n);
  }
  // zuletzt gewählte Teams (oben in der Suche, z. B. der eigene Verein)
  const rememberTeam = (id) => store.set('recentTeams', [id].concat(store.get('recentTeams', []).filter((x) => x !== id)).slice(0, 6));

  // ------------------------------------------------------------------ Spiel selbst auswählen (ohne Screenshot)
  const P = { home: null, away: null, neutral: false, live: false, minute: 60, score: [0, 0], reds: [0, 0], msg: '' };
  const fmtDay = (iso) => { const d = new Date(iso); return isNaN(d) ? 'heute' : d.toLocaleDateString('de-DE', { day: 'numeric', month: 'long' }); };
  function vPick() {
    const d = R.data;
    if (!d) return '<h1 class="ptitle">Spiel auswählen</h1><div class="empty" style="margin-top:18px">Die Team-Stärken werden geladen …</div>';
    const slot = (side, label) => {
      const t = P[side] && R.byId[P[side]];
      return `<button class="slot ${t ? 'set' : ''}" data-act="slot" data-side="${side}"${t ? ` style="--sg:${rgba(teamColor(reg(t)), 0.16)};--sgd:${rgba(teamColor(reg(t)), 0.32)}"` : ''}>${t ? crest(reg(t), 46) : `<span class="slot-ph">${I.search}</span>`}
        <span class="grow"><span class="slot-l">${label}</span><span class="slot-n">${t ? esc(tName(t)) : 'Team suchen'}</span>${t ? `<span class="slot-s">${esc(lgName(t.lg))}</span>` : ''}</span><span class="chev">›</span></button>`;
    };
    return `${aura('pick')}<h1 class="ptitle">Spiel auswählen</h1><p class="psub">Zwei Vereine oder zwei Länder wählen.</p>
      <div class="card pick" style="margin-top:18px">${slot('home', 'Heim')}<div class="pick-vs"><span>gegen</span>${P.home || P.away ? `<button class="swap" data-act="swap" aria-label="Heim und Gast tauschen">${I.swap}</button>` : ''}</div>${slot('away', 'Gast')}</div>
      ${matchPreview()}
      <div class="card opts" style="margin-top:14px">
        <label class="tgl"><span class="grow"><b>Neutraler Platz</b><small>z. B. ein Finale – ohne Heimvorteil</small></span><input type="checkbox" data-act="opt" data-k="neutral" ${P.neutral ? 'checked' : ''}><i></i></label>
        <label class="tgl"><span class="grow"><b>Spiel läuft schon</b><small>Spielstand, Minute und rote Karten eingeben</small></span><input type="checkbox" data-act="opt" data-k="live" ${P.live ? 'checked' : ''}><i></i></label>
        ${P.live ? liveInputs() : ''}</div>
      ${P.msg ? `<div class="notice"><b>Das rechnet Result AI so nicht</b><p>${P.msg}</p></div>` : ''}
      <div style="margin-top:16px"><button class="btn" data-act="calc" ${P.home && P.away ? '' : 'disabled'}>Prognose berechnen</button></div>
      <p class="foot">Stärken vom ${esc(fmtDay(d.updatedAt))} · ${d.teams.length} Teams aus ${d.leagues.length} Ligen + Europapokal und Länderspielen<br>Jeden Morgen neu gerechnet – am selben Tag immer dieselben Zahlen.</p>`;
  }
  const stepper = (k, i, v) => `<span class="stepper"><button data-act="step" data-k="${k}" data-i="${i}" data-d="-1" aria-label="weniger">−</button><b>${v}</b><button data-act="step" data-k="${k}" data-i="${i}" data-d="1" aria-label="mehr">+</button></span>`;
  function liveInputs() {
    const h = P.home && R.byId[P.home];
    const a = P.away && R.byId[P.away];
    return `<div class="live-in"><div class="li-row"><span>Minute</span><b class="li-min">${P.minute}'</b></div>
      <input type="range" min="1" max="90" value="${P.minute}" data-act="minute" aria-label="Spielminute">
      <div class="li-grid"><span></span><span class="li-h">${h ? esc(tName(h)) : 'Heim'}</span><span class="li-h">${a ? esc(tName(a)) : 'Gast'}</span>
        <span>Tore</span>${stepper('score', 0, P.score[0])}${stepper('score', 1, P.score[1])}
        <span>Rote Karten</span>${stepper('reds', 0, P.reds[0])}${stepper('reds', 1, P.reds[1])}</div></div>`;
  }
  function openSearch(side) {
    if ($('.sheet')) return;
    const sh = document.createElement('div');
    sh.className = 'sheet';
    sh.innerHTML = `<div class="bg" data-act="close"></div><div class="panel tall" role="dialog" aria-label="Team suchen"><div class="grip" data-grip></div>
      <h2>${side === 'home' ? 'Heim-Team' : 'Gast-Team'}</h2>
      <input class="search" type="search" placeholder="z. B. BVB, Arsenal, Deutschland …" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" enterkeyhint="search" data-act="search" data-side="${side}" aria-label="Team suchen">
      <div class="results"></div></div>`;
    document.body.appendChild(sh);
    renderResults(sh, '');
    $('input', sh).focus(); // noch im Antippen, sonst öffnet iOS die Tastatur nicht
  }
  function renderResults(sh, q) {
    const side = $('input', sh).dataset.side;
    const rows = (list) => `<div class="card flush">${list.map((t) => `<button class="row res-row" data-act="choose" data-id="${esc(t.id)}" data-side="${side}">${crest(reg(t), 34)}<span class="grow"><div class="t">${esc(tName(t))}</div><div class="s">${esc(lgName(t.lg))}</div></span></button>`).join('')}</div>`;
    const lg = sh.dataset.lg;
    let html;
    if (q.trim()) {
      const list = searchTeams(q, 14);
      html = list.length ? rows(list) : '<div class="empty">Kein Team gefunden. Versuch es mit einem anderen Namen, zum Beispiel dem Ort.</div>';
    } else if (lg && R.leagues[lg]) {
      const list = R.data.teams.filter((t) => t.lg === lg).sort((x, y) => (lg === 'nat' ? y.att + y.def - x.att - x.def : tName(x).localeCompare(tName(y), 'de')));
      html = `<button class="lg-back" data-act="lgback">‹ Alle Ligen</button><div class="lab">${esc(R.leagues[lg].name.toUpperCase())}</div>${rows(list)}`;
    } else {
      const recent = store.get('recentTeams', []).map((id) => R.byId[id]).filter(Boolean);
      const lrow = (l) => `<button class="row res-row" data-act="lgopen" data-lg="${esc(l.id)}"><span class="grow"><div class="t">${esc(l.name)}</div></span><span class="chev">›</span></button>`;
      const TOP = ['Deutschland', 'England', 'Spanien', 'Italien', 'Frankreich'];
      const rank = (c) => { const i = TOP.indexOf(c); return i < 0 ? 99 : i; };
      const groups = {};
      R.data.leagues.filter((l) => l.id !== 'nat').forEach((l) => { (groups[l.country] = groups[l.country] || []).push(l); });
      const countries = Object.keys(groups).sort((a, b) => (rank(a) - rank(b)) || a.localeCompare(b, 'de'));
      html = (recent.length ? `<div class="lab">ZULETZT GEWÄHLT</div>${rows(recent)}<div class="lab" style="margin-top:20px">LÄNDERSPIELE</div>` : '<div class="lab">LÄNDERSPIELE</div>')
        + (R.leagues.nat ? `<div class="card flush">${lrow({ id: 'nat', name: 'Nationalteams' })}</div>` : '')
        + countries.map((c) => `<div class="lab" style="margin-top:20px">${esc(c.toUpperCase())}</div><div class="card flush">${groups[c].map(lrow).join('')}</div>`).join('');
    }
    $('.results', sh).innerHTML = html;
  }
  // erwartete Tore aus den Stärken (Nationalteams haben ihr eigenes Modell)
  function lamOf(h, a, neutral) {
    const md = h.nat ? R.data.natModel : R.data.model;
    return { lh: Math.exp(md.mu + (neutral ? 0 : md.h) + h.att - a.def), la: Math.exp(md.mu + a.att - h.def) };
  }
  function calcPick() {
    const h = R.byId[P.home];
    const a = R.byId[P.away];
    if (!h || !a) return;
    if (h.id === a.id) { P.msg = 'Bitte zwei verschiedene Teams wählen.'; redrawTop(); return; }
    if (h.grp !== a.grp) {
      P.msg = !!h.nat !== !!a.nat ? 'Ein Nationalteam und ein Verein spielen nicht gegeneinander. Bitte zwei Vereine oder zwei Länder wählen.' : `${esc(tName(h))} und ${esc(tName(a))} spielen in Ligen, die nie über gemeinsame Gegner verbunden waren (z. B. Europa und Südamerika). Die Zahlen wären geraten, deshalb rechnet Result AI das nicht.`;
      redrawTop();
      return;
    }
    P.msg = '';
    const day = String(R.data.updatedAt).slice(0, 10);
    const id = ['p', h.id, a.id, P.neutral ? 'n' : 'h', P.live ? `${P.minute}-${P.score.join('-')}-${P.reds.join('-')}` : 'vor', day].join('_');
    const sameLg = h.lg && h.lg === a.lg;
    const m = { id, kind: P.live ? 'live' : 'pre', src: 'ratings', day, at: Date.now(),
      comp: h.nat ? 'Länderspiel' : sameLg ? R.leagues[h.lg].name : 'Selbst ausgewählt', when: P.neutral ? 'neutraler Platz' : sameLg ? 'selbst ausgewählt' : '',
      home: reg(h), away: reg(a), teams: { [tName(h)]: { logo: h.logo, color: h.color }, [tName(a)]: { logo: a.logo, color: a.color } },
      ...lamOf(h, a, P.neutral) };
    if (P.live) Object.assign(m, { minute: P.minute, half: P.minute > 45 ? 2 : 1, score: P.score.slice(), reds: P.reds.slice() });
    const hist = store.get('history', []).filter((x) => x.id !== id);
    hist.unshift(m);
    store.set('history', hist.slice(0, 50));
    location.hash = '#/r/' + encodeURIComponent(id);
  }
  // oberste Seite neu zeichnen (z. B. nach einer Eingabe), Scrollstand bleibt
  function redrawTop() { redrawPage(S.stack[S.stack.length - 1]); }
  function redrawPage(p) {
    if (!p || !p.el.isConnected) return;
    const y = p.el.scrollTop;
    p.el.innerHTML = barHtml(p.path) + `<div class="wrap">${viewHtml(p.path)}</div>`;
    p.drawn = { tips: T.at, ratings: !!R.data, err: T.err };
    p.el._geo = null;
    p.el.scrollTop = y;
  }

  // ------------------------------------------------------------------ Top-Tipps (scripts/tips.py sucht jede Stunde neu)
  // Chance = aus den Marktpreisen (Backtest: am genauesten), Tore zusätzlich mit Result AI. Angezeigte Quoten nur von Tipico, sonst „k. A.“.
  const T = { data: null, loading: null, at: 0, err: false, list: 'safe', day: 'all', seen: {} };
  // wie frisch ist die letzte Tipp-Suche? ok (unter 1,5 Std.) · warn (unter 6 Std.) · bad – ehrlich statt immer grün
  const freshness = (iso) => { const h = (Date.now() - new Date(iso).getTime()) / 36e5; return h < 1.5 ? 'ok' : h < 6 ? 'warn' : 'bad'; };
  function loadTips(maxAge) {
    if (T.data && Date.now() - T.at < (maxAge == null ? 10 * 60e3 : maxAge)) return Promise.resolve(T.data);
    if (!T.loading) {
      T.loading = fetch('data/tips.json', { cache: 'no-cache' })
        .then((r) => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
        .then((d) => { T.data = d; T.at = Date.now(); T.err = false; return d; })
        .catch((e) => { T.err = true; throw e; })
        .finally(() => { T.loading = null; });
    }
    return T.loading;
  }
  // Team eines Tipps: deutscher Name aus den Stärken (falls bekannt), Wappen/Farbe von ESPN
  function tipTeam(t) {
    const r = R.byId[t.id];
    const name = r ? tName(r) : DE[t.name] || (t.short && !/^[A-Z] |Nottm/.test(t.short) ? t.short : t.name);
    if (!REG[name] || !REG[name].logo) REG[name] = { logo: t.logo || (r && r.logo) || null, color: t.color || (r && r.color) || null };
    return name;
  }
  function tipLabel(code, h, a) {
    if (/^[OU]\d\d$/.test(code)) return `${code[0] === 'O' ? 'Über' : 'Unter'} ${code[1]},${code[2]} Tore`;
    return { H: `Sieg ${h}`, D: 'Unentschieden', A: `Sieg ${a}`, HD: `${h} oder Remis`, DA: `${a} oder Remis`, HA: 'Kein Unentschieden',
      BY: 'Beide Teams treffen', BN: 'Nicht beide treffen', HS: `${h} trifft`, AS: `${a} trifft` }[code] || code;
  }
  const tipKind = (code) => (['H', 'D', 'A'].includes(code) ? 'Sieg' : ['HD', 'DA', 'HA'].includes(code) ? 'Doppelchance'
    : /^[OU]/.test(code) ? 'Tore' : code[0] === 'B' ? 'Beide treffen' : 'Team trifft');
  const dayStart = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const dayDiff = (iso) => Math.round((dayStart(new Date(iso)) - dayStart(new Date())) / 864e5);
  function kickoff(iso) {
    const d = new Date(iso);
    const hm = d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
    const k = dayDiff(iso);
    const wd = ['So.', 'Mo.', 'Di.', 'Mi.', 'Do.', 'Fr.', 'Sa.'][d.getDay()];
    return k === 0 ? `Heute, ${hm}` : k === 1 ? `Morgen, ${hm}` : k > 6 ? `${wd}, ${d.getDate()}.${d.getMonth() + 1}., ${hm}` : `${wd}, ${hm}`;
  }
  const dayKey = (iso) => String(dayDiff(iso));
  const dayLabel = (k) => (k === '0' ? 'Heute' : k === '1' ? 'Morgen' : new Date(dayStart(new Date()) + (+k) * 864e5 + 432e5).toLocaleDateString('de-DE', { weekday: 'long' }));
  const upcoming = (t) => T.data && T.data.games[t.g] && new Date(T.data.games[t.g].t).getTime() > Date.now();
  const qTxt = (t) => (t.q == null ? 'k. A.' : nf2.format(t.q));
  const ring = (p) => `<span class="ring" role="img" aria-label="Chance ${Math.round(p * 100)} Prozent"><svg viewBox="0 0 36 36" aria-hidden="true"><circle class="bgc" cx="18" cy="18" r="15.5" pathLength="100"/><circle class="fgc" cx="18" cy="18" r="15.5" pathLength="100" stroke-dasharray="${(p * 100).toFixed(1)} 100"/></svg><b>${Math.round(p * 100)}<small>%</small></b></span>`;

  // Spiel eines Tipps als Ergebnis-Seite (Quoten-Spiel): Tor-Erwartung aus den Quoten, Result AI als zweite Meinung
  function tipMatchById(id) {
    if (T.seen[id]) return T.seen[id];
    const g = T.data && T.data.games[id.slice(2)];
    if (!g) return null;
    const o = g.odds || {};
    let odds = null;
    if (o.H && o.D && o.A) {
      odds = { home: o.H, draw: o.D, away: o.A };
      const k = g.line ? String(Math.round(g.line * 10)) : '';
      if (k && o['O' + k] && o['U' + k]) Object.assign(odds, { line: g.line, over: o['O' + k], under: o['U' + k] });
    }
    const m = { id, kind: odds ? 'odds' : 'pre', src: 'tips', comp: g.comp, when: kickoff(g.t), home: tipTeam(g.home), away: tipTeam(g.away),
      lh: g.lh, la: g.la, odds, model: g.mlh ? { lh: g.mlh, la: g.mla } : null, gid: g.id, market: !g.mo, mo: !!g.mo };
    T.seen[id] = m;
    return m;
  }
  // „Tipps zu diesem Spiel“ auf der Ergebnis-Seite – jeder Tipp lässt sich als Wette speichern
  const LISTS = [['safe', 'Sicher'], ['rec', 'Empfohlen'], ['top', 'Top-Quote']];
  function tipsForGame(m, i) {
    if (!T.data) return '';
    const seen = new Set();
    const keys = savedKeys();
    const list = LISTS.flatMap(([k, l]) => (T.data[k] || []).filter((t) => t.g === m.gid).map((t) => [t, l, k]))
      .filter(([t]) => !seen.has(t.m) && seen.add(t.m));
    if (!list.length) return '';
    return `<section class="card" data-sec="tp" style="--i:${i}"><div class="card-h"><h3>Top-Tipps zu diesem Spiel</h3><span class="note">jede Stunde neu</span></div>
      ${list.map(([t, l, k]) => { const on = keys.has(`${t.g}|${t.m}`); return `<div class="tg-row"><span class="grow"><span class="k">${l} · ${tipKind(t.m)}</span><b>${esc(tipLabel(t.m, m.home, m.away))}</b></span>${ring(t.p)}<span class="tg-q"><span>Quote</span><b>${qTxt(t)}</b></span>
        <button class="gsave${on ? ' on' : ''}" data-act="savetip" data-list="${k}" data-g="${esc(t.g)}" data-m="${esc(t.m)}" aria-label="${on ? 'Gespeichert – zu den Wetten' : 'Als Wette speichern'}">${on ? I.check : I.save}</button></div>`; }).join('')}</section>`;
  }

  function tipCard(t, i, list) {
    const g = T.data.games[t.g];
    const h = tipTeam(g.home);
    const a = tipTeam(g.away);
    const hcl = teamColor(h);
    const acl = teamColor(a);
    const pc = Math.round(t.p * 100);
    const bars = g.mo
      ? `<div class="cmp2"><div class="ai"><span>Result AI</span><i><em style="width:${pc}%"></em></i><b>${pc} %</b></div></div>`
      : `<div class="cmp2"><div><span>Markt</span><i><em style="width:${pc}%"></em></i><b>${pc} %</b></div>
        <div class="ai"><span>Result AI</span><i><em style="width:${t.pm != null ? Math.round(t.pm * 100) : 0}%"></em></i><b>${t.pm != null ? Math.round(t.pm * 100) + ' %' : '–'}</b></div></div>`;
    return `<a class="tcard ${list}" href="#/r/t_${esc(g.id)}" style="--i:${Math.min(i, 8)};--hg:${rgba(hcl, 0.1)};--ag:${rgba(acl, 0.1)};--hgd:${rgba(hcl, 0.22)};--agd:${rgba(acl, 0.22)}">
      <div class="tc-top"><span class="tc-comp">${esc(g.comp)}</span><span class="tc-time">${esc(kickoff(g.t))}</span></div>
      <div class="tc-main"><div class="tc-teams"><span class="tm">${crest(h, 24)}<span>${esc(h)}</span></span><span class="tm">${crest(a, 24)}<span>${esc(a)}</span></span></div>${ring(t.p)}</div>
      <div class="tc-bet"><div class="grow"><span class="k">${tipKind(t.m)}</span><b>${esc(tipLabel(t.m, h, a))}</b></div><div class="tc-q"><span class="k">Quote</span><b>${qTxt(t)}</b></div></div>
      ${bars}
      ${saveBtn(B.keys.has(`${t.g}|${t.m}`), `data-act="savetip" data-list="${list}" data-g="${esc(t.g)}" data-m="${esc(t.m)}"`, 'Wette speichern')}</a>`;
  }
  // Speichern-Knopf auf Tipp- und Kombi-Karten: einmal gespeichert → „Gespeichert“ (Antippen öffnet die Wetten)
  const saveBtn = (on, attrs, label) => `<button class="tsave${on ? ' on' : ''}" ${attrs}>${on ? I.check : I.save}<span>${on ? 'Gespeichert · in Wetten' : label}</span></button>`;
  function kombisHtml(d) {
    const all = d.top.concat(d.safe, d.rec || []);
    const cards = d.kombis.map((k, idx) => {
      const legs = k.legs.map((l) => all.find((t) => t.g === l.g && t.m === l.m));
      if (!legs.length || !legs.every((t) => t && upcoming(t))) return ''; // ein Spiel läuft schon → nicht mehr spielbar
      return `<section class="kombi ${k.kind}"><div class="k-head"><div><span class="k-eb">${esc(k.name)}</span><h3>${legs.length} Tipps auf einem Schein</h3></div>
          <div class="k-q"><span>Gesamtquote</span><b>${k.q == null ? 'k. A.' : nf2.format(k.q)}</b></div></div>
        <div class="k-legs">${legs.map((t) => {
          const g = d.games[t.g];
          const h = tipTeam(g.home);
          const a = tipTeam(g.away);
          return `<a class="k-leg" href="#/r/t_${esc(g.id)}"><span class="duo">${crest(h, 26, true)}${crest(a, 26, true)}</span><span class="grow"><b>${esc(tipLabel(t.m, h, a))}</b><span>${esc(h)} – ${esc(a)} · ${esc(kickoff(g.t))}</span></span><span class="k-lp"><b>${Math.round(t.p * 100)} %</b><span>${qTxt(t)}</span></span></a>`;
        }).join('')}</div>
        <div class="k-foot"><span>Chance, dass alle aufgehen</span><b>${pct0(k.p)}</b></div>
        <div class="k-save">${saveBtn(B.keys.has(kombiKey(k)), `data-act="savekombi" data-i="${idx}"`, 'Kombi speichern')}</div></section>`;
    }).join('');
    return '<p class="tl-note">Kombi = mehrere Tipps auf einem Schein: Die Quoten werden malgenommen – aber jeder einzelne Tipp muss aufgehen.</p>'
      + (cards || '<div class="empty" style="margin-top:14px">Gerade keine Kombi – die nächste Suche läuft in spätestens einer Stunde.</div>');
  }
  // Filter der Tipp-Listen: nur der Zeitraum (3 Wochen voraus) – die Wettbewerbs-Leiste hat Niklas am 06.11.2026 rausgenommen
  const PERIODS = [['all', 'Alle Tage'], ['0', 'Heute'], ['1', 'Morgen'], ['week', 'Diese Woche'], ['later', 'Später']];
  const inPeriod = (iso, k) => { const dd = dayDiff(iso); return k === 'all' || (k === 'week' ? dd <= 6 : k === 'later' ? dd > 6 : String(dd) === k); };
  const NOTES = {
    safe: 'Chance ab 70 %. Oben steht, worin sich Markt und Result AI am einigsten sind.',
    rec: 'Von Result AI empfohlen: mindestens 55 % Chance bei guter Quote, und Result AI sieht die Wette mindestens so gut wie der Markt.',
    top: 'Höhere Quote bei über 50 % Chance. Hier zählt vor allem die Quote.',
  };
  function tipsBody() {
    const d = T.data;
    B.keys = savedKeys();
    if (T.list === 'kombi') return kombisHtml(d);
    if (!d[T.list]) return '<div class="empty" style="margin-top:14px">„Empfohlen“ kommt mit der nächsten Tipp-Suche – spätestens in einer Stunde.</div>';
    const all = d[T.list].filter(upcoming);
    const per = PERIODS.filter(([k]) => k === 'all' || all.some((t) => inPeriod(d.games[t.g].t, k)));
    if (!per.some(([k]) => k === T.day)) T.day = 'all';
    const shown = all.filter((t) => inPeriod(d.games[t.g].t, T.day));
    return `<div class="chips">${per.map(([k, l]) => `<button class="${T.day === k ? 'on' : ''}" data-act="tday" data-val="${esc(k)}">${esc(l)}</button>`).join('')}</div>`
      + `<p class="tl-note">${NOTES[T.list]}</p>` + (shown.length ? `<div class="tlist">${shown.slice(0, 40).map((t, i) => tipCard(t, i, T.list)).join('')}</div>`
      : '<div class="empty" style="margin-top:14px">Gerade keine passenden Tipps – die nächste Suche läuft in spätestens einer Stunde.</div>');
  }
  // Bilanz der letzten 30 Tage: alle angezeigten Tipps, nach dem Abpfiff ausgewertet (eigene Abteilung auf dem Start, Niklas 08.11.2026)
  const REC_LISTS = [['safe', 'Sicher'], ['rec', 'Empfohlen'], ['top', 'Top-Quote']];
  const recRow = (label, x) => (x && x.n
    ? `<div class="rec-row"><span class="grow"><b>${label}</b><small>${x.won} von ${x.n} richtig</small></span><span class="rp"><b>${pctR(x.won / x.n)}</b><small>erwartet ${pct0(x.exp / x.n)}</small></span></div>`
    : `<div class="rec-row"><span class="grow"><b>${label}</b><small>noch keine beendeten Spiele</small></span></div>`);
  function recTotals(d) {
    const r = d.record || {};
    return REC_LISTS.map(([k]) => (r[k] || {})['30'] || { n: 0, won: 0, exp: 0 }).reduce((a, x) => ({ n: a.n + x.n, won: a.won + x.won, exp: a.exp + x.exp }), { n: 0, won: 0, exp: 0 });
  }
  function bilanzCard() {
    if (!T.data) return `<div class="empty">${T.err ? 'Die Bilanz ist gerade nicht erreichbar.' : 'Die Bilanz wird geladen …'}</div>`;
    const r = T.data.record || {};
    const t = recTotals(T.data);
    if (!t.n) return '<div class="empty">Noch keine beendeten Spiele. Jeder Tipp wird nach dem Abpfiff ehrlich ausgewertet.</div>';
    const cells = REC_LISTS.filter(([k]) => r[k]).map(([k, l]) => { const x = r[k]['30'] || { n: 0 }; return `<div><span>${l}</span><b>${x.n ? pctR(x.won / x.n) : 'k. A.'}</b><small>${x.n ? `${x.won} von ${x.n}` : ''}</small></div>`; }).join('');
    return `<a class="card bil" href="#/bilanz"><div class="rec-hero">${ring(t.won / t.n)}<div class="grow"><b>${t.won} von ${t.n}</b><span>Tipps aufgegangen · erwartet ${pct0(t.exp / t.n)}</span></div><span class="chev">›</span></div><div class="bil-3">${cells}</div></a>`;
  }
  function vBilanz() {
    const head = aura('hist') + '<h1 class="ptitle">Bilanz</h1><p class="psub">Jeder angezeigte Tipp wird festgehalten und nach dem Abpfiff ausgewertet, auch die, die danebengehen.</p>';
    const d = T.data;
    if (!d) return head + `<div class="empty" style="margin-top:18px">${T.err ? 'Die Bilanz konnte gerade nicht geladen werden.' : 'Die Bilanz wird geladen …'}</div>`;
    const r = d.record || {};
    const t = recTotals(d);
    const recent = (d.recent || []).slice(0, 30).map((e) => {
      const h = tipTeam({ id: e.hid, name: e.home });
      const a = tipTeam({ id: e.aid, name: e.away });
      return `<div class="rec-it ${e.res.won ? 'won' : 'lost'}"><span class="mk">${e.res.won ? '✓' : '✗'}</span><span class="grow"><b>${esc(tipLabel(e.m, h, a))}</b><span>${esc(h)} ${e.res.hs}:${e.res.as} ${esc(a)}</span></span><span class="rp2">${pct0(e.p)}</span></div>`;
    }).join('');
    return head + `<div class="card rec" style="margin-top:16px">${t.n ? `<div class="rec-hero">${ring(t.won / t.n)}<div class="grow"><b>${t.won} von ${t.n}</b><span>Tipps aufgegangen · erwartet ${pct0(t.exp / t.n)}</span></div></div>` : ''}${REC_LISTS.filter(([k]) => r[k] || k !== 'rec').map(([k, l]) => recRow(l, (r[k] || {})['30'])).join('')}</div>
      ${recent ? `<section class="sec"><div class="sec-h"><h2>Zuletzt ausgewertet</h2></div><div class="card rec"><div class="rec-list" style="border-top:0">${recent}</div></div></section>` : ''}
      <p class="foot">Gezählt werden die letzten 30 Tage. „Erwartet“ ist die Quote an Treffern, die Result AI vorher selbst genannt hat. Nah beieinander heißt: Die Prozente stimmen.</p>`;
  }
  function vTips() {
    const head = aura('tips') + '<h1 class="ptitle">Top-Tipps</h1>';
    const d = T.data;
    if (!d) return head + `<div class="empty" style="margin-top:18px">${T.err ? 'Die Tipps konnten gerade nicht geladen werden. Prüf die Verbindung.' : 'Die Tipps werden geladen …'}</div>`;
    const tabs = [['safe', 'Sicher'], ['rec', 'Empfohlen'], ['top', 'Top-Quote'], ['kombi', 'Kombis']];
    const k = Math.max(0, tabs.findIndex((x) => x[0] === T.list));
    const upd = new Date(d.updatedAt);
    const hint = d.tipico && d.tipico.connected ? '' : '<div class="hint">Tipico ist noch nicht verbunden, deshalb steht bei den Quoten „k. A.“. Die Chancen stimmen trotzdem.</div>';
    return head + `<p class="psub"><i class="fresh ${freshness(d.updatedAt)}"></i>Gesucht ${esc(ago(d.updatedAt))} · jede Stunde neu · 3 Wochen voraus</p>${hint}
      <div class="seg s4" style="--k:${k};margin-top:14px"><span class="ind"></span>${tabs.map(([v, l]) => `<button class="${T.list === v ? 'on' : ''}" data-act="tlist" data-val="${v}">${l}</button>`).join('')}</div>
      <div class="tips-body">${tipsBody()}</div>
      <p class="foot">Gesucht ${esc(isNaN(upd) ? '' : (dayDiff(d.updatedAt) === 0 ? 'heute' : 'am ' + upd.toLocaleDateString('de-DE')) + ' um ' + upd.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }))} · ${esc(d.source)}<br>
      Chance aus den Marktpreisen ohne die Marge der Buchmacher, Tore zusätzlich mit Result AI. Angezeigte Quoten nur von Tipico, unbekannt = „k. A.“.<br>
      Auch ein Tipp mit 80 % geht etwa jedes 5. Mal schief. ${RG_TEXT}</p>`;
  }
  // Tipps (und Namen aus den Stärken) frisch holen; Seite nur neu zeichnen, wenn sich etwas geändert hat
  function freshTips(p, maxAge) {
    Promise.all([loadTips(maxAge), loadRatings().catch(() => {})]).catch(() => {}).then(() => {
      if (!p.el.isConnected) return;
      const now = { tips: T.at, ratings: !!R.data, err: T.err };
      if (p.drawn && p.drawn.tips === now.tips && p.drawn.ratings === now.ratings && p.drawn.err === now.err) return;
      if (p.path.startsWith('/r/') && p.drawn && p.drawn.tips) return; // Ergebnis-Seite steht schon
      if (p.path === '/') {
        $$('.tips-prev', p.el).forEach((x) => { x.innerHTML = tipCarousel(); });
        $$('.bil-slot', p.el).forEach((x) => { x.innerHTML = bilanzCard(); });
        $$('.spot-slot', p.el).forEach((x) => { x.innerHTML = spotlight(); });
        $$('.kib', p.el).forEach((x) => { x.innerHTML = kiBadge(); });
        p.drawn = now;
      } else redrawPage(p);
    });
  }

  // ------------------------------------------------------------------ Verlauf (eigener Bereich in der Leiste unten)
  function vHist() {
    const hist = store.get('history', []);
    const auto = betsAll().filter((b) => b.auto);
    const s = betStats();
    const nOpen = auto.filter((b) => b.status === 'open').length;
    return `${aura('hist')}<h1 class="ptitle">Verlauf</h1><p class="psub">Deine Wetten aus den Top-Tipps und deine Prognosen – nur auf diesem Handy gespeichert.</p>
      <a class="card accrow" href="#/acc">${s.n ? ring(s.won / s.n) : `<span class="round">${I.target}</span>`}<span class="grow"><b>Erfolgsquote</b><span>${s.n ? `${s.won} von ${s.n} Wetten gewonnen · ${signed(s.pl)}` : nOpen ? `${nOpen} ${nOpen === 1 ? 'Wette wartet' : 'Wetten warten'} auf den Abpfiff` : 'Noch keine Wette ausgewertet'}</span></span><span class="chev">›</span></a>
      <section class="sec"><div class="sec-h"><h2>Deine Wetten</h2><span class="note">aus den Top-Tipps</span></div>
        ${auto.length ? histBets(auto) : '<div class="empty">Noch keine gespeichert. Tipp in den Top-Tipps bei einer Wette auf „Wette speichern“ – Result AI prüft sie nach dem Abpfiff selbst.</div>'}</section>
      <section class="sec"><div class="sec-h"><h2>Deine Prognosen</h2>${hist.length ? `<span class="note">${hist.length}</span>` : ''}</div>
        ${hist.length ? histGrouped(hist) : '<div class="empty">Noch keine Prognosen. Wähl ein Spiel aus oder scanne einen Screenshot – alles landet hier.</div>'}</section>`;
  }

  // ------------------------------------------------------------------ KI-Zentrale: Protokoll der automatischen Rechner
  // (scripts/activity.py: jede Tipp-Suche und jeder Stärken-Lauf schreibt, was neu dazukam)
  const A = { data: null, loading: null, at: 0, err: false, open: {} };
  function loadActivity(maxAge) {
    if (A.data && Date.now() - A.at < (maxAge == null ? 60e3 : maxAge)) return Promise.resolve(A.data);
    if (!A.loading) {
      A.loading = fetch('data/activity.json', { cache: 'no-cache' })
        .then((r) => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
        .then((d) => { A.data = d; A.at = Date.now(); A.err = false; return d; })
        .catch((e) => { A.err = true; throw e; })
        .finally(() => { A.loading = null; });
    }
    return A.loading;
  }
  const JOBS = {
    tips: { name: 'Tipp-Suche', every: 'jede Stunde', icon: 'flame', warn: 2.5, bad: 6 },
    ratings: { name: 'Stärken-Rechner', every: 'jeden Morgen', icon: 'chart', warn: 30, bad: 50 },
  };
  function ago(iso) {
    const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60e3));
    if (m < 1) return 'gerade eben';
    if (m < 60) return `vor ${m} Min.`;
    const h = Math.floor(m / 60);
    if (h < 24) return `vor ${h} Std.`;
    return agoText(new Date(iso).getTime());
  }
  const hm = (iso) => new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  function runLine(r) {
    const s = r.sum || {};
    if (r.job === 'tips') {
      const parts = [];
      if (s.new) parts.push(s.new === 1 ? '1 neuer Tipp' : `${s.new} neue Tipps`);
      if (s.moved) parts.push(`${s.moved} angepasst`);
      if (s.gone) parts.push(`${s.gone} raus`);
      if (s.checked) parts.push(`${s.checked} ausgewertet (${s.won} ✓)`);
      return parts.length ? parts.join(' · ') : `${s.games || 0} Spiele geprüft · keine Änderung`;
    }
    const parts = [`${s.teams} Teams neu berechnet`];
    if (s.newGames) parts.push(`${s.newGames} neue Spiele`);
    if (s.newTeams) parts.push(`${s.newTeams} neue Teams`);
    return parts.join(' · ');
  }
  function runDetails(r) {
    let h = '';
    if (r.job === 'tips') {
      if (r.added && r.added.length) {
        h += `<div class="kd-h">Neu in den Listen</div>${r.added.map((t) => {
          const hn = tipTeam({ id: t.hid, name: t.h });
          const an = tipTeam({ id: t.aid, name: t.a });
          return `<div class="kd-row"><span class="duo">${crest(hn, 24, true)}${crest(an, 24, true)}</span><span class="grow"><b>${esc(tipLabel(t.m, hn, an))}</b><span>${esc(hn)} – ${esc(an)} · ${esc(t.comp)} · ${esc(kickoff(t.kick))}</span></span><span class="kd-v"><b>${Math.round(t.p * 100)} %</b></span></div>`;
        }).join('')}`;
      }
      if (r.results && r.results.length) {
        h += `<div class="kd-h">Ausgewertet</div>${r.results.map((t) => {
          const hn = tipTeam({ id: t.hid, name: t.h });
          const an = tipTeam({ id: t.aid, name: t.a });
          return `<div class="kd-row"><span class="mk ${t.won ? 'won' : 'lost'}">${t.won ? '✓' : '✗'}</span><span class="grow"><b>${esc(tipLabel(t.m, hn, an))}</b><span>${esc(hn)} ${esc(t.score)} ${esc(an)} · ${esc(t.comp)}</span></span><span class="kd-v"><b>${Math.round(t.p * 100)} %</b></span></div>`;
        }).join('')}`;
      }
    } else {
      if (r.movers && r.movers.length) {
        h += `<div class="kd-h">Größte Sprünge der Stärke</div>${r.movers.map((t) => {
          const team = R.byId[t.id];
          const n = team ? reg(team) : t.name;
          return `<div class="kd-row"><span class="crest-w">${crest(n, 26)}</span><span class="grow"><b>${esc(n)}</b><span>${esc(team ? lgName(team.lg) : '')}</span></span><span class="kd-v"><b class="${t.d > 0 ? 'up' : 'down'}">${t.d > 0 ? '▲' : '▼'} ${nf2.format(Math.abs(t.d))}</b><span>jetzt ${nf2.format(t.now)}</span></span></div>`;
        }).join('')}`;
      }
      if (r.newTeams && r.newTeams.length) h += `<div class="kd-h">Neue Teams</div><p class="kd-p">${r.newTeams.map((t) => esc(t.name)).join(', ')}</p>`;
    }
    return h || '<p class="kd-p">Keine Einzelheiten (älterer Lauf oder nichts Neues).</p>';
  }
  function vKI() {
    const head = aura('ki') + '<h1 class="ptitle">KI-Zentrale</h1><p class="psub">Was die automatischen Rechner hinzufügen – jeder Lauf wird hier protokolliert.</p>';
    const d = A.data;
    if (!d) return head + `<div class="empty" style="margin-top:18px">${A.err ? 'Das Protokoll konnte gerade nicht geladen werden.' : 'Das Protokoll wird geladen …'}</div>`;
    const runs = (d.runs || []).slice().reverse();
    const last = (job) => runs.find((r) => r.job === job);
    const sts = {};
    const status = Object.keys(JOBS).map((k) => {
      const j = JOBS[k];
      const r = last(k);
      // die Tipp-Suche zählt ab der veröffentlichten Datei (ein Lauf kann schon fertig sein, bevor das Protokoll hier ankommt)
      const t = k === 'tips' && T.data && (!r || T.data.updatedAt > r.t) ? T.data.updatedAt : r && r.t;
      const age = t ? (Date.now() - new Date(t).getTime()) / 36e5 : null;
      const st = !t ? 'idle' : r && !r.ok ? 'bad' : age > j.bad ? 'bad' : age > j.warn ? 'warn' : 'ok';
      sts[k] = st;
      const txt = { ok: 'läuft', warn: 'verspätet', bad: 'hängt', idle: 'wartet auf ersten Lauf' }[st];
      return `<div class="ks-row"><span class="ks-ic">${I[j.icon]}</span><span class="grow"><b>${j.name}</b><span>${j.every} · ${t ? `zuletzt ${ago(t)}` : 'noch kein Lauf protokolliert'}</span></span><span class="ks-st ${st}"><i></i>${txt}</span></div>`;
    }).join('') + tipicoRow() + serverRow(sts.tips);
    const startToday = new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()).getTime();
    const today = runs.filter((r) => new Date(r.t).getTime() >= startToday);
    const sum = (list, f) => list.reduce((x, r) => x + (f(r) || 0), 0);
    const tiles = [
      [today.length, 'Läufe heute', 'spark', 'v'],
      [sum(today.filter((r) => r.job === 'tips'), (r) => r.sum.new), 'neue Tipps heute', 'flame', 'o'],
      [sum(today.filter((r) => r.job === 'tips'), (r) => r.sum.checked), 'heute ausgewertet', 'target', 'g'],
      [R.data ? R.data.teams.length : '–', 'Teams mit Stärken', 'chart', 'b'],
    ].map(([v, l, ic, c]) => `<div class="kt kt-${c}"><span class="kt-i">${I[ic]}</span><b>${v}</b><span>${l}</span></div>`).join('');
    // 7 Tage: neue Tipps je Tag (Balken) und Läufe je Tag
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const s0 = startToday - i * 864e5;
      const rs = runs.filter((r) => { const t = new Date(r.t).getTime(); return t >= s0 && t < s0 + 864e5; });
      days.push({ s0, n: sum(rs.filter((r) => r.job === 'tips'), (r) => r.sum.new), runs: rs.length });
    }
    const mx = Math.max(1, ...days.map((x) => x.n));
    const chart = `<div class="kchart">${days.map((x, i) => `<div class="kc-col${i === 6 ? ' now' : ''}"><span class="kc-v">${x.n || ''}</span><i style="height:${Math.max(4, Math.round(x.n / mx * 92))}px"></i><span class="kc-l">${i === 6 ? 'Heute' : ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'][new Date(x.s0).getDay()]}</span><span class="kc-r">${x.runs}×</span></div>`).join('')}</div>`;
    // Protokoll nach Tagen
    let log = '';
    let lastDay = '';
    runs.slice(0, 120).forEach((r, i) => {
      const dk = new Date(r.t).toDateString();
      if (dk !== lastDay) { log += `${lastDay ? '</div>' : ''}<div class="kl-day">${esc(dayDiff(r.t) === 0 ? 'Heute' : dayDiff(r.t) === -1 ? 'Gestern' : new Date(r.t).toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' }))}</div><div class="group">`; lastDay = dk; }
      const open = A.open[r.t + r.job];
      const via = r.sum && VIA[r.sum.via] ? ` · ${VIA[r.sum.via]}` : '';
      log += `<button class="row kl-row${open ? ' open' : ''}" data-act="kirun" data-k="${esc(r.t + r.job)}"><span class="kl-ic ${r.job}">${I[JOBS[r.job] ? JOBS[r.job].icon : 'spark']}</span><span class="grow"><div class="t">${JOBS[r.job] ? JOBS[r.job].name : esc(r.job)} <span class="kl-t">${hm(r.t)}${via}</span></div><div class="s">${esc(runLine(r))}</div></span><span class="chev">›</span></button>${open ? `<div class="kl-det">${runDetails(r)}</div>` : ''}`;
    });
    if (lastDay) log += '</div>';
    return head + `<div class="card ks" style="margin-top:18px">${status}</div><div class="ktiles">${tiles}</div>
      <section class="sec"><div class="sec-h"><h2>Letzte 7 Tage</h2><span class="note">neue Tipps</span></div><div class="card">${chart}<p class="kc-cap">Balken = neue Tipps · darunter, wie oft gesucht wurde</p></div></section>
      <section class="sec"><div class="sec-h"><h2>Protokoll</h2><span class="note">antippen für Einzelheiten</span></div>${log || '<div class="empty">Noch keine Läufe protokolliert.</div>'}</section>
      <p class="foot">Die Rechner arbeiten ohne Sprach-KI: Mathe aus Ergebnissen, Toren und Marktpreisen, bei Zahlen genauer und ohne Erfundenes.<br>Gemini liest auf dem Cloudflare-Server deine Wettschein-Screenshots. Der Server startet auch die Tipp-Suche, wenn GitHub sie auslässt.</p>`;
  }
  const VIA = { zeitgeber: 'vom Zeitgeber', github: 'von GitHub', hand: 'von Hand' };
  // Cloudflare-Server: erreichbar? Zeitgeber eingerichtet? (nur Ja/Nein – die Schlüssel selbst sieht die App nie)
  const Z = { st: null, at: 0, loading: null };
  function loadServer() {
    if (!API) return Promise.resolve(null);
    if (Z.st && Date.now() - Z.at < 60e3) return Promise.resolve(Z.st);
    if (!Z.loading) {
      Z.loading = fetch(API + '/', { cache: 'no-store' }).then((r) => r.json()).catch(() => ({ ok: false }))
        .then((d) => { Z.st = d; Z.at = Date.now(); return d; }).finally(() => { Z.loading = null; });
    }
    return Z.loading;
  }
  // Tipico: verbunden? Wie viele Abrufe sind diesen Monat noch frei? (Schlüssel als GitHub-Secret, die App sieht ihn nie)
  function tipicoRow() {
    const t = T.data && T.data.tipico;
    const st = !t ? 'idle' : !t.connected ? 'warn' : t.err ? 'bad' : 'ok';
    const txt = !t ? 'wird geprüft …' : !t.connected ? 'nicht verbunden' : t.err ? 'Fehler' : 'verbunden';
    const sub = t && t.connected ? `${t.covered || 0} Spiele mit Quote · noch ${t.remaining != null ? t.remaining : 'k. A.'} Abrufe diesen Monat` : 'trägt die echten Tipico-Quoten ein';
    return `<div class="ks-row"><span class="ks-ic">${I.ticket}</span><span class="grow"><b>Tipico-Quoten</b><span>${esc(sub)}</span></span><span class="ks-st ${st}"><i></i>${txt}</span></div>`;
  }
  function serverRow(tipsSt) {
    const s = Z.st;
    const st = !API ? 'idle' : !s ? 'idle' : !s.ok ? 'bad' : s.zeitgeber ? 'ok' : 'warn';
    const txt = !API ? 'noch nicht eingerichtet' : !s ? 'wird geprüft …' : !s.ok ? 'nicht erreichbar' : s.zeitgeber ? 'verbunden' : 'GitHub-Schlüssel fehlt';
    const kick = API && s && s.ok && s.zeitgeber && (tipsSt === 'warn' || tipsSt === 'bad') && store.get('invite', '')
      ? '<button class="btn soft ks-kick" data-act="kick">Tipp-Suche jetzt starten</button>' : '';
    return `<div class="ks-row"><span class="ks-ic">${I.clock}</span><span class="grow"><b>Zeitgeber</b><span>Cloudflare · startet die Tipp-Suche, wenn sie älter als 50 Min. ist</span></span><span class="ks-st ${st}"><i></i>${txt}</span></div>${kick}`;
  }
  function kickNow() {
    const code = store.get('invite', '');
    if (!API || !code) return;
    toast('Zeitgeber wird angestoßen …');
    fetch(API + '/kick', { headers: { 'X-Invite': code } }).then((r) => r.json()).then((d) => toast(d.ok ? d.info : d.error || 'Das hat nicht geklappt.'))
      .catch(() => toast('Der Server ist gerade nicht erreichbar.'));
  }
  // Knopf oben rechts auf der Startseite: Punkt grün/orange/rot je nach Alter der letzten Tipp-Suche + neue Tipps heute
  function kiBadge() {
    const k = T.data && T.data.ki;
    const n = k && k.newTips && k.last && dayDiff(k.last) === 0 ? k.newTips : 0;
    return `<i class="kib-dot${T.data ? ' ' + freshness(T.data.updatedAt) : ''}"></i><span>KI</span>${n ? `<b class="kib-n">+${n}</b>` : ''}`;
  }

  // ------------------------------------------------------------------ Begrüßung, Tipp des Tages, Karussell
  function greet() {
    const h = new Date().getHours();
    const g = h < 5 ? 'Gute Nacht' : h < 11 ? 'Guten Morgen' : h < 18 ? 'Hallo' : h < 23 ? 'Guten Abend' : 'Gute Nacht';
    const name = String(store.get('name', '') || '').trim();
    return name ? `${g}, ${name}` : g;
  }
  const todayLong = () => new Date().toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });
  // der sicherste Tipp für heute/morgen (sonst der nächste) – groß in Vereinsfarben
  function spotTip() {
    if (!T.data) return null;
    const list = T.data.safe.filter(upcoming);
    return list.find((x) => dayDiff(T.data.games[x.g].t) <= 1) || list[0] || null;
  }
  function spotlight() {
    const t = spotTip();
    if (!t) return T.data ? '' : '<div class="spot spot-ph"><span>Tipp des Tages wird gesucht …</span></div>';
    const g = T.data.games[t.g];
    const h = tipTeam(g.home);
    const a = tipTeam(g.away);
    const hc = teamColor(h);
    const ac = teamColor(a);
    return `<a class="spot teamcard" href="#/r/t_${esc(g.id)}" style="background:${teamBg({ home: h, away: a })};--gl:${rgba(hc, 0.65)};--gr:${rgba(ac, 0.65)}">${wm(h, 'l')}${wm(a, 'r')}
      <div class="sp-top"><span class="chip glass">${I.flame}Tipp des Tages</span><span class="sp-when">${esc(kickoff(g.t))}</span></div>
      <div class="sp-mid"><div class="sp-side">${plate(h, 66)}<b>${esc(h)}</b></div><div class="sp-c"><span class="sp-comp">${esc(g.comp)}</span><span class="sp-vs">VS</span></div><div class="sp-side">${plate(a, 66)}<b>${esc(a)}</b></div></div>
      <div class="sp-bet"><div class="grow"><span class="k">${tipKind(t.m)}</span><b>${esc(tipLabel(t.m, h, a))}</b></div><div class="sp-p"><b>${Math.round(t.p * 100)}<small>%</small></b><span>Quote ${qTxt(t)}</span></div></div></a>`;
  }
  // Startseite: die besten Tipps als wischbare Karten
  function tipCarousel() {
    if (!T.data) return `<div class="empty">${T.err ? 'Die Tipps sind gerade nicht erreichbar.' : 'Die Top-Tipps werden geladen …'}</div>`;
    const first = spotTip();
    const list = T.data.safe.filter((t) => upcoming(t) && t !== first).slice(0, 6);
    if (!list.length) return '<div class="empty">Gerade keine Tipps – die nächste Suche läuft in spätestens einer Stunde.</div>';
    return `<div class="tcar">${list.map((t) => {
      const g = T.data.games[t.g];
      const h = tipTeam(g.home);
      const a = tipTeam(g.away);
      return `<a class="tmc" href="#/r/t_${esc(g.id)}" style="--hg:${rgba(teamColor(h), 0.12)};--ag:${rgba(teamColor(a), 0.12)};--hgd:${rgba(teamColor(h), 0.26)};--agd:${rgba(teamColor(a), 0.26)}">
        <div class="tmc-top"><span>${esc(g.comp)}</span><span>${esc(kickoff(g.t))}</span></div>
        <div class="tmc-teams"><span>${crest(h, 22)}${esc(h)}</span><span>${crest(a, 22)}${esc(a)}</span></div>
        <div class="tmc-bet">${esc(tipLabel(t.m, h, a))}</div>
        <div class="tmc-foot">${ring(t.p)}<span class="tmc-q"><span>Quote</span><b>${qTxt(t)}</b></span></div></a>`;
    }).join('')}</div>`;
  }
  // Auswählen: sobald beide Teams stehen, sofort eine Spiel-Karte mit Vorschau-Prozenten
  function matchPreview() {
    const h = P.home && R.byId[P.home];
    const a = P.away && R.byId[P.away];
    if (!h || !a || h.id === a.id) return '';
    const hn = reg(h);
    const an = reg(a);
    const head = `<div class="mp-top"><span class="chip glass">${P.live ? `LIVE ${P.minute}'` : 'Vorschau'}</span><span class="chip glass">${esc(h.nat && a.nat ? 'Länderspiel' : h.lg && h.lg === a.lg && R.leagues[h.lg] ? R.leagues[h.lg].name : 'Ligen-Duell')}</span>${P.neutral ? '<span class="mp-n">neutraler Platz</span>' : ''}</div>`;
    let probs = '';
    if (h.grp === a.grp) {
      const m = lamOf(h, a, P.neutral);
      if (P.live) Object.assign(m, { minute: P.minute, half: P.minute > 45 ? 2 : 1, score: P.score.slice(), reds: P.reds.slice() });
      const an2 = analyze(m);
      const r = round100([an2.probs.home, an2.probs.draw, an2.probs.away]);
      probs = `<div class="mp-pr"><div><b>${r[0]} %</b><span>${esc(hn)}</span></div><div><b>${r[1]} %</b><span>Remis</span></div><div><b>${r[2]} %</b><span>${esc(an)}</span></div></div>`;
    } else probs = `<div class="mp-pr mp-x">${!!h.nat !== !!a.nat ? 'Nationalteam gegen Verein rechnet Result AI nicht.' : 'Ligen ohne gemeinsame Gegner, hier rechnet Result AI nicht.'}</div>`;
    return `<div class="mp teamcard" style="background:${teamBg({ home: hn, away: an })};--gl:${rgba(teamColor(hn), 0.6)};--gr:${rgba(teamColor(an), 0.6)}">${wm(hn, 'l')}${wm(an, 'r')}${head}
      <div class="mp-mid"><div class="sp-side">${plate(hn, 62)}<b>${esc(hn)}</b></div><div class="mp-sc">${P.live ? `${P.score[0]}:${P.score[1]}` : 'VS'}</div><div class="sp-side">${plate(an, 62)}<b>${esc(an)}</b></div></div>${probs}</div>`;
  }
  // Verlauf: nach Tagen gruppiert, jede Zeile mit der Prognose (Favorit in Vereinsfarbe)
  function histGrouped(hist) {
    let out = '';
    let day = '';
    hist.forEach((h) => {
      const d = new Date(h.at || Date.now());
      const dk = d.toDateString();
      if (dk !== day) {
        const dd = dayDiff(d.toISOString());
        out += `${day ? '</div>' : ''}<div class="kl-day">${esc(dd === 0 ? 'Heute' : dd === -1 ? 'Gestern' : d.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' }))}</div><div class="group">`;
        day = dk;
      }
      regTeams(h);
      let pill = '';
      try {
        const an2 = analyze(h);
        const [k, p] = lead(h, an2);
        const col = k === 'home' ? teamColor(h.home) : k === 'away' ? teamColor(h.away) : '#8E8E93';
        pill = `<span class="hp" style="--pc:${col}"><b>${Math.round(p * 100)} %</b><span>${k === 'draw' ? 'Remis' : esc(k === 'home' ? h.home : h.away)}</span></span>`;
      } catch (e) { /* alte Einträge ohne Zahlen */ }
      out += `<a class="row hrow" href="#/r/${esc(h.id)}"><span class="duo">${crest(h.home, 30, true)}${crest(h.away, 30, true)}</span><span class="grow"><div class="t">${esc(h.home)} – ${esc(h.away)}</div><div class="s">${esc(histSub(h))}</div></span>${pill}</a>`;
    });
    return day ? out + '</div>' : '';
  }

  // ------------------------------------------------------------------ Erfolgsquote (Niklas, 06.11.2026): nur Wetten aus den Top-Tipps,
  // ausgewertet von Result AI selbst nach dem Abpfiff (offizieller Endstand) – von Hand lässt sich hier nichts ändern
  function vAccuracy() {
    const s = betStats();
    const nOpen = betsAll().filter((b) => b.auto && b.status === 'open').length;
    const head = `${aura('hist')}<h1 class="ptitle">Erfolgsquote</h1><p class="psub">Nur Wetten, die du aus den Top-Tipps gespeichert hast. Result AI prüft sie nach dem Abpfiff selbst mit dem offiziellen Endstand – von Hand lässt sich hier nichts ändern.</p>`;
    const wait = nOpen ? `<p class="tl-note" style="margin-top:14px">${nOpen} ${nOpen === 1 ? 'Wette wartet' : 'Wetten warten'} noch auf den Abpfiff.</p>` : '';
    if (!s.n) return head + `<div class="empty" style="margin-top:18px">Noch keine Wette ausgewertet. Speichere in den Top-Tipps eine Wette – nach dem Abpfiff steht hier, ob sie aufgegangen ist.</div>${wait}`;
    const roi = s.stake ? s.pl / s.stake : 0;
    const NAMES = { safe: 'Sicher', rec: 'Empfohlen', top: 'Top-Quote', kombi: 'Kombi' };
    const lines = Object.keys(NAMES).filter((k) => s.by[k]).map((k) => { return recRow(NAMES[k], s.by[k]); }).join('');
    const recent = s.list.slice(0, 12).map((b) => `<div class="rec-it ${b.status === 'won' ? 'won' : 'lost'}"><span class="mk">${b.status === 'won' ? '✓' : '✗'}</span><span class="grow"><b>${esc(betTitle(b))}</b><span>${esc(betSub(b))}</span></span><span class="rp2 ${b.status === 'won' ? 'up' : 'down'}">${signed(payout(b) - b.stake)}</span></div>`).join('');
    // Ehrlichkeit: stimmen die Prozente? (erst ab 20 Wetten aussagekräftig)
    const bins = [[0.5, 0.6], [0.6, 0.7], [0.7, 0.8], [0.8, 0.9], [0.9, 1.01]].map(([lo, hi]) => {
      const xs = s.list.filter((b) => b.p >= lo && b.p < hi);
      return { lo, n: xs.length, exp: xs.reduce((a, b) => a + b.p, 0), won: xs.filter((b) => b.status === 'won').length };
    }).filter((x) => x.n);
    const calib = s.n >= 20 ? `<section class="sec"><div class="sec-h"><h2>Ehrlichkeit</h2><span class="note">sagt Result AI x %, passiert es auch?</span></div><div class="card rec">${bins.map((x) => recRow(`${Math.round(x.lo * 100)}–${Math.min(100, Math.round(x.lo * 100) + 10)} %`, x)).join('')}</div></section>`
      : `<p class="tl-note" style="margin-top:14px">Ab 20 ausgewerteten Wetten zeigt Result AI hier auch, ob die Prozente ehrlich sind (gerade: ${s.n}).</p>`;
    return head + `<div class="card rec" style="margin-top:18px"><div class="rec-hero">${ring(s.won / s.n)}<div><b>${s.won} von ${s.n} gewonnen</b><span>erwartet waren ${pct0(s.exp / s.n)} (laut Markt-Chance)</span></div></div>
        <div class="acc-money"><div><span>Einsatz</span><b>${eur(s.stake)}</b></div><div><span>Ausgezahlt</span><b>${eur(s.back)}</b></div><div><span>Gewinn/Verlust</span><b class="${s.pl > 0 ? 'up' : s.pl < 0 ? 'down' : ''}">${signed(s.pl)}</b></div><div><span>Rendite</span><b class="${roi > 0 ? 'up' : roi < 0 ? 'down' : ''}">${roi > 0 ? '+' : roi < 0 ? '−' : ''}${nf1.format(Math.abs(roi) * 100)} %</b></div></div></div>${wait}
      <section class="sec"><div class="sec-h"><h2>Nach Kategorie</h2></div><div class="card rec">${lines}</div></section>
      <section class="sec"><div class="sec-h"><h2>Zuletzt ausgewertet</h2></div><div class="card rec"><div class="rec-list" style="border-top:0">${recent}</div></div></section>${calib}
      <p class="foot">Gezählt werden nur gewonnene und verlorene Wetten (abgesagte Spiele nicht). Gewertet wird wie beim Buchmacher nach 90 Minuten plus Nachspielzeit.</p>`;
  }

  // ------------------------------------------------------------------ Wetten: Geld-Tracker mit Einsatz, Gewinn und Guthaben (nur auf diesem Handy)
  // Wette: { id, at, src: tip|manual|scan, auto (nur Top-Tipps: zählt für die Erfolgsquote), track (Scan: Spiel erkannt, Result AI prüft mit), list, key, title, legs, q, p, stake,
  //          win (Auszahlung inkl. Einsatz), status: open|won|lost|void, done, bookie, teams }
  // Tipp der Wette (leg): { g (ESPN-Spiel), slug (ESPN-Liga), m (Wett-Code), home, away, comp, t (Anpfiff), pick, q, p, res }
  const B = { tab: 'over', period: '30', mode: 'bal', split: 'cat', more: false, keys: new Set(), draft: null };
  const betsAll = () => { const x = store.get('bets', []); return Array.isArray(x) ? x : []; };
  const betsSave = (list) => store.set('bets', list.slice(0, 500));
  const savedKeys = () => new Set(betsAll().map((b) => b.key).filter(Boolean));
  const kombiKey = (k) => 'k|' + k.legs.map((l) => l.g + ':' + l.m).join(',');
  const payout = (b) => (b.status === 'won' ? b.win : b.status === 'void' ? b.stake : 0);
  const legTeams = (l) => (l.home && l.away ? `${l.home} – ${l.away}` : l.event || '');
  const betTitle = (b) => (b.legs.length > 1 ? `${b.title || 'Kombi'} · ${b.legs.length} Tipps` : (b.legs[0] && b.legs[0].pick) || b.title || 'Wette');
  const betSub = (b) => (b.legs.length > 1 ? b.legs.map((l) => l.pick).join(' · ')
    : [legTeams(b.legs[0] || {}), b.legs[0] && b.legs[0].res && b.legs[0].res.hs != null ? `${b.legs[0].res.hs}:${b.legs[0].res.as}` : ''].filter(Boolean).join(' · '));
  const firstKick = (b) => Math.min(...b.legs.map((l) => (l.t ? new Date(l.t).getTime() : Infinity)));
  const lastKick = (b) => Math.max(0, ...b.legs.map((l) => (l.t ? new Date(l.t).getTime() : 0)));
  // Automatisch geprüfte Wetten lassen sich nur vor dem Anpfiff löschen (sonst könnte man die Erfolgsquote schönen)
  const canDelete = (b) => !b.auto || (b.status === 'open' && b.legs.every((l) => !l.t || new Date(l.t).getTime() > Date.now()));
  const teamsOf = (legs) => { const o = {}; legs.forEach((l) => [l.home, l.away].forEach((n) => { if (n && REG[n]) o[n] = REG[n]; })); return o; };

  // Guthaben: „Guthaben jetzt“ (wie beim Wettanbieter) + alles danach – neue Einsätze ab, Auszahlungen dazu, Ein-/Auszahlungen
  function walletState() {
    const w = store.get('wallet', {}) || {};
    const bets = betsAll();
    const at = w.at || 0;
    let bal = typeof w.base === 'number' ? w.base : null;
    let open = 0;
    let openWin = 0;
    let pl = 0;
    bets.forEach((b) => {
      if (b.status === 'open') { open += b.stake; openWin += b.win; } else pl += payout(b) - b.stake;
      if (bal != null) {
        if (b.at > at) bal -= b.stake;
        if (b.done && b.done > at) bal += payout(b);
      }
    });
    if (bal != null) (w.moves || []).forEach((m) => { if (m.t > at) bal += m.v; });
    return { balance: bal, open, openWin, pl, n: bets.length, nOpen: bets.filter((b) => b.status === 'open').length };
  }
  // Erfolgsquote: nur automatisch geprüfte Wetten (aus den Top-Tipps), nur gewonnen/verloren
  function betStats() {
    const list = betsAll().filter((b) => b.auto && (b.status === 'won' || b.status === 'lost')).sort((x, y) => (y.done || 0) - (x.done || 0));
    const by = {};
    let won = 0;
    let exp = 0;
    let stake = 0;
    let back = 0;
    list.forEach((b) => {
      const w = b.status === 'won' ? 1 : 0;
      const x = (by[b.list || 'safe'] = by[b.list || 'safe'] || { n: 0, won: 0, exp: 0 });
      won += w; exp += b.p || 0; stake += b.stake; back += payout(b);
      x.n++; x.won += w; x.exp += b.p || 0;
    });
    return { n: list.length, won, exp, stake, back, pl: back - stake, by, list };
  }

  // Start: kleine Zeile zu den eigenen Wetten
  function homeBets() {
    const ws = walletState();
    if (!ws.n && ws.balance == null) return '';
    return `<a class="row" href="#/bets"><span class="round">${I.ticket}</span><span class="grow"><div class="t">Meine Wetten</div><div class="s">${ws.nOpen} offen${ws.balance != null ? ` · Guthaben ${eur(ws.balance)}` : ''}</div></span><span class="chev">›</span></a>`;
  }
  // Stand einer offenen Wette: läuft gerade (mit Spielstand), nächster Anpfiff oder „wird geprüft“
  function liveText(b) {
    const now = Date.now();
    const run = b.legs.map((l) => !l.res && l.g && LIVE[l.g]).find((x) => x && x.state === 'in');
    if (run) return `läuft · ${run.hs}:${run.as}${run.clock ? ' · ' + run.clock : ''}`;
    const next = b.legs.filter((l) => !l.res && l.t && new Date(l.t).getTime() > now).map((l) => l.t).sort()[0];
    if (next) return kickoff(next);
    return b.auto || b.track ? 'wird nach Abpfiff geprüft' : 'offen';
  }
  function legRow(l) {
    const lv = l.g && LIVE[l.g];
    let info = '';
    if (l.res) info = l.res.void ? 'abgesagt · zählt nicht' : l.res.hs != null ? `Endstand ${l.res.hs}:${l.res.as}${l.res.et ? ' nach 90 Min.' : ''}` : 'nach 90 Min. unentschieden';
    else if (lv && lv.state === 'in') info = `läuft · ${lv.hs}:${lv.as}${lv.clock ? ' · ' + lv.clock : ''}`;
    else if (lv && lv.cancelled) info = 'verschoben';
    else if (l.t) info = kickoff(l.t);
    const mk = l.res ? (l.res.void ? ['–', 'void'] : l.res.won ? ['✓', 'won'] : ['✗', 'lost']) : null;
    const sub = [legTeams(l), info].filter(Boolean).join(' · ');
    return `<div class="bleg">${l.home && l.away ? `<span class="duo">${crest(l.home, 26, true)}${crest(l.away, 26, true)}</span>` : `<span class="bl-ic">${I.ticket}</span>`}<span class="grow"><b>${esc(l.pick)}</b>${sub ? `<span>${esc(sub)}</span>` : ''}</span>${l.q ? `<span class="bl-q">${nf2.format(l.q)}</span>` : ''}${mk ? `<span class="bl-mk ${mk[1]}">${mk[0]}</span>` : ''}</div>`;
  }
  function betCard(b) {
    regTeams(b);
    const ST = { open: 'Offen', won: 'Gewonnen', lost: 'Verloren', void: 'Storniert' };
    const src = b.auto || b.track ? `<span class="bc-src ai">${I.spark}${b.src === 'scan' ? 'Gescannt · ' : ''}Result AI prüft automatisch</span>` : `<span class="bc-src">${b.src === 'scan' ? 'Gescannt' : 'Selbst eingetragen'}</span>`;
    const third = b.status === 'open' ? ['Mögl. Gewinn', eur(b.win), ''] : b.status === 'won' ? ['Gewinn', signed(b.win - b.stake), 'up']
      : b.status === 'lost' ? ['Verlust', signed(-b.stake), 'down'] : ['Zurück', eur(b.stake), ''];
    const acts = b.auto ? '' : b.status === 'open'
      ? `<div class="bc-acts"><button class="won" data-act="settle" data-id="${b.id}" data-val="won">${I.check}Gewonnen</button><button class="lost" data-act="settle" data-id="${b.id}" data-val="lost">Verloren</button><button data-act="settle" data-id="${b.id}" data-val="void">Storniert</button></div>`
      : `<div class="bc-acts"><button data-act="settle" data-id="${b.id}" data-val="open">Wieder auf offen</button></div>`;
    return `<article class="bcard ${b.status}"><div class="bc-top">${src}<span class="bc-st ${b.status}">${{ won: '✓ ', lost: '✗ ' }[b.status] || ''}${ST[b.status]}</span></div>
      ${b.legs.length > 1 ? `<div class="bc-title">${esc(b.title || 'Kombi')} · ${b.legs.length} Tipps</div>` : ''}<div class="bc-legs">${b.legs.map(legRow).join('')}</div>
      <div class="bc-money"><div><span>Einsatz</span><b>${eur(b.stake)}</b></div><div><span>Quote</span><b>${nf2.format(b.q)}</b></div><div><span>${third[0]}</span><b class="${third[2]}">${third[1]}</b></div></div>
      ${acts}<div class="bc-foot"><span>Gespeichert ${esc(agoText(b.at))}${b.bookie ? ' · ' + esc(b.bookie) : ''}</span>${canDelete(b) ? `<button class="bc-del" data-act="delbet" data-id="${b.id}">Löschen</button>` : ''}</div></article>`;
  }
  // ------------------------------------------------------------------ Geld-Tracker (Niklas, 08.11.2026: „deutlich upgraden, mit Graphen, Design und allem Drum und Dran“)
  // Alles wird aus den gespeicherten Wetten und Buchungen gerechnet. Der Zeitraum oben gilt für alles darunter.
  const PERIOD_DAYS = { 7: 7, 30: 30, 90: 90 };
  const PERIOD_TXT = { 7: 'letzte 7 Tage', 30: 'letzte 30 Tage', 90: 'letzte 3 Monate', all: 'seit Beginn' };
  const PERIODS_M = [['7', '7 T'], ['30', '30 T'], ['90', '3 M'], ['all', 'Alles']];
  const periodFrom = () => (B.period === 'all' ? -Infinity : Date.now() - PERIOD_DAYS[B.period] * 864e5);
  const fmtDate = (t) => new Date(t).toLocaleDateString('de-DE', { day: 'numeric', month: 'short' });
  const fmtWhen = (t) => `${fmtDate(t)}, ${hm(t)}`;
  const betPL = (b) => payout(b) - b.stake;
  const settledBets = () => betsAll().filter((b) => b.status !== 'open' && b.done).sort((x, y) => x.done - y.done);
  const plusMinus = (v) => (v > 0.004 ? 'up' : v < -0.004 ? 'down' : '');

  // Kontoauszug: jede Bewegung mit dem Guthaben danach (Guthaben zählt ab dem Moment, in dem es eingetragen wurde)
  function ledger() {
    const w = store.get('wallet', {}) || {};
    const st = typeof w.base === 'number' ? (w.start || { t: w.at || 0, v: w.base }) : null;
    const ev = [];
    betsAll().forEach((b) => {
      const txt = betTitle(b);
      ev.push({ t: b.at, v: -b.stake, k: 'stake', txt });
      if (b.done && b.status !== 'open') ev.push({ t: b.done, v: payout(b), k: b.status, txt });
    });
    (w.moves || []).forEach((m) => ev.push({ t: m.t, v: m.v, k: m.v > 0 ? 'in' : 'out', txt: '' }));
    (w.fixes || []).forEach((f) => ev.push({ t: f.t, v: f.v, k: 'fix', txt: '' }));
    ev.sort((x, y) => x.t - y.t);
    let bal = st ? st.v : null;
    ev.forEach((e) => { if (st && e.t > st.t) { bal += e.v; e.bal = bal; } });
    return { ev, st };
  }
  const walletPts = (lg) => (lg.st ? [{ t: lg.st.t, v: lg.st.v }].concat(lg.ev.filter((e) => e.bal != null && e.v !== 0).map((e) => ({ t: e.t, v: e.bal }))) : []);
  function plPts() {
    const list = settledBets();
    if (!list.length) return [];
    let v = 0;
    return [{ t: list[0].done - 1, v: 0 }].concat(list.map((b) => { v += betPL(b); return { t: b.done, v }; }));
  }
  // Reihe auf den Zeitraum zuschneiden: Wert am Anfang, Bewegungen, Stand heute
  function slicePts(pts, from) {
    if (!pts.length) return [];
    const before = pts.filter((p) => p.t < from).pop();
    const out = (before ? [{ t: from, v: before.v }] : []).concat(pts.filter((p) => p.t >= from));
    if (out.length && out[out.length - 1].t < Date.now()) out.push({ t: Date.now(), v: out[out.length - 1].v });
    return out;
  }
  function niceTicks(lo0, hi0) {
    let lo = lo0;
    let hi = hi0;
    if (hi - lo < 0.01) { lo -= 1; hi += 1; }
    const raw = (hi - lo) / 3;
    const mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const r = raw / mag;
    const step = (r <= 1 ? 1 : r <= 2 ? 2 : r <= 2.5 ? 2.5 : r <= 5 ? 5 : 10) * mag;
    const out = [];
    for (let v = Math.floor(lo / step + 1e-9) * step; v <= Math.ceil(hi / step - 1e-9) * step + step * 1e-6; v += step) out.push(+v.toFixed(6));
    return { ticks: out, step };
  }
  const tickFmt = (v, step) => new Intl.NumberFormat('de-DE', { maximumFractionDigits: step < 1 ? 2 : 0 }).format(v) + ' €';

  // Linie: Antippen und Ziehen zeigt oben in der großen Zahl den Wert an dieser Stelle
  const CH = { line: null, bars: null };
  function lineChart(pts, up, fmtV, def) {
    const W = 358;
    const H = 176;
    const PL = 46;
    const PR = 8;
    const PT = 10;
    const PB = 22;
    const vs = pts.map((p) => p.v);
    const { ticks, step } = niceTicks(Math.min(...vs), Math.max(...vs));
    const lo = ticks[0];
    const hi = ticks[ticks.length - 1];
    const t0 = pts[0].t;
    const t1 = pts[pts.length - 1].t;
    const X = (t) => PL + ((t - t0) / Math.max(1, t1 - t0)) * (W - PL - PR);
    const Y = (v) => PT + (1 - (v - lo) / (hi - lo)) * (H - PT - PB);
    const xs = pts.map((p) => X(p.t));
    const ys = pts.map((p) => Y(p.v));
    const d = xs.map((x, i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${ys[i].toFixed(1)}`).join(' ');
    const base = Y(Math.max(lo, Math.min(hi, 0))).toFixed(1);
    const area = `${d} L${xs[xs.length - 1].toFixed(1)} ${base} L${xs[0].toFixed(1)} ${base} Z`;
    CH.line = { W, xs, ys, pts, fmtV, def };
    const sig = `${B.period}|${B.mode}|${pts.length}|${pts[pts.length - 1].v}`;
    const fresh = sig !== CH.sig;
    CH.sig = sig;
    const days = (t1 - t0) / 864e5;
    const lastX = xs[xs.length - 1];
    const lastY = ys[ys.length - 1];
    const xl = [`<text x="${PL}" y="${H - 5}">${esc(fmtDate(t0))}</text>`, `<text x="${W - PR}" y="${H - 5}" text-anchor="end">Heute</text>`];
    if (days >= 3) xl.push(`<text x="${(PL + W - PR) / 2}" y="${H - 5}" text-anchor="middle">${esc(fmtDate((t0 + t1) / 2))}</text>`);
    return `<div class="lc${fresh ? ' in' : ''}" role="img" aria-label="Verlauf ${esc(def.label)} von ${esc(fmtDate(t0))} bis heute: zuletzt ${esc(def.big)}. Alle Werte stehen im Kontoauszug.">
      <svg viewBox="0 0 ${W} ${H}" aria-hidden="true">${ticks.map((v) => `<line class="g" x1="${PL}" x2="${W - PR}" y1="${Y(v).toFixed(1)}" y2="${Y(v).toFixed(1)}"/><text x="${PL - 6}" y="${(Y(v) + 4).toFixed(1)}" text-anchor="end">${esc(tickFmt(v, step))}</text>`).join('')}
      <path class="a" d="${area}"/><path class="l" d="${d}"/><line class="x" x1="${lastX.toFixed(1)}" x2="${lastX.toFixed(1)}" y1="${PT}" y2="${H - PB}"/><circle class="d" cx="${lastX.toFixed(1)}" cy="${lastY.toFixed(1)}" r="5"/>${xl.join('')}</svg></div>`;
  }
  // Gewinn/Verlust je Tag, Woche oder Monat (je nach Zeitraum)
  function bucketize(list, from) {
    const now = Date.now();
    const start = Number.isFinite(from) ? from : (list.length ? list[0].done : now);
    const span = (now - start) / 864e5;
    const unit = span <= 14 ? 'day' : span <= 125 ? 'week' : 'month';
    const floor = (t) => {
      const d = new Date(t);
      if (unit === 'month') return new Date(d.getFullYear(), d.getMonth(), 1);
      const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      if (unit === 'week') x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
      return x;
    };
    const next = (d) => (unit === 'month' ? new Date(d.getFullYear(), d.getMonth() + 1, 1) : new Date(d.getFullYear(), d.getMonth(), d.getDate() + (unit === 'week' ? 7 : 1)));
    const out = [];
    for (let d = floor(start); d.getTime() <= now; d = next(d)) out.push({ t0: d.getTime(), t1: next(d).getTime(), v: 0, n: 0 });
    list.forEach((b) => { const x = out.find((k) => b.done >= k.t0 && b.done < k.t1); if (x) { x.v += betPL(b); x.n++; } });
    return { unit, bk: out.slice(unit === 'month' ? -12 : unit === 'week' ? -14 : -14) };
  }
  const bucketLong = (k, unit) => (unit === 'day' ? new Date(k.t0).toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short' })
    : unit === 'week' ? `Woche ab ${fmtDate(k.t0)}` : new Date(k.t0).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' }));
  const bucketShort = (k, unit) => { const d = new Date(k.t0); return unit === 'month' ? d.toLocaleDateString('de-DE', { month: 'short' }).replace('.', '') : `${d.getDate()}.${d.getMonth() + 1}.`; };
  const bucketRead = (k, unit) => `${bucketLong(k, unit)} · ${k.n ? `${signed(k.v)} · ${k.n} ${k.n === 1 ? 'Wette' : 'Wetten'}` : 'keine Wette ausgewertet'}`;
  function barChart(bk, unit) {
    const W = 358;
    const H = 150;
    const PL = 46;
    const PR = 8;
    const PT = 18;
    const PB = 22;
    const vs = bk.map((b) => b.v);
    const { ticks, step } = niceTicks(Math.min(0, ...vs), Math.max(0, ...vs));
    const lo = ticks[0];
    const hi = ticks[ticks.length - 1];
    const Y = (v) => PT + (1 - (v - lo) / (hi - lo)) * (H - PT - PB);
    const slot = (W - PL - PR) / bk.length;
    const bw = Math.min(24, slot * 0.62);
    const y0 = Y(0);
    const mx = Math.max(...vs);
    const mn = Math.min(...vs);
    const every = Math.ceil(bk.length / 6);
    CH.bars = { bk, unit };
    const marks = bk.map((k, i) => {
      const x = PL + slot * i + (slot - bw) / 2;
      const yv = Y(k.v);
      const h = Math.abs(yv - y0);
      const up = k.v >= 0;
      let path = '';
      if (h >= 0.5) {
        const r = Math.min(4, h, bw / 2);
        const s1 = up ? 1 : 0;
        const dy = up ? r : -r;
        path = `<path class="${up ? 'pos' : 'neg'}" d="M${x.toFixed(1)} ${y0.toFixed(1)} L${x.toFixed(1)} ${(yv + dy).toFixed(1)} A${r} ${r} 0 0 ${s1} ${(x + r).toFixed(1)} ${yv.toFixed(1)} L${(x + bw - r).toFixed(1)} ${yv.toFixed(1)} A${r} ${r} 0 0 ${s1} ${(x + bw).toFixed(1)} ${(yv + dy).toFixed(1)} L${(x + bw).toFixed(1)} ${y0.toFixed(1)} Z"/>`;
      }
      const lab = k.n && (k.v === mx || k.v === mn) && h >= 0.5 ? `<text class="v" x="${(x + bw / 2).toFixed(1)}" y="${(up ? yv - 5 : yv + 13).toFixed(1)}" text-anchor="middle">${esc((k.v > 0 ? '+' : '−') + Math.round(Math.abs(k.v)))}</text>` : '';
      const xl = (bk.length - 1 - i) % every === 0 ? `<text x="${(x + bw / 2).toFixed(1)}" y="${H - 5}" text-anchor="middle">${esc(bucketShort(k, unit))}</text>` : '';
      return `<g class="bm">${path}${lab}${xl}<rect class="hit" data-act="barpick" data-i="${i}" x="${(PL + slot * i).toFixed(1)}" y="0" width="${slot.toFixed(1)}" height="${H}"/></g>`;
    }).join('');
    return `<svg class="bc" viewBox="0 0 ${W} ${H}" role="img" aria-label="Gewinn und Verlust je Zeitabschnitt">${ticks.map((v) => `<line class="${v === 0 ? 'z' : 'g'}" x1="${PL}" x2="${W - PR}" y1="${Y(v).toFixed(1)}" y2="${Y(v).toFixed(1)}"/><text x="${PL - 6}" y="${(Y(v) + 4).toFixed(1)}" text-anchor="end">${esc(tickFmt(v, step))}</text>`).join('')}${marks}</svg>`;
  }
  const CAT_NAMES = { safe: 'Sicher', rec: 'Empfohlen', top: 'Top-Quote', kombi: 'Kombi', manual: 'Selbst eingetragen', scan: 'Gescannt' };
  const catOf = (b) => CAT_NAMES[b.auto ? b.list || 'safe' : b.src === 'scan' ? 'scan' : 'manual'];
  function marketOf(b) {
    if (b.legs.length > 1) return 'Kombi';
    const l = b.legs[0] || {};
    const c = l.m || pickCode(l, l.home || '', l.away || '');
    return c ? tipKind(c) : 'Sonstige';
  }
  const bandOf = (b) => (b.q < 1.5 ? 'unter 1,50' : b.q < 2 ? '1,50 bis 1,99' : b.q < 3 ? '2,00 bis 2,99' : 'ab 3,00');
  function splitRows(list) {
    const key = { cat: catOf, mkt: marketOf, odds: bandOf }[B.split];
    const m = new Map();
    list.forEach((b) => {
      const k = key(b);
      const x = m.get(k) || { k, n: 0, won: 0, pl: 0 };
      x.n++;
      x.won += b.status === 'won' ? 1 : 0;
      x.pl += betPL(b);
      m.set(k, x);
    });
    const rows = [...m.values()].sort((a, b) => b.pl - a.pl);
    const mx = Math.max(1e-9, ...rows.map((r) => Math.abs(r.pl)));
    return rows.map((r) => `<div class="sr-row"><div class="sr-t"><b>${esc(r.k)}</b><span>${r.won} von ${r.n} gewonnen</span></div><b class="sr-v ${plusMinus(r.pl)}">${signed(r.pl)}</b><div class="sr-bar"><i class="${r.pl < 0 ? 'neg' : 'pos'}" style="transform:scaleX(${(Math.abs(r.pl) / mx).toFixed(3)})"></i></div></div>`).join('');
  }
  function betLine(b, label) {
    regTeams(b);
    const pl = betPL(b);
    return `<div class="rec-it ${b.status}"><span class="mk">${b.status === 'won' ? '✓' : '✗'}</span><span class="grow"><b>${esc(betTitle(b))}</b><span>${esc(label)} · ${esc(fmtDate(b.done))} · Quote ${nf2.format(b.q)}</span></span><span class="rp2 ${plusMinus(pl)}">${signed(pl)}</span></div>`;
  }
  function ledgerHtml(lg) {
    const from = periodFrom();
    const rows = lg.ev.filter((e) => e.v !== 0 && e.t >= from).reverse();
    if (!rows.length) return '';
    const NAMES = { stake: 'Einsatz', won: 'Gewinn ausgezahlt', void: 'Einsatz zurück', in: 'Einzahlung', out: 'Auszahlung', fix: 'Korrektur' };
    const shown = B.more ? rows.slice(0, 200) : rows.slice(0, 6);
    return `<section class="sec"><div class="sec-h"><h2>Kontoauszug</h2><span class="note">${esc(PERIOD_TXT[B.period])}</span></div><div class="group">${shown.map((e) => `<div class="row lgr"><span class="grow"><div class="t">${NAMES[e.k]}</div><div class="s">${esc([fmtWhen(e.t), e.txt].filter(Boolean).join(' · '))}</div></span><span class="lgv"><b class="${e.v > 0 ? 'up' : ''}">${signed(e.v)}</b>${e.bal != null ? `<span>${eur(e.bal)}</span>` : ''}</span></div>`).join('')}</div>${rows.length > 6 ? `<button class="more" data-act="lgmore">${B.more ? 'Weniger anzeigen' : `Alle ${rows.length} anzeigen`}</button>` : ''}</section>`;
  }
  // Große Karte oben: Guthaben oder Gewinn, Kurve, Zeitraum
  function moneyHero(ws, lg) {
    const hasW = ws.balance != null;
    const mode = hasW ? B.mode : 'pl';
    const from = periodFrom();
    const sinceStart = mode === 'bal' && lg.st && lg.st.t > from; // Guthaben neu eingetragen: Gewinn zählt erst ab da
    const inPeriod = settledBets().filter((b) => b.status !== 'void' && b.done >= (sinceStart ? lg.st.t : from));
    const pl = inPeriod.reduce((a, b) => a + betPL(b), 0);
    const stake = inPeriod.reduce((a, b) => a + b.stake, 0);
    const allPl = plPts();
    const pts = slicePts(mode === 'bal' ? walletPts(lg) : allPl, from);
    const label = mode === 'bal' ? 'Guthaben' : 'Gewinn/Verlust';
    const big = mode === 'bal' ? eur(ws.balance) : signed(allPl.length ? allPl[allPl.length - 1].v : 0);
    const up = pl >= 0;
    const dir = pl > 0.004 ? '▲ ' : pl < -0.004 ? '▼ ' : '';
    const sub = `<span class="${plusMinus(pl)}">${dir}${esc(eur(Math.abs(pl)))}${stake ? ` (${pctSigned(pl / stake)})` : ''}</span> · ${esc(sinceStart ? 'seit dem Eintragen' : PERIOD_TXT[B.period])}`;
    const def = { big, sub, label };
    CH.line = null;
    const top = hasW
      ? `<div class="mseg"><button class="${mode === 'bal' ? 'on' : ''}" data-act="mmode" data-val="bal">Guthaben</button><button class="${mode === 'pl' ? 'on' : ''}" data-act="mmode" data-val="pl">Gewinn</button></div><button class="link" data-act="wallet">Ändern</button>`
      : '<span class="eyebrow">Gewinn/Verlust</span><button class="link" data-act="wallet">Guthaben eintragen</button>';
    if (!hasW && !ws.n) {
      return `<section class="mh"><div class="mh-top"><span class="eyebrow">Dein Geld</span></div><p class="mh-empty">Trag dein Guthaben ein, dann siehst du hier deine Kurve, deinen Gewinn und wie gut deine Wetten laufen.</p><button class="btn" data-act="wallet">Guthaben eintragen</button></section>`;
    }
    const chart = pts.length >= 2 ? lineChart(pts, up, mode === 'bal' ? eur : signed, def) : `<p class="mh-empty">Noch nichts in diesem Zeitraum. Sobald die erste Wette ausgewertet ist, erscheint hier deine Kurve.</p>`;
    return `<section class="mh"><div class="mh-top">${top}</div><div class="mh-n">${esc(big)}</div><div class="mh-d">${sub}</div>${chart}
      <div class="pseg">${PERIODS_M.map(([v, l]) => `<button class="${B.period === v ? 'on' : ''}" data-act="mperiod" data-val="${v}">${l}</button>`).join('')}</div>
      <div class="mh-open"><div><span>Im Spiel</span><b>${eur(ws.open)}</b></div><div><span>Möglicher Gewinn</span><b>${eur(ws.openWin)}</b></div><div><span>Offen</span><b>${ws.nOpen}</b></div></div></section>`;
  }
  function moneyOverview(lg) {
    const from = periodFrom();
    const list = settledBets().filter((b) => b.status !== 'void' && b.done >= from);
    if (!list.length) return `<div class="empty">In diesem Zeitraum ist noch keine Wette ausgewertet. Danach stehen hier Rendite, Trefferquote und mehr.</div>${ledgerHtml(lg)}`;
    const pl = list.reduce((a, b) => a + betPL(b), 0);
    const stake = list.reduce((a, b) => a + b.stake, 0);
    const won = list.filter((b) => b.status === 'won').length;
    const avgQ = list.reduce((a, b) => a + b.q, 0) / list.length;
    let cur = 0;
    let curW = null;
    let best = 0;
    let run = 0;
    let cum = 0;
    let peak = 0;
    let dd = 0;
    list.forEach((b) => {
      const w = b.status === 'won';
      run = w ? run + 1 : 0;
      best = Math.max(best, run);
      if (curW === w) cur++; else { curW = w; cur = 1; }
      cum += betPL(b);
      peak = Math.max(peak, cum);
      dd = Math.max(dd, peak - cum);
    });
    const tile = (l, v, sub, c) => `<div class="kpi"><span>${l}</span><b class="${c || ''}">${v}</b>${sub ? `<small>${sub}</small>` : ''}</div>`;
    const kpis = tile('Gewinn/Verlust', signed(pl), `bei ${eur(stake)} Einsatz`, plusMinus(pl))
      + tile('Rendite', pctSigned(pl / stake), 'Gewinn je Euro Einsatz', plusMinus(pl))
      + tile('Trefferquote', pctR(won / list.length), `${won} von ${list.length} gewonnen`)
      + tile('Ø Quote', nf2.format(avgQ), `fair wären ${pctR(1 / avgQ)} Treffer`)
      + tile('Aktuelle Serie', `${cur} ${curW ? (cur === 1 ? 'Sieg' : 'Siege') : (cur === 1 ? 'Niederlage' : 'Niederlagen')}`, `längste Siegesserie: ${best}`)
      + tile('Größter Rückgang', dd > 0.004 ? `−${eur(dd)}` : eur(0), 'vom Höchststand aus');
    const { unit, bk } = bucketize(list, from);
    const lastK = bk.slice().reverse().find((k) => k.n) || bk[bk.length - 1];
    const sorted = list.slice().sort((a, b) => betPL(b) - betPL(a));
    const bestB = sorted[0];
    const worstB = sorted[sorted.length - 1];
    const splitTabs = [['cat', 'Art'], ['mkt', 'Wette'], ['odds', 'Quote']];
    return `<div class="kpis">${kpis}</div>
      <section class="sec"><div class="sec-h"><h2>Gewinn je ${{ day: 'Tag', week: 'Woche', month: 'Monat' }[unit]}</h2></div><div class="card"><p class="bc-read">${esc(bucketRead(lastK, unit))}</p>${barChart(bk, unit)}</div></section>
      <section class="sec"><div class="sec-h"><h2>Wo du gewinnst</h2></div><div class="card"><div class="pseg in">${splitTabs.map(([v, l]) => `<button class="${B.split === v ? 'on' : ''}" data-act="bsplit" data-val="${v}">${l}</button>`).join('')}</div><div class="srs">${splitRows(list)}</div></div></section>
      <section class="sec"><div class="sec-h"><h2>Höhepunkte</h2></div><div class="card rec"><div class="rec-list" style="border-top:0">${betLine(bestB, 'Beste')}${worstB !== bestB ? betLine(worstB, 'Schlechteste') : ''}</div></div></section>
      ${ledgerHtml(lg)}`;
  }
  function vBets() {
    const ws = walletState();
    const bets = betsAll();
    const lg = ledger();
    const open = bets.filter((b) => b.status === 'open').sort((x, y) => (firstKick(x) - firstKick(y)) || (y.at - x.at));
    const done = bets.filter((b) => b.status !== 'open').sort((x, y) => (y.done || 0) - (x.done || 0));
    const TABS_B = [['over', 'Übersicht'], ['open', `Offen · ${open.length}`], ['done', `Erledigt · ${done.length}`]];
    const k = Math.max(0, TABS_B.findIndex((x) => x[0] === B.tab));
    const list = B.tab === 'done' ? done : open;
    const hero = moneyHero(ws, lg);
    const body = B.tab === 'over' ? moneyOverview(lg)
      : `<div class="blist">${list.length ? list.map(betCard).join('') : `<div class="empty">${B.tab === 'done' ? 'Noch keine erledigten Wetten.' : 'Keine offenen Wetten. Speichere einen Top-Tipp, trag eine Wette ein oder scanne deinen Wettschein.'}</div>`}</div>`;
    return `${aura('bets')}<h1 class="ptitle">Wetten</h1>${hero}
      <div class="bet-acts"><button class="bact" data-act="newbet">${I.pen}<span>Wette eintragen</span></button><label class="bact">${I.scan}<span>Wettschein scannen</span><input type="file" accept="image/*" data-act="scanbet" aria-label="Wettschein-Screenshot wählen"></label></div>
      <div class="seg s3" style="--k:${k};margin-top:18px"><span class="ind"></span>${TABS_B.map(([v, l]) => `<button class="${B.tab === v ? 'on' : ''}" data-act="btab" data-val="${v}">${l}</button>`).join('')}</div>
      <div class="bbody">${body}</div>
      <p class="foot">Alles bleibt nur auf diesem Handy. Wetten aus den Top-Tipps und erkannte Scans prüft Result AI nach dem Abpfiff selbst, für die Erfolgsquote im Verlauf zählen nur die Top-Tipps.<br>${RG_TEXT}</p>`;
  }
  // Verlauf: Wetten aus den Top-Tipps nach Anstoß-Tag, mit ✓/✗ von Result AI
  function histBets(list) {
    let out = '';
    let day = '';
    list.slice().sort((x, y) => (lastKick(y) || y.at) - (lastKick(x) || x.at)).forEach((b) => {
      regTeams(b);
      const t = lastKick(b) || b.at;
      const dk = new Date(t).toDateString();
      if (dk !== day) {
        const dd = dayDiff(new Date(t).toISOString());
        out += `${day ? '</div>' : ''}<div class="kl-day">${esc(dd === 0 ? 'Heute' : dd === -1 ? 'Gestern' : dd === 1 ? 'Morgen' : new Date(t).toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' }))}</div><div class="group">`;
        day = dk;
      }
      const l = b.legs[0] || {};
      const mk = { won: '✓', lost: '✗', void: '–', open: '' }[b.status];
      const right = b.status === 'open' ? `<span class="hp"><b>${eur(b.win)}</b><span>möglich</span></span>`
        : `<span class="hp ${b.status}"><b>${b.status === 'void' ? eur(b.stake) : signed(payout(b) - b.stake)}</b><span>${{ won: 'gewonnen', lost: 'verloren', void: 'zurück' }[b.status]}</span></span>`;
      out += `<a class="row hrow hb ${b.status}" href="#/bets">${b.legs.length > 1 ? `<span class="round kb">${b.legs.length}</span>` : `<span class="duo">${crest(l.home, 30, true)}${crest(l.away, 30, true)}</span>`}<span class="grow"><div class="t">${esc(betTitle(b))}</div><div class="s">${esc(betSub(b))}${b.status === 'open' ? ' · ' + esc(liveText(b)) : ''}</div></span>${right}${mk ? `<span class="hmk ${b.status}">${mk}</span>` : ''}</a>`;
    });
    return day ? out + '</div>' : '';
  }

  // Speichern aus den Top-Tipps (einzelner Tipp oder Kombi) → Blatt mit Quote und Einsatz
  const findTip = (list, g, m) => T.data && ((T.data[list] || []).find((t) => t.g === g && t.m === m)
    || LISTS.map(([k]) => (T.data[k] || []).find((t) => t.g === g && t.m === m)).find(Boolean));
  function tipLeg(t) {
    const g = T.data.games[t.g];
    const h = tipTeam(g.home);
    const a = tipTeam(g.away);
    return { g: g.id, slug: g.slug, m: t.m, home: h, away: a, comp: g.comp, t: g.t, pick: tipLabel(t.m, h, a), q: t.q, p: t.p, res: null };
  }
  function saveTip(list, g, m) {
    if (savedKeys().has(`${g}|${m}`)) { location.replace('#/bets'); return; }
    const t = findTip(list, g, m);
    if (!t) { toast('Dieser Tipp ist nicht mehr in der Liste.'); return; }
    if (!upcoming(t)) { toast('Das Spiel hat schon begonnen – nicht mehr speicherbar.'); return; }
    const leg = tipLeg(t);
    openBetSheet({ src: 'tip', list, key: `${g}|${m}`, legs: [leg], q: t.q, p: t.p, title: legTeams(leg) });
  }
  function saveKombi(i) {
    const d = T.data;
    const k = d && d.kombis[i];
    if (!k) return;
    if (savedKeys().has(kombiKey(k))) { location.replace('#/bets'); return; }
    const all = d.top.concat(d.safe, d.rec || []);
    const tips = k.legs.map((l) => all.find((t) => t.g === l.g && t.m === l.m));
    if (!tips.every((t) => t && upcoming(t))) { toast('Ein Spiel dieser Kombi hat schon begonnen.'); return; }
    openBetSheet({ src: 'tip', list: 'kombi', key: kombiKey(k), legs: tips.map(tipLeg), q: k.q, p: k.p, title: k.name });
  }
  function openBetSheet(o) {
    if ($('.sheet')) return;
    B.draft = Object.assign({ status: 'open' }, o);
    const tip = o.src === 'tip';
    const legs = (o.legs || []).map((l) => `<div class="bleg">${l.home && l.away ? `<span class="duo">${crest(l.home, 26, true)}${crest(l.away, 26, true)}</span>` : `<span class="bl-ic">${I.ticket}</span>`}<span class="grow"><b>${esc(l.pick)}</b><span>${esc([legTeams(l), l.t ? kickoff(l.t) : ''].filter(Boolean).join(' · '))}</span></span>${l.q ? `<span class="bl-q">${nf2.format(l.q)}</span>` : ''}</div>`).join('');
    const what = o.src === 'manual'
      ? `<label class="bf wide"><span>Worauf hast du gewettet?</span><input type="text" data-act="bpick" maxlength="80" placeholder="z. B. Sieg Bayern, Über 2,5 Tore" autocomplete="off" enterkeyhint="next"></label>
        <label class="bf wide"><span>Spiel (wenn du magst)</span><input type="text" data-act="bevent" maxlength="80" placeholder="z. B. Bayern – Dortmund" autocomplete="off" enterkeyhint="next"></label>`
      : `<div class="bf-legs">${legs}</div>`;
    const status = o.src === 'scan' ? `<div class="lab" style="margin-top:14px">STAND DES WETTSCHEINS</div><div class="chips bf-st">${[['open', 'Offen'], ['won', 'Gewonnen'], ['lost', 'Verloren'], ['void', 'Storniert']].map(([v, l]) => `<button class="${B.draft.status === v ? 'on' : ''}" data-act="bstatus" data-val="${v}">${l}</button>`).join('')}</div>` : '';
    const sh = document.createElement('div');
    sh.className = 'sheet';
    sh.innerHTML = `<div class="bg" data-act="close"></div><div class="panel bet-panel" role="dialog" aria-label="Wette"><div class="grip" data-grip></div>
      <h2>${o.src === 'manual' ? 'Wette eintragen' : o.src === 'scan' ? 'Erkannte Wette' : o.legs.length > 1 ? 'Kombi speichern' : 'Wette speichern'}</h2>
      ${o.note ? `<p class="bf-note" style="margin:-6px 4px 12px">${esc(o.note)}</p>` : ''}${what}
      <div class="bf-grid"><label class="bf"><span>${tip ? 'Quote bei Tipico' : 'Quote'}</span><input type="text" inputmode="decimal" data-act="bq" value="${o.q ? nf2.format(o.q) : ''}" placeholder="z. B. 1,85" autocomplete="off"></label>
        <label class="bf"><span>Einsatz in €</span><input type="text" inputmode="decimal" data-act="bstake" value="${o.stake ? nf2.format(o.stake) : ''}" placeholder="z. B. 5" autocomplete="off"></label></div>
      <div class="chips bf-chips">${[2, 5, 10, 20, 50].map((v) => `<button data-act="bchip" data-val="${v}">${v} €</button>`).join('')}</div>${status}
      <div class="bf-win"><span>Möglicher Gewinn</span><b class="bs-win">–</b></div>
      ${tip ? '' : `<label class="bf wide"><span>Anbieter (wenn du magst)</span><input type="text" data-act="bbookie" maxlength="30" value="${esc(o.bookie || '')}" placeholder="z. B. Tipico" autocomplete="off"></label>`}
      <p class="bf-note">${tip ? 'Result AI prüft diese Wette nach dem Abpfiff selbst und trägt das Ergebnis in Verlauf und Erfolgsquote ein.' : o.track ? 'Result AI hat alle Spiele erkannt und prüft die Wette nach dem Abpfiff selbst. Du kannst sie auch von Hand markieren.' : 'Ob sie aufgegangen ist, markierst du später selbst unter „Wetten“.'}</p>
      <button class="btn" data-act="betsave">Speichern</button></div>`;
    document.body.appendChild(sh);
    updateWin();
  }
  // möglicher Gewinn = Einsatz × Quote (vom Wettschein übernommen, solange beides unverändert ist – dort ist z. B. die Wettsteuer schon drin)
  function draftWin(sh) {
    const d = B.draft;
    const q = dec($('[data-act="bq"]', sh).value);
    const st = dec($('[data-act="bstake"]', sh).value);
    const fixed = !!(d && d.win && d.stake && d.q && st === d.stake && q === d.q);
    return { q, st, fixed, win: fixed ? d.win : q && st ? q * st : null };
  }
  function updateWin() {
    const sh = $('.sheet');
    if (!sh || !B.draft || !$('.bs-win', sh)) return;
    const w = draftWin(sh);
    $('.bs-win', sh).textContent = w.win ? eur(w.win) + (w.fixed ? ' · laut Wettschein' : '') : '–';
  }
  function saveDraft() {
    const sh = $('.sheet');
    const d = B.draft;
    if (!sh || !d) return;
    const w = draftWin(sh);
    if (!w.q || w.q < 1.01 || w.q > 10000) { toast('Bitte eine Quote eintragen (z. B. 1,85).'); return; }
    if (!w.st || w.st <= 0 || w.st > 1e6) { toast('Bitte deinen Einsatz eintragen.'); return; }
    let legs = d.legs || [];
    if (d.src === 'manual') {
      const pick = ($('[data-act="bpick"]', sh).value || '').trim();
      if (!pick) { toast('Bitte eintragen, worauf du gewettet hast.'); return; }
      legs = [{ pick, event: ($('[data-act="bevent"]', sh).value || '').trim() || null, res: null }];
    }
    const bk = $('[data-act="bbookie"]', sh);
    const status = d.src === 'tip' ? 'open' : d.status || 'open';
    const b = { id: 'b' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), at: Date.now(), src: d.src, auto: d.src === 'tip', track: !!d.track, list: d.list || null,
      key: d.key || null, title: d.title || null, legs, q: Math.round(w.q * 100) / 100, p: d.p || null, stake: Math.round(w.st * 100) / 100,
      win: Math.round(w.win * 100) / 100, status, done: status === 'open' ? null : Date.now(), bookie: bk ? bk.value.trim() || null : null, teams: teamsOf(legs) };
    const all = betsAll();
    all.unshift(b);
    betsSave(all);
    B.draft = null;
    closeSheet();
    haptic();
    toast(b.auto || b.track ? 'Gespeichert · Result AI prüft nach dem Abpfiff' : 'Wette gespeichert');
    refreshBets();
    if (curPath() === '/slip') { B.tab = b.status === 'open' ? 'open' : 'done'; location.replace('#/bets'); }
  }
  function settleManual(id, st) {
    const all = betsAll();
    const b = all.find((x) => x.id === id);
    if (!b || b.auto) return; // Top-Tipp-Wetten wertet nur Result AI aus
    b.status = st;
    b.done = st === 'open' ? null : Date.now();
    betsSave(all);
    haptic();
    if (st === 'won') toast(`Gewonnen: ${signed(b.win - b.stake)}`);
    refreshBets();
  }
  function deleteBet(id) {
    const all = betsAll();
    const b = all.find((x) => x.id === id);
    if (!b || !canDelete(b)) return;
    betsSave(all.filter((x) => x !== b));
    toast('Wette gelöscht');
    refreshBets();
  }
  function openWalletSheet() {
    if ($('.sheet')) return;
    const ws = walletState();
    const sh = document.createElement('div');
    sh.className = 'sheet';
    sh.innerHTML = `<div class="bg" data-act="close"></div><div class="panel bet-panel" role="dialog" aria-label="Guthaben"><div class="grip" data-grip></div>
      <h2>Guthaben</h2><div class="lab">GUTHABEN JETZT – SO WIE BEI DEINEM WETTANBIETER</div>
      <input class="search" type="text" inputmode="decimal" data-act="wbase" value="${ws.balance != null ? nf2.format(ws.balance) : ''}" placeholder="z. B. 50,00" autocomplete="off">
      <button class="btn" data-act="wsave" data-mode="base" style="margin-top:10px">Übernehmen</button>
      <div class="lab" style="margin-top:24px">EINZAHLUNG ODER AUSZAHLUNG</div>
      <input class="search" type="text" inputmode="decimal" data-act="wmove" placeholder="Betrag, z. B. 20" autocomplete="off">
      <div class="bf-2"><button class="btn soft" data-act="wsave" data-mode="in">Einzahlen</button><button class="btn soft" data-act="wsave" data-mode="out">Auszahlen</button></div>
      <p class="bf-note">Ab jetzt rechnet Result AI selbst weiter: Jede neue Wette zieht den Einsatz ab, jeder Gewinn kommt dazu, eine stornierte Wette gibt den Einsatz zurück.</p>${ws.balance != null ? '<button class="bf-reset" data-act="wreset">Guthaben zurücksetzen</button>' : ''}</div>`;
    document.body.appendChild(sh);
  }
  // Guthaben von vorne: Betrag, Ein-/Auszahlungen und Guthaben-Kurve weg. Wetten, Gewinn/Verlust und Erfolgsquote bleiben.
  function walletResetAsk() {
    const p = $('.sheet .panel');
    if (!p) return;
    p.innerHTML = `<div class="grip" data-grip></div><h2>Guthaben zurücksetzen?</h2>
      <p class="bf-note" style="font-size:15px">Dein Guthaben, deine Ein- und Auszahlungen und die Guthaben-Kurve werden gelöscht. Deine Wetten und die Erfolgsquote bleiben. Das lässt sich nicht rückgängig machen.</p>
      <button class="btn danger" data-act="wresetgo">Ja, zurücksetzen</button><button class="btn soft" data-act="close" style="margin-top:8px">Abbrechen</button>`;
  }
  function walletReset() {
    store.set('wallet', {});
    closeSheet();
    haptic();
    toast('Guthaben zurückgesetzt');
    refreshBets();
  }
  function saveWallet(mode) {
    const sh = $('.sheet');
    if (!sh) return;
    const w = store.get('wallet', {}) || {};
    if (mode === 'base') {
      const v = dec($('[data-act="wbase"]', sh).value);
      if (v == null || v < 0) { toast('Bitte einen Betrag eintragen.'); return; }
      const now = Date.now();
      const nv = Math.round(v * 100) / 100;
      if (typeof w.base === 'number') {
        if (!w.start) w.start = { t: w.at || 0, v: w.base };
        const diff = Math.round((nv - walletState().balance) * 100) / 100;
        if (diff) (w.fixes = w.fixes || []).push({ t: now, v: diff });
      } else w.start = { t: now, v: nv };
      Object.assign(w, { base: nv, at: now, moves: w.moves || [] });
    } else {
      const v = dec($('[data-act="wmove"]', sh).value);
      if (!v || v <= 0) { toast('Bitte einen Betrag eintragen.'); return; }
      if (typeof w.base !== 'number') { toast('Trag zuerst oben dein Guthaben ein.'); return; }
      (w.moves = w.moves || []).push({ t: Date.now(), v: mode === 'in' ? v : -v });
    }
    store.set('wallet', w);
    closeSheet();
    haptic();
    refreshBets();
  }

  // Automatische Prüfung (Niklas: „die KI soll sofort nach Abpfiff prüfen“): Endstand direkt von ESPN, sobald die App offen ist –
  // läuft ein Spiel, alle 60 Sekunden. Gewertet wird nach 90 Minuten (bei Verlängerung: Tore der zwei Halbzeiten).
  const ESPN_API = 'https://site.api.espn.com/apis/site/v2/sports/soccer';
  const LIVE = {}; // Spiel-ID -> { state, done, hs, as, clock, et, cancelled, at }
  const FAM = ['H', 'D', 'A', 'HD', 'DA', 'HA'];
  function wonCode(code, x, y) {
    if (FAM.includes(code)) return code.includes(x > y ? 'H' : x === y ? 'D' : 'A');
    if (/^[OU]\d\d$/.test(code)) { const line = +code.slice(1) / 10; return code[0] === 'O' ? x + y > line : x + y < line; }
    return { HS: x > 0, AS: y > 0, BY: x > 0 && y > 0, BN: !(x > 0 && y > 0) }[code];
  }
  function parseGame(d) {
    const c = d && d.header && d.header.competitions && d.header.competitions[0];
    if (!c) return null;
    const st = (c.status && c.status.type) || {};
    const side = (k) => (c.competitors || []).find((x) => x.homeAway === k) || {};
    const h = side('home');
    const a = side('away');
    const int = (v) => { const n = parseInt(v, 10); return Number.isFinite(n) ? n : null; };
    let hs = int(h.score);
    let as = int(a.score);
    const name = String(st.name || '');
    const et = /AET|PEN|EXTRA|SHOOTOUT/i.test(name);
    if (et) { // Wetten zählen nach 90 Minuten: nur die Tore der zwei Halbzeiten
      const ls = (x) => (x.linescores || []).map((l) => int(l.displayValue != null ? l.displayValue : l.value));
      const lh = ls(h);
      const la = ls(a);
      hs = lh.length >= 2 && lh[0] != null && lh[1] != null ? lh[0] + lh[1] : null;
      as = la.length >= 2 && la[0] != null && la[1] != null ? la[0] + la[1] : null;
    }
    return { state: st.state, done: !!st.completed, et, hs, as, clock: (c.status && c.status.displayClock) || '', cancelled: /POSTPON|CANCEL|ABANDON|SUSPEND|FORFEIT/i.test(name) };
  }
  let checking = null;
  function checkBets() {
    if (checking) return checking;
    const now = Date.now();
    const due = new Map();
    betsAll().forEach((b) => {
      if (!(b.auto || b.track) || b.status !== 'open') return;
      b.legs.forEach((l) => {
        if (l.res || !l.g || !l.slug || !l.t || new Date(l.t).getTime() > now) return;
        if (!LIVE[l.g] || now - LIVE[l.g].at > 50e3) due.set(l.g, l.slug);
      });
    });
    if (!due.size) return Promise.resolve(false);
    let moved = false; // hat sich ein Spielstand oder die Minute geändert? (nur dann neu zeichnen)
    checking = Promise.all([...due].map(([g, slug]) => (g.startsWith('fmg:') ? loadTips().then((d) => {
      const r = d.res && d.res[g];
      if (r && !(LIVE[g] && LIVE[g].done)) moved = true;
      LIVE[g] = r ? { state: 'post', done: true, hs: r[0], as: r[1], clock: '', at: Date.now() } : { state: 'pre', done: false, hs: null, as: null, clock: '', at: Date.now() };
    }).catch(() => {}) : fetch(`${ESPN_API}/${slug}/summary?event=${encodeURIComponent(g)}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null)).then((d) => {
        const s = parseGame(d);
        if (!s) return;
        const o = LIVE[g];
        if (!o || o.hs !== s.hs || o.as !== s.as || o.state !== s.state || o.clock !== s.clock) moved = true;
        LIVE[g] = Object.assign(s, { at: Date.now() });
      }).catch(() => {}))))
      .then(() => settleAuto(moved)).finally(() => { checking = null; });
    return checking;
  }
  const liveBets = () => betsAll().some((b) => (b.auto || b.track) && b.status === 'open' && b.legs.some((l) => !l.res && l.t && new Date(l.t).getTime() <= Date.now()));
  function settleAuto(moved) {
    const all = betsAll();
    const now = Date.now();
    const changed = [];
    let touched = false;
    all.forEach((b) => {
      if (!(b.auto || b.track) || b.status !== 'open') return;
      let hit = false;
      b.legs.forEach((l) => {
        const s = l.g && LIVE[l.g];
        if (l.res || !s || !l.m) return;
        if (s.cancelled && now - new Date(l.t).getTime() > 48 * 36e5) l.res = { void: true }; // abgesagt/verschoben: zählt nicht (wie beim Buchmacher)
        else if (s.done && !s.cancelled && s.hs != null && s.as != null) l.res = { hs: s.hs, as: s.as, won: !!wonCode(l.m, s.hs, s.as), et: s.et || undefined };
        else if (s.done && s.et && FAM.includes(l.m)) l.res = { hs: null, as: null, et: true, won: l.m.includes('D') }; // in die Verlängerung = nach 90 Min. unentschieden
        else return;
        hit = true;
      });
      if (!hit) return;
      touched = true;
      const rs = b.legs.map((l) => l.res);
      const st = rs.some((r) => r && !r.void && !r.won) ? 'lost' : rs.every(Boolean) ? (rs.every((r) => r.void) ? 'void' : 'won') : 'open';
      if (st === 'open') return;
      b.status = st;
      b.done = now;
      if (st === 'won') { const f = b.legs.reduce((x, l) => x * (l.res.void && l.q ? l.q : 1), 1); b.win = Math.round((b.win / f) * 100) / 100; } // abgesagtes Spiel in der Kombi zählt wie Quote 1,0
      changed.push(b);
    });
    if (touched) betsSave(all);
    if (changed.length === 1) { const b = changed[0]; toast(b.status === 'won' ? `✓ Gewonnen: ${betTitle(b)} · ${signed(b.win - b.stake)}` : b.status === 'lost' ? `✗ Verloren: ${betTitle(b)}` : `Abgesagt: ${betTitle(b)} – Einsatz zurück`); }
    else if (changed.length > 1) toast(`${changed.length} Wetten ausgewertet – ${changed.filter((b) => b.status === 'won').length} gewonnen`);
    if (changed.length) haptic();
    if (touched) refreshBets();
    else if (moved) refreshBets(true);
    return changed.length > 0;
  }
  // Seiten mit Wetten neu zeichnen (live = nur die Seiten mit Spielständen)
  const BET_PAGES = /^\/(|tips|bets|hist|acc|r\/t_.+)$/;
  function refreshBets(live) { redrawAll((p) => (live ? p === '/bets' || p === '/hist' : BET_PAGES.test(p))); }

  // Wettschein-Screenshot → KI (Gemini auf dem Cloudflare-Server) → Wette vorausgefüllt zum Prüfen
  function shrink(file) {
    return new Promise((res, rej) => {
      const url = URL.createObjectURL(file);
      const im = new Image();
      im.onload = () => {
        const k = Math.min(1, 1280 / im.naturalWidth, 3600 / im.naturalHeight); // lange Wettscheine bleiben lesbar
        const c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(im.naturalWidth * k));
        c.height = Math.max(1, Math.round(im.naturalHeight * k));
        c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        res(c.toDataURL('image/jpeg', 0.85));
      };
      im.onerror = () => { URL.revokeObjectURL(url); rej(new Error('Bild nicht lesbar')); };
      im.src = url;
    });
  }
  const kickIso = (s) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/.exec(s || '');
    if (!m) return null;
    const d = new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
    return isNaN(d) ? null : d.toISOString();
  };
  let toastT = 0;
  function toast(msg) {
    let t = $('.toast');
    if (!t) {
      t = document.createElement('div');
      t.className = 'toast';
      t.setAttribute('role', 'status');
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.classList.remove('show');
    void t.offsetWidth; // neu einblenden, auch wenn gerade schon eine Meldung steht
    t.classList.add('show');
    clearTimeout(toastT);
    toastT = setTimeout(() => t.classList.remove('show'), 2800);
  }

  // ------------------------------------------------------------------ Seiten-Stapel: neue Seite schiebt sich von rechts herein
  document.body.insertAdjacentHTML('beforeend', '<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>'
    + '<linearGradient id="rg-safe" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#34C759"/><stop offset="1" stop-color="#00B39B"/></linearGradient>'
    + '<linearGradient id="rg-top" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFB020"/><stop offset="1" stop-color="#FF375F"/></linearGradient>'
    + '<linearGradient id="rg-rec" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0A84FF"/><stop offset="1" stop-color="#AF52DE"/></linearGradient></defs></svg>');
  const stackEl = document.createElement('div');
  stackEl.className = 'stack';
  document.body.appendChild(stackEl);
  const tabbar = document.createElement('nav');
  tabbar.className = 'tabbar';
  tabbar.setAttribute('aria-label', 'Bereiche');
  tabbar.innerHTML = '<span class="tab-ind" aria-hidden="true"></span>' + TABS.map(([p, label, ic]) => `<button data-act="tab" data-tab="${p}"><span class="ti"><span class="o">${I[ic]}</span><span class="f">${I[ic + 'F'] || I[ic]}</span></span><span class="tl">${label}</span></button>`).join('');
  document.body.appendChild(tabbar);
  function syncTabs() {
    const root = S.stack[0] ? S.stack[0].path : '/';
    const i = Math.max(0, TABS.findIndex((t) => t[0] === root));
    tabbar.style.setProperty('--i', i);
    tabbar.dataset.tab = TABS[i][0];
    $$('button', tabbar).forEach((b, k) => { b.classList.toggle('on', k === i); if (k === i) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
  }
  // Bereich wechseln: ohne Schieben (wie bei iPhone-Apps), der Scrollstand je Bereich bleibt
  function switchTab(path) {
    const root = S.stack[0];
    if (root) S.tabScroll[root.path] = root.el.scrollTop;
    S.stack.forEach((p) => p.el.remove());
    $$('.shade', stackEl).forEach((x) => x.remove());
    const p = makePage(path);
    stackEl.appendChild(p.el);
    S.stack = [p];
    p.el.scrollTop = S.tabScroll[path] || 0;
    syncTabs();
    if (!reduce) p.el.animate([{ opacity: 0.35 }, { opacity: 1 }], { duration: 180, easing: 'ease-out' });
    afterShow(p, false);
  }
  const curPath = () => (location.hash || '#/').slice(1) || '/';
  const shadeMax = () => (isDark() ? 0.5 : 0.12);
  const SLIDE = { duration: 440, easing: 'cubic-bezier(.32,.72,0,1)', fill: 'both' };
  function makeShade() { const d = document.createElement('div'); d.className = 'shade'; return d; }
  // Wartet auf die Animationen – mit Sicherung: hakt das Handy oder geht die App in den Hintergrund, wird der Wechsel
  // nach kurzer Zeit trotzdem zu Ende gebracht, damit nie zwei Seiten halb übereinander stehen bleiben
  function settle(anims, ms) {
    const wd = setTimeout(() => anims.forEach((a) => { try { a.finish(); } catch (e) { /* schon fertig */ } }), ms);
    return Promise.all(anims.map((a) => a.finished)).catch(() => {}).finally(() => clearTimeout(wd));
  }
  function onPageScroll(e) {
    const el = e.currentTarget;
    if (el._raf) return;
    el._raf = requestAnimationFrame(() => {
      el._raf = 0;
      const b = el.firstElementChild;
      const y = el.scrollTop;
      if (!el._geo) el._geo = pageGeo(el);
      const g = el._geo;
      b.classList.toggle('scrolled', y > 4);
      b.classList.toggle('titled', y > g.title);
      if (g.nav) { g.nav.classList.toggle('stuck', y >= g.navAt); spy(el, g, y); }
    });
  }
  // Maße einer Seite (einmal je Seite, aus dem Layout – Animationen zählen nicht): ab wann der kleine Titel erscheint,
  // wann die Sprung-Leiste klebt und wo die Abschnitte liegen
  function pageGeo(el) {
    const pos = (x) => { let t = 0; for (let n = x; n && n !== el; n = n.offsetParent) t += n.offsetTop; return t; };
    const bar = el.firstElementChild.offsetHeight;
    const mc = $('.match', el);
    const nav = $('.snav', el);
    const navTop = nav ? (mc ? pos(mc) + mc.offsetHeight + parseFloat(getComputedStyle(nav).marginTop || 0) : pos(nav)) : 0;
    return { title: mc ? pos(mc) + mc.offsetHeight - bar - 10 : 64, nav, navAt: nav ? navTop - bar - 1 : 0, off: bar + (nav ? nav.offsetHeight : 0) + 8,
      secs: nav ? $$('[data-sec]', el).filter((x) => !x.closest('.snav')).map((x) => [x.dataset.sec, pos(x)]) : [], cur: null };
  }
  function spy(el, g, y) {
    let cur = g.secs.length ? g.secs[0][0] : null;
    g.secs.forEach(([k, t]) => { if (t - g.off <= y + 4) cur = k; });
    if (g.secs.length && y + el.clientHeight >= el.scrollHeight - 4) cur = g.secs[g.secs.length - 1][0]; // ganz unten: letzter Abschnitt
    if (!cur || g.cur === cur) return;
    g.cur = cur;
    $$('button', g.nav).forEach((bt) => {
      const on = bt.dataset.sec === cur;
      bt.classList.toggle('on', on);
      if (on) g.nav.scrollTo({ left: Math.max(0, bt.offsetLeft - (g.nav.clientWidth - bt.offsetWidth) / 2), behavior: reduce ? 'auto' : 'smooth' });
    });
  }
  function makePage(path) {
    const el = document.createElement('section');
    el.className = 'page' + (path.startsWith('/r/') ? ' rp' : '');
    el.innerHTML = barHtml(path) + `<div class="wrap">${viewHtml(path)}</div>`;
    el.addEventListener('scroll', onPageScroll, { passive: true });
    return { path, el, shown: false, drawn: { tips: T.at, ratings: !!R.data, err: T.err } };
  }
  function afterShow(p, first) {
    if (p.shown) return;
    p.shown = true;
    if (p.path === '/scan') runScan(p.el);
    if (p.path === '/pick' && !R.data) loadRatings().then(() => { if (S.stack[S.stack.length - 1] === p) redrawTop(); }).catch(() => {});
    if (p.path === '/' || p.path === '/tips' || p.path === '/bilanz' || p.path.startsWith('/r/t_')) freshTips(p);
    if (p.path === '/bets' || p.path === '/hist' || p.path === '/acc') checkBets();
    if (p.path === '/ki') {
      Promise.all([loadActivity(20e3), loadTips().catch(() => {}), loadRatings().catch(() => {}), loadServer()]).catch(() => {})
        .then(() => { if (p.el.isConnected) redrawPage(p); });
    }
    if (p.path.startsWith('/r/')) reveal(p.el);
  }
  // Ergebnis-Auftritt: Karte → Zahl rollt → Balken → Liste (einmalig)
  function reveal(el) {
    const res = $('.res', el);
    const big = $('.big', el);
    if (!res || !big) return;
    if (!reduce) res.classList.add('reveal');
    requestAnimationFrame(() => requestAnimationFrame(() => big.classList.add('go')));
    setTimeout(() => big.classList.add('go'), 150); // Sicherung, falls das Handy gerade keine Bilder zeichnet
  }
  async function push(path) {
    const from = S.stack[S.stack.length - 1];
    const to = makePage(path);
    stackEl.appendChild(to.el);
    S.stack.push(to);
    if (!from || reduce) { if (from) from.el.classList.add('hide'); afterShow(to, !from); return; }
    const mo = S.morph;
    S.morph = null;
    if (mo && performance.now() - mo.t < 900 && path.startsWith('/r/') && mo.el.isConnected && $('.match', to.el)) { await morphPush(from, to, mo); return; }
    S.busy = true;
    stackEl.classList.add('busy');
    const shade = makeShade();
    stackEl.insertBefore(shade, to.el);
    to.el.classList.add('edge');
    const anims = [
      to.el.animate([{ transform: 'translateX(100%)' }, { transform: 'translateX(0)' }], SLIDE),
      from.el.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-28%)' }], SLIDE),
      shade.animate([{ opacity: 0 }, { opacity: shadeMax() }], SLIDE),
    ];
    const t = setTimeout(() => afterShow(to, false), 200); // Auftritt startet, während die Seite noch hereinkommt
    await settle(anims, SLIDE.duration + 600);
    clearTimeout(t);
    from.el.classList.add('hide');
    anims.forEach((a) => a.cancel());
    shade.remove();
    to.el.classList.remove('edge');
    S.busy = false;
    stackEl.classList.remove('busy');
    afterShow(to, false);
  }
  // Karte wächst in die Seite (wie im App Store): ein Abbild der Spiel-Karte fliegt von der angetippten Karte an ihren
  // Platz, die neue Seite blendet darunter ein – gleichmäßig skaliert (nichts verzerrt), nur transform/opacity.
  const MORPH = { duration: 560, easing: 'cubic-bezier(.32,.72,0,1)' };
  document.addEventListener('click', (e) => {
    if (e.target.closest && e.target.closest('.tsave, .gsave')) return; // Speichern-Knopf in der Karte öffnet kein Spiel
    const c = e.target.closest && e.target.closest('a.tcard, a.tmini, a.k-leg, a.row[href^="#/r/"], a.spot, a.tmc');
    if (c) S.morph = { el: c, rect: c.getBoundingClientRect(), t: performance.now() };
  }, true);
  function ghostOf(card, r) {
    const g = card.cloneNode(true);
    g.classList.add('ghost');
    g.setAttribute('aria-hidden', 'true');
    Object.assign(g.style, { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' });
    document.body.appendChild(g);
    return g;
  }
  // Lage der Spiel-Karte (dst), verkleinert auf die Fläche der angetippten Karte (src)
  const flyFrom = (src, dst) => {
    const k = Math.min(src.width / dst.width, src.height / dst.height);
    return `translate(${(src.left + (src.width - dst.width * k) / 2 - dst.left).toFixed(1)}px, ${(src.top + (src.height - dst.height * k) / 2 - dst.top).toFixed(1)}px) scale(${k.toFixed(4)})`;
  };
  async function morphPush(from, to, mo) {
    S.busy = true;
    stackEl.classList.add('busy');
    const card = $('.match', to.el);
    $('.res', to.el).classList.add('morphed');
    const dst = card.getBoundingClientRect();
    const g = ghostOf(card, dst);
    card.style.visibility = 'hidden';
    mo.el.style.visibility = 'hidden';
    to.morphSrc = mo.el;
    const anims = [
      g.animate([{ transform: flyFrom(mo.rect, dst), opacity: 0 }, { opacity: 1, offset: 0.2 }, { transform: 'none', opacity: 1 }], Object.assign({ fill: 'both' }, MORPH)),
      to.el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 340, delay: 90, easing: 'ease-out', fill: 'both' }),
    ];
    const t = setTimeout(() => afterShow(to, false), 180); // die Karten darunter steigen schon auf, während die Karte fliegt
    await settle(anims, MORPH.duration + 600);
    clearTimeout(t);
    card.style.visibility = '';
    g.remove();
    anims.forEach((x) => x.cancel());
    mo.el.style.visibility = '';
    from.el.classList.add('hide');
    S.busy = false;
    stackEl.classList.remove('busy');
    afterShow(to, false);
  }
  // zurück: nur wenn die Karte sichtbar ist und die angetippte Karte noch auf der Seite darunter liegt
  function canMorphBack(top, target) {
    const src = top.morphSrc;
    const card = $('.match', top.el);
    if (!src || !card || !src.isConnected || !target.el.contains(src)) return false;
    const r = card.getBoundingClientRect();
    const s = src.getBoundingClientRect();
    return r.bottom > 60 && r.top < innerHeight - 60 && s.width > 0 && s.bottom > 0 && s.top < innerHeight;
  }
  async function morphPop(top, target) {
    S.busy = true;
    stackEl.classList.add('busy');
    const card = $('.match', top.el);
    const src = top.morphSrc;
    const dst = card.getBoundingClientRect();
    const g = ghostOf(card, dst);
    card.style.visibility = 'hidden';
    src.style.visibility = 'hidden';
    const back = flyFrom(src.getBoundingClientRect(), dst);
    const anims = [
      g.animate([{ transform: 'none', opacity: 1 }, { opacity: 1, offset: 0.72 }, { transform: back, opacity: 0 }], { duration: 480, easing: MORPH.easing, fill: 'both' }),
      top.el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 260, easing: 'ease-out', fill: 'both' }),
    ];
    const t = setTimeout(() => { src.style.visibility = ''; }, 330); // die echte Karte blendet unter dem Abbild ein
    await settle(anims, 480 + 600);
    clearTimeout(t);
    src.style.visibility = '';
    top.el.remove();
    g.remove();
    S.busy = false;
    stackEl.classList.remove('busy');
  }
  async function popTo(idx) {
    const top = S.stack[S.stack.length - 1];
    const target = S.stack[idx];
    S.stack.slice(idx + 1, -1).forEach((p) => p.el.remove()); // Zwischenseiten (mehrere Ebenen zurück) direkt weg
    S.stack = S.stack.slice(0, idx + 1);
    target.el.classList.remove('hide');
    const sw = S.swipe;
    S.swipe = null;
    if (reduce) { top.el.remove(); if (sw) sw.shade.remove(); return; }
    if (!sw && canMorphBack(top, target)) { await morphPop(top, target); return; }
    S.busy = true;
    stackEl.classList.add('busy');
    const w = stackEl.clientWidth;
    const fromX = sw ? sw.dx : 0;
    const shade = sw ? sw.shade : makeShade();
    if (!sw) stackEl.insertBefore(shade, top.el);
    top.el.classList.add('edge');
    [top.el, target.el].forEach((e) => { e.style.transform = ''; });
    shade.style.opacity = '';
    const k = fromX / w;
    const opts = Object.assign({}, SLIDE, { duration: sw ? Math.max(180, 420 * (1 - k)) : 420 });
    const anims = [
      top.el.animate([{ transform: `translateX(${fromX}px)` }, { transform: 'translateX(100%)' }], opts),
      target.el.animate([{ transform: `translateX(${(-0.28 * w * (1 - k)).toFixed(1)}px)` }, { transform: 'translateX(0)' }], opts),
      shade.animate([{ opacity: shadeMax() * (1 - k) }, { opacity: 0 }], opts),
    ];
    await settle(anims, opts.duration + 600);
    top.el.remove();
    shade.remove();
    anims.forEach((a) => a.cancel());
    S.busy = false;
    stackEl.classList.remove('busy');
  }
  async function route() {
    if (S.busy) { S.pending = true; return; }
    const path = curPath();
    const top = S.stack[S.stack.length - 1];
    if (isTab(path) && S.stack[0] && S.stack[0].path !== path) switchTab(path);
    else if (!top || top.path !== path) {
      const idx = S.stack.findIndex((p) => p.path === path);
      if (idx >= 0) await popTo(idx); else await push(path);
    }
    if (S.pending) { S.pending = false; route(); }
  }
  const goBack = () => { if (S.stack.length > 1) history.back(); };
  const goHome = () => { const n = S.stack.length - 1; if (n > 0) history.go(-n); };
  window.addEventListener('hashchange', route);
  // Darstellung gewechselt (oder Wetten geändert): offene Seiten neu zeichnen, ohne Auftritt und ohne Scrollsprung; only = nur diese Pfade
  function redrawAll(only) {
    S.stack.forEach((p) => {
      if (p.path === '/scan' || (only && !only(p.path))) return;
      const y = p.el.scrollTop;
      p.el.classList.add('still');
      p.el.innerHTML = barHtml(p.path) + `<div class="wrap">${viewHtml(p.path)}</div>`;
      p.el._geo = null;
      const big = $('.big', p.el);
      if (big) big.classList.add('go');
      p.el.scrollTop = y;
      requestAnimationFrame(() => requestAnimationFrame(() => p.el.classList.remove('still')));
    });
  }

  // Vom linken Rand wischen = zurück (wie in iPhone-Apps)
  (() => {
    let d = null;
    const move = (e) => {
      if (!d) return;
      const t = e.touches[0];
      const dx = t.clientX - d.x0;
      const dy = t.clientY - d.y0;
      if (!d.on) {
        if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) { stop(); return; }
        if (dx < 8) return;
        d.on = true;
        d.prev.el.classList.remove('hide');
        d.top.el.classList.add('edge');
        d.shade = makeShade();
        stackEl.insertBefore(d.shade, d.top.el);
      }
      e.preventDefault();
      const w = stackEl.clientWidth;
      d.dx = Math.max(0, dx);
      d.t = performance.now();
      const k = d.dx / w;
      d.top.el.style.transform = `translateX(${d.dx}px)`;
      d.prev.el.style.transform = `translateX(${(-0.28 * w * (1 - k)).toFixed(1)}px)`;
      d.shade.style.opacity = String(shadeMax() * (1 - k));
    };
    const stop = () => { stackEl.removeEventListener('touchmove', move); d = null; };
    stackEl.addEventListener('touchstart', (e) => {
      if (S.busy || S.stack.length < 2 || e.touches.length > 1 || $('.sheet')) return;
      const t = e.touches[0];
      if (t.clientX > 24) return;
      d = { x0: t.clientX, y0: t.clientY, dx: 0, t0: performance.now(), on: false, top: S.stack[S.stack.length - 1], prev: S.stack[S.stack.length - 2] };
      stackEl.addEventListener('touchmove', move, { passive: false });
    }, { passive: true });
    const end = async () => {
      if (!d) return;
      const g = d;
      stop();
      if (!g.on) return;
      const w = stackEl.clientWidth;
      const speed = g.dx / Math.max(1, performance.now() - g.t0);
      if (g.dx > w * 0.35 || speed > 0.65) {
        S.swipe = { dx: g.dx, shade: g.shade };
        haptic();
        goBack();
        return;
      }
      // nicht weit genug: zurückschnappen
      S.busy = true;
      const k = g.dx / w;
      const opts = Object.assign({}, SLIDE, { duration: 300 });
      [g.top.el, g.prev.el].forEach((e) => { e.style.transform = ''; });
      g.shade.style.opacity = '';
      const anims = [
        g.top.el.animate([{ transform: `translateX(${g.dx}px)` }, { transform: 'translateX(0)' }], opts),
        g.prev.el.animate([{ transform: `translateX(${(-0.28 * w * (1 - k)).toFixed(1)}px)` }, { transform: 'translateX(-28%)' }], opts),
        g.shade.animate([{ opacity: shadeMax() * (1 - k) }, { opacity: shadeMax() }], opts),
      ];
      await settle(anims, opts.duration + 600);
      anims.forEach((a) => a.cancel());
      g.prev.el.classList.add('hide');
      g.top.el.classList.remove('edge');
      g.shade.remove();
      S.busy = false;
    };
    stackEl.addEventListener('touchend', end, { passive: true });
    stackEl.addEventListener('touchcancel', end, { passive: true });
  })();

  // Kurve im Geld-Tracker: Finger drauf → Fadenkreuz springt zum nächsten Punkt, oben stehen Wert und Datum
  (() => {
    let on = null;
    const move = (e) => {
      const c = CH.line;
      if (!on || !c) return;
      const r = on.getBoundingClientRect();
      const x = ((e.clientX - r.left) / r.width) * c.W;
      let i = 0;
      let best = Infinity;
      c.xs.forEach((v, k) => { const d = Math.abs(v - x); if (d < best) { best = d; i = k; } });
      if (i === c.i) return;
      c.i = i;
      const mh = on.closest('.mh');
      const xl = $('.x', on);
      xl.setAttribute('x1', c.xs[i].toFixed(1));
      xl.setAttribute('x2', c.xs[i].toFixed(1));
      const dot = $('.d', on);
      dot.setAttribute('cx', c.xs[i].toFixed(1));
      dot.setAttribute('cy', c.ys[i].toFixed(1));
      $('.mh-n', mh).textContent = c.fmtV(c.pts[i].v);
      $('.mh-d', mh).textContent = fmtWhen(c.pts[i].t);
    };
    document.addEventListener('pointerdown', (e) => {
      const w = e.target.closest && e.target.closest('.lc');
      if (!w || !CH.line) return;
      on = w;
      w.classList.add('scrub');
      CH.line.i = null;
      move(e);
    }, { passive: true });
    document.addEventListener('pointermove', move, { passive: true });
    const end = () => {
      if (!on) return;
      const c = CH.line;
      const w = on;
      on = null;
      w.classList.remove('scrub');
      if (!c) return;
      const n = c.xs.length - 1;
      const mh = w.closest('.mh');
      $('.x', w).setAttribute('x1', c.xs[n].toFixed(1));
      $('.x', w).setAttribute('x2', c.xs[n].toFixed(1));
      $('.d', w).setAttribute('cx', c.xs[n].toFixed(1));
      $('.d', w).setAttribute('cy', c.ys[n].toFixed(1));
      $('.mh-n', mh).textContent = c.def.big;
      $('.mh-d', mh).innerHTML = c.def.sub;
    };
    document.addEventListener('pointerup', end, { passive: true });
    document.addEventListener('pointercancel', end, { passive: true });
  })();

  // ------------------------------------------------------------------ Einstellungen (Blatt von unten, mit Federung)
  function openSettings() {
    if ($('.sheet')) return;
    const th = store.get('theme', 'light');
    const k = Math.max(0, ['light', 'dark', 'auto'].indexOf(th));
    const sh = document.createElement('div');
    sh.className = 'sheet';
    sh.innerHTML = `<div class="bg" data-act="close"></div><div class="panel" role="dialog" aria-label="Einstellungen"><div class="grip" data-grip></div>
      <h2>Einstellungen</h2><div class="lab">DEIN NAME</div>
      <input class="search name-in" type="text" placeholder="für die Begrüßung, z. B. Niklas" value="${esc(store.get('name', ''))}" data-act="name" maxlength="20" autocomplete="off" autocorrect="off" spellcheck="false" enterkeyhint="done">
      <div class="lab" style="margin-top:20px">DARSTELLUNG</div>
      <div class="seg s3" data-v="${th}" style="--k:${k}"><span class="ind"></span>${[['light', 'Hell'], ['dark', 'Dunkel'], ['auto', 'Automatisch']].map(([v, l]) => `<button class="${th === v ? 'on' : ''}" data-act="theme" data-val="${v}">${l}</button>`).join('')}</div>
      <div class="lab" style="margin-top:20px">EINLADUNGSCODE</div>
      <input class="search" type="text" placeholder="für die KI, z. B. den Wettschein-Scan" value="${esc(store.get('invite', ''))}" data-act="invite" maxlength="40" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" enterkeyhint="done">
      <p class="inv-st"></p>
      <p class="foot" style="margin-top:18px">Result AI</p></div>`;
    document.body.appendChild(sh);
    checkInvite(sh);
  }
  // Einladungscode beim Server prüfen (schützt das Gratis-Kontingent der KI vor Fremden)
  let invT = 0;
  function checkInvite(sh) {
    const el = $('.inv-st', sh);
    if (!el) return;
    const code = String(store.get('invite', '') || '').trim();
    const set = (txt, cls) => { el.textContent = txt; el.className = 'inv-st' + (cls ? ' ' + cls : ''); };
    if (!code) { set('Den Code bekommst du von Niklas. Ohne Code geht alles außer dem Wettschein-Scan.'); return; }
    if (!API) { set('Der KI-Server ist noch nicht verbunden – der Code wird geprüft, sobald er läuft.'); return; }
    set('Wird geprüft …');
    fetch(API + '/check', { headers: { 'X-Invite': code } })
      .then((r) => { if (String(store.get('invite', '')).trim() === code) set(r.ok ? '✓ Code passt – der Wettschein-Scan ist frei.' : '✗ Dieser Code passt nicht.', r.ok ? 'ok' : 'bad'); })
      .catch(() => set('Der Server ist gerade nicht erreichbar.'));
  }
  function closeSheet() {
    const sh = $('.sheet');
    if (!sh || sh.classList.contains('out')) return;
    sh.classList.add('out');
    setTimeout(() => sh.remove(), reduce ? 0 : 290);
  }
  // Blatt am Griff nach unten ziehen zum Schließen
  (() => {
    let d = null;
    document.addEventListener('pointerdown', (e) => {
      const g = e.target.closest && e.target.closest('[data-grip]');
      if (!g) return;
      const panel = g.closest('.panel');
      d = { panel, y0: e.clientY, dy: 0, t0: performance.now() };
      panel.classList.add('drag');
      try { g.setPointerCapture(e.pointerId); } catch (err) { /* ältere Browser */ }
    });
    document.addEventListener('pointermove', (e) => {
      if (!d) return;
      d.dy = Math.max(0, e.clientY - d.y0);
      d.panel.style.transform = `translateY(${d.dy}px)`;
    });
    const end = () => {
      if (!d) return;
      const { panel, dy, t0 } = d;
      d = null;
      if (dy > 110 || (dy > 40 && performance.now() - t0 < 260)) { closeSheet(); return; }
      panel.style.transition = 'transform .35s cubic-bezier(.34,1.36,.64,1)';
      panel.style.transform = '';
      setTimeout(() => { panel.style.transition = ''; panel.classList.remove('drag'); }, 360);
    };
    document.addEventListener('pointerup', end);
    document.addEventListener('pointercancel', end);
  })();

  // ------------------------------------------------------------------ Ereignisse
  document.addEventListener('click', (e) => {
    if (hapEl.contains(e.target)) return;
    if (e.target.tagName !== 'INPUT' && e.target.closest('a[href], button, .sbtn')) haptic();
    const a = e.target.closest('[data-act]');
    if (!a) return;
    const act = a.dataset.act;
    if (act === 'back') goBack();
    else if (act === 'home') goHome();
    else if (act === 'settings') openSettings();
    else if (act === 'close') closeSheet();
    else if (act === 'slot') openSearch(a.dataset.side);
    else if (act === 'choose') { P[a.dataset.side] = a.dataset.id; P.msg = ''; rememberTeam(a.dataset.id); closeSheet(); redrawTop(); }
    else if (act === 'step') {
      const k = a.dataset.k;
      const i = +a.dataset.i;
      P[k][i] = Math.max(0, Math.min(k === 'reds' ? 3 : 15, P[k][i] + +a.dataset.d));
      redrawTop();
    }
    else if (act === 'calc') calcPick();
    else if (act === 'lgopen' || act === 'lgback') {
      const sh = a.closest('.sheet');
      if (act === 'lgopen') sh.dataset.lg = a.dataset.lg; else delete sh.dataset.lg;
      renderResults(sh, '');
      $('.results', sh).scrollTop = 0;
    }
    else if (act === 'slipsave') saveSlip();
    else if (act === 'invgo') inviteGo();
    else if (act === 'savetip' || act === 'savekombi') {
      e.preventDefault(); // Knopf liegt in der Tipp-Karte (ein Link) – nicht ins Spiel springen
      if (act === 'savetip') saveTip(a.dataset.list, a.dataset.g, a.dataset.m); else saveKombi(+a.dataset.i);
    }
    else if (act === 'newbet') openBetSheet({ src: 'manual', legs: [] });
    else if (act === 'betsave') saveDraft();
    else if (act === 'bchip') { const inp = $('[data-act="bstake"]', a.closest('.panel')); if (inp) { inp.value = nf2.format(+a.dataset.val); updateWin(); } }
    else if (act === 'bstatus') { if (B.draft) B.draft.status = a.dataset.val; $$('[data-act="bstatus"]', a.closest('.panel')).forEach((x) => x.classList.toggle('on', x === a)); }
    else if (act === 'btab') { B.tab = a.dataset.val; redrawTop(); }
    else if (act === 'mperiod') { B.period = a.dataset.val; B.more = false; redrawTop(); }
    else if (act === 'mmode') { B.mode = a.dataset.val; redrawTop(); }
    else if (act === 'bsplit') { B.split = a.dataset.val; const c = a.closest('.card'); $$('.pseg button', c).forEach((x) => x.classList.toggle('on', x === a)); $('.srs', c).innerHTML = splitRows(settledBets().filter((b) => b.status !== 'void' && b.done >= periodFrom())); }
    else if (act === 'lgmore') { B.more = !B.more; redrawTop(); }
    else if (act === 'barpick') {
      const c = a.closest('.card');
      const i = +a.dataset.i;
      $$('.bm', c).forEach((g, k) => g.classList.toggle('dim', k !== i));
      if (CH.bars) $('.bc-read', c).textContent = bucketRead(CH.bars.bk[i], CH.bars.unit);
    }
    else if (act === 'settle') settleManual(a.dataset.id, a.dataset.val);
    else if (act === 'delbet') {
      // zweimal tippen: erst „Wirklich löschen?“, dann weg
      if (!a.classList.contains('arm')) { a.classList.add('arm'); a.textContent = 'Wirklich löschen?'; setTimeout(() => { if (a.isConnected) { a.classList.remove('arm'); a.textContent = 'Löschen'; } }, 3000); }
      else deleteBet(a.dataset.id);
    }
    else if (act === 'wallet') openWalletSheet();
    else if (act === 'wreset') walletResetAsk();
    else if (act === 'wresetgo') walletReset();
    else if (act === 'wsave') saveWallet(a.dataset.mode);
    else if (act === 'kick') kickNow();
    else if (act === 'ki') location.hash = '#/ki';
    else if (act === 'kirun') { A.open[a.dataset.k] = !A.open[a.dataset.k]; redrawTop(); }
    else if (act === 'sec') {
      const pg = a.closest('.page');
      const sec = pg && $$(`[data-sec="${a.dataset.sec}"]`, pg).find((x) => !x.closest('.snav'));
      if (sec) {
        if (!pg._geo) pg._geo = pageGeo(pg);
        const t = pg._geo.secs.find(([k]) => k === a.dataset.sec);
        pg.scrollTo({ top: Math.max(0, (t ? t[1] : 0) - pg._geo.off + 2), behavior: reduce ? 'auto' : 'smooth' });
      }
    }
    else if (act === 'tab') {
      const to = a.dataset.tab;
      if (S.stack[0] && S.stack[0].path === to) {
        if (S.stack.length > 1) goHome(); // nochmal tippen: zurück zur Startseite des Bereichs
        else S.stack[0].el.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
      } else location.replace('#' + to);
    }
    else if (act === 'tlist' || act === 'tday') {
      if (act === 'tlist') {
        const seg = a.closest('.seg');
        seg.style.setProperty('--k', $$('button', seg).indexOf(a));
        $$('button', seg).forEach((b) => b.classList.toggle('on', b === a));
        T.list = a.dataset.val;
        T.day = 'all';
      } else T.day = a.dataset.val;
      const body = $('.tips-body', a.closest('.page'));
      if (body) body.innerHTML = tipsBody();
    }
    else if (act === 'swap') { [P.home, P.away] = [P.away, P.home]; P.score.reverse(); P.reds.reverse(); P.msg = ''; redrawTop(); }
    else if (act === 'theme') {
      const seg = a.closest('.seg');
      if (seg.dataset.v === a.dataset.val) return;
      const wasDark = isDark();
      applyTheme(a.dataset.val);
      seg.dataset.v = a.dataset.val;
      seg.style.setProperty('--k', $$('button', seg).indexOf(a));
      $$('button', seg).forEach((b) => b.classList.toggle('on', b === a));
      if (isDark() !== wasDark) redrawAll();
    }
  });
  document.addEventListener('change', (e) => {
    const t = e.target;
    if (t.dataset && t.dataset.act === 'opt') { P[t.dataset.k] = t.checked; P.msg = ''; redrawTop(); return; }
    if (t.dataset && t.dataset.act === 'minute') { P.minute = +t.value; redrawTop(); return; }
    if (t.dataset && t.dataset.act === 'scanbet') { const f = t.files && t.files[0]; t.value = ''; if (f) startScan(f); return; }
  });

  document.addEventListener('input', (e) => {
    const t = e.target;
    if (!t.dataset) return;
    if (t.dataset.act === 'search') renderResults(t.closest('.sheet'), t.value);
    else if (t.dataset.act === 'name') { store.set('name', t.value.trim()); $$('.hello h1').forEach((x) => { x.textContent = greet(); }); }
    else if (t.dataset.act === 'minute') { const b = $('.li-min', t.closest('.live-in')); if (b) b.textContent = t.value + "'"; }
    else if (t.dataset.act === 'bq' || t.dataset.act === 'bstake') updateWin();
    else if (t.dataset.act === 'invite') {
      store.set('invite', t.value.trim());
      clearTimeout(invT);
      const sh = t.closest('.sheet');
      invT = setTimeout(() => checkInvite(sh), 700);
    }
  });

  // Antippen: kurz abdunkeln statt zusammenziehen (iPhone-Regel aus der BVB-App); erst nach kurzem Halten, beim Scrollen gar nicht
  (() => {
    const PRESS = '.tsave, .gsave, .bact, .bc-acts button, .bc-del, a.group, a.row, a.card, .btn, .round, .sbtn, .seg button, .slot, .res-row, .stepper button, .swap, a.tcard, .tabbar button, .chips button, a.k-leg, .snav button, .kib, .kl-row, a.spot, a.tmc, a.bil, .pseg button, .mseg button, .more, .lg-back';
    let el = null;
    let t = 0;
    const off = () => { clearTimeout(t); if (el) el.classList.remove('pressed'); el = null; };
    document.addEventListener('pointerdown', (e) => {
      off();
      const hit = e.button > 0 || !e.target.closest ? null : e.target.closest(PRESS);
      if (!hit) return;
      el = hit;
      t = setTimeout(() => hit.classList.add('pressed'), 90);
    }, { passive: true });
    document.addEventListener('pointerup', () => {
      if (!el) return;
      clearTimeout(t);
      const hit = el;
      hit.classList.add('pressed');
      t = setTimeout(() => { hit.classList.remove('pressed'); if (el === hit) el = null; }, 110);
    }, { passive: true });
    document.addEventListener('pointercancel', off, { passive: true });
    document.addEventListener('scroll', () => { if (el) off(); }, { passive: true, capture: true });
  })();

  // App-Updates: Service Worker; bei neuer Version einmal neu laden, damit das Update gleich beim ersten Öffnen ankommt
  if ('serviceWorker' in navigator && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
    const had = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (had && !S.swReload) { S.swReload = true; location.reload(); } });
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }

  setTimeout(() => loadRatings().catch(() => {}), 1200);
  // gespeicherte Top-Tipp-Wetten: gleich nach dem Start prüfen, solange ein Spiel läuft jede Minute
  setTimeout(() => checkBets(), 1500);
  setInterval(() => { if (!document.hidden && liveBets()) checkBets(); }, 60e3);

  // ------------------------------------------------------------------ Start: Startseite unten im Stapel; Direktlink obendrauf
  applyTheme(store.get('theme', 'light'));
  const start = curPath();
  const home = makePage(isTab(start) ? start : '/');
  stackEl.appendChild(home.el);
  S.stack.push(home);
  syncTabs();
  if (!isTab(start)) {
    // damit „Zurück“ auch nach einem Direktlink zur Startseite führt
    history.replaceState(null, '', '#/');
    history.pushState(null, '', '#' + start);
    home.el.classList.add('hide');
    const p = makePage(start);
    stackEl.appendChild(p.el);
    S.stack.push(p);
    afterShow(p, true);
  } else {
    afterShow(home, true);
  }
  // Ladebildschirm: blendet weich aus, sobald die Startseite steht und die Tipps da sind (höchstens 2,2 Sekunden warten)
  (() => {
    const sp = $('#splash');
    if (!sp) return;
    const t0 = performance.now();
    Promise.race([loadTips().catch(() => {}), new Promise((r) => setTimeout(r, 2200))]).then(() => {
      setTimeout(() => { sp.classList.add('out'); setTimeout(() => sp.remove(), reduce ? 0 : 400); }, reduce ? 0 : Math.max(60, 700 - (performance.now() - t0)));
    });
  })();
  // zurück aus dem Hintergrund: neueste Tipp-Suche holen (läuft jede Stunde)
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) return;
    checkBets(); // nach dem Abpfiff sofort auswerten, sobald die App wieder offen ist
    const root = S.stack[0];
    if (root && S.stack.length === 1 && (root.path === '/' || root.path === '/tips')) freshTips(root, 5 * 60e3);
  });
})();
