/** Mission overlays: minigame HUD (+ ghost hand), result with stars + x2, fail with revive. */
import { t, lang } from '../i18n/i18n'
import { formatNumber } from '../core/format'
import { game } from '../game/actions'
import { mgHud } from '../minigames/Minigame'
import { missionUi, vaultLoot } from './uiState'
import { AdButton, Btn, Stars } from './common'
import { openPause } from './panels'
import { IconAd, IconBadge, IconBulb, IconArrowLeft, IconArrowRight, IconBag, IconBolt, IconCash, IconCoat, IconEye, IconGlasses, IconHand, IconHat, IconHome, IconIntel, IconPause, IconRetry, IconTimer } from './icons'
import type { MoleClue } from '../minigames/Minigame'
import { resolveMission } from '../sim/ops'
import { state } from '../game/store'
import { OFFERS } from '../config/ads'
import { CODE } from '../config/minigames'

const fmt = (n: number) => formatNumber(n, lang.value)

/** Code Breaker symbol as SVG (same shape + colour as on the 3D board). */
function SymIcon(props: { i: number }) {
  const c = `#${CODE.colors[props.i]!.toString(16).padStart(6, '0')}`
  const sh = CODE.shapes[props.i]
  const common = { fill: c, stroke: '#14213d', 'stroke-width': 2.2, 'stroke-linejoin': 'round' as const }
  return (
    <svg viewBox="0 0 32 32" width="1.6em" height="1.6em" aria-hidden="true">
      {sh === 'circle' && <circle cx="16" cy="16" r="11" {...common} />}
      {sh === 'triangle' && <path d="M16 4 L28 26 L4 26 Z" {...common} />}
      {sh === 'square' && <rect x="6" y="6" width="20" height="20" rx="2" {...common} />}
      {sh === 'star' && <path d="M16 3 L19.5 12 L29 12.5 L21.5 18.5 L24 28 L16 22.5 L8 28 L10.5 18.5 L3 12.5 L12.5 12 Z" {...common} />}
      {sh === 'diamond' && <path d="M16 3 L28 16 L16 29 L4 16 Z" {...common} />}
      {sh === 'hexagon' && <path d="M9 5 L23 5 L30 16 L23 27 L9 27 L2 16 Z" {...common} />}
      {sh === 'cross' && <path d="M12 4 H20 V12 H28 V20 H20 V28 H12 V20 H4 V12 H12 Z" {...common} />}
    </svg>
  )
}

/** Code Breaker keypad: symbol keys, delete, confirm, hint. */
function Keypad(props: { k: NonNullable<ReturnType<typeof mgHud.peek>>['keypad'] }) {
  const k = props.k!
  const g = game()
  const hint = (i: number) => (k.suggest === i ? 'suggest' : '')
  return (
    <div class="mg-keypad" data-testid="mg-keypad">
      <div class="kp-row">
        <button class="kp-hint" data-testid="btn-mg-hint" onPointerDown={(e) => { e.stopPropagation(); void g.minigameHint() }}>
          {t('code.hint')} {k.freeHints > 0 ? <b>{t('code.free')}</b> : <IconAd />}
        </button>
        <span class="kp-left">{t('code.attempts', { n: k.attemptsLeft })}</span>
      </div>
      <div class="kp-keys">
        {Array.from({ length: k.symbols }, (_, i) => (
          <button class={`kp-key ${hint(i)}`} data-testid={`btn-sym-${i}`} aria-label={`${i + 1}`} onPointerDown={(e) => { e.stopPropagation(); g.minigameInput('sym', i) }}>
            <SymIcon i={i} />
            {k.suggest === i && <span class="kp-hand" aria-hidden="true"><IconHand size="40px" /></span>}
          </button>
        ))}
      </div>
      <div class="kp-row">
        <button class={`kp-del ${hint(-1)}`} data-testid="btn-sym-del" aria-label={t('code.delete')} onPointerDown={(e) => { e.stopPropagation(); g.minigameInput('del') }}>
          <svg viewBox="0 0 32 24" width="1.7em" height="1.3em" aria-hidden="true"><path d="M10 2 H29 V22 H10 L2 12 Z" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linejoin="round" /><path d="M15 7 L24 17 M24 7 L15 17" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" /></svg>
        </button>
        <button class={`kp-ok ${hint(-2)}`} data-testid="btn-sym-ok" disabled={!k.canSubmit} onPointerDown={(e) => { e.stopPropagation(); g.minigameInput('ok') }}>
          {t('code.ok')}
          {k.suggest === -2 && <span class="kp-hand" aria-hidden="true"><IconHand size="40px" /></span>}
        </button>
      </div>
    </div>
  )
}

const CLUE_ICON = { hat: IconHat, glasses: IconGlasses, bag: IconBag, shirt: IconCoat } as const

/** Spot the Mole: clue chips appear one after another (the next one fills up). */
function Clues(props: { clues: MoleClue[] }) {
  return (
    <div class="mg-clues" data-testid="mg-clues">
      {props.clues.map((c, i) => {
        const Ico = CLUE_ICON[c.icon]
        const neg = /\.(no|none)$/.test(c.key)
        return c.shown ? (
          <div class={`clue ${neg ? 'neg' : ''}`} data-testid={`clue-${i}`}>
            <span class="clue-ico" style={c.color !== null ? { color: `#${c.color.toString(16).padStart(6, '0')}` } : undefined}>
              <Ico size="1.3em" />
            </span>
            <span class="clue-text">{t(c.key)}</span>
          </div>
        ) : (
          <div class="clue hidden" aria-hidden="true">
            <span class="clue-fill" style={{ width: `${Math.round(c.progress * 100)}%` }} />
            <IconEye size="1.2em" />
          </div>
        )
      })}
    </div>
  )
}

/** Boss missions: stage chips (done / current / next). */
function BossStages() {
  const ui = missionUi.value
  if (!ui || (ui.phase !== 'playing' && ui.phase !== 'stage') || ui.stage === undefined) return null
  const m = resolveMission(state, ui.mission)
  if (!m?.stages) return null
  return (
    <div class="boss-stages" data-testid="boss-stages">
      <span class="boss-tag typewriter">{t('boss.label')}</span>
      {m.stages.map((st, i) => (
        <span class={`boss-stage ${i < ui.stage! ? 'done' : i === ui.stage ? 'now' : ''}`}>{t(`minigame.${st.minigame}`)}</span>
      ))}
    </div>
  )
}

function StageClear() {
  const ui = missionUi.value
  if (!ui || ui.phase !== 'stage') return null
  return (
    <div class="stage-clear" data-testid="stage-clear">
      <div class="stamp-big typewriter">{t('boss.stageClear')}</div>
    </div>
  )
}

function PlayingHud() {
  const h = mgHud.value
  if (!h) return null
  const timeShare = h.timeLimit ? h.timeLeft / h.timeLimit : 0
  return (
    <div class={`mg-hud ${h.flash ? `flash-${h.flash}` : ''}`} data-testid="mg-hud">
      <div class="mg-top">
        <button class="btn-round" data-testid="btn-mg-pause" aria-label={t('pause.title')} onClick={openPause}>
          <IconPause />
        </button>
        <div class="mg-bolts" aria-label={`${h.done}/${h.total}`}>
          {Array.from({ length: h.total }, (_, i) => (
            <span class={`bolt ${i < h.done ? 'open' : ''}`}>{h.icon === 'chip' ? <IconIntel /> : h.icon === 'bulb' ? <IconBulb /> : <IconBolt />}</span>
          ))}
        </div>
        <div class="mg-alarm" aria-label={`${h.mistakes}/${h.maxMistakes}`}>
          {Array.from({ length: h.maxMistakes }, (_, i) => (
            <span class={`alarm-dot ${i < h.mistakes ? 'on' : ''}`} />
          ))}
        </div>
      </div>
      {h.timeLimit > 0 && (
        <div class="mg-timer">
          <IconTimer />
          <div class="timer-bar"><div class={`timer-fill ${timeShare < 0.25 ? 'low' : ''}`} style={{ width: `${timeShare * 100}%` }} /></div>
        </div>
      )}
      {missionUi.value?.mission === 'vault' && (
        <div class="vault-loot" data-testid="vault-loot"><IconCash /> {fmt(vaultLoot.value)}</div>
      )}
      {h.clues && <Clues clues={h.clues} />}
      {h.chase !== undefined && (
        <div class="mg-chase" data-testid="mg-chase" aria-label={`${Math.round(h.chase * 100)}%`}>
          <span class="chase-me" />
          <div class="chase-bar"><div class="chase-fill" style={{ width: `${Math.max(0, Math.min(1, h.chase)) * 100}%` }} /></div>
          <span class="chase-thief" aria-hidden="true"><span /><span /></span>
          {h.chips !== undefined && <span class="chase-chips"><IconIntel /> {h.chips}</span>}
        </div>
      )}
      {h.lanes && (
        <>
          <button class="mg-lane left" data-testid="btn-lane-left" aria-label="left" onPointerDown={(e) => { e.stopPropagation(); game().minigameMove('left') }}>
            <IconArrowLeft size="1.6em" />
          </button>
          <button class="mg-lane right" data-testid="btn-lane-right" aria-label="right" onPointerDown={(e) => { e.stopPropagation(); game().minigameMove('right') }}>
            <IconArrowRight size="1.6em" />
          </button>
        </>
      )}
      {h.hint && (
        <button class="mg-hint-btn" data-testid="btn-mg-hint" onPointerDown={(e) => { e.stopPropagation(); void game().minigameHint() }}>
          {t('code.hint')} {h.hint.free > 0 ? <b>{t('code.free')}</b> : <IconAd />}
        </button>
      )}
      {h.keypad ? (
        <Keypad k={h.keypad} />
      ) : h.noTap ? null : (
        <button class="mg-tap" data-testid="btn-mg-tap" aria-label="tap" onPointerDown={(e) => { e.stopPropagation(); game().minigameAction() }}>
          <span class="mg-tap-ring" />
        </button>
      )}
      {h.ghost && h.ghost.hand !== false && (
        <div
          class={`ghost-hand ${h.ghost.swipe ? 'swipe' : h.ghost.pulse ? 'press' : ''}`}
          style={{
            transform: `translate(${h.ghost.x}px, ${h.ghost.y}px)`,
            ...(h.ghost.swipe ? { '--sx': `${h.ghost.swipe.dx}px`, '--sy': `${h.ghost.swipe.dy}px` } : {}),
          }}
          aria-hidden="true"
        >
          <IconHand size="64px" />
        </div>
      )}
      {h.ghost?.label && (
        <div class="ghost-caption" data-testid="ghost-caption" style={{ transform: `translate(calc(${h.ghost.x - 58}px - 50%), ${h.ghost.y + 80}px)` }}>
          {t(h.ghost.label)}
        </div>
      )}
    </div>
  )
}

function Result() {
  const ui = missionUi.value
  if (!ui || ui.phase !== 'result') return null
  const boss = !!resolveMission(state, ui.mission)?.boss
  return (
    <div class="modal-backdrop">
      <section class="folder result" data-testid="panel-result" role="dialog" aria-label={t('result.title')}>
        <div class="folder-tab typewriter">{t(`region.${resolveMission(state, ui.mission)?.region ?? 'harbor'}`)}</div>
        {boss ? (
          <>
            <div class="boss-name typewriter">{t(`target.${ui.mission}`)}</div>
            <div class="stamp-big red typewriter">{t('boss.captured')}</div>
          </>
        ) : (
          <div class="stamp-big typewriter">{t('result.title')}</div>
        )}
        <Stars n={ui.stars} size="2.6em" stamp />
        <div class="reward-row big">
          <span class="reward"><IconCash /> {fmt(ui.cash)}</span>
          <span class="reward"><IconIntel /> {fmt(ui.intel)}</span>
          {!!ui.badges && <span class="reward" data-testid="reward-badges"><IconBadge /> {fmt(ui.badges)}</span>}
        </div>
        {!ui.doubled && ui.freeDouble && (
          <>
            <Btn testid="btn-double-free" kind="buy" onClick={() => void game().doubleReward()}>{t('result.doubleFree')}</Btn>
            <div class="center muted small">{t('result.nextTimeAd')}</div>
          </>
        )}
        {!ui.doubled && !ui.freeDouble && (
          <AdButton placement="mission_double" testid="btn-double-ad" label={t('result.doubleAd')} onClick={() => void game().doubleReward()} />
        )}
        {ui.doubled && <div class="center doubled-tag">{t('result.doubled')}</div>}
        <Btn testid="btn-continue" kind="secondary" onClick={() => game().endMission()}>{t('result.continue')}</Btn>
      </section>
    </div>
  )
}

function VaultSummary() {
  const ui = missionUi.value
  if (!ui || ui.phase !== 'vault') return null
  return (
    <div class="modal-backdrop">
      <section class="folder result" data-testid="panel-vault-result" role="dialog" aria-label={t('vault.title')}>
        <div class="folder-tab typewriter">{t('vault.title')}</div>
        <div class={`stamp-big typewriter ${ui.cracked ? '' : 'red'}`}>{t(ui.cracked ? 'vault.cracked' : 'fail.alarm')}</div>
        <div class="reward-row big">
          <span class="reward"><IconCash /> {fmt(ui.loot)}</span>
        </div>
        {ui.canRetry && <AdButton placement="vault_retry" testid="btn-vault-retry" label={t('vault.retry')} onClick={() => void game().vaultRetry()} />}
        <Btn testid="btn-vault-collect" onClick={() => game().vaultCollect()}>{t('welcome.collect')}</Btn>
      </section>
    </div>
  )
}

function Fail() {
  const ui = missionUi.value
  if (!ui || ui.phase !== 'fail') return null
  const m = resolveMission(state, ui.mission)
  return (
    <div class="modal-backdrop">
      <section class="folder fail" data-testid="panel-fail" role="dialog" aria-label={t(`fail.${ui.reason}`)}>
        <div class="folder-tab typewriter">{m ? `#${m.index + 1}` : ''}</div>
        <div class="stamp-big red typewriter">{t(`fail.${ui.reason}`)}</div>
        <div class="center muted">{t('fail.text')}</div>
        {ui.canRevive && <AdButton placement="mission_revive" testid="btn-revive" label={t('fail.revive')} onClick={() => void game().revive()} />}
        {m && !m.boss && m.id !== 'alert' && m.id !== 'endless' && (state.missions[m.id]?.fails ?? 0) >= OFFERS.skipAfterFails && (
          <AdButton placement="mission_skip" testid="btn-skip" label={t('fail.skip')} onClick={() => void game().skipMission()} />
        )}
        <Btn testid="btn-retry" onClick={() => void game().retry()} icon={<IconRetry />}>{t('fail.retry')}</Btn>
        <Btn testid="btn-giveup" kind="secondary" onClick={() => game().endMission()} icon={<IconHome />}>{t('fail.back')}</Btn>
      </section>
    </div>
  )
}

export function MissionLayer() {
  const ui = missionUi.value
  if (!ui) return null
  return (
    <>
      {ui.phase === 'playing' && <PlayingHud />}
      <BossStages />
      <StageClear />
      {ui.phase === 'captured' && <div class="captured-stamp typewriter" data-testid="captured">{t('boss.captured')}</div>}
      <Result />
      <Fail />
      <VaultSummary />
    </>
  )
}
