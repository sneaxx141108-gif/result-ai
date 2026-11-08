"""Nationalteams (Niklas, 08.11.2026: „adde Länder, damit man auch auf WM und Nations League setzen kann“).

Länderspiele der letzten Jahre von ESPN → eigene Stärken für jedes Land. Länder sind eine eigene Gruppe: sie haben ihr eigenes
Tor-Niveau und ihren eigenen Heimvorteil (natModel in ratings.json) und werden nie mit Vereinen verglichen.
Einstellungen unten per Backtest bestimmt (siehe BACKTEST), nur nach erneutem Backtest ändern.
"""
import json
import math
import time
from datetime import datetime, timedelta, timezone

import forecast as fc

ESPN = 'https://site.api.espn.com/apis/site/v2/sports/soccer'
NOW = datetime.now(timezone.utc)
YEARS = 5  # so viele Kalenderjahre zurück

# ESPN-Wettbewerb -> (Name in der App, Gewicht, Kontinent; None = weltweit)
COMPS = {
    'fifa.world': ('WM', 1.0, None),
    'fifa.worldq.uefa': ('WM-Quali Europa', 1.0, 'UEFA'),
    'fifa.worldq.conmebol': ('WM-Quali Südamerika', 1.0, 'CONMEBOL'),
    'fifa.worldq.concacaf': ('WM-Quali Nordamerika', 1.0, 'CONCACAF'),
    'fifa.worldq.afc': ('WM-Quali Asien', 1.0, 'AFC'),
    'fifa.worldq.caf': ('WM-Quali Afrika', 1.0, 'CAF'),
    'fifa.worldq.ofc': ('WM-Quali Ozeanien', 1.0, 'OFC'),
    'uefa.euro': ('EM', 1.0, 'UEFA'),
    'uefa.euroq': ('EM-Quali', 1.0, 'UEFA'),
    'uefa.nations': ('Nations League', 1.0, 'UEFA'),
    'conmebol.america': ('Copa América', 1.0, 'CONMEBOL'),
    'concacaf.gold': ('Gold Cup', 1.0, 'CONCACAF'),
    'concacaf.nations.league': ('CONCACAF Nations League', 1.0, 'CONCACAF'),
    'caf.nations': ('Afrika-Cup', 1.0, 'CAF'),
    'caf.nations_qual': ('Afrika-Cup-Quali', 1.0, 'CAF'),
    'afc.asian.cup': ('Asien-Cup', 1.0, 'AFC'),
    'fifa.friendly': ('Länderspiel', None, None),  # Gewicht: W_FRIENDLY
}
# Backtest 08.11.2026 (Stärken nur bis zum Stichtag, vorhergesagt: 1.200 Länderspiele von Sep. 2025 bis Okt. 2026 inkl. WM 2026): Log-Loss 0,8532,
# Favorit in 60 % richtig. Halbwertszeit 270 Tage 0,869 · 540 Tage 0,856 · 1095 Tage 0,853; Freundschaftsspiele zählen voll (0,4: 0,855).
SETTINGS = {'half_life': 1095.0, 'w_friendly': 1.0, 'tau': 1.5, 'spread': 1.25}

# deutsche Namen (Schlüssel = ESPN-Name); was hier fehlt, bleibt englisch
DE = {
    'Germany': 'Deutschland', 'France': 'Frankreich', 'Spain': 'Spanien', 'England': 'England', 'Italy': 'Italien', 'Netherlands': 'Niederlande',
    'Portugal': 'Portugal', 'Belgium': 'Belgien', 'Croatia': 'Kroatien', 'Denmark': 'Dänemark', 'Switzerland': 'Schweiz', 'Austria': 'Österreich',
    'Poland': 'Polen', 'Sweden': 'Schweden', 'Norway': 'Norwegen', 'Czechia': 'Tschechien', 'Czech Republic': 'Tschechien', 'Slovakia': 'Slowakei',
    'Slovenia': 'Slowenien', 'Hungary': 'Ungarn', 'Romania': 'Rumänien', 'Bulgaria': 'Bulgarien', 'Greece': 'Griechenland', 'Turkey': 'Türkei', 'Türkiye': 'Türkei',
    'Ukraine': 'Ukraine', 'Russia': 'Russland', 'Serbia': 'Serbien', 'Scotland': 'Schottland', 'Wales': 'Wales', 'Republic of Ireland': 'Irland', 'Ireland': 'Irland',
    'Northern Ireland': 'Nordirland', 'Iceland': 'Island', 'Finland': 'Finnland', 'Albania': 'Albanien', 'North Macedonia': 'Nordmazedonien',
    'Montenegro': 'Montenegro', 'Bosnia-Herzegovina': 'Bosnien-Herzegowina', 'Bosnia and Herzegovina': 'Bosnien-Herzegowina', 'Georgia': 'Georgien', 'Armenia': 'Armenien',
    'Azerbaijan': 'Aserbaidschan', 'Kazakhstan': 'Kasachstan', 'Belarus': 'Belarus', 'Moldova': 'Moldau', 'Lithuania': 'Litauen', 'Latvia': 'Lettland', 'Estonia': 'Estland',
    'Cyprus': 'Zypern', 'Malta': 'Malta', 'Luxembourg': 'Luxemburg', 'Liechtenstein': 'Liechtenstein', 'Andorra': 'Andorra', 'San Marino': 'San Marino',
    'Faroe Islands': 'Färöer', 'Gibraltar': 'Gibraltar', 'Kosovo': 'Kosovo', 'Israel': 'Israel',
    'Brazil': 'Brasilien', 'Argentina': 'Argentinien', 'Uruguay': 'Uruguay', 'Colombia': 'Kolumbien', 'Chile': 'Chile', 'Peru': 'Peru', 'Ecuador': 'Ecuador',
    'Paraguay': 'Paraguay', 'Bolivia': 'Bolivien', 'Venezuela': 'Venezuela',
    'United States': 'USA', 'USA': 'USA', 'Mexico': 'Mexiko', 'Canada': 'Kanada', 'Costa Rica': 'Costa Rica', 'Panama': 'Panama', 'Honduras': 'Honduras',
    'Jamaica': 'Jamaika', 'El Salvador': 'El Salvador', 'Guatemala': 'Guatemala', 'Haiti': 'Haiti', 'Trinidad and Tobago': 'Trinidad und Tobago', 'Curacao': 'Curaçao',
    'Japan': 'Japan', 'South Korea': 'Südkorea', 'Korea Republic': 'Südkorea', 'Australia': 'Australien', 'Iran': 'Iran', 'Saudi Arabia': 'Saudi-Arabien', 'Qatar': 'Katar',
    'Iraq': 'Irak', 'United Arab Emirates': 'VAE', 'Uzbekistan': 'Usbekistan', 'Jordan': 'Jordanien', 'Oman': 'Oman', 'China': 'China', 'China PR': 'China',
    'Thailand': 'Thailand', 'Vietnam': 'Vietnam', 'India': 'Indien', 'Indonesia': 'Indonesien', 'Syria': 'Syrien', 'Lebanon': 'Libanon', 'Bahrain': 'Bahrain', 'Kuwait': 'Kuwait',
    'Palestine': 'Palästina', 'North Korea': 'Nordkorea', 'Malaysia': 'Malaysia', 'Philippines': 'Philippinen',
    'Morocco': 'Marokko', 'Senegal': 'Senegal', 'Egypt': 'Ägypten', 'Algeria': 'Algerien', 'Tunisia': 'Tunesien', 'Nigeria': 'Nigeria', 'Ghana': 'Ghana',
    'Cameroon': 'Kamerun', 'Ivory Coast': 'Elfenbeinküste', "Cote d'Ivoire": 'Elfenbeinküste', 'Mali': 'Mali', 'Burkina Faso': 'Burkina Faso', 'South Africa': 'Südafrika',
    'DR Congo': 'DR Kongo', 'Congo DR': 'DR Kongo', 'Congo': 'Kongo', 'Guinea': 'Guinea', 'Gabon': 'Gabun', 'Zambia': 'Sambia', 'Angola': 'Angola', 'Cape Verde': 'Kap Verde',
    'Cape Verde Islands': 'Kap Verde', 'Uganda': 'Uganda', 'Kenya': 'Kenia', 'Tanzania': 'Tansania', 'Mozambique': 'Mosambik', 'Namibia': 'Namibia', 'Zimbabwe': 'Simbabwe',
    'Benin': 'Benin', 'Togo': 'Togo', 'Libya': 'Libyen', 'Sudan': 'Sudan', 'Ethiopia': 'Äthiopien', 'Equatorial Guinea': 'Äquatorialguinea', 'Madagascar': 'Madagaskar', 'Mauritania': 'Mauretanien',
    'Gambia': 'Gambia', 'Sierra Leone': 'Sierra Leone', 'Liberia': 'Liberia', 'Comoros': 'Komoren', 'Botswana': 'Botswana', 'Rwanda': 'Ruanda', 'Burundi': 'Burundi', 'Malawi': 'Malawi',
    'New Zealand': 'Neuseeland', 'Fiji': 'Fidschi', 'Solomon Islands': 'Salomonen', 'Tahiti': 'Tahiti', 'New Caledonia': 'Neukaledonien', 'Papua New Guinea': 'Papua-Neuguinea',
}


def load(get, pick_color, log=print, years=YEARS):
    """Alle gespielten Länderspiele: [{t, comp, home, away, hs, as, neutral}]. get/pick_color kommen aus ratings.py."""
    out = {}
    fails = 0
    for slug in COMPS:
        for y in range(NOW.year - years + 1, NOW.year + 1):
            try:
                d = json.loads(get('%s/%s/scoreboard?limit=1000&dates=%d' % (ESPN, slug, y), timeout=45, retries=1))
            except Exception as e:
                fails += 1
                log('  %s %d: %s' % (slug, y, e))
                continue
            for e in d.get('events') or []:
                ev = fc.norm_event(e)
                if not ev or not ev['done'] or ev['hs'] is None or ev['as'] is None:
                    continue
                t = datetime.fromisoformat(str(ev['date']).replace('Z', '+00:00'))
                for c in ((e.get('competitions') or [{}])[0].get('competitors') or []):
                    tm = c.get('team') or {}
                    side = 'home' if c.get('homeAway') == 'home' else 'away'
                    ev[side]['color'] = pick_color(tm.get('color'), tm.get('alternateColor'))
                out[ev['id']] = {'t': t, 'comp': slug, 'home': ev['home'], 'away': ev['away'], 'hs': ev['hs'], 'as': ev['as'], 'neutral': ev['neutral']}
            time.sleep(0.15)
    games = sorted(out.values(), key=lambda g: g['t'])
    log('Länderspiele: %d (%d Abrufe fehlgeschlagen)' % (len(games), fails))
    return games


def observations(games, now, half_life, w_friendly):
    """Beobachtungen im Format von fc.fit_ratings_lg: (Heim, Gast, Tore, Tore, Gewicht, neutral). Jüngere und wichtigere Spiele zählen mehr."""
    obs = []
    for g in games:
        if g['t'] >= now:
            continue
        age = (now - g['t']).total_seconds() / 86400.0
        w = 0.5 ** (age / half_life) * (COMPS[g['comp']][1] or w_friendly)
        # Verlängerung/Kantersiege nicht überbewerten: mehr als 6 Tore je Team sagen nichts mehr über die Stärke aus
        obs.append((g['home']['id'], g['away']['id'], min(g['hs'], 6), min(g['as'], 6), w, g['neutral']))
    return obs


def continents(games):
    """Land -> Kontinent (aus den Wettbewerben, in denen es gespielt hat)."""
    out = {}
    for g in games:
        c = COMPS[g['comp']][2]
        if c:
            out[g['home']['id']] = c
            out[g['away']['id']] = c
    return out


def fit(games, now, s=None):
    """Stärken aller Länder bis zum Zeitpunkt now."""
    s = s or SETTINGS
    obs = observations(games, now, s['half_life'], s['w_friendly'])
    groups = continents([g for g in games if g['t'] < now])
    old = fc.TAU
    fc.TAU = s['tau']
    try:
        r = fc.fit_ratings_lg(obs, groups, tau_l=1.0)
    finally:
        fc.TAU = old
    return dict(r, att={t: s['spread'] * v for t, v in r['att'].items()}, **{'def': {t: s['spread'] * v for t, v in r['def'].items()}})


def build(get, pick_color, log=print):
    """-> (teams, natModel, Anzahl Spiele) für ratings.json. Island-Gruppe wird in ratings.py vergeben."""
    games = load(get, pick_color, log)
    if len(games) < 500:
        raise RuntimeError('zu wenige Länderspiele (%d)' % len(games))
    r = fit(games, NOW)
    info = {}
    for g in games:
        age = (NOW - g['t']).total_seconds() / 86400.0
        for side in ('home', 'away'):
            t = g[side]
            x = info.setdefault(t['id'], {'name': t['name'], 'short': t.get('short'), 'abbr': t.get('abbr'), 'logo': t.get('logo'), 'color': t.get('color'), 'n': 0.0, 'last': g['t']})
            x.update(name=t['name'], logo=t.get('logo') or x['logo'], color=t.get('color') or x['color'], last=g['t'])
            x['n'] += 0.5 ** (age / SETTINGS['half_life'])
    teams = []
    for tid, x in info.items():
        if tid not in r['att'] or x['n'] < 1.0 or x['last'] < NOW - timedelta(days=800):
            continue
        name = DE.get(x['name'], x['name'])
        teams.append({'id': tid, 'name': name, 'short': None, 'abbr': x['abbr'] or None, 'alias': sorted({x['name'], name}), 'lg': 'nat', 'nat': True,
                      'att': round(r['att'][tid], 4), 'def': round(r['def'][tid], 4), 'logo': x['logo'], 'color': x['color'], 'n': round(x['n'], 1)})
    teams.sort(key=lambda t: -(t['att'] + t['def']))
    return teams, {'mu': round(r['mu'], 4), 'h': round(r['h'], 4), 'halfLife': SETTINGS['half_life'], 'spread': SETTINGS['spread']}, len(games)


def lam(md, h, a, neutral=False):
    return math.exp(md['mu'] + (0.0 if neutral else md['h']) + h['att'] - a['def']), math.exp(md['mu'] + a['att'] - h['def'])
