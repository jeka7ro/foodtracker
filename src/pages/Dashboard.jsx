import { useState, useMemo } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useQuery } from '@tanstack/react-query'
import { useTheme } from '../lib/ThemeContext'
import { useLanguage } from '../lib/LanguageContext'
import { useNavigate } from 'react-router-dom'
import { CreditCard, ShoppingBag, Activity, TrendingUp, TrendingDown, Minus, Wifi, WifiOff, RefreshCw } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend, ComposedChart, Line, LabelList } from 'recharts'
import './Performance.css'

// ── Timezone: ora României (Europe/Bucharest) ──
// Convertește un timestamp UTC în Date-ul local al României
const toRO = (isoStr) => new Date(new Date(isoStr).toLocaleString('en-US', { timeZone: 'Europe/Bucharest' }))

// Întoarce ISO string pentru miezul nopții românești (00:00:00) al unei date
const roMidnight = (year, month, day = 1) => {
    // Detectăm offset-ul curent pentru România (EEST=+3, EET=+2)
    const probe = new Date(year, month, day, 12, 0, 0)
    const roStr = probe.toLocaleString('en-US', { timeZone: 'Europe/Bucharest', hour12: false })
    const roDate = new Date(roStr)
    const offsetMs = probe.getTime() - roDate.getTime() // ms behind UTC Romanian
    // Midnight Romanian = midnight local + offset correction
    const midnight = new Date(year, month, day, 0, 0, 0)
    return new Date(midnight.getTime() + offsetMs).toISOString()
}

// Real platform colors based on actual DB values
const PC = { wolt:'#009DE0', glovo:'#FFC244', bolt:'#34D186', 'in-store':'#F59E0B', web_site:'#6366F1', app:'#8B5CF6', kiosk:'#14B8A6', eeatingh:'#EC4899', web_site_ws:'#A78BFA' }
const LOGOS = { wolt:'/logos/wolt.svg', glovo:'/logos/glovo.svg', bolt:'/logos/bolt.svg' }
const RC = ['#6366F1','#8B5CF6','#F59E0B','#10B981','#3B82F6','#EC4899','#14B8A6','#F97316']

// Show raw DB value as label — no fake translations
const pc = r => PC[r?.toLowerCase()] || PC[r] || '#94A3B8'
const pl = r => r || 'other'
const monthKey = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`

// Delivery platforms known — orice altceva e 'other'
const DELIVERY_PLATS = ['glovo','wolt','bolt','in-store']
const normPlat = raw => {
    const r = (raw || '').toLowerCase().trim()
    if (r.includes('glovo')) return 'glovo'
    if (r.includes('wolt')) return 'wolt'
    if (r.includes('bolt')) return 'bolt'
    if (!r || r === 'in-store' || r === 'instore') return 'in-store'
    return 'other' // web_site, app, kiosk, eEating, web_site_ws, etc.
}
const platLabel = (r, t) => {
    const map = { glovo:'Glovo', wolt:'Wolt', bolt:'Bolt Food', 'in-store':'In-Store', other: t ? t('Altele', 'Other', 'Другое') : 'Altele' }
    return map[r] || r || (t ? t('Altele', 'Other', 'Другое') : 'Altele')
}

function PlatLogo({ raw, size=18 }) {
    const p = raw?.toLowerCase()
    if (LOGOS[p]) return <img src={LOGOS[p]} alt={p} style={{ width:size, height:size, objectFit:'contain', borderRadius:3 }}/>
    return null
}

function Dlt({ v }) {
    if (v == null || isNaN(v)) return <span style={{ color:'#94A3B8', fontSize:12 }}>—</span>
    const color = v > 0 ? '#10B981' : v < 0 ? '#EF4444' : '#94A3B8'
    const Icon = v > 0 ? TrendingUp : v < 0 ? TrendingDown : Minus
    return <span style={{ display:'inline-flex', alignItems:'center', gap:3, fontSize:12, fontWeight:700, color }}><Icon size={12}/>{v>0?'+':''}{v.toFixed(1)}%</span>
}

function agg(rows, rests, brands, t) {
    let rev = 0, orders = 0
    const byPlat = {}, byProd = {}, byRest = {}, byBrand = {}
    rows.forEach(s => {
        const amt = parseFloat(s.total_amount) || 0
        const raw = (s.platform || 'other').toLowerCase()
        const raw2 = normPlat(s.platform)
        rev += amt; orders++
        byPlat[raw2] = byPlat[raw2] || { rev:0, orders:0 }
        byPlat[raw2].rev += amt; byPlat[raw2].orders++
        const rest = (rests || []).find(r => r.id === s.restaurant_id)
        const rName = rest?.name || (t ? t('Altă locație', 'Other location', 'Другая локация') : 'Altă locație')
        byRest[rName] = byRest[rName] || { name:rName, rev:0, orders:0 }
        byRest[rName].rev += amt; byRest[rName].orders++
        // brand breakdown
        const brand = (brands || []).find(b => b.id === rest?.brand_id)
        const bName = brand?.name || (t ? t('Altele', 'Other', 'Другие') : 'Altele')
        const bLogo = brand?.logo_url || null
        byBrand[bName] = byBrand[bName] || { name:bName, logo:bLogo, rev:0, orders:0, rests:new Set() }
        byBrand[bName].rev += amt; byBrand[bName].orders++
        if (s.restaurant_id) byBrand[bName].rests.add(s.restaurant_id)
        if (Array.isArray(s.items)) {
            s.items.forEach(it => {
                const qty = parseInt(it.quantity) || 1
                const price = parseFloat(it.sum) || 0
                const name = (it.product_name || it.productName || it.name || '').replace(/^P_/i,'').replace(/SushiMaster/ig,'').replace(/\[.*?\]/g,'').trim() || null
                if (!name) return
                byProd[name] = byProd[name] || { name, qty:0, rev:0 }
                byProd[name].qty += qty; byProd[name].rev += price * qty
            })
        }
    })
    return { rev, orders, byPlat, byProd, byRest, byBrand }
}

// Cuvinte tehnice care NU sunt produse reale
const SKIP_WORDS = ['delivery', 'livrare', 'pung', 'ambalaj', 'cutie', 'sacos', 'sacosa', 'wolt_base', 'taxa', 'tip', 'serviciu', 'bag', 'packaging']
const isRealProduct = (name) => {
    if (!name) return false
    const low = name.toLowerCase()
    return !SKIP_WORDS.some(w => low.includes(w))
}

export default function Dashboard() {
    const { isDark } = useTheme()
    const { lang } = useLanguage()
    const t = (ro, en, ru) => lang === 'ru' ? ru : (lang === 'en' ? en : ro)
    const navigate = useNavigate()
    const now = new Date()
    const [prodView, setProdView] = useState('month') // 'month' | 'alltime'

    // ── Date range selector (financiar) ──
    const getRange = (preset) => {
        const nowRO = toRO(new Date().toISOString())
        const yr = nowRO.getFullYear(), mo = nowRO.getMonth(), day = nowRO.getDate()
        const ms1d = 86400000
        // quarter start month (0,3,6,9)
        const qStart = Math.floor(mo / 3) * 3
        switch (preset) {
            case 'azi':   return { from: roMidnight(yr, mo, day), to: new Date().toISOString() }
            case 'ieri':  return { from: roMidnight(yr, mo, day - 1), to: new Date(new Date(roMidnight(yr, mo, day)).getTime() - 1000).toISOString() }
            case '7z':    return { from: roMidnight(yr, mo, day - 6), to: new Date().toISOString() }
            case 'sapt':  { const dow = nowRO.getDay() || 7; return { from: roMidnight(yr, mo, day - dow + 1), to: new Date().toISOString() } }
            case 'luna':  return { from: roMidnight(yr, mo, 1), to: new Date().toISOString() }
            case 'luna_trec': return { from: roMidnight(yr, mo - 1, 1), to: new Date(new Date(roMidnight(yr, mo, 1)).getTime() - 1000).toISOString() }
            case 'trim':  return { from: roMidnight(yr, qStart, 1), to: new Date().toISOString() }
            case 'ytd':   return { from: roMidnight(yr, 0, 1), to: new Date().toISOString() }
            default:      return { from: roMidnight(yr, mo, 1), to: new Date().toISOString() }
        }
    }
    const PRESETS = [
        { id:'azi', label: t('Azi', 'Today', 'Сегодня') },
        { id:'ieri', label: t('Ieri', 'Yesterday', 'Вчера') },
        { id:'7z', label: t('7 Zile', '7 Days', '7 Дней') },
        { id:'sapt', label: t('Săpt.', 'Week', 'Неделя') },
        { id:'luna', label: t('Luna Cur.', 'This Month', 'Тек. месяц') },
        { id:'luna_trec', label: t('Luna Trec.', 'Last Month', 'Прош. месяц') },
        { id:'trim', label: t('Trim. Cur.', 'This Qtr', 'Тек. квартал') },
        { id:'ytd', label: 'YTD' },
    ]
    const [activePreset, setActivePreset] = useState('luna')
    const [customFrom, setCustomFrom] = useState('')
    const [customTo, setCustomTo] = useState('')
    const [showCalendar, setShowCalendar] = useState(false)
    const [selectedBrand, setSelectedBrand] = useState('all')
    const [isSyncing, setIsSyncing] = useState(false)
    const [syncMessage, setSyncMessage] = useState(null)

    const dateRange = useMemo(() => {
        if (activePreset === 'custom' && customFrom && customTo) {
            return { from: new Date(customFrom).toISOString(), to: new Date(customTo + 'T23:59:59').toISOString() }
        }
        return getRange(activePreset)
    }, [activePreset, customFrom, customTo])


    // ── Poze produse din iiko Nomenclatură (via worker API) — toate serverele ──
    const { data: prodImgMap = {} } = useQuery({
        queryKey: ['dash-iiko-images-v3'],
        staleTime: 30 * 60 * 1000,
        queryFn: async () => {
            // Clear old cache key if exists
            sessionStorage.removeItem('iiko_prod_images_v2')
            const cached = sessionStorage.getItem('iiko_prod_images_v3')
            if (cached) return JSON.parse(cached)

            const { data: restsData } = await supabase
                .from('restaurants')
                .select('iiko_config, iiko_restaurant_id, brands(name)')
                .not('iiko_config', 'is', null)
            if (!restsData?.length) return {}

            // Build list of { orgId, server } pairs — one per unique org
            const seen = new Set()
            const targets = []
            for (const r of restsData) {
                const orgId = r.iiko_config?.organizationId || r.iiko_restaurant_id
                if (!orgId || seen.has(orgId)) continue
                seen.add(orgId)
                const brandName = (r.brands?.name || '').toLowerCase()
                const server = brandName.includes('smash') ? 'smashme-co.syrve.online' : 'api-eu.syrve.live'
                targets.push({ orgId, server })
            }

            const workerUrl = import.meta.env.VITE_WORKER_URL || 'http://localhost:3001'
            const map = {}

            // Fetch all orgs in parallel
            await Promise.allSettled(targets.map(async ({ orgId, server }) => {
                try {
                    const resp = await fetch(`${workerUrl}/api/nomenclature?orgId=${orgId}&server=${server}`)
                    if (!resp.ok) return
                    const data = await resp.json()
                    const allItems = [...(data.products || []), ...(data.groups || [])]
                    allItems.forEach(p => {
                        if (p.name && p.imageLinks?.length > 0 && !map[p.name.toLowerCase()]) {
                            map[p.name.toLowerCase()] = p.imageLinks[0]
                        }
                    })
                } catch(e) { /* skip this org */ }
            }))

            sessionStorage.setItem('iiko_prod_images_v3', JSON.stringify(map))
            return map
        }
    })

    // All-time top products — fetch items din toate lunile anului
    const { data: allTimeItems = [], isLoading: loadingAllTime } = useQuery({
        queryKey: ['dash-alltime-items'],
        staleTime: 10 * 60 * 1000,
        enabled: prodView === 'alltime', // fetch doar când user activează
        queryFn: async () => {
            const year = now.getFullYear()
            const from = new Date(year, 0, 1).toISOString()
            const to   = new Date().toISOString()
            // Paginare paralelă — doar câmpul items
            const { count } = await supabase.from('platform_sales')
                .select('*', { count: 'exact', head: true })
                .gte('placed_at', from).lte('placed_at', to)
            if (!count) return []
            const CHUNK = 1000, PARALLEL = 3
            const all = []
            for (let b = 0; b < Math.ceil(count / CHUNK); b += PARALLEL) {
                const batch = Array.from(
                    { length: Math.min(PARALLEL, Math.ceil(count / CHUNK) - b) },
                    (_, i) => supabase.from('platform_sales')
                        .select('items')
                        .gte('placed_at', from).lte('placed_at', to)
                        .range((b + i) * CHUNK, (b + i + 1) * CHUNK - 1)
                        .then(r => r.data || [])
                )
                const res = await Promise.all(batch)
                res.forEach(r => all.push(...r))
            }
            return all
        }
    })

    // Agregare all-time products din items
    const allTimeTopProds = useMemo(() => {
        if (!allTimeItems.length) return []
        const byProd = {}
        allTimeItems.forEach(row => {
            if (!Array.isArray(row.items)) return
            row.items.forEach(it => {
                const qty = parseInt(it.quantity) || 1
                const price = parseFloat(it.sum) || 0
                const name = (it.product_name || it.productName || it.name || '').replace(/^P_/i,'').replace(/SushiMaster/ig,'').replace(/\[.*?\]/g,'').trim() || null
                if (!name || !isRealProduct(name)) return
                byProd[name] = byProd[name] || { name, qty:0, rev:0 }
                byProd[name].qty += qty
                byProd[name].rev += price * qty
            })
        })
        return Object.values(byProd).sort((a,b) => b.qty - a.qty).slice(0, 10)
    }, [allTimeItems])

    // ── Helper paginare paralelă (refolosit în ambele query-uri) ──
    const fetchAllRows = async (from, to) => {
        const fields = 'id,placed_at,total_amount,platform,restaurant_id,items'
        const { count } = await supabase
            .from('platform_sales')
            .select('*', { count: 'exact', head: true })
            .gte('placed_at', from).lte('placed_at', to)
        if (!count) return []
        const CHUNK = 1000, PARALLEL = 3
        const all = []
        for (let b = 0; b < Math.ceil(count / CHUNK); b += PARALLEL) {
            const batch = Array.from(
                { length: Math.min(PARALLEL, Math.ceil(count / CHUNK) - b) },
                (_, i) => supabase.from('platform_sales').select(fields)
                    .gte('placed_at', from).lte('placed_at', to).order('id', { ascending: true })
                    .range((b + i) * CHUNK, (b + i + 1) * CHUNK - 1)
                    .then(r => r.data || [])
            )
            const res = await Promise.all(batch)
            res.forEach(r => all.push(...r))
        }
        return all
    }

    // ── Perioadă de comparație — aceeași durată, shiftată înapoi ──
    const compRange = useMemo(() => {
        const fromMs = new Date(dateRange.from).getTime()
        const toMs   = new Date(dateRange.to).getTime()
        const dur    = toMs - fromMs
        return {
            from: new Date(fromMs - dur).toISOString(),
            to:   new Date(fromMs - 1000).toISOString()  // chiar înaintea perioadei curente
        }
    }, [dateRange.from, dateRange.to])

    // ── Query CURENT — exact ce a selectat userul ──
    const { data: salesCur = [], isLoading } = useQuery({
        queryKey: ['dash-cur', dateRange.from, dateRange.to],
        queryFn: () => fetchAllRows(dateRange.from, dateRange.to),
        staleTime: 60000,
        refetchInterval: 60000
    })

    // ── Query COMPARAȚIE — perioada echivalentă anterioară ──
    const { data: salesComp = [] } = useQuery({
        queryKey: ['dash-comp', compRange.from, compRange.to],
        queryFn: () => fetchAllRows(compRange.from, compRange.to),
        staleTime: 60000
    })

    // Alias pentru compatibilitate cu yearlyData (care are nevoie de toate vânzările)
    const sales = salesCur

    const { data: rests = [] } = useQuery({
        queryKey: ['dash-rests'],
        queryFn: async () => { const { data } = await supabase.from('restaurants').select('id,name,city,brand_id').eq('is_active',true); return data || [] }
    })

    const triggerSync = async (days = 1) => {
        if (isSyncing) return
        setIsSyncing(true)
        setSyncMessage(t('Sincronizarea a pornit...', 'Sync started...', 'Синхронизация запущена...'))
        try {
            const workerUrl = import.meta.env.VITE_WORKER_URL || 'http://localhost:3001'
            const resp = await fetch(`${workerUrl}/api/sync-sales`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ days })
            })
            const data = await resp.json()
            if (data.success) {
                setSyncMessage(t('Sync în fundal...', 'Syncing in background...', 'Синхр. в фоне...'))
                // Keep showing message for a bit
                setTimeout(() => setSyncMessage(null), 5000)
            } else {
                setSyncMessage(data.error || 'Error')
                setTimeout(() => setSyncMessage(null), 5000)
            }
        } catch (e) {
            setSyncMessage('Error')
            setTimeout(() => setSyncMessage(null), 5000)
        } finally {
            setIsSyncing(false)
        }
    }

    const { data: brands = [] } = useQuery({
        queryKey: ['dash-brands'],
        staleTime: 10 * 60 * 1000,
        queryFn: async () => { const { data } = await supabase.from('brands').select('id,name,logo_url'); return data || [] }
    })

    // ── Freshness: ultima comandă din DB ──
    const { data: lastSale, dataUpdatedAt: lastSaleCheckedAt } = useQuery({
        queryKey: ['dash-lastsale'],
        staleTime: 60000,
        refetchInterval: 60000,
        queryFn: async () => {
            const { data } = await supabase.from('platform_sales').select('placed_at').order('placed_at', { ascending: false }).limit(1)
            return data?.[0]?.placed_at || null
        }
    })

    // ── Yearly monthly comparison ──
    // Fiecare lună e fetchuită în PARALEL (5 requesturi simultane) — corect și rapid
    const { data: yearlyData = [] } = useQuery({
        queryKey: ['dash-yearly'],
        staleTime: 15 * 60 * 1000, // 15 min — datele nu se schimbă des
        queryFn: async () => {
            const year = now.getFullYear()
            const curMonth = toRO(now.toISOString()).getMonth()
            const CHUNK = 1000

            const fetchMonth = async (m) => {
                const mFrom = new Date(year, m, 1).toISOString()
                const mTo   = new Date(year, m + 1, 0, 23, 59, 59, 999).toISOString()
                const rows = []
                let offset = 0
                while (true) {
                    const { data, error } = await supabase
                        .from('platform_sales')
                        .select('placed_at,total_amount,platform,restaurant_id')
                        .gte('placed_at', mFrom).lte('placed_at', mTo)
                        .order('placed_at', { ascending: true })
                        .range(offset, offset + CHUNK - 1)
                    if (error || !data || data.length === 0) break
                    rows.push(...data)
                    if (data.length < CHUNK) break
                    offset += CHUNK
                }
                return { month: m, rows }
            }

            const monthIndexes = Array.from({ length: curMonth + 1 }, (_, i) => i)
            const results = await Promise.all(monthIndexes.map(fetchMonth))
            return results
        }
    })

    const monthlyChart = useMemo(() => {
        if (!yearlyData.length) return []
        const MONTHS = lang === 'ru' ? ['Янв','Фев','Мар','Апр','Май','Июн','Июл','Авг','Сен','Окт','Ноя','Дек'] :
                       lang === 'en' ? ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'] :
                       ['Ian','Feb','Mar','Apr','Mai','Iun','Iul','Aug','Sep','Oct','Nov','Dec']

        // Ziua curentă în ora României (ex: 5 dacă azi e 5 Mai)
        const nowRO = toRO(now.toISOString())
        const todayDayRO = nowRO.getDate()
        const curMonthIdx = nowRO.getMonth()

        const activeRestIds = selectedBrand === 'all' ? null : new Set(rests.filter(r => r.brand_id === selectedBrand).map(r => r.id))

        return yearlyData.map((md, i) => {
            const isCurrentMonth = md.month === curMonthIdx

            // Filter rows by brand
            const fRows = activeRestIds ? md.rows.filter(r => activeRestIds.has(r.restaurant_id)) : md.rows

            // Calculăm revenue/orders pentru luna curentă (toate zilele disponibile)
            const rev = fRows.reduce((s, r) => s + (parseFloat(r.total_amount) || 0), 0)
            const orders = fRows.length

            let delta = null
            let compNote = lang === 'ru' ? 'весь месяц' : (lang === 'en' ? 'full month' : 'luna completă')

            if (i > 0) {
                const prevMd = yearlyData[i - 1]
                const prevFRows = activeRestIds ? prevMd.rows.filter(r => activeRestIds.has(r.restaurant_id)) : prevMd.rows

                if (isCurrentMonth) {
                    // Luna curentă: compară zilele 1-N cu aceleași zile 1-N din luna trecută
                    compNote = lang === 'ru' ? `дни 1-${todayDayRO}` : (lang === 'en' ? `days 1-${todayDayRO}` : `zile 1-${todayDayRO}`)
                    const prevFiltered = prevFRows.filter(r => {
                        const d = toRO(r.placed_at)
                        return d.getDate() <= todayDayRO
                    })
                    const prevRev = prevFiltered.reduce((s, r) => s + (parseFloat(r.total_amount) || 0), 0)
                    delta = prevRev > 0 ? ((rev - prevRev) / prevRev) * 100 : null
                } else {
                    // Luni complete: compară totalurile
                    const prevRev = prevFRows.reduce((s, r) => s + (parseFloat(r.total_amount) || 0), 0)
                    delta = prevRev > 0 ? ((rev - prevRev) / prevRev) * 100 : null
                }
            }

            // Breakdown pe platforme (în ora României)
            const byPlat = {}
            const byBrand = {}
            
            // Pre-fill brands cu 0 pentru a fi mereu vizibile în tooltip în toate lunile
            const visibleBrands = selectedBrand === 'all' ? brands : brands.filter(b => b.id === selectedBrand)
            visibleBrands.forEach(b => { byBrand[b.name] = 0 })
            byBrand['Altele'] = 0

            fRows.forEach(r => {
                const p = (r.platform || 'other').toLowerCase()
                const amt = parseFloat(r.total_amount) || 0
                byPlat[p] = (byPlat[p] || 0) + amt

                // Map rest -> brand
                const restObj = rests.find(x => x.id === r.restaurant_id)
                const brandObj = restObj ? brands.find(b => b.id === restObj.brand_id) : null
                const brandName = brandObj ? brandObj.name : 'Altele'
                byBrand[brandName] = (byBrand[brandName] || 0) + amt
            })
            
            // Ștergem 'Altele' dacă a rămas 0 pentru a nu polua tooltip-ul degeaba
            if (byBrand['Altele'] === 0) {
                delete byBrand['Altele']
            }

            const prevByBrand = {}
            if (i > 0) {
                const prevMd = yearlyData[i - 1]
                const prevFRows = activeRestIds ? prevMd.rows.filter(r => activeRestIds.has(r.restaurant_id)) : prevMd.rows
                
                let prevFiltered = prevFRows;
                if (isCurrentMonth) {
                    prevFiltered = prevFRows.filter(r => {
                        const d = toRO(r.placed_at)
                        return d.getDate() <= todayDayRO
                    })
                }
                
                prevFiltered.forEach(r => {
                    const amt = parseFloat(r.total_amount) || 0
                    const restObj = rests.find(x => x.id === r.restaurant_id)
                    const brandObj = restObj ? brands.find(b => b.id === restObj.brand_id) : null
                    const brandName = brandObj ? brandObj.name : 'Altele'
                    prevByBrand[brandName] = (prevByBrand[brandName] || 0) + amt
                })
            }

            const item = {
                month: MONTHS[md.month],
                rev: Math.round(rev),
                orders,
                delta,
                aov: orders > 0 ? Math.round(rev / orders) : 0,
                byPlat,
                byBrand,
                prevByBrand,
                isCurrentMonth,
                compNote
            }
            
            // Flatten brands for Recharts Bar stacking
            Object.entries(byBrand).forEach(([bName, val]) => {
                if (val > 0) {
                    item[`b_${bName}`] = Math.round(val)
                }
            })
            
            return item
        })
    }, [yearlyData, rests, brands, lang, selectedBrand])

    const an = useMemo(() => {
        // Labeluri perioadă selectată vs comparație
        const fmtPeriod = (from, to) => {
            const f = new Date(from), t = new Date(to)
            // Use timezone to extract Romanian parts accurately
            const getRO = (date) => new Date(date.toLocaleString('en-US', { timeZone: 'Europe/Bucharest' }))
            const fRO = getRO(f), tRO = getRO(t)
            const loc = lang === 'ru' ? 'ru-RU' : (lang === 'en' ? 'en-US' : 'ro-RO')
            const sameMonth = fRO.getMonth() === tRO.getMonth() && fRO.getFullYear() === tRO.getFullYear()
            if (sameMonth) return f.toLocaleString(loc, { timeZone: 'Europe/Bucharest', month: 'long', year: 'numeric' })
            const df = f.toLocaleDateString(loc, { timeZone: 'Europe/Bucharest', day:'2-digit', month:'short' })
            const dt = t.toLocaleDateString(loc, { timeZone: 'Europe/Bucharest', day:'2-digit', month:'short', year:'numeric' })
            return `${df} – ${dt}`
        }
        const pL = fmtPeriod(dateRange.from, dateRange.to)
        const sL = fmtPeriod(compRange.from, compRange.to)

        const activeRestIds = selectedBrand === 'all' ? null : new Set(rests.filter(r => r.brand_id === selectedBrand).map(r => r.id))
        const fSalesCur = activeRestIds ? salesCur.filter(s => activeRestIds.has(s.restaurant_id)) : salesCur
        const fSalesComp = activeRestIds ? salesComp.filter(s => activeRestIds.has(s.restaurant_id)) : salesComp

        const A = agg(fSalesCur, rests, brands, t)
        const B = agg(fSalesComp, rests, brands, t)

        // Today — filtrat strict în ora României
        const nowRO = toRO(new Date().toISOString())
        const curKey = monthKey(nowRO)
        const todayRows = fSalesCur.filter(s => {
            const d = toRO(s.placed_at)
            return d.getDate() === nowRO.getDate() && d.getMonth() === nowRO.getMonth() && d.getFullYear() === nowRO.getFullYear()
        })
        const T = agg(todayRows, rests, null, t)

        const delta = (a, b) => b > 0 ? ((a - b) / b) * 100 : null

        // Only show delivery platforms + grouped 'other'
        const PLAT_ORDER = ['glovo','wolt','bolt','in-store','other']
        const allPlats = new Set([...Object.keys(A.byPlat), ...Object.keys(B.byPlat)])
        const platRows = PLAT_ORDER
            .filter(raw => allPlats.has(raw))
            .map(raw => ({
                raw, label: platLabel(raw, t), color: pc(raw),
                aRev: A.byPlat[raw]?.rev || 0, aOrd: A.byPlat[raw]?.orders || 0,
                bRev: B.byPlat[raw]?.rev || 0, bOrd: B.byPlat[raw]?.orders || 0,
                dRev: delta(A.byPlat[raw]?.rev || 0, B.byPlat[raw]?.rev || 0),
                dOrd: delta(A.byPlat[raw]?.orders || 0, B.byPlat[raw]?.orders || 0),
            }))

        const pieA = platRows.filter(p => p.aRev > 0).map(p => ({ name:p.label, value:Math.round(p.aRev), color:p.color, raw:p.raw }))
        const pieB = platRows.filter(p => p.bRev > 0).map(p => ({ name:p.label, value:Math.round(p.bRev), color:p.color, raw:p.raw }))
        const pieBrands = Object.values(A.byBrand)
            .filter(b => b.rev > 0)
            .sort((a,b) => b.rev - a.rev)
            .map((b, i) => {
                const bc = { 'sushi master': '#EF4444', 'smash me': '#8B5CF6', 'we love sushi': '#F59E0B', 'ikura sushi': '#10B981' }
                return { name: b.name, value: Math.round(b.rev), color: bc[b.name.toLowerCase()] || RC[i % RC.length], logo: b.logo }
            })

        const topProds = Object.values(A.byProd)
            .filter(p => isRealProduct(p.name))
            .sort((a,b) => b.qty - a.qty).slice(0,10)
        const topRests = Object.values(A.byRest).sort((a,b) => b.rev - a.rev).slice(0,6)

        // Daily trend chart pentru perioada curentă
        const dayMap = {}
        salesCur.forEach(s => {
            const d = toRO(s.placed_at)
            const key = `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}`
            dayMap[key] = dayMap[key] || { day: key, rev:0, orders:0, _ts: d.getTime() }
            dayMap[key].rev += parseFloat(s.total_amount) || 0
            dayMap[key].orders++
        })
        const dayChart = Object.values(dayMap).sort((a,b) => a._ts - b._ts)

        const barChart = platRows.slice(0,7).map(p => ({ name: p.label, [pL]: Math.round(p.aRev), [sL]: Math.round(p.bRev) }))

        return { A, B, T, pL, sL, delta, platRows, pieA, pieB, pieBrands, topProds, topRests, dayChart, barChart, hasToday: todayRows.length > 0 }
    }, [salesCur, salesComp, rests, brands, dateRange, compRange])

    const C = (extra) => ({ background: isDark ? 'rgba(28,28,36,0.9)' : '#fff', border:`1px solid ${isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)'}`, borderRadius:20, padding:24, boxShadow: isDark ? '0 4px 24px rgba(0,0,0,0.2)' : '0 2px 16px rgba(0,0,0,0.04)', ...extra })

    const TT = ({ active, payload, label }) => {
        if (!active || !payload?.length) return null
        return <div style={{ background: isDark ? '#1a1a24' : '#fff', border:'1px solid rgba(128,128,128,0.15)', borderRadius:10, padding:'10px 14px', fontSize:12 }}>
            <div style={{ fontWeight:700, marginBottom:4 }}>{label}</div>
            {payload.map((p,i) => <div key={i} style={{ color:p.color || p.fill }}>{p.name}: {Number(p.value).toLocaleString('ro-RO')} RON</div>)}
        </div>
    }

    // ── Custom tooltip for yearly chart ──
    const YearlyTT = ({ active, payload }) => {
        if (!active || !payload?.length) return null
        const d = payload[0]?.payload
        if (!d) return null
        const platEntries = Object.entries(d.byPlat || {}).sort((a,b) => b[1]-a[1]).slice(0,4)
        const brandEntries = Object.entries(d.byBrand || {}).sort((a,b) => b[1]-a[1])
        return (
            <div style={{ background: isDark ? '#1a1a24' : '#fff', border:'1px solid rgba(128,128,128,0.15)', borderRadius:12, padding:'12px 16px', fontSize:12, minWidth:180, boxShadow:'0 8px 24px rgba(0,0,0,0.12)' }}>
                <div style={{ fontWeight:800, fontSize:14, marginBottom:8 }}>{d.month}</div>
                <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', gap:16 }}><span style={{opacity:0.6}}>{t('Venituri', 'Revenue', 'Выручка')}</span><span style={{fontWeight:700}}>{d.rev.toLocaleString('ro-RO')} RON</span></div>
                    <div style={{ display:'flex', justifyContent:'space-between', gap:16 }}><span style={{opacity:0.6}}>{t('Comenzi', 'Orders', 'Заказы')}</span><span style={{fontWeight:700}}>{d.orders.toLocaleString('ro-RO')}</span></div>
                    <div style={{ display:'flex', justifyContent:'space-between', gap:16 }}><span style={{opacity:0.6}}>AOV</span><span style={{fontWeight:700}}>{d.aov} RON</span></div>
                    {brandEntries.length > 0 && <div style={{marginTop:6, paddingTop:6, borderTop:'1px solid rgba(128,128,128,0.15)'}}>
                        {brandEntries.map(([b,v]) => {
                            const prev = d.prevByBrand?.[b] || 0;
                            const pct = prev > 0 ? ((v - prev) / prev) * 100 : null;
                            return <div key={b} style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:12,marginBottom:2}}>
                                <span style={{opacity:0.6,fontSize:11,fontWeight:500,flex:1}}>{b}</span>
                                {pct !== null && (
                                    <span style={{ fontSize:10, fontWeight:700, color: pct >= 0 ? '#10B981' : '#EF4444' }}>
                                        {pct >= 0 ? '▲' : '▼'}{Math.abs(pct).toFixed(1)}%
                                    </span>
                                )}
                                <span style={{fontSize:11,fontWeight:600}}>{Math.round(v).toLocaleString('ro-RO')} RON</span>
                            </div>
                        })}
                    </div>}
                    {platEntries.length > 0 && <div style={{marginTop:6, paddingTop:6, borderTop:'1px solid rgba(128,128,128,0.15)'}}>
                        {platEntries.map(([p,v]) => <div key={p} style={{display:'flex',justifyContent:'space-between',gap:12,marginBottom:2}}>
                            <span style={{opacity:0.6,fontSize:11}}>{p}</span><span style={{fontSize:11,fontWeight:600}}>{Math.round(v).toLocaleString('ro-RO')} RON</span>
                        </div>)}
                    </div>}
                </div>
            </div>
        )
    }

    // ── Custom bar label with delta badge ──
    const MonthDeltaLabel = ({ x, y, width, value, index }) => {
        const d = monthlyChart[index]
        if (!d || d.delta == null) return null
        const color = d.delta >= 0 ? '#10B981' : '#EF4444'
        const bg = d.delta >= 0 ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)'
        // Ajustăm Y ca să fie mereu deasupra (indiferent de înălțimea acestui segment specific)
        return (
            <g>
                <foreignObject x={x + width/2 - 28} y={y - 28} width={56} height={22}>
                    <div xmlns="http://www.w3.org/1999/xhtml" style={{fontSize:10,fontWeight:800,color,background:bg,borderRadius:6,padding:'2px 5px',textAlign:'center',whiteSpace:'nowrap'}}>
                        {d.delta >= 0 ? '▲' : '▼'} {Math.abs(d.delta).toFixed(1)}%
                    </div>
                </foreignObject>
            </g>
        )
    }

    const CustomPieLegend = (props) => {
        const { payload } = props;
        const total = payload.reduce((acc, entry) => acc + (entry.payload?.value || 0), 0)
        return (
            <ul style={{ listStyle:'none', padding:0, margin:0, display:'flex', flexDirection:'column', gap:8, justifyContent:'center', height:'100%' }}>
                {payload.map((entry, index) => {
                    const { color, payload: d } = entry;
                    const pct = total > 0 ? Math.round((d.value / total) * 100) : 0;
                    return (
                        <li key={`item-${index}`} style={{ display:'flex', alignItems:'center', gap:8, fontSize:11, fontWeight:600 }}>
                            {d.logo ? <img src={d.logo} style={{width:16,height:16,objectFit:'contain', borderRadius:4}} alt={d.name}/> : d.raw ? <PlatLogo raw={d.raw} size={16}/> : <div style={{width:8,height:8,borderRadius:'50%',backgroundColor:color}}/>}
                            <span style={{color:color}}>{d.name} <span style={{opacity:0.6, fontSize:10}}>({pct}%)</span></span>
                        </li>
                    );
                })}
            </ul>
        );
    }

    const RADIAN = Math.PI / 180;
    const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
        if (percent < 0.05) return null; // hide if < 5% to prevent overlap
        const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
        const x = cx + radius * Math.cos(-midAngle * RADIAN);
        const y = cy + radius * Math.sin(-midAngle * RADIAN);

        return (
            <text x={x} y={y} fill="#ffffff" fontSize={10} fontWeight={800} textAnchor="middle" dominantBaseline="central" style={{ pointerEvents: 'none' }}>
                {`${(percent * 100).toFixed(0)}%`}
            </text>
        );
    };

    // ── Freshness badge ──
    const FreshnessBadge = () => {
        if (!lastSale) return null
        const lastRO = toRO(lastSale)
        const nowRO = toRO(new Date().toISOString())
        const diffMs = nowRO.getTime() - lastRO.getTime()
        const diffMin = Math.round(diffMs / 60000)
        const diffH = Math.round(diffMs / 3600000)
        const isStale = diffMin > 120 // mai mult de 2 ore = posibil sync oprit
        const loc = lang === 'ru' ? 'ru-RU' : (lang === 'en' ? 'en-US' : 'ro-RO')
        const agoTxt = lang === 'ru' ? 'назад' : (lang === 'en' ? 'ago' : 'în urmă')
        const label = diffMin < 60 ? `${diffMin} min ${agoTxt}` : diffH < 24 ? `${diffH}h ${agoTxt}` : lastRO.toLocaleDateString(loc, { day:'2-digit', month:'short' })
        const lastStr = lastRO.toLocaleString(loc, { timeZone:'Europe/Bucharest', day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' })
        return (
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <div title={`Ultima comandă: ${lastStr}`}
                    style={{ display:'flex', alignItems:'center', gap:5, fontSize:11, fontWeight:700,
                        padding:'4px 10px', borderRadius:99,
                        background: isStale ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)',
                        color: isStale ? '#EF4444' : '#10B981',
                        cursor:'default' }}>
                    {isStale ? <WifiOff size={11}/> : <Wifi size={11}/>}
                    {isStale ? `${t('Sync oprit — ultima comandă acum', 'Sync stopped — last order', 'Синхр. остановлена — последний заказ')} ${label}` : `Live · ${label}`}
                </div>

                <button 
                    onClick={() => triggerSync(1)}
                    disabled={isSyncing}
                    className="sync-btn"
                    style={{ 
                        display:'flex', alignItems:'center', gap:6, 
                        padding:'5px 12px', borderRadius:99, border:'none',
                        background: isSyncing ? 'var(--glass-bg-hover)' : 'rgba(99,102,241,0.1)',
                        color: isSyncing ? 'var(--text-secondary)' : '#6366F1',
                        fontSize:11, fontWeight:800, cursor:'pointer',
                        transition:'all 0.2s ease',
                        outline:'none'
                    }}
                >
                    <RefreshCw size={12} className={isSyncing ? 'spin' : ''}/>
                    {syncMessage || t('Sincronizează', 'Sync Now', 'Синхронизировать')}
                </button>
            </div>
        )
    }

    return (
        <div className="perf-container">
            <div className="perf-header" style={{ flexDirection:'column', gap:12, alignItems:'stretch' }}>
                {/* Titlu + perioada curentă */}
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                    <div>
                        <h1 className="perf-title">{t('Dashboard KPI', 'Dashboard KPI', 'Аналитика KPI')}</h1>
                        <p className="perf-subtitle" style={{ margin:0 }}>
                            {isLoading ? t('Se încarcă…', 'Loading…', 'Загрузка…') : `${an.pL} vs ${an.sL}`}
                            {an.hasToday && !isLoading && <span style={{ marginLeft:12, background:'#6366F120', color:'#6366F1', padding:'2px 10px', borderRadius:20, fontSize:11, fontWeight:700 }}>{t('Azi', 'Today', 'Сегодня')}: {an.T.orders} {t('comenzi', 'orders', 'заказов')}</span>}
                        </p>
                    </div>
                    {/* Interval + Freshness */}
                    <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                        <FreshnessBadge/>
                        <div style={{ fontSize:12, fontWeight:700, color:'var(--text-secondary)', display:'flex', alignItems:'center', gap:6 }}>
                            <span style={{ opacity:0.5 }}>📅</span>
                            {new Date(dateRange.from).toLocaleDateString('ro-RO', { timeZone: 'Europe/Bucharest', day:'2-digit', month:'short' })}
                            {' — '}
                            {new Date(dateRange.to).toLocaleDateString('ro-RO', { timeZone: 'Europe/Bucharest', day:'2-digit', month:'short', year:'numeric' })}
                        </div>
                    </div>
                </div>

                {/* Date range selector — preset pills + custom calendar */}
                <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                    {/* Preset pills */}
                    <div style={{ display:'flex', gap:4, background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)', borderRadius:99, padding:3 }}>
                        {PRESETS.map(p => (
                            <button key={p.id} onClick={() => { setActivePreset(p.id); setShowCalendar(false) }}
                                style={{ fontSize:11, fontWeight:700, padding:'5px 13px', borderRadius:99, border:'none',
                                    background: activePreset === p.id ? '#6366F1' : 'transparent',
                                    color: activePreset === p.id ? '#fff' : (isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.4)'),
                                    cursor:'pointer', transition:'all 0.15s', whiteSpace:'nowrap' }}>
                                {p.label}
                            </button>
                        ))}
                    </div>

                    {/* Custom calendar toggle */}
                    <button onClick={() => { setShowCalendar(!showCalendar); setActivePreset('custom') }}
                        style={{ fontSize:11, fontWeight:700, padding:'5px 13px', borderRadius:99, border:`1px solid ${activePreset==='custom'?'#6366F1':'rgba(128,128,128,0.2)'}`,
                            background: activePreset === 'custom' ? 'rgba(99,102,241,0.12)' : 'transparent',
                            color: activePreset === 'custom' ? '#6366F1' : (isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.35)'),
                            cursor:'pointer', transition:'all 0.15s', display:'flex', alignItems:'center', gap:5 }}>
                        📅 {t('Personalizat', 'Custom', 'Свой')}
                    </button>

                    {/* Calendar inputs — apar când e activ */}
                    {showCalendar && (
                        <div style={{ display:'flex', alignItems:'center', gap:6, background: isDark ? 'rgba(255,255,255,0.05)' : '#fff',
                            border:`1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
                            borderRadius:12, padding:'4px 10px' }}>
                            <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
                                style={{ fontSize:12, fontWeight:600, background:'transparent', border:'none', color:'var(--text-color)', outline:'none', cursor:'pointer' }}/>
                            <span style={{ opacity:0.3, fontSize:12 }}>→</span>
                            <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
                                style={{ fontSize:12, fontWeight:600, background:'transparent', border:'none', color:'var(--text-color)', outline:'none', cursor:'pointer' }}/>
                        </div>
                    )}

                    {/* Brand Filter */}
                    <select value={selectedBrand} onChange={e => setSelectedBrand(e.target.value)} 
                        style={{ background: isDark ? 'rgba(255,255,255,0.05)' : '#fff', 
                            border:`1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`, 
                            borderRadius:99, padding:'6px 12px', fontSize:11, fontWeight:700, 
                            color:'var(--text-color)', outline:'none', cursor:'pointer' }}>
                        <option value="all">{t('Toate Brandurile', 'All Brands', 'Все Бренды')}</option>
                        {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                </div>
            </div>

            {/* 4 KPI CARDS — clickabile → /performance */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:18 }}>
                {[
                    { ic:<CreditCard size={20}/>, col:'#6366F1', bg:'rgba(99,102,241,0.1)', label:t('Venituri', 'Revenue', 'Выручка'), val:`${Math.round(an.A.rev).toLocaleString('ro-RO')} RON`, sub:`vs ${Math.round(an.B.rev).toLocaleString('ro-RO')} RON (${an.sL})`, d: an.delta(an.A.rev, an.B.rev), to:'/performance' },
                    { ic:<ShoppingBag size={20}/>, col:'#10B981', bg:'rgba(16,185,129,0.1)', label:t('Comenzi', 'Orders', 'Заказы'), val:an.A.orders.toLocaleString('ro-RO'), sub:`vs ${an.B.orders.toLocaleString('ro-RO')} (${an.sL})`, d: an.delta(an.A.orders, an.B.orders), to:'/performance' },
                    { ic:<Activity size={20}/>, col:'#F59E0B', bg:'rgba(245,158,11,0.1)', label:'AOV', val:`${an.A.orders > 0 ? (an.A.rev/an.A.orders).toFixed(1) : '—'} RON`, sub:`vs ${an.B.orders > 0 ? (an.B.rev/an.B.orders).toFixed(1) : '—'} RON (${an.sL})`, d: an.B.orders > 0 && an.A.orders > 0 ? ((an.A.rev/an.A.orders - an.B.rev/an.B.orders)/(an.B.rev/an.B.orders))*100 : null, to:'/performance' },
                    { ic:<TrendingUp size={20}/>, col:'#6366F1', bg:'rgba(99,102,241,0.1)', label:t('Azi (live)', 'Today (live)', 'Сегодня (live)'), val:`${Math.round(an.T.rev).toLocaleString('ro-RO')} RON`, sub:`${an.T.orders} ${t('comenzi', 'orders', 'заказов')}`, d:null, to:'/performance' },
                ].map((k,i) => (
                    <div key={i} onClick={() => navigate(k.to)}
                        style={C({ display:'flex', flexDirection:'column', gap:10, cursor:'pointer', transition:'transform 0.15s, box-shadow 0.15s' })}
                        onMouseEnter={e => { e.currentTarget.style.transform='translateY(-2px)'; e.currentTarget.style.boxShadow=isDark?'0 8px 32px rgba(0,0,0,0.35)':'0 8px 24px rgba(0,0,0,0.10)' }}
                        onMouseLeave={e => { e.currentTarget.style.transform=''; e.currentTarget.style.boxShadow='' }}>
                        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                            <div style={{ padding:8, background:k.bg, borderRadius:12, color:k.col }}>{k.ic}</div>
                            <span className="kpi-title" style={{ fontSize:11 }}>{k.label}</span>
                        </div>
                        <div style={{ fontSize:20, fontWeight:800, letterSpacing:'-0.5px' }}>{k.val}</div>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                            <span style={{ fontSize:11, opacity:0.5 }}>{k.sub}</span>
                            <Dlt v={k.d}/>
                        </div>
                    </div>
                ))}
            </div>

            {/* ── MONTHLY COMPARISON CHART ── */}
            {monthlyChart.length > 0 && (
                <div style={C({ })}>
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
                        <div>
                            <h3 className="card-heading" style={{ margin:0, marginBottom:4 }}>{t('Comparație Lunară', 'Monthly Comparison', 'Сравнение по месяцам')} {new Date().getFullYear()}</h3>
                            <p style={{ margin:0, fontSize:11, opacity:0.5 }}>{t('Venituri totale per lună · hover pentru detalii · linia = AOV', 'Total monthly revenue · hover for details · line = AOV', 'Общая месячная выручка · наведите для деталей · линия = AOV')}</p>
                        </div>
                        <div style={{ display:'flex', gap:16, fontSize:11 }}>
                        </div>
                    </div>
                    <div style={{ height: 280 }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart data={monthlyChart} margin={{ top:32, right:20, left:10, bottom:0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke={isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'} vertical={false}/>
                                <XAxis dataKey="month" fontSize={12} fontWeight={700} tickLine={false} axisLine={false} stroke="var(--text-secondary)"/>
                                <YAxis yAxisId="rev" fontSize={10} tickLine={false} axisLine={false} stroke="var(--text-secondary)"
                                    tickFormatter={v => v > 0 ? `${(v/1000).toFixed(0)}k` : ''} width={36}/>
                                <YAxis yAxisId="aov" orientation="right" fontSize={10} tickLine={false} axisLine={false} stroke="var(--text-secondary)"
                                    tickFormatter={v => v > 0 ? `${v}` : ''} width={40}/>
                                <Tooltip content={<YearlyTT />}/>
                                {[...brands, { id: 'altele', name: 'Altele' }].map((br, idx, arr) => {
                                    const isLast = idx === arr.length - 1
                                    const bc = { 'sushi master': '#EF4444', 'smash me': '#8B5CF6', 'we love sushi': '#F59E0B', 'ikura sushi': '#10B981' }
                                    const color = bc[(br.name || '').toLowerCase()] || RC[idx % RC.length]
                                    return (
                                        <Bar key={br.id} yAxisId="rev" dataKey={`b_${br.name}`} name={br.name} stackId="a" fill={color} maxBarSize={72} minPointSize={12}
                                            radius={isLast ? [8,8,0,0] : [0,0,0,0]}>
                                            {isLast && <LabelList dataKey="rev" content={<MonthDeltaLabel />} />}
                                        </Bar>
                                    )
                                })}
                                <Line yAxisId="aov" type="monotone" dataKey="aov" name="AOV" stroke="#F59E0B"
                                    strokeWidth={2} dot={{ fill:'#F59E0B', r:4, strokeWidth:0 }}
                                    activeDot={{ r:6 }}/>
                            </ComposedChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            )}

            {/* ── BRAND BREAKDOWN — imediat după graficul lunar ── */}
            {brands.length > 0 && Object.keys(an.A.byBrand).length > 0 && (
                <div style={{ marginBottom: 24 }}>
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
                        <h3 className="card-heading" style={{ margin:0 }}>{t('Performanță pe Branduri', 'Performance by Brand', 'Производительность по брендам')} — {an.pL}</h3>
                        <span style={{ fontSize:11, opacity:0.4 }}>vs {an.sL}</span>
                    </div>
                    <div style={{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:14 }}>
                        {brands.map((br, idx) => {
                            const col = RC[idx % RC.length]
                            const curBrand = an.A.byBrand[br.name] || { rev:0, orders:0 }
                            const prevBrand = an.B.byBrand[br.name] || { rev:0, orders:0 }
                            const d = an.delta(curBrand.rev, prevBrand.rev)
                            const aov = curBrand.orders > 0 ? curBrand.rev / curBrand.orders : 0
                            const numLocs = curBrand.rests?.size || 0
                            const avgRevPerLoc = numLocs > 0 ? Math.round(curBrand.rev / numLocs) : 0
                            const avgOrdPerLoc = numLocs > 0 ? Math.round(curBrand.orders / numLocs) : 0
                            return (
                                <div key={br.id} onClick={() => navigate(`/performance?b=${br.id}`)}
                                    style={{ background: isDark ? 'rgba(28,28,36,0.9)' : '#fff',
                                        border:`1px solid ${isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)'}`,
                                        boxShadow: isDark ? '0 4px 24px rgba(0,0,0,0.2)' : '0 2px 16px rgba(0,0,0,0.04)',
                                        borderRadius:20, padding:24,
                                        cursor:'pointer', transition:'all 0.15s' }}
                                    onMouseEnter={e => { e.currentTarget.style.borderColor=`${col}80`; e.currentTarget.style.transform='translateY(-2px)' }}
                                    onMouseLeave={e => { e.currentTarget.style.borderColor=isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)'; e.currentTarget.style.transform='' }}>
                                    <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14 }}>
                                        {br.logo_url
                                            ? <img src={br.logo_url} alt={br.name} style={{ height:28, maxWidth:80, objectFit:'contain' }}/>
                                            : <div style={{ width:32, height:32, borderRadius:10, background:`${col}20`, color:col, display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:800 }}>{br.name[0]}</div>
                                        }
                                        <div>
                                            <span style={{ fontSize:12, fontWeight:700, opacity:0.7, display:'block' }}>{br.name}</span>
                                            {numLocs > 0 && <span style={{ fontSize:10, opacity:0.5, display:'block', marginTop:1 }}>
                                                {numLocs} {t('locații', 'locations', 'локаций')} · {avgOrdPerLoc} {t('cmd', 'ord', 'зак')}/{t('loc', 'loc', 'лок')} · {avgRevPerLoc.toLocaleString('ro-RO')} RON/{t('loc', 'loc', 'лок')}
                                            </span>}
                                        </div>
                                    </div>
                                    <div style={{ fontSize:22, fontWeight:800, letterSpacing:'-0.5px', color:col, marginBottom:4 }}>
                                        {Math.round(curBrand.rev).toLocaleString('ro-RO')} RON
                                    </div>
                                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
                                        <span style={{ fontSize:11, opacity:0.5 }}>{curBrand.orders} {t('comenzi', 'orders', 'заказов')} · AOV {Math.round(aov)} RON</span>
                                        <Dlt v={d}/>
                                    </div>
                                    <div style={{ fontSize:10, opacity:0.4 }}>vs {Math.round(prevBrand.rev).toLocaleString('ro-RO')} RON ({an.sL})</div>
                                    <div style={{ height:3, borderRadius:99, background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)', marginTop:10 }}>
                                        <div style={{ height:'100%', borderRadius:99, background:col,
                                            width:`${Math.min(100, an.A.rev > 0 ? (curBrand.rev/an.A.rev)*100 : 0)}%`,
                                            transition:'width 0.5s' }}/>
                                    </div>
                                    <div style={{ fontSize:10, opacity:0.4, marginTop:4, textAlign:'right' }}>
                                        {an.A.rev > 0 ? ((curBrand.rev/an.A.rev)*100).toFixed(1) : 0}% {t('din total', 'of total', 'от общего')}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}



            {/* DAILY TREND + PLATFORM BAR */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:18 }}>
                <div style={C({})}>
                    <h3 className="card-heading">{t('Trend Zilnic', 'Daily Trend', 'Ежедневный тренд')} — {an.pL}</h3>
                    {an.dayChart.length === 0 ? <div style={{ height:200, display:'flex', alignItems:'center', justifyContent:'center', opacity:0.4, fontSize:13 }}>{t('Fără date', 'No data', 'Нет данных')}</div> :
                    <div style={{ height:220 }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={an.dayChart} margin={{ top:4, right:4, left:0, bottom:30 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke={isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'} vertical={false}/>
                                <XAxis dataKey="day" fontSize={8} tickLine={false} axisLine={false} stroke="var(--text-secondary)"
                                    angle={-45} textAnchor="end" height={40} interval={an.dayChart.length > 14 ? Math.floor(an.dayChart.length / 10) : 0}/>
                                <YAxis fontSize={9} tickLine={false} axisLine={false} stroke="var(--text-secondary)" tickFormatter={v => v>0?`${(v/1000).toFixed(0)}k`:''} width={28}/>
                                <Tooltip content={<TT/>}/>
                                <Bar dataKey="rev" name="Vânzări" radius={[4,4,0,0]} maxBarSize={32}>
                                    {an.dayChart.map((_,i) => <Cell key={i} fill={isDark ? 'rgba(99,102,241,0.65)' : '#6366F1'}/>)}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>}
                </div>

                <div style={C({})}>
                    <h3 className="card-heading">{t('Platforme Comparative', 'Platforms Comparison', 'Сравнение платформ')}</h3>
                    {an.barChart.length === 0 ? <div style={{ height:200, display:'flex', alignItems:'center', justifyContent:'center', opacity:0.4, fontSize:13 }}>{t('Fără date', 'No data', 'Нет данных')}</div> :
                    <div style={{ height:200 }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={an.barChart} margin={{ top:4, right:4, left:0, bottom:0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke={isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'} vertical={false}/>
                                <XAxis dataKey="name" fontSize={9} tickLine={false} axisLine={false} stroke="var(--text-secondary)"/>
                                <YAxis fontSize={9} tickLine={false} axisLine={false} stroke="var(--text-secondary)" tickFormatter={v => v>0?`${(v/1000).toFixed(0)}k`:''} width={28}/>
                                <Tooltip content={<TT/>}/>
                                <Bar dataKey={an.pL} fill="#6366F1" radius={[4,4,0,0]}/>
                                <Bar dataKey={an.sL} fill={isDark ? 'rgba(99,102,241,0.25)' : 'rgba(99,102,241,0.18)'} radius={[4,4,0,0]}/>
                                <Legend iconType="circle" iconSize={8} formatter={v => <span style={{ fontSize:11, fontWeight:600 }}>{v}</span>}/>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>}
                </div>
            </div>

            {/* TOP PRODUSE PE BRANDURI */}
            {brands.length > 0 && (
                <div style={{ marginBottom:24 }}>
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
                        <h3 className="card-heading" style={{ margin:0 }}>{t('Top Produse pe Branduri', 'Top Products by Brand', 'Лучшие продукты по брендам')} — {an.pL}</h3>
                        <div style={{ display:'flex', gap:4, background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)', borderRadius:99, padding:3 }}>
                            {[['month', t('Perioadă', 'Period', 'Период')], ['alltime', '2026']].map(([key, lbl]) => (
                                <button key={key} onClick={() => setProdView(key)}
                                    style={{ fontSize:11, fontWeight:700, padding:'4px 12px', borderRadius:99, border:'none',
                                        background: prodView === key ? '#6366F1' : 'transparent',
                                        color: prodView === key ? '#fff' : (isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.4)'),
                                        cursor:'pointer', transition:'all 0.15s' }}>
                                    {lbl}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(260px, 1fr))', gap:16 }}>
                        {brands.map((br, bIdx) => {
                            const col = RC[bIdx % RC.length]
                            const brandRests = rests.filter(r => r.brand_id === br.id).map(r => r.id)
                            const brandRows = salesCur.filter(s => brandRests.includes(s.restaurant_id))
                            const prodMap = {}
                            brandRows.forEach(s => {
                                if (!Array.isArray(s.items)) return
                                s.items.forEach(it => {
                                    const name = (it.product_name || '').replace(/^(P_|I_|W_)/i,'').replace(/SushiMaster/ig,'').replace(/\[.*?\]/g,'').trim()
                                    if (!name || !isRealProduct(name)) return
                                    prodMap[name] = prodMap[name] || { name, qty:0, rev:0 }
                                    prodMap[name].qty += parseInt(it.quantity) || 1
                                    prodMap[name].rev += parseFloat(it.sum) || 0
                                })
                            })
                            const topProds = Object.values(prodMap).sort((a,b) => b.qty - a.qty).slice(0, 5)
                            const maxQty = topProds[0]?.qty || 1
                            return (
                                <div key={br.id} style={C({})}>
                                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16, paddingBottom:12, borderBottom:`1px dashed ${col}40` }}>
                                        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                                            {br.logo_url && (
                                                <img src={br.logo_url} alt={br.name} style={{ height:24, maxWidth:80, objectFit:'contain' }}/>
                                            )}
                                            <span style={{ fontSize:13, fontWeight:800, marginLeft: br.logo_url ? 8 : 0 }}>{br.name}</span>
                                        </div>
                                        <span style={{ fontSize:10, opacity:0.4, fontWeight:700 }}>{brandRows.length} cmd</span>
                                    </div>
                                    {topProds.length === 0
                                        ? <div style={{ fontSize:11, opacity:0.3, padding:'8px 0' }}>Fără date</div>
                                        : topProds.map((p, i) => {
                                            const cleanForImg = p.name.replace(/^(I_|W_|P_)/i,'').replace(/SushiMaster/ig,'').trim().toLowerCase()
                                            const imgUrl = prodImgMap[cleanForImg] || prodImgMap[p.name.toLowerCase()] ||
                                                Object.entries(prodImgMap).find(([k]) => k.includes(cleanForImg) || cleanForImg.includes(k))?.[1] || null
                                            return (
                                                <div key={p.name} onClick={() => navigate(`/product-analytics/${encodeURIComponent(p.name)}`)}
                                                    style={{ display:'flex', alignItems:'center', gap:8, padding:'5px 0',
                                                        borderBottom: i < topProds.length-1 ? `1px solid ${isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}` : 'none',
                                                        cursor:'pointer' }}
                                                    onMouseEnter={e => e.currentTarget.style.opacity='0.7'}
                                                    onMouseLeave={e => e.currentTarget.style.opacity='1'}>
                                                    {imgUrl
                                                        ? <img src={`http://localhost:3001/api/img?url=${encodeURIComponent(imgUrl)}`}
                                                            alt={p.name}
                                                            style={{ width:32, height:32, borderRadius:8, objectFit:'cover', flexShrink:0, border:`1px solid ${col}30` }}
                                                            onError={e => { e.target.style.display='none' }}
                                                          />
                                                        : <div style={{ width:18, height:18, borderRadius:6, background:`${col}20`, color:col, display:'flex', alignItems:'center', justifyContent:'center', fontSize:9, fontWeight:800, flexShrink:0 }}>{i+1}</div>
                                                    }
                                                    <div style={{ flex:1, minWidth:0 }}>
                                                        <div style={{ fontSize:11, fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.name}</div>
                                                        <div style={{ height:2, borderRadius:99, background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)', marginTop:3 }}>
                                                            <div style={{ height:'100%', width:`${(p.qty/maxQty)*100}%`, background:col, borderRadius:99 }}/>
                                                        </div>
                                                    </div>
                                                    <div style={{ fontSize:11, fontWeight:800, color:col, flexShrink:0 }}>×{p.qty}</div>
                                                </div>
                                            )
                                        })
                                    }
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}

            {/* TOP LOCAȚII — grid 2 coloane */}
            <div style={C({})}>
                <h3 className="card-heading">{t('Top Locații', 'Top Locations', 'Лучшие локации')} — {an.pL}</h3>
                {an.topRests.length === 0 ? <div style={{ opacity:0.4, fontSize:13 }}>{t('Fără date', 'No data', 'Нет данных')}</div> :
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0 32px' }}>
                {an.topRests.map((item, i) => {
                    const col = RC[i % RC.length]
                    const max = an.topRests[0]?.rev || 1
                    const pct = (item.rev / max) * 100
                    return (
                        <div key={item.name || i} onClick={() => navigate(`/performance?restaurant=${encodeURIComponent(item.name)}`)}
                            style={{ display:'grid', gridTemplateColumns:'26px 1fr 110px', alignItems:'center', padding:'9px 4px', gap:8,
                                borderBottom:`1px solid ${isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}`,
                                cursor:'pointer', borderRadius:8, transition:'background 0.12s' }}
                            onMouseEnter={e => e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)'}
                            onMouseLeave={e => e.currentTarget.style.background = ''}>
                            <div style={{ width:22, height:22, borderRadius:8, background:`${col}20`, color:col, display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:800 }}>{i+1}</div>
                            <div>
                                <div style={{ fontSize:12, fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', marginBottom:3 }}>{item.name}</div>
                                <div style={{ height:3, borderRadius:99, background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }}>
                                    <div style={{ height:'100%', width:`${pct}%`, background:col, borderRadius:99 }}/>
                                </div>
                            </div>
                            <div style={{ textAlign:'right' }}>
                                <div style={{ fontSize:12, fontWeight:800, color:col }}>{Math.round(item.rev).toLocaleString('ro-RO')} RON</div>
                                <div style={{ fontSize:10, opacity:0.5 }}>{item.orders} {t('cmd', 'ord', 'зак')}</div>
                            </div>
                        </div>
                    )
                })}
                </div>}
            </div>

            {/* TABEL PLATFORME — la final */}
            <div style={C({})}>
                <h3 className="card-heading">{t('Tabel Platforme', 'Platforms Table', 'Таблица платформ')} — {an.pL} vs {an.sL}</h3>
                <div style={{ overflowX:'auto' }}>
                    <table style={{ width:'100%', borderCollapse:'collapse' }}>
                        <thead>
                            <tr style={{ borderBottom:`1px solid ${isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)'}` }}>
                                {[
                                    { key: 'Platformă', label: t('Platformă', 'Platform', 'Платформа') },
                                    { key: 'Vânzări', label: t('Vânzări', 'Revenue', 'Выручка') },
                                    { key: 'PrevRev', label: t('Prev.', 'Prev.', 'Пред.') },
                                    { key: 'DRev', label: `Δ ${t('Rev', 'Rev', 'Выр')}` },
                                    { key: 'Comenzi', label: t('Comenzi', 'Orders', 'Заказы') },
                                    { key: 'PrevOrd', label: t('Prev.', 'Prev.', 'Пред.') },
                                    { key: 'DCmd', label: `Δ ${t('Cmd', 'Ord', 'Зак')}` },
                                    { key: 'AOV', label: 'AOV' }
                                ].map(h => (
                                    <th key={h.key} style={{ padding:'10px 12px', fontSize:11, fontWeight:700, opacity:0.5, textTransform:'uppercase', letterSpacing:'0.4px', textAlign:h.key==='Platformă'?'left':'right', whiteSpace:'nowrap' }}>{h.label}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {an.platRows.map((p,i) => (
                                <tr key={p.raw}
                                    style={{ borderBottom: i < an.platRows.length-1 ? `1px solid ${isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)'}` : 'none', transition:'background 0.12s' }}
                                    onMouseEnter={e => e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)'}
                                    onMouseLeave={e => e.currentTarget.style.background = ''}>
                                    <td style={{ padding:'12px 12px' }}><div style={{ display:'flex', alignItems:'center', gap:8 }}><PlatLogo raw={p.raw} size={16}/><span style={{ fontWeight:700, fontSize:13 }}>{p.label}</span></div></td>
                                    <td style={{ padding:'12px 12px', textAlign:'right', fontWeight:800, fontSize:13 }}>{Math.round(p.aRev).toLocaleString('ro-RO')} RON</td>
                                    <td style={{ padding:'12px 12px', textAlign:'right', fontSize:12, opacity:0.6 }}>{Math.round(p.bRev).toLocaleString('ro-RO')} RON</td>
                                    <td style={{ padding:'12px 12px', textAlign:'right' }}><Dlt v={p.dRev}/></td>
                                    <td style={{ padding:'12px 12px', textAlign:'right', fontWeight:700 }}>{p.aOrd}</td>
                                    <td style={{ padding:'12px 12px', textAlign:'right', fontSize:12, opacity:0.6 }}>{p.bOrd}</td>
                                    <td style={{ padding:'12px 12px', textAlign:'right' }}><Dlt v={p.dOrd}/></td>
                                    <td style={{ padding:'12px 12px', textAlign:'right', fontSize:12, fontWeight:600 }}>{p.aOrd > 0 ? (p.aRev/p.aOrd).toFixed(1) : '—'} RON</td>
                                </tr>
                            ))}
                            {an.platRows.length === 0 && <tr><td colSpan="8" style={{ textAlign:'center', padding:28, opacity:0.4 }}>Fără date</td></tr>}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>

    )
}
