import { useState, useEffect } from 'react'
import { useAuth } from '../lib/AuthContext'
import { useNavigate } from 'react-router-dom'

export default function Login() {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [showPass, setShowPass] = useState(false)
    const [remember, setRemember] = useState(false)
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)
    const { login } = useAuth()
    const navigate = useNavigate()

    // Load saved credentials on mount
    useEffect(() => {
        const saved = localStorage.getItem('agg_remember')
        if (saved) {
            try {
                const { email: e, password: p } = JSON.parse(saved)
                setEmail(e || '')
                setPassword(p || '')
                setRemember(true)
            } catch { }
        }
    }, [])

    const handleSubmit = async (e) => {
        e.preventDefault()
        setError('')
        setLoading(true)
        try {
            if (remember) {
                localStorage.setItem('agg_remember', JSON.stringify({ email, password }))
            } else {
                localStorage.removeItem('agg_remember')
            }
            await login(email, password)
            navigate('/')
        } catch (err) {
            setError(err.message || 'Authentication failed')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div style={{
            minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: 'linear-gradient(135deg, #001a1c 0%, #00363a 50%, #001f24 100%)',
            position: 'relative', overflow: 'hidden',
        }}>
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
                @keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-18px)} }
                @keyframes pulse { 0%,100%{opacity:0.5;transform:scale(1)} 50%{opacity:0.8;transform:scale(1.05)} }
                @keyframes fadeUp { from{opacity:0;transform:translateY(24px)} to{opacity:1;transform:translateY(0)} }
                .login-input { transition: all 0.2s ease; }
                .login-input:focus { border-color: #2bbec8 !important; box-shadow: 0 0 0 3px rgba(43,190,200,0.18) !important; outline: none; }
                .login-input:focus + .input-icon { color: #2bbec8 !important; }
                .sign-btn:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 8px 28px rgba(43,190,200,0.55) !important; }
                .sign-btn:active:not(:disabled) { transform: translateY(0); }
                .sign-btn { transition: all 0.2s ease; }
                .eye-btn:hover { color: #7de0e6 !important; }
            `}</style>

            {/* Glowing orbs */}
            <div style={{ position: 'absolute', width: 480, height: 480, borderRadius: '50%', background: 'radial-gradient(circle, rgba(43,190,200,0.18) 0%, transparent 70%)', top: '-120px', left: '-100px', animation: 'pulse 6s ease infinite' }} />
            <div style={{ position: 'absolute', width: 380, height: 380, borderRadius: '50%', background: 'radial-gradient(circle, rgba(0,255,200,0.14) 0%, transparent 70%)', bottom: '-80px', right: '-60px', animation: 'pulse 8s ease infinite 2s' }} />
            <div style={{ position: 'absolute', width: 200, height: 200, borderRadius: '50%', background: 'radial-gradient(circle, rgba(0,200,150,0.1) 0%, transparent 70%)', top: '40%', right: '18%', animation: 'float 7s ease infinite 1s' }} />

            {/* Card */}
            <div style={{
                width: '100%', maxWidth: 420, margin: '0 20px',
                background: 'rgba(43,190,200,0.06)',
                backdropFilter: 'blur(28px) saturate(180%)',
                WebkitBackdropFilter: 'blur(28px) saturate(180%)',
                border: '1px solid rgba(255,255,255,0.35)',
                borderRadius: '24px',
                padding: '44px 40px',
                boxShadow: '0 32px 80px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.08)',
                animation: 'fadeUp 0.5s ease',
            }}>
                {/* Logo + title */}
                <div style={{ marginBottom: '32px' }}>
                    <img
                        src="/getapp_smart_food_white.png"
                        alt="App Logo"
                        style={{
                            height: '90px',
                            display: 'block',
                            margin: '0 auto',
                            objectFit: 'contain',
                        }}
                    />
                </div>

                <form onSubmit={handleSubmit}>
                    {/* Email */}
                    <div style={{ marginBottom: '16px', position: 'relative' }}>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>Email</label>
                        <div style={{ position: 'relative' }}>
                            <svg style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.3)', pointerEvents: 'none', transition: 'color 0.2s' }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" />
                            </svg>
                            <input
                                className="login-input"
                                type="email"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                placeholder="your@email.com"
                                required
                                autoComplete="email"
                                style={{
                                    width: '100%', padding: '12px 14px 12px 44px', boxSizing: 'border-box',
                                    background: 'rgba(255,255,255,0.06)', border: '1.5px solid rgba(255,255,255,0.1)',
                                    borderRadius: '12px', fontSize: '14px', color: '#fff',
                                    fontFamily: 'inherit',
                                }}
                            />
                        </div>
                    </div>

                    {/* Password */}
                    <div style={{ marginBottom: '20px', position: 'relative' }}>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>Password</label>
                        <div style={{ position: 'relative' }}>
                            <svg style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.3)', pointerEvents: 'none' }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
                            </svg>
                            <input
                                className="login-input"
                                type={showPass ? 'text' : 'password'}
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                placeholder="••••••••"
                                required
                                autoComplete={remember ? 'current-password' : 'off'}
                                style={{
                                    width: '100%', padding: '12px 48px 12px 44px', boxSizing: 'border-box',
                                    background: 'rgba(255,255,255,0.06)', border: '1.5px solid rgba(255,255,255,0.1)',
                                    borderRadius: '12px', fontSize: '14px', color: '#fff',
                                    fontFamily: 'inherit',
                                }}
                            />
                            {/* Eye toggle */}
                            <button type="button" className="eye-btn" onClick={() => setShowPass(v => !v)}
                                style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.35)', padding: '4px', transition: 'color 0.2s' }}>
                                {showPass
                                    ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" /></svg>
                                    : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                                }
                            </button>
                        </div>
                    </div>

                    {/* Remember me */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px' }}>
                        <div onClick={() => setRemember(v => !v)} style={{
                            width: 18, height: 18, borderRadius: 5, border: `1.5px solid ${remember ? '#2bbec8' : 'rgba(255,255,255,0.2)'}`,
                            background: remember ? '#2bbec8' : 'transparent',
                            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.2s',
                        }}>
                            {remember && <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>}
                        </div>
                        <span onClick={() => setRemember(v => !v)} style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', userSelect: 'none' }}>Remember me</span>
                    </div>

                    {/* Error */}
                    {error && (
                        <div style={{ marginBottom: '20px', padding: '12px 16px', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '10px', fontSize: '13px', color: '#f87171', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
                            {error}
                        </div>
                    )}

                    {/* Submit */}
                    <button type="submit" disabled={loading} className="sign-btn"
                        style={{
                            width: '100%', padding: '14px', border: 'none', borderRadius: '12px',
                            background: loading ? 'rgba(43,190,200,0.5)' : 'linear-gradient(135deg, #2bbec8, #008080)',
                            color: 'white', fontSize: '15px', fontWeight: '700', cursor: loading ? 'not-allowed' : 'pointer',
                            boxShadow: '0 4px 18px rgba(43,190,200,0.35)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                            fontFamily: 'inherit',
                        }}>
                        {loading
                            ? <><svg style={{ animation: 'spin 1s linear infinite' }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg> Signing in…</>
                            : 'Sign In →'
                        }
                    </button>
                </form>

                <div style={{ marginTop: '28px', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.2)' }}>Aggregator Monitor · Loss Prevention Platform</div>
                    <a href="https://www.getapp.ro" target="_blank" rel="noopener noreferrer" style={{ fontSize: '12px', color: '#ffffff', textDecoration: 'none', fontWeight: '500' }}>www.getapp.ro</a>
                </div>
            </div>

            <style>{`
                @keyframes spin { to { transform: rotate(360deg); } }
                .login-input::placeholder { color: rgba(255,255,255,0.2); }
                input:-webkit-autofill,
                input:-webkit-autofill:hover,
                input:-webkit-autofill:focus {
                    -webkit-box-shadow: 0 0 0 1000px #1a1730 inset !important;
                    -webkit-text-fill-color: #ffffff !important;
                    caret-color: #ffffff !important;
                }

            `}</style>
        </div>
    )
}
