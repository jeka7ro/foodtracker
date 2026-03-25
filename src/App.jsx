import React, { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, NavLink, useLocation, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider, useAuth } from './lib/AuthContext'
import { ThemeProvider, useTheme } from './lib/ThemeContext'
import { LanguageProvider, useLanguage } from './lib/LanguageContext'
import { UserProfileProvider, useUserProfile } from './lib/UserProfileContext'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Monitoring from './pages/Monitoring'
import StopControl from './pages/StopControl'
import StopPrices from './pages/StopPrices'
import StopIstoric from './pages/StopIstoric'
import Marketing from './pages/Marketing'
import MarketingAnalytics from './pages/MarketingAnalytics'
import CompetitorProducts from './pages/CompetitorProducts'
import Competitors from './pages/Competitors'
import Brands from './pages/Brands'
import Restaurants from './pages/Restaurants'
import Alerts from './pages/Alerts'
import Events from './pages/Events'
import Rules from './pages/Rules'
import Reports from './pages/Reports'
import DeliveryZone from './pages/DeliveryZone'
import Users from './pages/Users'
import OwnProducts from './pages/OwnProducts'
import SmartAssistant from './components/SmartAssistant'
import MarketingPromotions from './pages/MarketingPromotions'
import MarketingAnalyticsCity from './pages/MarketingAnalyticsCity'
import RoleSettings from './pages/RoleSettings'
import IikoProducts from './pages/IikoProducts'

function ProtectedRoute({ children }) {
    const { user, isLoadingAuth } = useAuth()
    if (isLoadingAuth) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}><div style={{ fontSize: '14px', color: '#888' }}>Loading…</div></div>
    if (!user) return <Navigate to="/login" replace />
    return children
}

const NAV_ICONS = {
    dashboard: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></svg>,
    monitoring: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>,
    stopcontrol: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><rect x="9" y="9" width="6" height="6" rx="1" /></svg>,
    marketing: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z" /><path d="M13 13l6 6" /></svg>,
    competitors: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>,
    brands: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>,
    restaurants: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8h1a4 4 0 0 1 0 8h-1" /><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z" /><line x1="6" y1="1" x2="6" y2="4" /><line x1="10" y1="1" x2="10" y2="4" /><line x1="14" y1="1" x2="14" y2="4" /></svg>,
    alerts: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>,
    events: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="20" height="20" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>,
    rules: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" /></svg>,
    reports: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></svg>,
    delivery: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="1" y="3" width="15" height="13" rx="1" /><polygon points="16 8 20 8 23 11 23 16 16 16 16 8" /><circle cx="5.5" cy="18.5" r="2.5" /><circle cx="18.5" cy="18.5" r="2.5" /></svg>,
    users: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>,
    ownproducts: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
}

function SidebarItem({ to, icon, label, sub }) {
    const { colors } = useTheme()
    return (
        <NavLink to={to} style={({ isActive }) => ({
            display: 'flex', alignItems: 'center', gap: '10px',
            padding: sub ? '7px 16px 7px 44px' : '9px 16px',
            borderRadius: '10px', textDecoration: 'none',
            fontSize: sub ? '14px' : '15px', fontWeight: sub ? '500' : '600',
            letterSpacing: '-0.15px',
            color: isActive ? '#ffffff' : 'rgba(255,255,255,0.7)',
            background: isActive ? 'rgba(255,255,255,0.2)' : 'transparent',
            transition: 'all 0.15s',
        })}>
            {!sub && <span style={{ opacity: 0.85, flexShrink: 0 }}>{icon}</span>}
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
        </NavLink>
    )
}

function Layout({ children }) {
    const { colors, isDark, toggleTheme } = useTheme()
    const { lang, setLang, t } = useLanguage()
    const { user, dbUser, logout } = useAuth()
    const [showUserPanel, setShowUserPanel] = useState(false)
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
    const location = useLocation()

    const isOwnProductsActive = location.pathname === '/own-products' || location.pathname === '/brands' || location.pathname === '/restaurants' || location.pathname === '/iiko-products'
    const [ownProductsOpen, setOwnProductsOpen] = useState(isOwnProductsActive)

    const isMarketingActive = location.pathname.startsWith('/marketing') || location.pathname === '/competitors' || location.pathname === '/competitor-products'
    const [mktOpen, setMktOpen] = useState(isMarketingActive)
    const isStopActive = location.pathname.startsWith('/stop-control') || location.pathname.startsWith('/stop-')
    const [stopOpen, setStopOpen] = useState(isStopActive)
    
    const isDeliveryActive = location.pathname.startsWith('/delivery-zone')
    const [deliveryOpen, setDeliveryOpen] = useState(isDeliveryActive)

    const isUsersActive = location.pathname === '/users' || location.pathname === '/role-settings'
    const [usersOpen, setUsersOpen] = useState(isUsersActive)

    const SIDEBAR_W = sidebarCollapsed ? 64 : 240
    const HEADER_H = 100  // matches sidebar logo area: 20px top + 66px icon + 14px bottom

    const topItems = [
        { path: '/dashboard', iconKey: 'dashboard', label: t('nav_dashboard') },
        { path: '/monitoring', iconKey: 'monitoring', label: t('nav_monitoring') },
    ]
    const stopSubItems = [
        { path: '/stop-control', label: t('nav_overview'), icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><rect x="9" y="9" width="6" height="6" rx="1"/></svg> },
        { path: '/stop-preturi', label: t('nav_prices_compare'), icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg> },
        { path: '/stop-istoric', label: t('nav_history'), icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> },
    ]
    const ownProductsSubItems = [
        { path: '/own-products', label: t('nav_own_products'), icon: NAV_ICONS.ownproducts },
        { path: '/iiko-products', label: t('nav_iiko_products'), icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg> },
        { path: '/brands', label: t('nav_brands'), icon: NAV_ICONS.brands },
        { path: '/restaurants', label: t('nav_restaurants'), icon: NAV_ICONS.restaurants },
    ]
    const mktSubItems = [
        {
            path: '/marketing?tab=searches', match: (p, s) => p === '/marketing' && (!s.get('tab') || s.get('tab') === 'searches'),
            label: t('nav_searches'),
            icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
        },
        {
            path: '/marketing?tab=results', match: (p, s) => p === '/marketing' && s.get('tab') === 'results',
            label: t('nav_results'),
            icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></svg>
        },
        {
            path: '/marketing?tab=prices', match: (p, s) => p === '/marketing' && s.get('tab') === 'prices',
            label: t('nav_prices'),
            icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>
        },
        {
            path: '/marketing-analytics', match: (p) => p === '/marketing-analytics',
            label: t('nav_analytics'),
            icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21.21 15.89A10 10 0 1 1 8 2.83" /><path d="M22 12A10 10 0 0 0 12 2v10z" /></svg>
        },
        {
            path: '/marketing-promotions', match: (p) => p === '/marketing-promotions',
            label: t('nav_radar'),
            icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
        },
        {
            path: '/competitors', match: (p) => p === '/competitors',
            label: t('nav_competitors'),
            icon: NAV_ICONS.competitors
        },
        {
            path: '/competitor-products', match: (p) => p === '/competitor-products',
            label: t('nav_competitor_products'),
            icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
        },
    ]
    const bottomItems = [
        { path: '/alerts', iconKey: 'alerts', label: t('nav_alerts') },
        { path: '/events', iconKey: 'events', label: t('nav_events') },
        { path: '/rules', iconKey: 'rules', label: t('nav_rules') },
        { path: '/reports', iconKey: 'reports', label: t('nav_reports') },
    ]
    const usersSubItems = [
        {
            path: '/users', match: (p) => p === '/users',
            label: t('nav_user_list'),
            icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><line x1="19" y1="8" x2="19" y2="14" /><line x1="22" y1="11" x2="16" y2="11" /></svg>
        },
        {
            path: '/role-settings', match: (p) => p === '/role-settings',
            label: t('nav_role_settings'),
            icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 11l.01 0c.96-1.92 1.4-3.5 1.15-5-.45-2.7-2.9-4.8-5.65-4.9-3.23-.1-6.17 2.45-6.5 5.65-.25 2.4.65 4.6 2.3 6.1L4 21c-.4.4-.3 1.1.2 1.4.5.3 1.1.2 1.5-.2l.7-.7.7.7c.4.4 1 .5 1.5.2.5-.3.6-1 .2-1.4l1.3-1.3c1.5 1.65 3.7 2.55 6.1 2.3 3.2-.35 5.75-3.27 5.65-6.5-.1-2.75-2.2-5.2-4.9-5.65-1.5-.25-3.08.19-5 1.15l-.01 0z" /></svg>
        }
    ]

    const deliverySubItems = [
        {
            path: '/delivery-zone?tab=configs', match: (p, s) => p === '/delivery-zone' && (!s.get('tab') || s.get('tab') === 'configs'),
            label: t('nav_configurations'),
            icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
        },
        {
            path: '/delivery-zone?tab=history', match: (p, s) => p === '/delivery-zone' && s.get('tab') === 'history',
            label: t('nav_history'),
            icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        }
    ]


    return (
        <div style={{ display: 'flex', height: '100vh', background: colors.bg, fontFamily: '-apple-system, BlinkMacSystemFont, "Inter", system-ui, sans-serif' }}>
            {/* ─── Sidebar ─── */}
            <aside style={{
                width: SIDEBAR_W, flexShrink: 0, display: 'flex', flexDirection: 'column',
                background: '#1a9199',
                borderRight: `1px solid rgba(255,255,255,0.1)`,
                overflowY: 'auto', overflowX: 'hidden',
                transition: 'width 0.22s cubic-bezier(0.4,0,0.2,1)',
            }}>
                {/* GET App Logo */}
                <div style={{
                    height: HEADER_H, padding: '0 16px', display: 'flex', alignItems: 'center',
                    gap: '8px',
                    borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}`,
                    justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
                    flexShrink: 0,
                    background: '#1a9199',
                }}>
                    {sidebarCollapsed ? (
                        <div style={{
                            width: 64, height: 64,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            flexShrink: 0,
                        }}>
                            <img src="/logo.png" alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                        </div>
                    ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0, overflow: 'hidden' }}>
                            <img src="/logo.png" alt="Logo" style={{ height: '76px', objectFit: 'contain' }} />
                            <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1 }}>
                                <span style={{ fontSize: '20px', fontWeight: '900', color: '#ffffff', letterSpacing: '-0.5px' }}>Smart</span>
                                <span style={{ fontSize: '17px', fontWeight: '800', color: '#ffffff', letterSpacing: '-0.2px' }}>Food</span>
                            </div>
                        </div>
                    )}
                </div>

                {/* Nav */}
                <nav style={{ padding: '10px 8px', flex: 1 }}>
                    {/* Top items */}
                    {topItems.map(item => (
                        <NavLink key={item.path} to={item.path} title={sidebarCollapsed ? item.label : undefined}
                            style={({ isActive }) => ({
                                display: 'flex', alignItems: 'center', gap: '10px',
                                padding: sidebarCollapsed ? '9px 0' : '9px 16px',
                                justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
                                borderRadius: '10px', textDecoration: 'none',
                                fontSize: '15px', fontWeight: '600',
                                letterSpacing: '-0.15px',
                                color: isActive ? '#ffffff' : 'rgba(255,255,255,0.7)',
                                background: isActive ? 'rgba(255,255,255,0.2)' : 'transparent',
                                transition: 'all 0.15s',
                            })}>
                            <span style={{ opacity: 0.85, flexShrink: 0 }}>{NAV_ICONS[item.iconKey]}</span>
                            {!sidebarCollapsed && <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.label}</span>}
                        </NavLink>
                    ))}

                    {/* Stop Control expandable group */}
                    <div onClick={() => { if (!sidebarCollapsed) setStopOpen(o => !o) }}
                        title={sidebarCollapsed ? t('nav_stopControl') : undefined}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '10px',
                            padding: sidebarCollapsed ? '9px 0' : '9px 16px',
                            justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
                            borderRadius: '10px', cursor: 'pointer',
                            fontSize: '15px', fontWeight: '600',
                            color: isStopActive ? '#ffffff' : 'rgba(255,255,255,0.7)',
                            background: isStopActive ? 'rgba(255,255,255,0.2)' : 'transparent',
                            transition: 'all 0.15s', userSelect: 'none',
                        }}>
                        <span style={{ opacity: 0.85, flexShrink: 0 }}>{NAV_ICONS.stopcontrol}</span>
                        {!sidebarCollapsed && <>
                            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t('nav_stopControl')}</span>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                                style={{ transform: stopOpen ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s', flexShrink: 0 }}>
                                <polyline points="9 18 15 12 9 6" />
                            </svg>
                        </>}
                    </div>
                    {stopOpen && !sidebarCollapsed && (
                        <div style={{ marginBottom: '4px' }}>
                            {stopSubItems.map(sub => {
                                const isActive = location.pathname === sub.path
                                return (
                                    <NavLink key={sub.path} to={sub.path}
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: '8px',
                                            padding: '8px 16px 8px 34px', borderRadius: '10px',
                                            textDecoration: 'none', fontSize: '15px',
                                letterSpacing: '-0.15px',
                                            fontWeight: isActive ? '700' : '500',
                                            color: isActive ? '#ffffff' : 'rgba(255,255,255,0.7)',
                                            background: isActive ? 'rgba(43,190,200,0.08)' : 'transparent',
                                            transition: 'all 0.15s',
                                        }}>
                                        <span style={{ opacity: 0.7, flexShrink: 0 }}>{sub.icon}</span>
                                        {sub.label}
                                    </NavLink>
                                )
                            })}
                        </div>
                    )}

                    {/* Own Products expandable group */}
                    <div onClick={() => { if (!sidebarCollapsed) setOwnProductsOpen(o => !o) }}
                        title={sidebarCollapsed ? t('nav_own_products') : undefined}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '10px',
                            padding: sidebarCollapsed ? '9px 0' : '9px 16px',
                            justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
                            borderRadius: '10px', cursor: 'pointer',
                            fontSize: '15px', fontWeight: '600',
                            color: isOwnProductsActive ? '#ffffff' : 'rgba(255,255,255,0.7)',
                            background: isOwnProductsActive ? 'rgba(255,255,255,0.2)' : 'transparent',
                            transition: 'all 0.15s', userSelect: 'none',
                        }}>
                        <span style={{ opacity: 0.85, flexShrink: 0 }}>{NAV_ICONS.ownproducts}</span>
                        {!sidebarCollapsed && <>
                            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t('nav_own_products')}</span>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                                style={{ transform: ownProductsOpen ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s', flexShrink: 0 }}>
                                <polyline points="9 18 15 12 9 6" />
                            </svg>
                        </>}
                    </div>
                    {ownProductsOpen && !sidebarCollapsed && (
                        <div style={{ marginBottom: '4px' }}>
                            {ownProductsSubItems.map(sub => {
                                const isActive = location.pathname === sub.path
                                return (
                                    <NavLink key={sub.path} to={sub.path}
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: '8px',
                                            padding: '8px 16px 8px 34px', borderRadius: '10px',
                                            textDecoration: 'none', fontSize: '15px',
                                            letterSpacing: '-0.15px',
                                            fontWeight: isActive ? '700' : '500',
                                            color: isActive ? '#ffffff' : 'rgba(255,255,255,0.7)',
                                            background: isActive ? 'rgba(43,190,200,0.08)' : 'transparent',
                                            transition: 'all 0.15s',
                                        }}>
                                        <span style={{ opacity: 0.7, flexShrink: 0, transform: 'scale(0.8)', transformOrigin: 'center left', display: 'flex' }}>{sub.icon}</span>
                                        {sub.label}
                                    </NavLink>
                                )
                            })}
                        </div>
                    )}

                    <div onClick={() => { if (!sidebarCollapsed) setMktOpen(o => !o) }}
                        title={sidebarCollapsed ? t('nav_marketing') : undefined}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '10px',
                            padding: sidebarCollapsed ? '9px 0' : '9px 16px',
                            justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
                            borderRadius: '10px', cursor: 'pointer',
                            fontSize: '15px', fontWeight: '600',
                            color: isMarketingActive ? '#ffffff' : 'rgba(255,255,255,0.7)',
                            background: isMarketingActive ? 'rgba(255,255,255,0.2)' : 'transparent',
                            transition: 'all 0.15s', userSelect: 'none',
                        }}>
                        <span style={{ opacity: 0.85, flexShrink: 0 }}>{NAV_ICONS.marketing}</span>
                        {!sidebarCollapsed && <>
                            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t('nav_marketing')}</span>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                                style={{ transform: mktOpen ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s', flexShrink: 0 }}>
                                <polyline points="9 18 15 12 9 6" />
                            </svg>
                        </>}
                    </div>

                    {/* Marketing sub-items */}
                    {mktOpen && !sidebarCollapsed && (
                        <div style={{ marginBottom: '4px' }}>
                            {mktSubItems.map(sub => {
                                const sp = new URLSearchParams(location.search)
                                const isActive = sub.match(location.pathname, sp)
                                return (
                                    <NavLink key={sub.path} to={sub.path}
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: '8px',
                                            padding: '8px 16px 8px 34px', borderRadius: '10px',
                                            textDecoration: 'none', fontSize: '15px',
                                letterSpacing: '-0.15px',
                                            fontWeight: isActive ? '700' : '500',
                                            color: isActive ? '#ffffff' : 'rgba(255,255,255,0.7)',
                                            background: isActive ? 'rgba(43,190,200,0.08)' : 'transparent',
                                            transition: 'all 0.15s',
                                        }}>
                                        <span style={{ opacity: 0.7, flexShrink: 0 }}>{sub.icon}</span>
                                        {sub.label}
                                    </NavLink>
                                )
                            })}
                        </div>
                    )}

                    {/* Bottom items */}
                    {bottomItems.map(item => (
                        <NavLink key={item.path} to={item.path} title={sidebarCollapsed ? item.label : undefined}
                            style={({ isActive }) => ({
                                display: 'flex', alignItems: 'center', gap: '10px',
                                padding: sidebarCollapsed ? '9px 0' : '9px 16px',
                                justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
                                borderRadius: '10px', textDecoration: 'none',
                                fontSize: '15px', fontWeight: '600',
                                letterSpacing: '-0.15px',
                                color: isActive ? '#ffffff' : 'rgba(255,255,255,0.7)',
                                background: isActive ? 'rgba(255,255,255,0.2)' : 'transparent',
                                transition: 'all 0.15s',
                            })}>
                            <span style={{ opacity: 0.85, flexShrink: 0 }}>{NAV_ICONS[item.iconKey]}</span>
                            {!sidebarCollapsed && <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.label}</span>}
                        </NavLink>
                    ))}
                    <div onClick={() => { if (!sidebarCollapsed) setDeliveryOpen(o => !o) }}
                        title={sidebarCollapsed ? t('nav_deliveryZone') : undefined}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '10px',
                            padding: sidebarCollapsed ? '9px 0' : '9px 16px',
                            justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
                            borderRadius: '10px', cursor: 'pointer',
                            fontSize: '15px', fontWeight: '600',
                            color: isDeliveryActive ? '#ffffff' : 'rgba(255,255,255,0.7)',
                            background: isDeliveryActive ? 'rgba(255,255,255,0.2)' : 'transparent',
                            transition: 'all 0.15s', userSelect: 'none',
                        }}>
                        <span style={{ opacity: 0.85, flexShrink: 0 }}>{NAV_ICONS.delivery}</span>
                        {!sidebarCollapsed && <>
                            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t('nav_deliveryZone')}</span>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                                style={{ transform: deliveryOpen ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s', flexShrink: 0 }}>
                                <polyline points="9 18 15 12 9 6" />
                            </svg>
                        </>}
                    </div>

                    {deliveryOpen && !sidebarCollapsed && (
                        <div style={{ marginBottom: '4px' }}>
                            {deliverySubItems.map(sub => {
                                const sp = new URLSearchParams(location.search)
                                const isActive = sub.match(location.pathname, sp)
                                return (
                                    <NavLink key={sub.path} to={sub.path}
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: '8px',
                                            padding: '8px 16px 8px 34px', borderRadius: '10px',
                                            textDecoration: 'none', fontSize: '15px',
                                letterSpacing: '-0.15px',
                                            fontWeight: isActive ? '700' : '500',
                                            color: isActive ? '#ffffff' : 'rgba(255,255,255,0.7)',
                                            background: isActive ? 'rgba(43,190,200,0.08)' : 'transparent',
                                            transition: 'all 0.15s',
                                        }}>
                                        <span style={{ opacity: 0.7, flexShrink: 0 }}>{sub.icon}</span>
                                        {sub.label}
                                    </NavLink>
                                )
                            })}
                        </div>
                    )}

                    <div onClick={() => { if (!sidebarCollapsed) setUsersOpen(o => !o) }}
                        title={sidebarCollapsed ? t('nav_users') : undefined}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '10px',
                            padding: sidebarCollapsed ? '9px 0' : '9px 16px',
                            justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
                            borderRadius: '10px', cursor: 'pointer',
                            fontSize: '15px', fontWeight: '600',
                            color: isUsersActive ? '#ffffff' : 'rgba(255,255,255,0.7)',
                            background: isUsersActive ? 'rgba(255,255,255,0.2)' : 'transparent',
                            transition: 'all 0.15s', userSelect: 'none',
                        }}>
                        <span style={{ opacity: 0.85, flexShrink: 0 }}>{NAV_ICONS.users}</span>
                        {!sidebarCollapsed && <>
                            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t('nav_users')}</span>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                                style={{ transform: usersOpen ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s', flexShrink: 0 }}>
                                <polyline points="9 18 15 12 9 6" />
                            </svg>
                        </>}
                    </div>

                    {usersOpen && !sidebarCollapsed && (
                        <div style={{ marginBottom: '4px' }}>
                            {usersSubItems.map(sub => {
                                const isActive = sub.match(location.pathname)
                                return (
                                    <NavLink key={sub.path} to={sub.path}
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: '8px',
                                            padding: '8px 16px 8px 34px', borderRadius: '10px',
                                            textDecoration: 'none', fontSize: '15px',
                                            letterSpacing: '-0.15px',
                                            fontWeight: isActive ? '700' : '500',
                                            color: isActive ? '#ffffff' : 'rgba(255,255,255,0.7)',
                                            background: isActive ? 'rgba(255,255,255,0.2)' : 'transparent',
                                            transition: 'all 0.15s',
                                        }}>
                                        <span style={{ opacity: 0.7, flexShrink: 0 }}>{sub.icon}</span>
                                        {sub.label}
                                    </NavLink>
                                )
                            })}
                        </div>
                    )}
                    {/* Sidebar Footer */}

                    <div style={{ padding: '16px', display: 'flex', justifyContent: 'center', borderTop: '1px solid rgba(255,255,255,0.1)', flexShrink: 0 }}>

                        <a href="https://www.getapp.ro" target="_blank" rel="noopener noreferrer" style={{ color: '#ffffff', fontSize: '13px', fontWeight: '600', textDecoration: 'none' }}>www.getapp.ro</a>

                    </div>
                </nav>
            </aside>

            {/* ─── Main area ─── */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                {/* Header */}
                <header style={{
                    height: HEADER_H, display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
                    padding: '0 20px', gap: '6px',
                    background: '#1a9199',
                    backdropFilter: 'none',
                    WebkitBackdropFilter: 'none',
                    borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
                    position: 'sticky', top: 0, zIndex: 50, flexShrink: 0,
                }}>
                    {/* ── Collapse button ── */}
                    <button onClick={() => setSidebarCollapsed(c => !c)}
                        style={{
                            marginRight: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            width: 32, height: 32, borderRadius: '9px', border: `1px solid rgba(255,255,255,0.4)`,
                            background: 'transparent', cursor: 'pointer', color: '#ffffff',
                            transition: 'all 0.18s',
                        }}
                        title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            {sidebarCollapsed
                                ? <><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="18" x2="21" y2="18" /></>
                                : <><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="6" x2="15" y2="6" /><line x1="3" y1="18" x2="15" y2="18" /></>
                            }
                        </svg>
                    </button>

                    {/* ── Theme pill toggle ── */}
                    <div onClick={toggleTheme}
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '5px 12px', borderRadius: '20px', cursor: 'pointer', background: 'rgba(255,255,255,0.2)', border: `1px solid rgba(255,255,255,0.3)`, transition: 'all 0.18s', userSelect: 'none' }}>
                        <span style={{ fontSize: '14px', lineHeight: 1 }}>{isDark ? '☀️' : '🌙'}</span>
                        <span style={{ fontSize: '11px', fontWeight: '600', color: '#ffffff', letterSpacing: '0.3px' }}>{isDark ? t('theme_light') : t('theme_dark')}</span>
                    </div>

                    {/* ── Language segmented control ── */}
                    <div style={{ display: 'flex', padding: '3px', background: 'rgba(255,255,255,0.2)', borderRadius: '12px', border: `1px solid rgba(255,255,255,0.3)`, gap: '2px' }}>
                        {[{ code: 'ro', label: 'RO' }, { code: 'en', label: 'EN' }, { code: 'ru', label: 'RU' }].map(l => (
                            <button key={l.code} onClick={() => setLang(l.code)}
                                style={{
                                    padding: '4px 11px', borderRadius: '9px', border: 'none', cursor: 'pointer',
                                    fontSize: '11px', fontWeight: '700', letterSpacing: '0.5px',
                                    transition: 'all 0.18s',
                                    background: lang === l.code ? '#ffffff' : 'transparent',
                                    color: lang === l.code ? '#1a9199' : 'rgba(255,255,255,0.8)',
                                    boxShadow: lang === l.code ? '0 1px 4px rgba(0,0,0,0.14)' : 'none',
                                }}>
                                {l.label}
                            </button>
                        ))}
                    </div>

                    {/* ── Divider ── */}
                    <div style={{ width: 1, height: 20, background: colors.border, margin: '0 2px', borderRadius: 1 }} />

                    {/* ── User chip with panel ── */}
                    {showUserPanel && <div style={{ position: 'fixed', inset: 0, zIndex: 98 }} onClick={() => setShowUserPanel(false)} />}
                    <div style={{ position: 'relative' }}>
                        <div onClick={() => { setShowUserPanel(s => !s) }}
                            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 4px 4px 10px', borderRadius: '22px', cursor: 'pointer', border: `1px solid ${colors.border}`, background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)', transition: 'all 0.18s' }}>
                            <span style={{ fontSize: '13px', fontWeight: '600', color: colors.text, maxWidth: 110, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {dbUser?.display_name || dbUser?.full_name || user?.email?.split('@')[0] || 'User'}
                            </span>
                            <div style={{ width: 30, height: 30, borderRadius: '50%', background: dbUser?.avatar_url ? 'transparent' : 'linear-gradient(135deg, #6366F1, #8B5CF6)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '12px', fontWeight: '700', overflow: 'hidden', flexShrink: 0, boxShadow: '0 2px 6px rgba(99,102,241,0.35)' }}>
                                {dbUser?.avatar_url
                                    ? <img src={dbUser.avatar_url} alt="av" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    : (dbUser?.display_name?.[0] || dbUser?.full_name?.[0] || user?.email?.[0] || '?').toUpperCase()}
                            </div>
                        </div>

                        {/* ── User dropdown panel ── */}
                        {showUserPanel && (
                            <div style={{
                                position: 'absolute', top: 'calc(100% + 10px)', right: 0, width: 220,
                                background: isDark ? '#2c2c2e' : '#fff',
                                border: `1px solid ${colors.border}`,
                                borderRadius: '14px', boxShadow: '0 12px 40px rgba(0,0,0,0.2)',
                                overflow: 'hidden', zIndex: 99,
                            }}>
                                <div style={{ padding: '14px 16px', borderBottom: `1px solid ${colors.border}` }}>
                                    <div style={{ fontSize: '13px', fontWeight: '700', color: colors.text }}>{dbUser?.display_name || dbUser?.full_name || user?.email?.split('@')[0]}</div>
                                    <div style={{ fontSize: '11px', color: colors.textSecondary, marginTop: '2px' }}>{user?.email}</div>
                                </div>
                                <button onClick={logout} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '10px', padding: '11px 16px', background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: '13px', fontWeight: '600', textAlign: 'left' }}
                                    onMouseOver={e => e.currentTarget.style.background = 'rgba(239,68,68,0.07)'}
                                    onMouseOut={e => e.currentTarget.style.background = 'none'}>
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
                                    {t('logout')}
                                </button>
                            </div>
                        )}
                    </div>
                </header>

                {/* Main Content */}
                <main style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', position: 'relative', background: colors.bg }}>
                    {children}
                </main>
            </div>
            <SmartAssistant />
        </div>
    )
}

const queryClient = new QueryClient()

export default function App() {
    return (
        <QueryClientProvider client={queryClient}>
            <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
                <AuthProvider>
                    <ThemeProvider>
                        <LanguageProvider>
                            <UserProfileProvider>
                                <Routes>
                                    <Route path="/login" element={<Login />} />
                                    <Route path="/" element={<Navigate to="/dashboard" replace />} />
                                    <Route path="/dashboard" element={<ProtectedRoute><Layout><Dashboard /></Layout></ProtectedRoute>} />
                                    <Route path="/monitoring" element={<ProtectedRoute><Layout><Monitoring /></Layout></ProtectedRoute>} />
                                    <Route path="/stop-control" element={<ProtectedRoute><Layout><StopControl /></Layout></ProtectedRoute>} />
                                    <Route path="/stop-preturi" element={<ProtectedRoute><Layout><StopPrices /></Layout></ProtectedRoute>} />
                                    <Route path="/stop-istoric" element={<ProtectedRoute><Layout><StopIstoric /></Layout></ProtectedRoute>} />
                                    <Route path="/marketing" element={<ProtectedRoute><Layout><Marketing /></Layout></ProtectedRoute>} />
                                    <Route path="/marketing-analytics" element={<ProtectedRoute><Layout><MarketingAnalytics /></Layout></ProtectedRoute>} />
                                    <Route path="/marketing-promotions" element={<ProtectedRoute><Layout><MarketingPromotions /></Layout></ProtectedRoute>} />
                                    <Route path="/marketing-analytics/:city" element={<ProtectedRoute><Layout><MarketingAnalyticsCity /></Layout></ProtectedRoute>} />
                                    <Route path="/competitor-products" element={<ProtectedRoute><Layout><CompetitorProducts /></Layout></ProtectedRoute>} />
                                    <Route path="/competitors" element={<ProtectedRoute><Layout><Competitors /></Layout></ProtectedRoute>} />
                                    <Route path="/brands" element={<ProtectedRoute><Layout><Brands /></Layout></ProtectedRoute>} />
                                    <Route path="/restaurants" element={<ProtectedRoute><Layout><Restaurants /></Layout></ProtectedRoute>} />
                                    <Route path="/alerts" element={<ProtectedRoute><Layout><Alerts /></Layout></ProtectedRoute>} />
                                    <Route path="/events" element={<ProtectedRoute><Layout><Events /></Layout></ProtectedRoute>} />
                                    <Route path="/rules" element={<ProtectedRoute><Layout><Rules /></Layout></ProtectedRoute>} />
                                    <Route path="/reports" element={<ProtectedRoute><Layout><Reports /></Layout></ProtectedRoute>} />
                                    <Route path="/delivery-zone" element={<ProtectedRoute><Layout><DeliveryZone /></Layout></ProtectedRoute>} />
                                    <Route path="/users" element={<ProtectedRoute><Layout><Users /></Layout></ProtectedRoute>} />
                                    <Route path="/role-settings" element={<ProtectedRoute><Layout><RoleSettings /></Layout></ProtectedRoute>} />
                                    <Route path="/own-products" element={<ProtectedRoute><Layout><OwnProducts /></Layout></ProtectedRoute>} />
                                    <Route path="/iiko-products" element={<ProtectedRoute><Layout><IikoProducts /></Layout></ProtectedRoute>} />
                                    <Route path="*" element={<Navigate to="/dashboard" replace />} />
                                </Routes>
                            </UserProfileProvider>
                        </LanguageProvider>
                    </ThemeProvider>
                </AuthProvider>
            </BrowserRouter>
        </QueryClientProvider>
    )
}
