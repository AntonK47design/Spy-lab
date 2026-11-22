# Spy Lab Academy Tycoon – Telemetrie

Alles läuft über die Bridge (`bridge.analytics.send` in `src/analytics/telemetry.ts`, Plattform-Nachrichten in `src/platform/bridge.ts`). Keine eigenen Server, keine personenbezogenen Daten, nur begrenzte Werte.

## Von der Bridge/Plattform selbst erfasst (nicht doppelt senden)
Sitzungen, Spielzeit, Werbung (Interstitial/Rewarded: geladen, geöffnet, belohnt, geschlossen, fehlgeschlagen), `game_ready`, Ladezeit.

## Missionen (Plattform-Nachrichten)
| Nachricht | Daten |
|---|---|
| `level_started` / `level_completed` / `level_failed` | `world` = Region, `level` = Missions-ID |

## Produkt-Events
| Event | Daten | Frage |
|---|---|---|
| `tutorial_step`, `tutorial_completed` | `step` | Wo brechen Neue im Tutorial ab? |
| `milestone_reached` | `milestone_id`, `step_index` (1–8, je einmal pro Spieler) | Wie weit kommen Spieler nach dem Tutorial? |
| `minute_mark` | `minute` | Wie lange bleiben sie? |
| `rewarded_offer_shown` | `placement` | Wie oft wird ein Angebot gezeigt? (÷ Bridge-Rewarded = Annahmequote) |
| `room_unlocked`, `area_opened`, `academy_level_up`, `room_milestone`, `built`, `agent_graduated`, `boss_defeated`, `prestige`, `daily_claimed`, `info_tap`, `first_frame` | jeweils begrenzte IDs | Fortschritt und Wirtschaft |

Meilensteine (Reihenfolge): `first_graduate`, `first_agent_hired`, `first_mission_won`, `laser_gym_unlocked`, `first_kit_runner`, `harbor_opened`, `first_boss_defeated`, `lighthouse_opened`.

## Leistung: `performance_sample`
Ein Sample pro ~30 s aktivem, sichtbarem Spiel (ohne Laden, Pause-Menü, Werbung, verstecktem Tab); beim Verstecken/Verlassen ein kürzeres Sample, wenn ≥ 5 s gespielt wurden.

Pflichtfelder: `target_fps` (60), `window_ms`, `active_ms`, `frame_count`, `fps_avg`, `fps_p10`, `frame_time_p50_ms`, `frame_time_p95_ms`, `frame_time_p99_ms`, `frame_time_max_ms`, `frames_over_50ms` … `frames_over_1000ms`, `build_version`.

Zusätzlich: `long_task_count/total_ms/max_ms`, `js_error_count`, `unhandled_rejection_count`, `webgl_context_loss_count`, `asset_load_error_count`, `memory_used_mb` (nur Chrome, `memory_measurement_supported`), `scene` (`academy`, Minispiel-ID oder `boss`), `quality_tier`, `device_type`, `draw_calls_avg`.

## Auswertung
Erst mit echtem Traffic (≥ 30 Sitzungen mit Samples): `get_game_telemetry_analytics` → `get_game_telemetry_event_analytics` für `performance_sample` bzw. `milestone_reached`.
