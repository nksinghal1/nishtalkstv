import { useState, useEffect, useRef } from 'react'
import { Search, X, Plus, Sparkles, ChevronRight, Check, Copy, RotateCcw, ChevronDown, Flag } from 'lucide-react'
import { tmdb, getLanguageName, RATING_LABELS } from '../lib/tmdb'
import { supabase } from '../lib/supabase'
import './ShowCast.css'

const BATCH_SIZE = 12

// ─── SCORING ─────────────────────────────────────────────────────
async function buildScores(inputShows, savedShows = []) {
  const [showsRes, tagsRes, linksRes] = await Promise.all([
    supabase.from('shows_with_logs').select('*').not('watch_status', 'is', null),
    supabase.from('show_tags').select('show_id, tags(name)'),
    supabase.from('similarity_links').select('*'),
  ])

  const allShows = showsRes.data || []
  const allTagRows = tagsRes.data || []
  const allLinks = linksRes.data || []

  const showTagMap = {}
  allTagRows.forEach(row => {
    if (!showTagMap[row.show_id]) showTagMap[row.show_id] = new Set()
    if (row.tags?.name) showTagMap[row.show_id].add(row.tags.name)
  })

  // All "seed" shows = inputs + things user has already saved
  const seedIds = new Set([
    ...inputShows.filter(s => s.dbShow).map(s => s.dbShow.id),
    ...savedShows.map(s => s.show.id),
  ])
  const inputTmdbIds = new Set(inputShows.map(s => s.tmdbId))

  // Also build tmdbId -> inputShow map for better reason lookup
  const tmdbToInputShow = {}
  inputShows.forEach(s => { if (s.dbShow) tmdbToInputShow[s.dbShow.id] = s })
  savedShows.forEach(s => { tmdbToInputShow[s.show.id] = { title: s.show.title, dbShow: s.show } })

  const inputTagUnion = new Set()
  seedIds.forEach(id => {
    const show = allShows.find(s => s.id === id)
    if (show) {
      // Add TMDB genres
      ;(show.genres || []).forEach(g => inputTagUnion.add(g.name))
      // Add origin countries as tags
      ;(show.origin_country || []).forEach(c => inputTagUnion.add(c))
    }
    // Add custom tags
    const tags = showTagMap[id] || new Set()
    tags.forEach(t => inputTagUnion.add(t))
  })

  const scored = []
  for (const show of allShows) {
    if (seedIds.has(show.id) || inputTmdbIds.has(show.tmdb_id)) continue

    let score = 0
    const reasons = []

    for (const link of allLinks) {
      const linkedSeedId =
        link.show_a_id === show.id && seedIds.has(link.show_b_id) ? link.show_b_id :
        link.show_b_id === show.id && seedIds.has(link.show_a_id) ? link.show_a_id : null

      if (linkedSeedId) {
        // Extra weight if linked to a saved show (iterative learning)
        const isSaved = savedShows.some(s => s.show.id === linkedSeedId)
        score += isSaved ? 4 : 3

        const inputShow = tmdbToInputShow[linkedSeedId]
        const sourceTitle = inputShow?.title || inputShow?.dbShow?.title
        if (sourceTitle) {
          reasons.push({ inputShowTitle: sourceTitle, explanation: link.explanation || null })
        }
      }
    }

    const showTags = showTagMap[show.id] || new Set()
    // Also count TMDB genre matches
    const showGenres = new Set((show.genres || []).map(g => g.name))
    const allShowTags = new Set([...showTags, ...showGenres])
    const sharedTags = [...allShowTags].filter(t => inputTagUnion.has(t))
    score += sharedTags.length
    if (show.tmdb_rating >= 8) score += 0.5

    // Require direct link OR meaningful tag overlap to filter noise
    const hasDirectLink = reasons.length > 0
    if (hasDirectLink || sharedTags.length >= 2) scored.push({ show, score, reasons, sharedTags })
  }

  return scored.sort((a, b) => b.score - a.score)
}

// ─── INPUT SCREEN ────────────────────────────────────────────────
function InputScreen({ onSubmit }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [selectedShows, setSelectedShows] = useState([])
  const [dbCache, setDbCache] = useState({})
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
          <label className="form-label">Add shows you love — as many as you want</label>
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
                <button key={show.id} className="search-result-item" onClick={() => !alreadyAdded && addShow(show)} disabled={!!alreadyAdded} style={{opacity: alreadyAdded ? 0.5 : 1}}>
                  {show.poster_path && <img src={tmdb.posterUrl(show.poster_path,'w92')} alt={show.name} className="search-result-poster"/>}
                  <div style={{flex:1,textAlign:'left'}}>
                    <div className="search-result-title">{show.name}</div>
                    <div className="search-result-year">{show.first_air_date?.slice(0,4)}</div>
                  </div>
                  {alreadyAdded
                    ? <Check size={14} style={{color:'var(--success)',flexShrink:0}}/>
                    : inDb === undefined ? <div className="loading-spinner" style={{width:12,height:12}}/>
                    : inDb ? <span className="showcast-in-db">✦ Logged</span>
                    : <span className="showcast-not-db">Not logged</span>
                  }
                </button>
              )
            })}
          </div>
        )}

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

        <button className="btn btn-primary showcast-go-btn" onClick={() => onSubmit(selectedShows)} disabled={selectedShows.length === 0}>
          <Sparkles size={16}/> Find My Shows <ChevronRight size={16}/>
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

  // Dedupe reasons by inputShowTitle
  const uniqueReasons = []
  const seen = new Set()
  for (const r of reasons) {
    if (!seen.has(r.inputShowTitle)) {
      seen.add(r.inputShowTitle)
      uniqueReasons.push(r)
    }
  }

  return (
    <div className="showcast-card card">
      <div className="showcast-card-inner">
        <div className="showcast-card-poster">
          {poster
            ? <img src={poster} alt={show.title}/>
            : <div className="showcast-no-poster">📺</div>
          }
          {show.tmdb_rating > 0 && (
            <div className="showcast-tmdb-badge mono">⭐ {show.tmdb_rating?.toFixed(1)}</div>
          )}
        </div>

        <div className="showcast-card-body">
          <div>
            <h2 className="showcast-card-title">{show.title}</h2>
            <div className="showcast-card-meta">
              {year && <span className="mono">{year}</span>}
              {show.number_of_episodes && <span className="badge badge-muted mono">{show.number_of_episodes} eps</span>}
              {show.number_of_seasons && <span className="badge badge-muted mono">{show.number_of_seasons} seasons</span>}
            </div>
            <div className="showcast-card-meta" style={{marginTop:'0.25rem'}}>
              {getLanguageName(show.original_language) && <span className="badge badge-muted">{getLanguageName(show.original_language)}</span>}
              {genres.slice(0,3).map(g => <span key={g.id} className="badge badge-blue">{g.name}</span>)}
            </div>
          </div>

          {show.overview && <p className="showcast-card-overview">{show.overview}</p>}

          {uniqueReasons.length > 0 && (
            <div className="showcast-why">
              <div className="showcast-why-label">Why ShowCast picked this</div>
              {uniqueReasons.slice(0,3).map((r, i) => (
                <div key={i} className="showcast-why-item">
                  <span className="showcast-why-show">Because you like <strong>{r.inputShowTitle}</strong></span>
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

          {show.rating && (
            <div className="showcast-nish-take">
              <div className="showcast-nish-label">Nish rated this</div>
              <div className="showcast-nish-rating mono">{show.rating}/10 — {RATING_LABELS[show.rating]}</div>
              {show.review && <p className="showcast-nish-review">"{show.review}"</p>}
            </div>
          )}
        </div>
      </div>

      <div className="showcast-card-actions">
        <button className="showcast-btn-skip" onClick={onSkip}><X size={18}/> Skip</button>
        <button className="showcast-btn-add" onClick={onAdd}><Plus size={18}/> Add to My List</button>
      </div>
    </div>
  )
}

// ─── RESULTS SCREEN ───────────────────────────────────────────────
function ResultsScreen({ saved, onReset, onLoadMore, hasMore, loadingMore }) {
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
            ? "You skipped everything — try different inputs."
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
                  {reasons[0]?.explanation && <div className="showcast-saved-reason">{reasons[0].explanation}</div>}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {hasMore && (
        <div style={{textAlign:'center',marginTop:'1rem'}}>
          <button className="btn btn-secondary" onClick={onLoadMore} disabled={loadingMore}>
            {loadingMore ? 'Re-ranking based on your picks...' : <><ChevronDown size={15}/> Load More Recommendations</>}
          </button>
          {!loadingMore && <p style={{fontSize:'0.8rem',color:'var(--text-muted)',marginTop:'0.5rem'}}>Next batch is re-ranked based on what you just saved.</p>}
        </div>
      )}
    </div>
  )
}

// ─── MAIN ─────────────────────────────────────────────────────────
export default function ShowCast() {
  const [phase, setPhase] = useState('input')
  const [inputShows, setInputShows] = useState([])
  const [allResults, setAllResults] = useState([])
  const [batchStart, setBatchStart] = useState(0)
  const [currentBatch, setCurrentBatch] = useState([])
  const [currentIdx, setCurrentIdx] = useState(0)
  const [saved, setSaved] = useState([])
  const [skipped, setSkipped] = useState(new Set())
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)

  const handleSubmit = async (selectedShows) => {
    setLoading(true)
    setInputShows(selectedShows)
    try {
      const results = await buildScores(selectedShows, [])
      setAllResults(results)
      const batch = results.slice(0, BATCH_SIZE)
      setCurrentBatch(batch)
      setBatchStart(BATCH_SIZE)
      setCurrentIdx(0)
      setSaved([])
      setSkipped(new Set())
      setPhase(batch.length === 0 ? 'done' : 'swiping')
    } catch(e) { console.error(e) }
    finally { setLoading(false) }
  }

  const handleAdd = () => {
    setSaved(prev => [...prev, currentBatch[currentIdx]])
    advance()
  }

  const handleSkip = () => {
    setSkipped(prev => new Set([...prev, currentBatch[currentIdx].show.id]))
    advance()
  }

  const advance = () => {
    const next = currentIdx + 1
    if (next >= currentBatch.length) setPhase('done')
    else setCurrentIdx(next)
  }

  const handleStop = () => setPhase('done')

  const handleLoadMore = async () => {
    setLoadingMore(true)
    try {
      // Re-score with saved shows included for iterative learning
      const reScored = await buildScores(inputShows, saved)
      // Filter already seen
      const seenIds = new Set([
        ...currentBatch.map(r => r.show.id),
        ...saved.map(r => r.show.id),
        ...skipped,
      ])
      const nextBatch = reScored.filter(r => !seenIds.has(r.show.id)).slice(0, BATCH_SIZE)
      setAllResults(reScored)
      setCurrentBatch(nextBatch)
      setCurrentIdx(0)
      setBatchStart(prev => prev + BATCH_SIZE)
      setPhase(nextBatch.length === 0 ? 'done' : 'swiping')
    } catch(e) { console.error(e) }
    finally { setLoadingMore(false) }
  }

  const handleReset = () => {
    setPhase('input')
    setAllResults([])
    setCurrentBatch([])
    setCurrentIdx(0)
    setSaved([])
    setSkipped(new Set())
    setInputShows([])
  }

  const remainingCount = allResults.filter(r =>
    !saved.find(s => s.show.id === r.show.id) &&
    !skipped.has(r.show.id) &&
    !currentBatch.find(c => c.show.id === r.show.id)
  ).length

  if (phase === 'input') return <InputScreen onSubmit={handleSubmit}/>

  if (loading) return (
    <div className="showcast-loading">
      <div className="showcast-loading-icon">✦</div>
      <h2>Finding your shows...</h2>
      <p>Analysing your taste across 500+ shows and thousands of similarity links.</p>
      <div className="loading-spinner" style={{width:32,height:32,marginTop:'1rem'}}/>
    </div>
  )

  if (phase === 'swiping') {
    const current = currentBatch[currentIdx]
    return (
      <div className="showcast-swiping">
        <div className="showcast-progress">
          <span className="mono showcast-progress-text">{currentIdx + 1} / {currentBatch.length}</span>
          <div className="showcast-progress-bar">
            <div className="showcast-progress-fill" style={{width:`${(currentIdx/currentBatch.length)*100}%`}}/>
          </div>
          <div style={{display:'flex',gap:'0.5rem',alignItems:'center'}}>
            <span className="mono showcast-saved-count">{saved.length} saved</span>
            <button className="btn btn-ghost btn-sm" onClick={handleStop} title="Stop and see results">
              <Flag size={13}/> Done
            </button>
          </div>
        </div>
        <SwipeCard key={current.show.id} result={current} onAdd={handleAdd} onSkip={handleSkip}/>
      </div>
    )
  }

  return (
    <ResultsScreen
      saved={saved}
      onReset={handleReset}
      onLoadMore={handleLoadMore}
      hasMore={remainingCount > 0}
      loadingMore={loadingMore}
    />
  )
}
