"""Backtest des Prognosemodells an der Saison 2025/26: Woche fuer Woche nur mit dem Wissen bis dahin rechnen und die
Spiele der Folgewoche vorhersagen. Vergleicht Einstellungen per Log-Loss (kleiner = besser).
python -I backtest.py <scripts-ordner>"""
import json
import math
import sys
import time
from datetime import datetime, timedelta, timezone

sys.path.insert(0, sys.argv[1])
import update as up  # noqa: E402
import forecast as fc  # noqa: E402

S = 2025
T0 = time.time()


def ts(s):
    d = up.parse_dt(s)
    return d.timestamp() if d else None


# ---------------------------------------------------------------- Daten laden
fd, bl_test = [], []
code = '%02d%02d' % (S % 100, (S + 1) % 100)
for div, lg in up.FD_LEAGUES.items():
    try:
        rows = up.fd_rows('/mmz4281/%s/%s.csv' % (code, div))
        espn = up.espn_standings(lg, S)
    except Exception as e:
        print('skip', div, e)
        continue
    played = [r for r in rows if (r.get('FTHG') or '').strip() and (r.get('FTAG') or '').strip()]
    stats = {}
    for r in played:
        x, y = int(float(r['FTHG'])), int(float(r['FTAG']))
        for t, gf, ga in ((r['HomeTeam'], x, y), (r['AwayTeam'], y, x)):
            s = stats.setdefault(t, [0, 0, 0])
            s[0] += 1
            s[1] += gf
            s[2] += ga
    m = up.fd_map_teams({k: tuple(v) for k, v in stats.items()}, espn)
    for r in played:
        h, a, dt = m.get(r['HomeTeam']), m.get(r['AwayTeam']), up.fd_date(r.get('Date'))
        if not (h and a and dt):
            continue
        od = up.fd_odds(r)
        lam = fc.market_lambdas(od, quick=True) if od else None
        rec = (dt.timestamp(), h, a, int(float(r['FTHG'])), int(float(r['FTAG'])), up.fd_num(r, 'HxG'), up.fd_num(r, 'AxG'), lam, div)
        fd.append(rec)
    print('FD %s: %d Spiele, %d/%d Teams zugeordnet' % (div, len(played), len(m), len(stats)), flush=True)
euro = {}
for k, lg in (('cl', 'uefa.champions'), ('el', 'uefa.europa'), ('ecl', 'uefa.europa.conf')):
    euro[k] = [e for e in up.espn_season(lg, S) if e['done']]
    print('ESPN %s: %d Spiele' % (k, len(euro[k])), flush=True)
prev = {}
for k, lg in (('cl', 'uefa.champions'), ('bl', 'ger.1'), ('el', 'uefa.europa'), ('ecl', 'uefa.europa.conf')):
    try:
        prev[k] = [e for e in up.espn_season(lg, S - 1) if e['done']]
    except Exception as e:
        prev[k] = []
        print('prev', k, e)
prev_tables = up.domestic_tables(S - 1)
print('Daten geladen in %.0fs' % (time.time() - T0), flush=True)


# ---------------------------------------------------------------- Modell fuer einen Stichtag
def build_obs(cut, P):
    fc.HALF_LIFE = P['hl']
    obs = []
    for (t, h, a, hg, ag, hx, ax, lam, div) in fd:
        if t >= cut:
            continue
        w = fc.decay((cut - t) / 86400.0)
        x, y = float(hg), float(ag)
        if hx is not None and ax is not None:
            x, y = (1 - P['xg']) * x + P['xg'] * hx, (1 - P['xg']) * y + P['xg'] * ax
        obs.append((h, a, x, y, w, False))
        if lam:
            obs.append((h, a, lam[0], lam[1], P['wm'] * w, False))
    for k, evs in euro.items():
        for e in evs:
            t = ts(e['date'])
            if t and t < cut:
                obs.append((e['home']['id'], e['away']['id'], e['hs'], e['as'], P['weuro'] * fc.decay((cut - t) / 86400.0), e.get('neutral', False)))
    for k, evs in prev.items():
        mult = P['weuro'] if k != 'bl' else 1.0
        for e in evs:
            t = ts(e['date'])
            if t:
                obs.append((e['home']['id'], e['away']['id'], e['hs'], e['as'], P['wprev'] * mult * fc.decay((cut - t) / 86400.0), e.get('neutral', False)))
    obs += up.league_obs(prev_tables, P['wlprev'])
    return obs


def logloss(model, h, a, hs, as_, neutral):
    lh, la = model.lam(h, a, neutral)
    w, d, l = fc.outcome_probs(fc.score_matrix(lh, la))
    p = w if hs > as_ else l if hs < as_ else d
    return -math.log(max(p, 1e-9))


# Stichtage: jeder Montag, in dessen Woche Europapokal-Spiele liegen
allt = sorted(ts(e['date']) for evs in euro.values() for e in evs if ts(e['date']))
start = datetime(2025, 9, 8, tzinfo=timezone.utc)
cuts = []
d = start
while d.timestamp() < allt[-1] + 86400:
    nxt = d + timedelta(days=7)
    if any(d.timestamp() <= t < nxt.timestamp() for t in allt):
        cuts.append((d.timestamp(), nxt.timestamp()))
    d = nxt
print('Stichtage:', len(cuts), flush=True)

BASE = {'weuro': 1.0, 'wprev': 0.5, 'wlprev': 0.25, 'hl': 180.0, 'wm': 2.0, 'xg': 0.5}
VARIANTS = [
    ('heute', {}),
    ('Europapokal x2', {'weuro': 2.0}),
    ('Vorsaison 0,8', {'wprev': 0.8}),
    ('Halbwertszeit 120', {'hl': 120.0}),
    ('Europapokal x2 + Vorsaison 0,8', {'weuro': 2.0, 'wprev': 0.8}),
    ('Quoten x3', {'wm': 3.0}),
]
results = {}
final_models = {}
for name, chg in VARIANTS:
    P = dict(BASE, **chg)
    ll_e, n_e, ll_b, n_b = 0.0, 0, 0.0, 0
    t1 = time.time()
    for ci, (cut, nxt) in enumerate(cuts):
        model = fc.Model(fc.fit_ratings(build_obs(cut, P)), default=(-0.35, -0.35))
        for evs in euro.values():
            for e in evs:
                t = ts(e['date'])
                if t and cut <= t < nxt:
                    ll_e += logloss(model, e['home']['id'], e['away']['id'], e['hs'], e['as'], e.get('neutral', False))
                    n_e += 1
        for (t, h, a, hg, ag, hx, ax, lam, div) in fd:
            if div == 'D1' and cut <= t < nxt:
                ll_b += logloss(model, h, a, hg, ag, False)
                n_b += 1
        if ci == len(cuts) - 1:
            final_models[name] = model
    results[name] = (ll_e / max(1, n_e), n_e, ll_b / max(1, n_b), n_b)
    print('%-34s Europapokal %.4f (n=%d) | Bundesliga %.4f (n=%d) | %.0fs' % (name, ll_e / max(1, n_e), n_e, ll_b / max(1, n_b), n_b, time.time() - t1), flush=True)

# Staerke-Rangliste der CL-Teams am Saisonende (heute vs. beste Variante)
best = min(results, key=lambda k: results[k][0])
names = {}
for e in euro['cl']:
    names[e['home']['id']] = e['home']['name']
    names[e['away']['id']] = e['away']['name']
for nm in ('heute', best):
    mdl = final_models[nm]
    rk = sorted(names, key=lambda t: -mdl.strength(t))[:10]
    print('Top 10 Staerke (%s):' % nm, ', '.join('%s %.2f' % (names[t], mdl.strength(t)) for t in rk))
print('BESTE:', best, results[best])
json.dump(results, open(sys.argv[2] if len(sys.argv) > 2 else 'bt_results.json', 'w'), ensure_ascii=False)
