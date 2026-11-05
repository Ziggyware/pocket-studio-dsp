
import { DSPState, Track, AudioClip, TrackFX, ClipFX } from '../types';
import { generateDriveCurve, generateBitcrushCurve, generateExpanderCurve, generateSoftClipCurve } from '../utils/dsp';

interface TrackChannel {
  input: GainNode;
  compressor: DynamicsCompressorNode;
  hpf: BiquadFilterNode;
  eqLow: BiquadFilterNode;
  eqMid: BiquadFilterNode;
  eqHigh: BiquadFilterNode;
  drive: WaveShaperNode;
  sendReverb: GainNode;
  sendDelay: GainNode;
  output: GainNode; 
  analyser: AnalyserNode; 
  panner: StereoPannerNode;
}

interface ActiveClipResource {
    source: AudioBufferSourceNode;
    gain: GainNode;
    pan: StereoPannerNode;
}

export class AudioEngine {
  public ctx: AudioContext;
  public analyser: AnalyserNode; 
  public masterCompressor: DynamicsCompressorNode;
  
  private masterInput: GainNode; 
  private masterFilter: BiquadFilterNode;
  private masterEqLow: BiquadFilterNode;
  private masterEqMid: BiquadFilterNode;
  private masterEqHigh: BiquadFilterNode;
  private masterDrive: WaveShaperNode;
  
  private masterGain: GainNode;
  private masterSoftClip: WaveShaperNode;
  private limiterNode: DynamicsCompressorNode;

  private reverbNode: ConvolverNode;
  private delayNode: DelayNode;
  private delayFeedback: GainNode;
  private returnReverbGain: GainNode;
  private returnDelayGain: GainNode;

  private trackChannels: Map<string, TrackChannel> = new Map();
  private activeClipResources: Map<string, ActiveClipResource> = new Map();
  
  private stream: MediaStream | null = null;
  private micSourceNode: MediaStreamAudioSourceNode | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private exportDest: MediaStreamAudioDestinationNode;

  constructor() {
    const AudioContextClass = (window.AudioContext || (window as any).webkitAudioContext);
    this.ctx = new AudioContextClass({ latencyHint: 'interactive' });
    
    this.masterInput = this.ctx.createGain();
    
    this.masterFilter = this.ctx.createBiquadFilter();
    this.masterEqLow = this.ctx.createBiquadFilter();
    this.masterEqMid = this.ctx.createBiquadFilter();
    this.masterEqHigh = this.ctx.createBiquadFilter();
    this.masterDrive = this.ctx.createWaveShaper();

    this.masterCompressor = this.ctx.createDynamicsCompressor();

    this.masterGain = this.ctx.createGain();
    this.masterSoftClip = this.ctx.createWaveShaper();
    this.limiterNode = this.ctx.createDynamicsCompressor();
    this.analyser = this.ctx.createAnalyser();
    
    this.exportDest = this.ctx.createMediaStreamDestination();

    this.masterFilter.type = 'lowpass'; 
    this.masterFilter.Q.value = 0;
    
    this.masterEqLow.type = 'lowshelf';
    this.masterEqLow.frequency.value = 200;
    
    this.masterEqMid.type = 'peaking';
    this.masterEqMid.frequency.value = 1000;
    
    this.masterEqHigh.type = 'highshelf';
    this.masterEqHigh.frequency.value = 4000;
    
    this.masterDrive.curve = generateDriveCurve(0);
    this.masterDrive.oversample = '4x';
    
    this.masterSoftClip.curve = generateSoftClipCurve(1.2);
    this.masterSoftClip.oversample = '4x';

    this.limiterNode.threshold.value = -0.1;
    this.limiterNode.knee.value = 0;
    this.limiterNode.ratio.value = 20;
    this.limiterNode.attack.value = 0.001; 
    this.limiterNode.release.value = 0.1;

    // --- CHAIN ---
    this.masterInput.connect(this.masterFilter);
    this.masterFilter.connect(this.masterEqLow);
    this.masterEqLow.connect(this.masterEqMid);
    this.masterEqMid.connect(this.masterEqHigh);
    this.masterEqHigh.connect(this.masterDrive);
    this.masterDrive.connect(this.masterCompressor);
    this.masterCompressor.connect(this.masterGain);
    
    this.masterGain.connect(this.masterSoftClip);
    this.masterSoftClip.connect(this.limiterNode);
    
    this.limiterNode.connect(this.analyser);
    this.analyser.connect(this.ctx.destination);
    this.limiterNode.connect(this.exportDest); 
    
    this.reverbNode = this.ctx.createConvolver();
    this.delayNode = this.ctx.createDelay(4.0);
    this.delayFeedback = this.ctx.createGain();
    this.returnReverbGain = this.ctx.createGain();
    this.returnDelayGain = this.ctx.createGain();

    this.reverbNode.connect(this.returnReverbGain);
    this.returnReverbGain.connect(this.masterInput);

    this.delayNode.connect(this.delayFeedback);
    this.delayFeedback.connect(this.delayNode); 
    this.delayNode.connect(this.returnDelayGain);
    this.returnDelayGain.connect(this.masterInput);

    this.generateImpulseResponse();
  }

  async resume() {
    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }
  }

  getTrackRMS(trackId: string): number {
      const ch = this.trackChannels.get(trackId);
      if (!ch) return 0;
      
      const data = new Uint8Array(ch.analyser.frequencyBinCount);
      ch.analyser.getByteTimeDomainData(data);
      
      let sum = 0;
      for(let i = 0; i < data.length; i += 4) {
          const amplitude = (data[i] - 128) / 128;
          sum += amplitude * amplitude;
      }
      return Math.sqrt(sum / (data.length / 4));
  }
  
  getMasterGainReduction(): number {
      if (this.masterCompressor && typeof this.masterCompressor.reduction === 'number') {
          return this.masterCompressor.reduction;
      } else if (this.masterCompressor && 'reduction' in this.masterCompressor) {
          return (this.masterCompressor.reduction as any).value || 0;
      }
      return 0;
  }

  private safeSet(param: AudioParam, value: number, time: number, ramp: number = 0.05) {
      if (typeof value === 'number' && Number.isFinite(value)) {
          param.setTargetAtTime(value, time, ramp);
      }
  }

  ensureTrackChannel(track: Track) {
    if (this.trackChannels.has(track.id)) return;

    // --- NODE CREATION ---
    const input = this.ctx.createGain();
    const compressor = this.ctx.createDynamicsCompressor();

    const hpf = this.ctx.createBiquadFilter();
    const eqLow = this.ctx.createBiquadFilter();
    const eqMid = this.ctx.createBiquadFilter();
    const eqHigh = this.ctx.createBiquadFilter();

    const drive = this.ctx.createWaveShaper();
    
    const sendReverb = this.ctx.createGain();
    const sendDelay = this.ctx.createGain();
    const output = this.ctx.createGain();
    const analyser = this.ctx.createAnalyser(); 
    const panner = this.ctx.createStereoPanner();

    // --- CONFIG ---
    hpf.type = 'highpass';
    eqLow.type = 'lowshelf';
    eqMid.type = 'peaking';
    eqHigh.type = 'highshelf';
    analyser.fftSize = 256; 
    
    drive.curve = generateDriveCurve(0);
    drive.oversample = '4x';

    // --- SIGNAL CHAIN WIRING ---
    input.connect(compressor);
    compressor.connect(hpf);
    hpf.connect(eqLow);
    eqLow.connect(eqMid);
    eqMid.connect(eqHigh);
    eqHigh.connect(drive);
    
    drive.connect(output);
    output.connect(analyser); 
    analyser.connect(panner);

    // Sends
    drive.connect(sendReverb);
    sendReverb.connect(this.reverbNode);

    drive.connect(sendDelay);
    sendDelay.connect(this.delayNode);

    panner.connect(this.masterInput);

    this.trackChannels.set(track.id, {
        input, compressor,
        hpf, eqLow, eqMid, eqHigh, 
        drive,
        sendReverb, sendDelay, 
        output, analyser, panner
    });

    this.updateTrackState(track);
  }

  updateTrackState(track: Track) {
    const ch = this.trackChannels.get(track.id);
    if (!ch) return;

    const t = this.ctx.currentTime;
    const ramp = 0.05;

    this.safeSet(ch.output.gain, track.muted ? 0 : track.volume, t, ramp);
    this.safeSet(ch.panner.pan, track.pan, t, ramp);

    // Dynamics
    this.safeSet(ch.compressor.threshold, track.fx.compressorThreshold, t, ramp);
    this.safeSet(ch.compressor.ratio, track.fx.compressorRatio, t, ramp);
    this.safeSet(ch.compressor.attack, track.fx.compressorAttack || 0.003, t, ramp);
    this.safeSet(ch.compressor.release, track.fx.compressorRelease || 0.25, t, ramp);

    // EQ
    this.safeSet(ch.hpf.frequency, track.fx.highPassFreq, t, ramp);
    this.safeSet(ch.eqLow.gain, track.fx.eqLow, t, ramp);
    this.safeSet(ch.eqMid.gain, track.fx.eqMid, t, ramp);
    this.safeSet(ch.eqHigh.gain, track.fx.eqHigh, t, ramp);
    
    // Color
    const totalSat = (track.fx.saturation || 0);
    ch.drive.curve = generateDriveCurve(totalSat);

    // Sends
    this.safeSet(ch.sendReverb.gain, track.fx.sendReverb, t, ramp);
    this.safeSet(ch.sendDelay.gain, track.fx.sendDelay, t, ramp);
  }

  updateMasterDSP(state: DSPState) {
      const t = this.ctx.currentTime;
      const ramp = 0.05;

      this.safeSet(this.masterGain.gain, state.masterVolume, t, ramp);
      
      if (state.masterFilterBypass) {
          this.safeSet(this.masterFilter.frequency, 22000, t, ramp);
          this.safeSet(this.masterFilter.Q, 0, t, ramp);
      } else {
          const safeFreq = Math.max(20, Math.min(22000, state.masterFilterFreq || 20000));
          this.safeSet(this.masterFilter.frequency, safeFreq, t, ramp);
          this.safeSet(this.masterFilter.Q, state.masterFilterRes || 0, t, ramp);
      }
      
      if (state.masterEqBypass) {
          this.safeSet(this.masterEqLow.gain, 0, t, ramp);
          this.safeSet(this.masterEqMid.gain, 0, t, ramp);
          this.safeSet(this.masterEqHigh.gain, 0, t, ramp);
      } else {
          this.safeSet(this.masterEqLow.gain, state.masterEqLow, t, ramp);
          this.safeSet(this.masterEqMid.gain, state.masterEqMid, t, ramp);
          this.safeSet(this.masterEqHigh.gain, state.masterEqHigh, t, ramp);
      }

      const sat = state.masterSaturationBypass ? 0 : (state.masterSaturation || 0);
      this.masterDrive.curve = generateDriveCurve(sat);

      if (state.masterCompressorBypass) {
          this.safeSet(this.masterCompressor.threshold, 0, t, ramp);
          this.safeSet(this.masterCompressor.ratio, 1, t, ramp);
      } else {
          this.safeSet(this.masterCompressor.threshold, state.masterCompressorThreshold, t, ramp);
          this.safeSet(this.masterCompressor.ratio, state.masterCompressorRatio, t, ramp);
      }

      if (state.masterSpatialBypass) {
          this.safeSet(this.returnDelayGain.gain, 0, t, ramp); 
          this.safeSet(this.returnReverbGain.gain, 0, t, ramp);
      } else {
          this.safeSet(this.delayNode.delayTime, state.delayTime, t, ramp);
          this.safeSet(this.delayFeedback.gain, state.delayFeedback, t, ramp);
          this.safeSet(this.returnDelayGain.gain, 0.7, t, ramp); 
          this.safeSet(this.returnReverbGain.gain, state.reverbMix, t, ramp);
      }
  }

  playClip(clip: AudioClip, projectTime: number) {
    const ch = this.trackChannels.get(clip.trackId);
    if (!ch) return; 

    const rate = clip.fx.pitch || 1.0;
    const clipStart = clip.startTime;
    const clipEnd = clip.startTime + (clip.duration / rate); 

    if (clipEnd <= projectTime) return;

    const source = this.ctx.createBufferSource();
    
    if (clip.fx.isReversed) {
        const original = clip.buffer;
        const reversed = this.ctx.createBuffer(original.numberOfChannels, original.length, original.sampleRate);
        for(let c=0; c<original.numberOfChannels; c++) {
            const dest = reversed.getChannelData(c);
            const src = original.getChannelData(c);
            for(let i=0; i<original.length; i++) dest[i] = src[original.length - 1 - i];
        }
        source.buffer = reversed;
    } else {
        source.buffer = clip.buffer;
    }

    source.playbackRate.value = rate;

    // --- Clip Chain ---
    const clipGain = this.ctx.createGain();
    const clipPan = this.ctx.createStereoPanner();

    // FX CONFIG
    clipGain.gain.value = clip.fx.gain;
    clipPan.pan.value = clip.fx.pan;

    // Chain Wiring
    source.connect(clipGain);
    clipGain.connect(clipPan);
    clipPan.connect(ch.input);

    let startWhen = 0;
    let startOffset = 0;
    let duration = 0;

    if (clipStart >= projectTime) {
        startWhen = clipStart - projectTime;
        startOffset = clip.offset;
        duration = clip.duration;
    } else {
        const timeIntoClip = (projectTime - clipStart) * rate; 
        startWhen = 0;
        startOffset = clip.offset + timeIntoClip;
        duration = clip.duration - (timeIntoClip / rate);
    }
    
    if (duration > 0 && startOffset < source.buffer.duration) {
        source.start(this.ctx.currentTime + startWhen, startOffset, duration);
        
        const now = this.ctx.currentTime + startWhen;
        const fadeInDur = clip.fx.fadeIn || 0.005;
        clipGain.gain.setValueAtTime(0, now);
        clipGain.gain.linearRampToValueAtTime(clip.fx.gain, now + fadeInDur);
        
        const fadeOutDur = clip.fx.fadeOut || 0.005;
        const endTime = now + (duration / rate);
        clipGain.gain.setValueAtTime(clip.fx.gain, endTime - fadeOutDur);
        clipGain.gain.linearRampToValueAtTime(0, endTime);

        const resource: ActiveClipResource = {
            source,
            gain: clipGain, pan: clipPan
        };
        this.activeClipResources.set(clip.id, resource);
        
        source.onended = () => {
             this.activeClipResources.delete(clip.id);
        };
    }
  }

  updateClipParams(clipId: string, fx: Partial<ClipFX>) {
      const res = this.activeClipResources.get(clipId);
      if (!res) return; 

      const t = this.ctx.currentTime;
      const ramp = 0.05;

      if (typeof fx.gain === 'number') this.safeSet(res.gain.gain, fx.gain, t, ramp);
      if (typeof fx.pan === 'number') this.safeSet(res.pan.pan, Math.max(-1, Math.min(1, fx.pan)), t, ramp);
      if (typeof fx.pitch === 'number') this.safeSet(res.source.playbackRate, Math.max(0.1, fx.pitch), t, ramp);
  }

  stopAll() {
    this.activeClipResources.forEach(r => { try { r.source.stop(); } catch(e){} });
    this.activeClipResources.clear();
  }

  async initMicrophone(): Promise<void> {
      if (this.stream && this.stream.active && this.stream.getAudioTracks().some(t => t.readyState === 'live')) {
          return;
      }
      this.stream = null;
      await this.resume();

      if (!navigator?.mediaDevices?.getUserMedia) {
          throw new Error("Microphone API not supported in this browser/environment");
      }

      try {
          this.stream = await navigator.mediaDevices.getUserMedia({ 
              audio: { 
                  echoCancellation: false, 
                  autoGainControl: false, 
                  noiseSuppression: false 
              }
          });
      } catch (err: any) {
          // If advanced constraints failed (e.g. OverconstrainedError or TypeError), try basic audio request
          if (err?.name === 'OverconstrainedError' || err?.name === 'TypeError') {
              try {
                  this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                  return;
              } catch (fallbackErr) {
                  this.stream = null;
                  throw fallbackErr;
              }
          }
          this.stream = null;
          throw err;
      }
  }

  connectInputToTrack(trackId: string) {
      if (!this.stream || !this.stream.active) return;
      const ch = this.trackChannels.get(trackId);
      if (!ch) return;
      
      // Disconnect previous if it exists
      if (this.micSourceNode) {
          try { this.micSourceNode.disconnect(); } catch (e) {}
          this.micSourceNode = null;
      }
      
      try {
          this.micSourceNode = this.ctx.createMediaStreamSource(this.stream);
          this.micSourceNode.connect(ch.input);
      } catch (e) {
          console.warn("Could not connect microphone stream to track:", e);
      }
  }

  disconnectInput() {
      if (this.micSourceNode) {
          try { this.micSourceNode.disconnect(); } catch (e) {}
          this.micSourceNode = null;
      }
  }

  async startRecording(): Promise<void> {
    if (!this.stream || !this.stream.active) {
        await this.initMicrophone();
    }
    if (!this.stream) throw new Error("No active microphone stream available");

    const mimeTypes = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'];
    let chosenMime: string | undefined;
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported) {
        chosenMime = mimeTypes.find(t => MediaRecorder.isTypeSupported(t));
    }

    try {
        const options: MediaRecorderOptions = {
            ...(chosenMime ? { mimeType: chosenMime } : {}),
            audioBitsPerSecond: 256000
        };
        this.mediaRecorder = new MediaRecorder(this.stream, options);
    } catch (e) {
        this.mediaRecorder = new MediaRecorder(this.stream);
    }
    
    this.mediaRecorder.start();
  }

  async stopRecording(): Promise<Blob> {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder || this.mediaRecorder.state === 'inactive') return reject(new Error('Recorder inactive'));
      const chunks: BlobPart[] = [];
      this.mediaRecorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) chunks.push(e.data);
      };
      this.mediaRecorder.onstop = () => {
        const type = this.mediaRecorder?.mimeType || 'audio/webm';
        const blob = new Blob(chunks, { type });
        resolve(blob);
      };
      this.mediaRecorder.stop();
    });
  }

  async decodeAudioData(blob: Blob): Promise<AudioBuffer> {
    const buf = await blob.arrayBuffer();
    if (buf.byteLength === 0) {
      throw new Error("Audio buffer is empty");
    }
    return new Promise((resolve, reject) => {
      this.ctx.decodeAudioData(
        buf,
        (decoded) => resolve(decoded),
        (err) => reject(err || new Error("Failed to decode audio data"))
      );
    });
  }
  
  startBounceRecorder(): void {
      const stream = this.exportDest.stream;
      const audioBitsPerSecond = 320000; 
      
      let options: any = { 
          mimeType: 'audio/webm;codecs=opus', 
          audioBitsPerSecond 
      };
      
      if (MediaRecorder.isTypeSupported('audio/mp4')) {
          options = { mimeType: 'audio/mp4', audioBitsPerSecond };
      } else if (!MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
          options = { audioBitsPerSecond };
      }
      
      try { 
          this.mediaRecorder = new MediaRecorder(stream, options); 
      } catch (e) { 
          this.mediaRecorder = new MediaRecorder(stream); 
      }
      this.mediaRecorder.start();
  }
  
  async stopBounceRecorder(): Promise<Blob> {
      return new Promise((resolve, reject) => {
          if (!this.mediaRecorder || this.mediaRecorder.state === 'inactive') return reject('No active export');
          const chunks: BlobPart[] = [];
          this.mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
          this.mediaRecorder.onstop = () => {
              const type = this.mediaRecorder?.mimeType || 'audio/mp4';
              const blob = new Blob(chunks, { type });
              resolve(blob);
          };
          this.mediaRecorder.stop();
      });
  }

  private generateImpulseResponse() {
    const rate = this.ctx.sampleRate;
    const length = rate * 1.5;
    const impulse = this.ctx.createBuffer(2, length, rate);
    const L = impulse.getChannelData(0);
    const R = impulse.getChannelData(1);
    for (let i = 0; i < length; i++) {
        const decay = Math.pow(1 - i / length, 4);
        L[i] = (Math.random() * 2 - 1) * decay;
        R[i] = (Math.random() * 2 - 1) * decay;
    }
    this.reverbNode.buffer = impulse;
  }
}

export const audioEngine = new AudioEngine();
