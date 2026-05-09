import './KpiCard.css'

export default function KpiCard({ title, value, unit, subtitle, delta, deltaLabel, accent = 'blue' }) {
  const positive = delta >= 0

  return (
    <div className="kpi-card card">
      <span className="kpi-title">{title}</span>
      <div className="kpi-value-row">
        <span className="kpi-value" style={{ color: `var(--${accent})` }}>
          {value}
        </span>
        {unit && <span className="kpi-unit">{unit}</span>}
      </div>
      {subtitle && <span className="kpi-subtitle">{subtitle}</span>}
      {delta !== undefined && (
        <span className={`kpi-delta ${positive ? 'positive' : 'negative'}`}>
          {positive ? '▲' : '▼'} {Math.abs(delta)}%{deltaLabel ? ` ${deltaLabel}` : ''}
        </span>
      )}
    </div>
  )
}
