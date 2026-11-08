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

// 2b) Nationalteams (seit 08.11.2026): eigene Gruppe, eigenes Tor-Niveau – fehlen sie (ESPN kurz weg), blockiert das nichts
const nats = d.teams.filter((t) => t.nat);
if (!nats.length) console.log('hinweis Nationalteams diesmal nicht geladen');
else {
  ok(nats.length >= 120 && d.natModel && fin(d.natModel.mu) && fin(d.natModel.h), `${nats.length} Länder mit eigenem Modell`);
  ok(nats.every((t) => t.grp === 1000 && t.lg === 'nat') && !d.teams.some((t) => !t.nat && t.grp === 1000), 'Länder bilden eine eigene Gruppe');
  for (const n of ['Deutschland', 'Spanien', 'Brasilien', 'Argentinien']) ok(nats.some((t) => t.name === n), `${n} vorhanden`);
}

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

// 6) 3. Ligen der Top-5-Länder (06.11.2026, von FotMob): falls diesmal geladen, über Auf-/Absteiger mit dem Rest verbunden
//    (keine Insel) und im Schnitt schwächer als Liga 2 – fehlt eine (FotMob kurz nicht erreichbar), blockiert das nichts
const avg = (lg) => { const ts = d.teams.filter((t) => t.lg === lg); return ts.length ? ts.reduce((a, t) => a + s(t), 0) / ts.length : NaN; };
for (const c of ['ger', 'esp', 'ita', 'fra']) {
  const L3 = d.leagues.find((l) => l.id === c + '.3');
  if (!L3) { console.log(`hinweis ${c}.3 diesmal nicht geladen`); continue; }
  ok(L3.grp === 0, `${c}.3 (${L3.name}) mit den anderen Ligen verbunden`);
  const a = [1, 2, 3].map((k) => avg(`${c}.${k}`));
  ok(a[0] > a[1] && a[1] > a[2], `${c}: Liga 1 > Liga 2 > Liga 3 im Schnitt (${a.map((x) => x.toFixed(2)).join(' / ')})`);
}
// zweite Mannschaften (BVB II, Castilla, Juventus Next Gen …) nie mit den Profis zusammengelegt
const RES = /\bII\b|\bB\b|U ?2[13]\b|U ?19\b|Castilla|Next Gen|Futuro|Atlètic/;
const juve = d.teams.find((t) => t.name === 'Juventus');
for (const t of [byId['124'], byId['132'], byId['86'], byId['83'], juve].filter(Boolean)) {
  const bad = (t.alias || []).filter((n) => RES.test(n));
  ok(bad.length === 0, `${t.name}: keine zweite Mannschaft untergemischt${bad.length ? ' (' + bad.join(', ') + ')' : ''}`);
}

console.log(fails ? `\n${fails} FEHLER` : '\nALLE TESTS OK');
process.exit(fails ? 1 : 0);
