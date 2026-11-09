import React from 'react';
import { ProjectMetadata } from '../types';

interface ProjectInfoPanelProps {
  metadata: ProjectMetadata;
  onChange: (meta: ProjectMetadata) => void;
  onExport: (format: 'mp4') => void;
  onClose: () => void;
  isExporting: boolean;
}

export const ProjectInfoPanel: React.FC<ProjectInfoPanelProps> = ({ metadata, onChange, onExport, onClose, isExporting }) => {
  
  const handleChange = (field: keyof ProjectMetadata, value: string) => {
    onChange({ ...metadata, [field]: value });
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-[90%] max-w-md bg-[#0f172a] border border-cyan-900 rounded-lg shadow-[0_0_50px_rgba(6,182,212,0.2)] overflow-hidden flex flex-col relative">
        
        {/* Decorative Light Leak */}
        <div className="absolute -top-20 -left-20 w-40 h-40 bg-cyan-500 blur-[80px] opacity-20 pointer-events-none"></div>

        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-900/50">
           <h2 className="text-sm font-bold text-cyan-400 tracking-widest uppercase">Project Config</h2>
           <button onClick={onClose} className="text-slate-400 hover:text-white">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
           </button>
        </div>

        {/* Form */}
        <div className="p-6 space-y-4">
            
            <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-slate-500">Track Title</label>
                <input 
                    type="text" 
                    value={metadata.title}
                    onChange={(e) => handleChange('title', e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-sm text-white focus:border-cyan-500 outline-none transition-colors"
                />
            </div>

            <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-slate-500">Artist</label>
                <input 
                    type="text" 
                    value={metadata.artist}
                    onChange={(e) => handleChange('artist', e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-sm text-white focus:border-cyan-500 outline-none transition-colors"
                />
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-slate-500">Album</label>
                    <input 
                        type="text" 
                        value={metadata.album}
                        onChange={(e) => handleChange('album', e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-sm text-white focus:border-cyan-500 outline-none transition-colors"
                    />
                </div>
                <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-slate-500">Year</label>
                    <input 
                        type="text" 
                        value={metadata.year}
                        onChange={(e) => handleChange('year', e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-sm text-white focus:border-cyan-500 outline-none transition-colors"
                    />
                </div>
            </div>

            {/* Export Section */}
            <div className="mt-8 pt-6 border-t border-slate-800">
                <div className="flex justify-between items-center mb-4">
                    <span className="text-xs font-bold text-slate-300">BOUNCE MIX</span>
                    <div className="text-[10px] text-slate-500">Format: MP4 (AAC)</div>
                </div>

                <button 
                    onClick={() => onExport('mp4')}
                    disabled={isExporting}
                    className={`w-full py-3 rounded font-bold text-xs tracking-widest uppercase transition-all flex items-center justify-center space-x-2 mb-4
                        ${isExporting 
                            ? 'bg-slate-800 text-slate-500 cursor-wait' 
                            : 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-[0_0_20px_rgba(8,145,178,0.4)] hover:shadow-[0_0_30px_rgba(8,145,178,0.6)]'}`}
                >
                    {isExporting ? (
                        <>
                            <div className="w-3 h-3 border-2 border-slate-500 border-t-transparent rounded-full animate-spin"></div>
                            <span>Rendering...</span>
                        </>
                    ) : (
                        <>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                            <span>Export Audio File</span>
                        </>
                    )}
                </button>

                <div className="flex justify-between items-center mb-4 mt-6">
                    <span className="text-xs font-bold text-slate-300">SOURCE CODE</span>
                </div>

                <a 
                    href="/source-export.txt" 
                    download="pocketstudio-source.txt"
                    className="w-full py-3 rounded font-bold text-xs tracking-widest uppercase transition-all flex items-center justify-center space-x-2 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-600 hover:border-slate-400"
                >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                    <span>Download Source Code</span>
                </a>

                <p className="text-[9px] text-slate-600 mt-3 text-center">
                    Uses real-time rendering. Playback will start automatically.
                </p>
            </div>
        </div>
      </div>
    </div>
  );
};