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
ok(len([c for c in calls if c != 'sports']) == 4 and not any('italy' in c for c in calls), 'Ligen mit Spielen in den nächsten 6 Tagen werden abgerufen (%d)' % len(calls))
calls.clear()
tq, st = tipico.refresh(raw, {'tq': {}, 'tipico': {'at': {tipico.SPORTS['ger.1']: '2026-11-20T10:00:00Z'}}}, NOW, when, lambda *a: None)
ok(not any('germany' in c for c in calls), 'dieselbe Liga nicht gleich wieder')
calls.clear()
tq, st = tipico.refresh(raw, None, NOW, when, lambda *a: None)
ok(calls == [] and st['connected'], 'ohne letzte Suche lieber kein Abruf')
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

# Ein ganzer Monat: alle Wettbewerbe spielen jede Woche (mehr, als je gleichzeitig läuft). Reichen 500 Credits, hat fast jedes Spiel beim Anpfiff eine Quote?
START = datetime(2026, 11, 1, 0, 7, tzinfo=timezone.utc)
games = []
for i, slug in enumerate(tipico.SPORTS):
    midweek = slug.startswith(('uefa.', 'fifa.', 'caf.', 'conmebol.', 'concacaf.')) or 'pokal' in slug or 'cup' in slug or 'copa' in slug or 'coupe' in slug or slug.endswith('.fa')
    for week in range(-1, 7):
        slots = [(1, 19), (2, 19), (2, 21)] if midweek else [(4, 19), (5, 14), (5, 17), (6, 14), (6, 16)]
        for n, (day, hour) in enumerate(slots):
            games.append({'id': '%s-%d-%d' % (slug, week, n), 'slug': slug, 'comp': slug, 't': datetime(2026, 11, 2, hour, 30, tzinfo=timezone.utc) + timedelta(days=week * 7 + day), 'home': {'name': 'X'}, 'away': {'name': 'Y'}})
sim = {'now': START, 'rem': 500, 'used': 0}


def fake2(path, key, **params):
    if path == 'sports':
        return [{'key': v, 'active': True} for v in tipico.SPORTS.values()], sim['rem'], 0, sim['used']
    sim['rem'] -= 2
    sim['used'] += 2
    return [{}], sim['rem'], 2, sim['used']


om, tipico.call, tipico.match = tipico.match, fake2, lambda ev, gs, w: {g['id']: {'H': 2.0} for g in gs}
os.environ['ODDS_API_KEY'] = 'attrappe'
prev = {'tq': {}, 'tipico': {}}
seen, ages = {}, []
kicked = set()
while sim['now'] < START + timedelta(days=30):
    now = sim['now']
    raw = [g for g in games if now < g['t'] < now + timedelta(days=21)]
    tq, st = tipico.refresh(raw, prev, now, when, lambda *a: None)
    prev = {'tq': tq, 'tipico': st}
    for g in raw:
        if g['t'] <= now + timedelta(hours=1) and g['id'] not in kicked:
            kicked.add(g['id'])
            x = tq.get(g['id'])
            seen[g['id']] = bool(x)
            if x:
                ages.append((g['t'] - when(x['at'])).total_seconds() / 3600.0)
    sim['now'] = now + timedelta(hours=1)
tipico.call, tipico.match = orig, om
os.environ.pop('ODDS_API_KEY', None)
share = sum(seen.values()) / float(len(seen))
ages.sort()
print('    Monat: %d Credits verbraucht, %d von %d Spielen mit Quote beim Anpfiff (%.1f %%), Alter der Quote im Mittel %.0f Std., höchstens %.0f Std.' % (sim['used'], sum(seen.values()), len(seen), share * 100, ages[len(ages) // 2], ages[-1]))
ok(sim['rem'] >= 0, 'die 500 Credits reichen für den ganzen Monat')
ok(share >= 0.95, 'mindestens 95 %% der Spiele haben beim Anpfiff eine Quote (%.1f %%)' % (share * 100))

print('\n%d FEHLER' % fails if fails else '\nALLE TESTS OK')
sys.exit(1 if fails else 0)
