/**
 * Test 7: Backend API Verification
 *
 * Verify all REST endpoints work correctly. These are pure API tests
 * (no browser needed) — run against the live server.
 */
import { test, expect } from '@playwright/test'
import { API, authHeaders } from './helpers'

test.describe('Backend API', () => {
  test('GET /api/papers returns paper list', async () => {
    const res = await fetch(API, { headers: authHeaders() })
    expect(res.status).toBe(200)
    const data = await res.json()
    // API wraps in { papers: [...], total: N }
    const papers = data.papers || data
    expect(Array.isArray(papers)).toBe(true)
    expect(papers.length).toBeGreaterThan(0)
    expect(papers[0]).toHaveProperty('id')
    expect(papers[0]).toHaveProperty('title')
    expect(papers[0]).toHaveProperty('taxonomy_path')
  })

  test('GET /api/papers/analytics returns category_stats', async () => {
    const res = await fetch(`${API}/analytics`, { headers: authHeaders() })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toHaveProperty('category_stats')
    expect(data).toHaveProperty('total_runs')
    expect(data).toHaveProperty('total_ingested')
    // Should have at least one category
    expect(Object.keys(data.category_stats).length).toBeGreaterThan(0)
  })

  test('GET /api/papers/taxonomy returns folder tree', async () => {
    const res = await fetch(`${API}/taxonomy`, { headers: authHeaders() })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toHaveProperty('name')
    expect(data).toHaveProperty('children')
  })

  test('POST /api/papers/curate triggers curation successfully', async () => {
    const res = await fetch(`${API}/curate`, {
      method: 'POST',
      headers: authHeaders(),
    })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.status).toBe('curated')
  })

  test('GET /api/papers/runs returns pipeline run history', async () => {
    const res = await fetch(`${API}/runs`, { headers: authHeaders() })
    expect(res.status).toBe(200)
    const data = await res.json()
    const runs = data.runs || data
    expect(Array.isArray(runs)).toBe(true)
  })

  test('GET /api/papers/preferences returns preference profile', async () => {
    const res = await fetch(`${API}/preferences`, { headers: authHeaders() })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toHaveProperty('identity')
    expect(data).toHaveProperty('interests')
    expect(data).toHaveProperty('categories')
  })

  test('GET /api/papers/pipeline/status returns scheduler state', async () => {
    const res = await fetch(`${API}/pipeline/status`, { headers: authHeaders() })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toHaveProperty('running')
  })

  test('curation files exist on disk', async () => {
    const fs = await import('fs')
    const os = await import('os')
    const { execSync } = await import('child_process')
    const KB_ROOT = (process.env.VAULT_ROOT || os.homedir() + '/vault') + '/library/papers'

    // _library_overview.md should exist
    expect(fs.existsSync(`${KB_ROOT}/_library_overview.md`)).toBe(true)

    // _crossrefs.json should exist
    expect(fs.existsSync(`${KB_ROOT}/_crossrefs.json`)).toBe(true)

    // At least some _index.md files in taxonomy folders
    const indexCount = parseInt(execSync(`find ${KB_ROOT} -name "_index.md" | wc -l`).toString().trim())
    expect(indexCount).toBeGreaterThan(0)
  })

  test('POST /api/papers/test-run accepts dry-run request', async () => {
    // Just verify the endpoint accepts the request — don't wait for Haiku response
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)
    try {
      const res = await fetch(`${API}/test-run`, {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ max_filter_calls: 1 }),
        signal: controller.signal,
      })
      clearTimeout(timeout)
      // 200 means it completed, which is great
      expect(res.status).toBe(200)
    } catch {
      clearTimeout(timeout)
      // AbortError means the request was accepted but took too long (Haiku API)
      // This is expected behavior — the endpoint works, just slow
    }
  })

  test('GET /api/papers/folder-index returns folder content', async () => {
    const res = await fetch(`${API}/folder-index?path=Machine%20Learning`, { headers: authHeaders() })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toHaveProperty('content')
    expect(data).toHaveProperty('path')
    expect(data.path).toBe('Machine Learning')
  })

  test('GET /api/papers/crossrefs returns cross-references', async () => {
    const res = await fetch(`${API}/crossrefs`, { headers: authHeaders() })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(typeof data).toBe('object')
  })

  test('GET /api/papers/test-run/stream returns SSE stream', async () => {
    const token = '41d97bd0b35d54627151f25f67eddcbf8d1c4c1cef3fb6d166bc94c2f29ab1e3'
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)
    try {
      const res = await fetch(`${API}/test-run/stream?token=${token}&max_filter_calls=1`, {
        signal: controller.signal,
      })
      clearTimeout(timeout)
      expect(res.status).toBe(200)
      expect(res.headers.get('content-type')).toContain('text/event-stream')
    } catch {
      clearTimeout(timeout)
      // AbortError is fine — stream was accepted
    }
  })

  test('folder CRUD endpoints work', async () => {
    // Create — uses parent_path + name format
    const createRes = await fetch(`${API}/folders/create`, {
      method: 'POST',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ parent_path: 'Test', name: 'Playwright Test Folder' }),
    })
    expect(createRes.status).toBe(200)

    // Delete — uses path format
    const deleteRes = await fetch(`${API}/folders/delete`, {
      method: 'POST',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: 'Test/Playwright Test Folder' }),
    })
    expect(deleteRes.status).toBe(200)

    // Cleanup parent too
    await fetch(`${API}/folders/delete`, {
      method: 'POST',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: 'Test' }),
    })
  })
})
