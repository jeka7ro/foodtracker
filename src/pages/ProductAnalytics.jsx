import React, { useState, useMemo, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTheme } from '../lib/ThemeContext'
import { useLanguage } from '../lib/LanguageContext'
import { supabase } from '../lib/supabaseClient'
import { LineChart, Line, BarChart, Bar, ComposedChart, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, AreaChart, Area } from 'recharts'
import { ArrowLeft, Package, MapPin, TrendingUp, DollarSign, Calendar, Activity, ListOrdered, Navigation, Clock } from 'lucide-react'
import './Performance.css'

const IIKO_API_KEY = 'a1fe30cdeb934aa0af01b6a35244b7f0'

export default function ProductAnalytics() {
    const { productName } = useParams()
    const decodedName = decodeURIComponent(productName)
    const { isDark } = useTheme()
    const { lang } = useLanguage()
    const navigate = useNavigate()

    const [activePeriod, setActivePeriod] = useState('week')
    const [pageNumber, setPageNumber] = useState(1)
    const [itemsPerPage, setItemsPerPage] = useState(20)
    const [salesData, setSalesData] = useState([])
    const [restaurants, setRestaurants] = useState([])
    const [isLoading, setIsLoading] = useState(true)
    const [productImage, setProductImage] = useState(null)

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

    useEffect(() => {
        async function fetchImage() {
            try {
                const { data: rests } = await supabase.from('restaurants').select('iiko_config').not('iiko_config', 'is', null)
                if (!rests || rests.length === 0) return
                const orgId = rests.find(r => r.iiko_config?.organizationId)?.iiko_config?.organizationId
                if (!orgId) return

                const resp = await fetch(`http://localhost:3005/api/nomenclature?orgId=${orgId}`, {
                    headers: { 'x-iiko-token': IIKO_API_KEY }
                })
                if (resp.ok) {
                    const data = await resp.json()
                const cleanNameText = decodedName.split('[')[0].trim().toLowerCase();
                const excludeWords = ['sushimaster', 'sushi', 'master', 'bucuresti', 'brasov', 'constanta', 'iasi'];
                let cleanWords = cleanNameText.replace(/[^a-z0-9\s]/g, '').split(' ')
                    .filter(w => w.length > 2 && !excludeWords.includes(w));
                
                let found = null;
                const fullList = [...(data.products || []), ...(data.groups || [])];
                
                // Prioritize exact substring match first
                found = fullList.find(p => p.name?.toLowerCase().includes(cleanNameText));
                
                if (!found && cleanWords.length > 0) {
                    // Fuzzy match using important keywords
                    found = fullList.find(p => {
                        const n = p.name?.toLowerCase() || '';
                        return cleanWords.every(w => n.includes(w));
                    });
                }
                
                if (found && found.imageLinks && found.imageLinks.length > 0) {
                    setProductImage(found.imageLinks[0])
                }
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

            if (!allData || allData.length === 0) return setSalesData([])

            // Exactly match the product name
            const matchItems = allData.filter(d => {
                if (!d.items) return false
                return d.items.some(it => it.name === decodedName)
            })
            
            setSalesData(matchItems)
            setIsLoading(false)
        }
        load()
    }, [activePeriod, decodedName])

    const { rev, units, chartDynamic, chartLocations, recentTransactions } = useMemo(() => {
        let totalRev = 0
        let totalUnits = 0
        const mapDyn = {}
        const mapLoc = {}
        const transactionsList = []

        salesData.forEach(sale => {
            let pQty = 0
            sale.items.forEach(it => {
                if (it.name === decodedName) {
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
                date: new Date(sale.placed_at),
                locationName: rName,
                platform: sale.platform,
                qty: pQty,
                revenue: thisRev
            })

            const dt = new Date(sale.placed_at)
            let dk = ''
            if (activePeriod === 'today' || activePeriod === 'yesterday') {
                dk = `${String(dt.getHours()).padStart(2,'0')}:00`
            } else {
                dk = dt.toLocaleDateString('ro-RO', { day: '2-digit', month: 'short' })
            }
            if (!mapDyn[dk]) mapDyn[dk] = { name: dk, rev: 0, units: 0 }
            mapDyn[dk].rev += thisRev
            mapDyn[dk].units += pQty

            if (!mapLoc[rName]) mapLoc[rName] = { name: rName, rev: 0, units: 0 }
            mapLoc[rName].rev += thisRev
            mapLoc[rName].units += pQty
        })

        return {
            rev: totalRev,
            units: totalUnits,
            chartDynamic: Object.values(mapDyn),
            chartLocations: Object.values(mapLoc).sort((a,b)=>b.rev - a.rev),
            recentTransactions: transactionsList.sort((a,b) => b.date - a.date)
        }
    }, [salesData, activePeriod, decodedName, restaurants])

    return (
        <div className={`perf-container ${isDark ? 'dark-theme' : 'light-theme'}`} style={{ overflowY: 'auto' }}>
            <style>{`
                :root {
                    --text-color: ${isDark ? '#f8fafc' : '#1e293b'};
                    --text-secondary: ${isDark ? '#94a3b8' : '#64748b'};
                    --glass-bg: ${isDark ? 'rgba(255, 255, 255, 0.03)' : '#ffffff'};
                }
                .product-hero {
                    display: flex; gap: 20px; align-items: stretch;
                    padding: 20px; border-radius: 16px;
                    background: ${isDark ? 'rgba(17,109,116,0.1)' : 'rgba(17,109,116,0.06)'};
                    border: 1px solid ${isDark ? 'rgba(20, 184, 166, 0.2)' : 'rgba(17,109,116,0.15)'};
                    box-shadow: inset 0 2px 10px rgba(255,255,255,0.4);
                }
                .hero-tabs-card {
                    display: flex; align-items: center; padding: 20px; border-radius: 16px;
                    background: ${isDark ? 'rgba(17,109,116,0.1)' : 'rgba(17,109,116,0.06)'};
                    border: 1px solid ${isDark ? 'rgba(20, 184, 166, 0.2)' : 'rgba(17,109,116,0.15)'};
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
                    margin-bottom: 16px; padding-bottom: 12px; border-bottom: var(--glass-border);
                }
                .back-btn {
                    display: inline-flex; align-items: center; gap: 8px;
                    padding: 8px 16px; border-radius: 10px; font-size: 13px;
                    background: ${isDark ? 'rgba(255,255,255,0.05)' : '#fff'}; color: var(--text-color);
                    border: 1px solid var(--glass-border); text-decoration: none;
                    font-weight: 700; transition: all 0.2s; cursor: pointer;
                }
                .back-btn:hover { background: #0d9488; color: #fff; transform: translateY(-2px); border-color: #0d9488; }
                .tab-row {
                    display: flex; gap: 6px; flex-wrap: wrap; background: var(--glass-bg); padding: 4px; border-radius: 10px; border: var(--glass-border);
                }
                .tab-btn {
                    padding: 6px 12px; border-radius: 8px; border: none; font-size: 12px; font-weight: 700; cursor: pointer; transition: 0.2s;
                }
                .tab-btn.active { background: #0d9488; color: #fff; }
                .tab-btn:not(.active) { background: transparent; color: var(--text-secondary); }
                .tab-btn:not(.active):hover { background: var(--glass-bg-hover); color: var(--text-color); }
                
                .compact-kpi {
                    background: var(--glass-bg); border: var(--glass-border); padding: 16px; border-radius: 14px;
                }
                .compact-kpi-val { font-size: 26px; font-weight: 900; margin-top: 8px; color: var(--text-color); }

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
                        <img src={productImage} alt={decodedName} className="hero-img" />
                    ) : (
                        <div className="hero-img"><Package size={32} color="var(--text-secondary)" opacity={0.5} /></div>
                    )}
                    
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                        <div style={{ fontSize: '11px', fontWeight: '800', color: '#0d9488', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px', display:'flex', alignItems:'center', gap:'6px' }}>
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

            <div className="kpi-grid" style={{ marginBottom: '16px' }}>
                <div className="compact-kpi">
                    <div style={{display:'flex', gap:'8px', alignItems:'center', fontSize:'12px', fontWeight:'700', color:'var(--text-secondary)'}}>
                        <div style={{padding:'6px', background:'rgba(16,185,129,0.1)', borderRadius:'8px', color:'#10b981'}}><DollarSign size={16} /></div>
                        {t('totalRev')}
                    </div>
                    <div className="compact-kpi-val">{isLoading ? '...' : rev.toLocaleString('ro-RO', {minimumFractionDigits:2})} <span style={{fontSize:'14px', opacity:0.7}}>RON</span></div>
                </div>

                <div className="compact-kpi">
                    <div style={{display:'flex', gap:'8px', alignItems:'center', fontSize:'12px', fontWeight:'700', color:'var(--text-secondary)'}}>
                        <div style={{padding:'6px', background:'rgba(99,102,241,0.1)', borderRadius:'8px', color:'#6366f1'}}><Activity size={16} /></div>
                        {t('totalUnits')}
                    </div>
                    <div className="compact-kpi-val">{isLoading ? '...' : units} <span style={{fontSize:'14px', opacity:0.7}}>buc.</span></div>
                </div>

                <div className="compact-kpi">
                    <div style={{display:'flex', gap:'8px', alignItems:'center', fontSize:'12px', fontWeight:'700', color:'var(--text-secondary)'}}>
                        <div style={{padding:'6px', background:'rgba(245,158,11,0.1)', borderRadius:'8px', color:'#f59e0b'}}><TrendingUp size={16} /></div>
                        {t('avgPrice')}
                    </div>
                    <div className="compact-kpi-val">{isLoading ? '...' : units > 0 ? (rev/units).toLocaleString('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0,00'} <span style={{fontSize:'14px', opacity:0.7}}>RON</span></div>
                </div>
            </div>

            <div className="glass-card" style={{ padding: '20px', marginBottom: '16px' }}>
                <h3 className="card-heading" style={{ fontSize: '14px', marginBottom: '16px' }}>{t('chartDyn')}</h3>
                {chartDynamic.length > 0 ? (
                    <div style={{ height: '280px', marginLeft: '-15px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartDynamic} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorDyn" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.8}/>
                                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)"} vertical={false} />
                                <XAxis dataKey="name" stroke="var(--text-secondary)" fontSize={11} tickLine={false} axisLine={false} tickMargin={12} />
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
                    <div style={{ height: '280px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>{t('noData')}</div>
                )}
            </div>

            <div className="glass-card" style={{ padding: '20px' }}>
                <h3 className="card-heading" style={{ fontSize: '14px', marginBottom: '16px' }}>{t('chartLoc')}</h3>
                {chartLocations.length > 0 ? (
                    <div style={{ height: `${Math.max(280, chartLocations.length * 45)}px`, marginLeft: '-20px' }}>
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
                                <Bar dataKey="rev" fill="#10b981" radius={[0, 8, 8, 0]} barSize={26} label={{ position: 'right', fill: 'var(--text-color)', fontSize: 13, fontWeight: '800', formatter: v => `${v.toLocaleString('ro-RO')} lei` }} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                ) : (
                    <div style={{ height: '280px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>{t('noData')}</div>
                )}
            </div>

            <div className="glass-card" style={{ marginTop: '16px', padding: '20px' }}>
                <h3 className="card-heading" style={{display:'flex', alignItems:'center', gap:'8px', fontSize:'14px'}}><Navigation size={16}/> {t('recentSalesTitle')} ({recentTransactions.length})</h3>
                {recentTransactions.length > 0 ? (
                    <div>
                        <div style={{ overflowX: 'auto' }}>
                            <table className="tx-table">
                                <thead>
                                    <tr>
                                        <th>{t('colDate')}</th>
                                        <th>{t('colLocation')}</th>
                                        <th>{t('colPlatform')}</th>
                                        <th>{t('colQty')}</th>
                                        <th>{t('colRev')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {recentTransactions.slice((pageNumber - 1) * itemsPerPage, pageNumber * itemsPerPage).map((tx, idx) => (
                                        <tr key={idx}>
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
                                    ))}
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
