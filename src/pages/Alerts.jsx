import { supabase } from '../lib/supabaseClient'
import { useQuery } from '@tanstack/react-query'
import { useTheme } from '../lib/ThemeContext'
import toast, { Toaster } from 'react-hot-toast'
import { ListSkeleton } from '../components/LoadingSkeleton'

export default function Alerts() {
    const { colors } = useTheme()

    // Fetch alerts
    const { data: alerts = [], isLoading } = useQuery({
        queryKey: ['alerts'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('alerts')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(50)

            if (error) throw error
            return data
        },
        refetchInterval: 10000 // Refresh every 10 seconds
    })

    // Mark alert as read
    const markAsRead = async (alertId) => {
        try {
            const { error } = await supabase
                .from('alerts')
                .update({ is_read: true })
                .eq('id', alertId)

            if (error) throw error
            toast.success('Alert marked as read', { duration: 2000, position: 'top-right' })
        } catch (error) {
            toast.error('Error: ' + error.message, { duration: 3000, position: 'top-right' })
        }
    }

    // Resolve alert
    const resolveAlert = async (alertId) => {
        try {
            const { error } = await supabase
                .from('alerts')
                .update({ is_resolved: true })
                .eq('id', alertId)

            if (error) throw error
            toast.success('Alert resolved successfully!', { duration: 2000, position: 'top-right' })
        } catch (error) {
            toast.error('Error: ' + error.message, { duration: 3000, position: 'top-right' })
        }
    }

    const getSeverityColor = (severity) => {
        switch (severity) {
            case 'critical': return colors.red
            case 'high': return colors.orange
            case 'medium': return '#FFD700'
            case 'low': return colors.blue
            default: return colors.textSecondary
        }
    }

    const SeverityIcon = ({ severity, size = 14 }) => {
        const c = getSeverityColor(severity)
        switch (severity) {
            case 'critical': return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
            case 'high': return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
            case 'medium': return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>
            case 'low': return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>
            default: return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /></svg>
        }
    }

    const unreadCount = alerts.filter(a => !a.is_read).length
    const criticalCount = alerts.filter(a => a.severity === 'critical' && !a.is_resolved).length

    return (
        <div style={{ padding: '24px 32px', }}>
            {/* Header */}
            <div style={{ marginBottom: '24px' }}>
                <h1 style={{ fontSize: '28px', fontWeight: '700', margin: 0, color: colors.text, letterSpacing: '-0.5px' }}>
                    Alerts
                </h1>
                <p style={{ fontSize: '13px', color: colors.textSecondary, marginTop: '4px' }}>
                    Real-time monitoring alerts and violations
                    <span style={{ marginLeft: '12px', fontSize: '11px', opacity: 0.7 }}>
                        Auto-refresh: 10s • Updated: {new Date().toLocaleTimeString('ro-RO')}
                    </span>
                </p>
            </div>

            {/* Stats Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
                <div style={{
                    background: colors.card,
                    backdropFilter: 'blur(20px)',
                    border: `0.5px solid ${colors.border}`,
                    borderRadius: '12px',
                    padding: '20px'
                }}>
                    <div style={{ fontSize: '12px', color: colors.textSecondary, marginBottom: '8px' }}>Total Alerts</div>
                    <div style={{ fontSize: '32px', fontWeight: '700', color: colors.text }}>{alerts.length}</div>
                </div>

                <div style={{
                    background: colors.card,
                    backdropFilter: 'blur(20px)',
                    border: `0.5px solid ${colors.border}`,
                    borderRadius: '12px',
                    padding: '20px'
                }}>
                    <div style={{ fontSize: '12px', color: colors.textSecondary, marginBottom: '8px' }}>Unread</div>
                    <div style={{ fontSize: '32px', fontWeight: '700', color: colors.orange }}>{unreadCount}</div>
                </div>

                <div style={{
                    background: colors.card,
                    backdropFilter: 'blur(20px)',
                    border: `0.5px solid ${colors.border}`,
                    borderRadius: '12px',
                    padding: '20px'
                }}>
                    <div style={{ fontSize: '12px', color: colors.textSecondary, marginBottom: '8px' }}>Critical</div>
                    <div style={{ fontSize: '32px', fontWeight: '700', color: colors.red }}>{criticalCount}</div>
                </div>
            </div>

            {/* Alerts List */}
            <div style={{
                background: colors.card,
                backdropFilter: 'blur(20px)',
                border: `0.5px solid ${colors.border}`,
                borderRadius: '12px',
                overflow: 'hidden'
            }}>
                {isLoading ? (
                    <ListSkeleton items={5} />
                ) : alerts.length === 0 ? (
                    <div style={{ padding: '40px', textAlign: 'center' }}>
                        <div style={{ fontSize: '48px', marginBottom: '16px' }}>✅</div>
                        <div style={{ fontSize: '16px', fontWeight: '600', color: colors.text, marginBottom: '8px' }}>
                            No alerts
                        </div>
                        <div style={{ fontSize: '13px', color: colors.textSecondary }}>
                            All systems operational
                        </div>
                    </div>
                ) : (
                    <div style={{ padding: '12px' }}>
                        {alerts.map((alert, index) => (
                            <div
                                key={alert.id}
                                style={{
                                    background: alert.is_read ? colors.bg : `${colors.blue}10`,
                                    border: `0.5px solid ${alert.is_read ? colors.border : colors.blue}`,
                                    borderRadius: '8px',
                                    padding: '16px',
                                    marginBottom: index < alerts.length - 1 ? '12px' : 0,
                                    opacity: alert.is_resolved ? 0.6 : 1
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                                    {/* Severity Icon */}
                                    <div style={{ marginTop: '2px', display: 'flex' }}>
                                        <SeverityIcon severity={alert.severity} size={20} />
                                    </div>

                                    {/* Content */}
                                    <div style={{ flex: 1 }}>
                                        {/* Header */}
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
                                            <span style={{
                                                fontSize: '10px',
                                                fontWeight: '600',
                                                color: getSeverityColor(alert.severity),
                                                textTransform: 'uppercase',
                                                letterSpacing: '0.5px'
                                            }}>
                                                {alert.severity}
                                            </span>
                                            <span style={{
                                                fontSize: '10px',
                                                fontWeight: '500',
                                                color: colors.textSecondary,
                                                textTransform: 'uppercase'
                                            }}>
                                                {alert.aggregator}
                                            </span>
                                            {alert.is_resolved && (
                                                <span style={{
                                                    fontSize: '10px',
                                                    fontWeight: '500',
                                                    color: colors.green,
                                                    textTransform: 'uppercase'
                                                }}>
                                                    ✓ Resolved
                                                </span>
                                            )}
                                        </div>

                                        {/* Title */}
                                        <div style={{ fontSize: '14px', fontWeight: '600', color: colors.text, marginBottom: '6px' }}>
                                            {alert.title}
                                        </div>

                                        {/* Message */}
                                        <div style={{ fontSize: '13px', color: colors.textSecondary, marginBottom: '12px' }}>
                                            {alert.message}
                                        </div>

                                        {/* Restaurant & Time */}
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '12px', color: colors.textSecondary }}>
                                            <span>{alert.restaurant_name}</span>
                                            <span>{new Date(alert.created_at).toLocaleString('ro-RO')}</span>
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        {!alert.is_read && (
                                            <button
                                                onClick={() => markAsRead(alert.id)}
                                                style={{
                                                    padding: '6px 12px',
                                                    background: colors.blue,
                                                    color: 'white',
                                                    border: 'none',
                                                    borderRadius: '6px',
                                                    fontSize: '12px',
                                                    fontWeight: '500',
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                Mark Read
                                            </button>
                                        )}
                                        {!alert.is_resolved && (
                                            <button
                                                onClick={() => resolveAlert(alert.id)}
                                                style={{
                                                    padding: '6px 12px',
                                                    background: colors.green,
                                                    color: 'white',
                                                    border: 'none',
                                                    borderRadius: '6px',
                                                    fontSize: '12px',
                                                    fontWeight: '500',
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                Resolve
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Toast Container */}
            <Toaster />
        </div>
    )
}
