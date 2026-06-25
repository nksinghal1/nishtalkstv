import { tmdb, RATING_LABELS } from '../../lib/tmdb'
import './ShowCard.css'

const STATUS_CONFIG = {
  completed: { label: 'Completed', className: 'badge-green' },
  dropped: { label: 'Dropped', className: 'badge-red' },
  no_source: { label: 'No Source', className: 'badge-muted' },
}

export default function ShowCard({ show, onClick }) {
  const posterUrl = tmdb.posterUrl(show.poster_path)
  const year = show.first_air_date?.slice(0, 4)
  const statusConfig = STATUS_CONFIG[show.watch_status] || {}
  const genres = show.genres?.slice(0, 2) || []

  return (
    <div className="show-card card" onClick={onClick}>
      <div className="show-card-poster">
        {posterUrl
          ? <img src={posterUrl} alt={show.title} loading="lazy"/>
          : <div className="show-card-no-poster"><span>📺</span></div>
        }
        {show.watch_status && (
          <span className={`show-card-status badge ${statusConfig.className}`}>
            {statusConfig.label}
          </span>
        )}
        {show.rating && (
          <span className="show-card-rating-overlay">★ {show.rating}/10</span>
        )}
      </div>

      <div className="show-card-body">
        <h4 className="show-card-title">{show.title}</h4>
        <span className="show-card-year">{year}</span>
        {genres.length > 0 && (
          <div className="show-card-genres">
            {genres.map(g => <span key={g.id} className="badge badge-muted">{g.name}</span>)}
          </div>
        )}
        {show.rating && (
          <div className="show-card-rating">
            <span className="mono">{show.rating}/10</span>
            <span className="show-card-rating-label">{RATING_LABELS[show.rating]}</span>
          </div>
        )}
      </div>
    </div>
  )
}
