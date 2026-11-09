
import React, { useEffect, useRef } from 'react';
import { DSPState } from '../types';
import { Knob, ComponentStatus } from './Knob';
import { Fader } from './Fader';
import { Toggle } from './Toggle';
import { audioEngine } from '../services/audioEngine';

interface DSPRackProps {
  dspState: DSPState;
  onChange: (newState: DSPState) => void;
}

// Helper calculation functions (Simplified for Vector Scope)
const calculateFilterPoints = (freq: number, res: number) => {
    // Return array of Y points (0-1)
    const points = [];
    for(let i=0; i<100; i++) {
        const f = 20 * Math.pow(1000, i/99);
        // LP Sim
        const ratio = f/freq;
        let mag = 1 / Math.sqrt(1 + Math.pow(ratio, 4));
        if (Math.abs(ratio - 1) < 0.2) mag += (res * 0.1); // Resonance peak
        points.push(Math.min(1.2, mag));
    }
    return points;
};

const drawVectorScope = (ctx: CanvasRenderingContext2D, width: number, height: number, points: number[], color: string, bypassed: boolean, mode: string) => {
    ctx.clearRect(0,0,width,height);
    const opacity = bypassed ? 0.2 : 1.0;
    
    // Grid
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for(let i=0; i<width; i+=20) { ctx.moveTo(i,0); ctx.lineTo(i,height); }
    for(let i=0; i<height; i+=20) { ctx.moveTo(0,i); ctx.lineTo(width,i); }
    ctx.stroke();

    ctx.strokeStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = bypassed ? 0 : 8;
    ctx.globalAlpha = opacity;
    ctx.lineWidth = 2;
    ctx.beginPath();

    if (mode === 'dynamics') {
        // Points[0] is reduction amount (0-1)
        const red = points[0];
        const h = height;
        const w = width;
        // Draw Reduction Bar
        ctx.fillStyle = color;
        const barH = red * h;
        ctx.fillRect(w/2 - 10, h - barH, 20, barH);
        return;
    }
    
    if (mode === 'output') {
        // Output Spectral Display (FFT)
        // points is FFT data scaled 0-1
        const step = width / points.length;
        ctx.fillStyle = color;
        for(let i=0; i<points.length; i++) {
            const val = points[i];
            const barH = val * height;
            ctx.fillRect(i * step, height - barH, step+1, barH);
        }
        return;
    }

    // Default Line Plot
    const step = width / (points.length - 1);
    for (let i = 0; i < points.length; i++) {
        const val = points[i]; // 0-1 magnitude typically
        // Flip Y, map 1.0 to top, 0.0 to bottom? Usually 1.0 is mid or max. 
        // For filter, 1.0 is full volume.
        const y = height - (Math.min(1, Math.max(0, val)) * height * 0.8) - (height*0.1); 
        
        if(i===0) ctx.moveTo(0, y);
        else ctx.lineTo(i * step, y);
    }
    ctx.stroke();
    
    // Fill
    ctx.fillStyle = color;
    ctx.globalAlpha = opacity * 0.2;
    ctx.lineTo(width, height);
    ctx.lineTo(0, height);
    ctx.fill();

    ctx.globalAlpha = 1.0;
    ctx.shadowBlur = 0;
};

const RackModule: React.FC<{
  title: string;
  type: 'filter' | 'saturator' | 'exciter' | 'eq' | 'dynamics' | 'spatial' | 'width' | 'output';
  color: string;
  dspState: DSPState;
  children: React.ReactNode;
  isBypassed?: boolean;
  onToggleBypass?: () => void;
}> = ({ title, type, color, dspState, children, isBypassed = false, onToggleBypass }) => {
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const colorMap: Record<string, string> = {
    pink: '#ff00d4', orange: '#ff6600', blue: '#2f80ed',
    yellow: '#ffcc00', purple: '#b721ff', cyan: '#00f0ff',
    red: '#ff003c', green: '#0aff60',
  };
  const hexColor = colorMap[color] || '#3b82f6';

  // Determine status for children based on module bypass
  const status: ComponentStatus = isBypassed ? 'bypass' : 'normal';

  // Clone children to inject status prop
  const childrenWithStatus = React.Children.map(children, child => {
      if (React.isValidElement(child)) {
          // @ts-ignore
          return React.cloneElement(child, { status });
      }
      return child;
  });

  useEffect(() => {
     const canvas = canvasRef.current;
     if(!canvas) return;
     const ctx = canvas.getContext('2d');
     if(!ctx) return;
     
     let frameId: number;
     const dataArray = new Uint8Array(audioEngine.analyser.frequencyBinCount);

     const render = () => {
         frameId = requestAnimationFrame(render);
         
         const w = canvas.width;
         const h = canvas.height;
         let points: number[] = [];

         if (type === 'filter') points = calculateFilterPoints(dspState.masterFilterFreq, dspState.masterFilterRes);
         else if (type === 'saturator') {
             // Drive curve visualization (Linear)
             for(let i=0; i<100; i++) {
                 const x = (i/50) - 1; // -1 to 1
                 const k = dspState.masterSaturation;
                 const y = ((Math.PI + k) * x) / (Math.PI + k * Math.abs(x));
                 points.push((y + 1) / 2); // 0-1
             }
         }
         else if (type === 'eq') {
             // EQ curve approx
             for(let i=0; i<100; i++) {
                let gain = 0;
                if (i < 33) gain = dspState.masterEqLow;
                else if (i < 66) gain = dspState.masterEqMid;
                else gain = dspState.masterEqHigh;
                // Interpolate
                points.push((gain + 12) / 24); // +/- 12db mapped to 0-1
             }
         }
         else if (type === 'dynamics') {
             const reduction = audioEngine.getMasterGainReduction(); 
             points = [Math.abs(reduction) / 20.0];
         }
         else if (type === 'spatial') {
             // Delay taps visual
             for(let i=0; i<50; i++) points.push(Math.random() * dspState.reverbMix);
         }
         else if (type === 'output') {
             audioEngine.analyser.getByteFrequencyData(dataArray);
             for(let i=0; i<50; i++) {
                 points.push(dataArray[i*2] / 255);
             }
         }
         else {
             points = new Array(100).fill(0.5);
         }
         
         drawVectorScope(ctx, w, h, points, hexColor, !!isBypassed, type);
     };
     render();
     return () => cancelAnimationFrame(frameId);
  }, [type, dspState, hexColor, isBypassed]);

  return (
    <div className={`flex flex-col h-full backdrop-blur-md border-r border-white/5 relative group min-w-[170px] overflow-hidden transition-colors ${isBypassed ? 'bg-black/60' : 'bg-white/5'}`}>
      
      {/* VFD Screen Area */}
      <div className="h-24 relative p-3 flex flex-col items-center justify-end bg-black/40 shadow-[inset_0_10px_30px_rgba(0,0,0,0.5)]">
        <div className={`w-full h-full relative rounded border overflow-hidden transition-colors ${isBypassed ? 'border-white/5 bg-black' : 'border-white/10 bg-black/80'}`}>
             <div className="absolute inset-0 z-20 pointer-events-none opacity-20" style={{ backgroundImage: 'linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.06), rgba(0, 255, 0, 0.02), rgba(0, 0, 255, 0.06))', backgroundSize: '100% 2px, 3px 100%' }}></div>
             <canvas ref={canvasRef} width={140} height={60} className="w-full h-full" />
        </div>
        
        {/* Module Title Badge */}
        <div className={`absolute top-3 left-3 px-1.5 py-0.5 border rounded z-30 shadow-[0_0_10px_rgba(0,0,0,1)] flex items-center gap-2 ${isBypassed ? 'border-white/5 bg-black text-slate-600' : 'border-white/10 bg-black/80'}`}>
            <span className={`text-[9px] font-black tracking-widest uppercase transition-colors ${isBypassed ? 'text-slate-600' : 'text-white/90'}`} style={{ textShadow: isBypassed ? 'none' : `0 0 5px ${hexColor}` }}>{title}</span>
        </div>

        {/* Bypass LED */}
        {onToggleBypass && (
            <button 
                onClick={onToggleBypass}
                className={`absolute top-3 right-3 w-3 h-3 rounded-full border transition-all z-40 ${isBypassed ? 'bg-slate-900 border-slate-700' : `bg-${color}-500 border-white shadow-[0_0_8px_${hexColor}]`}`}
                style={{ backgroundColor: isBypassed ? '#111' : hexColor }}
            ></button>
        )}
      </div>

      {/* Controls Area */}
      <div className={`flex-1 flex items-center justify-center space-x-4 px-3 py-2 relative transition-all duration-300 ${isBypassed ? 'opacity-50 grayscale' : 'opacity-100'}`}>
         {childrenWithStatus}
      </div>
      <div className="absolute top-0 bottom-0 left-0 w-px bg-white/10"></div>
    </div>
  );
};

export const DSPRack: React.FC<DSPRackProps> = ({ dspState, onChange }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let animationId: number;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dataArray = new Uint8Array(audioEngine.analyser.frequencyBinCount);
    
    const draw = () => {
      animationId = requestAnimationFrame(draw);
      audioEngine.analyser.getByteFrequencyData(dataArray);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const numBlocks = 64;
      const blockWidth = canvas.width / numBlocks;
      const step = Math.floor(dataArray.length / numBlocks);

      for(let i = 0; i < numBlocks; i++) {
        const val = dataArray[i * step] / 255; 
        const activeHeight = val * canvas.height;
        ctx.fillStyle = `hsl(${210 + (val * 60)}, 100%, 60%)`;
        ctx.globalAlpha = 0.8;
        ctx.fillRect(i * blockWidth, canvas.height - activeHeight, blockWidth - 1, activeHeight);
        
        ctx.globalAlpha = 0.2;
        ctx.fillRect(i * blockWidth, canvas.height, blockWidth - 1, activeHeight * 0.5);
      }
    };
    draw();
    return () => cancelAnimationFrame(animationId);
  }, []);

  return (
    <div className="fixed bottom-0 left-0 right-0 h-[260px] bg-[#030305]/95 backdrop-blur-xl border-t border-white/10 shadow-[0_-10px_50px_rgba(0,0,0,0.9)] z-50 flex flex-col">
      <div className="flex h-6 border-b border-white/5 bg-black/50 relative shrink-0 items-center px-2 overflow-hidden">
        <canvas ref={canvasRef} width={800} height={32} className="absolute inset-0 w-full h-full opacity-50 mix-blend-screen" />
        <div className="relative z-10 text-[9px] text-cyan-400 font-mono tracking-widest px-2 bg-black/60 rounded border border-cyan-900/50">
          QUANTUM DSP MATRIX // SYSTEM ONLINE
        </div>
      </div>
      <div className="flex-1 overflow-x-auto overflow-y-hidden scrollbar-hide">
        <div className="flex h-full min-w-max">
          <RackModule title="RESONANCE" type="filter" color="pink" dspState={dspState} isBypassed={dspState.masterFilterBypass} onToggleBypass={() => onChange({...dspState, masterFilterBypass: !dspState.masterFilterBypass})}>
             <Knob value={dspState.masterFilterFreq} min={20} max={20000} logarithmic label="FREQ" unit="Hz" color="pink" onChange={(v) => onChange({...dspState, masterFilterFreq: v})} />
             <Knob value={dspState.masterFilterRes} min={0} max={20} label="Q-FAC" color="pink" onChange={(v) => onChange({...dspState, masterFilterRes: v})} />
          </RackModule>
          <RackModule title="EQUALIZER" type="eq" color="blue" dspState={dspState} isBypassed={dspState.masterEqBypass} onToggleBypass={() => onChange({...dspState, masterEqBypass: !dspState.masterEqBypass})}>
             <Fader value={dspState.masterEqLow} min={-12} max={12} label="LO" unit="dB" color="blue" onChange={(v) => onChange({...dspState, masterEqLow: v})} />
             <Fader value={dspState.masterEqMid} min={-12} max={12} label="MID" unit="dB" color="blue" onChange={(v) => onChange({...dspState, masterEqMid: v})} />
             <Fader value={dspState.masterEqHigh} min={-12} max={12} label="HI" unit="dB" color="blue" onChange={(v) => onChange({...dspState, masterEqHigh: v})} />
          </RackModule>
          <RackModule title="DYNAMICS" type="dynamics" color="yellow" dspState={dspState} isBypassed={dspState.masterCompressorBypass} onToggleBypass={() => onChange({...dspState, masterCompressorBypass: !dspState.masterCompressorBypass})}>
             <Knob value={dspState.masterCompressorThreshold} min={-60} max={0} label="THR" unit="dB" color="yellow" resetValue={0} onChange={(v) => onChange({...dspState, masterCompressorThreshold: v})} />
             <Knob value={dspState.masterCompressorRatio} min={1} max={20} label="RAT" unit=":1" color="yellow" resetValue={1} onChange={(v) => onChange({...dspState, masterCompressorRatio: v})} />
          </RackModule>
          <RackModule title="SATURATION" type="saturator" color="orange" dspState={dspState} isBypassed={dspState.masterSaturationBypass} onToggleBypass={() => onChange({...dspState, masterSaturationBypass: !dspState.masterSaturationBypass})}>
             <Fader value={dspState.masterSaturation} min={0} max={100} label="PLASMA" unit="%" color="orange" onChange={(v) => onChange({...dspState, masterSaturation: v})} status={dspState.masterSaturation > 80 ? 'overdrive' : 'normal'} />
          </RackModule>
          <RackModule title="DIMENSION" type="spatial" color="cyan" dspState={dspState} isBypassed={dspState.masterSpatialBypass} onToggleBypass={() => onChange({...dspState, masterSpatialBypass: !dspState.masterSpatialBypass})}>
             <Knob value={dspState.delayTime} min={0} max={1.0} label="TIME" unit="s" color="cyan" onChange={(v) => onChange({...dspState, delayTime: v})} />
             <Knob value={dspState.delayFeedback} min={0} max={0.9} label="FDBK" unit="%" color="cyan" onChange={(v) => onChange({...dspState, delayFeedback: v})} />
             <Fader value={dspState.reverbMix} min={0} max={1} label="MIX" unit="%" color="cyan" onChange={(v) => onChange({...dspState, reverbMix: v})} />
          </RackModule>
           <RackModule title="MAIN OUT" type="output" color="red" dspState={dspState}>
             <Fader value={dspState.masterVolume} min={0} max={1.5} label="GAIN" unit="dB" color="red" onChange={(v) => onChange({...dspState, masterVolume: v})} status={dspState.masterVolume > 1.0 ? 'overdrive' : 'normal'} />
          </RackModule>
        </div>
      </div>
    </div>
  );
};
