"""Result AI – täglicher Stärken-Rechner (läuft frühmorgens auf GitHub Actions, ohne KI, nur Python-Standardbibliothek).

Holt Ergebnisse, xG und Schlussquoten aus 38 Ligen (football-data.co.uk) und alle Europapokal-Spiele (ESPN), schätzt
Angriff und Abwehr jedes Teams (Poisson-Modell aus scripts/forecast.py, wie bei der BVB-App; Einstellungen per Backtest
unten bei SPREAD) und ordnet jedes Team einer ESPN-Team-ID zu
(Wappen, Namen für die Zuordnung der Screenshots). Ergebnis: web/data/ratings.json. Die Werte gelten den ganzen Tag –
so liefert dasselbe Spiel am selben Tag immer dieselben Zahlen.

    python scripts/ratings.py           # alles neu rechnen
    python scripts/ratings.py --quick   # nur ein paar Ligen (zum Ausprobieren)

football-data.co.uk erlaubt normalen Programmen den Abruf (robots.txt sperrt nur KI-Trainings-Crawler). Der Rechner meldet
sich ehrlich mit eigenem Namen (UA) an.
"""
import csv
import difflib
import io
import json
import os
import re
import sys
import time
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import forecast as fc  # noqa: E402

# Einstellungen per Backtest bestimmt (04.11.2026, 38 Ligen, je 1.406 bzw. 2.246 Spiele aus den letzten 28/56 Tagen
# vorhergesagt; scripts/backtest.py): Quoten zählen achtfach, wenig Zug zur Mitte, jüngere Spiele wichtiger,
# Stärke-Unterschiede ×1,25 (vorher war das Modell bei klaren Favoriten zu vorsichtig: sagte 64 %, passiert waren 77 %).
# Log-Loss 0,994 → 0,984 (28 Tage) bzw. 1,010 → 1,001 (56 Tage). Nur nach erneutem Backtest ändern.
fc.W_MARKET = 8.0
fc.TAU = 1.5
fc.HALF_LIFE = 120.0
SPREAD = 1.25
# Liga-Niveau (05.11.2026): Stärke = Niveau der Liga + Abweichung des Teams (fc.fit_ratings_lg). Backtest: Europapokal-Spiele
# (Ligen gegeneinander) Log-Loss 0,9810 → 0,9578 (28 Tage) bzw. 0,9954 → 0,9888 (56 Tage), Liga-Spiele 0,9848 → 0,9837;
# wie stark das Liga-Niveau zur Mitte gezogen wird (TAU_L 0,3 bis 3), war fast egal.
TAU_L = 1.0

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'web', 'data', 'ratings.json')
UA = 'ResultAI-Stats/1.0 (+https://github.com/sneaxx141108-gif/result-ai)'
FD = 'https://football-data.co.uk'
ESPN = 'https://site.api.espn.com/apis/site/v2/sports/soccer'
NOW = datetime.now(timezone.utc)
WINDOW_DAYS = 450  # so weit zurück zählen Spiele (mit Halbwertszeit 120 Tage zählt ein Jahr altes Spiel noch ~12 %)
START = NOW.year if NOW.month >= 7 else NOW.year - 1  # europäische Saison: 2026/27 beginnt im Sommer 2026

# Ligen: football-data-Kürzel -> (ESPN-Liga, Name, Land)
MAIN = {  # je Saison eine Datei /mmz4281/<2627>/<Kürzel>.csv – mit xG (wo vorhanden) und Über/Unter-Quoten
    'E0': ('eng.1', 'Premier League', 'England'), 'E1': ('eng.2', 'Championship', 'England'),
    'E2': ('eng.3', 'League One', 'England'), 'E3': ('eng.4', 'League Two', 'England'), 'EC': ('eng.5', 'National League', 'England'),
    'SC0': ('sco.1', 'Premiership', 'Schottland'), 'SC1': ('sco.2', 'Championship', 'Schottland'),
    'SC2': ('sco.3', 'League One', 'Schottland'), 'SC3': ('sco.4', 'League Two', 'Schottland'),
    'D1': ('ger.1', 'Bundesliga', 'Deutschland'), 'D2': ('ger.2', '2. Bundesliga', 'Deutschland'),
    'I1': ('ita.1', 'Serie A', 'Italien'), 'I2': ('ita.2', 'Serie B', 'Italien'),
    'SP1': ('esp.1', 'LaLiga', 'Spanien'), 'SP2': ('esp.2', 'LaLiga 2', 'Spanien'),
    'F1': ('fra.1', 'Ligue 1', 'Frankreich'), 'F2': ('fra.2', 'Ligue 2', 'Frankreich'),
    'N1': ('ned.1', 'Eredivisie', 'Niederlande'), 'B1': ('bel.1', 'Pro League', 'Belgien'),
    'P1': ('por.1', 'Primeira Liga', 'Portugal'), 'T1': ('tur.1', 'Süper Lig', 'Türkei'), 'G1': ('gre.1', 'Super League', 'Griechenland'),
}
NEW = {  # eine Datei mit allen Jahren /new/<Kürzel>.csv – Ergebnisse + Schlussquoten
    'ARG': ('arg.1', 'Liga Profesional', 'Argentinien'), 'AUT': ('aut.1', 'Bundesliga', 'Österreich'),
    'BRA': ('bra.1', 'Série A', 'Brasilien'), 'CHN': ('chn.1', 'Super League', 'China'), 'DNK': ('den.1', 'Superliga', 'Dänemark'),
    'FIN': ('fin.1', 'Veikkausliiga', 'Finnland'), 'IRL': ('irl.1', 'Premier Division', 'Irland'), 'JPN': ('jpn.1', 'J1 League', 'Japan'),
    'MEX': ('mex.1', 'Liga MX', 'Mexiko'), 'NOR': ('nor.1', 'Eliteserien', 'Norwegen'), 'POL': ('pol.1', 'Ekstraklasa', 'Polen'),
    'ROU': ('rou.1', 'Liga I', 'Rumänien'), 'RUS': ('rus.1', 'Premier Liga', 'Russland'), 'SWE': ('swe.1', 'Allsvenskan', 'Schweden'),
    'SWZ': ('sui.1', 'Super League', 'Schweiz'), 'USA': ('usa.1', 'MLS', 'USA'),
}
CUPS = {'uefa.champions': 'Champions League', 'uefa.europa': 'Europa League', 'uefa.europa.conf': 'Conference League'}
# Ligen, die weder football-data noch ESPN haben – die Heimat vieler Europapokal-Teams (Sparta Prag, Dinamo Zagreb, Roter Stern …).
# Quelle FotMob: normale Seiten sind laut robots.txt erlaubt (nur /api ist gesperrt), Daten aus __NEXT_DATA__ wie in der BVB-App.
# FotMob-Liga-ID -> (Kürzel, Name, Land); aktuelle Saison + Vorsaison, nur Ergebnisse (kein xG, keine Quoten).
FM = 'https://www.fotmob.com'
FM_LOGO = 'https://images.fotmob.com/image_resources/logo/teamlogo/%s.png'
FM_LEAGUES = {
    122: ('cze.1', '1. Liga', 'Tschechien'), 441: ('ukr.1', 'Premjer-Liha', 'Ukraine'), 182: ('srb.1', 'Superliga', 'Serbien'),
    252: ('cro.1', 'HNL', 'Kroatien'), 212: ('hun.1', 'NB I', 'Ungarn'), 270: ('bul.1', 'Parwa Liga', 'Bulgarien'),
    136: ('cyp.1', '1. Division', 'Zypern'), 127: ('isr.1', "Ligat ha'Al", 'Israel'), 176: ('svk.1', 'Niké liga', 'Slowakei'),
    173: ('svn.1', 'Prva Liga', 'Slowenien'), 225: ('kaz.1', 'Premjer-Liga', 'Kasachstan'), 262: ('aze.1', 'Premyer Liqa', 'Aserbaidschan'),
    267: ('bih.1', 'Premijer Liga', 'Bosnien'), 118: ('arm.1', 'Premier League', 'Armenien'), 439: ('geo.1', 'Erovnuli Liga', 'Georgien'),
    260: ('alb.1', 'Kategoria Superiore', 'Albanien'), 226: ('lva.1', 'Virslīga', 'Lettland'), 228: ('ltu.1', 'A Lyga', 'Litauen'),
    185: ('por.2', 'Liga Portugal 2', 'Portugal'),
}
# football-data-Ligen, für die ESPN keine Wappen hat: Wappen + Vereinsfarbe von FotMob (gleiche Vereine, nur Bild und Farbe)
FM_CRESTS = {196: 'Polen', 51: 'Finnland', 126: 'Irland', 189: 'Rumänien'}
QUICK = {'D1', 'E0', 'BRA'}

# football-data-Kurznamen, die sich nicht von selbst den ESPN-Namen zuordnen lassen (aus der BVB-App)
FD_ALIAS = {'Paris SG': 'Paris Saint-Germain', "Nott'm Forest": 'Nottingham Forest', 'Man United': 'Manchester United',
            'Man City': 'Manchester City', 'Ath Madrid': 'Atletico Madrid', 'Ath Bilbao': 'Athletic Club',
            'Sp Lisbon': 'Sporting CP', 'Sp Braga': 'Braga', "M'gladbach": 'Monchengladbach', 'Ein Frankfurt': 'Eintracht Frankfurt',
            'FC Koln': 'Cologne', 'Inter': 'Internazionale', 'Milan': 'AC Milan', 'Vallecano': 'Rayo Vallecano',
            'Sociedad': 'Real Sociedad', 'Betis': 'Real Betis', 'Celta': 'Celta Vigo', 'Espanol': 'Espanyol',
            'Wolves': 'Wolverhampton Wanderers', 'Olympiakos': 'Olympiacos', 'St. Gilloise': 'Union St.-Gilloise',
            'Buyuksehyr': 'Istanbul Basaksehir', 'For Sittard': 'Fortuna Sittard', 'Nijmegen': 'NEC',
            'Guimaraes': 'Vitoria Guimaraes', 'Verona': 'Hellas Verona', 'Hamburg': 'Hamburger SV',
            'FK Crvena Zvezda': 'Red Star Belgrade', 'Crvena Zvezda': 'Red Star Belgrade', 'Plzen': 'Viktoria Plzen',
            'Hapoel Beer Sheva': "Hapoel Be'er Sheva", 'Ararat Armenia': 'Ararat-Armenia'}
GENERIC = {'fc', 'sc', 'sv', 'cf', 'ac', 'as', 'afc', 'club', 'de', 'the', '1', 'fk', 'sk', 'bk', 'if', 'ss', 'cd', 'ca', 'cs',
           'calcio', 'football', 'futbol', 'borussia', 'real', 'sporting', 'olympique', 'stade', 'ssc', 'vfb', 'vfl', 'united', 'city'}


def log(*a):
    print(*a, flush=True)


def get(url, timeout=60, retries=2):
    last = None
    for attempt in range(retries + 1):
        try:
            req = urllib.request.Request(url, headers={'User-Agent': UA, 'Accept': '*/*'})
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return r.read().decode('utf-8-sig', errors='replace')
        except urllib.error.HTTPError as e:
            last = 'HTTP %s' % e.code
            if e.code == 404:
                break
        except Exception as e:  # Netzwerkfehler, Timeout …
            last = str(e)
        time.sleep(2 + 3 * attempt)
    raise RuntimeError('%s nicht erreichbar (%s)' % (url.split('?')[0], last))


def slug(s):
    s = unicodedata.normalize('NFKD', s or '').encode('ascii', 'ignore').decode().lower()
    return re.sub(r'[^a-z0-9]+', '-', s).strip('-')


def tokens(s):
    return {t for t in slug(s).split('-') if t and t not in GENERIC}


def sim(a, b):
    ta, tb = tokens(a), tokens(b)
    if not ta or not tb:
        return 0.0
    over = len(ta & tb) / min(len(ta), len(tb))
    return max(over, difflib.SequenceMatcher(None, ' '.join(sorted(ta)), ' '.join(sorted(tb))).ratio())


def fd_date(s):
    for fmt in ('%d/%m/%Y', '%d/%m/%y'):
        try:
            return datetime.strptime((s or '').strip(), fmt).replace(tzinfo=timezone.utc, hour=12)
        except ValueError:
            pass
    return None


def num(row, key):
    try:
        return float(row.get(key) or '')
    except ValueError:
        return None


def odds_of(row):
    """Marktdurchschnitt (Schlussquoten, sonst Eröffnung) -> {'ph','pd','pa'(,'line','pover')} ohne Buchmacher-Marge."""
    for h, d, a in (('AvgCH', 'AvgCD', 'AvgCA'), ('PSCH', 'PSCD', 'PSCA'), ('B365CH', 'B365CD', 'B365CA'),
                    ('AvgH', 'AvgD', 'AvgA'), ('B365H', 'B365D', 'B365A')):
        oh, od, oa = num(row, h), num(row, d), num(row, a)
        if not (oh and od and oa) or min(oh, od, oa) <= 1.0:
            continue
        ph, pd, pa = 1 / oh, 1 / od, 1 / oa
        s = ph + pd + pa
        out = {'ph': ph / s, 'pd': pd / s, 'pa': pa / s}
        for o, u in (('AvgC>2.5', 'AvgC<2.5'), ('Avg>2.5', 'Avg<2.5'), ('B365C>2.5', 'B365C<2.5'), ('B365>2.5', 'B365<2.5')):
            ov, un = num(row, o), num(row, u)
            if ov and un and ov > 1 and un > 1:
                out.update({'line': 2.5, 'pover': (1 / ov) / (1 / ov + 1 / un)})
                break
        return out
    return None


def read_csv(text):
    return list(csv.DictReader(io.StringIO(text)))


# ---------------------------------------------------------------- Spiele laden
def league_games(code):
    """Alle Spiele einer Liga im Zeitfenster: [{'t','home','away','hg','ag','hx','ax','odds'}] (hg=None: noch nicht gespielt)."""
    cut = NOW - timedelta(days=WINDOW_DAYS)
    out = []
    if code in MAIN:
        texts = []
        for y in (START - 1, START):
            try:
                texts.append(get('%s/mmz4281/%02d%02d/%s.csv' % (FD, y % 100, (y + 1) % 100, code)))
            except Exception as e:
                log('  %s %d: %s' % (code, y, e))
        rows = [r for t in texts for r in read_csv(t)]
        keys = ('HomeTeam', 'AwayTeam', 'FTHG', 'FTAG')
    else:
        rows = read_csv(get('%s/new/%s.csv' % (FD, code)))
        keys = ('Home', 'Away', 'HG', 'AG')
    for r in rows:
        dt = fd_date(r.get('Date'))
        h, a = (r.get(keys[0]) or '').strip(), (r.get(keys[1]) or '').strip()
        if not (dt and h and a) or dt < cut:
            continue
        hg, ag = num(r, keys[2]), num(r, keys[3])
        out.append({'t': dt, 'home': h, 'away': a, 'hg': hg, 'ag': ag, 'hx': num(r, 'HxG'), 'ax': num(r, 'AxG'),
                    'odds': odds_of(r), 'season': (r.get('Season') or '').strip()})
    return out


def espn_table(lg):
    """Teams der aktuellen ESPN-Tabelle: [{'id','names','gp','gf','ga','logo'}]."""
    d = json.loads(get('https://site.api.espn.com/apis/v2/sports/soccer/%s/standings' % lg, timeout=30))
    rows, seen = [], set()
    for ch in d.get('children') or []:
        for e in (ch.get('standings') or {}).get('entries') or []:
            t = e.get('team') or {}
            tid = str(t.get('id'))
            if tid in seen:
                continue
            seen.add(tid)
            st = {x.get('name'): x.get('value') for x in e.get('stats') or []}
            rows.append({'id': tid, 'names': [n for n in (t.get('displayName'), t.get('shortDisplayName'), t.get('name'), t.get('location'), t.get('abbreviation')) if n],
                         'display': t.get('displayName') or t.get('name'), 'short': t.get('shortDisplayName'), 'abbr': t.get('abbreviation'),
                         'logo': ((t.get('logos') or [{}])[0]).get('href'),
                         'gp': int(st.get('gamesPlayed') or 0), 'gf': int(st.get('pointsFor') or 0), 'ga': int(st.get('pointsAgainst') or 0)})
    return rows


def espn_teams(lg):
    """Alle Teams einer ESPN-Liga – gibt es auch, wo die Tabelle fehlt (Rumänien, Schweiz):
    {id: {'id','names','display','short','abbr','logo','color': (Hauptfarbe, Zweitfarbe) als Hex ohne #}}."""
    d = json.loads(get('%s/%s/teams' % (ESPN, lg), timeout=30))
    out = {}
    for x in ((d.get('sports') or [{}])[0].get('leagues') or [{}])[0].get('teams') or []:
        t = x.get('team') or {}
        if t.get('id'):
            tid = str(t['id'])
            out[tid] = {'id': tid, 'names': [n for n in (t.get('displayName'), t.get('shortDisplayName'), t.get('name'), t.get('location'),
                                                     t.get('abbreviation')) if n],
                        'display': t.get('displayName') or t.get('name'), 'short': t.get('shortDisplayName'), 'abbr': t.get('abbreviation'),
                        'logo': ((t.get('logos') or [{}])[0]).get('href'), 'color': (t.get('color'), t.get('alternateColor'))}
    return out


def name_sim(n, names, abbr=None):
    """Ähnlichkeit eines football-data-Namens zu einem ESPN-Team ohne Bilanz-Abgleich: gleicher Name = 1, sonst zählen nur
    volle Namen – Kürzel wie „HAM“ passen zu vielen Vereinen („West Ham“ ≠ Hamrun Spartans)."""
    n = FD_ALIAS.get(n, n)
    best = 0.0
    for x in names:
        if slug(x) == slug(n):
            return 1.0
        if x == abbr or (x.isupper() and len(x) <= 4):
            continue
        best = max(best, sim(n, x))
    return best


def pick_color(c1, c2):
    """Farbe für die Spiel-Karte: Hauptfarbe, außer sie ist weiß/fast weiß (dann Zweitfarbe). Kräftiges Gelb (BVB) bleibt."""
    def ok(h):
        try:
            r, g, b = (int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))
        except (TypeError, ValueError):
            return False
        return min(r, g, b) < 0.78  # alle drei Kanäle hell = weiß oder hellgrau
    for c in (c1, c2):
        if c and ok(c):
            return '#' + c.upper()
    return None


def map_teams(stats, espn_rows):
    """football-data-Name -> ESPN-Zeile. Namensähnlichkeit plus Abgleich der Bilanz (Spiele, Tore, Gegentore)."""
    cands = []
    for name, (gp, gf, ga) in stats.items():
        alias = FD_ALIAS.get(name, name)
        for r in espn_rows:
            s = max(sim(alias, n) for n in r['names'])
            same = (gp, gf, ga) == (r['gp'], r['gf'], r['ga']) and gp > 0
            near = abs(gp - r['gp']) <= 1 and abs(gf - r['gf']) + abs(ga - r['ga']) <= 3 and gp > 0
            score = s + (1.0 if same else 0.3 if near else 0.0)
            if s >= 0.5 or (same and s >= 0.2):
                cands.append((score, name, r['id'], r))
    out, used = {}, set()
    for score, name, tid, r in sorted(cands, key=lambda c: c[0], reverse=True):
        if name not in out and tid not in used:
            out[name] = r
            used.add(tid)
    return out


def espn_cup(lg, season):
    """Europapokal-Spiele einer Saison (ESPN): gespielte Spiele mit ESPN-Team-IDs, Namen und Wappen."""
    out = {}
    for y in (season, season + 1):
        try:
            d = json.loads(get('%s/%s/scoreboard?limit=1000&dates=%d' % (ESPN, lg, y)))
        except Exception as e:
            log('  %s %d: %s' % (lg, y, e))
            continue
        for e in d.get('events') or []:
            if (e.get('season') or {}).get('year') == season:
                ev = fc.norm_event(e)
                if ev:
                    for c in ((e.get('competitions') or [{}])[0].get('competitors') or []):
                        t = c.get('team') or {}
                        side = 'home' if c.get('homeAway') == 'home' else 'away'
                        ev[side]['color'] = (t.get('color'), t.get('alternateColor'))
                    out[ev['id']] = ev
    return [e for e in out.values() if e['done']]


def fm_page(league_id, season=None):
    """FotMob-Ligaseite (erlaubte Seite, kein /api) -> pageProps aus __NEXT_DATA__."""
    url = '%s/leagues/%d/overview/x%s' % (FM, league_id, '?season=' + urllib.parse.quote(season, safe='') if season else '')
    m = re.search(r'<script id="__NEXT_DATA__" type="application/json">(.*?)</script>', get(url, timeout=45), re.S)
    if not m:
        raise RuntimeError('FotMob %d: keine Daten auf der Seite' % league_id)
    return json.loads(m.group(1))['props']['pageProps']


def fm_colors(pp):
    """Vereinsfarben einer FotMob-Seite (stecken bei Teams und Spielern als teamColors) -> {Team-ID: '#RRGGBB'}."""
    out = {}

    def walk(o):
        if isinstance(o, dict):
            tc = o.get('teamColors')
            tid = o.get('teamId') or o.get('id')
            if isinstance(tc, dict) and tid and re.match(r'^#[0-9A-Fa-f]{6}$', str(tc.get('lightMode') or '')):
                out.setdefault(str(tid), tc['lightMode'])
            for v in o.values():
                walk(v)
        elif isinstance(o, list):
            for v in o:
                walk(v)
    walk(pp)
    return out


def fm_teams(pp):
    """Teams einer FotMob-Ligaseite: {ID: Name}."""
    return {str(t['id']): t.get('name') for t in ((pp.get('fixtures') or {}).get('fixtureInfo') or {}).get('teams') or [] if t.get('id')}


def fm_league(league_id):
    """Spiele einer FotMob-Liga (aktuelle Saison + Vorsaison, im Zeitfenster) im Format von league_games, dazu
    Teams {ID: {'name','short'}} und Farben."""
    pp = fm_page(league_id)
    pages = [pp]
    seasons = pp.get('allAvailableSeasons') or []
    if len(seasons) > 1:
        try:
            time.sleep(0.4)
            pages.append(fm_page(league_id, seasons[1]))
        except Exception as e:  # Vorsaison ist nur eine Zugabe
            log('  FotMob %d Vorsaison: %s' % (league_id, e))
    teams, colors, games, seen_ids = {}, {}, [], set()
    for p in pages:
        for k, v in fm_colors(p).items():
            colors.setdefault(k, v)
        season = (p.get('details') or {}).get('selectedSeason') or ''
        for m in ((p.get('fixtures') or {}).get('allMatches') or []):
            st = m.get('status') or {}
            h, a = m.get('home') or {}, m.get('away') or {}
            if not st.get('utcTime') or st.get('cancelled') or st.get('awarded') or m.get('id') in seen_ids or not h.get('name') or not a.get('name'):
                continue
            seen_ids.add(m.get('id'))
            t = datetime.fromisoformat(str(st['utcTime']).replace('Z', '+00:00'))
            if t < NOW - timedelta(days=WINDOW_DAYS):
                continue
            for x in (h, a):
                e = teams.setdefault(str(x.get('id')), {'name': x['name'], 'short': None})
                e['short'] = e['short'] or (x.get('shortName') if x.get('shortName') != x['name'] else None)
            hg = ag = None
            if st.get('finished'):
                sc = re.match(r'\s*(\d+)\s*-\s*(\d+)', st.get('scoreStr') or '')
                if not sc:
                    continue
                hg, ag = int(sc.group(1)), int(sc.group(2))
            games.append({'t': t, 'home': h['name'], 'away': a['name'], 'hg': hg, 'ag': ag, 'hx': None, 'ax': None, 'odds': None, 'season': season})
    return games, teams, colors


# ---------------------------------------------------------------- Rechnen
def load(quick=False):
    """Lädt Europapokal und alle Ligen und ordnet die Teams zu (dauert ~1 Minute)."""
    # 1) Europapokal (ESPN) zuerst: seine Teams (ESPN-IDs) verbinden die Ligen untereinander
    cup_events, cup_teams = [], {}
    for lg in CUPS:
        if quick and lg != 'uefa.champions':
            continue
        for season in (START - 1, START):
            for e in espn_cup(lg, season):
                dt = datetime.fromisoformat((e['date'] or '').replace('Z', '+00:00')) if e.get('date') else None
                if not dt or dt < NOW - timedelta(days=WINDOW_DAYS):
                    continue
                cup_events.append((dt, e))
                for side in ('home', 'away'):
                    s = e[side]
                    c = cup_teams.setdefault(s['id'], {'id': s['id'], 'names': set(), 'display': s['name'], 'short': s.get('short'),
                                                       'abbr': s.get('abbr'), 'logo': s.get('logo'), 'color': s.get('color')})
                    c['names'].update(n for n in (s['name'], s.get('short'), s.get('abbr')) if n)

    # 2) Ligen laden und jedes football-data-Team einer ESPN-ID zuordnen – in zwei Durchgängen: erst über die ESPN-Tabellen
    #    ALLER Ligen (Name + Bilanz), danach für den Rest über die Europapokal-Teams (nur sehr ähnlicher voller Name, keine
    #    Kürzel). Auf-/Absteiger stehen nur in der Tabelle ihrer neuen Liga (West Ham 2026/27: Championship) – früher griff für
    #    sie in der alten Liga schon der Europapokal-Notweg und machte aus „West Ham“ über das Kürzel „HAM“ Hamrun Spartans.
    loaded, cmap, seen = [], {}, {}
    for code, (lg, lname, country) in list(MAIN.items()) + list(NEW.items()):
        if quick and code not in QUICK:
            continue
        try:
            games = league_games(code)
        except Exception as e:
            log('  %s: %s' % (code, e))
            continue
        if not games:
            log('  %s: keine Spiele im Zeitfenster' % code)
            continue
        seasons = sorted({g['season'] for g in games if g['season']})
        cur = [g for g in games if (not seasons or g['season'] == seasons[-1]) and g['hg'] is not None]
        if code in MAIN:
            cur = [g for g in games if g['t'] >= datetime(START, 7, 1, tzinfo=timezone.utc) and g['hg'] is not None]
        stats = {}
        for g in cur:
            for n, gf, ga in ((g['home'], g['hg'], g['ag']), (g['away'], g['ag'], g['hg'])):
                s = stats.setdefault(n, [0, 0, 0])
                s[0] += 1
                s[1] += int(gf)
                s[2] += int(ga)
        try:
            emap = map_teams({k: tuple(v) for k, v in stats.items()}, espn_table(lg))
        except Exception as e:
            log('  ESPN %s: %s' % (lg, e))
            emap = {}
        try:
            eteams = espn_teams(lg)
        except Exception as e:
            log('  Teams %s: %s' % (lg, e))
            eteams = {}
        for r in emap.values():
            r['color'] = (eteams.get(r['id']) or {}).get('color')
        # ohne (vollständige) Tabelle: nur über den Namen – aber nur gegen die Teams DIESER Liga und jedes Team nur einmal
        used_l = {r['id'] for r in emap.values()}
        cands = sorted(((name_sim(n, r['names'], r['abbr']), n, r) for n in stats if n not in emap for r in eteams.values()
                        if r['id'] not in used_l), key=lambda c: -c[0])
        for sc, n, r in cands:
            if sc >= 0.75 and n not in emap and r['id'] not in used_l:
                emap[n] = r
                used_l.add(r['id'])
                log('  %s: „%s“ = %s (Teamliste der Liga)' % (lg, n, r['display']))
        cm = cmap.setdefault(country, {})
        for n, r in emap.items():
            cm.setdefault(n, r)  # ein Name = ein Team im ganzen Land (Auf-/Absteiger verbinden die Ligen)
        span = seen.setdefault(country, {})  # je Name: erstes und letztes Spiel (für umbenannte Vereine)
        for g in games:
            for n in (g['home'], g['away']):
                f, l = span.get(n, (g['t'], g['t']))
                span[n] = (min(f, g['t']), max(l, g['t']))
        loaded.append((code, lg, lname, country, games, stats))
        time.sleep(0.3)

    # 1c) Ligen von FotMob (Heimat der Europapokal-Teams aus Tschechien, Kroatien, Serbien …): Europapokal-Teams behalten
    #     ihre ESPN-ID (gleicher Name, sehr ähnlich), alle anderen bekommen eine FotMob-ID samt Wappen und Farbe
    for fid, (lg, lname, country) in ({} if quick else FM_LEAGUES).items():
        try:
            games, fteams, colors = fm_league(fid)
        except Exception as e:
            log('  FotMob %s (%s): %s' % (lname, country, e))
            continue
        if not games:
            continue
        cm = cmap.setdefault(country, {})
        taken = {r['id'] for c2 in cmap.values() for r in c2.values()}
        for tid, t in sorted(fteams.items()):
            if t['name'] in cm:
                continue
            best = max(((name_sim(t['name'], c['names'], c.get('abbr')), c) for c in cup_teams.values() if c['id'] not in taken),
                       key=lambda bc: bc[0], default=(0, None))
            col = colors.get(tid)
            if best[0] >= 0.85:
                c = best[1]
                cm[t['name']] = {'id': c['id'], 'names': sorted(set(c['names']) | {t['name']}), 'display': c['display'], 'short': c['short'],
                                 'abbr': c['abbr'], 'logo': c['logo'], 'color': c.get('color') or ((col[1:], None) if col else None)}
                taken.add(c['id'])
            else:
                cm[t['name']] = {'id': 'fm:%s' % tid, 'names': [n for n in (t['name'], t['short']) if n], 'display': t['name'], 'short': t['short'],
                                 'abbr': None, 'logo': FM_LOGO % tid, 'color': (col[1:], None) if col else None}
        cur_season = max((g['season'] for g in games), default='')
        stats = {}
        for g in games:
            if g['season'] == cur_season and g['hg'] is not None:
                for n, gf, ga in ((g['home'], g['hg'], g['ag']), (g['away'], g['ag'], g['hg'])):
                    st = stats.setdefault(n, [0, 0, 0])
                    st[0] += 1
                    st[1] += gf
                    st[2] += ga
        loaded.append(('FM%d' % fid, lg, lname, country, games, stats))
        log('  FotMob %-20s %s: %d Spiele, %d Teams' % (lname, country, sum(1 for g in games if g['hg'] is not None), len(fteams)))
        time.sleep(0.4)

    # 2b) Rest über die Europapokal-Teams: nur volle Namen (Kürzel wie „HAM“ passen zu vielen), jede ESPN-ID nur einmal
    used = {r['id'] for cm in cmap.values() for r in cm.values()}
    for country, span in seen.items():
        cm = cmap.setdefault(country, {})
        for n in sorted(set(span) - set(cm)):
            best = max(((name_sim(n, c['names'], c.get('abbr')), c) for c in cup_teams.values() if c['id'] not in used),
                       key=lambda bc: bc[0], default=(0, None))
            if best[0] >= 0.85:
                c = best[1]
                cm[n] = {'id': c['id'], 'names': sorted(c['names']), 'display': c['display'], 'short': c['short'], 'abbr': c['abbr'],
                         'logo': c['logo'], 'color': c.get('color')}
                used.add(c['id'])
                log('  %s: „%s“ = %s (über den Europapokal)' % (country, n, c['display']))
    # 2b') Wappen + Farben von FotMob für football-data-Teams, die ESPN nicht kennt (nur aktuelle Teams der Liga)
    for fid, country in ({} if quick else FM_CRESTS).items():
        try:
            pp = fm_page(fid)
        except Exception as e:
            log('  FotMob-Wappen %s: %s' % (country, e))
            continue
        cm = cmap.setdefault(country, {})
        span = seen.get(country, {})
        colors = fm_colors(pp)
        cands = sorted(((name_sim(n, [fn]), n, tid, fn) for n in span if n not in cm for tid, fn in fm_teams(pp).items() if fn), reverse=True)
        taken = set()
        for sc, n, tid, fn in cands:
            if sc < 0.75 or n in cm or tid in taken:
                continue
            col = colors.get(tid)
            cm[n] = {'id': 'fd:%s:%s' % (country, n), 'names': [n, fn], 'display': fn, 'short': None, 'abbr': None,
                     'logo': FM_LOGO % tid, 'color': (col[1:], None) if col else None}
            taken.add(tid)
        log('  %s: %d Wappen von FotMob' % (country, len(taken)))
        time.sleep(0.4)

    # 2c) umbenannte Vereine (football-data schreibt manchmal je Saison anders, z. B. „Din. Bucuresti“ → „Dinamo Bucuresti“):
    #     sehr ähnlicher Name im selben Land, der NIE gleichzeitig gespielt hat → dasselbe Team (der neuere Name zählt)
    for country, span in seen.items():
        cm = cmap.setdefault(country, {})
        for n in sorted(set(span) - set(cm), key=lambda x: span[x][1]):
            f, l = span[n]
            cands = [(sim(n, m), m) for m in span if m != n and (span[m][0] > l or span[m][1] < f) and span[m][1] > l]
            s_best, m = max(cands, default=(0, None))
            if s_best >= 0.85:
                cm[n] = cm.get(m) or {'id': 'fd:%s:%s' % (country, m), 'names': [m], 'display': None, 'short': None, 'abbr': None,
                                      'logo': None, 'color': None}
                log('  %s: „%s“ = „%s“ (umbenannt)' % (country, n, m))

    return {'cup_events': cup_events, 'cup_teams': cup_teams, 'loaded': loaded, 'cmap': cmap}


def build(data, now, upto=None):
    """Beobachtungen fürs Modell; upto = nur Spiele vor diesem Zeitpunkt (für den Backtest)."""
    obs, info, leagues = [], {}, []

    def team(tid, name=None, lg=None, row=None, logo=None, when=None):
        """Merkt Namen, Liga (mit dem Datum des letzten Spiels dort) und Wappen je Team (für die Suche in der App)."""
        t = info.setdefault(tid, {'names': set(), 'lg': {}, 'logo': None, 'display': None, 'short': None, 'abbr': None, 'w': 0.0})
        if name:
            t['names'].add(name)
        if lg and when:
            t['lg'][lg] = max(t['lg'].get(lg, when), when)
        if row:
            t['names'].update(row['names'])
            t['display'] = t['display'] or row['display']
            t['short'] = t['short'] or row['short']
            t['abbr'] = t['abbr'] or row['abbr']
            t['logo'] = t['logo'] or row['logo']
            if row.get('color') and not t.get('color'):
                t['color'] = pick_color(*row['color'])
        if logo and not t['logo']:
            t['logo'] = logo
        return t

    # 3) Beobachtungen fürs Modell
    for code, lg, lname, country, games, stats in data['loaded']:
        cm = data['cmap'].get(country, {})
        key = lambda n: cm[n]['id'] if n in cm else 'fd:%s:%s' % (country, n)  # noqa: E731
        # Tor-Schnitt der Liga (frische Spiele zählen mehr): für Quoten ohne Über/Unter-Linie. Vorher galt pauschal 2,75 –
        # Backtest 04.11.2026: Norwegen, Schweiz, USA, Österreich … lagen dadurch 0,5–1 Tor pro Spiel zu tief.
        sw = st = 0.0
        for g in games:
            if g['hg'] is not None and g['ag'] is not None and not (upto and g['t'] >= upto):
                w = fc.decay((now - g['t']).total_seconds() / 86400.0)
                sw += w
                st += w * (g['hg'] + g['ag'])
        avg_total = st / sw if sw >= 5 else None
        played = 0
        for g in games:
            h, a = key(g['home']), key(g['away'])
            team(h, g['home'], lg, cm.get(g['home']), when=g['t'])
            team(a, g['away'], lg, cm.get(g['away']), when=g['t'])
            if upto and g['t'] >= upto:
                continue
            w = fc.decay((now - g['t']).total_seconds() / 86400.0)
            if g['hg'] is not None and g['ag'] is not None:
                x, y = g['hg'], g['ag']
                if g['hx'] is not None and g['ax'] is not None:
                    x, y = (x + g['hx']) / 2, (y + g['ax']) / 2  # xG glättet Zufallstore
                obs.append((h, a, x, y, w, False))
                info[h]['w'] += w
                info[a]['w'] += w
                played += 1
            if g['odds']:
                od = g['odds'] if g['odds'].get('line') else dict(g['odds'], total=avg_total)
                lh, la = fc.market_lambdas(od, quick=True)
                obs.append((h, a, lh, la, fc.W_MARKET * w, False))
        leagues.append({'id': lg, 'code': code, 'name': lname, 'country': country, 'matches': played,
                        'teams': len(stats), 'mapped': sum(1 for n in stats if n in cm), 'src': 'fotmob' if code.startswith('FM') else 'fd'})
        log('  %-4s %-16s %4d Spiele, %2d/%2d Teams mit Wappen' % (code, lname, played, leagues[-1]['mapped'], len(stats)))

    # Europapokal: zählt dreifach
    for dt, e in data['cup_events']:
        if upto and dt >= upto:
            continue
        for side in ('home', 'away'):
            s = e[side]
            c = data['cup_teams'][s['id']]
            team(s['id'], s['name'], None, {'names': sorted(c['names']), 'display': c['display'], 'short': c['short'], 'abbr': c['abbr'],
                                            'logo': c['logo'], 'color': c.get('color')})
        w = fc.W_EURO * fc.decay((now - dt).total_seconds() / 86400.0)
        obs.append((e['home']['id'], e['away']['id'], e['hs'], e['as'], w, e.get('neutral', False)))
    cups = sum(1 for dt, e in data['cup_events'] if not upto or dt < upto)
    log('  Europapokal: %d Spiele' % cups)

    return obs, info, leagues, cups


def fit_all(obs, info):
    """Stärken aller Teams mit Liga-Niveau (Liga = Liga des letzten Spiels), Unterschiede verstärkt (SPREAD)."""
    groups = {tid: max(t['lg'], key=t['lg'].get) for tid, t in info.items() if t['lg']}
    return spread(fc.fit_ratings_lg(obs, groups, tau_l=TAU_L))


def spread(fit):
    """Stärke-Unterschiede verstärken (SPREAD, per Backtest bestimmt) – Angriff und Abwehr bleiben um 0 zentriert."""
    return dict(fit, att={t: SPREAD * v for t, v in fit['att'].items()}, **{'def': {t: SPREAD * v for t, v in fit['def'].items()}})


def main(quick=False):
    t0 = time.time()
    data = load(quick)
    obs, info, leagues, cups = build(data, NOW)
    log('Rechne Stärken aus %d Beobachtungen …' % len(obs))
    fit = fit_all(obs, info)
    # Inseln erkennen: Teams sind nur vergleichbar, wenn sie über Spiele miteinander verbunden sind (z. B. Europa über den
    # Europapokal). Brasilien, MLS, Japan … bilden eigene Gruppen – Spiele zwischen Gruppen rechnet die App nicht aus den
    # Stärken, sondern braucht Quoten bzw. die Recherche der KI.
    parent = {}

    def root(x):
        while parent.setdefault(x, x) != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x
    for o in obs:
        parent[root(o[0])] = root(o[1])
    sizes = {}
    for tid in fit['att']:
        sizes[root(tid)] = sizes.get(root(tid), 0) + 1
    order = sorted(sizes, key=lambda r: -sizes[r])
    grp = {r: i for i, r in enumerate(order)}
    teams = []
    lg_last = {}
    for t in info.values():
        for lgx, d in t['lg'].items():
            lg_last[lgx] = max(lg_last.get(lgx, d), d)
    stale = 0
    for tid, t in info.items():
        if tid not in fit['att'] or t['w'] < 0.5 and not tid.isdigit():
            continue
        lg = max(t['lg'], key=t['lg'].get) if t['lg'] else None  # Liga des letzten Spiels (Auf-/Absteiger)
        # nicht mehr in dieser Liga (abgestiegen in eine Liga, die Result AI nicht lädt): aus der Suche nehmen
        if lg and t['lg'][lg] < lg_last[lg] - timedelta(days=60):
            stale += 1
            continue
        names = sorted({n for n in t['names'] if n}, key=len)
        disp = t['display'] or (names[-1] if names else tid)
        teams.append({'id': tid, 'name': disp, 'short': t['short'] or None, 'abbr': t['abbr'] or None,
                      'alias': names[:10], 'lg': lg, 'att': round(fit['att'][tid], 4), 'def': round(fit['def'][tid], 4),
                      'logo': t['logo'], 'color': t.get('color'), 'n': round(t['w'], 1), 'grp': grp[root(tid)]})
    teams.sort(key=lambda x: -(x['att'] + x['def']))
    for L in leagues:
        gs = [t['grp'] for t in teams if t['lg'] == L['id']]
        L['grp'] = max(set(gs), key=gs.count) if gs else None
    out = {'updatedAt': NOW.strftime('%Y-%m-%dT%H:%M:%SZ'), 'season': START,
           'model': {'mu': round(fit['mu'], 4), 'h': round(fit['h'], 4), 'rho': fc.DC_RHO, 'halfLife': fc.HALF_LIFE, 'spread': SPREAD},
           'leagues': leagues, 'cups': cups, 'groups': len(order), 'teams': teams}
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False, separators=(',', ':'))
    log('Fertig: %d Teams aus %d Ligen + Europapokal (%d nicht mehr in ihrer Liga, ausgeblendet), %.0f s, %d KB' % (
        len(teams), len(leagues), stale, time.time() - t0, os.path.getsize(OUT) // 1024))
    return out


if __name__ == '__main__':
    main(quick='--quick' in sys.argv)
