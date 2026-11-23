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

## Phase 2 · Minispiel 3: Code Breaker — 2026-11-19
- 4-stelliger Symbolcode (Form+Farbe, 5–7 Symbole), Wordle-Wertung pro Zeile (grün = richtig an der Stelle, gelb = kommt vor, grau = nicht drin), 3D-Tafel mit Umklapp-Animation.
- Eingabe: Bildschirm-Tastatur (Touch/Maus), Tasten 1–9, Rücktaste, Enter/Leertaste. Tipp: 1× gratis, danach per Werbung (deckt eine Stelle auf). Revive 1×: +2 Versuche.
- Stufen 1–4 ohne Zeitlimit, ab 5: 90 → 65 s; ab Stufe 4 doppelte Symbole möglich. Missionen 4 und 8 spielbar.
- Test: Mission 4 komplett per Touch + Tastatur + Tipp; ein konsequenter Spieler (Solver) knackt ≥ 9/10 Stufen (Stufe 10 mit 6 Versuchen/7 Symbolen/Duplikaten gelegentlich nicht – gewollt hart).

## Fixes nach Antons Screenshots — 2026-11-19
- Boden-Flimmern (Streifen in Hafenräumen, Gras auf dem Inselweg): zwei Böden lagen exakt auf gleicher Höhe (Kai-Boden unter den Hafenräumen, Gras unter dem Weg). Kai, Gras und Plot-Kanten liegen jetzt tiefer.
- „Schwebendes Ding": Die Kranlast schwenkte über Straße und Räume; der Kran schwenkt jetzt nur noch über dem Wasser.
- „Explosionen im Hintergrund": Stempel-Sound bei jedem Check-in auch durch die Empfangskraft + Abschluss-Jingle bei jedem Absolventen. Jetzt: Stempel nur, wenn du selbst eincheckst (leiser), Jingle nur bei seltenen+ Absolventen.
- Stationen zeigen jetzt ihre Aufgabe: Cipher = Chiffrierrad am Schreibtisch, Disguise = Schminkspiegel mit Glühbirnen + Perückenkopf, Gadget = Werkbank mit Drohne, Driving = Fahrsimulator (Bildschirm, Lenkrad, Pedale), Hack = Terminal mit zwei Monitoren + Tastatur.
- Pad-Labels überlappten (Einstellen/Upgrade): Einstell-Feld mittig zwischen Kiste und Upgrade-Schreibtisch, Upgrade-Label auf gleicher Höhe wie die anderen.

## Phase 2 · Minispiel 4: Spot the Mole — 2026-11-19
- Bahnhofshalle (Fenster, Abfahrtstafel, Uhr, Bänke) mit 14–36 Reisenden (Kenney-Figuren, Jackenfarbe per Tönung) und kombinierbaren Accessoires: Hut in 5 Farben, Brille, Aktenkoffer – je eine InstancedMesh, an Kopf-/Hand-Knochen geheftet (≤ 76 Draw Calls).
- Hinweise erscheinen nacheinander als Chips oben (Symbol + Farbe + Text, 7 Sprachen); der nächste füllt sich sichtbar. Antippen des Maulwurfs = Sieg; falscher Tipp −5 s. Tipp (1× gratis, dann Werbung): die Hälfte der Falschen verlässt die Halle. Revive +15 s. Geisterhand beim ersten Mal, sobald alle Hinweise da sind.
- Stufen: Reisende, Hinweisanzahl 2→4, längere Abstände, Tempo, Ähnlichkeit (Doppelgänger); Charm-Skill verkürzt die Abstände (max −35 %). Erzeugung garantiert: genau eine Person passt auf alle Hinweise.
- Missionen 7 und 10 spielbar. Tests: Mission 7 komplett (falscher Tipp, Tipp-Knopf, Maulwurf); alle 10 Stufen lösbar.
- Code-Breaker-Löser im Test verbessert (Minimax statt „erste passende Kombination"): 10/10 Stufen.

## Phase 2 · Minispiel 5: Scooter Pursuit + Region Snowpeak — 2026-11-19
- Verfolgung auf 3 Spuren durch eine verschneite Straße (Kenney-Stadthäuser, Laternen, Schneewälle; 6 recycelte Segmente). Hindernisse: Fässer, Kisten, Mülltonnen, Autos (ab Stufe 4 wechseln Autos die Spur). Boost-Pads (×1,6 für 1,8 s), Intel-Chips (+1 Intel je Chip).
- Aufhol-Leiste (eigener Punkt → Dieb mit Katzenohren) füllt sich, solange du schneller bist als der Dieb; Crash = Stillstand + Anfahren; 3 Crashes = Alarm. Sterne: 0 Crashes = 3, 1 = 2.
- Steuerung: Pfeile/A-D, Wischen, Bildschirmhälfte antippen oder große Pfeil-Knöpfe. Geisterhand beim ersten Mal zeigt die Ausweichrichtung. Agility-Skill: bis +15 % Tempo. Revive: Crashes −1, +12 s.
- Neue Region **Snowpeak** (10 Missionen: Scooter ×4, Circuit ×2, Safe, Laser, Code, Mole; Belohnungen wachsen weiter), Reiter im Missions-Ordner; freigeschaltet nach Harbor Bay. Circuit Hack folgt.
- Tests: Snowpeak 1 komplett (Knöpfe, Tasten); alle 10 Stufen vom Planer ohne Fail gewonnen.

## Phase 2 · Minispiel 6: Circuit Hack — 2026-11-19
- Leitungs-Puzzle 4×4 bis 7×7: Brett als zufälliger Spannbaum über alle Felder erzeugt (immer lösbar), Terminals auf Blättern, alles verdreht. Antippen dreht ein Feld um 90°; Tastatur: Pfeile bewegen einen Cursor, Leertaste/Enter dreht. Strom fließt sichtbar (hellblau), Terminals werden grün, Glühbirnen oben zählen mit.
- Tipp (1× gratis, dann Werbung): 3 Felder auf dem Weg zu einem dunklen Terminal rasten ein. Revive +20 s. Tech-Skill: bis +15 s. Geisterhand beim ersten Mal zeigt die nächsten Felder.
- Instanzierte Felder/Leitungen: ~15 Draw Calls auch bei 7×7.
- Snowpeak 5 und 9 spielbar → **alle 6 Minispiele fertig**. Tests: Mission komplett (Tastatur, Tipp, Klicks); alle 10 Stufen gelöst.

## Phase 2 · Bosse + Vault Bonus — 2026-11-19
- **Captain Clawford** (Harbor Bay, nach Mission 10) und **Lady Snowpaw** (Snowpeak): 3 Minispiele hintereinander (Harbor: Safe → Laser → Code; Snowpeak: Scooter → Circuit → Mole), Etappen-Leiste unten, Stempel „Etappe geschafft!" zwischen den Stufen, Boss-Musik. Fehlschlag: Revive (1× pro Versuch) oder Neustart ab Etappe 1.
- Danach Cutscene: Boss (Katzenohr-Maske + Kapitänsmütze bzw. Bommelmütze) im Schaum mit Seilnetz, Geldregen, Kamerafahrt, Stempel „GEFASST"; Ergebnis mit Sternen (schwächste Etappe), 3× Cash, 2× Intel, **5 Gold Badges** beim ersten Sieg; Interstitial `boss_end`. Die nächste Region öffnet sich erst nach dem Boss.
- Abweichung vom Brief: keine gemeinsame Alarm-Leiste über alle Etappen (jedes Minispiel hat seine eigene Fehlergrenze); die Etappen-Leiste zeigt den Fortschritt.
- **Vault Bonus**: nach jedem Bosssieg und jedem Akademie-Level-up (ab Level 3, nach dem Tutorial) bietet ein Popup einen Gratis-Tresor an; jeder Bolzen bringt Beute (35 % der Belohnung der nächsten Mission), Zähler oben. Bei Alarm: Extraversuch per Rewarded `vault_retry` (1× pro Runde), sonst Beute einsammeln.
- Tests: Boss komplett (Etappen, Neustart, Cutscene, Badges, boss_end, Snowpeak offen) inkl. Vault Bonus mit Extraversuch.

## Phase 3 · Inhalt & Progression — 2026-11-20
- **Regionen 3–5**: Dune Oasis, Neon City, Sky Station mit je 10 Missionen (Stufen 4–10) und Boss (Sandy Sphinx, Neo Tom, Baron Velvet); 55 Missionen gesamt. Region-Look als Palettentausch: Hintergrund jeder Szene; die Scooter-Straße hat pro Region eigene Gehwege/Himmel (Schnee, Sandverwehungen, Neonleisten bei Nacht, Wolken).
- **Gadget Lab** (Hafen-Bootshaus): Werkbank-Feld öffnet das Labor; 6 Gadgets für Intel + Echtzeit (60–105 s), einer zur Zeit, mit 1 Gold Badge sofort fertig. Briefing-Slot: eigenes Gadget einsetzen oder per Rewarded `gadget_trial` gratis testen. Effekte: Stethoskop (+15 % Sweet Spot), Spiegelschild (fängt 1 Lasertreffer), Decoder (1 Symbol zu Beginn), Gesichtsscanner (3 Falsche gehen), Turbo-Kit (Start-Boost), Auto-Spleißer (2 Felder vorgelöst).
- **Field Ops** (ab Level 4, Missions-Ordner): wartende Absolventen auf 5/15/60-Min-Einsätze schicken (3 Plätze) → Cash (3/7/20× Verkaufsgebühr) + Intel; Rewarded `fieldop_finish` = sofort fertig.
- **Villain Alerts**: alle 5–8 Min aktiver Spielzeit eine rote Alarm-Mission (3 Min, eine Stufe über deiner besten), roter Puls-Knopf mit Countdown, Sieg = 1,5× Cash + 2 Gold Badges.
- **Endless Ops** nach dem Snowpeak-Boss: eigener Reiter, prozedurale Einsätze (Minispiel-Rotation, Stufe 4 → 10, Belohnung +18 % je Einsatz).
- **Prestige „HQ umziehen"** ab Level 15: Vermächtnis-Medaillen = √(Lebens-Cash / 250 k), je +10 % Einkommen; Cash, Räume, Areale, Level zurück; Agenten, Missionen/Sterne, Gadgets, Badges, Intel bleiben. Neuer Tarnladen-Look (Bäckerei → Eisdiele → Blumenladen → Spielzeugladen → Leuchtturm: Boden, Wände, Markise). Interstitial `prestige`.
- **Baustelle „Demnächst"** gegenüber dem Laden (Bauzaun, Turmkran, Hütchen, Schild).
- **Balancing (Sim)**: Empfangskraft 240 → 100, XP-Stufe 16 → 9. Ergebnis fokussiert: erste Automatisierung 2:46 (Ziel 3:20), längste Durststrecke 54 s (≤ 60), Level 10 bei 25:42 (Ziel 25:00), Level 15 / erster Umzug bei 45:28 (Ziel 40–60 Min); abgelenkt 57:36. Offen: Durststrecke beim abgelenkten Profil 95 s (Ziel 85).
- Bugfix nebenbei: `areas`, `areaPaid` und der Büro-Angestellte wurden nicht gespeichert (gingen beim Neuladen verloren).

## Phase 4 · Monetarisierung — 2026-11-20
- Alle 7 Interstitial-Punkte verdrahtet (neu: `map_close` beim Schließen der Karte, `panel_close` bei Agenten/Gadget-Labor/Field Ops, `prestige`).
- Alle 14 Rewarded-Platzierungen: neu `mission_skip` (nach 2 Fehlschlägen: Sieg mit 1 Stern), `offline_double` (Willkommen-zurück ×2), `income_boost` (HUD-Knopf, ×2 Einkommen je 5 Min, stapelbar bis 30 Min, Restzeit sichtbar), `supply_drop` (Drohne alle ~3 Min aktiver Zeit über dem Helden, erste Kiste gratis, sonst Ad; Cash/Badge/Gadget; fliegt nach 20 s weiter), `missing_cash` (Upgrade, wenn ≤ 25 % fehlen, max. alle 2 Min), `vip_recruit` (gelegentlich ein Wunderkind vor dem Laden → seltener+ Absolvent), `daily_double`, `free_badges` (Abklingzeit 10 Min).
- Abweichung: `free_badges` sitzt im Täglich-Ordner, weil es (ohne In-App-Käufe, Phase 7) noch keinen Shop gibt. Banner: nicht umgesetzt (Playgama/YouTube unterstützen keine).
- Extra-Knöpfe (Boost, Umzug, Alarm, Drohne, VIP, Täglich) stehen als Spalte über der Aktionsleiste.

## Phase 5 · Retention — 2026-11-20
- **Täglich-Ordner**: 7-Tage-Belohnungen (Streak, verpasster Tag setzt zurück, ×2 per Ad), 3 Tagesaufträge ab Level 4 (deterministisch pro UTC-Tag, Fortschritt ab Tagesbeginn, Gold Badges), 13 Erfolge (Missionen, Sterne, Absolventen, Upgrades, Millionär, Bosse, Umzug). Roter Punkt am Knopf, wenn etwas abholbar ist; Popup an neuen Tagen.
- Technikentscheidung: eigene Umsetzung über `bridge.storage` statt der Bridge-Module `dailyRewards`/`tasks` – läuft auf jeder Plattform und im Mock gleich und braucht keine Konsolen-Konfiguration. Leaderboard nicht umgesetzt (bräuchte ein in der Playgama-Konsole angelegtes Leaderboard → Antons OK).

## Bestenliste „Legacy Medals" — 2026-11-20
- Auf Antons OK in der Playgama-Konsole angelegt: `legacy_medals` (numerisch, absteigend). Bridge-Config: `leaderboards: [{ id: legacy_medals, isMain: true }]` + `saas` (Public Token, Plattformen playgama + qa_tool), denn Playgama selbst hat keine native Bestenliste – über Bridge SaaS läuft sie dort als `in_game`.
- Spiel: Punktzahl = Vermächtnis-Medaillen, gesendet beim Start (falls > 0) und nach jedem Umzug. `in_game` → eigene Liste (Top 20) über den Knopf im Täglich-Ordner; `native_popup` → Plattform-Overlay; `native` (YouTube) → nur Punktzahl; `not_available` → Knopf ausgeblendet (lokaler Mock).
- Fixes: Tagesaufträge-Zufallsgenerator lief ab Level 4 in eine Endlosschleife (Spiel fror ein) → 32-Bit-Generator mit Obergrenze; HUD-Extraknöpfe aktualisierten sich nur bei offenem Ordner → eigener HUD-Takt; VIP verschwand sofort; Täglich-Popup kommt jetzt nach dem Willkommen-zurück-Popup.
- Tests (ohne Größen-Matrix): alle grün inkl. neuer Tests für Gadget-Labor, Field Ops, Alarm/Endlos, Umzug, Angebote, Täglich, Boss + Vault Bonus. `check-build` OK, Start-Download 2,89 MB.

## Spot the Mole leichter & klarer (Antons Feedback) — 2026-11-20
- Nur noch positive Hinweise: Der Maulwurf trägt immer Hut, Brille, Aktenkoffer und eine Jackenfarbe; die Hinweise nennen davon 2–4 („Gelber Hut", „Weiße Jacke", „Aktenkoffer") – kein „Kein Hut" mehr.
- Größere Hüte, Brillen und Koffer. Weniger Reisende (10 → 28 statt 14 → 36) und weniger Doppelgänger (Ähnlichkeit 0,1 → 0,45), schnellere Hinweise.
- Falsch angetippte Verdächtige verlassen die Halle (−5 s bleibt), damit sie nicht erneut verwirren.

## Tempo-Prüfung neuer Spieler (Antons Auftrag: erste 5 Min ohne Warten) — 2026-11-20
**Messung, zwei Wege:**
1. `npm run sim`: Bot mit echter Spiellogik + Laufwegen, 10 Seeds, fokussiert und abgelenkt (70 %). Neu gemessen pro Zeitfenster: längste Lücke zwischen Fortschritten (Kauf, Upgrade, Missionssieg; Spielzeit in Missionen zählt als aktiv) und längstes echtes Warten (nichts zu tun).
2. `tests/pace.spec.ts`: Playwright spielt das **echte Spiel** 5 Minuten wie ein neuer Spieler – folgt nur dem Leitpfeil (Tutorial, danach „nächster sinnvoller Schritt"), wartet die echte Laufzeit (Distanz × 1,25 / 6,5 m/s), beantwortet alle Popups, spielt Missionen. Grenzwerte: Warten ≤ 10 s, Lücke ≤ 25 s, ≥ 25 Fortschritte.

**Gefundene und behobene Probleme (im echten Spiel):**
- Tutorial blieb bei „zweite Station bauen" hängen: Pfeil zeigte auf das Feld, Geld fehlte, Kits leer → Spieler wartete ewig. Jetzt: Kaufschritte, die noch nicht bezahlbar sind, zeigen bis dahin auf Geldstapel/Kits/Anmeldung.
- Schritt „Warte auf den ersten Absolventen" hatte keinen Pfeil, während die Kadetten ohne Kits standen (Sackgasse) → zeigt jetzt die nächste Pflicht.
- Nach dem Tutorial zeigte der Pfeil nur auf den nächsten Raum (meist nichts) → jetzt immer der nächste sinnvolle Schritt: bezahlbarer Kauf → Geldstapel, der den nächsten Kauf bezahlt → Kits → Anmeldung → bereite Mission.
- Nach einem Kauf musste man vom Feld heruntergehen, bevor das nächste Feld am selben Platz Geld nahm; der Pfeil war dabei ausgeblendet → Spieler stand ratlos. Jetzt beginnt das nächste Feld nach 1,5 s von selbst.
- Tuning Start: Vault-Einkommen 6 → 8, Zyklus 4 → 3 s, Upgrade 12 → 10, Station 15 → 12, Kadetten laufen 2,6 → 3,2 m/s, erster Absolvent nach 6 statt 8 Zyklen, Laser Gym 90 → 80. Sim-Missionsdauer realistisch 40 s (Safe Cracker Stufe 1 hat max. 35 s).

**Ergebnis echtes Spiel (5 Min):** 53 Fortschritte (≈ alle 5,7 s), längstes Warten 0 s, längste Lücke 24 s (bei 0:28, während der erste Absolvent trainiert – der Spieler sammelt/liefert Kits).
**Ergebnis Sim (fokussiert / abgelenkt, Median):**

| Fenster | längste Lücke | längstes Warten |
|---|---|---|
| 0–5 Min | 13 s / 26 s | 7 s / 2 s |
| 5–10 Min | 15 s / 19 s | 0 / 0 |
| 10–15 Min | 16 s / 28 s | 0 / 0 |
| 15–25 Min | 19 s / 27 s | 0 / 0 |
| 25–60 Min | 19 s / 32 s | 0 / 0 |

Beat Sheet OK (Laser Gym 1:45, erste Automatisierung, Hafen 7:52), Level 10 bei 23:50, erster Umzug bei 43:56 (abgelenkt 55:40).

## Späte Räume günstiger + aufgeräumte Oberfläche — 2026-11-20
- Leuchtturm-Tor 250 k → 120 k, Fahrsimulator 450 k → 200 k, Hack Lab 4 M → 600 k. Sim (fokussiert): Leuchtturm 29:57 (Ziel 30), Fahrsimulator 32:37 (35), Hack Lab 43:19 (40); Tempo-Fenster unverändert grün, erster Umzug 45:11.
- Gesamt-Tempo (Sim 3 h, Median fokussiert/abgelenkt): längste Lücke ohne Kauf 0–5 Min 16/25 s, 5–10 Min 12/17 s, 10–60 Min 16–20/25–32 s, 1–3 h 19–20/29–32 s; echtes Warten nach Minute 5 immer 0 s.
- Aufgeräumt: große Ziel-Karte rechts oben entfernt (der Leitpfeil zeigt immer den nächsten Schritt); Feld-Beschriftungen nur noch im Umkreis von 9 m um den Helden (plus das Pfeilziel), weiter entfernte blenden aus; Preise/Schilder kleiner; Raum-Schreibtisch heißt „UPGRADE Lv n" statt „BÜRO" (Verwechslung mit dem Agentur-Büro); Coach-Zeile verschwindet zuverlässig nach dem Tutorial.

## Phase 6 · Release-Kandidat als Entwurf hochgeladen — 2026-11-20
- Auf Antons OK: Archiv `spy-lab-0.0.1-f66e65d` (4,5 MB) in die Playgama-Konsole hochgeladen (nur Entwurf, nichts veröffentlicht). Build-Check PASSED, Bridge SDK 2.4.3 gefunden.
- QA-Link: https://developer.playgama.com/qa-tool/cmwoq1fea1nelm30hpnkn9740
- Offen in der Konsole: Cover (quadratisch/hoch/quer), Zertifizierung im QA-Tool (Anton), Formular. Selbstprüfung: `docs/SELF_CHECK.md`.
- Leistung: 25–51 Draw Calls in der Akademie (Budget 150), ~87 MB JS-Heap, 60-fps-Deckel; Rundkanten-Kisten mit Dreiecks-Budget (−30 % Dreiecke).

## Entwürfe 0.0.2–0.5.1, Titel, Cover, kurzes Tutorial — 2026-11-22
- Titel jetzt **Spy Lab Academy Tycoon** (Spiel, Ladebildschirm, check-build, Formular). Cover (800×800, 1080×1920, 1920×1080) aus Antons Artwork mit Titel, in der Konsole; Trailer (39 s Gameplay) in der Konsole; Formulartexte gespeichert (Kategorie Management).
- Tutorial auf die erste Runde gekürzt (Cash, Anmeldetresen, Tresor, Kit-Kiste, Anmeldung, Kits); danach nur noch Leitpfeil-Hinweise (neu: Laptop im Büro, wenn der erste Absolvent wartet). Pfeil zeigt beim Sparen nur noch Aufgaben, Coach nennt das fehlende Cash. Tempo-Test: 32 Käufe in 5 Min, max. 2,4 s Warten.
- Rewarded-Ads pausieren und muten jetzt ab der Anfrage (nicht erst ab `opened`).
- Versionsschema: package.json-Version, Archiv `spy-lab-<version>`. Entwürfe: `spy-lab-0.0.2-006871b` (kompakte UI), `spy-lab-academy-tycoon-0.0.3-83c71b3` (Titel, kurzes Tutorial), `spy-lab-0.5.1` (Rewarded-Mute ab Anfrage), **`spy-lab-0.5.2`** (Mute dreifach: Automation weg + Ausgang getrennt + suspend). Im echten QA-Tool (Chrome) geprüft: während des Rewarded pausiert, Kontext suspended, Master 0.

## 0.6.0 — kein Interstitial um die erste Mission, Telemetrie ausgebaut — 2026-11-22
- Neue Spieler: kein Interstitial bis die erste Mission vorbei ist, auch nicht an ihrem Ende (`INTERSTITIAL_RULES.adFreeMissions` in `src/config/ads.ts`); ab der zweiten Mission gelten die normalen Pausenpunkte.
- `performance_sample` nur aus aktivem Spiel, kurzes Abschluss-Sample beim Verstecken (≥ 5 s), dazu Fehler-, Kontextverlust-, Asset-Fehler-, Speicher-, Szene-, Qualitäts-, Geräte- und Draw-Call-Felder. `rewarded_offer_shown` je Placement, `milestone_reached` (8 Stufen). Übersicht: `docs/TELEMETRY.md`.
- Entwurf **`spy-lab-0.6.0`** hochgeladen (nichts veröffentlicht). Tests: 70 grün (zwei Ad-Tests auf wiederkehrende Spieler umgestellt).

## 0.6.1–0.6.4 und Sandbox — 2026-11-22
- Interstitials nur noch nach echtem Spiel (mission_end, boss_end, level_up, prestige); Menü öffnen/schließen ist kein Werbepunkt. Hinweis: das QA-Tool schaltet den Mindestabstand der Bridge ab und zeigt jede Anfrage.
- Spot the Mole: falsche Verdächtige gehen durch Ausgangstüren statt ins Leere, Aktenkoffer sichtbar an der Hüfte, Kamera zeigt die ganze Halle; Leitpfeil im Minispiel ausgeblendet.
- Alle Tutorial-Hände und Hinweis-Texte in den Minispielen entfernt (auf Antons Wunsch); der Tipp-Knopf bleibt.
- Entwurf **`spy-lab-0.6.4`** hochgeladen und auf Antons Ja **in der Sandbox veröffentlicht**: https://playgama.ai/play/akwwyo3nrjgs7s

## 0.6.5 — Leitspur um Wände (erste Spielerdaten) — 2026-11-23
**Telemetrie (Sandbox-Traffic seit 22.11. 21:10 UTC, 24 neue Spieler, ohne QA-Tool):** Bargeld 24 → Anmeldetresen 20 → **erster Tresor 13** → Tutorial fertig 8 → erster Absolvent 7 → erste Mission gewonnen 1. 7 Spieler kauften den Tresen und bauten nie den Tresor, 4 davon spielten noch 3–6 Min weiter (Geld war da: 20 vs. 12). Weitere Befunde: 25 % der Sitzungen ohne ersten Frame; Interstitials bei echten Spielern ≈ 0 (erst nach der ersten Mission, die kaum jemand erreicht); 13 von 24 Sitzungen senkten die Qualität automatisch, Einzel-Hänger > 1 s, ein Speicher-Ausreißer bis 748 MB (< 30 Sitzungen, noch nicht belastbar).
**Ursache:** Der Leitpfeil zeigte in Luftlinie; nach dem Tresen liegt der Tresor hinter der Bäckerei-Rückwand. Wer dem Pfeil folgt, läuft gegen die Wand (Autopilot mit echter Kollision blieb sogar schon an der Vorderwand hängen).
**Fix:** Pfeil bleibt auf dem Ziel. Neu: gelbe Bodenpfeile (`GuideTrail`, 1 Draw Call) auf dem begehbaren Weg (Raster-A* über die Kollisionsboxen, `NavGrid`, ~0,06 ms je Planung, 5×/s), nur wenn das Ziel nicht in gerader Linie erreichbar ist. Werte in `GUIDE_TRAIL` (`src/config/layout.ts`).
**Tests:** neuer Test „nur Pfeil + Bodenspur folgen, echte Kollision, kein Teleport“ schafft das Tutorial; Test für Spur/Pfeil nach dem Tresen. Nach dem Release Trichter `tutorial_step` station/counter erneut vergleichen.
