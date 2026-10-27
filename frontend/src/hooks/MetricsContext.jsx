/**
 * MetricsContext.jsx — global state for parsed metrics data
 *
 * Provides:
 *   - rows: NormalizedRow[]           parsed CSV rows (or sample rows)
 *   - summary: Summary                computed KPIs
 *   - meta: ParseMeta                 filename, rowCount, etc.
 *   - isSample: boolean               true when showing bundled demo data
 *   - isLoading: boolean              true while PapaParse is running
 *   - errors: string[]                user-visible error messages
 *   - warnings: string[]              non-fatal parse warnings
 *   - loadFile(file): Promise<void>   parse a File object, update state
 *   - loadSample(): void              switch to bundled sample data
 *   - reset(): void                   clear back to sample state
 */
import { createContext, useContext, useState, useCallback, useMemo } from 'react'
import { parseMetricsFile, computeSummary } from '../data/parseMetrics.js'
import { SAMPLE_ROWS, SAMPLE_SUMMARY, SAMPLE_META } from '../data/sampleData.js'

// ─────────────────────────────────────────────────────────────────────────────
// Initial state — always starts on sample data
// ─────────────────────────────────────────────────────────────────────────────
const INITIAL_STATE = {
  rows:      SAMPLE_ROWS,
  summary:   SAMPLE_SUMMARY,
  meta:      SAMPLE_META,
  isSample:  true,
  isLoading: false,
  errors:    [],
  warnings:  [],
}

// ─────────────────────────────────────────────────────────────────────────────
// Context
// ─────────────────────────────────────────────────────────────────────────────
const MetricsContext = createContext(null)

export function MetricsProvider({ children }) {
  const [state, setState] = useState(INITIAL_STATE)

  /** Parse a user-selected File object and update global state. */
  const loadFile = useCallback(async (file) => {
    setState(prev => ({ ...prev, isLoading: true, errors: [], warnings: [] }))

    const result = await parseMetricsFile(file)

    if (!result.ok) {
      // On error: keep existing rows visible, show errors
      setState(prev => ({
        ...prev,
        isLoading: false,
        errors:    result.errors,
        warnings:  result.warnings,
      }))
      return
    }

    setState({
      rows:      result.rows,
      summary:   result.summary,
      meta:      { ...result.meta, isSample: false },
      isSample:  false,
      isLoading: false,
      errors:    [],
      warnings:  result.warnings,
    })
  }, [])

  /** Revert to the bundled sample data. */
  const loadSample = useCallback(() => {
    setState(INITIAL_STATE)
  }, [])

  /** Clear errors and reset to sample. */
  const reset = useCallback(() => {
    setState(INITIAL_STATE)
  }, [])

  const value = useMemo(() => ({
    ...state,
    loadFile,
    loadSample,
    reset,
  }), [state, loadFile, loadSample, reset])

  return (
    <MetricsContext.Provider value={value}>
      {children}
    </MetricsContext.Provider>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────

/**
 * useMetrics() — consume the metrics context in any page or component.
 *
 * Must be used inside <MetricsProvider>.
 *
 * @returns {MetricsContextValue}
 */
export function useMetrics() {
  const ctx = useContext(MetricsContext)
  if (!ctx) {
    throw new Error('useMetrics() must be used inside <MetricsProvider>. Wrap your app in <MetricsProvider>.')
  }
  return ctx
}