import React, { useState, useEffect, useRef } from "react";
import { Search, Disc, Plus, Radio, Film, CheckCircle, Flame, FileInput, Trash2, Eye } from "lucide-react";
import { DJTrack } from "../types";
import { PRESET_TRACKS } from "../data/tracks";

interface LibraryProps {
  onLoadToDeck: (track: DJTrack, deck: "A" | "B") => void;
  currentTrackA: DJTrack | null;
  currentTrackB: DJTrack | null;
}

// localStorage keys — keeps custom YouTube links, BPM & genre edits across reloads/sessions
const LS_CUSTOM_TRACKS_KEY = "ytdj_custom_tracks";
const LS_BPM_OVERRIDES_KEY = "ytdj_bpm_overrides";
const LS_GENRE_OVERRIDES_KEY = "ytdj_genre_overrides";

function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export const Library: React.FC<LibraryProps> = ({
  onLoadToDeck,
  currentTrackA,
  currentTrackB
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedGenre, setSelectedGenre] = useState("All");
  const [customUrl, setCustomUrl] = useState("");
  const [customBpm, setCustomBpm] = useState("128");
  const [customTitle, setCustomTitle] = useState("");
  const [customArtist, setCustomArtist] = useState("");
  const [customGenre, setCustomGenre] = useState("Electronic");
  const [customTracks, setCustomTracks] = useState<DJTrack[]>(() => loadFromStorage(LS_CUSTOM_TRACKS_KEY, []));

  // BPM values tapped/confirmed from the Preview/Cue popout, keyed by track id
  const [bpmOverrides, setBpmOverrides] = useState<Record<string, number>>(() =>
    loadFromStorage(LS_BPM_OVERRIDES_KEY, {})
  );
  // Genre edits made directly in the track table, keyed by track id
  const [genreOverrides, setGenreOverrides] = useState<Record<string, string>>(() =>
    loadFromStorage(LS_GENRE_OVERRIDES_KEY, {})
  );
  const previewChannelRef = useRef<BroadcastChannel | null>(null);

  // Persist custom links + BPM/genre overrides locally so the DJ doesn't have to re-add them next time
  useEffect(() => {
    try { localStorage.setItem(LS_CUSTOM_TRACKS_KEY, JSON.stringify(customTracks)); } catch {}
  }, [customTracks]);

  useEffect(() => {
    try { localStorage.setItem(LS_BPM_OVERRIDES_KEY, JSON.stringify(bpmOverrides)); } catch {}
  }, [bpmOverrides]);

  useEffect(() => {
    try { localStorage.setItem(LS_GENRE_OVERRIDES_KEY, JSON.stringify(genreOverrides)); } catch {}
  }, [genreOverrides]);

  const handleGenreEdit = (id: string, newGenre: string) => {
    setGenreOverrides((prev) => ({ ...prev, [id]: newGenre }));
  };

  // Opens (or reuses) the isolated Preview/Cue popout and sends it this track
  const handleOpenPreview = (track: DJTrack) => {
    window.open(
      `${window.location.origin}${window.location.pathname}?player=preview`,
      "dj_player_preview",
      "width=420,height=680"
    );
    window.setTimeout(() => {
      previewChannelRef.current?.postMessage({ type: "LOAD_PREVIEW", track });
    }, 700);
  };

  // Listens for the BPM the DJ tapped out in the Preview/Cue popout
  useEffect(() => {
    const channel = new BroadcastChannel("youtube_dj_sync_channel");
    previewChannelRef.current = channel;

    channel.onmessage = (event) => {
      const { type, trackId, bpm } = event.data;
      if (type === "PREVIEW_BPM_DETECTED" && trackId && bpm) {
        setBpmOverrides((prev) => ({ ...prev, [trackId]: bpm }));
      }
    };

    return () => channel.close();
  }, []);

  // Genres list for filter pills
  const genres = ["All", "House", "Synthwave", "Techno", "Reggaeton", "Lofi Hip Hop"];

  // Merge presets and custom user tracks, applying any tapped BPM / edited genre overrides
  const allTracks = [...PRESET_TRACKS, ...customTracks].map((t) => ({
    ...t,
    ...(bpmOverrides[t.id] ? { bpm: bpmOverrides[t.id] } : {}),
    ...(genreOverrides[t.id] !== undefined ? { genre: genreOverrides[t.id] } : {}),
  }));

  // Filter tracklist based on search query and genre pill selection
  const filteredTracks = allTracks.filter((track) => {
    const matchesSearch =
      track.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      track.artist.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesGenre =
      selectedGenre === "All" || 
      track.genre.toLowerCase().includes(selectedGenre.toLowerCase());

    return matchesSearch && matchesGenre;
  });

  // Extract YouTube ID from link or fallback to pasting ID directly
  const extractYoutubeId = (url: string) => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return match && match[2].length === 11 ? match[2] : url.trim();
  };

  const handleAddCustomVideo = (e: React.FormEvent) => {
    e.preventDefault();
    const ytId = extractYoutubeId(customUrl);
    if (!ytId || ytId.length !== 11) {
      alert("Por favor introduce una URL o ID de YouTube válido (11 caracteres).");
      return;
    }

    const title = customTitle.trim() || `YouTube Video (${ytId})`;
    const artist = customArtist.trim() || "User Upload";
    const bpmVal = Number(customBpm) || 128;

    const newTrack: DJTrack = {
      id: `custom-${Date.now()}`,
      title,
      artist,
      bpm: bpmVal,
      genre: customGenre,
      duration: "3:30",
      youtubeId: ytId
    };

    setCustomTracks([newTrack, ...customTracks]);
    setCustomUrl("");
    setCustomTitle("");
    setCustomArtist("");
    setCustomBpm("128");
  };

  const deleteCustomTrack = (id: string) => {
    setCustomTracks(customTracks.filter((t) => t.id !== id));
  };

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-2xl flex flex-col gap-6" id="music-library">
      {/* Header and Genre Filters */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-zinc-800/80 pb-4">
        <div>
          <div className="flex items-center gap-2 text-sm font-bold text-zinc-300 font-mono">
            <Disc className="w-4 h-4 text-cyan-400 animate-spin" />
            BIBLIOTECA DE PISTAS (DJ CRATE)
          </div>
          <p className="text-xs text-zinc-500 mt-1">
            Carga canciones de demostración o añade cualquier video musical directamente desde YouTube pegando el enlace.
          </p>
        </div>

        {/* Filter pills */}
        <div className="flex flex-wrap gap-1.5">
          {genres.map((g) => (
            <button
              key={g}
              onClick={() => setSelectedGenre(g)}
              className={`px-3 py-1 text-[10px] font-mono font-bold uppercase rounded-full transition-all border ${
                selectedGenre === g
                  ? "bg-cyan-500/10 text-cyan-400 border-cyan-400/50 shadow-[0_0_6px_rgba(6,182,212,0.15)]"
                  : "bg-zinc-950 text-zinc-500 border-zinc-850 hover:border-zinc-800 hover:text-zinc-300"
              }`}
            >
              {g === "All" ? "TODO" : g}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ================= LEFT COLUMN: SEARCH & TRACKLIST TABLE ================= */}
        <div className="lg:col-span-8 flex flex-col gap-3">
          {/* Search bar */}
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
            <input
              type="text"
              placeholder="Buscar por título, artista o género..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800/80 rounded-xl py-2 pl-9 pr-4 text-xs font-mono text-zinc-200 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500"
            />
          </div>

          {/* Table Container */}
          <div className="bg-zinc-950 rounded-xl border border-zinc-800 shadow-inner overflow-hidden max-h-72 overflow-y-auto">
            <table className="w-full text-left border-collapse font-mono text-xs text-zinc-400">
              <thead>
                <tr className="border-b border-zinc-900 bg-zinc-900/40 text-[9px] tracking-widest text-zinc-500 font-bold uppercase select-none">
                  <th className="py-2 px-3">TÍTULO / ARTISTA</th>
                  <th className="py-2 px-1 text-center hidden sm:table-cell">BPM</th>
                  <th className="py-2 px-2 hidden sm:table-cell">GÉNERO</th>
                  <th className="py-2 px-2 text-center hidden md:table-cell">YOUTUBE ID</th>
                  <th className="py-2 px-3 text-right">ACCIONES</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-900">
                {filteredTracks.length > 0 ? (
                  filteredTracks.map((track) => {
                    const isLoadedOnA = currentTrackA?.id === track.id;
                    const isLoadedOnB = currentTrackB?.id === track.id;

                    return (
                      <tr
                        key={track.id}
                        className={`hover:bg-zinc-900/30 transition-colors ${
                          isLoadedOnA || isLoadedOnB ? "bg-zinc-900/10" : ""
                        }`}
                      >
                        <td className="py-2 px-3">
                          <div className="font-bold text-zinc-200 flex items-center gap-1.5 truncate max-w-[140px] xs:max-w-[180px] sm:max-w-[240px]">
                            {track.title}
                            {isLoadedOnA && (
                              <span className="text-[8px] px-1 py-0.5 rounded bg-cyan-950 border border-cyan-800 text-cyan-400 shrink-0">
                                DECK A
                              </span>
                            )}
                            {isLoadedOnB && (
                              <span className="text-[8px] px-1 py-0.5 rounded bg-orange-950 border border-orange-800 text-orange-400 shrink-0">
                                DECK B
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-zinc-500 mt-0.5 flex flex-wrap items-center gap-1.5 max-w-[140px] xs:max-w-[180px] sm:max-w-[240px] truncate">
                            <span>{track.artist}</span>
                            <span className="sm:hidden text-zinc-700">•</span>
                            <span className="sm:hidden text-zinc-400 font-bold">{track.bpm}BPM</span>
                            <span className="sm:hidden text-zinc-700">•</span>
                            <span className="sm:hidden text-zinc-500">{track.genre}</span>
                          </div>
                        </td>
                        <td className="py-2 px-1 text-center font-bold hidden sm:table-cell">
                          <span
                            className={bpmOverrides[track.id] ? "text-green-400" : "text-zinc-300"}
                            title={bpmOverrides[track.id] ? "BPM confirmado con Tap Tempo (Preview)" : undefined}
                          >
                            {track.bpm}
                          </span>
                        </td>
                        <td className="py-2 px-2 text-zinc-500 hidden sm:table-cell">
                          <input
                            type="text"
                            defaultValue={track.genre}
                            onBlur={(e) => {
                              const trimmed = e.target.value.trim();
                              if (trimmed && trimmed !== track.genre) {
                                handleGenreEdit(track.id, trimmed);
                              } else {
                                e.target.value = track.genre;
                              }
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                            }}
                            title="Editar género"
                            className="w-24 bg-zinc-900 px-1.5 py-0.5 rounded text-[10px] border border-zinc-800 text-zinc-400 focus:outline-none focus:border-cyan-500 focus:text-zinc-200"
                          />
                        </td>
                        <td className="py-2 px-2 text-center text-[10px] text-zinc-600 font-mono hidden md:table-cell">
                          {track.youtubeId}
                        </td>
                        <td className="py-2 px-3 text-right">
                          <div className="flex gap-1 justify-end items-center">
                            <button
                              onClick={() => handleOpenPreview(track)}
                              className="px-1.5 sm:px-2 py-1 text-[9px] font-bold border rounded uppercase transition bg-zinc-900 border-zinc-800 text-purple-400 hover:bg-purple-950/40 hover:border-purple-800/80"
                              title="Previsualizar aislado del mix y detectar BPM con Tap Tempo"
                            >
                              <Eye className="w-3 h-3 inline sm:hidden" />
                              <span className="hidden sm:inline">PREVIEW ↗</span>
                            </button>
                            <button
                              onClick={() => onLoadToDeck(track, "A")}
                              className={`px-1.5 sm:px-2 py-1 text-[9px] font-bold border rounded uppercase transition ${
                                isLoadedOnA
                                  ? "bg-cyan-500/20 text-cyan-400 border-cyan-500 shadow-[0_0_6px_rgba(6,182,212,0.2)] cursor-default"
                                  : "bg-zinc-900 border-zinc-800 text-cyan-400 hover:bg-cyan-950/40 hover:border-cyan-800/80"
                              }`}
                            >
                              <span className="hidden sm:inline">+ </span>DECK A
                            </button>
                            <button
                              onClick={() => onLoadToDeck(track, "B")}
                              className={`px-1.5 sm:px-2 py-1 text-[9px] font-bold border rounded uppercase transition ${
                                isLoadedOnB
                                  ? "bg-orange-500/20 text-orange-400 border-orange-500 shadow-[0_0_6px_rgba(249,115,22,0.2)] cursor-default"
                                  : "bg-zinc-900 border-zinc-800 text-orange-400 hover:bg-orange-950/40 hover:border-orange-800/80"
                              }`}
                            >
                              <span className="hidden sm:inline">+ </span>DECK B
                            </button>
                            {track.id.startsWith("custom-") && (
                              <button
                                onClick={() => deleteCustomTrack(track.id)}
                                className="p-1 text-zinc-600 hover:text-red-400 transition"
                                title="Borrar pista"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-zinc-600 text-xs italic">
                      No se encontraron canciones. Añade una personalizada abajo.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ================= RIGHT COLUMN: ADD CUSTOM VIDEO FORM ================= */}
        <div className="lg:col-span-4 bg-zinc-950 p-4 rounded-xl border border-zinc-800" id="add-custom-track-form">
          <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-400 font-mono mb-3">
            <Plus className="w-3.5 h-3.5 text-green-500" />
            NUEVO VIDEO DE YOUTUBE
          </div>

          <form onSubmit={handleAddCustomVideo} className="space-y-3.5 font-mono text-xs">
            <div>
              <label className="block text-[10px] text-zinc-500 mb-1 font-bold uppercase">URL o ID de YouTube</label>
              <input
                type="text"
                required
                value={customUrl}
                onChange={(e) => setCustomUrl(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=..."
                className="w-full bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1.5 text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-cyan-500 text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] text-zinc-500 mb-1 font-bold uppercase">Título</label>
                <input
                  type="text"
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  placeholder="Ej. Sweet Child O Mine"
                  className="w-full bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1.5 text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-cyan-500 text-xs"
                />
              </div>
              <div>
                <label className="block text-[10px] text-zinc-500 mb-1 font-bold uppercase">Artista / Creador</label>
                <input
                  type="text"
                  value={customArtist}
                  onChange={(e) => setCustomArtist(e.target.value)}
                  placeholder="Ej. Guns N Roses"
                  className="w-full bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1.5 text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-cyan-500 text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] text-zinc-500 mb-1 font-bold uppercase">BPM Base (Velocidad)</label>
                <input
                  type="number"
                  required
                  min="60"
                  max="220"
                  value={customBpm}
                  onChange={(e) => setCustomBpm(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1.5 text-zinc-300 focus:outline-none focus:border-cyan-500 text-xs font-mono"
                />
              </div>
              <div>
                <label className="block text-[10px] text-zinc-500 mb-1 font-bold uppercase">Género</label>
                <select
                  value={customGenre}
                  onChange={(e) => setCustomGenre(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded px-2 py-1.5 text-zinc-300 focus:outline-none focus:border-cyan-500 text-xs"
                >
                  <option value="Electronic">Electrónica</option>
                  <option value="House">House</option>
                  <option value="Techno">Techno</option>
                  <option value="Reggaeton">Reggaetón</option>
                  <option value="Hip Hop">Hip Hop</option>
                  <option value="Rock">Rock</option>
                  <option value="Pop">Pop</option>
                </select>
              </div>
            </div>

            <button
              type="submit"
              className="w-full bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 border border-cyan-500/40 rounded py-2 text-[10px] font-bold tracking-widest uppercase transition flex items-center justify-center gap-1.5"
            >
              <FileInput className="w-3.5 h-3.5" />
              AÑADIR A LA MESA DJ
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
