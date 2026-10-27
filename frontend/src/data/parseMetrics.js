/**
 * parseMetrics.js — browser-side CSV data layer for CodeSmellAI
 *
 * Pipeline:
 *   File → PapaParse → validate → normalize rows → compute summary
 *
 * No network calls. No fabricated data. No dependency edges invented.
 * All values come directly from the CSV produced by `codesmell-ai --repo-path`.
 */
import Papa from 'papaparse'
import { REQUIRED_COLUMNS, COLUMN_SCHEMA, RISK_THRESHOLDS } from './schema.js'

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Safe number parse — returns null (not 0) when the value is genuinely absent. */
function toFloat(val) {
  if (val === null || val === undefined || String(val).trim() === '') return null
  const n = parseFloat(val)
  return isNaN(n) ? null : n
}

function toInt(val) {
  if (val === null || val === undefined || String(val).trim() === '') return null
  const n = parseInt(val, 10)
  return isNaN(n) ? null : n
}

/** Parse Python boolean strings "True" / "False" → JS boolean. */
function toBool(val) {
  if (val === null || val === undefined) return null
  const s = String(val).trim()
  if (s === 'True')  return true
  if (s === 'False') return false
  return null
}

/**
 * Parse Python dict string produced by Python's str(dict):
 *   "{'long_function': 1, 'too_many_parameters': 0, ...}"
 * Returns a plain JS object or null on failure.
 * Strategy: replace Python-style keys with JSON-style, then JSON.parse.
 */
function parsePyDict(val) {
  if (!val || String(val).trim() === '') return null
  try {
    // Replace single quotes → double quotes, Python True/False → JSON true/false
    const json = String(val)
      .replace(/'/g, '"')
      .replace(/\bTrue\b/g, 'true')
      .replace(/\bFalse\b/g, 'false')
      .replace(/\bNone\b/g, 'null')
    return JSON.parse(json)
  } catch {
    return null   // malformed — return null, do not crash
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 1 — Validate columns
// ─────────────────────────────────────────────────────────────────────────────

/**
 * validateColumns(headers) → { ok: bool, errors: string[] }
 * Checks that the required columns are present in the parsed header row.
 */
export function validateColumns(headers) {
  if (!Array.isArray(headers) || headers.length === 0) {
    return { ok: false, errors: ['The CSV file has no columns. Is it empty?'] }
  }
  const headerSet = new Set(headers.map(h => String(h).trim()))
  const missing = REQUIRED_COLUMNS.filter(col => !headerSet.has(col))
  if (missing.length > 0) {
    return {
      ok: false,
      errors: [
        `Missing required column(s): ${missing.join(', ')}.`,
        'Make sure you are uploading a metrics.csv produced by codesmell-ai.',
        `Expected columns include: ${REQUIRED_COLUMNS.join(', ')}.`,
      ],
    }
  }
  return { ok: true, errors: [] }
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 2 — Normalize a single CSV row
// ─────────────────────────────────────────────────────────────────────────────

/**
 * normalizeRow(raw) → normalized row object
 *
 * - Casts every known column to the correct JS type per schema.js.
 * - Preserves unknown columns as raw strings (future-proofing).
 * - Never throws: missing or malformed values become null.
 * - Derives `riskLevel` ('low'|'medium'|'high') from risk_score as fallback
 *   when risk_category is absent.
 */
export function normalizeRow(raw) {
  if (!raw || typeof raw !== 'object') return null

  const row = {}

  // Process known columns per schema type
  for (const { key, type } of COLUMN_SCHEMA) {
    const rawVal = raw[key]
    switch (type) {
      case 'float':   row[key] = toFloat(rawVal);    break
      case 'int':     row[key] = toInt(rawVal);      break
      case 'bool':    row[key] = toBool(rawVal);     break
      case 'pydict':  row[key] = parsePyDict(rawVal); break
      default:        row[key] = rawVal != null ? String(rawVal).trim() : null
    }
  }

  // Preserve any extra columns the future pipeline might add
  for (const key of Object.keys(raw)) {
    if (!(key in row)) {
      row[key] = raw[key] != null ? String(raw[key]).trim() : null
    }
  }

  // ── Derived helpers (read-only, prefixed with _) ─────────────────────────

  // Normalised risk level key
  const cat = String(row.risk_category ?? '').toLowerCase()
  if (cat.includes('high'))        row._riskLevel = 'high'
  else if (cat.includes('medium')) row._riskLevel = 'medium'
  else if (cat.includes('low'))    row._riskLevel = 'low'
  else {
    // Fallback: derive from numeric score using Python thresholds
    const s = row.risk_score
    if (s !== null) {
      row._riskLevel = s >= RISK_THRESHOLDS.MEDIUM_MAX ? 'high'
                     : s >= RISK_THRESHOLDS.LOW_MAX    ? 'medium'
                     :                                   'low'
    } else {
      row._riskLevel = 'low'
    }
  }

  // Short display name (basename without path prefix, for table cells)
  row._displayName = row.filename
    ? row.filename.split('/').pop()
    : '(unknown)'

  // Whether this file has pagerank data (degree > 0 or explicit pagerank)
  row._hasGraphData = (row.degree !== null && row.degree > 0) ||
                      (row.pagerank !== null && row.pagerank > 0)

  return row
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 3 — Compute dashboard summary from parsed rows
// ─────────────────────────────────────────────────────────────────────────────

/**
 * computeSummary(rows) → summary object
 *
 * Calculates dashboard KPIs purely from parsed rows.
 * Returns null fields rather than inventing values.
 * Graph edges are explicitly marked unavailable.
 */
export function computeSummary(rows) {
  if (!rows || rows.length === 0) {
    return {
      totalFiles:       0,
      totalLoc:         0,
      avgRiskScore:     null,
      avgComplexity:    null,
      totalSmells:      0,
      riskCounts:       { low: 0, medium: 0, high: 0 },
      topByRisk:        [],
      smellBreakdown:   {},
      graphEdges:       null,   // not available from CSV — see schema.js
      graphEdgesNote:   'Dependency edges are not exported to metrics.csv. ' +
                        'Run codesmell-ai and view dependency_graph.png for the graph.',
    }
  }

  // Risk counts
  const riskCounts = { low: 0, medium: 0, high: 0 }
  for (const row of rows) {
    riskCounts[row._riskLevel] = (riskCounts[row._riskLevel] ?? 0) + 1
  }

  // Numeric aggregates — skip null values
  const scores      = rows.map(r => r.risk_score).filter(v => v !== null)
  const complexities= rows.map(r => r.cyclomatic_complexity).filter(v => v !== null)
  const locs        = rows.map(r => r.loc).filter(v => v !== null)
  const smells      = rows.map(r => r.smell_count_total).filter(v => v !== null)

  const avg = arr => arr.length ? +(arr.reduce((a,b) => a+b, 0) / arr.length).toFixed(2) : null
  const sum = arr => arr.reduce((a,b) => a+b, 0)

  // Aggregate smell categories across all rows
  const smellBreakdown = {}
  for (const row of rows) {
    if (row.smell_breakdown && typeof row.smell_breakdown === 'object') {
      for (const [k, v] of Object.entries(row.smell_breakdown)) {
        smellBreakdown[k] = (smellBreakdown[k] ?? 0) + (v ?? 0)
      }
    }
  }

  // Top 10 by risk score
  const topByRisk = [...rows]
    .filter(r => r.risk_score !== null)
    .sort((a, b) => b.risk_score - a.risk_score)
    .slice(0, 10)
    .map(r => ({
      filename:      r.filename,
      _displayName:  r._displayName,
      risk_score:    r.risk_score,
      risk_category: r.risk_category,
      _riskLevel:    r._riskLevel,
      loc:           r.loc,
      cyclomatic_complexity: r.cyclomatic_complexity,
      ai_explanation: r.ai_explanation,
    }))

  return {
    totalFiles:     rows.length,
    totalLoc:       sum(locs),
    avgRiskScore:   avg(scores),
    avgComplexity:  avg(complexities),
    totalSmells:    sum(smells),
    riskCounts,
    topByRisk,
    smellBreakdown,
    graphEdges:     null,   // not in CSV — explicitly null, not fabricated
    graphEdgesNote: 'Dependency edges are not exported to metrics.csv. ' +
                    'View dependency_graph.png (generated by codesmell-ai) for the dependency graph.',
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 4 — Main entry point: parse a File object → result
// ─────────────────────────────────────────────────────────────────────────────

/**
 * parseMetricsFile(file) → Promise<ParseResult>
 *
 * ParseResult shape:
 * {
 *   ok:       boolean,
 *   errors:   string[],        // beginner-friendly messages
 *   warnings: string[],        // non-fatal issues
 *   rows:     NormalizedRow[], // empty array on failure
 *   summary:  Summary | null,
 *   meta: {
 *     filename:    string,
 *     rowCount:    number,
 *     columnCount: number,
 *     columns:     string[],
 *   }
 * }
 *
 * @param {File} file — A File object from <input type="file">
 */
export function parseMetricsFile(file) {
  return new Promise((resolve) => {

    // Guard: must be a File
    if (!file || !(file instanceof File)) {
      return resolve({ ok: false, errors: ['No file provided.'], warnings: [], rows: [], summary: null, meta: null })
    }

    // Guard: basic mime/extension check (non-fatal if browser skips mime)
    const name = file.name ?? ''
    if (!name.toLowerCase().endsWith('.csv')) {
      return resolve({
        ok: false,
        errors: [`"${name}" does not appear to be a CSV file. Please upload the metrics.csv file produced by codesmell-ai.`],
        warnings: [], rows: [], summary: null, meta: null,
      })
    }

    Papa.parse(file, {
      header:          true,
      skipEmptyLines:  true,
      trimHeaders:     true,   // trim column name whitespace
      dynamicTyping:   false,  // keep everything as strings; we cast ourselves

      complete(result) {
        const warnings = []

        // ── Column validation ───────────────────────────────────────────
        const headers = result.meta?.fields ?? []
        const colCheck = validateColumns(headers)
        if (!colCheck.ok) {
          return resolve({ ok: false, errors: colCheck.errors, warnings, rows: [], summary: null,
            meta: { filename: name, rowCount: 0, columnCount: headers.length, columns: headers } })
        }

        // ── Row validation ──────────────────────────────────────────────
        const rawRows = result.data ?? []
        if (rawRows.length === 0) {
          return resolve({
            ok: false,
            errors: ['The CSV file has no data rows. Run codesmell-ai on a repository first.'],
            warnings, rows: [], summary: null,
            meta: { filename: name, rowCount: 0, columnCount: headers.length, columns: headers },
          })
        }

        // PapaParse parse errors (non-fatal — collect as warnings)
        if (result.errors?.length > 0) {
          for (const e of result.errors) {
            warnings.push(`CSV parse warning on row ${e.row ?? '?'}: ${e.message}`)
          }
        }

        // ── Normalize rows ──────────────────────────────────────────────
        const rows = []
        let skipped = 0
        for (const raw of rawRows) {
          const normalized = normalizeRow(raw)
          if (!normalized || !normalized.filename) {
            skipped++
            continue
          }
          rows.push(normalized)
        }

        if (skipped > 0) {
          warnings.push(`${skipped} row(s) were skipped because they had no filename.`)
        }

        if (rows.length === 0) {
          return resolve({
            ok: false,
            errors: ['No valid rows could be parsed. Each row must have a non-empty filename.'],
            warnings, rows: [], summary: null,
            meta: { filename: name, rowCount: rawRows.length, columnCount: headers.length, columns: headers },
          })
        }

        // ── Summary ─────────────────────────────────────────────────────
        const summary = computeSummary(rows)

        resolve({
          ok: true,
          errors: [],
          warnings,
          rows,
          summary,
          meta: {
            filename:    name,
            rowCount:    rows.length,
            columnCount: headers.length,
            columns:     headers,
          },
        })
      },

      error(err) {
        resolve({
          ok: false,
          errors: [`Could not read the file: ${err?.message ?? String(err)}`],
          warnings: [], rows: [], summary: null, meta: null,
        })
      },
    })
  })
}