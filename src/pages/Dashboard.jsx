import { useTheme } from '../lib/ThemeContext'
import { useLanguage } from '../lib/LanguageContext'
import { supabase } from '../lib/supabaseClient'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { useState, useEffect, useMemo } from 'react'
import {
  TrendingUp, TrendingDown, ShoppingBag, Store, AlertTriangle,
  XCircle, CheckCircle, Zap, Package, MapPin, Clock, BarChart2
} from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell
} from 'recharts'
import './Dashboard.css'

// ─── Animated Number ───
function AnimNum({ value, decimals = 0, suffix = '' }) {
  const [disp, setDisp] = useState(0)
  useEffect(() => {
    const end = typeof value === 'number' ? value : 0
    if (end === 0) { setDisp(0); return }
    let cur = 0
    const steps = 40
    const inc = end / steps
    let tick = 0
    const t = setInterval(() => {
      tick++
      cur = Math.min(cur + inc, end)
      setDisp(cur)
      if (tick >= steps) clearInterval(t)
    }, 16)
    return () => clearInterval(t)
  }, [value])
  return <>{decimals > 0 ? disp.toFixed(decimals) : Math.round(disp).toLocaleString('ro-RO')}{suffix}</>
}

// ─── Sparkline ───
function Spark({ data, color }) {
  if (!data || data.length < 2) return null
  return (
    <ResponsiveContainer width="100%" height={40}>
      <AreaChart data={data} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
        <defs>
          <linearGradient id={`sg-${color.replace('#','')}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.4} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area type="monotone" dataKey="v" stroke={color} strokeWidth={2}
          fill={`url(#sg-${color.replace('#','')})`} dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  )
}

// ─── Mini progress bar ───
function Bar1({ pct, color }) {
  return (
    <div style={{ height: 4, borderRadius: 4, background: 'rgba(255,255,255,0.07)', overflow: 'hidden', marginTop: 6 }}>
      <div style={{ height: '100%', width: `${Math.min(pct, 100)}%`, background: color, borderRadius: 4, transition: 'width 0.8s ease' }} />
    </div>
  )
}

const PLATFORM_COLORS = { glovo: '#FFC244', wolt: '#01A6EA', bolt: '#34D399', iiko: '#8B5CF6', default: '#94a3b8' }
const PLATFORM_EMOJI = { glovo: '🟡', wolt: '🔵', bolt: '🟢', iiko: '🟣' }

export default function Dashboard() {
  const { isDark } = useTheme()
  const { lang } = useLanguage()
  const l = lang || 'ro'

  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000)
    return () => clearInterval(t)
  }, [])

  // ─── Fetch restaurants ───
  const { data: restaurants = [] } = useQuery({
    queryKey: ['restaurants-dash-live'],
    queryFn: async () => {
      const { data } = await supabase.from('restaurants').select('*')
      return (data || []).filter(r => r.is_active)
    },
    refetchInterval: 60000
  })

  // ─── Fetch sales (yesterday + today) ───
  const { data: salesData = [] } = useQuery({
    queryKey: ['sales-dash-live'],
    queryFn: async () => {
      const yest = new Date()
      yest.setDate(yest.getDate() - 1)
      yest.setHours(0, 0, 0, 0)
      const { data } = await supabase.from('platform_sales')
        .select('*')
        .gte('placed_at', yest.toISOString())
      return data || []
    },
    refetchInterval: 60000
  })

  // ─── COMPUTE ALL ANALYTICS ───
  const analytics = useMemo(() => {
    const todayStr = new Date().toDateString()
    const yestDate = new Date(); yestDate.setDate(yestDate.getDate() - 1)
    const yestStr = yestDate.toDateString()
    const nowHour = new Date().getHours()

    let todayRev = 0, yestRev = 0, todayOrders = 0, yestOrders = 0
    const hourlyMap = {}
    const locationMap = {}    // { restId: { name, rev, orders, platforms: Set } }
    const productMap = {}     // { productName: { name, qty, rev } }
    const platformRevMap = {} // { platform: rev }

    for (let h = 0; h < 24; h++) {
      hourlyMap[h] = { h, t: 0, y: 0 }
    }

    const restNameMap = {}
    restaurants.forEach(r => { restNameMap[r.id] = r.name })

    salesData.forEach(sale => {
      const dt = new Date(sale.placed_at)
      const amt = parseFloat(sale.total_amount) || 0
      const h = dt.getHours()
      const plat = (sale.platform || 'default').toLowerCase()
      const rName = restNameMap[sale.restaurant_id] || `Loc. ${sale.restaurant_id}`

      if (dt.toDateString() === todayStr) {
        todayRev += amt
        todayOrders++
        hourlyMap[h].t += amt
        platformRevMap[plat] = (platformRevMap[plat] || 0) + amt

        if (!locationMap[sale.restaurant_id]) {
          locationMap[sale.restaurant_id] = { name: rName, rev: 0, orders: 0, platforms: new Set() }
        }
        locationMap[sale.restaurant_id].rev += amt
        locationMap[sale.restaurant_id].orders++
        locationMap[sale.restaurant_id].platforms.add(plat)

        // Products from items JSONB
        const items = Array.isArray(sale.items) ? sale.items : []
        items.forEach(item => {
          const pName = item.name || 'Produs necunoscut'
          if (!productMap[pName]) productMap[pName] = { name: pName, qty: 0, rev: 0 }
          productMap[pName].qty += (item.quantity || 1)
          productMap[pName].rev += (item.price || 0) * (item.quantity || 1)
        })
      } else if (dt.toDateString() === yestStr) {
        yestRev += amt
        yestOrders++
        hourlyMap[h].y += amt
      }
    })

    // Hourly chart — only up to current hour for today
    const hourlyChart = Object.values(hourlyMap)
      .filter(x => x.h <= nowHour)
      .map(x => ({ hour: `${String(x.h).padStart(2, '0')}:00`, today: x.t, yesterday: x.y }))

    // Top locations (sorted by rev)
    const topLocations = Object.values(locationMap)
      .sort((a, b) => b.rev - a.rev)
      .slice(0, 8)
    const maxLocRev = topLocations[0]?.rev || 1

    // Top products (sorted by qty)
    const topProducts = Object.values(productMap)
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 10)
    const maxProdQty = topProducts[0]?.qty || 1

    // Platform breakdown
    const platforms = Object.entries(platformRevMap)
      .map(([k, v]) => ({ name: k, rev: v }))
      .sort((a, b) => b.rev - a.rev)

    // Growth
    const growth = yestRev > 0 ? ((todayRev - yestRev) / yestRev) * 100 : 0
    const orderGrowth = yestOrders > 0 ? ((todayOrders - yestOrders) / yestOrders) * 100 : 0

    // Sparkline per location (just hourly sales)
    const sparkData = hourlyChart.map(x => ({ v: x.today }))

    return {
      todayRev, yestRev, todayOrders, yestOrders, growth, orderGrowth,
      hourlyChart, topLocations, topProducts, platforms, maxLocRev, maxProdQty, sparkData
    }
  }, [salesData, restaurants])

  // ─── Stops from iiko_live_stops ───
  const stopsInfo = useMemo(() => {
    let total = 0; const orgs = []
    restaurants.forEach(r => {
      const stops = r.iiko_config?.iiko_live_stops || []
      if (stops.length > 0) { total += stops.length; orgs.push({ name: r.name, count: stops.length }) }
    })
    return { total, orgs }
  }, [restaurants])

  const growthColor = analytics.growth >= 0 ? '#10b981' : '#ef4444'
  const GrowthIcon = analytics.growth >= 0 ? TrendingUp : TrendingDown

  // css vars inline
  const css = `
    :root {
      --tx: ${isDark ? '#f1f5f9' : '#0f172a'};
      --tx2: ${isDark ? '#64748b' : '#94a3b8'};
      --bg: ${isDark ? '#0a0f1e' : '#f8fafc'};
      --card: ${isDark ? 'rgba(15,23,42,0.8)' : 'rgba(255,255,255,0.9)'};
      --border: ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.07)'};
      --hover: ${isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)'};
    }
  `

  return (
    <div className={`db-root ${isDark ? 'db-dark' : 'db-light'}`}>
      <style>{css}</style>

      {/* ── TOP BAR ── */}
      <div className="db-topbar">
        <div className="db-topbar-left">
          <div className="db-logo-pill">
            <BarChart2 size={16} color="#6366f1" />
            <span>Dashboard</span>
          </div>
          <span className="db-time">{now.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' })}</span>
          <span className="db-live-badge">
            <span className="db-pulse" />
            LIVE
          </span>
        </div>
        <div className="db-topbar-right">
          <Link to="/stop-control" className="db-stop-btn">
            <AlertTriangle size={13} />
            Stop-uri
            {stopsInfo.total > 0 && <span className="db-stop-badge">{stopsInfo.total}</span>}
          </Link>
        </div>
      </div>

      {/* ── KPI ROW ── */}
      <div className="db-kpi-row">

        {/* Revenue Today */}
        <div className="db-kpi">
          <div className="db-kpi-label">
            <Zap size={12} color="#6366f1" /> Vânzări azi
          </div>
          <div className="db-kpi-val" style={{ color: '#6366f1' }}>
            <AnimNum value={analytics.todayRev} decimals={0} /> <span className="db-kpi-unit">RON</span>
          </div>
          <div className="db-kpi-delta" style={{ color: growthColor }}>
            <GrowthIcon size={11} />
            {analytics.growth >= 0 ? '+' : ''}{analytics.growth.toFixed(1)}% vs ieri
          </div>
          <Spark data={analytics.sparkData} color="#6366f1" />
        </div>

        {/* Orders Today */}
        <div className="db-kpi">
          <div className="db-kpi-label">
            <ShoppingBag size={12} color="#f59e0b" /> Comenzi azi
          </div>
          <div className="db-kpi-val" style={{ color: '#f59e0b' }}>
            <AnimNum value={analytics.todayOrders} />
          </div>
          <div className="db-kpi-delta" style={{ color: analytics.orderGrowth >= 0 ? '#10b981' : '#ef4444' }}>
            {analytics.orderGrowth >= 0 ? '+' : ''}{analytics.orderGrowth.toFixed(1)}% vs ieri
          </div>
          <Spark data={analytics.sparkData} color="#f59e0b" />
        </div>

        {/* Avg ticket */}
        <div className="db-kpi">
          <div className="db-kpi-label">
            <Package size={12} color="#10b981" /> Coș mediu
          </div>
          <div className="db-kpi-val" style={{ color: '#10b981' }}>
            <AnimNum value={analytics.todayOrders > 0 ? analytics.todayRev / analytics.todayOrders : 0} decimals={1} />
            <span className="db-kpi-unit"> RON</span>
          </div>
          <div className="db-kpi-delta" style={{ color: 'var(--tx2)' }}>
            {analytics.todayOrders} comenzi procesate
          </div>
          <Spark data={analytics.sparkData} color="#10b981" />
        </div>

        {/* Puncte lucru */}
        <div className="db-kpi">
          <div className="db-kpi-label">
            <Store size={12} color="#8b5cf6" /> Puncte lucru
          </div>
          <div className="db-kpi-val" style={{ color: '#8b5cf6' }}>
            <AnimNum value={restaurants.length} />
          </div>
          <div className="db-kpi-delta" style={{ color: stopsInfo.total > 0 ? '#ef4444' : '#10b981' }}>
            {stopsInfo.total > 0 ? `⚠ ${stopsInfo.total} stop-uri active` : '✓ Toate online'}
          </div>
          <Spark data={analytics.sparkData} color="#8b5cf6" />
        </div>

        {/* Yesterday rev for comparison */}
        <div className="db-kpi">
          <div className="db-kpi-label">
            <Clock size={12} color="#94a3b8" /> Ieri total
          </div>
          <div className="db-kpi-val" style={{ color: 'var(--tx2)' }}>
            <AnimNum value={analytics.yestRev} decimals={0} /> <span className="db-kpi-unit">RON</span>
          </div>
          <div className="db-kpi-delta" style={{ color: 'var(--tx2)' }}>
            {analytics.yestOrders} comenzi
          </div>
          <Spark data={analytics.sparkData} color="#475569" />
        </div>
      </div>

      {/* ── MAIN GRID ── */}
      <div className="db-main-grid">

        {/* LEFT: Hourly chart + Platform pills */}
        <div className="db-left-col">

          {/* Hourly Area Chart */}
          <div className="db-card">
            <div className="db-card-head">
              <span className="db-card-title">Vânzări pe ore</span>
              <span className="db-card-sub">azi vs ieri</span>
            </div>
            <div style={{ height: 180, marginLeft: -16 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={analytics.hourlyChart} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gToday" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#6366f1" stopOpacity={0.5} />
                      <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gYest" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#475569" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#475569" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="2 4" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="hour" stroke="var(--tx2)" fontSize={10} tickLine={false} axisLine={false}
                    tickFormatter={v => v.split(':')[0]} interval={2} />
                  <YAxis stroke="var(--tx2)" fontSize={10} tickLine={false} axisLine={false}
                    tickFormatter={v => v > 0 ? `${(v/1000).toFixed(1)}k` : ''} width={36} />
                  <Tooltip
                    contentStyle={{ background: isDark ? '#0f172a' : '#fff', border: '1px solid var(--border)', borderRadius: 10, fontSize: 12 }}
                    formatter={(v, n) => [`${v.toFixed(0)} RON`, n === 'today' ? 'Azi' : 'Ieri']}
                    labelFormatter={l => `Ora ${l}`}
                  />
                  <Area type="monotone" dataKey="yesterday" stroke="#475569" strokeWidth={1.5}
                    fill="url(#gYest)" strokeDasharray="4 4" dot={false} name="yesterday" />
                  <Area type="monotone" dataKey="today" stroke="#6366f1" strokeWidth={2.5}
                    fill="url(#gToday)" dot={false} activeDot={{ r: 4, fill: '#6366f1' }} name="today" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Platform Breakdown */}
          {analytics.platforms.length > 0 && (
            <div className="db-card">
              <div className="db-card-head">
                <span className="db-card-title">Pe platformă</span>
              </div>
              <div className="db-platform-list">
                {analytics.platforms.map(p => {
                  const color = PLATFORM_COLORS[p.name] || PLATFORM_COLORS.default
                  const pct = analytics.todayRev > 0 ? (p.rev / analytics.todayRev) * 100 : 0
                  return (
                    <div key={p.name} className="db-platform-row">
                      <div className="db-platform-name">
                        <span style={{ fontSize: 16 }}>{PLATFORM_EMOJI[p.name] || '⚪'}</span>
                        <span style={{ textTransform: 'capitalize', fontWeight: 700, fontSize: 13 }}>{p.name}</span>
                      </div>
                      <div style={{ flex: 1, padding: '0 12px' }}>
                        <Bar1 pct={pct} color={color} />
                      </div>
                      <div style={{ textAlign: 'right', minWidth: 90 }}>
                        <span style={{ fontWeight: 800, fontSize: 13, color }}>{p.rev.toFixed(0)} RON</span>
                        <span style={{ fontSize: 11, color: 'var(--tx2)', marginLeft: 6 }}>{pct.toFixed(0)}%</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Stops alert compact */}
          {stopsInfo.total > 0 && (
            <div className="db-card db-stops-card">
              <div className="db-card-head">
                <span className="db-card-title" style={{ color: '#ef4444' }}>
                  <AlertTriangle size={13} style={{ marginRight: 6 }} />
                  Stop-uri active
                </span>
                <Link to="/stop-control" className="db-mini-btn">Gestionează →</Link>
              </div>
              {stopsInfo.orgs.map((o, i) => (
                <div key={i} className="db-stop-row">
                  <XCircle size={12} color="#ef4444" />
                  <span style={{ fontWeight: 700, fontSize: 13 }}>{o.name}</span>
                  <span className="db-stop-count">{o.count} produse</span>
                </div>
              ))}
            </div>
          )}

          {stopsInfo.total === 0 && (
            <div className="db-card db-ok-card">
              <CheckCircle size={16} color="#10b981" />
              <div>
                <div style={{ fontWeight: 800, fontSize: 13, color: '#10b981' }}>Totul funcționează</div>
                <div style={{ fontSize: 12, color: 'var(--tx2)' }}>Nicio oprire activă pe nicio platformă</div>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT: Top Products + Top Locations */}
        <div className="db-right-col">

          {/* TOP PRODUCTS */}
          <div className="db-card db-card-fill">
            <div className="db-card-head">
              <span className="db-card-title">Top produse vândute azi</span>
              <span className="db-card-sub">după cantitate</span>
            </div>
            {analytics.topProducts.length === 0 ? (
              <div className="db-empty">Nicio comandă azi cu detalii produse.</div>
            ) : (
              <div className="db-prod-list">
                {analytics.topProducts.map((p, i) => {
                  const pct = (p.qty / analytics.maxProdQty) * 100
                  const colors = ['#6366f1','#8b5cf6','#f59e0b','#10b981','#3b82f6','#ec4899','#14b8a6','#f97316','#a855f7','#06b6d4']
                  const color = colors[i % colors.length]
                  return (
                    <div key={p.name} className="db-prod-row">
                      <div className="db-prod-rank" style={{ background: `${color}20`, color }}>
                        {i + 1}
                      </div>
                      <div className="db-prod-info">
                        <span className="db-prod-name">{p.name}</span>
                        <Bar1 pct={pct} color={color} />
                      </div>
                      <div className="db-prod-stats">
                        <span className="db-prod-qty" style={{ color }}>×{p.qty}</span>
                        <span className="db-prod-rev">{p.rev.toFixed(0)} RON</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── PUNCTE DE LUCRU GRID ── */}
      <div className="db-section-title">
        <MapPin size={14} color="#6366f1" />
        Puncte de lucru — vânzări azi
      </div>
      <div className="db-locations-grid">
        {analytics.topLocations.length === 0
          ? restaurants.slice(0, 8).map((r, i) => (
            <div key={r.id} className="db-loc-card db-loc-empty">
              <div className="db-loc-name">{r.name}</div>
              <div className="db-loc-zero">0 RON</div>
              <div className="db-loc-sub">Nicio comandă azi</div>
            </div>
          ))
          : analytics.topLocations.map((loc, i) => {
            const pct = (loc.rev / analytics.maxLocRev) * 100
            const rank_colors = ['#6366f1','#8b5cf6','#f59e0b','#10b981','#3b82f6','#ec4899','#14b8a6','#f97316']
            const color = rank_colors[i % rank_colors.length]
            const avgTicket = loc.orders > 0 ? loc.rev / loc.orders : 0
            return (
              <div key={loc.name} className="db-loc-card">
                <div className="db-loc-header">
                  <div className="db-loc-rank" style={{ background: `${color}20`, color }}>#{i + 1}</div>
                  <div className="db-loc-name">{loc.name}</div>
                </div>
                <div className="db-loc-rev" style={{ color }}>{loc.rev.toFixed(0)} <span>RON</span></div>
                <Bar1 pct={pct} color={color} />
                <div className="db-loc-meta">
                  <span><ShoppingBag size={10} /> {loc.orders} comenzi</span>
                  <span>≈{avgTicket.toFixed(0)} RON/cmd</span>
                </div>
                {loc.platforms && loc.platforms.size > 0 && (
                  <div className="db-loc-plats">
                    {[...loc.platforms].map(pl => (
                      <span key={pl} className="db-plat-chip" style={{ background: `${PLATFORM_COLORS[pl] || '#94a3b8'}20`, color: PLATFORM_COLORS[pl] || '#94a3b8' }}>
                        {pl}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )
          })
        }
      </div>

    </div>
  )
}
