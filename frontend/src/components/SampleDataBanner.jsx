/**
 * SampleDataBanner — amber "Sample Data Active" status strip
 *
 * Renders a full-width amber warning banner shown whenever the app is
 * displaying the bundled sample dataset instead of a user-uploaded metrics.csv.
 * This matches the persistent banner shown across all dashboard screens in
 * the Stitch design.
 *
 * Props:
 *   visible      {boolean}  Show/hide the banner (default: true)
 *   repoName     {string}   Name of the repository shown in the banner (default: "sample-python-project")
 *   moduleCount  {number}   Number of modules in the sample (default: 10)
 *   onUpload     {func}     Called when "Upload metrics.csv" button is clicked
 *   onDismiss    {func}     Called when the X button is clicked (optional — omit to hide dismiss)
 *
 * Stitch reference: "Top Telemetry & Control Ribbon" in Results Viewer (lines 11–28),
 *                   and the sub-header amber strip in Files Explorer.
 * Colors: amber dot #F5C04F, bg rgba(245,192,79,0.08), border rgba(245,192,79,0.20)
 */
export default function SampleDataBanner({
  visible = true,
  repoName = 'sample-python-project',
  moduleCount = 10,
  onUpload,
  onDismiss,
}) {
  if (!visible) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className="w-full flex flex-col sm:flex-row items-start sm:items-center justify-between gap-space-sm px-gutter-mobile md:px-gutter-tablet lg:px-gutter py-space-sm"
      style={{
        background: 'rgba(245,192,79,0.07)',
        borderBottom: '1px solid rgba(245,192,79,0.20)',
      }}
    >
      {/* Left: status pill + repo info */}
      <div className="flex flex-wrap items-center gap-space-sm min-w-0">

        {/* Pulsing amber "SAMPLE DATA ACTIVE" pill — exact Stitch pattern */}
        <div
          className="inline-flex items-center gap-space-xs px-3 py-1.5 rounded-full shrink-0"
          style={{
            background: 'rgba(245,192,79,0.15)',
            border: '1px solid rgba(245,192,79,0.35)',
            color: '#F5C04F',
            boxShadow: '0 0 12px rgba(245,192,79,0.15)',
          }}
        >
          <span
            className="w-2 h-2 rounded-full shrink-0 animate-pulse"
            style={{ background: '#F5C04F' }}
          />
          <span className="font-inter text-label-eyebrow uppercase tracking-widest font-bold">
            Sample Data Active
          </span>
          <span className="font-jetbrains text-label-code text-text-primary opacity-90 hidden sm:inline">
            · {repoName} ({moduleCount} modules)
          </span>
        </div>

        {/* Explanatory text — visible on sm+ */}
        <p className="font-inter text-body-sm text-on-surface-variant hidden md:block truncate max-w-sm">
          Illustrative demo metrics — not from a live scan.
          <span className="text-text-muted"> No network calls made.</span>
        </p>
      </div>

      {/* Right: upload CTA + dismiss */}
      <div className="flex items-center gap-space-sm shrink-0 self-end sm:self-auto">

        {/* Parsed locally indicator */}
        <div className="hidden sm:flex items-center gap-space-xs text-risk-low">
          <span className="w-1.5 h-1.5 rounded-full bg-risk-low" />
          <span className="font-jetbrains text-label-code">0 network calls</span>
        </div>

        {/* Upload CTA */}
        {onUpload && (
          <button
            type="button"
            onClick={onUpload}
            className="flex items-center gap-space-xs px-space-md py-2 rounded-full font-inter font-bold text-button-text transition-all"
            style={{
              background: '#61dac5',
              color: '#003730',
              boxShadow: '0 0 16px rgba(82,220,203,0.3)',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = '#51dbca')}
            onMouseLeave={e => (e.currentTarget.style.background = '#61dac5')}
          >
            <span className="material-symbols-outlined text-[18px]">file_upload</span>
            <span className="hidden sm:inline">Upload metrics.csv</span>
          </button>
        )}

        {/* Dismiss button */}
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss sample data banner"
            className="w-7 h-7 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors"
          >
            <span className="material-symbols-outlined text-[16px]">close</span>
          </button>
        )}
      </div>
    </div>
  )
}