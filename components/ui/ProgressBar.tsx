interface ProgressBarProps {
  value: number       // 0–100
  label?: string
  showPercent?: boolean
  color?: 'brand' | 'emerald' | 'amber' | 'red'
  size?: 'sm' | 'md' | 'lg'
}

const colors = {
  brand:   'bg-brand-600',
  emerald: 'bg-emerald-500',
  amber:   'bg-amber-500',
  red:     'bg-red-500',
}

const heights = { sm: 'h-1.5', md: 'h-2.5', lg: 'h-4' }

export function ProgressBar({
  value,
  label,
  showPercent = false,
  color = 'brand',
  size = 'md',
}: ProgressBarProps) {
  const pct = Math.max(0, Math.min(100, value))
  return (
    <div>
      {(label || showPercent) && (
        <div className="flex justify-between items-center mb-1.5">
          {label && <span className="text-sm text-slate-600">{label}</span>}
          {showPercent && <span className="text-sm font-semibold text-slate-700">{pct}%</span>}
        </div>
      )}
      <div className={`w-full bg-slate-100 rounded-full overflow-hidden ${heights[size]}`}>
        <div
          className={`${heights[size]} ${colors[color]} rounded-full transition-all duration-500`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
