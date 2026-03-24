import { useState, useEffect, useCallback, useMemo } from 'react'
import { useTheme } from '../lib/ThemeContext'
import { useLanguage } from '../lib/LanguageContext'
import { supabase } from '../lib/supabaseClient'

const WORKER_URL = import.meta.env.VITE_WORKER_URL || 'http://localhost:3001'

const SpinIcon = () => (
    <svg style={{ animation: 'spin 1s linear infinite' }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
        <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
)

export default function IikoProducts() {
    const { colors, isDark } = useTheme()
    const { lang } = useLanguage()
    
    const [brands, setBrands] = useState([])
    const [restaurants, setRestaurants] = useState([])
    
    const [products, setProducts] = useState(() => {
        try {
            const cached = localStorage.getItem('iiko_products_cache')
            return cached ? JSON.parse(cached) : []
        } catch(e) { return [] }
    })
    
    const [isSyncing, setIsSyncing] = useState(false)
    const [errorMsg, setErrorMsg] = useState(null)
    const [lastSync, setLastSync] = useState(() => localStorage.getItem('iiko_products_last_sync') || null)

    const [selectedBrand, setSelectedBrand] = useState('all')
    const [selectedCity, setSelectedCity] = useState('all')
    const [search, setSearch] = useState('')
    
    const [pageSize, setPageSize] = useState(20)
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
    }, [loadProducts])
    
    useEffect(() => {
        setCurrentPage(1)
    }, [selectedBrand, selectedCity, search, pageSize])

    const filteredProducts = useMemo(() => {
        let list = products
        if (selectedCity !== 'all') list = list.filter(p => p.city === selectedCity)
        if (selectedBrand !== 'all') {
            const brand = brands.find(b => b.id === selectedBrand)
            if (brand) list = list.filter(p => p.brand_name === brand.name)
        }
        if (search) {
            const q = search.toLowerCase().trim()
            list = list.filter(p => 
                (p.name || '').toLowerCase().includes(q) || 
                (p.category || '').toLowerCase().includes(q) ||
                (p.sku || '').toLowerCase().includes(q)
            )
        }
        return list.sort((a, b) => {
            const bA = a.brand_name || ''
            const bB = b.brand_name || ''
            if (bA !== bB) return bA.localeCompare(bB)
            return (a.name || '').localeCompare(b.name || '')
        })
    }, [products, search, selectedCity, selectedBrand, brands])

    const totalPages = Math.ceil(filteredProducts.length / pageSize) || 1
    const paginatedProducts = filteredProducts.slice((currentPage - 1) * pageSize, currentPage * pageSize)

    // AESTHETICS:
    const glassBg = isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(255, 255, 255, 0.8)'
    const glassBorder = isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(0, 0, 0, 0.06)'
    const inputBg = isDark ? 'rgba(0, 0, 0, 0.2)' : '#fff'

    return (
        <div style={{ padding: '32px 40px', minHeight: '100vh', display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Header Area */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
                <div>
                    <h1 style={{ margin: 0, fontSize: '28px', fontWeight: '800', fontFamily: '"Outfit", "Inter", sans-serif', color: colors.text, letterSpacing: '-0.8px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                        {lang === 'ru' ? 'Продукты POS (iiko)' : lang === 'en' ? 'POS Products (iiko)' : 'Produse POS (iiko)'}
                        {isSyncing && (
                            <div style={{ fontSize: '12px', fontWeight: '600', color: '#6366f1', background: isDark ? 'rgba(99,102,241,0.15)' : 'rgba(99,102,241,0.1)', padding: '6px 14px', borderRadius: '30px', display: 'flex', alignItems: 'center', gap: '8px', border: '1px solid rgba(99,102,241,0.2)' }}>
                                <SpinIcon />
                                {lang === 'ru' ? 'Синхронизация...' : lang === 'en' ? 'Syncing...' : 'Sincronizare activă'}
                            </div>
                        )}
                    </h1>
                    <p style={{ margin: '6px 0 0', fontSize: '14px', color: colors.textSecondary, fontWeight: '500' }}>
                        {lang === 'ru' ? 'Синхронизация в реальном времени из iiko. ' : lang === 'en' ? 'Realtime sync from iiko. ' : 'Oglindire automată din sistemul POS. '}
                        {lastSync && <span style={{ opacity: 0.7 }}>• Ultima sincronizare: {lastSync}</span>}
                    </p>
                </div>
                <button onClick={() => loadProducts(false)} disabled={isSyncing}
                    style={{ 
                        display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', borderRadius: '12px', 
                        border: 'none', background: isSyncing ? (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)') : 'linear-gradient(135deg, #4f46e5, #7c3aed)', 
                        color: isSyncing ? colors.textSecondary : '#fff', fontSize: '14px', fontWeight: '700', cursor: isSyncing ? 'wait' : 'pointer', 
                        boxShadow: isSyncing ? 'none' : '0 8px 20px rgba(99,102,241,0.35)', transition: 'all 0.2s',
                        transform: isSyncing ? 'scale(0.98)' : 'scale(1)'
                    }}>
                    {isSyncing ? <><SpinIcon /> {lang === 'ru' ? 'Синхронизация' : 'Sincronizare'}</> : '↻ Forțează Sincronizarea'}
                </button>
            </div>

            {errorMsg && (
                <div style={{ padding: '14px 20px', borderRadius: '12px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#ef4444', fontSize: '14px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                    {errorMsg}
                </div>
            )}

            {/* Premium Filters Section */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', background: glassBg, backdropFilter: 'blur(16px)', border: glassBorder, padding: '20px', borderRadius: '20px', boxShadow: isDark ? '0 8px 32px rgba(0,0,0,0.2)' : '0 8px 32px rgba(0,0,0,0.04)' }}>
                {/* Brand Logo Filter */}
                <div style={{ display: 'flex', gap: '12px', overflowX: 'auto', paddingBottom: '4px', msOverflowStyle: 'none', scrollbarWidth: 'none' }}>
                    <button 
                        onClick={() => setSelectedBrand('all')}
                        style={{
                            padding: '10px 24px', borderRadius: '14px', border: `1px solid ${selectedBrand === 'all' ? '#6366f1' : isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}`,
                            background: selectedBrand === 'all' ? (isDark ? 'rgba(99,102,241,0.15)' : 'rgba(99,102,241,0.1)') : inputBg,
                            color: selectedBrand === 'all' ? '#6366f1' : colors.text,
                            fontWeight: selectedBrand === 'all' ? '800' : '600', cursor: 'pointer', whiteSpace: 'nowrap',
                            display: 'flex', alignItems: 'center', transition: 'all 0.2s',
                            boxShadow: selectedBrand === 'all' ? '0 4px 12px rgba(99,102,241,0.2)' : 'none'
                        }}>
                        {lang === 'ru' ? 'Все бренды' : lang === 'en' ? 'All Brands' : 'Toate Brandurile'}
                    </button>
                    {brands.map(b => {
                        const isSel = selectedBrand === b.id;
                        return (
                            <button 
                                key={b.id} onClick={() => setSelectedBrand(b.id)}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '10px',
                                    padding: '8px 20px 8px 10px', borderRadius: '14px', 
                                    border: `1px solid ${isSel ? '#6366f1' : isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}`,
                                    background: isSel ? (isDark ? 'rgba(99,102,241,0.15)' : 'rgba(99,102,241,0.1)') : inputBg,
                                    color: isSel ? '#6366f1' : colors.text,
                                    fontWeight: isSel ? '800' : '600', cursor: 'pointer', whiteSpace: 'nowrap',
                                    transition: 'all 0.2s', boxShadow: isSel ? '0 4px 12px rgba(99,102,241,0.2)' : 'none',
                                    transform: isSel ? 'translateY(-2px)' : 'none'
                                }}>
                                {b.logo_url ? (
                                    <img src={b.logo_url} alt="" style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover', background: '#fff', border: '1px solid rgba(0,0,0,0.05)' }} />
                                ) : (
                                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }} />
                                )}
                                {b.name}
                            </button>
                        )
                    })}
                </div>

                <div style={{ height: '1px', background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }} />

                {/* Sub-filters & Pagination Select */}
                <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
                        <select value={selectedCity} onChange={e => setSelectedCity(e.target.value)} 
                            style={{ padding: '12px 16px', borderRadius: '12px', border: glassBorder, background: inputBg, color: colors.text, fontSize: '14px', fontWeight: '500', cursor: 'pointer', outline: 'none', minWidth: '160px' }}>
                            <option value="all">{lang === 'ru' ? 'Все города' : lang === 'en' ? 'All cities' : 'Toate orașele'}</option>
                            {cities.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                        <div style={{ position: 'relative' }}>
                            <svg style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: colors.textSecondary }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                            <input value={search} onChange={e => setSearch(e.target.value)} placeholder={lang === 'ru' ? 'Поиск продукта или SKU...' : 'Caută produs sau cod...'} 
                                style={{ padding: '12px 16px 12px 42px', borderRadius: '12px', border: glassBorder, background: inputBg, color: colors.text, fontSize: '14px', fontWeight: '500', outline: 'none', minWidth: '280px', transition: 'border-color 0.2s' }} 
                                onFocus={e => e.target.style.borderColor = '#6366f1'} onBlur={e => e.target.style.borderColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'} />
                        </div>
                    </div>
                    
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: isDark ? 'rgba(99,102,241,0.1)' : 'rgba(99,102,241,0.05)', padding: '8px 16px', borderRadius: '12px', border: '1px solid rgba(99,102,241,0.15)' }}>
                            <span style={{ fontSize: '14px', color: '#6366f1', fontWeight: '700' }}>{filteredProducts.length}</span>
                            <span style={{ fontSize: '13px', color: colors.textSecondary, fontWeight: '600' }}>produse</span>
                        </div>
                        <select value={pageSize} onChange={e => setPageSize(Number(e.target.value))} 
                            style={{ padding: '10px 14px', borderRadius: '12px', border: glassBorder, background: inputBg, color: colors.text, fontSize: '13px', fontWeight: '600', cursor: 'pointer', outline: 'none' }}>
                            <option value={12}>12 pe pagină</option>
                            <option value={20}>20 pe pagină</option>
                            <option value={40}>40 pe pagină</option>
                            <option value={100}>100 pe pagină</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Content Area */}
            {products.length === 0 && !isSyncing ? (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '400px', background: glassBg, borderRadius: '24px', border: glassBorder }}>
                    <div style={{ width: 64, height: 64, borderRadius: '50%', background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' }}>
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={colors.textSecondary} strokeWidth="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
                    </div>
                    <span style={{ fontSize: '16px', fontWeight: '600', color: colors.textSecondary }}>Din baza de date iiko nu a fost încărcat nimic. Apasă pe "Forțează Sincronizarea".</span>
                </div>
            ) : filteredProducts.length === 0 ? (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '400px', background: glassBg, borderRadius: '24px', border: glassBorder }}>
                    <span style={{ fontSize: '16px', fontWeight: '600', color: colors.textSecondary }}>Niciun produs nu corespunde filtrelor selectate.</span>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                    {/* Beautiful Cards Grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
                        {paginatedProducts.map((p, idx) => {
                            const rowNum = (currentPage - 1) * pageSize + idx + 1;
                            const brandInfo = brands.find(b => b.name === p.brand_name);
                            const isAvailable = p.is_available !== false; // handle nullish
                            
                            return (
                                <div key={`${p.iiko_id}-${p.restaurant_id}-${idx}`} style={{ 
                                    background: isDark ? 'rgba(255,255,255,0.02)' : '#fff', borderRadius: '20px', 
                                    border: glassBorder, overflow: 'hidden', position: 'relative',
                                    boxShadow: isDark ? '0 10px 30px rgba(0,0,0,0.1)' : '0 10px 30px rgba(0,0,0,0.03)',
                                    transition: 'transform 0.25s cubic-bezier(0.2, 0.8, 0.2, 1), box-shadow 0.25s',
                                    display: 'flex', flexDirection: 'column'
                                }}
                                onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-6px)'; e.currentTarget.style.boxShadow = isDark ? '0 20px 40px rgba(0,0,0,0.25)' : '0 20px 40px rgba(0,0,0,0.08)' }}
                                onMouseOut={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = isDark ? '0 10px 30px rgba(0,0,0,0.1)' : '0 10px 30px rgba(0,0,0,0.03)' }}>
                                    
                                    {/* Image Container */}
                                    <div style={{ height: '200px', width: '100%', position: 'relative', background: isDark ? 'rgba(255,255,255,0.03)' : '#f8fafc', overflow: 'hidden' }}>
                                        {/* Status Badge */}
                                        <div style={{ position: 'absolute', top: '12px', left: '12px', zIndex: 10, background: isAvailable ? 'rgba(16, 185, 129, 0.9)' : 'rgba(239, 68, 68, 0.9)', backdropFilter: 'blur(8px)', color: '#fff', fontSize: '11px', fontWeight: '800', padding: '6px 10px', borderRadius: '8px', letterSpacing: '0.5px', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '4px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
                                            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff', opacity: 0.8 }} />
                                            {isAvailable ? 'Disponibil' : 'Stop-List'}
                                        </div>

                                        {/* Brand Logo Floating */}
                                        {brandInfo?.logo_url && (
                                            <div style={{ position: 'absolute', top: '12px', right: '12px', zIndex: 10, width: 36, height: 36, borderRadius: '50%', background: '#fff', padding: '2px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
                                                <img src={brandInfo.logo_url} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                                            </div>
                                        )}

                                        {/* Number Index */}
                                        <div style={{ position: 'absolute', bottom: '12px', left: '12px', zIndex: 10, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', color: '#fff', fontSize: '12px', fontWeight: '800', padding: '4px 8px', borderRadius: '6px' }}>
                                            #{rowNum}
                                        </div>

                                        {p.image ? (
                                            <img src={p.image} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.5s', ':hover': { transform: 'scale(1.05)' } }} />
                                        ) : (
                                            <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: colors.textSecondary, opacity: 0.5 }}>
                                                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                                                <span style={{ fontSize: '13px', fontWeight: '600', marginTop: '8px' }}>Fără poză</span>
                                            </div>
                                        )}
                                        
                                        {/* Price overlay directly on image bottom right */}
                                        <div style={{ position: 'absolute', bottom: '12px', right: '12px', zIndex: 10, background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(8px)', border: '1px solid rgba(0,0,0,0.05)', color: '#0f172a', fontSize: '16px', fontWeight: '900', padding: '6px 12px', borderRadius: '10px', boxShadow: '0 4px 16px rgba(0,0,0,0.15)' }}>
                                            {p.price ? `${p.price.toFixed(2)} RON` : '-'}
                                        </div>
                                    </div>

                                    {/* Info Content */}
                                    <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', flex: 1 }}>
                                        <div style={{ fontSize: '11px', fontWeight: '700', color: '#6366f1', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '8px' }}>
                                            {p.category || 'Meniu General'}
                                        </div>
                                        
                                        <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', fontWeight: '800', fontFamily: '"Outfit", "Inter", sans-serif', color: colors.text, lineHeight: 1.3 }}>
                                            {p.name}
                                        </h3>
                                        
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
                                            {p.weight && (
                                                <span style={{ fontSize: '12px', fontWeight: '600', color: colors.textSecondary, background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)', padding: '4px 8px', borderRadius: '6px' }}>
                                                    ⚖️ {p.weight} {p.measure_unit || 'g'}
                                                </span>
                                            )}
                                            {p.sku && (
                                                <span style={{ fontSize: '12px', fontWeight: '600', color: colors.textSecondary, background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)', padding: '4px 8px', borderRadius: '6px', fontFamily: 'monospace' }}>
                                                    SKU: {p.sku}
                                                </span>
                                            )}
                                        </div>

                                        <div style={{ marginTop: 'auto', paddingTop: '16px', borderTop: isDark ? '1px dashed rgba(255,255,255,0.1)' : '1px dashed rgba(0,0,0,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                <span style={{ fontSize: '11px', color: colors.textSecondary, fontWeight: '500' }}>Locație</span>
                                                <span style={{ fontSize: '13px', color: colors.text, fontWeight: '700' }}>{p.city}</span>
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', maxWidth: '120px' }}>
                                                <span style={{ fontSize: '11px', color: colors.textSecondary, fontWeight: '500' }}>Restaurant</span>
                                                <span style={{ fontSize: '13px', color: colors.text, fontWeight: '700', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', width: '100%', textAlign: 'right' }}>{p.restaurant_name}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    
                    {/* Pagination Context & Controls */}
                    {totalPages > 1 && (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', borderRadius: '20px', background: glassBg, backdropFilter: 'blur(16px)', border: glassBorder, boxShadow: isDark ? '0 8px 32px rgba(0,0,0,0.2)' : '0 8px 32px rgba(0,0,0,0.04)' }}>
                            <div style={{ fontSize: '14px', color: colors.textSecondary, fontWeight: '600' }}>
                                Se afișează {((currentPage - 1) * pageSize) + 1} - {Math.min(currentPage * pageSize, filteredProducts.length)} din {filteredProducts.length}
                            </div>
                            
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button 
                                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                    disabled={currentPage === 1}
                                    style={{ width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '12px', border: glassBorder, background: inputBg, color: currentPage === 1 ? colors.textSecondary : colors.text, cursor: currentPage === 1 ? 'not-allowed' : 'pointer', transition: 'all 0.2s' }}
                                >
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
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
                                                width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '12px', 
                                                border: `1px solid ${currentPage === pageNum ? '#6366f1' : isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}`, 
                                                background: currentPage === pageNum ? '#6366f1' : inputBg, 
                                                color: currentPage === pageNum ? '#fff' : colors.text, 
                                                fontWeight: currentPage === pageNum ? '800' : '600',
                                                cursor: 'pointer', transition: 'all 0.2s',
                                                boxShadow: currentPage === pageNum ? '0 4px 12px rgba(99,102,241,0.3)' : 'none'
                                            }}
                                        >
                                            {pageNum}
                                        </button>
                                    )
                                })}
                                
                                <button 
                                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                    disabled={currentPage === totalPages}
                                    style={{ width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '12px', border: glassBorder, background: inputBg, color: currentPage === totalPages ? colors.textSecondary : colors.text, cursor: currentPage === totalPages ? 'not-allowed' : 'pointer', transition: 'all 0.2s' }}
                                >
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
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
