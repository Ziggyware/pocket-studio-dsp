
import React, { useState } from 'react';
import { Track, AudioClip, EditMode } from '../types';
import { TRACK_HEIGHT } from '../constants';
import { Waveform } from './Waveform';

interface TrackLaneProps {
  track: Track;
  clips: AudioClip[];
  editMode: EditMode;
  selectedClipId: string | null;
  onClipInteract: (clipId: string, action: 'start' | 'move' | 'end' | 'tap' | 'context', data?: any) => void;
  // currentTime removed from internal usage props to avoid re-renders
  isPlaying: boolean;
  zoom: number; // Pixels per second
}

export const TrackLane: React.FC<TrackLaneProps> = React.memo(({ 
  track, 
  clips, 
  editMode,
  selectedClipId,
  onClipInteract,
  zoom
}) => {
  // Dynamic Grid sizing
  const majorGrid = 1.0 * zoom; 
  const minorGrid = 0.25 * zoom;
  
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, clipId: string } | null>(null);

  const handleContextMenu = (e: React.MouseEvent, clipId: string) => {
      e.preventDefault();
      e.stopPropagation();
      setContextMenu({ x: e.clientX, y: e.clientY, clipId });
  };

  const handleAction = (action: string) => {
      if (contextMenu) {
          onClipInteract(contextMenu.clipId, 'context', { action });
          setContextMenu(null);
      }
  };

  return (
    <div 
      className={`relative w-full border-b border-slate-700 transition-colors ${track.armed ? 'bg-red-900/10' : 'bg-slate-800/50'}`}
      style={{ height: TRACK_HEIGHT }}
      data-track-id={track.id}
      onClick={() => setContextMenu(null)}
    >
      {/* Track Background Grid (Tensor Field Look) */}
      <div 
        className="absolute inset-0 pointer-events-none opacity-20"
        style={{
             backgroundImage: `
                linear-gradient(90deg, #334155 1px, transparent 1px),
                linear-gradient(90deg, #1e293b 1px, transparent 1px)
             `,
             backgroundSize: `${majorGrid}px 100%, ${minorGrid}px 100%`
        }}
      ></div>

      {clips.map(clip => {
        const left = clip.startTime * zoom;
        const width = clip.duration * zoom;
        const isSelected = selectedClipId === clip.id;
        
        const fullBufferWidth = clip.buffer.duration * zoom;
        const offsetLeft = -(clip.offset * zoom);

        return (
          <div
            key={clip.id}
            className={`absolute top-2 bottom-2 rounded-md overflow-hidden touch-none transition-shadow
              ${isSelected ? 'ring-2 ring-cyan-400 z-10 shadow-[0_0_20px_rgba(34,211,238,0.3)]' : 'border border-white/10 shadow-sm'}
              ${editMode === EditMode.SPLIT ? 'cursor-crosshair' : 'cursor-move'}`}
            style={{ 
              left: `${left}px`, 
              width: `${width}px`,
              backgroundColor: isSelected ? '#1e293b' : (track.color + '20')
            }}
            onTouchStart={(e) => {
              e.stopPropagation();
              onClipInteract(clip.id, 'start', { 
                x: e.touches[0].clientX, 
                y: e.touches[0].clientY,
                originalStart: clip.startTime
              });
            }}
            onMouseDown={(e) => {
              e.stopPropagation();
              onClipInteract(clip.id, 'start', { 
                x: e.clientX, 
                y: e.clientY,
                originalStart: clip.startTime
              });
            }}
            onClick={(e) => {
               e.stopPropagation();
               const clientX = 'touches' in e ? (e as any).touches[0].clientX : (e as React.MouseEvent).clientX;
               onClipInteract(clip.id, 'tap', { x: clientX });
            }}
            onContextMenu={(e) => handleContextMenu(e, clip.id)}
          >
            {/* Waveform Container */}
            <div 
                className="absolute top-0 bottom-0 pointer-events-none opacity-90"
                style={{ 
                    left: `${offsetLeft}px`,
                    width: `${fullBufferWidth}px` 
                }}
            >
                <Waveform 
                  buffer={clip.buffer} 
                  color={isSelected ? '#22d3ee' : track.color} 
                  width={fullBufferWidth} 
                  height={TRACK_HEIGHT - 16} 
                  viewConfig={clip.viewConfig}
                />
            </div>
            
            {/* Scientific Header */}
            <div className="absolute top-0 left-0 right-0 h-4 bg-gradient-to-b from-black/80 to-transparent px-1 flex items-center border-b border-white/5 justify-between">
                <span className={`text-[8px] font-mono truncate tracking-tight ${isSelected ? 'text-cyan-200' : 'text-white/50'}`}>
                    {clip.name}
                </span>
                {isSelected && <span className="text-[7px] font-mono text-cyan-500">{clip.duration.toFixed(2)}s</span>}
            </div>
            
            {/* Selection Handle Indicators */}
            {isSelected && (
                <>
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-cyan-500/50"></div>
                    <div className="absolute right-0 top-0 bottom-0 w-1 bg-cyan-500/50"></div>
                </>
            )}
          </div>
        );
      })}

      {/* Context Menu Overlay */}
      {contextMenu && (
          <div 
            className="fixed z-50 bg-black/90 border border-cyan-500/50 rounded shadow-[0_0_30px_rgba(0,0,0,0.8)] backdrop-blur-md p-1 min-w-[120px] animate-in zoom-in-95 duration-100"
            style={{ left: contextMenu.x, top: contextMenu.y }}
            onClick={(e) => e.stopPropagation()}
          >
              <div className="px-2 py-1 border-b border-white/10 mb-1">
                  <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest">EDIT OPERATION</span>
              </div>
              <button onClick={() => handleAction('copy')} className="w-full text-left px-2 py-1.5 text-[10px] text-white hover:bg-cyan-900/50 hover:text-cyan-400 font-mono flex items-center gap-2">
                  <span>CPY</span> Copy to Buffer
              </button>
              <button onClick={() => handleAction('split')} className="w-full text-left px-2 py-1.5 text-[10px] text-white hover:bg-cyan-900/50 hover:text-cyan-400 font-mono flex items-center gap-2">
                  <span>SPL</span> Split at Playhead
              </button>
               <button onClick={() => handleAction('reverse')} className="w-full text-left px-2 py-1.5 text-[10px] text-white hover:bg-cyan-900/50 hover:text-cyan-400 font-mono flex items-center gap-2">
                  <span>REV</span> Reverse Tensor
              </button>
              <div className="h-px bg-white/10 my-1"></div>
              <button onClick={() => handleAction('delete')} className="w-full text-left px-2 py-1.5 text-[10px] text-red-400 hover:bg-red-900/20 font-mono flex items-center gap-2">
                  <span>DEL</span> Delete Entity
              </button>
          </div>
      )}
    </div>
  );
});
