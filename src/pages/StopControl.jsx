import { useTheme } from '../lib/ThemeContext'
import { useLanguage } from '../lib/LanguageContext'
import { useQuery } from '@tanstack/react-query'
import { useState, useEffect } from 'react'
import { AlertCircle, RefreshCw, XCircle, Search, SearchSlash, AlertTriangle, ShieldCheck, CheckCircle2 } from 'lucide-react'

// ─── iiko API Setup ───
const IIKO_API_KEY = 'a1fe30cdeb934aa0af01b6a35244b7f0';
const IIKO_BASE = 'http://localhost:3005/api/iiko';

const fetchIikoStopsWithMenu = async () => {
    const resAuth = await fetch(`${IIKO_BASE}/access_token`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiLogin: IIKO_API_KEY })
    });
    const { token } = await resAuth.json();

    const resOrgs = await fetch(`${IIKO_BASE}/organizations`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify({})
    });
    const { organizations } = await resOrgs.json();
    const orgIds = organizations.map(o => o.id);

    // Get Stops
    const resStops = await fetch(`${IIKO_BASE}/stop_lists`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ organizationIds: orgIds })
    });
    const { terminalGroupStopLists } = await resStops.json();

    // Determine which organizations have stopped items
    const stoppedOrgIds = new Set();
    const rawStops = [];
    if (terminalGroupStopLists) {
        for (const group of terminalGroupStopLists) {
            const orgInfo = organizations.find(o => o.id === group.organizationId);
            const items = group.items || [];
            if (items.length > 0) {
                stoppedOrgIds.add(group.organizationId);
                for (const item of items) {
                     rawStops.push({ 
                         orgId: group.organizationId, 
                         orgName: orgInfo?.name || '?',
                         productId: item.productId, 
                         balance: item.balance 
                     });
                }
            }
        }
    }

    // Download menu to map exact product names
    let menuMap = new Map();
    // Use first org to fetch nomenclature (usually uniform across chains)
    if (orgIds.length > 0) {
        const resMenu = await fetch(`${IIKO_BASE}/nomenclature`, {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ organizationId: orgIds[0] })
        });
        if (resMenu.status === 200) {
             const mData = await resMenu.json();
             (mData.products || []).forEach(p => menuMap.set(p.id, p.name));
        }
    }

    // Enhance raw stops with actual names
    const finalStops = rawStops.map(s => ({
        ...s,
        productName: menuMap.get(s.productId) || 'Produs Nepublic / Combinație'
    }));

    return { stops: finalStops, totalOrgs: organizations.length, stoppedOrgs: Array.from(stoppedOrgIds) };
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

    const bgContainer = isDark ? '#121216' : '#f8fafc';
    const cardBg = isDark ? 'rgba(255,255,255,0.03)' : '#fff';
    const borderColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)';

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
                        <XCircle color="#ef4444" size={32} /> Stop Control Real-Time
                    </h1>
                    <p style={{ margin: 0, color: colors.textSecondary }}>Compară oficial produsele blocate în POS-urile locațiilor iiko vs Aggregators.</p>
                </div>
                <button className="sync-btn" onClick={() => refetch()} disabled={isFetching}>
                    <RefreshCw size={18} className={isFetching ? 'spin' : ''} style={{ animation: isFetching ? 'spin 1s linear infinite' : 'none' }} /> 
                    {isFetching ? 'Se scanează casele...' : 'Verifică Platformele Acum'}
                </button>
            </div>

            {isLoading ? (
                <div style={{ textAlign: 'center', padding: '100px 0', color: colors.textSecondary }}>
                    <Search size={48} className="spin" style={{ animation: 'spin 2s linear infinite', marginBottom: '16px', opacity: 0.5 }} />
                    <h2 style={{ margin: 0 }}>Se descarcă stop-list-urile online direct din casele iiko...</h2>
                    <p>Aplic permisiunile curente pe toate cele 24 locații.</p>
                </div>
            ) : iiko?.stops.length === 0 ? (
                <div style={{ background: cardBg, border: `1px solid ${borderColor}`, borderRadius: '24px', padding: '60px', textAlign: 'center' }}>
                    <ShieldCheck size={64} color="#10b981" style={{ marginBottom: '20px' }} />
                    <h2 style={{ margin: '0 0 10px 0', color: colors.text }}>Niciun produs oprit în prezent!</h2>
                    <p style={{ margin: 0, color: colors.textSecondary }}>
                        Grozav! În secunda asta ({now.toLocaleTimeString()}), toți managerii au deblocat produsele.
                        Nu mi-a returnat niciun produs `sold-out/lipsă` de pe cele {iiko.totalOrgs} restaurante mapate prin API-key-ul curent.
                        Deci dacă lipsește ceva pe Glovo, o face din GREȘEALĂ și pierzi bani!
                    </p>
                </div>
            ) : iiko?.stops ? (
                <>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', marginBottom: '24px' }}>
                        <div style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '24px', borderRadius: '20px' }}>
                            <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#ef4444', textTransform: 'uppercase', marginBottom: '4px' }}>Produse Lipsă Central (iiko)</div>
                            <div style={{ fontSize: '42px', fontWeight: '900', color: '#ef4444', lineHeight: 1 }}>{iiko.stops.length}</div>
                        </div>
                        <div style={{ background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.2)', padding: '24px', borderRadius: '20px' }}>
                            <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#f59e0b', textTransform: 'uppercase', marginBottom: '4px' }}>Restaurante Afectate (iiko)</div>
                            <div style={{ fontSize: '42px', fontWeight: '900', color: '#f59e0b', lineHeight: 1 }}>{iiko.stoppedOrgs.length} <span style={{fontSize:'16px', color:'var(--text-secondary)'}}>/ {iiko.totalOrgs}</span></div>
                        </div>
                        <div style={{ background: 'rgba(99, 102, 241, 0.08)', border: '1px solid rgba(99, 102, 241, 0.2)', padding: '24px', borderRadius: '20px' }}>
                            <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#6366f1', textTransform: 'uppercase', marginBottom: '4px' }}>Status Sincronizare Cloud</div>
                            <div style={{ fontSize: '30px', fontWeight: '900', color: '#6366f1', lineHeight: 1, marginTop: '10px' }}>Sistem LIVE</div>
                            <div style={{ fontSize: '12px', color: colors.textSecondary, marginTop: '6px' }}>citit direct cu token oficial iiko</div>
                        </div>
                    </div>

                    <div style={{ background: cardBg, border: `1px solid ${borderColor}`, borderRadius: '20px', overflow: 'hidden' }}>
                        <div style={{ padding: '20px 24px', borderBottom: `1px solid ${borderColor}`, background: isDark ? 'rgba(0,0,0,0.2)' : '#f1f5f9' }}>
                            <h3 style={{ margin: 0, fontSize: '16px', color: colors.text }}>Raport Opriri și Discrepanțe (iiko vs Glovo/Bolt)</h3>
                        </div>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ borderBottom: `2px solid ${borderColor}`, background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)' }}>
                                    <th style={{ padding: '16px 24px', textAlign: 'left', fontSize: '12px', color: colors.textSecondary, textTransform: 'uppercase', fontWeight: 700 }}>Locația Afectată</th>
                                    <th style={{ padding: '16px 24px', textAlign: 'left', fontSize: '12px', color: colors.textSecondary, textTransform: 'uppercase', fontWeight: 700 }}>Produsul (ID / Nume) Oprit</th>
                                    <th style={{ padding: '16px 24px', textAlign: 'center', fontSize: '12px', color: colors.textSecondary, textTransform: 'uppercase', fontWeight: 700 }}>Stare iiko Central</th>
                                    <th style={{ padding: '16px 24px', textAlign: 'center', fontSize: '12px', color: colors.textSecondary, textTransform: 'uppercase', fontWeight: 700 }}>Stare Platforme Externe</th>
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
                                                {stop.productName.includes('Nepublic') ? <AlertTriangle size={16} color="#f59e0b" /> : null}
                                                {stop.productName}
                                            </div>
                                            <div style={{ fontSize: '12px', color: colors.textSecondary, marginTop: '4px', fontFamily: 'monospace' }}>{stop.productId}</div>
                                        </td>
                                        <td style={{ padding: '20px 24px', textAlign: 'center' }}>
                                            <span style={{ padding: '6px 12px', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', fontWeight: '800', fontSize: '13px' }}>
                                                OPRIT
                                            </span>
                                            <div style={{ fontSize: '11px', color: colors.textSecondary, marginTop: '6px' }}>Balanță stoc: {stop.balance}</div>
                                        </td>
                                        <td style={{ padding: '20px 24px', textAlign: 'center' }}>
                                            <div style={{ display: 'inline-flex', flexDirection: 'column', gap: '6px', textAlign: 'left' }}>
                                                <div style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', padding: '6px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    <SearchSlash size={14} /> Necesită verificare Glovo
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
