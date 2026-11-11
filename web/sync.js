/* Wettbuch – Abgleich zwischen Handy und iPad (Niklas, 10.11.2026: „sodass man am iPad und Handy bei Wetten und so überall wirklich
   1 zu 1 das Gleiche hat“). Die App speichert alles im Browser (localStorage, ra_…). Mit Konto schickt sie die Daten als ein Dokument
   an den Server (worker/worker.js, /sync) und holt dort, was das andere Gerät geändert hat. Zusammengeführt wird hier – ohne Server-Logik:
     Listen (Wetten, Scans, KI-Protokoll, alter Verlauf): je Eintrag (id) gewinnt die neuere Änderung; gelöschte Wetten bleiben 180 Tage als
       gelöscht vermerkt, damit sie nicht vom anderen Gerät zurückkommen. Derselbe Wettschein auf beiden Geräten gescannt → nur einmal.
     Einzelwerte (Kasse, Limits, Name, Darstellung, Einladungscode, zuletzt gewählte Teams): die neuere Änderung gewinnt.
   Nur auf diesem Gerät bleiben: Handy-/iPad-Ansicht, Anmeldung, Abgleich-Stand und die Test-Adresse.
   Jede Änderung bekommt einen Zeitstempel (stamp), sobald die App sie speichert. Die Regeln prüft tests/sync.test.js. */
(function (root, factory) {
  const RS = factory();
  if (typeof module === 'object' && module.exports) module.exports = RS;
  else root.RS = RS;
}(typeof self !== 'undefined' ? self : this, () => {
  'use strict';
  const LISTS = { bets: 500, history: 50, scans: 10, kilog: 120 }; // Listen mit id → höchstens so viele Einträge
  const TOMB = { bets: true }; // nur hier wird Löschen weitergegeben (Scans, Protokoll und Verlauf werden nur gekürzt)
  const KEYS = ['wallet', 'limits', 'name', 'theme', 'mlook', 'invite', 'recentTeams'];
  const DEAD_MS = 180 * 864e5;
  const isSynced = (k) => k in LISTS || KEYS.includes(k);
  const json = (v) => JSON.stringify(v === undefined ? null : v);
  // mit sortierten Schlüsseln: gleicher Inhalt = gleicher Text, egal in welcher Reihenfolge ein Gerät die Felder gespeichert hat
  const canon = (v) => JSON.stringify(v === undefined ? null : v, (k, x) => (x && typeof x === 'object' && !Array.isArray(x)
    ? Object.keys(x).sort().reduce((o, kk) => { o[kk] = x[kk]; return o; }, {}) : x));
  const atOf = (it) => (it.v && typeof it.v.at === 'number' ? it.v.at : 0);
  const order = (x, y) => (atOf(y) - atOf(x)) || (String(y.v.id) < String(x.v.id) ? -1 : String(y.v.id) > String(x.v.id) ? 1 : 0); // neueste zuerst
  const emptyMeta = () => ({ v: 0, k: {}, i: {}, d: {} });
  function fixMeta(m) {
    m = m && typeof m === 'object' ? m : emptyMeta();
    if (!Number.isInteger(m.v)) m.v = 0;
    ['k', 'i', 'd'].forEach((x) => { if (!m[x] || typeof m[x] !== 'object') m[x] = {}; });
    return m;
  }
  const asList = (x) => (Array.isArray(x) ? x.filter((it) => it && typeof it === 'object' && it.id != null) : []);

  // eine lokale Änderung vermerken: Einzelwert → Zeitstempel; Liste → je geändertem Eintrag, gelöschte Wetten als „gelöscht“
  function stamp(meta, key, oldVal, newVal, now) {
    const m = fixMeta(meta);
    if (KEYS.includes(key)) { m.k[key] = now; return m; }
    if (!(key in LISTS)) return m;
    const before = new Map(asList(oldVal).map((it) => [String(it.id), json(it)]));
    const after = asList(newVal);
    const iu = (m.i[key] = m.i[key] || {});
    const dead = (m.d[key] = m.d[key] || {});
    const ids = new Set();
    after.forEach((it) => {
      const id = String(it.id);
      ids.add(id);
      if (before.get(id) !== json(it)) { iu[id] = now; delete dead[id]; }
    });
    before.forEach((_, id) => {
      if (ids.has(id)) return;
      delete iu[id];
      if (TOMB[key]) dead[id] = now;
    });
    Object.keys(iu).forEach((id) => { if (!ids.has(id)) delete iu[id]; });
    return m;
  }

  // Dokument für den Server aus den lokalen Daten (read(key) liefert den gespeicherten Wert)
  function build(read, meta) {
    const m = fixMeta(meta);
    const doc = { f: 1, k: {}, l: {} };
    KEYS.forEach((k) => {
      const v = read(k);
      const u = m.k[k] || 0;
      if (v != null || u) doc.k[k] = { u, v: v == null ? null : v };
    });
    Object.keys(LISTS).forEach((k) => {
      const iu = m.i[k] || {};
      const items = asList(read(k)).map((it) => ({ u: iu[String(it.id)] || 0, v: it })).sort(order).slice(0, LISTS[k]);
      doc.l[k] = { i: items, d: TOMB[k] ? Object.assign({}, m.d[k] || {}) : {} };
    });
    return doc;
  }

  const newer = (x, y) => (x.u !== y.u ? x.u > y.u : canon(x.v) > canon(y.v)); // gleicher Zeitstempel: fest nach Inhalt (beide Geräte gleich)
  function cleanDoc(d) {
    d = d && typeof d === 'object' ? d : {};
    return { k: d.k && typeof d.k === 'object' ? d.k : {}, l: d.l && typeof d.l === 'object' ? d.l : {} };
  }
  // zwei Stände zusammenführen – egal in welcher Reihenfolge, es kommt dasselbe heraus
  function merge(a, b, now) {
    const A = cleanDoc(a);
    const B = cleanDoc(b);
    const t = now || Date.now();
    const out = { f: 1, k: {}, l: {} };
    KEYS.forEach((k) => {
      const x = A.k[k];
      const y = B.k[k];
      const ok = (z) => z && typeof z === 'object' && 'v' in z;
      if (ok(x) && ok(y)) out.k[k] = newer(x, y) ? x : y;
      else if (ok(x) || ok(y)) out.k[k] = ok(x) ? x : y;
      if (out.k[k]) out.k[k] = { u: Number(out.k[k].u) || 0, v: out.k[k].v };
      if (out.k[k] && out.k[k].v == null && !out.k[k].u) delete out.k[k];
    });
    Object.keys(LISTS).forEach((k) => {
      const la = A.l[k] || {};
      const lb = B.l[k] || {};
      const dead = {};
      [la.d, lb.d].forEach((d) => {
        Object.keys(d && typeof d === 'object' ? d : {}).forEach((id) => {
          const u = Number(d[id]) || 0;
          if (t - u < DEAD_MS) dead[id] = Math.max(dead[id] || 0, u);
        });
      });
      const items = new Map();
      [].concat(Array.isArray(la.i) ? la.i : [], Array.isArray(lb.i) ? lb.i : []).forEach((it) => {
        if (!it || !it.v || typeof it.v !== 'object' || it.v.id == null) return;
        const x = { u: Number(it.u) || 0, v: it.v };
        const id = String(it.v.id);
        const prev = items.get(id);
        if (!prev || newer(x, prev)) items.set(id, x);
      });
      items.forEach((it, id) => {
        if (dead[id] != null && dead[id] >= it.u) items.delete(id); // gelöscht, danach nicht mehr geändert
        else delete dead[id]; // nach dem Löschen noch geändert → bleibt
      });
      let list = [...items.values()];
      if (k === 'bets') { // derselbe Wettschein (bzw. alte Top-Tipp-Wette) auf zwei Geräten gespeichert: der zuerst gespeicherte bleibt
        const dup = (v) => ((v.auto || v.src === 'scan') && v.key ? v.src + '|' + v.key : null);
        const keep = new Map();
        list.forEach((it) => {
          const key = dup(it.v);
          if (!key) return;
          const o = keep.get(key);
          if (!o || atOf(it) < atOf(o) || (atOf(it) === atOf(o) && String(it.v.id) < String(o.v.id))) keep.set(key, it);
        });
        list = list.filter((it) => {
          const key = dup(it.v);
          if (!key || keep.get(key) === it) return true;
          dead[String(it.v.id)] = Math.max(dead[String(it.v.id)] || 0, it.u);
          return false;
        });
      }
      list.sort(order);
      out.l[k] = { i: list.slice(0, LISTS[k]), d: TOMB[k] ? dead : {} };
    });
    return out;
  }

  // Dokument → Werte zum Speichern + Zeitstempel (v = Server-Version bleibt beim Aufrufer)
  function unpack(doc) {
    const d = cleanDoc(doc);
    const values = {};
    const meta = emptyMeta();
    KEYS.forEach((k) => {
      const x = d.k[k];
      values[k] = x && 'v' in x ? x.v : undefined;
      if (x && x.u) meta.k[k] = x.u;
    });
    Object.keys(LISTS).forEach((k) => {
      const l = d.l[k] || {};
      const items = Array.isArray(l.i) ? l.i.filter((it) => it && it.v && it.v.id != null) : [];
      values[k] = items.map((it) => it.v);
      meta.i[k] = {};
      items.forEach((it) => { if (it.u) meta.i[k][String(it.v.id)] = it.u; });
      meta.d[k] = Object.assign({}, l.d || {});
    });
    return { values, meta };
  }
  // gleicher Inhalt? (für „muss hochgeladen werden?“)
  const same = (a, b) => canon(cleanDoc(a)) === canon(cleanDoc(b));
  // gibt es auf diesem Gerät schon eigene Daten? (vor der ersten Anmeldung fragen, was passieren soll)
  const hasData = (read) => asList(read('bets')).length > 0 || asList(read('history')).length > 0 || asList(read('scans')).length > 0 || asList(read('kilog')).length > 0
    || (read('wallet') != null && json(read('wallet')) !== '{}');

  // Konto-Stand auf dieses Gerät schreiben (ohne neue Zeitstempel); changed sammelt, was sich geändert hat
  function apply(io, doc, changed) {
    const { values, meta } = unpack(doc);
    KEYS.concat(Object.keys(LISTS)).forEach((k) => {
      const v = values[k] === undefined ? null : values[k];
      const cur = io.read(k);
      if (canon(cur === undefined ? null : cur) === canon(v)) return;
      if (v == null && (cur == null || (Array.isArray(cur) && !cur.length))) return;
      io.write(k, v);
      changed.add(k);
    });
    const cur = fixMeta(io.meta());
    meta.v = cur.v;
    meta.dirty = cur.dirty || 0;
    if (cur.user) meta.user = cur.user;
    io.setMeta(meta);
  }
  function finish(io, v, gen) {
    const m = fixMeta(io.meta());
    m.v = v;
    m.dirty = Math.max(0, (m.dirty || 0) - gen);
    m.last = io.now();
    io.setMeta(m);
    return m.dirty > 0;
  }
  /* Ein Abgleich: holen → zusammenführen → auf dem Gerät speichern → hochladen. Hat ein anderes Gerät inzwischen gespeichert (409),
     wird mit dessen Stand neu zusammengeführt (höchstens 4 Versuche).
     io: read(k), write(k, v) ohne Zeitstempel, meta(), setMeta(m), req(method, path, body) → Antwort des Servers, now()
     mode: leer = normal · 'replace' = nur die Daten vom Konto nehmen · 'merge' = erste Anmeldung: Listen zusammen, Einzelwerte vom Konto
     first: schon geholte Antwort von GET /sync (nach der Anmeldung) */
  async function run(io, mode, first) {
    const changed = new Set();
    let m = fixMeta(io.meta());
    let r = first || await io.req('GET', '/sync' + (m.v && !mode ? '?v=' + m.v : ''));
    for (let attempt = 0; attempt < 4; attempt++) {
      if (!r || !r.ok) return { ok: false, res: r, changed };
      m = fixMeta(io.meta());
      const gen = m.dirty || 0;
      const mine = mode === 'merge' ? Object.assign({}, m, { k: {} }) : m; // erste Anmeldung: Name, Guthaben … kommen vom Konto
      const local = build(io.read, mine);
      let doc = local;
      if (!r.same && r.data) doc = mode === 'replace' ? merge(r.data, null, io.now()) : merge(local, r.data, io.now());
      if (!r.same) apply(io, doc, changed);
      const base = r.same ? m.v : Number(r.v) || 0;
      const put = r.same ? gen > 0 || mode : !(r.data && same(doc, r.data));
      if (!put) return { ok: true, changed, again: finish(io, base, gen), v: base };
      const p = await io.req('PUT', '/sync', { base, data: doc });
      if (p && p.ok) return { ok: true, changed, again: finish(io, p.v, gen), v: p.v, put: true };
      if (!p || !p.conflict) return { ok: false, res: p, changed };
      r = { ok: true, v: p.v, data: p.data }; // ein anderes Gerät war schneller: dessen Stand dazunehmen
      mode = undefined;
    }
    return { ok: false, res: { error: 'Gerade ändern zu viele Geräte gleichzeitig – gleich noch mal.' }, changed };
  }
  return { LISTS, KEYS, isSynced, stamp, build, merge, unpack, same, hasData, emptyMeta, fixMeta, canon, run };
}));
