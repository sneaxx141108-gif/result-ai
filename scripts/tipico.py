"""Tipico-Quoten (Niklas, 08.11.2026: „Quoten nur von Tipico“) über The Odds API – offizieller Weg mit eigenem Schlüssel.

Tipico selbst schützt seine Seite gegen Programme; das wird nicht umgangen. The Odds API führt Tipico offiziell als Buchmacher
„tipico_de“. Den Schlüssel legt Niklas selbst an (kostenloses Konto) und trägt ihn als GitHub-Secret ODDS_API_KEY ein – er steht nie
im Code, im Chat oder in einem Protokoll. Ohne Schlüssel wird nichts abgerufen, die App zeigt dann „Tipico: k. A.“

Der kostenlose Tarif hat 500 Credits im Monat. Ein Abruf kostet 2 Credits und liefert alle Spiele einer Liga, ein leerer Abruf kostet
nichts. Deshalb wird je Spieltag statt je Tag abgerufen (Niklas, 09.11.2026, die Einteilung steht auch in der KI-Zentrale):
  1. Jede Liga einmal, sobald ein Spiel ohne Quote in 36 Stunden beginnt.
  2. Wichtige Ligen und Ligen mit mehreren Top-Tipps kurz vor Anpfiff noch einmal, aber nur mit Credits, die für Punkt 1 nicht gebraucht werden.
  3. Spiele, die noch weiter weg sind, ebenfalls nur mit solchen Credits.
Ligen mit aktuellen Top-Tipps kommen zuerst dran. An vollen Spieltagen darf ein Tag bis zum Dreifachen seines Anteils verbrauchen, ruhige
Tage sparen dafür. Letzte Quoten bleiben stehen (mit Uhrzeit), bis es neue gibt – sie stehen in der veröffentlichten Tipp-Datei.
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
NEAR_H = 36           # ein Spiel ohne Quote, das in 36 Stunden beginnt, löst den Abruf seiner Liga aus
RETRY_H = 20          # fehlt danach noch etwas: frühestens nach 20 Stunden wieder
SECOND_H = 12         # Auffrischung, wenn ein Spiel in 12 Stunden beginnt …
SECOND_AGE = 10       # … und seine Quote mindestens 10 Stunden alt ist
FAR_RETRY_H = 48      # Spiele, die noch weiter weg sind: höchstens alle 2 Tage
LOOK_DAYS = 6         # weiter als 6 Tage voraus wird nie abgerufen
DAY_BURST = 3.0       # ein voller Spieltag darf bis zum Dreifachen seines Tagesanteils verbrauchen
ROUND_DAYS = 7.0      # zurückgelegt wird für einen Abruf je Liga und Woche …
ROUND_MARGIN = 1.1    # … plus 10 % Puffer für englische Wochen
LOG_KEEP = 30         # so viele Abrufe zeigt die KI-Zentrale
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
    'fifa.worldq.conmebol': 'soccer_fifa_world_cup_qualifiers_south_america', 'conmebol.america': 'soccer_conmebol_copa_america',
    'caf.nations': 'soccer_africa_cup_of_nations', 'concacaf.gold': 'soccer_concacaf_gold_cup',
    'eng.3': 'soccer_england_league1', 'eng.4': 'soccer_england_league2', 'den.1': 'soccer_denmark_superliga', 'nor.1': 'soccer_norway_eliteserien',
    'swe.1': 'soccer_sweden_allsvenskan', 'pol.1': 'soccer_poland_ekstraklasa', 'usa.1': 'soccer_usa_mls', 'mex.1': 'soccer_mexico_ligamx',
    'bra.1': 'soccer_brazil_campeonato', 'arg.1': 'soccer_argentina_primera_division', 'jpn.1': 'soccer_japan_j_league', 'chn.1': 'soccer_china_superleague',
    'rus.1': 'soccer_russia_premier_league', 'fin.1': 'soccer_finland_veikkausliiga', 'irl.1': 'soccer_league_of_ireland',
}
# diese Wettbewerbe werden kurz vor Anpfiff noch einmal aufgefrischt
IMPORTANT = {'ger.1', 'ger.2', 'ger.dfb_pokal', 'uefa.champions', 'uefa.europa', 'eng.1', 'esp.1', 'ita.1', 'fra.1', 'uefa.nations', 'fifa.world',
             'uefa.euro', 'fifa.worldq.uefa', 'uefa.euroq'}
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
    """Abruf -> (Antwort, Rest-Credits, gerade verbraucht, insgesamt verbraucht). Fehler nennen nie die Adresse (darin steckt der Schlüssel)."""
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
    return body, num('x-requests-remaining'), num('x-requests-last'), num('x-requests-used')


def explain(err):
    """Fehler in Worten für die KI-Zentrale."""
    s = str(err)
    if 'HTTP 401' in s:
        return 'Schlüssel abgelehnt oder Credits aufgebraucht'
    if 'HTTP 429' in s:
        return 'Zu viele Abrufe auf einmal'
    if 'HTTP 422' in s:
        return 'Diese Liga wird gerade nicht angeboten'
    return 'Anbieter gerade nicht erreichbar'


def hours(a, b):
    return (a - b).total_seconds() / 3600.0


def top_counts(prev):
    """Wie viele Top-Tipps stehen gerade je Liga in der App?"""
    games = (prev or {}).get('games') or {}
    out = {}
    for lst in ('safe', 'rec', 'top'):
        for t in (prev or {}).get(lst) or []:
            slug = (games.get(t.get('g')) or {}).get('slug')
            if slug:
                out[slug] = out.get(slug, 0) + 1
    return out


def by_league(raw, now):
    out = {}
    for g in raw:
        if g['t'] > now:
            out.setdefault(g['slug'], []).append(g)
    return out


def plan_calls(league, tq, at, now, when, tops, active):
    """Welche Ligen sind jetzt dran? Klasse 0 = Spieltag steht an und eine Quote fehlt, 1 = Auffrischung kurz vor Anpfiff,
    2 = Spiele, die noch weiter weg sind. Innerhalb der Klasse: mehr Top-Tipps zuerst, dann das nächste Spiel, dann Wichtigkeit."""
    out = []
    limit = now + timedelta(days=LOOK_DAYS)

    def quote_age(g):
        x = tq.get(g['id']) or {}
        return hours(now, when(x['at'])) if x.get('at') else 1e9

    for order, (slug, sport) in enumerate(SPORTS.items()):
        gs = [g for g in league.get(slug, ()) if g['t'] < limit]
        if sport not in active or not gs:
            continue
        last = when(at[sport]) if at.get(sport) else None
        age = hours(now, last) if last else 1e9
        if age >= RETRY_H and any(g['id'] not in tq and hours(g['t'], now) <= NEAR_H for g in gs):
            cls = 0
        elif (slug in IMPORTANT or tops.get(slug, 0) >= 2) and age >= SECOND_AGE and any(hours(g['t'], now) <= SECOND_H and quote_age(g) >= SECOND_AGE for g in gs):
            cls = 1
        elif age >= FAR_RETRY_H and any(g['id'] not in tq for g in gs):
            cls = 2
        else:
            continue
        out.append((cls, -tops.get(slug, 0), min(hours(g['t'], now) for g in gs), order, slug, sport, gs))
    out.sort(key=lambda x: x[:4])
    return out


def next_up(league, tq, now, active, iso):
    """Welche Ligen sind als Nächstes dran? (für die KI-Zentrale)"""
    out = []
    for slug, sport in SPORTS.items():
        miss = [g for g in league.get(slug, ()) if g['id'] not in tq]
        if sport in active and miss:
            first = min(miss, key=lambda g: g['t'])
            due = first['t'] - timedelta(hours=NEAR_H)
            if due > now:
                out.append((due, first.get('comp') or slug))
    out.sort(key=lambda x: x[0])
    return [{'at': iso(d), 'comp': c} for d, c in out[:4]]


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
          'remaining': old.get('remaining'), 'used': old.get('used'), 'updatedAt': old.get('updatedAt'), 'lastFetch': old.get('lastFetch'), 'err': None, 'fetched': [],
          'log': list(old.get('log') or [])[-LOG_KEEP:], 'total': len(raw), 'offered': sum(1 for g in raw if g['slug'] in SPORTS), 'covered': len(tq), 'next': old.get('next') or []}
    if prev is None:  # ohne die letzte Suche ist unklar, was heute schon verbraucht wurde – lieber nichts ausgeben
        st['err'] = 'Letzte Suche nicht lesbar, diesmal kein Abruf'
        log('Tipico:', st['err'])
        return tq, st
    try:
        sports, remaining, _, used = call('sports', key)  # kostet nichts
    except RuntimeError as e:
        st['err'] = explain(e)
        log('Tipico: Liste der Ligen %s' % e)
        return tq, st
    if remaining is None:
        st['err'] = 'Rest-Credits unbekannt'
        return tq, st
    st['used'] = used if used is not None else st['used']
    active = {s.get('key') for s in sports if s.get('active')}
    league = by_league(raw, now)
    days_left = calendar.monthrange(now.year, now.month)[1] - now.day + 1
    share = (remaining + st['spent']) / float(days_left)  # gerechter Anteil pro Tag
    cap = max(COST * 4, int(share * DAY_BURST))
    st['share'] = round(share, 1)
    # zuerst zurücklegen, was die ersten Abrufe aller Ligen bis Monatsende brauchen; nur der Rest geht in Auffrischungen
    running = sum(1 for slug, sport in SPORTS.items() if sport in active and league.get(slug))
    spare = remaining - COST * running * days_left / ROUND_DAYS * ROUND_MARGIN
    for cls, _top, _soon, _order, slug, sport, gs in plan_calls(league, tq, st['at'], now, when, top_counts(prev), active):
        if st['spent'] + COST > cap or remaining < COST:
            break
        if cls and (spare < COST or (cls == 2 and st['spent'] + COST > share)):
            continue
        try:
            events, rem, last, us = call('sports/%s/odds/' % sport, key, regions='eu', bookmakers=BOOK, markets='h2h,totals', oddsFormat='decimal', dateFormat='iso')
        except RuntimeError as e:
            st['err'] = explain(e)
            log('Tipico: %s %s' % (slug, e))
            if 'HTTP 429' in str(e) or 'HTTP 401' in str(e):
                break  # Kontingent leer oder Schlüssel falsch: nicht weiter versuchen
            continue
        cost = last if last is not None else COST
        st['spent'] += cost
        spare -= cost
        if rem is not None:
            remaining = rem
        if us is not None:
            st['used'] = us
        st['at'][sport] = iso(now)
        found = match(events, gs, when)
        for gid, q in found.items():
            tq[gid] = {'q': q, 'at': iso(now)}
        row = {'t': iso(now), 'comp': gs[0].get('comp') or slug, 'events': len(events), 'matched': len(found), 'cost': cost, 'why': cls}
        st['fetched'].append(dict(row, slug=slug))
        st['log'].append(row)
        st['lastFetch'] = iso(now)
        log('Tipico: %s – %d Spiele, %d zugeordnet, %d Credits' % (slug, len(events), len(found), cost))
    st['log'] = st['log'][-LOG_KEEP:]
    st['remaining'] = remaining
    st['updatedAt'] = iso(now)
    st['covered'] = len(tq)
    st['next'] = next_up(league, tq, now, active, iso)
    return tq, st
