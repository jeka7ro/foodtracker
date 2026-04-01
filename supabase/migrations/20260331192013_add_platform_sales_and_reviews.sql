CREATE TABLE IF NOT EXISTS public.platform_sales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    platform TEXT NOT NULL,
    restaurant_id UUID,
    order_id TEXT UNIQUE NOT NULL,
    total_amount NUMERIC(10,2) NOT NULL,
    placed_at TIMESTAMPTZ NOT NULL,
    items JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.platform_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    platform TEXT NOT NULL,
    location_id TEXT,
    order_id TEXT UNIQUE NOT NULL,
    customer_name TEXT,
    rating NUMERIC(3,1),
    comment TEXT,
    sentiment TEXT,
    platform_url TEXT,
    reviewed_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Active RLS and Policies for platform_sales
ALTER TABLE public.platform_sales ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all access for all users" ON public.platform_sales FOR ALL USING (true);

-- Active RLS and Policies for platform_reviews
ALTER TABLE public.platform_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all access for all users" ON public.platform_reviews FOR ALL USING (true);
