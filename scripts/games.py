"""Spielplan für Wettbuch (ohne KI): alle Fußballspiele von 5 Tagen zurück bis 16 Tage voraus aus rund 70 Ligen, Pokalen und
Länderspiel-Wettbewerben (ESPN, frei zugänglich).

Die App braucht ihn für zwei Dinge:
- Scan: Teams auf dem Wettschein → das passende Spiel (ESPN-Spiel-ID). Nur dann kann sie die Wette nach dem Abpfiff selbst abrechnen.
- Anzeige: Anstoß, Wappen und Vereinsfarben der Tipps.
Spielstände holt die App live direkt bei ESPN; hier steht zusätzlich der Endstand nach 90 Minuten (Ersatz, falls ESPN gerade hakt).

Läuft über .github/workflows/games.yml (alle 2 Stunden, dazu der Zeitgeber des Cloudflare-Servers) → web/data/games.json. Die Datei wird
nur veröffentlicht, nicht gespeichert (hält das Repository klein). Die letzten Läufe stehen in der Datei selbst (KI-Zentrale der App).
    python scripts/games.py
"""
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'web', 'data', 'games.json')
PUBLISHED = 'https://sneaxx141108-gif.github.io/result-ai/data/games.json'  # der zuletzt veröffentlichte Spielplan (für das Protokoll)
ESPN = 'https://site.api.espn.com/apis/site/v2/sports/soccer'
UA = 'Wettbuch-Spielplan/1.0 (+https://github.com/sneaxx141108-gif/result-ai)'
NOW = datetime.now(timezone.utc)
BACK, AHEAD = 5, 16  # Tage zurück (gerade gespielte Spiele für den Scan) und voraus
KEEP_RUNS = 40       # so viele Läufe zeigt die KI-Zentrale

# (ESPN-Kürzel, Name in der App, Land bzw. Gruppe) – Ligen mit Wettangebot bei den großen Anbietern
LEAGUES = [
    ('ger.1', 'Bundesliga', 'Deutschland'), ('ger.2', '2. Bundesliga', 'Deutschland'),
    ('ger.dfb_pokal', 'DFB-Pokal', 'Deutschland'),
    ('eng.1', 'Premier League', 'England'), ('eng.2', 'Championship', 'England'), ('eng.3', 'League One', 'England'),
    ('eng.4', 'League Two', 'England'), ('eng.5', 'National League', 'England'), ('eng.fa', 'FA Cup', 'England'),
    ('eng.league_cup', 'League Cup', 'England'),
    ('esp.1', 'LaLiga', 'Spanien'), ('esp.2', 'LaLiga 2', 'Spanien'), ('esp.copa_del_rey', 'Copa del Rey', 'Spanien'),
    ('ita.1', 'Serie A', 'Italien'), ('ita.2', 'Serie B', 'Italien'), ('ita.coppa_italia', 'Coppa Italia', 'Italien'),
    ('fra.1', 'Ligue 1', 'Frankreich'), ('fra.2', 'Ligue 2', 'Frankreich'), ('fra.coupe_de_france', 'Coupe de France', 'Frankreich'),
    ('ned.1', 'Eredivisie', 'Niederlande'), ('bel.1', 'Pro League', 'Belgien'), ('por.1', 'Primeira Liga', 'Portugal'),
    ('tur.1', 'Süper Lig', 'Türkei'), ('gre.1', 'Super League', 'Griechenland'), ('aut.1', 'Bundesliga', 'Österreich'),
    ('sui.1', 'Super League', 'Schweiz'), ('sco.1', 'Premiership', 'Schottland'), ('sco.2', 'Championship', 'Schottland'),
    ('sco.3', 'League One', 'Schottland'), ('sco.4', 'League Two', 'Schottland'), ('den.1', 'Superliga', 'Dänemark'),
    ('nor.1', 'Eliteserien', 'Norwegen'), ('swe.1', 'Allsvenskan', 'Schweden'), ('fin.1', 'Veikkausliiga', 'Finnland'),
    ('rou.1', 'Liga I', 'Rumänien'), ('rus.1', 'Premier Liga', 'Russland'),
    ('irl.1', 'Premier Division', 'Irland'), ('usa.1', 'MLS', 'USA'), ('mex.1', 'Liga MX', 'Mexiko'), ('bra.1', 'Série A', 'Brasilien'),
    ('arg.1', 'Liga Profesional', 'Argentinien'), ('jpn.1', 'J1 League', 'Japan'), ('chn.1', 'Super League', 'China'),
    ('ksa.1', 'Saudi Pro League', 'Saudi-Arabien'),
    ('uefa.champions', 'Champions League', 'Europapokal'), ('uefa.europa', 'Europa League', 'Europapokal'),
    ('uefa.europa.conf', 'Conference League', 'Europapokal'), ('uefa.super_cup', 'UEFA-Supercup', 'Europapokal'),
    ('conmebol.libertadores', 'Copa Libertadores', 'Südamerika'), ('conmebol.sudamericana', 'Copa Sudamericana', 'Südamerika'),
    ('fifa.cwc', 'Klub-WM', 'Welt'),
    ('fifa.world', 'WM', 'Länderspiele'), ('fifa.worldq.uefa', 'WM-Quali Europa', 'Länderspiele'),
    ('fifa.worldq.conmebol', 'WM-Quali Südamerika', 'Länderspiele'), ('fifa.worldq.concacaf', 'WM-Quali Nordamerika', 'Länderspiele'),
    ('fifa.worldq.afc', 'WM-Quali Asien', 'Länderspiele'), ('fifa.worldq.caf', 'WM-Quali Afrika', 'Länderspiele'),
    ('uefa.euro', 'EM', 'Länderspiele'), ('uefa.euroq', 'EM-Quali', 'Länderspiele'), ('uefa.nations', 'Nations League', 'Länderspiele'),
    ('conmebol.america', 'Copa América', 'Länderspiele'), ('concacaf.gold', 'Gold Cup', 'Länderspiele'),
    ('caf.nations', 'Afrika-Cup', 'Länderspiele'), ('afc.asian.cup', 'Asien-Cup', 'Länderspiele'), ('fifa.friendly', 'Länderspiel', 'Länderspiele'),
]
CUP = re.compile(r'(pokal|_cup|\.fa$|copa|coppa|coupe|uefa\.|conmebol\.|fifa\.|concacaf\.|caf\.|afc\.)')
NATIONS = {slug for slug, _, grp in LEAGUES if grp == 'Länderspiele'}

# Nationalteams auf Deutsch (Schlüssel = ESPN-Name) – so stehen sie auch auf deutschen Wettscheinen
NAT_DE = {
    'Germany': 'Deutschland', 'France': 'Frankreich', 'Spain': 'Spanien', 'Italy': 'Italien', 'Netherlands': 'Niederlande',
    'Belgium': 'Belgien', 'Croatia': 'Kroatien', 'Denmark': 'Dänemark', 'Switzerland': 'Schweiz', 'Austria': 'Österreich',
    'Poland': 'Polen', 'Sweden': 'Schweden', 'Norway': 'Norwegen', 'Czechia': 'Tschechien', 'Czech Republic': 'Tschechien',
    'Slovakia': 'Slowakei', 'Slovenia': 'Slowenien', 'Hungary': 'Ungarn', 'Romania': 'Rumänien', 'Bulgaria': 'Bulgarien',
    'Greece': 'Griechenland', 'Turkey': 'Türkei', 'Türkiye': 'Türkei', 'Russia': 'Russland', 'Serbia': 'Serbien',
    'Scotland': 'Schottland', 'Republic of Ireland': 'Irland', 'Ireland': 'Irland', 'Northern Ireland': 'Nordirland',
    'Iceland': 'Island', 'Finland': 'Finnland', 'Albania': 'Albanien', 'North Macedonia': 'Nordmazedonien',
    'Bosnia-Herzegovina': 'Bosnien-Herzegowina', 'Bosnia and Herzegovina': 'Bosnien-Herzegowina', 'Georgia': 'Georgien',
    'Armenia': 'Armenien', 'Azerbaijan': 'Aserbaidschan', 'Kazakhstan': 'Kasachstan', 'Moldova': 'Moldau', 'Lithuania': 'Litauen',
    'Latvia': 'Lettland', 'Estonia': 'Estland', 'Cyprus': 'Zypern', 'Luxembourg': 'Luxemburg', 'Faroe Islands': 'Färöer',
    'Brazil': 'Brasilien', 'Argentina': 'Argentinien', 'Colombia': 'Kolumbien', 'Bolivia': 'Bolivien', 'United States': 'USA',
    'Mexico': 'Mexiko', 'Canada': 'Kanada', 'Jamaica': 'Jamaika', 'Trinidad and Tobago': 'Trinidad und Tobago', 'Curacao': 'Curaçao',
    'South Korea': 'Südkorea', 'Korea Republic': 'Südkorea', 'Australia': 'Australien', 'Saudi Arabia': 'Saudi-Arabien',
    'Qatar': 'Katar', 'Iraq': 'Irak', 'United Arab Emirates': 'VAE', 'Uzbekistan': 'Usbekistan', 'Jordan': 'Jordanien',
    'China PR': 'China', 'India': 'Indien', 'Indonesia': 'Indonesien', 'Syria': 'Syrien', 'Lebanon': 'Libanon', 'North Korea': 'Nordkorea',
    'Philippines': 'Philippinen', 'Morocco': 'Marokko', 'Egypt': 'Ägypten', 'Algeria': 'Algerien', 'Tunisia': 'Tunesien',
    'Cameroon': 'Kamerun', 'Ivory Coast': 'Elfenbeinküste', "Cote d'Ivoire": 'Elfenbeinküste', 'South Africa': 'Südafrika',
    'DR Congo': 'DR Kongo', 'Congo DR': 'DR Kongo', 'Congo': 'Kongo', 'Gabon': 'Gabun', 'Zambia': 'Sambia', 'Cape Verde': 'Kap Verde',
    'Cape Verde Islands': 'Kap Verde', 'Kenya': 'Kenia', 'Tanzania': 'Tansania', 'Mozambique': 'Mosambik', 'Zimbabwe': 'Simbabwe',
    'Libya': 'Libyen', 'Ethiopia': 'Äthiopien', 'Equatorial Guinea': 'Äquatorialguinea', 'Madagascar': 'Madagaskar',
    'Mauritania': 'Mauretanien', 'Comoros': 'Komoren', 'Rwanda': 'Ruanda', 'New Zealand': 'Neuseeland', 'Fiji': 'Fidschi',
    'Cuba': 'Kuba', 'Dominican Republic': 'Dominikanische Republik', 'Hong Kong': 'Hongkong', 'Singapore': 'Singapur',
    'Tajikistan': 'Tadschikistan', 'Kyrgyz Republic': 'Kirgisistan', 'Yemen': 'Jemen', 'Bahrain': 'Bahrain', 'Kuwait': 'Kuwait',
}
NAT_COLOR = {'Deutschland': '#111111', 'Georgien': '#DA291C', 'Kanada': '#D52B1E'}  # ESPN-Farbe passt nicht zum Land


def log(*a):
    print(*a, flush=True)


def get(url, timeout=40, retries=2):
    last = None
    for attempt in range(retries + 1):
        try:
            req = urllib.request.Request(url, headers={'User-Agent': UA, 'Accept': 'application/json'})
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return r.read().decode('utf-8-sig', errors='replace')
        except urllib.error.HTTPError as e:
            last = 'HTTP %s' % e.code
            if e.code in (400, 404):
                break
        except Exception as e:  # Netzwerkfehler, Timeout …
            last = str(e)
        time.sleep(2 + 3 * attempt)
    raise RuntimeError('%s nicht erreichbar (%s)' % (url.split('?')[0], last))


def pick_color(c1, c2):
    """Vereinsfarbe: Hauptfarbe, außer sie ist weiß/fast weiß (dann die Zweitfarbe). Kräftiges Gelb (BVB) bleibt."""
    def ok(h):
        try:
            r, g, b = (int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))
        except (TypeError, ValueError):
            return False
        return min(r, g, b) < 0.78
    for c in (c1, c2):
        if c and ok(c):
            return '#' + c.upper()
    return None


def score(x):
    try:
        return int(float(x.get('score')))
    except (TypeError, ValueError):
        return None


def regular_time(comp, h, a):
    """Stand nach 90 Minuten plus Nachspielzeit – so wertet der Buchmacher. Tore in der Verlängerung und im Elfmeterschießen zählen
    nicht. Lässt sich das nicht sicher bestimmen → None (die App fragt dann ESPN direkt oder lässt die Wette offen)."""
    name = str((((comp.get('status') or {}).get('type')) or {}).get('name') or '')
    hs, as_ = score(h), score(a)
    if hs is None or as_ is None:
        return None
    if not re.search('AET|PEN|EXTRA|SHOOTOUT', name, re.I):
        return hs, as_
    sides = {str((c.get('team') or {}).get('id')): c.get('homeAway') for c in comp.get('competitors') or []}
    details = comp.get('details')
    if not details:
        return None
    x = y = 0
    for d in details:
        if not d.get('scoringPlay') or d.get('shootout'):
            continue
        m = re.match(r'\s*(\d+)', str((d.get('clock') or {}).get('displayValue') or ''))  # Nachspielzeit steht als 90'+3', die Verlängerung ab 91'
        if not m:
            return None
        if int(m.group(1)) > 90:
            continue
        side = sides.get(str((d.get('team') or {}).get('id')))  # bei Eigentoren nennt ESPN das Team, dem das Tor zählt
        if side == 'home':
            x += 1
        elif side == 'away':
            y += 1
        else:
            return None
    return x, y


def fetch(slug):
    """Alle Spiele der Monate im Zeitraum (ESPN kennt keine Tages-Spanne, nur ganze Monate)."""
    months = sorted({(x.year, x.month) for x in (NOW - timedelta(days=BACK), NOW, NOW + timedelta(days=AHEAD))})
    out = []
    for y, mo in months:
        d = json.loads(get('%s/%s/scoreboard?dates=%d%02d&limit=500' % (ESPN, slug, y, mo)))
        out.extend(d.get('events') or [])
        time.sleep(0.15)
    return out


def main():
    t0 = time.time()
    via = os.environ.get('RA_VIA') or 'hand'
    try:
        prev = json.loads(get('%s?nc=%d' % (PUBLISHED, time.time()), timeout=30, retries=1))
    except (RuntimeError, ValueError) as e:
        log('Letzter Spielplan nicht lesbar (%s) – das Protokoll fängt neu an.' % e)
        prev = {}
    old_ids = {r[0] for r in prev.get('games') or []}
    old_done = {r[0] for r in prev.get('games') or [] if r[5] == 2}

    teams, games, leagues, fails = {}, {}, {}, []
    lo_t, hi_t = NOW - timedelta(days=BACK), NOW + timedelta(days=AHEAD)
    for slug, name, grp in LEAGUES:
        try:
            events = fetch(slug)
        except (RuntimeError, ValueError) as e:
            log('  %s: %s' % (slug, e))
            fails.append(slug)
            continue
        n = 0
        for e in events:
            comp = (e.get('competitions') or [{}])[0]
            side = {c.get('homeAway'): c for c in comp.get('competitors') or []}
            h, a = side.get('home'), side.get('away')
            gid = str(e.get('id') or '')
            try:
                t = datetime.fromisoformat(str(e.get('date')).replace('Z', '+00:00'))
            except ValueError:
                continue
            if not h or not a or not gid or gid in games or not (lo_t <= t <= hi_t):
                continue
            st = ((comp.get('status') or e.get('status') or {}).get('type')) or {}
            nm = str(st.get('name') or '')
            code = 3 if re.search('POSTPON|CANCEL|ABANDON|SUSPEND|FORFEIT|DELAY', nm, re.I) else 2 if st.get('completed') else 1 if st.get('state') == 'in' else 0
            r90 = regular_time(comp, h, a) if code == 2 else None
            ids = []
            for c in (h, a):
                tm = c.get('team') or {}
                tid = str(tm.get('id') or '')
                ids.append(tid)
                if tid in teams:
                    if teams[tid][5] in NATIONS or CUP.search(teams[tid][5]):  # Heimat-Liga statt Pokal
                        if not CUP.search(slug):
                            teams[tid][5] = slug
                    continue
                full = tm.get('displayName') or tm.get('name') or '?'
                de = NAT_DE.get(full) if slug in NATIONS else None
                logo = tm.get('logo') or ((tm.get('logos') or [{}])[0]).get('href')
                color = NAT_COLOR.get(de) if de else None
                teams[tid] = [de or full, None if de else (tm.get('shortDisplayName') or None), tm.get('abbreviation') or None,
                              logo or None, color or pick_color(tm.get('color'), tm.get('alternateColor')), slug]
                if de and de != full:
                    teams[tid].append(full)  # englischer Name als zweiter Suchbegriff
            games[gid] = [gid, slug, t.strftime('%Y-%m-%dT%H:%MZ'), ids[0], ids[1], code, r90[0] if r90 else None, r90[1] if r90 else None]
            n += 1
        if n:
            leagues[slug] = [name, grp]
        time.sleep(0.25)

    rows = sorted(games.values(), key=lambda r: (r[2], r[0]))
    if len(rows) < 30:  # irgendetwas stimmt nicht (ESPN gesperrt?) – lieber den alten Spielplan stehen lassen
        log('Nur %d Spiele gefunden – Spielplan bleibt, wie er ist.' % len(rows))
        sys.exit(1)
    run = {'t': NOW.strftime('%Y-%m-%dT%H:%M:%SZ'), 'sec': round(time.time() - t0), 'games': len(rows), 'leagues': len(leagues),
           'fail': len(fails), 'new': len([r for r in rows if r[0] not in old_ids]) if old_ids else None,
           'done': len([r for r in rows if r[5] == 2 and r[0] not in old_done]) if old_ids else None, 'via': via}
    runs = [x for x in (prev.get('runs') or []) if isinstance(x, dict) and x.get('t')][-(KEEP_RUNS - 1):] + [run]
    out = {'updatedAt': run['t'], 'from': lo_t.strftime('%Y-%m-%d'), 'to': hi_t.strftime('%Y-%m-%d'),
           'leagues': leagues, 'teams': teams, 'games': rows, 'runs': runs}
    with open(OUT, 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False, separators=(',', ':'))
    log('%d Spiele aus %d Wettbewerben, %d Teams, %d nicht erreichbar (%.0f s)' % (len(rows), len(leagues), len(teams), len(fails), time.time() - t0))


if __name__ == '__main__':
    main()
