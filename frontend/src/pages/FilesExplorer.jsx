/**
 * FilesExplorer — /files route
 * Stitch: "CodeSmellAI — Files Explorer"
 * Layout: search/filter bar + sortable file table + detail panel
 */
import { useState, useRef, useMemo } from 'react'
import { Navbar, RiskBadge, KpiCard, GlassCard, SampleDataBanner } from '../components'
import { useMetrics } from '../hooks/MetricsContext.jsx'

const RISK_COLOR = { high: '#FF8374', medium: '#F5C04F', low: '#6EDC9B' }
const SMELL_LABELS = {
  long_function: 'Long Fn', too_many_parameters: 'Too Many Params',
  deep_nesting: 'Deep Nest', large_file: 'Large File', god_class: 'God Class',
}

export default function FilesExplorer() {
  const { rows, summary, isSample, meta, loadFile, isLoading, errors } = useMetrics()
  const [search, setSearch] = useState('')
  const [filterLevel, setFilterLevel] = useState('all')
  const [sortKey, setSortKey] = useState('risk_score')
  const [sortDir, setSortDir] = useState('desc')
  const [selected, setSelected] = useState(null)
  const fileRef = useRef(null)

  function handleUpload() { fileRef.current?.click() }
  function handleFileChange(e) {
    const f = e.target.files?.[0]; if (f) loadFile(f); e.target.value = ''
  }
  function toggleSort(key) {
    if (sortKey === key) setSortDir(d => d === 'desc' ? 'asc' : 'desc')
    else { setSortKey(key); setSortDir('desc') }
  }

  const filteredRows = useMemo(() => {
    let r = rows
    if (search) r = r.filter(row => (row.filename ?? '').toLowerCase().includes(search.toLowerCase()))
    if (filterLevel !== 'all') r = r.filter(row => row._riskLevel === filterLevel)
    return [...r].sort((a, b) => {
      const av = a[sortKey] ?? 0, bv = b[sortKey] ?? 0
      return sortDir === 'desc' ? bv - av : av - bv
    })
  }, [rows, search, filterLevel, sortKey, sortDir])

  const selRow = selected != null ? filteredRows[selected] : null

  const SortIcon = ({ k }) => sortKey === k
    ? <span className="material-symbols-outlined text-[14px] text-primary">{sortDir === 'desc' ? 'arrow_downward' : 'arrow_upward'}</span>
    : <span className="material-symbols-outlined text-[14px] text-text-muted/40">unfold_more</span>

  return (
    <div className="min-h-screen bg-bg-base text-text-primary flex flex-col">
      <Navbar route="files" onUpload={handleUpload} />
      <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFileChange} />

      <div className="pt-20 flex flex-col flex-1">
        {isLoading && <div className="w-full py-3 px-gutter text-center font-inter text-sm text-primary animate-pulse" style={{ background: 'rgba(97,218,197,0.08)' }}>Parsing CSV…</div>}
        {errors.map((e, i) => <div key={i} className="w-full py-2 px-gutter font-inter text-sm text-risk-high" style={{ background: 'rgba(255,131,116,0.08)' }}>{e}</div>)}
        <SampleDataBanner visible={isSample && !isLoading} repoName={meta?.repoName ?? 'CodeSmellAI'}
          moduleCount={summary?.totalFiles ?? 0} onUpload={handleUpload} />

        <main className="flex-1 px-gutter-mobile md:px-gutter-tablet lg:px-gutter py-space-xl">
          <div className="max-w-[1200px] mx-auto flex flex-col gap-space-xl">

            {/* Page header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-space-md">
              <div>
                <div className="flex items-center gap-2 font-inter text-label-eyebrow text-xs uppercase tracking-widest text-secondary mb-1.5">
                  <span className="material-symbols-outlined text-[16px] text-primary">folder_open</span>
                  Files Explorer
                </div>
                <h1 className="font-sora text-[28px] md:text-[36px] font-bold tracking-tight text-text-primary">
                  All Scanned Files
                </h1>
                <p className="font-inter text-text-muted text-[15px] mt-1">
                  {filteredRows.length} of {rows.length} files{filterLevel !== 'all' ? ` · Filter: ${filterLevel} risk` : ''}
                </p>
              </div>
              <button onClick={handleUpload} type="button"
                className="self-start md:self-auto flex items-center gap-2 px-space-md py-2.5 rounded-full font-inter font-semibold text-sm"
                style={{ background: '#61dac5', color: '#003730' }}>
                <span className="material-symbols-outlined text-[18px]">file_upload</span>
                Upload metrics.csv
              </button>
            </div>

            {/* KPI strip — 4-up */}
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-space-md">
              <KpiCard label="Total Modules" value={summary?.totalFiles ?? '—'} unit="files"
                sub={`${summary?.totalLoc?.toLocaleString() ?? '—'} LOC`} icon="data_object" accentColor="primary"
                footerRight={isSample ? 'SAMPLE' : 'LIVE'} />
              <KpiCard label="High Risk" value={summary?.riskCounts?.high ?? '—'} unit="flagged"
                icon="warning" accentColor="risk-high" footer="score ≥ 70" />
              <KpiCard label="Medium Risk" value={summary?.riskCounts?.medium ?? '—'} unit="review"
                icon="priority_high" accentColor="risk-medium" footer="40 ≤ score < 70" />
              <KpiCard label="Low Risk" value={summary?.riskCounts?.low ?? '—'} unit="healthy"
                icon="check_circle" accentColor="risk-low" footer="score < 40" />
            </div>

            {/* Search + filter toolbar */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-space-sm">
              <div className="flex items-center flex-1 gap-2 px-3 py-2.5 rounded-lg"
                style={{ background: '#05100e', border: '1px solid rgba(242,247,245,0.10)' }}>
                <span className="material-symbols-outlined text-[18px] text-text-muted">search</span>
                <input
                  type="text" value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Filter by filename…"
                  className="flex-1 bg-transparent font-jetbrains text-[13px] text-text-primary placeholder-text-muted/40 outline-none" />
                {search && (
                  <button onClick={() => setSearch('')} className="text-text-muted hover:text-text-primary">
                    <span className="material-symbols-outlined text-[16px]">close</span>
                  </button>
                )}
              </div>
              <div className="flex items-center gap-1.5 p-1 rounded-full"
                style={{ background: '#05100e', border: '1px solid rgba(242,247,245,0.08)' }}>
                {['all', 'high', 'medium', 'low'].map(lvl => (
                  <button key={lvl} onClick={() => setFilterLevel(lvl)} type="button"
                    className={`px-space-md py-1.5 rounded-full font-inter text-[13px] font-medium transition-all capitalize ${filterLevel === lvl ? 'bg-primary-container text-on-primary-container font-semibold' : 'text-on-surface-variant hover:text-on-surface'}`}
                    style={filterLevel === lvl ? { boxShadow: '0 0 12px rgba(42,174,155,0.30)' } : {}}>
                    {lvl === 'all' ? 'All' : lvl.charAt(0).toUpperCase() + lvl.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Table + detail panel */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-space-md items-start">

              {/* Table */}
              <GlassCard className={`xl:col-span-${selRow ? 2 : 3} overflow-auto p-0`} padding={false}>
                <table className="w-full text-left border-collapse font-inter text-[13px] min-w-[600px]">
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(242,247,245,0.10)', background: '#05100e' }}>
                      {[
                        { label: 'File', key: 'filename' },
                        { label: 'Risk Score', key: 'risk_score' },
                        { label: 'Category', key: null },
                        { label: 'LOC', key: 'loc' },
                        { label: 'Complexity', key: 'cyclomatic_complexity' },
                        { label: 'Smells', key: 'smell_count_total' },
                      ].map(({ label, key }) => (
                        <th key={label}
                          className={`px-4 py-3 text-[11px] uppercase tracking-widest text-text-muted font-semibold ${key ? 'cursor-pointer hover:text-text-primary select-none' : ''}`}
                          onClick={() => key && toggleSort(key)}>
                          <span className="flex items-center gap-1">{label}{key && <SortIcon k={key} />}</span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRows.map((row, i) => {
                      const color = RISK_COLOR[row._riskLevel] || '#A6BBB5'
                      const isSel = selected === i
                      return (
                        <tr key={row.filename}
                          className="cursor-pointer transition-colors"
                          style={{
                            borderBottom: '1px solid rgba(242,247,245,0.06)',
                            background: isSel ? `${color}10` : 'transparent',
                          }}
                          onClick={() => setSelected(isSel ? null : i)}>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              {isSel && <span className="w-1.5 h-full rounded-full" style={{ background: color }} />}
                              <span className="font-jetbrains text-text-primary truncate max-w-[180px]"
                                title={row.filename}>{row._displayName}</span>
                              {row.has_insufficient_history && (
                                <span title="Limited git history" className="material-symbols-outlined text-[14px] text-text-muted/50">info</span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-col gap-1">
                              <span className="font-jetbrains font-semibold" style={{ color }}>{row.risk_score?.toFixed(1) ?? '—'}</span>
                              <div className="h-1 w-16 rounded-full overflow-hidden" style={{ background: '#05100e' }}>
                                <div className="h-full rounded-full" style={{ width: `${row.risk_score ?? 0}%`, background: color }} />
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3"><RiskBadge level={row._riskLevel} size="sm" /></td>
                          <td className="px-4 py-3 font-jetbrains text-text-muted">{row.loc ?? '—'}</td>
                          <td className="px-4 py-3 font-jetbrains text-text-muted">{row.cyclomatic_complexity ?? '—'}</td>
                          <td className="px-4 py-3 font-jetbrains text-text-muted">{row.smell_count_total ?? '—'}</td>
                        </tr>
                      )
                    })}
                    {filteredRows.length === 0 && (
                      <tr><td colSpan="6" className="px-4 py-12 text-center font-inter text-text-muted">
                        {rows.length === 0 ? 'Upload a metrics.csv to explore files.' : 'No files match the current filter.'}
                      </td></tr>
                    )}
                  </tbody>
                </table>
              </GlassCard>

              {/* Detail panel */}
              {selRow && (
                <GlassCard className="flex flex-col gap-space-md sticky top-24">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-jetbrains text-[11px] text-text-muted uppercase tracking-wider mb-1">Selected File</p>
                      <h3 className="font-sora font-semibold text-text-primary text-[16px] truncate">{selRow._displayName}</h3>
                      <p className="font-jetbrains text-[11px] text-text-muted mt-0.5 truncate">{selRow.filename}</p>
                    </div>
                    <button onClick={() => setSelected(null)} className="shrink-0 text-text-muted hover:text-text-primary">
                      <span className="material-symbols-outlined">close</span>
                    </button>
                  </div>

                  <RiskBadge level={selRow._riskLevel} score={selRow.risk_score} pulse={selRow._riskLevel === 'high'} />

                  {/* Metrics grid */}
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { label: 'LOC', value: selRow.loc },
                      { label: 'CC', value: selRow.cyclomatic_complexity },
                      { label: 'Functions', value: selRow.function_count },
                      { label: 'Classes', value: selRow.class_count },
                      { label: 'Nesting', value: selRow.max_nesting_depth },
                      { label: 'Smells', value: selRow.smell_count_total },
                      { label: 'Commits', value: selRow.commit_count },
                      { label: 'MI', value: selRow.maintainability_index?.toFixed(1) },
                    ].map(({ label, value }) => (
                      <div key={label} className="rounded-lg px-3 py-2 flex flex-col gap-0.5"
                        style={{ background: '#05100e', border: '1px solid rgba(242,247,245,0.08)' }}>
                        <span className="font-inter text-[11px] text-text-muted uppercase tracking-wider">{label}</span>
                        <span className="font-jetbrains text-text-primary font-semibold">{value ?? '—'}</span>
                      </div>
                    ))}
                  </div>

                  {/* Smell breakdown */}
                  {selRow.smell_breakdown && (
                    <div>
                      <p className="font-inter text-[11px] text-text-muted uppercase tracking-wider mb-2">Smell Breakdown</p>
                      <div className="flex flex-wrap gap-1.5">
                        {Object.entries(selRow.smell_breakdown).map(([k, v]) => (
                          <span key={k} className="font-jetbrains text-[11px] px-2 py-0.5 rounded-full"
                            style={{
                              background: v > 0 ? 'rgba(245,192,79,0.12)' : '#05100e',
                              border: `1px solid ${v > 0 ? 'rgba(245,192,79,0.30)' : 'rgba(242,247,245,0.08)'}`,
                              color: v > 0 ? '#F5C04F' : '#A6BBB5',
                            }}>
                            {SMELL_LABELS[k] ?? k} {v}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* AI explanation */}
                  {selRow.ai_explanation && (
                    <div className="rounded-lg p-3 text-[12px] font-inter text-text-muted leading-relaxed"
                      style={{ background: '#05100e', border: '1px solid rgba(97,218,197,0.15)' }}>
                      <p className="text-[11px] uppercase tracking-wider text-primary mb-1.5 font-semibold">AI Explanation</p>
                      {selRow.ai_explanation}
                    </div>
                  )}

                  {selRow.has_insufficient_history && (
                    <p className="font-inter text-[11px] text-text-muted/60 italic">
                      ⚠ Limited git history — behavioral signals may be less reliable.
                    </p>
                  )}
                </GlassCard>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}