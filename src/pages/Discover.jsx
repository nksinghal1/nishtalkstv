import { useState, useEffect, useRef } from 'react'
import { Plus, X, ChevronRight, Filter, SlidersHorizontal } from 'lucide-react'
import { tmdb, getLanguageName, LANGUAGE_NAMES } from '../lib/tmdb'
import { watchlistApi } from '../lib/db'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import PasswordModal from '../components/ui/PasswordModal'
import './Discover.css'

const TMDB_GENRES = [
  { id: 10759, name: 'Action & Adventure' },
  { id: 35, name: 'Comedy' },
  { id: 80, name: 'Crime' },
  { id: 99, name: 'Documentary' },
  { id: 18, name: 'Drama' },
  { id: 10765, name: 'Sci-Fi & Fantasy' },
  { id: 9648, name: 'Mystery' },
  { id: 10768, name: 'War & Politics' },
  { id: 37, name: 'Western' },
  { id: 16, name: 'Animation' },
  { id: 27, name: 'Horror' },
]

const COUNTRY_NAMES = {
  US:'United States',GB:'United Kingdom',KR:'South Korea',JP:'Japan',
  FR:'France',DE:'Germany',IT:'Italy',ES:'Spain',AU:'Australia',
  CA:'Canada',IN:'India',BR:'Brazil',MX:'Mexico',DK:'Denmark',
  SE:'Sweden',NO:'Norway',NL:'Netherlands',IL:'Israel',TR:'Turkey',
  RO:'Romania',IS:'Iceland',HU:'Hungary',GR:'Greece',RS:'Serbia',
  PL:'Poland',PT:'Portugal',AR:'Argentina',RU:'Russia',CN:'China',
  BE:'Belgium',AT:'Austria',FI:'Finland',IE:'Ireland',NZ:'New Zealand',
}

const DISMISSED_KEY = 'nish_dismissed_shows'
function getDismissed() {
  try { return new Set(JSON.parse(localStorage.getItem(DISMISSED_KEY) || '[]')) }
  catch { return new Set() }
}
function saveDismissed(set) {
  localStorage.setItem(DISMISSED_KEY, JSON.stringify([...set]))
}

// ─── SETUP SCREEN ────────────────────────────────────────────────────────────
function SetupScreen({ onStart }) {
  const [filters, setFilters] = useState({
    minRating: '7',
    genre: '',
    language: '',
    minYear: '',
    sort: 'popularity.desc',
  })

  return (
    <div className="discover-setup">
      <div className="discover-setup-inner">
        <div className="discover-setup-icon">🎬</div>
        <h2>Discover Shows</h2>
        <p>Set your filters and we'll show you one show at a time.<br/>Add to watchlist or skip — your call.</p>

        <div className="discover-setup-filters">
          <div className="form-group">
            <label className="form-label">Min TMDB Rating</label>
            <select className="select" value={filters.minRating} onChange={e=>setFilters({...filters,minRating:e.target.value})}>
              {[6,6.5,7,7.5,8,8.5,9].map(n=><option key={n} value={n}>{n}+</option>)}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Genre <span style={{color:'var(--text-muted)'}}>— optional</span></label>
            <select className="select" value={filters.genre} onChange={e=>setFilters({...filters,genre:e.target.value})}>
              <option value="">Any Genre</option>
              {TMDB_GENRES.map(g=><option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Language <span style={{color:'var(--text-muted)'}}>— optional</span></label>
            <select className="select" value={filters.language} onChange={e=>setFilters({...filters,language:e.target.value})}>
              <option value="">Any Language</option>
              {Object.entries(LANGUAGE_NAMES).slice(0,20).map(([code,name])=>(
                <option key={code} value={code}>{name}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">From Year <span style={{color:'var(--text-muted)'}}>— optional</span></label>
            <select className="select" value={filters.minYear} onChange={e=>setFilters({...filters,minYear:e.target.value})}>
              <option value="">Any Year</option>
              {[2024,2023,2022,2021,2020,2015,2010,2005,2000].map(y=>(
                <option key={y} value={y}>{y}+</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Sort By</label>
            <select className="select" value={filters.sort} onChange={e=>setFilters({...filters,sort:e.target.value})}>
              <option value="popularity.desc">Most Popular</option>
              <option value="vote_average.desc">Highest Rated</option>
              <option value="first_air_date.desc">Newest First</option>
            </select>
          </div>
        </div>

        <button className="btn btn-primary discover-start-btn" onClick={() => onStart(filters)}>
          Start Discovering <ChevronRight size={16}/>
        </button>
      </div>
    </div>
  )
}

// ─── MAIN DISCOVER ───────────────────────────────────────────────────────────
export default function Discover() {
  const [phase, setPhase] = useState('setup') // 'setup' | 'browsing'
  const [filters, setFilters] = useState(null)
  const [queue, setQueue] = useState([]) // pre-fetched shows
  const [currentShow, setCurrentShow] = useState(null)
  const [loading, setLoading] = useState(false)
  const [adding, setAdding] = useState(false)
  const [page, setPage] = useState(1)
  const [excluded, setExcluded] = useState(new Set()) // watched + watchlisted + dismissed
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [stats, setStats] = useState({ added: 0, skipped: 0 })
  const { isAuthenticated } = useAuth()

  const filtersRef = useRef(filters)
  filtersRef.current = filters
  const pageRef = useRef(page)
  pageRef.current = page
  const excludedRef = useRef(excluded)
  excludedRef.current = excluded

  const loadExcluded = async () => {
    const dismissed = getDismissed()
    const [watched, watchlisted] = await Promise.all([
      supabase.from('shows').select('tmdb_id').then(r => r.data || []),
      supabase.from('watchlist').select('tmdb_id').then(r => r.data || []),
    ])
    const all = new Set([
      ...dismissed,
      ...watched.map(s => s.tmdb_id),
      ...watchlisted.map(s => s.tmdb_id),
    ])
    setExcluded(all)
    return all
  }

  const fetchMore = async (currentFilters, currentPage, currentExcluded) => {
    try {
      const params = {
        sort_by: currentFilters.sort,
        'vote_average.gte': currentFilters.minRating,
        'vote_count.gte': '200',
        page: currentPage,
      }
      if (currentFilters.genre) params.with_genres = currentFilters.genre
      if (currentFilters.language) params.with_original_language = currentFilters.language
      if (currentFilters.minYear) params['first_air_date.gte'] = `${currentFilters.minYear}-01-01`

      const res = await tmdb.discoverShows(params)
      const results = (res.results || []).filter(s => !currentExcluded.has(s.id))
      return { results, hasMore: currentPage < Math.min(res.total_pages || 1, 500) }
    } catch { return { results: [], hasMore: false } }
  }

  const handleStart = async (selectedFilters) => {
    setLoading(true)
    setFilters(selectedFilters)
    setPhase('browsing')
    setStats({ added: 0, skipped: 0 })

    const ex = await loadExcluded()

    const { results } = await fetchMore(selectedFilters, 1, ex)
    setPage(2)
    if (results.length > 0) {
      // Fetch full details for first show
      const full = await tmdb.getShow(results[0].id)
      setCurrentShow({ ...results[0], ...full })
      setQueue(results.slice(1))
    }
    setLoading(false)
  }

  const advance = async (nextQueue, nextPage) => {
    // Pre-fetch more if queue is running low
    let q = [...nextQueue]
    let p = nextPage

    if (q.length < 3) {
      const { results } = await fetchMore(filtersRef.current, p, excludedRef.current)
      q = [...q, ...results]
      p = p + 1
      setPage(p)
    }

    if (q.length === 0) {
      setCurrentShow(null)
      setQueue([])
      return
    }

    const next = q[0]
    const full = await tmdb.getShow(next.id)
    setCurrentShow({ ...next, ...full })
    setQueue(q.slice(1))
  }

  const handleAdd = async () => {
    if (!isAuthenticated) { setShowPasswordModal(true); return }
    if (!currentShow) return
    setAdding(true)
    try {
      await watchlistApi.add(currentShow)
      const newExcluded = new Set([...excluded, currentShow.id])
      setExcluded(newExcluded)
      setStats(s => ({ ...s, added: s.added + 1 }))
      await advance(queue, page)
    } catch (e) { console.error(e) }
    finally { setAdding(false) }
  }

  const handleSkip = async () => {
    if (!currentShow) return
    const newDismissed = getDismissed()
    newDismissed.add(currentShow.id)
    saveDismissed(newDismissed)
    const newExcluded = new Set([...excluded, currentShow.id])
    setExcluded(newExcluded)
    setStats(s => ({ ...s, skipped: s.skipped + 1 }))
    await advance(queue, page)
  }

  if (phase === 'setup') {
    return <SetupScreen onStart={handleStart} />
  }

  if (loading) {
    return (
      <div className="discover-loading">
        <div className="loading-spinner" style={{width:32,height:32}}/>
        <p>Loading shows...</p>
      </div>
    )
  }

  if (!currentShow) {
    return (
      <div className="discover-done">
        <div className="discover-done-icon">🎉</div>
        <h2>All caught up!</h2>
        <p>You've been through everything matching these filters.</p>
        <div className="discover-done-stats">
          <span className="badge badge-green">+{stats.added} added to watchlist</span>
          <span className="badge badge-muted">{stats.skipped} skipped</span>
        </div>
        <button className="btn btn-primary" onClick={() => setPhase('setup')} style={{marginTop:'1.5rem'}}>
          <SlidersHorizontal size={15}/> Change Filters
        </button>
      </div>
    )
  }

  const poster = tmdb.backdropUrl(currentShow.backdrop_path) || tmdb.posterUrl(currentShow.poster_path, 'w500')
  const genres = currentShow.genres || []
  const countries = (currentShow.origin_country || []).map(c => COUNTRY_NAMES[c] || c)

  return (
    <div className="discover-browse">
      {/* Progress bar */}
      <div className="discover-topbar">
        <button className="btn btn-ghost btn-sm" onClick={() => setPhase('setup')}>
          <SlidersHorizontal size={14}/> Filters
        </button>
        <div className="discover-session-stats">
          <span className="badge badge-green mono">+{stats.added}</span>
          <span className="badge badge-muted mono">{stats.skipped} skipped</span>
        </div>
      </div>

      {/* Show card */}
      <div className="discover-show-card card">
        {/* Backdrop/poster */}
        {poster && (
          <div className="dsc-backdrop">
            <img src={poster} alt={currentShow.name}/>
            <div className="dsc-backdrop-fade"/>
          </div>
        )}

        <div className="dsc-content">
          {/* Title + meta */}
          <div className="dsc-header">
            <h1 className="dsc-title">{currentShow.name}</h1>
            <div className="dsc-meta-row">
              {currentShow.first_air_date?.slice(0,4) && (
                <span className="mono dsc-year">{currentShow.first_air_date.slice(0,4)}</span>
              )}
              {currentShow.vote_average > 0 && (
                <span className="badge badge-blue mono">⭐ {currentShow.vote_average?.toFixed(1)}</span>
              )}
              {currentShow.number_of_episodes && (
                <span className="badge badge-muted mono">{currentShow.number_of_episodes} eps</span>
              )}
              {currentShow.number_of_seasons && (
                <span className="badge badge-muted mono">{currentShow.number_of_seasons} seasons</span>
              )}
            </div>
          </div>

          {/* Info grid */}
          <div className="dsc-info-grid">
            {getLanguageName(currentShow.original_language) && (
              <InfoPill label="Language" value={getLanguageName(currentShow.original_language)}/>
            )}
            {countries.length > 0 && (
              <InfoPill label="Country" value={countries.join(', ')}/>
            )}
            {currentShow.status && (
              <InfoPill label="Status" value={currentShow.status}/>
            )}
            {currentShow.networks?.[0] && (
              <InfoPill label="Network" value={currentShow.networks[0].name}/>
            )}
          </div>

          {/* Genres */}
          {genres.length > 0 && (
            <div className="dsc-genres">
              {genres.map(g => <span key={g.id} className="badge badge-blue">{g.name}</span>)}
            </div>
          )}

          {/* Overview */}
          {currentShow.overview && (
            <p className="dsc-overview">{currentShow.overview}</p>
          )}
        </div>
      </div>

      {/* Action buttons */}
      <div className="discover-actions">
        <button className="discover-btn-skip" onClick={handleSkip}>
          <X size={24}/>
          <span>Not Interested</span>
        </button>
        <button className="discover-btn-add" onClick={handleAdd} disabled={adding}>
          {adding
            ? <div className="loading-spinner" style={{width:24,height:24,borderColor:'white',borderTopColor:'var(--blue-highlight)'}}/>
            : <Plus size={24}/>
          }
          <span>Add to Watchlist</span>
        </button>
      </div>

      {showPasswordModal && (
        <PasswordModal
          onClose={() => setShowPasswordModal(false)}
          onSuccess={() => { setShowPasswordModal(false); handleAdd() }}
        />
      )}
    </div>
  )
}

function InfoPill({ label, value }) {
  return (
    <div className="dsc-info-pill">
      <span className="dsc-info-label">{label}</span>
      <span className="dsc-info-value">{value}</span>
    </div>
  )
}
