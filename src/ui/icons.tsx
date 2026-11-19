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
