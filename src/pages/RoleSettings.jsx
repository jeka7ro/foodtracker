import { useState, useEffect } from 'react'
import { useTheme } from '../lib/ThemeContext'
import { useLanguage } from '../lib/LanguageContext'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabaseClient'

const ALL_PAGES = [
    { path: '/dashboard',            label: 'Dashboard' },
    { path: '/monitoring',           label: 'Monitoring' },
    { path: '/stop-control',         label: 'Stop Control' },
    { path: '/stop-preturi',         label: 'Comparatie Preturi' },
    { path: '/stop-istoric',         label: 'Istoric Stop' },
    { path: '/own-products',         label: 'Produse Proprii' },
    { path: '/brands',               label: 'Branduri' },
    { path: '/restaurants',          label: 'Restaurante' },
    { path: '/marketing',            label: 'Marketing' },
    { path: '/marketing-analytics',  label: 'Marketing Analytics' },
    { path: '/marketing-promotions', label: 'Radar Promotii' },
    { path: '/competitors',          label: 'Competitori' },
    { path: '/competitor-products',  label: 'Produse Competitori' },
    { path: '/alerts',               label: 'Alerte' },
    { path: '/events',               label: 'Evenimente' },
    { path: '/rules',                label: 'Reguli' },
    { path: '/reports',              label: 'Rapoarte' },
    { path: '/delivery-zone',        label: 'Zone Livrare' },
    { path: '/users',                label: 'Utilizatori' },
]

const ROLES = [
    { value: 'admin',               label: 'Admin',              color: '#ef4444' },
    { value: 'manager',             label: 'Manager',            color: '#8b5cf6' },
    { value: 'operational',         label: 'Operational',        color: '#3b82f6' },
    { value: 'marketing',           label: 'Marketing',          color: '#f59e0b' },
    { value: 'area_manager',        label: 'Area Manager',       color: '#10b981' },
    { value: 'manager_restaurant',  label: 'Manager Restaurant', color: '#06b6d4' },
    { value: 'analyst',             label: 'Analyst',            color: '#6366f1' },
    { value: 'viewer',              label: 'Viewer',             color: '#6b7280' },
]

const DEFAULT_PERMS = {
    admin: '*',
    manager: ['/dashboard', '/monitoring', '/stop-control', '/stop-preturi', '/stop-istoric', '/marketing', '/marketing-analytics', '/marketing-promotions', '/competitors', '/competitor-products', '/brands', '/restaurants', '/alerts', '/events', '/reports', '/delivery-zone'],
    operational: ['/dashboard', '/monitoring', '/stop-control', '/stop-preturi', '/stop-istoric', '/restaurants', '/alerts', '/events', '/rules', '/delivery-zone'],
    marketing: ['/marketing', '/marketing-analytics', '/marketing-promotions', '/competitors', '/competitor-products', '/brands'],
    area_manager: ['/dashboard', '/monitoring', '/stop-control', '/stop-preturi', '/stop-istoric', '/restaurants', '/alerts', '/events', '/reports', '/delivery-zone'],
    manager_restaurant: ['/dashboard', '/monitoring', '/stop-control', '/stop-preturi', '/stop-istoric', '/alerts', '/events'],
    analyst: ['/dashboard', '/monitoring', '/competitors', '/competitor-products', '/brands', '/restaurants', '/alerts', '/reports', '/delivery-zone'],
    viewer: ['/dashboard', '/alerts'],
}

const PERM_SQL = `CREATE TABLE IF NOT EXISTS public.role_permissions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  role text NOT NULL UNIQUE,
  allowed_paths text[] NOT NULL DEFAULT '{}',
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for authenticated" ON public.role_permissions
  FOR ALL TO authenticated USING (true) WITH CHECK (true);`

export default function RoleSettings() {
    const { colors, isDark } = useTheme()
    const { lang } = useLanguage()
    const { refreshPermissions } = useAuth()
    const t = (ro, en, ru) => lang === 'ru' ? ru : (lang === 'en' ? en : ro)

    const [permissions, setPermissions] = useState({})
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [saved, setSaved] = useState(false)
    const [dbError, setDbError] = useState(null)

    useEffect(() => {
        async function load() {
            const { data, error } = await supabase.from('role_permissions').select('role, allowed_paths')
            if (error || !data || data.length === 0) {
                setPermissions({ ...DEFAULT_PERMS })
                setLoading(false)
                return
            }
            const perms = {}
            data.forEach(row => {
                perms[row.role] = row.role === 'admin' ? '*' : (row.allowed_paths || [])
            })
            ROLES.forEach(r => { if (!perms[r.value]) perms[r.value] = DEFAULT_PERMS[r.value] || [] })
            setPermissions(perms)
            setLoading(false)
        }
        load()
    }, [])

    const isAllowed = (role, path) => {
        if (role === 'admin') return true
        const a = permissions[role]
        return a === '*' || (Array.isArray(a) && a.includes(path))
    }

    const toggle = (role, path) => {
        if (role === 'admin') return
        setPermissions(prev => {
            const cur = Array.isArray(prev[role]) ? [...prev[role]] : []
            const i = cur.indexOf(path)
            i >= 0 ? cur.splice(i, 1) : cur.push(path)
            return { ...prev, [role]: cur }
        })
        setSaved(false)
    }

    const toggleAllRole = (role) => {
        if (role === 'admin') return
        const all = ALL_PAGES.map(p => p.path)
        const cur = Array.isArray(permissions[role]) ? permissions[role] : []
        setPermissions(prev => ({ ...prev, [role]: all.every(p => cur.includes(p)) ? [] : [...all] }))
        setSaved(false)
    }

    const save = async () => {
        setSaving(true)
        try {
            const rows = ROLES.map(r => ({ role: r.value, allowed_paths: r.value === 'admin' ? ALL_PAGES.map(p => p.path) : (permissions[r.value] || []) }))
            await supabase.from('role_permissions').delete().neq('role', '__never__')
            const { error } = await supabase.from('role_permissions').insert(rows)
            if (error) {
                if (error.code === '42P01' || error.message?.includes('role_permissions')) setDbError(error.message)
                throw error
            }
            setSaved(true)
            setDbError(null)
            if (refreshPermissions) await refreshPermissions()
            setTimeout(() => setSaved(false), 3000)
        } catch (err) {
            if (!dbError) alert(`${t('Eroare la salvare', 'Save error', 'Ошибка при сохранении')}: ${err.message}`)
        }
        setSaving(false)
    }

    const reset = () => { setPermissions({ ...DEFAULT_PERMS }); setSaved(false) }

    const countFor = (role) => role === 'admin' ? ALL_PAGES.length : (Array.isArray(permissions[role]) ? permissions[role].length : 0)

    if (dbError) {
        return (
            <div style={{ padding: '28px 32px', maxWidth: '900px' }}>
                <h1 style={{ margin: 0, fontSize: '22px', fontWeight: '800', color: colors.text, letterSpacing: '-0.5px' }}>
                    {t('Setari Roluri', 'Role Settings', 'Настройки ролей')}
                </h1>
                <div style={{ background: colors.card, border: `1px solid rgba(245,158,11,0.4)`, borderRadius: '16px', padding: '28px', marginTop: '20px' }}>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', marginBottom: '18px' }}>
                        <div style={{ fontWeight: '700', color: colors.text, fontSize: '15px' }}>{t('Tabelul role_permissions lipseste', 'Table role_permissions missing', 'Таблица role_permissions отсутствует')}</div>
                        <button onClick={() => navigator.clipboard.writeText(PERM_SQL)} style={{ marginLeft: 'auto', padding: '8px 14px', borderRadius: '8px', border: `1px solid ${colors.border}`, background: 'transparent', color: colors.text, fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>
                            {t('Copiaza SQL', 'Copy SQL', 'Копировать SQL')}
                        </button>
                    </div>
                    <pre style={{ background: isDark ? 'rgba(0,0,0,0.4)' : '#f8f9fa', borderRadius: '10px', padding: '16px', fontSize: '11px', fontFamily: 'monospace', color: isDark ? '#a5f3fc' : '#0f172a', overflowX: 'auto', margin: 0, lineHeight: 1.6 }}>{PERM_SQL}</pre>
                </div>
            </div>
        )
    }

    return (
        <div style={{ padding: '28px 32px', maxWidth: '1100px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
                <div>
                    <h1 style={{ margin: 0, fontSize: '22px', fontWeight: '800', color: colors.text, letterSpacing: '-0.5px' }}>
                        {t('Setari Roluri', 'Role Settings', 'Настройки ролей')}
                    </h1>
                    <p style={{ margin: '4px 0 0', fontSize: '13px', color: colors.textSecondary }}>
                        {t('Configureaza ce pagini vede fiecare rol', 'Configure which pages each role can access', 'Настроить доступ к страницам для каждой роли')}
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={reset}
                        style={{ padding: '9px 16px', borderRadius: '10px', border: `1px solid ${colors.border}`, background: 'transparent', color: colors.textSecondary, fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>
                        {t('Reseteaza', 'Reset', 'Сбросить')}
                    </button>
                    <button onClick={save} disabled={saving}
                        style={{ padding: '9px 20px', borderRadius: '10px', border: 'none', background: saved ? '#10b981' : '#6366F1', color: 'white', fontSize: '13px', fontWeight: '700', cursor: 'pointer', boxShadow: `0 2px 12px ${saved ? 'rgba(16,185,129,0.35)' : 'rgba(99,102,241,0.35)'}`, opacity: saving ? 0.7 : 1, transition: 'all 0.2s' }}>
                        {saving ? '...' : saved ? t('Salvat!', 'Saved!', 'Сохранено!') : t('Salveaza', 'Save', 'Сохранить')}
                    </button>
                </div>
            </div>

            {loading ? (
                <div style={{ textAlign: 'center', padding: '60px', color: colors.textSecondary, fontSize: '13px' }}>{t('Se incarca...', 'Loading...', 'Загрузка...')}</div>
            ) : (
                <div style={{ background: colors.card, border: `1px solid ${colors.border}`, borderRadius: '14px', overflow: 'hidden' }}>
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', minWidth: '900px' }}>
                            <thead>
                                <tr>
                                    <th style={{ padding: '14px 16px', textAlign: 'left', fontWeight: '700', color: colors.textSecondary, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`, position: 'sticky', left: 0, background: isDark ? colors.card : '#fff', zIndex: 2, minWidth: '200px' }}>
                                        {t('Pagina', 'Page', 'Страница')}
                                    </th>
                                    {ROLES.map(r => (
                                        <th key={r.value} style={{ padding: '14px 8px', textAlign: 'center', borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`, minWidth: '90px' }}>
                                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                                                <span style={{ fontSize: '11px', fontWeight: '800', color: r.color, padding: '2px 8px', borderRadius: '6px', background: `${r.color}15` }}>{r.label}</span>
                                                <span style={{ fontSize: '10px', color: colors.textSecondary }}>{countFor(r.value)}/{ALL_PAGES.length}</span>
                                                {r.value !== 'admin' && (
                                                    <button onClick={() => toggleAllRole(r.value)} style={{ fontSize: '9px', padding: '2px 6px', borderRadius: '4px', border: `1px solid ${colors.border}`, background: 'transparent', color: colors.textSecondary, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                                                        {countFor(r.value) === ALL_PAGES.length ? t('Deselecteaza', 'Uncheck', 'Снять выбор') : t('Selecteaza tot', 'Check all', 'Выбрать все')}
                                                    </button>
                                                )}
                                            </div>
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {ALL_PAGES.map((page, idx) => (
                                    <tr key={page.path} style={{ borderBottom: idx < ALL_PAGES.length - 1 ? `1px solid ${isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}` : 'none' }}
                                        onMouseOver={e => e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)'}
                                        onMouseOut={e => e.currentTarget.style.background = 'transparent'}>
                                        <td style={{ padding: '10px 16px', fontWeight: '600', color: colors.text, position: 'sticky', left: 0, background: isDark ? colors.card : '#fff', zIndex: 1 }}>
                                            <div>
                                                <div style={{ fontSize: '13px' }}>{page.label}</div>
                                                <div style={{ fontSize: '10px', color: colors.textSecondary, fontFamily: 'monospace' }}>{page.path}</div>
                                            </div>
                                        </td>
                                        {ROLES.map(r => {
                                            const allowed = isAllowed(r.value, page.path)
                                            const isAdmin = r.value === 'admin'
                                            return (
                                                <td key={r.value} style={{ padding: '10px 8px', textAlign: 'center' }}>
                                                    <button onClick={() => toggle(r.value, page.path)} disabled={isAdmin}
                                                        style={{ width: 32, height: 32, borderRadius: '8px', border: 'none', cursor: isAdmin ? 'default' : 'pointer', background: allowed ? `${r.color}18` : (isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)'), color: allowed ? r.color : (isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)'), fontSize: '16px', lineHeight: 1, transition: 'all 0.15s', opacity: isAdmin ? 0.6 : 1 }}>
                                                        {allowed ? '✓' : '—'}
                                                    </button>
                                                </td>
                                            )
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    )
}
