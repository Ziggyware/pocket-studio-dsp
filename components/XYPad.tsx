
import React, { useRef, useState, useEffect } from 'react';

interface XYPadProps {
    x: number; // 0 to 1
    y: number; // 0 to 1
    onChange: (x: number, y: number) => void;
    labelX: string;
    labelY: string;
    color?: string;
}

// SDF Primitives
const sdCircle = (px: number, py: number, cx: number, cy: number, r: number) => {
    const dx = px - cx;
    const dy = py - cy;
    return Math.sqrt(dx*dx + dy*dy) - r;
};

export const XYPad: React.FC<XYPadProps> = ({ x, y, onChange, labelX, labelY, color = 'cyan' }) => {
    const padRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDragging, setIsDragging] = useState(false);

    const colorMap: Record<string, string> = {
        cyan: '#00f0ff', blue: '#2f80ed', purple: '#b721ff', green: '#0aff60', 
        yellow: '#ffcc00', orange: '#ff6600', red: '#ff003c', pink: '#ff00d4'
    };
    const cHex = colorMap[color] || colorMap['cyan'];
    const hexToRgb = (hex: string) => {
        const bigint = parseInt(hex.replace('#', ''), 16);
        return { r: (bigint >> 16) & 255, g: (bigint >> 8) & 255, b: bigint & 255 };
    };
    const cRgb = hexToRgb(cHex);

    const updateFromPointer = (clientX: number, clientY: number) => {
        if (!padRef.current) return;
        const rect = padRef.current.getBoundingClientRect();
        let newX = (clientX - rect.left) / rect.width;
        let newY = 1 - ((clientY - rect.top) / rect.height);
        newX = Math.max(0, Math.min(1, newX));
        newY = Math.max(0, Math.min(1, newY));
        onChange(newX, newY);
    };

    useEffect(() => {
        if (isDragging) {
            const move = (e: MouseEvent) => { e.preventDefault(); updateFromPointer(e.clientX, e.clientY); };
            const up = () => setIsDragging(false);
            window.addEventListener('mousemove', move);
            window.addEventListener('mouseup', up);
            return () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
        }
    }, [isDragging]);

    // --- SDF Field Animation ---
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let frameId: number;
        let time = 0;

        const draw = () => {
            time += 0.02;
            const w = canvas.width = canvas.parentElement?.clientWidth || 200;
            const h = canvas.height = canvas.parentElement?.clientHeight || 200;

            ctx.clearRect(0, 0, w, h);
            
            // Map 0-1 coords to canvas
            const cx = x * w;
            const cy = (1 - y) * h;

            // Grid Resolution
            const res = 10;
            const cols = Math.ceil(w / res);
            const rows = Math.ceil(h / res);

            // SDF Rendering Loop
            for (let i = 0; i <= cols; i++) {
                for (let j = 0; j <= rows; j++) {
                    const px = i * res;
                    const py = j * res;

                    // Signed Distance to Puck
                    const dist = sdCircle(px, py, cx, cy, 0);
                    
                    // Add some noise field variation
                    const noise = Math.sin(px * 0.05 + time) * Math.cos(py * 0.05 + time) * 20;
                    
                    // Field intensity based on distance (Metaball-ish)
                    const field = Math.max(0, 150 - (dist + noise));
                    const normalizedField = Math.min(1, field / 100);

                    if (normalizedField > 0.1) {
                        // Vector Flow Direction
                        const angle = Math.atan2(cy - py, cx - px);
                        
                        // Draw Field Vector
                        const len = normalizedField * res * 1.5;
                        const ex = px + Math.cos(angle) * len;
                        const ey = py + Math.sin(angle) * len;

                        ctx.beginPath();
                        ctx.moveTo(px, py);
                        ctx.lineTo(ex, ey);
                        ctx.strokeStyle = `rgba(${cRgb.r},${cRgb.g},${cRgb.b},${normalizedField * 0.4})`;
                        ctx.lineWidth = 1;
                        ctx.stroke();
                        
                        // Draw Node if intense
                        if (normalizedField > 0.6) {
                            ctx.fillStyle = `rgba(${cRgb.r},${cRgb.g},${cRgb.b},${normalizedField})`;
                            ctx.fillRect(ex - 1, ey - 1, 2, 2);
                        }
                    }
                }
            }

            // Glow from center
            const gradient = ctx.createRadialGradient(cx, cy, 10, cx, cy, 100);
            gradient.addColorStop(0, `rgba(${cRgb.r},${cRgb.g},${cRgb.b},0.3)`);
            gradient.addColorStop(1, `rgba(${cRgb.r},${cRgb.g},${cRgb.b},0)`);
            ctx.fillStyle = gradient;
            ctx.fillRect(0,0,w,h);

            frameId = requestAnimationFrame(draw);
        };

        draw();
        return () => cancelAnimationFrame(frameId);
    }, [x, y, cRgb]);

    return (
        <div className="flex flex-col items-center w-full h-full p-2">
            <div 
                ref={padRef}
                className="w-full h-full border border-white/10 bg-black/60 rounded relative cursor-crosshair touch-none overflow-hidden group shadow-[inset_0_0_20px_rgba(0,0,0,1)]"
                onMouseDown={(e) => { setIsDragging(true); updateFromPointer(e.clientX, e.clientY); }}
                onTouchStart={(e) => { setIsDragging(true); updateFromPointer(e.touches[0].clientX, e.touches[0].clientY); }}
                onTouchMove={(e) => { if(isDragging) { e.preventDefault(); updateFromPointer(e.touches[0].clientX, e.touches[0].clientY); }}}
                onTouchEnd={() => setIsDragging(false)}
            >
                <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />
                
                {/* Physical Puck */}
                <div 
                    className="absolute w-4 h-4 rounded-full border-2 border-white bg-black transform -translate-x-1/2 -translate-y-1/2 z-10 transition-transform duration-75"
                    style={{ 
                        left: `${x * 100}%`, 
                        bottom: `${y * 100}%`, 
                        borderColor: cHex,
                        boxShadow: `0 0 15px ${cHex}, inset 0 0 5px ${cHex}`
                    }}
                >
                    <div className="absolute inset-0 bg-white opacity-20 rounded-full animate-pulse"></div>
                </div>
                
                {/* Axis Labels */}
                <div className="absolute bottom-1 right-2 text-[7px] font-black text-slate-600 uppercase tracking-widest pointer-events-none" style={{ textShadow: `0 0 5px ${cHex}40` }}>{labelX} →</div>
                <div className="absolute top-1 left-2 text-[7px] font-black text-slate-600 uppercase tracking-widest pointer-events-none" style={{ textShadow: `0 0 5px ${cHex}40` }}>↑ {labelY}</div>
            </div>
        </div>
    );
};
