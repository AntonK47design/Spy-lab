import '@preact/signals' // installs auto-subscription of components to signals
import { useEffect, useLayoutEffect } from 'preact/hooks'
import { scheduleFit } from './fit'
import { t, lang } from '../i18n/i18n'
import { contextLost } from '../core/lifecycle'
import { formatNumber } from '../core/format'
import { hud, state, rev } from '../game/store'
import { nextUnlock } from '../sim/academy'
import { ROOMS } from '../config/rooms'
import { coachLine, inMission, panel, toast, missionUi } from './uiState'
import { PanelHost, closePanel, openPause } from './panels'
import { MissionLayer } from './mission'
import { click } from './common'
import {
  AvatarDirector, AvatarMarmalade, IconAgent, IconBadge, IconCash, IconGear, IconIntel, IconMap, IconPause, IconStar,
} from './icons'

const fmt = (n: number) => formatNumber(n, lang.value)

function TopLeft() {
  const share = Math.min(1, hud.xp.value / hud.xpNext.value)
  return (
    <div class="hud-tl">
      <button class="btn-round light" data-testid="bar-settings" aria-label={t('bar.settings')} onClick={() => { click(); panel.value = { kind: 'settings' } }}>
        <IconGear />
      </button>
      <div class="level-ring" data-testid="hud-level" style={{ '--p': `${share * 360}deg` } as Record<string, string>}>
        <AvatarDirector class="lr-avatar" />
        <span class="lr-badge">{t('hud.lvl', { n: hud.level.value })}</span>
      </div>
    </div>
  )
}

function XpBar() {
  const share = Math.min(1, hud.xp.value / hud.xpNext.value)
  return (
    <div class="xp-bar" data-testid="hud-xp" aria-label={`${hud.xp.value}/${hud.xpNext.value}`}>
      <IconStar class="xp-star" />
      <div class="xp-track">
        <div class="xp-fill" style={{ width: `${share * 100}%` }} />
        <span class="xp-text">{hud.xp.value}/{hud.xpNext.value}</span>
      </div>
    </div>
  )
}

function TopRight() {
  return (
    <div class="hud-tr">
      <div class="cash-pill" data-testid="hud-cash" aria-label={t('hud.cash')}>
        <span class="cash-ico"><IconCash /></span>
        <span class="cash-val">{fmt(hud.cash.value)}</span>
      </div>
      <div class="mini-pills">
        <div class="mini-pill" data-testid="hud-intel" aria-label={t('hud.intel')}><IconIntel /> {fmt(hud.intel.value)}</div>
        <div class="mini-pill gold" data-testid="hud-badges" aria-label={t('hud.badges')}><IconBadge /> {fmt(hud.badges.value)}</div>
      </div>
    </div>
  )
}

function ActionButtons() {
  return (
    <nav class="hud-actions">
      <button class="action-round small" data-testid="bar-pause" aria-label={t('pause.title')} onClick={() => { click(); openPause() }}>
        <IconPause />
      </button>
      <button class="action-round" data-testid="bar-agents" aria-label={t('bar.agents')} onClick={() => { click(); panel.value = { kind: 'agents' } }}>
        <IconAgent />
        <span class="action-label fit">{t('bar.agents')}</span>
      </button>
      <button class="action-round primary" data-testid="bar-map" aria-label={t('bar.map')} onClick={() => { click(); panel.value = { kind: 'missions' } }}>
        <IconMap />
        <span class="action-label fit">{t('bar.map')}</span>
      </button>
    </nav>
  )
}

function Coach() {
  const line = coachLine.value
  void rev.value
  if (!line) return <Orders />
  return (
    <aside class="coach" data-testid="coach">
      <AvatarMarmalade class="coach-avatar" />
      <div class="coach-bubble">
        <div class="coach-name typewriter">{t('coach.name')}</div>
        <div class="coach-line">{t(line)}</div>
      </div>
    </aside>
  )
}

function Orders() {
  const next = nextUnlock(state)
  if (!next) return null
  const left = ROOMS[next].unlockCost - state.rooms[next].paid
  return (
    <aside class="orders" data-testid="orders">
      <div class="orders-title typewriter fit">{t('orders.title')}</div>
      <div class="orders-item">{t('orders.unlock', { room: t(`room.${next}`), price: fmt(left) })}</div>
    </aside>
  )
}

export function App() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || e.target instanceof HTMLInputElement) return
      if (e.code === 'KeyP') {
        if (panel.value?.kind === 'pause') closePanel()
        else if (!panel.value && missionUi.value?.phase !== 'result' && missionUi.value?.phase !== 'fail') openPause()
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

  const playing = inMission.value
  return (
    <div class={`ui-root ${playing ? 'in-mission' : ''}`} data-lang={lang.value}>
      {!playing && (
        <>
          <TopLeft />
          <XpBar />
          <TopRight />
          <Coach />
          <ActionButtons />
        </>
      )}
      <MissionLayer />
      <PanelHost />
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
