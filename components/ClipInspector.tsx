
import React from 'react';
import { AudioClip } from '../types';
import { Knob } from './Knob';
import { Toggle } from './Toggle';
import { EnvelopeGraph, FilterResponse, LFOOscilloscope } from './Visualizers';

interface ClipInspectorProps {
  clip: AudioClip;
  onUpdate: (clipId: string, updates: Partial<AudioClip['fx']> | { viewConfig: any }) => void;
  onClose: () => void;
}

const InspectorModule: React.FC<{ title: string; children: React.ReactNode; visualizer?: React.ReactNode }> = ({ title, children, visualizer }) => (
    <div className="flex flex-col h-full bg-[#0b1120] border-r border-slate-800 relative group min-w-[140px] overflow-hidden">
         {visualizer}
         {/* Industrial Header */}
         <div className="h-7 bg-black/80 border-b border-slate-800 flex items-center justify-center relative z-10 backdrop-blur-sm">
             <div className="text-[8px] font-black tracking-widest uppercase text-slate-500">{title}</div>
         </div>
         {/* Controls */}
         <div className="flex-1 flex items-center justify-center space-x-3 px-2 relative z-10">
            {children}
         </div>
         {/* Screws */}
         <div className="absolute top-1 right-1 w-0.5 h-0.5 rounded-full bg-slate-700 z-20"></div>
         <div className="absolute top-1 left-1 w-0.5 h-0.5 rounded-full bg-slate-700 z-20"></div>
    </div>
);

export const ClipInspector: React.FC<ClipInspectorProps> = ({ clip, onUpdate, onClose }) => {
  const updateFX = (key: keyof AudioClip['fx'], value: any) => {
    onUpdate(clip.id, { [key]: value });
  };

  const updateView = (key: keyof AudioClip['viewConfig'], value: any) => {
      const currentConfig = clip.viewConfig || { mode: 'PCM', resolution: 2, scale: 1.0 };
      onUpdate(clip.id, { 
          viewConfig: { ...currentConfig, [key]: value } 
      });
  };
  
  const viewScale = clip.viewConfig?.scale || 1;
  const isCandle = clip.viewConfig?.mode === 'CANDLESTICK';

  return (
    <div className="fixed bottom-0 left-0 right-0 h-[200px] bg-[#020617] border-t-2 border-slate-700 shadow-[0_-10px_50px_rgba(0,0,0,0.9)] z-[60] flex flex-col animate-in slide-in-from-bottom duration-300">
      
      {/* Main Header */}
      <div className="h-8 bg-black flex items-center justify-between px-3 border-b border-slate-800 relative">
         <div className="absolute inset-0 opacity-20 pointer-events-none" 
              style={{ backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 5px, rgba(255,255,255,0.05) 5px, rgba(255,255,255,0.05) 10px)' }}></div>
         
         <div className="flex items-center space-x-3 z-10">
            <div className="w-1.5 h-1.5 rounded-full bg-yellow-500 animate-pulse shadow-[0_0_8px_rgba(234,179,8,0.8)]"></div>
            <span className="text-[10px] font-black text-yellow-500 tracking-widest uppercase">CLIP EDITOR</span>
            <span className="text-[10px] text-slate-600">|</span>
            <span className="text-[10px] text-white font-mono uppercase truncate max-w-[200px]">{clip.name}</span>
         </div>
         
         <button onClick={onClose} className="text-slate-500 hover:text-white px-3 font-bold z-10 uppercase text-[9px] tracking-widest border border-transparent hover:border-slate-700 rounded transition-all">
            EXIT
         </button>
      </div>

      {/* Rack Container */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden scrollbar-hide bg-[#050a15] relative">
          {/* Background Grid */}
          <div className="absolute inset-0 opacity-5 pointer-events-none" 
               style={{ backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>
          
          <div className="flex h-full min-w-max">
            
            {/* 1. VISUALS */}
            <InspectorModule title="VISUALIZATION">
                <Knob value={viewScale} min={0.5} max={3.0} label="ZOOM" unit="x" color="white" size={40} onChange={(v) => updateView('scale', v)} />
                <div className="flex flex-col items-center justify-center space-y-2 ml-2">
                    <Toggle 
                        value={isCandle} 
                        onChange={() => updateView('mode', isCandle ? 'PCM' : 'CANDLESTICK')} 
                        label={isCandle ? 'CNDL' : 'PCM'} 
                        color="cyan"
                        vertical
                    />
                    <span className="text-[7px] text-slate-600 font-bold uppercase">TYPE</span>
                </div>
            </InspectorModule>

            {/* 2. SOURCE */}
            <InspectorModule title="SOURCE">
                <Knob value={clip.fx.gain} min={0} max={2} label="GAIN" unit="" color="green" size={40} onChange={(v) => updateFX('gain', v)} />
                <Knob value={clip.fx.pan} min={-1} max={1} label="PAN" unit="" color="yellow" size={40} resetValue={0} bipolar onChange={(v) => updateFX('pan', v)} />
            </InspectorModule>

            {/* 3. TIME */}
            <InspectorModule title="TIME / PITCH">
                <Knob value={clip.fx.pitch} min={0.25} max={2.0} label="RATE" unit="x" color="cyan" size={40} resetValue={1} onChange={(v) => updateFX('pitch', v)} />
                <div className="flex flex-col items-center justify-center space-y-2 ml-1">
                    <Toggle 
                        value={clip.fx.isReversed} 
                        onChange={(v) => updateFX('isReversed', v)} 
                        label="REV" 
                        color="pink"
                    />
                    <span className="text-[7px] text-slate-600 font-bold uppercase">DIR</span>
                </div>
            </InspectorModule>

            {/* 4. ENVELOPE */}
            <InspectorModule title="FADES" visualizer={<EnvelopeGraph fadeIn={clip.fx.fadeIn || 0} fadeOut={clip.fx.fadeOut || 0} color="#22c55e" />}>
                <Knob value={clip.fx.fadeIn || 0.01} min={0.01} max={2.0} label="IN" unit="s" color="green" size={32} onChange={(v) => updateFX('fadeIn', v)} />
                <Knob value={clip.fx.fadeOut || 0.01} min={0.01} max={2.0} label="OUT" unit="s" color="green" size={32} onChange={(v) => updateFX('fadeOut', v)} />
            </InspectorModule>

          </div>
      </div>
    </div>
  );
};
