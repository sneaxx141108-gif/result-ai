/* Result AI – Rechen-Kern (ohne KI, ohne Zufall).
   Aus der Tor-Erwartung beider Teams (bzw. aus Quoten) wird exakt gerechnet: Poisson-Tormodell mit Dixon-Coles-Korrektur
   (wie forecast.py der BVB-App). Gleiche Eingabe -> immer exakt dasselbe Ergebnis. Läuft im Browser und in Node (Tests). */
(function (root) {
  'use strict';

  const MAXG = 10; // Tore je Team, die betrachtet werden (mehr kommt praktisch nie vor)
  const RHO = -0.07; // Dixon-Coles: etwas mehr 0:0/1:1, etwas weniger 1:0/0:1 als reines Poisson
  // Torverteilung über die Spielzeit: ~45 % der Tore in Halbzeit 1 (inkl. ~1 Min. Nachspielzeit), ~55 % in Halbzeit 2 (~4 Min.)
  const H1_SHARE = 0.45;
  const H1_LEN = 46;
  const H2_LEN = 49;
  // Rote Karte: das Team in Unterzahl trifft seltener, der Gegner öfter (je Karte, nur für die Restzeit)
  const RED_OWN = 0.67;
  const RED_OPP = 1.22;

  function poisVec(lam, n = MAXG) {
    const out = new Array(n + 1);
    let p = Math.exp(-lam);
    for (let k = 0; k <= n; k++) {
      out[k] = p;
      p *= lam / (k + 1);
    }
    return out;
  }

  // Wahrscheinlichkeit jedes Ergebnisses x:y; dc = Dixon-Coles-Korrektur (nur für ganze Spiele ab 0:0)
  function scoreMatrix(lh, la, dc = true) {
    const ph = poisVec(lh);
    const pa = poisVec(la);
    const m = ph.map((a) => pa.map((b) => a * b));
    if (dc) {
      m[0][0] *= Math.max(0, 1 - lh * la * RHO);
      m[0][1] *= Math.max(0, 1 + lh * RHO);
      m[1][0] *= Math.max(0, 1 + la * RHO);
      m[1][1] *= Math.max(0, 1 - RHO);
    }
    let s = 0;
    for (const row of m) for (const v of row) s += v;
    return m.map((row) => row.map((v) => v / s));
  }

  function outcome(m) {
    let w = 0;
    let d = 0;
    let l = 0;
    m.forEach((row, x) => row.forEach((v, y) => {
      if (x > y) w += v;
      else if (x === y) d += v;
      else l += v;
    }));
    return { home: w, draw: d, away: l };
  }

  // Anteil der Tore, die bis zur Minute t im Schnitt schon gefallen sind (0..1)
  function goalShareUntil(t) {
    if (t <= 0) return 0;
    if (t <= H1_LEN) return H1_SHARE * (t / H1_LEN);
    const t2 = Math.min(H2_LEN, t - H1_LEN);
    return H1_SHARE + (1 - H1_SHARE) * (t2 / H2_LEN);
  }

  // Minute aus dem Screenshot -> verstrichene Spielzeit in "Modell-Minuten" (Halbzeit 1 = 0..46, Halbzeit 2 = 46..95)
  function clock(minute, half) {
    if (minute == null || minute <= 0) return 0;
    if (half === 'ht') return H1_LEN;
    if (half === 2 || minute > 45) return H1_LEN + Math.min(H2_LEN, Math.max(0, minute - 45));
    return Math.min(H1_LEN, minute);
  }

  function shift(m, sh, sa) {
    const n = MAXG + 1;
    const out = Array.from({ length: n + sh }, () => new Array(n + sa).fill(0));
    m.forEach((row, x) => row.forEach((v, y) => { out[x + sh][y + sa] += v; }));
    return out;
  }

  function pOver(m, line) {
    let p = 0;
    m.forEach((row, x) => row.forEach((v, y) => { if (x + y > line) p += v; }));
    return p;
  }

  function btts(m) {
    let p = 0;
    m.forEach((row, x) => row.forEach((v, y) => { if (x > 0 && y > 0) p += v; }));
    return p;
  }

  function topScores(m, n = 6) {
    const all = [];
    m.forEach((row, x) => row.forEach((v, y) => all.push({ h: x, a: y, p: v })));
    // feste Reihenfolge bei Gleichstand -> immer dieselbe Liste
    all.sort((a, b) => (b.p - a.p) || (a.h - b.h) || (a.a - b.a));
    return all.slice(0, n);
  }

  /* Hauptfunktion.
     input: { lh, la }            Tor-Erwartung für ein ganzes Spiel (Heim, Gast)
            minute, half          Spielminute aus dem Screenshot (0 / leer = vor dem Spiel), half: 1, 2 oder 'ht'
            score: [h, a]         aktueller Spielstand (live)
            reds: [h, a]          rote Karten (live)
            finished              Spiel vorbei -> Endstand steht fest */
  function analyze(input) {
    const lh = Math.max(0.02, +input.lh || 0);
    const la = Math.max(0.02, +input.la || 0);
    const score = input.score || [0, 0];
    const reds = input.reds || [0, 0];
    const t = input.finished ? H1_LEN + H2_LEN : clock(input.minute, input.half);
    const live = t > 0;
    const rest = 1 - goalShareUntil(t);
    let fh = 1;
    let fa = 1;
    for (let i = 0; i < (reds[0] || 0); i++) { fh *= RED_OWN; fa *= RED_OPP; }
    for (let i = 0; i < (reds[1] || 0); i++) { fa *= RED_OWN; fh *= RED_OPP; }
    const rh = lh * rest * fh;
    const ra = la * rest * fa;
    // Restliche Tore: vor dem Spiel mit Dixon-Coles, im Spiel reines Poisson; dann um den Spielstand verschieben
    const add = scoreMatrix(rh, ra, !live);
    const fin = shift(add, score[0] || 0, score[1] || 0);
    const res = outcome(fin);
    const total = (score[0] || 0) + (score[1] || 0);
    const lines = [0.5, 1.5, 2.5, 3.5, 4.5].filter((l) => l > total - 0.5 || !live);
    // Nächstes Tor (Restzeit): wer trifft zuerst, und wann
    const restRate = rh + ra; // erwartete Tore bis Schluss
    const pNone = Math.exp(-restRate);
    const restMin = Math.max(1, H1_LEN + H2_LEN - t);
    const perMin = restRate / restMin;
    const within = (k) => 1 - Math.exp(-perMin * Math.min(k, restMin));
    // Halbzeit (nur wenn sie noch nicht vorbei ist)
    let ht = null;
    if (t < H1_LEN) {
      const restH1 = (H1_SHARE - goalShareUntil(t));
      const m1 = shift(scoreMatrix(lh * restH1 * fh, la * restH1 * fa, !live), score[0] || 0, score[1] || 0);
      ht = Object.assign(outcome(m1), { top: topScores(m1, 3) });
    }
    // Gesamttore am Ende: 0, 1, …, 5 und „6 oder mehr“
    const totals = new Array(7).fill(0);
    fin.forEach((row, x) => row.forEach((v, y) => { totals[Math.min(6, x + y)] += v; }));
    // Tor-Kurve: Wahrscheinlichkeit, dass bis zur Minute m (noch) ein Tor fällt – in 5-Minuten-Schritten bis Abpfiff
    const rate = lh * fh + la * fa; // Tore je ganzes Spiel bei aktueller Spielerzahl
    const shareNow = goalShareUntil(t);
    const curve = [];
    for (let m = live ? Math.ceil(((input.minute || 0) + 0.5) / 5) * 5 : 0; m <= 90; m += 5) {
      curve.push({ m, p: 1 - Math.exp(-rate * Math.max(0, goalShareUntil(clock(m, m > 45 ? 2 : 1)) - shareNow)) });
    }
    curve.push({ m: 95, p: 1 - pNone }); // inkl. Nachspielzeit
    return {
      live,
      minute: input.minute || 0,
      score: [score[0] || 0, score[1] || 0],
      xg: { home: (score[0] || 0) + rh, away: (score[1] || 0) + ra },
      rest: { home: rh, away: ra },
      probs: res,
      double: { '1X': res.home + res.draw, X2: res.draw + res.away, 12: res.home + res.away },
      top: topScores(fin, 6),
      matrix: fin.slice(0, 7).map((row) => row.slice(0, 7)),
      over: lines.map((l) => ({ line: l, over: pOver(fin, l), under: 1 - pOver(fin, l) })),
      btts: input.market && !live ? calibrate('BY', btts(fin)) : btts(fin),
      hs: 1 - fin[0].reduce((s, v) => s + v, 0),
      as: 1 - fin.reduce((s, row) => s + row[0], 0),
      next: {
        home: restRate > 0 ? (rh / restRate) * (1 - pNone) : 0,
        away: restRate > 0 ? (ra / restRate) * (1 - pNone) : 0,
        none: pNone,
        in10: within(10),
        in20: within(20),
        in30: within(30),
        // Minute, bis zu der das nächste Tor mit 50 % gefallen ist (null = eher kein Tor mehr)
        median: pNone < 0.5 ? Math.round((input.minute || 0) + Math.log(2) / perMin) : null,
        curve,
      },
      totals,
      ht,
    };
  }

  /* Buchmacher-Marge rausrechnen (Potenz-Methode, wie devig in forecast.py): rs = 1/Quote je Ausgang -> Chancen mit Summe 1.
     Backtest 08.11.2026 (112.610 Spiele): vor allem bei Favoriten genauer als gleichmäßiges Runterteilen. */
  function devig(rs) {
    let lo = 0.5;
    let hi = 4;
    for (let i = 0; i < 60; i++) {
      const k = (lo + hi) / 2;
      if (rs.reduce((a, r) => a + Math.pow(r, k), 0) > 1) lo = k; else hi = k;
    }
    const k = (lo + hi) / 2;
    const out = rs.map((r) => Math.pow(r, k));
    const s = out.reduce((a, b) => a + b, 0);
    return out.map((x) => x / s);
  }
  // Erwartete Tore aus Sieg-minus-Niederlage-Chance und Remis-Chance (Newton-Verfahren, wie lambdas_from_draw in forecast.py)
  function fromDraw(diff, pdraw) {
    let lh = 1.5;
    let la = 1.2;
    const res = (a, b) => { const o = outcome(scoreMatrix(a, b)); return [o.home - o.away - diff, o.draw - pdraw]; };
    for (let i = 0; i < 14; i++) {
      const r = res(lh, la);
      if (Math.abs(r[0]) + Math.abs(r[1]) < 2e-6) break;
      const e = 1e-4;
      const a = res(lh + e, la);
      const b = res(lh, la + e);
      const j00 = (a[0] - r[0]) / e;
      const j01 = (b[0] - r[0]) / e;
      const j10 = (a[1] - r[1]) / e;
      const j11 = (b[1] - r[1]) / e;
      const det = j00 * j11 - j01 * j10;
      if (Math.abs(det) < 1e-9) break;
      let dl = (j11 * r[0] - j01 * r[1]) / det;
      let dm = (-j10 * r[0] + j00 * r[1]) / det;
      const big = Math.max(Math.abs(dl), Math.abs(dm));
      if (big > 0.6) { dl *= 0.6 / big; dm *= 0.6 / big; }
      lh = Math.min(7, Math.max(0.05, lh - dl));
      la = Math.min(7, Math.max(0.05, la - dm));
    }
    return [lh, la];
  }
  /* Feinabgleich der Tor-Wetten (Backtest 08.11.2026, 48.603 Spiele, in drei Test-Saisons immer besser): aus Quoten gerechnete Chancen
     für „beide treffen“, „Heim trifft“ und „Gast trifft“ leicht nachjustieren. a/b gelernt an allen Jahren. */
  const CAL = { BY: [0.0615, 0.923], HS: [-0.0119, 1.0616], AS: [0.0599, 1.0035] };
  function calibrate(code, p) {
    const c = CAL[code === 'BN' ? 'BY' : code];
    if (!c || !(p > 0 && p < 1)) return p;
    const q = code === 'BN' ? 1 - p : p;
    const x = 1 / (1 + Math.exp(-(c[0] + c[1] * Math.log(q / (1 - q)))));
    return code === 'BN' ? 1 - x : x;
  }
  // Chance einer Wette (Wett-Codes wie in tips.py) aus einer Analyse; market = aus Quoten gerechnet → Feinabgleich (btts ist dann schon abgeglichen)
  function codeProb(a, code, market) {
    const po = (l) => { const o = a.over.find((x) => x.line === l); return o ? o.over : null; };
    const m = /^([OU])(\d)(\d)$/.exec(code);
    if (m) { const v = po(+m[2] + +m[3] / 10); return v == null ? null : m[1] === 'O' ? v : 1 - v; }
    if (code === 'BY') return a.btts;
    if (code === 'BN') return 1 - a.btts;
    const raw = { H: a.probs.home, D: a.probs.draw, A: a.probs.away, HD: a.double['1X'], DA: a.double.X2, HA: a.double['12'], HS: a.hs, AS: a.as }[code];
    if (raw == null) return null;
    return market ? calibrate(code, raw) : raw;
  }

  /* Quoten -> Tor-Erwartung (wie market_lambdas der BVB-App).
     odds: { home, draw, away } (Dezimalquoten), optional line + over (z. B. 2.5 und Quote auf "über") */
  function fromOdds(odds) {
    const ih = 1 / odds.home;
    const id = 1 / odds.draw;
    const ia = 1 / odds.away;
    const book = ih + id + ia;
    const fair = devig([ih, id, ia]);
    const market = { home: fair[0], draw: fair[1], away: fair[2], margin: book - 1 };
    const target = market.home - market.away;
    const supFor = (total) => {
      let lo = -total + 0.02;
      let hi = total - 0.02;
      for (let i = 0; i < 40; i++) {
        const mid = (lo + hi) / 2;
        const o = outcome(scoreMatrix((total + mid) / 2, (total - mid) / 2));
        if (o.home - o.away < target) lo = mid; else hi = mid;
      }
      return (lo + hi) / 2;
    };
    if (!(odds.line && odds.over && odds.under)) {
      // keine Über/Unter-Quote: die Remis-Quote verrät, wie torreich das Spiel wird (genauer als pauschal 2,75 Tore)
      const l = fromDraw(target, market.draw);
      return { lh: l[0], la: l[1], market };
    }
    let total = 2.75;
    if (odds.line && odds.over && odds.under) {
      const po = devig([1 / odds.over, 1 / odds.under])[0];
      let lo = 0.6;
      let hi = 6.5;
      for (let i = 0; i < 30; i++) {
        const mid = (lo + hi) / 2;
        const s = supFor(mid);
        if (pOver(scoreMatrix((mid + s) / 2, (mid - s) / 2), odds.line) < po) lo = mid; else hi = mid;
      }
      total = (lo + hi) / 2;
    }
    const s = supFor(total);
    return { lh: Math.max(0.05, (total + s) / 2), la: Math.max(0.05, (total - s) / 2), market };
  }

  const api = { MAXG, analyze, fromOdds, scoreMatrix, outcome, poisVec, goalShareUntil, devig, calibrate, codeProb };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.RE = api;
})(typeof self !== 'undefined' ? self : this);
