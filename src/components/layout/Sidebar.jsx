import { useState, useEffect } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  Home, Tv, CheckCircle, XCircle, BarChart2,
  Tag, Network, Bookmark, Menu, X
} from 'lucide-react'
import './Sidebar.css'

const InstagramIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
    <circle cx="12" cy="12" r="4"/>
    <circle cx="17.5" cy="6.5" r="0.5" fill="currentColor"/>
  </svg>
)

const NAV_ITEMS = [
  { to: '/', icon: Home, label: 'Home', end: true },
  { to: '/shows', icon: Tv, label: 'All Shows' },
  { to: '/completed', icon: CheckCircle, label: 'Completed' },
  { to: '/dropped', icon: XCircle, label: 'Dropped' },
  { to: '/watchlist', icon: Bookmark, label: 'Watchlist' },
  { to: '/map', icon: Network, label: 'Show Map' },
  { to: '/tags', icon: Tag, label: 'Tags' },
  { to: '/stats', icon: BarChart2, label: 'Stats' },
]

export default function Sidebar() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const location = useLocation()

  // Close on navigation
  useEffect(() => {
    setMobileOpen(false)
  }, [location.pathname])

  // Close on outside click
  useEffect(() => {
    if (!mobileOpen) return
    const handler = (e) => {
      if (!e.target.closest('.sidebar') && !e.target.closest('.mobile-menu-btn')) {
        setMobileOpen(false)
      }
    }
    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }, [mobileOpen])

  return (
    <>
      {/* Mobile top bar */}
      <div className="mobile-header">
        <div className="mobile-logo">
          <div className="logo-mark">N</div>
          <span className="logo-name">Nish Talks <span className="logo-sub">TV</span></span>
        </div>
        <button
          className="mobile-menu-btn btn btn-ghost"
          onClick={() => setMobileOpen(!mobileOpen)}
        >
          {mobileOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {/* Backdrop */}
      {mobileOpen && <div className="sidebar-mobile-backdrop" onClick={() => setMobileOpen(false)} />}

      {/* Sidebar */}
      <aside className={`sidebar ${mobileOpen ? 'mobile-open' : ''}`}>
        {/* Logo - desktop only */}
        <div className="sidebar-logo desktop-only">
          <div className="logo-mark">N</div>
          <div className="logo-text">
            <span className="logo-name">Nish Talks</span>
            <span className="logo-sub">TV</span>
          </div>
        </div>

        <nav className="sidebar-nav">
          {NAV_ITEMS.map(({ to, icon: Icon, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
            >
              <Icon size={16} strokeWidth={1.75} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <a
            href="https://instagram.com/nishtalkstv"
            target="_blank"
            rel="noopener noreferrer"
            className="sidebar-instagram"
          >
            <InstagramIcon />
            <span>@nishtalkstv</span>
          </a>
        </div>
      </aside>
    </>
  )
}
