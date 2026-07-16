import React from "react";
import { History as HistoryIcon, RotateCcw, Trash2, XCircle } from "lucide-react";
import { DJTrack } from "../types";

export interface HistoryEntry {
  entryId: string;
  track: DJTrack;
  deck: "A" | "B";
  playedAt: number;
}

interface HistoryProps {
  history: HistoryEntry[];
  onRepeat: (track: DJTrack, deck: "A" | "B") => void;
  onEditEntry: (entryId: string, changes: Partial<DJTrack>) => void;
  onDeleteEntry: (entryId: string) => void;
  onClearAll: () => void;
  currentTrackA: DJTrack | null;
  currentTrackB: DJTrack | null;
}

export const History: React.FC<HistoryProps> = ({
  history,
  onRepeat,
  onEditEntry,
  onDeleteEntry,
  onClearAll,
  currentTrackA,
  currentTrackB,
}) => {
  const formatWhen = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-2xl flex flex-col gap-4" id="playback-history">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 border-b border-zinc-800/80 pb-4">
        <div>
          <div className="flex items-center gap-2 text-sm font-bold text-zinc-300 font-mono">
            <HistoryIcon className="w-4 h-4 text-amber-400" />
            HISTORIAL DE REPRODUCCIÓN
          </div>
          <p className="text-xs text-zinc-500 mt-1">
            Registro de pistas cargadas en esta cabina — se guarda localmente en este navegador, incluso si recargás la página.
          </p>
        </div>
        {history.length > 0 && (
          <button
            onClick={onClearAll}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] font-mono font-bold uppercase rounded-lg border border-zinc-800 text-zinc-500 hover:text-red-400 hover:border-red-900/60 transition shrink-0"
          >
            <XCircle className="w-3.5 h-3.5" />
            Limpiar historial
          </button>
        )}
      </div>

      {history.length === 0 ? (
        <div className="text-center text-zinc-600 text-xs italic py-6">
          Todavía no se cargó ninguna pista en esta sesión.
        </div>
      ) : (
        <div className="bg-zinc-950 rounded-xl border border-zinc-800 shadow-inner overflow-hidden max-h-72 overflow-y-auto">
          <table className="w-full text-left border-collapse font-mono text-xs text-zinc-400">
            <thead>
              <tr className="border-b border-zinc-900 bg-zinc-900/40 text-[9px] tracking-widest text-zinc-500 font-bold uppercase select-none">
                <th className="py-2 px-3">TÍTULO / ARTISTA</th>
                <th className="py-2 px-1 text-center hidden sm:table-cell">BPM</th>
                <th className="py-2 px-2 hidden sm:table-cell">GÉNERO</th>
                <th className="py-2 px-2 text-center hidden md:table-cell">HORA / DECK</th>
                <th className="py-2 px-3 text-right">ACCIONES</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-900">
              {history.map((entry) => (
                <tr key={entry.entryId} className="hover:bg-zinc-900/30 transition-colors">
                  <td className="py-2 px-3">
                    <div className="font-bold text-zinc-200 truncate max-w-[140px] xs:max-w-[180px] sm:max-w-[220px]">
                      {entry.track.title}
                    </div>
                    <div className="text-[10px] text-zinc-500 mt-0.5 flex flex-wrap items-center gap-1.5 truncate max-w-[140px] xs:max-w-[180px] sm:max-w-[220px]">
                      <span>{entry.track.artist}</span>
                      <span className="sm:hidden text-zinc-700">•</span>
                      <span className="sm:hidden text-zinc-400 font-bold">{entry.track.bpm}BPM</span>
                      <span className="md:hidden text-zinc-700">•</span>
                      <span className="md:hidden text-zinc-600">{formatWhen(entry.playedAt)} DECK {entry.deck}</span>
                    </div>
                  </td>
                  <td className="py-2 px-1 text-center hidden sm:table-cell">
                    <input
                      type="number"
                      defaultValue={entry.track.bpm}
                      onBlur={(e) => {
                        const v = Number(e.target.value);
                        if (!isNaN(v) && v > 0 && v !== entry.track.bpm) onEditEntry(entry.entryId, { bpm: v });
                        else e.target.value = String(entry.track.bpm);
                      }}
                      className="w-14 bg-zinc-900 px-1 py-0.5 rounded text-[10px] border border-zinc-800 text-zinc-300 text-center focus:outline-none focus:border-cyan-500"
                    />
                  </td>
                  <td className="py-2 px-2 hidden sm:table-cell">
                    <input
                      type="text"
                      defaultValue={entry.track.genre}
                      onBlur={(e) => {
                        const trimmed = e.target.value.trim();
                        if (trimmed && trimmed !== entry.track.genre) onEditEntry(entry.entryId, { genre: trimmed });
                        else e.target.value = entry.track.genre;
                      }}
                      className="w-24 bg-zinc-900 px-1.5 py-0.5 rounded text-[10px] border border-zinc-800 text-zinc-400 focus:outline-none focus:border-cyan-500"
                    />
                  </td>
                  <td className="py-2 px-2 text-center text-[10px] text-zinc-600 hidden md:table-cell">
                    {formatWhen(entry.playedAt)} • DECK {entry.deck}
                  </td>
                  <td className="py-2 px-3 text-right">
                    <div className="flex gap-1 justify-end items-center">
                      <button
                        onClick={() => onRepeat(entry.track, "A")}
                        disabled={!!currentTrackA && currentTrackA.id === entry.track.id}
                        className="px-1.5 sm:px-2 py-1 text-[9px] font-bold border rounded uppercase transition bg-zinc-900 border-zinc-800 text-cyan-400 hover:bg-cyan-950/40 hover:border-cyan-800/80 disabled:opacity-40 disabled:cursor-not-allowed"
                        title="Repetir en Deck A"
                      >
                        <RotateCcw className="w-3 h-3 inline sm:hidden" />
                        <span className="hidden sm:inline">A</span>
                      </button>
                      <button
                        onClick={() => onRepeat(entry.track, "B")}
                        disabled={!!currentTrackB && currentTrackB.id === entry.track.id}
                        className="px-1.5 sm:px-2 py-1 text-[9px] font-bold border rounded uppercase transition bg-zinc-900 border-zinc-800 text-orange-400 hover:bg-orange-950/40 hover:border-orange-800/80 disabled:opacity-40 disabled:cursor-not-allowed"
                        title="Repetir en Deck B"
                      >
                        <RotateCcw className="w-3 h-3 inline sm:hidden" />
                        <span className="hidden sm:inline">B</span>
                      </button>
                      <button
                        onClick={() => onDeleteEntry(entry.entryId)}
                        className="p-1 text-zinc-600 hover:text-red-400 transition"
                        title="Eliminar del historial"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
