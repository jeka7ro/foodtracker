import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { supabase } from './supabaseClient'

const AuthContext = createContext()

// ─── Hardcoded fallback: role → allowed base paths ───
const FALLBACK_ROLE_ACCESS = {
    admin: '*',
    manager: ['/', '/dashboard', '/monitoring', '/stop-control', '/stop-preturi', '/stop-istoric', '/marketing', '/marketing-analytics', '/marketing-promotions', '/competitors', '/competitor-products', '/brands',
        '/restaurants', '/alerts', '/events', '/reports', '/delivery-zone'],
    operational: ['/', '/dashboard', '/monitoring', '/stop-control', '/stop-preturi', '/stop-istoric', '/restaurants', '/alerts', '/events', '/rules', '/delivery-zone'],
    marketing: ['/marketing', '/marketing-analytics', '/marketing-promotions', '/competitors', '/competitor-products', '/brands'],
    area_manager: ['/', '/dashboard', '/monitoring', '/stop-control', '/stop-preturi', '/stop-istoric', '/restaurants', '/alerts', '/events', '/reports', '/delivery-zone'],
    manager_restaurant: ['/', '/dashboard', '/monitoring', '/stop-control', '/stop-preturi', '/stop-istoric', '/alerts', '/events'],
    analyst: ['/', '/dashboard', '/monitoring', '/competitors', '/competitor-products', '/brands', '/restaurants', '/alerts', '/reports', '/delivery-zone'],
    viewer: ['/', '/dashboard', '/alerts'],
}

export function hasRoleAccess(role, path, roleAccess = null) {
    if (!role) return false
    const access = roleAccess || FALLBACK_ROLE_ACCESS
    const allowed = access[role]
    if (allowed === '*') return true
    const base = '/' + path.replace(/^\//, '').split('/')[0].split('?')[0]
    const normalized = base === '/' ? '/' : base
    return (allowed || []).some(p => normalized === p || normalized === '/' + p.replace(/^\//, '').split('/')[0])
}

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null)
    const [role, setRole] = useState(null)
    const [isAuthenticated, setIsAuthenticated] = useState(false)
    const [isLoadingAuth, setIsLoadingAuth] = useState(true)
    const [roleAccess, setRoleAccess] = useState(null)

    const [dbUser, setDbUser] = useState(null)

    const loadPermissions = useCallback(async () => {
        try {
            const { data, error } = await supabase
                .from('role_permissions')
                .select('role, allowed_paths')
            if (error || !data || data.length === 0) {
                setRoleAccess(null)
                return
            }
            const perms = {}
            data.forEach(row => {
                if (row.role === 'admin') {
                    perms.admin = '*'
                } else {
                    perms[row.role] = row.allowed_paths || []
                }
            })
            setRoleAccess(perms)
        } catch (err) {
            console.warn('[Auth] Could not load role_permissions:', err.message)
            setRoleAccess(null)
        }
    }, [])

    const loadRole = useCallback(async (userId) => {
        if (!userId) { setRole(null); setDbUser(null); return }
        const { data } = await supabase
            .from('user_roles')
            .select('*')
            .eq('user_id', userId)
            .single()
        setRole(data?.is_active ? data.role : null)
        setDbUser(data)
    }, [])

    const updateDbUser = useCallback((updates) => {
        setDbUser(prev => prev ? { ...prev, ...updates } : prev)
    }, [])

    useEffect(() => {
        loadPermissions()

        supabase.auth.getSession().then(({ data: { session } }) => {
            setUser(session?.user ?? null)
            setIsAuthenticated(!!session)
            loadRole(session?.user?.id)
            setIsLoadingAuth(false)
        })

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setUser(session?.user ?? null)
            setIsAuthenticated(!!session)
            loadRole(session?.user?.id)
            setIsLoadingAuth(false)
        })

        return () => subscription.unsubscribe()
    }, [loadRole, loadPermissions])

    const login = async (email, password) => {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        await loadRole(data.user?.id)
        return data
    }

    const logout = async () => {
        await supabase.auth.signOut()
        setRole(null)
    }

    const hasAccess = (path) => hasRoleAccess(role, path, roleAccess)

    const refreshPermissions = loadPermissions

    return (
        <AuthContext.Provider value={{ user, dbUser, updateDbUser, role, isAuthenticated, isLoadingAuth, login, logout, hasAccess, refreshPermissions }}>
            {children}
        </AuthContext.Provider>
    )
}

export function useAuth() {
    const context = useContext(AuthContext)
    if (!context) throw new Error('useAuth must be used within AuthProvider')
    return context
}
