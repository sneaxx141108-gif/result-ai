/* Result AI – App. Eine Seite mit Hash-Routen: #/ Start, #/scan Screenshot wird gelesen, #/r/<id> Ergebnis, #/md Spieltag,
   #/acc Treffsicherheit. Die Prozente rechnet engine.js (RE) – exakt, ohne Zufall, ohne KI. Die KI (Screenshot lesen,
   Internet-Recherche) läuft später über den Cloudflare-Server; bis dahin zeigt die App Beispiel-Spiele.
   Design „Clean“: weiß (Dunkelmodus in den Einstellungen), Farbe nur von den Teams, große Zahlen. */
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

  // ------------------------------------------------------------------ Icons
  const I = {
    photo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-9 9"/></svg>',
    cam: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13" r="3.5"/></svg>',
    back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>',
    gear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
    target: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/></svg>',
  };
  const logo = (cls = '') => `<svg class="${cls}" viewBox="0 0 36 36" aria-hidden="true"><g fill="none" stroke-width="5" stroke-linecap="round" transform="rotate(-90 18 18)">
    <circle class="ring-a" cx="18" cy="18" r="13" pathLength="100" stroke="var(--text)" stroke-dasharray="44 56"/>
    <circle class="ring-b" cx="18" cy="18" r="13" pathLength="100" stroke="var(--faint)" stroke-dasharray="20 80" stroke-dashoffset="-52"/>
    <circle class="ring-c" cx="18" cy="18" r="13" pathLength="100" stroke="var(--draw)" stroke-dasharray="16 84" stroke-dashoffset="-80"/></g></svg>`;

  // ------------------------------------------------------------------ Darstellung: hell (Standard) oder dunkel
  function applyTheme(t) {
    const dark = t === 'dark';
    if (dark) document.documentElement.dataset.theme = 'dark'; else delete document.documentElement.dataset.theme;
    const mt = $('meta[name="theme-color"]');
    if (mt) mt.setAttribute('content', dark ? '#000000' : '#FFFFFF');
    store.set('theme', dark ? 'dark' : 'light');
  }

  // ------------------------------------------------------------------ Vereinsfarben (bekannte Teams, sonst fest aus dem Namen)
  const COLORS = {
    Arsenal: '#EF0107', Chelsea: '#034694', Bayern: '#DC052D', Dortmund: '#F5C800', 'Real Madrid': '#2B2B6B', Barcelona: '#A50044',
    Leipzig: '#DD0741', Freiburg: '#1A1A1A', Leverkusen: '#E32221', Stuttgart: '#C8102E', Bremen: '#1D9053', Mainz: '#C3141E',
    Union: '#D4011D', HSV: '#0A3F86',
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
    if (COLORS[name]) return COLORS[name];
    let h = 0;
    for (const ch of String(name)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return hslHex(h % 360, 0.55, 0.42);
  }
  const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const lum = (hex) => { const [r, g, b] = rgb(hex).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  const onColor = (hex) => (lum(hex) > 0.45 ? '#111111' : '#FFFFFF');
  // Farben eines Spiels: sind beide Teamfarben zu ähnlich, bekommt der Gast Schwarz (bzw. Weiß im Dunkelmodus)
  function pair(m) {
    const h = teamColor(m.home);
    let a = teamColor(m.away);
    const d = Math.hypot(...rgb(h).map((v, i) => v - rgb(a)[i]));
    if (d < 110) a = getComputedStyle(document.documentElement).getPropertyValue('--text').trim() || '#0B0B0C';
    return { h, a };
  }
  function crest(name, cls = '', white = false) {
    const c = teamColor(name);
    const ini = String(name).split(/\s+/).map((w) => w[0]).join('').slice(0, 3).toUpperCase();
    const st = white ? `background:#fff;color:${c}` : `background:${c};color:${onColor(c)}`;
    return `<span class="crest ${cls}" style="${st}" aria-hidden="true">${esc(ini)}</span>`;
  }

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
  const bar3 = (a, c) => `<div class="bar3"><i style="flex:${a.probs.home};background:${c.h}"></i><i style="flex:${a.probs.draw};background:var(--draw)"></i><i style="flex:${a.probs.away};background:${c.a}"></i></div>`;

  // ------------------------------------------------------------------ Bausteine
  const S = { route: null, file: null, url: null, timers: [] };
  function topBar(path) {
    const home = path === '/';
    const titles = { '/scan': 'Analyse', '/md': 'Spieltag', '/acc': 'Treffsicherheit' };
    const t = path.startsWith('/r/') ? 'Ergebnis' : titles[path] || '';
    return `<header class="top ${home ? '' : 'line'}">${home
      ? `<span class="brand">${logo('intro-logo')}<span>Result AI</span></span>`
      : `<button class="round" data-act="back" aria-label="Zurück">${I.back}</button><span class="top-title">${esc(t)}</span>`}
      <span class="top-act"><button class="round" data-act="settings" aria-label="Einstellungen">${I.gear}</button></span></header>`;
  }

  // ------------------------------------------------------------------ Startseite
  function vHome() {
    const hist = store.get('history', []);
    const game = (m) => {
      const a = analyze(m);
      const c = pair(m);
      const [k, p, l] = lead(m, a);
      return `<a class="game" href="#/r/${m.id}"><div class="game-top"><span>${esc(m.comp)}</span>${m.kind === 'live' ? `<span class="chip live">${m.minute}'</span>` : `<span>${esc(m.kind === 'odds' ? 'Quoten' : m.when)}</span>`}</div>
        <div class="game-team">${crest(m.home)}<span>${esc(m.home)}</span>${m.score ? `<b>${m.score[0]}</b>` : ''}</div>
        <div class="game-team">${crest(m.away)}<span>${esc(m.away)}</span>${m.score ? `<b>${m.score[1]}</b>` : ''}</div>
        <div class="game-fav"><b>${Math.round(p * 100)} %</b><span>${esc(k === 'draw' ? 'Remis' : l.replace('Siegchance ', 'Sieg '))}</span></div>${bar3(a, c)}</a>`;
    };
    const mdCard = `<a class="game" href="#/md"><div class="game-top"><span>${esc(MD.comp.split(' · ')[0])}</span><span>${MD.games.length} Spiele</span></div>
      ${MD.games.slice(0, 3).map((g) => `<div class="game-team" style="font-size:14px">${crest(g.home)}<span>${esc(g.home)} – ${esc(g.away)}</span></div>`).join('')}
      <div class="game-fav"><b style="font-size:20px">Ganzer Spieltag</b></div></a>`;
    return `<section class="hero"><h1>Screenshot rein.<br><span>Prozente raus.</span></h1>
      <p>Live-Spiel, Paarung, ganzer Spieltag oder Quoten – Result AI rechnet, wer gewinnt.</p></section>
      <div class="actions">
        <label class="btn">${I.photo}<span>Screenshot wählen</span><input type="file" accept="image/*" data-act="pick" aria-label="Screenshot aus Fotos wählen"></label>
        <label class="btn soft">${I.cam}<span>Foto mit Kamera</span><input type="file" accept="image/*" capture="environment" data-act="pick" aria-label="Foto mit der Kamera machen"></label>
      </div>
      <section class="sec"><div class="sec-h"><h2>Beispiele</h2><span class="note">ausgedacht · echte Rechnung</span></div>
        <div class="ex-row">${game(DEMO.live)}${game(DEMO.pre)}${game(DEMO.odds)}${mdCard}</div></section>
      <section class="sec"><div class="sec-h"><h2>Treffsicherheit</h2></div>
        <a class="group" href="#/acc" style="display:block"><div class="row"><span class="round" style="width:40px;height:40px">${I.target}</span><span class="grow"><div class="t">Wie oft lag Result AI richtig?</div><div class="s">${hist.length ? `${hist.length} Scans gespeichert` : 'Nur deine Scans · noch keine ausgewertet'}</div></span><span class="chev">›</span></div></a></section>
      <section class="sec"><div class="sec-h"><h2>Verlauf</h2></div>
        ${hist.length ? `<div class="group">${hist.slice(0, 20).map((h) => `<a class="row" href="#/r/${esc(h.id)}">${crest(h.home)}<span class="grow"><div class="t">${esc(h.home)} – ${esc(h.away)}</div><div class="s">${esc(h.comp || '')}</div></span><span class="chev">›</span></a>`).join('')}</div>`
        : '<div class="empty">Noch keine Scans. Sobald die KI angeschlossen ist, landet hier jede Analyse – und nach dem Spiel siehst du, ob Result AI richtig lag.</div>'}</section>
      <p class="foot">Vorschau-Version · Die KI zum Lesen der Screenshots wird gerade angeschlossen.</p>`;
  }

  // ------------------------------------------------------------------ Scan (Screenshot wird gelesen)
  function vScan() {
    if (!S.url) return vHome();
    return `<div class="scan-frame" id="frame"><img src="${S.url}" alt="Dein Screenshot"><span class="beam"></span></div>
      <div class="steps">${['Screenshot geladen', 'Teams, Spielstand und Minute erkennen', 'Stärken und Quoten nachschlagen', 'Alle Ergebnisse durchrechnen']
        .map((t, i) => `<div class="step" data-i="${i}"><i>${i + 1}</i><span>${t}</span></div>`).join('')}</div>
      <div id="notice"></div>`;
  }
  function runScan() {
    const fr = $('#frame');
    if (!fr) return;
    S.timers.forEach(clearTimeout);
    S.timers = [];
    fr.classList.add('scanning');
    const steps = $$('.step');
    const at = (ms, fn) => S.timers.push(setTimeout(fn, reduce ? 0 : ms));
    // Abgehakt wird nur, was wirklich passiert ist: Screenshot geladen. Lesen kann ihn erst die KI auf dem Server.
    at(150, () => steps[0].classList.add('on'));
    at(700, () => { steps[0].classList.add('done'); $('i', steps[0]).textContent = '✓'; steps[1].classList.add('on'); });
    at(1700, () => {
      $('#notice').innerHTML = `<div class="notice"><b>Die KI wird gerade angeschlossen</b>
        <p>Dein Screenshot ist angekommen. Lesen kann Result AI ihn, sobald der Server mit der KI steht. Erfunden wird nichts – deshalb hier noch kein Ergebnis.</p>
        <a class="btn" href="#/r/live">Beispiel ansehen</a><a class="btn soft" href="#/">Zurück zum Start</a></div>`;
    });
  }

  // ------------------------------------------------------------------ Ergebnis
  function vResult(id) {
    const m = findMatch(id);
    if (!m) return '<div class="empty" style="margin-top:24px">Diese Analyse gibt es nicht (mehr).</div>';
    const a = analyze(m);
    const c = pair(m);
    const r = round100([a.probs.home, a.probs.draw, a.probs.away]);
    const [k, , label] = lead(m, a);
    const kIdx = { home: 0, draw: 1, away: 2 }[k];
    const live = m.kind === 'live';
    const bg = `linear-gradient(100deg, ${c.h} 0%, ${c.h} 38%, ${teamColor(m.away)} 62%, ${teamColor(m.away)} 100%)`;
    let out = `<section class="match" style="background:${bg}">
      <div class="match-top">${live ? `<span class="chip live">LIVE ${m.minute}'</span>` : `<span class="chip on-color">${m.kind === 'odds' ? 'Quoten' : 'Vor dem Spiel'}</span>`}<span class="chip on-color">${esc(m.comp)}</span><span class="when">${esc(live ? (m.half === 2 ? '2. Halbzeit' : '1. Halbzeit') : m.when || '')}</span></div>
      <div class="versus"><div class="side">${crest(m.home, 'lg', true)}<span class="nm">${esc(m.home)}</span></div>
        <div class="mid">${live ? `<div class="sc">${m.score[0]}:${m.score[1]}</div><div class="sub">${m.minute}. Minute</div>` : '<div class="vs">VS</div>'}</div>
        <div class="side">${crest(m.away, 'lg', true)}<span class="nm">${esc(m.away)}</span></div></div></section>
      <section class="big"><div class="big-n"><span data-count="${r[kIdx]}">${r[kIdx]}</span><span class="pc">%</span></div>
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
    out += `<p class="foot">${m.fromMd || DEMO[m.id] ? 'Beispiel-Spiel (ausgedacht) – die Rechnung ist echt.<br>' : ''}Poisson-Tormodell mit Dixon-Coles · exakt, ohne Zufall.<br>Gleiches Spiel am selben Tag = gleiche Zahlen.</p>`;
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
    return `<section class="hero" style="padding-top:14px"><p style="margin:0 0 6px;font-size:15px">${esc(MD.comp)}</p><h1 style="font-size:40px">Ganzer Spieltag</h1></section>
      <div class="group" style="margin-top:18px">${MD.games.map((g) => {
        const a = analyze(g);
        const [k, p] = lead(g, a);
        return `<a class="row md-row" href="#/r/${g.id}"><span class="teams"><span class="tm">${crest(g.home)}${esc(g.home)}</span><span class="tm">${crest(g.away)}${esc(g.away)}</span></span>
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
    return `<section class="hero" style="padding-top:14px"><h1 style="font-size:40px">Wie oft lag<br><span>Result AI richtig?</span></h1>
      <p>Jede Analyse wird auf deinem Handy gespeichert. Nach dem Spiel holt sich die App das echte Ergebnis und rechnet ehrlich nach.</p></section>
      <div class="group" style="margin-top:22px">${metric(1, 'Favorit gewonnen', 'Wie oft hat das Team mit der höheren Siegchance wirklich gewonnen – z. B. „63 von 100“.')}
        ${metric(2, 'Ergebnis unter den Top 3', 'Wie oft war der echte Endstand unter den drei wahrscheinlichsten Ergebnissen.')}
        ${metric(3, 'Ehrlichkeit', 'Sagt Result AI 70 %, sollte es auch in etwa 70 % der Fälle passieren. Liegen die Punkte auf der Linie, kann man den Zahlen trauen.')}</div>
      <section class="sec"><div class="sec-h"><h2>Ehrlichkeits-Diagramm</h2><span class="note">so sieht es aus</span></div><div class="group" style="padding:14px">${svg}</div>
        <div class="empty" style="margin-top:10px">Noch keine Scans ausgewertet. Sobald die ersten gescannten Spiele vorbei sind, stehen hier deine echten Zahlen.</div></section>`;
  }

  // ------------------------------------------------------------------ Einstellungen
  function openSettings() {
    const dark = document.documentElement.dataset.theme === 'dark';
    const sh = document.createElement('div');
    sh.className = 'sheet';
    sh.innerHTML = `<div class="bg" data-act="close"></div><div class="panel" role="dialog" aria-label="Einstellungen"><div class="grip"></div>
      <h2>Einstellungen</h2>
      <div class="sec-h" style="margin-bottom:8px"><span class="muted" style="font-size:13px;font-weight:600">DARSTELLUNG</span></div>
      <div class="seg"><button class="${dark ? '' : 'on'}" data-act="theme" data-val="light">Hell</button><button class="${dark ? 'on' : ''}" data-act="theme" data-val="dark">Dunkel</button></div>
      <p class="foot" style="margin-top:22px">Result AI · Vorschau-Version</p></div>`;
    document.body.appendChild(sh);
  }

  // ------------------------------------------------------------------ Seiten zeichnen
  function render() {
    const path = (location.hash || '#/').slice(1) || '/';
    const first = S.route == null;
    let html;
    if (path === '/') html = vHome();
    else if (path === '/scan') html = vScan();
    else if (path === '/md') html = vMatchday();
    else if (path === '/acc') html = vAccuracy();
    else if (path.startsWith('/r/')) html = vResult(decodeURIComponent(path.slice(3)));
    else html = vHome();
    const same = S.route === path;
    $('#app').innerHTML = topBar(path) + `<main id="view">${html}</main>`;
    if (!same) window.scrollTo(0, 0);
    S.route = path;
    if (first && path === '/' && !reduce && $('.intro-logo')) $('.intro-logo').classList.add('intro');
    if (path === '/scan') runScan();
    if (path.startsWith('/r/') && !same) revealResult();
  }
  // Ergebnis-Auftritt: Karte erscheint, die große Zahl zählt hoch, Balken wachsen (einmalig, nur transform/opacity)
  function revealResult() {
    if (reduce) return;
    const v = $('#view');
    v.classList.add('reveal');
    const el = $('[data-count]', v);
    if (!el) return;
    const to = +el.dataset.count;
    const t0 = performance.now();
    const step = (now) => {
      const k = Math.min(1, (now - t0) / 1000);
      el.textContent = String(Math.round(to * (1 - Math.pow(1 - k, 3))));
      if (k < 1) requestAnimationFrame(step);
    };
    el.textContent = '0';
    requestAnimationFrame(step);
    setTimeout(() => { el.textContent = String(to); }, 1150); // Sicherheit: Endwert steht auf jeden Fall da
  }

  // ------------------------------------------------------------------ Ereignisse
  document.addEventListener('click', (e) => {
    const a = e.target.closest('[data-act]');
    if (!a) return;
    const act = a.dataset.act;
    if (act === 'back') { if (history.length > 1) history.back(); else location.hash = '#/'; }
    else if (act === 'settings') openSettings();
    else if (act === 'theme') { applyTheme(a.dataset.val); $$('.seg button').forEach((b) => b.classList.toggle('on', b === a)); render(); }
    else if (act === 'close') { const sh = $('.sheet'); if (sh) sh.remove(); }
  });
  document.addEventListener('change', (e) => {
    const inp = e.target.closest('[data-act="pick"]');
    if (!inp || !inp.files || !inp.files[0]) return;
    if (S.url) URL.revokeObjectURL(S.url);
    S.file = inp.files[0];
    S.url = URL.createObjectURL(S.file);
    if (location.hash === '#/scan') render(); else location.hash = '#/scan';
  });
  window.addEventListener('hashchange', render);

  // Antippen: kurz abdunkeln statt zusammenziehen (iPhone-Regel aus der BVB-App); erst nach kurzem Halten, beim Scrollen gar nicht
  (() => {
    const PRESS = 'a.game, a.group, a.row, .btn, .round, .seg button';
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
    window.addEventListener('scroll', () => { if (el) off(); }, { passive: true });
  })();

  // App-Updates: Service Worker; bei neuer Version einmal neu laden, damit das Update gleich beim ersten Öffnen ankommt
  if ('serviceWorker' in navigator && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
    const had = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (had && !S.swReload) { S.swReload = true; location.reload(); } });
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }

  applyTheme(store.get('theme', 'light'));
  render();
})();
