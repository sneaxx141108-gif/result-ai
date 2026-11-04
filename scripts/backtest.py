"""Ehrlicher Test des Stärken-Rechners: Stärken nur mit Spielen bis vor N Tagen rechnen und dann die Spiele der letzten N Tage
vorhersagen (alle 38 Ligen, ohne die Ergebnisse zu kennen). Vergleich mit den Schlussquoten der Buchmacher – dem genauesten
öffentlichen Maßstab – und mit der Wirklichkeit (Trefferquote, Log-Loss, Ehrlichkeit/Kalibrierung).

    python scripts/backtest.py        # letzte 28 Tage
    python scripts/backtest.py 42     # letzte 42 Tage
"""
import math
import os
import sys
import time
from datetime import timedelta

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import forecast as fc  # noqa: E402
import ratings as rt  # noqa: E402


def main(days=28):
    t0 = time.time()
    data = rt.load()
    cut = rt.NOW - timedelta(days=days)
    obs = rt.build(data, cut, upto=cut)[0]
    fit = rt.spread(fc.fit_ratings(obs))  # genau wie im täglichen Rechner
    model = fc.Model(fit)
    # Inseln: nur Spiele innerhalb einer verbundenen Gruppe zählen (wie in der App)
    parent = {}

    def root(x):
        while parent.setdefault(x, x) != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x
    for o in obs:
        parent[root(o[0])] = root(o[1])

    tot = {'n': 0, 'll': 0.0, 'hit': 0, 'nb': 0, 'llm': 0.0, 'llb': 0.0, 'hitm': 0, 'hitb': 0}
    per = {}
    cal = [[0.0, 0, 0] for _ in range(10)]  # je 10-%-Stufe: Summe vorhergesagt, Anzahl, eingetreten
    for code, lg, lname, country, games, stats in data['loaded']:
        cm = data['cmap'].get(country, {})
        key = lambda n: cm[n]['id'] if n in cm else 'fd:%s:%s' % (country, n)  # noqa: E731
        for g in games:
            if g['t'] < cut or g['hg'] is None or g['ag'] is None:
                continue
            h, a = key(g['home']), key(g['away'])
            if h not in fit['att'] or a not in fit['att'] or root(h) != root(a):
                continue
            lh, la = model.lam(h, a)
            ps = fc.outcome_probs(fc.score_matrix(lh, la))
            res = 0 if g['hg'] > g['ag'] else 1 if g['hg'] == g['ag'] else 2
            pm = ps[res]
            hit = max(range(3), key=lambda k: ps[k]) == res
            tot['n'] += 1
            tot['ll'] += -math.log(max(pm, 1e-9))
            tot['hit'] += hit
            L = per.setdefault(code, {'name': lname, 'n': 0, 'hit': 0})
            L['n'] += 1
            L['hit'] += hit
            for k in range(3):
                b = min(9, int(ps[k] * 10))
                cal[b][0] += ps[k]
                cal[b][1] += 1
                cal[b][2] += 1 if k == res else 0
            od = g['odds']
            if od:  # gleiche Spiele mit Schlussquoten: Modell gegen Markt
                pb = (od['ph'], od['pd'], od['pa'])
                tot['nb'] += 1
                tot['llm'] += -math.log(max(pm, 1e-9))
                tot['llb'] += -math.log(max(pb[res], 1e-9))
                tot['hitm'] += hit
                tot['hitb'] += max(range(3), key=lambda k: pb[k]) == res
    n, nb = tot['n'], max(1, tot['nb'])
    print('\nTest: Stärken bis %s, vorhergesagt: %d Spiele der letzten %d Tage (%.0f s)' % (cut.strftime('%d.%m.%Y'), n, days, time.time() - t0))
    print('Result AI: Favorit richtig in %.1f %% der Spiele, Log-Loss %.4f (kleiner = besser; Raten = %.4f)' % (100 * tot['hit'] / max(1, n), tot['ll'] / max(1, n), math.log(3)))
    print('Gleiche %d Spiele mit Schlussquoten: Result AI %.1f %% / %.4f  –  Buchmacher %.1f %% / %.4f' % (
        tot['nb'], 100 * tot['hitm'] / nb, tot['llm'] / nb, 100 * tot['hitb'] / nb, tot['llb'] / nb))
    print('\nEhrlichkeit (sagt Result AI x %, passiert es dann auch in etwa x % der Fälle?):')
    for i, (s, c, hits) in enumerate(cal):
        if c >= 20:
            print('  %2d–%3d %%: vorhergesagt Ø %4.1f %%, passiert %4.1f %%  (%d Fälle)' % (10 * i, 10 * i + 10, 100 * s / c, 100 * hits / c, c))
    print('\nTrefferquote je Liga (Favorit richtig):')
    for code, L in sorted(per.items(), key=lambda kv: -kv[1]['n']):
        print('  %-4s %-18s %3d Spiele  %4.1f %%' % (code, L['name'], L['n'], 100 * L['hit'] / L['n']))


if __name__ == '__main__':
    main(int(sys.argv[1]) if len(sys.argv) > 1 else 28)
