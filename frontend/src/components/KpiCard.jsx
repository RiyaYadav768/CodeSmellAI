/**
 * KpiCard — glassmorphic telemetry stat card
 *
 * Props:
 *   label      {string}           Eyebrow label (UPPERCASE small caps), e.g. "Total Modules"
 *   value      {string|number}    Large primary value, e.g. "10" or "78.4"
 *   unit       {string}           Unit suffix next to value, e.g. "files" (optional)
 *   sub        {string}           Secondary line below value, e.g. "1,021 LOC" (optional)
 *   footer     {string}           Small footer line at the bottom (optional)
 *   footerRight {string}          Right-aligned footer label (optional)
 *   icon       {string}           Material Symbol name, e.g. "data_object" (optional)
 *   accentColor {"primary"|"secondary"|"risk-low"|"risk-medium"|"risk-high"|string}
 *               Controls the top accent bar color (default: "primary")
 *   valueColor  {string}          Tailwind text class for the value (default auto from accent)
 *   className  {string}           Extra Tailwind classes
 *
 * Stitch reference: Summary KPI Cards in Files Explorer (4-up grid),
 *                   Top Metrics Strip in Results Viewer.
 */

const ACCENT_COLORS = {
  'primary':   { bar: 'from-primary/30 via-primary/60 to-transparent', text: '#61dac5' },
  'secondary': { bar: 'from-secondary/30 via-secondary/60 to-transparent', text: '#51dbca' },
  'risk-low':  { bar: 'from-risk-low/40 via-risk-low to-transparent', text: '#6EDC9B' },
  'risk-medium':{ bar: 'from-risk-medium/40 via-risk-medium to-transparent', text: '#F5C04F' },
  'risk-high': { bar: 'from-transparent via-risk-high to-transparent', text: '#FF8374' },
}

export default function KpiCard({
  label,
  value,
  unit,
  sub,
  footer,
  footerRight,
  icon,
  accentColor = 'primary',
  valueColor,
  className = '',
}) {
  const accent = ACCENT_COLORS[accentColor] ?? ACCENT_COLORS['primary']
  const valColor = valueColor ?? accent.text

  return (
    <div
      className={[
        'relative overflow-hidden rounded-xl p-space-md flex flex-col justify-between gap-space-sm shadow-md transition-colors',
        'bg-surface-container-low hover:bg-surface-container',
        className,
      ].join(' ')}
    >
      {/* Top accent gradient bar — 2px, matches Stitch spec exactly */}
      <div
        className={`absolute top-0 inset-x-0 h-0.5 bg-gradient-to-r ${accent.bar}`}
      />

      {/* Header row: eyebrow label + icon */}
      <div className="flex items-center justify-between">
        <span className="font-inter text-label-eyebrow uppercase text-text-muted tracking-wider">
          {label}
        </span>
        {icon && (
          <span
            className="material-symbols-outlined text-[20px]"
            style={{ color: valColor }}
          >
            {icon}
          </span>
        )}
      </div>

      {/* Value row */}
      <div className="flex items-baseline justify-between mt-space-xs">
        <div className="flex items-baseline gap-1">
          <span
            className="font-sora font-semibold text-headline-md leading-none"
            style={{ color: valColor }}
          >
            {value ?? '—'}
          </span>
          {unit && (
            <span className="font-jetbrains text-label-code text-text-muted ml-1">
              {unit}
            </span>
          )}
        </div>
        {sub && (
          <span className="font-jetbrains text-label-code text-secondary text-[13px]">
            {sub}
          </span>
        )}
      </div>

      {/* Footer row */}
      {(footer || footerRight) && (
        <div className="flex items-center justify-between pt-space-xs text-on-surface-variant font-inter text-[13px]">
          {footer   && <span>{footer}</span>}
          {footerRight && (
            <span
              className="font-jetbrains text-[11px] uppercase tracking-wider"
              style={{ color: valColor }}
            >
              {footerRight}
            </span>
          )}
        </div>
      )}
    </div>
  )
}