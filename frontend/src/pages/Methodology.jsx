// Phase 1 scaffold placeholder
// Stitch screen: Methodology
// Route: /methodology
// Full implementation: Phase 4

const NAV_LINKS = [
  { href: '/',            label: 'Home' },
  { href: '/upload',      label: 'Upload' },
  { href: '/results',     label: 'Results' },
  { href: '/files',       label: 'Files' },
  { href: '/graph',       label: 'Graph' },
  { href: '/methodology', label: 'Methodology' },
]

export default function Methodology() {
  return (
    <div className="min-h-screen bg-bg-base text-text-primary flex flex-col">

      {/* Minimal top bar */}
      <header className="fixed top-0 inset-x-0 z-50 h-16 flex items-center px-gutter-mobile md:px-gutter gap-space-md"
              style={{ background: 'rgba(11,29,26,0.85)', backdropFilter: 'blur(18px)', borderBottom: '1px solid rgba(242,247,245,0.10)' }}>
        <a href="/" className="flex items-center gap-space-sm no-underline">
          <div className="w-8 h-8 rounded-lg bg-surface-container flex items-center justify-center text-primary text-lg select-none"
               style={{ boxShadow: '0 0 16px rgba(97,218,197,0.25)' }}>⌬</div>
          <span className="font-sora font-semibold text-headline-md text-text-primary tracking-tight">CodeSmellAI</span>
        </a>
        <span className="font-jetbrains text-label-code text-text-muted select-none px-1">/</span>
        <span className="font-jetbrains text-label-code text-secondary">methodology</span>
      </header>

      {/* Page body */}
      <main className="flex-1 pt-16 flex flex-col items-center justify-center gap-space-xl px-gutter-mobile py-space-xl">
        <div className="glass-surface rounded-xl p-space-xl flex flex-col items-center gap-space-md max-w-lg w-full text-center">

          <span className="font-jetbrains text-label-eyebrow text-secondary uppercase tracking-widest">
            Phase 1 · Scaffold
          </span>

          <h1 className="font-sora font-bold text-headline-lg-mobile md:text-headline-lg text-text-primary tracking-tight">
            Methodology
          </h1>

          <p className="font-inter text-body-default text-text-muted leading-relaxed">
            Route <code className="font-jetbrains text-label-code text-primary bg-surface-container px-2 py-0.5 rounded-lg">/methodology</code> is
            registered and rendering correctly. Full design implementation follows in Phase 4.
          </p>

          <div className="h-px w-full bg-border-hairline my-space-sm" />

          <p className="font-jetbrains text-label-code text-text-muted text-xs">
            Stitch ref: Methodology
          </p>

          {/* Route nav links */}
          <div className="flex gap-space-sm flex-wrap justify-center mt-space-sm">
            {NAV_LINKS.map(({ href, label }) => (
              <a key={href} href={href} className="btn-secondary">{label}</a>
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}