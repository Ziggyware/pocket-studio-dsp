
import React, { useEffect, useRef } from 'react';

// --- MATH & PHYSICS KERNEL ---

const PI = Math.PI;
const TWO_PI = Math.PI * 2;

// Complex Number Structure
interface Complex { re: number; im: number; }

// Z-Transform Evaluation on Unit Circle: H(z) = (b0 + b1*z^-1 + b2*z^-2) / (1 + a1*z^-1 + a2*z^-2)
// Where z = e^(j*omega)
const evaluateBiquad = (f: number, fs: number, b: number[], a: number[]): { mag: number, phase: number } => {
    const omega = (TWO_PI * f) / fs;
    const cos1 = Math.cos(omega);
    const sin1 = Math.sin(omega);
    const cos2 = Math.cos(2 * omega);
    const sin2 = Math.sin(2 * omega);

    // Numerator
    const numRe = b[0] + b[1] * cos1 + b[2] * cos2;
    const numIm = -(b[1] * sin1 + b[2] * sin2);

    // Denominator
    const denRe = 1 + a[1] * cos1 + a[2] * cos2;
    const denIm = -(a[1] * sin1 + a[2] * sin2);

    // Magnitude Squared
    const magSq = (numRe * numRe + numIm * numIm) / (denRe * denRe + denIm * denIm);
    
    // Phase (optional for visualization but good for "complex" feel)
    const phase = Math.atan2(numIm, numRe) - Math.atan2(denIm, denRe);

    return { mag: Math.sqrt(magSq), phase };
};

// Coefficient Calculator (Standard Audio EQ Cookbook formulas)
const calculateBiquadCoeffs = (type: string, freq: number, fs: number, Q: number, gainDb: number = 0) => {
    const w0 = (TWO_PI * freq) / fs;
    const alpha = Math.sin(w0) / (2 * (Q || 0.707));
    const A = Math.pow(10, gainDb / 40);
    const cosW = Math.cos(w0);

    let b0=0, b1=0, b2=0, a0=1, a1=0, a2=0;

    switch (type) {
        case 'lowpass':
            b0 = (1 - cosW) / 2; b1 = 1 - cosW; b2 = (1 - cosW) / 2;
            a0 = 1 + alpha; a1 = -2 * cosW; a2 = 1 - alpha;
            break;
        case 'highpass':
            b0 = (1 + cosW) / 2; b1 = -(1 + cosW); b2 = (1 + cosW) / 2;
            a0 = 1 + alpha; a1 = -2 * cosW; a2 = 1 - alpha;
            break;
        case 'peaking':
            b0 = 1 + alpha * A; b1 = -2 * cosW; b2 = 1 - alpha * A;
            a0 = 1 + alpha / A; a1 = -2 * cosW; a2 = 1 - alpha / A;
            break;
        case 'lowshelf':
            b0 = A*((A+1) - (A-1)*cosW + 2*Math.sqrt(A)*alpha);
            b1 = 2*A*((A-1) - (A+1)*cosW);
            b2 = A*((A+1) - (A-1)*cosW - 2*Math.sqrt(A)*alpha);
            a0 = (A+1) + (A-1)*cosW + 2*Math.sqrt(A)*alpha;
            a1 = -2*((A-1) + (A+1)*cosW);
            a2 = (A+1) + (A-1)*cosW - 2*Math.sqrt(A)*alpha;
            break;
        case 'highshelf':
            b0 = A*((A+1) + (A-1)*cosW + 2*Math.sqrt(A)*alpha);
            b1 = -2*A*((A-1) + (A+1)*cosW);
            b2 = A*((A+1) + (A-1)*cosW - 2*Math.sqrt(A)*alpha);
            a0 = (A+1) - (A-1)*cosW + 2*Math.sqrt(A)*alpha;
            a1 = 2*((A-1) - (A+1)*cosW);
            a2 = (A+1) - (A-1)*cosW - 2*Math.sqrt(A)*alpha;
            break;
    }

    return {
        b: [b0/a0, b1/a0, b2/a0],
        a: [1, a1/a0, a2/a0]
    };
};

// --- VISUALIZERS ---

// 1. COMPLEX FIELD RESPONSE (Magnitude + Phase + Particle Flow)
interface FilterResponseProps {
    freq: number;
    res: number;
    gain?: number;
    type: 'lowpass' | 'highpass' | 'peaking' | 'lowshelf' | 'highshelf';
    color: string;
}

export const FilterResponse: React.FC<FilterResponseProps> = ({ freq, res, gain = 0, type, color }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    // Reuse arrays to prevent GC
    const pointsRef = useRef<{x: Float32Array, y: Float32Array, mag: Float32Array} | null>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d', { alpha: true, desynchronized: true });
        if (!ctx) return;

        let animationFrame: number;
        let time = 0;

        const render = () => {
            time += 0.01;
            if (canvas.offsetWidth === 0 || canvas.offsetHeight === 0) {
                 animationFrame = requestAnimationFrame(render);
                 return;
            }
            const w = canvas.width = canvas.offsetWidth;
            const h = canvas.height = canvas.offsetHeight;
            ctx.clearRect(0, 0, w, h);

            // Calculate exact Coefficients via Z-Transform
            const coeffs = calculateBiquadCoeffs(type, freq, 48000, res, gain);
            
            // Draw Bode Magnitude Plot
            ctx.beginPath();
            ctx.lineWidth = 3;
            ctx.strokeStyle = color;
            ctx.shadowBlur = 20;
            ctx.shadowColor = color;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';

            // Resize storage if needed
            const pointCount = Math.ceil(w / 2);
            if (!pointsRef.current || pointsRef.current.x.length < pointCount) {
                pointsRef.current = {
                    x: new Float32Array(pointCount),
                    y: new Float32Array(pointCount),
                    mag: new Float32Array(pointCount)
                };
            }

            let pIndex = 0;
            for (let i = 0; i < w; i+=2) {
                // Logarithmic frequency mapping: 20Hz to 20kHz
                const f = 20 * Math.pow(1000, i / w);
                const { mag } = evaluateBiquad(f, 48000, coeffs.b, coeffs.a);
                
                // Convert Magnitude to dB then to pixels
                // Range: +/- 24dB roughly
                const db = 20 * Math.log10(mag + 0.00001);
                const y = (h / 2) - (db * (h / 60)); 
                const clampedY = Math.max(0, Math.min(h, y));

                // Store in typed array
                if (pointsRef.current) {
                    pointsRef.current.x[pIndex] = i;
                    pointsRef.current.y[pIndex] = clampedY;
                    pointsRef.current.mag[pIndex] = mag;
                    pIndex++;
                }
                
                if (i === 0) ctx.moveTo(i, clampedY);
                else ctx.lineTo(i, clampedY);
            }
            ctx.stroke();

            // Quantum Field Fill (Gradient based on Magnitude)
            ctx.globalCompositeOperation = 'screen';
            const gradient = ctx.createLinearGradient(0, h, 0, 0);
            gradient.addColorStop(0, `${color}00`);
            gradient.addColorStop(1, `${color}33`);
            ctx.fillStyle = gradient;
            ctx.lineTo(w, h);
            ctx.lineTo(0, h);
            ctx.fill();

            // Particle Flow Simulation (Visualizing Phase/Flow)
            ctx.fillStyle = '#fff';
            const particleCount = 20;
            const pts = pointsRef.current;
            
            if (pts) {
                for(let i=0; i<particleCount; i++) {
                    const pOffset = (i / particleCount) * w;
                    const speed = 0.5 + Math.sin(i * 32.1 + time);
                    let px = (pOffset + time * 30 * speed) % w;
                    
                    // Lookup response from cached typed array
                    const idx = Math.floor(px / 2);
                    if (idx < pIndex) {
                        const ptX = pts.x[idx];
                        const ptY = pts.y[idx];
                        const ptMag = pts.mag[idx];

                        const size = Math.min(2.5, Math.max(1, ptMag * 2));
                        
                        const jitterX = Math.sin(time * 10 + i) * 1;
                        const jitterY = Math.cos(time * 15 + i) * 1;

                        ctx.globalAlpha = Math.min(1, ptMag);
                        ctx.beginPath();
                        ctx.arc(ptX + jitterX, ptY + jitterY, size/2, 0, TWO_PI);
                        ctx.fill();
                    }
                }
            }
            
            ctx.globalAlpha = 1;
            ctx.globalCompositeOperation = 'source-over';
            
            animationFrame = requestAnimationFrame(render);
        };
        render();
        return () => cancelAnimationFrame(animationFrame);

    }, [freq, res, gain, type, color]);

    return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full opacity-60 pointer-events-none" />;
};

// 2. DYNAMICS FLUX FIELD
interface DynamicsProps {
    threshold: number; // dB
    ratio: number;
    color: string;
}
export const DynamicsTransfer: React.FC<DynamicsProps> = ({ threshold, ratio, color }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const particlesRef = useRef<Array<{x: number, offset: number, speed: number}>>([]);
    
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d', { alpha: true, desynchronized: true });
        if (!ctx) return;

        // Init Particles
        if (particlesRef.current.length === 0) {
            for(let i=0; i<60; i++) {
                particlesRef.current.push({
                    x: Math.random(), // Normalized 0-1 position along X axis
                    offset: (Math.random() - 0.5) * 2, // Normalized -1 to 1 variance from center line
                    speed: 0.002 + Math.random() * 0.003
                });
            }
        }

        let frameId: number;
        let t = 0;

        const render = () => {
            t += 0.05;
            if (canvas.offsetWidth === 0 || canvas.offsetHeight === 0) {
                 frameId = requestAnimationFrame(render);
                 return;
            }
            const w = canvas.width = canvas.offsetWidth;
            const h = canvas.height = canvas.offsetHeight;
            ctx.clearRect(0,0,w,h);

            // 1. Draw The Transfer Function Line (Neon Tube)
            ctx.lineWidth = 2;
            ctx.strokeStyle = '#ffffff60';
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            
            const linearX = ((threshold + 60) / 60) * w;
            const linearY = h - ((threshold + 60) / 60) * h;
            
            // Linear part (0,0 to thresh)
            ctx.moveTo(0, h);
            ctx.lineTo(linearX, linearY);
            
            // Compressed part
            const endInDb = 0;
            const endOutDb = threshold + (endInDb - threshold) / ratio;
            const endX = w;
            const endY = h - ((endOutDb + 60) / 60) * h;
            
            ctx.lineTo(endX, endY);
            ctx.stroke();
            ctx.setLineDash([]);
            
            // Add Glow to Knee
            ctx.shadowBlur = 15;
            ctx.shadowColor = '#fff';
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.arc(linearX, linearY, 2, 0, TWO_PI);
            ctx.fill();
            ctx.shadowBlur = 0;

            // 2. Simulate Signal Flow
            particlesRef.current.forEach(p => {
                p.x += p.speed;
                if (p.x > 1) p.x = 0;

                const inDb = -60 + (p.x * 60);
                
                let outDb = inDb;
                let scatterScale = 1.0;
                let isCompressed = false;

                if (inDb > threshold) {
                    outDb = threshold + (inDb - threshold) / ratio;
                    scatterScale = 1 / Math.sqrt(ratio); // Visual compression of variance
                    isCompressed = true;
                }

                // Map to Pixels
                const baseX = p.x * w;
                const baseY = h - ((outDb + 60) / 60) * h;
                const scatterPx = p.offset * 15 * scatterScale; 
                
                const finalX = baseX;
                const finalY = baseY + scatterPx;

                const size = isCompressed ? 1.5 : 2;
                const opacity = Math.sin(p.x * PI);
                
                ctx.fillStyle = isCompressed ? '#ffffff' : color;
                ctx.globalAlpha = opacity * (isCompressed ? 0.9 : 0.6);
                
                ctx.beginPath();
                ctx.arc(finalX, finalY, size, 0, TWO_PI);
                ctx.fill();
                
                // Draw "Force Lines" only occasionally to save CPU
                if (isCompressed && Math.random() > 0.98) {
                    ctx.strokeStyle = color;
                    ctx.globalAlpha = 0.2;
                    ctx.lineWidth = 1;
                    ctx.beginPath();
                    const linearY_at_X = h - ((inDb + 60) / 60) * h;
                    ctx.moveTo(finalX, linearY_at_X + scatterPx);
                    ctx.lineTo(finalX, finalY);
                    ctx.stroke();
                }
            });
            
            ctx.globalAlpha = 1.0;
            frameId = requestAnimationFrame(render);
        };
        render();
        return () => cancelAnimationFrame(frameId);

    }, [threshold, ratio, color]);

    return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full opacity-80 pointer-events-none" />;
};

// 3. WAVEFUNCTION ENVELOPE (Fluid Bezier)
interface EnvelopeProps {
    fadeIn: number;
    fadeOut: number;
    color: string;
}
export const EnvelopeGraph: React.FC<EnvelopeProps> = ({ fadeIn, fadeOut, color }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d', { alpha: true });
        if (!ctx) return;

        if (canvas.offsetWidth === 0 || canvas.offsetHeight === 0) return;
        const w = canvas.width = canvas.offsetWidth;
        const h = canvas.height = canvas.offsetHeight;
        ctx.clearRect(0,0,w,h);

        const inPx = Math.min(w * 0.4, fadeIn * 50); // Scale logic
        const outPx = Math.min(w * 0.4, fadeOut * 50);

        // Draw Fluid Spline
        ctx.beginPath();
        ctx.moveTo(0, h);
        
        // Attack Curve (Exponential)
        ctx.bezierCurveTo(inPx * 0.5, h, inPx * 0.5, 0, inPx, 0);
        
        // Sustain
        ctx.lineTo(w - outPx, 0);
        
        // Release Curve (Logarithmic)
        ctx.bezierCurveTo(w - outPx * 0.5, 0, w - outPx * 0.5, h, w, h);

        // Fill Gradient
        const grad = ctx.createLinearGradient(0, 0, 0, h);
        grad.addColorStop(0, color);
        grad.addColorStop(1, '#00000000');
        ctx.fillStyle = grad;
        ctx.globalAlpha = 0.3;
        ctx.fill();

        // Stroke
        ctx.lineWidth = 2;
        ctx.strokeStyle = color;
        ctx.shadowColor = color;
        ctx.shadowBlur = 10;
        ctx.globalAlpha = 1.0;
        ctx.stroke();

    }, [fadeIn, fadeOut, color]);
    return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full opacity-60 pointer-events-none" />;
};

// 4. PHASOR PROJECTION SCOPE (LFO)
interface LFOProps {
    rate: number;
    depth: number;
    color: string;
}
export const LFOOscilloscope: React.FC<LFOProps> = ({ rate, depth, color }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d', { alpha: true });
        if (!ctx) return;
        
        let frameId: number;
        let time = 0;

        const render = () => {
            time += 0.016;
            if (canvas.offsetWidth === 0 || canvas.offsetHeight === 0) {
                 frameId = requestAnimationFrame(render);
                 return;
            }
            const w = canvas.width = canvas.offsetWidth;
            const h = canvas.height = canvas.offsetHeight;
            ctx.clearRect(0,0,w,h);
            
            const midY = h/2;
            const radius = (h/2) * 0.8 * depth;
            const phasorX = w * 0.15; 

            // 1. Draw Phasor Circle (Unit Circle)
            ctx.beginPath();
            ctx.strokeStyle = '#ffffff20';
            ctx.lineWidth = 1;
            ctx.arc(phasorX, midY, radius, 0, TWO_PI);
            ctx.stroke();

            // Calculate Phasor Position
            const angle = time * rate * TWO_PI;
            const tipX = phasorX + Math.cos(angle) * radius;
            const tipY = midY + Math.sin(angle) * radius * -1; // Canvas Y is inverted

            // 2. Draw Phasor Vector
            ctx.beginPath();
            ctx.strokeStyle = '#fff';
            ctx.moveTo(phasorX, midY);
            ctx.lineTo(tipX, tipY);
            ctx.stroke();

            // 3. Draw Projection Line
            const waveStartX = w * 0.3;
            ctx.beginPath();
            ctx.strokeStyle = `${color}40`;
            ctx.setLineDash([2, 2]);
            ctx.moveTo(tipX, tipY);
            ctx.lineTo(waveStartX, tipY);
            ctx.stroke();
            ctx.setLineDash([]);

            // 4. Draw Time Domain Waveform
            ctx.beginPath();
            ctx.strokeStyle = color;
            ctx.lineWidth = 2;
            ctx.shadowColor = color;
            ctx.shadowBlur = 8;

            ctx.moveTo(waveStartX, tipY);

            // Plot history of wave
            for(let x=waveStartX; x<w; x++) {
                const xOffset = x - waveStartX;
                const timeDelay = xOffset * 0.01; 
                const pastAngle = angle - (timeDelay * rate * 10);
                
                const y = midY + Math.sin(pastAngle) * radius * -1;
                ctx.lineTo(x, y);
            }
            ctx.stroke();
            
            // Phasor Tip Glow
            ctx.fillStyle = '#fff';
            ctx.shadowBlur = 10;
            ctx.shadowColor = '#fff';
            ctx.beginPath();
            ctx.arc(tipX, tipY, 3, 0, TWO_PI);
            ctx.fill();

            frameId = requestAnimationFrame(render);
        };
        render();
        return () => cancelAnimationFrame(frameId);
    }, [rate, depth, color]);
    return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full opacity-60 pointer-events-none" />;
};
