import { useState, useEffect, useRef } from 'react'
import { Search, X, Plus, Sparkles, ChevronRight, Check, Copy, RotateCcw } from 'lucide-react'
import { tmdb, getLanguageName, RATING_LABELS } from '../lib/tmdb'
import { supabase } from '../lib/supabase'
import './ShowCast.css'

// ─── SCORING ─────────────────────────────────────────────────────
async function scoreShows(inputShows) {
  // Get all shows, logs, tags, similarity links from DB
  const [showsRes, tagsRes, linksRes] = await Promise.all([
    supabase.from('shows_with_logs').select('*').not('watch_status', 'is', null),
    supabase.from('show_tags').select('show_id, tags(name)'),
    supabase.from('similarity_links').select('*'),
  ])

  const allShows = showsRes.data || []
  const allTagRows = tagsRes.data || []
  const allLinks = linksRes.data || []

  // Build tag map: show_id -> Set of tag names
  const showTagMap = {}
  allTagRows.forEach(row => {
    if (!showTagMap[row.show_id]) showTagMap[row.show_id] = new Set()
    if (row.tags?.name) showTagMap[row.show_id].add(row.tags.name)
  })

  // Input show IDs (those that are in our DB)
  const inputDbIds = new Set(inputShows.filter(s => s.dbShow).map(s => s.dbShow.id))
  const inputTmdbIds = new Set(inputShows.map(s => s.tmdbId))

  // Build tag union of all input shows
  const inputTagUnion = new Set()
  inputShows.forEach(s => {
    if (s.dbShow) {
      const tags = showTagMap[s.dbShow.id] || new Set()
      tags.forEach(t => inputTagUnion.add(t))
    }
  })

  // Score each candidate
  const scored = []
  for (const show of allShows) {
    // Skip input shows
    if (inputDbIds.has(show.id) || inputTmdbIds.has(show.tmdb_id)) continue

    let score = 0
    const reasons = [] // { inputShowTitle, explanation }

    // Signal 1: direct similarity links (×3)
    for (const link of allLinks) {
      const isLinked =
        (link.show_a_id === show.id && inputDbIds.has(link.show_b_id)) ||
        (link.show_b_id === show.id && inputDbIds.has(link.show_a_id))

      if (isLinked) {
        score += 3
        const linkedInputId = inputDbIds.has(link.show_b_id) ? link.show_b_id : link.show_a_id
        const inputShow = inputShows.find(s => s.dbShow?.id === linkedInputId)
        if (inputShow && link.explanation) {
          reasons.push({
            inputShowTitle: inputShow.title,
            explanation: link.explanation,
          })
        } else if (inputShow) {
          reasons.push({ inputShowTitle: inputShow.title, explanation: null })
        }
      }
    }

    // Signal 2: tag overlap (×1)
    const showTags = showTagMap[show.id] || new Set()
    const sharedTags = [...showTags].filter(t => inputTagUnion.has(t))
    score += sharedTags.length

    // Signal 3: TMDB rating bonus (×0.5)
    if (show.tmdb_rating >= 8) score += 0.5

    if (score > 0) {
      scored.push({ show, score, reasons, sharedTags })
    }
  }

  return scored.sort((a, b) => b.score - a.score)
}

// ─── INPUT SCREEN ────────────────────────────────────────────────
function InputScreen({ onSubmit }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [selectedShows, setSelectedShows] = useState([])
  const [dbCache, setDbCache] = useState({}) // tmdbId -> dbShow or null
  const searchTimeout = useRef(null)

  useEffect(() => {
    if (!query.trim()) { setResults([]); return }
    clearTimeout(searchTimeout.current)
    searchTimeout.current = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await tmdb.searchShows(query)
        const shows = res.results?.slice(0, 6) || []
        setResults(shows)
        // Check DB status for each
        const checks = await Promise.all(shows.map(async s => {
          const { data } = await supabase.from('shows').select('id,title,tmdb_id').eq('tmdb_id', s.id).maybeSingle()
          return [s.id, data]
        }))
        const cache = {}
        checks.forEach(([id, data]) => { cache[id] = data })
        setDbCache(prev => ({ ...prev, ...cache }))
      } catch(e) { console.error(e) }
      finally { setSearching(false) }
    }, 400)
  }, [query])

  const addShow = (tmdbShow) => {
    if (selectedShows.find(s => s.tmdbId === tmdbShow.id)) return
    setSelectedShows(prev => [...prev, {
      tmdbId: tmdbShow.id,
      title: tmdbShow.name,
      poster: tmdbShow.poster_path,
      year: tmdbShow.first_air_date?.slice(0,4),
      dbShow: dbCache[tmdbShow.id] || null,
    }])
    setQuery('')
    setResults([])
  }

  const removeShow = (tmdbId) => setSelectedShows(prev => prev.filter(s => s.tmdbId !== tmdbId))

  return (
    <div className="showcast-input">
      <div className="showcast-hero">
        <div className="showcast-hero-icon">✦</div>
        <h1>ShowCast</h1>
        <p>Tell us what you love. We'll find what you're missing.</p>
      </div>

      <div className="showcast-search-box card">
        <div className="form-group">
          <label className="form-label">Add shows you love</label>
          <div className="search-input-wrap">
            <Search size={15} className="search-icon"/>
            <input
              className="input search-input"
              placeholder="Search any show..."
              value={query}
              onChange={e => setQuery(e.target.value)}
              autoFocus
            />
            {searching && <div className="loading-spinner" style={{width:15,height:15}}/>}
          </div>
        </div>

        {results.length > 0 && (
          <div className="search-results showcast-results">
            {results.map(show => {
              const alreadyAdded = selectedShows.find(s => s.tmdbId === show.id)
              const inDb = dbCache[show.id]
              return (
                <button
                  key={show.id}
                  className="search-result-item"
                  onClick={() => !alreadyAdded && addShow(show)}
                  disabled={!!alreadyAdded}
                  style={{opacity: alreadyAdded ? 0.5 : 1}}
                >
                  {show.poster_path && <img src={tmdb.posterUrl(show.poster_path,'w92')} alt={show.name} className="search-result-poster"/>}
                  <div style={{flex:1,textAlign:'left'}}>
                    <div className="search-result-title">{show.name}</div>
                    <div className="search-result-year">{show.first_air_date?.slice(0,4)}</div>
                  </div>
                  {alreadyAdded
                    ? <Check size={14} style={{color:'var(--success)',flexShrink:0}}/>
                    : inDb === undefined
                    ? <div className="loading-spinner" style={{width:12,height:12}}/>
                    : inDb
                    ? <span className="showcast-in-db">✦ Logged</span>
                    : <span className="showcast-not-db">Not logged</span>
                  }
                </button>
              )
            })}
          </div>
        )}

        {/* Selected shows */}
        {selectedShows.length > 0 && (
          <div className="showcast-selected">
            <div className="form-label" style={{marginBottom:'0.5rem'}}>Your picks ({selectedShows.length})</div>
            <div className="showcast-chips">
              {selectedShows.map(show => (
                <div key={show.tmdbId} className={`showcast-chip ${!show.dbShow ? 'not-logged' : ''}`}>
                  {show.poster && <img src={tmdb.posterUrl(show.poster,'w92')} alt={show.title}/>}
                  <span>{show.title}</span>
                  {!show.dbShow && <span className="showcast-chip-badge">Not logged</span>}
                  <button onClick={() => removeShow(show.tmdbId)}><X size={12}/></button>
                </div>
              ))}
            </div>
          </div>
        )}

        <button
          className="btn btn-primary showcast-go-btn"
          onClick={() => onSubmit(selectedShows)}
          disabled={selectedShows.length === 0}
        >
          <Sparkles size={16}/> Find My Shows
          <ChevronRight size={16}/>
        </button>
      </div>
    </div>
  )
}

// ─── SWIPE CARD ───────────────────────────────────────────────────
function SwipeCard({ result, onAdd, onSkip }) {
  const { show, reasons, sharedTags } = result
  const poster = tmdb.posterUrl(show.poster_path, 'w342')
  const genres = show.genres || []
  const year = show.first_air_date?.slice(0,4)

  return (
    <div className="showcast-card card">
      <div className="showcast-card-inner">
        {/* Left: poster */}
        <div className="showcast-card-poster">
          {poster
            ? <img src={poster} alt={show.title}/>
            : <div className="showcast-no-poster">📺</div>
          }
          {show.tmdb_rating > 0 && (
            <div className="showcast-tmdb-badge mono">⭐ {show.tmdb_rating?.toFixed(1)}</div>
          )}
        </div>

        {/* Right: info */}
        <div className="showcast-card-body">
          <div className="showcast-card-top">
            <h2 className="showcast-card-title">{show.title}</h2>
            <div className="showcast-card-meta">
              {year && <span className="mono">{year}</span>}
              {show.number_of_episodes && <span className="badge badge-muted mono">{show.number_of_episodes} eps</span>}
              {show.number_of_seasons && <span className="badge badge-muted mono">{show.number_of_seasons} seasons</span>}
            </div>
            <div className="showcast-card-meta" style={{marginTop:'0.25rem'}}>
              {getLanguageName(show.original_language) && (
                <span className="badge badge-muted">{getLanguageName(show.original_language)}</span>
              )}
              {genres.slice(0,3).map(g => <span key={g.id} className="badge badge-blue">{g.name}</span>)}
            </div>
          </div>

          {show.overview && (
            <p className="showcast-card-overview">{show.overview}</p>
          )}

          {/* Why recommended */}
          {reasons.length > 0 && (
            <div className="showcast-why">
              <div className="showcast-why-label">Why ShowCast picked this</div>
              {reasons.slice(0, 3).map((r, i) => (
                <div key={i} className="showcast-why-item">
                  <span className="showcast-why-show">↳ {r.inputShowTitle}</span>
                  {r.explanation && <span className="showcast-why-reason">{r.explanation}</span>}
                </div>
              ))}
              {sharedTags.length > 0 && (
                <div className="showcast-shared-tags">
                  {sharedTags.slice(0,5).map(t => <span key={t} className="badge badge-muted">#{t}</span>)}
                </div>
              )}
            </div>
          )}

          {/* Nish's take */}
          {show.rating && (
            <div className="showcast-nish-take">
              <div className="showcast-nish-label">Nish rated this</div>
              <div className="showcast-nish-rating mono">{show.rating}/10 — {RATING_LABELS[show.rating]}</div>
              {show.review && <p className="showcast-nish-review">"{show.review}"</p>}
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="showcast-card-actions">
        <button className="showcast-btn-skip" onClick={onSkip}>
          <X size={20}/>
          <span>Skip</span>
        </button>
        <button className="showcast-btn-add" onClick={onAdd}>
          <Plus size={20}/>
          <span>Add to My List</span>
        </button>
      </div>
    </div>
  )
}

// ─── RESULTS SCREEN ───────────────────────────────────────────────
function ResultsScreen({ saved, onReset }) {
  const [copied, setCopied] = useState(false)

  const copyToClipboard = () => {
    const text = [
      '🎬 My ShowCast Recommendations',
      '─────────────────────────────',
      ...saved.map((r, i) => {
        const lines = [`${i+1}. ${r.show.title} (${r.show.first_air_date?.slice(0,4)||'?'})`]
        if (r.show.rating) lines.push(`   Nish's rating: ${r.show.rating}/10 — ${RATING_LABELS[r.show.rating]}`)
        if (r.show.tmdb_rating) lines.push(`   TMDB: ${r.show.tmdb_rating}`)
        if (r.reasons[0]?.explanation) lines.push(`   Why: ${r.reasons[0].explanation}`)
        return lines.join('\n')
      }),
      '',
      'Generated by ShowCast on nishtalkstv.vercel.app',
    ].join('\n')

    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="showcast-results-screen">
      <div className="showcast-results-header">
        <div className="showcast-results-icon">✦</div>
        <h2>Your ShowCast</h2>
        <p>
          {saved.length === 0
            ? "You skipped everything — that's okay, try different inputs."
            : `Based on what you love, here's where we'd start. ${saved.length} show${saved.length > 1 ? 's' : ''} picked.`
          }
        </p>
        <div className="showcast-results-actions">
          {saved.length > 0 && (
            <button className="btn btn-primary" onClick={copyToClipboard}>
              {copied ? <><Check size={15}/> Copied!</> : <><Copy size={15}/> Copy List</>}
            </button>
          )}
          <button className="btn btn-secondary" onClick={onReset}>
            <RotateCcw size={15}/> Start Over
          </button>
        </div>
      </div>

      {saved.length > 0 && (
        <div className="showcast-saved-list">
          {saved.map((result, i) => {
            const { show, reasons } = result
            const poster = tmdb.posterUrl(show.poster_path, 'w154')
            return (
              <div key={show.id} className="showcast-saved-item card">
                <span className="showcast-saved-rank mono">#{i+1}</span>
                {poster && <img src={poster} alt={show.title} className="showcast-saved-poster"/>}
                <div className="showcast-saved-info">
                  <div className="showcast-saved-title">{show.title}</div>
                  <div className="showcast-saved-meta mono">
                    {show.first_air_date?.slice(0,4)}
                    {show.tmdb_rating && ` · TMDB ${show.tmdb_rating}`}
                    {show.rating && ` · Nish ${show.rating}/10`}
                  </div>
                  {reasons[0]?.explanation && (
                    <div className="showcast-saved-reason">↳ {reasons[0].explanation}</div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── MAIN ─────────────────────────────────────────────────────────
export default function ShowCast() {
  const [phase, setPhase] = useState('input') // input | loading | swiping | done
  const [recommendations, setRecommendations] = useState([])
  const [currentIdx, setCurrentIdx] = useState(0)
  const [saved, setSaved] = useState([])

  const handleSubmit = async (inputShows) => {
    setPhase('loading')
    try {
      const results = await scoreShows(inputShows)
      setRecommendations(results)
      setCurrentIdx(0)
      setSaved([])
      setPhase(results.length === 0 ? 'done' : 'swiping')
    } catch(e) {
      console.error(e)
      setPhase('input')
    }
  }

  const handleAdd = () => {
    setSaved(prev => [...prev, recommendations[currentIdx]])
    advance()
  }

  const handleSkip = () => advance()

  const advance = () => {
    const next = currentIdx + 1
    if (next >= recommendations.length) setPhase('done')
    else setCurrentIdx(next)
  }

  const handleReset = () => {
    setPhase('input')
    setRecommendations([])
    setCurrentIdx(0)
    setSaved([])
  }

  if (phase === 'input') return <InputScreen onSubmit={handleSubmit}/>

  if (phase === 'loading') return (
    <div className="showcast-loading">
      <div className="showcast-loading-icon">✦</div>
      <h2>Finding your shows...</h2>
      <p>Analysing your taste across {' '}500+ shows and thousands of similarity links.</p>
      <div className="loading-spinner" style={{width:32,height:32,marginTop:'1rem'}}/>
    </div>
  )

  if (phase === 'swiping') return (
    <div className="showcast-swiping">
      <div className="showcast-progress">
        <span className="mono showcast-progress-text">
          {currentIdx + 1} / {recommendations.length}
        </span>
        <div className="showcast-progress-bar">
          <div className="showcast-progress-fill" style={{width:`${((currentIdx)/recommendations.length)*100}%`}}/>
        </div>
        <span className="mono showcast-saved-count">{saved.length} saved</span>
      </div>
      <SwipeCard
        key={recommendations[currentIdx].show.id}
        result={recommendations[currentIdx]}
        onAdd={handleAdd}
        onSkip={handleSkip}
      />
    </div>
  )

  return <ResultsScreen saved={saved} onReset={handleReset}/>
}
