import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useTheme } from '../lib/ThemeContext'
import toast, { Toaster } from 'react-hot-toast'
import { TableSkeleton, CardSkeleton } from '../components/LoadingSkeleton'
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend } from 'recharts'

export default function Reports() {
    const { colors, isDark } = useTheme()
    const [activeTab, setActiveTab] = useState('stops')
    const [loading, setLoading] = useState(true)

    // Filters
    const [filterPlatform, setFilterPlatform] = useState('all')
    const [filterDays, setFilterDays] = useState(30)
    const [filterRestaurant, setFilterRestaurant] = useState('all')

    // Data
    const [restaurants, setRestaurants] = useState([])
    const [stopEvents, setStopEvents] = useState([])
    const [radiusHistory, setRadiusHistory] = useState([])
    const [ratingHistory, setRatingHistory] = useState([])
    const [productStops, setProductStops] = useState([])

    // Sort
    const [sortBy, setSortBy] = useState('date')
    const [sortDir, setSortDir] = useState('desc')

    useEffect(() => {
        fetchData()
    }, [filterDays])

    useEffect(() => {
        supabase.from('restaurants').select('id, name, city').then(({ data }) => {
            setRestaurants(data || [])
        })
    }, [])

    const dateFrom = useMemo(() => {
        const d = new Date()
        d.setDate(d.getDate() - filterDays)
        return d.toISOString()
    }, [filterDays])

    const fetchData = async () => {
        try {
            setLoading(true)
            const [stopsRes, radiusRes, ratingRes, productRes] = await Promise.all([
                supabase.from('stop_events').select('*, restaurants:restaurant_id (name, city)')
                    .gte('stopped_at', dateFrom).order('stopped_at', { ascending: false }).limit(500),
                supabase.from('radius_history').select('*, restaurants:restaurant_id (name, city)')
                    .gte('recorded_at', dateFrom).order('recorded_at', { ascending: false }).limit(500),
                supabase.from('rating_history').select('*, restaurants:restaurant_id (name, city)')
                    .gte('recorded_at', dateFrom).order('recorded_at', { ascending: false }).limit(500),
                supabase.from('product_stops').select('*, restaurants:restaurant_id (name, city)')
                    .gte('stopped_at', dateFrom).order('stopped_at', { ascending: false }).limit(500)
            ])
            setStopEvents(stopsRes.data || [])
            setRadiusHistory(radiusRes.data || [])
            setRatingHistory(ratingRes.data || [])
            setProductStops(productRes.data || [])
        } catch (err) {
            console.error('Error fetching reports:', err)
            toast.error('Error loading reports', { position: 'top-right' })
        } finally {
            setLoading(false)
        }
    }

    // Filter helpers
    const applyFilters = (items, platformKey = 'platform', restaurantKey = 'restaurant_id') => {
        return items.filter(item => {
            if (filterPlatform !== 'all' && item[platformKey] !== filterPlatform) return false
            if (filterRestaurant !== 'all' && item[restaurantKey] !== filterRestaurant) return false
            return true
        })
    }

    // STOP stats
    const filteredStops = useMemo(() => applyFilters(stopEvents), [stopEvents, filterPlatform, filterRestaurant])
    const stopStats = useMemo(() => {
        const totalMinutes = filteredStops.reduce((s, e) => s + (e.duration_minutes || 0), 0)
        const totalLoss = filteredStops.reduce((s, e) => s + (parseFloat(e.estimated_loss_amount) || 0), 0)
        return {
            total: filteredStops.length,
            totalMinutes,
            totalLoss,
            avgDuration: filteredStops.length > 0 ? Math.round(totalMinutes / filteredStops.length) : 0,
            unauthorized: filteredStops.filter(e => !e.is_authorized).length,
            byPlatform: ['glovo', 'wolt', 'bolt'].reduce((acc, p) => {
                acc[p] = filteredStops.filter(e => e.platform === p).length
                return acc
            }, {})
        }
    }, [filteredStops])

    // Marketing stats
    const filteredRadius = useMemo(() => applyFilters(radiusHistory), [radiusHistory, filterPlatform, filterRestaurant])
    const filteredRating = useMemo(() => applyFilters(ratingHistory), [ratingHistory, filterPlatform, filterRestaurant])
    const filteredProducts = useMemo(() => applyFilters(productStops), [productStops, filterPlatform, filterRestaurant])

    const marketingStats = useMemo(() => {
        const decreases = filteredRadius.filter(r => r.change_type === 'decrease')
        const drops = filteredRating.filter(r => r.change_direction === 'down')
        const avgRating = filteredRating.length > 0
            ? (filteredRating.reduce((s, r) => s + parseFloat(r.rating || 0), 0) / filteredRating.length).toFixed(2)
            : null
        return {
            radiusRecords: filteredRadius.length,
            radiusDecreases: decreases.length,
            ratingRecords: filteredRating.length,
            ratingDrops: drops.length,
            avgRating,
            productStops: filteredProducts.length,
            productsUnauthorized: filteredProducts.filter(p => !p.is_authorized).length
        }
    }, [filteredRadius, filteredRating, filteredProducts])

    // Sort stop events
    const sortedStops = useMemo(() => {
        return [...filteredStops].sort((a, b) => {
            let cmp = 0
            if (sortBy === 'date') cmp = new Date(b.stopped_at).getTime() - new Date(a.stopped_at).getTime()
            else if (sortBy === 'duration') cmp = (b.duration_minutes || 0) - (a.duration_minutes || 0)
            else if (sortBy === 'loss') cmp = (parseFloat(b.estimated_loss_amount) || 0) - (parseFloat(a.estimated_loss_amount) || 0)
            return sortDir === 'desc' ? cmp : -cmp
        })
    }, [filteredStops, sortBy, sortDir])

    // Comparison data
    const comparisonData = useMemo(() => {
        const map = {}
        stopEvents.forEach(e => {
            const rid = e.restaurant_id
            if (!map[rid]) map[rid] = {
                name: e.restaurants?.name || 'Unknown',
                city: e.restaurants?.city || '',
                totalStops: 0, totalMinutes: 0, totalLoss: 0,
                glovo: 0, wolt: 0, bolt: 0
            }
            map[rid].totalStops++
            map[rid].totalMinutes += e.duration_minutes || 0
            map[rid].totalLoss += parseFloat(e.estimated_loss_amount) || 0
            if (e.platform) map[rid][e.platform]++
        })
        return Object.entries(map)
            .map(([id, data]) => ({ id, ...data }))
            .sort((a, b) => b.totalLoss - a.totalLoss)
    }, [stopEvents])

    // Charts Data
    const stopsTimelineData = useMemo(() => {
        const grouped = {}
        filteredStops.forEach(e => {
            const date = new Date(e.stopped_at).toLocaleDateString('ro-RO', { month: 'short', day: 'numeric' })
            if (!grouped[date]) grouped[date] = { date, loss: 0, duration: 0 }
            grouped[date].loss += parseFloat(e.estimated_loss_amount || 0)
            grouped[date].duration += e.duration_minutes || 0
        })
        return Object.values(grouped).reverse()
    }, [filteredStops])

    const platformLossData = useMemo(() => {
        const pieData = [
            { name: 'Glovo', value: 0, color: '#f59e0b' },
            { name: 'Wolt', value: 0, color: '#0ea5e9' },
            { name: 'Bolt', value: 0, color: '#10b981' }
        ]
        filteredStops.forEach(e => {
            const loss = parseFloat(e.estimated_loss_amount || 0)
            const p = pieData.find(x => x.name.toLowerCase() === e.platform?.toLowerCase())
            if (p) p.value += loss
        })
        return pieData.filter(x => x.value > 0)
    }, [filteredStops])

    const topRestaurantsLossData = useMemo(() => {
        return comparisonData.map(c => ({
            name: c.name,
            Stops: c.totalStops,
            Loss: c.totalLoss
        })).slice(0, 10)
    }, [comparisonData])

    const productsByPlatformData = useMemo(() => {
        const grouped = { glovo: 0, wolt: 0, bolt: 0 }
        filteredProducts.forEach(p => {
            if (p.platform) grouped[p.platform] = (grouped[p.platform] || 0) + 1
        })
        return [
            { name: 'Glovo', ProduseOprite: grouped.glovo, fill: '#f59e0b' },
            { name: 'Wolt', ProduseOprite: grouped.wolt, fill: '#0ea5e9' },
            { name: 'Bolt', ProduseOprite: grouped.bolt, fill: '#10b981' }
        ]
    }, [filteredProducts])

    const marketingRatingTimeline = useMemo(() => {
        const grouped = {}
        filteredRating.forEach(r => {
            const date = new Date(r.recorded_at).toLocaleDateString('ro-RO', { month: 'short', day: 'numeric' })
            if (!grouped[date]) grouped[date] = { date, count: 0, avg: 0, total: 0 }
            grouped[date].total += parseFloat(r.rating || 0)
            grouped[date].count += 1
            grouped[date].avg = Number((grouped[date].total / grouped[date].count).toFixed(2))
        })
        return Object.values(grouped).reverse()
    }, [filteredRating])

    const marketingRadiusPie = useMemo(() => {
        const changes = { increase: 0, decrease: 0, neutral: 0 }
        filteredRadius.forEach(r => {
            if (r.change_type === 'increase') changes.increase++
            else if (r.change_type === 'decrease') changes.decrease++
            else changes.neutral++
        })
        return [
            { name: 'Creșteri', value: changes.increase, color: '#10b981' },
            { name: 'Scăderi', value: changes.decrease, color: '#ef4444' },
            { name: 'Neschimbat', value: changes.neutral, color: '#64748b' }
        ].filter(x => x.value > 0)
    }, [filteredRadius])

    // Export CSV
    function exportCSV() {
        let headers, rows, filename

        if (activeTab === 'stops') {
            if (sortedStops.length === 0) { toast.error('No data to export'); return }
            headers = ['Restaurant', 'City', 'Platform', 'Type', 'Stopped At', 'Resumed At', 'Duration (min)', 'Loss (RON)', 'Authorized']
            rows = sortedStops.map(e => [
                e.restaurants?.name, e.restaurants?.city, e.platform, e.stop_type || 'full',
                e.stopped_at ? new Date(e.stopped_at).toLocaleString('ro-RO') : '',
                e.resumed_at ? new Date(e.resumed_at).toLocaleString('ro-RO') : 'Ongoing',
                e.duration_minutes || '', parseFloat(e.estimated_loss_amount || 0).toFixed(2),
                e.is_authorized ? 'Yes' : 'No'
            ])
            filename = 'stop_events_report'
        } else if (activeTab === 'marketing') {
            headers = ['Restaurant', 'Platform', 'Type', 'Value', 'Previous', 'Change', 'Date']
            const radiusRows = filteredRadius.map(r => [
                r.restaurants?.name, r.platform, 'Radius', r.radius_km, r.previous_radius_km || '-',
                r.change_type, new Date(r.recorded_at).toLocaleString('ro-RO')
            ])
            const ratingRows = filteredRating.map(r => [
                r.restaurants?.name, r.platform, 'Rating', r.rating, r.previous_rating || '-',
                r.change_direction || '-', new Date(r.recorded_at).toLocaleString('ro-RO')
            ])
            rows = [...radiusRows, ...ratingRows]
            filename = 'marketing_report'
        } else {
            if (comparisonData.length === 0) { toast.error('No data to export'); return }
            headers = ['Restaurant', 'City', 'Total Stops', 'Duration (min)', 'Loss (RON)', 'Glovo', 'Wolt', 'Bolt']
            rows = comparisonData.map(c => [c.name, c.city, c.totalStops, c.totalMinutes, c.totalLoss.toFixed(2), c.glovo, c.wolt, c.bolt])
            filename = 'comparison_report'
        }

        const csv = [headers.join(','), ...rows.map(r => r.map(v => `"${v}"`).join(','))].join('\n')
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = `${filename}_${new Date().toISOString().split('T')[0]}.csv`
        link.click()
        URL.revokeObjectURL(url)
        toast.success(`Exported ${rows.length} records`, { duration: 3000, position: 'top-right' })
    }

    const handleSort = (field) => {
        if (sortBy === field) setSortDir(d => d === 'desc' ? 'asc' : 'desc')
        else { setSortBy(field); setSortDir('desc') }
    }

    const sortArrow = (field) => sortBy === field ? (sortDir === 'desc' ? ' \u2193' : ' \u2191') : ''

    // Shared styles
    const tabStyle = (isActive) => ({
        padding: '9px 20px', fontSize: '13px', fontWeight: '600', cursor: 'pointer',
        background: isActive ? colors.blue : 'transparent',
        color: isActive ? 'white' : colors.textSecondary,
        border: isActive ? 'none' : `0.5px solid ${colors.border}`,
        borderRadius: '8px', transition: 'all 0.15s ease'
    })

    const cardStyle = (borderColor) => ({
        background: colors.card, border: `0.5px solid ${colors.border}`,
        borderRadius: '12px', padding: '20px', position: /** @type {const} */ ('relative'), overflow: 'hidden',
        borderTop: `3px solid ${borderColor || colors.border}`
    })

    const thStyle = {
        padding: '12px 16px', textAlign: /** @type {const} */ ('left'), fontSize: '11px', fontWeight: '600',
        color: colors.textSecondary, textTransform: /** @type {const} */ ('uppercase'), letterSpacing: '0.6px',
        cursor: 'pointer', userSelect: /** @type {const} */ ('none')
    }

    const tdStyle = { padding: '12px 16px', fontSize: '13px', color: colors.text }
    const labelStyle = { fontSize: '12px', color: colors.textSecondary }
    const bigNumStyle = (color) => ({ fontSize: '28px', fontWeight: '700', color: color || colors.text, lineHeight: '1.2' })
    const subtitleStyle = { fontSize: '11px', color: colors.textSecondary, marginTop: '4px' }

    const platformBadge = (platform) => {
        const pColors = { glovo: '#FFC244', wolt: '#009DE0', bolt: '#34D186' }
        return (
            <span style={{
                padding: '3px 10px', fontSize: '11px', fontWeight: '600',
                borderRadius: '6px', textTransform: 'uppercase',
                background: `${pColors[platform] || colors.textSecondary}25`,
                color: pColors[platform] || colors.textSecondary,
                border: `0.5px solid ${pColors[platform] || colors.textSecondary}50`
            }}>
                {platform}
            </span>
        )
    }

    if (loading) {
        return (
            <div style={{ padding: '24px 32px' }}>
                <h1 style={{ fontSize: '28px', fontWeight: '700', margin: 0, color: colors.text, marginBottom: '24px' }}>
                    Reports & Analytics
                </h1>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
                    {[1, 2, 3, 4].map(i => <CardSkeleton key={i} />)}
                </div>
                <TableSkeleton rows={5} columns={5} />
            </div>
        )
    }

    return (
        <div style={{ padding: '24px 32px', fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                    <h1 style={{ fontSize: '28px', fontWeight: '700', margin: 0, color: colors.text, letterSpacing: '-0.5px' }}>
                        Reports & Analytics
                    </h1>
                    <p style={{ fontSize: '13px', color: colors.textSecondary, marginTop: '4px' }}>
                        Comprehensive analysis of stops, losses, and marketing metrics
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={() => fetchData()} style={{
                        padding: '8px 16px', background: colors.card, color: colors.text,
                        border: `0.5px solid ${colors.border}`, borderRadius: '8px',
                        fontSize: '13px', fontWeight: '500', cursor: 'pointer'
                    }}>
                        Refresh
                    </button>
                    <button onClick={exportCSV} style={{
                        padding: '8px 16px', background: colors.green, color: 'white',
                        border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer'
                    }}>
                        Export CSV
                    </button>
                </div>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: '6px', marginBottom: '20px' }}>
                {[
                    { id: 'stops', label: 'Stop Control' },
                    { id: 'marketing', label: 'Marketing' },
                    { id: 'comparison', label: 'Comparison' }
                ].map(tab => (
                    <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={tabStyle(activeTab === tab.id)}>
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Filters */}
            <div style={{
                display: 'flex', gap: '16px', marginBottom: '20px', flexWrap: 'wrap', alignItems: 'center',
                padding: '12px 16px', background: colors.card, border: `0.5px solid ${colors.border}`,
                borderRadius: '10px'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={labelStyle}>Period:</span>
                    {[7, 14, 30, 90].map(days => (
                        <button key={days} onClick={() => setFilterDays(days)} style={{
                            padding: '5px 12px',
                            background: filterDays === days ? colors.blue : 'transparent',
                            color: filterDays === days ? 'white' : colors.text,
                            border: `0.5px solid ${filterDays === days ? colors.blue : colors.border}`,
                            borderRadius: '6px', fontSize: '12px', fontWeight: '500', cursor: 'pointer'
                        }}>
                            {days}d
                        </button>
                    ))}
                </div>

                <div style={{ width: '1px', height: '20px', background: colors.border }} />

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={labelStyle}>Platform:</span>
                    {['all', 'glovo', 'wolt', 'bolt'].map(p => (
                        <button key={p} onClick={() => setFilterPlatform(p)} style={{
                            padding: '5px 12px',
                            background: filterPlatform === p ? colors.blue : 'transparent',
                            color: filterPlatform === p ? 'white' : colors.text,
                            border: `0.5px solid ${filterPlatform === p ? colors.blue : colors.border}`,
                            borderRadius: '6px', fontSize: '12px', fontWeight: '500', cursor: 'pointer',
                            textTransform: 'capitalize'
                        }}>
                            {p === 'all' ? 'All' : p}
                        </button>
                    ))}
                </div>

                <div style={{ width: '1px', height: '20px', background: colors.border }} />

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={labelStyle}>Restaurant:</span>
                    <select
                        value={filterRestaurant}
                        onChange={e => setFilterRestaurant(e.target.value)}
                        style={{
                            padding: '5px 10px', background: colors.card, color: colors.text,
                            border: `0.5px solid ${colors.border}`, borderRadius: '6px',
                            fontSize: '12px', cursor: 'pointer', minWidth: '140px'
                        }}
                    >
                        <option value="all">All Restaurants</option>
                        {restaurants.map(r => (
                            <option key={r.id} value={r.id}>{r.name} ({r.city})</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Tab Content */}
            {activeTab === 'stops' && (
                <>
                    {/* STOP Stats */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px', marginBottom: '20px' }}>
                        <div style={cardStyle(colors.red)}>
                            <div style={labelStyle}>Total Stop Events</div>
                            <div style={bigNumStyle(colors.text)}>{stopStats.total}</div>
                            <div style={subtitleStyle}>{stopStats.unauthorized} unauthorized</div>
                        </div>
                        <div style={cardStyle(colors.orange)}>
                            <div style={labelStyle}>Total Downtime</div>
                            <div style={bigNumStyle(colors.orange)}>
                                {stopStats.totalMinutes >= 60
                                    ? `${(stopStats.totalMinutes / 60).toFixed(1)}h`
                                    : `${stopStats.totalMinutes}m`}
                            </div>
                            <div style={subtitleStyle}>avg {stopStats.avgDuration} min/event</div>
                        </div>
                        <div style={cardStyle('#EF4444')}>
                            <div style={labelStyle}>Estimated Loss</div>
                            <div style={bigNumStyle('#EF4444')}>
                                {stopStats.totalLoss.toFixed(0)} <span style={{ fontSize: '14px', fontWeight: '500' }}>RON</span>
                            </div>
                        </div>
                        <div style={cardStyle(colors.blue)}>
                            <div style={labelStyle}>By Platform</div>
                            <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                                {['glovo', 'wolt', 'bolt'].map(p => (
                                    <div key={p} style={{ textAlign: 'center' }}>
                                        <div style={{ fontSize: '18px', fontWeight: '700', color: colors.text }}>{stopStats.byPlatform[p]}</div>
                                        <div style={{ fontSize: '10px', color: colors.textSecondary, textTransform: 'uppercase' }}>{p}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* CHARTS ROW 1 */}
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px', marginBottom: '24px' }}>
                        {/* Timeline Chart */}
                        <div style={{ background: colors.card, border: `0.5px solid ${colors.border}`, borderRadius: '12px', padding: '20px' }}>
                            <h3 style={{ fontSize: '15px', fontWeight: '600', margin: '0 0 16px', color: colors.text }}>Evoluție Pierderi & Downtime</h3>
                            {stopsTimelineData.length > 0 ? (
                            <div style={{ width: '100%', height: 280 }}>
                                <ResponsiveContainer>
                                    <LineChart data={stopsTimelineData}>
                                        <CartesianGrid strokeDasharray="3 3" stroke={colors.border} vertical={false} />
                                        <XAxis dataKey="date" stroke={colors.textSecondary} fontSize={12} tickLine={false} axisLine={false} />
                                        <YAxis yAxisId="left" stroke={colors.textSecondary} fontSize={12} tickLine={false} axisLine={false} tickFormatter={v => `${v}RON`} />
                                        <YAxis yAxisId="right" orientation="right" stroke={colors.textSecondary} fontSize={12} tickLine={false} axisLine={false} tickFormatter={v => `${v}m`} />
                                        <RechartsTooltip cursor={{ fill: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }} contentStyle={{ background: colors.card, border: `1px solid ${colors.border}`, borderRadius: '8px', color: colors.text }} />
                                        <Legend wrapperStyle={{ fontSize: '12px' }} />
                                        <Line yAxisId="left" type="monotone" name="Pierderi (RON)" dataKey="loss" stroke="#ef4444" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                                        <Line yAxisId="right" type="monotone" name="Downtime (min)" dataKey="duration" stroke="#f59e0b" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                            ) : <div style={{ height: 280, display: 'flex', alignItems: 'center', justifyContent: 'center', color: colors.textSecondary, fontSize: 13 }}>Nu sunt date pentru istoric pierderi.</div>}
                        </div>

                        {/* Pie Chart */}
                        <div style={{ background: colors.card, border: `0.5px solid ${colors.border}`, borderRadius: '12px', padding: '20px' }}>
                            <h3 style={{ fontSize: '15px', fontWeight: '600', margin: '0 0 16px', color: colors.text }}>Pierderi Per Platformă</h3>
                            {platformLossData.length > 0 ? (
                            <div style={{ width: '100%', height: 280, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                                <ResponsiveContainer width="100%" height="80%">
                                    <PieChart>
                                        <Pie data={platformLossData} innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                                            {platformLossData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.color} />
                                            ))}
                                        </Pie>
                                        <RechartsTooltip formatter={(value) => `${Number(value).toFixed(0)} RON`} contentStyle={{ background: colors.card, border: `1px solid ${colors.border}`, borderRadius: '8px', color: colors.text }} />
                                    </PieChart>
                                </ResponsiveContainer>
                                <div style={{ display: 'flex', gap: '16px', marginTop: '8px' }}>
                                    {platformLossData.map((p, i) => (
                                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: colors.textSecondary }}>
                                            <div style={{ width: 10, height: 10, borderRadius: '50%', background: p.color }} />
                                            <span>{p.name}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            ) : <div style={{ height: 280, display: 'flex', alignItems: 'center', justifyContent: 'center', color: colors.textSecondary, fontSize: 13 }}>Nu sunt pierderi estimate înregistrate.</div>}
                        </div>
                    </div>

                    {/* STOP Events Table */}
                    <div style={{ background: colors.card, border: `0.5px solid ${colors.border}`, borderRadius: '12px', overflow: 'hidden' }}>
                        <div style={{ padding: '16px 20px', borderBottom: `0.5px solid ${colors.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '14px', fontWeight: '600', color: colors.text }}>Stop Events</span>
                            <span style={{ fontSize: '12px', color: colors.textSecondary }}>{sortedStops.length} records</span>
                        </div>
                        {sortedStops.length === 0 ? (
                            <div style={{ padding: '40px', textAlign: 'center' }}>
                                <div style={{ fontSize: '16px', fontWeight: '600', color: colors.text, marginBottom: '8px' }}>
                                    No stop events recorded
                                </div>
                                <div style={{ fontSize: '13px', color: colors.textSecondary }}>
                                    All restaurants operating normally in the selected period
                                </div>
                            </div>
                        ) : (
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '800px' }}>
                                    <thead style={{ background: `${colors.bg}80`, borderBottom: `0.5px solid ${colors.border}` }}>
                                        <tr>
                                            <th style={thStyle}>Restaurant</th>
                                            <th style={thStyle}>Platform</th>
                                            <th style={thStyle}>Type</th>
                                            <th style={{ ...thStyle, cursor: 'pointer' }} onClick={() => handleSort('date')}>
                                                Stopped At{sortArrow('date')}
                                            </th>
                                            <th style={{ ...thStyle, cursor: 'pointer' }} onClick={() => handleSort('duration')}>
                                                Duration{sortArrow('duration')}
                                            </th>
                                            <th style={{ ...thStyle, cursor: 'pointer' }} onClick={() => handleSort('loss')}>
                                                Est. Loss{sortArrow('loss')}
                                            </th>
                                            <th style={thStyle}>Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {sortedStops.map((event, i) => (
                                            <tr key={event.id} style={{
                                                borderBottom: i < sortedStops.length - 1 ? `0.5px solid ${colors.border}` : 'none',
                                                transition: 'background 0.12s'
                                            }}
                                                onMouseOver={e => e.currentTarget.style.background = colors.hover}
                                                onMouseOut={e => e.currentTarget.style.background = 'transparent'}
                                            >
                                                <td style={tdStyle}>
                                                    <div style={{ fontWeight: '500' }}>{event.restaurants?.name}</div>
                                                    <div style={{ fontSize: '11px', color: colors.textSecondary }}>{event.restaurants?.city}</div>
                                                </td>
                                                <td style={tdStyle}>{platformBadge(event.platform)}</td>
                                                <td style={tdStyle}>
                                                    <span style={{
                                                        padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '500',
                                                        background: event.stop_type === 'partial' ? `${colors.orange}20` : `${colors.red}20`,
                                                        color: event.stop_type === 'partial' ? colors.orange : colors.red
                                                    }}>
                                                        {event.stop_type || 'full'}
                                                    </span>
                                                </td>
                                                <td style={{ ...tdStyle, color: colors.textSecondary }}>
                                                    {new Date(event.stopped_at).toLocaleString('ro-RO')}
                                                </td>
                                                <td style={{ ...tdStyle, fontWeight: '500' }}>
                                                    {event.duration_minutes ? `${event.duration_minutes} min` : 'Ongoing'}
                                                </td>
                                                <td style={{ ...tdStyle, fontWeight: '600', color: '#EF4444' }}>
                                                    {event.estimated_loss_amount ? `${parseFloat(event.estimated_loss_amount).toFixed(0)} RON` : '-'}
                                                </td>
                                                <td style={tdStyle}>
                                                    {event.resumed_at ? (
                                                        <span style={{ padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '500', background: `${colors.green}20`, color: colors.green }}>
                                                            Resolved
                                                        </span>
                                                    ) : (
                                                        <span style={{ padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '500', background: `${colors.red}20`, color: colors.red }}>
                                                            Active
                                                        </span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </>
            )}

            {activeTab === 'marketing' && (
                <>
                    {/* Marketing Stats */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px', marginBottom: '20px' }}>
                        <div style={cardStyle('#FBBF24')}>
                            <div style={labelStyle}>Avg Rating</div>
                            <div style={bigNumStyle(colors.text)}>{marketingStats.avgRating || '--'}</div>
                            <div style={subtitleStyle}>{marketingStats.ratingRecords} records</div>
                        </div>
                        <div style={cardStyle('#EF4444')}>
                            <div style={labelStyle}>Rating Drops</div>
                            <div style={bigNumStyle('#EF4444')}>{marketingStats.ratingDrops}</div>
                            <div style={subtitleStyle}>detected decreases</div>
                        </div>
                        <div style={cardStyle('#3B82F6')}>
                            <div style={labelStyle}>Radius Changes</div>
                            <div style={bigNumStyle('#3B82F6')}>{marketingStats.radiusDecreases}</div>
                            <div style={subtitleStyle}>decreases / {marketingStats.radiusRecords} total</div>
                        </div>
                        <div style={cardStyle(colors.orange)}>
                            <div style={labelStyle}>Product Stops</div>
                            <div style={bigNumStyle(colors.orange)}>{marketingStats.productStops}</div>
                            <div style={subtitleStyle}>{marketingStats.productsUnauthorized} unauthorized</div>
                        </div>
                    </div>

                    {/* MARKETING CHARTS ROW */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', marginBottom: '24px' }}>
                        {/* Rating Timeline */}
                        <div style={{ background: colors.card, border: `0.5px solid ${colors.border}`, borderRadius: '12px', padding: '20px' }}>
                            <h3 style={{ fontSize: '15px', fontWeight: '600', margin: '0 0 16px', color: colors.text }}>Evoluție Rating (Medie)</h3>
                            {marketingRatingTimeline.length > 0 ? (
                            <div style={{ width: '100%', height: 220 }}>
                                <ResponsiveContainer>
                                    <LineChart data={marketingRatingTimeline}>
                                        <CartesianGrid strokeDasharray="3 3" stroke={colors.border} vertical={false} />
                                        <XAxis dataKey="date" stroke={colors.textSecondary} fontSize={10} tickLine={false} axisLine={false} />
                                        <YAxis domain={['auto', 'auto']} stroke={colors.textSecondary} fontSize={10} tickLine={false} axisLine={false} />
                                        <RechartsTooltip cursor={{ fill: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }} contentStyle={{ background: colors.card, border: `1px solid ${colors.border}`, borderRadius: '8px', color: colors.text }} />
                                        <Line type="monotone" name="Avg Rating" dataKey="avg" stroke="#f59e0b" strokeWidth={3} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                            ) : <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: colors.textSecondary, fontSize: 13 }}>Nu sunt date despre rating.</div>}
                        </div>

                        {/* Radius Pie */}
                        <div style={{ background: colors.card, border: `0.5px solid ${colors.border}`, borderRadius: '12px', padding: '20px' }}>
                            <h3 style={{ fontSize: '15px', fontWeight: '600', margin: '0 0 16px', color: colors.text }}>Modificări Rază Livrare</h3>
                            {marketingRadiusPie.length > 0 ? (
                            <div style={{ width: '100%', height: 220, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                                <ResponsiveContainer width="100%" height="80%">
                                    <PieChart>
                                        <Pie data={marketingRadiusPie} innerRadius={50} outerRadius={70} paddingAngle={2} dataKey="value">
                                            {marketingRadiusPie.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.color} />
                                            ))}
                                        </Pie>
                                        <RechartsTooltip formatter={(value) => `${value} events`} contentStyle={{ background: colors.card, border: `1px solid ${colors.border}`, borderRadius: '8px', color: colors.text }} />
                                    </PieChart>
                                </ResponsiveContainer>
                                <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                                    {marketingRadiusPie.map((p, i) => (
                                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: colors.textSecondary }}>
                                            <div style={{ width: 8, height: 8, borderRadius: '50%', background: p.color }} />
                                            <span>{p.name} ({p.value})</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            ) : <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: colors.textSecondary, fontSize: 13 }}>Nu sunt modificări recente.</div>}
                        </div>

                        {/* Products Stop Bar */}
                        <div style={{ background: colors.card, border: `0.5px solid ${colors.border}`, borderRadius: '12px', padding: '20px' }}>
                            <h3 style={{ fontSize: '15px', fontWeight: '600', margin: '0 0 16px', color: colors.text }}>Produse Oprite / Platformă</h3>
                            {productsByPlatformData.some(p => p.ProduseOprite > 0) ? (
                            <div style={{ width: '100%', height: 220 }}>
                                <ResponsiveContainer>
                                    <BarChart data={productsByPlatformData}>
                                        <CartesianGrid strokeDasharray="3 3" stroke={colors.border} vertical={false} />
                                        <XAxis dataKey="name" stroke={colors.textSecondary} fontSize={11} tickLine={false} axisLine={false} />
                                        <YAxis stroke={colors.textSecondary} fontSize={11} tickLine={false} axisLine={false} />
                                        <RechartsTooltip cursor={{ fill: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }} contentStyle={{ background: colors.card, border: `1px solid ${colors.border}`, borderRadius: '8px', color: colors.text }} />
                                        <Bar dataKey="ProduseOprite" radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                            ) : <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: colors.textSecondary, fontSize: 13 }}>Nu sunt produse oprite.</div>}
                        </div>
                    </div>

                    {/* Rating History Table */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
                        <div style={{ background: colors.card, border: `0.5px solid ${colors.border}`, borderRadius: '12px', overflow: 'hidden' }}>
                            <div style={{ padding: '14px 20px', borderBottom: `0.5px solid ${colors.border}` }}>
                                <span style={{ fontSize: '14px', fontWeight: '600', color: colors.text }}>Rating History</span>
                            </div>
                            {filteredRating.length === 0 ? (
                                <div style={{ padding: '30px', textAlign: 'center', color: colors.textSecondary, fontSize: '13px' }}>No rating data in selected period</div>
                            ) : (
                                <div style={{ maxHeight: '400px', overflow: 'auto' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                        <thead style={{ background: `${colors.bg}80` }}>
                                            <tr>
                                                <th style={thStyle}>Restaurant</th>
                                                <th style={thStyle}>Platform</th>
                                                <th style={thStyle}>Rating</th>
                                                <th style={thStyle}>Change</th>
                                                <th style={thStyle}>Date</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredRating.slice(0, 50).map((r, i) => (
                                                <tr key={r.id} style={{ borderBottom: `0.5px solid ${colors.border}` }}>
                                                    <td style={tdStyle}>{r.restaurants?.name}</td>
                                                    <td style={tdStyle}>{platformBadge(r.platform)}</td>
                                                    <td style={{ ...tdStyle, fontWeight: '600' }}>{parseFloat(r.rating).toFixed(2)}</td>
                                                    <td style={tdStyle}>
                                                        {r.change_direction === 'down' ? (
                                                            <span style={{ color: '#EF4444', fontWeight: '500' }}>
                                                                {r.previous_rating ? `${(r.rating - r.previous_rating).toFixed(2)}` : '-'}
                                                            </span>
                                                        ) : r.change_direction === 'up' ? (
                                                            <span style={{ color: colors.green, fontWeight: '500' }}>
                                                                +{r.previous_rating ? (r.rating - r.previous_rating).toFixed(2) : '-'}
                                                            </span>
                                                        ) : (
                                                            <span style={{ color: colors.textSecondary }}>-</span>
                                                        )}
                                                    </td>
                                                    <td style={{ ...tdStyle, color: colors.textSecondary, fontSize: '12px' }}>
                                                        {new Date(r.recorded_at).toLocaleString('ro-RO')}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>

                        <div style={{ background: colors.card, border: `0.5px solid ${colors.border}`, borderRadius: '12px', overflow: 'hidden' }}>
                            <div style={{ padding: '14px 20px', borderBottom: `0.5px solid ${colors.border}` }}>
                                <span style={{ fontSize: '14px', fontWeight: '600', color: colors.text }}>Radius History</span>
                            </div>
                            {filteredRadius.length === 0 ? (
                                <div style={{ padding: '30px', textAlign: 'center', color: colors.textSecondary, fontSize: '13px' }}>No radius data in selected period</div>
                            ) : (
                                <div style={{ maxHeight: '400px', overflow: 'auto' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                        <thead style={{ background: `${colors.bg}80` }}>
                                            <tr>
                                                <th style={thStyle}>Restaurant</th>
                                                <th style={thStyle}>Platform</th>
                                                <th style={thStyle}>Radius</th>
                                                <th style={thStyle}>Change</th>
                                                <th style={thStyle}>Date</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredRadius.slice(0, 50).map((r, i) => (
                                                <tr key={r.id} style={{ borderBottom: `0.5px solid ${colors.border}` }}>
                                                    <td style={tdStyle}>{r.restaurants?.name}</td>
                                                    <td style={tdStyle}>{platformBadge(r.platform)}</td>
                                                    <td style={{ ...tdStyle, fontWeight: '600' }}>{r.radius_km} km</td>
                                                    <td style={tdStyle}>
                                                        {r.change_type === 'decrease' ? (
                                                            <span style={{ color: '#EF4444', fontWeight: '500' }}>Decrease</span>
                                                        ) : r.change_type === 'increase' ? (
                                                            <span style={{ color: colors.green, fontWeight: '500' }}>Increase</span>
                                                        ) : (
                                                            <span style={{ color: colors.textSecondary }}>-</span>
                                                        )}
                                                    </td>
                                                    <td style={{ ...tdStyle, color: colors.textSecondary, fontSize: '12px' }}>
                                                        {new Date(r.recorded_at).toLocaleString('ro-RO')}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Product Stops Table */}
                    <div style={{ background: colors.card, border: `0.5px solid ${colors.border}`, borderRadius: '12px', overflow: 'hidden' }}>
                        <div style={{ padding: '14px 20px', borderBottom: `0.5px solid ${colors.border}` }}>
                            <span style={{ fontSize: '14px', fontWeight: '600', color: colors.text }}>Product Stops</span>
                            <span style={{ fontSize: '12px', color: colors.textSecondary, marginLeft: '10px' }}>{filteredProducts.length} records</span>
                        </div>
                        {filteredProducts.length === 0 ? (
                            <div style={{ padding: '30px', textAlign: 'center', color: colors.textSecondary, fontSize: '13px' }}>No product stop data in selected period</div>
                        ) : (
                            <div style={{ maxHeight: '400px', overflow: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                    <thead style={{ background: `${colors.bg}80` }}>
                                        <tr>
                                            <th style={thStyle}>Restaurant</th>
                                            <th style={thStyle}>Platform</th>
                                            <th style={thStyle}>Product</th>
                                            <th style={thStyle}>Category</th>
                                            <th style={thStyle}>Stopped At</th>
                                            <th style={thStyle}>Duration</th>
                                            <th style={thStyle}>Authorized</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredProducts.slice(0, 50).map(p => (
                                            <tr key={p.id} style={{ borderBottom: `0.5px solid ${colors.border}` }}>
                                                <td style={tdStyle}>{p.restaurants?.name}</td>
                                                <td style={tdStyle}>{platformBadge(p.platform)}</td>
                                                <td style={{ ...tdStyle, fontWeight: '500' }}>{p.product_name}</td>
                                                <td style={{ ...tdStyle, color: colors.textSecondary }}>{p.category || '-'}</td>
                                                <td style={{ ...tdStyle, color: colors.textSecondary, fontSize: '12px' }}>
                                                    {new Date(p.stopped_at).toLocaleString('ro-RO')}
                                                </td>
                                                <td style={tdStyle}>{p.duration_minutes ? `${p.duration_minutes} min` : 'Active'}</td>
                                                <td style={tdStyle}>
                                                    {p.is_authorized ? (
                                                        <span style={{ color: colors.green, fontWeight: '500' }}>Yes</span>
                                                    ) : (
                                                        <span style={{ color: '#EF4444', fontWeight: '500' }}>No</span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </>
            )}

            {activeTab === 'comparison' && (
                <>
                    {/* COMPARISON CHART */}
                    <div style={{ background: colors.card, border: `0.5px solid ${colors.border}`, borderRadius: '12px', padding: '20px', marginBottom: '24px' }}>
                        <h3 style={{ fontSize: '15px', fontWeight: '600', margin: '0 0 16px', color: colors.text }}>Top Restaurante cu cele mai mari pierderi (RON)</h3>
                        {topRestaurantsLossData.length > 0 ? (
                        <div style={{ width: '100%', height: 320 }}>
                            <ResponsiveContainer>
                                <BarChart data={topRestaurantsLossData} layout="vertical" margin={{ left: 50 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke={colors.border} horizontal={false} />
                                    <XAxis type="number" stroke={colors.textSecondary} fontSize={11} tickLine={false} axisLine={false} tickFormatter={v => `${v}RON`} />
                                    <YAxis type="category" dataKey="name" stroke={colors.textSecondary} fontSize={11} tickLine={false} axisLine={false} width={120} />
                                    <RechartsTooltip cursor={{ fill: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }} contentStyle={{ background: colors.card, border: `1px solid ${colors.border}`, borderRadius: '8px', color: colors.text }} />
                                    <Bar dataKey="Loss" fill="#ef4444" radius={[0, 4, 4, 0]} barSize={24} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                        ) : <div style={{ height: 320, display: 'flex', alignItems: 'center', justifyContent: 'center', color: colors.textSecondary, fontSize: 13 }}>Nu sunt date pentru comparație.</div>}
                    </div>

                    <div style={{ background: colors.card, border: `0.5px solid ${colors.border}`, borderRadius: '12px', overflow: 'hidden' }}>
                        <div style={{ padding: '16px 20px', borderBottom: `0.5px solid ${colors.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '14px', fontWeight: '600', color: colors.text }}>Restaurant Comparison</span>
                            <span style={{ fontSize: '12px', color: colors.textSecondary }}>Ranked by total loss</span>
                        </div>
                        {comparisonData.length === 0 ? (
                            <div style={{ padding: '40px', textAlign: 'center', color: colors.textSecondary, fontSize: '13px' }}>
                                No stop events data for comparison
                            </div>
                        ) : (
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '700px' }}>
                                    <thead style={{ background: `${colors.bg}80`, borderBottom: `0.5px solid ${colors.border}` }}>
                                        <tr>
                                            <th style={thStyle}>#</th>
                                            <th style={thStyle}>Restaurant</th>
                                            <th style={thStyle}>Total Stops</th>
                                            <th style={thStyle}>Downtime</th>
                                            <th style={thStyle}>Total Loss</th>
                                            <th style={thStyle}>Glovo</th>
                                            <th style={thStyle}>Wolt</th>
                                            <th style={thStyle}>Bolt</th>
                                            <th style={thStyle}>Impact</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {comparisonData.map((c, i) => {
                                            const maxLoss = comparisonData[0]?.totalLoss || 1
                                            const barPercent = (c.totalLoss / maxLoss) * 100
                                            return (
                                                <tr key={c.id} style={{
                                                    borderBottom: i < comparisonData.length - 1 ? `0.5px solid ${colors.border}` : 'none',
                                                    transition: 'background 0.12s'
                                                }}
                                                    onMouseOver={e => e.currentTarget.style.background = colors.hover}
                                                    onMouseOut={e => e.currentTarget.style.background = 'transparent'}
                                                >
                                                    <td style={{ ...tdStyle, fontWeight: '600', color: colors.textSecondary }}>{i + 1}</td>
                                                    <td style={tdStyle}>
                                                        <div style={{ fontWeight: '500' }}>{c.name}</div>
                                                        <div style={{ fontSize: '11px', color: colors.textSecondary }}>{c.city}</div>
                                                    </td>
                                                    <td style={{ ...tdStyle, fontWeight: '600' }}>{c.totalStops}</td>
                                                    <td style={tdStyle}>
                                                        {c.totalMinutes >= 60
                                                            ? `${(c.totalMinutes / 60).toFixed(1)}h`
                                                            : `${c.totalMinutes}m`}
                                                    </td>
                                                    <td style={{ ...tdStyle, fontWeight: '700', color: '#EF4444' }}>
                                                        {c.totalLoss.toFixed(0)} RON
                                                    </td>
                                                    <td style={{ ...tdStyle, textAlign: 'center' }}>{c.glovo || '-'}</td>
                                                    <td style={{ ...tdStyle, textAlign: 'center' }}>{c.wolt || '-'}</td>
                                                    <td style={{ ...tdStyle, textAlign: 'center' }}>{c.bolt || '-'}</td>
                                                    <td style={{ ...tdStyle, minWidth: '120px' }}>
                                                        <div style={{
                                                            height: '8px', borderRadius: '4px',
                                                            background: `${colors.border}`,
                                                            overflow: 'hidden'
                                                        }}>
                                                            <div style={{
                                                                height: '100%', borderRadius: '4px',
                                                                width: `${barPercent}%`,
                                                                background: barPercent > 70 ? '#EF4444' : barPercent > 40 ? colors.orange : colors.green,
                                                                transition: 'width 0.3s ease'
                                                            }} />
                                                        </div>
                                                    </td>
                                                </tr>
                                            )
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </>
            )}

            <Toaster />
        </div>
    )
}
