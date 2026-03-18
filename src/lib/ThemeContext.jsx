import { createContext, useContext, useState, useEffect } from 'react'

const ThemeContext = createContext()

export const ThemeProvider = ({ children }) => {
    const [isDark, setIsDark] = useState(() => {
        const saved = localStorage.getItem('theme')
        return saved === 'dark'
    })

    useEffect(() => {
        localStorage.setItem('theme', isDark ? 'dark' : 'light')
    }, [isDark])

    const toggleTheme = () => setIsDark(!isDark)

    const theme = {
        isDark,
        toggleTheme,
        colors: isDark ? {
            // Dark mode - macOS style
            bg: '#1c1c1e',
            bgSecondary: '#2c2c2e',
            sidebar: 'rgba(44, 44, 46, 0.8)',
            card: 'rgba(58, 58, 60, 0.8)',
            border: 'rgba(255, 255, 255, 0.1)',
            text: '#f5f5f7',
            textSecondary: '#98989d',
            blue: '#0a84ff',
            orange: '#ff9f0a',
            green: '#30d158',
            red: '#ff453a',
            hover: 'rgba(255, 255, 255, 0.06)',
            cardShadow: 'none'
        } : {
            // Light mode - clean, high contrast
            bg: '#f0f0f3',
            bgSecondary: '#ffffff',
            sidebar: 'rgba(255, 255, 255, 0.95)',
            card: '#ffffff',
            border: 'rgba(0, 0, 0, 0.12)',
            text: '#1d1d1f',
            textSecondary: '#6e6e73',
            blue: '#007AFF',
            orange: '#FF9500',
            green: '#34C759',
            red: '#FF3B30',
            hover: 'rgba(0, 0, 0, 0.04)',
            cardShadow: '0 1px 4px rgba(0,0,0,0.1), 0 0 1px rgba(0,0,0,0.08)'
        }
    }

    return (
        <ThemeContext.Provider value={theme}>
            {children}
        </ThemeContext.Provider>
    )
}

export const useTheme = () => useContext(ThemeContext)
