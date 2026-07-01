import React from 'react';

export default function AppLogo({ height = 56, textColor = '#2A2E35', collapsed = false }) {
    return (
        <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: collapsed ? 'center' : 'flex-start',
            height: height,
            transition: 'all 0.2s'
        }}>
            <img 
                src="/smart_food_logo.png" 
                alt="GetApp Smart Food Logo" 
                style={{ 
                    height: '100%', 
                    width: 'auto', 
                    objectFit: 'contain',
                    maxWidth: collapsed ? '100%' : 'none',
                    filter: textColor === '#ffffff' ? 'brightness(0) invert(1)' : 'none'
                }} 
            />
        </div>
    );
}
