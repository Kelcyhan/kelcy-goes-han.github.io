import { Page, expect } from '@playwright/test'

const TOKEN = process.env.DASHBOARD_TOKEN || '41d97bd0b35d54627151f25f67eddcbf8d1c4c1cef3fb6d166bc94c2f29ab1e3'
export const BASE = `http://localhost:8420`
export const API = BASE + '/api/papers'

export function authHeaders() {
  return { Authorization: `Bearer ${TOKEN}` }
}

/** Navigate to dashboard home with auth token */
export async function goHome(page: Page) {
  await page.goto(`${BASE}/?token=${TOKEN}`)
  await page.waitForLoadState('networkidle')
}

/** Click into the Paper Discovery widget from the home screen */
export async function openPaperWidget(page: Page) {
  await goHome(page)
  // The widget should be visible on home screen — click it to open detail view
  const widget = page.locator('[data-widget-id="paper-discovery"]').or(page.getByText('Research KB'))
  await expect(widget.first()).toBeVisible({ timeout: 10_000 })
  await widget.first().click()
  // Wait for detail view to load
  await page.waitForTimeout(1000)
}

/** API helper: fetch JSON with auth */
export async function apiFetch(path: string, options: RequestInit = {}) {
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: { ...authHeaders(), ...options.headers },
  })
  return res
}
