"""Tipico-Quoten (Niklas, 08.11.2026: „Quoten nur von Tipico“) über The Odds API – offizieller Weg mit eigenem Schlüssel.

Tipico selbst schützt seine Seite gegen Programme; das wird nicht umgangen. The Odds API führt Tipico offiziell als Buchmacher
„tipico_de“. Den Schlüssel legt Niklas selbst an (kostenloses Konto) und trägt ihn als GitHub-Secret ODDS_API_KEY ein – er steht nie
im Code, im Chat oder in einem Protokoll. Ohne Schlüssel wird nichts abgerufen, die App zeigt dann „Tipico: k. A.“

Der kostenlose Tarif hat 500 Credits im Monat. Ein Abruf einer Liga (Sieg/Remis/Niederlage + Über/Unter) kostet 2 Credits, ein leerer
Abruf nichts. Deshalb wird gerechnet: Rest der Credits ÷ Rest des Monats = Tagesbudget, Ligen mit baldigen Spielen zuerst, jede
Liga höchstens alle 6 Stunden. Letzte Quoten bleiben stehen (mit Uhrzeit), bis es neue gibt – sie stehen in der veröffentlichten
Tipp-Datei, ein eigener Speicher ist nicht nötig.
"""
import calendar
import json
import os
import urllib.error
import urllib.parse
import urllib.request
from datetime import timedelta

import ratings as rt

API = 'https://api.the-odds-api.com/v4'
BOOK = 'tipico_de'
COST = 2              # Märkte h2h + totals, eine Region
MIN_HOURS = 6         # dieselbe Liga höchstens alle 6 Stunden
LOOK_DAYS = 6         # nur Ligen mit Spielen in den nächsten 6 Tagen abrufen
LINES = (1.5, 2.5, 3.5)
# unser Wettbewerb -> Sport-Schlüssel von The Odds API (Reihenfolge = Wichtigkeit); was dort gerade nicht läuft, wird übersprungen
SPORTS = {
    'ger.1': 'soccer_germany_bundesliga', 'uefa.champions': 'soccer_uefa_champs_league', 'ger.2': 'soccer_germany_bundesliga2',
    'ger.3': 'soccer_germany_liga3', 'ger.dfb_pokal': 'soccer_germany_dfb_pokal',
    'fifa.world': 'soccer_fifa_world_cup', 'uefa.euro': 'soccer_uefa_european_championship', 'uefa.nations': 'soccer_uefa_nations_league',
    'fifa.worldq.uefa': 'soccer_fifa_world_cup_qualifiers_europe', 'uefa.euroq': 'soccer_uefa_euro_qualification',
    'uefa.europa': 'soccer_uefa_europa_league', 'uefa.europa.conf': 'soccer_uefa_europa_conference_league',
    'eng.1': 'soccer_epl', 'esp.1': 'soccer_spain_la_liga', 'ita.1': 'soccer_italy_serie_a', 'fra.1': 'soccer_france_ligue_one',
    'eng.2': 'soccer_efl_champ', 'ned.1': 'soccer_netherlands_eredivisie', 'por.1': 'soccer_portugal_primeira_liga',
    'tur.1': 'soccer_turkey_super_league', 'bel.1': 'soccer_belgium_first_div', 'aut.1': 'soccer_austria_bundesliga',
    'sui.1': 'soccer_switzerland_superleague', 'esp.2': 'soccer_spain_segunda_division', 'ita.2': 'soccer_italy_serie_b',
    'fra.2': 'soccer_france_ligue_two', 'sco.1': 'soccer_spl', 'gre.1': 'soccer_greece_super_league',
    'eng.fa': 'soccer_fa_cup', 'eng.league_cup': 'soccer_england_efl_cup', 'esp.copa_del_rey': 'soccer_spain_copa_del_rey',
    'ita.coppa_italia': 'soccer_italy_coppa_italia', 'fra.coupe_de_france': 'soccer_france_coupe_de_france',
}
# verschiedene Schreibweisen derselben Stadt / desselben Landes
ALIAS = [('köln', 'cologne'), ('koln', 'cologne'), ('münchen', 'munich'), ('munchen', 'munich'), ('nürnberg', 'nuremberg'), ('nurnberg', 'nuremberg'),
         ('gladbach', 'monchengladbach'), ('mönchengladbach', 'monchengladbach'), ('hamburger sv', 'hamburg'), ('hamburg sv', 'hamburg'),
         ('turkiye', 'turkey'), ('türkiye', 'turkey'), ('czechia', 'czech republic'), ('korea republic', 'south korea'), ('united states', 'usa'),
         ('ir iran', 'iran'), ('cote d ivoire', 'ivory coast'), ("côte d'ivoire", 'ivory coast'), ('bosnia and herzegovina', 'bosnia-herzegovina')]


def norm(name):
    s = str(name or '').lower()
    for a, b in ALIAS:
        s = s.replace(a, b)
    return s


def similar(a, b):
    return rt.sim(norm(a), norm(b))


def parse_event(e):
    """Ein Spiel von The Odds API -> Tipico-Quoten {'H','D','A','O25','U25',…}, ohne Tipico-Angebot None."""
    bm = next((b for b in e.get('bookmakers') or [] if b.get('key') == BOOK), None)
    if not bm:
        return None
    q = {}
    for mk in bm.get('markets') or []:
        for o in mk.get('outcomes') or []:
            try:
                price = float(o.get('price'))
            except (TypeError, ValueError):
                continue
            if price <= 1:
                continue
            if mk.get('key') == 'h2h':
                code = 'H' if o.get('name') == e.get('home_team') else 'A' if o.get('name') == e.get('away_team') else 'D' if o.get('name') == 'Draw' else None
                if code:
                    q[code] = round(price, 2)
            elif mk.get('key') == 'totals' and o.get('name') in ('Over', 'Under'):
                try:
                    pt = float(o.get('point'))
                except (TypeError, ValueError):
                    continue
                if pt in LINES:
                    q['%s%d' % (o['name'][0], round(pt * 10))] = round(price, 2)
    return q or None


def match(events, games, when):
    """Spiele von The Odds API unseren Spielen zuordnen: gleiche Anstoßzeit (±3 Std.), Namen ähnlich, je Spiel nur eine Zuordnung.
    -> {Spiel-ID: Quoten}"""
    best = {}
    for e in events:
        q = parse_event(e)
        t = when(e.get('commence_time'))
        if not q or not t:
            continue
        for g in games:
            if abs((g['t'] - t).total_seconds()) > 3 * 3600:
                continue
            h, a = similar(g['home']['name'], e.get('home_team')), similar(g['away']['name'], e.get('away_team'))
            if min(h, a) < 0.34:  # ein Name muss wenigstens entfernt passen
                continue
            s = (h + a) / 2
            if s >= 0.6 and (g['id'] not in best or s > best[g['id']][0]):
                best[g['id']] = (s, q)
    return {gid: q for gid, (_s, q) in best.items()}


def call(path, key, **params):
    """Abruf -> (Antwort, Rest-Credits, gerade verbraucht). Fehler nennen nie die Adresse (darin steckt der Schlüssel)."""
    params['apiKey'] = key
    url = '%s/%s?%s' % (API, path, urllib.parse.urlencode(params))
    try:
        req = urllib.request.Request(url, headers={'User-Agent': rt.UA, 'Accept': 'application/json'})
        with urllib.request.urlopen(req, timeout=30) as r:
            body = json.loads(r.read().decode('utf-8'))
            h = r.headers
    except urllib.error.HTTPError as e:
        raise RuntimeError('HTTP %s' % e.code) from None
    except Exception:  # noqa: BLE001  (nur die Art des Fehlers, keine Adresse)
        raise RuntimeError('nicht erreichbar') from None

    def num(name):
        try:
            return int(float(h.get(name)))
        except (TypeError, ValueError):
            return None
    return body, num('x-requests-remaining'), num('x-requests-last')


def refresh(raw, prev, now, when, log):
    """raw: alle kommenden Spiele [{id, slug, t, home, away}] · prev: zuletzt veröffentlichte Tipp-Datei (oder None).
    -> (tq {Spiel-ID: {'q': Quoten, 'at': Zeit}}, Status für die App)"""
    iso = lambda dt: dt.strftime('%Y-%m-%dT%H:%M:%SZ')  # noqa: E731
    ids = {g['id'] for g in raw}
    tq = {gid: x for gid, x in ((prev or {}).get('tq') or {}).items() if gid in ids}  # letzte bekannte Quoten bleiben stehen
    key = (os.environ.get('ODDS_API_KEY') or '').strip()
    if not key:
        log('Tipico: kein Schlüssel (ODDS_API_KEY) – Quoten bleiben „k. A.“')
        return {}, {'connected': False}
    old = (prev or {}).get('tipico') or {}
    st = {'connected': True, 'at': dict(old.get('at') or {}), 'day': now.strftime('%Y-%m-%d'), 'spent': old.get('spent', 0) if old.get('day') == now.strftime('%Y-%m-%d') else 0,
          'remaining': old.get('remaining'), 'updatedAt': old.get('updatedAt'), 'err': None, 'fetched': []}
    if prev is None:  # ohne die letzte Suche ist unklar, was heute schon verbraucht wurde – lieber nichts ausgeben
        st['err'] = 'Letzte Suche nicht lesbar – diesmal kein Abruf'
        log('Tipico:', st['err'])
        return tq, st
    try:
        sports, remaining, _ = call('sports', key)  # kostet nichts
    except RuntimeError as e:
        st['err'] = str(e)
        log('Tipico: Liste der Ligen %s' % e)
        return tq, st
    if remaining is None:
        st['err'] = 'Rest-Credits unbekannt'
        return tq, st
    active = {s.get('key') for s in sports if s.get('active')}
    days_left = calendar.monthrange(now.year, now.month)[1] - now.day + 1
    allowance = (remaining + st['spent']) // days_left
    avail = allowance - st['spent']
    plan = []
    for slug, sport in SPORTS.items():
        gs = [g for g in raw if g['slug'] == slug and g['t'] < now + timedelta(days=LOOK_DAYS)]
        if sport not in active or not gs:
            continue
        last = when(st['at'].get(sport)) if st['at'].get(sport) else None
        age = (now - last).total_seconds() / 3600.0 if last else 1e9
        if age < MIN_HOURS:
            continue
        soon = (min(g['t'] for g in gs) - now).total_seconds() / 3600.0
        plan.append((soon > 36, -age, slug, sport, gs))
    plan.sort(key=lambda x: x[:2])
    for _soon, _age, slug, sport, gs in plan:
        if avail < COST:
            break
        try:
            events, rem, last = call('sports/%s/odds/' % sport, key, regions='eu', bookmakers=BOOK, markets='h2h,totals', oddsFormat='decimal', dateFormat='iso')
        except RuntimeError as e:
            st['err'] = '%s: %s' % (slug, e)
            log('Tipico: %s %s' % (slug, e))
            if 'HTTP 429' in str(e) or 'HTTP 401' in str(e):
                break  # Kontingent leer oder Schlüssel falsch: nicht weiter versuchen
            continue
        cost = last if last is not None else COST
        st['spent'] += cost
        avail -= cost
        if rem is not None:
            remaining = rem
        st['at'][sport] = iso(now)
        found = match(events, gs, when)
        for gid, q in found.items():
            tq[gid] = {'q': q, 'at': iso(now)}
        st['fetched'].append({'slug': slug, 'events': len(events), 'matched': len(found)})
        log('Tipico: %s – %d Spiele, %d zugeordnet, %d Credits' % (slug, len(events), len(found), cost))
    st['remaining'] = remaining
    st['updatedAt'] = iso(now)
    st['covered'] = len(tq)
    return tq, st
