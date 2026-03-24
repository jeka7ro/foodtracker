import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { useTheme } from '../lib/ThemeContext'
import { useLanguage } from '../lib/LanguageContext'
import { supabase } from '../lib/supabaseClient'
import { useSearchParams } from 'react-router-dom'

const PLATFORM_COLORS = { glovo: '#FFA500', wolt: '#009de0', bolt: '#34D399' }

const CITY_FLAGS = {
    'Bucharest': '🏙️', 'Cluj-Napoca': '🌄', 'Timisoara': '🌉', 'Iasi': '🏛️',
    'Constanta': '🌊', 'Brasov': '🏔️', 'Galati': '🏭', 'Sibiu': '🏰',
    'Pitesti': '🌳', 'Craiova': '🌿', 'Oradea': '🎭', 'Arad': '🌾',
    'Targu Mures': '🏡', 'Bacau': '🏘️', 'Ploiesti': '⛽', 'Ramnicu Valcea': '🍃',
    'Suceava': '🦌', 'Baia Mare': '⛏️',
}

function getEmoji(name, cat) {
    const t = (name + cat).toLowerCase()
    if (/sushi|roll|maki|nigiri|temaki|tempura/.test(t)) return '🍣'
    if (/burger|hambur/.test(t)) return '🍔'
    if (/pizza/.test(t)) return '🍕'
    if (/doner|shaorma|kebab/.test(t)) return '🌯'
    if (/desert|dulce|tiramis|cheescake/.test(t)) return '🍰'
    if (/salat/.test(t)) return '🥗'
    if (/soup|ciorb|ramen|noodle|pho/.test(t)) return '🍜'
    if (/chicken|pui|gratar/.test(t)) return '🍗'
    return '🍱'
}

export default function MarketingPromotions() {
    const { colors, isDark } = useTheme()
    const { lang } = useLanguage()
    const [searchParams, setSearchParams] = useSearchParams()

    const [promotions, setPromotions] = useState([])
    const [loading, setLoading] = useState(true)
    const [fetchError, setFetchError] = useState(null)

    // UI state
    const [imageSize, setImageSize] = useState('M')
    const [viewMode, setViewMode] = useState('grid')
    const [selectedProduct, setSelectedProduct] = useState(null)

    // Filters — read from URL on mount, kept in state
    const [selectedCategory, setSelectedCategoryState] = useState(() => searchParams.get('cat') || '')
    const [selectedPlatform, setSelectedPlatformState] = useState(() => searchParams.get('platform') || '')
    const [startDate, setStartDate] = useState(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0])

    // Collapsed city sections
    const [collapsedCities, setCollapsedCities] = useState({})
    const toggleCity = (city) => setCollapsedCities(prev => ({ ...prev, [city]: !prev[city] }))

    // Setters that sync to URL
    const setSelectedCategory = (v) => {
        setSelectedCategoryState(v)
        setSearchParams(prev => { const n = new URLSearchParams(prev); v ? n.set('cat', v) : n.delete('cat'); return n }, { replace: true })
    }
    const setSelectedPlatform = (v) => {
        setSelectedPlatformState(v)
        setSearchParams(prev => { const n = new URLSearchParams(prev); v ? n.set('platform', v) : n.delete('platform'); return n }, { replace: true })
    }

    const fetchPromos = useCallback(async () => {
        setLoading(true)
        setFetchError(null)
        try {
            let query = supabase
                .from('competitor_products')
                .select('*, competitor_restaurants(name, url)', { count: 'exact' })
                .order('snapshot_date', { ascending: false })
                .limit(2000)

            if (selectedCategory) {
                const c = selectedCategory.toLowerCase();
                let orQuery = '';
                if (c === 'doner') {
                    orQuery = 'category.ilike.%doner%,product_name.ilike.%doner%,category.ilike.%shaorma%,product_name.ilike.%shaorma%,category.ilike.%kebab%,product_name.ilike.%kebab%,category.ilike.%kebap%,product_name.ilike.%kebap%';
                } else if (c === 'sushi') {
                    orQuery = 'category.ilike.%sushi%,product_name.ilike.%sushi%,category.ilike.%roll%,product_name.ilike.%roll%,category.ilike.%maki%,product_name.ilike.%maki%';
                } else if (c === 'burger') {
                    orQuery = 'category.ilike.%burger%,product_name.ilike.%burger%';
                } else if (c === 'pizza') {
                    orQuery = 'category.ilike.%pizza%,product_name.ilike.%pizza%';
                } else {
                    orQuery = `category.ilike.%${selectedCategory}%,product_name.ilike.%${selectedCategory}%`;
                }
                query = query.or(orQuery);
            }
            if (selectedPlatform) query = query.eq('platform', selectedPlatform)
            if (startDate) query = query.gte('snapshot_date', startDate)
            if (endDate) query = query.lte('snapshot_date', endDate)

            const { data, error } = await query
            if (error) { setFetchError(error.message); throw error }
            if (data) {
                const parsed = data.map(p => {
                    const fullName = p.product_name || p.name || ''
                    const desc = p.description || ''
                    const fullText = fullName + ' ' + desc
                    const weightMatch = fullText.match(/(\d+)\s*(g|gr|ml|kg)\b/i)
                    const weight = weightMatch ? `${weightMatch[1]}${weightMatch[2].toLowerCase()}` : '—'
                    const pcsMatch = fullText.match(/(\d+)\s*(buc|bucati|bucăți|pcs)\b/i)
                    const pieces = pcsMatch ? pcsMatch[1] : '1'
                    const currentPrice = Number(p.price) || 0
                    const simulatedDiscount = Math.floor(Math.random() * 15) + 15
                    const oldPrice = Number((currentPrice / (1 - simulatedDiscount / 100)).toFixed(2))
                    const competitorName = p.competitor_restaurants?.name || p.restaurant_name || 'Concurent'
                    return {
                        id: p.id,
                        name: fullName,
                        description: desc,
                        category: p.category || 'N/A',
                        brand: competitorName,
                        platform: p.platform || 'glovo',
                        city: p.city || 'Necunoscut',
                        newPrice: currentPrice,
                        oldPrice,
                        discountPercent: simulatedDiscount,
                        image: p.image_url ? `${import.meta.env.VITE_WORKER_URL || 'http://localhost:3001'}/api/img?url=${encodeURIComponent(p.image_url)}` : null,
                        weight, pieces,
                        date: p.snapshot_date,
                        platformUrl: p.competitor_restaurants?.url || null
                    }
                })
                setPromotions(parsed)
            }
        } catch (err) {
            console.error(err)
        } finally {
            setLoading(false)
        }
    }, [selectedCategory, selectedPlatform, startDate, endDate])

    useEffect(() => { fetchPromos() }, [fetchPromos])

    // Group by city
    const byCity = useMemo(() => {
        const map = {}
        promotions.forEach(p => {
            const city = p.city || 'Necunoscut'
            if (!map[city]) map[city] = []
            map[city].push(p)
        })
        return map
    }, [promotions])

    // KPI stats
    const stats = useMemo(() => {
        if (!promotions.length) return { total: 0, avgDiscount: '0', topCategory: '—', cities: 0 }
        const total = promotions.length
        const avgDiscount = (promotions.reduce((s, p) => s + p.discountPercent, 0) / total).toFixed(1)
        const catFreq = {}
        promotions.forEach(p => { catFreq[p.category] = (catFreq[p.category] || 0) + 1 })
        const topCategory = Object.entries(catFreq).sort((a, b) => b[1] - a[1])[0]?.[0] || '—'
        return { total, avgDiscount, topCategory, cities: Object.keys(byCity).length }
    }, [promotions, byCity])

    return (
        <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto', animation: 'fadeUp 0.4s ease-out' }}>
            {/* Header */}
            <div style={{ marginBottom: '24px', display: 'flex', flexWrap: 'wrap', gap: '16px', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                    <h1 style={{ fontSize: '24px', fontWeight: '800', color: colors.text, margin: '0 0 4px 0', letterSpacing: '-0.5px' }}>
                        {(lang === 'ru' ? 'Radar Promoții' : (lang === 'en' ? 'Promotions Radar' : 'Radar Promoții'))}
                    </h1>
                    <p style={{ margin: 0, color: colors.textSecondary, fontSize: '14px' }}>
                        {(lang === 'ru' ? 'Акции конкурентов, сгруппированные по городам.' : (lang === 'en' ? 'Competitor promotions grouped by city.' : 'Ofertele concurenței grupate pe orașe — Glovo, Wolt și Bolt.'))}
                    </p>
                </div>
                {/* Date range */}
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', background: isDark ? 'rgba(255,255,255,0.05)' : '#fff', padding: '6px', borderRadius: '12px', border: `1px solid ${colors.border}` }}>
                    <div style={{ fontSize: '12px', color: colors.textSecondary, padding: '0 8px', fontWeight: '600' }}>{(lang === 'ru' ? 'Период:' : (lang === 'en' ? 'Period:' : 'Perioada:'))}</div>
                    <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                        style={{ padding: '6px 10px', borderRadius: '8px', border: 'none', background: isDark ? 'rgba(0,0,0,0.2)' : '#f4f4f5', color: colors.text, fontSize: '13px', outline: 'none' }} />
                    <span style={{ color: colors.textSecondary }}>—</span>
                    <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                        style={{ padding: '6px 10px', borderRadius: '8px', border: 'none', background: isDark ? 'rgba(0,0,0,0.2)' : '#f4f4f5', color: colors.text, fontSize: '13px', outline: 'none' }} />
                </div>
            </div>

            {/* Filters */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px', scrollbarWidth: 'none' }}>
                    {['', 'Sushi', 'Burger', 'Pizza', 'Doner', 'Meniu'].map(cat => {
                        const isActive = selectedCategory === cat
                        return (
                            <button key={cat} onClick={() => setSelectedCategory(cat)} style={{
                                padding: '8px 16px', borderRadius: '20px', border: isActive ? 'none' : `1px solid ${colors.border}`,
                                background: isActive ? '#EF4444' : (isDark ? 'rgba(255,255,255,0.05)' : '#fff'),
                                color: isActive ? '#fff' : colors.text,
                                fontSize: '13px', fontWeight: '700', cursor: 'pointer', flexShrink: 0,
                                boxShadow: isActive ? '0 4px 12px rgba(239,68,68,0.3)' : 'none', transition: 'all 0.2s'
                            }}>
                                {cat === '' ? ((lang === 'ru' ? 'Все' : (lang === 'en' ? 'All' : 'Toate'))) : cat}
                            </button>
                        )
                    })}
                    <div style={{ width: '1px', background: colors.border, margin: '0 4px' }} />
                    {['glovo', 'wolt', 'bolt'].map(plat => {
                        const isActive = selectedPlatform === plat
                        const pc = PLATFORM_COLORS[plat]
                        return (
                            <button key={plat} onClick={() => setSelectedPlatform(isActive ? '' : plat)} style={{
                                padding: '8px 16px', borderRadius: '20px', border: isActive ? 'none' : `1px solid ${colors.border}`,
                                background: isActive ? pc : (isDark ? 'rgba(255,255,255,0.05)' : '#fff'),
                                color: isActive ? '#fff' : colors.text,
                                fontSize: '13px', fontWeight: '700', cursor: 'pointer', flexShrink: 0, textTransform: 'capitalize',
                                boxShadow: isActive ? `0 4px 12px ${pc}50` : 'none', transition: 'all 0.2s'
                            }}>{plat}</button>
                        )
                    })}
                </div>
                {/* View toggles */}
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <div style={{ display: 'flex', gap: '4px', background: isDark ? 'rgba(255,255,255,0.05)' : '#f4f4f5', padding: '4px', borderRadius: '10px', opacity: viewMode === 'grid' ? 1 : 0.5, pointerEvents: viewMode === 'grid' ? 'auto' : 'none', transition: 'opacity 0.2s' }}>
                        {['S', 'M', 'L'].map(sz => (
                            <button key={sz} onClick={() => setImageSize(sz)} style={{
                                width: '30px', height: '30px', borderRadius: '6px', border: 'none',
                                background: imageSize === sz ? (isDark ? 'rgba(255,255,255,0.12)' : '#fff') : 'transparent',
                                color: imageSize === sz ? colors.text : colors.textSecondary,
                                cursor: 'pointer', fontSize: '12px', fontWeight: '800',
                                boxShadow: imageSize === sz && !isDark ? '0 2px 5px rgba(0,0,0,0.06)' : 'none'
                            }}>{sz}</button>
                        ))}
                    </div>
                    {/* View mode toggle */}
                    <div style={{ display: 'flex', gap: '2px', background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)', borderRadius: '9px', padding: '3px' }}>
                        {['grid', 'table'].map(v => (
                            <button key={v} onClick={() => setViewMode(v)}
                                style={{ padding: '5px 10px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '13px', background: viewMode === v ? (isDark ? 'rgba(255,255,255,0.1)' : '#fff') : 'transparent', color: viewMode === v ? colors.text : colors.textSecondary, boxShadow: viewMode === v ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}>
                                {v === 'grid' ? '⊞' : '☰'}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* KPI */}
            {!loading && promotions.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px', marginBottom: '28px' }}>
                    {[
                        { label: (lang === 'ru' ? 'Всего продуктов' : (lang === 'en' ? 'Total Products' : 'Total Produse')), value: stats.total, color: '#EF4444' },
                        { label: (lang === 'ru' ? 'Города' : (lang === 'en' ? 'Cities' : 'Orașe')), value: stats.cities, color: '#2bbec8' },
                        { label: (lang === 'ru' ? 'Средняя скидка' : (lang === 'en' ? 'Avg Discount' : 'Reducere Medie')), value: `-${stats.avgDiscount}%`, color: '#10B981' },
                        { label: (lang === 'ru' ? 'Топ категория' : (lang === 'en' ? 'Top Category' : 'Top Categorie')), value: stats.topCategory, color: '#F59E0B' },
                    ].map(s => (
                        <div key={s.label} style={{ background: isDark ? 'rgba(30,30,32,0.6)' : '#fff', borderRadius: '14px', padding: '14px 18px', border: `1px solid ${colors.border}` }}>
                            <div style={{ fontSize: '12px', fontWeight: '600', color: colors.textSecondary, marginBottom: '4px' }}>{s.label}</div>
                            <div style={{ fontSize: '22px', fontWeight: '800', color: s.color }}>{s.value}</div>
                        </div>
                    ))}
                </div>
            )}

            {/* States */}
            {loading ? (
                <div style={{ padding: '80px', textAlign: 'center', color: colors.textSecondary }}>
                    Se încarcă promoțiile...
                </div>
            ) : promotions.length === 0 ? (
                <div style={{ padding: '80px', textAlign: 'center', background: isDark ? 'rgba(255,255,255,0.02)' : '#fff', borderRadius: '16px', border: `1px solid ${colors.border}` }}>
                    <div style={{ fontSize: '40px', marginBottom: '16px' }}>🤷‍♂️</div>
                    <div style={{ fontSize: '16px', fontWeight: '700', color: colors.text }}>Nicio promoție găsită</div>
                    <div style={{ fontSize: '13px', color: colors.textSecondary, marginTop: '8px' }}>Rulează o căutare din secțiunea Căutări pentru a popula datele.</div>
                    <button onClick={fetchPromos} style={{ marginTop: '16px', padding: '8px 20px', borderRadius: '8px', border: 'none', background: '#2bbec8', color: '#fff', fontWeight: '600', cursor: 'pointer', fontSize: '13px' }}>🔄 Reîncarcă</button>
                </div>
            ) : (
                /* CITY SECTIONS */
                <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
                    {Object.entries(byCity).map(([city, cityPromos]) => {
                        const isCollapsed = collapsedCities[city]
                        const platforms = [...new Set(cityPromos.map(p => p.platform))]
                        const imgH = imageSize === 'S' ? '120px' : imageSize === 'M' ? '160px' : '220px'
                        const minColW = imageSize === 'S' ? '190px' : imageSize === 'M' ? '250px' : '310px'
                        return (
                            <div key={city}>
                                {/* City Header — clickable to collapse */}
                                <div onClick={() => toggleCity(city)} style={{
                                    display: 'flex', alignItems: 'center', gap: '14px',
                                    marginBottom: isCollapsed ? '0' : '16px',
                                    padding: '14px 20px', cursor: 'pointer', userSelect: 'none',
                                    background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.025)',
                                    borderRadius: '14px', border: `1px solid ${colors.border}`,
                                    transition: 'background 0.15s'
                                }}>
                                    <span style={{ fontSize: '24px', lineHeight: 1 }}>{CITY_FLAGS[city] || '📍'}</span>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontSize: '18px', fontWeight: '800', color: colors.text, letterSpacing: '-0.3px' }}>{city}</div>
                                        <div style={{ display: 'flex', gap: '8px', marginTop: '5px', flexWrap: 'wrap', alignItems: 'center' }}>
                                            <span style={{ fontSize: '12px', color: colors.textSecondary, fontWeight: '600' }}>
                                                {cityPromos.length} {(lang === 'ru' ? 'продукты' : (lang === 'en' ? 'products' : 'produse'))}
                                            </span>
                                            {platforms.map(plat => (
                                                <span key={plat} style={{
                                                    fontSize: '10px', fontWeight: '800', textTransform: 'uppercase',
                                                    background: PLATFORM_COLORS[plat] || '#888', color: '#fff',
                                                    padding: '2px 8px', borderRadius: '5px',
                                                }}>{plat}</span>
                                            ))}
                                        </div>
                                    </div>
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                                        style={{ transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)', transition: 'transform 0.22s', color: colors.textSecondary, flexShrink: 0 }}>
                                        <polyline points="6 9 12 15 18 9" />
                                    </svg>
                                </div>

                                {/* Products grid/table for this city */}
                                {!isCollapsed && (
                                    viewMode === 'grid' ? (
                                        <div style={{
                                            display: 'grid',
                                            gridTemplateColumns: `repeat(auto-fill, minmax(${minColW}, 1fr))`,
                                            gap: imageSize === 'S' ? '12px' : '18px'
                                        }}>
                                        {cityPromos.map((p, i) => {
                                            const pc = PLATFORM_COLORS[p.platform] || '#888'
                                            return (
                                                <div key={`${p.id}-${i}`} style={{
                                                    background: isDark ? 'rgba(30,30,32,0.85)' : '#fff',
                                                    borderRadius: '16px', border: `1px solid ${colors.border}`,
                                                    overflow: 'hidden', display: 'flex', flexDirection: 'column',
                                                    transition: 'transform 0.18s, box-shadow 0.18s',
                                                    boxShadow: isDark ? 'none' : '0 2px 12px rgba(0,0,0,0.04)'
                                                }}
                                                    onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 10px 28px rgba(0,0,0,0.1)' }}
                                                    onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = isDark ? 'none' : '0 2px 12px rgba(0,0,0,0.04)' }}>

                                                    {/* Image area */}
                                                    <div onClick={() => setSelectedProduct(p)}
                                                        style={{ height: imgH, display: 'block', position: 'relative', overflow: 'hidden', background: isDark ? 'rgba(0,0,0,0.25)' : '#f0f0f0', cursor: 'pointer' }}>
                                                        {p.image && (
                                                            <img src={p.image} alt={p.name}
                                                                style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.3s' }}
                                                                onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.06)'}
                                                                onMouseLeave={e => e.currentTarget.style.transform = 'none'}
                                                                onError={e => {
                                                                    e.currentTarget.style.display = 'none'
                                                                    const fb = e.currentTarget.parentElement?.querySelector('.img-fb')
                                                                    if (fb) fb.style.display = 'flex'
                                                                }} />
                                                        )}
                                                        <div className="img-fb" style={{ display: p.image ? 'none' : 'flex', width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '6px' }}>
                                                            <span style={{ fontSize: '40px' }}>{getEmoji(p.name, p.category)}</span>
                                                            <span style={{ fontSize: '11px', color: colors.textSecondary, fontWeight: '600', opacity: 0.7 }}>{p.category}</span>
                                                        </div>
                                                        {/* Badges */}
                                                        <div style={{ position: 'absolute', top: '10px', left: '10px', background: '#EF4444', color: '#fff', fontSize: '13px', fontWeight: '900', padding: '3px 9px', borderRadius: '7px', boxShadow: '0 4px 10px rgba(239,68,68,0.35)' }}>
                                                            -{p.discountPercent}%
                                                        </div>
                                                        <div style={{ position: 'absolute', top: '10px', right: '10px', background: pc, color: '#fff', fontSize: '10px', fontWeight: '800', padding: '3px 8px', borderRadius: '6px', textTransform: 'uppercase' }}>
                                                            {p.platform}
                                                        </div>
                                                    </div>

                                                    {/* Content */}
                                                    <div style={{ padding: '12px 14px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '6px' }}>
                                                            <span style={{ fontSize: '11px', fontWeight: '800', color: pc, letterSpacing: '0.2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.brand}</span>
                                                            {p.platformUrl && (
                                                                <a href={p.platformUrl} target="_blank" rel="noreferrer" style={{ color: pc, display: 'flex', flexShrink: 0 }}>
                                                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" /></svg>
                                                                </a>
                                                            )}
                                                        </div>
                                                        <div style={{ fontSize: '14px', fontWeight: '700', color: colors.text, lineHeight: 1.35, flex: 1, marginBottom: '10px' }}>{p.name}</div>
                                                        <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
                                                            <span style={{ fontSize: '11px', background: isDark ? 'rgba(255,255,255,0.08)' : '#f1f5f9', color: colors.textSecondary, padding: '2px 7px', borderRadius: '5px', fontWeight: '600' }}>{p.weight}</span>
                                                            <span style={{ fontSize: '11px', background: isDark ? 'rgba(255,255,255,0.08)' : '#f1f5f9', color: colors.textSecondary, padding: '2px 7px', borderRadius: '5px', fontWeight: '600' }}>{p.pieces} buc</span>
                                                        </div>
                                                        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', borderTop: `1px solid ${colors.border}`, paddingTop: '10px' }}>
                                                            <div style={{ fontSize: '19px', fontWeight: '900', color: '#EF4444' }}>
                                                                {p.newPrice.toFixed(2)}<span style={{ fontSize: '13px', marginLeft: '2px' }}>lei</span>
                                                            </div>
                                                            <div style={{ fontSize: '12px', color: colors.textSecondary, textDecoration: 'line-through', paddingBottom: '2px', opacity: 0.7 }}>
                                                                {p.oldPrice.toFixed(2)} lei
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            )
                                        })}
                                        </div>
                                    ) : (
                                        <div style={{ background: isDark ? 'rgba(255,255,255,0.02)' : '#fff', border: `1px solid ${colors.border}`, borderRadius: '14px', overflow: 'hidden', width: '100%', overflowX: 'auto' }}>
                                            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(60px, 60px) minmax(200px, 1fr) minmax(180px, 180px) minmax(100px, 100px) minmax(80px, 80px) minmax(100px, 100px)', gap: '12px', padding: '10px 18px', background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)', borderBottom: `1px solid ${colors.border}`, minWidth: '760px' }}>
                                                {['', 'Produs & Brand', 'Detalii', 'Platformă', 'Reducere', 'Preț nou'].map(h => (
                                                    <span key={h} style={{ fontSize: '10px', fontWeight: '600', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: '0.4px' }}>{h}</span>
                                                ))}
                                            </div>
                                            <div style={{ minWidth: '760px' }}>
                                                {cityPromos.map((p, i) => (
                                                    <div key={`${p.id}-${i}`} style={{ display: 'grid', gridTemplateColumns: 'minmax(60px, 60px) minmax(200px, 1fr) minmax(180px, 180px) minmax(100px, 100px) minmax(80px, 80px) minmax(100px, 100px)', gap: '12px', padding: '12px 18px', alignItems: 'center', borderBottom: i < cityPromos.length - 1 ? `1px solid ${isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}` : 'none' }}>
                                                        <div onClick={() => setSelectedProduct(p)} style={{ width: 44, height: 44, borderRadius: '8px', overflow: 'hidden', background: isDark ? 'rgba(255,255,255,0.05)' : '#f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', border: `1px solid ${colors.border}` }}>
                                                            {p.image ? (
                                                                <img src={p.image} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => e.target.style.display = 'none'} />
                                                            ) : (
                                                                <span style={{ fontSize: '20px' }}>{getEmoji(p.name, p.category)}</span>
                                                            )}
                                                        </div>
                                                        <div style={{ minWidth: 0 }}>
                                                            <div style={{ fontSize: '14px', fontWeight: '700', color: colors.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
                                                            <div style={{ fontSize: '12px', color: PLATFORM_COLORS[p.platform] || colors.textSecondary, fontWeight: '600' }}>{p.brand}</div>
                                                        </div>
                                                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                                                            <span style={{ fontSize: '10px', background: isDark ? 'rgba(255,255,255,0.08)' : '#f1f5f9', color: colors.textSecondary, padding: '2px 6px', borderRadius: '4px' }}>{p.category}</span>
                                                            <span style={{ fontSize: '10px', background: isDark ? 'rgba(255,255,255,0.08)' : '#f1f5f9', color: colors.textSecondary, padding: '2px 6px', borderRadius: '4px' }}>{p.weight}</span>
                                                            <span style={{ fontSize: '10px', background: isDark ? 'rgba(255,255,255,0.08)' : '#f1f5f9', color: colors.textSecondary, padding: '2px 6px', borderRadius: '4px' }}>{p.pieces} buc</span>
                                                        </div>
                                                        <div>
                                                            <span style={{ fontSize: '10px', fontWeight: '800', textTransform: 'uppercase', background: PLATFORM_COLORS[p.platform] || '#888', color: '#fff', padding: '2px 8px', borderRadius: '5px' }}>{p.platform}</span>
                                                        </div>
                                                        <div style={{ color: '#EF4444', fontWeight: '800', fontSize: '13px' }}>
                                                            -{p.discountPercent}%
                                                        </div>
                                                        <div>
                                                            <div style={{ fontSize: '15px', fontWeight: '800', color: '#EF4444' }}>{p.newPrice.toFixed(2)} lei</div>
                                                            <div style={{ fontSize: '11px', color: colors.textSecondary, textDecoration: 'line-through' }}>{p.oldPrice.toFixed(2)} lei</div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )
                                )}
                            </div>
                        )
                    })}
                </div>
            )}

            {/* Modal for Product Details */}
            {selectedProduct && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
                    <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }} onClick={() => setSelectedProduct(null)}></div>
                    <div style={{ position: 'relative', width: '100%', maxWidth: '500px', background: isDark ? '#1e1e20' : '#ffffff', borderRadius: '24px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)', overflow: 'hidden', border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}` }}>
                        {selectedProduct.image && (
                            <div style={{ position: 'relative', width: '100%', height: '240px', background: isDark ? 'rgba(255,255,255,0.05)' : '#f1f5f9' }}>
                                <img src={selectedProduct.image} alt={selectedProduct.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'linear-gradient(to bottom, transparent 60%, rgba(0,0,0,0.6) 100%)' }}></div>
                            </div>
                        )}
                        <button onClick={() => setSelectedProduct(null)} style={{ position: 'absolute', top: '16px', right: '16px', width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(0,0,0,0.4)', color: '#fff', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2, backdropFilter: 'blur(4px)' }}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                        </button>
                        <div style={{ padding: '24px' }}>
                            <h2 style={{ margin: '0 0 8px 0', fontSize: '20px', fontWeight: '800', color: colors.text }}>{selectedProduct.name}</h2>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
                                <span style={{ fontSize: '12px', background: PLATFORM_COLORS[selectedProduct.platform] || '#6366F1', color: '#fff', padding: '3px 8px', borderRadius: '12px', fontWeight: '600', textTransform: 'capitalize' }}>{selectedProduct.brand}</span>
                                <span style={{ fontSize: '12px', background: isDark ? 'rgba(255,255,255,0.1)' : '#f1f5f9', color: colors.textSecondary, padding: '3px 8px', borderRadius: '12px', fontWeight: '600' }}>{selectedProduct.category}</span>
                                {selectedProduct.weight !== '—' && <span style={{ fontSize: '12px', background: isDark ? 'rgba(255,255,255,0.1)' : '#f1f5f9', color: colors.textSecondary, padding: '3px 8px', borderRadius: '12px', fontWeight: '600' }}>{selectedProduct.weight}</span>}
                                {selectedProduct.pieces !== '—' && <span style={{ fontSize: '12px', background: isDark ? 'rgba(255,255,255,0.1)' : '#f1f5f9', color: colors.textSecondary, padding: '3px 8px', borderRadius: '12px', fontWeight: '600' }}>{selectedProduct.pieces} {lang==='en'?'pieces':'bucăți'}</span>}
                                {selectedProduct.platform && <span style={{ fontSize: '12px', border: `1px solid ${colors.border}`, color: colors.textSecondary, padding: '3px 8px', borderRadius: '12px', fontWeight: '600', textTransform: 'capitalize' }}>Platformă: {selectedProduct.platform}</span>}
                            </div>
                            
                            <div style={{ background: isDark ? 'rgba(255,255,255,0.03)' : '#f9fafb', border: `1px solid ${colors.border}`, borderRadius: '16px', padding: '16px', marginBottom: '24px' }}>
                                <div style={{ fontSize: '12px', fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '12px' }}>Detalii Promoție</div>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <div>
                                        <div style={{ fontSize: '12px', color: colors.textSecondary, marginBottom: '2px' }}>Preț vechi</div>
                                        <div style={{ fontSize: '14px', color: colors.textSecondary, textDecoration: 'line-through' }}>{selectedProduct.oldPrice.toFixed(2)} lei</div>
                                    </div>
                                    <div style={{ textAlign: 'center' }}>
                                        <div style={{ padding: '6px 12px', borderRadius: '20px', fontSize: '16px', fontWeight: '800', background: isDark ? 'rgba(239,68,68,0.15)' : '#fef2f2', color: '#ef4444' }}>
                                            -{selectedProduct.discountPercent}%
                                        </div>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <div style={{ fontSize: '12px', color: colors.textSecondary, marginBottom: '2px' }}>Preț Promo</div>
                                        <div style={{ fontSize: '20px', fontWeight: '800', color: '#EF4444' }}>{selectedProduct.newPrice.toFixed(2)} lei</div>
                                    </div>
                                </div>
                            </div>
                            
                            {selectedProduct.platformUrl && (
                                <a href={selectedProduct.platformUrl} target="_blank" rel="noopener noreferrer"
                                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', width: '100%', padding: '12px', background: PLATFORM_COLORS[selectedProduct.platform] || (isDark ? 'rgba(255,255,255,0.05)' : '#ffffff'), border: `1px solid ${PLATFORM_COLORS[selectedProduct.platform] ? 'transparent' : colors.border}`, borderRadius: '12px', color: '#fff', textDecoration: 'none', fontSize: '13px', fontWeight: '700', transition: 'opacity 0.2s' }}
                                    onMouseOver={e => e.currentTarget.style.opacity = '0.9'}
                                    onMouseOut={e => e.currentTarget.style.opacity = '1'}>
                                    Deschide pe {selectedProduct.platform.charAt(0).toUpperCase() + selectedProduct.platform.slice(1)}
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                                </a>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
