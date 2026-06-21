import { useState, useEffect } from 'react'
import { statsApi, showsApi } from '../lib/db'
import { getLanguageName, GENRE_ICONS, tmdb, RATING_LABELS } from '../lib/tmdb'
import { ComposableMap, Geographies, Geography, ZoomableGroup } from 'react-simple-maps'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import ShowDetailSidebar from '../components/shows/ShowDetailSidebar'
import LogShowModal from '../components/shows/LogShowModal'
import './Stats.css'

const GEO_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json'

const COUNTRY_NAMES = {
  US: 'United States', GB: 'United Kingdom', KR: 'South Korea', JP: 'Japan',
  FR: 'France', DE: 'Germany', IT: 'Italy', ES: 'Spain', AU: 'Australia',
  CA: 'Canada', IN: 'India', BR: 'Brazil', MX: 'Mexico', DK: 'Denmark',
  SE: 'Sweden', NO: 'Norway', NL: 'Netherlands', BE: 'Belgium', IL: 'Israel',
  TR: 'Turkey', AR: 'Argentina', CO: 'Colombia', PT: 'Portugal', PL: 'Poland',
  RU: 'Russia', CN: 'China', TH: 'Thailand', ZA: 'South Africa', NZ: 'New Zealand',
  IE: 'Ireland', AT: 'Austria', FI: 'Finland', CZ: 'Czech Republic', HU: 'Hungary',
}

// ISO alpha-2 to numeric for world-atlas matching
const ISO2_TO_NUMERIC = {
  US: '840', GB: '826', KR: '410', JP: '392', FR: '250', DE: '276', IT: '380',
  ES: '724', AU: '036', CA: '124', IN: '356', BR: '076', MX: '484', DK: '208',
  SE: '752', NO: '578', NL: '528', BE: '056', IL: '376', TR: '792', AR: '032',
  CO: '170', PT: '620', PL: '616', RU: '643', CN: '156', TH: '764', ZA: '710',
  NZ: '554', IE: '372', AT: '040', FI: '246', CZ: '203', HU: '348',
}

const STAT_CARDS = [
  { key: 'shows', label: 'Shows Logged' },
  { key: 'episodes', label: 'Episodes Watched' },
  { key: 'countries', label: 'Countries' },
  { key: 'languages', label: 'Languages' },
  { key: 'genres', label: 'Genres' },
]

export default function Stats() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activePanel, setActivePanel] = useState(null)
  const [showsTab, setShowsTab] = useState('recent') // 'recent' | 'rated'
  const [allShows, setAllShows] = useState([])
  const [selectedShow, setSelectedShow] = useState(null)
  const [editShow, setEditShow] = useState(null)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const [s, shows] = await Promise.all([
          statsApi.getSummary(),
          showsApi.getAllWithLogs(),
        ])
        setStats(s)
        setAllShows(shows)
      } catch (e) { console.error(e) }
      finally { setLoading(false) }
    }
    load()
  }, [])

  const togglePanel = (key) => {
    setActivePanel(prev => prev === key ? null : key)
  }

  const handleEdit = (show) => {
    setSelectedShow(null)
    setEditShow(show)
  }

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '4rem' }}>
      <div className="loading-spinner" style={{ width: 32, height: 32 }} />
    </div>
  )

  if (!stats) return null

  const recentShows = [...allShows]
    .filter(s => s.watch_status === 'completed' || s.watch_status === 'dropped')
    .sort((a, b) => new Date(b.date_watched) - new Date(a.date_watched))

  const topRatedShows = [...allShows]
    .filter(s => s.rating)
    .sort((a, b) => b.rating - a.rating)

  const genreData = Object.entries(
    allShows.reduce((acc, s) => {
      (s.genres || []).forEach(g => { acc[g.name] = (acc[g.name] || 0) + 1 })
      return acc
    }, {})
  ).sort((a, b) => b[1] - a[1])

  const languageData = Object.entries(stats.langCounts)
    .sort((a, b) => b[1] - a[1])

  const countryData = Object.entries(stats.countryCounts)
    .sort((a, b) => b[1] - a[1])

  const maxCountry = countryData[0]?.[1] || 1

  const heroStats = [
    { key: 'shows', value: stats.total, sub: `${stats.completed} completed · ${stats.dropped} dropped` },
    { key: 'episodes', value: stats.totalEpisodes.toLocaleString(), sub: `avg rating ${stats.avgRating || '—'}/10` },
    { key: 'countries', value: Object.keys(stats.countryCounts).length, sub: 'countries of origin' },
    { key: 'languages', value: Object.keys(stats.langCounts).length, sub: 'languages' },
    { key: 'genres', value: genreData.length, sub: 'genres watched' },
  ]

  return (
    <div className="stats-page">
      <div className="page-header">
        <h1>Stats</h1>
        {stats.watchedThisYear > 0 && (
          <span className="stats-this-year mono">{stats.watchedThisYear} logged this year</span>
        )}
      </div>

      {/* Hero stat cards */}
      <div className="stats-hero-grid">
        {heroStats.map(({ key, value, sub }) => (
          <button
            key={key}
            className={`stats-hero-card card ${activePanel === key ? 'active' : ''}`}
            onClick={() => togglePanel(key)}
          >
            <span className="stats-hero-value mono">{value}</span>
            <span className="stats-hero-label">{STAT_CARDS.find(s => s.key === key)?.label}</span>
            <span className="stats-hero-sub">{sub}</span>
            <span className="stats-hero-chevron">{activePanel === key ? '▲' : '▼'}</span>
          </button>
        ))}
      </div>

      {/* Accordion panels */}
      {activePanel === 'shows' && (
        <div className="stats-panel card">
          <div className="stats-panel-tabs">
            <button
              className={`stats-tab ${showsTab === 'recent' ? 'active' : ''}`}
              onClick={() => setShowsTab('recent')}
            >Recently Watched</button>
            <button
              className={`stats-tab ${showsTab === 'rated' ? 'active' : ''}`}
              onClick={() => setShowsTab('rated')}
            >Top Rated</button>
          </div>
          <div className="stats-shows-list">
            {(showsTab === 'recent' ? recentShows : topRatedShows).map((show, i) => {
              const poster = tmdb.posterUrl(show.poster_path, 'w92')
              const year = show.first_air_date?.slice(0, 4)
              return (
                <div
                  key={show.id}
                  className="stats-show-row"
                  onClick={() => setSelectedShow(show)}
                >
                  <span className="stats-show-rank mono">#{i + 1}</span>
                  <div className="stats-show-poster">
                    {poster ? <img src={poster} alt={show.title} /> : <span>📺</span>}
                  </div>
                  <div className="stats-show-info">
                    <span className="stats-show-title">{show.title}</span>
                    <span className="stats-show-meta mono">
                      {year}{show.original_language && ` · ${show.original_language.toUpperCase()}`}
                    </span>
                  </div>
                  {show.rating && (
                    <div className="stats-show-rating">
                      <span className="mono">{show.rating}/10</span>
                      <span className="stats-show-rating-label">{RATING_LABELS[show.rating]}</span>
                    </div>
                  )}
                  <span className={`badge ${
                    show.watch_status === 'completed' ? 'badge-green' :
                    show.watch_status === 'dropped' ? 'badge-red' : 'badge-muted'
                  }`}>
                    {show.watch_status === 'completed' ? 'Completed' :
                     show.watch_status === 'dropped' ? 'Dropped' : 'No Source'}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {activePanel === 'episodes' && (
        <div className="stats-panel card">
          <div className="stats-panel-inner">
            <div className="stats-big-number">
              <span className="mono">{stats.totalEpisodes.toLocaleString()}</span>
              <span>total episodes watched</span>
            </div>
            <div className="stats-episode-breakdown">
              <StatRow label="Completed shows" value={stats.completed} />
              <StatRow label="Avg episodes per show" value={stats.completed ? Math.round(stats.totalEpisodes / stats.completed) : '—'} />
              <StatRow label="Average rating" value={stats.avgRating ? `${stats.avgRating}/10` : '—'} />
              <StatRow label="Logged this year" value={stats.watchedThisYear} />
            </div>
          </div>
        </div>
      )}

      {activePanel === 'genres' && (
        <div className="stats-panel card">
          <div className="stats-panel-header">
            <h3>All Genres</h3>
            <span className="mono stats-panel-count">{genreData.length} genres</span>
          </div>
          <div style={{ width: '100%', overflowX: 'auto' }}>
            <ResponsiveContainer width="100%" height={Math.max(300, genreData.length * 36)}>
              <BarChart
                data={genreData.map(([name, count]) => ({ name: `${GENRE_ICONS[name] || '🎬'} ${name}`, count }))}
                layout="vertical"
                margin={{ top: 0, right: 40, left: 10, bottom: 0 }}
              >
                <XAxis type="number" tick={{ fill: '#9AA0A6', fontSize: 12, fontFamily: 'JetBrains Mono' }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" width={200} tick={{ fill: '#F2F2F2', fontSize: 13, fontFamily: 'Inter' }} axisLine={false} tickLine={false} />
                <Tooltip
                  cursor={{ fill: 'rgba(92,142,230,0.08)' }}
                  contentStyle={{ background: '#141414', border: '1px solid #262626', borderRadius: 8, fontFamily: 'Inter' }}
                  labelStyle={{ color: '#F2F2F2' }}
                  itemStyle={{ color: '#5C8EE6' }}
                />
                <Bar dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={24}>
                  {genreData.map((_, i) => (
                    <Cell key={i} fill={i === 0 ? '#5C8EE6' : i < 3 ? '#355C93' : '#243B63'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {activePanel === 'languages' && (
        <div className="stats-panel card">
          <div className="stats-panel-header">
            <h3>All Languages</h3>
            <span className="mono stats-panel-count">{languageData.length} languages</span>
          </div>
          <div className="stats-list-full">
            {languageData.map(([lang, count], i) => (
              <div key={lang} className="stats-list-row">
                <span className="stats-list-rank mono">#{i + 1}</span>
                <span className="stats-list-label">{getLanguageName(lang)}</span>
                <div className="stats-list-bar-track">
                  <div
                    className="stats-list-bar-fill"
                    style={{ width: `${(count / languageData[0][1]) * 100}%` }}
                  />
                </div>
                <span className="mono stats-list-count">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {activePanel === 'countries' && (
        <div className="stats-panel card">
          <div className="stats-panel-header">
            <h3>Countries of Origin</h3>
            <span className="mono stats-panel-count">{countryData.length} countries</span>
          </div>
          <div className="stats-map-wrap">
            <ComposableMap
              projection="geoMercator"
              projectionConfig={{ scale: 130, center: [0, 20] }}
              style={{ width: '100%', height: '420px' }}
            >
              <ZoomableGroup>
                <Geographies geography={GEO_URL}>
                  {({ geographies }) =>
                    geographies.map(geo => {
                      const numericId = geo.id
                      const alpha2 = Object.entries(ISO2_TO_NUMERIC).find(([, n]) => n === String(numericId))?.[0]
                      const count = alpha2 ? (stats.countryCounts[alpha2] || 0) : 0
                      const intensity = count > 0 ? Math.max(0.2, Math.min(1, count / maxCountry)) : 0
                      const fill = count > 0
                        ? `rgba(92, 142, 230, ${intensity})`
                        : '#1C1C1C'
                      return (
                        <Geography
                          key={geo.rsmKey}
                          geography={geo}
                          fill={fill}
                          stroke="#0B0B0B"
                          strokeWidth={0.5}
                          style={{
                            default: { outline: 'none' },
                            hover: { fill: count > 0 ? '#5C8EE6' : '#262626', outline: 'none', cursor: count > 0 ? 'pointer' : 'default' },
                            pressed: { outline: 'none' },
                          }}
                        />
                      )
                    })
                  }
                </Geographies>
              </ZoomableGroup>
            </ComposableMap>
          </div>
          {/* Country list below map */}
          <div className="stats-list-full" style={{ marginTop: '1rem' }}>
            {countryData.map(([code, count], i) => (
              <div key={code} className="stats-list-row">
                <span className="stats-list-rank mono">#{i + 1}</span>
                <span className="stats-list-label">{COUNTRY_NAMES[code] || code}</span>
                <div className="stats-list-bar-track">
                  <div
                    className="stats-list-bar-fill"
                    style={{ width: `${(count / countryData[0][1]) * 100}%` }}
                  />
                </div>
                <span className="mono stats-list-count">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {selectedShow && (
        <ShowDetailSidebar
          show={selectedShow}
          onClose={() => setSelectedShow(null)}
          onEdit={handleEdit}
        />
      )}

      {editShow && (
        <LogShowModal
          editShow={editShow}
          onClose={() => setEditShow(null)}
          onSuccess={() => setEditShow(null)}
        />
      )}
    </div>
  )
}

function StatRow({ label, value }) {
  return (
    <div className="stat-row">
      <span className="stat-row-label">{label}</span>
      <span className="stat-row-value mono">{value}</span>
    </div>
  )
}
