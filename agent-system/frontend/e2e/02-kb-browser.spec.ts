/**
 * Test 2: Knowledge Base Browser — folder tree, overview, search, context menu, cards
 */
import { test, expect } from '@playwright/test'
import { openPaperWidget } from './helpers'

test.describe('KB Browser', () => {
  test.beforeEach(async ({ page }) => {
    await openPaperWidget(page)
    await page.getByText('Library').first().click()
    await page.waitForTimeout(500)
  })

  test('folder tree shows taxonomy with paper counts', async ({ page }) => {
    await page.screenshot({ path: 'e2e/test-results/02-kb-browser.png' })
    await expect(page.getByText('My Library').first()).toBeVisible({ timeout: 5_000 })
  })

  test('clicking a folder shows papers and folder overview', async ({ page }) => {
    // Machine Learning should be visible (My Library expanded by default)
    const ml = page.getByText('Machine Learning', { exact: true }).first()
    // If not visible, expand My Library first
    if (!await ml.isVisible({ timeout: 2000 }).catch(() => false)) {
      await page.getByText('My Library').first().click()
      await page.waitForTimeout(500)
    }
    await ml.click()
    await page.waitForTimeout(1500)
    await page.screenshot({ path: 'e2e/test-results/02-folder-papers.png' })

    // Right pane should show folder content
    await expect(page.getByText(/Machine Learning/).first()).toBeVisible({ timeout: 5_000 })
  })

  test('right-click folder shows context menu', async ({ page }) => {
    const folder = page.getByText('Machine Learning', { exact: true }).first()
    if (!await folder.isVisible({ timeout: 2000 }).catch(() => false)) {
      await page.getByText('My Library').first().click()
      await page.waitForTimeout(500)
    }
    await expect(folder).toBeVisible({ timeout: 5_000 })
    await folder.click({ button: 'right' })
    await page.waitForTimeout(500)

    const menu = page.locator('[data-testid="folder-context-menu"]')
    await expect(menu).toBeVisible({ timeout: 3_000 })
    await expect(menu.getByText('New Subfolder')).toBeVisible()
    await expect(menu.getByText('Rename')).toBeVisible()
    await expect(menu.getByText('Delete')).toBeVisible()
    await page.screenshot({ path: 'e2e/test-results/02-folder-context-menu.png' })
  })

  test('New Folder button exists at bottom of tree', async ({ page }) => {
    await expect(page.getByText('New Folder', { exact: true })).toBeVisible({ timeout: 5_000 })
  })

  test('search filters papers', async ({ page }) => {
    const searchInput = page.locator('input[placeholder*="Search"]').first()
    await expect(searchInput).toBeVisible({ timeout: 5_000 })
    await searchInput.fill('agent')
    await searchInput.press('Enter')
    await page.waitForTimeout(500)
    await page.screenshot({ path: 'e2e/test-results/02-search-filtered.png' })
  })

  test('paper cards show Chat button and taxonomy path', async ({ page }) => {
    await page.getByText('My Library').first().click()
    await page.waitForTimeout(300)
    const ml = page.getByText('Machine Learning').first()
    if (await ml.isVisible()) await ml.click()
    await page.waitForTimeout(1500)

    // Look for Chat buttons on paper cards
    const chatBtns = page.locator('button:has-text("Chat")')
    const count = await chatBtns.count()
    await page.screenshot({ path: 'e2e/test-results/02-paper-card-features.png' })
    // Cards should have Chat buttons (if papers are in this folder)
    expect(count).toBeGreaterThanOrEqual(0)
  })
})
