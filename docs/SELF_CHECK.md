# Spy Lab – Self-Check gegen die Playgama Game Requirements

Stand: 2026-11-20, gelesen live über das Playgama-MCP (`get_game_checklist`, alle Seiten verfügbar).
Legende: ✅ geprüft (mit Beleg) · ➖ trifft nicht zu · ❓ hier nicht prüfbar (Begründung)

## 1 Technik

| Nr. | Status | Beleg |
|---|---|---|
| 1.1.1 | ✅ | Bridge-Script per Vite-Plugin `mode: 'local'`, aktuelle Version (check-build). |
| 1.1.2 | ✅ | Pflichtschritte siehe CLAUDE.md „Bridge-Pflichtschritte"; `tests/smoke.spec.ts` (Bridge zuerst, `game_ready` nach erstem Frame, < 5 s), `check-build`. |
| 1.2.1–1.2.3 | ➖/✅ | Kein Login, kein Sign-in. |
| 1.2.4 | ✅ | Nur Bridge-Analytics (`src/platform/bridge.ts`), `check-build`: keine externen URLs im JS. |
| 1.2.5 | ✅ | Alles im Archiv; Tests verbieten externe Requests außer der Bridge-API (`tests/helpers.ts` `watch`). Bestenliste läuft über Bridge SaaS (Playgama-Backend, kein eigenes). |
| 1.2.6 | ✅ | Keine externen Links im Spiel. |
| 1.2.7 | ✅ | Keine URL-Sperren. |
| 1.3.1 | ✅ | Bundle weit < 300 MB (Start-Download 2,89 MB). |
| 1.3.2 | ✅ | `index.html` im Root, nur lateinische Dateinamen (`npm run package`). |
| 1.3.3 | ✅ | JS-Heap ~87 MB mit allen Räumen offen (`__spylab.stats()`). |
| 1.4.1 | ✅ | Vollflächiges Canvas. |
| 1.4.2 | ➖ | Keine Texteingabe. |
| 1.4.3 | ✅ | Hoch- und Querformat unterstützt (Matrix 15 Größen). |
| 1.4.4 | ✅ | Joystick/Tippen/Wischen, alle Minispiele per Touch (Tests). |
| 1.4.5 | ✅ | `tests/smoke.spec.ts` „long press: no context menu, no text selection". |
| 1.4.6 | ✅ | Keine WebGL-/Engine-Warnung. |
| 1.5.1 | ✅ | WASD/Pfeile/Maus, Minispiele per Tastatur (Leertaste, 1–9, Pfeile). |
| 1.5.2 | ✅ | Esc wird ignoriert (`tests/smoke.spec.ts`). |
| 1.5.3 | ✅ | Beide Schemata aktiv. |
| 1.6.1–1.6.4 | ✅ | `tests/matrix.spec.ts` (15 Größen × 3 Sprachen: in Bildschirm, keine Überlappung, kein abgeschnittener Text, kein Seiten-Scroll) + `tests/screens.spec.ts` (Karte, Briefing, Täglich, Labor, Field Ops, Umzug, Büro, alle Minispiele). |
| 1.6.5 | ✅ | Jeder Ordner hat das X (`btn-close` in den Tests geprüft). |
| 1.6.6 | ✅ | Einhändig spielbar; Kamera folgt dem Helden (großes Spielfeld erlaubt). |
| 1.6.7 | ✅ | Mindestschrift 10 px (Matrix-Test). |
| 1.6.8 | ✅ | 640×640 in beiden Matrix-Tests. |
| 1.7.1 | ✅ | Alle Tests prüfen saubere Konsole; Pause/Hide/Ad-Tests (`tests/ads.spec.ts`). |
| 1.7.2 | ✅ | Jedes Minispiel in allen 10 Stufen lösbar (Tier-Tests), Boss/Region/Umzug-Flows getestet, Tempo-Test ohne Sackgassen (`tests/pace.spec.ts`). |
| 1.7.3 | ❓ | Hier nur Chromium. Firefox/Safari/Edge + iOS/Android bitte im Playgama-QA-Tool prüfen. |
| 1.8.1–1.8.2 | ➖ | Keine Videos. |

## 2 Werbung & Zahlungen

| Nr. | Status | Beleg |
|---|---|---|
| 2.1.1 | ✅ | Nur Bridge-Ads (`src/platform/ads.ts`). |
| 2.1.2 | ✅ | 7 Interstitial-Punkte (mission_end, boss_end, map_close, level_up, panel_close, pause_resume, prestige). |
| 2.1.3 | ✅ | Nur an natürlichen Pausen; nie in Minispiel/Tutorial (`blockInterstitials`), Test „pause in a mission: resume never shows an interstitial". |
| 2.1.4 | ✅ | Interstitials nur nach einem Tipp auf „Weiter"/Schließen, nicht unter dem Finger auf einem Ziel. |
| 2.1.5 | ✅ | Bridge regelt die Ausrichtung. |
| 2.1.6 | ✅ | Spiel + Ton pausieren zentral (`src/core/lifecycle.ts`), Test „rewarded: … paused + muted while open". |
| 2.1.7 | ✅ | Test „no ad support … nothing breaks", Fehler-Toast. |
| 2.2.1 | ✅ | Jeder Rewarded-Knopf trägt das eigene Ad-Symbol und nennt die Belohnung (z. B. „x2 Cash", „Kiste", „VIP-Rekrut", „Verdoppeln", „Extraversuch"). |
| 2.2.2 | ✅ | Immer ablehnbar (X/Weiter). |
| 2.2.3 | ✅ | Nur Boni (x2, Tipp, Revive, Skip, Boost, Kiste …). |
| 2.2.4 | ✅ | Revive max. 1× pro Versuch (Mission, Boss, Vault Bonus); Test „revive … once". |
| 2.2.5 | ✅ | Belohnung nur bei State `rewarded` (`tests/ads.spec.ts`). |
| 2.3.x | ➖ | Keine Banner (Playgama/YouTube unterstützen keine). |
| 2.4.x | ➖ | Keine In-App-Käufe (Phase 7, nur nach Antons OK). |
| 2.5.x | ✅ | Kein Echtgeld, kein Glücksspiel. |

## 3 Nutzererlebnis

| Nr. | Status | Beleg |
|---|---|---|
| 3.1.1–3.1.3 | ✅ | Fortschritt (Akademie, 55 Missionen, 5 Bosse, Umzug), steigende Stufen, Spionage-Setting, Tutorial mit Leitpfeil (`tests/tutorial.spec.ts`). |
| 3.2.1 | ✅ | Nur `bridge.storage` über `src/core/save.ts`; kein localStorage/Cookies (Code-Suche leer). |
| 3.2.2–3.2.3 | ✅ | `tests/save.spec.ts` (Reload, Rotation, Drosselung, Flush beim Verstecken), Tests für Gadgets/Umzug nach Reload. |
| 3.3.1 | ✅ | Musik (3 Loops + Jingles) und Effekte, alles Dateien. |
| 3.3.2 | ✅ | Kenney CC0 / OpenGameArt CC0 als mp3, nichts im Code erzeugt. |
| 3.3.3 | ✅ | Ton- und Musik-Schalter in den Einstellungen. |
| 3.3.4–3.3.5 | ✅ | `isAudioEnabled` beim Start, Bridge-Events, Sichtbarkeit (`tests/ads.spec.ts` „platform pause/mute"). |
| 3.4.1–3.4.3 | ✅ | EN Standard/Fallback; Sprache nur aus `bridge.platform.language` oder Spielerwahl; 7 Sprachen vollständig (Prüfskript: alle statischen und dynamischen Schlüssel vorhanden). |
| 3.4.4 | ✅ | Zahnrad → Globus, Sprachen in eigener Schreibweise. |
| 3.5.1 | ❓ | Titel im Spiel „Spy Lab Academy Tycoon" – muss im Veröffentlichungsantrag identisch sein. |

## 4 Inhalt

| Nr. | Status | Beleg |
|---|---|---|
| 4.1.x | ✅ | Keine Waffen/Gewalt (Gegner werden im Schaumnetz gefasst), keine Politik/Religion, keine realen Länder/Marken. |
| 4.2.1 | ❓ | Rechte: Kenney/OpenGameArt CC0 (siehe `assets-src/LICENSES.md`); Logo/Cover von Anton. |
| 4.2.2 | ✅ | Eigenes Spiel; teilt Ideen (Tycoon-Schleife) mit Kickoff Academy, aber andere Grafik, Setting und Minispiele. |
| 4.2.3–4.2.5 | ✅ | Keine fremden Marken/Figuren. |
| 4.3.1 | ✅ | Assets aus Kenney-Packs + eigene Modellierung, kein generiertes Bildmaterial. |
| 4.3.2 | ✅ | Eigenes SVG-Icon-Set, kein Emoji. |
| 4.4.1 | ➖ | Keine Nutzerdaten. |

## 5 Engine

| Nr. | Status | Beleg |
|---|---|---|
| 5.1.1 | ➖ | Kein Unity (three.js). |

## Offen / von Anton zu prüfen
- 1.7.3 andere Browser und echte Geräte (QA-Tool).
- 3.5.1 Titel im Antrag = „Spy Lab Academy Tycoon".
- 4.2.1 Rechte an Logo/Cover.
