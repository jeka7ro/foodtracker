import React, { useState, useEffect, useCallback } from 'react'
import { useTheme } from '../lib/ThemeContext'
import { useLanguage } from '../lib/LanguageContext'
import { supabase } from '../lib/supabaseClient'
import { getSmartSearchWords } from '../lib/searchUtils'

const PLATFORM_COLORS = { glovo: '#FFA500', wolt: '#009de0', bolt: '#34D399' }
const PLATFORM_ICONS = {
    glovo: '🟠', wolt: '🔵', bolt: '🟢'
}
const WORKER_URL = import.meta.env.VITE_WORKER_URL || null

function ProductCard({ p, colors, isDark, onOpenModal }) {
    const [imgError, setImgError] = useState(false)
    const [imgLoaded, setImgLoaded] = useState(false)
    const [useProxy, setUseProxy] = useState(false)

    const platformColor = PLATFORM_COLORS[p.platform] || '#8B5CF6'
    const hasImage = p.image_url && !imgError
    // Use direct URL first; if it fails and worker exists, try proxy
    const directUrl = p.image_url || null
    const proxyUrl = (p.image_url && WORKER_URL) ? `${WORKER_URL}/api/img?url=${encodeURIComponent(p.image_url)}` : null
    const imageSrc = useProxy ? proxyUrl : directUrl

    const handleImgError = () => {
        if (!useProxy && proxyUrl) {
            // Direct failed, try proxy
            setUseProxy(true)
        } else {
            // Both failed
            setImgError(true)
        }
    }

    return (
        <div 
            onClick={() => onOpenModal(p, imageSrc)}
            style={{
                borderRadius: '16px',
                overflow: 'hidden',
                background: isDark ? 'rgba(255,255,255,0.04)' : '#fff',
                border: `1px solid ${isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)'}`,
                display: 'flex', flexDirection: 'column',
                transition: 'transform 0.18s, box-shadow 0.18s',
                cursor: 'pointer',
                color: 'inherit'
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 12px 32px rgba(0,0,0,0.13)' }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none' }}
        >
            {/* Image */}
            <div style={{ position: 'relative', height: 160, background: isDark ? 'rgba(255,255,255,0.06)' : '#f5f5f7', overflow: 'hidden', flexShrink: 0 }}>
                {hasImage ? (
                    <>
                        {!imgLoaded && (
                            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '32px', opacity: 0.15 }}>🍽️</div>
                        )}
                        <img
                            src={imageSrc}
                            alt={p.product_name}
                            onError={handleImgError}
                            onLoad={() => setImgLoaded(true)}
                            referrerPolicy="no-referrer"
                            style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: imgLoaded ? 1 : 0, transition: 'opacity 0.3s' }}
                        />
                    </>
                ) : (
                    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '36px', opacity: 0.18 }}>🍽️</span>
                        <span style={{ fontSize: '10px', color: colors.textSecondary, opacity: 0.5 }}>No image</span>
                    </div>
                )}
                {/* Platform badge */}
                <div style={{
                    position: 'absolute', top: 8, left: 8,
                    background: platformColor, color: '#fff',
                    fontSize: '10px', fontWeight: '700', padding: '2px 7px',
                    borderRadius: '6px', letterSpacing: '0.3px', textTransform: 'uppercase'
                }}>
                    {p.platform}
                </div>
                {p.is_promoted && (
                    <div style={{
                        position: 'absolute', top: 8, right: 8,
                        background: 'linear-gradient(135deg,#f59e0b,#ef4444)', color: '#fff',
                        fontSize: '9px', fontWeight: '800', padding: '2px 6px',
                        borderRadius: '5px', letterSpacing: '0.5px'
                    }}>★ PROMO</div>
                )}
            </div>

            {/* Content */}
            <div style={{ padding: '12px 14px', flex: 1, display: 'flex', flexDirection: 'column', gap: '5px' }}>
                {p.category && (
                    <div style={{ fontSize: '10px', fontWeight: '600', color: platformColor, textTransform: 'uppercase', letterSpacing: '0.5px', opacity: 0.8 }}>
                        {p.category}
                    </div>
                )}
                <div style={{ fontSize: '13px', fontWeight: '700', color: colors.text, lineHeight: 1.3, flex: 1 }}>
                    {p.product_name}
                </div>
                {p.description && (
                    <div style={{ fontSize: '11px', color: colors.textSecondary, lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {p.description}
                    </div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '4px' }}>
                    <div style={{ fontSize: '16px', fontWeight: '800', color: '#6366F1' }}>
                        {p.price?.toFixed(2)} <span style={{ fontSize: '11px', fontWeight: '600', color: colors.textSecondary }}>RON</span>
                    </div>
                    <div style={{ fontSize: '10px', color: colors.textSecondary, textAlign: 'right', lineHeight: 1.3 }}>
                        <div style={{ fontWeight: '600', color: colors.text, fontSize: '11px', maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.restaurant_name}</div>
                        <div style={{ maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.city}</div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default function CompetitorProducts() {
    const { colors, isDark } = useTheme()
    const { lang } = useLanguage()
    const t = (ro, en, ru) => lang === 'ru' ? ru : (lang === 'en' ? en : ro)

    const [products, setProducts] = useState([])
    const [loading, setLoading] = useState(true)
    const [total, setTotal] = useState(0)
    const [selectedProduct, setSelectedProduct] = useState(null)

    // Filters
    const [search, setSearch] = useState('')
    const [filterPlatform, setFilterPlatform] = useState('')
    const [filterCity, setFilterCity] = useState('')
    const [filterCategory, setFilterCategory] = useState('')
    const [filterRestaurant, setFilterRestaurant] = useState('')
    const [sortBy, setSortBy] = useState('date') // 'date' | 'price_asc' | 'price_desc' | 'name'
    const [onlyWithImages, setOnlyWithImages] = useState(false)
    const [page, setPage] = useState(0)
    const PAGE_SIZE = 60

    // Available filter options derived from data
    const [cities, setCities] = useState([])
    const [categories, setCategories] = useState([])
    const [restaurants, setRestaurants] = useState([])

    const loadProducts = useCallback(async () => {
        setLoading(true)
        try {
            let query = supabase
                .from('competitor_products')
                .select(`
                    id, product_name, price, category, description, image_url, is_promoted,
                    platform, city, snapshot_date,
                    competitor_restaurants ( name, logo_url, rank_position, url )
                `, { count: 'exact' })
                .order('snapshot_date', { ascending: false })

            if (filterPlatform) query = query.eq('platform', filterPlatform)
            if (filterCity) query = query.eq('city', filterCity)
            if (filterCategory) query = query.ilike('category', `%${filterCategory}%`)
            if (filterRestaurant) query = query.ilike('competitor_restaurants.name', `%${filterRestaurant}%`)
            if (onlyWithImages) query = query.not('image_url', 'is', null)
            if (search) {
                const searchWords = getSmartSearchWords(search)
                if (searchWords.length > 0) {
                    searchWords.forEach(w => {
                        query = query.ilike('product_name', `%${w}%`)
                    })
                }
            }

            if (sortBy === 'price_asc') query = query.order('price', { ascending: true })
            else if (sortBy === 'price_desc') query = query.order('price', { ascending: false })
            else if (sortBy === 'name') query = query.order('product_name', { ascending: true })

            query = query.range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)

            const { data, count, error } = await query
            if (error) { console.error('[CompetitorProducts]', error.message); setLoading(false); return }

            const rows = (data || []).map(p => {
                const rest = Array.isArray(p.competitor_restaurants) ? p.competitor_restaurants[0] : p.competitor_restaurants
                return {
                    ...p,
                    restaurant_name: rest?.name || '—',
                    restaurant_url: rest?.url || null,
                }
            })

            setProducts(rows)
            setTotal(count || 0)

            // Extract unique filter values from this batch
            if (page === 0) {
                const allCities = [...new Set(rows.map(r => r.city).filter(Boolean))].sort()
                const allCats = [...new Set(rows.map(r => r.category).filter(Boolean))].sort()
                const allRests = [...new Set(rows.map(r => r.restaurant_name).filter(r => r !== '—'))].sort()
                if (allCities.length) setCities(prev => [...new Set([...prev, ...allCities])].sort())
                if (allCats.length) setCategories(prev => [...new Set([...prev, ...allCats])].sort())
                if (allRests.length) setRestaurants(prev => [...new Set([...prev, ...allRests])].sort())
            }
        } catch (e) { console.error(e) }
        finally { setLoading(false) }
    }, [filterPlatform, filterCity, filterCategory, filterRestaurant, onlyWithImages, search, sortBy, page])

    useEffect(() => { loadProducts() }, [loadProducts])

    // Load global filters
    useEffect(() => {
        const loadGlobalFilters = async () => {
            // Cities come from competitor_products (the correct table with city column)
            const { data: cpData } = await supabase.from('competitor_products').select('city').limit(50000)
            if (cpData) {
                const ac = [...new Set(cpData.map(d => d.city).filter(Boolean))].sort()
                setCities(prev => [...new Set([...prev, ...ac])].sort())
            }
            // Restaurant names from competitor_restaurants
            const { data: crData } = await supabase.from('competitor_restaurants').select('name')
            if (crData) {
                const ar = [...new Set(crData.map(d => d.name).filter(Boolean))].sort()
                setRestaurants(prev => [...new Set([...prev, ...ar])].sort())
            }
        }
        loadGlobalFilters()
    }, [])

    // Reset page on filter change
    useEffect(() => { setPage(0) }, [filterPlatform, filterCity, filterCategory, filterRestaurant, onlyWithImages, search, sortBy])

    const glass = {
        background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.85)',
        backdropFilter: 'blur(20px)', border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)'}`,
        borderRadius: '14px',
    }

    const selectStyle = {
        padding: '7px 10px', borderRadius: '9px', border: `1px solid ${colors.border}`,
        background: isDark ? 'rgba(255,255,255,0.06)' : '#f5f5f7', color: colors.text,
        fontSize: '12px', fontWeight: '500', cursor: 'pointer', outline: 'none',
    }

    const totalPages = Math.ceil(total / PAGE_SIZE)

    return (
        <div style={{ padding: '24px 28px', maxWidth: 1400, margin: '0 auto' }}>
            <style>{`
                @keyframes spin { to { transform: rotate(360deg); } }
                @keyframes fadeIn { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:none; } }
            `}</style>

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '22px', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                    <h1 style={{ margin: 0, fontSize: '22px', fontWeight: '800', color: colors.text, letterSpacing: '-0.5px' }}>
                        🛒 {t('Produse Concurenți', 'Competitor Products', 'Продукты конкурентов')}
                    </h1>
                    <p style={{ margin: '4px 0 0', fontSize: '13px', color: colors.textSecondary }}>
                        {loading ? '…' : `${total.toLocaleString()} ${t('produse din toate platformele', 'products across all platforms', 'продуктов на всех платформах')}`}
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                    {['glovo', 'wolt', 'bolt'].map(p => (
                        <button key={p} onClick={() => setFilterPlatform(filterPlatform === p ? '' : p)}
                            style={{
                                padding: '6px 14px', borderRadius: '8px', border: `2px solid ${filterPlatform === p ? PLATFORM_COLORS[p] : 'transparent'}`,
                                background: filterPlatform === p ? `${PLATFORM_COLORS[p]}22` : (isDark ? 'rgba(255,255,255,0.06)' : '#f5f5f7'),
                                color: filterPlatform === p ? PLATFORM_COLORS[p] : colors.textSecondary,
                                fontSize: '12px', fontWeight: '700', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.5px'
                            }}>
                            {PLATFORM_ICONS[p]} {p}
                        </button>
                    ))}
                </div>
            </div>

            {/* Filters bar */}
            <div style={{ ...glass, padding: '14px 18px', marginBottom: '20px', display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                {/* Search */}
                <div style={{ position: 'relative', flex: '1 1 200px', minWidth: 160 }}>
                    <svg style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: colors.textSecondary }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
                    <input
                        value={search} onChange={e => setSearch(e.target.value)}
                        placeholder={t('Caută produs…', 'Search product…', 'Поиск продукта…')}
                        style={{ ...selectStyle, width: '100%', paddingLeft: 28, boxSizing: 'border-box' }}
                    />
                </div>

                <select value={filterCity} onChange={e => setFilterCity(e.target.value)} style={selectStyle}>
                    <option value="">{t('Toate orașele', 'All cities', 'Все города')}</option>
                    {cities.map(c => <option key={c} value={c}>{c}</option>)}
                </select>

                <select value={filterRestaurant} onChange={e => setFilterRestaurant(e.target.value)} style={selectStyle}>
                    <option value="">{t('Toate brandurile', 'All brands', 'Все бренды')}</option>
                    {restaurants.map(r => <option key={r} value={r}>{r}</option>)}
                </select>

                <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} style={selectStyle}>
                    <option value="">{t('Toate categoriile', 'All categories', 'Все категории')}</option>
                    {categories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>

                <select value={sortBy} onChange={e => setSortBy(e.target.value)} style={selectStyle}>
                    <option value="date">{t('Cele mai noi', 'Most recent', 'Самые новые')}</option>
                    <option value="price_asc">{t('Preț: mic → mare', 'Price: low → high', 'Цена: по возрастанию')}</option>
                    <option value="price_desc">{t('Preț: mare → mic', 'Price: high → low', 'Цена: по убыванию')}</option>
                    <option value="name">{t('Nume A-Z', 'Name A-Z', 'Имя А-Я')}</option>
                </select>

                <label style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '12px', fontWeight: '600', color: colors.text, cursor: 'pointer', userSelect: 'none' }}>
                    <input type="checkbox" checked={onlyWithImages} onChange={e => setOnlyWithImages(e.target.checked)}
                        style={{ width: 15, height: 15, accentColor: '#6366F1' }} />
                    {t('Doar cu poze', 'With images only', 'Только с фото')}
                </label>

                {(filterPlatform || filterCity || filterCategory || search || onlyWithImages) && (
                    <button onClick={() => { setFilterPlatform(''); setFilterCity(''); setFilterCategory(''); setSearch(''); setOnlyWithImages(false) }}
                        style={{ ...selectStyle, color: '#ef4444', borderColor: '#ef4444', background: 'rgba(239,68,68,0.08)' }}>
                        ✕ {t('Resetează', 'Reset', 'Сбросить')}
                    </button>
                )}
            </div>

            {/* Loading */}
            {loading && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px 0', gap: '12px' }}>
                    <svg style={{ animation: 'spin 1s linear infinite', color: '#6366F1' }} width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>
                    <span style={{ fontSize: '14px', color: colors.textSecondary }}>{t('Se încarcă produsele…', 'Loading products…', 'Загрузка продуктов…')}</span>
                </div>
            )}

            {/* Empty */}
            {!loading && products.length === 0 && (
                <div style={{ textAlign: 'center', padding: '80px 0' }}>
                    <div style={{ fontSize: '48px', marginBottom: '16px' }}>🛒</div>
                    <div style={{ fontSize: '16px', fontWeight: '700', color: colors.text, marginBottom: '8px' }}>
                        {t('Nu există produse', 'No products found', 'Продукты не найдены')}
                    </div>
                    <div style={{ fontSize: '13px', color: colors.textSecondary }}>
                        {t('Rulează o căutare din pagina Intelligence Competitiv pentru a scrapa produse.', 'Run a search from the Competitive Intelligence page to scrape products.', 'Запустите поиск на странице конкурентного анализа, чтобы собрать продукты.')}
                    </div>
                </div>
            )}

            {/* Grid */}
            {!loading && products.length > 0 && (
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                    gap: '16px',
                    animation: 'fadeIn 0.3s ease',
                }}>
                    {products.map(p => (
                        <ProductCard key={p.id} p={p} colors={colors} isDark={isDark} onOpenModal={(prod, proxImage) => setSelectedProduct({ ...prod, proxyImage: proxImage })} />
                    ))}
                </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px', marginTop: '32px' }}>
                    <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
                        style={{ ...selectStyle, opacity: page === 0 ? 0.4 : 1, padding: '8px 16px' }}>
                        ← {t('Anterior', 'Prev', 'Нaза́д')}
                    </button>
                    <span style={{ fontSize: '13px', color: colors.textSecondary, fontWeight: '600' }}>
                        {t('Pagina', 'Page', 'Страница')} {page + 1} / {totalPages}
                    </span>
                    <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
                        style={{ ...selectStyle, opacity: page >= totalPages - 1 ? 0.4 : 1, padding: '8px 16px' }}>
                        {t('Următor', 'Next', 'Вперед')} →
                    </button>
                </div>
            )}

            {/* Modal for Product Details */}
            {selectedProduct && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
                    <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }} onClick={() => setSelectedProduct(null)}></div>
                    <div style={{ position: 'relative', width: '100%', maxWidth: '500px', background: isDark ? '#1e1e20' : '#ffffff', borderRadius: '24px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)', overflow: 'hidden', border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}` }}>
                        {selectedProduct.proxyImage && (
                            <div style={{ position: 'relative', width: '100%', height: '260px', background: isDark ? 'rgba(255,255,255,0.05)' : '#f1f5f9' }}>
                                <img src={selectedProduct.proxyImage} alt={selectedProduct.product_name} referrerPolicy="no-referrer" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'linear-gradient(to bottom, transparent 60%, rgba(0,0,0,0.6) 100%)' }}></div>
                            </div>
                        )}
                        <button onClick={() => setSelectedProduct(null)} style={{ position: 'absolute', top: '16px', right: '16px', width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(0,0,0,0.5)', color: '#fff', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2, backdropFilter: 'blur(4px)' }}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                        </button>
                        
                        <div style={{ position: 'absolute', top: '16px', left: '16px', background: PLATFORM_COLORS[selectedProduct.platform] || '#6366F1', color: '#fff', padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px', zIndex: 2, backdropFilter: 'blur(4px)', boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}>
                            {selectedProduct.platform}
                        </div>

                        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div>
                                <h2 style={{ margin: '0 0 8px 0', fontSize: '22px', fontWeight: '800', color: colors.text, letterSpacing: '-0.3px', lineHeight: 1.2 }}>{selectedProduct.product_name}</h2>
                                {selectedProduct.description && (
                                    <p style={{ margin: 0, fontSize: '13px', color: colors.textSecondary, lineHeight: 1.5 }}>{selectedProduct.description}</p>
                                )}
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                <span style={{ fontSize: '12px', background: isDark ? 'rgba(255,255,255,0.06)' : '#f1f5f9', color: colors.textSecondary, padding: '4px 10px', borderRadius: '12px', fontWeight: '600' }}>{selectedProduct.restaurant_name}</span>
                                {selectedProduct.category && <span style={{ fontSize: '12px', background: isDark ? 'rgba(255,255,255,0.06)' : '#f1f5f9', color: colors.textSecondary, padding: '4px 10px', borderRadius: '12px', fontWeight: '600' }}>{selectedProduct.category}</span>}
                                {selectedProduct.city && <span style={{ fontSize: '12px', background: isDark ? 'rgba(255,255,255,0.06)' : '#f1f5f9', color: colors.textSecondary, padding: '4px 10px', borderRadius: '12px', fontWeight: '600' }}>📍 {selectedProduct.city}</span>}
                            </div>
                            
                            <div style={{ background: isDark ? 'rgba(255,255,255,0.03)' : '#f9fafb', border: `1px solid ${colors.border}`, borderRadius: '16px', padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <div>
                                    <div style={{ fontSize: '12px', color: colors.textSecondary, marginBottom: '2px', fontWeight: '500' }}>{lang === 'ru' ? 'Текущая цена' : (lang === 'en' ? 'Current Price' : 'Preț Curent')}</div>
                                    <div style={{ fontSize: '20px', fontWeight: '800', color: '#2bbec8' }}>{selectedProduct.price?.toFixed(2)} RON</div>
                                </div>
                            </div>
                            
                            <div style={{ display: 'flex', gap: '12px', marginTop: '4px' }}>
                                <a href={`/marketing?tab=prices&detail=${encodeURIComponent(selectedProduct.restaurant_name)}`} 
                                    style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '12px', background: isDark ? 'rgba(255,255,255,0.08)' : '#f1f5f9', borderRadius: '12px', color: colors.text, textDecoration: 'none', fontSize: '13px', fontWeight: '700', transition: 'all 0.2s', border: `1px solid ${colors.border}` }}
                                    onMouseOver={e => { e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.12)' : '#e2e8f0' }}
                                    onMouseOut={e => { e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.08)' : '#f1f5f9' }}>
                                    {lang === 'ru' ? 'История / Цены' : lang === 'en' ? 'History / Prices' : 'Istoric / Prețuri'}
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6" /></svg>
                                </a>
                                {selectedProduct.restaurant_url && (
                                    <a href={selectedProduct.restaurant_url} target="_blank" rel="noopener noreferrer"
                                        style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '12px', background: PLATFORM_COLORS[selectedProduct.platform] || '#2bbec8', border: 'none', borderRadius: '12px', color: '#fff', textDecoration: 'none', fontSize: '13px', fontWeight: '700', transition: 'opacity 0.2s' }}
                                        onMouseOver={e => e.currentTarget.style.opacity = '0.9'}
                                        onMouseOut={e => e.currentTarget.style.opacity = '1'}>
                                        {lang === 'ru' ? 'Открыть на платформе' : lang === 'en' ? 'Open on Platform' : 'Deschide pe Platf.'}
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                                    </a>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
