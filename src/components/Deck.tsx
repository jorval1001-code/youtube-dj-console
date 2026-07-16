import React, { useEffect, useState, useRef } from "react";
import { Play, Pause, RotateCcw, Zap, Flame, Compass, RefreshCw, VolumeX, ShieldAlert, AlertCircle, ArrowUpRight, Monitor } from "lucide-react";
import { DJTrack } from "../types";

interface DeckProps {
  id: "A" | "B";
  track: DJTrack | null;
  isPlaying: boolean;
  videoError?: boolean;
  onPlayPause: () => void;
  onLoadTrack: () => void;
  onResetTrack: () => void;

  // Pitch / speed
  pitch: number; // -10 to +10 (percent tempo adjustment)
  setPitch: (p: number) => void;

  // Volume & Sync callbacks
  effectiveVolume: number;
  syncBpm: () => void;
  otherDeckBpm: number;

  // External reference to control YouTube player
  playerRef: React.MutableRefObject<any>;

  // Multi-window Dual Screen options
  screenMode: 'local' | 'external';
  setScreenMode: (mode: 'local' | 'external') => void;
  externalCurrentTime?: number;
  externalDuration?: number;
  onSeek?: (time: number) => void;
  onLoopChange?: (active: boolean, start: number, end: number, beats: number | null) => void;

  // Emergency offline fallback: load a local MP3 straight into this deck
  emergencyAudioRef: React.MutableRefObject<HTMLAudioElement | null>;
  onLoadEmergencyFile: (file: File) => void;
}

export const Deck: React.FC<DeckProps> = ({
  id,
  track,
  isPlaying,
  videoError,
  onPlayPause,
  onLoadTrack,
  onResetTrack,
  pitch,
  setPitch,
  effectiveVolume,
  syncBpm,
  otherDeckBpm,
  playerRef,
  screenMode,
  setScreenMode,
  externalCurrentTime,
  externalDuration,
  onSeek,
  onLoopChange,
  emergencyAudioRef,
  onLoadEmergencyFile
}) => {
  const emergencyFileInputRef = useRef<HTMLInputElement>(null);
  const playerContainerId = `youtube-player-container-${id}`;
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [cuePoint, setCuePoint] = useState<number | null>(null);
  const [hotCues, setHotCues] = useState<(number | null)[]>([null, null, null, null]);
  const [loopActive, setLoopActive] = useState<boolean>(false);
  const [loopLengthBeats, setLoopLengthBeats] = useState<number | null>(null);
  const [loopRange, setLoopRange] = useState<{ start: number; end: number } | null>(null);

  // Jog wheel rotation & drag states
  const [rotation, setRotation] = useState(0);
  const isDraggingJog = useRef(false);
  const dragStartAngle = useRef(0);
  const currentRotationRef = useRef(0);

  // Simulated Waveform - generated deterministically from track ID
  const [waveformBars, setWaveformBars] = useState<number[]>([]);

  // Unified Seek Helper (local player vs. external tab)
  const doSeek = (newTime: number) => {
    const safeTime = Math.max(0, Math.min(duration || 9999, newTime));
    setCurrentTime(safeTime);
    if (screenMode === "local") {
      if (playerRef.current && typeof playerRef.current.seekTo === "function") {
        playerRef.current.seekTo(safeTime, true);
      }
    } else {
      if (onSeek) onSeek(safeTime);
    }
  };

  // Sync external playback states
  useEffect(() => {
    if (screenMode === "external" && externalCurrentTime !== undefined) {
      setCurrentTime(externalCurrentTime);
    }
  }, [screenMode, externalCurrentTime]);

  useEffect(() => {
    if (screenMode === "external" && externalDuration !== undefined) {
      setDuration(externalDuration);
    }
  }, [screenMode, externalDuration]);

  // Broadcast loop states when in external mode
  useEffect(() => {
    if (screenMode === "external" && onLoopChange) {
      onLoopChange(loopActive, loopRange?.start || 0, loopRange?.end || 0, loopLengthBeats);
    }
  }, [loopActive, loopRange, loopLengthBeats, screenMode]);

  // Generate waveform whenever track changes
  useEffect(() => {
    if (!track) {
      setWaveformBars([]);
      return;
    }
    // Generate deterministic array of 60 bars
    const bars: number[] = [];
    let seed = 0;
    const seedSource = track.isLocalFile ? track.title : track.youtubeId;
    for (let i = 0; i < seedSource.length; i++) {
      seed += seedSource.charCodeAt(i);
    }
    
    for (let i = 0; i < 70; i++) {
      const val = Math.abs(Math.sin(seed * (i + 1))) * 35 + 5;
      bars.push(Math.round(val));
    }
    setWaveformBars(bars);
  }, [track]);

  // Keep player volume in sync
  useEffect(() => {
    if (screenMode === "local" && playerRef.current && typeof playerRef.current.setVolume === "function") {
      playerRef.current.setVolume(effectiveVolume);
    }
  }, [effectiveVolume, playerRef, screenMode]);

  // Handle YouTube Playback speed matching
  useEffect(() => {
    if (screenMode === "local" && playerRef.current && typeof playerRef.current.setPlaybackRate === "function") {
      // Map pitch percent (-10% to +10%) to YouTube rates: 0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 2.0
      // 1.0 is neutral. A +10% is 1.10.
      const multiplier = 1 + pitch / 100;
      let rate = 1.0;
      if (multiplier <= 0.4) rate = 0.25;
      else if (multiplier <= 0.6) rate = 0.5;
      else if (multiplier <= 0.85) rate = 0.75;
      else if (multiplier <= 1.15) rate = 1.0;
      else if (multiplier <= 1.35) rate = 1.25;
      else if (multiplier <= 1.7) rate = 1.5;
      else rate = 2.0;

      playerRef.current.setPlaybackRate(rate);
    }
  }, [pitch, playerRef, screenMode]);

  // Jog Wheel spin animation (independent of local/external)
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isPlaying) {
      interval = setInterval(() => {
        if (!isDraggingJog.current) {
          const deltaRot = (1 + pitch / 100) * 4;
          currentRotationRef.current = (currentRotationRef.current + deltaRot) % 360;
          setRotation(currentRotationRef.current);
        }
      }, 100);
    }
    return () => clearInterval(interval);
  }, [isPlaying, pitch]);

  // Regular updates of state from active local YouTube Player
  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (screenMode === "local" && isPlaying && playerRef.current) {
      interval = setInterval(() => {
        if (typeof playerRef.current.getCurrentTime === "function") {
          const t = playerRef.current.getCurrentTime();
          const d = playerRef.current.getDuration() || 0;
          setCurrentTime(t);
          if (d > 0) setDuration(d);

          // Loop Handling
          if (loopActive && loopRange) {
            if (t >= loopRange.end) {
              playerRef.current.seekTo(loopRange.start, true);
              setCurrentTime(loopRange.start);
            }
          }
        }
      }, 100);
    }

    return () => clearInterval(interval);
  }, [isPlaying, loopActive, loopRange, playerRef, screenMode]);

  // Format seconds into digital display (MM:SS.CC)
  const formatTime = (secs: number) => {
    if (isNaN(secs)) return "00:00.00";
    const minutes = Math.floor(secs / 60);
    const seconds = Math.floor(secs % 60);
    const hundredths = Math.floor((secs % 1) * 100);
    return `${minutes.toString().padStart(2, "0")}:${seconds
      .toString()
      .padStart(2, "0")}.${hundredths.toString().padStart(2, "0")}`;
  };

  // Cue Button Logic (Pioneer style)
  const handleCue = () => {
    if (!playerRef.current && screenMode === "local") return;
    
    if (isPlaying) {
      // Pause, and go to previous cue point
      onPlayPause(); // toggles playing state off
      const targetTime = cuePoint !== null ? cuePoint : 0;
      doSeek(targetTime);
    } else {
      // If paused, jump to cue point. If none set, set cue point at current position!
      if (cuePoint === null) {
        setCuePoint(currentTime);
      } else {
        doSeek(cuePoint);
      }
    }
  };

  // Hot Cue trigger
  const handleHotCue = (index: number) => {
    if (!playerRef.current && screenMode === "local") return;

    if (hotCues[index] === null) {
      // Record Hot Cue at current time
      const newCues = [...hotCues];
      newCues[index] = currentTime;
      setHotCues(newCues);
    } else {
      // Jump to recorded Hot Cue
      const time = hotCues[index]!;
      doSeek(time);
      if (!isPlaying) {
        onPlayPause(); // auto resume play on jump
      }
    }
  };

  // Clear Hot Cue
  const clearHotCue = (e: React.MouseEvent, index: number) => {
    e.preventDefault(); // prevent default context menu on right click
    const newCues = [...hotCues];
    newCues[index] = null;
    setHotCues(newCues);
  };

  // Emergency MP3 fallback: user picked a local file from disk (no internet involved)
  const handleEmergencyFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onLoadEmergencyFile(file);
    }
    e.target.value = ""; // allow re-selecting the same file later
  };

  // Active loop helper (converts beats to seconds based on track BPM)
  const toggleBeatLoop = (beats: number) => {
    if (!track) return;

    if (loopActive && loopLengthBeats === beats) {
      // Turn off loop
      setLoopActive(false);
      setLoopLengthBeats(null);
      setLoopRange(null);
    } else {
      // Calculate loop duration in seconds: beats * (60 / BPM)
      // Modulate BPM based on current pitch
      const actualBpm = track.bpm * (1 + pitch / 100);
      const loopDurationSecs = beats * (60 / actualBpm);
      
      const start = currentTime;
      const end = start + loopDurationSecs;

      setLoopRange({ start, end });
      setLoopLengthBeats(beats);
      setLoopActive(true);
      
      // seek instantly to start if out of bounds (should be fine since we set start=currentTime)
      doSeek(start);
    }
  };

  // Jog Wheel Scratch/Nudge Interaction
  const handleJogMouseDown = (e: React.MouseEvent) => {
    if (!playerRef.current && screenMode === "local") return;
    isDraggingJog.current = true;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    dragStartAngle.current = Math.atan2(e.clientY - centerY, e.clientX - centerX);
    
    document.addEventListener("mousemove", handleJogMouseMove);
    document.addEventListener("mouseup", handleJogMouseUp);
  };

  const handleJogMouseMove = (e: MouseEvent) => {
    if (!isDraggingJog.current) return;
    if (!playerRef.current && screenMode === "local") return;

    const jogEl = document.getElementById(`jogwheel-${id}`);
    if (!jogEl) return;

    const rect = jogEl.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    const currentAngle = Math.atan2(e.clientY - centerY, e.clientX - centerX);
    let angleDiff = currentAngle - dragStartAngle.current;
    
    // Normalize angle difference
    if (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    if (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

    const degDiff = angleDiff * (180 / Math.PI);
    currentRotationRef.current = (currentRotationRef.current + degDiff) % 360;
    setRotation(currentRotationRef.current);
    
    // Scrub video time slightly based on nudge degree
    const secondsToScrub = degDiff * 0.05; // 0.05 seconds per degree of drag
    let newTime = currentTime + secondsToScrub;
    newTime = Math.max(0, Math.min(duration, newTime));
    
    doSeek(newTime);
    
    dragStartAngle.current = currentAngle;
  };

  const handleJogMouseUp = () => {
    isDraggingJog.current = false;
    document.removeEventListener("mousemove", handleJogMouseMove);
    document.removeEventListener("mouseup", handleJogMouseUp);
  };

  // Waveform Bar Click - direct video scrub
  const handleWaveformClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (duration === 0) return;
    if (!playerRef.current && screenMode === "local") return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percent = clickX / rect.width;
    const newTime = percent * duration;
    
    doSeek(newTime);
  };

  // Color theme selections based on Deck letter
  const themeColor = id === "A" ? "cyan" : "orange";
  const themeClass = id === "A" ? "text-cyan-400 border-cyan-500/50 bg-cyan-950/20" : "text-orange-400 border-orange-500/50 bg-orange-950/20";
  const neonGlowClass = id === "A" ? "shadow-[0_0_12px_rgba(6,182,212,0.4)]" : "shadow-[0_0_12px_rgba(249,115,22,0.4)]";
  const neonLedClass = id === "A" ? "bg-cyan-500 shadow-[0_0_8px_#06b6d4]" : "bg-orange-500 shadow-[0_0_8px_#f97316]";
  // Full literal class names (Tailwind can't statically detect classes built via `${themeColor}` interpolation)
  const cornerBorderClass = id === "A" ? "border-cyan-500/70" : "border-orange-500/70";
  const haloBorderClass = id === "A" ? "border-t-cyan-400" : "border-t-orange-400";

  const currentBpm = track ? (track.isLocalFile ? "N/A" : (track.bpm * (1 + pitch / 100)).toFixed(1)) : "0.0";

  return (
    <div className="@container bg-zinc-900 border border-zinc-800 rounded-2xl p-5 flex flex-col justify-between shadow-2xl relative overflow-hidden h-full" id={`deck-${id}`}>
      {/* Decorative vinyl grooves overlay */}
      <div className="absolute inset-0 bg-gradient-to-tr from-zinc-900 via-transparent to-zinc-950/40 pointer-events-none" />

      {/* Top Deck Stats Display */}
      <div className="flex justify-between items-center gap-4 mb-3 z-10 flex-wrap sm:flex-nowrap">
        <div className="flex items-center gap-2.5">
          <div className={`text-xs px-2 py-0.5 rounded-full font-mono font-bold border ${themeClass}`}>
            DECK {id}
          </div>
          
          {/* Dual-screen switcher layout */}
          <div className="flex items-center bg-zinc-950 p-0.5 rounded-lg border border-zinc-800 text-[9px] font-mono select-none">
            <button
              type="button"
              onClick={() => setScreenMode('local')}
              className={`px-1.5 py-0.5 rounded transition-all font-bold ${
                screenMode === 'local'
                  ? 'bg-zinc-850 text-white shadow'
                  : 'text-zinc-600 hover:text-zinc-400'
              }`}
              title="Mostrar video integrado"
            >
              CONSOLA
            </button>
            <button
              type="button"
              disabled={!!track?.isLocalFile}
              onClick={() => {
                setScreenMode('external');
                window.open(`${window.location.origin}${window.location.pathname}?player=${id}`, `dj_player_${id}`, 'width=800,height=450');
              }}
              className={`px-1.5 py-0.5 rounded transition-all font-bold flex items-center gap-0.5 ${
                track?.isLocalFile
                  ? 'text-zinc-700 cursor-not-allowed'
                  : screenMode === 'external'
                  ? id === 'A'
                    ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                    : 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                  : 'text-zinc-600 hover:text-zinc-400'
              }`}
              title={track?.isLocalFile ? "No disponible para archivos locales" : "Abrir reproductor en ventana o pestaña externa"}
            >
              POP-OUT ↗
            </button>
          </div>

          {/* Emergency offline fallback: load a local MP3 straight into this deck */}
          <button
            type="button"
            onClick={() => emergencyFileInputRef.current?.click()}
            className="flex items-center gap-1 px-1.5 py-1 rounded-lg border border-red-900/60 bg-red-950/20 text-red-400 hover:bg-red-950/40 hover:border-red-700 text-[9px] font-mono font-bold uppercase tracking-wider transition"
            title="Sin internet: cargar un MP3 local en este deck"
            id={`btn-emergency-${id}`}
          >
            <ShieldAlert className="w-3 h-3" />
            SIN INTERNET
          </button>
          <input
            ref={emergencyFileInputRef}
            type="file"
            accept="audio/*,.mp3"
            onChange={handleEmergencyFileChange}
            className="hidden"
            id={`input-emergency-${id}`}
          />
          <audio ref={emergencyAudioRef} className="hidden" id={`emergency-audio-${id}`} />
        </div>
        <div className="text-right">
          {track ? (
            <div className="font-bold text-zinc-200 truncate max-w-[160px]" title={`${track.title} - ${track.artist}`}>
              {track.title}
              <p className="text-[10px] text-zinc-500 font-normal">{track.artist}</p>
            </div>
          ) : (
            <span className="text-zinc-500 text-xs italic">Cargar pista...</span>
          )}
        </div>
      </div>

      {/* ================= TELEMETRY SCREEN & YOUTUBE PLAYER ================= */}
      <div className="grid grid-cols-1 @3xl:grid-cols-12 gap-3 mb-4 z-10" id={`screen-area-${id}`}>
        {/* Telemetry LED / Data Panel */}
        <div className="col-span-12 @3xl:col-span-4 bg-zinc-950 p-3 rounded-xl border border-zinc-800/80 font-mono text-[9px] flex flex-col justify-between h-40 shadow-inner">
          <div className="space-y-1">
            <div className="flex justify-between text-zinc-500">
              <span>STATUS</span>
              <span className={isPlaying ? "text-green-500 font-bold" : "text-amber-500"}>
                {isPlaying ? "ON AIR" : "STBY"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">BPM BASE</span>
              <span className="text-zinc-300 font-bold">{track ? (track.isLocalFile ? "N/A" : track.bpm) : "0"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">PITCH</span>
              <span className={pitch === 0 ? "text-zinc-400" : pitch > 0 ? "text-green-400" : "text-red-400"}>
                {pitch >= 0 ? "+" : ""}{pitch.toFixed(2)}%
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">ACTUAL BPM</span>
              <span className={`font-bold ${id === "A" ? "text-cyan-400" : "text-orange-400"}`}>
                {currentBpm}
              </span>
            </div>
          </div>

          <div className="border-t border-zinc-900 pt-1.5 space-y-1">
            <div className="flex justify-between">
              <span className="text-zinc-500">LOOP STAT</span>
              <span className={loopActive ? "text-green-500" : "text-zinc-500"}>
                {loopActive ? `${loopLengthBeats} BEAT` : "OFF"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">CUE SET</span>
              <span className={cuePoint !== null ? "text-yellow-500" : "text-zinc-500"}>
                {cuePoint !== null ? `${cuePoint.toFixed(1)}s` : "NONE"}
              </span>
            </div>
          </div>

          {/* Sync Button */}
          <button
            onClick={syncBpm}
            disabled={!track || track.isLocalFile || otherDeckBpm <= 0}
            className={`w-full py-1 text-[9px] font-mono font-bold tracking-widest text-center border rounded uppercase transition-all flex items-center justify-center gap-1 ${
              track && !track.isLocalFile && otherDeckBpm > 0
                ? "bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700 hover:text-white"
                : "bg-zinc-900 border-zinc-800 text-zinc-600 cursor-not-allowed"
            }`}
          >
            <RefreshCw className="w-2.5 h-2.5 animate-pulse" />
            SYNC (TO {otherDeckBpm.toFixed(0)})
          </button>
        </div>

        {/* Video Screen Area */}
        <div className="col-span-12 @3xl:col-span-8 relative aspect-video h-auto @3xl:h-40 bg-black rounded-xl overflow-hidden border-2 border-zinc-800 shadow-2xl" id={`screen-panel-${id}`}>
          {/* External Screen Mode Overlay Placeholder */}
          {screenMode === "external" && track && (
            <div className="absolute inset-0 bg-zinc-950/95 z-20 flex flex-col items-center justify-center p-3 text-center select-none">
              <div className="relative w-12 h-12 mb-2 flex items-center justify-center">
                <div className={`absolute inset-0 rounded-full border border-dashed ${id === 'A' ? 'border-cyan-500 animate-spin' : 'border-orange-500 animate-spin'} opacity-40`} style={{ animationDuration: "8s" }} />
                <div className={`w-8 h-8 rounded-full ${id === 'A' ? 'bg-cyan-500/10 text-cyan-400' : 'bg-orange-500/10 text-orange-400'} flex items-center justify-center border border-zinc-800`}>
                  <Monitor className="w-3.5 h-3.5 animate-pulse" />
                </div>
                {isPlaying && (
                  <div className="absolute -inset-1 rounded-full border border-green-500/30 animate-ping opacity-50" style={{ animationDuration: "2s" }} />
                )}
              </div>
              <div className="text-[9px] text-zinc-400 font-mono tracking-wider uppercase font-bold flex items-center gap-1">
                <span className={`w-1.5 h-1.5 rounded-full ${isPlaying ? 'bg-green-500 animate-pulse' : 'bg-zinc-600'}`} />
                PANTALLA EXTERNA v2
              </div>
              <button
                type="button"
                onClick={() => {
                  window.open(`${window.location.origin}${window.location.pathname}?player=${id}`, `dj_player_${id}`, 'width=800,height=450');
                }}
                className={`mt-2.5 px-2 py-0.5 text-[8px] font-mono border rounded tracking-wider uppercase transition flex items-center gap-0.5 ${themeClass} hover:opacity-80`}
              >
                <ArrowUpRight className="w-2.5 h-2.5" />
                FORZAR POP-OUT
              </button>
            </div>
          )}

          {/* Video Error Overlay — shown when the YouTube embed fails (embedding disabled, region
              blocked, removed, etc). Without this the deck just silently renders a black frame. */}
          {videoError && !track?.isLocalFile && (
            <div className="absolute inset-0 bg-red-950/90 z-20 flex flex-col items-center justify-center p-3 text-center select-none border border-red-900/40 gap-1.5">
              <AlertCircle className="w-8 h-8 text-red-400" />
              <span className="text-[9px] text-red-400 font-mono tracking-widest uppercase font-bold">
                VIDEO NO DISPONIBLE
              </span>
              <span className="text-[9px] text-zinc-300 font-mono truncate max-w-full px-2">
                {track?.title}
              </span>
              <button
                onClick={onLoadTrack}
                className={`mt-1 px-3 py-1 text-[10px] font-mono border rounded tracking-wider uppercase transition ${themeClass} hover:opacity-80`}
              >
                Elegir otro video
              </button>
            </div>
          )}

          {/* Emergency Local File Overlay (no video to render — this deck is running an offline MP3) */}
          {track?.isLocalFile && (
            <div className="absolute inset-0 bg-red-950/20 z-20 flex flex-col items-center justify-center p-3 text-center select-none border border-red-900/40">
              <ShieldAlert className={`w-8 h-8 text-red-400 ${isPlaying ? "animate-pulse" : ""}`} />
              <span className="text-[9px] text-red-400 font-mono tracking-widest uppercase font-bold mt-2">
                MODO EMERGENCIA • ARCHIVO LOCAL
              </span>
              <span className="text-[10px] text-zinc-300 font-mono mt-1 truncate max-w-full px-2">
                {track.title}
              </span>
              <span className="text-[8px] text-zinc-500 font-mono mt-1 uppercase">
                Sin conexión a YouTube requerida
              </span>
            </div>
          )}

          {/* Transparent click shield so dragging on the video does not break the iframe, but we can display custom visual indicators */}
          {!track && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-950/90 z-20 gap-2 p-4 text-center">
              <Compass className={`w-8 h-8 text-zinc-500 animate-spin`} />
              <span className="text-[10px] text-zinc-400 font-mono tracking-widest uppercase">
                CARGAR VIDEO DESDE LA PLAYLIST O BUSCADOR
              </span>
              <button
                onClick={onLoadTrack}
                className={`mt-2 px-3 py-1 text-[10px] font-mono border rounded tracking-wider uppercase transition ${themeClass} hover:opacity-80`}
              >
                Elegir Video
              </button>
            </div>
          )}

          {/* Real YouTube Player Frame */}
          <div className="w-full h-full" id={playerContainerId} />

          {/* Neon overlay corner frames */}
          <div className={`absolute top-2 left-2 w-3 h-3 border-t-2 border-l-2 ${cornerBorderClass} z-10`} />
          <div className={`absolute top-2 right-2 w-3 h-3 border-t-2 border-r-2 ${cornerBorderClass} z-10`} />
          <div className={`absolute bottom-2 left-2 w-3 h-3 border-b-2 border-l-2 ${cornerBorderClass} z-10`} />
          <div className={`absolute bottom-2 right-2 w-3 h-3 border-b-2 border-r-2 ${cornerBorderClass} z-10`} />

          {/* Video Title Ribbon */}
          {track && (
            <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent p-2 flex justify-between items-center z-10 pointer-events-none">
              <span className="text-[9px] font-mono font-bold text-white truncate max-w-[150px]">
                {track.title}
              </span>
              <span className="text-[8px] font-mono text-zinc-400">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ================= DIGITAL TIME & WAVEFORM DISPLAY ================= */}
      <div className="bg-zinc-950 p-2.5 rounded-xl border border-zinc-800/60 mb-4 z-10 font-mono" id={`waveform-container-${id}`}>
        <div className="flex justify-between items-center text-[10px] text-zinc-500 mb-1.5">
          <span className={`font-bold ${id === "A" ? "text-cyan-400" : "text-orange-400"}`}>
            {formatTime(currentTime)}
          </span>
          <div className="flex gap-2">
            {loopActive && <span className="bg-green-500/20 text-green-400 px-1 rounded text-[8px] border border-green-500/30">LOOP ACTIVE</span>}
            {cuePoint !== null && <span className="bg-yellow-500/20 text-yellow-400 px-1 rounded text-[8px] border border-yellow-500/30">CUE</span>}
          </div>
          <span className="text-zinc-400 font-bold">
            -{formatTime(Math.max(0, duration - currentTime))}
          </span>
        </div>

        {/* Deterministic Waveform */}
        <div
          onClick={handleWaveformClick}
          className="h-10 w-full flex items-end gap-[1.5px] cursor-pointer group relative bg-zinc-900/60 p-1 rounded border border-zinc-900/80 shadow-inner overflow-hidden"
          id={`waveform-${id}`}
        >
          {waveformBars.length > 0 ? (
            waveformBars.map((barHeight, idx) => {
              const barPercent = idx / waveformBars.length;
              const currentPercent = duration > 0 ? currentTime / duration : 0;
              const isPlayed = barPercent <= currentPercent;

              // Color active based on play head position
              let barColor = "bg-zinc-700 group-hover:bg-zinc-600";
              if (isPlayed) {
                barColor = id === "A" ? "bg-cyan-500 shadow-[0_0_4px_#06b6d4]" : "bg-orange-500 shadow-[0_0_4px_#f97316]";
              }

              // Highlight loop range if inside
              if (loopActive && loopRange && duration > 0) {
                const loopStartPercent = loopRange.start / duration;
                const loopEndPercent = loopRange.end / duration;
                if (barPercent >= loopStartPercent && barPercent <= loopEndPercent) {
                  barColor = "bg-green-500 shadow-[0_0_5px_#22c55e]";
                }
              }

              return (
                <div
                  key={idx}
                  className={`flex-1 transition-all rounded-t-sm ${barColor}`}
                  style={{ height: `${barHeight}%` }}
                />
              );
            })
          ) : (
            <div className="w-full h-full flex items-center justify-center text-[9px] text-zinc-600 tracking-widest uppercase">
              NO VIDEO LOADED
            </div>
          )}

          {/* Current playhead vertical line */}
          {duration > 0 && (
            <div
              className="absolute top-0 bottom-0 w-[1.5px] bg-white z-10 shadow-[0_0_8px_white]"
              style={{ left: `${(currentTime / duration) * 100}%` }}
            />
          )}
        </div>
      </div>

      {/* ================= INTERACTIVE LOWER CONSOLE GRID ================= */}
      <div className="grid grid-cols-12 gap-3 items-center z-10" id={`controls-grid-${id}`}>
        {/* Hot Cue & Loop Grid (Left Side of control) */}
        <div className="col-span-12 @3xl:col-span-5 flex flex-col justify-between h-36" id={`hotcues-loops-${id}`}>
          {/* Hot Cue Buttons (1 - 4) */}
          <div className="grid grid-cols-4 gap-1.5">
            {hotCues.map((time, index) => {
              const isSet = time !== null;
              return (
                <button
                  key={index}
                  onClick={() => handleHotCue(index)}
                  onContextMenu={(e) => clearHotCue(e, index)}
                  className={`h-11 flex flex-col items-center justify-center text-[10px] font-mono font-bold rounded-lg border transition-all ${
                    isSet
                      ? id === "A"
                        ? "bg-cyan-500/20 text-cyan-400 border-cyan-400 shadow-[0_0_6px_rgba(6,182,212,0.3)]"
                        : "bg-orange-500/20 text-orange-400 border-orange-400 shadow-[0_0_6px_rgba(249,115,22,0.3)]"
                      : "bg-zinc-800/80 text-zinc-500 border-zinc-700/60 hover:text-zinc-300 hover:bg-zinc-750"
                  }`}
                  title={isSet ? `Jump to ${time.toFixed(1)}s (Right click to clear)` : `Record Hot Cue ${index + 1}`}
                >
                  <span className="text-[7px] text-zinc-600 block leading-tight">HOT</span>
                  {index + 1}
                </button>
              );
            })}
          </div>

          {/* Quick Loops (1, 2, 4, 8 beats) */}
          <div className="grid grid-cols-4 gap-1.5">
            {[1, 2, 4, 8].map((beats) => {
              const isActive = loopActive && loopLengthBeats === beats;
              return (
                <button
                  key={beats}
                  onClick={() => toggleBeatLoop(beats)}
                  className={`h-11 flex flex-col items-center justify-center text-[9px] font-mono font-bold rounded-lg border transition-all ${
                    isActive
                      ? "bg-green-500/20 text-green-400 border-green-500 shadow-[0_0_8px_rgba(34,197,94,0.3)]"
                      : "bg-zinc-800/80 text-zinc-500 border-zinc-700/60 hover:text-zinc-300 hover:bg-zinc-750"
                  }`}
                  title={`Loop ${beats} beats`}
                >
                  <span className="text-[7px] text-zinc-600 block leading-tight">BEAT</span>
                  {beats}x
                </button>
              );
            })}
          </div>
        </div>

        {/* Jog Wheel (Center of Deck control) */}
        <div className="col-span-7 @3xl:col-span-5 flex justify-center" id={`jogwheel-box-${id}`}>
          <div
            id={`jogwheel-${id}`}
            onMouseDown={handleJogMouseDown}
            className={`relative w-36 h-36 rounded-full bg-zinc-950 border-4 border-zinc-800 shadow-[0_15px_35px_rgba(0,0,0,0.9),_inset_0_4px_12px_rgba(255,255,255,0.04)] flex items-center justify-center cursor-grab active:cursor-grabbing select-none transition-all duration-300 ${
              id === "A" ? "hover:border-cyan-500/50" : "hover:border-orange-500/50"
            }`}
          >
            {/* Spinning Platter Container (all spinning graphics go here) */}
            <div
              className="absolute inset-1 rounded-full overflow-hidden flex items-center justify-center"
              style={{ transform: `rotate(${rotation}deg)` }}
            >
              {/* Concentric grooved vinyl lines */}
              <div className="absolute inset-0 rounded-full bg-[repeating-radial-gradient(circle_at_center,_#121214_0px,_#121214_1px,_#1a1a1e_2px,_#09090b_3px)] opacity-95" />
              
              {/* Subtle radial record grooves */}
              <div className="absolute inset-3 rounded-full border border-zinc-900/50" />
              <div className="absolute inset-6 rounded-full border border-zinc-900/60" />
              <div className="absolute inset-10 rounded-full border border-zinc-900/70" />
              <div className="absolute inset-14 rounded-full border border-zinc-900/80" />
              <div className="absolute inset-[74px] rounded-full border border-zinc-900" />

              {/* Slipmat marker stripes to clearly visualize spinning */}
              <div className={`absolute top-0 w-1.5 h-7 rounded-b ${id === "A" ? "bg-cyan-500 shadow-[0_0_8px_#06b6d4]" : "bg-orange-500 shadow-[0_0_8px_#f97316]"}`} />
              <div className="absolute bottom-0 w-1 h-5 bg-zinc-700/50 rounded-t" />
              <div className="absolute left-0 h-1 w-5 bg-zinc-700/50 rounded-r" />
              <div className="absolute right-0 h-1 w-5 bg-zinc-700/50 rounded-l" />

              {/* Center Colored Record Label Sticker */}
              <div className={`absolute w-14 h-14 rounded-full bg-zinc-900 border-2 ${id === "A" ? "border-cyan-500/40" : "border-orange-500/40"} flex items-center justify-center shadow-lg z-10`}>
                <div className="absolute inset-1 rounded-full bg-gradient-to-br from-zinc-800 to-zinc-950 flex flex-col items-center justify-center">
                  <div className={`text-[9px] font-mono font-black ${id === "A" ? "text-cyan-400" : "text-orange-400"}`}>
                    {id}
                  </div>
                  <div className="text-[5px] font-mono text-zinc-500 tracking-tighter scale-90">
                    {isPlaying ? "RUN" : "STOP"}
                  </div>
                </div>
              </div>
            </div>

            {/* STATIONARY METALLIC VINYL REFLECTION / SHINE OVERLAY */}
            {/* Since it's outside the rotating div, the reflections stay fixed in space, creating an insanely realistic 3D holographic vinyl look as the grooves spin underneath! */}
            <div className="pointer-events-none absolute inset-1 rounded-full bg-[conic-gradient(from_45deg_at_50%_50%,_transparent_0deg,_rgba(255,255,255,0.14)_30deg,_transparent_70deg,_transparent_120deg,_rgba(255,255,255,0.12)_150deg,_transparent_190deg,_transparent_220deg,_rgba(255,255,255,0.14)_250deg,_transparent_290deg,_transparent_330deg,_rgba(255,255,255,0.12)_340deg,_transparent_360deg)] opacity-85 mix-blend-screen z-10" />

            {/* Glowing Active Outer Halo */}
            {isPlaying && (
              <div
                className={`absolute inset-0 rounded-full border-2 border-transparent ${haloBorderClass} animate-spin pointer-events-none z-20`}
                style={{ animationDuration: "1.2s" }}
              />
            )}
            
            {/* Center Spindle Hole (Stationary, perfect hole) */}
            <div className="pointer-events-none absolute w-3 h-3 rounded-full bg-zinc-950 border border-zinc-850 shadow-[inset_0_2px_4px_black] z-30" />
          </div>
        </div>

        {/* Pitch / Tempo Fader Slider (Right Side of Deck control) */}
        <div className="col-span-5 @3xl:col-span-2 flex flex-col items-center h-36 justify-between relative" id={`pitch-fader-box-${id}`}>
          <div className="text-[7px] font-mono text-zinc-500 uppercase tracking-widest leading-none mb-1">TEMPO</div>
          
          <div className="relative h-[100px] w-5 flex items-center justify-center bg-zinc-950 rounded border border-zinc-800/80 shadow-inner cursor-pointer">
            {/* Scale lines */}
            <div className="absolute inset-y-1.5 left-0.5 flex flex-col justify-between text-[5px] font-mono text-zinc-700 select-none">
              <span>+</span><span>-</span>
            </div>
            {/* Slider track line */}
            <div className="w-[2px] h-20 bg-zinc-900 rounded" />
            {/* Slider range input */}
            <input
              type="range"
              min="-10"
              max="10"
              step="0.05"
              value={pitch}
              onChange={(e) => setPitch(Number(e.target.value))}
              className="absolute opacity-0 cursor-pointer"
              style={{
                // Sized as a horizontal slider before rotation (100px travel x 20px thickness),
                // then centered and rotated so its hit area lines up with the visible track.
                width: "100px",
                height: "20px",
                top: "50%",
                left: "50%",
                WebkitAppearance: "none",
                transform: "translate(-50%, -50%) rotate(270deg)",
              }}
            />
            {/* Sliding physical handle knob */}
            <div
              className="absolute w-4 h-2.5 bg-zinc-300 border-t border-b border-zinc-500 rounded shadow pointer-events-none"
              style={{
                bottom: `${((pitch + 10) / 20) * 80 + 10}%`,
                transform: "translateY(50%)"
              }}
            >
              <div className="w-full h-[1px] bg-red-600 top-1/2 absolute" />
            </div>
          </div>

          <div className="text-[8px] font-mono text-zinc-400 mt-1 font-bold">
            {pitch >= 0 ? "+" : ""}{pitch.toFixed(1)}%
          </div>
        </div>
      </div>

      {/* ================= PRIMARY TRANSCRIPTION & PERFORMANCE TRIGGERS ================= */}
      <div className="flex gap-4 items-center justify-start mt-4 border-t border-zinc-800/80 pt-4 z-10" id={`performance-buttons-${id}`}>
        {/* Play / Pause Toggle Button */}
        <button
          onClick={onPlayPause}
          className={`h-12 w-12 rounded-full border-2 flex items-center justify-center transition-all duration-150 shadow-lg ${
            isPlaying
              ? "bg-green-500/10 text-green-400 border-green-500 shadow-[0_0_12px_rgba(34,197,94,0.4)] hover:bg-green-500/20"
              : `bg-zinc-800 text-zinc-400 border-zinc-700 hover:bg-zinc-700 hover:text-white`
          }`}
          title={isPlaying ? "Pause Track" : "Play Track"}
          id={`btn-play-${id}`}
        >
          {isPlaying ? (
            <Pause className="w-5 h-5 fill-current" />
          ) : (
            <Play className="w-5 h-5 fill-current ml-0.5" />
          )}
        </button>

        {/* Pioneer DJ CDJ-style Cue Button */}
        <button
          onClick={handleCue}
          className={`h-12 w-12 rounded-full border-2 flex flex-col items-center justify-center text-[9px] font-mono font-bold transition-all duration-150 shadow-lg ${
            cuePoint !== null
              ? "bg-yellow-500/10 text-yellow-400 border-yellow-500 shadow-[0_0_12px_rgba(234,179,8,0.4)] hover:bg-yellow-500/20"
              : "bg-zinc-800 text-zinc-400 border-zinc-700 hover:bg-zinc-700 hover:text-white"
          }`}
          title="Back to Cue Point (Pause first to jump)"
          id={`btn-cue-point-${id}`}
        >
          CUE
        </button>

        {/* Reset Video Button */}
        <button
          onClick={onResetTrack}
          className="h-10 px-3 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-400 hover:text-zinc-200 text-xs rounded-xl flex items-center gap-1.5 transition"
          title="Eject Video"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Eject
        </button>

        <div className="flex-1 text-right">
          <span className="text-[8px] font-mono text-zinc-600 block uppercase">ENGINE STATE</span>
          <span className="text-[9px] font-mono font-black text-zinc-400">READY</span>
        </div>
      </div>
    </div>
  );
};
