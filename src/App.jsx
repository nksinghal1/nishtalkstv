import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Sidebar from './components/layout/Sidebar'
import Home from './pages/Home'
import Shows from './pages/Shows'
import Tags from './pages/Tags'
import Stats from './pages/Stats'
import ShowMap from './pages/ShowMap'
import { AuthProvider } from './lib/auth'
import './styles/globals.css'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <div className="app-layout">
          <Sidebar />
          <main className="main-content">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/shows" element={<Shows />} />
              <Route path="/completed" element={<Shows statusFilter="completed" />} />
              <Route path="/dropped" element={<Shows statusFilter="dropped" />} />
              <Route path="/map" element={<ShowMap />} />
              <Route path="/tags" element={<Tags />} />
              <Route path="/stats" element={<Stats />} />
            </Routes>
          </main>
        </div>
      </BrowserRouter>
    </AuthProvider>
  )
}
