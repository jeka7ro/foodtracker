import { useTheme } from '../lib/ThemeContext'

export function TableSkeleton({ rows = 5, columns = 5 }) {
    const { colors } = useTheme()

    return (
        <div style={{
            background: colors.card,
            backdropFilter: 'blur(20px)',
            border: `0.5px solid ${colors.border}`,
            borderRadius: '12px',
            overflow: 'hidden'
        }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead style={{ background: `${colors.bg}80`, borderBottom: `0.5px solid ${colors.border}` }}>
                    <tr>
                        {Array.from({ length: columns }).map((_, i) => (
                            <th key={i} style={{ padding: '12px 20px' }}>
                                <div style={{
                                    height: '12px',
                                    background: `${colors.textSecondary}30`,
                                    borderRadius: '4px',
                                    animation: 'pulse 1.5s ease-in-out infinite'
                                }} />
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {Array.from({ length: rows }).map((_, rowIndex) => (
                        <tr key={rowIndex} style={{
                            borderBottom: rowIndex < rows - 1 ? `0.5px solid ${colors.border}` : 'none'
                        }}>
                            {Array.from({ length: columns }).map((_, colIndex) => (
                                <td key={colIndex} style={{ padding: '14px 20px' }}>
                                    <div style={{
                                        height: '16px',
                                        background: `${colors.textSecondary}20`,
                                        borderRadius: '4px',
                                        animation: 'pulse 1.5s ease-in-out infinite',
                                        animationDelay: `${(rowIndex * columns + colIndex) * 0.05}s`
                                    }} />
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    )
}

export function CardSkeleton() {
    const { colors } = useTheme()

    return (
        <div style={{
            background: colors.card,
            backdropFilter: 'blur(20px)',
            border: `0.5px solid ${colors.border}`,
            borderRadius: '12px',
            padding: '20px'
        }}>
            <div style={{
                height: '12px',
                width: '40%',
                background: `${colors.textSecondary}30`,
                borderRadius: '4px',
                marginBottom: '12px',
                animation: 'pulse 1.5s ease-in-out infinite'
            }} />
            <div style={{
                height: '32px',
                width: '60%',
                background: `${colors.textSecondary}20`,
                borderRadius: '4px',
                marginBottom: '8px',
                animation: 'pulse 1.5s ease-in-out infinite',
                animationDelay: '0.1s'
            }} />
            <div style={{
                height: '12px',
                width: '30%',
                background: `${colors.textSecondary}15`,
                borderRadius: '4px',
                animation: 'pulse 1.5s ease-in-out infinite',
                animationDelay: '0.2s'
            }} />
        </div>
    )
}

export function ListSkeleton({ items = 5 }) {
    const { colors } = useTheme()

    return (
        <div style={{
            background: colors.card,
            backdropFilter: 'blur(20px)',
            border: `0.5px solid ${colors.border}`,
            borderRadius: '12px',
            padding: '12px'
        }}>
            {Array.from({ length: items }).map((_, index) => (
                <div key={index} style={{
                    padding: '12px',
                    marginBottom: index < items - 1 ? '8px' : 0,
                    background: `${colors.bg}40`,
                    borderRadius: '8px',
                    border: `0.5px solid ${colors.border}`
                }}>
                    <div style={{
                        height: '14px',
                        width: '70%',
                        background: `${colors.textSecondary}30`,
                        borderRadius: '4px',
                        marginBottom: '8px',
                        animation: 'pulse 1.5s ease-in-out infinite',
                        animationDelay: `${index * 0.1}s`
                    }} />
                    <div style={{
                        height: '12px',
                        width: '40%',
                        background: `${colors.textSecondary}20`,
                        borderRadius: '4px',
                        animation: 'pulse 1.5s ease-in-out infinite',
                        animationDelay: `${index * 0.1 + 0.05}s`
                    }} />
                </div>
            ))}
        </div>
    )
}
