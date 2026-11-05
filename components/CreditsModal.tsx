import React from 'react';

interface CreditsModalProps {
  onClose: () => void;
}

export const CreditsModal: React.FC<CreditsModalProps> = ({ onClose }) => {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="relative bg-black border-2 border-white/20 p-8 max-w-sm w-full shadow-[0_0_50px_rgba(255,255,255,0.1)] overflow-hidden">
        
        {/* Interference Overlay */}
        <div className="absolute inset-0 pointer-events-none opacity-10" 
             style={{ backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, #fff 3px)' }}></div>
        
        <div className="relative z-10 flex flex-col items-center text-center space-y-6">
            <h1 className="text-3xl font-black text-white tracking-tighter uppercase italic" style={{ textShadow: '0 0 10px #3b82f6' }}>
                PocketStudio
            </h1>
            
            <div className="space-y-2">
                <p className="text-sm font-bold text-blue-400 uppercase tracking-widest">Created By</p>
                <p className="text-lg text-white font-mono">ziggyware@gmail.com</p>
            </div>

            <div className="w-full h-px bg-gradient-to-r from-transparent via-white/50 to-transparent"></div>

            <div className="space-y-2">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Donations Accepted At</p>
                <div className="bg-white text-black font-black text-xl px-4 py-2 transform -skew-x-12 shadow-[4px_4px_0_#3b82f6]">
                    $ziggyware
                </div>
            </div>

            <button 
                onClick={onClose}
                className="mt-4 text-xs font-bold text-slate-500 hover:text-white uppercase tracking-widest border-b border-transparent hover:border-white transition-all"
            >
                Close
            </button>
        </div>
      </div>
    </div>
  );
};