import { test, expect, type Page } from '@playwright/test'
import { boot, expectClean, goTo, park, solveSafe, spy, startFirstMission, watch } from './helpers'
import { SIZES, assertLayout } from './layout'

const HUD = '[data-testid^="hud-"], [data-testid^="bar-"], [data-testid="coach"]'

async function shot(page: Page, lang: string, name: string, screen: string, w: number, h: number) {
  if (lang === 'en') await page.screenshot({ path: `tests/screenshots/${screen}-${name}-${w}x${h}.png` })
}

for (const lang of ['en', 'de', 'ru']) {
  for (const [name, w, h] of SIZES) {
    test(`${lang} ${name} ${w}x${h}`, async ({ page }) => {
      test.setTimeout(w > 2000 ? 600_000 : 240_000)
      const wt = watch(page)
      await page.setViewportSize({ width: w, height: h })
      // the software renderer of the test machine is very slow at QHD: low quality keeps the run in time
      await boot(page, '', lang === 'en' && w < 2000 ? 'auto' : 'low')
      if (lang !== 'en') {
        await page.getByTestId('bar-settings').click()
        await page.getByTestId(`lang-${lang}`).click()
        await page.getByTestId('btn-close').click()
      }
      await page.waitForTimeout(700)
      await assertLayout(page, w, h, HUD)
      await shot(page, lang, name, 'academy', w, h)

      await page.getByTestId('bar-settings').click()
      await page.waitForTimeout(250)
      await expect(page.getByTestId('panel-settings').getByTestId('btn-close')).toBeInViewport({ ratio: 0.99 })
      await assertLayout(page, w, h, '[data-testid="panel-settings"]')
      await shot(page, lang, name, 'settings', w, h)
      await page.getByTestId('btn-close').click()

      await spy(page, 'quickStart') // the office desk exists once a station is built
      await spy(page, 'addCurrency', 'cash', 50)
      await goTo(page, 'upgrade', 'vault')
      await expect(page.getByTestId('panel-upgrade')).toBeVisible()
      await page.waitForTimeout(250)
      await expect(page.getByTestId('panel-upgrade').getByTestId('btn-close')).toBeInViewport({ ratio: 0.99 })
      await assertLayout(page, w, h, '[data-testid="panel-upgrade"]')
      await shot(page, lang, name, 'upgrade', w, h)
      await page.getByTestId('btn-close').click()

      await startFirstMission(page)
      await page.waitForTimeout(400)
      await assertLayout(page, w, h, '[data-testid="btn-mg-pause"], [data-testid="btn-mg-tap"]')
      await shot(page, lang, name, 'safe', w, h)
      await solveSafe(page)
      await expect(page.getByTestId('panel-result')).toBeVisible()
      await page.waitForTimeout(600)
      await assertLayout(page, w, h, '[data-testid="panel-result"]')
      await shot(page, lang, name, 'result', w, h)
      await page.getByTestId('btn-continue').click()

      await park(page)
      await page.getByTestId('bar-map').click()
      await page.waitForTimeout(250)
      await assertLayout(page, w, h, '[data-testid="panel-missions"]')
      await shot(page, lang, name, 'missions', w, h)
      expectClean(wt)
    })
  }
}
