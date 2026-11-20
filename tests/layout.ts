/** Shared layout checks + screen sizes for the matrix tests. */
import { expect, type Page } from '@playwright/test'

export const SIZES: [string, number, number][] = [
  ['phone-s', 360, 640],
  ['phone-m', 390, 844],
  ['phone-l', 430, 932],
  ['phone-land', 844, 390],
  ['phone-land-2', 915, 412],
  ['tablet-p', 768, 1024],
  ['tablet-l', 1024, 768],
  ['square', 640, 640],
  ['wide-s', 800, 450],
  ['hd', 1280, 720],
  ['laptop', 1366, 768],
  ['fhd', 1920, 1080],
  ['qhd', 2560, 1440],
  ['tall-9x21', 360, 840],
  ['ultrawide-21x9', 1680, 720],
]

type R = { id: string; x: number; y: number; w: number; h: number }

async function rects(page: Page, selector: string): Promise<R[]> {
  return page.$$eval(selector, (els) =>
    els.map((e) => {
      const r = e.getBoundingClientRect()
      return { id: (e as HTMLElement).dataset.testid ?? e.className, x: r.x, y: r.y, w: r.width, h: r.height }
    }),
  )
}

function overlap(a: R, b: R): boolean {
  return a.x < b.x + b.w - 0.5 && b.x < a.x + a.w - 0.5 && a.y < b.y + b.h - 0.5 && b.y < a.y + a.h - 0.5
}

export async function assertLayout(page: Page, w: number, h: number, selector: string) {
  const scroll = await page.evaluate(() => ({
    sw: document.documentElement.scrollWidth,
    sh: document.documentElement.scrollHeight,
    iw: innerWidth,
    ih: innerHeight,
  }))
  expect(scroll.sw).toBeLessThanOrEqual(scroll.iw)
  expect(scroll.sh).toBeLessThanOrEqual(scroll.ih)
  const rs = await rects(page, selector)
  for (const r of rs) {
    expect(r.x, `${r.id} left`).toBeGreaterThanOrEqual(0)
    expect(r.y, `${r.id} top`).toBeGreaterThanOrEqual(0)
    expect(r.x + r.w, `${r.id} right`).toBeLessThanOrEqual(w + 0.5)
    expect(r.y + r.h, `${r.id} bottom`).toBeLessThanOrEqual(h + 0.5)
  }
  for (let i = 0; i < rs.length; i++)
    for (let j = i + 1; j < rs.length; j++)
      expect(overlap(rs[i]!, rs[j]!), `${rs[i]!.id} overlaps ${rs[j]!.id}`).toBe(false)
  // text clipped? (scrollWidth > clientWidth on any visible text element)
  const clipped = await page.$$eval(`${selector}, ${selector} *`, (els) =>
    els
      .filter((e) => e instanceof HTMLElement && e.children.length === 0 && e.textContent?.trim())
      .filter((e) => (e as HTMLElement).scrollWidth > (e as HTMLElement).clientWidth + 1)
      .map((e) => e.textContent),
  )
  expect(clipped, `clipped text: ${clipped.join(' | ')}`).toEqual([])
  const minFont = await page.$$eval(`${selector} *`, (els) =>
    Math.min(...els.filter((e) => e.textContent?.trim()).map((e) => parseFloat(getComputedStyle(e).fontSize))),
  )
  expect(minFont).toBeGreaterThanOrEqual(10)
}

