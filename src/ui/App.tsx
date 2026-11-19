import { signal } from '@preact/signals'
import { useEffect, useLayoutEffect } from 'preact/hooks'
import { scheduleFit } from './fit'
import { t, lang, setLanguage } from '../i18n/i18n'
import { LANGUAGES, type LangCode } from '../config/i18n-langs'
import { cash, intel, badges } from '../core/store'
import { contextLost, userMuted, userPaused } from '../core/lifecycle'
import { languageChoice, musicVolume, sfxVolume } from '../core/settings'
import { formatNumber } from '../core/format'
import { features } from '../platform/bridge'
import { showInterstitial } from '../platform/ads'
import { AudioManager } from '../audio/AudioManager'
import {
  IconAgent,
  IconBadge,
  IconCash,
  IconClose,
  IconGadget,
  IconGear,
  IconGlobe,
  IconIntel,
  IconMap,
  IconMusic,
  IconPause,
  IconPlay,
  IconShop,
  IconSoundOff,
  IconSoundOn,
} from './icons'

export type PanelId = 'settings' | 'pause' | null
export const openPanel = signal<PanelId>(null)
export const toast = signal<string | null>(null)
export const orderHint = signal<string>('placeholder.tapCash')

let toastTimer: ReturnType<typeof setTimeout> | null = null
export function showToast(key: string): void {
  toast.value = key
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => (toast.value = null), 2200)
}

function click(): void {
  AudioManager.play('ui_click')
}

export function openPause(): void {
  if (openPanel.value === 'pause') return
  openPanel.value = 'pause'
  userPaused.value = true
}

function closePanel(): void {
  const was = openPanel.value
  openPanel.value = null
  if (was === 'pause') {
    userPaused.value = false
    showInterstitial('pause_resume')
  }
}

function CurrencyPill(props: { icon: preact.JSX.Element; value: number; label: string; kind: string }) {
  return (
    <div class={`pill pill-${props.kind}`} aria-label={props.label} data-testid={`hud-${props.kind}`}>
      <span class="pill-icon">{props.icon}</span>
      <span class="pill-value">{formatNumber(props.value, lang.value)}</span>
    </div>
  )
}

function TopBar() {
  return (
    <header class="topbar">
      <div class="pills">
        <CurrencyPill kind="cash" icon={<IconCash />} value={cash.value} label={t('hud.cash')} />
        <CurrencyPill kind="intel" icon={<IconIntel />} value={intel.value} label={t('hud.intel')} />
        <CurrencyPill kind="badges" icon={<IconBadge />} value={badges.value} label={t('hud.badges')} />
      </div>
      <button
        class="btn-round"
        data-testid="btn-pause"
        aria-label={t('pause.title')}
        onClick={() => {
          click()
          openPause()
        }}
      >
        <IconPause />
      </button>
    </header>
  )
}

function ActionBar() {
  const soon = () => {
    click()
    showToast('common.soon')
  }
  const items: { id: string; icon: preact.JSX.Element; label: string; onClick: () => void; hidden?: boolean }[] = [
    { id: 'map', icon: <IconMap />, label: t('bar.map'), onClick: soon },
    { id: 'agents', icon: <IconAgent />, label: t('bar.agents'), onClick: soon },
    { id: 'gadgets', icon: <IconGadget />, label: t('bar.gadgets'), onClick: soon },
    { id: 'shop', icon: <IconShop />, label: t('bar.shop'), onClick: soon, hidden: !features.payments },
    {
      id: 'settings',
      icon: <IconGear />,
      label: t('bar.settings'),
      onClick: () => {
        click()
        openPanel.value = 'settings'
      },
    },
  ]
  return (
    <nav class="actionbar">
      {items
        .filter((i) => !i.hidden)
        .map((i) => (
          <button class="action" data-testid={`bar-${i.id}`} onClick={i.onClick} aria-label={i.label}>
            <span class="action-icon">{i.icon}</span>
            <span class="action-label fit">{i.label}</span>
          </button>
        ))}
    </nav>
  )
}

function Orders() {
  return (
    <aside class="orders" data-testid="orders">
      <div class="orders-title typewriter fit">{t('orders.title')}</div>
      <div class="orders-item">{t(orderHint.value)}</div>
    </aside>
  )
}

function Panel(props: { title: string; testid: string; onClose: () => void; children: preact.ComponentChildren }) {
  return (
    <div class="modal-backdrop" onPointerDown={(e) => e.target === e.currentTarget && props.onClose()}>
      <section class="folder" role="dialog" aria-label={props.title} data-testid={props.testid}>
        <div class="folder-tab typewriter">{t('stamp.classified')}</div>
        <div class="paperclip" aria-hidden="true" />
        <header class="folder-head">
          <h2 class="typewriter fit">{props.title}</h2>
          <button
            class="btn-close"
            data-testid="btn-close"
            aria-label={t('common.close')}
            onClick={() => {
              click()
              props.onClose()
            }}
          >
            <IconClose />
          </button>
        </header>
        <div class="folder-body">{props.children}</div>
      </section>
    </div>
  )
}

function Slider(props: { icon: preact.JSX.Element; label: string; value: number; onInput: (v: number) => void; testid: string }) {
  return (
    <label class="row slider-row">
      <span class="row-icon">{props.icon}</span>
      <span class="row-label fit">{props.label}</span>
      <input
        type="range"
        min={0}
        max={100}
        value={Math.round(props.value * 100)}
        data-testid={props.testid}
        aria-label={props.label}
        onInput={(e) => props.onInput(Number((e.target as HTMLInputElement).value) / 100)}
      />
    </label>
  )
}

function SettingsPanel() {
  const muted = userMuted.value
  return (
    <Panel title={t('settings.title')} testid="panel-settings" onClose={closePanel}>
      <div class="brand typewriter">{t('game.title')}</div>
      <button
        class={`row toggle ${muted ? 'off' : 'on'}`}
        data-testid="btn-mute"
        onClick={() => {
          userMuted.value = !userMuted.value
          click()
        }}
      >
        <span class="row-icon">{muted ? <IconSoundOff /> : <IconSoundOn />}</span>
        <span class="row-label fit">{t('settings.sound')}</span>
        <span class="toggle-state">{muted ? t('settings.unmute') : t('settings.mute')}</span>
      </button>
      <Slider icon={<IconMusic />} label={t('settings.music')} value={musicVolume.value} testid="slider-music" onInput={(v) => (musicVolume.value = v)} />
      <Slider icon={<IconSoundOn />} label={t('settings.sfx')} value={sfxVolume.value} testid="slider-sfx" onInput={(v) => (sfxVolume.value = v)} />
      <div class="row lang-head">
        <span class="row-icon">
          <IconGlobe />
        </span>
        <span class="row-label fit">{t('settings.language')}</span>
      </div>
      <div class="lang-grid" data-testid="lang-grid">
        {LANGUAGES.map((l) => (
          <button
            class={`lang ${lang.value === l.code ? 'active' : ''}`}
            lang={l.code}
            data-testid={`lang-${l.code}`}
            onClick={() => {
              click()
              languageChoice.value = l.code as LangCode
              void setLanguage(l.code as LangCode)
            }}
          >
            {l.name}
          </button>
        ))}
      </div>
    </Panel>
  )
}

function PausePanel() {
  return (
    <Panel title={t('pause.title')} testid="panel-pause" onClose={closePanel}>
      <div class="brand typewriter">{t('game.title')}</div>
      <button class="btn-primary" data-testid="btn-resume" onClick={() => { click(); closePanel() }}>
        <IconPlay /> <span>{t('pause.resume')}</span>
      </button>
    </Panel>
  )
}

export function App() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || e.target instanceof HTMLInputElement) return
      if (e.code === 'KeyP') {
        if (openPanel.value === 'pause') closePanel()
        else if (!openPanel.value) openPause()
      }
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('resize', scheduleFit)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', scheduleFit)
    }
  }, [])
  useLayoutEffect(() => scheduleFit())

  return (
    <div class="ui-root" data-lang={lang.value}>
      <TopBar />
      <Orders />
      <ActionBar />
      {openPanel.value === 'settings' && <SettingsPanel />}
      {openPanel.value === 'pause' && <PausePanel />}
      {toast.value && (
        <div class="toast" role="status" data-testid="toast">
          {t(toast.value)}
        </div>
      )}
      {contextLost.value && (
        <button class="ctx-lost" data-testid="ctx-lost" onClick={() => location.reload()}>
          {t('error.contextLost')}
        </button>
      )}
    </div>
  )
}
