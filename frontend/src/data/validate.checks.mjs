/**
 * validate.checks.mjs — data layer audit for CodeSmellAI
 *
 * Run with: node src/data/validate.checks.mjs
 * No test framework — uses Node's built-in assert module.
 *
 * IMPORTANT: imports the ACTUAL functions from parseMetrics.js and schema.js
 * rather than duplicating inline implementations. This tests the real code.
 *
 * PapaParse cannot run in Node (it is browser-oriented), so parseMetricsFile()
 * itself is not tested here. The functions it delegates to — validateColumns,
 * normalizeRow, computeSummary — are all pure functions and are tested directly.
 *
 * Covers:
 *  A. Schema constants match Python risk_scorer.py exactly
 *  B. validateColumns — missing/empty/extra/duplicate headers
 *  C. normalizeRow — real CSV string values, type coercion
 *  D. normalizeRow — malformed numerics, empty fields, null values (no crash)
 *  E. normalizeRow — Python dict parsing: real values + edge cases + malformed
 *  F. normalizeRow — Python bool parsing: True/False/None/garbage
 *  G. normalizeRow — invalid risk_category handling
 *  H. normalizeRow — _riskLevel exactly matches Python thresholds (score<40/70)
 *  I. normalizeRow — _displayName strips path prefix
 *  J. computeSummary — aggregates from real SAMPLE_ROWS (10 rows)
 *  K. computeSummary — empty input, single row, all-null scores
 *  L. computeSummary — graphEdges is always null (no fabricated edges)
 *  M. SAMPLE_ROWS — all required fields present, graphEdges null
 *  N. SAMPLE_SUMMARY — pre-computed values match re-calculation
 */
import assert from "node:assert/strict"
import {
  validateColumns,
  normalizeRow,
  computeSummary,
} from "./parseMetrics.js"
import {
  REQUIRED_COLUMNS,
  COLUMN_SCHEMA,
  RISK_THRESHOLDS,
  RISK_COLORS,
  GRAPH_EDGES_AVAILABLE,
} from "./schema.js"
import { SAMPLE_ROWS, SAMPLE_SUMMARY, SAMPLE_META } from "./sampleData.js"

// ── Test runner ───────────────────────────────────────────────────────────────
let passed = 0, failed = 0
function test(name, fn) {
  try { fn(); console.log("  \u2713  " + name); passed++ }
  catch (e) { console.error("  \u2717  " + name + "\n       " + e.message); failed++ }
}

console.log("\nCodeSmellAI data layer \u2014 full audit\n")

// ── A. Schema constants match Python risk_scorer.py exactly ──────────────────
console.log("A. Schema / Python alignment")

test("RISK_THRESHOLDS.LOW_MAX === Python LOW_RISK_THRESHOLD (40)", () => {
  assert.equal(RISK_THRESHOLDS.LOW_MAX, 40)
})
test("RISK_THRESHOLDS.MEDIUM_MAX === Python MEDIUM_RISK_THRESHOLD (70)", () => {
  assert.equal(RISK_THRESHOLDS.MEDIUM_MAX, 70)
})
test("RISK_COLORS keys match Python categorize_risk() return strings exactly", () => {
  assert.ok("Low Risk"    in RISK_COLORS)
  assert.ok("Medium Risk" in RISK_COLORS)
  assert.ok("High Risk"   in RISK_COLORS)
  assert.equal(Object.keys(RISK_COLORS).length, 3)
})
test("GRAPH_EDGES_AVAILABLE is false (edges not in CSV)", () => {
  assert.equal(GRAPH_EDGES_AVAILABLE, false)
})
test("REQUIRED_COLUMNS contains filename, risk_score, risk_category", () => {
  assert.ok(REQUIRED_COLUMNS.includes("filename"))
  assert.ok(REQUIRED_COLUMNS.includes("risk_score"))
  assert.ok(REQUIRED_COLUMNS.includes("risk_category"))
})
test("COLUMN_SCHEMA has 29 entries matching export_csv.py CSV_COLUMNS + derived", () => {
  // export_csv.py CSV_COLUMNS has 29 columns (verified from source)
  assert.equal(COLUMN_SCHEMA.length, 29)
})

// ── B. validateColumns ────────────────────────────────────────────────────────
console.log("\nB. validateColumns")

test("rejects empty array", () => {
  assert.equal(validateColumns([]).ok, false)
})
test("rejects non-array (null)", () => {
  assert.equal(validateColumns(null).ok, false)
})
test("rejects headers missing all required columns", () => {
  const r = validateColumns(["some_col", "other_col"])
  assert.equal(r.ok, false)
  assert.ok(r.errors.some(e => e.includes("Missing")))
})
test("rejects when only filename is present (missing risk_score + risk_category)", () => {
  assert.equal(validateColumns(["filename"]).ok, false)
})
test("rejects when risk_category is missing", () => {
  assert.equal(validateColumns(["filename", "risk_score"]).ok, false)
})
test("accepts all required columns with extras", () => {
  const r = validateColumns(["filename", "risk_score", "risk_category", "loc", "cyclomatic_complexity"])
  assert.equal(r.ok, true)
  assert.equal(r.errors.length, 0)
})
test("accepts exactly the minimum required columns", () => {
  const r = validateColumns(["filename", "risk_score", "risk_category"])
  assert.equal(r.ok, true)
})
test("handles duplicate headers without crashing (Set deduplicates)", () => {
  // PapaParse may produce duplicates; validateColumns should not crash
  const r = validateColumns(["filename", "filename", "risk_score", "risk_category"])
  assert.equal(r.ok, true)   // duplicates are ignored by the Set; required cols present
})

// ── C. normalizeRow — real CSV string values ──────────────────────────────────
console.log("\nC. normalizeRow — real CSV values")

const REAL_ROW = {
  filename: "ai_insights.py",
  degree: "2", in_degree: "2", pagerank: "0.0666",
  cyclomatic_complexity: "33", loc: "164", function_count: "7",
  class_count: "0", max_nesting_depth: "5", smell_count_total: "3",
  smell_breakdown: "{'long_function': 1, 'too_many_parameters': 0, 'deep_nesting': 2, 'large_file': 0, 'god_class': 0}",
  maintainability_index: "10.8",
  commit_count: "1", bug_fix_commit_count: "0", distinct_author_count: "1",
  days_since_last_modified: "0", has_insufficient_history: "True",
  risk_score: "51.67", risk_category: "Medium Risk",
  pagerank_contribution: "12.2127", cyclomatic_complexity_contribution: "13.3333",
  smell_count_total_contribution: "3.2143", max_nesting_depth_contribution: "5.7143",
  loc_contribution: "7.3636", structural_size_contribution: "1.5",
  bug_fix_commit_count_contribution: "0.0", commit_count_contribution: "3.3333",
  distinct_author_count_contribution: "5.0",
  ai_explanation: "ai_insights.py scored 51.67 (Medium Risk).",
}

test("normalizeRow: string integers parsed to JS numbers", () => {
  const row = normalizeRow(REAL_ROW)
  assert.equal(row.cyclomatic_complexity, 33)
  assert.equal(row.loc, 164)
  assert.equal(row.degree, 2)
})
test("normalizeRow: string floats parsed correctly", () => {
  const row = normalizeRow(REAL_ROW)
  assert.equal(row.risk_score, 51.67)
  assert.equal(row.pagerank, 0.0666)
  assert.equal(row.maintainability_index, 10.8)
})
test("normalizeRow: Python True string parsed to JS true", () => {
  const row = normalizeRow(REAL_ROW)
  assert.equal(row.has_insufficient_history, true)
})
test("normalizeRow: smell_breakdown parsed to JS object", () => {
  const row = normalizeRow(REAL_ROW)
  assert.ok(typeof row.smell_breakdown === "object" && row.smell_breakdown !== null)
  assert.equal(row.smell_breakdown.long_function, 1)
  assert.equal(row.smell_breakdown.deep_nesting, 2)
  assert.equal(row.smell_breakdown.god_class, 0)
})
test("normalizeRow: _displayName is basename", () => {
  const row = normalizeRow(REAL_ROW)
  assert.equal(row._displayName, "ai_insights.py")
})
test("normalizeRow: path-prefixed filename strips to basename", () => {
  const row = normalizeRow({ ...REAL_ROW, filename: "test_repo/app.py" })
  assert.equal(row._displayName, "app.py")
})
test("normalizeRow: deeply nested path strips correctly", () => {
  const row = normalizeRow({ ...REAL_ROW, filename: "build/lib/risk_scorer.py" })
  assert.equal(row._displayName, "risk_scorer.py")
})

// ── D. normalizeRow — malformed / missing values, no crash ───────────────────
console.log("\nD. normalizeRow — malformed / missing values")

test("normalizeRow: missing numeric fields become null (not 0)", () => {
  const row = normalizeRow({ filename: "x.py", risk_score: "51.67", risk_category: "Medium Risk" })
  assert.equal(row.loc, null)
  assert.equal(row.cyclomatic_complexity, null)
  assert.equal(row.degree, null)
})
test("normalizeRow: empty string numeric becomes null", () => {
  const row = normalizeRow({ ...REAL_ROW, loc: "", cyclomatic_complexity: "" })
  assert.equal(row.loc, null)
  assert.equal(row.cyclomatic_complexity, null)
})
test("normalizeRow: non-numeric string in numeric field becomes null", () => {
  const row = normalizeRow({ ...REAL_ROW, loc: "N/A", risk_score: "???" })
  assert.equal(row.loc, null)
  assert.equal(row.risk_score, null)
})
test("normalizeRow: does not crash on completely empty row object", () => {
  // normalizeRow(null) returns null, that is the contract
  assert.equal(normalizeRow(null), null)
  assert.equal(normalizeRow(undefined), null)
})
test("normalizeRow: extra unknown columns are preserved as strings", () => {
  const row = normalizeRow({ ...REAL_ROW, future_column: "some_value" })
  assert.equal(row.future_column, "some_value")
})

// ── E. parsePyDict — smell_breakdown edge cases ───────────────────────────────
console.log("\nE. parsePyDict via normalizeRow.smell_breakdown")

test("all-zero smell_breakdown from real CSV", () => {
  const raw = "{'long_function': 0, 'too_many_parameters': 0, 'deep_nesting': 0, 'large_file': 0, 'god_class': 0}"
  const row = normalizeRow({ ...REAL_ROW, smell_breakdown: raw })
  assert.deepEqual(row.smell_breakdown, {long_function:0,too_many_parameters:0,deep_nesting:0,large_file:0,god_class:0})
})
test("smell_breakdown with god_class=1 (real value from payment.py)", () => {
  const raw = "{'long_function': 0, 'too_many_parameters': 1, 'deep_nesting': 0, 'large_file': 0, 'god_class': 1}"
  const row = normalizeRow({ ...REAL_ROW, smell_breakdown: raw })
  assert.equal(row.smell_breakdown.god_class, 1)
  assert.equal(row.smell_breakdown.too_many_parameters, 1)
})
test("empty smell_breakdown string returns null (no crash)", () => {
  const row = normalizeRow({ ...REAL_ROW, smell_breakdown: "" })
  assert.equal(row.smell_breakdown, null)
})
test("missing smell_breakdown field returns null", () => {
  const { smell_breakdown: _, ...rest } = REAL_ROW
  const row = normalizeRow(rest)
  assert.equal(row.smell_breakdown, null)
})
test("malformed smell_breakdown string returns null (no crash)", () => {
  const row = normalizeRow({ ...REAL_ROW, smell_breakdown: "{this is not python}" })
  assert.equal(row.smell_breakdown, null)
})
test("smell_breakdown with Python None values parses to null entries", () => {
  const raw = "{'long_function': None, 'deep_nesting': 1}"
  const row = normalizeRow({ ...REAL_ROW, smell_breakdown: raw })
  assert.ok(row.smell_breakdown !== null)
  assert.equal(row.smell_breakdown.long_function, null)
})

// ── F. Python bool parsing ────────────────────────────────────────────────────
console.log("\nF. has_insufficient_history bool parsing")

test("True string → true", () => {
  const row = normalizeRow({ ...REAL_ROW, has_insufficient_history: "True" })
  assert.equal(row.has_insufficient_history, true)
})
test("False string → false", () => {
  const row = normalizeRow({ ...REAL_ROW, has_insufficient_history: "False" })
  assert.equal(row.has_insufficient_history, false)
})
test("empty string → null (not false)", () => {
  const row = normalizeRow({ ...REAL_ROW, has_insufficient_history: "" })
  assert.equal(row.has_insufficient_history, null)
})
test("missing field → null", () => {
  const { has_insufficient_history: _, ...rest } = REAL_ROW
  const row = normalizeRow(rest)
  assert.equal(row.has_insufficient_history, null)
})
test("garbage string → null (no crash)", () => {
  const row = normalizeRow({ ...REAL_ROW, has_insufficient_history: "maybe" })
  assert.equal(row.has_insufficient_history, null)
})

// ── G. Invalid risk_category ──────────────────────────────────────────────────
console.log("\nG. Invalid / unknown risk_category handling")

test("unknown risk_category string falls back to score-based level", () => {
  const row = normalizeRow({ ...REAL_ROW, risk_category: "Unknown Risk", risk_score: "51.67" })
  // score 51.67 >= 40 and < 70 → medium
  assert.equal(row._riskLevel, "medium")
})
test("empty risk_category falls back to score (score 18.54 → low)", () => {
  const row = normalizeRow({ ...REAL_ROW, risk_category: "", risk_score: "18.54" })
  assert.equal(row._riskLevel, "low")
})
test("missing risk_category with null score → low (safe default)", () => {
  const { risk_category: _c, ...rest } = REAL_ROW
  const row = normalizeRow({ ...rest, risk_score: "" })
  assert.equal(row._riskLevel, "low")
})
test("'High Risk' string produces _riskLevel high", () => {
  const row = normalizeRow({ ...REAL_ROW, risk_category: "High Risk", risk_score: "75" })
  assert.equal(row._riskLevel, "high")
})

// ── H. _riskLevel threshold boundary precision ────────────────────────────────
console.log("\nH. _riskLevel boundary precision (Python thresholds)")

test("score 39.99 → low (< 40)", () => {
  const row = normalizeRow({ ...REAL_ROW, risk_category: "", risk_score: "39.99" })
  assert.equal(row._riskLevel, "low")
})
test("score 40.00 → medium (>= 40)", () => {
  const row = normalizeRow({ ...REAL_ROW, risk_category: "", risk_score: "40.00" })
  assert.equal(row._riskLevel, "medium")
})
test("score 69.99 → medium (< 70)", () => {
  const row = normalizeRow({ ...REAL_ROW, risk_category: "", risk_score: "69.99" })
  assert.equal(row._riskLevel, "medium")
})
test("score 70.00 → high (>= 70)", () => {
  const row = normalizeRow({ ...REAL_ROW, risk_category: "", risk_score: "70.00" })
  assert.equal(row._riskLevel, "high")
})

// ── I. computeSummary ─────────────────────────────────────────────────────────
console.log("\nI. computeSummary")

// Normalize all SAMPLE_ROWS first (they are already objects, not CSV strings)
// They already have the right types from sampleData.js, so pass as-is
// (normalizeRow is idempotent for already-typed fields)
const NORM_ROWS = SAMPLE_ROWS.map(r => normalizeRow(
  // sampleData rows have JS numbers; normalizeRow expects string or number — handles both
  Object.fromEntries(Object.entries(r).map(([k,v])=>[k,v===null?null:String(v)]))
))

test("computeSummary from 10 SAMPLE_ROWS: totalFiles=10", () => {
  const s = computeSummary(NORM_ROWS)
  assert.equal(s.totalFiles, 10)
})
test("computeSummary: totalLoc=832", () => {
  const s = computeSummary(NORM_ROWS)
  assert.equal(s.totalLoc, 832)
})
test("computeSummary: totalSmells=12", () => {
  const s = computeSummary(NORM_ROWS)
  assert.equal(s.totalSmells, 12)
})
test("computeSummary: riskCounts low=6 medium=4 high=0", () => {
  const s = computeSummary(NORM_ROWS)
  assert.equal(s.riskCounts.low, 6)
  assert.equal(s.riskCounts.medium, 4)
  assert.equal(s.riskCounts.high, 0)
})
test("computeSummary: graphEdges is always null (no fabricated edges)", () => {
  const s = computeSummary(NORM_ROWS)
  assert.equal(s.graphEdges, null)
})
test("computeSummary: graphEdgesNote is present", () => {
  const s = computeSummary(NORM_ROWS)
  assert.ok(typeof s.graphEdgesNote === "string" && s.graphEdgesNote.length > 10)
})
test("computeSummary: empty rows returns zero-state (no crash)", () => {
  const s = computeSummary([])
  assert.equal(s.totalFiles, 0)
  assert.equal(s.graphEdges, null)
  assert.equal(s.avgRiskScore, null)
})
test("computeSummary: single row works without crash", () => {
  const row = normalizeRow({ filename: "x.py", risk_score: "55", risk_category: "Medium Risk",
    loc: "100", cyclomatic_complexity: "10", smell_count_total: "2",
    smell_breakdown: "{'long_function': 0, 'deep_nesting': 2}", has_insufficient_history: "True" })
  const s = computeSummary([row])
  assert.equal(s.totalFiles, 1)
  assert.equal(s.riskCounts.medium, 1)
})
test("computeSummary: rows with null risk_score excluded from avg gracefully", () => {
  const r1 = normalizeRow({ filename: "a.py", risk_score: "",   risk_category: "Low Risk" })
  const r2 = normalizeRow({ filename: "b.py", risk_score: "40", risk_category: "Medium Risk" })
  const s = computeSummary([r1, r2])
  // avg should use only r2 (r1 risk_score is null)
  assert.equal(s.avgRiskScore, 40)
})

// ── J. SAMPLE_ROWS integrity ──────────────────────────────────────────────────
console.log("\nJ. SAMPLE_ROWS integrity")

test("all 10 SAMPLE_ROWS have filename", () => {
  for (const r of SAMPLE_ROWS) assert.ok(r.filename && r.filename.length > 0)
})
test("all SAMPLE_ROWS have numeric risk_score", () => {
  for (const r of SAMPLE_ROWS) assert.ok(typeof r.risk_score === "number")
})
test("all SAMPLE_ROWS have valid _riskLevel key", () => {
  for (const r of SAMPLE_ROWS) assert.ok(["low","medium","high"].includes(r._riskLevel))
})
test("all SAMPLE_ROWS _riskLevel matches Python threshold formula exactly", () => {
  for (const r of SAMPLE_ROWS) {
    const expected = r.risk_score < 40 ? "low" : r.risk_score < 70 ? "medium" : "high"
    assert.equal(r._riskLevel, expected, r.filename + " score=" + r.risk_score)
  }
})
test("SAMPLE_ROWS graphEdges field is absent / null — no fabricated edges", () => {
  // graphEdges is a summary-level field, not a row-level field
  // rows should not have it defined
  for (const r of SAMPLE_ROWS) {
    assert.ok(!("graphEdges" in r) || r.graphEdges === null)
  }
})
test("SAMPLE_META.isSample is true", () => {
  assert.equal(SAMPLE_META.isSample, true)
})

// ── K. SAMPLE_SUMMARY pre-computed values ─────────────────────────────────────
console.log("\nK. SAMPLE_SUMMARY pre-computed values")

test("SAMPLE_SUMMARY.totalFiles = 10", () => assert.equal(SAMPLE_SUMMARY.totalFiles, 10))
test("SAMPLE_SUMMARY.totalLoc = 832", () => assert.equal(SAMPLE_SUMMARY.totalLoc, 832))
test("SAMPLE_SUMMARY.totalSmells = 12", () => assert.equal(SAMPLE_SUMMARY.totalSmells, 12))
test("SAMPLE_SUMMARY.riskCounts correct", () => {
  assert.equal(SAMPLE_SUMMARY.riskCounts.low, 6)
  assert.equal(SAMPLE_SUMMARY.riskCounts.medium, 4)
  assert.equal(SAMPLE_SUMMARY.riskCounts.high, 0)
})
test("SAMPLE_SUMMARY.graphEdges is null", () => assert.equal(SAMPLE_SUMMARY.graphEdges, null))
test("SAMPLE_SUMMARY.topByRisk has ≤ 10 items, sorted descending", () => {
  const top = SAMPLE_SUMMARY.topByRisk
  assert.ok(top.length <= 10)
  for (let i = 1; i < top.length; i++) {
    assert.ok(top[i-1].risk_score >= top[i].risk_score)
  }
})

// ── Results ───────────────────────────────────────────────────────────────────
console.log("\nResults: " + passed + " passed, " + failed + " failed\n")
if (failed > 0) process.exit(1)