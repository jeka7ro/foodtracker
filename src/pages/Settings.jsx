import { useTheme } from '../lib/ThemeContext'
import { useLanguage } from '../lib/LanguageContext'

export default function Settings() {
    const { colors } = useTheme()
    const { lang } = useLanguage()

    return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', flexDirection: 'column', gap: '12px' }}>
            <div style={{ fontSize: '40px' }}>👤</div>
            <div style={{ fontSize: '16px', fontWeight: '600', color: colors.text }}>
                {lang === 'en' ? 'Profile settings are in the user menu' : 'Setările profilului sunt în meniul utilizatorului'}
            </div>
            <div style={{ fontSize: '13px', color: colors.textSecondary }}>
                {lang === 'en' ? 'Click your avatar in the top right corner' : 'Click pe avatarul din colțul dreapta sus'}
            </div>
        </div>
    )
}
