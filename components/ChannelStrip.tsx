
import React, { useState, useRef, useEffect } from 'react';
import { Track, ViewSettings } from '../types';
import { COLORS, TRACK_HEIGHT, EXPANDED_TRACK_HEIGHT, TRACK_PRESETS } from '../constants';
import { Knob } from './Knob';
import { Fader } from './Fader';
import { Toggle } from './Toggle';
import { XYPad } from './XYPad';
import { audioEngine } from '../services/audioEngine';
import { DynamicsTransfer, FilterResponse, LFOOscilloscope } from './Visualizers';

interface ChannelStripProps {
  track: Track;
  onUpdate: (id: string, updates: Partial<Track>) => void;
  onToggleArm: (id: string) => void;
  onToggleExpand: (id: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  width: number;
  viewSettings: ViewSettings;
  isCollapsed: boolean;
}

type Tab = 'DYNAMICS' | 'EQUALIZER' | 'SPACE';

export const ChannelStrip: React.FC<ChannelStripProps> = React.memo(({ 
    track, onUpdate, onToggleArm, onToggleExpand, onDuplicate, onDelete,
    width, viewSettings, isCollapsed 
}) => {
  const [showColors, setShowColors] = useState(false);
  const [showPresets, setShowPresets] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('DYNAMICS');
  const menuRef = useRef<HTMLDivElement>(null);
  const presetRef = useRef<HTMLDivElement>(null);
  const meterCanvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setShowColors(false);
      if (presetRef.current && !presetRef.current.contains(event.target as Node)) setShowPresets(false);
    };
    if (showColors || showPresets) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showColors, showPresets]);

  // Meter Animation Loop
  useEffect(() => {
    if (isCollapsed) return;
    const canvas = meterCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let peakHold = 0;
    let peakTimer = 0;

    const drawMeter = () => {
        const rms = audioEngine.getTrackRMS(track.id);
        const w = canvas.width;
        const h = canvas.height;
        ctx.clearRect(0, 0, w, h);
        
        ctx.fillStyle = '#111';
        ctx.fillRect(0, 0, w, h);
        
        const level = Math.min(1.0, rms * 2.5); 
        const activeW = level * w;
        
        const grad = ctx.createLinearGradient(0, 0, w, 0);
        grad.addColorStop(0, track.color + '20'); 
        grad.addColorStop(0.5, track.color);     
        grad.addColorStop(1, '#fff');            
        
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, activeW, h);

        if (level > peakHold) {
            peakHold = level;
            peakTimer = 60;
        } else {
            if (peakTimer > 0) peakTimer--;
            else peakHold *= 0.95;
        }

        ctx.fillStyle = '#fff';
        ctx.fillRect(peakHold * w, 0, 2, h);
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        for(let i=1; i<10; i++) ctx.fillRect(i * (w/10), 0, 1, h);

        animId = requestAnimationFrame(drawMeter);
    };

    drawMeter();
    return () => cancelAnimationFrame(animId);
  }, [track.id, track.color, isCollapsed]);

  const updateFX = (key: keyof typeof track.fx, value: any) => {
      onUpdate(track.id, {
          fx: { ...track.fx, [key]: value }
      });
  };
  
  const applyPreset = (presetName: string) => {
      const preset = TRACK_PRESETS[presetName];
      if (preset) {
          onUpdate(track.id, {
              fx: { ...track.fx, ...preset }
          });
          setShowPresets(false);
      }
  };

  const isWide = width > 200;

  return (
    <div 
        className="sticky left-0 z-20 flex flex-col transition-all duration-300 ease-out group shadow-[4px_0_20px_rgba(0,0,0,0.8)] overflow-hidden" 
        style={{ 
            width: width,
            height: track.isExpanded ? EXPANDED_TRACK_HEIGHT : TRACK_HEIGHT,
            background: '#0a0a0c',
            borderRight: `1px solid ${track.color}20`
        }}
    >
       {/* --- HEADER SECTION --- */}
       <div className="p-3 flex-shrink-0 flex flex-col relative" style={{ height: TRACK_HEIGHT }}>
            <div className={`flex items-center gap-2 relative z-30 transition-all ${isCollapsed ? 'justify-center flex-col h-full space-y-4' : 'justify-between mb-2'}`}>
                <div className="relative flex-shrink-0" ref={menuRef}>
                    <button
                        className="w-3 h-3 rounded-full transition-all duration-300 hover:scale-125"
                        style={{ backgroundColor: track.color, boxShadow: `0 0 8px ${track.color}` }}
                        onClick={() => setShowColors(!showColors)}
                    />
                    {showColors && (
                    <div className="absolute top-full left-0 mt-2 bg-black/90 backdrop-blur-xl border border-white/10 p-2 rounded-lg grid grid-cols-4 gap-2 shadow-2xl z-50 w-32 animate-in zoom-in-95 duration-100">
                        {COLORS.map(c => (
                            <button key={c} className="w-5 h-5 rounded-full border border-white/10 hover:scale-110 transition-transform" style={{ backgroundColor: c, boxShadow: `0 0 10px ${c}` }}
                            onClick={(e) => { e.stopPropagation(); onUpdate(track.id, { color: c }); setShowColors(false); }} />
                        ))}
                    </div>
                    )}
                </div>
                {!isCollapsed && (
                    <input
                        className="bg-transparent text-[13px] font-bold text-slate-200 w-full outline-none px-0.5 truncate tracking-wide focus:text-white placeholder-slate-600 font-mono transition-all"
                        value={track.name}
                        onChange={(e) => onUpdate(track.id, { name: e.target.value })}
                        style={{ opacity: width < 60 ? 0 : 1 }}
                    />
                )}
                <button 
                    onClick={() => onToggleArm(track.id)} 
                    className={`w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center transition-all ${track.armed ? 'bg-red-500/10 shadow-[0_0_15px_rgba(220,38,38,0.4)]' : 'bg-transparent hover:bg-white/5'}`}
                >
                    <div className={`w-2.5 h-2.5 rounded-full transition-all ${track.armed ? 'bg-red-500 animate-pulse' : 'bg-slate-700'}`} />
                </button>
            </div>

            {!isCollapsed && (
                <div className={`flex space-x-1 mb-3 transition-all duration-300 overflow-hidden ${viewSettings.showTransport ? 'opacity-100 max-h-10' : 'opacity-0 max-h-0'}`}>
                    <Toggle value={track.muted} onChange={() => onUpdate(track.id, { muted: !track.muted })} label="MUTE" color="orange" size="sm" />
                    <Toggle value={track.solo} onChange={() => onUpdate(track.id, { solo: !track.solo })} label="SOLO" color="yellow" size="sm" />
                    {viewSettings.showRack && (
                        <Toggle value={track.isExpanded} onChange={() => onToggleExpand(track.id)} label="FX" color="blue" size="sm" />
                    )}
                </div>
            )}
            
            {!isCollapsed && width > 100 && (
                <div className="absolute right-2 top-10 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                        className="text-[8px] text-slate-700 hover:text-white uppercase tracking-wider"
                        onClick={() => onDuplicate(track.id)}
                    >Dup</button>
                    <button 
                        className="text-[8px] text-red-700 hover:text-red-500 uppercase tracking-wider"
                        onClick={() => onDelete(track.id)}
                    >Del</button>
                </div>
             )}

            {!isCollapsed && (
                <div className={`flex flex-col space-y-3 transition-all duration-500 overflow-hidden ${viewSettings.showMix ? 'opacity-100 max-h-24' : 'opacity-0 max-h-0'}`}>
                    {/* Volume Meter & Fader Logic (Simplified for Strip view) */}
                    <div className="flex items-center space-x-2 group/vol relative">
                         {isWide && <span className="text-[8px] font-bold text-slate-600 w-8 text-right">VOL</span>}
                        <div className="flex-1 h-3 relative flex items-center bg-[#111] rounded-sm overflow-hidden border border-white/10 cursor-ew-resize">
                            <canvas ref={meterCanvasRef} width={200} height={12} className="absolute inset-0 w-full h-full opacity-60 pointer-events-none" />
                            <div className="absolute top-0 bottom-0 w-1 bg-white shadow-[0_0_10px_white] z-10 pointer-events-none" style={{ left: `${track.volume * 100}%` }}></div>
                            <input 
                                type="range" min="0" max="1" step="0.01" value={track.volume} 
                                onChange={(e) => onUpdate(track.id, { volume: parseFloat(e.target.value) })}
                                className="absolute w-full h-full opacity-0 cursor-ew-resize z-20" 
                            />
                        </div>
                        {isWide && <span className="text-[9px] font-mono text-white w-8 text-right">{(track.volume * 100).toFixed(0)}</span>}
                    </div>

                    {/* Pan Logic */}
                    <div className="flex items-center space-x-2 group/pan">
                         {isWide && <span className="text-[8px] font-bold text-slate-600 w-8 text-right">PAN</span>}
                        <div className="flex-1 h-1.5 relative flex items-center bg-[#111] rounded-full border border-white/5 cursor-ew-resize">
                            <div className="absolute left-1/2 w-px h-full bg-slate-600"></div>
                            <div className="absolute h-2.5 w-2.5 rounded-full shadow-[0_0_8px_white] bg-white pointer-events-none transition-transform top-1/2 -translate-y-1/2" style={{ left: `calc(${((track.pan + 1) / 2) * 100}% - 5px)` }} />
                            <input 
                                type="range" min="-1" max="1" step="0.1" value={track.pan} 
                                onChange={(e) => onUpdate(track.id, { pan: parseFloat(e.target.value) })}
                                className="absolute w-full h-full opacity-0 cursor-ew-resize" 
                            />
                        </div>
                        {isWide && <span className="text-[9px] font-mono text-slate-400 w-8 text-right">{track.pan.toFixed(1)}</span>}
                    </div>
                </div>
            )}
       </div>

       {/* --- MODULAR FX RACK --- */}
       {track.isExpanded && !isCollapsed && (
           <div className="flex-1 flex flex-col overflow-hidden relative bg-[#050505] animate-in slide-in-from-left duration-300">
               
               {/* PRESET MENU */}
               <div className="absolute top-0 right-0 z-50 p-2" ref={presetRef}>
                  <button 
                      onClick={() => setShowPresets(!showPresets)}
                      className="px-2 py-1 bg-[#1a1a1e] border border-white/10 rounded text-[9px] font-bold text-cyan-500 hover:text-cyan-400 hover:border-cyan-500/50 uppercase tracking-widest"
                  >
                      Presets
                  </button>
                  {showPresets && (
                      <div className="absolute right-2 top-8 w-48 bg-black/95 border border-cyan-900 rounded shadow-2xl overflow-hidden flex flex-col max-h-64 overflow-y-auto z-50">
                          {Object.keys(TRACK_PRESETS).map(name => (
                              <button
                                  key={name}
                                  onClick={() => applyPreset(name)}
                                  className="text-left px-3 py-2 text-[10px] text-slate-300 hover:bg-cyan-900/30 hover:text-white border-b border-white/5 last:border-0 font-mono"
                              >
                                  {name}
                              </button>
                          ))}
                      </div>
                  )}
               </div>

               {/* TABS */}
               <div className="flex border-b border-white/5 bg-[#080808]">
                   {(['DYNAMICS', 'EQUALIZER', 'SPACE'] as Tab[]).map(tab => (
                       <button
                           key={tab}
                           onClick={() => setActiveTab(tab)}
                           className={`flex-1 py-3 text-[9px] font-black tracking-widest border-r border-white/5 transition-colors
                           ${activeTab === tab ? 'bg-[#111] text-cyan-400 border-b-2 border-b-cyan-500' : 'text-slate-600 hover:text-slate-400'}`}
                       >{tab}</button>
                   ))}
               </div>

               {/* TAB CONTENT (GRID LAYOUT) */}
               <div className="flex-1 overflow-y-auto p-0 scrollbar-hide bg-[#0b0b0d]">
                   
                   {/* 1. DYNAMICS: COMPRESSOR */}
                   {activeTab === 'DYNAMICS' && (
                       <div className="h-full flex flex-col">
                           {/* TOP: COMPRESSOR VISUALIZER + MAIN CONTROLS */}
                           <div className="h-[200px] relative border-b border-white/5 p-4 flex items-center justify-around overflow-hidden">
                               <DynamicsTransfer threshold={track.fx.compressorThreshold} ratio={track.fx.compressorRatio} color="#eab308" />
                               <div className="relative z-10 flex space-x-6">
                                    <Knob value={track.fx.compressorThreshold} min={-60} max={0} label="THRESH" unit="dB" color="yellow" size={50} onChange={(v) => updateFX('compressorThreshold', v)} />
                                    <Knob value={track.fx.compressorRatio} min={1} max={20} label="RATIO" unit=":1" color="yellow" size={50} onChange={(v) => updateFX('compressorRatio', v)} />
                               </div>
                           </div>
                           {/* BOTTOM: ENVELOPE */}
                           <div className="flex-1 grid grid-cols-1">
                               <div className="p-2 flex flex-col items-center justify-center space-y-2 bg-[#0e0e11]">
                                   <span className="text-[8px] font-bold text-slate-500 mb-1">ENVELOPE</span>
                                   <div className="flex space-x-2">
                                       <Knob value={(track.fx.compressorAttack || 0.003) * 1000} min={1} max={100} label="ATTACK" unit="ms" color="yellow" size={36} onChange={(v) => updateFX('compressorAttack', v/1000)} />
                                       <Knob value={(track.fx.compressorRelease || 0.25) * 1000} min={10} max={1000} label="RELEASE" unit="ms" color="yellow" size={36} onChange={(v) => updateFX('compressorRelease', v/1000)} />
                                   </div>
                               </div>
                           </div>
                       </div>
                   )}

                   {/* 2. EQUALIZER */}
                   {activeTab === 'EQUALIZER' && (
                       <div className="h-full flex flex-col relative">
                            {/* EQ VISUALIZER BACKGROUND */}
                            <div className="absolute inset-0 opacity-20 pointer-events-none">
                                <FilterResponse freq={track.fx.highPassFreq} res={0.7} type="highpass" color="#555" />
                                <FilterResponse freq={200} res={0.7} gain={track.fx.eqLow} type="lowshelf" color="#06b6d4" />
                                <FilterResponse freq={1000} res={0.7} gain={track.fx.eqMid} type="peaking" color="#06b6d4" />
                                <FilterResponse freq={4000} res={0.7} gain={track.fx.eqHigh} type="highshelf" color="#06b6d4" />
                            </div>

                            <div className="flex-1 grid grid-cols-3 gap-px bg-white/5">
                                <div className="bg-[#0b0b0d] flex flex-col items-center justify-center pt-4">
                                    <Fader value={track.fx.eqLow} min={-12} max={12} label="LOW" unit="dB" color="cyan" height={160} onChange={(v) => updateFX('eqLow', v)} />
                                    <div className="mt-2 border-t border-white/5 w-full flex justify-center py-2">
                                       <Knob value={track.fx.highPassFreq} min={20} max={500} logarithmic label="HPF" unit="Hz" color="slate" size={32} onChange={(v) => updateFX('highPassFreq', v)} />
                                    </div>
                                </div>
                                <div className="bg-[#0b0b0d] flex flex-col items-center justify-center pt-4">
                                    <Fader value={track.fx.eqMid} min={-12} max={12} label="MID" unit="dB" color="cyan" height={160} onChange={(v) => updateFX('eqMid', v)} />
                                    <div className="mt-2 border-t border-white/5 w-full flex justify-center py-2">
                                       <span className="text-[9px] text-slate-700 font-mono">1kHz</span>
                                    </div>
                                </div>
                                <div className="bg-[#0b0b0d] flex flex-col items-center justify-center pt-4">
                                    <Fader value={track.fx.eqHigh} min={-12} max={12} label="HIGH" unit="dB" color="cyan" height={160} onChange={(v) => updateFX('eqHigh', v)} />
                                    <div className="mt-2 border-t border-white/5 w-full flex justify-center py-2">
                                       <span className="text-[9px] text-slate-700 font-mono">10kHz</span>
                                    </div>
                                </div>
                            </div>
                       </div>
                   )}

                   {/* 3. SPACE */}
                   {activeTab === 'SPACE' && (
                       <div className="grid grid-cols-2 gap-px bg-white/5 h-full">
                           {/* SATURATION */}
                           <div className="col-span-2 bg-[#0e0e11] flex flex-col items-center justify-center border-b border-white/5 p-4">
                                <span className="text-[8px] text-orange-500 font-bold mb-2">TUBE DRIVE</span>
                                <Knob value={track.fx.saturation || 0} min={0} max={100} label="DRIVE" unit="%" color="orange" size={50} onChange={(v) => updateFX('saturation', v)} />
                           </div>

                           {/* SENDS */}
                           <div className="col-span-2 bg-[#0e0e11] flex flex-row items-center justify-around p-4">
                                <Knob value={track.fx.sendReverb} min={0} max={1} label="VERB" unit="%" color="blue" size={50} onChange={(v) => updateFX('sendReverb', v)} />
                                <Knob value={track.fx.sendDelay} min={0} max={1} label="DELAY" unit="%" color="blue" size={50} onChange={(v) => updateFX('sendDelay', v)} />
                           </div>
                       </div>
                   )}

               </div>
           </div>
       )}
    </div>
  );
});
