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
    target: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/></svg>',
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
    let h = 0;
    for (const ch of String(name)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return hslHex(h % 360, 0.55, 0.42);
  }
  const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const lum = (hex) => { const [r, g, b] = rgb(hex).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  const onColor = (hex) => (lum(hex) > 0.45 ? '#111111' : '#FFFFFF');
  const initials = (n) => String(n).split(/\s+/).map((w) => w[0]).join('').slice(0, 3).toUpperCase();
  // Farben eines Spiels für Balken/Punkte: sind beide Teamfarben zu ähnlich, bekommt der Gast Schwarz (dunkel: Weiß)
  function pair(m) {
    const h = teamColor(m.home);
    let a = teamColor(m.away);
    if (Math.hypot(...rgb(h).map((v, i) => v - rgb(a)[i])) < 110) a = isDark() ? '#F5F5F7' : '#0B0B0C';
    return { h, a };
  }
  const logoUrl = (id, dark, px) => `https://a.espncdn.com/combiner/i?img=/i/teamlogos/soccer/${dark ? '500-dark' : '500'}/${id}.png&w=${px}&h=${px}`;
  function crest(name, s = 30, onPlate = false) {
    const t = TEAMS[name];
    const c = teamColor(name);
    if (t) return `<span class="crest" style="--s:${s}px"><img src="${logoUrl(t[0], isDark() && !onPlate, s > 44 ? 200 : 128)}" alt="" decoding="async" crossorigin="anonymous" data-fb="${esc(initials(name))}" data-c="${c}"></span>`;
    return `<span class="crest fb" style="--s:${s}px;background:${c};color:${onColor(c)}" aria-hidden="true">${esc(initials(name))}</span>`;
  }
  const plate = (name, p) => `<span class="plate" style="--p:${p}px">${crest(name, Math.round(p * 0.66), true)}</span>`;
  const teamBg = (m) => `linear-gradient(110deg, ${teamColor(m.home)} 0%, ${teamColor(m.home)} 40%, ${teamColor(m.away)} 60%, ${teamColor(m.away)} 100%)`;
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
  const findMatch = (id) => DEMO[id] || MD.games.find((g) => g.id === id) || (store.get('history', []).find((h) => h.id === id) || null);
  const analyze = (m) => RE.analyze({ lh: m.lh, la: m.la, minute: m.minute, half: m.half, score: m.score, reds: m.reds, finished: m.finished });
  // die wahrscheinlichste der drei Möglichkeiten
  function lead(m, a) {
    const o = [['home', a.probs.home, `Siegchance ${m.home}`], ['draw', a.probs.draw, 'Chance auf Remis'], ['away', a.probs.away, `Siegchance ${m.away}`]];
    return o.sort((x, y) => y[1] - x[1])[0];
  }

  // ------------------------------------------------------------------ Seiten
  const S = { stack: [], busy: false, pending: false, swipe: null, url: null, timers: [] };
  const titleOf = (path) => (path === '/' ? '' : path === '/scan' ? 'Analyse' : path === '/md' ? 'Spieltag' : path === '/acc' ? 'Treffsicherheit' : 'Ergebnis');
  function barHtml(path) {
    const root = path === '/';
    let tt = titleOf(path);
    if (path.startsWith('/r/')) { const m = findMatch(decodeURIComponent(path.slice(3))); if (m) tt = `${m.home} – ${m.away}`; }
    return `<header class="bar">${root ? `<span class="brand">${logo('intro-logo')}<span>Result AI</span></span>`
      : `<button class="round" data-act="back" aria-label="Zurück">${I.back}</button>`}<span class="tt">${esc(tt)}</span>
      <span class="end"><button class="round" data-act="settings" aria-label="Einstellungen">${I.gear}</button></span></header>`;
  }
  function viewHtml(path) {
    if (path === '/') return vHome();
    if (path === '/scan') return vScan();
    if (path === '/md') return vMatchday();
    if (path === '/acc') return vAccuracy();
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
      return `<a class="gcard" href="#/r/${m.id}" style="background:${teamBg(m)}">
        <div class="gt"><span>${esc(m.comp)}</span>${m.kind === 'live' ? `<span class="chip live">${m.minute}'</span>` : `<span class="chip glass">${esc(m.kind === 'odds' ? 'Quoten' : m.when)}</span>`}</div>
        <div class="gv">${plate(m.home, 54)}<div class="gm">${m.score ? `${m.score[0]}:${m.score[1]}` : 'VS'}<small>${short(m.home)} – ${short(m.away)}</small></div>${plate(m.away, 54)}</div>
        <div><div class="gf"><b>${Math.round(p * 100)} %</b><span>${k === 'draw' ? 'Remis' : 'Sieg ' + esc(k === 'home' ? m.home : m.away)}</span></div>
        <div class="wbar" style="margin-top:10px"><i style="flex:${a.probs.home};background:#fff"></i><i style="flex:${a.probs.draw};background:rgba(255,255,255,.4)"></i><i style="flex:${a.probs.away};background:rgba(255,255,255,.72)"></i></div></div></a>`;
    };
    const mdCard = `<a class="gcard md" href="#/md"><div class="gt"><span class="muted">${esc(MD.comp.split(' · ')[0])}</span><span class="chip">${MD.games.length} Spiele</span></div>
      <div class="mdl">${MD.games.slice(0, 3).map((g) => `<div>${crest(g.home, 24)}${esc(g.home)} <span class="faint">–</span> ${esc(g.away)}</div>`).join('')}</div>
      <div class="gf"><b style="font-size:24px">Ganzer Spieltag</b><span class="muted">›</span></div></a>`;
    return `<section class="hero"><h1>Screenshot rein.<br><span>Prozente raus.</span></h1></section>
      <section class="scan-card">${decoRing}<span class="ic">${I.scan}</span>
        <div><h2>Spiel scannen</h2><p>Live-Spiel, Paarung, ganzer Spieltag oder Quoten – Result AI rechnet, wer gewinnt.</p></div>
        <div class="acts"><label class="sbtn">${I.photo}<span>Fotos</span><input type="file" accept="image/*" data-act="pick" aria-label="Screenshot aus Fotos wählen"></label>
          <label class="sbtn alt">${I.cam}<span>Kamera</span><input type="file" accept="image/*" capture="environment" data-act="pick" aria-label="Foto mit der Kamera machen"></label></div></section>
      <section class="sec"><div class="sec-h"><h2>Beispiele</h2><span class="note">ausgedacht · echte Rechnung</span></div>
        <div class="ex-row">${card(DEMO.live)}${card(DEMO.pre)}${card(DEMO.odds)}${mdCard}</div></section>
      <section class="sec"><div class="sec-h"><h2>Treffsicherheit</h2></div>
        <a class="group" href="#/acc"><div class="row"><span class="round">${I.target}</span><span class="grow"><div class="t">Wie oft lag Result AI richtig?</div><div class="s">${hist.length ? `${hist.length} Scans gespeichert` : 'Nur deine Scans · noch keine ausgewertet'}</div></span><span class="chev">›</span></div></a></section>
      <section class="sec"><div class="sec-h"><h2>Verlauf</h2></div>
        ${hist.length ? `<div class="group">${hist.slice(0, 20).map((h) => `<a class="row" href="#/r/${esc(h.id)}">${crest(h.home)}<span class="grow"><div class="t">${esc(h.home)} – ${esc(h.away)}</div><div class="s">${esc(h.comp || '')}</div></span><span class="chev">›</span></a>`).join('')}</div>`
        : '<div class="empty">Noch keine Scans. Sobald die KI angeschlossen ist, landet hier jede Analyse – und nach dem Spiel siehst du, ob Result AI richtig lag.</div>'}</section>
      <p class="foot">Vorschau-Version · Die KI zum Lesen der Screenshots wird gerade angeschlossen.</p>`;
  }

  // ------------------------------------------------------------------ Scan (Screenshot wird gelesen)
  function vScan() {
    if (!S.url) return '<h1 class="ptitle">Analyse</h1><div class="empty" style="margin-top:18px">Kein Screenshot gewählt.</div><div style="margin-top:12px"><button class="btn" data-act="home">Zum Start</button></div>';
    return `<div class="scan-frame" id="frame"><img src="${S.url}" alt="Dein Screenshot"><span class="grid"></span><span class="beam"></span>
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
    // Abgehakt wird nur, was wirklich passiert ist: Screenshot geladen. Lesen kann ihn erst die KI auf dem Server.
    at(150, () => steps[0].classList.add('on'));
    at(750, () => { steps[0].classList.add('done'); $('i', steps[0]).textContent = '✓'; steps[1].classList.add('on'); });
    at(2000, () => {
      $('.notice-slot', el).innerHTML = `<div class="notice"><b>Die KI wird gerade angeschlossen</b>
        <p>Dein Screenshot ist angekommen. Lesen kann Result AI ihn, sobald der Server mit der KI steht. Erfunden wird nichts – deshalb hier noch kein Ergebnis.</p>
        <a class="btn" href="#/r/live">Beispiel ansehen</a><button class="btn soft" data-act="home">Zurück zum Start</button></div>`;
    });
  }

  // ------------------------------------------------------------------ Ergebnis
  // Zahl als Zählwerk: jede Ziffer ist eine Rolle 0–9 0–9, die auf ihre Ziffer im zweiten Durchlauf rollt (nur transform)
  function roller(n) {
    const ds = String(n).split('');
    const strip = '01234567890123456789'.split('').map((x) => `<span>${x}</span>`).join('');
    return `<span class="roll" aria-hidden="true">${ds.map((d, i) => `<span class="rc"><span class="rs" style="--to:${10 + +d};--dl:${(i * 0.1).toFixed(2)}s">${strip}</span></span>`).join('')}</span><span class="sr" style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)">${n} Prozent</span>`;
  }
  function vResult(id) {
    const m = findMatch(id);
    if (!m) return '<div class="empty" style="margin-top:24px">Diese Analyse gibt es nicht (mehr).</div>';
    const a = analyze(m);
    const c = pair(m);
    const r = round100([a.probs.home, a.probs.draw, a.probs.away]);
    const [k, , label] = lead(m, a);
    const kIdx = { home: 0, draw: 1, away: 2 }[k];
    const live = m.kind === 'live';
    let out = `<div class="res"><section class="match" style="background:${teamBg(m)}">
      <div class="match-top">${live ? `<span class="chip live">LIVE ${m.minute}'</span>` : `<span class="chip glass">${m.kind === 'odds' ? 'Quoten' : 'Vor dem Spiel'}</span>`}<span class="chip glass">${esc(m.comp)}</span><span class="when">${esc(live ? (m.half === 2 ? '2. Halbzeit' : '1. Halbzeit') : m.when || '')}</span></div>
      <div class="versus"><div class="side">${plate(m.home, 78)}<span class="nm">${esc(m.home)}</span></div>
        <div class="mid">${live ? `<div class="sc">${m.score[0]}:${m.score[1]}</div><div class="sub">${m.minute}. Minute</div>` : '<div class="vs">VS</div>'}</div>
        <div class="side">${plate(m.away, 78)}<span class="nm">${esc(m.away)}</span></div></div></section>
      <section class="big"><div class="big-n">${roller(r[kIdx])}<span class="pc">%</span></div>
        <div class="big-l">${esc(label)}</div>
        <div class="big-s">Wahrscheinlichstes Ergebnis: ${a.top[0].h}:${a.top[0].a} (${pct1(a.top[0].p)})</div>
        <div class="split" role="img" aria-label="Sieg ${esc(m.home)} ${r[0]} Prozent, Remis ${r[1]} Prozent, Sieg ${esc(m.away)} ${r[2]} Prozent">
          <i style="flex:${a.probs.home};background:${c.h}"></i><i style="flex:${a.probs.draw};background:var(--draw)"></i><i style="flex:${a.probs.away};background:${c.a}"></i></div>
        <div class="legend"><div><b>${r[0]} %</b><span><i class="dot" style="background:${c.h}"></i>${esc(m.home)}</span></div>
          <div><b>${r[1]} %</b><span><i class="dot" style="background:var(--draw)"></i>Remis</span></div>
          <div><b>${r[2]} %</b><span>${esc(m.away)}<i class="dot" style="background:${c.a}"></i></span></div></div></section>`;

    const maxP = a.top[0].p;
    const sCol = (s) => (s.h > s.a ? c.h : s.h < s.a ? c.a : 'var(--draw)');
    out += `<section class="sec"><div class="sec-h"><h2>Wahrscheinlichste Ergebnisse</h2></div><div class="group">
      ${a.top.map((s, i) => `<div class="row score-row ${i === 0 ? 'best' : ''}"><span class="r">${s.h}:${s.a}</span><span class="mbar"><i style="width:${(s.p / maxP * 100).toFixed(1)}%;background:${sCol(s)}"></i></span><span class="v">${pct1(s.p)}</span></div>`).join('')}</div></section>`;
    out += `<section class="sec"><div class="sec-h"><h2>Alle Ergebnisse</h2><span class="note">in %</span></div><div class="group">${heatmap(a, m)}</div></section>`;
    if (m.kind === 'odds') out += oddsBlock(m, a);
    const rowBar = (l, p, txt) => `<div class="row stack"><div class="line"><span>${l}</span><span class="v">${txt || pct0(p)}</span></div><div class="pbar"><i style="width:${(p * 100).toFixed(1)}%"></i></div></div>`;
    out += `<section class="sec"><div class="sec-h"><h2>Tore</h2></div><div class="group">
      ${a.over.map((o) => rowBar(`Über ${nf1.format(o.line)} Tore`, o.over)).join('')}
      ${rowBar('Beide Teams treffen', a.btts, a.btts > 0.9995 ? '✓ schon passiert' : null)}</div></section>`;
    out += `<section class="sec"><div class="sec-h"><h2>Doppelchance</h2></div><div class="three">
      <div><b>${pct0(a.double['1X'])}</b><span>${esc(m.home)} o. Remis</span></div><div><b>${pct0(a.double['12'])}</b><span>kein Remis</span></div><div><b>${pct0(a.double.X2)}</b><span>${esc(m.away)} o. Remis</span></div></div></section>`;
    if (a.ht) {
      out += `<section class="sec"><div class="sec-h"><h2>Halbzeit</h2><span class="note">am ehesten ${a.ht.top[0].h}:${a.ht.top[0].a}</span></div><div class="three">
        <div><b style="color:${c.h}">${pct0(a.ht.home)}</b><span>${esc(m.home)} führt</span></div><div><b>${pct0(a.ht.draw)}</b><span>Unentschieden</span></div><div><b style="color:${c.a}">${pct0(a.ht.away)}</b><span>${esc(m.away)} führt</span></div></div></section>`;
    }
    const nx = a.next;
    out += `<section class="sec"><div class="sec-h"><h2>Nächstes Tor</h2><span class="note">${live ? `ab der ${m.minute}. Minute` : 'ab Anpfiff'}</span></div>
      <div class="three"><div><b style="color:${c.h}">${pct0(nx.home)}</b><span>${esc(m.home)}</span></div><div><b>${pct0(nx.none)}</b><span>kein Tor mehr</span></div><div><b style="color:${c.a}">${pct0(nx.away)}</b><span>${esc(m.away)}</span></div></div>
      <div class="group" style="margin-top:10px"><div class="row"><span class="grow">Tor in den nächsten 10 Min.</span><span class="v">${pct0(nx.in10)}</span></div>
        <div class="row"><span class="grow">in den nächsten 20 Min.</span><span class="v">${pct0(nx.in20)}</span></div>
        <div class="row"><span class="grow">in den nächsten 30 Min.</span><span class="v">${pct0(nx.in30)}</span></div>
        <div class="row"><span class="grow">50:50-Marke fürs nächste Tor</span><span class="v">${nx.median != null ? `${nx.median}. Min.` : 'eher keins'}</span></div></div></section>`;
    out += `<section class="sec"><div class="sec-h"><h2>Erklärung</h2></div><div class="text-card">${explain(m, a)}</div></section>`;
    out += `<p class="foot">${m.fromMd || DEMO[m.id] ? 'Beispiel-Spiel (ausgedacht) – die Rechnung ist echt.<br>' : ''}Poisson-Tormodell mit Dixon-Coles · exakt, ohne Zufall.<br>Gleiches Spiel am selben Tag = gleiche Zahlen.</p></div>`;
    return out;
  }
  function heatmap(a, m) {
    const mx = Math.max(...a.matrix.flat());
    let h = '<div class="heat"><span class="ax"></span>' + [0, 1, 2, 3, 4, 5].map((y) => `<span class="ax">${y}</span>`).join('');
    for (let x = 0; x <= 5; x++) {
      h += `<span class="ax">${x}</span>`;
      for (let y = 0; y <= 5; y++) {
        const p = (a.matrix[x] || [])[y] || 0;
        const k = p / mx;
        h += `<span class="c"><i style="opacity:${(0.04 + 0.96 * k).toFixed(3)}"></i><em style="color:${k > 0.5 ? 'var(--bg)' : 'var(--text)'}">${p >= 0.005 ? Math.round(p * 100) : ''}</em></span>`;
      }
    }
    return h + `</div><div class="heat-cap"><span>↓ Tore ${esc(m.home)}</span><span>Tore ${esc(m.away)} →</span></div>`;
  }
  function oddsBlock(m, a) {
    const q = RE.fromOdds(m.odds);
    const mk = RE.analyze({ lh: q.lh, la: q.la });
    const row = (l, x, y) => `<div class="row cmp-row"><span class="grow">${l}</span><span class="v">${pct0(x)}</span><span class="v">${pct0(y)}</span></div>`;
    return `<section class="sec"><div class="sec-h"><h2>Markt vs. Result AI</h2><span class="note">${nf2.format(m.odds.home)} · ${nf2.format(m.odds.draw)} · ${nf2.format(m.odds.away)}</span></div>
      <div class="group"><div class="cmp-head"><span>Ausgang</span><span>Markt</span><span>Result AI</span></div>
      ${row(`Sieg ${esc(m.home)}`, q.market.home, a.probs.home)}${row('Remis', q.market.draw, a.probs.draw)}${row(`Sieg ${esc(m.away)}`, q.market.away, a.probs.away)}
      ${row('Über 2,5 Tore', mk.over.find((o) => o.line === 2.5).over, a.over.find((o) => o.line === 2.5).over)}</div>
      <p class="muted" style="font-size:13px;margin:10px 4px 0">Markt = aus den Quoten, ohne die Marge der Buchmacher (${nf1.format(q.market.margin * 100)} %). Result AI = eigene Rechnung aus den Team-Stärken.</p></section>`;
  }
  function explain(m, a) {
    const xg = (v) => nf1.format(v);
    const fav = a.probs.home >= a.probs.away ? m.home : m.away;
    const ps = [];
    if (m.kind === 'live') {
      const pre = RE.analyze({ lh: m.lh, la: m.la });
      ps.push(`Vor dem Anpfiff lag ${esc(m.home)} bei ${pct0(pre.probs.home)} Siegchance. Beim Stand von ${m.score[0]}:${m.score[1]} in der ${m.minute}. Minute fallen im Schnitt nur noch ${xg(a.rest.home + a.rest.away)} Tore – deshalb steht ${esc(m.home)} jetzt bei ${pct0(a.probs.home)}, und ein Remis ist auf ${pct0(a.probs.draw)} gestiegen.`);
    } else {
      ps.push(`Im Schnitt erzielt ${esc(m.home)} in diesem Spiel ${xg(a.xg.home)} Tore, ${esc(m.away)} ${xg(a.xg.away)}. Daraus ergeben sich ${pct0(Math.max(a.probs.home, a.probs.away))} für ${esc(fav)}.`);
    }
    ps.push(`Das wahrscheinlichste einzelne Ergebnis ist ${a.top[0].h}:${a.top[0].a} – aber auch das tritt nur in ${pct0(a.top[0].p)} der Fälle ein.`);
    ps.push('<span class="muted">Mit angeschlossener KI kommt hier ein Formcheck dazu: letzte Spiele, Ausfälle und was die Buchmacher erwarten.</span>');
    return ps.map((p) => `<p>${p}</p>`).join('');
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
      b.classList.toggle('scrolled', el.scrollTop > 4);
      b.classList.toggle('titled', el.scrollTop > 64);
    });
  }
  function makePage(path) {
    const el = document.createElement('section');
    el.className = 'page';
    el.innerHTML = barHtml(path) + `<div class="wrap">${viewHtml(path)}</div>`;
    el.addEventListener('scroll', onPageScroll, { passive: true });
    return { path, el, shown: false };
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
  async function route() {
    if (S.busy) { S.pending = true; return; }
    const path = curPath();
    const top = S.stack[S.stack.length - 1];
    if (!top || top.path !== path) {
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
    const inp = e.target.closest('[data-act="pick"]');
    if (!inp || !inp.files || !inp.files[0]) return;
    if (S.url) URL.revokeObjectURL(S.url);
    S.url = URL.createObjectURL(inp.files[0]);
    inp.value = '';
    location.hash = '#/scan';
  });

  // Antippen: kurz abdunkeln statt zusammenziehen (iPhone-Regel aus der BVB-App); erst nach kurzem Halten, beim Scrollen gar nicht
  (() => {
    const PRESS = 'a.gcard, a.group, a.row, .btn, .round, .sbtn, .seg button';
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

  // ------------------------------------------------------------------ Start: Startseite unten im Stapel; Direktlink obendrauf
  applyTheme(store.get('theme', 'light'));
  const start = curPath();
  const home = makePage('/');
  stackEl.appendChild(home.el);
  S.stack.push(home);
  if (start !== '/') {
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
})();
