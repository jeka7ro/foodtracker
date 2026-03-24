import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTheme } from '../lib/ThemeContext'
import { useLanguage } from '../lib/LanguageContext'

const API = import.meta.env.VITE_WORKER_URL || 'http://localhost:3001'

const PLATFORM_COLORS = { wolt: '#009DE0', glovo: '#FFC244', bolt: '#7FBA00' }

// Platform logo badge
const PlatformBadge = ({ platform, colors, isDark }) => (
    <span style={{
        fontSize: '10px', fontWeight: '700', padding: '2px 7px', borderRadius: '20px',
        background: `${PLATFORM_COLORS[platform] || '#888'}20`,
        color: PLATFORM_COLORS[platform] || colors.textSecondary,
        border: `1px solid ${PLATFORM_COLORS[platform] || '#888'}40`,
        letterSpacing: '0.3px', textTransform: 'uppercase'
    }}>{platform}</span>
)

export default function Competitors() {
    const { isDark } = useTheme()
    const { lang } = useLanguage()
    const navigate = useNavigate()

    const colors = {
        text: isDark ? '#f5f5f7' : '#1d1d1f',
        textSecondary: isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.45)',
        bg: isDark ? '#111113' : '#f5f5f7',
        card: isDark ? 'rgba(255,255,255,0.04)' : '#ffffff',
        border: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
    }

    const [competitors, setCompetitors] = useState([])
    const [loading, setLoading] = useState(false)
    const [search, setSearch] = useState('')
    const [filterPlatform, setFilterPlatform] = useState('')
    const [filterCity, setFilterCity] = useState('')
    const [sortBy, setSortBy] = useState('rank') // rank | appearances | rating | name
    const [view, setView] = useState('grid') // grid | table

    const load = useCallback(async () => {
        setLoading(true)
        try {
            const params = new URLSearchParams()
            if (filterPlatform) params.set('platform', filterPlatform)
            if (filterCity) params.set('city', filterCity)
            const res = await fetch(`${API}/api/competitors?${params}`)
            const d = await res.json()
            if (d.success) setCompetitors(d.competitors)
        } catch { } finally { setLoading(false) }
    }, [filterPlatform, filterCity])

    useEffect(() => { load() }, [load])

    const openDetail = (comp) => {
        navigate(`/marketing?tab=prices&detail=${encodeURIComponent(comp.name)}`)
    }

    // Filter + sort
    const filtered = competitors
        .filter(c => {
            if (search && !c.name.toLowerCase().includes(search.toLowerCase())) return false
            return true
        })
        .sort((a, b) => {
            if (sortBy === 'rank') return (a.bestRank || 999) - (b.bestRank || 999)
            if (sortBy === 'appearances') return b.appearances - a.appearances
            if (sortBy === 'rating') return (parseFloat(b.avgRating) || 0) - (parseFloat(a.avgRating) || 0)
            if (sortBy === 'name') return a.name.localeCompare(b.name)
            return 0
        })

    const allCities = [...new Set(competitors.flatMap(c => c.cities))].sort()


    // ─── Main list page ───
    return (
        <div style={{ padding: '24px 28px', maxWidth: 1400, margin: '0 auto' }}>

            {/* Page header */}
            <div style={{ marginBottom: '28px' }}>
                <h1 style={{ margin: '0 0 6px', fontSize: '26px', fontWeight: '800', color: colors.text, letterSpacing: '-0.6px' }}>
                    {lang === 'ru' ? 'Конкуренты' : lang === 'en' ? 'Competitors' : 'Concurenți'}
                </h1>
                <p style={{ margin: 0, color: colors.textSecondary, fontSize: '14px' }}>
                    {competitors.length} {(lang === 'ru' ? 'ресторанов-конкурентов из всех поисков' : (lang === 'en' ? 'competitor restaurants from all searches' : 'restaurante concurente din toate căutările'))}
                </p>
            </div>

            {/* Filters */}
            <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
                {/* Search */}
                <div style={{ position: 'relative', flex: 1, minWidth: '220px' }}>
                    <svg style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: colors.textSecondary }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>
                    <input value={search} onChange={e => setSearch(e.target.value)}
                        placeholder={(lang === 'ru' ? 'Поиск ресторана...' : (lang === 'en' ? 'Search restaurant...' : 'Caută restaurant...'))}
                        style={{ width: '100%', paddingLeft: 36, padding: '9px 12px 9px 36px', borderRadius: '10px', border: `1px solid ${colors.border}`, background: colors.card, color: colors.text, fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
                </div>

                {/* Platform */}
                <select value={filterPlatform} onChange={e => setFilterPlatform(e.target.value)}
                    style={{ padding: '9px 12px', borderRadius: '10px', border: `1px solid ${colors.border}`, background: colors.card, color: colors.text, fontSize: '13px', cursor: 'pointer' }}>
                    <option value="">{(lang === 'ru' ? 'Toate platformele' : (lang === 'en' ? 'All platforms' : 'Toate platformele'))}</option>
                    <option value="wolt">Wolt</option>
                    <option value="glovo">Glovo</option>
                    <option value="bolt">Bolt</option>
                </select>

                {/* City */}
                <select value={filterCity} onChange={e => setFilterCity(e.target.value)}
                    style={{ padding: '9px 12px', borderRadius: '10px', border: `1px solid ${colors.border}`, background: colors.card, color: colors.text, fontSize: '13px', cursor: 'pointer' }}>
                    <option value="">{lang==='en'?'All cities':'Toate orașele'}</option>
                    {allCities.map(c => <option key={c} value={c}>{c}</option>)}
                </select>

                {/* Sort */}
                <select value={sortBy} onChange={e => setSortBy(e.target.value)}
                    style={{ padding: '9px 12px', borderRadius: '10px', border: `1px solid ${colors.border}`, background: colors.card, color: colors.text, fontSize: '13px', cursor: 'pointer' }}>
                    <option value="rank">{(lang === 'ru' ? 'Sortare: Best rank' : (lang === 'en' ? 'Sort: Best rank' : 'Sortare: Best rank'))}</option>
                    <option value="appearances">{(lang === 'ru' ? 'Сортировка: Появления' : (lang === 'en' ? 'Sort: Appearances' : 'Sortare: Apariții'))}</option>
                    <option value="rating">{(lang === 'ru' ? 'Sortare: Rating' : (lang === 'en' ? 'Sort: Rating' : 'Sortare: Rating'))}</option>
                    <option value="name">{(lang === 'ru' ? 'Sortare: Nume' : (lang === 'en' ? 'Sort: Name' : 'Sortare: Nume'))}</option>
                </select>

                {/* View toggle */}
                <div style={{ display: 'flex', gap: '2px', background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)', borderRadius: '9px', padding: '3px' }}>
                    {['grid', 'table'].map(v => (
                        <button key={v} onClick={() => setView(v)}
                            style={{ padding: '5px 10px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '13px', background: view === v ? (isDark ? 'rgba(255,255,255,0.1)' : '#fff') : 'transparent', color: view === v ? colors.text : colors.textSecondary, boxShadow: view === v ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}>
                            {v === 'grid' ? '⊞' : '☰'}
                        </button>
                    ))}
                </div>

                <div style={{ marginLeft: 'auto', fontSize: '13px', color: colors.textSecondary }}>
                    {filtered.length} {lang === 'ru' ? 'из' : lang === 'en' ? 'of' : 'din'} {competitors.length}
                </div>
            </div>

            {/* Loading */}
            {loading && (
                <div style={{ textAlign: 'center', padding: '60px', color: colors.textSecondary }}>
                    <svg style={{ animation: 'spin 1s linear infinite' }} width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>
                    <p style={{ marginTop: '12px' }}>{lang === 'ru' ? 'Загрузка конкурентов...' : lang === 'en' ? 'Loading competitors...' : 'Se încarcă concurenții...'}</p>
                </div>
            )}

            {/* Grid view */}
            {!loading && view === 'grid' && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '14px' }}>
                    {filtered.map(comp => (
                        <div key={comp.name} onClick={() => openDetail(comp)}
                            style={{
                                background: colors.card, border: `1px solid ${colors.border}`,
                                borderRadius: '16px', padding: '20px', cursor: 'pointer',
                                transition: 'all 0.15s ease',
                                display: 'flex', flexDirection: 'column', gap: '12px'
                            }}
                            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.08)' }}
                            onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '' }}>

                            {/* Logo + title */}
                            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                                <div style={{
                                    width: 48, height: 48, borderRadius: '12px', flexShrink: 0, overflow: 'hidden',
                                    background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    border: `1px solid ${colors.border}`
                                }}>
                                    {comp.logo_url ? (
                                        <img src={comp.logo_url} alt={comp.name}
                                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                            onError={e => { e.target.parentElement.innerHTML = `<span style="font-size:18px;font-weight:800;color:rgba(0,0,0,0.3)">${comp.name.charAt(0)}</span>` }} />
                                    ) : (
                                        <span style={{ fontSize: '18px', fontWeight: '800', color: colors.textSecondary }}>
                                            {comp.name.charAt(0).toUpperCase()}
                                        </span>
                                    )}
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: '14px', fontWeight: '700', color: colors.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: '3px' }}>
                                        {comp.name}
                                    </div>
                                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                                        {comp.platforms?.map(p => <PlatformBadge key={p} platform={p} colors={colors} isDark={isDark} />)}
                                    </div>
                                </div>
                            </div>

                            {/* Stats row */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                                {[
                                    { label: 'Best rank', value: comp.bestRank ? `#${comp.bestRank}` : '—', accent: comp.bestRank && comp.bestRank <= 3 },
                                    { label: 'Rating', value: comp.avgRating ? `${comp.avgRating}/10` : '—' },
                                    { label: lang === 'ru' ? 'Появления' : lang === 'en' ? 'Appearances' : 'Apariții', value: `${comp.appearances}×` },
                                ].map(s => (
                                    <div key={s.label} style={{ textAlign: 'center', padding: '8px 4px', borderRadius: '8px', background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)' }}>
                                        <div style={{ fontSize: '15px', fontWeight: '700', color: s.accent ? '#6366F1' : colors.text, letterSpacing: '-0.3px' }}>{s.value}</div>
                                        <div style={{ fontSize: '10px', color: colors.textSecondary, fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.3px', marginTop: '2px' }}>{s.label}</div>
                                    </div>
                                ))}
                            </div>

                            {/* Cities */}
                            <div style={{ fontSize: '11px', color: colors.textSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                📍 {comp.cities?.slice(0, 3).join(', ')}{comp.cities?.length > 3 ? ` +${comp.cities.length - 3}` : ''}
                            </div>

                            {/* Products count if any */}
                            {comp.productCount > 0 && (
                                <div style={{ fontSize: '11px', color: colors.textSecondary }}>
                                    📋 {comp.productCount} {lang === 'ru' ? 'собранных продуктов' : lang === 'en' ? 'scraped products' : 'produse scraped'}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Table view */}
            {!loading && view === 'table' && (
                <div style={{ background: colors.card, border: `1px solid ${colors.border}`, borderRadius: '14px', overflow: 'hidden' }}>
                    {/* Header */}
                    <div style={{ display: 'grid', gridTemplateColumns: '56px 1fr 130px 80px 80px 90px 80px', gap: '8px', padding: '10px 18px', background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)', borderBottom: `1px solid ${colors.border}` }}>
                        {(lang === 'ru' ? ['', 'Бренд', 'Локации', 'Появления', 'Best Rank', 'Рейтинг', 'Продукты'] : lang === 'en' ? ['', 'Brand', 'Locations', 'Appearances', 'Best Rank', 'Rating', 'Products'] : ['', 'Brand', 'Locații', 'Apariții', 'Best Rank', 'Rating', 'Produse']).map(h => (
                            <span key={h} style={{ fontSize: '10px', fontWeight: '600', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: '0.4px' }}>{h}</span>
                        ))}
                    </div>
                    {filtered.map((comp, i) => (
                        <div key={comp.name} onClick={() => openDetail(comp)}
                            style={{
                                display: 'grid', gridTemplateColumns: '56px 1fr 130px 80px 80px 90px 80px',
                                gap: '8px', padding: '12px 18px', alignItems: 'center', cursor: 'pointer',
                                borderBottom: i < filtered.length - 1 ? `1px solid ${isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}` : 'none',
                                transition: 'background 0.12s'
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                            {/* Logo */}
                            <div style={{ width: 40, height: 40, borderRadius: '10px', overflow: 'hidden', background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${colors.border}` }}>
                                {comp.logo_url ? (
                                    <img src={comp.logo_url} alt={comp.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { e.target.style.display = 'none' }} />
                                ) : (
                                    <span style={{ fontSize: '15px', fontWeight: '700', color: colors.textSecondary }}>{comp.name.charAt(0)}</span>
                                )}
                            </div>
                            <div>
                                <div style={{ fontSize: '13px', fontWeight: '600', color: colors.text, marginBottom: '3px' }}>{comp.name}</div>
                                <div style={{ display: 'flex', gap: '4px' }}>
                                    {comp.platforms?.map(p => <PlatformBadge key={p} platform={p} colors={colors} isDark={isDark} />)}
                                </div>
                            </div>
                            <span style={{ fontSize: '12px', color: colors.textSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {comp.cities?.slice(0, 2).join(', ')}{comp.cities?.length > 2 ? ` +${comp.cities.length - 2}` : ''}
                            </span>
                            <span style={{ fontSize: '13px', color: colors.textSecondary }}>{comp.appearances}×</span>
                            <span style={{ fontSize: '15px', fontWeight: '700', color: comp.bestRank && comp.bestRank <= 3 ? '#6366F1' : colors.text }}>
                                {comp.bestRank ? `#${comp.bestRank}` : '—'}
                            </span>
                            <span style={{ fontSize: '13px', color: colors.textSecondary }}>{comp.avgRating ? `${comp.avgRating}/10` : '—'}</span>
                            <span style={{ fontSize: '13px', color: comp.productCount > 0 ? colors.text : colors.textSecondary }}>
                                {comp.productCount > 0 ? comp.productCount : '—'}
                            </span>
                        </div>
                    ))}
                </div>
            )}

            {!loading && filtered.length === 0 && competitors.length > 0 && (
                <div style={{ textAlign: 'center', padding: '60px', color: colors.textSecondary }}>
                    {lang === 'ru' ? 'Нет конкурентов, соответствующих выбранным фильтрам.' : lang === 'en' ? 'No competitors match the selected filters.' : 'Niciun concurent nu corespunde filtrelor selectate.'}
                </div>
            )}

            {!loading && competitors.length === 0 && (
                <div style={{ textAlign: 'center', padding: '60px', border: `1px dashed ${colors.border}`, borderRadius: '16px' }}>
                    <div style={{ fontSize: '32px', marginBottom: '12px' }}>🔍</div>
                    <div style={{ fontSize: '16px', fontWeight: '600', color: colors.text, marginBottom: '6px' }}>{lang === 'ru' ? 'Нет конкурентов' : lang === 'en' ? 'No competitors' : 'Niciun concurent'}</div>
                    <div style={{ fontSize: '14px', color: colors.textSecondary }}>{lang === 'ru' ? 'Запустите конкурентный поиск со страницы маркетинга, чтобы заполнить данные.' : 'Rulează o căutare competitivă din pagina Marketing pentru a popula datele.'}</div>
                </div>
            )}
        </div>
    )
}
