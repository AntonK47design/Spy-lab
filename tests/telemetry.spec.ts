import { test, expect, type Page } from '@playwright/test'
import { boot, solveSafe, spy, startFirstMission } from './helpers'

/** The (mock) Bridge logs every analytics.send(name, data) to the console: read the events from there. */
const log = new WeakMap<Page, { name: string; data: any }[]>()
async function capture(page: Page): Promise<void> {
  const list: { name: string; data: any }[] = []
  log.set(page, list)
  page.on('console', async (m) => {
    if (!m.text().includes('[analytics] send()')) return
    const args = await Promise.all(m.args().map((a) => a.jsonValue().catch(() => null)))
    const i = args.findIndex((a) => typeof a === 'string' && a.includes('[analytics] send()'))
    // [format, css, css, name, data]
    list.push({ name: String(args[i + 3]), data: args[i + 4] ?? {} })
  })
}
const sent = async (page: Page) => log.get(page) ?? []

test('performance_sample: contract fields, sent when the tab is hidden after >= 5 s of play', async ({ page }) => {
  await capture(page)
  await boot(page)
  await page.waitForTimeout(6500)
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true })
    document.dispatchEvent(new Event('visibilitychange'))
  })
  await expect.poll(async () => (await sent(page)).filter((e) => e.name === 'performance_sample').length).toBe(1)
  const s = (await sent(page)).find((e) => e.name === 'performance_sample')!.data
  for (const k of [
    'target_fps', 'window_ms', 'active_ms', 'frame_count', 'fps_avg', 'fps_p10', 'frame_time_p50_ms', 'frame_time_p95_ms',
    'frame_time_p99_ms', 'frame_time_max_ms', 'frames_over_50ms', 'frames_over_100ms', 'frames_over_250ms', 'frames_over_500ms',
    'frames_over_1000ms', 'build_version', 'js_error_count', 'unhandled_rejection_count', 'webgl_context_loss_count',
    'asset_load_error_count', 'scene', 'quality_tier', 'device_type', 'draw_calls_avg',
  ]) expect(s, k).toHaveProperty(k)
  expect(s.target_fps).toBe(60)
  expect(s.active_ms).toBeGreaterThanOrEqual(5000)
  expect(s.frame_count).toBeGreaterThan(5)
  expect(s.scene).toBe('academy')
  expect(s.draw_calls_avg).toBeGreaterThan(0)
  expect(s.js_error_count).toBe(0)
})

test('product events: milestone funnel and rewarded offer impressions per placement', async ({ page }) => {
  test.setTimeout(120_000)
  await capture(page)
  await boot(page)
  await startFirstMission(page) // grants an agent
  await solveSafe(page)
  await expect(page.getByTestId('panel-result')).toBeVisible({ timeout: 10_000 })
  await page.getByTestId('btn-double-free').click() // the free demo: next time it is an ad offer
  await page.getByTestId('btn-continue').click()
  await expect.poll(async () => (await sent(page)).filter((e) => e.name === 'milestone_reached').map((e) => e.data.milestone_id))
    .toEqual(expect.arrayContaining(['first_agent_hired', 'first_mission_won']))
  // each milestone once
  const ms = (await sent(page)).filter((e) => e.name === 'milestone_reached')
  expect(new Set(ms.map((e) => e.data.milestone_id)).size).toBe(ms.length)
  // second mission: the x2 offer after the free demo is an impression of mission_double
  await spy(page, 'teleport', 0, 4.6)
  await page.getByTestId('bar-map').click()
  await page.getByTestId('mission-harbor_01').click()
  await page.getByTestId('btn-start-mission').click()
  await solveSafe(page)
  await expect(page.getByTestId('panel-result')).toBeVisible({ timeout: 10_000 })
  await expect.poll(async () => (await sent(page)).filter((e) => e.name === 'rewarded_offer_shown').map((e) => e.data.placement))
    .toContain('mission_double')
})
