import React from 'react';
import { AlertTriangle, Info } from 'lucide-react';

export default function SimulationBanner() {
    return (
        <aside 
            aria-label="Simulation Environment Notice" 
            style={{
                backgroundColor: '#fffbeb',
                borderBottom: '1px solid #fde68a',
                padding: '8px 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                fontSize: '13px',
                color: '#92400e',
                fontWeight: 500,
                textAlign: 'center',
                zIndex: 1000
            }}
        >
            <AlertTriangle size={16} color="#d97706" />
            <span>
                <strong>SIMULATION DEMO ONLY:</strong> This software is an educational engineering simulation. No real financial networks, banks, or actual currency are used.
            </span>
        </aside>
    );
}
