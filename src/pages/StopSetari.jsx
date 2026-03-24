import { useState, useEffect, useMemo } from 'react'
import { useTheme } from '../lib/ThemeContext'
import { useLanguage } from '../lib/LanguageContext'
import { supabase } from '../lib/supabaseClient'

const DAYS = [
    {d:'Luni', en:'Mon'}, {d:'Marti', en:'Tue'}, {d:'Miercuri', en:'Wed'}, 
    {d:'Joi', en:'Thu'}, {d:'Vineri', en:'Fri'}, {d:'Sambata', en:'Sat'}, {d:'Duminica', en:'Sun'}
]
const FREQ = [['daily','Zilnic','Daily'],['weekly','Saptamanal','Weekly'],['monthly','Lunar','Monthly'],['manual','Manual','Manual']]

function glass(dk) {
    return { background: dk ? 'rgba(30,32,40,0.65)' : '#fff', backdropFilter: dk ? 'blur(24px) saturate(180%)' : 'none', WebkitBackdropFilter: dk ? 'blur(24px) saturate(180%)' : 'none', borderRadius: '20px', border: dk ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.08)', boxShadow: dk ? '0 8px 32px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)' : '0 2px 12px rgba(0,0,0,0.08)' }
}

export default function StopSetari() {
    const { colors, isDark } = useTheme()
    const { lang } = useLanguage()
    const g = glass(isDark)
    const sel = { padding: '9px 14px', borderRadius: '10px', border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`, background: isDark ? 'rgba(255,255,255,0.05)' : '#fff', color: colors.text, fontSize: '13px', width: '100%', outline: 'none' }

    const [rules, setRules] = useState([])
    const [brands, setBrands] = useState([])
    const [restaurants, setRestaurants] = useState([])
    const [loading, setLoading] = useState(true)
    const [showForm, setShowForm] = useState(false)
    const [editingId, setEditingId] = useState(null) // null=new, id=edit
    const [deleteConfirm, setDeleteConfirm] = useState(null)

    // Form state
    const [formName, setFormName] = useState('')
    const [formType, setFormType] = useState('all')
    const [formBrands, setFormBrands] = useState([])
    const [formRestaurants, setFormRestaurants] = useState([])
    const [formPlatforms, setFormPlatforms] = useState(['wolt', 'glovo', 'bolt'])
    const [formFreq, setFormFreq] = useState('daily')
    const [formTime, setFormTime] = useState('08:00')
    const [formDays, setFormDays] = useState([])
    const [saving, setSaving] = useState(false)
    const [brandSearch, setBrandSearch] = useState('')
    const [restSearch, setRestSearch] = useState('')

    const reload = async () => {
        const { data } = await supabase.from('stop_scan_rules').select('*').order('created_at', { ascending: false })
        setRules(data || [])
    }

    useEffect(() => {
        Promise.all([
            supabase.from('stop_scan_rules').select('*').order('created_at', { ascending: false }),
            supabase.from('brands').select('id, name, logo_url').order('name'),
            supabase.from('restaurants').select('id, name, city, brand_id, brands(name, logo_url)').eq('is_active', true).order('name')
        ]).then(([{ data: r }, { data: b }, { data: rest }]) => {
            setRules(r || [])
            setBrands(b || [])
            setRestaurants(rest || [])
            setLoading(false)
        })
    }, [])

    const togglePlatform = (p) => setFormPlatforms(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p])
    const toggleFormBrand = (id) => setFormBrands(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
    const toggleFormRest = (id) => setFormRestaurants(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
    const toggleDay = (d) => setFormDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d])

    const filteredBrands = useMemo(() => brands.filter(b => !brandSearch || b.name?.toLowerCase().includes(brandSearch.toLowerCase())), [brands, brandSearch])
    const filteredRestaurants = useMemo(() => {
        let list = restaurants
        if (formBrands.length > 0) list = list.filter(r => formBrands.includes(r.brand_id))
        if (restSearch) list = list.filter(r => r.name?.toLowerCase().includes(restSearch.toLowerCase()) || r.city?.toLowerCase().includes(restSearch.toLowerCase()))
        return list
    }, [restaurants, formBrands, restSearch])

    const resetForm = () => {
        setFormName(''); setFormType('all'); setFormBrands([]); setFormRestaurants([])
        setFormPlatforms(['wolt', 'glovo', 'bolt']); setFormFreq('daily'); setFormTime('08:00'); setFormDays([])
        setBrandSearch(''); setRestSearch(''); setEditingId(null)
    }

    const openNew = () => { resetForm(); setShowForm(true) }

    const openEdit = (rule) => {
        setEditingId(rule.id)
        setFormName(rule.name || '')
        setFormType(rule.scope_type || 'all')
        setFormBrands(rule.brand_ids || (rule.brand_id ? [rule.brand_id] : []))
        setFormRestaurants(rule.restaurant_ids || (rule.restaurant_id ? [rule.restaurant_id] : []))
        setFormPlatforms(rule.platforms || ['wolt', 'glovo', 'bolt'])
        setFormFreq(rule.schedule_frequency || 'daily')
        setFormTime(rule.schedule_time || '08:00')
        setFormDays(rule.schedule_days || [])
        setBrandSearch(''); setRestSearch('')
        setShowForm(true)
    }

    const saveRule = async () => {
        if (!formName.trim()) return
        setSaving(true)
        const payload = {
            name: formName.trim(),
            scope_type: formType,
            brand_ids: formType === 'brand' ? formBrands : null,
            restaurant_ids: formType === 'restaurant' ? formRestaurants : null,
            platforms: formPlatforms,
            is_active: true,
            schedule_frequency: formFreq,
            schedule_time: formTime,
            schedule_days: formFreq === 'weekly' ? formDays : null,
        }
        if (editingId) {
            await supabase.from('stop_scan_rules').update(payload).eq('id', editingId)
        } else {
            await supabase.from('stop_scan_rules').insert(payload)
        }
        await reload()
        setShowForm(false)
        resetForm()
        setSaving(false)
    }

    const toggleActive = async (id, current) => {
        await supabase.from('stop_scan_rules').update({ is_active: !current }).eq('id', id)
        setRules(prev => prev.map(r => r.id === id ? { ...r, is_active: !current } : r))
    }

    const handleDelete = async (id, deleteResults) => {
        await supabase.from('stop_scan_rules').delete().eq('id', id)
        setRules(prev => prev.filter(r => r.id !== id))
        setDeleteConfirm(null)
    }

    const freqLabel = (f) => {
        const row = FREQ.find(x => x[0] === f)
        if (!row) return f
        return lang === 'en' ? row[2] : row[1]
    }

    const Lbl = ({ children }) => <label style={{ fontSize: '11px', fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px', display: 'block' }}>{children}</label>

    return (
        <div style={{ padding: '10px 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
                <div>
                    <h1 style={{ margin: 0, fontSize: '22px', fontWeight: '800', color: colors.text, letterSpacing: '-0.5px' }}>⚙️ {(lang === 'ru' ? 'Настройки сканирования' : (lang === 'en' ? 'Scan Settings' : 'Setări Scanare'))}</h1>
                    <p style={{ margin: '4px 0 0', fontSize: '13px', color: colors.textSecondary }}>{(lang === 'ru' ? 'Настройкa правил сканирования (бренды, рестораны)' : (lang === 'en' ? 'Configure scanning rules — choose brand, restaurant, or all' : 'Configureaza regulile de scanare — alege brand, restaurant sau toate'))}</p>
                </div>
                <button onClick={openNew} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 20px', borderRadius: '12px', border: 'none', background: 'linear-gradient(135deg,#6366F1,#8B5CF6)', color: '#fff', fontSize: '13px', fontWeight: '700', cursor: 'pointer', boxShadow: '0 4px 14px rgba(99,102,241,0.35)' }}>
                    + {(lang === 'ru' ? 'Добавить правило' : (lang === 'en' ? 'Add Rule' : 'Adaugă regulă'))}
                </button>
            </div>

            {/* Delete confirmation modal */}
            {deleteConfirm && (
                <>
                    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100 }} onClick={() => setDeleteConfirm(null)} />
                    <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 101, ...g, padding: '28px 32px', width: '420px', maxWidth: '90vw' }}>
                        <div style={{ fontSize: '16px', fontWeight: '800', color: colors.text, marginBottom: '12px' }}>⚠️ {(lang === 'ru' ? 'Удалить правило' : (lang === 'en' ? 'Delete Rule' : 'Șterge regula'))}</div>
                        <div style={{ fontSize: '13px', color: colors.textSecondary, marginBottom: '24px' }}>{(lang === 'ru' ? 'Что вы хотите удалить?' : (lang === 'en' ? 'What do you want to delete?' : 'Ce dorești să ștergi?'))}</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            <button onClick={() => handleDelete(deleteConfirm, false)} style={{ padding: '12px', borderRadius: '10px', border: `1px solid ${colors.border}`, background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)', cursor: 'pointer', textAlign: 'left' }}>
                                <div style={{ fontSize: '13px', fontWeight: '700', color: colors.text }}>{(lang === 'ru' ? 'Только правило' : (lang === 'en' ? 'Only the rule' : 'Doar regula'))}</div>
                                <div style={{ fontSize: '11px', color: colors.textSecondary, marginTop: '2px' }}>{(lang === 'ru' ? 'Удалить правило, но сохранить историю' : (lang === 'en' ? 'Delete the rule but keep history results' : 'Sterge regula dar pastreaza rezultatele din istoric'))}</div>
                            </button>
                            <button onClick={() => handleDelete(deleteConfirm, true)} style={{ padding: '12px', borderRadius: '10px', border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.06)', cursor: 'pointer', textAlign: 'left' }}>
                                <div style={{ fontSize: '13px', fontWeight: '700', color: '#ef4444' }}>{(lang === 'ru' ? 'Удалить также результаты' : (lang === 'en' ? 'Delete also results' : 'Sterge si rezultatele'))}</div>
                                <div style={{ fontSize: '11px', color: colors.textSecondary, marginTop: '2px' }}>{(lang === 'ru' ? 'Удалить правило и всю историю' : (lang === 'en' ? 'Delete the rule and all data from history' : 'Sterge regula si toate datele din istoric'))}</div>
                            </button>
                            <button onClick={() => setDeleteConfirm(null)} style={{ padding: '10px', borderRadius: '10px', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: '12px', fontWeight: '600', color: colors.textSecondary }}>{(lang === 'ru' ? 'Anulează' : (lang === 'en' ? 'Cancel' : 'Anulează'))}</button>
                        </div>
                    </div>
                </>
            )}

            {/* Add/Edit rule form modal */}
            {showForm && (
                <>
                    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100 }} onClick={() => { setShowForm(false); resetForm() }} />
                    <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 101, ...g, padding: '28px 32px', width: '540px', maxWidth: '90vw', maxHeight: '85vh', overflowY: 'auto' }}>
                        <div style={{ fontSize: '16px', fontWeight: '800', color: colors.text, marginBottom: '20px' }}>
                            {editingId ? ((lang === 'ru' ? '✏️ Изменить' : (lang === 'en' ? '✏️ Edit Rule' : '✏️ Editează Regula'))) : ((lang === 'ru' ? '➕ Добавить' : (lang === 'en' ? '➕ Add Scan Rule' : '➕ Adaugă Regulă de Scanare')))}
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                            <div>
                                <Lbl>{(lang === 'ru' ? 'Имя правила' : (lang === 'en' ? 'Rule name' : 'Nume regulă'))}</Lbl>
                                <input value={formName} onChange={e => setFormName(e.target.value)} placeholder="ex: Sushi Master - toate" style={sel} />
                            </div>

                            <div>
                                <Lbl>{(lang === 'ru' ? 'Тип сканирования' : (lang === 'en' ? 'Scan type' : 'Tip scanare'))}</Lbl>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    {[['all', (lang === 'ru' ? 'Все' : (lang === 'en' ? 'All' : 'Toate'))], ['brand', 'Brand'], ['restaurant', 'Restaurant']].map(([v, l]) => (
                                        <button key={v} onClick={() => setFormType(v)}
                                            style={{ flex: 1, padding: '10px', borderRadius: '10px', border: formType === v ? '2px solid #6366F1' : `1px solid ${colors.border}`, background: formType === v ? 'rgba(99,102,241,0.08)' : 'transparent', cursor: 'pointer', fontSize: '13px', fontWeight: '700', color: formType === v ? '#6366F1' : colors.text }}>
                                            {l}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {formType === 'brand' && (
                                <div>
                                    <Lbl>{lang === 'en' ? `Brands (${formBrands.length} selected)` : `Branduri (${formBrands.length} selectate)`}</Lbl>
                                    <input value={brandSearch} onChange={e => setBrandSearch(e.target.value)} placeholder={(lang === 'ru' ? "Поиск бренда..." : (lang === 'en' ? "Search brand..." : "Cauta brand..."))} style={{ ...sel, marginBottom: '6px' }} />
                                    <div style={{ maxHeight: '140px', overflowY: 'auto', borderRadius: '10px', border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`, background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)' }}>
                                        {filteredBrands.map(b => (
                                            <div key={b.id} onClick={() => toggleFormBrand(b.id)} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 14px', cursor: 'pointer', borderBottom: `0.5px solid ${isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}`, background: formBrands.includes(b.id) ? 'rgba(99,102,241,0.08)' : 'transparent' }}>
                                                <div style={{ width: 16, height: 16, borderRadius: '4px', border: formBrands.includes(b.id) ? '2px solid #6366F1' : `1.5px solid ${colors.border}`, background: formBrands.includes(b.id) ? '#6366F1' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                    {formBrands.includes(b.id) && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
                                                </div>
                                                {b.logo_url && <img src={b.logo_url} alt="" style={{ width: 20, height: 20, borderRadius: '5px', objectFit: 'contain', background: '#fff' }} />}
                                                <span style={{ fontSize: '12px', fontWeight: formBrands.includes(b.id) ? '700' : '500', color: formBrands.includes(b.id) ? '#6366F1' : colors.text }}>{b.name}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {formType === 'restaurant' && (
                                <div>
                                    <Lbl>{lang === 'en' ? `Restaurants (${formRestaurants.length} selected)` : `Restaurante (${formRestaurants.length} selectate)`}</Lbl>
                                    <input value={restSearch} onChange={e => setRestSearch(e.target.value)} placeholder={(lang === 'ru' ? "Поиск города или ресторана..." : (lang === 'en' ? "Search restaurant or city..." : "Cauta restaurant sau oras..."))} style={{ ...sel, marginBottom: '6px' }} />
                                    <div style={{ maxHeight: '180px', overflowY: 'auto', borderRadius: '10px', border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`, background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)' }}>
                                        <div style={{ padding: '5px 14px', display: 'flex', gap: '6px', borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}` }}>
                                            <button onClick={() => setFormRestaurants(filteredRestaurants.map(r => r.id))} style={{ fontSize: '10px', fontWeight: '700', color: '#6366F1', background: 'rgba(99,102,241,0.08)', border: 'none', borderRadius: '5px', padding: '3px 8px', cursor: 'pointer' }}>{(lang === 'ru' ? 'Выбрать все' : (lang === 'en' ? 'Select all' : 'Selecteaza tot'))}</button>
                                            <button onClick={() => setFormRestaurants([])} style={{ fontSize: '10px', fontWeight: '700', color: colors.textSecondary, background: 'transparent', border: `1px solid ${colors.border}`, borderRadius: '5px', padding: '3px 8px', cursor: 'pointer' }}>{(lang === 'ru' ? 'Снять выбор' : (lang === 'en' ? 'Deselect' : 'Deselecteaza'))}</button>
                                        </div>
                                        {filteredRestaurants.map(r => (
                                            <div key={r.id} onClick={() => toggleFormRest(r.id)} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 14px', cursor: 'pointer', borderBottom: `0.5px solid ${isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}`, background: formRestaurants.includes(r.id) ? 'rgba(99,102,241,0.08)' : 'transparent' }}>
                                                <div style={{ width: 16, height: 16, borderRadius: '4px', border: formRestaurants.includes(r.id) ? '2px solid #6366F1' : `1.5px solid ${colors.border}`, background: formRestaurants.includes(r.id) ? '#6366F1' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                    {formRestaurants.includes(r.id) && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
                                                </div>
                                                {r.brands?.logo_url && <img src={r.brands.logo_url} alt="" style={{ width: 18, height: 18, borderRadius: '4px', objectFit: 'contain', background: '#fff' }} />}
                                                <span style={{ fontSize: '12px', fontWeight: formRestaurants.includes(r.id) ? '700' : '500', color: formRestaurants.includes(r.id) ? '#6366F1' : colors.text }}>{r.name}</span>
                                                <span style={{ fontSize: '10px', color: colors.textSecondary, marginLeft: 'auto' }}>{r.city}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div>
                                <Lbl>{(lang === 'ru' ? 'Платформы' : (lang === 'en' ? 'Platforms' : 'Platforme'))}</Lbl>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    {[['wolt', '#009de0'], ['glovo', '#FFC244'], ['bolt', '#34D186']].map(([p, c]) => (
                                        <button key={p} onClick={() => togglePlatform(p)}
                                            style={{ padding: '7px 16px', borderRadius: '8px', border: formPlatforms.includes(p) ? `2px solid ${c}` : `1px solid ${colors.border}`, background: formPlatforms.includes(p) ? `${c}15` : 'transparent', cursor: 'pointer', fontSize: '12px', fontWeight: '700', color: formPlatforms.includes(p) ? c : colors.textSecondary, textTransform: 'uppercase' }}>
                                            {p}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* ═══ SCHEDULE SECTION ═══ */}
                            <div style={{ borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`, paddingTop: '14px' }}>
                                <Lbl>📅 {(lang === 'ru' ? 'Расписание' : (lang === 'en' ? 'Schedule' : 'Programare'))}</Lbl>
                                <div style={{ display: 'flex', gap: '6px', marginBottom: '12px', flexWrap: 'wrap' }}>
                                    {FREQ.map(([v, l]) => (
                                        <button key={v} onClick={() => setFormFreq(v)}
                                            style={{ padding: '8px 14px', borderRadius: '8px', border: formFreq === v ? '2px solid #6366F1' : `1px solid ${colors.border}`, background: formFreq === v ? 'rgba(99,102,241,0.08)' : 'transparent', cursor: 'pointer', fontSize: '12px', fontWeight: '700', color: formFreq === v ? '#6366F1' : colors.text }}>
                                            {l}
                                        </button>
                                    ))}
                                </div>

                                {formFreq !== 'manual' && (
                                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '10px' }}>
                                        <div style={{ flex: 1 }}>
                                            <Lbl>{(lang === 'ru' ? 'Время' : (lang === 'en' ? 'Time' : 'Ora'))}</Lbl>
                                            <input type="time" value={formTime} onChange={e => setFormTime(e.target.value)} style={sel} />
                                        </div>
                                    </div>
                                )}

                                {formFreq === 'weekly' && (
                                    <div>
                                        <Lbl>{(lang === 'ru' ? 'Дни' : (lang === 'en' ? 'Days' : 'Zile'))}</Lbl>
                                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                                            {DAYS.map((day) => (
                                                <button key={day.d} onClick={() => toggleDay(day.d)}
                                                    style={{ padding: '6px 10px', borderRadius: '7px', border: formDays.includes(day.d) ? '2px solid #6366F1' : `1px solid ${colors.border}`, background: formDays.includes(day.d) ? 'rgba(99,102,241,0.08)' : 'transparent', cursor: 'pointer', fontSize: '11px', fontWeight: '700', color: formDays.includes(day.d) ? '#6366F1' : colors.textSecondary, minWidth: '38px', textAlign: 'center' }}>
                                                    {lang === 'en' ? day.en.slice(0, 3) : day.d.slice(0, 3)}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '24px' }}>
                            <button onClick={() => { setShowForm(false); resetForm() }} style={{ padding: '10px 20px', borderRadius: '10px', border: `1px solid ${colors.border}`, background: 'transparent', cursor: 'pointer', fontSize: '13px', fontWeight: '600', color: colors.textSecondary }}>{(lang === 'ru' ? 'Anulează' : (lang === 'en' ? 'Cancel' : 'Anulează'))}</button>
                            <button onClick={saveRule} disabled={saving || !formName.trim()}
                                style={{ padding: '10px 24px', borderRadius: '10px', border: 'none', background: 'linear-gradient(135deg,#6366F1,#8B5CF6)', color: '#fff', fontSize: '13px', fontWeight: '700', cursor: 'pointer', opacity: saving || !formName.trim() ? 0.5 : 1 }}>
                                {saving ? ((lang === 'ru' ? 'Сохранение...' : (lang === 'en' ? 'Saving...' : 'Se salveaza...'))) : editingId ? ((lang === 'ru' ? 'Сохранить изменения' : (lang === 'en' ? 'Save Changes' : 'Salvează Modificarile'))) : ((lang === 'ru' ? 'Сохранить' : (lang === 'en' ? 'Save' : 'Salvează')))}
                            </button>
                        </div>
                    </div>
                </>
            )}

            {/* Rules list */}
            {loading ? (
                <div style={{ textAlign: 'center', padding: '80px', color: colors.textSecondary }}>{(lang === 'ru' ? 'Загрузка...' : (lang === 'en' ? 'Loading...' : 'Se incarca...'))}</div>
            ) : rules.length === 0 ? (
                <div style={{ ...g, padding: '48px', textAlign: 'center' }}>
                    <div style={{ fontSize: '14px', fontWeight: '600', color: colors.text }}>{(lang === 'ru' ? 'Правила не настроены' : (lang === 'en' ? 'No rules configured' : 'Nicio regulă configurată'))}</div>
                    <div style={{ fontSize: '12px', color: colors.textSecondary, marginTop: '6px' }}>{(lang === 'ru' ? 'Добавьте правило для автоматического сканирования' : (lang === 'en' ? 'Add a rule to configure automatic scanning' : 'Adaugă o regulă pentru a configura scanarea automată'))}</div>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {rules.map(rule => {
                        const scopeInfo = rule.scope_type === 'all' ? ((lang === 'ru' ? 'Все бренды и рестораны' : (lang === 'en' ? 'All brands and restaurants' : 'Toate brandurile si restaurantele')))
                            : rule.scope_type === 'brand' ? `${(lang === 'ru' ? 'Branduri' : (lang === 'en' ? 'Brands' : 'Branduri'))}: ${(rule.brand_ids || [rule.brand_id]).filter(Boolean).map(id => brands.find(b => b.id === id)?.name || '?').join(', ')}`
                            : `${(lang === 'ru' ? 'Рестораны' : (lang === 'en' ? 'Restaurants' : 'Restaurante'))}: ${(rule.restaurant_ids || [rule.restaurant_id]).filter(Boolean).length} ${(lang === 'ru' ? 'выбрано' : (lang === 'en' ? 'selected' : 'selectate'))}`
                        const schedInfo = rule.schedule_frequency === 'manual' ? ((lang === 'ru' ? 'Ручной' : (lang === 'en' ? 'Manual' : 'Manual')))
                            : `${freqLabel(rule.schedule_frequency)} ${(lang === 'ru' ? 'в' : (lang === 'en' ? 'at' : 'la'))} ${rule.schedule_time || '08:00'}${rule.schedule_frequency === 'weekly' && rule.schedule_days?.length ? ` (${rule.schedule_days.map(d => {
                                const dayObj = DAYS.find(x => x.d === d);
                                return dayObj ? (lang === 'en' ? dayObj.en.slice(0,3) : dayObj.d.slice(0,3)) : d.slice(0,3);
                            }).join(', ')})` : ''}`
                        return (
                            <div key={rule.id} style={{ ...g, padding: '18px 24px', display: 'flex', alignItems: 'center', gap: '16px', opacity: rule.is_active ? 1 : 0.5, transition: 'opacity 0.2s', animation: 'fadeUp 0.3s ease both' }}>
                                <div style={{ width: 42, height: 42, borderRadius: '12px', background: rule.scope_type === 'all' ? 'rgba(99,102,241,0.1)' : rule.scope_type === 'brand' ? 'rgba(139,92,246,0.1)' : 'rgba(34,197,94,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', flexShrink: 0 }}>
                                    {rule.scope_type === 'all' ? '🌐' : rule.scope_type === 'brand' ? '🏷️' : '🏠'}
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: '14px', fontWeight: '700', color: colors.text, marginBottom: '2px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                        {rule.name}
                                        <span style={{ fontSize: '10px', fontWeight: '800', padding: '2px 6px', borderRadius: '5px', background: rule.is_active ? 'rgba(34,197,94,0.12)' : 'rgba(255,149,0,0.12)', color: rule.is_active ? '#22c55e' : '#FF9500' }}>
                                            {rule.is_active ? ((lang === 'ru' ? 'АКТИВЕН' : (lang === 'en' ? 'ACTIVE' : 'ACTIV'))) : ((lang === 'ru' ? 'НЕАКТИВЕН' : (lang === 'en' ? 'INACTIVE' : 'INACTIV')))}
                                        </span>
                                    </div>
                                    <div style={{ fontSize: '11px', color: colors.textSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {scopeInfo} · {(lang === 'ru' ? 'Платформы' : (lang === 'en' ? 'Platforms' : 'Platforme'))}: {(rule.platforms || []).join(', ')}
                                    </div>
                                    <div style={{ fontSize: '11px', color: '#6366F1', fontWeight: '600', marginTop: '2px' }}>
                                        📅 {schedInfo}
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                                    <button onClick={() => openEdit(rule)} style={{ padding: '6px 14px', borderRadius: '8px', border: `1px solid ${colors.border}`, background: 'transparent', cursor: 'pointer', fontSize: '11px', fontWeight: '600', color: '#6366F1' }}>{(lang === 'ru' ? 'Editează' : (lang === 'en' ? 'Edit' : 'Editează'))}</button>
                                    <button onClick={() => toggleActive(rule.id, rule.is_active)} style={{ padding: '6px 12px', borderRadius: '8px', border: `1px solid ${colors.border}`, background: 'transparent', cursor: 'pointer', fontSize: '11px', fontWeight: '600', color: rule.is_active ? '#FF9500' : '#22c55e' }}>
                                        {rule.is_active ? ((lang === 'ru' ? 'Деактив.' : (lang === 'en' ? 'Deactivate' : 'Dezactiv.'))) : ((lang === 'ru' ? 'Активировать' : (lang === 'en' ? 'Activate' : 'Activeaza')))}
                                    </button>
                                    <button onClick={() => setDeleteConfirm(rule.id)} style={{ padding: '6px 12px', borderRadius: '8px', border: '1px solid rgba(239,68,68,0.2)', background: 'transparent', cursor: 'pointer', fontSize: '11px', fontWeight: '600', color: '#ef4444' }}>{(lang === 'ru' ? 'Sterge' : (lang === 'en' ? 'Delete' : 'Sterge'))}</button>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}

            <style>{`@keyframes fadeUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }`}</style>
        </div>
    )
}
