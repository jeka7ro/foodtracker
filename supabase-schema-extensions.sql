-- ============================================
-- AGGREGATOR AGENT MODULE - SCHEMA EXTENSIONS
-- ============================================
-- Run this in Supabase SQL Editor after the base schema

-- ============================================
-- PRODUCT & CATEGORY STOP TRACKING
-- ============================================

CREATE TABLE product_stops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  check_id UUID REFERENCES monitoring_checks(id) ON DELETE SET NULL,

  product_name TEXT NOT NULL,
  category TEXT,
  iiko_product_id TEXT,

  -- Lifecycle
  stopped_at TIMESTAMPTZ DEFAULT NOW(),
  resumed_at TIMESTAMPTZ,
  duration_minutes INTEGER,

  -- Authorization
  is_authorized BOOLEAN DEFAULT false,
  authorized_by TEXT,
  authorization_reason TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_product_stops_restaurant ON product_stops(restaurant_id);
CREATE INDEX idx_product_stops_platform ON product_stops(platform);
CREATE INDEX idx_product_stops_stopped_at ON product_stops(stopped_at DESC);
CREATE INDEX idx_product_stops_active ON product_stops(restaurant_id, platform) WHERE resumed_at IS NULL;

-- ============================================
-- DELIVERY RADIUS HISTORY
-- ============================================

CREATE TABLE radius_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,

  radius_km DECIMAL(5,2) NOT NULL,
  previous_radius_km DECIMAL(5,2),
  normal_radius_km DECIMAL(5,2),

  change_type TEXT NOT NULL DEFAULT 'no_change', -- 'increase', 'decrease', 'no_change', 'initial'
  change_percent DECIMAL(5,2), -- percentage change from normal

  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_radius_history_restaurant ON radius_history(restaurant_id);
CREATE INDEX idx_radius_history_recorded ON radius_history(recorded_at DESC);
CREATE INDEX idx_radius_history_platform ON radius_history(restaurant_id, platform, recorded_at DESC);

-- ============================================
-- LISTING POSITION HISTORY
-- ============================================

CREATE TABLE position_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,

  category_name TEXT,         -- e.g., 'sushi', 'japanese', 'all'
  category_position INTEGER,  -- position within the category
  general_position INTEGER,   -- position in general listing

  -- Competitors snapshot (top 5 nearby)
  competitors JSONB DEFAULT '[]',

  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_position_history_restaurant ON position_history(restaurant_id);
CREATE INDEX idx_position_history_recorded ON position_history(recorded_at DESC);

-- ============================================
-- RATING EVOLUTION HISTORY
-- ============================================

CREATE TABLE rating_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,

  rating DECIMAL(4,2),
  previous_rating DECIMAL(4,2),
  review_count INTEGER,
  previous_review_count INTEGER,

  change_direction TEXT, -- 'up', 'down', 'stable'

  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_rating_history_restaurant ON rating_history(restaurant_id);
CREATE INDEX idx_rating_history_recorded ON rating_history(recorded_at DESC);
CREATE INDEX idx_rating_history_platform ON rating_history(restaurant_id, platform, recorded_at DESC);

-- ============================================
-- EXTEND RESTAURANTS TABLE
-- ============================================

ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS revenue_per_hour DECIMAL(10,2) DEFAULT 100.00;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS iiko_restaurant_id TEXT;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS iiko_config JSONB DEFAULT '{}';
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS allowed_stop_categories TEXT[] DEFAULT '{}';
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS max_stop_percent INTEGER DEFAULT 30;

-- ============================================
-- EXTEND STOP_EVENTS TABLE
-- ============================================

ALTER TABLE stop_events ADD COLUMN IF NOT EXISTS stop_type TEXT DEFAULT 'full'; -- 'full', 'partial', 'category'
ALTER TABLE stop_events ADD COLUMN IF NOT EXISTS affected_categories TEXT[] DEFAULT '{}';
ALTER TABLE stop_events ADD COLUMN IF NOT EXISTS affected_product_count INTEGER DEFAULT 0;
ALTER TABLE stop_events ADD COLUMN IF NOT EXISTS total_product_count INTEGER DEFAULT 0;
ALTER TABLE stop_events ADD COLUMN IF NOT EXISTS is_authorized BOOLEAN DEFAULT false;

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE product_stops ENABLE ROW LEVEL SECURITY;
ALTER TABLE radius_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE position_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE rating_history ENABLE ROW LEVEL SECURITY;

-- Policies: authenticated users with restaurant access
CREATE POLICY "Users see their product_stops" ON product_stops
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      JOIN restaurants r ON r.id = product_stops.restaurant_id
      WHERE up.id = auth.uid()
      AND (
        up.role = 'network_admin'
        OR r.id = ANY(up.assigned_restaurant_ids)
        OR r.brand_id = ANY(up.assigned_brand_ids)
      )
    )
  );

CREATE POLICY "Users see their radius_history" ON radius_history
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      JOIN restaurants r ON r.id = radius_history.restaurant_id
      WHERE up.id = auth.uid()
      AND (
        up.role = 'network_admin'
        OR r.id = ANY(up.assigned_restaurant_ids)
        OR r.brand_id = ANY(up.assigned_brand_ids)
      )
    )
  );

CREATE POLICY "Users see their position_history" ON position_history
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      JOIN restaurants r ON r.id = position_history.restaurant_id
      WHERE up.id = auth.uid()
      AND (
        up.role = 'network_admin'
        OR r.id = ANY(up.assigned_restaurant_ids)
        OR r.brand_id = ANY(up.assigned_brand_ids)
      )
    )
  );

CREATE POLICY "Users see their rating_history" ON rating_history
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      JOIN restaurants r ON r.id = rating_history.restaurant_id
      WHERE up.id = auth.uid()
      AND (
        up.role = 'network_admin'
        OR r.id = ANY(up.assigned_restaurant_ids)
        OR r.brand_id = ANY(up.assigned_brand_ids)
      )
    )
  );

-- ============================================
-- USEFUL VIEWS
-- ============================================

-- Active stops (not yet resolved)
CREATE OR REPLACE VIEW active_stops AS
SELECT
  se.id,
  se.restaurant_id,
  r.name AS restaurant_name,
  r.city,
  se.platform,
  se.stopped_at,
  EXTRACT(EPOCH FROM (NOW() - se.stopped_at)) / 60 AS duration_minutes,
  r.revenue_per_hour,
  (EXTRACT(EPOCH FROM (NOW() - se.stopped_at)) / 3600) * COALESCE(r.revenue_per_hour, 100) AS estimated_loss,
  se.stop_type,
  se.affected_categories,
  se.is_authorized
FROM stop_events se
JOIN restaurants r ON r.id = se.restaurant_id
WHERE se.resumed_at IS NULL;

-- Latest radius per restaurant/platform
CREATE OR REPLACE VIEW latest_radius AS
SELECT DISTINCT ON (restaurant_id, platform)
  rh.id,
  rh.restaurant_id,
  r.name AS restaurant_name,
  rh.platform,
  rh.radius_km,
  rh.normal_radius_km,
  rh.change_type,
  rh.change_percent,
  rh.recorded_at
FROM radius_history rh
JOIN restaurants r ON r.id = rh.restaurant_id
ORDER BY restaurant_id, platform, recorded_at DESC;

-- Latest rating per restaurant/platform
CREATE OR REPLACE VIEW latest_rating AS
SELECT DISTINCT ON (restaurant_id, platform)
  rh.id,
  rh.restaurant_id,
  r.name AS restaurant_name,
  rh.platform,
  rh.rating,
  rh.review_count,
  rh.change_direction,
  rh.recorded_at
FROM rating_history rh
JOIN restaurants r ON r.id = rh.restaurant_id
ORDER BY restaurant_id, platform, recorded_at DESC;
