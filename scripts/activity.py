"""Protokoll der automatischen Rechner für die KI-Zentrale der App (web/data/activity.json).

Jeder Lauf (Tipp-Suche, Stärken-Rechner) hängt einen Eintrag an: wann, wie lange, ob alles geklappt hat, Zahlen und was neu
dazukam. Aufbewahrt werden 14 Tage; die Einzelheiten (welche Tipps, welche Teams) nur 3 Tage, damit die Datei klein bleibt.
"""
import json
import os
from datetime import datetime, timedelta, timezone

PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'web', 'data', 'activity.json')
KEEP_DAYS = 14
DETAIL_DAYS = 3


def _when(s):
    try:
        return datetime.fromisoformat(str(s).replace('Z', '+00:00'))
    except ValueError:
        return None


def load():
    try:
        with open(PATH, encoding='utf-8') as f:
            return json.load(f).get('runs', [])
    except (OSError, ValueError):
        return []


def log_run(job, now, sec, summary, details=None, ok=True):
    """Eintrag anhängen. job: 'tips' | 'ratings'; summary: kleine Zahlen; details: Listen (werden nach 3 Tagen entfernt)."""
    runs = [r for r in load() if _when(r.get('t')) and _when(r['t']) > now - timedelta(days=KEEP_DAYS)]
    entry = {'t': now.strftime('%Y-%m-%dT%H:%M:%SZ'), 'job': job, 'ok': ok, 'sec': round(sec), 'sum': summary}
    if details:
        entry.update(details)
    runs.append(entry)
    for r in runs:  # alte Einträge: nur noch die Zahlen
        if _when(r['t']) < now - timedelta(days=DETAIL_DAYS):
            for k in ('added', 'results', 'movers', 'newTeams'):
                r.pop(k, None)
    runs.sort(key=lambda r: r['t'])
    with open(PATH, 'w', encoding='utf-8') as f:
        json.dump({'updatedAt': entry['t'], 'runs': runs}, f, ensure_ascii=False, separators=(',', ':'))
    return runs


def today_summary(runs, now):
    """Für das Abzeichen in der App: heutige Läufe, neue Tipps, ausgewertete Tipps (deutsche Zeit ≈ UTC+1)."""
    start = (now + timedelta(hours=1)).replace(hour=0, minute=0, second=0, microsecond=0) - timedelta(hours=1)
    today = [r for r in runs if _when(r['t']) >= start]
    return {'runs': len(today), 'newTips': sum((r.get('sum') or {}).get('new', 0) for r in today if r['job'] == 'tips'),
            'checked': sum((r.get('sum') or {}).get('checked', 0) for r in today if r['job'] == 'tips'),
            'last': runs[-1]['t'] if runs else None}


if __name__ == '__main__':  # kurzer Blick ins Protokoll
    for r in load()[-10:]:
        print(r['t'], r['job'], r.get('sum'))
    print(today_summary(load(), datetime.now(timezone.utc)))
