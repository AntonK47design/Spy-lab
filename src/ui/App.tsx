import '@preact/signals' // installs auto-subscription of components to signals
import { useEffect, useLayoutEffect, useRef } from 'preact/hooks'
import { scheduleFit } from './fit'
import { t, lang } from '../i18n/i18n'
import { contextLost } from '../core/lifecycle'
import { formatNumber } from '../core/format'
import { hud, state, rev } from '../game/store'
import { now } from '../core/time'
import { PRESTIGE } from '../config/prestige'
import { canRelocate } from '../sim/prestige'
import { metaClaimable } from '../sim/meta'
import { rewardedSupported } from '../platform/ads'
import { TUTORIAL } from '../game/tutorial'
import { game } from '../game/actions'
import { nextUnlock } from '../sim/academy'
import { ROOMS } from '../config/rooms'
import { coachLine, infoCard, inMission, moveHint, panel, portrait, toast, missionUi, liveOffers, hudTick } from './uiState'
import { PanelHost, closePanel, openPause } from './panels'
import { MissionLayer } from './mission'
import { click } from './common'
import {
  AvatarDirector, AvatarMarmalade, IconAgent, IconHand, IconBadge, IconCash, IconGear, IconIntel, IconMap, IconStar,
  IconAlert, IconAd, IconGadget, IconCalendar,
} from './icons'

const fmt = (n: number) => formatNumber(n, lang.value)
const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches

/** Restart a one-shot CSS animation class (bounce on change). */
function bump(el: Element | null | undefined, cls = 'bump'): void {
  if (!el || reduced) return
  el.classList.remove(cls)
  void (el as HTMLElement).offsetWidth
  el.classList.add(cls)
}

/** Number that rolls to its new value (text only, no re-render per frame) and bumps its pill. */
function RollNum(props: { value: number; class?: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const shown = useRef(props.value)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const from = shown.current
    const to = props.value
    if (from === to) {
      el.textContent = fmt(to)
      return
    }
    bump(el.closest('.cash-pill'))
    if (reduced) {
      shown.current = to
      el.textContent = fmt(to)
      return
    }
    const t0 = performance.now()
    let raf = 0
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / 320)
      const v = Math.round(from + (to - from) * (1 - (1 - k) ** 3))
      shown.current = v
      el.textContent = fmt(v)
      if (k < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [props.value])
  return <span ref={ref} class={props.class}>{fmt(shown.current)}</span>
}

function TopLeft() {
  const share = Math.min(1, hud.xp.value / hud.xpNext.value)
  return (
    <div class="hud-tl">
      <button class="btn-round light" data-testid="bar-settings" aria-label={t('bar.settings')} onClick={() => { click(); panel.value = { kind: 'settings' } }}>
        <IconGear />
      </button>
      <div class="level-ring" data-testid="hud-level" style={{ '--p': `${share * 360}deg` } as Record<string, string>}>
        <span class="lr-avatar">
          {portrait.value ? <img class="lr-photo" src={portrait.value} alt="" draggable={false} /> : <AvatarDirector class="lr-svg" />}
        </span>
        <span class="lr-badge">{t('hud.lvl', { n: hud.level.value })}</span>
      </div>
    </div>
  )
}

function XpBar() {
  const share = Math.min(1, hud.xp.value / hud.xpNext.value)
  const star = useRef<HTMLDivElement>(null)
  const xp = hud.xp.value
  useEffect(() => bump(star.current?.querySelector('.xp-star')), [xp])
  return (
    <div class="xp-bar" ref={star} data-testid="hud-xp" aria-label={`${hud.xp.value}/${hud.xpNext.value}`}>
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
        <RollNum class="cash-val" value={Math.floor(hud.cash.value)} />
      </div>
      <div class="mini-pills">
        <div class="mini-pill" data-testid="hud-intel" aria-label={t('hud.intel')}><IconIntel /> {fmt(hud.intel.value)}</div>
        <div class="mini-pill gold" data-testid="hud-badges" aria-label={t('hud.badges')}><IconBadge /> {fmt(hud.badges.value)}</div>
      </div>
      <Coach />
    </div>
  )
}

/** Villain Alert: red pulsing button with the time left, opens the alert briefing. */
function AlertButton() {
  void hudTick.value
  const a = state.alert
  if (!a) return null
  const left = Math.max(0, Math.ceil((a.endsAt - now()) / 1000))
  return (
    <button class="action-round alert" data-testid="bar-alert" aria-label={t('alert.title')} onClick={() => { click(); panel.value = { kind: 'briefing', mission: 'alert' } }}>
      <IconAlert />
      <span class="action-label fit">{`${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`}</span>
    </button>
  )
}

/** Relocate HQ shows up once the academy level allows it. */
function PrestigeButton() {
  void hudTick.value
  if (state.level < PRESTIGE.fromLevel) return null
  return (
    <button class={`action-round ${canRelocate(state) ? 'gold' : ''}`} data-testid="bar-prestige" aria-label={t('prestige.title')} onClick={() => { click(); panel.value = { kind: 'prestige' } }}>
      <IconStar />
      <span class="action-label fit">{t('prestige.short')}</span>
    </button>
  )
}

/** Rewarded income boost: x2 for 5 min per ad (stackable to 30 min), time left on the button. */
function BoostButton() {
  void hudTick.value
  if (!rewardedSupported() || state.tutorial < TUTORIAL.length) return null
  const left = Math.max(0, Math.ceil((state.boostUntil - now()) / 1000))
  return (
    <button class={`action-round boost ${left > 0 ? 'on' : ''}`} data-testid="bar-boost" aria-label={t('boost.title')} onClick={() => { click(); void game().incomeBoost() }}>
      {left > 0 ? <span class="boost-x">x2</span> : <IconAd />}
      <span class="action-label fit">{left > 0 ? `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}` : t('boost.short')}</span>
    </button>
  )
}

/** Supply drone (first crate free) and VIP recruit: shown while they are on screen. */
function OfferButtons() {
  const o = liveOffers.value
  return (
    <>
      {o.supply !== null && (
        <button class="action-round offer" data-testid="bar-supply" aria-label={t('supply.title')} onClick={() => { click(); void game().openSupply() }}>
          {o.supplyFree ? <IconGadget /> : <IconAd />}
          <span class="action-label fit">{o.supplyFree ? t('supply.free') : `0:${String(o.supply).padStart(2, '0')}`}</span>
        </button>
      )}
      {o.vip !== null && (
        <button class="action-round offer vip" data-testid="bar-vip" aria-label={t('vip.title')} onClick={() => { click(); void game().recruitVip() }}>
          <IconAd />
          <span class="action-label fit">{t('vip.short')}</span>
        </button>
      )}
    </>
  )
}

/** Daily rewards / contracts / achievements, with a dot when something can be claimed. */
function DailyButton() {
  void hudTick.value
  if (state.tutorial < TUTORIAL.length) return null
  return (
    <button class="action-round" data-testid="bar-daily" aria-label={t('daily.title')} onClick={() => { click(); panel.value = { kind: 'daily' } }}>
      <IconCalendar />
      {metaClaimable(state, now()) && <span class="dot" />}
      <span class="action-label fit">{t('daily.short')}</span>
    </button>
  )
}

function ActionButtons() {
  return (
    <>
    <div class="hud-extras">
      <DailyButton />
      <OfferButtons />
      <BoostButton />
      <PrestigeButton />
      <AlertButton />
    </div>
    <nav class="hud-actions">
      <button class="action-round" data-testid="bar-agents" aria-label={t('bar.agents')} onClick={() => { click(); panel.value = { kind: 'agents' } }}>
        <IconAgent />
        <span class="action-label fit">{t('bar.agents')}</span>
      </button>
      <button class="action-round primary" data-testid="bar-map" aria-label={t('bar.map')} onClick={() => { click(); panel.value = { kind: 'missions' } }}>
        <IconMap />
        <span class="action-label fit">{t('bar.map')}</span>
      </button>
    </nav>
    </>
  )
}

function Coach() {
  const line = coachLine.value
  void rev.value
  if (!line) return <Orders />
  return (
    <aside class="coach objective" data-testid="coach" key={line} aria-label={t('coach.name')}>
      <span class="obj-ico"><AvatarMarmalade class="coach-avatar" /></span>
      <div class="coach-line">{t(line)}</div>
    </aside>
  )
}

function InfoCard() {
  const c = infoCard.value
  if (!c) return null
  return (
    <div class="info-card" data-testid="info-card" role="status" onPointerDown={() => (infoCard.value = null)}>
      <div class="info-title typewriter">{c.room ? t(`room.${c.room}`) : t('game.title')}</div>
      <div>{t(c.key)}</div>
    </div>
  )
}

function MoveHint() {
  const h = moveHint.value
  if (!h) return null
  return (
    <div class={`move-hint ${h === 'hint.drag' ? 'touch' : ''}`} data-testid="move-hint" aria-live="polite">
      {h === 'hint.drag' && <span class="finger" aria-hidden="true"><IconHand size="48px" /></span>}
      <span>{t(h)}</span>
    </div>
  )
}

function Orders() {
  const next = nextUnlock(state)
  if (!next) return null
  const left = ROOMS[next].unlockCost - state.rooms[next].paid
  return (
    <aside class="orders objective" data-testid="orders" aria-label={t('orders.title')}>
      <span class="obj-ico cash"><IconCash /></span>
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
        // pause only exists where a timer runs against the player (missions); the academy pauses itself on hide/ads
        else if (!panel.value && inMission.value && missionUi.value?.phase !== 'result' && missionUi.value?.phase !== 'fail') openPause()
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
          <ActionButtons />
          <MoveHint />
          <InfoCard />
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
