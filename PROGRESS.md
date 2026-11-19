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
