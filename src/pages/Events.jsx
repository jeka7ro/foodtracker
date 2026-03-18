import { useState } from 'react'
import { useTheme } from '../lib/ThemeContext'
import { supabase } from '../lib/supabaseClient'
import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'

// Icons
function IconClock({ size = 16, color = 'currentColor' }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
        </svg>
    )
}

function IconCheck({ size = 16, color = 'currentColor' }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
        </svg>
    )
}

function IconX({ size = 16, color = 'currentColor' }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
        </svg>
    )
}

function IconAlert({ size = 16, color = 'currentColor' }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
    )
}

function IconStar({ size = 16, color = 'currentColor' }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
    )
}

function IconStop({ size = 16, color = 'currentColor' }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
        </svg>
    )
}

export default function Events() {
    const { colors, isDark } = useTheme()
    const [searchParams, setSearchParams] = useSearchParams()
    const [selectedType, setSelectedType] = useState(searchParams.get('type') || 'all')
    const [selectedRestaurant, setSelectedRestaurant] = useState('all')
    const [selectedPlatform, setSelectedPlatform] = useState('all')
    const [expandedEvent, setExpandedEvent] = useState(null)

    const glass = {
        background: isDark ? 'rgba(28,28,30,0.7)' : 'rgba(255,255,255,0.7)',
        backdropFilter: 'blur(20px) saturate(180%)',
        WebkitBackdropFilter: 'blur(20px) saturate(180%)',
        border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)'}`,
        borderRadius: '16px',
        boxShadow: isDark ? '0 4px 16px rgba(0,0,0,0.3)' : '0 2px 12px rgba(0,0,0,0.08)',
    }

    // Fetch all events
    const { data: checks = [] } = useQuery({
        queryKey: ['events-checks'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('monitoring_checks')
                .select('*, restaurants(name)')
                .order('checked_at', { ascending: false })
                .limit(500)
            if (error) throw error
            return data.map(c => ({ ...c, type: 'check', timestamp: c.checked_at }))
        },
        refetchInterval: 30000
    })

    const { data: stops = [] } = useQuery({
        queryKey: ['events-stops'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('stop_events')
                .select('*, restaurants(name)')
                .order('stopped_at', { ascending: false })
                .limit(200)
            if (error) throw error
            return data.map(s => ({ ...s, type: 'stop', timestamp: s.stopped_at }))
        },
        refetchInterval: 30000
    })

    const { data: alerts = [] } = useQuery({
        queryKey: ['events-alerts'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('alerts')
                .select('*, restaurants(name)')
                .order('created_at', { ascending: false })
                .limit(200)
            if (error) throw error
            return data.map(a => ({ ...a, type: 'alert', timestamp: a.created_at }))
        },
        refetchInterval: 30000
    })

    const { data: ratings = [] } = useQuery({
        queryKey: ['events-ratings'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('rating_history')
                .select('*, restaurants(name)')
                .order('recorded_at', { ascending: false })
                .limit(200)
            if (error) throw error
            return data.map(r => ({ ...r, type: 'rating', timestamp: r.recorded_at }))
        },
        refetchInterval: 30000
    })

    // Combine and filter events
    const allEvents = [...checks, ...stops, ...alerts, ...ratings]
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        .filter(e => {
            if (selectedType !== 'all' && e.type !== selectedType) return false
            if (selectedRestaurant !== 'all' && e.restaurant_id !== parseInt(selectedRestaurant)) return false
            if (selectedPlatform !== 'all' && e.platform !== selectedPlatform) return false
            return true
        })

    // Get unique restaurants and platforms
    const restaurants = [...new Set(allEvents.map(e => e.restaurants?.name).filter(Boolean))]
    const platforms = [...new Set(allEvents.map(e => e.platform).filter(Boolean))]

    // Event type config
    const eventConfig = {
        check: { label: 'Verificare', icon: IconClock, color: '#8E8E93' },
        stop: { label: 'Stop Event', icon: IconStop, color: '#FF3B30' },
        alert: { label: 'Alertă', icon: IconAlert, color: '#FF9500' },
        rating: { label: 'Rating', icon: IconStar, color: '#6366F1' }
    }

    const getEventStatus = (event) => {
        if (event.type === 'check') return event.final_status === 'available' ? 'success' : 'error'
        if (event.type === 'stop') return event.resumed_at ? 'resolved' : 'active'
        if (event.type === 'alert') return event.severity
        if (event.type === 'rating') return 'info'
        return 'info'
    }

    const getStatusColor = (status) => {
        const colors = {
            success: '#34C759',
            error: '#FF3B30',
            warning: '#FF9500',
            info: '#6366F1',
            active: '#FF3B30',
            resolved: '#34C759'
        }
        return colors[status] || '#8E8E93'
    }

    return (
        <div style={{ padding: '32px', maxWidth: '1400px', margin: '0 auto' }}>
            {/* Header */}
            <div style={{ marginBottom: '32px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                    <div style={{
                        width: 36, height: 36, borderRadius: '10px',
                        background: 'linear-gradient(135deg, #6366F1, #8B5CF6)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                        <IconClock size={18} color="white" />
                    </div>
                    <h1 style={{ fontSize: '26px', fontWeight: '700', margin: 0, color: colors.text, letterSpacing: '-0.5px' }}>
                        Events History
                    </h1>
                </div>
                <p style={{ fontSize: '13px', color: colors.textSecondary, margin: '2px 0 0 48px' }}>
                    Istoric complet al tuturor evenimentelor din sistem
                </p>
            </div>

            {/* Filters */}
            <div style={{ ...glass, padding: '20px 24px', marginBottom: '24px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                    {/* Event Type Filter */}
                    <div>
                        <label style={{ fontSize: '12px', fontWeight: '500', color: colors.textSecondary, marginBottom: '8px', display: 'block' }}>
                            Tip Eveniment
                        </label>
                        <select
                            value={selectedType}
                            onChange={(e) => setSelectedType(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '10px 12px',
                                borderRadius: '8px',
                                border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
                                background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)',
                                color: colors.text,
                                fontSize: '13px',
                                cursor: 'pointer'
                            }}
                        >
                            <option value="all">Toate</option>
                            <option value="check">Verificări</option>
                            <option value="stop">Stop Events</option>
                            <option value="alert">Alerte</option>
                            <option value="rating">Rating Changes</option>
                        </select>
                    </div>

                    {/* Restaurant Filter */}
                    <div>
                        <label style={{ fontSize: '12px', fontWeight: '500', color: colors.textSecondary, marginBottom: '8px', display: 'block' }}>
                            Restaurant
                        </label>
                        <select
                            value={selectedRestaurant}
                            onChange={(e) => setSelectedRestaurant(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '10px 12px',
                                borderRadius: '8px',
                                border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
                                background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)',
                                color: colors.text,
                                fontSize: '13px',
                                cursor: 'pointer'
                            }}
                        >
                            <option value="all">Toate</option>
                            {restaurants.map(r => (
                                <option key={r} value={r}>{r}</option>
                            ))}
                        </select>
                    </div>

                    {/* Platform Filter */}
                    <div>
                        <label style={{ fontSize: '12px', fontWeight: '500', color: colors.textSecondary, marginBottom: '8px', display: 'block' }}>
                            Platformă
                        </label>
                        <select
                            value={selectedPlatform}
                            onChange={(e) => setSelectedPlatform(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '10px 12px',
                                borderRadius: '8px',
                                border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
                                background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)',
                                color: colors.text,
                                fontSize: '13px',
                                cursor: 'pointer'
                            }}
                        >
                            <option value="all">Toate</option>
                            {platforms.map(p => (
                                <option key={p} value={p}>{p.toUpperCase()}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div style={{ marginTop: '16px', fontSize: '12px', color: colors.textSecondary }}>
                    Afișare: <strong>{allEvents.length}</strong> evenimente
                </div>
            </div>

            {/* Events Timeline */}
            <div style={{ ...glass, padding: '24px' }}>
                <div style={{ fontSize: '14px', fontWeight: '600', color: colors.text, marginBottom: '20px' }}>
                    Timeline
                </div>

                {allEvents.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px', color: colors.textSecondary }}>
                        Nu există evenimente
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {allEvents.map((event, i) => {
                            const config = eventConfig[event.type]
                            const status = getEventStatus(event)
                            const statusColor = getStatusColor(status)
                            const Icon = config.icon
                            const isExpanded = expandedEvent === i

                            return (
                                <div
                                    key={i}
                                    onClick={() => setExpandedEvent(isExpanded ? null : i)}
                                    style={{
                                        padding: '16px 18px',
                                        borderRadius: '12px',
                                        background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                                        border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'}`,
                                        cursor: 'pointer',
                                        transition: 'all 0.2s ease',
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)'}
                                    onMouseLeave={(e) => e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)'}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        {/* Icon */}
                                        <div style={{
                                            width: 32, height: 32, borderRadius: '8px',
                                            background: `${config.color}15`,
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            flexShrink: 0
                                        }}>
                                            <Icon size={14} color={config.color} />
                                        </div>

                                        {/* Content */}
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                                <span style={{ fontSize: '13px', fontWeight: '600', color: colors.text }}>
                                                    {config.label}
                                                </span>
                                                <span style={{
                                                    fontSize: '10px',
                                                    fontWeight: '600',
                                                    padding: '2px 8px',
                                                    borderRadius: '4px',
                                                    background: `${statusColor}20`,
                                                    color: statusColor
                                                }}>
                                                    {status.toUpperCase()}
                                                </span>
                                                {event.platform && (
                                                    <span style={{ fontSize: '11px', color: colors.textSecondary }}>
                                                        {event.platform.toUpperCase()}
                                                    </span>
                                                )}
                                            </div>
                                            <div style={{ fontSize: '12px', color: colors.textSecondary }}>
                                                {event.restaurants?.name || 'Unknown'} • {new Date(event.timestamp).toLocaleString('ro-RO')}
                                            </div>
                                        </div>

                                        {/* Status indicator */}
                                        <div style={{
                                            width: 8, height: 8, borderRadius: '50%',
                                            background: statusColor,
                                            boxShadow: `0 0 8px ${statusColor}50`,
                                            flexShrink: 0
                                        }} />
                                    </div>

                                    {/* Expanded details */}
                                    {isExpanded && (
                                        <div style={{
                                            marginTop: '12px',
                                            paddingTop: '12px',
                                            borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'}`,
                                            fontSize: '12px',
                                            color: colors.textSecondary
                                        }}>
                                            <pre style={{ margin: 0, fontFamily: 'monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                                                {JSON.stringify(event, null, 2)}
                                            </pre>
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>
        </div>
    )
}
