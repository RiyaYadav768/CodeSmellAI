/**
 * UploadStats — /upload route
 * Stitch: "CodeSmellAI — Upload & Stats"
 * Layout: CSV upload section + health telemetry + smell breakdown + distribution chart
 */
import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Navbar, RiskBadge, KpiCard, GlassCard, SampleDataBanner } from '../components'
import { useMetrics } from '../hooks/MetricsContext.jsx'

const SMELL_LABELS = {
  long_function: 'Long Function (>50 LOC)',
  too_many_parameters: 'Too Many Parameters (>5)',
  deep_nesting: 'Deep Nesting (>4 levels)',
  large_file: 'Large File (>500 LOC)',
  god_class: 'God Class (anti-pattern)',
}
const SMELL_COLORS = {
  long_function: '#FF8374',
  too_many_parameters: '#F5C04F',
  deep_nesting: '#F5C04F',
  large_file: '#51dbca',
  god_class: '#6EDC9B',
}

// Compute distribution histogram buckets from rows
function buildHistogram(rows) {
  const buckets = [
    { label: '0–20',  range: [0, 20],  color: '#6EDC9B', count: 0 },
    { label: '21–40', range: [21, 40], color: '#6EDC9B', count: 0 },
    { label: '41–60', range: [41, 60], color: '#F5C04F', count: 0 },
    { label: '61–80', range: [61, 80], color: '#F5C04F', count: 0 },
    { label: '81–100',range: [81,100], color: '#FF8374', count: 0 },
  ]
  rows.forEach(r => {
    const s = r.risk_score ?? 0
    const b = buckets.find(b => s >= b.range[0] && s <= b.range[1])
    if (b) b.count++
  })
  return buckets
}

export default function UploadStats() {
  const { rows, summary, isSample, meta, loadFile, loadSample, isLoading, errors, warnings } = useMetrics()
  const [dragOver, setDragOver] = useState(false)
  const fileRef = useRef(null)

  function handleUpload() { fileRef.current?.click() }
  function handleFileChange(e) {
    const f = e.target.files?.[0]; if (f) loadFile(f); e.target.value = ''
  }
  function handleDrop(e) {
    e.preventDefault(); setDragOver(false)
    const f = e.dataTransfer.files?.[0]
    if (f?.name.endsWith('.csv')) loadFile(f)
  }

  const histogram = buildHistogram(rows)
  const maxCount = Math.max(...histogram.map(b => b.count), 1)
  const smellEntries = Object.entries(summary?.smellBreakdown ?? {})

  const CLI_CMD = 'codesmell-ai --repo-path . --export-csv metrics.csv'

  return (
    <div className="min-h-screen bg-bg-base text-text-primary flex flex-col">
      <Navbar route="upload" onUpload={handleUpload} />
      <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFileChange} />

      <div className="pt-20 flex flex-col flex-1">
        {isLoading && <div className="w-full py-3 px-gutter text-center font-inter text-sm text-primary animate-pulse" style={{ background: 'rgba(97,218,197,0.08)' }}>Parsing metrics.csv…</div>}
        {errors.map((e, i) => <div key={i} className="w-full py-2.5 px-gutter font-inter text-sm text-risk-high" style={{ background: 'rgba(255,131,116,0.08)', borderBottom: '1px solid rgba(255,131,116,0.25)' }}>{e}</div>)}
        {warnings.map((w, i) => <div key={i} className="w-full py-1.5 px-gutter font-inter text-xs text-risk-medium" style={{ background: 'rgba(245,192,79,0.06)' }}>{w}</div>)}
        <SampleDataBanner visible={isSample && !isLoading} repoName={meta?.repoName ?? 'CodeSmellAI'}
          moduleCount={summary?.totalFiles ?? 0} onUpload={handleUpload} />

        <main className="flex-1 px-gutter-mobile md:px-gutter-tablet lg:px-gutter py-space-xl">
          <div className="max-w-[1200px] mx-auto flex flex-col gap-space-xl">

            {/* Page header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-space-md">
              <div>
                <div className="flex items-center gap-2 font-inter text-xs uppercase tracking-widest text-secondary mb-1.5">
                  <span className="material-symbols-outlined text-[16px] text-primary">cloud_upload</span>
                  Workspace Ingestion Engine
                </div>
                <h1 className="font-sora text-[28px] md:text-[36px] font-bold tracking-tight text-text-primary">Upload & Stats</h1>
                <p className="font-inter text-text-muted text-[15px] mt-1">Analyze a Python repository by uploading its metrics.csv output.</p>
              </div>
              <div className="flex items-center gap-2 self-start md:self-auto">
                <div className="flex items-center gap-1.5 px-3 py-2 rounded-lg font-jetbrains text-[12px] text-text-muted"
                  style={{ background: '#121e1c', border: '1px solid rgba(242,247,245,0.08)' }}>
                  <span className="w-2 h-2 rounded-full bg-risk-low" />
                  <span>Client-side only · no server</span>
                </div>
              </div>
            </div>

            {/* Upload section */}
            <GlassCard className="relative overflow-hidden">
              <div className="absolute inset-0 pointer-events-none"
                style={{ background: 'linear-gradient(135deg, rgba(97,218,197,0.04) 0%, transparent 50%, rgba(171,213,80,0.04) 100%)' }} />
              <div className="relative flex flex-col gap-space-lg">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-space-md">
                  <div>
                    <div className="flex items-center gap-2.5 mb-1.5">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center text-primary"
                        style={{ background: 'rgba(97,218,197,0.10)', border: '1px solid rgba(97,218,197,0.25)' }}>
                        <span className="material-symbols-outlined text-[20px]">analytics</span>
                      </div>
                      <h2 className="font-sora font-bold text-[18px] text-text-primary">Import Existing Metrics (CSV)</h2>
                    </div>
                    <p className="font-inter text-[14px] text-text-muted">
                      Already ran the <code className="font-jetbrains text-primary text-[13px]">codesmell-ai</code> CLI?
                      Load your <code className="font-jetbrains text-text-primary text-[13px]">metrics.csv</code> file directly.
                    </p>
                  </div>
                  {!isSample && (
                    <button type="button" onClick={loadSample}
                      className="self-start md:self-auto flex items-center gap-2 px-4 py-2 rounded-lg font-inter text-[13px] text-text-muted transition-colors"
                      style={{ background: '#121e1c', border: '1px solid rgba(242,247,245,0.08)' }}>
                      Reset to sample data
                    </button>
                  )}
                </div>

                {/* Drop zone */}
                <div
                  onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                  onClick={handleUpload}
                  className="w-full rounded-xl flex flex-col items-center justify-center text-center cursor-pointer p-10 transition-all"
                  style={{
                    background: dragOver ? 'rgba(97,218,197,0.08)' : '#05100e',
                    border: `2px dashed ${dragOver ? 'rgba(97,218,197,0.60)' : 'rgba(61,73,70,0.60)'}`,
                  }}>
                  <div className="w-16 h-16 rounded-full flex items-center justify-center text-primary mb-3 transition-all"
                    style={{ background: '#162220', border: '1px solid rgba(242,247,245,0.10)', boxShadow: dragOver ? '0 0 24px rgba(97,218,197,0.25)' : 'none' }}>
                    <span className="material-symbols-outlined text-[32px]">upload_file</span>
                  </div>
                  <p className="font-sora font-semibold text-[17px] text-text-primary">
                    Drop <span className="text-primary">metrics.csv</span> here, or click to browse
                  </p>
                  <p className="font-inter text-[14px] text-text-muted mt-1.5 max-w-md">
                    Generated by <code className="font-jetbrains text-primary text-xs">codesmell-ai --repo-path .</code>
                    {' '}· Parsed locally, no upload to any server
                  </p>
                  <div className="flex items-center gap-2 mt-4 font-jetbrains text-xs text-text-muted">
                    <span className="px-2 py-0.5 rounded" style={{ background: '#162220', border: '1px solid rgba(242,247,245,0.08)' }}>CSV only</span>
                    <span>·</span>
                    <span className="px-2 py-0.5 rounded" style={{ background: '#162220', border: '1px solid rgba(242,247,245,0.08)' }}>Requires: filename, risk_score, risk_category</span>
                  </div>
                </div>

                {/* CSV spec + CLI command */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-space-md">
                  <div className="rounded-lg p-4 font-inter text-[13px] text-text-muted leading-relaxed"
                    style={{ background: '#05100e', border: '1px solid rgba(242,247,245,0.08)' }}>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-secondary mb-2">CSV Schema (required columns)</p>
                    <code className="font-jetbrains text-[11px] text-text-primary block leading-relaxed break-all">
                      filename, risk_score, risk_category, loc, cyclomatic_complexity, smell_count_total, smell_breakdown, ai_explanation, …
                    </code>
                    <p className="mt-2 text-[12px]">
                      Note: CSV imports provide flat module metrics. Dependency edges are computed at runtime by the CLI and not exported to CSV.
                    </p>
                  </div>
                  <div className="rounded-lg p-4 flex flex-col gap-3"
                    style={{ background: '#05100e', border: '1px solid rgba(242,247,245,0.08)' }}>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-primary font-inter">Automate via CLI / CI</p>
                    <div className="flex items-center gap-2">
                      <code className="font-jetbrains text-xs text-text-primary flex-1 break-all">{CLI_CMD}</code>
                      <button type="button" onClick={() => navigator.clipboard?.writeText(CLI_CMD)}
                        className="shrink-0 p-2 rounded-lg text-text-muted hover:text-text-primary transition-colors"
                        style={{ background: '#162220', border: '1px solid rgba(242,247,245,0.08)' }}
                        title="Copy CLI command">
                        <span className="material-symbols-outlined text-[18px]">content_copy</span>
                      </button>
                    </div>
                    <p className="font-inter text-[12px] text-text-muted">Runs locally · no source code leaves your machine</p>
                  </div>
                </div>
              </div>
            </GlassCard>

            {/* Health telemetry */}
            <div className="flex flex-col gap-space-md">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-space-sm">
                <div>
                  <div className="flex items-center gap-space-sm flex-wrap">
                    <h2 className="font-sora font-bold text-[20px] text-text-primary">Repository Health Telemetry</h2>
                    {isSample && (
                      <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full font-inter text-[10px] uppercase tracking-wider font-semibold"
                        style={{ background: 'rgba(245,192,79,0.12)', border: '1px solid rgba(245,192,79,0.30)', color: '#F5C04F' }}>
                        <span className="w-1.5 h-1.5 rounded-full bg-risk-medium animate-pulse" />
                        Sample Data Active
                      </div>
                    )}
                  </div>
                  <p className="font-inter text-[14px] text-text-muted mt-0.5">
                    {isSample ? 'Illustrative demo metrics from CodeSmellAI source repository — not from a live scan.' : `Live data from ${meta?.filename ?? 'uploaded CSV'}`}
                  </p>
                </div>
                <Link to="/files" className="self-start sm:self-auto flex items-center gap-1.5 px-4 py-2 rounded-lg font-inter font-semibold text-[13px] no-underline transition-all"
                  style={{ background: '#2aae9b', color: '#003730' }}>
                  View in Files Explorer →
                </Link>
              </div>

              {/* KPI row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-space-md">
                <KpiCard label="Total Modules" value={summary?.totalFiles ?? '—'} unit="files"
                  sub={`${summary?.totalLoc?.toLocaleString() ?? '—'} LOC`} icon="data_object" accentColor="primary"
                  footer={isSample ? 'Sample benchmark values' : `From ${meta?.filename ?? 'CSV'}`} />
                <KpiCard label={`High Risk (≥70 pts)`} value={summary?.riskCounts?.high ?? '—'} unit="flagged"
                  icon="warning" accentColor="risk-high"
                  footer={`${Math.round(((summary?.riskCounts?.high ?? 0) / (summary?.totalFiles || 1)) * 100)}% of repository`} />
                <KpiCard label={`Medium Risk (40–69 pts)`} value={summary?.riskCounts?.medium ?? '—'} unit="review"
                  icon="priority_high" accentColor="risk-medium"
                  footer={`${Math.round(((summary?.riskCounts?.medium ?? 0) / (summary?.totalFiles || 1)) * 100)}% of repository`} />
                <KpiCard label={`Low Risk (<40 pts)`} value={summary?.riskCounts?.low ?? '—'} unit="healthy"
                  icon="check_circle" accentColor="risk-low"
                  footer={`${Math.round(((summary?.riskCounts?.low ?? 0) / (summary?.totalFiles || 1)) * 100)}% of repository`} />
              </div>

              {/* Distribution chart + smell breakdown */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-space-md">

                {/* Histogram */}
                <GlassCard className="lg:col-span-2 flex flex-col gap-space-md">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <h3 className="font-sora font-semibold text-[17px] text-text-primary">Risk Score Distribution</h3>
                      <p className="font-inter text-[13px] text-text-muted mt-0.5">
                        Computed across {rows.length} module{rows.length !== 1 ? 's' : ''}
                        {isSample ? ' (illustrative demo data)' : ''}.
                      </p>
                    </div>
                    <div className="flex items-center gap-3 font-jetbrains text-[11px]">
                      {[{ c: '#6EDC9B', l: 'Healthy' }, { c: '#F5C04F', l: 'Watch' }, { c: '#FF8374', l: 'Elevated' }].map(({ c, l }) => (
                        <span key={l} className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-sm" style={{ background: c }} />{l}
                        </span>
                      ))}
                    </div>
                  </div>
                  {/* Bars */}
                  <div className="flex items-end justify-between h-44 gap-3 px-2 pb-2 border-b border-border-hairline">
                    {histogram.map(b => {
                      const heightPct = maxCount > 0 ? Math.max((b.count / maxCount) * 100, b.count > 0 ? 8 : 0) : 0
                      return (
                        <div key={b.label} className="flex-1 flex flex-col items-center gap-2 h-full justify-end group">
                          <span className="font-jetbrains text-xs text-text-muted group-hover:text-primary transition-colors font-medium">{b.count}</span>
                          <div className="w-full rounded-t transition-all" style={{ height: `${heightPct}%`, background: `${b.color}${b.count > 0 ? 'CC' : '25'}` }} />
                          <span className="font-jetbrains text-[11px] text-text-muted">{b.label}</span>
                        </div>
                      )
                    })}
                  </div>
                  {summary?.avgRiskScore != null && (
                    <div className="flex items-center justify-between text-[12px] font-jetbrains text-text-muted p-3 rounded-lg"
                      style={{ background: '#05100e', border: '1px solid rgba(242,247,245,0.08)' }}>
                      <span>Average Risk: <strong className="text-text-primary">{summary.avgRiskScore} pts</strong></span>
                      <span>Max: <strong className="text-text-primary">{summary.topByRisk?.[0]?.risk_score?.toFixed(1) ?? '—'} pts</strong>
                        {summary.topByRisk?.[0] && <span className="text-text-muted"> ({summary.topByRisk[0]._displayName})</span>}
                      </span>
                    </div>
                  )}
                </GlassCard>

                {/* Smell breakdown panel */}
                <GlassCard className="flex flex-col gap-space-md">
                  <div className="flex items-center justify-between">
                    <h3 className="font-sora font-semibold text-[17px] text-text-primary">Detected Smells</h3>
                    <span className="font-jetbrains text-[11px] text-primary">{summary?.totalSmells ?? 0} total</span>
                  </div>
                  <div className="flex flex-col gap-2">
                    {smellEntries.sort(([,a],[,b]) => b-a).map(([key, count]) => (
                      <div key={key} className="flex items-center justify-between p-2.5 rounded-lg"
                        style={{ background: '#05100e', border: '1px solid rgba(242,247,245,0.08)' }}>
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: SMELL_COLORS[key] || '#61dac5' }} />
                          <span className="font-inter text-[13px] text-text-primary">{SMELL_LABELS[key] ?? key}</span>
                        </div>
                        <span className="font-jetbrains text-[12px] px-2 py-0.5 rounded"
                          style={{ background: 'rgba(33,44,42,0.80)', color: count > 0 ? SMELL_COLORS[key] : '#A6BBB5' }}>
                          {count} file{count !== 1 ? 's' : ''}
                        </span>
                      </div>
                    ))}
                    {smellEntries.length === 0 && (
                      <p className="font-inter text-[13px] text-text-muted">No code smells in current dataset.</p>
                    )}
                    {summary?.graphEdgesNote && (
                      <div className="flex items-center justify-between p-2.5 rounded-lg text-[12px] font-jetbrains"
                        style={{ background: '#05100e', border: '1px solid rgba(171,213,80,0.15)' }}>
                        <span className="flex items-center gap-1.5 text-text-muted">
                          <span className="material-symbols-outlined text-[16px] text-tertiary">hub</span>
                          Graph edges:
                        </span>
                        <span className="text-text-muted italic">Not in CSV</span>
                      </div>
                    )}
                  </div>
                </GlassCard>
              </div>
            </div>

          </div>
        </main>
      </div>
    </div>
  )
}