import { useEffect, useState } from 'react'
import {
  BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, LabelList,
} from 'recharts'
import LoadingSpinner from '../components/LoadingSpinner'
import { api } from '../api'
import './WhatIf.css'

const MODEL_OPTIONS = [
  { value: 'random_forest', label: 'Random Forest' },
  { value: 'xgboost',       label: 'XGBoost' },
  { value: 'lightgbm',      label: 'LightGBM' },
  { value: 'lasso',         label: 'Lasso' },
  { value: 'ridge',         label: 'Ridge' },
]

const SEGMENT_OPTIONS = [
  { value: 'all',     label: 'Все клиенты' },
  { value: 'mass',    label: 'Mass (15–45 руб/день)' },
  { value: 'comfort', label: 'Comfort (40–120 руб/день)' },
  { value: 'premium', label: 'Premium (100–400 руб/день)' },
  { value: 'vip',     label: 'VIP (300–1500 руб/день)' },
]

const MONTH_OPTIONS = [
  { value: 1,  label: 'Январь' },
  { value: 2,  label: 'Февраль' },
  { value: 3,  label: 'Март' },
  { value: 4,  label: 'Апрель' },
  { value: 5,  label: 'Май' },
  { value: 6,  label: 'Июнь' },
  { value: 7,  label: 'Июль' },
  { value: 8,  label: 'Август' },
  { value: 9,  label: 'Сентябрь' },
  { value: 10, label: 'Октябрь' },
  { value: 11, label: 'Ноябрь' },
  { value: 12, label: 'Декабрь' },
]

const SHAP_NAMES = {
  day_of_year:            'День года',
  week_of_year:           'Неделя года',
  arpu_lag_14:            'ARPU лаг 14д',
  arpu_lag_30:            'ARPU лаг 30д',
  arpu_min_7:             'Мин ARPU 7д',
  month:                  'Месяц',
  avg_balance_30d:        'Средний баланс',
  digital_score:          'Цифровая активность',
  churn_score:            'Вероятность оттока',
  arpu_roc_30:            'Изм. ARPU 30д %',
  arpu_diff_30:           'Разность ARPU 30д',
  arpu_lag_1:             'ARPU вчера',
  doy_cos:                'Косинус дня года',
  arpu_std_30:            'Станд. откл. 30д',
  arpu_max_30:            'Макс ARPU 30д',
  transactions_amount_7d: 'Транзакции 7д',
  credit_utilization:     'Кредитная нагрузка',
  num_products:           'Кол-во продуктов',
  is_weekend:             'Выходной',
  is_holiday:             'Праздник',
  is_salary_day:          'День зарплаты',
  is_month_end:           'Конец месяца',
  campaign_active:        'Кампания активна',
  campaign_response:      'Отклик клиента',
  offer_relevance:        'Релевантность предложения',
}

const LINEAR_MODELS = new Set(['lasso', 'ridge'])

const TOOLTIP_STYLE = {
  contentStyle: { background: '#161b27', border: '1px solid #2a2d3a', borderRadius: 6, fontSize: 12 },
  labelStyle:   { color: '#8892a4' },
  itemStyle:    { color: '#e2e8f0' },
}

const fmt2 = (n) => (typeof n === 'number' ? n.toFixed(2) : '—')

const productWord = (n) => {
  if (n % 100 >= 11 && n % 100 <= 19) return 'продуктов'
  const r = n % 10
  if (r === 1) return 'продукт'
  if (r >= 2 && r <= 4) return 'продукта'
  return 'продуктов'
}

function buildParams(f) {
  return {
    model:                  f.model,
    segment:                f.segment,
    avg_balance_30d:        f.avgBalance,
    transactions_amount_7d: f.transactionsAmount,
    credit_utilization:     f.creditUtilization,
    digital_score:          f.digitalScore,
    num_products:           f.numProducts,
    churn_score:            f.churnScore,
    month:                  f.month,
    is_weekend:             f.isWeekend,
    is_holiday:             f.isHoliday,
    is_salary_day:          f.isSalaryDay,
    is_month_end:           f.isMonthEnd,
    campaign_active:        f.campaignActive,
    campaign_response:      f.campaignActive ? f.campaignResponse : false,
    offer_relevance:        f.campaignActive ? f.offerRelevance : 0,
  }
}

function SliderRow({ label, value, onChange, min, max, step, display, danger }) {
  return (
    <div className="wi-slider-row">
      <div className="wi-slider-header">
        <span className="wi-slider-label">{label}</span>
        <span className="wi-slider-value" style={danger ? { color: 'var(--red)' } : undefined}>
          {display}
        </span>
      </div>
      <input
        type="range"
        className={`wi-slider${danger ? ' wi-slider-danger' : ''}`}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(+e.target.value)}
      />
    </div>
  )
}

function Toggle({ checked, onChange, label }) {
  return (
    <label className="wi-toggle">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="wi-toggle-track">
        <span className="wi-toggle-thumb" />
      </span>
      <span className="wi-toggle-label">{label}</span>
    </label>
  )
}

function SectionTitle({ children }) {
  return <h3 className="wi-section-title">{children}</h3>
}

function ShapBarLabel({ x, y, width, height, value }) {
  if (value == null) return null
  const positive = value >= 0
  const lx = positive ? x + Math.abs(width) + 5 : x - 5
  return (
    <text
      x={lx}
      y={y + height / 2}
      dy={4}
      fill="#8892a4"
      fontSize={11}
      textAnchor={positive ? 'start' : 'end'}
    >
      {value >= 0 ? '+' : ''}{value.toFixed(2)}
    </text>
  )
}

const INIT_FORM = {
  model:              'random_forest',
  segment:            'all',
  avgBalance:         200000,
  transactionsAmount: 50000,
  creditUtilization:  0.35,
  digitalScore:       50,
  numProducts:        3,
  churnScore:         0.25,
  month:              new Date().getMonth() + 1,
  isWeekend:          false,
  isHoliday:          false,
  isSalaryDay:        false,
  isMonthEnd:         false,
  campaignActive:     false,
  campaignResponse:   false,
  offerRelevance:     50,
}

export default function WhatIf() {
  const [form,    setForm]    = useState(INIT_FORM)
  const [result,  setResult]  = useState(null)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState(null)

  const set = (key) => (val) => setForm((f) => ({ ...f, [key]: val }))

  const runFetch = (f) => {
    setLoading(true)
    setError(null)
    api.getWhatIf(buildParams(f))
      .then((d) => { console.log('[WhatIf] API response:', d); setResult(d); setLoading(false) })
      .catch((e) => { setError(e.message); setLoading(false) })
  }

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    const params = buildParams(form)
    const timer = setTimeout(() => {
      if (cancelled) return
      api.getWhatIf(params)
        .then((d)  => { if (!cancelled) { console.log('[WhatIf] API response:', d); setResult(d); setLoading(false) } })
        .catch((e) => { if (!cancelled) { setError(e.message); setLoading(false) } })
    }, 400)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [form])

  const predictedArpu = result?.arpu_predicted
  const baselineArpu  = result?.arpu_baseline
  const deltaAbs      = result?.arpu_delta
  const deltaPct      = result?.arpu_delta_pct
  const percentile    = result?.context?.percentile
  const shapAvailable = result?.shap?.available ?? false
  const shapFeatures  = result?.shap?.features ?? []
  const shapValues    = result?.shap?.values ?? []

  const shapRaw = shapFeatures.map((feature, i) => ({ feature, value: shapValues[i] ?? 0 }))

  const shapData = [...shapRaw]
    .sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
    .slice(0, 10)
    .map((s) => ({ feature: SHAP_NAMES[s.feature] ?? s.feature, value: s.value }))
    .sort((a, b) => a.value - b.value)

  const top3Shap = [...shapRaw]
    .sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
    .slice(0, 3)

  const interpLead = (() => {
    if (!result) return null
    const pct = deltaPct ?? 0
    if (pct > 5)  return 'Сценарий показывает значительный рост ARPU относительно базового уровня.'
    if (pct < -5) return 'Сценарий показывает снижение ARPU относительно базового уровня.'
    return 'Сценарий близок к базовому уровню ARPU.'
  })()

  return (
    <div>
      <h1 className="page-title">Что если?</h1>

      <div className="wi-layout">
        <div className="wi-left card">
          <div className="wi-field">
            <label className="wi-label">Модель</label>
            <select
              className="wi-select"
              value={form.model}
              onChange={(e) => set('model')(e.target.value)}
            >
              {MODEL_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          <div className="wi-field">
            <label className="wi-label">Клиентский сегмент</label>
            <select
              className="wi-select"
              value={form.segment}
              onChange={(e) => set('segment')(e.target.value)}
            >
              {SEGMENT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          <SectionTitle>Финансовые показатели</SectionTitle>

          <SliderRow
            label="Средний баланс (30д)"
            value={form.avgBalance}
            onChange={set('avgBalance')}
            min={0} max={2000000} step={10000}
            display={form.avgBalance.toLocaleString('ru-RU') + ' руб'}
          />
          <SliderRow
            label="Транзакции за 7 дней"
            value={form.transactionsAmount}
            onChange={set('transactionsAmount')}
            min={0} max={500000} step={5000}
            display={form.transactionsAmount.toLocaleString('ru-RU') + ' руб'}
          />
          <SliderRow
            label="Кредитная нагрузка"
            value={form.creditUtilization}
            onChange={set('creditUtilization')}
            min={0} max={1} step={0.01}
            display={Math.round(form.creditUtilization * 100) + '%'}
          />

          <SectionTitle>Клиентский профиль</SectionTitle>

          <SliderRow
            label="Цифровая активность"
            value={form.digitalScore}
            onChange={set('digitalScore')}
            min={0} max={100} step={1}
            display={form.digitalScore + ' / 100'}
          />
          <SliderRow
            label="Количество продуктов"
            value={form.numProducts}
            onChange={set('numProducts')}
            min={1} max={21} step={1}
            display={form.numProducts + ' ' + productWord(form.numProducts)}
          />
          <SliderRow
            label="Вероятность оттока"
            value={form.churnScore}
            onChange={set('churnScore')}
            min={0} max={1} step={0.01}
            display={Math.round(form.churnScore * 100) + '%'}
            danger={form.churnScore > 0.5}
          />

          <SectionTitle>Календарь</SectionTitle>

          <div className="wi-field">
            <label className="wi-label">Месяц</label>
            <select
              className="wi-select"
              value={form.month}
              onChange={(e) => set('month')(+e.target.value)}
            >
              {MONTH_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          <div className="wi-toggles-grid">
            <Toggle checked={form.isWeekend}   onChange={set('isWeekend')}   label="Выходной день" />
            <Toggle checked={form.isHoliday}   onChange={set('isHoliday')}   label="Праздничный" />
            <Toggle checked={form.isSalaryDay} onChange={set('isSalaryDay')} label="День зарплаты" />
            <Toggle checked={form.isMonthEnd}  onChange={set('isMonthEnd')}  label="Конец месяца" />
          </div>

          <SectionTitle>Маркетинг</SectionTitle>

          <Toggle checked={form.campaignActive} onChange={set('campaignActive')} label="Активная кампания" />

          {form.campaignActive && (
            <div className="wi-campaign-extras">
              <Toggle
                checked={form.campaignResponse}
                onChange={set('campaignResponse')}
                label="Отклик клиента"
              />
              <SliderRow
                label="Релевантность предложения"
                value={form.offerRelevance}
                onChange={set('offerRelevance')}
                min={0} max={100} step={1}
                display={form.offerRelevance + ' / 100'}
              />
            </div>
          )}

          <button className="wi-calc-btn" onClick={() => runFetch(form)}>
            Рассчитать прогноз
          </button>
        </div>

        <div className="wi-right">
          {loading && (
            <div className="wi-right-loading">
              <LoadingSpinner text="Вычисление прогноза..." />
            </div>
          )}

          {!loading && error && (
            <div className="card wi-error-card">
              <div className="wi-error-icon">⚠</div>
              <p className="wi-error-msg">Не удалось получить прогноз</p>
              <p className="wi-error-detail">{error}</p>
              <p className="wi-error-hint">Проверьте, что API-сервер запущен на http://localhost:8000</p>
            </div>
          )}

          {!loading && !error && result && (
            <>
              <div className="card wi-result-card">
                <div className="wi-arpu-eyebrow">Прогноз ARPU</div>
                <div className="wi-arpu-value">
                  {typeof predictedArpu === 'number' ? predictedArpu.toFixed(2) : '—'}
                  <span className="wi-arpu-unit">руб/день</span>
                </div>
                {deltaAbs != null && deltaPct != null && (
                  <div className={`wi-delta ${deltaAbs >= 0 ? 'wi-delta-pos' : 'wi-delta-neg'}`}>
                    {deltaAbs >= 0 ? '▲' : '▼'}{' '}
                    {deltaAbs >= 0 ? '+' : ''}{fmt2(deltaAbs)} руб
                    {' '}({deltaPct >= 0 ? '+' : ''}{fmt2(deltaPct)}%)
                  </div>
                )}
                {baselineArpu != null && (
                  <div className="wi-baseline">
                    Базовый сценарий: {fmt2(baselineArpu)} руб/день
                  </div>
                )}
              </div>

              {percentile != null && (
                <div className="card wi-percentile-card">
                  <div className="wi-percentile-label">
                    Выше <strong>{Math.round(percentile)}%</strong> наблюдений тестовой выборки
                  </div>
                  <div className="wi-percentile-track">
                    <div
                      className="wi-percentile-fill"
                      style={{ width: `${Math.min(100, Math.max(0, percentile))}%` }}
                    />
                    <div
                      className="wi-percentile-marker"
                      style={{ left: `${Math.min(100, Math.max(0, percentile))}%` }}
                    />
                  </div>
                  <div className="wi-percentile-ends">
                    <span>0%</span>
                    <span>100%</span>
                  </div>
                </div>
              )}

              <div className="card">
                <h3 className="wi-chart-title">Вклад признаков в прогноз (SHAP)</h3>
                {!shapAvailable || LINEAR_MODELS.has(form.model) ? (
                  <div className="wi-notice">SHAP недоступен для данной модели</div>
                ) : shapData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={Math.max(200, shapData.length * 30)}>
                    <BarChart
                      data={shapData}
                      layout="vertical"
                      margin={{ top: 4, right: 72, left: 4, bottom: 4 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#2a2d3a" horizontal={false} />
                      <XAxis
                        type="number"
                        stroke="#2a2d3a"
                        tick={{ fill: '#8892a4', fontSize: 11 }}
                        tickLine={false}
                        tickFormatter={(v) => v.toFixed(1)}
                      />
                      <YAxis
                        type="category"
                        dataKey="feature"
                        stroke="#2a2d3a"
                        tick={{ fill: '#e2e8f0', fontSize: 12 }}
                        tickLine={false}
                        axisLine={false}
                        width={170}
                      />
                      <Tooltip
                        {...TOOLTIP_STYLE}
                        formatter={(v) => [`${v >= 0 ? '+' : ''}${v.toFixed(4)}`, 'SHAP']}
                        labelFormatter={(l) => l}
                      />
                      <ReferenceLine x={0} stroke="#2a2d3a" />
                      <Bar dataKey="value" maxBarSize={22} radius={[0, 3, 3, 0]}>
                        {shapData.map((entry, i) => (
                          <Cell key={i} fill={entry.value >= 0 ? '#34d399' : '#f87171'} />
                        ))}
                        <LabelList dataKey="value" content={<ShapBarLabel />} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="wi-notice">Нет данных SHAP</div>
                )}
              </div>

              {interpLead && (
                <div className="card wi-interp-card">
                  <h3 className="wi-chart-title">Интерпретация</h3>
                  <p className="wi-interp-lead">{interpLead}</p>
                  {top3Shap.length > 0 && (
                    <ul className="wi-interp-list">
                      {top3Shap.map((s, i) => (
                        <li key={i} className={s.value >= 0 ? 'wi-interp-pos' : 'wi-interp-neg'}>
                          <span className="wi-interp-feat">
                            {SHAP_NAMES[s.feature] ?? s.feature}:
                          </span>{' '}
                          {s.value >= 0 ? '+' : ''}{s.value.toFixed(2)} руб к прогнозу
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </>
          )}

          {!loading && !error && !result && (
            <div className="card wi-empty-state">
              <p>Настройте параметры — прогноз обновится автоматически.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
