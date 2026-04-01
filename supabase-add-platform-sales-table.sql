-- Table: platform_sales
-- Purpose: Store real order data fetched from Glovo, Wolt, Bolt food portals so the Performance dashboard can use precise real-time data instead of mocks.

CREATE TABLE IF NOT EXISTS platform_sales (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id BIGINT REFERENCES restaurants(id) ON DELETE CASCADE,
    platform VARCHAR(50) NOT NULL, -- 'glovo', 'wolt', 'bolt'
    order_id VARCHAR(100), -- The ID of the order from the portal
    total_amount NUMERIC(10, 2), -- the total cart value of the order
    placed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), -- the time the order was placed
    items JSONB, -- an array of objects e.g. [{"name": "Sushi", "quantity": 2, "price": 50.0}]
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for speedy querying by placed_at for charting
CREATE INDEX IF NOT EXISTS idx_platform_sales_placed_at ON platform_sales (placed_at DESC);
CREATE INDEX IF NOT EXISTS idx_platform_sales_restaurant_id ON platform_sales (restaurant_id);
CREATE INDEX IF NOT EXISTS idx_platform_sales_platform ON platform_sales (platform);

-- Ensure RLS is enabled if needed, though for admin portal it's usually bypassed by service_role or admin policies.
-- Enable read access for authenticated admins
ALTER TABLE platform_sales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated full access to sales" 
ON platform_sales FOR ALL USING (auth.role() = 'authenticated');
