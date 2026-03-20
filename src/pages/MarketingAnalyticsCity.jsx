import React, { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTheme } from '../lib/ThemeContext'
import { useLanguage } from '../lib/LanguageContext'
import { supabase } from '../lib/supabaseClient'

import { getSmartSearchWords } from '../lib/searchUtils'

const CITY_FLAGS = {
    'Bucharest': '🏙️', 'Cluj-Napoca': '🌄', 'Timisoara': '🌉', 'Iasi': '🏙️',
    'Constanta': '🌊', 'Brasov': '🏄', 'Galati': '🏗️', 'Sibiu': '🏰',
    'Pitesti': '🌳', 'Craiova': '🌿', 'Oradea': '🎠', 'Arad': '🌾',
    'Targu Mures': '🏡', 'Bacau': '🏠', 'Ploiesti': '⛽', 'Ramnicu Valcea': '🍃',
    'Suceava': '🦨', 'Baia Mare': '⛏️',
}

export default function MarketingAnalyticsCity() {
    const { city } = useParams()
    const cityName = decodeURIComponent(city || '')
    const navigate = useNavigate()
    const { colors, isDark } = useTheme()
    const { lang } = useLanguage()

    const [data, setData] = useState([])
    const [loading, setLoading] = useState(true)
    const [page, setPage] = useState(1)
    const [pageSize, setPageSize] = useState(50)
    const [search, setSearch] = useState('')
    const [filterCategory, setFilterCategory] = useState('')
    const [filterPlatform, setFilterPlatform] = useState('')
    const [filterCompBrand, setFilterCompBrand] = useState('')
    const [selectedProduct, setSelectedProduct] = useState(null)
    const [snapshotDate, setSnapshotDate] = useState('')

    useEffect(() => {
        async function load() {
            setLoading(true)
            try {
                // Get latest snapshot date for this city
                const { data: latest } = await supabase
                    .from('competitor_products')
                    .select('snapshot_date')
                    .eq('city', cityName)
                    .order('snapshot_date', { ascending: false })
                    .limit(1)

                if (!latest || latest.length === 0) { setLoading(false); return }
                const latestDate = latest[0].snapshot_date
                setSnapshotDate(latestDate)

                // fetch all products for this city on that date
                let q = supabase
                    .from('competitor_products')
                    .select('product_name, category, price, description, city, snapshot_date, platform, image_url, competitor_restaurants(name, logo_url, url)')
                    .eq('city', cityName)
                    .eq('snapshot_date', latestDate)
                    .order('category', { ascending: true })
                    .limit(10000)

                const { data: rows } = await q

                // Fetch own products for price comparison
                const { data: own } = await supabase
                    .from('own_product_snapshots')
                    .select('product_name, price, city, brands(name, logo_url)')
                    .limit(5000)

                const ownMap = {}
                if (own) {
                    own.forEach(o => {
                        const brandData = o.brands || {}
                        const brandObj = Array.isArray(brandData) ? brandData[0] : brandData
                        const brand = brandObj?.name || ''
                        const logo = brandObj?.logo_url || ''
                        const k1 = `${o.product_name.trim().toLowerCase()}___${o.city || ''}`
                        const k2 = `${o.product_name.trim().toLowerCase()}___`
                        ownMap[k1] = { price: o.price, brand, logo }
                        if (!ownMap[k2]) ownMap[k2] = { price: o.price, brand, logo }
                    })
                }

                const parsed = (rows || []).map(p => {
                    const fullName = p.product_name || ''
                    const fullText = fullName + ' ' + (p.description || '')
                    const weightMatch = fullText.match(/(\d+)\s*(g|gr|ml|kg)\b/i)
                    const weight = weightMatch ? `${weightMatch[1]}${weightMatch[2].toLowerCase()}` : '—'
                    let pcsMatch = fullText.match(/\b(\d+)\s*(bucati|bucăți|buc|pcs|pieces|role|rolls)\b/i)
                    if (!pcsMatch) pcsMatch = fullText.match(/(?:x\s*(\d+)|\b(\d+)\s*x\b)/i)
                    const pieces = pcsMatch ? (pcsMatch[1] || pcsMatch[2] || '1') : '1'
                    const compPrice = Number(p.price) || 0
                    const restData = p.competitor_restaurants || {}
                    const restObj = Array.isArray(restData) ? restData[0] : restData
                    const compBrand = restObj?.name || 'Necunoscut'
                    const compLogo = restObj?.logo_url || ''
                    const compUrl = restObj?.url || ''

                    const k1 = `${fullName.trim().toLowerCase()}___${cityName}`
                    const k2 = `${fullName.trim().toLowerCase()}___`
                    const own = ownMap[k1] || ownMap[k2] || null

                    return {
                        name: fullName,
                        description: p.description || '',
                        category: p.category || '—',
                        ourPrice: own ? Number(own.price) : 0,
                        ourBrand: own?.brand || '',
                        ourLogo: own?.logo || '',
                        hasExactMatch: !!own,
                        compPrice,
                        compBrand,
                        compLogo,
                        compUrl,
                        platform: p.platform || '—',
                        snapshot_date: p.snapshot_date || '—',
                        weight,
                        pieces,
                        image_url: p.image_url || '',
                    }
                }).filter(p => p.compPrice > 0)

                // Deduplicate
                const unique = {}
                parsed.forEach(p => {
                    const key = `${p.compBrand}_${p.name}_${p.platform}`
                    if (!unique[key]) unique[key] = { ...p }
                    else if (!unique[key].image_url && p.image_url) unique[key].image_url = p.image_url
                })
                setData(Object.values(unique))
            } catch (e) {
                console.error(e)
            } finally {
                setLoading(false)
            }
        }
        load()
    }, [cityName])

    const filtered = useMemo(() => {
        return data.filter(r => {
            const isDrink = /(băutur|bautur|drink|beverage|cola|pepsi|suc|apă|apa\b|răcorit|racorit|bere|vin|red\s*bull|7up|mirinda|fanta|sprite|lipton|heineken|peroni|asahi|ursus|dorna|borsec)/i.test(r.category) || /(băutur|bautur|drink|beverage|cola|pepsi|suc|apă|apa\b|răcorit|racorit|bere|vin|red\s*bull|7up|mirinda|fanta|sprite|lipton|heineken|peroni|asahi|ursus|dorna|borsec)/i.test(r.name)

            if (search) {
                const words = getSmartSearchWords(search)
                const textForSearch = `${r.name} ${r.category} ${r.compBrand} ${r.description}`.toLowerCase()
                
                // Dacă oricare cuvânt căutat NU se regăsește în textul concatenat, atunci îl excludem.
                if (!words.every(w => textForSearch.includes(w))) return false
                
                // Excludere inteligentă: dacă ai căutat produse de mâncare generale (sushi, burger, pizza) 
                // și rezultatul este de fapt o băutură (care s-a potrivit doar pentru că restaurantul are "sushi" în nume)
                if (isDrink && (search.toLowerCase().includes('sushi') || search.toLowerCase().includes('burger') || search.toLowerCase().includes('pizza') || search.toLowerCase().includes('mancare') || search.toLowerCase().includes('food'))) {
                    return false
                }
            }
            if (filterCategory && !r.category.toLowerCase().includes(filterCategory.toLowerCase())) return false
            if (filterPlatform && r.platform !== filterPlatform) return false
            if (filterCompBrand && !r.compBrand.toLowerCase().includes(filterCompBrand.toLowerCase())) return false
            return true
        })
    }, [data, search, filterCategory, filterPlatform, filterCompBrand])

    const categories = useMemo(() => [...new Set(data.map(r => r.category).filter(Boolean))].sort(), [data])
    const platforms = useMemo(() => [...new Set(data.map(r => r.platform).filter(Boolean))].sort(), [data])
    const compBrands = useMemo(() => [...new Set(data.map(r => r.compBrand).filter(Boolean))].sort(), [data])

    const totalPages = Math.ceil(filtered.length / pageSize)
    const pageData = filtered.slice((page - 1) * pageSize, page * pageSize)

    const matched = filtered.filter(r => r.hasExactMatch && r.ourPrice > 0)
    const avgDiff = matched.length > 0
        ? ((matched.reduce((s, r) => s + (r.ourPrice - r.compPrice), 0) / matched.reduce((s, r) => s + r.compPrice, 0)) * 100).toFixed(1)
        : null

    const inputStyle = {
        padding: '9px 14px', borderRadius: '10px', border: `1px solid ${colors.border}`,
        background: isDark ? 'rgba(255,255,255,0.05)' : '#fff', color: colors.text,
        fontSize: '13px', outline: 'none', width: '100%'
    }

    return (
        <div style={{ padding: '24px', maxWidth: '1600px', margin: '0 auto' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px', flexWrap: 'wrap' }}>
                <button
                    onClick={() => navigate('/marketing-analytics')}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '10px', border: `1px solid ${colors.border}`, background: 'transparent', color: colors.textSecondary, fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}
                    onMouseOver={e => { e.currentTarget.style.borderColor = '#6366F1'; e.currentTarget.style.color = '#6366F1' }}
                    onMouseOut={e => { e.currentTarget.style.borderColor = colors.border; e.currentTarget.style.color = colors.textSecondary }}
                >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
                    Înapoi la Analytics
                </button>
                <div>
                    <h1 style={{ margin: 0, fontSize: '26px', fontWeight: '800', color: colors.text, letterSpacing: '-0.5px' }}>
                        {CITY_FLAGS[cityName] || '📍'} {cityName}
                    </h1>
                    <p style={{ margin: '4px 0 0 0', color: colors.textSecondary, fontSize: '14px' }}>
                        {loading ? 'Se încarcă...' : `${filtered.length} produse`}
                        {snapshotDate && <> · Snapshot: <strong>{snapshotDate}</strong></>}
                        {avgDiff !== null && (
                            <span style={{ marginLeft: '12px', fontWeight: '700', color: Number(avgDiff) <= 0 ? '#10B981' : '#EF4444' }}>
                                Diferență medie: {Number(avgDiff) > 0 ? '+' : ''}{avgDiff}%
                            </span>
                        )}
                    </p>
                </div>
            </div>

            {/* KPI bar */}
            {!loading && (
                <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', flexWrap: 'wrap' }}>
                    {[
                        { label: 'Total produse', val: data.length, color: '#6366F1' },
                        { label: 'Cu preț comparat', val: matched.length, color: '#10B981' },
                        { label: 'Categorii', val: categories.length, color: '#F59E0B' },
                        { label: 'Branduri competitor', val: compBrands.length, color: '#EC4899' },
                    ].map(({ label, val, color }) => (
                        <div key={label} style={{ flex: '1 1 140px', background: isDark ? 'rgba(30,30,32,0.6)' : '#fff', borderRadius: '14px', border: `1px solid ${colors.border}`, padding: '16px 20px' }}>
                            <div style={{ fontSize: '22px', fontWeight: '800', color }}>{val}</div>
                            <div style={{ fontSize: '12px', color: colors.textSecondary, marginTop: '4px', fontWeight: '600' }}>{label}</div>
                        </div>
                    ))}
                </div>
            )}

            {/* Filters */}
            <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
                <div style={{ flex: '2 1 200px' }}>
                    <input style={inputStyle} placeholder="🔍 Caută produs..." value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} />
                </div>
                <div style={{ flex: '1 1 140px' }}>
                    <select style={inputStyle} value={filterCategory} onChange={e => { setFilterCategory(e.target.value); setPage(1) }}>
                        <option value="">Toate categoriile</option>
                        {categories.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                </div>
                <div style={{ flex: '1 1 120px' }}>
                    <select style={inputStyle} value={filterPlatform} onChange={e => { setFilterPlatform(e.target.value); setPage(1) }}>
                        <option value="">Toate platformele</option>
                        {platforms.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                </div>
                <div style={{ flex: '1 1 160px' }}>
                    <select style={inputStyle} value={filterCompBrand} onChange={e => { setFilterCompBrand(e.target.value); setPage(1) }}>
                        <option value="">Toți concurenții</option>
                        {compBrands.map(b => <option key={b} value={b}>{b}</option>)}
                    </select>
                </div>
            </div>

            {/* Table */}
            {loading ? (
                <div style={{ padding: '80px', textAlign: 'center', color: colors.textSecondary }}>
                    <div style={{ fontSize: '32px', marginBottom: '12px' }}>⏳</div>
                    <div style={{ fontWeight: '600' }}>Se încarcă datele pentru {cityName}...</div>
                </div>
            ) : filtered.length === 0 ? (
                <div style={{ padding: '80px', textAlign: 'center', color: colors.textSecondary }}>
                    <div style={{ fontSize: '32px', marginBottom: '12px' }}>📭</div>
                    <div style={{ fontWeight: '600' }}>Nu există produse pentru filtrele selectate</div>
                </div>
            ) : (
                <div style={{ background: isDark ? 'rgba(30,30,32,0.6)' : '#fff', borderRadius: '16px', border: `1px solid ${colors.border}`, overflow: 'hidden' }}>
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                            <thead>
                                <tr style={{ background: isDark ? 'rgba(0,0,0,0.2)' : '#f9fafb' }}>
                                    {['Actualizare', 'Produs', 'Gramaj', 'Bucăți', 'Brandul Nostru', 'Concurent', 'Diferență'].map(h => (
                                        <th key={h} style={{ padding: '12px 20px', fontSize: '11px', fontWeight: '600', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap' }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {pageData.map((row, i) => {
                                    const diff = row.hasExactMatch ? row.ourPrice - row.compPrice : null
                                    const isCheaper = diff !== null && diff <= 0
                                    return (
                                        <tr key={i} style={{ borderBottom: `1px solid ${colors.border}` }}
                                            onMouseOver={e => e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.02)' : '#fafafa'}
                                            onMouseOut={e => e.currentTarget.style.background = 'transparent'}>
                                            <td style={{ padding: '12px 20px', color: colors.textSecondary, fontSize: '12px', whiteSpace: 'nowrap' }}>
                                                {row.snapshot_date}
                                                <div style={{ marginTop: '3px' }}>
                                                    <span style={{ fontSize: '10px', textTransform: 'capitalize', background: isDark ? 'rgba(255,255,255,0.07)' : '#f1f5f9', padding: '2px 6px', borderRadius: '4px' }}>{row.platform}</span>
                                                </div>
                                            </td>
                                            <td style={{ padding: '12px 20px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                    <div onClick={() => setSelectedProduct(row)} style={{ cursor: 'pointer', flexShrink: 0 }}>
                                                        {row.image_url ? (
                                                            <img src={row.image_url} alt={row.name} style={{ width: 40, height: 40, borderRadius: '8px', objectFit: 'cover' }} onError={e => { e.currentTarget.style.display='none' }} />
                                                        ) : (
                                                            <div style={{ width: 40, height: 40, borderRadius: '8px', background: 'linear-gradient(135deg,#f1f5f9,#e2e8f0)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>🍽️</div>
                                                        )}
                                                    </div>
                                                    <div>
                                                        <div onClick={() => setSelectedProduct(row)} style={{ color: colors.text, fontWeight: '600', fontSize: '13px', cursor: 'pointer', maxWidth: '240px' }}
                                                            onMouseOver={e => e.currentTarget.style.color = '#6366F1'}
                                                            onMouseOut={e => e.currentTarget.style.color = colors.text}>
                                                            {row.name}
                                                        </div>
                                                        <div style={{ color: colors.textSecondary, fontSize: '11px', marginTop: '2px' }}>{row.category}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td style={{ padding: '12px 20px', color: colors.textSecondary, fontSize: '13px' }}>
                                                {row.weight !== '—' ? <span style={{ background: isDark ? 'rgba(255,255,255,0.1)' : '#f1f5f9', padding: '3px 6px', borderRadius: '4px', fontWeight: '600', fontSize: '12px' }}>{row.weight}</span> : '—'}
                                            </td>
                                            <td style={{ padding: '12px 20px', color: colors.textSecondary, fontSize: '13px' }}>
                                                <span style={{ background: isDark ? 'rgba(255,255,255,0.1)' : '#f1f5f9', padding: '3px 6px', borderRadius: '4px', fontWeight: '600', fontSize: '12px' }}>{row.pieces}</span>
                                            </td>
                                            <td style={{ padding: '12px 20px', color: '#6366F1', fontWeight: '800', fontSize: '14px' }}>
                                                {row.hasExactMatch ? (
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                        {row.ourLogo && <img src={row.ourLogo} alt={row.ourBrand} style={{ width: 22, height: 22, borderRadius: '4px', objectFit: 'cover' }} />}
                                                        <div>
                                                            <div>{row.ourPrice} lei</div>
                                                            <div style={{ fontSize: '11px', color: colors.textSecondary, fontWeight: 'normal' }}>{row.ourBrand}</div>
                                                        </div>
                                                    </div>
                                                ) : <span style={{ color: colors.textSecondary, fontSize: '12px' }}>—</span>}
                                            </td>
                                            <td style={{ padding: '12px 20px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    {row.compLogo && <img src={row.compLogo} alt={row.compBrand} style={{ width: 22, height: 22, borderRadius: '4px', objectFit: 'cover' }} />}
                                                    <div>
                                                        <div style={{ color: colors.text, fontSize: '14px', fontWeight: '700' }}>{row.compPrice} lei</div>
                                                        <div style={{ color: colors.textSecondary, fontSize: '11px' }}>{row.compBrand}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td style={{ padding: '12px 20px' }}>
                                                {diff !== null ? (
                                                    <span style={{ display: 'inline-block', padding: '4px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '700', background: isCheaper ? (isDark ? 'rgba(16,185,129,0.15)' : '#ecfdf5') : (isDark ? 'rgba(239,68,68,0.15)' : '#fef2f2'), color: isCheaper ? '#10B981' : '#ef4444', whiteSpace: 'nowrap' }}>
                                                        {diff > 0 ? '+' : ''}{Number(diff).toFixed(1)} lei ({((diff / row.compPrice) * 100).toFixed(1)}%)
                                                    </span>
                                                ) : (
                                                    <span style={{ color: colors.textSecondary, fontSize: '12px' }}>Nu avem</span>
                                                )}
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div style={{ padding: '16px 24px', borderTop: `1px solid ${colors.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <span style={{ fontSize: '13px', color: colors.textSecondary }}>
                                    Pagina <strong style={{ color: colors.text }}>{page}</strong> din <strong style={{ color: colors.text }}>{totalPages}</strong> · {filtered.length} produse
                                </span>
                                <div style={{ height: '16px', width: '1px', background: colors.border }}></div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: colors.textSecondary }}>
                                    Randuri:
                                    <select value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(1); }} style={{ padding: '4px 8px', borderRadius: '6px', border: `1px solid ${colors.border}`, background: 'transparent', color: colors.text, fontSize: '12px', outline: 'none', cursor: 'pointer' }}>
                                        <option value={25}>25</option>
                                        <option value={50}>50</option>
                                        <option value={100}>100</option>
                                        <option value={200}>200</option>
                                        <option value={500}>500</option>
                                    </select>
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                                    style={{ padding: '7px 14px', borderRadius: '8px', border: `1px solid ${colors.border}`, background: 'transparent', color: page === 1 ? colors.textSecondary : colors.text, cursor: page === 1 ? 'default' : 'pointer', fontSize: '13px', fontWeight: '600', opacity: page === 1 ? 0.4 : 1 }}>
                                    ← Anterior
                                </button>
                                {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
                                    let p
                                    if (totalPages <= 7) p = i + 1
                                    else if (page <= 4) p = i + 1
                                    else if (page >= totalPages - 3) p = totalPages - 6 + i
                                    else p = page - 3 + i
                                    if (p < 1 || p > totalPages) return null
                                    return (
                                        <button key={p} onClick={() => setPage(p)}
                                            style={{ padding: '7px 12px', borderRadius: '8px', border: 'none', background: p === page ? '#6366F1' : 'transparent', color: p === page ? '#fff' : colors.text, cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}>
                                            {p}
                                        </button>
                                    )
                                })}
                                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                                    style={{ padding: '7px 14px', borderRadius: '8px', border: `1px solid ${colors.border}`, background: 'transparent', color: page === totalPages ? colors.textSecondary : colors.text, cursor: page === totalPages ? 'default' : 'pointer', fontSize: '13px', fontWeight: '600', opacity: page === totalPages ? 0.4 : 1 }}>
                                    Următor →
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Product Modal */}
            {selectedProduct && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
                    <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }} onClick={() => setSelectedProduct(null)} />
                    <div style={{ position: 'relative', width: '100%', maxWidth: '500px', background: isDark ? '#1e1e20' : '#ffffff', borderRadius: '24px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)', overflow: 'hidden', border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}` }}>
                        {selectedProduct.image_url && (
                            <div style={{ width: '100%', height: '220px', background: '#f1f5f9' }}>
                                <img src={selectedProduct.image_url} alt={selectedProduct.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            </div>
                        )}
                        <button onClick={() => setSelectedProduct(null)} style={{ position: 'absolute', top: '16px', right: '16px', width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(0,0,0,0.4)', color: '#fff', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2 }}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                        </button>
                        <div style={{ padding: '20px' }}>
                            <h2 style={{ margin: '0 0 8px 0', fontSize: '18px', fontWeight: '800', color: colors.text }}>{selectedProduct.name}</h2>
                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
                                <span style={{ fontSize: '11px', background: '#6366F1', color: '#fff', padding: '3px 10px', borderRadius: '12px', fontWeight: '600' }}>{selectedProduct.category}</span>
                                <span style={{ fontSize: '11px', background: isDark ? 'rgba(255,255,255,0.1)' : '#f1f5f9', color: colors.textSecondary, padding: '3px 10px', borderRadius: '12px', fontWeight: '600', textTransform: 'capitalize' }}>{selectedProduct.platform}</span>
                                {selectedProduct.weight !== '—' && <span style={{ fontSize: '11px', background: isDark ? 'rgba(255,255,255,0.1)' : '#f1f5f9', color: colors.textSecondary, padding: '3px 10px', borderRadius: '12px', fontWeight: '600' }}>{selectedProduct.weight}</span>}
                            </div>
                            {selectedProduct.description && <p style={{ fontSize: '13px', color: colors.textSecondary, marginBottom: '16px', lineHeight: '1.5' }}>{selectedProduct.description}</p>}
                            <div style={{ background: isDark ? 'rgba(255,255,255,0.03)' : '#f9fafb', border: `1px solid ${colors.border}`, borderRadius: '12px', padding: '14px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div>
                                        <div style={{ fontSize: '11px', color: colors.textSecondary }}>Competiție ({selectedProduct.compBrand})</div>
                                        <div style={{ fontSize: '18px', fontWeight: '800', color: colors.text }}>{selectedProduct.compPrice} lei</div>
                                    </div>
                                    {selectedProduct.hasExactMatch && (
                                        <>
                                            <div style={{ fontSize: '11px', color: colors.textSecondary, textAlign: 'center' }}>vs</div>
                                            <div style={{ textAlign: 'right' }}>
                                                <div style={{ fontSize: '11px', color: colors.textSecondary }}>Noi ({selectedProduct.ourBrand})</div>
                                                <div style={{ fontSize: '18px', fontWeight: '800', color: '#6366F1' }}>{selectedProduct.ourPrice} lei</div>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                            {selectedProduct.compUrl && (
                                <a href={selectedProduct.compUrl} target="_blank" rel="noopener noreferrer"
                                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginTop: '12px', padding: '12px', background: isDark ? 'rgba(255,255,255,0.05)' : '#fff', border: `1px solid ${colors.border}`, borderRadius: '10px', color: colors.text, textDecoration: 'none', fontSize: '13px', fontWeight: '600' }}>
                                    Deschide pagina restaurantului
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                                </a>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
