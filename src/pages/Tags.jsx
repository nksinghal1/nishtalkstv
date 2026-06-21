import { useState, useEffect } from 'react'
import { Tag, Search, Plus, X, Check } from 'lucide-react'
import { tagsApi } from '../lib/db'
import { supabase } from '../lib/supabase'
import { tmdb } from '../lib/tmdb'
import ShowDetailSidebar from '../components/shows/ShowDetailSidebar'
import LogShowModal from '../components/shows/LogShowModal'
import './Tags.css'

export default function Tags() {
  const [tags, setTags] = useState([])
  const [selectedTag, setSelectedTag] = useState(null)
  const [tagShows, setTagShows] = useState([])         // shows WITH this tag
  const [allShows, setAllShows] = useState([])          // all logged shows
  const [loadingTags, setLoadingTags] = useState(true)
  const [loadingShows, setLoadingShows] = useState(false)
  const [tagSearch, setTagSearch] = useState('')
  const [showSearch, setShowSearch] = useState('')
  const [selectedShow, setSelectedShow] = useState(null)
  const [editShow, setEditShow] = useState(null)
  const [newTagInput, setNewTagInput] = useState('')
  const [creatingTag, setCreatingTag] = useState(false)
  const [toggling, setToggling] = useState(new Set()) // show IDs being toggled

  const loadTags = async () => {
    setLoadingTags(true)
    try {
      const { data, error } = await supabase
        .from('show_tags')
        .select('tag_id, tags(id, name)')
      if (error) throw error

      const counts = {}
      data.forEach(row => {
        const tag = row.tags
        if (!tag) return
        counts[tag.id] = counts[tag.id] || { ...tag, count: 0 }
        counts[tag.id].count++
      })

      // Also load tags with 0 shows (newly created)
      const allTags = await tagsApi.getAll()
      allTags.forEach(t => {
        if (!counts[t.id]) counts[t.id] = { ...t, count: 0 }
      })

      setTags(Object.values(counts).sort((a, b) => b.count - a.count))
    } catch (e) {
      console.error(e)
    } finally {
      setLoadingTags(false)
    }
  }

  // Load all logged shows once
  useEffect(() => {
    loadTags()
    supabase
      .from('shows_with_logs')
      .select('*')
      .not('watch_status', 'is', null)
      .order('date_watched', { ascending: false })
      .then(({ data }) => setAllShows(data || []))
  }, [])

  const selectTag = async (tag) => {
    setSelectedTag(tag)
    setLoadingShows(true)
    setShowSearch('')
    try {
      const { data, error } = await supabase
        .from('show_tags')
        .select('show_id')
        .eq('tag_id', tag.id)
      if (error) throw error
      setTagShows(data.map(d => d.show_id))
    } catch (e) {
      console.error(e)
    } finally {
      setLoadingShows(false)
    }
  }

  const createTag = async () => {
    const name = newTagInput.trim().toLowerCase()
    if (!name) return
    if (tags.find(t => t.name === name)) {
      // Tag exists — just select it
      const existing = tags.find(t => t.name === name)
      setNewTagInput('')
      selectTag(existing)
      return
    }
    setCreatingTag(true)
    try {
      const tag = await tagsApi.upsertTag(name)
      await loadTags()
      setNewTagInput('')
      selectTag({ ...tag, count: 0 })
    } catch (e) {
      console.error(e)
    } finally {
      setCreatingTag(false)
    }
  }

  const toggleShowTag = async (showId) => {
    if (!selectedTag || toggling.has(showId)) return
    setToggling(prev => new Set(prev).add(showId))

    const hasTag = tagShows.includes(showId)
    try {
      if (hasTag) {
        // Remove
        await supabase
          .from('show_tags')
          .delete()
          .eq('show_id', showId)
          .eq('tag_id', selectedTag.id)
        setTagShows(prev => prev.filter(id => id !== showId))
        setTags(prev => prev.map(t =>
          t.id === selectedTag.id ? { ...t, count: Math.max(0, t.count - 1) } : t
        ))
        setSelectedTag(prev => ({ ...prev, count: Math.max(0, prev.count - 1) }))
      } else {
        // Add — upsert to prevent duplicates
        const { error } = await supabase
          .from('show_tags')
          .upsert({ show_id: showId, tag_id: selectedTag.id }, { onConflict: 'show_id,tag_id', ignoreDuplicates: true })
        if (error) throw error
        setTagShows(prev => [...prev, showId])
        setTags(prev => prev.map(t =>
          t.id === selectedTag.id ? { ...t, count: t.count + 1 } : t
        ))
        setSelectedTag(prev => ({ ...prev, count: prev.count + 1 }))
      }
    } catch (e) {
      console.error(e)
    } finally {
      setToggling(prev => { const s = new Set(prev); s.delete(showId); return s })
    }
  }

  const filteredTags = tags.filter(t =>
    !tagSearch || t.name.includes(tagSearch.toLowerCase())
  )

  // Sort: tagged shows first, then rest — filtered by search
  const sortedShows = [...allShows]
    .filter(s => !showSearch || s.title.toLowerCase().includes(showSearch.toLowerCase()))
    .sort((a, b) => {
      const aTagged = tagShows.includes(a.id)
      const bTagged = tagShows.includes(b.id)
      if (aTagged && !bTagged) return -1
      if (!aTagged && bTagged) return 1
      return 0
    })

  const taggedCount = tagShows.length

  const handleEdit = (show) => {
    setSelectedShow(null)
    setEditShow(show)
  }

  return (
    <div className="tags-page">
      <div className="page-header">
        <h1>Tags</h1>
      </div>

      <div className="tags-layout">
        {/* Left: tag list + create */}
        <div className="tags-sidebar card">
          {/* Create new tag */}
          <div className="tags-create-wrap">
            <div className="tags-create-row">
              <input
                className="input tags-create-input"
                placeholder="New tag name..."
                value={newTagInput}
                onChange={e => setNewTagInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && createTag()}
              />
              <button
                className="btn btn-primary btn-sm"
                onClick={createTag}
                disabled={!newTagInput.trim() || creatingTag}
              >
                <Plus size={14} />
              </button>
            </div>
          </div>

          {/* Search existing tags */}
          <div className="tags-search-wrap">
            <Search size={14} className="tags-search-icon" />
            <input
              className="input tags-search-input"
              placeholder="Search tags..."
              value={tagSearch}
              onChange={e => setTagSearch(e.target.value)}
            />
          </div>

          {loadingTags ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
              <div className="loading-spinner" />
            </div>
          ) : filteredTags.length === 0 ? (
            <div className="tags-empty">
              <Tag size={24} />
              <p>{tagSearch ? 'No matching tags' : 'No tags yet'}</p>
            </div>
          ) : (
            <div className="tags-list">
              {filteredTags.map(tag => (
                <button
                  key={tag.id}
                  className={`tag-item ${selectedTag?.id === tag.id ? 'active' : ''}`}
                  onClick={() => selectTag(tag)}
                >
                  <span className="tag-name">#{tag.name}</span>
                  <span className="tag-count mono">{tag.count}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right: show list with toggles */}
        <div className="tags-content">
          {!selectedTag ? (
            <div className="empty-state">
              <span className="empty-state-icon">#</span>
              <h3>Select or create a tag</h3>
              <p>Then toggle shows on or off directly from here.</p>
            </div>
          ) : (
            <>
              <div className="tag-content-header">
                <div>
                  <h2 className="tag-content-heading">
                    #{selectedTag.name}
                    <span className="mono tag-content-count">{taggedCount} shows</span>
                  </h2>
                  <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                    Tagged shows appear first. Click to toggle.
                  </p>
                </div>
                <div className="tags-show-search-wrap">
                  <Search size={14} className="tags-search-icon" />
                  <input
                    className="input tags-search-input"
                    placeholder="Filter shows..."
                    value={showSearch}
                    onChange={e => setShowSearch(e.target.value)}
                  />
                </div>
              </div>

              {loadingShows ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
                  <div className="loading-spinner" />
                </div>
              ) : (
                <div className="tag-shows-list">
                  {sortedShows.map(show => {
                    const isTagged = tagShows.includes(show.id)
                    const isToggling = toggling.has(show.id)
                    const posterUrl = tmdb.posterUrl(show.poster_path, 'w92')
                    const year = show.first_air_date?.slice(0, 4)

                    return (
                      <div
                        key={show.id}
                        className={`tag-show-row ${isTagged ? 'tagged' : ''}`}
                        onClick={() => !isToggling && toggleShowTag(show.id)}
                      >
                        <div className="tag-show-toggle">
                          {isToggling ? (
                            <div className="loading-spinner" style={{ width: 18, height: 18 }} />
                          ) : isTagged ? (
                            <div className="toggle-on"><Check size={12} /></div>
                          ) : (
                            <div className="toggle-off"><Plus size={12} /></div>
                          )}
                        </div>
                        <div className="tag-show-poster">
                          {posterUrl
                            ? <img src={posterUrl} alt={show.title} />
                            : <span>📺</span>
                          }
                        </div>
                        <div className="tag-show-info">
                          <span className="tag-show-title">{show.title}</span>
                          <span className="tag-show-meta mono">
                            {year}{show.original_language && ` · ${show.original_language.toUpperCase()}`}
                            {show.rating && ` · ${show.rating}/10`}
                          </span>
                        </div>
                        <div className={`tag-show-status-badge badge ${
                          show.watch_status === 'completed' ? 'badge-green' :
                          show.watch_status === 'dropped' ? 'badge-red' : 'badge-muted'
                        }`}>
                          {show.watch_status === 'completed' ? 'Completed' :
                           show.watch_status === 'dropped' ? 'Dropped' : 'No Source'}
                        </div>
                      </div>
                    )
                  })}
                  {sortedShows.length === 0 && (
                    <div className="empty-state">
                      <span className="empty-state-icon">🔍</span>
                      <h3>No shows match</h3>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

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
          onSuccess={() => { setEditShow(null); selectedTag && selectTag(selectedTag) }}
        />
      )}
    </div>
  )
}
