import { useTheme } from '../lib/ThemeContext'
import { useLanguage } from '../lib/LanguageContext'
import { supabase } from '../lib/supabaseClient'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useCallback, useEffect, useMemo } from 'react'

/* eslint-disable */
const WORKER_URL = import.meta.env.VITE_WORKER_URL || 'http://localhost:3001'
const IS_LOCAL = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
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
    trash: (c='currentColor',s=14) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>,
    spin: (s=14) => <span style={{display:'inline-block',width:s,height:s,border:`2px solid rgba(255,255,255,0.3)`,borderTopColor:'#fff',borderRadius:'50%',animation:'spin 0.7s linear infinite'}} />,
}

// ─── Working Hours Helper ────────────────────────────────
const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']

function isOutsideWorkingHours(stoppedAt, resumedAt, workingHours) {
    if (!workingHours || !stoppedAt) return false
    const stopDate = new Date(stoppedAt)
    const dayName = DAY_NAMES[stopDate.getDay()]
    const daySchedule = workingHours[dayName]
    if (!daySchedule || !daySchedule.open || !daySchedule.close) return false

    const [openH, openM] = daySchedule.open.split(':').map(Number)
    const [closeH, closeM] = daySchedule.close.split(':').map(Number)

    // Build open/close timestamps for the day of the stop
    const openTime = new Date(stopDate)
    openTime.setHours(openH, openM, 0, 0)
    const closeTime = new Date(stopDate)
    closeTime.setHours(closeH, closeM, 0, 0)
    // Handle overnight schedule (e.g. open 10:00, close 02:00)
    if (closeTime <= openTime) closeTime.setDate(closeTime.getDate() + 1)

    const endTime = resumedAt ? new Date(resumedAt) : new Date()

    // If the stop is entirely before opening or entirely after closing → outside
    if (endTime <= openTime) return true
    if (stopDate >= closeTime) return true

    return false
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
    const [hideOutsideSchedule, setHideOutsideSchedule] = useState(true)
    const [deleteConfirm, setDeleteConfirm] = useState(null)
    const [deleting, setDeleting] = useState(false)

    // ─── Product Scanner State ─────────────────────────────
    const [posDiscrepancies, setPosDiscrepancies] = useState([])
    const [scanningPos, setScanningPos] = useState(false)
    const [productScanMsg, setProductScanMsg] = useState(null)
    const [productScanned, setProductScanned] = useState(false)

    const verifyPos = useCallback(async () => {
        setScanningPos(true)
        setProductScanMsg(null)
        try {
            const res = await fetch(`${WORKER_URL}/api/pos/discrepancies`)
            const data = await res.json()
            if (data.success) {
                const resArray = data.results || []
                setPosDiscrepancies(resArray)
                
                const totalRest = resArray.length
                const totalDiscrepant = resArray.filter(r => r.discrepancies.length > 0).length
                const totalProdsStop = resArray.reduce((acc, r) => acc + r.pos_stopped_count, 0)
                
                setProductScanMsg({ ok: true, text: lang === 'en'
                    ? `✅ POS check complete: ${totalRest} restaurants scanned | ${totalProdsStop} products stopped in kitchens | ${totalDiscrepant === 0 ? 'No platform discrepancies!' : `${totalDiscrepant} restaurants with platform errors ⚠️`}`
                    : `✅ Verificare POS completă: ${totalRest} restaurante scanate | ${totalProdsStop} produse oprite în bucătării | ${totalDiscrepant === 0 ? 'Nicio discrepanță cu platformele!' : `${totalDiscrepant} restaurante cu erori platformă ⚠️`}` })
            } else {
                setProductScanMsg({ ok: false, text: data.error || data.message || (lang === 'en' ? 'POS check error' : 'Eroare la verificare POS') })
            }
        } catch (e) {
            setProductScanMsg({ ok: false, text: lang === 'en'
                ? '⚠️ Worker server not available. Please try again later.'
                : '⚠️ Serverul worker nu este disponibil. Încercați din nou mai târziu.' })
        }
        finally { setScanningPos(false); setProductScanned(true) }
    }, [])

    // ─── Data Queries ──────────────────────────────────────
    const { data: activeStops = [], isLoading: loadingActive } = useQuery({
        queryKey: ['active-stops'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('stop_events').select('*, restaurants(name, city, revenue_per_hour, working_hours)')
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
                .from('stop_events').select('*, restaurants(name, city, revenue_per_hour, working_hours)')
                .order('stopped_at', { ascending: false }).limit(200)
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

    const handleDeleteStop = async () => {
        if (!deleteConfirm) return
        setDeleting(true)
        try {
            const { error } = await supabase.from('stop_events').delete().eq('id', deleteConfirm)
            if (error) throw error
            queryClient.invalidateQueries({ queryKey: ['active-stops'] })
            queryClient.invalidateQueries({ queryKey: ['stop-events'] })
        } catch (e) {
            console.error('Delete stop error:', e)
        }
        setDeleting(false)
        setDeleteConfirm(null)
    }

    // ─── Computed ──────────────────────────────────────────
    const now = new Date()
    const todayStr = now.toISOString().split('T')[0]

    // Mark each event with outside_schedule flag
    const eventsWithSchedule = useMemo(() => stopEvents.map(e => ({
        ...e,
        _outsideSchedule: isOutsideWorkingHours(e.stopped_at, e.resumed_at, e.restaurants?.working_hours)
    })), [stopEvents])

    const activeStopsWithSchedule = useMemo(() => activeStops.map(e => ({
        ...e,
        _outsideSchedule: isOutsideWorkingHours(e.stopped_at, e.resumed_at, e.restaurants?.working_hours)
    })), [activeStops])

    // Filter out outside-schedule from KPI counts
    const inScheduleActive = activeStopsWithSchedule.filter(e => !e._outsideSchedule)
    const todayEvents = eventsWithSchedule.filter(e => e.stopped_at?.startsWith(todayStr) && !e._outsideSchedule)
    const totalActiveLoss = inScheduleActive.reduce((s, e) => {
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

    const outsideCount = eventsWithSchedule.filter(e => e._outsideSchedule).length

    let filteredEvents = selectedFilter === 'active' ? activeStopsWithSchedule
        : selectedFilter === 'resolved' ? eventsWithSchedule.filter(e => e.resumed_at) : eventsWithSchedule
    if (hideOutsideSchedule) filteredEvents = filteredEvents.filter(e => !e._outsideSchedule)
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
            label: lang === 'en' ? 'Active Stops' : 'Restaurante Oprite (Total)',
            value: inScheduleActive.length,
            sub: inScheduleActive.length > 0 ? (lang === 'en' ? 'needs attention!' : 'necesită atenție!') : (lang === 'en' ? 'all good' : 'totul funcționează'),
            color: inScheduleActive.length > 0 ? '#FF453A' : '#34C759',
            bg: inScheduleActive.length > 0 ? 'rgba(255,69,58,0.12)' : 'rgba(52,199,89,0.12)',
            icon: Icon.stop(inScheduleActive.length > 0 ? '#FF453A' : '#34C759', 20),
        },
        {
            label: lang === 'en' ? 'Stops Today' : 'Opriri Azi (în program)',
            value: todayEvents.length,
            sub: lang === 'en' ? 'during working hours' : 'în timpul programului de lucru',
            color: '#8B5CF6',
            bg: 'rgba(139,92,246,0.12)',
            icon: Icon.clock('#8B5CF6', 20),
        }
    ]

    return (
        <div style={{
            padding: '24px 32px',
            
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
                        {lang === 'en' ? 'Monitor complete restaurant stops' : 'Monitorizare opriri complete (restaurant închis pe platformă)'} · {now.toLocaleTimeString('ro-RO')}
                    </p>
                </div>
            </div>

            {/* ══ WARNING: NO WORKING HOURS ══ */}
            {activeStops.length > 0 && activeStops.every(e => !e.restaurants?.working_hours || Object.keys(e.restaurants.working_hours).length === 0) && (
                <div style={{
                    ...glass, padding: '16px 24px', marginBottom: '20px',
                    border: `1px solid rgba(255,149,0,0.25)`,
                    background: isDark ? 'rgba(255,149,0,0.06)' : 'rgba(255,149,0,0.04)',
                    display: 'flex', alignItems: 'center', gap: '14px',
                    animation: 'fadeUp 0.3s ease',
                }}>
                    {Icon.alert('#FF9500', 22)}
                    <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '13px', fontWeight: '700', color: '#FF9500', marginBottom: '2px' }}>
                            {lang === 'en' ? 'Working hours not configured' : 'Programul de lucru nu este setat'}
                        </div>
                        <div style={{ fontSize: '12px', color: colors.textSecondary, lineHeight: '1.5' }}>
                            {lang === 'en'
                                ? 'Without working hours, all stops are treated as during business hours. Set schedules in Restaurants to accurately filter outside-hours stops and calculate losses.'
                                : 'Fără program de lucru setat, toate opririle sunt considerate în program. Setează programul la fiecare restaurant din pagina Restaurante pentru a putea diferenția opririle reale de cele din afara programului.'}
                        </div>
                    </div>
                </div>
            )}

            {/* ══ KPI CARDS ══ */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: '16px', marginBottom: '24px' }}>
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
                        <div style={{ fontSize: '12px', color: k.color === '#34C759' ? '#34C759' : k.value === 0 ? colors.textSecondary : k.color, fontWeight: k.value > 0 ? '600' : '400', opacity: 0.85 }}>
                            {k.sub}
                        </div>
                    </div>
                ))}
            </div>

            {/* ══ PRODUCT AVAILABILITY SCANNER ══ */}
            <div style={{ ...glass, marginBottom: '24px', overflow: 'hidden', animation: 'fadeUp 0.3s ease 0.25s both' }}>
                {/* Header row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '20px 24px', borderBottom: `1px solid ${isDark ? 'rgba(99,102,241,0.15)' : 'rgba(99,102,241,0.1)'}`, background: isDark ? 'rgba(99,102,241,0.05)' : 'rgba(99,102,241,0.03)' }}>
                    <div style={{ width: 38, height: 38, borderRadius: '11px', background: 'rgba(99,102,241,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {Icon.scan('#6366F1', 18)}
                    </div>
                    <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '15px', fontWeight: '700', color: colors.text, marginBottom: '2px' }}>
                            {lang === 'en' ? 'Menu Sync (POS vs Platforms)' : 'Sincronizare Meniu (POS vs Platforme)'}
                        </div>
                        <div style={{ fontSize: '12px', color: colors.textSecondary }}>
                            {lang === 'en' ? 'Automatically compare products stopped in POS (Syrve) with their availability on Glovo, Wolt and Bolt.' : 'Compară automat produsele oprite direct în casa de marcat (Syrve) cu disponibilitatea lor pe Glovo, Wolt și Bolt.'}
                        </div>
                    </div>
                    <button className="btn-h" onClick={verifyPos} disabled={scanningPos}
                        style={{ ...btnBase, padding: '11px 22px', background: scanningPos ? 'rgba(99,102,241,0.4)' : 'linear-gradient(135deg,#6366F1,#8B5CF6)', color: '#fff', boxShadow: scanningPos ? 'none' : '0 4px 16px rgba(99,102,241,0.35)', whiteSpace: 'nowrap', flexShrink: 0, cursor: scanningPos ? 'wait' : 'pointer' }}>
                        {scanningPos ? <>{Icon.spin(14)} {lang === 'en' ? 'Checking kitchens...' : 'Se verifică bucătăriile...'}</> : <>{Icon.scan('#fff', 14)} {lang === 'en' ? 'Launch Full Scan' : 'Lansați Scanarea Completă'}</>}
                    </button>
                </div>

                {/* Message bar */}
                {productScanMsg && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 24px', fontSize: '12px', fontWeight: '600', color: productScanMsg.ok ? '#22c55e' : '#ef4444', background: productScanMsg.ok ? 'rgba(34,197,94,0.06)' : 'rgba(239,68,68,0.06)', borderBottom: `1px solid ${productScanMsg.ok ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.12)'}` }}>
                        <span>{productScanMsg.text}</span>
                        <button onClick={() => setProductScanMsg(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontSize: '16px', lineHeight: 1 }}>×</button>
                    </div>
                )}

                {/* Results Grid */}
                {posDiscrepancies.length > 0 && (
                    <div style={{ padding: '20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px', background: isDark ? 'transparent' : 'rgba(0,0,0,0.02)' }}>
                        {posDiscrepancies.map((p, i) => {
                            const hasErrors = p.discrepancies.length > 0
                            return (
                                <div key={i} style={{ ...inner, background: isDark ? 'rgba(255,255,255,0.02)' : '#fff', padding: '16px 20px', borderTop: `3px solid ${hasErrors ? '#ef4444' : '#22c55e'}` }}>
                                    <div style={{ fontSize: '14px', fontWeight: '800', marginBottom: '10px', color: colors.text }}>
                                        {p.restaurant}
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '10px', borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`, marginBottom: '10px' }}>
                                        <span style={{ fontSize: '12px', color: colors.textSecondary }}>{lang === 'en' ? 'POS Status (Syrve):' : 'Stare Casa (Syrve):'}</span>
                                        <span style={{ fontSize: '12px', fontWeight: '800', color: p.pos_stopped_count > 0 ? '#f97316' : '#22c55e' }}>
                                            {p.pos_stopped_count === 0 ? (lang === 'en' ? 'All Active' : 'Totul Activ') : `${p.pos_stopped_count} ${lang === 'en' ? 'stopped' : 'oprite'}`}
                                        </span>
                                    </div>
                                    {hasErrors ? (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                            {p.discrepancies.map((d, di) => (
                                                <div key={di} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', padding: '8px', background: isDark ? 'rgba(239,68,68,0.1)' : 'rgba(239,68,68,0.05)', borderRadius: '8px' }}>
                                                    <PlatformBadge platform={d.platform} size={14} />
                                                    <div style={{ fontSize: '11px', color: colors.text, lineHeight: 1.3 }}>{d.message}</div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div style={{ textAlign: 'center', padding: '10px 0', color: '#22c55e' }}>
                                            ✅ <span style={{ fontSize: '12px', fontWeight: '700' }}>{lang === 'en' ? 'Perfect Sync' : 'Sincronizare Perfectă'}</span>
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>

            {/* ══ ACTIVE STOPS BANNER ══ */}
            {activeStops.length > 0 && (
                <div style={{ ...glass, marginBottom: '24px', border: '1.5px solid rgba(255,69,58,0.25)', animation: 'fadeUp 0.3s ease 0.3s both' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '16px 24px', borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`, background: isDark ? 'rgba(255,69,58,0.08)' : 'rgba(255,69,58,0.04)' }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#FF453A', boxShadow: '0 0 8px rgba(255,69,58,0.6)', animation: 'pulse-dot 2s ease infinite' }} />
                        <span style={{ fontSize: '14px', fontWeight: '700', color: '#FF453A', flex: 1 }}>
                            {activeStops.length} {activeStops.length === 1 ? (lang === 'en' ? 'Active Stop' : 'Oprire Activa de Restaurant') : (lang === 'en' ? 'Active Stops' : 'Restaurante Oprite')}
                        </span>
                    </div>
                    {activeStops.map((stop, i) => {
                        const startMs = new Date(stop.stopped_at).getTime() || 0
                        const mins = (Date.now() - startMs) / 60000
                        return (
                            <div key={stop.id} className="sc-row" style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '14px 24px', borderBottom: i < activeStops.length - 1 ? `1px solid ${isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}` : 'none' }}>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: '14px', fontWeight: '700', color: colors.text, marginBottom: '3px' }}>{stop.restaurants?.name || '—'}</div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        {stop.platform && <PlatformBadge platform={stop.platform} size={14} />}
                                        <span style={{ fontSize: '11px', color: colors.textSecondary }}>{stop.restaurants?.city}</span>
                                        {stop.stop_type && <span style={{ fontSize: '10px', fontWeight: '700', padding: '1px 6px', borderRadius: '4px', background: 'rgba(255,69,58,0.1)', color: '#FF453A' }}>{stop.stop_type === 'full' ? (lang === 'en' ? 'FULLY CLOSED' : 'ÎNCHIS COMPLET') : stop.stop_type === 'radius' ? (lang === 'en' ? 'REDUCED DELIVERY RADIUS' : 'RAZĂ LIVRARE REDUSĂ') : stop.stop_type}</span>}
                                    </div>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <div style={{ fontSize: '11px', color: colors.textSecondary, marginBottom: '2px' }}>{lang === 'en' ? 'Stopped on' : 'A fost închis pe'} <strong style={{color: colors.text}}>{new Date(stop.stopped_at).toLocaleString(lang === 'en' ? 'en-US' : 'ro-RO', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</strong></div>
                                    <div style={{ fontSize: '13px', fontWeight: '700', color: '#FF9500' }}>{lang === 'en' ? 'Elapsed:' : 'Timp scurs:'} {formatDuration(mins)}</div>
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

            {/* ══ DELETE CONFIRMATION MODAL ══ */}
            {deleteConfirm && (
                <>
                    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', zIndex: 1000 }} onClick={() => !deleting && setDeleteConfirm(null)} />
                    <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 1001, ...glass, padding: '28px 32px', width: '400px', maxWidth: '90vw' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                            <div style={{ width: 40, height: 40, borderRadius: '12px', background: 'rgba(239,68,68,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                {Icon.trash('#ef4444', 18)}
                            </div>
                            <div>
                                <div style={{ fontSize: '16px', fontWeight: '800', color: colors.text }}>
                                    {lang === 'en' ? 'Delete stop event?' : 'Șterge evenimentul de oprire?'}
                                </div>
                                <div style={{ fontSize: '12px', color: colors.textSecondary, marginTop: '2px' }}>
                                    {lang === 'en' ? 'This action cannot be undone' : 'Această acțiune nu poate fi anulată'}
                                </div>
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                            <button onClick={() => setDeleteConfirm(null)} disabled={deleting}
                                style={{ ...btnBase, padding: '10px 20px', background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)', color: colors.textSecondary, border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}` }}>
                                {lang === 'en' ? 'Cancel' : 'Anulează'}
                            </button>
                            <button onClick={handleDeleteStop} disabled={deleting}
                                style={{ ...btnBase, padding: '10px 20px', background: deleting ? 'rgba(239,68,68,0.4)' : 'linear-gradient(135deg,#ef4444,#dc2626)', color: '#fff', boxShadow: '0 4px 14px rgba(239,68,68,0.35)' }}>
                                {deleting ? (lang === 'en' ? 'Deleting...' : 'Se șterge...') : (lang === 'en' ? 'Delete' : 'Șterge')}
                            </button>
                        </div>
                    </div>
                </>
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
                    {/* Outside Schedule toggle */}
                    <button onClick={() => setHideOutsideSchedule(h => !h)}
                        style={{ ...btnBase, padding: '6px 14px', fontSize: '12px', borderRadius: '8px',
                            background: hideOutsideSchedule ? (isDark ? 'rgba(255,149,0,0.15)' : 'rgba(255,149,0,0.1)') : 'transparent',
                            color: hideOutsideSchedule ? '#FF9500' : colors.textSecondary,
                            border: hideOutsideSchedule ? '1px solid rgba(255,149,0,0.3)' : `1px solid transparent`,
                            fontWeight: hideOutsideSchedule ? '700' : '500' }}>
                        🕐 {lang === 'en' ? `Hide outside schedule (${outsideCount})` : `Ascunde în afara programului (${outsideCount})`}
                    </button>
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
                        <div style={{ fontSize: '13px' }}>{lang === 'en' ? 'Loading...' : 'Se incarca...'}</div>
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
                                {['Restaurant', lang === 'en' ? 'Platform' : 'Platforma', lang === 'en' ? 'Type' : 'Tip', lang === 'en' ? 'Started' : 'Inceput', lang === 'en' ? 'Duration' : 'Durata', 'Status', ''].map((h, hi) => (
                                    <th key={hi} style={{ padding: '12px 20px', textAlign: h === 'Restaurant' ? 'left' : 'center', fontSize: '11px', fontWeight: '600', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: '0.5px', width: h === '' ? '40px' : 'auto' }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {displayEvents.map((e, i) => {
                                const isActive = !e.resumed_at
                                const isOutside = e._outsideSchedule
                                const startT2 = new Date(e.stopped_at).getTime()
                                const endT2 = e.resumed_at ? new Date(e.resumed_at).getTime() : now.getTime()
                                const mins = (endT2 - startT2) / 60000
                                const rph = e.restaurants?.revenue_per_hour || 0
                                const loss = rph * mins / 60
                                return (
                                    <tr key={e.id} className="sc-row" style={{ borderBottom: i < displayEvents.length - 1 ? `0.5px solid ${isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}` : 'none', opacity: isOutside ? 0.5 : 1 }}>
                                        <td style={{ padding: '13px 20px' }}>
                                            <div style={{ fontSize: '13px', fontWeight: '600', color: colors.text }}>{e.restaurants?.name || '—'}</div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                                                <span style={{ fontSize: '11px', color: colors.textSecondary }}>{e.restaurants?.city}</span>
                                                {isOutside && <span style={{ fontSize: '9px', fontWeight: '700', padding: '1px 6px', borderRadius: '4px', background: 'rgba(255,149,0,0.12)', color: '#FF9500', whiteSpace: 'nowrap' }}>{lang === 'en' ? 'OUTSIDE SCHEDULE' : 'ÎN AFARA PROGRAMULUI'}</span>}
                                            </div>
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
                                            {e.stop_type && <span style={{ fontSize: '10px', fontWeight: '700', padding: '2px 8px', borderRadius: '5px', background: 'rgba(255,69,58,0.1)', color: '#FF453A', textTransform: 'uppercase' }}>{e.stop_type === 'full' ? (lang === 'en' ? 'FULLY CLOSED' : 'ÎNCHIS COMPLET') : e.stop_type === 'radius' ? (lang === 'en' ? 'REDUCED DELIVERY RADIUS' : 'RAZĂ LIVRARE REDUSĂ') : e.stop_type}</span>}
                                        </td>
                                        <td style={{ padding: '13px 20px', textAlign: 'center', fontSize: '12px', color: colors.textSecondary, whiteSpace: 'nowrap' }}>
                                            {new Date(e.stopped_at).toLocaleString('ro-RO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                        </td>
                                        <td style={{ padding: '13px 20px', textAlign: 'center', fontSize: '13px', fontWeight: '700', color: isActive ? '#FF9500' : colors.text }}>
                                            {formatDuration(mins)}
                                        </td>
                                        <td style={{ padding: '13px 20px', textAlign: 'center' }}>
                                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '3px 10px', borderRadius: '8px', fontSize: '11px', fontWeight: '700', background: isOutside ? 'rgba(255,149,0,0.1)' : isActive ? 'rgba(255,69,58,0.1)' : 'rgba(52,199,89,0.1)', color: isOutside ? '#FF9500' : isActive ? '#FF453A' : '#34C759' }}>
                                                <span style={{ width: 6, height: 6, borderRadius: '50%', background: isOutside ? '#FF9500' : isActive ? '#FF453A' : '#34C759', display: 'inline-block', animation: isActive && !isOutside ? 'pulse-dot 2s ease infinite' : 'none' }} />
                                                {isOutside ? (lang === 'en' ? 'Outside' : 'Afara prog.') : isActive ? (lang === 'en' ? 'Active' : 'Activ') : (lang === 'en' ? 'Resolved' : 'Rezolvat')}
                                            </span>
                                        </td>
                                        <td style={{ padding: '13px 8px', textAlign: 'center' }}>
                                            <button className="btn-h" onClick={() => setDeleteConfirm(e.id)} title={lang === 'en' ? 'Delete' : 'Șterge'}
                                                style={{ background: 'none', border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`, borderRadius: '8px', padding: '5px 7px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: colors.textSecondary, transition: 'all 0.15s' }}
                                                onMouseOver={ev => { ev.currentTarget.style.color = '#ef4444'; ev.currentTarget.style.borderColor = 'rgba(239,68,68,0.3)'; ev.currentTarget.style.background = 'rgba(239,68,68,0.06)' }}
                                                onMouseOut={ev => { ev.currentTarget.style.color = colors.textSecondary; ev.currentTarget.style.borderColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'; ev.currentTarget.style.background = 'none' }}>
                                                {Icon.trash(undefined, 13)}
                                            </button>
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                )}
            </div>


        </div>
    )
}
