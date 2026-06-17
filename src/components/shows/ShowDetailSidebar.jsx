import { useEffect, useState } from 'react'
import { X, Edit2, ExternalLink } from 'lucide-react'
import { tmdb, RATING_LABELS, getLanguageName } from '../../lib/tmdb'
import { tagsApi, similarityApi } from '../../lib/db'
import './ShowDetailSidebar.css'

export default function ShowDetailSidebar({ show, onClose, onEdit }) {
  const [tags, setTags] = useState([])
  const [similarities, setSimilarities] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!show) return
    const load = async () => {
      setLoading(true)
      try {
        const [t, s] = await Promise.all([
          tagsApi.getForShow(show.id),
          similarityApi.getForShow(show.id),
        ])
        setTags(t)
        setSimilarities(s)
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [show?.id])

  if (!show) return null

  const posterUrl = tmdb.posterUrl(show.poster_path, 'w342')
  const year = show.first_air_date?.slice(0, 4)
  const genres = show.genres || []
  const countries = show.origin_country || []
  const tmdbUrl = `https://www.themoviedb.org/tv/${show.tmdb_id}`

  const getSimilarShow = (link) =>
    link.show_a_id === show.id ? link.show_b : link.show_a

  return (
    <>
      <div className="sidebar-backdrop" onClick={onClose} />
      <aside className={`detail-sidebar open`}>
        {/* Header */}
        <div className="dsb-header">
          <button className="btn btn-ghost btn-sm" onClick={onClose}>
            <X size={16} /> Close
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => onEdit(show)}>
            <Edit2 size={14} /> Edit
          </button>
        </div>

        {/* Poster + Title */}
        <div className="dsb-hero">
          {posterUrl ? (
            <img src={posterUrl} alt={show.title} className="dsb-poster" />
          ) : (
            <div className="dsb-no-poster">📺</div>
          )}
          <div className="dsb-title-block">
            <h2 className="dsb-title">{show.title}</h2>
            <span className="mono dsb-year">{year}</span>
            <a
              href={tmdbUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="dsb-tmdb-link"
            >
              <ExternalLink size={12} /> TMDB
            </a>
          </div>
        </div>

        {/* Meta grid */}
        <div className="dsb-meta-grid">
          <MetaItem label="Language" value={getLanguageName(show.original_language)} />
          <MetaItem label="Episodes" value={show.number_of_episodes ? `${show.number_of_episodes} eps` : '—'} mono />
          <MetaItem label="Seasons" value={show.number_of_seasons || '—'} mono />
          <MetaItem label="Country" value={countries.join(', ') || '—'} />
          {show.tmdb_rating && (
            <MetaItem label="TMDB Rating" value={`${show.tmdb_rating}/10`} mono />
          )}
          {show.rating && (
            <MetaItem
              label="Your Rating"
              value={`${show.rating}/10 — ${RATING_LABELS[show.rating]}`}
              highlight
              mono
            />
          )}
        </div>

        {/* Status */}
        {show.watch_status && (
          <div className="dsb-section">
            <StatusBlock show={show} />
          </div>
        )}

        {/* Overview */}
        {show.overview && (
          <div className="dsb-section">
            <div className="dsb-section-label">Synopsis</div>
            <p className="dsb-overview">{show.overview}</p>
          </div>
        )}

        {/* Genres */}
        {genres.length > 0 && (
          <div className="dsb-section">
            <div className="dsb-section-label">Genres</div>
            <div className="dsb-tags-row">
              {genres.map(g => (
                <span key={g.id} className="badge badge-blue">{g.name}</span>
              ))}
            </div>
          </div>
        )}

        {/* Tags */}
        {!loading && tags.length > 0 && (
          <div className="dsb-section">
            <div className="dsb-section-label">Your Tags</div>
            <div className="dsb-tags-row">
              {tags.map(t => (
                <span key={t.id} className="badge badge-muted">#{t.name}</span>
              ))}
            </div>
          </div>
        )}

        {/* Similarities */}
        {!loading && similarities.length > 0 && (
          <div className="dsb-section">
            <div className="dsb-section-label">Similar Shows</div>
            <div className="dsb-similarities">
              {similarities.map(link => {
                const similar = getSimilarShow(link)
                if (!similar) return null
                const simPoster = tmdb.posterUrl(similar.poster_path, 'w92')
                return (
                  <div key={link.id} className="dsb-sim-item">
                    {simPoster ? (
                      <img src={simPoster} alt={similar.title} className="dsb-sim-poster" />
                    ) : (
                      <div className="dsb-sim-no-poster">📺</div>
                    )}
                    <div className="dsb-sim-info">
                      <span className="dsb-sim-title">{similar.title}</span>
                      {link.explanation && (
                        <span className="dsb-sim-reason">{link.explanation}</span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Review */}
        {show.review && (
          <div className="dsb-section">
            <div className="dsb-section-label">Your Review</div>
            <p className="dsb-review">"{show.review}"</p>
          </div>
        )}
      </aside>
    </>
  )
}

function MetaItem({ label, value, mono, highlight }) {
  return (
    <div className="dsb-meta-item">
      <span className="dsb-meta-label">{label}</span>
      <span className={`dsb-meta-value ${mono ? 'mono' : ''} ${highlight ? 'highlight' : ''}`}>
        {value}
      </span>
    </div>
  )
}

function StatusBlock({ show }) {
  if (show.watch_status === 'completed') {
    return (
      <div className="dsb-status completed">
        <span>✓ Completed</span>
      </div>
    )
  }
  if (show.watch_status === 'dropped') {
    return (
      <div className="dsb-status dropped">
        <span>✕ Dropped</span>
        {show.drop_reason && (
          <span className="dsb-drop-reason">{show.drop_reason}</span>
        )}
      </div>
    )
  }
  if (show.watch_status === 'no_source') {
    return (
      <div className="dsb-status no-source">
        <span>⊘ Couldn't find a source</span>
      </div>
    )
  }
  return null
}
