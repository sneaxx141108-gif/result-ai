# Wettbuch – Projektwissen für Claude

Diese Datei liest Claude in jeder neuen Sitzung automatisch. **Wer hier weitermacht: komplett lesen, dann bei „HIER WEITERMACHEN“
anfangen.** Ohne Installation (z. B. fremder Laptop): im Browser **claude.ai/code** → GitHub verbinden → Repository `result-ai`
wählen. Alternativ Claude-App + Git installieren und das Repository klonen (Ordner direkt im Benutzerordner, nicht in „Dokumente“ –
der geht per OneDrive in die Cloud; in sehr langen Pfaden scheitert `git clone` mit „'$GIT_DIR' too big“).

## Was das ist

- **Wettbuch** (bis 11.11.2026 „Result AI“): eine reine **Tracking-App für Sportwetten**. Man scannt einen Screenshot aus der
  Wett-App (Niklas wettet bei Tipico) oder trägt die Wette selbst ein. Wettbuch rechnet die Wette nach dem Abpfiff selbst ab und
  führt Kasse, Statistik und Limits. **Keine Prognosen, keine Tipps, keine Prozente.**
- Web-App (PWA) für Niklas' **iPhone 12** und iPad, auf GitHub Pages: **https://sneaxx141108-gif.github.io/result-ai/**
  (Pages-Quelle „GitHub Actions“). Repository und Adresse heißen weiter `result-ai`, nur der angezeigte Name ist neu.
  Niklas teilt die App mit Freunden per Link.
- Besitzer: **Niklas** (GitHub `sneaxx141108-gif`) – Fan, kein Entwickler. Antworten auf **Deutsch**, locker, verständlich, ohne
  Fachchinesisch. Fragen, wenn etwas unklar ist.

## Entscheidungen von Niklas – nicht ändern ohne Rückfrage

**Umbau am 11.11.2026** („reine Tracking-App mit Scan-Funktion … alle Spiele raus … keine Prozente mehr … KI-Zentrale umbauen …
neuer Name, nichts mit Tipico“):
- Alles mit Prognosen ist raus: Top-Tipps, Spiel-Scan mit Prozenten, Team-Stärken, Spiel auswählen, Bilanz/Erfolgsquote der Tipps,
  Tipico-Quoten-Abruf (The Odds API). Diese Teile **nicht wieder einbauen**.
- **Keine Prozente**, nirgends (auch nicht versteckt in Daten-Dateien – `tests/games.test.js` prüft das). Nur Euro und Anzahlen:
  „7 von 10 gewonnen“, „pro 10 € Einsatz +5,77 €“.
- Name **Wettbuch** – kein Anbieter-Name im App-Namen.
- Bestehende Daten bleiben: Wetten, Kasse und Konto-Abgleich laufen weiter unter dem Speicher-Präfix `ra_`.

**Gilt weiter (seit 03.–10.11.2026):**
- Nur Deutsch. Design **„Clean 2“** (11.11.2026, Niklas: „viel cleaner und aufgeräumter, mehr Animationen, hochwertiger“):
  iOS-Grau als Hintergrund (`--bg #F2F2F7`), weiße Karten ohne Rand mit weichem Schatten, große fette Titel, schwarze
  Hauptknöpfe, Konto-Karte immer dunkel (Farbe unter Kasse → Ändern), Wettscheine als Tickets mit Abriss-Kante.
  Dunkelmodus in den Einstellungen (Hell · Dunkel · Automatisch), Vorbilder Apple und Revolut. **Plus grün mit +, Minus rot
  mit −** bei allem, was Geld ist.
- **Unbekanntes ehrlich als „k. A.“**, nie erfinden. **Nie Beispieldaten ausliefern.** Ein Tipp, den die App nicht sicher
  versteht, wird nicht automatisch abgerechnet („lieber gar nicht als falsch“).
- Ehrliche Hinweise zum Glücksspiel (`RG_TEXT`: keine Garantie, ab 18, check-dein-spiel.de, BZgA 0800 1 37 27 00).
  **Keine Links zu Buchmachern.**
- Server-Funktionen (Scan) nur mit **Einladungscode** (schützt das Gratis-Kontingent). Konto nur mit **Benutzername + Passwort**.
- **Tipico selbst auslesen ist abgelehnt** (Bot-Schutz, nicht umgehen). Ehrliche User-Agents, keine Bot-Schutz-Umgehung irgendwo.

## Was die App kann (`web/app.js`, Stand `ra-shell-v26`)

Leiste unten (`TABS`): **Start · Wetten · Scannen · Statistik · Kasse**; dazu die **KI-Zentrale** (`#/ki`, Knopf „KI“ oben) und
Einstellungen (Zahnrad). Am iPad quer ist die Leiste links.
- **Start** (bewusst knapp): Begrüßung, Limit-Hinweis (falls überschritten), dunkle Konto-Karte (Kontostand, diese Woche,
  30-Tage-Kurve, im Spiel / möglicher Gewinn / offen; antippen → Kasse), zwei Knöpfe Scannen und Eintragen, offene Wetten (3),
  zuletzt abgerechnet (4). Ohne Wetten statt der Listen „So geht's“.
- **Wetten:** Offen · Erledigt (Filter) · Kalender (Plus/Minus je Tag, Tag antippen). Je Wette: Gewonnen, Verloren, Cashout
  (Betrag eintragen), Storniert, Bearbeiten, Löschen (zweimal tippen).
- **Eintragen** (Blatt): „Tipp hinzufügen“ hat oben zwei Wege (`legMode`): **Aus dem Spielplan** (Teamsuche, Schnellwahl
  1 · X · 2 · 1X · X2 · 12 · Über/Unter · Beide treffen …, „Andere Wette“ als Freitext; Wettbuch rechnet selbst ab) oder
  **Eigene Wette** (seit v26, Wunsch Niklas: Text frei, Sportart aus `SPORTS` mit eigenem Symbol, Spiel/Ereignis, Zeit, Quote –
  Tipp mit `own: true`, `sport`, violettes Sport-Symbol; rechnet Niklas selbst ab). Kombi mit mehreren Tipps; Quote, Einsatz
  (2–50 € Schnellwahl), Auszahlung (Einsatz × Quote oder selbst), Gratiswette, Stand, Anbieter, Datum, „Schon im Kontostand“.
- **Scannen:** Screenshot aus der Wett-App (Fotos, Kamera, Einfügen; am iPad hineinziehen). Ein Bild kann eine ganze Liste
  „Meine Wetten“ sein (bis zu 10 Wetten). Der Server liest ab (`POST /slip`, Gemini), die App ordnet die Teams dem Spielplan zu
  (`resolveTeam`, absichtlich streng) und zeigt das Ergebnis: alle speichern oder einzeln ergänzen; schon gespeicherte werden erkannt.
  Bild vorher verkleinert (Breite ≤ 1280, Höhe ≤ 3600, JPEG). Die letzten 10 Scans in `ra_scans`.
- **Abrechnung** (`checkBets`/`settleAuto`): Endstand direkt von ESPN (`summary?event=…`, CORS erlaubt) – beim Start, beim
  Zurückkommen und jede Minute, solange ein Spiel läuft. **Gewertet nach 90 Minuten** wie beim Buchmacher (Verlängerung und
  Elfmeterschießen zählen nicht). Abgesagt/verschoben und 48 Std. später nicht gespielt → Tipp zählt nicht (Quote 1,0).
  Verliert ein Tipp einer Kombi, ist die ganze Wette verloren; sonst rechnet die App nur ab, wenn sie alle Tipps versteht.
- **Statistik:** Gewinn/Verlust-Kurve (7 T · 30 T · 3 M · 1 J · Alles), Kacheln (gewonnen x von y, Ø Quote, pro 10 € Einsatz,
  Serie, größter Rückgang …), Form, Gewinn je Tag/Woche/Monat, „Wo du gewinnst“ (nach Art, Wette, Quote, Einsatz, Liga, Team,
  Wochentag), Höhepunkte, Knapp daneben (Kombis mit nur einem falschen Tipp), Rekorde, „Das fällt auf“.
- **Kasse:** Kontostand mit Kurve, Einzahlen/Auszahlen/Korrigieren, Geldfluss, Kontoauszug, **Limits** (Einsatz pro Woche,
  Verlust pro Monat, Einzahlung pro Monat – bei Überschreitung ein ruhiger Hinweis mit Hilfe-Adressen).
- **KI-Zentrale:** Status der Aufgaben (Wettschein-Leser, Spielplan, Abrechnung, Zeitgeber, Konten), Kacheln heute, 7-Tage-
  Diagramm, Protokoll (`ra_kilog`) zum Aufklappen. Fehlt das Server-Update, steht dort „Server-Update fehlt“.

### Daten auf dem Gerät (Präfix `ra_`, Abgleich über das Konto in `web/sync.js`)
- `ra_bets`: Wetten `{id, at, src: scan|manual|tip, legs, q, stake, win, status: open|won|lost|void|cash, cash, done, bookie,
  free, system, old}`; Tipp (`leg`): `{g (ESPN-Spiel), slug (Liga), m (Wett-Code), home, away, event, pick, comp, t, q, res}`.
  Geld intern in ganzen Cent rechnen.
- Wett-Codes (`pickCode` liest Markt + Tipp vom Wettschein): `H/D/A`, `HD/DA/HA`, `O25/U25` (Linie × 10), `HO15` (Heim über 1,5),
  `BY/BN` (beide treffen), `HS/AS` (Team trifft), `HN/AN` (Unentschieden keine Wette), `H1/D1/A1` (Halbzeit), `CSx:y`.
  Unbekannte Märkte (Torschützen, Ecken, Karten, Handicap, Kombi-Märkte …) blockt `NO_CODE` → von Hand abrechnen.
  Tests: `node tests/pick.test.mjs`.
- `ra_wallet` (Kontostand, Ein-/Auszahlungen), `ra_limits`, `ra_kilog`, `ra_scans`, `ra_name`, `ra_theme`, `ra_device`, `ra_mlook`,
  `ra_invite`; nur auf dem Gerät: `ra_auth`, `ra_sync`, `ra_api` (nur auf localhost: andere Server-Adresse zum Testen).

## Aufbau

| Teil | Wo | Kosten |
|---|---|---|
| App (eine Seite, PWA) | `web/` → GitHub Pages über `.github/workflows/pages.yml` (vorher alle Tests) | kostenlos |
| Spielplan (ohne KI, ohne Quoten) | `scripts/games.py` → `web/data/games.json`, `.github/workflows/games.yml` alle 2 Std. | kostenlos |
| Scan, Konten, Zeitgeber | Cloudflare Worker `worker/worker.js` + D1-Datenbank, KI-Schlüssel als Secret | kostenlos (Gratis-Tarif) |

- `web/app.js` (alles in einer Datei), `web/app.css`, `web/index.html` (Ladebildschirm `#splash` direkt drin), `web/sync.js`,
  `web/sw.js` (**bei jeder App-Änderung `SHELL = 'ra-shell-vNN'` hochzählen**), `web/manifest.webmanifest`, `web/icons/`.
- `scripts/games.py`: alle Fußballspiele von 5 Tagen zurück bis 16 Tage voraus aus rund 70 Wettbewerben (ESPN), mit Wappen,
  Vereinsfarben und Endstand nach 90 Min. Die Datei wird nur veröffentlicht; im Repository liegt ein Startstand, `pages.yml` holt
  vor dem Veröffentlichen den neueren von der Seite. Protokoll der Läufe in der Datei selbst (`runs`, für die KI-Zentrale).
- `scripts/icons.py`: zeichnet App-Symbol und Startbilder (seit v26: grünes „W“ als steigende Kurve mit weißem Punkt auf
  dunklem Verlauf; gleiche Form wie `logo()` in `app.js` und der Ladebildschirm in `index.html`, Raster 100 × 100).
  Nur bei Änderungen am Symbol, vom PC aus, braucht Pillow.
- Tests: `node tests/pick.test.mjs` (Wett-Codes), `node tests/sync.test.js` (Abgleich), `node tests/worker.test.mjs`
  (Server mit SQLite statt D1, Node ≥ 22.13), `node tests/games.test.js` (Spielplan). Alle laufen in `pages.yml`.

### Cloudflare-Server (`worker/worker.js`)
- Adresse **https://result-ai.sneaxx141108.workers.dev** (Konto von Niklas, Worker `result-ai`). `GET /` zeigt `ki`, `zeitgeber`,
  `einladung`, `konten` und `version` (nur Ja/Nein, nie Werte).
- Routen: `POST /slip` (Screenshot → alle Wettscheine darauf, Gemini, Temperatur 0, festes JSON-Schema, nur ablesen),
  `POST /bet` (alter Einzel-Scan für alte App-Stände), `GET /check` (Einladungscode), `GET /kick` + **Cron alle 30 Min.**
  (startet `games.yml`, wenn der veröffentlichte Spielplan älter als 3 Std. ist), `/auth/signup|login|logout|delete`, `GET/PUT /sync`.
  Die App fragt erst `/slip`; kennt der Server das nicht (404), nimmt sie `/bet`.
- Geheimnisse trägt **Niklas selbst** ein (Settings → Variables and secrets), nie in den Chat oder Code: `GEMINI_API_KEY`,
  `GITHUB_TOKEN` (fine-grained, nur `result-ai`, Actions: Read and write – **läuft ab**, dann neu erzeugen und ersetzen),
  `INVITE_CODES`. Konten brauchen die D1-Bindung **`DB`** (Storage & Databases → D1 → Create, im Worker unter Bindings verbinden).
- **Code aktualisieren:** Claude kann im Cloudflare-Editor nicht selbst einfügen. Ablauf: Claude legt `worker/worker.js` in die
  Zwischenablage (`Get-Content -Raw -Encoding UTF8 worker/worker.js | Set-Clipboard` – ohne `-Encoding UTF8` gehen in Windows
  PowerShell 5.1 die Umlaute kaputt), Niklas öffnet Workers & Pages → result-ai → Edit code,
  klickt in den Code, Strg+A, Strg+V, Deploy. Danach zeigt `GET /` die neue `version`.
- Das GitHub-Secret `ODDS_API_KEY` (alter Tipico-Quoten-Abruf) braucht Wettbuch nicht mehr.

## iPhone-12-Regeln (aus der BVB-App gelernt – unbedingt einhalten)

Am PC sah die BVB-App glatt aus, am iPhone ruckelte sie „grauenvoll“. Deshalb:
- Animationen nur mit `transform` und `opacity`, kurz und gezielt, **keine Dauer-Deko** (nur Lade-Kreisel).
- Keine View Transitions, kein `:active`-Zusammenziehen (Antippen = kurz abdunkeln, `.pressed`), keine `filter: blur` /
  `drop-shadow` auf großen Flächen, `backdrop-filter` nur in Leiste und Kopfzeile, keine festen Extra-Ebenen hinter dem Inhalt.
- Langes Tippen ohne iOS-Menü/Textauswahl. Updates kommen beim ersten Öffnen an (Service Worker lädt am Cache vorbei, die App lädt
  bei neuer Version einmal neu).
- Jede neue Animation **auf Niklas' iPhone prüfen lassen** – der PC-Browser zeigt diese Probleme nicht.
- **Bewegung (seit 11.11.2026):** Zeigt sich eine Seite, gleiten die Karten nacheinander herein (`reveal()` → `stagger()`: die
  ersten 14 bekommen `.rvi` und ihre Nummer `--r`, nach 1,3 s wieder weg; `REVEAL_IN` nennt die Behälter, deren Karten einzeln
  kommen). Große Zahlen zählen vom zuletzt gezeigten Wert aus (`data-cu`, `countUp`), Kurven zeichnen sich einmal ein, die Leiste
  federt beim Antippen. Auftritts-Effekte **immer unter `.rvi` hängen**, nie an feste Klassen – `redrawAll` setzt kurz `.still`,
  sonst liefen sie bei jedem Neuzeichnen noch einmal.

**iPad** (Einstellungen → Gerät, `ra_device`, `data-device` auf `<html>`): ab 700 px mehr Spalten, quer ab 960 px Leiste links
(`ipadSide()` und CSS müssen zusammenpassen). Karten-Raster ohne Lücken mit `ipadPack()` (Zeilen von 1 px, `gridRowEnd = span
Höhe + 18`) auf `.ovw`, `.ovg`, Start, KI-Zentrale und „Erledigt“ (`.blist.dl`, jeder Tag ein Block `.dday`) – dort **immer
`row-gap: 0`** und keine Außenabstände an den Karten.

## Arbeitsweise

- Commit-Nachrichten enden mit `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Keine Passwörter, Logins oder API-Schlüssel im Chat oder im Code.** Konten (Cloudflare, KI-Anbieter, GitHub-Token) legt Niklas
  selbst an; Claude tippt nie einen Schlüssel ein.
- **Das Repository ist öffentlich:** keine Nachnamen, Windows-Benutzernamen, Firmen oder E-Mail-Adressen in Dateien oder
  Commit-Nachrichten. Hilfs-Skripte aus Claudes Arbeitsordner nie ins Repository kopieren.
- Hochladen: erst committen, dann `git pull --rebase -X theirs`, dann `git push`.
- Nach App-Änderungen `SHELL` in `web/sw.js` hochzählen und alle Seiten im Browser bei iPhone-Breite (375–390 px) durchklicken,
  hell und dunkel, dazu iPad hochkant und quer: keine Fehler in der Konsole, kein seitliches Überlaufen.
  Lokal ansehen: `python -m http.server 8098 --directory web` → http://localhost:8098 (Testdaten nur dort, danach löschen).
- **„Mach noch was“** (Niklas): erst die laufende Aufgabe ganz fertig machen, dann selbst die nächste sinnvolle Sache wählen und
  am Ende kurz berichten.
- Unter Windows: größere Änderungen per kleinem Python-Skript oder Edit statt Bash-Heredoc (Backslashes in Regeln gingen kaputt).

## HIER WEITERMACHEN – Stand 11.11.2026

**Umbau zu Wettbuch fertig** (`ra-shell-v24`): App, Symbol, Startbilder, Spielplan (`games.yml`), Server-Code. Im Browser geprüft
(iPhone-Breite hell/dunkel, iPad hochkant/quer, Scan mit nachgestellter Server-Antwort, Eintragen, Cashout, Bearbeiten, Löschen).
**Danach Redesign „Clean 2“** (`ra-shell-v25`, 11.11.2026 abends): neue Optik, aufgeräumter Start, Auftritts-Animationen –
im Browser auf allen Seiten und Blättern geprüft (iPhone-Breite hell/dunkel, iPad hochkant/quer), Tests grün.
**12.11.2026:** `ra-shell-v26` – „Eigene Wette“ (jede Sportart, frei eingetragen) und neues App-Logo („W“-Kurve). **Achtung:** Das
neue Symbol kommt erst, wenn die App vom Home-Bildschirm gelöscht und neu hinzugefügt wird – das löscht am iPhone aber die
Daten der App (Wetten!), eine Wiederherstellung gibt es nicht (CSV-Export nur zum Ansehen). Deshalb erst, wenn Konten laufen
(Cloudflare-Update) und die Wetten im Konto gesichert sind – oder wenn noch keine Wetten drin sind.

**Offen, in dieser Reihenfolge:**
1. **Server-Update bei Cloudflare (macht Niklas, Claude erklärt):** D1-Datenbank anlegen und als `DB` binden (falls noch nicht
   geschehen), dann den neuen `worker/worker.js` einfügen und Deploy. Bis dahin läuft dort der Stand vom 06.11.2026: Der Scan
   geht über den alten Weg (`/bet`, nur ein Wettschein pro Bild), Konten gehen noch nicht, der Zeitgeber stößt noch den
   gelöschten `tips.yml` an (harmlos, der Spielplan läuft trotzdem alle 2 Std. über GitHub).
2. **Auf Niklas' iPhone und iPad prüfen:** App einfach öffnen (aktualisiert sich selbst; nicht löschen, siehe oben),
   echte Screenshots aus der Wett-App scannen (einzelne Wette, Kombi, ganze Liste „Meine Wetten“, Cashout), Abrechnung nach dem
   Abpfiff, Kasse und Limits. Dazu die neuen Animationen von „Clean 2“: ruckelt etwas oder blitzt schwarz, sofort zurücknehmen.
3. Ideen danach (nur nach Rückfrage): Export der Wetten als Tabelle, Erinnerung an offene Wetten, Ziele (z. B. Monatsbudget).

## Geschichte (kurz)

- 03.–10.11.2026 **Result AI**: Prognose-App (Spiel-Screenshot → Prozente), Team-Stärken aus 61 Ligen, Top-Tipps mit Tipico-Quoten,
  Wett-Tracker mit Kasse, Konto-Abgleich, Cloudflare-Server. Am 11.11.2026 komplett zu Wettbuch umgebaut; der alte Stand steht
  im Git-Verlauf (bis Commit `e7e1c76`).
- Vorgänger: die BVB-App (Repository `bvb09`, abgeschaltet und archiviert). Von dort stammen die iPhone-Regeln.
