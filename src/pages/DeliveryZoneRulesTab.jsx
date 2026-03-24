import { useState } from 'react'
import { useTheme } from '../lib/ThemeContext'
import { useLanguage } from '../lib/LanguageContext'

export default function DeliveryZoneRulesTab() {
    const { colors, isDark } = useTheme()
    const { lang } = useLanguage()
    const [globalRules, setGlobalRules] = useState({ days: [1,2,3,4,5,6,0], times: ['10:00', '14:00', '18:00'] })

    const DAYS = [ {d:1, ro:'Luni', en:'Mon'}, {d:2, ro:'Marți', en:'Tue'}, {d:3, ro:'Miercuri', en:'Wed'}, {d:4, ro:'Joi', en:'Thu'}, {d:5, ro:'Vineri', en:'Fri'}, {d:6, ro:'Sâmbătă', en:'Sat'}, {d:0, ro:'Duminică', en:'Sun'} ]

    return (
        <div style={{ padding: '10px 0' }}>
            <div style={{ padding: '24px', background: isDark ? 'rgba(255,255,255,0.03)' : '#fff', border: `1px solid ${colors.border}`, borderRadius: '14px' }}>
                <div style={{ fontSize: '18px', fontWeight: '800', color: colors.text, marginBottom: '6px' }}>
                    {(lang === 'ru' ? 'Автоматизация зон доставки' : (lang === 'en' ? 'Delivery Zone Automations' : 'Planificare Automată (Delivery Zone)'))}
                </div>
                <div style={{ fontSize: '13px', color: colors.textSecondary, marginBottom: '24px' }}>
                    {(lang === 'ru' ? 'Настройте, когда система должна автоматически проверять зоны доставки для всех ресторанов (кроме тех, у которых индивидуальный график).' : (lang === 'en' ? 'Configure when the system should automatically monitor delivery zones for all restaurants (except those with individual schedules).' : 'Aici definești când se va rula automat monitorizarea Zonei de Livrare pentru toate restaurantele, excepție făcând cele cu program individual.'))}
                </div>

                <div style={{ display: 'flex', gap: '32px', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: '300px' }}>
                        <label style={{ fontSize: '11px', color: colors.textSecondary, fontWeight: '700', display: 'block', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            {(lang === 'ru' ? 'Дни повторения' : (lang === 'en' ? 'Repeating Days' : 'Zile de repetare regulată'))}
                        </label>
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                            {DAYS.map(({d, ro, en}) => {
                                const act = globalRules.days.includes(d)
                                return (
                                    <button key={d} onClick={() => setGlobalRules(p => ({...p, days: act ? p.days.filter(x => x !== d) : [...p.days, d].sort() }))} 
                                        style={{ padding: '8px 16px', borderRadius: '8px', border: `1px solid ${act ? '#EC4899' : colors.border}`, background: act ? (isDark ? 'rgba(236,72,153,0.1)' : '#FDF2F8') : 'transparent', color: act ? '#EC4899' : colors.text, fontSize: '13px', fontWeight: '600', cursor: 'pointer', transition: 'all 0.2s' }}>
                                        {lang === 'en' ? en : ro}
                                    </button>
                                )
                            })}
                        </div>
                    </div>

                    <div style={{ flex: 1, minWidth: '300px' }}>
                        <label style={{ fontSize: '11px', color: colors.textSecondary, fontWeight: '700', display: 'block', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            {(lang === 'ru' ? 'Время выполнения (ежедневно)' : (lang === 'en' ? 'Daily Execution Times' : 'Ore de rulare (zilnic)'))}
                        </label>
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                            {globalRules.times.map((t, idx) => (
                                <div key={idx} style={{ display: 'flex', alignItems: 'center', border: `1px solid ${colors.border}`, borderRadius: '8px', overflow: 'hidden', background: isDark ? 'rgba(255,255,255,0.05)' : '#f9fafb' }}>
                                    <input type="time" value={t} onChange={e => {
                                        const n = [...globalRules.times]; n[idx] = e.target.value; setGlobalRules(p => ({...p, times: n}))
                                    }} style={{ padding: '8px 12px', border: 'none', background: 'transparent', color: colors.text, fontSize: '14px', outline: 'none', fontWeight: '500' }} />
                                    <button onClick={() => setGlobalRules(p => ({...p, times: p.times.filter((_,i) => i !== idx)}))} style={{ padding: '8px 12px', background: isDark ? 'rgba(255,255,255,0.08)' : '#f3f4f6', border: 'none', borderLeft: `1px solid ${colors.border}`, cursor: 'pointer', color: '#ef4444', fontSize: '16px', fontWeight: '600' }}>×</button>
                                </div>
                            ))}
                            <button onClick={() => setGlobalRules(p => ({...p, times: [...p.times, '12:00']}))} style={{ padding: '8px 16px', borderRadius: '8px', border: `1px dashed ${colors.border}`, background: 'transparent', color: colors.textSecondary, fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>
                                {(lang === 'ru' ? '+ Добавить время' : (lang === 'en' ? '+ Add Time' : '+ Adaugă Oră'))}
                            </button>
                        </div>
                    </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-start', marginTop: '32px', borderTop: `1px solid ${colors.border}`, paddingTop: '20px' }}>
                    <button onClick={() => { alert((lang === 'ru' ? 'Правило сохранено в базе данных!' : (lang === 'en' ? 'Rule saved to database!' : 'Regula a fost salvată în baza de date!'))) }} style={{ padding: '10px 28px', borderRadius: '10px', border: 'none', cursor: 'pointer', background: '#EC4899', color: 'white', fontSize: '14px', fontWeight: '700', boxShadow: '0 4px 12px rgba(236,72,153,0.3)' }}>
                        {(lang === 'ru' ? 'Сохранить расписание' : (lang === 'en' ? 'Save Schedule' : 'Salvează Programul'))}
                    </button>
                </div>
            </div>
        </div>
    )
}
