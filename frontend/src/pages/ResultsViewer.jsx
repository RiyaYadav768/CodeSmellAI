/**
 * ResultsViewer — /results route
 * Stitch: "CodeSmellAI — Results Viewer (/results)"
 * Layout: full-width dashboard — KPI strip + risk table + smell breakdown
 */
import { useState, useRef } from 'react'
import { Navbar, RiskBadge, KpiCard, GlassCard, TabBar, SampleDataBanner } from '../components'
import { useMetrics } from '../hooks/MetricsContext.jsx'

const SMELL_LABELS = {
  long_function:       'Long Function',
  too_many_parameters: 'Too Many Params',
  deep_nesting:        'Deep Nesting',
  large_file:          'Large File',
  god_class:           'God Class',
}
const RISK_COLOR = { high: '#FF8374', medium: '#F5C04F', low: '#6EDC9B' }

const TABS = [
  { id: 'overview',  label: 'Overview',        icon: 'analytics'    },
  { id: 'files',     label: 'Files Explorer',  icon: 'folder_open'  },
  { id: 'graph',     label: 'Dependency Graph',icon: 'bubble_chart' },
  { id: 'upload',    label: 'Upload & Stats',  icon: 'upload_file'  },
]

function RiskBar({ score, level }) {
  const color = RISK_COLOR[level] || '#61dac5'
  return (
    <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: '#05100e' }}>
      <div className="h-full rounded-full transition-all duration-700"
        style={{ width: `${Math.round(score ?? 0)}%`, background: color }} />
    </div>
  )
}

export default function ResultsViewer() {
  const [activeTab, setActiveTab] = useState('overview')
  const { rows, summary, isSample, meta, loadFile, isLoading, errors, warnings } = useMetrics()
  const fileRef = useRef(null)

  function handleUpload() { fileRef.current?.click() }
  function handleFileChange(e) {
    const f = e.target.files?.[0]
    if (f) loadFile(f)
    e.target.value = ''
  }

  function navigateTab(id) {
    const routes = { files: '/files', graph: '/graph', upload: '/upload', overview: '/results' }
    if (routes[id]) window.location.href = routes[id]
  }

  const smellEntries = Object.entries(summary?.smellBreakdown ?? {})
    .filter(([, v]) => v > 0)
    .sort(([, a], [, b]) => b - a)

  return (
    <div className="min-h-screen bg-bg-base text-text-primary flex flex-col">
      <Navbar route="results" onUpload={handleUpload} />
      <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFileChange} />

      <div className="pt-20 flex flex-col flex-1">
        {/* Sample / loading / error banner */}
        {isLoading && (
          <div className="w-full py-3 px-gutter text-center font-inter text-sm text-primary" style={{ background: 'rgba(97,218,197,0.08)', borderBottom: '1px solid rgba(97,218,197,0.20)' }}>
            <span className="animate-pulse">⏳ Parsing CSV file…</span>
          </div>
        )}
        {errors.length > 0 && (
          <div className="w-full py-3 px-gutter flex flex-col gap-1" style={{ background: 'rgba(255,131,116,0.08)', borderBottom: '1px solid rgba(255,131,116,0.25)' }}>
            {errors.map((e, i) => <p key={i} className="font-inter text-sm text-risk-high">{e}</p>)}
          </div>
        )}
        {warnings.length > 0 && (
          <div className="w-full py-2 px-gutter" style={{ background: 'rgba(245,192,79,0.07)', borderBottom: '1px solid rgba(245,192,79,0.20)' }}>
            {warnings.map((w, i) => <p key={i} className="font-inter text-xs text-risk-medium">{w}</p>)}
          </div>
        )}
        <SampleDataBanner
          visible={isSample && !isLoading}
          repoName={meta?.repoName ?? 'CodeSmellAI'}
          moduleCount={summary?.totalFiles ?? 0}
          onUpload={handleUpload}
        />

        {/* Tab bar */}
        <div className="w-full px-gutter-mobile md:px-gutter-tablet lg:px-gutter py-space-md" style={{ background: '#0B1D1A', borderBottom: '1px solid rgba(242,247,245,0.08)' }}>
          <div className="max-w-[1200px] mx-auto">
            <TabBar tabs={TABS} activeId={activeTab} onChange={(id) => { setActiveTab(id); navigateTab(id) }}
              rightSlot={<><span className="material-symbols-outlined text-[16px] text-primary">verified_user</span>Local Client Engine · MIT</>} />
          </div>
        </div>

        {/* Main content */}
        <main className="flex-1 px-gutter-mobile md:px-gutter-tablet lg:px-gutter py-space-xl">
          <div className="max-w-[1200px] mx-auto flex flex-col gap-space-xl">

            {/* Page header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-space-md">
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-space-xs font-inter text-label-eyebrow uppercase tracking-widest text-secondary text-xs">
                  <span className="material-symbols-outlined text-[16px] text-primary">analytics</span>
                  Repository Risk Overview
                </div>
                <h1 className="font-sora text-[28px] md:text-[36px] font-bold tracking-tight text-text-primary leading-tight">
                  Results Viewer
                </h1>
                <p className="font-inter text-text-muted text-[15px]">
                  {isSample ? 'Illustrative sample data — upload your own metrics.csv to see real results.' : `Showing ${meta?.rowCount ?? rows.length} files from ${meta?.filename ?? 'your scan'}.`}
                </p>
              </div>
              <button type="button" onClick={handleUpload}
                className="self-start md:self-auto flex items-center gap-2 px-space-md py-2.5 rounded-full font-inter font-semibold text-sm transition-all"
                style={{ background: '#61dac5', color: '#003730', boxShadow: '0 0 16px rgba(97,218,197,0.30)' }}>
                <span className="material-symbols-outlined text-[18px]">file_upload</span>
                Upload metrics.csv
              </button>
            </div>

            {/* KPI grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-space-md">
              <KpiCard label="Total Modules" value={summary?.totalFiles ?? '—'}
                unit="files" sub={`${summary?.totalLoc?.toLocaleString() ?? '—'} LOC`}
                icon="data_object" accentColor="primary" footer="Parse coverage: 100% AST" footerRight={isSample ? 'SAMPLE' : 'LIVE'} />
              <KpiCard label="High Risk" value={summary?.riskCounts?.high ?? '—'}
                unit="flagged" sub="score ≥ 70"
                icon="warning" accentColor="risk-high" footer="Threshold: 70 pts" footerRight={summary?.riskCounts?.high > 0 ? 'ACTION REQ' : 'CLEAN'} />
              <KpiCard label="Avg Risk Score" value={summary?.avgRiskScore ?? '—'}
                unit="/ 100" sub={summary?.avgRiskScore < 40 ? 'Low Risk' : summary?.avgRiskScore < 70 ? 'Medium Risk' : 'High Risk'}
                icon="shield" accentColor="primary" footer="Higher = more risk" footerRight="AVG" />
              <KpiCard label="Code Smells" value={summary?.totalSmells ?? '—'}
                unit="total" sub={`${Object.values(summary?.smellBreakdown ?? {}).filter(v => v > 0).length} categories`}
                icon="pest_control" accentColor="risk-medium" footer="Avg complexity: " footerRight={`${summary?.avgComplexity ?? '—'} CC`} />
            </div>

            {/* Risk breakdown + top-10 table */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-space-md">

              {/* Top-10 risk table */}
              <GlassCard className="lg:col-span-2 flex flex-col gap-space-md">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <h2 className="font-sora font-semibold text-text-primary text-[18px]">Top Files by Risk Score</h2>
                  <span className="font-jetbrains text-label-code text-text-muted text-[12px]">Ranked · {rows.length} files total</span>
                </div>
                <div className="flex flex-col gap-2">
                  {(summary?.topByRisk ?? []).slice(0, 10).map((f, i) => {
                    const color = RISK_COLOR[f._riskLevel] || '#A6BBB5'
                    return (
                      <div key={f.filename} className="relative overflow-hidden rounded-lg p-3 flex items-center justify-between gap-3 transition-colors"
                        style={{ background: 'rgba(33,44,42,0.60)', border: `1px solid ${i === 0 ? color + '40' : 'rgba(242,247,245,0.08)'}` }}>
                        <div className="absolute left-0 top-0 bottom-0 rounded-l"
                          style={{ width: `${Math.round(f.risk_score ?? 0)}%`, background: `${color}10`, pointerEvents: 'none' }} />
                        <div className="relative flex items-center gap-3 min-w-0">
                          <span className="font-jetbrains text-text-muted text-[12px] shrink-0">{i + 1}.</span>
                          <div className="flex flex-col min-w-0">
                            <span className="font-jetbrains text-text-primary text-[13px] font-medium truncate">{f._displayName ?? f.filename}</span>
                            {f.ai_explanation && (
                              <span className="font-inter text-text-muted text-[11px] truncate hidden md:block">{f.ai_explanation.slice(0, 80)}…</span>
                            )}
                          </div>
                        </div>
                        <div className="relative flex items-center gap-3 shrink-0">
                          <div className="hidden sm:flex flex-col items-end gap-0.5">
                            <RiskBar score={f.risk_score} level={f._riskLevel} />
                          </div>
                          <RiskBadge level={f._riskLevel} score={f.risk_score} size="sm" />
                        </div>
                      </div>
                    )
                  })}
                  {!rows.length && (
                    <p className="font-inter text-text-muted text-sm text-center py-8">No data loaded. Upload a metrics.csv file.</p>
                  )}
                </div>
              </GlassCard>

              {/* Smell breakdown + risk distribution */}
              <div className="flex flex-col gap-space-md">
                <GlassCard className="flex flex-col gap-space-md">
                  <h3 className="font-sora font-semibold text-text-primary text-[16px]">Risk Distribution</h3>
                  <div className="flex flex-col gap-2">
                    {[
                      { label: 'High Risk', key: 'high', color: '#FF8374' },
                      { label: 'Medium Risk', key: 'medium', color: '#F5C04F' },
                      { label: 'Low Risk', key: 'low', color: '#6EDC9B' },
                    ].map(({ label, key, color }) => {
                      const count = summary?.riskCounts?.[key] ?? 0
                      const total = summary?.totalFiles || 1
                      const pct = Math.round((count / total) * 100)
                      return (
                        <div key={key} className="flex flex-col gap-1">
                          <div className="flex items-center justify-between">
                            <span className="font-inter text-[13px] text-text-muted">{label}</span>
                            <span className="font-jetbrains text-[12px] font-semibold" style={{ color }}>{count} files ({pct}%)</span>
                          </div>
                          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: '#05100e' }}>
                            <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </GlassCard>

                <GlassCard className="flex flex-col gap-space-md">
                  <h3 className="font-sora font-semibold text-text-primary text-[16px]">Code Smell Breakdown</h3>
                  <div className="flex flex-col gap-2">
                    {smellEntries.length === 0 && (
                      <p className="font-inter text-text-muted text-sm">No smells detected.</p>
                    )}
                    {smellEntries.map(([key, count]) => (
                      <div key={key} className="flex items-center justify-between p-2 rounded-lg"
                        style={{ background: '#05100e', border: '1px solid rgba(242,247,245,0.08)' }}>
                        <span className="font-inter text-[13px] text-text-primary">{SMELL_LABELS[key] ?? key}</span>
                        <span className="font-jetbrains text-[12px] px-2 py-0.5 rounded"
                          style={{ background: 'rgba(97,218,197,0.12)', color: '#61dac5' }}>{count}</span>
                      </div>
                    ))}
                    {summary?.graphEdgesNote && (
                      <p className="font-inter text-[11px] text-text-muted/60 pt-1 italic">{summary.graphEdgesNote}</p>
                    )}
                  </div>
                </GlassCard>
              </div>
            </div>

            {/* Full file table */}
            <GlassCard className="flex flex-col gap-space-md overflow-auto">
              <h2 className="font-sora font-semibold text-text-primary text-[18px]">All Files</h2>
              <table className="w-full text-left border-collapse text-[13px] font-inter min-w-[700px]">
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(242,247,245,0.10)' }}>
                    {['File', 'Risk Score', 'Category', 'LOC', 'Complexity', 'Smells', 'Maintainability'].map(h => (
                      <th key={h} className="pb-3 pr-4 font-inter text-[11px] uppercase tracking-widest text-text-muted font-semibold">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.slice().sort((a, b) => (b.risk_score ?? 0) - (a.risk_score ?? 0)).map((row) => (
                    <tr key={row.filename}
                      className="transition-colors hover:bg-surface-container/30"
                      style={{ borderBottom: '1px solid rgba(242,247,245,0.06)' }}>
                      <td className="py-2.5 pr-4 font-jetbrains text-text-primary max-w-[200px] truncate" title={row.filename}>
                        {row._displayName}
                      </td>
                      <td className="py-2.5 pr-4">
                        <div className="flex items-center gap-2">
                          <span className="font-jetbrains font-semibold" style={{ color: RISK_COLOR[row._riskLevel] || '#F2F7F5' }}>
                            {row.risk_score?.toFixed(1) ?? '—'}
                          </span>
                        </div>
                      </td>
                      <td className="py-2.5 pr-4"><RiskBadge level={row._riskLevel} size="sm" /></td>
                      <td className="py-2.5 pr-4 font-jetbrains text-text-muted">{row.loc ?? '—'}</td>
                      <td className="py-2.5 pr-4 font-jetbrains text-text-muted">{row.cyclomatic_complexity ?? '—'}</td>
                      <td className="py-2.5 pr-4 font-jetbrains text-text-muted">{row.smell_count_total ?? '—'}</td>
                      <td className="py-2.5 font-jetbrains text-text-muted">{row.maintainability_index?.toFixed(1) ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </GlassCard>
          </div>
        </main>
      </div>
    </div>
  )
}