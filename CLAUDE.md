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
  hochzählen (zuletzt `ra-shell-v7`).
- Lokal ansehen: `python -m http.server 8098 --directory web` → http://localhost:8098
- BVB-App (`bvb09`): **abgeschaltet & archiviert** (03.11.2026) – automatische Updates aus, Repository privat und archiviert,
  Website offline. Ihre KI-Schlüssel sind damit frei für Result AI. Lokaler Ordner `Dokumente/bvb09` bleibt auf Niklas' Laptop.

### Niklas' Urteil nach dem iPhone-Test (03.11.2026, abends)

> „Das Prinzip der App finde ich gut, aber es braucht Verbesserungen, was das Design angeht, und Übergänge, Animationen etc.
> Sieht vom Prinzip gut aus, die Richtung muss aber noch viel besser werden – in allem.“

→ Die Richtung (weiß/clean, Vorbilder Apple Sports, FotMob, Revolut) bleibt. Die **Qualität muss in allem deutlich hoch**:
Design, Übergänge, Animationen.

### Design-Runde 2 umgesetzt (04.11.2026)

- **Echte Vereinswappen** (ESPN, verkleinert über `a.espncdn.com/combiner/i?img=/i/teamlogos/soccer/500/<id>.png&w=..&h=..`,
  im Dunkelmodus `500-dark`); Team-IDs und Vereinsfarben in `TEAMS` (`web/app.js`). Lädt ein Wappen nicht: Kreis mit Kürzel.
  Der Service Worker speichert Wappen dauerhaft (`ra-img-v1`). Auf Vereinsfarbe stehen Wappen auf weißen Plaketten.
- **Seiten wie in einer iPhone-App:** Seiten-Stapel (`.stack > .page`, jede Seite scrollt selbst, Scrollstand bleibt erhalten);
  neue Seite schiebt sich von rechts herein, alte rückt nach links und wird leicht abgedunkelt (Web Animations, nur
  `transform`/`opacity`). **Sicherung `settle`:** hakt das Handy oder geht die App in den Hintergrund, wird jeder Wechsel
  nach spätestens ~1 s zu Ende gebracht. **Vom linken Rand wischen = zurück** (folgt dem Finger, schnappt zurück, wenn zu kurz).
  Direktlink (z. B. `#/r/pre`): Startseite liegt unsichtbar darunter, „Zurück“ führt dorthin.
- **Kopfleiste ohne Glas-Unschärfe** (backdrop-filter bricht in verschobenen Ebenen): oben unsichtbar, beim Scrollen feine
  Linie + kleiner Titel (wie iOS).
- **Ergebnis-Auftritt:** Karte → große Zahl rollt wie ein Zählwerk (Ziffern-Rollen, nur `transform`) → Balken → Liste.
- **Haptik:** leichtes Tick beim Antippen, beim Zurückwischen und beim Umschalten (iOS-Schalter-Trick, iOS 18+).
- **Startseite:** schwarze Scan-Karte (Fotos/Kamera), Beispiel-Karten in Vereinsfarben mit Wappen; Einstellungen als Blatt
  mit Federung, zum Schließen nach unten ziehen; Scan-Ansicht mit Sucher-Ecken, Raster und Lade-Kreisel.
- **Testen am PC:** im Browser-Fenster von Claude (Maße stimmen). Bilder aus Headless Chrome sind auf diesem Laptop
  unbrauchbar (Windows-Skalierung vergrößert die App). Echte Prüfung bleibt Niklas' iPhone.

### Design-Runde 3 (04.11.2026, Niklas: „Die Richtung ist super! Nur bitte upgrade das Design deutlich“)

- **Weiße Karten schweben auf ganz hellem Grau** (`--bg: #F2F2F7`, Karten `#FFFFFF` mit weichem Schatten; dunkel: schwarz +
  `#1C1C1E`) – wie Revolut/FotMob/Apple. Ergebnis-Seite ist eine Folge von Karten, die nacheinander aufsteigen.
- **Spiel-Karten wie eine TV-Grafik** (`.teamcard`): scharfer Schnitt zwischen den Vereinsfarben mit heller Naht, große
  Wappen als Wasserzeichen, leichter Glanz; Spielstand auf dunkler Kapsel über der Naht; Wappen gleiten beim Öffnen herein.
- **Prognose-Karte:** große rollende Zahl + Abzeichen in Vereinsfarbe („Klarer Favorit“ / „Favorit“ / „Leicht vorne“ /
  „Offenes Spiel“), Balken, Legende mit Wappen.
- **Top-Ergebnis als Anzeigetafel** mit Wappen und „etwa jedes 10. Spiel endet so“, darunter die nächsten 5.
- **Ergebnis-Karte in Teamfarben** (Heimsieg = Heimfarbe, Auswärtssieg = Gastfarbe, Remis = Grau).
- **Tore im Spiel:** Balkendiagramm 0–6+ Tore (Rechen-Kern: `totals`), Kacheln Über 1,5/2,5/3,5 + beide treffen.
- **Nächstes Tor:** wer trifft + **Tor-Kurve** (Chance auf ein Tor bis Minute x, Rechen-Kern: `next.curve`), 10/20/30 Min.
- **„So kommt die Zahl zustande“:** erwartete Tore je Team mit Wappen + Text.

### Täglicher Stärken-Rechner (04.11.2026, gebaut während Niklas' Essenspause)

- `scripts/ratings.py` (nur Standardbibliothek, ohne KI) rechnet **jeden Morgen um 3:30 UTC** (`.github/workflows/ratings.yml`,
  danach wird die App mit veröffentlicht) die Stärken von **~770 Teams aus 38 Ligen** + Europapokal → `web/data/ratings.json`
  (~170 KB). Modell = `scripts/forecast.py` aus der BVB-App (Poisson, xG halb gemischt, Europapokal ×3, Zeitfenster 450 Tage).
  Gleicher Tag = gleiche Stärken = gleiche Zahlen.
- **Einstellungen per Backtest** (`scripts/backtest.py`, 04.11.2026: Stärken bis vor 28/56 Tagen, dann 1.406/2.246 echte Spiele
  aller 38 Ligen vorhergesagt): Quoten ×8, Zug zur Mitte 1,5, Halbwertszeit 120 Tage, Stärke-Unterschiede ×1,25 (`SPREAD`).
  Ergebnis 28 Tage: **Favorit richtig 54,0 %** (Buchmacher-Schlussquoten 56,2 %, Raten 33 %), Log-Loss 0,994 → **0,984**
  (Buchmacher 0,964); vorher war das Modell bei klaren Favoriten zu vorsichtig. Nur nach erneutem Backtest ändern.
  Folgerung: Wo Quoten zu einem Spiel bekannt sind, sind sie genauer als die Stärken → in der App bevorzugen.
- Quellen: football-data.co.uk (22 europäische Ligen inkl. 2.–5. Liga England, Schottland 1–4, je zwei Saison-Dateien mit xG +
  16 weitere Ligen aus `/new/<Land>.csv`), ESPN (Tabellen für die Team-Zuordnung, alle CL/EL/ECL-Spiele).
  football-data erlaubt normale Programme (robots.txt sperrt nur KI-Trainings-Crawler) – der Rechner meldet sich ehrlich als
  `ResultAI-Stats/1.0`, nie als Browser verkleiden.
- **Team-Zuordnung:** football-data-Name → ESPN-Team-ID (Name + Bilanz; sonst Europapokal-Team mit sehr ähnlichem Namen);
  ein Name gilt landesweit (Auf-/Absteiger verbinden 1. und 2. Liga). Je Team: `id`, `name`, `short`, `abbr`, `alias` (für
  die Zuordnung der Screenshots), `lg`, `att`, `def`, `logo`, `n` (Spiel-Gewicht), `grp`. Lücken: Finnland, Irland, Polen
  (ESPN-Tabelle fehlt), Rumänien, Schweiz nur teilweise mit Wappen (Fallback Kreis mit Kürzel).
- **Inseln (`grp`):** Teams sind nur vergleichbar, wenn sie über Spiele verbunden sind. Gruppe 0 = alle 31 europäischen Ligen
  (über den Europapokal verbunden); Argentinien, MLS, Brasilien, Japan, Mexiko, Russland, China sind eigene Gruppen.
  **Spiele zwischen Gruppen nicht aus den Stärken rechnen** → Quoten bzw. KI-Recherche (ehrlich „k. A.“, wenn nichts da).
- Tor-Erwartung (in der App eingebaut, `calcPick`): `exp(mu + h + att[heim] - def[gast])` bzw. `exp(mu + att[gast] - def[heim])`
  (`h` = 0 bei neutralem Platz; Stärken × `SPREAD` sind in `ratings.json` schon eingerechnet). Danach rechnet `web/engine.js`.
- Vereinsfarben kommen aus ESPN (`/teams` je Liga, `pick_color`: Weiß/Hellgrau übersprungen) → `color` (652 von 773 Teams).
- Noch offen: Name aus dem Screenshot → Team (KI-Scan, `searchTeams`), weitere Ligen/Länderspiele, Wappen für
  FIN/IRL/POL/ROU/SUI.

### Spiel selbst auswählen (04.11.2026, abends – Niklas: „mach noch was“)

- Startseite → **„Spiel selbst auswählen“** (`#/pick`, `vPick` in `web/app.js`): Heim und Gast über eine Team-Suche wählen
  (Blatt mit Suchfeld, „Zuletzt gewählt“ + „Beliebt“), Tauschen-Knopf, **Neutraler Platz**, **Spiel läuft schon** (Minute per
  Regler, Tore und rote Karten per +/−). „Prognose berechnen“ rechnet mit den Stärken von heute und öffnet die normale
  Ergebnis-Seite; das Spiel landet im Verlauf (mit Wappen/Farben in `teams`, damit es nach dem Neustart gleich aussieht).
  Gleiche Eingaben am selben Tag = gleiche ID (`p_<heim>_<gast>_<h|n>_<vor|min-stand-rot>_<tag>`) = gleiche Zahlen.
- **Suche** (`searchTeams`): ohne Akzente/Groß-Klein, Spitznamen in `NICK` (BVB, FCB, S04, HSV, SGE, Effzeh …, Wert = ESPN-ID → steht ganz oben), deutsche Anzeigenamen in
  `DE` (Köln, Inter Mailand, Roter Stern Belgrad, Rapid Wien … – Schlüssel = Name in `ratings.json`); ESPN-Kürzel wie
  „D Dresden“ werden durch den vollen Namen ersetzt (`tName`). Wappen/Farben fremder Teams laufen über `REG` + `logoSrc`.
- **Ehrlich:** Teams aus verschiedenen Inseln (`grp`, z. B. Flamengo gegen Bayern) werden nicht gerechnet – Hinweis statt
  geratener Zahlen. Rote Karten stehen als Kärtchen am Wappen und als „Bayern zu zehnt“ im Untertitel.
- Die Stärken lädt die App 1,2 s nach dem Start im Hintergrund (`loadRatings`), der Service Worker holt `/data/` immer zuerst
  frisch aus dem Netz.

### Ursprünglicher Plan Design-Runde 2 (Punkte 2–5 umgesetzt, 6 offen)

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
6. **Treffsicherheit überarbeiten – das Prinzip und die Seite** (Niklas, 03.11.2026 abends: „die Treffsicherheit muss
   geupdatet werden, das Prinzip und so“). Zuerst mit Niklas klären, was genau ihn stört. Mögliche Punkte:
   - Die Seite ist am Anfang leer (es zählen nur eigene, schon beendete Scans) → wenig Wert. Idee: zusätzlich eine ehrliche
     Bilanz aus vergangenen Spielen (Backtest, z. B. „in 5.000 Spielen lag Result AI so oft richtig“). **Achtung:** Niklas
     hatte „jeder nur seine eigenen Scans“ gewählt – das nur nach Rückfrage ändern.
   - Verständlicher und visueller: eine große Trefferquote, die letzten Scans mit ✓/✗, Serien, nach Ligen, „Ehrlichkeit“
     einfacher erklärt (Diagramm nur, wenn genug Spiele da sind).
   - Ergebnis nach Spielende automatisch prüfen und den Scan im Verlauf als richtig/falsch markieren.
7. **Jede Runde auf Niklas' iPhone prüfen lassen** – am PC sieht man iPhone-Ruckeln nicht. iPhone-12-Regeln oben einhalten.

### Danach (Reihenfolge)

1. Niklas: Cloudflare-Konto anlegen; Gemini-Schlüssel aus AI Studio bereithalten (alter Schlüssel), ggf. neuen Groq-Schlüssel.
2. ~~Täglicher Stärken-Rechner mit 30+ Ligen + Backtest~~ – erledigt, in der App als „Spiel selbst auswählen“.
3. **Cloudflare Worker:** Scan (Gemini Vision), Internet-Recherche, Cache, Einladungscode, Schutz vor Überlastung.
4. **App komplett:** echter Scan-Ablauf, Verlauf & Treffsicherheit mit echten Ergebnissen, Live mitrechnen.
5. **Test auf Niklas' iPhone 12**, Feinschliff, Freunde einladen.
