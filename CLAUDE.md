# Result AI – Projektwissen für Claude

Diese Datei liest Claude in jeder neuen Sitzung automatisch. **Wer hier weitermacht: komplett lesen, dann bei „Stand“ unten
weitermachen.** Ohne Installation (z. B. fremder Laptop): im Browser **claude.ai/code** → GitHub verbinden → Repository
`result-ai` wählen. Alternativ Claude-App + Git installieren und das Repository klonen.

## Was das ist

- **Result AI:** Man wirft einen **Screenshot eines Fußballspiels** in die App. Sie rechnet aus, **zu wie viel Prozent wer
  gewinnt** und **welche Ergebnisse mit wie viel Prozent am wahrscheinlichsten sind** – und noch viel mehr (siehe Extras).
- Sehr hochwertig, mit Animationen und „Wow-Effekt“, gebaut für Niklas' **iPhone 12** (Web-App/PWA auf GitHub Pages).
  Adresse: **https://sneaxx141108-gif.github.io/result-ai/** (Pages-Quelle „GitHub Actions“, seit 03.11.2026).
  Niklas teilt sie **mit Freunden per Link**.
- Besitzer: **Niklas** (GitHub `sneaxx141108-gif`) – Fan, kein Entwickler. Antworten auf **Deutsch**, locker, verständlich,
  ohne Fachchinesisch. Fragen stellen, wenn etwas unklar ist (Niklas: „frag mich wenn nötig zu allem noch mehr“).
- Vorgänger-Projekt: die BVB-App (Repository `bvb09`, wird abgeschaltet und privat archiviert). Daraus stammen der
  Prognose-Rechner und die iPhone-Lehren – Kopien in `vorlage-bvb/` (nur Vorlage, nicht aktiver Code).

## Entscheidungen von Niklas (03.11.2026) – nicht ändern ohne Rückfrage

- **Screenshots – alle vier Arten:** Live-Spielstand (z. B. FotMob/Sofascore während des Spiels), vor dem Spiel (Paarung),
  ganzer Spieltag (mehrere Spiele auf einmal), Quoten-Screenshot (Markt-Erwartung neben eigener Rechnung zeigen).
- **Screenshot rein:** aus der **Fotos-App** und mit der **Kamera** (z. B. Fernseher). („Teilen → Result AI“ erlaubt Apple bei
  Web-Apps nicht.)
- **Live-Spiele:** nach dem Scan **automatisch live mitrechnen** (Tor/rote Karte → Prognose aktualisiert sich von selbst,
  wenn das Spiel in den Live-Daten auftaucht).
- **Sprache:** **nur Deutsch.**
- **Ligen:** **alle Fußballspiele.** „Die KI soll sehr, sehr genau alles Mögliche aus dem Internet suchen, um es so sicher und
  genau wie möglich zu berechnen.“
- **Nutzer:** Niklas + Freunde per Link → **kostenloser Cloudflare-Server** (Worker) versteckt die KI-Schlüssel.
  Das Cloudflare-Konto legt **Niklas selbst** an (Claude legt keine Konten an).
- **Zugang:** nur mit **Einladungscode** (schützt das Gratis-Kontingent vor Fremden).
- **Extras (alle gewählt):** Mehr Prognosen (Über/Unter Tore, beide Teams treffen, Halbzeitstand, Doppelchance),
  Nächstes Tor (wer und wann), Erklärung & Formcheck, Verlauf & Treffsicherheit.
- **Treffsicherheit („wie oft lag die App richtig“) ist Niklas sehr wichtig.** Gezählt werden **nur die eigenen Scans**
  jedes Nutzers (auf seinem Handy). Anzeige: Favorit gewonnen in X von Y Spielen, exaktes Ergebnis unter den Top 3 in X %,
  und vor allem die **Ehrlichkeit** (Kalibrierung): Wenn die App 70 % sagt, passiert es auch in etwa 70 % der Fälle?
- **Design:** „schon clean, aber auch nicht langweilig – es soll schon krass mit Wow-Effekt sein.“
  Erster Entwurf (Neon, Farbverläufe, drei Looks) gefiel Niklas **gar nicht** („sieht billig aus, wie Vorlage, zu bunt“).
  **Jetzt gilt (03.11.2026):** **weißer Hintergrund** als Standard, **Dunkelmodus** in den Einstellungen; Vorbilder
  **Apple Sports, FotMob/Sofascore, Revolut**; schwarze SF-Schrift, Farbe **nur von den Teams** (Spiel-Karte in
  Vereinsfarben), riesige Zahlen, gruppierte Listen wie iOS, schwarzer Haupt-Knopf. Kein Neon, keine Deko-Verläufe.
- **PFLICHT – gleiches Spiel, gleiches Ergebnis:** Scannt man am selben Tag zweimal dasselbe Spiel, muss **exakt dasselbe**
  herauskommen. (Ausnahme, gewollt: ein laufendes Spiel zu einer späteren Minute bzw. mit anderem Spielstand.)
- **KI-Schlüssel:** die **alten Schlüssel der BVB-App weiterverwenden** (Gemini, Groq) – „und so, dass es noch besser ist“
  (Idee: weitere kostenlose Ersatz-KIs mit Bild-Verständnis, z. B. OpenRouter, Mistral – Konten macht Niklas selbst).
  Schlüssel trägt **Niklas selbst** als Secret beim Cloudflare-Server ein. **Nie in den Chat, nie in den Code.**
  Hinweis: GitHub-Secrets lassen sich nicht auslesen – Gemini-Schlüssel steht in Google AI Studio, ein Groq-Schlüssel wird
  nur beim Erstellen angezeigt (ggf. neu erstellen).
- **Unbekanntes** wird ehrlich als „k. A.“ gezeigt, nie erfunden.

## Wie Result AI rechnet (Grundsatz: Mathe rechnet, die KI liest und recherchiert nur)

Eine KI, die Prozente „schätzt“, gibt bei zweimal Fragen zwei verschiedene Antworten – deshalb:

1. **KI liest den Screenshot** (Gemini Vision, Temperatur 0, festes JSON-Format): Art des Screenshots, Teams, Wettbewerb,
   Datum/Anstoß, Spielstand, Minute, rote Karten, Statistiken (Schüsse, xG, Ballbesitz), Quoten falls sichtbar.
2. **Team-Stärken aus dem täglichen Rechner** (Vorlage `vorlage-bvb/forecast.py`: Poisson + Dixon-Coles, Ergebnisse, xG,
   Buchmacher-Quoten; Daten-Abruf in `vorlage-bvb/update.py`: `football_data`, `fd_map_teams`, `espn_standings`, …).
   Ausbau von 12 auf **30+ Ligen weltweit** (football-data.co.uk Haupt- und „new leagues“-Dateien: 2./3. Ligen, Brasilien,
   Argentinien, USA, Japan, …) plus ESPN und Europapokal. **Einmal täglich frühmorgens** neu → `ratings.json`, gilt den
   ganzen Tag (→ gleiche Zahlen am selben Tag). Gewichte per Backtest (`vorlage-bvb/backtest.py`, Log-Loss) prüfen.
3. **Unbekannte Teams/Spiele** (Länderspiele, kleine Ligen, …): Gemini **mit Google-Suche** recherchiert aktuelle
   Buchmacher-Quoten (genauester öffentlicher Hinweis, Ausfälle sind eingepreist), Form, Tabelle, Ausfälle → daraus rechnet
   wieder die Mathe.
4. **Ergebnis pro Spiel und Tag auf dem Cloudflare-Server speichern** (Cloudflare KV): scannt ein Freund dasselbe Spiel am
   selben Tag, bekommt er exakt dieselben Zahlen; spart Gratis-Kontingent. Zusätzlich Cache nach Bild-Fingerabdruck.
5. **Die eigentliche Rechnung läuft in der App** (JavaScript, ohne KI, **exakt statt Zufalls-Simulation** → von Natur aus
   immer gleich): Tor-Erwartung beider Teams; live mit Restzeit, Spielstand, roten Karten → Ergebnis-Matrix →
   Sieg/Remis/Niederlage, wahrscheinlichste Ergebnisse, Über/Unter, beide treffen, Halbzeit, Doppelchance,
   nächstes Tor (wer, wann). Falls irgendwo doch simuliert wird: **fester Zufall** (siehe `SCENARIOS` in der Vorlage).
6. **Erklärung & Formcheck:** Gemini schreibt kurz und einfach, *warum* (aus den recherchierten Fakten). Die Zahlen kommen
   immer aus der Mathe.
7. **Treffsicherheit:** Scans im Handy speichern; nach Spielende echtes Ergebnis holen (ESPN-Spielplan, sonst Recherche
   über den Server) → Statistik + Kalibrierungs-Diagramm.

## Aufbau (geplant)

| Teil | Wo | Kosten |
|---|---|---|
| App (eine Seite, PWA fürs iPhone) | dieses Repository, GitHub Pages (Quelle „GitHub Actions“) | kostenlos |
| Täglicher Stärken-Rechner (`ratings.json`) | GitHub Actions in diesem Repository | kostenlos |
| Scan, Recherche, Cache, Einladungscode | Cloudflare Worker + KV, KI-Schlüssel als Secret | kostenlos (Gratis-Kontingente) |

## iPhone-12-Regeln (aus der BVB-App gelernt – unbedingt einhalten)

Am PC sah die BVB-App glatt aus, am iPhone ruckelte sie „grauenvoll“. Deshalb von Anfang an:
- Animationen nur mit `transform` und `opacity`, kurz und gezielt (Wow-Momente, z. B. beim Ergebnis), **keine Dauer-Deko**.
- Keine View Transitions (gaben schwarzes Ruckeln), kein `:active`-Zusammenziehen (beim Antippen kurz abdunkeln – sonst
  schwarze Flächen/Lichter-Blitzen), keine `filter: blur`/`drop-shadow` auf großen Flächen, `backdrop-filter` höchstens in
  einer Leiste, keine festen Extra-Ebenen hinter dem Inhalt (Licht in den `body`-Hintergrund).
- Langes Tippen ohne iOS-Menü/Textauswahl; Updates beim ersten Öffnen (Service Worker lädt am Cache vorbei, App lädt bei neuer
  Version einmal neu).
- Jede neue Animation **auf Niklas' iPhone prüfen lassen** – der PC-Browser zeigt diese Probleme nicht.

## Arbeitsweise

- Commit-Nachrichten enden mit `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Keine Passwörter, Logins oder API-Schlüssel im Chat oder im Code. Konten (Cloudflare, KI-Anbieter) legt Niklas selbst an.
- Auf einem fremden Laptop: nichts speichern lassen, am Ende bei Claude und GitHub abmelden.

## Stand (Ende 03.11.2026) – morgen genau hier weitermachen

- Erledigt: Idee und alle Entscheidungen oben mit Niklas geklärt; Repository `result-ai` angelegt; Vorlagen aus der BVB-App
  kopiert (`vorlage-bvb/`).
- **App-Grundgerüst steht und ist online:** https://sneaxx141108-gif.github.io/result-ai/ – Niklas hat sie am iPhone als App
  auf den Home-Bildschirm gelegt und getestet.
  `web/` = die App (wird per `.github/workflows/pages.yml` auf GitHub Pages gelegt, vorher laufen die Tests).
  `web/engine.js` = Rechen-Kern (exakt, ohne Zufall: Sieg/Remis/Niederlage, Top-Ergebnisse, Ergebnis-Karte, Über/Unter,
  beide treffen, Doppelchance, Halbzeit, nächstes Tor + Zeitpunkt, live mit Minute/Spielstand/roten Karten,
  Quoten → Tor-Erwartung). Tests: `node tests/engine.test.js`. `web/app.js` = Seiten: Start (Fotos/Kamera), Scan (ehrlicher
  Hinweis, solange die KI fehlt), Ergebnis, Spieltag, Treffsicherheit, Einstellungen (Hell/Dunkel). Design „Clean“ (siehe
  Entscheidungen). Beispiel-Spiele sind ausgedacht und als solche markiert. `web/sw.js`: bei jeder App-Änderung `SHELL`
  hochzählen (zuletzt `ra-shell-v3`).
- Lokal ansehen: `python -m http.server 8098 --directory web` → http://localhost:8098
- BVB-App (`bvb09`): **abgeschaltet & archiviert** (03.11.2026) – automatische Updates aus, Repository privat und archiviert,
  Website offline. Ihre KI-Schlüssel sind damit frei für Result AI. Lokaler Ordner `Dokumente/bvb09` bleibt auf Niklas' Laptop.

### Niklas' Urteil nach dem iPhone-Test (03.11.2026, abends)

> „Das Prinzip der App finde ich gut, aber es braucht Verbesserungen, was das Design angeht, und Übergänge, Animationen etc.
> Sieht vom Prinzip gut aus, die Richtung muss aber noch viel besser werden – in allem.“

→ Die Richtung (weiß/clean, Vorbilder Apple Sports, FotMob, Revolut) bleibt. Die **Qualität muss in allem deutlich hoch**:
Design, Übergänge, Animationen.

### Morgen als Erstes: Design-Runde 2 (vor Server und KI)

1. **Kurz mit Niklas klären**, was ihn am meisten stört (konkrete Stellen; gern Screenshots von Apps, die er schön findet).
   Dann **zeigen statt beschreiben** – Varianten direkt auf seinem iPhone ausprobieren lassen.
2. **Echte Vereinswappen statt Buchstaben-Kreisen** – größter Qualitätssprung (Quelle klären, z. B. ESPN-/TheSportsDB-Logos,
   Nutzungsbedingungen/robots.txt beachten; Fallback: Kreis mit Kürzel).
3. **Übergänge wie in einer iPhone-App:** Detailseite schiebt sich von rechts rein und beim Zurück wieder raus (nur
   `transform` auf **einem** Seiten-Container – keine View Transitions, die gaben bei der BVB-App schwarzes Ruckeln);
   Beispiel-Karte „wächst“ in die Spiel-Karte (Shared Element per FLIP, nur transform/opacity); Blätter mit Federung;
   vom linken Rand wischen zum Zurückgehen.
4. **Animationen mit Gefühl:** Ergebnis-Auftritt als kleine Inszenierung (Karte → Zahl zählt → Balken → Liste), Zahlen
   rollen statt springen, Scan-Animation hochwertiger (z. B. Raster/Linien über dem Screenshot, gefundene Teams werden
   markiert), Lade-Skelette, haptisches Feedback (iOS-Schalter-Trick aus der BVB-App: `hapLabel` in `docs/app.js` des archivierten
   Repositorys `bvb09`, lokal `Dokumente/bvb09`).
5. **Design-Details:** Typo-Skala und Abstände nachschärfen, Spiel-Karte edler (Farbübergang, Wappen groß), Ergebnis-Karte
   als echte Matrix-Grafik, einheitliche Icons, Startseite mit mehr Charakter (z. B. großes Live-Beispiel als Blickfang),
   Dunkelmodus genauso hochwertig.
6. **Jede Runde auf Niklas' iPhone prüfen lassen** – am PC sieht man iPhone-Ruckeln nicht. iPhone-12-Regeln oben einhalten.

### Danach (Reihenfolge)

1. Niklas: Cloudflare-Konto anlegen; Gemini-Schlüssel aus AI Studio bereithalten (alter Schlüssel), ggf. neuen Groq-Schlüssel.
2. **Täglicher Stärken-Rechner** mit 30+ Ligen + Backtest.
3. **Cloudflare Worker:** Scan (Gemini Vision), Internet-Recherche, Cache, Einladungscode, Schutz vor Überlastung.
4. **App komplett:** echter Scan-Ablauf, Verlauf & Treffsicherheit mit echten Ergebnissen, Live mitrechnen.
5. **Test auf Niklas' iPhone 12**, Feinschliff, Freunde einladen.
