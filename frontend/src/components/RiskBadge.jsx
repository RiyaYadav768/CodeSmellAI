/**
 * RiskBadge — colored capsule pill with status dot
 *
 * Props:
 *   level    {"low"|"medium"|"high"|string}  Risk tier
 *   score    {number}                         Numeric score (optional, shown alongside label)
 *   size     {"sm"|"md"}                      sm = compact inline, md = default (default: "md")
 *   pulse    {boolean}                        Animate the dot (default: false)
 *   className {string}                        Extra Tailwind classes
 *
 * Stitch reference: risk badge pills throughout Results Viewer and Files Explorer.
 * Colors: risk-low #6EDC9B | risk-medium #F5C04F | risk-high #FF8374
 * Thresholds: score < 40 → Low, 40–69 → Medium, ≥70 → High
 */

const RISK_MAP = {
  low:    { label: 'Low Risk',    color: '#6EDC9B', bg: 'rgba(110,220,155,0.12)' },
  medium: { label: 'Medium Risk', color: '#F5C04F', bg: 'rgba(245,192,79,0.12)'  },
  high:   { label: 'High Risk',   color: '#FF8374', bg: 'rgba(255,131,116,0.12)' },
}

/**
 * Derive level key from a raw risk_category string or score number.
 * Falls back to "medium" for unknown inputs.
 */
function resolveLevel(level, score) {
  if (typeof score === 'number') {
    if (score < 40) return 'low'
    if (score < 70) return 'medium'
    return 'high'
  }
  const key = String(level ?? '').toLowerCase().replace(/\s+risk$/, '').trim()
  return RISK_MAP[key] ? key : 'medium'
}

export default function RiskBadge({ level, score, size = 'md', pulse = false, className = '' }) {
  const key   = resolveLevel(level, score)
  const risk  = RISK_MAP[key]
  const isSm  = size === 'sm'

  return (
    <span
      className={[
        'inline-flex items-center rounded-full font-jetbrains font-semibold uppercase tracking-wider select-none',
        isSm ? 'gap-1 px-2 py-0.5 text-[11px]' : 'gap-1.5 px-3 py-1 text-[12px]',
        className,
      ].join(' ')}
      style={{
        background: risk.bg,
        color: risk.color,
        border: `1px solid ${risk.color}33`,
      }}
    >
      {/* Status dot */}
      <span
        className={['rounded-full shrink-0', isSm ? 'w-1.5 h-1.5' : 'w-2 h-2', pulse ? 'animate-pulse' : ''].join(' ')}
        style={{ background: risk.color }}
      />
      {/* Label */}
      <span>{risk.label}</span>
      {/* Score chip — shown only when score provided */}
      {typeof score === 'number' && (
        <span
          className="ml-0.5 px-1.5 py-px rounded"
          style={{ background: `${risk.color}22`, fontSize: isSm ? '10px' : '11px' }}
        >
          {Math.round(score)}
        </span>
      )}
    </span>
  )
}

/** Convenience re-export for deriving level from a score number */
export { resolveLevel }