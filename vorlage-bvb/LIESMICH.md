# Vorlage aus der BVB-App (nicht aktiver Code)

Kopien aus dem Repository `bvb09` (Stand 03.11.2026), als Grundlage für den täglichen Stärken-Rechner von Result AI:

- `forecast.py` – Prognose-Modell: Poisson + Dixon-Coles, Spielstärken aus Ergebnissen, xG und Wettquoten,
  fester Zufall (`SCENARIOS`), `market_lambdas` (Quoten → Tor-Erwartung), `best_tip`.
- `update.py` – Daten-Abruf: `football_data`/`fd_rows`/`fd_map_teams`/`fd_odds` (football-data.co.uk), `espn_standings`,
  `espn_season`, `domestic_tables`, `league_obs`, `build_model`, Gemini-Aufrufe mit Ersatz-KIs (`gemini_call`, `backup_check`).
- `backtest.py` – Woche-für-Woche-Backtest einer Saison (Log-Loss) zum Bestimmen der Gewichte.
- `gate.py`, `update.yml` – Zeitplan-Logik und GitHub-Actions-Workflow als Muster.
