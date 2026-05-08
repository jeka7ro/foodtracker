-- ──────────────────────────────────────────────────────────────
-- daily_sales_summary: cifre agregate per zi / restaurant / platform
-- Scopul: dashboard-ul citeste din asta, NU din platform_sales (126k rows)
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.daily_sales_summary (
    id            BIGSERIAL PRIMARY KEY,
    sale_date     DATE        NOT NULL,
    restaurant_id UUID        REFERENCES restaurants(id) ON DELETE CASCADE,
    platform      TEXT        NOT NULL,
    total_revenue NUMERIC(12, 2) NOT NULL DEFAULT 0,
    total_orders  INTEGER       NOT NULL DEFAULT 0,
    aov           NUMERIC(10, 2) GENERATED ALWAYS AS (
                      CASE WHEN total_orders > 0 THEN ROUND(total_revenue / total_orders, 2) ELSE 0 END
                  ) STORED,
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (sale_date, restaurant_id, platform)
);

-- Index pentru queries tipice din dashboard
CREATE INDEX IF NOT EXISTS idx_dss_date       ON public.daily_sales_summary (sale_date DESC);
CREATE INDEX IF NOT EXISTS idx_dss_rest_date  ON public.daily_sales_summary (restaurant_id, sale_date DESC);
CREATE INDEX IF NOT EXISTS idx_dss_plat_date  ON public.daily_sales_summary (platform, sale_date DESC);

-- RLS: acces public anon (la fel ca platform_sales)
ALTER TABLE public.daily_sales_summary ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anon read" ON public.daily_sales_summary FOR SELECT USING (true);
CREATE POLICY "Allow service write" ON public.daily_sales_summary FOR ALL USING (true);
