// Prüft den Server (worker/worker.js) auf dem PC: Konten, Daten-Abgleich, Spiel-Scan, Wettschein, Status.
// Aufruf: node tests/worker.test.mjs – braucht Node 22.13 oder neuer (eingebaute SQLite als Ersatz für die Cloudflare-Datenbank D1).
// Gemini wird nicht gefragt: eine Attrappe antwortet mit festem JSON.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

let sqlite = null;
try { sqlite = await import('node:sqlite'); } catch (e) { /* zu altes Node */ }
if (!sqlite) {
  console.log('übersprungen: dieses Node hat keine eingebaute SQLite (ab Node 22.13).');
  process.exit(0);
}

// feste Uhr: der ganze Test läuft in „einer Minute“ – die Minuten-Bremsen des Servers zählen so immer gleich, egal wann er startet
let clock = Math.floor(Date.now() / 60e3) * 60e3 + 1000;
Date.now = () => (clock += 1);

const here = path.dirname(fileURLToPath(import.meta.url));
const src = fs.readFileSync(path.join(here, '..', 'worker', 'worker.js'), 'utf8');
const W = (await import('data:text/javascript,' + encodeURIComponent(src))).default;

let fails = 0;
const ok = (cond, msg) => { if (!cond) { fails++; console.log('FEHLER:', msg); } else console.log('ok  ', msg); };

// ---- D1 nachgebaut: prepare/bind/first/run/all/batch wie bei Cloudflare
function d1(db) {
  const stmt = (sql, args = []) => ({
    bind: (...a) => stmt(sql, a),
    async first(col) {
      const row = db.prepare(sql).get(...args);
      if (!row) return null;
      return col ? row[col] : Object.assign({}, row);
    },
    async run() {
      const r = db.prepare(sql).run(...args);
      return { success: true, meta: { changes: Number(r.changes) } };
    },
    async all() { return { success: true, results: db.prepare(sql).all(...args).map((r) => Object.assign({}, r)) }; },
    _sql: sql,
    _args: args,
  });
  return {
    prepare: (sql) => stmt(sql),
    async batch(list) {
      db.exec('BEGIN');
      try {
        const out = [];
        for (const s of list) out.push(await s.run());
        db.exec('COMMIT');
        return out;
      } catch (e) {
        db.exec('ROLLBACK');
        throw e;
      }
    },
  };
}
const raw = new sqlite.DatabaseSync(':memory:');
const env = { DB: d1(raw), GEMINI_API_KEY: 'attrappe', INVITE_CODES: 'probe, zweiter' };

// ---- Gemini-Attrappe
let geminiAnswer = null;
let geminiCalls = 0;
globalThis.fetch = async (url, opt) => {
  const u = String(url);
  if (u.includes('/models?')) return new Response(JSON.stringify({ models: [{ name: 'models/gemini-9.9-flash', supportedGenerationMethods: ['generateContent'] }] }), { status: 200 });
  if (u.includes(':generateContent')) {
    geminiCalls++;
    const body = JSON.parse(opt.body);
    const prompt = body.contents[0].parts[0].text;
    const text = typeof geminiAnswer === 'function' ? geminiAnswer(prompt) : JSON.stringify(geminiAnswer);
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] }), { status: 200 });
  }
  return new Response('nicht erreichbar', { status: 599 });
};

const ORIGIN = 'https://sneaxx141108-gif.github.io';
let ipNo = 0;
async function call(method, p, { body, token, invite, ip, e = env, origin = ORIGIN, rawBody } = {}) {
  const headers = { Origin: origin, 'CF-Connecting-IP': ip || '10.0.0.' + (++ipNo % 250) };
  if (body !== undefined || rawBody !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = 'Bearer ' + token;
  if (invite) headers['X-Invite'] = invite;
  const req = new Request('https://result-ai.example.workers.dev' + p, { method, headers, body: rawBody !== undefined ? rawBody : body !== undefined ? JSON.stringify(body) : undefined });
  const res = await W.fetch(req, e);
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch (er) { /* bleibt null */ }
  return { status: res.status, json, text, headers: res.headers };
}
// so streckt die App das Passwort (PBKDF2) – hier nur als feste 64 Hex-Zeichen nachgebildet
const pw = (s) => Array.from({ length: 64 }, (_, i) => '0123456789abcdef'[(s.charCodeAt(i % s.length) + i) % 16]).join('');

// ---- Status, CORS
let r = await call('GET', '/', { e: { INVITE_CODES: 'x' } });
ok(r.status === 200 && r.json.konten === false && r.json.version >= '2026-11-10', 'Status ohne Datenbank: konten = false');
r = await call('GET', '/');
ok(r.status === 200 && r.json.konten === true && r.json.ki === true && r.json.einladung === true, 'Status mit Datenbank: konten = true');
ok(!JSON.stringify(r.json).includes('attrappe'), 'Status verrät keine Schlüssel');
r = await call('OPTIONS', '/sync');
ok(r.status === 204 && /PUT/.test(r.headers.get('Access-Control-Allow-Methods')) && /Authorization/.test(r.headers.get('Access-Control-Allow-Headers')), 'Vorab-Anfrage des Browsers: PUT und Authorization erlaubt');
r = await call('GET', '/', { origin: 'https://boese.example' });
ok(!r.headers.get('Access-Control-Allow-Origin'), 'fremde Webseiten bekommen keine Freigabe');
r = await call('POST', '/auth/signup', { e: { INVITE_CODES: 'x' }, body: { user: 'niklas', pass: pw('a') } });
ok(r.status === 503 && /noch nicht eingerichtet/.test(r.json.error), 'ohne Datenbank: verständliche Meldung statt Absturz');

// ---- Konto erstellen
r = await call('POST', '/auth/signup', { body: { user: 'ni', pass: pw('a') } });
ok(r.status === 400 && /3 bis 20/.test(r.json.error), 'zu kurzer Benutzername abgelehnt');
r = await call('POST', '/auth/signup', { body: { user: 'nik las', pass: pw('a') } });
ok(r.status === 400, 'Leerzeichen im Benutzernamen abgelehnt');
r = await call('POST', '/auth/signup', { body: { user: 'niklas', pass: 'geheim123' } });
ok(r.status === 400, 'ungestrecktes Passwort wird nicht angenommen');
r = await call('POST', '/auth/signup', { body: { user: 'Niklas', pass: pw('richtig') } });
ok(r.status === 200 && r.json.ok && r.json.user === 'niklas' && /^[A-Za-z0-9_-]{40,}$/.test(r.json.token), 'Konto erstellt (Groß-/Kleinschreibung egal), Sitzung da');
const tokPhone = r.json.token;
r = await call('POST', '/auth/signup', { body: { user: 'NIKLAS', pass: pw('anders') } });
ok(r.status === 409 && /gibt es schon/.test(r.json.error), 'gleicher Name ein zweites Mal: abgelehnt');
r = await call('POST', '/auth/signup', { rawBody: '{kaputt' });
ok(r.status === 400, 'kaputte Anfrage: 400');
const urow = raw.prepare('SELECT * FROM users WHERE name = ?').get('niklas');
ok(urow && urow.hash !== pw('richtig') && !String(urow.hash).includes(pw('richtig')) && urow.salt.length >= 20, 'gespeichert wird nur ein Hash mit eigenem Salz');
const srow = raw.prepare('SELECT token FROM sessions').all();
ok(srow.length === 1 && srow[0].token !== tokPhone && /^[0-9a-f]{64}$/.test(srow[0].token), 'Sitzungs-Schlüssel nur als Hash gespeichert');
r = await call('POST', '/auth/signup', { body: { user: 'zweiter', pass: pw('z') } });
const tokOther = r.json.token;

// ---- Anmelden (zweites Gerät)
r = await call('POST', '/auth/login', { body: { user: 'niklas', pass: pw('falsch') } });
ok(r.status === 401 && /stimmt nicht/.test(r.json.error), 'falsches Passwort: 401');
r = await call('POST', '/auth/login', { body: { user: 'gibtsnicht', pass: pw('a') } });
ok(r.status === 401 && /stimmt nicht/.test(r.json.error), 'unbekannter Name: gleiche Meldung (verrät nicht, welche Namen es gibt)');
r = await call('POST', '/auth/login', { body: { user: 'niklas', pass: pw('richtig') } });
ok(r.status === 200 && r.json.token && r.json.token !== tokPhone, 'Anmeldung am iPad: eigene Sitzung');
const tokPad = r.json.token;
ok(raw.prepare('SELECT fails FROM users WHERE name = ?').get('niklas').fails === 0, 'richtige Anmeldung setzt Fehlversuche zurück');

// ---- Sperre nach 8 falschen Passwörtern
await call('POST', '/auth/signup', { body: { user: 'sperre', pass: pw('s') } });
for (let i = 0; i < 7; i++) await call('POST', '/auth/login', { body: { user: 'sperre', pass: pw('x' + i) } });
r = await call('POST', '/auth/login', { body: { user: 'sperre', pass: pw('s') } });
ok(r.status === 200, '7 Fehlversuche: richtiges Passwort geht noch');
for (let i = 0; i < 8; i++) r = await call('POST', '/auth/login', { body: { user: 'sperre', pass: pw('y' + i) } });
ok(r.status === 401, '8. Fehlversuch: noch normale Meldung');
r = await call('POST', '/auth/login', { body: { user: 'sperre', pass: pw('s') } });
ok(r.status === 429 && /15 Minuten/.test(r.json.error), 'danach gesperrt – auch mit richtigem Passwort');
raw.prepare('UPDATE users SET lock_until = ? WHERE name = ?').run(Date.now() - 1000, 'sperre');
r = await call('POST', '/auth/login', { body: { user: 'sperre', pass: pw('s') } });
ok(r.status === 200, 'nach Ablauf der Sperre geht es wieder');
let blocked = 0;
for (let i = 0; i < 12; i++) if ((await call('POST', '/auth/login', { ip: '9.9.9.9', body: { user: 'sperre', pass: pw('s') } })).status === 429) blocked++;
ok(blocked === 2, `Dauerfeuer von einer Adresse wird gebremst (${blocked} von 12 abgewiesen)`);

// ---- Daten-Abgleich
r = await call('GET', '/sync');
ok(r.status === 401, 'ohne Sitzung keine Daten');
r = await call('GET', '/sync', { token: 'A'.repeat(43) });
ok(r.status === 401 && /neu anmelden/.test(r.json.error), 'erfundene Sitzung: 401');
r = await call('GET', '/sync', { token: tokPhone });
ok(r.status === 200 && r.json.v === 0 && r.json.data === null && r.json.user === 'niklas', 'neues Konto: noch keine Daten');
const doc1 = { bets: [{ id: 'b1', u: 1, title: 'BVB – S04' }], wallet: { u: 1, v: { base: 100 } }, name: { u: 1, v: 'Niklas' } };
r = await call('PUT', '/sync', { token: tokPhone, body: { base: 0, data: doc1 } });
ok(r.status === 200 && r.json.v === 1, 'Handy speichert: Version 1');
r = await call('PUT', '/sync', { token: tokPad, body: { base: 0, data: { bets: [] } } });
ok(r.status === 409 && r.json.conflict && r.json.v === 1 && r.json.data.bets[0].id === 'b1', 'iPad auf altem Stand: 409 mit dem neuen Stand zum Zusammenführen');
r = await call('GET', '/sync', { token: tokPad });
ok(r.status === 200 && r.json.v === 1 && JSON.stringify(r.json.data) === JSON.stringify(doc1), 'iPad holt genau die Daten vom Handy');
r = await call('GET', '/sync?v=1', { token: tokPad });
ok(r.status === 200 && r.json.same === true && r.json.data === undefined, 'nichts geändert: nur „same“, keine Daten');
const doc2 = Object.assign({}, doc1, { bets: doc1.bets.concat([{ id: 'b2', u: 2, title: 'Bayern – Leipzig' }]) });
r = await call('PUT', '/sync', { token: tokPad, body: { base: 1, data: doc2 } });
ok(r.status === 200 && r.json.v === 2, 'iPad speichert darauf aufbauend: Version 2');
r = await call('PUT', '/sync', { token: tokPhone, body: { base: 1, data: doc1 } });
ok(r.status === 409 && r.json.v === 2 && r.json.data.bets.length === 2, 'Handy mit alter Version: 409, nichts überschrieben');
r = await call('GET', '/sync?v=1', { token: tokPhone });
ok(r.json.v === 2 && r.json.data.bets.length === 2, 'Handy holt Version 2');
r = await call('GET', '/sync', { token: tokOther });
ok(r.json.v === 0 && r.json.data === null, 'anderes Konto sieht diese Daten nicht');
r = await call('PUT', '/sync', { token: tokPhone, body: { base: 2, data: [1, 2] } });
ok(r.status === 400, 'Daten müssen ein Objekt sein');
r = await call('PUT', '/sync', { token: tokPhone, body: { base: -1, data: {} } });
ok(r.status === 400, 'Version muss stimmen');
r = await call('PUT', '/sync', { token: tokPhone, body: { base: 2, data: { x: 'a'.repeat(950000) } } });
ok(r.status === 413, 'zu viele Daten: 413');
r = await call('PUT', '/sync', { token: tokPhone, rawBody: '{"base":2,"data":' });
ok(r.status === 400, 'abgeschnittene Daten: 400');
ok(raw.prepare('SELECT v FROM docs WHERE name = ?').get('niklas').v === 2, 'nach allen Fehlern noch Version 2');
r = await call('PUT', '/sync', { token: tokOther, body: { base: 3, data: {} } });
ok(r.status === 409 && r.json.v === 0 && r.json.data === null, 'Version passt nicht und noch nichts gespeichert: 409 mit Version 0');

// ---- Sitzung abgelaufen, Abmelden
raw.prepare('UPDATE sessions SET seen = ? WHERE name = ?').run(Date.now() - 401 * 864e5, 'zweiter');
r = await call('GET', '/sync', { token: tokOther });
ok(r.status === 401, 'nach 400 Tagen ohne Öffnen abgemeldet');
r = await call('POST', '/auth/logout', { token: tokPhone });
ok(r.status === 200 && r.json.ok, 'Abmelden am Handy');
r = await call('GET', '/sync', { token: tokPhone });
ok(r.status === 401, 'Handy-Sitzung danach ungültig');
r = await call('GET', '/sync', { token: tokPad });
ok(r.status === 200 && r.json.v === 2, 'iPad bleibt angemeldet');

// ---- Konto löschen
r = await call('POST', '/auth/delete', { token: tokPad, body: { user: 'niklas', pass: pw('falsch') } });
ok(r.status === 401, 'Löschen mit falschem Passwort: abgelehnt');
r = await call('POST', '/auth/delete', { token: tokPad, body: { user: 'zweiter', pass: pw('z') } });
ok(r.status === 403, 'fremdes Konto löschen: abgelehnt');
r = await call('POST', '/auth/delete', { token: tokPad, body: { user: 'niklas', pass: pw('richtig') } });
ok(r.status === 200 && r.json.ok, 'Konto gelöscht');
ok(!raw.prepare('SELECT 1 FROM users WHERE name = ?').get('niklas') && !raw.prepare('SELECT 1 FROM docs WHERE name = ?').get('niklas') && !raw.prepare('SELECT 1 FROM sessions WHERE name = ?').get('niklas'), 'Name, Daten und Sitzungen sind weg');
r = await call('POST', '/auth/login', { body: { user: 'niklas', pass: pw('richtig') } });
ok(r.status === 401, 'Anmelden geht danach nicht mehr');
r = await call('POST', '/auth/signup', { body: { user: 'niklas', pass: pw('neu') } });
ok(r.status === 200, 'Name ist wieder frei');

// ---- Spiel-Scan
const img = 'data:image/png;base64,' + Buffer.from('bild').toString('base64');
r = await call('POST', '/match', { body: { image: img } });
ok(r.status === 401, 'Scan ohne Einladungscode: 401');
r = await call('POST', '/match', { invite: 'probe', body: { image: '' } });
ok(r.status === 400 && /Kein gültiges Bild/.test(r.json.error), 'Scan ohne Bild: verständliche Meldung');
r = await call('POST', '/match', { invite: 'probe', body: { image: 'data:application/pdf;base64,QUJD' } });
ok(r.status === 400, 'nur Bilder');
geminiAnswer = (prompt) => {
  ok(/Heute ist/.test(prompt) && /Spiel-Leser/.test(prompt), 'Gemini bekommt Datum und Spiel-Anleitung');
  return JSON.stringify({
    isFootball: true, bookmaker: 'Tipico', note: null,
    games: [
      { home: 'Borussia Dortmund', away: 'FC Bayern', competition: 'Bundesliga', kickoff: '2026-11-14 18:30', status: 'upcoming', oddsHome: '2,90', oddsDraw: 3.8, oddsAway: 2.25, line: 2.5, oddsOver: 1.6, oddsUnder: 0.5 },
      { home: 'Real Madrid', away: 'Liverpool', status: 'live', minute: '67', half: 2, scoreHome: 1, scoreAway: 1, redHome: 0, redAway: 1 },
      { home: '', away: 'Niemand', status: 'upcoming' },
      { home: 'Inter', away: 'Milan', status: 'abgesagt', minute: 999, half: 3, oddsHome: 1 },
    ],
  });
};
r = await call('POST', '/match', { invite: ' PROBE ', body: { image: img } });
const sc = r.json && r.json.scan;
ok(r.status === 200 && r.json.model === 'gemini-9.9-flash' && sc && sc.isFootball, 'Scan liest den Screenshot (Code ohne Groß-/Kleinschreibung)');
ok(sc && sc.games.length === 3, 'Spiel ohne Heim-Mannschaft fällt weg');
const g0 = sc && sc.games[0];
ok(g0 && g0.oddsHome === 2.9 && g0.oddsDraw === 3.8 && g0.oddsAway === 2.25 && g0.line === 2.5 && g0.oddsOver === 1.6 && g0.oddsUnder === null && g0.kickoff === '2026-11-14 18:30', 'Quoten mit Komma gelesen, unmögliche Quote → null');
const g1 = sc && sc.games[1];
ok(g1 && g1.status === 'live' && g1.minute === 67 && g1.half === 2 && g1.scoreHome === 1 && g1.redAway === 1, 'Live-Spiel: Minute, Halbzeit, Stand, Rote Karten');
const g2 = sc && sc.games[2];
ok(g2 && g2.status === 'unknown' && g2.minute === null && g2.half === null && g2.oddsHome === null, 'Unsinn wird zu „unbekannt“ bzw. null');
geminiAnswer = { isFootball: false, games: [] };
r = await call('POST', '/match', { invite: 'zweiter', body: { image: img } });
ok(r.status === 200 && r.json.scan.isFootball === false && r.json.scan.games.length === 0, 'Bild ohne Fußballspiel: isFootball = false');
geminiAnswer = () => 'Hier ist das Ergebnis: ' + JSON.stringify({ isFootball: true, games: [{ home: 'A', away: 'B', status: 'upcoming' }] }) + ' Viel Erfolg!';
r = await call('POST', '/match', { invite: 'probe', body: { image: img } });
ok(r.status === 200 && r.json.scan.games.length === 1, 'Antwort mit Text drumherum wird trotzdem gelesen');
const before = geminiCalls;
let scanBlocked = 0;
for (let i = 0; i < 12; i++) if ((await call('POST', '/match', { invite: 'zweiter', body: { image: img } })).status === 429) scanBlocked++;
ok(scanBlocked >= 1 && geminiCalls - before <= 11, `Scan-Bremse je Einladungscode (${scanBlocked} abgewiesen)`);

// ---- Wettschein (ältere App) und Unbekanntes
geminiAnswer = { isBetSlip: true, status: 'open', stake: 10, legs: [{ home: 'BVB', away: 'S04', pick: 'BVB', odds: 1.5, result: 'open' }, { home: 'A', away: 'B', pick: 'Über 2,5', odds: 2, result: 'open' }] };
r = await call('POST', '/bet', { invite: 'probe', body: { image: img } });
ok(r.status === 200 && r.json.bet.isBetSlip && r.json.bet.totalOdds === 3, 'Wettschein-Lesen für ältere App-Stände geht weiter');
r = await call('GET', '/check', { invite: 'probe' });
ok(r.status === 200 && r.json.ok, 'Einladungscode prüfen');
r = await call('GET', '/gibtsnicht', { invite: 'probe' });
ok(r.status === 404, 'unbekannte Adresse: 404');
r = await call('GET', '/auth/irgendwas');
ok(r.status === 404, 'unbekannte Konto-Adresse: 404');

console.log(fails ? `\n${fails} FEHLER` : '\nALLE TESTS OK');
process.exit(fails ? 1 : 0);
