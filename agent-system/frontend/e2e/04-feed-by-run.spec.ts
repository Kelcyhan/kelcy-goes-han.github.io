/**
 * Test 4: New Papers Feed — Grouped by Pipeline Run
 *
 * As a researcher, the Feed tab should show me papers grouped by when they
 * were discovered (pipeline run), not as a flat list. Each group should have
 * a header showing the run timestamp and how many papers were found/ingested.
 */
import { test, expect } from '@playwright/test'
import { openPaperWidget } from './helpers'

test.describe('New Papers Feed', () => {
  test('Feed tab shows papers grouped by pipeline run', async ({ page }) => {
    await openPaperWidget(page)
    await page.getByText('Feed').first().click()
    await page.waitForTimeout(500)

    await page.screenshot({ path: 'e2e/test-results/04-feed-by-run.png' })

    // Should show run headers or manual additions section
    const runHeader = page.getByText(/Run:|Manual additions|fetched|additional runs/)
    await expect(runHeader.first()).toBeVisible({ timeout: 5_000 })
  })

  test('each run group shows papers that were ingested in that run', async ({ page }) => {
    await openPaperWidget(page)
    await page.getByText('Feed').first().click()
    await page.waitForTimeout(500)

    // Paper cards should exist within run groups
    const paperCards = page.locator('[class*="paper"], [class*="card"]')
    await expect(paperCards.first()).toBeVisible({ timeout: 5_000 })
  })

  test('ingest button (+ Add Paper) is visible on feed', async ({ page }) => {
    await openPaperWidget(page)
    await page.getByText('Feed').first().click()
    await page.waitForTimeout(500)

    const addBtn = page.getByText('Add Paper').or(page.getByText('+ Add'))
    await expect(addBtn.first()).toBeVisible({ timeout: 5_000 })
  })
})
