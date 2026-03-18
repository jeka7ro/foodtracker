-- Adaugă tabela alerts (lipsea din schema inițială)
CREATE TABLE alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  restaurant_name TEXT NOT NULL,
  aggregator TEXT NOT NULL, -- 'glovo', 'wolt', 'bolt'
  alert_type TEXT NOT NULL, -- 'unauthorized_stop', 'radius_reduction', 'rating_drop', etc.
  severity TEXT NOT NULL, -- 'low', 'medium', 'high', 'critical'
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  is_resolved BOOLEAN DEFAULT false,
  telegram_sent BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_alerts_restaurant ON alerts(restaurant_id);
CREATE INDEX idx_alerts_read ON alerts(is_read);
CREATE INDEX idx_alerts_resolved ON alerts(is_resolved);
CREATE INDEX idx_alerts_created ON alerts(created_at DESC);

-- Enable RLS
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;

-- Policy: Users can see alerts for their restaurants
CREATE POLICY "Users see their alerts" ON alerts
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      JOIN restaurants r ON r.id = alerts.restaurant_id
      WHERE up.id = auth.uid()
      AND (
        up.role = 'network_admin'
        OR r.id = ANY(up.assigned_restaurant_ids)
        OR r.brand_id = ANY(up.assigned_brand_ids)
      )
    )
  );
