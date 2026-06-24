import { useState, useEffect } from 'react'
import { Plus, ChevronDown, ChevronUp, X, Network } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import PasswordModal from '../components/ui/PasswordModal'
import { showsApi, statsApi } from '../lib/db'
import ShowDetailSidebar from '../components/shows/ShowDetailSidebar'
import LogShowModal from '../components/shows/LogShowModal'
import { tmdb, getLanguageName } from '../lib/tmdb'
import { ComposableMap, Geographies, Geography } from 'react-simple-maps'
import ForceGraph2D from 'react-force-graph-2d'
import { similarityApi } from '../lib/db'
import './Home.css'

const GEO_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json'

const ISO2_TO_NUMERIC = {
  US:'840',GB:'826',KR:'410',JP:'392',FR:'250',DE:'276',IT:'380',
  ES:'724',AU:'036',CA:'124',IN:'356',BR:'076',MX:'484',DK:'208',
  SE:'752',NO:'578',NL:'528',BE:'056',IL:'376',TR:'792',AR:'032',
  CO:'170',PT:'620',PL:'616',RU:'643',CN:'156',TH:'764',ZA:'710',
  NZ:'554',IE:'372',AT:'040',FI:'246',CZ:'203',HU:'348',RO:'642',
  GR:'300',RS:'688',IS:'352',CY:'196',LU:'442',SK:'703',SI:'705',
  HR:'191',BG:'100',UA:'804',LT:'440',LV:'428',EE:'233',CH:'756',
}

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
  EE:'Estonia',CH:'Switzerland',SG:'Singapore',HK:'Hong Kong',
  TW:'Taiwan',PK:'Pakistan',NG:'Nigeria',EG:'Egypt',MA:'Morocco',
  SA:'Saudi Arabia',AE:'UAE',LB:'Lebanon',IR:'Iran',CL:'Chile',
  PE:'Peru',VE:'Venezuela',VN:'Vietnam',PH:'Philippines',ID:'Indonesia',
  MY:'Malaysia',
}

const GENRE_COLORS = {
  'Crime':'#E05C5C','Thriller':'#E07B3A','Drama':'#5C8EE6',
  'Comedy':'#F2C94C','Sci-Fi & Fantasy':'#9B59B6','Action & Adventure':'#E74C3C',
  'Mystery':'#8E44AD','Documentary':'#27AE60','Animation':'#F39C12',
  'Horror':'#6C1C1C','Romance':'#E91E8C','History':'#795548',
  'War & Politics':'#607D8B','Family':'#26C6DA','Western':'#A0522D',
  'default':'#5C8EE6',
}

function getMapColor(count, maxCount) {
  if (count === 0) return '#1E2028'
  const t = Math.min(1, Math.log(count + 1) / Math.log(maxCount + 1))
  if (t < 0.12) return '#0C4A6E'
  if (t < 0.25) return '#0369A1'
  if (t < 0.4)  return '#38BDF8'
  if (t < 0.55) return '#818CF8'
  if (t < 0.7)  return '#C084FC'
  if (t < 0.85) return '#F472B6'
  return '#F87171'
}

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

// Mini force graph preview
function MiniGraph({ graphData }) {
  return (
    <ForceGraph2D
      graphData={graphData}
      nodeColor={node => {
        const genre = node.genres?.[0]?.name
        return GENRE_COLORS[genre] || GENRE_COLORS.default
      }}
      nodeRelSize={4}
      nodeVal={node => node.val || 1}
      linkColor={() => 'rgba(92,142,230,0.2)'}
      linkWidth={0.8}
      backgroundColor="#111318"
      enableNodeDrag={false}
      enableZoomInteraction={false}
      enablePanInteraction={false}
      nodeCanvasObject={(node, ctx, globalScale) => {
        const r = Math.sqrt(node.val || 1) * 4
        ctx.beginPath()
        ctx.arc(node.x, node.y, r, 0, 2 * Math.PI)
        const genre = node.genres?.[0]?.name
        ctx.fillStyle = GENRE_COLORS[genre] || GENRE_COLORS.default
        ctx.fill()
      }}
      cooldownTicks={80}
      width={undefined}
      height={undefined}
    />
  )
}

export default function Home() {
  const [allShows, setAllShows] = useState([])
  const [stats, setStats] = useState(null)
  const [graphData, setGraphData] = useState({ nodes: [], links: [] })
  const [loading, setLoading] = useState(true)
  const [activePanel, setActivePanel] = useState(null)
  const [drillPanel, setDrillPanel] = useState(null)
  const [selectedShow, setSelectedShow] = useState(null)
  const [showLogModal, setShowLogModal] = useState(false)
  const [editShow, setEditShow] = useState(null)
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const { isAuthenticated } = useAuth()
  const navigate = useNavigate()

  const load = async () => {
    setLoading(true)
    try {
      const [shows, s, links] = await Promise.all([
        showsApi.getAllWithLogs(),
        statsApi.getSummary(),
        similarityApi.getAllLinks(),
      ])
      setAllShows(shows)
      setStats(s)

      // Build mini graph
      const validIds = new Set(shows.map(s => s.id))
      const connectionCount = {}
      links.forEach(l => {
        connectionCount[l.show_a_id] = (connectionCount[l.show_a_id]||0)+1
        connectionCount[l.show_b_id] = (connectionCount[l.show_b_id]||0)+1
      })
      setGraphData({
        nodes: shows.map(s => ({
          id: s.id, label: s.title,
          genres: s.genres || [],
          val: 1 + (connectionCount[s.id]||0)*0.5,
        })),
        links: links
          .filter(l => validIds.has(l.show_a_id) && validIds.has(l.show_b_id))
          .map(l => ({ source: l.show_a_id, target: l.show_b_id }))
      })
    } catch(e) { console.error(e) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const handleEdit = (show) => { setSelectedShow(null); setEditShow(show) }
  const togglePanel = (key) => setActivePanel(prev => prev === key ? null : key)

  const completed = allShows.filter(s => s.watch_status === 'completed')
  const topRated = [...completed].filter(s => s.rating).sort((a,b) => b.rating - a.rating || (b.tmdb_rating||0)-(a.tmdb_rating||0)).slice(0,20)
  const underrated = [...completed].filter(s => s.rating && s.tmdb_rating && s.rating >= 8 && s.tmdb_rating <= 7.0)
    .sort((a,b) => (b.rating-(b.tmdb_rating||0))-(a.rating-(a.tmdb_rating||0))).slice(0,20)

  const genreMap = {}
  completed.forEach(s => (s.genres||[]).forEach(g => { genreMap[g.name]=(genreMap[g.name]||0)+1 }))
  const genreData = Object.entries(genreMap).sort((a,b)=>b[1]-a[1])
  const maxGenre = genreData[0]?.[1]||1

  const langMap = {}
  allShows.forEach(s => { if(s.original_language){ if(!langMap[s.original_language]) langMap[s.original_language]=[]; langMap[s.original_language].push(s) }})
  const langData = Object.entries(langMap).sort((a,b)=>b[1].length-a[1].length)

  const countryMap = {}
  allShows.forEach(s => (s.origin_country||[]).forEach(c => { if(!countryMap[c]) countryMap[c]=[]; countryMap[c].push(s) }))
  const countryData = Object.entries(countryMap).sort((a,b)=>b[1].length-a[1].length)
  const maxCountry = countryData[0]?.[1]?.length||1

  if (loading) return (
    <div style={{display:'flex',justifyContent:'center',paddingTop:'4rem'}}>
      <div className="loading-spinner" style={{width:32,height:32}}/>
    </div>
  )

  return (
    <div className="home-page">
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

      {/* Panels */}
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
                <div className="home-genre-track"><div className="home-genre-fill" style={{width:`${(count/maxGenre)*100}%`}}/></div>
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
              <button key={lang} className="home-drill-pill" onClick={() => setDrillPanel({ title:`${getLanguageName(lang)} Shows`, shows:shows.filter(s=>s.watch_status) })}>
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
              <button key={code} className="home-drill-pill" onClick={() => setDrillPanel({ title:`${COUNTRY_NAMES[code]||code} Shows`, shows:shows.filter(s=>s.watch_status) })}>
                <span>{COUNTRY_NAMES[code]||code}</span>
                <span className="mono home-pill-count">{shows.length}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Map + Graph side by side */}
      <div className="home-visual-row">
        {/* World Map */}
        <div className="home-map-section card">
          <div className="home-map-header">
            <h3>Countries Watched</h3>
            <span className="mono" style={{color:'var(--text-muted)',fontSize:'0.8125rem'}}>{countryData.length} countries</span>
          </div>
          <div className="home-map-canvas">
            <ComposableMap
              projection="geoMercator"
              projectionConfig={{ scale: 110, center: [10, 10] }}
              style={{ width:'100%', height:'320px', background:'#111318' }}
            >
              <Geographies geography={GEO_URL}>
                {({ geographies }) =>
                  geographies.map(geo => {
                    const alpha2 = Object.entries(ISO2_TO_NUMERIC).find(([,n]) => n === String(geo.id))?.[0]
                    const count = alpha2 ? (countryMap[alpha2]?.length||0) : 0
                    const fill = getMapColor(count, maxCountry)
                    return (
                      <Geography
                        key={geo.rsmKey}
                        geography={geo}
                        fill={fill}
                        stroke="#111318"
                        strokeWidth={0.4}
                        onClick={() => alpha2 && count > 0 && setDrillPanel({
                          title:`${COUNTRY_NAMES[alpha2]||alpha2} Shows`,
                          shows:countryMap[alpha2].filter(s=>s.watch_status)
                        })}
                        style={{
                          default:{ outline:'none' },
                          hover:{ fill: count>0 ? '#FBBF24' : '#252830', outline:'none', cursor: count>0 ? 'pointer':'default' },
                          pressed:{ outline:'none' },
                        }}
                      />
                    )
                  })
                }
              </Geographies>
            </ComposableMap>
          </div>
          <div className="home-map-legend">
            <span className="home-map-legend-label">Fewer</span>
            <div className="home-map-legend-scale">
              {['#0C4A6E','#0369A1','#38BDF8','#818CF8','#C084FC','#F472B6','#F87171'].map(c=>(
                <div key={c} style={{background:c}}/>
              ))}
            </div>
            <span className="home-map-legend-label">More</span>
          </div>
        </div>

        {/* Mini show graph */}
        <div className="home-graph-section card" onClick={() => navigate('/map')} style={{cursor:'pointer'}}>
          <div className="home-map-header">
            <h3>Show Map</h3>
            <span style={{fontSize:'0.8125rem',color:'var(--blue-highlight)'}}>View full map →</span>
          </div>
          <div className="home-graph-canvas">
            {graphData.nodes.length > 0
              ? <MiniGraph graphData={graphData}/>
              : <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'320px',color:'var(--text-muted)'}}>Log shows and add similarity links to build your map.</div>
            }
          </div>
        </div>
      </div>

      {/* Two lists */}
      <div className="home-lists">
        <ShowList title="Top Rated" shows={topRated} onShowClick={setSelectedShow}/>
        <ShowList title="Underrated Gems" shows={underrated} onShowClick={setSelectedShow} emptyMsg="Shows you rated 8+ that TMDB has at 7 or below."/>
      </div>

      {drillPanel && (
        <DrillPanel title={drillPanel.title} shows={drillPanel.shows} onClose={()=>setDrillPanel(null)} onShowClick={(show)=>{ setDrillPanel(null); setSelectedShow(show) }}/>
      )}
      {selectedShow && <ShowDetailSidebar show={selectedShow} onClose={()=>setSelectedShow(null)} onEdit={handleEdit}/>}
      {showPasswordModal && <PasswordModal onClose={()=>setShowPasswordModal(false)} onSuccess={()=>{setShowPasswordModal(false);setShowLogModal(true)}}/>}
      {(showLogModal||editShow) && (
        <LogShowModal editShow={editShow} onClose={()=>{setShowLogModal(false);setEditShow(null)}} onSuccess={()=>{load();setShowLogModal(false);setEditShow(null)}} onEdit={(show)=>{setShowLogModal(false);setEditShow(show)}}/>
      )}
    </div>
  )
}

function ShowList({ title, shows, onShowClick, emptyMsg }) {
  return (
    <div className="home-list card">
      <div className="home-list-header"><h3>{title}</h3></div>
      <div className="home-list-body">
        {shows.length === 0
          ? <p className="home-list-empty">{emptyMsg||'Nothing here yet.'}</p>
          : shows.map((show,i) => <ShowRow key={show.id} show={show} rank={i+1} onClick={()=>onShowClick(show)}/>)
        }
      </div>
    </div>
  )
}
