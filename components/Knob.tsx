
import React, { useMemo } from 'react';
import { useControlDrag } from '../hooks/useControlDrag';

export type ComponentStatus = 'normal' | 'bypass' | 'overdrive' | 'dampen';

interface KnobProps {
  value: number;
  min: number;
  max: number;
  onChange: (val: number) => void;
  label: string;
  color?: string;
  size?: number;
  resetValue?: number;
  logarithmic?: boolean;
  unit?: string;
  bipolar?: boolean;
  status?: ComponentStatus;
}

// --- SUB-COMPONENTS ---

const NeonDefs: React.FC<{ id: string, color: string, intensity: number }> = ({ id, color, intensity }) => (
    <defs>
        <filter id={`glow-${id}`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation={2.5 * intensity} result="coloredBlur" />
            <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
            </feMerge>
        </filter>
        <linearGradient id={`grad-${id}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#fff" stopOpacity={0.8} />
            <stop offset="100%" stopColor={color} stopOpacity={0.2} />
        </linearGradient>
    </defs>
);

const FluxTrack: React.FC<{ path: string, color: string, width: number, filterId: string, opacity: number }> = ({ path, color, width, filterId, opacity }) => (
    <path 
        d={path} 
        fill="none" 
        stroke={color} 
        strokeWidth={width} 
        strokeLinecap="round" 
        filter={`url(#${filterId})`}
        opacity={opacity}
    />
);

const NeonCap: React.FC<{ rotation: number, color: string, size: number, status: ComponentStatus }> = ({ rotation, color, size, status }) => {
    // Dynamic physics based on status
    const shake = status === 'overdrive' ? `translate(${Math.random()}px, ${Math.random()}px)` : '';
    const capStyle: React.CSSProperties = {
        transform: `rotate(${rotation}deg) ${shake}`,
        boxShadow: status === 'bypass' ? 'none' : `inset 0 1px 3px rgba(255,255,255,0.1), 0 0 ${status === 'overdrive' ? 20 : 10}px ${color}40`,
        borderColor: status === 'bypass' ? '#333' : (status === 'overdrive' ? '#fff' : '#ffffff20')
    };

    return (
        <div 
            className="absolute top-[15%] left-[15%] w-[70%] h-[70%] rounded-full bg-[#08080a] border flex items-center justify-center transition-transform duration-75 will-change-transform z-10"
            style={capStyle}
        >
            <div 
                className={`absolute top-[5%] w-[3px] h-[35%] rounded-full shadow-[0_0_5px_white] transition-colors ${status === 'bypass' ? 'bg-slate-600' : 'bg-white'}`}
                style={{ 
                    backgroundColor: status === 'overdrive' ? '#ffxxxx' : undefined,
                    boxShadow: status === 'overdrive' ? `0 0 10px ${color}, 0 0 20px white` : undefined
                }}
            ></div>
        </div>
    );
};

const HoloLabel: React.FC<{ label: string, color: string, active: boolean }> = ({ label, color, active }) => (
    <span 
        className="mt-1.5 text-[7px] font-black tracking-[0.2em] uppercase transition-all duration-300 text-center truncate w-full relative"
        style={{ 
            color: active ? color : '#475569',
            textShadow: active ? `0 0 8px ${color}` : 'none',
        }}
    >
        {label}
        {active && <span className="absolute inset-0 blur-[2px] opacity-50" aria-hidden="true">{label}</span>}
    </span>
);

// --- MAIN COMPONENT ---

export const Knob: React.FC<KnobProps> = ({ 
    value, min, max, onChange, label, 
    color = 'cyan', size = 46, resetValue, 
    logarithmic = false, unit = '', bipolar = false,
    status = 'normal'
}) => {
  
  const { isDragging, handleStart, percentage } = useControlDrag({
      value, min, max, onChange, logarithmic, sensitivity: 250
  });

  const handleDoubleClick = (e: React.MouseEvent | React.TouchEvent) => {
      e.stopPropagation();
      const target = resetValue !== undefined ? resetValue : (bipolar ? (max+min)/2 : min);
      onChange(target);
  };

  const colorMap: Record<string, string> = {
    cyan: '#00f0ff', blue: '#2f80ed', purple: '#b721ff', green: '#0aff60',
    yellow: '#ffcc00', orange: '#ff6600', red: '#ff003c', pink: '#ff00d4', white: '#ffffff', slate: '#94a3b8'
  };
  const accentColor = status === 'bypass' ? '#333' : (colorMap[color] || colorMap['cyan']);
  const intensity = status === 'overdrive' ? 2.0 : (status === 'dampen' ? 0.5 : 1.0);

  // Geometry
  const START_ANGLE = -135;
  const RANGE = 270;
  const radius = 44; 
  const center = 50;
  const strokeWidth = 6; // Thicker for neon tube effect

  const valueAngle = START_ANGLE + (percentage * RANGE);
  const uniqueId = useMemo(() => Math.random().toString(36).substr(2, 9), []);

  const describeArc = (x: number, y: number, radius: number, startAngle: number, endAngle: number) => {
      const polarToCartesian = (cx: number, cy: number, r: number, angleInDegrees: number) => {
        const angleInRadians = (angleInDegrees - 90) * Math.PI / 180.0;
        return { x: cx + (r * Math.cos(angleInRadians)), y: cy + (r * Math.sin(angleInRadians)) };
      };
      const start = polarToCartesian(x, y, radius, endAngle);
      const end = polarToCartesian(x, y, radius, startAngle);
      const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
      return ["M", start.x, start.y, "A", radius, radius, 0, largeArcFlag, 0, end.x, end.y].join(" ");
  };

  const bgArc = describeArc(center, center, radius, -135, 135);
  
  let activePath = "";
  if (bipolar) {
      const biPerc = (percentage - 0.5) * 2; 
      const angle = biPerc * (RANGE / 2);
      activePath = describeArc(center, center, radius, Math.min(0, angle), Math.max(0, angle));
  } else {
      activePath = describeArc(center, center, radius, -135, valueAngle);
  }

  // Value formatting for Overlay
  let displayValue = value.toFixed(1);
  if (Math.abs(value) < 1 && value !== 0) displayValue = value.toFixed(2);
  if (Math.abs(value) >= 1000) displayValue = (value / 1000).toFixed(1) + 'k';

  return (
    <div 
      className={`flex flex-col items-center justify-center select-none touch-none group relative py-2 ${status === 'bypass' ? 'opacity-50 grayscale' : ''}`}
      onMouseDown={(e) => handleStart(e.clientY)}
      onTouchStart={(e) => handleStart(e.touches[0].clientY)}
      onDoubleClick={handleDoubleClick}
      style={{ width: size + 10, cursor: isDragging ? 'ns-resize' : 'pointer' }}
    >
      {/* Precision Holographic Overlay */}
      <div className={`absolute -top-10 z-50 transition-all duration-200 pointer-events-none flex flex-col items-center
          ${isDragging ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-2 scale-90'}`}
      >
          <div className="bg-[#0c0c0e]/90 border border-white/20 px-2 py-1 rounded shadow-[0_0_20px_rgba(0,0,0,1)] backdrop-blur-xl">
              <span className="text-xs font-bold font-mono text-white" style={{ textShadow: `0 0 10px ${accentColor}` }}>
                  {displayValue}<span className="text-[9px] text-slate-500 ml-0.5">{unit}</span>
              </span>
          </div>
          <div className="w-0.5 h-2 bg-gradient-to-b from-white/20 to-transparent"></div>
      </div>

      <div className="relative" style={{ width: size, height: size }}>
          <svg width="100%" height="100%" viewBox="0 0 100 100">
             <NeonDefs id={uniqueId} color={accentColor} intensity={intensity} />

             {/* Dark Glass Backtrack */}
             <path d={bgArc} fill="none" stroke="#111" strokeWidth={strokeWidth} strokeLinecap="round" />
             <path d={bgArc} fill="none" stroke="#222" strokeWidth={strokeWidth-2} strokeLinecap="round" />

             {/* Active Plasma Stream */}
             {status !== 'bypass' && (
                 <>
                    {/* Glow Layer */}
                    <FluxTrack path={activePath} color={accentColor} width={strokeWidth} filterId={`glow-${uniqueId}`} opacity={0.6 * intensity} />
                    {/* Core Layer */}
                    <FluxTrack path={activePath} color={status === 'overdrive' ? '#fff' : accentColor} width={strokeWidth - 3} filterId="" opacity={1} />
                 </>
             )}
          </svg>

          <NeonCap rotation={valueAngle} color={accentColor} size={size} status={status} />
      </div>
      
      <HoloLabel label={label} color={accentColor} active={isDragging || status === 'overdrive'} />
    </div>
  );
};
