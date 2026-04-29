import { useState, useEffect } from 'react'
import { useTheme } from '../lib/ThemeContext'

function PlatformLogo({ platform, size = 16 }) {
    const logoMap = {
        glovo: 'https://upload.wikimedia.org/wikipedia/commons/7/78/Current_Logo_Glovo.jpg',
        wolt: 'https://brandlogos.net/wp-content/uploads/2025/05/wolt-logo_brandlogos.net_dijtc.png',
        bolt: 'https://media.voog.com/0000/0039/0361/photos/Bolt.png'
    }
    return (
        <img src={logoMap[platform] || ''} alt={platform}
            style={{ width: size, height: size, objectFit: 'contain', borderRadius: '3px', background: '#fff', flexShrink: 0 }}
            onError={e => { e.target.style.display = 'none' }}
        />
    )
}

function IconLoader({ size = 16 }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
            style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>
            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
        </svg>
    )
}

function IconBack() {
    return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
        </svg>
    )
}

export default function SyncReports() {
    const { colors, isDark } = useTheme()

    const [reports, setReports] = useState([])
    const [loading, setLoading] = useState(true)
    const [running, setRunning] = useState(false)

    // Drill-down state
    const [detailReport, setDetailReport] = useState(null)

    // Detail filters
    const [filterRestaurant, setFilterRestaurant] = useState('')
    const [filterPlatform, setFilterPlatform] = useState('')
    const [filterType, setFilterType] = useState('')
    const [filterSearch, setFilterSearch] = useState('')
    const [page, setPage] = useState(1)
    const [pageSize, setPageSize] = useState(50)

    // Reports list pagination
    const [reportsPage, setReportsPage] = useState(1)
    const reportsPageSize = 20

    useEffect(() => { fetchReports() }, [])

    async function fetchReports() {
        setLoading(true)
        try {
            const res = await fetch('http://localhost:3001/api/sync-reports')
            if (res.ok) {
                const data = await res.json()
                setReports(data.reports || [])
            }
        } catch (_) {}
        setLoading(false)
    }

    async function runTest() {
        setRunning(true)
        try {
            const res = await fetch('http://localhost:3001/api/sync-test-all', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({})
            })
            if (res.ok) {
                await fetchReports()
            }
        } catch (_) {}
        setRunning(false)
    }

    function openDetail(report) {
        setDetailReport(report)
        setFilterRestaurant('')
        setFilterPlatform('')
        setFilterType('')
        setFilterSearch('')
        setPage(1)
    }

    function closeDetail() {
        setDetailReport(null)
    }

    // ── Detail computations ──
    const allDisc = detailReport
        ? (detailReport.results || []).flatMap(r =>
            (r.discrepancies || []).map(d => ({ ...d, restaurant: r.restaurant, city: r.city }))
        )
        : []

    const uniqueRestaurants = [...new Set(allDisc.map(d => d.restaurant))].sort()
    const uniquePlatforms = [...new Set(allDisc.map(d => d.platform))].sort()
    const uniqueTypes = [...new Set(allDisc.map(d => d.type))]

    const filtered = allDisc.filter(d => {
        const mr = !filterRestaurant || d.restaurant === filterRestaurant
        const mp = !filterPlatform || d.platform === filterPlatform
        const mt = !filterType || d.type === filterType
        const ms = !filterSearch || (d.product || d.message || '').toLowerCase().includes(filterSearch.toLowerCase())
        return mr && mp && mt && ms
    })

    const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
    const curPage = Math.min(page, totalPages)
    const paginated = filtered.slice((curPage - 1) * pageSize, curPage * pageSize)

    const hasActiveFilters = filterRestaurant || filterPlatform || filterType || filterSearch

    // Reports list pagination
    const totalReportPages = Math.max(1, Math.ceil(reports.length / reportsPageSize))
    const paginatedReports = reports.slice((reportsPage - 1) * reportsPageSize, reportsPage * reportsPageSize)

    // ── Shared Styles ──
    const card = {
        background: isDark ? 'rgba(30,32,40,0.7)' : '#ffffff',
        borderRadius: '16px',
        border: `1px solid ${isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.08)'}`,
        boxShadow: isDark ? '0 4px 24px rgba(0,0,0,0.3)' : '0 2px 12px rgba(0,0,0,0.07)',
        overflow: 'hidden',
    }

    const inputStyle = {
        padding: '7px 12px', borderRadius: '9px', fontSize: '13px',
        border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.12)'}`,
        background: isDark ? 'rgba(255,255,255,0.05)' : '#f9f9f9',
        color: colors.text, outline: 'none', fontFamily: 'inherit',
    }

    const btnBase = {
        display: 'inline-flex', alignItems: 'center', gap: '6px',
        padding: '8px 16px', border: 'none', borderRadius: '10px',
        fontSize: '13px', fontWeight: '600', cursor: 'pointer',
        fontFamily: 'inherit', transition: 'all 0.15s',
    }

    const thStyle = {
        fontSize: '11px', fontWeight: '700', color: colors.textSecondary,
        textTransform: 'uppercase', letterSpacing: '0.6px', padding: '10px 16px',
    }

    // ════════════════════════════════════════
    // DETAIL VIEW
    // ════════════════════════════════════════
    if (detailReport) {
        const rep = detailReport
        const date = new Date(rep.tested_at)
        const hasIssues = rep.total_discrepancies > 0

        return (
            <div style={{ padding: '28px 32px' }}>
                <style>{`
                    @keyframes spin { to { transform: rotate(360deg); } }
                    @keyframes fadeIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }
                    .sr-row:hover { background: ${isDark ? 'rgba(255,255,255,0.035)' : 'rgba(0,0,0,0.025)'} !important; }
                    .sr-input:focus { border-color: #6366F1 !important; outline: none; }
                    .pg-btn:hover:not(:disabled) { background: rgba(99,102,241,0.15) !important; color: #6366F1 !important; }
                `}</style>

                {/* Back bar */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '22px' }}>
                    <button onClick={closeDetail}
                        style={{ ...btnBase, padding: '7px 14px', background: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)', color: colors.text, border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}` }}>
                        <IconBack /> Înapoi la rapoarte
                    </button>
                    <div style={{ width: 1, height: 20, background: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }} />
                    <div>
                        <span style={{ fontSize: '13px', fontWeight: '700', color: colors.text }}>
                            {date.toLocaleDateString('ro-RO', { day: '2-digit', month: 'long', year: 'numeric' })} · {date.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <span style={{ marginLeft: '10px', fontSize: '12px', color: colors.textSecondary }}>
                            {rep.total_restaurants} restaurante analizate
                        </span>
                    </div>
                    <span style={{
                        marginLeft: 'auto', padding: '5px 14px', borderRadius: '20px', fontSize: '12px', fontWeight: '700',
                        background: hasIssues ? 'rgba(255,59,48,0.12)' : 'rgba(52,199,89,0.12)',
                        color: hasIssues ? '#FF3B30' : '#34C759',
                    }}>
                        {hasIssues ? `${rep.total_discrepancies} discrepanțe` : '✓ Totul OK'}
                    </span>
                </div>

                {/* Detail card */}
                <div style={card}>
                    {/* Filter Bar */}
                    <div style={{
                        padding: '12px 20px', display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center',
                        borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.07)'}`,
                        background: isDark ? 'rgba(0,0,0,0.12)' : 'rgba(0,0,0,0.02)',
                    }}>
                        <input className="sr-input" style={{ ...inputStyle, width: '210px' }}
                            placeholder="🔍 Caută produs..."
                            value={filterSearch}
                            onChange={e => { setFilterSearch(e.target.value); setPage(1) }}
                        />
                        <select className="sr-input" style={{ ...inputStyle, cursor: 'pointer' }}
                            value={filterRestaurant}
                            onChange={e => { setFilterRestaurant(e.target.value); setPage(1) }}>
                            <option value="">Toate restaurantele</option>
                            {uniqueRestaurants.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                        <select className="sr-input" style={{ ...inputStyle, cursor: 'pointer' }}
                            value={filterPlatform}
                            onChange={e => { setFilterPlatform(e.target.value); setPage(1) }}>
                            <option value="">Toate platformele</option>
                            {uniquePlatforms.map(p => <option key={p} value={p} style={{ textTransform: 'capitalize' }}>{p}</option>)}
                        </select>
                        <select className="sr-input" style={{ ...inputStyle, cursor: 'pointer' }}
                            value={filterType}
                            onChange={e => { setFilterType(e.target.value); setPage(1) }}>
                            <option value="">Toate tipurile</option>
                            {uniqueTypes.map(t => (
                                <option key={t} value={t}>{t === 'missing_on_platform' ? 'LIPSĂ pe platformă' : 'STOP FALS (în iiko)'}</option>
                            ))}
                        </select>
                        {hasActiveFilters && (
                            <button onClick={() => { setFilterRestaurant(''); setFilterPlatform(''); setFilterType(''); setFilterSearch(''); setPage(1) }}
                                style={{ ...btnBase, padding: '7px 12px', background: 'rgba(255,59,48,0.08)', color: '#FF3B30', border: '1px solid rgba(255,59,48,0.2)' }}>
                                ✕ Resetează
                            </button>
                        )}
                        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontSize: '11px', color: colors.textSecondary, fontWeight: '500' }}>Rânduri:</span>
                            {[25, 50, 100, 200].map(n => (
                                <button key={n} onClick={() => { setPageSize(n); setPage(1) }}
                                    style={{ padding: '4px 9px', borderRadius: '6px', fontSize: '11px', fontWeight: '600', border: 'none', cursor: 'pointer', fontFamily: 'inherit', background: pageSize === n ? '#6366F1' : (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)'), color: pageSize === n ? '#fff' : colors.textSecondary }}>
                                    {n}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Count row */}
                    <div style={{ padding: '7px 20px', fontSize: '12px', color: colors.textSecondary, borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.05)'}`, background: isDark ? 'rgba(0,0,0,0.08)' : 'rgba(0,0,0,0.015)' }}>
                        <strong style={{ color: colors.text }}>{filtered.length}</strong> discrepanțe
                        {filtered.length !== allDisc.length && <span style={{ color: '#FF9500' }}> (filtrate din {allDisc.length})</span>}
                        {' · '}Pagina <strong style={{ color: colors.text }}>{curPage}</strong> din <strong style={{ color: colors.text }}>{totalPages}</strong>
                        {filtered.length > 0 && <>{' · '}Rânduri <strong style={{ color: colors.text }}>{(curPage - 1) * pageSize + 1}–{Math.min(curPage * pageSize, filtered.length)}</strong></>}
                    </div>

                    {/* Table Header */}
                    <div style={{ display: 'grid', gridTemplateColumns: '50px 1fr 140px 110px 1fr', background: isDark ? 'rgba(0,0,0,0.15)' : 'rgba(0,0,0,0.03)', borderBottom: `2px solid ${isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.09)'}` }}>
                        <div style={{ ...thStyle, textAlign: 'center' }}>#</div>
                        <div style={thStyle}>Restaurant</div>
                        <div style={thStyle}>Platformă</div>
                        <div style={thStyle}>Tip</div>
                        <div style={thStyle}>Produs</div>
                    </div>

                    {/* Table Body */}
                    {paginated.length === 0 ? (
                        <div style={{ padding: '60px 40px', textAlign: 'center', color: colors.textSecondary }}>
                            <p style={{ fontSize: '15px', fontWeight: '600', color: colors.text, margin: '0 0 6px' }}>
                                {allDisc.length === 0 ? '✅ Totul e sincronizat!' : 'Niciun rezultat'}
                            </p>
                            <p style={{ fontSize: '13px', margin: 0 }}>
                                {allDisc.length === 0 ? 'Produsele din iiko corespund perfect cu platformele.' : 'Schimbă filtrele.'}
                            </p>
                        </div>
                    ) : paginated.map((d, idx) => {
                        const globalIdx = (curPage - 1) * pageSize + idx + 1
                        const isLipsa = d.type === 'missing_on_platform'
                        return (
                            <div key={idx} className="sr-row" style={{
                                display: 'grid', gridTemplateColumns: '50px 1fr 140px 110px 1fr',
                                padding: '10px 16px', alignItems: 'center', fontSize: '13px',
                                borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.04)'}`,
                                background: idx % 2 === 0 ? 'transparent' : (isDark ? 'rgba(255,255,255,0.012)' : 'rgba(0,0,0,0.012)'),
                                transition: 'background 0.1s',
                                animation: `fadeIn 0.18s ease ${Math.min(idx * 0.008, 0.12)}s both`,
                            }}>
                                <div style={{ textAlign: 'center', color: isDark ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.22)', fontSize: '11px', fontWeight: '600' }}>{globalIdx}</div>
                                <div>
                                    <div style={{ fontWeight: '600', color: colors.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.restaurant}</div>
                                    {d.city && <div style={{ fontSize: '11px', color: colors.textSecondary, marginTop: '1px' }}>{d.city}</div>}
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                                    <PlatformLogo platform={d.platform} size={15} />
                                    <span style={{ textTransform: 'capitalize', color: colors.text, fontWeight: '500' }}>{d.platform}</span>
                                </div>
                                <div>
                                    <span style={{ display: 'inline-block', fontSize: '10px', fontWeight: '800', padding: '3px 9px', borderRadius: '6px', letterSpacing: '0.3px',
                                        border: `1px solid ${
                                            d.type === 'missing_on_platform' ? 'rgba(255,59,48,0.2)' :
                                            d.type === 'store_closed' ? 'rgba(142,142,147,0.3)' :
                                            'rgba(255,149,0,0.2)'
                                        }`,
                                        background: d.type === 'missing_on_platform' ? 'rgba(255,59,48,0.1)' :
                                            d.type === 'store_closed' ? 'rgba(142,142,147,0.1)' :
                                            'rgba(255,149,0,0.1)',
                                        color: d.type === 'missing_on_platform' ? '#FF3B30' :
                                            d.type === 'store_closed' ? '#8E8E93' :
                                            '#FF9500',
                                    }}>
                                        {d.type === 'missing_on_platform' ? 'LIPSĂ' : d.type === 'store_closed' ? 'SCRAPER 0' : 'STOP FALS'}
                                    </span>
                                </div>
                                <div style={{ color: colors.textSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.product || d.message}</div>
                            </div>
                        )
                    })}

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', padding: '14px 20px', borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.07)'}`, background: isDark ? 'rgba(0,0,0,0.1)' : 'rgba(0,0,0,0.02)' }}>
                            <button className="pg-btn" onClick={() => setPage(1)} disabled={curPage === 1} style={{ padding: '5px 10px', borderRadius: '7px', border: 'none', cursor: curPage === 1 ? 'not-allowed' : 'pointer', fontFamily: 'inherit', fontSize: '13px', fontWeight: '600', background: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)', color: colors.text, opacity: curPage === 1 ? 0.3 : 1, transition: 'all 0.12s' }}>«</button>
                            <button className="pg-btn" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={curPage === 1} style={{ padding: '5px 10px', borderRadius: '7px', border: 'none', cursor: curPage === 1 ? 'not-allowed' : 'pointer', fontFamily: 'inherit', fontSize: '13px', fontWeight: '600', background: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)', color: colors.text, opacity: curPage === 1 ? 0.3 : 1, transition: 'all 0.12s' }}>‹</button>
                            {Array.from({ length: Math.min(9, totalPages) }, (_, i) => {
                                let p2
                                if (totalPages <= 9) p2 = i + 1
                                else if (curPage <= 5) p2 = i + 1
                                else if (curPage >= totalPages - 4) p2 = totalPages - 8 + i
                                else p2 = curPage - 4 + i
                                return (
                                    <button key={p2} className="pg-btn" onClick={() => setPage(p2)} style={{ padding: '5px 10px', minWidth: '34px', borderRadius: '7px', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: '13px', fontWeight: '700', background: curPage === p2 ? '#6366F1' : (isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)'), color: curPage === p2 ? '#fff' : colors.textSecondary, transition: 'all 0.12s' }}>{p2}</button>
                                )
                            })}
                            <button className="pg-btn" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={curPage === totalPages} style={{ padding: '5px 10px', borderRadius: '7px', border: 'none', cursor: curPage === totalPages ? 'not-allowed' : 'pointer', fontFamily: 'inherit', fontSize: '13px', fontWeight: '600', background: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)', color: colors.text, opacity: curPage === totalPages ? 0.3 : 1, transition: 'all 0.12s' }}>›</button>
                            <button className="pg-btn" onClick={() => setPage(totalPages)} disabled={curPage === totalPages} style={{ padding: '5px 10px', borderRadius: '7px', border: 'none', cursor: curPage === totalPages ? 'not-allowed' : 'pointer', fontFamily: 'inherit', fontSize: '13px', fontWeight: '600', background: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)', color: colors.text, opacity: curPage === totalPages ? 0.3 : 1, transition: 'all 0.12s' }}>»</button>
                        </div>
                    )}
                </div>
            </div>
        )
    }

    // ════════════════════════════════════════
    // REPORTS LIST VIEW
    // ════════════════════════════════════════
    return (
        <div style={{ padding: '28px 32px' }}>
            <style>{`
                @keyframes spin { to { transform: rotate(360deg); } }
                @keyframes fadeIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }
                .rep-row { cursor: pointer; transition: background 0.12s; }
                .rep-row:hover { background: ${isDark ? 'rgba(99,102,241,0.07)' : 'rgba(99,102,241,0.05)'} !important; }
                .pg-btn:hover:not(:disabled) { background: rgba(99,102,241,0.15) !important; color: #6366F1 !important; }
            `}</style>

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
                <div>
                    <h1 style={{ margin: 0, fontSize: '26px', fontWeight: '800', color: colors.text, letterSpacing: '-0.6px' }}>
                        Rapoarte Sync 1:1
                    </h1>
                    <p style={{ margin: '4px 0 0', fontSize: '13px', color: colors.textSecondary }}>
                        Comparație produse iiko vs. platforme agregator. Click pe un raport pentru a vedea detaliile.
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <button onClick={fetchReports} disabled={loading}
                        style={{ ...btnBase, background: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)', color: colors.text, border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}` }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" /></svg>
                        Reîncarcă
                    </button>
                    <button onClick={runTest} disabled={running}
                        style={{ ...btnBase, background: running ? 'rgba(255,149,0,0.5)' : 'linear-gradient(135deg, #FF9500, #FF6B00)', color: '#fff', opacity: running ? 0.75 : 1 }}>
                        {running
                            ? <IconLoader size={14} />
                            : <svg width="11" height="11" viewBox="0 0 24 24" fill="#fff"><polygon points="5 3 19 12 5 21 5 3" /></svg>}
                        {running ? 'Se rulează… (2–3 min)' : 'Rulează Test Nou'}
                    </button>
                </div>
            </div>

            {/* Reports table */}
            <div style={card}>
                {/* Table header */}
                <div style={{ display: 'grid', gridTemplateColumns: '180px 140px 1fr 120px 120px 70px', background: isDark ? 'rgba(0,0,0,0.15)' : 'rgba(0,0,0,0.03)', borderBottom: `2px solid ${isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.09)'}` }}>
                    <div style={thStyle}>Data sincronizării</div>
                    <div style={thStyle}>Ora</div>
                    <div style={thStyle}>Restaurante analizate</div>
                    <div style={{ ...thStyle, textAlign: 'center' }}>Discrepanțe</div>
                    <div style={{ ...thStyle, textAlign: 'center' }}>Status</div>
                    <div style={thStyle}></div>
                </div>

                {loading ? (
                    <div style={{ padding: '60px', textAlign: 'center', color: colors.textSecondary }}>
                        <IconLoader size={28} />
                        <p style={{ marginTop: '12px', fontSize: '13px' }}>Se încarcă rapoartele...</p>
                    </div>
                ) : reports.length === 0 ? (
                    <div style={{ padding: '60px 40px', textAlign: 'center', color: colors.textSecondary }}>
                        <p style={{ fontSize: '15px', fontWeight: '600', color: colors.text, margin: '0 0 6px' }}>Niciun raport disponibil</p>
                        <p style={{ fontSize: '13px', margin: 0 }}>Apasă <strong>Rulează Test Nou</strong> pentru a genera primul raport de sinconizare.</p>
                    </div>
                ) : (
                    <>
                        {paginatedReports.map((rep, idx) => {
                            const date = new Date(rep.tested_at)
                            const hasIssues = rep.total_discrepancies > 0
                            const restNames = (rep.results || []).map(r => r.restaurant).filter(Boolean)
                            return (
                                <div key={rep.id} className="rep-row"
                                    onClick={() => openDetail(rep)}
                                    style={{
                                        display: 'grid', gridTemplateColumns: '180px 140px 1fr 120px 120px 70px',
                                        padding: '14px 16px', alignItems: 'center',
                                        borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.05)'}`,
                                        animation: `fadeIn 0.2s ease ${idx * 0.03}s both`,
                                    }}>
                                    <div>
                                        <div style={{ fontWeight: '700', fontSize: '14px', color: colors.text }}>
                                            {date.toLocaleDateString('ro-RO', { day: '2-digit', month: 'long', year: 'numeric' })}
                                        </div>
                                    </div>
                                    <div style={{ fontSize: '13px', color: colors.textSecondary, fontWeight: '500' }}>
                                        {date.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '13px', color: colors.text, fontWeight: '500' }}>
                                            {rep.total_restaurants} restaurant{rep.total_restaurants !== 1 ? 'e' : ''}
                                        </div>
                                        {restNames.length > 0 && (
                                            <div style={{ fontSize: '11px', color: colors.textSecondary, marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {restNames.slice(0, 3).join(', ')}{restNames.length > 3 ? ` +${restNames.length - 3}` : ''}
                                            </div>
                                        )}
                                    </div>
                                    <div style={{ textAlign: 'center' }}>
                                        <span style={{ fontSize: '18px', fontWeight: '800', color: hasIssues ? '#FF3B30' : '#34C759' }}>
                                            {rep.total_discrepancies}
                                        </span>
                                    </div>
                                    <div style={{ textAlign: 'center' }}>
                                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '4px 12px', borderRadius: '20px', fontSize: '11px', fontWeight: '700', background: hasIssues ? 'rgba(255,59,48,0.1)' : 'rgba(52,199,89,0.1)', color: hasIssues ? '#FF3B30' : '#34C759' }}>
                                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor', display: 'inline-block', flexShrink: 0 }} />
                                            {hasIssues ? 'Probleme' : 'OK'}
                                        </span>
                                    </div>
                                    <div style={{ textAlign: 'center', color: isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.25)', fontSize: '18px' }}>›</div>
                                </div>
                            )
                        })}

                        {/* Reports Pagination */}
                        {totalReportPages > 1 && (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.07)'}`, background: isDark ? 'rgba(0,0,0,0.1)' : 'rgba(0,0,0,0.02)' }}>
                                <span style={{ fontSize: '12px', color: colors.textSecondary }}>
                                    {reports.length} rapoarte totale · Pagina {reportsPage} din {totalReportPages}
                                </span>
                                <div style={{ display: 'flex', gap: '5px' }}>
                                    <button className="pg-btn" onClick={() => setReportsPage(p => Math.max(1, p - 1))} disabled={reportsPage === 1} style={{ padding: '5px 12px', borderRadius: '7px', border: 'none', cursor: reportsPage === 1 ? 'not-allowed' : 'pointer', fontFamily: 'inherit', fontSize: '13px', fontWeight: '600', background: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)', color: colors.text, opacity: reportsPage === 1 ? 0.3 : 1, transition: 'all 0.12s' }}>‹ Prev</button>
                                    <button className="pg-btn" onClick={() => setReportsPage(p => Math.min(totalReportPages, p + 1))} disabled={reportsPage === totalReportPages} style={{ padding: '5px 12px', borderRadius: '7px', border: 'none', cursor: reportsPage === totalReportPages ? 'not-allowed' : 'pointer', fontFamily: 'inherit', fontSize: '13px', fontWeight: '600', background: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)', color: colors.text, opacity: reportsPage === totalReportPages ? 0.3 : 1, transition: 'all 0.12s' }}>Next ›</button>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    )
}
