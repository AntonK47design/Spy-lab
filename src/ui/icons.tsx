/** Own SVG icon set (no emoji). 24x24 grid, stroke-based, colored via currentColor. */
import type { JSX } from 'preact'

type P = { size?: number | string; class?: string; title?: string }

function Svg({ size = '1em', class: cls, title, children }: P & { children: JSX.Element | JSX.Element[] }) {
  return (
    <svg
      class={`icon ${cls ?? ''}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden={title ? undefined : 'true'}
      role={title ? 'img' : undefined}
    >
      {title ? <title>{title}</title> : <></>}
      {children}
    </svg>
  )
}

export const IconGear = (p: P) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="3.2" />
    <path d="M12 2.5v2.6M12 18.9v2.6M4.6 4.6l1.9 1.9M17.5 17.5l1.9 1.9M2.5 12h2.6M18.9 12h2.6M4.6 19.4l1.9-1.9M17.5 6.5l1.9-1.9" />
    <circle cx="12" cy="12" r="6.6" />
  </Svg>
)

export const IconGlobe = (p: P) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18M12 3c2.8 3 2.8 15 0 18M12 3c-2.8 3-2.8 15 0 18" />
  </Svg>
)

export const IconClose = (p: P) => (
  <Svg {...p}>
    <path d="M6 6l12 12M18 6L6 18" />
  </Svg>
)

export const IconSoundOn = (p: P) => (
  <Svg {...p}>
    <path d="M4 9.5h3.5L12 5v14l-4.5-4.5H4z" />
    <path d="M15.5 9a4 4 0 010 6M18 6.5a7.5 7.5 0 010 11" />
  </Svg>
)

export const IconSoundOff = (p: P) => (
  <Svg {...p}>
    <path d="M4 9.5h3.5L12 5v14l-4.5-4.5H4z" />
    <path d="M16 9.5l5 5M21 9.5l-5 5" />
  </Svg>
)

export const IconMusic = (p: P) => (
  <Svg {...p}>
    <path d="M9 18V6l10-2v12" />
    <circle cx="6.5" cy="18" r="2.5" />
    <circle cx="16.5" cy="16" r="2.5" />
  </Svg>
)

export const IconPause = (p: P) => (
  <Svg {...p}>
    <path d="M8 5v14M16 5v14" />
  </Svg>
)

export const IconPlay = (p: P) => (
  <Svg {...p}>
    <path d="M7 5l12 7-12 7z" />
  </Svg>
)

export const IconMap = (p: P) => (
  <Svg {...p}>
    <path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z" />
    <path d="M9 4v14M15 6v14" />
  </Svg>
)

/** Agent: hat brim + sunglasses */
export const IconAgent = (p: P) => (
  <Svg {...p}>
    <path d="M5 9h14M8 9l1-4h6l1 4" />
    <circle cx="12" cy="14" r="5" />
    <path d="M8.5 13.5h7" />
  </Svg>
)

export const IconGadget = (p: P) => (
  <Svg {...p}>
    <circle cx="10" cy="10" r="5.5" />
    <path d="M14 14l6 6" />
    <path d="M8 10h4M10 8v4" />
  </Svg>
)

export const IconShop = (p: P) => (
  <Svg {...p}>
    <path d="M5 8h14l-1.2 12H6.2z" />
    <path d="M9 8V6a3 3 0 016 0v2" />
  </Svg>
)

export const IconCash = (p: P) => (
  <Svg {...p}>
    <rect x="2.5" y="6" width="19" height="12" rx="2" />
    <circle cx="12" cy="12" r="2.6" />
    <path d="M6 9.5v5M18 9.5v5" />
  </Svg>
)

export const IconIntel = (p: P) => (
  <Svg {...p}>
    <path d="M3 7h6l2 2h10v10H3z" />
    <path d="M8 14h8" />
  </Svg>
)

export const IconBadge = (p: P) => (
  <Svg {...p}>
    <path d="M12 3l2.5 5 5.5.8-4 3.9.9 5.5L12 15.6 7.1 18.2l.9-5.5-4-3.9 5.5-.8z" />
  </Svg>
)

/** Ad marker: screen with play triangle (used on every rewarded button). */
export const IconAd = (p: P) => (
  <Svg {...p}>
    <rect x="2.5" y="5" width="19" height="14" rx="2.5" />
    <path d="M10 9l5 3-5 3z" />
  </Svg>
)

export const IconCheck = (p: P) => (
  <Svg {...p}>
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </Svg>
)

export const IconStar = (p: P & { filled?: boolean }) => (
  <svg class={`icon ${p.class ?? ''}`} width={p.size ?? '1em'} height={p.size ?? '1em'} viewBox="0 0 24 24" aria-hidden="true">
    <path
      d="M12 2.6l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.4l-5.8 3.1 1.1-6.5-4.7-4.6 6.5-.9z"
      fill={p.filled === false ? 'none' : 'currentColor'}
      stroke="currentColor"
      stroke-width="1.6"
      stroke-linejoin="round"
    />
  </svg>
)

export const IconLock = (p: P) => (
  <Svg {...p}>
    <rect x="5" y="10.5" width="14" height="10" rx="2" />
    <path d="M8 10.5V8a4 4 0 018 0v2.5" />
  </Svg>
)

export const IconUp = (p: P) => (
  <Svg {...p}>
    <path d="M12 19V6M6 11.5L12 5.5l6 6" />
  </Svg>
)

export const IconPeople = (p: P) => (
  <Svg {...p}>
    <circle cx="9" cy="8" r="3.2" />
    <path d="M3.5 19.5c.6-3.3 2.8-5 5.5-5s4.9 1.7 5.5 5" />
    <circle cx="16.5" cy="9" r="2.4" />
    <path d="M15.5 14.6c2.6-.3 4.6 1.3 5 4.4" />
  </Svg>
)

export const IconSpeed = (p: P) => (
  <Svg {...p}>
    <path d="M4.5 16a8 8 0 1115 0" />
    <path d="M12 16l4-5" />
  </Svg>
)

export const IconWhistle = (p: P) => (
  <Svg {...p}>
    <circle cx="9" cy="14" r="5" />
    <path d="M13 11.5L21 8v4l-6.2 1.3" />
    <path d="M6 6.5l1.5 2M10 5l.5 2.5" />
  </Svg>
)

export const IconRetry = (p: P) => (
  <Svg {...p}>
    <path d="M4 12a8 8 0 1 0 2.4-5.7" />
    <path d="M4 4.5v4h4" />
  </Svg>
)

export const IconHome = (p: P) => (
  <Svg {...p}>
    <path d="M4 11l8-6.5 8 6.5" />
    <path d="M6.5 9.5V19h11V9.5" />
  </Svg>
)

export const IconTimer = (p: P) => (
  <Svg {...p}>
    <circle cx="12" cy="13.5" r="7" />
    <path d="M12 13.5V9.5M9.5 3.5h5" />
  </Svg>
)

export const IconBolt = (p: P) => (
  <Svg {...p}>
    <rect x="3" y="9" width="18" height="6" rx="1.5" />
    <path d="M7 9v6M17 9v6" />
  </Svg>
)

/** Ghost hand for the play-tutorial (no text). */
export const IconHand = (p: P) => (
  <svg class={`icon ${p.class ?? ''}`} width={p.size ?? '1em'} height={p.size ?? '1em'} viewBox="0 0 24 24" aria-hidden="true">
    <path
      d="M9 11V4.6a1.6 1.6 0 013.2 0V10l.1-1.4a1.6 1.6 0 013.2.2v1.6a1.6 1.6 0 013.1.4v4.3c0 3.6-2.5 6.4-6 6.4h-1.1c-1.9 0-3.4-.9-4.5-2.4L4 15a1.6 1.6 0 012.4-2.1L9 15"
      fill="#fff3e0"
      stroke="#2b2220"
      stroke-width="1.5"
      stroke-linejoin="round"
    />
  </svg>
)

/** Agent Marmalade: retired top spy with sunglasses + apron. */
export const AvatarMarmalade = (p: P) => (
  <svg class={`icon ${p.class ?? ''}`} width={p.size ?? '1em'} height={p.size ?? '1em'} viewBox="0 0 48 48" aria-hidden="true">
    <circle cx="24" cy="24" r="23" fill="#f2b134" />
    <circle cx="24" cy="12" r="7" fill="#c0c6d0" />
    <ellipse cx="24" cy="25" rx="12" ry="13" fill="#f1c27d" />
    <path d="M12 21c2-7 22-7 24 0-4-3-20-3-24 0z" fill="#c0c6d0" />
    <rect x="13" y="22" width="9.5" height="5" rx="2" fill="#14141c" />
    <rect x="25.5" y="22" width="9.5" height="5" rx="2" fill="#14141c" />
    <path d="M22.5 24h3" stroke="#14141c" stroke-width="1.5" />
    <path d="M19 32c3 2.5 7 2.5 10 0" stroke="#8a3b1f" stroke-width="1.8" fill="none" stroke-linecap="round" />
    <path d="M13 44c1-6 5-8 11-8s10 2 11 8z" fill="#f7c6d0" />
    <path d="M19 40h10v5H19z" fill="#fff3e0" />
  </svg>
)

/** The director (player) avatar for the level ring. */
export const AvatarDirector = (p: P) => (
  <svg class={`icon ${p.class ?? ''}`} width={p.size ?? '1em'} height={p.size ?? '1em'} viewBox="0 0 48 48" aria-hidden="true">
    <circle cx="24" cy="24" r="23" fill="#2a7a87" />
    <ellipse cx="24" cy="27" rx="11" ry="12" fill="#f1c27d" />
    <path d="M10 18h28l-3 2H13z" fill="#22283a" />
    <path d="M15 18l2-9h14l2 9z" fill="#22283a" />
    <path d="M16 15h16v2.5H16z" fill="#f2665c" />
    <rect x="14" y="24" width="9" height="4.5" rx="2" fill="#14141c" />
    <rect x="25" y="24" width="9" height="4.5" rx="2" fill="#14141c" />
    <path d="M20 34c2.5 1.8 5.5 1.8 8 0" stroke="#8a3b1f" stroke-width="1.8" fill="none" stroke-linecap="round" />
    <path d="M12 46c1-5 5-7 12-7s11 2 12 7z" fill="#22304f" />
  </svg>
)

export const IconHat = (p: P) => (
  <Svg {...p}>
    <path d="M7 15V9.5C7 7.6 9.2 6 12 6s5 1.6 5 3.5V15" />
    <path d="M3 15.5c2.5 1.6 15.5 1.6 18 0" />
    <path d="M7 12.5h10" />
  </Svg>
)
export const IconGlasses = (p: P) => (
  <Svg {...p}>
    <rect x="2.5" y="9" width="8" height="6" rx="2.5" />
    <rect x="13.5" y="9" width="8" height="6" rx="2.5" />
    <path d="M10.5 11h3" />
  </Svg>
)
export const IconBag = (p: P) => (
  <Svg {...p}>
    <rect x="3" y="8" width="18" height="12" rx="2" />
    <path d="M9 8V5.5h6V8M3 13h18" />
  </Svg>
)
export const IconCoat = (p: P) => (
  <Svg {...p}>
    <path d="M8 3l4 4 4-4 4 3-2 5h-2v10H8V11H6L4 6z" />
    <path d="M12 7v14" />
  </Svg>
)
export const IconEye = (p: P) => (
  <Svg {...p}>
    <path d="M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12z" />
    <circle cx="12" cy="12" r="3" />
  </Svg>
)
export const IconArrowLeft = (p: P) => (
  <Svg {...p}>
    <path d="M15 5l-7 7 7 7" />
  </Svg>
)
export const IconArrowRight = (p: P) => (
  <Svg {...p}>
    <path d="M9 5l7 7-7 7" />
  </Svg>
)
export const IconBulb = (p: P) => (
  <Svg {...p}>
    <path d="M9 18h6M10 21h4" />
    <path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2V16h5v-.1c0-.8.4-1.5 1-2A6 6 0 0 0 12 3z" />
  </Svg>
)
export const IconAlert = (p: P) => (
  <Svg {...p}>
    <path d="M12 3l9.5 17h-19z" />
    <path d="M12 10v4.5M12 17.5v.5" />
  </Svg>
)
export const IconField = (p: P) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 3.5v3M12 17.5v3M3.5 12h3M17.5 12h3" />
    <circle cx="12" cy="12" r="2.2" />
  </Svg>
)
export const IconCalendar = (p: P) => (
  <Svg {...p}>
    <rect x="3.5" y="5" width="17" height="15" rx="2.5" />
    <path d="M3.5 10h17M8 3v4M16 3v4" />
    <path d="M9 14.5l2 2 4-4" />
  </Svg>
)
