"""Top-Tipps: kommende Spiele mit Buchmacher-Quoten (ESPN, Quoten von DraftKings) → Chance jeder Wette → beste Tipps + Kombis.
Ohne KI, nur Mathe (Tormodell aus forecast.py). Läuft mehrmals täglich (.github/workflows/tips.yml) → web/data/tips.json.

Woher die Chance kommt (Backtest 05.11.2026, 1.398 + 2.229 echte Spiele mit Schlussquoten):
- wer gewinnt: aus den Quoten – Result AI beizumischen machte es in jedem Test schlechter (1X2-Log-Loss 0,9651 → 0,9846)
- wie viele Tore: aus der Über/Unter-Quote; fehlt sie, aus den Team-Stärken von Result AI (ratings.json)
Jede Wette zeigt dazu die Chance laut Result AI allein als zweite Meinung.
Ehrlich: Buchmacher rechnen ihre Marge ein – kein Tipp ist ein sicherer Gewinn. Die App zeigt, wo die Chance hoch ist.

Bilanz: jeder angezeigte Tipp (Listen „Top“ und „Sicher“) wird mit Chance und Quote bis zum Anpfiff festgehalten
(web/data/tips_log.json) und nach dem Spiel ausgewertet – so sieht man, wie oft die Tipps wirklich aufgingen.
    python scripts/tips.py
"""
import json
import math
import os
import sys
import time
from datetime import datetime, timedelta, timezone

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import forecast as fc  # noqa: E402
import ratings as rt  # noqa: E402  (get, ESPN, pick_color – gleiche Regeln wie der Stärken-Rechner)

RATINGS = os.path.join(rt.ROOT, 'web', 'data', 'ratings.json')
OUT = os.path.join(rt.ROOT, 'web', 'data', 'tips.json')
LOG = os.path.join(rt.ROOT, 'web', 'data', 'tips_log.json')
NOW = datetime.now(timezone.utc)
DAYS = 4          # Tipps für heute und die nächsten 3 Tage
KEEP_DAYS = 45    # so lange bleibt die Bilanz
MARGIN = 0.06     # typische Buchmacher-Marge → geschätzte Quote, wo ESPN keine liefert (Doppelchance, Beide treffen …)
MIN_Q = 1.12      # kleinere Quoten lohnen nicht (z. B. „Über 0,5 Tore“)
SAFE = (0.70, 1.20)  # Liste „Sicher“: Chance ab 70 %, Quote ab 1,20
TOP = (0.50, 1.60)   # Liste „Top-Quote“: Chance über 50 %, Quote ab 1,60
LINES = (1.5, 2.5, 3.5)
CODES = ['H', 'D', 'A', 'HD', 'DA', 'HA', 'O15', 'U15', 'O25', 'U25', 'O35', 'U35', 'BY', 'BN', 'HS', 'AS']
CUPS = {'uefa.champions': 'Champions League', 'uefa.europa': 'Europa League', 'uefa.europa.conf': 'Conference League',
        'ger.dfb_pokal': 'DFB-Pokal', 'eng.fa': 'FA Cup', 'eng.league_cup': 'League Cup', 'esp.copa_del_rey': 'Copa del Rey',
        'ita.coppa_italia': 'Coppa Italia', 'fra.coupe_de_france': 'Coupe de France'}


def log(*a):
    print(*a, flush=True)


def when(s):
    try:
        return datetime.fromisoformat(str(s).replace('Z', '+00:00'))
    except ValueError:
        return None


def american_dec(s):
    """'+250' → 3,50 · '-350' → 1,29 (Dezimalquote wie in Deutschland üblich)."""
    try:
        v = float(str(s).replace('+', ''))
    except (TypeError, ValueError):
        return None
    if v == 0:
        return None
    return round(1 + v / 100.0, 3) if v > 0 else round(1 + 100.0 / -v, 3)


def real_odds(comp):
    """Echte Quoten eines ESPN-Spiels: Sieg/Remis/Niederlage und Über/Unter an der Linie des Buchmachers."""
    o = (comp.get('odds') or [None])[0] or {}

    def price(x):
        x = x or {}
        return (x.get('close') or {}).get('odds') or (x.get('open') or {}).get('odds')
    ml = o.get('moneyline') or {}
    q = {}
    for code, side in (('H', 'home'), ('D', 'draw'), ('A', 'away')):
        v = american_dec(price(ml.get(side)))
        if v and v > 1:
            q[code] = v
    tot = o.get('total') or {}
    try:
        line = float(o.get('overUnder'))
    except (TypeError, ValueError):
        line = None
    if line in LINES:
        k = '%d' % round(line * 10)
        for code, side in (('O', 'over'), ('U', 'under')):
            v = american_dec(price(tot.get(side)))
            if v and v > 1:
                q[code + k] = v
    return q


def probs(m):
    """Chance jeder Wette aus der Ergebnis-Matrix (Tormodell)."""
    n = len(m)
    w, d, l = fc.outcome_probs(m)
    p = {'H': w, 'D': d, 'A': l, 'HD': w + d, 'DA': d + l, 'HA': w + l}
    for line in LINES:
        po = fc.p_over(m, line)
        k = '%d' % round(line * 10)
        p['O' + k], p['U' + k] = po, 1 - po
    p['HS'] = 1 - sum(m[0])                 # Heim trifft mindestens einmal
    p['AS'] = 1 - sum(row[0] for row in m)  # Gast trifft mindestens einmal
    p['BY'] = sum(m[x][y] for x in range(1, n) for y in range(1, n))
    p['BN'] = 1 - p['BY']
    return p


def won(code, x, y):
    if code in ('H', 'D', 'A', 'HD', 'DA', 'HA'):
        r = 'H' if x > y else 'D' if x == y else 'A'
        return r in code
    if code[0] in 'OU' and code[1:].isdigit():
        line = int(code[1:]) / 10.0
        return x + y > line if code[0] == 'O' else x + y < line
    return {'HS': x > 0, 'AS': y > 0, 'BY': x > 0 and y > 0, 'BN': not (x > 0 and y > 0)}[code]


def months():
    ms = {(NOW.year, NOW.month)}
    for dd in (-3, DAYS):  # zurück: Ergebnisse für die Bilanz · vor: Spiele bis zum Ende des Tipp-Zeitraums
        x = NOW + timedelta(days=dd)
        ms.add((x.year, x.month))
    return sorted(ms)


def fetch(slug):
    out = []
    for y, mo in months():
        try:
            d = json.loads(rt.get('%s/%s/scoreboard?dates=%d%02d&limit=500' % (rt.ESPN, slug, y, mo), timeout=30, retries=1))
        except Exception as e:
            log('  %s %d-%02d: %s' % (slug, y, mo, e))
            continue
        out.extend(d.get('events') or [])
        time.sleep(0.2)
    return out


def team_of(c):
    t = c.get('team') or {}
    return {'id': str(t.get('id')), 'name': t.get('displayName') or t.get('name') or '?',
            'short': t.get('shortDisplayName') or t.get('abbreviation'),
            'logo': t.get('logo') or ((t.get('logos') or [{}])[0]).get('href'),
            'color': rt.pick_color(t.get('color'), t.get('alternateColor'))}


def kombi(pool, min_p, max_legs):
    """Kombi aus verschiedenen Spielen: der Reihe nach dazunehmen, solange die Gesamtchance über min_p bleibt."""
    legs, p, q = [], 1.0, 1.0
    for c in pool:
        if p * c['p'] < min_p:
            continue
        legs.append(c)
        p *= c['p']
        q *= c['q']
        if len(legs) == max_legs:
            break
    if len(legs) < 2:
        return None
    return {'legs': [{'g': c['g'], 'm': c['m']} for c in legs], 'p': round(p, 4), 'q': round(q, 2)}


def main():
    t0 = time.time()
    rd = json.load(open(RATINGS, encoding='utf-8'))
    teams = {t['id']: t for t in rd['teams']}
    md = rd['model']
    names = {L['id']: L['name'] for L in rd['leagues']}
    names.update(CUPS)

    games, cands, results = {}, [], {}
    seen = set()
    for slug in list(names):
        for e in fetch(slug):
            ev = fc.norm_event(e)
            if not ev or ev['id'] in seen:
                continue
            seen.add(ev['id'])
            if ev['done']:
                results[ev['id']] = (ev['hs'], ev['as'])
                continue
            t = when(ev['date'])
            if ev['state'] != 'pre' or not t or not (NOW < t < NOW + timedelta(days=DAYS)) or not ev['odds']:
                continue
            comp = (e.get('competitions') or [{}])[0]
            side = {c.get('homeAway'): c for c in comp.get('competitors') or []}
            home, away = team_of(side['home']), team_of(side['away'])
            # zweite Meinung: Result AI allein (nur wenn beide Teams bekannt und vergleichbar sind)
            th, ta = teams.get(home['id']), teams.get(away['id'])
            lm = None
            # nur mit genug Liga-Spielen: Teams, die Result AI bloß aus ein paar Europapokal-Spielen kennt (n = 0, z. B.
            # Ararat-Armenia), bekämen sonst absurde Werte (Torreense–Ararat: 5,8 erwartete Tore)
            if th and ta and th['grp'] == ta['grp'] and th.get('n', 0) >= 5 and ta.get('n', 0) >= 5:
                hv = 0.0 if ev['neutral'] else md['h']
                lm = (math.exp(md['mu'] + hv + th['att'] - ta['def']), math.exp(md['mu'] + ta['att'] - th['def']))
            od = ev['odds']
            if not od.get('line'):
                od = dict(od, total=(lm[0] + lm[1]) if lm else 2.7)  # ohne Über/Unter-Quote: Tore laut Result AI
            lh, la = fc.market_lambdas(od, quick=True)
            p = probs(fc.score_matrix(lh, la))
            pm = probs(fc.score_matrix(*lm)) if lm else None
            q_real = real_odds(comp)
            gid = ev['id']
            games[gid] = {'id': gid, 'slug': slug, 'comp': names[slug], 't': ev['date'], 'neutral': ev['neutral'],
                          'home': home, 'away': away, 'lh': round(lh, 3), 'la': round(la, 3),
                          'mlh': round(lm[0], 3) if lm else None, 'mla': round(lm[1], 3) if lm else None,
                          'odds': {k: round(v, 2) for k, v in q_real.items()}, 'line': od.get('line')}
            for code in CODES:
                pc = p[code]
                real = code in q_real
                q = q_real[code] if real else max(1.01, 1 / (pc * (1 + MARGIN)))
                if pc < 0.40 or q < MIN_Q:
                    continue
                # Reihenfolge der Listen (angezeigt wird immer die Buchmacher-Chance p): „Sicher“ nimmt Result AI zu einem Viertel
                # dazu – bei gleicher Buchmacher-Chance steht oben, wo Result AI noch sicherer ist. „Top-Quote“ rechnet mit der
                # vorsichtigeren der beiden Chancen.
                pmc = pm[code] if pm else None
                cands.append({'g': gid, 'm': code, 'p': round(pc, 4), 'q': round(q, 2), 'real': real,
                              'pm': round(pmc, 4) if pmc is not None else None,
                              'sure': pc + max(-0.08, min(0.08, 0.25 * (pmc - pc))) if pmc is not None else pc - 0.03,
                              'conf': min(pc, pmc) if pmc is not None else pc - 0.05})
    log('%d kommende Spiele mit Quoten, %d mögliche Tipps, %d Ergebnisse (%.0f s)' % (len(games), len(cands), len(results), time.time() - t0))

    # je Spiel höchstens ein Tipp pro Liste. „Sicher“: Chance ab 70 % bei Quote ab 1,20, gereiht nach der vorsichtigeren
    # Chance (echte Quote minimal bevorzugt). „Top-Quote“: Quote ab 1,60 bei über 50 % Chance, gereiht nach vorsichtiger
    # Chance × Quote. (Nur nach der Buchmacher-Chance zu reihen ergäbe lauter Tipps genau an der Grenze – die geschätzte
    # Quote hängt ja direkt an der Chance.)
    def best(lo_p, lo_q, key):
        out = {}
        for c in cands:
            if c['p'] >= lo_p and c['q'] >= lo_q:
                k = key(c)
                if c['g'] not in out or k > out[c['g']][0]:
                    out[c['g']] = (k, c)
        return [c for k, c in sorted(out.values(), key=lambda kc: (kc[0], kc[1]['p']), reverse=True)][:40]
    safe = best(*SAFE, key=lambda c: (round(c['sure'], 3), c['real']))
    top = best(*TOP, key=lambda c: (round(c['conf'] * c['q'], 3), c['real']))
    # Kombis bevorzugt aus Spielen der nächsten 36 Stunden (heute/morgen spielbar)
    soon = lambda lst: [c for c in lst if when(games[c['g']]['t']) < NOW + timedelta(hours=36)]  # noqa: E731
    kombis = [k for k in (dict(kombi(soon(safe), 0.45, 3) or kombi(safe, 0.45, 3) or {}, name='Sichere Kombi', kind='safe'),
                          dict(kombi(soon(top), 0.30, 3) or kombi(top, 0.30, 3) or {}, name='Top-Kombi', kind='top')) if k.get('legs')]

    # Bilanz: Tipps bis zum Anpfiff festhalten, danach auswerten
    try:
        old = json.load(open(LOG, encoding='utf-8')).get('entries', [])
    except (OSError, ValueError):
        old = []
    entries = [e for e in old if when(e['t']) and when(e['t']) <= NOW]  # Anpfiff vorbei: bleibt, wie er war
    for lst, items in (('top', top), ('safe', safe)):
        for c in items:
            g = games[c['g']]
            entries.append({'g': c['g'], 'm': c['m'], 'list': lst, 'p': c['p'], 'q': c['q'], 'real': c['real'], 't': g['t'],
                            'comp': g['comp'], 'home': g['home']['name'], 'away': g['away']['name'],
                            'hid': g['home']['id'], 'aid': g['away']['id'], 'res': None})
    for e in entries:
        if e.get('res') is None and e['g'] in results:
            x, y = results[e['g']]
            e['res'] = {'hs': x, 'as': y, 'won': won(e['m'], x, y)}
    entries = [e for e in entries if when(e['t']) > NOW - timedelta(days=KEEP_DAYS)]
    entries.sort(key=lambda e: e['t'])

    def record(days, lst):
        es = [e for e in entries if e['list'] == lst and e.get('res') and when(e['t']) > NOW - timedelta(days=days)]
        return {'n': len(es), 'won': sum(1 for e in es if e['res']['won']), 'exp': round(sum(e['p'] for e in es), 2)}
    done = [e for e in reversed(entries) if e.get('res')]
    recent, keys = [], set()
    for e in done:  # zuletzt ausgewertet, jeder Tipp nur einmal (stand er in beiden Listen)
        if (e['g'], e['m']) not in keys:
            keys.add((e['g'], e['m']))
            recent.append({k: e[k] for k in ('g', 'm', 'list', 'p', 'q', 't', 'comp', 'home', 'away', 'hid', 'aid', 'res')})
        if len(recent) == 20:
            break

    used = {c['g'] for c in top + safe}
    out = {'updatedAt': NOW.strftime('%Y-%m-%dT%H:%M:%SZ'), 'source': 'ESPN · Quoten von DraftKings', 'days': DAYS,
           'games': {g: games[g] for g in sorted(used)},
           'top': [{k: c[k] for k in ('g', 'm', 'p', 'q', 'real', 'pm')} for c in top],
           'safe': [{k: c[k] for k in ('g', 'm', 'p', 'q', 'real', 'pm')} for c in safe],
           'kombis': kombis,
           'record': {lst: {'7': record(7, lst), '30': record(30, lst)} for lst in ('top', 'safe')},
           'recent': recent}
    with open(OUT, 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False, separators=(',', ':'))
    with open(LOG, 'w', encoding='utf-8') as f:
        json.dump({'entries': entries}, f, ensure_ascii=False, separators=(',', ':'))
    log('Fertig: %d Top-Tipps, %d sichere Tipps, %d Kombis, Bilanz %d Einträge, %.0f s, %d KB' % (
        len(top), len(safe), len(kombis), len(entries), time.time() - t0, os.path.getsize(OUT) // 1024))


if __name__ == '__main__':
    main()
