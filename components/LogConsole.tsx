
import React, { useEffect, useRef } from 'react';
import { Notification } from '../types';

interface LogConsoleProps {
    logs: Notification[];
    onClose: () => void;
}

export const LogConsole: React.FC<LogConsoleProps> = ({ logs, onClose }) => {
    const scrollRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to bottom
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [logs]);

    const handleCopy = () => {
        const text = logs.map(l => `[${new Date(l.timestamp).toISOString()}] [${l.type.toUpperCase()}] ${l.message}`).join('\n');
        navigator.clipboard.writeText(text);
    };

    const getMemoryUsage = () => {
        if (typeof performance !== 'undefined' && (performance as any).memory && (performance as any).memory.usedJSHeapSize) {
            return Math.round((performance as any).memory.usedJSHeapSize / 1024 / 1024) + ' MB';
        }
        return 'N/A';
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-[800px] h-[500px] bg-[#0c0c0e] border border-slate-700 rounded-lg shadow-2xl flex flex-col font-mono overflow-hidden relative">
                
                {/* Header */}
                <div className="bg-[#1a1a1c] px-4 py-2 border-b border-slate-700 flex justify-between items-center select-none">
                    <div className="flex items-center space-x-2">
                        <div className="w-3 h-3 rounded-full bg-red-500/20 border border-red-500"></div>
                        <div className="w-3 h-3 rounded-full bg-yellow-500/20 border border-yellow-500"></div>
                        <div className="w-3 h-3 rounded-full bg-green-500/20 border border-green-500"></div>
                        <span className="text-xs text-slate-400 font-bold ml-2">SYSTEM.LOG // KERNEL_DUMP</span>
                    </div>
                    <div className="flex space-x-4">
                        <button onClick={handleCopy} className="text-[10px] text-cyan-500 hover:text-cyan-300 uppercase font-bold tracking-wider">
                            Copy All
                        </button>
                        <button onClick={onClose} className="text-[10px] text-slate-500 hover:text-white uppercase font-bold tracking-wider">
                            Close
                        </button>
                    </div>
                </div>

                {/* Log Output */}
                <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-1 bg-black/50">
                    <div className="text-[10px] text-slate-600 mb-4 select-none">
                        &gt; INITIALIZING SYSTEM... OK<br/>
                        &gt; CONNECTING TO AUDIO CONTEXT... OK<br/>
                        &gt; LOADING DSP MODULES... OK<br/>
                        &gt; AWAITING INPUT...
                    </div>
                    
                    {logs.map((log) => (
                        <div key={log.id} className="flex space-x-3 text-[11px] border-b border-white/5 pb-0.5 mb-0.5 hover:bg-white/5">
                            <span className="text-slate-600 select-none">
                                {new Date(log.timestamp).toLocaleTimeString([], {hour12: false, hour:'2-digit', minute:'2-digit', second:'2-digit'})}.{new Date(log.timestamp).getMilliseconds()}
                            </span>
                            <span className={`font-bold w-16 select-none ${
                                log.type === 'error' ? 'text-red-500' : 
                                log.type === 'warning' ? 'text-yellow-500' : 
                                log.type === 'success' ? 'text-green-500' : 'text-blue-400'
                            }`}>
                                {log.type.toUpperCase()}
                            </span>
                            <span className="text-slate-300 flex-1 break-all">
                                {log.message}
                            </span>
                        </div>
                    ))}
                    {logs.length === 0 && (
                        <div className="text-slate-700 italic text-xs p-4 text-center">No active logs recorded in this session.</div>
                    )}
                </div>

                {/* Footer Status */}
                <div className="bg-[#1a1a1c] px-2 py-1 border-t border-slate-700 flex justify-between">
                    <span className="text-[9px] text-slate-500">MEM_USAGE: {getMemoryUsage()}</span>
                    <span className="text-[9px] text-slate-500">Active Threads: 1 (Main) + AudioWorklet</span>
                </div>
            </div>
        </div>
    );
};
