/**
 * Test 1: Home Screen & Widget Visibility
 *
 * As a researcher, when I open the dashboard I should see the Paper Discovery
 * widget on my home screen showing a quick overview of my knowledge base.
 */
import { test, expect } from '@playwright/test'
import { goHome, openPaperWidget } from './helpers'

test.describe('Home screen & widget', () => {
  test('compact widget visible on home screen with paper count', async ({ page }) => {
    await goHome(page)
    await page.screenshot({ path: 'e2e/test-results/01-home-screen.png' })

    // Widget should show "Research KB" title
    const widget = page.getByText('Research KB')
    await expect(widget.first()).toBeVisible({ timeout: 10_000 })

    // Should show paper count or "new today" indicator
    const paperInfo = page.getByText(/\d+\s*(papers|total|new)/)
    await expect(paperInfo.first()).toBeVisible({ timeout: 5_000 })
  })

  test('clicking widget opens detail view with tabs', async ({ page }) => {
    await openPaperWidget(page)
    await page.screenshot({ path: 'e2e/test-results/01-detail-view.png' })

    // Detail view should have the 4 main tabs
    await expect(page.getByText('Library').first()).toBeVisible()
    await expect(page.getByText('Feed').first()).toBeVisible()
    await expect(page.getByText('Pipeline').first()).toBeVisible()
  })
})
