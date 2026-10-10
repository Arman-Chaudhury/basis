import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route, NavLink, Link, useLocation } from 'react-router-dom'
import './index.css'
import Landing from './pages/Landing.jsx'
import Overview from './pages/Overview.jsx'
import Event from './pages/Event.jsx'
import Calibration from './pages/Calibration.jsx'
import { api } from './api.js'
import { initSmooth, ScrollTrigger } from './lib/smooth.js'

function Shell() {
  const [health, setHealth] = React.useState(null)
  const loc = useLocation()
  React.useEffect(() => { api.health().then(setHealth).catch(() => setHealth({ ok: false })) }, [])
  React.useEffect(() => { const l = initSmooth(); l.scrollTo(0, { immediate: true }); ScrollTrigger.refresh() }, [loc.pathname])
  const onLanding = loc.pathname === '/'
  const link = ({ isActive }) => `px-3 py-1.5 rounded-full text-sm ${isActive ? 'bg-ink-3 text-bone' : 'text-grey-300 hover:text-bone'}`
  return (
    <div className="min-h-screen">
      <header className={`sticky top-0 z-30 ${onLanding ? 'bg-transparent' : 'bg-ink/80 backdrop-blur border-b border-grey-700/40'}`}>
        <div className="mx-auto max-w-7xl px-5 h-14 flex items-center gap-6">
          <Link to="/" className="flex items-center gap-2"><span className="w-5 h-5 rounded-full border border-bone/70 grid place-items-center"><span className="w-1.5 h-1.5 rounded-full bg-bone" /></span><span className="display text-base tracking-[0.06em]">Basis</span></Link>
          {!onLanding && <nav className="flex gap-1">
            <NavLink to="/app" className={link}>Desk</NavLink>
            <NavLink to="/calibration" className={link}>Calibration</NavLink>
          </nav>}
          <div className="ml-auto flex items-center gap-3 text-xs text-grey-500">
            {health?.demo_mode && <span className="rounded-full border border-brass/50 text-brass px-2 py-0.5">DEMO SNAPSHOT</span>}
            {health && !health.ok && <span className="rounded-full border border-rose-400/40 text-rose-200 px-2 py-0.5">API DOWN</span>}
            {!onLanding && health?.last_refresh?.ts && <span>refreshed {new Date(health.last_refresh.ts).toLocaleTimeString()}</span>}
            {onLanding ? <Link to="/app" className="pill !h-9 !px-4">Open the desk</Link> : <Link to="/" className="pill-ghost !h-8 !px-3">Home</Link>}
          </div>
        </div>
      </header>
      <main className={onLanding ? '' : 'mx-auto max-w-7xl px-5 py-6'}>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/app" element={<Overview />} />
          <Route path="/events/:id" element={<Event />} />
          <Route path="/calibration" element={<Calibration />} />
        </Routes>
      </main>
    </div>
  )
}
ReactDOM.createRoot(document.getElementById('root')).render(<BrowserRouter><Shell /></BrowserRouter>)
