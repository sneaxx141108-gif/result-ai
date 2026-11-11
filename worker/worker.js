/* Wettbuch – Server (Cloudflare Worker, Gratis-Tarif). Hält die KI-Schlüssel geheim und übernimmt, was die App allein nicht kann.
     GET  /             Status: welche Geheimnisse und Bindungen eingetragen sind (nie die Werte)
     POST /auth/signup  Konto erstellen: nur Benutzername + Passwort (Niklas, 10.11.2026: „einfach einen User und Passwort, mehr nicht“)
     POST /auth/login   Anmelden → Sitzungs-Schlüssel für dieses Gerät
     POST /auth/logout  Abmelden (die Sitzung dieses Geräts wird gelöscht)
     POST /auth/delete  Konto mit allen Daten löschen (Passwort nötig)
     GET  /sync         Daten des Kontos holen (?v=<bekannte Version> → nur „same“, wenn sich nichts geändert hat)          – mit Sitzung
     PUT  /sync         Daten speichern ({ base, data }: base = Version, auf der die App aufbaut; passt sie nicht → 409 mit dem Stand)
     GET  /check        Einladungscode prüfen (Kopfzeile X-Invite)
     POST /slip         Screenshot aus der Wett-App lesen (Gemini) → alle Wettscheine darauf als JSON (Einsatz, Quote, Tipps,
                        Status, Cashout, Datum)                                                                             – nur mit Einladungscode
     POST /bet          einen Wettschein lesen (für alte App-Stände)                                                       – nur mit Einladungscode
     GET  /kick         Spielplan-Lauf anstoßen, falls der veröffentlichte älter als 3 Stunden ist                         – nur mit Einladungscode
     Zeitgeber          Cron Trigger (alle 30 Minuten): wie /kick. GitHub verschluckt geplante Läufe manchmal stundenlang.
   Geheimnisse trägt Niklas selbst ein (Cloudflare → Workers & Pages → result-ai → Settings → Variables and Secrets), nie in den Code:
     GEMINI_API_KEY (Google AI Studio) · GITHUB_TOKEN (fine-grained, nur result-ai, Actions: Read and write) · INVITE_CODES (mit Komma getrennt)
   Konten: Cloudflare-Datenbank D1 mit der Bindung „DB“ (Settings → Bindings → D1 database). Die Tabellen legt der Server selbst an.
     Passwörter: Die App streckt sie (PBKDF2, 150.000 Runden, Salz = Benutzername) und schickt nur das Ergebnis. Der Server speichert davon
     nur SHA-256 mit eigenem Zufalls-Salz – das Passwort selbst kommt hier nie an. Sitzungen: Zufallsschlüssel, gespeichert wird nur sein SHA-256.
     Die Daten eines Kontos (Wetten, Guthaben, Verlauf, Einstellungen) liegen als ein JSON-Dokument mit Versionsnummer; zusammengeführt wird in der App.
   Aktualisieren: diese Datei komplett kopieren → Cloudflare → result-ai → Edit code → alles ersetzen → Deploy. */
const VERSION = '2026-11-11';
const REPO = 'sneaxx141108-gif/result-ai';
const GAMES = 'https://sneaxx141108-gif.github.io/result-ai/data/games.json';
const ORIGINS = ['https://sneaxx141108-gif.github.io', 'http://localhost:8098', 'http://127.0.0.1:8098'];
const GEMINI = 'https://generativelanguage.googleapis.com/v1beta';
const UA = 'Wettbuch-Server/1.0 (+https://github.com/sneaxx141108-gif/result-ai)';
const STALE_MIN = 180; // so alt darf der veröffentlichte Spielplan werden, dann startet der Zeitgeber einen neuen Lauf
const MAX_USERS = 300; // Bremse gegen Massen-Anmeldungen (Gratis-Datenbank)
const MAX_DOC = 900000; // höchstens etwa 0,9 MB Daten je Konto
const LOCK_FAILS = 8; // so viele falsche Passwörter hintereinander …
const LOCK_MIN = 15; // … sperren die Anmeldung so viele Minuten
const SESSION_DAYS = 400; // so lange bleibt ein Gerät angemeldet, ohne die App zu öffnen

export default {
  async fetch(req, env) {
    const origin = req.headers.get('Origin') || '';
    const cors = ORIGINS.includes(origin)
      ? { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, X-Invite, Authorization', 'Access-Control-Max-Age': '86400', Vary: 'Origin' }
      : { Vary: 'Origin' };
    const sendText = (text, status = 200) => new Response(text, { status, headers: Object.assign({ 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }, cors) });
    const send = (obj, status = 200) => {
      if (obj && obj.raw) return sendText(obj.raw, obj.status || status);
      const st = (obj && obj.status) || status;
      if (obj) delete obj.status;
      return sendText(JSON.stringify(obj), st);
    };
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    const path = new URL(req.url).pathname.replace(/\/+$/, '') || '/';
    try {
      if (path === '/') return send({ ok: true, app: 'Wettbuch', version: VERSION, ki: !!env.GEMINI_API_KEY, zeitgeber: !!env.GITHUB_TOKEN, einladung: codes(env).length > 0, konten: !!env.DB });
      if (path.startsWith('/auth/') || path === '/sync') return send(await account(req, env, path)); // Konten brauchen keinen Einladungscode
      if (!codes(env).length) return send({ ok: false, error: 'Auf dem Server ist noch kein Einladungscode eingetragen.' }, 401);
      if (!codes(env).includes(inviteOf(req))) return send({ ok: false, error: 'Einladungscode fehlt oder ist falsch.' }, 401);
      if (path === '/check') return send({ ok: true });
      if (path === '/kick') return send({ ok: true, info: await kickGames(env) });
      if (path === '/slip' && req.method === 'POST') return send(await readSlips(req, env));
      if (path === '/bet' && req.method === 'POST') return send(await readBet(req, env));
      return send({ ok: false, error: 'Unbekannte Adresse.' }, 404);
    } catch (e) {
      return send({ ok: false, error: String((e && e.message) || e).slice(0, 300) }, (e && e.status) || 500);
    }
  },
  async scheduled(event, env, ctx) {
    ctx.waitUntil(kickGames(env).then((info) => console.log('Zeitgeber:', info)).catch((e) => console.log('Zeitgeber-Fehler:', e && e.message)));
  },
};

const codes = (env) => String(env.INVITE_CODES || '').split(/[,;\s]+/).map((c) => c.trim().toLowerCase()).filter(Boolean);
const inviteOf = (req) => String(req.headers.get('X-Invite') || '').trim().toLowerCase();
function httpErr(msg, status) {
  const e = new Error(msg);
  e.status = status;
  return e;
}
// grobe Bremse gegen Dauerfeuer (je Server-Instanz und Minute) – schützt das Gratis-Kontingent bei Gemini und die Konten
const HITS = new Map();
function tooMany(key, max) {
  const k = key + '|' + Math.floor(Date.now() / 60e3);
  const n = (HITS.get(k) || 0) + 1;
  if (HITS.size > 500) HITS.clear();
  HITS.set(k, n);
  return n > max;
}

// ------------------------------------------------------------------ Konten: Benutzername + Passwort, Daten je Konto
let READY = null;
function ready(env) {
  if (!READY) {
    READY = env.DB.batch([
      env.DB.prepare('CREATE TABLE IF NOT EXISTS users (name TEXT PRIMARY KEY, salt TEXT NOT NULL, hash TEXT NOT NULL, created INTEGER NOT NULL, fails INTEGER NOT NULL DEFAULT 0, lock_until INTEGER NOT NULL DEFAULT 0)'),
      env.DB.prepare('CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, name TEXT NOT NULL, created INTEGER NOT NULL, seen INTEGER NOT NULL)'),
      env.DB.prepare('CREATE TABLE IF NOT EXISTS docs (name TEXT PRIMARY KEY, v INTEGER NOT NULL, data TEXT NOT NULL, updated INTEGER NOT NULL)'),
    ]).catch((e) => { READY = null; throw e; });
  }
  return READY;
}
const USER_RE = /^[a-z0-9._-]{3,20}$/;
const enc = new TextEncoder();
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
const sha = async (s) => hex(await crypto.subtle.digest('SHA-256', enc.encode(s)));
function randomKey(n) {
  const b = new Uint8Array(n);
  crypto.getRandomValues(b);
  return btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function same(a, b) { // Vergleich ohne frühen Abbruch
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let x = 0;
  for (let i = 0; i < a.length; i++) x |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return x === 0;
}
async function creds(req) {
  const b = await req.json().catch(() => null);
  const user = String((b && b.user) || '').trim().toLowerCase();
  const pass = String((b && b.pass) || '');
  if (!USER_RE.test(user)) throw httpErr('Der Benutzername braucht 3 bis 20 Zeichen: Buchstaben, Zahlen, Punkt, Bindestrich oder Unterstrich.', 400);
  if (!/^[0-9a-f]{64}$/.test(pass)) throw httpErr('Das Passwort fehlt.', 400); // die App schickt nur das gestreckte Passwort
  return { user, pass };
}
async function newSession(env, user) {
  const token = randomKey(32);
  const now = Date.now();
  await env.DB.prepare('INSERT INTO sessions (token, name, created, seen) VALUES (?, ?, ?, ?)').bind(await sha(token), user, now, now).run();
  return token;
}
async function session(req, env) {
  const m = /^Bearer\s+([A-Za-z0-9_-]{20,100})$/.exec(req.headers.get('Authorization') || '');
  if (!m) throw httpErr('Nicht angemeldet.', 401);
  const key = await sha(m[1]);
  const s = await env.DB.prepare('SELECT name, seen FROM sessions WHERE token = ?').bind(key).first();
  const now = Date.now();
  if (!s || now - s.seen > SESSION_DAYS * 864e5) throw httpErr('Abgemeldet – bitte neu anmelden.', 401);
  if (now - s.seen > 864e5) await env.DB.prepare('UPDATE sessions SET seen = ? WHERE token = ?').bind(now, key).run();
  return { name: s.name, key };
}
// Passwort prüfen; falsche Versuche zählen, nach LOCK_FAILS ist die Anmeldung LOCK_MIN Minuten gesperrt
async function checkPass(env, user, pass) {
  const u = await env.DB.prepare('SELECT salt, hash, fails, lock_until FROM users WHERE name = ?').bind(user).first();
  const now = Date.now();
  if (u && u.lock_until > now) throw httpErr(`Zu viele falsche Passwörter. Versuch es in ${Math.ceil((u.lock_until - now) / 60e3)} Minuten noch einmal.`, 429);
  if (!u || !same(await sha(u.salt + ':' + pass), u.hash)) {
    if (u) {
      const fails = u.fails + 1;
      const lock = fails >= LOCK_FAILS;
      await env.DB.prepare('UPDATE users SET fails = ?, lock_until = ? WHERE name = ?').bind(lock ? 0 : fails, lock ? now + LOCK_MIN * 60e3 : 0, user).run();
    }
    throw httpErr('Benutzername oder Passwort stimmt nicht.', 401);
  }
  if (u.fails || u.lock_until) await env.DB.prepare('UPDATE users SET fails = 0, lock_until = 0 WHERE name = ?').bind(user).run();
}
async function account(req, env, path) {
  if (!env.DB) throw httpErr('Konten sind auf dem Server noch nicht eingerichtet.', 503);
  await ready(env);
  const ip = req.headers.get('CF-Connecting-IP') || 'x';
  const post = req.method === 'POST';
  if (path === '/auth/signup' && post) {
    if (tooMany('su|' + ip, 5)) throw httpErr('Zu viele neue Konten auf einmal – bitte eine Minute warten.', 429);
    const { user, pass } = await creds(req);
    const n = await env.DB.prepare('SELECT COUNT(*) AS n FROM users').first('n');
    if (n >= MAX_USERS) throw httpErr('Gerade können keine neuen Konten erstellt werden.', 403);
    const salt = randomKey(16);
    const r = await env.DB.prepare('INSERT INTO users (name, salt, hash, created) VALUES (?, ?, ?, ?) ON CONFLICT(name) DO NOTHING').bind(user, salt, await sha(salt + ':' + pass), Date.now()).run();
    if (!r.meta || !r.meta.changes) throw httpErr('Diesen Benutzernamen gibt es schon. Such dir einen anderen aus oder melde dich an.', 409);
    return { ok: true, user, token: await newSession(env, user) };
  }
  if (path === '/auth/login' && post) {
    if (tooMany('li|' + ip, 10)) throw httpErr('Zu viele Versuche – bitte eine Minute warten.', 429);
    const { user, pass } = await creds(req);
    await checkPass(env, user, pass);
    return { ok: true, user, token: await newSession(env, user) };
  }
  if (path === '/auth/logout' && post) {
    const m = /^Bearer\s+([A-Za-z0-9_-]{20,100})$/.exec(req.headers.get('Authorization') || '');
    if (m) await env.DB.prepare('DELETE FROM sessions WHERE token = ?').bind(await sha(m[1])).run();
    return { ok: true };
  }
  if (path === '/auth/delete' && post) {
    if (tooMany('li|' + ip, 10)) throw httpErr('Zu viele Versuche – bitte eine Minute warten.', 429);
    const s = await session(req, env);
    const { user, pass } = await creds(req);
    if (user !== s.name) throw httpErr('Das ist nicht das angemeldete Konto.', 403);
    await checkPass(env, user, pass);
    await env.DB.batch(['users', 'sessions', 'docs'].map((t) => env.DB.prepare(`DELETE FROM ${t} WHERE name = ?`).bind(user)));
    return { ok: true };
  }
  if (path === '/sync') {
    const s = await session(req, env);
    if (tooMany('sy|' + s.name, 90)) throw httpErr('Gerade zu viele Abgleiche – gleich geht es weiter.', 429);
    if (req.method === 'GET') {
      const known = Number(new URL(req.url).searchParams.get('v'));
      const row = await env.DB.prepare('SELECT v, data FROM docs WHERE name = ?').bind(s.name).first();
      if (!row) return { ok: true, user: s.name, v: 0, data: null };
      if (row.v === known) return { ok: true, user: s.name, v: row.v, same: true };
      return { raw: `{"ok":true,"user":${JSON.stringify(s.name)},"v":${row.v},"data":${row.data}}` }; // Daten unverändert durchreichen
    }
    if (req.method === 'PUT') {
      const text = await req.text();
      if (text.length > MAX_DOC + 100) throw httpErr('Zu viele Daten für ein Konto.', 413);
      let b = null;
      try { b = JSON.parse(text); } catch (e) { /* unten */ }
      if (!b || !Number.isInteger(b.base) || b.base < 0 || !b.data || typeof b.data !== 'object' || Array.isArray(b.data)) throw httpErr('Ungültige Daten.', 400);
      const data = JSON.stringify(b.data);
      if (data.length > MAX_DOC) throw httpErr('Zu viele Daten für ein Konto.', 413);
      const now = Date.now();
      const r = b.base === 0
        ? await env.DB.prepare('INSERT INTO docs (name, v, data, updated) VALUES (?, 1, ?, ?) ON CONFLICT(name) DO NOTHING').bind(s.name, data, now).run()
        : await env.DB.prepare('UPDATE docs SET v = v + 1, data = ?, updated = ? WHERE name = ? AND v = ?').bind(data, now, s.name, b.base).run();
      if (r.meta && r.meta.changes) return { ok: true, v: b.base + 1 };
      // inzwischen hat ein anderes Gerät gespeichert: Stand zurückgeben, die App führt zusammen und versucht es noch einmal
      const row = await env.DB.prepare('SELECT v, data FROM docs WHERE name = ?').bind(s.name).first();
      if (!row) return { ok: false, conflict: true, v: 0, data: null, status: 409 };
      return { raw: `{"ok":false,"conflict":true,"v":${row.v},"data":${row.data}}`, status: 409 };
    }
  }
  throw httpErr('Unbekannte Adresse.', 404);
}

// ------------------------------------------------------------------ Zeitgeber: Spielplan auf GitHub anstoßen
async function kickGames(env) {
  if (!env.GITHUB_TOKEN) return 'Kein GITHUB_TOKEN eingetragen – Zeitgeber aus.';
  let age = Infinity;
  try {
    const r = await fetch(GAMES + '?nc=' + Date.now(), { headers: { 'User-Agent': UA } });
    age = (Date.now() - Date.parse((await r.json()).updatedAt)) / 60e3;
  } catch (e) { /* Seite nicht erreichbar oder kaputt → neu holen */ }
  if (age < STALE_MIN) return `Spielplan ist ${Math.round(age)} Min. alt – nichts zu tun.`;
  const url = `https://api.github.com/repos/${REPO}/actions/workflows/games.yml/dispatches`;
  const head = { Authorization: 'Bearer ' + env.GITHUB_TOKEN, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': UA, 'Content-Type': 'application/json' };
  let r = await fetch(url, { method: 'POST', headers: head, body: JSON.stringify({ ref: 'main', inputs: { via: 'zeitgeber' } }) });
  if (r.status === 422) r = await fetch(url, { method: 'POST', headers: head, body: JSON.stringify({ ref: 'main' }) }); // falls games.yml die Eingabe „via“ (noch) nicht kennt
  const why = Number.isFinite(age) ? `Spielplan war ${Math.round(age)} Min. alt` : 'Spielplan nicht lesbar';
  return r.status === 204 ? `Spielplan-Lauf gestartet (${why}).` : `GitHub hat abgelehnt: ${r.status} ${(await r.text()).slice(0, 160)}`;
}

// ------------------------------------------------------------------ Bilder lesen (Gemini liest nur ab – gerechnet wird in der App)
function today() {
  try { return new Date().toLocaleDateString('de-DE', { timeZone: 'Europe/Berlin', weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' }); } catch (e) { return new Date().toISOString().slice(0, 10); }
}
function nowBerlin() {
  try { return new Date().toLocaleTimeString('de-DE', { timeZone: 'Europe/Berlin', hour: '2-digit', minute: '2-digit' }); } catch (e) { return ''; }
}
async function imageOf(req, env) {
  if (!env.GEMINI_API_KEY) throw httpErr('Auf dem Server ist noch kein Gemini-Schlüssel eingetragen.', 503);
  if (tooMany(inviteOf(req), 12)) throw httpErr('Zu viele Scans auf einmal – bitte eine Minute warten.', 429);
  const body = await req.json().catch(() => null);
  let img = body && typeof body.image === 'string' ? body.image : '';
  let mime = (body && body.mime) || 'image/jpeg';
  const m = /^data:([^;,]+);base64,/.exec(img.slice(0, 64));
  if (m) {
    mime = m[1];
    img = img.slice(m[0].length);
  }
  if (!img || img.length > 9e6 || !/^image\/(jpeg|png|webp|heic|heif)$/.test(mime)) throw httpErr('Kein gültiges Bild (JPEG oder PNG, höchstens etwa 6 MB).', 400);
  return { inlineData: { mimeType: mime, data: img } };
}
const S = (type, extra) => Object.assign({ type }, extra);
const num = (x, lo, hi) => {
  const v = typeof x === 'string' ? parseFloat(x.replace(',', '.')) : x;
  return typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi ? Math.round(v * 100) / 100 : null;
};
const int = (x, lo, hi) => { const v = num(x, lo, hi); return v == null ? null : Math.round(v); };
const str = (x, n = 80) => (typeof x === 'string' && x.trim() ? x.trim().slice(0, n) : null);

// Wettscheine (Niklas, 11.11.2026: „reine Tracking-App für Tipico mit Scan-Funktion“): ein Schein oder die ganze Liste „Meine Wetten“
const slipPrompt = () => `Du bist der Wettschein-Leser der App „Wettbuch“. Heute ist ${today()}, es ist ${nowBerlin()} Uhr deutscher Zeit.
Auf dem Bild ist ein Screenshot aus einer Wett-App, meistens Tipico: ein einzelner Wettschein (z. B. direkt nach dem Platzieren oder in
„Meine Wetten“ aufgeklappt) oder eine Liste mit mehreren Wetten („Meine Wetten“, „Offen“, „Abgerechnet“).
Lies NUR ab, was wirklich zu sehen ist. Nichts erfinden, nichts schätzen – was nicht zu sehen ist, ist null.
- isBetSlip: true, wenn mindestens eine Wette zu sehen ist, sonst false (dann slips leer lassen).
- slips: jede Wette auf dem Bild, von oben nach unten, höchstens 10. Eine Kombi ist EINE Wette mit mehreren Tipps.
  Ist eine Wette nur zugeklappt zu sehen, lies, was da ist (z. B. Einsatz, Quote, Status und den ersten Tipp).
- Je Wette:
  type: „single“ (Einzelwette), „combi“ (Kombi), „system“ (Systemwette, z. B. „System 2 aus 3“), sonst „unknown“. system = z. B. „2/3“, sonst null.
  stake = Gesamteinsatz, totalOdds = Gesamtquote, potentialWin = möglicher Gewinn bzw. Auszahlung (bei Tipico „Möglicher Gewinn“, nach der
  Abrechnung „Gewinn“ oder „Auszahlung“) – alles als Zahl mit Punkt (1,85 → 1.85; „10,00 €“ → 10).
  status: „open“ (offen/läuft), „won“ (gewonnen), „lost“ (verloren), „void“ (storniert/erstattet), „cashout“ (per Cashout ausgezahlt), sonst „unknown“.
  cashout = per Cashout ausgezahlter Betrag, sonst null. freebet = true bei Gratiswette/Freebet, sonst false.
  placedAt = wann die Wette platziert wurde, als JJJJ-MM-TT HH:MM, falls zu sehen, sonst null. betId = Wett-ID bzw. Schein-Nummer, falls zu sehen.
  legs: jeder einzelne Tipp. home/away = die Teams so geschrieben wie zu sehen; event = Bezeichnung, wenn keine zwei Teams erkennbar sind
  (z. B. „Bundesliga – Meister“); market = Wettart, so wie zu sehen (z. B. „Endergebnis“, „Doppelte Chance“, „Über/Unter“, „Beide Teams treffen“,
  „Halbzeit“, „Handicap“, „Genaues Ergebnis“); pick = worauf gewettet wurde, so wie zu sehen (z. B. „1“, „X“, „2“, „1X“, „Bayern München“,
  „Über 2,5“, „Ja“, „2:1“); odds = Quote dieses Tipps; competition = Wettbewerb; kickoff = Anstoß als JJJJ-MM-TT HH:MM in deutscher Zeit
  (fehlt das Jahr: das passende von heute aus; „heute“, „morgen“ oder ein Wochentag: Datum von heute aus; ohne Uhrzeit nur JJJJ-MM-TT);
  scoreHome/scoreAway = Spielstand bzw. Endstand, falls zu sehen; result = „won“/„lost“/„void“, wenn dieser Tipp schon sichtbar entschieden
  ist (Haken, Kreuz, grün/rot markiert), „open“, wenn er noch offen ist, sonst „unknown“.
- bookmaker = Anbieter, falls erkennbar. note = kurzer Hinweis auf Deutsch, falls etwas unklar oder abgeschnitten ist, sonst null.`;
const SLIP_ST = ['open', 'won', 'lost', 'void', 'cashout', 'unknown'];
const LEG_ST = ['open', 'won', 'lost', 'void', 'unknown'];
const STRN = () => S('STRING', { nullable: true });
const SLIP_SCHEMA = S('OBJECT', {
  properties: {
    isBetSlip: S('BOOLEAN'),
    bookmaker: S('STRING', { nullable: true }),
    note: S('STRING', { nullable: true }),
    slips: S('ARRAY', { items: S('OBJECT', {
      properties: {
        type: S('STRING', { format: 'enum', enum: ['single', 'combi', 'system', 'unknown'] }), system: STRN(),
        status: S('STRING', { format: 'enum', enum: SLIP_ST }), stake: S('NUMBER', { nullable: true }), totalOdds: S('NUMBER', { nullable: true }),
        potentialWin: S('NUMBER', { nullable: true }), cashout: S('NUMBER', { nullable: true }), freebet: S('BOOLEAN', { nullable: true }),
        placedAt: STRN(), betId: STRN(),
        legs: S('ARRAY', { items: S('OBJECT', {
          properties: {
            home: S('STRING', { nullable: true }), away: S('STRING', { nullable: true }), event: S('STRING', { nullable: true }),
            competition: S('STRING', { nullable: true }), kickoff: S('STRING', { nullable: true }), market: S('STRING', { nullable: true }),
            pick: S('STRING'), odds: S('NUMBER', { nullable: true }), scoreHome: S('INTEGER', { nullable: true }), scoreAway: S('INTEGER', { nullable: true }),
            result: S('STRING', { format: 'enum', enum: LEG_ST }),
          },
          required: ['pick'],
        }) }),
      },
      required: ['status', 'legs'],
    }) }),
  },
  required: ['isBetSlip', 'slips'],
});
function cleanLeg(l) {
  l = l && typeof l === 'object' ? l : {};
  return {
    home: str(l.home), away: str(l.away), event: str(l.event, 120), competition: str(l.competition), kickoff: str(l.kickoff, 25),
    market: str(l.market), pick: str(l.pick, 120) || '?', odds: num(l.odds, 1.01, 1000), scoreHome: int(l.scoreHome, 0, 30),
    scoreAway: int(l.scoreAway, 0, 30), result: LEG_ST.includes(l.result) ? l.result : 'unknown',
  };
}
function cleanSlip(d) {
  d = d && typeof d === 'object' ? d : {};
  const legs = (Array.isArray(d.legs) ? d.legs : []).slice(0, 30).map(cleanLeg);
  const prod = legs.length && legs.every((l) => l.odds) ? Math.round(legs.reduce((q, l) => q * l.odds, 1) * 100) / 100 : null;
  const type = ['single', 'combi', 'system'].includes(d.type) ? d.type : legs.length > 1 ? 'combi' : legs.length ? 'single' : 'unknown';
  return {
    type, system: type === 'system' ? str(d.system, 12) : null, status: SLIP_ST.includes(d.status) ? d.status : 'unknown',
    stake: num(d.stake, 0.01, 1e6), totalOdds: num(d.totalOdds, 1.01, 1e6) || (type === 'system' ? null : prod), potentialWin: num(d.potentialWin, 0.01, 1e9),
    cashout: num(d.cashout, 0, 1e9), freebet: d.freebet === true, placedAt: str(d.placedAt, 25), betId: str(d.betId, 40), legs,
  };
}
function cleanSlips(d) {
  d = d && typeof d === 'object' ? d : {};
  const slips = (Array.isArray(d.slips) ? d.slips : []).slice(0, 10).map(cleanSlip).filter((x) => x.legs.length || x.stake);
  return { isBetSlip: d.isBetSlip !== false && slips.length > 0, bookmaker: str(d.bookmaker, 40), note: str(d.note, 200), slips };
}
async function readSlips(req, env) {
  const image = await imageOf(req, env);
  const { data, model } = await gemini(env, [{ text: slipPrompt() }, image], SLIP_SCHEMA);
  return { ok: true, model, scan: cleanSlips(data) };
}

// ein einzelner Wettschein (ältere App-Stände bis ra-shell-v24)
const betPrompt = () => `Du bist der Wettschein-Leser der App „Wettbuch“. Heute ist ${today()}.
Auf dem Bild ist ein Wettschein bzw. eine Wette aus einer Wett-App oder Website (z. B. Tipico, bet365, Bwin, Interwetten, Betano, Merkur Bets).
Lies NUR ab, was wirklich zu sehen ist. Nichts erfinden, nichts schätzen – was nicht zu sehen ist, ist null.
- isBetSlip: true, wenn eine Wette zu sehen ist, sonst false (dann legs leer lassen).
- legs: jede einzelne Auswahl (bei einer Kombi mehrere). home/away = die Teams so geschrieben wie zu sehen; event = Bezeichnung, falls keine
  zwei Teams erkennbar sind; pick = worauf gewettet wurde (z. B. „Bayern München“, „Unentschieden“, „Über 2,5 Tore“, „Beide Teams treffen: Ja“);
  market = Wettart (z. B. „Siegwette“, „Doppelte Chance“, „Über/Unter“); odds = Quote dieser Auswahl; competition = Wettbewerb;
  kickoff = Anstoß als JJJJ-MM-TT HH:MM (fehlt das Jahr, das passende von heute aus); result = „won“/„lost“/„void“, wenn diese Auswahl schon
  sichtbar entschieden ist, „open“, wenn sie noch offen ist, sonst „unknown“.
- stake = Einsatz, totalOdds = Gesamtquote, potentialWin = möglicher Gewinn bzw. Auszahlung – alles als Zahl mit Punkt (1,85 → 1.85; „10,00 €“ → 10).
- currency z. B. „EUR“; bookmaker = Anbieter, falls erkennbar.
- status: „open“, wenn der Schein noch offen ist; „won“/„lost“/„void“, wenn er schon entschieden ist (z. B. „Gewonnen“, „Verloren“, „Storniert“);
  sonst „unknown“.
- note: kurzer Hinweis auf Deutsch, falls etwas unklar oder abgeschnitten ist, sonst null.`;
const RESULT = S('STRING', { format: 'enum', enum: ['open', 'won', 'lost', 'void', 'unknown'] });
const BET_SCHEMA = S('OBJECT', {
  properties: {
    isBetSlip: S('BOOLEAN'),
    bookmaker: S('STRING', { nullable: true }),
    status: RESULT,
    stake: S('NUMBER', { nullable: true }),
    totalOdds: S('NUMBER', { nullable: true }),
    potentialWin: S('NUMBER', { nullable: true }),
    currency: S('STRING', { nullable: true }),
    legs: S('ARRAY', { items: S('OBJECT', {
      properties: {
        home: S('STRING', { nullable: true }), away: S('STRING', { nullable: true }), event: S('STRING', { nullable: true }),
        competition: S('STRING', { nullable: true }), kickoff: S('STRING', { nullable: true }), market: S('STRING', { nullable: true }),
        pick: S('STRING'), odds: S('NUMBER', { nullable: true }), result: RESULT,
      },
      required: ['pick'],
    }) }),
    note: S('STRING', { nullable: true }),
  },
  required: ['isBetSlip', 'status', 'legs'],
});
async function readBet(req, env) {
  const image = await imageOf(req, env);
  const { data, model } = await gemini(env, [{ text: betPrompt() }, image], BET_SCHEMA);
  return { ok: true, model, bet: cleanBet(data) };
}
const ST = ['open', 'won', 'lost', 'void', 'unknown'];
function cleanBet(d) {
  d = d && typeof d === 'object' ? d : {};
  const legs = (Array.isArray(d.legs) ? d.legs : []).slice(0, 20).map((l) => ({
    home: str(l && l.home), away: str(l && l.away), event: str(l && l.event, 120), competition: str(l && l.competition), kickoff: str(l && l.kickoff, 25),
    market: str(l && l.market), pick: str(l && l.pick, 120) || '?', odds: num(l && l.odds, 1.01, 1000), result: l && ST.includes(l.result) ? l.result : 'unknown',
  }));
  const prod = legs.length && legs.every((l) => l.odds) ? Math.round(legs.reduce((q, l) => q * l.odds, 1) * 100) / 100 : null;
  return {
    isBetSlip: d.isBetSlip !== false && legs.length > 0, bookmaker: str(d.bookmaker, 40), status: ST.includes(d.status) ? d.status : 'unknown',
    stake: num(d.stake, 0.01, 1e6), totalOdds: num(d.totalOdds, 1.01, 1e6) || prod, potentialWin: num(d.potentialWin, 0.01, 1e9),
    currency: str(d.currency, 8), legs, note: str(d.note, 200),
  };
}

// ------------------------------------------------------------------ Gemini: neueste Flash-Modelle zuerst (läuft weiter, wenn Google Modelle austauscht)
let MODELS = null;
async function models(key) {
  if (MODELS && Date.now() - MODELS.at < 6 * 36e5) return MODELS.list;
  let found = [];
  try {
    const d = await (await fetch(GEMINI + '/models?pageSize=200', { headers: { 'x-goog-api-key': key } })).json();
    found = (d.models || []).filter((m) => (m.supportedGenerationMethods || []).includes('generateContent'))
      .map((m) => String(m.name || '').replace('models/', ''))
      .filter((n) => /flash/.test(n) && !/image|tts|audio|live|embed|thinking-exp|robotics|-latest$/.test(n));
  } catch (e) { /* Liste nicht erreichbar → feste Namen */ }
  const ver = (n) => { const x = /gemini-(\d+(?:\.\d+)?)/.exec(n); return [x ? +x[1] : 0, /lite/.test(n) ? 0 : 1, /preview|exp/.test(n) ? 0 : 1]; };
  found.sort((a, b) => { const x = ver(a); const y = ver(b); return (y[0] - x[0]) || (y[1] - x[1]) || (y[2] - x[2]); });
  const list = [...new Set(found.slice(0, 2).concat(['gemini-flash-latest'], found.slice(2, 4), ['gemini-flash-lite-latest']))].slice(0, 5);
  MODELS = { at: Date.now(), list };
  return list;
}
function parseJson(s) {
  if (!s) return null;
  try { return JSON.parse(s); } catch (e) { /* manchmal mit Text drumherum */ }
  const m = /\{[\s\S]*\}/.exec(s);
  if (!m) return null;
  try { return JSON.parse(m[0]); } catch (e) { return null; }
}
async function gemini(env, parts, schema) {
  const key = env.GEMINI_API_KEY;
  let last = '';
  for (const model of await models(key)) {
    let useSchema = !!schema;
    for (let attempt = 0; attempt < 3; attempt++) {
      const gen = { temperature: 0, responseMimeType: 'application/json' };
      if (useSchema) gen.responseSchema = schema;
      const r = await fetch(`${GEMINI}/models/${model}:generateContent`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify({ contents: [{ role: 'user', parts }], generationConfig: gen }),
      });
      const text = await r.text();
      if (r.ok) {
        let d = null;
        try { d = JSON.parse(text); } catch (e) { /* unten: kein JSON */ }
        const cand = d && d.candidates && d.candidates[0];
        const out = cand && cand.content ? (cand.content.parts || []).filter((p) => !p.thought).map((p) => p.text || '').join('') : '';
        const json = parseJson(out);
        if (json) return { data: json, model };
        last = `${model}: Antwort war kein JSON`;
        break;
      }
      last = `${model}: HTTP ${r.status} ${text.slice(0, 160)}`;
      if (/API key not valid|API_KEY_INVALID|PERMISSION_DENIED/i.test(text)) throw httpErr('Der Gemini-Schlüssel auf dem Server ist ungültig.', 502);
      if (r.status === 400 && useSchema) { useSchema = false; continue; } // Modell mag das Antwort-Schema nicht → einmal ohne
      if (r.status === 429 && attempt === 0 && !/quota|exhausted|limit: 0/i.test(text)) { await new Promise((res) => setTimeout(res, 3000)); continue; }
      break; // überlastet, Kontingent leer oder Modell weg → nächstes Modell
    }
  }
  throw httpErr('Die KI hat gerade nicht geantwortet (' + last.slice(0, 140) + ').', 502);
}
