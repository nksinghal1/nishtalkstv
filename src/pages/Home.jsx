import { useState, useEffect } from 'react'
import { Plus, ChevronDown, ChevronUp, X } from 'lucide-react'
import { useAuth } from '../lib/auth'
import PasswordModal from '../components/ui/PasswordModal'
import { showsApi, statsApi } from '../lib/db'
import { supabase } from '../lib/supabase'
import ShowDetailSidebar from '../components/shows/ShowDetailSidebar'
import LogShowModal from '../components/shows/LogShowModal'
import { tmdb, RATING_LABELS, getLanguageName } from '../lib/tmdb'
import './Home.css'

const COUNTRY_NAMES = {
  US:'United States',GB:'United Kingdom',KR:'South Korea',JP:'Japan',
  FR:'France',DE:'Germany',IT:'Italy',ES:'Spain',AU:'Australia',
  CA:'Canada',IN:'India',BR:'Brazil',MX:'Mexico',DK:'Denmark',
  SE:'Sweden',NO:'Norway',NL:'Netherlands',IL:'Israel',TR:'Turkey',
  RO:'Romania',IS:'Iceland',HU:'Hungary',GR:'Greece',RS:'Serbia',
  PL:'Poland',PT:'Portugal',AR:'Argentina',RU:'Russia',CN:'China',
  BE:'Belgium',AT:'Austria',FI:'Finland',IE:'Ireland',NZ:'New Zealand',
  ZA:'South Africa',TH:'Thailand',CO:'Colombia',CY:'Cyprus',
}

// ─── STAT CARD ────────────────────────────────────────────────────
function StatCard({ label, value, sub, active, onClick }) {
  return (
    <button className={`home-stat-card ${active ? 'active' : ''}`} onClick={onClick}>
      <span className="home-stat-value mono">{value}</span>
      <span className="home-stat-label">{label}</span>
      {sub && <span className="home-stat-sub">{sub}</span>}
      <span className="home-stat-chevron">{active ? <ChevronUp size={12}/> : <ChevronDown size={12}/>}</span>
    </button>
  )
}

// ─── SHOW ROW ─────────────────────────────────────────────────────
function ShowRow({ show, rank, onClick }) {
  const poster = tmdb.posterUrl(show.poster_path, 'w92')
  const year = show.first_air_date?.slice(0,4)
  return (
    <div className="home-show-row" onClick={onClick}>
      <span className="home-show-rank mono">#{rank}</span>
      <div className="home-show-poster">
        {poster ? <img src={poster} alt={show.title}/> : <span>📺</span>}
      </div>
      <div className="home-show-info">
        <span className="home-show-title">{show.title}</span>
        <span className="home-show-meta mono">{year}{show.original_language && ` · ${show.original_language.toUpperCase()}`}</span>
      </div>
      <div className="home-show-ratings">
        {show.rating && <span className="home-my-rating mono">{show.rating}/10</span>}
        {show.tmdb_rating && <span className="home-tmdb-rating mono">TMDB {show.tmdb_rating}</span>}
      </div>
    </div>
  )
}

// ─── DRILL DOWN PANEL ─────────────────────────────────────────────
function DrillPanel({ title, shows, onClose, onShowClick }) {
  return (
    <>
      <div className="drill-backdrop" onClick={onClose}/>
      <div className="drill-panel card">
        <div className="drill-header">
          <h3>{title}</h3>
          <button className="btn btn-ghost btn-sm" onClick={onClose}><X size={16}/></button>
        </div>
        <div className="drill-list">
          {shows.length === 0
            ? <p style={{padding:'1.5rem',color:'var(--text-muted)',textAlign:'center'}}>No shows found.</p>
            : shows.map((show, i) => (
                <ShowRow key={show.id} show={show} rank={i+1} onClick={() => onShowClick(show)}/>
              ))
          }
        </div>
      </div>
    </>
  )
}

export default function Home() {
  const [allShows, setAllShows] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activePanel, setActivePanel] = useState(null)
  const [drillPanel, setDrillPanel] = useState(null) // { title, shows }
  const [selectedShow, setSelectedShow] = useState(null)
  const [showLogModal, setShowLogModal] = useState(false)
  const [editShow, setEditShow] = useState(null)
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const { isAuthenticated } = useAuth()

  const load = async () => {
    setLoading(true)
    try {
      const [shows, s] = await Promise.all([
        showsApi.getAllWithLogs(),
        statsApi.getSummary(),
      ])
      setAllShows(shows)
      setStats(s)
    } catch(e) { console.error(e) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const handleEdit = (show) => { setSelectedShow(null); setEditShow(show) }
  const togglePanel = (key) => setActivePanel(prev => prev === key ? null : key)

  // Derive lists
  const completed = allShows.filter(s => s.watch_status === 'completed')
  const recent = [...completed].sort((a,b) => {
    const dateA = new Date(a.date_watched_override || a.date_watched)
    const dateB = new Date(b.date_watched_override || b.date_watched)
    return dateB - dateA
  }).slice(0, 20)
  const topRated = [...completed].filter(s => s.rating).sort((a,b) => b.rating - a.rating || (b.tmdb_rating||0) - (a.tmdb_rating||0)).slice(0, 20)
  const underrated = [...completed].filter(s => s.rating && s.tmdb_rating && s.rating >= 8 && s.tmdb_rating <= 7.0)
    .sort((a,b) => (b.rating - (b.tmdb_rating||0)) - (a.rating - (a.tmdb_rating||0))).slice(0, 20)

  // Genre data
  const genreMap = {}
  completed.forEach(s => (s.genres||[]).forEach(g => { genreMap[g.name] = (genreMap[g.name]||0)+1 }))
  const genreData = Object.entries(genreMap).sort((a,b)=>b[1]-a[1])
  const maxGenre = genreData[0]?.[1] || 1

  // Language data with shows
  const langMap = {}
  allShows.forEach(s => {
    if (s.original_language) {
      if (!langMap[s.original_language]) langMap[s.original_language] = []
      langMap[s.original_language].push(s)
    }
  })
  const langData = Object.entries(langMap).sort((a,b)=>b[1].length-a[1].length)

  // Country data with shows
  const countryMap = {}
  allShows.forEach(s => (s.origin_country||[]).forEach(c => {
    if (!countryMap[c]) countryMap[c] = []
    countryMap[c].push(s)
  }))
  const countryData = Object.entries(countryMap).sort((a,b)=>b[1].length-a[1].length)

  if (loading) return (
    <div style={{display:'flex',justifyContent:'center',paddingTop:'4rem'}}>
      <div className="loading-spinner" style={{width:32,height:32}}/>
    </div>
  )

  return (
    <div className="home-page">
      {/* Header */}
      <div className="home-header">
        <div>
          <h1>Good Shows. Great Stories.</h1>
          <p>Your personal TV archive.</p>
        </div>
        <button className="btn btn-primary" onClick={() => isAuthenticated ? setShowLogModal(true) : setShowPasswordModal(true)}>
          <Plus size={16}/> Log a Show
        </button>
      </div>

      {/* Stat cards */}
      {stats && (
        <div className="home-stats-row">
          <StatCard label="Shows Logged" value={stats.total} sub={`${stats.completed} completed`} active={activePanel==='shows'} onClick={()=>togglePanel('shows')}/>
          <StatCard label="Episodes" value={stats.totalEpisodes.toLocaleString()} sub={`avg ${stats.avgRating||'—'}/10`} active={activePanel==='episodes'} onClick={()=>togglePanel('episodes')}/>
          <StatCard label="Genres" value={genreData.length} sub="genres watched" active={activePanel==='genres'} onClick={()=>togglePanel('genres')}/>
          <StatCard label="Languages" value={langData.length} sub="languages" active={activePanel==='languages'} onClick={()=>togglePanel('languages')}/>
          <StatCard label="Countries" value={countryData.length} sub="countries" active={activePanel==='countries'} onClick={()=>togglePanel('countries')}/>
        </div>
      )}

      {/* Accordion panels */}
      {activePanel === 'shows' && stats && (
        <div className="home-panel card">
          <div className="home-panel-grid">
            <div className="home-panel-item"><span className="home-panel-label">Completed</span><span className="mono home-panel-val">{stats.completed}</span></div>
            <div className="home-panel-item"><span className="home-panel-label">Dropped</span><span className="mono home-panel-val">{stats.dropped}</span></div>
            <div className="home-panel-item"><span className="home-panel-label">No Source</span><span className="mono home-panel-val">{stats.noSource}</span></div>
            <div className="home-panel-item"><span className="home-panel-label">This Year</span><span className="mono home-panel-val">{stats.watchedThisYear}</span></div>
          </div>
        </div>
      )}

      {activePanel === 'episodes' && stats && (
        <div className="home-panel card">
          <div className="home-panel-grid">
            <div className="home-panel-item"><span className="home-panel-label">Total Episodes</span><span className="mono home-panel-val">{stats.totalEpisodes.toLocaleString()}</span></div>
            <div className="home-panel-item"><span className="home-panel-label">Avg per Show</span><span className="mono home-panel-val">{stats.completed ? Math.round(stats.totalEpisodes/stats.completed) : '—'}</span></div>
            <div className="home-panel-item"><span className="home-panel-label">Avg Rating</span><span className="mono home-panel-val">{stats.avgRating||'—'}/10</span></div>
          </div>
        </div>
      )}

      {activePanel === 'genres' && (
        <div className="home-panel card">
          <div className="home-genre-bars">
            {genreData.map(([genre, count]) => (
              <div key={genre} className="home-genre-row">
                <span className="home-genre-name">{genre}</span>
                <div className="home-genre-track">
                  <div className="home-genre-fill" style={{width:`${(count/maxGenre)*100}%`}}/>
                </div>
                <span className="mono home-genre-count">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {activePanel === 'languages' && (
        <div className="home-panel card">
          <div className="home-pill-list">
            {langData.map(([lang, shows]) => (
              <button key={lang} className="home-drill-pill" onClick={() => setDrillPanel({
                title: `${getLanguageName(lang)} Shows`,
                shows: shows.filter(s=>s.watch_status)
              })}>
                <span>{getLanguageName(lang)}</span>
                <span className="mono home-pill-count">{shows.length}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {activePanel === 'countries' && (
        <div className="home-panel card">
          <div className="home-pill-list">
            {countryData.map(([code, shows]) => (
              <button key={code} className="home-drill-pill" onClick={() => setDrillPanel({
                title: `${COUNTRY_NAMES[code]||code} Shows`,
                shows: shows.filter(s=>s.watch_status)
              })}>
                <span>{COUNTRY_NAMES[code]||code}</span>
                <span className="mono home-pill-count">{shows.length}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Three lists */}
      <div className="home-lists">
        <ShowList title="Recently Watched" shows={recent} onShowClick={setSelectedShow}/>
        <ShowList title="Top Rated" shows={topRated} onShowClick={setSelectedShow}/>
        <ShowList title="Underrated Gems" shows={underrated} onShowClick={setSelectedShow} emptyMsg="Shows you rated 8+ that TMDB has at 7 or below."/>
      </div>

      {/* Drill down panel */}
      {drillPanel && (
        <DrillPanel
          title={drillPanel.title}
          shows={drillPanel.shows}
          onClose={() => setDrillPanel(null)}
          onShowClick={(show) => { setDrillPanel(null); setSelectedShow(show) }}
        />
      )}

      {selectedShow && (
        <ShowDetailSidebar show={selectedShow} onClose={()=>setSelectedShow(null)} onEdit={handleEdit}/>
      )}
      {showPasswordModal && (
        <PasswordModal onClose={()=>setShowPasswordModal(false)} onSuccess={()=>{setShowPasswordModal(false);setShowLogModal(true)}}/>
      )}
      {(showLogModal||editShow) && (
        <LogShowModal
          editShow={editShow}
          onClose={()=>{setShowLogModal(false);setEditShow(null)}}
          onSuccess={()=>{load();setShowLogModal(false);setEditShow(null)}}
          onEdit={(show)=>{setShowLogModal(false);setEditShow(show)}}
        />
      )}
    </div>
  )
}

function ShowList({ title, shows, onShowClick, emptyMsg }) {
  return (
    <div className="home-list card">
      <div className="home-list-header">
        <h3>{title}</h3>
      </div>
      <div className="home-list-body">
        {shows.length === 0 ? (
          <p className="home-list-empty">{emptyMsg || 'Nothing here yet.'}</p>
        ) : (
          shows.map((show, i) => (
            <ShowRow key={show.id} show={show} rank={i+1} onClick={()=>onShowClick(show)}/>
          ))
        )}
      </div>
    </div>
  )
}
