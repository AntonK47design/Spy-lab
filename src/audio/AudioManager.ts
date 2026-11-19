/**
 * Central audio. ONE master gain: open only while lifecycle.isAudible
 * (= !userMuted && platformAudioEnabled && !platformPaused && !adOpen && !pageHidden).
 * Sounds come exclusively from shipped audio files (never synthesized).
 */
import { effect } from '@preact/signals-core'
import { AUDIO, AUDIO_SETTINGS, type MusicId, type SfxId, type SoundId } from '../config/audio'
import { isAudible } from '../core/lifecycle'
import { musicVolume, sfxVolume } from '../core/settings'

type Ctx = AudioContext

class AudioManagerImpl {
  private ctx: Ctx | null = null
  private master!: GainNode
  private musicGain!: GainNode
  private sfxGain!: GainNode
  private buffers = new Map<SoundId, AudioBuffer>()
  private loading = new Map<SoundId, Promise<void>>()
  private music: { id: MusicId; src: AudioBufferSourceNode; gain: GainNode } | null = null
  private wantedMusic: MusicId | null = null
  private unlocked = false
  failed: string[] = []

  init(): void {
    const AC: typeof AudioContext | undefined =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AC) return
    this.ctx = new AC()
    this.master = this.ctx.createGain()
    this.musicGain = this.ctx.createGain()
    this.sfxGain = this.ctx.createGain()
    this.musicGain.connect(this.master)
    this.sfxGain.connect(this.master)
    this.master.connect(this.ctx.destination)
    this.master.gain.value = 0

    effect(() => this.applyMaster(isAudible.value))
    effect(() => this.ramp(this.musicGain, musicVolume.value))
    effect(() => this.ramp(this.sfxGain, sfxVolume.value))

    const unlock = () => {
      this.unlocked = true
      this.applyMaster(isAudible.value)
      window.removeEventListener('pointerdown', unlock, true)
      window.removeEventListener('keydown', unlock, true)
    }
    window.addEventListener('pointerdown', unlock, true)
    window.addEventListener('keydown', unlock, true)
  }

  get state(): { ctx: string; master: number; unlocked: boolean; music: string | null } {
    return {
      ctx: this.ctx?.state ?? 'none',
      master: this.ctx ? this.master.gain.value : 0,
      unlocked: this.unlocked,
      music: this.music?.id ?? null,
    }
  }

  private ramp(g: GainNode | undefined, v: number): void {
    if (!this.ctx || !g) return
    g.gain.setTargetAtTime(v, this.ctx.currentTime, 0.05)
  }

  private applyMaster(audible: boolean): void {
    const ctx = this.ctx
    if (!ctx) return
    if (audible && this.unlocked) {
      if (ctx.state !== 'running') void ctx.resume().catch(() => {})
      this.master.gain.cancelScheduledValues(ctx.currentTime)
      this.master.gain.setTargetAtTime(1, ctx.currentTime, AUDIO_SETTINGS.fadeSeconds / 3)
    } else {
      this.master.gain.cancelScheduledValues(ctx.currentTime)
      this.master.gain.value = 0
      // Suspending guarantees silence in background tabs and during ads.
      if (ctx.state === 'running') void ctx.suspend().catch(() => {})
    }
  }

  url(id: SoundId): string {
    return `assets/audio/${id}.mp3`
  }

  load(id: SoundId): Promise<void> {
    if (this.buffers.has(id)) return Promise.resolve()
    let p = this.loading.get(id)
    if (p) return p
    const ctx = this.ctx
    if (!ctx) return Promise.resolve()
    p = fetch(this.url(id))
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status))
        return r.arrayBuffer()
      })
      .then((ab) => ctx.decodeAudioData(ab))
      .then((buf) => {
        this.buffers.set(id, buf)
        if (this.wantedMusic === id) this.playMusic(id)
      })
      .catch(() => {
        this.failed.push(id)
      })
    this.loading.set(id, p)
    return p
  }

  coreIds(): SoundId[] {
    const ids: SoundId[] = []
    for (const [id, m] of Object.entries(AUDIO.music)) if (m.core) ids.push(id as MusicId)
    for (const [id, s] of Object.entries(AUDIO.sfx)) if (s.core) ids.push(id as SfxId)
    return ids
  }

  lazyIds(): SoundId[] {
    const core = new Set(this.coreIds())
    return [...Object.keys(AUDIO.music), ...Object.keys(AUDIO.sfx)].filter((id) => !core.has(id as SoundId)) as SoundId[]
  }

  play(id: SfxId, rate = 1): void {
    const ctx = this.ctx
    const buf = this.buffers.get(id)
    if (!ctx || !buf || !isAudible.value) return
    const src = ctx.createBufferSource()
    src.buffer = buf
    src.playbackRate.value = rate
    const g = ctx.createGain()
    g.gain.value = AUDIO.sfx[id].volume
    src.connect(g).connect(this.sfxGain)
    src.start()
  }

  playMusic(id: MusicId): void {
    this.wantedMusic = id
    const ctx = this.ctx
    if (!ctx) return
    if (this.music?.id === id) return
    const buf = this.buffers.get(id)
    if (!buf) {
      void this.load(id)
      return
    }
    this.stopMusic()
    const src = ctx.createBufferSource()
    src.buffer = buf
    src.loop = true
    const g = ctx.createGain()
    g.gain.value = AUDIO.music[id].volume
    src.connect(g).connect(this.musicGain)
    src.start()
    this.music = { id, src, gain: g }
  }

  stopMusic(): void {
    if (!this.music) return
    try {
      this.music.src.stop()
    } catch {
      /* already stopped */
    }
    this.music.src.disconnect()
    this.music = null
  }
}

export const AudioManager = new AudioManagerImpl()
