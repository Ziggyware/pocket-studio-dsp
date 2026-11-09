import React, { useEffect, useRef } from 'react';
import { ClipViewConfig } from '../types';
import { cubicHermite, computeHaarEnergy, computeAnalyticMagnitude } from '../utils/dsp';

interface WaveformProps {
  buffer: AudioBuffer;
  color: string;
  width: number;
  height: number;
  viewConfig: ClipViewConfig;
}

export const Waveform: React.FC<WaveformProps> = ({ buffer, color, width, height, viewConfig }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    // Safety Constraint
    const safeWidth = Math.max(1, Math.min(32000, Math.floor(width)));
    const safeHeight = Math.max(1, Math.floor(height));

    canvas.width = safeWidth;
    canvas.height = safeHeight;
    ctx.clearRect(0, 0, safeWidth, safeHeight);
    
    // Parse Color
    const hexToRgb = (hex: string) => {
        const bigint = parseInt(hex.replace('#', ''), 16);
        return { r: (bigint >> 16) & 255, g: (bigint >> 8) & 255, b: bigint & 255 };
    };
    const rgb = hexToRgb(color);
    const mid = safeHeight / 2;
    const scale = viewConfig?.scale || 1;
    const data = buffer.getChannelData(0);
    const mode = viewConfig.mode || 'PCM';

    // -------------------------------------------------------------------------
    // MODE: CANDLESTICK (Wavelet Analysis)
    // -------------------------------------------------------------------------
    if (mode === 'CANDLESTICK') {
        const candleWidth = Math.max(4, 8 * scale); // Width of each candle
        const gap = 1;
        const totalCandles = Math.ceil(safeWidth / (candleWidth + gap));
        const samplesPerCandle = Math.floor(data.length / totalCandles);

        // Gradient for Bullish (High Freq/Transient)
        const bullGrad = ctx.createLinearGradient(0, safeHeight, 0, 0);
        bullGrad.addColorStop(0, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.2)`);
        bullGrad.addColorStop(1, `rgba(50, 255, 200, 0.9)`); // Cyan/Teal pop

        // Gradient for Bearish (Low Freq/Sustain)
        const bearGrad = ctx.createLinearGradient(0, safeHeight, 0, 0);
        bearGrad.addColorStop(0, `rgba(255, 50, 100, 0.9)`); // Pink/Red pop
        bearGrad.addColorStop(1, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.2)`);

        for (let i = 0; i < totalCandles; i++) {
            const startIdx = i * samplesPerCandle;
            const endIdx = Math.min(data.length, startIdx + samplesPerCandle);
            if (startIdx >= data.length) break;

            // Extract Chunk
            const chunk = data.slice(startIdx, endIdx);
            
            // 1. RAW RANGE (Wicks) -> High/Low
            let min = 1.0; let max = -1.0;
            for (let j = 0; j < chunk.length; j++) {
                if (chunk[j] < min) min = chunk[j];
                if (chunk[j] > max) max = chunk[j];
            }
            // Enhance visual range for quiet signals
            const wickTop = mid - (max * (safeHeight/2) * scale);
            const wickBottom = mid - (min * (safeHeight/2) * scale);
            
            // 2. WAVELET ANALYSIS (Body) -> Open/Close approximation
            // Use Haar Wavelet Energy to determine the "Body" of the sound vs the transient peaks
            const { lowEnergy, highEnergy } = computeHaarEnergy(chunk);
            
            // Complex Analysis approximation (Analytic Magnitude)
            const analyticMag = computeAnalyticMagnitude(chunk);

            // Determine "Sentiment" (Color)
            // High Freq Dominance -> Bullish (Green/Cyan) -> Transients
            // Low Freq Dominance -> Bearish (Red/Pink) -> Bass/Sustain
            const spectralBalance = highEnergy / (lowEnergy + 0.001);
            const isBullish = spectralBalance > 0.5; // Arbitrary threshold for transient-heavy

            // Body Size is based on the Analytic Magnitude (Average Energy) vs Low Energy
            // This separates the "dense" part of the sound from the "peak" part.
            const bodyHalfHeight = (lowEnergy * (safeHeight/2) * scale);
            const bodyTop = mid - bodyHalfHeight;
            const bodyBottom = mid + bodyHalfHeight;

            const x = i * (candleWidth + gap);

            // Draw Wick (Range)
            ctx.beginPath();
            ctx.moveTo(x + candleWidth/2, wickTop);
            ctx.lineTo(x + candleWidth/2, wickBottom);
            ctx.strokeStyle = `rgba(${rgb.r},${rgb.g},${rgb.b}, 0.5)`;
            ctx.lineWidth = 1;
            ctx.stroke();

            // Draw Body (Energy)
            ctx.fillStyle = isBullish ? bullGrad : bearGrad;
            
            // Neon Glow effect for body
            ctx.shadowBlur = isBullish ? 10 : 5;
            ctx.shadowColor = isBullish ? '#0ff' : '#f0f';
            
            const bodyH = Math.max(2, bodyBottom - bodyTop);
            ctx.fillRect(x, bodyTop, candleWidth, bodyH);
            
            ctx.shadowBlur = 0;

            // Overlay: Complex Magnitude Marker (The "Price")
            // A horizontal line indicating the instantaneous analytic magnitude
            const priceY = mid - (analyticMag * (safeHeight/2) * scale * (data[startIdx] > 0 ? 1 : -1));
            ctx.fillStyle = '#fff';
            ctx.fillRect(x, priceY, candleWidth, 1);
        }
        return;
    }

    // -------------------------------------------------------------------------
    // MODE: PCM (Tensor Field Visualization)
    // -------------------------------------------------------------------------

    // 1. Field Background (Energy Density)
    const grad = ctx.createLinearGradient(0, 0, 0, safeHeight);
    grad.addColorStop(0, `rgba(${rgb.r},${rgb.g},${rgb.b},0)`);
    grad.addColorStop(0.5, `rgba(${rgb.r},${rgb.g},${rgb.b},0.15)`); // Subtle core glow
    grad.addColorStop(1, `rgba(${rgb.r},${rgb.g},${rgb.b},0)`);
    ctx.fillStyle = grad;
    ctx.fillRect(0,0,safeWidth, safeHeight);

    ctx.lineWidth = 1;
    const step = data.length / safeWidth;

    // 2. Vector Flux Lines (Discrete sampling of amplitude)
    ctx.beginPath();
    const vectorSpacing = Math.max(3, 6 / scale); 
    
    for (let x = 0; x < safeWidth; x += vectorSpacing) {
         const idx = Math.floor(x * step);
         if (idx >= data.length) break;
         
         // Peak detect in this slice
         let maxAbs = 0;
         const sliceWidth = Math.max(1, Math.floor(step));
         for (let j = 0; j < sliceWidth; j++) {
             if (idx + j >= data.length) break;
             const abs = Math.abs(data[idx + j]);
             if (abs > maxAbs) maxAbs = abs;
         }
         
         const h = maxAbs * (safeHeight / 2) * scale;
         if (h > 1) {
            ctx.moveTo(x, mid - h);
            ctx.lineTo(x, mid + h);
         }
    }
    ctx.strokeStyle = `rgba(${rgb.r},${rgb.g},${rgb.b},0.3)`;
    ctx.stroke();

    // 3. Main Envelope (The Tensor Boundary)
    ctx.beginPath();
    ctx.moveTo(0, mid);

    if (step >= 1) {
        // --- ZOOMED OUT: MIN/MAX DECIMATION ---
        const intStep = Math.ceil(step);
        for (let i = 0; i < safeWidth; i+=2) {
            let min = 1.0; let max = -1.0;
            const idx = Math.floor(i * step);
            for (let j = 0; j < intStep; j++) {
                if (idx + j >= data.length) break;
                const datum = data[idx + j];
                if (datum < min) min = datum;
                if (datum > max) max = datum;
            }
            const val = Math.abs(max) > Math.abs(min) ? max : min;
            const y = mid - (val * (safeHeight/2) * scale);
            ctx.lineTo(i, y);
        }
        for (let i = safeWidth; i >= 0; i-=2) {
            const idx = Math.floor(i * step);
            const y = mid + (data[Math.min(data.length-1, idx)] * (safeHeight/2) * scale * 0.1); 
            ctx.lineTo(i, y);
        }

    } else {
        // --- ZOOMED IN: CUBIC HERMITE INTERPOLATION ---
        for (let x = 0; x < safeWidth; x++) {
            const indexExact = x * step;
            const indexInt = Math.floor(indexExact);
            const t = indexExact - indexInt;

            const y0 = data[Math.max(0, indexInt - 1)];
            const y1 = data[indexInt];
            const y2 = data[Math.min(data.length - 1, indexInt + 1)];
            const y3 = data[Math.min(data.length - 1, indexInt + 2)];

            const val = cubicHermite(y0, y1, y2, y3, t);
            const y = mid - (val * (safeHeight/2) * scale);
            ctx.lineTo(x, y);
        }
    }
    
    // Stroke Styling
    ctx.globalCompositeOperation = 'source-over';
    ctx.shadowBlur = 8;
    ctx.shadowColor = color;
    ctx.strokeStyle = `rgba(${rgb.r},${rgb.g},${rgb.b},0.9)`;
    ctx.stroke();
    
    // 4. Highlight Overlay (White Hot Core)
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 0.5;
    ctx.shadowBlur = 0;
    ctx.stroke();

    // 5. Critical Points (Nodes)
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    const nodeSpacing = Math.max(10, 50 / scale);
    for (let x = 0; x < safeWidth; x += nodeSpacing) {
        const idx = Math.floor(x * step);
        if (idx < data.length) {
            const val = data[idx];
            if (Math.abs(val) > 0.4) {
                 const y = mid - (val * (safeHeight/2) * scale);
                 ctx.moveTo(x + 1.5, y);
                 ctx.arc(x, y, 1.5, 0, Math.PI * 2);
            }
        }
    }
    ctx.fill();

  }, [buffer, color, width, height, viewConfig]);

  return <canvas ref={canvasRef} style={{ width: '100%', height: '100%' }} className="w-full h-full opacity-100 mix-blend-screen" />;
};