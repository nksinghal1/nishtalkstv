import { useState, useEffect, useRef } from 'react'
import { Search, X, Plus, Trash2 } from 'lucide-react'
import { tmdb, RATING_LABELS, getLanguageName } from '../../lib/tmdb'
import { showsApi, watchLogsApi, tagsApi, similarityApi, watchlistApi } from '../../lib/db'
import './LogShowModal.css'

export default function LogShowModal({ onClose, onSuccess, editShow = null, onEdit }) {
  const isEdit = !!editShow

  // Search state
  const [query, setQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [selectedTmdbShow, setSelectedTmdbShow] = useState(null)

  // Form state
  const [watchStatus, setWatchStatus] = useState('completed')
  const [rating, setRating] = useState('')
  const [review, setReview] = useState('')
  const [dropReason, setDropReason] = useState('')
  const [tagInput, setTagInput] = useState('')
  const [tags, setTags] = useState([])
  const [allTags, setAllTags] = useState([])
  const [tagSuggestions, setTagSuggestions] = useState([])
  const [similarities, setSimilarities] = useState([]) // [{showId, title, explanation}]
  const [simSearch, setSimSearch] = useState('')
  const [simResults, setSimResults] = useState([])
  const [simSearching, setSimSearching] = useState(false)

  const [watchedBeforeTracking, setWatchedBeforeTracking] = useState(false)
  const [watchedOnDate, setWatchedOnDate] = useState(new Date().toISOString().split('T')[0])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const searchTimeout = useRef(null)
  const simTimeout = useRef(null)

  // Load all existing tags for autocomplete
  useEffect(() => {
    tagsApi.getAll().then(setAllTags).catch(() => { })
  }, [])

  // Pre-populate if editing
  useEffect(() => {
    if (!editShow) return
    setWatchStatus(editShow.watch_status || 'completed')
    setRating(editShow.rating?.toString() || '')
    setReview(editShow.review || '')
    setDropReason(editShow.drop_reason || '')
    setWatchedBeforeTracking(editShow.watched_before_tracking || false)
    setWatchedOnDate(editShow.date_watched_override || '')

    const loadEditData = async () => {
      const [existingTags, existingLinks] = await Promise.all([
        tagsApi.getForShow(editShow.id),
        similarityApi.getForShow(editShow.id),
      ])
      setTags(existingTags.map(t => t.name))
      setSimilarities(existingLinks.map(link => {
        const other = link.show_a_id === editShow.id ? link.show_b : link.show_a
        return {
          linkId: link.id,
          showId: other?.id,
          title: other?.title || 'Unknown',
          explanation: link.explanation || '',
        }
      }))
    }
    loadEditData()
  }, [editShow])

  // Extract TMDB ID from URL or tmdb: prefix
  const extractTmdbId = (input) => {
    // https://www.themoviedb.org/tv/1396-breaking-bad
    const urlMatch = input.match(/themoviedb\.org\/tv\/(\d+)/)
    if (urlMatch) return urlMatch[1]
    // tmdb:1396
    const prefixMatch = input.match(/^tmdb:(\d+)$/i)
    if (prefixMatch) return prefixMatch[1]
    return null
  }

  // TMDB search
  useEffect(() => {
    if (isEdit || !query.trim()) {
      setSearchResults([])
      return
    }
    clearTimeout(searchTimeout.current)
    searchTimeout.current = setTimeout(async () => {
      setSearching(true)
      try {
        // Check if it's a TMDB URL or ID
        const tmdbId = extractTmdbId(query.trim())
        if (tmdbId) {
          const show = await tmdb.getShow(tmdbId)
          if (show) setSearchResults([show])
          else setSearchResults([])
        } else {
          const res = await tmdb.searchShows(query)
          setSearchResults(res.results?.slice(0, 6) || [])
        }
      } catch { }
      finally { setSearching(false) }
    }, 400)
  }, [query])

  // Similarity search
  useEffect(() => {
    if (!simSearch.trim()) { setSimResults([]); return }
    clearTimeout(simTimeout.current)
    simTimeout.current = setTimeout(async () => {
      setSimSearching(true)
      try {
        // Also support TMDB URL/ID in similarity search
        const tmdbId = extractTmdbId(simSearch.trim())
        if (tmdbId) {
          const show = await tmdb.getShow(tmdbId)
          if (show) setSimResults([show])
          else setSimResults([])
        } else {
          const res = await tmdb.searchShows(simSearch)
          setSimResults(res.results?.slice(0, 5) || [])
        }
      } catch { }
      finally { setSimSearching(false) }
    }, 400)
  }, [simSearch])

  const selectShow = async (tmdbShow) => {
    setSearching(true)
    try {
      // Check if already logged
      const existing = await showsApi.getByTmdbId(tmdbShow.id)
      if (existing) {
        const withLog = await showsApi.getById(existing.id)
        onEdit?.(withLog)
        return
      }
      const full = await tmdb.getShow(tmdbShow.id)
      setSelectedTmdbShow(full)
      setSearchResults([])
      setQuery('')
    } catch { }
    finally { setSearching(false) }
  }

  const handleTagInput = (val) => {
    setTagInput(val)
    if (!val.trim()) { setTagSuggestions([]); return }
    const matches = allTags
      .map(t => t.name)
      .filter(name => name.includes(val.toLowerCase()) && !tags.includes(name))
      .slice(0, 6)
    setTagSuggestions(matches)
  }

  const addTag = (value) => {
    const t = (value || tagInput).trim().toLowerCase()
    if (t && !tags.includes(t)) setTags([...tags, t])
    setTagInput('')
    setTagSuggestions([])
  }

  const removeTag = (tag) => setTags(tags.filter(t => t !== tag))

  const addSimilarity = async (tmdbShow) => {
    let existing = await showsApi.getByTmdbId(tmdbShow.id)
    if (!existing) {
      const full = await tmdb.getShow(tmdbShow.id)
      existing = await showsApi.upsertShow(full)
    }
    if (similarities.find(s => s.showId === existing.id)) return
    setSimilarities([...similarities, {
      showId: existing.id,
      title: tmdbShow.name || tmdbShow.title,
      explanation: '',
    }])
    setSimSearch('')
    setSimResults([])
  }

  const updateSimExplanation = (idx, val) => {
    const updated = [...similarities]
    updated[idx].explanation = val
    setSimilarities(updated)
  }

  const removeSimilarity = (idx) => {
    setSimilarities(similarities.filter((_, i) => i !== idx))
  }

  const handleSave = async () => {
    setError(null)
    const targetTmdb = isEdit ? null : selectedTmdbShow
    if (!isEdit && !targetTmdb) {
      setError('Please search and select a show first.')
      return
    }
    if (watchStatus === 'completed' && !rating) {
      setError('Please add a rating for completed shows.')
      return
    }

    setSaving(true)
    try {
      let showRecord
      if (isEdit) {
        showRecord = editShow
      } else {
        showRecord = await showsApi.upsertShow(targetTmdb)
      }

      const logData = {
        watch_status: watchStatus,
        rating: watchStatus === 'completed' ? parseInt(rating) : null,
        review: watchStatus === 'completed' ? review || null : null,
        drop_reason: watchStatus === 'dropped' ? dropReason || null : null,
        watched_before_tracking: watchedBeforeTracking,
        date_watched_override: watchedBeforeTracking ? null : (watchedOnDate || null),
        date_watched: isEdit ? undefined : new Date().toISOString(),
      }
      await watchLogsApi.upsert(showRecord.id, logData)

      await watchlistApi.remove(showRecord.tmdb_id).catch(() => { })

      await tagsApi.setShowTags(showRecord.id, tags, showRecord)

      if (isEdit) {
        const existingLinks = await similarityApi.getForShow(showRecord.id)
        const keptLinkIds = similarities.filter(s => s.linkId).map(s => s.linkId)
        for (const link of existingLinks) {
          if (!keptLinkIds.includes(link.id)) {
            await similarityApi.deleteLink(link.id)
          }
        }
      }

      for (const sim of similarities) {
        if (!sim.linkId) {
          await similarityApi.addLink(showRecord.id, sim.showId, sim.explanation)
        } else {
          await similarityApi.updateLink(sim.linkId, sim.explanation)
        }
      }

      onSuccess?.()
    } catch (e) {
      setError('Something went wrong. Please try again.')
      console.error(e)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal log-modal">
        <div className="log-modal-header">
          <h2>{isEdit ? `Editing: ${editShow.title}` : 'Log a Show'}</h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose}><X size={16} /></button>
        </div>

        <div>
          {/* Show search — only shown when not editing */}
          {!isEdit && !selectedTmdbShow && (
            <div className="log-section">
              <div className="form-group">
                <div className="search-input-wrap">
                  <Search size={15} className="search-icon" />
                  <input
                    className="input search-input"
                    placeholder="Search by name, or paste a TMDB URL..."
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    autoFocus
                  />
                  {searching && <div className="loading-spinner" style={{ width: 14, height: 14 }} />}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                  Tip: paste a themoviedb.org/tv/... link to find any show directly
                </div>
              </div>

              {searchResults.length > 0 && (
                <div className="search-results log-search-results">
                  {searchResults.map(show => (
                    <button
                      key={show.id}
                      className="search-result-item"
                      onClick={() => selectShow(show)}
                    >
                      {show.poster_path && (
                        <img src={tmdb.posterUrl(show.poster_path, 'w92')} alt={show.name} className="search-result-poster" />
                      )}
                      <div>
                        <div className="search-result-title">{show.name || show.title}</div>
                        <div className="search-result-year">{(show.first_air_date || show.release_date)?.slice(0, 4)}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Selected show preview */}
          {!isEdit && selectedTmdbShow && (
            <div className="log-show-preview">
              {selectedTmdbShow.poster_path && (
                <img src={tmdb.posterUrl(selectedTmdbShow.poster_path, 'w92')} alt={selectedTmdbShow.name} className="log-preview-poster" />
              )}
              <div>
                <div className="log-preview-title">{selectedTmdbShow.name}</div>
                <div className="log-preview-meta">
                  {selectedTmdbShow.first_air_date?.slice(0, 4)}
                  {selectedTmdbShow.original_language && ` · ${getLanguageName(selectedTmdbShow.original_language)}`}
                  {selectedTmdbShow.number_of_episodes && ` · ${selectedTmdbShow.number_of_episodes} eps`}
                </div>
                <button className="btn btn-ghost btn-sm" style={{ marginTop: '0.25rem', padding: '0.1rem 0' }} onClick={() => { setSelectedTmdbShow(null); setQuery('') }}>
                  Change show
                </button>
              </div>
            </div>
          )}

          {/* Form — shown once show is selected or in edit mode */}
          {(isEdit || selectedTmdbShow) && (
            <>
              {/* Watch status */}
              <div className="log-section">
                <div className="form-group">
                  <label className="form-label">Watch Status</label>
                  <div className="status-buttons">
                    {[
                      { value: 'completed', label: '✓ Completed' },
                      { value: 'dropped', label: '✕ Dropped' },
                      { value: 'no_source', label: '⊘ No Source' },
                    ].map(opt => (
                      <button
                        key={opt.value}
                        className={`status-btn ${watchStatus === opt.value ? 'active' : ''}`}
                        onClick={() => setWatchStatus(opt.value)}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Completed fields */}
              {watchStatus === 'completed' && (
                <div className="log-section">
                  <div className="form-group">
                    <label className="form-label">
                      Your Rating{' '}
                      {rating && (
                        <span style={{ color: 'var(--blue-highlight)', marginLeft: '0.5rem' }}>
                          {rating}/10 — {RATING_LABELS[rating]}
                        </span>
                      )}
                    </label>
                    <div className="rating-picker">
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
                        <button
                          key={n}
                          className={`rating-btn ${rating == n ? 'active' : ''}`}
                          onClick={() => setRating(n.toString())}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Review <span style={{ color: 'var(--text-muted)' }}>— optional</span></label>
                    <textarea
                      className="textarea"
                      placeholder="Your thoughts on this show..."
                      value={review}
                      onChange={e => setReview(e.target.value)}
                      rows={3}
                    />
                  </div>
                </div>
              )}

              {/* Dropped field */}
              {watchStatus === 'dropped' && (
                <div className="log-section">
                  <div className="form-group">
                    <label className="form-label">Why did you drop it? <span style={{ color: 'var(--text-muted)' }}>— optional</span></label>
                    <textarea
                      className="textarea"
                      placeholder="e.g. Lost interest after season 2..."
                      value={dropReason}
                      onChange={e => setDropReason(e.target.value)}
                      rows={2}
                    />
                  </div>
                </div>
              )}

              {/* Watched On */}
              <div className="log-section">
                <div className="form-group">
                  <label className="form-label">When did you watch it?</label>
                  <label className="before-tracking-label">
                    <input
                      type="checkbox"
                      checked={watchedBeforeTracking}
                      onChange={e => { setWatchedBeforeTracking(e.target.checked); setWatchedOnDate('') }}
                    />
                    <span>Watched before November 2023</span>
                  </label>
                  {!watchedBeforeTracking && (
                    <input
                      type="date"
                      className="input"
                      value={watchedOnDate}
                      onChange={e => setWatchedOnDate(e.target.value)}
                      max={new Date().toISOString().split('T')[0]}
                    />
                  )}
                </div>
              </div>

              {/* Tags */}
              <div className="log-section">
                <div className="form-group">
                  <label className="form-label">Tags</label>
                  <div className="tag-input-wrap">
                    <div className="tag-input-row">
                      <input
                        className="input"
                        placeholder="e.g. slow-burn, binge-worthy..."
                        value={tagInput}
                        onChange={e => handleTagInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addTag())}
                        autoComplete="off"
                      />
                      <button className="btn btn-secondary btn-sm" onClick={() => addTag()}>
                        <Plus size={14} /> Add
                      </button>
                    </div>
                    {tagSuggestions.length > 0 && (
                      <div className="tag-suggestions">
                        {tagSuggestions.map(s => (
                          <button key={s} className="tag-suggestion-item" onClick={() => addTag(s)}>
                            #{s}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  {tags.length > 0 && (
                    <div className="tags-preview">
                      {tags.map(t => (
                        <span key={t} className="badge badge-muted tag-removable">
                          #{t}
                          <button onClick={() => removeTag(t)}><X size={10} /></button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Similarities */}
              <div className="log-section">
                <div className="form-group">
                  <label className="form-label">Similar Shows</label>
                  <div className="search-input-wrap">
                    <Search size={15} className="search-icon" />
                    <input
                      className="input search-input"
                      placeholder="Search by name, or paste a TMDB URL..."
                      value={simSearch}
                      onChange={e => setSimSearch(e.target.value)}
                    />
                    {simSearching && <div className="loading-spinner" style={{ width: 14, height: 14 }} />}
                  </div>

                  {simResults.length > 0 && (
                    <div className="search-results">
                      {simResults.map(show => (
                        <button key={show.id} className="search-result-item" onClick={() => addSimilarity(show)}>
                          {show.poster_path && (
                            <img src={tmdb.posterUrl(show.poster_path, 'w92')} alt={show.name} className="search-result-poster" />
                          )}
                          <div>
                            <div className="search-result-title">{show.name || show.title}</div>
                            <div className="search-result-year">{(show.first_air_date || show.release_date)?.slice(0, 4)}</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  {similarities.length > 0 && (
                    <div className="similarities-list">
                      {similarities.map((sim, idx) => (
                        <div key={idx} className="sim-row">
                          <div className="sim-row-header">
                            <span className="sim-show-name">{sim.title}</span>
                            <button className="btn btn-ghost btn-sm" onClick={() => removeSimilarity(idx)}>
                              <Trash2 size={13} />
                            </button>
                          </div>
                          <input
                            className="input"
                            placeholder="Why are they similar? e.g. Both have unreliable narrators..."
                            value={sim.explanation}
                            onChange={e => updateSimExplanation(idx, e.target.value)}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {error && <div className="log-error">{error}</div>}

              <div className="log-modal-actions">
                <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
                <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                  {saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Log Show'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
