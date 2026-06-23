import { useState, useEffect, useRef } from 'react'
import { Plus, Search, X, Filter, Trash2, BookMarked } from 'lucide-react'
import { watchlistApi, showsApi } from '../lib/db'
import { tmdb, getLanguageName, LANGUAGE_NAMES, GENRE_ICONS } from '../lib/tmdb'
import { useAuth } from '../lib/auth'
import PasswordModal from '../components/ui/PasswordModal'
import './Watchlist.css'

const GENRES = [
  'Action & Adventure','Animation','Comedy','Crime','Documentary','Drama',
  'Family','History','Horror','Mystery','Romance','Sci-Fi & Fantasy',
  'Thriller','War & Politics','Western',
]

const COUNTRY_NAMES = {
  US:'United States',GB:'United Kingdom',KR:'South Korea',JP:'Japan',
  FR:'France',DE:'Germany',IT:'Italy',ES:'Spain',AU:'Australia',
  CA:'Canada',IN:'India',BR:'Brazil',MX:'Mexico',DK:'Denmark',
  SE:'Sweden',NO:'Norway',NL:'Netherlands',IL:'Israel',TR:'Turkey',
}

export default function Watchlist() {
  const [shows, setShows] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [filters, setFilters] = useState({ genre:'', language:'', ratingMin:'', ratingMax:'' })
  const [showAddModal, setShowAddModal] = useState(false)
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const { isAuthenticated } = useAuth()

  const load = async () => {
    setLoading(true)
    try {
      const [data, s] = await Promise.all([
        watchlistApi.getAll(filters),
        watchlistApi.getStats(),
      ])
      setShows(data)
      setStats(s)
    } catch(e) { console.error(e) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [JSON.stringify(filters)])

  const handleAdd = () => {
    if (!isAuthenticated) { setShowPasswordModal(true); return }
    setShowAddModal(true)
  }

  const handleRemove = async (tmdbId) => {
    if (!isAuthenticated) { setShowPasswordModal(true); return }
    try { await watchlistApi.remove(tmdbId); load() }
    catch(e) { console.error(e) }
  }

  const filtered = shows.filter(s =>
    !search || s.title.toLowerCase().includes(search.toLowerCase())
  )

  const hasActiveFilters = Object.values(filters).some(Boolean)
  const clearFilters = () => setFilters({ genre:'', language:'', ratingMin:'', ratingMax:'' })

  const topGenres = stats ? Object.entries(stats.genreCounts).sort((a,b)=>b[1]-a[1]).slice(0,5) : []
  const topLangs = stats ? Object.entries(stats.langCounts).sort((a,b)=>b[1]-a[1]).slice(0,4) : []
  const topCountries = stats ? Object.entries(stats.countryCounts).sort((a,b)=>b[1]-a[1]).slice(0,4) : []

  return (
    <div className="watchlist-page">
      <div className="page-header">
        <div>
          <h1>Watchlist{stats && <span className="watchlist-count mono"> {stats.total}</span>}</h1>
          <p style={{ marginTop:'0.25rem', fontSize:'0.875rem' }}>Shows you want to watch.</p>
        </div>
        <button className="btn btn-primary" onClick={handleAdd}>
          <Plus size={16} /> Add Show
        </button>
      </div>

      {/* Stats strip */}
      {stats && stats.total > 0 && (
        <div className="watchlist-stats-strip card">
          <div className="wl-stat">
            <span className="mono wl-stat-value">{stats.total}</span>
            <span className="wl-stat-label">Shows</span>
          </div>
          {topGenres.length > 0 && (
            <div className="wl-stat-group">
              <span className="wl-stat-label">Top Genres</span>
              <div className="wl-stat-tags">
                {topGenres.map(([g,c]) => (
                  <span key={g} className="badge badge-blue">{GENRE_ICONS[g]||'🎬'} {g} <span className="mono">({c})</span></span>
                ))}
              </div>
            </div>
          )}
          {topLangs.length > 0 && (
            <div className="wl-stat-group">
              <span className="wl-stat-label">Languages</span>
              <div className="wl-stat-tags">
                {topLangs.map(([l,c]) => (
                  <span key={l} className="badge badge-muted">{getLanguageName(l)} <span className="mono">({c})</span></span>
                ))}
              </div>
            </div>
          )}
          {topCountries.length > 0 && (
            <div className="wl-stat-group">
              <span className="wl-stat-label">Countries</span>
              <div className="wl-stat-tags">
                {topCountries.map(([c,count]) => (
                  <span key={c} className="badge badge-muted">{COUNTRY_NAMES[c]||c} <span className="mono">({count})</span></span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Search + filters */}
      <div className="watchlist-controls">
        <div className="wl-search-wrap">
          <Search size={15} className="wl-search-icon" />
          <input className="input wl-search" placeholder="Search watchlist..." value={search} onChange={e=>setSearch(e.target.value)} />
          {search && <button className="btn btn-ghost btn-sm wl-search-clear" onClick={()=>setSearch('')}><X size={14}/></button>}
        </div>
        <button className={`btn btn-secondary btn-sm ${hasActiveFilters?'filters-active':''}`} onClick={()=>setShowFilters(!showFilters)}>
          <Filter size={14}/> Filters {hasActiveFilters&&'•'}
        </button>
      </div>

      {showFilters && (
        <div className="filters-panel card">
          <div className="filters-grid">
            <div className="form-group">
              <label className="form-label">Genre</label>
              <select className="select" value={filters.genre} onChange={e=>setFilters({...filters,genre:e.target.value})}>
                <option value="">All Genres</option>
                {GENRES.map(g=><option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Language</label>
              <select className="select" value={filters.language} onChange={e=>setFilters({...filters,language:e.target.value})}>
                <option value="">All Languages</option>
                {Object.entries(LANGUAGE_NAMES).map(([code,name])=><option key={code} value={code}>{name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Min TMDB Rating</label>
              <select className="select" value={filters.ratingMin} onChange={e=>setFilters({...filters,ratingMin:e.target.value})}>
                <option value="">Any</option>
                {[5,6,7,7.5,8,8.5,9].map(n=><option key={n} value={n}>{n}+</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Max TMDB Rating</label>
              <select className="select" value={filters.ratingMax} onChange={e=>setFilters({...filters,ratingMax:e.target.value})}>
                <option value="">Any</option>
                {[6,7,7.5,8,8.5,9,10].map(n=><option key={n} value={n}>{n}</option>)}
              </select>
            </div>
          </div>
          {hasActiveFilters && <button className="btn btn-ghost btn-sm" onClick={clearFilters} style={{marginTop:'0.75rem'}}><X size={14}/> Clear filters</button>}
        </div>
      )}

      {/* Grid */}
      {loading ? (
        <div style={{display:'flex',justifyContent:'center',padding:'3rem'}}>
          <div className="loading-spinner"/>
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <span className="empty-state-icon">📋</span>
          <h3>{search||hasActiveFilters?'No shows match':'Your watchlist is empty'}</h3>
          {!search && !hasActiveFilters && (
            <button className="btn btn-primary" onClick={handleAdd}><Plus size={16}/> Add your first show</button>
          )}
        </div>
      ) : (
        <div className="watchlist-grid">
          {filtered.map(show=>(
            <WatchlistCard key={show.id} show={show} onRemove={()=>handleRemove(show.tmdb_id)} />
          ))}
        </div>
      )}

      {showAddModal && <AddToWatchlistModal onClose={()=>setShowAddModal(false)} onSuccess={()=>{setShowAddModal(false);load()}} />}

      {showPasswordModal && (
        <PasswordModal
          onClose={()=>setShowPasswordModal(false)}
          onSuccess={()=>{setShowPasswordModal(false);setShowAddModal(true)}}
        />
      )}
    </div>
  )
}

function WatchlistCard({ show, onRemove }) {
  const poster = tmdb.posterUrl(show.poster_path)
  const year = show.first_air_date?.slice(0,4)
  const genres = show.genres?.slice(0,2) || []

  return (
    <div className="wl-card card">
      <div className="wl-card-poster">
        {poster ? <img src={poster} alt={show.title} loading="lazy"/> : <div className="wl-no-poster">📺</div>}
        {show.tmdb_rating && <div className="wl-tmdb-badge mono">{show.tmdb_rating}</div>}
        <button className="wl-remove-btn" onClick={onRemove} title="Remove from watchlist"><Trash2 size={14}/></button>
      </div>
      <div className="wl-card-body">
        <h4 className="wl-card-title">{show.title}</h4>
        <span className="wl-card-year mono">{year}</span>
        {genres.length > 0 && (
          <div className="wl-card-genres">
            {genres.map(g=><span key={g.id} className="badge badge-muted">{g.name}</span>)}
          </div>
        )}
        <div className="wl-card-meta mono">
          {getLanguageName(show.original_language)}
          {show.number_of_episodes && ` · ${show.number_of_episodes} eps`}
        </div>
      </div>
    </div>
  )
}

function AddToWatchlistModal({ onClose, onSuccess }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [adding, setAdding] = useState(null)
  const [statusMap, setStatusMap] = useState({}) // tmdbId -> 'watchlist' | 'watched'
  const searchTimeout = useRef(null)

  useEffect(() => {
    if (!query.trim()) { setResults([]); setStatusMap({}); return }
    clearTimeout(searchTimeout.current)
    searchTimeout.current = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await tmdb.searchShows(query)
        const shows = res.results?.slice(0,8) || []
        setResults(shows)

        // Check status for each result
        const newStatusMap = {}
        await Promise.all(shows.map(async (show) => {
          const [onWatchlist, watched] = await Promise.all([
            watchlistApi.isOnWatchlist(show.id),
            showsApi.getByTmdbId(show.id),
          ])
          if (onWatchlist) newStatusMap[show.id] = 'watchlist'
          else if (watched) newStatusMap[show.id] = 'watched'
        }))
        setStatusMap(newStatusMap)
      } catch(e) { console.error(e) }
      finally { setSearching(false) }
    }, 400)
  }, [query])

  const addShow = async (tmdbShow) => {
    if (statusMap[tmdbShow.id]) return
    setAdding(tmdbShow.id)
    try {
      const full = await tmdb.getShow(tmdbShow.id)
      await watchlistApi.add(full)
      setStatusMap(prev => ({ ...prev, [tmdbShow.id]: 'watchlist' }))
      onSuccess()
    } catch(e) { console.error(e) }
    finally { setAdding(null) }
  }

  const getStatusBadge = (tmdbId) => {
    const status = statusMap[tmdbId]
    if (status === 'watchlist') return (
      <span style={{fontSize:'0.75rem',color:'var(--blue-highlight)',flexShrink:0}}>In watchlist</span>
    )
    if (status === 'watched') return (
      <span style={{fontSize:'0.75rem',color:'var(--success)',flexShrink:0}}>Already watched</span>
    )
    return null
  }

  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal" style={{maxWidth:500}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'1.25rem'}}>
          <h2>Add to Watchlist</h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose}><X size={16}/></button>
        </div>
        <div className="search-input-wrap">
          <Search size={15} className="search-icon"/>
          <input className="input search-input" placeholder="Search for a show..." value={query} onChange={e=>setQuery(e.target.value)} autoFocus/>
          {searching && <div className="loading-spinner" style={{width:16,height:16}}/>}
        </div>
        {results.length > 0 && (
          <div className="search-results" style={{marginTop:'0.75rem'}}>
            {results.map(show=>{
              const status = statusMap[show.id]
              const isDisabled = !!status || adding===show.id
              return (
                <button key={show.id} className="search-result-item" onClick={()=>addShow(show)} disabled={isDisabled} style={{opacity: isDisabled && status ? 0.6 : 1}}>
                  {show.poster_path && <img src={tmdb.posterUrl(show.poster_path,'w92')} alt={show.name} className="search-result-poster"/>}
                  <div style={{flex:1,textAlign:'left'}}>
                    <div className="search-result-title">{show.name}</div>
                    <div className="search-result-year">{show.first_air_date?.slice(0,4)}</div>
                  </div>
                  {adding===show.id
                    ? <div className="loading-spinner" style={{width:16,height:16}}/>
                    : getStatusBadge(show.id) || <Plus size={16} style={{color:'var(--text-muted)',flexShrink:0}}/>
                  }
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
