# Spy Lab – harte Regeln (gelten in jeder Session)

Volle Spezifikation: `docs/SPY_LAB_BRIEF.md`, **überschrieben durch `docs/DESIGN_DECISIONS.md`**. Fortschritt: `PROGRESS.md`.
Live-Doku (Playgama-MCP) schlägt den Brief; Widersprüche melden.

## Arbeitsweise
- Phase für Phase (Brief §15). Nach jeder Phase: Tests, Screenshots, PROGRESS.md, Zahlen, **anhalten**.
- Drafts: vor jedem Upload `version` in package.json erhöhen (0.x.y: Fix = y+1, größere Änderung = x+1), Archivname = `spy-lab-<version>`; Version in PROGRESS.md notieren.
- **Testen vorerst nur über GitHub Pages** (Workflow `.github/workflows/pages.yml`). Kein Playgama-Upload, bis Anton es sagt.
- Nie ohne Antons ausdrückliches Ja: `publish_sandbox`, `start_sandbox_traffic`, `send_playgama_catalog_update`, `replace_in_app_products`, Archiv-Uploads.
- Fragen nur bei Produktentscheidungen; Technik selbst entscheiden und begründen.
- Balancing/Ads/Pacing/Layout-Werte nur in `src/config/*.ts`.
- Assets nur aus `assets-src/`; fehlt etwas: markierter Platzhalter + im Bericht melden.

## Verboten
- Sound/Musik im Code synthetisieren (3.3.2) · Emoji als Icons (4.3.2)
- `localStorage`/`sessionStorage`/IndexedDB/Cookies (3.2.1) – nur `bridge.storage`
- Eigene Timer/Zähler für Interstitials · externe Requests/CDNs/Analytics (1.2.4/1.2.5)
- Esc-Taste (1.5.2) · Waffen, Blut, Gewalt, reale Länder/Marken/Franchises (4.x)

## Bridge-Pflichtschritte (Moderation prüft)
1. `public/playgama-bridge-config.json` neben `index.html`; Placements = `src/config/ads.ts` (check-build prüft).
2. Bridge-Script erstes `<head>`-Script, synchron (Vite-Plugin `mode: 'local'`, weil YouTube externe Calls blockt). `await bridge.initialize()` vor Three.js/Assets/Spiellogik: `main.ts` importiert nichts davon statisch, das Spiel kommt per `import('./game/boot')`.
3. Sprache einmal aus `bridge.platform.language` (oder expliziter Spielerwahl), EN Default/Fallback.
4. Speichern nur `src/core/save.ts`: Start = EIN `storage.get` aller Keys; Schreiben gebündelt, ≥10 s Abstand, sofort bei Pause/hidden.
5. Pause/Audio zentral in `src/core/lifecycle.ts` (Bridge-Events, Ads, visibility). Start: `isAudioEnabled`, `interstitialState === 'opened'`.
6. `game_ready` erst nach erstem gerenderten Frame, Loader entfernt, Input aktiv.
7. Interstitials über `src/platform/ads.ts` an jeder natürlichen Pause, nie im Gameplay/Tutorial.
8. Ausblenden bei fehlender Unterstützung (Rewarded, Shop/payments, Leaderboard, Sign-in, externe Links).
- Rewarded: Belohnung nur bei State `rewarded`; Revive max. 1× pro Versuch. Käufe: `getPurchases()` bei jedem Start, Consumables konsumieren.
- `window.bridge` nur in `src/platform/bridge.ts`.

## Layout & Steuerung
- Jede Größe/Orientierung inkl. 1:1, nichts abgeschnitten/überlappend, kein Seiten-Scroll, jedes Popup mit X, Touch-Ziele ≥ 44 px.
- Vollständig Touch UND Maus/Tastatur. Long-Press: keine Auswahl, kein Kontextmenü.

## Budget
Initial Download < 5 MB · Bundle < 25 MB · erster Frame < 5 s · 60 fps gedeckelt · Akademie < 150 Draw Calls, Minispiele < 100 · < 400 MB RAM.

## Befehle
`npm run dev` · `npm run build` · `npm run check-build` · `npm run package` · `npm test` (Playwright, `--trace off`) · `npm run assets`
Debug: `?debug=1` → `window.__spylab` + Dev-Ad-Simulator (`&adsim=off|unsupported`).
