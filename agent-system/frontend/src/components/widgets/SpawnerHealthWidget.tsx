/**
 * Spawner Health Widget — surfaces /api/spawner-health on the home grid.
 *
 * Compact: a heartbeat dot + key numbers (uptime, calls, errors, p95).
 * Detail: full metrics plus stop/start/restart buttons for the backend wrapper.
 */
import { useCallback, useEffect, useState } from 'react'
import { Activity, Power, Play, RefreshCw } from 'lucide-react'
import { StatusDot, ActionButton } from '@/components/primitives'
import * as api from '@/lib/api.ts'
import type { SpawnerHealth } from '@/lib/api.ts'

// ── Helpers ──────────────────────────────────────────────────────────

function formatUptime(seconds?: number): string {
  if (!seconds || seconds < 1) return '—'
  const s = Math.floor(seconds)
  if (s < 60) return `${s}s`
  if (s < 3600) return `${Math.floor(s / 60)}m`
  if (s < 86400) {
    const h = Math.floor(s / 3600)
    const m = Math.floor((s % 3600) / 60)
    return m === 0 ? `${h}h` : `${h}h ${m}m`
  }
  const d = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  return h === 0 ? `${d}d` : `${d}d ${h}h`
}

function formatMs(ms?: number): string {
  if (ms == null) return '—'
  if (ms < 1) return '<1ms'
  if (ms < 1000) return `${ms.toFixed(ms < 10 ? 1 : 0)}ms`
  return `${(ms / 1000).toFixed(2)}s`
}

function useSpawnerHealth(intervalMs = 5000) {
  const [data, setData] = useState<SpawnerHealth | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const refresh = useCallback(async () => {
    setRefreshing(true)
    try {
      const next = await api.fetchSpawnerHealth()
      setData(next)
    } catch (err) {
      setData({ ok: false, error: err instanceof Error ? err.message : String(err) })
    } finally {
      setRefreshing(false)
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
    const id = setInterval(() => { void refresh() }, intervalMs)
    return () => clearInterval(id)
  }, [refresh, intervalMs])

  return { data, loading, refreshing, refresh }
}

// ── Compact View ─────────────────────────────────────────────────────

export function SpawnerHealthCompact() {
  const { data, loading } = useSpawnerHealth()

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-4">
        <span className="type-micro text-muted-foreground">Loading…</span>
      </div>
    )
  }

  if (!data || !data.ok) {
    return (
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-1.5">
          <StatusDot status="error" size="sm" />
          <span className="type-micro font-medium text-orange">Backend down</span>
        </div>
        {data?.error && (
          <div className="type-caption text-muted-foreground line-clamp-2">{data.error}</div>
        )}
      </div>
    )
  }

  const variant: 'working' | 'idle' | 'waiting' = (data.errors_total ?? 0) > 0
    ? 'waiting'
    : (data.in_flight ?? 0) > 0 ? 'working' : 'idle'

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5">
        <StatusDot status={variant} size="sm" />
        <span className="type-micro font-medium">
          up {formatUptime(data.uptime_s)}
        </span>
        <span className="ml-auto type-caption text-muted-foreground">
          {data.calls_total ?? 0} calls
        </span>
      </div>
      <div className="flex items-center gap-3 type-caption text-muted-foreground">
        <span>p50 {formatMs(data.p50_ms)}</span>
        <span>p95 {formatMs(data.p95_ms)}</span>
        {(data.errors_total ?? 0) > 0 && (
          <span className="text-orange font-medium">err {data.errors_total}</span>
        )}
        {(data.in_flight ?? 0) > 0 && (
          <span>in-flight {data.in_flight}</span>
        )}
      </div>
    </div>
  )
}

// ── Detail View ──────────────────────────────────────────────────────

export function SpawnerHealthDetail() {
  const { data, refreshing, refresh } = useSpawnerHealth(3000)
  const [busy, setBusy] = useState<'stop' | 'start' | null>(null)
  const [actionResult, setActionResult] = useState<string | null>(null)

  const handleStop = async () => {
    setBusy('stop')
    setActionResult(null)
    try {
      await api.stopSpawnerBackend()
      setActionResult('Backend stopped.')
      await refresh()
    } catch (err) {
      setActionResult(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(null)
    }
  }

  const handleStart = async () => {
    setBusy('start')
    setActionResult(null)
    try {
      await api.startSpawnerBackend()
      setActionResult('Backend wrapper launched.')
      await refresh()
    } catch (err) {
      setActionResult(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(null)
    }
  }

  const ok = data?.ok ?? false
  const variant: 'working' | 'idle' | 'waiting' | 'error' = !ok
    ? 'error'
    : (data!.errors_total ?? 0) > 0 ? 'waiting'
    : (data!.in_flight ?? 0) > 0 ? 'working'
    : 'idle'

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Activity size={14} className="text-accent shrink-0" />
        <div className="flex items-center gap-1.5">
          <StatusDot status={variant} size="sm" />
          <span className="type-label font-semibold">
            {ok ? `Backend up ${formatUptime(data?.uptime_s)}` : 'Backend down'}
          </span>
        </div>
        {data?.version && (
          <span className="type-caption font-mono text-muted-foreground">{data.version}</span>
        )}
        <ActionButton
          variant="secondary"
          size="sm"
          className="ml-auto"
          onClick={() => { void refresh() }}
        >
          <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} /> Refresh
        </ActionButton>
      </div>

      {/* Error line */}
      {!ok && data?.error && (
        <div className="type-micro text-orange leading-relaxed border border-orange/30 bg-orange/5 rounded-md p-2">
          {data.error}
        </div>
      )}

      {/* Metrics grid */}
      {ok && (
        <div className="grid grid-cols-2 gap-x-6 gap-y-2.5 type-micro">
          <Metric label="Calls" value={String(data?.calls_total ?? 0)} />
          <Metric
            label="Errors"
            value={String(data?.errors_total ?? 0)}
            tone={(data?.errors_total ?? 0) > 0 ? 'warn' : undefined}
          />
          <Metric label="In-flight" value={String(data?.in_flight ?? 0)} />
          <Metric label="Codex sessions" value={String(data?.codex_watcher_sessions ?? 0)} />
          <Metric label="p50" value={formatMs(data?.p50_ms)} />
          <Metric label="p95" value={formatMs(data?.p95_ms)} />
          <Metric label="p99" value={formatMs(data?.p99_ms)} />
          <Metric label="Lock-wait p95" value={formatMs(data?.lock_wait_p95_ms)} />
        </div>
      )}

      {/* Lock keys (when contended) */}
      {ok && ((data?.session_lock_keys ?? 0) > 0 || (data?.chat_lock_keys ?? 0) > 0) && (
        <div className="type-caption text-muted-foreground">
          Active locks: {data?.session_lock_keys ?? 0} session ·{' '}
          {data?.chat_lock_keys ?? 0} chat
        </div>
      )}

      {/* Action result */}
      {actionResult && (
        <div className="type-micro text-muted-foreground italic">{actionResult}</div>
      )}

      {/* Controls */}
      <div className="flex items-center gap-2 pt-1 border-t border-[var(--color-border-subtle)]">
        {ok ? (
          <ActionButton variant="secondary" size="sm" onClick={handleStop} disabled={busy !== null}>
            <Power size={12} /> {busy === 'stop' ? 'Stopping…' : 'Stop'}
          </ActionButton>
        ) : (
          <ActionButton variant="primary" size="sm" onClick={handleStart} disabled={busy !== null}>
            <Play size={12} /> {busy === 'start' ? 'Starting…' : 'Start'}
          </ActionButton>
        )}
        {ok && (
          <ActionButton variant="secondary" size="sm" onClick={async () => {
            await handleStop()
            await handleStart()
          }} disabled={busy !== null}>
            <RefreshCw size={12} /> Restart
          </ActionButton>
        )}
        <span className="ml-auto type-caption font-mono text-muted-foreground">127.0.0.1:8500</span>
      </div>
    </div>
  )
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: 'warn' }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-mono ${tone === 'warn' ? 'text-orange font-semibold' : ''}`}>
        {value}
      </span>
    </div>
  )
}
