
import React from 'react';
import { EditMode, ViewSettings } from '../types';

interface ControlsProps {
  isPlaying: boolean;
  isRecording: boolean;
  isLooping: boolean;
  loopRange: { start: number; end: number } | null;
  onPlayPause: () => void;
  onRecord: () => void;
  onStop: () => void;
  onBounce: () => void;
  onDelete: () => void;
  onSplit: () => void;
  onCopy: () => void;
  onPaste: () => void;
  onToggleLoop: () => void;
  onSetLoopIn: () => void;
  onSetLoopOut: () => void;
  onOpenInfo: () => void;
  onShowCredits: () => void;
  onToggleLogs: () => void; // New Prop
  onImportAudio?: (file: File) => void;
  editMode: EditMode;
  setEditMode: (mode: EditMode) => void;
  monitor: boolean;
  setMonitor: (val: boolean) => void;
  zoom: number;
  setZoom: (val: number) => void;
  hasSelection: boolean;
  hasClipboard: boolean;
  viewSettings: ViewSettings;
  setViewSettings: (val: ViewSettings) => void;
}

export const Controls: React.FC<ControlsProps> = React.memo(({
  isPlaying, isRecording, isLooping, loopRange,
  onPlayPause, onRecord, onStop, onBounce, onDelete, onSplit, onCopy, onPaste,
  onToggleLoop, onSetLoopIn, onSetLoopOut, onOpenInfo, onShowCredits, onToggleLogs, onImportAudio,
  editMode, setEditMode, monitor, setMonitor, zoom, setZoom, hasSelection, hasClipboard,
  viewSettings, setViewSettings
}) => {
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const toggleView = (key: keyof ViewSettings) => {
      setViewSettings({ ...viewSettings, [key]: !viewSettings[key] });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onImportAudio) {
      onImportAudio(file);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="fixed top-0 left-0 right-0 h-[60px] bg-black/80 backdrop-blur-md border-b border-white/10 flex items-center justify-between px-2 md:px-4 z-50 shadow-2xl overflow-x-auto overflow-y-hidden scrollbar-hide">
      
      {/* Group 1: Transport */}
      <div className="flex items-center space-x-2 mr-4 flex-shrink-0">
        <div className="flex items-center space-x-1 bg-slate-900/50 p-1 rounded-full border border-slate-800">
            <button
            className={`w-9 h-9 rounded-full flex items-center justify-center transition-all shadow-inner ${isRecording ? 'bg-red-600 animate-pulse shadow-red-500/50' : 'bg-slate-800 hover:bg-slate-700'}`}
            onClick={onRecord}
            title="Record"
            >
            <div className={`w-2.5 h-2.5 rounded-full ${isRecording ? 'bg-white' : 'bg-red-500'}`}></div>
            </button>
            <button
            className="w-9 h-9 rounded-full bg-slate-200 hover:bg-white flex items-center justify-center active:scale-95 transition-transform shadow-lg shadow-white/10"
            onClick={onPlayPause}
            title="Play/Pause"
            >
            {isPlaying ? (
                <div className="w-2.5 h-2.5 flex space-x-0.5 justify-center">
                <div className="w-1 h-full bg-slate-900 rounded-[1px]"></div>
                <div className="w-1 h-full bg-slate-900 rounded-[1px]"></div>
                </div>
            ) : (
                <div className="w-0 h-0 border-t-[5px] border-t-transparent border-l-[8px] border-l-slate-900 border-b-[5px] border-b-transparent ml-0.5"></div>
            )}
            </button>
            <button
            className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-[8px] font-bold text-slate-400 hover:text-white active:scale-95 transition-transform border border-slate-700"
            onClick={onStop}
            title="Stop / Return Zero"
            >
            <div className="w-2.5 h-2.5 bg-slate-400 rounded-[1px]"></div>
            </button>
        </div>
      </div>

      {/* Group 2: VIEW MATRIX (New) */}
      <div className="flex items-center space-x-1 mr-4 border-l border-white/10 pl-4 flex-shrink-0">
         <div className="flex flex-col space-y-0.5">
             <span className="text-[7px] font-bold text-slate-600 tracking-widest uppercase mb-0.5">View Matrix</span>
             <div className="flex space-x-1">
                 <button 
                    onClick={() => toggleView('isCollapsed')}
                    className={`h-5 px-1.5 rounded border text-[8px] font-bold transition-all ${!viewSettings.isCollapsed ? 'bg-cyan-900/40 border-cyan-700 text-cyan-400' : 'bg-transparent border-slate-700 text-slate-600'}`}
                 >MAIN</button>
                 <button 
                    onClick={() => toggleView('showTransport')}
                    className={`h-5 px-1.5 rounded border text-[8px] font-bold transition-all ${viewSettings.showTransport ? 'bg-cyan-900/40 border-cyan-700 text-cyan-400' : 'bg-transparent border-slate-700 text-slate-600'}`}
                 >TRNS</button>
                 <button 
                    onClick={() => toggleView('showMix')}
                    className={`h-5 px-1.5 rounded border text-[8px] font-bold transition-all ${viewSettings.showMix ? 'bg-cyan-900/40 border-cyan-700 text-cyan-400' : 'bg-transparent border-slate-700 text-slate-600'}`}
                 >MIX</button>
             </div>
         </div>
      </div>

      {/* Group 3: Edit Tools */}
      <div className="flex items-center space-x-2 flex-shrink-0">
         <div className="flex bg-black/50 rounded-lg p-0.5 border border-white/10">
             <button 
               className={`w-16 py-1.5 rounded-md text-[9px] font-bold transition-all flex items-center justify-center space-x-1 ${editMode === EditMode.MOVE ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}
               onClick={() => setEditMode(EditMode.MOVE)}
             >
               <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 9l-3 3 3 3M9 5l3-3 3 3M19 9l3 3-3 3M9 19l3 3 3 3M2 12h20M12 2v20"/></svg>
               <span>MOVE</span>
             </button>
             <button 
               className={`w-16 py-1.5 rounded-md text-[9px] font-bold transition-all flex items-center justify-center space-x-1 ${editMode === EditMode.SPLIT ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}
               onClick={() => setEditMode(EditMode.SPLIT)}
             >
               <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="16"></line><line x1="8" y1="12" x2="16" y2="12"></line></svg>
               <span>TAP</span>
             </button>
         </div>

         <div className="flex flex-col space-y-1">
             <div className="flex space-x-1">
                 <button 
                    disabled={!hasSelection}
                    onClick={onCopy}
                    className={`h-6 px-2 flex items-center justify-center rounded border transition-all text-[8px] font-bold ${hasSelection ? 'bg-slate-800 text-white border-slate-600 hover:bg-slate-700' : 'bg-transparent text-slate-700 border-transparent cursor-not-allowed'}`}
                    title="Copy Clip"
                 >COPY</button>
                 <button 
                    disabled={!hasClipboard}
                    onClick={onPaste}
                    className={`h-6 px-2 flex items-center justify-center rounded border transition-all text-[8px] font-bold ${hasClipboard ? 'bg-slate-800 text-white border-slate-600 hover:bg-slate-700' : 'bg-transparent text-slate-700 border-transparent cursor-not-allowed'}`}
                    title="Paste Clip"
                 >PASTE</button>
             </div>
             <button 
                disabled={!hasSelection}
                onClick={onSplit}
                className={`h-6 px-2 flex items-center justify-center rounded border transition-all text-[8px] font-bold
                    ${hasSelection 
                        ? 'border-slate-600 bg-slate-800 text-white hover:bg-slate-700 shadow-sm' 
                        : 'border-transparent text-slate-700 cursor-not-allowed'}`}
                title="Split at Playhead"
             >
                 SPLIT
             </button>
         </div>
         
         <button 
            disabled={!hasSelection}
            onClick={onDelete}
            className={`w-8 h-12 flex items-center justify-center rounded border transition-all ml-1
                ${hasSelection 
                    ? 'border-red-900 bg-red-900/20 text-red-500 hover:bg-red-900 hover:text-white cursor-pointer' 
                    : 'border-transparent text-slate-800 cursor-not-allowed'}`}
            title="Delete Selected"
         >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
         </button>
      </div>

      {/* Group 4: Config & Utils */}
      <div className="flex items-center space-x-2 flex-shrink-0 ml-auto pl-4 border-l border-white/10">
        
        <button
            onClick={onShowCredits}
            className="text-[10px] font-bold text-slate-500 hover:text-white uppercase tracking-widest mr-1"
        >
            Credits
        </button>

        {/* AUDIO IMPORT */}
        <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            accept="audio/*,.wav,.mp3,.ogg,.m4a,.flac,.aac,.weba" 
            className="hidden" 
        />
        <button
            onClick={() => fileInputRef.current?.click()}
            className="h-8 px-2 rounded border border-slate-700 bg-black/40 text-[9px] font-bold text-slate-400 hover:text-cyan-400 hover:border-cyan-700 uppercase tracking-widest transition-colors flex items-center gap-1"
            title="Import audio file"
        >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            <span>IMPORT</span>
        </button>

        {/* LOGS TOGGLE */}
        <button
            onClick={onToggleLogs}
            className="h-8 px-2 rounded border border-slate-700 bg-black/40 text-[9px] font-bold text-slate-400 hover:text-cyan-400 hover:border-cyan-700 uppercase tracking-widest transition-colors flex items-center gap-1"
        >
            <span className="w-1.5 h-1.5 rounded-full bg-slate-600"></span>
            LOGS
        </button>

        <button
            onClick={onOpenInfo}
            className="w-8 h-8 rounded-full bg-black border border-blue-900/50 text-blue-500 hover:text-white hover:bg-blue-900 flex items-center justify-center transition-colors"
            title="Project Info & Export"
        >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
        </button>

        <div className="flex flex-col items-center group">
            <div className="flex -space-x-px">
                <button 
                    className="h-6 px-1.5 bg-black border border-slate-700 rounded-l text-[10px] text-slate-400 hover:bg-slate-800 font-mono"
                    onClick={() => setZoom(Math.max(10, zoom * 0.8))}
                >-</button>
                <button 
                    className="h-6 px-1.5 bg-black border border-slate-700 rounded-r text-[10px] text-slate-400 hover:bg-slate-800 font-mono"
                    onClick={() => setZoom(Math.min(500, zoom * 1.25))}
                >+</button>
            </div>
        </div>

        <button
          className={`w-8 h-6 rounded border text-[9px] font-bold tracking-wider transition-colors flex items-center justify-center ${monitor ? 'bg-green-500/20 border-green-500 text-green-400' : 'bg-black border-slate-700 text-slate-500 hover:text-slate-300'}`}
          onClick={() => setMonitor(!monitor)}
          title="Input Monitor"
        >
          MON
        </button>
      </div>
    </div>
  );
});
