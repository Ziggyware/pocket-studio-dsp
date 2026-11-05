
import React from 'react';

interface ToggleProps {
    value: boolean;
    onChange: (val: boolean) => void;
    label?: string; 
    color?: string;
    size?: 'sm' | 'md';
    vertical?: boolean;
}

export const Toggle: React.FC<ToggleProps> = ({ 
    value, onChange, label, 
    color = 'cyan', size = 'md', vertical = false 
}) => {
    
    const colorMap: Record<string, string> = {
        cyan: '#00f0ff', blue: '#2f80ed', purple: '#b721ff', green: '#0aff60',
        yellow: '#eab308', orange: '#f97316', red: '#ff003c', pink: '#ff00d4', white: '#ffffff', slate: '#64748b'
    };
    const accentColor = colorMap[color] || colorMap['cyan'];

    return (
        <button
            onClick={() => onChange(!value)}
            className={`
                relative flex items-center justify-center transition-all duration-75 ease-out
                ${size === 'sm' ? 'h-5 px-2 text-[8px]' : 'h-7 px-4 text-[9px]'}
                ${value 
                    ? `text-white translate-y-[1px]` 
                    : `text-slate-500 hover:text-slate-300 hover:bg-white/5 translate-y-0`}
                rounded-sm font-black tracking-widest uppercase overflow-hidden group
                border border-transparent
            `}
            style={{ 
                backgroundColor: value ? `${accentColor}15` : '#111',
                borderColor: value ? `${accentColor}60` : '#333',
                boxShadow: value 
                    ? `inset 0 0 15px ${accentColor}20, 0 0 5px ${accentColor}40` 
                    : 'inset 0 1px 0 rgba(255,255,255,0.1), 0 2px 5px rgba(0,0,0,0.5)',
                textShadow: value ? `0 0 8px ${accentColor}` : 'none'
            }}
        >
            {/* Lamp Filament Glow */}
            {value && (
                <>
                    <div className="absolute inset-0 z-0 bg-white opacity-5 mix-blend-overlay"></div>
                    <div className="absolute top-0 w-full h-[1px] bg-white opacity-50 shadow-[0_0_10px_white]"></div>
                </>
            )}
            
            {/* Label Content */}
            <span className={`relative z-10 flex items-center gap-1.5 ${vertical ? 'flex-col' : 'flex-row'}`}>
                <div 
                    className="w-1 h-1 rounded-full transition-all duration-300" 
                    style={{ 
                        backgroundColor: value ? '#fff' : '#222',
                        boxShadow: value ? `0 0 5px ${accentColor}, 0 0 10px ${accentColor}` : 'none' 
                    }}
                ></div>
                {label}
            </span>
        </button>
    );
};
