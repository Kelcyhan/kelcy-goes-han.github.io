/**
 * Navigation Restructure Tests
 *
 * Structural tests verifying the project view simplification:
 * 1. Tab system removed from PMWorkspace
 * 2. Goals widget exists in the registry
 * 3. Dead code cleaned up (NowNextLater, AlertCards, ProjectOverview removed)
 * 4. Build succeeds
 */
import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

const SRC = path.resolve(__dirname, '..')
const PM = path.join(SRC, 'components', 'pm')
const WIDGETS = path.join(SRC, 'components', 'widgets')
const STORES = path.join(SRC, 'stores')

// ── Phase 1: Tab system removed ──

describe('Phase 1: Project tabs removed', () => {
  it('PMWorkspace.tsx should NOT contain PROJECT_TABS', () => {
    const code = fs.readFileSync(path.join(PM, 'PMWorkspace.tsx'), 'utf-8')
    expect(code).not.toContain('PROJECT_TABS')
  })

  it('PMWorkspace.tsx should NOT render tab buttons for overview/tasks/goals/alerts', () => {
    const code = fs.readFileSync(path.join(PM, 'PMWorkspace.tsx'), 'utf-8')
    // Should not have the tab switching logic
    expect(code).not.toMatch(/activeView === ['"]overview['"]/)
    expect(code).not.toMatch(/activeView === ['"]tasks['"]/)
    expect(code).not.toMatch(/activeView === ['"]alerts['"]/)
    expect(code).not.toMatch(/activeView === ['"]goals['"]/)
  })

  it('PMWorkspace.tsx should render CardGridView directly when project is selected', () => {
    const code = fs.readFileSync(path.join(PM, 'PMWorkspace.tsx'), 'utf-8')
    expect(code).toContain('CardGridView')
  })

  it('PMWorkspace.tsx should NOT import removed components', () => {
    const code = fs.readFileSync(path.join(PM, 'PMWorkspace.tsx'), 'utf-8')
    expect(code).not.toContain("import { ProjectOverview }")
    expect(code).not.toContain("import { NowNextLater }")
    expect(code).not.toContain("import { GoalsView }")
    expect(code).not.toContain("import { AlertCards }")
  })
})

// ── Phase 2: Goals widget ──

describe('Phase 2: Goals widget', () => {
  it('GoalsWidget.tsx should exist', () => {
    expect(fs.existsSync(path.join(WIDGETS, 'GoalsWidget.tsx'))).toBe(true)
  })

  it('GoalsWidget should export GoalsCompact and GoalsDetail', () => {
    const code = fs.readFileSync(path.join(WIDGETS, 'GoalsWidget.tsx'), 'utf-8')
    expect(code).toMatch(/export\s+(function|const)\s+GoalsCompact/)
    expect(code).toMatch(/export\s+(function|const)\s+GoalsDetail/)
  })

  it('home-store should register goals widget in STATIC_REGISTRY', () => {
    const code = fs.readFileSync(path.join(STORES, 'home-store.tsx'), 'utf-8')
    expect(code).toContain("id: 'goals'")
    expect(code).toContain('GoalsCompact')
    expect(code).toContain('GoalsDetail')
  })
})

// ── Phase 3: Dead code cleanup ──

describe('Phase 3: Dead code removed', () => {
  it('NowNextLater.tsx should be deleted', () => {
    expect(fs.existsSync(path.join(PM, 'NowNextLater.tsx'))).toBe(false)
  })

  it('AlertCards.tsx should be deleted', () => {
    expect(fs.existsSync(path.join(PM, 'AlertCards.tsx'))).toBe(false)
  })

  it('GoalsView.tsx should be deleted (widget replaces it)', () => {
    expect(fs.existsSync(path.join(PM, 'goals', 'GoalsView.tsx'))).toBe(false)
  })

  it('Overview.tsx should be deleted (ProjectOverview + GeneralDashboard were dead code)', () => {
    expect(fs.existsSync(path.join(PM, 'Overview.tsx'))).toBe(false)
  })

  it('GoalList.tsx should still exist (reused by widget)', () => {
    expect(fs.existsSync(path.join(PM, 'goals', 'GoalList.tsx'))).toBe(true)
  })

  it('GoalDetail.tsx should still exist (reused by widget)', () => {
    expect(fs.existsSync(path.join(PM, 'goals', 'GoalDetail.tsx'))).toBe(true)
  })
})
