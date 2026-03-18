import { useState, useCallback, useEffect } from 'react'
import { useTheme } from '../lib/ThemeContext'
import { useLanguage } from '../lib/LanguageContext'
import { supabase } from '../lib/supabaseClient'

/* eslint-disable */
function getWorkerUrl() { try { return (new Function('return import.meta.env.VITE_WORKER_URL'))() || 'http://localhost:3001' } catch(_) { return 'http://localhost:3001' } }
const WORKER_URL = getWorkerUrl()
const PLAT_COLORS = { wolt: '#009de0', glovo: '#FFC244', bolt: '#34D186' }

function glass(dk) {
    return { background: dk ? 'rgba(30,32,40,0.65)' : '#fff', backdropFilter: dk ? 'blur(24px) saturate(180%)' : 'none', WebkitBackdropFilter: dk ? 'blur(24px) saturate(180%)' : 'none', borderRadius: '20px', border: dk ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.08)', boxShadow: dk ? '0 8px 32px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)' : '0 2px 12px rgba(0,0,0,0.08)' }
}
function inner(dk) {
    return { background: dk ? 'rgba(40,42,54,0.45)' : 'rgba(0,0,0,0.03)', borderRadius: '16px', border: dk ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(0,0,0,0.06)' }
}

function PlatformBadge({ platform, size = 18 }) {
    const logos = { glovo: 'https://upload.wikimedia.org/wikipedia/commons/7/78/Current_Logo_Glovo.jpg', wolt: 'https://brandlogos.net/wp-content/uploads/2025/05/wolt-logo_brandlogos.net_dijtc.png', bolt: 'https://media.voog.com/0000/0039/0361/photos/Bolt.png' }
    return <img src={logos[platform] || ''} alt={platform} style={{ width: size, height: size, objectFit: 'contain', borderRadius: '4px', background: 'white' }} onError={e => { e.currentTarget.style.display = 'none' }} />
}

export default function StopVerificare() {
    const { lang } = useLanguage()
    const { colors, isDark } = useTheme()
    const g = glass(isDark)
    const inn = inner(isDark)

    const [productStopped, setProductStopped] = useState({})
    const [scanning, setScanning] = useState(false)
    const [scanMsg, setScanMsg] = useState(null)
    const [scanned, setScanned] = useState(false)
    const [expandedRest, setExpandedRest] = useState({})
    const [lastCheckDate, setLastCheckDate] = useState(null)

    // Load scan rules
    const [rules, setRules] = useState([])
    useEffect(() => {
        supabase.from('stop_scan_rules').select('*').eq('is_active', true).order('created_at', { ascending: false })
            .then(({ data }) => setRules(data || []))
    }, [])

    // Auto-load last saved result on mount
    useEffect(() => {
        supabase.from('product_stop_history')
            .select('*').order('check_date', { ascending: false }).limit(1)
            .then(({ data }) => {
                if (data?.[0]) {
                    const h = data[0]
                    setProductStopped(h.results || {})
                    setLastCheckDate(h.check_date)
                    setScanMsg({
                        ok: h.missing_count === 0,
                        text: h.missing_count === 0
                            ? `✅ Toate produsele disponibile — ultima verificare: ${h.check_date}`
                            : `${h.missing_count} produse lipsă în ${h.restaurant_count} restaurante — ultima verificare: ${h.check_date}`
                    })
                    setScanned(true)
                }
            })
    }, [])

    const scanAndCompare = useCallback(async () => {
        setScanning(true)
        setScanMsg(null)
        try {
            try { await fetch(`${WORKER_URL}/api/own-brands/scrape-all`, { method: 'POST' }) } catch (_) {}
            const today = new Date().toISOString().split('T')[0]
            const { data: latestRef } = await supabase.from('own_product_snapshots')
                .select('snapshot_date').lt('snapshot_date', today)
                .order('snapshot_date', { ascending: false }).limit(1)
            const refDate = latestRef?.[0]?.snapshot_date
            if (!refDate) {
                setScanMsg({ ok: false, text: 'Nu exista scanare anterioara de referinta.' })
                setScanned(true); return
            }
            const [{ data: refData }, { data: todayData }, { data: restaurants }] = await Promise.all([
                supabase.from('own_product_snapshots').select('restaurant_id, platform, product_name, category, price').eq('snapshot_date', refDate),
                supabase.from('own_product_snapshots').select('restaurant_id, platform, product_name').eq('snapshot_date', today),
                supabase.from('restaurants').select('id, name, city, brands(name, logo_url)').eq('is_active', true)
            ])
            const todayKeys = new Set((todayData || []).map(p => `${p.restaurant_id}|${p.platform}|${p.product_name}`))
            const restMap = {}
            ;(restaurants || []).forEach(r => { restMap[r.id] = r })
            const missing = (refData || []).filter(p => !todayKeys.has(`${p.restaurant_id}|${p.platform}|${p.product_name}`))
            const grouped = {}
            missing.forEach(p => {
                const rid = p.restaurant_id
                const rest = restMap[rid]
                if (!grouped[rid]) grouped[rid] = { name: rest?.name || rid, city: rest?.city || '', logo: rest?.brands?.logo_url, byPlatform: {} }
                if (!grouped[rid].byPlatform[p.platform]) grouped[rid].byPlatform[p.platform] = []
                grouped[rid].byPlatform[p.platform].push({ name: p.product_name, category: p.category, price: p.price })
            })
            setProductStopped(grouped)
            setLastCheckDate(today)
            setScanMsg({ ok: missing.length === 0, text: missing.length === 0
                ? `Toate produsele disponibile (ref: ${refDate})`
                : `${missing.length} produse lipsa in ${Object.keys(grouped).length} restaurante (ref: ${refDate})` })
            setScanned(true)
            await supabase.from('product_stop_history').insert({
                reference_date: refDate, check_date: today,
                missing_count: missing.length, restaurant_count: Object.keys(grouped).length, results: grouped
            })
        } catch (e) { setScanMsg({ ok: false, text: e.message }) }
        finally { setScanning(false) }
    }, [])

    const totalMissingAll = Object.values(productStopped).reduce((s, d) =>
        s + Object.values(d.byPlatform).reduce((s2, a) => s2 + a.length, 0), 0)

    return (
        <div style={{ padding: '24px 28px', fontFamily: '-apple-system, BlinkMacSystemFont, "Inter", system-ui, sans-serif', minHeight: '100vh' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
                <div>
                    <h1 style={{ margin: 0, fontSize: '22px', fontWeight: '800', color: colors.text, letterSpacing: '-0.5px' }}>
                        🔍 Verificare Produse
                    </h1>
                    <p style={{ margin: '4px 0 0', fontSize: '13px', color: colors.textSecondary }}>
                        {lang === 'en' ? 'Scan menus and compare with last reference — identify missing products per restaurant and platform' : 'Scaneaza meniurile si compara cu ultima referinta — identifica produsele lipsa per restaurant si platforma'}
                    </p>
                </div>
                <button onClick={scanAndCompare} disabled={scanning}
                    style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 24px', borderRadius: '12px', border: 'none', background: scanning ? 'rgba(239,68,68,0.4)' : 'linear-gradient(135deg,#ef4444,#dc2626)', color: '#fff', fontSize: '14px', fontWeight: '800', cursor: scanning ? 'wait' : 'pointer', boxShadow: scanning ? 'none' : '0 4px 16px rgba(239,68,68,0.35)', whiteSpace: 'nowrap' }}>
                    {scanning ? 'Se scaneaza...' : '🔍 Scaneaza si compara'}
                </button>
            </div>

            {/* KPI row */}
            {scanned && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '16px', marginBottom: '24px' }}>
                    {[
                        { label: 'Restaurante afectate', value: Object.keys(productStopped).length, color: Object.keys(productStopped).length > 0 ? '#ef4444' : '#22c55e', bg: Object.keys(productStopped).length > 0 ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.1)' },
                        { label: 'Produse lipsa', value: totalMissingAll, color: totalMissingAll > 0 ? '#ef4444' : '#22c55e', bg: totalMissingAll > 0 ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.1)' },
                        { label: 'Reguli active', value: rules.length, color: '#6366F1', bg: 'rgba(99,102,241,0.1)' },
                    ].map((k, i) => (
                        <div key={i} style={{ ...g, padding: '20px 24px', animation: `fadeUp 0.3s ease ${i * 0.05 + 0.05}s both` }}>
                            <div style={{ fontSize: '11px', fontWeight: '600', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>{k.label}</div>
                            <div style={{ fontSize: '32px', fontWeight: '700', color: k.color, lineHeight: 1 }}>{k.value}</div>
                        </div>
                    ))}
                </div>
            )}

            {/* Scan message */}
            {scanMsg && (
                <div style={{ ...g, marginBottom: '20px', padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderLeft: `4px solid ${scanMsg.ok ? '#22c55e' : '#ef4444'}` }}>
                    <span style={{ fontSize: '13px', fontWeight: '700', color: scanMsg.ok ? '#22c55e' : '#ef4444' }}>{scanMsg.text}</span>
                    <button onClick={() => setScanMsg(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.textSecondary, fontSize: '18px' }}>×</button>
                </div>
            )}

            {/* Results */}
            {scanned && Object.keys(productStopped).length === 0 && (
                <div style={{ ...g, padding: '48px', textAlign: 'center' }}>
                    <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'rgba(34,197,94,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: '24px' }}>✅</div>
                    <div style={{ fontSize: '16px', fontWeight: '700', color: '#22c55e', marginBottom: '6px' }}>{lang === 'en' ? 'All products are available' : 'Toate produsele sunt disponibile'}</div>
                    <div style={{ fontSize: '13px', color: colors.textSecondary }}>Nicio diferenta fata de scanarea de referinta</div>
                </div>
            )}

            {Object.keys(productStopped).length > 0 && (
                <div style={{ ...g, overflow: 'hidden' }}>
                    <div style={{ padding: '16px 24px', borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '14px', fontWeight: '700', color: colors.text }}>{Object.keys(productStopped).length} restaurante cu produse lipsa</span>
                        <button onClick={() => setExpandedRest(prev => Object.keys(prev).length > 0 ? {} : Object.fromEntries(Object.keys(productStopped).map(k => [k, true])))}
                            style={{ fontSize: '11px', fontWeight: '600', color: '#6366F1', background: 'none', border: `1px solid ${colors.border}`, borderRadius: '8px', padding: '4px 12px', cursor: 'pointer' }}>
                            {Object.keys(expandedRest).length > 0 ? 'Restringe tot' : 'Extinde tot'}
                        </button>
                    </div>
                    <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
                        {Object.entries(productStopped).map(([rid, data]) => {
                            const isExp = !!expandedRest[rid]
                            const total = Object.values(data.byPlatform).reduce((s, a) => s + a.length, 0)
                            return (
                                <div key={rid} style={{ borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}` }}>
                                    <div onClick={() => setExpandedRest(p => ({ ...p, [rid]: !p[rid] }))}
                                        style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 24px', cursor: 'pointer', background: isDark ? 'rgba(239,68,68,0.04)' : 'rgba(239,68,68,0.02)', transition: 'background 0.15s' }}>
                                        <span style={{ fontSize: '10px', color: '#ef4444', transform: isExp ? 'rotate(90deg)' : 'rotate(0)', transition: 'transform 0.15s', display: 'inline-block' }}>▶</span>
                                        <div style={{ width: 30, height: 30, borderRadius: '9px', background: data.logo ? '#fff' : 'rgba(239,68,68,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0, border: '1px solid rgba(0,0,0,0.06)' }}>
                                            {data.logo ? <img src={data.logo} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} /> : <span style={{ fontSize: '14px' }}>🏠</span>}
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontSize: '13px', fontWeight: '700', color: colors.text }}>{data.name}</div>
                                            <div style={{ fontSize: '11px', color: colors.textSecondary }}>{data.city}</div>
                                        </div>
                                        <span style={{ fontSize: '11px', fontWeight: '800', color: '#ef4444', background: 'rgba(239,68,68,0.1)', padding: '3px 12px', borderRadius: '8px' }}>
                                            {total} lipsa
                                        </span>
                                    </div>
                                    {isExp && Object.entries(data.byPlatform).map(([platform, prods]) => (
                                        <div key={platform} style={{ padding: '12px 24px 14px 72px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                                                <PlatformBadge platform={platform} size={14} />
                                                <span style={{ fontSize: '10px', fontWeight: '800', color: PLAT_COLORS[platform] || '#888', textTransform: 'uppercase' }}>{platform}</span>
                                                <span style={{ fontSize: '11px', color: colors.textSecondary }}>— {prods.length} lipsa</span>
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                {prods.map((p, i) => (
                                                    <div key={i} style={{ ...inn, display: 'flex', alignItems: 'center', gap: '10px', padding: '6px 12px' }}>
                                                        <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#ef4444', flexShrink: 0 }} />
                                                        <span style={{ flex: 1, fontSize: '12px', fontWeight: '500', color: colors.text }}>{p.name}</span>
                                                        {p.category && <span style={{ fontSize: '10px', color: colors.textSecondary, background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)', padding: '1px 6px', borderRadius: '4px' }}>{p.category}</span>}
                                                        {p.price && <span style={{ fontSize: '11px', fontWeight: '700', color: '#6366F1' }}>{Number(p.price).toFixed(2)} RON</span>}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}

            <style>{`@keyframes fadeUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }`}</style>
        </div>
    )
}
