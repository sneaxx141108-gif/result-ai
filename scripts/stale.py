"""Wie alt ist eine veröffentlichte Daten-Datei? Gibt die Minuten seit ihrem updatedAt aus (99999, wenn nicht erreichbar).
Für die Workflows: Ersatz-Läufe laufen nur, wenn die letzte veröffentlichte Suche zu alt ist.
    python3 scripts/stale.py https://sneaxx141108-gif.github.io/result-ai/data/tips.json
"""
import json
import sys
import time
import urllib.request
from datetime import datetime, timezone

try:
    req = urllib.request.Request('%s?nc=%d' % (sys.argv[1], time.time()), headers={'User-Agent': 'ResultAI-Stats/1.0 (+https://github.com/sneaxx141108-gif/result-ai)'})
    data = json.loads(urllib.request.urlopen(req, timeout=20).read().decode('utf-8'))
    t = datetime.fromisoformat(data['updatedAt'].replace('Z', '+00:00'))
    print(int((datetime.now(timezone.utc) - t).total_seconds() // 60))
except Exception:  # nicht erreichbar oder kaputt → so tun, als wäre sie uralt (dann wird gerechnet)
    print(99999)
