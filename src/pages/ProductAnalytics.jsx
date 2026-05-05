import React, { useState, useMemo, useEffect } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useTheme } from '../lib/ThemeContext'
import { useLanguage } from '../lib/LanguageContext'
import { supabase } from '../lib/supabaseClient'
import { LineChart, Line, BarChart, Bar, ComposedChart, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, AreaChart, Area } from 'recharts'
import { ArrowLeft, Package, MapPin, TrendingUp, DollarSign, Calendar, Activity, ListOrdered, Navigation, Clock } from 'lucide-react'
import './Performance.css'

const IIKO_API_KEY = 'a1fe30cdeb934aa0af01b6a35244b7f0'

// ── Romanian holiday utilities ──────────────────────────────────────────────
function orthodoxEaster(year) {
    const a = year % 19, b = year % 4, c = year % 7
    const d = (19 * a + 15) % 30
    const e = (2 * b + 4 * c + 6 * d + 6) % 7
    const month = Math.floor((d + e + 114) / 31)
    const day = ((d + e + 114) % 31) + 1
    const julian = new Date(year, month - 1, day)
    julian.setDate(julian.getDate() + 13)   // Julian → Gregorian
    return julian
}

function getRomanianHolidays(year) {
    const easter = orthodoxEaster(year)
    const addDays = (d, n) => { const r = new Date(d); r.setDate(r.getDate() + n); return r }
    const fmt = (d) => `${String(d.getDate()).padStart(2,'0')}-${String(d.getMonth()+1).padStart(2,'0')}`
    const e = easter
    const legal = [
        { d: `01-01`, label: '🎆 Anul Nou' },
        { d: `02-01`, label: '🎆 Anul Nou' },
        { d: `24-01`, label: '🇷🇴 Unirea' },
        { d: `01-05`, label: '⚒ Muncii' },
        { d: `01-06`, label: '🧒 Copilului' },
        { d: `15-08`, label: '✝️ Sf. Maria' },
        { d: `30-11`, label: '✝️ Sf. Andrei' },
        { d: `01-12`, label: '🇷🇴 Ziua Națională' },
        { d: `25-12`, label: '🎄 Crăciun' },
        { d: `26-12`, label: '🎄 Crăciun' },
        { d: fmt(addDays(e, -2)), label: '✝️ Vinerea Mare' },
        { d: fmt(e),             label: '✝️ Paști' },
        { d: fmt(addDays(e, 1)), label: '✝️ Paști' },
        { d: fmt(addDays(e, 39)), label: '✝️ Înălțarea' },
        { d: fmt(addDays(e, 49)), label: '✝️ Rusalii' },
        { d: fmt(addDays(e, 50)), label: '✝️ Rusalii' },
    ]
    const special = [
        { d: `14-02`, label: '❤️ Dragobete' },
        { d: `01-03`, label: '🌸 Mărțișor' },
        { d: `08-03`, label: '🌷 8 Martie' },
        { d: `31-12`, label: '🥂 Revelion' },
    ]
    const map = {}
    ;[...legal, ...special].forEach(h => { map[h.d] = { label: h.label, legal: legal.some(l => l.d === h.d) } })
    return map
}
// ─────────────────────────────────────────────────────────────────────────────

export default function ProductAnalytics() {
    const { productName } = useParams()
    const decodedName = decodeURIComponent(productName)
    const { isDark } = useTheme()
    const { lang } = useLanguage()
    const navigate = useNavigate()

    const [searchParams] = useSearchParams()
    const initialPeriod = searchParams.get('period') || localStorage.getItem('analyticsActivePeriod') || 'week'
    const [activePeriod, setActivePeriodState] = useState(initialPeriod)

    const setActivePeriod = (p) => {
        setActivePeriodState(p)
        localStorage.setItem('analyticsActivePeriod', p)
    }
    const [pageNumber, setPageNumber] = useState(1)
    const [itemsPerPage, setItemsPerPage] = useState(20)
    const [salesData, setSalesData] = useState([])
    const [restaurants, setRestaurants] = useState([])
    const [isLoading, setIsLoading] = useState(true)
    const [productImage, setProductImage] = useState(null)
    const [lightboxOpen, setLightboxOpen] = useState(false)
    const [selectedRows, setSelectedRows] = useState(new Set())

    const t = (key) => {
        const d = {
            today: { ro: 'Azi', en: 'Today', ru: 'Сегодня' },
            yesterday: { ro: 'Ieri', en: 'Yesterday', ru: 'Вчера' },
            week: { ro: 'Săpt. Cur.', en: 'This Week', ru: 'Эта Неделя' },
            month: { ro: 'Luna Curentă', en: 'This Month', ru: 'Этот месяц' },
            lastmonth: { ro: 'Luna Trecută', en: 'Last Month', ru: 'Прошлый месяц' },
            year: { ro: 'Anul Curent', en: 'This Year', ru: 'Этот год' },
            totalRev: { ro: 'Venit Generat', en: 'Total Revenue', ru: 'Выручка' },
            totalUnits: { ro: 'Bucăți Vândute', en: 'Units Sold', ru: 'Продано штук' },
            avgPrice: { ro: 'Preț Mediu (AOV)', en: 'Avg Price', ru: 'Средняя цена' },
            chartDyn: { ro: 'Dinamica Vânzărilor', en: 'Sales Dynamics', ru: 'Динамика продаж' },
            chartLoc: { ro: 'Performanța pe Locații', en: 'Locations Performance', ru: 'Продажи по локациям' },
            sales: { ro: 'Vânzări', en: 'Sales', ru: 'Продажи' },
            units: { ro: 'Bucăți', en: 'Units', ru: 'Штуки' },
            noData: { ro: 'Niciun argument pentru perioada selectată', en: 'No data for selected period', ru: 'Нет данных за выбранный период' },
            recentSalesTitle: { ro: 'Tranzacții Recente Detaliate', en: 'Detailed Recent Transactions', ru: 'Детализированные последние транзакции' },
            colDate: { ro: 'Data & Ora', en: 'Date & Time', ru: 'Дата и время' },
            colLocation: { ro: 'Locație', en: 'Location', ru: 'Локация' },
            colPlatform: { ro: 'Platformă', en: 'Platform', ru: 'Платформа' },
            colQty: { ro: 'Cantitate', en: 'Quantity', ru: 'Кол-во' },
            colRev: { ro: 'Total Generat', en: 'Total Generated', ru: 'Итого Выручка' }
        }
        return d[key]?.[lang || 'ro'] || key
    }

    const parseItemName = (name) => {
        if (!name) return 'Produs Necunoscut';
        let clean = name.trim();
        if (clean.toUpperCase().startsWith('P_')) clean = clean.substring(2);
        clean = clean.replace(/SushiMaster/ig, '').trim();
        clean = clean.replace(/♥LOVE♥/ig, 'la').trim();
        clean = clean.replace(/\u00A0/g, ' ').trim();
        clean = clean.replace(/^\d+\.\s*/, '').trim();
        return clean.trim() || name;
    }

    useEffect(() => {
        async function fetchImage() {
            try {
                const { data: rests } = await supabase.from('restaurants').select('iiko_config, iiko_restaurant_id, brands(name)').not('iiko_config', 'is', null)
                if (!rests || rests.length === 0) return

                // Collect all unique org IDs across all restaurants and servers, along with their assigned server
                const orgTargets = []
                const seenOrg = new Set()
                rests.forEach(r => {
                    const orgId = r.iiko_config?.organizationId || r.iiko_restaurant_id
                    if (!orgId || seenOrg.has(orgId)) return
                    seenOrg.add(orgId)
                    const brandName = (r.brands?.name || '').toLowerCase()
                    const server = brandName.includes('smash') ? 'smashme-co.syrve.online' : 'api-eu.syrve.live'
                    orgTargets.push({ orgId, server })
                })
                if (orgTargets.length === 0) return

                const workerUrl = import.meta.env.VITE_WORKER_URL || 'http://localhost:3001'
                
                // Strip prefixes to get a clean search name
                let cleanName = decodedName.split('[')[0].trim()
                if (cleanName.toUpperCase().startsWith('P_')) cleanName = cleanName.substring(2)
                if (cleanName.toUpperCase().startsWith('I_')) cleanName = cleanName.substring(2)
                if (cleanName.toUpperCase().startsWith('W_')) cleanName = cleanName.substring(2)
                const cleanNameText = cleanName.toLowerCase().trim()
                
                const excludeWords = ['sushimaster', 'sushi', 'master', 'bucuresti', 'brasov', 'constanta', 'iasi', 'meniu']
                const cleanWords = cleanNameText.replace(/[^a-z0-9\s]/g, '').split(' ')
                    .filter(w => w.length > 2 && !excludeWords.includes(w))

                // Query all orgs in parallel and stop when we find a match
                for (const { orgId, server } of orgTargets) {
                    try {
                        const resp = await fetch(`${workerUrl}/api/nomenclature?orgId=${orgId}&server=${server}`)
                        if (!resp.ok) continue
                        const data = await resp.json()
                        
                        const fullList = [...(data.products || []), ...(data.groups || [])]
                        
                        // 1. Exact substring match
                        let found = fullList.find(p => p.name?.toLowerCase().includes(cleanNameText))
                        
                        // 2. Fuzzy keyword match
                        if (!found && cleanWords.length > 0) {
                            found = fullList.find(p => {
                                const n = p.name?.toLowerCase() || ''
                                return cleanWords.every(w => n.includes(w))
                            })
                        }
                        
                        if (found?.imageLinks?.length > 0) {
                            setProductImage(found.imageLinks[0])
                            return // Found it, stop searching
                        }
                    } catch(e) { /* continue to next org */ }
                }
            } catch(e) { console.log('Image fetch fail', e) }
        }
        fetchImage()
    }, [decodedName])

    useEffect(() => {
        setIsLoading(true)
        setPageNumber(1)
        async function load() {
            const { data: rData } = await supabase.from('restaurants').select('id, name')
            setRestaurants(rData || [])

            const now = new Date()
            let fromDate = new Date(now)
            let toDate = new Date(now)
            
            if (activePeriod === 'today') {
                fromDate.setHours(0,0,0,0)
            } else if (activePeriod === 'yesterday') {
                fromDate.setDate(fromDate.getDate() - 1)
                fromDate.setHours(0,0,0,0)
                toDate.setHours(0,0,0,0) 
            } else if (activePeriod === 'week') {
                fromDate.setDate(fromDate.getDate() - 7)
                fromDate.setHours(0,0,0,0)
            } else if (activePeriod === 'month') {
                fromDate = new Date(now.getFullYear(), now.getMonth(), 1)
            } else if (activePeriod === 'lastmonth') {
                fromDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
                toDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999)
            } else if (activePeriod === 'year') {
                fromDate = new Date(now.getFullYear(), 0, 1)
            }

            let countQuery = supabase.from('platform_sales').select('*', { count: 'exact', head: true })
                .gte('placed_at', fromDate.toISOString())
                .lte('placed_at', toDate.toISOString())

            const { count } = await countQuery
            
            let allData = []
            if (count && count > 0) {
                const step = 1000
                const promises = []
                for (let i = 0; i < count; i += step) {
                    let query = supabase.from('platform_sales').select('*')
                        .gte('placed_at', fromDate.toISOString())
                        .lte('placed_at', toDate.toISOString())
                        .range(i, i + step - 1)
                    promises.push(query.then(res => res.data || []))
                }
                const chunks = await Promise.all(promises)
                allData = chunks.flat()
            }

            if (!allData || allData.length === 0) { setSalesData([]); setIsLoading(false); return }

            // Exactly match the product name
            const matchItems = allData.filter(d => {
                if (!d.items) return false
                return d.items.some(it => {
                    const parsed = parseItemName(it.product_name || it.name)
                    return parsed === decodedName
                })
            })
            
            setSalesData(matchItems)
            setSelectedRows(new Set())
            setIsLoading(false)
        }
        load()
    }, [activePeriod, decodedName])

    const { rev, units, chartDynamic, chartLocations, recentTransactions, priceStats } = useMemo(() => {
        let totalRev = 0
        let totalUnits = 0
        const mapDyn = {}
        const mapLoc = {}
        const transactionsList = []

        salesData.forEach(sale => {
            let pQty = 0
            sale.items.forEach(it => {
                const parsed = parseItemName(it.product_name || it.name)
                if (parsed === decodedName) {
                    pQty += parseInt(it.quantity) || 1
                }
            })
            
            if (pQty === 0) return

            const totalQtyAllItems = sale.items.reduce((sum, i) => sum + (parseInt(i.quantity)||1), 0)
            const approxPricePerItem = parseFloat(sale.total_amount) / (totalQtyAllItems || 1)
            const thisRev = approxPricePerItem * pQty
            
            totalRev += thisRev
            totalUnits += pQty

            const rInfo = restaurants.find(r => r.id === sale.restaurant_id)
            const rName = rInfo ? rInfo.name : `Rest. ${sale.restaurant_id}`

            transactionsList.push({
                id: sale.id + '-' + Math.random().toString(36).substring(7),
                date: new Date(sale.placed_at),
                locationName: rName,
                platform: sale.platform,
                qty: pQty,
                revenue: thisRev
            })

            const dt = new Date(sale.placed_at)
            let dk = ''
            let ts = dt.getTime()
            if (activePeriod === 'today' || activePeriod === 'yesterday') {
                dk = `${String(dt.getHours()).padStart(2,'0')}:00`
                ts = dt.getHours()
            } else {
                dk = dt.toLocaleDateString('ro-RO', { day: '2-digit', month: 'short' })
            }
            if (!mapDyn[dk]) mapDyn[dk] = { name: dk, rev: 0, units: 0, _ts: ts }
            mapDyn[dk].rev += thisRev
            mapDyn[dk].units += pQty

            if (!mapLoc[rName]) mapLoc[rName] = { name: rName, rev: 0, units: 0 }
            mapLoc[rName].rev += thisRev
            mapLoc[rName].units += pQty
        })

        // Price stats per location — filter outliers via IQR before averaging
        const priceByLoc = {}
        salesData.forEach(sale => {
            const matchedItems = (sale.items || []).filter(it => {
                const parsed = parseItemName(it.product_name || it.name)
                return parsed === decodedName
            })
            if (!matchedItems.length) return
            const rInfo = restaurants.find(r => r.id === sale.restaurant_id)
            const rName = rInfo ? rInfo.name : `Rest. ${sale.restaurant_id}`
            const totalQtyAllItems = (sale.items || []).reduce((sum, i) => sum + (parseInt(i.quantity) || 1), 0)
            const pricePerUnit = parseFloat(sale.total_amount || 0) / (totalQtyAllItems || 1)
            if (pricePerUnit <= 0) return
            if (!priceByLoc[rName]) priceByLoc[rName] = { name: rName, prices: [], total: 0, count: 0, revenue: 0 }
            matchedItems.forEach(() => {
                priceByLoc[rName].prices.push(pricePerUnit)
                priceByLoc[rName].total += pricePerUnit
                priceByLoc[rName].count++
                priceByLoc[rName].revenue += pricePerUnit
            })
        })

        // IQR outlier filter per location
        const iqrFilter = (prices) => {
            if (prices.length < 4) return prices  // not enough data to filter
            const sorted = [...prices].sort((a, b) => a - b)
            const q1 = sorted[Math.floor(sorted.length * 0.25)]
            const q3 = sorted[Math.floor(sorted.length * 0.75)]
            const iqr = q3 - q1
            const lo = q1 - 1.5 * iqr
            const hi = q3 + 1.5 * iqr
            return sorted.filter(p => p >= lo && p <= hi)
        }
        const priceStats = Object.values(priceByLoc).map(loc => {
            const cleanPrices = iqrFilter(loc.prices)
            const avg = cleanPrices.reduce((s, p) => s + p, 0) / (cleanPrices.length || 1)
            return {
                name: loc.name,
                min: Math.min(...cleanPrices),
                max: Math.max(...cleanPrices),
                avg,
                count: loc.count,
                revenue: loc.revenue,
                score: 0,
                outlierRemoved: loc.prices.length - cleanPrices.length
            }
        }).sort((a,b) => a.avg - b.avg)

        // Compute performance score per location (0-10)
        const maxRevenue = Math.max(...priceStats.map(l => l.revenue), 1)
        const maxCount = Math.max(...priceStats.map(l => l.count), 1)
        const allAvgs = priceStats.map(l => l.avg).sort((a,b) => a-b)
        const medianPrice = allAvgs[Math.floor(allAvgs.length / 2)] || 1
        priceStats.forEach(loc => {
            const revenueRatio = loc.revenue / maxRevenue           // 0-1, higher = better
            const volumeRatio = loc.count / maxCount                 // 0-1, higher = better
            const priceDeviation = Math.abs(loc.avg - medianPrice) / medianPrice  // 0+, lower = better
            const priceHealth = Math.max(0, 1 - priceDeviation * 1.5) // penalize extreme prices
            const raw = revenueRatio * 0.5 + volumeRatio * 0.3 + priceHealth * 0.2
            loc.score = Math.round(raw * 10 * 10) / 10  // 0.0-10.0
        })

        return {
            rev: totalRev,
            units: totalUnits,
            chartDynamic: Object.values(mapDyn).sort((a, b) => a._ts - b._ts),
            chartLocations: Object.values(mapLoc).sort((a,b)=>b.rev - a.rev),
            recentTransactions: transactionsList.sort((a,b) => b.date - a.date),
            priceStats
        }
    }, [salesData, activePeriod, decodedName, restaurants])

    const showDayNames = ['month', 'lastmonth', 'year'].includes(activePeriod) && chartDynamic.length > 7

    return (
        <div className={`perf-container ${isDark ? 'dark-theme' : 'light-theme'}`} style={{ overflowY: 'auto', padding: '20px 28px', gap: '14px' }}>
            <style>{`
                :root {
                    --text-color: ${isDark ? '#f8fafc' : '#1e293b'};
                    --text-secondary: ${isDark ? '#94a3b8' : '#64748b'};
                    --glass-bg: ${isDark ? 'rgba(255, 255, 255, 0.03)' : '#ffffff'};
                }
                .product-hero {
                    display: flex; gap: 20px; align-items: stretch;
                    padding: 20px; border-radius: 16px;
                    background: ${isDark ? 'rgba(99,102,241,0.1)' : 'rgba(99,102,241,0.06)'};
                    border: 1px solid ${isDark ? 'rgba(20, 184, 166, 0.2)' : 'rgba(99,102,241,0.15)'};
                    box-shadow: inset 0 2px 10px rgba(255,255,255,0.4);
                }
                .hero-tabs-card {
                    display: flex; align-items: center; padding: 20px; border-radius: 16px;
                    background: ${isDark ? 'rgba(99,102,241,0.1)' : 'rgba(99,102,241,0.06)'};
                    border: 1px solid ${isDark ? 'rgba(20, 184, 166, 0.2)' : 'rgba(99,102,241,0.15)'};
                    box-shadow: inset 0 2px 10px rgba(255,255,255,0.4);
                }
                .hero-img {
                    width: 70px; height: 70px; border-radius: 12px; object-fit: cover;
                    background: ${isDark ? 'rgba(0,0,0,0.2)' : '#fff'};
                    box-shadow: 0 4px 12px rgba(0,0,0,0.1);
                    display: flex; align-items: center; justify-content: center;
                }
                .go-back-wrap {
                    display: flex; align-items: center; justify-content: space-between;
                    margin-bottom: 10px; padding-bottom: 10px; border-bottom: var(--glass-border);
                }
                .back-btn {
                    display: inline-flex; align-items: center; gap: 8px;
                    padding: 8px 16px; border-radius: 10px; font-size: 13px;
                    background: ${isDark ? 'rgba(255,255,255,0.05)' : '#fff'}; color: var(--text-color);
                    border: 1px solid var(--glass-border); text-decoration: none;
                    font-weight: 700; transition: all 0.2s; cursor: pointer;
                }
                .back-btn:hover { background: #6366F1; color: #fff; transform: translateY(-2px); border-color: #6366F1; }
                .tab-row {
                    display: flex; gap: 6px; flex-wrap: wrap; background: var(--glass-bg); padding: 4px; border-radius: 10px; border: var(--glass-border);
                }
                .tab-btn {
                    padding: 6px 12px; border-radius: 8px; border: none; font-size: 12px; font-weight: 700; cursor: pointer; transition: 0.2s;
                }
                .tab-btn.active { background: #6366F1; color: #fff; }
                .tab-btn:not(.active) { background: transparent; color: var(--text-secondary); }
                .tab-btn:not(.active):hover { background: var(--glass-bg-hover); color: var(--text-color); }
                
                .compact-kpi {
                    background: var(--glass-bg); border: var(--glass-border); padding: 16px; border-radius: 14px;
                }
                .compact-kpi-val { font-size: 22px; font-weight: 800; margin-top: 6px; color: var(--text-color); }

                .tx-table { width: 100%; border-collapse: collapse; margin-top: 12px; }
                .tx-table th { text-align: left; padding: 10px 16px; color: var(--text-secondary); font-size: 11px; text-transform: uppercase; border-bottom: var(--glass-border); }
                .tx-table td { padding: 12px 16px; color: var(--text-color); font-size: 13px; font-weight: 600; border-bottom: var(--glass-border); }
                .tx-table tr:hover td { background: var(--glass-bg-hover); }
            `}</style>

            <div className="go-back-wrap" style={{ borderBottom: 'none', paddingBottom: 0 }}>
                <button onClick={() => navigate(-1)} className="back-btn"><ArrowLeft size={18} /> {lang==='ru'?'Назад':'Înapoi / Back'}</button>
            </div>

            <div style={{ display: 'flex', gap: '16px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'stretch' }}>
                <div className="product-hero" style={{ flex: 1, marginBottom: 0 }}>
                    {productImage ? (
                        <img
                            src={productImage}
                            alt={decodedName}
                            className="hero-img"
                            onClick={() => setLightboxOpen(true)}
                            style={{ cursor: 'zoom-in' }}
                        />
                    ) : (
                        <div className="hero-img"><Package size={32} color="var(--text-secondary)" opacity={0.5} /></div>
                    )}

                    {/* Lightbox */}
                    {lightboxOpen && productImage && (
                        <div
                            onClick={() => setLightboxOpen(false)}
                            style={{
                                position: 'fixed', inset: 0, zIndex: 9999,
                                background: 'rgba(0,0,0,0.85)',
                                backdropFilter: 'blur(12px)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                cursor: 'zoom-out',
                                animation: 'fadeIn 0.18s ease',
                            }}
                        >
                            <img
                                src={productImage}
                                alt={decodedName}
                                style={{
                                    maxWidth: '90vw',
                                    maxHeight: '85vh',
                                    objectFit: 'contain',
                                    borderRadius: '20px',
                                    boxShadow: '0 40px 120px rgba(0,0,0,0.6)',
                                    userSelect: 'none',
                                }}
                            />
                            <button
                                onClick={() => setLightboxOpen(false)}
                                style={{
                                    position: 'fixed', top: '24px', right: '28px',
                                    background: 'rgba(255,255,255,0.12)',
                                    border: '1px solid rgba(255,255,255,0.2)',
                                    borderRadius: '50%', width: '44px', height: '44px',
                                    color: '#fff', fontSize: '22px', cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    backdropFilter: 'blur(8px)',
                                }}
                            >✕</button>
                        </div>
                    )}
                    
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                        <div style={{ fontSize: '11px', fontWeight: '800', color: '#6366F1', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px', display:'flex', alignItems:'center', gap:'6px' }}>
                            <ListOrdered size={14}/> PRODUCT ANALYTICS
                        </div>
                        <h1 style={{ fontSize: '22px', fontWeight: '900', color: 'var(--text-color)', margin: '0 0 4px 0', lineHeight: 1.2 }}>{decodedName}</h1>
                        <div style={{color:'var(--text-secondary)', fontSize:'12px', fontWeight:'600'}}>Vânzări consolidate, preferințe pe locații și comportamentul clienților</div>
                    </div>
                </div>

                <div className="hero-tabs-card">
                    <div className="tab-row" style={{ padding: '6px', borderRadius: '12px', border: 'none', background: 'rgba(255,255,255,0.3)' }}>
                        {['today', 'yesterday', 'week', 'month', 'lastmonth', 'year'].map(id => (
                            <button key={id} className={`tab-btn ${activePeriod === id ? 'active' : ''}`} onClick={() => setActivePeriod(id)} style={{ fontSize: '13px', padding: '8px 16px', borderRadius: '10px' }}>
                                {t(id)}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <div className="kpi-grid" style={{ marginBottom: '14px', gap: '12px' }}>
                    <div className="compact-kpi" style={{ padding: '12px 16px' }}>
                    <div style={{display:'flex', gap:'8px', alignItems:'center', fontSize:'12px', fontWeight:'700', color:'var(--text-secondary)'}}>
                        <div style={{padding:'6px', background:'rgba(16,185,129,0.1)', borderRadius:'8px', color:'#10b981'}}><DollarSign size={16} /></div>
                        {t('totalRev')}
                    </div>
                    <div className="compact-kpi-val">{isLoading ? '...' : rev.toLocaleString('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span style={{fontSize:'14px', opacity:0.7}}>RON</span></div>
                </div>

                <div className="compact-kpi" style={{ padding: '12px 16px' }}>
                    <div style={{display:'flex', gap:'8px', alignItems:'center', fontSize:'12px', fontWeight:'700', color:'var(--text-secondary)'}}>
                        <div style={{padding:'6px', background:'rgba(99,102,241,0.1)', borderRadius:'8px', color:'#6366f1'}}><Activity size={16} /></div>
                        {t('totalUnits')}
                    </div>
                    <div className="compact-kpi-val">{isLoading ? '...' : units.toLocaleString('ro-RO')} <span style={{fontSize:'14px', opacity:0.7}}>buc.</span></div>
                </div>

                <div className="compact-kpi" style={{ padding: '12px 16px' }}>
                    <div style={{display:'flex', gap:'8px', alignItems:'center', fontSize:'12px', fontWeight:'700', color:'var(--text-secondary)'}}>
                        <div style={{padding:'6px', background:'rgba(245,158,11,0.1)', borderRadius:'8px', color:'#f59e0b'}}><TrendingUp size={16} /></div>
                        {t('avgPrice')}
                    </div>
                    <div className="compact-kpi-val">{isLoading ? '...' : units > 0 ? (rev/units).toLocaleString('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0,00'} <span style={{fontSize:'14px', opacity:0.7}}>RON</span></div>
                </div>
            </div>

            {/* ── Price Intelligence ── */}
            {!isLoading && priceStats.length > 0 && (() => {
                const cheapest = priceStats[0]
                const priciest = priceStats[priceStats.length - 1]
                const globalMin = cheapest.min
                const globalMax = priciest.max
                const spread = globalMax - globalMin
                return (
                    <div className="glass-card" style={{ padding: '16px', marginBottom: '14px' }}>
                        <h3 className="card-heading" style={{ fontSize: '14px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <DollarSign size={16} color="#10b981" /> Price Intelligence · Cross-Location Report
                        </h3>

                        {/* Top summary row */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '20px' }}>
                            <div style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '12px', padding: '14px' }}>
                                <div style={{ fontSize: '11px', fontWeight: '700', color: '#10b981', textTransform: 'uppercase', letterSpacing: '0.5px' }}>📍 Cel Mai Ieftin</div>
                                <div style={{ fontSize: '20px', fontWeight: '900', color: 'var(--text-color)', margin: '4px 0 2px' }}>{globalMin.toLocaleString('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span style={{ fontSize: '12px', opacity: 0.6 }}>RON</span></div>
                                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '600' }}>{cheapest.name}</div>
                            </div>
                            <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '12px', padding: '14px' }}>
                                <div style={{ fontSize: '11px', fontWeight: '700', color: '#ef4444', textTransform: 'uppercase', letterSpacing: '0.5px' }}>📍 Cel Mai Scump</div>
                                <div style={{ fontSize: '20px', fontWeight: '900', color: 'var(--text-color)', margin: '4px 0 2px' }}>{globalMax.toLocaleString('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span style={{ fontSize: '12px', opacity: 0.6 }}>RON</span></div>
                                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '600' }}>{priciest.name}</div>
                            </div>
                            <div style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: '12px', padding: '14px' }}>
                                <div style={{ fontSize: '11px', fontWeight: '700', color: '#6366f1', textTransform: 'uppercase', letterSpacing: '0.5px' }}>⚡ Variație Preț</div>
                                <div style={{ fontSize: '20px', fontWeight: '900', color: 'var(--text-color)', margin: '4px 0 2px' }}>{spread.toLocaleString('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span style={{ fontSize: '12px', opacity: 0.6 }}>RON</span></div>
                                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '600' }}>{priceStats.length} locații comparate</div>
                            </div>
                        </div>

                        {/* Score legend */}
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
                            {[
                                { label: 'A', color: '#10b981', bg: 'rgba(16,185,129,0.1)', tip: 'Preț echilibrat + vânzări mari' },
                                { label: 'B', color: '#6366f1', bg: 'rgba(99,102,241,0.1)', tip: 'Performanță bună' },
                                { label: 'C', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', tip: 'Echilibru mediocru' },
                                { label: 'D', color: '#f97316', bg: 'rgba(249,115,22,0.1)', tip: 'Preț sau volum dezechilibrat' },
                                { label: 'F', color: '#ef4444', bg: 'rgba(239,68,68,0.1)', tip: 'Preț mare + puține vânzări' },
                            ].map(g => (
                                <div key={g.label} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '600' }}>
                                    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '20px', height: '16px', borderRadius: '4px', background: g.bg, color: g.color, fontSize: '11px', fontWeight: '900' }}>{g.label}</span>
                                    {g.tip}
                                </div>
                            ))}
                        </div>

                        {/* Per-location price bars */}
                        {/* Column headers */}
                        <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr 110px 52px 52px', gap: '10px', marginBottom: '6px', padding: '0 0 6px 0', borderBottom: '1px solid var(--glass-border)' }}>
                            <div style={{ fontSize: '10px', fontWeight: '700', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Locație</div>
                            <div style={{ fontSize: '10px', fontWeight: '700', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Distribuție preț</div>
                            <div style={{ fontSize: '10px', fontWeight: '700', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: 'right' }}>Preț mediu</div>
                            <div style={{ fontSize: '10px', fontWeight: '700', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: 'right' }}>Buc.</div>
                            <div style={{ fontSize: '10px', fontWeight: '700', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: 'right' }}>Scor</div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {priceStats.map(loc => {
                                const pct = spread > 0 ? ((loc.avg - globalMin) / spread) * 100 : 50
                                const isMin = loc.name === cheapest.name
                                const isMax = loc.name === priciest.name
                                return (
                                    <div key={loc.name} style={{ display: 'grid', gridTemplateColumns: '160px 1fr 110px 52px 52px', alignItems: 'center', gap: '10px' }}>
                                        <div style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-color)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {isMin ? '🟢 ' : isMax ? '🔴 ' : '⚪ '}{loc.name}
                                        </div>
                                        <div style={{ position: 'relative', height: '8px', background: 'var(--glass-bg-hover)', borderRadius: '4px', overflow: 'hidden' }}>
                                            <div style={{
                                                position: 'absolute', left: 0, top: 0, height: '100%',
                                                width: `${Math.max(pct, 5)}%`,
                                                background: isMin ? '#10b981' : isMax ? '#ef4444' : '#6366f1',
                                                borderRadius: '4px',
                                                transition: 'width 0.6s ease'
                                            }} />
                                        </div>
                                        <div style={{ fontSize: '12px', fontWeight: '800', color: isMin ? '#10b981' : isMax ? '#ef4444' : 'var(--text-color)', textAlign: 'right', whiteSpace: 'nowrap' }}>
                                            {loc.avg.toLocaleString('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} RON
                                        </div>
                                        <div style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)', textAlign: 'right', whiteSpace: 'nowrap' }}>
                                            {loc.count} buc.
                                        </div>
                                        {/* Score badge */}
                                        {(() => {
                                            const s = loc.score
                                            const grade = s >= 8 ? { label: 'A', bg: 'rgba(16,185,129,0.15)', color: '#10b981', tip: 'Optim: preț echilibrat + vânzări bune' }
                                                : s >= 6 ? { label: 'B', bg: 'rgba(99,102,241,0.15)', color: '#6366f1', tip: 'Bun: performanță peste medie' }
                                                : s >= 4 ? { label: 'C', bg: 'rgba(245,158,11,0.15)', color: '#f59e0b', tip: 'Acceptabil: echilibru preț/volum mediocru' }
                                                : s >= 2 ? { label: 'D', bg: 'rgba(249,115,22,0.15)', color: '#f97316', tip: 'Slab: preț prea mare sau prea mic vs volum' }
                                                : { label: 'F', bg: 'rgba(239,68,68,0.15)', color: '#ef4444', tip: 'Critic: preț mare + putine vânzări = pierdere' }
                                            return (
                                                <div title={`Scor: ${s}/10 · ${grade.tip}`} style={{
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    width: '32px', height: '22px', borderRadius: '6px',
                                                    background: grade.bg, color: grade.color,
                                                    fontSize: '12px', fontWeight: '900',
                                                    cursor: 'help', userSelect: 'none',
                                                    marginLeft: 'auto'
                                                }}>
                                                    {grade.label}
                                                </div>
                                            )
                                        })()}
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                )
            })()}

            {/* Charts row: Dynamics + Locations side by side */}
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)', gap: '14px', marginBottom: '0' }}>
            <div className="glass-card" style={{ padding: '16px' }}>
                <h3 className="card-heading" style={{ fontSize: '14px', marginBottom: '16px' }}>{t('chartDyn')}</h3>
                {chartDynamic.length > 0 ? (
                    <div style={{ height: '220px', marginLeft: '-15px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartDynamic} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorDyn" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.8}/>
                                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)"} vertical={false} />
                <XAxis
                                    dataKey="name"
                                    stroke="var(--text-secondary)"
                                    fontSize={10}
                                    tickLine={false}
                                    axisLine={false}
                                    tickMargin={4}
                                    height={showDayNames ? 42 : 20}
                                    tick={(props) => {
                                        const { x, y, payload } = props
                                        const label = payload.value  // e.g. "01 mar."
                                        if (!showDayNames) {
                                            return <text x={x} y={y+12} textAnchor="middle" fill="var(--text-secondary)" fontSize={10}>{label}</text>
                                        }
                                        // Parse to date
                                        const monthMap = { 'ian':0,'feb':1,'mar':2,'apr':3,'mai':4,'iun':5,'iul':6,'aug':7,'sep':8,'oct':9,'nov':10,'dec':11 }
                                        const parts = label.replace('.','').trim().split(' ')
                                        const dayN = parseInt(parts[0])
                                        const monN = monthMap[parts[1]] ?? 0
                                        const yr = new Date().getFullYear()
                                        const d = new Date(yr, monN, dayN)
                                        const dayNames = ['Du','Lu','Ma','Mi','Jo','Vi','Sâ']
                                        const dayName = dayNames[d.getDay()]
                                        const isWeekend = d.getDay() === 0 || d.getDay() === 6
                                        const ddMM = `${String(dayN).padStart(2,'0')}-${String(monN+1).padStart(2,'0')}`
                                        const holidays = getRomanianHolidays(yr)
                                        const holiday = holidays[ddMM]
                                        const isLegal = holiday?.legal
                                        const textColor = isLegal ? '#f59e0b' : isWeekend ? '#6366f1' : 'var(--text-secondary)'
                                        return (
                                            <g>
                                                <text x={x} y={y+10} textAnchor="middle" fill={textColor} fontSize={10} fontWeight={isLegal || isWeekend ? '700' : '400'}>{label}</text>
                                                <text x={x} y={y+22} textAnchor="middle" fill={textColor} fontSize={9} fontWeight={isLegal ? '800' : '400'}>{dayName}</text>
                                                {holiday && <text x={x} y={y+34} textAnchor="middle" fontSize={9}>{holiday.label.split(' ')[0]}</text>}
                                            </g>
                                        )
                                    }}
                                />
                                <YAxis stroke="var(--text-secondary)" fontSize={11} tickLine={false} axisLine={false} tickFormatter={v => v.toLocaleString('ro-RO')} />
                                <Tooltip 
                                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 40px rgba(0,0,0,0.2)', background: isDark ? 'rgba(30,41,59,0.95)' : 'rgba(255,255,255,0.95)' }}
                                    formatter={(value, name) => [name === t('sales') ? `${Number(value).toLocaleString('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} RON` : value, name]}
                                />
                                <Area type="monotone" dataKey="rev" name={t('sales')} stroke="#6366f1" strokeWidth={4} fill="url(#colorDyn)" activeDot={{ r: 8, stroke: '#6366f1', strokeWidth: 4, fill: '#fff' }} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                ) : (
                    <div style={{ height: '220px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>{t('noData')}</div>
                )}
            </div> {/* end dynamics card */}

            <div className="glass-card" style={{ padding: '16px' }}>
                <h3 className="card-heading" style={{ fontSize: '14px', marginBottom: '16px' }}>{t('chartLoc')}</h3>
                {chartLocations.length > 0 ? (
                    <div style={{ height: `${Math.min(Math.max(220, chartLocations.length * 32), 320)}px`, marginLeft: '-20px', overflowY: 'auto' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartLocations} layout="vertical" margin={{ top: 0, right: 30, left: 10, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="transparent" />
                                <XAxis type="number" hide />
                                <YAxis type="category" dataKey="name" stroke="var(--text-color)" fontSize={12} fontWeight={600} tickLine={false} axisLine={false} width={150} />
                                <Tooltip 
                                    cursor={{ fill: 'var(--glass-bg-hover)' }}
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 30px rgba(0,0,0,0.1)', background: isDark ? '#1e293b' : '#fff' }}
                                    formatter={(value) => [`${Number(value).toLocaleString('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} RON`, t('sales')]}
                                />
                                <Bar dataKey="rev" fill="#10b981" radius={[0, 8, 8, 0]} barSize={26} label={{ position: 'right', fill: 'var(--text-color)', fontSize: 13, fontWeight: '800', formatter: v => `${v.toLocaleString('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} lei` }} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                ) : (
                    <div style={{ height: '220px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>{t('noData')}</div>
                )}
            </div> {/* end locations card */}
            </div> {/* end charts row */}

            <div className="glass-card" style={{ marginTop: '14px', padding: '16px' }}>
                <h3 className="card-heading" style={{display:'flex', alignItems:'center', gap:'8px', fontSize:'14px'}}><Navigation size={16}/> {t('recentSalesTitle')} ({recentTransactions.length})</h3>
                {recentTransactions.length > 0 ? (
                    <div>
                        <div style={{ overflowX: 'auto' }}>
                            <table className="tx-table">
                                <thead>
                                    <tr>
                                        <th style={{ width: 40, textAlign: 'center' }}>
                                            <input 
                                                type="checkbox" 
                                                checked={recentTransactions.length > 0 && selectedRows.size === recentTransactions.length}
                                                onChange={e => {
                                                    if (e.target.checked) setSelectedRows(new Set(recentTransactions.map(t => t.id)))
                                                    else setSelectedRows(new Set())
                                                }}
                                                style={{ cursor: 'pointer', accentColor: '#10b981' }}
                                            />
                                        </th>
                                        <th>{t('colDate')}</th>
                                        <th>{t('colLocation')}</th>
                                        <th>{t('colPlatform')}</th>
                                        <th>{t('colQty')}</th>
                                        <th>{t('colRev')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {recentTransactions.slice((pageNumber - 1) * itemsPerPage, pageNumber * itemsPerPage).map((tx, idx) => {
                                        const isSelected = selectedRows.has(tx.id)
                                        return (
                                        <tr key={tx.id} onClick={() => {
                                            const next = new Set(selectedRows)
                                            if (next.has(tx.id)) next.delete(tx.id)
                                            else next.add(tx.id)
                                            setSelectedRows(next)
                                        }} style={{ cursor: 'pointer', background: isSelected ? (isDark ? 'rgba(16, 185, 129, 0.1)' : 'rgba(16, 185, 129, 0.05)') : '' }}>
                                            <td style={{ textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                                                <input 
                                                    type="checkbox" 
                                                    checked={isSelected}
                                                    onChange={() => {
                                                        const next = new Set(selectedRows)
                                                        if (next.has(tx.id)) next.delete(tx.id)
                                                        else next.add(tx.id)
                                                        setSelectedRows(next)
                                                    }}
                                                    style={{ cursor: 'pointer', accentColor: '#10b981' }}
                                                />
                                            </td>
                                            <td style={{color: 'var(--text-secondary)'}}>
                                                <div style={{display:'flex', alignItems:'center', gap:'6px'}}><Calendar size={14}/> {tx.date.toLocaleDateString('ro-RO')}</div>
                                                <div style={{display:'flex', alignItems:'center', gap:'6px', marginTop:'4px', fontSize:'12px'}}><Clock size={12}/> {tx.date.toLocaleTimeString('ro-RO')}</div>
                                            </td>
                                            <td>{tx.locationName}</td>
                                            <td>
                                                <span style={{
                                                    background: tx.platform==='glovo'?'#FFC24422':tx.platform==='wolt'?'#009DE022':tx.platform==='bolt'?'#34D18622':'var(--glass-bg-hover)',
                                                    color: tx.platform==='glovo'?'#e6a300':tx.platform==='wolt'?'#009DE0':tx.platform==='bolt'?'#119056':'var(--text-color)',
                                                    padding: '4px 10px', borderRadius: '8px', fontSize: '11px', fontWeight: '800', textTransform: 'uppercase'
                                                }}>{tx.platform}</span>
                                            </td>
                                            <td>{tx.qty}x</td>
                                            <td style={{color: '#10b981'}}>{tx.revenue.toLocaleString('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} RON</td>
                                        </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                        
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', paddingTop: '16px', borderTop: 'var(--glass-border)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-secondary)' }}>
                                    {lang === 'ru' ? 'Строк на странице:' : 'Rânduri pe pagină:'}
                                </span>
                                <select 
                                    value={itemsPerPage} 
                                    onChange={e => { setItemsPerPage(Number(e.target.value)); setPageNumber(1); }}
                                    style={{
                                        background: 'var(--glass-bg)', color: 'var(--text-color)', border: '1px solid var(--glass-border)',
                                        borderRadius: '8px', padding: '6px 10px', fontSize: '12px', outline: 'none', cursor: 'pointer', fontWeight: 'bold'
                                    }}
                                >
                                    <option value={10}>10</option>
                                    <option value={20}>20</option>
                                    <option value={50}>50</option>
                                    <option value={100}>100</option>
                                </select>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                <span style={{ fontSize: '13px', fontWeight: '800', color: 'var(--text-color)' }}>
                                    {lang === 'ru' ? `Страница ${pageNumber} из ${Math.ceil(recentTransactions.length / itemsPerPage)}` : `Pagina ${pageNumber} din ${Math.ceil(recentTransactions.length / itemsPerPage)}`}
                                </span>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <button onClick={() => setPageNumber(Math.max(1, pageNumber - 1))} disabled={pageNumber === 1} className="back-btn" style={{padding:'8px 14px', borderRadius:'10px', fontSize:'14px', opacity: pageNumber === 1 ? 0.5 : 1}}>&lt;</button>
                                    <button onClick={() => setPageNumber(Math.min(Math.ceil(recentTransactions.length / itemsPerPage), pageNumber + 1))} disabled={pageNumber === Math.ceil(recentTransactions.length / itemsPerPage) || Math.ceil(recentTransactions.length / itemsPerPage) === 0} className="back-btn" style={{padding:'8px 14px', borderRadius:'10px', fontSize:'14px', opacity: pageNumber === Math.ceil(recentTransactions.length / itemsPerPage) || Math.ceil(recentTransactions.length / itemsPerPage) === 0 ? 0.5 : 1}}>&gt;</button>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-secondary)' }}>{t('noData')}</div>
                )}
            </div>
        </div>
    )
}
