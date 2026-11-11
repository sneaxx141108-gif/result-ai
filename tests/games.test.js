// Prüft den Spielplan (scripts/games.py → web/data/games.json), bevor er veröffentlicht wird:
// node tests/games.test.js – schlägt etwas fehl, bleibt der alte Spielplan online.
const fs = require('fs');
const path = require('path');

const d = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'web', 'data', 'games.json'), 'utf8'));
let fails = 0;
const ok = (cond, msg) => { if (!cond) { fails++; console.log('FEHLER:', msg); } else console.log('ok  ', msg); };

const at = new Date(d.updatedAt).getTime();
ok(Number.isFinite(at), `Datum lesbar (${d.updatedAt})`);
ok(d.leagues && Object.keys(d.leagues).length >= 5, `genug Wettbewerbe (${Object.keys(d.leagues || {}).length})`);
ok(Object.values(d.leagues || {}).every((l) => Array.isArray(l) && l[0] && l[1]), 'jeder Wettbewerb hat Name und Land');
const games = d.games || [];
ok(games.length >= 30, `genug Spiele (${games.length})`);
ok(new Set(games.map((g) => g[0])).size === games.length, 'keine Spiel-ID doppelt');
ok(games.every((g) => Array.isArray(g) && g.length === 8 && /^\d+$/.test(g[0]) && d.leagues[g[1]]), 'jedes Spiel: ID und bekannter Wettbewerb');
ok(games.every((g) => Number.isFinite(new Date(g[2]).getTime())), 'jeder Anstoß lesbar');
ok(games.every((g) => d.teams[g[3]] && d.teams[g[4]] && g[3] !== g[4]), 'beide Teams jedes Spiels bekannt');
ok(games.every((g) => [0, 1, 2, 3].includes(g[5])), 'Status 0 bis 3');
ok(games.every((g) => (g[6] == null && g[7] == null) || (g[5] === 2 && Number.isInteger(g[6]) && Number.isInteger(g[7]) && g[6] >= 0 && g[7] >= 0 && g[6] < 20 && g[7] < 20)),
  'Endstand nur bei beendeten Spielen, ganze Tore');
const lo = new Date(d.from).getTime() - 864e5;
const hi = new Date(d.to).getTime() + 2 * 864e5;
ok(games.every((g) => { const t = new Date(g[2]).getTime(); return t >= lo && t <= hi; }), `alle Anstöße zwischen ${d.from} und ${d.to}`);
ok(Object.values(d.teams).every((t) => Array.isArray(t) && t.length >= 6 && t[0] && d.leagues[t[5]] !== undefined), 'jedes Team: Name und Wettbewerb');
ok(Object.values(d.teams).every((t) => t[4] == null || /^#[0-9A-F]{6}$/i.test(t[4])), 'Vereinsfarben gültig');
ok(Array.isArray(d.runs) && d.runs.length >= 1 && d.runs[d.runs.length - 1].t === d.updatedAt, 'letzter Lauf im Protokoll');
ok(!JSON.stringify(d).includes('%'), 'keine Prozente in der Datei');

console.log(fails ? `\n${fails} Fehler` : '\nalles ok');
process.exit(fails ? 1 : 0);
