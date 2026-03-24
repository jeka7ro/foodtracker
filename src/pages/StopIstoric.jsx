import { useState, useEffect } from 'react'
import { useTheme } from '../lib/ThemeContext'
import { useLanguage } from '../lib/LanguageContext'
import { supabase } from '../lib/supabaseClient'

function glass(dk) {
    return { background: dk ? 'rgba(30,32,40,0.65)' : '#fff', backdropFilter: dk ? 'blur(24px) saturate(180%)' : 'none', WebkitBackdropFilter: dk ? 'blur(24px) saturate(180%)' : 'none', borderRadius: '20px', border: dk ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.08)', boxShadow: dk ? '0 8px 32px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)' : '0 2px 12px rgba(0,0,0,0.08)' }
}

export default function StopIstoric() {
    const { lang } = useLanguage()
    const { colors, isDark } = useTheme()
    const g = glass(isDark)

    const [history, setHistory] = useState([])
    const [loading, setLoading] = useState(true)
    const [expandedItem, setExpandedItem] = useState({})
    const [deleteConfirm, setDeleteConfirm] = useState(null)

    const loadHistory = async () => {
        setLoading(true)
        const { data } = await supabase.from('product_stop_history')
            .select('*')
            .order('checked_at', { ascending: false })
            .limit(100)
        setHistory(data || [])
        setLoading(false)
    }

    useEffect(() => { loadHistory() }, [])

    const handleDelete = async (id, deleteResults) => {
        if (deleteResults) {
            // Delete both the history entry and its associated data
            await supabase.from('product_stop_history').delete().eq('id', id)
        } else {
            // Just mark as hidden (soft delete)
            await supabase.from('product_stop_history').update({ hidden: true }).eq('id', id)
        }
        setDeleteConfirm(null)
        await loadHistory()
    }

    return (
        <div style={{ padding: '24px 28px', minHeight: '100vh' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
                <div>
                    <h1 style={{ margin: 0, fontSize: '22px', fontWeight: '800', color: colors.text, letterSpacing: '-0.5px' }}>
                        📋 Istoric Scanări
                    </h1>
                    <p style={{ margin: '4px 0 0', fontSize: '13px', color: colors.textSecondary }}>
                        {(lang === 'ru' ? 'Все предыдущие результаты сканирования — сравните эволюцию' : (lang === 'en' ? 'All previous scan results — compare evolution over time' : 'Toate rezultatele scanarilor anterioare — compara evolutia in timp'))}
                    </p>
                </div>
                <button onClick={loadHistory} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '10px', border: `1px solid ${colors.border}`, background: 'transparent', cursor: 'pointer', fontSize: '12px', fontWeight: '600', color: colors.textSecondary }}>
                    ↻ Refresh
                </button>
            </div>

            {/* Delete confirmation modal */}
            {deleteConfirm && (
                <>
                    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100 }} onClick={() => setDeleteConfirm(null)} />
                    <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 101, ...g, padding: '28px 32px', width: '420px', maxWidth: '90vw' }}>
                        <div style={{ fontSize: '16px', fontWeight: '800', color: colors.text, marginBottom: '12px' }}>
                            ⚠️ Șterge scanarea
                        </div>
                        <div style={{ fontSize: '13px', color: colors.textSecondary, marginBottom: '24px', lineHeight: 1.5 }}>
                            Ce dorești să ștergi?
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            <button onClick={() => handleDelete(deleteConfirm, false)}
                                style={{ padding: '12px', borderRadius: '10px', border: `1px solid ${colors.border}`, background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)', cursor: 'pointer', textAlign: 'left' }}>
                                <div style={{ fontSize: '13px', fontWeight: '700', color: colors.text }}>Doar din istoric</div>
                                <div style={{ fontSize: '11px', color: colors.textSecondary, marginTop: '2px' }}>Ascunde scanarea din lista, dar pastreaza datele</div>
                            </button>
                            <button onClick={() => handleDelete(deleteConfirm, true)}
                                style={{ padding: '12px', borderRadius: '10px', border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.06)', cursor: 'pointer', textAlign: 'left' }}>
                                <div style={{ fontSize: '13px', fontWeight: '700', color: '#ef4444' }}>Șterge și rezultatele</div>
                                <div style={{ fontSize: '11px', color: colors.textSecondary, marginTop: '2px' }}>Sterge complet scanarea si toate datele asociate</div>
                            </button>
                            <button onClick={() => setDeleteConfirm(null)}
                                style={{ padding: '10px', borderRadius: '10px', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: '12px', fontWeight: '600', color: colors.textSecondary }}>
                                Anuleaza
                            </button>
                        </div>
                    </div>
                </>
            )}

            {loading ? (
                <div style={{ textAlign: 'center', padding: '80px', color: colors.textSecondary }}>
                    <div style={{ width: 36, height: 36, border: `3px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}`, borderTopColor: '#6366F1', borderRadius: '50%', animation: 'spin 0.7s linear infinite', margin: '0 auto 16px' }} />
                    Se incarca...
                </div>
            ) : history.length === 0 ? (
                <div style={{ ...g, padding: '48px', textAlign: 'center' }}>
                    <div style={{ fontSize: '14px', fontWeight: '600', color: colors.text }}>Nicio scanare in istoric</div>
                    <div style={{ fontSize: '12px', color: colors.textSecondary, marginTop: '6px' }}>Mergi la "Verificare Produse" si ruleaza o scanare</div>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {history.filter(h => !h.hidden).map((item) => {
                        const isExp = !!expandedItem[item.id]
                        const checkedAt = new Date(item.checked_at)
                        const results = item.results || {}
                        return (
                            <div key={item.id} style={{ ...g, overflow: 'hidden', animation: 'fadeUp 0.3s ease both' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '16px 24px' }}>
                                    <div onClick={() => setExpandedItem(p => ({ ...p, [item.id]: !p[item.id] }))}
                                        style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: 1, cursor: item.results ? 'pointer' : 'default' }}>
                                        {item.results && <span style={{ fontSize: '10px', color: '#6366F1', transform: isExp ? 'rotate(90deg)' : 'rotate(0)', transition: 'transform 0.15s', display: 'inline-block' }}>▶</span>}
                                        <div style={{ width: 40, height: 40, borderRadius: '12px', background: item.missing_count > 0 ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', flexShrink: 0 }}>
                                            {item.missing_count > 0 ? '⚠️' : '✅'}
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontSize: '13px', fontWeight: '700', color: colors.text }}>
                                                Scanare {checkedAt.toLocaleDateString('ro-RO', { day: '2-digit', month: 'short', year: 'numeric' })}
                                                <span style={{ fontWeight: '400', color: colors.textSecondary, marginLeft: '8px' }}>
                                                    {checkedAt.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            </div>
                                            <div style={{ fontSize: '11px', color: colors.textSecondary, marginTop: '2px' }}>
                                                Referinta: {item.reference_date} → {(lang === 'ru' ? 'Проверка' : (lang === 'en' ? 'Check' : 'Verificare'))}: {item.check_date}
                                            </div>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <span style={{ fontSize: '12px', fontWeight: '800', color: item.missing_count > 0 ? '#ef4444' : '#22c55e', background: item.missing_count > 0 ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.1)', padding: '4px 12px', borderRadius: '8px' }}>
                                            {item.missing_count > 0 ? `${item.missing_count} lipsa · ${item.restaurant_count} rest.` : 'Toate OK'}
                                        </span>
                                        <button onClick={() => setDeleteConfirm(item.id)}
                                            style={{ width: 28, height: 28, borderRadius: '8px', border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`, background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: colors.textSecondary, fontSize: '14px' }}
                                            title="Sterge">🗑</button>
                                    </div>
                                </div>
                                {isExp && Object.keys(results).length > 0 && (
                                    <div style={{ borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`, maxHeight: '350px', overflowY: 'auto' }}>
                                        {Object.entries(results).map(([rid, data]) => (
                                            <div key={rid} style={{ padding: '12px 24px 12px 80px', borderBottom: `0.5px solid ${isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}` }}>
                                                <div style={{ fontSize: '12px', fontWeight: '700', color: colors.text, marginBottom: '6px' }}>
                                                    {data.name} <span style={{ fontWeight: '400', color: colors.textSecondary }}>· {data.city}</span>
                                                </div>
                                                {Object.entries(data.byPlatform || {}).map(([plat, prods]) => (
                                                    <div key={plat} style={{ marginLeft: '12px', marginBottom: '4px' }}>
                                                        <span style={{ fontSize: '10px', fontWeight: '800', color: '#ef4444', textTransform: 'uppercase' }}>{plat}</span>
                                                        <span style={{ fontSize: '11px', color: colors.textSecondary }}> — {prods.length} lipsa: </span>
                                                        <span style={{ fontSize: '11px', color: colors.text }}>{prods.map(p => p.name).join(', ')}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            )}

            <style>{`
                @keyframes fadeUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
                @keyframes spin { to { transform: rotate(360deg); } }
            `}</style>
        </div>
    )
}
