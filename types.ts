
export interface TrackFX {
  compressorThreshold: number; 
  compressorRatio: number; 
  compressorAttack: number; 
  compressorRelease: number; 
  highPassFreq: number; 
  eqLow: number; 
  eqMid: number; 
  eqHigh: number; 
  saturation: number; 
  sendReverb: number; 
  sendDelay: number; 
}

export interface ClipFX {
  gain: number; 
  pitch: number; 
  pan: number; 
  isReversed: boolean;
  fadeIn: number; 
  fadeOut: number; 
}

export type WaveformMode = 'PCM' | 'CANDLESTICK';

export interface ClipViewConfig {
    mode: WaveformMode;
    resolution: number; 
    scale: number; 
}

export interface Track {
  id: string;
  name: string;
  color: string;
  muted: boolean;
  solo: boolean;
  armed: boolean;
  volume: number;
  pan: number;
  fx: TrackFX; 
  isExpanded: boolean; 
}

export interface AudioClip {
  id: string;
  trackId: string;
  buffer: AudioBuffer;
  startTime: number;
  duration: number;
  offset: number;
  name: string;
  fx: ClipFX;
  viewConfig: ClipViewConfig; 
}

export interface ProjectMetadata {
  title: string;
  artist: string;
  album: string;
  year: string;
}

export enum EditMode {
  MOVE = 'MOVE',
  SPLIT = 'SPLIT',
  DELETE = 'DELETE'
}

export interface ViewSettings {
    showTransport: boolean; 
    showMix: boolean;       
    showRack: boolean;      
    isCollapsed: boolean;   
}

export interface DSPState {
  masterVolume: number; 
  masterFilterFreq: number; 
  masterFilterRes: number; 
  masterFilterBypass: boolean; 
  masterEqLow: number; 
  masterEqMid: number; 
  masterEqHigh: number; 
  masterEqBypass: boolean;
  masterSaturation: number; 
  masterSaturationBypass: boolean;
  masterCompressorThreshold: number; 
  masterCompressorRatio: number; 
  masterCompressorBypass: boolean;
  delayTime: number; 
  delayFeedback: number; 
  reverbMix: number; 
  masterSpatialBypass: boolean;
  limiterThreshold: number;
  reverbDecay: number; 
}

export interface Notification {
    id: string;
    message: string;
    type: 'info' | 'success' | 'warning' | 'error';
    timestamp: number;
}

