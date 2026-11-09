import React, { useEffect, useRef } from 'react';

export const BackgroundInterference: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    let w = 0, h = 0;
    let time = 0;
    const gridSize = 40;
    
    const resize = () => {
      w = canvas.width = window.innerWidth;
      h = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', resize);
    resize();

    const draw = () => {
      time += 0.005;
      
      // Clear with Void
      ctx.fillStyle = '#030305';
      ctx.fillRect(0, 0, w, h);

      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 1;
      
      const cols = Math.ceil(w / gridSize);
      const rows = Math.ceil(h / gridSize);

      for (let x = 0; x < cols; x++) {
          for (let y = 0; y < rows; y++) {
              // Noise-based angle
              const angle = (Math.cos(x * 0.1 + time) + Math.sin(y * 0.1 + time)) * Math.PI;
              const length = (Math.cos(x * 0.2 - time) + 1) * 10;
              
              const px = x * gridSize;
              const py = y * gridSize;

              // Draw Grid Point
              ctx.fillStyle = `rgba(56, 189, 248, ${Math.min(0.2, length/30)})`;
              ctx.fillRect(px - 1, py - 1, 2, 2);

              // Draw Vector Line (Tensor)
              ctx.beginPath();
              ctx.moveTo(px, py);
              ctx.lineTo(px + Math.cos(angle) * length, py + Math.sin(angle) * length);
              ctx.strokeStyle = `rgba(34, 211, 238, ${Math.min(0.1, length/40)})`;
              ctx.stroke();
          }
      }

      // Add Vignette
      const gradient = ctx.createRadialGradient(w/2, h/2, w/4, w/2, h/2, w);
      gradient.addColorStop(0, 'transparent');
      gradient.addColorStop(1, 'rgba(0,0,0,0.6)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, w, h);

      requestAnimationFrame(draw);
    };

    const animId = requestAnimationFrame(draw);
    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animId);
    };
  }, []);

  return (
    <canvas 
      ref={canvasRef} 
      className="fixed inset-0 pointer-events-none z-0"
    />
  );
};