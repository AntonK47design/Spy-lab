# PROGRESS

## Phase 0 – Fundament ✅ (abgenommen)

**Erledigt**
- Vite 8 + TypeScript strict + Three.js 0.187 + Preact 11/@preact/signals, Bridge 2.4.3 (npm, Vite-Plugin `mode: 'local'`).
- Bootstrap: Bridge-Script zuerst → `initialize()` → ein `storage.get` → dynamischer Import von Three/UI → erster Frame → Loader weg → `game_ready`.
- Zentraler Lifecycle (Pause/Audio/Ads/visibility/Context-Loss), Save-System (gebündelt, gedrosselt, Flush bei Pause/hidden), Zeitquelle mit Server-Zeit + Clamping.
- Ads-Wrapper (keine eigenen Interstitial-Timer, Flow-Flag nach Rewarded), Dev-Ad-Simulator.
- Renderer (DPR ≤ 2, ResizeObserver, Quality-Tiers mit Auto-Downgrade nach 10 s, Context-Loss), 60-fps-Cap, Loop stoppt bei Pause.
- Platzhalter-Akademie (Querschnitt, 6 Draw Calls), Kamera mit Drag/Pinch/Rad/Tasten.
- Preact-HUD (eigene SVG-Icons), Settings mit X/Mute/Reglern/Sprachwahl (Globus, 7 Sprachen in eigener Schrift), Pause per Button/P.
- i18n EN/DE/ES/PT/FR/RU/TR, Auto-Fit gegen Abschneiden.
- `performance_sample`-Adapter, Telemetrie-Adapter.
- Skripte: `assets` (gltf-transform prune/dedup/weld/quantize/meshopt, Audio→mp3, Platzhalter-Report), `build`, `check-build`, `package`.
- Playwright: Smoke, Save, Ads, Screenshot-Matrix (15 Größen × EN/DE/RU) – 59 Tests grün.
- GitHub-Pages-Deploy-Workflow.

**Zahlen (Phase 0)**: Bundle 1,05 MB · Initial Download 0,98 MB · game_ready ≈ 0,6 s lokal · 6 Draw Calls · ~2,7k Dreiecke · JS-Heap ~10 MB.

**Platzhalter (fehlende Assets)**: alle 22 Audiodateien (stille mp3), Fonts (System-Fonts), Modelle (Box-Szene).

## Offene Produktentscheidung
- ✅ Entschieden: siehe `docs/DESIGN_DECISIONS.md` (eine große Fläche, spielbare Figur wie Kickoff + Missionen an Mission Control).

## Phase 1 – Vertical Slice (neuer Stil) ✅ (wartet auf Antons OK)

**Erledigt**
- Begehbare Akademie als eine Fläche (Draufsicht, Stil wie Kickoff Academy): Bäckerei an der Straße, geheimer Korridor,
  Räume links/rechts, „Coming soon"-Baustelle hinten. Platzhalter-Modelle aus Grundformen (eine Vertex-Color-Material-Instanz).
- Spielbare Figur (Direktor): schwebender Joystick (Touch/Maus-Drag) + WASD/Pfeile, Kollisionen, Folgekamera („Expand"-Framing).
- Kadetten kommen von der Straße, laufen durch die Bäckerei zu ihren Stationen, trainieren in Zyklen, Geld stapelt sich,
  Absolvent → Agentenkarte (Seltenheit), Roster-Limit mit Bonus bei Überlauf.
- Unlock-Felder (Geld fließt beim Draufstehen hinein, Teilzahlung bleibt gespeichert), Upgrade-Pult je Raum
  (Level, Plätze, Tempo, Ausbilder = Auto-Einsammeln), Mission-Control-Feld.
- Safe Cracker komplett (10 Stufen in `config/minigames.ts`, Täusch-Zonen, Richtungswechsel, Agenten-Bonus, Geisterhand beim ersten Mal).
- Missions-Flow: Missionsliste → Briefing (Akte, Agent automatisch) → Minispiel → Ergebnis mit Sternen → x2 (erstes Mal gratis als Demo) → Continue.
  Fail-Screen: Revive (Rewarded, max. 1× pro Versuch), Neuer Versuch, Zurück.
- Ads: Interstitial `mission_end` (+ `pause_resume`, `level_up`), Rewarded `mission_double`, `mission_revive`.
  Kein Interstitial im Tutorial, im Minispiel oder direkt nach einem Rewarded im selben Flow.
- Plattform-Messages `level_started/completed/failed` mit `{world, level}`; Analytics-Events über einen Adapter.
- FTUE durch Spielen: Agent Marmalade (eine Zeile), 3D-Pfeil + Randpfeil: Einsammeln → Upgrade → Absolvent → Mission 1 → Laser Gym → Ausbilder. Kommt nach Reload nie wieder.
- Speichern (5 Keys, ein `get`), Offline-Erträge (50 %, max. 2 h; auch nach > 60 s verstecktem Tab), Zurückdrehen der Uhr bringt nichts.
- Akademie-Level mit XP-Leiste + Level-up-Popup, Director's-Orders-Karte nach dem Tutorial.
- `npm run sim`: Headless-Spieler ohne Ads. Pacing bis 3:00 erfüllt (siehe unten).
- Alle Texte in EN/DE/ES/PT/FR/RU/TR (122 Keys).

**Grafik (Update nach Antons Feedback „deutlich besser")**
- Echte CC0-Modelle von Quaternius (mit Antons OK heruntergeladen, Lizenzen in `assets-src/LICENSES.md`):
  animierte Figuren (Direktor im Anzug, Kadetten in Raumfarben, Ausbilder), Bäckerei mit Theke, Gebäck,
  Ofen, Kühlschrank und Café-Tischen, Labore mit Schreibtischen, Computern und Bücherregalen, Straße mit Laternen,
  Baustellen mit Zäunen, Warnschildern und Kisten.
- Pipeline: OBJ→glTF, Waffen-Teile entfernt, nur Idle/Walk/Run/Wave/Interact, eine Animationsbibliothek pro Skelett.
- Laufzeit: Requisiten pro Raum zu einem Mesh gebacken, jede Figur ein einziger Draw Call.
- Weiche Schatten (Shadow Map) auf mittlerer/hoher Stufe, Blob-Schatten auf niedriger Stufe.
- Noch Platzhalter: Audio (stille Dateien), Schrift (System-Font), Tresor/Laser-Stationen aus Grundformen.

**`npm run sim` (ohne Ads, 70 % Missionserfolg)**
| Ereignis | Ziel | Sim |
|---|---|---|
| Erstes Einsammeln | 0:05 | 0:05 |
| Erstes Upgrade | 0:15 | 0:17 |
| Erster Absolvent | 0:40 | 0:37 |
| Mission 1 | 0:45 | 0:38 |
| Laser Gym kaufbar | 1:30 | 1:35 |
| Ausbilder / Cipher / Level 3 | 4:00 / 5:00 / 6:30 | 2:34 / 3:06 / 2:50 (zu früh → Phase 3) |

**Bekannte Grenzen (Phase 1)**
- Missionen 2, 4, 5, 7, 8, 10 brauchen Minispiele aus Phase 2 („Coming soon"). Laser Gym ist kaufbar, sein Minispiel kommt in Phase 2.
- Pacing nach 3:00 ist absichtlich noch nicht justiert (Phase 3).
- Weltkarte ist vorerst eine Missionsliste (3D-Karte in Phase 2).

## Feedback-Runde (Straße, UI-Qualität, Bau-Animation) — 2026-11-19
- Straße vor der Bäckerei: Gehweg, Fahrbahn, Zebrastreifen, Taxi-Haltestelle; Kadetten kommen per Taxi und laufen durch die Eingangstür. Neue Spieler starten auf dem Gehweg (Tutorial beginnt draußen).
- Eingang als Fassade (Pfeiler, Schild, Markise, Glastüren). Bug behoben: der gebaute Anmeldetisch sperrte den Helden ein.
- UI-Qualität nach Kickoff-Referenz, eigene Palette: Fredoka/Nunito gebündelt (OFL), einheitliche Outline, harte Schatten, rollende Cash-Zahl, Ziel-Pille oben rechts, Bau-Felder mit gestricheltem Rand, Labels blenden unter dem HUD aus.
- Ziel-Zeiger: 3D-Pfeil über dem Ziel + Rand-Badge, wenn das Ziel außerhalb liegt (Tutorial, danach bezahlbare Raum-Freischaltung).
- Cash als Bündel mit Banderole. Kein Pause-Button in der Akademie (nur in Missionen).
- Stationen, Kisten und Anmeldetisch bauen sich mit Animation auf (Fall, Stauchen, Staub, Funken, ~0,9 s); Spielwerte unverändert.
- Tests: 30 Funktionstests + Layout-Matrix 45/45 grün. Debug: `fxSlow(k)`, `buildStation(room)`.

## Map 2.0 · Schritt 1: Innenhof (HQ) — 2026-11-19
Plan: https://claude.ai/artifact/3VK5u4uetgNAqxG6wv9qhA (Fähre, Dead Drops, Seilrutsche entschieden).
- Flur → 12 m breiter Innenhof hinter der Bäckerei. Mission Control ist kein Raum mehr, sondern das Wahrzeichen in der Hofmitte (Rundweg, Rasen, Holo-Kartentisch mit drehendem Hologramm, Konsolen, Satellitenschüssel).
- Laser Gym (links) und Vault (rechts) direkt hinter der Bäckerei; hintere Reihe: zwei Lounges, in der Mitte das Hafen-Tor.
- Geheimtür: Die Bäckerei-Rückwand ist ein Brotregal, das beim Bau des Anmeldetischs auseinanderfährt (für Rückkehrer offen). Küche in die linke Ecke verlegt.
- Werte unverändert. Sim: Beat Sheet erste 3 Min OK; Hafen 8:13 (Ziel 10:00); „Erste Automatisierung" 4:24 (Ziel 3:20, war schon vorher spät → Phase 3).
- Tests: 31/31 Funktionstests grün (inkl. echtem Laufweg durch die Regaltür). Draw Calls ~29.
- Nächster Schritt laut Plan: Hafen-Docks (Garagentor, Rampe, Kran).

## Map 2.0 · Schritt 2: Hafen-Docks — 2026-11-19
- Hafen liegt jetzt östlich des Innenhofs. Zugang: Garagenhalle (ehem. rechte Lounge) mit Rolltor = Hafen-Tor (3.000, Level 2); das Tor rollt beim Freischalten hoch.
- Docks: Hafenstraße mit Containerstapeln; Cipher im Schiffscontainer (rote Rippenwände), Disguise im Fischmarkt (Markise), Gadget im Bootshaus; Kai mit Pollern, Laternen, schwenkendem Kran, Booten; Wasser rundum.
- Leuchtturm vorübergehend direkt nördlich des Hofs (Brücke), Schritt 3 verlegt ihn auf die Insel mit Fähre.
- Bewusst weggelassen: die im Plan genannte Höhenstufe (1 m tiefer). Alle Figuren, Felder, Geldstapel und Labels sind auf Bodenhöhe 0 gebaut; das hätte jedes System berührt. Trennung stattdessen über Rolltor, Material (Beton/Holzkante) und Wasser.
- Sim: unverändert (Hafen 8:12). Tests: 31/31 (Gehtest jetzt durch die Vault-Tür und mittig durch die Gasse hinter dem Tresen).

## Map 2.0 · Schritt 3: Leuchtturm-Insel + Fähre — 2026-11-19
- Insel genau nördlich des Innenhofs (Achse Mission Control): Weg zum gestreiften Leuchtturm, Driving und Hack Lab links/rechts, Felsen, Büsche; drehender Lichtkegel (48 m) streicht über die Karte.
- Fähre (auf Antons Wunsch vom Hof aus, nicht vom Hafen): Steg an der Nordkante des Hofs hinter Mission Control; aufs Steg-Ende stellen → Boot legt nach 0,5 s ab, ~3 s Überfahrt, Held steht an Deck; zurück genauso. Vor dem Tor (250.000, Lv 4) liegt das Boot als Teaser vertäut. Kadetten fahren „an Bord“ mit (unsichtbar über dem Wasser).

## Agentur-Büro statt Absolventen-Popup — 2026-11-19
- Absolventen laufen ins Büro (linke Lounge des Hofs) und warten auf der Bank; kein Popup mehr (nur kurzer Hinweis bei selten+).
- Laptop auf dem Schreibtisch öffnet das Büro-Menü: pro Absolvent Verkaufen (+Gebühr) / Einstellen, bei vollem Team „Gegen Schwächsten tauschen“; „Alle verkaufen“.
- Auto-Schalter: bei vollem Team werden Absolventen, die nicht stärker als dein schwächster Agent sind, sofort verkauft (Stärke = Summe aller Skills).
- Tutorial-Schritt „hire“ am Laptop. Sim: Beat Sheet OK; „Nichts bezahlbar“ jetzt 66 s (Ziel 60) und Erste Automatisierung 4:45 (Ziel 3:20) → Phase-3-Balancing.

## Büro-Angestellter — 2026-11-19
- Kaufbares Feld im Büro (450, ab dem ersten Absolventen). Der Angestellte steht hinter dem Schreibtisch.
- Verkauft gewöhnliche Absolventen automatisch, sobald sie ~6 s im Büro warten; seltene und bessere warten weiter am Laptop.
- Leert alle 8 s die Geldstapel aller Räume (Pop-up „+Betrag" über jedem Raum).
- Bug behoben: Beim Umbau zum Laptop war der Text „EINSTELLEN" (pad.hire) für Laufbursche/Angestellte verloren gegangen; jetzt prüft ein Skript-Durchlauf, dass alle statischen Text-Keys in allen 7 Sprachen existieren.
- Tests: 32/32 (inkl. neuem Angestellten-Test). Sim: Beat Sheet OK; die Kennzahlen „Nichts bezahlbar" (66 s) und „Erste Automatisierung" (4:45) bleiben Phase-3-Themen.

## Phase 2 · Minispiel 2: Laser Hall — 2026-11-19
- Isometrischer Flur 5 Spalten × 12+ Reihen; Agent hüpft Feld für Feld zum Koffer. Hindernisse: feste Laser mit Lücken, Blink-Laser (Warn-Flackern), schwenkende Laser auf Schiene, Kameras mit wanderndem Lichtkegel (zu lange im Licht = Alarm). Intel-Chips optional (+2 Intel je Chip zur Belohnung).
- Steuerung: Pfeile/WASD, Tippen in Richtung, Wischen, großer Knopf/Leertaste = vorwärts. Treffer kostet ein Leben und setzt auf die letzte sichere Reihe zurück; Revive 1× (Werbung).
- 10 Stufen in `config/minigames.ts`; Stealth-Skill verkürzt die An-Phase der Blink-Laser. Abweichung vom Brief: ab Stufe 4 wird der Flur länger (bis 21 Reihen), damit vor jedem Hindernis eine sichere Reihe liegt – sonst wären hohe Stufen nicht fair lösbar. Stufe 10 leicht entschärft (Aus-Phase 0,63 s).
- Geisterhand beim ersten Mal zeigt den nächsten sicheren Zug (Planer). Test: alle 10 Stufen werden vom Planer ohne Treffer gelöst; Mission 2 komplett inkl. Tastatur.
- Missionen 2 und 5 (Harbor Bay) sind jetzt spielbar.
