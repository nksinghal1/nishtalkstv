import { useState, useEffect } from 'react'
import { Plus, Filter, Search, X } from 'lucide-react'
import { useAuth } from '../lib/auth'
import PasswordModal from '../components/ui/PasswordModal'
import { showsApi } from '../lib/db'
import { getLanguageName, LANGUAGE_NAMES } from '../lib/tmdb'
import ShowCard from '../components/shows/ShowCard'
import ShowDetailSidebar from '../components/shows/ShowDetailSidebar'
import LogShowModal from '../components/shows/LogShowModal'
import './Shows.css'

const GENRES = [
  'Action & Adventure', 'Animation', 'Comedy', 'Crime', 'Documentary',
  'Drama', 'Family', 'History', 'Horror', 'Mystery', 'Romance',
  'Sci-Fi & Fantasy', 'Thriller', 'War & Politics', 'Western',
]

export default function Shows({ statusFilter = null }) {
  const [shows, setShows] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedShow, setSelectedShow] = useState(null)
  const [showLogModal, setShowLogModal] = useState(false)
  const [editShow, setEditShow] = useState(null)
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const { isAuthenticated } = useAuth()

  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState({
    genre: '',
    language: '',
    ratingMin: '',
    ratingMax: '',
  })
  const [showFilters, setShowFilters] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const activeFilters = {
        ...filters,
        status: statusFilter,
      }
      const data = await showsApi.getAllWithLogs(activeFilters)
      setShows(data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [filters, statusFilter])

  const handleEdit = (show) => {
    setSelectedShow(null)
    setEditShow(show)
  }

  const filtered = shows.filter(show =>
    !search || show.title.toLowerCase().includes(search.toLowerCase())
  )

  const clearFilters = () => setFilters({ genre: '', language: '', ratingMin: '', ratingMax: '' })
  const hasActiveFilters = Object.values(filters).some(Boolean)

  const pageTitle = statusFilter === 'completed'
    ? 'Completed'
    : statusFilter === 'dropped'
    ? 'Dropped'
    : 'All Shows'

  return (
    <div className="shows-page">
      <div className="page-header">
        <h1>{pageTitle}
          <span className="show-count mono"> {filtered.length}</span>
        </h1>
        <div className="shows-header-actions">
          <button
            className={`btn btn-secondary btn-sm ${hasActiveFilters ? 'filters-active' : ''}`}
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter size={14} /> Filters {hasActiveFilters && '•'}
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => isAuthenticated ? setShowLogModal(true) : setShowPasswordModal(true)}>
            <Plus size={14} /> Log Show
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="shows-search-wrap">
        <Search size={15} className="search-icon" style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
        <input
          className="input shows-search"
          placeholder="Search your shows..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        {search && (
          <button
            className="btn btn-ghost btn-sm"
            style={{ position: 'absolute', right: '0.5rem', top: '50%', transform: 'translateY(-50%)' }}
            onClick={() => setSearch('')}
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Filters panel */}
      {showFilters && (
        <div className="filters-panel card">
          <div className="filters-grid">
            <div className="form-group">
              <label className="form-label">Genre</label>
              <select
                className="select"
                value={filters.genre}
                onChange={e => setFilters({ ...filters, genre: e.target.value })}
              >
                <option value="">All Genres</option>
                {GENRES.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Language</label>
              <select
                className="select"
                value={filters.language}
                onChange={e => setFilters({ ...filters, language: e.target.value })}
              >
                <option value="">All Languages</option>
                {Object.entries(LANGUAGE_NAMES).map(([code, name]) => (
                  <option key={code} value={code}>{name}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Min Rating</label>
              <select
                className="select"
                value={filters.ratingMin}
                onChange={e => setFilters({ ...filters, ratingMin: e.target.value })}
              >
                <option value="">Any</option>
                {[1,2,3,4,5,6,7,8,9,10].map(n => (
                  <option key={n} value={n}>{n}+</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Max Rating</label>
              <select
                className="select"
                value={filters.ratingMax}
                onChange={e => setFilters({ ...filters, ratingMax: e.target.value })}
              >
                <option value="">Any</option>
                {[1,2,3,4,5,6,7,8,9,10].map(n => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>
          </div>

          {hasActiveFilters && (
            <button className="btn btn-ghost btn-sm" onClick={clearFilters} style={{ marginTop: '0.75rem' }}>
              <X size={14} /> Clear all filters
            </button>
          )}
        </div>
      )}

      {/* Grid */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
          <div className="loading-spinner" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <span className="empty-state-icon">🔍</span>
          <h3>{search || hasActiveFilters ? 'No shows match your filters' : 'Nothing here yet'}</h3>
          {!search && !hasActiveFilters && (
            <button className="btn btn-primary" onClick={() => isAuthenticated ? setShowLogModal(true) : setShowPasswordModal(true)}>
              <Plus size={16} /> Log a Show
            </button>
          )}
        </div>
      ) : (
        <div className="shows-grid">
          {filtered.map(show => (
            <ShowCard
              key={show.id}
              show={show}
              onClick={() => setSelectedShow(show)}
            />
          ))}
        </div>
      )}

      {showPasswordModal && (
        <PasswordModal
          onClose={() => setShowPasswordModal(false)}
          onSuccess={() => { setShowPasswordModal(false); setShowLogModal(true) }}
        />
      )}

      {selectedShow && (
        <ShowDetailSidebar
          show={selectedShow}
          onClose={() => setSelectedShow(null)}
          onEdit={handleEdit}
        />
      )}

      {(showLogModal || editShow) && (
        <LogShowModal
          editShow={editShow}
          onClose={() => { setShowLogModal(false); setEditShow(null) }}
          onSuccess={() => { load(); setShowLogModal(false); setEditShow(null) }}
          onEdit={(show) => { setShowLogModal(false); setEditShow(show) }}
        />
      )}
    </div>
  )
}
