import { useState, useEffect, useMemo } from 'react'
import { useTheme } from '../lib/ThemeContext'
import { useLanguage } from '../lib/LanguageContext'
import { supabase } from '../lib/supabaseClient'

const PLAT_COLORS = { wolt: '#009de0', glovo: '#FFC244', bolt: '#34D186' }

function glass(dk) {
    return { background: dk ? 'rgba(30,32,40,0.65)' : '#fff', backdropFilter: dk ? 'blur(24px) saturate(180%)' : 'none', WebkitBackdropFilter: dk ? 'blur(24px) saturate(180%)' : 'none', borderRadius: '20px', border: dk ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.08)', boxShadow: dk ? '0 8px 32px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)' : '0 2px 12px rgba(0,0,0,0.08)' }
}

export default function StopPrices() {
    const { lang } = useLanguage()
    const { colors, isDark } = useTheme()
    const g = glass(isDark)

    const [products, setProducts] = useState([])
    const [restaurants, setRestaurants] = useState([])
    const [loading, setLoading] = useState(true)
    const [selectedBrand, setSelectedBrand] = useState('all')
    const [selectedCity, setSelectedCity] = useState('all')
    const [selectedRestaurant, setSelectedRestaurant] = useState('all')
    const [search, setSearch] = useState('')
    const [brands, setBrands] = useState([])
    const [expandedProduct, setExpandedProduct] = useState({})

    useEffect(() => {
        async function load() {
            const [{ data: r }, { data: b }] = await Promise.all([
                supabase.from('restaurants').select('id, name, city, brand_id, wolt_url, glovo_url, bolt_url, brands(name, logo_url)').eq('is_active', true),
                supabase.from('brands').select('id, name, logo_url').order('name')
            ])
            setRestaurants(r || [])
            setBrands(b || [])

            // Find last available snapshot date (not necessarily today)
            const { data: latestSnap } = await supabase.from('own_product_snapshots')
                .select('snapshot_date').order('snapshot_date', { ascending: false }).limit(1)
            const snapDate = latestSnap?.[0]?.snapshot_date
            if (!snapDate) { setLoading(false); return }

            const { data: p } = await supabase.from('own_product_snapshots')
                .select('restaurant_id, platform, product_name, category, price, brand_id, snapshot_date, created_at, image_url, is_promoted')
                .eq('snapshot_date', snapDate)
            setProducts(p || [])
            setLoading(false)
        }
        load()
    }, [])

    const restMap = useMemo(() => {
        const m = {}
        restaurants.forEach(r => { m[r.id] = r })
        return m
    }, [restaurants])

    const availableCities = useMemo(() => {
        let r = restaurants
        if (selectedBrand !== 'all') r = r.filter(x => x.brand_id === selectedBrand)
        return [...new Set(r.map(x => x.city).filter(Boolean))].sort()
    }, [restaurants, selectedBrand])

    const availableRestaurants = useMemo(() => {
        let r = restaurants
        if (selectedBrand !== 'all') r = r.filter(x => x.brand_id === selectedBrand)
        if (selectedCity !== 'all') r = r.filter(x => x.city === selectedCity)
        return r.sort((a,b) => a.name.localeCompare(b.name))
    }, [restaurants, selectedBrand, selectedCity])

    // Group products by name to compare prices across platforms & restaurants
    const priceComparison = useMemo(() => {
        let filtered = products
        if (selectedBrand !== 'all') filtered = filtered.filter(p => p.brand_id === selectedBrand)
        if (selectedCity !== 'all') filtered = filtered.filter(p => restMap[p.restaurant_id]?.city === selectedCity)
        if (selectedRestaurant !== 'all') filtered = filtered.filter(p => p.restaurant_id === selectedRestaurant)
        if (search) filtered = filtered.filter(p => p.product_name?.toLowerCase().includes(search.toLowerCase()))

        const byName = {}
        filtered.forEach(p => {
            const key = p.product_name?.trim()
            if (!key || !p.price) return
            if (!byName[key]) byName[key] = { name: key, category: p.category, image: p.image_url, entries: [] }
            else if (!byName[key].image && p.image_url) byName[key].image = p.image_url

            const rest = restMap[p.restaurant_id]
            const platformUrl = rest ? rest[`${p.platform}_url`] : null
            byName[key].entries.push({
                platform: p.platform,
                price: Number(p.price),
                restaurant: rest?.name || '—',
                city: rest?.city || '—',
                brand: rest?.brands?.name || '—',
                logo: rest?.brands?.logo_url,
                url: platformUrl || null,
                snapshot_date: p.snapshot_date,
                created_at: p.created_at,
                is_promoted: p.is_promoted || false,
            })
        })

        return Object.values(byName)
            .filter(item => item.entries.length > 1) // only show products with multiple entries
            .map(item => {
                const prices = item.entries.map(e => e.price)
                const min = Math.min(...prices)
                const max = Math.max(...prices)
                const diff = max - min
                const diffPct = min > 0 ? ((diff / min) * 100).toFixed(1) : 0
                return { ...item, min, max, diff, diffPct, hasDiff: diff > 0 }
            })
            .sort((a, b) => b.diff - a.diff) // biggest differences first
    }, [products, selectedBrand, search, restMap])

    const totalWithDiffs = priceComparison.filter(p => p.hasDiff).length
    const avgDiff = priceComparison.filter(p => p.hasDiff).length > 0
        ? (priceComparison.filter(p => p.hasDiff).reduce((s, p) => s + p.diff, 0) / totalWithDiffs).toFixed(2)
        : '0.00'
    const sel = { padding: '7px 12px', borderRadius: '8px', border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`, background: isDark ? 'rgba(255,255,255,0.05)' : '#fff', color: colors.text, fontSize: '12px', cursor: 'pointer' }

    return (
        <div style={{ padding: '24px 28px', minHeight: '100vh' }}>
            <div style={{ marginBottom: '24px' }}>
                <h1 style={{ margin: 0, fontSize: '22px', fontWeight: '800', color: colors.text, letterSpacing: '-0.5px' }}>
                    💰 Comparație Prețuri
                </h1>
                <p style={{ margin: '4px 0 0', fontSize: '13px', color: colors.textSecondary }}>
                    {(lang === 'ru' ? 'Сравнивайте цены на платформе и в ресторанах' : (lang === 'en' ? 'Compare prices of the same product across different platforms and restaurants — identify discrepancies' : 'Compara preturile aceluiasi produs pe diferite platforme si restaurante — identifica discrepantele'))}
                </p>
            </div>

            {/* KPI */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '16px', marginBottom: '24px' }}>
                {[
                    { label: 'Produse comparate', value: priceComparison.length, color: '#6366F1' },
                    { label: 'Cu diferente de pret', value: totalWithDiffs, color: totalWithDiffs > 0 ? '#FF9500' : '#22c55e' },
                    { label: 'Diferenta medie', value: `${avgDiff} RON`, color: '#ef4444' },
                ].map((k, i) => (
                    <div key={i} style={{ ...g, padding: '20px 24px', animation: `fadeUp 0.3s ease ${i * 0.05 + 0.05}s both` }}>
                        <div style={{ fontSize: '11px', fontWeight: '600', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>{k.label}</div>
                        <div style={{ fontSize: '28px', fontWeight: '700', color: k.color, lineHeight: 1 }}>{k.value}</div>
                    </div>
                ))}
            </div>

            {/* Filters */}
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap' }}>
                <select value={selectedBrand} onChange={e => { setSelectedBrand(e.target.value); setSelectedCity('all'); setSelectedRestaurant('all') }} style={sel}>
                    <option value="all">{(lang === 'ru' ? 'Все бренды' : (lang === 'en' ? 'All brands' : 'Toate brandurile'))}</option>
                    {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
                <select value={selectedCity} onChange={e => { setSelectedCity(e.target.value); setSelectedRestaurant('all') }} style={sel}>
                    <option value="all">{(lang === 'ru' ? 'Все города' : (lang === 'en' ? 'All cities' : 'Toate orasele'))}</option>
                    {availableCities.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <select value={selectedRestaurant} onChange={e => setSelectedRestaurant(e.target.value)} style={sel}>
                    <option value="all">{(lang === 'ru' ? 'Все рестораны' : (lang === 'en' ? 'All restaurants' : 'Toate restaurantele'))}</option>
                    {availableRestaurants.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder={(lang === 'ru' ? 'Поиск продукта...' : (lang === 'en' ? 'Search product...' : 'Cauta produs...'))} style={{ ...sel, minWidth: '200px' }} />
                <span style={{ fontSize: '12px', color: colors.textSecondary, marginLeft: 'auto' }}>
                    {priceComparison.length} produse · {totalWithDiffs} {(lang === 'ru' ? 'с отличиями' : (lang === 'en' ? 'with differences' : 'cu diferente'))}
                </span>
            </div>

            {/* Results */}
            {loading ? (
                <div style={{ textAlign: 'center', padding: '80px', color: colors.textSecondary }}>
                    <div style={{ width: 36, height: 36, border: `3px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}`, borderTopColor: '#6366F1', borderRadius: '50%', animation: 'spin 0.7s linear infinite', margin: '0 auto 16px' }} />
                    Se incarca...
                </div>
            ) : priceComparison.length === 0 ? (
                <div style={{ ...g, padding: '48px', textAlign: 'center' }}>
                    <div style={{ fontSize: '14px', fontWeight: '600', color: colors.text }}>Niciun produs de comparat</div>
                    <div style={{ fontSize: '12px', color: colors.textSecondary, marginTop: '6px' }}>Trebuie sa existe cel putin 2 intrari pe platforme diferite pentru comparatie</div>
                </div>
            ) : (
                <div style={{ ...g, overflow: 'hidden' }}>
                    {priceComparison.map((item, idx) => {
                        const isExp = !!expandedProduct[item.name]
                        return (
                            <div key={item.name} style={{ borderBottom: idx < priceComparison.length - 1 ? `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}` : 'none' }}>
                                <div onClick={() => setExpandedProduct(p => ({ ...p, [item.name]: !p[item.name] }))}
                                    style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 24px', cursor: 'pointer', transition: 'background 0.15s' }}
                                    onMouseOver={e => e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)'}
                                    onMouseOut={e => e.currentTarget.style.background = 'transparent'}>
                                    <span style={{ fontSize: '10px', color: '#6366F1', transform: isExp ? 'rotate(90deg)' : 'rotate(0)', transition: 'transform 0.15s', display: 'inline-block' }}>▶</span>
                                    
                                    <div style={{ width: 40, height: 40, borderRadius: '8px', background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)'}` }}>
                                        {item.image ? (
                                            <img src={item.image} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        ) : (
                                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ opacity: 0.2 }}><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg>
                                        )}
                                    </div>

                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontSize: '13px', fontWeight: '700', color: colors.text }}>{item.name}</div>
                                        {item.category && <div style={{ fontSize: '10px', color: colors.textSecondary }}>{item.category}</div>}
                                    </div>
                                    <span style={{ fontSize: '12px', color: colors.textSecondary }}>{item.entries.length} {(lang === 'ru' ? 'записей' : (lang === 'en' ? 'entries' : 'intrari'))}</span>
                                    <div style={{ textAlign: 'right', minWidth: '160px' }}>
                                        <div style={{ fontSize: '13px', fontWeight: '700', color: colors.text }}>{item.min.toFixed(2)} — {item.max.toFixed(2)} RON</div>
                                        {item.hasDiff && (() => {
                                            const minEntry = item.entries.find(e => e.price === item.min)
                                            const maxEntry = item.entries.find(e => e.price === item.max)
                                            const pct = item.max > 0 ? ((item.diff / item.max) * 100).toFixed(2) : '0.00'
                                            const diffPlatforms = minEntry && maxEntry && minEntry.platform !== maxEntry.platform
                                            return (
                                                <>
                                                    <div style={{ fontSize: '11px', fontWeight: '700', color: '#FF9500' }}>
                                                        Δ {item.diff.toFixed(2)} RON (-{pct}%)
                                                    </div>
                                                    {diffPlatforms && (
                                                        <div style={{ fontSize: '10px', color: colors.textSecondary, marginTop: '1px' }}>
                                                            {minEntry.platform.toUpperCase()} {item.min.toFixed(0)} vs {maxEntry.platform.toUpperCase()} {item.max.toFixed(0)} RON
                                                        </div>
                                                    )}
                                                </>
                                            )
                                        })()}
                                    </div>
                                    {item.hasDiff
                                        ? <span style={{ fontSize: '10px', fontWeight: '800', padding: '2px 8px', borderRadius: '6px', background: 'rgba(255,149,0,0.12)', color: '#FF9500' }}>{(lang === 'ru' ? 'ОТЛИЧИЯ' : (lang === 'en' ? 'DIFFERENT' : 'DIFERIT'))}</span>
                                        : <span style={{ fontSize: '10px', fontWeight: '800', padding: '2px 8px', borderRadius: '6px', background: 'rgba(34,197,94,0.12)', color: '#22c55e' }}>EGAL</span>}
                                </div>
                                {isExp && (
                                    <div style={{ padding: '4px 24px 16px 48px' }}>
                                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                                            <thead>
                                                <tr style={{ borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}` }}>
                                                    {['Platforma', 'Restaurant', 'Oras', 'Brand', 'Data/Ora', 'Pret', ''].map(h => (
                                                        <th key={h || '_link'} style={{ padding: '8px 10px', textAlign: h === 'Pret' ? 'right' : 'left', fontWeight: '600', color: colors.textSecondary, fontSize: '10px', textTransform: 'uppercase', width: h === '' ? '36px' : undefined }}>{h}</th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {item.entries.sort((a, b) => a.price - b.price).map((e, i) => (
                                                    <tr key={i} style={{ borderBottom: i < item.entries.length - 1 ? `0.5px solid ${isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}` : 'none' }}>
                                                        <td style={{ padding: '8px 10px' }}>
                                                            <span style={{ fontSize: '10px', fontWeight: '800', padding: '2px 8px', borderRadius: '5px', background: `${PLAT_COLORS[e.platform] || '#888'}22`, color: PLAT_COLORS[e.platform] || '#888', textTransform: 'uppercase' }}>{e.platform}</span>
                                                        </td>
                                                        <td style={{ padding: '8px 10px', fontWeight: '500', color: colors.text }}>{e.restaurant}</td>
                                                        <td style={{ padding: '8px 10px', color: colors.textSecondary }}>{e.city}</td>
                                                        <td style={{ padding: '8px 10px', color: colors.textSecondary }}>{e.brand}</td>
                                                        <td style={{ padding: '8px 10px', fontSize: '11px', color: colors.textSecondary }}>
                                                            {e.created_at ? new Date(e.created_at).toLocaleString('ro-RO', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : e.snapshot_date || '—'}
                                                        </td>
                                                        <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: '700', color: e.price === item.min ? '#22c55e' : e.price === item.max ? '#ef4444' : colors.text }}>
                                                            {e.price.toFixed(2)} RON
                                                            {e.price === item.min && item.hasDiff && <span style={{ fontSize: '9px', marginLeft: '4px', color: '#22c55e' }}>MIN</span>}
                                                            {e.price === item.max && item.hasDiff && <span style={{ fontSize: '9px', marginLeft: '4px', color: '#ef4444' }}>MAX</span>}
                                                            {e.price === item.min && item.hasDiff && (
                                                                <div style={{ fontSize: '10px', color: '#FF9500', fontWeight: '600', marginTop: '2px' }}>
                                                                    -{item.diff.toFixed(2)} RON (-{item.max > 0 ? ((item.diff / item.max) * 100).toFixed(2) : '0.00'}%) față de {item.entries.find(x => x.price === item.max)?.platform?.toUpperCase() || 'MAX'}
                                                                </div>
                                                            )}
                                                        </td>
                                                        <td style={{ padding: '8px 6px', textAlign: 'center' }}>
                                                            {e.url ? (
                                                                <a href={e.url} target="_blank" rel="noopener noreferrer" title={`Deschide pe ${e.platform}`}
                                                                    style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24, borderRadius: '6px', background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)', color: '#6366F1', textDecoration: 'none', transition: 'background 0.15s' }}
                                                                    onMouseOver={ev => ev.currentTarget.style.background = 'rgba(99,102,241,0.15)'}
                                                                    onMouseOut={ev => ev.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'}>
                                                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                                                                </a>
                                                            ) : (
                                                                <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24, color: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)' }}>
                                                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
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
                        )
                    })}
                </div>
            )}

            <style>{`
                @keyframes fadeUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
                @keyframes spin { to { transform: rotate(360deg); } }
            `}</style>
        </div>
    )
}
