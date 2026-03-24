import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useTheme } from '../lib/ThemeContext'
import { useLanguage } from '../lib/LanguageContext'
import toast, { Toaster } from 'react-hot-toast'
import { ConfirmDialog } from '../components/ConfirmDialog'

const PLATFORM_CONFIG = {
    glovo: { label: 'Glovo', dot: '#FF6B00' },
    wolt: { label: 'Wolt', dot: '#009DE0' },
    bolt: { label: 'Bolt', dot: '#34D399' },
}

export default function Brands() {
    const { colors, isDark } = useTheme()
    const { lang } = useLanguage()
    const [brands, setBrands] = useState([])
    const [restaurants, setRestaurants] = useState([])
    const [loading, setLoading] = useState(true)
    const [showModal, setShowModal] = useState(false)
    const [editingBrand, setEditingBrand] = useState(null)
    const [deleteConfirm, setDeleteConfirm] = useState({ isOpen: false, brand: null })
    const [formData, setFormData] = useState({ name: '', telegram_group_id: '', categories: '' })
    const [hovered, setHovered] = useState(null)

    useEffect(() => { fetchData() }, [])

    async function fetchData() {
        try {
            const [brandsRes, restaurantsRes] = await Promise.all([
                supabase.from('brands').select('*').order('name'),
                supabase.from('restaurants').select('id, brand_id, glovo_url, wolt_url, bolt_url, is_active')
            ])
            if (brandsRes.error) throw brandsRes.error
            if (restaurantsRes.error) throw restaurantsRes.error
            setBrands(brandsRes.data || [])
            setRestaurants(restaurantsRes.data || [])
        } catch (err) {
            toast.error('Error loading brands')
        } finally {
            setLoading(false)
        }
    }

    function getBrandStats(brandId) {
        const rests = restaurants.filter(r => r.brand_id === brandId)
        return {
            total: rests.length,
            active: rests.filter(r => r.is_active).length,
            glovo: rests.filter(r => r.glovo_url).length,
            wolt: rests.filter(r => r.wolt_url).length,
            bolt: rests.filter(r => r.bolt_url).length,
        }
    }

    async function handleSubmit(e) {
        e.preventDefault()
        try {
            const payload = { name: formData.name, telegram_group_id: formData.telegram_group_id || null, categories: formData.categories || null }
            if (editingBrand) {
                const { error } = await supabase.from('brands').update(payload).eq('id', editingBrand.id)
                if (error) throw error
                toast.success((lang === 'ru' ? 'Brand actualizat' : (lang === 'en' ? 'Brand updated' : 'Brand actualizat')))
            } else {
                const { error } = await supabase.from('brands').insert([payload])
                if (error) throw error
                toast.success((lang === 'ru' ? 'Бренд добавлен' : (lang === 'en' ? 'Brand added' : 'Brand adăugat')))
            }
            setShowModal(false); setEditingBrand(null); resetForm(); fetchData()
        } catch (err) {
            toast.error('Error: ' + err.message)
        }
    }

    async function confirmDelete() {
        try {
            const { error } = await supabase.from('brands').delete().eq('id', deleteConfirm.brand.id)
            if (error) throw error
            toast.success((lang === 'ru' ? 'Бренд удален' : (lang === 'en' ? 'Brand deleted' : 'Brand șters')))
            fetchData()
        } catch (err) {
            toast.error('Error: ' + err.message)
        } finally {
            setDeleteConfirm({ isOpen: false, brand: null })
        }
    }

    function openAdd() { resetForm(); setEditingBrand(null); setShowModal(true) }
    function openEdit(brand) {
        setFormData({ name: brand.name, telegram_group_id: brand.telegram_group_id || '', categories: brand.categories || '' })
        setEditingBrand(brand); setShowModal(true)
    }
    function resetForm() { setFormData({ name: '', telegram_group_id: '', categories: '' }) }

    const inputStyle = {
        width: '100%', padding: '9px 12px',
        background: isDark ? 'rgba(255,255,255,0.05)' : '#f7f7f8',
        border: `1px solid ${colors.border}`, borderRadius: '8px',
        fontSize: '13px', color: colors.text, outline: 'none', fontFamily: 'inherit'
    }

    if (loading) return (
        <div style={{ padding: '32px', }}>
            <div style={{ height: 24, width: 120, borderRadius: 8, background: isDark ? 'rgba(255,255,255,0.06)' : '#eee', animation: 'pulse 1.5s ease infinite' }} />
        </div>
    )

    return (
        <div style={{ padding: '28px 32px', }}>
            <style>{`
                @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
                @keyframes fadeUp { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
                @keyframes modalIn { from{opacity:0;transform:scale(0.96)} to{opacity:1;transform:scale(1)} }
                .brand-card { transition: box-shadow 0.2s, transform 0.2s; }
                .brand-card:hover { box-shadow: ${isDark ? '0 12px 40px rgba(0,0,0,0.5)' : '0 8px 32px rgba(0,0,0,0.1)'} !important; transform: translateY(-3px); }
                .icon-btn { transition: background 0.15s, color 0.15s; }
            `}</style>
            <Toaster position="bottom-right" toastOptions={{ style: { fontFamily: 'Inter, sans-serif', fontSize: '13px', background: isDark ? '#1c1c1e' : '#fff', color: colors.text, border: `1px solid ${colors.border}` } }} />

            {/* ── Header ── */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px', animation: 'fadeUp 0.3s ease' }}>
                <div>
                    <h1 style={{ fontSize: '22px', fontWeight: '700', margin: 0, color: colors.text, letterSpacing: '-0.4px' }}>
                        {(lang === 'ru' ? 'Бренды' : (lang === 'en' ? 'Brands' : 'Branduri'))}
                    </h1>
                    <p style={{ fontSize: '13px', color: colors.textSecondary, margin: '3px 0 0' }}>
                        {brands.length} {(lang === 'ru' ? 'branduri' : (lang === 'en' ? 'brands' : 'branduri'))} · {restaurants.length} {(lang === 'ru' ? 'restaurante totale' : (lang === 'en' ? 'restaurants total' : 'restaurante totale'))}
                    </p>
                </div>
                <button onClick={openAdd} style={{ padding: '8px 16px', background: '#6366F1', color: 'white', border: 'none', borderRadius: '9px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', boxShadow: '0 2px 8px rgba(99,102,241,0.35)', transition: 'opacity 0.15s' }}
                    onMouseOver={e => e.currentTarget.style.opacity = '0.88'}
                    onMouseOut={e => e.currentTarget.style.opacity = '1'}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                    {(lang === 'ru' ? 'Добавить бренд' : (lang === 'en' ? 'Add Brand' : 'Adaugă Brand'))}
                </button>
            </div>

            {/* ── Cards grid ── */}
            {brands.length === 0 ? (
                <div style={{ padding: '60px', textAlign: 'center', border: `1px dashed ${colors.border}`, borderRadius: '16px' }}>
                    <div style={{ fontSize: '32px', marginBottom: '12px' }}>📦</div>
                    <div style={{ fontWeight: '600', color: colors.text }}>{(lang === 'ru' ? 'Niciun brand' : (lang === 'en' ? 'No brands yet' : 'Niciun brand'))}</div>
                    <div style={{ fontSize: '13px', color: colors.textSecondary, marginTop: '4px' }}>{(lang === 'ru' ? 'Добавьте первый бренд для начала мониторинга' : (lang === 'en' ? 'Add your first brand to start monitoring' : 'Adaugă primul brand pentru a începe monitorizarea'))}</div>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '14px' }}>
                    {brands.map((brand, idx) => {
                        const stats = getBrandStats(brand.id)
                        const isHov = hovered === brand.id
                        return (
                            <div key={brand.id} className="brand-card"
                                onMouseEnter={() => setHovered(brand.id)}
                                onMouseLeave={() => setHovered(null)}
                                style={{
                                    background: isDark ? 'rgba(255,255,255,0.03)' : '#fff',
                                    border: `1px solid ${isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)'}`,
                                    borderRadius: '14px', padding: '20px',
                                    animation: `fadeUp ${0.2 + idx * 0.05}s ease`,
                                    position: 'relative', overflow: 'hidden',
                                }}>
                                {/* Subtle left accent */}
                                <div style={{ position: 'absolute', left: 0, top: '20%', bottom: '20%', width: '2px', borderRadius: '0 2px 2px 0', background: '#6366F1', opacity: isHov ? 1 : 0, transition: 'opacity 0.2s' }} />

                                {/* Top row: logo + name + actions */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '18px' }}>
                                    {/* Logo / initial */}
                                    <div style={{ width: 44, height: 44, borderRadius: '10px', flexShrink: 0, overflow: 'hidden', background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)', border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', fontWeight: '700', color: '#6366F1' }}>
                                        {brand.logo_url
                                            ? <img src={brand.logo_url} alt={brand.name} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                                            : brand.name.charAt(0).toUpperCase()}
                                    </div>
                                    {/* Name */}
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontSize: '15px', fontWeight: '700', color: colors.text, letterSpacing: '-0.2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{brand.name}</div>
                                        {brand.telegram_group_id && (
                                            <div style={{ fontSize: '11px', color: colors.textSecondary, marginTop: '1px' }}>Telegram · {brand.telegram_group_id}</div>
                                        )}
                                        {brand.categories && (
                                            <div style={{ fontSize: '11px', color: '#6366F1', marginTop: '2px', fontWeight: '600' }}>Cat: {brand.categories}</div>
                                        )}
                                    </div>
                                    {/* Actions — icon buttons only */}
                                    <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                                        <button className="icon-btn" onClick={() => openEdit(brand)} title={(lang === 'ru' ? 'Изменить' : (lang === 'en' ? 'Edit' : 'Editează'))}
                                            style={{ width: 30, height: 30, borderRadius: '7px', border: `1px solid ${colors.border}`, background: 'transparent', color: colors.textSecondary, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                            onMouseOver={e => { e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)'; e.currentTarget.style.color = colors.text }}
                                            onMouseOut={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = colors.textSecondary }}>
                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                                        </button>
                                        <button className="icon-btn" onClick={() => setDeleteConfirm({ isOpen: true, brand })} title={(lang === 'ru' ? 'Удалить' : (lang === 'en' ? 'Delete' : 'Șterge'))}
                                            style={{ width: 30, height: 30, borderRadius: '7px', border: `1px solid ${colors.border}`, background: 'transparent', color: colors.textSecondary, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                            onMouseOver={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.08)'; e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.borderColor = 'rgba(239,68,68,0.25)' }}
                                            onMouseOut={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = colors.textSecondary; e.currentTarget.style.borderColor = colors.border }}>
                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4h6v2" /></svg>
                                        </button>
                                    </div>
                                </div>

                                {/* Stats row — clean, minimal */}
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '14px' }}>
                                    {[
                                        { label: (lang === 'ru' ? 'Total' : (lang === 'en' ? 'Total' : 'Total')), value: stats.total, accent: false },
                                        { label: (lang === 'ru' ? 'Active' : (lang === 'en' ? 'Active' : 'Active')), value: stats.active, accent: '#22c55e' },
                                        { label: (lang === 'ru' ? 'Inactive' : (lang === 'en' ? 'Inactive' : 'Inactive')), value: stats.total - stats.active, accent: false },
                                    ].map(s => (
                                        <div key={s.label} style={{ textAlign: 'center', padding: '10px 4px', borderRadius: '9px', background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.025)', border: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}` }}>
                                            <div style={{ fontSize: '20px', fontWeight: '700', color: s.accent || colors.text, lineHeight: 1.1 }}>{s.value}</div>
                                            <div style={{ fontSize: '10px', color: colors.textSecondary, marginTop: '3px', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.3px' }}>{s.label}</div>
                                        </div>
                                    ))}
                                </div>

                                {/* Platform row — dots + counts, no color badges */}
                                <div style={{ display: 'flex', gap: '16px' }}>
                                    {[
                                        { key: 'glovo', count: stats.glovo },
                                        { key: 'wolt', count: stats.wolt },
                                        { key: 'bolt', count: stats.bolt },
                                    ].map(({ key, count }) => {
                                        const p = PLATFORM_CONFIG[key]
                                        return (
                                            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '5px', opacity: count > 0 ? 1 : 0.35 }}>
                                                <div style={{ width: 6, height: 6, borderRadius: '50%', background: p.dot, flexShrink: 0 }} />
                                                <span style={{ fontSize: '12px', fontWeight: '500', color: colors.textSecondary }}>{p.label}</span>
                                                <span style={{ fontSize: '12px', fontWeight: '700', color: count > 0 ? colors.text : colors.textSecondary }}>
                                                    {count > 0 ? count : '—'}
                                                </span>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}

            {/* ── Add / Edit Modal ── */}
            {showModal && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
                    onClick={e => e.target === e.currentTarget && (setShowModal(false), resetForm())}>
                    <div style={{ background: isDark ? '#1c1c1e' : '#fff', border: `1px solid ${colors.border}`, borderRadius: '16px', padding: '28px', width: 420, maxWidth: '92vw', animation: 'modalIn 0.2s ease', boxShadow: '0 24px 64px rgba(0,0,0,0.25)' }}>
                        <h2 style={{ fontSize: '17px', fontWeight: '700', margin: '0 0 20px', color: colors.text }}>
                            {editingBrand ? ((lang === 'ru' ? '✏ Изменить бренд' : (lang === 'en' ? '✏ Edit Brand' : '✏ Editează Brand'))) : ((lang === 'ru' ? '＋ Brand Nou' : (lang === 'en' ? '＋ New Brand' : '＋ Brand Nou')))}
                        </h2>
                        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '6px' }}>
                                    {(lang === 'ru' ? 'Nume Brand *' : (lang === 'en' ? 'Brand Name *' : 'Nume Brand *'))}
                                </label>
                                <input type="text" required value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    placeholder="ex: Sushi Master"
                                    style={inputStyle} />
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '6px' }}>
                                    Telegram Group ID
                                </label>
                                <input type="text" value={formData.telegram_group_id}
                                    onChange={e => setFormData({ ...formData, telegram_group_id: e.target.value })}
                                    placeholder="ex: -1001234567890"
                                    style={inputStyle} />
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '8px' }}>
                                    {(lang === 'ru' ? 'Categorii Brand' : (lang === 'en' ? 'Categories' : 'Categorii Brand'))}
                                </label>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                    {['Sushi', 'Burger', 'Pizza', 'Asia', 'Meniu'].map(cat => {
                                        const cats = formData.categories ? formData.categories.split(',').map(c => c.trim()).filter(Boolean) : [];
                                        const isSelected = cats.includes(cat);
                                        return (
                                            <button
                                                key={cat}
                                                type="button"
                                                onClick={() => {
                                                    const newCats = isSelected 
                                                        ? cats.filter(c => c !== cat) 
                                                        : [...cats, cat];
                                                    setFormData({ ...formData, categories: newCats.join(', ') });
                                                }}
                                                style={{
                                                    padding: '6px 12px', borderRadius: '20px', 
                                                    border: isSelected ? 'none' : `1px solid ${colors.border}`,
                                                    background: isSelected ? '#10B981' : (isDark ? 'rgba(255,255,255,0.05)' : '#fff'),
                                                    color: isSelected ? '#fff' : colors.text,
                                                    fontSize: '12px', fontWeight: '600', cursor: 'pointer',
                                                    boxShadow: isSelected ? '0 4px 12px rgba(16,185,129,0.2)' : 'none',
                                                    transition: 'all 0.2s ease', outline: 'none'
                                                }}>
                                                {cat}
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '8px' }}>
                                <button type="button" onClick={() => { setShowModal(false); resetForm() }}
                                    style={{ padding: '9px 18px', background: 'transparent', color: colors.textSecondary, border: `1px solid ${colors.border}`, borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>
                                    {(lang === 'ru' ? 'Отмена' : (lang === 'en' ? 'Cancel' : 'Anulează'))}
                                </button>
                                <button type="submit"
                                    style={{ padding: '9px 20px', background: '#6366F1', color: 'white', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '700', cursor: 'pointer', boxShadow: '0 2px 8px rgba(99,102,241,0.3)' }}>
                                    {editingBrand ? ((lang === 'ru' ? 'Сохранить' : (lang === 'en' ? 'Update' : 'Salvează'))) : ((lang === 'ru' ? 'Создать' : (lang === 'en' ? 'Create' : 'Creează')))}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <ConfirmDialog
                isOpen={deleteConfirm.isOpen}
                onClose={() => setDeleteConfirm({ isOpen: false, brand: null })}
                onConfirm={confirmDelete}
                title={(lang === 'ru' ? 'Șterge Brand' : (lang === 'en' ? 'Delete Brand' : 'Șterge Brand'))}
                message={`${(lang === 'ru' ? 'Ștergi' : (lang === 'en' ? 'Delete' : 'Ștergi'))} "${deleteConfirm.brand?.name}"? ${(lang === 'ru' ? 'Все связанные рестораны также будут удалены!' : (lang === 'en' ? 'All associated restaurants will also be deleted.' : 'Vor fi șterse și toate restaurantele asociate!'))}`}
                confirmText={(lang === 'ru' ? 'Удалить' : (lang === 'en' ? 'Delete' : 'Șterge'))}
                cancelText={(lang === 'ru' ? 'Отмена' : (lang === 'en' ? 'Cancel' : 'Anulează'))}
                variant="danger"
            />
        </div>
    )
}
