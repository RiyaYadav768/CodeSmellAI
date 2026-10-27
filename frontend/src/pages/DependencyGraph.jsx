/**
 * DependencyGraph — /graph route
 * Stitch: "CodeSmellAI — Dependency Graph"
 *
 * EDGE DATA LIMITATION: The metrics.csv does not export dependency edges.
 * Only per-file node metrics (degree, in_degree, pagerank) are available.
 * This page renders a node-metrics view (sorted by degree/pagerank) and
 * explicitly communicates the limitation. No edges are fabricated.
 */
import { useState } from 'react'
import { Navbar, GlassCard, KpiCard, RiskBadge, SampleDataBanner } from '../components'
import { useMetrics } from '../hooks/MetricsContext.jsx'

const RISK_COLOR = { high: '#FF8374', medium: '#F5C04F', low: '#6EDC9B' }

// SVG node layout — positions for up to N nodes in a simple force-like grid
function nodePositions(n, W = 540, H = 260) {
  const positions = []
  const cols = Math.ceil(Math.sqrt(n * 1.6))
  const rows = Math.ceil(n / cols)
  for (let i = 0; i < n; i++) {
    const col = i % cols, row = Math.floor(i / cols)
    const x = 60 + (col / Math.max(cols - 1, 1)) * (W - 120)
    const y = 40 + (row / Math.max(rows - 1, 1)) * (H - 80)
    positions.push({ x, y })
  }
  return positions
}

function NodeGraph({ nodes }) {
  const [hovered, setHovered] = useState(null)
  if (!nodes.length) return null
  const positions = nodePositions(nodes.length)
  // radius scaled by degree, min 8 max 22
  const maxDeg = Math.max(...nodes.map(n => n.degree ?? 1), 1)

  return (
    <svg viewBox="0 0 540 280" className="w-full h-full">
      <defs>
        <pattern id="gdots" patternUnits="userSpaceOnUse" width="20" height="20">
          <circle cx="2" cy="2" r="1" fill="#162824" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#gdots)" />
      {/* note: no edges — not in CSV */}
      {nodes.map((node, i) => {
        const { x, y } = positions[i]
        const color = RISK_COLOR[node._riskLevel] || '#61dac5'
        const r = 8 + Math.round(((node.degree ?? 0) / maxDeg) * 14)
        const isH = hovered === i
        return (
          <g key={node.filename} className="cursor-pointer" onClick={() => setHovered(isH ? null : i)}
            style={{ transition: 'filter 0.2s' }}
            filter={isH ? `drop-shadow(0 0 8px ${color})` : 'none'}>
            {isH && <circle cx={x} cy={y} r={r + 8} fill={`${color}18`} />}
            <circle cx={x} cy={y} r={r} fill={isH ? '#220d0b' : '#121e1c'}
              stroke={color} strokeWidth={isH ? 2.5 : 1.5} />
            {node.degree > 2 && <circle cx={x} cy={y} r={r * 0.35} fill={color} opacity={0.8} />}
            <text x={x} y={y + r + 12} fontFamily="JetBrains Mono" fontSize="9"
              fill={isH ? color : '#869490'} textAnchor="middle">{node._displayName}</text>
          </g>
        )
      })}
      {/* selected node detail */}
      {hovered != null && (() => {
        const node = nodes[hovered]
        const { x, y } = positions[hovered]
        const color = RISK_COLOR[node._riskLevel] || '#61dac5'
        return (
          <g>
            <rect x={Math.min(x + 12, 390)} y={Math.max(y - 55, 2)} width="140" height="52" rx="6"
              fill="#0B1D1A" stroke={color} strokeWidth="1" strokeOpacity="0.5" />
            <text x={Math.min(x + 18, 396)} y={Math.max(y - 37, 18)} fontFamily="JetBrains Mono" fontSize="9.5" fill="#F2F7F5" fontWeight="600">
              {node._displayName}
            </text>
            <text x={Math.min(x + 18, 396)} y={Math.max(y - 24, 31)} fontFamily="JetBrains Mono" fontSize="9" fill={color}>
              Score: {node.risk_score?.toFixed(1)} · PR: {node.pagerank?.toFixed(4)}
            </text>
            <text x={Math.min(x + 18, 396)} y={Math.max(y - 11, 44)} fontFamily="JetBrains Mono" fontSize="9" fill="#A6BBB5">
              Degree: in={node.in_degree ?? 0} out={((node.degree ?? 0) - (node.in_degree ?? 0))}
            </text>
          </g>
        )
      })()}
    </svg>
  )
}

export default function DependencyGraph() {
  const { rows, summary, isSample, meta, loadFile, isLoading, errors } = useMetrics()
  const [sortKey, setSortKey] = useState('pagerank')

  const graphNodes = [...rows]
    .filter(r => r._hasGraphData || r.degree != null)
    .sort((a, b) => (b[sortKey] ?? 0) - (a[sortKey] ?? 0))

  return (
    <div className="min-h-screen bg-bg-base text-text-primary flex flex-col">
      <Navbar route="graph" />

      <div className="pt-20 flex flex-col flex-1">
        {isLoading && <div className="w-full py-3 px-gutter text-center font-inter text-sm text-primary animate-pulse" style={{ background: 'rgba(97,218,197,0.08)' }}>Loading…</div>}
        {errors.map((e, i) => <div key={i} className="w-full py-2 px-gutter font-inter text-sm text-risk-high" style={{ background: 'rgba(255,131,116,0.08)' }}>{e}</div>)}
        <SampleDataBanner visible={isSample && !isLoading} repoName={meta?.repoName ?? 'CodeSmellAI'}
          moduleCount={summary?.totalFiles ?? 0} />

        <main className="flex-1 px-gutter-mobile md:px-gutter-tablet lg:px-gutter py-space-xl">
          <div className="max-w-[1200px] mx-auto flex flex-col gap-space-xl">

            {/* Page header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-space-md">
              <div>
                <div className="flex items-center gap-2 font-inter text-xs uppercase tracking-widest text-secondary mb-1.5">
                  <span className="material-symbols-outlined text-[16px] text-primary">bubble_chart</span>
                  Structural Dependency Analysis
                </div>
                <h1 className="font-sora text-[28px] md:text-[36px] font-bold tracking-tight text-text-primary">Dependency Graph</h1>
                <p className="font-inter text-text-muted text-[15px] mt-1">Node centrality metrics from the AST import graph.</p>
              </div>
            </div>

            {/* Limitation notice */}
            <GlassCard className="flex items-start gap-3" noBorder={false} hoverable={false}>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                style={{ background: 'rgba(171,213,80,0.12)', border: '1px solid rgba(171,213,80,0.30)' }}>
                <span className="material-symbols-outlined text-[18px] text-tertiary">info</span>
              </div>
              <div>
                <p className="font-sora font-semibold text-text-primary text-[15px] mb-1">Dependency Edges Not Available in CSV</p>
                <p className="font-inter text-[13px] text-text-muted leading-relaxed">
                  The <code className="font-jetbrains text-primary text-[12px]">metrics.csv</code> file contains per-file
                  node metrics (degree, in_degree, PageRank) but <strong>does not export the edge list</strong>.
                  The actual import graph is computed at runtime by <code className="font-jetbrains text-primary text-[12px]">graph_builder.py</code> using NetworkX
                  and saved as <code className="font-jetbrains text-primary text-[12px]">dependency_graph.png</code>.
                  <br /><br />
                  <strong className="text-text-primary">What you see below:</strong> File nodes sized and colored by their structural centrality metrics.
                  Click a node for details. To view the full dependency graph with edges, open <code className="font-jetbrains text-primary text-[12px]">dependency_graph.png</code> generated by the CLI.
                </p>
              </div>
            </GlassCard>

            {/* KPI strip */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-space-md">
              <KpiCard label="Graph Nodes" value={graphNodes.length} unit="files"
                icon="hub" accentColor="primary" footer="Files with degree data" />
              <KpiCard label="Max Degree" value={Math.max(...rows.map(r => r.degree ?? 0), 0)}
                icon="account_tree" accentColor="secondary" footer="Highest out-degree" />
              <KpiCard label="Max In-Degree" value={Math.max(...rows.map(r => r.in_degree ?? 0), 0)}
                icon="input" accentColor="primary" footer="Most-imported file" />
              <KpiCard label="Max PageRank" value={Math.max(...rows.map(r => r.pagerank ?? 0), 0).toFixed(4)}
                icon="insights" accentColor="risk-medium" footer="Highest centrality" />
            </div>

            {/* SVG node visualization */}
            <GlassCard className="flex flex-col gap-space-md" padding={false}>
              <div className="flex items-center justify-between p-space-lg pb-0 flex-wrap gap-2">
                <div>
                  <h2 className="font-sora font-semibold text-text-primary text-[18px]">Module Centrality Map</h2>
                  <p className="font-inter text-[13px] text-text-muted mt-0.5">
                    Node size = degree centrality · Color = risk level · Click node for details
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-inter text-[12px] text-text-muted">Sort by:</span>
                  {['pagerank', 'degree', 'risk_score'].map(k => (
                    <button key={k} onClick={() => setSortKey(k)} type="button"
                      className={`px-3 py-1.5 rounded-full font-inter text-[12px] transition-all capitalize ${sortKey === k ? 'bg-primary-container text-on-primary-container font-semibold' : 'text-on-surface-variant hover:text-on-surface'}`}
                      style={sortKey === k ? { background: '#2aae9b', color: '#003730' } : {}}>
                      {k.replace('_', ' ')}
                    </button>
                  ))}
                </div>
              </div>
              <div className="relative w-full" style={{ height: '320px', background: '#061412', borderTop: '1px solid rgba(242,247,245,0.06)', borderBottom: '1px solid rgba(242,247,245,0.06)' }}>
                {graphNodes.length > 0
                  ? <NodeGraph nodes={graphNodes.slice(0, 25)} />
                  : <div className="flex items-center justify-center h-full">
                      <p className="font-inter text-text-muted text-sm">Upload a metrics.csv to see graph node data.</p>
                    </div>
                }
                <div className="absolute bottom-2 right-2 font-jetbrains text-[10px] text-text-muted/50 px-2 py-0.5 rounded"
                  style={{ background: 'rgba(6,20,18,0.80)' }}>
                  Showing up to 25 nodes by {sortKey} · Edges not available from CSV
                </div>
              </div>
              {/* Legend */}
              <div className="flex flex-wrap items-center gap-space-md px-space-lg pb-space-lg">
                {[{ color: '#FF8374', label: 'High Risk' }, { color: '#F5C04F', label: 'Medium Risk' }, { color: '#6EDC9B', label: 'Low Risk' }].map(({ color, label }) => (
                  <div key={label} className="flex items-center gap-2">
                    <svg width="16" height="16"><circle cx="8" cy="8" r="7" fill={`${color}20`} stroke={color} strokeWidth="1.5" /></svg>
                    <span className="font-inter text-[12px] text-text-muted">{label}</span>
                  </div>
                ))}
                <div className="flex items-center gap-2">
                  <svg width="20" height="16">
                    <circle cx="6" cy="8" r="4" fill="#162220" stroke="#61dac5" strokeWidth="1.5" />
                    <circle cx="15" cy="8" r="7" fill="#162220" stroke="#61dac5" strokeWidth="1.5" />
                  </svg>
                  <span className="font-inter text-[12px] text-text-muted">Node size = degree</span>
                </div>
              </div>
            </GlassCard>

            {/* Node table */}
            <GlassCard className="overflow-auto flex flex-col gap-space-md">
              <h2 className="font-sora font-semibold text-text-primary text-[18px]">Node Metrics Table</h2>
              <table className="w-full text-left border-collapse font-inter text-[13px] min-w-[600px]">
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(242,247,245,0.10)' }}>
                    {['File', 'Degree', 'In-Degree', 'PageRank', 'Risk Score', 'Category'].map(h => (
                      <th key={h} className="pb-3 pr-4 font-inter text-[11px] uppercase tracking-widest text-text-muted font-semibold">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {graphNodes.map(row => (
                    <tr key={row.filename} style={{ borderBottom: '1px solid rgba(242,247,245,0.06)' }} className="hover:bg-surface-container/20 transition-colors">
                      <td className="py-2.5 pr-4 font-jetbrains text-text-primary truncate max-w-[180px]" title={row.filename}>{row._displayName}</td>
                      <td className="py-2.5 pr-4 font-jetbrains text-text-muted">{row.degree ?? '—'}</td>
                      <td className="py-2.5 pr-4 font-jetbrains text-text-muted">{row.in_degree ?? '—'}</td>
                      <td className="py-2.5 pr-4 font-jetbrains text-primary">{row.pagerank?.toFixed(4) ?? '—'}</td>
                      <td className="py-2.5 pr-4 font-jetbrains font-semibold" style={{ color: RISK_COLOR[row._riskLevel] || '#F2F7F5' }}>{row.risk_score?.toFixed(1) ?? '—'}</td>
                      <td className="py-2.5"><RiskBadge level={row._riskLevel} size="sm" /></td>
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