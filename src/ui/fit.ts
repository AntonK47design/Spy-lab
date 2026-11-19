/**
 * Auto-fit for `.fit` text: shrink to a minimum scale, then allow wrapping.
 * Keeps long languages (DE, RU) from being clipped.
 */
const MIN_SCALE = 0.7
const MIN_PX = 10

export function fitAll(root: ParentNode = document): void {
  const els = root.querySelectorAll<HTMLElement>('.fit')
  els.forEach((el) => {
    el.style.fontSize = ''
    el.style.whiteSpace = 'nowrap'
    if (el.clientWidth === 0) return
    let scale = 1
    const base = parseFloat(getComputedStyle(el).fontSize)
    while (el.scrollWidth > el.clientWidth + 1 && scale > MIN_SCALE && base * (scale - 0.05) >= MIN_PX) {
      scale -= 0.05
      el.style.fontSize = `${base * scale}px`
    }
    if (el.scrollWidth > el.clientWidth + 1) el.style.whiteSpace = 'normal'
  })
}

let scheduled = false
export function scheduleFit(): void {
  if (scheduled) return
  scheduled = true
  requestAnimationFrame(() => {
    scheduled = false
    fitAll()
  })
}
