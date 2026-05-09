import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import Dashboard from './pages/Dashboard'
import Forecast from './pages/Forecast'
import WhatIf from './pages/WhatIf'

export default function App() {
  return (
    <BrowserRouter>
      <div className="layout">
        <Sidebar />
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/forecast" element={<Forecast />} />
            <Route path="/whatif" element={<WhatIf />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}
