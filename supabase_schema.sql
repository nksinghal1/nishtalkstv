-- ============================================
-- NISH TALKS TV - Supabase Schema
-- Run this in your Supabase SQL Editor
-- ============================================

-- Shows table: TMDB data + your metadata
CREATE TABLE shows (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tmdb_id INTEGER UNIQUE NOT NULL,
  title TEXT NOT NULL,
  poster_path TEXT,
  backdrop_path TEXT,
  overview TEXT,
  first_air_date TEXT,
  last_air_date TEXT,
  genres JSONB DEFAULT '[]',
  networks JSONB DEFAULT '[]',
  origin_country TEXT[],
  original_language TEXT,
  number_of_episodes INTEGER,
  number_of_seasons INTEGER,
  tmdb_rating NUMERIC(3,1),
  status TEXT, -- 'Returning Series', 'Ended', etc.
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Watch logs: your personal data per show
CREATE TABLE watch_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  show_id UUID REFERENCES shows(id) ON DELETE CASCADE,
  watch_status TEXT NOT NULL CHECK (watch_status IN ('completed', 'dropped', 'no_source')),
  rating INTEGER CHECK (rating >= 1 AND rating <= 10),
  review TEXT,
  drop_reason TEXT,
  date_watched TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(show_id)
);

-- Tags: custom labels you apply to shows
CREATE TABLE tags (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Show <-> Tag junction
CREATE TABLE show_tags (
  show_id UUID REFERENCES shows(id) ON DELETE CASCADE,
  tag_id UUID REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (show_id, tag_id)
);

-- Similarity links: bidirectional relationship between two shows
CREATE TABLE similarity_links (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  show_a_id UUID REFERENCES shows(id) ON DELETE CASCADE,
  show_b_id UUID REFERENCES shows(id) ON DELETE CASCADE,
  explanation TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  -- Enforce that A < B by tmdb_id ordering to prevent duplicates
  UNIQUE(show_a_id, show_b_id),
  CHECK (show_a_id != show_b_id)
);

-- ============================================
-- INDEXES for fast filtering/search
-- ============================================
CREATE INDEX idx_shows_tmdb_id ON shows(tmdb_id);
CREATE INDEX idx_shows_original_language ON shows(original_language);
CREATE INDEX idx_shows_origin_country ON shows USING GIN(origin_country);
CREATE INDEX idx_shows_genres ON shows USING GIN(genres);
CREATE INDEX idx_watch_logs_status ON watch_logs(watch_status);
CREATE INDEX idx_watch_logs_rating ON watch_logs(rating);
CREATE INDEX idx_watch_logs_date ON watch_logs(date_watched);
CREATE INDEX idx_similarity_show_a ON similarity_links(show_a_id);
CREATE INDEX idx_similarity_show_b ON similarity_links(show_b_id);

-- ============================================
-- FUNCTION: auto-update updated_at timestamps
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER shows_updated_at BEFORE UPDATE ON shows
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER watch_logs_updated_at BEFORE UPDATE ON watch_logs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER similarity_links_updated_at BEFORE UPDATE ON similarity_links
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- VIEW: shows with their watch log joined
-- Useful for library queries
-- ============================================
CREATE VIEW shows_with_logs AS
SELECT
  s.*,
  wl.watch_status,
  wl.rating,
  wl.review,
  wl.drop_reason,
  wl.date_watched,
  wl.id as log_id
FROM shows s
LEFT JOIN watch_logs wl ON s.id = wl.show_id;
