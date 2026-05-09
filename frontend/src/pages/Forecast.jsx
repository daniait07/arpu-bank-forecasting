import { useEffect, useState } from 'react'
import {
  ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Legend,
  BarChart, Bar, Cell,
} from 'recharts'
import KpiCard from '../components/KpiCard'
import LoadingSpinner from '../components/LoadingSpinner'
import { api } from '../api'
import './Forecast.css'

const MODEL_OPTIONS = [
  { value: 'random_forest', label: 'Random Forest' },
  { value: 'xgboost',       label: 'XGBoost' },
  { value: 'lasso',         label: 'Lasso' },
  { value: 'ridge',         label: 'Ridge' },
  { value: 'lightgbm',      label: 'LightGBM' },
]

const HORIZON_OPTIONS = [
  { value: 1, label: '1 день' },
  { value: 3, label: '3 дня' },
  { value: 7, label: '7 дней' },
]

const MONTHS_RU = ['Янв','Фев','Мар','Апр','Май','Июн','Июл','Авг','Сен','Окт','Ноя','Дек']

const DM_RESULTS = [
  { m1: 'LightGBM',      m2: 'Ridge',         dm:  2.11, p: 0.035, sig: true  },
  { m1: 'LightGBM',      m2: 'ElasticNet',    dm:  2.04, p: 0.042, sig: true  },
  { m1: 'LightGBM',      m2: 'Random Forest', dm:  3.03, p: 0.003, sig: true  },
  { m1: 'Random Forest', m2: 'Ridge',          dm: -1.29, p: 0.196, sig: false },
  { m1: 'LightGBM',      m2: 'Baseline',       dm: -6.40, p: 0.000, sig: true  },
  { m1: 'Ridge',         m2: 'Baseline',       dm: -5.67, p: 0.000, sig: true  },
]

const SHAP_NAMES = {
  day_of_year:     'День года',
  week_of_year:    'Неделя года',
  arpu_lag_14:     'ARPU лаг 14д',
  arpu_lag_30:     'ARPU лаг 30д',
  arpu_min_7:      'Мин ARPU 7д',
  month:           'Месяц',
  avg_balance_30d: 'Средний баланс',
  digital_score:   'Цифровая активность',
  churn_score:     'Вероятность оттока',
  arpu_roc_30:     'Изм. ARPU 30д %',
  arpu_diff_30:    'Разность ARPU 30д',
  arpu_lag_1:      'ARPU вчера',
  doy_cos:         'Косинус дня года',
  arpu_std_30:     'Станд. откл. 30д',
  arpu_max_30:     'Макс ARPU 30д',
}

const LINEAR_MODELS = new Set(['lasso', 'ridge'])

const TOOLTIP_STYLE = {
  contentStyle: { background: '#161b27', border: '1px solid #2a2d3a', borderRadius: 6, fontSize: 12 },
  labelStyle: { color: '#8892a4' },
  itemStyle: { color: '#e2e8f0' },
}

const fmt2 = (n) => (typeof n === 'number' ? n.toFixed(2) : '—')

export default function Forecast() {
  const [selectedModel,   setSelectedModel]   = useState('random_forest')
  const [selectedHorizon, setSelectedHorizon] = useState(1)
  const [forecastData,    setForecastData]    = useState(null)
  const [shapData,        setShapData]        = useState(null)
  const [loading,         setLoading]         = useState(false)
  const [error,           setError]           = useState(null)

  useEffect(() => {
    let cancelled = false
    api.getShapSummary()
      .then((d) => { if (!cancelled) setShapData(d) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    api.postForecast({ model: selectedModel, horizon: selectedHorizon })
      .then((d) => {
        if (!cancelled) {
          setForecastData(d)
          setLoading(false)
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e.message)
          setLoading(false)
        }
      })
    return () => { cancelled = true }
  }, [selectedModel, selectedHorizon])

  const chartData = forecastData
    ? forecastData.dates.map((date, i) => ({
        date,
        actual:    forecastData.y_true[i],
        predicted: forecastData.y_pred[i],
        ci_lower:  forecastData.ci_lower[i],
        ci_upper:  forecastData.ci_upper[i],
      }))
    : []

  const actualMean = forecastData
    ? forecastData.y_true.reduce((s, v) => s + v, 0) / forecastData.y_true.length
    : null

  const maeByMonth = (() => {
    if (!forecastData) return []
    const overallMAE = forecastData.metrics.MAE
    const buckets = {}
    forecastData.dates.forEach((date, i) => {
      const m = parseInt(date.split('-')[1], 10) - 1
      if (!buckets[m]) buckets[m] = []
      buckets[m].push(Math.abs(forecastData.y_true[i] - forecastData.y_pred[i]))
    })
    return Object.entries(buckets)
      .map(([m, errs]) => {
        const mae = errs.reduce((s, e) => s + e, 0) / errs.length
        return { month: MONTHS_RU[+m], mae, overMae: mae > overallMAE, idx: +m }
      })
      .sort((a, b) => a.idx - b.idx)
  })()

  const shapModel     = shapData?.[selectedModel]
  const shapChartData = shapModel
    ? shapModel.features.slice(0, 10).map((f, i) => ({
        feature: SHAP_NAMES[f] ?? f,
        value:   shapModel.values[i],
      }))
    : []

  const metrics      = forecastData?.metrics ?? {}
  const tickInterval = chartData.length > 0
    ? Math.max(1, Math.floor(chartData.length / 8))
    : 1

  const fmtDateTick = (s) => {
    const p = s.split('-')
    return p.length === 3 ? `${p[2]}.${p[1]}` : s
  }

  return (
    <div>
      <h1 className="page-title">Прогноз ARPU</h1>

      <div className="fc-controls mb-24">
        <div className="fc-model-select">
          <label className="fc-label">Модель</label>
          <select
            className="fc-select"
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
          >
            {MODEL_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div className="fc-horizon-pills">
          {HORIZON_OPTIONS.map((o) => (
            <button
              key={o.value}
              className={`fc-pill${selectedHorizon === o.value ? ' active' : ''}`}
              onClick={() => setSelectedHorizon(o.value)}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid-4 mb-24">
        <KpiCard title="MAE"  value={loading ? '—' : fmt2(metrics.MAE)}  subtitle="руб/день" accent="blue"  />
        <KpiCard title="RMSE" value={loading ? '—' : fmt2(metrics.RMSE)} subtitle="руб/день" accent="amber" />
        <KpiCard title="MAPE" value={loading ? '—' : fmt2(metrics.MAPE)} subtitle="%"         accent="green" />
        <KpiCard title="R²"   value={loading ? '—' : fmt2(metrics.R2)}   subtitle="на тесте"  accent="blue"  />
      </div>

      <div className="card mb-24 fc-chart-card">
        <h3 className="chart-title">Прогноз vs Факт — тестовая выборка</h3>
        {loading && (
          <div className="fc-chart-overlay">
            <LoadingSpinner text="Загрузка прогноза..." />
          </div>
        )}
        {!loading && error && (
          <div className="fc-error">⚠ {error}</div>
        )}
        {!loading && !error && chartData.length > 0 && (
          <ResponsiveContainer width="100%" height={320}>
            <ComposedChart data={chartData} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2d3a" vertical={false} />
              <XAxis
                dataKey="date"
                tickFormatter={fmtDateTick}
                stroke="#2a2d3a"
                tick={{ fill: '#8892a4', fontSize: 11 }}
                tickLine={false}
                interval={tickInterval}
              />
              <YAxis
                stroke="#2a2d3a"
                tick={{ fill: '#8892a4', fontSize: 11 }}
                tickFormatter={(v) => `${Math.round(v)} ₽`}
                tickLine={false}
                axisLine={false}
                width={56}
              />
              <Tooltip
                {...TOOLTIP_STYLE}
                formatter={(v, name) => {
                  const labels = { actual: 'Факт', predicted: 'Прогноз', ci_upper: '95% ДИ верх', ci_lower: '95% ДИ низ' }
                  return [`${fmt2(v)} ₽`, labels[name] ?? name]
                }}
                labelFormatter={(l) => `Дата: ${l}`}
              />
              <Legend
                formatter={(value) => (
                  <span style={{ color: '#8892a4', fontSize: 12 }}>{value}</span>
                )}
                wrapperStyle={{ paddingTop: 8 }}
              />
              <Area type="monotone" dataKey="ci_upper" fill="#3b82f6" fillOpacity={0.12} stroke="none" name="95% ДИ" legendType="square" />
              <Area type="monotone" dataKey="ci_lower" fill="#0f1117" fillOpacity={1}    stroke="none" legendType="none" />
              {actualMean != null && (
                <ReferenceLine
                  y={actualMean}
                  stroke="#64748b"
                  strokeDasharray="4 2"
                  label={{ value: 'среднее', position: 'insideTopRight', fill: '#64748b', fontSize: 10 }}
                />
              )}
              <Line type="monotone" dataKey="actual"    stroke="#e2e8f0" strokeWidth={2} dot={false} name="Факт"    />
              <Line type="monotone" dataKey="predicted" stroke="#f87171" strokeWidth={2} dot={false} name="Прогноз" strokeDasharray="6 3" />
            </ComposedChart>
          </ResponsiveContainer>
        )}
        {!loading && !error && chartData.length === 0 && (
          <div className="fc-empty">Нет данных для отображения</div>
        )}
      </div>

      <div className="fc-two-col mb-24">
        <div className="card">
          <h3 className="chart-title">MAE по месяцам тестового периода</h3>
          {maeByMonth.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={maeByMonth} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2d3a" vertical={false} />
                <XAxis
                  dataKey="month"
                  stroke="#2a2d3a"
                  tick={{ fill: '#8892a4', fontSize: 11 }}
                  tickLine={false}
                />
                <YAxis
                  stroke="#2a2d3a"
                  tick={{ fill: '#8892a4', fontSize: 11 }}
                  tickFormatter={fmt2}
                  tickLine={false}
                  axisLine={false}
                  width={42}
                />
                <Tooltip
                  {...TOOLTIP_STYLE}
                  formatter={(v) => [`${fmt2(v)} руб`, 'MAE']}
                />
                {forecastData && (
                  <ReferenceLine
                    y={forecastData.metrics.MAE}
                    stroke="#64748b"
                    strokeDasharray="4 2"
                    label={{ value: 'общий MAE', position: 'insideTopRight', fill: '#64748b', fontSize: 10 }}
                  />
                )}
                <Bar dataKey="mae" radius={[3, 3, 0, 0]} maxBarSize={36}>
                  {maeByMonth.map((entry, i) => (
                    <Cell key={i} fill={entry.overMae ? '#f87171' : '#34d399'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="fc-empty">{loading ? '' : 'Нет данных'}</div>
          )}
        </div>

        <div className="card">
          <h3 className="chart-title">Тест Диболда-Мариано (α=0.05)</h3>
          <div className="table-wrap">
            <table className="dm-table">
              <thead>
                <tr>
                  <th>Модель 1</th>
                  <th>Модель 2</th>
                  <th>DM</th>
                  <th>p-value</th>
                  <th>Результат</th>
                </tr>
              </thead>
              <tbody>
                {DM_RESULTS.map((row, i) => (
                  <tr key={i} className={row.sig ? 'dm-sig' : ''}>
                    <td>{row.m1}</td>
                    <td>{row.m2}</td>
                    <td className="num">{row.dm.toFixed(2)}</td>
                    <td className="num">{row.p.toFixed(3)}</td>
                    <td>
                      <span className={`dm-badge ${row.sig ? 'dm-badge-sig' : 'dm-badge-ns'}`}>
                        {row.sig ? '✓ значимо' : '— незначимо'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="card">
        <h3 className="chart-title">Важность признаков (SHAP)</h3>
        {LINEAR_MODELS.has(selectedModel) ? (
          <div className="fc-shap-unavail">SHAP недоступен для линейных моделей</div>
        ) : shapChartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={320}>
            <BarChart
              data={shapChartData}
              layout="vertical"
              margin={{ top: 4, right: 32, left: 4, bottom: 24 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2d3a" horizontal={false} />
              <XAxis
                type="number"
                stroke="#2a2d3a"
                tick={{ fill: '#8892a4', fontSize: 11 }}
                tickLine={false}
                tickFormatter={(v) => v.toFixed(2)}
                label={{ value: 'Среднее |SHAP|', position: 'insideBottom', offset: -12, fill: '#8892a4', fontSize: 11 }}
              />
              <YAxis
                type="category"
                dataKey="feature"
                stroke="#2a2d3a"
                tick={{ fill: '#e2e8f0', fontSize: 12 }}
                tickLine={false}
                axisLine={false}
                width={160}
              />
              <Tooltip
                {...TOOLTIP_STYLE}
                formatter={(v) => [v.toFixed(4), 'Среднее |SHAP|']}
              />
              <Bar dataKey="value" fill="#3b82f6" radius={[0, 3, 3, 0]} maxBarSize={20} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="fc-empty">Загрузка SHAP...</div>
        )}
      </div>
    </div>
  )
}
