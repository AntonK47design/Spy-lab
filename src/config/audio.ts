/**
 * Audio manifest. Every id maps to public/assets/audio/<id>.mp3, produced by
 * `npm run assets` from assets-src/audio/{music,sfx}/<id>.(mp3|ogg|wav).
 * Missing sources become clearly marked silent placeholders (reported by the script).
 * `core` sounds are part of the initial download; the rest load after game_ready.
 */
export const AUDIO = {
  music: {
    music_academy: { core: true, volume: 0.55 },
    music_mission: { core: false, volume: 0.55 },
    music_boss: { core: false, volume: 0.6 },
    jingle_win: { core: false, volume: 0.8 },
    jingle_fail: { core: false, volume: 0.8 },
  },
  sfx: {
    ui_click: { core: true, volume: 0.7 },
    coin: { core: true, volume: 0.6 },
    upgrade: { core: true, volume: 0.7 },
    unlock: { core: false, volume: 0.8 },
    stamp: { core: false, volume: 0.8 },
    level_up: { core: false, volume: 0.8 },
    laser_hum: { core: false, volume: 0.4 },
    laser_zap: { core: false, volume: 0.7 },
    alarm: { core: false, volume: 0.6 },
    safe_tick: { core: true, volume: 0.6 },
    bolt_open: { core: true, volume: 0.8 },
    keypad_beep: { core: false, volume: 0.6 },
    scooter: { core: false, volume: 0.5 },
    whoosh: { core: false, volume: 0.6 },
    crowd_ambient: { core: false, volume: 0.35 },
    drone: { core: false, volume: 0.5 },
    crate_open: { core: false, volume: 0.8 },
  },
} as const

export type MusicId = keyof typeof AUDIO.music
export type SfxId = keyof typeof AUDIO.sfx
export type SoundId = MusicId | SfxId

export const AUDIO_SETTINGS = {
  defaultMusicVolume: 0.7,
  defaultSfxVolume: 0.9,
  fadeSeconds: 0.25,
} as const
