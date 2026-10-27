/**
 * TabBar — horizontal pill tab navigation
 *
 * Props:
 *   tabs        {Array}    Required. Array of tab descriptors:
 *                          { id, label, icon?, badge? }
 *                          icon  = Material Symbol name string (optional)
 *                          badge = string/number shown as a teal pill count (optional)
 *   activeId    {string}   ID of the currently active tab (controlled)
 *   onChange    {func}     Called with tab.id when a tab is clicked
 *   className   {string}   Extra classes on the outer container
 *   rightSlot   {node}     Optional content rendered to the right of the tabs
 *
 * Stitch reference: Sub-navigation in Results Viewer and Files Explorer.
 * Track:     bg-surface-container-lowest p-1 rounded-full
 * Active:    bg-primary-container text-on-primary-container shadow-[0_0_12px_rgba(42,174,155,0.3)]
 * Inactive:  text-on-surface-variant hover:text-on-surface
 */
export default function TabBar({ tabs = [], activeId, onChange, className = '', rightSlot }) {
  return (
    <div className={['flex items-center justify-between gap-space-md', className].join(' ')}>

      {/* Pill track */}
      <div
        className="flex items-center gap-0.5 p-1 rounded-full overflow-x-auto"
        style={{ background: '#05100e' /* surface-container-lowest */ }}
        role="tablist"
      >
        {tabs.map((tab) => {
          const isActive = tab.id === activeId
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={isActive}
              type="button"
              onClick={() => onChange?.(tab.id)}
              className={[
                'flex items-center gap-space-xs px-space-md py-2 rounded-full font-inter font-medium text-button-text',
                'transition-all duration-150 whitespace-nowrap cursor-pointer shrink-0',
                isActive
                  ? 'bg-primary-container text-on-primary-container font-semibold'
                  : 'text-on-surface-variant hover:text-on-surface',
              ].join(' ')}
              style={isActive ? { boxShadow: '0 0 12px rgba(42,174,155,0.3)' } : {}}
            >
              {/* Optional Material Symbol icon */}
              {tab.icon && (
                <span className="material-symbols-outlined text-[18px]">{tab.icon}</span>
              )}

              {/* Label */}
              <span>{tab.label}</span>

              {/* Optional count badge */}
              {tab.badge !== undefined && (
                <span
                  className="font-jetbrains text-label-code px-1.5 rounded-full text-primary"
                  style={{ background: '#162220' /* surface-container */, fontSize: '12px' }}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Optional right slot — e.g. "Local Client Engine · MIT" chip */}
      {rightSlot && (
        <div className="hidden lg:flex items-center gap-space-sm text-text-muted font-jetbrains text-label-code shrink-0">
          {rightSlot}
        </div>
      )}
    </div>
  )
}