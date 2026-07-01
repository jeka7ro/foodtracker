const fs = require('fs');
let code = fs.readFileSync('src/App.jsx', 'utf8');

// 1. Inject sidebarVariant state and helper functions
const injection = `
    const isUsersActive = location.pathname === '/users' || location.pathname === '/role-settings'
    const [usersOpen, setUsersOpen] = useState(isUsersActive)

    const [sidebarVariant, setSidebarVariant] = useState(1)

    // Sidebar Variant System
    const getSidebarContainerStyle = () => {
        const base = {
            overflowY: 'auto', overflowX: 'hidden',
            transition: 'all 0.22s cubic-bezier(0.4,0,0.2,1)',
            zIndex: 10, position: 'relative',
            width: SIDEBAR_W,
        }
        
        if (sidebarVariant === 1) { // Floating Island
            return {
                ...base,
                height: 'calc(100vh - 32px)',
                margin: '16px 0 16px 16px',
                borderRadius: '24px',
                background: isDark ? 'rgba(20,20,25,0.95)' : 'rgba(255, 255, 255, 0.95)',
                backdropFilter: 'blur(20px)',
                border: \`1px solid \${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}\`,
                boxShadow: isDark ? '0 8px 32px rgba(0,0,0,0.4)' : '0 8px 32px rgba(0,0,0,0.08)',
            }
        }
        if (sidebarVariant === 2) { // Ultra Minimalist
            return {
                ...base,
                height: '100vh',
                background: isDark ? '#0a0a0c' : '#ffffff',
                borderRight: \`1px solid \${isDark ? '#222' : '#eaeaea'}\`,
            }
        }
        if (sidebarVariant === 3) { // Neo-Brutalism
            return {
                ...base,
                height: '100vh',
                background: isDark ? '#1a1a1a' : '#ffffff',
                borderRight: \`2px solid \${isDark ? '#fff' : '#000'}\`,
                boxShadow: isDark ? '4px 0 0 #fff' : '4px 0 0 #000',
                zIndex: 20
            }
        }
        if (sidebarVariant === 5) { // Compact & Dense
            return {
                ...base,
                height: '100vh',
                width: sidebarCollapsed ? 56 : 220,
                background: isDark ? 'rgba(15,15,20,0.8)' : 'rgba(248, 250, 252, 0.9)',
                borderRight: \`1px solid \${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}\`,
            }
        }
        
        // Variant 4: Deep Glass (Default Refined)
        return {
            ...base,
            height: '100vh',
            background: isDark ? 'rgba(15,15,20,0.55)' : 'rgba(255, 255, 255, 0.75)',
            backdropFilter: 'blur(48px) saturate(220%) brightness(1.08)',
            borderRight: \`1px solid \${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}\`,
            boxShadow: isDark ? '2px 0 32px rgba(0,0,0,0.5)' : '2px 0 32px rgba(0,0,0,0.05)',
        }
    }

    const getNavItemStyle = (isActive, isSub) => {
        const basePadding = sidebarCollapsed ? '9px 0' : '9px 16px';
        const subPadding = '8px 16px 8px 34px';
        const padding = isSub ? subPadding : basePadding;
        
        const base = {
            display: 'flex', alignItems: 'center', gap: '8px',
            justifyContent: (!isSub && sidebarCollapsed) ? 'center' : 'flex-start',
            textDecoration: 'none', transition: 'all 0.15s',
            cursor: 'pointer', userSelect: 'none',
            outline: 'none'
        }
        
        if (sidebarVariant === 1) { // Floating Island
            return {
                ...base, padding, gap: '12px',
                borderRadius: '12px',
                fontSize: isSub ? '14px' : '15px', fontWeight: isActive ? '700' : '500',
                color: isActive ? (isDark ? '#2bbec8' : '#0f172a') : (isDark ? '#94a3b8' : '#64748b'),
                background: isActive ? (isDark ? 'rgba(43,190,200,0.1)' : '#f1f5f9') : 'transparent',
            }
        }
        if (sidebarVariant === 2) { // Ultra Minimalist
            return {
                ...base, padding,
                borderRadius: '0px',
                borderLeft: isActive ? \`3px solid \${isDark ? '#fff' : '#000'}\` : '3px solid transparent',
                fontSize: isSub ? '14px' : '15px', fontWeight: isActive ? '600' : '400',
                color: isActive ? (isDark ? '#fff' : '#000') : (isDark ? '#888' : '#666'),
                background: isActive ? (isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)') : 'transparent',
            }
        }
        if (sidebarVariant === 3) { // Neo-Brutalism
            return {
                ...base, padding,
                borderRadius: '0px',
                border: isActive ? \`2px solid \${isDark ? '#fff' : '#000'}\` : '2px solid transparent',
                boxShadow: isActive ? (isDark ? '2px 2px 0 #fff' : '2px 2px 0 #000') : 'none',
                transform: isActive ? 'translate(-2px, -2px)' : 'none',
                fontSize: isSub ? '14px' : '15px', fontWeight: '700',
                color: isDark ? (isActive ? '#000' : '#fff') : '#000',
                background: isActive ? (isDark ? '#2bbec8' : '#ffe100') : 'transparent',
            }
        }
        if (sidebarVariant === 5) { // Compact & Dense
            return {
                ...base, gap: '6px',
                padding: isSub ? '6px 12px 6px 28px' : (sidebarCollapsed ? '6px 0' : '6px 12px'),
                borderRadius: '6px',
                fontSize: isSub ? '13px' : '14px', fontWeight: isActive ? '600' : '500',
                color: isActive ? (isDark ? '#2bbec8' : '#0f172a') : (isDark ? '#94a3b8' : '#64748b'),
                background: isActive ? (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)') : 'transparent',
            }
        }
        
        // Variant 4: Deep Glass
        return {
            ...base, padding,
            borderRadius: '10px',
            fontSize: isSub ? '15px' : '15px', fontWeight: isActive ? '700' : '600',
            letterSpacing: '-0.15px',
            color: isActive ? (isDark ? '#2bbec8' : '#000000') : (isDark ? colors.textSecondary : 'rgba(0,0,0,0.6)'),
            background: isActive ? (isDark ? 'rgba(43,190,200,0.12)' : 'rgba(255,255,255,0.2)') : 'transparent',
            backdropFilter: isActive ? 'blur(10px) saturate(180%)' : 'none',
            boxShadow: isActive ? (isDark ? 'inset 0 0 0 1px rgba(255,255,255,0.05), 0 4px 12px rgba(0,0,0,0.2)' : 'inset 0 0 0 1px rgba(255,255,255,0.4), 0 6px 16px rgba(0,0,0,0.1)') : 'none',
        }
    }

    const SIDEBAR_W = sidebarCollapsed ? (sidebarVariant === 5 ? 56 : 64) : (sidebarVariant === 5 ? 220 : 240)
`;

code = code.replace(`    const isUsersActive = location.pathname === '/users' || location.pathname === '/role-settings'\n    const [usersOpen, setUsersOpen] = useState(isUsersActive)\n\n    const SIDEBAR_W = sidebarCollapsed ? 64 : 240`, injection);

// 2. Replace <aside style={{...}}> with <aside style={getSidebarContainerStyle()}>
code = code.replace(/<aside style=\{\{[\s\S]*?z-?Index: 10, position: 'relative',\n\s*\}\}>/, `<aside style={getSidebarContainerStyle()}>`);

// 3. Replace all inline styles for NavLinks and expandable div groups!
// They look like: style={({ isActive }) => ({ ... })} or style={{ ... }} inside onClick divs.
// I will use regex to replace style blocks for NavLink and onClick divs inside the nav.

// Top items NavLink
code = code.replace(/<NavLink key=\{item.path\} to=\{item.path\}(.*?)style=\{[\s\S]*?\}\)[\s\S]*?>/g, `<NavLink key={item.path} to={item.path}$1 style={({ isActive }) => getNavItemStyle(isActive, false)}>`);

// Stop Control div
code = code.replace(/<div onClick=\{\(\) => \{ if \(\!sidebarCollapsed\) setStopOpen\(o => \!o\) \}\}(.*?)style=\{[\s\S]*?userSelect: 'none',\n\s*\}\}>/g, `<div onClick={() => { if (!sidebarCollapsed) setStopOpen(o => !o) }}$1 style={getNavItemStyle(isStopActive, false)}>`);

// Stop Sub Items NavLink
code = code.replace(/<NavLink key=\{sub.path\} to=\{sub.path\}[\s\S]*?style=\{\{[\s\S]*?transition: 'all 0.15s',\n\s*\}\}>/g, `<NavLink key={sub.path} to={sub.path} style={getNavItemStyle(isActive, true)}>`);

// Own Products div
code = code.replace(/<div onClick=\{\(\) => \{ if \(\!sidebarCollapsed\) setOwnProductsOpen\(o => \!o\) \}\}(.*?)style=\{[\s\S]*?userSelect: 'none',\n\s*\}\}>/g, `<div onClick={() => { if (!sidebarCollapsed) setOwnProductsOpen(o => !o) }}$1 style={getNavItemStyle(isOwnProductsActive, false)}>`);

// Own Products Sub Items NavLink
// Wait, the regex needs to be generic enough or targeted.
// Actually, I can just replace all `<NavLink key={sub.path} to={sub.path}` block with generic.
// It's safer to just do a global replace for the style blocks if they are very similar.

// Let's use a simpler replace strategy for all SubItems:
// `<NavLink key={sub.path} to={sub.path}\n                                        style={{ ... }}>`
code = code.replace(/<NavLink key=\{sub.path\} to=\{sub.path\}\s*style=\{\{[\s\S]*?\}\}>/g, `<NavLink key={sub.path} to={sub.path} style={getNavItemStyle(isActive, true)}>`);

// Marketing div
code = code.replace(/<div onClick=\{\(\) => \{ if \(\!sidebarCollapsed\) setMktOpen\(o => \!o\) \}\}(.*?)style=\{[\s\S]*?userSelect: 'none',\n\s*\}\}>/g, `<div onClick={() => { if (!sidebarCollapsed) setMktOpen(o => !o) }}$1 style={getNavItemStyle(isMarketingActive, false)}>`);

// Bottom items NavLink
code = code.replace(/<NavLink key=\{item.path\} to=\{item.path\}(.*?)style=\{[\s\S]*?\}\)[\s\S]*?>/g, `<NavLink key={item.path} to={item.path}$1 style={({ isActive }) => getNavItemStyle(isActive, false)}>`);

// Delivery div
code = code.replace(/<div onClick=\{\(\) => \{ if \(\!sidebarCollapsed\) setDeliveryOpen\(o => \!o\) \}\}(.*?)style=\{[\s\S]*?userSelect: 'none',\n\s*\}\}>/g, `<div onClick={() => { if (!sidebarCollapsed) setDeliveryOpen(o => !o) }}$1 style={getNavItemStyle(isDeliveryActive, false)}>`);

// Users div
code = code.replace(/<div onClick=\{\(\) => \{ if \(\!sidebarCollapsed\) setUsersOpen\(o => \!o\) \}\}(.*?)style=\{[\s\S]*?userSelect: 'none',\n\s*\}\}>/g, `<div onClick={() => { if (!sidebarCollapsed) setUsersOpen(o => !o) }}$1 style={getNavItemStyle(isUsersActive, false)}>`);

// 4. Add the floating variant switcher button at the bottom left (or bottom right of the sidebar)
// Add it inside the <nav> footer, or absolute position in the window!
const switcherBtn = `
            {/* VARIANT SWITCHER (Dev Only) */}
            <div style={{
                position: 'fixed', bottom: 20, left: sidebarCollapsed ? 20 : SIDEBAR_W + 20,
                zIndex: 9999, display: 'flex', gap: 8,
                background: isDark ? 'rgba(0,0,0,0.8)' : 'rgba(255,255,255,0.9)',
                padding: '8px', borderRadius: '20px',
                boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
                border: \`1px solid \${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}\`,
                backdropFilter: 'blur(10px)', transition: 'all 0.2s'
            }}>
                <span style={{ fontSize: 11, fontWeight: 700, padding: '0 8px', display: 'flex', alignItems: 'center' }}>V:</span>
                {[1, 2, 3, 4, 5].map(v => (
                    <button key={v} onClick={() => setSidebarVariant(v)}
                        style={{
                            width: 28, height: 28, borderRadius: '50%',
                            background: sidebarVariant === v ? '#2bbec8' : 'transparent',
                            color: sidebarVariant === v ? '#fff' : (isDark ? '#fff' : '#000'),
                            border: 'none', cursor: 'pointer',
                            fontSize: 13, fontWeight: 700,
                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}
                    >{v}</button>
                ))}
            </div>
`;

code = code.replace(/\{renderSubAgentDialog\(\)\}/, switcherBtn + '\n            {renderSubAgentDialog()}');
// If renderSubAgentDialog is not there (this is base44 app), just inject it before {/* ─── Main area ─── */}
code = code.replace(/\{\/\* ─── Main area ─── \*\/\}/, switcherBtn + '\n            {/* ─── Main area ─── */}');

fs.writeFileSync('src/App.jsx', code);
console.log('App.jsx modified successfully!');
