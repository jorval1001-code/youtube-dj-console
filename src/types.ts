export interface DJTrack {
  id: string;
  title: string;
  artist: string;
  bpm: number;
  genre: string;
  duration: string;
  youtubeId: string;
  isLocalFile?: boolean; // true when loaded from a local MP3 (emergency/offline fallback), not YouTube
}

export interface DeckState {
  track: DJTrack | null;
  isPlaying: boolean;
  volume: number; // 0 to 100
  pitch: number; // -10 to +10 (percentage change in tempo)
  currentTime: number; // seconds
  duration: number; // seconds
  cuePoint: number | null; // seconds
  loopLength: number | null; // beats (or null if disabled)
  loopStartTime: number | null; // seconds
  eqHigh: number; // -12 to +12 dB (or 0 to 2 multiplier)
  eqMid: number; // -12 to +12 dB
  eqLow: number; // -12 to +12 dB
  gain: number; // 0 to 100
}

export interface GeminiSuggestion {
  trackTitle: string;
  artist: string;
  recommendedBpm: number;
  transitionStrategy: string;
  whyItFits: string;
  suggestedYoutubeQuery: string;
}
