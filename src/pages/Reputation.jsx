import React, { useState, useMemo, useRef } from 'react'
import { useTheme } from '../lib/ThemeContext'
import { supabase } from '../lib/supabaseClient'
import { useQuery } from '@tanstack/react-query'
import * as XLSX from 'xlsx'
import { UploadCloud } from 'lucide-react'

// ─── Helpers ──────────────────────────────────────────────────────────────────
const PL = {
    glovo: { color: '#F5A623', bg: 'rgba(245,166,35,0.12)', label: 'GLOVO' },
    wolt:  { color: '#009DE0', bg: 'rgba(0,157,224,0.12)',   label: 'WOLT'  },
    bolt:  { color: '#34D186', bg: 'rgba(52,209,134,0.12)',  label: 'BOLT'  },
    google:{ color: '#4285F4', bg: 'rgba(66,133,244,0.12)',  label: 'GOOGLE'},
}

const PERIODS = [
    { id: 'today',   label: 'Azi'             },
    { id: 'week',    label: 'Săptămâna curentă' },
    { id: 'month',   label: 'Luna curentă'    },
    { id: 'year',    label: 'Anul curent'     },
]

function periodStart(id) {
    const now = new Date()
    if (id === 'today') { const d = new Date(now); d.setHours(0,0,0,0); return d }
    if (id === 'week')  { const d = new Date(now); d.setDate(d.getDate() - d.getDay() + (d.getDay() === 0 ? -6 : 1)); d.setHours(0,0,0,0); return d }
    if (id === 'month') { return new Date(now.getFullYear(), now.getMonth(), 1) }
    return new Date(now.getFullYear(), 0, 1)
}

function Stars({ rating, max = 10, size = 13 }) {
    if (!rating) return <span style={{ color: '#aaa', fontSize: size }}>—</span>
    const val = parseFloat(rating)
    const pct = Math.round((val / max) * 100)
    const color = pct >= 80 ? '#10b981' : pct >= 60 ? '#f59e0b' : '#ef4444'
    return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
            <span style={{ fontSize: size, fontWeight: '700', color }}>{val.toFixed(1)}</span>
            <span style={{ fontSize: size - 2, color: '#f59e0b' }}>{'★'.repeat(Math.round(val / max * 5))}{'☆'.repeat(5 - Math.round(val / max * 5))}</span>
        </span>
    )
}

function Badge({ type, children }) {
    const m = { positive: { bg: 'rgba(16,185,129,0.12)', color: '#059669' }, negative: { bg: 'rgba(239,68,68,0.12)', color: '#dc2626' }, neutral: { bg: 'rgba(245,158,11,0.12)', color: '#d97706' } }
    const s = m[type] || m.neutral
    return <span style={{ padding: '3px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: '700', background: s.bg, color: s.color }}>{children}</span>
}

function PBadge({ p }) {
    const s = PL[p] || { color: '#888', bg: '#eee', label: (p || '?').toUpperCase() }
    return <span style={{ padding: '3px 9px', borderRadius: '20px', fontSize: '10px', fontWeight: '700', background: s.bg, color: s.color, letterSpacing: '0.3px' }}>{s.label}</span>
}

// ─── B2B Portal URLs per location (keyed by partial name match) ───────────────
const PORTAL_URLS = {
    'Calea București': { wolt: 'https://merchant.wolt.com/app/experience/merchant/67dad68ddb56261b0e642510/s/67dad68ddb56261b0e642510/insights', glovo: 'https://portal.glovoapp.com/reviews/GV_RO;747061' },
    '1 Decembrie':     { wolt: 'https://merchant.wolt.com/app/experience/merchant/67dafe6e21bfd57729792a60/s/67dafe6e21bfd57729792a60/insights' },
    'Halelor':         { wolt: 'https://merchant.wolt.com/app/experience/merchant/67db00593a31651eb80dec1e/s/67db00593a31651eb80dec1e/insights' },
    'Voievozilor':     { wolt: 'https://merchant.wolt.com/app/experience/merchant/67dd59415e61a1513fbf7054/s/67dd59415e61a1513fbf7054/insights' },
}

function getPortalUrl(restaurantName, platform) {
    const key = Object.keys(PORTAL_URLS).find(k => restaurantName?.includes(k))
    return key ? PORTAL_URLS[key][platform] : null
}

// ─── Clickable table cell ─────────────────────────────────────────────────────
function PortalCell({ value, url, color, isDark }) {
    const [hov, setHov] = useState(false)
    return (
        <td onClick={() => url && window.open(url, '_blank')} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
            style={{ padding: '12px 14px', cursor: url ? 'pointer' : 'default', transition: 'all 0.15s',
                background: hov && url ? (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)') : 'transparent',
                borderLeft: 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ fontSize: '13px', fontWeight: '600', color: value ? color || 'inherit' : '#aaa' }}>
                    {value ?? '—'}
                </span>
                {url && <span style={{ fontSize: '10px', opacity: hov ? 0.9 : 0.3, color: color, transition: 'opacity 0.15s' }}>↗</span>}
            </div>
        </td>
    )
}

// ─── Monthly Rating Line Chart ────────────────────────────────────────────────
const PL_CHART = [
    { id: 'glovo', name: 'Glovo', color: '#F5A623', max: 10 },
    { id: 'wolt',  name: 'Wolt',  color: '#009DE0', max: 10 },
    { id: 'bolt',  name: 'Bolt',  color: '#34D186', max: 5  },
]

function RatingChart({ data, months, isDark, colors }) {
    const [tooltip, setTooltip] = useState(null)
    const W = '100%', H = 220, PAD = { t: 20, r: 32, b: 36, l: 44 }
    const svgRef = useRef(null)

    if (!months.length) return null

    const n = months.length
    // All values normalized 0–10
    const allVals = PL_CHART.flatMap(pl => months.map(m => {
        const v = data[m]?.[pl.id]
        return v != null ? (v / pl.max) * 10 : null
    })).filter(v => v != null)
    const yMax = 10, yMin = Math.max(0, Math.floor(Math.min(...allVals, 10)) - 1)
    const yRange = yMax - yMin || 1

    const xPct   = (i) => n === 1 ? 0.5 : i / (n - 1)
    const yPct   = (v) => 1 - (v - yMin) / yRange

    // render inside measured width via viewBox trick
    const VW = 1000, VH = H
    const px = (i) => PAD.l + xPct(i) * (VW - PAD.l - PAD.r)
    const py = (v) => PAD.t + yPct(v) * (VH - PAD.t - PAD.b)

    const yTicks = Array.from({ length: 6 }, (_, i) => yMin + (i * yRange / 5))
    const monthLabels = months.map(m => {
        const [y, mo] = m.split('-')
        const d = new Date(Number(y), Number(mo) - 1, 1)
        return d.toLocaleDateString('ro-RO', { month: 'short', year: n > 6 ? '2-digit' : undefined })
    })

    return (
        <div style={{ position: 'relative' }}>
            <svg viewBox={`0 0 ${VW} ${VH}`} style={{ width: '100%', height: H, display: 'block', overflow: 'visible' }} ref={svgRef}>
                {/* Grid lines */}
                {yTicks.map((t, i) => (
                    <g key={i}>
                        <line x1={PAD.l} y1={py(t)} x2={VW - PAD.r} y2={py(t)}
                            stroke={isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'} strokeWidth="1" strokeDasharray="4 4" />
                        <text x={PAD.l - 6} y={py(t) + 4} textAnchor="end" fontSize="22" fill={isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)'} fontFamily="Inter,sans-serif">
                            {t.toFixed(1)}
                        </text>
                    </g>
                ))}
                {/* X labels */}
                {months.map((m, i) => (
                    <text key={m} x={px(i)} y={VH - 6} textAnchor="middle" fontSize="24"
                        fill={isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)'} fontFamily="Inter,sans-serif">
                        {monthLabels[i]}
                    </text>
                ))}
                {/* Platform lines */}
                {PL_CHART.map(pl => {
                    const pts = months.map((m, i) => {
                        const raw = data[m]?.[pl.id]
                        if (raw == null) return null
                        const norm = (raw / pl.max) * 10
                        return { x: px(i), y: py(norm), raw, i, m }
                    }).filter(Boolean)
                    if (pts.length < 1) return null
                    const path = pts.map((p, pi) => `${pi === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
                    return (
                        <g key={pl.id}>
                            {pts.length > 1 && (
                                <>
                                    {/* Shadow behind line */}
                                    <path d={path} fill="none" stroke={pl.color} strokeWidth="6" strokeOpacity="0.12" strokeLinecap="round" strokeLinejoin="round" />
                                    <path d={path} fill="none" stroke={pl.color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                                </>
                            )}
                            {pts.map((p, pi) => (
                                <circle key={pi} cx={p.x} cy={p.y} r="7" fill={isDark ? '#1a1a24' : '#fff'} stroke={pl.color} strokeWidth="2.5"
                                    style={{ cursor: 'pointer' }}
                                    onMouseEnter={() => setTooltip({ x: p.x / VW, y: p.y / VH, pl, raw: p.raw, month: monthLabels[p.i] })}
                                    onMouseLeave={() => setTooltip(null)} />
                            ))}
                        </g>
                    )
                })}
            </svg>
            {/* Tooltip */}
            {tooltip && (
                <div style={{
                    position: 'absolute', left: `calc(${tooltip.x * 100}% + 12px)`, top: `${tooltip.y * 100}%`,
                    transform: 'translateY(-50%)', pointerEvents: 'none', zIndex: 10,
                    background: isDark ? 'rgba(20,20,30,0.95)' : '#fff',
                    border: `1px solid ${tooltip.pl.color}40`, borderRadius: '10px',
                    padding: '8px 12px', boxShadow: `0 8px 24px rgba(0,0,0,0.25)`,
                    fontSize: '12px', fontWeight: '700', color: colors.text, whiteSpace: 'nowrap',
                }}>
                    <div style={{ color: tooltip.pl.color, marginBottom: '2px' }}>{tooltip.pl.name} • {tooltip.month}</div>
                    <div style={{ fontSize: '18px', letterSpacing: '-0.5px' }}>{tooltip.raw.toFixed(2)} <span style={{ fontSize: '11px', color: colors.textSecondary }}>/ {tooltip.pl.max}</span></div>
                    <div style={{ fontSize: '10px', color: colors.textSecondary, marginTop: '2px' }}>Normalizat: {((tooltip.raw / tooltip.pl.max) * 10).toFixed(1)} / 10</div>
                </div>
            )}
        </div>
    )
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function Reputation() {
    const { colors, isDark } = useTheme()
    const [period, setPeriod]       = useState('week')
    const [chartMonths, setChartMonths] = useState(6)  // 3 | 6 | 12
    const [brandFilter, setBrandFilter] = useState('all')
    const [cityFilter, setCityFilter]   = useState('all')
    const [reviewFilter, setReviewFilter] = useState('all') // all | negative | unreplied
    const [sortKey, setSortKey]     = useState('name')
    const [sortDir, setSortDir]     = useState('asc')
    const [showAddModal, setShowAddModal] = useState(false)

    const periodFrom = useMemo(() => periodStart(period).toISOString(), [period])

    // Chart: always last N months regardless of table filter
    const chartFrom = useMemo(() => {
        const d = new Date(); d.setMonth(d.getMonth() - chartMonths); d.setDate(1); d.setHours(0,0,0,0)
        return d.toISOString()
    }, [chartMonths])

    // ─── Data queries ─────────────────────────────────────────────────────────
    const { data: restaurants = [] } = useQuery({
        queryKey: ['restaurants-rep'],
        queryFn: async () => { const { data } = await supabase.from('restaurants').select('*').order('name'); return data || [] },
        refetchInterval: 60000
    })

    const { data: ratingHistory = [] } = useQuery({
        queryKey: ['rating-history-rep', period],
        queryFn: async () => {
            const { data } = await supabase.from('platform_reviews').select('*').gte('reviewed_at', periodFrom).order('reviewed_at', { ascending: false })
            return data || []
        },
        refetchInterval: 60000
    })

    const { data: ratingChart = [] } = useQuery({
        queryKey: ['rating-chart', chartMonths],
        queryFn: async () => {
            const { data } = await supabase.from('platform_reviews').select('platform,rating,reviewed_at').gte('reviewed_at', chartFrom).order('reviewed_at', { ascending: true })
            return data || []
        },
        refetchInterval: 120000
    })

    // Group chart data by YYYY-MM and platform
    const { chartData, chartMonthKeys } = useMemo(() => {
        const grouped = {}
        ratingChart.forEach(h => {
            const d = new Date(h.reviewed_at)
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
            if (!grouped[key]) grouped[key] = { glovo: [], wolt: [], bolt: [] }
            const p = h.platform
            if (grouped[key][p] !== undefined) grouped[key][p].push(parseFloat(h.rating))
        })
        // Average per month/platform
        const avgd = {}
        Object.entries(grouped).forEach(([k, v]) => {
            avgd[k] = {}
            Object.entries(v).forEach(([p2, vals]) => {
                if (vals.length > 0) avgd[k][p2] = vals.reduce((a, b) => a + b, 0) / vals.length
            })
        })
        // Generate all months in range (including empty)
        const keys = []
        const start = new Date(chartFrom); start.setDate(1)
        const end = new Date(); end.setDate(1)
        const cur = new Date(start)
        while (cur <= end) {
            const k = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}`
            keys.push(k)
            cur.setMonth(cur.getMonth() + 1)
        }
        return { chartData: avgd, chartMonthKeys: keys }
    }, [ratingChart, chartFrom])

    const finalChartData = chartData

    const { data: checks = [] } = useQuery({
        queryKey: ['checks-rep', period],
        queryFn: async () => {
            const { data } = await supabase.from('monitoring_checks').select('*').gte('checked_at', periodFrom).order('checked_at', { ascending: false })
            return data || []
        },
        refetchInterval: 60000
    })

    const { data: stopEvents = [] } = useQuery({
        queryKey: ['stops-rep', period],
        queryFn: async () => {
            const { data } = await supabase.from('stop_events').select('*').gte('stopped_at', periodFrom)
            return data || []
        },
        refetchInterval: 60000
    })

    // ─── Derive table rows ────────────────────────────────────────────────────
    const tableRows = useMemo(() => {
        return restaurants
            .filter(r => brandFilter === 'all' || (r.brand_name || r.name || '').includes(brandFilter))
            .filter(r => cityFilter === 'all' || (r.city || '') === cityFilter)
            .map(restaurant => {
                const rid = restaurant.id
                const rHistory = ratingHistory.filter(h => h.location_id === rid)
                const rChecks  = checks.filter(c => c.restaurant_id === rid)
                const rStops   = stopEvents.filter(s => s.restaurant_id === rid)

                // Build per-platform stats
                const perPlatform = {}
                ;['glovo', 'wolt', 'bolt'].forEach(p => {
                    const ph = rHistory.filter(h => h.platform === p)
                    const pc = rChecks.filter(c => c.platform === p)
                    const latestRating = ph.length > 0 ? ph[0].rating : null
                    const latestCheck = pc.length > 0 ? pc[0] : null
                    const isAvail = latestCheck?.final_status === 'available'
                    const stops = rStops.filter(s => s.platform === p).length
                    const loss = rStops.filter(s => s.platform === p).reduce((sum, s) => sum + (parseFloat(s.estimated_loss_amount) || 0), 0)
                    perPlatform[p] = { rating: latestRating, available: latestCheck ? isAvail : null, stops, loss, url: getPortalUrl(restaurant.name + ' ' + restaurant.address, p) }
                })

                const ratings = Object.values(perPlatform).map(p => parseFloat(p.rating)).filter(Boolean)
                const avgRating = ratings.length > 0 ? (ratings.reduce((a, b) => a + b, 0) / ratings.length) : null
                const totalStops = rStops.length
                const totalLoss = rStops.reduce((sum, s) => sum + (parseFloat(s.estimated_loss_amount) || 0), 0)
                const unavailPlatforms = Object.values(perPlatform).filter(p => p.available === false).length

                return { restaurant, perPlatform, avgRating, totalStops, totalLoss, unavailPlatforms }
            })
    }, [restaurants, ratingHistory, checks, stopEvents, brandFilter, cityFilter])

    // ─── Sort ─────────────────────────────────────────────────────────────────
    const sortedRows = useMemo(() => {
        return [...tableRows].sort((a, b) => {
            let va, vb
            if (sortKey === 'name') { va = a.restaurant.name || ''; vb = b.restaurant.name || '' }
            else if (sortKey === 'city') { va = a.restaurant.city || ''; vb = b.restaurant.city || '' }
            else if (sortKey === 'rating') { va = a.avgRating || 0; vb = b.avgRating || 0 }
            else if (sortKey === 'stops') { va = a.totalStops; vb = b.totalStops }
            else if (sortKey === 'loss') { va = a.totalLoss; vb = b.totalLoss }
            else if (sortKey === 'issues') { va = a.unavailPlatforms; vb = b.unavailPlatforms }
            if (typeof va === 'string') return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va)
            return sortDir === 'asc' ? va - vb : vb - va
        })
    }, [tableRows, sortKey, sortDir])

    function toggleSort(key) {
        if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
        else { setSortKey(key); setSortDir('asc') }
    }

    // ─── Summary KPIs ─────────────────────────────────────────────────────────
    const allRatings = tableRows.map(r => r.avgRating).filter(Boolean)
    const globalAvg  = allRatings.length > 0 ? (allRatings.reduce((a, b) => a + b, 0) / allRatings.length).toFixed(2) : '—'
    const totalLossAll = tableRows.reduce((s, r) => s + r.totalLoss, 0)
    const totalStopsAll = tableRows.reduce((s, r) => s + r.totalStops, 0)
    const issueLocations = tableRows.filter(r => r.unavailPlatforms > 0 || r.totalStops > 0).length

    // ─── Unique values for filters ────────────────────────────────────────────
    const cities = [...new Set(restaurants.map(r => r.city).filter(Boolean))].sort()
    const brands = [...new Set(restaurants.map(r => r.brand_name || r.name?.split(' – ')[0]).filter(Boolean))].sort()

    const reviewFeed = useMemo(() => {
        const feed = ratingHistory
            .filter(h => h.comment)
            .map(h => {
                const r = restaurants.find(r => r.id === h.location_id)
                return {
                    id: h.id, platform: h.platform,
                    rating: parseFloat(h.rating) || 0,
                    author: h.customer_name || 'Client',
                    text: h.comment || '',
                    sentiment: h.sentiment || (h.rating >= 8 ? 'positive' : h.rating >= 5 ? 'neutral' : 'negative'),
                    date: h.reviewed_at, location: r?.name || '—', city: r?.city,
                    replied: false, brand: r?.brand_name || r?.name || '—',
                }
            })

        const all = feed
        return all.filter(r => {
            if (brandFilter !== 'all' && !r.brand?.includes(brandFilter)) return false
            if (cityFilter !== 'all' && r.city !== cityFilter) return false
            if (reviewFilter === 'negative' && r.sentiment !== 'negative') return false
            if (reviewFilter === 'unreplied' && r.replied) return false
            return true
        })
    }, [ratingHistory, restaurants, brandFilter, cityFilter, reviewFilter])

    const [isUploading, setIsUploading] = useState(false)
    const handleFileUpload = async (event) => {
        const file = event.target.files[0]
        if (!file) return
        
        setIsUploading(true)
        try {
            const data = await file.arrayBuffer()
            const workbook = XLSX.read(data)
            const worksheet = workbook.Sheets[workbook.SheetNames[0]]
            const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 })
            
            const rowsToInsert = []
            const dataRows = jsonData.filter(row => row.length > 2)
            
            for (const row of dataRows) {
                // Adaptabil pe baza raportului de Recenzii Glovo
                const ratingCell = row.find(c => String(c).match(/^[0-9](\.[0-9])?$/) || typeof c === 'number' && c <= 10)
                const txtText = row.find(c => typeof c === 'string' && c.length > 15 && !c.includes('RO_GV')) 
                const oId = row.find(c => String(c).length > 8 && !isNaN(Number(c))) || `REV_${Math.floor(Math.random()*1000)}`
                
                if (ratingCell || txtText) {
                    const ratingNum = parseFloat(ratingCell) || 5
                    const sentimentStr = ratingNum >= 8 ? 'positive' : ratingNum <= 5 ? 'negative' : 'neutral'
                    rowsToInsert.push({
                        platform: 'glovo',
                        location_id: 'unknown_imported', 
                        order_id: String(oId),
                        customer_name: 'Client Glovo',
                        rating: ratingNum,
                        comment: String(txtText || ''),
                        sentiment: sentimentStr,
                        platform_url: '',
                        reviewed_at: new Date().toISOString()
                    })
                }
            }

            if (rowsToInsert.length > 0) {
                const { error } = await supabase.from('platform_reviews').insert(rowsToInsert)
                if (error) throw error
                alert(`✅ Succes! S-au importat ${rowsToInsert.length} recenzii în baza de date! Ele vor apărea acum în Inbox-ul tău.`)
                window.location.reload()
            } else {
                alert('⚠️ Nu s-au putut recunoaște recenzii în acest Excel.')
            }
        } catch (error) {
            console.error('Eroare import Excel recenzii:', error)
            alert('❌ Eroare: ' + error.message)
        } finally {
            setIsUploading(false)
            event.target.value = null
        }
    }

    // ─── Styles ───────────────────────────────────────────────────────────────
    const card = {
        background: isDark ? 'rgba(30,30,35,0.85)' : '#ffffff',
        border: `1px solid ${isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.08)'}`,
        borderRadius: '16px',
        boxShadow: isDark ? '0 4px 24px rgba(0,0,0,0.4)' : '0 2px 16px rgba(0,0,0,0.06)',
    }

    const thStyle = (key) => ({
        padding: '12px 14px', fontSize: '11px', fontWeight: '700',
        textTransform: /** @type {'uppercase'} */ ('uppercase'),
        letterSpacing: '0.6px',
        color: sortKey === key ? colors.blue : colors.textSecondary,
        cursor: 'pointer',
        userSelect: /** @type {'none'} */ ('none'),
        whiteSpace: /** @type {'nowrap'} */ ('nowrap'),
        textAlign: /** @type {'left'|'center'} */ (key === 'name' || key === 'city' ? 'left' : 'center'),
        borderBottom: `2px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
        background: isDark ? 'rgba(255,255,255,0.02)' : '#f9fafb',
    })

    const sortArrow = (key) => sortKey === key ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''

    return (
        <div style={{ padding: '28px 32px', minHeight: '100%', background: isDark ? '#0e0e12' : '#f3f4f8', fontFamily: '"Inter", system-ui, sans-serif', color: colors.text }}>
            <style>{`
                @keyframes fadeUp { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
                .rep-tr:hover td { background: ${isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,122,255,0.03)'} !important; }
                .rev-card:hover { transform: translateY(-1px); box-shadow: 0 8px 24px rgba(0,0,0,0.1) !important; }
                ::-webkit-scrollbar { width: 6px; height: 6px; } 
                ::-webkit-scrollbar-track { background: transparent; }
                ::-webkit-scrollbar-thumb { background: ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.12)'}; border-radius: 3px; }
            `}</style>

            {/* ═══ HEADER ═══════════════════════════════════════════════════════ */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '24px', animation: 'fadeUp 0.3s ease' }}>
                <div>
                    <h1 style={{ margin: '0 0 6px', fontSize: '28px', fontWeight: '800', letterSpacing: '-0.8px', lineHeight: 1 }}>
                        Reputație & Recenzii
                    </h1>
                    <p style={{ margin: 0, fontSize: '13px', color: colors.textSecondary }}>
                        Toate locațiile monitorizate • Date live din Glovo Partner, Wolt Merchant, Bolt Food
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={() => {
                        if (tableRows.length === 0) return
                        const csv = ['Locație,Oraș,Glovo Rating,Wolt Rating,Bolt Rating,Opriri,Pierderi (RON)',
                            ...sortedRows.map(r => `${r.restaurant.name},${r.restaurant.city || ''},${r.perPlatform.glovo?.rating || ''},${r.perPlatform.wolt?.rating || ''},${r.perPlatform.bolt?.rating || ''},${r.totalStops},${r.totalLoss.toFixed(0)}`)
                        ].join('\n')
                        const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = `reputatie_${period}.csv`; a.click()
                    }} style={{ padding: '9px 16px', borderRadius: '10px', border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`, background: 'transparent', color: colors.text, fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}>
                        ↓ Export CSV
                    </button>
                    <button onClick={() => setShowAddModal(true)} style={{ padding: '9px 18px', borderRadius: '10px', border: 'none', background: 'linear-gradient(135deg, #007AFF, #005ecb)', color: '#fff', fontSize: '12px', fontWeight: '700', cursor: 'pointer', boxShadow: '0 4px 14px rgba(0,122,255,0.35)' }}>
                        + Conectează Platformă
                    </button>
                </div>
            </div>

            {/* ═══ KPI STRIP ══════════════════════════════════════════════════════ */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '12px', marginBottom: '20px', animation: 'fadeUp 0.3s ease 0.05s both' }}>
                {[
                    { label: 'Locații monitorizate', value: restaurants.length, sub: `${tableRows.length} filtrate`, color: colors.blue },
                    { label: 'Rating Mediu Global', value: globalAvg, sub: 'Wolt + Bolt + Glovo', color: '#f59e0b' },
                    { label: 'Opriri în perioadă', value: totalStopsAll, sub: `${issueLocations} locații cu probleme`, color: totalStopsAll > 0 ? colors.red : colors.green },
                    { label: 'Pierderi Estimate', value: `${totalLossAll.toFixed(0)} RON`, sub: 'din opriri în perioadă', color: totalLossAll > 0 ? colors.red : colors.green },
                ].map((k, i) => (
                    <div key={i} style={{ ...card, padding: '18px 20px' }}>
                        <div style={{ marginBottom: '10px' }}>
                            <span style={{ fontSize: '11px', fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: '0.7px' }}>{k.label}</span>
                        </div>
                        <div style={{ fontSize: '28px', fontWeight: '800', color: k.color, lineHeight: 1, marginBottom: '4px' }}>{k.value}</div>
                        <div style={{ fontSize: '11px', color: colors.textSecondary }}>{k.sub}</div>
                    </div>
                ))}
            </div>

            {/* ═══ RATING EVOLUTION CHART ══════════════════════════════════════ */}
            <div style={{ ...card, marginBottom: '20px', padding: '22px 24px', animation: 'fadeUp 0.3s ease 0.07s both' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
                    <div>
                        <div style={{ fontSize: '15px', fontWeight: '800', color: colors.text, letterSpacing: '-0.3px' }}>Evoluția Ratingului pe Luni</div>
                        <div style={{ fontSize: '12px', color: colors.textSecondary, marginTop: '4px' }}>Comparativ Glovo / Wolt / Bolt — rating Bolt normalizat la scara 0–8210 pentru comparabilitate</div>
                    </div>
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        {PL_CHART.map(pl => (
                            <span key={pl.id} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', fontWeight: '700', color: pl.color }}>
                                <span style={{ width: 20, height: 2.5, background: pl.color, borderRadius: '2px', display: 'block' }} />
                                {pl.name}
                            </span>
                        ))}
                        <div style={{ width: 1, height: 18, background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)', margin: '0 4px' }} />
                        {[[3,'3L'],[6,'6L'],[12,'1A']].map(([n, lbl]) => (
                            <button key={String(n)} onClick={() => setChartMonths(Number(n))} style={{
                                padding: '5px 11px', borderRadius: '7px', fontSize: '11px', fontWeight: '700', cursor: 'pointer', transition: 'all 0.13s',
                                background: chartMonths === n ? colors.blue : 'transparent',
                                color: chartMonths === n ? '#fff' : colors.textSecondary,
                                border: `1px solid ${chartMonths === n ? colors.blue : isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
                            }}>{lbl}</button>
                        ))}
                    </div>
                </div>
                <RatingChart data={finalChartData} months={chartMonthKeys} isDark={isDark} colors={colors} />
            </div>

            {/* ═══ FILTERS BAR ══════════════════════════════════════════════════ */}
            <div style={{ ...card, padding: '14px 20px', marginBottom: '20px', display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap', animation: 'fadeUp 0.3s ease 0.08s both' }}>
                {/* Period selector */}
                <div style={{ display: 'flex', gap: '4px' }}>
                    {PERIODS.map(p => (
                        <button key={p.id} onClick={() => setPeriod(p.id)} style={{
                            padding: '6px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: '600', cursor: 'pointer', transition: 'all 0.15s',
                            background: period === p.id ? colors.blue : 'transparent',
                            color: period === p.id ? '#fff' : colors.textSecondary,
                            border: `1px solid ${period === p.id ? colors.blue : isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
                        }}>{p.label}</button>
                    ))}
                </div>
                <div style={{ width: 1, height: 24, background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' }} />
                {/* Brand */}
                <select value={brandFilter} onChange={e => setBrandFilter(e.target.value)} style={{ padding: '7px 12px', borderRadius: '8px', border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`, background: isDark ? 'rgba(255,255,255,0.04)' : '#f9f9f9', color: colors.text, fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>
                    <option value="all">Toate Brandurile</option>
                    {brands.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
                {/* City */}
                <select value={cityFilter} onChange={e => setCityFilter(e.target.value)} style={{ padding: '7px 12px', borderRadius: '8px', border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`, background: isDark ? 'rgba(255,255,255,0.04)' : '#f9f9f9', color: colors.text, fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>
                    <option value="all">Toate Orașele</option>
                    {cities.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <span style={{ marginLeft: 'auto', fontSize: '12px', color: colors.textSecondary }}>
                    {sortedRows.length} locații
                </span>
            </div>

            {/* ═══ RATING TABLE ════════════════════════════════════════════════ */}
            <div style={{ ...card, marginBottom: '20px', overflow: 'hidden', animation: 'fadeUp 0.3s ease 0.12s both' }}>
                <div style={{ padding: '18px 22px 14px', borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}` }}>
                    <h2 style={{ margin: 0, fontSize: '15px', fontWeight: '800', letterSpacing: '-0.3px' }}>Matrice Rating Locații</h2>
                    <p style={{ margin: '4px 0 0', fontSize: '12px', color: colors.textSecondary }}>Click pe orice celulă cu ↗ pentru acces direct în portalul comerciantului. Click pe antet pentru sortare.</p>
                </div>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', minWidth: '900px' }}>
                        <thead>
                            <tr>
                                {['name', 'city', 'glovo', 'wolt', 'bolt', 'issues', 'stops', 'loss'].map(k => (
                                    <th key={k} onClick={() => toggleSort(k)} style={thStyle(k)}>
                                        {k === 'name' ? 'Locație' : k === 'city' ? 'Oraș' : k === 'glovo' ? '🟡 Glovo' : k === 'wolt' ? '🔵 Wolt' : k === 'bolt' ? '🟢 Bolt' : k === 'issues' ? 'Platf. Indispon.' : k === 'stops' ? 'Opriri' : 'Pierderi'}
                                        {sortArrow(k)}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {sortedRows.length === 0 ? (
                                <tr><td colSpan={8} style={{ padding: '48px', textAlign: 'center', color: colors.textSecondary, fontSize: '13px' }}>
                                    {restaurants.length === 0 ? 'Se încarcă locațiile...' : 'Nicio locație nu corespunde filtrelor selectate'}
                                </td></tr>
                            ) : sortedRows.map((row, idx) => {
                                const hasIssue = row.unavailPlatforms > 0 || row.totalStops > 0
                                return (
                                    <tr key={row.restaurant.id} className="rep-tr" style={{ borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.05)'}`, background: idx % 2 === 0 ? 'transparent' : (isDark ? 'rgba(255,255,255,0.01)' : 'rgba(0,0,0,0.008)') }}>
                                        <td style={{ padding: '13px 14px', fontWeight: '600' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                {hasIssue && <span style={{ width: 7, height: 7, borderRadius: '50%', background: colors.red, flexShrink: 0, boxShadow: `0 0 6px ${colors.red}80` }} />}
                                                {row.restaurant.name}
                                            </div>
                                        </td>
                                        <td style={{ padding: '13px 14px', color: colors.textSecondary, fontSize: '12px' }}>{row.restaurant.city || '—'}</td>
                                        <PortalCell value={row.perPlatform.glovo?.rating ? parseFloat(row.perPlatform.glovo.rating).toFixed(1) : null} url={row.perPlatform.glovo?.url || getPortalUrl(row.restaurant.name, 'glovo')} color="#F5A623" isDark={isDark} />
                                        <PortalCell value={row.perPlatform.wolt?.rating ? parseFloat(row.perPlatform.wolt.rating).toFixed(1) : null} url={row.perPlatform.wolt?.url || getPortalUrl(row.restaurant.name, 'wolt')} color="#009DE0" isDark={isDark} />
                                        <PortalCell value={row.perPlatform.bolt?.rating ? parseFloat(row.perPlatform.bolt.rating).toFixed(1) : null} url={row.perPlatform.bolt?.url || getPortalUrl(row.restaurant.name, 'bolt')} color="#34D186" isDark={isDark} />
                                        <td style={{ padding: '13px 14px', textAlign: 'center' }}>
                                            {row.unavailPlatforms > 0 ? (
                                                <span style={{ padding: '3px 9px', borderRadius: '20px', background: 'rgba(255,59,48,0.12)', color: '#FF3B30', fontSize: '11px', fontWeight: '700' }}>{row.unavailPlatforms} offline</span>
                                            ) : <span style={{ color: colors.green, fontSize: '12px', fontWeight: '600' }}>✓ OK</span>}
                                        </td>
                                        <td style={{ padding: '13px 14px', textAlign: 'center', fontWeight: '700', color: row.totalStops > 0 ? colors.red : colors.textSecondary }}>{row.totalStops || '—'}</td>
                                        <td style={{ padding: '13px 14px', textAlign: 'center', fontWeight: '700', color: row.totalLoss > 0 ? colors.red : colors.textSecondary }}>
                                            {row.totalLoss > 0 ? `${row.totalLoss.toFixed(0)} RON` : '—'}
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                        {sortedRows.length > 0 && (
                            <tfoot>
                                <tr style={{ borderTop: `2px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`, background: isDark ? 'rgba(255,255,255,0.03)' : '#f0f4ff' }}>
                                    <td colSpan={2} style={{ padding: '12px 14px', fontWeight: '800', fontSize: '12px', color: colors.textSecondary }}>TOTAL / MEDIE ({sortedRows.length} locații)</td>
                                    {['glovo', 'wolt', 'bolt'].map(p => {
                                        const vals = sortedRows.map(r => parseFloat(r.perPlatform[p]?.rating)).filter(Boolean)
                                        const avg = vals.length > 0 ? (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1) : '—'
                                        const col = PL[p]?.color || '#888'
                                        return <td key={p} style={{ padding: '12px 14px', textAlign: 'center', fontWeight: '800', color: col }}>{avg}</td>
                                    })}
                                    <td style={{ padding: '12px 14px', textAlign: 'center', fontWeight: '800', color: issueLocations > 0 ? colors.red : colors.green }}>{issueLocations} cu prob.</td>
                                    <td style={{ padding: '12px 14px', textAlign: 'center', fontWeight: '800', color: totalStopsAll > 0 ? colors.red : colors.textSecondary }}>{totalStopsAll}</td>
                                    <td style={{ padding: '12px 14px', textAlign: 'center', fontWeight: '800', color: totalLossAll > 0 ? colors.red : colors.textSecondary }}>{totalLossAll > 0 ? `${totalLossAll.toFixed(0)} RON` : '—'}</td>
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>
            </div>

            {/* ═══ REVIEW INBOX ════════════════════════════════════════════════ */}
            <div style={{ ...card, animation: 'fadeUp 0.3s ease 0.18s both' }}>
                <div style={{ padding: '18px 22px', borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <h2 style={{ margin: 0, fontSize: '15px', fontWeight: '800' }}>Inbox Recenzii</h2>
                        <input type="file" id="rev-upload" accept=".xlsx, .xls, .csv" onChange={handleFileUpload} style={{ display: 'none' }} />
                        <button 
                            onClick={() => document.getElementById('rev-upload').click()}
                            disabled={isUploading}
                            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 14px', backgroundColor: '#116d74', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: '700', cursor: isUploading ? 'not-allowed' : 'pointer', transition: 'all 0.2s', boxShadow: '0 4px 12px rgba(17,109,116,0.2)' }}>
                            <UploadCloud size={14} />
                            {isUploading ? '...' : 'Importă Excel'}
                        </button>
                    </div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                        {[
                            { id: 'all', label: 'Toate' },
                            { id: 'negative', label: '🚨 Negative' },
                            { id: 'unreplied', label: '💬 Fără Răspuns' },
                        ].map(f => (
                            <button key={f.id} onClick={() => setReviewFilter(f.id)} style={{
                                padding: '6px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: '600', cursor: 'pointer', transition: 'all 0.15s',
                                background: reviewFilter === f.id ? (f.id === 'negative' ? 'rgba(255,59,48,0.15)' : colors.blue) : 'transparent',
                                color: reviewFilter === f.id ? (f.id === 'negative' ? colors.red : '#fff') : colors.textSecondary,
                                border: `1px solid ${reviewFilter === f.id ? (f.id === 'negative' ? colors.red : colors.blue) : (isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)')}`,
                            }}>{f.label}</button>
                        ))}
                        <span style={{ marginLeft: '8px', fontSize: '12px', color: colors.textSecondary, alignSelf: 'center' }}>{reviewFeed.length} recenzii</span>
                    </div>
                </div>
                <div style={{ padding: '16px 22px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {reviewFeed.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '48px', color: colors.textSecondary, fontSize: '13px' }}>
                            {reviewFilter !== 'all' ? 'Nicio recenzie în categoria selectată.' : 'Nicio recenzie disponibilă pentru perioada și filtrele selectate.'}
                        </div>
                    ) : reviewFeed.map(r => (
                        <div key={r.id} className="rev-card" style={{ display: 'flex', gap: '14px', padding: '16px', borderRadius: '12px', background: isDark ? 'rgba(255,255,255,0.03)' : '#f9fafb', border: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)'}`, transition: 'all 0.15s' }}>
                            {/* Avatar */}
                            <div style={{ width: 40, height: 40, borderRadius: '50%', background: `${PL[r.platform]?.color || '#888'}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', fontWeight: '800', color: PL[r.platform]?.color || '#888', flexShrink: 0 }}>
                                {r.author.charAt(0).toUpperCase()}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
                                    <span style={{ fontWeight: '700', fontSize: '13px' }}>{r.author}</span>
                                    <PBadge p={r.platform} />
                                    <span style={{ fontSize: '11px', color: colors.textSecondary }}>• {r.location}</span>
                                    {r.city && r.city !== r.location && <span style={{ fontSize: '11px', color: colors.textSecondary }}>({r.city})</span>}
                                    <span style={{ marginLeft: 'auto', fontSize: '11px', color: colors.textSecondary }}>{new Date(r.date).toLocaleDateString('ro-RO')}</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                                    <Stars rating={r.rating} max={r.platform === 'google' || r.platform === 'bolt' ? 5 : 10} />
                                    <Badge type={r.sentiment}>{r.sentiment === 'positive' ? 'Pozitiv' : r.sentiment === 'negative' ? 'Negativ' : 'Neutru'}</Badge>
                                </div>
                                <p style={{ margin: '0 0 10px', fontSize: '13px', lineHeight: '1.55', color: colors.text }}>{r.text}</p>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    {r.replied ? (
                                        <span style={{ fontSize: '12px', color: colors.green, fontWeight: '700', display: 'flex', alignItems: 'center', gap: '5px' }}>✓ Răspuns trimis</span>
                                    ) : (
                                        <>
                                            <button style={{ padding: '6px 14px', borderRadius: '7px', background: isDark ? 'rgba(0,122,255,0.15)' : '#eff6ff', color: colors.blue, border: `1px solid ${isDark ? 'rgba(0,122,255,0.2)' : 'rgba(0,122,255,0.2)'}`, fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}>
                                                🤖 Răspunde cu AI
                                            </button>
                                            {r.sentiment === 'negative' && (
                                                <button style={{ padding: '6px 14px', borderRadius: '7px', background: 'rgba(255,59,48,0.1)', color: colors.red, border: `1px solid rgba(255,59,48,0.2)`, fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}>
                                                    🔔 Alertă Telegram
                                                </button>
                                            )}
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* ═══ MODAL ════════════════════════════════════════════════════════ */}
            {showAddModal && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, backdropFilter: 'blur(4px)' }}>
                    <div style={{ ...card, padding: '32px', width: '400px', maxWidth: '90vw' }}>
                        <h2 style={{ margin: '0 0 8px', fontSize: '20px', fontWeight: '800' }}>Conectează Platformă</h2>
                        <p style={{ margin: '0 0 24px', fontSize: '13px', color: colors.textSecondary }}>Selectează platforma pentru a integra sincronizarea automată a recenziilor și ratingurilor.</p>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '24px' }}>
                            {['Google My Business', 'Facebook Pages', 'TripAdvisor', 'Yelp'].map(p => (
                                <button key={p} onClick={() => setShowAddModal(false)} style={{ padding: '14px', border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`, background: 'transparent', color: colors.text, borderRadius: '10px', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}>
                                    {p}
                                </button>
                            ))}
                        </div>
                        <button onClick={() => setShowAddModal(false)} style={{ width: '100%', padding: '10px', borderRadius: '10px', border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`, background: 'transparent', color: colors.textSecondary, cursor: 'pointer', fontWeight: '600' }}>Anulează</button>
                    </div>
                </div>
            )}
        </div>
    )
}
