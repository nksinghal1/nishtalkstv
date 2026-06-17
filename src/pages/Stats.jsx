import { useState, useEffect } from 'react'
import { statsApi } from '../lib/db'
import { getLanguageName, GENRE_ICONS } from '../lib/tmdb'
import './Stats.css'

const COUNTRY_NAMES = {
  US: 'United States', GB: 'United Kingdom', KR: 'South Korea',
  JP: 'Japan', FR: 'France', DE: 'Germany', IT: 'Italy',
  ES: 'Spain', AU: 'Australia', CA: 'Canada', IN: 'India',
  BR: 'Brazil', MX: 'Mexico', DK: 'Denmark', SE: 'Sweden',
  NO: 'Norway', NL: 'Netherlands', BE: 'Belgium', IL: 'Israel',
  TR: 'Turkey',
}

export default function Stats() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const data = await statsApi.getSummary()
        setStats(data)
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '4rem' }}>
        <div className="loading-spinner" />
      </div>
    )
  }

  if (!stats) return null

  const topCountries = Object.entries(stats.countryCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)

  const topLanguages = Object.entries(stats.langCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)

  return (
    <div className="stats-page">
      <div className="page-header">
        <h1>Stats</h1>
      </div>

      {/* Primary numbers */}
      <div className="stats-primary-grid">
        <StatCard label="Total Logged" value={stats.total} />
        <StatCard label="Completed" value={stats.completed} accent />
        <StatCard label="Dropped" value={stats.dropped} />
        <StatCard label="No Source" value={stats.noSource} />
        <StatCard label="Episodes Watched" value={stats.totalEpisodes.toLocaleString()} />
        <StatCard label="Avg Rating" value={stats.avgRating ? `${stats.avgRating}/10` : '—'} accent />
        <StatCard label="Logged This Year" value={stats.watchedThisYear} />
      </div>

      <div className="stats-secondary-grid">
        {/* Top Genres */}
        {stats.topGenres.length > 0 && (
          <div className="card stats-card">
            <h3 className="stats-card-title">Top Genres</h3>
            <div className="stats-bars">
              {stats.topGenres.map(([genre, count]) => (
                <div key={genre} className="stats-bar-row">
                  <div className="stats-bar-label">
                    <span>{GENRE_ICONS[genre] || '🎬'}</span>
                    <span>{genre}</span>
                  </div>
                  <div className="stats-bar-track">
                    <div
                      className="stats-bar-fill"
                      style={{ width: `${(count / stats.topGenres[0][1]) * 100}%` }}
                    />
                  </div>
                  <span className="mono stats-bar-count">{count}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Top Languages */}
        {topLanguages.length > 0 && (
          <div className="card stats-card">
            <h3 className="stats-card-title">Languages</h3>
            <div className="stats-list">
              {topLanguages.map(([lang, count]) => (
                <div key={lang} className="stats-list-row">
                  <span className="stats-list-label">{getLanguageName(lang)}</span>
                  <span className="mono stats-list-count">{count}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Top Countries */}
        {topCountries.length > 0 && (
          <div className="card stats-card">
            <h3 className="stats-card-title">Countries</h3>
            <div className="stats-list">
              {topCountries.map(([country, count]) => (
                <div key={country} className="stats-list-row">
                  <span className="stats-list-label">
                    {COUNTRY_NAMES[country] || country}
                  </span>
                  <span className="mono stats-list-count">{count}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function StatCard({ label, value, accent }) {
  return (
    <div className={`card stats-primary-card ${accent ? 'accent' : ''}`}>
      <span className="stats-primary-label">{label}</span>
      <span className={`stats-primary-value mono ${accent ? 'accent' : ''}`}>{value}</span>
    </div>
  )
}
