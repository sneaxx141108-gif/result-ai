"""Prüft die Tipico-Zuordnung mit dem dokumentierten Antwort-Format von The Odds API (ohne Netz, ohne Schlüssel):
    python tests/tipico.test.py
"""
import os
import sys
from datetime import datetime, timedelta, timezone

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'scripts'))
import tipico  # noqa: E402

NOW = datetime(2026, 11, 20, 12, tzinfo=timezone.utc)
when = lambda s: datetime.fromisoformat(str(s).replace('Z', '+00:00'))  # noqa: E731
fails = 0


def ok(c, msg):
    global fails
    print(('ok  ' if c else 'FEHLER: ') + msg)
    if not c:
        fails += 1


def ev(h, a, t, h2h=(1.8, 3.6, 4.2), tot=(2.5, 1.9, 1.85), book='tipico_de'):
    return {'id': 'x', 'sport_key': 's', 'commence_time': t, 'home_team': h, 'away_team': a, 'bookmakers': [{'key': book, 'title': 'Tipico (DE)', 'markets': [
        {'key': 'h2h', 'outcomes': [{'name': h, 'price': h2h[0]}, {'name': 'Draw', 'price': h2h[1]}, {'name': a, 'price': h2h[2]}]},
        {'key': 'totals', 'outcomes': [{'name': 'Over', 'price': tot[1], 'point': tot[0]}, {'name': 'Under', 'price': tot[2], 'point': tot[0]}]}]}]}


q = tipico.parse_event(ev('Bayern Munich', 'Borussia Dortmund', '2026-11-21T17:30:00Z'))
ok(q == {'H': 1.8, 'D': 3.6, 'A': 4.2, 'O25': 1.9, 'U25': 1.85}, 'Quoten richtig gelesen %s' % q)
ok(tipico.parse_event(ev('A', 'B', '2026-11-21T17:30:00Z', book='betano')) is None, 'andere Buchmacher werden ignoriert')
ok(tipico.parse_event({'home_team': 'A', 'away_team': 'B', 'bookmakers': []}) is None, 'ohne Tipico-Angebot keine Quote')

t1 = when('2026-11-21T14:30:00Z')
g = lambda i, h, a, t=t1: {'id': i, 'slug': 'ger.1', 't': t, 'home': {'name': h}, 'away': {'name': a}}  # noqa: E731
games = [g('1', 'FC Cologne', 'Borussia Mönchengladbach'), g('2', 'Hamburg SV', 'St. Pauli'), g('3', 'Mainz', 'Union Berlin'), g('4', 'Bayern Munich', 'Borussia Dortmund', when('2026-11-21T17:30:00Z'))]
events = [ev('1. FC Köln', 'Borussia Monchengladbach', '2026-11-21T14:30:00Z', (2.0, 3.5, 3.6)), ev('Hamburger SV', 'FC St. Pauli', '2026-11-21T14:30:00Z', (2.2, 3.4, 3.1)),
          ev('FSV Mainz 05', '1. FC Union Berlin', '2026-11-21T14:30:00Z', (1.9, 3.5, 4.0)), ev('Bayern Munich', 'Borussia Dortmund', '2026-11-21T17:30:00Z', (1.5, 4.8, 5.5))]
m = tipico.match(events, games, when)
ok(len(m) == 4, 'alle 4 Spiele zugeordnet (%d)' % len(m))
ok(m.get('1', {}).get('H') == 2.0 and m.get('2', {}).get('H') == 2.2 and m.get('3', {}).get('H') == 1.9 and m.get('4', {}).get('H') == 1.5, 'jedes Spiel bekommt seine eigene Quote')
n = [g('n', 'Spain', 'United States', when('2026-11-21T19:45:00Z'))]
n[0]['slug'] = 'fifa.friendly'
ok(tipico.match([ev('Spain', 'USA', '2026-11-21T19:45:00Z')], n, when).get('n') is not None, 'Länder mit anderer Schreibweise (USA)')
t2 = when('2026-11-14T19:45:00Z')
nat = [g('n1', 'Czechia', 'Türkiye', t2), g('n2', 'Bosnia-Herzegovina', 'Republic of Ireland', t2), g('n3', "Cote d'Ivoire", 'Korea Republic', t2)]
m = tipico.match([ev('Czech Republic', 'Turkey', '2026-11-14T19:45:00Z', (2.1, 3.3, 3.5)), ev('Bosnia and Herzegovina', 'Ireland', '2026-11-14T19:45:00Z', (2.6, 3.1, 2.9)),
                  ev('Ivory Coast', 'South Korea', '2026-11-14T19:45:00Z', (2.4, 3.2, 3.0))], nat, when)
ok(m.get('n1', {}).get('H') == 2.1 and m.get('n2', {}).get('H') == 2.6 and m.get('n3', {}).get('H') == 2.4, 'Länder: Tschechien, Türkei, Bosnien, Irland, Elfenbeinküste, Südkorea (%s)' % sorted(m))
m = tipico.match([ev('Brazil', 'Argentina', '2026-11-14T19:45:00Z', (2.3, 3.1, 3.2))], [g('s', 'Argentina', 'Brazil', t2)], when)
ok(m.get('s', {}).get('H') == 3.2 and m.get('s', {}).get('A') == 2.3 and m.get('s', {}).get('O25') == 1.9, 'neutraler Platz, Heim und Gast vertauscht: Quoten mitgetauscht (%s)' % m.get('s'))
t3 = when('2026-11-21T15:00:00Z')
m = tipico.match([ev('Manchester United', 'Brentford', '2026-11-21T15:00:00Z', (1.9, 3.6, 4.0))], [g('mc', 'Manchester City', 'Burnley', t3), g('mu', 'Manchester United', 'Brentford', t3)], when)
ok(list(m) == ['mu'], 'gleiche Stadt, gleiche Zeit: nur Manchester United bekommt die Quote (%s)' % list(m))
m = tipico.match([ev('Manchester United', 'Brentford', '2026-11-21T15:00:00Z')], [g('mc', 'Manchester City', 'Burnley', t3), g('x', 'Arsenal', 'Fulham', t3)], when)
ok(not m, 'fehlt das richtige Spiel, bekommt kein anderes seine Quote')
t4 = when('2026-11-22T22:00:00Z')
m = tipico.match([ev('Galo', 'Cruzeiro', '2026-11-22T22:00:00Z')], [g('b1', 'Atletico Mineiro', 'Cruzeiro', t4)], when)
ok('b1' in m, 'Spitzname: allein zu dieser Zeit -> zugeordnet')
m = tipico.match([ev('Galo', 'Cruzeiro', '2026-11-22T22:00:00Z')], [g('b1', 'Atletico Mineiro', 'Cruzeiro', t4), g('b2', 'Santos', 'Gremio', t4)], when)
ok(not m, 'Spitzname: mit einem zweiten Spiel zur selben Zeit lieber nicht')
m = tipico.match([ev('Bayern Munich', 'Borussia Dortmund', '2026-11-21T17:30:00Z')], [g('d1', 'Bayern Munich', 'Borussia Dortmund', when('2026-11-21T17:30:00Z')),
                                                                                    g('d2', 'Bayern Munich II', 'Borussia Dortmund II', when('2026-11-21T17:30:00Z'))], when)
ok(list(m) == ['d1'], 'ein Spiel des Anbieters geht nur an eines unserer Spiele (%s)' % list(m))
ok(not tipico.match([ev('Arsenal', 'Chelsea', '2026-11-21T14:30:00Z')], games, when), 'fremde Spiele werden nicht zugeordnet')
ok(not tipico.match([ev('Bayern Munich', 'Borussia Dortmund', '2026-11-28T17:30:00Z')], games, when), 'andere Anstoßzeit wird nicht zugeordnet')

# Ohne Schlüssel: nichts wird abgerufen, „k. A.“
os.environ.pop('ODDS_API_KEY', None)
tq, st = tipico.refresh([], {'tq': {}, 'tipico': {}}, NOW, when, lambda *a: None)
ok(tq == {} and st == {'connected': False}, 'ohne Schlüssel kein Abruf')

# Budget: Attrappe statt Netz
calls = []


def fake(path, key, **params):
    calls.append(path)
    if path == 'sports':
        return [{'key': v, 'active': True} for v in tipico.SPORTS.values()], 100, 0, 400
    return [], 98, 2, 402


orig, tipico.call = tipico.call, fake
os.environ['ODDS_API_KEY'] = 'attrappe'
raw = [dict(g('a', 'X', 'Y', NOW + timedelta(hours=5)), slug=s) for s in ('ger.1', 'uefa.champions', 'eng.1', 'esp.1')] + [dict(g('b', 'X', 'Y', NOW + timedelta(days=20)), slug='ita.1')]
tq, st = tipico.refresh(raw, {'tq': {}, 'tipico': {'day': '2026-11-20', 'spent': 30}}, NOW, when, lambda *a: None)
# 100 Rest + 30 heute verbraucht = 130 auf 11 Resttage → 11,8 pro Tag, ein Tag darf das Dreifache (35), mit 34 ist Schluss: 2 Abrufe bis 34 (die ersten beiden Ligen)
ok(len([c for c in calls if c != 'sports']) == 2, 'Tagesbudget: an einem Tag höchstens das Dreifache seines Anteils (%s)' % calls)
calls.clear()
tq, st = tipico.refresh(raw, {'tq': {}, 'tipico': {'day': '2026-11-20', 'spent': 36}}, NOW, when, lambda *a: None)
ok(calls == ['sports'], 'Tagesbudget aufgebraucht: kein bezahlter Abruf (%s)' % calls)
calls.clear()
tq, st = tipico.refresh(raw, {'tq': {}, 'tipico': {}}, NOW, when, lambda *a: None)
ok(len([c for c in calls if c != 'sports']) == 4 and not any('italy' in c for c in calls), 'Ligen mit Spielen in den nächsten Tagen werden abgerufen, in 20 Tagen nicht (%d)' % len(calls))
calls.clear()
tq, st = tipico.refresh(raw, {'tq': {}, 'tipico': {'at': {tipico.SPORTS['ger.1']: '2026-11-20T10:00:00Z'}}}, NOW, when, lambda *a: None)
ok(not any('germany' in c for c in calls), 'dieselbe Liga nicht gleich wieder')
calls.clear()
tq, st = tipico.refresh(raw, None, NOW, when, lambda *a: None)
ok(calls == [] and st['connected'], 'ohne letzte Suche lieber kein Abruf')


def fake3(path, key, **params):
    if path == 'sports':
        return [{'key': v, 'active': True} for v in tipico.SPORTS.values()], 300, 0, 200
    return [ev('Bayern Munich', 'Borussia Dortmund', '2026-11-21T17:30:00Z', (1.5, 4.8, 5.5)), ev('Werder Bremen', 'VfL Wolfsburg', '2026-12-06T14:30:00Z', (2.0, 3.5, 3.4)),
            ev('Unbekannt FC', 'Niemand SV', '2026-11-22T14:30:00Z')], 298, 2, 202


tipico.call = fake3
raw3 = [dict(g('k1', 'Bayern Munich', 'Borussia Dortmund', when('2026-11-21T17:30:00Z')), comp='Bundesliga'),
        dict(g('k2', 'Werder Bremen', 'VfL Wolfsburg', when('2026-12-06T14:30:00Z')), comp='Bundesliga')]
tq, st = tipico.refresh(raw3, {'tq': {}, 'tipico': {}}, NOW, when, lambda *a: None)
ok('k1' in tq and 'k2' in tq, 'ein Abruf trägt alle Spiele der Liga ein, auch das in 16 Tagen (%s)' % sorted(tq))
row = (st.get('fetched') or [{}])[0]
ok(row.get('miss') == ['Unbekannt FC – Niemand SV'] and st['dry'].get(tipico.SPORTS['ger.1']) == 0, 'Tipico-Spiele ohne Gegenstück werden notiert (%s)' % row.get('miss'))
tipico.call = orig
os.environ.pop('ODDS_API_KEY', None)

# Einteilung: Top-Tipps zuerst, dann das nächste Spiel
g2 = lambda i, slug, h: {'id': i, 'slug': slug, 't': NOW + timedelta(hours=h), 'home': {'name': 'X'}, 'away': {'name': 'Y'}}  # noqa: E731
active = set(tipico.SPORTS.values())
lg = tipico.by_league([g2('a', 'eng.1', 5), g2('b', 'ita.1', 20), g2('c', 'ger.1', 30)], NOW)
p = tipico.plan_calls(lg, {}, {}, NOW, when, {'ger.1': 3}, active)
ok([x[4] for x in p] == ['ger.1', 'eng.1', 'ita.1'], 'Ligen mit Top-Tipps zuerst, dann das nächste Spiel (%s)' % [x[4] for x in p])
tq0 = {'a': {'q': {'H': 2}, 'at': '2026-11-20T11:00:00Z'}}
p = tipico.plan_calls(tipico.by_league([g2('a', 'eng.1', 5)], NOW), tq0, {tipico.SPORTS['eng.1']: '2026-11-20T11:00:00Z'}, NOW, when, {}, active)
ok(not p, 'eine frische Quote wird nicht erneut abgerufen')
tq0 = {'a': {'q': {'H': 2}, 'at': '2026-11-19T22:00:00Z'}}
p = tipico.plan_calls(tipico.by_league([g2('a', 'eng.1', 5)], NOW), tq0, {tipico.SPORTS['eng.1']: '2026-11-19T22:00:00Z'}, NOW, when, {}, active)
ok([x[0] for x in p] == [1], 'wichtige Liga: Auffrischung kurz vor Anpfiff')
p = tipico.plan_calls(tipico.by_league([g2('a', 'tur.1', 5)], NOW), tq0, {tipico.SPORTS['tur.1']: '2026-11-19T22:00:00Z'}, NOW, when, {}, active)
ok(not p, 'kleinere Liga ohne Top-Tipps: keine Auffrischung')
p = tipico.plan_calls(tipico.by_league([g2('z', 'tur.1', 100)], NOW), {}, {}, NOW, when, {}, active)
ok([x[0] for x in p] == [2], 'Spiele weiter weg nur mit übrigen Credits')

# Vorlauf: wichtige Ligen 10 Tage, Ligen mit 3 Top-Tipps auch, sonst 7
p = tipico.plan_calls(tipico.by_league([g2('a', 'eng.1', 9 * 24), g2('b', 'tur.1', 9 * 24), g2('c', 'bel.1', 9 * 24)], NOW), {}, {}, NOW, when, {'bel.1': 3}, active)
ok(sorted(x[4] for x in p) == ['bel.1', 'eng.1'], 'Vorlauf: Premier League und Liga mit 3 Top-Tipps 9 Tage vorher, Süper Lig noch nicht (%s)' % [x[4] for x in p])
# Ligen, in denen Tipico gerade nichts anbietet, seltener
TUR = tipico.SPORTS['tur.1']
far, close = tipico.by_league([g2('z', 'tur.1', 100)], NOW), tipico.by_league([g2('z', 'tur.1', 10)], NOW)
ok(not tipico.plan_calls(far, {}, {TUR: '2026-11-19T06:00:00Z'}, NOW, when, {}, active), 'zweiter Abruf für weite Spiele frühestens nach 2 Tagen')
ok([x[0] for x in tipico.plan_calls(far, {}, {TUR: '2026-11-18T00:00:00Z'}, NOW, when, {}, active)] == [2], 'nach 2 Tagen wieder')
ok(not tipico.plan_calls(far, {}, {TUR: '2026-11-18T00:00:00Z'}, NOW, when, {}, active, {TUR: 1}), 'letzter Abruf ohne Tipico-Angebot: weite Spiele erst nach 4 Tagen')
ok([x[0] for x in tipico.plan_calls(close, {}, {TUR: '2026-11-18T00:00:00Z'}, NOW, when, {}, active, {TUR: 1})] == [0], '… kurz vor Anpfiff nach 2 Tagen doch')
ok(not tipico.plan_calls(close, {}, {TUR: '2026-11-16T08:00:00Z'}, NOW, when, {}, active, {TUR: 2}), 'zweimal nichts angeboten: nur noch einmal pro Woche')
ok(not tipico.plan_calls(far, {}, {}, NOW, when, {}, active, {}, {TUR: 2.0}), 'gelernter Vorlauf: Tipico hatte zuletzt nur 2 Tage voraus Quoten, also nicht 4 Tage vorher abrufen')
ok([x[0] for x in tipico.plan_calls(far, {}, {}, NOW, when, {}, active, {}, {TUR: 3.5})] == [2], '… bei 3,5 Tagen schon')
nx = tipico.next_up(far, {}, {TUR: '2026-11-19T06:00:00Z'}, NOW, when, active, lambda d: d.strftime('%Y-%m-%dT%H:%M:%SZ'))
ok(nx == [{'at': '2026-11-21T06:00:00Z', 'comp': 'tur.1'}], 'KI-Zentrale: nächster Abruf 2 Tage nach dem letzten (%s)' % nx)

# Ein ganzer Monat: alle Wettbewerbe spielen jede Woche (mehr, als je gleichzeitig läuft). The Odds API führt die Spiele 14 Tage vorher
# (ein Abruf kostet dann 2 Credits, auch wenn Tipico noch nichts anbietet), Tipico bietet einen Spieltag erst ein paar Tage vorher an,
# drei Ligen gar nicht. Reichen 500 Credits für 30 Tage, haben die Spiele beim Anpfiff eine Quote, und wie viele der nächsten Tage?
START = datetime(2026, 11, 1, 0, 7, tzinfo=timezone.utc)
DRY = {'rus.1', 'fin.1', 'irl.1'}
# so viele Wettbewerbe laufen im Herbst wirklich gleichzeitig (eine davon ohne Tipico-Angebot)
REAL = ['ger.1', 'uefa.champions', 'ger.2', 'uefa.europa', 'uefa.europa.conf', 'eng.1', 'esp.1', 'ita.1', 'fra.1', 'eng.2', 'ned.1', 'por.1', 'tur.1',
        'bel.1', 'aut.1', 'sui.1', 'esp.2', 'ita.2', 'fra.2', 'sco.1', 'gre.1', 'eng.3', 'eng.4', 'den.1', 'bra.1', 'mex.1', 'usa.1', 'arg.1', 'ger.dfb_pokal', 'rus.1']


def make_games(slugs):
    out = []
    for slug in slugs:
        midweek = slug.startswith(('uefa.', 'fifa.', 'caf.', 'conmebol.', 'concacaf.')) or 'pokal' in slug or 'cup' in slug or 'copa' in slug or 'coupe' in slug or slug.endswith('.fa')
        for week in range(-1, 7):
            slots = [(1, 19), (2, 19), (2, 21)] if midweek else [(4, 19), (5, 14), (5, 17), (6, 14), (6, 16)]
            for n, (day, hour) in enumerate(slots):
                out.append({'id': '%s-%d-%d' % (slug, week, n), 'slug': slug, 'comp': slug, 't': datetime(2026, 11, 2, hour, 30, tzinfo=timezone.utc) + timedelta(days=week * 7 + day), 'home': {'name': 'X'}, 'away': {'name': 'Y'}})
    return out


def month(lead_top, lead_other, slugs):
    games = make_games(slugs)
    sim = {'now': START, 'rem': 500, 'used': 0}

    def fake2(path, key, **params):
        if path == 'sports':
            return [{'key': v, 'active': True} for v in tipico.SPORTS.values()], sim['rem'], 0, sim['used']
        slug = next(k for k, v in tipico.SPORTS.items() if v == path.split('/')[1])
        now, evs = sim['now'], []
        lead = timedelta(days=lead_top if slug in tipico.IMPORTANT else lead_other)
        for x in games:
            if x['slug'] == slug and now < x['t'] <= now + timedelta(days=14):
                e = dict(ev('X', 'Y', x['t'].strftime('%Y-%m-%dT%H:%M:%SZ')), gid=x['id'])
                if slug in DRY or x['t'] - now > lead:
                    e['bookmakers'] = []
                evs.append(e)
        if not evs:
            return [], sim['rem'], 0, sim['used']  # leerer Abruf kostet nichts
        sim['rem'] -= 2
        sim['used'] += 2
        return evs, sim['rem'], 2, sim['used']

    def fake_match(evs, gs, w, hit=None):
        ids, out = {x['id'] for x in gs}, {}
        for i, e in enumerate(evs):
            if e['bookmakers'] and e['gid'] in ids:
                out[e['gid']] = {'H': 2.0}
                if hit is not None:
                    hit.add(i)
        return out

    om, oc = tipico.match, tipico.call
    tipico.call, tipico.match = fake2, fake_match
    os.environ['ODDS_API_KEY'] = 'attrappe'
    prev = {'tq': {}, 'tipico': {}}
    seen, ages, kicked, near3, near7, low = {}, [], set(), [], [], 500
    try:
        while sim['now'] < START + timedelta(days=30):
            now = sim['now']
            raw = [x for x in games if now < x['t'] < now + timedelta(days=21)]
            tq, st = tipico.refresh(raw, prev, now, when, lambda *a: None)
            prev = {'tq': tq, 'tipico': st}
            low = min(low, sim['rem'])
            live = [x for x in raw if x['slug'] not in DRY]
            for d, acc in ((3, near3), (7, near7)):
                xs = [x for x in live if x['t'] <= now + timedelta(days=d)]
                if xs:
                    acc.append(sum(1 for x in xs if x['id'] in tq) / float(len(xs)))
            for x in live:
                if x['t'] <= now + timedelta(hours=1) and x['id'] not in kicked:
                    kicked.add(x['id'])
                    q = tq.get(x['id'])
                    seen[x['id']] = bool(q)
                    if q:
                        ages.append((x['t'] - when(q['at'])).total_seconds() / 3600.0)
            sim['now'] = now + timedelta(hours=1)
    finally:
        tipico.call, tipico.match = oc, om
        os.environ.pop('ODDS_API_KEY', None)
    ages.sort()
    kick = sum(seen.values()) / float(len(seen))
    r = {'used': sim['used'], 'low': low, 'kick': kick, 'd3': sum(near3) / len(near3), 'd7': sum(near7) / len(near7), 'age': ages[len(ages) // 2]}
    print('    %d Ligen, Tipico %2d/%2d Tage vorher: %d Credits, %.1f %% beim Anpfiff mit Quote, nächste 3 Tage im Schnitt %.1f %%, nächste 7 Tage %.1f %%, Quote beim Anpfiff im Mittel %.0f Std. alt'
          % (len(slugs), lead_top, lead_other, r['used'], kick * 100, r['d3'] * 100, r['d7'] * 100, r['age']))
    return r


# (Vorlauf wichtige Ligen, Vorlauf andere, Ligen, mindestens beim Anpfiff, mindestens in den nächsten 3 Tagen). Simulation 10.11.2026,
# alter Abruf zum Vergleich: 51 Ligen 10/7 → Anpfiff 94,3 %, 3 Tage 65,2 % · 30 Ligen 10/7 → 100 %, 89,0 % · 30 Ligen 3/3 → 83,3 %, 56,9 %.
for lt, lo, slugs, need, need3 in ((10, 7, list(tipico.SPORTS), 0.95, 0.8), (14, 14, list(tipico.SPORTS), 0.95, 0.9), (10, 7, REAL, 0.99, 0.9), (3, 3, REAL, 0.85, 0.5)):
    r = month(lt, lo, slugs)
    ok(r['low'] >= 0 and r['used'] <= 500, '%d Ligen, Tipico %d/%d Tage vorher: die 500 Credits reichen 30 Tage' % (len(slugs), lt, lo))
    ok(r['kick'] >= need and r['d3'] >= need3, '%d Ligen, Tipico %d/%d Tage vorher: beim Anpfiff mindestens %d %% mit Quote (%.1f %%), in den nächsten 3 Tagen %d %% (%.1f %%)'
       % (len(slugs), lt, lo, need * 100, r['kick'] * 100, need3 * 100, r['d3'] * 100))

print('\n%d FEHLER' % fails if fails else '\nALLE TESTS OK')
sys.exit(1 if fails else 0)
