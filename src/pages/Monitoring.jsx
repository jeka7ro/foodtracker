import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTheme } from '../lib/ThemeContext'
import { useLanguage } from '../lib/LanguageContext'
import { supabase } from '../lib/supabaseClient'
import toast, { Toaster } from 'react-hot-toast'
import { CardSkeleton } from '../components/LoadingSkeleton'

// ─── Clean SVG Icons (no emoji) ────────────────────────
function IconSignal({ size = 18, color = 'currentColor' }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 20h.01" /><path d="M7 20v-4" /><path d="M12 20v-8" /><path d="M17 20V8" />
        </svg>
    )
}

function IconCheck({ size = 14, color = 'currentColor' }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
        </svg>
    )
}

function IconX({ size = 14, color = 'currentColor' }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
        </svg>
    )
}

function IconRefresh({ size = 16, color = 'currentColor' }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
        </svg>
    )
}

function IconPlay({ size = 14, color = 'currentColor' }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill={color} stroke="none">
            <polygon points="5 3 19 12 5 21 5 3" />
        </svg>
    )
}

function IconServer({ size = 14, color = 'currentColor' }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect width="20" height="8" x="2" y="2" rx="2" ry="2"/><rect width="20" height="8" x="2" y="14" rx="2" ry="2"/><line x1="6" x2="6.01" y1="6" y2="6"/><line x1="6" x2="6.01" y1="18" y2="18"/>
        </svg>
    )
}

function IconHistory({ size = 16, color = 'currentColor' }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
        </svg>
    )
}

function IconWarning({ size = 14, color = 'currentColor' }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
    )
}

function IconExternalLink({ size = 10, color = 'currentColor' }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
        </svg>
    )
}

function IconMapPin({ size = 14, color = 'currentColor' }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill={color} stroke="none">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z" />
        </svg>
    )
}

function IconLoader({ size = 16, color = 'currentColor' }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" style={{ animation: 'spin 1s linear infinite' }}>
            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
        </svg>
    )
}

// Platform logo component
function PlatformLogo({ platform, size = 20 }) {
    const logoMap = {
        glovo: 'https://upload.wikimedia.org/wikipedia/commons/7/78/Current_Logo_Glovo.jpg',
        wolt: 'https://brandlogos.net/wp-content/uploads/2025/05/wolt-logo_brandlogos.net_dijtc.png',
        bolt: 'https://media.voog.com/0000/0039/0361/photos/Bolt.png'
    }
    return (
        <img
            src={logoMap[platform] || ''}
            alt={platform}
            style={{ width: size, height: size, objectFit: 'contain', display: 'inline-block', borderRadius: '4px', background: 'white' }}
            onError={(e) => { e.target.style.display = 'none' }}
        />
    )
}

// ─── Glass Card Style Generator ────────────────────────
function glassCard(isDark) {
    return {
        background: isDark
            ? 'rgba(30, 32, 40, 0.65)'
            : '#ffffff',
        backdropFilter: isDark ? 'blur(24px) saturate(180%)' : 'none',
        WebkitBackdropFilter: isDark ? 'blur(24px) saturate(180%)' : 'none',
        borderRadius: '20px',
        border: isDark
            ? '1px solid rgba(255, 255, 255, 0.08)'
            : '1px solid rgba(0, 0, 0, 0.08)',
        boxShadow: isDark
            ? '0 8px 32px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255,255,255,0.05)'
            : '0 2px 12px rgba(0, 0, 0, 0.08), 0 0 1px rgba(0, 0, 0, 0.1)',
    }
}

function glassCardInner(isDark) {
    return {
        background: isDark
            ? 'rgba(40, 42, 54, 0.45)'
            : 'rgba(0, 0, 0, 0.03)',
        backdropFilter: isDark ? 'blur(12px)' : 'none',
        WebkitBackdropFilter: isDark ? 'blur(12px)' : 'none',
        borderRadius: '16px',
        border: isDark
            ? '1px solid rgba(255, 255, 255, 0.06)'
            : '1px solid rgba(0, 0, 0, 0.06)',
    }
}


export default function Monitoring() {
    const { lang } = useLanguage()
    const { colors, isDark } = useTheme()
    const navigate = useNavigate()
    const [restaurants, setRestaurants] = useState([])
    const [checks, setChecks] = useState([])
    const [loading, setLoading] = useState(true)
    const [lastRefresh, setLastRefresh] = useState(new Date())
    const [autoRefresh, setAutoRefresh] = useState(true)
    const [checkingId, setCheckingId] = useState(null)
    const [checkModal, setCheckModal] = useState({ open: false, restaurantName: '', results: [], progress: 0, total: 0, done: false, error: null })
    const [syncTestModal, setSyncTestModal] = useState({ open: false, testing: false, results: [], error: null })
    const [syncReports, setSyncReports] = useState([])
    const [syncReportsLoading, setSyncReportsLoading] = useState(false)
    const [expandedReport, setExpandedReport] = useState(null)
    const [showHistory, setShowHistory] = useState(false)
    const [checkingAll, setCheckingAll] = useState(false)
    const [discoveringId, setDiscoveringId] = useState(null)
    // ─── Sync Table Filters & Pagination ───
    const [syncTableFilter, setSyncTableFilter] = useState({ restaurant: '', platform: '', type: '', search: '' })
    const [syncTablePage, setSyncTablePage] = useState(1)
    const [syncTablePageSize, setSyncTablePageSize] = useState(25)

    useEffect(() => { fetchData(); fetchSyncReports() }, [])

    async function fetchSyncReports() {
        setSyncReportsLoading(true)
        try {
            const res = await fetch('http://localhost:3001/api/sync-reports')
            if (res.ok) {
                const data = await res.json()
                setSyncReports(data.reports || [])
            }
        } catch (_) {}
        setSyncReportsLoading(false)
    }

    useEffect(() => {
        if (!autoRefresh) return
        const interval = setInterval(() => fetchData(true), 30000)
        return () => clearInterval(interval)
    }, [autoRefresh])

    async function fetchData(silent = false) {
        try {
            if (!silent) setLoading(true)
            
            const ENV_CONFIGS = [
                { key: 'a1fe30cdeb934aa0af01b6a35244b7f0', baseUrl: 'http://localhost:3005/api/iiko', defaultBrand: 'Sushi Master' },
                { key: '124d0880f4b44717b69ee21d45fc2656', baseUrl: 'http://localhost:3005/api/syrve', defaultBrand: 'Smash Me' }
            ];

            let apiOrgs = [];
            for (const env of ENV_CONFIGS) {
                try {
                    const resAuth = await fetch(`${env.baseUrl}/access_token`, {
                        method: 'POST', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ apiLogin: env.key })
                    });
                    if (resAuth.ok) {
                        const { token } = await resAuth.json();
                        const resOrgs = await fetch(`${env.baseUrl}/organizations`, {
                            method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                            body: JSON.stringify({})
                        });
                        const data = await resOrgs.json();
                        if (data.organizations) {
                            apiOrgs.push(...data.organizations.map(o => ({ ...o, _env: env })));
                        }
                    }
                } catch(e) { console.error("Monitor proxy fetch error:", e); }
            }

            const [restaurantsRes, checksRes] = await Promise.all([
                supabase.from('restaurants').select('*, brands(*)'),
                supabase.from('monitoring_checks').select('*').order('checked_at', { ascending: false }).limit(500)
            ])
            if (restaurantsRes.error) throw restaurantsRes.error
            if (checksRes.error) throw checksRes.error
            
            const rawDb = restaurantsRes.data || [];
            
            const dbMap = new Map();
            rawDb.forEach(r => {
                if (r.iiko_restaurant_id) dbMap.set(r.iiko_restaurant_id, r);
            });

            const finalRests = apiOrgs.map(org => {
                 const dbMatch = dbMap.get(org.id) || {};
                 return {
                     id: dbMatch.id || org.id, 
                     iiko_restaurant_id: org.id,
                     name: org.name,
                     city: org.name.split(' ').pop() || 'Unknown',
                     is_active: dbMatch.is_active !== false,
                     glovo_url: dbMatch.glovo_url || '',
                     wolt_url: dbMatch.wolt_url || '',
                     bolt_url: dbMatch.bolt_url || '',
                     brands: dbMatch.brands || null,
                     iiko_config: dbMatch.iiko_config || {}
                 }
            });

            const knownIds = new Set(finalRests.map(r => r.iiko_restaurant_id));
            const orphanDbRests = rawDb.filter(r => r.is_active && (!r.iiko_restaurant_id || !knownIds.has(r.iiko_restaurant_id)));

            setRestaurants([...finalRests, ...orphanDbRests])
            setChecks(checksRes.data || [])
            setLastRefresh(new Date())
        } catch (error) {
            console.error('Error fetching monitoring data:', error)
            if (!silent) toast.error('Error loading data: ' + error.message)
        } finally { setLoading(false) }
    }

    function getLatestCheck(restaurantId, platform) {
        return checks.find(c => c.restaurant_id === restaurantId && c.platform === platform)
    }

    async function triggerCheck(restaurantId) {
        const restaurant = restaurants.find(r => r.id === restaurantId)
        if (!restaurant) return
        const plats = ['glovo', 'wolt', 'bolt'].filter(p => restaurant[`${p}_url`])
        if (plats.length === 0) return;

        setCheckingId(restaurantId)
        setCheckModal({ open: true, restaurantName: restaurant.name, results: [], progress: 0, total: plats.length, done: false, error: null })
        try {
            const response = await fetch(`http://localhost:3001/api/check-restaurant`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ restaurantId })
            })
            if (response.ok) {
                const data = await response.json()
                setCheckModal(prev => ({ ...prev, results: data.results || [], progress: plats.length, done: true }))
                
                // Locally patch the checks state so it immediately reflects Live Results since RLS blocks saving to Supabase locally
                if (data.results && data.results.length > 0) {
                    setChecks(prevChecks => {
                        const newChecks = [...prevChecks]
                        data.results.forEach(res => {
                            const existingIndex = newChecks.findIndex(c => c.restaurant_id === restaurantId && c.platform === res.platform)
                            const fakeCheck = { restaurant_id: restaurantId, platform: res.platform, checked_at: new Date().toISOString(), final_status: res.final_status }
                            if (existingIndex >= 0) newChecks[existingIndex] = { ...newChecks[existingIndex], ...fakeCheck }
                            else newChecks.push(fakeCheck)
                        })
                        return newChecks
                    })
                }
                setTimeout(() => fetchData(true), 1000)
                // Removed auto-close setTimeout to let user read the modal
            } else {
                setCheckModal(prev => ({ ...prev, done: true, error: ((lang === 'ru' ? 'Ошибка проверки. Статус: ' : (lang === 'en' ? 'Check failed. Status: ' : 'Verificarea a eșuat. Status: '))) + response.status }))
            }
        } catch {
            setCheckModal(prev => ({ ...prev, done: true, error: 'API server nu rulează' }))
        } finally { setCheckingId(null) }
    }

    async function triggerAutoDiscover(restaurant) {
        setDiscoveringId(restaurant.id)
        toast.loading(`Căutare automată linkuri pe platforme pentru ${restaurant.name}...`, { id: "discover" })
        try {
            const res = await fetch(`${import.meta.env.VITE_WORKER_URL || "http://localhost:3001"}/api/auto-discover`, {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ restaurant })
            })
            if (res.ok) {
                const data = await res.json()
                if (data.success) {
                     toast.success(`Succes! Au fost găsite și salvate linkuri noi pentru ${restaurant.name}.`, { id: "discover" })
                     setTimeout(() => fetchData(true), 500)
                } else {
                     toast.error(`Nu s-au găsit linkuri publice pentru ${restaurant.name}`, { id: "discover" })
                }
            } else throw new Error("API")
        } catch (e) {
            toast.error("Eroare conexiune la serverul Scraper!", { id: "discover" })
        }
        setDiscoveringId(null)
    }

    async function triggerCheckAll() {
        setCheckingAll(true)
        setCheckModal({ open: true, restaurantName: 'Toate restaurantele', results: [], progress: 0, total: restaurants.length * 3, done: false, error: null })
        try {
            const response = await fetch(`http://localhost:3001/api/check-all`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' }
            })
            if (response.ok) {
                const data = await response.json()
                setCheckModal(prev => ({ ...prev, results: data.results || [], progress: (data.results || []).length, total: (data.results || []).length, done: true }))
                setTimeout(() => fetchData(true), 1000)
                setTimeout(() => setCheckModal(prev => ({ ...prev, open: false })), 2000)
            } else {
                setCheckModal(prev => ({ ...prev, done: true, error: 'Verificarea a eșuat.' }))
            }
        } catch {
            setCheckModal(prev => ({ ...prev, done: true, error: 'API server nu rulează' }))
        } finally { setCheckingAll(false) }
    }

    async function triggerSyncTestAll(restaurantId = null) {
        setSyncTestModal({ open: true, testing: true, results: [], error: null })
        try {
            const bodyPayload = restaurantId ? JSON.stringify({ restaurantId }) : JSON.stringify({})
            const response = await fetch(`http://localhost:3001/api/sync-test-all`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: bodyPayload
            })
            if (response.ok) {
                const data = await response.json()
                setSyncTestModal(prev => ({ ...prev, testing: false, results: data.results || [] }))
                // Refresh the reports table
                await fetchSyncReports()
                setExpandedReport(data.reportId || null)
            } else {
                const err = await response.json().catch(() => ({}))
                setSyncTestModal(prev => ({ ...prev, testing: false, error: err.error || 'Testul a eșuat.' }))
            }
        } catch {
            setSyncTestModal(prev => ({ ...prev, testing: false, error: 'API server nu rulează' }))
        }
    }

    // ─── Status Helpers ────────────────────────────────
    const statusConfig = {
        available: { color: '#34C759', label: 'Disponibil', dotClass: 'status-dot-available' },
        closed: { color: '#FF9500', label: 'Închis', dotClass: 'status-dot-closed' },
        unavailable: { color: '#FF3B30', label: 'Indisponibil', dotClass: 'status-dot-unavailable' },
        error: { color: '#FF453A', label: 'Eroare', dotClass: 'status-dot-error' },
        pending: { color: '#8E8E93', label: 'Neverificat', dotClass: 'status-dot-pending' }
    }

    function getStatusInfo(status) {
        if (!status) return statusConfig.pending
        // Normalize status - the API may return 'open'/'online' etc.
        const normalized = status.toLowerCase().trim()
        if (normalized === 'open' || normalized === 'online') return statusConfig.available
        if (normalized === 'closed' || normalized === 'offline') return statusConfig.closed
        return statusConfig[normalized] || statusConfig.error
    }

    function getTimeSince(dateStr) {
        if (!dateStr) return '—'
        const diff = Date.now() - new Date(dateStr).getTime()
        const mins = Math.floor(diff / 60000)
        if (mins < 1) return 'Acum'
        if (mins < 60) return `${mins}m`
        const hours = Math.floor(mins / 60)
        if (hours < 24) return `${hours}h`
        return `${Math.floor(hours / 24)}z`
    }

    // ─── Data Calculations ─────────────────────────────
    const platformsList = ['glovo', 'wolt', 'bolt']
    const latestChecksMap = {}
    checks.forEach(c => {
        const key = `${c.restaurant_id}_${c.platform}`
        if (!latestChecksMap[key]) latestChecksMap[key] = c
    })
    const latestChecksArray = Object.values(latestChecksMap)
    const totalChecks = latestChecksArray.length
    const availableCount = latestChecksArray.filter(c => c.final_status === 'available').length
    const issueCount = latestChecksArray.filter(c => ['closed', 'unavailable', 'error'].includes(c.final_status)).length
    const uptimePercent = totalChecks > 0 ? Math.round((availableCount / totalChecks) * 100) : 0

    const citiesMap = restaurants.reduce((acc, r) => {
        if (!acc[r.city]) acc[r.city] = []
        acc[r.city].push(r)
        return acc
    }, {})

    const recentHistory = checks.slice(0, 50)

    // ─── Styles ────────────────────────────────────────
    const glass = glassCard(isDark)
    const glassInner = glassCardInner(isDark)

    const btnBase = {
        display: 'inline-flex', alignItems: 'center', gap: '6px',
        padding: '9px 18px', border: 'none', borderRadius: '12px',
        fontSize: '13px', fontWeight: '600', cursor: 'pointer',
        transition: 'all 0.2s cubic-bezier(.4,0,.2,1)',
        fontFamily: 'inherit',
    }

    const btnPrimary = {
        ...btnBase,
        background: 'linear-gradient(135deg, #6366F1, #8B5CF6)',
        color: '#fff',
        boxShadow: '0 4px 14px rgba(99, 102, 241, 0.35)',
    }

    const btnGhost = {
        ...btnBase,
        background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
        color: colors.text,
        border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.08)',
    }

    const btnSmall = {
        ...btnBase,
        padding: '7px 14px',
        fontSize: '12px',
        borderRadius: '10px',
        background: 'linear-gradient(135deg, #6366F1, #818CF8)',
        color: '#fff',
        boxShadow: '0 2px 8px rgba(99, 102, 241, 0.25)',
    }

    // ─── Loading State ─────────────────────────────────
    if (loading) {
        return (
            <div style={{ padding: '24px 32px' }}>
                <div style={{ fontSize: '26px', fontWeight: '700', color: colors.text, marginBottom: '28px', letterSpacing: '-0.5px' }}>
                    Monitorizare Live
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
                    {[1, 2, 3, 4].map(i => <CardSkeleton key={i} />)}
                </div>
            </div>
        )
    }

    return (
        <div style={{
            padding: '24px 32px',
            
        }}>
            {/* ═══════ GLOBAL CSS ═══════ */}
            <style>{`
                @keyframes spin { to { transform: rotate(360deg); } }
                @keyframes shimmer {
                    0% { background-position: -200% 0; }
                    100% { background-position: 200% 0; }
                }
                @keyframes pulse-dot {
                    0%, 100% { transform: scale(1); opacity: 1; }
                    50% { transform: scale(1.4); opacity: 0.7; }
                }
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(8px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                @keyframes modalIn {
                    from { opacity: 0; transform: scale(0.95) translateY(10px); }
                    to { opacity: 1; transform: scale(1) translateY(0); }
                }
                @keyframes progressGrow {
                    0% { width: 0%; }
                    10% { width: 12%; }
                    30% { width: 35%; }
                    50% { width: 55%; }
                    70% { width: 72%; }
                    90% { width: 88%; }
                    100% { width: 95%; }
                }
                .status-dot {
                    width: 8px; height: 8px; border-radius: 50%;
                    display: inline-block; flex-shrink: 0;
                }
                .status-dot-available { background: #34C759; box-shadow: 0 0 8px rgba(52, 199, 89, 0.5); }
                .status-dot-closed { background: #FF9500; box-shadow: 0 0 8px rgba(255, 149, 0, 0.5); }
                .status-dot-unavailable { background: #FF3B30; box-shadow: 0 0 8px rgba(255, 59, 48, 0.5); }
                .status-dot-error { background: #FF453A; box-shadow: 0 0 8px rgba(255, 69, 58, 0.5); animation: pulse-dot 2s ease infinite; }
                .status-dot-pending { background: #8E8E93; }
                .status-badge {
                    display: inline-flex; align-items: center; gap: 6px;
                    padding: 5px 12px; border-radius: 10px;
                    font-size: 12px; font-weight: 500;
                    text-decoration: none;
                    transition: all 0.2s cubic-bezier(.4,0,.2,1);
                    cursor: pointer; border: 1px solid transparent;
                }
                .status-badge:hover {
                    transform: translateY(-1px);
                    filter: brightness(1.1);
                }
                .glass-row { transition: background 0.15s ease; }
                .glass-row:hover {
                    background: ${isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)'} !important;
                }
                .btn-hover:hover {
                    transform: translateY(-1px);
                    filter: brightness(1.08);
                }
                .btn-hover:active { transform: scale(0.97); }
            `}</style>

            {/* ═══════ LOADING MODAL ═══════ */}
            {checkModal.open && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.5)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    zIndex: 9999,
                    backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
                    animation: 'fadeIn 0.2s ease',
                }}>
                    <div style={{
                        ...glass,
                        padding: '32px 36px',
                        minWidth: '440px', maxWidth: '560px',
                        maxHeight: '80vh', overflow: 'auto',
                        animation: 'modalIn 0.3s cubic-bezier(.4,0,.2,1)',
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                            {checkModal.done
                                ? <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(52,199,89,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <IconCheck size={16} color="#34C759" />
                                </div>
                                : <IconLoader size={22} color="#6366F1" />
                            }
                            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: colors.text, letterSpacing: '-0.3px' }}>
                                {checkModal.done ? ((lang === 'ru' ? 'Проверка завершена' : (lang === 'en' ? 'Check complete' : 'Verificare completă'))) : ((lang === 'ru' ? 'Проверка' : (lang === 'en' ? 'Checking' : 'Verificare în curs')))}
                            </h2>
                        </div>
                        <p style={{ margin: '0 0 20px 38px', fontSize: '13px', color: colors.textSecondary, fontWeight: '400' }}>
                            {checkModal.restaurantName}
                        </p>

                        {!checkModal.done && (
                            <div style={{ marginBottom: '20px' }}>
                                <div style={{
                                    height: '6px', borderRadius: '3px', overflow: 'hidden',
                                    background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
                                }}>
                                    <div style={{
                                        height: '100%', borderRadius: '3px',
                                        background: 'linear-gradient(90deg, #6366F1, #818CF8)',
                                        width: checkModal.done ? '100%' : '95%',
                                        animation: 'progressGrow 40s cubic-bezier(0.25, 0.1, 0.25, 1) forwards',
                                        transition: 'width 0.5s ease',
                                    }} />
                                </div>
                                <div style={{ fontSize: '12px', color: colors.textSecondary, marginTop: '8px', textAlign: 'center' }}>
                                    {lang === 'en' ? `Checking ${checkModal.total} platforms... ETA: 30-60s` : `Se verifică ${checkModal.total} platforme... Estimare: 30–60s`}
                                </div>
                            </div>
                        )}

                        {checkModal.error && (
                            <div style={{
                                ...glassInner,
                                padding: '12px 16px', marginBottom: '16px',
                                border: '1px solid rgba(255,59,48,0.2)',
                                background: 'rgba(255,59,48,0.08)',
                                display: 'flex', alignItems: 'center', gap: '8px',
                            }}>
                                <IconWarning size={14} color="#FF3B30" />
                                <span style={{ fontSize: '13px', color: '#FF3B30' }}>{checkModal.error}</span>
                            </div>
                        )}

                        {checkModal.results.length > 0 && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '20px' }}>
                                {checkModal.results.map((r, i) => {
                                    const info = getStatusInfo(r.final_status || r.status)
                                    let extraMsg = '';
                                    if (r.final_status === 'error' && r.error) {
                                        extraMsg = r.error;
                                    } else if (r.missing_products && r.missing_products.length > 0) {
                                        const count = r.missing_products.reduce((acc, p) => acc + (p.count || 1), 0);
                                        extraMsg = `Atenție: ${count} produs(e) indisponibil(e)`;
                                    } else if (r.raw_data && r.raw_data.product_stops && r.raw_data.product_stops.stopped > 0) {
                                        extraMsg = `Atenție: ${r.raw_data.product_stops.stopped} pe STOP din ${r.raw_data.product_stops.total}`;
                                    }

                                    return (
                                        <div key={i} style={{
                                            ...glassInner, padding: '10px 14px',
                                            display: 'flex', flexDirection: 'column', gap: '8px',
                                            animation: `fadeIn 0.3s ease ${i * 0.05}s both`,
                                        }}>
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                    <PlatformLogo platform={r.platform} size={18} />
                                                    <span style={{ fontSize: '13px', fontWeight: '500', color: colors.text, textTransform: 'capitalize' }}>
                                                        {r.platform}
                                                    </span>
                                                </div>
                                                <div style={{
                                                    display: 'inline-flex', alignItems: 'center', gap: '6px',
                                                    padding: '4px 10px', borderRadius: '8px',
                                                    background: `${info.color}15`, fontSize: '12px', fontWeight: '600', color: info.color,
                                                }}>
                                                    <span className={`status-dot ${info.dotClass}`} style={{ width: 6, height: 6 }} />
                                                    {info.label}
                                                </div>
                                            </div>
                                            {extraMsg && (
                                                <div style={{
                                                    fontSize: '12px',
                                                    color: r.final_status === 'error' ? '#FF3B30' : '#F59E0B',
                                                    marginTop: '2px',
                                                    padding: '6px 8px',
                                                    background: r.final_status === 'error' ? 'rgba(255,59,48,0.1)' : 'rgba(245,158,11,0.1)',
                                                    borderRadius: '6px',
                                                }}>
                                                    {extraMsg}
                                                </div>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                        )}

                        {!checkModal.done && !checkModal.error && (
                            <button
                                className="btn-hover"
                                onClick={() => setCheckModal(prev => ({ ...prev, open: false }))}
                                style={{
                                    ...btnGhost,
                                    width: '100%',
                                    justifyContent: 'center',
                                    marginTop: '12px'
                                }}
                            >
                                Anulează
                            </button>
                        )}

                        {(checkModal.done || checkModal.error) && (
                            <button
                                className="btn-hover"
                                onClick={() => setCheckModal(prev => ({ ...prev, open: false }))}
                                style={{ ...btnPrimary, width: '100%', justifyContent: 'center' }}
                            >
                                Închide
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* ═══════ SYNC TEST PROGRESS MODAL ═══════ */}
            {syncTestModal.open && syncTestModal.testing && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)',
                    zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                    <div style={{ ...glass, padding: '40px 48px', textAlign: 'center', minWidth: '360px' }}>
                        <IconLoader size={40} color="#6366F1" />
                        <h3 style={{ color: colors.text, margin: '16px 0 8px', fontWeight: 700 }}>Test Sync 1:1 în curs...</h3>
                        <p style={{ color: colors.textSecondary, margin: 0, fontSize: '13px' }}>Se extrag produsele de pe platforme și se compară cu iiko.<br />Poate dura 1–3 minute.</p>
                    </div>
                </div>
            )}
            {syncTestModal.open && !syncTestModal.testing && syncTestModal.error && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)',
                    zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                    <div style={{ ...glass, padding: '32px', minWidth: '360px', textAlign: 'center' }}>
                        <IconWarning size={36} color="#FF3B30" />
                        <h3 style={{ color: '#FF3B30', margin: '12px 0 8px' }}>Eroare</h3>
                        <p style={{ color: colors.textSecondary, fontSize: '13px', marginBottom: '20px' }}>{syncTestModal.error}</p>
                        <button className="btn-hover" onClick={() => setSyncTestModal(p => ({ ...p, open: false }))} style={{ ...btnPrimary, margin: '0 auto' }}>Închide</button>
                    </div>
                </div>
            )}

            {/* ═══════ HEADER ═══════ */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '28px' }}>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                        <IconSignal size={22} color="#6366F1" />
                        <h1 style={{
                            fontSize: '26px', fontWeight: '700', margin: 0, color: colors.text,
                            letterSpacing: '-0.5px',
                        }}>
                            Monitorizare Live
                        </h1>
                    </div>
                    <p style={{ fontSize: '13px', color: colors.textSecondary, margin: 0, paddingLeft: '32px' }}>
                        {(lang === 'ru' ? 'Статус в реальном времени · Обновлен:' : (lang === 'en' ? 'Real-time status · Updated:' : 'Status real-time · Actualizat:'))} {lastRefresh.toLocaleTimeString('ro-RO')}
                    </p>
                </div>

                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <label style={{
                        display: 'flex', alignItems: 'center', gap: '6px',
                        fontSize: '12px', color: colors.textSecondary, cursor: 'pointer',
                        padding: '8px 12px', borderRadius: '10px',
                        background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
                    }}>
                        <input type="checkbox" checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)}
                            style={{ accentColor: '#6366F1', width: 14, height: 14 }} />
                        Auto
                    </label>

                    <button className="btn-hover" onClick={() => triggerCheckAll()} disabled={checkingAll || syncTestModal.testing}
                        style={{ ...btnPrimary, opacity: checkingAll ? 0.6 : 1, cursor: checkingAll ? 'not-allowed' : 'pointer' }}>
                        {checkingAll ? <IconLoader size={14} color="#fff" /> : <IconPlay size={12} color="#fff" />}
                        {checkingAll ? (lang==='en'?'Checking...':'Se verifică...') : (lang==='en'?'Check all':'Verifică toate')}
                    </button>

                    <button className="btn-hover" onClick={() => triggerSyncTestAll()} disabled={checkingAll || syncTestModal.testing}
                        style={{ ...btnGhost, border: `1px solid ${colors.border}`, color: '#FF9500', fontWeight: 'bold' }}>
                        <IconServer size={14} />
                        Sync 1:1
                    </button>

                    <button className="btn-hover" onClick={() => navigate('/sync-reports')}
                        style={{ ...btnGhost, border: `1px solid ${isDark ? 'rgba(99,102,241,0.3)' : 'rgba(99,102,241,0.2)'}`, color: '#6366F1' }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/>
                        </svg>
                        Istoric Sync
                    </button>

                    <button className="btn-hover" onClick={() => fetchData()}
                        style={btnGhost}>
                        <IconRefresh size={14} />
                    </button>
                </div>
            </div>

            {/* ═══════ B2B PORTALS (SUPERLATIVE) ═══════ */}
            <div style={{ ...glass, padding: '24px 28px', marginBottom: '24px', border: `1px solid ${colors.positive}40`, background: isDark ? 'rgba(16, 185, 129, 0.04)' : '#f0fdf4', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: 0, right: 0, width: '150px', height: '150px', background: colors.positive, filter: 'blur(80px)', opacity: 0.1, borderRadius: '50%' }}></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', position: 'relative', zIndex: 2 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '24px' }}>🚀</span>
                        <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: colors.text, letterSpacing: '-0.3px' }}>
                            {lang === 'ru' ? 'Сверхмощный Агрегатор (B2B Порталы)' : lang === 'en' ? 'Superlative Aggregator (B2B Portals)' : 'Arhitectură Superlativ: Integrare Deep B2B Portals'}
                        </h2>
                    </div>
                    <span style={{ fontSize: '11px', background: 'linear-gradient(135deg, #10b981, #059669)', color: '#fff', padding: '6px 12px', borderRadius: '20px', fontWeight: '800', letterSpacing: '0.5px' }}>
                        MOTOARE NOKIA/FAZA 2 DEBLOCATE
                    </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', position: 'relative', zIndex: 2 }}>
                     <div style={{ ...glassInner, padding: '16px', background: isDark ? 'rgba(0,0,0,0.2)' : '#ffffff', border: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(16,185,129,0.2)'}` }}>
                         <div style={{ fontSize: '11px', color: colors.textSecondary, fontWeight: '700', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}><span style={{ color: '#f59e0b' }}>⏸️</span> PAUZE FALSE (TABLETĂ)</div>
                         <div style={{ fontSize: '13px', fontWeight: '600', color: colors.text, lineHeight: '1.4' }}>Citire directă din Merchant Portal. Precizie 100% fără interceptare publică.</div>
                     </div>
                     <div style={{ ...glassInner, padding: '16px', background: isDark ? 'rgba(0,0,0,0.2)' : '#ffffff', border: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(239,68,68,0.2)'}` }}>
                         <div style={{ fontSize: '11px', color: colors.textSecondary, fontWeight: '700', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}><span style={{ color: '#ef4444' }}>🗺️</span> TĂIERE ZONĂ LIVRARE</div>
                         <div style={{ fontSize: '13px', fontWeight: '600', color: colors.text, lineHeight: '1.4' }}>Alerte stricte la restrângerea ascunsă a razei de livrare și pierderi de audiență.</div>
                     </div>
                     <div style={{ ...glassInner, padding: '16px', background: isDark ? 'rgba(0,0,0,0.2)' : '#ffffff', border: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(59,130,246,0.2)'}` }}>
                         <div style={{ fontSize: '11px', color: colors.textSecondary, fontWeight: '700', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}><span style={{ color: '#3b82f6' }}>🛒</span> PRODUSE (OUT OF STOCK)</div>
                         <div style={{ fontSize: '13px', fontWeight: '600', color: colors.text, lineHeight: '1.4' }}>Detectare dacă staff-ul restaurantului a uitat produse premium dezactivate.</div>
                     </div>
                     <div style={{ ...glassInner, padding: '16px', background: isDark ? 'rgba(0,0,0,0.2)' : '#ffffff', border: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(139,92,246,0.2)'}` }}>
                         <div style={{ fontSize: '11px', color: colors.textSecondary, fontWeight: '700', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}><span style={{ color: '#8b5cf6' }}>💸</span> RECUPERARE PIERDERI</div>
                         <div style={{ fontSize: '13px', fontWeight: '600', color: colors.text, lineHeight: '1.4' }}>Calcul matematic al banilor pierduți prin rularea cifrei reale de afaceri.</div>
                     </div>
                </div>
            </div>

            {/* ═══════ SYNC REPORTS TABLE ═══════ */}
            <div style={{ ...glass, padding: '24px 28px', marginBottom: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <IconServer size={20} color="#FF9500" />
                        <h2 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: colors.text }}>
                            Rapoarte Sync 1:1 (Iiko vs Agregatoare)
                        </h2>
                        {syncReports.length > 0 && (
                            <span style={{ fontSize: '11px', background: 'rgba(255,149,0,0.15)', color: '#FF9500', padding: '3px 8px', borderRadius: '8px', fontWeight: '600' }}>
                                {syncReports.length} rapoarte
                            </span>
                        )}
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button className="btn-hover" onClick={fetchSyncReports} style={{ ...btnGhost, padding: '7px 12px' }}>
                            <IconRefresh size={13} />
                        </button>
                        <button className="btn-hover"
                            onClick={() => triggerSyncTestAll()}
                            disabled={syncTestModal.testing}
                            style={{ ...btnBase, background: 'linear-gradient(135deg, #FF9500, #FF6B00)', color: '#fff', fontSize: '13px', opacity: syncTestModal.testing ? 0.6 : 1 }}>
                            <IconPlay size={11} color="#fff" />
                            {syncTestModal.testing ? 'Se testează...' : 'Rulează Test Nou'}
                        </button>
                    </div>
                </div>

                {syncReportsLoading ? (
                    <div style={{ textAlign: 'center', padding: '32px', color: colors.textSecondary, fontSize: '13px' }}>
                        <IconLoader size={20} color="#6366F1" /> &nbsp;Se încarcă rapoartele...
                    </div>
                ) : syncReports.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px 20px', color: colors.textSecondary }}>
                        <IconServer size={32} color={isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'} />
                        <p style={{ marginTop: '12px', fontSize: '14px' }}>Niciun raport salvat încă.</p>
                        <p style={{ fontSize: '12px', margin: 0 }}>Apasă <strong>Rulează Test Nou</strong> pentru a analiza produsele.</p>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
                        {/* Header row */}
                        <div style={{
                            display: 'grid', gridTemplateColumns: '180px 1fr 100px 100px 80px',
                            padding: '8px 14px', fontSize: '11px', fontWeight: '700',
                            color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: '0.5px',
                            borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
                        }}>
                            <span>Data & Ora</span>
                            <span>Restaurante</span>
                            <span style={{ textAlign: 'center' }}>Discrepanțe</span>
                            <span style={{ textAlign: 'center' }}>Status</span>
                            <span></span>
                        </div>

                        {syncReports.map((report) => {
                            const isExpanded = expandedReport === report.id
                            const date = new Date(report.tested_at)
                            const dateStr = date.toLocaleDateString('ro-RO', { day: '2-digit', month: '2-digit', year: 'numeric' })
                            const timeStr = date.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' })
                            const hasIssues = report.total_discrepancies > 0

                            // Flatten all discrepancies
                            const allDiscrepancies = (report.results || []).flatMap(r =>
                                (r.discrepancies || []).map(d => ({ ...d, restaurant: r.restaurant, city: r.city }))
                            )

                            return (
                                <div key={report.id}>
                                    <div
                                        className="glass-row"
                                        style={{
                                            display: 'grid', gridTemplateColumns: '180px 1fr 100px 100px 80px',
                                            padding: '12px 14px', alignItems: 'center', cursor: 'pointer',
                                            borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}`,
                                            background: isExpanded ? (isDark ? 'rgba(99,102,241,0.08)' : 'rgba(99,102,241,0.04)') : 'transparent',
                                        }}
                                        onClick={() => setExpandedReport(isExpanded ? null : report.id)}
                                    >
                                        <div>
                                            <div style={{ fontSize: '13px', fontWeight: '600', color: colors.text }}>{dateStr}</div>
                                            <div style={{ fontSize: '11px', color: colors.textSecondary }}>{timeStr}</div>
                                        </div>
                                        <div style={{ fontSize: '12px', color: colors.textSecondary }}>
                                            {report.total_restaurants} restaurant{report.total_restaurants !== 1 ? 'e' : ''} analizat{report.total_restaurants !== 1 ? 'e' : ''}
                                        </div>
                                        <div style={{ textAlign: 'center' }}>
                                            <span style={{
                                                fontSize: '15px', fontWeight: '700',
                                                color: hasIssues ? '#FF3B30' : '#34C759'
                                            }}>
                                                {report.total_discrepancies}
                                            </span>
                                        </div>
                                        <div style={{ textAlign: 'center' }}>
                                            <span style={{
                                                display: 'inline-flex', alignItems: 'center', gap: '5px',
                                                padding: '4px 10px', borderRadius: '8px', fontSize: '11px', fontWeight: '600',
                                                background: hasIssues ? 'rgba(255,59,48,0.12)' : 'rgba(52,199,89,0.12)',
                                                color: hasIssues ? '#FF3B30' : '#34C759',
                                            }}>
                                                <span style={{ width: 6, height: 6, borderRadius: '50%', background: hasIssues ? '#FF3B30' : '#34C759', display: 'inline-block' }} />
                                                {hasIssues ? 'Probleme' : 'OK'}
                                            </span>
                                        </div>
                                        <div style={{ textAlign: 'right', fontSize: '11px', color: colors.textSecondary }}>
                                            {isExpanded ? '▲' : '▼'}
                                        </div>
                                    </div>

                                    {isExpanded && allDiscrepancies.length > 0 && (() => {
                                        // Reset page when a new report is expanded
                                        const uniqueRestaurants = [...new Set(allDiscrepancies.map(d => d.restaurant))]
                                        const uniquePlatforms = [...new Set(allDiscrepancies.map(d => d.platform))]
                                        const uniqueTypes = [...new Set(allDiscrepancies.map(d => d.type))]

                                        const filtered = allDiscrepancies.filter(d => {
                                            const matchRest = !syncTableFilter.restaurant || d.restaurant === syncTableFilter.restaurant
                                            const matchPlat = !syncTableFilter.platform || d.platform === syncTableFilter.platform
                                            const matchType = !syncTableFilter.type || d.type === syncTableFilter.type
                                            const matchSearch = !syncTableFilter.search || (d.product || d.message || '').toLowerCase().includes(syncTableFilter.search.toLowerCase())
                                            return matchRest && matchPlat && matchType && matchSearch
                                        })

                                        const totalPages = Math.ceil(filtered.length / syncTablePageSize)
                                        const page = Math.min(syncTablePage, totalPages || 1)
                                        const paginated = filtered.slice((page - 1) * syncTablePageSize, page * syncTablePageSize)

                                        const inputStyle = {
                                            padding: '6px 10px', borderRadius: '8px', fontSize: '12px',
                                            border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.12)'}`,
                                            background: isDark ? 'rgba(255,255,255,0.05)' : '#fff',
                                            color: colors.text, outline: 'none', fontFamily: 'inherit',
                                        }

                                        return (
                                        <div style={{
                                            borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
                                            background: isDark ? 'rgba(0,0,0,0.15)' : 'rgba(0,0,0,0.02)',
                                        }}>
                                            {/* ─── Filter Bar ─── */}
                                            <div style={{
                                                display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center',
                                                padding: '12px 28px',
                                                borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
                                            }}>
                                                <input
                                                    style={{ ...inputStyle, width: '180px' }}
                                                    placeholder="🔍 Caută produs..."
                                                    value={syncTableFilter.search}
                                                    onChange={e => { setSyncTableFilter(f => ({ ...f, search: e.target.value })); setSyncTablePage(1) }}
                                                />
                                                <select style={{ ...inputStyle, cursor: 'pointer' }}
                                                    value={syncTableFilter.restaurant}
                                                    onChange={e => { setSyncTableFilter(f => ({ ...f, restaurant: e.target.value })); setSyncTablePage(1) }}>
                                                    <option value="">Toate restaurantele</option>
                                                    {uniqueRestaurants.map(r => <option key={r} value={r}>{r}</option>)}
                                                </select>
                                                <select style={{ ...inputStyle, cursor: 'pointer' }}
                                                    value={syncTableFilter.platform}
                                                    onChange={e => { setSyncTableFilter(f => ({ ...f, platform: e.target.value })); setSyncTablePage(1) }}>
                                                    <option value="">Toate platformele</option>
                                                    {uniquePlatforms.map(p => <option key={p} value={p}>{p}</option>)}
                                                </select>
                                                <select style={{ ...inputStyle, cursor: 'pointer' }}
                                                    value={syncTableFilter.type}
                                                    onChange={e => { setSyncTableFilter(f => ({ ...f, type: e.target.value })); setSyncTablePage(1) }}>
                                                    <option value="">Toate tipurile</option>
                                                    {uniqueTypes.map(t => <option key={t} value={t}>{t === 'missing_on_platform' ? 'LIPSĂ' : 'STOP FALS'}</option>)}
                                                </select>
                                                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    <span style={{ fontSize: '11px', color: colors.textSecondary }}>Rânduri:</span>
                                                    {[10, 25, 50, 100].map(n => (
                                                        <button key={n} onClick={() => { setSyncTablePageSize(n); setSyncTablePage(1) }}
                                                            style={{
                                                                padding: '4px 9px', borderRadius: '6px', fontSize: '11px', fontWeight: '600',
                                                                border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                                                                background: syncTablePageSize === n ? '#6366F1' : (isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)'),
                                                                color: syncTablePageSize === n ? '#fff' : colors.textSecondary,
                                                            }}>{n}</button>
                                                    ))}
                                                </div>
                                                {(syncTableFilter.restaurant || syncTableFilter.platform || syncTableFilter.type || syncTableFilter.search) && (
                                                    <button onClick={() => { setSyncTableFilter({ restaurant: '', platform: '', type: '', search: '' }); setSyncTablePage(1) }}
                                                        style={{ ...inputStyle, cursor: 'pointer', color: '#FF3B30', borderColor: 'rgba(255,59,48,0.3)', background: 'rgba(255,59,48,0.07)' }}>
                                                        ✕ Resetează filtre
                                                    </button>
                                                )}
                                            </div>

                                            {/* ─── Results Count ─── */}
                                            <div style={{ padding: '6px 28px', fontSize: '11px', color: colors.textSecondary, borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}` }}>
                                                <strong style={{ color: colors.text }}>{filtered.length}</strong> discrepanțe
                                                {filtered.length !== allDiscrepancies.length && <span> (filtrate din {allDiscrepancies.length} total)</span>}
                                                {' · '}Pagina <strong style={{ color: colors.text }}>{page}</strong> din <strong style={{ color: colors.text }}>{totalPages || 1}</strong>
                                            </div>

                                            {/* ─── Table Header ─── */}
                                            <div style={{
                                                display: 'grid', gridTemplateColumns: '40px 200px 130px 100px 1fr',
                                                padding: '8px 28px', fontSize: '10px', fontWeight: '700',
                                                color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: '0.5px',
                                                borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
                                                background: isDark ? 'rgba(0,0,0,0.1)' : 'rgba(0,0,0,0.03)',
                                            }}>
                                                <span style={{ textAlign: 'center' }}>#</span>
                                                <span>Restaurant</span>
                                                <span>Platformă</span>
                                                <span>Tip</span>
                                                <span>Produs</span>
                                            </div>

                                            {/* ─── Table Rows ─── */}
                                            {paginated.length === 0 ? (
                                                <div style={{ padding: '24px 28px', fontSize: '13px', color: colors.textSecondary, textAlign: 'center' }}>
                                                    Nicio discrepanță nu corespunde filtrelor selectate.
                                                </div>
                                            ) : paginated.map((d, idx) => {
                                                const globalIdx = (page - 1) * syncTablePageSize + idx + 1
                                                return (
                                                <div key={idx} style={{
                                                    display: 'grid', gridTemplateColumns: '40px 200px 130px 100px 1fr',
                                                    padding: '9px 28px', alignItems: 'center',
                                                    borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)'}`,
                                                    fontSize: '12px',
                                                    background: idx % 2 === 0 ? 'transparent' : (isDark ? 'rgba(255,255,255,0.01)' : 'rgba(0,0,0,0.01)'),
                                                }}>
                                                    <div style={{ textAlign: 'center', color: colors.textSecondary, fontSize: '11px', fontWeight: '500' }}>{globalIdx}</div>
                                                    <div style={{ color: colors.text, fontWeight: '500', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                        {d.restaurant}
                                                        {d.city && <span style={{ color: colors.textSecondary, fontWeight: '400' }}> · {d.city}</span>}
                                                    </div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                        <PlatformLogo platform={d.platform} size={14} />
                                                        <span style={{ textTransform: 'capitalize', color: colors.text, fontWeight: '500' }}>{d.platform}</span>
                                                    </div>
                                                    <div>
                                                        <span style={{
                                                            fontSize: '10px', fontWeight: '700', padding: '2px 7px', borderRadius: '6px',
                                                            background: d.type === 'missing_on_platform' ? 'rgba(255,59,48,0.12)' : 'rgba(255,149,0,0.12)',
                                                            color: d.type === 'missing_on_platform' ? '#FF3B30' : '#FF9500',
                                                        }}>
                                                            {d.type === 'missing_on_platform' ? 'LIPSĂ' : 'STOP FALS'}
                                                        </span>
                                                    </div>
                                                    <div style={{ color: colors.textSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                        {d.product || d.message}
                                                    </div>
                                                </div>
                                            )})}

                                            {/* ─── Pagination ─── */}
                                            {totalPages > 1 && (
                                                <div style={{
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                                                    padding: '12px 28px',
                                                    borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
                                                }}>
                                                    <button onClick={() => setSyncTablePage(1)} disabled={page === 1}
                                                        style={{ padding: '5px 10px', borderRadius: '7px', border: 'none', cursor: page === 1 ? 'not-allowed' : 'pointer', fontFamily: 'inherit', fontSize: '12px', fontWeight: '600', background: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)', color: page === 1 ? colors.textSecondary : colors.text, opacity: page === 1 ? 0.5 : 1 }}>«</button>
                                                    <button onClick={() => setSyncTablePage(p => Math.max(1, p - 1))} disabled={page === 1}
                                                        style={{ padding: '5px 10px', borderRadius: '7px', border: 'none', cursor: page === 1 ? 'not-allowed' : 'pointer', fontFamily: 'inherit', fontSize: '12px', fontWeight: '600', background: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)', color: page === 1 ? colors.textSecondary : colors.text, opacity: page === 1 ? 0.5 : 1 }}>‹</button>
                                                    {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
                                                        let p2;
                                                        if (totalPages <= 7) p2 = i + 1;
                                                        else if (page <= 4) p2 = i + 1;
                                                        else if (page >= totalPages - 3) p2 = totalPages - 6 + i;
                                                        else p2 = page - 3 + i;
                                                        return (
                                                            <button key={p2} onClick={() => setSyncTablePage(p2)}
                                                                style={{ padding: '5px 10px', borderRadius: '7px', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: '12px', fontWeight: '600', minWidth: '32px', background: page === p2 ? '#6366F1' : (isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)'), color: page === p2 ? '#fff' : colors.textSecondary }}>
                                                                {p2}
                                                            </button>
                                                        )
                                                    })}
                                                    <button onClick={() => setSyncTablePage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                                                        style={{ padding: '5px 10px', borderRadius: '7px', border: 'none', cursor: page === totalPages ? 'not-allowed' : 'pointer', fontFamily: 'inherit', fontSize: '12px', fontWeight: '600', background: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)', color: page === totalPages ? colors.textSecondary : colors.text, opacity: page === totalPages ? 0.5 : 1 }}>›</button>
                                                    <button onClick={() => setSyncTablePage(totalPages)} disabled={page === totalPages}
                                                        style={{ padding: '5px 10px', borderRadius: '7px', border: 'none', cursor: page === totalPages ? 'not-allowed' : 'pointer', fontFamily: 'inherit', fontSize: '12px', fontWeight: '600', background: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)', color: page === totalPages ? colors.textSecondary : colors.text, opacity: page === totalPages ? 0.5 : 1 }}>»</button>
                                                </div>
                                            )}
                                        </div>
                                        )
                                    })()}
                                    {isExpanded && allDiscrepancies.length === 0 && (
                                        <div style={{ padding: '16px 28px', fontSize: '13px', color: '#34C759', borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}` }}>
                                            ✓ Toate produsele sunt sincronizate perfect cu iiko.
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>

            {/* ═══════ STAT CARDS ═══════ */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px', marginBottom: '24px' }}>
                {[
                    { label: (lang === 'ru' ? 'Рестораны' : (lang === 'en' ? 'Restaurants' : 'Restaurante')), value: restaurants.length, sub: (lang === 'ru' ? 'Активный мониторинг' : (lang === 'en' ? 'Active monitoring' : 'Monitorizare activă')), color: '#6366F1', icon: <IconSignal size={16} color="#6366F1" />, href: '/restaurants', hint: (lang === 'ru' ? 'Посмотреть рестораны →' : (lang === 'en' ? 'View restaurants →' : 'Vezi restaurante →')) },
                    { label: (lang === 'ru' ? 'Доступность' : (lang === 'en' ? 'Availability' : 'Disponibilitate')), value: `${uptimePercent}%`, sub: `${availableCount}/${totalChecks} disponibile`, color: uptimePercent > 90 ? '#34C759' : uptimePercent > 70 ? '#FF9500' : '#FF3B30', icon: <IconCheck size={16} color={uptimePercent > 90 ? '#34C759' : '#FF9500'} />, href: '/stop-control', hint: 'Stop Control →' },
                    { label: (lang === 'ru' ? 'Проверки' : (lang === 'en' ? 'Checks' : 'Verificări')), value: checks.length, sub: (lang === 'ru' ? 'Всего записано' : (lang === 'en' ? 'Total recorded' : 'Total înregistrate')), color: '#8E8E93', icon: <IconHistory size={16} color="#8E8E93" />, href: '/events', hint: (lang === 'ru' ? 'Посмотреть события →' : (lang === 'en' ? 'View events →' : 'Vezi evenimente →')) },
                    { label: (lang === 'ru' ? 'Проблемы' : (lang === 'en' ? 'Issues' : 'Probleme')), value: issueCount, sub: issueCount === 0 ? ((lang === 'ru' ? 'Все ОК' : (lang === 'en' ? 'All OK' : 'Totul OK'))) : ((lang === 'ru' ? 'Требует внимания' : (lang === 'en' ? 'Needs attention' : 'Necesită atenție'))), color: issueCount > 0 ? '#FF3B30' : '#34C759', icon: <IconWarning size={16} color={issueCount > 0 ? '#FF3B30' : '#34C759'} />, href: '/alerts', hint: (lang === 'ru' ? 'Посмотреть оповещения →' : (lang === 'en' ? 'View alerts →' : 'Vezi alerte →')) },
                ].map((stat, i) => (
                    <div key={i}
                        onClick={() => navigate(stat.href)}
                        onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = isDark ? '0 8px 24px rgba(0,0,0,0.3)' : '0 8px 24px rgba(0,0,0,0.1)' }}
                        onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none' }}
                        style={{
                            ...glass, padding: '22px 24px',
                            animation: `fadeIn 0.4s ease ${i * 0.08}s both`,
                            cursor: 'pointer',
                            transition: 'transform 0.18s ease, box-shadow 0.18s ease',
                        }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                            <span style={{ fontSize: '12px', fontWeight: '500', color: colors.textSecondary, letterSpacing: '0.3px', textTransform: 'uppercase' }}>
                                {stat.label}
                            </span>
                            <div style={{
                                width: 32, height: 32, borderRadius: '10px',
                                background: `${stat.color}12`,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>
                                {stat.icon}
                            </div>
                        </div>
                        <div style={{ fontSize: '34px', fontWeight: '700', color: stat.color, letterSpacing: '-1px', lineHeight: 1, marginBottom: '6px' }}>
                            {stat.value}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '11px', color: colors.textSecondary, fontWeight: '400' }}>{stat.sub}</span>
                            <span style={{ fontSize: '10px', color: stat.color, fontWeight: '600', opacity: 0.8 }}>{stat.hint}</span>
                        </div>
                    </div>
                ))}
            </div>

            {/* ═══════ PLATFORM HEALTH ═══════ */}
            <div style={{ ...glass, padding: '24px 28px', marginBottom: '24px' }}>
                <div style={{ fontSize: '14px', fontWeight: '600', color: colors.text, marginBottom: '20px', letterSpacing: '-0.2px' }}>
                    Status Platforme
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
                    {platformsList.map(platform => {
                        const platformChecks = latestChecksArray.filter(c => c.platform === platform)
                        const platformAvailable = platformChecks.filter(c => c.final_status === 'available').length
                        const platformUptime = platformChecks.length > 0 ? Math.round((platformAvailable / platformChecks.length) * 100) : 0
                        const barColor = platformUptime > 90 ? '#34C759' : platformUptime > 70 ? '#FF9500' : '#FF3B30'
                        return (
                            <div key={platform} style={{ ...glassInner, padding: '18px 20px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
                                    <PlatformLogo platform={platform} size={24} />
                                    <span style={{ fontSize: '14px', fontWeight: '600', color: colors.text, textTransform: 'capitalize' }}>
                                        {platform}
                                    </span>
                                    <span style={{
                                        marginLeft: 'auto', fontSize: '20px', fontWeight: '700',
                                        color: barColor, letterSpacing: '-0.5px',
                                    }}>
                                        {platformUptime}%
                                    </span>
                                </div>
                                <div style={{
                                    height: '6px', borderRadius: '3px', overflow: 'hidden',
                                    background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
                                }}>
                                    <div style={{
                                        height: '100%', width: `${platformUptime}%`,
                                        borderRadius: '3px',
                                        background: `linear-gradient(90deg, ${barColor}, ${barColor}CC)`,
                                        transition: 'width 0.6s cubic-bezier(.4,0,.2,1)',
                                    }} />
                                </div>
                                <div style={{ fontSize: '11px', color: colors.textSecondary, marginTop: '8px' }}>
                                    {platformAvailable}/{platformChecks.length} {(lang === 'ru' ? 'рестораны доступны' : (lang === 'en' ? 'restaurants available' : 'restaurante disponibile'))}
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* ═══════ CHECK HISTORY ═══════ */}
            {showHistory && (
                <div style={{ ...glass, padding: '24px 28px', marginBottom: '24px', animation: 'fadeIn 0.3s ease' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <IconHistory size={16} color={colors.textSecondary} />
                            <span style={{ fontSize: '14px', fontWeight: '600', color: colors.text }}>
                                Istoric verificări
                            </span>
                            <span style={{
                                fontSize: '11px', padding: '2px 8px', borderRadius: '6px',
                                background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
                                color: colors.textSecondary,
                            }}>
                                Ultimele 50
                            </span>
                        </div>
                        <button onClick={() => setShowHistory(false)}
                            style={{ background: 'none', border: 'none', color: colors.textSecondary, cursor: 'pointer', padding: '4px', borderRadius: '6px' }}>
                            <IconX size={16} />
                        </button>
                    </div>
                    <div style={{ maxHeight: '400px', overflow: 'auto', borderRadius: '12px' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ borderBottom: isDark ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(0,0,0,0.06)' }}>
                                    {[(lang === 'ru' ? 'Время' : (lang === 'en' ? 'Time' : 'Timp')), 'Restaurant', (lang === 'ru' ? 'Платформа' : (lang === 'en' ? 'Platform' : 'Platformă')), 'Status', 'Rating', 'Info'].map(h => (
                                        <th key={h} style={{
                                            padding: '10px 14px', textAlign: h === 'Restaurant' || h === 'Timp' || h === 'Info' ? 'left' : 'center',
                                            fontSize: '11px', fontWeight: '600', color: colors.textSecondary,
                                            textTransform: 'uppercase', letterSpacing: '0.5px',
                                        }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {recentHistory.map((check, i) => {
                                    const rest = restaurants.find(r => r.id === check.restaurant_id)
                                    const info = getStatusInfo(check.final_status)
                                    return (
                                        <tr key={check.id || i} className="glass-row" style={{
                                            borderBottom: isDark ? '0.5px solid rgba(255,255,255,0.04)' : '0.5px solid rgba(0,0,0,0.04)',
                                        }}>
                                            <td style={{ padding: '10px 14px', fontSize: '12px', color: colors.textSecondary, whiteSpace: 'nowrap' }}>
                                                {new Date(check.checked_at).toLocaleString('ro-RO', { hour: '2-digit', minute: '2-digit', second: '2-digit', day: '2-digit', month: '2-digit' })}
                                            </td>
                                            <td style={{ padding: '10px 14px', fontSize: '12px', fontWeight: '500', color: colors.text }}>
                                                {rest?.name || '—'}
                                            </td>
                                            <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                                                    <PlatformLogo platform={check.platform} size={14} />
                                                    <span style={{ fontSize: '11px', color: colors.textSecondary, textTransform: 'capitalize' }}>{check.platform}</span>
                                                </div>
                                            </td>
                                            <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                                                <span style={{
                                                    display: 'inline-flex', alignItems: 'center', gap: '5px',
                                                    padding: '3px 10px', borderRadius: '8px',
                                                    background: `${info.color}12`, fontSize: '11px', fontWeight: '600', color: info.color,
                                                }}>
                                                    <span className={`status-dot ${info.dotClass}`} style={{ width: 6, height: 6 }} />
                                                    {info.label}
                                                </span>
                                            </td>
                                            <td style={{ padding: '10px 14px', textAlign: 'center', fontSize: '12px', color: colors.text }}>
                                                {check.rating ? `${check.rating}/10` : '—'}
                                            </td>
                                            <td style={{ padding: '10px 14px', fontSize: '11px', color: colors.textSecondary, maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {check.ui_error_message || '—'}
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* ═══════ RESTAURANT GRID BY CITY ═══════ */}
            {Object.entries(citiesMap).map(([city, cityRestaurants], cityIdx) => (
                <div key={city} style={{ marginBottom: '20px', animation: `fadeIn 0.4s ease ${cityIdx * 0.06}s both` }}>
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: '8px',
                        marginBottom: '10px', paddingLeft: '4px',
                    }}>
                        <IconMapPin size={14} color="#6366F1" />
                        <h2 style={{
                            fontSize: '15px', fontWeight: '600', color: colors.text, margin: 0, letterSpacing: '-0.2px',
                        }}>
                            {city}
                        </h2>
                        <span style={{
                            fontSize: '11px', fontWeight: '400', color: colors.textSecondary,
                            padding: '2px 8px', borderRadius: '6px',
                            background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
                        }}>
                            {cityRestaurants.length}
                        </span>
                    </div>

                    <div style={{ ...glass, overflow: 'hidden' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{
                                    borderBottom: isDark ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(0,0,0,0.06)',
                                }}>
                                    <th style={{ padding: '12px 20px', textAlign: 'left', fontSize: '11px', fontWeight: '600', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                        Restaurant
                                    </th>
                                    {platformsList.map(p => (
                                        <th key={p} style={{ padding: '12px 16px', textAlign: 'center', fontSize: '11px', fontWeight: '600', color: colors.textSecondary }}>
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                                                <PlatformLogo platform={p} size={14} />
                                                <span style={{ textTransform: 'capitalize' }}>{p}</span>
                                            </div>
                                        </th>
                                    ))}
                                    <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '11px', fontWeight: '600', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                        Ultima
                                    </th>
                                    <th style={{ padding: '12px 20px', textAlign: 'right', fontSize: '11px', fontWeight: '600', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                        Acțiuni
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {cityRestaurants.map((restaurant, idx) => {
                                    const latestPlatformChecks = platformsList.map(p => getLatestCheck(restaurant.id, p))
                                    const hasUrl = platformsList.map(p => !!restaurant[`${p}_url`])
                                    const mostRecentCheck = latestPlatformChecks.filter(Boolean).sort((a, b) =>
                                        new Date(b?.checked_at).getTime() - new Date(a?.checked_at).getTime()
                                    )[0]

                                    return (
                                        <tr key={restaurant.id} className="glass-row" style={{
                                            borderBottom: idx < cityRestaurants.length - 1
                                                ? (isDark ? '0.5px solid rgba(255,255,255,0.04)' : '0.5px solid rgba(0,0,0,0.04)')
                                                : 'none',
                                        }}>
                                            <td style={{ padding: '14px 20px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                    {/* Brand logo */}
                                                    <div style={{
                                                        width: '32px', height: '32px', borderRadius: '8px', flexShrink: 0,
                                                        background: restaurant.brands?.logo_url ? 'white' : 'rgba(99,102,241,0.15)',
                                                        border: '1px solid rgba(99,102,241,0.2)',
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                        overflow: 'hidden', padding: restaurant.brands?.logo_url ? '3px' : 0,
                                                        fontSize: '14px', fontWeight: '700', color: '#6366F1',
                                                    }}>
                                                        {restaurant.brands?.logo_url ? (
                                                            <img src={restaurant.brands.logo_url} alt=""
                                                                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                                                                onError={e => { e.currentTarget.style.display = 'none' }}
                                                            />
                                                        ) : (
                                                            restaurant.brands?.name?.charAt(0) || '?'
                                                        )}
                                                    </div>
                                                    <div>
                                                        <div style={{ fontSize: '13px', fontWeight: '600', color: colors.text, letterSpacing: '-0.1px' }}>
                                                            {restaurant.name}
                                                        </div>
                                                        {restaurant.brands?.name && (
                                                            <div style={{ fontSize: '11px', color: colors.textSecondary, marginTop: '1px' }}>
                                                                {restaurant.brands.name}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>

                                            {platformsList.map((p, pIdx) => {
                                                const check = latestPlatformChecks[pIdx]
                                                const url = hasUrl[pIdx]
                                                const platformUrl = restaurant[`${p}_url`]

                                                if (!url) {
                                                    return (
                                                        <td key={p} style={{ padding: '14px 16px', textAlign: 'center' }}>
                                                            <span style={{ fontSize: '12px', color: colors.textSecondary, opacity: 0.4 }}>—</span>
                                                        </td>
                                                    )
                                                }

                                                const info = check ? getStatusInfo(check.final_status) : statusConfig.pending
                                                return (
                                                    <td key={p} style={{ padding: '14px 16px', textAlign: 'center' }}>
                                                        <a
                                                            href={platformUrl}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            title={`Deschide pe ${p}`}
                                                            className="status-badge"
                                                            style={{
                                                                background: `${info.color}10`,
                                                                color: info.color,
                                                            }}
                                                        >
                                                            <span className={`status-dot ${info.dotClass}`} style={{ width: 7, height: 7 }} />
                                                            {info.label}
                                                            <IconExternalLink size={9} color={info.color} />
                                                        </a>
                                                    </td>
                                                )
                                            })}

                                            <td style={{ padding: '14px 16px', textAlign: 'center', fontSize: '12px', color: colors.textSecondary, fontWeight: '400' }}>
                                                {getTimeSince(mostRecentCheck?.checked_at)}
                                            </td>

                                            <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                                                {(()=>{ const hasLinks = restaurant.glovo_url || restaurant.wolt_url || restaurant.bolt_url; return (
                                                <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                                                    <button
                                                        className="btn-hover"
                                                        onClick={() => {
                                                            if (hasLinks) triggerCheck(restaurant.id)
                                                            else triggerAutoDiscover(restaurant)
                                                        }}
                                                        disabled={checkingId === restaurant.id || discoveringId === restaurant.id || syncTestModal.testing}
                                                        style={{
                                                            ...btnSmall,
                                                            background: !hasLinks ? '#F59E0B' : btnSmall.background,
                                                            opacity: (checkingId === restaurant.id || discoveringId === restaurant.id) ? 0.5 : 1,
                                                            cursor: (checkingId === restaurant.id || discoveringId === restaurant.id) ? 'not-allowed' : 'pointer',
                                                        }}
                                                    >
                                                        {checkingId === restaurant.id || discoveringId === restaurant.id
                                                            ? <IconLoader size={12} color="#fff" />
                                                            : (!hasLinks ? <span style={{fontSize:'10px'}}>🔍</span> : <IconPlay size={10} color="#fff" />)
                                                        }
                                                        {checkingId === restaurant.id ? 'Verificare...' : (discoveringId === restaurant.id ? 'Cautare...' : (!hasLinks ? 'Auto Link' : 'Verifică'))}
                                                    </button>
                                                    {restaurant.iiko_config?.api_login && (
                                                        <button
                                                            className="btn-hover"
                                                            onClick={() => triggerSyncTestAll(restaurant.id)}
                                                            disabled={syncTestModal.testing}
                                                            title="Sincronizare 1:1 Iiko"
                                                            style={{
                                                                ...btnSmall,
                                                                background: 'transparent',
                                                                border: `1px solid ${colors.border}`,
                                                                color: '#FF9500',
                                                                padding: '6px 8px',
                                                            }}
                                                        >
                                                            <IconServer size={12} />
                                                        </button>
                                                    )}
                                                </div>
                                                );})()}
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            ))}

            {restaurants.length === 0 && (
                <div style={{ ...glass, padding: '60px 40px', textAlign: 'center' }}>
                    <IconSignal size={48} color={colors.textSecondary} />
                    <div style={{ fontSize: '16px', fontWeight: '600', color: colors.text, marginTop: '16px', marginBottom: '6px' }}>
                        Nu sunt restaurante de monitorizat
                    </div>
                    <div style={{ fontSize: '13px', color: colors.textSecondary }}>
                        Adăugați restaurante mai întâi
                    </div>
                </div>
            )}

            <Toaster />
        </div>
    )
}
