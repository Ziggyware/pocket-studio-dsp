
// Scientific Math Library for Signal Processing & Tensor Visualizations

export const TWO_PI = Math.PI * 2;

// --- Curve Generation ---

export const generateDriveCurve = (amount: number, samples: number = 8192): Float32Array => {
    if (!Number.isFinite(amount) || amount < 1) {
        const curve = new Float32Array(2);
        curve[0] = -1; curve[1] = 1;
        return curve;
    }
    const k = amount;
    const curve = new Float32Array(samples);
    for (let i = 0; i < samples; ++i) {
      const x = (i * 2) / samples - 1;
      // Sigmoid-like distortion transfer function
      curve[i] = (Math.PI + 50) * x / (Math.PI + 50 * Math.abs(x));
    }
    return curve;
};

export const generateSoftClipCurve = (amount: number = 1.0, samples: number = 4096): Float32Array => {
    // Hyperbolic Tangent Soft Clipper
    // Decomposes peaks musically before hard limiting
    const curve = new Float32Array(samples);
    const k = Math.max(0.1, amount);
    for (let i = 0; i < samples; i++) {
        const x = (i / (samples - 1)) * 2 - 1;
        curve[i] = Math.tanh(x * k) / Math.tanh(k);
    }
    return curve;
};

export const generateBitcrushCurve = (bits: number, samples: number = 4096): Float32Array => {
    if (!Number.isFinite(bits)) return new Float32Array(samples);
    const step = Math.pow(0.5, bits);
    const curve = new Float32Array(samples);
    for (let i = 0; i < samples; i++) {
        const x = (i / (samples - 1)) * 2 - 1;
        curve[i] = Math.round(x / step) * step;
    }
    return curve;
};

export const generateExpanderCurve = (threshDb: number, samples: number = 4096): Float32Array => {
    const curve = new Float32Array(samples);
    const thresh = Math.pow(10, threshDb / 20); // e.g., -60dB -> 0.001
    const ratio = 4.0; // Expansion ratio for noise reduction
    
    for(let i=0; i < samples; i++) {
        const x = (i / (samples - 1)) * 2 - 1;
        const absX = Math.abs(x);
        
        // Zero out minimal noise floor entirely
        if (absX < 0.00001) {
            curve[i] = 0;
            continue;
        }

        if (absX < thresh) {
             // Smooth polynomial expansion below threshold
             // y = x * (abs(x)/thresh)^ratio
             const gainReduction = Math.pow(absX / thresh, ratio);
             curve[i] = x * gainReduction;
        } else {
             // 1:1 linearity above threshold
             curve[i] = x;
        }
    }
    return curve;
};

// --- Spectral Analysis ---

export const blackmanHarris = (n: number, N: number): number => {
    const a0 = 0.35875;
    const a1 = 0.48829;
    const a2 = 0.14128;
    const a3 = 0.01168;
    const term = (TWO_PI * n) / (N - 1);
    return a0 - a1 * Math.cos(term) + a2 * Math.cos(2 * term) - a3 * Math.cos(3 * term);
};

// Iterative Fast Fourier Transform
// Returns { re, im } arrays of size N
export const fft = (data: Float32Array): { re: Float32Array, im: Float32Array } => {
    const n = data.length;
    const m = Math.log2(n);
    
    // Bit-reversal permutation
    const re = new Float32Array(n);
    const im = new Float32Array(n);
    for (let i = 0; i < n; i++) {
        let j = 0;
        let k = i;
        for (let l = 0; l < m; l++) {
            j = (j << 1) | (k & 1);
            k >>= 1;
        }
        re[j] = data[i];
        im[j] = 0;
    }

    // Cooley-Tukey butterfly operations
    for (let s = 1; s <= m; s++) {
        const mh = 1 << (s - 1);
        const m_len = 1 << s;
        const theta = -TWO_PI / m_len;
        const wmRe = Math.cos(theta);
        const wmIm = Math.sin(theta);
        
        for (let k = 0; k < n; k += m_len) {
            let wRe = 1;
            let wIm = 0;
            for (let j = 0; j < mh; j++) {
                const tRe = wRe * re[k + j + mh] - wIm * im[k + j + mh];
                const tIm = wRe * im[k + j + mh] + wIm * re[k + j + mh];
                const uRe = re[k + j];
                const uIm = im[k + j];
                
                re[k + j] = uRe + tRe;
                im[k + j] = uIm + tIm;
                re[k + j + mh] = uRe - tRe;
                im[k + j + mh] = uIm - tIm;
                
                const wReNew = wRe * wmRe - wIm * wmIm;
                wIm = wRe * wmIm + wIm * wmRe;
                wRe = wReNew;
            }
        }
    }
    
    return { re, im };
};

// --- Vector Math & Interpolation ---

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export const clamp = (val: number, min: number, max: number) => Math.min(max, Math.max(min, val));

export const mapRange = (value: number, inMin: number, inMax: number, outMin: number, outMax: number) => {
    return outMin + (outMax - outMin) * ((value - inMin) / (inMax - inMin));
};

// Cubic Hermite Spline Interpolation for high-fidelity waveform rendering at low zoom levels
export const cubicHermite = (y0: number, y1: number, y2: number, y3: number, t: number): number => {
    const a = -0.5 * y0 + 1.5 * y1 - 1.5 * y2 + 0.5 * y3;
    const b = y0 - 2.5 * y1 + 2 * y2 - 0.5 * y3;
    const c = -0.5 * y0 + 0.5 * y2;
    const d = y1;
    return a * t * t * t + b * t * t + c * t + d;
};

// --- Wavelet Analysis (Simulated) ---

// Haar Wavelet Single Level Decomposition
// Returns { approx, detail } energy estimates for a chunk
export const computeHaarEnergy = (data: Float32Array): { lowEnergy: number, highEnergy: number } => {
    let lowSum = 0;
    let highSum = 0;
    // Iterate pairwise
    for(let i=0; i<data.length - 1; i+=2) {
        const s1 = data[i];
        const s2 = data[i+1];
        // Haar Coeffs
        const approx = (s1 + s2) / Math.SQRT2;
        const detail = (s1 - s2) / Math.SQRT2;
        lowSum += approx * approx;
        highSum += detail * detail;
    }
    return {
        lowEnergy: Math.sqrt(lowSum / (data.length/2)),
        highEnergy: Math.sqrt(highSum / (data.length/2))
    };
};

// Simple Hilbert Transform Approximation (Discrete Analytic Signal Magnitude)
// Used for "Complex Analysis" visualization
export const computeAnalyticMagnitude = (data: Float32Array): number => {
    // We compute the magnitude of the analytic signal z[n] = x[n] + j*H{x[n]}
    // H{x[n]} can be approximated by a 90-degree phase shift.
    // For visualization speed, we use a simple quadrature filter [1, 0, -1] centered
    let sumMag = 0;
    for (let i=1; i<data.length-1; i++) {
        const real = data[i];
        const imag = 0.5 * (data[i-1] - data[i+1]); // Simple central difference for quadrature
        const mag = Math.sqrt(real*real + imag*imag);
        sumMag += mag;
    }
    return sumMag / (data.length - 2);
};
