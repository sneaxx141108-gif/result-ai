/* Result AI – Server (Cloudflare Worker, Gratis-Tarif). Hält die KI-Schlüssel geheim und übernimmt, was die App allein nicht kann.
     GET  /        Status: welche Geheimnisse eingetragen sind (nie die Werte)
     GET  /check   Einladungscode prüfen (Kopfzeile X-Invite)
     POST /bet     Wettschein-Screenshot lesen (Gemini) → Wette als JSON                    – nur mit Einladungscode
     GET  /kick    Tipp-Suche anstoßen, falls die veröffentlichte älter als 50 Minuten ist   – nur mit Einladungscode
     Zeitgeber     Cron Trigger (alle 30 Minuten): wie /kick. GitHub verschluckt geplante Läufe (06.11.2026: 9 Stunden keine Suche).
   Geheimnisse trägt Niklas selbst ein (Cloudflare → Workers & Pages → result-ai → Settings → Variables and Secrets), nie in den Code:
     GEMINI_API_KEY (Google AI Studio) · GITHUB_TOKEN (fine-grained, nur result-ai, Actions: Read and write) · INVITE_CODES (mit Komma getrennt)
   Aktualisieren: diese Datei komplett kopieren → Cloudflare → result-ai → Edit code → alles ersetzen → Deploy. */
const VERSION = '2026-11-06';
const REPO = 'sneaxx141108-gif/result-ai';
const TIPS = 'https://sneaxx141108-gif.github.io/result-ai/data/tips.json';
const ORIGINS = ['https://sneaxx141108-gif.github.io', 'http://localhost:8098', 'http://127.0.0.1:8098'];
const GEMINI = 'https://generativelanguage.googleapis.com/v1beta';
const UA = 'ResultAI-Server/1.0 (+https://github.com/sneaxx141108-gif/result-ai)';
const STALE_MIN = 50; // so alt darf die veröffentlichte Tipp-Suche werden, dann startet der Zeitgeber eine neue

export default {
  async fetch(req, env) {
    const origin = req.headers.get('Origin') || '';
    const cors = ORIGINS.includes(origin)
      ? { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, X-Invite', 'Access-Control-Max-Age': '86400', Vary: 'Origin' }
      : { Vary: 'Origin' };
    const send = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: Object.assign({ 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }, cors) });
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    const path = new URL(req.url).pathname.replace(/\/+$/, '') || '/';
    try {
      if (path === '/') return send({ ok: true, app: 'Result AI', version: VERSION, ki: !!env.GEMINI_API_KEY, zeitgeber: !!env.GITHUB_TOKEN, einladung: codes(env).length > 0 });
      if (!codes(env).length) return send({ ok: false, error: 'Auf dem Server ist noch kein Einladungscode eingetragen.' }, 401);
      if (!codes(env).includes(inviteOf(req))) return send({ ok: false, error: 'Einladungscode fehlt oder ist falsch.' }, 401);
      if (path === '/check') return send({ ok: true });
      if (path === '/kick') return send({ ok: true, info: await kickTips(env) });
      if (path === '/bet' && req.method === 'POST') return send(await readBet(req, env));
      return send({ ok: false, error: 'Unbekannte Adresse.' }, 404);
    } catch (e) {
      return send({ ok: false, error: String((e && e.message) || e).slice(0, 300) }, (e && e.status) || 500);
    }
  },
  async scheduled(event, env, ctx) {
    ctx.waitUntil(kickTips(env).then((info) => console.log('Zeitgeber:', info)).catch((e) => console.log('Zeitgeber-Fehler:', e && e.message)));
  },
};

const codes = (env) => String(env.INVITE_CODES || '').split(/[,;\s]+/).map((c) => c.trim().toLowerCase()).filter(Boolean);
const inviteOf = (req) => String(req.headers.get('X-Invite') || '').trim().toLowerCase();
function httpErr(msg, status) {
  const e = new Error(msg);
  e.status = status;
  return e;
}
// grobe Bremse gegen Dauerfeuer (je Server-Instanz und Minute) – schützt das Gratis-Kontingent bei Gemini
const HITS = new Map();
function tooMany(key, max) {
  const k = key + '|' + Math.floor(Date.now() / 60e3);
  const n = (HITS.get(k) || 0) + 1;
  if (HITS.size > 500) HITS.clear();
  HITS.set(k, n);
  return n > max;
}

// ------------------------------------------------------------------ Zeitgeber: Tipp-Suche auf GitHub anstoßen
async function kickTips(env) {
  if (!env.GITHUB_TOKEN) return 'Kein GITHUB_TOKEN eingetragen – Zeitgeber aus.';
  let age = Infinity;
  try {
    const r = await fetch(TIPS + '?nc=' + Date.now(), { headers: { 'User-Agent': UA } });
    age = (Date.now() - Date.parse((await r.json()).updatedAt)) / 60e3;
  } catch (e) { /* Seite nicht erreichbar oder kaputt → neu suchen */ }
  if (age < STALE_MIN) return `Tipps sind ${Math.round(age)} Min. alt – nichts zu tun.`;
  const url = `https://api.github.com/repos/${REPO}/actions/workflows/tips.yml/dispatches`;
  const head = { Authorization: 'Bearer ' + env.GITHUB_TOKEN, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': UA, 'Content-Type': 'application/json' };
  let r = await fetch(url, { method: 'POST', headers: head, body: JSON.stringify({ ref: 'main', inputs: { via: 'zeitgeber' } }) });
  if (r.status === 422) r = await fetch(url, { method: 'POST', headers: head, body: JSON.stringify({ ref: 'main' }) }); // tips.yml noch ohne Eingabe „via“
  const why = Number.isFinite(age) ? `Tipps waren ${Math.round(age)} Min. alt` : 'Tipps nicht lesbar';
  return r.status === 204 ? `Tipp-Suche gestartet (${why}).` : `GitHub hat abgelehnt: ${r.status} ${(await r.text()).slice(0, 160)}`;
}

// ------------------------------------------------------------------ Wettschein lesen (Gemini liest nur ab – gerechnet wird in der App)
function today() {
  try { return new Date().toLocaleDateString('de-DE', { timeZone: 'Europe/Berlin', weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' }); } catch (e) { return new Date().toISOString().slice(0, 10); }
}
const betPrompt = () => `Du bist der Wettschein-Leser der App „Result AI“. Heute ist ${today()}.
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
const S = (type, extra) => Object.assign({ type }, extra);
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
  const { data, model } = await gemini(env, [{ text: betPrompt() }, { inlineData: { mimeType: mime, data: img } }], BET_SCHEMA);
  return { ok: true, model, bet: cleanBet(data) };
}
const num = (x, lo, hi) => {
  const v = typeof x === 'string' ? parseFloat(x.replace(',', '.')) : x;
  return typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi ? Math.round(v * 100) / 100 : null;
};
const str = (x, n = 80) => (typeof x === 'string' && x.trim() ? x.trim().slice(0, n) : null);
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
