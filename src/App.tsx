import { useState, useEffect, useRef } from "react";
import { Disc, Monitor, Settings, Sparkles, Volume2, Music, HelpCircle, AlertCircle, Search, Laptop, Layers, ArrowUpRight, VolumeX, EyeOff, Eye, Lock, User, Cpu, Send, CheckCircle, LogOut, Radio, Play, Pause } from "lucide-react";
import { DJTrack } from "./types";
import { PRESET_TRACKS } from "./data/tracks";
import { Deck } from "./components/Deck";
import { Mixer } from "./components/Mixer";
import { Library } from "./components/Library";
import { History, HistoryEntry } from "./components/History";

const LS_PLAYBACK_HISTORY_KEY = "ytdj_playback_history";
const MAX_HISTORY_ENTRIES = 60;

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: (() => void) | undefined;
  }
}

// Convert Pitch change to YouTube PlaybackRate multiplier
const calculatePlaybackRate = (ptch: number) => {
  const multiplier = 1 + ptch / 100;
  if (multiplier <= 0.4) return 0.25;
  if (multiplier <= 0.6) return 0.5;
  if (multiplier <= 0.85) return 0.75;
  if (multiplier <= 1.15) return 1.0;
  if (multiplier <= 1.35) return 1.25;
  if (multiplier <= 1.7) return 1.5;
  return 2.0;
};

// =========================================================================
//                   EXTERNAL PLAYER VIEW (PANTALLA EXTERNA)
// =========================================================================
interface ExternalPlayerViewProps {
  playerType: string; // "A" | "B" | "dual"
}

export function ExternalPlayerView({ playerType }: ExternalPlayerViewProps) {
  const [trackA, setTrackA] = useState<DJTrack | null>(null);
  const [trackB, setTrackB] = useState<DJTrack | null>(null);
  const [isPlayingA, setIsPlayingA] = useState(false);
  const [isPlayingB, setIsPlayingB] = useState(false);
  const [currentTimeA, setCurrentTimeA] = useState(0);
  const [currentTimeB, setCurrentTimeB] = useState(0);
  const [durationA, setDurationA] = useState(0);
  const [durationB, setDurationB] = useState(0);

  // EQ, gain & faders state for master output mix (applied to player volume)
  const [volA, setVolA] = useState(100);
  const [volB, setVolB] = useState(100);

  // HUD and full-screen visibility toggles
  const [isHudVisible, setIsHudVisible] = useState(true);

  // Loop settings
  const [loopA, setLoopA] = useState<{ active: boolean; start: number; end: number } | null>(null);
  const [loopB, setLoopB] = useState<{ active: boolean; start: number; end: number } | null>(null);

  const playerRefA = useRef<any>(null);
  const playerRefB = useRef<any>(null);
  const channelRef = useRef<BroadcastChannel | null>(null);

  // YouTube API readiness inside Popout
  const [isApiReady, setIsApiReady] = useState(false);

  useEffect(() => {
    // Dynamically load YouTube API inside popped-out window
    if (window.YT && window.YT.Player) {
      setIsApiReady(true);
      return;
    }

    window.onYouTubeIframeAPIReady = () => {
      setIsApiReady(true);
    };

    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    const firstScriptTag = document.getElementsByTagName("script")[0];
    if (firstScriptTag && firstScriptTag.parentNode) {
      firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
    } else {
      document.body.appendChild(tag);
    }

    return () => {
      window.onYouTubeIframeAPIReady = undefined;
    };
  }, []);

  // Sync volume of player A
  useEffect(() => {
    if (playerRefA.current && typeof playerRefA.current.setVolume === "function") {
      playerRefA.current.setVolume(volA);
    }
  }, [volA]);

  // Sync volume of player B
  useEffect(() => {
    if (playerRefB.current && typeof playerRefB.current.setVolume === "function") {
      playerRefB.current.setVolume(volB);
    }
  }, [volB]);

  // Set up synchronization channel
  useEffect(() => {
    const channel = new BroadcastChannel("youtube_dj_sync_channel");
    channelRef.current = channel;

    // Listen to Master Console commands
    channel.onmessage = (event) => {
      const { type, deckId, payload, track, time, volume, pitch } = event.data;

      if (type === "LOAD") {
        if (deckId === "A" && (playerType === "A" || playerType === "dual")) {
          setTrackA(track);
          setCurrentTimeA(0);
          setDurationA(0);
          initPlayer("A", track.youtubeId);
        } else if (deckId === "B" && (playerType === "B" || playerType === "dual")) {
          setTrackB(track);
          setCurrentTimeB(0);
          setDurationB(0);
          initPlayer("B", track.youtubeId);
        }
      } else if (type === "PLAY") {
        if (deckId === "A" && playerRefA.current) {
          playerRefA.current.playVideo();
          setIsPlayingA(true);
        } else if (deckId === "B" && playerRefB.current) {
          playerRefB.current.playVideo();
          setIsPlayingB(true);
        }
      } else if (type === "PAUSE") {
        if (deckId === "A" && playerRefA.current) {
          playerRefA.current.pauseVideo();
          setIsPlayingA(false);
        } else if (deckId === "B" && playerRefB.current) {
          playerRefB.current.pauseVideo();
          setIsPlayingB(false);
        }
      } else if (type === "SEEK") {
        if (deckId === "A" && playerRefA.current) {
          playerRefA.current.seekTo(time, true);
          setCurrentTimeA(time);
        } else if (deckId === "B" && playerRefB.current) {
          playerRefB.current.seekTo(time, true);
          setCurrentTimeB(time);
        }
      } else if (type === "SET_VOLUME") {
        if (deckId === "A") {
          setVolA(volume);
        } else if (deckId === "B") {
          setVolB(volume);
        }
      } else if (type === "SET_PITCH") {
        if (deckId === "A" && playerRefA.current) {
          playerRefA.current.setPlaybackRate(calculatePlaybackRate(pitch));
        } else if (deckId === "B" && playerRefB.current) {
          playerRefB.current.setPlaybackRate(calculatePlaybackRate(pitch));
        }
      } else if (type === "SET_LOOP") {
        const { active, start, end } = payload;
        if (deckId === "A") {
          setLoopA(active ? { active, start, end } : null);
        } else if (deckId === "B") {
          setLoopB(active ? { active, start, end } : null);
        }
      } else if (type === "EJECT") {
        if (deckId === "A" && (playerType === "A" || playerType === "dual")) {
          if (playerRefA.current && typeof playerRefA.current.stopVideo === "function") {
            playerRefA.current.stopVideo();
          }
          setTrackA(null);
          setIsPlayingA(false);
          setCurrentTimeA(0);
          setDurationA(0);
        } else if (deckId === "B" && (playerType === "B" || playerType === "dual")) {
          if (playerRefB.current && typeof playerRefB.current.stopVideo === "function") {
            playerRefB.current.stopVideo();
          }
          setTrackB(null);
          setIsPlayingB(false);
          setCurrentTimeB(0);
          setDurationB(0);
        }
      } else if (type === "PING") {
        channel.postMessage({ type: "PONG", deckId: playerType === "dual" ? "dual" : playerType });
      }
    };

    return () => {
      channel.close();
    };
  }, [playerType]);

  // Initialize YouTube frame inside external player
  const initPlayer = (deckId: "A" | "B", videoId: string) => {
    const containerId = `external-youtube-container-${deckId}`;

    if (deckId === "A" && playerRefA.current) {
      try {
        playerRefA.current.loadVideoById({ videoId });
        return;
      } catch (e) {
        console.error("Error reloading video inside Popout", e);
      }
    }

    if (deckId === "B" && playerRefB.current) {
      try {
        playerRefB.current.loadVideoById({ videoId });
        return;
      } catch (e) {
        console.error("Error reloading video inside Popout", e);
      }
    }

    if (window.YT && window.YT.Player) {
      const player = new window.YT.Player(containerId, {
        videoId: videoId,
        playerVars: {
          controls: 0,
          disablekb: 1,
          fs: 0,
          rel: 0,
          modestbranding: 1,
          origin: window.location.origin
        },
        events: {
          onReady: (event: any) => {
            event.target.setVolume(deckId === "A" ? volA : volB);
          },
          onStateChange: (event: any) => {
            const isPlaying = event.data === 1;
            if (deckId === "A") {
              setIsPlayingA(isPlaying);
            } else {
              setIsPlayingB(isPlaying);
            }
          }
        }
      });

      if (deckId === "A") {
        playerRefA.current = player;
      } else {
        playerRefB.current = player;
      }
    }
  };

  // Broadcast current times and states back to the master console
  useEffect(() => {
    const interval = setInterval(() => {
      // Handle Deck A updates
      if (playerType === "A" || playerType === "dual") {
        const player = playerRefA.current;
        if (player && typeof player.getCurrentTime === "function") {
          const t = player.getCurrentTime();
          const d = player.getDuration() || 0;
          setCurrentTimeA(t);
          if (d > 0) setDurationA(d);

          // Loop logic in Popout
          if (loopA?.active && t >= loopA.end) {
            player.seekTo(loopA.start, true);
            setCurrentTimeA(loopA.start);
          }

          // Broadcast to Main Console
          channelRef.current?.postMessage({
            type: "PLAYER_STATE",
            deckId: "A",
            payload: {
              isPlaying: isPlayingA,
              currentTime: t,
              duration: d
            }
          });
        }
      }

      // Handle Deck B updates
      if (playerType === "B" || playerType === "dual") {
        const player = playerRefB.current;
        if (player && typeof player.getCurrentTime === "function") {
          const t = player.getCurrentTime();
          const d = player.getDuration() || 0;
          setCurrentTimeB(t);
          if (d > 0) setDurationB(d);

          // Loop logic in Popout
          if (loopB?.active && t >= loopB.end) {
            player.seekTo(loopB.start, true);
            setCurrentTimeB(loopB.start);
          }

          // Broadcast to Main Console
          channelRef.current?.postMessage({
            type: "PLAYER_STATE",
            deckId: "B",
            payload: {
              isPlaying: isPlayingB,
              currentTime: t,
              duration: d
            }
          });
        }
      }
    }, 100);

    return () => clearInterval(interval);
  }, [playerType, loopA, loopB, isPlayingA, isPlayingB]);

  // Request Document Fullscreen helper
  const handleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        console.error(`Error requesting Fullscreen mode: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  };

  // Format digital clock
  const formatTime = (secs: number) => {
    if (isNaN(secs)) return "00:00";
    const min = Math.floor(secs / 60);
    const sec = Math.floor(secs % 60);
    return `${min.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col justify-between relative overflow-hidden select-none font-sans" id="popout-root">
      {/* Dynamic Grid for Dual/Single display */}
      <div className={`flex-1 grid ${playerType === "dual" ? "grid-cols-1 md:grid-cols-2 h-screen" : "grid-cols-1 h-screen"} bg-zinc-950`} id="popout-grid">
        {/* PLAYER A CONTAINER */}
        {(playerType === "A" || playerType === "dual") && (
          <div className="relative border-r border-zinc-900/40 flex items-center justify-center bg-black h-full overflow-hidden" id="popout-viewport-a">
            {!trackA ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-zinc-950 p-6 text-center z-10">
                <Disc className="w-12 h-12 text-cyan-500/40 animate-spin" style={{ animationDuration: "6s" }} />
                <span className="text-xs font-mono tracking-widest text-zinc-500 uppercase">PANTALLA RECEPTORA: DECK A</span>
                <p className="text-[10px] text-zinc-600 font-mono">Cargue un video musical desde la consola principal para comenzar la transmisión.</p>
              </div>
            ) : (
              <div className="w-full h-full" id="external-youtube-container-A" />
            )}

            {/* HUD OVERLAY DECK A */}
            {isHudVisible && trackA && (
              <div className="absolute bottom-4 left-4 right-4 bg-black/85 backdrop-blur-md rounded-xl p-3 border border-zinc-800/80 flex items-center justify-between z-20 pointer-events-none transition-opacity duration-300">
                <div className="flex items-center gap-3">
                  <div className="w-1.5 h-8 bg-cyan-500 rounded-full shadow-[0_0_8px_#06b6d4]" />
                  <div>
                    <span className="text-[9px] font-mono tracking-widest text-cyan-400 font-bold block">OUTPUT • DECK A</span>
                    <span className="text-xs font-bold font-sans text-zinc-100 line-clamp-1">{trackA.title}</span>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-right font-mono text-xs">
                  <div>
                    <span className="text-[8px] text-zinc-500 block">TIME / DUR</span>
                    <span className="text-zinc-200 font-semibold">{formatTime(currentTimeA)} / {formatTime(durationA)}</span>
                  </div>
                  <div>
                    <span className="text-[8px] text-zinc-500 block">BASE BPM</span>
                    <span className="text-cyan-400 font-black">{trackA.bpm} BPM</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* PLAYER B CONTAINER */}
        {(playerType === "B" || playerType === "dual") && (
          <div className="relative flex items-center justify-center bg-black h-full overflow-hidden" id="popout-viewport-b">
            {!trackB ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-zinc-950 p-6 text-center z-10">
                <Disc className="w-12 h-12 text-orange-500/40 animate-spin" style={{ animationDuration: "6s" }} />
                <span className="text-xs font-mono tracking-widest text-zinc-500 uppercase">PANTALLA RECEPTORA: DECK B</span>
                <p className="text-[10px] text-zinc-600 font-mono">Cargue un video musical desde la consola principal para comenzar la transmisión.</p>
              </div>
            ) : (
              <div className="w-full h-full" id="external-youtube-container-B" />
            )}

            {/* HUD OVERLAY DECK B */}
            {isHudVisible && trackB && (
              <div className="absolute bottom-4 left-4 right-4 bg-black/85 backdrop-blur-md rounded-xl p-3 border border-zinc-800/80 flex items-center justify-between z-20 pointer-events-none transition-opacity duration-300">
                <div className="flex items-center gap-3">
                  <div className="w-1.5 h-8 bg-orange-500 rounded-full shadow-[0_0_8px_#f97316]" />
                  <div>
                    <span className="text-[9px] font-mono tracking-widest text-orange-400 font-bold block">OUTPUT • DECK B</span>
                    <span className="text-xs font-bold font-sans text-zinc-100 line-clamp-1">{trackB.title}</span>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-right font-mono text-xs">
                  <div>
                    <span className="text-[8px] text-zinc-500 block">TIME / DUR</span>
                    <span className="text-zinc-200 font-semibold">{formatTime(currentTimeB)} / {formatTime(durationB)}</span>
                  </div>
                  <div>
                    <span className="text-[8px] text-zinc-500 block">BASE BPM</span>
                    <span className="text-orange-400 font-black">{trackB.bpm} BPM</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* FLOATING ACTION CONTROL BAR (HOVER TRIGGERED ON THE VERY BOTTOM) */}
      <div className="absolute top-4 right-4 z-40 flex items-center gap-2">
        <button
          onClick={() => setIsHudVisible(!isHudVisible)}
          className="p-2 bg-black/70 hover:bg-black/90 rounded-lg border border-zinc-800 text-zinc-400 hover:text-white transition flex items-center justify-center"
          title="Alternar HUD / Datos"
        >
          {isHudVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
        <button
          onClick={handleFullscreen}
          className="px-3 py-1 bg-black/70 hover:bg-black/90 rounded-lg border border-zinc-800 text-xs font-mono font-bold text-zinc-400 hover:text-white transition"
          title="Pantalla Completa"
        >
          FULLSCREEN 📺
        </button>
      </div>

      {!isApiReady && (
        <div className="absolute inset-0 bg-black/95 z-50 flex flex-col items-center justify-center gap-3">
          <Disc className="w-12 h-12 text-cyan-400 animate-spin" />
          <span className="text-xs font-mono tracking-wider text-zinc-500 uppercase">Cargando módulos de renderizado...</span>
        </div>
      )}
    </div>
  );
}

// =========================================================================
//         PREVIEW / CUE SCREEN (tercera pantalla aislada, con Tap Tempo)
// =========================================================================
function PreviewPlayerView() {
  const [track, setTrack] = useState<DJTrack | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(80);
  const [isApiReady, setIsApiReady] = useState(false);

  // Tap Tempo state
  const [tapTimes, setTapTimes] = useState<number[]>([]);
  const [tappedBpm, setTappedBpm] = useState<number | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);

  const playerRef = useRef<any>(null);
  const channelRef = useRef<BroadcastChannel | null>(null);

  useEffect(() => {
    if (window.YT && window.YT.Player) {
      setIsApiReady(true);
      return;
    }
    window.onYouTubeIframeAPIReady = () => setIsApiReady(true);
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    const firstScriptTag = document.getElementsByTagName("script")[0];
    if (firstScriptTag && firstScriptTag.parentNode) {
      firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
    } else {
      document.body.appendChild(tag);
    }
    return () => {
      window.onYouTubeIframeAPIReady = undefined;
    };
  }, []);

  const initPreviewPlayer = (videoId: string) => {
    if (playerRef.current && typeof playerRef.current.loadVideoById === "function") {
      try {
        playerRef.current.loadVideoById({ videoId });
        return;
      } catch (e) {
        console.error("Error reloading preview video", e);
      }
    }
    if (window.YT && window.YT.Player) {
      const player = new window.YT.Player("preview-youtube-container", {
        videoId,
        playerVars: { controls: 0, disablekb: 1, fs: 0, rel: 0, modestbranding: 1, origin: window.location.origin },
        events: {
          onReady: (e: any) => e.target.setVolume(volume),
          onStateChange: (e: any) => setIsPlaying(e.data === 1),
        },
      });
      playerRef.current = player;
    }
  };

  // Listens for tracks sent from the Library's "PREVIEW" button
  useEffect(() => {
    const channel = new BroadcastChannel("youtube_dj_sync_channel");
    channelRef.current = channel;

    channel.onmessage = (event) => {
      const { type, track: incomingTrack } = event.data;
      if (type === "LOAD_PREVIEW" && incomingTrack) {
        setTrack(incomingTrack);
        setIsPlaying(false);
        setCurrentTime(0);
        setDuration(0);
        setTapTimes([]);
        setTappedBpm(null);
        setSavedFlash(false);
        initPreviewPlayer(incomingTrack.youtubeId);
      } else if (type === "PING") {
        channel.postMessage({ type: "PONG", deckId: "preview" });
      }
    };

    return () => channel.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // This volume is local to the preview window only — it never touches the crossfader/master mix
  useEffect(() => {
    if (playerRef.current && typeof playerRef.current.setVolume === "function") {
      playerRef.current.setVolume(volume);
    }
  }, [volume]);

  useEffect(() => {
    const interval = setInterval(() => {
      const p = playerRef.current;
      if (p && typeof p.getCurrentTime === "function") {
        setCurrentTime(p.getCurrentTime());
        setDuration(p.getDuration() || 0);
      }
    }, 200);
    return () => clearInterval(interval);
  }, []);

  const handlePlayPause = () => {
    const p = playerRef.current;
    if (!p) return;
    if (isPlaying) {
      p.pauseVideo();
      setIsPlaying(false);
    } else {
      p.playVideo();
      setIsPlaying(true);
    }
  };

  // Tap Tempo: BPM = 60000ms / average interval between consecutive taps (last 8, reset after 2s of silence)
  const handleTap = () => {
    const now = performance.now();
    setTapTimes((prev) => {
      const recent = prev.filter((t) => now - t < 2000);
      const updated = [...recent, now].slice(-8);
      if (updated.length >= 2) {
        const intervals: number[] = [];
        for (let i = 1; i < updated.length; i++) intervals.push(updated[i] - updated[i - 1]);
        const avgMs = intervals.reduce((a, b) => a + b, 0) / intervals.length;
        setTappedBpm(Math.round(60000 / avgMs));
      }
      return updated;
    });
  };

  const handleResetTap = () => {
    setTapTimes([]);
    setTappedBpm(null);
  };

  const handleSaveBpm = () => {
    if (!track || !tappedBpm) return;
    channelRef.current?.postMessage({ type: "PREVIEW_BPM_DETECTED", trackId: track.id, bpm: tappedBpm });
    setSavedFlash(true);
    window.setTimeout(() => setSavedFlash(false), 1500);
  };

  const formatTime = (secs: number) => {
    if (isNaN(secs)) return "00:00";
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col select-none font-sans" id="preview-root">
      <div className="flex items-center gap-2 px-4 py-2 bg-zinc-950 border-b border-zinc-900">
        <Eye className="w-4 h-4 text-purple-400" />
        <span className="text-xs font-mono font-bold tracking-widest text-purple-400 uppercase">PREVIEW / CUE • AISLADO DEL MIX</span>
      </div>

      <div className="relative flex-1 bg-zinc-950 flex items-center justify-center overflow-hidden" style={{ minHeight: 220 }}>
        {!track ? (
          <div className="flex flex-col items-center gap-2 text-center p-6">
            <Disc className="w-10 h-10 text-purple-500/40 animate-spin" style={{ animationDuration: "6s" }} />
            <span className="text-xs font-mono text-zinc-500 uppercase tracking-widest">Esperando pista desde la Biblioteca...</span>
            <p className="text-[10px] text-zinc-600">Presiona "PREVIEW ↗" en cualquier pista de la consola principal.</p>
          </div>
        ) : (
          <div className="w-full h-full" id="preview-youtube-container" />
        )}
        {!isApiReady && (
          <div className="absolute inset-0 bg-black/95 flex items-center justify-center">
            <Disc className="w-10 h-10 text-purple-400 animate-spin" />
          </div>
        )}
      </div>

      {track && (
        <div className="p-4 space-y-4 bg-zinc-950 border-t border-zinc-900">
          <div>
            <div className="font-bold text-sm text-zinc-100 truncate">{track.title}</div>
            <div className="text-xs text-zinc-500">{track.artist}</div>
          </div>

          <div className="flex items-center justify-between text-[10px] font-mono text-zinc-500">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
          <div className="h-1 w-full bg-zinc-800 rounded overflow-hidden">
            <div className="h-full bg-purple-500" style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }} />
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handlePlayPause}
              className="h-10 w-10 shrink-0 rounded-full bg-purple-500/10 border-2 border-purple-500 text-purple-400 flex items-center justify-center"
            >
              {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
            </button>
            <div className="flex-1 flex items-center gap-2">
              <Volume2 className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
              <input
                type="range"
                min="0"
                max="100"
                value={volume}
                onChange={(e) => setVolume(Number(e.target.value))}
                className="flex-1"
              />
              <span className="text-[10px] text-zinc-500 font-mono w-8 text-right">{volume}%</span>
            </div>
          </div>

          <div className="bg-zinc-900 rounded-xl p-3 border border-zinc-800 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest">Tap Tempo</span>
              <span className="text-lg font-mono font-black text-purple-400">{tappedBpm ?? "--"} BPM</span>
            </div>
            <button
              onClick={handleTap}
              className="w-full py-4 rounded-xl bg-purple-600 hover:bg-purple-500 active:scale-95 transition text-sm font-mono font-bold uppercase tracking-widest"
            >
              TAP
            </button>
            <div className="flex gap-2">
              <button
                onClick={handleResetTap}
                className="flex-1 py-1.5 text-[10px] font-mono border border-zinc-800 rounded text-zinc-500 hover:text-zinc-300 uppercase"
              >
                Reiniciar
              </button>
              <button
                onClick={handleSaveBpm}
                disabled={!tappedBpm}
                className={`flex-1 py-1.5 text-[10px] font-mono border rounded uppercase font-bold transition ${
                  tappedBpm
                    ? "border-green-600 text-green-400 hover:bg-green-950/30"
                    : "border-zinc-800 text-zinc-700 cursor-not-allowed"
                }`}
              >
                {savedFlash ? "✓ Guardado" : "Guardar BPM"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// =========================================================================
//                   MAIN WORKSPACE APPLICATION
// =========================================================================
export default function App() {
  // Query parameters intercept to render Popped-out Screens
  const params = new URLSearchParams(window.location.search);
  const playerParam = params.get("player");
  if (playerParam === "A" || playerParam === "B" || playerParam === "dual") {
    return <ExternalPlayerView playerType={playerParam} />;
  }
  if (playerParam === "preview") {
    return <PreviewPlayerView />;
  }

  // --- Login & DJ Stage States ---
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(() => {
    return localStorage.getItem("dj_is_logged_in") === "true";
  });
  const [stageName, setStageName] = useState<string>(() => {
    return localStorage.getItem("dj_stage_name") || "";
  });
  const [loginPassword, setLoginPassword] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState("");

  // --- Gemini DJ AI Co-Pilot States ---
  const [showAiCopilot, setShowAiCopilot] = useState(false);
  const [geminiPrompt, setGeminiPrompt] = useState("");
  const [isGeminiLoading, setIsGeminiLoading] = useState(false);
  const [geminiResponse, setGeminiResponse] = useState<{ reasoning: string; actions: any[] } | null>(null);
  const [geminiError, setGeminiError] = useState<string | null>(null);
  const [geminiHistory, setGeminiHistory] = useState<Array<{ prompt: string; reasoning: string; timestamp: string }>>([]);

  const [isYTApiReady, setIsYTApiReady] = useState(false);
  const [isYTApiLoading, setIsYTApiLoading] = useState(true);

  // Deck A State
  const [trackA, setTrackA] = useState<DJTrack | null>(null);
  const [isPlayingA, setIsPlayingA] = useState(false);
  const [volA, setVolA] = useState(80);
  const [gainA, setGainA] = useState(50);
  const [eqHighA, setEqHighA] = useState(0);
  const [eqMidA, setEqMidA] = useState(0);
  const [eqLowA, setEqLowA] = useState(0);
  const [filterA, setFilterA] = useState(0);
  const [cueA, setCueA] = useState(false);
  const [pitchA, setPitchA] = useState(0);

  // Deck B State
  const [trackB, setTrackB] = useState<DJTrack | null>(null);
  const [isPlayingB, setIsPlayingB] = useState(false);
  const [volB, setVolB] = useState(80);
  const [gainB, setGainB] = useState(50);
  const [eqHighB, setEqHighB] = useState(0);
  const [eqMidB, setEqMidB] = useState(0);
  const [eqLowB, setEqLowB] = useState(0);
  const [filterB, setFilterB] = useState(0);
  const [cueB, setCueB] = useState(false);
  const [pitchB, setPitchB] = useState(0);

  // Master State
  const [crossfader, setCrossfader] = useState(0); // -100 to 100
  const [masterVolume, setMasterVolume] = useState(80);

  // --- Playback History (persisted locally so it survives page reloads) ---
  const [playbackHistory, setPlaybackHistory] = useState<HistoryEntry[]>(() => {
    try {
      const raw = localStorage.getItem(LS_PLAYBACK_HISTORY_KEY);
      return raw ? (JSON.parse(raw) as HistoryEntry[]) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try { localStorage.setItem(LS_PLAYBACK_HISTORY_KEY, JSON.stringify(playbackHistory)); } catch {}
  }, [playbackHistory]);

  const recordHistoryEntry = (track: DJTrack, deck: "A" | "B") => {
    const entry: HistoryEntry = {
      entryId: `hist-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      track,
      deck,
      playedAt: Date.now(),
    };
    setPlaybackHistory((prev) => [entry, ...prev].slice(0, MAX_HISTORY_ENTRIES));
  };

  const handleEditHistoryEntry = (entryId: string, changes: Partial<DJTrack>) => {
    setPlaybackHistory((prev) =>
      prev.map((e) => (e.entryId === entryId ? { ...e, track: { ...e.track, ...changes } } : e))
    );
  };

  const handleDeleteHistoryEntry = (entryId: string) => {
    setPlaybackHistory((prev) => prev.filter((e) => e.entryId !== entryId));
  };

  const handleClearHistory = () => setPlaybackHistory([]);

  // --- Auto DJ (continuous automatic mixing) States ---
  const [isAutoDjOn, setIsAutoDjOn] = useState(false);
  const [autoDjStatus, setAutoDjStatus] = useState("");
  const autoDjActiveDeckRef = useRef<"A" | "B" | null>(null);
  const autoDjTransitioningRef = useRef(false);
  const autoDjPlayedIdsRef = useRef<Set<string>>(new Set());
  const autoDjCrossfadeTimerRef = useRef<number | null>(null);
  const autoDjTickRef = useRef<() => void>(() => {});

  const AUTO_DJ_LEAD_SECONDS = 20; // start transition when this many seconds remain
  const AUTO_DJ_CROSSFADE_MS = 8000; // duration of the automatic crossfade

  // Multi-Screen Control Modes
  const [screenModeA, setScreenModeA] = useState<'local' | 'external'>('local');
  const [screenModeB, setScreenModeB] = useState<'local' | 'external'>('local');

  // Time / Duration states mirrored from external player (if screenMode is external)
  const [currentTimeA, setCurrentTimeA] = useState(0);
  const [durationA, setDurationA] = useState(0);
  const [currentTimeB, setCurrentTimeB] = useState(0);
  const [durationB, setDurationB] = useState(0);

  // Player references
  const playersRef = useRef<{ A: any; B: any }>({ A: null, B: null });
  const channelRef = useRef<BroadcastChannel | null>(null);

  // Emergency local MP3 playback (offline fallback when YouTube streaming is unavailable)
  const emergencyAudioRefA = useRef<HTMLAudioElement | null>(null);
  const emergencyAudioRefB = useRef<HTMLAudioElement | null>(null);

  // Cleans up a deck's emergency <audio> element and frees its Blob URL
  const teardownEmergencyAudio = (deck: "A" | "B") => {
    const audioEl = deck === "A" ? emergencyAudioRefA.current : emergencyAudioRefB.current;
    if (audioEl) {
      audioEl.pause();
      if (audioEl.src) {
        URL.revokeObjectURL(audioEl.src);
        audioEl.removeAttribute("src");
        audioEl.load();
      }
    }
  };

  // Wraps a plain <audio> element behind the same method surface the app already
  // uses for YT.Player instances, so every existing control (play/pause, seek,
  // volume, pitch, hot cues, loops, crossfader) keeps working unchanged.
  const createLocalAudioAdapter = (audioEl: HTMLAudioElement, deckId: "A" | "B") => {
    audioEl.onplay = () => {
      if (deckId === "A") setIsPlayingA(true); else setIsPlayingB(true);
    };
    audioEl.onpause = () => {
      if (deckId === "A") setIsPlayingA(false); else setIsPlayingB(false);
    };
    audioEl.onended = () => {
      if (deckId === "A") setIsPlayingA(false); else setIsPlayingB(false);
    };

    return {
      __isLocalAudio: true,
      playVideo: () => { audioEl.play().catch(() => {}); },
      pauseVideo: () => audioEl.pause(),
      stopVideo: () => { audioEl.pause(); try { audioEl.currentTime = 0; } catch {} },
      seekTo: (seconds: number) => { try { audioEl.currentTime = seconds; } catch {} },
      setVolume: (vol: number) => { audioEl.volume = Math.max(0, Math.min(100, vol)) / 100; },
      setPlaybackRate: (rate: number) => { audioEl.playbackRate = rate; },
      getCurrentTime: () => audioEl.currentTime || 0,
      getDuration: () => (isFinite(audioEl.duration) ? audioEl.duration : 0) || 0,
      loadVideoById: () => { /* no-op: local files are swapped via handleEmergencyFileSelected */ },
    };
  };

  // Panic action: loads a local MP3 straight into Deck A or B, replacing whatever was playing there
  const handleEmergencyFileSelected = (deck: "A" | "B", file: File) => {
    const audioEl = deck === "A" ? emergencyAudioRefA.current : emergencyAudioRefB.current;
    if (!audioEl) return;

    // Local Blob URLs don't survive in a popped-out window — force the deck back to local screen mode
    if (deck === "A") setScreenModeA("local"); else setScreenModeB("local");

    // Tear down whatever was previously loaded on this deck (YT player or a prior emergency file)
    const existingPlayer = playersRef.current[deck];
    if (existingPlayer && typeof existingPlayer.stopVideo === "function") {
      try { existingPlayer.stopVideo(); } catch {}
    }
    teardownEmergencyAudio(deck);

    const objectUrl = URL.createObjectURL(file);
    audioEl.src = objectUrl;
    audioEl.load();

    const adapter = createLocalAudioAdapter(audioEl, deck);
    playersRef.current[deck] = adapter;

    const emergencyTrack: DJTrack = {
      id: `emergency-${Date.now()}`,
      title: file.name.replace(/\.[^/.]+$/, ""),
      artist: "ARCHIVO LOCAL (SIN INTERNET)",
      bpm: 0,
      genre: "Local",
      duration: "--:--",
      youtubeId: "",
      isLocalFile: true,
    };

    if (deck === "A") {
      setTrackA(emergencyTrack);
      setIsPlayingA(false);
      setCurrentTimeA(0);
      setDurationA(0);
    } else {
      setTrackB(emergencyTrack);
      setIsPlayingB(false);
      setCurrentTimeB(0);
      setDurationB(0);
    }

    audioEl.oncanplay = () => {
      const vol = calculateEffectiveVolume(deck, crossfader, deck === "A" ? volA : volB, masterVolume);
      audioEl.volume = Math.max(0, Math.min(100, vol)) / 100;
      audioEl.play().catch(() => {});
    };
  };

  // Load YouTube IFrame API script dynamically for integrated players
  useEffect(() => {
    if (window.YT && window.YT.Player) {
      setIsYTApiReady(true);
      setIsYTApiLoading(false);
      return;
    }

    window.onYouTubeIframeAPIReady = () => {
      setIsYTApiReady(true);
      setIsYTApiLoading(false);
    };

    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    const firstScriptTag = document.getElementsByTagName("script")[0];
    if (firstScriptTag && firstScriptTag.parentNode) {
      firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
    } else {
      document.body.appendChild(tag);
    }

    return () => {
      window.onYouTubeIframeAPIReady = undefined;
    };
  }, []);

  // Broadcast Message helper
  const broadcastMessage = (msg: any) => {
    if (channelRef.current) {
      channelRef.current.postMessage(msg);
    }
  };

  // Broadcast channel initialization and listener
  useEffect(() => {
    const channel = new BroadcastChannel("youtube_dj_sync_channel");
    channelRef.current = channel;

    channel.onmessage = (event) => {
      const { type, deckId, payload } = event.data;

      if (type === "PLAYER_STATE") {
        if (deckId === "A" && screenModeA === "external") {
          setIsPlayingA(payload.isPlaying);
          setCurrentTimeA(payload.currentTime);
          setDurationA(payload.duration);
        } else if (deckId === "B" && screenModeB === "external") {
          setIsPlayingB(payload.isPlaying);
          setCurrentTimeB(payload.currentTime);
          setDurationB(payload.duration);
        }
      } else if (type === "PONG") {
        console.log(`Popout connection verified for Deck: ${deckId}`);
      }
    };

    // Ping existing screens to announce ourselves
    setTimeout(() => {
      broadcastMessage({ type: "PING" });
    }, 500);

    return () => {
      channel.close();
    };
  }, [screenModeA, screenModeB]);

  // Handle cross-sync between local and external modes dynamically
  useEffect(() => {
    if (screenModeA === "external" && trackA) {
      broadcastMessage({ type: "LOAD", deckId: "A", track: trackA });
      if (isPlayingA) {
        broadcastMessage({ type: "PLAY", deckId: "A" });
      }
      if (playersRef.current.A && typeof playersRef.current.A.pauseVideo === "function") {
        playersRef.current.A.pauseVideo();
      }
    } else if (screenModeA === "local" && trackA) {
      initYTPlayer("A", trackA.youtubeId);
      setTimeout(() => {
        if (playersRef.current.A && typeof playersRef.current.A.seekTo === "function") {
          playersRef.current.A.seekTo(currentTimeA, true);
          if (isPlayingA) {
            playersRef.current.A.playVideo();
          }
        }
      }, 800);
    }
  }, [screenModeA]);

  useEffect(() => {
    if (screenModeB === "external" && trackB) {
      broadcastMessage({ type: "LOAD", deckId: "B", track: trackB });
      if (isPlayingB) {
        broadcastMessage({ type: "PLAY", deckId: "B" });
      }
      if (playersRef.current.B && typeof playersRef.current.B.pauseVideo === "function") {
        playersRef.current.B.pauseVideo();
      }
    } else if (screenModeB === "local" && trackB) {
      initYTPlayer("B", trackB.youtubeId);
      setTimeout(() => {
        if (playersRef.current.B && typeof playersRef.current.B.seekTo === "function") {
          playersRef.current.B.seekTo(currentTimeB, true);
          if (isPlayingB) {
            playersRef.current.B.playVideo();
          }
        }
      }, 800);
    }
  }, [screenModeB]);

  // Sync Effective Volumes to YouTube players when anything changes
  const updateVolumes = () => {
    const volEffA = calculateEffectiveVolume("A", crossfader, volA, masterVolume);
    const volEffB = calculateEffectiveVolume("B", crossfader, volB, masterVolume);

    if (screenModeA === "local" && playersRef.current.A && typeof playersRef.current.A.setVolume === "function") {
      playersRef.current.A.setVolume(volEffA);
    } else if (screenModeA === "external") {
      broadcastMessage({ type: "SET_VOLUME", deckId: "A", volume: volEffA });
    }

    if (screenModeB === "local" && playersRef.current.B && typeof playersRef.current.B.setVolume === "function") {
      playersRef.current.B.setVolume(volEffB);
    } else if (screenModeB === "external") {
      broadcastMessage({ type: "SET_VOLUME", deckId: "B", volume: volEffB });
    }
  };

  useEffect(() => {
    updateVolumes();
  }, [crossfader, volA, volB, masterVolume, trackA, trackB, screenModeA, screenModeB]);

  // Media Session integration: keeps a lock-screen "now playing" notification (title/artist/
  // artwork + play/pause controls) in sync with whichever deck is loudest in the mix. Android
  // treats an active media session as a reason to keep audio alive when the app is backgrounded
  // (e.g. while the user switches away to search for the next track), so this also makes
  // background playback more reliable, not just cosmetic.
  useEffect(() => {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;

    const volEffA = calculateEffectiveVolume("A", crossfader, volA, masterVolume);
    const volEffB = calculateEffectiveVolume("B", crossfader, volB, masterVolume);

    let activeDeck: "A" | "B" | null = null;
    if (isPlayingA && isPlayingB) activeDeck = volEffA >= volEffB ? "A" : "B";
    else if (isPlayingA) activeDeck = "A";
    else if (isPlayingB) activeDeck = "B";

    const displayDeck = activeDeck ?? (trackA ? "A" : trackB ? "B" : null);
    const displayTrack = displayDeck === "A" ? trackA : displayDeck === "B" ? trackB : null;

    if (displayTrack) {
      const artwork = displayTrack.isLocalFile
        ? [{ src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" }]
        : [
            { src: `https://img.youtube.com/vi/${displayTrack.youtubeId}/hqdefault.jpg`, sizes: "480x360", type: "image/jpeg" },
            { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
          ];

      navigator.mediaSession.metadata = new MediaMetadata({
        title: displayTrack.title,
        artist: displayTrack.artist,
        album: "YouTube DJ Console",
        artwork,
      });
    }

    navigator.mediaSession.playbackState = activeDeck ? "playing" : "paused";

    navigator.mediaSession.setActionHandler("play", () => {
      if (displayDeck) handlePlayPause(displayDeck);
    });
    navigator.mediaSession.setActionHandler("pause", () => {
      if (displayDeck) handlePlayPause(displayDeck);
    });

    return () => {
      navigator.mediaSession.setActionHandler("play", null);
      navigator.mediaSession.setActionHandler("pause", null);
    };
  }, [trackA, trackB, isPlayingA, isPlayingB, crossfader, volA, volB, masterVolume]);

  // Volume curve math
  const calculateEffectiveVolume = (
    deckId: "A" | "B",
    cf: number,
    chVol: number,
    mstVol: number
  ) => {
    let cfFactor = 1;
    if (deckId === "A" && cf > 0) {
      cfFactor = 1 - cf / 100;
    } else if (deckId === "B" && cf < 0) {
      cfFactor = 1 + cf / 100;
    }

    // Apply scaling
    const result = (chVol / 100) * cfFactor * (mstVol / 100) * 100;
    return Math.max(0, Math.min(100, result));
  };

  // Construct or Load video into Player A or B
  const handleLoadTrack = (track: DJTrack, deck: "A" | "B") => {
    recordHistoryEntry(track, deck);
    if (deck === "A") {
      setTrackA(track);
      setIsPlayingA(false);
      setCurrentTimeA(0);
      setDurationA(0);
      if (screenModeA === "local") {
        if (!isYTApiReady) {
          alert("YouTube API no está lista todavía. Por favor, espera un segundo.");
          return;
        }
        setTimeout(() => initYTPlayer("A", track.youtubeId), 150);
      } else {
        setTimeout(() => {
          broadcastMessage({ type: "LOAD", deckId: "A", track });
        }, 150);
      }
    } else {
      setTrackB(track);
      setIsPlayingB(false);
      setCurrentTimeB(0);
      setDurationB(0);
      if (screenModeB === "local") {
        if (!isYTApiReady) {
          alert("YouTube API no está lista todavía. Por favor, espera un segundo.");
          return;
        }
        setTimeout(() => initYTPlayer("B", track.youtubeId), 150);
      } else {
        setTimeout(() => {
          broadcastMessage({ type: "LOAD", deckId: "B", track });
        }, 150);
      }
    }
  };

  const initYTPlayer = (deckId: "A" | "B", videoId: string) => {
    const containerId = `youtube-player-container-${deckId}`;

    if (playersRef.current[deckId] && !playersRef.current[deckId].__isLocalAudio) {
      try {
        playersRef.current[deckId].loadVideoById({
          videoId: videoId,
          startSeconds: 0
        });
        return;
      } catch (e) {
        console.error("Error reloading video", e);
      }
    }

    if (playersRef.current[deckId]?.__isLocalAudio) {
      // Coming back from an emergency local MP3 — free it before attaching a real YT player
      teardownEmergencyAudio(deckId);
      playersRef.current[deckId] = null;
    }

    if (window.YT && window.YT.Player) {
      const newPlayer = new window.YT.Player(containerId, {
        videoId: videoId,
        playerVars: {
          controls: 0,        // Hide standard YT progress and chrome
          disablekb: 1,       // Disable keyboard shortcuts
          fs: 0,              // Hide fullscreen button
          rel: 0,             // Prevent suggestions at end
          modestbranding: 1,  // Clean branding
          origin: window.location.origin
        },
        events: {
          onReady: (event: any) => {
            const initialVol = calculateEffectiveVolume(
              deckId,
              crossfader,
              deckId === "A" ? volA : volB,
              masterVolume
            );
            event.target.setVolume(initialVol);
            
            const currentPitch = deckId === "A" ? pitchA : pitchB;
            event.target.setPlaybackRate(calculatePlaybackRate(currentPitch));
          },
          onStateChange: (event: any) => {
            // State: 1 = PLAYING, 2 = PAUSED, 0 = ENDED
            if (event.data === 1) {
              if (deckId === "A") setIsPlayingA(true);
              if (deckId === "B") setIsPlayingB(true);
            } else if (event.data === 2) {
              if (deckId === "A") setIsPlayingA(false);
              if (deckId === "B") setIsPlayingB(false);
            } else if (event.data === 0) {
              if (deckId === "A") setIsPlayingA(false);
              if (deckId === "B") setIsPlayingB(false);
            }
          }
        }
      });

      playersRef.current[deckId] = newPlayer;
    }
  };

  // Play / Pause toggler
  const handlePlayPause = (deck: "A" | "B") => {
    if (deck === "A") {
      if (screenModeA === "local") {
        const player = playersRef.current.A;
        if (!player) return;
        if (isPlayingA) {
          player.pauseVideo();
          setIsPlayingA(false);
        } else {
          player.playVideo();
          setIsPlayingA(true);
        }
      } else {
        if (isPlayingA) {
          broadcastMessage({ type: "PAUSE", deckId: "A" });
          setIsPlayingA(false);
        } else {
          broadcastMessage({ type: "PLAY", deckId: "A" });
          setIsPlayingA(true);
        }
      }
    } else {
      if (screenModeB === "local") {
        const player = playersRef.current.B;
        if (!player) return;
        if (isPlayingB) {
          player.pauseVideo();
          setIsPlayingB(false);
        } else {
          player.playVideo();
          setIsPlayingB(true);
        }
      } else {
        if (isPlayingB) {
          broadcastMessage({ type: "PAUSE", deckId: "B" });
          setIsPlayingB(false);
        } else {
          broadcastMessage({ type: "PLAY", deckId: "B" });
          setIsPlayingB(true);
        }
      }
    }
  };

  // Direct video seeks
  const handleSeek = (deck: "A" | "B", time: number) => {
    if (deck === "A") {
      setCurrentTimeA(time);
      if (screenModeA === "local") {
        if (playersRef.current.A && typeof playersRef.current.A.seekTo === "function") {
          playersRef.current.A.seekTo(time, true);
        }
      } else {
        broadcastMessage({ type: "SEEK", deckId: "A", time });
      }
    } else {
      setCurrentTimeB(time);
      if (screenModeB === "local") {
        if (playersRef.current.B && typeof playersRef.current.B.seekTo === "function") {
          playersRef.current.B.seekTo(time, true);
        }
      } else {
        broadcastMessage({ type: "SEEK", deckId: "B", time });
      }
    }
  };

  // Broadcast loop settings
  const handleLoopChange = (deck: "A" | "B", active: boolean, start: number, end: number, beats: number | null) => {
    if (deck === "A") {
      if (screenModeA === "external") {
        broadcastMessage({ type: "SET_LOOP", deckId: "A", payload: { active, start, end, beats } });
      }
    } else {
      if (screenModeB === "external") {
        broadcastMessage({ type: "SET_LOOP", deckId: "B", payload: { active, start, end, beats } });
      }
    }
  };

  // Eject/Reset track helper
  const handleResetTrack = (deck: "A" | "B") => {
    const activeTrack = deck === "A" ? trackA : trackB;
    if (activeTrack?.isLocalFile) {
      teardownEmergencyAudio(deck);
    }

    if (deck === "A") {
      setTrackA(null);
      setIsPlayingA(false);
      setCurrentTimeA(0);
      setDurationA(0);
      if (screenModeA === "local") {
        const player = playersRef.current.A;
        if (player && typeof player.stopVideo === "function") {
          player.stopVideo();
        }
      } else {
        broadcastMessage({ type: "EJECT", deckId: "A" });
      }
    } else {
      setTrackB(null);
      setIsPlayingB(false);
      setCurrentTimeB(0);
      setDurationB(0);
      if (screenModeB === "local") {
        const player = playersRef.current.B;
        if (player && typeof player.stopVideo === "function") {
          player.stopVideo();
        }
      } else {
        broadcastMessage({ type: "EJECT", deckId: "B" });
      }
    }
  };

  // --- Action runner for Gemini instructions ---
  const executeGeminiActions = (actions: any[]) => {
    if (!actions || !Array.isArray(actions)) return;

    actions.forEach((act) => {
      try {
        if (act.target === "deckA") {
          if (act.action === "play") {
            if (!isPlayingA) handlePlayPause("A");
          } else if (act.action === "pause") {
            if (isPlayingA) handlePlayPause("A");
          } else if (act.action === "setVolume") {
            setVolA(Math.max(0, Math.min(100, act.value)));
          } else if (act.action === "setPitch") {
            setPitchA(Math.max(-10, Math.min(10, act.value)));
          } else if (act.action === "loadTrack") {
            const found = PRESET_TRACKS.find(
              (t) =>
                t.id === act.value ||
                t.title.toLowerCase().includes(act.value.toLowerCase()) ||
                t.artist.toLowerCase().includes(act.value.toLowerCase())
            );
            if (found) {
              handleLoadTrack(found, "A");
            }
          }
        } else if (act.target === "deckB") {
          if (act.action === "play") {
            if (!isPlayingB) handlePlayPause("B");
          } else if (act.action === "pause") {
            if (isPlayingB) handlePlayPause("B");
          } else if (act.action === "setVolume") {
            setVolB(Math.max(0, Math.min(100, act.value)));
          } else if (act.action === "setPitch") {
            setPitchB(Math.max(-10, Math.min(10, act.value)));
          } else if (act.action === "loadTrack") {
            const found = PRESET_TRACKS.find(
              (t) =>
                t.id === act.value ||
                t.title.toLowerCase().includes(act.value.toLowerCase()) ||
                t.artist.toLowerCase().includes(act.value.toLowerCase())
            );
            if (found) {
              handleLoadTrack(found, "B");
            }
          }
        } else if (act.target === "mixer") {
          switch (act.action) {
            case "setCrossfader":
              setCrossfader(Math.max(-100, Math.min(100, act.value)));
              break;
            case "setGainA":
              setGainA(Math.max(0, Math.min(100, act.value)));
              break;
            case "setGainB":
              setGainB(Math.max(0, Math.min(100, act.value)));
              break;
            case "setFilterA":
              setFilterA(Math.max(-50, Math.min(50, act.value)));
              break;
            case "setFilterB":
              setFilterB(Math.max(-50, Math.min(50, act.value)));
              break;
            case "setEqHighA":
              setEqHighA(Math.max(-12, Math.min(12, act.value)));
              break;
            case "setEqHighB":
              setEqHighB(Math.max(-12, Math.min(12, act.value)));
              break;
            case "setEqMidA":
              setEqMidA(Math.max(-12, Math.min(12, act.value)));
              break;
            case "setEqMidB":
              setEqMidB(Math.max(-12, Math.min(12, act.value)));
              break;
            case "setEqLowA":
              setEqLowA(Math.max(-12, Math.min(12, act.value)));
              break;
            case "setEqLowB":
              setEqLowB(Math.max(-12, Math.min(12, act.value)));
              break;
            default:
              break;
          }
        }
      } catch (err) {
        console.error("Failed to execute action:", act, err);
      }
    });
  };

  const handleAskGemini = async (overridePrompt?: string) => {
    const activePrompt = overridePrompt || geminiPrompt;
    if (!activePrompt.trim() && !overridePrompt) return;
    
    setIsGeminiLoading(true);
    setGeminiError(null);

    try {
      const currentState = {
        library: PRESET_TRACKS,
        deckA: {
          track: trackA,
          isPlaying: isPlayingA,
          volume: volA,
          pitch: pitchA,
          currentTime: currentTimeA,
          duration: durationA,
        },
        deckB: {
          track: trackB,
          isPlaying: isPlayingB,
          volume: volB,
          pitch: pitchB,
          currentTime: currentTimeB,
          duration: durationB,
        },
        mixer: {
          crossfader,
          gainA,
          gainB,
          filterA,
          filterB,
          eqHighA,
          eqHighB,
          eqMidA,
          eqMidB,
          eqLowA,
          eqLowB,
          masterVolume,
        }
      };

      const res = await fetch("/api/gemini-control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentState,
          prompt: activePrompt
        })
      });

      if (!res.ok) {
        throw new Error("El servidor de Gemini no respondió correctamente.");
      }

      const data = await res.json();
      setGeminiResponse(data);
      
      if (data.reasoning) {
        setGeminiHistory(prev => [
          {
            prompt: activePrompt,
            reasoning: data.reasoning,
            timestamp: new Date().toLocaleTimeString()
          },
          ...prev
        ]);
      }

      if (data.actions && Array.isArray(data.actions)) {
        executeGeminiActions(data.actions);
      }
      
      setGeminiPrompt("");
    } catch (err: any) {
      console.error(err);
      setGeminiError(err.message || "Error al comunicarse con la IA de Gemini.");
    } finally {
      setIsGeminiLoading(false);
    }
  };

  // --- Login & Session Management ---
  const handleLogin = (e: any) => {
    e.preventDefault();
    setLoginError("");

    if (!stageName.trim()) {
      setLoginError("Por favor ingresa un Nombre de Escenario para tu sesión de DJ.");
      return;
    }

    setIsLoggingIn(true);
    
    setTimeout(() => {
      localStorage.setItem("dj_is_logged_in", "true");
      localStorage.setItem("dj_stage_name", stageName.trim());
      setIsLoggedIn(true);
      setIsLoggingIn(false);
    }, 1200);
  };

  const handleLogout = () => {
    localStorage.removeItem("dj_is_logged_in");
    setIsLoggedIn(false);
    setStageName("");
    setLoginPassword("");
  };

  // BPM Auto Sync — adjusts the given deck's pitch to match the OTHER deck's actual BPM
  // (matches the button label "SYNC (TO {otherDeckBpm})" shown on each deck)
  const handleBpmSync = (deck: "A" | "B") => {
    if (!trackA || !trackB) return;
    if (trackA.isLocalFile || trackB.isLocalFile) return; // BPM unknown for local emergency files
    if (deck === "A") {
      const targetBpm = trackB.bpm * (1 + pitchB / 100);
      const neededPitch = (targetBpm / trackA.bpm - 1) * 100;
      setPitchA(Math.max(-10, Math.min(10, neededPitch)));
    } else {
      const targetBpm = trackA.bpm * (1 + pitchA / 100);
      const neededPitch = (targetBpm / trackB.bpm - 1) * 100;
      setPitchB(Math.max(-10, Math.min(10, neededPitch)));
    }
  };

  const bpmA = trackA ? trackA.bpm * (1 + pitchA / 100) : 0;
  const bpmB = trackB ? trackB.bpm * (1 + pitchB / 100) : 0;

  // --- Auto DJ: read live playback progress regardless of local/external screen mode ---
  const getDeckProgress = (deck: "A" | "B"): { time: number; duration: number } => {
    const mode = deck === "A" ? screenModeA : screenModeB;
    const player = playersRef.current[deck];
    if (mode === "local" && player && typeof player.getCurrentTime === "function") {
      return { time: player.getCurrentTime(), duration: player.getDuration() || 0 };
    }
    return deck === "A"
      ? { time: currentTimeA, duration: durationA }
      : { time: currentTimeB, duration: durationB };
  };

  // Picks the closest track by BPM (with a genre-match bonus), avoiding recent repeats
  const pickNextAutoDjTrack = (fromTrack: DJTrack, excludeIds: Set<string>): DJTrack | null => {
    const notSelf = PRESET_TRACKS.filter((t) => t.id !== fromTrack.id);
    const fresh = notSelf.filter((t) => !excludeIds.has(t.id));
    const pool = fresh.length > 0 ? fresh : notSelf;
    if (pool.length === 0) return null;

    let best = pool[0];
    let bestScore = Infinity;
    for (const t of pool) {
      const bpmDiff = Math.abs(t.bpm - fromTrack.bpm);
      const genrePenalty = t.genre === fromTrack.genre ? 0 : 12;
      const score = bpmDiff + genrePenalty;
      if (score < bestScore) {
        bestScore = score;
        best = t;
      }
    }
    return best;
  };

  // Animates the crossfader from its current position to the incoming deck's side
  const runAutoDjCrossfade = (fromDeck: "A" | "B", toDeck: "A" | "B") => {
    if (autoDjCrossfadeTimerRef.current !== null) {
      window.clearInterval(autoDjCrossfadeTimerRef.current);
    }

    const stepMs = 100;
    const totalSteps = AUTO_DJ_CROSSFADE_MS / stepMs;
    const startCf = crossfader;
    const endCf = toDeck === "B" ? 100 : -100;
    let step = 0;

    autoDjCrossfadeTimerRef.current = window.setInterval(() => {
      step += 1;
      const t = Math.min(1, step / totalSteps);
      setCrossfader(Math.round(startCf + (endCf - startCf) * t));

      if (t >= 1) {
        if (autoDjCrossfadeTimerRef.current !== null) {
          window.clearInterval(autoDjCrossfadeTimerRef.current);
          autoDjCrossfadeTimerRef.current = null;
        }
        // The outgoing deck's job is done — eject it and hand control to the incoming deck
        handleResetTrack(fromDeck);
        autoDjActiveDeckRef.current = toDeck;
        autoDjTransitioningRef.current = false;
        setAutoDjStatus(`Auto DJ: Deck ${toDeck} en vivo. Esperando el próximo cambio automático...`);
      }
    }, stepMs);
  };

  // Loads & syncs the next track into the idle deck, then kicks off the crossfade
  const beginAutoDjTransition = (leadDeck: "A" | "B", leadTrack: DJTrack) => {
    autoDjTransitioningRef.current = true;
    const nextDeck: "A" | "B" = leadDeck === "A" ? "B" : "A";

    const nextTrack = pickNextAutoDjTrack(leadTrack, autoDjPlayedIdsRef.current);
    if (!nextTrack) {
      // Library exhausted — allow repeats on the next round instead of stalling forever
      autoDjPlayedIdsRef.current.clear();
      autoDjTransitioningRef.current = false;
      setAutoDjStatus("Auto DJ: no hay más pistas nuevas en la biblioteca, reiniciando selección...");
      return;
    }

    autoDjPlayedIdsRef.current.add(nextTrack.id);
    setAutoDjStatus(`Auto DJ: cargando "${nextTrack.title}" en Deck ${nextDeck}...`);
    handleLoadTrack(nextTrack, nextDeck);

    const leadPitch = leadDeck === "A" ? pitchA : pitchB;
    const leadActualBpm = leadTrack.bpm * (1 + leadPitch / 100);

    window.setTimeout(() => {
      // Skip tempo-matching if the leading deck's BPM is unknown (e.g. an emergency local file)
      if (leadTrack.bpm > 0) {
        const neededPitch = Math.max(-10, Math.min(10, (leadActualBpm / nextTrack.bpm - 1) * 100));
        if (nextDeck === "A") setPitchA(neededPitch);
        else setPitchB(neededPitch);
      }

      handlePlayPause(nextDeck);
      setAutoDjStatus(`Auto DJ: mezclando Deck ${leadDeck} → Deck ${nextDeck} ("${nextTrack.title}")`);
      runAutoDjCrossfade(leadDeck, nextDeck);
    }, 1200);
  };

  // Checked every second while Auto DJ is on; always reflects the latest render's state
  const runAutoDjTick = () => {
    if (!isAutoDjOn || autoDjTransitioningRef.current) return;
    const leadDeck = autoDjActiveDeckRef.current;
    if (!leadDeck) return;

    const leadTrack = leadDeck === "A" ? trackA : trackB;
    if (!leadTrack) return;

    const { time, duration } = getDeckProgress(leadDeck);
    if (duration <= 0) return;

    const remaining = duration - time;
    if (remaining > 0 && remaining <= AUTO_DJ_LEAD_SECONDS) {
      beginAutoDjTransition(leadDeck, leadTrack);
    }
  };

  // Keep the ref pointing at the freshest tick closure (avoids stale state in the interval below)
  useEffect(() => {
    autoDjTickRef.current = runAutoDjTick;
  });

  useEffect(() => {
    if (!isAutoDjOn) return;
    const interval = window.setInterval(() => autoDjTickRef.current(), 1000);
    return () => window.clearInterval(interval);
  }, [isAutoDjOn]);

  // Turns Auto DJ on/off, picking a leading deck (and bootstrapping one if both are empty)
  const handleToggleAutoDj = () => {
    if (isAutoDjOn) {
      if (autoDjCrossfadeTimerRef.current !== null) {
        window.clearInterval(autoDjCrossfadeTimerRef.current);
        autoDjCrossfadeTimerRef.current = null;
      }
      autoDjTransitioningRef.current = false;
      autoDjActiveDeckRef.current = null;
      setIsAutoDjOn(false);
      setAutoDjStatus("");
      return;
    }

    let leadDeck: "A" | "B" | null = null;
    if (isPlayingA) leadDeck = "A";
    else if (isPlayingB) leadDeck = "B";
    else if (trackA) leadDeck = "A";
    else if (trackB) leadDeck = "B";

    if (!leadDeck) {
      const starter = PRESET_TRACKS[Math.floor(Math.random() * PRESET_TRACKS.length)];
      autoDjPlayedIdsRef.current = new Set([starter.id]);
      handleLoadTrack(starter, "A");
      setCrossfader(-100);
      window.setTimeout(() => handlePlayPause("A"), 500);
      leadDeck = "A";
    } else {
      autoDjPlayedIdsRef.current = new Set([trackA?.id, trackB?.id].filter((id): id is string => !!id));
      setCrossfader(leadDeck === "A" ? -100 : 100);
      if (leadDeck === "A" && !isPlayingA) handlePlayPause("A");
      if (leadDeck === "B" && !isPlayingB) handlePlayPause("B");
    }

    autoDjActiveDeckRef.current = leadDeck;
    autoDjTransitioningRef.current = false;
    setAutoDjStatus(`Auto DJ activado. Deck ${leadDeck} liderando la sesión.`);
    setIsAutoDjOn(true);
  };

  if (!isLoggedIn) {
    return (
      <main className="min-h-screen bg-[#09090b] text-zinc-100 flex flex-col items-center justify-center p-4 relative overflow-hidden" id="login-root">
        {/* Decorative ambient blurred glowing circles */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="w-full max-w-md bg-zinc-950/80 backdrop-blur-xl rounded-2xl border border-zinc-800/80 p-8 shadow-2xl z-10 relative overflow-hidden">
          {/* Aesthetic grid line decor */}
          <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent animate-pulse" />
          
          <div className="text-center mb-8 select-none">
            <div className="mx-auto h-12 w-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 mb-4 shadow-[0_0_15px_rgba(6,182,212,0.15)]">
              <Disc className="w-6 h-6 animate-spin" style={{ animationDuration: "5s" }} />
            </div>
            <h1 className="text-xl font-black tracking-widest text-white uppercase">
              YOUTUBE MIX CONSOLE
            </h1>
            <p className="text-[10px] text-cyan-400 font-mono tracking-widest uppercase mt-1">
              PRO AUDIO HARDWARE v5.0
            </p>
            <p className="text-xs text-zinc-500 mt-2">
              Ingresa tu nombre artístico para inicializar la cabina de mezcla virtual.
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-[10px] font-mono tracking-widest text-zinc-400 uppercase mb-2">
                DJ STAGE NAME / ALIAS
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500">
                  <User className="w-4 h-4" />
                </span>
                <input
                  type="text"
                  required
                  placeholder="ej. DJ ALOK, DJ NEON..."
                  value={stageName}
                  onChange={(e) => setStageName(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-zinc-900 border border-zinc-800 rounded-xl text-sm font-bold text-white focus:outline-none focus:border-cyan-500/80 placeholder-zinc-600 transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-mono tracking-widest text-zinc-400 uppercase mb-2">
                CÓDIGO DE ACCESO (OPCIONAL)
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500">
                  <Lock className="w-4 h-4" />
                </span>
                <input
                  type="password"
                  placeholder="Dejar vacío o ingresa clave de sesión"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-zinc-900 border border-zinc-800 rounded-xl text-sm font-bold text-white focus:outline-none focus:border-cyan-500/80 placeholder-zinc-600 transition"
                />
              </div>
              <span className="text-[9px] text-zinc-600 font-mono mt-1.5 block">
                Recomendado: Clave de cabina predeterminada activa.
              </span>
            </div>

            {loginError && (
              <div className="p-3 rounded-lg bg-red-950/30 border border-red-900/50 flex gap-2 text-xs text-red-400 font-mono items-start">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{loginError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoggingIn}
              className={`w-full py-3 rounded-xl font-mono text-xs font-bold uppercase tracking-wider transition duration-300 flex items-center justify-center gap-2 ${
                isLoggingIn
                  ? "bg-zinc-900 border border-zinc-800 text-zinc-500 cursor-default"
                  : "bg-cyan-500 hover:bg-cyan-400 text-black shadow-[0_0_15px_rgba(6,182,212,0.3)] hover:shadow-[0_0_20px_rgba(6,182,212,0.5)] cursor-pointer"
              }`}
            >
              {isLoggingIn ? (
                <>
                  <Disc className="w-4 h-4 animate-spin" />
                  CONECTANDO CABINA...
                </>
              ) : (
                <>
                  INICIAR CABINA DE MEZCLA
                </>
              )}
            </button>
          </form>

          {/* Decorative hardware metrics */}
          <div className="border-t border-zinc-900 mt-6 pt-4 flex justify-between items-center text-[9px] font-mono text-zinc-600">
            <span>INPUT: CH-A / CH-B LINK</span>
            <span>SYSTEM STATUS: OK</span>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#09090b] text-zinc-100 flex flex-col justify-between" id="app-root">
      {/* ================= HEADER CONTROLS ================= */}
      <header className="bg-zinc-950 border-b border-zinc-900 px-6 py-4 flex flex-col md:flex-row items-center justify-between gap-4 select-none z-30" id="header-control">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
            <Disc className="w-5 h-5 animate-spin" style={{ animationDuration: "3s" }} />
          </div>
          <div>
            <h1 className="text-sm font-black tracking-widest text-white uppercase flex items-center gap-2">
              MIX CONSOLE {stageName ? `• DJ ${stageName}` : ""}
              <span className="text-[10px] bg-red-600 px-2 py-0.5 rounded text-white animate-pulse">PRO v5.0</span>
            </h1>
            <p className="text-[10px] text-zinc-500 font-mono tracking-wider">
              CONSOLA PROFESIONAL DE MEZCLA DE MÚSICA Y VIDEO DE DOBLE PANTALLA
            </p>
          </div>
        </div>

        {/* Multi-Screen Popout Launch Bar & Copilot Toggle */}
        <div className="flex flex-wrap items-center gap-2" id="popout-launch-bar">
          <button
            type="button"
            onClick={handleToggleAutoDj}
            disabled={isYTApiLoading}
            className={`flex items-center gap-1.5 px-3 py-1.5 font-mono text-xs font-bold rounded-lg border transition shadow-sm ${
              isYTApiLoading ? "opacity-50 cursor-not-allowed" : ""
            } ${
              isAutoDjOn
                ? "bg-emerald-950/80 border-emerald-500 text-emerald-300 shadow-[0_0_8px_rgba(16,185,129,0.3)]"
                : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-emerald-400 hover:border-emerald-800"
            }`}
            title="Activar/Desactivar Mezcla Automática (Auto DJ)"
            id="btn-toggle-autodj"
          >
            <Radio className="w-3.5 h-3.5" />
            AUTO DJ {isAutoDjOn ? "ON" : "OFF"}
          </button>

          <button
            type="button"
            onClick={() => setShowAiCopilot(!showAiCopilot)}
            className={`flex items-center gap-1.5 px-3 py-1.5 font-mono text-xs font-bold rounded-lg border transition shadow-sm ${
              showAiCopilot
                ? "bg-purple-950/80 border-purple-500 text-purple-300 shadow-[0_0_8px_rgba(147,51,234,0.3)]"
                : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-purple-400 hover:border-purple-800"
            }`}
            title="Activar/Desactivar Panel Copiloto de IA Gemini"
          >
            <Cpu className="w-3.5 h-3.5" />
            COPILOTO IA {showAiCopilot ? "ACTIVO" : "INACTIVO"}
          </button>

          <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider hidden xl:inline">|</span>
          
          <button
            type="button"
            onClick={() => {
              window.open(`${window.location.origin}${window.location.pathname}?player=dual`, 'dj_player_dual', 'width=1200,height=600');
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900 hover:bg-zinc-850 text-xs font-mono font-bold rounded-lg border border-zinc-800 text-zinc-300 hover:text-white transition shadow-sm"
            title="Abrir pantalla doble (A+B) para proyectores/televisores"
          >
            <Monitor className="w-3.5 h-3.5 text-cyan-400" />
            PANTALLA DUAL (A+B) ↗
          </button>

          <button
            type="button"
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900 hover:bg-red-950/40 hover:border-red-800/60 border border-zinc-800 text-xs font-mono font-bold rounded-lg text-zinc-400 hover:text-red-400 transition shadow-sm"
            title="Cerrar sesión de DJ"
          >
            <LogOut className="w-3.5 h-3.5 text-red-500" />
            SALIR
          </button>
        </div>

        {/* Dynamic Status Badges */}
        <div className="flex items-center gap-4 text-xs font-mono">
          <div className="flex items-center gap-1.5 bg-zinc-900 px-3 py-1.5 rounded-lg border border-zinc-800">
            <Laptop className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-zinc-400">API YOUTUBE:</span>
            {isYTApiLoading ? (
              <span className="text-amber-500 animate-pulse font-bold">CARGANDO...</span>
            ) : isYTApiReady ? (
              <span className="text-green-400 font-bold">ONLINE</span>
            ) : (
              <span className="text-red-500 font-bold">FALLIDO</span>
            )}
          </div>

          <div className="hidden lg:flex items-center gap-1.5 bg-zinc-900 px-3 py-1.5 rounded-lg border border-zinc-800">
            <Layers className="w-3.5 h-3.5 text-orange-400" />
            <span className="text-zinc-400">LATENCY:</span>
            <span className="text-green-400 font-bold">12ms</span>
          </div>

          <div className="bg-zinc-900 px-3 py-1.5 rounded-lg border border-zinc-800 flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
            <span className="text-zinc-500">MASTER TIME:</span>
            <span className="text-cyan-400 font-bold">{new Date().toLocaleTimeString()}</span>
          </div>
        </div>
      </header>

      {/* ================= MAIN DJ WORKSPACE ================= */}
      <section className="flex-1 p-4 lg:p-6 flex flex-col gap-6 z-20 max-w-[1700px] w-full mx-auto" id="dj-workspace">
        {isYTApiLoading && (
          <div className="flex-1 flex flex-col items-center justify-center py-20 gap-4 bg-zinc-950/60 rounded-3xl border border-zinc-900" id="loader-view">
            <Disc className="w-16 h-16 text-cyan-400 animate-spin" style={{ animationDuration: "2s" }} />
            <h2 className="text-lg font-mono font-bold tracking-widest text-zinc-200">INICIALIZANDO CONSOLA...</h2>
            <p className="text-xs text-zinc-500">Cargando módulos de renderizado y el reproductor de YouTube.</p>
          </div>
        )}

        {!isYTApiLoading && (
          <>
            {/* AUTO DJ STATUS BAR */}
            {isAutoDjOn && (
              <div
                className="flex items-center gap-3 bg-emerald-950/30 border border-emerald-700/40 rounded-xl px-4 py-2.5 text-xs font-mono"
                id="auto-dj-status-bar"
              >
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-emerald-400 font-bold tracking-wider">AUTO DJ ON AIR</span>
                </div>
                <span className="text-zinc-400 truncate">{autoDjStatus}</span>
              </div>
            )}

            {/* Row: Deck A | Central Mixer | Deck B */}
            {/* On phones in landscape (width < 1024px, so it never fights the lg: desktop layout),
                Deck A and Deck B sit side by side so both channels stay visible, with the
                Mixer moved full-width below them instead of squeezed into a third column. */}
            <div
              className="grid grid-cols-1 max-[1023px]:landscape:grid-cols-2 lg:grid-cols-12 gap-4 lg:gap-6 items-stretch"
              id="main-hardware-layout"
            >
              {/* DECK A (LEFT CDJ) */}
              <div className="max-[1023px]:landscape:col-span-1 lg:col-span-4" id="hardware-deck-a">
                <Deck
                  id="A"
                  track={trackA}
                  isPlaying={isPlayingA}
                  onPlayPause={() => handlePlayPause("A")}
                  onLoadTrack={() => {
                    handleLoadTrack(PRESET_TRACKS[0], "A");
                  }}
                  onResetTrack={() => handleResetTrack("A")}
                  pitch={pitchA}
                  setPitch={setPitchA}
                  effectiveVolume={calculateEffectiveVolume("A", crossfader, volA, masterVolume)}
                  syncBpm={() => handleBpmSync("A")}
                  otherDeckBpm={bpmB}
                  playerRef={{ current: playersRef.current.A }}
                  screenMode={screenModeA}
                  setScreenMode={setScreenModeA}
                  externalCurrentTime={currentTimeA}
                  externalDuration={durationA}
                  onSeek={(time) => handleSeek("A", time)}
                  onLoopChange={(active, start, end, beats) => handleLoopChange("A", active, start, end, beats)}
                  emergencyAudioRef={emergencyAudioRefA}
                  onLoadEmergencyFile={(file) => handleEmergencyFileSelected("A", file)}
                />
              </div>

              {/* MIXER (CENTER CONSOLE) */}
              <div
                className="max-[1023px]:landscape:col-span-2 max-[1023px]:landscape:order-3 lg:order-none lg:col-span-4"
                id="hardware-mixer"
              >
                <Mixer
                  // Deck A parameters
                  volA={volA}
                  setVolA={setVolA}
                  gainA={gainA}
                  setGainA={setGainA}
                  eqHighA={eqHighA}
                  setEqHighA={setEqHighA}
                  eqMidA={eqMidA}
                  setEqMidA={setEqMidA}
                  eqLowA={eqLowA}
                  setEqLowA={setEqLowA}
                  filterA={filterA}
                  setFilterA={setFilterA}
                  cueA={cueA}
                  setCueA={setCueA}
                  isPlayingA={isPlayingA}

                  // Deck B parameters
                  volB={volB}
                  setVolB={setVolB}
                  gainB={gainB}
                  setGainB={setGainB}
                  eqHighB={eqHighB}
                  setEqHighB={setEqHighB}
                  eqMidB={eqMidB}
                  setEqMidB={setEqMidB}
                  eqLowB={eqLowB}
                  setEqLowB={setEqLowB}
                  filterB={filterB}
                  setFilterB={setFilterB}
                  cueB={cueB}
                  setCueB={setCueB}
                  isPlayingB={isPlayingB}

                  // Master control parameters
                  crossfader={crossfader}
                  setCrossfader={setCrossfader}
                  masterVolume={masterVolume}
                  setMasterVolume={setMasterVolume}
                />
              </div>

              {/* DECK B (RIGHT CDJ) */}
              <div className="max-[1023px]:landscape:col-span-1 lg:col-span-4" id="hardware-deck-b">
                <Deck
                  id="B"
                  track={trackB}
                  isPlaying={isPlayingB}
                  onPlayPause={() => handlePlayPause("B")}
                  onLoadTrack={() => {
                    handleLoadTrack(PRESET_TRACKS[1], "B");
                  }}
                  onResetTrack={() => handleResetTrack("B")}
                  pitch={pitchB}
                  setPitch={setPitchB}
                  effectiveVolume={calculateEffectiveVolume("B", crossfader, volB, masterVolume)}
                  syncBpm={() => handleBpmSync("B")}
                  otherDeckBpm={bpmA}
                  playerRef={{ current: playersRef.current.B }}
                  screenMode={screenModeB}
                  setScreenMode={setScreenModeB}
                  externalCurrentTime={currentTimeB}
                  externalDuration={durationB}
                  onSeek={(time) => handleSeek("B", time)}
                  onLoopChange={(active, start, end, beats) => handleLoopChange("B", active, start, end, beats)}
                  emergencyAudioRef={emergencyAudioRefB}
                  onLoadEmergencyFile={(file) => handleEmergencyFileSelected("B", file)}
                />
              </div>
            </div>

            {/* GEMINI AI DJ CO-PILOT MODULE */}
            {showAiCopilot && (
              <div 
                className="bg-zinc-950/95 border border-purple-500/40 rounded-2xl p-4 sm:p-6 shadow-[0_0_25px_rgba(147,51,234,0.15)] flex flex-col md:flex-row gap-6 relative overflow-hidden" 
                id="gemini-copilot-module"
              >
                {/* Visual hardware accent bar */}
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-purple-500 via-indigo-500 to-purple-500 animate-pulse" />
                
                {/* Left Side: Controller Console with Input */}
                <div className="flex-1 space-y-4">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-purple-500 animate-ping shrink-0" />
                    <span className="text-xs font-mono font-black text-purple-400 tracking-widest uppercase">
                      GEMINI CO-PILOT AI DJ ENGINE v2.5
                    </span>
                  </div>
                  
                  <p className="text-xs text-zinc-400 font-sans leading-relaxed">
                    Escribe una instrucción para la Inteligencia Artificial. Ella analizará la consola (BPM, EQ, filtros, faders y pistas) y ejecutará una secuencia de mezcla profesional en tiempo real.
                  </p>
                  
                  <div className="flex gap-2 relative">
                    <input
                      type="text"
                      placeholder="ej. Sincroniza BPMs y haz transición gradual al Deck B, o pon un filtro..."
                      value={geminiPrompt}
                      onChange={(e) => setGeminiPrompt(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleAskGemini();
                      }}
                      disabled={isGeminiLoading}
                      className="flex-1 bg-zinc-900 border border-zinc-800 focus:border-purple-500 rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-600 focus:outline-none transition font-medium"
                    />
                    <button
                      onClick={() => handleAskGemini()}
                      disabled={isGeminiLoading || !geminiPrompt.trim()}
                      className={`px-5 py-3 rounded-xl font-mono text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition duration-300 shrink-0 ${
                        isGeminiLoading || !geminiPrompt.trim()
                          ? "bg-zinc-900 border border-zinc-800 text-zinc-600 cursor-default"
                          : "bg-purple-600 hover:bg-purple-500 text-white shadow-[0_0_15px_rgba(147,51,234,0.3)] hover:shadow-[0_0_20px_rgba(147,51,234,0.5)] cursor-pointer"
                      }`}
                    >
                      {isGeminiLoading ? (
                        <>
                          <Disc className="w-4 h-4 animate-spin" />
                          PROCESANDO...
                        </>
                      ) : (
                        <>
                          <Send className="w-3.5 h-3.5" />
                          MEZCLAR
                        </>
                      )}
                    </button>
                  </div>
                  
                  {/* Quick Preset Commands Tags */}
                  <div>
                    <span className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest block mb-2 font-bold">
                      COMANDOS RÁPIDOS DE MEZCLA EN UN CLIC:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        { label: "⚡ Sincronizar y Mezclar", prompt: "Sincroniza los BPMs del Deck A y Deck B, y pon el crossfader en el centro." },
                        { label: "🔊 Transición Suave a B", prompt: "Haz una transición progresiva y suave del Deck A al Deck B, bajando poco a poco el volumen y los bajos del Deck A, y subiendo el Deck B." },
                        { label: "🎧 Cargar Techno", prompt: "Busca y carga una pista de género Techno o Electronic en el Deck que esté vacío, y prepáralo para tocar." },
                        { label: "🎛️ Filtro de Agudos", prompt: "Sube el filtro de agudos (EQ High) del Deck activo para crear tensión antes de soltar el ritmo." },
                        { label: "🔇 Corte Rápido (Cut)", prompt: "Corta instantáneamente el sonido del Deck actual y pon todo el volumen en el otro deck." }
                      ].map((item, idx) => (
                        <button
                          key={idx}
                          onClick={() => handleAskGemini(item.prompt)}
                          disabled={isGeminiLoading}
                          className="px-2.5 py-1.5 bg-zinc-900/60 hover:bg-purple-950/30 border border-zinc-850 hover:border-purple-800 text-[10px] text-zinc-400 hover:text-purple-300 font-mono rounded-lg transition"
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                
                {/* Right Side: Log of reasoning and telemetry console */}
                <div className="w-full md:w-80 bg-zinc-900/40 border border-zinc-850 p-4 rounded-xl flex flex-col justify-between h-56 font-mono select-none">
                  <div className="space-y-3 overflow-y-auto flex-1 pr-1" style={{ maxHeight: "150px" }}>
                    <div className="text-[10px] text-zinc-500 font-bold uppercase border-b border-zinc-850 pb-1.5 flex justify-between items-center">
                      <span>TELEMETRÍA DE MEZCLA IA</span>
                      <span className="text-[8px] px-1.5 py-0.5 rounded bg-purple-950 border border-purple-800 text-purple-400">ONLINE</span>
                    </div>
                    
                    {isGeminiLoading ? (
                      <div className="flex flex-col items-center justify-center py-6 gap-2 text-zinc-500">
                        <Cpu className="w-5 h-5 text-purple-500 animate-bounce" />
                        <span className="text-[9px] animate-pulse">ESCUCHANDO ORDEN...</span>
                      </div>
                    ) : geminiError ? (
                      <div className="text-[10px] text-red-400 whitespace-pre-wrap leading-tight">
                        ERROR: {geminiError}
                      </div>
                    ) : geminiResponse ? (
                      <div className="space-y-2">
                        <div className="text-[10px] text-purple-300 leading-relaxed font-sans">
                          {geminiResponse.reasoning}
                        </div>
                        {geminiResponse.actions && geminiResponse.actions.length > 0 && (
                          <div className="space-y-1">
                            <span className="text-[8px] text-zinc-500 block uppercase font-bold">ACCIONES EJECUTADAS:</span>
                            {geminiResponse.actions.map((act: any, i: number) => (
                              <div key={i} className="text-[9px] text-green-400 flex items-center gap-1">
                                <span className="text-zinc-600">›</span>
                                <span>
                                  {act.target === "mixer" 
                                    ? `Mixer: ${act.action} -> ${act.value}` 
                                    : `${act.target === "deckA" ? "Deck A" : "Deck B"}: ${act.action} ${act.value !== undefined ? `(${act.value})` : ""}`}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-[9px] text-zinc-600 leading-normal">
                        Esperando orden... Haz clic en un comando rápido o escribe tu propia mezcla para iniciar la IA de control.
                      </div>
                    )}
                  </div>
                  
                  {/* Footer telemetry status line */}
                  <div className="border-t border-zinc-850 pt-2 flex justify-between text-[8px] text-zinc-600">
                    <span>HISTORY: {geminiHistory.length} LOGS</span>
                    <span>MODEL: GEMINI-2.5-FLASH</span>
                  </div>
                </div>
              </div>
            )}

            {/* Row: Music Library crate manager */}
            <div id="media-library-crate">
              <Library
                onLoadToDeck={handleLoadTrack}
                currentTrackA={trackA}
                currentTrackB={trackB}
              />
            </div>

            {/* Row: Playback History */}
            <div id="playback-history-section">
              <History
                history={playbackHistory}
                onRepeat={handleLoadTrack}
                onEditEntry={handleEditHistoryEntry}
                onDeleteEntry={handleDeleteHistoryEntry}
                onClearAll={handleClearHistory}
                currentTrackA={trackA}
                currentTrackB={trackB}
              />
            </div>
          </>
        )}
      </section>

      {/* ================= FOOTER / STATUS BAR ================= */}
      <footer className="bg-zinc-950 border-t border-zinc-900/80 py-3.5 px-6 flex justify-between items-center text-[10px] font-mono text-zinc-600 select-none z-10" id="footer-status">
        <div className="flex items-center gap-1.5">
          <HelpCircle className="w-3.5 h-3.5 text-zinc-500" />
          <span>GUÍA RÁPIDA: Doble clic en cualquier perilla giratoria (EQ/Filtros) para restaurar a 0dB.</span>
        </div>
        <div>
          <span>YOUTUBE DJ MIX STATION • MULTI-VIEW PRO CONSOLE</span>
        </div>
      </footer>
    </main>
  );
}
