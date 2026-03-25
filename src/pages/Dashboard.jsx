import { useTheme } from '../lib/ThemeContext'
import { useLanguage } from '../lib/LanguageContext'
import { supabase } from '../lib/supabaseClient'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { useState, useEffect, useMemo } from 'react'

// ─── SVG Mini-Sparkline ───
function Sparkline({ data = [], color = '#6366F1', width = 80, height = 28 }) {
    if (data.length < 2) return null
    const max = Math.max(...data, 1)
    const min = Math.min(...data, 0)
    const range = max - min || 1
    const points = data.map((v, i) => {
        const x = (i / (data.length - 1)) * width
        const y = height - ((v - min) / range) * (height - 4) - 2
        return `${x},${y}`
    }).join(' ')
    return (
        <svg width={width} height={height} style={{ display: 'block' }}>
            <defs>
                <linearGradient id={`sp-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity="0.3" />
                    <stop offset="100%" stopColor={color} stopOpacity="0" />
                </linearGradient>
            </defs>
            <polygon
                points={`0,${height} ${points} ${width},${height}`}
                fill={`url(#sp-${color.replace('#', '')})`}
            />
            <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    )
}

// ─── SVG Donut Chart ───
function DonutChart({ segments = [], size = 160, strokeWidth = 18, isDark }) {
    const total = segments.reduce((s, seg) => s + seg.value, 0) || 1
    const radius = (size - strokeWidth) / 2
    const circumference = 2 * Math.PI * radius
    let accumulatedOffset = 0

    return (
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
            <circle cx={size / 2} cy={size / 2} r={radius} fill="none"
                stroke={isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'} strokeWidth={strokeWidth} />
            {segments.map((seg, i) => {
                const pct = seg.value / total
                const dashLen = pct * circumference
                const gap = circumference - dashLen
                const offset = -accumulatedOffset * circumference
                accumulatedOffset += pct
                return (
                    <circle key={i} cx={size / 2} cy={size / 2} r={radius} fill="none"
                        stroke={seg.color} strokeWidth={strokeWidth}
                        strokeDasharray={`${dashLen} ${gap}`} strokeDashoffset={offset}
                        strokeLinecap="round"
                        style={{ transition: 'stroke-dashoffset 0.8s ease, stroke-dasharray 0.8s ease' }}
                    />
                )
            })}
        </svg>
    )
}

// ─── SVG Bar Chart ───
function BarChart({ data = [], height = 120, isDark }) {
    const max = Math.max(...data.map(d => d.value), 1)
    const vw = 500
    const barWidth = Math.min(16, (vw - 40) / data.length * 0.7)
    const totalBarsWidth = barWidth * data.length
    const totalGap = vw - 40 - totalBarsWidth
    const gap = totalGap / (data.length + 1)
    return (
        <svg width="100%" height={height} viewBox={`0 0 ${vw} ${height}`} preserveAspectRatio="xMidYMid meet" style={{ display: 'block' }}>
            {data.map((d, i) => {
                const barH = Math.max(2, (d.value / max) * (height - 30))
                const x = 20 + gap + i * (barWidth + gap)
                const y = height - barH - 20
                const showLabel = i % 3 === 0 || i === data.length - 1
                return (
                    <g key={i}>
                        <rect x={x} y={y} width={barWidth} height={barH}
                            rx={barWidth / 4}
                            fill={d.color || '#6366F1'}
                            opacity={0.85}
                        />
                        {showLabel && (
                            <text x={x + barWidth / 2} y={height - 4} textAnchor="middle"
                                fill={isDark ? '#98989d' : '#86868b'} fontSize="10" fontFamily="system-ui">{d.label}</text>
                        )}
                    </g>
                )
            })}
        </svg>
    )
}

// ─── Animated Counter ───
function AnimCounter({ value, duration = 800 }) {
    const [display, setDisplay] = useState(0)
    useEffect(() => {
        let start = 0
        const end = typeof value === 'number' ? value : 0
        if (end === 0) { setDisplay(0); return }
        const step = Math.max(1, Math.floor(end / (duration / 16)))
        const timer = setInterval(() => {
            start += step
            if (start >= end) { setDisplay(end); clearInterval(timer) }
            else setDisplay(start)
        }, 16)
        return () => clearInterval(timer)
    }, [value, duration])
    return <>{display}</>
}

// ─── Platform Logo ───
function PlatformLogo({ platform, size = 20 }) {
    const logos = {
        glovo: 'https://upload.wikimedia.org/wikipedia/commons/7/78/Current_Logo_Glovo.jpg',
        wolt: 'https://brandlogos.net/wp-content/uploads/2025/05/wolt-logo_brandlogos.net_dijtc.png',
        bolt: 'https://media.voog.com/0000/0039/0361/photos/Bolt.png',
    }
    return <img src={logos[platform] || ''} alt={platform} style={{ width: size, height: size, objectFit: 'contain', borderRadius: '4px', background: 'white' }}
        onError={e => { e.currentTarget.style.display = 'none' }} />
}

export default function Dashboard() {
    const { colors, isDark } = useTheme()
    const { lang } = useLanguage()
    const [now, setNow] = useState(new Date())

    useEffect(() => {
        const t = setInterval(() => setNow(new Date()), 30000)
        return () => clearInterval(t)
    }, [])

    // ─── Data Queries ───
    const { data: restaurants = [] } = useQuery({
        queryKey: ['restaurants'],
        queryFn: async () => {
            const { data, error } = await supabase.from('restaurants').select('*')
            if (error) throw error
            return data
        },
        refetchInterval: 30000
    })

    const { data: alerts = [] } = useQuery({
        queryKey: ['recent-alerts-dash'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('alerts')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(8)
            if (error) throw error
            return data
        },
        refetchInterval: 10000
    })

    const { data: recentChecks = [] } = useQuery({
        queryKey: ['recent-checks-dash'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('monitoring_checks')
                .select('*')
                .order('checked_at', { ascending: false })
                .limit(200)
            if (error) throw error
            return data
        },
        refetchInterval: 30000
    })

    const { data: stopEvents = [] } = useQuery({
        queryKey: ['stop-events-dash'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('stop_events')
                .select('*')
                .order('stopped_at', { ascending: false })
                .limit(50)
            if (error) throw error
            return data || []
        },
        refetchInterval: 60000
    })

    // ─── Computed Stats ───
    const activeRestaurants = restaurants.filter(r => r.is_active).length
    const unreadAlerts = alerts.filter(a => !a.is_read).length
    const criticalAlerts = alerts.filter(a => a.severity === 'critical' && !a.is_resolved).length

    // Platform availability
    const platformData = useMemo(() => {
        const platforms = ['glovo', 'wolt', 'bolt']
        return platforms.map(p => {
            const checks = recentChecks.filter(c => c.platform === p)
            // Get unique restaurants with latest check per platform
            const latestPerRestaurant = {}
            checks.forEach(c => {
                if (!latestPerRestaurant[c.restaurant_id] ||
                    new Date(c.checked_at) > new Date(latestPerRestaurant[c.restaurant_id].checked_at)) {
                    latestPerRestaurant[c.restaurant_id] = c
                }
            })
            const latest = Object.values(latestPerRestaurant)
            const available = latest.filter(c => c.final_status === 'available').length
            const total = latest.length  // 0 if no checks yet
            return {
                platform: p,
                available,
                total,
                pct: total > 0 ? Math.round((available / total) * 100) : null,  // null = no data
                color: p === 'glovo' ? '#FFC244' : p === 'wolt' ? '#009DE0' : '#34D186'
            }
        })
    }, [recentChecks])

    const overallAvailability = useMemo(() => {
        const totalAvailable = platformData.reduce((s, p) => s + p.available, 0)
        const totalChecked = platformData.reduce((s, p) => s + p.total, 0)
        if (totalChecked === 0) return null  // no data yet
        return Math.round((totalAvailable / totalChecked) * 100)
    }, [platformData])

    // Stop events by hour (last 24h)
    const hourlyStops = useMemo(() => {
        const hours = []
        for (let i = 23; i >= 0; i--) {
            const d = new Date(now)
            d.setHours(d.getHours() - i, 0, 0, 0)
            const label = d.getHours().toString().padStart(2, '0')
            const count = stopEvents.filter(e => {
                const s = new Date(e.started_at)
                return s.getHours() === d.getHours() && s.toDateString() === d.toDateString()
            }).length
            hours.push({ label, value: count, color: count === 0 ? (isDark ? '#2D2D30' : '#E5E7EB') : count < 3 ? '#6366F1' : '#FF453A' })
        }
        return hours
    }, [stopEvents, now, isDark])

    // Sparkline data for cards (simulated from checks over time)
    const sparklineData = useMemo(() => {
        const pts = []
        for (let i = 7; i >= 0; i--) {
            const d = new Date(now)
            d.setHours(d.getHours() - i * 3)
            const count = recentChecks.filter(c => {
                const ct = new Date(c.checked_at)
                return Math.abs(ct.getTime() - d.getTime()) < 3 * 3600 * 1000 && c.final_status === 'available'
            }).length
            pts.push(count)
        }
        return pts
    }, [recentChecks, now])

    // City breakdown
    const cityBreakdown = useMemo(() => {
        const cities = {}
        restaurants.forEach(r => {
            const city = r.city || 'Altele'
            if (!cities[city]) cities[city] = { name: city, total: 0, withIssues: 0 }
            cities[city].total++
            const hasIssue = recentChecks.some(c =>
                c.restaurant_id === r.id && c.final_status !== 'available'
            )
            if (hasIssue) cities[city].withIssues++
        })
        return Object.values(cities).sort((a, b) => b.total - a.total).slice(0, 8)
    }, [restaurants, recentChecks])

    // Active stops right now
    const activeStops = stopEvents.filter(e => !e.ended_at).length

    // ─── Styles ───
    const glass = {
        background: isDark ? 'rgba(44,44,46,0.65)' : 'rgba(255,255,255,0.75)',
        backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
        border: `0.5px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}`,
        borderRadius: '16px',
    }
    const glassInner = {
        background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.025)',
        borderRadius: '12px',
    }

    const getSeverityColor = (severity) => {
        switch (severity) {
            case 'critical': return '#FF453A'
            case 'high': return '#FF9500'
            case 'medium': return '#FFD60A'
            case 'low': return '#007AFF'
            default: return colors.textSecondary
        }
    }

    const timeSince = (dateStr) => {
        if (!dateStr) return ''
        const diff = (now.getTime() - new Date(dateStr).getTime()) / 1000
        if (diff < 60) return 'acum'
        if (diff < 3600) return `${Math.floor(diff / 60)}m`
        if (diff < 86400) return `${Math.floor(diff / 3600)}h`
        return `${Math.floor(diff / 86400)}z`
    }

    return (
        <div style={{
            padding: '24px 32px',
            
        }}>
            <style>{`
                @keyframes fadeUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
                @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
                .dash-card { transition: transform 0.2s ease, box-shadow 0.2s ease; }
                .dash-card:hover { transform: translateY(-2px); box-shadow: 0 8px 32px rgba(0,0,0,0.12); }
                .dash-link { transition: all 0.15s ease; }
                .dash-link:hover { opacity: 0.85; transform: translateY(-1px); }
            `}</style>

            {/* ═══ HEADER ═══ */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '28px', animation: 'fadeUp 0.3s ease' }}>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '4px' }}>
                        <div style={{
                            width: 36, height: 36, borderRadius: '10px',
                            background: 'linear-gradient(135deg, #2bbec8, #008080)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            boxShadow: '0 4px 12px rgba(43,190,200,0.3)',
                        }}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
                                <rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
                            </svg>
                        </div>
                        <h1 style={{ fontSize: '26px', fontWeight: '700', margin: 0, color: colors.text, letterSpacing: '-0.5px' }}>
                            Dashboard
                        </h1>
                    </div>
                    <p style={{ fontSize: '13px', color: colors.textSecondary, margin: '2px 0 0 48px' }}>
                        {lang === 'ru' ? 'Мониторинг финансовых потерь' : lang === 'en' ? 'Financial loss monitoring' : 'Monitorizare pierderi financiare'} • {lang === 'ru' ? 'Обновлено' : lang === 'en' ? 'Updated' : 'Actualizat'}: {now.toLocaleTimeString(lang === 'ru' ? 'ru-RU' : lang === 'en' ? 'en-US' : 'ro-RO')}
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <Link to="/monitoring" className="dash-link" style={{
                        ...glass, padding: '10px 18px', textDecoration: 'none',
                        display: 'flex', alignItems: 'center', gap: '8px',
                        fontSize: '13px', fontWeight: '600', color: colors.text, cursor: 'pointer',
                    }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#34C759', boxShadow: '0 0 8px rgba(52,199,89,0.5)', animation: 'pulse 2s ease infinite' }} />
                        Live Monitor
                    </Link>
                </div>
            </div>

            {/* ═══ ROW 1: KEY METRICS ═══ */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '20px' }}>
                {/* Card 1: Restaurants */}
                <div className="dash-card" style={{ ...glass, padding: '22px 24px', animation: 'fadeUp 0.3s ease 0.05s both' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                            <div style={{ fontSize: '12px', fontWeight: '500', color: colors.textSecondary, marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{lang === 'ru' ? 'Рестораны' : lang === 'en' ? 'Restaurants' : 'Restaurante'}</div>
                            <div style={{ fontSize: '34px', fontWeight: '700', color: colors.text, lineHeight: 1, letterSpacing: '-1px' }}>
                                <AnimCounter value={restaurants.length} />
                            </div>
                            <div style={{ fontSize: '12px', color: colors.green, marginTop: '6px', fontWeight: '600' }}>
                                {activeRestaurants} {lang === 'ru' ? 'активно' : lang === 'en' ? 'active' : 'active'}
                            </div>
                        </div>
                        <div style={{
                            width: 42, height: 42, borderRadius: '12px',
                            background: `linear-gradient(135deg, ${isDark ? 'rgba(99,102,241,0.15)' : 'rgba(99,102,241,0.08)'}, ${isDark ? 'rgba(139,92,246,0.15)' : 'rgba(139,92,246,0.08)'})`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6366F1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                            </svg>
                        </div>
                    </div>
                </div>

                {/* Card 2: Availability */}
                <Link to="/monitoring" style={{ textDecoration: 'none' }}>
                    <div className="dash-card" style={{ ...glass, padding: '22px 24px', animation: 'fadeUp 0.3s ease 0.1s both', cursor: 'pointer', transition: 'transform 0.2s ease, box-shadow 0.2s ease' }}
                        onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.12)' }}
                        onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div>
                                <div style={{ fontSize: '12px', fontWeight: '500', color: colors.textSecondary, marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{lang === 'ru' ? 'Доступность' : lang === 'en' ? 'Availability' : 'Disponibilitate'}</div>
                                <div style={{ fontSize: '34px', fontWeight: '700', color: overallAvailability === null ? colors.textSecondary : overallAvailability >= 80 ? colors.green : overallAvailability >= 50 ? '#FF9500' : colors.red, lineHeight: 1, letterSpacing: '-1px' }}>
                                    {overallAvailability === null ? '—' : <><AnimCounter value={overallAvailability} />%</>}
                                </div>
                                <div style={{ fontSize: '12px', color: colors.textSecondary, marginTop: '6px' }}>
                                    {overallAvailability === null ? (lang === 'ru' ? 'Пока нет проверок' : lang === 'en' ? 'No checks yet' : 'Fără verificări încă') : (lang === 'ru' ? 'на всех платформах' : lang === 'en' ? 'on all platforms' : 'pe toate platformele')}
                                </div>
                            </div>
                            <Sparkline data={sparklineData} color={colors.green} />
                        </div>
                    </div>
                </Link>

                {/* Card 3: Active Stops */}
                <Link to="/stop-control" style={{ textDecoration: 'none' }}>
                    <div className="dash-card" style={{ ...glass, padding: '22px 24px', animation: 'fadeUp 0.3s ease 0.15s both', cursor: 'pointer', transition: 'transform 0.2s ease, box-shadow 0.2s ease' }}
                        onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.12)' }}
                        onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div>
                                <div style={{ fontSize: '12px', fontWeight: '500', color: colors.textSecondary, marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{lang === 'ru' ? 'Активные остановки' : lang === 'en' ? 'Active Stops' : 'Opriri Active'}</div>
                                <div style={{ fontSize: '34px', fontWeight: '700', color: activeStops === 0 ? colors.green : colors.red, lineHeight: 1, letterSpacing: '-1px' }}>
                                    <AnimCounter value={activeStops} />
                                </div>
                                <div style={{ fontSize: '12px', color: activeStops > 0 ? colors.red : colors.textSecondary, marginTop: '6px', fontWeight: activeStops > 0 ? '600' : '400' }}>
                                    {activeStops > 0 ? (lang === 'ru' ? 'требует внимания!' : lang === 'en' ? 'needs attention!' : 'necesită atenție!') : (lang === 'ru' ? 'всё в порядке' : lang === 'en' ? 'all good' : 'totul în regulă')}
                                </div>
                            </div>
                            <div style={{
                                width: 42, height: 42, borderRadius: '12px',
                                background: activeStops > 0
                                    ? `linear-gradient(135deg, rgba(255,69,58,0.15), rgba(255,149,0,0.15))`
                                    : `linear-gradient(135deg, rgba(52,199,89,0.15), rgba(48,209,88,0.08))`,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={activeStops > 0 ? '#FF453A' : '#34C759'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    {activeStops > 0
                                        ? <><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></>
                                        : <><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></>
                                    }
                                </svg>
                            </div>
                        </div>
                    </div>
                </Link>

                {/* Card 4: Alerte */}
                <Link to="/alerts" style={{ textDecoration: 'none' }}>
                    <div className="dash-card" style={{ ...glass, padding: '22px 24px', animation: 'fadeUp 0.3s ease 0.2s both', cursor: 'pointer', transition: 'transform 0.2s ease, box-shadow 0.2s ease' }}
                        onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.12)' }}
                        onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div>
                                <div style={{ fontSize: '12px', fontWeight: '500', color: colors.textSecondary, marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{lang === 'ru' ? 'Уведомления' : lang === 'en' ? 'Alerts' : 'Alerte'}</div>
                                <div style={{ fontSize: '34px', fontWeight: '700', color: criticalAlerts > 0 ? colors.red : colors.text, lineHeight: 1, letterSpacing: '-1px' }}>
                                    <AnimCounter value={alerts.length} />
                                </div>
                                <div style={{ fontSize: '12px', color: unreadAlerts > 0 ? '#FF9500' : colors.textSecondary, marginTop: '6px', fontWeight: unreadAlerts > 0 ? '600' : '400' }}>
                                    {unreadAlerts > 0 ? `${unreadAlerts} ${lang === 'ru' ? 'непрочитанных' : lang === 'en' ? 'unread' : 'necitite'}` : (lang === 'ru' ? 'все прочитаны' : lang === 'en' ? 'all read' : 'toate citite')}
                                </div>
                            </div>
                            <div style={{
                                width: 42, height: 42, borderRadius: '12px',
                                background: `linear-gradient(135deg, ${isDark ? 'rgba(255,149,0,0.15)' : 'rgba(255,149,0,0.08)'}, ${isDark ? 'rgba(255,69,58,0.1)' : 'rgba(255,69,58,0.05)'})`,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FF9500" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
                                </svg>
                            </div>
                        </div>
                    </div>
                </Link>
            </div>

            {/* ═══ ROW 2: CHARTS ═══ */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>

                {/* Platform Donut Chart */}
                <div className="dash-card" style={{ ...glass, padding: '24px', animation: 'fadeUp 0.3s ease 0.25s both' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                        <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '650', color: colors.text, letterSpacing: '-0.2px' }}>
                            {lang === 'ru' ? 'Доступность платформ' : lang === 'en' ? 'Platform Availability' : 'Disponibilitate Platforme'}
                        </h3>
                        <span style={{ fontSize: '11px', color: colors.textSecondary, fontWeight: '500' }}>
                            Live
                            <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: '#34C759', marginLeft: '6px', verticalAlign: 'middle', animation: 'pulse 2s ease infinite' }} />
                        </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '32px' }}>
                        <div style={{ position: 'relative', flexShrink: 0 }}>
                            <DonutChart
                                size={150}
                                strokeWidth={16}
                                isDark={isDark}
                                segments={platformData.map(p => ({ value: p.available, color: p.color }))}
                            />
                            <div style={{
                                position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%) rotate(0deg)',
                                textAlign: 'center',
                            }}>
                                <div style={{ fontSize: '28px', fontWeight: '700', color: colors.text, lineHeight: 1, letterSpacing: '-1px' }}>
                                    {overallAvailability}%
                                </div>
                                <div style={{ fontSize: '10px', color: colors.textSecondary, marginTop: '2px' }}>total</div>
                            </div>
                        </div>
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {platformData.map(p => (
                                <div key={p.platform}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <PlatformLogo platform={p.platform} size={18} />
                                            <span style={{ fontSize: '13px', fontWeight: '600', color: colors.text, textTransform: 'capitalize' }}>{p.platform}</span>
                                        </div>
                                        <span style={{ fontSize: '13px', fontWeight: '700', color: p.color }}>{p.pct}%</span>
                                    </div>
                                    <div style={{
                                        height: '6px', borderRadius: '3px', overflow: 'hidden',
                                        background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
                                    }}>
                                        <div style={{
                                            height: '100%', borderRadius: '3px', width: `${p.pct}%`,
                                            background: p.color,
                                            transition: 'width 0.8s ease',
                                        }} />
                                    </div>
                                    <div style={{ fontSize: '11px', color: colors.textSecondary, marginTop: '3px' }}>
                                        {p.available}/{p.total} disponibile
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Hourly Stops Chart */}
                <div className="dash-card" style={{ ...glass, padding: '24px', animation: 'fadeUp 0.3s ease 0.3s both' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                        <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '650', color: colors.text, letterSpacing: '-0.2px' }}>
                            {lang === 'ru' ? 'Остановки по часам (24ч)' : lang === 'en' ? 'Stops per Hour (24h)' : 'Opriri per Oră (24h)'}
                        </h3>
                        <span style={{ fontSize: '11px', color: colors.textSecondary }}>
                            {stopEvents.length} {lang === 'ru' ? 'всего событий' : lang === 'en' ? 'total events' : 'total evenimente'}
                        </span>
                    </div>
                    <BarChart data={hourlyStops} isDark={isDark} height={140} />
                    <div style={{ display: 'flex', gap: '16px', marginTop: '12px', justifyContent: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: colors.textSecondary }}>
                            <div style={{ width: 8, height: 8, borderRadius: '2px', background: isDark ? '#2D2D30' : '#E5E7EB' }} /> 0 opriri
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: colors.textSecondary }}>
                            <div style={{ width: 8, height: 8, borderRadius: '2px', background: '#6366F1' }} /> 1-2 opriri
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: colors.textSecondary }}>
                            <div style={{ width: 8, height: 8, borderRadius: '2px', background: '#FF453A' }} /> 3+ opriri
                        </div>
                    </div>
                </div>
            </div>

            {/* ═══ ROW 3: CITY + ACTIVITY ═══ */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>

                {/* City Breakdown */}
                <div className="dash-card" style={{ ...glass, padding: '24px', animation: 'fadeUp 0.3s ease 0.35s both' }}>
                    <h3 style={{ margin: '0 0 16px 0', fontSize: '15px', fontWeight: '650', color: colors.text, letterSpacing: '-0.2px' }}>
                        {lang === 'ru' ? 'Рестораны по городам' : lang === 'en' ? 'Restaurants by City' : 'Restaurante pe Orașe'}
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {cityBreakdown.map((city, i) => {
                            const healthPct = city.total > 0 ? Math.round(((city.total - city.withIssues) / city.total) * 100) : 100
                            const barColor = healthPct >= 80 ? '#34C759' : healthPct >= 50 ? '#FF9500' : '#FF453A'
                            return (
                                <div key={city.name} style={{ animation: `fadeUp 0.2s ease ${0.05 * i}s both` }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <span style={{ fontSize: '13px', color: colors.text, fontWeight: '500' }}>{city.name}</span>
                                            <span style={{
                                                ...glassInner, padding: '2px 8px', borderRadius: '6px',
                                                fontSize: '11px', fontWeight: '600', color: colors.textSecondary,
                                            }}>
                                                {city.total}
                                            </span>
                                        </div>
                                        <span style={{ fontSize: '12px', fontWeight: '600', color: barColor }}>
                                            {healthPct}%
                                        </span>
                                    </div>
                                    <div style={{
                                        height: '4px', borderRadius: '2px', overflow: 'hidden',
                                        background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
                                    }}>
                                        <div style={{
                                            height: '100%', borderRadius: '2px', width: `${healthPct}%`,
                                            background: barColor, transition: 'width 0.6s ease',
                                        }} />
                                    </div>
                                </div>
                            )
                        })}
                        {cityBreakdown.length === 0 && (
                            <div style={{ textAlign: 'center', padding: '24px', color: colors.textSecondary, fontSize: '13px' }}>
                                Nicio dată disponibilă
                            </div>
                        )}
                    </div>
                </div>

                {/* Smart Comparison Charts */}
                <div className="dash-card" style={{ ...glass, padding: '24px', animation: 'fadeUp 0.3s ease 0.4s both' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                        <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '650', color: colors.text, letterSpacing: '-0.2px' }}>
                            {lang === 'ru' ? 'Сравнительный анализ' : lang === 'en' ? 'Comparative Analysis' : 'Analiză Comparativă'}
                        </h3>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px' }}>
                        {/* Chart 1: Availability by City */}
                        <div style={{ ...glassInner, padding: '18px' }}>
                            <div style={{ fontSize: '12px', fontWeight: '600', color: colors.text, marginBottom: '16px', letterSpacing: '-0.1px' }}>
                                {lang === 'ru' ? 'Доступность по городам' : lang === 'en' ? 'Availability by City' : 'Disponibilitate pe Oraș'}
                            </div>
                            {(() => {
                                // Group restaurants by city and calculate availability
                                const cityStats = {}
                                restaurants.forEach(rest => {
                                    const city = rest.city || 'Unknown'
                                    if (!cityStats[city]) {
                                        cityStats[city] = { total: 0, available: 0 }
                                    }
                                    cityStats[city].total++

                                    // Check if restaurant is available on any platform
                                    const restChecks = recentChecks.filter(c => c.restaurant_id === rest.id)
                                    const latestChecks = {}
                                    restChecks.forEach(c => {
                                        if (!latestChecks[c.platform] || new Date(c.checked_at) > new Date(latestChecks[c.platform].checked_at)) {
                                            latestChecks[c.platform] = c
                                        }
                                    })
                                    const isAvailable = Object.values(latestChecks).some(c => c.final_status === 'available')
                                    if (isAvailable) cityStats[city].available++
                                })

                                const cityData = Object.entries(cityStats)
                                    .map(([city, stats]) => ({
                                        city,
                                        pct: Math.round((stats.available / stats.total) * 100),
                                        available: stats.available,
                                        total: stats.total
                                    }))
                                    .sort((a, b) => b.pct - a.pct)
                                    .slice(0, 6)

                                return cityData.map((data, i) => (
                                    <div key={i} style={{ marginBottom: '12px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                            <span style={{ fontSize: '11px', color: colors.text, fontWeight: '500' }}>{data.city}</span>
                                            <span style={{ fontSize: '11px', color: data.pct >= 95 ? '#34C759' : data.pct >= 80 ? '#FF9500' : '#FF3B30', fontWeight: '600' }}>
                                                {data.pct}%
                                            </span>
                                        </div>
                                        <div style={{
                                            height: '6px',
                                            borderRadius: '3px',
                                            background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
                                            overflow: 'hidden'
                                        }}>
                                            <div style={{
                                                height: '100%',
                                                width: `${data.pct}%`,
                                                background: data.pct >= 95 ? 'linear-gradient(90deg, #34C759, #30D158)' :
                                                    data.pct >= 80 ? 'linear-gradient(90deg, #FF9500, #FFCC00)' :
                                                        'linear-gradient(90deg, #FF3B30, #FF6B6B)',
                                                borderRadius: '3px',
                                                transition: 'width 0.5s ease'
                                            }} />
                                        </div>
                                        <div style={{ fontSize: '10px', color: colors.textSecondary, marginTop: '2px' }}>
                                            {data.available}/{data.total} restaurante
                                        </div>
                                    </div>
                                ))
                            })()}
                        </div>

                        {/* Chart 2: Platform Performance Comparison */}
                        <div style={{ ...glassInner, padding: '18px' }}>
                            <div style={{ fontSize: '12px', fontWeight: '600', color: colors.text, marginBottom: '16px', letterSpacing: '-0.1px' }}>
                                {lang === 'ru' ? 'Производительность платформ' : lang === 'en' ? 'Platform Performance' : 'Performanță Platforme'}
                            </div>
                            {(() => {
                                const platformStats = platformData.map(p => ({
                                    platform: p.platform,
                                    availability: p.pct,
                                    color: p.color,
                                    available: p.available,
                                    total: p.total
                                })).sort((a, b) => b.availability - a.availability)

                                return (
                                    <div>
                                        {platformStats.map((p, i) => (
                                            <div key={i} style={{ marginBottom: '16px' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <div style={{
                                                            width: '10px',
                                                            height: '10px',
                                                            borderRadius: '2px',
                                                            background: p.color
                                                        }} />
                                                        <span style={{ fontSize: '12px', color: colors.text, fontWeight: '600', textTransform: 'capitalize' }}>
                                                            {p.platform}
                                                        </span>
                                                    </div>
                                                    <span style={{ fontSize: '13px', color: colors.text, fontWeight: '700' }}>
                                                        {p.availability}%
                                                    </span>
                                                </div>
                                                <div style={{
                                                    height: '8px',
                                                    borderRadius: '4px',
                                                    background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
                                                    overflow: 'hidden'
                                                }}>
                                                    <div style={{
                                                        height: '100%',
                                                        width: `${p.availability}%`,
                                                        background: p.color,
                                                        borderRadius: '4px',
                                                        transition: 'width 0.5s ease',
                                                        boxShadow: `0 0 8px ${p.color}40`
                                                    }} />
                                                </div>
                                                <div style={{ fontSize: '10px', color: colors.textSecondary, marginTop: '3px' }}>
                                                    {p.available}/{p.total} disponibile
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )
                            })()}
                        </div>

                        {/* Chart 3: City Distribution */}
                        <div style={{ ...glassInner, padding: '18px' }}>
                            <div style={{ fontSize: '12px', fontWeight: '600', color: colors.text, marginBottom: '16px', letterSpacing: '-0.1px' }}>
                                {lang === 'ru' ? 'Распределение ресторанов' : lang === 'en' ? 'Restaurant Distribution' : 'Distribuție Restaurante'}
                            </div>
                            {(() => {
                                const cityCount = {}
                                restaurants.forEach(r => {
                                    const city = r.city || 'Unknown'
                                    cityCount[city] = (cityCount[city] || 0) + 1
                                })

                                const cityData = Object.entries(cityCount)
                                    .map(([city, count]) => ({ city, count }))
                                    .sort((a, b) => b.count - a.count)

                                const total = restaurants.length
                                const colors_chart = ['#6366F1', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#3B82F6']

                                return (
                                    <div>
                                        {/* Donut Chart */}
                                        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
                                            <DonutChart
                                                segments={cityData.map((d, i) => ({
                                                    value: d.count,
                                                    color: colors_chart[i % colors_chart.length]
                                                }))}
                                                size={120}
                                                strokeWidth={16}
                                                isDark={isDark}
                                            />
                                        </div>
                                        {/* Legend */}
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                            {cityData.slice(0, 6).map((d, i) => (
                                                <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                        <div style={{
                                                            width: '8px',
                                                            height: '8px',
                                                            borderRadius: '2px',
                                                            background: colors_chart[i % colors_chart.length]
                                                        }} />
                                                        <span style={{ fontSize: '11px', color: colors.text }}>{d.city}</span>
                                                    </div>
                                                    <span style={{ fontSize: '11px', color: colors.textSecondary, fontWeight: '600' }}>
                                                        {d.count} ({Math.round((d.count / total) * 100)}%)
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )
                            })()}
                        </div>
                    </div>
                </div>
            </div>

            {/* ═══ ROW 4: QUICK NAV ═══ */}
            <div className="dash-card" style={{ ...glass, padding: '16px 24px', animation: 'fadeUp 0.3s ease 0.45s both' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '11px', fontWeight: '600', color: colors.textSecondary, marginRight: '8px', whiteSpace: 'nowrap', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        Navigare
                    </span>
                    {[
                        { to: '/monitoring', label: 'Live Monitor' },
                        { to: '/stop-control', label: 'Stop Control' },
                        { to: '/marketing', label: 'Marketing' },
                        { to: '/restaurants', label: lang === 'ru' ? 'Рестораны' : lang === 'en' ? 'Restaurants' : 'Restaurante' },
                        { to: '/reports', label: 'Rapoarte' },
                        { to: '/rules', label: 'Reguli' },
                        { to: '/alerts', label: 'Alerte' },
                        { to: '/discovery', label: 'Discovery' },
                    ].map(item => (
                        <Link key={item.to} to={item.to} className="dash-link" style={{
                            padding: '7px 16px', borderRadius: '8px',
                            background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                            border: `0.5px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}`,
                            color: colors.text,
                            textDecoration: 'none', fontSize: '12px', fontWeight: '500',
                            whiteSpace: 'nowrap',
                        }}>
                            {item.label}
                        </Link>
                    ))}
                </div>
            </div>
        </div>
    )
}
