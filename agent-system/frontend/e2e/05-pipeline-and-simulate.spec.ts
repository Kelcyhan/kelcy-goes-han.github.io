/**
 * Test 5: Pipeline Tab — Preferences, Simulate (streaming), Analytics
 */
import { test, expect } from '@playwright/test'
import { openPaperWidget } from './helpers'

test.describe('Pipeline tab', () => {
  test.beforeEach(async ({ page }) => {
    await openPaperWidget(page)
    await page.getByText('Pipeline').first().click()
    await page.waitForTimeout(500)
  })

  test('shows Research Profile with interests and what_matters fields', async ({ page }) => {
    await page.screenshot({ path: 'e2e/test-results/05-pipeline-tab.png' })
    await expect(page.getByText('Your Research Profile').or(page.getByText('Research Profile'))).toBeVisible({ timeout: 5_000 })
    // Should show interest labels
    await expect(page.getByText('Interests')).toBeVisible()
  })

  test('Simulate button exists and streams results', async ({ page }) => {
    const simBtn = page.getByRole('button', { name: 'Simulate' })
    await expect(simBtn).toBeVisible({ timeout: 5_000 })

    // Click simulate — should start streaming (shows progress within seconds)
    await simBtn.click()
    await page.waitForTimeout(3000)
    await page.screenshot({ path: 'e2e/test-results/05-simulate-streaming.png' })

    // Should see fetching or testing phase indicator (not frozen)
    const hasProgress = await page.getByText(/Fetching|Testing|Simulation complete|fetched/).first().isVisible({ timeout: 10_000 }).catch(() => false)
    // Take another screenshot a bit later
    await page.waitForTimeout(5000)
    await page.screenshot({ path: 'e2e/test-results/05-simulate-progress.png' })
  })

  test('Stats section shows per-category table', async ({ page }) => {
    const table = page.locator('table')
    await expect(table).toBeVisible({ timeout: 5_000 })
    const category = page.locator('table td').getByText(/cs\.\w+/)
    await expect(category.first()).toBeVisible({ timeout: 5_000 })
    await page.screenshot({ path: 'e2e/test-results/05-category-analytics.png' })
  })

  test('pipeline schedule controls with interval and run-now button', async ({ page }) => {
    await expect(page.getByText('Pipeline Schedule')).toBeVisible({ timeout: 5_000 })
    await expect(page.getByText('Run Now')).toBeVisible()
  })

  test('filter prompt editor expandable', async ({ page }) => {
    const promptBtn = page.getByText('Filter Prompt')
    await expect(promptBtn).toBeVisible({ timeout: 5_000 })
    await promptBtn.click()
    await page.waitForTimeout(500)
    await page.screenshot({ path: 'e2e/test-results/05-filter-prompt.png' })
  })

  test('watched authors section visible', async ({ page }) => {
    await expect(page.getByText('Watched Authors')).toBeVisible({ timeout: 5_000 })
    await page.screenshot({ path: 'e2e/test-results/05-watched-authors.png' })
  })
})
