// Prüft die Tipp-Datei (scripts/tips.py → web/data/tips.json), bevor sie veröffentlicht wird:
// node tests/tips.test.js – schlägt etwas fehl, bleibt die alte Version online.
const fs = require('fs');
const path = require('path');

const d = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'web', 'data', 'tips.json'), 'utf8'));
let fails = 0;
const ok = (cond, msg) => { if (!cond) { fails++; console.log('FEHLER:', msg); } else console.log('ok  ', msg); };
const prob = (x) => typeof x === 'number' && x > 0 && x < 1;
const CODES = ['H', 'D', 'A', 'HD', 'DA', 'HA', 'O15', 'U15', 'O25', 'U25', 'O35', 'U35', 'BY', 'BN', 'HS', 'AS'];

ok(!isNaN(new Date(d.updatedAt)), `Datum lesbar (${d.updatedAt})`);
ok(d.games && typeof d.games === 'object', `Spiele vorhanden (${Object.keys(d.games || {}).length})`);
ok(Array.isArray(d.top) && Array.isArray(d.safe) && Array.isArray(d.kombis), 'Listen Top, Sicher, Kombis vorhanden');

const all = (d.top || []).concat(d.safe || [], d.rec || []);
// Quote = nur Tipico: null = „k. A.“ (noch kein Schlüssel oder Tipico bietet diese Wette nicht über die Schnittstelle an)
const bad = all.filter((t) => !d.games[t.g] || !CODES.includes(t.m) || !prob(t.p) || !(t.q == null || (t.q >= 1.01 && t.q < 50)) || (t.q != null) !== !!t.real || (t.pm != null && !prob(t.pm)));
ok(bad.length === 0, `jeder Tipp hat Spiel, Wett-Art, Chance und Quote${bad.length ? ' (' + bad.length + ' kaputt)' : ''}`);
ok((d.safe || []).every((t) => t.p >= 0.7 && (t.q == null || t.q >= 1.2)), 'Sicher: Chance ab 70 %, Quote ab 1,20');
ok((d.top || []).every((t) => t.p >= 0.5 && (t.q == null || t.q >= 1.6)), 'Top-Quote: Chance ab 50 %, Quote ab 1,60');
// Empfohlen (seit 06.11.2026): Quote ab 1,50, Chance ab 55 %, Result AI höchstens 2 Punkte unter dem Markt
if (d.rec) ok(d.rec.every((t) => t.p >= 0.55 && (t.q == null || t.q >= 1.5) && t.pm != null && t.pm >= t.p - 0.02 - 1e-9), `Empfohlen: ${d.rec.length} Tipps nach den Regeln`);
// Tipico: ohne Schlüssel keine einzige Quote; nirgends darf eine andere Quote als Tipico stehen
ok(d.tipico && typeof d.tipico.connected === 'boolean', `Tipico-Status vorhanden (${d.tipico && d.tipico.connected ? 'verbunden' : 'nicht verbunden'})`);
if (d.tipico && !d.tipico.connected) ok(all.every((t) => t.q == null) && Object.values(d.games || {}).every((g) => !Object.keys(g.odds || {}).length), 'ohne Tipico nirgends eine Quote');
ok(Array.isArray(d.all) && d.all.every((x) => x.length === 11 && x[8] > 0 && x[9] > 0), `Liste aller Spiele für den Scan (${(d.all || []).length})`);
const dupe = ['top', 'safe', 'rec'].filter((k) => new Set((d[k] || []).map((t) => t.g)).size !== (d[k] || []).length);
ok(dupe.length === 0, 'je Liste höchstens ein Tipp pro Spiel');

const games = Object.values(d.games || {});
const badG = games.filter((g) => !g.home || !g.away || !g.home.id || !g.away.id || isNaN(new Date(g.t)) || !(g.lh > 0 && g.la > 0 && g.lh < 8 && g.la < 8));
ok(badG.length === 0, `Spiele vollständig (Teams, Anpfiff, Tor-Erwartung)${badG.length ? ': ' + badG.slice(0, 3).map((g) => g.id).join(', ') : ''}`);

for (const k of d.kombis || []) {
  const legs = (k.legs || []).map((l) => all.find((t) => t.g === l.g && t.m === l.m));
  const p = legs.reduce((x, t) => x * (t ? t.p : NaN), 1);
  const q = legs.every((t) => t && t.q) ? legs.reduce((x, t) => x * t.q, 1) : null;
  ok(legs.length >= 2 && legs.every(Boolean) && new Set(legs.map((t) => t.g)).size === legs.length, `${k.name}: ${legs.length} Tipps aus verschiedenen Spielen`);
  ok(Math.abs(p - k.p) < 0.002 && (q == null ? k.q == null : Math.abs(q - k.q) < 0.05), `${k.name}: Gesamtchance ${(100 * k.p).toFixed(1)} % und Quote ${k.q == null ? 'k. A.' : k.q} stimmen`);
}

const rec = d.record || {};
ok(['top', 'safe'].concat(d.rec ? ['rec'] : []).every((l) => rec[l] && ['7', '30'].every((w) => rec[l][w] && rec[l][w].won <= rec[l][w].n)), 'Bilanz vollständig');

// KI-Zentrale: Protokoll der Rechner (web/data/activity.json)
const actPath = path.join(__dirname, '..', 'web', 'data', 'activity.json');
if (fs.existsSync(actPath)) {
  const act = JSON.parse(fs.readFileSync(actPath, 'utf8'));
  const badRun = (act.runs || []).filter((r) => isNaN(new Date(r.t)) || !['tips', 'ratings'].includes(r.job) || typeof r.sum !== 'object');
  ok(Array.isArray(act.runs) && badRun.length === 0, `Protokoll der KI-Zentrale lesbar (${(act.runs || []).length} Läufe)`);
}
ok(!d.ki || (typeof d.ki.runs === 'number' && typeof d.ki.newTips === 'number'), 'Zahlen für den KI-Knopf auf der Startseite');

console.log(fails ? `\n${fails} FEHLER` : '\nALLE TESTS OK');
process.exit(fails ? 1 : 0);
