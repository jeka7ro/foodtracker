-- ============================================
-- AGGREGATOR MONITOR - DATABASE SCHEMA
-- ============================================
-- Run this in Supabase SQL Editor after creating your project

-- ============================================
-- BRANDS & RESTAURANTS
-- ============================================

CREATE TABLE brands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  telegram_group_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE restaurants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID REFERENCES brands(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  city TEXT NOT NULL,
  address TEXT,
  
  -- Platform URLs
  glovo_url TEXT,
  wolt_url TEXT,
  bolt_url TEXT,
  
  -- Operating hours (JSON format: {"monday": {"open": "09:00", "close": "22:00"}, ...})
  working_hours JSONB DEFAULT '{}',
  
  -- Normal operating parameters
  normal_radius_km DECIMAL(5,2),
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- MONITORING CHECKS
-- ============================================

CREATE TABLE monitoring_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  platform TEXT NOT NULL, -- 'glovo', 'wolt', 'bolt'
  
  -- Timestamp
  checked_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- UI Status (from customer simulation)
  ui_is_open BOOLEAN,
  ui_can_order BOOLEAN,
  ui_is_greyed BOOLEAN,
  ui_error_message TEXT,
  
  -- Hidden Data Status (from backend inspection)
  backend_is_open BOOLEAN,
  backend_status TEXT,
  
  -- Delivery & Menu
  delivery_radius_km DECIMAL(5,2),
  missing_products JSONB DEFAULT '[]',
  disabled_categories JSONB DEFAULT '[]',
  
  -- Reputation
  rating DECIMAL(3,2),
  review_count INTEGER,
  
  -- Market Position
  category_position INTEGER,
  search_position INTEGER,
  
  -- Validation Result
  final_status TEXT, -- 'available', 'stopped', 'greyed', 'error'
  
  -- Raw data snapshot
  raw_data JSONB,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_monitoring_checks_restaurant ON monitoring_checks(restaurant_id);
CREATE INDEX idx_monitoring_checks_platform ON monitoring_checks(platform);
CREATE INDEX idx_monitoring_checks_checked_at ON monitoring_checks(checked_at DESC);

-- ============================================
-- BUSINESS RULES ENGINE
-- ============================================

CREATE TABLE business_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  brand_id UUID REFERENCES brands(id) ON DELETE CASCADE,
  
  rule_type TEXT NOT NULL, -- 'unauthorized_stop', 'radius_reduction', 'missing_products', etc.
  
  -- Rule configuration (JSON)
  config JSONB NOT NULL,
  
  is_active BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 1, -- 1=critical, 2=warning, 3=info
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- VIOLATIONS & ALERTS
-- ============================================

CREATE TABLE violations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  check_id UUID REFERENCES monitoring_checks(id) ON DELETE CASCADE,
  rule_id UUID REFERENCES business_rules(id) ON DELETE SET NULL,
  
  platform TEXT NOT NULL,
  violation_type TEXT NOT NULL,
  severity TEXT NOT NULL, -- 'critical', 'warning', 'info'
  
  message TEXT NOT NULL,
  details JSONB,
  
  -- Lifecycle
  detected_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  is_resolved BOOLEAN DEFAULT false,
  
  -- Notification
  telegram_sent BOOLEAN DEFAULT false,
  telegram_sent_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_violations_restaurant ON violations(restaurant_id);
CREATE INDEX idx_violations_resolved ON violations(is_resolved);

-- ============================================
-- STOP EVENTS (Aggregated)
-- ============================================

CREATE TABLE stop_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  
  stopped_at TIMESTAMPTZ NOT NULL,
  resumed_at TIMESTAMPTZ,
  
  duration_minutes INTEGER,
  reason TEXT,
  
  -- Financial impact
  estimated_loss_amount DECIMAL(10,2),
  loss_calculation_config JSONB,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- MONITORING CONFIGURATION
-- ============================================

CREATE TABLE monitoring_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  
  check_interval_minutes INTEGER DEFAULT 5,
  is_enabled BOOLEAN DEFAULT true,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(restaurant_id, platform)
);

-- ============================================
-- USER ROLES & PERMISSIONS
-- ============================================

CREATE TABLE user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  role TEXT NOT NULL, -- 'network_admin', 'restaurant_manager'
  
  -- For restaurant managers
  assigned_restaurant_ids UUID[] DEFAULT '{}',
  assigned_brand_ids UUID[] DEFAULT '{}',
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- TELEGRAM CONFIGURATION
-- ============================================

CREATE TABLE telegram_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  brand_id UUID REFERENCES brands(id) ON DELETE CASCADE,
  
  chat_id TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(restaurant_id)
);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

ALTER TABLE brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurants ENABLE ROW LEVEL SECURITY;
ALTER TABLE monitoring_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE violations ENABLE ROW LEVEL SECURITY;
ALTER TABLE stop_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE monitoring_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE telegram_config ENABLE ROW LEVEL SECURITY;

-- Network admins can see everything
CREATE POLICY "Network admins full access brands" ON brands
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'network_admin'
    )
  );

CREATE POLICY "Network admins full access restaurants" ON restaurants
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'network_admin'
    )
  );

-- Restaurant managers can only see their assigned data
CREATE POLICY "Restaurant managers see assigned restaurants" ON restaurants
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND (
        user_profiles.role = 'network_admin'
        OR id = ANY(user_profiles.assigned_restaurant_ids)
        OR brand_id = ANY(user_profiles.assigned_brand_ids)
      )
    )
  );

-- Similar policies for other tables
CREATE POLICY "Users see their monitoring checks" ON monitoring_checks
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      JOIN restaurants r ON r.id = monitoring_checks.restaurant_id
      WHERE up.id = auth.uid()
      AND (
        up.role = 'network_admin'
        OR r.id = ANY(up.assigned_restaurant_ids)
        OR r.brand_id = ANY(up.assigned_brand_ids)
      )
    )
  );

CREATE POLICY "Users see their violations" ON violations
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      JOIN restaurants r ON r.id = violations.restaurant_id
      WHERE up.id = auth.uid()
      AND (
        up.role = 'network_admin'
        OR r.id = ANY(up.assigned_restaurant_ids)
        OR r.brand_id = ANY(up.assigned_brand_ids)
      )
    )
  );

-- User profiles - users can only see their own profile
CREATE POLICY "Users can view own profile" ON user_profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid());

-- ============================================
-- SAMPLE DATA (Optional - for testing)
-- ============================================

-- Create a test brand
INSERT INTO brands (name, telegram_group_id) 
VALUES ('Test Restaurant Group', '-1001234567890');

-- Create a test restaurant
INSERT INTO restaurants (brand_id, name, city, address, glovo_url, normal_radius_km, working_hours)
SELECT 
  id,
  'Test Sushi Restaurant',
  'Bucharest',
  'Str. Victoriei 1',
  'https://glovoapp.com/ro/buc/test-restaurant',
  5.0,
  '{"monday": {"open": "10:00", "close": "22:00"}, "tuesday": {"open": "10:00", "close": "22:00"}}'::jsonb
FROM brands WHERE name = 'Test Restaurant Group';

-- Create monitoring config for the test restaurant
INSERT INTO monitoring_config (restaurant_id, platform, check_interval_minutes)
SELECT id, 'glovo', 5 FROM restaurants WHERE name = 'Test Sushi Restaurant';

-- Create a sample business rule
INSERT INTO business_rules (restaurant_id, rule_type, config, priority)
SELECT 
  id,
  'unauthorized_stop',
  '{"max_stop_duration_minutes": 15, "check_working_hours": true}'::jsonb,
  1
FROM restaurants WHERE name = 'Test Sushi Restaurant';
