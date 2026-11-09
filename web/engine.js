/* Result AI – Rechen-Kern (ohne KI, ohne Zufall).
   Aus der Tor-Erwartung beider Teams (bzw. aus Quoten) wird exakt gerechnet: vor dem Spiel Poisson-Tormodell mit Dixon-Coles-Korrektur und Ergebnis-Tabelle,
   im Spiel Minute für Minute mit gelernten Tor-Zeiten, Spielstand und roten Karten. Gleiche Eingabe -> immer exakt dasselbe Ergebnis. Läuft im Browser und in Node (Tests). */
(function (root) {
  'use strict';

  const MAXG = 10; // Tore je Team, die betrachtet werden (mehr kommt praktisch nie vor)
  const RHO = -0.07; // Dixon-Coles: etwas mehr 0:0/1:1, etwas weniger 1:0/0:1 als reines Poisson
  // Spiel-Uhr in Schritten: 1–45 = Minute 1–45, 46 = Nachspielzeit Halbzeit 1, 47–91 = Minute 46–90, 92–95 = Nachspielzeit Halbzeit 2
  const H1_LEN = 46;
  const H2_LEN = 49;
  const STEPS = H1_LEN + H2_LEN;
  const SUB = 2; // Teilschritte je Minute beim Durchrechnen (genau so wurde gelernt)
  /* Live-Modell: gelernt an echten Tor-Minuten. Backtest 09.11.2026: 34.913 Ligaspiele mit Minuten (ESPN) und Schlussquoten (football-data),
     gelernt bis Juni 2025, geprüft an 8.545 späteren Spielen, jeweils ab Minute 1, 15, 30, Halbzeit, 60, 75, 85 (Log-Loss, kleiner = besser):
     alte Formel → dieses Modell: Sieg/Remis/Niederlage 0,7765 → 0,7703 · Über 2,5 Tore 0,4699 → 0,4663 · beide treffen 0,4840 → 0,4779 ·
     genauer Endstand 2,1062 → 2,0934 · wer das nächste Tor schießt 0,9478 → 0,9397 · Halbzeit-Stand ab Minute 30 0,6688 → 0,6650.
     Abgelehnt, weil schlechter: aus den bisherigen Toren eines Spiels auf die restlichen schließen (beide Varianten).
     Änderungen nur nach neuem Backtest.
     GOAL_BINS: Anteil der Tore je Stück (1.–45. in Fünfern, Nachspielzeit 1, 46.–90. in Fünfern, Nachspielzeit 2), bezogen auf „es steht unentschieden“.
     Die Summe liegt über 1, weil wer führt, im Schnitt seltener trifft. */
  const GOAL_BINS = [0.0385, 0.0491, 0.0495, 0.05, 0.0502, 0.0505, 0.0513, 0.0508, 0.0505, 0.0307, 0.0498, 0.0597, 0.0586, 0.0562, 0.0544, 0.0531, 0.0551, 0.0564, 0.0564, 0.0714];
  // Wie sehr der Spielstand das Treffen ändert. Zeile: eigene Tore minus gegnerische (−2 oder weniger … +2 oder mehr), Spalte: Spielphase (bis 30., bis Halbzeit, bis 60., bis 75., Rest)
  const STATE_HOME = [
    [0.946, 1.085, 1.119, 1.136, 1.103],
    [0.953, 1.071, 1.121, 1.101, 1.182],
    [1, 1, 1, 1, 1],
    [0.892, 0.929, 0.91, 0.906, 0.835],
    [0.829, 0.905, 0.895, 0.922, 0.85],
  ];
  const STATE_AWAY = [
    [0.928, 1.041, 1.1, 1.127, 1.109],
    [1.017, 1.033, 1.1, 1.15, 1.175],
    [1, 1, 1, 1, 1],
    [0.942, 0.925, 0.988, 0.944, 0.867],
    [0.791, 0.993, 0.944, 0.975, 0.906],
  ];
  // Rote Karten: eigene minus gegnerische (−2 … +2). Wirkung auf die eigenen Tore, für die Restzeit
  const RED = [2.287, 1.665, 1, 0.543, 0.38];
  const BIN = new Array(STEPS + 1).fill(0);
  const WIDTH = new Array(GOAL_BINS.length).fill(0);
  for (let t = 1; t <= STEPS; t++) {
    BIN[t] = t <= 45 ? Math.floor((t - 1) / 5) : t === 46 ? 9 : t <= 91 ? 10 + Math.floor((t - 47) / 5) : 19;
    WIDTH[BIN[t]]++;
  }
  const GOALS = BIN.map((b, t) => (t ? GOAL_BINS[b] / WIDTH[b] : 0)); // Tor-Anteil je Schritt
  const CUM = [0];
  for (let t = 1; t <= STEPS; t++) CUM[t] = CUM[t - 1] + GOALS[t];
  const PHASE = BIN.map((b, t) => (t <= 30 ? 0 : t <= 46 ? 1 : t <= 61 ? 2 : t <= 76 ? 3 : 4));
  const diffIdx = (d) => Math.max(-2, Math.min(2, d)) + 2;
  /* Ergebnis-Tabelle (wie SCORE_TABLE in forecast.py): Wie viel häufiger oder seltener ein genaues Ergebnis wirklich vorkommt als im reinen Tormodell.
     Vor allem hohe Remis und knappe Spiele (2:2, 3:3, 3:2) sind häufiger: Wer zurückliegt, riskiert mehr. Zeile = Tore Heim, Spalte = Tore Gast.
     Backtest 09.11.2026 (110.165 Spiele 2012–2026 mit Schlussquoten, gelernt bis 2023/24, geprüft an 17.724 späteren Spielen):
     Log-Loss genaues Ergebnis 2,8746 → 2,8706, Anzahl Tore 1,7976 → 1,7962. Heim/Gast gleich behandelt (ebenso genau), danach an allen Jahren gelernt. Gilt nur vor dem Spiel. */
  const TABLE = [
    [0.863, 0.996, 0.918, 0.959, 0.953, 0.959],
    [0.996, 1.014, 1.089, 1.019, 1.003, 1.025],
    [0.918, 1.089, 1.239, 1.212, 1.064, 1.038],
    [0.959, 1.019, 1.212, 1.339, 1.24, 0.981],
    [0.953, 1.003, 1.064, 1.24, 1.336, 1.14],
    [0.959, 1.025, 1.038, 0.981, 1.14, 1],
  ];

  function poisVec(lam, n = MAXG) {
    const out = new Array(n + 1);
    let p = Math.exp(-lam);
    for (let k = 0; k <= n; k++) {
      out[k] = p;
      p *= lam / (k + 1);
    }
    return out;
  }

  // Wahrscheinlichkeit jedes Ergebnisses x:y; dc = Ergebnis-Tabelle und Dixon-Coles-Korrektur (nur für ganze Spiele ab 0:0)
  function scoreMatrix(lh, la, dc = true) {
    const ph = poisVec(lh);
    const pa = poisVec(la);
    const m = ph.map((a, x) => pa.map((b, y) => a * b * (dc && x < 6 && y < 6 ? TABLE[x][y] : 1)));
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
    return CUM[Math.min(STEPS, Math.floor(t))] / CUM[STEPS];
  }

  // Minute aus dem Screenshot -> verstrichene Spielzeit in "Modell-Minuten" (Halbzeit 1 = 0..46, Halbzeit 2 = 46..95)
  function clock(minute, half) {
    if (minute == null || minute <= 0) return 0;
    if (half === 'ht') return H1_LEN;
    if (half === 1) return Math.min(H1_LEN, minute); // 45+2 steht oft als 47 da, ist aber noch Halbzeit 1
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

  /* Das Spiel ab Schritt t0 bis tEnd exakt durchrechnen, Minute für Minute: Nach jedem Tor ändert sich der Spielstand und damit, wie oft beide treffen.
     Ergebnis: Wahrscheinlichkeit für x weitere Heimtore und y weitere Gasttore. Rote Karten gelten so, wie sie gerade stehen. */
  function playOut(lh, la, t0, tEnd, score, reds) {
    const n = MAXG + 1;
    let cur = new Float64Array(n * n);
    let nxt = new Float64Array(n * n);
    cur[0] = 1;
    const rd = (reds[0] || 0) - (reds[1] || 0);
    const rh = RED[diffIdx(rd)];
    const ra = RED[diffIdx(-rd)];
    for (let t = t0 + 1; t <= tEnd; t++) {
      const ph = PHASE[t];
      const gh = (lh * GOALS[t] * rh) / SUB;
      const ga = (la * GOALS[t] * ra) / SUB;
      for (let s = 0; s < SUB; s++) {
        nxt.fill(0);
        for (let x = 0; x < n; x++) {
          for (let y = 0; y < n; y++) {
            const v = cur[x * n + y];
            if (!v) continue;
            const d = diffIdx(score[0] + x - score[1] - y);
            const eh = gh * STATE_HOME[d][ph];
            const ea = ga * STATE_AWAY[4 - d][ph];
            nxt[x * n + y] += v * (1 - eh - ea);
            nxt[Math.min(n - 1, x + 1) * n + y] += v * eh;
            nxt[x * n + Math.min(n - 1, y + 1)] += v * ea;
          }
        }
        const tmp = cur;
        cur = nxt;
        nxt = tmp;
      }
    }
    return Array.from({ length: n }, (_, x) => Array.from(cur.subarray(x * n, x * n + n)));
  }

  /* Nächstes Tor: Bis es fällt, bleibt der Spielstand gleich. S[t] = Chance, dass bis einschließlich Schritt t kein Tor mehr gefallen ist.
     target: vor dem Spiel die Chance auf 0:0 aus der Ergebnis-Tabelle, damit „kein Tor“ und das 0:0 dieselbe Zahl zeigen. */
  function nextGoal(lh, la, t0, score, reds, target) {
    const d = diffIdx(score[0] - score[1]);
    const rd = (reds[0] || 0) - (reds[1] || 0);
    const run = (c) => {
      const S = new Array(STEPS + 1).fill(1);
      let left = 1;
      let home = 0;
      let away = 0;
      for (let t = t0 + 1; t <= STEPS; t++) {
        const ph = PHASE[t];
        const eh = (c * lh * GOALS[t] * STATE_HOME[d][ph] * RED[diffIdx(rd)]) / SUB;
        const ea = (c * la * GOALS[t] * STATE_AWAY[4 - d][ph] * RED[diffIdx(-rd)]) / SUB;
        for (let s = 0; s < SUB; s++) {
          home += left * eh;
          away += left * ea;
          left *= 1 - eh - ea;
        }
        S[t] = left;
      }
      return { S, home, away, none: left };
    };
    const r = run(1);
    return target > 0 && target < 1 && r.none > 0 && r.none < 1 ? run(Math.log(target) / Math.log(r.none)) : r;
  }
  const minuteOf = (t) => (t <= 45 ? t : t === 46 ? 45 : t <= 91 ? t - 1 : 90); // Schritt -> Spielminute

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
    const t = input.finished ? STEPS : clock(input.minute, input.half);
    const live = t > 0;
    const sc = [score[0] || 0, score[1] || 0];
    // Vor dem Spiel: Ergebnis-Tabelle aus den Marktpreisen (trifft die Quoten genau). Im Spiel: der Rest wird Minute für Minute durchgerechnet.
    const add = live ? playOut(lh, la, t, STEPS, sc, reds) : scoreMatrix(lh, la, true);
    let rh = lh;
    let ra = la;
    if (live) {
      rh = 0;
      ra = 0;
      add.forEach((row, x) => row.forEach((v, y) => { rh += x * v; ra += y * v; }));
    }
    const fin = shift(add, sc[0], sc[1]);
    const res = outcome(fin);
    const total = sc[0] + sc[1];
    const lines = [0.5, 1.5, 2.5, 3.5, 4.5].filter((l) => l > total - 0.5 || !live);
    // Nächstes Tor (Restzeit): wer trifft zuerst, und wann
    const nx = nextGoal(lh, la, t, sc, reds, live ? null : add[0][0]);
    const within = (k) => 1 - nx.S[Math.min(STEPS, t + k)];
    let median = null;
    for (let i = t + 1; i <= STEPS && median == null; i++) if (nx.S[i] <= 0.5) median = minuteOf(i);
    // Halbzeit (nur wenn sie noch nicht vorbei ist)
    let ht = null;
    if (t < H1_LEN) {
      const m1 = shift(playOut(lh, la, t, H1_LEN, sc, reds), sc[0], sc[1]);
      ht = Object.assign(outcome(m1), { top: topScores(m1, 3) });
    }
    // Gesamttore am Ende: 0, 1, …, 5 und „6 oder mehr“
    const totals = new Array(7).fill(0);
    fin.forEach((row, x) => row.forEach((v, y) => { totals[Math.min(6, x + y)] += v; }));
    // Tor-Kurve: Wahrscheinlichkeit, dass bis zur Minute m (noch) ein Tor fällt – in 5-Minuten-Schritten bis Abpfiff
    const curve = [];
    for (let m = live ? Math.ceil(((input.minute || 0) + 0.5) / 5) * 5 : 0; m <= 90; m += 5) {
      curve.push({ m, p: 1 - nx.S[Math.max(t, clock(m, m > 45 ? 2 : 1))] });
    }
    curve.push({ m: 95, p: 1 - nx.none }); // inkl. Nachspielzeit
    return {
      live,
      minute: input.minute || 0,
      score: sc,
      xg: { home: sc[0] + rh, away: sc[1] + ra },
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
        home: nx.home,
        away: nx.away,
        none: nx.none,
        in10: within(10),
        in20: within(20),
        in30: within(30),
        // Minute, bis zu der das nächste Tor mit 50 % gefallen ist (null = eher kein Tor mehr)
        median,
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
  /* Feinabgleich der Tor-Wetten: aus Quoten gerechnete Chancen für „beide treffen“, „Heim trifft“ und „Gast trifft“ leicht nachjustieren.
     a/b an allen Jahren gelernt (09.11.2026, 110.165 Spiele), passend zur Ergebnis-Tabelle. */
  const CAL = { BY: [0.0299, 0.8561], HS: [-0.0164, 1.0292], AS: [0.0459, 0.9617] };
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

  // Geht die Wette (Wett-Code wie in tips.py) bei diesem Endstand auf?
  function codeWins(code, x, y) {
    const m = /^([OU])(\d)(\d)$/.exec(code);
    if (m) { const l = +m[2] + +m[3] / 10; return m[1] === 'O' ? x + y > l : x + y < l; }
    if (code === 'BY') return x > 0 && y > 0;
    if (code === 'BN') return !(x > 0 && y > 0);
    if (code === 'HS') return x > 0;
    if (code === 'AS') return y > 0;
    return code.includes(x > y ? 'H' : x === y ? 'D' : 'A');
  }
  // Mehrere Wetten aufs selbe Spiel zusammen: alle Endstände aufsummieren, bei denen jede davon aufgeht (sie hängen ja zusammen)
  function jointProb(lh, la, codes) {
    if (!codes.length || codes.some((c) => !c)) return null;
    let p = 0;
    scoreMatrix(lh, la).forEach((row, x) => row.forEach((v, y) => { if (codes.every((c) => codeWins(c, x, y))) p += v; }));
    return p;
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

  const api = { MAXG, STEPS, analyze, playOut, fromOdds, scoreMatrix, outcome, poisVec, goalShareUntil, devig, calibrate, codeProb, codeWins, jointProb };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.RE = api;
})(typeof self !== 'undefined' ? self : this);
