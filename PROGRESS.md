# PROGRESS

## Phase 0 – Fundament ✅ (wartet auf Antons OK)

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
- Anton wünscht den Stil seines Spiels „Kickoff Academy": isometrische Draufsicht, spielbare Figur, Unlock-Felder mit Preis, Geldstapel einsammeln. Das ersetzt den Querschnitt (Brief §5.3). Wird vor Phase 1 geklärt.
