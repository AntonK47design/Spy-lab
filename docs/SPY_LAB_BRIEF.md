# SPY LAB – Build-Brief für Claude Code

> **Kick-off-Prompt (diesen Satz in Claude Code einfügen):**
> Lies `docs/SPY_LAB_BRIEF.md` vollständig. Lies danach über das Playgama-MCP die Pflichtschritte des Bridge SDK (`get_bridge_sdk_docs`, page `api`) und die Game Requirements (`get_game_checklist`). Lege `CLAUDE.md` und `PROGRESS.md` an und starte mit Phase 0. Halte nach jeder Phase an und berichte.

---

## 0. Arbeitsregeln für Claude Code

1. **Phase für Phase.** Arbeite die Phasen aus Abschnitt 15 der Reihe nach ab. Nach jeder Phase: Tests laufen lassen, Screenshots machen, `PROGRESS.md` aktualisieren, Zahlen berichten (Bundle-Größe, Initial Download, FPS, Draw Calls, Speicher), dann **anhalten und auf Antons OK warten**.
2. **`CLAUDE.md` zuerst.** Fasse in Phase 0 die harten Regeln dieses Briefs (Abschnitte 3, 7, 11, 12) in `CLAUDE.md` zusammen, damit sie in jeder Session gelten.
3. **Daten statt Code.** Alle Balancing-Werte (Preise, Einkommen, Zeiten, Schwierigkeit, Ad-Platzierungen, Pacing) liegen in `src/config/*.ts`. Kein Balancing-Wert hartkodiert in Spiellogik.
4. **Plattform-Doku live lesen.** Die Playgama-Regeln ändern sich. Lies sie am Anfang über das MCP und vor jedem Upload erneut. Wenn dieser Brief und die Live-Doku sich widersprechen, gilt die Live-Doku. Melde den Widerspruch.
5. **Verboten:** Sound oder Musik im Code synthetisieren (Regel 3.3.2) · Emoji als Icons (4.3.2) · `localStorage`/`sessionStorage`/IndexedDB/Cookies (3.2.1) · eigene Timer oder Zähler für Interstitials (SDK-Pflichtschritt 7) · externe Requests, CDNs für Fonts, Google Analytics (1.2.4, 1.2.5) · die Esc-Taste (1.5.2).
6. **Irreversible Aktionen nur nach Antons ausdrücklichem Ja:** `publish_sandbox`, `start_sandbox_traffic`, `send_playgama_catalog_update`, `replace_in_app_products`. Archive hochladen und QA-Links holen ist erlaubt.
7. **Frag nur bei Produktentscheidungen** (Spielgefühl, Monetarisierung, Inhalt). Technische Entscheidungen triffst du selbst und begründest sie im Phasenbericht.
8. **Assets:** Nutze nur, was in `assets-src/` liegt (siehe Abschnitt 16). Fehlt etwas, nimm einen klar markierten Platzhalter (graue Box, stille Audiodatei) und liste es im Bericht auf. Nicht selbst im Netz suchen.

---

## 1. Pitch

**Spy Lab** ist ein 3D-Tycoon in bunter Low-Poly-Optik: Der Spieler leitet eine geheime Spionageakademie unter einer harmlosen Bäckerei. Er baut unterirdische Trainingsräume aus, bildet Kadetten zu Agenten aus und schickt sie auf Missionen rund um eine fiktive Welt. Jede Mission ist ein kurzes, eigenständiges **Minispiel** (Tresor knacken, Laserflur, Code brechen, Maulwurf entlarven, Roller-Verfolgung, Schaltkreis hacken). Gegner ist die Katzenmasken-Diebesbande **The Velvet Paw**.

**Der Kniff:** Tycoon und Minispiele füttern sich gegenseitig. Bessere Räume bringen stärkere Agenten, und stärkere Agenten machen Minispiele leichter. Gewonnene Missionen bringen Intel, und Intel schaltet neue Räume und Regionen frei. Es gibt immer ein nächstes Ziel in 30 Sekunden, 3 Minuten und 30 Minuten.

---

## 2. Ziele & KPIs

| KPI | Ziel | Wichtigste Hebel im Design |
|---|---|---|
| Ø Playtime pro Session | **≥ 12 Min** (YouTube Playables wünscht > 8) | Drei verschachtelte Loops, etwas Neues alle 60–120 s in den ersten 20 Min, 6 Minispiele, Boss-Missionen, Endless Ops |
| Gameplay Conversion | **≥ 80 %** | Kein Hauptmenü, direkt in die Akademie, Interaktion in < 5 s, Initial Download < 5 MB, `game_ready` erst beim ersten spielbaren Frame |
| D1-Retention | **≥ 15 %** | Offline-Erträge, Daily Rewards, Daily Contracts, Field Ops mit Timern, Prestige |
| Rewarded Views pro Session | **≥ 4** (Playgama-Benchmark 3–5) | 14 Platzierungen, alle mit echtem Nutzen (Abschnitt 7.2) |
| Anteil Spieler mit Rewarded | **≥ 35 %** (Benchmark 30–40 %) | Erste Belohnung gratis als Demo, dann per Ad. Buttons gut sichtbar, starke Belohnungen |
| Interstitials | so viele, wie die Bridge zulässt | Natürliche Pausen alle ~60–90 s. Die Bridge bestimmt Abstand und Frequenz (Abschnitt 7.1) |

---

## 3. Plattform-Pflichten (nicht verhandelbar)

### 3.1 Bridge SDK – Pflichtschritte (Moderation prüft alle)

1. `playgama-bridge-config.json` liegt im Archiv neben `index.html` (über `public/`).
2. **Bridge vor dem Spiel laden und initialisieren:** Das SDK-Script ist das erste Script im `<head>`, normal geladen (nicht `async`). `await bridge.initialize()` muss fertig sein, **bevor** Three.js, Assets oder Spiellogik laden. Vor der Initialisierung keine SDK-Aufrufe. Integration über `npm i @playgama/bridge` und das Vite-Plugin `@playgama/bridge/vite`. Ob CDN- oder `mode: 'local'` richtig ist, prüfst du in der aktuellen Setup-Doku, mit Blick auf „keine externen Calls" bei YouTube.
3. **Sprache** einmal nach der Initialisierung aus `bridge.platform.language` lesen und als Quellsprache verwenden. Nie aus Browser oder Betriebssystem.
4. **Speichern nur über `bridge.storage`:** Beim Start alle Keys in **einem** `storage.get([...])` lesen, Zustand vor dem Gameplay wiederherstellen. Schreiben nur bei sinnvollem Fortschritt, alle geänderten Keys in einem Call (Details in Abschnitt 11).
5. **Pause und Audio:** Beim Start `bridge.platform.isAudioEnabled` prüfen, bei `false` stumm starten. Auf `AUDIO_STATE_CHANGED` und `PAUSE_STATE_CHANGED` reagieren, und zwar **an einer zentralen Stelle** für Ads, Tabwechsel und Systempausen. Außerdem beim Start `interstitialState === 'opened'` prüfen.
6. **`bridge.platform.sendMessage('game_ready')`** erst, wenn der erste spielbare Frame gerendert ist und Eingaben angenommen werden. Nie, solange ein Ladescreen sichtbar ist.
7. **Interstitials:** `showInterstitial(placement)` an jeder natürlichen Pause aufrufen. **Keine eigenen Timer oder Zähler**, die Bridge entscheidet. `minimumDelayBetweenInterstitial` in der Config auf dem Plattform-Default lassen.
8. **Ausblenden, was nicht unterstützt wird:** Rewarded-Buttons bei `isRewardedSupported === false`, den Shop bei `payments.isSupported === false`, das Leaderboard bei `leaderboards.type === 'not_available'`, externe Links bei `isExternalLinksAllowed === false`.
9. Rewarded: Belohnung **nur** im State `rewarded`. Payments: Permanente Käufe bei jedem Start mit `getPurchases()` prüfen, Consumables immer konsumieren.

### 3.2 Game Requirements – die Punkte, die dieses Spiel besonders betreffen

- **1.4 / 1.5 Steuerung:** Komplett per Touch-Gesten **und** komplett per Maus/Tastatur spielbar. Langes Drücken markiert keinen Text und öffnet kein Kontextmenü und keine iOS-Lupe.
- **1.6 Layout:** Füllt jede Größe, jedes Seitenverhältnis und beide Orientierungen, **auch 1:1**. Nichts abgeschnitten oder überlappend, kein Seiten-Scrollen. Jedes Popup hat ein X. Text bleibt lesbar. Einhändig bedienbar.
- **1.7 Stabilität:** Keine Fehler beim Drehen, beim Minimieren, nach Ads oder bei Browser-Back. Chrome, Firefox, Safari, Edge und Opera auf Windows, macOS, Android und iOS.
- **2.1 Ads:** Nur in logischen Pausen, nie im aktiven Gameplay. Nie unter dem Finger oder Cursor. Während Ads ist alles pausiert und stumm. Fehlt eine Ad, geht das Spiel normal weiter.
- **2.2 Rewarded:** Opt-in-Button, der klar sagt, dass eine Werbung kommt und was die Belohnung ist. Immer ablehnbar. Nur ein Bonus, nie Voraussetzung für Fortschritt. Revive oder Extra-Zeit **höchstens einmal pro Versuch**.
- **3.1 Gameplay:** Steigende Schwierigkeit, klares Setting, Tutorial durch Spielen statt Textwand.
- **3.2 Speichern:** Fortschritt überlebt Reload, Rotation und Ad.
- **3.3 Sound:** Musik und SFX als ogg/mp3 aus echten Audio-Assets. Mute-Button vorhanden. Kein Ton im Hintergrund.
- **3.4 Sprache:** Englisch ist Default und Fallback. Jede deklarierte Sprache vollständig übersetzt. Sprachwahl über Globus- oder Zahnrad-Icon, Sprachen in ihrer eigenen Schrift („Deutsch", „Español").
- **3.5:** Titel im Spiel: exakt **„Spy Lab"**.
- **4.3.2:** Eigenes, gestaltetes Interface. Keine Emoji, kein generischer Template-Look.

### 3.3 YouTube Playables & Partnerportale

- **Initialer Build ≤ 30 MB**, Ziel ist aber ein Initial Download < 5 MB (Abschnitt 12).
- **Hoch- und Querformat**, beide sauber angepasst, keine schwarzen oder unscharfen Ränder, auch nicht auf dem Desktop.
- Keine externen Calls, auch keine eingebaute Analytics außerhalb der Bridge.
- Dateinamen nur `a–z A–Z 0–9 . - _`, **≤ 8000 Dateien** im Bundle.
- Läuft auf allen Gerätetypen. Hohe Playtime ist das Auswahlkriterium.
- Für MSN wäre ein Build < 50 MB nötig. Mit unserem Budget ist das automatisch erfüllt.

### 3.4 Inhaltsregeln

Keine Waffen, kein Blut, keine Gewalt. Gadgets sind nicht tödlich (Schaumnetz, Rauchwolke, Magnet). Keine realen Länder, Politik oder Religion. Alle Orte und Namen sind fiktiv. Keine Anspielungen auf bekannte Marken oder Franchises (kein „007", „Bond" oder Ähnliches, Regel 4.2.3). Glücksspiel-Mechaniken mit Echtgeld sind verboten. Belohnungs-Kisten sind deshalb nie kaufbar.

---

## 4. Tech-Stack & Architektur

- **Vite + TypeScript (strict) + Three.js.** Keine Physik-Engine, Kollisionen sind einfach selbst gebaut.
- **UI:** DOM-Overlay über dem Canvas mit **Preact + @preact/signals** (klein und gut wartbar). Text bleibt scharf, Lokalisierung und Responsive-Layout sind einfach.
- **Audio:** ein zentraler `AudioManager` auf Web Audio (oder Howler.js) mit **einer** Master-Gain: stumm, wenn `userMuted || !platformAudioEnabled || paused || adOpen || pageHidden`.
- **Asset-Pipeline:** `npm run assets` packt `assets-src/` (Rohdaten, nie im Build) nach `public/assets/`. glTF/GLB über `gltf-transform` (prune, dedup, weld, quantize, meshopt), Texturen als Palette-Atlas, Audio als mp3 (optional zusätzlich ogg). Originale bleiben in `assets-src/`.
- **Build:** `npm run build` erzeugt `dist/`. `npm run package` erzeugt `spy-lab-vX.Y.Z.zip`. `npm run check-build` prüft Dateinamen, Dateianzahl, Gesamtgröße, Initial Download, das Vorhandensein von `index.html` und Config sowie das Fehlen von Source Maps.
- **Tests:** Playwright für Smoke-Test, Screenshot-Matrix und Ad-Flow-Tests mit einem Dev-Ad-Simulator.

```
spy-lab/
  index.html
  public/playgama-bridge-config.json
  assets-src/                 # Rohassets von Anton, wird nie gebaut
  scripts/                    # build-assets, package, check-build, sim-economy
  src/
    main.ts                   # Bootstrap: Bridge init → Save laden → Kern-Assets → Start
    platform/                 # bridge.ts (EINZIGER Zugriff auf window.bridge), ads.ts, devAdSimulator.ts
    core/                     # loop, time, events, store, save, rng, format (große Zahlen)
    config/                   # economy, rooms, missions, minigames, gadgets, ads, pacing, i18n-langs
    render/                   # renderer, quality tiers, asset loader, materials, camera rig
    academy/                  # AcademyScene, Room, Cadet, Elevator, SupplyDrone
    missions/                 # WorldMap, MissionFlow, Briefing, Results, Boss
    minigames/                # Minigame.ts (Interface) + safe/ laser/ code/ mole/ scooter/ circuit/
    meta/                     # agents, gadgets, prestige, daily, contracts, fieldops, achievements
    ui/                       # Preact: hud, screens, popups, theme.css, icons (SVG)
    i18n/                     # en.json (Quelle), de, es, pt, fr, ru, tr
    audio/                    # AudioManager
    analytics/                # telemetry.ts (Events + performance_sample-Adapter)
    debug/                    # window.__spylab-Hooks (nur DEV oder ?debug=1)
  tests/                      # Playwright
```

**Minispiel-Interface (alle 6 implementieren es):**

```ts
interface Minigame {
  id: MinigameId;
  init(ctx: GameContext, params: DifficultyParams, mods: MissionModifiers): Promise<void>;
  start(): void;
  update(dt: number): void;         // dt in Sekunden, unabhängig von der Bildwiederholrate
  pause(): void; resume(): void;
  revive(): void;                   // wird nach Rewarded „Continue" aufgerufen
  useHint(): void;                  // falls das Spiel Hinweise hat
  dispose(): void;                  // Geometrien, Texturen und Listener freigeben
  onResult: (r: MinigameResult) => void; // { success, stars, timeLeft, mistakes, intel }
}
```

---

## 5. Game Design

### 5.1 Setting, Ton, Figuren

- **Ton:** fröhliche Agentenkomödie für alle Altersgruppen. Witzig statt düster, Slapstick statt Gewalt.
- **Die Tarnung:** „Sweet Secrets Bakery" an einer gemütlichen Hafenstraße. Kadetten betreten den Laden als „Kunden" und fahren hinter dem Ofen mit einem Geheimaufzug nach unten.
- **Spieler:** der neue Direktor oder die neue Direktorin von Spy Lab.
- **Mentorin:** **Agent Marmalade**, eine pensionierte Top-Spionin mit Sonnenbrille und Schürze. Sie führt durchs Tutorial und kommentiert in Sprechblasen mit maximal einer Zeile.
- **Gegner:** **The Velvet Paw**, eine Diebesbande in schwarzen Anzügen mit Katzenohr-Masken. Sie stiehlt berühmte (fiktive) Schätze. Pro Region gibt es einen Boss: Captain Clawford (Harbor Bay), Lady Snowpaw (Snowpeak), Sandy Sphinx (Dune Oasis), Neo Tom (Neon City) und als Endboss Baron Velvet (Sky Station).
- **Gefangen wird mit Comic-Mitteln:** Schaumnetz, Stempel „CAPTURED", Konfetti.

### 5.2 Die drei Loops

| Loop | Dauer | Inhalt |
|---|---|---|
| Kurz | 10–30 s | Geld einsammeln, Raum upgraden, Kadetten beim Training zusehen, Drohnenkiste öffnen |
| Mittel | 1–3 Min | Mission wählen → Briefing → Minispiel (30–90 s) → Ergebnis mit Sternen → Belohnung (Rewarded x2) → zurück (Interstitial-Punkt) |
| Lang | 10–60 Min | Neuer Raum, neue Region, Akademie-Level-up, Boss, Gadget-Forschung, Prestige („Relocate HQ") |
| Meta | Tage | Daily Rewards, Daily Contracts, Field Ops, Offline-Erträge, Achievements, Endless Ops |

### 5.3 Die Akademie (Tycoon-Ansicht)

- **Darstellung:** 3D-Querschnitt nach unten wie eine Ameisenfarm. Oben die Bäckerei an der Straße, darunter Stockwerke mit je zwei Räumen links und rechts des Aufzugschachts. Kamera: Perspektive mit kleinem FOV, vertikal ziehen bzw. scrollen, Pinch- oder Mausrad-Zoom in Grenzen, Tippen auf einen Raum fährt sanft heran.
- **Hochformat:** zeigt ~4 Stockwerke, HUD oben, Aktionsleiste unten. **Querformat:** zeigt ~3 Stockwerke breiter, Aktionsleiste rechts. Beide sind einhändig bedienbar.
- **Räume:**

| Stock | Raum | Typ | Skill | Minispiel | Freischaltung (Ziel) |
|---|---|---|---|---|---|
| EG | Sweet Secrets Bakery | Tarnladen | – | – | Start. Passives Einkommen, Rekrutierung |
| −1 | Mission Control | Support | – | Weltkarte, Field Ops | Start |
| −1 | Vault Workshop | Training | Finesse | Safe Cracker | Start |
| −2 | Laser Gym | Training | Stealth | Laser Hall | ~1:30 |
| −2 | Cipher Room | Training | Brains | Code Breaker | ~5:00 |
| −3 | Disguise Studio | Training | Charm | Spot the Mole | ~8:00 |
| −3 | Gadget Lab | Support | – | Gadgets herstellen | ~10:00 |
| −4 | Driving Simulator | Training | Agility | Scooter Pursuit | ~14:00 |
| −4 | Hack Lab | Training | Tech | Circuit Hack | ~20:00 |
| −5 | Baustelle „Coming soon" | Teaser | – | – | Sichtbar ab Start, macht neugierig auf Updates |

- **Gesperrte Räume** sind als Baustelle mit Preis und Schloss sichtbar. Der nächste kaufbare Raum pulsiert leicht.
- **Trainingsraum-Mechanik:** Slots für Kadetten (2 → 6). Jeder Kadett trainiert in Zyklen (Basis 5 s) und bringt pro Zyklus **Cash** (Studiengebühr) und **Skill-XP**. Ohne Ausbilder sammelt sich das Cash in einem Stapel bis zu einem Limit und muss angetippt werden (frühes Engagement). Mit **Ausbilder** wird automatisch eingesammelt und der Zyklus ist schneller.
- **Upgrade-Panel pro Raum:** Level (Einkommen), Slots, Geschwindigkeit, Ausbilder einstellen. Meilensteine bei Lv 10/25/50/100/150/200 verdoppeln das Einkommen, mit großer Feier (Kamerafahrt, Stempel, Sound).
- **Animationen:** Kadetten laufen in jedem Raum in einer passenden Schleife (über Laser hüpfen, an Tresoren lauschen, tippen, Hüte probieren, im Fahrsimulator wackeln). Das macht den Querschnitt lebendig.

### 5.4 Kadetten, Agenten, Ausbilder

- **Kadetten** entstehen in der Bäckerei (Rekrutierungsrate per Upgrade), fahren mit dem Aufzug nach unten und gehen in freie Slots. Nach genug Zyklen **graduieren** sie: Hutwurf-Animation, dann eine **Agentenkarte** (Name aus Namensliste, 6 Skill-Werte aus dem Training, Seltenheit Common/Rare/Epic/Legendary nach Gesamtwert).
- **Agenten** (Roster-Limit 6, per Upgrade bis 12): werden für Missionen gewählt (das Spiel schlägt automatisch den besten vor) und leveln durch Missionen. Ihr Skill im passenden Bereich gibt dem Minispiel Boni (Tabelle in 5.6).
- **Überzählige Absolventen** gehen in **Field Ops** (Mission Control): Idle-Aufträge mit 5, 15 oder 60 Min für Cash und Intel. Das sind Gründe zurückzukommen und ein Rewarded „Finish now".
- **Ausbilder** pro Raum: einmalig mit Cash einstellen. Automatisierung und +Geschwindigkeit. Fünf Charakter-Varianten mit eigenem Look.

### 5.5 Weltkarte & Missionen

- **Weltkarte** als stilisierter 3D-Globus oder Inseln-Diorama mit 5 fiktiven Regionen: **Harbor Bay** (Hafen), **Snowpeak** (Bergstation), **Dune Oasis** (Wüstenbahnhof), **Neon City** (Megastadt bei Nacht), **Sky Station** (Luftschiff-Hafen, Finale).
- **Pro Region 10 Missionen + 1 Boss = 55 Missionen zum Start.** Eine Mission ist ein Minispiel auf einer Schwierigkeitsstufe (1–10), mit Region-Look (Palettentausch und 5–8 eigene Props).
- **Sterne 1–3** pro Mission (z. B. Zeit übrig, keine Fehler, alle Intel-Chips) laden zum Wiederholen ein. Sterne plus Akademie-Level schalten Regionen frei.
- **Boss-Missionen:** 2–3 Minispiele hintereinander mit gemeinsamer Alarm-Leiste. Danach eine Cutscene: Boss im Schaumnetz, Stempel „CAPTURED", großer Belohnungsregen.
- **Villain Alerts:** Alle 5–8 Min aktiver Spielzeit (Config) blinkt eine rote Alarm-Mission auf der Karte („Velvet Paw spotted in Neon City!"), 3 Min verfügbar, Bonus in Gold Badges.
- **Endless Ops** (ab Abschluss von Region 2): prozedural parametrisierte Missionen mit steigender Schwierigkeit. Endloser Inhalt für lange Playtime.
- **Missions-Flow:** Briefing als Akte (Foto des Ziels, Minispiel-Icon, Belohnung, Agentenwahl, Gadget-Slot) → Minispiel → Ergebnis (Sterne-Stempel, Belohnung, Rewarded x2) → **Continue** (Interstitial-Punkt) → zurück zur Karte oder Akademie.

### 5.6 Die 6 Minispiele

Gemeinsame Regeln: 30–90 s, eigene kleine 3D-Szene im gleichen Renderer, steuerbar per Maus/Tastatur **und** einhändig per Touch. Beim ersten Mal ein interaktives Tutorial mit Geisterhand, kein Text. Schwierigkeitsparameter je Stufe 1–10 in `config/minigames.ts`. Pause über eigenen Button oder `P`, nie Esc.

| # | Minispiel | Skill | Kernmechanik | Steuerung (Desktop / Touch) | Schwierigkeit skaliert | Fail | Agenten-Bonus | Ad-Hooks |
|---|---|---|---|---|---|---|---|---|
| 1 | **Safe Cracker** | Finesse | Ein Zeiger kreist um das Tresorrad. Im grünen Sweet Spot tippen, damit ein Bolzen klickt. 3–6 Bolzen | Klick oder Leertaste / Tippen | Zeigertempo, Zonengröße, Richtungswechsel, Fake-Zonen | 3 Fehlversuche lösen den Alarm aus | breitere Zone | Revive, x2 |
| 2 | **Laser Hall** | Stealth | Isometrischer Flur (Raster 5×12). Agent springt Feld für Feld zum Koffer. Laser statisch, blinkend, schwenkend, Kameras mit Sichtkegel. Optionale Intel-Chips | WASD/Pfeile oder Klick auf Nachbarfeld / Swipe oder Tippen | Laseranzahl, Takt, bewegliche Emitter, Kameras | Laser- oder Kamerakontakt | längere Aus-Phasen | Revive (1×/Versuch), x2 |
| 3 | **Code Breaker** | Brains | Mastermind am Keypad: 4 Stellen aus 5–7 Symbolen. Grün = richtig und an der richtigen Stelle, Gelb = richtig, falsche Stelle. 6–8 Versuche | Klick oder Tasten 1–7, Enter / Tippen | Symbolanzahl, Versuche, Zeitlimit ab Stufe 5, doppelte Symbole | Versuche oder Zeit aufgebraucht | +1 Versuch je Schwelle | Hinweis (1 gratis, dann per Ad), Revive (+2 Versuche) |
| 4 | **Spot the Mole** | Charm | 3D-Bahnhofshalle mit 15–40 umherlaufenden NPCs (instanziert, kombinierbare Hüte, Brillen, Mäntel, Koffer). Hinweise erscheinen nacheinander („red hat", „briefcase", „glasses"). Den Maulwurf antippen | Klick / Tippen | NPC-Zahl, ähnliche Varianten, langsamere Hinweise, Bewegungstempo | Zeit abgelaufen. Falscher Tipp kostet 5 s | schnellere Hinweise | Hinweis (50 % der Falschen ausblenden), Revive (+15 s) |
| 5 | **Scooter Pursuit** | Agility | Verfolgung auf dem Roller in 3 Spuren durch die Region-Straße, recycelte Segmente. Hindernissen ausweichen, Boost-Pads treffen, Intel-Chips sammeln. Die Aufhol-Leiste füllen, bevor die Zeit abläuft | Pfeile/AD / Swipe | Tempo, Hindernisdichte, Spurwechsel-Muster, Zeit | Zeit abgelaufen oder 3 Crashes | höheres Grundtempo | Revive (1×/Versuch), x2 |
| 6 | **Circuit Hack** | Tech | Leitungs-Puzzle: Kacheln drehen, bis Strom von der Quelle zu allen Zielen fließt. Prozedural erzeugt und immer lösbar (erst Pfad erzeugen, dann verdrehen) | Klick / Tippen | Rastergröße 4×4 bis 7×7, mehrere Ziele, Zeit | Zeit abgelaufen | +Zeit | Hinweis (3 Kacheln lösen), Revive (+20 s) |

Zusätzlich: **Vault Bonus**, eine Safe-Cracker-Bonusrunde nach Boss oder Akademie-Level-up. Jeder geknackte Bolzen gibt Beute, ein Extraversuch gibt es per Rewarded.

### 5.7 Gadgets (Gadget Lab)

Herstellung mit Intel und Wartezeit, Verbrauch pro Mission. 1 Gadget-Slot, ein zweiter per Upgrade.

| Gadget | Minispiel | Effekt |
|---|---|---|
| Stethoscope Pro | Safe Cracker | Sweet Spot +15 % |
| Mirror Shield | Laser Hall | fängt einen Treffer ab |
| Decoder Lens | Code Breaker | deckt zu Beginn ein Symbol auf |
| Face Scanner | Spot the Mole | entfernt 3 falsche Verdächtige |
| Turbo Kit | Scooter Pursuit | Start mit Boost |
| Auto-Splicer | Circuit Hack | 2 Kacheln vorgelöst |

Rewarded „Gadget gratis für diese Mission" sitzt im Briefing (Abschnitt 7.2).

### 5.8 Progression & Prestige

- **Akademie-Level 1–30** über XP aus Upgrades, Missionen und Absolventen. Jedes Level schaltet etwas frei (Raum, Region, Slot, Feature). Level-up mit Feier-Popup.
- **Prestige „Relocate HQ"** ab Akademie-Level 15 (Ziel: erstmals nach 40–60 Min): Der Spieler zieht in einen neuen Tarnladen. Cash und Raumlevel werden zurückgesetzt. Agenten, Gadgets, Sterne und Gold Badges bleiben. Es gibt **Legacy Medals** (aus dem insgesamt verdienten Cash), jede bringt dauerhaft +10 % Einkommen. Jeder neue Laden hat einen neuen Look: Bakery → Ice Cream Parlor → Flower Shop → Toy Store → Lighthouse. Das ist frischer visueller Inhalt.

### 5.9 Retention-Systeme

- **Offline-Erträge:** 50 % Effizienz, Basis-Limit 2 h (per Mission Control bis 8 h). Welcome-back-Popup mit Rewarded x2. Gilt auch, wenn der Tab länger als 60 s pausiert oder versteckt war.
- **Daily Rewards:** 7-Tage-Zyklus über das Bridge-Modul `dailyRewards` (prüfe die Plattform-Unterstützung in der Doku, sonst eigener Fallback über Storage). Rewarded „Doppelt".
- **Daily Contracts:** 3 Aufgaben pro Tag („Win 3 Laser Hall missions", „Upgrade rooms 15 times", „Earn 5 stars"). Belohnung in Gold Badges. Prüfe, ob das Bridge-Modul `tasks` passt, sonst eigene Umsetzung.
- **Achievements:** im Spiel immer vorhanden, zusätzlich über das Bridge-Modul, wo unterstützt.
- **Leaderboard** „Legacy Medals" nur, wo `leaderboards.type` verfügbar ist.
- **Zeitquelle:** `bridge.platform.getServerTime()`, wenn `isExternalCallsSupported` gilt, sonst `Date.now()`. Immer prüfen: Zeitdifferenz nicht negativ, Offline-Zeit begrenzt, Zurückdrehen der Uhr gibt keine Belohnung.

### 5.10 Währungen, Ökonomie, Pacing

- **Cash** (weiche Währung, große Zahlen), **Intel** (aus Missionen und Field Ops, für Regionen, Räume und Gadgets), **Gold Badges** (Daily, Achievements, Bosse, Rewarded; für Sofort-Fertigstellungen, Spezial-Ausbilder und Kosmetik).
- **Startformeln** (in `config/economy.ts`, Feinjustierung über die Simulation):
  - Upgradekosten: `cost(L) = baseCost × 1.15^(L−1)`
  - Einkommen pro Zyklus: `baseIncome × L × milestoneMult × legacyMult × boostMult`
  - Raumfreischaltung: jeder neue Trainingsraum kostet etwa das 8–10-Fache des vorherigen
  - Zahlenformat: 1.2K, 3.4M, 5.6B, 7.8T, danach aa, ab, … Lokalisierte Dezimaltrenner
- **Ökonomie-Simulation:** `npm run sim` simuliert einen Durchschnittsspieler headless (sammelt ein, upgradet das günstigste sinnvolle Ziel, spielt Missionen mit 70 % Erfolgsquote, keine Ads) und gibt die Freischaltzeiten aus. **Die Pacing-Tabelle ist die Anforderung, die Zahlen sind nur Startwerte.** Das Spiel muss **ohne Ads** fair spielbar sein. Ads beschleunigen nur.

**Pacing-Ziel für die erste Session:**

| Zeit | Ereignis |
|---|---|
| 0:00 | `game_ready`: Akademie sichtbar, ein Kadett trainiert im Vault Workshop. Geisterhand zeigt auf den Geldstapel |
| 0:05 | Erstes Einsammeln, Münzen fliegen zum Zähler |
| 0:15 | Erstes Upgrade |
| 0:40 | Erster Absolvent wird Agent (Karten-Reveal) |
| 0:45 | Mission 1 (Safe Cracker, Stufe 1) → Sieg → x2-Belohnung **gratis als Demo** („Next time: watch an ad to double!") |
| 1:30 | Laser Gym kaufbar → Mission 2 (Laser Hall) |
| 3:00 | Erste Versorgungsdrohne (Kiste gratis) |
| 4:00 | Erster Ausbilder (Automatisierung) |
| 5:00 | Cipher Room → Code Breaker |
| 6:30 | Akademie-Level 3, Income Boost freigeschaltet |
| 8:00 | Disguise Studio → Spot the Mole |
| 10:00 | Gadget Lab, erstes Gadget gratis |
| 12:00 | Boss Captain Clawford verfügbar |
| 14:00 | Region Snowpeak, Driving Simulator → Scooter Pursuit |
| 17:00 | Field Ops freigeschaltet |
| 20:00 | Hack Lab → Circuit Hack, Daily Contracts aktiv |
| 40–60 Min | Erstes Prestige möglich |

---

## 6. First-Time User Experience (Gameplay Conversion)

1. **Kein Hauptmenü, keine Splash-Kette, kein Namensfeld, keine Anmeldung.** Ladescreen (Logo plus echter Fortschrittsbalken) → direkt die Akademie.
2. **Initial Download nur:** Bridge, Engine, Akademie-Kern (Bäckerei, Stockwerke −1/−2), Kadetten-Modell, HUD, Safe Cracker, Kern-SFX, Musik-Loop 1, die Sprachdatei der aktuellen Sprache. Alles andere lädt im Hintergrund nach `game_ready` oder bei Bedarf. Größere Nachladungen werden mit `in_game_loading_started` und `in_game_loading_stopped` gemeldet.
3. **`game_ready`** nach dem ersten gerenderten Frame mit aktivem Input.
4. **Tutorial durch Spielen:** Agent Marmalade sagt pro Schritt höchstens eine Zeile. Geisterhand und Highlight-Ring zeigen das Ziel, es kommt eine Mechanik nach der anderen. Steuerungshinweise passen zum Gerät (Maus- oder Tastatur-Icons auf dem Desktop, Gesten-Icons auf Touch). Das Tutorial kommt nach einem Reload nie wieder.
5. **Tutorial-Schritte:** Einsammeln → Upgrade → Absolvent → erste Mission → Ergebnis und x2-Demo → neuen Raum kaufen → Ausbilder einstellen. Danach übernimmt die **„Director's Orders"-Leiste** (immer 3 aktive Ziele mit Belohnung) die Führung.
6. **Während des Tutorials keine Interstitials** und keine Rewarded-Angebote außer der Gratis-Demo.

---

## 7. Monetarisierung

Alle Ad-Aufrufe laufen über `src/platform/ads.ts`. Placement-IDs stehen in `config/ads.ts` und in `playgama-bridge-config.json` (`advertisement.interstitial.placements`, `advertisement.rewarded.placements`, `preloadOnStart`).

### 7.1 Interstitials – an jeder natürlichen Pause

**Wichtig:** Die Bridge entscheidet, ob und wann wirklich eine Ad kommt. Sie hält die erste zurück und hält den Plattform-Abstand ein, laut Playgama-Guide typisch 120–240 s. Eigene Timer oder Zähler sind verboten. **Unser Hebel ist die Zahl der Pausen:** Das Spiel liefert alle ~60–90 s eine, damit jedes erlaubte Fenster genutzt wird.

| Placement | Aufruf bei |
|---|---|
| `mission_end` | Tap auf **Continue** im Missionsergebnis, nachdem das Rewarded-Angebot erledigt oder abgelehnt ist |
| `boss_end` | nach der Boss-Cutscene |
| `map_close` | Weltkarte → Akademie |
| `level_up` | Schließen des Akademie-Level-up-Popups |
| `panel_close` | Schließen von Shop, Agents, Gadget Lab, Field Ops |
| `pause_resume` | Rückkehr aus dem Pause-Menü |
| `prestige` | nach der Relocate-Animation |

Regeln: nie während Minispiel, Tutorial, Cutscene oder Kamerafahrt. Kein Interstitial an genau dem Punkt, an dem im selben Flow gerade ein Rewarded gesehen wurde (Zustands-Flag, kein Timer). Nach der Ad geht das Spiel genau dort weiter, wo es war.

### 7.2 Rewarded – 14 Platzierungen mit echtem Nutzen

Jeder Button hat das Ad-Icon (eigenes SVG mit Play-Symbol, kein Emoji) und nennt die Belohnung, z. B. **„[Ad-Icon] Watch ad: x2 rewards"**. Ablehnen ist immer möglich. Bei `isRewardedSupported === false` sind alle Buttons ausgeblendet. Bei `failed` erscheint ein Toast („No ad available right now") und das Spiel geht normal weiter.

| Placement | Ort | Belohnung | Regel |
|---|---|---|---|
| `mission_double` | Ergebnis nach Sieg | x2 Cash + Intel (ab Region 3: x3) | Erstes Mal gratis als Demo |
| `mission_revive` | Fail-Screen | Weiter (Laser, Scooter) bzw. +Versuche oder +Zeit | **max. 1× pro Versuch** (2.2.4) |
| `mission_skip` | nach ≥ 2 Fails derselben Mission | Mission bestanden (1 Stern, ohne Doppelung) | – |
| `minigame_hint` | Code Breaker, Spot the Mole, Circuit Hack | Hinweis | 1 Hinweis pro Mission gratis, danach per Ad |
| `gadget_trial` | Missions-Briefing | 1 passendes Gadget gratis für diese Mission | – |
| `offline_double` | Welcome-back-Popup | Offline-Ertrag x2 | – |
| `income_boost` | HUD-Button | x2 Einkommen 5 Min, stapelbar bis 30 Min | Restzeit im HUD sichtbar |
| `supply_drop` | Drohne fliegt alle ~3 Min aktiver Zeit (Config) über die Akademie | Kiste: Minuten-Einkommen, Gold Badges oder Gadget | Erste Kiste gratis. Ungeöffnet fliegt sie nach 20 s weiter |
| `missing_cash` | Upgrade-Button, wenn ≤ 25 % fehlen | fehlender Betrag | höchstens alle 2 Min angeboten |
| `vip_recruit` | gelegentlich ein Wunderkind vor der Bäckerei | Kadett mit hoher Seltenheit | – |
| `fieldop_finish` | Field-Ops-Timer | sofort fertig | – |
| `daily_double` | Daily-Reward-Popup | doppelte Tagesbelohnung | – |
| `vault_retry` | Vault Bonus | zusätzlicher Versuch | 1× pro Runde |
| `free_badges` | Shop | Gold Badges | Cooldown 10 Min |

Ablauf in `ads.ts`: `showRewarded(placement)` → bei State `rewarded` die Belohnung für **dieses** Placement gutschreiben (über `rewardedPlacement` oder eine eigene Pending-Map) → bei `closed` oder `failed` den Flow sauber beenden. Für lokale Tests gibt es einen `devAdSimulator` (nur DEV), der `opened`, `rewarded`, `closed` und `failed` simuliert.

### 7.3 Banner

Niedrige Priorität: Laut Bridge-Doku unterstützen **Playgama selbst und YouTube keine Banner**, sondern nur einige Partnerportale (z. B. MSN, Yandex, GameDistribution). Nur Bridge-Sticky-Banner und nur, wo `bridge.advertisement.isBannerSupported` gilt: auf Weltkarte, Shop und Agents-Screen, nie in Akademie-Gameplay oder Minispielen. Vor dem Gameplay wird `hideBanner()` aufgerufen. Die Banner-Safe-Zone ist nur reserviert, wenn Banner unterstützt werden, sonst gibt es keine leere Fläche. Ein Banner pro Screen.

### 7.4 In-App-Käufe (optional, Phase 7)

Nur bei `payments.isSupported`: **Remove Ads** (permanent: schaltet Interstitials und Banner ab, Rewarded bleiben), **Starter Pack** (einmalig, nach der ersten Session angeboten), 3 Gold-Badge-Pakete. Preise kommen immer aus `getCatalog()`. Permanente Käufe werden bei jedem Start wiederhergestellt, Consumables sofort konsumiert, unverarbeitete Käufe beim Start nachgeholt (2.4.x).

---

## 8. Art Direction & UI

- **Look:** bunter Low-Poly-Cartoon, Flat Shading, **ein gemeinsamer Paletten-Atlas** für fast alle Modelle (wenige Draw Calls). Weiches Hemisphere-Licht plus ein Directional Light. Schatten als Blob-Discs statt Shadow Maps auf Mobile.
- **Palette:** Nachtblau und Petrol als Basis, warme Akzente in Senfgelb und Koralle, Bäckerei in Pastell. Pro Region ein eigenes Farbschema.
- **UI-Motiv „Top Secret":** Panels als Manila-Akten mit Büroklammer, Stempel („CLASSIFIED", „MISSION COMPLETE", „CAPTURED"), Überschriften im Schreibmaschinen-Stil, Fließtext in einer gut lesbaren runden Sans. Icons als eigenes SVG-Set (oder Kenney Game Icons, eingefärbt), **keine Emoji**.
- **Juice:** Münzen fliegen zum Zähler, Zahlen-Popups, Tween-Bounce bei Buttons, Konfetti, Stempel-Animation, sanfte Kamerafahrten bei Freischaltungen, leichter Screen-Shake nur bei Alarm. Jede Aktion hat Sound.
- **HUD:** oben Cash, Intel, Gold Badges und der Income-Boost-Timer. Unten (Hochformat) bzw. rechts (Querformat) die Aktionsleiste: Map, Agents, Gadgets, Shop, Settings (Zahnrad mit Mute, Musik und Sprache über Globus). Daneben die „Director's Orders"-Leiste.
- **Responsive:** „Expand"-Strategie mit Safe-Rechteck 9:16 bzw. 16:9, die Welt reicht in den Rest. UI am Bildschirmrand verankert, Größen relativ zur kurzen Seite, Touch-Ziele ≥ 44 px, Safe Area über `bridge.device.safeArea`, Canvas-Größe per `ResizeObserver`, `devicePixelRatio` auf max. 2 begrenzt. Viewport-Meta, `overflow:hidden`, `100dvh`, `touch-action:none`, `user-select:none`, `-webkit-touch-callout:none`, `contextmenu` → `preventDefault()`.

---

## 9. Audio

- **Musik (Loops):** Akademie (leichter Lounge- oder Spy-Jazz), Mission (Spannung), Boss, dazu Jingles für Sieg und Niederlage.
- **SFX:** UI-Klick, Münzen, Upgrade, Freischaltung, Stempel, Level-up, Laser-Summen und -Zischen, Alarm, Tresorklicken, Bolzen springt auf, Keypad-Piepen, Roller und Whoosh, Menschenmenge (Ambient), Drohne, Kiste öffnen.
- Nur aus `assets-src/audio`. Fehlt etwas, kommt eine stille Platzhalterdatei rein und es wird gemeldet. **Nie synthetisieren.**
- Ein Volume-Controller: Mute-Button, Musik- und SFX-Regler, Plattform-Audio-State, Pause, Ad und Tab-versteckt wirken alle auf dieselbe Master-Gain. Audio-Unlock beim ersten Input (Autoplay-Regeln).

---

## 10. Lokalisierung

- Sprachen: **EN (Quelle, Default, Fallback)**, DE, ES, PT, FR, RU, TR. Alle Strings über Keys in `i18n/*.json`. Keine Texte in Code oder Texturen.
- Sprache aus `bridge.platform.language`. Bei nicht unterstützter Sprache gilt EN.
- Schrift mit Latein, kyrillisch und türkischen Zeichen (z. B. Nunito oder Rubik, OFL), lokal ausgeliefert und auf benutzte Glyphen reduziert.
- Längere Sprachen (DE, RU) dürfen nichts abschneiden: automatische Schriftverkleinerung bis zu einem Minimum, sonst Umbruch.

---

## 11. Speichern

- Keys mit Version: `spylab_v1_core` (Cash, Räume, Akademie-Level, Prestige), `spylab_v1_agents`, `spylab_v1_progress` (Missionen, Sterne, Gadgets), `spylab_v1_meta` (Daily, Contracts, Field Ops, Tutorial-Status, Zeitstempel), `spylab_v1_settings`.
- **Beim Start ein einziges `storage.get([...alle Keys])`.** Fehlende Keys bedeuten Defaults. Migration bei neuer Version.
- **Schreiben** nach sinnvollen Ereignissen (Upgrade, Raumkauf, Mission, Absolvent, Kauf, Einstellung, Prestige). **Gebündelt und gedrosselt:** nur geänderte Keys, frühestens alle 10 s, außerdem sofort bei `PAUSE_STATE_CHANGED → true` und bei `visibilitychange → hidden`. Nie pro Frame.
- Fortschritt muss Reload, Rotation und Ad überleben (3.2.3). Dafür gibt es einen eigenen Playwright-Test.

---

## 12. Performance-Budget

| Metrik | Ziel |
|---|---|
| Initial Download | **< 5 MB** (harte Grenze 15 MB) |
| Gesamt-Bundle | < 25 MB (YouTube: 30 MB) |
| Zeit bis zum ersten spielbaren Frame | **< 5 s** auf 4G, nie > 10 s |
| FPS | stabile 60 auf Mittelklasse-Handy, nie < 30, auf 60 gedeckelt |
| Speicher | < 400 MB auf Mobile |
| Draw Calls | Akademie < 150, Minispiele < 100 (Mobile) |

Maßnahmen: statische Meshes pro Raum zusammenfassen, ein Paletten-Material, `InstancedMesh` für NPCs und Props, max. ~30 animierte Figuren gleichzeitig sichtbar (der Rest einfacher), Geometrie und Texturen beim Verlassen einer Minispiel-Szene freigeben, keine Allokationen im Frame-Loop, `requestAnimationFrame` mit Delta-Time. **Quality Tiers** (low/mid/high: Pixel-Ratio, Schatten, Partikel) mit automatischem Downgrade, aber nicht in den ersten 10 s. WebGL Context Loss behandeln (`preventDefault` und Ressourcen neu hochladen oder ein „Tap to reload"-Screen). Bei Plattform-Pause oder verstecktem Tab läuft keine Loop.

---

## 13. Analytics & Telemetrie

- **Missionen über Plattform-Messages** (die Bridge zeichnet sie automatisch als Analytics auf, also **nicht** zusätzlich per `analytics.send` senden): `level_started`, `level_completed`, `level_failed` mit `{ world: regionId, level: missionId }`, dazu `level_paused` und `level_resumed`.
- **Eigene Events** über `bridge.analytics.send` (stabile snake_case-Namen, variable Werte in die Daten):
  `tutorial_step {step}`, `tutorial_completed`, `room_unlocked {room_id}`, `room_milestone {room_id, level}`, `academy_level_up {level}`, `agent_graduated {rarity}`, `boss_defeated {region}`, `prestige {count}`, `rewarded_offer_shown {placement}`, `shop_opened {source}`, `gadget_crafted {gadget_id}`, `daily_claimed {day}`.
- **`performance_sample`** nach dem Playgama-Telemetrie-Vertrag (lies `get_game_telemetry_guide`): etwa alle 30 s aktiven, sichtbaren Gameplays ein aggregiertes Sample mit allen Pflichtfeldern (`target_fps`, `window_ms`, `active_ms`, `frame_count`, `fps_avg`, `fps_p10`, Frame-Time-Perzentile, `frames_over_*`, `build_version`). Gekapselt in **einem** Adapter.
- Keine personenbezogenen Daten. Keine Session-IDs selbst erfinden.

---

## 14. Testen & QA

- **Debug-Hooks** (nur DEV oder `?debug=1`) auf `window.__spylab`: `goto(screen)`, `startMission(id)`, `setTier(minigame, tier)`, `addCurrency(type, n)`, `skipTutorial()`, `timeWarp(minutes)`, `setQuality(tier)`, `simulateAd(result)`, `stats()` (FPS, Draw Calls, Dreiecke, Speicher).
- **Playwright:**
  - Smoke: Laden → `game_ready` → erster Tutorial-Schritt in < 5 s, keine Konsolenfehler.
  - **Screenshot-Matrix** aller Hauptscreens (Akademie, Briefing, jedes Minispiel, Ergebnis, Karte, Shop, Popups): 360×640, 390×844, 430×932, 844×390, 915×412, 768×1024, 1024×768, **640×640**, 800×450, 1280×720, 1366×768, 1920×1080, 2560×1440, 9:21, 21:9. Screenshots in `tests/screenshots/` ablegen und im Phasenbericht verlinken.
  - Speichern: Fortschritt nach Reload und nach simulierter Rotation identisch.
  - Ads: Rewarded gibt nur bei `rewarded` eine Belohnung, `failed` lässt das Spiel spielbar, Revive höchstens einmal pro Versuch, während einer Ad sind Loop und Audio pausiert.
- **QA Tool:** über das MCP `get_local_game_qa_tool_link` das lokal servierte Spiel in der Bridge-Umgebung testen.
- **Vor jedem Upload:** die Game Requirements und den **Game self-check** über das MCP neu lesen, Punkt für Punkt mit Nummer abhaken und melden, was du nicht selbst prüfen konntest.

---

## 15. Phasenplan

Jede Phase endet mit Tests, Screenshots, `PROGRESS.md`, Zahlenbericht und **Stopp**.

**Phase 0 – Fundament**
Projekt-Setup (Vite, TS, Three, Preact), `CLAUDE.md`. Bridge-Integration mit allen Pflichtschritten (Init vor dem Spiel, Config, Sprache, Audio und Pause zentral, Storage-Gerüst, `game_ready`). Responsive Canvas und UI-Layer, Ladescreen mit echtem Fortschritt, Asset-Pipeline, Build-, Package- und Check-Skripte, Debug-Hooks, Playwright-Smoke-Test, Dev-Ad-Simulator.
*Abnahme:* Eine Platzhalter-3D-Szene läuft in der Matrix ohne Fehler, `game_ready` kommt zum richtigen Zeitpunkt, das QA Tool öffnet das Spiel, `check-build` ist grün.

**Phase 1 – Vertical Slice**
Akademie mit Bäckerei, Mission Control und Vault Workshop. Kadetten mit Aufzug, Training, Einsammeln, Upgrades, Ausbilder, Absolvent zu Agent. Save/Load und Offline-Erträge. Safe Cracker komplett. Missions-Flow (Briefing → Spiel → Ergebnis). Interstitial `mission_end`, Rewarded `mission_double` und `mission_revive`. FTUE bis Minute 3. Erste Version von `npm run sim`.
*Abnahme:* 5 Minuten flüssig spielbar auf Desktop und Handy, die Pacing-Ziele bis 3:00 laut Simulation erreicht.

**Phase 2 – Alle Minispiele + Region 1**
Laser Hall, Code Breaker, Spot the Mole, Scooter Pursuit und Circuit Hack mit je 10 Schwierigkeitsstufen, Sternen, Tutorial-Geisterhand und Agentenboni. Weltkarte mit Harbor Bay (10 Missionen + Boss Captain Clawford). Vault Bonus.
*Abnahme:* Jedes Minispiel ist in jeder Stufe lösbar, Draw Calls und FPS im Budget, alle Ad-Hooks der Minispiele funktionieren.

**Phase 3 – Progression & Inhalt**
Alle 9 Räume plus Baustellen-Teaser, Akademie-Level 1–30, Agenten mit Seltenheit und Roster, Gadget Lab, alle 5 Regionen mit Bossen, Field Ops, Villain Alerts, Endless Ops, Prestige mit 5 Tarnläden. Ökonomie mit der Simulation auf die Pacing-Tabelle justiert.
*Abnahme:* Die Simulation trifft die Pacing-Tabelle (±20 %), erstes Prestige nach 40–60 Min, kein Soft-Lock ohne Ads.

**Phase 4 – Monetarisierung komplett**
Alle 7 Interstitial-Punkte und alle 14 Rewarded-Platzierungen, Versorgungsdrohne, Income Boost, Missing Cash, VIP Recruit, Banner, wo unterstützt. Ausblenden bei fehlender Unterstützung, Fehlerfälle.
*Abnahme:* Ad-Tests grün. Eine Testsession von 15 Min zeigt mindestens 5 sinnvolle Rewarded-Angebote und mindestens 8 Interstitial-Aufrufpunkte.

**Phase 5 – Retention & Meta**
Daily Rewards, Daily Contracts, Achievements, „Director's Orders"-Leiste über das ganze Spiel, Leaderboard, wo verfügbar, Welcome-back-Flow.
*Abnahme:* Ein zweiter Tag (per `timeWarp`) bietet sichtbar neue Ziele und Belohnungen.

**Phase 6 – Polish & Release-Kandidat**
Finale Assets und Audio, Juice, alle 7 Sprachen, Performance-Optimierung und Quality Tiers, `performance_sample` und Events, komplette Screenshot-Matrix, Requirements- und Self-Check mit Nummern. Archiv bauen und über das MCP als Entwurf hochladen, Build-Check lesen und Fehler beheben, QA-Link an Anton.
*Abnahme:* `check-build` grün, Initial Download < 5 MB, Bericht mit jeder Requirement-Nummer (geprüft oder nicht prüfbar).

**Phase 7 (optional) – In-App-Käufe**
Remove Ads, Starter Pack, Gold-Badge-Pakete nach Abschnitt 7.4. Produkte erst nach Antons OK anlegen.

---

## 16. Assets, die Anton vor Phase 1 in `assets-src/` legt

Lizenz muss kommerzielle Nutzung erlauben (CC0 ideal). Lizenzen in `assets-src/LICENSES.md` notieren.

| Ordner | Inhalt | Mögliche Quellen |
|---|---|---|
| `models/characters` | geriggte Low-Poly-Figuren mit Idle/Walk/Cheer, kombinierbare Accessoires (Hüte, Brillen, Mäntel, Masken) | Kenney Character-Packs, Quaternius (CC0) |
| `models/interior` | Möbel, Technik, Laborgeräte, Tresor, Bildschirme | Kenney Furniture Kit u. ä. |
| `models/city` | Straßen, Fassaden, Fahrzeuge, Roller, Hindernisse | Kenney City Kit, Car Kit |
| `ui` | Icon-Set, eventuell Panel-Texturen | Kenney Game Icons, Input Prompts (Steuerungs-Hinweise) |
| `audio/sfx` | siehe Abschnitt 9 | Kenney Interface Sounds, UI Audio, Impact Sounds, Sci-Fi Sounds |
| `audio/music` | 3 Loops + Jingles | Kenney Music Jingles (Jingles), lizenzierte Spy-/Lounge-Loops |
| `fonts` | Display- und Text-Font mit Kyrillisch | Google Fonts (OFL), lokal |

Das Logo „Spy Lab" und das Cover für Playgama gestaltet Anton bzw. er gibt sie separat frei. Ein Spiel komplett aus generierten Assets wird abgelehnt (4.3).

---

## 17. Definition of Done vor jedem Upload

- [ ] Alle Bridge-Pflichtschritte 1–8 erfüllt (3.1)
- [ ] Interstitials nur an natürlichen Pausen, keine eigenen Timer (2.1.2, 2.1.3)
- [ ] Rewarded: Opt-in, ablehnbar, Belohnung nur bei `rewarded`, Revive max. 1×/Versuch, ausgeblendet ohne Support (2.2)
- [ ] Ads pausieren Spiel und Ton, ein Ad-Fehler blockiert nichts (2.1.6, 2.1.7)
- [ ] Speichern nur über Bridge Storage, übersteht Reload, Rotation und Ad (3.2)
- [ ] Musik und SFX aus echten Dateien, Mute-Button, kein Ton im Hintergrund, Plattform-Mute bleibt nach Reload (3.3)
- [ ] EN Default, alle Sprachen vollständig, Sprache aus der Bridge (3.4)
- [ ] Titel „Spy Lab" identisch mit dem Publikationsantrag (3.5.1)
- [ ] Layout in der ganzen Matrix inkl. 1:1 ohne Abschneiden oder Überlappen, kein Seiten-Scroll, jedes Popup mit X (1.6)
- [ ] Touch und Maus/Tastatur vollständig, keine Esc-Taste, Long-Press ohne Markierung oder Menü (1.4, 1.5)
- [ ] Keine externen Requests oder Analytics, keine externen Links (1.2)
- [ ] Dateinamen ASCII-sicher, ≤ 8000 Dateien, Bundle ≤ 30 MB, Initial Download < 5 MB (3.3, 12)
- [ ] Keine Fehler oder Freezes in Chrome, Firefox, Safari und Edge, Desktop und Mobile (1.7)
- [ ] Self-Check über das MCP neu gelesen und Punkt für Punkt gemeldet
