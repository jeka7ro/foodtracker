import React, { useState, useRef, useEffect } from 'react'
import { useTheme } from '../lib/ThemeContext'
import { useLanguage } from '../lib/LanguageContext'

export default function SmartAssistant() {
    const { colors, isDark } = useTheme()
    const { lang } = useLanguage()
    const [isOpen, setIsOpen] = useState(false)
    const [messages, setMessages] = useState([
        { role: 'assistant', text: lang === 'en' ? "Hello! I'm your AI business analyst. How can I help you today? You can ask me about competitor prices, platform analytics, or simply how to use the app." : 'Salut! Sunt asistentul tău de analiză business. Cum te pot ajuta azi? Mă poți întreba despre prețurile concurenților, analize sau doar cum să folosești platforma.' }
    ])
    const [input, setInput] = useState('')
    const messagesEndRef = useRef(null)

    const [isTyping, setIsTyping] = useState(false)

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }

    useEffect(() => {
        scrollToBottom()
    }, [messages, isOpen])

    const handleSend = async () => {
        const textToUse = input.trim()
        if (!textToUse || isTyping) return

        const userMsg = { role: 'user', text: textToUse }
        setMessages(prev => [...prev, userMsg])
        setInput('')
        setIsTyping(true)

        try {
            const res = await fetch('http://localhost:3001/api/ai-chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: textToUse, lang })
            })
            const data = await res.json()
            setMessages(prev => [...prev, { role: 'assistant', text: data.reply || '🍣 Oops, no reply!' }])
        } catch {
            setMessages(prev => [...prev, { role: 'assistant', text: ro ? '🍣 Nu pot ajunge la server! Verifică că backend-ul rulează pe portul 3001. 🥢' : '🍣 Cannot reach server! Check backend is running on port 3001. 🥢' }])
        } finally {
            setIsTyping(false)
        }
    }

    const ro = lang !== 'en'


    return (
        <div style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 9999, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '16px' }}>
            <style>{`
                @keyframes sushiWiggle { 0%,100%{transform:rotate(-8deg) scale(1)} 50%{transform:rotate(8deg) scale(1.08)} }
                @keyframes sushiBounce { 0%,100%{transform:translateY(0) rotate(-4deg)} 50%{transform:translateY(-8px) rotate(4deg)} }
                @keyframes blink { 0%,90%,100%{scaleY:1} 95%{scaleY:0.05} }
                @keyframes eyeBlink { 0%,88%,100%{transform:scaleY(1)} 94%{transform:scaleY(0.05)} }
                @keyframes fadeUp { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
                @keyframes pulse { 0%,100%{box-shadow:0 0 10px #10B981} 50%{box-shadow:0 0 20px #10B981,0 0 40px #10B98166} }
                @keyframes rice { 0%,100%{transform:scale(1)} 50%{transform:scale(1.04)} }
                .sushi-btn:hover .sushi-char { animation: sushiWiggle 0.4s ease infinite !important; }
            `}</style>
            
            {/* Chat Panel */}
            {isOpen && (
                <div style={{ 
                    width: '380px', height: '520px', 
                    background: isDark ? 'rgba(30,30,32,0.95)' : 'rgba(255,255,255,0.98)',
                    backdropFilter: 'blur(20px)',
                    borderRadius: '20px', border: `1px solid ${colors.border}`,
                    boxShadow: isDark ? '0 10px 40px rgba(0,0,0,0.4)' : '0 10px 40px rgba(0,0,0,0.15)',
                    display: 'flex', flexDirection: 'column', overflow: 'hidden',
                    animation: 'fadeUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
                }}>
                    {/* Header */}
                    <div style={{ padding: '14px 20px', borderBottom: `1px solid ${colors.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: isDark ? 'rgba(0,0,0,0.1)' : '#f9fafb' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            {/* Mini maki roll logo */}
                            <svg width="38" height="38" viewBox="0 0 38 38" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ animation: 'sushiWiggle 3s ease-in-out infinite', flexShrink: 0 }}>
                                <circle cx="19" cy="19" r="18" fill="#1a1a2e"/>
                                <circle cx="19" cy="19" r="13" fill="#fff9f0"/>
                                <circle cx="19" cy="19" r="8" fill="#FF8C69"/>
                                <circle cx="19" cy="19" r="4" fill="#2bbec8"/>
                                <ellipse cx="16" cy="16" rx="2.5" ry="2.5" fill="#fff"/>
                                <ellipse cx="16" cy="16" rx="1.4" ry="1.4" fill="#1a1a2e" style={{ animation: 'eyeBlink 3s ease-in-out infinite', transformOrigin: '16px 16px' }}/>
                                <ellipse cx="22" cy="16" rx="2.5" ry="2.5" fill="#fff"/>
                                <ellipse cx="22" cy="16" rx="1.4" ry="1.4" fill="#1a1a2e" style={{ animation: 'eyeBlink 3s ease-in-out infinite 0.1s', transformOrigin: '22px 16px' }}/>
                                <path d="M15.5 21 Q19 24 22.5 21" stroke="#1a1a2e" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
                                <ellipse cx="12" cy="21" rx="2.5" ry="1.5" fill="#ff9999" opacity="0.5"/>
                                <ellipse cx="26" cy="21" rx="2.5" ry="1.5" fill="#ff9999" opacity="0.5"/>
                                <circle cx="31" cy="7" r="4" fill="#10B981"/>
                            </svg>
                            <div>
                                <div style={{ fontSize: '15px', fontWeight: '700', color: colors.text, display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    Smart Assistant
                                </div>
                                <div style={{ fontSize: '11px', color: colors.textSecondary, marginTop: '1px' }}>🍣 AI Business Analyst</div>
                            </div>
                        </div>
                        <button onClick={() => setIsOpen(false)} style={{ background: 'none', border: 'none', color: colors.textSecondary, cursor: 'pointer', padding: '4px', opacity: 0.7 }}>
                            ✖
                        </button>
                    </div>

                    {/* Chat Area */}
                    <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        {messages.map((m, i) => (
                            <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                                <div style={{
                                    maxWidth: '88%', padding: '12px 16px', borderRadius: '14px',
                                    fontSize: '13px', lineHeight: 1.6,
                                    background: m.role === 'user' ? '#2bbec8' : (isDark ? 'rgba(255,255,255,0.05)' : '#f4f4f5'),
                                    color: m.role === 'user' ? '#fff' : colors.text,
                                    border: m.role === 'assistant' ? `1px solid ${colors.border}` : 'none',
                                    borderBottomRightRadius: m.role === 'user' ? '4px' : '14px',
                                    borderBottomLeftRadius: m.role === 'assistant' ? '4px' : '14px',
                                    whiteSpace: 'pre-wrap',
                                }}>
                                    {m.text.split(/\[([^\]]+)\]\(([^)]+)\)/g).map((part, pi, arr) => {
                                        if (pi % 3 === 0) {
                                            return <span key={pi}>
                                                {part.split(/\*\*(.+?)\*\*/g).map((chunk, ci) =>
                                                    ci % 2 === 1
                                                        ? <strong key={ci} style={{ color: m.role === 'user' ? '#fff' : '#2bbec8' }}>{chunk}</strong>
                                                        : <span key={ci}>{chunk}</span>
                                                )}
                                            </span>
                                        } else if (pi % 3 === 1) {
                                            return <a key={pi} href={arr[pi + 1]} target="_blank" rel="noreferrer" style={{ color: m.role === 'user' ? '#fff' : '#2bbec8', textDecoration: 'underline', fontWeight: 'bold' }}>{part}</a>
                                        }
                                        return null;
                                    })}
                                </div>
                            </div>
                        ))}
                        {isTyping && (
                            <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                                <div style={{ padding: '10px 16px', borderRadius: '14px', borderBottomLeftRadius: '4px', background: isDark ? 'rgba(255,255,255,0.05)' : '#f4f4f5', border: `1px solid ${colors.border}`, fontSize: '18px', animation: 'sushiBounce 1s ease-in-out infinite' }}>🍣</div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Quick Suggestions */}
                    {messages.length === 1 && (
                        <div style={{ padding: '0 20px 12px 20px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                            {[
                                ro ? 'Câți concurenți am?' : 'How many competitors?',
                                ro ? 'Restaurante oprite?' : 'Any stopped restaurants?',
                                ro ? 'Ce platforme monitorizez?' : 'Which platforms?',
                                ro ? 'Cum funcționează?' : 'How does it work?',
                            ].map(suggestion => (
                                <button key={suggestion} onClick={() => { setInput(suggestion); setTimeout(handleSend, 50) }} style={{ padding: '5px 10px', borderRadius: '20px', border: `1px solid ${colors.border}`, background: isDark ? 'rgba(255,255,255,0.05)' : '#fff', color: colors.text, fontSize: '11px', cursor: 'pointer' }}>{suggestion}</button>
                            ))}
                        </div>
                    )}

                    {/* Input Area */}
                    <div style={{ padding: '16px', borderTop: `1px solid ${colors.border}`, display: 'flex', gap: '8px' }}>
                        <input 
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleSend()}
                            placeholder={lang === 'en' ? 'Ask me anything...' : 'Întreabă-mă orice...'}
                            style={{ flex: 1, padding: '10px 14px', borderRadius: '12px', border: `1px solid ${colors.border}`, background: isDark ? 'rgba(0,0,0,0.2)' : '#fff', color: colors.text, fontSize: '13px', outline: 'none' }}
                        />
                        <button onClick={handleSend} style={{ width: 38, height: 38, borderRadius: '12px', background: '#2bbec8', color: '#fff', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                        </button>
                    </div>
                </div>
            )}

            {/* Toggle Button — Sushi Character */}
            {!isOpen && (
                <button className="sushi-btn" onClick={() => setIsOpen(true)} style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
                    padding: 0, zIndex: 1000
                }}>
                    {/* Sushi MAKI ROLL character */}
                    <div className="sushi-char" style={{ animation: 'sushiBounce 2.2s ease-in-out infinite', filter: 'drop-shadow(0 8px 18px rgba(0,0,0,0.25))' }}>
                        <svg width="74" height="74" viewBox="0 0 74 74" fill="none" xmlns="http://www.w3.org/2000/svg">
                            {/* Outer nori ring */}
                            <circle cx="37" cy="37" r="36" fill="#1a1a2e"/>
                            {/* Rice ring */}
                            <circle cx="37" cy="37" r="28" fill="#fff9f0"/>
                            {/* Salmon/filling */}
                            <circle cx="37" cy="37" r="19" fill="#FF8C69"/>
                            {/* Center hole (avocado/nori) */}
                            <circle cx="37" cy="37" r="10" fill="#2d6a4f"/>
                            <circle cx="37" cy="37" r="6" fill="#52b788"/>
                            {/* Rice texture dots */}
                            <circle cx="20" cy="30" r="1.5" fill="#ede0cf" opacity="0.7"/>
                            <circle cx="17" cy="38" r="1.5" fill="#ede0cf" opacity="0.7"/>
                            <circle cx="20" cy="46" r="1.5" fill="#ede0cf" opacity="0.7"/>
                            <circle cx="54" cy="30" r="1.5" fill="#ede0cf" opacity="0.7"/>
                            <circle cx="57" cy="38" r="1.5" fill="#ede0cf" opacity="0.7"/>
                            <circle cx="54" cy="46" r="1.5" fill="#ede0cf" opacity="0.7"/>
                            {/* Eyes on salmon layer */}
                            <ellipse cx="30" cy="32" rx="4.5" ry="4.5" fill="#fff"/>
                            <ellipse cx="30" cy="32" rx="2.8" ry="2.8" fill="#1a1a2e" style={{ animation: 'eyeBlink 3s ease-in-out infinite', transformOrigin: '30px 32px' }}/>
                            <ellipse cx="31" cy="31" rx="0.9" ry="0.9" fill="#fff"/>
                            <ellipse cx="44" cy="32" rx="4.5" ry="4.5" fill="#fff"/>
                            <ellipse cx="44" cy="32" rx="2.8" ry="2.8" fill="#1a1a2e" style={{ animation: 'eyeBlink 3s ease-in-out infinite 0.15s', transformOrigin: '44px 32px' }}/>
                            <ellipse cx="45" cy="31" rx="0.9" ry="0.9" fill="#fff"/>
                            {/* Smile */}
                            <path d="M29 40 Q37 47 45 40" stroke="#1a1a2e" strokeWidth="2.5" strokeLinecap="round" fill="none"/>
                            {/* Rosy cheeks */}
                            <ellipse cx="22" cy="41" rx="5" ry="3" fill="#ff9999" opacity="0.45"/>
                            <ellipse cx="52" cy="41" rx="5" ry="3" fill="#ff9999" opacity="0.45"/>
                            {/* AI chat bubble top-right */}
                            <rect x="50" y="4" width="22" height="15" rx="7" fill="#2bbec8"/>
                            <path d="M54 19 L52 25 L60 19" fill="#2bbec8"/>
                            <text x="61" y="15" fontSize="8" textAnchor="middle" fill="white" fontWeight="bold">AI</text>
                            {/* Green online dot */}
                            <circle cx="68" cy="6" r="4" fill="#10B981"/>
                        </svg>
                    </div>
                    <div style={{
                        background: 'linear-gradient(135deg, #2bbec8, #17a2b8)',
                        color: '#fff', fontSize: '11px', fontWeight: '700',
                        padding: '4px 10px', borderRadius: '20px',
                        boxShadow: '0 4px 12px rgba(43,190,200,0.4)',
                        letterSpacing: '0.3px', whiteSpace: 'nowrap'
                    }}>🍣 Smart Assistant</div>
                </button>
            )}
        </div>
    )
}
