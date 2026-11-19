import { t, lang, setLanguage } from '../i18n/i18n'
import { LANGUAGES, type LangCode } from '../config/i18n-langs'
import { userMuted, userPaused } from '../core/lifecycle'
import { languageChoice, musicVolume, sfxVolume } from '../core/settings'
import { formatNumber, formatDuration } from '../core/format'
import { showInterstitial } from '../platform/ads'
import { state, rev } from '../game/store'
import { game } from '../game/actions'
import { ROOMS, type RoomId } from '../config/rooms'
import { MISSIONS, missionById } from '../config/missions'
import { ECONOMY, speedCost } from '../config/economy'
import { cycleTime, income, levelCost } from '../sim/academy'
import { bestAgent, missionLock, missionReward } from '../sim/missions'
import { panel, type Panel } from './uiState'
import { Btn, Folder, Stars, click } from './common'
import {
  IconCash, IconGlobe, IconIntel, IconLock, IconMusic, IconPeople, IconPlay, IconSoundOff, IconSoundOn,
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

function bumpPanel(): void {
  panel.value = { kind: 'graduate' }
}

// ---------------------------------------------------------------- missions
export function MissionsPanel() {
  void rev.value
  return (
    <Folder title={t('missions.title')} testid="panel-missions" onClose={closePanel} tab={t('region.harbor')} wide>
      <div class="mission-list">
        {MISSIONS.map((m) => {
          const lock = missionLock(state, m)
          const p = state.missions[m.id]
          return (
            <button
              class={`mission-card ${lock === 'ok' ? '' : 'locked'}`} data-testid={`mission-${m.id}`} disabled={lock !== 'ok'}
              onClick={() => { click(); panel.value = { kind: 'briefing', mission: m.id } }}
            >
              <span class="mc-num typewriter">#{m.index + 1}</span>
              <span class={`mc-game mg-${m.minigame}`}>{t(`minigame.${m.minigame}`)}</span>
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
  const m = missionById(props.mission)
  if (!m) return null
  const agent = bestAgent(state, m)
  const skill = ROOMS[m.room].skill ?? 'finesse'
  const reward = missionReward(state, m, 1)
  return (
    <Folder title={t('briefing.title', { n: m.index + 1 })} testid="panel-briefing" onClose={() => (panel.value = { kind: 'missions' })} tab={t('stamp.topSecret')}>
      <div class="dossier">
        <div class="dossier-photo"><span class="paw" aria-hidden="true" /></div>
        <div class="dossier-text">
          <div class="typewriter dossier-target">{t(`target.${m.id}`)}</div>
          <div class="muted">{t(`minigame.${m.minigame}`)} · {t('briefing.tier', { n: m.tier })}</div>
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

export function WelcomePanel(props: { amount: number; seconds: number }) {
  const take = (doubled: boolean) => {
    game().collectWelcome(props.amount, doubled)
    closePanel()
  }
  return (
    <Folder title={t('welcome.title')} testid="panel-welcome" onClose={() => take(false)}>
      <div class="center muted">{t('welcome.text', { time: formatDuration(props.seconds) })}</div>
      <div class="big-reward"><IconCash /> {fmt(props.amount)}</div>
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
    case 'levelup': return <LevelUpPanel level={p.level} />
    case 'welcome': return <WelcomePanel amount={p.amount} seconds={p.seconds} />
  }
}

