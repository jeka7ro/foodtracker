import { useState, useEffect, useCallback, useMemo } from 'react'
import { useTheme } from '../lib/ThemeContext'
import { useLanguage } from '../lib/LanguageContext'
import { supabase } from '../lib/supabaseClient'
import { getSmartSearchWords } from '../lib/searchUtils'

const WORKER_URL = import.meta.env.VITE_WORKER_URL || 'http://localhost:3001'
const PLATFORM_COLORS = { wolt: '#009de0', glovo: '#ffc244', bolt: '#34d186' }

const DRINK_KEYWORDS = ['bautur', 'drink', 'beverage', 'suc', 'apa ', 'water', 'juice', 'smoothie', 'milkshake', 'shake', 'cocktail', 'coffee', 'cafea', 'tea', 'ceai', 'beer', 'bere', 'wine', 'vin', 'soft', 'cola', 'espresso', 'latte', 'cappuccino', 'limonada']
const isDrink = (cat) => cat ? DRINK_KEYWORDS.some(k => cat.toLowerCase().includes(k)) : false

const SpinIcon = () => (
    <span style={{ display: 'inline-block', width: 13, height: 13, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
)

export default function OwnProducts() {
    const { colors, isDark } = useTheme()
    const { lang } = useLanguage()

    const [brands, setBrands] = useState([])
    const [restaurants, setRestaurants] = useState([])
    const [products, setProducts] = useState([])
    const [loading, setLoading] = useState(false)
    const [scraping, setScraping] = useState(false)
    const [scrapingId, setScrapingId] = useState(null)
    const [scanMsg, setScanMsg] = useState(null)

    // Filters
    const [selectedBrand, setSelectedBrand] = useState('all')
    const [selectedPlatform, setSelectedPlatform] = useState('all')
    const [selectedCity, setSelectedCity] = useState('all')
    const [typeFilter, setTypeFilter] = useState('all')
    const [search, setSearch] = useState('')
    const [snapshotDate, setSnapshotDate] = useState(new Date().toISOString().split('T')[0])
    const [latestDate, setLatestDate] = useState(null)

    // UI state
    const [collapsedRestaurants, setCollapsedRestaurants] = useState({})
    const [collapsedCities, setCollapsedCities] = useState({})
    const [activeTab, setActiveTab] = useState('products')


    // Load brands, restaurants & find last available snapshot date
    useEffect(() => {
        Promise.all([
            supabase.from('brands').select('id, name, logo_url').order('name'),
            supabase.from('restaurants').select('id, name, city, brand_id, wolt_url, glovo_url, bolt_url, is_active, brands(name, logo_url)').eq('is_active', true).order('name'),
            supabase.from('own_product_snapshots').select('snapshot_date').order('snapshot_date', { ascending: false }).limit(1)
        ]).then(([{ data: b }, { data: r }, { data: snap }]) => {
            setBrands(b || [])
            setRestaurants(r || [])
            if (snap?.[0]?.snapshot_date) {
                setLatestDate(snap[0].snapshot_date)
                setSnapshotDate(snap[0].snapshot_date)
            }
        })
    }, [])

    // Restaurant lookup map
    const restaurantMap = useMemo(() => {
        const m = {}
        restaurants.forEach(r => { m[r.id] = r })
        return m
    }, [restaurants])

    // Load products — flat, no nested joins
    const loadProducts = useCallback(async () => {
        setLoading(true)
        try {
            let q = supabase.from('own_product_snapshots')
                .select('id, product_name, category, price, image_url, description, is_available, is_promoted, platform, city, restaurant_id, brand_id')
                .eq('snapshot_date', snapshotDate)
                .order('city')
                .order('restaurant_id')
                .order('category')
                .order('product_name')
                .limit(3000)

            if (selectedBrand !== 'all') q = q.eq('brand_id', selectedBrand)
            if (selectedPlatform !== 'all') q = q.eq('platform', selectedPlatform)
            if (selectedCity !== 'all') q = q.eq('city', selectedCity)

            const { data, error } = await q
            if (error) console.error('Products error:', error)
            setProducts(data || [])
        } finally {
            setLoading(false)
        }
    }, [snapshotDate, selectedBrand, selectedPlatform, selectedCity])

    useEffect(() => { loadProducts() }, [loadProducts])

    const cities = useMemo(() => [...new Set(restaurants.map(r => r.city).filter(Boolean))].sort(), [restaurants])

    // Apply search + type filter then group: City → Restaurant → Products
    const grouped = useMemo(() => {
        let list = products
        if (search) {
            const searchWords = getSmartSearchWords(search)
            if (searchWords.length > 0) {
                list = list.filter(p => {
                    const name = (p.product_name || '').toLowerCase()
                    const cat = (p.category || '').toLowerCase()
                    const restName = (restaurantMap[p.restaurant_id]?.name || '').toLowerCase()
                    
                    return searchWords.every(w => {
                        // Matching logic: word must be in name OR category
                        // Clever fix: if word is 'sushi', allow it to match if the restaurant itself is a sushi place
                        if (name.includes(w) || cat.includes(w)) return true;
                        if (w === 'sushi' && restName.includes('sushi')) return true;
                        return false;
                    })
                })
            }
        }
        
        if (typeFilter === 'drink') list = list.filter(p => isDrink(p.category))
        if (typeFilter === 'food') list = list.filter(p => !isDrink(p.category))

        // Group by city → restaurant_id
        const byCity = {}
        list.forEach(p => {
            const city = p.city || 'Necunoscut'
            const rid = p.restaurant_id
            if (!byCity[city]) byCity[city] = {}
            if (!byCity[city][rid]) byCity[city][rid] = []
            // Sort food first, drinks last within restaurant
            byCity[city][rid].push(p)
        })

        // Convert to sorted array
        return Object.entries(byCity)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([city, restMap]) => ({
                city,
                restaurants: Object.entries(restMap).map(([rid, prods]) => {
                    const rest = restaurantMap[rid]

                    // Deduplicate identical products across platforms
                    const nameGroups = {}
                    for (const p of prods) {
                        const normName = (p.product_name || 'neidentificat').toLowerCase().trim()
                        if (!nameGroups[normName]) {
                            nameGroups[normName] = {
                                id: p.id || Math.random().toString(),
                                product_name: p.product_name,
                                category: p.category,
                                image_url: p.image_url,
                                platforms: []
                            }
                        }
                        if (!nameGroups[normName].image_url && p.image_url) {
                            nameGroups[normName].image_url = p.image_url
                        }
                        nameGroups[normName].platforms.push({
                            platform: p.platform || 'glovo',
                            price: p.price,
                            is_promoted: p.is_promoted
                        })
                    }

                    const sorted = Object.values(nameGroups).sort((a, b) => {
                        const aDrink = isDrink(a.category) ? 1 : 0
                        const bDrink = isDrink(b.category) ? 1 : 0
                        if (aDrink !== bDrink) return aDrink - bDrink
                        return (a.category || '').localeCompare(b.category || '') || (a.product_name || '').localeCompare(b.product_name || '')
                    })
                    return { rid, rest, products: sorted }
                }).sort((a, b) => (a.rest?.name || '').localeCompare(b.rest?.name || ''))
            }))
    }, [products, search, typeFilter, restaurantMap])

    const totalUnique = useMemo(() => new Set(products.map(p => p.product_name)).size, [products])
    const totalRestaurants = useMemo(() => new Set(products.map(p => p.restaurant_id)).size, [products])

    // Scan operations
    const scanAll = async () => {
        setScraping(true); setScanMsg(null)
        try {
            const res = await fetch(`${WORKER_URL}/api/own-brands/scrape-all`, { method: 'POST' })
            const d = await res.json()
            setScanMsg({ ok: true, text: `${d.totalProducts || 0} produse salvate` })
            await loadProducts()
        } catch (e) { setScanMsg({ ok: false, text: e.message }) }
        finally { setScraping(false) }
    }

    const scanOne = async (restaurantId) => {
        setScrapingId(restaurantId); setScanMsg(null)
        try {
            const res = await fetch(`${WORKER_URL}/api/own-brands/scrape-restaurant`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ restaurantId })
            })
            const d = await res.json()
            setScanMsg({ ok: true, text: `${d.productCount || 0} produse salvate` })
            await loadProducts()
        } catch (e) { setScanMsg({ ok: false, text: e.message }) }
        finally { setScrapingId(null) }
    }

    const toggleCity = (city) => setCollapsedCities(prev => ({ ...prev, [city]: !prev[city] }))
    const toggleRest = (rid) => setCollapsedRestaurants(prev => ({ ...prev, [rid]: !prev[rid] }))

    const sel = { padding: '7px 10px', borderRadius: '8px', border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`, background: isDark ? 'rgba(255,255,255,0.05)' : '#fff', color: colors.text, fontSize: '12px', cursor: 'pointer' }

    return (
        <div style={{ padding: '24px 28px', minHeight: '100vh' }}>

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '20px', gap: '12px', flexWrap: 'wrap' }}>
                <div>
                    <h1 style={{ margin: 0, fontSize: '20px', fontWeight: '800', color: colors.text, letterSpacing: '-0.4px' }}>{lang === 'ru' ? 'Свои продукты (бренды)' : lang === 'en' ? 'Own Products' : 'Produse Branduri Proprii'}</h1>
                    <p style={{ margin: '3px 0 0', fontSize: '12px', color: colors.textSecondary }}>
                        Organizate pe oras si restaurant · {products.length} {lang === 'ru' ? 'записей' : lang === 'en' ? 'records' : 'inregistrari'} · {totalUnique} {lang === 'ru' ? 'уник. продуктов' : lang === 'en' ? 'unique products' : 'produse unice'} · {totalRestaurants} restaurante
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input type="date" value={snapshotDate} onChange={e => setSnapshotDate(e.target.value)}
                        style={{ ...sel, fontSize: '13px' }} />
                    <button onClick={scanAll} disabled={scraping}
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '9px', border: 'none', background: scraping ? 'rgba(99,102,241,0.4)' : 'linear-gradient(135deg,#6366F1,#8B5CF6)', color: '#fff', fontSize: '13px', fontWeight: '700', cursor: scraping ? 'wait' : 'pointer', boxShadow: scraping ? 'none' : '0 3px 12px rgba(99,102,241,0.35)' }}>
                        {scraping ? <><SpinIcon /> Se scaneaza...</> : 'Scaneaza tot'}
                    </button>
                </div>
            </div>

            {/* Scan message */}
            {scanMsg && (
                <div style={{ marginBottom: '16px', padding: '10px 16px', borderRadius: '9px', background: scanMsg.ok ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', border: `1px solid ${scanMsg.ok ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)'}`, color: scanMsg.ok ? '#22c55e' : '#ef4444', fontSize: '13px', fontWeight: '600', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span>{scanMsg.text}</span>
                    <button onClick={() => setScanMsg(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontSize: '16px' }}>×</button>
                </div>
            )}



            <>
                    {/* Filter bar */}
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '20px', padding: '10px 14px', borderRadius: '10px', background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)', border: `1px solid ${isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)'}` }}>
                        <select value={selectedBrand} onChange={e => setSelectedBrand(e.target.value)} style={sel}>
                            <option value="all">{lang === 'ru' ? 'Все бренды' : lang === 'en' ? 'All brands' : 'Toate brandurile'}</option>
                            {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                        </select>
                        <select value={selectedPlatform} onChange={e => setSelectedPlatform(e.target.value)} style={sel}>
                            <option value="all">{lang === 'ru' ? 'Все платформы' : lang === 'en' ? 'All platforms' : 'Toate platformele'}</option>
                            <option value="wolt">Wolt</option>
                            <option value="glovo">Glovo</option>
                            <option value="bolt">Bolt</option>
                        </select>
                        <select value={selectedCity} onChange={e => setSelectedCity(e.target.value)} style={sel}>
                            <option value="all">{lang === 'ru' ? 'Все города' : lang === 'en' ? 'All cities' : 'Toate orasele'}</option>
                            {cities.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                        <input value={search} onChange={e => setSearch(e.target.value)} placeholder={lang === 'ru' ? 'Поиск продукта...' : lang === 'en' ? 'Search product...' : 'Cauta produs...'}
                            style={{ ...sel, minWidth: '160px' }} />
                        {/* Food/Drink toggle */}
                        <div style={{ display: 'flex', gap: '3px', padding: '3px', background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)', borderRadius: '8px' }}>
                            {[['all', 'Toate'], ['food', 'Mancare'], ['drink', 'Bauturi']].map(([v, l]) => (
                                <button key={v} onClick={() => setTypeFilter(v)} style={{ padding: '4px 10px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '11px', fontWeight: '700', background: typeFilter === v ? '#6366F1' : 'transparent', color: typeFilter === v ? '#fff' : colors.textSecondary, transition: 'all 0.12s' }}>{l}</button>
                            ))}
                        </div>
                        {/* Expand/collapse all */}
                        <div style={{ marginLeft: 'auto', display: 'flex', gap: '6px' }}>
                            <button onClick={() => setCollapsedCities({})} style={{ fontSize: '11px', padding: '4px 10px', borderRadius: '7px', border: `1px solid ${colors.border}`, background: 'transparent', cursor: 'pointer', color: colors.textSecondary }}>{lang === 'ru' ? 'Развернуть всё' : lang === 'en' ? 'Expand all' : 'Extinde tot'}</button>
                            <button onClick={() => {
                                const all = {}
                                grouped.forEach(g => { all[g.city] = true; g.restaurants.forEach(r => { all[r.rid] = true }) })
                                setCollapsedCities(all); setCollapsedRestaurants(all)
                            }} style={{ fontSize: '11px', padding: '4px 10px', borderRadius: '7px', border: `1px solid ${colors.border}`, background: 'transparent', cursor: 'pointer', color: colors.textSecondary }}>{lang === 'ru' ? 'Свернуть всё' : lang === 'en' ? 'Collapse all' : 'Restringe tot'}</button>
                        </div>
                    </div>

                    {/* Loading */}
                    {loading ? (
                        <div style={{ textAlign: 'center', padding: '80px', color: colors.textSecondary }}>
                            <div style={{ width: 36, height: 36, border: `3px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}`, borderTopColor: '#6366F1', borderRadius: '50%', animation: 'spin 0.7s linear infinite', margin: '0 auto 16px' }} />
                            <div>{lang === 'ru' ? 'Загрузка...' : lang === 'en' ? 'Loading...' : 'Se incarca...'}</div>
                        </div>
                    ) : grouped.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '80px', color: colors.textSecondary, background: isDark ? 'rgba(255,255,255,0.02)' : '#fff', border: `1px solid ${isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)'}`, borderRadius: '14px' }}>
                            <div style={{ fontSize: '14px', fontWeight: '600', color: colors.text, marginBottom: '8px' }}>{lang === 'ru' ? 'Нет продуктов для ' : lang === 'en' ? 'No products for ' : 'Niciun produs pentru '}{snapshotDate}</div>
                            <div style={{ fontSize: '12px', marginBottom: '20px' }}>{lang === 'ru' ? 'Нажмите \'Сканировать всё\', чтобы получить продукты с платформ.' : lang === 'en' ? 'Press \'Scan All\' to fetch products from platforms.' : 'Apasa "Scaneaza tot" pentru a aduce produsele de pe platforme.'}</div>
                            <button onClick={scanAll} style={{ padding: '9px 22px', borderRadius: '9px', border: 'none', background: 'linear-gradient(135deg,#6366F1,#8B5CF6)', color: '#fff', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}>{lang === 'ru' ? 'Сканировать всё' : lang === 'en' ? 'Scan All' : 'Scaneaza tot'}</button>
                        </div>
                    ) : (
                        grouped.map(({ city, restaurants: cityRests }) => {
                            const cityCollapsed = collapsedCities[city]
                            const totalProds = cityRests.reduce((s, r) => s + r.products.length, 0)
                            return (
                                <div key={city} style={{ marginBottom: '16px' }}>
                                    {/* City header */}
                                    <button onClick={() => toggleCity(city)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 16px', background: isDark ? 'rgba(99,102,241,0.1)' : 'rgba(99,102,241,0.07)', border: `1px solid ${isDark ? 'rgba(99,102,241,0.2)' : 'rgba(99,102,241,0.15)'}`, borderRadius: cityCollapsed ? '10px' : '10px 10px 0 0', cursor: 'pointer', textAlign: 'left' }}>
                                        <span style={{ fontSize: '11px', color: '#6366F1', transform: cityCollapsed ? 'rotate(0deg)' : 'rotate(90deg)', transition: 'transform 0.15s', display: 'inline-block', lineHeight: 1 }}>▶</span>
                                        <span style={{ fontSize: '15px', fontWeight: '800', color: '#6366F1', flex: 1 }}>{city}</span>
                                        <span style={{ fontSize: '11px', color: colors.textSecondary, background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)', padding: '2px 8px', borderRadius: '10px' }}>
                                            {cityRests.length} {lang === 'ru' ? 'ресторанов ' : lang === 'en' ? 'restaurants ' : 'restaurante '}· {totalProds} produse
                                        </span>
                                    </button>

                                    {!cityCollapsed && (
                                        <div style={{ border: `1px solid ${isDark ? 'rgba(99,102,241,0.2)' : 'rgba(99,102,241,0.15)'}`, borderTop: 'none', borderRadius: '0 0 10px 10px', overflow: 'hidden' }}>
                                            {cityRests.map(({ rid, rest, products: restProds }, ri) => {
                                                const restCollapsed = collapsedRestaurants[rid]
                                                const hasWolt = rest?.wolt_url, hasGlovo = rest?.glovo_url, hasBolt = rest?.bolt_url
                                                const isLast = ri === cityRests.length - 1
                                                return (
                                                    <div key={rid} style={{ borderBottom: isLast ? 'none' : `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}` }}>
                                                        {/* Restaurant header */}
                                                        <div style={{ display: 'flex', alignItems: 'center', padding: '10px 16px', background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)', gap: '10px' }}>
                                                            <button onClick={() => toggleRest(rid)} style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'none', border: 'none', cursor: 'pointer', flex: 1, textAlign: 'left', padding: 0 }}>
                                                                <span style={{ fontSize: '10px', color: colors.textSecondary, transform: restCollapsed ? 'rotate(0deg)' : 'rotate(90deg)', transition: 'transform 0.15s', display: 'inline-block' }}>▶</span>
                                                                {rest?.brands?.logo_url
                                                                    ? <img src={rest.brands.logo_url} alt="" style={{ width: 28, height: 28, borderRadius: '7px', objectFit: 'cover', flexShrink: 0 }} />
                                                                    : <div style={{ width: 28, height: 28, borderRadius: '7px', background: '#6366F1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg></div>}
                                                                <div>
                                                                    <div style={{ fontSize: '13px', fontWeight: '700', color: colors.text }}>{rest?.name || 'Restaurant'}</div>
                                                                    <div style={{ fontSize: '11px', color: colors.textSecondary, display: 'flex', gap: '4px', marginTop: '1px' }}>
                                                                        {hasWolt && <span style={{ color: PLATFORM_COLORS.wolt, fontWeight: '700' }}>Wolt</span>}
                                                                        {hasWolt && (hasGlovo || hasBolt) && <span>·</span>}
                                                                        {hasGlovo && <span style={{ color: PLATFORM_COLORS.glovo, fontWeight: '700' }}>Glovo</span>}
                                                                        {hasGlovo && hasBolt && <span>·</span>}
                                                                        {hasBolt && <span style={{ color: PLATFORM_COLORS.bolt, fontWeight: '700' }}>Bolt</span>}
                                                                    </div>
                                                                </div>
                                                                <span style={{ fontSize: '11px', color: colors.textSecondary, marginLeft: 'auto', background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)', padding: '2px 8px', borderRadius: '8px' }}>
                                                                    {restProds.length} produse
                                                                </span>
                                                            </button>
                                                            {/* Per-restaurant scan button */}
                                                            <button onClick={() => scanOne(rid)} disabled={scrapingId === rid}
                                                                style={{ fontSize: '11px', padding: '4px 10px', borderRadius: '7px', border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`, background: 'transparent', cursor: scrapingId === rid ? 'wait' : 'pointer', color: '#6366F1', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '5px', whiteSpace: 'nowrap', flexShrink: 0 }}>
                                                                {scrapingId === rid ? <><SpinIcon /> Scraping...</> : 'Scaneaza'}
                                                            </button>
                                                        </div>

                                                        {/* Products grid */}
                                                        {!restCollapsed && (
                                                            <div style={{ padding: '12px 16px 16px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(175px, 1fr))', gap: '10px', background: isDark ? 'rgba(255,255,255,0.01)' : 'rgba(0,0,0,0.01)' }}>
                                                                {restProds.map(p => (
                                                                    <ProductCard key={p.id} p={p} isDark={isDark} colors={colors} />
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    )}
                                </div>
                            )
                        })
                    )}
            </>


            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
    )
}

function ProductCard({ p, isDark, colors }) {
    const drink = isDrink(p.category)
    // Find if at least one platform has promotion
    const isPromoted = p.platforms?.some(pl => pl.is_promoted)

    return (
        <div style={{ background: isDark ? 'rgba(255,255,255,0.04)' : '#fff', border: `1px solid ${isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)'}`, borderRadius: '10px', overflow: 'hidden', transition: 'transform 0.15s, box-shadow 0.15s' }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = isDark ? '0 6px 20px rgba(0,0,0,0.3)' : '0 6px 20px rgba(0,0,0,0.09)' }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none' }}>
            {/* Image */}
            <div style={{ height: 120, overflow: 'hidden', background: isDark ? (drink ? 'rgba(251,191,36,0.08)' : 'rgba(255,255,255,0.05)') : (drink ? 'rgba(251,191,36,0.06)' : 'rgba(0,0,0,0.04)'), position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {p.image_url
                    ? <img src={p.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        onError={e => { if (e.currentTarget.parentElement) e.currentTarget.parentElement.style.background = 'transparent'; e.currentTarget.style.display = 'none' }} />
                    : <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'} strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg>}
                
                {/* Platform Pills */}
                <div style={{ position: 'absolute', top: 6, right: 6, display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-end' }}>
                    {p.platforms?.map(plat => (
                        <span key={plat.platform} style={{ background: PLATFORM_COLORS[plat.platform] || '#888', color: '#fff', fontSize: '9px', fontWeight: '800', padding: '2px 5px', borderRadius: '4px', textTransform: 'uppercase', boxShadow: '0 2px 4px rgba(0,0,0,0.2)' }}>
                            {plat.platform}
                        </span>
                    ))}
                </div>

                {isPromoted && <span style={{ position: 'absolute', top: 6, left: 6, background: '#f59e0b', color: '#fff', fontSize: '9px', fontWeight: '800', padding: '2px 6px', borderRadius: '5px' }}>Promovat</span>}
                {drink && <span style={{ position: 'absolute', bottom: 6, left: 6, background: 'rgba(251,191,36,0.9)', color: '#78350f', fontSize: '9px', fontWeight: '800', padding: '2px 6px', borderRadius: '5px' }}>Bautura</span>}
            </div>
            {/* Info */}
            <div style={{ padding: '8px 10px 10px', display: 'flex', flexDirection: 'column', height: '100%' }}>
                {p.category && <div style={{ fontSize: '10px', color: colors.textSecondary, fontWeight: '600', marginBottom: '2px', textTransform: 'uppercase', letterSpacing: '0.3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.category}</div>}
                <div style={{ fontSize: '12px', fontWeight: '700', color: colors.text, lineHeight: 1.3, marginBottom: '6px', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{p.product_name}</div>
                
                <div style={{ marginTop: 'auto', paddingTop: '4px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                    {p.platforms?.map(plat => (
                        <div key={plat.platform} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)', padding: '3px 6px', borderRadius: '5px' }}>
                            <span style={{ fontSize: '10px', fontWeight: '700', color: PLATFORM_COLORS[plat.platform] || colors.textSecondary, textTransform: 'uppercase' }}>{plat.platform}</span>
                            <span style={{ fontSize: '13px', fontWeight: '800', color: '#6366F1' }}>{plat.price ? `${Number(plat.price).toFixed(2)} RON` : '—'}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}
