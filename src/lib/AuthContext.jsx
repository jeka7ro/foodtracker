import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { supabase } from './supabaseClient'

const AuthContext = createContext()

// ─── Access matrix: role → allowed base paths ───
const ROLE_ACCESS = {
    admin: '*', // all
    manager: ['/', '/monitoring', '/stop-control', '/marketing', '/competitors', '/brands',
        '/restaurants', '/alerts', '/events', '/reports', '/delivery-zone'],
    operational: ['/', '/monitoring', '/stop-control', '/restaurants', '/alerts', '/events', '/rules', '/delivery-zone'],
    marketing: ['/marketing', '/competitors', '/brands'],
    area_manager: ['/', '/monitoring', '/stop-control', '/restaurants', '/alerts', '/events', '/reports', '/delivery-zone'],
    manager_restaurant: ['/', '/monitoring', '/stop-control', '/alerts', '/events'],
    analyst: ['/', '/monitoring', '/competitors', '/brands', '/restaurants', '/alerts', '/reports', '/delivery-zone'],
    viewer: ['/', '/alerts'],
}

export function hasRoleAccess(role, path) {
    if (!role) return false
    const allowed = ROLE_ACCESS[role]
    if (allowed === '*') return true
    const base = '/' + path.replace(/^\//, '').split('/')[0].split('?')[0]
    const normalized = base === '/' ? '/' : base
    return (allowed || []).some(p => normalized === p || (normalized === '/' && p === '/'))
}

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null)
    const [role, setRole] = useState(null)
    const [isAuthenticated, setIsAuthenticated] = useState(false)
    const [isLoadingAuth, setIsLoadingAuth] = useState(true)

    const [dbUser, setDbUser] = useState(null)

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
    }, [loadRole])

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

    const hasAccess = (path) => hasRoleAccess(role, path)

    return (
        <AuthContext.Provider value={{ user, dbUser, updateDbUser, role, isAuthenticated, isLoadingAuth, login, logout, hasAccess }}>
            {children}
        </AuthContext.Provider>
    )
}

export function useAuth() {
    const context = useContext(AuthContext)
    if (!context) throw new Error('useAuth must be used within AuthProvider')
    return context
}
