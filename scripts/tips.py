"""Top-Tipps: kommende Spiele → Chance jeder Wette → beste Tipps + Kombis. Quoten-Anzeige nur von Tipico (scripts/tipico.py, ohne
Schlüssel „k. A.“); die Marktdaten von ESPN fließen nur in die Chance ein und werden nie als Quote angezeigt.
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
import re
import sys
import time
from datetime import datetime, timedelta, timezone

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import activity  # noqa: E402  (Protokoll für die KI-Zentrale)
import forecast as fc  # noqa: E402
import nations as nt  # noqa: E402  (Wettbewerbe der Nationalteams)
import ratings as rt  # noqa: E402  (get, ESPN, pick_color – gleiche Regeln wie der Stärken-Rechner)
import tipico  # noqa: E402  (Quoten von Tipico über The Odds API)

RATINGS = os.path.join(rt.ROOT, 'web', 'data', 'ratings.json')
OUT = os.path.join(rt.ROOT, 'web', 'data', 'tips.json')
LOG = os.path.join(rt.ROOT, 'web', 'data', 'tips_log.json')
PUBLISHED = 'https://sneaxx141108-gif.github.io/result-ai/data/tips.json'  # die zuletzt veröffentlichte Suche
NOW = datetime.now(timezone.utc)
DAYS = 21         # 3 Wochen voraus: so ist der nächste Spieltag von Champions/Europa/Conference League immer dabei (Niklas)
KEEP_DAYS = 31    # so lange bleibt die Bilanz (die App zeigt die letzten 30 Tage)
MARGIN = 0.06     # typische Buchmacher-Marge → nur zum Einordnen, wo keine Quote bekannt ist (Doppelchance, Beide treffen …), wird nie angezeigt
FM_LIGA3 = 208    # FotMob-Liga-ID der 3. Liga
MODEL_ONLY = {'ger.3'}  # Ligen ohne Marktdaten: Chance aus den Team-Stärken von Result AI
# Feinabgleich der aus Quoten gerechneten Tor-Wetten (Backtest 08.11.2026, 48.603 Spiele; in drei Test-Saisons immer besser), wie in engine.js
CAL = {'BY': (0.0615, 0.923), 'HS': (-0.0119, 1.0616), 'AS': (0.0599, 1.0035)}
MIN_Q = 1.12      # kleinere Quoten lohnen nicht (z. B. „Über 0,5 Tore“)
SAFE = (0.70, 1.20)  # Liste „Sicher“: Chance ab 70 %, Quote ab 1,20
TOP = (0.50, 1.60)   # Liste „Top-Quote“: Chance über 50 %, Quote ab 1,60
# Liste „Empfohlen“ (Niklas, 06.11.2026: „Spiele, die die KI empfiehlt wegen guter Quoten und halbwegs guter Erfolgsquote“):
# echte Buchmacher-Quote ab 1,50, Chance ab 55 % – und Result AI sieht die Wette mindestens so gut wie der Buchmacher (höchstens
# 2 Punkte darunter). Gereiht nach vorsichtigerer Chance × Quote. Kein Versprechen: auch hier geht fast jeder zweite Tipp schief.
REC = (0.55, 1.50)
REC_GAP = 0.02
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


def calibrate(code, p):
    a, b = CAL[code]
    x = a + b * math.log(p / (1 - p))
    return 1 / (1 + math.exp(-x))


def probs(m, market=False):
    """Chance jeder Wette aus der Ergebnis-Matrix (Tormodell); market = aus Quoten gerechnet → Feinabgleich der Tor-Wetten."""
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
    if market:
        for c in ('BY', 'HS', 'AS'):
            p[c] = calibrate(c, p[c])
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


def last_search():
    """Die zuletzt veröffentlichte Suche – der Vergleich für die KI-Zentrale. Die Datei im Repository taugt dafür nicht: sie wird
    nicht mehr gespeichert und bleibt alt (06.–08.11.2026 galten dadurch stündlich rund 200 Tipps als „neu“). Nicht erreichbar
    → None: dann meldet dieser Lauf lieber keine Zahlen als falsche."""
    try:
        d = json.loads(rt.get('%s?nc=%d' % (PUBLISHED, time.time()), timeout=30, retries=1))
        return d if isinstance(d, dict) and d.get('updatedAt') else None
    except (RuntimeError, ValueError) as e:
        log('  Letzte Suche nicht lesbar (%s) – diesmal kein Vergleich für die KI-Zentrale.' % e)
        return None


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
    legs, p = [], 1.0
    for c in pool:
        if p * c['p'] < min_p:
            continue
        legs.append(c)
        p *= c['p']
        if len(legs) == max_legs:
            break
    if len(legs) < 2:
        return None
    q = None  # Gesamtquote nur, wenn jede Einzelquote von Tipico bekannt ist
    if all(c['q'] for c in legs):
        q = 1.0
        for c in legs:
            q *= c['q']
        q = round(q, 2)
    return {'legs': [{'g': c['g'], 'm': c['m']} for c in legs], 'p': round(p, 4), 'q': q}


def odds_from(q):
    """Tipico-Quoten -> Chancen ohne Marge fürs Tormodell (für Spiele, die ESPN nicht mit Quoten führt)."""
    if not all(k in q for k in ('H', 'D', 'A')):
        return None
    ph, pd, pa = fc.devig([1 / q['H'], 1 / q['D'], 1 / q['A']])
    od = {'ph': ph, 'pd': pd, 'pa': pa}
    for line in (2.5, 1.5, 3.5):
        k = '%d' % round(line * 10)
        if 'O' + k in q and 'U' + k in q:
            od.update(line=line, pover=fc.devig([1 / q['O' + k], 1 / q['U' + k]])[0])
            break
    return od


def fotmob_games(rd, results):
    """3. Liga (ESPN führt sie nicht): kommende Spiele und Ergebnisse von der normalen FotMob-Seite (erlaubt, wie in ratings.py).
    Gerechnet wird mit den Team-Stärken von Result AI, sobald Tipico-Quoten da sind mit denen."""
    by_id = {t['id']: t for t in rd['teams']}
    by_name = {}
    for t in rd['teams']:
        if t.get('lg') in ('ger.1', 'ger.2', 'ger.3'):
            for n in (t.get('alias') or []) + [t['name']]:
                by_name.setdefault(rt.slug(n), t)
    try:
        pp = rt.fm_page(FM_LIGA3)
    except Exception as e:  # noqa: BLE001  (FotMob kurz weg: die anderen Ligen laufen weiter)
        log('  3. Liga (FotMob): %s' % e)
        return []
    out = []

    def team(x):
        r = by_id.get('fm:%s' % x.get('id')) or by_name.get(rt.slug(x['name']))
        return {'id': r['id'] if r else 'fm:%s' % x.get('id'), 'name': (r or {}).get('name') or x['name'],
                'short': x.get('shortName') if x.get('shortName') != x['name'] else None,
                'logo': rt.FM_LOGO % x.get('id'), 'color': (r or {}).get('color')}
    for m in ((pp.get('fixtures') or {}).get('allMatches') or []):
        st = m.get('status') or {}
        h, a = m.get('home') or {}, m.get('away') or {}
        if not st.get('utcTime') or st.get('cancelled') or st.get('awarded') or not h.get('name') or not a.get('name'):
            continue
        gid = 'fmg:%s' % m.get('id')
        if st.get('finished'):
            sc = re.match(r'\s*(\d+)\s*-\s*(\d+)', st.get('scoreStr') or '')
            if sc:
                results[gid] = (int(sc.group(1)), int(sc.group(2)))
            continue
        t = when(st['utcTime'])
        if st.get('started') or not t or not (NOW < t < NOW + timedelta(days=DAYS)):
            continue
        out.append({'id': gid, 'slug': 'ger.3', 'comp': '3. Liga', 't': t, 'date': t.strftime('%Y-%m-%dT%H:%MZ'), 'neutral': False,
                    'home': team(h), 'away': team(a), 'od': None, 'sig': {}})
    return out


def main():
    t0 = time.time()
    rd = json.load(open(RATINGS, encoding='utf-8'))
    teams = {t['id']: t for t in rd['teams']}
    md = rd['model']
    nat_md = rd.get('natModel')  # Nationalteams haben ihr eigenes Tor-Niveau und ihren eigenen Heimvorteil
    names = {L['id']: L['name'] for L in rd['leagues'] if L.get('src') not in ('fotmob', 'nat')}  # FotMob-Ligen hat ESPN nicht
    names.update(CUPS)
    names.update({slug: v[0] for slug, v in nt.COMPS.items()})  # WM, EM, Nations League, Qualifikationen, Länderspiele
    prev = last_search()  # für die KI-Zentrale und die zuletzt bekannten Tipico-Quoten

    raw, results = [], {}
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
            if ev['state'] != 'pre' or not t or not (NOW < t < NOW + timedelta(days=DAYS)):
                continue
            comp = (e.get('competitions') or [{}])[0]
            side = {c.get('homeAway'): c for c in comp.get('competitors') or []}
            raw.append({'id': ev['id'], 'slug': slug, 'comp': names[slug], 't': t, 'date': ev['date'], 'neutral': ev['neutral'],
                        'home': team_of(side['home']), 'away': team_of(side['away']), 'od': ev['odds'], 'sig': real_odds(comp) if ev['odds'] else {}})
    raw += fotmob_games(rd, results)
    tq, tip_st = tipico.refresh(raw, prev, NOW, when, log)
    for r in raw:  # Länder auf Deutsch und in den korrigierten Farben (erst jetzt: der Abgleich mit Tipico braucht die englischen Namen)
        for side in ('home', 'away'):
            t = teams.get(r[side]['id'])
            if t and t.get('nat'):
                r[side].update(name=t['name'], short=None, color=t.get('color') or r[side].get('color'))

    games, compact, cands = {}, [], []
    for r in raw:
        gid = r['id']
        # zweite Meinung: Result AI allein (nur wenn beide Teams bekannt und vergleichbar sind)
        th, ta = teams.get(r['home']['id']), teams.get(r['away']['id'])
        lm = None
        # nur mit genug Liga-Spielen: Teams, die Result AI bloß aus ein paar Europapokal-Spielen kennt (n = 0, z. B.
        # Ararat-Armenia), bekämen sonst absurde Werte (Torreense–Ararat: 5,8 erwartete Tore)
        if th and ta and th['grp'] == ta['grp'] and th.get('n', 0) >= 5 and ta.get('n', 0) >= 5 and (not th.get('nat') or nat_md):
            mx = nat_md if th.get('nat') else md
            hv = 0.0 if r['neutral'] else mx['h']
            lm = (math.exp(mx['mu'] + hv + th['att'] - ta['def']), math.exp(mx['mu'] + ta['att'] - th['def']))
        tipq = (tq.get(gid) or {}).get('q') or {}
        od = r['od'] or odds_from(tipq)
        if od:  # Chance aus den Quoten des Marktes (genauer als jedes Modell) – angezeigt werden davon nur die Chancen
            lh, la = fc.market_lambdas(od, quick=True)
            p = probs(fc.score_matrix(lh, la), market=True)
            pm = probs(fc.score_matrix(*lm)) if lm else None
        elif r['slug'] in MODEL_ONLY and lm:  # z. B. 3. Liga: keine Quoten bekannt → Team-Stärken von Result AI
            lh, la = lm
            p = probs(fc.score_matrix(lh, la))
            pm = None
        else:
            continue
        line = next((x for x in (2.5, 1.5, 3.5) if 'O%d' % round(x * 10) in tipq and 'U%d' % round(x * 10) in tipq), None)
        games[gid] = {'id': gid, 'slug': r['slug'], 'comp': r['comp'], 't': r['date'], 'neutral': r['neutral'],
                      'home': r['home'], 'away': r['away'], 'lh': round(lh, 3), 'la': round(la, 3),
                      'mlh': round(lm[0], 3) if lm else None, 'mla': round(lm[1], 3) if lm else None,
                      'odds': tipq, 'line': line, 'at': (tq.get(gid) or {}).get('at')}
        if not od:
            games[gid]['mo'] = True  # nur Result AI, kein Markt
        compact.append([gid, r['slug'], r['date'], r['comp'], r['home']['id'], r['away']['id'], r['home']['name'], r['away']['name'], round(lh, 3), round(la, 3), 0 if od else 1])
        for code in CODES:
            pc = p[code]
            price = tipq.get(code)        # Tipico – das Einzige, was als Quote angezeigt wird
            sig = r['sig'].get(code)      # andere Buchmacher: nur fürs Einordnen, wird nie angezeigt
            rank = price or sig or max(1.01, 1 / (pc * (1 + MARGIN)))
            if pc < 0.40 or rank < MIN_Q:
                continue
            # Reihenfolge der Listen (angezeigt wird immer die Markt-Chance p): „Sicher“ nimmt Result AI zu einem Viertel
            # dazu – bei gleicher Chance steht oben, wo Result AI noch sicherer ist. „Top-Quote“ rechnet mit der vorsichtigeren
            # der beiden Chancen.
            pmc = pm[code] if pm else None
            cands.append({'g': gid, 'm': code, 'p': round(pc, 4), 'q': round(price, 2) if price else None, 'qr': round(rank, 2), 'real': bool(price), 'known': bool(price or sig),
                          'pm': round(pmc, 4) if pmc is not None else None,
                          'sure': pc + max(-0.08, min(0.08, 0.25 * (pmc - pc))) if pmc is not None else pc - 0.03,
                          'conf': min(pc, pmc) if pmc is not None else pc - 0.05})
    log('%d kommende Spiele, %d mit Tipico-Quoten, %d mögliche Tipps, %d Ergebnisse (%.0f s)' % (len(games), len(tq), len(cands), len(results), time.time() - t0))

    # je Spiel höchstens ein Tipp pro Liste. „Sicher“: Chance ab 70 % bei Quote ab 1,20, gereiht nach der vorsichtigeren
    # Chance (echte Quote minimal bevorzugt). „Top-Quote“: Quote ab 1,60 bei über 50 % Chance, gereiht nach vorsichtiger
    # Chance × Quote. (Nur nach der Buchmacher-Chance zu reihen ergäbe lauter Tipps genau an der Grenze – die geschätzte
    # Quote hängt ja direkt an der Chance.)
    def best(lo_p, lo_q, key, pool=None, n=90):
        out = {}
        for c in cands if pool is None else pool:
            if c['p'] >= lo_p and c['qr'] >= lo_q:
                k = key(c)
                if c['g'] not in out or k > out[c['g']][0]:
                    out[c['g']] = (k, c)
        return [c for k, c in sorted(out.values(), key=lambda kc: (kc[0], kc[1]['p']), reverse=True)][:n]
    safe = best(*SAFE, key=lambda c: (round(c['sure'], 3), c['known']))
    top = best(*TOP, key=lambda c: (round(c['conf'] * c['qr'], 3), c['known']))
    rec = best(*REC, key=lambda c: round(c['conf'] * c['qr'], 3), n=60,
               pool=[c for c in cands if c['known'] and c['pm'] is not None and c['pm'] >= c['p'] - REC_GAP])
    # Kombis bevorzugt aus Spielen der nächsten 36 Stunden (heute/morgen spielbar)
    soon = lambda lst: [c for c in lst if when(games[c['g']]['t']) < NOW + timedelta(hours=36)]  # noqa: E731
    kombis = [k for k in (dict(kombi(soon(safe), 0.45, 3) or kombi(safe, 0.45, 3) or {}, name='Sichere Kombi', kind='safe'),
                          dict(kombi(soon(top), 0.30, 3) or kombi(top, 0.30, 3) or {}, name='Top-Kombi', kind='top')) if k.get('legs')]

    # Kombis für den nächsten Spieltag der Champions League und der Bundesliga (aus den sicheren Tipps)
    def comp_kombi(slug, name, kind):
        pool = [c for c in safe if games[c['g']]['slug'] == slug]
        if len(pool) < 2:
            return None
        first = min(when(games[c['g']]['t']) for c in pool)
        k = kombi([c for c in pool if when(games[c['g']]['t']) < first + timedelta(days=3)], 0.45, 3)
        return dict(k, name=name, kind=kind) if k else None
    kombis += [k for k in (comp_kombi('uefa.champions', 'Champions-League-Kombi', 'cl'), comp_kombi('ger.1', 'Bundesliga-Kombi', 'bl')) if k]

    # Bilanz: Tipps bis zum Anpfiff festhalten, danach auswerten
    try:
        old = json.load(open(LOG, encoding='utf-8')).get('entries', [])
    except (OSError, ValueError):
        old = []
    entries = [e for e in old if when(e['t']) and when(e['t']) <= NOW]  # Anpfiff vorbei: bleibt, wie er war
    for lst, items in (('top', top), ('safe', safe), ('rec', rec)):
        for c in items:
            g = games[c['g']]
            entries.append({'g': c['g'], 'm': c['m'], 'list': lst, 'p': c['p'], 'q': c['q'], 'real': c['real'], 't': g['t'],
                            'comp': g['comp'], 'home': g['home']['name'], 'away': g['away']['name'],
                            'hid': g['home']['id'], 'aid': g['away']['id'], 'res': None})
    fresh = []  # in diesem Lauf ausgewertet (für die KI-Zentrale)
    for e in entries:
        if e.get('res') is None and e['g'] in results:
            x, y = results[e['g']]
            e['res'] = {'hs': x, 'as': y, 'won': won(e['m'], x, y)}
            fresh.append(e)
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

    used = {c['g'] for c in top + safe + rec}
    out = {'updatedAt': NOW.strftime('%Y-%m-%dT%H:%M:%SZ'), 'source': 'ESPN und FotMob', 'days': DAYS,
           'tipico': tip_st, 'tq': tq, 'all': compact,
           'res': {g: list(v) for g, v in results.items() if g.startswith('fmg:')},  # Ergebnisse, die die App nicht selbst abfragen kann
           'games': {g: games[g] for g in sorted(used)},
           'top': [{k: c[k] for k in ('g', 'm', 'p', 'q', 'real', 'pm')} for c in top],
           'safe': [{k: c[k] for k in ('g', 'm', 'p', 'q', 'real', 'pm')} for c in safe],
           'rec': [{k: c[k] for k in ('g', 'm', 'p', 'q', 'real', 'pm')} for c in rec],
           'kombis': kombis,
           'record': {lst: {'7': record(7, lst), '30': record(30, lst)} for lst in ('top', 'safe', 'rec')},
           'recent': recent}
    # KI-Zentrale: was ist seit der letzten Suche neu, weggefallen, verschoben, ausgewertet?
    pg = (prev or {}).get('games') or {}
    prev_tips = {(t['g'], t['m'], lst): t for lst in ('top', 'safe', 'rec') for t in (prev or {}).get(lst, [])
                 if pg.get(t['g']) and when(pg[t['g']]['t']) and when(pg[t['g']]['t']) > NOW}
    cur_tips = {(c['g'], c['m'], lst): c for lst, items in (('top', top), ('safe', safe), ('rec', rec)) for c in items}
    new = sorted((k for k in cur_tips if k not in prev_tips), key=lambda k: (k[2] != 'safe', -cur_tips[k]['p'])) if prev else []
    gone = [k for k in prev_tips if k not in cur_tips]
    moved = [k for k in cur_tips if k in prev_tips and abs(cur_tips[k]['p'] - prev_tips[k]['p']) >= 0.02]
    seen_res, res_info = set(), []
    for e in fresh:
        if (e['g'], e['m']) in seen_res:
            continue
        seen_res.add((e['g'], e['m']))
        res_info.append({'m': e['m'], 'list': e['list'], 'p': e['p'], 'q': e['q'], 'comp': e['comp'], 'h': e['home'], 'a': e['away'],
                         'hid': e['hid'], 'aid': e['aid'], 'won': e['res']['won'], 'score': '%d:%d' % (e['res']['hs'], e['res']['as'])})
    added = []
    for k in new[:24]:
        c, g = cur_tips[k], games[k[0]]
        added.append({'g': k[0], 'm': k[1], 'list': k[2], 'p': c['p'], 'q': c['q'], 'real': c['real'], 'comp': g['comp'], 'kick': g['t'],
                      'h': g['home']['name'], 'a': g['away']['name'], 'hid': g['home']['id'], 'aid': g['away']['id']})
    summary = {'games': len(games), 'safe': len(safe), 'top': len(top), 'rec': len(rec), 'kombis': len(kombis), 'tipico': len(tq) if tip_st.get('connected') else None, 'tf': len(tip_st.get('fetched') or []),
               'checked': len(res_info), 'won': sum(1 for r in res_info if r['won']),
               'via': os.environ.get('RA_VIA') or None}  # wer die Suche gestartet hat: zeitgeber (Cloudflare), github, hand
    if prev:  # ohne Vergleich gibt es keine Zahlen (die App zeigt dann einfach keine)
        summary.update(new=len(new), gone=len(gone), moved=len(moved))
    runs = activity.log_run('tips', NOW, time.time() - t0, summary, {'added': added, 'results': res_info[:30], 'tipico': [{k: x[k] for k in ('comp', 'matched', 'cost')} for x in tip_st.get('fetched') or []]})
    out['ki'] = activity.today_summary(runs, NOW)

    with open(OUT, 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False, separators=(',', ':'))
    with open(LOG, 'w', encoding='utf-8') as f:
        json.dump({'entries': entries}, f, ensure_ascii=False, separators=(',', ':'))
    log('Fertig: %d Top-Tipps, %d sichere, %d empfohlene Tipps, %d Kombis, Bilanz %d Einträge, %.0f s, %d KB' % (
        len(top), len(safe), len(rec), len(kombis), len(entries), time.time() - t0, os.path.getsize(OUT) // 1024))


if __name__ == '__main__':
    main()
