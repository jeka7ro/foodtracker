import { useState } from 'react'
import { useTheme } from '../lib/ThemeContext'
import { useLanguage } from '../lib/LanguageContext'
import BusinessRulesTab from './BusinessRulesTab'
import StopSetari from './StopSetari'
import DeliveryZoneRulesTab from './DeliveryZoneRulesTab'

export default function Rules() {
    const { colors, isDark } = useTheme()
    const { lang } = useLanguage()
    const [activeTab, setActiveTab] = useState('stop_control')

    return (
        <div style={{ padding: '24px 32px', maxWidth: 1400, margin: '0 auto', }}>
            {/* Header */}
            <div style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                    <h1 style={{ fontSize: '28px', fontWeight: '800', margin: 0, color: colors.text, letterSpacing: '-0.5px' }}>
                        {lang === 'en' ? 'Centralized Rules' : 'Reguli Centralizate'}
                    </h1>
                    <p style={{ fontSize: '13px', color: colors.textSecondary, marginTop: '4px' }}>
                        {lang === 'en' ? 'Configure all business constraints and automatic scanning schedules' : 'Configurează regulile de business și orarele de scanare automată'}
                    </p>
                </div>
            </div>

            {/* Config Tabs */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', borderBottom: `1px solid ${colors.border}`, paddingBottom: '12px' }}>
                <button
                    onClick={() => setActiveTab('stop_control')}
                    style={{
                        padding: '8px 16px', borderRadius: '10px',
                        border: 'none', background: activeTab === 'stop_control' ? '#6366F1' : 'transparent',
                        color: activeTab === 'stop_control' ? '#fff' : colors.textSecondary,
                        fontSize: '14px', fontWeight: '600', cursor: 'pointer', transition: 'all 0.2s',
                        boxShadow: activeTab === 'stop_control' ? '0 4px 12px rgba(99,102,241,0.3)' : 'none'
                    }}
                >
                    {lang === 'en' ? 'Stop Control Schedules' : 'Scanări Stop Control'}
                </button>
                <button
                    onClick={() => setActiveTab('delivery_zone')}
                    style={{
                        padding: '8px 16px', borderRadius: '10px',
                        border: 'none', background: activeTab === 'delivery_zone' ? '#EC4899' : 'transparent',
                        color: activeTab === 'delivery_zone' ? '#fff' : colors.textSecondary,
                        fontSize: '14px', fontWeight: '600', cursor: 'pointer', transition: 'all 0.2s',
                        boxShadow: activeTab === 'delivery_zone' ? '0 4px 12px rgba(236,72,153,0.3)' : 'none'
                    }}
                >
                    {lang === 'en' ? 'Delivery Zone Schedules' : 'Scanări Delivery Zone'}
                </button>
                <button
                    onClick={() => setActiveTab('business_rules')}
                    style={{
                        padding: '8px 16px', borderRadius: '10px',
                        border: 'none', background: activeTab === 'business_rules' ? '#10B981' : 'transparent',
                        color: activeTab === 'business_rules' ? '#fff' : colors.textSecondary,
                        fontSize: '14px', fontWeight: '600', cursor: 'pointer', transition: 'all 0.2s',
                        boxShadow: activeTab === 'business_rules' ? '0 4px 12px rgba(16,185,129,0.3)' : 'none'
                    }}
                >
                    {lang === 'en' ? 'Business Rules' : 'Reguli de Operare (Business)'}
                </button>
            </div>

            {/* Tab Body */}
            <div>
                {activeTab === 'stop_control' && <StopSetari />}
                {activeTab === 'delivery_zone' && <DeliveryZoneRulesTab />}
                {activeTab === 'business_rules' && <BusinessRulesTab />}
            </div>
        </div>
    )
}
