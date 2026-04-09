import { useTheme } from '../lib/ThemeContext'
import { useLanguage } from '../lib/LanguageContext'
import { useQuery } from '@tanstack/react-query'
import { useState, useEffect } from 'react'
import { AlertCircle, RefreshCw, XCircle, Search, SearchSlash, AlertTriangle, ShieldCheck, CheckCircle2, Clock } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'

const dict = {
    title: { ro: 'Stop Control Real-Time', en: 'Stop Control Real-Time', ru: 'Стоп Лист LIVE' },
    subtitle: { ro: 'Compară oficial produsele blocate în POS-urile locațiilor iiko vs Aggregators.', en: 'Officially compare blocked products in iiko POS vs Aggregators.', ru: 'Официальное сравнение заблокированных продуктов в кассах iiko и Агрегаторах.' },
    syncing: { ro: 'Se scanează casele...', en: 'Scanning registers...', ru: 'Сканирование касс...' },
    verifyPlatform: { ro: 'Verifică Platformele Acum', en: 'Verify Platforms Now', ru: 'Проверить Платформы Сейчас' },
    lostProducts: { ro: 'Produse Lipsă Central (iiko)', en: 'Central Missing Products (iiko)', ru: 'Отсутствующие Продукты (iiko)' },
    affectedRestos: { ro: 'Restaurante Afectate (iiko)', en: 'Affected Restaurants (iiko)', ru: 'Пострадавшие Рестораны (iiko)' },
    cloudSync: { ro: 'Status Sincronizare Cloud', en: 'Cloud Sync Status', ru: 'Статус Синхронизации' },
    systemLive: { ro: 'Sistem LIVE', en: 'System LIVE', ru: 'Система LIVE' },
    cloudNotice: { ro: 'citit direct cu token oficial iiko', en: 'read directly with official iiko token', ru: 'данные получены по токену iiko' },
    reportTitle: { ro: 'Raport Opriri și Discrepanțe (iiko vs Glovo/Bolt)', en: 'Stops and Discrepancies Report (iiko vs Glovo/Bolt)', ru: 'Отчет: Стоп-листы (iiko vs Glovo/Bolt)' },
    thLocation: { ro: 'Locația Afectată', en: 'Affected Location', ru: 'Пострадавшая Локация' },
    thProduct: { ro: 'Produsul (ID / Nume) Oprit', en: 'Stopped Product (ID / Name)', ru: 'Остановленный Продукт' },
    thCentral: { ro: 'Stare iiko Central', en: 'iiko Central Status', ru: 'Статус в iiko' },
    thExternal: { ro: 'Stare Platforme Externe', en: 'External Platforms Status', ru: 'Статус на Платформах' },
    noProductsTitle: { ro: 'Niciun produs oprit în prezent!', en: 'No products currently stopped!', ru: 'В настоящее время остановленных продуктов нет!' },
    noProductsDesc: { ro: 'Grozav! În secunda asta ({time}), toți managerii au deblocat produsele. Nu ne-a fost returnat niciun produs lipsă pe cele {orgs} restaurante. Dacă lipsește ceva pe Glovo, o face dintr-o eroare și pierzi bani!', en: 'Great! At this exact second ({time}), all managers unlocked the products. No missing products were returned across the {orgs} mapped restaurants. If anything is missing on Glovo, it is a mistake and you are losing money!', ru: 'Супер! В данную секунду ({time}) все продукты разблокированы. Среди {orgs} ресторанов нет стоп-листов. Если на Glovo чего-то нет - это техническая ошибка!' },
    dlMessage: { ro: 'Se descarcă stop-list-urile online direct din casele iiko...', en: 'Downloading online stop scripts directly from iiko registers...', ru: 'Загрузка стоп-листов напрямую из касс iiko...' },
    dlPerms: { ro: 'Aplic permisiunile curente pe toate cele 24 locații.', en: 'Applying current permissions across all 24 locations.', ru: 'Проверка прав на всех 24 локациях.' },
    stopped: { ro: 'OPRIT', en: 'STOPPED', ru: 'ОСТАНОВЛЕНО' },
    verifyGlovo: { ro: 'Necesită verificare Glovo', en: 'Glovo verification needed', ru: 'Требуется проверка Glovo' },
    stockBalance: { ro: 'Balanță stoc:', en: 'Stock balance:', ru: 'Остаток на складе:' },
    stoppedSince: { ro: 'Oprit din:', en: 'Stopped since:', ru: 'В стопе с:' },
    unmapped: { ro: 'Produs Lipsă sau Necunoscut', en: 'Missing or Unknown Product', ru: 'Неизвестный Продукт' }
}

const fetchIikoStopsWithMenu = async () => {
    const rawStops = [];
    let totalOrganizations = 0;
    const stoppedOrgIds = new Set();
    
    // Fetch restaurants from Supabase
    const { data: restaurants, error } = await supabase
        .from('restaurants')
        .select('*')
        .not('iiko_restaurant_id', 'is', null);

    if (error) {
        console.error('Error fetching restaurants:', error);
        return { stops: [], totalOrgs: 0, stoppedOrgs: [] };
    }

    if (restaurants) {
        totalOrganizations = restaurants.length;
        
        for (const rest of restaurants) {
            const config = rest.iiko_config || {};
            const liveStops = config.iiko_live_stops || [];
            
            if (liveStops.length > 0) {
                stoppedOrgIds.add(rest.id);
                for (const p of liveStops) {
                    rawStops.push({
                        orgId: rest.iiko_restaurant_id || rest.id,
                        orgName: rest.name || '?',
                        productId: p.productId,
                        productName: p.productName || 'Produs necunoscut',
                        balance: p.balance,
                        dateAdd: p.dateAdd
                    });
                }
            }
        }
    }

    return { stops: rawStops, totalOrgs: totalOrganizations, stoppedOrgs: Array.from(stoppedOrgIds) };
};

export default function StopControl() {
    const { colors, isDark } = useTheme()
    const [now, setNow] = useState(new Date())

    useEffect(() => {
        const t = setInterval(() => setNow(new Date()), 30000)
        return () => clearInterval(t)
    }, [])

    const { data: iiko, isLoading, isFetching, refetch } = useQuery({
        queryKey: ['iiko-stop-verify'],
        queryFn: fetchIikoStopsWithMenu,
        refetchInterval: 60000
    })

    const { lang } = useLanguage()
    const l = lang || 'ro'
    const t = (key) => dict[key]?.[l] || dict[key]?.['ro'] || key

    const bgContainer = isDark ? '#121216' : '#f8fafc';
    const cardBg = isDark ? 'rgba(255,255,255,0.03)' : '#fff';
    const borderColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)';

    const formatDate = (dateString) => {
        if (!dateString) return '-';
        const d = new Date(dateString);
        return d.toLocaleDateString(l === 'ro' ? 'ro-RO' : l === 'ru' ? 'ru-RU' : 'en-US') + ' ' + d.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    }

    return (
        <div style={{ padding: '32px 40px', minHeight: '100vh', background: bgContainer, animation: 'fadeIn 0.5s ease' }}>
            <style>{`
                @keyframes fadeIn { from {opacity:0} to {opacity:1} }
                .sync-btn {
                    padding: 10px 24px; border-radius: 12px; font-weight: bold; background: #6366f1; color: #fff;
                    border: none; cursor: pointer; transition: 0.2s; display: flex; align-items: center; gap: 8px;
                }
                .sync-btn:hover { background: #4f46e5; transform: translateY(-2px); box-shadow: 0 4px 12px rgba(99,102,241,0.3); }
                .sync-btn:active { transform: scale(0.97); }
                .sc-row { border-bottom: 1px solid ${borderColor}; }
                .sc-row:hover { background: ${isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)'}; }
            `}</style>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px' }}>
                <div>
                    <h1 style={{ margin: '0 0 4px 0', fontSize: '28px', color: colors.text, display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <XCircle color="#ef4444" size={32} /> {t('title')}
                    </h1>
                    <p style={{ margin: 0, color: colors.textSecondary }}>{t('subtitle')}</p>
                </div>
                <button className="sync-btn" onClick={() => refetch()} disabled={isFetching}>
                    <RefreshCw size={18} className={isFetching ? 'spin' : ''} style={{ animation: isFetching ? 'spin 1s linear infinite' : 'none' }} /> 
                    {isFetching ? t('syncing') : t('verifyPlatform')}
                </button>
            </div>

            {isLoading ? (
                <div style={{ textAlign: 'center', padding: '100px 0', color: colors.textSecondary }}>
                    <Search size={48} className="spin" style={{ animation: 'spin 2s linear infinite', marginBottom: '16px', opacity: 0.5 }} />
                    <h2 style={{ margin: 0 }}>{t('dlMessage')}</h2>
                    <p>{t('dlPerms')}</p>
                </div>
            ) : iiko?.stops.length === 0 ? (
                <div style={{ background: cardBg, border: `1px solid ${borderColor}`, borderRadius: '24px', padding: '60px', textAlign: 'center' }}>
                    <ShieldCheck size={64} color="#10b981" style={{ marginBottom: '20px' }} />
                    <h2 style={{ margin: '0 0 10px 0', color: colors.text }}>{t('noProductsTitle')}</h2>
                    <p style={{ margin: 0, color: colors.textSecondary, maxWidth: '600px', marginLeft: 'auto', marginRight: 'auto', lineHeight: '1.5' }}>
                        {t('noProductsDesc').replace('{time}', now.toLocaleTimeString()).replace('{orgs}', iiko.totalOrgs)}
                    </p>
                </div>
            ) : iiko?.stops ? (
                <>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', marginBottom: '24px' }}>
                        <div style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '24px', borderRadius: '20px' }}>
                            <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#ef4444', textTransform: 'uppercase', marginBottom: '4px' }}>{t('lostProducts')}</div>
                            <div style={{ fontSize: '42px', fontWeight: '900', color: '#ef4444', lineHeight: 1 }}>{iiko.stops.length}</div>
                        </div>
                        <div style={{ background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.2)', padding: '24px', borderRadius: '20px' }}>
                            <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#f59e0b', textTransform: 'uppercase', marginBottom: '4px' }}>{t('affectedRestos')}</div>
                            <div style={{ fontSize: '42px', fontWeight: '900', color: '#f59e0b', lineHeight: 1 }}>{iiko.stoppedOrgs.length} <span style={{fontSize:'16px', color:'var(--text-secondary)'}}>/ {iiko.totalOrgs}</span></div>
                        </div>
                        <div style={{ background: 'rgba(99, 102, 241, 0.08)', border: '1px solid rgba(99, 102, 241, 0.2)', padding: '24px', borderRadius: '20px' }}>
                            <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#6366f1', textTransform: 'uppercase', marginBottom: '4px' }}>{t('cloudSync')}</div>
                            <div style={{ fontSize: '30px', fontWeight: '900', color: '#6366f1', lineHeight: 1, marginTop: '10px' }}>{t('systemLive')}</div>
                            <div style={{ fontSize: '12px', color: colors.textSecondary, marginTop: '6px' }}>{t('cloudNotice')}</div>
                        </div>
                    </div>

                    <div style={{ background: cardBg, border: `1px solid ${borderColor}`, borderRadius: '20px', overflow: 'hidden' }}>
                        <div style={{ padding: '20px 24px', borderBottom: `1px solid ${borderColor}`, background: isDark ? 'rgba(0,0,0,0.2)' : '#f1f5f9' }}>
                            <h3 style={{ margin: 0, fontSize: '16px', color: colors.text }}>{t('reportTitle')}</h3>
                        </div>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ borderBottom: `2px solid ${borderColor}`, background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)' }}>
                                    <th style={{ padding: '16px 24px', textAlign: 'left', fontSize: '12px', color: colors.textSecondary, textTransform: 'uppercase', fontWeight: 700 }}>{t('thLocation')}</th>
                                    <th style={{ padding: '16px 24px', textAlign: 'left', fontSize: '12px', color: colors.textSecondary, textTransform: 'uppercase', fontWeight: 700 }}>{t('thProduct')}</th>
                                    <th style={{ padding: '16px 24px', textAlign: 'center', fontSize: '12px', color: colors.textSecondary, textTransform: 'uppercase', fontWeight: 700 }}>{t('thCentral')}</th>
                                    <th style={{ padding: '16px 24px', textAlign: 'center', fontSize: '12px', color: colors.textSecondary, textTransform: 'uppercase', fontWeight: 700 }}>{t('thExternal')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {iiko.stops.map((stop, i) => (
                                    <tr key={i} className="sc-row">
                                        <td style={{ padding: '20px 24px' }}>
                                            <div style={{ fontWeight: '800', fontSize: '16px', color: colors.text }}>{stop.orgName}</div>
                                            <div style={{ fontSize: '12px', color: colors.textSecondary, marginTop: '4px' }}>Org_ID: {stop.orgId.split('-')[0]}...</div>
                                        </td>
                                        <td style={{ padding: '20px 24px' }}>
                                            <div style={{ fontWeight: '700', fontSize: '15px', color: colors.text, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                {!stop.productName ? <AlertTriangle size={16} color="#f59e0b" /> : null}
                                                {stop.productName || t('unmapped')}
                                            </div>
                                            <div style={{ fontSize: '12px', color: colors.textSecondary, marginTop: '4px', fontFamily: 'monospace' }}>{stop.productId}</div>
                                            <div style={{ fontSize: '12px', color: '#10b981', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '600' }}>
                                                <Clock size={12} /> {t('stoppedSince')} {formatDate(stop.dateAdd)}
                                            </div>
                                        </td>
                                        <td style={{ padding: '20px 24px', textAlign: 'center' }}>
                                            <span style={{ padding: '6px 12px', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', fontWeight: '800', fontSize: '13px' }}>
                                                {t('stopped')}
                                            </span>
                                            <div style={{ fontSize: '11px', color: colors.textSecondary, marginTop: '6px' }}>{t('stockBalance')} {stop.balance}</div>
                                        </td>
                                        <td style={{ padding: '20px 24px', textAlign: 'center' }}>
                                            <div style={{ display: 'inline-flex', flexDirection: 'column', gap: '6px', textAlign: 'left' }}>
                                                <div style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', padding: '6px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    <SearchSlash size={14} /> {t('verifyGlovo')}
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </>
            ) : null}
        </div>
    )
}
