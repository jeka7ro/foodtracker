import React, { useState, useMemo, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useTheme } from '../lib/ThemeContext'
import { useLanguage } from '../lib/LanguageContext'
import { supabase } from '../lib/supabaseClient'
import { LineChart, Line, BarChart, Bar, ComposedChart, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { Download, UploadCloud, Activity, ShoppingBag, CreditCard, Package, RefreshCw } from 'lucide-react'
import * as XLSX from 'xlsx'
import './Performance.css'

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
    products: { ro: 'Produse', en: 'Products', ru: 'Продукты' },
    topLocations: { ro: 'Top Locații', en: 'Top Locations', ru: 'Топ Локации' },
    noData: { ro: 'Fără date.', en: 'No data.', ru: 'Нет данных.' },
    heatmap: { ro: 'Intensitatea Vânzărilor pe Ore (Heatmap)', en: 'Sales Heatmap by Hour', ru: 'Интенсивность продаж по часам (Тепловая карта)' },
    total: { ro: 'Total', en: 'Total', ru: 'Итого' },
    productSales: { ro: 'Vânzări după Produse', en: 'Sales by Product', ru: 'Продажи по Продуктам' },
    topProduct: { ro: 'Produs (Top)', en: 'Top Product', ru: 'Продукт (Топ)' },
    salesTotal: { ro: 'Vânzări Totale', en: 'Total Sales', ru: 'Всего Продано' },
    piecesOrdered: { ro: 'bucăți comandate', en: 'pieces ordered', ru: 'штук заказано' },
    piecesShort: { ro: 'buc.', en: 'pcs.', ru: 'шт.' },
    noProducts: { ro: 'Niciun produs pentru perioada selectată.', en: 'No products for selected period.', ru: 'Нет продуктов за выбранный период.' },
    showItems: { ro: 'Afișare {n} rânduri pe pagină', en: 'Showing {n} rows per page', ru: 'Показано {n} строк на странице' },
    pageOf: { ro: 'Pagina {p} din {t}', en: 'Page {p} of {t}', ru: 'Страница {p} из {t}' },
    soldPiecesHeader: { ro: 'Vândute', en: 'Sold', ru: 'Продано' },
    topLocationItem: { ro: 'Top Locație', en: 'Top Location', ru: 'Топ Локация' },
    topDayItem: { ro: 'Top Ziua', en: 'Top Day', ru: 'Лучший День' },
    platformItem: { ro: 'Platformă', en: 'Platform', ru: 'Платформа' },
    detailedLocationAnalysis: { ro: 'Analiză Detaliată Locații', en: 'Detailed Location Analysis', ru: 'Детальный анализ по локациям' },
    brandLocationHeader: { ro: 'Brand Locație', en: 'Brand Location', ru: 'Бренд Локация' },
    rowsPerPage: { ro: 'Rânduri pe pagină:', en: 'Rows per page:', ru: 'Строк на странице:' },
    rowsLabel: { ro: 'Rânduri:', en: 'Rows:', ru: 'Строки:' },
    noLocationData: { ro: 'Nu există date de locație...', en: 'No location data...', ru: 'Нет данных о локации...' },
    currency: { ro: 'lei', en: 'RON', ru: 'лей' },
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
    const initialPeriod = localStorage.getItem('analyticsActivePeriod') || 'week'
    const [activePeriodState, setActivePeriodState] = useState(initialPeriod)
    const setActivePeriod = (p) => {
        setActivePeriodState(p)
        if (p !== 'custom') {
            localStorage.setItem('analyticsActivePeriod', p)
        }
    }
    const activePeriod = activePeriodState
    const [customStartDate, setCustomStartDate] = useState('')
    const [customEndDate, setCustomEndDate] = useState('')
    const [pageNumber, setPageNumber] = useState(1)
    const [itemsPerPage, setItemsPerPage] = useState(10)
    const [locationsPageNumber, setLocationsPageNumber] = useState(1)
    const [locationsItemsPerPage, setLocationsItemsPerPage] = useState(10)

    const [syncStatus, setSyncStatus] = useState({ isSyncing: false, percent: 0, message: '' })

    useEffect(() => {
        const checkSync = async () => {
            try {
                const res = await fetch(`${import.meta.env.VITE_WORKER_URL || 'http://localhost:3001'}/api/sync-sales/status`);
                if (res.ok) {
                    const data = await res.json();
                    setSyncStatus(data);
                }
            } catch (e) {}
        };
        checkSync();
        const interval = setInterval(checkSync, 3000);
        return () => clearInterval(interval);
    }, []);

    const triggerSync = async () => {
        if (syncStatus.isSyncing) return;
        setSyncStatus({ isSyncing: true, percent: 0, message: 'Se contactează serverul...' });
        try {
            await fetch(`${import.meta.env.VITE_WORKER_URL || 'http://localhost:3001'}/api/sync-sales`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ days: 180 })
            });
        } catch (e) {}
    };

    useEffect(() => {
        Promise.all([
            supabase.from('brands').select('id, name, logo_url').order('name'),
            supabase.from('restaurants').select('id, name, city, brand_id').eq('is_active', true).order('name')
        ]).then(([{ data: b }, { data: r }]) => {
            setBrands(b || [])
            setRestaurants(r || [])
        })
    }, [])

    const [iikoProducts, setIikoProducts] = useState([])

    useEffect(() => {
        async function fetchNomenclature() {
            try {
                const { data: rests } = await supabase.from('restaurants').select('iiko_config').not('iiko_config', 'is', null)
                if (!rests || rests.length === 0) return
                const orgId = rests.find(r => r.iiko_config?.organizationId)?.iiko_config?.organizationId
                if (!orgId) return

                const resp = await fetch(`http://localhost:3005/api/nomenclature?orgId=${orgId}`, {
                    headers: { 'x-iiko-token': 'a1fe30cdeb934aa0af01b6a35244b7f0' }
                })
                if (resp.ok) {
                    const data = await resp.json()
                    const fullList = [...(data.products || []), ...(data.groups || [])]
                    setIikoProducts(fullList)
                }
            } catch (e) {
                console.log('Iiko fetch fail', e)
            }
        }
        fetchNomenclature()
    }, [])

    const getProductImage = (productName) => {
        if (!iikoProducts || iikoProducts.length === 0) return null
        const cleanNameText = productName.split('[')[0].trim().toLowerCase()
        const excludeWords = ['sushimaster', 'sushi', 'master', 'bucuresti', 'brasov', 'constanta', 'iasi']
        let cleanWords = cleanNameText.replace(/[^a-z0-9\s]/g, '').split(' ').filter(w => w.length > 2 && !excludeWords.includes(w))
        let found = iikoProducts.find(p => p.name?.toLowerCase().includes(cleanNameText))
        if (!found && cleanWords.length > 0) {
            found = iikoProducts.find(p => {
                const n = p.name?.toLowerCase() || ''
                return cleanWords.every(w => n.includes(w))
            })
        }
        if (found && found.imageLinks && found.imageLinks.length > 0) return found.imageLinks[0]
        return null
    }

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
        if (!state || !state.activePayload) {
            if (activePeriod === 'custom' && customStartDate === customEndDate && periodDays <= 1) {
                setCustomStartDate('')
                setCustomEndDate('')
                setActivePeriod('week')
            } else if (activePeriod === 'today' || activePeriod === 'yesterday') {
                setActivePeriod('week')
            }
            return
        }
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

    const allLocationData = useMemo(() => {
        if (!realSalesArray.length) return []
        const locMap = {}
        realSalesArray.forEach(sale => {
            const r = activeRestaurants.find(x => x.id === sale.restaurant_id)
            const rName = r ? r.name : `ID: ${sale.restaurant_id}`
            if (!locMap[rName]) locMap[rName] = { name: rName, sales: 0, orders: 0, products: 0, productCounts: {} }
            locMap[rName].sales += parseFloat(sale.total_amount) || 0
            locMap[rName].orders += 1
            if (sale.items && Array.isArray(sale.items)) {
                sale.items.forEach(it => {
                    locMap[rName].products += (it.quantity || 1)
                    const pName = it.product_name || it.name || 'Produs Necunoscut'
                    if (!locMap[rName].productCounts[pName]) {
                        locMap[rName].productCounts[pName] = { count: 0, image_url: it.image_url || '' }
                    }
                    locMap[rName].productCounts[pName].count += (it.quantity || 1)
                })
            }
        })
        return Object.values(locMap).map(loc => {
            let topProd = null
            let maxCount = 0
            for (const [pName, data] of Object.entries(loc.productCounts)) {
                if (data.count > maxCount) {
                    maxCount = data.count
                    topProd = { name: pName, ...data }
                }
            }
            return { ...loc, topProd }
        }).sort((a,b) => b.sales - a.sales)
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
            if (!map[key]) map[key] = { sales: 0, orders: 0, products: 0 }
            map[key].sales += parseFloat(sale.total_amount) || 0
            map[key].orders += 1
            if (sale.items && Array.isArray(sale.items)) {
                map[key].products += sale.items.reduce((sum, it) => sum + (parseInt(it.quantity) || 1), 0)
            }
            if (map[key].sales > maxS) maxS = map[key].sales
        })
        return { days: daysToRender, hours: possibleHours, cellData: map, maxSales: maxS }
    }, [activePeriod, realSalesArray, l])

    const topItems = useMemo(() => {
        if (!realSalesArray.length) return []
        const itemsMap = {}
        const dayMap = t('days')
        
        realSalesArray.forEach(sale => {
            if (sale.items && Array.isArray(sale.items) && sale.items.length > 0) {
                const totalQty = sale.items.reduce((sum, it) => sum + (parseInt(it.quantity) || 1), 0)
                const approxPrice = parseFloat(sale.total_amount) / (totalQty || 1)
                
                const rInfo = restaurants.find(r => r.id === sale.restaurant_id)
                const bInfo = rInfo ? brands.find(b => b.id === rInfo.brand_id) : null

                const dt = new Date(sale.placed_at)
                const dayStr = dayMap[dt.getDay()]
                const locStr = rInfo ? rInfo.name : `Rest. ${sale.restaurant_id}`
                const platStr = sale.platform || sale.source || 'iiko'

                sale.items.forEach(it => {
                    const price = approxPrice
                    const qty = parseInt(it.quantity) || 1
                    const pFullName = it.product_name || it.name || 'Produs Necunoscut'
                    if (!itemsMap[pFullName]) itemsMap[pFullName] = { name: pFullName, count: 0, revenue: 0, brand: bInfo, locs: {}, days: {}, plats: {} }
                    itemsMap[pFullName].count += qty
                    itemsMap[pFullName].revenue += (price * qty)
                    itemsMap[pFullName].locs[locStr] = (itemsMap[pFullName].locs[locStr] || 0) + qty
                    itemsMap[pFullName].days[dayStr] = (itemsMap[pFullName].days[dayStr] || 0) + qty
                    itemsMap[pFullName].plats[platStr] = (itemsMap[pFullName].plats[platStr] || 0) + qty
                })
            }
        })
        return Object.values(itemsMap)
            .sort((a, b) => b.revenue !== a.revenue ? b.revenue - a.revenue : b.count - a.count)
            .map((it, idx) => {
                let bestLoc = 'N/A', bestLocVal = -1
                Object.keys(it.locs).forEach(k => { if (it.locs[k] > bestLocVal) { bestLocVal = it.locs[k]; bestLoc = k } })
                
                let bestDay = 'N/A', bestDayVal = -1
                Object.keys(it.days).forEach(k => { if (it.days[k] > bestDayVal) { bestDayVal = it.days[k]; bestDay = k } })

                let bestPlat = 'N/A', bestPlatVal = -1
                Object.keys(it.plats).forEach(k => { if (it.plats[k] > bestPlatVal) { bestPlatVal = it.plats[k]; bestPlat = k } })

                return { ...it, id: idx + 1, bestLoc, bestDay, bestPlat }
            })
    }, [realSalesArray, restaurants, brands, l])

    const paginatedItems = topItems.slice((pageNumber - 1) * itemsPerPage, pageNumber * itemsPerPage)
    const totalPages = Math.ceil(topItems.length / itemsPerPage)

    const [isUploading, setIsUploading] = useState(false)

    const handleExport = () => { }
    const handleFileUpload = async (e) => { setIsUploading(true); setTimeout(()=>setIsUploading(false), 500) }

    const totalSales = chartData.reduce((acc, curr) => acc + curr.sales, 0)
    const totalOrders = chartData.reduce((acc, curr) => acc + curr.orders, 0)
    const avgBasket = totalOrders > 0 ? (totalSales / totalOrders).toLocaleString('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0,00'

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
        { id: 'all', label: t('allPlatforms'), color: '#116d74' },
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
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '8px' }}>
                <div className="filter-bar" style={{ width: '100%' }}>
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
                </div>

                <div className="filter-bar" style={{ width: '100%', padding: '12px 16px', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                    <div className="period-tabs" style={{ marginLeft: 0 }}>
                        <div className="custom-date-wrap">
                            <input type="date" value={customStartDate} onChange={e => { setCustomStartDate(e.target.value); setActivePeriod('custom') }} className="select-filter" style={{padding: '4px 10px', fontSize: '12px'}} />
                            <span style={{ color: 'var(--text-secondary)', fontWeight: 'bold' }}>-</span>
                            <input type="date" value={customEndDate} onChange={e => { setCustomEndDate(e.target.value); setActivePeriod('custom') }} className="select-filter" style={{padding: '4px 10px', fontSize: '12px'}} />
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

                    <div className="perf-actions" style={{ marginLeft: 'auto', display: 'flex', gap: '10px' }}>
                        <button onClick={triggerSync} disabled={syncStatus.isSyncing} className="btn-secondary" style={{ color: '#10b981', borderColor: '#10b981', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <RefreshCw size={16} className={syncStatus.isSyncing ? "spinner" : ""} /> {syncStatus.isSyncing ? 'Se sincronizează...' : 'Sincronizează Live'}
                        </button>
                    </div>
                </div>
            </div>

            {syncStatus.isSyncing && (
                <div className="glass-card" style={{ marginBottom: '16px', padding: '16px 24px', border: '1px solid rgba(16, 185, 129, 0.3)', background: isDark ? 'rgba(16, 185, 129, 0.05)' : '#ecfdf5' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <RefreshCw size={18} className="spinner" color="#10b981" />
                            <span style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-color)' }}>
                                {syncStatus.message || 'Se sincronizează datele istorice...'}
                            </span>
                        </div>
                        <span style={{ fontSize: '13px', fontWeight: '800', color: '#10b981' }}>{syncStatus.percent}%</span>
                    </div>
                    <div style={{ width: '100%', height: '6px', background: 'var(--glass-border)', borderRadius: '10px', overflow: 'hidden' }}>
                        <div style={{ width: `${syncStatus.percent}%`, height: '100%', background: '#10b981', transition: 'width 0.5s ease-out' }}></div>
                    </div>
                </div>
            )}

            <div className="kpi-grid">
                <div className="glass-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px' }}>
                    <div style={{display:'flex', gap:'16px', alignItems:'center'}}>
                        <div style={{padding:'8px', background:'rgba(17,109,116,0.1)', borderRadius:'10px', color:'#116d74'}}><CreditCard size={20} /></div>
                        <span className="kpi-title" style={{ margin: 0, fontSize: '13px', paddingTop: '2px' }}>{t('totalRevenue')}</span>
                    </div>
                    <div className="kpi-value" style={{ margin: 0, fontSize: '20px' }}>
                        {totalSales.toLocaleString('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} RON
                    </div>
                </div>

                <div 
                    className="glass-card"
                    style={{ cursor: 'pointer', transition: 'all 0.2s', border: '1px solid transparent', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px' }}
                    onClick={() => { document.getElementById('products-table-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }}
                    title="Navighează la lista detaliată"
                >
                    <div style={{display:'flex', gap:'16px', alignItems:'center'}}>
                        <div style={{padding:'8px', background:'rgba(16,185,129,0.1)', borderRadius:'10px', color:'#10b981'}}><ShoppingBag size={20} /></div>
                        <span className="kpi-title" style={{ display: 'flex', alignItems: 'center', gap: '6px', margin: 0, fontSize: '13px', paddingTop: '2px' }}>
                            Comenzi & Produse
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
                        </span>
                    </div>
                    
                    <div className="kpi-value" style={{ fontSize: '18px', display: 'flex', alignItems: 'center', gap: '12px', whiteSpace: 'nowrap', margin: 0 }}>
                         <div style={{display: 'flex', alignItems: 'baseline', gap: '4px'}}>
                              {isLoading ? '...' : totalOrders.toLocaleString('ro-RO')}
                              <span style={{fontSize:'10px', color:'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px'}}>Comenzi</span>
                         </div>
                         <div style={{ width: '1px', background: 'var(--glass-border)', height: '16px' }}></div>
                         <div style={{display: 'flex', alignItems: 'baseline', gap: '4px'}}>
                              {topItems.reduce((sum, it) => sum + (it.count || 0), 0).toLocaleString('ro-RO')}
                              <span style={{fontSize:'10px', color:'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px'}}>Produse</span>
                         </div>
                    </div>
                </div>

                <div className="glass-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px' }}>
                    <div style={{display:'flex', gap:'16px', alignItems:'center'}}>
                        <div style={{padding:'8px', background:'rgba(245,158,11,0.1)', borderRadius:'10px', color:'#f59e0b'}}><Activity size={20} /></div>
                        <span className="kpi-title" style={{ margin: 0, fontSize: '13px', paddingTop: '2px' }}>{t('aov')}</span>
                    </div>
                    <div className="kpi-value" style={{ margin: 0, fontSize: '20px' }}>
                        {avgBasket} RON
                    </div>
                </div>
            </div>

            <div className="charts-row">
                <div className="glass-card">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px' }}>
                        <h3 className="card-heading" style={{ margin: 0 }}>{t('salesStats')}</h3>
                        {(() => {
                            if (!chartData || chartData.length === 0) return null;
                            const foundSet = new Set();
                            const activeHolidays = [];
                            chartData.forEach(d => {
                                if (d.year !== undefined && d.month !== undefined && d.day !== undefined) {
                                    const hYear = getRomanianHolidays(d.year);
                                    const ddMM = `${String(d.day).padStart(2, '0')}-${String(d.month + 1).padStart(2, '0')}`;
                                    if (hYear[ddMM] && !foundSet.has(ddMM + d.year)) {
                                        foundSet.add(ddMM + d.year);
                                        activeHolidays.push({ dateStr: `${String(d.day).padStart(2, '0')}.${String(d.month + 1).padStart(2, '0')}`, label: hYear[ddMM].label });
                                    }
                                }
                            });
                            if (activeHolidays.length === 0) return null;
                            return (
                                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                    {activeHolidays.map((h, i) => (
                                        <span key={i} style={{ padding: '4px 10px', background: 'var(--glass-bg-hover)', color: 'var(--text-color)', fontSize: '12px', fontWeight: '600', borderRadius: '8px', border: '1px solid var(--glass-border)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <span style={{ opacity: 0.5, fontSize: '11px', fontWeight: '800' }}>{h.dateStr}</span>
                                            {h.label}
                                        </span>
                                    ))}
                                </div>
                            );
                        })()}
                    </div>
                    <div style={{ height: '320px', marginLeft: '-15px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart data={chartData} onClick={handleChartClick} style={{ cursor: 'pointer' }} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)"} vertical={false} />
                                {(() => {
                                    const showDayNames = ['month', 'lastmonth', 'year'].includes(activePeriod) && chartData.length > 7
                                    return (
                                        <XAxis 
                                            dataKey="date" 
                                            stroke="var(--text-secondary)" 
                                            fontSize={10} 
                                            tickLine={false} 
                                            axisLine={false} 
                                            tickMargin={4} 
                                            height={showDayNames ? 42 : 20}
                                            interval={0}
                                            tick={(props) => {
                                                const { x, y, payload } = props
                                                const label = payload.value
                                                const mainLabel = showDayNames ? label.split(' ')[0] : label
                                                
                                                if (!showDayNames) {
                                                    return <text x={x} y={y+12} textAnchor="middle" fill="var(--text-secondary)" fontSize={10}>{label}</text>
                                                }
                                                
                                                const dateParts = mainLabel.split(/[\.\/]/)
                                                const dayN = parseInt(dateParts[0])
                                                const monN = parseInt(dateParts[1]) - 1
                                                const yr = new Date().getFullYear()
                                                
                                                if (isNaN(dayN) || isNaN(monN)) {
                                                    return <text x={x} y={y+12} textAnchor="middle" fill="var(--text-secondary)" fontSize={10}>{label}</text>
                                                }
                                                
                                                const d = new Date(yr, monN, dayN)
                                                const dayNames = ['Du','Lu','Ma','Mi','Jo','Vi','Sâ']
                                                const dayName = dayNames[d.getDay()]
                                                const isWeekend = d.getDay() === 0 || d.getDay() === 6
                                                const ddMM = `${String(dayN).padStart(2,'0')}-${String(monN+1).padStart(2,'0')}`
                                                const holidays = getRomanianHolidays(yr)
                                                const holiday = holidays[ddMM]
                                                const isLegal = holiday?.legal
                                                const textColor = isLegal ? '#f59e0b' : isWeekend ? '#116d74' : 'var(--text-secondary)'
                                                
                                                return (
                                                    <g style={{ cursor: holiday ? 'help' : 'default' }}>
                                                        {holiday && <title>{holiday.label} {isLegal ? '(Sărbătoare Legală)' : ''}</title>}
                                                        <text x={x} y={y+10} textAnchor="middle" fill={textColor} fontSize={10} fontWeight={isLegal || isWeekend ? '700' : '400'}>{mainLabel}</text>
                                                        <text x={x} y={y+22} textAnchor="middle" fill={textColor} fontSize={9} fontWeight={isLegal ? '800' : '400'}>{dayName}</text>
                                                        {holiday && <text x={x} y={y+34} textAnchor="middle" fill={textColor} fontSize={11}>{holiday.label.split(' ')[0]}</text>}
                                                    </g>
                                                )
                                            }}
                                        />
                                    )
                                })()}
                                <YAxis yAxisId="left" stroke="var(--text-secondary)" fontSize={11} tickLine={false} axisLine={false} tickFormatter={v => v.toLocaleString('ro-RO')} />
                                <YAxis yAxisId="right" orientation="right" stroke="var(--text-secondary)" fontSize={11} tickLine={false} axisLine={false} hide />
                                <Tooltip 
                                    contentStyle={{ borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 20px 40px rgba(0,0,0,0.2)', background: isDark ? 'rgba(30,41,59,0.95)' : 'rgba(255,255,255,0.95)', backdropFilter: 'blur(10px)' }}
                                    labelStyle={{ fontWeight: '800', color: 'var(--text-color)', marginBottom: '8px' }}
                                    labelFormatter={(label) => {
                                        const cleanPart = label.split(' ')[0]
                                        const dateParts = cleanPart.split(/[\.\/]/)
                                        const dayN = parseInt(dateParts[0])
                                        const monN = parseInt(dateParts[1]) - 1
                                        if (!isNaN(dayN) && !isNaN(monN)) {
                                            const ddMM = `${String(dayN).padStart(2,'0')}-${String(monN+1).padStart(2,'0')}`
                                            const hol = getRomanianHolidays(new Date().getFullYear())[ddMM]
                                            if (hol) return `${label} - ${hol.label}`
                                        }
                                        return label
                                    }}
                                    formatter={(value, name) => [name === t('sales') ? `${Number(value).toLocaleString('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} RON` : value, name]}
                                />
                                <Legend wrapperStyle={{ paddingTop: '16px', fontSize: '13px', fontWeight: '700' }} />
                                
                                <Bar yAxisId="left" dataKey="sales" name={t('sales')} fill="url(#colorSales)" radius={[6, 6, 0, 0]} maxBarSize={45} />
                                <Line yAxisId="right" type="monotone" dataKey="orders" name={t('orders')} stroke="#f97316" strokeWidth={4} dot={{ strokeWidth: 2, r: 4, fill: '#fff' }} activeDot={{ r: 8, stroke: '#f97316', strokeWidth: 4, fill: '#fff' }} />
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

                <div className="glass-card" style={{ display: 'flex', flexDirection: 'column' }}>
                    <h3 
                        className="card-heading" 
                        style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', width: 'fit-content', transition: 'all 0.2s' }} 
                        onClick={() => document.getElementById('locations-table-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' })} 
                        title="Click pentru analiza detaliată pe locații"
                        onMouseOver={(e) => e.currentTarget.style.opacity = '0.7'}
                        onMouseOut={(e) => e.currentTarget.style.opacity = '1'}
                    >
                        {t('topLocations')} 
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
                    </h3>
                    {allLocationData.slice(0, 5).length > 0 ? (
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto', marginTop: '12px' }}>
                            {allLocationData.slice(0, 5).map(loc => {
                                const maxSales = Math.max(...allLocationData.slice(0, 5).map(l => l.sales), 1);
                                const pct = (loc.sales / maxSales) * 100;
                                return (
                                    <div key={loc.name} style={{ display: 'flex', flexDirection: 'column', cursor: 'pointer' }} onClick={() => handleLocationClick(loc)}>
                                        <div style={{ color: 'var(--text-color)', fontSize: '13px', fontWeight: 600, display: 'block', marginBottom: '6px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={loc.name}>
                                            {loc.name}
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <div style={{ flex: 1, height: '8px', background: 'var(--glass-border)', borderRadius: '4px', overflow: 'hidden' }}>
                                                <div style={{ width: `${pct}%`, height: '100%', background: 'linear-gradient(90deg, #0d5156 0%, #10b981 100%)', borderRadius: '4px' }}></div>
                                            </div>
                                            <div style={{ color: 'var(--text-color)', fontSize: '12px', fontWeight: 800, flexShrink: 0 }}>
                                                {loc.sales.toLocaleString('ro-RO')} lei
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    ) : (
                        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>{t('noData')}</div>
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
                                            <span style={{ fontSize: '13px', fontWeight: '800' }}>{val ? `${val.toLocaleString('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} RON` : ''}</span>
                                            {cell.orders > 0 && <span style={{ fontSize: '10px', opacity: 0.9 }}>{cell.orders} {t('orders').toLowerCase()} | {cell.products} {t('products').toLowerCase()}</span>}
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
                                            <div key={`${d}-${h}`} className="heatmap-cell" title={`${val} RON, ${cell.orders} orders, ${cell.products} products`} style={{ 
                                                background: getHeatmapColor(val), 
                                                color: getHeatmapTextColor(val),
                                                border: val === 0 ? 'var(--glass-border)' : 'none'
                                            }}>
                                                <span style={{ fontSize: '12px', fontWeight: '800' }}>{val ? `${val.toLocaleString('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} RON` : ''}</span>
                                                {cell.orders > 0 && <span style={{ fontSize: '10px', fontWeight: '600', opacity: 0.85 }}>{cell.orders} cmd. | {cell.products} prod.</span>}
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
                                const totalProducts = hours.reduce((sum, h) => sum + (cellData[`${d}-${h}`]?.products || 0), 0)
                                return (
                                    <div key={`total-${d}`} style={{ 
                                        height: '44px', background: 'var(--glass-bg-hover)', borderRadius: '6px',
                                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', marginTop: '12px',
                                        color: 'var(--text-color)', boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.05)'
                                    }}>
                                        <span style={{ fontSize: '12px', fontWeight: '900' }}>{totalDay > 0 ? `${totalDay.toLocaleString('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} RON` : ''}</span>
                                        {totalOrders > 0 && <span style={{ fontSize: '10px', fontWeight: '700', opacity: 0.7 }}>{totalOrders} cmd. | {totalProducts} prod.</span>}
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                )}
            </div>

            <div className="glass-card" id="products-table-section" style={{ scrollMarginTop: '80px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                    <h3 className="card-heading" style={{margin:0}}>{t('productSales')}</h3>
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '30px 48px minmax(180px, 2fr) 90px minmax(120px, 1.5fr) 100px 90px 120px', padding: '14px 20px', fontSize: '12px', fontWeight: '800', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        <div>#</div>
                        <div style={{ textAlign: 'center' }}>Brand</div>
                        <div>{t('topProduct')}</div>
                        <div>{t('soldPiecesHeader')}</div>
                        <div>{t('topLocationItem')}</div>
                        <div>{t('topDayItem')}</div>
                        <div>{t('platformItem')}</div>
                        <div style={{ textAlign: 'right' }}>{t('salesTotal')}</div>
                    </div>
                    {paginatedItems.map((item) => {
                        const imgUrl = getProductImage(item.name)
                        
                        const getPlatFormat = (plat) => {
                            if (plat === 'glovo') return { name: 'Glovo', color: '#facc15' }
                            if (plat === 'bolt') return { name: 'Bolt', color: '#22c55e' }
                            if (plat === 'tazz') return { name: 'Tazz', color: '#ef4444' }
                            if (plat === 'wolt') return { name: 'Wolt', color: '#3b82f6' }
                            if (plat === 'takeaway') return { name: 'Takeaway', color: '#f97316' }
                            return { name: plat.charAt(0).toUpperCase() + plat.slice(1), color: '#6366f1' } // iiko
                        }
                        const platInfo = getPlatFormat(item.bestPlat)

                        return (
                        <div key={item.id} className="list-row product-row-hover" onClick={() => navigate('/product-analytics/' + encodeURIComponent(item.name) + '?period=' + activePeriod)} style={{ display: 'grid', gridTemplateColumns: '30px 48px minmax(180px, 2fr) 90px minmax(120px, 1.5fr) 100px 90px 120px', alignItems: 'center', padding: '14px 20px', cursor: 'pointer', transition: 'all 0.15s', borderBottom: '1px solid var(--glass-border)' }} title={`Deschide Analytics: ${item.name}`}>
                            <div style={{ fontSize: '14px', fontWeight: '800', color: 'var(--text-secondary)', opacity: 0.5 }}>{item.id}</div>
                            
                            <div>
                                {item.brand?.logo_url ? (
                                    <img src={item.brand.logo_url} title={item.brand.name} alt={item.brand.name} style={{ width: 32, height: 32, borderRadius: 8, objectFit: 'contain', background: 'var(--glass-bg)', border: 'var(--glass-border)' }} />
                                ) : (
                                    <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--glass-bg-hover)' }}></div>
                                )}
                            </div>
                            
                            <div style={{ display: 'flex', alignItems: 'center' }}>
                                {imgUrl ? (
                                    <img src={imgUrl} alt={item.name} style={{ width: 36, height: 36, borderRadius: 8, objectFit: 'cover', background: 'var(--glass-bg)', marginRight: '12px', boxShadow: '0 2px 6px rgba(0,0,0,0.1)' }} />
                                ) : (
                                    <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--glass-bg)', marginRight: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', boxShadow: '0 2px 6px rgba(0,0,0,0.05)' }}><Package size={18} /></div>
                                )}
                                <div style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-color)' }}>{item.name}</div>
                            </div>
                            
                            <div style={{ fontSize: '14px', fontWeight: '800', color: 'var(--text-color)' }}>
                                {item.count} <span style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)' }}>{t('piecesShort')}</span>
                            </div>
                            
                            <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', paddingRight: '8px' }} title={item.bestLoc}>
                                {item.bestLoc.length > 20 ? item.bestLoc.substring(0, 20) + '...' : item.bestLoc}
                            </div>
                            
                            <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-color)' }}>
                                {item.bestDay}
                            </div>

                            <div style={{ fontSize: '13px', fontWeight: '800', color: platInfo.color }}>
                                {platInfo.name}
                            </div>

                            <div style={{ textAlign: 'right' }}>
                                <div style={{ fontSize: '15px', fontWeight: '900', color: 'var(--text-color)' }}>{item.revenue.toLocaleString('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span style={{ fontSize: '12px', opacity: 0.6 }}>RON</span></div>
                            </div>
                        </div>
                    )})}
                    {paginatedItems.length === 0 && <div style={{padding:'32px', textAlign:'center', color:'var(--text-secondary)'}}>{t('noProducts')}</div>}
                </div>
                
                {topItems.length > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '24px', paddingTop: '20px', borderTop: 'var(--glass-border)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)' }}>{t('rowsPerPage')}</span>
                            <select 
                                value={itemsPerPage}
                                onChange={e => { setItemsPerPage(Number(e.target.value)); setPageNumber(1); }}
                                style={{
                                    padding: '4px 8px',
                                    borderRadius: '6px',
                                    border: '1px solid var(--glass-border)',
                                    background: 'transparent',
                                    color: 'var(--text-color)',
                                    fontSize: '13px',
                                    outline: 'none',
                                    cursor: 'pointer'
                                }}
                            >
                                <option value={10} style={{ color: '#000' }}>10</option>
                                <option value={20} style={{ color: '#000' }}>20</option>
                                <option value={50} style={{ color: '#000' }}>50</option>
                                <option value={100} style={{ color: '#000' }}>100</option>
                            </select>
                        </div>

                        {totalPages > 1 && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-color)' }}>{t('pageOf').replace('{p}', pageNumber).replace('{t}', totalPages)}</span>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <button onClick={() => setPageNumber(Math.max(1, pageNumber - 1))} disabled={pageNumber === 1} className="btn-secondary" style={{padding:'8px', borderRadius:'10px'}}>&lt;</button>
                                    <button onClick={() => setPageNumber(Math.min(totalPages, pageNumber + 1))} disabled={pageNumber === totalPages} className="btn-secondary" style={{padding:'8px', borderRadius:'10px'}}>&gt;</button>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            <div className="glass-card" id="locations-table-section" style={{ scrollMarginTop: '80px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                    <h3 className="card-heading" style={{margin:0}}>{t('detailedLocationAnalysis')}</h3>
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: '40px minmax(200px, 2.5fr) minmax(200px, 2.5fr) 100px 100px 120px 120px', padding: '14px 20px', fontSize: '12px', fontWeight: '800', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    <div style={{ textAlign: 'center' }}>#</div>
                    <div>{t('brandLocationHeader')}</div>
                    <div style={{ display: 'flex', justifyContent: 'flex-start' }}>{t('topProduct')}</div>
                    <div style={{ textAlign: 'right' }}>{t('orders')}</div>
                    <div style={{ textAlign: 'right' }}>{t('products')}</div>
                    <div style={{ textAlign: 'right' }}>{t('aov')}</div>
                    <div style={{ textAlign: 'right' }}>{t('salesTotal')}</div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {(() => {
                        const locationsTotalPages = Math.ceil(allLocationData.length / locationsItemsPerPage) || 1;
                        const validPageNumber = Math.min(locationsPageNumber, locationsTotalPages);
                        const locsPaginated = allLocationData.slice((validPageNumber - 1) * locationsItemsPerPage, validPageNumber * locationsItemsPerPage);
                        const locsMaxSales = Math.max(...allLocationData.map(l => l.sales), 1);

                        return (
                            <>
                                {locsPaginated.map((loc, idx) => {
                                    const restaurantObj = activeRestaurants.find(r => r.name === loc.name);
                                    const brandObj = restaurantObj ? brands.find(b => b.id === restaurantObj.brand_id) : null;
                                    const pct = Math.min((loc.sales / locsMaxSales) * 100, 100);
                                    return (
                                        <div 
                                            key={idx} 
                                            className="product-row-hover" 
                                            style={{ display: 'grid', gridTemplateColumns: '40px minmax(200px, 2.5fr) minmax(200px, 2.5fr) 100px 100px 120px 120px', padding: '14px 20px', fontSize: '14px', alignItems: 'center', fontWeight: '600', color: 'var(--text-color)', transition: 'all 0.2s', borderBottom: '1px solid var(--glass-border)' }}
                                        >
                                            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 'bold', textAlign: 'center' }}>
                                                {((validPageNumber - 1) * locationsItemsPerPage) + idx + 1}
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', overflow: 'hidden' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                    {brandObj?.logo_url ? (
                                                        <img src={brandObj.logo_url} alt="" style={{ height: '24px', width: 'auto', objectFit: 'contain', borderRadius:'4px' }} title={brandObj.name} /> 
                                                    ) : brandObj?.name ? (
                                                        <span style={{ padding: '4px 10px', background: 'var(--glass-bg-hover)', borderRadius: '6px', fontSize: '12px', color: 'var(--text-color)' }}>{brandObj.name}</span>
                                                    ) : '-'}
                                                </div>
                                                <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', flex: 1 }}>
                                                    <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{loc.name}</span>
                                                    {restaurantObj?.city && <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '500' }}>{restaurantObj.city}</span>}
                                                    <div style={{ marginTop: '6px', height: '4px', background: 'var(--glass-border)', borderRadius: '2px', overflow: 'hidden', maxWidth: '85%' }}>
                                                        <div style={{ width: `${pct}%`, height: '100%', background: 'linear-gradient(90deg, #0d5156 0%, #10b981 100%)', borderRadius: '2px' }}></div>
                                                    </div>
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: '8px', overflow: 'hidden' }}>
                                                {loc.topProd ? (
                                                    <>
                                                        {(() => {
                                                            const validImageUrl = loc.topProd.image_url || getProductImage(loc.topProd.name);
                                                            return validImageUrl && (
                                                                <img src={validImageUrl} alt="" style={{ width: '28px', height: '28px', objectFit: 'cover', borderRadius: '4px', flexShrink: 0 }} />
                                                            );
                                                        })()}
                                                        <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', textAlign: 'left' }}>
                                                            <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '13px' }}>{loc.topProd.name}</span>
                                                            <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 'bold' }}>{loc.topProd.count} {t('piecesShort')}</span>
                                                        </div>
                                                    </>
                                                ) : <span style={{color: 'var(--text-secondary)', fontSize: '12px'}}>-</span>}
                                            </div>
                                            <div style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>
                                                {loc.orders || 0}
                                            </div>
                                            <div style={{ textAlign: 'right', color: 'var(--text-color)' }}>
                                                {loc.products || 0}
                                            </div>
                                            <div style={{ textAlign: 'right', color: '#10b981', fontWeight: '700' }}>
                                                {loc.orders > 0 ? (loc.sales / loc.orders).toLocaleString('ro-RO', {maximumFractionDigits:0}) : 0} {t('currency')}
                                            </div>
                                            <div style={{ textAlign: 'right', fontWeight: '800' }}>
                                                {(loc.sales || 0).toLocaleString('ro-RO')} {t('currency')}
                                            </div>
                                        </div>
                                    )
                                })}
                                {allLocationData.length === 0 && (
                                    <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-secondary)' }}>{t('noLocationData')}</div>
                                )}

                                {allLocationData.length > 0 && (
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '0px solid var(--glass-border)', paddingTop: '16px', marginTop: '8px', padding: '0 20px 14px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{t('rowsLabel')}</span>
                                            <select 
                                                value={locationsItemsPerPage} 
                                                onChange={e => { setLocationsItemsPerPage(Number(e.target.value)); setLocationsPageNumber(1) }}
                                                style={{
                                                    padding: '6px 10px',
                                                    background: 'var(--input-bg)',
                                                    border: 'var(--glass-border)',
                                                    borderRadius: '8px',
                                                    color: 'var(--text-color)',
                                                    fontSize: '13px',
                                                    outline: 'none',
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                <option value={10} style={{ color: '#000' }}>10</option>
                                                <option value={20} style={{ color: '#000' }}>20</option>
                                                <option value={50} style={{ color: '#000' }}>50</option>
                                            </select>
                                        </div>

                                        {locationsTotalPages > 1 && (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                                <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-color)' }}>{t('pageOf').replace('{p}', validPageNumber).replace('{t}', locationsTotalPages)}</span>
                                                <div style={{ display: 'flex', gap: '8px' }}>
                                                    <button onClick={() => setLocationsPageNumber(Math.max(1, validPageNumber - 1))} disabled={validPageNumber === 1} className="btn-secondary" style={{padding:'8px', borderRadius:'10px'}}>&lt;</button>
                                                    <button onClick={() => setLocationsPageNumber(Math.min(locationsTotalPages, validPageNumber + 1))} disabled={validPageNumber === locationsTotalPages} className="btn-secondary" style={{padding:'8px', borderRadius:'10px'}}>&gt;</button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </>
                        )
                    })()}
                </div>
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
