import { useState, useEffect, useCallback, useMemo } from 'react'
import { useTheme } from '../lib/ThemeContext'
import { supabase } from '../lib/supabaseClient'

const WORKER_URL = import.meta.env.VITE_WORKER_URL || 'http://localhost:3001'

const SpinIcon = () => (
    <span style={{ display: 'inline-block', width: 13, height: 13, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
)

export default function IikoProducts() {
    const { colors, isDark } = useTheme()
    
    const [brands, setBrands] = useState([])
    const [restaurants, setRestaurants] = useState([])
    const [products, setProducts] = useState([])
    const [loading, setLoading] = useState(false)
    const [errorMsg, setErrorMsg] = useState(null)
    
    // Filters
    const [selectedBrand, setSelectedBrand] = useState('all')
    const [selectedCity, setSelectedCity] = useState('all')
    const [search, setSearch] = useState('')
    
    // UI state
    const [collapsedCities, setCollapsedCities] = useState({})
    const [collapsedRestaurants, setCollapsedRestaurants] = useState({})

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

    const loadProducts = useCallback(async () => {
        setLoading(true)
        setErrorMsg(null)
        try {
            const params = new URLSearchParams()
            if (selectedCity !== 'all') params.append('city', selectedCity)
            if (selectedBrand !== 'all') {
                const brand = brands.find(b => b.id === selectedBrand)
                if (brand) params.append('brand', brand.name)
            }
            
            const res = await fetch(`${WORKER_URL}/api/pos/products?${params.toString()}`)
            const data = await res.json()
            if (!data.success) throw new Error(data.error || data.message || 'Eroare la preluarea datelor')
            
            setProducts(data.results || [])
        } catch (err) {
            setErrorMsg(err.message)
            setProducts([])
        } finally {
            setLoading(false)
        }
    }, [selectedCity, selectedBrand, brands])

    useEffect(() => {
        loadProducts()
    }, [loadProducts])

    // Grouping
    const grouped = useMemo(() => {
        let list = products
        if (search) {
            const q = search.toLowerCase().trim()
            list = list.filter(p => 
                (p.name || '').toLowerCase().includes(q) || 
                (p.category || '').toLowerCase().includes(q) ||
                (p.sku || '').toLowerCase().includes(q)
            )
        }
        
        const byCity = {}
        list.forEach(p => {
            const city = p.city || 'Necunoscut'
            const rid = p.restaurant_id
            if (!byCity[city]) byCity[city] = {}
            if (!byCity[city][rid]) byCity[city][rid] = { name: p.restaurant_name, brand: p.brand_name, items: [] }
            byCity[city][rid].items.push(p)
        })
        
        return Object.entries(byCity).sort(([a], [b]) => a.localeCompare(b)).map(([city, restMap]) => ({
            city,
            restaurants: Object.entries(restMap).map(([rid, info]) => ({
                rid,
                name: info.name,
                brand: info.brand,
                items: info.items.sort((a,b) => (a.category || '').localeCompare(b.category || '') || (a.name || '').localeCompare(b.name || ''))
            })).sort((a,b) => a.name.localeCompare(b.name))
        }))
    }, [products, search])

    const toggleCity = (city) => setCollapsedCities(prev => ({ ...prev, [city]: !prev[city] }))
    const toggleRest = (rid) => setCollapsedRestaurants(prev => ({ ...prev, [rid]: !prev[rid] }))

    const sel = { padding: '7px 10px', borderRadius: '8px', border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`, background: isDark ? 'rgba(255,255,255,0.05)' : '#fff', color: colors.text, fontSize: '12px', cursor: 'pointer' }

    return (
        <div style={{ padding: '24px 28px', minHeight: '100vh' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '20px', gap: '12px', flexWrap: 'wrap' }}>
                <div>
                    <h1 style={{ margin: 0, fontSize: '20px', fontWeight: '800', color: colors.text, letterSpacing: '-0.4px' }}>Produse POS (iiko)</h1>
                    <p style={{ margin: '3px 0 0', fontSize: '12px', color: colors.textSecondary }}>
                        Sincronizare în timp real a meniului direct din sistemul POS.
                    </p>
                </div>
                <button onClick={loadProducts} disabled={loading}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '9px', border: 'none', background: loading ? 'rgba(99,102,241,0.4)' : 'linear-gradient(135deg,#6366F1,#8B5CF6)', color: '#fff', fontSize: '13px', fontWeight: '700', cursor: loading ? 'wait' : 'pointer', boxShadow: loading ? 'none' : '0 3px 12px rgba(99,102,241,0.35)' }}>
                    {loading ? <><SpinIcon /> Se sincronizează...</> : 'Sincronizează Acum'}
                </button>
            </div>

            {errorMsg && (
                <div style={{ padding: '10px 14px', borderRadius: '8px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', fontSize: '13px', fontWeight: '600', marginBottom: '16px' }}>
                    {errorMsg}
                </div>
            )}

            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '20px', padding: '10px 14px', borderRadius: '10px', background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)', border: `1px solid ${isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)'}` }}>
                <select value={selectedBrand} onChange={e => setSelectedBrand(e.target.value)} style={sel}>
                    <option value="all">Toate brandurile</option>
                    {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
                <select value={selectedCity} onChange={e => setSelectedCity(e.target.value)} style={sel}>
                    <option value="all">Toate orașele</option>
                    {cities.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Caută produs sau cod..." style={{ ...sel, minWidth: '200px' }} />
                
                <div style={{ marginLeft: 'auto', display: 'flex', gap: '6px' }}>
                    <button onClick={() => setCollapsedCities({})} style={{ fontSize: '11px', padding: '4px 10px', borderRadius: '7px', border: `1px solid ${colors.border}`, background: 'transparent', cursor: 'pointer', color: colors.textSecondary }}>Extinde tot</button>
                    <button onClick={() => {
                        const all = {}
                        grouped.forEach(g => { all[g.city] = true; g.restaurants.forEach(r => { all[r.rid] = true }) })
                        setCollapsedCities(all); setCollapsedRestaurants(all)
                    }} style={{ fontSize: '11px', padding: '4px 10px', borderRadius: '7px', border: `1px solid ${colors.border}`, background: 'transparent', cursor: 'pointer', color: colors.textSecondary }}>Restrânge tot</button>
                </div>
            </div>

            {loading ? (
                <div style={{ textAlign: 'center', padding: '80px', color: colors.textSecondary }}>
                    <div style={{ width: 36, height: 36, border: `3px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}`, borderTopColor: '#6366F1', borderRadius: '50%', animation: 'spin 0.7s linear infinite', margin: '0 auto 16px' }} />
                    <div>Se încarcă produsele din iiko...</div>
                </div>
            ) : grouped.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px', color: colors.textSecondary, background: isDark ? 'rgba(255,255,255,0.02)' : '#fff', borderRadius: '14px', border: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}` }}>
                    Nu au fost găsite produse pentru filtrele selectate.
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {grouped.map(({ city, restaurants }) => {
                        const cityCollapsed = collapsedCities[city]
                        const totalProds = restaurants.reduce((sum, r) => sum + r.items.length, 0)
                        
                        return (
                            <div key={city}>
                                <button onClick={() => toggleCity(city)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 16px', background: isDark ? 'rgba(99,102,241,0.1)' : 'rgba(99,102,241,0.07)', border: `1px solid ${isDark ? 'rgba(99,102,241,0.2)' : 'rgba(99,102,241,0.15)'}`, borderRadius: cityCollapsed ? '10px' : '10px 10px 0 0', cursor: 'pointer', textAlign: 'left' }}>
                                    <span style={{ fontSize: '11px', color: '#6366F1', transform: cityCollapsed ? 'rotate(0deg)' : 'rotate(90deg)', transition: 'transform 0.15s', display: 'inline-block', lineHeight: 1 }}>▶</span>
                                    <span style={{ fontSize: '15px', fontWeight: '800', color: '#6366F1', flex: 1 }}>{city}</span>
                                    <span style={{ fontSize: '11px', color: colors.textSecondary, background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)', padding: '2px 8px', borderRadius: '10px' }}>
                                        {restaurants.length} restaurante · {totalProds} produse
                                    </span>
                                </button>
                                
                                {!cityCollapsed && (
                                    <div style={{ border: `1px solid ${isDark ? 'rgba(99,102,241,0.2)' : 'rgba(99,102,241,0.15)'}`, borderTop: 'none', borderRadius: '0 0 10px 10px', overflow: 'hidden' }}>
                                        {restaurants.map((rest, ri) => {
                                            const restCollapsed = collapsedRestaurants[rest.rid]
                                            const isLast = ri === restaurants.length - 1
                                            
                                            return (
                                                <div key={rest.rid} style={{ borderBottom: isLast ? 'none' : `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}` }}>
                                                    <button onClick={() => toggleRest(rest.rid)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 16px', background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
                                                        <span style={{ fontSize: '10px', color: colors.textSecondary, transform: restCollapsed ? 'rotate(0deg)' : 'rotate(90deg)', transition: 'transform 0.15s', display: 'inline-block' }}>▶</span>
                                                        <div style={{ flex: 1 }}>
                                                            <div style={{ fontSize: '13px', fontWeight: '700', color: colors.text }}>{rest.name}</div>
                                                            <div style={{ fontSize: '11px', color: colors.textSecondary, display: 'flex', gap: '6px', marginTop: '2px' }}>
                                                                <span style={{ color: '#8b5cf6', fontWeight: '600' }}>{rest.brand}</span>
                                                            </div>
                                                        </div>
                                                        <span style={{ fontSize: '11px', color: colors.textSecondary, background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)', padding: '2px 8px', borderRadius: '8px' }}>
                                                            {rest.items.length} produse
                                                        </span>
                                                    </button>
                                                    
                                                    {!restCollapsed && (
                                                        <div style={{ padding: '0', background: isDark ? 'rgba(255,255,255,0.01)' : '#fff' }}>
                                                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                                                                <thead>
                                                                    <tr style={{ background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)', color: colors.textSecondary, textAlign: 'left' }}>
                                                                        <th style={{ padding: '8px 16px', fontWeight: '600', width: '30%' }}>Produs</th>
                                                                        <th style={{ padding: '8px 16px', fontWeight: '600', width: '25%' }}>Categorie</th>
                                                                        <th style={{ padding: '8px 16px', fontWeight: '600', width: '15%' }}>SKU / Cod</th>
                                                                        <th style={{ padding: '8px 16px', fontWeight: '600', width: '15%' }}>Mărime</th>
                                                                        <th style={{ padding: '8px 16px', fontWeight: '600', textAlign: 'right', width: '15%' }}>Preț POS</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody>
                                                                    {rest.items.map((it, idx) => (
                                                                        <tr key={it.iiko_id + idx} style={{ borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}` }}>
                                                                            <td style={{ padding: '8px 16px', color: colors.text, fontWeight: '500' }}>
                                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                                                    <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: it.is_available ? '#10b981' : '#ef4444' }} title={it.is_available ? 'Disponibil' : 'Stop-list'} />
                                                                                    {it.name}
                                                                                </div>
                                                                            </td>
                                                                            <td style={{ padding: '8px 16px', color: colors.textSecondary }}>{it.category}</td>
                                                                            <td style={{ padding: '8px 16px', color: colors.textSecondary, fontFamily: 'monospace' }}>{it.sku || '-'}</td>
                                                                            <td style={{ padding: '8px 16px', color: colors.textSecondary }}>{it.weight ? `${it.weight} ${it.measure_unit || ''}` : '-'}</td>
                                                                            <td style={{ padding: '8px 16px', color: colors.text, fontWeight: '700', textAlign: 'right' }}>{it.price ? `${it.price.toFixed(2)} RON` : '-'}</td>
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
                            </div>
                        )
                    })}
                </div>
            )}
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
    )
}
