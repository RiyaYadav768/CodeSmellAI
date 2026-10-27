/**
 * Navbar — fixed top header
 *
 * Props:
 *   route        {string}  Current route label shown after the slash, e.g. "results"
 *   githubUrl    {string}  href for the GitHub source link (optional)
 *   navLinks     {Array}   [{ label, href }] shown in the centre pill nav (optional)
 *   activeHref   {string}  href that is currently active in navLinks (optional)
 *   onUpload     {func}    called when "Upload metrics.csv" CTA is clicked (optional)
 *
 * Stitch reference: Results Viewer header + Files Explorer header
 * Both screens share the same fixed nav structure.
 */
import { Link, useLocation } from 'react-router-dom'

const DEFAULT_NAV = [
  { label: 'Results',     href: '/results' },
  { label: 'Files',       href: '/files' },
  { label: 'Graph',       href: '/graph' },
  { label: 'Upload',      href: '/upload' },
  { label: 'Methodology', href: '/methodology' },
]

export default function Navbar({
  route,
  githubUrl = 'https://github.com',
  navLinks = DEFAULT_NAV,
  onUpload,
}) {
  const { pathname } = useLocation()
  // Derive route label from pathname when not provided explicitly
  const routeLabel = (route ?? pathname.replace("/", "")) || "home"

  return (
    <header
      className="fixed top-0 inset-x-0 z-50 h-20"
      style={{
        background: 'rgba(11,29,26,0.85)',
        backdropFilter: 'blur(20px) saturate(140%)',
        WebkitBackdropFilter: 'blur(20px) saturate(140%)',
        borderBottom: '1px solid rgba(242,247,245,0.10)',
        boxShadow: '0 1px 8px rgba(0,0,0,0.35)',
      }}
    >
      <div className="h-full w-full max-w-[1200px] mx-auto px-gutter-mobile md:px-gutter-tablet lg:px-gutter flex items-center justify-between gap-space-md">

        {/* ── Left: logo + route badge ────────────────────────────── */}
        <div className="flex items-center gap-space-lg min-w-0">
          <div className="flex items-center gap-space-sm shrink-0">
            {/* Logo icon */}
            <div
              className="w-9 h-9 rounded-lg bg-surface-container flex items-center justify-center text-primary"
              style={{ boxShadow: '0 0 16px rgba(82,220,203,0.15)' }}
            >
              <span className="material-symbols-outlined text-[22px]">terminal</span>
            </div>

            {/* Brand name + route badge */}
            <div className="flex items-center gap-space-xs">
              <Link
                to="/"
                className="font-sora font-semibold text-headline-md text-text-primary tracking-tight hover:text-primary transition-colors no-underline"
              >
                CodeSmellAI
              </Link>
              {routeLabel && routeLabel !== 'home' && (
                <span className="font-jetbrains text-label-code px-space-xs py-0.5 rounded-full bg-surface-container-high text-primary select-none">
                  /{routeLabel}
                </span>
              )}
            </div>
          </div>

          {/* Back to Landing — xl only, matches Stitch */}
          {pathname !== '/' && (
            <Link
              to="/"
              className="hidden xl:flex items-center gap-space-xs font-inter text-body-sm text-on-surface-variant hover:text-on-surface transition-colors no-underline"
            >
              <span className="material-symbols-outlined text-[16px]">arrow_back</span>
              Back to Landing
            </Link>
          )}
        </div>

        {/* ── Centre: pill nav — hidden on mobile ─────────────────── */}
        {navLinks.length > 0 && (
          <nav
            className="hidden md:flex items-center p-space-xs bg-surface-container-lowest rounded-full gap-0.5"
            aria-label="Primary navigation"
          >
            {navLinks.map(({ label, href }) => {
              const isActive = pathname === href
              return (
                <Link
                  key={href}
                  to={href}
                  aria-current={isActive ? 'page' : undefined}
                  className={[
                    'px-space-md py-space-xs font-inter text-body-sm transition-all rounded-full whitespace-nowrap no-underline',
                    isActive
                      ? 'bg-primary-container text-on-primary-container font-semibold'
                      : 'text-on-surface-variant hover:text-on-surface',
                  ].join(' ')}
                  style={isActive ? { boxShadow: '0 0 12px rgba(42,174,155,0.3)' } : {}}
                >
                  {label}
                </Link>
              )
            })}
          </nav>
        )}

        {/* ── Right: status chip + upload CTA + GitHub + avatar ───── */}
        <div className="flex items-center gap-space-sm shrink-0">

          {/* Local processing status pill */}
          <div className="hidden lg:flex items-center gap-space-xs px-space-sm py-1 rounded-full bg-surface-container text-risk-low">
            <span className="w-1.5 h-1.5 rounded-full bg-risk-low animate-pulse" />
            <span className="font-inter text-label-eyebrow uppercase tracking-wider">
              Local In-Browser
            </span>
          </div>

          {/* Upload CTA — shown when onUpload provided */}
          {onUpload && (
            <button
              type="button"
              onClick={onUpload}
              className="hidden sm:flex items-center gap-1.5 px-space-md py-2 rounded-full font-inter font-bold text-button-text transition-all"
              style={{
                background: '#abd550',
                color: '#263500',
                boxShadow: '0 0 16px rgba(200,243,106,0.35)',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = '#c7f169')}
              onMouseLeave={e => (e.currentTarget.style.background = '#abd550')}
            >
              <span className="material-symbols-outlined text-[18px]">file_upload</span>
              <span>Upload metrics.csv</span>
            </button>
          )}

          {/* GitHub source link */}
          <a
            href={githubUrl}
            target="_blank"
            rel="noopener noreferrer"
            title="Source on GitHub"
            className="w-9 h-9 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">code</span>
          </a>

          {/* Avatar placeholder */}
          <div
            className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shrink-0"
            style={{ boxShadow: '0 0 12px rgba(97,218,197,0.3)' }}
          >
            <span className="material-symbols-outlined text-on-primary text-[18px]">person</span>
          </div>
        </div>
      </div>
    </header>
  )
}