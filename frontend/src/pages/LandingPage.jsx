/**
 * LandingPage — / route
 * Stitch: "CodeSmellAI — Python Codebase Risk Analysis Landing Page (Animated)"
 * Sections: floating nav, hero, product preview, features, how-it-works, pipeline, CTA
 */
import { Link } from 'react-router-dom'
import { useMetrics } from '../hooks/MetricsContext.jsx'

/* ── Ambient background (streaks + blobs, no animation libs needed) ─────── */
function AmbientBg() {
  return (
    <div aria-hidden="true" className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
      <div className="absolute -top-[10%] left-1/2 -translate-x-1/2 w-[900px] h-[550px] rounded-full blur-[140px]"
        style={{ background: 'rgba(97,218,197,0.08)' }} />
      <div className="absolute top-[40%] -right-[10%] w-[600px] h-[600px] rounded-full blur-[160px]"
        style={{ background: 'rgba(0,177,161,0.04)' }} />
      <div className="absolute top-[75%] -left-[10%] w-[500px] h-[500px] rounded-full blur-[140px]"
        style={{ background: 'rgba(97,218,197,0.04)' }} />
      {/* animated wave SVG */}
      <svg className="absolute inset-0 w-full h-full opacity-40" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="wg1" x1="0%" x2="100%" y1="0%" y2="0%">
            <stop offset="0%" stopColor="#2AAE9B" stopOpacity="0.04" />
            <stop offset="50%" stopColor="#51dbca" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#c7f169" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <path d="M -100 280 C 250 180,500 360,850 240 C 1150 140,1350 290,1600 210"
          fill="none" stroke="url(#wg1)" strokeWidth="1.8" />
        <path d="M -80 520 C 300 420,600 620,950 480 C 1220 380,1400 530,1650 450"
          fill="none" stroke="url(#wg1)" strokeWidth="1.5" />
      </svg>
    </div>
  )
}

/* ── Hero dashboard mini-preview ─────────────────────────────────────────── */
function DashboardPreview({ summary }) {
  const topFiles = summary?.topByRisk?.slice(0, 5) ?? []
  const RISK_COLOR = { high: '#FF8374', medium: '#F5C04F', low: '#6EDC9B' }

  return (
    <div
      className="mt-14 w-full max-w-[1140px] rounded-3xl overflow-hidden text-left"
      style={{
        background: 'rgba(10,21,19,0.85)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(255,255,255,0.10)',
        boxShadow: 'rgba(255,255,255,0.12) 0px 1px 0px inset, rgba(0,0,0,0.85) 0px 24px 60px -15px, rgba(42,174,155,0.20) 0px 0px 54px',
      }}
    >
      {/* Titlebar */}
      <div className="h-10 px-4 flex items-center justify-between border-b border-white/10"
        style={{ background: '#121e1c' }}>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-[#ff5f56]/70" />
          <span className="w-3 h-3 rounded-full bg-[#ffbd2e]/70" />
          <span className="w-3 h-3 rounded-full bg-[#27c93f]/70" />
          <div className="ml-4 flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-mono"
            style={{ background: '#162220', color: '#A6BBB5' }}>
            <span className="material-symbols-outlined text-[13px] text-primary">folder</span>
            <span>sample-python-project</span>
            <span className="text-outline">/</span>
            <span style={{ color: '#F2F7F5' }}>main</span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full font-mono font-bold text-[11px] tracking-wider"
          style={{ background: 'rgba(245,192,79,0.10)', border: '1px solid rgba(245,192,79,0.40)', color: '#F5C04F' }}>
          <span className="w-1.5 h-1.5 rounded-full bg-risk-medium animate-pulse" />
          SAMPLE DATA
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 border-b border-white/10"
        style={{ gap: '1px', background: 'rgba(255,255,255,0.06)' }}>
        {[
          { label: 'Modules', value: summary?.totalFiles ?? 10, sub: 'Analyzed Files' },
          { label: 'Code Smells', value: summary?.totalSmells ?? 12, sub: 'Detected' },
          { label: 'LOC', value: summary?.totalLoc ?? 832, sub: 'Total Lines' },
          { label: 'High-Risk', value: summary?.riskCounts?.high ?? 0, sub: '≥ 70 pts', color: summary?.riskCounts?.high > 0 ? '#FF8374' : '#6EDC9B' },
        ].map(({ label, value, sub, color }) => (
          <div key={label} className="p-4" style={{ background: '#121e1c' }}>
            <span className="text-xs text-text-muted block font-medium">{label}</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-bold font-sora" style={{ color: color || '#F2F7F5' }}>{value}</span>
              <span className="text-[11px] text-text-muted">{sub}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Risk table */}
      <div className="p-5" style={{ background: 'rgba(18,30,28,0.6)' }}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold font-sora text-text-primary">Ranked Repository Risk</h3>
          <span className="text-[11px] text-text-muted font-mono">Relative Rank</span>
        </div>
        <div className="space-y-1.5 font-mono text-xs">
          {topFiles.map((f, i) => {
            const color = RISK_COLOR[f._riskLevel] || '#A6BBB5'
            const pct = Math.round(f.risk_score ?? 0)
            return (
              <div key={f.filename} className="relative overflow-hidden p-2.5 rounded-lg flex items-center justify-between"
                style={{ background: 'rgba(33,44,42,0.9)', border: `1px solid ${color}25` }}>
                <div className="absolute left-0 top-0 bottom-0 rounded-l-lg"
                  style={{ width: `${pct}%`, background: `${color}12` }} />
                <div className="relative flex items-center gap-2">
                  <span className="text-text-muted">{i + 1}.</span>
                  <span className="text-text-primary font-semibold">{f._displayName}</span>
                </div>
                <span className="relative px-2 py-0.5 rounded font-bold text-[11px]"
                  style={{ background: `${color}18`, border: `1px solid ${color}35`, color }}>
                  {pct} {f._riskLevel?.toUpperCase()}
                </span>
              </div>
            )
          })}
        </div>
        <p className="mt-3 text-xs text-text-muted/70 italic text-center">
          Illustrative interface with SAMPLE DATA. Not connected to a live scan.
        </p>
      </div>
    </div>
  )
}

/* ── Feature card ────────────────────────────────────────────────────────── */
function FeatureCard({ icon, title, desc, accent = '#61dac5' }) {
  return (
    <div className="relative p-6 rounded-xl flex flex-col gap-3 transition-all hover:-translate-y-1"
      style={{
        background: 'rgba(16,39,35,0.55)',
        backdropFilter: 'blur(18px)',
        border: '1px solid rgba(242,247,245,0.10)',
        boxShadow: '0 24px 60px -20px rgba(0,0,0,0.5)',
      }}>
      <div className="absolute top-0 inset-x-0 h-0.5 rounded-t-xl"
        style={{ background: `linear-gradient(90deg,${accent}50 0%,${accent} 50%,transparent 100%)` }} />
      <div className="w-10 h-10 rounded-lg flex items-center justify-center"
        style={{ background: `${accent}15`, border: `1px solid ${accent}30` }}>
        <span className="material-symbols-outlined text-[22px]" style={{ color: accent }}>{icon}</span>
      </div>
      <h3 className="font-sora font-semibold text-text-primary text-[17px] leading-snug">{title}</h3>
      <p className="font-inter text-[15px] text-text-muted leading-relaxed">{desc}</p>
    </div>
  )
}

/* ── Pipeline step ────────────────────────────────────────────────────────── */
function PipelineStep({ step, icon, title, desc, accent = '#61dac5' }) {
  return (
    <div className="flex flex-col sm:flex-row items-start gap-5">
      <div className="flex flex-col items-center shrink-0">
        <div className="w-10 h-10 rounded-full flex items-center justify-center font-sora font-bold text-[15px]"
          style={{ background: `${accent}20`, border: `2px solid ${accent}40`, color: accent }}>{step}</div>
        <div className="w-px flex-1 mt-2 hidden sm:block" style={{ background: `${accent}20`, minHeight: '32px' }} />
      </div>
      <div className="pt-1 pb-6">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="material-symbols-outlined text-[18px]" style={{ color: accent }}>{icon}</span>
          <span className="font-sora font-semibold text-text-primary text-[16px]">{title}</span>
        </div>
        <p className="font-inter text-[15px] text-text-muted leading-relaxed">{desc}</p>
      </div>
    </div>
  )
}

export default function LandingPage() {
  const { summary } = useMetrics()

  return (
    <div className="min-h-screen bg-bg-base text-text-primary overflow-x-hidden">
      <AmbientBg />

      {/* ── Floating Nav ───────────────────────────────────────────────── */}
      <div className="sticky top-4 z-50 flex justify-center px-4 w-full">
        <nav className="flex items-center justify-between w-full max-w-[1120px] h-14 md:h-16 px-4 md:px-6 rounded-full"
          style={{
            background: 'rgba(16,39,35,0.65)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(242,247,245,0.10)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.45)',
          }}>
          <a href="#top" className="flex items-center gap-2.5 group no-underline">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center text-primary"
              style={{ background: '#212c2a', border: '1px solid rgba(242,247,245,0.10)' }}>
              <span className="material-symbols-outlined text-[16px]">terminal</span>
            </div>
            <span className="font-sora text-text-primary text-base font-bold tracking-tight">CodeSmellAI</span>
          </a>

          <div className="hidden md:flex items-center gap-7">
            {['#features', '#how-it-works', '#pipeline', '#methodology'].map((href, i) => (
              <a key={href} href={href}
                className="text-sm font-medium text-text-muted hover:text-text-primary transition-colors no-underline">
                {['Features', 'How It Works', 'Pipeline', 'Methodology'][i]}
              </a>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <Link to="/results"
              className="hidden sm:inline-flex items-center gap-1.5 h-9 px-4 rounded-full font-inter font-semibold text-sm text-text-primary no-underline transition-all"
              style={{ background: '#212c2a', border: '1px solid rgba(242,247,245,0.10)' }}>
              View Dashboard
            </Link>
            <a href="https://github.com/RiyaYadav768/CodeSmellAI" target="_blank" rel="noopener noreferrer"
              className="h-9 px-4 rounded-full font-inter font-semibold text-sm flex items-center gap-1.5 no-underline"
              style={{ background: '#212c2a', border: '1px solid rgba(242,247,245,0.10)', color: '#F2F7F5' }}>
              <span>GitHub</span>
              <span className="material-symbols-outlined text-[14px] text-text-muted">open_in_new</span>
            </a>
          </div>
        </nav>
      </div>

      <main className="relative z-10" id="top">
        {/* ── Hero ─────────────────────────────────────────────────────── */}
        <section className="pt-14 md:pt-20 pb-16 px-4 flex flex-col items-center text-center">
          {/* Eyebrow */}
          <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full mb-8"
            style={{
              background: 'rgba(16,39,35,0.70)',
              border: '1px solid rgba(82,220,203,0.22)',
              boxShadow: '0 0 16px rgba(42,174,155,0.12)',
              backdropFilter: 'blur(12px)',
            }}>
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
            </span>
            <span className="text-[11px] font-mono font-semibold uppercase tracking-[0.12em] text-on-surface/90">
              Python code risk analysis · open source
            </span>
          </div>

          {/* Headline */}
          <h1 className="font-sora text-[36px] sm:text-[50px] md:text-[66px] lg:text-[72px] font-bold tracking-[-0.035em] leading-[1.05] max-w-[980px] mb-6">
            <span className="block">Know Your Codebase.</span>
            <span className="bg-gradient-to-r from-text-primary via-[#b9ece5] to-secondary bg-clip-text text-transparent block">
              Spot Risk Before You Change It.
            </span>
          </h1>

          <p className="max-w-2xl text-[16px] md:text-[19px] font-normal text-text-muted leading-[1.65] mb-9 font-inter">
            CodeSmellAI maps how your Python files depend on each other, flags code smells,
            and combines them with git history into an explainable risk score — so you know
            which files deserve care before you change them.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center gap-4 mb-5">
            <Link to="/results"
              className="w-full sm:w-auto h-[52px] px-8 rounded-full font-inter font-semibold text-base flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.99] no-underline"
              style={{
                background: 'linear-gradient(180deg,rgba(200,243,106,0.32) 0%,rgba(200,243,106,0.14) 100%)',
                border: '1px solid #abd550',
                color: '#F2F7F5',
                boxShadow: '0 0 24px rgba(200,243,106,0.22),inset 0 1px 1px rgba(255,255,255,0.4)',
              }}>
              <span>Explore the Dashboard</span>
              <span className="material-symbols-outlined text-tertiary text-lg">arrow_forward</span>
            </Link>
            <a href="#how-it-works"
              className="w-full sm:w-auto h-[52px] px-8 rounded-full font-inter font-semibold text-base flex items-center justify-center gap-2 transition-all hover:scale-[1.02] no-underline"
              style={{
                background: 'rgba(97,218,197,0.10)',
                border: '1px solid rgba(82,220,203,0.35)',
                color: '#F2F7F5',
                backdropFilter: 'blur(12px)',
              }}>
              <span>See How It Works</span>
              <span className="material-symbols-outlined text-secondary text-lg">arrow_downward</span>
            </a>
          </div>

          <p className="text-xs md:text-sm text-text-muted/80">
            Open source · MIT licence · CLI and GitHub Action · Python 3.9+
          </p>

          <DashboardPreview summary={summary} />
        </section>

        {/* ── Features ─────────────────────────────────────────────────── */}
        <section className="py-20 px-4 max-w-[1120px] mx-auto" id="features">
          <div className="text-center mb-14">
            <span className="font-inter text-[11px] uppercase tracking-[0.12em] text-secondary font-semibold block mb-3">
              Core Capabilities
            </span>
            <h2 className="font-sora text-[38px] md:text-[48px] font-bold tracking-tight leading-[1.1] text-text-primary">
              Everything you need to understand risk
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            <FeatureCard icon="hub" accent="#61dac5"
              title="Dependency Graph"
              desc="AST-powered import graph reveals which modules are structurally central — high in-degree files carry the most blast radius." />
            <FeatureCard icon="pest_control" accent="#F5C04F"
              title="Code Smell Detection"
              desc="Detects long functions, deep nesting, too many parameters, large files, and god classes via static AST analysis." />
            <FeatureCard icon="history" accent="#6EDC9B"
              title="Git History Signals"
              desc="Bug-fix commit patterns, author churn, and commit frequency add behavioral evidence to the structural risk score." />
            <FeatureCard icon="analytics" accent="#51dbca"
              title="Explainable Risk Score"
              desc="A weighted composite 0–100 score per file with per-factor contribution breakdown. No black boxes." />
            <FeatureCard icon="smart_toy" accent="#abd550"
              title="AI Narrative"
              desc="Each file gets a plain-English explanation of its top risk contributors, generated directly from the scoring model." />
            <FeatureCard icon="terminal" accent="#80f7e1"
              title="CLI + GitHub Action"
              desc="Run locally with one command or embed in CI to gate PRs on repository-wide risk regressions." />
          </div>
        </section>

        {/* ── How It Works ─────────────────────────────────────────────── */}
        <section className="py-20 px-4" id="how-it-works"
          style={{ background: 'rgba(8,23,20,0.60)' }}>
          <div className="max-w-[800px] mx-auto">
            <div className="text-center mb-14">
              <span className="font-inter text-[11px] uppercase tracking-[0.12em] text-secondary font-semibold block mb-3">
                How It Works
              </span>
              <h2 className="font-sora text-[38px] md:text-[48px] font-bold tracking-tight leading-[1.1] text-text-primary">
                From code to risk in one command
              </h2>
            </div>
            <div>
              <PipelineStep step="1" icon="search" accent="#61dac5"
                title="Scan Python Files"
                desc="CodeSmellAI recursively discovers all .py files and builds an AST for each, extracting cyclomatic complexity, LOC, nesting depth, function count, and class count." />
              <PipelineStep step="2" icon="hub" accent="#51dbca"
                title="Build Dependency Graph"
                desc="Import statements are traced to build a directed dependency graph using NetworkX. PageRank centrality is computed per file, revealing structural hotspots." />
              <PipelineStep step="3" icon="pest_control" accent="#F5C04F"
                title="Detect Code Smells"
                desc="Five smell patterns are checked per file: long functions (>50 LOC), deep nesting (>4 levels), too many parameters (>5), large files (>500 LOC), and god classes." />
              <PipelineStep step="4" icon="history" accent="#6EDC9B"
                title="Mine Git History"
                desc="Commit frequency, bug-fix keywords in commit messages, and distinct author count are extracted per file to add behavioral signals." />
              <PipelineStep step="5" icon="analytics" accent="#abd550"
                title="Compute & Export Risk Score"
                desc="Nine normalized metrics are combined via weighted sum (weights sum to 1.0). The result is a 0–100 risk score per file with category and per-factor contribution breakdown, exported as metrics.csv." />
            </div>
          </div>
        </section>

        {/* ── Pipeline command ─────────────────────────────────────────── */}
        <section className="py-20 px-4 max-w-[1120px] mx-auto" id="pipeline">
          <div className="text-center mb-12">
            <span className="font-inter text-[11px] uppercase tracking-[0.12em] text-secondary font-semibold block mb-3">
              Getting Started
            </span>
            <h2 className="font-sora text-[38px] md:text-[48px] font-bold tracking-tight leading-[1.1] text-text-primary">
              Install and run in 30 seconds
            </h2>
          </div>
          <div className="max-w-[720px] mx-auto rounded-xl overflow-hidden"
            style={{
              background: '#061412',
              border: '1px solid rgba(97,218,197,0.20)',
              boxShadow: '0 0 40px rgba(42,174,155,0.10)',
            }}>
            <div className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <span className="w-3 h-3 rounded-full bg-[#ff5f56]/70" />
              <span className="w-3 h-3 rounded-full bg-[#ffbd2e]/70" />
              <span className="w-3 h-3 rounded-full bg-[#27c93f]/70" />
              <span className="ml-4 font-mono text-xs text-text-muted">bash — codesmell-ai</span>
            </div>
            <div className="p-6 font-mono text-sm space-y-2">
              <div><span className="text-text-muted">$ </span><span className="text-primary">pip install codesmell-ai</span></div>
              <div><span className="text-text-muted">$ </span><span className="text-primary">codesmell-ai --repo-path ./my-project</span></div>
              <div className="text-text-muted pt-2">✓ Scanned 10 files · Built dependency graph</div>
              <div className="text-text-muted">✓ Detected 7 code smells · Mined git history</div>
              <div style={{ color: '#6EDC9B' }}>✓ Exported metrics.csv — open the dashboard</div>
            </div>
          </div>
        </section>

        {/* ── Methodology quick-link ───────────────────────────────────── */}
        <section className="py-20 px-4" id="methodology"
          style={{ background: 'rgba(8,23,20,0.60)' }}>
          <div className="max-w-[1120px] mx-auto text-center">
            <h2 className="font-sora text-[38px] md:text-[48px] font-bold tracking-tight leading-[1.1] text-text-primary mb-5">
              Transparent. Auditable. Open.
            </h2>
            <p className="font-inter text-[17px] text-text-muted leading-relaxed max-w-2xl mx-auto mb-10">
              Every score factor, weight, and threshold is documented and reproducible.
              No proprietary models. No telemetry.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link to="/methodology"
                className="h-12 px-8 rounded-full font-inter font-semibold text-base flex items-center gap-2 transition-all hover:scale-[1.02] no-underline"
                style={{
                  background: 'rgba(97,218,197,0.15)',
                  border: '1px solid rgba(97,218,197,0.35)',
                  color: '#F2F7F5',
                }}>
                Read the Methodology
                <span className="material-symbols-outlined text-primary">arrow_forward</span>
              </Link>
              <Link to="/results"
                className="h-12 px-8 rounded-full font-inter font-semibold text-base flex items-center gap-2 transition-all hover:scale-[1.02] no-underline"
                style={{
                  background: '#2aae9b',
                  color: '#003730',
                }}>
                Open Dashboard
                <span className="material-symbols-outlined">dashboard</span>
              </Link>
            </div>
          </div>
        </section>

        {/* ── Footer ───────────────────────────────────────────────────── */}
        <footer className="py-10 px-4 text-center border-t" style={{ borderColor: 'rgba(242,247,245,0.08)' }}>
          <p className="font-inter text-sm text-text-muted">
            CodeSmellAI · Open Source · MIT Licence ·{' '}
            <a href="https://github.com/RiyaYadav768/CodeSmellAI" className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">
              GitHub
            </a>
          </p>
        </footer>
      </main>
    </div>
  )
}