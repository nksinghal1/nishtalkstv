import { NavLink } from 'react-router-dom'
import {
  Home, Tv, CheckCircle, XCircle, BarChart2,
  Tag, Network
} from 'lucide-react'

// Simple Instagram SVG since lucide-react 0.383 doesn't export it
const InstagramIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
    <circle cx="12" cy="12" r="4"/>
    <circle cx="17.5" cy="6.5" r="0.5" fill="currentColor"/>
  </svg>
)
import './Sidebar.css'

const NAV_ITEMS = [
  { to: '/', icon: Home, label: 'Home', end: true },
  { to: '/shows', icon: Tv, label: 'All Shows' },
  { to: '/completed', icon: CheckCircle, label: 'Completed' },
  { to: '/dropped', icon: XCircle, label: 'Dropped' },
  { to: '/map', icon: Network, label: 'Show Map' },
  { to: '/tags', icon: Tag, label: 'Tags' },
  { to: '/stats', icon: BarChart2, label: 'Stats' },
]

export default function Sidebar() {
  return (
    <aside className="sidebar">
      {/* Logo */}
      <div className="sidebar-logo">
        <div className="logo-mark">N</div>
        <div className="logo-text">
          <span className="logo-name">Nish Talks</span>
          <span className="logo-sub">TV</span>
        </div>
      </div>

      {/* Nav */}
      <nav className="sidebar-nav">
        {NAV_ITEMS.map(({ to, icon: Icon, label, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `sidebar-link ${isActive ? 'active' : ''}`
            }
          >
            <Icon size={16} strokeWidth={1.75} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
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
  )
}
