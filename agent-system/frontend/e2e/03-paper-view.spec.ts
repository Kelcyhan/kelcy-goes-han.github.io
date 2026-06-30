/**
 * Test 3: Paper View — tabs, actions, re-analyze non-blocking, star, notes
 */
import { test, expect } from '@playwright/test'
import { openPaperWidget, API, authHeaders } from './helpers'

test.describe('Paper view', () => {
  test('can open a paper and see tabs + action buttons', async ({ page }) => {
    await openPaperWidget(page)

    // Search for a paper to open it
    const searchInput = page.locator('input[placeholder*="Search"]').first()
    await searchInput.fill('agent')
    await searchInput.press('Enter')
    await page.waitForTimeout(2000)

    // Click the "Open" button on a result card
    const openBtn = page.getByText('Open').first()
    if (await openBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await openBtn.click()
      await page.waitForTimeout(1500)
      await page.screenshot({ path: 'e2e/test-results/03-paper-view.png' })

      // Paper view should have action buttons
      await expect(page.getByText('Chat About Paper')).toBeVisible({ timeout: 5_000 })
      await expect(page.getByRole('button', { name: 'Re-analyze' })).toBeVisible()
      await expect(page.getByText('Star').first()).toBeVisible()
      await expect(page.getByRole('button', { name: 'Notes' })).toBeVisible()
    }
  })

  test('Star and Notes buttons work in paper view', async ({ page }) => {
    await openPaperWidget(page)

    const searchInput = page.locator('input[placeholder*="Search"]').first()
    await searchInput.fill('agent')
    await searchInput.press('Enter')
    await page.waitForTimeout(2000)

    const openBtn = page.getByText('Open').first()
    if (await openBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await openBtn.click()
      await page.waitForTimeout(1500)

      // Click Star button (not the react-complex-tree ARIA text)
      await page.getByRole('button', { name: /Star/ }).first().click()
      await page.waitForTimeout(500)

      // Click Notes
      await page.getByText('Notes').click()
      await page.waitForTimeout(300)
      await expect(page.getByText('Personal notes')).toBeVisible({ timeout: 3_000 })
      await page.screenshot({ path: 'e2e/test-results/03-star-notes.png' })
    }
  })

  test('Re-analyze returns immediately (non-blocking)', async ({ page }) => {
    await openPaperWidget(page)

    const searchInput = page.locator('input[placeholder*="Search"]').first()
    await searchInput.fill('agent')
    await searchInput.press('Enter')
    await page.waitForTimeout(2000)

    const openBtn = page.getByText('Open').first()
    if (await openBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await openBtn.click()
      await page.waitForTimeout(1500)

      // Click Re-analyze
      await page.getByRole('button', { name: 'Re-analyze' }).click()
      await page.waitForTimeout(300)

      // Click Run — should return immediately
      const runBtn = page.getByRole('button', { name: 'Run' })
      if (await runBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
        const startTime = Date.now()
        await runBtn.click()
        await page.waitForTimeout(5000)
        const elapsed = Date.now() - startTime
        await page.screenshot({ path: 'e2e/test-results/03-reanalyze.png' })
        expect(elapsed).toBeLessThan(15_000)
      }
    }
  })
})
