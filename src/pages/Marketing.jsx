import { useState, useEffect, useCallback, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTheme } from '../lib/ThemeContext'
import { useLanguage } from '../lib/LanguageContext'
import { supabase } from '../lib/supabaseClient'

// API migrated to direct Supabase queries — no local backend needed
const PLATFORM_COLORS = { glovo: '#FFC244', wolt: '#009DE0', bolt: '#34D186' }
const PLATFORM_ICONS = { glovo: '🟡', wolt: '🔵', bolt: '🟢' }
const ALL_CITIES = [
    'Bucharest', 'Cluj-Napoca', 'Timisoara', 'Iasi', 'Constanta',
    'Brasov', 'Galati', 'Sibiu', 'Pitesti', 'Ploiesti',
    'Bacau', 'Suceava', 'Targu Mures', 'Braila', 'Baia Mare', 'Craiova'
]

export default function Marketing() {
    const { colors, isDark } = useTheme()
    const { t, lang } = useLanguage()
    const [searchParams, setSearchParams] = useSearchParams()

    // URL-synced state
    const activeTab = searchParams.get('tab') || 'searches'
    const setActiveTab = (t) => setSearchParams(p => { const n = new URLSearchParams(p); n.set('tab', t); n.delete('view'); n.delete('brand'); n.delete('detail'); return n })
    const historyView = searchParams.get('view') || 'brand'
    const setHistoryView = (v) => setSearchParams(p => { const n = new URLSearchParams(p); n.set('view', v); n.delete('brand'); n.delete('cityDrill'); return n })
    const detailBrand = searchParams.get('detail') // competitor name in URL
    const cityDrilldown = searchParams.get('cityDrill') // when navigating from city -> brand
    const drillToCity = (city) => setSearchParams(p => { const n = new URLSearchParams(p); n.set('view', 'brand'); n.set('cityDrill', city); return n })
    const clearCityDrill = () => setSearchParams(p => { const n = new URLSearchParams(p); n.set('view', 'city'); n.delete('cityDrill'); return n })

    const [searches, setSearches] = useState([])
    const [brands, setBrands] = useState([])
    const [selectedSearch, setSelectedSearch] = useState(null)
    const [results, setResults] = useState([])
    const [priceHistory, setPriceHistory] = useState([])

    const [showForm, setShowForm] = useState(false)
    const [editingSearch, setEditingSearch] = useState(null)
    const [selectedSearchIds, setSelectedSearchIds] = useState(new Set())
    const [form, setForm] = useState({
        brand_id: '', search_term: '', platforms: ['glovo', 'wolt', 'bolt'],
        cities: ['Bucharest'], notes: '', auto_cities: true, glovo_category: '', wolt_category: ''
    })

    const [loading, setLoading] = useState(false)
    const [runningSearch, setRunningSearch] = useState(null)
    const [toast, setToast] = useState(null)
    const [priceFilter, setPriceFilter] = useState('')

    // Progress bars state — one per running search
    const [progressMap, setProgressMap] = useState({})  // { [searchId]: { ... } }
    const sseRefs = useRef({})  // { [searchId]: EventSource }

    // Competitor detail — URL-synced
    const [detailCompetitor, setDetailCompetitorState] = useState(null) // { name, city, url, platform }
    
    // Sync UI with URL so clicking other pages unmounts the detail view
    useEffect(() => {
        const detName = searchParams.get('detail')
        if (detName) {
            if (!detailCompetitor || detailCompetitor.name !== detName) {
                // Recover basic info from URL if directly loaded, or let existing click-handler state prevail
                if (!detailCompetitor) setDetailCompetitorState({ name: detName })
            }
        } else {
            if (detailCompetitor) {
                setDetailCompetitorState(null)
                setBrandStats(null)
            }
        }
    }, [searchParams.get('detail')])

    const setDetailCompetitor = (val) => {
        setDetailCompetitorState(val)
        setSearchParams(p => {
            const n = new URLSearchParams(p)
            if (val) { n.set('detail', val.name) }
            else n.delete('detail')
            return n
        }, { replace: !val })
    }
    const [brandStats, setBrandStats] = useState(null)
    const [loadingStats, setLoadingStats] = useState(false)
    const [fetchingProducts, setFetchingProducts] = useState(false)
    const [pricePeriod, setPricePeriod] = useState(null) // null = all time, or number of days
    // keep for backwards compat during transition
    const [selectedCompetitor, setSelectedCompetitor] = useState(null)

    // History tab state
    const today = new Date().toISOString().split('T')[0]
    const ago30 = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]
    const [dateFrom, setDateFrom] = useState(ago30)
    const [dateTo, setDateTo] = useState(today)
    const [historyData, setHistoryData] = useState([])
    const [historyLoading, setHistoryLoading] = useState(false)
    const [historyCity, setHistoryCity] = useState('')
    const [historyPlatform, setHistoryPlatform] = useState('')
    const [historyView_UNUSED, _setHistoryView] = useState('date') // kept for compat; now URL-driven
    const [dayPages, setDayPages] = useState({}) // { [date]: pageIndex } for per-day pagination

    // Quick search filters (client-side, instant)
    const [resultsFilter, setResultsFilter] = useState('')
    const [brandFilter, setBrandFilter] = useState('')
    const [selectedBrands, setSelectedBrands] = useState(new Set()) // pill multi-select: own brand names
    const [expandedProduct, setExpandedProduct] = useState(null) // key = restaurant_name||product_name
    const [selectedProduct, setSelectedProduct] = useState(null)
    const [rankExpanded, setRankExpanded] = useState(false) // Istoric pozitii collapse
    const [rankPage, setRankPage] = useState(1) // pagination for rank history
    const RANK_PAGE_SIZE = 10

    const glass = {
        background: isDark ? 'rgba(44,44,46,0.6)' : 'rgba(255,255,255,0.85)',
        backdropFilter: 'blur(24px)',
        border: `0.5px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}`,
        borderRadius: '16px',
    }

    // ─── Universal Excel Export ───
    function exportToExcel(viewName, rows, columns) {
        if (!rows || !rows.length) { alert('Nu există date de exportat'); return }
        const header = columns.map(c => c.label).join('\t')
        const body = rows.map(row =>
            columns.map(c => {
                const val = typeof c.get === 'function' ? c.get(row) : row[c.key]
                return String(val ?? '').replace(/\t/g, ' ').replace(/\n/g, ' ')
            }).join('\t')
        ).join('\n')
        const content = header + '\n' + body
        const blob = new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `marketing-${viewName}-${new Date().toISOString().split('T')[0]}.csv`
        a.click()
        URL.revokeObjectURL(url)
    }

    function exportCurrentView() {
        if (detailCompetitor && brandStats) {
            // ─── Section 1: Rank History ───
            const rankRows = brandStats.rankHistory || []
            const rankHeader = ['Data', 'Platforma', 'Oras', 'Rank', 'Rating'].join('\t')
            const rankBody = rankRows.map(r =>
                [r.date || '', r.platform || '', r.city || '', r.rank_position || r.rank || '', r.rating || ''].join('\t')
            ).join('\n')

            // ─── Section 2: Products ───
            const productRows = []
            Object.entries(brandStats.priceHistory || {}).forEach(([pName, entries]) => {
                if (entries && entries.length > 0) {
                    const latest = entries[entries.length - 1]
                    const oldest = entries[0]
                    const trend = entries.length > 1 ? (latest.price > oldest.price ? '↑' : latest.price < oldest.price ? '↓' : '→') : '→'
                    productRows.push([
                        pName,
                        latest.category || '',
                        latest.price != null ? latest.price : '',
                        oldest.price != null ? oldest.price : '',
                        trend,
                        latest.date || '',
                    ])
                }
            })
            const prodHeader = ['Produs', 'Categorie', 'Pret Actual (RON)', 'Pret Initial (RON)', 'Trend', 'Ultima Data'].join('\t')
            const prodBody = productRows.map(r => r.map(v => String(v ?? '').replace(/\t/g, ' ')).join('\t')).join('\n')

            // Combine both sections
            const content = [
                `=== ISTORIC POZITII: ${detailCompetitor.name} ===`,
                rankHeader,
                rankBody || '(fara date)',
                '',
                `=== PRODUSE & PRETURI: ${detailCompetitor.name} ===`,
                prodHeader,
                prodBody || '(fara produse)',
            ].join('\n')

            const blob = new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `concurent-${detailCompetitor.name}-${new Date().toISOString().split('T')[0]}.csv`
            a.click()
            URL.revokeObjectURL(url)
            return
        }
        if (activeTab !== 'prices' || !historyData.length) { alert('Fă mai întâi o căutare'); return }

        const allRows = historyData.flatMap(snap =>
            (snap.competitor_restaurants || []).map(r => ({
                ...r, platform: snap.platform, city: snap.city, date: snap.snapshot_date,
                search: snap.competitive_searches?.brands?.name || snap.competitive_searches?.search_term || '',
            }))
        )

        if (historyView === 'date' || historyView === 'brand' || historyView === 'city') {
            exportToExcel(`istoric-${historyView}`, allRows, [
                { label: 'Data', key: 'date' },
                { label: 'Restaurant', key: 'name' },
                { label: 'Oras', key: 'city' },
                { label: 'Platforma', key: 'platform' },
                { label: 'Rank', get: r => r.rank_position || '' },
                { label: t('rating'), key: 'rating' },
                { label: 'URL', key: 'url' },
                { label: 'Cautare', key: 'search' },
            ])
        } else if (historyView === 'product') {
            exportToExcel('produse', priceHistory, [
                { label: 'Restaurant', key: 'restaurant_name' },
                { label: t('view_by_product'), key: 'product_name' },
                { label: 'Oras', key: 'city' },
                { label: 'Platforma', key: 'platform' },
                { label: 'Data', key: 'date' },
                { label: 'Pret (RON)', key: 'price' },
            ])
        }
    }

    const loadSearches = useCallback(async () => {
        try {
            const { data } = await supabase
                .from('competitive_searches')
                .select('*, brands(name, logo_url)')
                .order('created_at', { ascending: false })
            const searches = data || []
            setSearches(searches)
            if (!selectedSearch && searches.length > 0) {
                const first = searches[0]
                setSelectedSearch(first)
                loadResults(first.id)
            }
        } catch { }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const loadBrands = useCallback(async () => {
        const { data } = await supabase.from('brands').select('id, name, logo_url')
        setBrands(data || [])
    }, [])

    useEffect(() => { loadSearches(); loadBrands() }, [loadSearches, loadBrands])
    // Auto-load history on mount — always load last 30 days immediately
    useEffect(() => {
        loadHistory(dateFrom, dateTo, '', '')
        loadPriceHistory('')
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // Auto-expand to 90 days when no data found
    useEffect(() => {
        if (activeTab === 'prices' && !historyLoading && historyData.length === 0) {
            const ninetyAgo = new Date(); ninetyAgo.setDate(ninetyAgo.getDate() - 90)
            const newFrom = ninetyAgo.toISOString().split('T')[0]
            const today = new Date().toISOString().split('T')[0]
            loadHistory(newFrom, today, '', '')
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [historyData.length, historyLoading])

    // Also reload when tab switches to prices
    useEffect(() => {
        if (activeTab === 'prices') {
            loadHistory(dateFrom, dateTo, historyCity, historyPlatform)
        }
        if (activeTab === 'results' && !selectedSearch && searches.length > 0) {
            loadResults(searches[0].id)
            setSelectedSearch(searches[0])
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTab])

    const loadResults = useCallback(async (searchId) => {
        setLoading(true)
        try {
            const { data, error } = await supabase
                .from('competitor_snapshots')
                .select(`
                    id, platform, city, snapshot_date, total_results, scraped_at, search_id,
                    competitor_restaurants ( id, name, url, rank_position, rating, delivery_time_min, delivery_time_max, logo_url, is_promoted )
                `)
                .eq('search_id', searchId)
                .order('scraped_at', { ascending: false })
                .limit(100)
            if (error) console.error('[loadResults] Supabase error:', error.message)
            setResults(data || [])
        } catch (e) { console.error('[loadResults] Error:', e.message) } finally { setLoading(false) }
    }, [])

    const loadPriceHistory = async (product = '') => {
        try {
            const since = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]
            let query = supabase
                .from('competitor_products')
                .select(`product_name, price, category, platform, city, snapshot_date, is_promoted, competitor_restaurants ( name, url )`)
                .gte('snapshot_date', since)
                .order('snapshot_date', { ascending: false })
                .limit(500)
            if (product) query = query.ilike('product_name', `%${product}%`)
            const { data } = await query
            const history = (data || []).map(row => ({
                ...row,
                restaurant_name: (Array.isArray(row.competitor_restaurants) ? row.competitor_restaurants[0] : row.competitor_restaurants)?.name || 'Unknown',
                restaurant_url: (Array.isArray(row.competitor_restaurants) ? row.competitor_restaurants[0] : row.competitor_restaurants)?.url || null,
                competitor_restaurants: undefined
            }))
            setPriceHistory(history)
        } catch { }
    }

    const loadHistory = useCallback(async (from, to, city, platform, searchId) => {
        setHistoryLoading(true)
        try {
            const since = from || dateFrom
            const until = to || dateTo
            let query = supabase
                .from('competitor_snapshots')
                .select(`
                    id, platform, city, snapshot_date, total_results, scraped_at, search_id,
                    competitive_searches ( id, search_term, brands ( name, logo_url ) ),
                    competitor_restaurants (
                        id, name, url, rank_position, rating, delivery_time_min, delivery_time_max, logo_url
                    )
                `)
                .gte('snapshot_date', since)
                .lte('snapshot_date', until)
                .order('snapshot_date', { ascending: false })
                .limit(200)
            if (searchId) query = query.eq('search_id', searchId)
            if (city) query = query.eq('city', city)
            if (platform) query = query.eq('platform', platform)
            const { data, error } = await query
            if (error) console.error('[loadHistory]', error.message)
            setHistoryData(data || [])
        } catch (e) { console.error('[loadHistory]', e) }
        finally { setHistoryLoading(false) }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const loadBrandStats = async (name, city) => {
        setLoadingStats(true)
        setBrandStats(null)
        try {
            // Step 1: Get restaurants matching the name (includes snapshot_id FK)
            const { data: restaurants, error: restErr } = await supabase
                .from('competitor_restaurants')
                .select('id, snapshot_id, name, url, logo_url, rank_position, rating, delivery_time_min, delivery_time_max')
                .ilike('name', `%${name}%`)
                .order('id', { ascending: false })
                .limit(200)

            if (restErr) console.error('[loadBrandStats] restaurants query error:', restErr.message)

            // Collect unique snapshot IDs and restaurant IDs
            const snapshotIds = [...new Set((restaurants || []).map(r => r.snapshot_id).filter(Boolean))]
            const restIds = (restaurants || []).map(r => r.id)
            
            // Step 2: Get snapshots by their own id
            let snapshots = []
            if (snapshotIds.length > 0) {
                const { data: snapsData, error: snapErr } = await supabase
                    .from('competitor_snapshots')
                    .select('id, platform, city, snapshot_date, search_id')
                    .in('id', snapshotIds)
                if (snapErr) console.error('[loadBrandStats] snapshots query error:', snapErr.message)
                snapshots = snapsData || []
            }

            // Step 3: Get products separately using competitor_restaurant_id
            let allProductsRaw = []
            if (restIds.length > 0) {
                const { data: prodData, error: prodErr } = await supabase
                    .from('competitor_products')
                    .select('competitor_restaurant_id, product_name, price, category, snapshot_date, is_promoted, image_url, description')
                    .in('competitor_restaurant_id', restIds)
                    .order('snapshot_date', { ascending: false })
                    .limit(5000)
                if (prodErr) console.error('[loadBrandStats] products query error:', prodErr.message)
                allProductsRaw = prodData || []
            }

            // Build lookups
            const prodsByRestId = {}
            allProductsRaw.forEach(p => {
                if (!prodsByRestId[p.competitor_restaurant_id]) prodsByRestId[p.competitor_restaurant_id] = []
                prodsByRestId[p.competitor_restaurant_id].push(p)
            })

            // Build snapshot lookup: snapshot.id -> snapshot
            const snapsById = {}
            snapshots.forEach(s => { snapsById[s.id] = s })

            // Flatten into appearances: each restaurant row joined with its snapshot
            const appearances = (restaurants || []).map(r => {
                const snap = snapsById[r.snapshot_id] || {}
                return {
                    id: r.id, name: r.name, url: r.url,
                    rank_position: r.rank_position, rating: r.rating,
                    delivery_time_min: r.delivery_time_min, delivery_time_max: r.delivery_time_max,
                    platform: snap.platform,
                    city: snap.city,
                    snapshot_date: snap.snapshot_date,
                    products: prodsByRestId[r.id] || []
                }
            })
            .filter(a => !city || a.city === city)
            .sort((a, b) => (b.snapshot_date || '').localeCompare(a.snapshot_date || ''))

            const ratings = appearances.filter(a => a.rating).map(a => a.rating)
            const avgRating = ratings.length ? (ratings.reduce((s, r) => s + r, 0) / ratings.length).toFixed(1) : null
            // Prioritize product's own snapshot_date so that manual "Refresh produse" updates appear as today
            const allProducts = appearances.flatMap(a => a.products.map(p => ({ ...p, date: p.snapshot_date || a.snapshot_date, platform: a.platform })))

            const priceHistory = {}
            const productMeta = {}  // { [productName]: { image_url, description, category, weight, pieces, platform, price } }
            allProducts.forEach(p => {
                if (!p.product_name || !p.price) return
                if (!priceHistory[p.product_name]) priceHistory[p.product_name] = []
                priceHistory[p.product_name].push({ date: p.date, price: p.price, platform: p.platform })
                
                if (!productMeta[p.product_name]) {
                    const fullText = (p.product_name + ' ' + (p.description || '')).trim()
                    const weightMatch = fullText.match(/(\d+)\s*(g|gr|ml|kg)\b/i)
                    const weight = weightMatch ? `${weightMatch[1]}${weightMatch[2].toLowerCase()}` : '—'
                    const pcsMatch = fullText.match(/(\d+)\s*(buc|bucati|bucăți|pcs)\b/i)
                    const pieces = pcsMatch ? pcsMatch[1] : '1'
                    
                    productMeta[p.product_name] = { 
                        image_url: p.image_url || null, 
                        description: p.description || null,
                        category: p.category || 'N/A',
                        weight, 
                        pieces,
                        platform: p.platform || 'wolt',
                        price: p.price
                    }
                } else {
                    if (p.image_url && !productMeta[p.product_name].image_url) productMeta[p.product_name].image_url = p.image_url
                    if (p.description && !productMeta[p.product_name].description) productMeta[p.product_name].description = p.description
                }
            })

            const rankGroups = {}
            appearances.forEach(a => {
                const day = (a.snapshot_date || '').split('T')[0]
                const key = `${day}|${a.platform}|${a.city}`
                if (!rankGroups[key]) rankGroups[key] = { date: day, platform: a.platform, city: a.city, ranks: [], ratings: [], count: 0 }
                rankGroups[key].count++
                if (a.rank_position && !rankGroups[key].ranks.includes(a.rank_position)) rankGroups[key].ranks.push(a.rank_position)
                if (a.rating && !rankGroups[key].ratings.includes(a.rating)) rankGroups[key].ratings.push(a.rating)
            })
            const rankHistory = Object.values(rankGroups)
                .sort((a, b) => b.date.localeCompare(a.date))
                .map(g => ({ ...g, ranks: g.ranks.sort((a, b) => a - b) }))

            setBrandStats({
                success: true,
                name: appearances[0]?.name || name,
                url: appearances[0]?.url,
                logo_url: (restaurants || []).find(r => r.logo_url)?.logo_url || null,
                avgRating, totalAppearances: appearances.length,
                firstSeen: rankHistory[rankHistory.length - 1]?.date,
                lastSeen: rankHistory[0]?.date,
                cities: [...new Set(appearances.map(a => a.city).filter(Boolean))],
                platforms: [...new Set(appearances.map(a => a.platform).filter(Boolean))],
                rankHistory, priceHistory, productMeta, appearances,
            })
        } catch { } finally { setLoadingStats(false) }
    }

    // Auto-load brand stats when initialized from URL
    useEffect(() => {
        if (detailCompetitor?.name && !brandStats && !loadingStats) {
            loadBrandStats(detailCompetitor.name, detailCompetitor.city)
        }
    }, [detailCompetitor?.name])

    const handleSelectSearch = (search) => {
        setSelectedSearch(search)
        setActiveTab('results')
        loadResults(search.id)
    }

    const showToast = (msg, type = 'info', duration = 4000) => {
        setToast({ msg, type })
        setTimeout(() => setToast(null), duration)
    }

    // ─── Run search via backend worker (port 3001) with SSE progress ───
    const handleRunSearch = async (searchId, searchTerm) => {
        if (runningSearch) { showToast('O căutare este deja în curs…', 'info'); return }
        setRunningSearch(searchId)
        setProgressMap(prev => ({ ...prev, [searchId]: { label: `Pornire "${searchTerm}"…`, pct: 0, done: false, error: null } }))

        try {
            // 1. Fire the search (POST)
            const resp = await fetch(`${import.meta.env.VITE_WORKER_URL || 'http://localhost:3001'}/api/competitive/run-search`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ searchId })
            })
            const startData = await resp.json()
            if (!startData.success) throw new Error(startData.error || 'Start eșuat')

            const totalSteps = startData.totalSteps || 1

            // 2. Open SSE stream for progress
            const es = new EventSource(`${import.meta.env.VITE_WORKER_URL || 'http://localhost:3001'}/api/competitive/progress/${searchId}`)

            es.onmessage = (e) => {
                try {
                    const data = JSON.parse(e.data)
                    if (data.type === 'city_start') {
                        const pct = totalSteps > 0 ? Math.round(((data.step - 1) / totalSteps) * 100) : 0
                        const label = `🔍 ${data.city} / ${data.platform} (${data.step}/${data.totalSteps || totalSteps})`
                        setProgressMap(prev => ({ ...prev, [searchId]: { label, pct, step: data.step, totalSteps: data.totalSteps || totalSteps, done: false, error: null } }))
                    } else if (data.type === 'city_done') {
                        const pct = totalSteps > 0 ? Math.round((data.step / totalSteps) * 100) : 0
                        const label = `✓ ${data.city} / ${data.platform}: ${data.found ?? 0} concurenți (${data.step}/${data.totalSteps || totalSteps})`
                        setProgressMap(prev => ({ ...prev, [searchId]: { label, pct, step: data.step, totalSteps: data.totalSteps || totalSteps, done: false, error: null } }))
                    } else if (data.type === 'city_error') {
                        const pct = totalSteps > 0 ? Math.round((data.step / totalSteps) * 100) : 0
                        setProgressMap(prev => ({ ...prev, [searchId]: { ...prev[searchId], pct, step: data.step, label: `⚠️ ${data.city}/${data.platform}: ${data.error}` } }))
                    } else if (data.type === 'progress') {
                        const pct = totalSteps > 0 ? Math.round(((data.step || 0) / totalSteps) * 100) : (data.progress ?? 30)
                        setProgressMap(prev => ({ ...prev, [searchId]: { label: data.message || 'Se procesează…', pct, done: false, error: null } }))
                    } else if (data.type === 'done' || data.type === 'complete') {
                        setProgressMap(prev => ({ ...prev, [searchId]: { label: '✓ Finalizat!', pct: 100, done: true, error: null } }))
                        showToast(`✅ Căutare "${searchTerm}" finalizată!`, 'success')
                        es.close()
                        setRunningSearch(null)
                        loadResults(searchId)
                        loadHistory()
                        setTimeout(() => setProgressMap(prev => { const n = { ...prev }; delete n[searchId]; return n }), 4000)
                    } else if (data.type === 'error') {
                        setProgressMap(prev => ({ ...prev, [searchId]: { label: `❌ ${data.message}`, pct: 0, done: false, error: data.message } }))
                        showToast(`❌ Eroare: ${data.message}`, 'error')
                        es.close()
                        setRunningSearch(null)
                        setTimeout(() => setProgressMap(prev => { const n = { ...prev }; delete n[searchId]; return n }), 5000)
                    }
                } catch {}
            }
            es.onerror = () => {
                // SSE closed normally after done — ignore if already done
                es.close()
                setRunningSearch(prev => prev === searchId ? null : prev)
            }
        } catch (err) {
            setProgressMap(prev => ({ ...prev, [searchId]: { label: `❌ Worker offline`, pct: 0, done: false, error: err.message } }))
            showToast(`❌ Worker offline. Rulează: cd workers && node src/api-server.js`, 'error', 8000)
            setTimeout(() => setProgressMap(prev => { const n = { ...prev }; delete n[searchId]; return n }), 6000)
            setRunningSearch(null)
        }
    }

    const handleDeleteSearch = async (searchId) => {
        if (!window.confirm('Ștergi această căutare?')) return
        await supabase.from('competitive_searches').delete().eq('id', searchId)
        setSelectedSearchIds(prev => { const n = new Set(prev); n.delete(searchId); return n })
        await loadSearches()
        showToast('✓ Căutare ștearsă', 'success')
    }

    const handleDeleteSelected = async () => {
        if (!selectedSearchIds.size) return
        if (!window.confirm(`Ștergi ${selectedSearchIds.size} căutări selectate?`)) return
        for (const id of selectedSearchIds) {
            await supabase.from('competitive_searches').delete().eq('id', id)
        }
        setSelectedSearchIds(new Set())
        await loadSearches()
        showToast(`✓ ${selectedSearchIds.size} căutări șterse`, 'success')
    }

    const toggleSelectSearch = (id) => {
        setSelectedSearchIds(prev => {
            const n = new Set(prev)
            if (n.has(id)) n.delete(id); else n.add(id)
            return n
        })
    }

    const handleSelectAll = () => {
        if (selectedSearchIds.size === searches.length) {
            setSelectedSearchIds(new Set())
        } else {
            setSelectedSearchIds(new Set(searches.map(s => s.id)))
        }
    }

    const handleRunAll = async () => {
        if (runningSearch) { showToast('O căutare este deja în curs…', 'info'); return }
        setRunningSearch('all')
        try {
            const resp = await fetch(`${import.meta.env.VITE_WORKER_URL || 'http://localhost:3001'}/api/competitive/run-all`, { method: 'POST' })
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
            // Use SSE if available, otherwise poll
            searches.forEach(s => {
                setProgressMap(prev => ({ ...prev, [s.id]: { label: `Programat: "${s.search_term}"`, pct: 0, done: false, error: null } }))
            })
            showToast('🚀 Toate căutările au pornit! Rezultatele se vor actualiza automat.', 'success', 6000)
            // Reload after delay
            setTimeout(() => { loadHistory(); setSearches(s => [...s]); setRunningSearch(null); setProgressMap({}) }, 30000)
        } catch (err) {
            showToast(`❌ Worker offline. Pornește: cd workers && node src/api-server.js`, 'error', 8000)
            setRunningSearch(null)
        }
    }

    const handleSaveSearch = async () => {
        try {
            const { brand_id, search_term, platforms, cities, notes, auto_cities, glovo_category, wolt_category } = form
            let savedSearch
            if (editingSearch?.id) {
                const { data } = await supabase.from('competitive_searches')
                    .update({ brand_id, search_term, platforms, cities, notes, auto_cities, glovo_category, wolt_category, updated_at: new Date().toISOString() })
                    .eq('id', editingSearch.id).select('*, brands(name, logo_url)').single()
                savedSearch = data
            } else {
                const { data } = await supabase.from('competitive_searches')
                    .insert({ brand_id, search_term, platforms, cities, notes, is_active: true, auto_cities, glovo_category, wolt_category })
                    .select('*, brands(name, logo_url)').single()
                savedSearch = data
            }
            setShowForm(false); setEditingSearch(null)
            setForm({ brand_id: '', search_term: '', platforms: ['glovo', 'wolt', 'bolt'], cities: ['Bucharest'], notes: '', auto_cities: true, glovo_category: '', wolt_category: '' })
            await loadSearches()
            if (savedSearch && !editingSearch) {
                setSelectedSearch(savedSearch)
                loadResults(savedSearch.id)
            }
        } catch (err) {
            console.error('Save search error:', err.message)
        }
    }

    const togglePlatform = (p) => setForm(f => ({ ...f, platforms: f.platforms.includes(p) ? f.platforms.filter(x => x !== p) : [...f.platforms, p] }))
    const toggleCity = (c) => setForm(f => ({ ...f, cities: f.cities.includes(c) ? f.cities.filter(x => x !== c) : [...f.cities, c] }))

    // Flatten & group by city
    const allCompetitors = results.flatMap(snap =>
        (snap.competitor_restaurants || []).map(comp => ({
            ...comp,
            platform: snap.platform,
            city: snap.city,
            date: snap.snapshot_date,
            products: comp.competitor_products || []
        }))
    )

    // Group: city → competitor name → appearances
    const cityMap = {}
    allCompetitors.forEach(c => {
        if (!cityMap[c.city]) cityMap[c.city] = {}
        if (!cityMap[c.city][c.name]) cityMap[c.city][c.name] = []
        cityMap[c.city][c.name].push(c)
    })
    const sortedCities = Object.keys(cityMap).sort()
    const totalCompetitors = Object.values(cityMap).reduce((sum, names) => sum + Object.keys(names).length, 0)

    // Progress bars derived
    const progressEntries = Object.entries(progressMap)  // [[searchId, prog], ...]

    // ─── Early return: show ONLY detail panel when competitor is selected ───
    if (detailCompetitor) {
        return (
            <div style={{ padding: '0', minHeight: '100vh', background: isDark ? '#111113' : '#f5f5f7', animation: 'fadeUp 0.2s ease' }}>
                <style>{`
                    @keyframes spin { to { transform: rotate(360deg); } }
                    @keyframes fadeUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
                    .mkt-btn { transition: all 0.15s ease; cursor: pointer; }
                `}</style>
            <div style={{
                background: isDark ? '#111113' : '#f5f5f7',
                animation: 'fadeUp 0.2s ease',
            }}>
                    {/* Sticky top bar */}
                    <div style={{
                        position: 'sticky', top: 0, zIndex: 10,
                        background: isDark ? 'rgba(17,17,19,0.92)' : 'rgba(245,245,247,0.92)',
                        backdropFilter: 'blur(20px)',
                        borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
                        padding: '14px 32px', display: 'flex', alignItems: 'center', gap: '16px',
                    }}>
                        <button onClick={() => { setDetailCompetitor(null); setBrandStats(null) }}
                            style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', cursor: 'pointer', color: '#2bbec8', fontSize: '14px', fontWeight: '600', padding: '6px 0' }}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6" /></svg>
                            {lang==='en'?'Back to History':'Înapoi la Istoric'}
                        </button>
                        <span style={{ color: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)' }}>/</span>
                        <span style={{ fontSize: '14px', fontWeight: '600', color: colors.text }}>{detailCompetitor.name}</span>
                        {detailCompetitor.city && <span style={{ fontSize: '13px', color: colors.textSecondary }}>{detailCompetitor.city}</span>}
                        <div style={{ display: 'flex', gap: '10px', marginLeft: 'auto', alignItems: 'center' }}>
                            {detailCompetitor.url && (
                                <a href={detailCompetitor.url} target="_blank" rel="noopener noreferrer"
                                    style={{ color: '#2bbec8', fontSize: '13px', textDecoration: 'none', fontWeight: '600' }}>
                                    Deschide pe platformă →
                                </a>
                            )}
                            <button onClick={exportCurrentView}
                                style={{ padding: '5px 12px', borderRadius: '7px', border: 'none', cursor: 'pointer', background: '#217346', color: '#fff', fontSize: '12px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M21.17 3H14V1h-4v2H2.83L1 4.83V21h22V4.83L21.17 3zM14 19h-4v-2h4v2zm0-4h-4v-2h4v2zm0-4h-4V9h4v2zm5 8h-3v-2h3v2zm0-4h-3v-2h3v2zm0-4h-3V9h3v2zM5 19H2v-2h3v2zm0-4H2v-2h3v2zm0-4H2V9h3v2z" /></svg>
                                Export Excel
                            </button>
                        </div>
                    </div>

                    <div style={{ maxWidth: '880px', margin: '0 auto', padding: '32px 24px 64px' }}>
                        {/* Title section */}
                        <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start', marginBottom: '28px' }}>
                            {/* Logo — competitor */}
                            <div style={{
                                width: 72, height: 72, borderRadius: '16px', flexShrink: 0, overflow: 'hidden',
                                background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
                                border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>
                                {brandStats?.logo_url ? (
                                    <img src={brandStats.logo_url} alt={detailCompetitor.name}
                                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                        onError={e => { e.currentTarget.style.display = 'none' }} />
                                ) : (
                                    <span style={{ fontSize: '26px', fontWeight: '800', color: colors.textSecondary }}>
                                        {detailCompetitor.name.charAt(0).toUpperCase()}
                                    </span>
                                )}
                            </div>
                            <div style={{ flex: 1 }}>
                                <h1 style={{ margin: '0 0 6px', fontSize: '24px', fontWeight: '800', color: colors.text, letterSpacing: '-0.8px' }}>
                                    {detailCompetitor.name}
                                </h1>
                                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                                    {detailCompetitor.city && <span style={{ fontSize: '14px', color: colors.textSecondary }}>{detailCompetitor.city}</span>}
                                    {detailCompetitor.platform && (
                                        <span style={{ fontSize: '12px', padding: '2px 10px', borderRadius: '20px', border: `1px solid ${isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)'}`, color: colors.textSecondary }}>{detailCompetitor.platform}</span>
                                    )}
                                    {detailCompetitor.searchContext && (
                                        <span style={{ fontSize: '12px', color: colors.textSecondary }}>
                                            Căutare: <strong style={{ color: colors.text }}>{detailCompetitor.searchContext}</strong>
                                        </span>
                                    )}
                                </div>
                            </div>
                            {/* Own brand logo + name — right-aligned */}
                            {brandStats?.ownBrand && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginLeft: 'auto', padding: '8px 14px', borderRadius: '12px', background: isDark ? 'rgba(43,190,200,0.08)' : 'rgba(43,190,200,0.06)', border: `1px solid ${isDark ? 'rgba(43,190,200,0.2)' : 'rgba(43,190,200,0.15)'}` }}>
                                    <div style={{ fontSize: '10px', fontWeight: '600', color: '#2bbec8', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '2px' }}>Brandul tău</div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        {brandStats.ownBrand.logo_url && (
                                            <img src={brandStats.ownBrand.logo_url} alt={brandStats.ownBrand.name}
                                                style={{ width: 32, height: 32, borderRadius: '8px', objectFit: 'cover' }}
                                                onError={e => { e.currentTarget.style.display = 'none' }} />
                                        )}
                                        <span style={{ fontSize: '14px', fontWeight: '700', color: colors.text }}>{brandStats.ownBrand.name}</span>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Loading spinner */}
                        {loadingStats && (
                            <div style={{ textAlign: 'center', padding: '60px', color: colors.textSecondary }}>
                                <svg style={{ animation: 'spin 1s linear infinite' }} width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>
                                <p style={{ marginTop: '14px', fontSize: '14px' }}>{lang==='en'?'Loading data...':'Se încarcă datele...'}</p>
                            </div>
                        )}

                        {!loadingStats && brandStats && (<>
                            {/* ── Stat cards ── */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '12px', marginBottom: '32px' }}>
                                {[
                                    { label: (lang === 'ru' ? 'Продукты' : (lang === 'en' ? 'Products' : 'Produse')), value: Object.keys(brandStats.priceHistory || {}).length || '—' },
                                    { label: 'Rating mediu', value: brandStats.avgRating ? `${brandStats.avgRating} / 10` : '—' },
                                    { label: 'Prima apariție', value: brandStats.firstSeen || '—' },
                                    { label: 'Ultima apariție', value: brandStats.lastSeen || '—' },
                                ].map(stat => (
                                    <div key={stat.label} style={{
                                        padding: '18px 20px', borderRadius: '14px',
                                        background: isDark ? 'rgba(255,255,255,0.04)' : '#ffffff',
                                        border: `1px solid ${isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.08)'}`,
                                    }}>
                                        <div style={{ fontSize: '22px', fontWeight: '700', color: colors.text, marginBottom: '5px', letterSpacing: '-0.5px' }}>{stat.value}</div>
                                        <div style={{ fontSize: '11px', color: colors.textSecondary, fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{stat.label}</div>
                                    </div>
                                ))}
                            </div>

                            {brandStats.rankHistory?.length > 0 && (() => {
                                const sorted = [...brandStats.rankHistory].sort((a, b) => b.date?.localeCompare(a.date) || 0)
                                const grouped = []
                                const dayMap = {}
                                sorted.forEach(r => {
                                    const dayKey = `${r.date}||${r.platform}||${r.city}`
                                    if (!dayMap[dayKey]) {
                                        dayMap[dayKey] = { date: r.date, platform: r.platform, city: r.city, checks: 0, ranks: [], lastRank: null }
                                        grouped.push(dayMap[dayKey])
                                    }
                                    const entry = dayMap[dayKey]
                                    entry.checks++
                                    const rank = r.rank_position ?? r.rank
                                    const rating = r.rating
                                    if (!entry.ranks.find(x => x.rank === rank)) entry.ranks.push({ rank, rating })
                                })
                                const totalPages = Math.ceil(grouped.length / RANK_PAGE_SIZE)
                                const paginated = grouped.slice((rankPage - 1) * RANK_PAGE_SIZE, rankPage * RANK_PAGE_SIZE)
                                return (
                                    <div style={{ marginBottom: '24px' }}>
                                        {/* Collapsible header */}
                                        <button onClick={() => setRankExpanded(v => !v)}
                                            style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'none', border: 'none', cursor: 'pointer', padding: '0 0 12px', width: '100%' }}>
                                            <span style={{ fontSize: '16px', fontWeight: '700', color: colors.text, letterSpacing: '-0.2px' }}>Istoric poziții</span>
                                            <span style={{ fontSize: '11px', color: colors.textSecondary, background: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)', borderRadius: '10px', padding: '2px 8px' }}>{grouped.length}</span>
                                            <svg style={{ marginLeft: 'auto', transition: 'transform 0.2s', transform: rankExpanded ? 'rotate(180deg)' : 'rotate(0deg)', color: colors.textSecondary }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9"/></svg>
                                        </button>
                                        {rankExpanded && (
                                            <div style={{ background: isDark ? 'rgba(255,255,255,0.03)' : '#ffffff', border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`, borderRadius: '12px', overflow: 'hidden' }}>
                                                {/* table header */}
                                                <div style={{ display: 'grid', gridTemplateColumns: '120px 110px 90px 80px 70px 80px', gap: '8px', padding: '9px 18px', background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)', borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}` }}>
                                                    {[(lang==='en'?'Date':'Data'), (lang==='en'?'Platform':'Platformă'), (lang==='en'?'City':'Oraș'), 'Rank', t('rating'), (lang==='en'?'Checks':'Verificări')].map(h => (
                                                        <span key={h} style={{ fontSize: '10px', fontWeight: '600', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: '0.4px' }}>{h}</span>
                                                    ))}
                                                </div>
                                                {/* rows */}
                                                {paginated.map((grp, gi) => {
                                                    const bestRank = grp.ranks.reduce((best, x) => (x.rank && (!best || x.rank < best)) ? x.rank : best, null)
                                                    const bestRating = grp.ranks.find(x => x.rank === bestRank)?.rating ?? grp.ranks[0]?.rating
                                                    const hasChange = grp.ranks.length > 1
                                                    if (!hasChange) return (
                                                        <div key={gi} style={{ display: 'grid', gridTemplateColumns: '120px 110px 90px 80px 70px 80px', gap: '8px', padding: '9px 18px', alignItems: 'center', borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}` }}>
                                                            <span style={{ fontSize: '12px', color: colors.textSecondary, fontVariantNumeric: 'tabular-nums' }}>{grp.date}</span>
                                                            <span style={{ fontSize: '12px', color: colors.textSecondary }}>{grp.platform}</span>
                                                            <span style={{ fontSize: '12px', color: colors.textSecondary }}>{grp.city}</span>
                                                            <span style={{ fontSize: '13px', fontWeight: '700', color: bestRank && bestRank <= 3 ? '#2bbec8' : colors.text }}>{bestRank ? `#${bestRank}` : '—'}</span>
                                                            <span style={{ fontSize: '12px', color: colors.textSecondary }}>{bestRating ? `${bestRating}/10` : '—'}</span>
                                                            <span style={{ fontSize: '11px', color: colors.textSecondary, background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)', borderRadius: '5px', padding: '2px 7px', textAlign: 'center', width: 'fit-content' }}>{grp.checks}×</span>
                                                        </div>
                                                    )
                                                    return grp.ranks.map((rankEntry, ri) => (
                                                        <div key={`${gi}-${ri}`} style={{ display: 'grid', gridTemplateColumns: '120px 110px 90px 80px 70px 80px', gap: '8px', padding: '8px 18px', alignItems: 'center', borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}`, background: ri % 2 === 1 ? (isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)') : 'transparent' }}>
                                                            <span style={{ fontSize: '12px', color: ri === 0 ? colors.textSecondary : 'transparent', fontVariantNumeric: 'tabular-nums' }}>{ri === 0 ? grp.date : ''}</span>
                                                            <span style={{ fontSize: '12px', color: ri === 0 ? colors.textSecondary : 'transparent' }}>{ri === 0 ? grp.platform : ''}</span>
                                                            <span style={{ fontSize: '12px', color: ri === 0 ? colors.textSecondary : 'transparent' }}>{ri === 0 ? grp.city : ''}</span>
                                                            <span style={{ fontSize: '13px', fontWeight: '700', color: rankEntry.rank && rankEntry.rank <= 3 ? '#2bbec8' : colors.text }}>{rankEntry.rank ? `#${rankEntry.rank}` : '—'}</span>
                                                            <span style={{ fontSize: '12px', color: colors.textSecondary }}>{rankEntry.rating ? `${rankEntry.rating}/10` : '—'}</span>
                                                            {ri === 0 && <span style={{ fontSize: '11px', color: '#f59e0b', background: isDark ? 'rgba(245,158,11,0.15)' : 'rgba(245,158,11,0.1)', borderRadius: '5px', padding: '2px 7px', textAlign: 'center', width: 'fit-content' }}>↕ {grp.checks}×</span>}
                                                            {ri > 0 && <span />}
                                                        </div>
                                                    ))
                                                })}
                                                {/* Pagination */}
                                                {totalPages > 1 && (
                                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '10px 18px', borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}` }}>
                                                        <button onClick={() => setRankPage(p => Math.max(1, p - 1))} disabled={rankPage === 1}
                                                            style={{ padding: '4px 10px', borderRadius: '7px', border: `1px solid ${colors.border}`, background: 'transparent', color: rankPage === 1 ? colors.textSecondary : colors.text, cursor: rankPage === 1 ? 'default' : 'pointer', fontSize: '12px', fontWeight: '600', opacity: rankPage === 1 ? 0.4 : 1 }}>‹</button>
                                                        <span style={{ fontSize: '12px', color: colors.textSecondary }}>{rankPage} / {totalPages}</span>
                                                        <button onClick={() => setRankPage(p => Math.min(totalPages, p + 1))} disabled={rankPage === totalPages}
                                                            style={{ padding: '4px 10px', borderRadius: '7px', border: `1px solid ${colors.border}`, background: 'transparent', color: rankPage === totalPages ? colors.textSecondary : colors.text, cursor: rankPage === totalPages ? 'default' : 'pointer', fontSize: '12px', fontWeight: '600', opacity: rankPage === totalPages ? 0.4 : 1 }}>›</button>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )
                            })()}

                            {/* ── Products & Prices — smart view ── */}
                            {Object.entries(brandStats.priceHistory || {}).length > 0 && (() => {
                                const PERIODS = [
                                    { label: '7 zile', days: 7 },
                                    { label: '30 zile', days: 30 },
                                    { label: '90 zile', days: 90 },
                                    { label: 'Tot', days: null },
                                ]

                                // Deduplicate + filter by period
                                const filterHistory = (raw) => {
                                    const cutoff = pricePeriod
                                        ? new Date(Date.now() - pricePeriod * 86400000).toISOString().split('T')[0]
                                        : null
                                    const byDate = {}
                                        ; (raw || []).forEach(h => {
                                            if (cutoff && h.date < cutoff) return
                                            byDate[h.date] = h.price // last write wins (same day dedup)
                                        })
                                    return Object.entries(byDate)
                                        .sort(([a], [b]) => a.localeCompare(b))
                                        .map(([date, price]) => ({ date, price: Number(price) }))
                                }

                                const rawEntries = Object.entries(brandStats.priceHistory)
                                const visibleEntries = rawEntries
                                    .map(([pName, raw]) => ({ pName, history: filterHistory(raw) }))
                                    .filter(e => e.history.length > 0)

                                return (
                                    <div>
                                        {/* Header + period tabs + fetch button */}
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px', flexWrap: 'wrap' }}>
                                            <h2 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: colors.text, letterSpacing: '-0.2px' }}>
                                                Produse și prețuri
                                                <span style={{ fontSize: '12px', fontWeight: '400', color: colors.textSecondary, marginLeft: '10px' }}>
                                                    {visibleEntries.length} produse
                                                </span>
                                            </h2>
                                            {/* Fetch products button — always visible */}
                                            {(() => {
                                                const latestApp = (brandStats.appearances || []).find(a => a.url && a.platform === 'wolt') || (brandStats.appearances || []).find(a => a.url)
                                                if (!latestApp?.url) return null
                                                return (
                                                    <button onClick={async () => {
                                                        setFetchingProducts(true)
                                                        try {
                                                            const res = await fetch(`${import.meta.env.VITE_WORKER_URL || 'http://localhost:3001'}/api/competitive/scrape-restaurant`, {
                                                                method: 'POST',
                                                                headers: { 'Content-Type': 'application/json' },
                                                                body: JSON.stringify({ url: latestApp.url, name: detailCompetitor.name, restaurantId: latestApp.id })
                                                            })
                                                            const data = await res.json()
                                                            if (data.success) await loadBrandStats(detailCompetitor.name, detailCompetitor.city)
                                                            else alert('Fetch eșuat: ' + (data.error || 'fără produse găsite'))
                                                        } catch (e) { alert('Eroare: ' + e.message) }
                                                        finally { setFetchingProducts(false) }
                                                    }} disabled={fetchingProducts}
                                                        style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 12px', borderRadius: '7px', border: `1px solid ${isDark ? 'rgba(43,190,200,0.4)' : 'rgba(43,190,200,0.3)'}`, background: isDark ? 'rgba(43,190,200,0.12)' : 'rgba(43,190,200,0.06)', color: '#2bbec8', fontSize: '12px', fontWeight: '600', cursor: fetchingProducts ? 'not-allowed' : 'pointer', opacity: fetchingProducts ? 0.6 : 1 }}>
                                                        {fetchingProducts
                                                            ? <><span style={{ display: 'inline-block', width: 11, height: 11, border: '2px solid rgba(43,190,200,0.3)', borderTopColor: '#2bbec8', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} /> Fetching...</>
                                                            : <><span>🔄</span> Refresh produse</>}
                                                    </button>
                                                )
                                            })()}
                                            <div style={{ marginLeft: 'auto', display: 'flex', gap: '2px', background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)', borderRadius: '8px', padding: '3px' }}>
                                                {PERIODS.map(p => (
                                                    <button key={p.label}
                                                        onClick={() => setPricePeriod(p.days)}
                                                        style={{ padding: '4px 10px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '11px', fontWeight: '600', transition: 'all 0.12s', background: pricePeriod === p.days ? (isDark ? 'rgba(255,255,255,0.12)' : '#fff') : 'transparent', color: pricePeriod === p.days ? colors.text : colors.textSecondary, boxShadow: pricePeriod === p.days ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}>
                                                        {p.label}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        <div style={{ background: isDark ? 'rgba(255,255,255,0.03)' : '#ffffff', border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`, borderRadius: '12px', overflow: 'hidden' }}>
                                            {/* Table header */}
                                            <div style={{ display: 'grid', gridTemplateColumns: '48px 1fr 110px 100px', gap: '8px', padding: '9px 18px', background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)', borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}` }}>
                                                {['', t('view_by_product'), lang==='en'?'Variation':'Variație', lang==='en'?'Current price':'Preț actual'].map((h, hi) => (
                                                    <span key={hi} style={{ fontSize: '10px', fontWeight: '600', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: '0.4px' }}>{h}</span>
                                                ))}
                                            </div>

                                            {visibleEntries.map(({ pName, history }) => {
                                                const sortedHistory = [...history].sort((a, b) => (a.date || '').localeCompare(b.date || ''))
                                                const prices = sortedHistory.map(h => h.price)
                                                const first = prices[0] ?? 0
                                                const last = prices[prices.length - 1] ?? 0
                                                const pctChange = first > 0 ? ((last - first) / first * 100) : 0
                                                const hasChange = Math.abs(pctChange) > 0.01
                                                const isUp = last > first
                                                const trendColor = !hasChange ? '#f59e0b' : isUp ? '#ef4444' : '#22c55e'
                                                const isExpanded = expandedProduct === pName
                                                const productImgUrl = (brandStats.productMeta || {})[pName]?.image_url || null



                                                return (
                                                    <div key={pName}>
                                                        {/* Main product row — clickable */}
                                                        <div
                                                            onClick={() => setExpandedProduct(isExpanded ? null : pName)}
                                                            style={{ display: 'grid', gridTemplateColumns: '48px 1fr 110px 110px', gap: '8px', padding: '10px 18px', alignItems: 'center', borderBottom: isExpanded ? 'none' : `1px solid ${isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}`, cursor: 'pointer', transition: 'background 0.1s', background: isExpanded ? (isDark ? 'rgba(43,190,200,0.06)' : 'rgba(43,190,200,0.04)') : 'transparent' }}
                                                            onMouseEnter={e => { if (!isExpanded) e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)' }}
                                                            onMouseLeave={e => { if (!isExpanded) e.currentTarget.style.background = 'transparent' }}>
                                                            {/* Product thumbnail */}
                                                            <div 
                                                                onClick={(e) => {
                                                                    e.stopPropagation()
                                                                    const meta = (brandStats.productMeta || {})[pName] || {}
                                                                    setSelectedProduct({
                                                                        name: pName,
                                                                        image: productImgUrl || null,
                                                                        brand: detailCompetitor.name,
                                                                        platform: meta.platform || detailCompetitor.platform || 'wolt',
                                                                        category: meta.category || 'N/A',
                                                                        weight: meta.weight || '—',
                                                                        pieces: meta.pieces || '1',
                                                                        description: meta.description || '',
                                                                        platformUrl: meta.url || detailCompetitor.url,
                                                                        firstPrice: first,
                                                                        currentPrice: last,
                                                                        pctChange
                                                                    })
                                                                }}
                                                                style={{ width: 40, height: 40, borderRadius: '8px', overflow: 'hidden', background: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                                {productImgUrl
                                                                    ? <img src={productImgUrl} alt={pName}
                                                                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                                                        onError={e => { e.currentTarget.style.display = 'none' }} />
                                                                    : <span style={{ fontSize: '18px', opacity: 0.25 }}>🍽️</span>}
                                                            </div>
                                                            <div>
                                                                <div style={{ fontSize: '13px', fontWeight: '500', color: colors.text, marginBottom: history.length > 1 ? '2px' : 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                                    <span style={{ fontSize: '10px', color: colors.textSecondary, transition: 'transform 0.15s', display: 'inline-block', transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}>▶</span>
                                                                    {pName}
                                                                </div>
                                                                {history.length > 1 && (
                                                                    <div style={{ fontSize: '10px', color: colors.textSecondary, paddingLeft: '16px' }}>
                                                                        {history[0].date} → {history[history.length - 1].date} · {history.length} măsurători
                                                                    </div>
                                                                )}
                                                            </div>
                                                            {/* Variatie pill */}
                                                            <span style={{
                                                                display: 'inline-flex', alignItems: 'center', gap: '4px',
                                                                fontSize: '11px', fontWeight: '700',
                                                                padding: '4px 10px', borderRadius: '20px',
                                                                background: !hasChange
                                                                    ? 'rgba(245,158,11,0.12)'
                                                                    : isUp ? 'rgba(239,68,68,0.12)' : 'rgba(34,197,94,0.12)',
                                                                color: trendColor,
                                                            }}>
                                                                {!hasChange ? (
                                                                    <>
                                                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>
                                                                        Stabil
                                                                    </>
                                                                ) : isUp ? (
                                                                    <>
                                                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>
                                                                        +{pctChange.toFixed(2).replace('.', ',')}%
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 17 13.5 8.5 8.5 13.5 2 7"/><polyline points="16 17 22 17 22 11"/></svg>
                                                                        {pctChange.toFixed(2).replace('.', ',')}%
                                                                    </>
                                                                )}
                                                            </span>
                                                            <div style={{ textAlign: 'right' }}>
                                                                <span style={{ fontSize: '15px', fontWeight: '700', color: '#2bbec8' }}>{last.toFixed(2)}</span>
                                                                <span style={{ fontSize: '11px', color: colors.textSecondary }}> RON</span>
                                                            </div>
                                                        </div>

                                                        {/* Expanded: date → price table */}
                                                        {isExpanded && (
                                                            <div style={{ borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}`, background: isDark ? 'rgba(0,0,0,0.15)' : 'rgba(0,0,0,0.02)', padding: '0 18px 12px 36px' }}>
                                                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                                                                    <thead>
                                                                        <tr>
                                                                            <th style={{ padding: '6px 8px', textAlign: 'left', fontWeight: '600', color: colors.textSecondary, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.4px', borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}` }}>Data</th>
                                                                            <th style={{ padding: '6px 8px', textAlign: 'right', fontWeight: '600', color: colors.textSecondary, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.4px', borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}` }}>Preț</th>
                                                                            <th style={{ padding: '6px 8px', textAlign: 'right', fontWeight: '600', color: colors.textSecondary, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.4px', borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}` }}>Δ față de prev.</th>
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody>
                                                                        {history.map((h, idx) => {
                                                                            const prev = idx > 0 ? history[idx - 1].price : null
                                                                            const delta = prev !== null ? h.price - prev : null
                                                                            return (
                                                                                <tr key={h.date + idx}>
                                                                                    <td style={{ padding: '5px 8px', color: colors.textSecondary }}>{h.date}</td>
                                                                                    <td style={{ padding: '5px 8px', textAlign: 'right', fontWeight: '600', color: colors.text }}>{h.price.toFixed(2)} <span style={{ fontSize: '10px', fontWeight: '400', color: colors.textSecondary }}>RON</span></td>
                                                                                    <td style={{ padding: '5px 8px', textAlign: 'right', fontWeight: '600', color: delta === null ? colors.textSecondary : delta > 0 ? '#ef4444' : delta < 0 ? '#22c55e' : colors.textSecondary }}>
                                                                                        {delta === null ? '—' : delta === 0 ? '—' : `${delta > 0 ? '+' : ''}${delta.toFixed(2)} RON`}
                                                                                    </td>
                                                                                </tr>
                                                                            )
                                                                        })}
                                                                    </tbody>
                                                                </table>
                                                            </div>
                                                        )}
                                                    </div>
                                                )
                                            })}

                                            {visibleEntries.length === 0 && (
                                                <div style={{ textAlign: 'center', padding: '28px', color: colors.textSecondary, fontSize: '13px' }}>
                                                    Nicio dată disponibilă pentru perioada selectată.
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )
                            })()}

                            {Object.keys(brandStats.priceHistory || {}).length === 0 && (() => {
                                const latestAppearance = (brandStats.appearances || []).find(a => a.url && a.platform === detailCompetitor.platform) || (brandStats.appearances || []).find(a => a.url)
                                const restaurantId = latestAppearance?.id || detailCompetitor.id || null
                                const defaultUrl = detailCompetitor.url || latestAppearance?.url || ''
                                const workerUrl = import.meta.env.VITE_WORKER_URL || 'http://localhost:3001'

                                return (
                                    <div style={{ padding: '28px', border: `1px dashed ${isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)'}`, borderRadius: '12px', display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                                        <div style={{ fontSize: '28px', flexShrink: 0 }}>🍽️</div>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontWeight: '600', color: colors.text, marginBottom: '6px', fontSize: '14px' }}>{lang==='en'?'No menu information':'Nicio informație despre meniu'}</div>
                                            <div style={{ fontSize: '13px', color: colors.textSecondary, lineHeight: '1.6', marginBottom: '14px' }}>
                                                {lang==='en'
                                                    ? 'Products are automatically extracted for the first 25 restaurants from Wolt results. You can force extraction manually by pressing the button below.'
                                                    : <>Produsele se extrag automat pentru <strong>primele 25 restaurante</strong> din rezultatele Wolt.<br />Poți forța extragerea manual apăsând butonul de mai jos.</>}
                                            </div>
                                            {defaultUrl ? (
                                                <button onClick={async () => {
                                                    if (fetchingProducts) return
                                                    setFetchingProducts(true)
                                                    try {
                                                        const res = await fetch(`${workerUrl}/api/competitive/scrape-restaurant`, {
                                                            method: 'POST',
                                                            headers: { 'Content-Type': 'application/json' },
                                                            body: JSON.stringify({ url: defaultUrl, name: detailCompetitor.name, restaurantId })
                                                        })
                                                        const data = await res.json()
                                                        if (data.success && data.count > 0) {
                                                            await loadBrandStats(detailCompetitor.name, detailCompetitor.city)
                                                        } else {
                                                            alert('Fetch eșuat: ' + (data.error || 'fără produse găsite'))
                                                        }
                                                    } catch (e) { alert('Eroare: ' + e.message) }
                                                    finally { setFetchingProducts(false) }
                                                }} disabled={fetchingProducts}
                                                    style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '9px 18px', borderRadius: '9px', border: 'none', cursor: fetchingProducts ? 'not-allowed' : 'pointer', background: '#2bbec8', color: 'white', fontSize: '13px', fontWeight: '600', opacity: fetchingProducts ? 0.7 : 1, transition: 'opacity 0.2s' }}>
                                                    {fetchingProducts
                                                        ? <><span style={{ display: 'inline-block', width: 14, height: 14, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} /> Fetching produse...</>
                                                        : <><span style={{ fontSize: '16px' }}>🔍</span> Fetch produse acum</>}
                                                </button>
                                            ) : (
                                                <div style={{ fontSize: '12px', color: '#ef4444' }}>⚠️ URL Wolt lipsă — rulează o căutare pentru a obține URL-ul restaurantului.</div>
                                            )}
                                        </div>
                                    </div>
                                )
                            })()}
                        </>)}

                        {!loadingStats && !brandStats && (
                            <div style={{ textAlign: 'center', padding: '60px', color: colors.textSecondary, fontSize: '14px' }}>
                                Nu s-au găsit date istorice.
                            </div>
                        )}
                    </div>
                    
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
                                        <div style={{ fontSize: '12px', fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '12px' }}>{lang==='en'?'Historical Price Evolution':'Evoluție Istorică Preț'}</div>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                            <div>
                                                <div style={{ fontSize: '12px', color: colors.textSecondary, marginBottom: '2px' }}>{lang==='en'?'Initial price (period)':'Preț inițial (perioadă)'}</div>
                                                <div style={{ fontSize: '14px', color: colors.text }}>{selectedProduct.firstPrice.toFixed(2)} lei</div>
                                            </div>
                                            {(Math.abs(selectedProduct.pctChange) > 0.01) && (
                                                <div style={{ textAlign: 'center' }}>
                                                    <div style={{ padding: '6px 12px', borderRadius: '20px', fontSize: '14px', fontWeight: '800', background: selectedProduct.pctChange > 0 ? (isDark ? 'rgba(239,68,68,0.15)' : '#fef2f2') : (isDark ? 'rgba(34,197,94,0.15)' : '#f0fdf4'), color: selectedProduct.pctChange > 0 ? '#ef4444' : '#22c55e' }}>
                                                        {selectedProduct.pctChange > 0 ? '+' : ''}{selectedProduct.pctChange.toFixed(2)}%
                                                    </div>
                                                </div>
                                            )}
                                            <div style={{ textAlign: 'right' }}>
                                                <div style={{ fontSize: '12px', color: colors.textSecondary, marginBottom: '2px' }}>{lang==='en'?'Current Price':'Preț Curent'}</div>
                                                <div style={{ fontSize: '20px', fontWeight: '800', color: '#2bbec8' }}>{selectedProduct.currentPrice.toFixed(2)} lei</div>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    {selectedProduct.platformUrl && (
                                        <a href={selectedProduct.platformUrl} target="_blank" rel="noopener noreferrer"
                                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', width: '100%', padding: '12px', background: PLATFORM_COLORS[selectedProduct.platform] || (isDark ? 'rgba(255,255,255,0.05)' : '#ffffff'), border: `1px solid ${PLATFORM_COLORS[selectedProduct.platform] ? 'transparent' : colors.border}`, borderRadius: '12px', color: PLATFORM_COLORS[selectedProduct.platform] ? '#fff' : colors.text, textDecoration: 'none', fontSize: '13px', fontWeight: '700', transition: 'opacity 0.2s' }}
                                            onMouseOver={e => e.currentTarget.style.opacity = '0.9'}
                                            onMouseOut={e => e.currentTarget.style.opacity = '1'}>
                                            Deschide pagina restaurantului pe {selectedProduct.platform.charAt(0).toUpperCase() + selectedProduct.platform.slice(1)}
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                                        </a>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        )
    }


    return (
        <div style={{ padding: '24px 32px', minHeight: '100vh' }}>
            <style>{`
                @keyframes spin { to { transform: rotate(360deg); } }
                @keyframes fadeUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
                @keyframes progressPulse { 0%,100% { opacity:1; } 50% { opacity:0.7; } }
                @keyframes slideIn { from { opacity: 0; transform: translateX(20px); } to { opacity: 1; transform: translateX(0); } }
                @keyframes toastIn { from { opacity:0; transform: translateY(16px) scale(0.96); } to { opacity:1; transform: translateY(0) scale(1); } }
                .mkt-btn { transition: all 0.15s ease; cursor: pointer; }
                .mkt-btn:hover { opacity: 0.85; transform: translateY(-1px); }
                .mkt-card { transition: all 0.2s ease; }
                .mkt-card:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,0,0,0.12); }
                .comp-row { transition: all 0.15s; cursor: pointer; }
                .comp-row:hover { background: rgba(236,72,153,0.05) !important; }
            `}</style>

            {/* ── Toast notification ── */}
            {toast && (
                <div style={{
                    position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
                    padding: '12px 18px', borderRadius: '12px',
                    background: toast.type === 'success' ? '#16a34a' : toast.type === 'error' ? '#dc2626' : (isDark ? '#3730a3' : '#4f46e5'),
                    color: 'white', fontSize: '13px', fontWeight: '600',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
                    display: 'flex', alignItems: 'center', gap: '10px',
                    animation: 'toastIn 0.3s cubic-bezier(.34,1.56,.64,1)',
                    maxWidth: 340, lineHeight: 1.4,
                }}>
                    {toast.type === 'info' && (
                        <svg style={{ animation: 'spin 1s linear infinite', flexShrink: 0 }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                        </svg>
                    )}
                    <span>{toast.msg}</span>
                    <button onClick={() => setToast(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', fontSize: '16px', lineHeight: 1, padding: '0 0 0 4px', flexShrink: 0 }}>×</button>
                </div>
            )}

            {/* Header — title only, buttons moved to tab row */}
            <div style={{ marginBottom: '20px', animation: 'fadeUp 0.3s ease' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '4px' }}>
                    <div style={{ width: 36, height: 36, borderRadius: '10px', background: isDark ? 'rgba(43,190,200,0.2)' : 'rgba(43,190,200,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2bbec8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
                        </svg>
                    </div>
                    <h1 style={{ fontSize: '22px', fontWeight: '700', margin: 0, color: colors.text, letterSpacing: '-0.4px' }}>{t('marketing_title')}</h1>
                </div>
                <p style={{ fontSize: '12px', color: colors.textSecondary, margin: '2px 0 0 48px' }}>
                    {t('marketing_subtitle')}
                </p>
            </div>

            {/* ─── MULTIPLE PROGRESS BARS ─── */}
            {progressEntries.map(([searchId, prog]) => {
                const pct = prog.pct ?? (prog.totalSteps ? Math.round(((prog.step || 0) / prog.totalSteps) * 100) : 0)
                const label = prog.label || (prog.done ? '✓ Finalizat!' : prog.currentCity ? `📍 ${prog.currentCity} · ${(prog.currentPlatform || '').toUpperCase()}` : 'Se procesează…')
                const searchTerm = prog.searchTerm || ''
                return (
                    <div key={searchId} style={{ ...glass, marginBottom: '12px', padding: '14px 18px', animation: 'slideIn 0.3s ease', borderLeft: `3px solid ${prog.error ? '#ef4444' : '#2bbec8'}` }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                {!prog.done && !prog.error
                                    ? <svg style={{ animation: 'spin 1s linear infinite', color: '#2bbec8', flexShrink: 0 }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>
                                    : <span style={{ fontSize: '16px' }}>{prog.error ? '❌' : '✅'}</span>
                                }
                                <div>
                                    <div style={{ fontSize: '13px', fontWeight: '700', color: colors.text }}>
                                        {prog.done ? `${(lang === 'ru' ? 'Готово' : (lang === 'en' ? 'Done' : 'Finalizat'))}${searchTerm ? `: "${searchTerm}"` : ''}` : label}
                                    </div>
                                    {!prog.done && (prog.step || prog.totalSteps) && (
                                        <div style={{ fontSize: '11px', color: colors.textSecondary, marginTop: '2px' }}>
                                            {(lang === 'ru' ? 'Шаг' : (lang === 'en' ? 'Step' : 'Pas'))} {prog.step || 0}/{prog.totalSteps || '?'}
                                        </div>
                                    )}
                                </div>
                            </div>
                            <span style={{ fontSize: '15px', fontWeight: '700', color: prog.error ? '#ef4444' : '#2bbec8' }}>{pct}%</span>
                        </div>
                        <div style={{ height: '5px', borderRadius: '3px', background: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)', overflow: 'hidden', marginBottom: '8px' }}>
                            <div style={{ height: '100%', borderRadius: '3px', width: `${Math.max(pct, prog.done ? 100 : 2)}%`, background: prog.error ? 'linear-gradient(90deg,#ef4444,#f97316)' : 'linear-gradient(90deg, #2bbec8, #17a2b8)', transition: 'width 0.6s ease' }} />
                        </div>
                        {(prog.log || []).length > 0 && (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', maxHeight: '44px', overflow: 'hidden' }}>
                                {(prog.log || []).slice(-10).map((item, i) => (
                                    <span key={i} style={{ padding: '2px 7px', borderRadius: '6px', fontSize: '11px', fontWeight: '600', background: item.ok ? `${PLATFORM_COLORS[item.platform] || '#888'}18` : 'rgba(255,59,48,0.1)', color: item.ok ? (PLATFORM_COLORS[item.platform] || colors.text) : '#FF3B30' }}>
                                        {item.ok ? '✓' : '✗'} {item.city} {item.platform ? `(${item.platform})` : ''} {item.found !== undefined ? `• ${item.found}` : ''}
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>
                )
            })}

            {/* Action buttons + all tab content — hidden when detail is open */}
            {/* Action buttons — inline header, tab-specific */}
            {activeTab === 'searches' && (
                <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', alignItems: 'center', flexWrap: 'wrap' }}>
                    {/* Select All checkbox */}
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: '600', color: colors.textSecondary, padding: '6px 10px', borderRadius: '8px', background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)', border: `1px solid ${colors.border}` }}>
                        <input type="checkbox"
                            checked={searches.length > 0 && selectedSearchIds.size === searches.length}
                            ref={el => { if (el) el.indeterminate = selectedSearchIds.size > 0 && selectedSearchIds.size < searches.length }}
                            onChange={handleSelectAll}
                            style={{ accentColor: '#2bbec8', width: '14px', height: '14px' }} />
                        {selectedSearchIds.size > 0 ? `${selectedSearchIds.size} selectate` : 'Toate'}
                    </label>
                    {selectedSearchIds.size > 0 && (
                        <button className="mkt-btn" onClick={handleDeleteSelected}
                            style={{ padding: '7px 14px', borderRadius: '8px', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: '600', color: 'white', background: '#EF4444' }}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
                            Șterge ({selectedSearchIds.size})
                        </button>
                    )}
                    <button className="mkt-btn" onClick={handleRunAll} disabled={runningSearch === 'all'}
                        style={{ padding: '7px 14px', borderRadius: '8px', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: '600', color: 'white', background: '#2bbec8', opacity: runningSearch === 'all' ? 0.7 : 1 }}>
                        {runningSearch === 'all'
                            ? <svg style={{ animation: 'spin 1s linear infinite' }} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>
                            : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polygon points="5 3 19 12 5 21 5 3" /></svg>}
                        {runningSearch === 'all' ? ((lang === 'ru' ? 'Выполняется…' : (lang === 'en' ? 'Running…' : 'Se rulează…'))) : t('run_all')}
                    </button>
                    <button className="mkt-btn" onClick={() => { setShowForm(true); setEditingSearch(null) }}
                        style={{ ...glass, padding: '7px 14px', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: '600', color: colors.text }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                        {t('add_search')}
                    </button>
                </div>
            )}

            {/* Istoric filter row — below tabs, only when Istoric is active */}
            {activeTab === 'prices' && (
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '20px', padding: '10px 14px', background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)', borderRadius: '10px', border: `1px solid ${colors.border}` }}>
                    {[{ label: 'Azi', days: 0 }, { label: '7z', days: 7 }, { label: '30z', days: 30 }, { label: '90z', days: 90 }].map(({ label, days }) => (
                        <button key={label} className="mkt-btn" onClick={() => {
                            const f = days === 0 ? today : new Date(Date.now() - days * 86400000).toISOString().split('T')[0]
                            setDateFrom(f); setDateTo(today)
                            loadHistory(f, today, historyCity, historyPlatform)
                        }} style={{ padding: '5px 10px', borderRadius: '7px', border: `1px solid ${colors.border}`, cursor: 'pointer', fontSize: '12px', fontWeight: '600', background: 'transparent', color: colors.textSecondary }}>
                            {label}
                        </button>
                    ))}
                    <div style={{ width: 1, height: 20, background: colors.border }} />
                    <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                        style={{ padding: '5px 8px', borderRadius: '7px', border: `1px solid ${colors.border}`, background: isDark ? 'rgba(255,255,255,0.06)' : '#fff', color: colors.text, fontSize: '12px' }} />
                    <span style={{ fontSize: '11px', color: colors.textSecondary }}>→</span>
                    <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                        style={{ padding: '5px 8px', borderRadius: '7px', border: `1px solid ${colors.border}`, background: isDark ? 'rgba(255,255,255,0.06)' : '#fff', color: colors.text, fontSize: '12px' }} />
                    <select value={historyCity} onChange={e => setHistoryCity(e.target.value)}
                        style={{ padding: '5px 8px', borderRadius: '7px', border: `1px solid ${colors.border}`, background: isDark ? 'rgba(255,255,255,0.06)' : '#fff', color: colors.text, fontSize: '12px' }}>
                        <option value="">{lang==='en'?'All cities':'Toate orașele'}</option>
                        {ALL_CITIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <select value={historyPlatform} onChange={e => setHistoryPlatform(e.target.value)}
                        style={{ padding: '5px 8px', borderRadius: '7px', border: `1px solid ${colors.border}`, background: isDark ? 'rgba(255,255,255,0.06)' : '#fff', color: colors.text, fontSize: '12px' }}>
                        <option value="">Toate platformele</option>
                        <option value="wolt">Wolt</option>
                        <option value="glovo">Glovo</option>
                    </select>
                    <div style={{ flex: 1 }} />
                    <button className="mkt-btn" onClick={() => loadHistory(dateFrom, dateTo, historyCity, historyPlatform)}
                        style={{ padding: '5px 16px', borderRadius: '7px', border: 'none', cursor: 'pointer', background: '#2bbec8', color: 'white', fontSize: '12px', fontWeight: '600' }}>
                        Caută
                    </button>
                    <button className="mkt-btn" onClick={exportCurrentView}
                        style={{ padding: '5px 12px', borderRadius: '7px', border: 'none', cursor: 'pointer', background: '#217346', color: '#fff', fontSize: '12px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M21.17 3H14V1h-4v2H2.83L1 4.83V21h22V4.83L21.17 3zM14 19h-4v-2h4v2zm0-4h-4v-2h4v2zm0-4h-4V9h4v2zm5 8h-3v-2h3v2zm0-4h-3v-2h3v2zm0-4h-3V9h3v2zM5 19H2v-2h3v2zm0-4H2v-2h3v2zm0-4H2V9h3v2z" /></svg>
                        Export Excel
                    </button>
                </div>
            )}

            {/* ─── TAB: SEARCHES CONFIG ─── */}
            {activeTab === 'searches' && (
                <div style={{ display: 'grid', gap: '16px', animation: 'fadeUp 0.3s ease' }}>
                    {searches.length === 0 && (
                        <div style={{ ...glass, padding: '48px', textAlign: 'center' }}>
                            <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔍</div>
                            <h3 style={{ color: colors.text, fontSize: '18px', fontWeight: '600', margin: '0 0 8px' }}>Nicio căutare configurată</h3>
                            <p style={{ color: colors.textSecondary, fontSize: '14px', margin: '0 0 20px' }}>{lang === 'ru' ? 'Добавьте поиск для автоматического мониторинга конкурентов' : 'Adaugă o căutare pentru a monitoriza concurența automat'}</p>
                            <button className="mkt-btn" onClick={() => setShowForm(true)}
                                style={{ padding: '12px 24px', borderRadius: '10px', border: 'none', background: 'linear-gradient(135deg, #2bbec8, #17a2b8)', color: 'white', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}>
                                + {lang === 'ru' ? 'Добавить первый поиск' : 'Adaugă prima căutare'}
                            </button>
                        </div>
                    )}
                    {searches.map(search => {
                        const isRunning = runningSearch === search.id
                        const isSelected = selectedSearchIds.has(search.id)
                        return (
                            <div key={search.id} className="mkt-card" style={{ ...glass, padding: '18px 22px', display: 'flex', alignItems: 'center', gap: '16px', outline: isSelected ? `2px solid #2bbec8` : 'none' }}>
                                {/* Checkbox */}
                                <input type="checkbox" checked={isSelected} onChange={() => toggleSelectSearch(search.id)}
                                    style={{ accentColor: '#2bbec8', width: '16px', height: '16px', flexShrink: 0, cursor: 'pointer' }} />
                                {/* Brand logo */}
                                <div style={{ width: 44, height: 44, borderRadius: '12px', overflow: 'hidden', flexShrink: 0, background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    {search.brands?.logo_url
                                        ? <img src={search.brands.logo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { e.currentTarget.style.display = 'none' }} />
                                        : <span style={{ fontSize: '18px', fontWeight: '700', color: '#2bbec8' }}>{(search.brands?.name || '?')[0]}</span>
                                    }
                                </div>
                                {/* Info */}
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '5px' }}>
                                        <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '700', color: colors.text }}>"{search.search_term}"</h3>
                                        <span style={{ padding: '2px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '600', background: search.is_active ? 'rgba(52,199,89,0.15)' : 'rgba(150,150,150,0.15)', color: search.is_active ? '#34C759' : colors.textSecondary }}>
                                            {search.is_active ? '● Activ' : '○ Inactiv'}
                                        </span>
                                    </div>
                                    <div style={{ fontSize: '12px', color: colors.textSecondary, marginBottom: '6px' }}>
                                        Brand: <strong style={{ color: colors.text }}>{search.brands?.name || 'Toți'}</strong>
                                        {search.notes && <> · {search.notes}</>}
                                    </div>
                                    <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                                        {(search.platforms || []).map(p => (
                                            <span key={p} style={{ padding: '2px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '600', background: `${PLATFORM_COLORS[p] || '#888'}20`, color: PLATFORM_COLORS[p] || colors.text }}>{p}</span>
                                        ))}
                                        {(search.cities || []).slice(0, 4).map(c => (
                                            <span key={c} style={{ padding: '2px 8px', borderRadius: '6px', fontSize: '11px', background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)', color: colors.textSecondary }}>{c}</span>
                                        ))}
                                        {(search.cities || []).length > 4 && <span style={{ fontSize: '11px', color: colors.textSecondary, padding: '2px 6px' }}>+{(search.cities || []).length - 4} {(lang === 'ru' ? "города" : (lang === 'en' ? "cities" : "orașe"))}</span>}
                                    </div>
                                </div>
                                {/* Actions */}
                                <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                                    <button className="mkt-btn" onClick={() => handleSelectSearch(search)}
                                        style={{ padding: '7px 12px', borderRadius: '8px', border: 'none', cursor: 'pointer', background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)', color: colors.text, fontSize: '12px', fontWeight: '600' }}>
                                        📊
                                    </button>
                                    <button className="mkt-btn" title="Editează" onClick={() => { setEditingSearch(search); setForm({ brand_id: search.brand_id || '', search_term: search.search_term || '', platforms: search.platforms || ['glovo','wolt','bolt'], cities: search.cities || ['Bucharest'], notes: search.notes || '', auto_cities: search.auto_cities !== false, glovo_category: search.glovo_category || '', wolt_category: search.wolt_category || '' }); setShowForm(true) }}
                                        style={{ padding: '7px 12px', borderRadius: '8px', border: 'none', cursor: 'pointer', background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)', color: colors.text, fontSize: '13px' }}>
                                        ✏️
                                    </button>
                                    <button className="mkt-btn" title="Șterge" onClick={() => handleDeleteSearch(search.id)}
                                        style={{ padding: '7px 12px', borderRadius: '8px', border: 'none', cursor: 'pointer', background: 'rgba(43,190,200,0.12)', color: '#2bbec8', fontSize: '13px' }}>
                                        🗑️
                                    </button>
                                    <button className="mkt-btn" onClick={() => handleRunSearch(search.id, search.search_term)} disabled={isRunning}
                                        style={{ padding: '7px 12px', borderRadius: '8px', border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg, #2bbec8, #17a2b8)', color: 'white', fontSize: '12px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px', opacity: isRunning ? 0.7 : 1 }}>
                                        {isRunning
                                            ? <><svg style={{ animation: 'spin 1s linear infinite' }} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg> Rulează...</>
                                            : <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polygon points="5 3 19 12 5 21 5 3" /></svg> Rulează</>
                                        }
                                    </button>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )
            }

            {/* ─── TAB: RESULTS — GROUPED BY CITY ─── */}
            {
                activeTab === 'results' && (
                    <div style={{ animation: 'fadeUp 0.3s ease' }}>
                        {/* ── Search selector pills ── */}
                        {searches.length > 1 && (
                            <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
                                {searches.map(s => (
                                    <button key={s.id} onClick={() => { setSelectedSearch(s); setResults([]); loadResults(s.id) }}
                                        className="mkt-btn"
                                        style={{
                                            padding: '7px 16px', borderRadius: '20px', border: 'none', cursor: 'pointer',
                                            fontSize: '13px', fontWeight: '600', transition: 'all 0.15s',
                                            background: selectedSearch?.id === s.id
                                                ? 'linear-gradient(135deg, #2bbec8, #17a2b8)'
                                                : (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'),
                                            color: selectedSearch?.id === s.id ? 'white' : colors.textSecondary,
                                            boxShadow: selectedSearch?.id === s.id ? '0 4px 12px rgba(236,72,153,0.25)' : 'none'
                                        }}>
                                        🔍 "{s.search_term}"
                                    </button>
                                ))}
                            </div>
                        )}
                        {searches.length === 0 ? (
                            <div style={{ ...glass, padding: '48px', textAlign: 'center' }}>
                                <p style={{ color: colors.textSecondary, fontSize: '14px' }}>{(lang === 'ru' ? "Сначала добавьте поиск на вкладке Конфигурация" : (lang === 'en' ? "Add a search from Config tab first" : "Adaugă o căutare din tab-ul Configurații mai întâi"))}</p>
                            </div>
                        ) : loading ? (
                            <div style={{ ...glass, padding: '48px', textAlign: 'center' }}>
                                <svg style={{ animation: 'spin 1s linear infinite', color: '#2bbec8' }} width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>
                                <p style={{ color: colors.textSecondary, marginTop: '16px' }}>{(lang === 'ru' ? "Загрузка..." : (lang === 'en' ? "Loading..." : "Se încarcă..."))}</p>
                            </div>
                        ) : (
                            <>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                                    <h2 style={{ margin: 0, fontSize: '17px', fontWeight: '700', color: colors.text }}>
                                        {lang === 'ru' ? 'Конкуренция за "' : lang === 'en' ? 'Competition for "' : 'Concurență pentru "'}{selectedSearch.search_term}"
                                    </h2>
                                    <span style={{ padding: '3px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: '600', background: isDark ? 'rgba(43,190,200,0.15)' : 'rgba(43,190,200,0.08)', color: '#2bbec8' }}>
                                        {totalCompetitors} {(lang === 'ru' ? "конкуренты" : (lang === 'en' ? "competitors" : "concurenți"))} · {sortedCities.length} orașe
                                    </span>
                                    <button className="mkt-btn" onClick={() => handleRunSearch(selectedSearch.id, selectedSearch.search_term)}
                                        style={{ marginLeft: 'auto', padding: '6px 14px', borderRadius: '7px', border: 'none', cursor: 'pointer', background: '#2bbec8', color: 'white', fontSize: '12px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polygon points="5 3 19 12 5 21 5 3" /></svg>
                                        Actualizează
                                    </button>
                                </div>

                                {/* ─ Quick search bar ─ */}
                                <div style={{ position: 'relative', marginBottom: '16px' }}>
                                    <svg style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: colors.textSecondary }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>
                                    <input value={resultsFilter} onChange={e => setResultsFilter(e.target.value)}
                                        placeholder={(lang === 'ru' ? "Быстрый фильтр... (имя конкурента)" : (lang === 'en' ? "Quick filter... (competitor name)" : "Filtrare rapidă… (nume concurent)"))}
                                        style={{ width: '100%', paddingLeft: 36, padding: '8px 12px 8px 36px', borderRadius: '9px', border: `1px solid ${colors.border}`, background: isDark ? 'rgba(255,255,255,0.04)' : '#fff', color: colors.text, fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
                                    {resultsFilter && (
                                        <button onClick={() => setResultsFilter('')} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: colors.textSecondary, fontSize: '16px', lineHeight: 1 }}>×</button>
                                    )}
                                </div>

                                {sortedCities.length === 0 ? (
                                    <div style={{ ...glass, padding: '48px', textAlign: 'center' }}>
                                        <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔍</div>
                                        <p style={{ color: colors.textSecondary }}>{(lang === 'ru' ? "Нет результатов. Сначала выполните поиск." : (lang === 'en' ? "No results. Run the search first." : "Nu există rezultate. Rulează căutarea mai întâi."))}</p>
                                        <button className="mkt-btn" onClick={() => handleRunSearch(selectedSearch.id, selectedSearch.search_term)}
                                            style={{ padding: '12px 24px', borderRadius: '10px', border: 'none', background: 'linear-gradient(135deg, #2bbec8, #17a2b8)', color: 'white', fontSize: '14px', fontWeight: '600', cursor: 'pointer', marginTop: '12px' }}>
                                            ▶ {(lang === 'ru' ? "Запустить сейчас" : (lang === 'en' ? "Run Now" : "Rulează Acum"))}
                                        </button>
                                    </div>
                                ) : (
                                    <div style={{ display: 'grid', gap: '20px' }}>
                                        {sortedCities.map(city => {
                                            const competitorsByName = cityMap[city]
                                            const names = Object.keys(competitorsByName)
                                                .filter(name => !resultsFilter || name.toLowerCase().includes(resultsFilter.toLowerCase()))
                                            return (
                                                <div key={city} style={{ ...glass, overflow: 'hidden' }}>
                                                    {/* City header */}
                                                    <div style={{ padding: '12px 18px', background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)', borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`, display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                        <h3 style={{ margin: 0, fontSize: '14px', fontWeight: '700', color: colors.text }}>{city}</h3>
                                                        <span style={{ padding: '2px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '600', background: isDark ? 'rgba(43,190,200,0.15)' : 'rgba(43,190,200,0.08)', color: '#2bbec8' }}>
                                                            {names.length} concurenți
                                                        </span>
                                                        <div style={{ marginLeft: 'auto', display: 'flex', gap: '6px' }}>
                                                            {[...new Set(allCompetitors.filter(c => c.city === city).map(c => c.platform))].map(p => (
                                                                <span key={p} style={{ padding: '2px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '600', background: `${PLATFORM_COLORS[p]}1A`, color: PLATFORM_COLORS[p] }}>{p}</span>
                                                            ))}
                                                        </div>
                                                    </div>
                                                    {/* Competitors list */}
                                                    <div>
                                                        {names.map((name, idx) => {
                                                            const appearances = competitorsByName[name]
                                                            const latest = appearances[0]
                                                            const hasProducts = appearances.some(a => a.products?.length > 0)
                                                            const logoUrl = appearances.find(a => a.logo_url)?.logo_url || null
                                                            return (
                                                                <div key={name} className="comp-row"
                                                                    onClick={() => {
                                                                        setDetailCompetitor({ name, city, url: appearances[0]?.url, platform: appearances[0]?.platform })
                                                                        setBrandStats(null)
                                                                        loadBrandStats(name, city)
                                                                    }}
                                                                    style={{
                                                                        padding: '12px 18px',
                                                                        borderBottom: idx < names.length - 1 ? `1px solid ${isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}` : 'none',
                                                                        display: 'flex', alignItems: 'center', gap: '12px'
                                                                    }}>
                                                                    {/* Rank */}
                                                                    <div style={{ width: 26, height: 26, borderRadius: '7px', background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: '700', color: '#2bbec8', flexShrink: 0 }}>
                                                                        {latest.rank_position || idx + 1}
                                                                    </div>
                                                                    {/* Logo */}
                                                                    <div style={{ width: 30, height: 30, borderRadius: '8px', overflow: 'hidden', flexShrink: 0, background: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: '700', color: colors.textSecondary }}>
                                                                        {logoUrl
                                                                            ? <img src={logoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { e.currentTarget.style.display = 'none' }} />
                                                                            : name.charAt(0).toUpperCase()}
                                                                    </div>
                                                                    {/* Name */}
                                                                    <div style={{ flex: 1, minWidth: 0 }}>
                                                                        <div style={{ fontSize: '13px', fontWeight: '600', color: colors.text, marginBottom: '2px', display: 'flex', alignItems: 'center', gap: '7px' }}>
                                                                            {name}
                                                                            {hasProducts && <span style={{ fontSize: '10px', padding: '1px 5px', borderRadius: '4px', background: isDark ? 'rgba(43,190,200,0.15)' : 'rgba(43,190,200,0.08)', color: '#2bbec8', fontWeight: '700' }}>{(lang === 'ru' ? "меню" : (lang === 'en' ? "menu" : "meniu"))}</span>}
                                                                        </div>
                                                                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                                                                            {[...new Set(appearances.map(a => a.platform))].map(p => (
                                                                                <span key={p} style={{ fontSize: '11px', color: PLATFORM_COLORS[p] }}>{p}</span>
                                                                            ))}
                                                                        </div>
                                                                    </div>
                                                                    {/* Rating */}
                                                                    {latest.rating && (
                                                                        <span style={{ fontSize: '13px', fontWeight: '600', color: colors.textSecondary }}>{latest.rating}/10</span>
                                                                    )}
                                                                    <span style={{ fontSize: '12px', color: '#2bbec8', fontWeight: '600' }}>{(lang === 'ru' ? 'Подробнее →' : (lang === 'ro' ? 'Detalii →' : 'Details →'))}</span>
                                                                </div>
                                                            )
                                                        })}
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                )
            }

            {/* ─── TAB: ISTORIC ─── */}
            {
                activeTab === 'prices' && (
                    <div style={{ animation: 'fadeUp 0.3s ease' }}>

                        {/* ── View toggle — full width, colored active ── */}
                        <div style={{ display: 'flex', gap: '4px', marginBottom: '16px', background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)', borderRadius: '10px', padding: '4px', width: '100%' }}>
                            {[{ key: 'brand', label: t('view_by_brand') }, { key: 'date', label: t('view_chronological') }, { key: 'city', label: t('view_by_city') }, { key: 'product', label: t('view_by_product') }].map(v => (
                                <button key={v.key} onClick={() => {
                                    setHistoryView(v.key)
                                    if (v.key === 'product' && priceHistory.length === 0) loadPriceHistory('')
                                }}
                                    style={{ flex: 1, padding: '7px 14px', borderRadius: '7px', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: '600', background: historyView === v.key ? '#2bbec8' : 'transparent', color: historyView === v.key ? '#fff' : colors.textSecondary, boxShadow: historyView === v.key ? '0 2px 8px rgba(43,190,200,0.35)' : 'none', transition: 'all 0.15s' }}>
                                    {v.label}
                                </button>
                            ))}
                        </div>

                        {/* ── Product search view — shown inline when tab = product ── */}
                        {historyView === 'product' && (
                            <div style={{ animation: 'fadeUp 0.2s ease' }}>
                                {/* Common product keywords extracted from results */}
                                {priceHistory.length > 0 && (() => {
                                    const wordCounts = {}
                                    const STOP = new Set(['cu', 'de', 'si', 'la', 'pe', 'in', 'cu', 'set', 'mix', 'the', 'and', 'of', 'with', 'for', '&', '-', 'x', 'xl', 'l', 'g', 'gr', 'ml'])
                                    priceHistory.forEach(ph => {
                                        const words = (ph.product_name || '').toLowerCase().split(/[\s\-\/,]+/)
                                        words.forEach(w => {
                                            const clean = w.replace(/[^a-zăâîșț]/gi, '').trim()
                                            if (clean.length >= 3 && !STOP.has(clean)) {
                                                wordCounts[clean] = (wordCounts[clean] || 0) + 1
                                            }
                                        })
                                    })
                                    const topWords = Object.entries(wordCounts).sort((a, b) => b[1] - a[1]).slice(0, 14).map(([w]) => w)
                                    if (topWords.length === 0) return null
                                    return (
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '10px' }}>
                                            <span style={{ fontSize: '11px', color: colors.textSecondary, alignSelf: 'center', marginRight: '4px' }}>Top cuvinte:</span>
                                            {topWords.map(w => (
                                                <button key={w} onClick={() => { setPriceFilter(w); loadPriceHistory(w) }}
                                                    style={{ padding: '4px 10px', borderRadius: '20px', border: `1px solid ${colors.border}`, cursor: 'pointer', fontSize: '12px', fontWeight: '500', background: priceFilter === w ? '#2bbec8' : (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'), color: priceFilter === w ? '#fff' : colors.textSecondary, transition: 'all 0.12s' }}>
                                                    {w}
                                                </button>
                                            ))}
                                        </div>
                                    )
                                })()}
                                <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
                                    <input placeholder="ex: Philadelphia Roll, Tempura Set..." value={priceFilter} onChange={e => setPriceFilter(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && loadPriceHistory(priceFilter)}
                                        style={{ flex: 1, padding: '9px 14px', borderRadius: '9px', border: `1px solid ${colors.border}`, background: isDark ? 'rgba(255,255,255,0.05)' : '#fff', color: colors.text, fontSize: '13px', outline: 'none' }} />
                                    <button onClick={() => loadPriceHistory(priceFilter)}
                                        style={{ padding: '9px 20px', borderRadius: '9px', border: 'none', cursor: 'pointer', background: '#2bbec8', color: 'white', fontSize: '13px', fontWeight: '600' }}>
                                        Caută
                                    </button>
                                </div>
                                {priceHistory.length > 0 && (
                                    <div style={{ border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`, borderRadius: '12px', overflow: 'hidden' }}>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 200px 120px 100px', padding: '8px 16px', background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)', borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)'}` }}>
                                            {['Restaurant · Produs', 'Locație · Platformă', 'Data', 'Preț'].map(h => (
                                                <span key={h} style={{ fontSize: '10px', fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: '0.4px' }}>{h}</span>
                                            ))}
                                        </div>
                                        {(() => {
                                            // Group by restaurant+product for clean display
                                            const groups = {}
                                            priceHistory.forEach(ph => {
                                                const key = `${ph.restaurant_name}||${ph.product_name}`
                                                if (!groups[key]) groups[key] = []
                                                groups[key].push(ph)
                                            })
                                            const entries = Object.entries(groups)
                                            return entries.map(([key, rows], gi) => {
                                                const first = rows[0]
                                                const isExpanded = expandedProduct === key
                                                const sortedRows = [...rows].sort((a, b) => b.date?.localeCompare(a.date || '') || 0)
                                                return (
                                                    <div key={key}>
                                                        {/* Clickable summary row */}
                                                        <div onClick={() => setExpandedProduct(isExpanded ? null : key)}
                                                            style={{ display: 'grid', gridTemplateColumns: '1fr 200px 120px 100px', padding: '10px 16px', alignItems: 'center', borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}`, cursor: 'pointer', transition: 'background 0.12s', background: isExpanded ? (isDark ? 'rgba(43,190,200,0.08)' : 'rgba(43,190,200,0.04)') : 'transparent' }}
                                                            onMouseEnter={e => !isExpanded && (e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)')}
                                                            onMouseLeave={e => !isExpanded && (e.currentTarget.style.background = 'transparent')}>
                                                            <div>
                                                                <div style={{ fontSize: '13px', fontWeight: '600', color: colors.text }}>{first.restaurant_name}</div>
                                                                <div style={{ fontSize: '11px', color: colors.textSecondary, marginTop: '1px' }}>{first.product_name}</div>
                                                            </div>
                                                            <span style={{ fontSize: '12px', color: colors.textSecondary }}>{first.city} · {first.platform}</span>
                                                            <span style={{ fontSize: '12px', color: colors.textSecondary }}>{rows.length} înreg.</span>
                                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                                <span style={{ fontSize: '14px', fontWeight: '700', color: '#2bbec8' }}>{first.price} <span style={{ fontSize: '10px', fontWeight: '400', color: colors.textSecondary }}>RON</span></span>
                                                                <span style={{ fontSize: '11px', color: '#2bbec8' }}>{isExpanded ? '▲' : '▼'}</span>
                                                            </div>
                                                        </div>
                                                        {/* Expanded price history */}
                                                        {isExpanded && (
                                                            <div style={{ background: isDark ? 'rgba(43,190,200,0.06)' : 'rgba(43,190,200,0.03)', borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}` }}>
                                                                <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', padding: '6px 16px 6px 32px', borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}`, background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)' }}>
                                                                    <span style={{ fontSize: '10px', fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: '0.4px' }}>Data</span>
                                                                    <span style={{ fontSize: '10px', fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: '0.4px' }}>Preț</span>
                                                                </div>
                                                                {sortedRows.map((row, ri) => (
                                                                    <div key={ri} style={{ display: 'grid', gridTemplateColumns: '140px 1fr', padding: '7px 16px 7px 32px', borderBottom: ri < sortedRows.length - 1 ? `1px solid ${isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)'}` : 'none', alignItems: 'center' }}>
                                                                        <span style={{ fontSize: '12px', color: colors.textSecondary }}>{row.date}</span>
                                                                        <span style={{ fontSize: '13px', fontWeight: '700', color: '#2bbec8' }}>{row.price} <span style={{ fontSize: '10px', fontWeight: '400', color: colors.textSecondary }}>RON</span></span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                )
                                            })
                                        })()}
                                    </div>
                                )}
                                {priceHistory.length === 0 && (
                                    <div style={{ padding: '48px', textAlign: 'center', color: colors.textSecondary, fontSize: '13px' }}>
                                        Scrie numele unui produs și apasă Caută
                                    </div>
                                )}
                            </div>
                        )}


                        {/* ── History results ── */}
                        {historyLoading ? (
                            <div style={{ padding: '48px', textAlign: 'center', color: colors.textSecondary }}>
                                <svg style={{ animation: 'spin 1s linear infinite' }} width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>
                                <p style={{ marginTop: '12px', fontSize: '14px' }}>Se încarcă istoricul...</p>
                            </div>
                        ) : historyData.length === 0 ? (
                            <div style={{ padding: '56px 32px', textAlign: 'center' }}>
                                <svg style={{ animation: 'spin 1s linear infinite', opacity: 0.4 }} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>
                                <div style={{ marginTop: '10px', fontSize: '13px', color: colors.textSecondary }}>Se caută date...</div>
                            </div>
                        ) : historyView === 'brand' ? (() => {
                            const allRows = historyData.flatMap(snap =>
                                (snap.competitor_restaurants || []).map(r => ({
                                    ...r, platform: snap.platform, city: snap.city,
                                    date: snap.snapshot_date,
                                    searchLabel: snap.competitive_searches?.brands?.name || snap.competitive_searches?.search_term || '—',
                                    searchLogoUrl: snap.competitive_searches?.brands?.logo_url || null,
                                    searchTerm: snap.competitive_searches?.search_term || '—',
                                }))
                            )
                            const byBrand = {}
                            allRows.forEach(r => {
                                const key = r.name
                                if (!byBrand[key]) byBrand[key] = []
                                byBrand[key].push(r)
                            })
                            const brandList = Object.entries(byBrand)
                                .map(([name, rows]) => {
                                    const ratings = rows.filter(r => r.rating).map(r => r.rating)
                                    const ranks = rows.filter(r => r.rank_position).map(r => r.rank_position)
                                    const cities = [...new Set(rows.map(r => r.city))]
                                    const platforms = [...new Set(rows.map(r => r.platform))]
                                    const products = rows.flatMap(r => r.competitor_products || [])
                                    // Collect all search logos+names this competitor appeared in
                                    const searchEntries = rows.reduce((acc, r) => {
                                        if (r.searchLabel && !acc.find(e => e.label === r.searchLabel)) {
                                            acc.push({ label: r.searchLabel, logo: r.searchLogoUrl })
                                        }
                                        return acc
                                    }, [])
                                    return {
                                        name, rows, cities, platforms,
                                        avgRating: ratings.length ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1) : null,
                                        bestRank: ranks.length ? Math.min(...ranks) : null,
                                        productCount: [...new Set(products.map(p => p.product_name))].length,
                                        appearances: rows.length,
                                        latestUrl: rows[0]?.url,
                                        logo_url: rows.find(r => r.logo_url)?.logo_url || null,
                                        searchLabels: [...new Set(rows.map(r => r.searchLabel).filter(Boolean))],
                                        searchTerms: [...new Set(rows.map(r => r.searchTerm).filter(Boolean))],
                                        searchEntries, // [{ label, logo }]
                                    }
                                })
                                .sort((a, b) => (a.bestRank || 999) - (b.bestRank || 999))
                                .filter(b => {
                                    const textOk = !brandFilter || b.name.toLowerCase().includes(brandFilter.toLowerCase())
                                    const cityOk = !cityDrilldown || b.cities.includes(cityDrilldown)
                                    // pill filter: competitor must have appeared in ALL selected brands
                                    const brandOk = selectedBrands.size === 0 || [...selectedBrands].some(sel =>
                                        b.searchLabels.some(lbl => lbl.toLowerCase().includes(sel.toLowerCase()))
                                    )
                                    return textOk && cityOk && brandOk
                                })

                            // Alphabet + pagination state (derived inline to avoid extra useState)
                            const brandAlpha = searchParams.get('alpha') || ''
                            const setBrandAlpha = (a) => setSearchParams(p => { const n = new URLSearchParams(p); if (a) n.set('alpha', a); else n.delete('alpha'); n.delete('bpage'); return n })
                            const brandPageSize = parseInt(searchParams.get('bsize') || '25')
                            const setBrandPageSize = (s) => setSearchParams(p => { const n = new URLSearchParams(p); n.set('bsize', String(s)); n.delete('bpage'); return n })
                            const brandPage = parseInt(searchParams.get('bpage') || '1')
                            const setBrandPage = (pg) => setSearchParams(p => { const n = new URLSearchParams(p); n.set('bpage', String(pg)); return n })

                            // Sort alphabetically
                            brandList.sort((a, b) => a.name.localeCompare(b.name, 'ro', { sensitivity: 'base' }))
                            // Apply alphabet filter
                            const filteredByAlpha = brandAlpha
                                ? brandList.filter(b => b.name.toUpperCase().startsWith(brandAlpha))
                                : brandList

                            // Pagination
                            const totalItems = filteredByAlpha.length
                            const isAll = brandPageSize === 0
                            const pageCount = isAll ? 1 : Math.max(1, Math.ceil(totalItems / brandPageSize))
                            const safePageNum = Math.min(brandPage, pageCount)
                            const pagedList = isAll ? filteredByAlpha : filteredByAlpha.slice((safePageNum - 1) * brandPageSize, safePageNum * brandPageSize)
                            const startIdx = isAll ? 0 : (safePageNum - 1) * brandPageSize

                            // Build alphabet from available brands
                            const availableLetters = new Set(brandList.map(b => b.name.charAt(0).toUpperCase()).filter(Boolean))
                            const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')

                            return (
                                <div style={{ background: isDark ? 'rgba(255,255,255,0.03)' : '#ffffff', border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`, borderRadius: '12px', overflow: 'hidden' }}>
                                    {/* Breadcrumb when drilling from city */}
                                    {cityDrilldown && (
                                        <div style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '8px', borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`, background: isDark ? 'rgba(43,190,200,0.08)' : 'rgba(43,190,200,0.04)' }}>
                                            <button onClick={clearCityDrill} style={{ display: 'flex', alignItems: 'center', gap: '5px', background: 'none', border: 'none', cursor: 'pointer', color: '#2bbec8', fontSize: '12px', fontWeight: '600', padding: 0 }}>
                                                <svg width='13' height='13' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2.5'><polyline points='15 18 9 12 15 6' /></svg>
                                                {lang==='en'?'Back to Cities':'Înapoi la Orașe'}
                                            </button>
                                            <span style={{ fontSize: '11px', color: colors.textSecondary }}>/</span>
                                            <span style={{ fontSize: '12px', fontWeight: '700', color: colors.text }}>📍 {cityDrilldown}</span>
                                            <span style={{ fontSize: '11px', color: colors.textSecondary, marginLeft: 'auto' }}>{brandList.length} branduri</span>
                                        </div>
                                    )}
                                    {/* Brand pills + inline search — single compact row */}
                                    {(() => {
                                        const uniqueBrands = searches.length > 0 ? Object.values(
                                            searches.reduce((acc, s) => {
                                                const key = s.brands?.name || s.brand_id
                                                if (key && !acc[key]) acc[key] = { name: s.brands?.name || key, logo: s.brands?.logo_url || null }
                                                return acc
                                            }, {})
                                        ) : []
                                        const showPills = uniqueBrands.length >= 2
                                        const toggleBrand = (name) => setSelectedBrands(prev => {
                                            const next = new Set(prev)
                                            if (next.has(name)) next.delete(name)
                                            else next.add(name)
                                            return next
                                        })
                                        return (
                                            <div style={{ display: 'flex', gap: '5px', padding: '6px 12px', borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}`, flexWrap: 'wrap', alignItems: 'center' }}>
                                                {showPills && <>
                                                    <span style={{ fontSize: '10px', fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: '0.4px', flexShrink: 0 }}>Brand:</span>
                                                    <button onClick={() => setSelectedBrands(new Set())}
                                                        style={{ padding: '3px 8px', borderRadius: '20px', border: `1.5px solid ${selectedBrands.size === 0 ? '#2bbec8' : 'transparent'}`, background: selectedBrands.size === 0 ? 'rgba(43,190,200,0.12)' : (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)'), color: selectedBrands.size === 0 ? '#2bbec8' : colors.textSecondary, fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}>
                                                        Toate
                                                    </button>
                                                    {uniqueBrands.map(b => {
                                                        const active = selectedBrands.has(b.name)
                                                        return (
                                                            <button key={b.name} onClick={() => toggleBrand(b.name)}
                                                                style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '2px 8px 2px 3px', borderRadius: '20px', border: `1.5px solid ${active ? '#2bbec8' : 'transparent'}`, background: active ? 'rgba(43,190,200,0.12)' : (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)'), color: active ? '#2bbec8' : colors.text, fontSize: '11px', fontWeight: '700', cursor: 'pointer', transition: 'all 0.15s' }}>
                                                                <div style={{ width: 20, height: 20, borderRadius: '50%', overflow: 'hidden', background: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '8px', fontWeight: '800', color: colors.textSecondary, flexShrink: 0 }}>
                                                                    {b.logo ? <img src={b.logo} alt={b.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => e.currentTarget.style.display = 'none'} /> : b.name.charAt(0)}
                                                                </div>
                                                                {b.name}{active && <span style={{ fontSize: '9px' }}>✓</span>}
                                                            </button>
                                                        )
                                                    })}
                                                    <div style={{ width: '1px', height: 18, background: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)', flexShrink: 0 }} />
                                                </>
                                                }
                                                {/* Inline compact search */}
                                                <div style={{ position: 'relative', width: 160, flexShrink: 0 }}>
                                                    <svg style={{ position: 'absolute', left: 7, top: '50%', transform: 'translateY(-50%)', color: colors.textSecondary, pointerEvents: 'none' }} width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>
                                                    <input value={brandFilter} onChange={e => setBrandFilter(e.target.value)}
                                                        placeholder="Caută concurent…"
                                                        style={{ width: '100%', paddingLeft: 23, padding: '4px 22px 4px 23px', borderRadius: '7px', border: `1px solid ${colors.border}`, background: isDark ? 'rgba(255,255,255,0.05)' : '#f5f5f7', color: colors.text, fontSize: '11px', outline: 'none', boxSizing: 'border-box' }} />
                                                    {brandFilter && <button onClick={() => setBrandFilter('')} style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: colors.textSecondary, fontSize: '13px', padding: 0 }}>×</button>}
                                                </div>
                                                {/* Page size + count — right side */}
                                                <div style={{ marginLeft: 'auto', display: 'flex', gap: '3px', alignItems: 'center' }}>
                                                    {[15, 25, 50, 100, 0].map(sz => (
                                                        <button key={sz} onClick={() => setBrandPageSize(sz)}
                                                            style={{ padding: '3px 6px', borderRadius: '5px', border: `1px solid ${brandPageSize === sz ? '#2bbec8' : colors.border}`, background: brandPageSize === sz ? '#2bbec8' : 'transparent', color: brandPageSize === sz ? 'white' : colors.textSecondary, fontSize: '10px', fontWeight: '600', cursor: 'pointer' }}>
                                                            {sz === 0 ? 'Tot' : sz}
                                                        </button>
                                                    ))}
                                                    <span style={{ fontSize: '10px', color: colors.textSecondary, marginLeft: '4px' }}>{totalItems}</span>
                                                </div>
                                            </div>
                                        )
                                    })()}
                                    {/* Alphabet filter — compact */}
                                    <div style={{ display: 'flex', flexWrap: 'nowrap', gap: '0px', padding: '3px 12px', borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}`, background: isDark ? 'rgba(0,0,0,0.08)' : 'rgba(0,0,0,0.01)', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <button onClick={() => setBrandAlpha('')}
                                            style={{ flex: 1, textAlign: 'center', padding: '4px 2px', borderRadius: '5px', border: `1px solid ${!brandAlpha ? '#2bbec8' : 'transparent'}`, background: !brandAlpha ? 'rgba(43,190,200,0.15)' : 'transparent', color: !brandAlpha ? '#2bbec8' : colors.textSecondary, fontSize: '11px', fontWeight: '700', cursor: 'pointer', minWidth: 0 }}>
                                            {t('all')}
                                        </button>
                                        {ALPHABET.map(letter => (
                                            <button key={letter} onClick={() => setBrandAlpha(brandAlpha === letter ? '' : letter)}
                                                disabled={!availableLetters.has(letter)}
                                                style={{ flex: 1, textAlign: 'center', padding: '4px 2px', borderRadius: '5px', border: `1px solid ${brandAlpha === letter ? '#2bbec8' : 'transparent'}`, background: brandAlpha === letter ? 'rgba(43,190,200,0.15)' : 'transparent', color: brandAlpha === letter ? '#2bbec8' : availableLetters.has(letter) ? colors.text : (isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)'), fontSize: '11px', fontWeight: '600', cursor: availableLetters.has(letter) ? 'pointer' : 'default', minWidth: 0 }}>
                                                {letter}
                                            </button>
                                        ))}
                                    </div>
                                    {/* Table header */}
                                    <div style={{ display: 'grid', gridTemplateColumns: '40px 48px 1fr 110px 60px 120px 60px 70px 60px 100px', gap: '8px', padding: '9px 18px', background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)', borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}` }}>
                                        {['#', 'Brand / Restaurant', 'Cuvânt căutat', '', 'Locații', 'Apariții', <span title="Cea mai ridicată (bună) poziție pe care a ocupat-o acest concurent în lista aplicațiilor de livrare, pentru căutările noastre.">Best rank ℹ</span>, t('rating'), t('products')].map((h, hi) => (
                                            <span key={hi} style={{ fontSize: '10px', fontWeight: '600', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: '0.4px', textAlign: hi === 3 ? 'center' : 'left' }}>{h}</span>
                                        ))}
                                    </div>
                                    {/* Brand rows */}
                                    {pagedList.map((b, i) => (
                                        <div key={b.name}
                                            onClick={() => { setDetailCompetitor({ name: b.name, city: b.cities[0], url: b.latestUrl, platform: b.platforms[0] }); setBrandStats(null); loadBrandStats(b.name) }}
                                            style={{ display: 'grid', gridTemplateColumns: '40px 48px 1fr 110px 60px 120px 60px 70px 60px 100px', gap: '8px', padding: '10px 18px', alignItems: 'center', borderBottom: i < pagedList.length - 1 ? `1px solid ${isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}` : 'none', cursor: 'pointer', transition: 'background 0.12s' }}
                                            onMouseEnter={e => e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)'}
                                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                            {/* Row number */}
                                            <span style={{ fontSize: '11px', color: colors.textSecondary, fontVariantNumeric: 'tabular-nums', textAlign: 'right' }}>{startIdx + i + 1}</span>
                                            {/* Competitor logo */}
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                <div style={{ width: 40, height: 40, borderRadius: '10px', overflow: 'hidden', flexShrink: 0, background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', fontWeight: '700', color: colors.textSecondary }}>
                                                    {b.logo_url
                                                        ? <img src={b.logo_url} alt={b.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { e.currentTarget.style.display = 'none' }} />
                                                        : b.name.charAt(0).toUpperCase()}
                                                </div>
                                            </div>
                                            {/* Brand name + platforms */}
                                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', minWidth: 0 }}>
                                                <div style={{ minWidth: 0 }}>
                                                    <div style={{ fontSize: '13px', fontWeight: '600', color: colors.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                        {b.name}
                                                    </div>
                                                    <div style={{ fontSize: '10px', color: colors.textSecondary, marginTop: '2px' }}>{b.platforms.join(', ')}</div>
                                                </div>
                                            </div>
                                            {/* Cuvânt căutat */}
                                            <div style={{ fontSize: '11px', color: colors.textSecondary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: '500' }} title={(b.searchTerms || []).join(', ')}>
                                                {(b.searchTerms || []).map(l => l.charAt(0).toUpperCase() + l.slice(1)).join(', ')}
                                            </div>
                                            {/* ★ Căutat pentru — logo-ul brandului Sushi Master (mare, separat) */}
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', flexWrap: 'wrap' }}>
                                                {(b.searchEntries || []).map((entry, ei) => (
                                                    entry.logo
                                                        ? <img key={ei} src={entry.logo} alt={entry.label} title={entry.label}
                                                            style={{ width: 34, height: 34, borderRadius: '50%', objectFit: 'cover', border: `2px solid ${isDark ? 'rgba(43,190,200,0.5)' : 'rgba(43,190,200,0.3)'}`, flexShrink: 0, boxShadow: '0 1px 4px rgba(0,0,0,0.15)' }}
                                                            onError={e => { e.currentTarget.style.display = 'none' }} />
                                                        : <span key={ei} title={entry.label}
                                                            style={{ width: 34, height: 34, borderRadius: '50%', background: 'rgba(43,190,200,0.15)', border: `2px solid rgba(43,190,200,0.35)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: '800', color: '#2bbec8', flexShrink: 0 }}>
                                                            {entry.label.slice(0, 2).toUpperCase()}
                                                        </span>
                                                ))}
                                            </div>
                                            <span style={{ fontSize: '11px', color: colors.textSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={b.cities.join(', ')}>{b.cities.join(', ')}</span>
                                            <span style={{ fontSize: '12px', color: colors.textSecondary }}>{b.appearances}×</span>
                                            <span style={{ fontSize: '13px', fontWeight: '700', color: b.bestRank && b.bestRank <= 3 ? '#2bbec8' : colors.text }}>{b.bestRank ? `#${b.bestRank}` : '—'}</span>
                                            <span style={{ fontSize: '12px', color: colors.textSecondary }}>{b.avgRating ? `${b.avgRating}/10` : '—'}</span>
                                            <div style={{ display: 'flex', alignItems: 'center' }}>
                                                {b.productCount > 0 ? (
                                                    <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#2bbec8' }}>{b.productCount}</span>
                                                ) : (
                                                    <button onClick={async (e) => {
                                                        e.stopPropagation()
                                                        if (!b.latestUrl) return alert("Nu există un link pentru extragerea produselor. Încearcă actualizarea rezultatelor din pagina de oraș.")
                                                        if (fetchingProducts) return
                                                        setFetchingProducts(true)
                                                        try {
                                                            const res = await fetch(`${import.meta.env.VITE_WORKER_URL || 'http://localhost:3001'}/api/competitive/scrape-restaurant`, {
                                                                method: 'POST', headers: { 'Content-Type': 'application/json' },
                                                                body: JSON.stringify({ url: b.latestUrl, name: b.name, restaurantId: null })
                                                            })
                                                            const d = await res.json()
                                                            if (d.success && d.count > 0) {
                                                                loadHistory(dateFrom, dateTo, historyCity, historyPlatform) // Reload table data to show new product count
                                                            } else {
                                                                alert(`Nu s-au găsit produse noi la ${b.name}.`)
                                                            }
                                                        } catch(err) {
                                                            alert("Eroare la meniu: " + err.message)
                                                        } finally {
                                                            setFetchingProducts(false)
                                                        }
                                                    }}
                                                    disabled={fetchingProducts}
                                                    style={{ padding: '4px 10px', borderRadius: '6px', border: 'none', background: fetchingProducts ? (isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)') : 'rgba(43,190,200,0.15)', color: fetchingProducts ? colors.textSecondary : '#2bbec8', fontSize: '11px', fontWeight: '700', cursor: fetchingProducts ? 'not-allowed' : 'pointer', transition: 'background 0.1s' }}>
                                                        {fetchingProducts ? '⌛' : '⚡ Descarcă'}
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                    {/* Pagination controls */}
                                    {!isAll && pageCount > 1 && (
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', padding: '10px 18px', borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}` }}>
                                            <button onClick={() => setBrandPage(1)} disabled={safePageNum === 1}
                                                style={{ padding: '4px 8px', borderRadius: '6px', border: `1px solid ${colors.border}`, background: 'transparent', color: colors.textSecondary, fontSize: '12px', cursor: safePageNum === 1 ? 'default' : 'pointer', opacity: safePageNum === 1 ? 0.4 : 1 }}>«</button>
                                            <button onClick={() => setBrandPage(Math.max(1, safePageNum - 1))} disabled={safePageNum === 1}
                                                style={{ padding: '4px 8px', borderRadius: '6px', border: `1px solid ${colors.border}`, background: 'transparent', color: colors.textSecondary, fontSize: '12px', cursor: safePageNum === 1 ? 'default' : 'pointer', opacity: safePageNum === 1 ? 0.4 : 1 }}>‹</button>
                                            {Array.from({ length: Math.min(7, pageCount) }, (_, ii) => {
                                                const mid = Math.min(Math.max(safePageNum, 4), pageCount - 3)
                                                const pg = pageCount <= 7 ? ii + 1 : mid - 3 + ii + 1
                                                if (pg < 1 || pg > pageCount) return null
                                                return (
                                                    <button key={pg} onClick={() => setBrandPage(pg)}
                                                        style={{ padding: '4px 9px', borderRadius: '6px', border: `1px solid ${safePageNum === pg ? '#2bbec8' : colors.border}`, background: safePageNum === pg ? '#2bbec8' : 'transparent', color: safePageNum === pg ? 'white' : colors.text, fontSize: '12px', fontWeight: safePageNum === pg ? '700' : '400', cursor: 'pointer' }}>{pg}</button>
                                                )
                                            })}
                                            <button onClick={() => setBrandPage(Math.min(pageCount, safePageNum + 1))} disabled={safePageNum === pageCount}
                                                style={{ padding: '4px 8px', borderRadius: '6px', border: `1px solid ${colors.border}`, background: 'transparent', color: colors.textSecondary, fontSize: '12px', cursor: safePageNum === pageCount ? 'default' : 'pointer', opacity: safePageNum === pageCount ? 0.4 : 1 }}>›</button>
                                            <button onClick={() => setBrandPage(pageCount)} disabled={safePageNum === pageCount}
                                                style={{ padding: '4px 8px', borderRadius: '6px', border: `1px solid ${colors.border}`, background: 'transparent', color: colors.textSecondary, fontSize: '12px', cursor: safePageNum === pageCount ? 'default' : 'pointer', opacity: safePageNum === pageCount ? 0.4 : 1 }}>»</button>
                                            <span style={{ fontSize: '11px', color: colors.textSecondary, marginLeft: '8px' }}>Pagina {safePageNum} / {pageCount}</span>
                                        </div>
                                    )}
                                </div>
                            )
                        })() : historyView === 'city' ? (() => {
                            // ── City-grouped view ──
                            const allRows = historyData.flatMap(snap =>
                                (snap.competitor_restaurants || []).map(r => ({
                                    ...r, platform: snap.platform, city: snap.city,
                                    date: snap.snapshot_date,
                                    searchLabel: snap.competitive_searches?.brands?.name || snap.competitive_searches?.search_term || '—'
                                }))
                            )
                            const byCity = {}
                            allRows.forEach(r => {
                                const key = r.city || '—'
                                if (!byCity[key]) byCity[key] = []
                                byCity[key].push(r)
                            })
                            const cityList = Object.entries(byCity)
                                .map(([city, rows]) => {
                                    const ratings = rows.filter(r => r.rating).map(r => r.rating)
                                    const ranks = rows.filter(r => r.rank_position).map(r => r.rank_position)
                                    const brands = [...new Set(rows.map(r => r.name))]
                                    const platforms = [...new Set(rows.map(r => r.platform))]
                                    const products = rows.flatMap(r => r.competitor_products || [])
                                    return {
                                        city, rows, brands, platforms,
                                        brandCount: brands.length,
                                        avgRating: ratings.length ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1) : null,
                                        bestRank: ranks.length ? Math.min(...ranks) : null,
                                        productCount: [...new Set(products.map(p => p.product_name))].length,
                                        appearances: rows.length,
                                    }
                                })
                                .sort((a, b) => b.brandCount - a.brandCount)
                                .filter(c => (!brandFilter || c.city.toLowerCase().includes(brandFilter.toLowerCase())) && (!searchParams.get('calpha') || c.city.toUpperCase().startsWith(searchParams.get('calpha'))))
                            return (
                                <div style={{ background: isDark ? 'rgba(255,255,255,0.03)' : '#ffffff', border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`, borderRadius: '12px', overflow: 'hidden' }}>
                                    {/* search bar */}
                                    <div style={{ position: 'relative', padding: '10px 14px', borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}` }}>
                                        <svg style={{ position: 'absolute', left: 26, top: '50%', transform: 'translateY(-50%)', color: colors.textSecondary }} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>
                                        <input value={brandFilter} onChange={e => setBrandFilter(e.target.value)}
                                            placeholder={t('filter_city')}
                                            style={{ width: '100%', paddingLeft: 30, padding: '7px 10px 7px 30px', borderRadius: '8px', border: `1px solid ${colors.border}`, background: isDark ? 'rgba(255,255,255,0.05)' : '#f9f9f9', color: colors.text, fontSize: '12px', outline: 'none', boxSizing: 'border-box' }} />
                                        {brandFilter && (
                                            <button onClick={() => setBrandFilter('')} style={{ position: 'absolute', right: 20, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: colors.textSecondary, fontSize: '15px' }}>×</button>
                                        )}
                                    </div>
                                    {/* Alphabet bar — cities */}
                                    {(() => {
                                        const cityAlpha = searchParams.get('calpha') || ''
                                        const setCityAlpha = (a) => setSearchParams(p => { const n = new URLSearchParams(p); if (a) n.set('calpha', a); else n.delete('calpha'); return n })
                                        const LETTERS = ['Toate', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z']
                                        return (
                                            <div style={{ display: 'flex', flexWrap: 'nowrap', gap: '0px', padding: '5px 14px', borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}`, background: isDark ? 'rgba(0,0,0,0.1)' : 'rgba(0,0,0,0.015)', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <button onClick={() => setCityAlpha('')}
                                                    style={{ flex: 1, textAlign: 'center', padding: '4px 2px', borderRadius: '5px', border: `1px solid ${!cityAlpha ? '#2bbec8' : 'transparent'}`, background: !cityAlpha ? 'rgba(43,190,200,0.15)' : 'transparent', color: !cityAlpha ? '#2bbec8' : colors.textSecondary, fontSize: '11px', fontWeight: '700', cursor: 'pointer', minWidth: 0 }}>
                                                    Toate
                                                </button>
                                                {LETTERS.filter(l => l !== 'Toate').map(l => {
                                                    const active = cityAlpha === l
                                                    const available = cityList.some(c => c.city.toUpperCase().startsWith(l))
                                                    return (
                                                        <button key={l} onClick={() => setCityAlpha(active ? '' : l)}
                                                            disabled={!available}
                                                            style={{ flex: 1, textAlign: 'center', padding: '4px 2px', borderRadius: '5px', border: `1px solid ${active ? '#2bbec8' : 'transparent'}`, background: active ? 'rgba(43,190,200,0.15)' : 'transparent', color: active ? '#2bbec8' : available ? colors.text : (isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)'), fontSize: '11px', fontWeight: '600', cursor: available ? 'pointer' : 'default', minWidth: 0 }}>
                                                            {l}
                                                        </button>
                                                    )
                                                })}
                                            </div>
                                        )
                                    })()}
                                    {/* header */}
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px 80px 80px 70px 80px', gap: '8px', padding: '9px 18px', background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)', borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}` }}>
                                        {['Oraș', t('platforms'), t('brands_count'), t('appearances'), t('best_rank'), t('rating')].map(h => (
                                            <span key={h} style={{ fontSize: '10px', fontWeight: '600', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: '0.4px' }}>{h}</span>
                                        ))}
                                    </div>
                                    {cityList.map((c, i) => (
                                        <div key={c.city}
                                            onClick={() => drillToCity(c.city)}
                                            style={{ display: 'grid', gridTemplateColumns: '1fr 100px 80px 80px 70px 70px', gap: '8px', padding: '11px 18px', alignItems: 'center', borderBottom: i < cityList.length - 1 ? `1px solid ${isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}` : 'none', cursor: 'pointer', transition: 'background 0.12s' }}
                                            onMouseEnter={e => e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(43,190,200,0.05)'}
                                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                            {/* City + icon */}
                                            <div style={{ display: 'flex', gap: '9px', alignItems: 'center', minWidth: 0 }}>
                                                <div style={{ width: 32, height: 32, borderRadius: '8px', flexShrink: 0, background: `hsl(${(c.city.charCodeAt(0) * 7) % 360}, 65%, ${isDark ? '25%' : '90%'})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px' }}>📍</div>
                                                <div>
                                                    <div style={{ fontSize: '13px', fontWeight: '700', color: colors.text }}>{c.city}</div>
                                                    <div style={{ fontSize: '10px', color: colors.textSecondary, marginTop: '1px' }}>
                                                        {c.brands.slice(0, 3).join(', ')}{c.brands.length > 3 ? ` +${c.brands.length - 3}` : ''}
                                                    </div>
                                                </div>
                                            </div>
                                            <span style={{ fontSize: '11px', color: colors.textSecondary }}>{c.platforms.join(', ')}</span>
                                            <span style={{ fontSize: '13px', fontWeight: '700', color: colors.text }}>{c.brandCount}</span>
                                            <span style={{ fontSize: '12px', color: colors.textSecondary }}>{c.appearances}×</span>
                                            <span style={{ fontSize: '13px', fontWeight: '700', color: c.bestRank && c.bestRank <= 3 ? '#2bbec8' : colors.text }}>{c.bestRank ? `#${c.bestRank}` : '—'}</span>
                                            <span style={{ fontSize: '12px', color: colors.textSecondary }}>{c.avgRating ? `${c.avgRating}/10` : '—'}</span>
                                        </div>
                                    ))}
                                    {cityList.length === 0 && (
                                        <div style={{ padding: '40px', textAlign: 'center', color: colors.textSecondary, fontSize: '13px' }}>Niciun oraș găsit</div>
                                    )}
                                </div>
                            )
                        })() : (() => {
                            // ── Cronologic view ──
                            const chronAlpha = searchParams.get('chronalpha') || ''
                            const setChronAlpha = (a) => setSearchParams(p => { const n = new URLSearchParams(p); if (a) n.set('chronalpha', a); else n.delete('chronalpha'); return n })
                            const ALPHA_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')
                            // Gather all brand names searched for available letters
                            const allBrandNames = [...new Set(historyData.map(s => (s.competitive_searches?.brands?.name || s.competitive_searches?.search_term || '')).filter(Boolean))]
                            const alphaAvailable = new Set(allBrandNames.map(n => n[0]?.toUpperCase()).filter(Boolean))
                            return (<>
                            {/* Full-width alphabet bar — filter by brand searched */}
                            <div style={{ display: 'flex', flexWrap: 'nowrap', gap: '0px', padding: '5px 14px', marginBottom: '12px', borderRadius: '10px', border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`, background: isDark ? 'rgba(0,0,0,0.1)' : 'rgba(0,0,0,0.015)', justifyContent: 'space-between', alignItems: 'center' }}>
                                <button onClick={() => setChronAlpha('')}
                                    style={{ flex: 1, textAlign: 'center', padding: '4px 2px', borderRadius: '5px', border: `1px solid ${!chronAlpha ? '#2bbec8' : 'transparent'}`, background: !chronAlpha ? 'rgba(43,190,200,0.15)' : 'transparent', color: !chronAlpha ? '#2bbec8' : colors.textSecondary, fontSize: '11px', fontWeight: '700', cursor: 'pointer', minWidth: 0 }}>
                                    Toate
                                </button>
                                {ALPHA_LETTERS.map(l => {
                                    const active = chronAlpha === l
                                    const avail = alphaAvailable.has(l)
                                    return (
                                        <button key={l} onClick={() => setChronAlpha(active ? '' : l)} disabled={!avail}
                                            style={{ flex: 1, textAlign: 'center', padding: '4px 2px', borderRadius: '5px', border: `1px solid ${active ? '#2bbec8' : 'transparent'}`, background: active ? 'rgba(43,190,200,0.15)' : 'transparent', color: active ? '#2bbec8' : avail ? colors.text : (isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)'), fontSize: '11px', fontWeight: '600', cursor: avail ? 'pointer' : 'default', minWidth: 0 }}>
                                            {l}
                                        </button>
                                    )
                                })}
                            </div>
                            <div style={{ display: 'grid', gap: '12px' }}>
                                {Object.entries(
                                    historyData.reduce((acc, snap) => {
                                        const d = snap.snapshot_date
                                        if (!acc[d]) acc[d] = []
                                        acc[d].push(snap)
                                        return acc
                                    }, {})
                                ).sort(([a], [b]) => b.localeCompare(a)).map(([date, snaps]) => {
                                    const filteredSnaps = chronAlpha ? snaps.filter(sn => {
                                        const bn = sn.competitive_searches?.brands?.name || sn.competitive_searches?.search_term || ''
                                        return bn.toUpperCase().startsWith(chronAlpha)
                                    }) : snaps
                                    if (filteredSnaps.length === 0) return null
                                    const allRestaurants = filteredSnaps.flatMap(sn => (sn.competitor_restaurants || []).map(r => ({ ...r, platform: sn.platform, city: sn.city, ourBrandName: sn.competitive_searches?.brands?.name || sn.competitive_searches?.search_term || '', ourBrandLogo: sn.competitive_searches?.brands?.logo_url || null })))
                                    const totalCount = allRestaurants.length
                                    const uniqueCities = [...new Set(snaps.map(sn => sn.city))].length
                                    const platforms = [...new Set(snaps.map(sn => sn.platform))]
                                    const dateLabel = new Date(date).toLocaleDateString('ro-RO', { day: 'numeric', month: 'long', year: 'numeric' })
                                    const PAGE_SIZE = 20
                                    const curPage = dayPages[date] || 0
                                    const totalPages = Math.ceil(allRestaurants.length / PAGE_SIZE)
                                    const displayRows = allRestaurants.slice(curPage * PAGE_SIZE, (curPage + 1) * PAGE_SIZE)
                                    return (
                                        <div key={date} style={{
                                            background: isDark ? 'rgba(255,255,255,0.03)' : '#ffffff',
                                            border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
                                            borderRadius: '12px', overflow: 'hidden',
                                        }}>
                                            {/* ── Day header ── */}
                                            <div style={{
                                                padding: '12px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                                background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
                                                borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)'}`,
                                            }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                    <span style={{ fontSize: '14px', fontWeight: '700', color: colors.text }}>{dateLabel}</span>
                                                    <span style={{ fontSize: '12px', color: colors.textSecondary }}>
                                                        {totalCount} {(lang === 'ru' ? "конкуренты" : (lang === 'en' ? "competitors" : "concurenți"))} · {uniqueCities} {uniqueCities === 1 ? 'locație' : 'locații'} · {platforms.join(', ')}
                                                    </span>
                                                </div>
                                                <span style={{ fontSize: '11px', color: colors.textSecondary }}>
                                                    {snaps.length} {snaps.length === 1 ? 'snapshot' : 'snapshots'}
                                                </span>
                                            </div>

                                            {/* ── Table header row ── */}
                                            <div style={{
                                                display: 'grid', gridTemplateColumns: '1fr 38px 160px 60px 70px 80px',
                                                padding: '7px 18px', gap: '8px',
                                                borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}`,
                                            }}>
                                                {['Restaurant', '🔍', 'Locație · Platformă', 'Rank', t('rating'), ''].map(h => (
                                                    <span key={h} style={{ fontSize: '10px', fontWeight: '600', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: '0.4px' }}>{h}</span>
                                                ))}
                                            </div>

                                            {/* ── Rows ── */}
                                            {displayRows.map((r, ri) => (
                                                <div key={ri}
                                                    onClick={() => { setDetailCompetitor({ name: r.name, city: r.city, url: r.url, platform: r.platform }); setBrandStats(null); loadBrandStats(r.name, r.city) }}
                                                    style={{
                                                        display: 'grid', gridTemplateColumns: '1fr 38px 160px 60px 70px 80px',
                                                        padding: '10px 18px', gap: '8px', alignItems: 'center',
                                                        borderBottom: ri < displayRows.length - 1 ? `1px solid ${isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}` : 'none',
                                                        cursor: 'pointer', transition: 'background 0.12s ease',
                                                    }}
                                                    onMouseEnter={e => e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)'}
                                                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                                    {/* Col 1: Competitor restaurant logo + name */}
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                                                        <div style={{ width: 28, height: 28, borderRadius: '7px', overflow: 'hidden', flexShrink: 0, background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: '700', color: colors.textSecondary }}>
                                                            {r.logo_url ? <img src={r.logo_url} alt={r.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { e.currentTarget.style.display = 'none' }} /> : r.name?.charAt(0).toUpperCase()}
                                                        </div>
                                                        <span style={{ fontSize: '13px', fontWeight: '600', color: colors.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</span>
                                                    </div>
                                                    {/* Col 2: Brand cautat — DOAR iconita logo */}
                                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }} title={r.ourBrandName || ''}>
                                                        {r.ourBrandLogo
                                                            ? <img src={r.ourBrandLogo} alt={r.ourBrandName} style={{ width: 26, height: 26, borderRadius: '7px', objectFit: 'cover' }} onError={e => { e.currentTarget.style.display = 'none' }} />
                                                            : <div style={{ width: 26, height: 26, borderRadius: '7px', background: 'linear-gradient(135deg,#2bbec8,#17a2b8)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: '700', color: '#fff' }} title={r.ourBrandName}>{(r.ourBrandName || '?')[0]}</div>
                                                        }
                                                    </div>
                                                    <span style={{ fontSize: '12px', color: colors.textSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.city} · {r.platform}</span>
                                                    <span style={{ fontSize: '12px', color: r.rank_position <= 3 ? '#2bbec8' : colors.textSecondary, fontWeight: r.rank_position <= 3 ? '700' : '400' }}>{r.rank_position ? `#${r.rank_position}` : '—'}</span>
                                                    <span style={{ fontSize: '12px', color: colors.textSecondary }}>{r.rating ? `${r.rating}/10` : '—'}</span>
                                                    <span style={{ fontSize: '12px', color: '#2bbec8', fontWeight: '600', textAlign: 'right' }}>{(lang === 'ru' ? 'Подробнее →' : (lang === 'ro' ? 'Detalii →' : 'Details →'))}</span>
                                                </div>
                                            ))}

                                            {/* ── Pagination controls ── */}
                                            {totalPages > 1 && (
                                                <div style={{ padding: '10px 18px', borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}`, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <span style={{ fontSize: '11px', color: colors.textSecondary, flex: 1 }}>
                                                        {curPage * PAGE_SIZE + 1}–{Math.min((curPage + 1) * PAGE_SIZE, totalCount)} din {totalCount} concurenți
                                                    </span>
                                                    <button disabled={curPage === 0}
                                                        onClick={() => setDayPages(p => ({ ...p, [date]: curPage - 1 }))}
                                                        style={{ padding: '4px 12px', borderRadius: '7px', border: `1px solid ${colors.border}`, background: 'transparent', color: curPage === 0 ? colors.textSecondary : colors.text, cursor: curPage === 0 ? 'default' : 'pointer', fontSize: '12px', fontWeight: '600', opacity: curPage === 0 ? 0.4 : 1 }}>
                                                        ‹ Prev
                                                    </button>
                                                    <span style={{ fontSize: '12px', color: colors.textSecondary, minWidth: 40, textAlign: 'center' }}>
                                                        {curPage + 1} / {totalPages}
                                                    </span>
                                                    <button disabled={curPage >= totalPages - 1}
                                                        onClick={() => setDayPages(p => ({ ...p, [date]: curPage + 1 }))}
                                                        style={{ padding: '4px 12px', borderRadius: '7px', border: `1px solid ${colors.border}`, background: 'transparent', color: curPage >= totalPages - 1 ? colors.textSecondary : colors.text, cursor: curPage >= totalPages - 1 ? 'default' : 'pointer', fontSize: '12px', fontWeight: '600', opacity: curPage >= totalPages - 1 ? 0.4 : 1 }}>
                                                        Next ›
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                        </>)})()}

                    </div>
                )
            }




            {/* ─── ADD/EDIT SEARCH FORM ─── */}
            {
                showForm && (
                    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
                        onClick={() => setShowForm(false)}>
                        <div style={{ ...glass, padding: '28px', width: '560px', maxHeight: '88vh', overflowY: 'auto', animation: 'fadeUp 0.3s ease' }}
                            onClick={e => e.stopPropagation()}>
                            <h2 style={{ margin: '0 0 22px', fontSize: '17px', fontWeight: '700', color: colors.text }}>
                                {editingSearch ? (lang === 'ru' ? 'Изменить поиск' : 'Editează Căutare') : (lang === 'ru' ? 'Добавить конкурентный поиск' : 'Adaugă Căutare Competitivă')}
                            </h2>

                            {/* Brand */}
                            <div style={{ marginBottom: '14px' }}>
                                <label style={{ fontSize: '11px', fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '6px' }}>Brand asociat</label>
                                <select value={form.brand_id} onChange={e => setForm(f => ({ ...f, brand_id: e.target.value }))}
                                    style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: `1px solid ${colors.border}`, background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)', color: colors.text, fontSize: '14px', cursor: 'pointer' }}>
                                    <option value="">Toți brandurile</option>
                                    {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                                </select>
                            </div>

                            {/* Search term */}
                            <div style={{ marginBottom: '14px' }}>
                                <label style={{ fontSize: '11px', fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '6px' }}>Termen de căutare *</label>
                                <input placeholder="ex: asian, sushi, burger, pizza..."
                                    value={form.search_term} onChange={e => setForm(f => ({ ...f, search_term: e.target.value }))}
                                    style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: `1px solid ${colors.border}`, background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)', color: colors.text, fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
                            </div>

                            {/* Auto cities toggle */}
                            <div style={{ marginBottom: '14px', padding: '12px 14px', borderRadius: '10px', background: isDark ? 'rgba(52,199,89,0.08)' : 'rgba(52,199,89,0.06)', border: '1px solid rgba(52,199,89,0.2)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div>
                                        <div style={{ fontSize: '13px', fontWeight: '600', color: colors.text }}>🎯 Folosește orașele brandului automat</div>
                                        <div style={{ fontSize: '11px', color: colors.textSecondary, marginTop: '2px' }}>Detectează din locațiile restaurantelor</div>
                                    </div>
                                    <button onClick={() => setForm(f => ({ ...f, auto_cities: !f.auto_cities }))}
                                        style={{ width: 44, height: 24, borderRadius: '12px', border: 'none', cursor: 'pointer', background: form.auto_cities ? '#34C759' : (isDark ? 'rgba(255,255,255,0.2)' : '#ddd'), position: 'relative', transition: 'background 0.2s' }}>
                                        <div style={{ width: 18, height: 18, borderRadius: '50%', background: 'white', position: 'absolute', top: 3, left: form.auto_cities ? 23 : 3, transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
                                    </button>
                                </div>
                            </div>

                            {/* Platforms */}
                            <div style={{ marginBottom: '14px' }}>
                                <label style={{ fontSize: '11px', fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '6px' }}>Platforme</label>
                                <div style={{ display: 'flex', gap: '10px' }}>
                                {['glovo', 'wolt', 'bolt'].map(p => (
                                         <button key={p} onClick={() => togglePlatform(p)}
                                             style={{ flex: 1, padding: '10px', borderRadius: '10px', cursor: 'pointer', background: form.platforms.includes(p) ? `${PLATFORM_COLORS[p] || '#888'}25` : (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'), color: form.platforms.includes(p) ? (PLATFORM_COLORS[p] || '#888') : colors.textSecondary, fontWeight: '600', fontSize: '13px', border: form.platforms.includes(p) ? `1.5px solid ${PLATFORM_COLORS[p] || '#888'}60` : '1.5px solid transparent', transition: 'all 0.15s ease' }}>
                                             {form.platforms.includes(p) ? '✓ ' : ''}{p}
                                         </button>
                                     ))}
                                 </div>
                            </div>

                            {/* Cities — only if not auto */}
                            {!form.auto_cities && (
                                <div style={{ marginBottom: '14px' }}>
                                    <label style={{ fontSize: '11px', fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '6px' }}>
                                        Orașe ({form.cities.length} selectate)
                                    </label>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                        {ALL_CITIES.map(c => (
                                            <button key={c} onClick={() => toggleCity(c)}
                                                style={{ padding: '5px 10px', borderRadius: '7px', cursor: 'pointer', fontSize: '12px', fontWeight: '600', background: form.cities.includes(c) ? 'rgba(43,190,200,0.15)' : (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'), color: form.cities.includes(c) ? '#2bbec8' : colors.textSecondary, border: form.cities.includes(c) ? '1.5px solid rgba(43,190,200,0.4)' : '1.5px solid transparent', transition: 'all 0.15s ease' }}>
                                                {c}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Glovo / Wolt category */}
                            <div style={{ marginBottom: '14px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                <div>
                                    <label style={{ fontSize: '11px', fontWeight: '700', color: '#FFC244', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '6px' }}>Glovo categorie</label>
                                    <input placeholder="ex: sushi, burgeri, asiatic..."
                                        value={form.glovo_category} onChange={e => setForm(f => ({ ...f, glovo_category: e.target.value }))}
                                        style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: `1px solid ${colors.border}`, background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)', color: colors.text, fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
                                </div>
                                <div>
                                    <label style={{ fontSize: '11px', fontWeight: '700', color: '#009DE0', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '6px' }}>Wolt tags</label>
                                    <input placeholder="auto (din search_term)"
                                        value={form.wolt_category} onChange={e => setForm(f => ({ ...f, wolt_category: e.target.value }))}
                                        style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: `1px solid ${colors.border}`, background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)', color: colors.text, fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
                                </div>
                            </div>

                            {/* Notes */}
                            <div style={{ marginBottom: '22px' }}>
                                <label style={{ fontSize: '11px', fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '6px' }}>Note (opțional)</label>
                                <input placeholder="ex: Concurență pentru brandul Sushi Master"
                                    value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                                    style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: `1px solid ${colors.border}`, background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)', color: colors.text, fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
                            </div>

                            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                                <button className="mkt-btn" onClick={() => setShowForm(false)}
                                    style={{ padding: '10px 20px', borderRadius: '10px', border: `1px solid ${colors.border}`, background: 'transparent', color: colors.text, fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>
                                    Anulează
                                </button>
                                <button className="mkt-btn" onClick={handleSaveSearch} disabled={!form.search_term.trim()}
                                    style={{ padding: '10px 24px', borderRadius: '10px', border: 'none', cursor: 'pointer', background: '#2bbec8', color: 'white', fontSize: '13px', fontWeight: '600', opacity: form.search_term.trim() ? 1 : 0.5 }}>
                                    {editingSearch ? (lang === 'ru' ? 'Сохранить' : 'Salvează') : (lang === 'ru' ? 'Добавить поиск' : 'Adaugă Căutare')}
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    )
}
