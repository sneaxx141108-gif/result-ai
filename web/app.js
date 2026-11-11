/* Wettbuch – App. Reine Tracking-App für Sportwetten (Niklas, 11.11.2026: „reine Tracking-App für Tipico mit Scan-Funktion,
   keine Prozente mehr“). Hash-Routen: #/ Start, #/bets Wetten, #/scan Scannen (#/scan/run Scan läuft, #/scan/res/<id> erkannte
   Wettscheine), #/stats Statistik, #/money Kasse, #/ki KI-Zentrale. Gerechnet wird nur mit Euro und Anzahlen – keine Prozente,
   keine Prognosen. Die Wettscheine liest eine KI (Gemini auf dem Cloudflare-Server worker/worker.js, Adresse in API). Zugeordnet und
   abgerechnet wird hier, ohne KI: Spielplan aus data/games.json (scripts/games.py, alle 2 Stunden), Endstände direkt von ESPN.
   Unbekanntes heißt „k. A.“. Seiten liegen wie in einer iPhone-App übereinander: neue Seiten schieben sich von rechts herein,
   zurück geht es per Knopf oder Wischen vom linken Rand. Animiert wird nur transform/opacity (iPhone-12-Regeln). */

(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const store = {
    get(k, d) { try { const v = localStorage.getItem('ra_' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) {
      try {
        const json = JSON.stringify(v);
        const old = localStorage.getItem('ra_' + k);
        if (old === json) return;
        localStorage.setItem('ra_' + k, json);
        if (store.onSet) store.onSet(k, old, v); // Konto-Abgleich: Änderung vermerken (siehe „Konto“)
      } catch (e) { /* privater Modus */ }
    },
    onSet: null,
  };
  // Cloudflare-Server (worker/worker.js): liest Wettscheine mit Gemini, hält die Konten und stößt den Spielplan an – leer = noch nicht eingerichtet
  const API = 'https://result-ai.sneaxx141108.workers.dev';
  // nur beim Testen auf dem PC (localhost): eigener Test-Server statt Cloudflare (ra_api)
  const api = () => (/^(localhost|127\.0\.0\.1)$/.test(location.hostname) && store.get('api', '')) || API;
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
    cal: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
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
    scanF: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2"/><path d="M7 12h10"/></svg>',
    paste: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5.5" y="4" width="13" height="17" rx="2.5"/><path d="M9 4.5v-1a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1"/><path d="M9.5 11h5M9.5 15h5"/></svg>',
    layers: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l9 5-9 5-9-5 9-5z"/><path d="M3 13l9 5 9-5"/></svg>',
    user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8.5" r="4"/><path d="M4.5 20.5c1.2-3.8 4.2-5.6 7.5-5.6s6.3 1.8 7.5 5.6"/></svg>',
    eye: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>',
    eyeOff: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3l18 18"/><path d="M10.6 5.1c.5-.1.9-.1 1.4-.1 6.4 0 10 7 10 7a17.6 17.6 0 0 1-3.2 4.1M6.6 6.6C3.8 8.4 2 12 2 12s3.6 7 10 7c1.6 0 3-.4 4.3-1"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>',
    pulse: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12h4l2.5-6 5 12 2.5-6h4"/></svg>',
    pen: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4L19.2 8.8a2.8 2.8 0 0 0-4-4L4 16z"/><path d="M13.5 6.5l4 4"/></svg>',
  };

  Object.assign(I, {
    wallet: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 7.5V6a1.5 1.5 0 0 0-1.5-1.5h-11A2.5 2.5 0 0 0 4 7v10.5A2.5 2.5 0 0 0 6.5 20h12a1.5 1.5 0 0 0 1.5-1.5V10a1 1 0 0 0-1-1H6.4A2.4 2.4 0 0 1 4 7"/><circle cx="16" cy="14.5" r="1.3" fill="currentColor" stroke="none"/></svg>',
    walletF: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M6.6 3.6h10.9a2 2 0 0 1 2 2V7.3H6.5a1.15 1.15 0 0 0 0 2.3h13a1.5 1.5 0 0 1 1.5 1.5v7.4a2 2 0 0 1-2 2H6.6a3.1 3.1 0 0 1-3.1-3.1V6.7a3.1 3.1 0 0 1 3.1-3.1z"/><circle cx="16.3" cy="15" r="1.55" fill="var(--card)"/></svg>',
    chartF: '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="11" width="4.8" height="9.5" rx="1.7"/><rect x="9.6" y="3.5" width="4.8" height="17" rx="1.7"/><rect x="16.2" y="7.5" width="4.8" height="13" rx="1.7"/></svg>',
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
    cash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="6" width="19" height="12" rx="2.5"/><circle cx="12" cy="12" r="2.6"/><path d="M6 9.5v5M18 9.5v5"/></svg>',
    shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l7.5 3v5.5c0 4.6-3.2 8.2-7.5 9.5-4.3-1.3-7.5-4.9-7.5-9.5V6z"/><path d="M8.8 12.2l2.2 2.2 4.2-4.6"/></svg>',
    link: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/></svg>',
    trophy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 4h8v5a4 4 0 0 1-8 0z"/><path d="M8 6H5v1.5A3.5 3.5 0 0 0 8.5 11M16 6h3v1.5A3.5 3.5 0 0 1 15.5 11"/><path d="M12 13v4M8.5 20h7M10 17h4"/></svg>',
    download: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v11M7.5 10.5L12 15l4.5-4.5"/><path d="M5 19h14"/></svg>',
    receipt: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3.5h12a1 1 0 0 1 1 1v16l-2.3-1.5-2.4 1.5-2.3-1.5-2.3 1.5-2.4-1.5L5 20.5v-16a1 1 0 0 1 1-1z"/><path d="M8.5 8.5h7M8.5 12h7M8.5 15.5h4"/></svg>',
    x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    dl: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4.5v10M7.5 10l4.5 4.5 4.5-4.5"/><path d="M5 19.5h14"/></svg>',
    ul: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 14.5v-10M7.5 9L12 4.5 16.5 9"/><path d="M5 19.5h14"/></svg>',
    chev: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9.5 5.5l6.5 6.5-6.5 6.5"/></svg>',
  });
  // Wettbuch-Zeichen: ein Wettschein mit Haken (auch App-Symbol und Startbild, siehe scripts/icons.py)
  const SLIP_D = 'M10 3.5h16a3 3 0 0 1 3 3V32l-1.83-2-1.84 2-1.83-2-1.83 2-1.84-2L18 32l-1.83-2-1.84 2-1.83-2-1.83 2-1.84-2L7 32V6.5a3 3 0 0 1 3-3z';
  const logo = (cls = '') => `<svg class="${cls}" viewBox="0 0 36 36" aria-hidden="true"><path d="${SLIP_D}" fill="var(--text)"/><path d="M11.5 10.5h13M11.5 15.5h9" stroke="var(--lbg, var(--bg))" stroke-width="2.6" stroke-linecap="round" fill="none"/><circle cx="26.5" cy="26.5" r="8" fill="var(--posf)" stroke="var(--lbg, var(--bg))" stroke-width="2.5"/><path d="M22.9 26.7l2.5 2.5 4.6-4.9" stroke="var(--on-pos)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>`;

  // ------------------------------------------------------------------ Darstellung: hell (Standard) oder dunkel
  const isDark = () => document.documentElement.dataset.theme === 'dark';
  const mqDark = matchMedia('(prefers-color-scheme: dark)');
  /* Handy oder iPad (Niklas, 09.11.2026): in den Einstellungen umstellbar. Das breite Layout steht am Ende von app.css und greift erst
     ab 700 px Breite, auf einem Handy bleibt also alles benutzbar. Beim ersten Start wird das Gerät an der Bildschirmgröße erkannt. */
  const ipadWide = () => document.documentElement.dataset.device === 'ipad' && innerWidth >= 700;
  // iPad quer: Leiste links, Seiten in Spalten (muss zur Bedingung am Ende von app.css passen)
  const ipadSide = () => ipadWide() && innerWidth >= 960 && innerWidth > innerHeight;
  const deviceGuess = () => (Math.min(screen.width || 0, screen.height || 0) >= 700 ? 'ipad' : 'phone');
  function applyDevice(v) {
    document.documentElement.dataset.device = v;
    store.set('device', v);
  }
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

  const logoUrl = (id, dark, px) => `https://a.espncdn.com/combiner/i?img=/i/teamlogos/soccer/${dark ? '500-dark' : '500'}/${id}.png&w=${px}&h=${px}`;
  // Teams aus dem Spielplan und von gespeicherten Wetten: Name -> Wappen-Adresse und Farbe
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

  // ------------------------------------------------------------------ Seiten
  const S = { stack: [], busy: false, pending: false, swipe: null, tabScroll: {} };
  // Leiste unten: fünf Bereiche mit eigener Startseite (wie die Tab-Leiste einer iPhone-App)
  const TABS = [['/', 'Start', 'home'], ['/bets', 'Wetten', 'ticket'], ['/scan', 'Scannen', 'scan'], ['/stats', 'Statistik', 'chart'], ['/money', 'Kasse', 'wallet']];
  const isTab = (p) => TABS.some((t) => t[0] === p);
  const TITLES = { '/': '', '/bets': 'Wetten', '/scan': 'Scannen', '/scan/run': 'Scan', '/stats': 'Statistik', '/money': 'Kasse', '/ki': 'KI-Zentrale' };
  const titleOf = (path) => (path in TITLES ? TITLES[path] : 'Scan');
  function barHtml(path) {
    const lead = path === '/' ? `<span class="brand">${logo()}<span>Wettbuch</span></span>`
      : isTab(path) ? '' : `<button class="round" data-act="back" aria-label="Zurück">${I.back}</button>`;
    return `<header class="bar${isTab(path) ? ' tabtop' : ''}">${lead}<span class="tt">${esc(titleOf(path))}</span>
      <span class="end">${path === '/' ? `<button class="kib" data-act="ki" aria-label="KI-Zentrale">${kiBadge()}</button>${accBtn()}` : ''}<button class="round" data-act="settings" aria-label="Einstellungen">${I.gear}</button></span></header>`;
  }
  function viewHtml(path) {
    if (path === '/bets') return vBets();
    if (path === '/scan') return vScan();
    if (path === '/scan/run') return vScanRun();
    if (path.startsWith('/scan/res/')) return vScanRes(decodeURIComponent(path.slice(10)));
    if (path === '/stats') return vStats();
    if (path === '/money') return vMoney();
    if (path === '/ki') return vKI();
    return vHome();
  }
  const RG_TEXT = 'Keine Garantie. Wetten erst ab 18 · Glücksspiel kann süchtig machen – Hilfe bei check-dein-spiel.de oder kostenlos unter 0800 1 37 27 00 (BZgA).';
  // Knöpfe für den Scan: Fotos, Kamera und (wo der Browser es kann) Einfügen aus der Zwischenablage
  const canPaste = () => !!(navigator.clipboard && navigator.clipboard.read);
  const scanBtns = (paste) => `<div class="acts${paste && canPaste() ? ' a3' : ''}"><label class="sbtn">${I.photo}<span>Fotos</span><input type="file" accept="image/*" data-act="scanpic" aria-label="Screenshot aus den Fotos wählen"></label>
    <label class="sbtn alt">${I.cam}<span>Kamera</span><input type="file" accept="image/*" capture="environment" data-act="scanpic" aria-label="Wettschein fotografieren"></label>${paste && canPaste() ? `<button class="sbtn alt" data-act="scanpaste">${I.paste}<span>Einfügen</span></button>` : ''}</div>`;
  // Bild auf der Scan-Karte: Wettschein im Scan-Rahmen, die grüne Linie liest gerade (ruht, keine Dauer-Animation)
  const SCAN_ART = '<svg class="sc-art" viewBox="0 0 120 120" aria-hidden="true"><path class="sa-c" d="M16 38V26a10 10 0 0 1 10-10h12M82 16h12a10 10 0 0 1 10 10v12M104 82v12a10 10 0 0 1-10 10H82M38 104H26a10 10 0 0 1-10-10V82"/>'
    + '<path class="sa-s" d="M42 28h36a5 5 0 0 1 5 5v59l-4.6-3.5-4.6 3.5-4.6-3.5-4.6 3.5-4.6-3.5-4.6 3.5-4.6-3.5-4.6 3.5-4.6-3.5-4.6 3.5V33a5 5 0 0 1 5-5z"/>'
    + '<path class="sa-l" d="M46 41h22M46 50h28M46 59h16"/><rect class="sa-q" x="46" y="68" width="28" height="9" rx="4.5"/><path class="sa-g" d="M24 60h72"/><path class="sa-b" d="M24 60h72"/></svg>';
  const newId = (p) => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const round2 = (v) => Math.round(v * 100) / 100;

  // ------------------------------------------------------------------ Zeit
  const dayStart = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const dayDiff = (iso) => Math.round((dayStart(new Date(iso)) - dayStart(new Date())) / 864e5);
  function kickoff(iso) {
    const d = new Date(iso);
    const hm2 = d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
    const k = dayDiff(iso);
    const wd = ['So.', 'Mo.', 'Di.', 'Mi.', 'Do.', 'Fr.', 'Sa.'][d.getDay()];
    if (k === 0) return `Heute, ${hm2}`;
    if (k === 1) return `Morgen, ${hm2}`;
    if (k === -1) return `Gestern, ${hm2}`;
    return k > 6 || k < -1 ? `${wd}, ${d.getDate()}.${d.getMonth() + 1}., ${hm2}` : `${wd}, ${hm2}`;
  }
  function ago(iso) {
    const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60e3));
    if (m < 1) return 'gerade eben';
    if (m < 60) return `vor ${m} Min.`;
    const h = Math.floor(m / 60);
    if (h < 24) return `vor ${h} Std.`;
    return agoText(new Date(iso).getTime());
  }
  const hm = (iso) => new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  function greet() {
    const h = new Date().getHours();
    const g = h < 5 ? 'Gute Nacht' : h < 11 ? 'Guten Morgen' : h < 18 ? 'Hallo' : h < 23 ? 'Guten Abend' : 'Gute Nacht';
    const name = String(store.get('name', '') || '').trim();
    return name ? `${g}, ${name}` : g;
  }
  const todayLong = () => new Date().toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });

  // ------------------------------------------------------------------ Spielplan (data/games.json, scripts/games.py alle 2 Stunden)
  // Damit ordnet die App die Tipps eines Wettscheins echten Spielen zu – nur dann kann sie nach dem Abpfiff selbst abrechnen.
  // Zeile eines Spiels: [ESPN-ID, Liga, Anstoß, Heim-ID, Gast-ID, Stand (0 vorher · 1 läuft · 2 vorbei · 3 abgesagt), Tore Heim, Tore Gast nach 90 Min.]
  const G = { data: null, at: 0, err: false, loading: null, teams: {}, byGid: {} };

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

  // Anzeigename: deutsch, sonst der kurze Name – außer ESPN-Kürzeln wie „D Dresden“, „C Palace“ oder „Nottm Forest“
  const baseName = (t) => DE[t.name] || (t.short && !/^[A-Z] |Nottm/.test(t.short) ? t.short : t.name);
  const tName = (t) => t._d || baseName(t);
  const reg = (t) => { const n = tName(t); if (!REG[n] || !REG[n].logo) REG[n] = { logo: t.logo || null, color: t.color || null }; return n; };
  const teamName = (id) => (G.teams[id] ? reg(G.teams[id]) : 'k. A.');
  const lgName = (slug) => (G.data && G.data.leagues && G.data.leagues[slug] ? G.data.leagues[slug][0] : null);
  function prepGames(d) {
    const teams = {};
    Object.keys(d.teams || {}).forEach((id) => {
      const [name, short, abbr, logo, color, slug, en] = d.teams[id] || [];
      if (name) teams[id] = { id, name, short, abbr, logo, color, slug, en, n: 0 };
    });
    const list = Object.values(teams);
    list.forEach((t) => { t._k = [DE[t.name], t.name, t.short, t.abbr, t.en].filter(Boolean).map(norm); });
    // eindeutige Anzeigenamen: Kurzname → bei Doppelung voller Name → sonst mit Land („Santos (Brasilien)“)
    const count = (f) => list.reduce((c, t) => { const k = f(t); c[k] = (c[k] || 0) + 1; return c; }, {});
    const c1 = count(baseName);
    const lvl2 = (t) => (c1[baseName(t)] > 1 && !DE[t.name] ? t.name : baseName(t));
    const c2 = count(lvl2);
    const lg = d.leagues || {};
    list.forEach((t) => { t._d = c2[lvl2(t)] > 1 ? `${lvl2(t)} (${lg[t.slug] ? lg[t.slug][1] : 'k. A.'})` : lvl2(t); });
    const byGid = {};
    (d.games || []).forEach((r) => {
      byGid[r[0]] = r;
      [r[3], r[4]].forEach((id) => { if (teams[id]) teams[id].n++; });
    });
    Object.assign(G, { data: d, teams, byGid, rank: Object.keys(lg) });
  }
  function loadGames(maxAge) {
    if (G.data && Date.now() - G.at < (maxAge == null ? 10 * 60e3 : maxAge)) return Promise.resolve(G.data);
    if (!G.loading) {
      G.loading = fetch('data/games.json', { cache: 'no-cache' })
        .then((r) => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
        .then((d) => { prepGames(d); G.at = Date.now(); G.err = false; return d; })
        .catch((e) => { G.err = true; throw e; })
        .finally(() => { G.loading = null; });
    }
    return G.loading;
  }
  // wie frisch ist der Spielplan? ok (unter 3 Std.) · warn (unter 8 Std.) · bad – ehrlich statt immer grün
  const freshness = (iso) => { const h = (Date.now() - new Date(iso).getTime()) / 36e5; return h < 3 ? 'ok' : h < 8 ? 'warn' : 'bad'; };
  // Suche: exakter Name > Anfang > alle Wörter enthalten; bei Gleichstand das Team mit mehr Spielen im Plan
  function searchTeams(q, n) {
    const raw = norm(q);
    if (!raw || !G.data) return [];
    const nick = NICK[raw];
    const pinned = nick && G.teams[nick] ? G.teams[nick] : null; // Spitzname mit fester Team-ID (z. B. „BVB“) steht ganz oben
    const k = nick && !pinned ? nick : raw;
    const words = k.split(' ');
    const hits = [];
    Object.values(G.teams).forEach((t) => {
      if (t === pinned) return;
      let best = 0;
      for (const a of t._k) {
        if (a === k) best = Math.max(best, 100);
        else if (a.startsWith(k)) best = Math.max(best, 80);
        else if (words.every((w) => a.split(' ').some((x) => x.startsWith(w)))) best = Math.max(best, 60);
        else if (k.length > 3 && a.includes(k)) best = Math.max(best, 40);
      }
      if (best) hits.push([best + Math.min(9, t.n * 3), t]);
    });
    const list = hits.sort((x, y) => (y[0] - x[0]) || (x[1].name < y[1].name ? -1 : 1)).map((x) => x[1]);
    return (pinned ? [pinned].concat(list) : list).slice(0, n);
  }
  // Teamname vom Wettschein → Team im Spielplan („FC Bayern München“, „Bor. Dortmund“, „1. FC Köln“ …)
  // Lieber gar keins als das falsche: ein einzelnes Wort zählt nur, wenn es eindeutig ist und nicht bloß ein Vereins-Vorname („Hapoel“, „Real“ …).
  const TEAM_FILLER = new Set('hapoel maccabi beitar ironi bnei real sporting sportiva dynamo dinamo inter internacional athletic atletico deportivo racing union united city town rovers wanderers albion county olympique olympic borussia eintracht fortuna rapid slavia spartak lokomotiv torpedo stade royal young'.split(' '));
  function resolveTeam(name) {
    if (!G.data || !name) return null;
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
  // passendes Spiel im Plan: Anstoß darf 36 Stunden abweichen; steht keiner auf dem Schein, das Spiel, das am nächsten an jetzt liegt
  function findGame(H, A, home, away, when) {
    const rows = (G.data && G.data.games) || [];
    const same = (t, id, raw) => (t && t.id === id) || !!(G.teams[id] && raw && G.teams[id]._k.includes(norm(raw)));
    const w = when ? new Date(when).getTime() : Date.now();
    let best = null;
    let bd = Infinity;
    rows.forEach((r) => {
      if (!same(H, r[3], home) || !same(A, r[4], away)) return;
      const d = Math.abs(new Date(r[2]).getTime() - w);
      if (when && d > 36 * 36e5) return;
      if (d < bd) { bd = d; best = r; }
    });
    return best;
  }
  // Wie gut passt ein Team zum Text der Wette? 3 = voller Name, 2 = ganzes Wort, 1 = Wortanfang, 0 = gar nicht
  function sideScore(text, name) {
    if (!name) return 0;
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
  /* Text eines Tipps → Wett-Code, den Wettbuch nach dem Abpfiff selbst nachrechnen kann. Was nicht sicher erkannt ist, gibt null –
     dann rechnest du selbst ab (lieber gar nicht als falsch). Codes: H/D/A Endergebnis · HD/DA/HA Doppelte Chance · O25/U25 Tore über/unter ·
     HO15/AU05 … Tore eines Teams · BY/BN beide treffen · HS/AS Team trifft · HN/AN Remis = Geld zurück · H1/D1/A1 Halbzeit · CS2:1 genaues Ergebnis */
  const NO_CODE = /ecke|corner|karte|cards?|handicap|torschutz|scorer|spieler(?!gebnis)|player|minute|zeitpunkt|zeitraum|elfmeter|penalt|qualifi|weiterkomm|sieger|meister|aufsteig|absteig|verlangerung|2 halbzeit|zweite halbzeit|2 hz|second half|halbzeit endstand|halbzeit endergebnis|halbzeit endresultat|pause endstand|ht ft|htft|schiedsrichter|abseits|einwurf|vorlage|assist|freisto|zu null|clean sheet|gerade|anzahl(?! tore (?:uber|unter|over|under))|torreich|erste tor|erstes tor|letzte tor|letztes tor|nachste tor|naechste tor|beide halbzeiten|in beiden|tordifferenz|gewinnt mit|sieg mit|marge|spanne|vor der pause|bis zur|zwischen/;
  function pickCode(x, home, away) {
    const mkRaw = String(x.mk || x.market || '');
    const pkRaw = String(x.pick || '');
    // Kombi-Märkte („1 & Über 2,5“, „Sieg und beide treffen“) rechnet Wettbuch nicht – Teamnamen vorher raus (z. B. „Brighton & Hove“)
    let combo = `${mkRaw} ${pkRaw}`;
    [home, away].forEach((n) => { if (n) combo = combo.split(n).join(' '); });
    if (/&|\bund\b|\bplus\b|\+/i.test(combo)) return null;
    const mk = norm(mkRaw).replace(/\b90 min(uten)?\b|\bregulare spielzeit\b|\bnach 90\b/g, ' ').replace(/\s+/g, ' ').trim();
    const pk = norm(pkRaw);
    const all = `${mk} ${pk}`;
    // Teamnamen raus, bevor nach Markt-Wörtern gesucht wird („Cardiff“ ist keine Karte)
    let bare = ` ${all} `;
    [home, away].forEach((n) => { const k = norm(n); if (k) bare = bare.split(` ${k} `).join(' '); });
    if (NO_CODE.test(bare)) return null;
    const c = pk.replace(/\s+/g, '');
    const draw = /unentschieden|remis|draw/.test(pk);
    const one = () => (c === '1' ? 'H' : c === '2' ? 'A' : c === 'x' || (draw && !/oder/.test(pk)) ? 'D' : sideOf(pk, home, away));
    if (/halbzeit|\bhz\b|pause|first half|1 hz/.test(mk)) { // Halbzeit: nur der Stand zur Pause (1 X 2)
      if (/uber|unter|over|under|beide|tor/.test(all)) return null;
      const r = one();
      return r ? r + '1' : null;
    }
    if (/ergebnis ?wette|genaues ergebnis|exaktes ergebnis|korrektes ergebnis|richtiges ergebnis|correct score/.test(mk)) {
      const m = /^(\d{1,2}) (\d{1,2})$/.exec(pk);
      return m ? `CS${+m[1]}:${+m[2]}` : null;
    }
    if (/unentschieden keine wette|remis keine wette|keine wette bei remis|draw no bet|\bdnb\b/.test(all)) {
      const r = c === '1' ? 'H' : c === '2' ? 'A' : sideOf(pk, home, away);
      return r ? r + 'N' : null;
    }
    // Richtung zuerst aus dem Tipp: der Markt heißt oft „Über/Unter 2,5“, der Tipp „Über 2,5“ (oder nur „Über“)
    const OU = /(uber|over|unter|under|mehr als|weniger als)\s+(\d{1,2})(?:\s+(\d))?\b/;
    const ou = OU.exec(pk) || OU.exec(all);
    if (ou) {
      if (/beide|btts/.test(all)) return null;
      const pd = /\b(uber|over|mehr als|unter|under|weniger als)\b/.exec(pk);
      const dir = /^(uber|over|mehr)/.test(pd ? pd[1] : ou[1]) ? 'O' : 'U';
      const line = String(+ou[2] * 10 + (ou[3] ? +ou[3] : 0));
      let side = /\bheim/.test(mk) ? 'H' : /\bgast|auswarts/.test(mk) ? 'A' : null;
      if (!side && home && away) {
        const a = sideScore(all, home);
        const b = sideScore(all, away);
        if (a && b) side = null; else side = a ? 'H' : b ? 'A' : null;
      }
      if (!side && /team|mannschaft/.test(mk)) return null; // Tore eines Teams, aber welches? Dann lieber nicht.
      return (side || '') + dir + line;
    }
    if (/beide|btts|both teams/.test(all)) return /nein|\bno\b|nicht/.test(pk) ? 'BN' : 'BY';
    if (/doppelt|double/.test(mk) || ['1x', 'x2', '12', '2x', 'x1', '21'].includes(c) || / oder | or /.test(` ${pk} `)) {
      const m = { '1x': 'HD', x1: 'HD', x2: 'DA', '2x': 'DA', 12: 'HA', 21: 'HA' }[c];
      if (m) return m;
      const sd = sideOf(pk, home, away);
      if (draw && sd) return sd === 'H' ? 'HD' : 'DA';
      if (!draw && home && away && sideScore(pk, home) && sideScore(pk, away)) return 'HA';
      return null;
    }
    if (/trifft|tor erzielt|to score|erzielt ein tor|team tor/.test(all)) {
      const sd = sideOf(pk, home, away) || sideOf(mk, home, away);
      return sd ? sd + 'S' : null;
    }
    return one();
  }
  // Heim und Gast getauscht (der Schein zeigt sie andersrum als der Spielplan): Code spiegeln
  function mirror(c) {
    if (!c) return c;
    const cs = /^CS(\d+):(\d+)$/.exec(c);
    if (cs) return `CS${cs[2]}:${cs[1]}`;
    if (c === 'HD') return 'DA';
    if (c === 'DA') return 'HD';
    if (/^[HA]/.test(c) && c !== 'HA') return (c[0] === 'H' ? 'A' : 'H') + c.slice(1);
    return c;
  }
  const FAM = ['H', 'D', 'A', 'HD', 'DA', 'HA'];
  const ouRes = (dir, line, n) => (n === line ? 'void' : dir === 'O' ? n > line : n < line);
  // Ergebnis eines Tipps nach 90 Minuten: true gewonnen · false verloren · 'void' Einsatz zurück · null (noch) nicht feststellbar
  function wonCode(code, x, y, h1, a1) {
    const res = (a, b) => (a > b ? 'H' : a === b ? 'D' : 'A');
    if (FAM.includes(code)) return code.includes(res(x, y));
    let m = /^([OU])(\d+)$/.exec(code);
    if (m) return ouRes(m[1], +m[2] / 10, x + y);
    m = /^([HA])([OU])(\d+)$/.exec(code);
    if (m) return ouRes(m[2], +m[3] / 10, m[1] === 'H' ? x : y);
    if (code === 'HN' || code === 'AN') return x === y ? 'void' : (code === 'HN') === (x > y);
    m = /^([HDA])1$/.exec(code);
    if (m) return h1 == null || a1 == null ? null : m[1] === res(h1, a1);
    m = /^CS(\d+):(\d+)$/.exec(code);
    if (m) return x === +m[1] && y === +m[2];
    const t = { HS: x > 0, AS: y > 0, BY: x > 0 && y > 0, BN: !(x > 0 && y > 0) }[code];
    return t === undefined ? null : t;
  }
  const lineTxt = (d) => nf1.format(+d / 10).replace(/,0$/, '');
  function tipLabel(code, h, a) {
    let m = /^([OU])(\d+)$/.exec(code);
    if (m) return `${m[1] === 'O' ? 'Über' : 'Unter'} ${lineTxt(m[2])} Tore`;
    m = /^([HA])([OU])(\d+)$/.exec(code);
    if (m) return `${m[1] === 'H' ? h : a} ${m[2] === 'O' ? 'über' : 'unter'} ${lineTxt(m[3])} Tore`;
    m = /^CS(\d+):(\d+)$/.exec(code);
    if (m) return `Ergebnis ${m[1]}:${m[2]}`;
    return { H: `Sieg ${h}`, D: 'Unentschieden', A: `Sieg ${a}`, HD: `${h} oder Remis`, DA: `${a} oder Remis`, HA: 'Kein Unentschieden',
      BY: 'Beide Teams treffen', BN: 'Nicht beide treffen', HS: `${h} trifft`, AS: `${a} trifft`, HN: `Sieg ${h} · Remis = Geld zurück`, AN: `Sieg ${a} · Remis = Geld zurück`,
      H1: `Halbzeit: ${h} vorn`, D1: 'Halbzeit: Unentschieden', A1: `Halbzeit: ${a} vorn` }[code] || code;
  }
  const tipKind = (code) => (!code ? 'Sonstige' : FAM.slice(0, 3).includes(code) ? 'Endergebnis' : FAM.includes(code) ? 'Doppelte Chance'
    : /^[OU]\d/.test(code) ? 'Tore über/unter' : /^[HA][OU]\d/.test(code) ? 'Team-Tore' : code[0] === 'B' ? 'Beide treffen'
    : /^[HA]S$/.test(code) ? 'Team trifft' : /^[HA]N$/.test(code) ? 'Remis = Geld zurück' : /^[HDA]1$/.test(code) ? 'Halbzeit' : /^CS/.test(code) ? 'Genaues Ergebnis' : 'Sonstige');
  // Art eines Tipps, auch wenn Wettbuch ihn nicht selbst nachrechnet (für die Statistik)
  function mkKind(l) {
    if (l.m) return tipKind(l.m);
    const t = norm(`${l.mk || ''} ${l.pick || ''}`);
    if (/ecke|corner/.test(t)) return 'Ecken';
    if (/karte|card/.test(t)) return 'Karten';
    if (/torschutz|scorer|spieler|player/.test(t)) return 'Spieler';
    if (/handicap/.test(t)) return 'Handicap';
    if (/sieger|meister|aufsteig|absteig|weiterkomm|qualifi/.test(t)) return 'Langzeitwette';
    return 'Sonstige';
  }
  // Text eines Tipps für die Anzeige: erkannter Code mit Teamnamen, sonst so, wie er auf dem Schein steht
  const legPick = (l) => (l.m && l.home && l.away ? tipLabel(l.m, l.home, l.away) : l.pick || 'Tipp');

  // ------------------------------------------------------------------ Spiel suchen (Tipp eintragen, falsch zugeordnetes Spiel korrigieren)
  function searchGames(q, n) {
    if (!G.data) return [];
    const now = Date.now();
    const rows = G.data.games.filter((r) => r[5] !== 3);
    const rank = (slug) => { const i = G.rank.indexOf(slug); return i < 0 ? 999 : i; };
    if (!norm(q)) {
      // ohne Suchbegriff: heute und morgen, die großen Ligen zuerst
      return rows.filter((r) => { const d = dayDiff(r[2]); return d >= 0 && d <= 1 && new Date(r[2]).getTime() > now - 2 * 36e5; })
        .sort((x, y) => (rank(x[1]) - rank(y[1])) || (new Date(x[2]) - new Date(y[2]))).slice(0, n);
    }
    const ids = new Set(searchTeams(q, 8).map((t) => t.id));
    const t = (r) => new Date(r[2]).getTime();
    const past = (r) => t(r) < now - 3 * 36e5;
    // kommende Spiele zuerst (das nächste oben), danach die gerade gespielten
    return rows.filter((r) => ids.has(r[3]) || ids.has(r[4]))
      .sort((x, y) => (past(x) - past(y)) || (past(x) ? t(y) - t(x) : t(x) - t(y))).slice(0, n);
  }
  function gameRow(r, act, extra) {
    const h = teamName(r[3]);
    const a = teamName(r[4]);
    const st = r[5] === 2 && r[6] != null ? `Endstand ${r[6]}:${r[7]}` : r[5] === 1 ? 'läuft gerade' : kickoff(r[2]);
    return `<button class="row res-row" data-act="${act}" data-g="${esc(r[0])}"${extra || ''}><span class="duo">${crest(h, 28, true)}${crest(a, 28, true)}</span><span class="grow"><div class="t">${esc(h)} – ${esc(a)}</div><div class="s">${esc([lgName(r[1]), st].filter(Boolean).join(' · '))}</div></span></button>`;
  }
  function gameList(q, act, extra) {
    if (!G.data) return `<div class="empty">${G.err ? 'Der Spielplan konnte gerade nicht geladen werden.' : 'Der Spielplan wird geladen …'}</div>`;
    const list = searchGames(q, 25);
    if (!list.length) return `<div class="empty">${norm(q) ? 'Kein Spiel gefunden. Im Spielplan stehen die Spiele der letzten 5 und der nächsten 16 Tage aus über 60 Ligen.' : 'Heute und morgen keine Spiele im Plan – such nach einem Team.'}</div>`;
    return `${norm(q) ? '' : '<div class="lab">HEUTE UND MORGEN</div>'}<div class="card flush">${list.map((r) => gameRow(r, act, extra)).join('')}</div>`;
  }
  const legFromRow = (r) => ({ g: r[0], slug: r[1], t: r[2], comp: lgName(r[1]), home: teamName(r[3]), away: teamName(r[4]) });

  // ------------------------------------------------------------------ Wetten und Geld
  // Alles wird aus den gespeicherten Wetten und Buchungen gerechnet, in ganzen Cent (keine Rundungsfehler). Keine Prozente: nur Euro und Anzahlen.
  // Eine Wette zählt am Tag ihres letzten Anpfiffs: abgerechnet wird sie oft erst, wenn die App offen ist, und das kann Tage später sein.
  const B = { tab: 'open', filter: 'all', period: '30', split: 'kind', more: false, draft: null, cal: null, calDay: null, anim: null, doneAll: false };
  const betsAll = () => { const x = store.get('bets', []); return Array.isArray(x) ? x : []; };
  const betsSave = (list) => store.set('bets', list.slice(0, 500));
  const cents = (v) => Math.round((v || 0) * 100);
  const stakeC = (b) => (b.free ? 0 : cents(b.stake)); // Gratiswette: kein eigenes Geld im Spiel
  const winC = (b) => (b.win ? Math.max(0, cents(b.win) - (b.free ? cents(b.stake) : 0)) : 0); // Auszahlung bei Gewinn (Gratiswette: ohne Einsatz)
  const backC = (b) => (b.status === 'won' ? winC(b) : b.status === 'void' ? stakeC(b) : b.status === 'cash' ? cents(b.cash) : 0);
  const betCents = (b) => backC(b) - stakeC(b);
  const betPL = (b) => betCents(b) / 100;
  const legTeams = (l) => (l.home && l.away ? `${l.home} – ${l.away}` : l.event || '');
  const betKind = (b) => (b.system ? 'System' : b.legs.length > 1 ? 'Kombi' : 'Einzel');
  const catOf = betKind;
  const betTitle = (b) => (b.system ? `System ${b.system} · ${b.legs.length} Tipps` : b.legs.length > 1 ? `${b.title || 'Kombi'} · ${b.legs.length} Tipps` : (b.legs[0] && legPick(b.legs[0])) || b.title || 'Wette');
  const firstKick = (b) => Math.min(...b.legs.map((l) => (l.t ? new Date(l.t).getTime() : Infinity)));
  const lastKick = (b) => Math.max(0, ...b.legs.map((l) => (l.t ? new Date(l.t).getTime() : 0)));
  const teamsOf = (legs) => { const o = {}; legs.forEach((l) => [l.home, l.away].forEach((n) => { if (n && REG[n]) o[n] = REG[n]; })); return o; };
  // prüft Wettbuch selbst? offen, keine Systemwette, nicht von Hand abgerechnet und mindestens ein Spiel erkannt
  const trackable = (b) => b.status === 'open' && !b.system && !b.manual && b.legs.some((l) => l.g && l.slug && l.m);
  const legState = (l) => (l.res ? (l.res.void ? 'void' : l.res.won ? 'won' : 'lost') : l.shot || null);
  const PERIOD_DAYS = { 7: 7, 30: 30, 90: 90, 365: 365 };
  const PERIOD_TXT = { 7: 'letzte 7 Tage', 30: 'letzte 30 Tage', 90: 'letzte 3 Monate', 365: 'letzte 12 Monate', all: 'seit Beginn' };
  const PERIODS_M = [['7', '7 T'], ['30', '30 T'], ['90', '3 M'], ['365', '1 J'], ['all', 'Alles']];
  const periodFrom = () => (B.period === 'all' ? -Infinity : Date.now() - PERIOD_DAYS[B.period] * 864e5);
  const fmtDate = (t) => new Date(t).toLocaleDateString('de-DE', { day: 'numeric', month: 'short' });
  const dayShort = (t) => new Date(t).toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short' });
  const fmtWhen = (t) => `${fmtDate(t)}, ${hm(t)}`;
  const dayLong = (t) => { const dd = dayDiff(new Date(t).toISOString()); return dd === 0 ? 'Heute' : dd === -1 ? 'Gestern' : new Date(t).toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' }); };
  const settleT = (b) => { const k = lastKick(b); return k && b.done && k < b.done ? k : b.done; };
  const sumPL = (list) => list.reduce((a, b) => a + betCents(b), 0) / 100;
  const sumStake = (list) => list.reduce((a, b) => a + stakeC(b), 0) / 100;
  const settledBets = () => betsAll().filter((b) => b.status !== 'open' && b.done).sort((x, y) => settleT(x) - settleT(y));
  const betsFrom = (from) => settledBets().filter((b) => b.status !== 'void' && settleT(b) >= from);
  const plusMinus = (v) => (v > 0.004 ? 'up' : v < -0.004 ? 'down' : '');
  // Plus grün, Minus rot, auch mitten im Satz
  const pm = (v, txt) => `<em class="pm ${plusMinus(v)}">${txt}</em>`;
  const mhTone = (mode, v) => (mode === 'pl' ? plusMinus(v) : '');
  const replay = (el, cls) => { if (!el) return; el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); };
  const curPage = () => S.stack[S.stack.length - 1];
  // so viel Euro bringt eine Gruppe von Wetten im Schnitt pro 10 € Einsatz (statt Prozent)
  const per10 = (c, st) => (st ? signed(((c / st) * 10)) : 'k. A.');
  const nBets = (n) => `${n} ${n === 1 ? 'Wette' : 'Wetten'}`;
  // Betrag groß, Cent klein („1.234“ + „,56 €“) – wie in Banking-Apps
  function moneyHtml(v, sg) {
    const s = sg ? signed(v) : eur(v);
    const m = /^(.*?)(,\d\d\s?€)$/.exec(s);
    return m ? `${esc(m[1])}<small>${esc(m[2])}</small>` : esc(s);
  }
  function setNum(el, v, sg) {
    if (!el) return;
    if (el._cu) { cancelAnimationFrame(el._cu); el._cu = 0; }
    el.innerHTML = moneyHtml(v, sg);
  }
  // große Zahl vom alten zum neuen Wert laufen lassen (data-cu = Ziel, data-sg = mit Vorzeichen); nur Text, keine Ebenen
  function countUp(el, from) {
    const to = +el.dataset.cu;
    const sg = el.dataset.sg === '1';
    if (reduce || !Number.isFinite(to) || Math.abs(to - from) < 0.01) return;
    if (el._cu) cancelAnimationFrame(el._cu);
    let t0 = 0;
    const step = (now) => {
      if (!t0) t0 = now;
      const k = Math.min(1, (now - t0) / 950);
      const e = 1 - Math.pow(1 - k, 4);
      el.innerHTML = moneyHtml(round2(from + (to - from) * e), sg);
      el._cu = k < 1 ? requestAnimationFrame(step) : 0;
    };
    el.innerHTML = moneyHtml(from, sg);
    el._cu = requestAnimationFrame(step);
  }
  // Auftritt: Elemente gleiten gestaffelt herein (einmalig, nur transform/opacity – iPhone-Regel)
  function stagger(items) {
    if (reduce || !items.length) return;
    const list = items.slice(0, 14);
    list.forEach((c, i) => { c.classList.remove('rvi'); c.style.setProperty('--r', i); });
    void list[0].offsetWidth;
    list.forEach((c) => c.classList.add('rvi'));
    setTimeout(() => list.forEach((c) => c.classList.remove('rvi')), 1300);
  }
  // Seite zeigt sich (Bereich gewechselt, App geöffnet): Inhalt gestaffelt, große Zahlen laufen vom zuletzt gezeigten Wert zum neuen
  const CU = {};
  const REVEAL_IN = ['ovg', 'hbody', 'bbody', 'blist', 'cal', 'dday']; // Behälter: deren Karten kommen einzeln
  const revealItems = (box, items = []) => {
    [...box.children].forEach((c) => { if (REVEAL_IN.some((k) => c.classList.contains(k))) revealItems(c, items); else items.push(c); });
    return items;
  };
  function reveal(p) {
    const w = p && $('.wrap', p.el);
    if (!w) return;
    stagger(revealItems(w));
    $$('[data-cu]', w).forEach((n, i) => {
      const k = `${p.path}:${i}`;
      const to = +n.dataset.cu;
      const from = k in CU ? CU[k] : 0;
      CU[k] = to;
      countUp(n, from);
    });
  }

  // Kontostand: „Kontostand jetzt“ (wie beim Wettanbieter) + alles danach – neue Einsätze ab, Auszahlungen dazu, Ein-/Auszahlungen.
  // Wetten mit „old“ (beim Eintragen schon im Kontostand) zählen nur in der Statistik.
  function walletState() {
    const w = store.get('wallet', {}) || {};
    const bets = betsAll();
    const at = w.at || 0;
    let bal = typeof w.base === 'number' ? cents(w.base) : null;
    let open = 0;
    let openWin = 0;
    let nOpen = 0;
    bets.forEach((b) => {
      if (b.status === 'open') { open += stakeC(b); openWin += winC(b); nOpen++; }
      if (bal == null || b.old) return;
      if (b.at > at) bal -= stakeC(b);
      if (b.status !== 'open' && b.done && b.done > at) bal += backC(b);
    });
    if (bal != null) (w.moves || []).forEach((m) => { if (m.t > at) bal += cents(m.v); });
    return { balance: bal == null ? null : bal / 100, open: open / 100, openWin: openWin / 100, n: bets.length, nOpen };
  }
  const hasWallet = () => typeof (store.get('wallet', {}) || {}).base === 'number';
  // Kontoauszug: jede Bewegung mit dem Kontostand danach (er zählt ab dem Moment, in dem er eingetragen wurde)
  function ledger() {
    const w = store.get('wallet', {}) || {};
    const st = typeof w.base === 'number' ? (w.start || { t: w.at || 0, v: w.base }) : null;
    const ev = [];
    betsAll().forEach((b) => {
      if (b.old) return;
      const txt = betTitle(b);
      if (stakeC(b)) ev.push({ t: b.at, real: b.at, v: -stakeC(b) / 100, k: 'stake', txt });
      if (b.done && b.status !== 'open') ev.push({ t: Math.max(b.at, settleT(b)), real: b.done, v: backC(b) / 100, k: b.status, txt });
    });
    (w.moves || []).forEach((m) => ev.push({ t: m.t, real: m.t, v: m.v, k: m.v > 0 ? 'in' : 'out', txt: '' }));
    (w.fixes || []).forEach((f) => ev.push({ t: f.t, real: f.t, v: f.v, k: 'fix', txt: '' }));
    ev.sort((x, y) => x.t - y.t);
    let c = st ? cents(st.v) : null;
    ev.forEach((e) => { if (st && e.real > st.t) { if (e.t <= st.t) e.t = st.t + 1; c += cents(e.v); e.bal = c / 100; } });
    return { ev, st };
  }
  const walletPts = (lg) => (lg.st ? [{ t: lg.st.t, v: lg.st.v }].concat(lg.ev.filter((e) => e.bal != null && e.v !== 0).map((e) => ({ t: e.t, v: e.bal }))) : []);
  function plPts() {
    const list = settledBets();
    if (!list.length) return [];
    let c = 0;
    return [{ t: settleT(list[0]) - 1, v: 0 }].concat(list.map((b) => { c += betCents(b); return { t: settleT(b), v: c / 100 }; }));
  }
  // Reihe auf den Zeitraum zuschneiden: Wert am Anfang, Bewegungen, Stand heute
  function slicePts(pts, from) {
    if (!pts.length) return [];
    const before = pts.filter((p) => p.t < from).pop();
    const out = (before ? [{ t: from, v: before.v }] : []).concat(pts.filter((p) => p.t >= from));
    if (out.length && out[out.length - 1].t < Date.now()) out.push({ t: Date.now(), v: out[out.length - 1].v });
    return out;
  }

  // ------------------------------------------------------------------ Limits (eigene Grenzen) und Hinweise zum Spielerschutz
  const LIMITS = [['week', 'Einsatz pro Woche'], ['lossM', 'Verlust pro Monat'], ['depM', 'Einzahlung pro Monat']];
  function limitState() {
    const L = store.get('limits', {}) || {};
    const now = new Date();
    const wk = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7)).getTime();
    const mo = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const bets = betsAll();
    const used = {
      week: bets.filter((b) => b.at >= wk).reduce((a, b) => a + stakeC(b), 0),
      lossM: Math.max(0, -bets.filter((b) => b.status !== 'open' && b.done && settleT(b) >= mo).reduce((a, b) => a + betCents(b), 0)),
      depM: ((store.get('wallet', {}) || {}).moves || []).filter((m) => m.t >= mo && m.v > 0).reduce((a, m) => a + cents(m.v), 0),
    };
    return LIMITS.map(([k, name]) => {
      const max = typeof L[k] === 'number' && L[k] > 0 ? cents(L[k]) : null;
      return { k, name, max, used: used[k], over: max != null && used[k] > max, full: max != null && used[k] >= max };
    });
  }
  // wie viele Wetten zuletzt hintereinander verloren gingen
  function lossRun() {
    const list = settledBets().filter((b) => b.status !== 'void');
    let n = 0;
    for (let i = list.length - 1; i >= 0 && list[i].status === 'lost'; i--) n++;
    return n;
  }
  function rgNotice() {
    const full = limitState().filter((x) => x.full);
    const run = lossRun();
    if (!full.length && run < 5) return '';
    const t = full.length ? `${full.map((x) => x.name).join(' und ')}: Limit ${full.some((x) => x.over) ? 'überschritten' : 'erreicht'}.` : `${run} Wetten hintereinander verloren.`;
    return `<section class="rg-n">${I.shield}<div class="grow"><b>${esc(t)}</b><p>Vielleicht ist jetzt ein guter Moment für eine Pause. Hilfe gibt es kostenlos und anonym bei check-dein-spiel.de oder unter 0800 1 37 27 00.</p>${full.length ? '<button class="link" data-act="tab" data-tab="/money">Zu den Limits</button>' : ''}</div></section>`;
  }
  function limitsCard() {
    const ls = limitState();
    if (!ls.some((x) => x.max != null)) return `<section class="sec"><div class="sec-h"><h2>Limits</h2></div><div class="card lim-c"><p class="lim-e">Setz dir eigene Grenzen: wie viel du pro Woche einsetzen und pro Monat verlieren oder einzahlen willst. Wettbuch zeigt dir, wie viel noch frei ist.</p><button class="btn soft" data-act="limits">Limits festlegen</button></div></section>`;
    const row = (x) => {
      if (x.max == null) return `<div class="lim-r off"><div class="lim-t"><b>${esc(x.name)}</b><span>kein Limit</span></div></div>`;
      const k = Math.min(1, x.used / x.max);
      const txt = x.over ? `um ${eur((x.used - x.max) / 100)} überschritten` : x.full ? 'Limit erreicht' : `noch ${eur((x.max - x.used) / 100)} frei`;
      return `<div class="lim-r${x.full ? ' full' : ''}"><div class="lim-t"><b>${esc(x.name)}</b><span>${eur(x.used / 100)} von ${eur(x.max / 100)}</span></div><div class="lim-bar"><i style="transform:scaleX(${k.toFixed(3)})"></i></div><span class="lim-s">${txt}</span></div>`;
    };
    return `<section class="sec"><div class="sec-h"><h2>Limits</h2><button class="link" data-act="limits">Ändern</button></div><div class="card lim-c">${ls.map(row).join('')}</div></section>`;
  }

  // ------------------------------------------------------------------ Wett-Karten (sehen aus wie ein Wettschein) und Listen-Zeilen – Antippen öffnet die Wette
  const ST_NAME = { open: 'Offen', won: 'Gewonnen', lost: 'Verloren', void: 'Storniert', cash: 'Cashout' };
  // Stand einer offenen Wette: läuft gerade (mit Spielstand), nächster Anpfiff oder „wird geprüft“
  function openState(b) {
    const now = Date.now();
    const run = b.legs.map((l) => !l.res && l.g && LIVE[l.g]).find((x) => x && x.state === 'in');
    if (run) return { live: true, txt: `${run.hs}:${run.as}${run.clock ? ' · ' + run.clock : ''}` };
    const next = b.legs.filter((l) => !l.res && l.t && new Date(l.t).getTime() > now).map((l) => l.t).sort()[0];
    if (next) return { txt: kickoff(next) };
    return { txt: trackable(b) ? 'wird geprüft' : 'offen' };
  }
  function liveText(b) {
    const s = openState(b);
    return s.live ? `läuft · ${s.txt}` : s.txt === 'wird geprüft' ? 'wird nach dem Abpfiff geprüft' : s.txt;
  }
  // Abzeichen oben rechts: Live mit Spielstand, Anpfiff oder das Ergebnis
  function stPill(b) {
    if (b.status === 'open') {
      const s = openState(b);
      return s.live ? `<span class="pill live"><i></i>Live · ${esc(s.txt)}</span>` : `<span class="pill">${I.clock}${esc(s.txt)}</span>`;
    }
    return `<span class="pill ${b.status}">${b.status === 'won' ? I.check : b.status === 'lost' ? I.x : ''}${esc(ST_NAME[b.status] || '')}</span>`;
  }
  const kindTxt = (b) => (b.system ? `System ${b.system} · ${b.legs.length} Tipps` : b.legs.length > 1 ? `${b.title || 'Kombi'} · ${b.legs.length} Tipps` : 'Einzelwette');
  // rechts unten auf der Karte: offen = möglicher Gewinn, sonst Plus/Minus
  function betResult(b) {
    if (b.status === 'open') return ['Mögl. Gewinn', b.win ? eur(winC(b) / 100) : 'k. A.', ''];
    if (b.status === 'void') return ['Zurück', eur(stakeC(b) / 100), ''];
    const pl = betPL(b);
    return [b.status === 'won' ? 'Gewinn' : b.status === 'cash' ? 'Cashout' : 'Verlust', signed(pl), plusMinus(pl)];
  }
  function legRow(l, extra) {
    const lv = l.g && LIVE[l.g];
    let info = '';
    if (l.res) info = l.res.hs != null ? `Endstand ${l.res.hs}:${l.res.as}${l.res.et ? ' nach 90 Min.' : ''}${l.res.void ? ' · Geld zurück' : ''}` : l.res.et ? 'nach 90 Min. unentschieden' : l.res.void ? 'zählt nicht' : '';
    else if (lv && lv.state === 'in') info = `läuft · ${lv.hs}:${lv.as}${lv.clock ? ' · ' + lv.clock : ''}`;
    else if (lv && lv.cancelled) info = 'verschoben';
    else if (l.t) info = kickoff(l.t);
    const s = legState(l);
    const mk = s ? { won: [I.check, 'won'], lost: [I.x, 'lost'], void: ['–', 'void'] }[s] : null;
    const sub = [legTeams(l), l.m ? '' : l.mk, info].filter(Boolean).join(' · ');
    return `<div class="bleg">${l.home && l.away ? `<span class="duo">${crest(l.home, 24, true)}${crest(l.away, 24, true)}</span>` : `<span class="bl-ic">${I.ticket}</span>`}<span class="grow"><b>${esc(legPick(l))}</b>${sub ? `<span>${esc(sub)}</span>` : ''}</span>${l.q ? `<span class="bl-q">${nf2.format(l.q)}</span>` : ''}${mk ? `<span class="bl-mk ${mk[1]}">${mk[0]}</span>` : ''}${extra || ''}</div>`;
  }
  function ticketCard(b) {
    regTeams(b);
    const r = betResult(b);
    const more = b.legs.length - 3;
    return `<article class="tk ${b.status}" data-act="betview" data-id="${esc(b.id)}" role="button" tabindex="0">
      <div class="tk-h"><span class="tk-k">${esc(kindTxt(b))}${b.free ? ' · Gratiswette' : ''}</span>${stPill(b)}</div>
      <div class="tk-legs">${b.legs.slice(0, 3).map((l) => legRow(l)).join('')}${more > 0 ? `<div class="tk-more">+ ${more} ${more === 1 ? 'weiterer Tipp' : 'weitere Tipps'}</div>` : ''}</div>
      <div class="tk-cut" aria-hidden="true"></div>
      <div class="tk-f"><div><span>Einsatz</span><b>${eur(b.stake)}</b></div><div><span>Quote</span><b>${b.q ? nf2.format(b.q) : 'k. A.'}</b></div><div class="r"><span>${r[0]}</span><b class="${r[2]}">${esc(r[1])}</b></div></div></article>`;
  }
  const MK = { won: I.check, lost: I.x, void: '–', cash: '€', open: I.clock };
  // Symbol links in einer Zeile: zwei Wappen (Einzelwette), Zahl der Tipps (Kombi) oder ein Schein
  function betIcon(b) {
    const l = b.legs[0] || {};
    if (b.legs.length === 1 && l.home && l.away) return `<span class="duo">${crest(l.home, 24, true)}${crest(l.away, 24, true)}</span>`;
    if (b.legs.length > 1) return `<span class="li-n"><b>${b.legs.length}</b><small>Tipps</small></span>`;
    return `<span class="li-ic">${I.ticket}</span>`;
  }
  function betLine(b, label, noDate) {
    regTeams(b);
    const pl = betPL(b);
    const sub = [label, noDate ? '' : fmtDate(settleT(b)), b.q ? `Quote ${nf2.format(b.q)}` : ''].filter(Boolean).join(' · ');
    return `<button class="li" data-act="betview" data-id="${esc(b.id)}"><span class="mk ${b.status}">${MK[b.status] || ''}</span><span class="grow"><b>${esc(betTitle(b))}</b><span>${esc(sub)}</span></span><span class="li-v ${b.status === 'void' ? '' : plusMinus(pl)}">${b.status === 'void' ? 'zurück' : signed(pl)}</span></button>`;
  }
  function openLine(b) {
    regTeams(b);
    const s = openState(b);
    return `<button class="li" data-act="betview" data-id="${esc(b.id)}">${betIcon(b)}<span class="grow"><b>${esc(betTitle(b))}</b><span${s.live ? ' class="lv"' : ''}>${s.live ? `<i></i>Live · ${esc(s.txt)}` : esc(s.txt)}</span></span><span class="li-v2"><b>${eur(b.stake)}</b>${b.win ? `<span>→ ${eur(winC(b) / 100)}</span>` : ''}</span></button>`;
  }
  // Wette antippen: alle Tipps und Zahlen, darunter Abrechnen, Bearbeiten und Löschen
  function openBetView(id) {
    const b = betsAll().find((x) => x.id === id);
    if (!b || $('.sheet')) return;
    regTeams(b);
    const r = betResult(b);
    const i2 = esc(b.id);
    const nLinked = b.legs.filter((l) => l.g && l.m).length;
    const auto = trackable(b) ? (nLinked === b.legs.length ? 'Wettbuch prüft nach dem Abpfiff selbst' : `${nLinked} von ${b.legs.length} Tipps prüft Wettbuch selbst`) : '';
    const big = b.status === 'open' ? (b.win ? moneyHtml(winC(b) / 100) : 'k. A.') : b.status === 'void' ? moneyHtml(stakeC(b) / 100) : moneyHtml(betPL(b), true);
    const gain = b.win ? (winC(b) - stakeC(b)) / 100 : null;
    const third = b.status === 'open' ? ['Plus bei Gewinn', gain != null ? signed(gain) : 'k. A.', gain != null ? plusMinus(gain) : ''] : ['Auszahlung', eur(backC(b) / 100), ''];
    const acts = b.status === 'open'
      ? `<div class="bd-acts"><button class="won" data-act="settle" data-id="${i2}" data-val="won">${I.check}<span>Gewonnen</span></button><button class="lost" data-act="settle" data-id="${i2}" data-val="lost">${I.x}<span>Verloren</span></button><button data-act="cashout" data-id="${i2}">${I.cash}<span>Cashout</span></button><button data-act="settle" data-id="${i2}" data-val="void"><b>–</b><span>Storniert</span></button></div>`
      : `<button class="btn soft bd-re" data-act="settle" data-id="${i2}" data-val="open">Wieder auf offen setzen</button>`;
    const meta = [b.src === 'scan' ? 'Gescannt' : 'Eingetragen', `gesetzt ${fmtWhen(b.at)}`, b.bookie, b.done && b.status !== 'open' ? `abgerechnet ${fmtDate(b.done)}` : ''].filter(Boolean).join(' · ');
    const sh = sheet(`<div class="bd-h"><span class="bd-k">${esc(kindTxt(b))}${b.free ? ' · Gratiswette' : ''}</span>${stPill(b)}</div>
      <div class="bd-big"><span>${b.status === 'open' ? 'Möglicher Gewinn' : esc(r[0])}</span><b class="${b.status === 'open' || b.status === 'void' ? '' : r[2]}">${big}</b></div>
      <div class="bd-legs">${b.legs.map((l) => legRow(l)).join('')}</div>
      <div class="bd-grid"><div><span>Einsatz${b.free ? ' (gratis)' : ''}</span><b>${eur(b.stake)}</b></div><div><span>Quote</span><b>${b.q ? nf2.format(b.q) : 'k. A.'}</b></div><div><span>${third[0]}</span><b class="${third[2]}">${esc(third[1])}</b></div></div>
      ${auto ? `<p class="bd-auto">${I.spark}<span>${esc(auto)}</span></p>` : ''}
      ${acts}
      <div class="bd-foot"><button data-act="editbet" data-id="${i2}">${I.pen}<span>Bearbeiten</span></button><button class="bd-del" data-act="delbet" data-id="${i2}">Löschen</button></div>
      <p class="bd-meta">${esc(meta)}</p>`, 'bet-panel bd-panel', betTitle(b));
    stagger([...$('.panel', sh).children].slice(1));
  }
  // Seiten mit Wetten neu zeichnen (live = nur Start und Wetten, dort stehen die Spielstände)
  function refreshBets(live) {
    redrawAll(live ? (p) => p === '/' || p === '/bets' : null);
    refreshKib();
  }

  // ------------------------------------------------------------------ Abrechnen, Cashout, Löschen
  function settleManual(id, st, cash) {
    const all = betsAll();
    const b = all.find((x) => x.id === id);
    if (!b) return;
    if (st === 'open') {
      b.status = 'open';
      b.done = null;
      b.manual = false;
      delete b.cash;
      b.legs.forEach((l) => { if (l.g && l.m) l.res = null; }); // erkannte Spiele werden neu geprüft
    } else {
      b.status = st;
      b.done = Date.now();
      b.manual = true; // von Hand abgerechnet: die automatische Prüfung lässt die Wette in Ruhe
      if (st === 'cash') b.cash = cash; else delete b.cash;
    }
    betsSave(all);
    haptic();
    if (st === 'won') toast(`Gewonnen: ${signed(betPL(b))}`, 'won');
    else if (st === 'cash') toast(`Cashout ${eur(b.cash)} · ${signed(betPL(b))}`);
    refreshBets();
    if (st === 'open') setTimeout(() => checkBets(), 300);
  }
  function sheet(inner, cls, label) {
    const sh = document.createElement('div');
    sh.className = 'sheet';
    sh.innerHTML = `<div class="bg" data-act="close"></div><div class="panel${cls ? ' ' + cls : ''}" role="dialog" aria-label="${esc(label || 'Fenster')}"><div class="grip" data-grip></div>${inner}</div>`;
    document.body.appendChild(sh);
    return sh;
  }
  function openCashSheet(id) {
    const b = betsAll().find((x) => x.id === id);
    if (!b || $('.sheet')) return;
    const sh = sheet(`<h2>Cashout</h2><p class="bf-note" style="margin:-6px 4px 14px">${esc(betTitle(b))} · Einsatz ${eur(b.stake)}</p>
      <div class="lab">AUSGEZAHLTER BETRAG IN €</div><input class="search" type="text" inputmode="decimal" data-act="cashin" placeholder="z. B. 7,20" autocomplete="off" enterkeyhint="done">
      <button class="btn" data-act="cashgo" data-id="${esc(id)}" style="margin-top:12px">Übernehmen</button>`, 'bet-panel', 'Cashout');
    $('input', sh).focus();
  }
  function cashGo(id) {
    const v = dec(($('.sheet [data-act="cashin"]') || {}).value);
    if (v == null || v < 0 || v > 1e7) { toast('Bitte den ausgezahlten Betrag eintragen.'); return; }
    closeSheet();
    settleManual(id, 'cash', round2(v));
  }
  function deleteBet(id) {
    const all = betsAll();
    const b = all.find((x) => x.id === id);
    if (!b) return;
    betsSave(all.filter((x) => x !== b));
    toast('Wette gelöscht');
    refreshBets();
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
  const tickFmt = (v, step) => new Intl.NumberFormat('de-DE', { maximumFractionDigits: step < 1 ? 2 : 0 }).format(v).replace('-', '−');

  // Kurve: weiche Linie ohne Überschwingen, sie läuft exakt durch jeden echten Wert. Beim Umschalten zeichnet sie sich um, statt neu aufzutauchen.
  const CH = { line: null, bars: null };
  const LC = { W: 358, H: 190, R: 52, PT: 12, PB: 26, N: 110 };
  let lcRight = LC.W - LC.R;
  let LCX = Array.from({ length: LC.N }, (_, i) => ((i / (LC.N - 1)) * lcRight).toFixed(1));
  // iPad: Diagramm in echter Breite zeichnen, sonst würde es einfach hochgezogen (Schrift und Höhe viel zu groß)
  function lcFit() {
    const wide = ipadWide();
    const side = ipadSide();
    // iPad quer: die Karte füllt die linke Spalte (7 von 12 Teilen, Maße wie am Ende von app.css)
    const W = side ? Math.round(((Math.min(1320, innerWidth - 92) - 48 - 18) * 7) / 12) : wide ? Math.min(1128, innerWidth) - 64 : 358;
    const H = side ? 230 : wide ? 270 : 190;
    if (W === LC.W && H === LC.H) return;
    LC.W = W;
    LC.H = H;
    lcRight = LC.W - LC.R;
    LCX = Array.from({ length: LC.N }, (_, i) => ((i / (LC.N - 1)) * lcRight).toFixed(1));
    CH.line = null; // alte Kurve passt nicht mehr zur neuen Breite
  }
  const f1 = (v) => v.toFixed(1);
  function monoSlopes(xs, ys) {
    const n = xs.length;
    const h = [];
    const d = [];
    for (let i = 0; i < n - 1; i++) { h[i] = xs[i + 1] - xs[i]; d[i] = (ys[i + 1] - ys[i]) / h[i]; }
    const m = new Array(n).fill(0);
    m[0] = d[0];
    m[n - 1] = d[n - 2];
    for (let i = 1; i < n - 1; i++) {
      if (d[i - 1] * d[i] <= 0) continue;
      const w1 = 2 * h[i] + h[i - 1];
      const w2 = h[i] + 2 * h[i - 1];
      m[i] = (w1 + w2) / (w1 / d[i - 1] + w2 / d[i]);
    }
    return m;
  }
  function sampleCurve(xs, ys, ms) {
    const out = new Array(LC.N);
    let j = 0;
    for (let i = 0; i < LC.N; i++) {
      const x = (i / (LC.N - 1)) * lcRight;
      while (j < xs.length - 2 && x > xs[j + 1]) j++;
      const h = xs[j + 1] - xs[j];
      const t = Math.max(0, Math.min(1, (x - xs[j]) / h));
      const t2 = t * t;
      const t3 = t2 * t;
      out[i] = (2 * t3 - 3 * t2 + 1) * ys[j] + (t3 - 2 * t2 + t) * h * ms[j] + (-2 * t3 + 3 * t2) * ys[j + 1] + (t3 - t2) * h * ms[j + 1];
    }
    return out;
  }
  const samplePath = (y) => { let s = ''; for (let i = 0; i < LC.N; i++) s += `${i ? 'L' : 'M'}${LCX[i]} ${y[i].toFixed(1)}`; return s; };
  const sampleArea = (y, b) => `${samplePath(y)}L${lcRight} ${b.toFixed(1)}L0 ${b.toFixed(1)}Z`;
  function lineModel(pts) {
    lcFit();
    const { W, H, R, PT, PB } = LC;
    const vs = pts.map((p) => p.v);
    const { ticks, step } = niceTicks(Math.min(...vs), Math.max(...vs));
    const lo = ticks[0];
    const hi = ticks[ticks.length - 1];
    const t0 = pts[0].t;
    const t1 = pts[pts.length - 1].t;
    const X = (t) => ((t - t0) / Math.max(1, t1 - t0)) * lcRight;
    const Y = (v) => PT + (1 - (v - lo) / (hi - lo)) * (H - PT - PB);
    const xs = [];
    pts.forEach((p, i) => xs.push(i ? Math.max(X(p.t), xs[i - 1] + 0.02) : X(p.t)));
    const ys = vs.map(Y);
    const ms = monoSlopes(xs, ys);
    let d = `M${f1(xs[0])} ${f1(ys[0])}`;
    for (let i = 0; i < xs.length - 1; i++) {
      const h = (xs[i + 1] - xs[i]) / 3;
      d += `C${f1(xs[i] + h)} ${f1(ys[i] + ms[i] * h)} ${f1(xs[i + 1] - h)} ${f1(ys[i + 1] - ms[i + 1] * h)} ${f1(xs[i + 1])} ${f1(ys[i + 1])}`;
    }
    const base = Y(Math.max(lo, Math.min(hi, 0)));
    const lastX = xs[xs.length - 1];
    const lastY = ys[ys.length - 1];
    const area = `${d}L${f1(lastX)} ${f1(base)}L${f1(xs[0])} ${f1(base)}Z`;
    const grid = ticks.map((v) => `<line class="${v === 0 ? 'z' : 'g'}" x1="0" x2="${lcRight}" y1="${f1(Y(v))}" y2="${f1(Y(v))}"/><text x="${W - 16}" y="${f1(Y(v) + 4)}" text-anchor="end">${esc(tickFmt(v, step))}</text>`).join('');
    const days = (t1 - t0) / 864e5;
    let xl = `<text x="16" y="${H - 7}">${esc(fmtDate(t0))}</text><text x="${lcRight}" y="${H - 7}" text-anchor="end">Heute</text>`;
    if (days >= 3) xl += `<text x="${lcRight / 2}" y="${H - 7}" text-anchor="middle">${esc(fmtDate((t0 + t1) / 2))}</text>`;
    return { W, H, R, right: lcRight, xs, ys, pts, d, area, base, lastX, lastY, grid, xl, sy: sampleCurve(xs, ys, ms), t0 };
  }
  const lcAria = (h, m) => `Verlauf ${h.label} von ${fmtDate(m.t0)} bis heute: zuletzt ${h.big}. Alle Werte stehen im Kontoauszug.`;
  let lcRaf = 0;
  let lcEnd = null;
  function lcStop() {
    if (lcRaf) { cancelAnimationFrame(lcRaf); lcRaf = 0; }
    if (lcEnd) { const f = lcEnd; lcEnd = null; f(); }
  }
  function lcPlace(root, x, y) {
    $('.x', root).setAttribute('x1', f1(x));
    $('.x', root).setAttribute('x2', f1(x));
    [$('.d', root), $('.h', root)].forEach((c) => { c.setAttribute('cx', f1(x)); c.setAttribute('cy', f1(y)); });
  }
  // Von den alten y-Werten zu den neuen: wave = von links nach rechts aufbauen (erster Auftritt), sonst alle Punkte gleichzeitig
  function lcMorph(root, from, base0, wave, frame, done) {
    lcStop();
    const c = CH.line;
    if (!c || !root.isConnected) return;
    const to = c.sy;
    const N = LC.N;
    const line = $('.l', root);
    const area = $('.a', root);
    const dur = wave ? 760 : 480;
    let wd = 0;
    const apply = () => {
      clearTimeout(wd);
      line.setAttribute('d', c.d);
      $('.l2', root).setAttribute('d', c.d);
      area.setAttribute('d', c.area);
      lcPlace(root, c.lastX, c.lastY);
      c.cur = c.sy;
      c.curBase = c.base;
      if (done) done();
    };
    if (reduce) { apply(); return; }
    lcEnd = apply;
    wd = setTimeout(lcStop, dur + 500); // Sicherung, falls das Handy gerade keine Bilder zeichnet
    let t0 = 0;
    const step = (now) => {
      if (!t0) t0 = now;
      const k = Math.min(1, (now - t0) / dur);
      const y = new Array(N);
      for (let i = 0; i < N; i++) {
        const p = wave ? Math.max(0, Math.min(1, (k - (i / (N - 1)) * 0.42) / 0.58)) : k;
        const e = 1 - Math.pow(1 - p, 4);
        y[i] = from[i] + (to[i] - from[i]) * e;
      }
      const eb = 1 - Math.pow(1 - k, 4);
      const b = base0 + (c.base - base0) * eb;
      line.setAttribute('d', samplePath(y));
      area.setAttribute('d', sampleArea(y, b));
      lcPlace(root, c.lastX, y[N - 1]);
      c.cur = y;
      c.curBase = b;
      if (frame) frame(eb);
      if (k < 1) lcRaf = requestAnimationFrame(step);
      else { lcRaf = 0; lcEnd = null; apply(); }
    };
    lcRaf = requestAnimationFrame(step);
  }
  function swapFade(g, html) {
    const n = g.cloneNode(false);
    n.innerHTML = html;
    n.classList.add('fin');
    g.classList.remove('fin');
    g.classList.add('out');
    g.parentNode.insertBefore(n, g.nextSibling);
    setTimeout(() => g.remove(), 260);
  }
  function lineChart(h) {
    lcStop();
    const prev = CH.line;
    const m = lineModel(h.pts);
    const sig = `${B.period}|${h.mode}|${h.pts.length}|${h.pts[h.pts.length - 1].v}`;
    let from = null;
    let base0 = m.base;
    let wave = false;
    if (!reduce && B.anim === 'enter') { from = new Array(LC.N).fill(m.base); wave = true; }
    else if (!reduce && prev && prev.sig !== sig && prev.cur) { from = prev.cur; base0 = prev.curBase; }
    CH.line = Object.assign(m, { fmtV: h.fmtV, def: h, sig, cur: from || m.sy, curBase: base0 });
    if (from) requestAnimationFrame(() => { const lc = $$('.lc').pop(); if (lc) lcMorph(lc, from, base0, wave); });
    const y0 = from ? from[LC.N - 1] : m.lastY;
    const dL = from ? samplePath(from) : m.d;
    const dA = from ? sampleArea(from, base0) : m.area;
    return `<div class="lc" role="img" aria-label="${esc(lcAria(h, m))}">
      <svg viewBox="0 0 ${m.W} ${m.H}" aria-hidden="true"><defs><linearGradient id="lc-wash" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".3"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient><clipPath id="lc-cp"><rect x="0" y="0" width="${m.W}" height="${m.H}"/></clipPath></defs>
      <g class="lc-g">${m.grid}</g><path class="a" fill="url(#lc-wash)" d="${dA}"/><path class="l2" d="${m.d}"/><path class="l" d="${dL}" clip-path="url(#lc-cp)"/><line class="x" x1="${f1(m.lastX)}" x2="${f1(m.lastX)}" y1="${LC.PT}" y2="${m.H - LC.PB}"/><circle class="h" cx="${f1(m.lastX)}" cy="${f1(y0)}" r="10"/><circle class="d" cx="${f1(m.lastX)}" cy="${f1(y0)}" r="4.5"/><g class="lc-xl">${m.xl}</g></svg></div>`;
  }
  // Gewinn/Verlust je Tag, Woche oder Monat (je nach Zeitraum)
  function bucketize(list, from) {
    const now = Date.now();
    const start = Number.isFinite(from) ? from : (list.length ? settleT(list[0]) : now);
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
    for (let d = floor(start); d.getTime() <= now; d = next(d)) out.push({ t0: d.getTime(), t1: next(d).getTime(), c: 0, v: 0, n: 0 });
    list.forEach((b) => { const t = settleT(b); const x = out.find((k) => t >= k.t0 && t < k.t1); if (x) { x.c += betCents(b); x.v = x.c / 100; x.n++; } });
    return { unit, bk: out.slice(unit === 'month' ? -12 : -14) };
  }
  const bucketLong = (k, unit) => (unit === 'day' ? new Date(k.t0).toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short' })
    : unit === 'week' ? `Woche ab ${fmtDate(k.t0)}` : new Date(k.t0).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' }));
  const bucketShort = (k, unit) => { const d = new Date(k.t0); return unit === 'month' ? d.toLocaleDateString('de-DE', { month: 'short' }).replace('.', '') : `${d.getDate()}.${d.getMonth() + 1}.`; };
  const bucketRead = (k, unit) => `${esc(bucketLong(k, unit))} · ${k.n ? `${pm(k.v, signed(k.v))} · ${k.n} ${k.n === 1 ? 'Wette' : 'Wetten'}` : 'keine Wette ausgewertet'}`;
  function barChart(bk, unit) {
    const W = ipadSide() ? 560 : ipadWide() ? 500 : 322;
    const H = ipadWide() ? 200 : 150;
    const PL = 40;
    const PR = 2;
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
        path = `<path class="${up ? 'pos' : 'neg'}" style="--i:${i}" d="M${f1(x)} ${f1(y0)} L${f1(x)} ${f1(yv + dy)} A${r} ${r} 0 0 ${s1} ${f1(x + r)} ${f1(yv)} L${f1(x + bw - r)} ${f1(yv)} A${r} ${r} 0 0 ${s1} ${f1(x + bw)} ${f1(yv + dy)} L${f1(x + bw)} ${f1(y0)} Z"/>`;
      }
      const lab = k.n && (k.v === mx || k.v === mn) && h >= 0.5 ? `<text class="v ${up ? 'p' : 'n'}" x="${f1(x + bw / 2)}" y="${f1(up ? yv - 5 : yv + 13)}" text-anchor="middle">${esc((k.v > 0 ? '+' : '−') + Math.round(Math.abs(k.v)))}</text>` : '';
      const xl = (bk.length - 1 - i) % every === 0 ? `<text x="${f1(x + bw / 2)}" y="${H - 5}" text-anchor="middle">${esc(bucketShort(k, unit))}</text>` : '';
      return `<g class="bm">${path}${lab}${xl}<rect class="hit" data-act="barpick" data-i="${i}" x="${f1(PL + slot * i)}" y="0" width="${f1(slot)}" height="${H}"/></g>`;
    }).join('');
    return `<svg class="bc${B.anim ? ' in' : ''}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Gewinn und Verlust je Zeitabschnitt">${ticks.map((v) => `<line class="${v === 0 ? 'z' : 'g'}" x1="${PL}" x2="${W - PR}" y1="${f1(Y(v))}" y2="${f1(Y(v))}"/><text x="${PL - 6}" y="${f1(Y(v) + 4)}" text-anchor="end">${esc(tickFmt(v, step))}</text>`).join('')}${marks}</svg>`;
  }

  // ------------------------------------------------------------------ Große Karte: Statistik (Gewinn und Verlust) und Kasse (Kontostand)
  function heroData(mode, ws, lg) {
    const from = periodFrom();
    const sinceStart = mode === 'bal' && lg.st && lg.st.t > from; // Kontostand neu eingetragen: zählt erst ab da
    const list = betsFrom(sinceStart ? lg.st.t : from).filter((b) => mode !== 'bal' || !b.old);
    const pl = sumPL(list);
    let pts;
    let val;
    if (mode === 'bal') { pts = slicePts(walletPts(lg), from); val = ws.balance; } else {
      // Gewinn: Die Kurve startet im Zeitraum bei null, die große Zahl ist der Gewinn in genau diesem Zeitraum
      const raw = slicePts(plPts(), from);
      const base = raw.length ? cents(raw[0].v) : 0;
      pts = raw.map((p) => ({ t: p.t, v: (cents(p.v) - base) / 100 }));
      val = pts.length ? pts[pts.length - 1].v : 0;
    }
    const fmtV = mode === 'bal' ? eur : signed;
    const when = esc(sinceStart ? 'seit dem Eintragen' : PERIOD_TXT[B.period]);
    const sub = mode === 'bal' ? `<span class="mh-chg ${plusMinus(pl)}">${esc(signed(pl))} mit Wetten</span><span class="mh-w">${when}</span>`
      : `<span class="mh-w">${list.length ? `${nBets(list.length)} · Einsatz ${eur(sumStake(list))}` : 'keine Wette abgerechnet'} · ${when}</span>`;
    return { mode, pts, val, fmtV, big: fmtV(val), sub, label: mode === 'bal' ? 'Kontostand' : 'Gewinn und Verlust' };
  }
  function hero(mode) {
    const ws = walletState();
    const lg = ledger();
    const look = esc(store.get('mlook', 'uv'));
    const bal = mode === 'bal';
    const head = `<section class="mh" data-look="${look}" data-mode="${mode}"><div class="mh-top"><span class="eyebrow">${bal ? 'Kontostand' : 'Gewinn und Verlust'}</span>${bal && ws.balance != null ? '<button class="mh-btn" data-act="wallet" data-val="base">Ändern</button>' : ''}</div>`;
    if ((bal && ws.balance == null) || (!bal && !ws.n)) {
      lcStop();
      CH.line = null;
      return head + (bal
        ? '<p class="mh-empty">Trag ein, wie viel gerade auf deinem Wettkonto ist. Ab dann rechnet Wettbuch jeden Einsatz, Gewinn und Cashout selbst mit.</p><button class="btn" data-act="wallet" data-val="base">Kontostand eintragen</button></section>'
        : '<p class="mh-empty">Noch keine Wette gespeichert. Scanne deinen ersten Wettschein oder trag eine Wette ein – dann siehst du hier deine Kurve.</p></section>');
    }
    const h = heroData(mode, ws, lg);
    let chart;
    if (h.pts.length >= 2) chart = lineChart(h);
    else { lcStop(); CH.line = null; chart = '<p class="mh-empty">Noch nichts in diesem Zeitraum. Sobald die erste Wette abgerechnet ist, erscheint hier deine Kurve.</p>'; }
    const k = Math.max(0, PERIODS_M.findIndex(([v]) => v === B.period));
    return `${head}<div class="mh-n ${mhTone(mode, h.val)}" data-cu="${round2(h.val)}" data-sg="${bal ? 0 : 1}">${moneyHtml(h.val, !bal)}</div><div class="mh-d">${h.sub}</div>${chart}
      <div class="pseg" style="--k:${k};--n:${PERIODS_M.length}"><span class="ind"></span>${PERIODS_M.map(([v, l]) => `<button class="${B.period === v ? 'on' : ''}" data-act="mperiod" data-val="${v}">${l}</button>`).join('')}</div>
      ${bal ? `<div class="mh-open"><div><span>Im Spiel</span><b>${eur(ws.open)}</b></div><div><span>Mögl. Gewinn</span><b>${eur(ws.openWin)}</b></div><div><span>Offen</span><b>${ws.nOpen}</b></div></div>` : ''}</section>`;
  }
  // Zeitraum gewechselt: Knöpfe gleiten, Kurve zeichnet sich um, Zahl läuft mit – die Seite wird dafür nicht neu aufgebaut
  function heroSwitch() {
    const pg = curPage();
    const mh = pg && $('.mh', pg.el);
    const lc = mh && $('.lc', mh);
    const c0 = CH.line;
    const mode = mh ? mh.dataset.mode : 'pl';
    const h = mh ? heroData(mode, walletState(), ledger()) : null;
    if (!lc || !c0 || !h || h.pts.length < 2) { B.anim = 'enter'; redrawTop(); B.anim = null; return; }
    lcStop();
    const ps = $('.pseg', mh);
    ps.style.setProperty('--k', Math.max(0, PERIODS_M.findIndex(([v]) => v === B.period)));
    $$('button', ps).forEach((x) => x.classList.toggle('on', x.dataset.val === B.period));
    const m = lineModel(h.pts);
    const from = c0.cur;
    const base0 = c0.curBase;
    const a = c0.def.val;
    const num = $('.mh-n', mh);
    const sig = `${B.period}|${h.mode}|${h.pts.length}|${h.pts[h.pts.length - 1].v}`;
    CH.line = Object.assign(m, { fmtV: h.fmtV, def: h, sig, cur: from, curBase: base0 });
    swapFade($('.lc-g:not(.out)', lc), m.grid);
    swapFade($('.lc-xl:not(.out)', lc), m.xl);
    lc.setAttribute('aria-label', lcAria(h, m));
    num.className = `mh-n ${mhTone(h.mode, h.val)}`;
    num.dataset.cu = round2(h.val);
    const sg = h.mode === 'pl';
    setNum(num, a, sg);
    const sub = $('.mh-d', mh);
    sub.innerHTML = h.sub;
    replay(sub, 'fadein');
    lcMorph(lc, from, base0, false, (e) => { num.innerHTML = moneyHtml(a + (h.val - a) * e, sg); }, () => { setNum(num, h.val, sg); });
    const body = $('.hbody', pg.el);
    if (body) { B.anim = 'switch'; body.innerHTML = mode === 'bal' ? moneyBody() : statsBody(); B.anim = null; stagger([...body.children]); }
    pg.el._geo = null;
  }

  // ------------------------------------------------------------------ Statistik
  function marketOf(b) {
    if (b.system) return 'Systemwette';
    if (b.legs.length > 1) return 'Kombi';
    return mkKind(b.legs[0] || {});
  }
  const bandOf = (b) => (!b.q ? 'ohne Quote' : b.q < 1.5 ? 'unter 1,50' : b.q < 2 ? '1,50 bis 1,99' : b.q < 3 ? '2,00 bis 2,99' : b.q < 5 ? '3,00 bis 4,99' : 'ab 5,00');
  const stakeBand = (b) => (b.free ? 'Gratiswette' : b.stake < 5 ? 'unter 5 €' : b.stake < 10 ? '5 bis 9,99 €' : b.stake < 25 ? '10 bis 24,99 €' : b.stake < 50 ? '25 bis 49,99 €' : 'ab 50 €');
  function leagueOf(b) {
    const set = new Set(b.legs.map((l) => l.comp).filter(Boolean));
    return set.size === 1 ? [...set][0] : set.size ? 'Mehrere Ligen' : 'Ohne Liga';
  }
  // eine Wette zählt für jedes Team, das darin vorkommt
  const teamsKey = (b) => { const s = new Set(); b.legs.forEach((l) => [l.home, l.away].forEach((n) => { if (n) s.add(n); })); return [...s]; };
  const WEEKDAYS = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
  const weekdayOf = (b) => WEEKDAYS[new Date(b.at).getDay()];
  const SPLITS = [['kind', 'Art', betKind], ['mkt', 'Wette', marketOf], ['odds', 'Quote', bandOf], ['stake', 'Einsatz', stakeBand], ['lg', 'Liga', leagueOf], ['team', 'Team', teamsKey], ['wd', 'Wochentag', weekdayOf]];
  function groupBets(list, key) {
    const m = new Map();
    list.forEach((b) => {
      const ks = key(b);
      (Array.isArray(ks) ? ks : [ks]).forEach((k) => {
        const x = m.get(k) || { k, n: 0, won: 0, c: 0, st: 0 };
        x.n++;
        x.won += b.status === 'won' ? 1 : 0;
        x.c += betCents(b);
        x.st += stakeC(b);
        m.set(k, x);
      });
    });
    return [...m.values()];
  }
  function splitRows(list) {
    const sp = SPLITS.find((s) => s[0] === B.split) || SPLITS[0];
    let rows = groupBets(list, sp[2]);
    if (sp[0] === 'team') rows = rows.filter((r) => r.n >= 2); // Teams mit nur einer Wette sagen wenig
    rows.sort((a, b) => b.c - a.c);
    if (!rows.length) return `<p class="sr-e">${sp[0] === 'team' ? 'Noch kein Team mit mindestens zwei Wetten in diesem Zeitraum.' : 'Keine Angaben.'}</p>`;
    const mx = Math.max(1, ...rows.map((r) => Math.abs(r.c)));
    const shown = rows.length > 12 ? rows.slice(0, 6).concat(rows.slice(-6)) : rows; // viele Gruppen: die 6 besten und die 6 schlechtesten
    return shown.map((r, i) => `<div class="sr-row"><div class="sr-t"><b>${esc(r.k)}</b><span>${r.won} von ${r.n} gewonnen${r.st ? ` · pro 10 €: ${pm(r.c, per10(r.c, r.st))}` : ''}</span></div><b class="sr-v ${plusMinus(r.c / 100)}">${signed(r.c / 100)}</b><div class="sr-bar"><i class="${r.c < 0 ? 'neg' : 'pos'}" style="--i:${i};transform:scaleX(${(Math.abs(r.c) / mx).toFixed(3)})"></i></div></div>`).join('');
  }
  // „Das fällt auf“: nur was die eigenen Zahlen wirklich hergeben (je Gruppe mindestens 3 Wetten)
  function insightsHtml(list) {
    const out = [];
    const usable = (key, min) => groupBets(list, key).filter((r) => r.n >= (min || 3) && !/^(Sonstige|Ohne Liga|Mehrere Ligen|ohne Quote)$/.test(r.k));
    const mkt = usable(marketOf).sort((a, b) => b.c - a.c);
    if (mkt.length && mkt[0].c >= 100) out.push(`Am besten läuft bei dir <b>${esc(mkt[0].k)}</b>: ${pm(mkt[0].c, signed(mkt[0].c / 100))} aus ${nBets(mkt[0].n)}.`);
    const worst = mkt[mkt.length - 1];
    if (mkt.length && worst.c <= -100) out.push(`Am meisten kostet dich <b>${esc(worst.k)}</b>: ${pm(worst.c, signed(worst.c / 100))} aus ${nBets(worst.n)}.`);
    const kind = usable(betKind);
    const e = kind.find((r) => r.k === 'Einzel');
    const k = kind.find((r) => r.k === 'Kombi');
    if (e && k && e.st && k.st) out.push(`Pro 10 € Einsatz bringen dir Einzelwetten ${pm(e.c, per10(e.c, e.st))}, Kombis ${pm(k.c, per10(k.c, k.st))}.`);
    const odds = usable(bandOf, 4).filter((r) => r.st).sort((a, b) => b.c / b.st - a.c / a.st);
    if (odds.length >= 2 && odds[0].c > 0) out.push(`Am meisten bringen dir Quoten <b>${esc(odds[0].k)}</b>: ${pm(odds[0].c, per10(odds[0].c, odds[0].st))} pro 10 € Einsatz.`);
    const wd = usable(weekdayOf).sort((a, b) => b.c - a.c);
    if (wd.length >= 2 && wd[0].c >= 100) out.push(`Dein stärkster Wett-Tag ist der <b>${esc(wd[0].k)}</b>: ${pm(wd[0].c, signed(wd[0].c / 100))}.`);
    if (!out.length) return '';
    const note = list.length < 30 ? `<p class="ins-n">Bei ${nBets(list.length)} spielt der Zufall noch eine große Rolle.</p>` : '';
    return `<section class="sec ov-ins"><div class="sec-h"><h2>Das fällt auf</h2></div><div class="card ins">${out.slice(0, 4).map((t) => `<p>${t}</p>`).join('')}${note}</div></section>`;
  }
  // Rekorde: über alle abgerechneten Wetten
  function recordsHtml() {
    const all = betsFrom(-Infinity);
    if (all.length < 3) return '';
    const items = [];
    const won = all.filter((b) => b.status === 'won');
    const hiQ = won.filter((b) => b.q).sort((a, b) => b.q - a.q)[0];
    if (hiQ) items.push(['Höchste Quote gewonnen', nf2.format(hiQ.q), `${betTitle(hiQ)} · ${fmtDate(settleT(hiQ))}`]);
    const big = all.slice().sort((a, b) => betCents(b) - betCents(a))[0];
    if (big && betCents(big) > 0) items.push(['Größter Gewinn', signed(betPL(big)), `${betTitle(big)} · ${fmtDate(settleT(big))}`]);
    const kombi = won.filter((b) => b.legs.length > 1).sort((a, b) => (b.legs.length - a.legs.length) || ((b.q || 0) - (a.q || 0)))[0];
    if (kombi) items.push(['Größte gewonnene Kombi', `${kombi.legs.length} Tipps`, `${kombi.q ? `Quote ${nf2.format(kombi.q)} · ` : ''}${fmtDate(settleT(kombi))}`]);
    let run = 0;
    let best = 0;
    let bestEnd = null;
    all.forEach((b) => { run = b.status === 'won' ? run + 1 : 0; if (run > best) { best = run; bestEnd = b; } });
    if (best >= 2) items.push(['Längste Siegesserie', `${best} Siege`, `bis ${fmtDate(settleT(bestEnd))}`]);
    const days = [...dayBook().values()].filter((x) => x.n).sort((a, b) => b.c - a.c);
    if (days.length && days[0].c > 0) items.push(['Bester Tag', signed(days[0].c / 100), `${dayShort(days[0].t)} · ${nBets(days[0].n)}`]);
    const months = new Map();
    all.forEach((b) => { const k = ymOf(settleT(b)); months.set(k, (months.get(k) || 0) + betCents(b)); });
    const bm = [...months.entries()].sort((a, b) => b[1] - a[1])[0];
    if (bm && bm[1] > 0 && months.size > 1) { const y = Math.floor(bm[0] / 12); items.push(['Bester Monat', signed(bm[1] / 100), new Date(y, bm[0] - y * 12, 1).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })]); }
    if (!items.length) return '';
    return `<section class="sec ov-rec"><div class="sec-h"><h2>Rekorde</h2><span class="note">seit Beginn</span></div><div class="card recs">${items.map(([l, v, s]) => `<div class="rc-row"><span class="rc-i">${I.trophy}</span><span class="grow"><b>${esc(l)}</b><span>${esc(s)}</span></span><b class="rc-v">${esc(v)}</b></div>`).join('')}</div></section>`;
  }
  // Knapp daneben: Kombis, die an genau einem Tipp gescheitert sind
  function nearHtml(list) {
    const near = list.filter((b) => b.status === 'lost' && b.legs.length > 1 && !b.system && b.win).filter((b) => {
      const s = b.legs.map(legState);
      return s.filter((x) => x === 'lost').length === 1 && s.every((x) => x === 'won' || x === 'lost' || x === 'void');
    });
    if (!near.length) return '';
    const sum = near.reduce((a, b) => a + winC(b), 0);
    const rows = near.slice(-3).reverse().map((b) => {
      const bad = b.legs.find((l) => legState(l) === 'lost');
      return `<button class="li" data-act="betview" data-id="${esc(b.id)}"><span class="mk lost">${I.x}</span><span class="grow"><b>${esc(betTitle(b))}</b><span>${esc(`gescheitert an: ${legPick(bad)}${legTeams(bad) ? ` (${legTeams(bad)})` : ''}`)}</span></span><span class="li-v">${eur(winC(b) / 100)}</span></button>`;
    }).join('');
    return `<section class="sec ov-near"><div class="sec-h"><h2>Knapp daneben</h2></div><p class="nr-t">${near.length === 1 ? 'Eine Kombi ist' : `${near.length} Kombis sind`} an nur einem Tipp gescheitert – ${near.length === 1 ? 'sie hätte' : 'zusammen hätten sie'} <b>${eur(sum / 100)}</b> ausgezahlt.</p><div class="lst">${rows}</div></section>`;
  }
  function statsBody() {
    const from = periodFrom();
    const list = betsFrom(from);
    if (!list.length) return `<div class="empty"><span class="em-ic">${I.chart}</span><b>Noch nichts abgerechnet</b><p>In diesem Zeitraum ist noch keine Wette abgerechnet. Danach stehen hier deine Zahlen: Gewinn pro 10 € Einsatz, Serien, Rekorde und wo du gewinnst.</p></div>${recordsHtml()}`;
    const plC = list.reduce((a, b) => a + betCents(b), 0);
    const stC = list.reduce((a, b) => a + stakeC(b), 0);
    const won = list.filter((b) => b.status === 'won').length;
    const lost = list.filter((b) => b.status === 'lost').length;
    const cash = list.filter((b) => b.status === 'cash').length;
    const withQ = list.filter((b) => b.q);
    const avgQ = withQ.length ? withQ.reduce((a, b) => a + b.q, 0) / withQ.length : null;
    const maxQ = withQ.length ? Math.max(...withQ.map((b) => b.q)) : null;
    let cur = 0;
    let curR = null;
    let best = 0;
    let run = 0;
    let cum = 0;
    let peak = 0;
    let dd = 0;
    list.forEach((b) => {
      const r = b.status === 'won' ? 'w' : b.status === 'lost' ? 'l' : 'c';
      run = r === 'w' ? run + 1 : 0;
      best = Math.max(best, run);
      if (curR === r) cur++; else { curR = r; cur = 1; }
      cum += betCents(b);
      peak = Math.max(peak, cum);
      dd = Math.max(dd, peak - cum);
    });
    const curTxt = curR === 'w' ? `${cur} ${cur === 1 ? 'Sieg' : 'Siege'}` : curR === 'l' ? `${cur} ${cur === 1 ? 'Niederlage' : 'Niederlagen'}` : `${cur} Cashout${cur === 1 ? '' : 's'}`;
    const tile = (l, v, sub, c) => `<div class="kpi"><span>${l}</span><b class="${c || ''}">${v}</b>${sub ? `<small>${sub}</small>` : ''}</div>`;
    // vier Zahlen statt acht – Gewinn und Verlust stehen schon groß in der Karte darüber
    const kpis = tile('Pro 10 € Einsatz', per10(plC, stC), plC >= 0 ? 'kamen im Schnitt dazu' : 'gingen im Schnitt verloren', plusMinus(plC))
      + tile('Gewonnen', `${won} von ${list.length}`, [lost ? `${lost} verloren` : '', cash ? `${cash} Cashout` : ''].filter(Boolean).join(' · ') || 'alle gewonnen')
      + tile('Ø Quote', avgQ ? nf2.format(avgQ) : 'k. A.', maxQ ? `höchste: ${nf2.format(maxQ)}` : 'keine Quote bekannt')
      + tile('Größter Rückgang', dd ? `−${eur(dd / 100)}` : eur(0), 'vom Höchststand aus', dd ? 'down' : '');
    const last10 = list.slice(-10);
    const form = `<div class="card fcard"><div class="f-h"><b>Form</b><span>gerade ${esc(curTxt)} · längste Siegesserie ${best}</span></div><div class="fstrip">${last10.map((b) => `<i class="${b.status === 'won' ? 'w' : b.status === 'lost' ? 'l' : 'c'}" title="${esc(betTitle(b))}">${b.status === 'won' ? I.check : b.status === 'lost' ? I.x : '€'}</i>`).join('')}</div></div>`;
    const { unit, bk } = bucketize(list, from);
    const lastK = bk.slice().reverse().find((x) => x.n) || bk[bk.length - 1];
    return `<div class="kpis">${kpis}</div>${form}
      <section class="sec ov-bars"><div class="sec-h"><h2>Gewinn je ${{ day: 'Tag', week: 'Woche', month: 'Monat' }[unit]}</h2></div><div class="card"><p class="bc-read">${bucketRead(lastK, unit)}</p>${barChart(bk, unit)}</div></section>
      <section class="sec ov-split"><div class="sec-h"><h2>Wo du gewinnst</h2></div><div class="card"><div class="chips sp-chips">${SPLITS.map(([v, l]) => `<button class="${B.split === v ? 'on' : ''}" data-act="bsplit" data-val="${v}">${l}</button>`).join('')}</div><div class="srs${B.anim ? ' in' : ''}">${splitRows(list)}</div></div></section>
      ${insightsHtml(list)}
      ${nearHtml(list)}
      ${recordsHtml()}`;
  }
  function vStats() {
    const html = `<h1 class="ptitle">Statistik</h1><div class="ovg">${hero('pl')}<div class="hbody ovw">${statsBody()}</div></div>
      <p class="foot">Gezählt werden abgerechnete Wetten, stornierte nicht. Keine Prozente – nur Euro und Anzahlen.<br>${RG_TEXT}</p>`;
    B.anim = null;
    return html;
  }

  // ------------------------------------------------------------------ Kasse
  function ledgerHtml(lg) {
    const from = periodFrom();
    const rows = lg.ev.filter((e) => e.v !== 0 && e.t >= from).reverse();
    if (!rows.length) return '';
    const NAMES = { stake: 'Einsatz', won: 'Gewinn ausgezahlt', void: 'Einsatz zurück', cash: 'Cashout', in: 'Einzahlung', out: 'Auszahlung', fix: 'Korrektur' };
    const ICON = { stake: ['ticket', 'open'], won: ['check', 'won'], void: ['back', 'void'], cash: ['cash', 'cash'], in: ['dl', 'won'], out: ['ul', 'open'], fix: ['pen', 'open'] };
    const shown = B.more ? rows.slice(0, 200) : rows.slice(0, 6);
    const row = (e) => {
      const [ic, cls] = ICON[e.k] || ['receipt', 'open'];
      const when = e.k === 'stake' || e.k === 'in' || e.k === 'out' || e.k === 'fix' ? fmtWhen(e.t) : fmtDate(e.t);
      return `<div class="li lgr"><span class="mk ${cls}">${I[ic]}</span><span class="grow"><b>${NAMES[e.k] || 'Buchung'}</b><span>${esc([when, e.txt].filter(Boolean).join(' · '))}</span></span><span class="lgv"><b class="${plusMinus(e.v)}">${signed(e.v)}</b>${e.bal != null ? `<span>${eur(e.bal)}</span>` : ''}</span></div>`;
    };
    return `<section class="sec ov-led"><div class="sec-h"><h2>Kontoauszug</h2><span class="note">${esc(PERIOD_TXT[B.period])}</span></div><div class="lst">${shown.map(row).join('')}</div>${rows.length > 6 ? `<button class="more" data-act="lgmore">${B.more ? 'Weniger anzeigen' : `Alle ${rows.length} anzeigen`}</button>` : ''}</section>`;
  }
  // Geldfluss seit dem ersten Eintragen: Start + Einzahlungen − Auszahlungen ± Wetten (± Korrekturen) = Kontostand jetzt
  function flowCard(lg) {
    if (!lg.st) return '';
    const w = store.get('wallet', {}) || {};
    const ws = walletState();
    const after = (m) => m.t > lg.st.t;
    const D = (w.moves || []).filter((m) => after(m) && m.v > 0).reduce((a, m) => a + cents(m.v), 0);
    const Wd = -(w.moves || []).filter((m) => after(m) && m.v < 0).reduce((a, m) => a + cents(m.v), 0);
    const F = (w.fixes || []).reduce((a, f) => a + cents(f.v), 0);
    const R = lg.ev.filter((e) => e.bal != null && !['in', 'out', 'fix'].includes(e.k)).reduce((a, e) => a + cents(e.v), 0);
    const row = (l, v, cls) => `<div class="fl-r${cls ? ' ' + cls : ''}"><span>${l}</span><b class="${cls === 'sum' ? '' : plusMinus(v / 100)}">${cls === 'sum' || cls === 'start' ? eur(v / 100) : signed(v / 100)}</b></div>`;
    return `<section class="sec ov-flow"><div class="sec-h"><h2>Geldfluss</h2><span class="note">seit ${esc(fmtDate(lg.st.t))}</span></div><div class="card flow">
      ${row('Start', cents(lg.st.v), 'start')}${row('Eingezahlt', D)}${row('Ausgezahlt', -Wd)}${row('Wetten', R)}${F ? row('Korrekturen', F) : ''}${row('Kontostand jetzt', cents(ws.balance), 'sum')}
      <p class="fl-n">${R >= 0 ? `Mit Wetten hast du seit dem Start ${pm(R, signed(R / 100))} gemacht.` : `Mit Wetten hast du seit dem Start ${pm(R, signed(R / 100))} gemacht – das ist Geld, das weg ist.`}${Wd ? ` Ausgezahlt hast du dir ${eur(Wd / 100)}.` : ''}</p></div></section>`;
  }
  function moneyBody() {
    const lg = ledger();
    return flowCard(lg) + limitsCard() + ledgerHtml(lg);
  }
  function vMoney() {
    const has = hasWallet();
    const html = `<h1 class="ptitle">Kasse</h1><div class="ovg">${hero('bal')}
      ${has ? `<div class="mact"><button data-act="wallet" data-val="move"><span>${I.dl}</span>Einzahlen</button><button data-act="wallet" data-val="move"><span>${I.ul}</span>Auszahlen</button><button data-act="wallet" data-val="base"><span>${I.pen}</span>Korrigieren</button><button data-act="limits"><span>${I.shield}</span>Limits</button></div>` : ''}
      <div class="hbody ovw">${moneyBody()}</div></div>
      <p class="foot">Der Kontostand hier ist deine eigene Rechnung – verbindlich ist der bei deinem Wettanbieter.<br>${RG_TEXT}</p>`;
    B.anim = null;
    return html;
  }

  // ------------------------------------------------------------------ Kalender: Plus und Minus je Tag, Monat wischen, Tag antippen
  const ymOf = (t) => { const d = new Date(t); return d.getFullYear() * 12 + d.getMonth(); };
  const calKey = (d) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  function dayBook() {
    const m = new Map();
    settledBets().forEach((b) => {
      const t = settleT(b);
      const k = calKey(new Date(t));
      const x = m.get(k) || { k, t, c: 0, n: 0, won: 0, stake: 0, list: [] };
      x.c += betCents(b);
      x.list.push(b);
      if (b.status !== 'void') { x.n++; x.stake += stakeC(b); x.won += b.status === 'won' ? 1 : 0; }
      m.set(k, x);
    });
    return m;
  }
  function openBook() {
    const m = new Map();
    betsAll().filter((b) => b.status === 'open').forEach((b) => {
      const t = firstKick(b);
      if (!Number.isFinite(t)) return;
      const k = calKey(new Date(t));
      m.set(k, (m.get(k) || []).concat(b));
    });
    return m;
  }
  // kurz genug für eine Kalender-Zelle: +12,50 · +123 · +1,2k
  function compactC(c) {
    const v = Math.abs(c) / 100;
    const s = c > 0 ? '+' : c < 0 ? '−' : '';
    if (v >= 9999.5) return `${s}${Math.round(v / 1000)}k`;
    if (v >= 999.5) return `${s}${(v / 1000).toFixed(1).replace('.', ',')}k`;
    if (v >= 99.5) return `${s}${Math.round(v)}`;
    return s + (Number.isInteger(v) ? String(v) : v.toFixed(2).replace('.', ','));
  }
  function calFirst() {
    const list = settledBets();
    const nowYm = ymOf(Date.now());
    return list.length ? Math.min(nowYm, ymOf(settleT(list[0]))) : nowYm;
  }
  function calHtml() {
    const book = dayBook();
    const opens = openBook();
    const nowYm = ymOf(Date.now());
    if (B.cal == null || B.cal > nowYm) B.cal = nowYm;
    const ym = B.cal;
    const y = Math.floor(ym / 12);
    const mo = ym - y * 12;
    const nDays = new Date(y, mo + 1, 0).getDate();
    const lead = (new Date(y, mo, 1).getDay() + 6) % 7;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const rows = [];
    for (let d = 1; d <= nDays; d++) { const x = book.get(`${y}-${mo}-${d}`); if (x) rows.push(Object.assign({ d }, x)); }
    const total = rows.reduce((a, r) => a + r.c, 0);
    const n = rows.reduce((a, r) => a + r.n, 0);
    const won = rows.reduce((a, r) => a + r.won, 0);
    const stake = rows.reduce((a, r) => a + r.stake, 0);
    const max = Math.max(1, ...rows.map((r) => Math.abs(r.c)));
    const plus = rows.filter((r) => r.c > 0);
    const minus = rows.filter((r) => r.c < 0);
    const bestD = plus.length ? plus.reduce((a, r) => (r.c > a.c ? r : a)) : null;
    const worstD = minus.length ? minus.reduce((a, r) => (r.c < a.c ? r : a)) : null;
    const cell = (d) => {
      const date = new Date(y, mo, d);
      const key = `${y}-${mo}-${d}`;
      const x = book.get(key);
      const op = opens.get(key);
      const lv = x && x.c ? Math.max(1, Math.ceil(Math.sqrt(Math.abs(x.c) / max) * 4)) : 0;
      const cls = ['cd', x ? (x.c > 0 ? `p${lv}` : x.c < 0 ? `n${lv}` : 'z') : '', date > today ? 'fu' : '', +date === +today ? 'now' : '', B.calDay === d ? 'sel' : ''].filter(Boolean).join(' ');
      const inner = `<span class="cd-d">${d}</span>${op ? '<i class="cd-o"></i>' : ''}${x ? `<span class="cd-v">${x.c ? esc(compactC(x.c)) : '±0'}</span>` : ''}`;
      const label = `${date.toLocaleDateString('de-DE', { day: 'numeric', month: 'long' })}: ${x ? `${signed(x.c / 100)}, ${x.list.length} ${x.list.length === 1 ? 'Wette' : 'Wetten'}` : ''}${op ? `${x ? ', ' : ''}${op.length} offen` : ''}`;
      return x || op ? `<button class="${cls}" data-act="calday" data-val="${d}" aria-label="${esc(label)}">${inner}</button>` : `<div class="${cls}">${inner}</div>`;
    };
    let cells = '';
    for (let i = 0; i < lead; i++) cells += '<div class="cd blank"></div>';
    for (let d = 1; d <= nDays; d++) cells += cell(d);
    const tile = (l, v, s, c) => `<div class="kpi"><span>${l}</span><b class="${c || ''}">${v}</b><small>${s}</small></div>`;
    const tiles = rows.length ? `<div class="kpis cal-kpis">${tile('Tage im Plus', plus.length, `von ${rows.length} mit Wetten`)}${tile('Tage im Minus', minus.length, `von ${rows.length} mit Wetten`)}${bestD ? tile('Bester Tag', signed(bestD.c / 100), esc(dayShort(bestD.t)), 'up') : ''}${worstD ? tile('Schlechtester Tag', signed(worstD.c / 100), esc(dayShort(worstD.t)), 'down') : ''}</div>` : '';
    return `<section class="card cal-c">
        <div class="cal-h"><button class="cal-nav" data-act="calgo" data-val="-1" aria-label="Voriger Monat"${ym <= calFirst() ? ' disabled' : ''}>‹</button><b class="cal-m">${esc(new Date(y, mo, 1).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' }))}</b><button class="cal-nav" data-act="calgo" data-val="1" aria-label="Nächster Monat"${ym >= nowYm ? ' disabled' : ''}>›</button></div>
        <div class="cal-big ${plusMinus(total / 100)}">${signed(total / 100)}</div>
        <div class="cal-sub">${n ? `${n} ${n === 1 ? 'Wette' : 'Wetten'} · ${won} gewonnen${stake ? ` · pro 10 € Einsatz: ${pm(total, per10(total, stake))}` : ''}` : 'Keine Wette in diesem Monat ausgewertet'}</div>
        <div class="cal-wd">${['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map((w) => `<span>${w}</span>`).join('')}</div>
        <div class="cal-swipe"><div class="cal-grid">${cells}</div></div>
        <p class="cal-leg"><i class="cd p3"></i>Plus<i class="cd n3"></i>Minus<em>Je kräftiger, desto mehr Geld</em></p>
      </section>${tiles}<div class="cal-det">${calDetail(y, mo, rows, book, opens)}</div>${yearStrip(book, ym, nowYm)}`;
  }
  function calDetail(y, mo, rows, book, opens) {
    if (B.calDay) {
      const key = `${y}-${mo}-${B.calDay}`;
      const x = book.get(key);
      const op = opens.get(key) || [];
      const t = new Date(y, mo, B.calDay).getTime();
      const items = (x ? x.list.slice().reverse().map((b) => betLine(b, catOf(b), true)) : []).concat(op.map(openLine)).join('');
      return `<section class="sec"><div class="sec-h"><h2>${esc(dayLong(t))}</h2>${x ? `<span class="sv ${plusMinus(x.c / 100)}">${signed(x.c / 100)}</span>` : ''}</div><div class="lst">${items}</div><button class="more" data-act="calday" data-val="0">Ganzen Monat anzeigen</button></section>`;
    }
    if (!rows.length) return '';
    return `<section class="sec"><div class="sec-h"><h2>Alle Tage</h2></div><div class="group">${rows.slice().reverse().map((r) => `<button class="row cal-r" data-act="calday" data-val="${r.d}"><span class="grow"><div class="t">${esc(dayLong(r.t))}</div><div class="s">${r.list.length} ${r.list.length === 1 ? 'Wette' : 'Wetten'}${r.n ? ` · ${r.won} gewonnen` : ''}</div></span><b class="sv ${plusMinus(r.c / 100)}">${signed(r.c / 100)}</b><span class="chev">›</span></button>`).join('')}</div></section>`;
  }
  const monthC = (c) => { const v = Math.abs(c) / 100; return `${c > 0 ? '+' : '−'}${v >= 999.5 ? `${(v / 1000).toFixed(1).replace('.', ',')}k` : Math.round(v)}`; };
  function yearStrip(book, ym, nowYm) {
    const months = [];
    for (let k = nowYm - 11; k <= nowYm; k++) months.push({ k, c: 0, n: 0 });
    book.forEach((x) => { const m = months.find((mm) => mm.k === ymOf(x.t)); if (m) { m.c += x.c; m.n += x.n; } });
    if (!months.some((m) => m.n)) return '';
    const max = Math.max(1, ...months.map((m) => Math.abs(m.c)));
    const total = months.reduce((a, m) => a + m.c, 0);
    const first = calFirst();
    return `<section class="sec"><div class="sec-h"><h2>Letzte 12 Monate</h2><span class="sv ${plusMinus(total / 100)}">${signed(total / 100)}</span></div><div class="card cal-yr">${months.map((m, i) => {
      const y = Math.floor(m.k / 12);
      const d = new Date(y, m.k - y * 12, 1);
      const h = m.c ? Math.max(6, Math.round((Math.abs(m.c) / max) * 100)) : 0;
      const on = m.k === ym ? ' on' : '';
      const lab = d.toLocaleDateString('de-DE', { month: 'narrow' });
      const bar = h ? `<i class="${m.c > 0 ? 'p' : 'n'}" style="--h:${h / 100};--i:${i}"></i>` : '';
      return m.k < first ? `<span class="cy off"><span class="cy-p"></span><span class="cy-l">${lab}</span><span class="cy-v"></span></span>`
        : `<button class="cy${on}" data-act="calmonth" data-val="${m.k}" aria-label="${esc(d.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' }))}: ${esc(signed(m.c / 100))}"><span class="cy-p">${bar}</span><span class="cy-l">${lab}</span><span class="cy-v ${plusMinus(m.c / 100)}">${m.c ? monthC(m.c) : ''}</span></button>`;
    }).join('')}</div></section>`;
  }
  // Monat wechseln: dir = 1 nach vorn, −1 zurück; ym = direkt zu einem Monat
  function calShift(dir, ym) {
    const pg = curPage();
    const el = pg && $('.cal', pg.el);
    const nowYm = ymOf(Date.now());
    const cur = B.cal == null ? nowYm : B.cal;
    const next = ym != null ? ym : cur + dir;
    if (!el || next > nowYm || next < calFirst() || next === cur) return false;
    B.cal = next;
    B.calDay = null;
    el.innerHTML = calHtml();
    pg.el._geo = null;
    if (reduce) return true;
    const d = (dir || (next > cur ? 1 : -1)) * 46;
    const grid = $('.cal-grid', el);
    if (grid) grid.animate([{ transform: `translateX(${d}px)`, opacity: 0 }, { transform: 'translateX(0)', opacity: 1 }], { duration: 300, easing: 'cubic-bezier(.2,.8,.2,1)' });
    const sum = [$('.cal-m', el), $('.cal-big', el), $('.cal-sub', el)];
    sum.forEach((x) => x && replay(x, 'fadein'));
    return true;
  }
  // Tag antippen: Zelle markieren, darunter die Wetten dieses Tages
  function calPick(d) {
    const pg = curPage();
    const el = pg && $('.cal', pg.el);
    if (!el) return;
    B.calDay = d === B.calDay ? null : d || null;
    $$('.cal-grid .cd', el).forEach((c) => { const v = +((c.dataset && c.dataset.val) || 0); c.classList.toggle('sel', !!B.calDay && v === B.calDay); });
    const ym = B.cal;
    const y = Math.floor(ym / 12);
    const mo = ym - y * 12;
    const book = dayBook();
    const rows = [];
    for (let k = 1; k <= 31; k++) { const x = book.get(`${y}-${mo}-${k}`); if (x) rows.push(Object.assign({ d: k }, x)); }
    const det = $('.cal-det', el);
    det.innerHTML = calDetail(y, mo, rows, book, openBook());
    replay(det, 'fadein');
    pg.el._geo = null;
  }

  // ------------------------------------------------------------------ Wette eintragen / bearbeiten / Wettschein ergänzen (ein Blatt von unten)
  // Tipps kommen aus dem Spielplan (dann prüft Wettbuch nach dem Abpfiff selbst) oder werden frei eingetragen (dann rechnest du selbst ab).
  const isoDay = (t) => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
  // Datum aus dem Blatt → Zeitpunkt: gleicher Tag wie vorher = alter Zeitpunkt, heute = jetzt, sonst 12 Uhr an dem Tag
  function atFromDay(day, at0) {
    if (at0 && isoDay(at0) === day) return at0;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day || '') || day === isoDay(Date.now())) return Date.now();
    const t = new Date(+day.slice(0, 4), +day.slice(5, 7) - 1, +day.slice(8, 10), 12).getTime();
    return Number.isFinite(t) ? Math.min(t, Date.now()) : Date.now();
  }
  // wann das Geld floss: nach dem letzten Spiel (wenn bekannt), sonst beim Setzen – nie in der Zukunft
  const doneFor = (b) => { const k = lastKick(b); return Math.min(Date.now(), Math.max(b.at, k ? k + 2 * 36e5 : b.at)); };
  const QUICK = [['H', '1'], ['D', 'X'], ['A', '2'], ['HD', '1X'], ['DA', 'X2'], ['HA', '12'], ['O15', 'Über 1,5'], ['O25', 'Über 2,5'], ['O35', 'Über 3,5'],
    ['U15', 'Unter 1,5'], ['U25', 'Unter 2,5'], ['U35', 'Unter 3,5'], ['BY', 'Beide treffen'], ['BN', 'Nicht beide'], ['x', 'Andere Wette']];
  function openBetSheet(o) {
    if ($('.sheet')) return;
    B.draft = Object.assign({ src: 'manual', legs: [], q: null, qSet: false, stake: null, win: null, winSrc: 'auto', free: false, status: 'open', cash: null,
      bookie: 'Tipico', old: false, day: isoDay(Date.now()), view: 'main', leg: null, gq: '' }, o);
    if (!B.draft.legs.length) startLeg();
    sheet('', 'bet-panel', 'Wette');
    drawDraft();
    if (!G.data) loadGames().catch(() => {}).then(() => { if (B.draft && B.draft.view === 'leg' && $('.gres')) $('.gres').innerHTML = gameList(B.draft.gq, 'lgame'); });
  }
  function editBet(id) {
    const b = betsAll().find((x) => x.id === id);
    if (!b) return;
    const auto = !!(b.q && b.win && round2(b.q * b.stake) === b.win);
    openBetSheet({ id: b.id, src: b.src, legs: b.legs.map((l) => Object.assign({}, l)), q: b.q, qSet: true, stake: b.stake, win: b.win, winSrc: auto ? 'auto' : 'user',
      free: !!b.free, status: b.status, cash: b.cash != null ? b.cash : null, bookie: b.bookie || '', old: !!b.old, day: isoDay(b.at), at0: b.at,
      title: b.title || null, system: b.system || null, key: b.key || null, betId: b.betId || null });
  }
  function startLeg() {
    const d = B.draft;
    d.leg = {};
    d.gq = '';
    d.view = 'leg';
  }
  function drawDraft() {
    const sh = $('.sheet');
    const d = B.draft;
    if (!sh || !d) return;
    const p = $('.panel', sh);
    p.innerHTML = '<div class="grip" data-grip></div>' + (d.view === 'leg' ? legEditor(d) : draftMain(d));
    p.scrollTop = 0;
    if (d.view === 'main') updateWin();
  }
  // Auszahlung bei Gewinn: selbst eingetragen > laut Wettschein (solange Einsatz und Quote gleich sind) > Einsatz × Quote
  function draftWin(d) {
    if (d.winSrc === 'user') return d.win;
    if (d.winSrc === 'slip' && d.win0 && d.stake === d.stake0 && d.q === d.q0) return d.win0;
    return d.q && d.stake ? round2(d.q * d.stake) : null;
  }
  function updateWin() {
    const sh = $('.sheet');
    const d = B.draft;
    if (!sh || !d || d.view !== 'main') return;
    const inp = $('[data-act="bwin"]', sh);
    const src = $('.bs-src', sh);
    const w = draftWin(d);
    const slip = d.winSrc === 'slip' && d.win0 && d.stake === d.stake0 && d.q === d.q0;
    if (inp && d.winSrc !== 'user') inp.value = w ? nf2.format(w) : '';
    if (src) src.textContent = d.winSrc === 'user' ? 'selbst eingetragen' : slip ? 'laut Wettschein' : w ? 'Einsatz × Quote' : '';
    const fr = $('.bf-free', sh);
    if (fr) fr.textContent = d.free && w ? `Gratiswette: bei Gewinn bekommst du ${eur(Math.max(0, w - (d.stake || 0)))} (ohne Einsatz).` : '';
  }
  // Gesamtquote aus den Tipps, solange niemand selbst eine eingetragen hat
  function autoQ(d) {
    if (d.qSet || d.system) return;
    d.q = d.legs.length && d.legs.every((l) => l.q) ? round2(d.legs.reduce((a, l) => a * l.q, 1)) : d.legs.length === 1 ? d.legs[0].q || d.q : d.q;
  }
  function trackNote(d) {
    if (d.system) return 'Systemwetten rechnest du selbst ab – Wettbuch kennt die Gewinnstufen nicht.';
    const n = d.legs.filter((l) => l.g && l.m).length;
    if (!n) return 'Ob die Wette aufgegangen ist, trägst du später unter „Wetten“ ein. Wählst du das Spiel aus dem Spielplan, prüft Wettbuch nach dem Abpfiff selbst.';
    return n === d.legs.length ? 'Wettbuch prüft die Spiele nach dem Abpfiff selbst und rechnet die Wette ab. Du kannst sie jederzeit auch von Hand abrechnen.'
      : `Wettbuch prüft ${n} von ${d.legs.length} Tipps selbst. Geht einer davon verloren, ist die Wette automatisch verloren – sonst rechnest du am Ende selbst ab.`;
  }
  function draftMain(d) {
    const title = d.id ? 'Wette bearbeiten' : d.src === 'scan' ? 'Wettschein ergänzen' : 'Wette eintragen';
    const legs = d.legs.map((l, i) => legRow(l, `<button class="bl-x" data-act="legdel" data-i="${i}" aria-label="Tipp entfernen">${I.x}</button>`)).join('');
    const sts = [['open', 'Offen'], ['won', 'Gewonnen'], ['lost', 'Verloren'], ['cash', 'Cashout'], ['void', 'Storniert']];
    const qPh = d.legs.length > 1 ? 'Gesamtquote' : 'z. B. 1,85';
    return `<h2>${title}</h2>${d.note ? `<p class="bf-note" style="margin:-6px 4px 12px">${esc(d.note)}</p>` : ''}
      <div class="lab">${d.system ? `SYSTEM ${esc(d.system)} · ${d.legs.length} TIPPS` : d.legs.length > 1 ? `KOMBI · ${d.legs.length} TIPPS` : 'TIPP'}</div>
      ${d.legs.length ? `<div class="bf-legs">${legs}</div>` : ''}
      <button class="bf-add" data-act="legadd">${I.plus}<span>${d.legs.length ? 'Noch ein Tipp (Kombi)' : 'Tipp hinzufügen'}</span></button>
      <div class="bf-grid"><label class="bf"><span>Quote</span><input type="text" inputmode="decimal" data-act="bq" value="${d.q ? nf2.format(d.q) : ''}" placeholder="${qPh}" autocomplete="off"></label>
        <label class="bf"><span>Einsatz in €</span><input type="text" inputmode="decimal" data-act="bstake" value="${d.stake ? nf2.format(d.stake) : ''}" placeholder="z. B. 5" autocomplete="off"></label></div>
      <div class="chips bf-chips">${[2, 5, 10, 20, 50].map((v) => `<button data-act="bchip" data-val="${v}">${v} €</button>`).join('')}</div>
      <label class="bf wide"><span>Auszahlung bei Gewinn <em class="bs-src"></em></span><input type="text" inputmode="decimal" data-act="bwin" value="${d.winSrc === 'user' && d.win ? nf2.format(d.win) : ''}" placeholder="–" autocomplete="off"></label>
      <label class="tgl"><input type="checkbox" data-act="bfree"${d.free ? ' checked' : ''}><span class="tg-t"><b>Gratiswette</b><span>Den Einsatz hat der Anbieter bezahlt</span></span><i class="tg-s" aria-hidden="true"></i></label>
      <p class="bf-note bf-free"></p>
      <div class="lab" style="margin-top:14px">STAND</div>
      <div class="chips bf-st">${sts.map(([v, l]) => `<button class="${d.status === v ? 'on' : ''}" data-act="bstatus" data-val="${v}">${l}</button>`).join('')}</div>
      ${d.status === 'cash' ? `<label class="bf wide"><span>Ausgezahlter Betrag in €</span><input type="text" inputmode="decimal" data-act="bcash" value="${d.cash != null ? nf2.format(d.cash) : ''}" placeholder="z. B. 7,20" autocomplete="off"></label>` : ''}
      <div class="bf-grid"><label class="bf"><span>Anbieter</span><input type="text" data-act="bbookie" maxlength="30" value="${esc(d.bookie || '')}" placeholder="z. B. Tipico" autocomplete="off"></label>
        <label class="bf"><span>Gesetzt am</span><input type="date" data-act="bday" value="${esc(d.day)}" max="${isoDay(Date.now())}"></label></div>
      ${hasWallet() ? `<label class="tgl"><input type="checkbox" data-act="bold"${d.old ? ' checked' : ''}><span class="tg-t"><b>Schon im Kontostand</b><span>${d.old ? 'Zählt nur in der Statistik, dein Kontostand bleibt, wie er ist.' : 'Einsatz und Auszahlung werden mit deinem Kontostand verrechnet.'}</span></span><i class="tg-s" aria-hidden="true"></i></label>` : ''}
      <p class="bf-note">${esc(trackNote(d))}</p>
      <button class="btn" data-act="betsave">Speichern</button>`;
  }
  function legEditor(d) {
    const l = d.leg;
    const h = l.home || 'Heim';
    const a = l.away || 'Gast';
    const game = l.g
      ? `<div class="lg-sel"><span class="duo">${crest(l.home, 30, true)}${crest(l.away, 30, true)}</span><span class="grow"><b>${esc(l.home)} – ${esc(l.away)}</b><span>${esc([l.comp, l.t ? kickoff(l.t) : ''].filter(Boolean).join(' · '))}</span></span><button class="link" data-act="lgclear">Ändern</button></div>`
      : `<input class="search" type="search" data-act="gsearch" value="${esc(d.gq || '')}" placeholder="Team suchen, z. B. BVB" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" enterkeyhint="search" aria-label="Spiel suchen">
        <div class="gres">${gameList(d.gq || '', 'lgame')}</div>
        <label class="bf wide"><span>Nicht dabei? Spiel selbst eintragen</span><input type="text" data-act="levent" maxlength="80" value="${esc(l.event || '')}" placeholder="z. B. Dortmund – Bayern" autocomplete="off"></label>`;
    return `<h2>Tipp hinzufügen</h2><div class="lab">SPIEL</div>${game}
      <div class="lab" style="margin-top:16px">WETTE</div>
      <div class="chips lg-chips">${QUICK.map(([c, t]) => `<button class="${l.code === c ? 'on' : ''}" data-act="lpick" data-val="${c}">${t}</button>`).join('')}</div>
      ${l.code === 'x' ? `<label class="bf wide"><span>Worauf hast du gewettet?</span><input type="text" data-act="lother" maxlength="80" value="${esc(l.other || '')}" placeholder="z. B. Kane trifft, Ecken über 9,5" autocomplete="off"></label>`
        : l.code ? `<p class="lg-what">${esc(tipLabel(l.code, h, a))}</p>` : ''}
      <label class="bf wide"><span>Quote dieses Tipps (wenn du sie weißt)</span><input type="text" inputmode="decimal" data-act="lq" value="${l.q ? nf2.format(l.q) : ''}" placeholder="z. B. 1,85" autocomplete="off"></label>
      <div class="bf-2 bf-2w"><button class="btn soft" data-act="legback">${d.legs.length ? 'Zurück' : 'Abbrechen'}</button><button class="btn" data-act="legok">Tipp übernehmen</button></div>`;
  }
  function legOk() {
    const d = B.draft;
    const l = d && d.leg;
    if (!l) return;
    if (!l.code) { toast('Bitte wählen, worauf du gewettet hast.'); return; }
    const ev = String(l.event || '').trim();
    if (!l.g && !ev && l.code !== 'x') { toast('Bitte ein Spiel wählen oder selbst eintragen.'); return; }
    // selbst eingetragenes Spiel „Dortmund – Bayern“: Namen für die Anzeige („Sieg Dortmund“)
    const two = !l.g && ev ? ev.split(/\s+[-–—:]\s+|\s+vs\.?\s+|\s+gegen\s+/i) : [];
    const home = l.g ? l.home : two.length === 2 ? two[0].trim() : null;
    const away = l.g ? l.away : two.length === 2 ? two[1].trim() : null;
    let pick;
    let m;
    if (l.code === 'x') {
      pick = String(l.other || '').trim();
      if (!pick) { toast('Bitte eintragen, worauf du gewettet hast.'); return; }
      m = pickCode({ pick }, home, away);
    } else {
      m = l.code;
      pick = tipLabel(l.code, home || 'Heim', away || 'Gast');
    }
    const leg = { g: l.g || null, slug: l.slug || null, t: l.t || null, comp: l.comp || null, home, away, event: l.g || two.length === 2 ? null : ev || null, m: m || null, pick, q: l.q || null, res: null };
    d.legs.push(leg);
    autoQ(d);
    d.leg = null;
    d.view = 'main';
    drawDraft();
  }
  function saveDraft() {
    const d = B.draft;
    if (!d) return;
    if (!d.legs.length) { toast('Bitte mindestens einen Tipp eintragen.'); return; }
    const win = draftWin(d);
    if (!d.stake || d.stake <= 0 || d.stake > 1e6) { toast('Bitte deinen Einsatz eintragen.'); return; }
    if (d.q != null && (d.q < 1.01 || d.q > 1e6)) { toast('Diese Quote passt nicht (z. B. 1,85).'); return; }
    if (!d.q && !win) { toast('Bitte die Quote oder die Auszahlung eintragen.'); return; }
    if (d.status === 'cash' && (d.cash == null || d.cash < 0)) { toast('Bitte den ausgezahlten Betrag eintragen.'); return; }
    const all = betsAll();
    const old = d.id ? all.find((x) => x.id === d.id) : null;
    if (d.id && !old) { closeSheet(); return; }
    const before = old ? { status: old.status, cash: old.cash } : null;
    const b = Object.assign(old || { id: newId('b'), src: d.src, key: d.key || null, betId: d.betId || null }, {
      at: atFromDay(d.day, d.at0), title: d.title || null, legs: d.legs, q: d.q ? round2(d.q) : null, stake: round2(d.stake), win: win ? round2(win) : null,
      free: d.free || undefined, status: d.status, cash: d.status === 'cash' ? round2(d.cash) : undefined, bookie: String(d.bookie || '').trim() || null,
      old: d.old || undefined, system: d.system || undefined, teams: teamsOf(d.legs) });
    if (d.status === 'open') { b.done = null; b.manual = false; }
    else if (!before || before.status !== d.status || before.cash !== b.cash || !b.done) { b.done = doneFor(b); b.manual = true; }
    if (!old) all.unshift(b);
    betsSave(all);
    B.draft = null;
    closeSheet();
    haptic();
    toast(old ? 'Gespeichert' : trackable(b) ? 'Gespeichert · Wettbuch prüft nach dem Abpfiff' : 'Wette gespeichert');
    refreshBets();
    if (trackable(b)) setTimeout(() => checkBets(), 400);
  }

  // ------------------------------------------------------------------ Kontostand, Ein-/Auszahlungen, Limits
  const LOOKS = [['uv', 'Schwarz-Weiß'], ['fire', 'Inferno'], ['gold', 'Gold'], ['ice', 'Ozean']];
  const looksHtml = () => { const cur = store.get('mlook', 'uv'); return `<div class="lab" style="margin-top:24px">FARBE DER KARTE</div><div class="looks">${LOOKS.map(([v, l]) => `<button class="lk${cur === v ? ' on' : ''}" data-act="mlook" data-val="${v}"><i class="lk-${v}"></i><span>${l}</span></button>`).join('')}</div>`; };
  function openWalletSheet(focus) {
    if ($('.sheet')) return;
    const ws = walletState();
    const sh = sheet(`<h2>Kontostand</h2><div class="lab">KONTOSTAND JETZT – SO WIE BEI DEINEM WETTANBIETER</div>
      <input class="search" type="text" inputmode="decimal" data-act="wbase" value="${ws.balance != null ? nf2.format(ws.balance) : ''}" placeholder="z. B. 50,00" autocomplete="off">
      <button class="btn" data-act="wsave" data-mode="base" style="margin-top:10px">${ws.balance != null ? 'Kontostand korrigieren' : 'Übernehmen'}</button>
      <div class="lab" style="margin-top:24px">EINZAHLUNG ODER AUSZAHLUNG</div>
      <input class="search" type="text" inputmode="decimal" data-act="wmove" placeholder="Betrag, z. B. 20" autocomplete="off">
      <div class="bf-2"><button class="btn soft" data-act="wsave" data-mode="in">Einzahlen</button><button class="btn soft" data-act="wsave" data-mode="out">Auszahlen</button></div>
      <p class="bf-note">Ab dann rechnet Wettbuch selbst weiter: Jede neue Wette zieht den Einsatz ab, jeder Gewinn und jeder Cashout kommt dazu, eine stornierte Wette gibt den Einsatz zurück.</p>${looksHtml()}${ws.balance != null ? '<button class="bf-reset" data-act="wreset">Kontostand zurücksetzen</button>' : ''}`, 'bet-panel', 'Kontostand');
    const f = focus && $(focus === 'move' ? '[data-act="wmove"]' : '[data-act="wbase"]', sh);
    if (f) f.focus();
  }
  // Kontostand von vorne: Betrag, Ein-/Auszahlungen und Kurve weg. Wetten und Statistik bleiben.
  function walletResetAsk() {
    const p = $('.sheet .panel');
    if (!p) return;
    p.innerHTML = `<div class="grip" data-grip></div><h2>Kontostand zurücksetzen?</h2>
      <p class="bf-note" style="font-size:15px">Dein Kontostand, deine Ein- und Auszahlungen und die Kurve in der Kasse werden gelöscht. Deine Wetten und die Statistik bleiben. Das lässt sich nicht rückgängig machen.</p>
      <button class="btn danger" data-act="wresetgo">Ja, zurücksetzen</button><button class="btn soft" data-act="close" style="margin-top:8px">Abbrechen</button>`;
  }
  function walletReset() {
    store.set('wallet', {});
    closeSheet();
    haptic();
    toast('Kontostand zurückgesetzt');
    refreshBets();
  }
  function saveWallet(mode) {
    const sh = $('.sheet');
    if (!sh) return;
    const w = store.get('wallet', {}) || {};
    if (mode === 'base') {
      const v = dec($('[data-act="wbase"]', sh).value);
      if (v == null || v < 0 || v > 1e8) { toast('Bitte einen Betrag eintragen.'); return; }
      const now = Date.now();
      const nv = round2(v);
      if (typeof w.base === 'number') {
        if (!w.start) w.start = { t: w.at || 0, v: w.base };
        const diff = round2(nv - walletState().balance);
        if (diff) (w.fixes = w.fixes || []).push({ t: now, v: diff });
      } else w.start = { t: now, v: nv };
      Object.assign(w, { base: nv, at: now, moves: w.moves || [] });
    } else {
      const v = dec($('[data-act="wmove"]', sh).value);
      if (!v || v <= 0 || v > 1e8) { toast('Bitte einen Betrag eintragen.'); return; }
      if (typeof w.base !== 'number') { toast('Trag zuerst oben deinen Kontostand ein.'); return; }
      (w.moves = w.moves || []).push({ t: Date.now(), v: mode === 'in' ? round2(v) : -round2(v) });
    }
    store.set('wallet', w);
    closeSheet();
    haptic();
    if (mode === 'in') toast(`Eingezahlt: ${eur(dec($('[data-act="wmove"]', sh).value))}`);
    refreshBets();
  }
  function openLimitSheet() {
    if ($('.sheet')) return;
    const L = store.get('limits', {}) || {};
    sheet(`<h2>Limits</h2><p class="bf-note" style="margin:-6px 4px 14px">Leg fest, wie viel du höchstens einsetzen, verlieren oder einzahlen willst. Wettbuch zeigt dir, wie viel noch frei ist, und sagt Bescheid, wenn ein Limit erreicht ist. Leer lassen = kein Limit.</p>
      ${LIMITS.map(([k, name]) => `<label class="bf wide"><span>${esc(name)} in €</span><input type="text" inputmode="decimal" data-lim="${k}" value="${typeof L[k] === 'number' ? nf2.format(L[k]) : ''}" placeholder="kein Limit" autocomplete="off"></label>`).join('')}
      <button class="btn" data-act="limsave">Speichern</button>
      <p class="bf-note">Verbindliche Limits (Einzahlung, Verlust, Pausen) stellst du direkt bei deinem Wettanbieter ein. Die hier sind deine eigene Übersicht.</p>`, 'bet-panel', 'Limits');
  }
  function saveLimits() {
    const sh = $('.sheet');
    if (!sh) return;
    const out = {};
    let bad = false;
    $$('[data-lim]', sh).forEach((inp) => {
      const raw = inp.value.trim();
      if (!raw) return;
      const v = dec(raw);
      if (v == null || v <= 0 || v > 1e7) bad = true; else out[inp.dataset.lim] = round2(v);
    });
    if (bad) { toast('Bitte nur Beträge eintragen (oder leer lassen).'); return; }
    store.set('limits', out);
    closeSheet();
    haptic();
    toast(Object.keys(out).length ? 'Limits gespeichert' : 'Keine Limits gesetzt');
    refreshBets();
  }
  // Sicherung: alle Wetten als Tabelle (CSV, öffnet sich z. B. in Numbers oder Excel)
  function exportCsv() {
    const list = betsAll();
    if (!list.length) { toast('Noch keine Wetten gespeichert.'); return; }
    const n2 = (v) => (v == null ? '' : nf2.format(v));
    const when = (t) => (t ? new Date(t).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '');
    const rows = [['Gesetzt', 'Abgerechnet', 'Stand', 'Art', 'Tipps', 'Quote', 'Einsatz', 'Gratiswette', 'Auszahlung', 'Ergebnis', 'Anbieter']];
    list.slice().sort((x, y) => x.at - y.at).forEach((b) => {
      rows.push([when(b.at), when(b.done), ST_NAME[b.status] || b.status, betKind(b), b.legs.map((l) => [legTeams(l), legPick(l), l.q ? `(${nf2.format(l.q)})` : ''].filter(Boolean).join(' ')).join(' | '),
        n2(b.q), n2(b.stake), b.free ? 'ja' : '', b.status === 'open' ? '' : n2(backC(b) / 100), b.status === 'open' ? '' : n2(betPL(b)), b.bookie || '']);
    });
    const csv = '﻿' + rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `wettbuch-${isoDay(Date.now())}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  // ------------------------------------------------------------------ Start (Niklas, 11.11.2026: „viel cleaner und aufgeräumter“): große Konto-Karte,
  // zwei Knöpfe (Scannen, Eintragen), offene Wetten und die letzten Ergebnisse – sonst nichts
  function weekStats() {
    const now = new Date();
    const wk = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7)).getTime();
    const list = betsFrom(wk);
    return { pl: sumPL(list), n: list.length, won: list.filter((b) => b.status === 'won').length };
  }
  // kleine Kurve des Kontostands (letzte 30 Tage) – zeichnet sich beim Auftritt einmal von links nach rechts
  function sparkHtml(pts) {
    if (pts.length < 2) return '';
    const W = 340;
    const H = 64;
    const P = 6;
    const vs = pts.map((p) => p.v);
    let lo = Math.min(...vs);
    let hi = Math.max(...vs);
    if (hi - lo < 0.01) { lo -= 1; hi += 1; }
    const t0 = pts[0].t;
    const t1 = pts[pts.length - 1].t;
    const xs = [];
    pts.forEach((p, i) => xs.push(i ? Math.max(((p.t - t0) / Math.max(1, t1 - t0)) * (W - 8), xs[i - 1] + 0.02) : 0));
    const ys = vs.map((v) => P + (1 - (v - lo) / (hi - lo)) * (H - 2 * P));
    const ms = monoSlopes(xs, ys);
    let d = `M${f1(xs[0])} ${f1(ys[0])}`;
    for (let i = 0; i < xs.length - 1; i++) {
      const h = (xs[i + 1] - xs[i]) / 3;
      d += `C${f1(xs[i] + h)} ${f1(ys[i] + ms[i] * h)} ${f1(xs[i + 1] - h)} ${f1(ys[i + 1] - ms[i + 1] * h)} ${f1(xs[i + 1])} ${f1(ys[i + 1])}`;
    }
    const lx = xs[xs.length - 1];
    return `<svg class="spk" viewBox="0 0 ${W} ${H}" aria-hidden="true"><defs><linearGradient id="spk-g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="currentColor" stop-opacity=".22"/><stop offset="1" stop-color="currentColor" stop-opacity="0"/></linearGradient><clipPath id="spk-c"><rect class="spk-r" width="${W}" height="${H}"/></clipPath></defs>
      <g clip-path="url(#spk-c)"><path d="${d}L${f1(lx)} ${H}L0 ${H}Z" fill="url(#spk-g)"/><path class="spk-l" d="${d}"/></g><circle class="spk-d" cx="${f1(lx)}" cy="${f1(ys[ys.length - 1])}" r="4"/></svg>`;
  }
  function walletCard() {
    const ws = walletState();
    const look = esc(store.get('mlook', 'uv'));
    const foot = `<span class="mh-open"><span><span>Im Spiel</span><b>${eur(ws.open)}</b></span><span><span>Mögl. Gewinn</span><b>${eur(ws.openWin)}</b></span><span><span>Offen</span><b>${ws.nOpen}</b></span></span>`;
    if (ws.balance == null) {
      return `<section class="mh wc none" data-look="${look}"><div class="mh-top"><span class="eyebrow">Kontostand</span></div><p class="mh-empty">Trag ein, wie viel gerade auf deinem Wettkonto ist – dann rechnet Wettbuch jeden Einsatz, Gewinn und Cashout mit.</p><button class="btn" data-act="wallet" data-val="base">Kontostand eintragen</button>${ws.nOpen ? foot : ''}</section>`;
    }
    const wk = weekStats();
    const chip = wk.n ? `<span class="mh-chg ${plusMinus(wk.pl)}">${esc(signed(wk.pl))}</span><span class="mh-w">diese Woche · ${wk.won} von ${wk.n} gewonnen</span>` : '<span class="mh-w">diese Woche noch nichts abgerechnet</span>';
    return `<section class="mh wc" data-look="${look}" data-act="tab" data-tab="/money" role="button" tabindex="0" aria-label="Kasse öffnen">
      <span class="mh-top"><span class="eyebrow">Kontostand</span><span class="wc-go">${I.chev}</span></span>
      <span class="mh-n" data-cu="${round2(ws.balance)}" data-sg="0">${moneyHtml(ws.balance)}</span>
      <span class="mh-d">${chip}</span>${sparkHtml(slicePts(walletPts(ledger()), Date.now() - 30 * 864e5))}${foot}</section>`;
  }
  const HOW = [[I.scan, 'Scannen', 'Screenshot vom Wettschein oder von „Meine Wetten“ – Wettbuch liest Einsatz, Quote und Tipps.'],
    [I.check, 'Abwarten', 'Nach dem Abpfiff prüft Wettbuch die Spiele selbst und rechnet die Wette ab.'],
    [I.chart, 'Überblick', 'Kasse, Statistik und Kalender zeigen, wo du stehst – in Euro, ohne Prozente.']];
  function vHome() {
    const bets = betsAll();
    const open = bets.filter((b) => b.status === 'open').sort((x, y) => (firstKick(x) - firstKick(y)) || (y.at - x.at));
    const last = settledBets().slice(-4).reverse();
    const qa = `<div class="qa"><label class="qa-b pri">${I.scanF}<span>Scannen</span><input type="file" accept="image/*" data-act="scanpic" aria-label="Wettschein scannen"></label><button class="qa-b" data-act="newbet">${I.plus}<span>Eintragen</span></button></div>`;
    const openSec = !bets.length ? '' : `<section class="sec h-open"><div class="sec-h"><h2>Offen${open.length ? ` <span class="cnt">${open.length}</span>` : ''}</h2>${open.length ? '<button class="link" data-act="betsgo" data-val="open">Alle</button>' : ''}</div>
      ${open.length ? `<div class="lst">${open.slice(0, 3).map(openLine).join('')}${open.length > 3 ? `<button class="li li-more" data-act="betsgo" data-val="open">Alle ${open.length} offenen Wetten${I.chev}</button>` : ''}</div>` : '<p class="h-none">Gerade keine Wette offen.</p>'}</section>`;
    const lastSec = last.length ? `<section class="sec h-last"><div class="sec-h"><h2>Zuletzt</h2><button class="link" data-act="betsgo" data-val="done">Alle</button></div><div class="lst">${last.map((b) => betLine(b, betKind(b))).join('')}</div></section>` : '';
    const how = bets.length ? '' : `<section class="sec h-how"><div class="sec-h"><h2>So geht's</h2></div><div class="lst">${HOW.map(([ic, t, s], i) => `<div class="li"><span class="li-ic s${i}">${ic}</span><span class="grow"><b>${t}</b><span class="wrap2">${s}</span></span></div>`).join('')}</div></section>`;
    return `<section class="hello"><p>${esc(todayLong())}</p><h1>${esc(greet())}</h1></section>
      ${rgNotice()}${walletCard()}${qa}${openSec}${lastSec}${how}
      <p class="foot">${RG_TEXT}</p>`;
  }

  // ------------------------------------------------------------------ Wetten: Offen · Erledigt · Kalender
  const BTABS = ['open', 'done', 'cal'];
  const FILTERS = [['all', 'Alle'], ['won', 'Gewonnen'], ['lost', 'Verloren'], ['cash', 'Cashout'], ['void', 'Storniert']];
  const openSort = (x, y) => (firstKick(x) - firstKick(y)) || (y.at - x.at);
  // leerer Zustand: Symbol, Satz, Erklärung – auf Wunsch mit den Knöpfen Scannen und Eintragen
  const emptyHtml = (ic, t, sub, btns) => `<div class="empty big"><span class="em-ic">${ic}</span><b>${esc(t)}</b><p>${esc(sub)}</p>${btns ? `<div class="em-b"><label class="btn pri">${I.scanF}<span>Scannen</span><input type="file" accept="image/*" data-act="scanpic" aria-label="Wettschein scannen"></label><button class="btn soft" data-act="newbet">${I.plus}<span>Eintragen</span></button></div>` : ''}</div>`;
  // abgerechnete Wetten nach Tagen – jeder Tag ein eigener Block (.dday), am iPad liegen die Tage dicht nebeneinander
  function doneList(done) {
    const book = dayBook();
    let out = '';
    let day = '';
    done.forEach((b) => {
      const k = calKey(new Date(settleT(b)));
      if (k !== day) {
        const x = book.get(k);
        out += `${day ? '</div>' : ''}<div class="dday"><div class="dgrp"><span>${esc(dayLong(settleT(b)))}</span>${B.filter === 'all' && x ? `<b class="${plusMinus(x.c / 100)}">${signed(x.c / 100)}</b>` : ''}</div>`;
        day = k;
      }
      out += ticketCard(b);
    });
    return day ? `${out}</div>` : out;
  }
  function betsBody() {
    const bets = betsAll();
    if (B.tab === 'cal') return `<div class="cal">${calHtml()}</div>`;
    if (B.tab === 'open') {
      const open = bets.filter((b) => b.status === 'open').sort(openSort);
      if (!open.length) return emptyHtml(I.ticket, 'Keine Wette offen', 'Scanne deinen Wettschein oder trag eine Wette ein. Erkannte Spiele rechnet Wettbuch nach dem Abpfiff selbst ab – mit dem echten Endstand nach 90 Minuten.', true);
      const ws = walletState();
      return `<div class="osum"><div><span>Im Spiel</span><b>${eur(ws.open)}</b></div><div><span>Möglicher Gewinn</span><b>${eur(ws.openWin)}</b></div></div><div class="blist">${open.map(ticketCard).join('')}</div>`;
    }
    const all = bets.filter((b) => b.status !== 'open' && b.done).sort((x, y) => settleT(y) - settleT(x));
    if (!all.length) return emptyHtml(I.check, 'Noch nichts abgerechnet', 'Sobald eine Wette entschieden ist, steht sie hier – nach Tagen sortiert, mit Plus und Minus.');
    const cnt = (v) => (v === 'all' ? all.length : all.filter((b) => b.status === v).length);
    const chips = `<div class="chips bfilt">${FILTERS.filter(([v]) => v === 'all' || cnt(v)).map(([v, l]) => `<button class="${B.filter === v ? 'on' : ''}" data-act="bfilter" data-val="${v}">${l} <small>${cnt(v)}</small></button>`).join('')}</div>`;
    const done = B.filter === 'all' ? all : all.filter((b) => b.status === B.filter);
    const shown = B.doneAll ? done : done.slice(0, 40); // viele Karten auf einmal bremsen das iPhone
    return `${chips}<div class="blist dl">${done.length ? doneList(shown) : '<div class="empty">Keine Wette mit diesem Stand.</div>'}</div>${done.length > shown.length ? `<button class="more" data-act="bdmore">Alle ${done.length} anzeigen</button>` : ''}`;
  }
  function betsTab(v) {
    const pg = curPage();
    const seg = pg && $('.bseg', pg.el);
    const body = pg && $('.bbody', pg.el);
    if (B.tab === v) return;
    B.tab = v;
    if (!seg || !body) { redrawTop(); return; }
    seg.style.setProperty('--k', Math.max(0, BTABS.indexOf(v)));
    $$('button', seg).forEach((x) => x.classList.toggle('on', x.dataset.val === v));
    body.innerHTML = betsBody();
    stagger(revealItems(body)); // Karten kommen nacheinander herein
    pg.el._geo = null;
  }
  // nur den Inhalt unter den Reitern neu zeichnen (Filter, „Alle anzeigen“)
  function betsRedrawBody() {
    const pg = curPage();
    const body = pg && $('.bbody', pg.el);
    if (!body) { redrawTop(); return; }
    body.innerHTML = betsBody();
    pg.el._geo = null;
  }
  function vBets() {
    const bets = betsAll();
    const nOpen = bets.filter((b) => b.status === 'open').length;
    const nDone = bets.filter((b) => b.status !== 'open').length;
    const TABS_B = [['open', 'Offen', nOpen], ['done', 'Erledigt', nDone], ['cal', 'Kalender']];
    const k = Math.max(0, BTABS.indexOf(B.tab));
    return `<div class="ph"><h1 class="ptitle">Wetten</h1><span class="ph-a"><label class="round" aria-label="Wettschein scannen">${I.scan}<input type="file" accept="image/*" data-act="scanpic" aria-label="Wettschein scannen"></label><button class="round pri" data-act="newbet" aria-label="Wette eintragen">${I.plus}</button></span></div>
      <div class="seg s3 bseg" style="--k:${k}"><span class="ind"></span>${TABS_B.map(([v, l, n]) => `<button class="${B.tab === v ? 'on' : ''}" data-act="btab" data-val="${v}">${l}${n ? `<small>${n}</small>` : ''}</button>`).join('')}</div>
      <div class="bbody">${betsBody()}</div>
      <p class="foot">${RG_TEXT}</p>`;
  }

  // ------------------------------------------------------------------ KI-Zentrale: was im Hintergrund für dich arbeitet, mit Protokoll
  // Wettschein-Leser = Gemini auf dem Cloudflare-Server (liest nur ab) · Spielplan = scripts/games.py auf GitHub (alle 2 Stunden) ·
  // Abrechnung = hier in der App, ohne KI, mit den Endständen von ESPN · Zeitgeber = Cloudflare stößt den Spielplan an · Konten = Cloudflare-Datenbank
  const K = { open: {} };
  const kiAll = () => { const x = store.get('kilog', []); return Array.isArray(x) ? x : []; };
  function kiLog(kind, n, txt, det) {
    store.set('kilog', [{ id: newId('k'), at: Date.now(), kind, n: n || 0, txt: String(txt || '').slice(0, 160), det: det || null }].concat(kiAll()).slice(0, 120));
    refreshKib();
  }
  // Knopf oben rechts auf der Startseite: Punkt grün/orange/rot je nach Alter des Spielplans + heute selbst abgerechnete Wetten
  function kiBadge() {
    const t0 = dayStart(new Date());
    const n = kiAll().filter((e) => e.kind === 'settle' && e.at >= t0).reduce((a, e) => a + (e.n || 0), 0);
    return `<i class="kib-dot${G.data ? ' ' + freshness(G.data.updatedAt) : G.err ? ' bad' : ''}"></i><span>KI</span>${n ? `<b class="kib-n">+${n}</b>` : ''}`;
  }
  const refreshKib = () => $$('.kib').forEach((x) => { x.innerHTML = kiBadge(); });
  // Cloudflare-Server: erreichbar? Neuer Code? Zeitgeber und Konten eingerichtet? (nur Ja/Nein – die Schlüssel selbst sieht die App nie)
  const Z = { st: null, at: 0, loading: null };
  function loadServer() {
    if (Z.st && Date.now() - Z.at < 60e3) return Promise.resolve(Z.st);
    if (!Z.loading) {
      Z.loading = fetch(api() + '/', { cache: 'no-store' }).then((r) => r.json()).catch(() => ({ ok: false }))
        .then((d) => { Z.st = d; Z.at = Date.now(); return d; }).finally(() => { Z.loading = null; });
    }
    return Z.loading;
  }
  const newServer = () => !!(Z.st && Z.st.ok && Z.st.app === 'Wettbuch');
  function kickNow() {
    const code = String(store.get('invite', '') || '').trim();
    if (!code) { toast('Dafür brauchst du den Einladungscode (Einstellungen).'); return; }
    toast('Spielplan wird angestoßen …');
    fetch(api() + '/kick', { headers: { 'X-Invite': code } }).then((r) => r.json()).then((d) => toast(d.ok ? d.info : d.error || 'Das hat nicht geklappt.'))
      .catch(() => toast('Der Server ist gerade nicht erreichbar.'));
  }
  const VIA = { zeitgeber: 'vom Zeitgeber', github: 'von GitHub', hand: 'von Hand' };
  const KI_KIND = { scan: ['Wettschein gelesen', 'scan'], settle: ['Abgerechnet', 'check'], games: ['Spielplan', 'cal'] };
  function kiStatus() {
    const s = Z.st;
    const row = (ic, name, sub, st, txt) => `<div class="ks-row"><span class="ks-ic">${I[ic]}</span><span class="grow"><b>${name}</b><span>${esc(sub)}</span></span><span class="ks-st ${st}"><i></i>${txt}</span></div>`;
    const t0 = dayStart(new Date());
    const scans = kiAll().filter((e) => e.kind === 'scan');
    const lastScan = scans[0];
    // Wettschein-Leser
    let st = !s ? 'idle' : !s.ok ? 'bad' : !s.ki ? 'bad' : newServer() ? 'ok' : 'warn';
    let txt = !s ? 'wird geprüft …' : !s.ok ? 'nicht erreichbar' : !s.ki ? 'KI-Schlüssel fehlt' : newServer() ? 'bereit' : 'Update fehlt';
    const n0 = scans.filter((e) => e.at >= t0).length;
    let out = row('scan', 'Wettschein-Leser', `Gemini auf dem Cloudflare-Server · ${n0 ? `heute ${n0}× gelesen` : lastScan ? `zuletzt ${ago(lastScan.at)}` : 'noch kein Scan'}`, st, txt);
    // Spielplan
    const d = G.data;
    st = d ? freshness(d.updatedAt) : G.err ? 'bad' : 'idle';
    txt = d ? { ok: 'aktuell', warn: 'verspätet', bad: 'hängt' }[st] : G.err ? 'nicht erreichbar' : 'wird geladen …';
    out += row('cal', 'Spielplan', d ? `alle 2 Std. · ${d.games.length} Spiele aus ${Object.keys(d.leagues || {}).length} Wettbewerben · zuletzt ${ago(d.updatedAt)}` : 'alle 2 Std. · Spiele der letzten 5 und nächsten 16 Tage', st, txt);
    // Abrechnung
    const waiting = betsAll().filter(trackable).length;
    out += row('check', 'Abrechnung', `ohne KI, mit dem Endstand nach 90 Min. · ${waiting ? `${waiting} ${waiting === 1 ? 'Wette wartet' : 'Wetten warten'}` : 'nichts offen'}${CHK.at ? ` · zuletzt geprüft ${ago(CHK.at)}` : ''}`, CHK.err ? 'warn' : 'ok', CHK.err ? 'ESPN hakt' : 'läuft');
    // Zeitgeber
    st = !s ? 'idle' : !s.ok ? 'bad' : !newServer() ? 'warn' : s.zeitgeber ? 'ok' : 'warn';
    txt = !s ? 'wird geprüft …' : !s.ok ? 'nicht erreichbar' : !newServer() ? 'Update fehlt' : s.zeitgeber ? 'verbunden' : 'GitHub-Schlüssel fehlt';
    out += row('clock', 'Zeitgeber', 'Cloudflare · stößt den Spielplan an, wenn er älter als 3 Std. ist', st, txt);
    // Konten
    const a = authOf();
    st = !s ? 'idle' : !s.ok ? 'bad' : s.konten ? 'ok' : 'warn';
    txt = !s ? 'wird geprüft …' : !s.ok ? 'nicht erreichbar' : s.konten ? 'eingerichtet' : 'Datenbank fehlt';
    out += row('user', 'Konten', a ? `angemeldet als ${a.user} · Handy und iPad gleich` : 'Benutzername + Passwort, Daten auf Handy und iPad gleich', st, txt);
    const kick = newServer() && s.zeitgeber && d && freshness(d.updatedAt) !== 'ok' && store.get('invite', '')
      ? '<button class="btn soft ks-kick" data-act="kick">Spielplan jetzt aktualisieren</button>' : '';
    return out + kick;
  }
  function kiRunLine(e) {
    if (e.kind === 'games') return [`${e.games} Spiele aus ${e.leagues} Wettbewerben`, e.new != null ? `${e.new} neu` : '', e.done ? `${e.done} Endstände` : '', e.fail ? `${e.fail} ohne Antwort` : ''].filter(Boolean).join(' · ');
    return e.txt || '';
  }
  function kiDetails(e) {
    const li = (l, v) => `<div class="kd-r"><span>${esc(l)}</span><b>${esc(v)}</b></div>`;
    if (e.kind === 'games') return li('Dauer', `${e.sec || 0} Sekunden`) + li('Gestartet', VIA[e.via] || 'k. A.') + li('Wettbewerbe ohne Antwort', String(e.fail || 0));
    const d = e.det || {};
    if (e.kind === 'scan') {
      return (d.bookie ? li('Anbieter', d.bookie) : '') + li('Wetten erkannt', String(e.n)) + (d.legs != null ? li('Tipps einem Spiel zugeordnet', `${d.linked || 0} von ${d.legs}`) : '')
        + (d.model ? li('KI-Modell', d.model) : '') + (d.note ? `<p class="kd-n">${esc(d.note)}</p>` : '');
    }
    if (e.kind === 'settle') {
      return (d.bets || []).map((b) => `<div class="kd-b"><b>${esc(b.t)}</b><span class="${plusMinus(b.pl)}">${esc(b.st)} · ${esc(signed(b.pl))}</span>${(b.legs || []).map(([p, info, s]) => `<span class="kd-l ${s || ''}">${{ won: '✓', lost: '✗', void: '–' }[s] || '·'} ${esc(p)}${info ? ` · ${esc(info)}` : ''}</span>`).join('')}</div>`).join('');
    }
    return '';
  }
  function vKI() {
    const head = '<h1 class="ptitle">KI-Zentrale</h1><p class="psub">Was im Hintergrund für dich arbeitet – jeder Schritt wird hier protokolliert.</p>';
    const upd = Z.st && Z.st.ok && !newServer()
      ? '<div class="notice ki-upd"><b>Server-Update fehlt</b><p>Der Cloudflare-Server läuft noch mit dem alten Code. Scannen geht trotzdem, aber nur ein Wettschein pro Bild. Für ganze Listen („Meine Wetten“), den Spielplan-Zeitgeber und Konten muss der neue Code einmal bei Cloudflare eingefügt werden.</p></div>' : '';
    const logs = kiAll().map((e) => Object.assign({ t: new Date(e.at).toISOString(), key: e.id }, e));
    const runs = ((G.data && G.data.runs) || []).map((r) => Object.assign({ kind: 'games', key: 'g' + r.t }, r));
    const all = logs.concat(runs).sort((x, y) => (x.t < y.t ? 1 : -1));
    const t0 = dayStart(new Date());
    const at = (e) => new Date(e.t).getTime();
    const sum = (list, f) => list.reduce((x, e) => x + (f(e) || 0), 0);
    const today = all.filter((e) => at(e) >= t0);
    const week = all.filter((e) => at(e) >= t0 - 6 * 864e5);
    const tiles = [
      [sum(today.filter((e) => e.kind === 'scan'), () => 1), 'Scans heute', 'scan', 'v'],
      [sum(today.filter((e) => e.kind === 'scan'), (e) => e.n), 'Wetten erkannt heute', 'receipt', 'o'],
      [sum(week.filter((e) => e.kind === 'settle'), (e) => e.n), 'abgerechnet (7 Tage)', 'check', 'g'],
      [G.data ? G.data.games.length : 'k. A.', 'Spiele im Plan', 'cal', 'b'],
    ].map(([v, l, ic, c]) => `<div class="kt kt-${c}"><span class="kt-i">${I[ic]}</span><b>${v}</b><span>${l}</span></div>`).join('');
    // 7 Tage: Wetten, um die sich die KI gekümmert hat (gelesen + abgerechnet), darunter die Spielplan-Läufe
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const s0 = t0 - i * 864e5;
      const es = all.filter((e) => at(e) >= s0 && at(e) < s0 + 864e5);
      days.push({ s0, n: sum(es.filter((e) => e.kind !== 'games'), (e) => e.n), runs: es.filter((e) => e.kind === 'games').length });
    }
    const mx = Math.max(1, ...days.map((x) => x.n));
    const none = days.every((x) => !x.n); // leere Woche: Hinweis statt stummer Balken
    const chart = `<div class="kchart${none ? ' zero' : ''}">${days.map((x, i) => `<div class="kc-col${i === 6 ? ' now' : ''}"><span class="kc-v">${x.n || ''}</span><i style="height:${Math.max(4, Math.round((x.n / mx) * 92))}px"></i><span class="kc-l">${i === 6 ? 'Heute' : ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'][new Date(x.s0).getDay()]}</span><span class="kc-r">${x.runs}×</span></div>`).join('')}${none ? '<p class="kc-none">Diese Woche hat die KI noch keine Wette gelesen oder abgerechnet.</p>' : ''}</div>`;
    // Protokoll nach Tagen
    let log = '';
    let lastDay = '';
    all.slice(0, 120).forEach((e) => {
      const dk = new Date(e.t).toDateString();
      if (dk !== lastDay) { log += `${lastDay ? '</div>' : ''}<div class="kl-day">${esc(dayLong(at(e)))}</div><div class="group">`; lastDay = dk; }
      const open = K.open[e.key];
      const [name, ic] = KI_KIND[e.kind] || ['Aufgabe', 'spark'];
      const via = e.kind === 'games' && VIA[e.via] ? ` · ${VIA[e.via]}` : '';
      log += `<button class="row kl-row${open ? ' open' : ''}" data-act="kirun" data-k="${esc(e.key)}"><span class="kl-ic ${e.kind}">${I[ic]}</span><span class="grow"><div class="t">${name} <span class="kl-t">${hm(e.t)}${via}</span></div><div class="s">${esc(kiRunLine(e))}</div></span><span class="chev">›</span></button>${open ? `<div class="kl-det">${kiDetails(e)}</div>` : ''}`;
    });
    if (lastDay) log += '</div>';
    return head + `${upd}<div class="card ks" style="margin-top:18px">${kiStatus()}</div><div class="ktiles">${tiles}</div>
      <section class="sec"><div class="sec-h"><h2>Letzte 7 Tage</h2><span class="note">erledigte Wetten</span></div><div class="card">${chart}<p class="kc-cap">Balken = gelesene und selbst abgerechnete Wetten · darunter, wie oft der Spielplan lief</p></div></section>
      <section class="sec"><div class="sec-h"><h2>Protokoll</h2><span class="note">antippen für Einzelheiten</span></div>${log || '<div class="empty">Noch nichts protokolliert.</div>'}</section>
      <p class="foot">Die KI (Gemini) liest nur deine Screenshots ab. Abgerechnet wird ohne KI: mit den echten Endständen von ESPN, sobald die App nach dem Abpfiff offen ist. Deine Wetten bleiben auf deinem Gerät – mit Konto zusätzlich auf dem Cloudflare-Server, damit Handy und iPad gleich sind.</p>`;
  }

  // ------------------------------------------------------------------ Wettschein scannen (Niklas, 11.11.2026: „reine Tracking-App mit Scan-Funktion“)
  // Gemini auf dem Cloudflare-Server liest nur ab, was auf dem Screenshot steht – ein Schein oder die ganze Liste „Meine Wetten“.
  // Spiele zuordnen, rechnen und später abrechnen macht Wettbuch hier selbst, ohne KI. Was nicht zu sehen ist, bleibt „k. A.“.
  const SCAN_STEPS = ['Bild laden', 'Schein lesen', 'Spiele zuordnen', 'Fertig'];
  const sleep = (ms) => new Promise((r) => setTimeout(r, reduce ? 0 : ms));
  const SC = { file: null, url: null, token: null, fix: null };
  function vScanRun() {
    if (!SC.url) return `<h1 class="ptitle">Scan</h1><div class="empty" style="margin-top:18px">Kein Bild gewählt.</div><div class="scan-card" style="margin-top:12px">${scanBtns(true)}</div>`;
    return `<div class="scan-frame" id="frame"><img src="${SC.url}" alt="Dein Wettschein"><span class="beam"></span>
        <span class="corner tl"></span><span class="corner tr"></span><span class="corner bl"></span><span class="corner br"></span></div>
      <div class="steps">${SCAN_STEPS.map((t, i) => `<div class="step"><i>${i + 1}</i><span>${t}</span></div>`).join('')}</div>
      <div class="notice-slot"></div>`;
  }
  // /slip = neuer Server (alle Wetten auf dem Bild) · /bet = alter Server (ein Schein je Bild), solange der neue Code noch nicht bei Cloudflare ist
  async function askServer(image) {
    const post = async (path) => {
      const r = await fetch(api() + path, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Invite': String(store.get('invite', '') || '').trim() }, body: JSON.stringify({ image }) });
      return { status: r.status, d: await r.json().catch(() => null) };
    };
    let x = await post('/slip');
    if (x.status === 404) {
      x = await post('/bet');
      const b = x.d && x.d.ok && x.d.bet;
      if (b) {
        x.d.scan = { isBetSlip: !!b.isBetSlip, bookmaker: b.bookmaker || null, note: b.note || null, slips: b.isBetSlip ? [{ type: (b.legs || []).length > 1 ? 'combi' : 'single', system: null,
          status: b.status, stake: b.stake, totalOdds: b.totalOdds, potentialWin: b.potentialWin, cashout: null, freebet: false, placedAt: null, betId: null, legs: b.legs || [] }] : [] };
      }
    }
    return x;
  }
  // Abgehakt wird nur, was wirklich passiert ist
  async function runScan(el) {
    const fr = $('#frame', el);
    if (!fr || !SC.file) return;
    const token = (SC.token = {});
    const alive = () => SC.token === token && el.isConnected;
    const steps = $$('.step', el);
    const done = (i) => { steps[i].classList.remove('on'); steps[i].classList.add('done'); $('i', steps[i]).textContent = '✓'; if (steps[i + 1]) steps[i + 1].classList.add('on'); };
    const fail = (title, text, extra) => {
      if (!alive()) return;
      fr.classList.remove('scanning');
      $('.notice-slot', el).innerHTML = `<div class="notice"><b>${esc(title)}</b><p>${esc(text)}</p>
        <label class="btn">Anderes Bild wählen<input type="file" accept="image/*" data-act="scanpic" aria-label="Anderes Bild wählen"></label>${extra || '<button class="btn soft" data-act="newbet" style="margin-top:8px">Wette selbst eintragen</button>'}</div>`;
    };
    fr.classList.add('scanning');
    steps[0].classList.add('on');
    let image;
    try { image = await shrink(SC.file); } catch (e) { fail('Bild nicht lesbar', 'Dieses Bild konnte nicht geöffnet werden. Nimm am besten einen normalen Screenshot.'); return; }
    if (!alive()) return;
    done(0);
    let x = { status: 0, d: null };
    try { x = await askServer(image); } catch (e) { /* kein Netz */ }
    if (!alive()) return;
    const d = x.d;
    if (x.status === 401) { fail('Einladungscode passt nicht', (d && d.error) || 'Der Einladungscode fehlt oder ist falsch.', '<button class="btn soft" data-act="invagain" style="margin-top:8px">Code neu eingeben</button>'); return; }
    if (!d || !d.ok || !d.scan) { fail('Das hat nicht geklappt', (d && d.error) || 'Der KI-Server ist gerade nicht erreichbar. Prüf die Verbindung und versuch es noch mal.'); return; }
    if (!d.scan.isBetSlip || !(d.scan.slips || []).length) { fail('Kein Wettschein erkannt', 'Auf dem Bild hat die KI keine Wette gefunden. Nimm am besten einen Screenshot vom Wettschein oder von „Meine Wetten“ in deiner Wett-App.'); return; }
    done(1);
    await loadGames(60e3).catch(() => {});
    if (!alive()) return;
    const sc = saveScan(d.scan, d.model);
    await sleep(300);
    if (!alive()) return;
    done(2);
    await sleep(300);
    if (!alive()) return;
    done(3);
    fr.classList.remove('scanning');
    fr.classList.add('found');
    await sleep(380);
    if (alive()) location.replace('#/scan/res/' + encodeURIComponent(sc.id));
  }
  function startScan(file) {
    if (!file || (file.type && !/^image\//.test(file.type))) { toast('Das ist kein Bild.'); return; }
    const go = () => {
      if (SC.url) URL.revokeObjectURL(SC.url);
      SC.url = URL.createObjectURL(file);
      SC.file = file;
      if (curPath() === '/scan/run') { const p = S.stack[S.stack.length - 1]; p.el.innerHTML = barHtml('/scan/run') + `<div class="wrap" data-p="scan">${vScanRun()}</div>`; runScan(p.el); } else location.hash = '#/scan/run';
    };
    if (!String(store.get('invite', '') || '').trim()) inviteSheet(go); else go();
  }
  // Einfügen: Screenshot aus der Zwischenablage (iPhone: nach dem Screenshot „Kopieren“)
  async function scanPaste() {
    try {
      const items = await navigator.clipboard.read();
      for (const it of items) {
        const type = it.types.find((t) => /^image\//.test(t));
        if (type) { const blob = await it.getType(type); startScan(new File([blob], 'screenshot.' + (type.split('/')[1] || 'png'), { type })); return; }
      }
      toast('In der Zwischenablage ist kein Bild. Erst einen Screenshot kopieren.');
    } catch (e) { toast('Einfügen geht hier nicht – nimm „Fotos“.'); }
  }
  // Die KI hat ein begrenztes Gratis-Kontingent: einmal der Einladungscode, danach bleibt er gespeichert
  function inviteSheet(then) {
    if ($('.sheet')) return;
    S.afterInvite = then;
    const sh = sheet(`<h2>Einladungscode</h2>
      <p class="bf-note" style="margin-top:-6px">Den Wettschein liest eine KI mit begrenztem Gratis-Kontingent. Dafür brauchst du einmal deinen Code, den bekommst du von Niklas.</p>
      <input class="search" type="text" placeholder="Code eingeben" data-act="invcode" maxlength="40" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" enterkeyhint="done">
      <button class="btn" data-act="invgo" style="margin-top:12px">Weiter</button>`, '', 'Einladungscode');
    $('input', sh).focus();
  }
  async function inviteGo() {
    const sh = $('.sheet');
    const inp = sh && $('[data-act="invcode"]', sh);
    const code = inp ? inp.value.trim() : '';
    if (!code) { toast('Bitte den Code eintragen.'); return; }
    let ok = false;
    try { ok = (await fetch(api() + '/check', { headers: { 'X-Invite': code } })).ok; } catch (e) { toast('Der Server ist gerade nicht erreichbar.'); return; }
    if (!ok) { toast('Dieser Code passt nicht.'); return; }
    store.set('invite', code);
    const then = S.afterInvite;
    S.afterInvite = null;
    closeSheet();
    if (then) setTimeout(then, reduce ? 0 : 300);
  }

  // ------------------------------------------------------------------ Was die KI gelesen hat → Wetten mit zugeordneten Spielen
  const SLIP_ST = { open: 'open', won: 'won', lost: 'lost', void: 'void', cashout: 'cash' };
  // Datum ohne Uhrzeit: nur zum Suchen im Spielplan (Mitte des Tages), angezeigt wird es nicht
  const dateOnly = (s) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || '').trim()); return m ? new Date(+m[1], +m[2] - 1, +m[3], 15).toISOString() : null; };
  // Tipp → Spiel im Plan. Steht der Schein andersherum als im Plan (Gast zuerst), wird der Wett-Code gespiegelt.
  function linkTo(leg, r) {
    const H = resolveTeam(leg.rh);
    const A = resolveTeam(leg.ra);
    const flip = !!((H && H.id === r[4]) || (A && A.id === r[3])) && !((H && H.id === r[3]) || (A && A.id === r[4]));
    Object.assign(leg, legFromRow(r));
    const c = pickCode({ mk: leg.mk, pick: leg.pick }, leg.rh || (flip ? leg.away : leg.home), leg.ra || (flip ? leg.home : leg.away));
    leg.m = c ? (flip ? mirror(c) : c) : null;
    return leg;
  }
  function linkLeg(leg, settled, when) {
    if (!G.data || !leg.rh || !leg.ra) return leg;
    const H = resolveTeam(leg.rh);
    const A = resolveTeam(leg.ra);
    if (H) leg.home = reg(H);
    if (A) leg.away = reg(A);
    if (!H || !A || (settled && !when)) return leg; // altes Ergebnis ohne Datum: lieber kein Spiel als das falsche
    const r = findGame(H, A, leg.rh, leg.ra, when) || findGame(A, H, leg.ra, leg.rh, when);
    return r ? linkTo(leg, r) : leg;
  }
  function procLeg(l, settled) {
    const shot = ['won', 'lost', 'void'].includes(l.result) ? l.result : null;
    const leg = { g: null, slug: null, m: null, rh: l.home || null, ra: l.away || null, home: l.home || null, away: l.away || null, event: l.home && l.away ? null : l.event || null,
      comp: l.competition || null, t: kickIso(l.kickoff), mk: l.market || null, pick: l.pick || '?', q: l.odds || null, shot, res: null };
    // auf dem Schein schon entschieden (Haken, Kreuz): zählt so
    if (shot) leg.res = { won: shot === 'won', void: shot === 'void' || undefined, hs: Number.isInteger(l.scoreHome) ? l.scoreHome : null, as: Number.isInteger(l.scoreAway) ? l.scoreAway : null, shot: true };
    return linkLeg(leg, settled, leg.t || dateOnly(l.kickoff));
  }
  // Wiedererkennen: Wett-ID vom Schein, sonst Einsatz + Quote + Tipps
  const slipKey = (x) => `k:${x.stake || ''}|${x.q || ''}|${x.legs.map((l) => norm(`${l.rh || l.event || ''} ${l.ra || ''} ${l.pick}`)).sort().join('|')}`;
  function procSlip(s) {
    const st = SLIP_ST[s.status] || null; // null = Stand auf dem Bild nicht zu sehen
    const legs = (s.legs || []).map((l) => procLeg(l, !!st && st !== 'open'));
    const placed = kickIso(s.placedAt);
    const pt = placed ? new Date(placed).getTime() : null;
    const x = { type: s.type, system: s.type === 'system' ? s.system || 'k. A.' : null, st, stake: s.stake || null, q: s.totalOdds || null, win: s.potentialWin || null,
      cash: s.cashout != null ? s.cashout : null, free: !!s.freebet, at: pt && pt <= Date.now() ? pt : null, betId: s.betId || null, legs };
    x.key = slipKey(x);
    return x;
  }
  const scansAll = () => { const x = store.get('scans', []); return (Array.isArray(x) ? x : []).filter((s) => s && Array.isArray(s.slips)); }; // ältere Scans (Spiele statt Wetten) zeigt Wettbuch nicht
  const scanById = (id) => scansAll().find((s) => s.id === id) || null;
  function saveScan(x, model) {
    const slips = x.slips.map(procSlip);
    const legs = [].concat(...slips.map((s) => s.legs));
    const sc = { id: newId('s'), at: Date.now(), bookie: x.bookmaker || null, note: x.note || null, model: model || null, slips, teams: teamsOf(legs) };
    store.set('scans', [sc].concat(scansAll()).slice(0, 10));
    const linked = legs.filter((l) => l.g).length;
    kiLog('scan', slips.length, `${nBets(slips.length)} erkannt · ${linked} von ${legs.length} ${legs.length === 1 ? 'Tipp' : 'Tipps'} einem Spiel zugeordnet`,
      { bookie: sc.bookie, note: sc.note, model: sc.model, legs: legs.length, linked });
    redrawAll((p) => p === '/scan'); // „Zuletzt gescannt“ im Scan-Bereich
    return sc;
  }
  // Gibt es die Wette schon? new = neu · same = schon gespeichert · upd = gespeichert, aber der Schein zeigt einen anderen Stand
  function existingFor(x) {
    return betsAll().find((b) => (x.betId && b.betId ? norm(b.betId) === norm(x.betId) : b.key === x.key)) || null;
  }
  function dupOf(x) {
    const b = existingFor(x);
    if (!b) return { st: 'new' };
    if (!x.st || x.st === 'open' || (x.st === b.status && (x.st !== 'cash' || x.cash == null || round2(x.cash) === round2(b.cash || 0)))) return { st: 'same', b };
    return { st: 'upd', b };
  }
  const slipWin = (x) => x.win || (x.q && x.stake ? round2(x.q * x.stake) : null);
  const slipComplete = (x) => !!(x.stake > 0 && (x.q || x.win) && (x.st !== 'cash' || x.cash != null));
  // altes, schon abgerechnetes Ergebnis steckt meistens schon im Kontostand (außer der Schein ist nachweislich jünger)
  const slipOld = (x) => !!(x.st && x.st !== 'open' && hasWallet() && !(x.at && x.at > ((store.get('wallet', {}) || {}).at || 0)));
  const copyLegs = (legs) => legs.map((l) => Object.assign({}, l, { res: l.res ? Object.assign({}, l.res) : null }));
  function betFromSlip(sc, x) {
    const legs = copyLegs(x.legs);
    const st = x.st || 'open';
    const b = { id: newId('b'), src: 'scan', key: x.key, betId: x.betId || null, at: x.at || Date.now(), title: null, legs, q: x.q || null, stake: x.stake, win: slipWin(x),
      free: x.free || undefined, status: st, cash: st === 'cash' ? x.cash : undefined, bookie: sc.bookie || null, system: x.system || undefined, old: slipOld(x) || undefined, teams: teamsOf(legs) };
    b.done = st === 'open' ? null : doneFor(b);
    return b;
  }
  function takeSlip(id, i, force) {
    const sc = scanById(id);
    const x = sc && sc.slips[+i];
    if (!x || (!force && dupOf(x).st !== 'new')) return null;
    regTeams(sc);
    if (!slipComplete(x)) { fillSlip(id, i); return null; }
    const all = betsAll();
    const b = betFromSlip(sc, x);
    all.unshift(b);
    betsSave(all);
    return b;
  }
  function afterTake(list) {
    if (!list.length) return;
    haptic();
    const auto = list.filter(trackable).length;
    toast(list.length === 1 ? (auto ? 'Gespeichert · Wettbuch prüft nach dem Abpfiff' : 'Wette gespeichert') : `${list.length} Wetten gespeichert${auto ? ` · ${auto} prüft Wettbuch selbst` : ''}`);
    refreshBets();
    if (auto) setTimeout(() => checkBets(), 400);
  }
  function takeAll(id) {
    const sc = scanById(id);
    if (!sc) return;
    const got = [];
    sc.slips.forEach((x, i) => { if (dupOf(x).st === 'new' && slipComplete(x)) { const b = takeSlip(id, i, false); if (b) got.push(b); } });
    afterTake(got);
  }
  // Schein unvollständig (oder „Prüfen und ändern“): Blatt zum Ergänzen, schon ausgefüllt
  function fillSlip(id, i) {
    const sc = scanById(id);
    const x = sc && sc.slips[+i];
    if (!x) return;
    regTeams(sc);
    const st = x.st || 'open';
    const at = x.at || Date.now();
    const missing = [!x.stake ? 'Einsatz' : '', !x.q && !x.win ? 'Quote' : '', st === 'cash' && x.cash == null ? 'Cashout-Betrag' : ''].filter(Boolean);
    openBetSheet({ src: 'scan', key: x.key, betId: x.betId || null, legs: copyLegs(x.legs), q: x.q, qSet: !!x.q, stake: x.stake, win: null, win0: x.win, stake0: x.stake, q0: x.q,
      winSrc: x.win ? 'slip' : 'auto', free: x.free, status: st, cash: x.cash, bookie: sc.bookie || '', old: slipOld(x), day: isoDay(at), at0: at, system: x.system || null,
      note: missing.length ? `Auf dem Screenshot nicht zu sehen: ${missing.join(', ')}. Bitte ergänzen.` : (x.st ? 'Prüf kurz die Angaben und speichere.' : 'Der Stand war nicht zu sehen – bitte prüfen.') });
  }
  // Schein zeigt ein Ergebnis, die gespeicherte Wette ist noch offen (oder anders): Stand vom Schein übernehmen
  function updateFromSlip(id, i) {
    const sc = scanById(id);
    const x = sc && sc.slips[+i];
    const d = x && dupOf(x);
    if (!d || d.st !== 'upd') return;
    if (x.st === 'cash' && x.cash == null) { editBet(d.b.id); toast('Bitte den Cashout-Betrag eintragen.'); return; }
    const all = betsAll();
    const b = all.find((y) => y.id === d.b.id);
    if (!b) return;
    b.status = x.st;
    if (x.st === 'cash') b.cash = x.cash; else delete b.cash;
    if (!b.win && slipWin(x)) b.win = slipWin(x);
    x.legs.forEach((l, k) => { const bl = b.legs[k]; if (bl && l.res && !bl.res && norm(bl.pick) === norm(l.pick)) bl.res = Object.assign({}, l.res); });
    b.done = doneFor(b);
    b.manual = false;
    betsSave(all);
    haptic();
    toast(`Übernommen: ${ST_NAME[b.status]}${b.status === 'open' ? '' : ` · ${signed(betPL(b))}`}`);
    refreshBets();
  }
  // Spiel eines Tipps ändern (falsch oder gar nicht zugeordnet) – gilt auch für die schon gespeicherte Wette, solange sie offen ist
  function openLegFix(id, i, k) {
    const sc = scanById(id);
    const l = sc && sc.slips[+i] && sc.slips[+i].legs[+k];
    if (!l || $('.sheet')) return;
    SC.fix = { id, i: +i, k: +k };
    const q0 = l.rh || l.home || '';
    const shown = l.rh && l.ra ? `${l.rh} – ${l.ra}` : l.event || legTeams(l);
    sheet(`<h2>Spiel zuordnen</h2><p class="bf-note" style="margin:-6px 4px 12px">Auf dem Schein: ${esc([shown, l.pick].filter(Boolean).join(' · '))}</p>
      <input class="search" type="search" data-act="fixsearch" value="${esc(q0)}" placeholder="Team suchen, z. B. BVB" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" enterkeyhint="search" aria-label="Spiel suchen">
      <div class="gres">${gameList(q0, 'scgame')}</div>
      ${l.g ? '<button class="btn soft" data-act="scunlink" style="margin-top:12px">Keinem Spiel zuordnen</button>' : ''}
      <p class="bf-note">Mit Spiel prüft Wettbuch den Tipp nach dem Abpfiff selbst. Ohne Spiel rechnest du die Wette selbst ab.</p>`, 'bet-panel', 'Spiel zuordnen');
    if (!G.data) loadGames().catch(() => {}).then(() => { const g = $('.sheet .gres'); const inp = $('.sheet [data-act="fixsearch"]'); if (g && inp) g.innerHTML = gameList(inp.value, 'scgame'); });
  }
  function scanFix(gid) {
    const f = SC.fix;
    const r = G.byGid[gid];
    if (!f) { closeSheet(); return; }
    const all = store.get('scans', []);
    const sc = all.find((s) => s.id === f.id);
    const x = sc && sc.slips && sc.slips[f.i];
    const l = x && x.legs[f.k];
    if (!l) { SC.fix = null; closeSheet(); return; }
    const d = dupOf(x);
    if (r) linkTo(l, r);
    else Object.assign(l, { g: null, slug: null, m: null, home: l.rh || l.home, away: l.ra || l.away }); // „Keinem Spiel zuordnen“
    if (!l.res || !l.res.shot) l.res = null;
    sc.teams = Object.assign(sc.teams || {}, teamsOf([l]));
    store.set('scans', all);
    // schon gespeichert und noch offen: dort genauso ändern
    if (d.b && d.b.status === 'open') {
      const bets = betsAll();
      const b = bets.find((y) => y.id === d.b.id);
      const bl = b && b.legs[f.k];
      if (bl && norm(bl.pick) === norm(l.pick)) {
        ['g', 'slug', 'm', 't', 'comp', 'home', 'away'].forEach((k2) => { bl[k2] = l[k2] == null ? null : l[k2]; });
        bl.res = l.res ? Object.assign({}, l.res) : null;
        b.teams = teamsOf(b.legs);
        betsSave(bets);
      }
    }
    SC.fix = null;
    closeSheet();
    haptic();
    refreshBets();
    if (r) setTimeout(() => checkBets(), 400);
  }

  // ------------------------------------------------------------------ Ergebnis eines Scans
  function slipCard(sc, x, i) {
    const d = dupOf(x);
    const st = x.st || 'open';
    const id = esc(sc.id);
    const nLinked = x.legs.filter((l) => l.g && l.m).length;
    const kind = x.system ? `System ${x.system} · ${x.legs.length} Tipps` : x.legs.length > 1 ? `Kombi · ${x.legs.length} Tipps` : 'Einzelwette';
    const stTxt = !x.st ? 'Stand k. A.' : st === 'cash' ? `Cashout${x.cash != null ? ' ' + eur(x.cash) : ''}` : ST_NAME[st];
    const win = slipWin(x);
    const pb = { stake: x.stake || 0, free: x.free, win, status: st, cash: x.cash, legs: x.legs };
    const pl = betPL(pb);
    const known = !!x.stake && (st !== 'won' || !!win) && (st !== 'cash' || x.cash != null);
    const third = st === 'open' ? ['Mögl. Gewinn', win ? eur(winC(pb) / 100) : 'k. A.', ''] : st === 'void' ? ['Zurück', x.stake ? eur(x.stake) : 'k. A.', '']
      : [st === 'won' ? 'Gewinn' : st === 'cash' ? 'Ergebnis' : 'Verlust', known ? signed(pl) : 'k. A.', known ? plusMinus(pl) : ''];
    const track = x.system ? 'Systemwetten rechnest du selbst ab.' : st !== 'open' ? '' : nLinked === x.legs.length ? 'Wettbuch prüft alle Tipps nach dem Abpfiff selbst.'
      : nLinked ? `Wettbuch prüft ${nLinked} von ${x.legs.length} Tipps selbst – mit dem Stift ordnest du die anderen einem Spiel zu.` : 'Kein Spiel zugeordnet – mit dem Stift wählst du es aus, sonst rechnest du später selbst ab.';
    const legs = x.legs.map((l, k) => legRow(l, `<button class="bl-fix" data-act="scleg" data-id="${id}" data-i="${i}" data-l="${k}" aria-label="Spiel zuordnen">${I.pen}</button>`)).join('');
    let acts;
    if (d.st === 'new') {
      acts = slipComplete(x) ? `<button class="btn" data-act="sctake" data-id="${id}" data-i="${i}">Speichern</button><button class="btn soft" data-act="scfill" data-id="${id}" data-i="${i}">Prüfen und ändern</button>`
        : `<button class="btn" data-act="scfill" data-id="${id}" data-i="${i}">Ergänzen und speichern</button>`;
    } else if (d.st === 'upd') {
      acts = `<p class="sl-dup">Schon gespeichert – dort steht „${esc(ST_NAME[d.b.status])}“.</p><button class="btn" data-act="scupd" data-id="${id}" data-i="${i}">Übernehmen: ${esc(stTxt)}</button><button class="link sl-new" data-act="scnew" data-id="${id}" data-i="${i}">Ist eine andere Wette – neu speichern</button>`;
    } else {
      acts = `<p class="sl-dup ok">${I.check}<span>Gespeichert${d.b.status !== st ? ` · inzwischen ${esc(ST_NAME[d.b.status])}` : ''}</span><button class="link" data-act="betsgo" data-val="${d.b.status === 'open' ? 'open' : 'done'}">Ansehen</button></p><button class="link sl-new" data-act="scnew" data-id="${id}" data-i="${i}">Ist eine andere Wette – neu speichern</button>`;
    }
    return `<article class="tk slip ${st}"><div class="tk-h"><span class="tk-k">${nLinked ? I.spark : ''}${esc(kind)}${x.free ? ' · Gratiswette' : ''}</span><span class="pill ${x.st ? st : ''}">${{ won: I.check, lost: I.x }[st] || ''}${esc(stTxt)}</span></div>
      <div class="tk-legs">${legs}</div>
      <div class="tk-cut" aria-hidden="true"></div>
      <div class="tk-f"><div><span>Einsatz${x.free ? ' (gratis)' : ''}</span><b>${x.stake ? eur(x.stake) : 'k. A.'}</b></div><div><span>Quote</span><b>${x.q ? nf2.format(x.q) : 'k. A.'}</b></div><div class="r"><span>${third[0]}</span><b class="${third[2]}">${third[1]}</b></div></div>
      ${track ? `<p class="sl-track">${esc(track)}</p>` : ''}${x.betId ? `<p class="sl-id">Wett-ID ${esc(x.betId)}</p>` : ''}
      <div class="sl-acts">${acts}</div></article>`;
  }
  function vScanRes(id) {
    const sc = scanById(id);
    if (!sc) return `<h1 class="ptitle">Scan</h1><div class="empty" style="margin-top:18px">Diesen Scan gibt es nicht (mehr).</div>`;
    regTeams(sc);
    const n = sc.slips.length;
    const fresh = sc.slips.filter((x) => dupOf(x).st === 'new' && slipComplete(x)).length;
    return `<h1 class="ptitle">${n === 1 ? '1 Wette erkannt' : `${n} Wetten erkannt`}</h1><p class="psub">${esc([agoText(sc.at), sc.bookie].filter(Boolean).join(' · '))} · Spiel falsch zugeordnet? Den Stift antippen.</p>
      ${sc.note ? `<div class="notice sc-note"><b>Hinweis der KI</b><p>${esc(sc.note)}</p></div>` : ''}
      ${fresh > 1 ? `<button class="btn sc-all" data-act="sctakeall" data-id="${esc(sc.id)}">Alle ${fresh} speichern</button>` : ''}
      <div class="scl">${sc.slips.map((x, i) => slipCard(sc, x, i)).join('')}</div>
      <div class="scan-more"><label class="btn soft">${I.scan}<span>Noch ein Screenshot</span><input type="file" accept="image/*" data-act="scanpic" aria-label="Noch einen Screenshot wählen"></label></div>
      <p class="foot">Die KI liest das Bild nur ab – was nicht zu sehen ist, steht als „k. A.“ da. Ob eine Wette aufgeht, prüft Wettbuch selbst mit den echten Endständen, ohne KI.<br>${RG_TEXT}</p>`;
  }
  // Scan-Bereich (Tab): großer Scan-Knopf, zuletzt gescannt, was der Scan kann
  function vScan() {
    const recent = scansAll();
    const feats = [[I.layers, 'Ganze Listen', 'Ein Screenshot von „Meine Wetten“: bis zu 10 Wetten auf einmal.'],
      [I.check, 'Prüft selbst', 'Erkannte Spiele rechnet Wettbuch nach dem Abpfiff mit dem echten Endstand ab.'],
      [I.receipt, 'Auch abgerechnete', 'Gewonnen, verloren oder Cashout: alte Scheine kommen mit Ergebnis in deine Statistik.'],
      [I.pen, 'Antippen zum Ändern', 'Spiel falsch zugeordnet oder etwas nicht lesbar? Antippen und korrigieren.']];
    const row = (sc) => {
      regTeams(sc);
      const x = sc.slips[0] || { legs: [] };
      const l = x.legs[0] || {};
      const more = sc.slips.length - 1;
      const title = x.legs.length > 1 ? `${x.system ? 'System' : 'Kombi'} · ${x.legs.length} Tipps` : legPick(l);
      const ic = x.legs.length === 1 && l.home && l.away ? `<span class="duo">${crest(l.home, 24, true)}${crest(l.away, 24, true)}</span>` : `<span class="li-ic">${I.receipt}</span>`;
      return `<a class="row" href="#/scan/res/${esc(sc.id)}">${ic}<span class="grow"><div class="t">${esc(title)}${more > 0 ? ` <span class="muted">+${more}</span>` : ''}</div><div class="s">${esc([nBets(sc.slips.length), sc.bookie, agoText(sc.at)].filter(Boolean).join(' · '))}</div></span><span class="chev">${I.chev}</span></a>`;
    };
    return `<h1 class="ptitle">Scannen</h1><p class="psub">Screenshot aus deiner Wett-App – Wettbuch liest Einsatz, Quote und Tipps.</p>
      <section class="scan-card sc-hero">${SCAN_ART}<h2>Wettschein scannen</h2><p>Ein Schein oder die ganze Liste „Meine Wetten“ – offen oder schon abgerechnet.</p>
        ${scanBtns(true)}${ipadWide() ? '<p class="sc-drop">Oder ein Bild hierher ziehen – oder mit ⌘V einfügen.</p>' : ''}</section>
      <button class="btn soft sc-man" data-act="newbet">${I.pen}<span>Ohne Scan: selbst eintragen</span></button>
      ${recent.length ? `<section class="sec"><div class="sec-h"><h2>Zuletzt gescannt</h2></div><div class="group">${recent.map(row).join('')}</div></section>` : ''}
      <section class="sec"><div class="sec-h"><h2>Das kann der Scan</h2></div><div class="lst feats">${feats.map(([ic, t, s], i) => `<div class="li"><span class="li-ic s${i}">${ic}</span><span class="grow"><b>${t}</b><span class="wrap2">${s}</span></span></div>`).join('')}</div></section>
      <p class="foot">Die KI sieht nur das Bild, das du scannst – an deine Wett-App oder dein Wettkonto kommt Wettbuch nie heran.<br>${RG_TEXT}</p>`;
  }
  // iPad: Bild hineinziehen oder mit ⌘V einfügen, solange der Scan-Bereich offen ist
  const onScanTab = () => { const p = curPath(); return p === '/scan' || p.startsWith('/scan/res/'); };
  const imageOf = (list) => [...(list || [])].find((x) => /^image\//.test(x.type || ''));
  document.addEventListener('paste', (e) => {
    if (!onScanTab() || $('.sheet')) return;
    const f = imageOf(e.clipboardData && e.clipboardData.files);
    if (f) { e.preventDefault(); startScan(f); }
  });
  document.addEventListener('dragover', (e) => {
    if (!onScanTab() || !e.dataTransfer || ![...(e.dataTransfer.types || [])].includes('Files')) return;
    e.preventDefault();
    document.documentElement.classList.add('dropping');
  });
  document.addEventListener('dragleave', (e) => { if (!e.relatedTarget) document.documentElement.classList.remove('dropping'); });
  document.addEventListener('drop', (e) => {
    document.documentElement.classList.remove('dropping');
    if (!onScanTab()) return;
    const f = imageOf(e.dataTransfer && e.dataTransfer.files);
    if (f) { e.preventDefault(); startScan(f); }
  });

  // ------------------------------------------------------------------ Automatische Abrechnung (ohne KI): Endstand direkt von ESPN, sobald die App offen ist –
  // läuft ein Spiel, alle 60 Sekunden. Gewertet wird nach 90 Minuten (bei Verlängerung: Tore der zwei Halbzeiten). Hakt ESPN, hilft der Spielplan.
  const ESPN_API = 'https://site.api.espn.com/apis/site/v2/sports/soccer';
  const LIVE = {}; // Spiel-ID -> { state, done, hs, as, h1, a1, clock, et, cancelled, at }
  const CHK = { at: 0, err: false };
  function parseGame(d) {
    const c = d && d.header && d.header.competitions && d.header.competitions[0];
    if (!c) return null;
    const st = (c.status && c.status.type) || {};
    const side = (k) => (c.competitors || []).find((x) => x.homeAway === k) || {};
    const h = side('home');
    const a = side('away');
    const int = (v) => { const n = parseInt(v, 10); return Number.isFinite(n) ? n : null; };
    const ls = (x) => (x.linescores || []).map((l) => int(l.displayValue != null ? l.displayValue : l.value));
    let hs = int(h.score);
    let as = int(a.score);
    const name = String(st.name || '');
    const et = /AET|PEN|EXTRA|SHOOTOUT/i.test(name);
    const lh = ls(h);
    const la = ls(a);
    if (et) { // Wetten zählen nach 90 Minuten: nur die Tore der zwei Halbzeiten
      hs = lh.length >= 2 && lh[0] != null && lh[1] != null ? lh[0] + lh[1] : null;
      as = la.length >= 2 && la[0] != null && la[1] != null ? la[0] + la[1] : null;
    }
    return { state: st.state, done: !!st.completed, et, hs, as, h1: lh.length ? lh[0] : null, a1: la.length ? la[0] : null,
      clock: (c.status && c.status.displayClock) || '', cancelled: /POSTPON|CANCEL|ABANDON|SUSPEND|FORFEIT/i.test(name) };
  }
  // Ersatz, wenn ESPN nicht antwortet: Endstand (nach 90 Min.) oder Absage aus dem Spielplan
  function fromPlan(g) {
    const r = G.byGid[g];
    if (!r || (r[5] !== 2 && r[5] !== 3)) return null;
    return r[5] === 3 ? { state: 'post', done: true, cancelled: true, hs: null, as: null, clock: '' } : { state: 'post', done: true, hs: r[6], as: r[7], h1: null, a1: null, clock: '', cancelled: false };
  }
  const openLegs = () => { const out = []; betsAll().forEach((b) => { if (b.status === 'open') b.legs.forEach((l) => { if (!l.res && l.g && l.slug && l.t) out.push(l); }); }); return out; };
  const liveBets = () => openLegs().some((l) => new Date(l.t).getTime() <= Date.now());
  let checking = null;
  function checkBets() {
    if (checking) return checking;
    const now = Date.now();
    const due = new Map();
    openLegs().forEach((l) => {
      if (new Date(l.t).getTime() > now) return;
      const o = LIVE[l.g];
      if (!o || now - o.at > (o.done ? 5 * 60e3 : 50e3)) due.set(l.g, l.slug);
    });
    if (!due.size) return Promise.resolve(false);
    let moved = false; // hat sich ein Spielstand oder die Minute geändert? (nur dann neu zeichnen)
    let fails = 0;
    checking = Promise.all([...due].map(([g, slug]) => (/^\d+$/.test(g) ? fetch(`${ESPN_API}/${slug}/summary?event=${encodeURIComponent(g)}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null)).catch(() => null) : Promise.resolve(null))
      .then(async (d) => {
        let s = parseGame(d);
        if (!s) { fails++; await loadGames().catch(() => {}); s = fromPlan(g); }
        if (!s) return;
        const o = LIVE[g];
        if (!o || o.hs !== s.hs || o.as !== s.as || o.state !== s.state || o.clock !== s.clock) moved = true;
        LIVE[g] = Object.assign(s, { at: Date.now() });
      })))
      .then(() => { CHK.at = Date.now(); CHK.err = fails > 0 && fails === due.size; return settleAuto(moved); })
      .finally(() => { checking = null; });
    return checking;
  }
  function settleAuto(moved) {
    const all = betsAll();
    const now = Date.now();
    const changed = [];
    let touched = false;
    all.forEach((b) => {
      if (b.status !== 'open' || b.manual) return;
      let hit = false;
      b.legs.forEach((l) => {
        const s = l.g && LIVE[l.g];
        if (l.res || !s || !l.m) return;
        if (s.cancelled) { if (now - new Date(l.t).getTime() > 48 * 36e5) { l.res = { void: true }; hit = true; } return; } // abgesagt: zählt nicht (wie beim Anbieter)
        if (!s.done) return;
        if (s.hs != null && s.as != null) {
          const w = wonCode(l.m, s.hs, s.as, s.h1, s.a1);
          if (w === null) return; // z. B. Halbzeit-Tipp ohne Halbzeitstand: dann rechnest du selbst ab
          l.res = { hs: s.hs, as: s.as, won: w === true, void: w === 'void' || undefined, et: s.et || undefined };
        } else if (s.et && FAM.slice(0, 6).includes(l.m)) l.res = { hs: null, as: null, et: true, won: l.m.includes('D') }; // Verlängerung = nach 90 Min. unentschieden
        else return;
        hit = true;
      });
      if (!hit) return;
      touched = true;
      if (b.system) return; // Systemwetten: Tipps werden abgehakt, abrechnen tust du selbst
      const rs = b.legs.map((l) => l.res);
      const st = rs.some((r) => r && !r.void && !r.won) ? 'lost' : rs.every(Boolean) ? (rs.every((r) => r.void) ? 'void' : 'won') : 'open';
      if (st === 'open') return;
      b.status = st;
      b.done = now;
      if (st === 'won' && b.win) { const f = b.legs.reduce((x, l) => x * (l.res.void && l.q ? l.q : 1), 1); if (f > 1) b.win = round2(b.win / f); } // Tipp ohne Wertung zählt wie Quote 1,0
      changed.push(b);
    });
    if (touched) betsSave(all);
    if (changed.length) {
      haptic();
      const one = changed[0];
      const won = changed.filter((b) => b.status === 'won').length;
      const lost = changed.filter((b) => b.status === 'lost').length;
      if (changed.length === 1) toast(one.status === 'won' ? `✓ Gewonnen: ${betTitle(one)} · ${signed(betPL(one))}` : one.status === 'lost' ? `✗ Verloren: ${betTitle(one)}` : `Storniert: ${betTitle(one)} – Einsatz zurück`);
      else toast(`${changed.length} Wetten abgerechnet – ${won} gewonnen`);
      const txt = changed.length === 1 ? `${betTitle(one)}: ${ST_NAME[one.status].toLowerCase()} · ${signed(betPL(one))}`
        : `${[won ? `${won} gewonnen` : '', lost ? `${lost} verloren` : '', changed.length - won - lost ? `${changed.length - won - lost} storniert` : ''].filter(Boolean).join(' · ')} · zusammen ${signed(sumPL(changed))}`;
      kiLog('settle', changed.length, txt, { bets: changed.map((b) => ({ t: betTitle(b), st: ST_NAME[b.status], pl: betPL(b),
        legs: b.legs.map((l) => [legPick(l), l.res ? (l.res.hs != null ? `Endstand ${l.res.hs}:${l.res.as}` : l.res.void ? 'zählt nicht' : '') : 'offen', legState(l)]) })) });
    }
    if (touched) refreshBets();
    else if (moved) refreshBets(true);
    return changed.length > 0;
  }

  // Screenshot verkleinern, bevor er zur KI geht (Gemini auf dem Cloudflare-Server)
  function shrink(file) {
    return new Promise((res, rej) => {
      const url = URL.createObjectURL(file);
      const im = new Image();
      im.onload = () => {
        const k = Math.min(1, 1280 / im.naturalWidth, 3600 / im.naturalHeight); // lange Spiel-Listen bleiben lesbar
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
  function toast(msg, kind) {
    let t = $('.toast');
    if (!t) {
      t = document.createElement('div');
      t.setAttribute('role', 'status');
      document.body.appendChild(t);
    }
    t.className = `toast${kind ? ' ' + kind : ''}`;
    t.innerHTML = `${kind === 'won' ? `<i>${I.check}</i>` : ''}<span>${esc(msg)}</span>`;
    t.classList.remove('show');
    void t.offsetWidth; // neu einblenden, auch wenn gerade schon eine Meldung steht
    t.classList.add('show');
    clearTimeout(toastT);
    toastT = setTimeout(() => t.classList.remove('show'), 2800);
  }

  // ------------------------------------------------------------------ Konto (Niklas, 10.11.2026): nur Benutzername + Passwort – Handy und iPad 1 zu 1 gleich
  // Das Passwort verlässt das Gerät nie: die App streckt es (PBKDF2, 150.000 Runden) und schickt nur das Ergebnis. Zusammengeführt wird in sync.js.
  const ACC = { busy: false, again: false, err: '', mode: 'login', timer: 0, first: null, show: false };
  const authOf = () => { const a = store.get('auth', null); return a && a.user && a.token ? a : null; };
  const RSX = window.RS || null; // sync.js (fehlt nur, wenn ein alter Zwischenspeicher hängt)
  async function acall(method, path, body, token) {
    const tk = token || (authOf() || {}).token;
    const headers = {};
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (tk) headers.Authorization = 'Bearer ' + tk;
    let r;
    try { r = await fetch(api() + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), cache: 'no-store' }); } catch (e) { return { ok: false, status: 0, error: 'Keine Verbindung zum Server.' }; }
    const d = await r.json().catch(() => null);
    return Object.assign({ status: r.status }, d && typeof d === 'object' ? d : { ok: false, error: `Der Server hat nicht geantwortet (${r.status}).` });
  }
  async function stretch(user, pass) {
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey('raw', enc.encode(pass), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode('result-ai|' + user), iterations: 150000 }, key, 256);
    return [...new Uint8Array(bits)].map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  const syncIO = {
    read: (k) => store.get(k, null),
    write: (k, v) => { try { if (v == null) localStorage.removeItem('ra_' + k); else localStorage.setItem('ra_' + k, JSON.stringify(v)); } catch (e) { /* voll */ } },
    meta: () => store.get('sync', null),
    setMeta: (m) => { try { localStorage.setItem('ra_sync', JSON.stringify(m)); } catch (e) { /* voll */ } },
    req: (method, path, body) => acall(method, path, body),
    now: () => Date.now(),
  };
  // jede Änderung an Wetten, Kasse, Limits … bekommt einen Zeitstempel; mit Konto wird kurz danach abgeglichen
  store.onSet = (k, oldRaw, v) => {
    if (!RSX || !RSX.isSynced(k)) return;
    let old = null;
    try { old = oldRaw == null ? null : JSON.parse(oldRaw); } catch (e) { old = null; }
    const m = RSX.stamp(store.get('sync', null), k, old, v, Date.now());
    m.dirty = (m.dirty || 0) + 1;
    syncIO.setMeta(m);
    if (authOf()) syncSoon();
  };
  const accBtn = () => { const a = authOf(); return `<button class="round acc-b${a ? ' on' : ''}${a && ACC.err ? ' warn' : ''}" data-act="account" aria-label="${a ? `Konto ${esc(a.user)}` : 'Anmelden'}">${I.user}</button>`; };
  function refreshAccBtns() {
    $$('.acc-b').forEach((b) => { b.outerHTML = accBtn(); });
    const st = $('.acc-st');
    if (st) st.textContent = accStatus();
  }
  function accStatus() {
    if (ACC.busy) return 'Wird abgeglichen …';
    if (ACC.err) return '⚠ ' + ACC.err;
    const last = (store.get('sync', null) || {}).last;
    return last ? `Abgeglichen ${agoText(last)}` : 'Noch nicht abgeglichen';
  }
  const accRow = () => { const a = authOf(); return `<div class="group"><button class="row acc-row" data-act="account2"><span class="round">${I.user}</span><span class="grow"><div class="t">${a ? esc(a.user) : 'Anmelden oder Konto erstellen'}</div><div class="s">${a ? 'Handy und iPad werden abgeglichen' : 'Wetten und Kasse auf Handy und iPad gleich'}</div></span><span class="chev">›</span></button></div>`; };
  function syncSoon(ms) { clearTimeout(ACC.timer); ACC.timer = setTimeout(() => { syncNow(); }, ms == null ? 1500 : ms); }
  async function syncNow(mode, first) {
    if (!RSX || !authOf()) return null;
    if (ACC.busy) { ACC.again = true; return null; }
    ACC.busy = true;
    refreshAccBtns();
    let res;
    try { res = await RSX.run(syncIO, mode, first); } catch (e) { res = { ok: false, res: { error: String((e && e.message) || e) }, changed: new Set() }; }
    ACC.busy = false;
    const r = res.res || {};
    if (!res.ok && r.status === 401 && /anmeld/i.test(r.error || '')) { signedOut('Du wurdest abgemeldet – bitte neu anmelden.'); return res; }
    ACC.err = res.ok ? '' : r.error || 'Der Abgleich hat nicht geklappt.';
    refreshAccBtns();
    if (res.changed && res.changed.size) onSynced(res.changed);
    if (ACC.again || res.again) { ACC.again = false; syncSoon(1200); }
    return res;
  }
  // vom anderen Gerät kam etwas: Darstellung übernehmen, Seiten neu zeichnen
  function onSynced(changed) {
    if (changed.has('theme')) applyTheme(store.get('theme', 'light'));
    if (changed.has('kilog')) refreshKib();
    redrawAll();
    refreshAccBtns();
  }
  function signedOut(msg) {
    store.set('auth', null);
    const m = RSX ? RSX.fixMeta(store.get('sync', null)) : {};
    m.v = 0;
    m.last = 0;
    delete m.user;
    syncIO.setMeta(m);
    ACC.err = '';
    refreshAccBtns();
    redrawAll((p) => p === '/ki');
    if (msg) toast(msg);
  }
  function openAccount() {
    if ($('.sheet')) return;
    const sh = document.createElement('div');
    sh.className = 'sheet';
    sh.innerHTML = `<div class="bg" data-act="close"></div><div class="panel" role="dialog" aria-label="Konto">${accPanel()}</div>`;
    document.body.appendChild(sh);
  }
  function accPanel() {
    const a = authOf();
    if (a) {
      return `<div class="grip" data-grip></div><h2>Konto</h2>
        <div class="acc-card"><span class="acc-av">${esc(a.user.slice(0, 1).toUpperCase())}</span><span class="grow"><b>${esc(a.user)}</b><span class="acc-st">${esc(accStatus())}</span></span></div>
        <div class="acc-what"><b>Auf Handy und iPad gleich</b><span>Wetten und Kasse · Limits · Scans · Name, Darstellung und Einladungscode</span>
          <b>Nur auf diesem Gerät</b><span>Handy- oder iPad-Ansicht</span></div>
        <button class="btn" data-act="accsync">Jetzt abgleichen</button>
        <button class="btn soft" data-act="acclogout" style="margin-top:8px">Abmelden</button>
        <button class="acc-del" data-act="accdel">Konto löschen</button>`;
    }
    const up = ACC.mode === 'signup';
    return `<div class="grip" data-grip></div><h2>Konto</h2>
      <p class="bf-note" style="margin-top:-6px">Mit einem Konto hast du auf Handy und iPad dieselben Wetten, dieselbe Kasse und dieselben Limits. Nur Benutzername und Passwort – keine E-Mail, keine Handynummer.</p>
      <div class="seg s2" style="--k:${up ? 1 : 0}"><span class="ind"></span><button class="${up ? '' : 'on'}" data-act="accmode" data-val="login">Anmelden</button><button class="${up ? 'on' : ''}" data-act="accmode" data-val="signup">Konto erstellen</button></div>
      <form class="acc-f" data-form="acc" autocomplete="on" novalidate>
        <div class="lab">BENUTZERNAME</div>
        <input class="search" type="text" name="username" data-act="accuser" autocomplete="username" autocapitalize="off" autocorrect="off" spellcheck="false" maxlength="20" placeholder="${up ? 'z. B. niklas09' : 'dein Benutzername'}" enterkeyhint="next">
        <div class="lab" style="margin-top:14px">PASSWORT</div>
        <div class="pw"><input class="search" type="password" name="password" data-act="accpass" autocomplete="${up ? 'new-password' : 'current-password'}" maxlength="100" placeholder="${up ? 'mindestens 6 Zeichen' : 'dein Passwort'}" enterkeyhint="${up ? 'next' : 'go'}"><button type="button" class="eye" data-act="acceye" aria-label="Passwort zeigen">${I.eye}</button></div>
        ${up ? '<div class="pw" style="margin-top:8px"><input class="search" type="password" name="password2" data-act="accpass2" autocomplete="new-password" maxlength="100" placeholder="Passwort wiederholen" enterkeyhint="go"></div>' : ''}
        <p class="acc-err" role="alert"></p>
        <button class="btn" type="submit">${up ? 'Konto erstellen' : 'Anmelden'}</button>
      </form>
      <p class="acc-hint">${up ? 'Passwort gut merken: Ohne E-Mail lässt es sich nicht zurücksetzen. Am besten vom iPhone im Schlüsselbund sichern lassen – dann kennt es auch dein iPad.' : 'Noch kein Konto? Oben auf „Konto erstellen“ tippen.'}</p>`;
  }
  function accRedraw() {
    const p = $('.sheet .panel');
    if (p) p.innerHTML = accPanel();
  }
  async function accGo() {
    const sh = $('.sheet');
    if (!sh || ACC.show) return;
    const val = (k) => { const x = $(`[data-act="${k}"]`, sh); return x ? x.value : null; };
    const err = (t) => { const e = $('.acc-err', sh); if (e) e.textContent = t; };
    const user = String(val('accuser') || '').trim().toLowerCase();
    const pass = val('accpass') || '';
    const up = ACC.mode === 'signup';
    if (!/^[a-z0-9._-]{3,20}$/.test(user)) { err('Benutzername: 3 bis 20 Zeichen – Buchstaben, Zahlen, Punkt, Bindestrich oder Unterstrich.'); return; }
    if (pass.length < 6) { err('Das Passwort braucht mindestens 6 Zeichen.'); return; }
    if (up && val('accpass2') !== pass) { err('Die beiden Passwörter sind nicht gleich.'); return; }
    if (!(window.crypto && crypto.subtle) || !RSX) { err('Anmelden geht nur in der App über ihre sichere Adresse (https).'); return; }
    const btn = $('button[type="submit"]', sh);
    const label = btn.textContent;
    btn.disabled = true;
    btn.textContent = up ? 'Konto wird erstellt …' : 'Wird angemeldet …';
    err('');
    ACC.show = true;
    const stop = (t) => { ACC.show = false; err(t); btn.disabled = false; btn.textContent = label; };
    const st = await acall('GET', '/');
    if (!st.ok) { stop(st.status ? 'Der Server hat einen Fehler gemeldet.' : 'Der Server ist gerade nicht erreichbar.'); return; }
    if (!st.konten) { stop('Konten sind auf dem Server noch nicht eingerichtet – die Datenbank bei Cloudflare fehlt noch.'); return; }
    let hash;
    try { hash = await stretch(user, pass); } catch (e) { stop('Das Passwort konnte nicht verschlüsselt werden.'); return; }
    const r = await acall('POST', up ? '/auth/signup' : '/auth/login', { user, pass: hash });
    if (!r.ok || !r.token) { stop(r.error || 'Das hat nicht geklappt.'); return; }
    const g = await acall('GET', '/sync', undefined, r.token);
    if (!g.ok) { stop(g.error || 'Die Daten konnten nicht geladen werden.'); return; }
    ACC.show = false;
    // Daten auf beiden Seiten → fragen: Konto-Daten nehmen oder zusammenführen
    if (g.data && RSX.hasData(syncIO.read)) { ACC.first = { user: r.user, token: r.token, res: g }; accChoice(); return; }
    accStart(r.user, r.token, g.data ? 'replace' : undefined, g, up ? 'Konto erstellt – Handy und iPad sind jetzt verbunden' : 'Angemeldet');
  }
  function accChoice() {
    const p = $('.sheet .panel');
    if (!p) return;
    p.innerHTML = `<div class="grip" data-grip></div><h2>Daten auf diesem Gerät</h2>
      <p class="bf-note" style="margin-top:-6px;font-size:15px">Auf diesem Gerät sind schon Wetten, Scans oder ein Kontostand gespeichert – in deinem Konto auch. Was soll passieren?</p>
      <button class="btn" data-act="accfirst" data-val="replace">Daten vom Konto nehmen</button>
      <p class="acc-sub">Empfohlen: Danach ist alles wie auf deinem anderen Gerät. Was nur hier gespeichert war, ist dann weg.</p>
      <button class="btn soft" data-act="accfirst" data-val="merge">Beides zusammenführen</button>
      <p class="acc-sub">Wetten und Scans von hier kommen dazu. Kontostand, Limits, Name und Einstellungen kommen vom Konto.</p>`;
  }
  function accStart(user, token, mode, first, msg) {
    const m = RSX.fixMeta(store.get('sync', null));
    m.v = 0;
    m.user = user;
    syncIO.setMeta(m);
    store.set('auth', { user, token });
    closeSheet();
    toast(msg);
    syncNow(mode, first).then(() => redrawAll((p) => p === '/ki'));
  }
  function accFirst(mode) {
    const f = ACC.first;
    ACC.first = null;
    if (!f) { closeSheet(); return; }
    accStart(f.user, f.token, mode === 'merge' ? 'merge' : 'replace', f.res, mode === 'merge' ? 'Angemeldet – Daten zusammengeführt' : 'Angemeldet – Daten vom Konto geladen');
  }
  async function accLogout() {
    const a = authOf();
    if (!a) { closeSheet(); return; }
    const m = store.get('sync', null) || {};
    if (m.dirty) await Promise.race([syncNow(), new Promise((r) => setTimeout(r, 4000))]); // noch nicht Hochgeladenes zuerst hochladen
    acall('POST', '/auth/logout', undefined, a.token);
    closeSheet();
    signedOut('Abgemeldet – deine Daten bleiben auf diesem Gerät');
  }
  function accDelAsk() {
    const p = $('.sheet .panel');
    const a = authOf();
    if (!p || !a) return;
    p.innerHTML = `<div class="grip" data-grip></div><h2>Konto löschen?</h2>
      <p class="bf-note" style="font-size:15px;margin-top:-6px">Das Konto „${esc(a.user)}“ und alle Daten darin werden auf dem Server gelöscht. Auf diesem Gerät bleibt alles gespeichert. Das lässt sich nicht rückgängig machen.</p>
      <form class="acc-f" data-form="accdel" novalidate><div class="lab">ZUR SICHERHEIT: DEIN PASSWORT</div>
        <div class="pw"><input class="search" type="password" name="password" data-act="accpass" autocomplete="current-password" maxlength="100" placeholder="Passwort" enterkeyhint="go"><button type="button" class="eye" data-act="acceye" aria-label="Passwort zeigen">${I.eye}</button></div>
        <p class="acc-err" role="alert"></p>
        <button class="btn danger" type="submit">Konto endgültig löschen</button></form>
      <button class="btn soft" data-act="close" style="margin-top:8px">Abbrechen</button>`;
  }
  async function accDelGo() {
    const sh = $('.sheet');
    const a = authOf();
    if (!sh || !a || ACC.show) return;
    const inp = $('[data-act="accpass"]', sh);
    const err = (t) => { const e = $('.acc-err', sh); if (e) e.textContent = t; };
    if (!inp || inp.value.length < 6) { err('Bitte dein Passwort eingeben.'); return; }
    const btn = $('button[type="submit"]', sh);
    btn.disabled = true;
    ACC.show = true;
    const r = await acall('POST', '/auth/delete', { user: a.user, pass: await stretch(a.user, inp.value) });
    ACC.show = false;
    btn.disabled = false;
    if (!r.ok) { err(r.error || 'Das hat nicht geklappt.'); return; }
    closeSheet();
    signedOut('Konto gelöscht – auf diesem Gerät ist noch alles da');
  }
  document.addEventListener('submit', (e) => {
    const f = e.target;
    if (!f || !f.dataset || !f.dataset.form) return;
    e.preventDefault();
    if (f.dataset.form === 'acc') accGo(); else if (f.dataset.form === 'accdel') accDelGo();
  });

  // ------------------------------------------------------------------ Seiten-Stapel: neue Seite schiebt sich von rechts herein
  const stackEl = document.createElement('div');
  stackEl.className = 'stack';
  document.body.appendChild(stackEl);
  const tabbar = document.createElement('nav');
  tabbar.className = 'tabbar';
  tabbar.setAttribute('aria-label', 'Bereiche');
  tabbar.innerHTML = `<span class="tab-ind" aria-hidden="true"></span><span class="side-brand" aria-hidden="true">${logo()}</span>` + TABS.map(([p, label, ic]) => (p === '/scan'
    ? `<button class="tb-scan" data-act="tab" data-tab="${p}" aria-label="${label}"><span class="ti"><span class="tb-c">${I.scanF}</span></span><span class="tl">${label}</span></button>`
    : `<button data-act="tab" data-tab="${p}"><span class="ti"><span class="o">${I[ic]}</span><span class="f">${I[ic + 'F'] || I[ic]}</span></span><span class="tl">${label}</span></button>`)).join('')
    + `<span class="side-foot"><button class="kib" data-act="ki" aria-label="KI-Zentrale">${kiBadge()}</button>${accBtn()}<button class="round" data-act="settings" aria-label="Einstellungen">${I.gear}</button></span>`;
  document.body.appendChild(tabbar);
  function syncTabs() {
    const root = S.stack[0] ? S.stack[0].path : '/';
    const i = Math.max(0, TABS.findIndex((t) => t[0] === root));
    tabbar.style.setProperty('--i', i);
    tabbar.dataset.tab = TABS[i][0];
    $$('button[data-tab]', tabbar).forEach((b, k) => { b.classList.toggle('on', k === i); if (k === i) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
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
    reveal(p);
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
    return { title: mc ? pos(mc) + mc.offsetHeight - bar - 10 : 64, nav, navAt: nav ? navTop - bar - 1 : 0, off: bar + (nav && getComputedStyle(nav).position === 'sticky' ? nav.offsetHeight : 0) + 8,
      secs: nav ? $$('[data-sec]', el).filter((x) => !x.closest('.snav')).map((x) => [x.dataset.sec, x.closest('.res-l') ? 0 : pos(x)]) : [], cur: null };
  }
  function spy(el, g, y) {
    let cur = g.secs.length ? g.secs[0][0] : null;
    if (y > 4) g.secs.forEach(([k, t]) => { if (t - g.off <= y + 4) cur = k; }); // ganz oben ist immer der erste Abschnitt dran
    if (g.secs.length && y + el.clientHeight >= el.scrollHeight - 4) cur = g.secs[g.secs.length - 1][0]; // ganz unten: letzter Abschnitt
    if (!cur || g.cur === cur) return;
    g.cur = cur;
    $$('button', g.nav).forEach((bt) => {
      const on = bt.dataset.sec === cur;
      bt.classList.toggle('on', on);
      if (on) g.nav.scrollTo({ left: Math.max(0, bt.offsetLeft - (g.nav.clientWidth - bt.offsetWidth) / 2), behavior: reduce ? 'auto' : 'smooth' });
    });
  }

  // ------------------------------------------------------------------ Seiten bauen, neu zeichnen, zeigen
  const pageKey = (path) => (path === '/' ? 'home' : path.split('/')[1] || 'home'); // z. B. /scan/res/abc -> scan
  function redrawTop() { redrawPage(S.stack[S.stack.length - 1]); }
  function redrawPage(p) {
    if (!p || !p.el.isConnected) return;
    const y = p.el.scrollTop;
    p.el.innerHTML = barHtml(p.path) + `<div class="wrap" data-p="${pageKey(p.path)}">${viewHtml(p.path)}</div>`;
    p.drawn = { games: G.at };
    p.el._geo = null;
    p.el.scrollTop = y;
  }
  function makePage(path) {
    const el = document.createElement('section');
    el.className = 'page';
    if (path === '/stats' || path === '/money') B.anim = 'enter'; // Kurve und Balken bauen sich beim Öffnen auf
    el.innerHTML = barHtml(path) + `<div class="wrap" data-p="${pageKey(path)}">${viewHtml(path)}</div>`;
    B.anim = null;
    el.addEventListener('scroll', onPageScroll, { passive: true });
    return { path, el, shown: false, drawn: { games: G.at } };
  }
  function afterShow(p) {
    if (p.shown) return;
    p.shown = true;
    if (p.path === '/scan/run') runScan(p.el);
    if (p.path === '/' || p.path === '/bets') checkBets();
    if (p.path === '/') loadGames().then(refreshKib, refreshKib); // Spielplan: Punkt am KI-Knopf
    if (p.path === '/ki') Promise.all([loadGames(60e3).catch(() => {}), loadServer()]).then(() => { if (p.el.isConnected) redrawPage(p); });
  }
  async function push(path) {
    const from = S.stack[S.stack.length - 1];
    const to = makePage(path);
    stackEl.appendChild(to.el);
    S.stack.push(to);
    if (!from || reduce) { if (from) from.el.classList.add('hide'); afterShow(to); return; }
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
    const t = setTimeout(() => afterShow(to), 200); // Auftritt startet, während die Seite noch hereinkommt
    await settle(anims, SLIDE.duration + 600);
    clearTimeout(t);
    from.el.classList.add('hide');
    anims.forEach((a) => a.cancel());
    shade.remove();
    to.el.classList.remove('edge');
    S.busy = false;
    stackEl.classList.remove('busy');
    afterShow(to);
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
  // alte Adressen (Result AI bis 11.11.2026: Tipps, Spiele, Verlauf …) führen zur Startseite; ein Scan ohne Bild zum Scannen
  function fixPath() {
    const p = curPath();
    const ok = isTab(p) || p === '/ki' || p.startsWith('/scan/res/') || (p === '/scan/run' && SC.file);
    const to = ok ? null : p === '/scan/run' || p === '/slip' || p === '/pick' ? '/scan' : '/';
    if (to) history.replaceState(null, '', '#' + to);
    return to || p;
  }
  async function route() {
    if (S.busy) { S.pending = true; return; }
    const path = fixPath();
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
      if (p.path === '/scan/run' || (only && !only(p.path))) return;
      const y = p.el.scrollTop;
      p.el.classList.add('still');
      p.el.innerHTML = barHtml(p.path) + `<div class="wrap" data-p="${pageKey(p.path)}">${viewHtml(p.path)}</div>`;
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
      if (t.clientX - stackEl.getBoundingClientRect().left > 24) return;
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

  // Kurve im Geld-Tracker: Finger drauf → Fadenkreuz springt zum nächsten echten Wert, oben stehen Wert und Datum, rechts davon wird die Linie blass
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
      lcPlace(on, c.xs[i], c.ys[i]);
      $('#lc-cp rect', on).setAttribute('width', f1(c.xs[i]));
      setNum($('.mh-n', mh), c.pts[i].v, c.def.mode === 'pl');
      $('.mh-n', mh).className = `mh-n ${mhTone(c.def.mode, c.pts[i].v)}`;
      $('.mh-d', mh).textContent = dayShort(c.pts[i].t);
    };
    document.addEventListener('pointerdown', (e) => {
      const w = e.target.closest && e.target.closest('.lc');
      if (!w || !CH.line) return;
      lcStop();
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
      const mh = w.closest('.mh');
      lcPlace(w, c.lastX, c.lastY);
      $('#lc-cp rect', w).setAttribute('width', c.W);
      setNum($('.mh-n', mh), c.def.val, c.def.mode === 'pl');
      $('.mh-n', mh).className = `mh-n ${mhTone(c.def.mode, c.def.val)}`;
      $('.mh-d', mh).innerHTML = c.def.sub;
    };
    document.addEventListener('pointerup', end, { passive: true });
    document.addEventListener('pointercancel', end, { passive: true });
  })();
  // Kalender: Monat mit dem Finger wechseln, das Raster geht mit
  (() => {
    let s = null;
    document.addEventListener('touchstart', (e) => {
      const g = e.target.closest && e.target.closest('.cal-swipe');
      if (!g || e.touches.length > 1) { s = null; return; }
      const t = e.touches[0];
      s = { el: $('.cal-grid', g), x: t.clientX, y: t.clientY, on: false, dx: 0, blocked: false, t: performance.now() };
    }, { passive: true });
    document.addEventListener('touchmove', (e) => {
      if (!s) return;
      const t = e.touches[0];
      const dx = t.clientX - s.x;
      const dy = t.clientY - s.y;
      if (!s.on) {
        if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) { s = null; return; }
        if (Math.abs(dx) < 10) return;
        s.on = true;
      }
      s.blocked = (dx < 0 && B.cal >= ymOf(Date.now())) || (dx > 0 && B.cal <= calFirst());
      s.dx = s.blocked ? dx * 0.22 : dx;
      s.el.style.transform = `translateX(${s.dx.toFixed(1)}px)`;
      s.el.style.opacity = String(1 - Math.min(0.55, Math.abs(s.dx) / 420));
    }, { passive: true });
    const end = () => {
      if (!s) return;
      const g = s;
      s = null;
      if (!g.on) return;
      const fast = Math.abs(g.dx) / Math.max(1, performance.now() - g.t) > 0.5;
      if (!g.blocked && (Math.abs(g.dx) > g.el.offsetWidth * 0.22 || fast)) { calShift(g.dx < 0 ? 1 : -1); return; }
      const tr = g.el.style.transform;
      const op = g.el.style.opacity;
      g.el.style.transform = '';
      g.el.style.opacity = '';
      if (!reduce) g.el.animate([{ transform: tr, opacity: op }, { transform: 'translateX(0)', opacity: 1 }], { duration: 220, easing: 'cubic-bezier(.2,.8,.2,1)' });
    };
    document.addEventListener('touchend', end, { passive: true });
    document.addEventListener('touchcancel', end, { passive: true });
  })();

  // ------------------------------------------------------------------ Einstellungen (Blatt von unten, mit Federung)
  function openSettings() {
    if ($('.sheet')) return;
    const th = store.get('theme', 'light');
    const k = Math.max(0, ['light', 'dark', 'auto'].indexOf(th));
    const dv = store.get('device', deviceGuess());
    const sh = sheet(`<h2>Einstellungen</h2><div class="lab">KONTO</div>${accRow()}
      <div class="lab" style="margin-top:20px">DEIN NAME</div>
      <input class="search name-in" type="text" placeholder="für die Begrüßung, z. B. Niklas" value="${esc(store.get('name', ''))}" data-act="name" maxlength="20" autocomplete="off" autocorrect="off" spellcheck="false" enterkeyhint="done">
      <div class="lab" style="margin-top:20px">DARSTELLUNG</div>
      <div class="seg s3" data-v="${th}" style="--k:${k}"><span class="ind"></span>${[['light', 'Hell'], ['dark', 'Dunkel'], ['auto', 'Automatisch']].map(([v, l]) => `<button class="${th === v ? 'on' : ''}" data-act="theme" data-val="${v}">${l}</button>`).join('')}</div>
      <div class="lab" style="margin-top:20px">GERÄT</div>
      <div class="seg s2" style="--k:${dv === 'ipad' ? 1 : 0}"><span class="ind"></span>${[['phone', 'Handy'], ['ipad', 'iPad']].map(([v, l]) => `<button class="${dv === v ? 'on' : ''}" data-act="device" data-val="${v}">${l}</button>`).join('')}</div>
      <p class="dev-note">${deviceNote(dv)}</p>
      <div class="lab" style="margin-top:20px">EINLADUNGSCODE</div>
      <input class="search" type="text" placeholder="für die KI, die deine Wettscheine liest" value="${esc(store.get('invite', ''))}" data-act="invite" maxlength="40" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" enterkeyhint="done">
      <p class="inv-st"></p>
      <div class="lab" style="margin-top:20px">DEINE DATEN</div>
      <div class="group set-g"><button class="row" data-act="limits"><span class="set-ic">${I.shield}</span><span class="grow"><div class="t">Limits</div><div class="s">Grenzen für Einsatz, Verlust und Einzahlung</div></span><span class="chev">›</span></button>
        <button class="row" data-act="csv"><span class="set-ic">${I.download}</span><span class="grow"><div class="t">Wetten als Tabelle sichern</div><div class="s">CSV-Datei, öffnet sich z. B. in Numbers oder Excel</div></span><span class="chev">›</span></button></div>
      <p class="foot" style="margin-top:18px">Wettbuch</p>`, '', 'Einstellungen');
    checkInvite(sh);
  }

  const deviceNote = (v) => (v === 'ipad' ? (innerWidth < 700 ? 'Auf diesem Bildschirm ist zu wenig Platz. Die iPad-Ansicht zeigt sich auf dem iPad.' : 'Fürs Querformat gemacht: Leiste links, Karten nebeneinander. Hochkant gibt es zwei Spalten.') : 'Schmale Ansicht wie auf dem iPhone.');
  // Einladungscode beim Server prüfen (schützt das Gratis-Kontingent der KI vor Fremden)
  let invT = 0;
  function checkInvite(sh) {
    const el = $('.inv-st', sh);
    if (!el) return;
    const code = String(store.get('invite', '') || '').trim();
    const set = (txt, cls) => { el.textContent = txt; el.className = 'inv-st' + (cls ? ' ' + cls : ''); };
    if (!code) { set('Den Code bekommst du von Niklas. Ohne Code geht alles außer dem Scannen.'); return; }
    if (!API) { set('Der KI-Server ist noch nicht verbunden – der Code wird geprüft, sobald er läuft.'); return; }
    set('Wird geprüft …');
    fetch(api() + '/check', { headers: { 'X-Invite': code } })
      .then((r) => { if (String(store.get('invite', '')).trim() === code) set(r.ok ? '✓ Code passt – das Scannen ist frei.' : '✗ Dieser Code passt nicht.', r.ok ? 'ok' : 'bad'); })
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
  // Bereich wechseln (Leiste unten); nochmal tippen = zurück zur Startseite des Bereichs bzw. nach oben
  function goTab(to) {
    if (S.stack[0] && S.stack[0].path === to) {
      if (S.stack.length > 1) goHome();
      else S.stack[0].el.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
    } else location.replace('#' + to);
  }
  // Blatt „Wette“ neu zeichnen, ohne nach oben zu springen
  const redrawDraft = () => { const p = $('.sheet .panel'); const y = p ? p.scrollTop : 0; drawDraft(); if (p) p.scrollTop = y; };
  // erst das offene Blatt schließen, dann das nächste öffnen
  const afterSheet = (f) => { if ($('.sheet')) { closeSheet(); setTimeout(f, reduce ? 0 : 320); } else f(); };
  document.addEventListener('click', (e) => {
    if (hapEl.contains(e.target)) return;
    if (e.target.tagName !== 'INPUT' && e.target.closest('a[href], button, .sbtn')) haptic();
    const a = e.target.closest('[data-act]');
    if (!a) return;
    const act = a.dataset.act;
    const d = B.draft;
    if (act === 'back') goBack();
    else if (act === 'home') goHome();
    else if (act === 'settings') openSettings();
    else if (act === 'account') openAccount();
    else if (act === 'account2') { closeSheet(); setTimeout(openAccount, reduce ? 0 : 300); }
    else if (act === 'accmode') { if (ACC.mode !== a.dataset.val) { ACC.mode = a.dataset.val; accRedraw(); } }
    else if (act === 'acceye') {
      const sh = a.closest('.panel');
      const show = $('[data-act="accpass"]', sh).type === 'password';
      $$('input[type="password"], input[data-pw]', sh).forEach((x) => { x.type = show ? 'text' : 'password'; x.dataset.pw = '1'; });
      a.innerHTML = show ? I.eyeOff : I.eye;
      a.setAttribute('aria-label', show ? 'Passwort verbergen' : 'Passwort zeigen');
    }
    else if (act === 'accfirst') accFirst(a.dataset.val);
    else if (act === 'accsync') { syncNow().then((r) => { if (r && r.ok) toast(r.changed.size ? 'Abgeglichen – Neues vom anderen Gerät geholt' : 'Abgeglichen – alles aktuell'); else if (r) toast(ACC.err || 'Der Abgleich hat nicht geklappt.'); }); refreshAccBtns(); }
    else if (act === 'acclogout') accLogout();
    else if (act === 'accdel') accDelAsk();
    else if (act === 'close') { closeSheet(); SC.fix = null; }
    // Scannen
    else if (act === 'scanpaste') scanPaste();
    else if (act === 'invgo') inviteGo();
    else if (act === 'invagain') { const f = SC.file; inviteSheet(() => { if (f) startScan(f); }); }
    else if (act === 'sctake' || act === 'scnew') { const b = takeSlip(a.dataset.id, a.dataset.i, act === 'scnew'); if (b) afterTake([b]); }
    else if (act === 'sctakeall') takeAll(a.dataset.id);
    else if (act === 'scfill') fillSlip(a.dataset.id, a.dataset.i);
    else if (act === 'scupd') updateFromSlip(a.dataset.id, a.dataset.i);
    else if (act === 'scleg') openLegFix(a.dataset.id, a.dataset.i, a.dataset.l);
    else if (act === 'scgame') scanFix(a.dataset.g);
    else if (act === 'scunlink') scanFix(null);
    // Wette eintragen / bearbeiten
    else if (act === 'newbet') afterSheet(() => openBetSheet({ src: 'manual', legs: [] }));
    else if (act === 'betsave') saveDraft();
    else if (act === 'bchip') { if (d) { d.stake = +a.dataset.val; const inp = $('[data-act="bstake"]', a.closest('.panel')); if (inp) inp.value = nf2.format(d.stake); updateWin(); } }
    else if (act === 'bstatus') { if (d && d.status !== a.dataset.val) { d.status = a.dataset.val; redrawDraft(); } }
    else if (act === 'legadd') { if (d) { startLeg(); drawDraft(); } }
    else if (act === 'legdel') { if (d) { d.legs.splice(+a.dataset.i, 1); autoQ(d); redrawDraft(); } }
    else if (act === 'legback') { if (d && !d.legs.length) { B.draft = null; closeSheet(); } else if (d) { d.leg = null; d.view = 'main'; drawDraft(); } }
    else if (act === 'legok') legOk();
    else if (act === 'lpick') { if (d && d.leg) { d.leg.code = a.dataset.val; redrawDraft(); const o = $('.sheet [data-act="lother"]'); if (o && d.leg.code === 'x') o.focus(); } }
    else if (act === 'lgame') { const r = G.byGid[a.dataset.g]; if (d && d.leg && r) { Object.assign(d.leg, legFromRow(r)); d.leg.event = null; redrawDraft(); } }
    else if (act === 'lgclear') { if (d && d.leg) { ['g', 'slug', 't', 'comp', 'home', 'away'].forEach((k) => { delete d.leg[k]; }); d.gq = ''; redrawDraft(); } }
    // Wetten abrechnen, Cashout, löschen
    else if (act === 'betview') openBetView(a.dataset.id);
    else if (act === 'settle') { const id = a.dataset.id; const v = a.dataset.val; afterSheet(() => settleManual(id, v)); }
    else if (act === 'cashout') { const id = a.dataset.id; afterSheet(() => openCashSheet(id)); }
    else if (act === 'cashgo') cashGo(a.dataset.id);
    else if (act === 'editbet') { const id = a.dataset.id; afterSheet(() => editBet(id)); }
    else if (act === 'delbet') {
      // zweimal tippen: erst „Wirklich löschen?“, dann weg
      if (!a.classList.contains('arm')) { a.classList.add('arm'); a.textContent = 'Wirklich löschen?'; setTimeout(() => { if (a.isConnected) { a.classList.remove('arm'); a.textContent = 'Löschen'; } }, 3000); }
      else { const id = a.dataset.id; afterSheet(() => deleteBet(id)); }
    }
    // Wetten-Seite
    else if (act === 'btab') betsTab(a.dataset.val);
    else if (act === 'bfilter') { if (B.filter !== a.dataset.val) { B.filter = a.dataset.val; B.doneAll = false; betsRedrawBody(); } }
    else if (act === 'bdmore') { B.doneAll = true; betsRedrawBody(); }
    else if (act === 'betsgo') { B.tab = a.dataset.val; B.filter = 'all'; afterSheet(() => goTab('/bets')); }
    else if (act === 'calgo') calShift(+a.dataset.val);
    else if (act === 'calmonth') calShift(0, +a.dataset.val);
    else if (act === 'calday') calPick(+a.dataset.val);
    // Kasse und Statistik
    else if (act === 'wallet') afterSheet(() => openWalletSheet(a.dataset.val));
    else if (act === 'wsave') saveWallet(a.dataset.mode);
    else if (act === 'wreset') walletResetAsk();
    else if (act === 'wresetgo') walletReset();
    else if (act === 'limits') afterSheet(openLimitSheet);
    else if (act === 'limsave') saveLimits();
    else if (act === 'csv') exportCsv();
    else if (act === 'mlook') {
      store.set('mlook', a.dataset.val);
      $$('.lk', a.closest('.looks')).forEach((x) => x.classList.toggle('on', x === a));
      $$('.mh').forEach((mh) => { mh.dataset.look = a.dataset.val; });
      haptic();
    }
    else if (act === 'mperiod') { if (B.period !== a.dataset.val) { B.period = a.dataset.val; B.more = false; heroSwitch(); } }
    else if (act === 'bsplit') {
      if (B.split === a.dataset.val) return;
      B.split = a.dataset.val;
      const c = a.closest('.card');
      $$('.sp-chips button', c).forEach((x) => x.classList.toggle('on', x === a));
      const srs = $('.srs', c);
      srs.innerHTML = splitRows(betsFrom(periodFrom()));
      replay(srs, 'in');
    }
    else if (act === 'lgmore') { B.more = !B.more; redrawTop(); }
    else if (act === 'barpick') {
      const c = a.closest('.card');
      const i = +a.dataset.i;
      $$('.bm', c).forEach((g, k) => g.classList.toggle('dim', k !== i));
      if (CH.bars) $('.bc-read', c).innerHTML = bucketRead(CH.bars.bk[i], CH.bars.unit);
    }
    // KI-Zentrale
    else if (act === 'ki') location.hash = '#/ki';
    else if (act === 'kick') kickNow();
    else if (act === 'kirun') { K.open[a.dataset.k] = !K.open[a.dataset.k]; redrawTop(); }
    // Bereiche, Darstellung, Gerät
    else if (act === 'tab') goTab(a.dataset.tab);
    else if (act === 'theme') {
      const seg = a.closest('.seg');
      if (seg.dataset.v === a.dataset.val) return;
      const wasDark = isDark();
      applyTheme(a.dataset.val);
      seg.dataset.v = a.dataset.val;
      seg.style.setProperty('--k', $$('button', seg).indexOf(a));
      $$('button', seg).forEach((b) => b.classList.toggle('on', b === a));
      if (isDark() !== wasDark) redrawAll();
    } else if (act === 'device') {
      const seg = a.closest('.seg');
      applyDevice(a.dataset.val);
      seg.style.setProperty('--k', $$('button', seg).indexOf(a));
      $$('button', seg).forEach((b) => b.classList.toggle('on', b === a));
      const note = $('.dev-note');
      if (note) note.textContent = deviceNote(a.dataset.val);
      redrawAll(); // Diagramme passen sich der neuen Breite an
    }
  });
  document.addEventListener('change', (e) => {
    const t = e.target;
    if (!t.dataset) return;
    const d = B.draft;
    if (t.dataset.act === 'scanpic') { const f = t.files && t.files[0]; t.value = ''; if (f) afterSheet(() => startScan(f)); }
    else if (t.dataset.act === 'bfree' && d) { d.free = t.checked; updateWin(); }
    else if (t.dataset.act === 'bold' && d) { d.old = t.checked; redrawDraft(); }
    else if (t.dataset.act === 'bwin' && d) updateWin(); // leer gelassen: wieder Einsatz × Quote
  });
  document.addEventListener('input', (e) => {
    const t = e.target;
    if (!t.dataset) return;
    const act = t.dataset.act;
    const d = B.draft;
    if (act === 'name') { store.set('name', t.value.trim()); $$('.hello h1').forEach((x) => { x.textContent = greet(); }); }
    else if (act === 'invite') {
      store.set('invite', t.value.trim());
      clearTimeout(invT);
      const sh = t.closest('.sheet');
      invT = setTimeout(() => checkInvite(sh), 700);
    }
    else if (act === 'fixsearch') { const g = $('.sheet .gres'); if (g) g.innerHTML = gameList(t.value, 'scgame'); }
    else if (!d) return;
    else if (act === 'bq') { d.q = dec(t.value); d.qSet = !!t.value.trim(); updateWin(); }
    else if (act === 'bstake') { d.stake = dec(t.value); updateWin(); }
    else if (act === 'bwin') {
      const v = t.value.trim();
      d.winSrc = v ? 'user' : 'auto';
      d.win = v ? dec(v) : null;
      const src = $('.sheet .bs-src');
      if (src) src.textContent = v ? 'selbst eingetragen' : '';
    }
    else if (act === 'bcash') d.cash = dec(t.value);
    else if (act === 'bbookie') d.bookie = t.value;
    else if (act === 'bday') d.day = t.value;
    else if (act === 'gsearch') { d.gq = t.value; const g = $('.sheet .gres'); if (g) g.innerHTML = gameList(t.value, 'lgame'); }
    else if (act === 'lq' && d.leg) d.leg.q = dec(t.value);
    else if (act === 'lother' && d.leg) d.leg.other = t.value;
    else if (act === 'levent' && d.leg) d.leg.event = t.value;
  });
  // Eingabetaste: Code prüfen, Cashout übernehmen, Suche schließt die Tastatur
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' || !e.target.dataset) return;
    if (e.target.getAttribute && e.target.getAttribute('role') === 'button' && e.target.dataset.act) { e.preventDefault(); e.target.click(); return; }
    const act = e.target.dataset.act;
    if (act === 'invcode') { e.preventDefault(); inviteGo(); }
    else if (act === 'cashin') { const b = $('.sheet [data-act="cashgo"]'); if (b) { e.preventDefault(); cashGo(b.dataset.id); } }
    else if (act === 'gsearch' || act === 'fixsearch') { e.preventDefault(); e.target.blur(); }
  });

  // Antippen: kurz abdunkeln statt zusammenziehen (iPhone-Regel); erst nach kurzem Halten, beim Scrollen gar nicht
  (() => {
    const PRESS = '.tk[data-act], button.li, .qa-b, .mact button, .bd-acts button, .bd-foot button, .mh-btn, .wc[data-act], .bl-x, .bl-fix, .bf-add, a.row, button.row, .btn, .round, .sbtn, .seg button, .tabbar button, .chips button, .kib, .pseg button, .more, .cal-nav, button.cd, .cy, .lk';
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

  // offene Wetten: gleich nach dem Start prüfen, solange ein Spiel läuft jede Minute
  setTimeout(() => checkBets(), 1500);
  setInterval(() => { if (!document.hidden && liveBets()) checkBets(); }, 60e3);

  // ------------------------------------------------------------------ Start: Startseite unten im Stapel; Direktlink obendrauf
  applyTheme(store.get('theme', 'light'));
  applyDevice(store.get('device', deviceGuess()));
  /* iPad: Karten in Spalten ohne Lücken. Das Raster hat Mini-Zeilen von 1 px, jede Karte belegt so viele, wie sie hoch ist – die Reihenfolge
     im Dokument bleibt, nichts wird umgehängt. Läuft nach jeder Änderung an den Seiten. */
  let packT = 0;
  function ipadPack() {
    clearTimeout(packT);
    packT = setTimeout(() => {
      if (!ipadWide()) return;
      $$('.ovw, .ovg, .wrap[data-p="ki"], .wrap[data-p="home"], .blist.dl').forEach((box) => {
        [...box.children].forEach((c) => {
          if (getComputedStyle(c).position === 'absolute') return;
          c.style.gridRowEnd = `span ${Math.max(1, c.offsetHeight + 18)}`;
        });
      });
    }, 40);
  }
  try { new MutationObserver(ipadPack).observe(document.body, { childList: true, subtree: true }); } catch (e) { /* sehr alte Browser: dann eben nicht gepackt */ }
  let rzW = innerWidth;
  let rzT = 0;
  addEventListener('resize', () => {
    if (Math.abs(innerWidth - rzW) < 40) return;
    rzW = innerWidth;
    clearTimeout(rzT);
    rzT = setTimeout(() => { if (document.documentElement.dataset.device === 'ipad') redrawAll(); ipadPack(); }, 180);
  });
  const start = fixPath();
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
    afterShow(p);
  } else {
    afterShow(home);
  }
  // Ladebildschirm: blendet weich aus, sobald die Startseite steht (auf den Spielplan höchstens 1,2 Sekunden warten)
  (() => {
    const sp = $('#splash');
    if (!sp) return;
    const t0 = performance.now();
    Promise.race([loadGames().catch(() => {}), new Promise((r) => setTimeout(r, 1200))]).then(() => {
      refreshKib();
      setTimeout(() => { sp.classList.add('out'); reveal(curPage()); setTimeout(() => sp.remove(), reduce ? 0 : 400); }, reduce ? 0 : Math.max(60, 600 - (performance.now() - t0)));
    });
  })();
  // Konto: beim Start, alle 3 Minuten (solange die App offen ist) und wenn das Netz zurückkommt abgleichen
  if (authOf()) syncSoon(600);
  setInterval(() => { if (authOf() && !document.hidden) syncNow(); }, 180e3);
  addEventListener('online', () => { if (authOf()) syncSoon(300); });
  // zurück aus dem Hintergrund: Neues vom anderen Gerät holen, nach dem Abpfiff sofort abrechnen, Spielplan auffrischen
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) return;
    if (authOf()) syncSoon(150);
    checkBets();
    loadGames().then(refreshKib, refreshKib);
  });
})();
