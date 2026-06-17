import { useState, useEffect, useRef, useCallback } from 'react'
import ForceGraph2D from 'react-force-graph-2d'
import { Search, X, Globe, Tag } from 'lucide-react'
import { showsApi, similarityApi } from '../lib/db'
import { tmdb } from '../lib/tmdb'
import ShowDetailSidebar from '../components/shows/ShowDetailSidebar'
import LogShowModal from '../components/shows/LogShowModal'
import './ShowMap.css'

// Genre → color mapping (blues + accents from brand)
const GENRE_COLORS = {
  'Crime': '#355C93',
  'Thriller': '#4A7BC4',
  'Drama': '#243B63',
  'Comedy': '#5C8EE6',
  'Sci-Fi & Fantasy': '#7B68EE',
  'Action & Adventure': '#4169E1',
  'Mystery': '#2E4A8A',
  'Documentary': '#6B8FBF',
  'Animation': '#87CEEB',
  'Horror': '#1A2F5A',
  'Romance': '#6B9FE4',
  'History': '#3A5F8A',
  'War & Politics': '#2B4F7A',
  'Family': '#7AAFDF',
  'default': '#355C93',
}

// Country → color mapping
const COUNTRY_COLORS = {
  US: '#5C8EE6',
  GB: '#4A7BC4',
  KR: '#E84393',
  JP: '#FF6B6B',
  FR: '#7B68EE',
  DE: '#FFD700',
  IT: '#32CD32',
  ES: '#FF8C00',
  AU: '#00CED1',
  CA: '#FF4444',
  IN: '#FF9933',
  default: '#355C93',
}

export default function ShowMap() {
  const [graphData, setGraphData] = useState({ nodes: [], links: [] })
  const [loading, setLoading] = useState(true)
  const [colorMode, setColorMode] = useState('genre') // 'genre' | 'country'
  const [search, setSearch] = useState('')
  const [highlightedNode, setHighlightedNode] = useState(null)
  const [selectedShow, setSelectedShow] = useState(null)
  const [editShow, setEditShow] = useState(null)
  const graphRef = useRef()

  const load = async () => {
    setLoading(true)
    try {
      const [shows, links] = await Promise.all([
        showsApi.getAllForGraph(),
        similarityApi.getAllLinks(),
      ])

      const nodes = shows.map(show => ({
        id: show.id,
        label: show.title,
        poster: show.poster_path,
        genres: show.genres || [],
        country: (show.origin_country || [])[0] || 'default',
        data: show,
        val: 1,
      }))

      // Count connections per node
      const connectionCount = {}
      links.forEach(link => {
        connectionCount[link.show_a_id] = (connectionCount[link.show_a_id] || 0) + 1
        connectionCount[link.show_b_id] = (connectionCount[link.show_b_id] || 0) + 1
      })

      // Scale node size by connections
      nodes.forEach(node => {
        node.val = 1 + (connectionCount[node.id] || 0) * 0.5
      })

      const validNodeIds = new Set(nodes.map(n => n.id))
      const validLinks = links
        .filter(l => validNodeIds.has(l.show_a_id) && validNodeIds.has(l.show_b_id))
        .map(l => ({
          source: l.show_a_id,
          target: l.show_b_id,
          explanation: l.explanation,
        }))

      setGraphData({ nodes, links: validLinks })
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const getNodeColor = useCallback((node) => {
    if (highlightedNode && node.id !== highlightedNode) {
      return 'rgba(92, 142, 230, 0.15)'
    }
    if (colorMode === 'genre') {
      const primaryGenre = node.genres?.[0]?.name
      return GENRE_COLORS[primaryGenre] || GENRE_COLORS.default
    } else {
      return COUNTRY_COLORS[node.country] || COUNTRY_COLORS.default
    }
  }, [colorMode, highlightedNode])

  const getLinkColor = useCallback((link) => {
    if (highlightedNode) {
      const isConnected =
        link.source.id === highlightedNode || link.target.id === highlightedNode ||
        link.source === highlightedNode || link.target === highlightedNode
      return isConnected ? 'rgba(92, 142, 230, 0.6)' : 'rgba(92, 142, 230, 0.05)'
    }
    return 'rgba(92, 142, 230, 0.25)'
  }, [highlightedNode])

  const handleSearch = (val) => {
    setSearch(val)
    if (!val.trim()) {
      setHighlightedNode(null)
      return
    }
    const match = graphData.nodes.find(n =>
      n.label.toLowerCase().includes(val.toLowerCase())
    )
    if (match) {
      setHighlightedNode(match.id)
      graphRef.current?.centerAt(match.x, match.y, 800)
      graphRef.current?.zoom(3, 800)
    }
  }

  const clearSearch = () => {
    setSearch('')
    setHighlightedNode(null)
    graphRef.current?.zoomToFit(600, 60)
  }

  const handleNodeClick = (node) => {
    setSelectedShow(node.data)
  }

  const handleEdit = (show) => {
    setSelectedShow(null)
    setEditShow(show)
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
          <div className="loading-spinner" style={{ width: 32, height: 32 }} />
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Building your show map...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="map-page">
      {/* Controls */}
      <div className="map-controls">
        <div className="map-search-wrap">
          <Search size={14} className="map-search-icon" />
          <input
            className="input map-search"
            placeholder="Search a show to zoom in..."
            value={search}
            onChange={e => handleSearch(e.target.value)}
          />
          {search && (
            <button className="btn btn-ghost btn-sm map-search-clear" onClick={clearSearch}>
              <X size={13} />
            </button>
          )}
        </div>

        <div className="map-color-toggle">
          <button
            className={`btn btn-sm ${colorMode === 'genre' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setColorMode('genre')}
          >
            <Tag size={13} /> Genre
          </button>
          <button
            className={`btn btn-sm ${colorMode === 'country' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setColorMode('country')}
          >
            <Globe size={13} /> Country
          </button>
        </div>

        <span className="map-count mono">
          {graphData.nodes.length} shows · {graphData.links.length} links
        </span>
      </div>

      {/* Graph */}
      {graphData.nodes.length === 0 ? (
        <div className="empty-state" style={{ height: '60vh' }}>
          <span className="empty-state-icon">🕸️</span>
          <h3>No shows mapped yet</h3>
          <p>Log shows and add similarity links to build your map.</p>
        </div>
      ) : (
        <div className="map-canvas">
          <ForceGraph2D
            ref={graphRef}
            graphData={graphData}
            nodeLabel="label"
            nodeColor={getNodeColor}
            nodeRelSize={6}
            nodeVal={node => node.val}
            linkColor={getLinkColor}
            linkWidth={1.5}
            backgroundColor="#0B0B0B"
            onNodeClick={handleNodeClick}
            nodeCanvasObject={(node, ctx, globalScale) => {
              const label = node.label
              const fontSize = Math.max(10 / globalScale, 3)
              const r = Math.sqrt(node.val) * 6

              // Node circle
              ctx.beginPath()
              ctx.arc(node.x, node.y, r, 0, 2 * Math.PI)
              ctx.fillStyle = getNodeColor(node)
              ctx.fill()

              // Highlight ring
              if (node.id === highlightedNode) {
                ctx.beginPath()
                ctx.arc(node.x, node.y, r + 2, 0, 2 * Math.PI)
                ctx.strokeStyle = '#5C8EE6'
                ctx.lineWidth = 1.5
                ctx.stroke()
              }

              // Label (only at sufficient zoom)
              if (globalScale > 1.5) {
                ctx.font = `${fontSize}px Inter, sans-serif`
                ctx.textAlign = 'center'
                ctx.textBaseline = 'top'
                ctx.fillStyle = node.id === highlightedNode
                  ? '#F2F2F2'
                  : 'rgba(242,242,242,0.6)'
                ctx.fillText(label, node.x, node.y + r + 2)
              }
            }}
            cooldownTicks={100}
            onEngineStop={() => graphRef.current?.zoomToFit(400, 60)}
          />
        </div>
      )}

      {/* Legend */}
      {graphData.nodes.length > 0 && (
        <div className="map-legend card">
          <div className="map-legend-title">
            {colorMode === 'genre' ? 'Genre' : 'Country'}
          </div>
          <div className="map-legend-items">
            {colorMode === 'genre'
              ? Object.entries(GENRE_COLORS).filter(([k]) => k !== 'default').slice(0, 8).map(([genre, color]) => (
                  <div key={genre} className="legend-item">
                    <div className="legend-dot" style={{ background: color }} />
                    <span>{genre}</span>
                  </div>
                ))
              : Object.entries(COUNTRY_COLORS).filter(([k]) => k !== 'default').map(([code, color]) => (
                  <div key={code} className="legend-item">
                    <div className="legend-dot" style={{ background: color }} />
                    <span>{code}</span>
                  </div>
                ))
            }
          </div>
        </div>
      )}

      {/* Detail sidebar */}
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
          onSuccess={() => { load(); setEditShow(null) }}
        />
      )}
    </div>
  )
}
