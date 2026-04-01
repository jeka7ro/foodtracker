import React, { useState, useMemo, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useTheme } from '../lib/ThemeContext'
import { useLanguage } from '../lib/LanguageContext'
import { supabase } from '../lib/supabaseClient'
import { LineChart, Line, BarChart, Bar, ComposedChart, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { Download, UploadCloud, Activity, ShoppingBag, CreditCard } from 'lucide-react'
import * as XLSX from 'xlsx'
import './Performance.css'

// ─── TRANSLATIONS DICTIONARY ───
const dict = {
    title: { ro: 'Performanță Vânzări', en: 'Sales Performance', ru: 'Эффективность Продаж' },
    subtitle: { ro: 'Analizează vânzările, comenzile și produsele de top în timp real', en: 'Analyze sales, orders, and top products in real time', ru: 'Анализируйте продажи, заказы и лучшие продукты в реальном времени' },
    importing: { ro: 'Se importă...', en: 'Importing...', ru: 'Импорт...' },
    importExcel: { ro: 'Importă Excel', en: 'Import Excel', ru: 'Импорт Excel' },
    export: { ro: 'Export', en: 'Export', ru: 'Экспорт' },
    allPlatforms: { ro: 'Toate Platformele', en: 'All Platforms', ru: 'Все платформы' },
    ecosystem: { ro: 'Ecosistem (iiko)', en: 'Ecosystem (iiko)', ru: 'Экосистема (iiko)' },
    allBrands: { ro: 'Toate Brandurile', en: 'All Brands', ru: 'Все бренды' },
    allCities: { ro: 'Toate Orașele', en: 'All Cities', ru: 'Все города' },
    allLocations: { ro: 'Toate Locațiile', en: 'All Locations', ru: 'Все локации' },
    today: { ro: 'Azi', en: 'Today', ru: 'Сегодня' },
    yesterday: { ro: 'Ieri', en: 'Yesterday', ru: 'Вчера' },
    thisWeek: { ro: 'Săpt. Curentă', en: 'This Week', ru: 'Текущая неделя' },
    thisMonth: { ro: 'Luna curentă', en: 'This Month', ru: 'Текущий месяц' },
    lastMonth: { ro: 'Luna trecută', en: 'Last Month', ru: 'Прошлый месяц' },
    thisYear: { ro: 'Anul curent', en: 'This Year', ru: 'Этот год' },
    totalRevenue: { ro: 'Venituri Totale', en: 'Total Revenue', ru: 'Общий Доход' },
    totalOrders: { ro: 'Număr Comenzi', en: 'Total Orders', ru: 'Количество Заказов' },
    aov: { ro: 'Coș Mediu (AOV)', en: 'Average Order Value', ru: 'Средний Чек (AOV)' },
    salesStats: { ro: 'Dinamica Vânzărilor', en: 'Sales Dynamics', ru: 'Динамика Продаж' },
    sales: { ro: 'Vânzări', en: 'Sales', ru: 'Продажи' },
    orders: { ro: 'Comenzi', en: 'Orders', ru: 'Заказы' },
    topLocations: { ro: 'Top Locații', en: 'Top Locations', ru: 'Топ Локации' },
    noData: { ro: 'Fără date.', en: 'No data.', ru: 'Нет данных.' },
    heatmap: { ro: 'Intensitatea Vânzărilor pe Ore (Heatmap)', en: 'Sales Heatmap by Hour', ru: 'Интенсивность продаж по часам (Тепловая карта)' },
    total: { ro: 'Total', en: 'Total', ru: 'Итого' },
    productSales: { ro: 'Vânzări după Produse', en: 'Sales by Product', ru: 'Продажи по Продуктам' },
    topProduct: { ro: 'Produs (Top)', en: 'Top Product', ru: 'Продукт (Топ)' },
    salesTotal: { ro: 'Vânzări Totale', en: 'Total Sales', ru: 'Всего Продано' },
    piecesOrdered: { ro: 'bucăți comandate', en: 'pieces ordered', ru: 'штук заказано' },
    noProducts: { ro: 'Niciun produs pentru perioada selectată.', en: 'No products for selected period.', ru: 'Нет продуктов за выбранный период.' },
    showItems: { ro: 'Afișare {n} rânduri pe pagină', en: 'Showing {n} rows per page', ru: 'Показано {n} строк на странице' },
    pageOf: { ro: 'Pagina {p} din {t}', en: 'Page {p} of {t}', ru: 'Страница {p} из {t}' },
    days: {
        ro: ['Duminică', 'Luni', 'Marți', 'Miercuri', 'Joi', 'Vineri', 'Sâmbătă'],
        en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
        ru: ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота']
    },
    daysShort: {
        ro: ['D', 'L', 'M', 'M', 'J', 'V', 'S'],
        en: ['S', 'M', 'T', 'W', 'T', 'F', 'S'],
        ru: ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб']
    },
    months: {
        ro: ['Ianuarie', 'Februarie', 'Martie', 'Aprilie', 'Mai', 'Iunie', 'Iulie', 'August', 'Septembrie', 'Octombrie', 'Noiembrie', 'Decembrie'],
        en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
        ru: ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь']
    },
    monthsShort: {
        ro: ['Ian', 'Feb', 'Mar', 'Apr', 'Mai', 'Iun', 'Iul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
        en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
        ru: ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек']
    }
}

export default function Performance() {
    const { isDark } = useTheme()
    const { lang } = useLanguage()
    const l = lang || 'ro'
    const t = (key) => dict[key]?.[l] || dict[key]?.['ro'] || key
    const navigate = useNavigate()

    const [searchParams, setSearchParams] = useSearchParams()

    const [brands, setBrands] = useState([])
    const [restaurants, setRestaurants] = useState([])

    // Filters
    const platformParam = searchParams.get('platform') || 'all'
    const [platformFilter, setPlatformFilter] = useState(platformParam)
    const [brandFilter, setBrandFilter] = useState('all')
    const [cityFilter, setCityFilter] = useState('all')
    const [restaurantFilter, setRestaurantFilter] = useState('all')
    const [activePeriod, setActivePeriod] = useState('week')
    const [customStartDate, setCustomStartDate] = useState('')
    const [customEndDate, setCustomEndDate] = useState('')
    const [pageNumber, setPageNumber] = useState(1)
    const ITEMS_PER_PAGE = 8

    useEffect(() => {
        Promise.all([
            supabase.from('brands').select('id, name').order('name'),
            supabase.from('restaurants').select('id, name, city, brand_id').eq('is_active', true).order('name')
        ]).then(([{ data: b }, { data: r }]) => {
            setBrands(b || [])
            setRestaurants(r || [])
        })
    }, [])

    useEffect(() => {
        setPlatformFilter(searchParams.get('platform') || 'all')
    }, [searchParams])

    const cities = useMemo(() => {
        return [...new Set(restaurants.map(r => r.city).filter(Boolean))].sort()
    }, [restaurants])

    const activeRestaurants = useMemo(() => {
        let list = restaurants
        if (brandFilter !== 'all') list = list.filter(r => r.brand_id === brandFilter)
        if (cityFilter !== 'all') list = list.filter(r => r.city === cityFilter)
        return list
    }, [brandFilter, cityFilter, restaurants])

    const [realSalesArray, setRealSalesArray] = useState([])
    const [isLoading, setIsLoading] = useState(true)

    const periodDays = useMemo(() => {
        if (activePeriod === 'today' || activePeriod === 'yesterday') return 1
        if (activePeriod === 'week') return 7
        if (activePeriod === 'month' || activePeriod === 'lastmonth') return 30
        if (activePeriod === 'year') return 365
        if (activePeriod === 'custom' && customStartDate && customEndDate) {
            const diffTime = Math.abs(new Date(customEndDate).getTime() - new Date(customStartDate).getTime())
            return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1
        }
        return 30
    }, [activePeriod, customStartDate, customEndDate])

    useEffect(() => {
        setIsLoading(true)
        setRealSalesArray([]) 

        const fetchRealData = async () => {
             try {
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
                    toDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)
                } else if (activePeriod === 'lastmonth') {
                    fromDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
                    toDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999)
                } else if (activePeriod === 'year') {
                    fromDate = new Date(now.getFullYear(), 0, 1)
                    toDate = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999)
                } else if (activePeriod === 'custom') {
                    if (customStartDate) {
                        fromDate = new Date(customStartDate)
                        fromDate.setHours(0,0,0,0)
                    } else fromDate = new Date(2000, 0, 1)
                    
                    if (customEndDate) {
                        toDate = new Date(customEndDate)
                        toDate.setHours(23,59,59,999)
                    } else toDate = new Date()
                }

                let countQuery = supabase.from('platform_sales').select('*', { count: 'exact', head: true })
                    .gte('placed_at', fromDate.toISOString())
                    .lte('placed_at', toDate.toISOString())
                
                if (platformFilter !== 'all') countQuery = countQuery.eq('platform', platformFilter)
                if (restaurantFilter !== 'all') {
                    countQuery = countQuery.eq('restaurant_id', restaurantFilter)
                } else if (brandFilter !== 'all' || cityFilter !== 'all') {
                    const allowedIds = activeRestaurants.map(r => r.id)
                    countQuery = allowedIds.length > 0 ? countQuery.in('restaurant_id', allowedIds) : countQuery.in('restaurant_id', [-1])
                }
                
                const { count } = await countQuery
                
                let allData = []
                if (count && count > 0) {
                    const step = 1000
                    const promises = []
                    
                    for (let i = 0; i < count; i += step) {
                        let query = supabase.from('platform_sales').select('*')
                            .gte('placed_at', fromDate.toISOString())
                            .lte('placed_at', toDate.toISOString())
                            .order('placed_at', { ascending: true })
                            .range(i, i + step - 1)
                        
                        if (platformFilter !== 'all') query = query.eq('platform', platformFilter)
                        if (restaurantFilter !== 'all') {
                            query = query.eq('restaurant_id', restaurantFilter)
                        } else if (brandFilter !== 'all' || cityFilter !== 'all') {
                            const allowedIds = activeRestaurants.map(r => r.id)
                            query = allowedIds.length > 0 ? query.in('restaurant_id', allowedIds) : query.in('restaurant_id', [-1])
                        }
                        
                        promises.push(query.then(res => res.data || []))
                    }
                    
                    const chunks = await Promise.all(promises)
                    allData = chunks.flat()
                }
                
                setRealSalesArray(allData)
             } catch (err) {
                 console.warn("Error fetching platform_sales:", err.message)
                 setRealSalesArray([])
             } finally {
                 setIsLoading(false)
             }
        }
        fetchRealData()
    }, [activePeriod, customStartDate, customEndDate, periodDays, platformFilter, restaurantFilter, brandFilter, cityFilter, activeRestaurants])

    // Data Aggregation Engine (REAL)
    const chartData = useMemo(() => {
        if (!realSalesArray.length) return []
        const daysMap = {}
        const isYearlyView = activePeriod === 'year' || periodDays > 90
        const isSingleDay = activePeriod === 'today' || activePeriod === 'yesterday' || (activePeriod === 'custom' && periodDays <= 1)
        
        if (isYearlyView && activePeriod === 'year') {
            const mlist = t('monthsShort')
            const currYear = new Date().getFullYear()
            mlist.forEach((m, idx) => daysMap[m] = { date: m, sales: 0, orders: 0, sortKey: idx, year: currYear, month: idx, day: 1 })
        } else if (isSingleDay) {
            const n = new Date()
            for (let i = 0; i < 24; i++) {
                const hr = `${String(i).padStart(2, '0')}:00`
                daysMap[hr] = { date: hr, sales: 0, orders: 0, sortKey: i, year: n.getFullYear(), month: n.getMonth(), day: n.getDate() }
            }
        }

        realSalesArray.forEach(sale => {
             const dt = new Date(sale.placed_at)
             let dk = ''; let sortKey = 0
             if (isYearlyView) {
                 const mlistFull = t('months')
                 const monthName = mlistFull[dt.getMonth()]
                 if (activePeriod === 'year') { dk = t('monthsShort')[dt.getMonth()]; sortKey = dt.getMonth() }
                 else { dk = `${monthName} ${dt.getFullYear()}`; sortKey = dt.getFullYear() * 100 + dt.getMonth() }
             } else if (isSingleDay) {
                 const hr = dt.getHours(); dk = `${String(hr).padStart(2, '0')}:00`; sortKey = hr
             } else {
                 const dayL = t('daysShort')
                 dk = `${dt.toLocaleDateString('ro-RO', { day: '2-digit', month: '2-digit' })} (${dayL[dt.getDay()]})`
                 sortKey = dt.getFullYear() * 10000 + dt.getMonth() * 100 + dt.getDate()
             }
             
             if (!daysMap[dk]) daysMap[dk] = { date: dk, sales: 0, orders: 0, sortKey }
             
             daysMap[dk].sales += parseFloat(sale.total_amount) || 0
             daysMap[dk].orders += 1
             daysMap[dk].year = dt.getFullYear()
             daysMap[dk].month = dt.getMonth()
             daysMap[dk].day = dt.getDate()
        })
        return Object.values(daysMap).sort((a, b) => a.sortKey - b.sortKey)
    }, [realSalesArray, periodDays, l])

    const handleChartClick = (state) => {
        if (!state || !state.activePayload) return;
        const d = state.activePayload[0].payload;
        if (d.year === undefined) return;
        
        if (activePeriod === 'year' || periodDays > 90) {
            const startStr = `${d.year}-${String(d.month+1).padStart(2,'0')}-01`;
            const lastDay = new Date(d.year, d.month + 1, 0).getDate();
            const endStr = `${d.year}-${String(d.month+1).padStart(2,'0')}-${String(lastDay).padStart(2,'0')}`;
            setCustomStartDate(startStr);
            setCustomEndDate(endStr);
            setActivePeriod('custom');
        } else if (activePeriod === 'today' || activePeriod === 'yesterday' || periodDays <= 1) {
            // Already filtered to a day.
        } else {
            const dateStr = `${d.year}-${String(d.month+1).padStart(2,'0')}-${String(d.day).padStart(2,'0')}`;
            setCustomStartDate(dateStr);
            setCustomEndDate(dateStr);
            setActivePeriod('custom');
        }
    };

    const handleLocationClick = (data) => {
        if (!data || !data.name) return;
        const r = activeRestaurants.find(x => x.name === data.name);
        if (r) {
            setRestaurantFilter(r.id);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };

    const locationData = useMemo(() => {
        if (!realSalesArray.length) return []
        const locMap = {}
        realSalesArray.forEach(sale => {
            const r = activeRestaurants.find(x => x.id === sale.restaurant_id)
            const rName = r ? r.name : `ID: ${sale.restaurant_id}`
            if (!locMap[rName]) locMap[rName] = { name: rName, sales: 0 }
            locMap[rName].sales += parseFloat(sale.total_amount) || 0
        })
        return Object.values(locMap).sort((a,b) => b.sales - a.sales).slice(0, 5)
    }, [realSalesArray, activeRestaurants])

    const { days, hours, cellData, maxSales } = useMemo(() => {
        const allDaysTrans = t('days')
        let daysToRender = [allDaysTrans[1], allDaysTrans[2], allDaysTrans[3], allDaysTrans[4], allDaysTrans[5], allDaysTrans[6], allDaysTrans[0]]
        
        const now = new Date()
        if (activePeriod === 'today') daysToRender = [allDaysTrans[now.getDay()]]
        else if (activePeriod === 'yesterday') {
            const d = new Date(now); d.setDate(d.getDate() - 1); daysToRender = [allDaysTrans[d.getDay()]]
        }
        
        const possibleHours = Array.from({length: 15}, (_, i) => i + 9) // 09:00 to 23:00
        
        let maxS = 0
        const map = {}
        realSalesArray.forEach(sale => {
            const dt = new Date(sale.placed_at)
            const dName = allDaysTrans[dt.getDay()]
            const hr = dt.getHours()
            const key = `${dName}-${hr}`
            if (!map[key]) map[key] = { sales: 0, orders: 0 }
            map[key].sales += parseFloat(sale.total_amount) || 0
            map[key].orders += 1
            if (map[key].sales > maxS) maxS = map[key].sales
        })
        return { days: daysToRender, hours: possibleHours, cellData: map, maxSales: maxS }
    }, [activePeriod, realSalesArray, l])

    const topItems = useMemo(() => {
        if (!realSalesArray.length) return []
        const itemsMap = {}
        realSalesArray.forEach(sale => {
            if (sale.items && Array.isArray(sale.items) && sale.items.length > 0) {
                const totalQty = sale.items.reduce((sum, it) => sum + (parseInt(it.quantity) || 1), 0)
                const approxPrice = parseFloat(sale.total_amount) / (totalQty || 1)
                
                sale.items.forEach(it => {
                    const price = approxPrice
                    const qty = parseInt(it.quantity) || 1
                    if (!itemsMap[it.name]) itemsMap[it.name] = { name: it.name, count: 0, revenue: 0 }
                    itemsMap[it.name].count += qty
                    itemsMap[it.name].revenue += (price * qty)
                })
            }
        })
        return Object.values(itemsMap)
            .sort((a, b) => b.revenue !== a.revenue ? b.revenue - a.revenue : b.count - a.count)
            .map((it, idx) => ({ ...it, id: idx + 1 }))
    }, [realSalesArray])

    const paginatedItems = topItems.slice((pageNumber - 1) * ITEMS_PER_PAGE, pageNumber * ITEMS_PER_PAGE)
    const totalPages = Math.ceil(topItems.length / ITEMS_PER_PAGE)

    const [isUploading, setIsUploading] = useState(false)

    const handleExport = () => { }
    const handleFileUpload = async (e) => { setIsUploading(true); setTimeout(()=>setIsUploading(false), 500) }

    const totalSales = chartData.reduce((acc, curr) => acc + curr.sales, 0)
    const totalOrders = chartData.reduce((acc, curr) => acc + curr.orders, 0)
    const avgBasket = totalOrders > 0 ? (totalSales / totalOrders).toFixed(2) : 0

    const getHeatmapColor = (salesAmount) => {
        if (!salesAmount || salesAmount <= 0) return 'transparent'
        const pct = Math.min(1, Math.max(0, salesAmount / (maxSales || 1)))
        if (pct < 0.15) return isDark ? 'rgba(253, 186, 116, 0.2)' : '#ffedd5' 
        if (pct < 0.3)  return isDark ? 'rgba(250, 204, 21, 0.25)' : '#fef08a' 
        if (pct < 0.5)  return isDark ? 'rgba(132, 204, 22, 0.4)' : '#d9f99d' 
        if (pct < 0.7)  return isDark ? '#22c55e' : '#86efac' 
        if (pct < 0.9)  return isDark ? '#16a34a' : '#22c55e' 
        return isDark ? '#14532d' : '#15803d' 
    }

    const getHeatmapTextColor = (salesAmount) => {
        if (!salesAmount || salesAmount <= 0) return 'var(--text-color)'
        const pct = salesAmount / (maxSales || 1)
        if (isDark) return pct >= 0.7 ? '#fff' : '#f8fafc'
        return pct >= 0.7 ? '#fff' : '#1e293b'
    }

    const platformTabs = [
        { id: 'all', label: t('allPlatforms'), color: '#6366f1' },
        { id: 'iiko', label: t('ecosystem'), color: '#FF3366' },
        { id: 'glovo', label: 'Glovo', color: '#FFC244' },
        { id: 'wolt', label: 'Wolt', color: '#009DE0' },
        { id: 'bolt', label: 'Bolt Food', color: '#34D186' }
    ]

    return (
        <div className={`perf-container ${isDark ? 'dark-theme' : 'light-theme'}`}>
            <div className="perf-header">
                <div>
                    <h1 className="perf-title">{t('title')}</h1>
                    <p className="perf-subtitle">{t('subtitle')}</p>
                </div>
                
                <div className="perf-actions">
                    <input type="file" id="excel-upload" accept=".xlsx, .xls, .csv" multiple onChange={handleFileUpload} style={{ display: 'none' }} />
                    <button onClick={() => document.getElementById('excel-upload').click()} disabled={isUploading} className="btn-primary">
                        <UploadCloud size={18} />
                        {isUploading ? t('importing') : t('importExcel')}
                    </button>
                    <button onClick={handleExport} className="btn-secondary">
                        <Download size={18} /> {t('export')}
                    </button>
                </div>
            </div>

            <div className="filter-bar">
                <div className="platform-tabs">
                    {platformTabs.map(p => (
                        <button key={p.id} className="platform-tab" onClick={() => { setPlatformFilter(p.id); setSearchParams({ platform: p.id }) }} style={{
                            background: platformFilter === p.id ? p.color : 'var(--glass-bg-hover)',
                            color: platformFilter === p.id ? (['glovo', 'bolt'].includes(p.id) ? '#000' : '#fff') : 'var(--text-secondary)',
                            boxShadow: platformFilter === p.id ? `0 4px 12px ${p.color}40` : 'none'
                        }}>
                            {p.label}
                        </button>
                    ))}
                </div>

                <select value={brandFilter} onChange={e => { setBrandFilter(e.target.value); setRestaurantFilter('all') }} className="select-filter">
                    <option value="all">{t('allBrands')}</option>
                    {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>

                <select value={cityFilter} onChange={e => { setCityFilter(e.target.value); setRestaurantFilter('all') }} className="select-filter">
                    <option value="all">{t('allCities')}</option>
                    {cities.map(c => <option key={c} value={c}>{c}</option>)}
                </select>

                <select value={restaurantFilter} onChange={e => setRestaurantFilter(e.target.value)} className="select-filter">
                    <option value="all">{t('allLocations')}</option>
                    {activeRestaurants.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>

                <div className="period-tabs">
                    <div className="custom-date-wrap">
                        <input type="date" value={customStartDate} onChange={e => { setCustomStartDate(e.target.value); setActivePeriod('custom') }} className="select-filter" style={{padding: '6px 10px'}} />
                        <span style={{ color: 'var(--text-secondary)', fontWeight: 'bold' }}>-</span>
                        <input type="date" value={customEndDate} onChange={e => { setCustomEndDate(e.target.value); setActivePeriod('custom') }} className="select-filter" style={{padding: '6px 10px'}} />
                    </div>
                    {[
                        ['today', t('today')], ['yesterday', t('yesterday')], ['week', t('thisWeek')], 
                        ['month', t('thisMonth')], ['lastmonth', t('lastMonth')], ['year', t('thisYear')]
                    ].map(([id, lbl]) => (
                        <button key={id} className={`period-tab ${activePeriod === id ? 'active' : ''}`} onClick={() => { setActivePeriod(id); setCustomStartDate(''); setCustomEndDate('') }}>
                            {lbl}
                        </button>
                    ))}
                </div>
            </div>

            <div className="kpi-grid">
                <div className="glass-card">
                    <div style={{display:'flex', gap:'12px', alignItems:'center'}}>
                        <div style={{padding:'10px', background:'rgba(17,109,116,0.1)', borderRadius:'12px', color:'#116d74'}}><CreditCard size={24} /></div>
                        <span className="kpi-title">{t('totalRevenue')}</span>
                    </div>
                    <div className="kpi-value">{totalSales.toLocaleString('ro-RO')} RON</div>
                </div>

                <div className="glass-card">
                    <div style={{display:'flex', gap:'12px', alignItems:'center'}}>
                        <div style={{padding:'10px', background:'rgba(16,185,129,0.1)', borderRadius:'12px', color:'#10b981'}}><ShoppingBag size={24} /></div>
                        <span className="kpi-title">{t('totalOrders')}</span>
                    </div>
                    <div className="kpi-value">{totalOrders}</div>
                </div>

                <div className="glass-card">
                    <div style={{display:'flex', gap:'12px', alignItems:'center'}}>
                        <div style={{padding:'10px', background:'rgba(245,158,11,0.1)', borderRadius:'12px', color:'#f59e0b'}}><Activity size={24} /></div>
                        <span className="kpi-title">{t('aov')}</span>
                    </div>
                    <div className="kpi-value">{avgBasket} RON</div>
                </div>
            </div>

            <div className="charts-row">
                <div className="glass-card">
                    <h3 className="card-heading">{t('salesStats')}</h3>
                    <div style={{ height: '320px', marginLeft: '-15px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart data={chartData} onClick={handleChartClick} style={{ cursor: 'pointer' }} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)"} vertical={false} />
                                <XAxis dataKey="date" stroke="var(--text-secondary)" fontSize={11} tickLine={false} axisLine={false} tickMargin={12} interval={activePeriod==='year' ? 0 : 'preserveStartEnd'} />
                                <YAxis yAxisId="left" stroke="var(--text-secondary)" fontSize={11} tickLine={false} axisLine={false} tickFormatter={v => v.toLocaleString('ro-RO')} />
                                <YAxis yAxisId="right" orientation="right" stroke="var(--text-secondary)" fontSize={11} tickLine={false} axisLine={false} hide />
                                <Tooltip 
                                    contentStyle={{ borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 20px 40px rgba(0,0,0,0.2)', background: isDark ? 'rgba(30,41,59,0.95)' : 'rgba(255,255,255,0.95)', backdropFilter: 'blur(10px)' }}
                                    labelStyle={{ fontWeight: '800', color: 'var(--text-color)', marginBottom: '8px' }}
                                    formatter={(value, name) => [name === t('sales') ? `${Number(value).toFixed(2)} RON` : value, name]}
                                />
                                <Legend wrapperStyle={{ paddingTop: '16px', fontSize: '13px', fontWeight: '700' }} />
                                
                                <Bar yAxisId="left" dataKey="sales" name={t('sales')} fill="url(#colorSales)" radius={[6, 6, 0, 0]} maxBarSize={45} />
                                <Line yAxisId="right" type="monotone" dataKey="orders" name={t('orders')} stroke="#10b981" strokeWidth={4} dot={{ strokeWidth: 2, r: 4, fill: '#fff' }} activeDot={{ r: 8, stroke: '#10b981', strokeWidth: 4, fill: '#fff' }} />
                                <defs>
                                    <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#116d74" stopOpacity={1}/>
                                        <stop offset="100%" stopColor="#0d5156" stopOpacity={0.4}/>
                                    </linearGradient>
                                </defs>
                            </ComposedChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="glass-card">
                    <h3 className="card-heading">{t('topLocations')}</h3>
                    {locationData.length > 0 ? (
                        <div style={{ height: '320px', marginLeft: '-20px' }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={locationData} layout="vertical" margin={{ top: 0, right: 30, left: 0, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="transparent" />
                                    <XAxis type="number" hide />
                                    <YAxis type="category" dataKey="name" stroke="var(--text-color)" fontSize={12} fontWeight={600} tickLine={false} axisLine={false} width={130} />
                                    <Tooltip 
                                        cursor={{ fill: 'var(--glass-bg-hover)' }}
                                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 30px rgba(0,0,0,0.1)', background: isDark ? '#1e293b' : '#fff' }}
                                        formatter={(value) => [`${Number(value).toFixed(2)} RON`, t('sales')]}
                                    />
                                    <Bar dataKey="sales" onClick={handleLocationClick} fill="#10b981" radius={[0, 8, 8, 0]} barSize={24} style={{ cursor: 'pointer' }} label={{ position: 'right', fill: 'var(--text-color)', fontSize: 13, fontWeight: '800', formatter: v => `${v.toLocaleString('ro-RO')} lei` }}>
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    ) : (
                        <div style={{ height: '320px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>{t('noData')}</div>
                    )}
                </div>
            </div>

            <div className="glass-card" style={{overflowX: 'auto'}}>
                <h3 className="card-heading">{t('heatmap')}</h3>
                
                {days.length === 1 ? (
                    <div>
                        <div style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '24px', textAlign: 'center' }}>{days[0]}</div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '16px' }}>
                            {hours.map(h => {
                                const cell = cellData[`${days[0]}-${h}`] || { sales: 0, orders: 0 };
                                const val = cell.sales
                                return (
                                    <div key={h} style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                        <span style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-secondary)', width: '45px', textAlign: 'right' }}>{h}:00</span>
                                        <div className="heatmap-cell" style={{ 
                                            flex: 1, background: getHeatmapColor(val), 
                                            color: getHeatmapTextColor(val),
                                            border: val === 0 ? 'var(--glass-border)' : 'none'
                                        }}>
                                            <span style={{ fontSize: '13px', fontWeight: '800' }}>{val ? `${val.toFixed(2)} RON` : ''}</span>
                                            {cell.orders > 0 && <span style={{ fontSize: '10px', opacity: 0.9 }}>{cell.orders} {t('orders').toLowerCase()}</span>}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                ) : (
                    <div style={{ minWidth: '800px' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: `70px repeat(${days.length}, 1fr)`, gap: '6px' }}>
                            <div />
                            {days.map(d => <div key={d} style={{ textAlign: 'center', fontSize: '14px', fontWeight: '800', color: 'var(--text-color)', paddingBottom: '12px' }}>{d}</div>)}
                            
                            {hours.map(h => (
                                <React.Fragment key={h}>
                                    <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: '16px' }}>
                                        {h}:00
                                    </div>
                                    {days.map(d => {
                                        const cell = cellData[`${d}-${h}`] || { sales: 0, orders: 0 }
                                        const val = cell.sales
                                        return (
                                            <div key={`${d}-${h}`} className="heatmap-cell" title={`${val} RON, ${cell.orders} orders`} style={{ 
                                                background: getHeatmapColor(val), 
                                                color: getHeatmapTextColor(val),
                                                border: val === 0 ? 'var(--glass-border)' : 'none'
                                            }}>
                                                <span style={{ fontSize: '12px', fontWeight: '800' }}>{val ? `${val.toFixed(2)} RON` : ''}</span>
                                                {cell.orders > 0 && <span style={{ fontSize: '10px', fontWeight: '600', opacity: 0.85 }}>{cell.orders} cmd.</span>}
                                            </div>
                                        )
                                    })}
                                </React.Fragment>
                            ))}
                            
                            <div style={{ fontSize: '14px', fontWeight: '900', color: 'var(--text-color)', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: '16px', marginTop: '12px' }}>
                                {t('total')}
                            </div>
                            {days.map(d => {
                                const totalDay = hours.reduce((sum, h) => sum + (cellData[`${d}-${h}`]?.sales || 0), 0)
                                const totalOrders = hours.reduce((sum, h) => sum + (cellData[`${d}-${h}`]?.orders || 0), 0)
                                return (
                                    <div key={`total-${d}`} style={{ 
                                        height: '44px', background: 'var(--glass-bg-hover)', borderRadius: '6px',
                                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', marginTop: '12px',
                                        color: 'var(--text-color)', boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.05)'
                                    }}>
                                        <span style={{ fontSize: '12px', fontWeight: '900' }}>{totalDay > 0 ? `${totalDay.toFixed(2)} RON` : ''}</span>
                                        {totalOrders > 0 && <span style={{ fontSize: '10px', fontWeight: '700', opacity: 0.7 }}>{totalOrders} cmd.</span>}
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                )}
            </div>

            <div className="glass-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                    <h3 className="card-heading" style={{margin:0}}>{t('productSales')}</h3>
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '40px 1fr auto', padding: '12px 20px', fontSize: '13px', fontWeight: '800', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                        <div>#</div>
                        <div>{t('topProduct')}</div>
                        <div style={{ textAlign: 'right' }}>{t('salesTotal')}</div>
                    </div>
                    {paginatedItems.map((item) => (
                        <div key={item.id} className="list-row product-row-hover" onClick={() => navigate('/product-analytics/' + encodeURIComponent(item.name))} style={{ cursor: 'pointer', transition: 'all 0.15s' }} title={`Deschide Analytics: ${item.name}`}>
                            <div style={{ fontSize: '15px', fontWeight: '800', color: 'var(--text-secondary)', opacity: 0.5 }}>{item.id}</div>
                            <div style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-color)' }}>{item.name}</div>
                            <div style={{ textAlign: 'right' }}>
                                <div style={{ fontSize: '15px', fontWeight: '900', color: 'var(--text-color)' }}>{item.revenue.toLocaleString('ro-RO', { minimumFractionDigits: 2 })} RON</div>
                                <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)' }}>{item.count} {t('piecesOrdered')}</div>
                            </div>
                        </div>
                    ))}
                    {paginatedItems.length === 0 && <div style={{padding:'32px', textAlign:'center', color:'var(--text-secondary)'}}>{t('noProducts')}</div>}
                </div>
                
                {totalPages > 1 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '24px', paddingTop: '20px', borderTop: 'var(--glass-border)' }}>
                        <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-secondary)' }}>{t('showItems').replace('{n}', ITEMS_PER_PAGE)}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                            <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-color)' }}>{t('pageOf').replace('{p}', pageNumber).replace('{t}', totalPages)}</span>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button onClick={() => setPageNumber(Math.max(1, pageNumber - 1))} disabled={pageNumber === 1} className="btn-secondary" style={{padding:'8px', borderRadius:'10px'}}>&lt;</button>
                                <button onClick={() => setPageNumber(Math.min(totalPages, pageNumber + 1))} disabled={pageNumber === totalPages} className="btn-secondary" style={{padding:'8px', borderRadius:'10px'}}>&gt;</button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
            <style>{`
                :root {
                    --text-color: ${isDark ? '#f8fafc' : '#1e293b'};
                    --text-secondary: ${isDark ? '#94a3b8' : '#64748b'};
                    --glass-bg: ${isDark ? 'rgba(255, 255, 255, 0.03)' : '#ffffff'};
                    --glass-border: ${isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(0, 0, 0, 0.06)'};
                    --glass-bg-hover: ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.02)'};
                    --input-bg: ${isDark ? 'rgba(0,0,0,0.2)' : '#f8fafc'};
                }
                .product-row-hover:hover {
                    background: var(--glass-bg-hover);
                    transform: translateX(4px);
                    border-radius: 8px;
                }
            `}</style>
        </div>
    )
}
