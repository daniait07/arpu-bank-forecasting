const BASE = 'http://localhost:8000'

async function get(path) {
  const res = await fetch(`${BASE}${path}`)
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${path}`)
  return res.json()
}

async function post(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${path}`)
  return res.json()
}

export const api = {
  getDashboard: () => get('/dashboard'),
  getForecast: () => get('/forecast'),
  getWhatIf: (params) => post('/whatif', params),
  getHistory: () => get('/history'),
  getSegments: () => get('/segments'),
  getRevenueStructure: () => get('/revenue_structure'),
  getModelComparison: () => get('/model_comparison'),
  postForecast: (body) => post('/forecast', body),
  getShapSummary: () => get('/shap_summary'),
}
