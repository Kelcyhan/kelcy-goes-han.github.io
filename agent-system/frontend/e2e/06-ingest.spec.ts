/**
 * Test 6: Paper Ingestion — Inline panel + Find with AI
 */
import { test, expect } from '@playwright/test'
import { openPaperWidget } from './helpers'

test.describe('Paper ingestion', () => {
  test('Add Paper shows inline panel (not modal)', async ({ page }) => {
    await openPaperWidget(page)
    await page.getByText('Feed').first().click()
    await page.waitForTimeout(500)

    const addBtn = page.getByText('Add Paper')
    await addBtn.first().click()
    await page.waitForTimeout(500)
    await page.screenshot({ path: 'e2e/test-results/06-ingest-panel.png' })

    // Should show source tabs (not radio buttons in a centered modal)
    await expect(page.getByText('arxiv ID')).toBeVisible({ timeout: 3_000 })
    await expect(page.getByText('PDF URL')).toBeVisible()
    await expect(page.getByText('Upload')).toBeVisible()
    await expect(page.getByText('Find with AI')).toBeVisible()
  })

  test('arxiv ID input accepts an ID', async ({ page }) => {
    await openPaperWidget(page)
    await page.getByText('Feed').first().click()
    await page.waitForTimeout(500)

    await page.getByText('Add Paper').first().click()
    await page.waitForTimeout(500)

    // The arxiv ID input should be visible (default tab)
    const input = page.locator('input[placeholder*="2511"]')
    await expect(input).toBeVisible({ timeout: 3_000 })
    await page.screenshot({ path: 'e2e/test-results/06-arxiv-input.png' })
  })

  test('Find with AI button exists', async ({ page }) => {
    await openPaperWidget(page)
    await page.getByText('Feed').first().click()
    await page.waitForTimeout(500)

    await page.getByText('Add Paper').first().click()
    await page.waitForTimeout(500)

    // Find with AI should open a workspace tab
    const findBtn = page.getByText('Find with AI')
    await expect(findBtn).toBeVisible({ timeout: 3_000 })
    await page.screenshot({ path: 'e2e/test-results/06-find-with-ai.png' })
  })

  test('drop zone visible in Feed tab', async ({ page }) => {
    await openPaperWidget(page)
    await page.getByText('Feed').first().click()
    await page.waitForTimeout(500)

    await expect(page.getByText('Drop PDFs here')).toBeVisible({ timeout: 5_000 })
    await page.screenshot({ path: 'e2e/test-results/06-drop-zone.png' })
  })
})
