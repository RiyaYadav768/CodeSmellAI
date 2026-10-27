/**
 * GlassCard — base translucent glass container
 *
 * Props:
 *   children      {ReactNode}   Card content
 *   className     {string}      Extra Tailwind classes (e.g. padding, rounded variant)
 *   as            {string}      HTML element to render as (default: "div")
 *   hoverable     {boolean}     Enable hover lift + active border glow (default: true)
 *   padding       {boolean}     Apply default p-space-lg padding (default: true)
 *   rounded       {"xl"|"2xl"|"lg"|string}  Border radius variant (default: "xl")
 *   noBorder      {boolean}     Remove hairline border (default: false)
 *   style         {object}      Extra inline styles
 *
 * Visual spec (from Stitch Obsidian Telemetry design system):
 *   Fill:      rgba(16, 39, 35, 0.55)
 *   Blur:      backdrop-filter: blur(18px) saturate(140%)
 *   Border:    1px solid rgba(242,247,245,0.10)
 *   Shadow:    0 24px 60px -20px rgba(0,0,0,0.65) + 1px ring rgba(82,220,203,0.06)
 *   Sheen:     inner top gradient rgba(255,255,255,0.14) → 0% at 40%
 *   Hover:     translateY(-4px), border → rgba(82,220,203,0.35), 160ms cubic-bezier
 */
import { useState } from 'react'

const ROUNDED = { xl: '0.75rem', '2xl': '1rem', lg: '0.5rem' }

export default function GlassCard({
  children,
  className = '',
  as: Tag = 'div',
  hoverable = true,
  padding = true,
  rounded = 'xl',
  noBorder = false,
  style = {},
}) {
  const [hovered, setHovered] = useState(false)
  const radius = ROUNDED[rounded] ?? rounded

  const baseStyle = {
    background: 'rgba(16,39,35,0.55)',
    backdropFilter: 'blur(18px) saturate(140%)',
    WebkitBackdropFilter: 'blur(18px) saturate(140%)',
    borderRadius: radius,
    border: noBorder ? 'none' : (
      hovered && hoverable
        ? '1px solid rgba(82,220,203,0.35)'
        : '1px solid rgba(242,247,245,0.10)'
    ),
    boxShadow: hovered && hoverable
      ? '0 24px 60px -20px rgba(0,0,0,0.65), 0 0 0 1px rgba(82,220,203,0.06), 0 0 24px rgba(82,220,203,0.10)'
      : '0 24px 60px -20px rgba(0,0,0,0.65), 0 0 0 1px rgba(82,220,203,0.06)',
    transform: hovered && hoverable ? 'translateY(-4px)' : 'translateY(0)',
    transition: 'transform 160ms cubic-bezier(0.2,0.8,0.2,1), border-color 160ms ease, box-shadow 160ms ease',
    position: 'relative',
    overflow: 'hidden',
    ...style,
  }

  return (
    <Tag
      className={[padding ? 'p-space-lg' : '', className].join(' ')}
      style={baseStyle}
      onMouseEnter={hoverable ? () => setHovered(true)  : undefined}
      onMouseLeave={hoverable ? () => setHovered(false) : undefined}
    >
      {/* Specular top-edge sheen — matches Stitch elevation spec */}
      <span
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: 'inherit',
          background: 'linear-gradient(180deg, rgba(255,255,255,0.14) 0%, rgba(255,255,255,0) 40%)',
          pointerEvents: 'none',
        }}
      />
      {/* Diagonal sheen — upper-left 35% wash */}
      <span
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: 'inherit',
          background: 'linear-gradient(115deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0) 35%)',
          pointerEvents: 'none',
        }}
      />
      {/* Content — sits above sheen layers */}
      <span style={{ position: 'relative', display: 'contents' }}>
        {children}
      </span>
    </Tag>
  )
}