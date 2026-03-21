import { useState, useEffect, useMemo } from 'react'
import { useTheme } from '../lib/ThemeContext'
import { useLanguage } from '../lib/LanguageContext'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../lib/AuthContext'

// All available pages in the app
const ALL_PAGES = [
    { path: '/dashboard',            label: 'Dashboard',            icon: '📊' },
    { path: '/monitoring',           label: 'Monitoring',           icon: '📡' },
    { path: '/stop-control',         label: 'Stop Control',         icon: '🛑' },
    { path: '/stop-preturi',         label: 'Comparație Prețuri',   icon: '💰' },
    { path: '/stop-istoric',         label: 'Istoric Stop',         icon: '🕐' },
    { path: '/own-products',         label: 'Produse Proprii',      icon: '🏠' },
    { path: '/brands',               label: 'Branduri',             icon: '⭐' },
    { path: '/restaurants',          label: 'Restaurante',          icon: '☕' },
    { path: '/marketing',            label: 'Marketing',            icon: '🎯' },
    { path: '/marketing-analytics',  label: 'Marketing Analytics',  icon: '📈' },
    { path: '/marketing-promotions', label: 'Radar Promoții',       icon: '🏷️' },
    { path: '/competitors',          label: 'Competitori',          icon: '👥' },
    { path: '/competitor-products',  label: 'Produse Competitori',  icon: '🛒' },
    { path: '/alerts',               label: 'Alerte',               icon: '🔔' },
    { path: '/events',               label: 'Evenimente',           icon: '📅' },
    { path: '/rules',                label: 'Reguli',               icon: '📋' },
    { path: '/reports',              label: 'Rapoarte',             icon: '📊' },
    { path: '/delivery-zone',        label: 'Zone Livrare',         icon: '🚚' },
    { path: '/users',                label: 'Utilizatori',          icon: '👤' },
    { path: '/settings',             label: 'Setări',               icon: '⚙️' },
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

// Default permissions (fallback if DB is empty)
const DEFAULT_PERMISSIONS = {
    admin: '*',
    manager: ['/dashboard', '/monitoring', '/stop-control', '/stop-preturi', '/stop-istoric', '/marketing', '/marketing-analytics', '/marketing-promotions', '/competitors', '/competitor-products', '/brands', '/restaurants', '/alerts', '/events', '/reports', '/delivery-zone'],
    operational: ['/dashboard', '/monitoring', '/stop-control', '/stop-preturi', '/stop-istoric', '/restaurants', '/alerts', '/events', '/rules', '/delivery-zone'],
    marketing: ['/marketing', '/marketing-analytics', '/marketing-promotions', '/competitors', '/competitor-products', '/brands'],
    area_manager: ['/dashboard', '/monitoring', '/stop-control', '/stop-preturi', '/stop-istoric', '/restaurants', '/alerts', '/events', '/reports', '/delivery-zone'],
    manager_restaurant: ['/dashboard', '/monitoring', '/stop-control', '/stop-preturi', '/stop-istoric', '/alerts', '/events'],
    analyst: ['/dashboard', '/monitoring', '/competitors', '/competitor-products', '/brands', '/restaurants', '/alerts', '/reports', '/delivery-zone'],
    viewer: ['/dashboard', '/alerts'],
}

function glass(dk) {
    return { background: dk ? 'rgba(30,32,40,0.65)' : '#fff', backdropFilter: dk ? 'blur(24px) saturate(180%)' : 'none', WebkitBackdropFilter: dk ? 'blur(24px) saturate(180%)' : 'none', borderRadius: '20px', border: dk ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.08)', boxShadow: dk ? '0 8px 32px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)' : '0 2px 12px rgba(0,0,0,0.08)' }
}

export default function Settings() {
    const { lang } = useLanguage()
    const { colors, isDark } = useTheme()
    const { refreshPermissions } = useAuth()
    const g = glass(isDark)
    const t = (ro, en) => lang === 'en' ? en : ro

    const [permissions, setPermissions] = useState({}) // role -> [paths] or '*'
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [saved, setSaved] = useState(false)
    const [dbError, setDbError] = useState(null)

    // Load permissions from DB
    useEffect(() => {
        async function load() {
            const { data, error } = await supabase
                .from('role_permissions')
                .select('role, allowed_paths')

            if (error) {
                // Table might not exist yet — use defaults
                console.warn('[Settings] role_permissions table not found, using defaults:', error.message)
                setDbError(error.message)
                setPermissions({ ...DEFAULT_PERMISSIONS })
                setLoading(false)
                return
            }

            if (!data || data.length === 0) {
                // Empty table — seed with defaults
                setPermissions({ ...DEFAULT_PERMISSIONS })
                setLoading(false)
                return
            }

            // Build permissions map from DB
            const perms = {}
            data.forEach(row => {
                if (row.role === 'admin') {
                    perms.admin = '*'
                } else {
                    perms[row.role] = row.allowed_paths || []
                }
            })
            // Fill in any missing roles with defaults
            ROLES.forEach(r => {
                if (!perms[r.value]) perms[r.value] = DEFAULT_PERMISSIONS[r.value] || []
            })
            setPermissions(perms)
            setLoading(false)
        }
        load()
    }, [])

    const isPageAllowed = (role, path) => {
        if (role === 'admin') return true
        const allowed = permissions[role]
        if (allowed === '*') return true
        return Array.isArray(allowed) && allowed.includes(path)
    }

    const togglePage = (role, path) => {
        if (role === 'admin') return // admin always has access
        setPermissions(prev => {
            const current = Array.isArray(prev[role]) ? [...prev[role]] : []
            const idx = current.indexOf(path)
            if (idx >= 0) current.splice(idx, 1)
            else current.push(path)
            return { ...prev, [role]: current }
        })
        setSaved(false)
    }

    const toggleAllForRole = (role) => {
        if (role === 'admin') return
        const allPaths = ALL_PAGES.map(p => p.path)
        const current = Array.isArray(permissions[role]) ? permissions[role] : []
        const allChecked = allPaths.every(p => current.includes(p))
        setPermissions(prev => ({
            ...prev,
            [role]: allChecked ? [] : [...allPaths]
        }))
        setSaved(false)
    }

    const toggleAllForPage = (path) => {
        const nonAdminRoles = ROLES.filter(r => r.value !== 'admin')
        const allChecked = nonAdminRoles.every(r => isPageAllowed(r.value, path))
        setPermissions(prev => {
            const next = { ...prev }
            nonAdminRoles.forEach(r => {
                const current = Array.isArray(next[r.value]) ? [...next[r.value]] : []
                if (allChecked) {
                    next[r.value] = current.filter(p => p !== path)
                } else {
                    if (!current.includes(path)) current.push(path)
                    next[r.value] = current
                }
            })
            return next
        })
        setSaved(false)
    }

    const resetToDefaults = () => {
        setPermissions({ ...DEFAULT_PERMISSIONS })
        setSaved(false)
    }

    const savePermissions = async () => {
        setSaving(true)
        try {
            // Upsert all role permissions
            const rows = ROLES.map(r => ({
                role: r.value,
                allowed_paths: r.value === 'admin' ? ALL_PAGES.map(p => p.path) : (permissions[r.value] || []),
            }))

            // Delete existing and insert fresh
            await supabase.from('role_permissions').delete().neq('role', '__never__')
            const { error } = await supabase.from('role_permissions').insert(rows)
            if (error) throw error

            setSaved(true)
            setDbError(null)
            await refreshPermissions() // reload permissions in Auth context
            setTimeout(() => setSaved(false), 3000)
        } catch (err) {
            alert(t(`Eroare la salvare: ${err.message}`, `Save error: ${err.message}`))
        }
        setSaving(false)
    }

    // Count permissions per role
    const permCounts = useMemo(() => {
        const counts = {}
        ROLES.forEach(r => {
            counts[r.value] = r.value === 'admin' ? ALL_PAGES.length : (Array.isArray(permissions[r.value]) ? permissions[r.value].length : 0)
        })
        return counts
    }, [permissions])

    const MIGRATION_SQL = `CREATE TABLE IF NOT EXISTS public.role_permissions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  role text NOT NULL UNIQUE,
  allowed_paths text[] NOT NULL DEFAULT '{}',
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for authenticated" ON public.role_permissions
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Seed with default permissions
INSERT INTO public.role_permissions (role, allowed_paths) VALUES
  ('admin', ARRAY['/dashboard','/monitoring','/stop-control','/stop-preturi','/stop-istoric','/own-products','/brands','/restaurants','/marketing','/marketing-analytics','/marketing-promotions','/competitors','/competitor-products','/alerts','/events','/rules','/reports','/delivery-zone','/users','/settings']),
  ('manager', ARRAY['/dashboard','/monitoring','/stop-control','/stop-preturi','/stop-istoric','/marketing','/marketing-analytics','/marketing-promotions','/competitors','/competitor-products','/brands','/restaurants','/alerts','/events','/reports','/delivery-zone']),
  ('operational', ARRAY['/dashboard','/monitoring','/stop-control','/stop-preturi','/stop-istoric','/restaurants','/alerts','/events','/rules','/delivery-zone']),
  ('marketing', ARRAY['/marketing','/marketing-analytics','/marketing-promotions','/competitors','/competitor-products','/brands']),
  ('area_manager', ARRAY['/dashboard','/monitoring','/stop-control','/stop-preturi','/stop-istoric','/restaurants','/alerts','/events','/reports','/delivery-zone']),
  ('manager_restaurant', ARRAY['/dashboard','/monitoring','/stop-control','/stop-preturi','/stop-istoric','/alerts','/events']),
  ('analyst', ARRAY['/dashboard','/monitoring','/competitors','/competitor-products','/brands','/restaurants','/alerts','/reports','/delivery-zone']),
  ('viewer', ARRAY['/dashboard','/alerts'])
ON CONFLICT (role) DO UPDATE SET allowed_paths = EXCLUDED.allowed_paths, updated_at = now();`

    if (dbError) {
        return (
            <div style={{ padding: '40px', maxWidth: '800px' }}>
                <div style={{ ...g, padding: '32px' }}>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', marginBottom: '20px' }}>
                        <div style={{ fontSize: '28px' }}>⚠️</div>
                        <div>
                            <div style={{ fontWeight: '700', color: colors.text, fontSize: '16px' }}>
                                {t('Tabelul role_permissions lipsește', 'Table role_permissions missing')}
                            </div>
                            <div style={{ fontSize: '13px', color: colors.textSecondary, marginTop: '4px' }}>
                                {t('Rulați SQL-ul de mai jos în Supabase → SQL Editor pentru a crea tabelul de permisiuni', 'Run the SQL below in Supabase → SQL Editor to create the permissions table')}
                            </div>
                        </div>
                        <button onClick={() => navigator.clipboard.writeText(MIGRATION_SQL)}
                            style={{ marginLeft: 'auto', padding: '8px 16px', borderRadius: '10px', border: `1px solid ${colors.border}`, background: 'rgba(99,102,241,0.1)', color: '#6366F1', fontSize: '12px', fontWeight: '700', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                            📋 {t('Copiază SQL', 'Copy SQL')}
                        </button>
                    </div>
                    <pre style={{ background: isDark ? 'rgba(0,0,0,0.4)' : '#f8f9fa', borderRadius: '12px', padding: '18px', fontSize: '11px', fontFamily: 'monospace', color: isDark ? '#a5f3fc' : '#0f172a', overflowX: 'auto', margin: 0, lineHeight: 1.6 }}>{MIGRATION_SQL}</pre>
                </div>
            </div>
        )
    }

    return (
        <div style={{ padding: '24px 28px', minHeight: '100vh' }}>

            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
                <div>
                    <h1 style={{ margin: 0, fontSize: '22px', fontWeight: '800', color: colors.text, letterSpacing: '-0.5px' }}>
                        ⚙️ {t('Setări Roluri', 'Role Settings')}
                    </h1>
                    <p style={{ margin: '4px 0 0', fontSize: '13px', color: colors.textSecondary }}>
                        {t('Configurează ce pagini vede fiecare rol — modificările se aplică imediat după salvare', 'Configure which pages each role can access — changes apply immediately after saving')}
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={resetToDefaults}
                        style={{ padding: '9px 16px', borderRadius: '10px', border: `1px solid ${colors.border}`, background: 'transparent', color: colors.textSecondary, fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>
                        🔄 {t('Resetează', 'Reset defaults')}
                    </button>
                    <button onClick={savePermissions} disabled={saving}
                        style={{ padding: '9px 20px', borderRadius: '10px', border: 'none', background: saved ? '#10b981' : '#6366F1', color: 'white', fontSize: '13px', fontWeight: '700', cursor: 'pointer', boxShadow: `0 2px 12px ${saved ? 'rgba(16,185,129,0.35)' : 'rgba(99,102,241,0.35)'}`, opacity: saving ? 0.7 : 1, transition: 'all 0.2s' }}>
                        {saving ? '...' : saved ? `✓ ${t('Salvat!', 'Saved!')}` : `💾 ${t('Salvează', 'Save')}`}
                    </button>
                </div>
            </div>

            {/* Permission Matrix */}
            {loading ? (
                <div style={{ textAlign: 'center', padding: '80px', color: colors.textSecondary }}>
                    <div style={{ width: 36, height: 36, border: `3px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}`, borderTopColor: '#6366F1', borderRadius: '50%', animation: 'spin 0.7s linear infinite', margin: '0 auto 16px' }} />
                    {t('Se încarcă...', 'Loading...')}
                </div>
            ) : (
                <div style={{ ...g, overflow: 'hidden' }}>
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', minWidth: '900px' }}>
                            <thead>
                                <tr>
                                    <th style={{ padding: '14px 16px', textAlign: 'left', fontWeight: '700', color: colors.textSecondary, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`, position: 'sticky', left: 0, background: isDark ? 'rgba(30,32,40,0.95)' : 'rgba(255,255,255,0.98)', zIndex: 2, minWidth: '200px' }}>
                                        {t('Pagină', 'Page')}
                                    </th>
                                    {ROLES.map(r => (
                                        <th key={r.value} style={{ padding: '14px 8px', textAlign: 'center', borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`, minWidth: '90px' }}>
                                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                                                <span style={{ fontSize: '11px', fontWeight: '800', color: r.color, padding: '2px 8px', borderRadius: '6px', background: `${r.color}15` }}>
                                                    {r.label}
                                                </span>
                                                <span style={{ fontSize: '10px', color: colors.textSecondary }}>
                                                    {permCounts[r.value]}/{ALL_PAGES.length}
                                                </span>
                                                {r.value !== 'admin' && (
                                                    <button onClick={() => toggleAllForRole(r.value)}
                                                        style={{ fontSize: '9px', padding: '2px 6px', borderRadius: '4px', border: `1px solid ${colors.border}`, background: 'transparent', color: colors.textSecondary, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                                                        {permCounts[r.value] === ALL_PAGES.length ? t('Deselectează', 'Uncheck all') : t('Selectează tot', 'Check all')}
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
                                        <td style={{ padding: '10px 16px', fontWeight: '600', color: colors.text, position: 'sticky', left: 0, background: isDark ? 'rgba(30,32,40,0.95)' : 'rgba(255,255,255,0.98)', zIndex: 1 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <span style={{ fontSize: '16px' }}>{page.icon}</span>
                                                <div>
                                                    <div style={{ fontSize: '13px' }}>{page.label}</div>
                                                    <div style={{ fontSize: '10px', color: colors.textSecondary, fontFamily: 'monospace' }}>{page.path}</div>
                                                </div>
                                                <button onClick={() => toggleAllForPage(page.path)}
                                                    title={t('Toggle all roles', 'Toggle all roles')}
                                                    style={{ marginLeft: 'auto', fontSize: '9px', padding: '2px 6px', borderRadius: '4px', border: `1px solid ${colors.border}`, background: 'transparent', color: colors.textSecondary, cursor: 'pointer', opacity: 0.6 }}>
                                                    ↔
                                                </button>
                                            </div>
                                        </td>
                                        {ROLES.map(r => {
                                            const allowed = isPageAllowed(r.value, page.path)
                                            const isAdmin = r.value === 'admin'
                                            return (
                                                <td key={r.value} style={{ padding: '10px 8px', textAlign: 'center' }}>
                                                    <button
                                                        onClick={() => togglePage(r.value, page.path)}
                                                        disabled={isAdmin}
                                                        style={{
                                                            width: 32, height: 32, borderRadius: '8px', border: 'none',
                                                            cursor: isAdmin ? 'default' : 'pointer',
                                                            background: allowed ? `${r.color}18` : (isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)'),
                                                            color: allowed ? r.color : (isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)'),
                                                            fontSize: '16px', lineHeight: 1,
                                                            transition: 'all 0.15s',
                                                            opacity: isAdmin ? 0.6 : 1,
                                                        }}>
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

            <style>{`
                @keyframes spin { to { transform: rotate(360deg); } }
                @keyframes fadeUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
            `}</style>
        </div>
    )
}
