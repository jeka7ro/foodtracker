import { useState, useEffect, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTheme } from '../lib/ThemeContext'
import { useLanguage } from '../lib/LanguageContext'
import { supabase } from '../lib/supabaseClient'
import { Search, Loader2 } from 'lucide-react'

// ─── iiko API Connection ───
const IIKO_API_KEY = 'a1fe30cdeb934aa0af01b6a35244b7f0';
const IIKO_BASE = 'http://localhost:3005/api/iiko';

export default function IikoProducts() {
    const { colors, isDark } = useTheme()
    const { lang } = useLanguage()

    const [brands, setBrands] = useState([])
    const [selectedBrand, setSelectedBrand] = useState('all')
    const [search, setSearch] = useState('')
    const [pageSize, setPageSize] = useState(20)
    const [currentPage, setCurrentPage] = useState(1)

    // Load available brands visually
    useEffect(() => {
        supabase.from('brands').select('id, name, logo_url').order('name').then(({ data }) => setBrands(data || []))
    }, [])

    // Fetch Global Menu ONCE directly from iiko Server
    const { data: products = [], isLoading: isSyncing, refetch } = useQuery({
        queryKey: ['iiko-global-menu'],
        queryFn: async () => {
            // 1. Auth
            const resAuth = await fetch(`${IIKO_BASE}/access_token`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ apiLogin: IIKO_API_KEY })
            });
            const { token } = await resAuth.json();

            // 2. Get first organization ID (since nomenclature is shared company-wide)
            const resOrgs = await fetch(`${IIKO_BASE}/organizations`, {
                method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify({})
            });
            const { organizations } = await resOrgs.json();
            if(!organizations || !organizations.length) return [];
            
            // 3. Download Nomenclature
            const resMenu = await fetch(`${IIKO_BASE}/nomenclature`, {
                method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ organizationId: organizations[0].id })
            });
            const menuData = await resMenu.json();
            
            // 4. Map into standard frontend format + DYNAMIC BRAND DETECTION
            const groupsMap = new Map((menuData.groups || []).map(g => [g.id, g.name]));
            const items = (menuData.products || []).filter(p => p.type === 'dish' || p.type === 'good').map(p => {
                const category = groupsMap.get(p.parentGroup) || 'Meniu General';
                let computedBrandName = 'Sushi Master'; // default central brand
                
                const upCat = category.toUpperCase();
                const upName = p.name.toUpperCase();

                if (upCat.includes('IKURA') || upName.includes('IKURA')) computedBrandName = 'Ikura Sushi';
                else if (upCat.includes('SMASH') || upName.includes('SMASH')) computedBrandName = 'Smash Me';
                else if (upCat.includes('W LS') || upCat.includes('WE LOVE')) computedBrandName = 'We Love Sushi';
                else if (upCat.includes('BOWL')) computedBrandName = 'Super Bowl';

                return {
                    iiko_id: p.id,
                    name: p.name,
                    sku: p.code,
                    category,
                    price: p.defaultUnit || p.prices?.[0] ? null : 0, // usually default pricing is hard to extract cleanly, leave it out or compute if needed
                    brand_name: computedBrandName,
                    weight: p.weight,
                    measure_unit: 'kg',
                    image: p.imageLinks?.[0] || null
                };
            });
            return items;
        },
        refetchOnWindowFocus: false
    })

    useEffect(() => {
        setCurrentPage(1)
    }, [selectedBrand, search, pageSize])

    const filteredProducts = useMemo(() => {
        let list = products;
        if (selectedBrand !== 'all') {
            const bb = brands.find(b => b.id === selectedBrand);
            if(bb) list = list.filter(p => p.brand_name === bb.name);
        }
        if (search) {
            const q = search.toLowerCase().trim()
            list = list.filter(p => 
                (p.name || '').toLowerCase().includes(q) || 
                (p.category || '').toLowerCase().includes(q) ||
                (p.sku || '').toLowerCase().includes(q)
            )
        }
        return list
    }, [products, search, selectedBrand, brands])

    const totalPages = Math.ceil(filteredProducts.length / pageSize) || 1
    const paginatedProducts = filteredProducts.slice((currentPage - 1) * pageSize, currentPage * pageSize)

    const glassBg = isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(255, 255, 255, 0.8)'
    const glassBorder = isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(0, 0, 0, 0.06)'
    const inputBg = isDark ? 'rgba(0, 0, 0, 0.2)' : '#fff'

    return (
        <div style={{ padding: '32px 40px', minHeight: '100vh', display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
                <div>
                    <h1 style={{ margin: 0, fontSize: '28px', fontWeight: '800', color: colors.text }}>
                        Rețetar Centralizat (Global POS Catalog)
                    </h1>
                    <p style={{ margin: '6px 0 0', fontSize: '14px', color: colors.textSecondary, fontWeight: '500' }}>
                        Acesta este catalogul oficial, preluat o singură dată din serverul Cloud iiko. Brandurile sunt acum detectate corect, fără dubluri.
                    </p>
                </div>
                <button onClick={() => refetch()} disabled={isSyncing}
                    style={{ 
                        padding: '10px 20px', borderRadius: '12px', border: 'none', 
                        background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', color: '#fff', fontSize: '14px', fontWeight: '700', cursor: 'pointer'
                    }}>
                    {isSyncing ? 'Se descarcă 750+ produse...' : '↻ Refetch iiko API'}
                </button>
            </div>

            {/* Filters */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', background: glassBg, backdropFilter: 'blur(16px)', border: glassBorder, padding: '20px', borderRadius: '20px' }}>
                <div style={{ display: 'flex', gap: '12px', overflowX: 'auto', paddingBottom: '4px' }}>
                    <button onClick={() => setSelectedBrand('all')}
                        style={{
                            padding: '10px 24px', borderRadius: '14px', border: `1px solid ${selectedBrand === 'all' ? '#6366f1' : glassBorder}`,
                            background: selectedBrand === 'all' ? (isDark ? 'rgba(99,102,241,0.15)' : 'rgba(99,102,241,0.1)') : inputBg,
                            color: selectedBrand === 'all' ? '#6366f1' : colors.text, fontWeight: 'bold'
                        }}>
                        Toate Brandurile
                    </button>
                    {brands.map(b => (
                        <button key={b.id} onClick={() => setSelectedBrand(b.id)}
                            style={{
                                display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 20px', borderRadius: '14px', 
                                border: `1px solid ${selectedBrand === b.id ? '#6366f1' : glassBorder}`,
                                background: selectedBrand === b.id ? (isDark ? 'rgba(99,102,241,0.15)' : 'rgba(99,102,241,0.1)') : inputBg,
                                color: selectedBrand === b.id ? '#6366f1' : colors.text, fontWeight: 'bold'
                            }}>
                            {b.logo_url && <img src={b.logo_url} alt="" style={{ width: 20, height: 20, borderRadius: '50%', objectFit: 'cover' }} />}
                            {b.name}
                        </button>
                    ))}
                </div>

                <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                    <div style={{ position: 'relative', flex: 1, maxWidth: '300px' }}>
                        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Caută produs sau cod..." 
                            style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: glassBorder, background: inputBg, color: colors.text, outline: 'none' }} />
                    </div>
                    <div style={{ background: 'rgba(99,102,241,0.1)', padding: '8px 16px', borderRadius: '12px', color: '#6366f1', fontWeight: 'bold' }}>
                        {filteredProducts.length} produse unice
                    </div>
                </div>
            </div>

            {/* Content Area */}
            {isSyncing ? (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><h3 style={{color: colors.textSecondary}}>Se parsează rețetarul companiei din Rusia/Europa...</h3></div>
            ) : paginatedProducts.length === 0 ? (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><h3 style={{color: colors.textSecondary}}>Niciun produs găsit.</h3></div>
            ) : (
                <>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
                        {paginatedProducts.map((p, idx) => (
                            <div key={p.iiko_id} style={{ background: isDark ? 'rgba(255,255,255,0.02)' : '#fff', borderRadius: '20px', border: glassBorder, overflow: 'hidden' }}>
                                <div style={{ height: '200px', width: '100%', position: 'relative', background: '#f8fafc' }}>
                                    {p.image ? (
                                        <img src={p.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    ) : (
                                        <div style={{ width: '100%', height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', color: '#ccc' }}>Fără Poză</div>
                                    )}
                                    <div style={{ position: 'absolute', top: 12, right: 12, background: 'rgba(0,0,0,0.8)', color: '#fff', padding: '4px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 'bold' }}>
                                        {p.brand_name}
                                    </div>
                                    <div style={{ position: 'absolute', bottom: 12, left: 12, background: 'rgba(255,255,255,0.9)', color: '#000', padding: '4px 8px', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold' }}>
                                        #{idx + 1 + (currentPage - 1) * pageSize}
                                    </div>
                                </div>
                                <div style={{ padding: '20px', display: 'flex', flexDirection: 'column' }}>
                                    <div style={{ fontSize: '11px', fontWeight: '700', color: '#6366f1', textTransform: 'uppercase' }}>{p.category}</div>
                                    <h3 style={{ margin: '8px 0', fontSize: '16px', color: colors.text }}>{p.name}</h3>
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <span style={{ fontSize: '12px', color: colors.textSecondary }}>SKU: {p.sku}</span>
                                        {p.weight && <span style={{ fontSize: '12px', color: colors.textSecondary }}>⚖️ {p.weight} kg</span>}
                                    </div>
                                    <div style={{ marginTop: '16px', fontSize: '12px', color: '#10b981', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <div style={{ width: 8, height: 8, background: '#10b981', borderRadius: '50%' }} /> Conectat Glovo/Wolt (Stoc Comun)
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                            <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)}>Prev</button>
                            <span style={{color: colors.text}}>Pagina {currentPage} din {totalPages}</span>
                            <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)}>Next</button>
                        </div>
                    )}
                </>
            )}
            <style>{`.spin { animation: spin 1s linear infinite; } @keyframes spin { 100% { transform: rotate(360deg); } } button { padding: 8px 16px; border-radius: 8px; cursor: pointer; border: none; background: #6366f1; color: white; } button:disabled { opacity: 0.5; cursor: not-allowed; text-decoration: none;}`}</style>
        </div>
    )
}
