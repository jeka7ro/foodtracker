-- ==============================================
-- REPUTATION MANAGEMENT SCHEMA
-- MVP Phase 1 (Database)
-- ==============================================

-- 1. Locations managed by Reputation module
CREATE TABLE IF NOT EXISTS reputation_locations (
  id uuid primary key default gen_random_uuid(),
  brand_id text not null,
  platform text not null, -- 'google', 'facebook', 'wolt', 'glovo', 'bolt', 'tripadvisor'
  external_id text, -- e.g. Google Place ID
  name text not null,
  url text, -- Direct link to the listing/store
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- 2. Scraped/Synced Reviews
CREATE TABLE IF NOT EXISTS reputation_reviews (
  id uuid primary key default gen_random_uuid(),
  external_review_id text,
  brand_id text not null,
  location_id uuid references reputation_locations(id) on delete cascade,
  platform text not null,
  rating integer not null check (rating >= 1 and rating <= 5),
  author_name text,
  author_avatar text,
  text text,
  sentiment text check (sentiment in ('positive', 'neutral', 'negative')),
  published_at timestamp with time zone,
  replied boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()),
  UNIQUE(platform, external_review_id)
);

-- Row Level Security (RLS) Settings
ALTER TABLE reputation_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE reputation_reviews ENABLE ROW LEVEL SECURITY;

-- Allow standard read-access to the tables for authenticated / anon users connecting from the App
CREATE POLICY "Allow select on reputation_locations public" ON reputation_locations FOR SELECT TO public USING (true);
CREATE POLICY "Allow select on reputation_reviews public" ON reputation_reviews FOR SELECT TO public USING (true);

CREATE POLICY "Allow select on reputation_locations anon" ON reputation_locations FOR SELECT TO anon USING (true);
CREATE POLICY "Allow select on reputation_reviews anon" ON reputation_reviews FOR SELECT TO anon USING (true);
