// Tests für den Rechen-Kern: node tests/engine.test.js
const RE = require('../web/engine.js');
let fails = 0;
const ok = (cond, msg) => { if (!cond) { fails++; console.log('FEHLER:', msg); } else console.log('ok  ', msg); };
const near = (a, b, tol) => Math.abs(a - b) <= tol;
const pct = (x) => (100 * x).toFixed(1) + ' %';

// 1) Summen = 100 %
const a = RE.analyze({ lh: 1.6, la: 1.1 });
const sum = a.probs.home + a.probs.draw + a.probs.away;
ok(near(sum, 1, 1e-9), 'Sieg+Remis+Niederlage = 100 % (' + sum + ')');
ok(near(a.double['1X'] + a.probs.away, 1, 1e-9), 'Doppelchance 1X + Auswärtssieg = 100 %');
console.log('     vor dem Spiel 1,6 : 1,1 ->', pct(a.probs.home), pct(a.probs.draw), pct(a.probs.away), '| top', a.top.slice(0, 3).map((s) => s.h + ':' + s.a + ' ' + pct(s.p)).join(', '));

// 2) zweimal gleich (Pflicht!)
const b = RE.analyze({ lh: 1.6, la: 1.1 });
ok(JSON.stringify(a) === JSON.stringify(b), 'zweimal dieselbe Eingabe -> exakt dasselbe Ergebnis');

// 3) gleich starke Teams: Remis ~ 25-29 %, Heim = Gast
const e = RE.analyze({ lh: 1.35, la: 1.35 });
ok(near(e.probs.home, e.probs.away, 1e-9) && e.probs.draw > 0.24 && e.probs.draw < 0.30, 'gleich stark: Remis ' + pct(e.probs.draw));

// 4) Live: 2:0 in der 85. Minute -> Heimsieg sehr wahrscheinlich
const l = RE.analyze({ lh: 1.4, la: 1.4, minute: 85, score: [2, 0] });
ok(l.probs.home > 0.95, 'live 2:0 (85.) -> Heimsieg ' + pct(l.probs.home));
ok(l.top[0].h === 2 && l.top[0].a === 0, 'live 2:0 (85.) -> wahrscheinlichstes Ergebnis 2:0');

// 5) Live 0:0 zur Halbzeit: Remis wahrscheinlicher als vor dem Spiel
const h = RE.analyze({ lh: 1.4, la: 1.4, minute: 45, half: 'ht', score: [0, 0] });
ok(h.probs.draw > e.probs.draw, 'live 0:0 (HZ): Remis ' + pct(h.probs.draw) + ' > vorher ' + pct(e.probs.draw));
ok(h.ht === null, 'zur Halbzeit keine Halbzeit-Prognose mehr');

// 6) Rote Karte gegen Heim: Heimsieg-Chance sinkt
const r0 = RE.analyze({ lh: 1.5, la: 1.2, minute: 30, score: [0, 0] });
const r1 = RE.analyze({ lh: 1.5, la: 1.2, minute: 30, score: [0, 0], reds: [1, 0] });
ok(r1.probs.home < r0.probs.home, 'rote Karte Heim: ' + pct(r0.probs.home) + ' -> ' + pct(r1.probs.home));

// 7) Quoten -> Tor-Erwartung -> wieder dieselben Wahrscheinlichkeiten (ohne Buchmacher-Marge)
const q = RE.fromOdds({ home: 2.10, draw: 3.60, away: 3.30, line: 2.5, over: 1.85, under: 1.95 });
const qa = RE.analyze({ lh: q.lh, la: q.la });
ok(near(qa.probs.home - qa.probs.away, q.market.home - q.market.away, 0.002), 'Quoten zurückgerechnet: Heim ' + pct(qa.probs.home) + ' (Markt ' + pct(q.market.home) + ')');
const po = (1 / 1.85) / (1 / 1.85 + 1 / 1.95);
const o25 = qa.over.find((x) => x.line === 2.5).over;
ok(near(o25, po, 0.003), 'Über 2,5 passt zur Quote: ' + pct(o25) + ' (Markt ' + pct(po) + ')');
console.log('     Tor-Erwartung aus Quoten:', q.lh.toFixed(2), ':', q.la.toFixed(2), '| Marge', pct(q.market.margin));

// 8) Nächstes Tor + Summen
const n = RE.analyze({ lh: 1.6, la: 1.1, minute: 60, score: [1, 1] });
ok(near(n.next.home + n.next.away + n.next.none, 1, 1e-9), 'nächstes Tor: Heim+Gast+keins = 100 %');
ok(n.next.in10 < n.next.in20 && n.next.in20 < n.next.in30, 'Tor in 10 < 20 < 30 Min.');
console.log('     1:1 (60.): nächstes Tor Heim', pct(n.next.home), 'Gast', pct(n.next.away), 'keins', pct(n.next.none), '| in 10 Min.', pct(n.next.in10), '| Median-Minute', n.next.median);

// 8b) Live-Modell: Wer zurückliegt, trifft öfter, wer in Unterzahl ist, seltener; alles summiert sich zu 100 %
const lv = (o) => RE.analyze(Object.assign({ lh: 1.5, la: 1.2, minute: 60, half: 2, score: [0, 0] }, o));
ok(lv({ score: [0, 1] }).rest.home > lv({}).rest.home, 'Rückstand: Heim trifft öfter als bei 0:0');
ok(lv({ score: [0, 1] }).rest.away < lv({}).rest.away, 'Führung: Gast trifft seltener als bei 0:0');
ok(lv({ reds: [1, 0] }).rest.home < lv({}).rest.home && lv({ reds: [1, 0] }).rest.away > lv({}).rest.away, 'rote Karte: Unterzahl trifft seltener, Gegner öfter');
ok(lv({ minute: 75 }).rest.home < lv({}).rest.home, 'später im Spiel: weniger Tore übrig');
ok(near(lv({ score: [2, 1], reds: [0, 1] }).probs.home + lv({ score: [2, 1], reds: [0, 1] }).probs.draw + lv({ score: [2, 1], reds: [0, 1] }).probs.away, 1, 1e-9), 'live: Sieg + Remis + Niederlage = 100 %');
{
  let g = 0;
  RE.playOut(1.5, 1.2, 10, RE.STEPS, [1, 0], [0, 0]).forEach((row) => row.forEach((v) => { g += v; }));
  ok(near(g, 1, 1e-9), 'Durchrechnen: alle Ergebnisse zusammen = 100 %');
}
ok(near(RE.goalShareUntil(RE.STEPS), 1, 1e-9) && near(RE.goalShareUntil(46), 0.45, 0.02), 'Tor-Zeiten: bis zur Halbzeit fallen rund 45 % der Tore, ' + pct(RE.goalShareUntil(46)));
{
  const pre = RE.analyze({ lh: 1.5, la: 1.2 });
  ok(near(pre.next.none, pre.matrix[0][0], 1e-3), 'vor dem Spiel: „kein Tor“ = Chance auf 0:0');
  ok(pre.ht && near(pre.ht.home + pre.ht.draw + pre.ht.away, 1, 1e-9), 'vor dem Spiel: Halbzeit-Prognose summiert sich zu 100 %');
  ok(near(pre.xg.home, 1.5, 1e-9), 'vor dem Spiel: erwartete Tore = Eingabe');
}
{
  const a1 = RE.analyze({ lh: 1.5, la: 1.2, minute: 47, half: 1, score: [0, 0] });
  const a2 = RE.analyze({ lh: 1.5, la: 1.2, minute: 45, half: 'ht', score: [0, 0] });
  ok(near(a1.probs.home, a2.probs.home, 1e-12), 'Nachspielzeit Halbzeit 1 (45+2) zählt nicht als 2. Halbzeit');
}

// 9) Abgepfiffen: Endstand steht fest
const f = RE.analyze({ lh: 1.6, la: 1.1, finished: true, minute: 90, score: [3, 1] });
ok(near(f.probs.home, 1, 1e-9) && f.top[0].h === 3 && f.top[0].a === 1, 'abgepfiffen 3:1 -> 100 % Heimsieg');

// 10) Torverteilung und Tor-Kurve
const tv = RE.analyze({ lh: 2.35, la: 1.05 });
ok(near(tv.totals.reduce((x, y) => x + y, 0), 1, 1e-9), 'Torverteilung 0..6+ = 100 %');
ok(near(tv.totals.slice(3).reduce((x, y) => x + y, 0), tv.over.find((o) => o.line === 2.5).over, 1e-9), 'Torverteilung passt zu Über 2,5');
const cv = RE.analyze({ lh: 1.6, la: 1.1, minute: 63, half: 2, score: [1, 1] }).next;
ok(cv.curve.every((c, i) => i === 0 || c.p >= cv.curve[i - 1].p - 1e-12), 'Tor-Kurve steigt nur an');
ok(near(cv.curve[cv.curve.length - 1].p, 1 - cv.none, 1e-9) && cv.curve[0].m === 65, 'Tor-Kurve: Start 65. Min., Ende = 1 - kein Tor');
console.log('     Tore (Bayern–Dortmund):', tv.totals.map((x, i) => (i === 6 ? '6+' : i) + ': ' + pct(x)).join(' · '));

console.log(fails ? fails + ' Test(s) fehlgeschlagen' : 'ALLE TESTS OK');
process.exit(fails ? 1 : 0);
