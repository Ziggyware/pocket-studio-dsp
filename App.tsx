
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { audioEngine } from './services/audioEngine';
import { storageService } from './services/storageService';
import { Controls } from './components/Controls';
import { TrackLane } from './components/TrackLane';
import { ChannelStrip } from './components/ChannelStrip';
import { DSPRack } from './components/DSPRack';
import { ClipInspector } from './components/ClipInspector';
import { BackgroundInterference } from './components/BackgroundInterference';
import { ProjectInfoPanel } from './components/ProjectInfoPanel';
import { CreditsModal } from './components/CreditsModal';
import { LogConsole } from './components/LogConsole';
import { Track, AudioClip, EditMode, DSPState, TrackFX, ProjectMetadata, ClipViewConfig, ViewSettings, Notification, ClipFX } from './types';
import { COLORS, TRACK_HEIGHT, EXPANDED_TRACK_HEIGHT, CHANNEL_WIDTH_DEFAULT, CHANNEL_WIDTH_EXPANDED, CHANNEL_WIDTH_COLLAPSED } from './constants';

const DEFAULT_TRACK_FX: TrackFX = {
    compressorThreshold: 0, compressorRatio: 1, compressorAttack: 0.003, compressorRelease: 0.25,
    highPassFreq: 20, eqLow: 0, eqMid: 0, eqHigh: 0,
    saturation: 0,
    sendReverb: 0, sendDelay: 0,
};

const DEFAULT_CLIP_FX: ClipFX = {
    gain: 1.0, pitch: 1.0, pan: 0, isReversed: false,
    fadeIn: 0.01, fadeOut: 0.01
};

const DEFAULT_VIEW_CONFIG: ClipViewConfig = {
    mode: 'PCM',
    resolution: 2, 
    scale: 1.0
};

const App: React.FC = () => {
  // State
  const [tracks, setTracks] = useState<Track[]>([
    { id: 't1', name: 'Track 1', color: COLORS[0], muted: false, solo: false, armed: true, volume: 0.8, pan: 0, fx: {...DEFAULT_TRACK_FX}, isExpanded: false }
  ]);
  const [clips, setClips] = useState<AudioClip[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0); 
  const [zoom, setZoom] = useState(100); 
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [snapTime, setSnapTime] = useState<number | null>(null);
  const [viewSettings, setViewSettings] = useState<ViewSettings>({ showTransport: true, showMix: true, showRack: true, isCollapsed: false });
  const [clipClipboard, setClipClipboard] = useState<AudioClip | null>(null);
  const [loopRange, setLoopRange] = useState<{ start: number, end: number } | null>(null);
  const [isLooping, setIsLooping] = useState(false);
  const [editMode, setEditMode] = useState<EditMode>(EditMode.MOVE);
  const [metadata, setMetadata] = useState<ProjectMetadata>({ title: 'New Project', artist: 'Artist', album: '', year: new Date().getFullYear().toString() });
  const [showInfoPanel, setShowInfoPanel] = useState(false);
  const [showCredits, setShowCredits] = useState(true);
  const [showLogs, setShowLogs] = useState(false); 
  const [isExporting, setIsExporting] = useState(false);
  const [dspState, setDspState] = useState<DSPState>({ 
      masterVolume: 1.0, masterFilterFreq: 20000, masterFilterRes: 0, masterFilterBypass: false,
      masterEqLow: 0, masterEqMid: 0, masterEqHigh: 0, masterEqBypass: false,
      masterSaturation: 0, masterSaturationBypass: false,
      masterCompressorThreshold: 0, masterCompressorRatio: 1, masterCompressorBypass: false,
      delayTime: 0.3, delayFeedback: 0.3, reverbMix: 0.2, masterSpatialBypass: false, limiterThreshold: -1.0, reverbDecay: 2.0
  });
  const [isRecording, setIsRecording] = useState(false);
  const [monitor, setMonitor] = useState(false);
  
  // Notification System State
  const [notifications, setNotifications] = useState<Notification[]>([]);

  // Refs
  const rafRef = useRef<number>();
  const startTimeRef = useRef<number>(0); 
  const startOffsetRef = useRef<number>(0); 
  const recordingStartRef = useRef<number>(0); 
  const dragRef = useRef<{ clipId: string; startX: number; originalStart: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const pinchStartRef = useRef<{ dist: number, zoom: number } | null>(null);

  const addNotification = (message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') => {
      setNotifications(prev => [...prev, { id: Date.now().toString(), message, type, timestamp: Date.now() }]);
  };

  // --- Layout Calculation ---
  const isAnyExpanded = tracks.some(t => t.isExpanded);
  const currentChannelWidth = viewSettings.isCollapsed ? CHANNEL_WIDTH_COLLAPSED : (isAnyExpanded ? CHANNEL_WIDTH_EXPANDED : CHANNEL_WIDTH_DEFAULT);

  // --- Initialization ---
  useEffect(() => {
    storageService.init();
    const handleTouch = () => audioEngine.resume();
    document.addEventListener('touchstart', handleTouch, { once: true });
    document.addEventListener('click', handleTouch, { once: true });
    tracks.forEach(t => audioEngine.ensureTrackChannel(t));
    addNotification('SYSTEM ONLINE. AUDIO ENGINE READY.', 'success');
    return () => cancelAnimationFrame(rafRef.current!);
  }, []);

  useEffect(() => { tracks.forEach(t => audioEngine.updateTrackState(t)); }, [tracks]);
  useEffect(() => { audioEngine.updateMasterDSP(dspState); }, [dspState]);

  // --- Monitoring Logic ---
  // Memoize the armed track ID to prevent re-running effect on every track update (e.g. volume change)
  const armedTrackId = tracks.find(t => t.armed)?.id;

  useEffect(() => {
      if (armedTrackId && (monitor || isRecording)) {
          audioEngine.initMicrophone()
            .then(() => {
                if (monitor) {
                    audioEngine.connectInputToTrack(armedTrackId);
                } else {
                    audioEngine.disconnectInput();
                }
            })
            .catch((err: any) => {
                const errMsg = err?.message || err?.name || 'Permission dismissed';
                if (monitor) setMonitor(false);
                if (isRecording) setIsRecording(false);

                const isPermissionDismissed = 
                    errMsg.toLowerCase().includes('dismiss') || 
                    err?.name === 'NotAllowedError' || 
                    err?.name === 'PermissionDeniedError';

                if (isPermissionDismissed) {
                    addNotification('MIC PROMPT DISMISSED / BLOCKED: ALLOW MIC IN BROWSER', 'warning');
                } else {
                    addNotification(`MIC NOTICE: ${errMsg}`, 'error');
                }
            });
      } else {
          audioEngine.disconnectInput();
      }
  }, [monitor, isRecording, armedTrackId]); 

  // --- Keyboard Shortcuts ---
  useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
          if (e.target instanceof HTMLInputElement) return; 
          
          switch(e.key) {
              case ' ': 
                  e.preventDefault(); 
                  togglePlay(); 
                  break;
              case 's':
              case 'S':
                  if(selectedClipId) splitClip(selectedClipId, currentTime);
                  else if (isPlaying) addNotification('SELECT CLIP TO SPLIT', 'warning');
                  break;
              case 'Delete':
              case 'Backspace':
                  if(selectedClipId) deleteSelectedClip();
                  break;
              case 'c':
                  if ((e.ctrlKey || e.metaKey) && selectedClipId) handleCopy();
                  break;
              case 'v':
                  if (e.ctrlKey || e.metaKey) handlePaste();
                  break;
              case 'd':
                  if ((e.ctrlKey || e.metaKey) && selectedClipId) {
                      e.preventDefault();
                      const clip = clips.find(c => c.id === selectedClipId);
                      if (clip) handleDuplicateTrack(clip.trackId);
                  }
                  break;
          }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedClipId, currentTime, isPlaying, clipClipboard, clips]); 

  const calculateSnap = (time: number, zoomLevel: number): number => {
      let gridSize = 1.0;
      if (zoomLevel > 150) gridSize = 0.25;
      if (zoomLevel > 300) gridSize = 0.1;
      const snapped = Math.round(time / gridSize) * gridSize;
      const pixelDiff = Math.abs(snapped - time) * zoomLevel;
      if (pixelDiff < 15) return snapped;
      return time;
  };

  const restartPlayback = async (startAt: number) => {
    audioEngine.stopAll();
    setCurrentTime(startAt);
    startTimeRef.current = audioEngine.ctx.currentTime;
    startOffsetRef.current = startAt;
    clips.forEach(clip => {
      const track = tracks.find(t => t.id === clip.trackId);
      if (track && !track.muted && (!tracks.some(t => t.solo) || track.solo)) audioEngine.playClip(clip, startAt);
    });
  };

  const updatePlayhead = useCallback(() => {
    if (audioEngine.ctx.state === 'running' && isPlaying) {
        const elapsed = audioEngine.ctx.currentTime - startTimeRef.current;
        const newTime = startOffsetRef.current + elapsed;
        if (isLooping && loopRange && newTime >= loopRange.end) {
            restartPlayback(loopRange.start);
        } else if (isExporting) {
            const maxDuration = Math.max(...clips.map(c => c.startTime + c.duration)) + 2.0;
            if (newTime >= maxDuration) finishExport();
            else setCurrentTime(newTime);
        } else {
            setCurrentTime(newTime);
        }
    }
    rafRef.current = requestAnimationFrame(updatePlayhead);
  }, [isPlaying, isLooping, loopRange, isExporting, clips]);

  useEffect(() => {
    if (isPlaying) rafRef.current = requestAnimationFrame(updatePlayhead);
    else cancelAnimationFrame(rafRef.current!);
  }, [isPlaying, updatePlayhead]);

  const togglePlay = async () => {
    await audioEngine.resume();
    if (isPlaying) {
      audioEngine.stopAll();
      setIsPlaying(false);
      const elapsed = audioEngine.ctx.currentTime - startTimeRef.current;
      const newTime = startOffsetRef.current + elapsed;
      setCurrentTime(newTime);
      startOffsetRef.current = newTime;
    } else {
      startTimeRef.current = audioEngine.ctx.currentTime;
      startOffsetRef.current = currentTime; 
      clips.forEach(clip => {
        const track = tracks.find(t => t.id === clip.trackId);
        if (track && !track.muted && (!tracks.some(t => t.solo) || track.solo)) audioEngine.playClip(clip, currentTime);
      });
      setIsPlaying(true);
    }
  };

  const handleCopy = () => { if (!selectedClipId) return; const clip = clips.find(c => c.id === selectedClipId); if (clip) { setClipClipboard(clip); addNotification('CLIP COPIED TO BUFFER', 'info'); } };
  const handlePaste = () => { if (!clipClipboard) return; let targetTrackId = tracks[0].id; if (selectedClipId) { const selected = clips.find(c => c.id === selectedClipId); if (selected) targetTrackId = selected.trackId; } const newClip: AudioClip = { ...clipClipboard, id: Date.now().toString() + Math.random().toString().slice(2,5), startTime: currentTime, trackId: targetTrackId }; setClips(prev => [...prev, newClip]); setSelectedClipId(newClip.id); addNotification('BUFFER PASTED AT PLAYHEAD', 'success'); };
  const handleToggleLoop = () => { setIsLooping(prev => { const newState = !prev; addNotification(newState ? 'LOOP ENABLED' : 'LOOP DISABLED', 'info'); return newState; }); };
  const handleSetLoopIn = () => { setLoopRange(prev => { const end = prev ? prev.end : currentTime + 4; if (currentTime >= end) { addNotification('INVALID LOOP RANGE', 'warning'); return prev; } addNotification(`LOOP IN: ${currentTime.toFixed(2)}s`, 'success'); return { start: currentTime, end }; }); setIsLooping(true); };
  const handleSetLoopOut = () => { setLoopRange(prev => { const start = prev ? prev.start : Math.max(0, currentTime - 4); if (currentTime <= start) { addNotification('INVALID LOOP RANGE', 'warning'); return prev; } addNotification(`LOOP OUT: ${currentTime.toFixed(2)}s`, 'success'); return { start, end: currentTime }; }); setIsLooping(true); };
  const handleTrackUpdate = (trackId: string, updates: Partial<Track>) => { setTracks(prev => prev.map(t => t.id === trackId ? { ...t, ...updates } : t)); };
  const toggleTrackArm = (trackId: string) => setTracks(prev => prev.map(t => ({ ...t, armed: t.id === trackId })));
  const toggleTrackExpand = (trackId: string) => setTracks(prev => prev.map(t => ({ ...t, isExpanded: t.id === trackId ? !t.isExpanded : false })));
  const handleDuplicateTrack = (trackId: string) => { const originalTrack = tracks.find(t => t.id === trackId); if (!originalTrack) return; const newTrackId = Date.now().toString(); const newTrack: Track = { ...originalTrack, id: newTrackId, name: originalTrack.name + ' (Copy)', isExpanded: false }; const originalClips = clips.filter(c => c.trackId === trackId); const newClips = originalClips.map(c => ({ ...c, id: c.id + '_copy_' + Math.random().toString().slice(2,5), trackId: newTrackId })); const index = tracks.findIndex(t => t.id === trackId); const newTracks = [...tracks]; newTracks.splice(index + 1, 0, newTrack); setTracks(newTracks); setClips(prev => [...prev, ...newClips]); audioEngine.ensureTrackChannel(newTrack); addNotification('TRACK DUPLICATION COMPLETE', 'success'); };
  
  const handleAddTrack = () => {
      const newTrackId = Date.now().toString();
      const newTrack: Track = { id: newTrackId, name: `Track ${tracks.length + 1}`, color: COLORS[tracks.length % COLORS.length], muted: false, solo: false, armed: false, volume: 0.8, pan: 0, fx: {...DEFAULT_TRACK_FX}, isExpanded: false };
      setTracks(prev => [...prev, newTrack]);
      audioEngine.ensureTrackChannel(newTrack);
      addNotification('TRACK ADDED', 'success');
  };

  const handleDeleteTrack = (trackId: string) => {
      setTracks(prev => prev.filter(t => t.id !== trackId));
      setClips(prev => prev.filter(c => c.trackId !== trackId));
      if (selectedClipId && clips.find(c => c.id === selectedClipId)?.trackId === trackId) {
          setSelectedClipId(null);
      }
      addNotification('TRACK DELETED', 'info');
  };
  const handleExport = async (format: 'mp4') => { if (isPlaying) await togglePlay(); setIsExporting(true); addNotification('STARTING REAL-TIME EXPORT...', 'info'); audioEngine.startBounceRecorder(); startTimeRef.current = audioEngine.ctx.currentTime; startOffsetRef.current = 0; setCurrentTime(0); clips.forEach(clip => { const track = tracks.find(t => t.id === clip.trackId); if (track && !track.muted && (!tracks.some(t => t.solo) || track.solo)) audioEngine.playClip(clip, 0); }); setIsPlaying(true); };
  
  const finishExport = async () => { 
      setIsPlaying(false); 
      audioEngine.stopAll(); 
      const blob = await audioEngine.stopBounceRecorder(); 
      setIsExporting(false); 
      setShowInfoPanel(false); 
      
      const url = URL.createObjectURL(blob); 
      const a = document.createElement('a'); 
      a.style.display = 'none'; 
      a.href = url; 
      
      const cleanTitle = metadata.title.replace(/[^a-z0-9]/gi, '_').toLowerCase(); 
      const ext = blob.type.includes('mp4') ? 'mp4' : 'webm';
      a.download = `${cleanTitle}_bounce.${ext}`; 
      
      document.body.appendChild(a); 
      a.click(); 
      window.URL.revokeObjectURL(url); 
      addNotification('EXPORT COMPLETE. FILE SAVED.', 'success'); 
  };
  
  const stopRecordingAndSave = async () => {
    try {
      const blob = await audioEngine.stopRecording();
      setIsRecording(false);
      const id = Date.now().toString();
      await storageService.saveBlob(id, blob);
      const buffer = await audioEngine.decodeAudioData(blob);
      const armedTrack = tracks.find(t => t.armed) || tracks[0];
      const newClip: AudioClip = {
        id,
        trackId: armedTrack.id,
        buffer,
        startTime: recordingStartRef.current,
        duration: buffer.duration,
        offset: 0,
        name: `Rec ${id.substr(-4)}`,
        fx: { ...DEFAULT_CLIP_FX },
        viewConfig: { ...DEFAULT_VIEW_CONFIG }
      };
      setClips(prev => [...prev, newClip]);
      setSelectedClipId(id);
      addNotification(`RECORDING SAVED: ${newClip.name}`, 'success');
    } catch (err: any) {
      setIsRecording(false);
      console.warn("Save recording issue:", err);
      addNotification(`RECORDING SAVE FAILED: ${err?.message || 'EMPTY BUFFER'}`, 'error');
    }
  };

  const toggleRecord = async () => {
    if (isRecording) {
      await stopRecordingAndSave();
    } else {
      recordingStartRef.current = currentTime;
      try {
        await audioEngine.startRecording();
        setIsRecording(true);
        addNotification('RECORDING STARTED', 'warning');
        if (!isPlaying) await togglePlay();
      } catch (err: any) {
        setIsRecording(false);
        const errMsg = err?.message || err?.name || 'Permission dismissed';
        const isPermissionDismissed = 
            errMsg.toLowerCase().includes('dismiss') || 
            err?.name === 'NotAllowedError' || 
            err?.name === 'PermissionDeniedError';

        if (isPermissionDismissed) {
            addNotification('MIC PROMPT DISMISSED / BLOCKED: ALLOW MIC IN BROWSER TO RECORD', 'warning');
        } else {
            addNotification(`MICROPHONE INIT FAILED: ${errMsg}`, 'error');
        }
      }
    }
  };

  const handleImportAudio = async (file: File) => {
    try {
      addNotification(`IMPORTING ${file.name.toUpperCase()}...`, 'info');
      const buffer = await audioEngine.decodeAudioData(file);
      const id = Date.now().toString();
      await storageService.saveBlob(id, file);
      const armedTrack = tracks.find(t => t.armed) || tracks[0];
      const newClip: AudioClip = {
        id,
        trackId: armedTrack.id,
        buffer,
        startTime: currentTime,
        duration: buffer.duration,
        offset: 0,
        name: file.name.replace(/\.[^/.]+$/, "").slice(0, 16),
        fx: { ...DEFAULT_CLIP_FX },
        viewConfig: { ...DEFAULT_VIEW_CONFIG }
      };
      setClips(prev => [...prev, newClip]);
      setSelectedClipId(id);
      addNotification(`AUDIO IMPORTED: ${newClip.name}`, 'success');
    } catch (err: any) {
      console.error("Audio import error:", err);
      addNotification(`IMPORT FAILED: ${err?.message || 'INVALID AUDIO FILE'}`, 'error');
    }
  };
  const stop = async () => { audioEngine.stopAll(); setIsPlaying(false); if (isExporting) { audioEngine.stopBounceRecorder(); setIsExporting(false); addNotification('EXPORT CANCELLED', 'error'); return; } if (isRecording) { try { await stopRecordingAndSave(); } catch(e) { console.error("Error saving:", e); setIsRecording(false); } } const returnTime = isRecording ? recordingStartRef.current : (isLooping && loopRange ? loopRange.start : 0); setCurrentTime(returnTime); startOffsetRef.current = returnTime; };

  // --- Multi-Touch Pinch Zoom Logic ---
  const handleTouchStart = (e: React.TouchEvent) => {
      if (e.touches.length === 2) {
          const dist = Math.hypot(
              e.touches[0].clientX - e.touches[1].clientX,
              e.touches[0].clientY - e.touches[1].clientY
          );
          pinchStartRef.current = { dist, zoom };
          if (dragRef.current) {
              dragRef.current = null;
              setSnapTime(null); 
          }
      }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
      if (e.touches.length === 2 && pinchStartRef.current) {
          e.preventDefault(); 
          const dist = Math.hypot(
              e.touches[0].clientX - e.touches[1].clientX,
              e.touches[0].clientY - e.touches[1].clientY
          );
          const scale = dist / pinchStartRef.current.dist;
          const newZoom = Math.max(10, Math.min(1000, pinchStartRef.current.zoom * scale));
          setZoom(newZoom);
          return; 
      }
  };

  const handleTouchEnd = () => {
      if (pinchStartRef.current) {
         pinchStartRef.current = null;
      }
  };

  // --- Clip Interaction (Move/Split/Context) ---
  const handleClipInteract = (clipId: string, action: string, data?: any) => {
    if (action === 'context') {
        const { action: ctxAction } = data;
        if (ctxAction === 'copy') { setSelectedClipId(clipId); handleCopy(); }
        if (ctxAction === 'split') { splitClip(clipId, currentTime); }
        if (ctxAction === 'delete') { setSelectedClipId(clipId); deleteSelectedClip(); }
        if (ctxAction === 'reverse') {
             const c = clips.find(x => x.id === clipId);
             if (c) {
                handleClipFXUpdate(clipId, { isReversed: !c.fx.isReversed });
                addNotification(c.fx.isReversed ? 'CLIP NORMALIZED' : 'CLIP REVERSED', 'info');
             }
        }
        return;
    }
    if (action === 'tap') {
        setSelectedClipId(clipId);
        return;
    }
    if (editMode === EditMode.MOVE && action === 'start') {
      if (pinchStartRef.current) return;

      setSelectedClipId(clipId);
      dragRef.current = { clipId, startX: data.x, originalStart: data.originalStart };
      
      const handleMove = (e: any) => {
        if (e.touches && e.touches.length > 1) {
            dragRef.current = null; 
            return;
        }

        if (!dragRef.current || !containerRef.current) return;
        const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
        const deltaX = clientX - dragRef.current.startX;
        const deltaTime = deltaX / zoom; 
        
        let newStart = Math.max(0, dragRef.current.originalStart + deltaTime);
        
        const snappedStart = calculateSnap(newStart, zoom);
        if (Math.abs(snappedStart - newStart) * zoom < 15) {
            setSnapTime(snappedStart);
            newStart = snappedStart;
        } else {
            setSnapTime(null);
        }

        const containerRect = containerRef.current.getBoundingClientRect();
        const scrollY = containerRef.current.scrollTop;
        const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
        const relativeY = clientY - containerRect.top + scrollY;
        
        let accumulatedHeight = 0;
        let targetTrackId = null;
        for (const track of tracks) {
            const h = track.isExpanded ? EXPANDED_TRACK_HEIGHT : TRACK_HEIGHT;
            if (relativeY >= accumulatedHeight && relativeY < accumulatedHeight + h) {
                targetTrackId = track.id;
                break;
            }
            accumulatedHeight += h;
        }

        setClips(prev => prev.map(c => 
          c.id === dragRef.current?.clipId ? { 
              ...c, startTime: newStart, 
              trackId: targetTrackId || c.trackId 
          } : c
        ));
      };
      
      const handleEnd = () => {
        dragRef.current = null;
        setSnapTime(null);
        window.removeEventListener('touchmove', handleMove); window.removeEventListener('touchend', handleEnd);
        window.removeEventListener('mousemove', handleMove); window.addEventListener('mouseup', handleEnd);
      };
      window.addEventListener('touchmove', handleMove, { passive: false }); window.addEventListener('touchend', handleEnd);
      window.addEventListener('mousemove', handleMove); window.addEventListener('mouseup', handleEnd);
    }
  };

  const handleClipFXUpdate = (clipId: string, updates: Partial<AudioClip['fx']> | { viewConfig: any }) => {
      setClips(prev => prev.map(c => c.id === clipId ? { ...c, ...('viewConfig' in updates ? { viewConfig: updates.viewConfig } : { fx: { ...c.fx, ...updates } }) } : c));
      if (!('viewConfig' in updates)) audioEngine.updateClipParams(clipId, updates as Partial<typeof DEFAULT_CLIP_FX>);
  };

  const splitClip = (clipId: string, splitTimeOverride?: number) => {
    const clip = clips.find(c => c.id === clipId);
    if (!clip) return;
    const timeToSplitAt = splitTimeOverride !== undefined ? splitTimeOverride : currentTime;
    
    const snappedSplit = calculateSnap(timeToSplitAt, zoom);
    
    const relativeSplitTime = (snappedSplit - clip.startTime); 
    if (relativeSplitTime <= 0.01 || relativeSplitTime >= clip.duration - 0.01) {
        addNotification('CANNOT SPLIT: TOO CLOSE TO EDGE', 'error');
        return;
    }
    
    const clip1: AudioClip = { ...clip, id: clip.id + '_1', duration: relativeSplitTime };
    const clip2: AudioClip = { ...clip, id: clip.id + '_2', startTime: snappedSplit, duration: clip.duration - relativeSplitTime, offset: clip.offset + relativeSplitTime };
    setClips(prev => prev.filter(c => c.id !== clipId).concat([clip1, clip2]));
    setSelectedClipId(clip2.id);
    addNotification('CLIP SPLIT SUCCESSFUL', 'success');
  };

  const handleSplitButton = () => { if (selectedClipId) splitClip(selectedClipId, currentTime); else addNotification('NO CLIP SELECTED', 'error'); };
  const deleteSelectedClip = () => { if (selectedClipId) { setClips(prev => prev.filter(c => c.id !== selectedClipId)); setSelectedClipId(null); addNotification('CLIP DELETED', 'info'); }};

  const handleTimelineScrub = (e: any) => {
     if (e.target.dataset.bg) setSelectedClipId(null);
     if (!containerRef.current) return;
     const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
     const containerLeft = containerRef.current.getBoundingClientRect().left;
     const scrollLeft = containerRef.current.scrollLeft;
     const relativeX = clientX - containerLeft + scrollLeft;
     const rawTime = Math.max(0, (relativeX - currentChannelWidth) / zoom);
     const snappedTime = calculateSnap(rawTime, zoom);
     setCurrentTime(snappedTime);
     startOffsetRef.current = snappedTime;
  };

  const selectedClip = clips.find(c => c.id === selectedClipId);

  return (
    <div className="flex flex-col h-screen w-screen bg-transparent text-slate-100 overflow-hidden select-none font-sans relative">
      <BackgroundInterference />
      
      {/* Replaced NotificationSystem with LogConsole Toggle Logic */}
      {showLogs && <LogConsole logs={notifications} onClose={() => setShowLogs(false)} />}
      
      <div className="flex flex-col h-full w-full z-10 relative bg-black/10 backdrop-blur-[1px]">
        <Controls 
            isPlaying={isPlaying} isRecording={isRecording} isLooping={isLooping} loopRange={loopRange}
            onPlayPause={togglePlay} onRecord={toggleRecord} onStop={stop} onBounce={() => setShowInfoPanel(true)} 
            onDelete={deleteSelectedClip} onSplit={handleSplitButton} onCopy={handleCopy} onPaste={handlePaste}
            onToggleLoop={handleToggleLoop} onSetLoopIn={handleSetLoopIn} onSetLoopOut={handleSetLoopOut}
            onOpenInfo={() => setShowInfoPanel(true)} onShowCredits={() => setShowCredits(true)}
            onToggleLogs={() => setShowLogs(!showLogs)} // Wired Up
            onImportAudio={handleImportAudio}
            editMode={editMode} setEditMode={setEditMode} monitor={monitor} setMonitor={setMonitor}
            zoom={zoom} setZoom={setZoom} hasSelection={!!selectedClipId} hasClipboard={!!clipClipboard}
            viewSettings={viewSettings} setViewSettings={setViewSettings}
        />

        <div ref={containerRef} className="flex-1 overflow-y-auto overflow-x-auto relative mt-[60px] mb-[260px]" 
            onClick={() => setSelectedClipId(null)} data-bg="true"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }}
            onDrop={(e) => {
                e.preventDefault();
                const file = e.dataTransfer.files?.[0];
                if (file && file.type.startsWith('audio/')) {
                    handleImportAudio(file);
                } else if (file) {
                    handleImportAudio(file);
                }
            }}
        >
            
            {/* Snap Guide Line */}
            {snapTime !== null && (
                <div className="absolute top-0 bottom-0 border-l border-yellow-400 z-50 pointer-events-none opacity-80"
                     style={{ left: `${(snapTime * zoom) + currentChannelWidth}px` }}></div>
            )}

            {/* Playhead */}
            <div className="absolute top-0 bottom-0 z-40 pointer-events-none border-r border-cyan-500 shadow-[0_0_15px_rgba(6,182,212,0.6)]"
                style={{ left: `${(currentTime * zoom) + currentChannelWidth}px`, width: '1px' }}>
                <div className="absolute -top-4 -translate-x-1/2 bg-cyan-900 text-[9px] px-1.5 py-0.5 rounded-sm text-cyan-200 font-mono shadow-md whitespace-nowrap z-50 border border-cyan-500/50">
                    {currentTime.toFixed(2)}s
                </div>
                <div className="absolute top-0 bottom-0 w-px bg-cyan-500/50"></div>
            </div>

            {/* Ruler */}
            <div className="h-8 min-w-full bg-[#030305]/90 border-b border-white/10 relative cursor-pointer shadow-lg z-30 transition-all duration-300"
                style={{ width: `${Math.max(window.innerWidth, (300 * zoom) + currentChannelWidth)}px` }}
                onClick={(e) => { e.stopPropagation(); handleTimelineScrub(e); }}>
                {loopRange && (
                    <div className="absolute top-0 bottom-0 bg-blue-500/10 border-x border-blue-500/50 z-0"
                        style={{ left: `${loopRange.start * zoom + currentChannelWidth}px`, width: `${(loopRange.end - loopRange.start) * zoom}px` }}>
                    </div>
                )}
                {/* Adaptive Ticks */}
                {Array.from({ length: Math.ceil(300 * zoom / 100) * (zoom > 150 ? 8 : 4) }).map((_, i) => {
                    const step = zoom > 150 ? 0.125 : 0.25;
                    const sec = i * step;
                    const isMajor = Math.abs(sec % 1) < 0.001;
                    const isMedium = Math.abs(sec % 0.5) < 0.001;
                    let h = 'h-1 border-slate-700';
                    if (isMajor) h = 'h-3 border-slate-500';
                    else if (isMedium) h = 'h-2 border-slate-600';
                    return (
                    <div key={i} className={`absolute bottom-0 border-l z-10 pointer-events-none ${h}`} 
                        style={{ left: (sec * zoom) + currentChannelWidth }}>
                        {isMajor && <span className="text-[8px] font-mono font-medium text-slate-500 pl-1.5 -mt-4 block">{sec}</span>}
                    </div>
                )})}
            </div>

            {/* Tracks Container */}
            <div className="min-w-full pb-20 relative bg-transparent transition-all duration-300" style={{ width: `${Math.max(window.innerWidth, (300 * zoom) + currentChannelWidth)}px` }} data-bg="true">
            {tracks.map(track => (
                <div key={track.id} className="flex border-b border-white/5 bg-black/20" style={{ height: track.isExpanded ? EXPANDED_TRACK_HEIGHT : TRACK_HEIGHT }}>
                <ChannelStrip 
                    track={track} onUpdate={handleTrackUpdate} onToggleArm={toggleTrackArm} onToggleExpand={toggleTrackExpand} onDuplicate={handleDuplicateTrack} onDelete={handleDeleteTrack}
                    width={currentChannelWidth} viewSettings={viewSettings} isCollapsed={viewSettings.isCollapsed}
                />
                <div className="relative w-full z-10 flex-1 min-w-0">
                    <TrackLane track={track} clips={clips.filter(c => c.trackId === track.id)} editMode={editMode} selectedClipId={selectedClipId} onClipInteract={handleClipInteract} isPlaying={isPlaying} zoom={zoom} />
                </div>
                </div>
            ))}
            <div className="p-4 flex gap-4 sticky left-0" style={{ width: currentChannelWidth }}>
                <button onClick={handleAddTrack} className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded text-sm font-bold text-white transition-colors">+ Add Track</button>
            </div>
            </div>
        </div>

        {selectedClip ? (
            <ClipInspector clip={selectedClip} onUpdate={handleClipFXUpdate} onClose={() => setSelectedClipId(null)} />
        ) : (
            <DSPRack dspState={dspState} onChange={(s) => { setDspState(s); audioEngine.updateMasterDSP(s); }} />
        )}

        {showInfoPanel && (
            <ProjectInfoPanel metadata={metadata} onChange={setMetadata} onClose={() => !isExporting && setShowInfoPanel(false)} onExport={handleExport} isExporting={isExporting} />
        )}
        {showCredits && (
            <CreditsModal onClose={() => setShowCredits(false)} />
        )}
      </div>
    </div>
  );
};

export default App;
