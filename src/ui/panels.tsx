import { t, lang, setLanguage } from '../i18n/i18n'
import { LANGUAGES, type LangCode } from '../config/i18n-langs'
import { userMuted, userPaused } from '../core/lifecycle'
import { languageChoice, musicVolume, sfxVolume } from '../core/settings'
import { formatNumber, formatDuration } from '../core/format'
import { showInterstitial } from '../platform/ads'
import { state, rev } from '../game/store'
import { game } from '../game/actions'
import { ROOMS, type RoomId } from '../config/rooms'
import { MISSIONS, REGIONS, missionById, type RegionId } from '../config/missions'
import { signal } from '@preact/signals'
import { ECONOMY, speedCost } from '../config/economy'
import { agentPower, cycleTime, income, levelCost, weakestAgent } from '../sim/academy'
import { bestAgent, missionLock, missionReward } from '../sim/missions'
import { panel, briefingGadget, type Panel } from './uiState'
import { GADGETS, GADGET, gadgetFor } from '../config/gadgets'
import { craftBlock } from '../sim/gadgets'
import { resolveMission, endlessOpen, fieldOpsOpen } from '../sim/ops'
import { FIELD_OPS } from '../config/ops'
import { LEADERBOARD_ID, PRESTIGE, shopOf } from '../config/prestige'
import { leaderboards, type LbEntry } from '../platform/bridge'
import { useEffect } from 'preact/hooks'
import { useSignal } from '@preact/signals'
import { ACHIEVEMENTS, DAILY } from '../config/meta'
import { OFFERS } from '../config/ads'
import { achievementProgress, contractProgress, contractsOpen, dailyIndex, dailyValue } from '../sim/meta'
import { canRelocate, medalGain } from '../sim/prestige'
import { now } from '../core/time'
import { AdButton, Btn, Folder, Stars, click } from './common'
import {
  IconAlert, IconBadge, IconCash, IconCheck, IconField, IconGadget, IconGlobe, IconIntel, IconLock, IconMusic, IconPeople, IconPlay, IconSoundOff, IconSoundOn,
  IconSpeed, IconUp, IconWhistle, IconStar, IconAgent,
} from './icons'

const fmt = (n: number) => formatNumber(n, lang.value)

export function closePanel(): void {
  const p = panel.value
  if (p?.kind === 'pause') {
    userPaused.value = false
    panel.value = null
    showInterstitial('pause_resume')
    return
  }
  game().closePanel(p)
}

export function openPause(): void {
  if (panel.value?.kind === 'pause') return
  panel.value = { kind: 'pause' }
  userPaused.value = true
}

// ---------------------------------------------------------------- settings / pause
function Slider(props: { icon: preact.JSX.Element; label: string; value: number; onInput: (v: number) => void; testid: string }) {
  return (
    <label class="row slider-row">
      <span class="row-icon">{props.icon}</span>
      <span class="row-label fit">{props.label}</span>
      <input
        type="range" min={0} max={100} value={Math.round(props.value * 100)} data-testid={props.testid} aria-label={props.label}
        onInput={(e) => props.onInput(Number((e.target as HTMLInputElement).value) / 100)}
      />
    </label>
  )
}

export function SettingsPanel() {
  const muted = userMuted.value
  return (
    <Folder title={t('settings.title')} testid="panel-settings" onClose={closePanel}>
      <div class="brand typewriter">{t('game.title')}</div>
      <button class={`row toggle ${muted ? 'off' : 'on'}`} data-testid="btn-mute" onClick={() => { userMuted.value = !userMuted.value; click() }}>
        <span class="row-icon">{muted ? <IconSoundOff /> : <IconSoundOn />}</span>
        <span class="row-label fit">{t('settings.sound')}</span>
        <span class="toggle-state">{muted ? t('settings.unmute') : t('settings.mute')}</span>
      </button>
      <Slider icon={<IconMusic />} label={t('settings.music')} value={musicVolume.value} testid="slider-music" onInput={(v) => (musicVolume.value = v)} />
      <Slider icon={<IconSoundOn />} label={t('settings.sfx')} value={sfxVolume.value} testid="slider-sfx" onInput={(v) => (sfxVolume.value = v)} />
      <div class="row lang-head">
        <span class="row-icon"><IconGlobe /></span>
        <span class="row-label fit">{t('settings.language')}</span>
      </div>
      <div class="lang-grid" data-testid="lang-grid">
        {LANGUAGES.map((l) => (
          <button
            class={`lang ${lang.value === l.code ? 'active' : ''}`} lang={l.code} data-testid={`lang-${l.code}`}
            onClick={() => { click(); languageChoice.value = l.code as LangCode; void setLanguage(l.code as LangCode) }}
          >
            {l.name}
          </button>
        ))}
      </div>
    </Folder>
  )
}

export function PausePanel() {
  return (
    <Folder title={t('pause.title')} testid="panel-pause" onClose={closePanel}>
      <div class="brand typewriter">{t('game.title')}</div>
      <Btn testid="btn-resume" onClick={closePanel} icon={<IconPlay />}>{t('pause.resume')}</Btn>
    </Folder>
  )
}

// ---------------------------------------------------------------- room upgrade
function UpRow(props: {
  icon: preact.JSX.Element; label: string; value: string; next?: string; cost: number | null; testid: string; onBuy: () => void
}) {
  const afford = props.cost != null && state.cash >= props.cost
  return (
    <div class="up-row">
      <span class="row-icon">{props.icon}</span>
      <div class="up-info">
        <div class="up-label fit">{props.label}</div>
        <div class="up-value">
          {props.value}
          {props.next && <span class="up-next"> → {props.next}</span>}
        </div>
      </div>
      {props.cost == null ? (
        <span class="up-max">{t('upgrade.max')}</span>
      ) : (
        <button class={`btn-buy ${afford ? '' : 'dim'}`} data-testid={props.testid} disabled={!afford} onClick={() => { click(); props.onBuy() }}>
          <IconCash /> {fmt(props.cost)}
        </button>
      )}
    </div>
  )
}

export function UpgradePanel(props: { room: RoomId }) {
  void rev.value
  const id = props.room
  const r = state.rooms[id]
  const def = ROOMS[id]
  const g = game()
  const inc = income(state, id)
  const ct = cycleTime(state, id)
  const nextInc = (inc / r.level) * (r.level + 1) * (ECONOMY.milestones.includes((r.level + 1) as never) ? 2 : 1)
  return (
    <Folder title={t(`room.${id}`)} testid="panel-upgrade" onClose={closePanel} tab={t('pad.office')}>
      <div class="room-sub">
        <span class={`skill-chip skill-${def.skill}`}>{t(`skill.${def.skill}`)}</span>
        <span>{t('upgrade.lv', { n: r.level })}</span>
        <span class="muted">{t('upgrade.stations', { n: r.stations, max: ECONOMY.slots.max })}</span>
      </div>
      <UpRow icon={<IconUp />} label={t('upgrade.income')} value={fmt(inc)} next={fmt(nextInc)}
        cost={r.level < ECONOMY.maxRoomLevel ? levelCost(state, id) : null} testid="buy-level" onBuy={() => g.upgrade(id, 'level')} />
      {(() => {
        const cost = r.level < ECONOMY.maxRoomLevel ? levelCost(state, id) : 0
        const miss = cost ? g.missingCashOffer(cost) : 0
        return miss > 0 ? <AdButton testid="btn-missing-cash" label={t('upgrade.missing', { cash: fmt(miss) })} onClick={() => void g.missingCash(cost)} /> : null
      })()}
      <UpRow icon={<IconSpeed />} label={t('upgrade.speed')} value={`${ct.toFixed(1)}s`}
        next={r.speed < ECONOMY.speed.max ? `${(ct * ECONOMY.speed.factorPerLevel).toFixed(1)}s` : undefined}
        cost={r.speed < ECONOMY.speed.max ? speedCost(r.speed) : null} testid="buy-speed" onBuy={() => g.upgrade(id, 'speed')} />
      <div class="staff-row">
        <span class={`staff-chip ${r.runner ? 'on' : ''}`}><IconPeople /> {t('staff.runner')}</span>
        <span class={`staff-chip ${r.instructor ? 'on' : ''}`}><IconWhistle /> {t('staff.instructor')}</span>
      </div>
      <div class="muted small">{t('upgrade.staffHint')}</div>
    </Folder>
  )
}

/** Graduation payoff: keep the new agent (roster) or loan them out for a fee. */
export function GraduatePanel() {
  void rev.value
  const p = state.pending[0]
  if (!p) return null
  const a = p.agent
  const full = state.agents.length >= state.rosterLimit
  const g = game()
  const done = (keep: boolean) => {
    g.resolveGraduate(keep)
    if (state.pending.length) bumpPanel()
    else closePanel()
  }
  return (
    <Folder title={t('agent.graduated')} testid="panel-graduate" onClose={() => done(!full)} tab={t('stamp.new')}>
      <div class={`agent-card big reveal rarity-${a.rarity}`}>
        <div class="ac-rarity typewriter">{t(`rarity.${a.rarity}`)}</div>
        <IconAgent class="ac-icon" />
        <div class="ac-name">{a.name}</div>
        <div class="ac-skills">
          {(Object.entries(a.skills) as [string, number][]).map(([k, v]) => (
            <div class="ac-sk"><span class="fit">{t(`skill.${k}`)}</span><b>{v}</b></div>
          ))}
        </div>
      </div>
      <div class="choice-row">
        <Btn testid="btn-keep" onClick={() => done(true)} disabled={full}>{full ? t('grad.full') : t('grad.keep')}</Btn>
        <Btn testid="btn-loan" kind="buy" onClick={() => done(false)}>{t('grad.loan', { fee: fmt(p.fee) })}</Btn>
      </div>
      <div class="muted small center">{t('agents.roster', { n: state.agents.length, max: state.rosterLimit })}</div>
    </Folder>
  )
}

/**
 * Agency office laptop: the waiting graduates with sell / hire / swap, plus the auto switch
 * (with a full roster, graduates not stronger than the weakest agent are loaned out at once).
 */
export function OfficePanel() {
  void rev.value
  const g = game()
  const full = state.agents.length >= state.rosterLimit
  const weak = weakestAgent(state)
  const floor = weak ? agentPower(weak) : 0
  const auto = !!state.flags.autoSellWeak
  return (
    <Folder title={t('office.title')} testid="panel-office" onClose={closePanel} tab={t('office.tab')} wide>
      <button class={`row toggle ${auto ? 'on' : 'off'}`} data-testid="btn-auto-sell" onClick={() => { click(); g.setAutoSell(!auto) }}>
        <span class="row-label">{t('office.auto')}</span>
        <span class="toggle-state">{auto ? t('office.on') : t('office.off')}</span>
      </button>
      <div class="muted small">{t('agents.roster', { n: state.agents.length, max: state.rosterLimit })}{weak ? ` · ${t('office.weakest', { p: floor })}` : ''}</div>
      {state.pending.length === 0 && <div class="empty">{t('office.empty')}</div>}
      <div class="office-list">
        {state.pending.map((p, i) => {
          const a = p.agent
          const pow = agentPower(a)
          const top = (Object.entries(a.skills) as [string, number][]).sort((x, y) => y[1] - x[1])[0]!
          const better = full && weak !== null && pow > floor
          return (
            <div class={`office-row rarity-${a.rarity}`} data-testid={`office-row-${i}`}>
              <div class="or-info">
                <div class="ac-rarity typewriter">{t(`rarity.${a.rarity}`)}</div>
                <div class="ac-name fit">{a.name}</div>
                <div class="ac-skill">{t(`skill.${top[0]}`)} {top[1]} · {t('office.power', { p: pow })}</div>
              </div>
              <div class="or-actions">
                <Btn testid={`btn-sell-${i}`} kind="buy" onClick={() => g.office(a.id, 'sell')}>{t('office.sell', { fee: fmt(p.fee) })}</Btn>
                {!full && <Btn testid={`btn-hire-${i}`} onClick={() => g.office(a.id, 'hire')}>{t('office.hire')}</Btn>}
                {full && <Btn testid={`btn-swap-${i}`} kind="secondary" disabled={!better} onClick={() => g.office(a.id, 'swap')}>{better ? t('office.swap') : t('office.weaker')}</Btn>}
              </div>
            </div>
          )
        })}
      </div>
      {state.pending.length > 1 && (
        <Btn testid="btn-sell-all" kind="buy" onClick={() => g.officeSellAll()}>
          {t('office.sellAll', { fee: fmt(state.pending.reduce((sum, p) => sum + p.fee, 0)) })}
        </Btn>
      )}
    </Folder>
  )
}

function bumpPanel(): void {
  panel.value = { kind: 'graduate' }
}

// ---------------------------------------------------------------- missions
/** Region tab of the missions folder (defaults to the region of the next mission to win). */
const missionRegion = signal<RegionId | 'endless' | null>(null)

function currentRegion(): RegionId {
  const next = MISSIONS.find((m) => !((state.missions[m.id]?.wins ?? 0) > 0))
  return next?.region ?? REGIONS[REGIONS.length - 1]!
}

export function MissionsPanel() {
  void rev.value
  const region = missionRegion.value ?? currentRegion()
  const endless = region === 'endless'
  const list = endless ? [resolveMission(state, 'endless')!].filter(Boolean) : MISSIONS.filter((m) => m.region === region)
  const alert = state.alert ? resolveMission(state, 'alert') : undefined
  return (
    <Folder title={t('missions.title')} testid="panel-missions" onClose={() => { missionRegion.value = null; closePanel() }} tab={endless ? t('endless.title') : t(`region.${region}`)} wide>
      {alert && (
        <button class="alert-card" data-testid="mission-alert" onClick={() => { click(); panel.value = { kind: 'briefing', mission: 'alert' } }}>
          <IconAlert />
          <span class="ac-text">
            <b>{t('alert.title')}</b>
            <span>{t('alert.text', { region: t(`region.${alert.region}`) })}</span>
          </span>
          <span class="ac-badges"><IconBadge /> {alert.badges}</span>
        </button>
      )}
      {fieldOpsOpen(state) && (
        <button class="fieldops-btn" data-testid="btn-fieldops" onClick={() => { click(); panel.value = { kind: 'fieldops' } }}>
          <IconField /> {t('fieldops.title')} <span class="muted small">{state.fieldOps.length}/{FIELD_OPS.slots}</span>
        </button>
      )}
      <div class="region-tabs" role="tablist">
        {REGIONS.map((r) => (
          <button
            role="tab" aria-selected={r === region} class={`region-tab ${r === region ? 'on' : ''}`} data-testid={`tab-region-${r}`}
            onClick={() => { click(); missionRegion.value = r }}
          >
            {t(`region.${r}`)}
          </button>
        ))}
        {endlessOpen(state) && (
          <button role="tab" aria-selected={endless} class={`region-tab ${endless ? 'on' : ''}`} data-testid="tab-region-endless" onClick={() => { click(); missionRegion.value = 'endless' }}>
            {t('endless.title')}
          </button>
        )}
      </div>
      <div class="mission-list">
        {list.map((m) => {
          const lock = missionLock(state, m)
          const p = state.missions[m.id]
          return (
            <button
              class={`mission-card ${lock === 'ok' ? '' : 'locked'} ${m.boss ? 'boss' : ''}`} data-testid={`mission-${m.id}`} disabled={lock !== 'ok'}
              onClick={() => { click(); panel.value = { kind: 'briefing', mission: m.id } }}
            >
              <span class="mc-num typewriter">{m.boss ? t('boss.label') : endless ? t('endless.op', { n: m.index + 1 }) : `#${m.index + 1}`}</span>
              <span class={`mc-game mg-${m.minigame}`}>{m.boss ? t(`target.${m.id}`) : t(`minigame.${m.minigame}`)}</span>
              {lock === 'ok' ? <Stars n={p?.stars ?? 0} size="1em" /> : (
                <span class="mc-lock"><IconLock /> {t(`lock.${lock}`, { room: t(`room.${m.room}`) })}</span>
              )}
            </button>
          )
        })}
      </div>
    </Folder>
  )
}

export function BriefingPanel(props: { mission: string }) {
  void rev.value
  const m = resolveMission(state, props.mission)
  if (!m) return null
  const agent = bestAgent(state, m)
  const skill = ROOMS[m.room].skill ?? 'finesse'
  const reward = missionReward(state, m, 1)
  return (
    <Folder title={m.boss ? t('boss.label') : m.id === 'alert' ? t('alert.title') : m.id === 'endless' ? t('endless.op', { n: m.index + 1 }) : t('briefing.title', { n: m.index + 1 })} testid="panel-briefing" onClose={() => (panel.value = { kind: 'missions' })} tab={t('stamp.topSecret')}>
      <div class="dossier">
        <div class="dossier-photo"><span class="paw" aria-hidden="true" /></div>
        <div class="dossier-text">
          <div class="typewriter dossier-target">{t(`target.${m.id}`)}</div>
          <div class="muted">
            {m.stages ? m.stages.map((st) => t(`minigame.${st.minigame}`)).join(' → ') : `${t(`minigame.${m.minigame}`)} · ${t('briefing.tier', { n: m.tier })}`}
          </div>
        </div>
      </div>
      <div class="reward-row">
        <span class="reward"><IconCash /> {fmt(reward.cash)}</span>
        <span class="reward"><IconIntel /> {fmt(reward.intel)}</span>
      </div>
      {agent && (
        <div class={`agent-chip rarity-${agent.rarity}`} data-testid="briefing-agent">
          <IconAgent />
          <span class="fit">{agent.name}</span>
          <span class="agent-skill">{t(`skill.${skill}`)} {agent.skills[skill]}</span>
        </div>
      )}
      <GadgetSlot mission={m.id} />
      <Btn testid="btn-start-mission" onClick={() => void game().startMission(m.id)} icon={<IconPlay />}>{t('briefing.start')}</Btn>
    </Folder>
  )
}

// ---------------------------------------------------------------- agents
export function AgentsPanel() {
  void rev.value
  return (
    <Folder title={t('agents.title')} testid="panel-agents" onClose={closePanel} wide>
      <div class="muted">{t('agents.roster', { n: state.agents.length, max: state.rosterLimit })}</div>
      {state.agents.length === 0 && <div class="empty">{t('agents.empty')}</div>}
      <div class="agent-grid">
        {state.agents.map((a) => {
          const top = (Object.entries(a.skills) as [string, number][]).sort((x, y) => y[1] - x[1])[0]!
          return (
            <div class={`agent-card rarity-${a.rarity}`}>
              <div class="ac-rarity typewriter">{t(`rarity.${a.rarity}`)}</div>
              <div class="ac-name fit">{a.name}</div>
              <div class="ac-skill">{t(`skill.${top[0]}`)} {top[1]}</div>
              <div class="ac-level">{t('upgrade.lv', { n: a.level })}</div>
            </div>
          )
        })}
      </div>
    </Folder>
  )
}

export function AgentReveal(props: { agentId: number }) {
  const a = state.agents.find((x) => x.id === props.agentId)
  if (!a) return null
  return (
    <Folder title={t('agent.graduated')} testid="panel-agent" onClose={closePanel} tab={t('stamp.new')}>
      <div class={`agent-card big reveal rarity-${a.rarity}`}>
        <div class="ac-rarity typewriter">{t(`rarity.${a.rarity}`)}</div>
        <IconAgent class="ac-icon" />
        <div class="ac-name">{a.name}</div>
        <div class="ac-skills">
          {(Object.entries(a.skills) as [string, number][]).map(([k, v]) => (
            <div class="ac-sk"><span class="fit">{t(`skill.${k}`)}</span><b>{v}</b></div>
          ))}
        </div>
      </div>
      <Btn testid="btn-agent-ok" onClick={closePanel}>{t('common.great')}</Btn>
    </Folder>
  )
}

export function LevelUpPanel(props: { level: number }) {
  return (
    <Folder title={t('levelup.title')} testid="panel-levelup" onClose={closePanel} tab={t('stamp.promoted')}>
      <div class="levelup">
        <IconStar class="lv-star" />
        <div class="lv-num">{props.level}</div>
      </div>
      <div class="center muted">{t('levelup.text')}</div>
      <Btn testid="btn-levelup-ok" onClick={closePanel}>{t('common.great')}</Btn>
    </Folder>
  )
}

/** Briefing: the mission's gadget from the stock, or a free trial after an ad. */
function GadgetSlot(props: { mission: string }) {
  const m = resolveMission(state, props.mission)
  const g = m && !m.boss ? gadgetFor(m.minigame) : undefined
  if (!g) return null
  const stock = state.gadgets[g.id] ?? 0
  const sel = briefingGadget.value?.mission === props.mission ? briefingGadget.value : null
  return (
    <div class={`gadget-slot ${sel ? 'on' : ''}`} data-testid="gadget-slot">
      <IconGadget />
      <div class="gs-text">
        <b>{t(`gadget.${g.id}`)}</b>
        <span class="muted small">{t(`gadget.${g.id}.desc`)}</span>
      </div>
      {sel ? (
        <button class="gs-btn on" data-testid="btn-gadget-off" onClick={() => { click(); if (sel.mode === 'use') briefingGadget.value = null }}>
          {t(sel.mode === 'trial' ? 'briefing.gadgetTrialOn' : 'briefing.gadgetOn')}
        </button>
      ) : stock > 0 ? (
        <button class="gs-btn" data-testid="btn-gadget-use" onClick={() => { click(); briefingGadget.value = { mission: props.mission, mode: 'use' } }}>
          {t('briefing.gadgetUse', { n: stock })}
        </button>
      ) : (
        <AdButton testid="btn-gadget-trial" class="gs-ad" label={t('briefing.gadgetTrial')} onClick={() => void game().gadgetTrial(props.mission)} />
      )}
    </div>
  )
}

/** Daily rewards (7-day streak, x2 via ad), today's contracts and achievements. */
export function DailyPanel() {
  void rev.value
  const t0 = now()
  const today = dailyIndex(state, t0)
  const shownDay = today >= 0 ? today : (state.daily.streak + DAILY.length - 1) % DAILY.length
  return (
    <Folder title={t('daily.title')} testid="panel-daily" onClose={closePanel} wide>
      {t0 - state.freeBadgesAt >= OFFERS.freeBadgesCooldown * 1000 ? (
        <AdButton testid="btn-free-badges" label={t('shop.freeBadges', { n: OFFERS.freeBadges })} onClick={() => void game().freeBadges()} />
      ) : (
        <div class="center muted small">{t('shop.freeBadgesWait', { time: formatDuration(Math.ceil((OFFERS.freeBadgesCooldown * 1000 - (t0 - state.freeBadgesAt)) / 1000)) })}</div>
      )}
      <div class="daily-row">
        {DAILY.map((r, i) => {
          const done = today >= 0 ? i < today : i <= shownDay
          return (
            <div class={`daily-tile ${i === today ? 'now' : ''} ${done ? 'done' : ''}`} data-testid={`daily-${i}`}>
              <span class="dt-day">{t('daily.day', { n: i + 1 })}</span>
              <span class="dt-ico">{r.kind === 'cash' ? <IconCash /> : r.kind === 'badges' ? <IconBadge /> : r.kind === 'intel' ? <IconIntel /> : <IconGadget />}</span>
              <b>{r.kind === 'gadget' ? '1' : fmt(dailyValue(state, r))}</b>
              {done && <span class="dt-check"><IconCheck /></span>}
            </div>
          )
        })}
      </div>
      {today >= 0 ? (
        <div class="daily-actions">
          <AdButton testid="btn-daily-double" label={t('daily.double')} onClick={() => void game().claimDaily(true)} />
          <Btn testid="btn-daily-claim" onClick={() => void game().claimDaily(false)}>{t('daily.claim')}</Btn>
        </div>
      ) : (
        <div class="center muted">{t('daily.tomorrow')}</div>
      )}
      {contractsOpen(state) && state.contracts.items.length > 0 && (
        <>
          <div class="fo-head typewriter">{t('contracts.title')}</div>
          <div class="lab-list">
            {state.contracts.items.map((c, i) => {
              const p = contractProgress(state, i)!
              const ok = p.progress >= p.goal
              return (
                <div class="lab-row" data-testid={`contract-${i}`}>
                  <div class="lab-name">
                    <b>{t(`contract.${c.id}`, { n: p.goal })}</b>
                    <div class="lab-bar"><div style={{ width: `${Math.round((p.progress / p.goal) * 100)}%` }} /></div>
                  </div>
                  {c.claimed ? <span class="muted"><IconCheck /></span> : (
                    <button class="btn-mini buy" data-testid={`btn-contract-${i}`} disabled={!ok} onClick={() => { click(); game().claimContract(i) }}>
                      <IconBadge /> {p.badges}
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}
      {(leaderboards.type === 'in_game' || leaderboards.type === 'native_popup') && (
        <button class="fieldops-btn" data-testid="btn-leaderboard" onClick={() => { click(); game().openLeaderboard() }}>
          <IconStar /> {t('lb.title')}
        </button>
      )}
      <div class="fo-head typewriter">{t('achievements.title')}</div>
      <div class="lab-list">
        {ACHIEVEMENTS.map((a) => {
          const p = achievementProgress(state, a.id)!
          const ok = p.progress >= p.goal
          return (
            <div class={`lab-row ${p.claimed ? 'claimed' : ''}`} data-testid={`ach-${a.id}`}>
              <div class="lab-name">
                <b>{t(`ach.${a.id}`)}</b>
                <div class="muted small">{fmt(p.progress)} / {fmt(p.goal)}</div>
              </div>
              {p.claimed ? <span class="muted"><IconCheck /></span> : (
                <button class="btn-mini buy" data-testid={`btn-ach-${a.id}`} disabled={!ok} onClick={() => { click(); game().claimAchievement(a.id) }}>
                  <IconBadge /> {p.badges}
                </button>
              )}
            </div>
          )
        })}
      </div>
    </Folder>
  )
}

/** In-game leaderboard (Legacy Medals) where the platform has no own UI. */
export function LeaderboardPanel() {
  const entries = useSignal<LbEntry[] | null>(null)
  useEffect(() => {
    void leaderboards.getEntries(LEADERBOARD_ID).then((e) => (entries.value = e))
  }, [])
  const list = entries.value
  return (
    <Folder title={t('lb.title')} testid="panel-leaderboard" onClose={() => (panel.value = { kind: 'daily' })} tab={t('prestige.short')}>
      <div class="center small muted">{t('lb.text', { n: state.medals })}</div>
      {list === null ? (
        <div class="center muted">…</div>
      ) : list.length === 0 ? (
        <div class="center muted">{t('lb.empty')}</div>
      ) : (
        <div class="lab-list">
          {list.slice(0, 20).map((e) => (
            <div class="lab-row" data-testid="lb-row">
              <b class="typewriter">#{e.rank}</b>
              <span class="lab-name fit">{e.name || t('lb.agent')}</span>
              <span class="lab-stock"><IconStar /> {fmt(e.score)}</span>
            </div>
          ))}
        </div>
      )}
    </Folder>
  )
}

/** Relocate HQ: new cover shop + Legacy Medals; agents, missions, gadgets, badges and intel stay. */
export function PrestigePanel() {
  void rev.value
  const gain = medalGain(state)
  const ok = canRelocate(state)
  const next = shopOf(state.prestige + 1)
  return (
    <Folder title={t('prestige.title')} testid="panel-prestige" onClose={closePanel} tab={t('stamp.topSecret')}>
      <div class="prestige-shop" style={{ background: `#${next.wall.toString(16).padStart(6, '0')}`, borderColor: `#${next.trim.toString(16).padStart(6, '0')}` }}>
        <span class="muted small">{t('prestige.next')}</span>
        <b class="typewriter">{t(`shop.${next.id}`)}</b>
      </div>
      <div class="reward-row big">
        <span class="reward" data-testid="prestige-gain"><IconStar /> +{gain}</span>
      </div>
      <div class="center small">{t('prestige.medals', { n: state.medals, pct: Math.round(state.medals * PRESTIGE.incomePerMedal * 100) })}</div>
      <ul class="prestige-list small">
        <li class="keep">{t('prestige.keep')}</li>
        <li class="reset">{t('prestige.reset')}</li>
      </ul>
      {!ok && <div class="center muted">{state.level < PRESTIGE.fromLevel ? t('prestige.needLevel', { n: PRESTIGE.fromLevel }) : t('prestige.needCash')}</div>}
      <Btn testid="btn-relocate" kind="buy" disabled={!ok} onClick={() => game().relocateHq()}>{t('prestige.go')}</Btn>
    </Folder>
  )
}

/** Field Ops: send waiting graduates on timed jobs; collect or finish now (rewarded). */
export function FieldOpsPanel() {
  void rev.value
  const t0 = now()
  const free = FIELD_OPS.slots - state.fieldOps.length
  return (
    <Folder title={t('fieldops.title')} testid="panel-fieldops" onClose={closePanel} wide>
      <div class="lab-list">
        {state.fieldOps.map((f, i) => {
          const def = FIELD_OPS.ops[f.op]!
          const left = Math.max(0, (f.endsAt - t0) / 1000)
          const done = left <= 0
          return (
            <div class="lab-row" data-testid={`fieldop-${i}`}>
              <div class="lab-name">
                <b>{f.agent.name}</b> <span class="muted small">{t('fieldops.op', { min: def.minutes })}</span>
                {!done && <div class="lab-bar"><div style={{ width: `${Math.round((1 - left / (def.minutes * 60)) * 100)}%` }} /></div>}
                <div class="small"><IconCash /> {fmt(f.cash)} · <IconIntel /> {f.intel}</div>
              </div>
              {done ? (
                <button class="btn-mini buy" data-testid={`btn-fieldop-collect-${i}`} onClick={() => { click(); game().fieldOpCollect(i) }}>{t('welcome.collect')}</button>
              ) : (
                <div class="fo-right">
                  <span class="lab-time">{formatDuration(Math.ceil(left))}</span>
                  <AdButton testid={`btn-fieldop-finish-${i}`} class="gs-ad" label={t('fieldops.finish')} onClick={() => void game().fieldOpFinish(i)} />
                </div>
              )}
            </div>
          )
        })}
      </div>
      <div class="fo-head typewriter">{t('fieldops.send')}</div>
      {state.pending.length === 0 ? (
        <div class="center muted">{t('fieldops.none')}</div>
      ) : free <= 0 ? (
        <div class="center muted">{t('fieldops.full')}</div>
      ) : (
        <div class="lab-list">
          {state.pending.slice(0, 4).map((p, pi) => (
            <div class="lab-row" data-testid={`fieldop-grad-${pi}`}>
              <div class="lab-name"><b>{p.agent.name}</b> <span class="muted small">{t(`rarity.${p.agent.rarity}`)}</span></div>
              <div class="fo-ops">
                {FIELD_OPS.ops.map((o, oi) => (
                  <button class="btn-mini" data-testid={`btn-fieldop-${pi}-${oi}`} onClick={() => { click(); game().fieldOp(pi, oi) }}>
                    {t('fieldops.min', { min: o.minutes })}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </Folder>
  )
}

/** Gadget Lab: craft gadgets with Intel and time (one at a time). */
export function LabPanel() {
  void rev.value
  const c = state.crafting
  const def = c ? GADGETS.find((g) => g.id === c.id) : null
  const left = c ? Math.max(0, (c.endsAt - now()) / 1000) : 0
  return (
    <Folder title={t('lab.title')} testid="panel-lab" onClose={closePanel} wide>
      {c && def && (
        <div class="lab-craft" data-testid="lab-crafting">
          <IconGadget />
          <div class="lab-craft-main">
            <b>{t(`gadget.${c.id}`)}</b>
            <div class="lab-bar"><div style={{ width: `${Math.round((1 - left / def.seconds) * 100)}%` }} /></div>
          </div>
          <span class="lab-time">{formatDuration(Math.ceil(left))}</span>
          <button class="btn-mini buy" data-testid="btn-lab-rush" disabled={state.badges < GADGET.rushBadges} onClick={() => { click(); game().rushCraft() }}>
            <IconBadge /> {GADGET.rushBadges}
          </button>
        </div>
      )}
      <div class="lab-list">
        {GADGETS.map((g) => {
          const block = craftBlock(state, g.id)
          return (
            <div class="lab-row" data-testid={`lab-${g.id}`}>
              <div class="lab-name">
                <b>{t(`gadget.${g.id}`)}</b> <span class="lab-stock">×{state.gadgets[g.id] ?? 0}</span>
                <div class="muted small">{t(`minigame.${g.minigame}`)} · {t(`gadget.${g.id}.desc`)}</div>
              </div>
              <button class="btn-mini buy" data-testid={`btn-craft-${g.id}`} disabled={block !== 'ok'} onClick={() => { click(); game().craft(g.id) }}>
                <IconIntel /> {g.intel} · {formatDuration(g.seconds)}
              </button>
            </div>
          )
        })}
      </div>
    </Folder>
  )
}

/** Vault Bonus offer: a free Safe Cracker round, every bolt pays loot. */
export function VaultOfferPanel() {
  return (
    <Folder title={t('vault.title')} testid="panel-vault" onClose={closePanel} tab={t('stamp.topSecret')}>
      <div class="vault-offer">
        <span class="vault-dial" aria-hidden="true" />
        <div class="center">{t('vault.text', { cash: fmt(game().vaultLootPerBolt()) })}</div>
      </div>
      <Btn testid="btn-vault-start" onClick={() => void game().startVault()}>{t('vault.start')}</Btn>
    </Folder>
  )
}

export function WelcomePanel(props: { amount: number; seconds: number }) {
  const take = (doubled: boolean) => {
    game().collectWelcome(props.amount, doubled)
    closePanel()
  }
  return (
    <Folder title={t('welcome.title')} testid="panel-welcome" onClose={() => take(false)}>
      <div class="center muted">{t('welcome.text', { time: formatDuration(props.seconds) })}</div>
      <div class="big-reward"><IconCash /> {fmt(props.amount)}</div>
      <AdButton testid="btn-welcome-double" label={t('welcome.double')} onClick={() => void game().welcomeDouble(props.amount).then((ok) => ok && closePanel())} />
      <Btn testid="btn-welcome-collect" onClick={() => take(false)}>{t('welcome.collect')}</Btn>
    </Folder>
  )
}

export function PanelHost() {
  const p: Panel | null = panel.value
  if (!p) return null
  switch (p.kind) {
    case 'settings': return <SettingsPanel />
    case 'pause': return <PausePanel />
    case 'upgrade': return <UpgradePanel room={p.room} />
    case 'missions': return <MissionsPanel />
    case 'briefing': return <BriefingPanel mission={p.mission} />
    case 'agents': return <AgentsPanel />
    case 'agent': return <AgentReveal agentId={p.agentId} />
    case 'graduate': return <GraduatePanel />
    case 'office': return <OfficePanel />
    case 'vault': return <VaultOfferPanel />
    case 'lab': return <LabPanel />
    case 'fieldops': return <FieldOpsPanel />
    case 'prestige': return <PrestigePanel />
    case 'daily': return <DailyPanel />
    case 'leaderboard': return <LeaderboardPanel />
    case 'levelup': return <LevelUpPanel level={p.level} />
    case 'welcome': return <WelcomePanel amount={p.amount} seconds={p.seconds} />
  }
}

