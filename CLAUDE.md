# Result AI – Projektwissen für Claude

Diese Datei liest Claude in jeder neuen Sitzung automatisch. **Wer hier weitermacht: komplett lesen, dann bei
„HIER WEITERMACHEN“ (unter „Arbeitsweise“) anfangen.** Ohne Installation (z. B. fremder Laptop): im Browser **claude.ai/code** → GitHub verbinden → Repository
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
  **Seit 06.11.2026 (Niklas):** Verlauf + **Erfolgsquote** zählen die Wetten, die man aus den Top-Tipps speichert – ausgewertet
  nur automatisch nach dem Abpfiff (siehe „Wetten, Empfohlen, Cloudflare-Server“).
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
- Reihenfolge beim Hochladen: erst committen, dann `git pull --rebase -X theirs`, dann `git push` (der Bot committet mehrmals
  pro Stunde Bilanz/Protokoll/Stärken nach `web/data/`).
- Nach App-Änderungen `SHELL` in `web/sw.js` hochzählen und alle Seiten im Browser bei iPhone-Breite (390 px) durchklicken
  (keine Fehler in der Konsole, kein seitliches Überlaufen).
- **„Mach noch was“** (Niklas): erst die laufende Aufgabe ganz fertig machen, dann selbst die nächste sinnvolle Sache wählen und
  am Ende kurz berichten.
- Unter Windows: größere Änderungen per kleinem Python-Skript statt Bash-Heredoc (Backslashes/Backticks gingen dort kaputt).

## HIER WEITERMACHEN – Stand 06.11.2026, abends (am Laptop)

**So geht's am Laptop los:** Claude öffnen → Repository `result-ai` (Ordner klonen: `git clone
https://github.com/sneaxx141108-gif/result-ai`, oder ohne Installation im Browser **claude.ai/code** → GitHub verbinden →
`result-ai`). Diese Datei wird automatisch gelesen – Claude weiß dann alles. Erster Satz an Claude reicht, z. B.
„Lies CLAUDE.md und mach bei HIER WEITERMACHEN weiter“.
- Auf dem Laptop liegt der Ordner unter `C:\Users\j.banholzer\result-ai` (NICHT in „Dokumente“ – das ist dort der
  Firmen-OneDrive „fashionette AG“ und würde in die Firmen-Cloud hochladen). In einem sehr langen Ordnerpfad (z. B. dem
  Sitzungsordner der Claude-App) scheitert `git clone` mit „'$GIT_DIR' too big“ – dann einen kurzen Pfad nehmen.
- Node.js ist auf dem Laptop nicht installiert (Tests laufen auf GitHub); lokal ansehen: `.claude/launch.json` (Python-Server, Port 8098).

**Neu am 06.11.2026 abends (gebaut im Zweig `wett-tracker`, seit spätabends in `main` und online; siehe Abschnitt „Wetten,
Empfohlen, Cloudflare-Server“):** Wett-Tracker mit
Guthaben (Bereich „Wetten“ unten), Speichern-Knopf bei Top-Tipps und Kombis, automatische Prüfung nach Abpfiff, Erfolgsquote im
Verlauf, Kategorie „Empfohlen“, Wettbewerbs-Leiste in den Top-Tipps entfernt, Cloudflare-Server (`worker/worker.js`) für
Wettschein-Scan und als Zeitgeber der Tipp-Suche.

**Erledigt am 06.11.2026 spätabends:** Cloudflare eingerichtet und der Zweig `wett-tracker` in `main` übernommen (online).
- Server: **https://result-ai.sneaxx141108.workers.dev** (Konto von Niklas, Worker `result-ai`, Gratis-Tarif). `GET /` zeigt
  `ki`, `zeitgeber`, `einladung` – am 06.11. alle `true`. Cron Trigger **alle 30 Minuten** (im Dashboard: Settings → Trigger events).
- Geheimnisse hat Niklas selbst eingetragen (Settings → Variables and secrets): `GEMINI_API_KEY` (neuer Schlüssel „Result AI“
  aus Google AI Studio, Gratis-Stufe), `GITHUB_TOKEN` (fine-grained „result-ai Zeitgeber“, nur `result-ai`, Actions: Read and
  write – **läuft ab**, Datum unter github.com/settings/personal-access-tokens; vorher neu erzeugen und in Cloudflare ersetzen),
  `INVITE_CODES` (Code kennt nur Niklas, er gibt ihn Freunden).
- Worker-Code aktualisieren: Claude kann im Cloudflare-Editor nicht selbst einfügen (Einfügen aus der Zwischenablage wird
  blockiert). Ablauf: Claude legt `worker/worker.js` in die Zwischenablage (`Get-Content -Raw … | Set-Clipboard`), Niklas klickt
  im Editor (Workers & Pages → result-ai → Edit code) in den Code, Strg+A, Strg+V, Deploy. Schlüssel tippt Claude nie ein.

**Offen, in dieser Reihenfolge (ab 07.11.2026):**
1. **Auf Niklas' iPhone prüfen:** Bereich „Wetten“ (Guthaben eintragen, Wette eintragen, Top-Tipp speichern), „Empfohlen“,
   Verlauf + Erfolgsquote; in den Einstellungen den **Einladungscode** eintragen (✓ „Code passt“) und den **Wettschein-Scan**
   mit einem echten Wettschein testen (KI liest Teams, Tipps, Quoten, Einsatz).
2. **KI-Zentrale:** Tipp-Suche läuft wieder stündlich? Im Protokoll muss „vom Zeitgeber“ stehen, Zeitgeber-Zeile „verbunden“.
3. **3. Ligen prüfen:** In der App unter „Auswählen“ z. B. „Viktoria Köln“, „Saarbrücken“, „Real Zaragoza“, „Bari“ suchen →
   Wappen, Liga „3. Liga · Deutschland“ usw.
4. **Cloudflare Worker ausbauen:** echter Spiel-Screenshot-Scan mit Gemini (Spielstand, Minute, Teams → Prognose).
5. Kleinere Ideen: Quoten der Europapokal-Spiele archivieren (siehe „Vereine & Wappen“), danach Backtest.

### Stand 06.11.2026, nachmittags (vor dem Wett-Tracker)

**Fertig und online** (alles ohne KI-Schlüssel, alles automatisch auf GitHub Actions):
- Startseite mit Begrüßung, Tipp des Tages, Top-Tipps-Karten, KI-Zentrale (oben rechts), „Spiel selbst auswählen“ (über 1.000
  Teams), Top-Tipps (Sicher, Top-Quote, Kombis inkl. CL- und Bundesliga-Kombi, Bilanz), Verlauf, Einstellungen (Name, Hell/Dunkel/Auto).
- **Neu heute: 3. Ligen der Top-5-Länder** (3. Liga, Primera Federación, Serie C, Ligue 3) – siehe Abschnitt unten. Sie tauchen
  **ab morgen früh** (erster Stärken-Lauf des Tages) in der App auf; heute nicht mehr, weil gilt: gleiches Spiel am selben Tag =
  gleiche Zahlen (die Stärken von heute standen schon).
- **Automatik:** Tipp-Suche jetzt mit Terminen alle 10 Minuten (rechnet höchstens 1× pro Stunde), weil GitHub am 06.11. in
  15 Stunden nur 4 von ~30 geplanten Läufen gestartet hat. App-Stand `ra-shell-v16`.

Damals offen (inzwischen erledigt bzw. oben übernommen): GitHub verschluckte die Termine weiter (06.11.: von 10:55 bis abends
keine einzige Tipp-Suche) → Zeitgeber jetzt über den Cloudflare-Server; „Treffsicherheit überarbeiten“ → von Niklas als
Erfolgsquote der gespeicherten Top-Tipp-Wetten festgelegt.

### Wetten, Empfohlen, Cloudflare-Server (06.11.2026, abends – Niklas am Laptop)

Niklas' Wünsche: „unten einen Knopf, wo man seine Tipps mit Gewinn/Verlust und Guthaben tracken kann – manuell mit Quote und
Einsatz, möglicher Gewinn wird angezeigt, danach gewonnen/verloren → Guthaben ändert sich automatisch; oder Screenshot rein und
die KI erstellt die Wette“ · „bei den Top-Tipps die Wettbewerbe unter Morgen komplett raus, nur die Tagesangaben“ · „aus den
Top-Tipps eine Wette speichern und damit tracken“ · „im Verlauf prüft die KI sofort nach Abpfiff, ob sie geklappt hat, und
speichert das in Verlauf und Erfolgsquote – das kann nur die KI“. Entscheidungen (06.11.2026):
- **Verlauf und Erfolgsquote zählen nur Wetten aus den Top-Tipps** (inkl. „Empfohlen“ und Kombis). Die prüft die App selbst nach
  dem Abpfiff; von Hand lässt sich dort nichts ändern, und nach dem Anpfiff lassen sie sich nicht mehr löschen (sonst könnte man
  die Quote schönen). Selbst eingetragene und gescannte Wetten markiert man selbst – sie zählen nur fürs Guthaben.
- **Neue Kategorie „Empfohlen“** in den Top-Tipps (Niklas: „Spiele, die die KI empfiehlt wegen guter Quoten und halbwegs guter
  Erfolgsquote“): echte Buchmacher-Quote ab 1,50, Chance ab 55 %, Result AI höchstens 2 Punkte unter dem Buchmacher; gereiht
  nach vorsichtigerer Chance × Quote (`REC`, `REC_GAP` in `scripts/tips.py`, Liste `rec` in `tips.json`, Bilanz `record.rec`).
- **Cloudflare statt cron-job.org** für Wettschein-Scan UND Zeitgeber (ein Konto für beides). Konto und Schlüssel macht Niklas.

Umsetzung:
- **Leiste unten mit fünf Bereichen:** Start · Top-Tipps · **Wetten** · Auswählen · Verlauf (`TABS`). Bereich „Wetten“ (`#/bets`,
  `vBets`): Guthaben-Karte (Guthaben, im Spiel, möglicher Gewinn, Gewinn/Verlust), „Wette eintragen“ (Blatt: worauf, Spiel,
  Quote, Einsatz mit Schnellwahl 2–50 €, möglicher Gewinn live, Anbieter), „Wettschein scannen“, Listen Offen/Erledigt;
  selbst eingetragene Wetten: Gewonnen / Verloren / Storniert / „Wieder auf offen“, Löschen mit zweitem Tippen.
- **Speichern:** Knopf „Wette speichern“ auf jeder Tipp-Karte, „Kombi speichern“ auf jeder Kombi, runder Knopf bei „Top-Tipps zu
  diesem Spiel“ auf der Spielseite. Blatt mit vorausgefüllter Quote (zum Anpassen an den eigenen Anbieter) und Einsatz.
  Gespeichert → Knopf zeigt „Gespeichert · in Wetten“ (Schlüssel `g|m` bzw. `k|g:m,…`).
- **Daten nur auf dem Handy:** `ra_bets` (Liste der Wetten: `src` tip|manual|scan, `auto`, `list`, `legs` mit ESPN-Spiel `g`,
  Liga `slug`, Wett-Code `m`, `res`; `q`, `p`, `stake`, `win` = Auszahlung inkl. Einsatz, `status` open|won|lost|void, `done`)
  und `ra_wallet` (`base` = „Guthaben jetzt“ wie beim Anbieter, `at`, `moves` = Ein-/Auszahlungen). Guthaben = `base` + alles nach
  `at`: neue Einsätze ab, Auszahlungen (gewonnen: `win`, storniert: Einsatz) dazu.
- **Automatische Prüfung** (`checkBets`/`settleAuto`): die App holt den Endstand direkt bei ESPN (`summary?event=…`, CORS
  erlaubt) – beim Start, beim Zurückkommen in die App, auf Wetten/Verlauf/Erfolgsquote und jede Minute, solange ein Spiel läuft
  (zeigt dann „läuft · 1:0 · 63'“). Gewertet wie beim Buchmacher nach 90 Minuten: bei Verlängerung/Elfmeterschießen zählen die
  Tore der zwei Halbzeiten (`linescores`). Abgesagt/verschoben und 48 Std. später nicht gespielt → zählt nicht (Einsatz zurück;
  in einer Kombi zählt das Spiel wie Quote 1,0). Getestet mit Liverpool–Arsenal 0:1: „Sieg Arsenal“ ✓, „Über 2,5“ ✗.
- **Verlauf** (`vHist`): oben „Erfolgsquote“ (Ring + x von y gewonnen + Gewinn/Verlust), darunter „Deine Wetten“ aus den
  Top-Tipps nach Anstoß-Tag mit ✓/✗, dann wie bisher „Deine Prognosen“. **Erfolgsquote** (`#/acc`, `vAccuracy`, ersetzt die
  alte Beispiel-Seite „Treffsicherheit“): x von y gewonnen, erwartet laut Buchmacher-Chance, Einsatz/Ausgezahlt/Gewinn/Rendite,
  nach Kategorie, zuletzt ausgewertet, „Ehrlichkeit“ ab 20 Wetten.
- **Top-Tipps:** Wettbewerbs-Leiste entfernt (nur noch Tage), vier Listen Sicher · Empfohlen · Top-Quote · Kombis, Punkt beim
  Alter der Suche ehrlich grün/orange/rot (`freshness`), ebenso der KI-Knopf auf dem Start.
- **Cloudflare-Server** (`worker/worker.js`, Gratis-Tarif): `GET /` Status (nur Ja/Nein, welche Geheimnisse da sind), `GET /check`
  Einladungscode, `POST /bet` Wettschein lesen (Gemini, Temperatur 0, festes JSON-Schema, nur ablesen – nichts erfinden),
  `GET /kick` + **Cron Trigger alle 30 Min.**: startet `tips.yml` über die GitHub-API (`workflow_dispatch`, `via=zeitgeber`),
  wenn die veröffentlichte Tipp-Suche älter als 50 Min. ist. Geheimnisse (nur in Cloudflare, nie im Code/Chat): `GEMINI_API_KEY`,
  `GITHUB_TOKEN` (fine-grained, nur `result-ai`, Actions: Read and write), `INVITE_CODES` (Komma-getrennt).
  Einfügen/Aktualisieren: Datei komplett kopieren → Cloudflare → Workers & Pages → result-ai → Edit code → alles ersetzen → Deploy.
  Die App braucht die Server-Adresse in `API` (oben in `web/app.js`) und den Einladungscode (Einstellungen → „Einladungscode“).
  Der Scan verkleinert den Screenshot vorher (Breite ≤ 1280, Höhe ≤ 3600, JPEG), danach prüft man die erkannte Wette im Blatt.
- **KI-Zentrale:** neue Zeile „Zeitgeber“ (verbunden / GitHub-Schlüssel fehlt / nicht erreichbar / noch nicht eingerichtet),
  Knopf „Tipp-Suche jetzt starten“, wenn die Suche verspätet ist; im Protokoll steht, wer gestartet hat (vom Zeitgeber / von
  GitHub / von Hand – `RA_VIA` in `tips.yml`). GitHubs eigene Termine nur noch als Ersatz (2× pro Stunde, mit Alters-Prüfung).
- Service Worker `ra-shell-v17`.

## Stand Ende 03.11.2026 (Anfang des Projekts – zur Geschichte)

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
  hochzählen (aktueller Stand steht in `web/sw.js`).
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
  (~180 KB). Modell = `scripts/forecast.py` aus der BVB-App (Poisson, xG halb gemischt, Europapokal ×3, Zeitfenster 450 Tage).
  Gleicher Tag = gleiche Stärken = gleiche Zahlen.
- **Einstellungen per Backtest** (`scripts/backtest.py`, 04.11.2026: Stärken bis vor 28/56 Tagen, dann 1.406/2.246 echte Spiele
  aller 38 Ligen vorhergesagt): Quoten ×8, Zug zur Mitte 1,5, Halbwertszeit 120 Tage, Stärke-Unterschiede ×1,25 (`SPREAD`).
  Ergebnis 28 Tage: **Favorit richtig 54,0 %** (Buchmacher-Schlussquoten 56,2 %, Raten 33 %), Log-Loss 0,994 → **0,984**
  (Buchmacher 0,964); vorher war das Modell bei klaren Favoriten zu vorsichtig. Nur nach erneutem Backtest ändern.
  Folgerung: Wo Quoten zu einem Spiel bekannt sind, sind sie genauer als die Stärken → in der App bevorzugen.
- **Tor-Prüfung (04.11.2026, abends):** Result AI sagte insgesamt zu wenige Tore voraus (2,83 statt echt 3,05 pro Spiel), vor
  allem in den 16 Ligen ohne Über/Unter-Quoten (Norwegen −0,9, Schweiz −0,8, USA −0,6): dort nahm das Modell für die Quoten
  pauschal 2,75 Tore an (mit Gewicht 8). Jetzt: **Tor-Schnitt der Liga** (zeitgewichtet) statt 2,75. Ergebnis (Backtest 28/56
  Tage): Über 2,5 Log-Loss 0,6774 → 0,6714, genaues Ergebnis 3,0506 → 3,0428, Tor-Verteilung 1,8382 → 1,8308. Offizieller
  Backtest danach (28 Tage, mit neuer Team-Zuordnung): **Favorit richtig 54,3 %** (vorher 54,0 %), Log-Loss **0,9825** (0,9841).
  Getestet und verworfen: `SPREAD` nur auf den Abstand statt auf Angriff/Abwehr (nicht besser, genaue Ergebnisse schlechter)
  – die 4,1 Tore bei Dortmund–Bayern kommen von Bayerns echtem Angriff (Ø ~3,5 Tore), nicht von einem Rechenfehler.
- **Prüfung vor jeder Veröffentlichung:** `node tests/ratings.test.js` (Teamzahl, Zahlen endlich, IDs eindeutig, Stichproben
  Dortmund/Bayern/Arsenal/Real/Barça/West Ham, „West Ham“ nicht bei einem fremden Verein, Ligagrößen). Schlägt sie fehl,
  wird nichts gespeichert und die alte Version bleibt online (`ratings.yml`, `pages.yml`).
- Quellen: football-data.co.uk (22 europäische Ligen inkl. 2.–5. Liga England, Schottland 1–4, je zwei Saison-Dateien mit xG +
  16 weitere Ligen aus `/new/<Land>.csv`), ESPN (Tabellen für die Team-Zuordnung, alle CL/EL/ECL-Spiele).
  football-data erlaubt normale Programme (robots.txt sperrt nur KI-Trainings-Crawler) – der Rechner meldet sich ehrlich als
  `ResultAI-Stats/1.0`, nie als Browser verkleiden.
- **Team-Zuordnung:** football-data-Name → ESPN-Team-ID, **zwei Durchgänge**: erst je Liga die ESPN-Tabelle (Name +
  Bilanz) und, wo die fehlt, die ESPN-Teamliste derselben Liga (nur Name, `name_sim` ≥ 0,75 – so kamen Rumänien 0→13/16 und
  die Schweiz 5→11/12 dazu); danach für den Rest Europapokal-Teams mit sehr ähnlichem vollen Namen (keine Kürzel – „HAM“
  machte aus West Ham Hamrun Spartans, behoben 04.11.2026); umbenannte Vereine (gleiches Land, nie gleichzeitig gespielt,
  sehr ähnlicher Name) werden zusammengelegt. Ein Name gilt landesweit (Auf-/Absteiger verbinden 1. und 2. Liga);
  `lg` = Liga des letzten Spiels. Polen, Finnland, Irland: ESPN hat dort weder Tabelle noch Teamliste (nur Europapokal-Teams
  mit Wappen); kleine rumänische Vereine haben bei ESPN kein Wappen → Kreis mit Kürzel. In der App sind Anzeigenamen
  eindeutig (`_d`: Kurzname → voller Name → „Santos (Mexiko)“). Je Team: `id`, `name`, `short`, `abbr`, `alias` (für
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

### Top-Tipps + Leiste unten (05.11.2026 – Niklas: „top quoten mit hoher gewinn warscheinlichkeit … die KI soll immer neu suchen“)

- **Leiste unten** (schwebende Kapsel wie iOS 26, ohne Glas-Unschärfe): Start · Top-Tipps · Auswählen · Verlauf (`TABS`).
  Bereichswechsel per `location.replace` → `switchTab` (ohne Schieben, Scrollstand je Bereich bleibt); Detailseiten schieben
  sich wie gehabt von rechts herein; nochmal auf den aktiven Bereich tippen = zurück zu dessen Startseite bzw. nach oben.
  Startseite: Scan, „Spiel selbst auswählen“, **Top-Tipps (die 3 sichersten)**, Beispiele, „Zuletzt“ (3). Verlauf + Treffsicherheit
  wohnen jetzt im Bereich „Verlauf“ (`vHist`).
- **`scripts/tips.py`** (ohne KI, nur Mathe) läuft **jede Stunde** (`.github/workflows/tips.yml`, Cron `17 * * * *`, gleiche
  Concurrency-Gruppe wie der Stärken-Rechner): holt pro Liga/Pokal den Monats-Spielplan von ESPN (`scoreboard?dates=JJJJMM`,
  ~50 Abrufe), nimmt alle Spiele der nächsten 4 Tage **mit Quoten (DraftKings)** → `web/data/tips.json`.
- **Woher die Chance kommt** (Backtest 05.11.2026, 1.398/2.229 Spiele): wer gewinnt **nur aus den Quoten** (Result AI
  beimischen machte es in jedem Test schlechter: 1X2-Log-Loss 0,9651 → 0,9846), Tore aus der Über/Unter-Quote, sonst aus
  Result AI. Result AI steht als zweite Meinung dabei – nur wenn beide Teams genug Liga-Spiele haben (`n ≥ 5`; Teams, die
  nur aus dem Europapokal bekannt sind, gaben absurde Werte, z. B. 5,8 Tore bei Torreense–Ararat).
- **Wetten:** Sieg/Remis/Niederlage, Doppelchance, Über/Unter 1,5/2,5/3,5, beide treffen ja/nein, Heim/Gast trifft. Echte Quoten
  gibt es nur für 1X2 und die Über/Unter-Linie des Buchmachers; sonst **„≈“ = geschätzte Quote** (faire Quote − 6 % Marge).
- **Listen** (je Spiel höchstens ein Tipp): **Sicher** = Chance ≥ 70 %, Quote ≥ 1,20, gereiht nach Buchmacher-Chance + ¼ Abstand
  zu Result AI (max. ±8 Punkte; ohne das stünden lauter Tipps genau an der Grenze, weil die geschätzte Quote an der Chance hängt).
  **Top-Quote** = Quote ≥ 1,60 bei Chance ≥ 50 %, gereiht nach vorsichtigerer Chance × Quote. **Kombis**: „Sichere Kombi“
  (bis 3 Tipps, Gesamtchance ≥ 45 %) und „Top-Kombi“ (bis 3, ≥ 30 %), bevorzugt Spiele der nächsten 36 Stunden.
- **Ehrlich:** Buchmacher rechnen ihre Marge ein – kein Tipp ist ein sicherer Gewinn; die App sagt das, dazu „18+ · Glücksspiel
  kann süchtig machen · check-dein-spiel.de · BZgA 0800 1 37 27 00“. Keine Links zu Buchmachern.
- **Bilanz:** jeder angezeigte Tipp (Sicher/Top-Quote) wird bis zum Anpfiff in `web/data/tips_log.json` festgehalten, danach
  mit dem Endstand ausgewertet (45 Tage); die Seite zeigt „x von y richtig · erwartet z %“ und die letzten Ergebnisse ✓/✗.
- Prüfung vor jedem Speichern/Veröffentlichen: `node tests/tips.test.js`. Tipp-Spiele öffnen die normale Ergebnis-Seite
  (`#/r/t_<ESPN-ID>`, Tor-Erwartung aus den Quoten, „Top-Tipps zu diesem Spiel“, „Markt vs. Result AI“ mit dem Modell).
- **Reihenfolge laut Niklas (05.11.2026):** 1. Top-Tipps (erledigt) → 2. **Design maxen überall, auch auf der neuen Seite**
  (Apple-Übergänge: Karte wächst in die Seite, Kopf schrumpft beim Scrollen; Ergebnis-Seite edler: Vereinsfarben-Glow,
  Sprung-Leiste, schönere Grafiken; Scan-Animation; Stil „mehr Farbe & Glow“) → 3. **Vereine & Wappen fixen** (falsche Ligen,
  fehlende Wappen; Teams nur aus dem Europapokal brauchen ihre Ligen, z. B. Tschechien, Ukraine, Serbien, Kroatien).

### Design maxen (05.11.2026, abends – Niklas: „Übergänge wie bei Apple, Ergebnis-Seite edler, Scan-Animation“, Stil „mehr Farbe & Glow“)

- **Karte wächst in die Seite** (wie im App Store): Beispiel-Karten, Tipp-Karten, Tipp-Zeilen, Kombi-Zeilen, Verlauf-Zeilen öffnen das
  Spiel mit einem fliegenden Abbild der Spiel-Karte (`morphPush`: Klon der echten `.match`-Karte, gleichmäßig skaliert, nur
  transform/opacity, Seite blendet darunter ein); zurück schrumpft sie in die angetippte Karte (`morphPop`, nur wenn beide sichtbar
  sind, sonst normales Zurückschieben; Wischen vom Rand schiebt immer). Sicherung `settle` wie bei den Seitenwechseln.
- **Ergebnis-Seite:** Glow in beiden Vereinsfarben hinter der Spiel-Karte (ruhender Verlauf, dunkel kräftiger), Kopfleiste oben
  durchsichtig; ist die große Karte weggescrollt, zeigt die Leiste eine **Mini-Spielzeile** (Wappen · Stand · Wappen).
  **Sprung-Leiste** (Übersicht · Tipps · Ergebnisse · Markt · Tore · Halbzeit · Nächstes Tor · Erklärung) klebt unter der
  Kopfleiste und markiert den Abschnitt (`pageGeo` misst einmal aus dem Layout, `spy` beim Scrollen). Balken mit Schein,
  Favorit-Abzeichen leuchtet, große Zahl auf einem Hauch Vereinsfarbe, Tor-Kurve und Tore-Balken in der Farbe des Favoriten,
  wahrscheinlichstes Feld der Ergebnis-Karte hervorgehoben.
- **Scan:** Linie läuft, solange gelesen wird; „Beispiel-Scan ansehen“ (Startseite, Scan-Karte) zeigt einen nachgebauten
  Live-Screenshot (Arsenal–Chelsea 1:1, 63.): erkannte Felder leuchten nacheinander grün auf (mit Haptik), Schritte haken sich
  ab, dann verwandelt sich der Screenshot in die Prognose (`#/r/live`). Echte Screenshots: ehrlicher Hinweis, bis die KI läuft.
- **Mehr Farbe:** Beispiel-Karten werfen einen Schein in beiden Vereinsfarben, Tipp-Karten haben einen zarten Farbschein, gewählte
  Teams in „Auswählen“ leuchten in ihrer Farbe, die Leiste unten färbt „Top-Tipps“ orange. Listen-Karten (`.group`) wieder weiß.
- Offen fürs Design: am iPhone prüfen lassen (Flug der Karte, Glow), ggf. Feinschliff; danach **Vereine & Wappen** (siehe oben).

### Vereine & Wappen (05.11.2026, spätabends – Niklas: „viele Teams sind in der falschen Liga und haben kein Wappen“)

- **19 Ligen von FotMob** (`FM_LEAGUES` in `scripts/ratings.py`: Tschechien, Ukraine, Serbien, Kroatien, Ungarn, Bulgarien, Zypern,
  Israel, Slowakei, Slowenien, Kasachstan, Aserbaidschan, Bosnien, Armenien, Georgien, Albanien, Lettland, Litauen, Portugal 2):
  aktuelle Saison + Vorsaison aus den Liga-Seiten (`__NEXT_DATA__`; robots.txt erlaubt die Seiten, nur `/api` ist gesperrt,
  ehrlicher UA). Europapokal-Teams behalten ihre ESPN-ID (Namensabgleich ≥ 0,85, FotMob-Namen in `FD_ALIAS`), alle anderen
  bekommen `fm:<ID>`, Wappen `images.fotmob.com/…/teamlogo/<ID>.png` und Vereinsfarbe (`teamColors.lightMode`).
  Ergebnis: nur noch 6 statt 40 Teams ohne Liga (Mini-Ligen: Island, Gibraltar, Andorra, Kosovo, Malta, Nordmazedonien).
- **Wappen von FotMob** für football-data-Teams, die ESPN nicht kennt (`FM_CRESTS`: Polen, Finnland, Irland, Rumänien).
  Ohne Wappen nur noch 26 statt 122 (kleine rumänische Vereine, National League, Schottland 3./4. Liga).
  FotMob schickt keine CORS-Freigabe → die App bindet diese Bilder **ohne** `crossorigin` ein (`cors()` in `web/app.js`),
  der Service Worker lässt sie durch (Browser-Zwischenspeicher, 30 Tage).
- **Abgestiegene ausblenden:** wer über 60 Tage kein Spiel mehr in seiner Liga hatte, während die Liga weiterspielt, spielt
  dort nicht mehr (z. B. in eine Liga abgestiegen, die Result AI nicht lädt) → nicht mehr in `ratings.json` (~100 Teams).
- **Liga-Niveau im Modell** (`fc.fit_ratings_lg`, `TAU_L = 1`, `fit_all` in ratings.py, auch im Backtest): Stärke = Niveau der
  Liga + Abweichung des Teams; vorher zog der Zug zur Gesamt-Mitte jedes Team einzeln zur Weltmitte (schwache Ligen wirkten
  zu stark). Backtest Europapokal-Spiele (Ligen gegeneinander): Log-Loss 0,9810 → **0,9578** (28 Tage), 0,9954 → **0,9888**
  (56 Tage); Liga-Spiele 0,9848 → 0,9837. `W_EURO = 3` per Test bestätigt (2 / 1,5 / 1 waren bei Europapokal-Spielen schlechter).
  Offizieller Backtest danach (28 Tage, jetzt 1.877 Spiele inkl. FotMob-Ligen): Favorit 53,9 %; mit Schlussquoten 54,4 % /
  0,9825 (Buchmacher 55,9 % / 0,9658). Hinweis: Ferencváros steht gerade sehr hoch (4 Europapokal-Siege seit September, u. a.
  2:0 beim AC Mailand am 05.11.) – das sagen die Daten; vor 8 Wochen lag der Verein bei 0,66.
- Tipps: FotMob-Ligen haben bei ESPN keine Spiele/Quoten → `tips.py` überspringt Ligen mit `src: 'fotmob'`.
- Noch offen: Quoten der Europapokal-Spiele archivieren (die Tipp-Suche sieht sie jede Stunde) → als Markt-Beobachtung ins
  Modell, damit wenige Europapokal-Spiele Teams aus Ligen ohne Quoten nicht so stark verschieben.

### KI-Zentrale + Champions League in den Tipps (05.11.2026, nachts – Niklas: „oben rechts ne Zentrale von der KI, wo ich gucken kann,
wie oft die AIs was geadded haben und auch was“ · „bei Top-Matches nicht nur Samstag/Sonntag, sonst gibt's keine UCL“)

- **Protokoll** `scripts/activity.py` → `web/data/activity.json`: jeder Lauf von Tipp-Suche (`tips.py`) und Stärken-Rechner (`ratings.py`)
  hängt einen Eintrag an (Zeit, Dauer, ok, Zahlen; Tipps: neu / raus / angepasst ≥ 2 Punkte / ausgewertet + ✓; Stärken: Teams,
  neue Spiele seit dem letzten Lauf, neue Teams, größte Sprünge ≥ 0,03). 14 Tage, Einzelheiten 3 Tage. Die Workflows speichern
  die Datei mit (`git add … activity.json`). `tips.json` bekommt `ki` (heutige Läufe/neue Tipps) für den Knopf.
- **App:** Knopf „KI“ oben rechts auf dem Start (grüner Punkt = Tipps jünger als 3 Std., Zahl = neue Tipps heute) → `#/ki`
  (`vKI`): Status je Rechner (läuft / verspätet / hängt nach Alter), Kacheln heute, 7-Tage-Diagramm (neue Tipps, Läufe),
  Protokoll nach Tagen zum Aufklappen (neue Tipps mit Chance/Quote, ausgewertete Tipps ✓/✗ mit Endstand, Stärke-Sprünge).
  Ehrlich im Fuß: die Rechner sind Mathe ohne Sprach-KI; Gemini & Co. kommen mit dem Screenshot-Scan dazu.
- **Tipps 3 Wochen voraus** (`DAYS = 21`, Listen bis 90): der nächste Champions/Europa/Conference-League-Spieltag ist immer dabei.
  Neue Kombis: **Champions-League-Kombi** und **Bundesliga-Kombi** (nächster Spieltag, sichere Tipps). Filter in der App: Zeitraum
  (Heute · Morgen · Diese Woche · Später) und Wettbewerb (wichtigste zuerst, gleiche Namen mit Land); Datum ab 7 Tagen Abstand.
- **Reihenfolge laut Niklas (05.11.2026, nachts):** 1. KI-Zentrale (erledigt) → 2. **Design deutlich upgraden, überall** →
  3. **Automatik absichern** (alles mehrmals täglich: Tipps, Sicher, Top-Quote, Kombis, Bilanz, Stärken) → 4. **3. Liga in den
  Top-5-Ländern** (Deutschland 3. Liga, Spanien Primera Federación, Italien Serie C, Frankreich National; England hat bis Liga 5).

### Design-Runde 4 (05.11.2026, nachts – Niklas: „alles in der App nochmal vom Design sehr upgraden, deutlich“)

- **Startseite neu:** Begrüßung mit Namen (Einstellungen → „Dein Name“, `store name`) und Datum; großer **„Tipp des Tages“**
  (`spotlight`: sicherster Tipp heute/morgen, Spiel-Karte in Vereinsfarben mit Wappen-Tellern, Tipp + Chance + Quote, fliegt beim
  Antippen in die Spielseite); **Top-Tipps als wischbare Karten** mit Verlaufs-Ringen (`tipCarousel`); Scan-Karte mit Slogan
  „Screenshot rein. Prozente raus.“ und einem schräg gestellten Mini-Handy, das gerade einen Spielstand liest (ruhend).
- **Lichtschein je Seite** (`aura(kind)`: home grün/blau, tips orange/pink, pick violett/blau, hist türkis, ki violett) – ruhende
  Verläufe hinter dem Inhalt, Kopfleiste oben durchsichtig bis man scrollt. Feinere Kanten: `--shadow` mit Haarlinie,
  dunkel `--card #18181A` mit Lichtkante.
- **Top-Tipps:** Zahlen-Leiste (sicher · Top-Quote · Kombis · „vor x Min.“), Ringe mit Farbverlauf (`#rg-safe` grün→türkis,
  `#rg-top` orange→pink, einmal als SVG-defs im Dokument), Vergleichsbalken Buchmacher / Result AI, Bilanz mit Treffer-Ring.
- **Auswählen:** sobald beide Teams stehen, Vorschau-Karte in Vereinsfarben mit Sieg/Remis/Niederlage (`matchPreview`).
- **Verlauf:** nach Tagen gruppiert, rechts die Prognose in der Farbe des Favoriten (`histGrouped`).
- **KI-Zentrale:** farbige Kacheln mit Symbolen. **Leiste unten:** gefüllte Symbole im aktiven Bereich (`I.*F`).
- **Einstellungen:** Name + Darstellung **Hell · Dunkel · Automatisch** (`theme auto` folgt dem iPhone, auch beim Start in index.html).
- **Startbild** fürs iPhone (`icons/splash-1170x2532.png`, `-1284x2778`): Ring-Logo auf `#F2F2F7` (mit PIL gezeichnet); greift bei
  neu zum Home-Bildschirm hinzugefügter App.

### Automatik abgesichert (05.11.2026, nachts – Niklas: „sicher gehen, dass alles in der App wirklich jeden Tag mehrmals automatisch läuft“)

Was automatisch läuft (alles ohne KI, alles auf GitHub Actions, Protokoll in der KI-Zentrale):

| Was | Wie oft | Workflow |
|---|---|---|
| Top-Tipps: Sicher, Top-Quote, alle Kombis (inkl. Champions-League- und Bundesliga-Kombi), Tipp des Tages, Bilanz-Auswertung, KI-Zentrale | jede Stunde (Termine alle 10 Min., gerechnet nur, wenn die letzte Suche älter als 50 Min. ist) | `tips.yml` |
| Team-Stärken (61 Ligen + Europapokal, Wappen, Farben) | 1× pro Tag gültig, bis zu 5 Versuche (1:35, 5:35, 9:35, 14:35, 19:35 UTC) + Nachholen durch die Tipp-Suche | `ratings.yml` |
| App-Änderungen | bei jedem Push | `pages.yml` |

- **GitHub verschluckt/verzögert geplante Läufe** (05.11.2026: Stärken-Lauf 3:30 kam um 11:21, die neue stündliche Tipp-Suche lief
  die ersten Stunden gar nicht). Darum: Ersatz-Termin :47 läuft nur, wenn die veröffentlichte Suche älter als 50 Min. ist
  (`scripts/stale.py`); `ratings.py --if-stale` rechnet nur, wenn die Stärken von heute (deutsche Zeit, `berlin_date`) fehlen –
  die Tipp-Suche ruft das vor jeder Suche auf (fehlender Stärken-Lauf wird nachgeholt, aber nie zweimal am Tag gerechnet →
  gleiches Spiel am selben Tag = gleiche Zahlen).
- Alle drei Workflows in **einer Warteschlange** (`concurrency: pages`, nichts wird abgebrochen); veröffentlicht wird nur bei Änderungen.
- **Tipp-Datei wird nur veröffentlicht, nicht gespeichert** (hält das Repository klein); `pages.yml` und `ratings.yml` holen vor dem
  Veröffentlichen die aktuelle Tipp-Datei von der Seite (sonst würde ein App-Update ältere Tipps zurückspielen). Gespeichert werden
  Bilanz (`tips_log.json`, 31 Tage), Protokoll (`activity.json`, 8 Tage, Einzelheiten für die letzten 30 Läufe) und die Stärken.
- Kontrolle: KI-Zentrale zeigt je Rechner „läuft / verspätet / hängt“; schlägt ein Lauf fehl, schickt GitHub Niklas eine E-Mail.
- **06.11.2026:** trotzdem nur 4 Tipp-Läufe in 15 Stunden (00:59, 01:50, 07:59, 09:55 UTC, dann 5 Stunden nichts). Darum jetzt
  **Termine alle 10 Minuten** (`7,17,27,…,57`), alle mit Alters-Prüfung (eigener kleiner Prüf-Job ohne Veröffentlichung, der nach
  Sekunden endet); von Hand/von außen gestartete Läufe rechnen immer. Die Warteschlange `pages` gilt jetzt nur für den Rechen-Job.
- Ganz sicher wird es erst mit einem **externen Zeitgeber**, der den Workflow über die GitHub-API anstößt. Das macht **Niklas
  selbst** (Konto + Schlüssel, nie in den Chat), Claude erklärt nur:
  1. GitHub → Settings → Developer settings → Personal access tokens → **Fine-grained tokens** → Generate new token:
     Name „result-ai Zeitgeber“, Ablauf z. B. 1 Jahr, *Only select repositories* → `result-ai`, Permissions → Repository →
     **Actions: Read and write** (sonst nichts). Token kopieren (wird nur einmal angezeigt).
  2. Kostenloses Konto bei **cron-job.org** → Create cronjob: URL
     `https://api.github.com/repos/sneaxx141108-gif/result-ai/actions/workflows/tips.yml/dispatches`, jede Stunde (z. B. Minute 20),
     Advanced: Methode **POST**, Header `Accept: application/vnd.github+json`, `Authorization: Bearer <Token>`,
     `X-GitHub-Api-Version: 2022-11-28`, Body `{"ref":"main"}`. Erfolg = Antwort **204**; in GitHub erscheint ein Lauf
     „workflow_dispatch“. Später kann das auch der Cloudflare-Worker per Cron übernehmen.

### 3. Ligen der Top-5-Länder (06.11.2026 – Niklas: „adde in den Top-5-Ländern die 3. Liga, also 1., 2. und 3. Liga“)

- Von FotMob (wie die anderen FotMob-Ligen, `FM_LEAGUES` in `scripts/ratings.py`): **3. Liga** (FotMob 208, 20 Teams),
  **Primera Federación** (8968, 2 Gruppen, 40 Teams), **Serie C** (147, 3 Gruppen, 60 Teams), **Ligue 3** (8970, 18 Teams).
  England hatte schon die Ligen 1–5 (football-data). Jetzt **61 Ligen, ~1.056 Teams**.
- **Auf-/Absteiger verbinden** (sonst wären die neuen Ligen Inseln ohne Vergleich): jedes FotMob-Team wird mit einem
  football-data-Namen der Liga **eine Stufe höher** im selben Land verbunden, wenn der Name sehr ähnlich ist (≥ 0,85, oder gleich
  einem der ESPN-Namen – so wird „Celta Fortuna“ = „Celta B“) **und beide nie gleichzeitig gespielt haben** (`apart`). Zweite
  Mannschaften (`RESERVE`/`is_reserve`: II, B, U19/U21/U23, Next Gen, Futuro, Castilla, Atlètic …) nie mit Profis. Greift auch für
  Liga Portugal 2 ↔ Primeira Liga (vorher Insel-Gefahr). 06.11.: 20 Verbindungen, u. a. Düsseldorf, Münster, Cottbus, Osnabrück,
  Zaragoza, Huesca, Bari, Spezia, Bastia, Amiens, Tondela, AVS; der Rest (Arezzo, Eldense, Dijon …) hieß schon gleich.
- Ergebnis: alle vier Ligen in Gruppe 0 (vergleichbar mit allen europäischen Ligen); Schnitt-Stärke je Land Liga 1 > 2 > 3
  (z. B. Deutschland 1,07 / 0,33 / −0,15; England League One liegt mit 0,38 etwa auf Höhe der 2. Bundesliga). BVB II, Castilla,
  Juventus Next Gen, Atalanta U23 usw. bleiben eigene Teams.
- Test `tests/ratings.test.js` Abschnitt 6: 3. Ligen verbunden, Reihenfolge Liga 1 > 2 > 3, keine zweite Mannschaft bei Dortmund,
  Bayern, Real, Barça, Juve. Fehlt eine Liga einmal (FotMob kurz nicht erreichbar), blockiert das nichts.
- App: Zahl der Ligen steht nicht mehr fest im Text („38 Ligen“), sondern kommt aus `ratings.json`.

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
