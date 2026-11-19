import type { ComponentChildren, JSX } from 'preact'
import { t } from '../i18n/i18n'
import { AudioManager } from '../audio/AudioManager'
import { rewardedSupported, rewardedBusy } from '../platform/ads'
import { IconAd, IconClose, IconStar } from './icons'

export function click(): void {
  AudioManager.play('ui_click')
}

export function Folder(props: {
  title: string
  testid: string
  onClose: () => void
  children: ComponentChildren
  tab?: string
  wide?: boolean
}) {
  return (
    <div class="modal-backdrop" onPointerDown={(e) => e.target === e.currentTarget && props.onClose()}>
      <section class={`folder ${props.wide ? 'wide' : ''}`} role="dialog" aria-label={props.title} data-testid={props.testid}>
        <div class="folder-tab typewriter">{props.tab ?? t('stamp.classified')}</div>
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

/** Rewarded opt-in button: ad icon + reward text. Hidden when rewarded ads are unsupported. */
export function AdButton(props: { label: string; onClick: () => void; testid: string; class?: string }) {
  if (!rewardedSupported()) return null
  return (
    <button
      class={`btn-ad ${props.class ?? ''}`}
      data-testid={props.testid}
      disabled={rewardedBusy.value}
      onClick={() => {
        click()
        props.onClick()
      }}
    >
      <IconAd class="ad-icon" />
      <span class="fit">{props.label}</span>
    </button>
  )
}

export function Stars(props: { n: number; size?: string; stamp?: boolean }) {
  return (
    <div class={`stars ${props.stamp ? 'stamp-in' : ''}`} aria-label={`${props.n}/3`}>
      {[1, 2, 3].map((i) => (
        <span class={`star ${i <= props.n ? 'on' : 'off'}`} style={props.stamp ? { animationDelay: `${i * 0.18}s` } : undefined}>
          <IconStar size={props.size ?? '1.4em'} filled={i <= props.n} />
        </span>
      ))}
    </div>
  )
}

export function Btn(props: {
  onClick: () => void
  testid: string
  children: ComponentChildren
  kind?: 'primary' | 'secondary' | 'buy'
  disabled?: boolean
  icon?: JSX.Element
}) {
  return (
    <button
      class={`btn btn-${props.kind ?? 'primary'}`}
      data-testid={props.testid}
      disabled={props.disabled}
      onClick={() => {
        click()
        props.onClick()
      }}
    >
      {props.icon}
      <span class="fit">{props.children}</span>
    </button>
  )
}
