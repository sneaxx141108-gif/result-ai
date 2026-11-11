// Prüft den Server (worker/worker.js) auf dem PC: Konten, Daten-Abgleich, Wettschein-Scan, Zeitgeber, Status.
// Aufruf: node tests/worker.test.mjs – braucht Node 22.13 oder neuer (eingebaute SQLite als Ersatz für die Cloudflare-Datenbank D1).
// Gemini, GitHub und der veröffentlichte Spielplan werden nicht gefragt: Attrappen antworten mit festen Daten.
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

// ---- Attrappen: Gemini, veröffentlichter Spielplan, GitHub
let geminiAnswer = null;
let geminiCalls = 0;
let gamesAt = null; // updatedAt des Spielplans; null = Seite nicht erreichbar
const dispatches = [];
const ghStatus = []; // vorgegebene Antworten von GitHub (sonst 204)
globalThis.fetch = async (url, opt) => {
  const u = String(url);
  if (u.includes('/data/games.json')) return gamesAt ? new Response(JSON.stringify({ updatedAt: gamesAt, games: [] }), { status: 200 }) : new Response('weg', { status: 404 });
  if (u.startsWith('https://api.github.com/')) {
    dispatches.push({ url: u, head: (opt && opt.headers) || {}, body: JSON.parse((opt && opt.body) || '{}') });
    const st = ghStatus.length ? ghStatus.shift() : 204;
    return new Response(st === 204 ? null : 'Unexpected inputs provided', { status: st });
  }
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
ok(r.status === 200 && r.json.konten === false && r.json.version >= '2026-11-11' && r.json.app === 'Wettbuch', 'Status ohne Datenbank: konten = false, App heißt Wettbuch');
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

// ---- Wettschein-Scan (/slip: ein Schein oder die ganze Liste „Meine Wetten“)
const img = 'data:image/png;base64,' + Buffer.from('bild').toString('base64');
r = await call('POST', '/slip', { body: { image: img } });
ok(r.status === 401, 'Scan ohne Einladungscode: 401');
r = await call('POST', '/slip', { invite: 'probe', body: { image: '' } });
ok(r.status === 400 && /Kein gültiges Bild/.test(r.json.error), 'Scan ohne Bild: verständliche Meldung');
r = await call('POST', '/slip', { invite: 'probe', body: { image: 'data:application/pdf;base64,QUJD' } });
ok(r.status === 400, 'nur Bilder');
geminiAnswer = (prompt) => {
  ok(/Heute ist/.test(prompt) && /Wettschein-Leser der App „Wettbuch“/.test(prompt) && /Cashout/.test(prompt), 'Gemini bekommt Datum und Wettschein-Anleitung');
  return JSON.stringify({
    isBetSlip: true, bookmaker: 'Tipico', note: null,
    slips: [
      { type: 'combi', status: 'open', stake: '10,00', totalOdds: null, potentialWin: 59.4, placedAt: '2026-11-10 19:02', betId: 'T-123', freebet: false,
        legs: [
          { home: 'Borussia Dortmund', away: 'FC Bayern', market: 'Endergebnis', pick: '1', odds: '2,70', competition: 'Bundesliga', kickoff: '2026-11-14 18:30', result: 'open' },
          { home: 'Real Madrid', away: 'Liverpool', market: 'Über/Unter', pick: 'Über 2,5', odds: 2.2, scoreHome: 2, scoreAway: 1, result: 'won' },
        ] },
      { type: 'single', status: 'cashout', stake: 5, totalOdds: 1.8, cashout: '7,20', freebet: 'ja', legs: [{ home: 'Inter', away: 'Milan', pick: 'X', odds: 3.1, result: 'banane' }] },
      { type: 'system', system: '2/3', status: 'won', stake: 6, potentialWin: 30, legs: [{ event: 'Bundesliga – Meister', pick: 'Bayern', odds: 1.2 }, { home: 'A', away: 'B', pick: '2', odds: 2 }] },
      { type: 'quatsch', status: 'irgendwas', stake: null, legs: [] },
      { status: 'lost', freebet: true, legs: [{ home: 'C', away: 'D', pick: '2', odds: 0.5, scoreHome: 99 }] },
    ],
  });
};
r = await call('POST', '/slip', { invite: ' PROBE ', body: { image: img } });
const sc = r.json && r.json.scan;
ok(r.status === 200 && r.json.model === 'gemini-9.9-flash' && sc && sc.isBetSlip && sc.bookmaker === 'Tipico', 'Scan liest den Screenshot (Code ohne Groß-/Kleinschreibung)');
ok(sc && sc.slips.length === 4, 'leerer Schein ohne Tipps und Einsatz fällt weg');
const s0 = sc && sc.slips[0];
ok(s0 && s0.type === 'combi' && s0.stake === 10 && s0.totalOdds === 5.94 && s0.potentialWin === 59.4 && s0.placedAt === '2026-11-10 19:02' && s0.betId === 'T-123',
  'Kombi: Einsatz mit Komma gelesen, fehlende Gesamtquote aus den Einzelquoten');
ok(s0 && s0.legs[0].odds === 2.7 && s0.legs[0].market === 'Endergebnis' && s0.legs[1].result === 'won' && s0.legs[1].scoreHome === 2 && s0.legs[1].scoreAway === 1,
  'Tipps: Quote, Wettart, Ergebnis und Spielstand');
const s1 = sc && sc.slips[1];
ok(s1 && s1.status === 'cashout' && s1.cashout === 7.2 && s1.freebet === false && s1.legs[0].result === 'unknown', 'Cashout-Betrag gelesen, Unsinn wird „unbekannt“');
const s2 = sc && sc.slips[2];
ok(s2 && s2.type === 'system' && s2.system === '2/3' && s2.totalOdds === null && s2.legs[0].event === 'Bundesliga – Meister', 'Systemwette: keine ausgedachte Gesamtquote');
const s3 = sc && sc.slips[3];
ok(s3 && s3.type === 'single' && s3.status === 'lost' && s3.freebet === true && s3.legs[0].odds === null && s3.legs[0].scoreHome === null && s3.system === null,
  'ohne Wett-Art: Einzelwette, unmögliche Quote und Tore → null');
geminiAnswer = { isBetSlip: false, slips: [] };
r = await call('POST', '/slip', { invite: 'zweiter', body: { image: img } });
ok(r.status === 200 && r.json.scan.isBetSlip === false && r.json.scan.slips.length === 0, 'Bild ohne Wette: isBetSlip = false');
geminiAnswer = () => 'Hier ist das Ergebnis: ' + JSON.stringify({ isBetSlip: true, slips: [{ status: 'open', stake: 2, legs: [{ home: 'A', away: 'B', pick: '1', odds: 1.5 }] }] }) + ' Viel Erfolg!';
r = await call('POST', '/slip', { invite: 'probe', body: { image: img } });
ok(r.status === 200 && r.json.scan.slips.length === 1 && r.json.scan.slips[0].totalOdds === 1.5, 'Antwort mit Text drumherum wird trotzdem gelesen');
geminiAnswer = { isBetSlip: true, slips: Array.from({ length: 14 }, (_, k) => ({ status: 'won', stake: k + 1, legs: [{ pick: '1', odds: 1.5 }] })) };
r = await call('POST', '/slip', { invite: 'probe', body: { image: img } });
ok(r.status === 200 && r.json.scan.slips.length === 10 && r.json.scan.slips[9].stake === 10, 'höchstens 10 Scheine je Bild');
r = await call('POST', '/match', { invite: 'probe', body: { image: img } });
ok(r.status === 404, 'alter Spiel-Scan (/match) ist weg');
const before = geminiCalls;
let scanBlocked = 0;
for (let i = 0; i < 12; i++) if ((await call('POST', '/slip', { invite: 'zweiter', body: { image: img } })).status === 429) scanBlocked++;
ok(scanBlocked >= 1 && geminiCalls - before <= 11, `Scan-Bremse je Einladungscode (${scanBlocked} abgewiesen)`);

// ---- Zeitgeber: Spielplan-Lauf auf GitHub anstoßen, wenn der veröffentlichte zu alt ist
const ghEnv = Object.assign({}, env, { GITHUB_TOKEN: 'gh-attrappe' });
const minAgo = (m) => new Date(Date.now() - m * 60e3).toISOString();
r = await call('GET', '/kick', { invite: 'probe' });
ok(r.status === 200 && /Kein GITHUB_TOKEN/.test(r.json.info) && dispatches.length === 0, 'ohne GitHub-Schlüssel: Zeitgeber aus');
r = await call('GET', '/kick');
ok(r.status === 401, '/kick nur mit Einladungscode');
gamesAt = minAgo(45);
r = await call('GET', '/kick', { invite: 'probe', e: ghEnv });
ok(r.status === 200 && /nichts zu tun/.test(r.json.info) && dispatches.length === 0, `frischer Spielplan: nichts starten (${r.json.info})`);
gamesAt = minAgo(200);
r = await call('GET', '/kick', { invite: 'probe', e: ghEnv });
const d0 = dispatches[0];
ok(r.status === 200 && /Spielplan-Lauf gestartet/.test(r.json.info) && dispatches.length === 1, `alter Spielplan: Lauf gestartet (${r.json.info})`);
ok(d0 && /\/repos\/sneaxx141108-gif\/result-ai\/actions\/workflows\/games\.yml\/dispatches$/.test(d0.url) && d0.body.ref === 'main' && d0.body.inputs.via === 'zeitgeber',
  'startet games.yml auf main mit via = zeitgeber');
ok(d0 && d0.head.Authorization === 'Bearer gh-attrappe' && /^Wettbuch-Server\//.test(d0.head['User-Agent']), 'ehrliche Kennung, Schlüssel nur an GitHub');
ok(!JSON.stringify(r.json).includes('gh-attrappe'), 'Antwort verrät den GitHub-Schlüssel nicht');
gamesAt = null;
ghStatus.push(422);
r = await call('GET', '/kick', { invite: 'probe', e: ghEnv });
ok(dispatches.length === 3 && dispatches[2].body.inputs === undefined && /nicht lesbar/.test(r.json.info), 'Spielplan nicht erreichbar: Lauf trotzdem; GitHub kennt „via“ nicht → zweiter Versuch ohne');
ghStatus.push(403);
r = await call('GET', '/kick', { invite: 'probe', e: ghEnv });
ok(r.status === 200 && /GitHub hat abgelehnt: 403/.test(r.json.info), 'GitHub lehnt ab: verständliche Meldung statt Absturz');
let waited = null;
gamesAt = minAgo(181);
const logs = [];
const oldLog = console.log;
console.log = (...a) => logs.push(a.join(' '));
await W.scheduled({ cron: '*/30 * * * *' }, ghEnv, { waitUntil: (pr) => { waited = pr; } });
await waited;
console.log = oldLog;
ok(dispatches.length === 5 && logs.some((l) => /Zeitgeber: Spielplan-Lauf gestartet/.test(l)), 'Cron-Zeitgeber startet den Lauf selbst');

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
