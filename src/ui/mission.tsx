/** Mission overlays: minigame HUD (+ ghost hand), result with stars + x2, fail with revive. */
import { t, lang } from '../i18n/i18n'
import { formatNumber } from '../core/format'
import { game } from '../game/actions'
import { mgHud } from '../minigames/Minigame'
import { missionUi } from './uiState'
import { AdButton, Btn, Stars } from './common'
import { openPause } from './panels'
import { IconBolt, IconCash, IconHand, IconHome, IconIntel, IconPause, IconRetry, IconTimer } from './icons'
import { missionById } from '../config/missions'

const fmt = (n: number) => formatNumber(n, lang.value)

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
            <span class={`bolt ${i < h.done ? 'open' : ''}`}><IconBolt /></span>
          ))}
        </div>
        <div class="mg-alarm" aria-label={`${h.mistakes}/${h.maxMistakes}`}>
          {Array.from({ length: h.maxMistakes }, (_, i) => (
            <span class={`alarm-dot ${i < h.mistakes ? 'on' : ''}`} />
          ))}
        </div>
      </div>
      <div class="mg-timer">
        <IconTimer />
        <div class="timer-bar"><div class={`timer-fill ${timeShare < 0.25 ? 'low' : ''}`} style={{ width: `${timeShare * 100}%` }} /></div>
      </div>
      <button class="mg-tap" data-testid="btn-mg-tap" aria-label="tap" onPointerDown={(e) => { e.stopPropagation(); game().minigameAction() }}>
        <span class="mg-tap-ring" />
      </button>
      {h.ghost && (
        <div class={`ghost-hand ${h.ghost.pulse ? 'press' : ''}`} style={{ transform: `translate(${h.ghost.x}px, ${h.ghost.y}px)` }} aria-hidden="true">
          <IconHand size="64px" />
        </div>
      )}
    </div>
  )
}

function Result() {
  const ui = missionUi.value
  if (!ui || ui.phase !== 'result') return null
  return (
    <div class="modal-backdrop">
      <section class="folder result" data-testid="panel-result" role="dialog" aria-label={t('result.title')}>
        <div class="folder-tab typewriter">{t('region.harbor')}</div>
        <div class="stamp-big typewriter">{t('result.title')}</div>
        <Stars n={ui.stars} size="2.6em" stamp />
        <div class="reward-row big">
          <span class="reward"><IconCash /> {fmt(ui.cash)}</span>
          <span class="reward"><IconIntel /> {fmt(ui.intel)}</span>
        </div>
        {!ui.doubled && ui.freeDouble && (
          <>
            <Btn testid="btn-double-free" kind="buy" onClick={() => void game().doubleReward()}>{t('result.doubleFree')}</Btn>
            <div class="center muted small">{t('result.nextTimeAd')}</div>
          </>
        )}
        {!ui.doubled && !ui.freeDouble && (
          <AdButton testid="btn-double-ad" label={t('result.doubleAd')} onClick={() => void game().doubleReward()} />
        )}
        {ui.doubled && <div class="center doubled-tag">{t('result.doubled')}</div>}
        <Btn testid="btn-continue" kind="secondary" onClick={() => game().endMission()}>{t('result.continue')}</Btn>
      </section>
    </div>
  )
}

function Fail() {
  const ui = missionUi.value
  if (!ui || ui.phase !== 'fail') return null
  const m = missionById(ui.mission)
  return (
    <div class="modal-backdrop">
      <section class="folder fail" data-testid="panel-fail" role="dialog" aria-label={t(`fail.${ui.reason}`)}>
        <div class="folder-tab typewriter">{m ? `#${m.index + 1}` : ''}</div>
        <div class="stamp-big red typewriter">{t(`fail.${ui.reason}`)}</div>
        <div class="center muted">{t('fail.text')}</div>
        {ui.canRevive && <AdButton testid="btn-revive" label={t('fail.revive')} onClick={() => void game().revive()} />}
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
      <Result />
      <Fail />
    </>
  )
}
