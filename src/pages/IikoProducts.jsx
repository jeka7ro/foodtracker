import { useState, useEffect, useCallback, useMemo } from 'react'
import { useTheme } from '../lib/ThemeContext'
import { useLanguage } from '../lib/LanguageContext'
import { supabase } from '../lib/supabaseClient'

const WORKER_URL = import.meta.env.VITE_WORKER_URL || 'http://localhost:3001'

const SpinIcon = () => (
    <span style={{ display: 'inline-block', width: 13, height: 13, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
)

const SpinIconSmall = () => (
    <span style={{ display: 'inline-block', width: 10, height: 10, border: '2px solid rgba(99,102,241,0.3)', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
)

export default function IikoProducts() {
    const { colors, isDark } = useTheme()
    const { lang } = useLanguage()
    
    const [brands, setBrands] = useState([])
    const [restaurants, setRestaurants] = useState([])
    
    // Read initial products from localStorage
    const [products, setProducts] = useState(() => {
        try {
            const cached = localStorage.getItem('iiko_products_cache')
            return cached ? JSON.parse(cached) : []
        } catch(e) { return [] }
    })
    
    // Background sync state
    const [isSyncing, setIsSyncing] = useState(false)
    const [errorMsg, setErrorMsg] = useState(null)
    const [lastSync, setLastSync] = useState(() => {
        return localStorage.getItem('iiko_products_last_sync') || null
    })

    // Filters
    const [selectedBrand, setSelectedBrand] = useState('all')
    const [selectedCity, setSelectedCity] = useState('all')
    const [search, setSearch] = useState('')
    
    // Pagination
    const [pageSize, setPageSize] = useState(50)
    const [currentPage, setCurrentPage] = useState(1)

    useEffect(() => {
        Promise.all([
            supabase.from('brands').select('id, name, logo_url').order('name'),
            supabase.from('restaurants').select('id, name, city, brand_id, is_active, brands(name, logo_url), iiko_config').not('iiko_config', 'is', null).eq('is_active', true).order('name')
        ]).then(([{ data: b }, { data: r }]) => {
            setBrands(b || [])
            setRestaurants(r || [])
        })
    }, [])

    const cities = useMemo(() => [...new Set(restaurants.map(r => r.city).filter(Boolean))].sort(), [restaurants])

    const loadProducts = useCallback(async (background = false) => {
        setIsSyncing(true)
        if (!background) setErrorMsg(null)
        try {
            // Fetch everything and filter locally for better UX
            const res = await fetch(`${WORKER_URL}/api/pos/products`)
            const data = await res.json()
            if (!data.success) throw new Error(data.error || data.message || 'Eroare la preluarea datelor')
            
            setProducts(data.results || [])
            localStorage.setItem('iiko_products_cache', JSON.stringify(data.results || []))
            
            const now = new Date().toLocaleString()
            setLastSync(now)
            localStorage.setItem('iiko_products_last_sync', now)
        } catch (err) {
            if (!background) setErrorMsg(err.message)
        } finally {
            setIsSyncing(false)
        }
    }, [])

    useEffect(() => {
        const cached = localStorage.getItem('iiko_products_cache')
        if (!cached || JSON.parse(cached).length === 0) {
            loadProducts(false)
        } else {
            loadProducts(true)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
    
    // Reset page when filters change
    useEffect(() => {
        setCurrentPage(1)
    }, [selectedBrand, selectedCity, search, pageSize])

    // Filter products
    const filteredProducts = useMemo(() => {
        let list = products
        
        if (selectedCity !== 'all') {
            list = list.filter(p => p.city === selectedCity)
        }
        
        if (selectedBrand !== 'all') {
            const brand = brands.find(b => b.id === selectedBrand)
            if (brand) {
                list = list.filter(p => p.brand_name === brand.name)
            }
        }
        
        if (search) {
            const q = search.toLowerCase().trim()
            list = list.filter(p => 
                (p.name || '').toLowerCase().includes(q) || 
                (p.category || '').toLowerCase().includes(q) ||
                (p.sku || '').toLowerCase().includes(q)
            )
        }
        
        // Sort by brand
        return list.sort((a, b) => {
            const bA = a.brand_name || ''
            const bB = b.brand_name || ''
            if (bA !== bB) return bA.localeCompare(bB)
            
            const cA = a.city || ''
            const cB = b.city || ''
            if (cA !== cB) return cA.localeCompare(cB)
            
            const rA = a.restaurant_name || ''
            const rB = b.restaurant_name || ''
            if (rA !== rB) return rA.localeCompare(rB)
            
            return (a.name || '').localeCompare(b.name || '')
        })
    }, [products, search, selectedCity, selectedBrand, brands])

    const totalPages = Math.ceil(filteredProducts.length / pageSize) || 1
    const paginatedProducts = filteredProducts.slice((currentPage - 1) * pageSize, currentPage * pageSize)

    const sel = { padding: '7px 10px', borderRadius: '8px', border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`, background: isDark ? 'rgba(255,255,255,0.05)' : '#fff', color: colors.text, fontSize: '13px', cursor: 'pointer', outline: 'none' }
    
    // Brand filter rendering
    const BrandFilter = () => {
        return (
            <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '8px', marginBottom: '16px', msOverflowStyle: 'none', scrollbarWidth: 'none' }}>
                <button 
                    onClick={() => setSelectedBrand('all')}
                    style={{
                        padding: '8px 16px', borderRadius: '12px', border: `1px solid ${selectedBrand === 'all' ? '#6366f1' : isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
                        background: selectedBrand === 'all' ? (isDark ? 'rgba(99,102,241,0.2)' : 'rgba(99,102,241,0.1)') : (isDark ? 'rgba(255,255,255,0.03)' : '#fff'),
                        color: selectedBrand === 'all' ? '#6366f1' : colors.textSecondary,
                        fontWeight: selectedBrand === 'all' ? '700' : '500', cursor: 'pointer', whiteSpace: 'nowrap',
                        display: 'flex', alignItems: 'center'
                    }}
                >
                    {lang === 'ru' ? 'Все бренды' : lang === 'en' ? 'All brands' : 'Toate brandurile'}
                </button>
                {brands.map(b => (
                    <button 
                        key={b.id} 
                        onClick={() => setSelectedBrand(b.id)}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '8px',
                            padding: '6px 14px', borderRadius: '12px', 
                            border: `1px solid ${selectedBrand === b.id ? '#6366f1' : isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
                            background: selectedBrand === b.id ? (isDark ? 'rgba(99,102,241,0.2)' : 'rgba(99,102,241,0.1)') : (isDark ? 'rgba(255,255,255,0.03)' : '#fff'),
                            color: selectedBrand === b.id ? '#6366f1' : colors.textSecondary,
                            fontWeight: selectedBrand === b.id ? '700' : '500', cursor: 'pointer', whiteSpace: 'nowrap'
                        }}
                    >
                        {b.logo_url ? (
                            <img src={b.logo_url} alt={b.name} style={{ width: 24, height: 24, borderRadius: '50%', objectFit: 'cover' }} />
                        ) : (
                            <div style={{ width: 24, height: 24, borderRadius: '50%', background: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }} />
                        )}
                        {b.name}
                    </button>
                ))}
            </div>
        )
    }

    return (
        <div style={{ padding: '24px 28px', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '20px', gap: '12px', flexWrap: 'wrap' }}>
                <div>
                    <h1 style={{ margin: 0, fontSize: '20px', fontWeight: '800', color: colors.text, letterSpacing: '-0.4px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                        {lang === 'ru' ? 'Продукты POS (iiko)' : lang === 'en' ? 'POS Products (iiko)' : 'Produse POS (iiko)'}
                        {isSyncing && (
                            <div style={{ fontSize: '11px', fontWeight: '500', color: '#6366f1', background: 'rgba(99,102,241,0.1)', padding: '4px 10px', borderRadius: '20px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <SpinIconSmall />
                                {lang === 'ru' ? 'Синхронизация...' : lang === 'en' ? 'Syncing...' : 'Sincronizare în fundal...'}
                            </div>
                        )}
                    </h1>
                    <p style={{ margin: '3px 0 0', fontSize: '12px', color: colors.textSecondary }}>
                        {lang === 'ru' ? 'Синхронизация в реальном времени из iiko. ' : lang === 'en' ? 'Realtime sync from iiko. ' : 'Sincronizare în timp real din iiko. '}
                        {lastSync && `Ultima sincronizare: ${lastSync}`}
                    </p>
                </div>
                <button onClick={() => loadProducts(false)} disabled={isSyncing}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '9px', border: 'none', background: isSyncing ? 'rgba(99,102,241,0.4)' : 'linear-gradient(135deg,#6366F1,#8B5CF6)', color: '#fff', fontSize: '13px', fontWeight: '700', cursor: isSyncing ? 'wait' : 'pointer', boxShadow: isSyncing ? 'none' : '0 3px 12px rgba(99,102,241,0.35)' }}>
                    {isSyncing ? <><SpinIcon /> Se sincronizează...</> : 'Forțează Sincronizarea'}
                </button>
            </div>

            {errorMsg && (
                <div style={{ padding: '10px 14px', borderRadius: '8px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', fontSize: '13px', fontWeight: '600', marginBottom: '16px' }}>
                    {errorMsg}
                </div>
            )}

            <BrandFilter />

            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', padding: '12px 16px', borderRadius: '12px', background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)', border: `1px solid ${isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)'}` }}>
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
                    <select value={selectedCity} onChange={e => setSelectedCity(e.target.value)} style={sel}>
                        <option value="all">{lang === 'ru' ? 'Все города' : lang === 'en' ? 'All cities' : 'Toate orașele'}</option>
                        {cities.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <input value={search} onChange={e => setSearch(e.target.value)} placeholder={lang === 'ru' ? 'Поиск продукта или кода...' : lang === 'en' ? 'Search product or code...' : 'Caută produs sau cod...'} style={{ ...sel, minWidth: '220px' }} />
                </div>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '13px', color: colors.textSecondary, fontWeight: '500' }}>
                        Total: {filteredProducts.length} produse
                    </span>
                    <select value={pageSize} onChange={e => setPageSize(Number(e.target.value))} style={{ ...sel, padding: '5px 8px' }}>
                        <option value={10}>10 / pagină</option>
                        <option value={20}>20 / pagină</option>
                        <option value={50}>50 / pagină</option>
                        <option value={100}>100 / pagină</option>
                        <option value={500}>500 / pagină</option>
                    </select>
                </div>
            </div>

            {products.length === 0 && !isSyncing ? (
                <div style={{ textAlign: 'center', padding: '60px', color: colors.textSecondary, background: isDark ? 'rgba(255,255,255,0.02)' : '#fff', borderRadius: '14px', border: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}` }}>
                    Apasă pe "Forțează Sincronizarea" pentru a aduce produsele.
                </div>
            ) : filteredProducts.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px', color: colors.textSecondary, background: isDark ? 'rgba(255,255,255,0.02)' : '#fff', borderRadius: '14px', border: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}` }}>
                    Nu au fost găsite produse pentru filtrele selectate.
                </div>
            ) : (
                <div style={{ flex: 1, background: isDark ? 'rgba(255,255,255,0.02)' : '#fff', borderRadius: '14px', border: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}`, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                            <thead style={{ background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)', borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}` }}>
                                <tr>
                                    <th style={{ padding: '12px 16px', fontWeight: '600', color: colors.textSecondary, width: '60px', textAlign: 'center' }}>Nr.</th>
                                    <th style={{ padding: '12px 16px', fontWeight: '600', color: colors.textSecondary, width: '70px', textAlign: 'center' }}>{lang === 'ru' ? 'Фото' : lang === 'en' ? 'Photo' : 'Poză'}</th>
                                    <th style={{ padding: '12px 16px', fontWeight: '600', color: colors.textSecondary }}>{lang === 'ru' ? 'Бренд / Ресторан' : lang === 'en' ? 'Brand / Restaurant' : 'Brand / Restaurant'}</th>
                                    <th style={{ padding: '12px 16px', fontWeight: '600', color: colors.textSecondary }}>{lang === 'ru' ? 'Продукт' : lang === 'en' ? 'Product' : 'Produs'}</th>
                                    <th style={{ padding: '12px 16px', fontWeight: '600', color: colors.textSecondary }}>{lang === 'ru' ? 'Категория' : lang === 'en' ? 'Category' : 'Categorie'}</th>
                                    <th style={{ padding: '12px 16px', fontWeight: '600', color: colors.textSecondary }}>{lang === 'ru' ? 'SKU' : 'SKU / Cod'}</th>
                                    <th style={{ padding: '12px 16px', fontWeight: '600', color: colors.textSecondary }}>{lang === 'ru' ? 'Размер' : lang === 'en' ? 'Size' : 'Mărime'}</th>
                                    <th style={{ padding: '12px 16px', fontWeight: '600', color: colors.textSecondary, textAlign: 'right' }}>{lang === 'ru' ? 'Цена POS' : lang === 'en' ? 'POS Price' : 'Preț POS'}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {paginatedProducts.map((p, idx) => {
                                    const rowNum = (currentPage - 1) * pageSize + idx + 1;
                                    const brandInfo = brands.find(b => b.name === p.brand_name);
                                    
                                    return (
                                        <tr key={`${p.iiko_id}-${p.restaurant_id}-${idx}`} style={{ borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}`, transition: 'background 0.2s' }}>
                                            <td style={{ padding: '10px 16px', color: colors.textSecondary, textAlign: 'center', fontWeight: '500' }}>
                                                {rowNum}
                                            </td>
                                            <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                                                {p.image ? (
                                                    <img src={p.image} alt={p.name} style={{ width: 44, height: 44, borderRadius: '8px', objectFit: 'cover', background: '#fff' }} />
                                                ) : (
                                                    <div style={{ width: 44, height: 44, borderRadius: '8px', background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: colors.textSecondary, fontSize: '10px', margin: '0 auto' }}>-</div>
                                                )}
                                            </td>
                                            <td style={{ padding: '10px 16px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                                    {brandInfo?.logo_url && <img src={brandInfo.logo_url} alt="" style={{ width: 16, height: 16, borderRadius: '50%', objectFit: 'cover' }} />}
                                                    <span style={{ fontWeight: '700', color: colors.text }}>{p.brand_name || '-'}</span>
                                                </div>
                                                <div style={{ fontSize: '11px', color: colors.textSecondary }}>{p.city} • {p.restaurant_name}</div>
                                            </td>
                                            <td style={{ padding: '10px 16px', color: colors.text, fontWeight: '600' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: p.is_available ? '#10b981' : '#ef4444' }} title={p.is_available ? 'Disponibil' : 'Stop-list'} />
                                                    {p.name}
                                                </div>
                                            </td>
                                            <td style={{ padding: '10px 16px', color: colors.textSecondary }}>{p.category}</td>
                                            <td style={{ padding: '10px 16px', color: colors.textSecondary, fontFamily: 'monospace' }}>{p.sku || '-'}</td>
                                            <td style={{ padding: '10px 16px', color: colors.textSecondary }}>{p.weight ? `${p.weight} ${p.measure_unit || ''}` : '-'}</td>
                                            <td style={{ padding: '10px 16px', color: colors.text, fontWeight: '800', textAlign: 'right', whiteSpace: 'nowrap' }}>{p.price ? `${p.price.toFixed(2)} RON` : '-'}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                    
                    {/* Pagination Controls */}
                    {totalPages > 1 && (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`, background: isDark ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.01)' }}>
                            <div style={{ fontSize: '12px', color: colors.textSecondary }}>
                                Se afișează {((currentPage - 1) * pageSize) + 1} - {Math.min(currentPage * pageSize, filteredProducts.length)} din {filteredProducts.length}
                            </div>
                            
                            <div style={{ display: 'flex', gap: '4px' }}>
                                <button 
                                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                    disabled={currentPage === 1}
                                    style={{ padding: '6px 12px', borderRadius: '6px', border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`, background: isDark ? 'rgba(255,255,255,0.05)' : '#fff', color: currentPage === 1 ? colors.textSecondary : colors.text, cursor: currentPage === 1 ? 'not-allowed' : 'pointer' }}
                                >
                                    &lt;
                                </button>
                                
                                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                    let pageNum = currentPage;
                                    if (totalPages <= 5) pageNum = i + 1;
                                    else if (currentPage <= 3) pageNum = i + 1;
                                    else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + i;
                                    else pageNum = currentPage - 2 + i;
                                    
                                    if (pageNum > totalPages || pageNum < 1) return null;

                                    return (
                                        <button 
                                            key={pageNum}
                                            onClick={() => setCurrentPage(pageNum)}
                                            style={{ 
                                                padding: '6px 12px', borderRadius: '6px', 
                                                border: `1px solid ${currentPage === pageNum ? '#6366f1' : isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`, 
                                                background: currentPage === pageNum ? '#6366f1' : isDark ? 'rgba(255,255,255,0.05)' : '#fff', 
                                                color: currentPage === pageNum ? '#fff' : colors.text, 
                                                fontWeight: currentPage === pageNum ? '700' : '500',
                                                cursor: 'pointer' 
                                            }}
                                        >
                                            {pageNum}
                                        </button>
                                    )
                                })}
                                
                                <button 
                                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                    disabled={currentPage === totalPages}
                                    style={{ padding: '6px 12px', borderRadius: '6px', border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`, background: isDark ? 'rgba(255,255,255,0.05)' : '#fff', color: currentPage === totalPages ? colors.textSecondary : colors.text, cursor: currentPage === totalPages ? 'not-allowed' : 'pointer' }}
                                >
                                    &gt;
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}
            
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
    )
}
