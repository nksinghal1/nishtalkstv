const TMDB_BASE = 'https://api.themoviedb.org/3'
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p'
const API_KEY = import.meta.env.VITE_TMDB_API_KEY

const tmdbFetch = async (endpoint, params = {}) => {
  const url = new URL(`${TMDB_BASE}${endpoint}`)
  url.searchParams.set('api_key', API_KEY)
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  const res = await fetch(url.toString())
  if (!res.ok) throw new Error(`TMDB error: ${res.status}`)
  return res.json()
}

export const tmdb = {
  // Search shows by name
  searchShows: (query) =>
    tmdbFetch('/search/tv', { query, include_adult: false }),

  // Get full show details
  getShow: (tmdbId) =>
    tmdbFetch(`/tv/${tmdbId}`, { append_to_response: 'credits,external_ids' }),

  // Get image URL
  posterUrl: (path, size = 'w342') =>
    path ? `${TMDB_IMAGE_BASE}/${size}${path}` : null,

  backdropUrl: (path, size = 'w1280') =>
    path ? `${TMDB_IMAGE_BASE}/${size}${path}` : null,

  // Get shows similar to a given show (TMDB's own suggestions - for discovery)
  getSimilar: (tmdbId) =>
    tmdbFetch(`/tv/${tmdbId}/similar`),

  // Discover shows with filters
  discoverShows: (params = {}) =>
    tmdbFetch('/discover/tv', params),
}

// Rating labels for 1-10 scale
export const RATING_LABELS = {
  10: 'Masterpiece',
  9: 'Excellent',
  8: 'Great',
  7: 'Good',
  6: 'Fine',
  5: 'Average',
  4: 'Below Average',
  3: 'Poor',
  2: 'Bad',
  1: 'Terrible',
}

// Genre icon map
export const GENRE_ICONS = {
  'Crime': '🔪',
  'Thriller': '⚡',
  'Comedy': '😂',
  'Drama': '🎭',
  'Sci-Fi & Fantasy': '🚀',
  'Action & Adventure': '💥',
  'Mystery': '🔍',
  'Documentary': '🎥',
  'Animation': '✏️',
  'Horror': '👻',
  'Romance': '❤️',
  'History': '🏛️',
  'War & Politics': '🏛️',
  'Family': '👨‍👩‍👧',
  'Kids': '🧸',
  'News': '📰',
  'Reality': '📺',
  'Soap': '🫧',
  'Talk': '🎙️',
  'Western': '🤠',
}

// Language display names
export const LANGUAGE_NAMES = {
  en: 'English',
  ko: 'Korean',
  ja: 'Japanese',
  fr: 'French',
  es: 'Spanish',
  de: 'German',
  it: 'Italian',
  pt: 'Portuguese',
  zh: 'Chinese',
  hi: 'Hindi',
  ar: 'Arabic',
  tr: 'Turkish',
  da: 'Danish',
  sv: 'Swedish',
  no: 'Norwegian',
  fi: 'Finnish',
  nl: 'Dutch',
  pl: 'Polish',
  ru: 'Russian',
  th: 'Thai',
  ro: 'Romanian',
  cy: 'Welsh',
  sr: 'Serbian',
  el: 'Greek',
  is: 'Icelandic',
  hu: 'Hungarian',
  lb: 'Luxembourgish',
  cs: 'Czech',
  sk: 'Slovak',
  bg: 'Bulgarian',
  uk: 'Ukrainian',
  he: 'Hebrew',
  fa: 'Persian',
  ur: 'Urdu',
  bn: 'Bengali',
  ta: 'Tamil',
  te: 'Telugu',
  ml: 'Malayalam',
  id: 'Indonesian',
  ms: 'Malay',
  vi: 'Vietnamese',
  ca: 'Catalan',
  eu: 'Basque',
  gl: 'Galician',
  sl: 'Slovenian',
  hr: 'Croatian',
  bs: 'Bosnian',
  mk: 'Macedonian',
  sq: 'Albanian',
  lt: 'Lithuanian',
  lv: 'Latvian',
  et: 'Estonian',
  nb: 'Norwegian Bokmål',
}

export const getLanguageName = (code) =>
  LANGUAGE_NAMES[code] || code?.toUpperCase() || 'Unknown'
