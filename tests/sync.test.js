// Prüft den Abgleich zwischen Handy und iPad (web/sync.js): zwei Geräte, ein nachgebauter Server mit Versionsnummer wie worker/worker.js.
// node tests/sync.test.js
const RS = require('../web/sync.js');

let fails = 0;
const ok = (cond, msg) => { if (!cond) { fails++; console.log('FEHLER:', msg); } else console.log('ok  ', msg); };
const clone = (x) => (x == null ? x : JSON.parse(JSON.stringify(x)));

// ---- Server wie worker/worker.js: GET ?v=… → same, PUT mit base → 409 mit dem Stand, wenn ein anderes Gerät schneller war
function server() {
  const s = { v: 0, data: null, puts: 0, gets: 0, before: null };
  s.req = async (method, path, body) => {
    if (method === 'GET') {
      s.gets++;
      const q = /\?v=(\d+)/.exec(path);
      if (q && +q[1] === s.v && s.v) return { ok: true, v: s.v, same: true };
      return { ok: true, v: s.v, data: clone(s.data) };
    }
    if (s.before) { const f = s.before; s.before = null; await f(); }
    s.puts++;
    if (!body || body.base !== s.v) return { ok: false, conflict: true, v: s.v, data: clone(s.data), status: 409 };
    if (JSON.stringify(body.data).length > 900000) return { ok: false, error: 'zu groß', status: 413 };
    s.v++;
    s.data = clone(body.data);
    return { ok: true, v: s.v };
  };
  return s;
}
const clock = { t: Date.UTC(2026, 10, 10, 12), tick() { this.t += 1000; return this.t; } };
// ---- ein Gerät: localStorage + store.set wie in app.js (vermerkt jede Änderung)
function device(srv) {
  const ls = {};
  const d = {
    ls,
    get: (k, def) => (k in ls ? JSON.parse(ls[k]) : def),
    set(k, v) {
      const j = JSON.stringify(v);
      const old = ls[k];
      if (old === j) return;
      ls[k] = j;
      if (!RS.isSynced(k)) return;
      const m = RS.stamp(d.get('sync', null), k, old == null ? null : JSON.parse(old), v, clock.tick());
      m.dirty = (m.dirty || 0) + 1;
      ls.sync = JSON.stringify(m);
    },
    io: {
      read: (k) => d.get(k, null),
      write: (k, v) => { if (v == null) delete ls[k]; else ls[k] = JSON.stringify(v); },
      meta: () => d.get('sync', null),
      setMeta: (m) => { ls.sync = JSON.stringify(m); },
      req: (...a) => srv.req(...a),
      now: () => clock.t,
    },
    sync: (mode, first) => RS.run(d.io, mode, first),
    bets: () => d.get('bets', []),
    view: () => RS.KEYS.concat(Object.keys(RS.LISTS)).map((k) => k + '=' + RS.canon(d.get(k, null))).join('\n'),
  };
  return d;
}
let n = 0;
const bet = (extra) => Object.assign({ id: 'b' + (++n), at: clock.tick(), src: 'manual', title: 'Wette ' + n, stake: 10, q: 2, status: 'open', legs: [] }, extra);

(async () => {
  // ---- Bausteine
  let m = RS.stamp(null, 'bets', [{ id: 'a', x: 1 }, { id: 'b', x: 1 }], [{ id: 'a', x: 2 }, { id: 'c', x: 1 }], 500);
  ok(m.i.bets.a === 500 && m.i.bets.c === 500 && m.d.bets.b === 500 && !m.i.bets.b, 'Änderung vermerkt: geändert, neu, gelöscht');
  m = RS.stamp(null, 'history', [{ id: 'a' }, { id: 'b' }], [{ id: 'c' }, { id: 'a' }], 600);
  ok(m.i.history.c === 600 && !m.i.history.a && !(m.d.history || {}).b, 'Verlauf: gekürzt wird nicht als gelöscht weitergegeben');
  m = RS.stamp(null, 'wallet', null, { base: 50 }, 700);
  ok(m.k.wallet === 700, 'Einzelwert bekommt Zeitstempel');
  ok(!RS.isSynced('device') && !RS.isSynced('auth') && !RS.isSynced('sync') && !RS.isSynced('api') && RS.isSynced('bets') && RS.isSynced('theme'), 'Handy/iPad-Ansicht und Anmeldung bleiben auf dem Gerät');
  const da = { k: { name: { u: 5, v: 'A' }, theme: { u: 9, v: 'dark' } }, l: { bets: { i: [{ u: 3, v: { id: 'x', at: 1, s: 1 } }, { u: 4, v: { id: 'y', at: 2 } }], d: { z: 7 } } } };
  const db = { k: { name: { u: 6, v: 'B' }, theme: { u: 9, v: 'auto' } }, l: { bets: { i: [{ u: 8, v: { id: 'x', at: 1, s: 2 } }, { u: 1, v: { id: 'z', at: 3 } }], d: { y: 2 } } } };
  const ab = RS.merge(da, db, 1000);
  ok(RS.canon(ab) === RS.canon(RS.merge(db, da, 1000)), 'Zusammenführen: Reihenfolge egal (beide Geräte rechnen dasselbe)');
  ok(ab.k.name.v === 'B' && ab.k.theme.v === 'dark', 'Einzelwerte: neuere Änderung gewinnt, Gleichstand fest entschieden');
  const ids = ab.l.bets.i.map((x) => x.v.id).join(',');
  ok(ids === 'y,x' && ab.l.bets.i.find((x) => x.v.id === 'x').v.s === 2, `Wetten: neuere Fassung gewinnt, gelöschte bleiben weg, später geänderte bleiben (${ids})`);
  ok(ab.l.bets.d.z === 7 && !ab.l.bets.d.y, 'Löschvermerk bleibt nur, solange er gilt');
  const old = RS.merge({ l: { bets: { i: [], d: { q: 1000 } } } }, null, 1000 + 181 * 864e5);
  ok(!old.l.bets.d.q, 'Löschvermerke älter als 180 Tage fallen weg');

  // ---- Handy erstellt das Konto, iPad meldet sich an
  const srv = server();
  const phone = device(srv);
  const pad = device(srv);
  phone.set('theme', 'dark');
  phone.set('name', 'Niklas');
  phone.set('wallet', { base: 100, at: clock.t, moves: [] });
  phone.set('bets', [bet(), bet()]);
  phone.set('history', [{ id: 'h1', at: clock.tick(), home: 'BVB', away: 'S04' }]);
  phone.set('device', 'phone');
  pad.set('device', 'ipad');
  pad.set('theme', 'light'); // beim ersten Start schreibt die App die Darstellung
  let r = await phone.sync();
  ok(r.ok && srv.v === 1 && srv.data.l.bets.i.length === 2, 'Handy lädt hoch (Version 1)');
  ok(!RS.hasData(pad.io.read), 'iPad hat noch keine eigenen Daten');
  r = await pad.sync('replace');
  ok(r.ok && pad.view() === phone.view(), 'iPad hat danach 1 zu 1 dasselbe wie das Handy');
  ok(pad.get('device') === 'ipad' && phone.get('device') === 'phone', 'Handy/iPad-Ansicht bleibt je Gerät');
  ok(srv.v === 1, 'iPad musste nichts hochladen');

  // ---- beide ändern, nacheinander abgeglichen
  const pb = pad.bets();
  pb[0] = Object.assign({}, pb[0], { status: 'won' });
  pb.unshift(bet({ title: 'vom iPad' }));
  pad.set('bets', pb);
  await pad.sync();
  phone.set('bets', phone.bets().filter((b) => b.id !== pb[2].id)); // Handy löscht die andere alte Wette (noch ohne Abgleich)
  phone.set('name', 'Niklas B');
  r = await phone.sync();
  ok(r.ok && r.changed.has('bets'), 'Handy holt die Änderungen vom iPad');
  await pad.sync();
  ok(pad.view() === phone.view(), 'danach wieder auf beiden gleich');
  const titles = phone.bets().map((b) => `${b.title}:${b.status}`).join(',');
  ok(titles === 'vom iPad:open,Wette 2:won', `gelöscht bleibt gelöscht, gewonnen bleibt gewonnen, neue kommt dazu (${titles})`);
  ok(pad.get('name') === 'Niklas B', 'Name vom Handy auf dem iPad');
  const puts = srv.puts;
  const v0 = srv.v;
  await phone.sync();
  await pad.sync();
  await phone.sync();
  ok(srv.puts === puts && srv.v === v0, 'ohne Änderung kein Hochladen (kein Hin und Her)');

  // ---- gleichzeitig: das iPad lädt hoch, während das Handy schon gespeichert hat → 409 → zusammenführen
  pad.set('bets', [bet({ title: 'iPad gleichzeitig' })].concat(pad.bets()));
  phone.set('wallet', { base: 150, at: clock.t, moves: [] });
  phone.set('bets', [bet({ title: 'Handy gleichzeitig' })].concat(phone.bets()));
  srv.before = () => phone.sync();
  r = await pad.sync();
  ok(r.ok && r.put, 'iPad: 409, neu zusammengeführt, dann gespeichert');
  await phone.sync();
  ok(pad.view() === phone.view() && phone.bets().length === 4, `beide Wetten von gleichzeitig sind da (${phone.bets().length})`);
  ok(pad.get('wallet').base === 150, 'Guthaben vom Handy auf dem iPad');

  // ---- dieselbe Top-Tipp-Wette auf beiden Geräten gespeichert → nur einmal
  phone.set('bets', [bet({ src: 'tip', auto: true, key: '401|H', title: 'Tipp Handy' })].concat(phone.bets()));
  pad.set('bets', [bet({ src: 'tip', auto: true, key: '401|H', title: 'Tipp iPad' })].concat(pad.bets()));
  await phone.sync();
  await pad.sync();
  await phone.sync();
  const tips = phone.bets().filter((b) => b.key === '401|H');
  ok(tips.length === 1 && tips[0].title === 'Tipp Handy' && pad.view() === phone.view(), 'gleicher Top-Tipp doppelt gespeichert: bleibt einmal (der zuerst gespeicherte)');

  // ---- Verlauf: höchstens 50, die neuesten
  phone.set('history', Array.from({ length: 40 }, (_, i) => ({ id: 'p' + i, at: clock.tick() })));
  pad.set('history', Array.from({ length: 40 }, (_, i) => ({ id: 'q' + i, at: clock.tick() })));
  await phone.sync();
  await pad.sync();
  await phone.sync();
  const h = phone.get('history');
  ok(h.length === 50 && h[0].id === 'q39' && h.filter((x) => x.id[0] === 'q').length === 40 && pad.view() === phone.view(), 'Verlauf: zusammen höchstens 50, die neuesten zuerst');

  // ---- erste Anmeldung auf einem Gerät mit eigenen Daten
  const third = device(srv);
  third.set('theme', 'light');
  third.set('bets', [bet({ title: 'vom dritten Gerät' })]);
  ok(RS.hasData(third.io.read), 'drittes Gerät hat eigene Daten → die App fragt');
  const before = phone.bets().length;
  r = await third.sync('merge');
  ok(r.ok && third.get('theme') === 'dark' && third.bets().length === before + 1, 'Zusammenführen: Wetten von beiden, Darstellung vom Konto');
  await phone.sync();
  ok(phone.bets().some((b) => b.title === 'vom dritten Gerät'), 'Wette vom dritten Gerät jetzt auch auf dem Handy');
  const fourth = device(srv);
  fourth.set('bets', [bet({ title: 'soll weg' })]);
  r = await fourth.sync('replace');
  ok(r.ok && fourth.view() === phone.view() && !fourth.bets().some((b) => b.title === 'soll weg'), 'Nur Konto-Daten: eigene Daten werden ersetzt');
  await phone.sync();
  ok(!phone.bets().some((b) => b.title === 'soll weg'), 'ersetzte Daten kommen nicht ins Konto');

  // ---- Server antwortet nicht / Fehler
  const off = device({ req: async () => ({ ok: false, error: 'Keine Verbindung zum Server.' }) });
  off.set('bets', [bet()]);
  r = await off.sync();
  ok(!r.ok && off.bets().length === 1 && JSON.parse(off.ls.sync).dirty === 1, 'ohne Verbindung bleibt alles da und wird später hochgeladen');

  console.log(fails ? `\n${fails} FEHLER` : '\nALLE TESTS OK');
  process.exit(fails ? 1 : 0);
})();
