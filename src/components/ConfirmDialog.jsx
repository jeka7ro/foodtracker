import { useTheme } from '../lib/ThemeContext'

export function ConfirmDialog({
    isOpen,
    onClose,
    onConfirm,
    title = 'Confirm Action',
    message = 'Are you sure you want to proceed?',
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    variant = 'danger' // 'danger' | 'warning' | 'info'
}) {
    const { colors } = useTheme()

    if (!isOpen) return null

    const getVariantColor = () => {
        switch (variant) {
            case 'danger': return colors.red
            case 'warning': return colors.orange
            case 'info': return colors.blue
            default: return colors.blue
        }
    }

    const handleConfirm = () => {
        onConfirm()
        onClose()
    }

    return (
        <div
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'rgba(0, 0, 0, 0.5)',
                backdropFilter: 'blur(4px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 2000,
                animation: 'fadeIn 0.2s ease-out'
            }}
            onClick={onClose}
        >
            <div
                style={{
                    background: colors.card,
                    border: `0.5px solid ${colors.border}`,
                    borderRadius: '12px',
                    padding: '24px',
                    maxWidth: '400px',
                    width: '90%',
                    animation: 'slideUp 0.2s ease-out'
                }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Icon */}
                <div style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '50%',
                    background: `${getVariantColor()}20`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: '16px',
                    fontSize: '24px'
                }}>
                    {variant === 'danger' && <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={getVariantColor()} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>}
                    {variant === 'warning' && <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={getVariantColor()} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>}
                    {variant === 'info' && <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={getVariantColor()} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>}
                </div>

                {/* Title */}
                <h3 style={{
                    fontSize: '18px',
                    fontWeight: '600',
                    margin: 0,
                    color: colors.text,
                    marginBottom: '8px'
                }}>
                    {title}
                </h3>

                {/* Message */}
                <p style={{
                    fontSize: '14px',
                    color: colors.textSecondary,
                    margin: 0,
                    marginBottom: '24px',
                    lineHeight: '1.5'
                }}>
                    {message}
                </p>

                {/* Actions */}
                <div style={{
                    display: 'flex',
                    gap: '12px',
                    justifyContent: 'flex-end'
                }}>
                    <button
                        onClick={onClose}
                        style={{
                            padding: '10px 20px',
                            background: colors.bg,
                            color: colors.text,
                            border: `0.5px solid ${colors.border}`,
                            borderRadius: '8px',
                            fontSize: '13px',
                            fontWeight: '600',
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                        }}
                        onMouseOver={(e) => {
                            e.currentTarget.style.background = colors.hover
                        }}
                        onMouseOut={(e) => {
                            e.currentTarget.style.background = colors.bg
                        }}
                    >
                        {cancelText}
                    </button>
                    <button
                        onClick={handleConfirm}
                        style={{
                            padding: '10px 20px',
                            background: getVariantColor(),
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            fontSize: '13px',
                            fontWeight: '600',
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                        }}
                        onMouseOver={(e) => {
                            e.currentTarget.style.opacity = '0.9'
                        }}
                        onMouseOut={(e) => {
                            e.currentTarget.style.opacity = '1'
                        }}
                    >
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    )
}
