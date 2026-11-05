
import React from 'react';
import { useControlDrag } from '../hooks/useControlDrag';
import { ComponentStatus } from './Knob';

interface FaderProps {
  value: number;
  min: number;
  max: number;
  onChange: (val: number) => void;
  label: string;
  color?: string;
  height?: number;
  unit?: string;
  status?: ComponentStatus;
}

// --- SUB COMPONENTS ---

const ScaleMarkings: React.FC<{ height: number }> = ({ height }) => (
    <div className="absolute left-0 top-0 bottom-0 w-full pointer-events-none flex flex-col justify-between py-2 opacity-30">
        {[...Array(11)].map((_, i) => (
             <div key={i} className={`w-full h-px ${i % 5 === 0 ? 'bg-slate-400 w-4 mx-auto' : 'bg-slate-700 w-1.5 mx-auto'}`}></div>
        ))}
    </div>
);

const PlasmaRail: React.FC<{ percentage: number, color: string, status: ComponentStatus }> = ({ percentage, color, status }) => {
    const isBypass = status === 'bypass';
    const isOverdrive = status === 'overdrive';
    
    return (
        <div className="absolute w-2 h-full bg-[#050505] rounded-full shadow-[inset_0_0_5px_rgba(0,0,0,1)] border border-white/5 overflow-hidden ring-1 ring-white/5">
             {/* Background Gas */}
             <div className="absolute inset-0 bg-white/5" style={{ opacity: 0.1 }}></div>
             
             {/* Active Plasma */}
             <div 
                className="absolute bottom-0 w-full transition-all duration-75"
                style={{ 
                    height: `${percentage * 100}%`, 
                    background: isBypass 
                        ? '#333' 
                        : `linear-gradient(to top, ${color}cc, ${color})`,
                    boxShadow: isBypass 
                        ? 'none' 
                        : `0 0 ${isOverdrive ? '20px' : '10px'} ${color}, inset 0 0 5px white`,
                    opacity: isBypass ? 0.5 : (isOverdrive ? 1 : 0.9)
                }}
             >
                 {/* Turbulent filament core simulation */}
                 {!isBypass && <div className="absolute inset-0 w-[1px] h-full bg-white/60 mx-auto blur-[1px]"></div>}
             </div>
        </div>
    );
};

const QuantumThumb: React.FC<{ percentage: number, color: string, isDragging: boolean, status: ComponentStatus }> = ({ percentage, color, isDragging, status }) => {
    const isOverdrive = status === 'overdrive';
    const shake = isOverdrive ? `translate(${Math.random()*2 - 1}px, ${Math.random()*2 - 1}px)` : '';
    
    return (
        <div 
            className="absolute w-10 h-6 flex items-center justify-center z-20 pointer-events-none will-change-transform transition-all duration-75 ease-out"
            style={{ 
                bottom: `calc(${percentage * 100}% - 12px)`,
                transform: shake
            }}
        >
             <div className={`w-full h-full rounded shadow-[0_4px_10px_rgba(0,0,0,0.9),inset_0_1px_1px_rgba(255,255,255,0.15)] flex flex-col items-center justify-center gap-[2px] transition-colors border
                ${status === 'bypass' ? 'bg-[#222] border-black' : 'bg-gradient-to-b from-[#333] to-[#111] border-black'}
             `}>
                 {/* Grip Lines */}
                 <div className="w-[80%] h-[1px] bg-black/60 shadow-[0_1px_0_rgba(255,255,255,0.05)]"></div>
                 <div className="w-[80%] h-[1px] bg-black/60 shadow-[0_1px_0_rgba(255,255,255,0.05)]"></div>
                 <div className="w-[80%] h-[1px] bg-black/60 shadow-[0_1px_0_rgba(255,255,255,0.05)]"></div>
                 
                 {/* LED Indicator */}
                 <div 
                    className="absolute w-[90%] h-[2px] bg-white mix-blend-overlay opacity-90 rounded-full transition-all" 
                    style={{ 
                        backgroundColor: (isDragging || isOverdrive) && status !== 'bypass' ? color : 'white',
                        boxShadow: (isDragging || isOverdrive) && status !== 'bypass' ? `0 0 10px ${color}` : 'none'
                    }}
                 ></div>
             </div>
        </div>
    );
};

// --- MAIN COMPONENT ---

export const Fader: React.FC<FaderProps> = ({ 
    value, min, max, onChange, label, 
    color = 'cyan', height = 140, unit = '',
    status = 'normal'
}) => {
  
  const { isDragging, handleStart, percentage } = useControlDrag({
      value, min, max, onChange, direction: 'vertical', sensitivity: 200
  });

  const handleDoubleClick = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    const target = (min <= 0 && max >= 0) ? 0 : min;
    onChange(target);
  };

  const colorMap: Record<string, string> = {
    cyan: '#00f0ff', blue: '#2f80ed', purple: '#b721ff', green: '#0aff60',
    yellow: '#ffcc00', orange: '#ff6600', red: '#ff003c', pink: '#ff00d4', white: '#ffffff'
  };
  const accentColor = colorMap[color] || colorMap['cyan'];
  
  const safeValue = Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));

  return (
    <div className={`flex flex-col items-center justify-center space-y-2 select-none touch-none group relative w-12 ${status === 'bypass' ? 'opacity-60 grayscale' : ''}`}>
      
      {/* Precision Overlay */}
      <div className={`absolute -top-12 z-50 transition-all duration-200 pointer-events-none flex flex-col items-center
          ${isDragging ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-2 scale-90'}`}
      >
          <div className="bg-[#0c0c0e]/90 border border-white/20 px-2 py-1 rounded shadow-[0_4px_20px_rgba(0,0,0,1)] backdrop-blur-xl whitespace-nowrap">
              <span className="text-sm font-bold font-mono text-white" style={{ textShadow: `0 0 10px ${accentColor}` }}>
                  {safeValue.toFixed(2)}<span className="text-[9px] text-slate-500 ml-0.5">{unit}</span>
              </span>
          </div>
          <div className="w-0.5 h-2 bg-gradient-to-b from-white/20 to-transparent"></div>
      </div>

      <div 
        className="relative w-full flex justify-center cursor-ns-resize py-2"
        style={{ height: height }}
        onMouseDown={(e) => handleStart(e.clientY)}
        onTouchStart={(e) => handleStart(e.touches[0].clientY)}
        onDoubleClick={handleDoubleClick}
      >
        <ScaleMarkings height={height} />
        <PlasmaRail percentage={percentage} color={accentColor} status={status} />
        <QuantumThumb percentage={percentage} color={accentColor} isDragging={isDragging} status={status} />
      </div>
      
      <span 
        className="text-[7px] font-black tracking-[0.2em] uppercase transition-all duration-200 truncate w-full text-center"
        style={{ 
            color: isDragging || status === 'overdrive' ? accentColor : '#52525b',
            textShadow: isDragging || status === 'overdrive' ? `0 0 8px ${accentColor}` : 'none'
        }}
      >
        {label}
      </span>
    </div>
  );
};
