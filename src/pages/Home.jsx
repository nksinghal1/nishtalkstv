import { useState, useEffect } from 'react'
import { Plus, ChevronDown, ChevronUp, X, Star, TrendingUp } from 'lucide-react'
import { useAuth } from '../lib/auth'
import PasswordModal from '../components/ui/PasswordModal'
import { showsApi, statsApi } from '../lib/db'
import ShowDetailSidebar from '../components/shows/ShowDetailSidebar'
import LogShowModal from '../components/shows/LogShowModal'
import { tmdb, getLanguageName } from '../lib/tmdb'
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
  CZ:'Czech Republic',LU:'Luxembourg',SK:'Slovakia',SI:'Slovenia',
  HR:'Croatia',BG:'Bulgaria',UA:'Ukraine',LT:'Lithuania',LV:'Latvia',
  EE:'Estonia',CH:'Switzerland',SG:'Singapore',PK:'Pakistan',
  NG:'Nigeria',EG:'Egypt',MA:'Morocco',SA:'Saudi Arabia',AE:'UAE',
  LB:'Lebanon',IR:'Iran',CL:'Chile',PE:'Peru',VN:'Vietnam',
  PH:'Philippines',ID:'Indonesia',MY:'Malaysia',
}

const STAT_ACCENT_COLORS = [
  { bg: 'rgba(92,142,230,0.12)', border: 'rgba(92,142,230,0.3)', val: '#5C8EE6' },
  { bg: 'rgba(167,139,250,0.12)', border: 'rgba(167,139,250,0.3)', val: '#A78BFA' },
  { bg: 'rgba(52,211,153,0.12)', border: 'rgba(52,211,153,0.3)', val: '#34D399' },
  { bg: 'rgba(251,191,36,0.12)', border: 'rgba(251,191,36,0.3)', val: '#FBBF24' },
  { bg: 'rgba(244,114,182,0.12)', border: 'rgba(244,114,182,0.3)', val: '#F472B6' },
]

function StatCard({ label, value, sub, active, onClick, colorIdx }) {
  const c = STAT_ACCENT_COLORS[colorIdx % STAT_ACCENT_COLORS.length]
  return (
    <button
      className={`home-stat-card ${active ? 'active' : ''}`}
      onClick={onClick}
      style={{ '--stat-val': c.val }}
    >
      <span className="home-stat-value mono">{value}</span>
      <span className="home-stat-label">{label}</span>
      {sub && <span className="home-stat-sub">{sub}</span>}
      <span className="home-stat-chevron">{active ? <ChevronUp size={12}/> : <ChevronDown size={12}/>}</span>
    </button>
  )
}

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
        {show.tmdb_rating && <span className="home-tmdb-rating mono">{show.tmdb_rating} TMDB</span>}
      </div>
    </div>
  )
}

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
            : shows.map((show, i) => <ShowRow key={show.id} show={show} rank={i+1} onClick={()=>onShowClick(show)}/>)
          }
        </div>
      </div>
    </>
  )
}

function ShowList({ title, icon, shows, onShowClick, emptyMsg, accentColor }) {
  return (
    <div className="home-list card">
      <div className="home-list-header" style={{'--list-accent': accentColor}}>
        <div className="home-list-title">
          {icon}
          <h3>{title}</h3>
        </div>
        <span className="mono home-list-count">{shows.length}</span>
      </div>
      <div className="home-list-body">
        {shows.length === 0
          ? <p className="home-list-empty">{emptyMsg||'Nothing here yet.'}</p>
          : shows.map((show,i) => <ShowRow key={show.id} show={show} rank={i+1} onClick={()=>onShowClick(show)}/>)
        }
      </div>
    </div>
  )
}

export default function Home() {
  const [allShows, setAllShows] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activePanel, setActivePanel] = useState(null)
  const [drillPanel, setDrillPanel] = useState(null)
  const [selectedShow, setSelectedShow] = useState(null)
  const [showLogModal, setShowLogModal] = useState(false)
  const [editShow, setEditShow] = useState(null)
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const { isAuthenticated } = useAuth()

  const load = async () => {
    setLoading(true)
    try {
      const [shows, s] = await Promise.all([showsApi.getAllWithLogs(), statsApi.getSummary()])
      setAllShows(shows)
      setStats(s)
    } catch(e) { console.error(e) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const handleEdit = (show) => { setSelectedShow(null); setEditShow(show) }
  const togglePanel = (key) => setActivePanel(prev => prev === key ? null : key)

  const completed = allShows.filter(s => s.watch_status === 'completed')
  const topRated = [...completed].filter(s=>s.rating).sort((a,b)=>b.rating-a.rating||(b.tmdb_rating||0)-(a.tmdb_rating||0)).slice(0,25)
  const underrated = [...completed].filter(s=>s.rating&&s.tmdb_rating&&s.rating>=8&&s.tmdb_rating<=7.0)
    .sort((a,b)=>(b.rating-(b.tmdb_rating||0))-(a.rating-(a.tmdb_rating||0))).slice(0,25)

  const genreMap = {}
  completed.forEach(s=>(s.genres||[]).forEach(g=>{genreMap[g.name]=(genreMap[g.name]||0)+1}))
  const genreData = Object.entries(genreMap).sort((a,b)=>b[1]-a[1])
  const maxGenre = genreData[0]?.[1]||1

  const langMap = {}
  allShows.forEach(s=>{if(s.original_language){if(!langMap[s.original_language])langMap[s.original_language]=[];langMap[s.original_language].push(s)}})
  const langData = Object.entries(langMap).sort((a,b)=>b[1].length-a[1].length)

  const countryMap = {}
  allShows.forEach(s=>(s.origin_country||[]).forEach(c=>{if(!countryMap[c])countryMap[c]=[];countryMap[c].push(s)}))
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
          <h1 className="home-title">Good Shows. <span className="home-title-accent">Great Stories.</span></h1>
          <p className="home-subtitle">Your personal TV archive.</p>
        </div>
        <button className="btn btn-primary" onClick={()=>isAuthenticated?setShowLogModal(true):setShowPasswordModal(true)}>
          <Plus size={16}/> Log a Show
        </button>
      </div>

      {/* Stat cards */}
      {stats && (
        <div className="home-stats-row">
          {[
            { key:'shows', label:'Shows Logged', value:stats.total, sub:`${stats.completed} completed · ${stats.dropped} dropped` },
            { key:'episodes', label:'Episodes Watched', value:stats.totalEpisodes.toLocaleString(), sub:`avg rating ${stats.avgRating||'—'}/10` },
            { key:'genres', label:'Genres', value:genreData.length, sub:`across ${stats.completed} shows` },
            { key:'languages', label:'Languages', value:langData.length, sub:`click to explore` },
            { key:'countries', label:'Countries', value:countryData.length, sub:`click to explore` },
          ].map(({ key, label, value, sub }, i) => (
            <StatCard key={key} label={label} value={value} sub={sub} colorIdx={i} active={activePanel===key} onClick={()=>togglePanel(key)}/>
          ))}
        </div>
      )}

      {/* Accordion panels */}
      {activePanel === 'shows' && stats && (
        <div className="home-panel card">
          <div className="home-panel-grid">
            {[['Completed',stats.completed],['Dropped',stats.dropped],['No Source',stats.noSource],['This Year',stats.watchedThisYear]].map(([l,v])=>(
              <div key={l} className="home-panel-item">
                <span className="home-panel-label">{l}</span>
                <span className="mono home-panel-val">{v}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {activePanel === 'episodes' && stats && (
        <div className="home-panel card">
          <div className="home-panel-grid">
            {[
              ['Total Episodes', stats.totalEpisodes.toLocaleString()],
              ['Avg per Show', stats.completed ? Math.round(stats.totalEpisodes/stats.completed) : '—'],
              ['Avg Rating', `${stats.avgRating||'—'}/10`],
            ].map(([l,v])=>(
              <div key={l} className="home-panel-item">
                <span className="home-panel-label">{l}</span>
                <span className="mono home-panel-val">{v}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {activePanel === 'genres' && (
        <div className="home-panel card">
          <div className="home-genre-bars">
            {genreData.map(([genre, count], i) => (
              <div key={genre} className="home-genre-row">
                <span className="home-genre-name">{genre}</span>
                <div className="home-genre-track">
                  <div className="home-genre-fill" style={{width:`${(count/maxGenre)*100}%`, background: `hsl(${220 + i*12}, 70%, 60%)`}}/>
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
              <button key={lang} className="home-drill-pill" onClick={()=>setDrillPanel({title:`${getLanguageName(lang)} Shows`,shows:shows.filter(s=>s.watch_status)})}>
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
              <button key={code} className="home-drill-pill" onClick={()=>setDrillPanel({title:`${COUNTRY_NAMES[code]||code} Shows`,shows:shows.filter(s=>s.watch_status)})}>
                <span>{COUNTRY_NAMES[code]||code}</span>
                <span className="mono home-pill-count">{shows.length}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Two lists */}
      <div className="home-lists">
        <ShowList
          title="Top Rated"
          icon={<Star size={14} style={{color:'#FBBF24'}}/>}
          shows={topRated}
          onShowClick={setSelectedShow}
          accentColor="#FBBF24"
        />
        <ShowList
          title="Underrated Gems"
          icon={<TrendingUp size={14} style={{color:'#34D399'}}/>}
          shows={underrated}
          onShowClick={setSelectedShow}
          emptyMsg="Shows you rated 8+ that TMDB has at 7 or below."
          accentColor="#34D399"
        />
      </div>

      {drillPanel && <DrillPanel title={drillPanel.title} shows={drillPanel.shows} onClose={()=>setDrillPanel(null)} onShowClick={(show)=>{setDrillPanel(null);setSelectedShow(show)}}/>}
      {selectedShow && <ShowDetailSidebar show={selectedShow} onClose={()=>setSelectedShow(null)} onEdit={handleEdit}/>}
      {showPasswordModal && <PasswordModal onClose={()=>setShowPasswordModal(false)} onSuccess={()=>{setShowPasswordModal(false);setShowLogModal(true)}}/>}
      {(showLogModal||editShow) && (
        <LogShowModal editShow={editShow} onClose={()=>{setShowLogModal(false);setEditShow(null)}} onSuccess={()=>{load();setShowLogModal(false);setEditShow(null)}} onEdit={(show)=>{setShowLogModal(false);setEditShow(show)}}/>
      )}
    </div>
  )
}
