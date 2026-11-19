/**
 * Big-number formatting: 999, 1.2K, 3.4M, 5.6B, 7.8T, then aa, ab, ... az, ba, ...
 * Decimal separator follows the active locale.
 */
const SHORT = ['', 'K', 'M', 'B', 'T']

function suffixFor(tier: number): string {
  if (tier < SHORT.length) return SHORT[tier] as string
  const n = tier - SHORT.length // 0 -> aa
  const first = String.fromCharCode(97 + Math.floor(n / 26))
  const second = String.fromCharCode(97 + (n % 26))
  return first + second
}

const formatters = new Map<string, Intl.NumberFormat>()
function nf(locale: string, digits: number): Intl.NumberFormat {
  const key = locale + digits
  let f = formatters.get(key)
  if (!f) {
    f = new Intl.NumberFormat(locale, { minimumFractionDigits: 0, maximumFractionDigits: digits })
    formatters.set(key, f)
  }
  return f
}

export function formatNumber(value: number, locale = 'en'): string {
  if (!Number.isFinite(value)) return '∞'
  const sign = value < 0 ? '-' : ''
  let v = Math.abs(value)
  if (v < 1000) return sign + nf(locale, 0).format(Math.floor(v))
  let tier = 0
  while (v >= 1000 && tier < 4 + 26 * 26) {
    v /= 1000
    tier++
  }
  // 1.23K / 12.3K / 123K
  const digits = v < 10 ? 2 : v < 100 ? 1 : 0
  const factor = 10 ** digits
  v = Math.floor(v * factor) / factor
  return sign + nf(locale, digits).format(v) + suffixFor(tier)
}

export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`
}
