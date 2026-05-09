import { useEffect, useState } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceArea,
  BarChart, Bar, Cell,
  PieChart, Pie,
} from 'recharts'
import KpiCard from '../components/KpiCard'
import LoadingSpinner from '../components/LoadingSpinner'
import { api } from '../api'
import './Dashboard.css'

const SEGMENT_COLORS = { mass: '#8892a4', comfort: '#3b82f6', premium: '#34d399', vip: '#a78bfa' }
const SEGMENT_LABELS = { mass: 'Масс', comfort: 'Комфорт', premium: 'Премиум', vip: 'VIP' }
const SEGMENT_ORDER = ['mass', 'comfort', 'premium', 'vip']
const CLASS_COLORS = { baseline: '#8892a4', statistical: '#3b82f6', linear: '#34d399', ensemble: '#f87171' }
const CLASS_LABELS = { baseline: 'Базовый', statistical: 'Статистический', linear: 'Линейный', ensemble: 'Ансамблевый' }
const DONUT_COLORS = ['#3b82f6', '#34d399', '#f59e0b', '#f87171', '#a78bfa', '#ec4899']

const fmt2 = (n) => (typeof n === 'number' ? n.toFixed(2) : '—')
const mean = (arr) => arr.length ? arr.reduce((s, x) => s + x, 0) / arr.length : 0

const TOOLTIP_STYLE = {
  contentStyle: { background: '#161b27', border: '1px solid #2a2d3a', borderRadius: 6, fontSize: 12 },
  labelStyle: { color: '#8892a4' },
  itemStyle: { color: '#e2e8f0' },
}

export default function Dashboard() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false

    Promise.all([
      api.getHistory(),
      api.getSegments(),
      api.getRevenueStructure(),
      api.getModelComparison(),
    ])
      .then(([history, segments, revenue, models]) => {
        if (cancelled) return
        setData({ history, segments, revenue, models })
        setLoading(false)
      })
      .catch((e) => {
        if (cancelled) return
        setError(e.message)
        setLoading(false)
      })

    return () => { cancelled = true }
  }, [])

  if (loading) return <LoadingSpinner text="Загрузка данных..." />
  if (error) return (
    <div className="error-state">
      <div className="error-icon">⚠</div>
      <p className="error-msg">Ошибка загрузки данных</p>
      <p className="error-detail">{error}</p>
      <p className="error-hint">Убедитесь, что API-сервер запущен на http://localhost:8000</p>
    </div>
  )

  const { history, segments, revenue, models } = data

  const chartData = (history?.dates ?? []).map((date, i) => ({ date, arpu: history.values[i] }))

  const vals = history?.values ?? []
  const last30 = vals.slice(-30)
  const prev30 = vals.slice(-60, -30)
  const avgArpu = mean(last30)
  const prevAvg = mean(prev30)
  const arpuDelta = prevAvg ? +((avgArpu - prevAvg) / prevAvg * 100).toFixed(1) : 0

  const zones = { train: null, val: null, test: null }
  if (history?.train_end && chartData.length) {
    zones.train = { x1: chartData[0].date, x2: history.train_end }
    if (history.val_end) {
      zones.val  = { x1: history.train_end, x2: history.val_end }
      zones.test = { x1: history.val_end,   x2: chartData[chartData.length - 1].date }
    }
  }

  const quarterlyTicks = (() => {
    const seen = new Set()
    return chartData
      .filter((d) => {
        const dt = new Date(d.date)
        if (isNaN(dt)) return false
        const key = `${dt.getFullYear()}-${Math.floor(dt.getMonth() / 3)}`
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
      .map((d) => d.date)
  })()

  const formatDate = (s) => {
    const d = new Date(s)
    return isNaN(d) ? s : d.toLocaleDateString('ru-RU', { month: 'short', year: '2-digit' })
  }

  const segmentData = (segments?.segments ?? [])
    .map((seg, i) => ({
      name:    SEGMENT_LABELS[seg] ?? seg,
      segment: seg,
      value:   segments.arpu_mean[i],
      min:     segments.arpu_min?.[i],
      max:     segments.arpu_max?.[i],
    }))
    .sort((a, b) => SEGMENT_ORDER.indexOf(a.segment) - SEGMENT_ORDER.indexOf(b.segment))

  const pieData = (revenue?.labels ?? []).map((label, i) => ({
    name:  label,
    value: revenue.values[i],
    fill:  revenue.colors[i],
  }))

  const sortedModels = Array.isArray(models)
    ? [...models].sort((a, b) => (a.MAE ?? 999) - (b.MAE ?? 999))
    : []

  return (
    <div>
      <h1 className="page-title">Дашборд</h1>

      <div className="grid-4 mb-24">
        <KpiCard
          title="Средний ARPU"
          value={fmt2(avgArpu)}
          unit="руб/день"
          delta={arpuDelta}
          deltaLabel="vs пред. 30 дн."
          accent="blue"
        />
        <KpiCard
          title="Лучшая модель"
          value="Random Forest"
          subtitle="MAE = 3.36 руб/день"
          accent="green"
        />
        <KpiCard
          title="R² на тесте"
          value="0.896"
          subtitle="119 дней тестовой выборки"
          accent="amber"
        />
        <KpiCard
          title="Моделей сравнено"
          value="11"
          subtitle="3 класса методов"
          accent="blue"
        />
      </div>

      <div className="card mb-24">
        <h3 className="chart-title">История ARPU</h3>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={chartData} margin={{ top: 20, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2a2d3a" vertical={false} />

            {zones.train && (
              <ReferenceArea
                x1={zones.train.x1} x2={zones.train.x2}
                fill="#3b82f6" fillOpacity={0.05} strokeOpacity={0}
                label={{ value: 'Train', position: 'insideTopLeft', fill: '#8892a4', fontSize: 10 }}
              />
            )}
            {zones.val && (
              <ReferenceArea
                x1={zones.val.x1} x2={zones.val.x2}
                fill="#34d399" fillOpacity={0.05} strokeOpacity={0}
                label={{ value: 'Val', position: 'insideTopLeft', fill: '#8892a4', fontSize: 10 }}
              />
            )}
            {zones.test && (
              <ReferenceArea
                x1={zones.test.x1} x2={zones.test.x2}
                fill="#f59e0b" fillOpacity={0.05} strokeOpacity={0}
                label={{ value: 'Test', position: 'insideTopLeft', fill: '#8892a4', fontSize: 10 }}
              />
            )}

            <XAxis
              dataKey="date"
              ticks={quarterlyTicks}
              tickFormatter={formatDate}
              stroke="#2a2d3a"
              tick={{ fill: '#8892a4', fontSize: 11 }}
              tickLine={false}
            />
            <YAxis
              stroke="#2a2d3a"
              tick={{ fill: '#8892a4', fontSize: 11 }}
              tickFormatter={(v) => Math.round(v)}
              tickLine={false}
              axisLine={false}
              width={40}
            />
            <Tooltip
              {...TOOLTIP_STYLE}
              itemStyle={{ color: '#3b82f6' }}
              formatter={(v) => [`${fmt2(v)} руб`, 'ARPU']}
              labelFormatter={(l) => `Дата: ${l}`}
            />
            <Line
              type="monotone"
              dataKey="arpu"
              stroke="#3b82f6"
              strokeWidth={1.5}
              dot={false}
              activeDot={{ r: 4, fill: '#3b82f6', strokeWidth: 0 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="grid-2 mb-24">
        <div className="card">
          <h3 className="chart-title">ARPU по сегментам</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart
              data={segmentData}
              layout="vertical"
              margin={{ top: 4, right: 16, left: 0, bottom: 24 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2d3a" horizontal={false} />
              <XAxis
                type="number"
                stroke="#2a2d3a"
                tick={{ fill: '#8892a4', fontSize: 11 }}
                tickLine={false}
                label={{ value: 'руб/день', position: 'insideBottom', offset: -12, fill: '#8892a4', fontSize: 11 }}
              />
              <YAxis
                type="category"
                dataKey="name"
                stroke="#2a2d3a"
                tick={{ fill: '#8892a4', fontSize: 12 }}
                tickLine={false}
                axisLine={false}
                width={62}
              />
              <Tooltip
                {...TOOLTIP_STYLE}
                formatter={(v, _n, item) => {
                  const { min, max } = item.payload
                  return [
                    min != null
                      ? `${fmt2(v)} (${fmt2(min)} – ${fmt2(max)})`
                      : `${fmt2(v)} руб/день`,
                    'Средний ARPU',
                  ]
                }}
                labelFormatter={(l) => l}
              />
              <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={26}>
                {segmentData.map((entry) => (
                  <Cell key={entry.segment} fill={SEGMENT_COLORS[entry.segment] ?? '#8892a4'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h3 className="chart-title">Структура выручки</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart width={300} height={300}>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                dataKey="value"
                paddingAngle={2}
              >
                {pieData.map((entry, i) => (
                  <Cell key={i} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip
                {...TOOLTIP_STYLE}
                formatter={(value, name) => [`${value.toFixed(1)}%`, name]}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="donut-legend">
            {pieData.map((entry, i) => (
              <div key={i} className="donut-legend-item">
                <span
                  className="donut-dot"
                  style={{ background: entry.fill }}
                />
                <span className="donut-label">{entry.name}</span>
                <span className="donut-value">{entry.value.toFixed(1)}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card">
        <h3 className="chart-title">Сравнение моделей</h3>
        <div className="table-wrap">
          <table className="models-table">
            <thead>
              <tr>
                <th>Модель</th>
                <th>Класс</th>
                <th>MAE</th>
                <th>RMSE</th>
                <th>MAPE</th>
                <th>R²</th>
              </tr>
            </thead>
            <tbody>
              {sortedModels.map((m, i) => (
                <tr key={m.model ?? i} className={m.model === 'Random Forest' ? 'row-best' : ''}>
                  <td>
                    <div className="model-name-cell">
                      <span
                        className="model-dot"
                        style={{ background: CLASS_COLORS[m.class] ?? '#8892a4' }}
                      />
                      {m.model ?? '—'}
                    </div>
                  </td>
                  <td>
                    <span
                      className="class-badge"
                      style={{ color: CLASS_COLORS[m.class] ?? '#8892a4' }}
                    >
                      {CLASS_LABELS[m.class] ?? m.class ?? '—'}
                    </span>
                  </td>
                  <td className="num">{fmt2(m.MAE)}</td>
                  <td className="num">{fmt2(m.RMSE)}</td>
                  <td className="num">{fmt2(m.MAPE)}</td>
                  <td className="num">{fmt2(m.R2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
