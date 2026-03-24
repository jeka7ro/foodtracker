import { useState, useEffect, useCallback, useRef } from 'react'
import { useTheme } from '../lib/ThemeContext'
import { useLanguage } from '../lib/LanguageContext'
import { useUserProfile } from '../lib/UserProfileContext'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../lib/AuthContext'
import RoleSettings from './RoleSettings'

const ROLES = [
    { value: 'admin',               label: 'Admin',              color: '#ef4444', bg: '#fef2f2' },
    { value: 'manager',             label: 'Manager',            color: '#8b5cf6', bg: '#f5f3ff' },
    { value: 'operational',         label: 'Operational',        color: '#3b82f6', bg: '#eff6ff' },
    { value: 'marketing',           label: 'Marketing',          color: '#f59e0b', bg: '#fffbeb' },
    { value: 'area_manager',        label: 'Area Manager',       color: '#10b981', bg: '#ecfdf5' },
    { value: 'manager_restaurant',  label: 'Manager Restaurant', color: '#06b6d4', bg: '#ecfeff' },
    { value: 'analyst',             label: 'Analyst',            color: '#6366f1', bg: '#eef2ff' },
    { value: 'viewer',              label: 'Viewer',             color: '#6b7280', bg: '#f9fafb' },
]

const ALERT_RHYTHMS = [
    { value: 'instant',  label: 'Instant',         icon: '⚡' },
    { value: 'hourly',   label: 'Orar',            icon: '🕐' },
    { value: 'daily',    label: 'Zilnic',           icon: '📅' },
    { value: 'weekly',   label: 'Săptămânal',      icon: '📆' },
    { value: 'none',     label: 'Nicio alertă',    icon: '🔕' },
]

function RoleBadge({ role, isDark }) {
    const r = ROLES.find(x => x.value === role)
    if (!r) return null
    return (
        <span style={{
            padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '700',
            background: isDark ? `${r.color}22` : r.bg,
            color: r.color, letterSpacing: '0.2px', whiteSpace: 'nowrap'
        }}>{r.label}</span>
    )
}

function Avatar({ user, size = 36 }) {
    const initial = (user?.full_name || user?.email || '?')[0].toUpperCase()
    const colors = ['#6366F1', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#06B6D4', '#EF4444']
    const bg = colors[(user?.email?.charCodeAt(0) || 0) % colors.length]
    if (user?.avatar_url) {
        return (
            <img src={user.avatar_url} alt={initial}
                style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
                onError={e => { e.currentTarget.style.display = 'none' }} />
        )
    }
    return (
        <div style={{
            width: size, height: size, borderRadius: '50%', background: bg,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'white', fontWeight: '700', fontSize: size * 0.38, flexShrink: 0
        }}>{initial}</div>
    )
}

export default function Users() {
    const { colors, isDark, toggleTheme } = useTheme()
    const { lang, setLang } = useLanguage()
    const { user: currentUser, updateDbUser } = useAuth()
    const { uploadAvatar } = useUserProfile()
    const fileRef = useRef()

    const [activeTab, setActiveTab] = useState('users') // 'users' or 'roles'
    const [users, setUsers] = useState([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [selected, setSelected] = useState(new Set())
    const [showInvite, setShowInvite] = useState(false)
    const [editUser, setEditUser] = useState(null)
    const [bulkRole, setBulkRole] = useState('')
    const [showBulkRole, setShowBulkRole] = useState(false)
    const [initError, setInitError] = useState('')

    // Invite form
    const [inviteFirst, setInviteFirst] = useState('')
    const [inviteLast, setInviteLast] = useState('')
    const [inviteEmail, setInviteEmail] = useState('')
    const [invitePhone, setInvitePhone] = useState('')
    const [invitePassword, setInvitePassword] = useState('')
    const [inviteConfirm, setInviteConfirm] = useState('')
    const [inviteRole, setInviteRole] = useState('viewer')
    const [inviting, setInviting] = useState(false)
    const [inviteError, setInviteError] = useState('')

    // Edit form (local state mirrors editUser)
    const [editForm, setEditForm] = useState({
        full_name: '', role: 'viewer', is_active: true,
        preferred_lang: 'ro', preferred_theme: 'dark', alert_rhythm: 'instant'
    })
    const editFileRef = useRef(null)

    const t = (ro, en) => lang === 'en' ? en : ro

    // ── Load ──────────────────────────────────────────────────────────────
    const loadUsers = useCallback(async () => {
        setLoading(true)
        const { data, error } = await supabase
            .from('user_roles')
            .select('*')
            .order('created_at', { ascending: false })

        if (error) { setInitError(error.message); setLoading(false); return }

        if ((data || []).length === 0 && currentUser) {
            await supabase.from('user_roles').insert({
                user_id: currentUser.id, email: currentUser.email,
                full_name: currentUser.email?.split('@')[0],
                role: 'admin', is_active: true
            })
            const { data: d2 } = await supabase.from('user_roles').select('*').order('created_at', { ascending: false })
            setUsers(d2 || [])
        } else {
            setUsers(data || [])
        }
        setLoading(false)
    }, [currentUser])

    useEffect(() => { loadUsers() }, [loadUsers])

    // ── Selection helpers ──────────────────────────────────────────────────
    const filtered = users.filter(u =>
        u.email?.toLowerCase().includes(search.toLowerCase()) ||
        u.full_name?.toLowerCase().includes(search.toLowerCase()) ||
        u.role?.toLowerCase().includes(search.toLowerCase())
    )
    const allSelected = filtered.length > 0 && filtered.every(u => selected.has(u.id))
    const someSelected = selected.size > 0

    const toggleSelect = (id) => setSelected(prev => {
        const n = new Set(prev)
        n.has(id) ? n.delete(id) : n.add(id)
        return n
    })
    const toggleAll = () => {
        if (allSelected) setSelected(new Set())
        else setSelected(new Set(filtered.map(u => u.id)))
    }
    const clearSelected = () => setSelected(new Set())

    // ── CRUD ───────────────────────────────────────────────────────────────
    const updateRole = async (id, newRole) => {
        setUsers(prev => prev.map(u => u.id === id ? { ...u, role: newRole } : u))
        await supabase.from('user_roles').update({ role: newRole }).eq('id', id)
    }

    const toggleActive = async (id, cur) => {
        setUsers(prev => prev.map(u => u.id === id ? { ...u, is_active: !cur } : u))
        await supabase.from('user_roles').update({ is_active: !cur }).eq('id', id)
    }

    const deleteUser = async (id) => {
        if (!confirm(t('Ești sigur că vrei să ștergi acest utilizator?', 'Are you sure you want to delete this user?'))) return
        setUsers(prev => prev.filter(u => u.id !== id))
        await supabase.from('user_roles').delete().eq('id', id)
        setSelected(prev => { const n = new Set(prev); n.delete(id); return n })
    }

    // ── Bulk actions ───────────────────────────────────────────────────────
    const bulkActivate = async () => {
        const ids = [...selected]
        setUsers(prev => prev.map(u => ids.includes(u.id) ? { ...u, is_active: true } : u))
        for (const id of ids) await supabase.from('user_roles').update({ is_active: true }).eq('id', id)
        clearSelected()
    }
    const bulkDeactivate = async () => {
        const ids = [...selected].filter(id => {
            const u = users.find(u => u.id === id)
            return u?.user_id !== currentUser?.id
        })
        setUsers(prev => prev.map(u => ids.includes(u.id) ? { ...u, is_active: false } : u))
        for (const id of ids) await supabase.from('user_roles').update({ is_active: false }).eq('id', id)
        clearSelected()
    }
    const bulkChangeRole = async () => {
        if (!bulkRole) return
        const ids = [...selected].filter(id => {
            const u = users.find(u => u.id === id)
            return u?.user_id !== currentUser?.id
        })
        setUsers(prev => prev.map(u => ids.includes(u.id) ? { ...u, role: bulkRole } : u))
        for (const id of ids) await supabase.from('user_roles').update({ role: bulkRole }).eq('id', id)
        setShowBulkRole(false); setBulkRole(''); clearSelected()
    }
    const bulkDelete = async () => {
        const ids = [...selected].filter(id => {
            const u = users.find(u => u.id === id)
            return u?.user_id !== currentUser?.id
        })
        if (!ids.length || !confirm(t(`Ștergi ${ids.length} utilizatori?`, `Delete ${ids.length} users?`))) return
        setUsers(prev => prev.filter(u => !ids.includes(u.id)))
        for (const id of ids) await supabase.from('user_roles').delete().eq('id', id)
        clearSelected()
    }

    // ── Invite ─────────────────────────────────────────────────────────────
    const inviteUser = async () => {
        if (!inviteEmail || !invitePassword) { setInviteError(t('Email și parolă obligatorii', 'Email and password required')); return }
        if (invitePassword !== inviteConfirm) { setInviteError(t('Parolele nu coincid', 'Passwords do not match')); return }
        if (invitePassword.length < 6) { setInviteError(t('Parola trebuie să aibă minim 6 caractere', 'Password must be at least 6 characters')); return }
        const fullName = [inviteFirst.trim(), inviteLast.trim()].filter(Boolean).join(' ') || inviteEmail.split('@')[0]
        setInviting(true); setInviteError('')
        try {
            const { data, error } = await supabase.auth.signUp({ email: inviteEmail, password: invitePassword })
            if (error) throw error
            if (data.user) {
                await supabase.from('user_roles').insert({
                    user_id: data.user.id, email: inviteEmail, full_name: fullName,
                    role: inviteRole, created_by: currentUser?.id, is_active: true
                })
                setUsers(prev => [{
                    id: `new_${Date.now()}`, user_id: data.user.id, email: inviteEmail,
                    full_name: fullName, role: inviteRole, is_active: true, created_at: new Date().toISOString()
                }, ...prev])
            }
            setShowInvite(false)
            setInviteFirst(''); setInviteLast(''); setInviteEmail(''); setInvitePhone('')
            setInvitePassword(''); setInviteConfirm(''); setInviteRole('viewer')
        } catch (err) { setInviteError(err.message) }
        finally { setInviting(false) }
    }

    // ── Edit slideout ──────────────────────────────────────────────────────
    const openEdit = (u) => {
        setEditUser(u)
        setEditForm({
            full_name:      u.full_name || '',
            role:           u.role || 'viewer',
            is_active:      u.is_active,
            preferred_lang: u.preferred_lang || 'ro',
            preferred_theme:u.preferred_theme || 'dark',
            alert_rhythm:   u.alert_rhythm || 'instant',
        })
    }
    const saveEdit = async () => {
        if (!editUser) return
        // Base columns — always exist in user_roles
        const basePatch = {
            full_name: editForm.full_name,
            role:      editForm.role,
            is_active: editForm.is_active,
        }
        // Extended columns — may not exist yet; try separately and ignore 400
        const extPatch = {
            preferred_lang:  editForm.preferred_lang,
            preferred_theme: editForm.preferred_theme,
            alert_rhythm:    editForm.alert_rhythm,
        }
        setUsers(prev => prev.map(u => u.id === editUser.id ? { ...u, ...basePatch, ...extPatch } : u))
        if (editUser.user_id === currentUser?.id || editUser.id === currentUser?.id) {
            updateDbUser(basePatch)
        }
        await supabase.from('user_roles').update(basePatch).eq('id', editUser.id)
        // Try extended columns — silently ignore if columns don't exist yet
        const { error: extErr } = await supabase.from('user_roles').update(extPatch).eq('id', editUser.id)
        if (extErr) {
            console.warn('[saveEdit] Extended columns not yet in DB. Run the SQL migration to add them.', extErr.message)
        }
        setEditUser(null)
    }

    // ── Error state ────────────────────────────────────────────────────────
    const MIGRATION_SQL = `CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'viewer',
  email text, full_name text, display_name text,
  avatar_url text, preferred_lang text DEFAULT 'ro',
  preferred_theme text DEFAULT 'dark', alert_rhythm text DEFAULT 'instant',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for authenticated" ON public.user_roles
  FOR ALL TO authenticated USING (true) WITH CHECK (true);`

    if (initError) return (
        <div style={{ padding: '40px', maxWidth: '720px' }}>
            <div style={{ background: colors.card, border: '1px solid rgba(245,158,11,0.4)', borderRadius: '16px', padding: '28px' }}>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', marginBottom: '18px' }}>
                    <div style={{ fontSize: '28px' }}>⚠️</div>
                    <div>
                        <div style={{ fontWeight: '700', color: colors.text, fontSize: '15px' }}>{t('Tabelul user_roles lipsește', 'Table user_roles missing')}</div>
                        <div style={{ fontSize: '12px', color: colors.textSecondary, marginTop: '4px' }}>{t('Rulați SQL-ul de mai jos în Supabase → SQL Editor', 'Run SQL below in Supabase → SQL Editor')}</div>
                    </div>
                    <button onClick={() => navigator.clipboard.writeText(MIGRATION_SQL)}
                        style={{ marginLeft: 'auto', padding: '8px 14px', borderRadius: '8px', border: `1px solid ${colors.border}`, background: 'transparent', color: colors.text, fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>
                        📋 {t('Copiază SQL', 'Copy SQL')}
                    </button>
                </div>
                <pre style={{ background: isDark ? 'rgba(0,0,0,0.4)' : '#f8f9fa', borderRadius: '10px', padding: '16px', fontSize: '11px', fontFamily: 'monospace', color: isDark ? '#a5f3fc' : '#0f172a', overflowX: 'auto', margin: 0, lineHeight: 1.6 }}>{MIGRATION_SQL}</pre>
            </div>
        </div>
    )


    return (
        <div style={{ padding: '28px 32px', maxWidth: '1100px' }}>

            {/* ── Header ── */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
                <div>
                    <h1 style={{ margin: 0, fontSize: '22px', fontWeight: '800', color: colors.text, letterSpacing: '-0.5px' }}>
                        {t('Utilizatori', 'Users')}
                    </h1>
                    <p style={{ margin: '4px 0 0', fontSize: '13px', color: colors.textSecondary }}>
                        {t('Gestionează accesul și rolurile echipei', 'Manage team access and roles')}
                    </p>
                </div>
                <button onClick={() => setShowInvite(true)} style={{
                    padding: '9px 20px', borderRadius: '10px', border: 'none', cursor: 'pointer',
                    background: '#6366F1', color: 'white', fontSize: '13px', fontWeight: '700',
                    display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 2px 12px rgba(99,102,241,0.35)'
                }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
                        <line x1="19" y1="8" x2="19" y2="14" /><line x1="22" y1="11" x2="16" y2="11" />
                    </svg>
                    {t('Adaugă utilizator', 'Add user')}
                </button>
            </div>
            {/* ── Tabs ── */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', borderBottom: `1px solid ${colors.border}`, paddingBottom: '12px' }}>
                <button onClick={() => setActiveTab('users')}
                    style={{ padding: '8px 16px', borderRadius: '10px', border: 'none', background: activeTab === 'users' ? (isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)') : 'transparent', color: activeTab === 'users' ? colors.text : colors.textSecondary, fontSize: '14px', fontWeight: '600', cursor: 'pointer', transition: 'all 0.2s' }}>
                    {t('Lista Utilizatori', 'Users List')}
                </button>
                <button onClick={() => setActiveTab('roles')}
                    style={{ padding: '8px 16px', borderRadius: '10px', border: 'none', background: activeTab === 'roles' ? (isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)') : 'transparent', color: activeTab === 'roles' ? colors.text : colors.textSecondary, fontSize: '14px', fontWeight: '600', cursor: 'pointer', transition: 'all 0.2s' }}>
                    {t('Setări Roluri', 'Role Settings')}
                </button>
            </div>

            {activeTab === 'users' && (
                <>
                {/* ── Search + Bulk bar ── */}
            <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
                    <svg style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: colors.textSecondary }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
                    </svg>
                    <input value={search} onChange={e => setSearch(e.target.value)}
                        placeholder={t('Caută după email, nume sau rol…', 'Search by email, name or role…')}
                        style={{ width: '100%', paddingLeft: '36px', padding: '9px 12px 9px 36px', borderRadius: '10px', border: `1px solid ${colors.border}`, background: colors.card, color: colors.text, fontSize: '13px', boxSizing: 'border-box' }} />
                </div>

                {/* Bulk actions — shown only when something is selected */}
                {someSelected && (
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center', animation: 'fadeIn 0.15s ease' }}>
                        <span style={{ fontSize: '12px', color: colors.textSecondary, fontWeight: '600', marginRight: '4px' }}>
                            {selected.size} {t('selectați', 'selected')}
                        </span>

                        <button onClick={bulkActivate}
                            style={{ padding: '7px 12px', borderRadius: '8px', border: `1px solid ${colors.border}`, background: 'rgba(16,185,129,0.1)', color: '#10b981', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>
                            ✓ {t('Activează', 'Activate')}
                        </button>

                        <button onClick={bulkDeactivate}
                            style={{ padding: '7px 12px', borderRadius: '8px', border: `1px solid ${colors.border}`, background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)', color: colors.textSecondary, fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>
                            ⊘ {t('Dezactivează', 'Deactivate')}
                        </button>

                        <div style={{ position: 'relative' }}>
                            <button onClick={() => setShowBulkRole(v => !v)}
                                style={{ padding: '7px 12px', borderRadius: '8px', border: `1px solid ${colors.border}`, background: 'rgba(99,102,241,0.1)', color: '#6366F1', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>
                                ✎ {t('Schimbă rol', 'Change role')}
                            </button>
                            {showBulkRole && (
                                <div style={{ position: 'absolute', top: '110%', left: 0, zIndex: 200, background: colors.card, border: `1px solid ${colors.border}`, borderRadius: '10px', boxShadow: '0 8px 30px rgba(0,0,0,0.18)', minWidth: 180, padding: '6px' }}>
                                    {ROLES.map(r => (
                                        <button key={r.value} onClick={() => { setBulkRole(r.value); bulkChangeRole(); }}
                                            style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', background: 'transparent', border: 'none', borderRadius: '7px', color: r.color, fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}
                                            onMouseEnter={e => e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'}
                                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                            {r.label}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        <button onClick={bulkDelete}
                            style={{ padding: '7px 12px', borderRadius: '8px', border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.08)', color: '#ef4444', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>
                            🗑 {t('Șterge', 'Delete')}
                        </button>

                        <button onClick={clearSelected}
                            style={{ padding: '7px 8px', borderRadius: '8px', border: `1px solid ${colors.border}`, background: 'transparent', color: colors.textSecondary, fontSize: '12px', cursor: 'pointer' }}>
                            ✕
                        </button>
                    </div>
                )}
            </div>

            {/* ── Table ── */}
            <div style={{ background: colors.card, border: `1px solid ${colors.border}`, borderRadius: '14px', overflow: 'hidden' }}>
                {/* Header row */}
                <div style={{ display: 'grid', gridTemplateColumns: '44px 1fr 160px 140px 90px 110px', gap: '8px', padding: '10px 20px', background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)', borderBottom: `1px solid ${colors.border}`, alignItems: 'center' }}>
                    {/* Select-all checkbox */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <input type="checkbox" checked={allSelected} onChange={toggleAll}
                            style={{ width: 15, height: 15, cursor: 'pointer', accentColor: '#6366F1' }} />
                    </div>
                    {[t('Utilizator', 'User'), t('Rol', 'Role'), t('Data adăugare', 'Added'), 'Status', t('Acțiuni', 'Actions')].map(h => (
                        <span key={h} style={{ fontSize: '10px', fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{h}</span>
                    ))}
                </div>

                {loading ? (
                    <div style={{ padding: '48px', textAlign: 'center', color: colors.textSecondary, fontSize: '13px' }}>
                        {t('Se încarcă…', 'Loading…')}
                    </div>
                ) : filtered.length === 0 ? (
                    <div style={{ padding: '48px', textAlign: 'center', color: colors.textSecondary, fontSize: '13px' }}>
                        {t('Niciun utilizator găsit', 'No users found')}
                    </div>
                ) : filtered.map((u, i) => {
                    const isMe = u.user_id === currentUser?.id
                    const isSelected = selected.has(u.id)
                    return (
                        <div key={u.id} style={{
                            display: 'grid', gridTemplateColumns: '44px 1fr 160px 140px 90px 110px', gap: '8px',
                            padding: '11px 20px', alignItems: 'center',
                            borderBottom: i < filtered.length - 1 ? `1px solid ${isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}` : 'none',
                            background: isSelected ? (isDark ? 'rgba(99,102,241,0.08)' : 'rgba(99,102,241,0.04)') : 'transparent',
                            transition: 'background 0.1s',
                            opacity: u.is_active ? 1 : 0.55,
                        }}
                            onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)' }}
                            onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent' }}
                        >
                            {/* Checkbox */}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(u.id)}
                                    style={{ width: 15, height: 15, cursor: 'pointer', accentColor: '#6366F1' }} />
                            </div>

                            {/* User info */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                                <Avatar user={u} size={36} />
                                <div style={{ minWidth: 0 }}>
                                    <div style={{ fontSize: '13px', fontWeight: '600', color: colors.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        {u.full_name || u.email?.split('@')[0]}
                                        {isMe && <span style={{ fontSize: '9px', background: 'rgba(99,102,241,0.15)', color: '#6366F1', borderRadius: '4px', padding: '1px 5px', fontWeight: '800' }}>TU</span>}
                                    </div>
                                    <div style={{ fontSize: '11px', color: colors.textSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.email}</div>
                                </div>
                            </div>

                            {/* Role */}
                            <div><RoleBadge role={u.role} isDark={isDark} /></div>

                            {/* Date added */}
                            <span style={{ fontSize: '12px', color: colors.textSecondary }}>
                                {new Date(u.created_at).toLocaleDateString(lang === 'en' ? 'en-GB' : 'ro-RO')}
                            </span>

                            {/* Status */}
                            <span style={{
                                fontSize: '11px', fontWeight: '600', padding: '3px 10px', borderRadius: '20px',
                                background: u.is_active ? (isDark ? 'rgba(16,185,129,0.15)' : '#ecfdf5') : (isDark ? 'rgba(239,68,68,0.15)' : '#fef2f2'),
                                color: u.is_active ? '#10b981' : '#ef4444', display: 'inline-block'
                            }}>
                                {u.is_active ? t('Activ', 'Active') : t('Inactiv', 'Inactive')}
                            </span>

                            {/* Actions */}
                            <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
                                {/* Edit button */}
                                <button onClick={() => openEdit(u)} title={t('Editează', 'Edit')}
                                    style={{ padding: '5px 9px', borderRadius: '7px', border: `1px solid ${colors.border}`, background: 'transparent', color: colors.textSecondary, cursor: 'pointer', fontSize: '13px', display: 'flex', alignItems: 'center' }}>
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                    </svg>
                                </button>

                                {/* Toggle active */}
                                {!isMe && (
                                    <button onClick={() => toggleActive(u.id, u.is_active)} title={u.is_active ? t('Dezactivează', 'Deactivate') : t('Activează', 'Activate')}
                                        style={{ padding: '5px 9px', borderRadius: '7px', border: `1px solid ${colors.border}`, background: 'transparent', color: u.is_active ? '#f59e0b' : '#10b981', cursor: 'pointer', fontSize: '13px' }}>
                                        {u.is_active ? '⊘' : '✓'}
                                    </button>
                                )}

                                {/* Delete */}
                                {!isMe && (
                                    <button onClick={() => deleteUser(u.id)} title={t('Șterge', 'Delete')}
                                        style={{ padding: '5px 9px', borderRadius: '7px', border: '1px solid rgba(239,68,68,0.2)', background: 'transparent', color: '#ef4444', cursor: 'pointer', fontSize: '13px' }}>
                                        🗑
                                    </button>
                                )}
                            </div>
                        </div>
                    )
                })}
            </div>

            {/* Stats footer */}
            <div style={{ marginTop: '14px', display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
                {ROLES.map(r => {
                    const count = users.filter(u => u.role === r.value && u.is_active).length
                    if (!count) return null
                    return <span key={r.value} style={{ fontSize: '12px', color: colors.textSecondary }}><span style={{ color: r.color, fontWeight: '700' }}>{count}</span> {r.label}</span>
                })}
                <span style={{ fontSize: '12px', color: colors.textSecondary, marginLeft: 'auto' }}>
                    {users.filter(u => !u.is_active).length} {t('inactivi', 'inactive')}
                </span>
            </div>
            </>
            )}

            {activeTab === 'roles' && (
                <div style={{ margin: '-28px -32px' }}>
                    <RoleSettings />
                </div>
            )}


            {/* ══════════════════════════════════════════════════════════════
                EDIT USER SLIDEOUT
            ══════════════════════════════════════════════════════════════ */}
            {editUser && (
                <>
                    {/* Overlay */}
                    <div onClick={() => setEditUser(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 400 }} />

                    {/* Panel */}
                    <div style={{
                        position: 'fixed', top: 0, right: 0, bottom: 0, width: 420,
                        background: isDark ? '#1a1a1f' : '#fff',
                        borderLeft: `1px solid ${colors.border}`,
                        zIndex: 401, display: 'flex', flexDirection: 'column',
                        boxShadow: '-12px 0 40px rgba(0,0,0,0.2)',
                        animation: 'slideInRight 0.22s cubic-bezier(0.16,1,0.3,1)'
                    }}>
                        {/* Panel header */}
                        <div style={{ padding: '24px 28px', borderBottom: `1px solid ${colors.border}`, display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <Avatar user={editUser} size={44} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: '15px', fontWeight: '700', color: colors.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {editUser.full_name || editUser.email?.split('@')[0]}
                                </div>
                                <div style={{ fontSize: '12px', color: colors.textSecondary }}>{editUser.email}</div>
                            </div>
                            <button onClick={() => setEditUser(null)} style={{ padding: '6px', borderRadius: '8px', border: `1px solid ${colors.border}`, background: 'transparent', color: colors.textSecondary, cursor: 'pointer', fontSize: '16px', lineHeight: 1 }}>✕</button>
                        </div>

                        {/* Panel body — scrollable */}
                        <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: '24px' }}>

                            {/* Avatar upload */}
                            <div>
                                <label style={{ fontSize: '11px', fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '12px' }}>
                                    {t('Avatar', 'Avatar')}
                                </label>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                    <Avatar user={editUser} size={64} />
                                    <input ref={editFileRef} type="file" accept="image/*" style={{ display: 'none' }}
                                        onChange={async (e) => {
                                            const file = e.target.files[0]
                                            if (!file) return
                                            try {
                                                // Upload to Supabase Storage
                                                const ext = file.name.split('.').pop()
                                                const path = `avatars/${editUser.user_id || editUser.id}_${Date.now()}.${ext}`
                                                const { error: upErr } = await supabase.storage
                                                    .from('avatars').upload(path, file, { upsert: true })
                                                if (upErr) throw upErr
                                                const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path)
                                                const avatarUrl = urlData?.publicUrl
                                                if (!avatarUrl) throw new Error('Nu s-a putut obtine URL-ul pozei')
                                                // Save to user_roles
                                                await supabase.from('user_roles').update({ avatar_url: avatarUrl }).eq('id', editUser.id)
                                                // Update local state
                                                setEditUser(prev => ({ ...prev, avatar_url: avatarUrl }))
                                                setUsers(prev => prev.map(u => u.id === editUser.id ? { ...u, avatar_url: avatarUrl } : u))
                                                if (editUser.user_id === currentUser?.id || editUser.id === currentUser?.id) {
                                                    updateDbUser({ avatar_url: avatarUrl })
                                                }
                                            } catch(err) {
                                                alert(t(`Eroare la upload: ${err.message}`, `Upload error: ${err.message}`))
                                            }
                                            e.target.value = ''
                                        }} />
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                        <button onClick={() => editFileRef.current?.click()}
                                            style={{ padding: '8px 16px', borderRadius: '9px', border: `1px solid ${colors.border}`, background: isDark ? 'rgba(255,255,255,0.06)' : '#f5f5f7', color: colors.text, fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>
                                            {t('Schimbă poza', 'Change photo')}
                                        </button>
                                        {editUser.avatar_url && (
                                            <button onClick={async () => {
                                                await supabase.from('user_roles').update({ avatar_url: null }).eq('id', editUser.id)
                                                setEditUser(prev => ({ ...prev, avatar_url: null }))
                                                setUsers(prev => prev.map(u => u.id === editUser.id ? { ...u, avatar_url: null } : u))
                                                if (editUser.user_id === currentUser?.id || editUser.id === currentUser?.id) {
                                                    updateDbUser({ avatar_url: null })
                                                }
                                            }} style={{ padding: '6px 16px', borderRadius: '9px', border: '1px solid rgba(239,68,68,0.2)', background: 'transparent', color: '#ef4444', fontSize: '11px', fontWeight: '600', cursor: 'pointer' }}>
                                                {t('Sterge poza', 'Remove photo')}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Full name */}
                            <div>
                                <label style={{ fontSize: '11px', fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '8px' }}>
                                    {t('Nume complet', 'Full name')}
                                </label>
                                <input value={editForm.full_name || ''} onChange={e => setEditForm(f => ({ ...f, full_name: e.target.value }))}
                                    placeholder={t('Nume afișat…', 'Display name…')}
                                    style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: `1px solid ${colors.border}`, background: isDark ? 'rgba(255,255,255,0.05)' : '#f9fafb', color: colors.text, fontSize: '13px', boxSizing: 'border-box' }} />
                            </div>

                            {/* Role */}
                            <div>
                                <label style={{ fontSize: '11px', fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '8px' }}>
                                    {t('Rol', 'Role')}
                                </label>
                                <select value={editForm.role} onChange={e => setEditForm(f => ({ ...f, role: e.target.value }))}
                                    disabled={editUser.user_id === currentUser?.id}
                                    style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: `1px solid ${colors.border}`, background: isDark ? 'rgba(255,255,255,0.05)' : '#f9fafb', color: colors.text, fontSize: '13px' }}>
                                    {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                                </select>
                            </div>

                            {/* Preferred language */}
                            <div>
                                <label style={{ fontSize: '11px', fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '10px' }}>
                                    {t('Limbă preferată', 'Preferred language')}
                                </label>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    {[{ code: 'ro', label: '🇷🇴 Română' }, { code: 'en', label: '🇬🇧 English' }].map(l => (
                                        <button key={l.code} onClick={() => setEditForm(f => ({ ...f, preferred_lang: l.code }))}
                                            style={{ flex: 1, padding: '10px', borderRadius: '10px', border: `1px solid ${editForm.preferred_lang === l.code ? '#6366F1' : colors.border}`, background: editForm.preferred_lang === l.code ? 'rgba(99,102,241,0.12)' : (isDark ? 'rgba(255,255,255,0.04)' : '#f9fafb'), color: editForm.preferred_lang === l.code ? '#6366F1' : colors.text, fontSize: '13px', fontWeight: '600', cursor: 'pointer', transition: 'all 0.15s' }}>
                                            {l.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Preferred theme */}
                            <div>
                                <label style={{ fontSize: '11px', fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '10px' }}>
                                    {t('Temă preferată', 'Preferred theme')}
                                </label>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    {[{ v: 'light', label: '☀️ ' + t('Luminos', 'Light') }, { v: 'dark', label: '🌙 ' + t('Întunecat', 'Dark') }].map(o => (
                                        <button key={o.v} onClick={() => setEditForm(f => ({ ...f, preferred_theme: o.v }))}
                                            style={{ flex: 1, padding: '10px', borderRadius: '10px', border: `1px solid ${editForm.preferred_theme === o.v ? '#6366F1' : colors.border}`, background: editForm.preferred_theme === o.v ? 'rgba(99,102,241,0.12)' : (isDark ? 'rgba(255,255,255,0.04)' : '#f9fafb'), color: editForm.preferred_theme === o.v ? '#6366F1' : colors.text, fontSize: '13px', fontWeight: '600', cursor: 'pointer', transition: 'all 0.15s' }}>
                                            {o.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Alert rhythm */}
                            <div>
                                <label style={{ fontSize: '11px', fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '10px' }}>
                                    {t('Ritm alerte', 'Alert rhythm')}
                                </label>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                    {ALERT_RHYTHMS.map(r => (
                                        <button key={r.value} onClick={() => setEditForm(f => ({ ...f, alert_rhythm: r.value }))}
                                            style={{ padding: '10px 14px', borderRadius: '10px', border: `1px solid ${editForm.alert_rhythm === r.value ? '#6366F1' : colors.border}`, background: editForm.alert_rhythm === r.value ? 'rgba(99,102,241,0.12)' : (isDark ? 'rgba(255,255,255,0.04)' : '#f9fafb'), color: editForm.alert_rhythm === r.value ? '#6366F1' : colors.text, fontSize: '13px', fontWeight: '600', cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <span style={{ fontSize: '18px' }}>{r.icon}</span>
                                            <span>{r.label}</span>
                                            {editForm.alert_rhythm === r.value && <span style={{ marginLeft: 'auto', fontSize: '16px' }}>✓</span>}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Active status */}
                            {editUser.user_id !== currentUser?.id && (
                                <div>
                                    <label style={{ fontSize: '11px', fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '10px' }}>
                                        Status
                                    </label>
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        {[{ v: true, label: '✓ ' + t('Activ', 'Active'), color: '#10b981' }, { v: false, label: '⊘ ' + t('Inactiv', 'Inactive'), color: '#ef4444' }].map(o => (
                                            <button key={String(o.v)} onClick={() => setEditForm(f => ({ ...f, is_active: o.v }))}
                                                style={{ flex: 1, padding: '10px', borderRadius: '10px', border: `1px solid ${editForm.is_active === o.v ? o.color : colors.border}`, background: editForm.is_active === o.v ? `${o.color}18` : (isDark ? 'rgba(255,255,255,0.04)' : '#f9fafb'), color: editForm.is_active === o.v ? o.color : colors.textSecondary, fontSize: '13px', fontWeight: '600', cursor: 'pointer', transition: 'all 0.15s' }}>
                                                {o.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Panel footer */}
                        <div style={{ padding: '20px 28px', borderTop: `1px solid ${colors.border}`, display: 'flex', gap: '10px' }}>
                            <button onClick={() => setEditUser(null)}
                                style={{ flex: 1, padding: '11px', borderRadius: '10px', border: `1px solid ${colors.border}`, background: 'transparent', color: colors.textSecondary, fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>
                                {t('Anulează', 'Cancel')}
                            </button>
                            <button onClick={saveEdit}
                                style={{ flex: 2, padding: '11px', borderRadius: '10px', border: 'none', background: '#6366F1', color: 'white', fontSize: '13px', fontWeight: '700', cursor: 'pointer', boxShadow: '0 2px 10px rgba(99,102,241,0.35)' }}>
                                {t('Salvează modificările', 'Save changes')}
                            </button>
                        </div>
                    </div>
                </>
            )}

            {/* ══════════════════════════════════════════════════════════════
                INVITE MODAL
            ══════════════════════════════════════════════════════════════ */}
            {showInvite && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    onClick={e => e.target === e.currentTarget && setShowInvite(false)}>
                    <div style={{ background: colors.card, borderRadius: '18px', padding: '32px', width: 520, border: `1px solid ${colors.border}`, boxShadow: '0 24px 64px rgba(0,0,0,0.28)', animation: 'fadeUp 0.2s ease', maxHeight: '90vh', overflowY: 'auto' }}>
                        <h3 style={{ margin: '0 0 24px', fontSize: '16px', fontWeight: '800', color: colors.text }}>
                            {t('Adaugă utilizator nou', 'Add new user')}
                        </h3>

                        {/* Nume + Prenume — 2 columns */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                            <div>
                                <label style={{ fontSize: '12px', fontWeight: '600', color: colors.textSecondary, display: 'block', marginBottom: '5px' }}>{t('Nume', 'Last name')}</label>
                                <input type="text" value={inviteLast} onChange={e => setInviteLast(e.target.value)} placeholder="Popescu"
                                    style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: `1px solid ${colors.border}`, background: isDark ? 'rgba(255,255,255,0.06)' : '#f9fafb', color: colors.text, fontSize: '13px', boxSizing: 'border-box' }} />
                            </div>
                            <div>
                                <label style={{ fontSize: '12px', fontWeight: '600', color: colors.textSecondary, display: 'block', marginBottom: '5px' }}>{t('Prenume', 'First name')}</label>
                                <input type="text" value={inviteFirst} onChange={e => setInviteFirst(e.target.value)} placeholder="Ion"
                                    style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: `1px solid ${colors.border}`, background: isDark ? 'rgba(255,255,255,0.06)' : '#f9fafb', color: colors.text, fontSize: '13px', boxSizing: 'border-box' }} />
                            </div>
                        </div>

                        {/* Email + Telefon */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                            <div>
                                <label style={{ fontSize: '12px', fontWeight: '600', color: colors.textSecondary, display: 'block', marginBottom: '5px' }}>Email *</label>
                                <input type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="email@company.com"
                                    style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: `1px solid ${inviteError && !inviteEmail ? '#ef4444' : colors.border}`, background: isDark ? 'rgba(255,255,255,0.06)' : '#f9fafb', color: colors.text, fontSize: '13px', boxSizing: 'border-box' }} />
                            </div>
                            <div>
                                <label style={{ fontSize: '12px', fontWeight: '600', color: colors.textSecondary, display: 'block', marginBottom: '5px' }}>{t('Telefon', 'Phone')}</label>
                                <input type="tel" value={invitePhone} onChange={e => setInvitePhone(e.target.value)} placeholder="+40 7xx xxx xxx"
                                    style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: `1px solid ${colors.border}`, background: isDark ? 'rgba(255,255,255,0.06)' : '#f9fafb', color: colors.text, fontSize: '13px', boxSizing: 'border-box' }} />
                            </div>
                        </div>

                        {/* Parola + Confirma parola */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                            <div>
                                <label style={{ fontSize: '12px', fontWeight: '600', color: colors.textSecondary, display: 'block', marginBottom: '5px' }}>{t('Parolă *', 'Password *')}</label>
                                <input type="password" value={invitePassword} onChange={e => setInvitePassword(e.target.value)} placeholder={t('Min. 6 caractere', 'Min. 6 chars')}
                                    style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: `1px solid ${inviteError && !invitePassword ? '#ef4444' : colors.border}`, background: isDark ? 'rgba(255,255,255,0.06)' : '#f9fafb', color: colors.text, fontSize: '13px', boxSizing: 'border-box' }} />
                            </div>
                            <div>
                                <label style={{ fontSize: '12px', fontWeight: '600', color: colors.textSecondary, display: 'block', marginBottom: '5px' }}>{t('Confirmă parola *', 'Confirm password *')}</label>
                                <input type="password" value={inviteConfirm} onChange={e => setInviteConfirm(e.target.value)} placeholder={t('Repetă parola', 'Repeat password')}
                                    style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: `1px solid ${inviteConfirm && inviteConfirm !== invitePassword ? '#ef4444' : colors.border}`, background: isDark ? 'rgba(255,255,255,0.06)' : '#f9fafb', color: colors.text, fontSize: '13px', boxSizing: 'border-box' }} />
                                {inviteConfirm && inviteConfirm !== invitePassword && (
                                    <div style={{ fontSize: '11px', color: '#ef4444', marginTop: '4px' }}>{t('Parolele nu coincid', 'Passwords do not match')}</div>
                                )}
                            </div>
                        </div>

                        {/* Rol */}
                        <div style={{ marginBottom: '20px' }}>
                            <label style={{ fontSize: '12px', fontWeight: '600', color: colors.textSecondary, display: 'block', marginBottom: '5px' }}>{t('Rol', 'Role')}</label>
                            <select value={inviteRole} onChange={e => setInviteRole(e.target.value)}
                                style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: `1px solid ${colors.border}`, background: isDark ? 'rgba(255,255,255,0.06)' : '#f9fafb', color: colors.text, fontSize: '13px' }}>
                                {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                            </select>
                        </div>

                        {inviteError && <div style={{ padding: '10px 14px', borderRadius: '9px', background: '#fef2f2', color: '#ef4444', fontSize: '12px', marginBottom: '16px' }}>{inviteError}</div>}

                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button onClick={() => setShowInvite(false)}
                                style={{ flex: 1, padding: '11px', borderRadius: '10px', border: `1px solid ${colors.border}`, background: 'transparent', color: colors.textSecondary, fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>
                                {t('Anulează', 'Cancel')}
                            </button>
                            <button onClick={inviteUser} disabled={inviting || (inviteConfirm && inviteConfirm !== invitePassword)}
                                style={{ flex: 2, padding: '11px', borderRadius: '10px', border: 'none', background: '#6366F1', color: 'white', fontSize: '13px', fontWeight: '700', cursor: 'pointer', opacity: (inviting || (inviteConfirm && inviteConfirm !== invitePassword)) ? 0.6 : 1 }}>
                                {inviting ? t('Se creează…', 'Creating…') : t('Creează cont', 'Create account')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                @keyframes slideInRight { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
                @keyframes fadeUp { from { transform: translateY(12px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
                @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
            `}</style>
        </div>
    )
}
