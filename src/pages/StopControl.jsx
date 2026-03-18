import { useTheme } from '../lib/ThemeContext'
import { useLanguage } from '../lib/LanguageContext'
import { supabase } from '../lib/supabaseClient'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useCallback, useEffect } from 'react'

/* eslint-disable */
function getWorkerUrl() { try { return (new Function('return import.meta.env.VITE_WORKER_URL'))() || 'http://localhost:3001' } catch(_) { return 'http://localhost:3001' } }
const WORKER_URL = getWorkerUrl()
const PLATFORM_COLORS = { wolt: '#009de0', glovo: '#FFC244', bolt: '#34D186' }

// ─── Glass card helpers (same as Monitoring) ─────────────
function glassCard(isDark) {
    return {
        background: isDark ? 'rgba(30,32,40,0.65)' : '#ffffff',
        backdropFilter: isDark ? 'blur(24px) saturate(180%)' : 'none',
        WebkitBackdropFilter: isDark ? 'blur(24px) saturate(180%)' : 'none',
        borderRadius: '20px',
        border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.08)',
        boxShadow: isDark
            ? '0 8px 32px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)'
            : '0 2px 12px rgba(0,0,0,0.08), 0 0 1px rgba(0,0,0,0.1)',
    }
}
function glassInner(isDark) {
    return {
        background: isDark ? 'rgba(40,42,54,0.45)' : 'rgba(0,0,0,0.03)',
        backdropFilter: isDark ? 'blur(12px)' : 'none',
        WebkitBackdropFilter: isDark ? 'blur(12px)' : 'none',
        borderRadius: '16px',
        border: isDark ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(0,0,0,0.06)',
    }
}

// ─── SVG Icons ────────────────────────────────────────────
const Icon = {
    stop: (c='currentColor',s=18) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><rect x="9" y="9" width="6" height="6" rx="1"/></svg>,
    clock: (c='currentColor',s=16) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
    loss: (c='currentColor',s=18) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>,
    check: (c='currentColor',s=16) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,
    refresh: (c='currentColor',s=16) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>,
    scan: (c='currentColor',s=16) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
    authorize: (c='currentColor',s=14) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,
    history: (c='currentColor',s=16) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
    home: (c='currentColor',s=14) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>,
    alert: (c='currentColor',s=18) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
    spin: (s=14) => <span style={{display:'inline-block',width:s,height:s,border:`2px solid rgba(255,255,255,0.3)`,borderTopColor:'#fff',borderRadius:'50%',animation:'spin 0.7s linear infinite'}} />,
}

function AnimCounter({ value = 0, suffix = '', duration = 700 }) {
    const [display, setDisplay] = useState(0)
    useEffect(() => {
        let start = 0
        const end = typeof value === 'number' ? value : 0
        if (end === 0) { setDisplay(0); return }
        const step = Math.max(1, Math.floor(end / (duration / 16)))
        const t = setInterval(() => {
            start += step
            if (start >= end) { setDisplay(end); clearInterval(t) }
            else setDisplay(start)
        }, 16)
        return () => clearInterval(t)
    }, [value, duration])
    return <>{display}{suffix}</>
}

function PlatformBadge({ platform, size = 18 }) {
    const logos = {
        glovo: 'https://upload.wikimedia.org/wikipedia/commons/7/78/Current_Logo_Glovo.jpg',
        wolt: 'https://brandlogos.net/wp-content/uploads/2025/05/wolt-logo_brandlogos.net_dijtc.png',
        bolt: 'https://media.voog.com/0000/0039/0361/photos/Bolt.png',
    }
    return <img src={logos[platform] || ''} alt={platform}
        style={{ width: size, height: size, objectFit: 'contain', borderRadius: '4px', background: 'white' }}
        onError={e => { e.currentTarget.style.display = 'none' }} />
}

function formatDuration(minutes) {
    if (!minutes || minutes < 1) return '< 1 min'
    if (minutes < 60) return `${Math.round(minutes)} min`
    const h = Math.floor(minutes / 60), m = Math.round(minutes % 60)
    return m > 0 ? `${h}h ${m}m` : `${h}h`
}
function formatLoss(v) { return v ? `${Number(v).toFixed(0)} RON` : '0 RON' }
function timeAgo(d) {
    if (!d) return '—'
    const diff = (Date.now() - new Date(d).getTime()) / 60000
    if (diff < 1) return 'acum'
    if (diff < 60) return `${Math.round(diff)} min`
    if (diff < 1440) return `${Math.floor(diff / 60)}h ${Math.round(diff % 60)}m`
    return `${Math.floor(diff / 1440)}z`
}

export default function StopControl() {
    const { lang } = useLanguage()
    const { colors, isDark } = useTheme()
    const queryClient = useQueryClient()
    const glass = glassCard(isDark)
    const inner = glassInner(isDark)

    const [selectedFilter, setSelectedFilter] = useState('all')
    const [platformFilter, setPlatformFilter] = useState('all')

    // ─── Product Scanner State ─────────────────────────────
    const [productStopped, setProductStopped] = useState({})
    const [scanningProducts, setScanningProducts] = useState(false)
    const [productScanMsg, setProductScanMsg] = useState(null)
    const [productScanned, setProductScanned] = useState(false)
    const [scanHistory, setScanHistory] = useState([])
    const [expandedRest, setExpandedRest] = useState({})

    const loadHistory = useCallback(async () => {
        const { data } = await supabase.from('product_stop_history')
            .select('id, checked_at, reference_date, check_date, missing_count, restaurant_count')
            .order('checked_at', { ascending: false }).limit(10)
        setScanHistory(data || [])
    }, [])

    useEffect(() => { loadHistory() }, [loadHistory])

    const scanAndCompareProducts = useCallback(async () => {
        setScanningProducts(true)
        setProductScanMsg(null)
        try {
            try { await fetch(`${WORKER_URL}/api/own-brands/scrape-all`, { method: 'POST' }) } catch (_) {}
            const today = new Date().toISOString().split('T')[0]
            const { data: latestRef } = await supabase.from('own_product_snapshots')
                .select('snapshot_date').lt('snapshot_date', today)
                .order('snapshot_date', { ascending: false }).limit(1)
            const refDate = latestRef?.[0]?.snapshot_date
            if (!refDate) {
                setProductScanMsg({ ok: false, text: 'Nu exista nicio scanare anterioara de referinta. Ruleaza mai intai o scanare completa.' })
                setProductScanned(true)
                return
            }
            const [{ data: refData }, { data: todayData }, { data: restaurants }] = await Promise.all([
                supabase.from('own_product_snapshots').select('restaurant_id, platform, product_name, category, price').eq('snapshot_date', refDate),
                supabase.from('own_product_snapshots').select('restaurant_id, platform, product_name').eq('snapshot_date', today),
                supabase.from('restaurants').select('id, name, city, brands(name, logo_url)').eq('is_active', true)
            ])
            const todayKeys = new Set((todayData || []).map(p => `${p.restaurant_id}|${p.platform}|${p.product_name}`))
            const restMap = {}
            ;(restaurants || []).forEach(r => { restMap[r.id] = r })
            const missing = (refData || []).filter(p => !todayKeys.has(`${p.restaurant_id}|${p.platform}|${p.product_name}`))
            const grouped = {}
            missing.forEach(p => {
                const rid = p.restaurant_id
                const rest = restMap[rid]
                if (!grouped[rid]) grouped[rid] = { name: rest?.name || rid, city: rest?.city || '', logo: rest?.brands?.logo_url, byPlatform: {} }
                if (!grouped[rid].byPlatform[p.platform]) grouped[rid].byPlatform[p.platform] = []
                grouped[rid].byPlatform[p.platform].push({ name: p.product_name, category: p.category, price: p.price })
            })
            setProductStopped(grouped)
            setProductScanMsg({ ok: missing.length === 0, text: missing.length === 0
                ? `Toate produsele disponibile (ref: ${refDate})`
                : `${missing.length} produse lipsa in ${Object.keys(grouped).length} restaurante (ref: ${refDate})` })
            setProductScanned(true)
            await supabase.from('product_stop_history').insert({
                reference_date: refDate, check_date: today,
                missing_count: missing.length, restaurant_count: Object.keys(grouped).length, results: grouped
            })
            await loadHistory()
        } catch (e) {
            setProductScanMsg({ ok: false, text: e.message })
        } finally { setScanningProducts(false) }
    }, [loadHistory])

    // ─── Data Queries ──────────────────────────────────────
    const { data: activeStops = [], isLoading: loadingActive } = useQuery({
        queryKey: ['active-stops'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('stop_events').select('*, restaurants(name, city, revenue_per_hour)')
                .is('resumed_at', null).order('stopped_at', { ascending: false })
            if (error) throw error
            return data || []
        },
        refetchInterval: 30000
    })

    const { data: stopEvents = [], isLoading: loadingEvents } = useQuery({
        queryKey: ['stop-events'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('stop_events').select('*, restaurants(name, city, revenue_per_hour)')
                .order('stopped_at', { ascending: false }).limit(100)
            if (error) throw error
            return data || []
        },
        refetchInterval: 60000
    })

    const authorizeMutation = useMutation({
        mutationFn: async (stopId) => {
            const { error } = await supabase.from('stop_events')
                .update({ authorized: true, authorized_at: new Date().toISOString() }).eq('id', stopId)
            if (error) throw error
        },
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['active-stops'] }); queryClient.invalidateQueries({ queryKey: ['stop-events'] }) }
    })

    // ─── Computed ──────────────────────────────────────────
    const now = new Date()
    const todayStr = now.toISOString().split('T')[0]
    const todayEvents = stopEvents.filter(e => e.stopped_at?.startsWith(todayStr))
    const totalActiveLoss = activeStops.reduce((s, e) => {
        const rph = e.restaurants?.revenue_per_hour || 0
        const mins = (Date.now() - new Date(e.stopped_at).getTime()) / 60000
        return s + (rph * mins / 60)
    }, 0)
    const todayLoss = todayEvents.reduce((s, e) => {
        const rph = e.restaurants?.revenue_per_hour || 0
        const startT = new Date(e.stopped_at).getTime()
        const endT = e.resumed_at ? new Date(e.resumed_at).getTime() : now.getTime()
        return s + (rph * (endT - startT) / 3600000)
    }, 0)

    const filteredEvents = selectedFilter === 'active' ? activeStops
        : selectedFilter === 'resolved' ? stopEvents.filter(e => e.resumed_at) : stopEvents
    const displayEvents = platformFilter === 'all' ? filteredEvents
        : filteredEvents.filter(e => e.platform === platformFilter)

    // ─── Styles ────────────────────────────────────────────
    const btnBase = {
        display: 'inline-flex', alignItems: 'center', gap: '6px',
        border: 'none', borderRadius: '12px', fontSize: '13px',
        fontWeight: '600', cursor: 'pointer', transition: 'all 0.2s ease', fontFamily: 'inherit',
    }
    const btnPrimary = { ...btnBase, padding: '9px 18px', background: 'linear-gradient(135deg,#6366F1,#8B5CF6)', color: '#fff', boxShadow: '0 4px 14px rgba(99,102,241,0.35)' }
    const btnGhost = { ...btnBase, padding: '9px 14px', background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)', color: colors.text, border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.08)' }
    const filterBtn = (active) => ({
        ...btnBase, padding: '6px 14px', fontSize: '12px', borderRadius: '8px',
        background: active ? (isDark ? 'rgba(99,102,241,0.2)' : 'rgba(99,102,241,0.1)') : 'transparent',
        color: active ? '#6366F1' : colors.textSecondary,
        border: active ? '1px solid rgba(99,102,241,0.3)' : `1px solid transparent`,
        fontWeight: active ? '700' : '500',
    })

    const kpiCards = [
        {
            label: lang === 'en' ? 'Active Stops' : 'Opriri Active',
            value: activeStops.length,
            sub: activeStops.length > 0 ? (lang === 'en' ? 'needs attention!' : 'necesită atenție!') : (lang === 'en' ? 'all good' : 'totul în regulă'),
            color: activeStops.length > 0 ? '#FF453A' : '#34C759',
            bg: activeStops.length > 0 ? 'rgba(255,69,58,0.12)' : 'rgba(52,199,89,0.12)',
            icon: Icon.stop(activeStops.length > 0 ? '#FF453A' : '#34C759', 20),
        },
        {
            label: lang === 'en' ? 'Live Loss' : 'Pierdere Live',
            value: Math.round(totalActiveLoss),
            suffix: ' RON',
            sub: lang === 'en' ? 'from active stops' : 'din opriri active',
            color: totalActiveLoss > 0 ? '#FF9500' : colors.text,
            bg: 'rgba(255,149,0,0.12)',
            icon: Icon.loss('#FF9500', 20),
        },
        {
            label: lang === 'en' ? 'Stops Today' : 'Opriri Azi',
            value: todayEvents.length,
            sub: lang === 'en' ? 'in the last 24h' : 'in ultimele 24h',
            color: '#8B5CF6',
            bg: 'rgba(139,92,246,0.12)',
            icon: Icon.clock('#8B5CF6', 20),
        },
        {
            label: lang === 'en' ? 'Loss Today' : 'Pierdere Azi',
            value: Math.round(todayLoss),
            suffix: ' RON',
            sub: formatLoss(todayLoss),
            color: '#10B981',
            bg: 'rgba(16,185,129,0.12)',
            icon: Icon.loss('#10B981', 20),
        },
    ]

    return (
        <div style={{
            padding: '24px 32px',
            fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Inter", system-ui, sans-serif',
        }}>
            <style>{`
                @keyframes fadeUp { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
                @keyframes spin { to { transform: rotate(360deg); } }
                @keyframes pulse-dot { 0%,100% { transform:scale(1); opacity:1; } 50% { transform:scale(1.4); opacity:0.7; } }
                .sc-card { transition: transform 0.2s ease, box-shadow 0.2s ease; }
                .sc-card:hover { transform: translateY(-2px); box-shadow: 0 8px 32px rgba(0,0,0,0.12); }
                .sc-row { transition: background 0.15s ease; }
                .sc-row:hover { background: ${isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)'} !important; }
                .btn-h:hover { transform:translateY(-1px); filter:brightness(1.08); }
                .btn-h:active { transform:scale(0.97); }
            `}</style>

            {/* ══ HEADER ══ */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '28px', animation: 'fadeUp 0.3s ease' }}>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '4px' }}>
                        <div style={{ width: 36, height: 36, borderRadius: '10px', background: 'linear-gradient(135deg,#FF453A,#FF6B6B)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(255,69,58,0.3)' }}>
                            {Icon.stop('#fff', 18)}
                        </div>
                        <h1 style={{ fontSize: '26px', fontWeight: '700', margin: 0, color: colors.text, letterSpacing: '-0.5px' }}>
                            Stop Control
                        </h1>
                    </div>
                    <p style={{ fontSize: '13px', color: colors.textSecondary, margin: '2px 0 0 48px' }}>
                        {lang === 'en' ? 'Monitor stops and financial losses' : 'Monitorizare opriri și pierderi financiare'} · {now.toLocaleTimeString('ro-RO')}
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button className="btn-h" onClick={() => { queryClient.invalidateQueries({ queryKey: ['active-stops'] }); queryClient.invalidateQueries({ queryKey: ['stop-events'] }) }} style={btnGhost}>
                        {Icon.refresh(colors.textSecondary)} Refresh
                    </button>
                </div>
            </div>

            {/* ══ KPI CARDS ══ */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '16px', marginBottom: '24px' }}>
                {kpiCards.map((k, i) => (
                    <div key={i} className="sc-card" style={{ ...glass, padding: '22px 24px', animation: `fadeUp 0.3s ease ${0.05 * i + 0.05}s both` }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
                            <span style={{ fontSize: '12px', fontWeight: '500', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{k.label}</span>
                            <div style={{ width: 38, height: 38, borderRadius: '11px', background: k.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                {k.icon}
                            </div>
                        </div>
                        <div style={{ fontSize: '34px', fontWeight: '700', color: k.color, lineHeight: 1, letterSpacing: '-1px', marginBottom: '6px' }}>
                            <AnimCounter value={k.value} suffix={k.suffix || ''} />
                        </div>
                        <div style={{ fontSize: '12px', color: k.color === '#34C759' ? '#34C759' : k.value === 0 ? colors.textSecondary : k.color, fontWeight: k.value > 0 && k.label !== 'Pierdere Azi' ? '600' : '400', opacity: 0.85 }}>
                            {k.sub}
                        </div>
                    </div>
                ))}
            </div>

            {/* ══ PRODUCT AVAILABILITY SCANNER ══ */}
            <div style={{ ...glass, marginBottom: '24px', overflow: 'hidden', animation: 'fadeUp 0.3s ease 0.25s both' }}>
                {/* Header row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '20px 24px', borderBottom: `1px solid ${isDark ? 'rgba(239,68,68,0.15)' : 'rgba(239,68,68,0.1)'}`, background: isDark ? 'rgba(239,68,68,0.05)' : 'rgba(239,68,68,0.03)' }}>
                    <div style={{ width: 38, height: 38, borderRadius: '11px', background: 'rgba(239,68,68,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {Icon.scan('#ef4444', 18)}
                    </div>
                    <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '15px', fontWeight: '700', color: colors.text, marginBottom: '2px' }}>
                            Produse pe Stop
                        </div>
                        <div style={{ fontSize: '12px', color: colors.textSecondary }}>
                            {lang === 'en' ? 'Compare current menu with last reference scan — shows missing products by restaurant and platform' : 'Compara meniul curent cu ultima scanare de referinta — arata produsele lipsa per restaurant si platforma'}
                        </div>
                    </div>
                    <button className="btn-h" onClick={scanAndCompareProducts} disabled={scanningProducts}
                        style={{ ...btnBase, padding: '11px 22px', background: scanningProducts ? 'rgba(239,68,68,0.4)' : 'linear-gradient(135deg,#ef4444,#dc2626)', color: '#fff', boxShadow: scanningProducts ? 'none' : '0 4px 16px rgba(239,68,68,0.35)', whiteSpace: 'nowrap', flexShrink: 0, cursor: scanningProducts ? 'wait' : 'pointer' }}>
                        {scanningProducts ? <>{Icon.spin(14)} Se scaneaza...</> : <>{Icon.scan('#fff', 14)} {lang === 'en' ? 'Scan and compare' : 'Scaneaza si compara'}</>}
                    </button>
                </div>

                {/* Message bar */}
                {productScanMsg && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 24px', fontSize: '12px', fontWeight: '600', color: productScanMsg.ok ? '#22c55e' : '#ef4444', background: productScanMsg.ok ? 'rgba(34,197,94,0.06)' : 'rgba(239,68,68,0.06)', borderBottom: `1px solid ${productScanMsg.ok ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.12)'}` }}>
                        <span>{productScanMsg.text}</span>
                        <button onClick={() => setProductScanMsg(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontSize: '16px', lineHeight: 1 }}>×</button>
                    </div>
                )}

                {/* Results */}
                {productScanned && (
                    Object.keys(productStopped).length === 0 ? (
                        <div style={{ padding: '32px', textAlign: 'center' }}>
                            <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(34,197,94,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                                {Icon.check('#22c55e', 20)}
                            </div>
                            <div style={{ fontSize: '14px', fontWeight: '700', color: '#22c55e', marginBottom: '4px' }}>{lang === 'en' ? 'All products are available' : 'Toate produsele sunt disponibile'}</div>
                            <div style={{ fontSize: '12px', color: colors.textSecondary }}>Nicio diferenta fata de scanarea de referinta</div>
                        </div>
                    ) : (
                        <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
                            {Object.entries(productStopped).map(([rid, data]) => {
                                const isExpanded = !!expandedRest[rid]
                                const totalMissing = Object.values(data.byPlatform).reduce((s, a) => s + a.length, 0)
                                return (
                                <div key={rid} style={{ borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}` }}>
                                    <div onClick={() => setExpandedRest(prev => ({ ...prev, [rid]: !prev[rid] }))} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 24px', background: isDark ? 'rgba(239,68,68,0.05)' : 'rgba(239,68,68,0.03)', cursor: 'pointer', transition: 'background 0.15s' }}>
                                        <span style={{ fontSize: '10px', color: '#ef4444', transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.15s', display: 'inline-block', lineHeight: 1, flexShrink: 0 }}>▶</span>
                                        <div style={{ width: 28, height: 28, borderRadius: '8px', background: data.logo ? 'white' : 'rgba(239,68,68,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                                            {data.logo ? <img src={data.logo} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} onError={e => e.currentTarget.style.display='none'} /> : Icon.home('#ef4444', 13)}
                                        </div>
                                        <span style={{ fontSize: '13px', fontWeight: '700', color: colors.text, flex: 1 }}>{data.name}</span>
                                        <span style={{ fontSize: '11px', color: colors.textSecondary, marginRight: '8px' }}>{data.city}</span>
                                        <span style={{ fontSize: '11px', fontWeight: '800', color: '#ef4444', background: 'rgba(239,68,68,0.1)', padding: '2px 10px', borderRadius: '6px' }}>
                                            {totalMissing} lipsa
                                        </span>
                                    </div>
                                    {isExpanded && Object.entries(data.byPlatform).map(([platform, prods]) => (
                                        <div key={platform} style={{ padding: '10px 24px 12px 64px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                                                <PlatformBadge platform={platform} size={14} />
                                                <span style={{ fontSize: '10px', fontWeight: '800', color: PLATFORM_COLORS[platform] || '#888', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{platform}</span>
                                                <span style={{ fontSize: '11px', color: colors.textSecondary }}>— {prods.length} produse lipsa</span>
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                                {prods.map((p, i) => (
                                                    <div key={i} style={{ ...inner, display: 'flex', alignItems: 'center', gap: '10px', padding: '5px 10px' }}>
                                                        <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#ef4444', flexShrink: 0 }} />
                                                        <span style={{ flex: 1, fontSize: '12px', fontWeight: '500', color: colors.text }}>{p.name}</span>
                                                        {p.category && <span style={{ fontSize: '10px', color: colors.textSecondary, background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)', padding: '1px 6px', borderRadius: '4px' }}>{p.category}</span>}
                                                        {p.price && <span style={{ fontSize: '11px', fontWeight: '700', color: '#6366F1' }}>{Number(p.price).toFixed(2)} RON</span>}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )})}
                        </div>
                    )
                )}
            </div>

            {/* ══ ACTIVE STOPS BANNER ══ */}
            {activeStops.length > 0 && (
                <div style={{ ...glass, marginBottom: '24px', border: '1.5px solid rgba(255,69,58,0.25)', animation: 'fadeUp 0.3s ease 0.3s both' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '16px 24px', borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`, background: isDark ? 'rgba(255,69,58,0.08)' : 'rgba(255,69,58,0.04)' }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#FF453A', boxShadow: '0 0 8px rgba(255,69,58,0.6)', animation: 'pulse-dot 2s ease infinite' }} />
                        <span style={{ fontSize: '14px', fontWeight: '700', color: '#FF453A', flex: 1 }}>
                            {activeStops.length} {activeStops.length === 1 ? (lang === 'en' ? 'Active Stop' : 'Oprire Activa') : (lang === 'en' ? 'Active Stops' : 'Opriri Active')}{lang === 'en' ? ' — Action Required' : ' — Actiune Necesara'}
                        </span>
                        <span style={{ fontSize: '12px', color: colors.textSecondary }}>{lang === 'en' ? 'Ongoing loss: ' : 'Pierdere in curs: '}<strong style={{ color: '#FF9500' }}>{formatLoss(totalActiveLoss)}</strong></span>
                    </div>
                    {activeStops.map((stop, i) => {
                        const startMs = new Date(stop.stopped_at).getTime() || 0
            const mins = (Date.now() - startMs) / 60000
                        const rph = stop.restaurants?.revenue_per_hour || 0
                        const loss = rph * mins / 60
                        return (
                            <div key={stop.id} className="sc-row" style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '14px 24px', borderBottom: i < activeStops.length - 1 ? `1px solid ${isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}` : 'none' }}>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: '14px', fontWeight: '700', color: colors.text, marginBottom: '3px' }}>{stop.restaurants?.name || '—'}</div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        {stop.platform && <PlatformBadge platform={stop.platform} size={14} />}
                                        <span style={{ fontSize: '11px', color: colors.textSecondary }}>{stop.restaurants?.city}</span>
                                        {stop.stop_type && <span style={{ fontSize: '10px', fontWeight: '700', padding: '1px 6px', borderRadius: '4px', background: 'rgba(255,69,58,0.1)', color: '#FF453A' }}>{stop.stop_type}</span>}
                                    </div>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <div style={{ fontSize: '13px', fontWeight: '700', color: '#FF9500' }}>{formatDuration(mins)}</div>
                                    <div style={{ fontSize: '11px', color: '#FF453A', fontWeight: '600' }}>-{formatLoss(loss)}</div>
                                </div>
                                {!stop.authorized && (
                                    <button className="btn-h" onClick={() => authorizeMutation.mutate(stop.id)}
                                        style={{ ...btnBase, padding: '8px 14px', fontSize: '12px', background: 'rgba(52,199,89,0.12)', color: '#34C759', border: '1px solid rgba(52,199,89,0.25)' }}>
                                        {Icon.authorize('#34C759', 12)} {lang === 'en' ? 'Authorize' : 'Autorizeaza'}
                                    </button>
                                )}
                            </div>
                        )
                    })}
                </div>
            )}

            {/* ══ EVENTS TABLE ══ */}
            <div style={{ ...glass, animation: 'fadeUp 0.3s ease 0.35s both' }}>
                {/* Filters */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '16px 24px', borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`, flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', gap: '4px', background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)', padding: '3px', borderRadius: '10px' }}>
                        {[['all', lang === 'en' ? 'All' : 'Toate'], ['active', lang === 'en' ? 'Active' : 'Active'], ['resolved', lang === 'en' ? 'Resolved' : 'Rezolvate']].map(([v, l]) => (
                            <button key={v} onClick={() => setSelectedFilter(v)} style={filterBtn(selectedFilter === v)}>{l}</button>
                        ))}
                    </div>
                    <div style={{ flex: 1 }} />
                    <div style={{ display: 'flex', gap: '4px', background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)', padding: '3px', borderRadius: '10px' }}>
                        {[['all', lang === 'en' ? 'All' : 'Toate'], ['glovo', 'Glovo'], ['wolt', 'Wolt'], ['bolt', 'Bolt']].map(([v, l]) => (
                            <button key={v} onClick={() => setPlatformFilter(v)} style={filterBtn(platformFilter === v)}>
                                {v !== 'all' && <PlatformBadge platform={v} size={12} />}{l}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Table */}
                {loadingEvents ? (
                    <div style={{ padding: '48px', textAlign: 'center', color: colors.textSecondary }}>
                        <div style={{ width: 28, height: 28, border: `3px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}`, borderTopColor: '#6366F1', borderRadius: '50%', animation: 'spin 0.7s linear infinite', margin: '0 auto 12px' }} />
                        <div style={{ fontSize: '13px' }}>Se incarca...</div>
                    </div>
                ) : displayEvents.length === 0 ? (
                    <div style={{ padding: '48px', textAlign: 'center' }}>
                        <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(52,199,89,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                            {Icon.check('#34C759', 20)}
                        </div>
                        <div style={{ fontSize: '14px', fontWeight: '700', color: '#34C759' }}>{lang === 'en' ? 'No stop registered' : 'Nicio oprire inregistrata'}</div>
                        <div style={{ fontSize: '12px', color: colors.textSecondary, marginTop: '4px' }}>{lang === 'en' ? 'Everything is running normally' : 'Totul functioneaza normal'}</div>
                    </div>
                ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}` }}>
                                {['Restaurant', lang === 'en' ? 'Platform' : 'Platforma', lang === 'en' ? 'Type' : 'Tip', lang === 'en' ? 'Started' : 'Inceput', lang === 'en' ? 'Duration' : 'Durata', lang === 'en' ? 'Loss' : 'Pierdere', 'Status'].map(h => (
                                    <th key={h} style={{ padding: '12px 20px', textAlign: h === 'Restaurant' ? 'left' : 'center', fontSize: '11px', fontWeight: '600', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {displayEvents.map((e, i) => {
                                const isActive = !e.resumed_at
                                const startT2 = new Date(e.stopped_at).getTime()
                                const endT2 = e.resumed_at ? new Date(e.resumed_at).getTime() : now.getTime()
                                const mins = (endT2 - startT2) / 60000
                                const rph = e.restaurants?.revenue_per_hour || 0
                                const loss = rph * mins / 60
                                return (
                                    <tr key={e.id} className="sc-row" style={{ borderBottom: i < displayEvents.length - 1 ? `0.5px solid ${isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}` : 'none' }}>
                                        <td style={{ padding: '13px 20px' }}>
                                            <div style={{ fontSize: '13px', fontWeight: '600', color: colors.text }}>{e.restaurants?.name || '—'}</div>
                                            <div style={{ fontSize: '11px', color: colors.textSecondary, marginTop: '2px' }}>{e.restaurants?.city}</div>
                                        </td>
                                        <td style={{ padding: '13px 20px', textAlign: 'center' }}>
                                            {e.platform ? (
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                                                    <PlatformBadge platform={e.platform} size={16} />
                                                    <span style={{ fontSize: '12px', color: colors.text, textTransform: 'capitalize' }}>{e.platform}</span>
                                                </div>
                                            ) : '—'}
                                        </td>
                                        <td style={{ padding: '13px 20px', textAlign: 'center' }}>
                                            {e.stop_type && <span style={{ fontSize: '10px', fontWeight: '700', padding: '2px 8px', borderRadius: '5px', background: 'rgba(255,69,58,0.1)', color: '#FF453A', textTransform: 'uppercase' }}>{e.stop_type}</span>}
                                        </td>
                                        <td style={{ padding: '13px 20px', textAlign: 'center', fontSize: '12px', color: colors.textSecondary, whiteSpace: 'nowrap' }}>
                                            {new Date(e.stopped_at).toLocaleString('ro-RO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                        </td>
                                        <td style={{ padding: '13px 20px', textAlign: 'center', fontSize: '13px', fontWeight: '700', color: isActive ? '#FF9500' : colors.text }}>
                                            {formatDuration(mins)}
                                        </td>
                                        <td style={{ padding: '13px 20px', textAlign: 'center', fontSize: '13px', fontWeight: '700', color: loss > 0 ? '#FF9500' : '#34C759' }}>
                                            {formatLoss(loss)}
                                        </td>
                                        <td style={{ padding: '13px 20px', textAlign: 'center' }}>
                                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '3px 10px', borderRadius: '8px', fontSize: '11px', fontWeight: '700', background: isActive ? 'rgba(255,69,58,0.1)' : 'rgba(52,199,89,0.1)', color: isActive ? '#FF453A' : '#34C759' }}>
                                                <span style={{ width: 6, height: 6, borderRadius: '50%', background: isActive ? '#FF453A' : '#34C759', display: 'inline-block', animation: isActive ? 'pulse-dot 2s ease infinite' : 'none' }} />
                                                {isActive ? (lang === 'en' ? 'Active' : 'Activ') : (lang === 'en' ? 'Resolved' : 'Rezolvat')}
                                            </span>
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                )}
            </div>

            {/* ══ SCAN HISTORY ══ */}
            {scanHistory.length > 0 && (
                <div style={{ marginTop: '24px', animation: 'fadeUp 0.3s ease 0.4s both' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                        {Icon.history(colors.textSecondary, 15)}
                        <span style={{ fontSize: '14px', fontWeight: '700', color: colors.text }}>{lang === 'en' ? 'Product check history' : 'Istoric verificari produs'}</span>
                        <span style={{ fontSize: '11px', color: colors.textSecondary, background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)', padding: '2px 8px', borderRadius: '6px' }}>
                            {lang === 'en' ? 'last' : 'ultimele'} {scanHistory.length}
                        </span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {scanHistory.map(h => {
                            const dt = new Date(h.checked_at)
                            const hasIssues = h.missing_count > 0
                            return (
                                <div key={h.id} className="sc-card" style={{ ...glass, display: 'flex', alignItems: 'center', gap: '12px', padding: '11px 18px', border: `1px solid ${hasIssues ? 'rgba(239,68,68,0.15)' : 'rgba(52,199,89,0.12)'}` }}>
                                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: hasIssues ? '#ef4444' : '#22c55e', boxShadow: `0 0 6px ${hasIssues ? 'rgba(239,68,68,0.5)' : 'rgba(34,197,94,0.5)'}`, flexShrink: 0 }} />
                                    <div style={{ flex: 1 }}>
                                        <span style={{ fontSize: '12px', fontWeight: '700', color: colors.text }}>
                                            {dt.toLocaleDateString('ro-RO', { day: '2-digit', month: 'short', year: 'numeric' })} {dt.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                        <span style={{ fontSize: '11px', color: colors.textSecondary, marginLeft: '10px' }}>
                                            referinta: {h.reference_date} → {h.check_date}
                                        </span>
                                    </div>
                                    {hasIssues ? (
                                        <span style={{ fontSize: '11px', fontWeight: '800', color: '#ef4444', background: 'rgba(239,68,68,0.1)', padding: '2px 10px', borderRadius: '6px' }}>
                                            {h.missing_count} produse · {h.restaurant_count} restaurante
                                        </span>
                                    ) : (
                                        <span style={{ fontSize: '11px', fontWeight: '700', color: '#22c55e', background: 'rgba(34,197,94,0.1)', padding: '2px 10px', borderRadius: '6px' }}>
                                            Totul OK
                                        </span>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}
        </div>
    )
}
