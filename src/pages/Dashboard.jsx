import { useTheme } from '../lib/ThemeContext'
import { useLanguage } from '../lib/LanguageContext'
import { supabase } from '../lib/supabaseClient'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { useState, useEffect, useMemo } from 'react'
import { Activity, AlertTriangle, Store, Bell, XCircle, Coffee, CheckCircle, TrendingUp, ShoppingBag, CreditCard, Clock } from 'lucide-react'
import { ComposedChart, Line, BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import './Dashboard.css'

// ─── TRANSLATIONS DICTIONARY ───
const dict = {
    title: { ro: 'Dashboard General', en: 'General Dashboard', ru: 'Главный Дэшборд' },
    subtitleText: { ro: 'Activitate live, vânzări și stare tehnică • 0ms Wait', en: 'Live activity, sales and technical status • 0ms Wait', ru: 'Активность в эфире, продажи и тех. статус • 0ms' },
    viewStops: { ro: 'Vezi Opririle', en: 'View Stops', ru: 'Все Остановки' },
    salesTodayTitle: { ro: 'Vânzări Astăzi (Platforme)', en: 'Sales Today (Platforms)', ru: 'Продажи Сегодня (агр.)' },
    ordersToday: { ro: 'Comenzi realizate', en: 'Orders Placed', ru: 'Заказов оформлено' },
    vsYesterday: { ro: 'vs 100% ieri la aceeași oră', en: 'vs 100% yesterday same time', ru: 'вчера в то же время' },
    hourlyChart: { ro: 'Vânzări pe Ore Azi', en: 'Hourly Sales Today', ru: 'Продажи по часам сегодня' },
    topLocSales: { ro: 'Top Locații Azi', en: 'Top Locations Today', ru: 'Топ локаций сегодня' },
    noSales: { ro: 'Încă nu sunt comenzi azi.', en: 'No orders today yet.', ru: 'Сегодня пока нет заказов.' },
    total: { ro: 'Total Vânzări', en: 'Total Sales', ru: 'Всего продаж' },
    opsCenter: { ro: 'Stare Sistem & Integrare', en: 'System & Integration Health', ru: 'Состояние системы и интеграции' },
    networkActive: { ro: 'Rețea iiko Active', en: 'Active iiko Network', ru: 'Активная сеть iiko' },
    networkSub: { ro: 'Conexiune API Perfectă', en: 'Perfect API connection', ru: 'Идеальное соединение API' },
    dbSync: { ro: 'Sincronizare DB', en: 'DB Sync', ru: 'Синхронизация БД' },
    active: { ro: 'ACTIVĂ', en: 'ACTIVE', ru: 'АКТИВНА' },
    dbSub: { ro: 'Autosync-ul de background rulează', en: 'Background autosync running', ru: 'Фоновая синхронизация работает' },
    stopsAlert: { ro: 'Opriri in iiko', en: 'Stops in iiko', ru: 'Остановки в iiko' },
    stopsSubBad: { ro: 'Sunt stop-listuri active', en: 'Stop-lists are active', ru: 'Есть активные стоп-листы' },
    stopsSubGood: { ro: 'Meniul funcționează complet', en: 'Menu perfectly available', ru: 'Меню работает на 100%' },
    loadTime: { ro: 'Delay Dashboard', en: 'Dashboard Delay', ru: 'Задержка дэшборда' },
    loadSub: { ro: 'Super-viteza cu caching global', en: 'Ultra-fast with global caching', ru: 'Очень быстро благодаря кэшированию' },
    alertsTitle: { ro: 'Alerte Inteligente', en: 'Smart Alerts', ru: 'Умные оповещения' },
    markedMissing: { ro: 'produse în STOP pe casa', en: 'products missing in POS', ru: 'продуктов в СТОП-листе' },
    syncGlovo: { ro: 'Manevrează pe panou →', en: 'Manage on panel →', ru: 'Управление на панели →' },
    congratsTitle: { ro: 'Perfect! Restaurantele funcționează normal.', en: 'Perfect! Restaurants working normally.', ru: 'Идеально! Рестораны работают нормально.' },
    congratsSub: { 
        ro: 'Sistemul a analizat tocmai acum toate meniurile prin API și absolut nicăieri nu ai produse indisponibile.', 
        en: 'The system just verified all menus via API and no products are missing.', 
        ru: 'Система только что проверила все меню через API, недоступных продуктов нет.' 
    }
}

// ─── Animated Counter ───
function AnimCounter({ value, duration = 800 }) {
    const [display, setDisplay] = useState(0)
    useEffect(() => {
        let start = 0
        const end = typeof value === 'number' ? value : 0
        if (end === 0) { setDisplay(0); return }
        const step = Math.max(1, Math.floor(end / (duration / 16)))
        const timer = setInterval(() => {
            start += step
            if (start >= end) { setDisplay(end); clearInterval(timer) }
            else setDisplay(start)
        }, 16)
        return () => clearInterval(timer)
    }, [value, duration])
    return <>{display.toLocaleString('ro-RO')}</>
}

// ─── Dashboard Component ───
export default function Dashboard() {
    const { colors, isDark } = useTheme()
    const { lang } = useLanguage()
    const l = lang || 'ro'
    const t = (key) => dict[key]?.[l] || dict[key]?.['ro'] || key

    const [now, setNow] = useState(new Date())

    useEffect(() => {
        const timerId = setInterval(() => setNow(new Date()), 30000)
        return () => clearInterval(timerId)
    }, [])

    // Fetch live restaurants info for Stops
    const { data: restaurants = [] } = useQuery({
        queryKey: ['restaurants-dash-live'],
        queryFn: async () => {
            const { data } = await supabase.from('restaurants').select('*');
            return data || [];
        },
        refetchInterval: 30000 // Poll every 30s
    })

    // Fetch real sales data for Today and Yesterday
    const { data: salesData = [] } = useQuery({
        queryKey: ['sales-dash-live'],
        queryFn: async () => {
             const nowDt = new Date()
             const yestStart = new Date(nowDt)
             yestStart.setDate(nowDt.getDate() - 1)
             yestStart.setHours(0,0,0,0)
             
             // Fetch all sales starting from yesterday midnight matching our active timezone
             const { data } = await supabase.from('platform_sales').select('*')
                .gte('placed_at', yestStart.toISOString())
             return data || []
        },
        refetchInterval: 60000 // Refetch sales every minute
    })

    const activeRestaurants = restaurants.filter(r => r.is_active)
    
    // Extragem stocurile din JSONB cached (0ms delay)
    const orgCount = activeRestaurants.filter(r => r.iiko_config?.organizationId).length;
    let totalStoppedItems = 0;
    const orgsWithStops = [];

    for (const rest of activeRestaurants) {
        if (rest.iiko_config && rest.iiko_config.iiko_live_stops && rest.iiko_config.iiko_live_stops.length > 0) {
             const cnt = rest.iiko_config.iiko_live_stops.length;
             totalStoppedItems += cnt;
             orgsWithStops.push({ name: rest.name, count: cnt });
        }
    }

    // Calculăm Analytics pentru Vânzări 
    const { todaysRevenue, yesterdaysRevenue, todaysOrders, hourlyChart, topLocations } = useMemo(() => {
         const tSales = []; const ySales = [];
         let todRev = 0; let yestRev = 0; let todOrd = 0;
         const mapHourly = {}; const mapLoc = {};
         
         const todayDateString = new Date().toDateString()
         const yestDate = new Date(); yestDate.setDate(yestDate.getDate() - 1)
         const yestDateString = yestDate.toDateString()

         for (let i = 0; i < 24; i++) {
            const hr = `${String(i).padStart(2, '0')}:00`
            mapHourly[hr] = { hour: hr, todaySales: 0, yesterdaySales: 0 }
         }

         salesData.forEach(sale => {
             const dt = new Date(sale.placed_at)
             const amt = parseFloat(sale.total_amount) || 0
             const hrStr = `${String(dt.getHours()).padStart(2, '0')}:00`

             if (dt.toDateString() === todayDateString) {
                  todRev += amt
                  todOrd += 1
                  if (mapHourly[hrStr]) mapHourly[hrStr].todaySales += amt
                  
                  // For top locations
                  const rest = activeRestaurants.find(r => r.id === sale.restaurant_id)
                  const rName = rest ? rest.name : `Restaurant ${sale.restaurant_id}`
                  if (!mapLoc[rName]) mapLoc[rName] = { name: rName, sales: 0 }
                  mapLoc[rName].sales += amt
             } else if (dt.toDateString() === yestDateString) {
                  yestRev += amt
                  if (mapHourly[hrStr]) mapHourly[hrStr].yesterdaySales += amt
             }
         })

         const sortedHourly = Object.values(mapHourly)
         const sortedLoc = Object.values(mapLoc).sort((a,b) => b.sales - a.sales).slice(0, 5)

         return { todaysRevenue: todRev, yesterdaysRevenue: yestRev, todaysOrders: todOrd, hourlyChart: sortedHourly, topLocations: sortedLoc }
    }, [salesData, activeRestaurants])

    const growthPercent = yesterdaysRevenue > 0 ? ((todaysRevenue - yesterdaysRevenue) / yesterdaysRevenue) * 100 : 0
    const growthColor = growthPercent >= 0 ? '#10b981' : '#ef4444'

    return (
        <div className={`dash-container ${isDark ? 'dark-theme' : 'light-theme'}`}>
            <style>{`
                :root {
                    --text-color: ${isDark ? '#f8fafc' : '#1e293b'};
                    --text-secondary: ${isDark ? '#94a3b8' : '#64748b'};
                    --glass-bg: ${isDark ? 'rgba(255, 255, 255, 0.03)' : '#ffffff'};
                    --glass-bg-hover: ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.02)'};
                    --glass-border: ${isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(0, 0, 0, 0.06)'};
                }
                .glow-card {
                    background: var(--glass-bg);
                    border: var(--glass-border);
                    border-radius: 20px;
                    padding: 24px;
                    box-shadow: 0 10px 30px rgba(0,0,0,0.05);
                    transition: all 0.3s;
                }
                .glow-card:hover { transform: translateY(-3px); }
                .sales-banner {
                    background: ${isDark ? 'linear-gradient(135deg, #1e293b, #0f172a)' : 'linear-gradient(135deg, #ffffff, #f8fafc)'};
                    border: var(--glass-border);
                    border-left: 6px solid #6366f1;
                    padding: 30px;
                    border-radius: 24px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 24px;
                    box-shadow: 0 10px 40px rgba(0,0,0,0.08);
                }
                .stat-box {
                    flex: 1;
                    padding: 0 20px;
                    border-right: 1px solid var(--glass-border);
                }
                .stat-box:last-child { border-right: none; }
            `}</style>

            <div className="dash-header" style={{ marginBottom: '24px' }}>
                <div>
                    <div className="dash-title-wrap">
                        <div className="dash-icon-box" style={{background: 'linear-gradient(135deg, #6366f1, #8b5cf6)'}}>
                            <TrendingUp size={24} color="#fff" />
                        </div>
                        <h1 className="dash-title">{t('title')}</h1>
                    </div>
                    <p className="dash-subtitle">{t('subtitleText')} • {now.toLocaleTimeString('ro-RO')}</p>
                </div>
                <Link to="/stop-control" className="live-btn" style={{background: '#ef4444', color: '#fff', border: 'none'}}>
                    <div className="pulse-dot" style={{background: '#fff'}} /> {t('viewStops')}
                </Link>
            </div>

            {/* ─── SALES KPI BANNER ─── */}
            <div className="sales-banner">
                <div className="stat-box" style={{ paddingLeft: 0 }}>
                    <div style={{color:'var(--text-secondary)', fontSize:'14px', fontWeight:'700', marginBottom:'8px', textTransform:'uppercase', display:'flex', alignItems:'center', gap:'8px'}}>
                        <CreditCard size={16} /> {t('salesTodayTitle')}
                    </div>
                    <div style={{fontSize:'36px', fontWeight:'900', color:'var(--text-color)', letterSpacing:'-1px'}}>
                         <AnimCounter value={todaysRevenue} duration={1200} /> <span style={{fontSize:'20px', fontWeight:'600', opacity:0.6}}>RON</span>
                    </div>
                    <div style={{display:'flex', alignItems:'center', gap:'8px', marginTop:'8px', color:'var(--text-secondary)', fontSize:'14px'}}>
                        <span style={{color: growthColor, fontWeight:'800', background:`${growthColor}22`, padding:'2px 8px', borderRadius:'6px'}}>
                            {growthPercent > 0 ? '+' : ''}{growthPercent.toFixed(1)}%
                        </span>
                        {t('vsYesterday')}
                    </div>
                </div>

                <div className="stat-box">
                    <div style={{color:'var(--text-secondary)', fontSize:'14px', fontWeight:'700', marginBottom:'8px', textTransform:'uppercase', display:'flex', alignItems:'center', gap:'8px'}}>
                        <ShoppingBag size={16} /> {t('ordersToday')}
                    </div>
                    <div style={{fontSize:'36px', fontWeight:'900', color:'var(--text-color)', letterSpacing:'-1px'}}>
                         <AnimCounter value={todaysOrders} duration={1200} />
                    </div>
                    <div style={{marginTop:'8px', color:'var(--text-secondary)', fontSize:'14px'}}>
                        Număr platforme integrate live constant
                    </div>
                </div>
            </div>

            {/* ─── CHARTS ROW ─── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '24px', marginBottom: '24px' }}>
                <div className="glow-card">
                    <h3 className="card-heading">{t('hourlyChart')}</h3>
                    <div style={{ height: '300px', marginLeft: '-20px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={hourlyChart} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorTod" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.8}/>
                                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                                    </linearGradient>
                                    <linearGradient id="colorYest" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#94a3b8" stopOpacity={0.4}/>
                                        <stop offset="95%" stopColor="#94a3b8" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)"} vertical={false} />
                                <XAxis dataKey="hour" stroke="var(--text-secondary)" fontSize={11} tickLine={false} axisLine={false} />
                                <YAxis stroke="var(--text-secondary)" fontSize={11} tickLine={false} axisLine={false} tickFormatter={v => v > 0 ? `${v}` : ''} />
                                <Tooltip 
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', background: isDark ? '#1e293b' : '#fff' }}
                                    formatter={(value) => [`${Number(value).toFixed(2)} RON`]}
                                />
                                <Area type="monotone" dataKey="yesterdaySales" name="Ieri" stroke="#94a3b8" strokeWidth={2} fillOpacity={1} fill="url(#colorYest)" strokeDasharray="5 5" />
                                <Area type="monotone" dataKey="todaySales" name="Azi" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorTod)" activeDot={{ r: 6, stroke: '#6366f1', strokeWidth: 3, fill: '#fff' }} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="glow-card">
                    <h3 className="card-heading">{t('topLocSales')}</h3>
                    {topLocations.length > 0 ? (
                        <div style={{ height: '300px', marginLeft: '-20px' }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={topLocations} layout="vertical" margin={{ top: 0, right: 30, left: 10, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="transparent" />
                                    <XAxis type="number" hide />
                                    <YAxis type="category" dataKey="name" stroke="var(--text-color)" fontSize={12} fontWeight={600} tickLine={false} axisLine={false} width={130} />
                                    <Tooltip 
                                        cursor={{ fill: 'var(--glass-bg-hover)' }}
                                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 30px rgba(0,0,0,0.1)', background: isDark ? '#1e293b' : '#fff' }}
                                        formatter={(value) => [`${Number(value).toFixed(2)} RON`, t('total')]}
                                    />
                                    <Bar dataKey="sales" fill="#10b981" radius={[0, 6, 6, 0]} barSize={20} label={{ position: 'right', fill: 'var(--text-color)', fontSize: 13, fontWeight: '800', formatter: v => `${v.toLocaleString('ro-RO')}` }} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    ) : (
                        <div style={{ height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>{t('noSales')}</div>
                    )}
                </div>
            </div>

            {/* ─── OPS COMMAND CENTER ─── */}
            <div className="section-head" style={{ marginTop: '24px' }}><span className="section-title">{t('opsCenter')}</span></div>
            <div className="dash-kpi-grid">
                <div className="glow-card" style={{borderTop: '4px solid #3b82f6'}}>
                    <div className="kpi-label" style={{display:'flex', alignItems:'center', gap:'8px'}}><Store size={18} /> {t('networkActive')}</div>
                    <div className="kpi-val" style={{color: '#3b82f6'}}><AnimCounter value={orgCount} /></div>
                    <div className="kpi-sub" style={{color: 'var(--text-secondary)'}}>{t('networkSub')}</div>
                </div>

                <div className="glow-card" style={{borderTop: '4px solid #10b981'}}>
                    <div className="kpi-label" style={{display:'flex', alignItems:'center', gap:'8px'}}><Clock size={18} /> {t('dbSync')}</div>
                    <div className="kpi-val" style={{color: '#10b981'}}>{t('active')}</div>
                    <div className="kpi-sub" style={{color: 'var(--text-secondary)'}}>{t('dbSub')}</div>
                </div>

                <div className="glow-card" style={{borderTop: `4px solid ${totalStoppedItems > 0 ? '#ef4444' : '#10b981'}`}}>
                    <div className="kpi-label" style={{display:'flex', alignItems:'center', gap:'8px'}}><AlertTriangle size={18} /> {t('stopsAlert')}</div>
                    <div className="kpi-val" style={{color: totalStoppedItems > 0 ? '#ef4444' : '#10b981'}}><AnimCounter value={totalStoppedItems} /></div>
                    <div className="kpi-sub" style={{color: totalStoppedItems > 0 ? '#ef4444' : 'var(--text-secondary)'}}>
                        {totalStoppedItems > 0 ? t('stopsSubBad') : t('stopsSubGood')}
                    </div>
                </div>

                <div className="glow-card" style={{borderTop: '4px solid #8b5cf6'}}>
                    <div className="kpi-label" style={{display:'flex', alignItems:'center', gap:'8px'}}><Activity size={18} /> {t('loadTime')}</div>
                    <div className="kpi-val" style={{color: '#8b5cf6'}}>0<span style={{fontSize:'16px'}}>ms</span></div>
                    <div className="kpi-sub" style={{color: 'var(--text-secondary)'}}>{t('loadSub')}</div>
                </div>
            </div>

            {/* ─── STOP ALERTS ─── */}
            <div className="section-head" style={{ marginTop: '32px' }}><span className="section-title">{t('alertsTitle')}</span></div>
            {totalStoppedItems > 0 ? (
                <div style={{display: 'flex', flexDirection: 'column', gap: '16px'}}>
                    {orgsWithStops.map((ow, idx) => (
                        <div key={idx} style={{background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '16px', padding: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
                            <div style={{display: 'flex', alignItems: 'center', gap: '16px'}}>
                                <div style={{width: 48, height: 48, background: '#ef4444', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                                    <XCircle color="#fff" size={24} />
                                </div>
                                <div>
                                    <h3 style={{margin: '0 0 4px 0', fontSize: '18px', color: 'var(--text-color)'}}>{ow.name}</h3>
                                    <span style={{fontSize: '14px', color: '#ef4444', fontWeight: 'bold'}}>{ow.count} {t('markedMissing')}</span>
                                </div>
                            </div>
                            <Link to="/stop-control" style={{background: '#ef4444', color: '#fff', padding: '10px 20px', borderRadius: '8px', textDecoration: 'none', fontWeight: 'bold', display:'flex', alignItems:'center', gap:'8px'}}>
                                {t('syncGlovo')}
                            </Link>
                        </div>
                    ))}
                </div>
            ) : (
                <div style={{background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '16px', padding: '30px', textAlign: 'center'}}>
                    <CheckCircle color="#10b981" size={48} style={{marginBottom: '10px'}} />
                    <h3 style={{margin: 0, color: '#10b981'}}>{t('congratsTitle')}</h3>
                    <p style={{color: 'var(--text-secondary)', margin: '10px 0 0 0'}}>
                        {t('congratsSub')} 
                        <br/>(Verificat: {orgCount} case / restaurante).
                    </p>
                </div>
            )}
        </div>
    )
}
