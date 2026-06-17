import { useState, useEffect } from 'react'
import { Tag, Search } from 'lucide-react'
import { tagsApi } from '../lib/db'
import { supabase } from '../lib/supabase'
import ShowCard from '../components/shows/ShowCard'
import ShowDetailSidebar from '../components/shows/ShowDetailSidebar'
import LogShowModal from '../components/shows/LogShowModal'
import './Tags.css'

export default function Tags() {
  const [tags, setTags] = useState([])
  const [selectedTag, setSelectedTag] = useState(null)
  const [tagShows, setTagShows] = useState([])
  const [loadingTags, setLoadingTags] = useState(true)
  const [loadingShows, setLoadingShows] = useState(false)
  const [tagSearch, setTagSearch] = useState('')
  const [selectedShow, setSelectedShow] = useState(null)
  const [editShow, setEditShow] = useState(null)

  useEffect(() => {
    const load = async () => {
      setLoadingTags(true)
      try {
        // Get tags with counts
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
        setTags(Object.values(counts).sort((a, b) => b.count - a.count))
      } catch (e) {
        console.error(e)
      } finally {
        setLoadingTags(false)
      }
    }
    load()
  }, [])

  const selectTag = async (tag) => {
    setSelectedTag(tag)
    setLoadingShows(true)
    try {
      const { data, error } = await supabase
        .from('show_tags')
        .select('shows_with_logs(*)')
        .eq('tag_id', tag.id)
      if (error) throw error
      setTagShows(data.map(d => d.shows_with_logs).filter(Boolean))
    } catch (e) {
      console.error(e)
    } finally {
      setLoadingShows(false)
    }
  }

  const filteredTags = tags.filter(t =>
    !tagSearch || t.name.includes(tagSearch.toLowerCase())
  )

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
        {/* Tag list */}
        <div className="tags-sidebar card">
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
              <p>No tags yet</p>
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

        {/* Shows for selected tag */}
        <div className="tags-content">
          {!selectedTag ? (
            <div className="empty-state" style={{ height: '100%' }}>
              <span className="empty-state-icon">#</span>
              <h3>Select a tag</h3>
              <p>Choose a tag to see all shows with that label.</p>
            </div>
          ) : loadingShows ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
              <div className="loading-spinner" />
            </div>
          ) : (
            <>
              <h2 className="tag-content-heading">
                #{selectedTag.name}
                <span className="mono" style={{ color: 'var(--text-muted)', fontSize: '1rem', marginLeft: '0.5rem' }}>
                  {tagShows.length}
                </span>
              </h2>
              <div className="shows-grid">
                {tagShows.map(show => (
                  <ShowCard
                    key={show.id}
                    show={show}
                    onClick={() => setSelectedShow(show)}
                  />
                ))}
              </div>
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
