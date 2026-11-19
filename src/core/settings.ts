import { effect, signal } from '@preact/signals-core'
import { AUDIO_SETTINGS } from '../config/audio'
import type { LangCode } from '../config/i18n-langs'
import { userMuted } from './lifecycle'
import { read, write } from './save'
import { SAVE } from '../config/save'

export const musicVolume = signal<number>(AUDIO_SETTINGS.defaultMusicVolume)
export const sfxVolume = signal<number>(AUDIO_SETTINGS.defaultSfxVolume)
/** Explicit language choice from the settings menu; null = follow bridge.platform.language. */
export const languageChoice = signal<LangCode | null>(null)

const DEFAULTS = {
  muted: false,
  music: AUDIO_SETTINGS.defaultMusicVolume as number,
  sfx: AUDIO_SETTINGS.defaultSfxVolume as number,
  language: null as LangCode | null,
}

export function loadSettings(): void {
  const s = read(SAVE.keys.settings, DEFAULTS)
  userMuted.value = !!s.muted
  musicVolume.value = clamp01(s.music)
  sfxVolume.value = clamp01(s.sfx)
  languageChoice.value = s.language ?? null
  let first = true
  effect(() => {
    const data = {
      muted: userMuted.value,
      music: musicVolume.value,
      sfx: sfxVolume.value,
      language: languageChoice.value,
    }
    if (first) {
      first = false
      return
    }
    write(SAVE.keys.settings, data)
  })
}

function clamp01(n: unknown): number {
  const v = Number(n)
  return Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 1
}
