import { supabase } from './supabase'

// ─── SHOWS ───────────────────────────────────────────────────────────────────

export const showsApi = {
  // Upsert show from TMDB data
  upsertShow: async (tmdbShow) => {
    const { data, error } = await supabase
      .from('shows')
      .upsert({
        tmdb_id: tmdbShow.id,
        title: tmdbShow.name,
        poster_path: tmdbShow.poster_path,
        backdrop_path: tmdbShow.backdrop_path,
        overview: tmdbShow.overview,
        first_air_date: tmdbShow.first_air_date,
        last_air_date: tmdbShow.last_air_date,
        genres: tmdbShow.genres || [],
        networks: tmdbShow.networks || [],
        origin_country: tmdbShow.origin_country || [],
        original_language: tmdbShow.original_language,
        number_of_episodes: tmdbShow.number_of_episodes,
        number_of_seasons: tmdbShow.number_of_seasons,
        tmdb_rating: tmdbShow.vote_average,
        status: tmdbShow.status,
      }, { onConflict: 'tmdb_id' })
      .select()
      .single()
    if (error) throw error
    return data
  },

  // Get all shows with watch logs
  getAllWithLogs: async (filters = {}) => {
    let query = supabase
      .from('shows_with_logs')
      .select('*')
      .not('watch_status', 'is', null)

    if (filters.status) query = query.eq('watch_status', filters.status)
    if (filters.language) query = query.eq('original_language', filters.language)
    if (filters.ratingMin) query = query.gte('rating', filters.ratingMin)
    if (filters.ratingMax) query = query.lte('rating', filters.ratingMax)
    if (filters.genre) {
      query = query.contains('genres', JSON.stringify([{ name: filters.genre }]))
    }

    query = query.order('date_watched', { ascending: false })

    const { data, error } = await query
    if (error) throw error
    return data
  },

  // Get single show by internal ID
  getById: async (id) => {
    const { data, error } = await supabase
      .from('shows_with_logs')
      .select('*')
      .eq('id', id)
      .single()
    if (error) throw error
    return data
  },

  // Get show by TMDB ID
  getByTmdbId: async (tmdbId) => {
    const { data, error } = await supabase
      .from('shows')
      .select('*')
      .eq('tmdb_id', tmdbId)
      .maybeSingle()
    if (error) throw error
    return data
  },

  // Get all for graph
  getAllForGraph: async () => {
    const { data, error } = await supabase
      .from('shows_with_logs')
      .select('*')
      .not('watch_status', 'is', null)
    if (error) throw error
    return data
  },
}

// ─── WATCH LOGS ──────────────────────────────────────────────────────────────

export const watchLogsApi = {
  upsert: async (showId, logData) => {
    const { data, error } = await supabase
      .from('watch_logs')
      .upsert({ show_id: showId, ...logData }, { onConflict: 'show_id' })
      .select()
      .single()
    if (error) throw error
    return data
  },

  update: async (logId, updates) => {
    const { data, error } = await supabase
      .from('watch_logs')
      .update(updates)
      .eq('id', logId)
      .select()
      .single()
    if (error) throw error
    return data
  },
}

// ─── TAGS ────────────────────────────────────────────────────────────────────

export const tagsApi = {
  getAll: async () => {
    const { data, error } = await supabase
      .from('tags')
      .select('*')
      .order('name')
    if (error) throw error
    return data
  },

  getForShow: async (showId) => {
    const { data, error } = await supabase
      .from('show_tags')
      .select('tags(*)')
      .eq('show_id', showId)
    if (error) throw error
    return data.map(d => d.tags)
  },

  upsertTag: async (name) => {
    const { data, error } = await supabase
      .from('tags')
      .upsert({ name: name.toLowerCase().trim() }, { onConflict: 'name' })
      .select()
      .single()
    if (error) throw error
    return data
  },

  setShowTags: async (showId, tagNames) => {
    // Delete existing
    await supabase.from('show_tags').delete().eq('show_id', showId)
    if (!tagNames.length) return

    // Upsert all tags
    const tags = await Promise.all(tagNames.map(tagsApi.upsertTag))

    // Insert junctions
    const { error } = await supabase.from('show_tags').insert(
      tags.map(tag => ({ show_id: showId, tag_id: tag.id }))
    )
    if (error) throw error
  },

  searchShows: async (tagName) => {
    const { data, error } = await supabase
      .from('show_tags')
      .select('show_id, tags!inner(name), shows_with_logs(*)')
      .eq('tags.name', tagName.toLowerCase().trim())
    if (error) throw error
    return data
  },
}

// ─── SIMILARITY LINKS ────────────────────────────────────────────────────────

export const similarityApi = {
  getForShow: async (showId) => {
    const { data, error } = await supabase
      .from('similarity_links')
      .select(`
        *,
        show_a:show_a_id(*, watch_logs(*)),
        show_b:show_b_id(*, watch_logs(*))
      `)
      .or(`show_a_id.eq.${showId},show_b_id.eq.${showId}`)
    if (error) throw error
    return data
  },

  getAllLinks: async () => {
    const { data, error } = await supabase
      .from('similarity_links')
      .select('*')
    if (error) throw error
    return data
  },

  addLink: async (showAId, showBId, explanation) => {
    const { data, error } = await supabase
      .from('similarity_links')
      .insert({ show_a_id: showAId, show_b_id: showBId, explanation })
      .select()
      .single()
    if (error) throw error
    return data
  },

  updateLink: async (linkId, explanation) => {
    const { data, error } = await supabase
      .from('similarity_links')
      .update({ explanation })
      .eq('id', linkId)
      .select()
      .single()
    if (error) throw error
    return data
  },

  deleteLink: async (linkId) => {
    const { error } = await supabase
      .from('similarity_links')
      .delete()
      .eq('id', linkId)
    if (error) throw error
  },
}

// ─── STATS ───────────────────────────────────────────────────────────────────

export const statsApi = {
  getSummary: async () => {
    const { data, error } = await supabase
      .from('shows_with_logs')
      .select('*')
      .not('watch_status', 'is', null)
    if (error) throw error

    const completed = data.filter(s => s.watch_status === 'completed')
    const dropped = data.filter(s => s.watch_status === 'dropped')
    const noSource = data.filter(s => s.watch_status === 'no_source')
    const rated = completed.filter(s => s.rating)

    const totalEpisodes = completed.reduce((sum, s) => sum + (s.number_of_episodes || 0), 0)
    const avgRating = rated.length
      ? (rated.reduce((sum, s) => sum + s.rating, 0) / rated.length).toFixed(1)
      : null

    // Genre breakdown
    const genreCounts = {}
    completed.forEach(s => {
      (s.genres || []).forEach(g => {
        genreCounts[g.name] = (genreCounts[g.name] || 0) + 1
      })
    })
    const topGenres = Object.entries(genreCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)

    // Language breakdown
    const langCounts = {}
    data.forEach(s => {
      if (s.original_language) {
        langCounts[s.original_language] = (langCounts[s.original_language] || 0) + 1
      }
    })

    // Country breakdown
    const countryCounts = {}
    data.forEach(s => {
      (s.origin_country || []).forEach(c => {
        countryCounts[c] = (countryCounts[c] || 0) + 1
      })
    })

    // This year — exclude shows marked as watched before tracking
    const thisYear = new Date().getFullYear()
    const watchedThisYear = data.filter(s => {
      if (s.watched_before_tracking) return false
      const dateToCheck = s.date_watched_override || s.date_watched
      if (!dateToCheck) return false
      return new Date(dateToCheck).getFullYear() === thisYear
    }).length

    return {
      total: data.length,
      completed: completed.length,
      dropped: dropped.length,
      noSource: noSource.length,
      totalEpisodes,
      avgRating,
      topGenres,
      langCounts,
      countryCounts,
      watchedThisYear,
    }
  },
}
