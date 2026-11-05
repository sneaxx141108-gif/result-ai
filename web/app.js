/* Result AI – App. Hash-Routen: #/ Start, #/scan Screenshot wird gelesen, #/r/<id> Ergebnis, #/md Spieltag, #/acc Treffsicherheit.
   Die Prozente rechnet engine.js (RE) – exakt, ohne Zufall, ohne KI. Die KI (Screenshot lesen, Internet-Recherche) läuft
   später über den Cloudflare-Server; bis dahin zeigt die App Beispiel-Spiele.
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
  const nf1 = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const nf2 = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const pct1 = (p) => (p < 0.001 ? '<0,1 %' : nf1.format(p * 100) + ' %');
  const pct0 = (p) => (p < 0.005 ? '<1 %' : Math.round(p * 100) + ' %');
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
    clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg>',
  };
  const logo = (cls = '') => `<svg class="${cls}" viewBox="0 0 36 36" aria-hidden="true"><g fill="none" stroke-width="5" stroke-linecap="round" transform="rotate(-90 18 18)">
    <circle class="ring-a" cx="18" cy="18" r="13" pathLength="100" stroke="var(--text)" stroke-dasharray="44 56"/>
    <circle class="ring-b" cx="18" cy="18" r="13" pathLength="100" stroke="var(--faint)" stroke-dasharray="20 80" stroke-dashoffset="-52"/>
    <circle class="ring-c" cx="18" cy="18" r="13" pathLength="100" stroke="var(--draw)" stroke-dasharray="16 84" stroke-dashoffset="-80"/></g></svg>`;
  const decoRing = '<svg class="deco" viewBox="0 0 36 36" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" transform="rotate(-90 18 18)"><circle cx="18" cy="18" r="13" pathLength="100" stroke-dasharray="44 56"/><circle cx="18" cy="18" r="13" pathLength="100" stroke-dasharray="20 80" stroke-dashoffset="-52"/><circle cx="18" cy="18" r="13" pathLength="100" stroke-dasharray="16 84" stroke-dashoffset="-80"/></g></svg>';

  // ------------------------------------------------------------------ Darstellung: hell (Standard) oder dunkel
  const isDark = () => document.documentElement.dataset.theme === 'dark';
  function applyTheme(t) {
    const dark = t === 'dark';
    if (dark) document.documentElement.dataset.theme = 'dark'; else delete document.documentElement.dataset.theme;
    const mt = $('meta[name="theme-color"]');
    if (mt) mt.setAttribute('content', dark ? '#000000' : '#FFFFFF');
    store.set('theme', dark ? 'dark' : 'light');
  }

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
  // rote Karten: Kärtchen am Wappen und „zu zehnt“ im Untertitel
  const redCards = (m, i) => { const n = (m.reds && m.reds[i]) || 0; return n ? `<span class="rcs" role="img" aria-label="${n} Rote Karte${n > 1 ? 'n' : ''}">${'<i></i>'.repeat(Math.min(n, 3))}</span>` : ''; };
  const shortHanded = (m) => [0, 1].map((i) => { const n = (m.reds && m.reds[i]) || 0; return n ? ` · ${esc(i ? m.away : m.home)} zu ${['', 'zehnt', 'neunt', 'acht'][Math.min(n, 3)]}` : ''; }).join('');
  // Spiel-Karte: scharfer Schnitt zwischen den Vereinsfarben mit feiner heller Naht (wie eine TV-Grafik)
  const teamBg = (m) => {
    const h = teamColor(m.home);
    const w = teamColor(m.away);
    return `linear-gradient(102deg, ${h} 0%, ${h} 49.7%, rgba(255,255,255,.6) 49.7%, rgba(255,255,255,.6) 50.2%, ${w} 50.2%, ${w} 100%)`;
  };
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

  // ------------------------------------------------------------------ Beispiel-Spiele (ausgedacht, mit echter Mathe gerechnet)
  const DEMO = {
    live: { id: 'live', kind: 'live', comp: 'Premier League', home: 'Arsenal', away: 'Chelsea', minute: 63, half: 2, score: [1, 1], reds: [0, 0], lh: 1.75, la: 1.05 },
    pre: { id: 'pre', kind: 'pre', comp: 'Bundesliga', home: 'Bayern', away: 'Dortmund', when: 'Sa., 18:30', lh: 2.35, la: 1.05 },
    odds: { id: 'odds', kind: 'odds', comp: 'LaLiga', home: 'Real Madrid', away: 'Barcelona', when: 'So., 21:00', lh: 1.55, la: 1.5,
      odds: { home: 2.3, draw: 3.7, away: 2.9, line: 2.5, over: 1.65, under: 2.2 } },
  };
  const MD = { id: 'md', comp: 'Bundesliga · 10. Spieltag', games: [
    { home: 'Leipzig', away: 'Freiburg', lh: 1.7, la: 1.1 }, { home: 'Leverkusen', away: 'Stuttgart', lh: 1.9, la: 1.3 },
    { home: 'Bremen', away: 'Mainz', lh: 1.4, la: 1.3 }, { home: 'Union', away: 'HSV', lh: 1.3, la: 1.2 }] };
  MD.games.forEach((g, i) => Object.assign(g, { id: 'md-' + i, kind: 'pre', comp: 'Bundesliga', when: 'Sa., 15:30', fromMd: true }));
  // gespeicherte Wappen/Farben eines Spiels wieder anmelden (Verlauf nach dem Neustart der App)
  const regTeams = (m) => { if (m && m.teams) Object.keys(m.teams).forEach((n) => { REG[n] = m.teams[n]; }); };
  function findMatch(id) {
    if (id.startsWith('t_')) return tipMatchById(id);
    const m = DEMO[id] || MD.games.find((g) => g.id === id) || store.get('history', []).find((h) => h.id === id) || null;
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
  const analyze = (m) => RE.analyze({ lh: m.lh, la: m.la, minute: m.minute, half: m.half, score: m.score, reds: m.reds, finished: m.finished });
  // die wahrscheinlichste der drei Möglichkeiten
  function lead(m, a) {
    const o = [['home', a.probs.home, `Siegchance ${m.home}`], ['draw', a.probs.draw, 'Chance auf Remis'], ['away', a.probs.away, `Siegchance ${m.away}`]];
    return o.sort((x, y) => y[1] - x[1])[0];
  }

  // ------------------------------------------------------------------ Seiten
  const S = { stack: [], busy: false, pending: false, swipe: null, url: null, timers: [], tabScroll: {} };
  // Leiste unten: vier Bereiche mit eigener Startseite (wie die Tab-Leiste einer iPhone-App)
  const TABS = [['/', 'Start', 'home'], ['/tips', 'Top-Tipps', 'flame'], ['/pick', 'Auswählen', 'search'], ['/hist', 'Verlauf', 'clock']];
  const isTab = (p) => TABS.some((t) => t[0] === p);
  const TITLES = { '/': '', '/scan': 'Analyse', '/md': 'Spieltag', '/acc': 'Treffsicherheit', '/pick': 'Spiel auswählen', '/tips': 'Top-Tipps', '/hist': 'Verlauf' };
  const titleOf = (path) => (path in TITLES ? TITLES[path] : 'Ergebnis');
  function barHtml(path) {
    let tt = esc(titleOf(path));
    if (path.startsWith('/r/')) { const m = findMatch(decodeURIComponent(path.slice(3))); if (m) tt = miniMatch(m); }
    const lead = path === '/' ? `<span class="brand">${logo('intro-logo')}<span>Result AI</span></span>`
      : isTab(path) ? '' : `<button class="round" data-act="back" aria-label="Zurück">${I.back}</button>`;
    return `<header class="bar">${lead}<span class="tt">${tt}</span>
      <span class="end"><button class="round" data-act="settings" aria-label="Einstellungen">${I.gear}</button></span></header>`;
  }
  function viewHtml(path) {
    if (path === '/') return vHome();
    if (path === '/scan') return vScan();
    if (path === '/md') return vMatchday();
    if (path === '/acc') return vAccuracy();
    if (path === '/pick') return vPick();
    if (path === '/tips') return vTips();
    if (path === '/hist') return vHist();
    if (path.startsWith('/r/')) return vResult(decodeURIComponent(path.slice(3)));
    return vHome();
  }

  // ------------------------------------------------------------------ Startseite
  function vHome() {
    const hist = store.get('history', []);
    const card = (m) => {
      const a = analyze(m);
      const [k, p] = lead(m, a);
      const short = (n) => esc(n.length > 11 ? n.split(' ').pop() : n);
      return `<a class="gcard teamcard" href="#/r/${m.id}" style="background:${teamBg(m)};--gl:${rgba(teamColor(m.home), 0.6)};--gr:${rgba(teamColor(m.away), 0.6)}">${wm(m.home, 'l')}${wm(m.away, 'r')}
        <div class="gt"><span>${esc(m.comp)}</span>${m.kind === 'live' ? `<span class="chip live">${m.minute}'</span>` : `<span class="chip glass">${esc(m.kind === 'odds' ? 'Quoten' : m.when)}</span>`}</div>
        <div class="gv">${plate(m.home, 54)}<div class="gm">${m.score ? `${m.score[0]}:${m.score[1]}` : 'VS'}<small>${short(m.home)} – ${short(m.away)}</small></div>${plate(m.away, 54)}</div>
        <div><div class="gf"><b>${Math.round(p * 100)} %</b><span>${k === 'draw' ? 'Remis' : 'Sieg ' + esc(k === 'home' ? m.home : m.away)}</span></div>
        <div class="wbar"><i style="flex:${a.probs.home};background:#fff"></i><i style="flex:${a.probs.draw};background:rgba(255,255,255,.4)"></i><i style="flex:${a.probs.away};background:rgba(255,255,255,.72)"></i></div></div></a>`;
    };
    const mdCard = `<a class="gcard md" href="#/md"><div class="gt"><span class="muted">${esc(MD.comp.split(' · ')[0])}</span><span class="chip">${MD.games.length} Spiele</span></div>
      <div class="mdl">${MD.games.slice(0, 3).map((g) => `<div>${crest(g.home, 24)}${esc(g.home)} <span class="faint">–</span> ${esc(g.away)}</div>`).join('')}</div>
      <div class="gf"><b style="font-size:24px">Ganzer Spieltag</b><span class="muted">›</span></div></a>`;
    return `<section class="hero"><h1>Screenshot rein.<br><span>Prozente raus.</span></h1></section>
      <section class="scan-card">${decoRing}<span class="ic">${I.scan}</span>
        <div><h2>Spiel scannen</h2><p>Live-Spiel, Paarung, ganzer Spieltag oder Quoten – Result AI rechnet, wer gewinnt.</p></div>
        <div class="acts"><label class="sbtn">${I.photo}<span>Fotos</span><input type="file" accept="image/*" data-act="pick" aria-label="Screenshot aus Fotos wählen"></label>
          <label class="sbtn alt">${I.cam}<span>Kamera</span><input type="file" accept="image/*" capture="environment" data-act="pick" aria-label="Foto mit der Kamera machen"></label></div>
        <button class="demo-scan" data-act="demoscan">${I.scan}<span>Beispiel-Scan ansehen</span><span class="chev">›</span></button></section>
      <a class="card pickrow" href="#/pick"><span class="round">${I.search}</span><span class="grow"><div class="t">Spiel selbst auswählen</div><div class="s">Teams aus 38 Ligen · ohne Screenshot</div></span><span class="chev">›</span></a>
      <section class="sec"><div class="sec-h"><h2>Top-Tipps</h2><button class="note link" data-act="tab" data-tab="/tips">Alle ›</button></div><div class="tips-prev">${tipsPreview()}</div></section>
      <section class="sec"><div class="sec-h"><h2>Beispiele</h2><span class="note">ausgedacht · echte Rechnung</span></div>
        <div class="ex-row">${card(DEMO.live)}${card(DEMO.pre)}${card(DEMO.odds)}${mdCard}</div></section>
      <section class="sec"><div class="sec-h"><h2>Zuletzt</h2>${hist.length > 3 ? '<button class="note link" data-act="tab" data-tab="/hist">Alle ›</button>' : ''}</div>
        ${hist.length ? `<div class="group">${hist.slice(0, 3).map(histRow).join('')}</div>`
        : '<div class="empty">Noch keine Prognosen. Wähl ein Spiel aus oder scanne einen Screenshot – alles landet hier.</div>'}</section>
      <p class="foot">Vorschau-Version · Die KI zum Lesen der Screenshots wird gerade angeschlossen.</p>`;
  }

  // ------------------------------------------------------------------ Scan (Screenshot wird gelesen)
  // Beispiel-Screenshot (so sieht ein Live-Spiel in einer Fußball-App aus) – zeigt, wie Result AI liest
  const demoShot = () => `<div class="mock" aria-hidden="true"><div class="mk-bar"><span>20:41</span><span>5G ▮▮▮</span></div>
    <div class="mk-head">Premier League · 11. Spieltag</div>
    <div class="mk-sb"><div class="mk-team" data-box="t1" data-label="Arsenal"><i style="background:#EF0107"></i><b>Arsenal</b></div>
      <div class="mk-mid"><b data-box="sc" data-label="Stand 1:1">1 – 1</b><span data-box="mn" data-label="63. Minute">63'</span></div>
      <div class="mk-team" data-box="t2" data-label="Chelsea"><i style="background:#034694"></i><b>Chelsea</b></div></div>
    <div class="mk-ev"><span>⚽ Saka 21'</span><span>Palmer 48' ⚽</span></div>
    <div class="mk-stats">${[['54 %', 'Ballbesitz', '46 %'], ['11', 'Schüsse', '7'], ['1,42', 'xG', '0,88'], ['5', 'Ecken', '3']].map(([x, l, y]) => `<div><b>${x}</b><span>${l}</span><b>${y}</b></div>`).join('')}</div></div>`;
  function vScan() {
    if (!S.url && !S.demo) return '<h1 class="ptitle">Analyse</h1><div class="empty" style="margin-top:18px">Kein Screenshot gewählt.</div><div style="margin-top:12px"><button class="btn" data-act="home">Zum Start</button></div>';
    return `<div class="scan-frame${S.demo ? ' demo' : ''}" id="frame">${S.demo ? demoShot() : `<img src="${S.url}" alt="Dein Screenshot">`}<span class="grid"></span><span class="beam"></span>
        <span class="corner tl"></span><span class="corner tr"></span><span class="corner bl"></span><span class="corner br"></span></div>
      <div class="steps">${['Screenshot geladen', 'Teams, Spielstand und Minute erkennen', 'Stärken und Quoten nachschlagen', 'Alle Ergebnisse durchrechnen']
        .map((t, i) => `<div class="step"><i>${i + 1}</i><span>${t}</span></div>`).join('')}</div>
      <div class="notice-slot"></div>`;
  }
  function runScan(el) {
    const fr = $('#frame', el);
    if (!fr) return;
    S.timers.forEach(clearTimeout);
    S.timers = [];
    fr.classList.add('scanning');
    const steps = $$('.step', el);
    const at = (ms, fn) => S.timers.push(setTimeout(fn, reduce ? 0 : ms));
    const done = (i) => { steps[i].classList.add('done'); $('i', steps[i]).textContent = '✓'; if (steps[i + 1]) steps[i + 1].classList.add('on'); };
    at(150, () => steps[0].classList.add('on'));
    at(750, () => done(0));
    if (S.demo) {
      // Beispiel: die erkannten Felder leuchten nacheinander auf, dann verwandelt sich der Screenshot in die Prognose
      $$('[data-box]', fr).forEach((b, i) => at(1150 + i * 420, () => { b.classList.add('hit'); haptic(); }));
      at(2950, () => done(1));
      at(3550, () => done(2));
      at(4150, () => { done(3); fr.classList.remove('scanning'); fr.classList.add('found'); });
      at(4750, () => {
        if (S.stack[S.stack.length - 1].el !== el) return;
        S.morph = { el: fr, rect: fr.getBoundingClientRect(), t: performance.now() };
        location.replace('#/r/live');
      });
      return;
    }
    // Abgehakt wird nur, was wirklich passiert ist: Screenshot geladen. Lesen kann ihn erst die KI auf dem Server.
    at(2600, () => {
      fr.classList.remove('scanning');
      $('.notice-slot', el).innerHTML = `<div class="notice"><b>Die KI wird gerade angeschlossen</b>
        <p>Dein Screenshot ist angekommen. Lesen kann Result AI ihn, sobald der Server mit der KI steht. Erfunden wird nichts – deshalb hier noch kein Ergebnis.</p>
        <a class="btn" href="#/pick">Spiel selbst auswählen</a><button class="btn soft" data-act="demoscan">Beispiel-Scan ansehen</button></div>`;
    });
  }

  // ------------------------------------------------------------------ Ergebnis
  // Zahl als Zählwerk: jede Ziffer ist eine Rolle 0–9 0–9, die auf ihre Ziffer im zweiten Durchlauf rollt (nur transform)
  function roller(n) {
    const ds = String(n).split('');
    const strip = '01234567890123456789'.split('').map((x) => `<span>${x}</span>`).join('');
    return `<span class="roll" aria-hidden="true">${ds.map((d, i) => `<span class="rc"><span class="rs" style="--to:${10 + +d};--dl:${(i * 0.1).toFixed(2)}s">${strip}</span></span>`).join('')}</span><span class="sr">${n} Prozent</span>`;
  }
  // großes Wappen als Wasserzeichen auf der Spiel-Karte
  const wm = (name, side) => { const src = logoSrc(name, false, 200); return src ? `<span class="wm ${side}" aria-hidden="true"><img src="${src}" alt="" decoding="async"${cors(src)}></span>` : ''; };
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
    const secs = [['ov', 'Übersicht'], hasTips ? ['tp', 'Tipps'] : null, ['er', 'Ergebnisse'], m.kind === 'odds' ? ['mk', 'Markt'] : null,
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
      <div class="match-top">${live ? `<span class="chip live">LIVE ${m.minute}'</span>` : `<span class="chip glass">${m.kind === 'odds' ? 'Quoten' : 'Vor dem Spiel'}</span>`}<span class="chip glass">${esc(m.comp)}</span><span class="when">${esc(live ? (m.half === 2 ? '2. Halbzeit' : '1. Halbzeit') : m.when || '')}</span></div>
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
    out += `</div><p class="foot">${m.src === 'tips' ? 'Chancen aus den Buchmacher-Quoten (DraftKings über ESPN), Tore zusätzlich mit Result AI · jede Stunde neu gesucht.<br>' : ''}${m.fromMd || DEMO[m.id] ? 'Beispiel-Spiel (ausgedacht) – die Rechnung ist echt.<br>' : ''}${m.src === 'ratings' ? `Mit den Team-Stärken vom ${esc(fmtDay(m.day))} (38 Ligen + Europapokal).<br>` : ''}Poisson-Tormodell mit Dixon-Coles · exakt, ohne Zufall.<br>Gleiches Spiel am selben Tag = gleiche Zahlen.</p></div>`;
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
    return `<section class="card" data-sec="mk" style="--i:${i}"><div class="card-h"><h3>Markt vs. Result AI</h3><span class="note">${nf2.format(m.odds.home)} · ${nf2.format(m.odds.draw)} · ${nf2.format(m.odds.away)}</span></div>
      <div class="cmp-row h"><span>Ausgang</span><span class="v">Markt</span><span class="v">Result AI</span></div>
      ${row(`Sieg ${esc(m.home)}`, q.market.home, own && own.probs.home)}${row('Remis', q.market.draw, own && own.probs.draw)}${row(`Sieg ${esc(m.away)}`, q.market.away, own && own.probs.away)}
      ${row('Über 2,5 Tore', ov(mk), ov(own))}
      <p class="muted" style="font-size:13px;margin-top:10px">Markt = aus den Quoten, ohne die Marge der Buchmacher (${nf1.format(q.market.margin * 100)} %). Result AI = eigene Rechnung aus den Team-Stärken${own ? '' : ' – für dieses Spiel zu wenig Daten'}.</p></section>`;
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
    ps.push('<span class="muted">Mit angeschlossener KI kommt hier ein Formcheck dazu: letzte Spiele, Ausfälle und was die Buchmacher erwarten.</span>');
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
      const sc = t ? teamColor(reg(t)) : null;
      return `<button class="slot ${t ? 'set' : ''}" data-act="slot" data-side="${side}"${sc ? ` style="--sg:${rgba(sc, 0.16)};--sgd:${rgba(sc, 0.32)}"` : ''}>${t ? crest(reg(t), 46) : `<span class="slot-ph">${I.search}</span>`}
        <span class="grow"><span class="slot-l">${label}</span><span class="slot-n">${t ? esc(tName(t)) : 'Team suchen'}</span>${t ? `<span class="slot-s">${esc(lgName(t.lg))}</span>` : ''}</span><span class="chev">›</span></button>`;
    };
    return `<h1 class="ptitle">Spiel auswählen</h1><p class="psub">Zwei Teams suchen – Result AI rechnet mit den Stärken von heute.</p>
      <div class="card pick" style="margin-top:18px">${slot('home', 'Heim')}<div class="pick-vs"><span>gegen</span>${P.home || P.away ? `<button class="swap" data-act="swap" aria-label="Heim und Gast tauschen">${I.swap}</button>` : ''}</div>${slot('away', 'Gast')}</div>
      <div class="card opts" style="margin-top:14px">
        <label class="tgl"><span class="grow"><b>Neutraler Platz</b><small>z. B. ein Finale – ohne Heimvorteil</small></span><input type="checkbox" data-act="opt" data-k="neutral" ${P.neutral ? 'checked' : ''}><i></i></label>
        <label class="tgl"><span class="grow"><b>Spiel läuft schon</b><small>Spielstand, Minute und rote Karten eingeben</small></span><input type="checkbox" data-act="opt" data-k="live" ${P.live ? 'checked' : ''}><i></i></label>
        ${P.live ? liveInputs() : ''}</div>
      ${P.msg ? `<div class="notice"><b>Das rechnet Result AI so nicht</b><p>${P.msg}</p></div>` : ''}
      <div style="margin-top:16px"><button class="btn" data-act="calc" ${P.home && P.away ? '' : 'disabled'}>Prognose berechnen</button></div>
      <p class="foot">Stärken vom ${esc(fmtDay(d.updatedAt))} · ${d.teams.length} Teams aus ${d.leagues.length} Ligen + Europapokal<br>Jeden Morgen neu gerechnet – am selben Tag immer dieselben Zahlen.</p>`;
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
      <input class="search" type="search" placeholder="z. B. BVB, Arsenal, Flamengo …" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" enterkeyhint="search" data-act="search" data-side="${side}" aria-label="Team suchen">
      <div class="results"></div></div>`;
    document.body.appendChild(sh);
    renderResults(sh, '');
    $('input', sh).focus(); // noch im Antippen, sonst öffnet iOS die Tastatur nicht
  }
  function renderResults(sh, q) {
    const side = $('input', sh).dataset.side;
    const rows = (list) => `<div class="card flush">${list.map((t) => `<button class="row res-row" data-act="choose" data-id="${esc(t.id)}" data-side="${side}">${crest(reg(t), 34)}<span class="grow"><div class="t">${esc(tName(t))}</div><div class="s">${esc(lgName(t.lg))}</div></span></button>`).join('')}</div>`;
    let html;
    if (q.trim()) {
      const list = searchTeams(q, 14);
      html = list.length ? rows(list) : '<div class="empty">Kein Team gefunden. Versuch es mit einem anderen Namen – z. B. dem Ort.</div>';
    } else {
      const recent = store.get('recentTeams', []).map((id) => R.byId[id]).filter(Boolean);
      const top = R.data.teams.filter((t) => t.grp === 0 && t.logo && !recent.includes(t)).slice(0, 12);
      html = (recent.length ? `<div class="lab">ZULETZT GEWÄHLT</div>${rows(recent)}<div class="lab" style="margin-top:22px">BELIEBT</div>` : '<div class="lab">BELIEBT</div>') + rows(top);
    }
    $('.results', sh).innerHTML = html;
  }
  function calcPick() {
    const h = R.byId[P.home];
    const a = R.byId[P.away];
    if (!h || !a) return;
    if (h.id === a.id) { P.msg = 'Bitte zwei verschiedene Teams wählen.'; redrawTop(); return; }
    if (h.grp !== a.grp) {
      P.msg = `${esc(tName(h))} und ${esc(tName(a))} spielen in Ligen, die nie über gemeinsame Gegner verbunden waren (z. B. Europa und Südamerika). Die Zahlen wären geraten. Solche Spiele rechnet Result AI später über den Screenshot-Scan – mit den Quoten der Buchmacher.`;
      redrawTop();
      return;
    }
    P.msg = '';
    const md = R.data.model;
    const day = String(R.data.updatedAt).slice(0, 10);
    const id = ['p', h.id, a.id, P.neutral ? 'n' : 'h', P.live ? `${P.minute}-${P.score.join('-')}-${P.reds.join('-')}` : 'vor', day].join('_');
    const sameLg = h.lg && h.lg === a.lg;
    const m = { id, kind: P.live ? 'live' : 'pre', src: 'ratings', day, at: Date.now(),
      comp: sameLg ? R.leagues[h.lg].name : 'Selbst ausgewählt', when: P.neutral ? 'neutraler Platz' : sameLg ? 'selbst ausgewählt' : '',
      home: reg(h), away: reg(a), teams: { [tName(h)]: { logo: h.logo, color: h.color }, [tName(a)]: { logo: a.logo, color: a.color } },
      lh: Math.exp(md.mu + (P.neutral ? 0 : md.h) + h.att - a.def), la: Math.exp(md.mu + a.att - h.def) };
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
  // Chance = aus den Buchmacher-Quoten (Backtest: am genauesten), Tore zusätzlich mit Result AI; „≈“ = geschätzte Quote.
  const T = { data: null, loading: null, at: 0, err: false, list: 'safe', day: 'all', comp: 'all', seen: {} };
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
  const qTxt = (t) => `${t.real ? '' : '≈'}${nf2.format(t.q)}`;
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
      lh: g.lh, la: g.la, odds, model: g.mlh ? { lh: g.mlh, la: g.mla } : null, gid: g.id };
    T.seen[id] = m;
    return m;
  }
  // „Tipps zu diesem Spiel“ auf der Ergebnis-Seite
  function tipsForGame(m, i) {
    if (!T.data) return '';
    const seen = new Set();
    const list = [['safe', 'Sicher'], ['top', 'Top-Quote']].flatMap(([k, l]) => T.data[k].filter((t) => t.g === m.gid).map((t) => [t, l]))
      .filter(([t]) => !seen.has(t.m) && seen.add(t.m));
    if (!list.length) return '';
    return `<section class="card" data-sec="tp" style="--i:${i}"><div class="card-h"><h3>Top-Tipps zu diesem Spiel</h3><span class="note">jede Stunde neu</span></div>
      ${list.map(([t, l]) => `<div class="tg-row"><span class="grow"><span class="k">${l} · ${tipKind(t.m)}</span><b>${esc(tipLabel(t.m, m.home, m.away))}</b></span>${ring(t.p)}<span class="tg-q"><span>Quote</span><b>${qTxt(t)}</b></span></div>`).join('')}</section>`;
  }

  function tipCard(t, i, list) {
    const g = T.data.games[t.g];
    const h = tipTeam(g.home);
    const a = tipTeam(g.away);
    const hcl = teamColor(h);
    const acl = teamColor(a);
    return `<a class="tcard ${list}" href="#/r/t_${esc(g.id)}" style="--i:${Math.min(i, 8)};--hg:${rgba(hcl, 0.1)};--ag:${rgba(acl, 0.1)};--hgd:${rgba(hcl, 0.22)};--agd:${rgba(acl, 0.22)}">
      <div class="tc-top"><span class="tc-comp">${esc(g.comp)}</span><span class="tc-time">${esc(kickoff(g.t))}</span></div>
      <div class="tc-main"><div class="tc-teams"><span class="tm">${crest(h, 24)}<span>${esc(h)}</span></span><span class="tm">${crest(a, 24)}<span>${esc(a)}</span></span></div>${ring(t.p)}</div>
      <div class="tc-bet"><div class="grow"><span class="k">${tipKind(t.m)}</span><b>${esc(tipLabel(t.m, h, a))}</b></div><div class="tc-q"><span class="k">Quote</span><b>${qTxt(t)}</b></div></div>
      <div class="tc-foot"><span>Buchmacher ${Math.round(t.p * 100)} %</span><span>${t.pm != null ? `Result AI ${Math.round(t.pm * 100)} %` : 'Result AI: zu wenig Daten'}</span></div></a>`;
  }
  function kombisHtml(d) {
    const all = d.top.concat(d.safe);
    const cards = d.kombis.map((k) => {
      const legs = k.legs.map((l) => all.find((t) => t.g === l.g && t.m === l.m));
      if (!legs.length || !legs.every((t) => t && upcoming(t))) return ''; // ein Spiel läuft schon → nicht mehr spielbar
      return `<section class="kombi ${k.kind}"><div class="k-head"><div><span class="k-eb">${esc(k.name)}</span><h3>${legs.length} Tipps auf einem Schein</h3></div>
          <div class="k-q"><span>Gesamtquote</span><b>${nf2.format(k.q)}</b></div></div>
        <div class="k-legs">${legs.map((t) => {
          const g = d.games[t.g];
          const h = tipTeam(g.home);
          const a = tipTeam(g.away);
          return `<a class="k-leg" href="#/r/t_${esc(g.id)}"><span class="duo">${crest(h, 26, true)}${crest(a, 26, true)}</span><span class="grow"><b>${esc(tipLabel(t.m, h, a))}</b><span>${esc(h)} – ${esc(a)} · ${esc(kickoff(g.t))}</span></span><span class="k-lp"><b>${Math.round(t.p * 100)} %</b><span>${qTxt(t)}</span></span></a>`;
        }).join('')}</div>
        <div class="k-foot"><span>Chance, dass alle aufgehen</span><b>${pct0(k.p)}</b></div></section>`;
    }).join('');
    return '<p class="tl-note">Kombi = mehrere Tipps auf einem Schein: Die Quoten werden malgenommen – aber jeder einzelne Tipp muss aufgehen.</p>'
      + (cards || '<div class="empty" style="margin-top:14px">Gerade keine Kombi – die nächste Suche läuft in spätestens einer Stunde.</div>');
  }
  // Filter der Tipp-Listen: Zeitraum (3 Wochen voraus) und Wettbewerb (die wichtigsten zuerst)
  const PERIODS = [['all', 'Alle Tage'], ['0', 'Heute'], ['1', 'Morgen'], ['week', 'Diese Woche'], ['later', 'Später']];
  const inPeriod = (iso, k) => { const dd = dayDiff(iso); return k === 'all' || (k === 'week' ? dd <= 6 : k === 'later' ? dd > 6 : String(dd) === k); };
  const COMP_ORDER = ['uefa.champions', 'uefa.europa', 'uefa.europa.conf', 'ger.1', 'eng.1', 'esp.1', 'ita.1', 'fra.1', 'ger.dfb_pokal', 'ger.2',
    'eng.2', 'eng.fa', 'eng.league_cup', 'esp.copa_del_rey', 'ita.coppa_italia', 'fra.coupe_de_france', 'ned.1', 'por.1', 'tur.1'];
  function tipsBody() {
    const d = T.data;
    if (T.list === 'kombi') return kombisHtml(d);
    const all = d[T.list].filter(upcoming);
    const per = PERIODS.filter(([k]) => k === 'all' || all.some((t) => inPeriod(d.games[t.g].t, k)));
    if (!per.some(([k]) => k === T.day)) T.day = 'all';
    const byTime = all.filter((t) => inPeriod(d.games[t.g].t, T.day));
    const comps = {};
    byTime.forEach((t) => { const g = d.games[t.g]; (comps[g.slug] = comps[g.slug] || { name: g.comp, n: 0 }).n++; });
    const rank = (k) => { const x = COMP_ORDER.indexOf(k); return x < 0 ? 99 : x; };
    const order = Object.keys(comps).sort((x, y) => (rank(x) - rank(y)) || (comps[y].n - comps[x].n));
    // gleicher Name in mehreren Ländern (z. B. „Super League“) → mit Land
    const label = (k) => (order.some((o) => o !== k && comps[o].name === comps[k].name) && R.leagues[k] ? `${comps[k].name} (${R.leagues[k].country})` : comps[k].name);
    if (T.comp !== 'all' && !comps[T.comp]) T.comp = 'all';
    const shown = T.comp === 'all' ? byTime : byTime.filter((t) => d.games[t.g].slug === T.comp);
    const chips = (list, act, cur) => `<div class="chips">${list.map(([k, l]) => `<button class="${cur === k ? 'on' : ''}" data-act="${act}" data-val="${esc(k)}">${esc(l)}</button>`).join('')}</div>`;
    const note = T.list === 'safe' ? 'Chance ab 70 % bei einer Quote ab 1,20 – oben steht, worin sich Buchmacher und Result AI am einigsten sind.'
      : 'Quote ab 1,60 bei über 50 % Chance – die beste Mischung aus Quote und Chance.';
    return chips(per, 'tday', T.day) + (order.length > 1 ? chips([['all', 'Alle Wettbewerbe']].concat(order.map((k) => [k, `${label(k)} · ${comps[k].n}`])), 'tcomp', T.comp) : '')
      + `<p class="tl-note">${note}</p>` + (shown.length ? `<div class="tlist">${shown.slice(0, 40).map((t, i) => tipCard(t, i, T.list)).join('')}</div>`
      : '<div class="empty" style="margin-top:14px">Gerade keine passenden Tipps – die nächste Suche läuft in spätestens einer Stunde.</div>');
  }
  function recordHtml(d) {
    const r = d.record || {};
    const line = (key, label) => {
      const x = (r[key] || {})['30'] || { n: 0 };
      return x.n ? `<div class="rec-row"><span class="rl">${label}</span><b>${x.won} von ${x.n} richtig</b><span class="rp">${pct0(x.won / x.n)}<small>erwartet ${pct0(x.exp / x.n)}</small></span></div>`
        : `<div class="rec-row"><span class="rl">${label}</span><span class="muted">noch keine beendeten Spiele</span></div>`;
    };
    const recent = (d.recent || []).slice(0, 8).map((e) => {
      const h = tipTeam({ id: e.hid, name: e.home });
      const a = tipTeam({ id: e.aid, name: e.away });
      return `<div class="rec-it ${e.res.won ? 'won' : 'lost'}"><span class="mk">${e.res.won ? '✓' : '✗'}</span><span class="grow"><b>${esc(tipLabel(e.m, h, a))}</b><span>${esc(h)} ${e.res.hs}:${e.res.as} ${esc(a)}</span></span><span class="rp2">${pct0(e.p)}</span></div>`;
    }).join('');
    return `<section class="sec"><div class="sec-h"><h2>Bilanz</h2><span class="note">letzte 30 Tage</span></div><div class="card rec">${line('safe', 'Sicher')}${line('top', 'Top-Quote')}
      ${recent ? `<div class="rec-list">${recent}</div>` : '<p class="muted rec-empty">Läuft seit dem 5. November: Jeder angezeigte Tipp wird festgehalten und nach dem Spiel ehrlich ausgewertet – auch die, die danebengehen.</p>'}</div></section>`;
  }
  function vTips() {
    const head = '<h1 class="ptitle">Top-Tipps</h1><p class="psub">Jede Stunde neu gesucht – über 40 Ligen und Pokale, 3 Wochen voraus, inklusive Champions League.</p>';
    const d = T.data;
    if (!d) return head + `<div class="empty" style="margin-top:18px">${T.err ? 'Die Tipps konnten gerade nicht geladen werden – prüf die Verbindung.' : 'Die Tipps werden geladen …'}</div>`;
    const tabs = [['safe', 'Sicher'], ['top', 'Top-Quote'], ['kombi', 'Kombis']];
    const k = Math.max(0, tabs.findIndex((x) => x[0] === T.list));
    const upd = new Date(d.updatedAt);
    return head + `<div class="seg s3" style="--k:${k};margin-top:18px"><span class="ind"></span>${tabs.map(([v, l]) => `<button class="${T.list === v ? 'on' : ''}" data-act="tlist" data-val="${v}">${l}</button>`).join('')}</div>
      <div class="tips-body">${tipsBody()}</div>${recordHtml(d)}
      <p class="foot">Gesucht ${esc(isNaN(upd) ? '' : (dayDiff(d.updatedAt) === 0 ? 'heute' : 'am ' + upd.toLocaleDateString('de-DE')) + ' um ' + upd.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }))} · ${esc(d.source)}<br>
      Chance aus den Quoten der Buchmacher (ohne ihre Marge), Tore zusätzlich mit Result AI. „≈“ = geschätzte Quote, beim Buchmacher kann sie etwas abweichen.<br>
      Keine Garantie: Auch ein Tipp mit 80 % geht etwa jedes 5. Mal schief. Wetten erst ab 18 · Glücksspiel kann süchtig machen – Hilfe gibt es bei check-dein-spiel.de oder kostenlos unter 0800 1 37 27 00 (BZgA).</p>`;
  }
  // Startseite: die drei sichersten Tipps
  function tipsPreview() {
    if (!T.data) return `<div class="empty">${T.err ? 'Die Tipps sind gerade nicht erreichbar.' : 'Die Top-Tipps werden geladen …'}</div>`;
    const list = T.data.safe.filter(upcoming).slice(0, 3);
    if (!list.length) return '<div class="empty">Gerade keine Tipps – die nächste Suche läuft in spätestens einer Stunde.</div>';
    return `<div class="group">${list.map((t) => {
      const g = T.data.games[t.g];
      const h = tipTeam(g.home);
      const a = tipTeam(g.away);
      return `<a class="row tmini" href="#/r/t_${esc(g.id)}"><span class="duo">${crest(h, 30, true)}${crest(a, 30, true)}</span><span class="grow"><div class="t">${esc(tipLabel(t.m, h, a))}</div><div class="s">${esc(h)} – ${esc(a)} · ${esc(kickoff(g.t))}</div></span><span class="pq"><b>${Math.round(t.p * 100)} %</b><span>${qTxt(t)}</span></span></a>`;
    }).join('')}</div>`;
  }
  // Tipps (und Namen aus den Stärken) frisch holen; Seite nur neu zeichnen, wenn sich etwas geändert hat
  function freshTips(p, maxAge) {
    Promise.all([loadTips(maxAge), loadRatings().catch(() => {})]).catch(() => {}).then(() => {
      if (!p.el.isConnected) return;
      const now = { tips: T.at, ratings: !!R.data, err: T.err };
      if (p.drawn && p.drawn.tips === now.tips && p.drawn.ratings === now.ratings && p.drawn.err === now.err) return;
      if (p.path.startsWith('/r/') && p.drawn && p.drawn.tips) return; // Ergebnis-Seite steht schon
      if (p.path === '/') { $$('.tips-prev', p.el).forEach((x) => { x.innerHTML = tipsPreview(); }); p.drawn = now; } else redrawPage(p);
    });
  }

  // ------------------------------------------------------------------ Verlauf (eigener Bereich in der Leiste unten)
  function vHist() {
    const hist = store.get('history', []);
    return `<h1 class="ptitle">Verlauf</h1><p class="psub">Alle deine Prognosen – nur auf diesem Handy gespeichert.</p>
      <div class="group" style="margin-top:18px"><a class="row" href="#/acc"><span class="round">${I.target}</span><span class="grow"><div class="t">Wie oft lag Result AI richtig?</div><div class="s">${hist.length ? `${hist.length} ${hist.length === 1 ? 'Prognose' : 'Prognosen'} gespeichert · noch keine ausgewertet` : 'Nur deine Prognosen · noch keine ausgewertet'}</div></span><span class="chev">›</span></a></div>
      <section class="sec"><div class="sec-h"><h2>Deine Prognosen</h2>${hist.length ? `<span class="note">${hist.length}</span>` : ''}</div>
        ${hist.length ? `<div class="group">${hist.map(histRow).join('')}</div>` : '<div class="empty">Noch keine Prognosen. Wähl ein Spiel aus oder scanne einen Screenshot – alles landet hier.</div>'}</section>`;
  }

  // ------------------------------------------------------------------ Spieltag
  function vMatchday() {
    return `<h1 class="ptitle">Ganzer Spieltag</h1><p class="psub">${esc(MD.comp)}</p>
      <div class="group" style="margin-top:20px">${MD.games.map((g) => {
        const a = analyze(g);
        const [k, p] = lead(g, a);
        return `<a class="row md-row" href="#/r/${g.id}"><span class="teams"><span class="tm">${crest(g.home, 26)}${esc(g.home)}</span><span class="tm">${crest(g.away, 26)}${esc(g.away)}</span></span>
          <span class="pr"><b>${Math.round(p * 100)} %</b><span>${k === 'draw' ? 'Remis' : 'Sieg ' + esc(k === 'home' ? g.home : g.away)}</span></span><span class="chev">›</span></a>`;
      }).join('')}</div><p class="foot">Beispiel-Spieltag (ausgedacht). Mit der KI liest Result AI alle Spiele direkt aus einem Screenshot.</p>`;
  }

  // ------------------------------------------------------------------ Treffsicherheit
  function vAccuracy() {
    const pts = [10, 30, 50, 70, 90];
    const svg = `<svg class="calib" viewBox="0 0 300 200" role="img" aria-label="Beispiel: Ehrlichkeits-Diagramm">
      <line x1="40" y1="170" x2="290" y2="170" stroke="var(--line)"/><line x1="40" y1="10" x2="40" y2="170" stroke="var(--line)"/>
      <line x1="40" y1="170" x2="290" y2="10" stroke="var(--faint)" stroke-dasharray="4 5"/>
      ${pts.map((v) => `<circle cx="${40 + v * 2.5}" cy="${170 - v * 1.6}" r="5" fill="var(--text)"/>`).join('')}
      <text x="165" y="194" text-anchor="middle" font-size="11" fill="var(--muted)" font-weight="600">Result AI sagt … %</text>
      <text x="14" y="90" text-anchor="middle" font-size="11" fill="var(--muted)" font-weight="600" transform="rotate(-90 14 90)">passiert in … %</text></svg>`;
    const metric = (n, t, s) => `<div class="row metric" style="align-items:flex-start"><span class="n">${n}</span><span class="grow"><div class="t" style="white-space:normal">${t}</div><div class="s" style="font-size:14px;margin-top:2px">${s}</div></span></div>`;
    return `<h1 class="ptitle">Wie oft lag Result AI richtig?</h1>
      <p class="psub">Jede Analyse wird auf deinem Handy gespeichert. Nach dem Spiel holt sich die App das echte Ergebnis und rechnet ehrlich nach.</p>
      <div class="group" style="margin-top:22px">${metric(1, 'Favorit gewonnen', 'Wie oft hat das Team mit der höheren Siegchance wirklich gewonnen – z. B. „63 von 100“.')}
        ${metric(2, 'Ergebnis unter den Top 3', 'Wie oft war der echte Endstand unter den drei wahrscheinlichsten Ergebnissen.')}
        ${metric(3, 'Ehrlichkeit', 'Sagt Result AI 70 %, sollte es auch in etwa 70 % der Fälle passieren. Liegen die Punkte auf der Linie, kann man den Zahlen trauen.')}</div>
      <section class="sec"><div class="sec-h"><h2>Ehrlichkeits-Diagramm</h2><span class="note">so sieht es aus</span></div><div class="group" style="padding:14px">${svg}</div>
        <div class="empty" style="margin-top:10px">Noch keine Scans ausgewertet. Sobald die ersten gescannten Spiele vorbei sind, stehen hier deine echten Zahlen.</div></section>`;
  }

  // ------------------------------------------------------------------ Seiten-Stapel: neue Seite schiebt sich von rechts herein
  const stackEl = document.createElement('div');
  stackEl.className = 'stack';
  document.body.appendChild(stackEl);
  const tabbar = document.createElement('nav');
  tabbar.className = 'tabbar';
  tabbar.setAttribute('aria-label', 'Bereiche');
  tabbar.innerHTML = '<span class="tab-ind" aria-hidden="true"></span>' + TABS.map(([p, label, ic]) => `<button data-act="tab" data-tab="${p}"><span class="ti">${I[ic]}</span><span class="tl">${label}</span></button>`).join('');
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
    if (p.path === '/' && first && !reduce) {
      p.el.classList.add('intro-page');
      const lg = $('.intro-logo', p.el);
      if (lg) lg.classList.add('intro');
    }
    if (p.path === '/scan') runScan(p.el);
    if (p.path === '/pick' && !R.data) loadRatings().then(() => { if (S.stack[S.stack.length - 1] === p) redrawTop(); }).catch(() => {});
    if (p.path === '/' || p.path === '/tips' || p.path.startsWith('/r/t_')) freshTips(p);
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
    const c = e.target.closest && e.target.closest('a.gcard[href^="#/r/"], a.tcard, a.tmini, a.k-leg, a.row[href^="#/r/"]');
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
    to.morphSrc = mo.el.id === 'frame' ? null : mo.el;
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
  // Darstellung gewechselt: alle offenen Seiten neu zeichnen (Wappen, Farben), ohne Auftritt und ohne Scrollsprung
  function redrawAll() {
    S.stack.forEach((p) => {
      if (p.path === '/scan') return;
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

  // ------------------------------------------------------------------ Einstellungen (Blatt von unten, mit Federung)
  function openSettings() {
    if ($('.sheet')) return;
    const dark = isDark();
    const sh = document.createElement('div');
    sh.className = 'sheet';
    sh.innerHTML = `<div class="bg" data-act="close"></div><div class="panel" role="dialog" aria-label="Einstellungen"><div class="grip" data-grip></div>
      <h2>Einstellungen</h2><div class="lab">DARSTELLUNG</div>
      <div class="seg" data-v="${dark ? 'dark' : 'light'}"><span class="ind"></span><button class="${dark ? '' : 'on'}" data-act="theme" data-val="light">Hell</button><button class="${dark ? 'on' : ''}" data-act="theme" data-val="dark">Dunkel</button></div>
      <p class="foot" style="margin-top:24px">Result AI · Vorschau-Version</p></div>`;
    document.body.appendChild(sh);
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
    else if (act === 'sec') {
      const pg = a.closest('.page');
      const sec = pg && $$(`[data-sec="${a.dataset.sec}"]`, pg).find((x) => !x.closest('.snav'));
      if (sec) {
        if (!pg._geo) pg._geo = pageGeo(pg);
        const t = pg._geo.secs.find(([k]) => k === a.dataset.sec);
        pg.scrollTo({ top: Math.max(0, (t ? t[1] : 0) - pg._geo.off + 2), behavior: reduce ? 'auto' : 'smooth' });
      }
    }
    else if (act === 'demoscan') {
      if (S.url) { URL.revokeObjectURL(S.url); S.url = null; }
      S.demo = true;
      if (curPath() === '/scan') { const p = S.stack[S.stack.length - 1]; p.el.innerHTML = barHtml('/scan') + `<div class="wrap">${vScan()}</div>`; runScan(p.el); }
      else location.hash = '#/scan';
    }
    else if (act === 'tab') {
      const to = a.dataset.tab;
      if (S.stack[0] && S.stack[0].path === to) {
        if (S.stack.length > 1) goHome(); // nochmal tippen: zurück zur Startseite des Bereichs
        else S.stack[0].el.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
      } else location.replace('#' + to);
    }
    else if (act === 'tlist' || act === 'tday' || act === 'tcomp') {
      if (act === 'tlist') {
        const seg = a.closest('.seg');
        seg.style.setProperty('--k', $$('button', seg).indexOf(a));
        $$('button', seg).forEach((b) => b.classList.toggle('on', b === a));
        T.list = a.dataset.val;
        T.day = 'all';
        T.comp = 'all';
      } else if (act === 'tday') T.day = a.dataset.val;
      else T.comp = a.dataset.val;
      const body = $('.tips-body', a.closest('.page'));
      if (body) body.innerHTML = tipsBody();
    }
    else if (act === 'swap') { [P.home, P.away] = [P.away, P.home]; P.score.reverse(); P.reds.reverse(); P.msg = ''; redrawTop(); }
    else if (act === 'theme') {
      const seg = a.closest('.seg');
      if (seg.dataset.v === a.dataset.val) return;
      applyTheme(a.dataset.val);
      seg.dataset.v = a.dataset.val;
      $$('button', seg).forEach((b) => b.classList.toggle('on', b === a));
      redrawAll();
    }
  });
  document.addEventListener('change', (e) => {
    const t = e.target;
    if (t.dataset && t.dataset.act === 'opt') { P[t.dataset.k] = t.checked; P.msg = ''; redrawTop(); return; }
    if (t.dataset && t.dataset.act === 'minute') { P.minute = +t.value; redrawTop(); return; }
    const inp = e.target.closest('[data-act="pick"]');
    if (!inp || !inp.files || !inp.files[0]) return;
    if (S.url) URL.revokeObjectURL(S.url);
    S.url = URL.createObjectURL(inp.files[0]);
    S.demo = false;
    inp.value = '';
    location.hash = '#/scan';
  });

  document.addEventListener('input', (e) => {
    const t = e.target;
    if (!t.dataset) return;
    if (t.dataset.act === 'search') renderResults(t.closest('.sheet'), t.value);
    else if (t.dataset.act === 'minute') { const b = $('.li-min', t.closest('.live-in')); if (b) b.textContent = t.value + "'"; }
  });

  // Antippen: kurz abdunkeln statt zusammenziehen (iPhone-Regel aus der BVB-App); erst nach kurzem Halten, beim Scrollen gar nicht
  (() => {
    const PRESS = 'a.gcard, a.group, a.row, a.card, .btn, .round, .sbtn, .seg button, .slot, .res-row, .stepper button, .swap, a.tcard, .tabbar button, .chips button, a.k-leg, .snav button, .demo-scan';
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
  // zurück aus dem Hintergrund: neueste Tipp-Suche holen (läuft jede Stunde)
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) return;
    const root = S.stack[0];
    if (root && S.stack.length === 1 && (root.path === '/' || root.path === '/tips')) freshTips(root, 5 * 60e3);
  });
})();
