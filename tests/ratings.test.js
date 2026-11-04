// Prüft die Stärken-Datei (scripts/ratings.py → web/data/ratings.json), bevor die App veröffentlicht wird:
// node tests/ratings.test.js – schlägt etwas fehl, bleibt die alte Version online.
const fs = require('fs');
const path = require('path');

const d = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'web', 'data', 'ratings.json'), 'utf8'));
let fails = 0;
const ok = (cond, msg) => { if (!cond) { fails++; console.log('FEHLER:', msg); } else console.log('ok  ', msg); };
const fin = (x) => typeof x === 'number' && Number.isFinite(x);

// 1) Grundgerüst
ok(Array.isArray(d.teams) && d.teams.length >= 500, `genug Teams (${d.teams.length})`);
ok(Array.isArray(d.leagues) && d.leagues.length >= 30, `genug Ligen (${d.leagues.length})`);
ok(d.model && fin(d.model.mu) && d.model.mu > -0.5 && d.model.mu < 1, `Tor-Niveau mu plausibel (${d.model && d.model.mu})`);
ok(d.model && fin(d.model.h) && d.model.h >= 0 && d.model.h < 0.6, `Heimvorteil plausibel (${d.model && d.model.h})`);
ok(!isNaN(new Date(d.updatedAt)), `Datum lesbar (${d.updatedAt})`);

// 2) jedes Team sauber
const badNum = d.teams.filter((t) => !fin(t.att) || !fin(t.def) || Math.abs(t.att) > 3 || Math.abs(t.def) > 3);
ok(badNum.length === 0, `Angriff/Abwehr aller Teams endlich und im Rahmen${badNum.length ? ': ' + badNum.slice(0, 5).map((t) => t.name).join(', ') : ''}`);
const ids = new Set();
const dup = d.teams.filter((t) => ids.has(t.id) || !ids.add(t.id));
ok(dup.length === 0, `jede Team-ID nur einmal${dup.length ? ': ' + dup.slice(0, 5).map((t) => t.id).join(', ') : ''}`);
const badCol = d.teams.filter((t) => t.color != null && !/^#[0-9A-F]{6}$/i.test(t.color));
ok(badCol.length === 0, 'Vereinsfarben im Format #RRGGBB');

// 3) Stichproben: bekannte Teams mit der richtigen ESPN-ID
const byId = Object.fromEntries(d.teams.map((t) => [t.id, t]));
for (const [id, name] of [['124', 'Dortmund'], ['132', 'Bayern'], ['359', 'Arsenal'], ['86', 'Real Madrid'], ['83', 'Barcelona'], ['371', 'West Ham']]) {
  const t = byId[id];
  ok(t && (t.name + ' ' + (t.short || '')).includes(name) && t.grp === 0, `${name} vorhanden (ID ${id}, ${t ? t.lg : '–'})`);
}

// 4) keine vertauschten Vereine: ein football-data-Name darf nicht an einem fremden Verein hängen
//    (04.11.2026: „West Ham“ landete über das Kürzel „HAM“ bei Hamrun Spartans aus Malta)
const wrong = d.teams.filter((t) => (t.alias || []).includes('West Ham') && !/West Ham/.test(t.name));
ok(wrong.length === 0, `„West Ham“ gehört zu West Ham${wrong.length ? ' (steht bei ' + wrong.map((t) => t.name).join(', ') + ')' : ''}`);

// 5) plausibel, unabhängig vom sportlichen Abschneiden: große Ligen haben eine normale Teamzahl (Liga = Liga des letzten
//    Spiels; im Sommer zählen Absteiger kurz doppelt), Bayern ist stärker als jeder Zweitligist
const s = (t) => t.att + t.def;
for (const lg of ['ger.1', 'eng.1', 'esp.1', 'ita.1', 'fra.1']) {
  const n = d.teams.filter((t) => t.lg === lg).length;
  ok(n >= 16 && n <= 24, `${lg}: ${n} Teams`);
}
const l2 = d.teams.filter((t) => t.lg === 'ger.2');
ok(l2.length >= 16 && byId['132'] && l2.every((t) => s(t) < s(byId['132'])), 'Bayern stärker als jeder Zweitligist');

console.log(fails ? `\n${fails} FEHLER` : '\nALLE TESTS OK');
process.exit(fails ? 1 : 0);
