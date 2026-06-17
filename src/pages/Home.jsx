import { useState, useEffect } from 'react'
import { Plus, TrendingUp } from 'lucide-react'
import { useAuth } from '../lib/auth'
import PasswordModal from '../components/ui/PasswordModal'
import { showsApi } from '../lib/db'
import ShowCard from '../components/shows/ShowCard'
import ShowDetailSidebar from '../components/shows/ShowDetailSidebar'
import LogShowModal from '../components/shows/LogShowModal'
import './Home.css'

export default function Home() {
  const [recentShows, setRecentShows] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedShow, setSelectedShow] = useState(null)
  const [showLogModal, setShowLogModal] = useState(false)
  const [editShow, setEditShow] = useState(null)
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const { isAuthenticated } = useAuth()

  const load = async () => {
    setLoading(true)
    try {
      const data = await showsApi.getAllWithLogs()
      setRecentShows(data.slice(0, 12))
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const handleEdit = (show) => {
    setSelectedShow(null)
    setEditShow(show)
  }

  return (
    <div className="home-page">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1>Good Shows. Great Stories.</h1>
          <p style={{ marginTop: '0.25rem', fontSize: '0.9rem' }}>
            Your personal TV archive.
          </p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => isAuthenticated ? setShowLogModal(true) : setShowPasswordModal(true)}
        >
          <Plus size={16} /> Log a Show
        </button>
      </div>

      {/* Recently logged */}
      <section>
        <div className="section-heading">
          <TrendingUp size={16} />
          <h3>Recently Logged</h3>
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
            <div className="loading-spinner" />
          </div>
        ) : recentShows.length === 0 ? (
          <div className="empty-state">
            <span className="empty-state-icon">📺</span>
            <h3>No shows logged yet</h3>
            <p>Start building your TV archive.</p>
            <button
              className="btn btn-primary"
              onClick={() => isAuthenticated ? setShowLogModal(true) : setShowPasswordModal(true)}
            >
              <Plus size={16} /> Log your first show
            </button>
          </div>
        ) : (
          <div className="shows-grid">
            {recentShows.map(show => (
              <ShowCard
                key={show.id}
                show={show}
                onClick={() => setSelectedShow(show)}
              />
            ))}
          </div>
        )}
      </section>

      {/* Detail sidebar */}
      {selectedShow && (
        <ShowDetailSidebar
          show={selectedShow}
          onClose={() => setSelectedShow(null)}
          onEdit={handleEdit}
        />
      )}

      {/* Password modal */}
      {showPasswordModal && (
        <PasswordModal
          onClose={() => setShowPasswordModal(false)}
          onSuccess={() => { setShowPasswordModal(false); setShowLogModal(true) }}
        />
      )}

      {/* Log modal */}
      {(showLogModal || editShow) && (
        <LogShowModal
          editShow={editShow}
          onClose={() => { setShowLogModal(false); setEditShow(null) }}
          onSuccess={() => { load(); setShowLogModal(false); setEditShow(null) }}
        />
      )}
    </div>
  )
}
