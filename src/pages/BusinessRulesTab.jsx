import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useTheme } from '../lib/ThemeContext'
import { useLanguage } from '../lib/LanguageContext'

export default function BusinessRulesTab() {
    const { colors } = useTheme()
    const { lang } = useLanguage()
    const [rules, setRules] = useState([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetchRules()
    }, [])

    const fetchRules = async () => {
        try {
            const { data, error } = await supabase
                .from('business_rules')
                .select(`
          *,
          restaurants (name)
        `)
                .order('created_at', { ascending: false })

            if (error) throw error
            setRules(data || [])
        } catch (error) {
            console.error('Error fetching rules:', error)
        } finally {
            setLoading(false)
        }
    }

    if (loading) {
        return (
            <div style={{ padding: '28px 40px', textAlign: 'center', color: colors.textSecondary }}>
                {lang === 'en' ? 'Loading rules...' : 'Se încarcă regulile...'}
            </div>
        )
    }

    return (
        <div>
            {/* Rules List */}
            {rules.length === 0 ? (
                <div style={{
                    background: colors.card,
                    backdropFilter: 'blur(20px)',
                    border: `0.5px solid ${colors.border}`,
                    borderRadius: '12px',
                    padding: '40px',
                    textAlign: 'center'
                }}>
                    <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'center' }}><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke={colors.textSecondary} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg></div>
                    <div style={{ fontSize: '16px', fontWeight: '600', color: colors.text, marginBottom: '8px' }}>
                        {lang === 'en' ? 'No rules configured yet' : 'Nicio regulă configurată momentan'}
                    </div>
                    <div style={{ fontSize: '13px', color: colors.textSecondary }}>
                        {lang === 'en' ? 'Add rules to define expected restaurant behavior' : 'Adaugă reguli pentru a defini comportamentul așteptat al restaurantului'}
                    </div>
                </div>
            ) : (
                <div style={{ display: 'grid', gap: '16px' }}>
                    {rules.map((rule) => (
                        <div key={rule.id} style={{
                            background: colors.card,
                            backdropFilter: 'blur(20px)',
                            border: `0.5px solid ${colors.border}`,
                            borderRadius: '12px',
                            padding: '20px',
                            transition: 'transform 0.2s, box-shadow 0.2s'
                        }}
                            onMouseOver={(e) => {
                                e.currentTarget.style.transform = 'translateY(-2px)'
                                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)'
                            }}
                            onMouseOut={(e) => {
                                e.currentTarget.style.transform = 'translateY(0)'
                                e.currentTarget.style.boxShadow = 'none'
                            }}
                        >
                            {/* Header */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                                <div>
                                    <h3 style={{ fontSize: '16px', fontWeight: '600', margin: 0, color: colors.text, marginBottom: '4px' }}>
                                        {rule.restaurants?.name}
                                    </h3>
                                    <p style={{ fontSize: '12px', color: colors.textSecondary, margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                        {rule.aggregator}
                                    </p>
                                </div>
                                <span style={{
                                    padding: '4px 10px',
                                    background: rule.is_active ? `${colors.green}20` : `${colors.textSecondary}20`,
                                    color: rule.is_active ? colors.green : colors.textSecondary,
                                    fontSize: '11px',
                                    fontWeight: '600',
                                    borderRadius: '6px',
                                    border: `0.5px solid ${rule.is_active ? colors.green : colors.textSecondary}40`
                                }}>
                                    {rule.is_active ? (lang === 'en' ? 'Active' : 'Activă') : (lang === 'en' ? 'Inactive' : 'Inactivă')}
                                </span>
                            </div>

                            {/* Rules Grid */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                                {rule.expected_delivery_radius && (
                                    <div style={{
                                        padding: '12px',
                                        background: `${colors.blue}10`,
                                        border: `0.5px solid ${colors.blue}30`,
                                        borderRadius: '8px'
                                    }}>
                                        <div style={{ fontSize: '11px', color: colors.textSecondary, marginBottom: '4px' }}>
                                            {lang === 'en' ? 'Expected Radius' : 'Rază Așteptată'}
                                        </div>
                                        <div style={{ fontSize: '14px', fontWeight: '600', color: colors.text }}>
                                            {rule.expected_delivery_radius} km
                                        </div>
                                    </div>
                                )}
                                {rule.min_rating && (
                                    <div style={{
                                        padding: '12px',
                                        background: `${colors.orange}10`,
                                        border: `0.5px solid ${colors.orange}30`,
                                        borderRadius: '8px'
                                    }}>
                                        <div style={{ fontSize: '11px', color: colors.textSecondary, marginBottom: '4px' }}>
                                            {lang === 'en' ? 'Min Rating' : 'Rating Minim'}
                                        </div>
                                        <div style={{ fontSize: '14px', fontWeight: '600', color: colors.text }}>
                                            {rule.min_rating}/10
                                        </div>
                                    </div>
                                )}
                                {rule.expected_opening_time && (
                                    <div style={{
                                        padding: '12px',
                                        background: `${colors.green}10`,
                                        border: `0.5px solid ${colors.green}30`,
                                        borderRadius: '8px'
                                    }}>
                                        <div style={{ fontSize: '11px', color: colors.textSecondary, marginBottom: '4px' }}>
                                            {lang === 'en' ? 'Opening Time' : 'Oră Deschidere'}
                                        </div>
                                        <div style={{ fontSize: '14px', fontWeight: '600', color: colors.text }}>
                                            {rule.expected_opening_time}
                                        </div>
                                    </div>
                                )}
                                {rule.expected_closing_time && (
                                    <div style={{
                                        padding: '12px',
                                        background: `${colors.purple || '#9333EA'}10`,
                                        border: `0.5px solid ${colors.purple || '#9333EA'}30`,
                                        borderRadius: '8px'
                                    }}>
                                        <div style={{ fontSize: '11px', color: colors.textSecondary, marginBottom: '4px' }}>
                                            {lang === 'en' ? 'Closing Time' : 'Oră Închidere'}
                                        </div>
                                        <div style={{ fontSize: '14px', fontWeight: '600', color: colors.text }}>
                                            {rule.expected_closing_time}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
