
import { TrackFX } from './types';

export const PX_PER_SEC = 100; // Zoom level: 100 pixels per second
export const TRACK_HEIGHT = 150; // Slightly taller for better touch targets
export const EXPANDED_TRACK_HEIGHT = 600; // Taller to fit the control grid
export const HEADER_HEIGHT = 60;
export const FOOTER_HEIGHT = 260; // Expanded for DSP controls

// Dynamic Channel Widths
export const CHANNEL_WIDTH_COLLAPSED = 48; // Wider touch target for collapsed state
export const CHANNEL_WIDTH_DEFAULT = 160; // Standard width
export const CHANNEL_WIDTH_EXPANDED = 340; // Wide enough for 2-column FX grid

export const COLORS = [
  '#ef4444', // red-500
  '#f97316', // orange-500
  '#eab308', // yellow-500
  '#22c55e', // green-500
  '#06b6d4', // cyan-500
  '#3b82f6', // blue-500
  '#a855f7', // purple-500
  '#ec4899', // pink-500
];

export const DB_NAME = 'PocketStudioDB';
export const DB_VERSION = 1;
export const STORE_BLOBS = 'audio_blobs';
export const STORE_PROJECTS = 'projects';

export const TRACK_PRESETS: Record<string, Partial<TrackFX>> = {
    "Init / Reset": {
        compressorThreshold: 0, compressorRatio: 1,
        highPassFreq: 20, eqLow: 0, eqMid: 0, eqHigh: 0,
        saturation: 0,
        sendReverb: 0, sendDelay: 0
    },
    "Vocal: Lead Air": {
        compressorThreshold: -24, compressorRatio: 4, compressorAttack: 0.005,
        highPassFreq: 120, eqLow: -2, eqMid: -1, eqHigh: 3,
        saturation: 10, sendReverb: 0.3, sendDelay: 0.2
    },
    "Vocal: Podcast": {
        compressorThreshold: -20, compressorRatio: 6, compressorAttack: 0.002,
        highPassFreq: 80, eqLow: 2, eqMid: 1, eqHigh: 1,
        saturation: 5, sendReverb: 0.05
    },
    "Drums: Punchy": {
        compressorThreshold: -18, compressorRatio: 8, compressorAttack: 0.015, compressorRelease: 0.1,
        eqLow: 4, eqMid: -3, eqHigh: 3, saturation: 25
    },
    "Drums: Lo-Fi Crunch": {
        compressorThreshold: -10, compressorRatio: 3,
        highPassFreq: 400, eqLow: 0, eqHigh: -10,
        saturation: 40
    },
    "Bass: Sub Glue": {
        compressorThreshold: -20, compressorRatio: 12, compressorAttack: 0.005,
        highPassFreq: 30, eqLow: 6, eqMid: -2, eqHigh: 0,
        saturation: 15
    },
    "Guitar: Dreamy": {
        compressorThreshold: -12, compressorRatio: 3,
        highPassFreq: 200, eqMid: 2, eqHigh: 2,
        sendReverb: 0.5, sendDelay: 0.4
    },
    "Guitar: Rock Stack": {
        compressorThreshold: -15, compressorRatio: 4,
        eqLow: 2, eqMid: 4, eqHigh: 2,
        saturation: 30,
        sendReverb: 0.15
    }
};
