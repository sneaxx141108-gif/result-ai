/* Result AI – App. Eine Seite mit Hash-Routen: #/ Start, #/scan Screenshot wird gelesen, #/r/<id> Ergebnis, #/md Spieltag,
   #/acc Treffsicherheit. Die Prozente rechnet engine.js (RE) – exakt, ohne Zufall, ohne KI. Die KI (Screenshot lesen,
   Internet-Recherche) läuft später über den Cloudflare-Server; bis dahin zeigt die App Beispiel-Spiele. */
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
    look: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 0 0 18c1.5 0 2-1 2-2s-1-2 0-3 3 0 4-1 3-3 3-5a9 9 0 0 0-9-7z"/><circle cx="8" cy="10" r="1"/><circle cx="12" cy="7.5" r="1"/><circle cx="16" cy="10" r="1"/></svg>',
    check: '✓',
  };
  const logo = (cls = '') => `<svg class="${cls}" viewBox="0 0 36 36" aria-hidden="true"><g fill="none" stroke-width="4.2" stroke-linecap="round" transform="rotate(-90 18 18)">
    <circle class="ring-a" cx="18" cy="18" r="14" pathLength="100" stroke="var(--home)" stroke-dasharray="44 56"/>
    <circle class="ring-b" cx="18" cy="18" r="14" pathLength="100" stroke="var(--draw)" stroke-dasharray="22 78" stroke-dashoffset="-50"/>
    <circle class="ring-c" cx="18" cy="18" r="14" pathLength="100" stroke="var(--away)" stroke-dasharray="20 80" stroke-dashoffset="-78"/></g></svg>`;

  // ------------------------------------------------------------------ Looks
  const LOOKS = [
    { id: 'nova', name: 'Nova', desc: 'Dunkel & futuristisch – Neon-Grün und Cyan', sw: ['#05060A', '#C6FF3D', '#3DE0FF'], theme: '#05060A' },
    { id: 'pure', name: 'Pure', desc: 'Clean wie Apple – hell oder dunkel wie dein iPhone', sw: ['#F5F5F7', '#0A84FF', '#FF9F0A'], theme: null },
    { id: 'arena', name: 'Arena', desc: 'Sportlich wie eine TV-Grafik – Rot, Gelb, Nachtblau', sw: ['#070B18', '#FF2D55', '#FFD60A'], theme: '#070B18' },
  ];
  function applyLook(id) {
    const L = LOOKS.find((x) => x.id === id) || LOOKS[0];
    document.documentElement.dataset.look = L.id;
    const dark = matchMedia('(prefers-color-scheme: dark)').matches;
    const mt = $('meta[name="theme-color"]');
    if (mt) mt.setAttribute('content', L.theme || (dark ? '#000000' : '#F5F5F7'));
    store.set('look', L.id);
  }

  // ------------------------------------------------------------------ Vereins-Kreise (Farbe je Team, sonst fest aus dem Namen)
  const COLORS = {
    Arsenal: ['#EF0107', '#fff'], Chelsea: ['#034694', '#fff'], Bayern: ['#DC052D', '#fff'], Dortmund: ['#FDE100', '#111'],
    'Real Madrid': ['#FEBE10', '#111'], Barcelona: ['#A50044', '#fff'], Leipzig: ['#DD0741', '#fff'], Freiburg: ['#1A1A1A', '#fff'],
    Leverkusen: ['#E32221', '#fff'], Stuttgart: ['#E32219', '#fff'], Bremen: ['#1D9053', '#fff'], Mainz: ['#C3141E', '#fff'],
    Union: ['#EB1923', '#FDE100'], HSV: ['#0A3F86', '#fff'],
  };
  function crest(name, cls = '') {
    let c = COLORS[name];
    if (!c) {
      let h = 0;
      for (const ch of String(name)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
      c = [`hsl(${h % 360} 62% 42%)`, '#fff'];
    }
    const ini = String(name).split(/\s+/).map((w) => w[0]).join('').slice(0, 3).toUpperCase();
    return `<span class="crest ${cls}" style="background:${c[0]};color:${c[1]}" aria-hidden="true">${esc(ini)}</span>`;
  }

  // ------------------------------------------------------------------ Beispiel-Spiele (ausgedacht, mit echter Mathe gerechnet)
  const DEMO = {
    live: { id: 'live', kind: 'live', comp: 'Premier League', home: 'Arsenal', away: 'Chelsea', minute: 63, half: 2, score: [1, 1], reds: [0, 0], lh: 1.75, la: 1.05 },
    pre: { id: 'pre', kind: 'pre', comp: 'Bundesliga', home: 'Bayern', away: 'Dortmund', when: 'Sa., 18:30 Uhr', lh: 2.35, la: 1.05 },
    odds: { id: 'odds', kind: 'odds', comp: 'LaLiga', home: 'Real Madrid', away: 'Barcelona', when: 'So., 21:00 Uhr', lh: 1.55, la: 1.5,
      odds: { home: 2.3, draw: 3.7, away: 2.9, line: 2.5, over: 1.65, under: 2.2 } },
  };
  const MD = { id: 'md', comp: 'Bundesliga · 10. Spieltag', games: [
    { home: 'Leipzig', away: 'Freiburg', lh: 1.7, la: 1.1 }, { home: 'Leverkusen', away: 'Stuttgart', lh: 1.9, la: 1.3 },
    { home: 'Bremen', away: 'Mainz', lh: 1.4, la: 1.3 }, { home: 'Union', away: 'HSV', lh: 1.3, la: 1.2 }] };
  MD.games.forEach((g, i) => Object.assign(g, { id: 'md-' + i, kind: 'pre', comp: 'Bundesliga', when: 'Sa., 15:30 Uhr', fromMd: true }));
  const findMatch = (id) => DEMO[id] || MD.games.find((g) => g.id === id) || (store.get('history', []).find((h) => h.id === id) || null);

  function analyze(m) {
    return RE.analyze({ lh: m.lh, la: m.la, minute: m.minute, half: m.half, score: m.score, reds: m.reds, finished: m.finished });
  }

  // ------------------------------------------------------------------ Bausteine
  const S = { route: null, file: null, url: null, timers: [] };
  function topBar(path) {
    const home = path === '/';
    const titles = { '/scan': 'Analyse', '/md': 'Spieltag', '/acc': 'Treffsicherheit' };
    const t = home ? '' : path.startsWith('/r/') ? 'Ergebnis' : titles[path] || '';
    return `<header class="top">${home
      ? `<span class="brand">${logo('intro-logo')}<span>Result <b>AI</b></span></span>`
      : `<button class="back" data-act="back" aria-label="Zurück">${I.back}</button><span class="brand" style="font-size:17px">${esc(t)}</span>`}
      <span class="top-act"><button class="icon-btn" data-act="look" aria-label="Look wählen">${I.look}<span>Look</span></button></span></header>`;
  }
  const triBar = (a) => {
    const r = round100([a.probs.home, a.probs.draw, a.probs.away]);
    return `<div class="tri" role="img" aria-label="Heimsieg ${r[0]} Prozent, Remis ${r[1]} Prozent, Auswärtssieg ${r[2]} Prozent">
      <i style="flex:${a.probs.home};background:var(--home)"></i><i style="flex:${a.probs.draw};background:var(--draw)"></i><i style="flex:${a.probs.away};background:var(--away)"></i></div>`;
  };
  const miniBar = (a) => `<div class="mini-bar"><i style="flex:${a.probs.home};background:var(--home)"></i><i style="flex:${a.probs.draw};background:var(--draw)"></i><i style="flex:${a.probs.away};background:var(--away)"></i></div>`;
  const kindChip = (m) => (m.kind === 'live' ? `<span class="chip live">LIVE ${m.minute}'</span>` : m.kind === 'odds' ? '<span class="chip acc">Quoten</span>' : '<span class="chip">Vor dem Spiel</span>');

  // ------------------------------------------------------------------ Startseite
  function vHome() {
    const hist = store.get('history', []);
    const exCard = (m) => {
      const a = analyze(m);
      const r = round100([a.probs.home, a.probs.draw, a.probs.away]);
      return `<a class="card ex" href="#/r/${m.id}"><div class="row">${kindChip(m)}<span class="faint" style="font-size:12px;font-weight:700">${esc(m.comp)}</span></div>
        <div class="teams"><div class="team">${crest(m.home)}<span>${esc(m.home)}</span>${m.score ? `<b>${m.score[0]}</b>` : ''}</div>
        <div class="team">${crest(m.away)}<span>${esc(m.away)}</span>${m.score ? `<b>${m.score[1]}</b>` : ''}</div></div>
        ${miniBar(a)}<div class="mini-legend"><span style="color:var(--home)">${r[0]} %</span><span>${r[1]} %</span><span style="color:var(--away)">${r[2]} %</span></div></a>`;
    };
    const mdCard = `<a class="card ex" href="#/md"><div class="row"><span class="chip">Ganzer Spieltag</span><span class="faint" style="font-size:12px;font-weight:700">${MD.games.length} Spiele</span></div>
      <div class="teams">${MD.games.slice(0, 3).map((g) => `<div class="team" style="font-size:13px">${crest(g.home)}<span>${esc(g.home)} – ${esc(g.away)}</span></div>`).join('')}</div>
      <div class="mini-legend"><span class="muted">alle auf einmal gerechnet</span><span>›</span></div></a>`;
    return `<section class="hero"><h1>Screenshot rein.<br><em>Prozente raus.</em></h1>
      <p>Live-Spiel, Paarung, ganzer Spieltag oder Quoten – Result AI rechnet, wer gewinnt und welche Ergebnisse am wahrscheinlichsten sind.</p></section>
      <div class="scan-btns">
        <label class="scan-btn main">${I.photo}<span><b>Screenshot wählen</b><span>aus deinen Fotos</span></span><input type="file" accept="image/*" data-act="pick" aria-label="Screenshot aus Fotos wählen"></label>
        <label class="scan-btn">${I.cam}<span><b>Kamera</b><span>z. B. vom Fernseher</span></span><input type="file" accept="image/*" capture="environment" data-act="pick" aria-label="Foto mit der Kamera machen"></label>
      </div>
      <div class="kinds"><span class="chip">Live-Spielstand</span><span class="chip">Vor dem Spiel</span><span class="chip">Ganzer Spieltag</span><span class="chip">Quoten</span></div>
      <section class="sec"><div class="sec-h"><h2>Beispiele</h2><span class="note">ausgedacht · echte Rechnung</span></div>
        <div class="ex-row">${exCard(DEMO.live)}${exCard(DEMO.pre)}${exCard(DEMO.odds)}${mdCard}</div></section>
      <section class="sec"><div class="sec-h"><h2>Treffsicherheit</h2><span class="note">nur deine Scans</span></div>
        <a class="card acc-card" href="#/acc">${accRing(null)}<span><b style="font-size:15px">Wie oft lag Result AI richtig?</b><div class="muted" style="font-size:13px;font-weight:600;margin-top:2px">${hist.length ? `${hist.length} Scans gespeichert` : 'Noch keine Scans ausgewertet'} · So funktioniert's ›</div></span></a></section>
      <section class="sec"><div class="sec-h"><h2>Verlauf</h2></div>
        ${hist.length ? `<div class="card list">${hist.slice(0, 20).map((h) => `<a class="li" href="#/r/${esc(h.id)}">${crest(h.home)}<span class="grow"><div class="t">${esc(h.home)} – ${esc(h.away)}</div><div class="s">${esc(h.comp || '')}</div></span></a>`).join('')}</div>`
        : '<div class="empty">Noch keine Scans. Sobald die KI angeschlossen ist, landet hier jede Analyse – und nach dem Spiel siehst du, ob Result AI richtig lag.</div>'}</section>
      <p class="foot">Result AI · Vorschau-Version · Die KI zum Lesen der Screenshots wird gerade angeschlossen.</p>`;
  }
  function accRing(p) {
    const C = 2 * Math.PI * 24;
    return `<svg class="acc-ring" viewBox="0 0 58 58" aria-hidden="true"><circle cx="29" cy="29" r="24" fill="none" stroke="var(--surf2)" stroke-width="7"/>
      ${p != null ? `<circle cx="29" cy="29" r="24" fill="none" stroke="var(--acc)" stroke-width="7" stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - p)}" transform="rotate(-90 29 29)"/>` : ''}
      <text x="29" y="33" text-anchor="middle" font-size="13" font-weight="800" fill="var(--text)">${p != null ? Math.round(p * 100) + '%' : '–'}</text></svg>`;
  }

  // ------------------------------------------------------------------ Scan (Screenshot wird gelesen)
  function vScan() {
    if (!S.url) return vHome();
    return `<div class="scan-frame" id="frame"><img src="${S.url}" alt="Dein Screenshot"><span class="beam"></span></div>
      <div class="steps">${['Screenshot geladen', 'Teams, Spielstand und Minute erkennen', 'Stärken & Quoten nachschlagen', '121 Ergebnisse durchrechnen']
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
    at(700, () => { steps[0].classList.add('done'); $('i', steps[0]).textContent = I.check; steps[1].classList.add('on'); });
    at(1700, () => {
      $('#notice').innerHTML = `<div class="card notice"><b>Die KI wird gerade angeschlossen</b>
        <p>Dein Screenshot ist angekommen. Lesen kann Result AI ihn, sobald der Server mit der KI steht (Cloudflare + Gemini). Erfunden wird nichts – deshalb hier noch kein Ergebnis.</p>
        <a class="btn" href="#/r/live">Beispiel-Analyse ansehen</a><a class="btn ghost" href="#/">Zurück zum Start</a></div>`;
    });
  }

  // ------------------------------------------------------------------ Ergebnis
  function vResult(id) {
    const m = findMatch(id);
    if (!m) return '<div class="empty" style="margin-top:20px">Diese Analyse gibt es nicht (mehr).</div>';
    const a = analyze(m);
    const r = round100([a.probs.home, a.probs.draw, a.probs.away]);
    const fav = a.probs.home >= a.probs.away ? m.home : m.away;
    const favP = Math.max(a.probs.home, a.probs.away);
    const live = m.kind === 'live';
    let out = `<section class="card match">
      <div class="match-top">${kindChip(m)}<span class="chip">${esc(m.comp)}</span><span class="when">${live ? `${m.half === 2 ? '2. Halbzeit' : '1. Halbzeit'}` : esc(m.when || '')}</span></div>
      <div class="versus"><div class="side">${crest(m.home, 'lg')}<span class="nm">${esc(m.home)}</span></div>
        <div class="mid">${live ? `<div class="sc num">${m.score[0]}:${m.score[1]}</div><div class="sub">${m.minute}. Minute</div>` : '<div class="vs">VS</div>'}</div>
        <div class="side">${crest(m.away, 'lg')}<span class="nm">${esc(m.away)}</span></div></div>
      <div class="probs"><div class="p3">
        <div class="home"><span class="v" data-count="${r[0]}">${r[0]}<small>%</small></span><span class="l">Sieg ${esc(m.home)}</span></div>
        <div><span class="v" data-count="${r[1]}">${r[1]}<small>%</small></span><span class="l">Remis</span></div>
        <div class="away"><span class="v" data-count="${r[2]}">${r[2]}<small>%</small></span><span class="l">Sieg ${esc(m.away)}</span></div></div>
        ${triBar(a)}</div>
      <p class="verdict">${verdict(m, a, fav, favP)}</p></section>`;

    out += `<section class="sec"><div class="sec-h"><h2>Wahrscheinlichste Ergebnisse</h2></div>
      <div class="scores">${a.top.map((s, i) => `<div class="sc-card ${i === 0 ? 'best' : ''}"><div class="r num">${s.h}:${s.a}</div><div class="p">${pct1(s.p)}</div></div>`).join('')}</div></section>`;

    out += `<section class="sec"><div class="sec-h"><h2>Ergebnis-Karte</h2><span class="note">jedes Feld = ein Endstand</span></div>
      <div class="card">${heatmap(a, m)}</div></section>`;

    if (m.kind === 'odds') out += oddsBlock(m, a);

    const ovr = a.over.map((o) => `<div class="bar-row"><div class="lab"><span>Über ${nf1.format(o.line)} Tore</span><span>${pct0(o.over)}</span></div><div class="bar"><i style="width:${(o.over * 100).toFixed(1)}%"></i></div></div>`).join('');
    out += `<section class="sec"><div class="sec-h"><h2>Mehr Prognosen</h2></div><div class="card">
      <div class="bars">${ovr}<div class="bar-row"><div class="lab"><span>Beide Teams treffen</span><span>${a.btts > 0.9995 ? '✓ schon passiert' : pct0(a.btts)}</span></div><div class="bar"><i style="width:${(a.btts * 100).toFixed(1)}%"></i></div></div></div>
      <div class="split3" style="margin-top:16px"><div><b>${pct0(a.double['1X'])}</b><span>1X · ${esc(m.home)} oder Remis</span></div><div><b>${pct0(a.double['12'])}</b><span>12 · kein Remis</span></div><div><b>${pct0(a.double.X2)}</b><span>X2 · ${esc(m.away)} oder Remis</span></div></div>
      ${a.ht ? `<div style="margin-top:16px"><span class="eyebrow">Halbzeit</span><div class="split3" style="margin-top:8px"><div><b>${pct0(a.ht.home)}</b><span>${esc(m.home)} führt</span></div><div><b>${pct0(a.ht.draw)}</b><span>Unentschieden</span></div><div><b>${pct0(a.ht.away)}</b><span>${esc(m.away)} führt</span></div></div>
        <div class="muted" style="font-size:12px;font-weight:600;margin-top:8px">Wahrscheinlichster Halbzeitstand: ${a.ht.top.map((s) => `${s.h}:${s.a} (${pct0(s.p)})`).join(' · ')}</div></div>` : ''}
      </div></section>`;

    const nx = a.next;
    out += `<section class="sec"><div class="sec-h"><h2>Nächstes Tor</h2><span class="note">${live ? `ab der ${m.minute}. Minute` : 'ab Anpfiff'}</span></div><div class="card">
      <div class="split3"><div><b style="color:var(--home)">${pct0(nx.home)}</b><span>${esc(m.home)}</span></div><div><b>${pct0(nx.none)}</b><span>kein Tor mehr</span></div><div><b style="color:var(--away)">${pct0(nx.away)}</b><span>${esc(m.away)}</span></div></div>
      <div style="margin-top:14px"><div class="kv"><span>Tor in den nächsten 10 Min.</span><span>${pct0(nx.in10)}</span></div><div class="kv"><span>… in 20 Min.</span><span>${pct0(nx.in20)}</span></div><div class="kv"><span>… in 30 Min.</span><span>${pct0(nx.in30)}</span></div>
      <div class="kv"><span>Halb-halb-Marke</span><span>${nx.median != null ? `bis zur ${nx.median}. Min.` : 'eher kein Tor mehr'}</span></div></div></div></section>`;

    out += `<section class="sec"><div class="sec-h"><h2>Erklärung</h2><span class="note">aus den Zahlen</span></div><div class="card explain">${explain(m, a, fav, favP)}</div></section>`;
    out += `<div class="demo-note">${m.fromMd || DEMO[m.id] ? 'Beispiel-Spiel (ausgedacht). Die Rechnung ist echt – mit deinem Screenshot und der KI kommen echte Spiele, Form und Quoten dazu.' : ''}</div>
      <p class="foot">Gerechnet mit einem Poisson-Tormodell (Dixon-Coles) – exakt, ohne Zufall.<br>Gleiches Spiel am selben Tag = gleiche Zahlen.</p>`;
    return out;
  }
  function verdict(m, a, fav, favP) {
    if (Math.abs(a.probs.home - a.probs.away) < 0.06) return `<b>Offenes Spiel.</b> Keiner ist klar vorne – Remis liegt bei ${pct0(a.probs.draw)}.`;
    const how = favP > 0.7 ? 'klarer Favorit' : favP > 0.5 ? 'Favorit' : 'leicht vorne';
    return `<b>${esc(fav)} ist ${how}.</b> Wahrscheinlichstes Ergebnis: ${a.top[0].h}:${a.top[0].a} (${pct1(a.top[0].p)}).`;
  }
  function heatmap(a, m) {
    const mx = Math.max(...a.matrix.flat().slice(0));
    let h = '<div class="heat"><span class="ax"></span>' + [0, 1, 2, 3, 4, 5].map((y) => `<span class="ax">${y}</span>`).join('');
    for (let x = 0; x <= 5; x++) {
      h += `<span class="ax">${x}</span>`;
      for (let y = 0; y <= 5; y++) {
        const p = (a.matrix[x] || [])[y] || 0;
        const k = p / mx;
        h += `<span class="c" title="${x}:${y} ${pct1(p)}"><i style="opacity:${(0.08 + 0.92 * k).toFixed(3)}"></i><em style="color:${k > 0.55 ? 'var(--on-acc)' : 'var(--text)'}">${p >= 0.005 ? Math.round(p * 100) : ''}</em></span>`;
      }
    }
    return h + `</div><div class="heat-cap"><span>↓ Tore ${esc(m.home)}</span><span>Tore ${esc(m.away)} →</span></div>`;
  }
  function oddsBlock(m, a) {
    const q = RE.fromOdds(m.odds);
    const mk = RE.analyze({ lh: q.lh, la: q.la });
    const row = (l, x, y) => `<span>${l}</span><b>${pct0(x)}</b><b>${pct0(y)}</b>`;
    return `<section class="sec"><div class="sec-h"><h2>Markt vs. Result AI</h2><span class="note">Quoten ${nf2.format(m.odds.home)} · ${nf2.format(m.odds.draw)} · ${nf2.format(m.odds.away)}</span></div>
      <div class="card"><div class="cmp"><span class="h">Ausgang</span><span class="h">Markt</span><span class="h">Result AI</span>
      ${row(`Sieg ${esc(m.home)}`, q.market.home, a.probs.home)}${row('Remis', q.market.draw, a.probs.draw)}${row(`Sieg ${esc(m.away)}`, q.market.away, a.probs.away)}
      ${row('Über 2,5 Tore', mk.over.find((o) => o.line === 2.5).over, a.over.find((o) => o.line === 2.5).over)}</div>
      <p class="muted" style="font-size:12px;font-weight:600;margin-top:12px">Markt = aus den Quoten, ohne die Marge der Buchmacher (${nf1.format(q.market.margin * 100)} %). Result AI = eigene Rechnung aus den Team-Stärken.</p></div></section>`;
  }
  function explain(m, a, fav, favP) {
    const xg = (v) => nf1.format(v);
    const ps = [];
    if (m.kind === 'live') {
      const pre = RE.analyze({ lh: m.lh, la: m.la });
      ps.push(`Vor dem Anpfiff lag ${esc(m.home)} bei ${pct0(pre.probs.home)} Siegchance. Beim Stand von ${m.score[0]}:${m.score[1]} in der ${m.minute}. Minute fallen im Schnitt nur noch ${xg(a.rest.home + a.rest.away)} Tore – deshalb steht ${esc(m.home)} jetzt bei ${pct0(a.probs.home)}, und ein Remis ist auf ${pct0(a.probs.draw)} gestiegen.`);
    } else {
      ps.push(`Im Schnitt erzielt ${esc(m.home)} in diesem Spiel ${xg(a.xg.home)} Tore, ${esc(m.away)} ${xg(a.xg.away)}. Daraus ergibt sich ${pct0(favP)} für ${esc(fav)}.`);
    }
    ps.push(`Das wahrscheinlichste einzelne Ergebnis ist ${a.top[0].h}:${a.top[0].a} – aber auch das tritt nur in ${pct0(a.top[0].p)} der Fälle ein. Fußball bleibt knapp.`);
    ps.push('<span class="muted">Mit angeschlossener KI kommt hier ein Formcheck dazu: letzte Spiele, Ausfälle und was die Buchmacher erwarten.</span>');
    return ps.map((p) => `<p>${p}</p>`).join('');
  }

  // ------------------------------------------------------------------ Spieltag
  function vMatchday() {
    return `<section class="hero" style="padding-top:4px"><span class="eyebrow">${esc(MD.comp)}</span><h1 style="font-size:34px;margin-top:6px">Ganzer <em>Spieltag</em></h1></section>
      <div style="display:flex;flex-direction:column;gap:10px;margin-top:16px">${MD.games.map((g) => {
        const a = analyze(g);
        const r = round100([a.probs.home, a.probs.draw, a.probs.away]);
        return `<a class="card md-item" href="#/r/${g.id}"><div class="row">${crest(g.home)}<span>${esc(g.home)}</span><span class="faint">–</span><span>${esc(g.away)}</span>${crest(g.away)}<span class="x">${a.top[0].h}:${a.top[0].a} ›</span></div>
          ${miniBar(a)}<div class="mini-legend"><span style="color:var(--home)">${r[0]} %</span><span>Remis ${r[1]} %</span><span style="color:var(--away)">${r[2]} %</span></div></a>`;
      }).join('')}</div><div class="demo-note">Beispiel-Spieltag (ausgedacht). Mit der KI liest Result AI alle Spiele direkt aus einem Screenshot.</div>`;
  }

  // ------------------------------------------------------------------ Treffsicherheit
  function vAccuracy() {
    const pts = [[10, 10], [30, 30], [50, 50], [70, 70], [90, 90]];
    const svg = `<svg class="calib" viewBox="0 0 300 200" role="img" aria-label="Beispiel: Ehrlichkeits-Diagramm">
      <line x1="40" y1="170" x2="290" y2="170" stroke="var(--line)"/><line x1="40" y1="10" x2="40" y2="170" stroke="var(--line)"/>
      <line x1="40" y1="170" x2="290" y2="10" stroke="var(--faint)" stroke-dasharray="4 5"/>
      ${pts.map(([x, y]) => `<circle cx="${40 + x * 2.5}" cy="${170 - y * 1.6}" r="5" fill="var(--acc)"/>`).join('')}
      <text x="165" y="194" text-anchor="middle" font-size="11" fill="var(--muted)" font-weight="700">Result AI sagt … %</text>
      <text x="14" y="90" text-anchor="middle" font-size="11" fill="var(--muted)" font-weight="700" transform="rotate(-90 14 90)">passiert in … %</text></svg>`;
    return `<section class="hero" style="padding-top:4px"><h1 style="font-size:34px">Wie oft lag<br><em>Result AI richtig?</em></h1>
      <p>Jede Analyse wird auf deinem Handy gespeichert. Nach dem Spiel holt sich die App das echte Ergebnis und rechnet ehrlich nach.</p></section>
      <div class="card" style="margin-top:18px;display:flex;flex-direction:column;gap:16px">
        <div class="metric"><span class="n">1</span><p><b>Favorit gewonnen</b>Wie oft hat das Team mit der höheren Siegchance wirklich gewonnen – z. B. „63 von 100“.</p></div>
        <div class="metric"><span class="n">2</span><p><b>Ergebnis unter den Top 3</b>Wie oft war der echte Endstand unter den drei wahrscheinlichsten Ergebnissen.</p></div>
        <div class="metric"><span class="n">3</span><p><b>Ehrlichkeit</b>Sagt Result AI 70 %, sollte es auch in etwa 70 % der Fälle passieren. Liegen die Punkte auf der Linie, kann man den Zahlen trauen.</p></div>
      </div>
      <section class="sec"><div class="sec-h"><h2>Ehrlichkeits-Diagramm</h2><span class="note">so sieht es aus</span></div><div class="card">${svg}</div>
        <div class="empty" style="margin-top:10px">Noch keine Scans ausgewertet. Sobald die ersten gescannten Spiele vorbei sind, stehen hier deine echten Zahlen.</div></section>`;
  }

  // ------------------------------------------------------------------ Look-Auswahl
  function openLook() {
    const cur = document.documentElement.dataset.look;
    const sh = document.createElement('div');
    sh.className = 'sheet';
    sh.innerHTML = `<div class="bg" data-act="close"></div><div class="panel" role="dialog" aria-label="Look wählen"><div class="grip"></div>
      <h2 class="display" style="font-size:22px">Welcher Look?</h2><p class="muted" style="font-size:13px;margin-top:4px">Probier alle drei auf deinem iPhone – sag mir dann, welcher es wird.</p>
      <div class="looks">${LOOKS.map((L) => `<button class="look ${L.id === cur ? 'on' : ''}" data-act="setlook" data-id="${L.id}"><span class="sw" style="background:${L.sw[0]}"><i style="left:8px;top:8px;width:22px;height:22px;border-radius:50%;background:${L.sw[1]}"></i><i style="right:8px;bottom:8px;width:16px;height:16px;border-radius:50%;background:${L.sw[2]}"></i></span><span><b>${L.name}</b><span>${L.desc}</span></span></button>`).join('')}</div></div>`;
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
    $('#app').innerHTML = topBar(path) + `<main id="view">${html}</main>`;
    if (S.route !== path) window.scrollTo(0, 0);
    S.route = path;
    if (first && path === '/' && !reduce) $('.intro-logo') && $('.intro-logo').classList.add('intro');
    if (path === '/scan') runScan();
    if (path.startsWith('/r/')) revealResult();
  }
  // Ergebnis-Auftritt: Balken wachsen, die drei großen Zahlen zählen hoch, Ergebnis-Karten steigen auf (nur einmal, nur transform/opacity)
  function revealResult() {
    const v = $('#view');
    if (reduce) return;
    v.classList.add('reveal');
    const els = $$('[data-count]', v);
    const t0 = performance.now();
    const step = (now) => {
      const k = Math.min(1, (now - t0) / 900);
      const e = 1 - Math.pow(1 - k, 3);
      els.forEach((el) => { el.firstChild.nodeValue = String(Math.round(+el.dataset.count * e)); });
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  // ------------------------------------------------------------------ Ereignisse
  document.addEventListener('click', (e) => {
    const a = e.target.closest('[data-act]');
    if (!a) return;
    const act = a.dataset.act;
    if (act === 'back') { if (history.length > 1) history.back(); else location.hash = '#/'; }
    else if (act === 'look') openLook();
    else if (act === 'setlook') { applyLook(a.dataset.id); $$('.look').forEach((b) => b.classList.toggle('on', b === a)); setTimeout(() => { const sh = $('.sheet'); if (sh) sh.remove(); }, 180); }
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
    const PRESS = 'a.card, .scan-btn, .btn, .icon-btn, .back, .look, .sc-card, .li';
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

  applyLook(store.get('look', 'nova'));
  render();
})();
