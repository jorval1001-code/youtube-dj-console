import React, { useEffect, useState } from "react";
import { Sliders, Volume2, Music, Shuffle } from "lucide-react";

interface RotaryKnobProps {
  label: string;
  min: number;
  max: number;
  value: number;
  onChange: (val: number) => void;
  defaultValue?: number;
  colorClass?: string;
}

export const RotaryKnob: React.FC<RotaryKnobProps> = ({
  label,
  min,
  max,
  value,
  onChange,
  defaultValue = 0,
  colorClass = "text-cyan-400"
}) => {
  const knobRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const startY = useRef(0);
  const startValue = useRef(0);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    startY.current = e.clientY;
    startValue.current = value;
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    setIsDragging(true);
    startY.current = e.touches[0].clientY;
    startValue.current = value;
    document.addEventListener("touchmove", handleTouchMove, { passive: false });
    document.addEventListener("touchend", handleTouchEnd);
  };

  const handleMouseMove = (e: MouseEvent) => {
    const deltaY = startY.current - e.clientY; // drag up to increase
    const range = max - min;
    const valuePerPixel = range / 150; // 150px drag for full range
    let newValue = startValue.current + deltaY * valuePerPixel;
    newValue = Math.max(min, Math.min(max, newValue));
    onChange(newValue);
  };

  const handleTouchMove = (e: TouchEvent) => {
    e.preventDefault(); // Stop page scrolling while twisting knob
    const deltaY = startY.current - e.touches[0].clientY;
    const range = max - min;
    const valuePerPixel = range / 150;
    let newValue = startValue.current + deltaY * valuePerPixel;
    newValue = Math.max(min, Math.min(max, newValue));
    onChange(newValue);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    document.removeEventListener("mousemove", handleMouseMove);
    document.removeEventListener("mouseup", handleMouseUp);
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    document.removeEventListener("touchmove", handleTouchMove);
    document.removeEventListener("touchend", handleTouchEnd);
  };

  useEffect(() => {
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("touchend", handleTouchEnd);
    };
  }, []);

  // Calculate rotation angle in degrees (from -135 to 135)
  const percentage = (value - min) / (max - min);
  const angle = -135 + percentage * 270;

  return (
    <div className="flex flex-col items-center justify-center select-none" id={`knob-container-${label.toLowerCase()}`}>
      <span className="text-[10px] uppercase tracking-wider text-gray-500 font-bold mb-1">{label}</span>
      <div
        ref={knobRef}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        onDoubleClick={() => onChange(defaultValue)}
        className={`relative w-12 h-12 rounded-full border-2 border-zinc-700 bg-zinc-800 cursor-pointer shadow-md flex items-center justify-center transition-shadow ${
          isDragging ? "ring-2 ring-zinc-500 shadow-lg shadow-zinc-900 cursor-grabbing" : ""
        }`}
        id={`knob-dial-${label.toLowerCase()}`}
      >
        {/* Notch indicator */}
        <div
          className="absolute w-1 h-3 bg-white top-1 rounded-full origin-bottom transition-transform"
          style={{
            transform: `rotate(${angle}deg)`,
            transformOrigin: "50% 100%"
          }}
        />
        {/* Inner center circle */}
        <div className="w-8 h-8 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-[8px] font-mono font-bold text-gray-400">
          {value > 0 ? `+${value.toFixed(0)}` : value.toFixed(0)}
        </div>
      </div>
      <span className={`text-[9px] mt-1 font-mono font-bold ${colorClass}`}>
        {value.toFixed(0)}dB
      </span>
    </div>
  );
};

// Reusable VU Meter Component
interface VUMeterProps {
  level: number; // 0 to 100
  isActive: boolean;
}

export const VUMeter: React.FC<VUMeterProps> = ({ level, isActive }) => {
  const numLEDs = 10;
  const activeLEDs = isActive ? Math.round((level / 100) * numLEDs) : 0;

  return (
    <div className="flex flex-col-reverse gap-[2px] bg-zinc-950 p-1 rounded border border-zinc-800 h-44 w-3.5 items-center justify-center shadow-inner">
      {Array.from({ length: numLEDs }).map((_, idx) => {
        const ledNum = idx + 1;
        const isLit = ledNum <= activeLEDs;
        
        let color = "bg-zinc-900";
        if (isLit) {
          if (ledNum >= 9) {
            color = "bg-red-500 shadow-[0_0_8px_#ef4444]";
          } else if (ledNum >= 7) {
            color = "bg-yellow-400 shadow-[0_0_8px_#facc15]";
          } else {
            color = "bg-green-500 shadow-[0_0_6px_#22c55e]";
          }
        }

        return (
          <div
            key={idx}
            className={`w-2 h-3.5 rounded-sm transition-all duration-75 ${color}`}
          />
        );
      })}
    </div>
  );
};

interface MixerProps {
  // Deck A State
  volA: number;
  setVolA: (v: number) => void;
  gainA: number;
  setGainA: (g: number) => void;
  eqHighA: number;
  setEqHighA: (h: number) => void;
  eqMidA: number;
  setEqMidA: (m: number) => void;
  eqLowA: number;
  setEqLowA: (l: number) => void;
  filterA: number; // -50 to 50
  setFilterA: (f: number) => void;
  cueA: boolean;
  setCueA: (c: boolean) => void;
  isPlayingA: boolean;

  // Deck B State
  volB: number;
  setVolB: (v: number) => void;
  gainB: number;
  setGainB: (g: number) => void;
  eqHighB: number;
  setEqHighB: (h: number) => void;
  eqMidB: number;
  setEqMidB: (m: number) => void;
  eqLowB: number;
  setEqLowB: (l: number) => void;
  filterB: number; // -50 to 50
  setFilterB: (f: number) => void;
  cueB: boolean;
  setCueB: (c: boolean) => void;
  isPlayingB: boolean;

  // Master States
  crossfader: number; // -100 to 100
  setCrossfader: (cf: number) => void;
  masterVolume: number;
  setMasterVolume: (mv: number) => void;
}

import { useRef } from "react";

export const Mixer: React.FC<MixerProps> = ({
  volA, setVolA, gainA, setGainA, eqHighA, setEqHighA, eqMidA, setEqMidA, eqLowA, setEqLowA, filterA, setFilterA, cueA, setCueA, isPlayingA,
  volB, setVolB, gainB, setGainB, eqHighB, setEqHighB, eqMidB, setEqMidB, eqLowB, setEqLowB, filterB, setFilterB, cueB, setCueB, isPlayingB,
  crossfader, setCrossfader, masterVolume, setMasterVolume
}) => {
  // Animated VU meters
  const [levelA, setLevelA] = useState(0);
  const [levelB, setLevelB] = useState(0);
  const [levelMaster, setLevelMaster] = useState(0);

  useEffect(() => {
    let animationFrame: number;

    const animateMeters = () => {
      // Simulate level A
      if (isPlayingA) {
        // base on volume and gain
        const base = (volA / 100) * (gainA / 100) * 80;
        const randomness = Math.random() * 25;
        // Factor in EQ average
        const eqFactor = (eqHighA + eqMidA + eqLowA + 36) / 72; // ~0.5 to 1.5
        const currentLevel = Math.max(5, Math.min(100, base * eqFactor + randomness));
        setLevelA(currentLevel);
      } else {
        setLevelA((prev) => Math.max(0, prev - 12));
      }

      // Simulate level B
      if (isPlayingB) {
        const base = (volB / 100) * (gainB / 100) * 80;
        const randomness = Math.random() * 25;
        const eqFactor = (eqHighB + eqMidB + eqLowB + 36) / 72;
        const currentLevel = Math.max(5, Math.min(100, base * eqFactor + randomness));
        setLevelB(currentLevel);
      } else {
        setLevelB((prev) => Math.max(0, prev - 12));
      }

      animationFrame = requestAnimationFrame(animateMeters);
    };

    animateMeters();
    return () => cancelAnimationFrame(animationFrame);
  }, [isPlayingA, isPlayingB, volA, gainA, eqHighA, eqMidA, eqLowA, volB, gainB, eqHighB, eqMidB, eqLowB]);

  // Master meter merges both channels factored by crossfader
  useEffect(() => {
    const cfFactorA = crossfader <= 0 ? 1 : Math.max(0, 1 - crossfader / 100);
    const cfFactorB = crossfader >= 0 ? 1 : Math.max(0, 1 + crossfader / 100);

    const effA = levelA * cfFactorA;
    const effB = levelB * cfFactorB;
    const blended = Math.max(effA, effB) * (masterVolume / 100);
    setLevelMaster(blended);
  }, [levelA, levelB, crossfader, masterVolume]);

  return (
    <div className="bg-zinc-900/90 rounded-2xl border border-zinc-800 p-3 sm:p-6 flex flex-col items-center justify-between shadow-2xl h-full backdrop-blur-md relative overflow-hidden" id="mixer-main">
      {/* Decorative metal background texture lines */}
      <div className="absolute inset-0 bg-gradient-to-b from-zinc-850/50 via-zinc-900/50 to-zinc-950/70 pointer-events-none" />
      <div className="absolute top-0 left-1/2 w-[1px] h-full bg-zinc-800/60 -translate-x-1/2 pointer-events-none" />

      {/* Header: Title / Mode */}
      <div className="w-full flex items-center justify-between mb-4 z-10">
        <div className="flex items-center gap-1.5 text-[10px] tracking-widest text-zinc-400 font-mono">
          <Sliders className="w-3.5 h-3.5 text-cyan-400" />
          MIXER CONTROL
        </div>
        <div className="h-2 w-2 rounded-full bg-green-500 shadow-[0_0_8px_#22c55e]" title="Console Status: Active" />
      </div>

      {/* Main Grid: Channel A | VU Meters & Master Control | Channel B */}
      <div className="w-full grid grid-cols-11 gap-1 items-stretch flex-1 z-10" id="mixer-grid">
        {/* ================= CHANNEL A ================= */}
        <div className="col-span-4 flex flex-col justify-between items-center bg-zinc-950/40 p-1.5 sm:p-3 rounded-xl border border-zinc-800/40" id="channel-a-mixer">
          {/* Channel Label */}
          <span className="text-[10px] font-mono font-bold tracking-widest text-cyan-400 mb-2">DECK A</span>

          {/* EQs & Gain */}
          <div className="grid grid-cols-2 gap-x-1 sm:gap-x-2 gap-y-3 sm:gap-y-4 w-full justify-items-center mb-4">
            <RotaryKnob label="GAIN" min={0} max={100} value={gainA} onChange={setGainA} defaultValue={50} colorClass="text-zinc-300" />
            <RotaryKnob label="FILTER" min={-50} max={50} value={filterA} onChange={setFilterA} defaultValue={0} colorClass={filterA < 0 ? "text-amber-500" : filterA > 0 ? "text-cyan-400" : "text-gray-400"} />
            <RotaryKnob label="HIGH" min={-12} max={12} value={eqHighA} onChange={setEqHighA} defaultValue={0} />
            <RotaryKnob label="MID" min={-12} max={12} value={eqMidA} onChange={setEqMidA} defaultValue={0} />
            <div className="col-span-2">
              <RotaryKnob label="LOW" min={-12} max={12} value={eqLowA} onChange={setEqLowA} defaultValue={0} />
            </div>
          </div>

          {/* Cue Headphone Button */}
          <button
            onClick={() => setCueA(!cueA)}
            className={`w-14 py-1.5 text-[10px] font-mono font-bold uppercase rounded-md tracking-wider border transition-all duration-150 ${
              cueA
                ? "bg-cyan-500/20 text-cyan-400 border-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.3)]"
                : "bg-zinc-800 text-zinc-500 border-transparent hover:text-zinc-300 hover:bg-zinc-700"
            }`}
            id="btn-cue-a"
          >
            CUE
          </button>

          {/* Volume Fader */}
          <div className="w-full flex flex-col items-center mt-4">
            <div className="relative h-32 w-10 flex items-center justify-center bg-zinc-950 rounded-lg border border-zinc-800 shadow-inner cursor-pointer">
              {/* Ticks markings */}
              <div className="absolute inset-y-2 left-1.5 flex flex-col justify-between text-[6px] font-mono text-zinc-600 select-none">
                <span>10</span><span>8</span><span>6</span><span>4</span><span>2</span><span>0</span>
              </div>
              <div className="absolute inset-y-2 right-1.5 flex flex-col justify-between text-[6px] font-mono text-zinc-600 select-none">
                <span>10</span><span>8</span><span>6</span><span>4</span><span>2</span><span>0</span>
              </div>
              {/* Slider Track line */}
              <div className="w-[3px] h-28 bg-zinc-900 rounded" />
              {/* Actual Fader Slider */}
              <input
                type="range"
                min="0"
                max="100"
                value={volA}
                onChange={(e) => setVolA(Number(e.target.value))}
                className="absolute opacity-0 cursor-pointer"
                style={{
                  // Sized as a horizontal slider BEFORE rotation (128px travel x 40px thickness),
                  // then centered and rotated so its hit area lines up with the visible vertical track.
                  // (Sizing this to the post-rotation 40x128 footprint instead — as it was before —
                  // makes the actual drag target a 128x40 box misaligned with what's drawn on screen.)
                  width: "128px",
                  height: "40px",
                  top: "50%",
                  left: "50%",
                  WebkitAppearance: "none",
                  transform: "translate(-50%, -50%) rotate(270deg)",
                }}
              />
              {/* Simulated DJ Fader Knob */}
              <div
                className="absolute w-8 h-4 bg-zinc-200 border-t border-b-2 border-zinc-400 rounded shadow-md pointer-events-none flex items-center justify-center"
                style={{
                  bottom: `${(volA / 100) * 92 + 8}px`,
                  transform: "translateY(50%)"
                }}
              >
                <div className="w-5 h-[2px] bg-red-600" />
              </div>
            </div>
            <span className="text-[10px] font-mono text-gray-500 mt-1">{volA}%</span>
          </div>
        </div>

        {/* ================= MIDDLE CORE (VU Meters & Master Control) ================= */}
        <div className="col-span-3 flex flex-col items-center justify-between p-1 bg-zinc-950/80 rounded-xl border border-zinc-800" id="mixer-center-core">
          {/* Master Gain & VU Title */}
          <div className="flex flex-col items-center mb-1">
            <span className="text-[8px] font-mono tracking-widest text-zinc-500 uppercase">MASTER</span>
            <RotaryKnob label="LOUD" min={0} max={100} value={masterVolume} onChange={setMasterVolume} defaultValue={80} colorClass="text-amber-500" />
          </div>

          {/* VU Meters Deck A | Master | Deck B */}
          <div className="flex gap-1 sm:gap-2 items-center justify-center my-2">
            <div className="flex flex-col items-center">
              <span className="text-[7px] font-mono text-cyan-400 mb-1 font-bold">A</span>
              <VUMeter level={levelA} isActive={isPlayingA} />
            </div>
            <div className="flex flex-col items-center">
              <span className="text-[7px] font-mono text-amber-500 mb-1 font-bold">MST</span>
              <VUMeter level={levelMaster} isActive={isPlayingA || isPlayingB} />
            </div>
            <div className="flex flex-col items-center">
              <span className="text-[7px] font-mono text-orange-400 mb-1 font-bold">B</span>
              <VUMeter level={levelB} isActive={isPlayingB} />
            </div>
          </div>

          {/* Equalizer Icon decorations */}
          <div className="flex flex-col items-center mb-2">
            <div className="flex items-center gap-1 bg-zinc-900 py-1 px-2 rounded border border-zinc-800">
              <Volume2 className="w-3 h-3 text-zinc-400" />
              <span className="text-[8px] font-mono font-bold text-zinc-400">MONITOR</span>
            </div>
          </div>
        </div>

        {/* ================= CHANNEL B ================= */}
        <div className="col-span-4 flex flex-col justify-between items-center bg-zinc-950/40 p-1.5 sm:p-3 rounded-xl border border-zinc-800/40" id="channel-b-mixer">
          {/* Channel Label */}
          <span className="text-[10px] font-mono font-bold tracking-widest text-orange-400 mb-2">DECK B</span>

          {/* EQs & Gain */}
          <div className="grid grid-cols-2 gap-x-1 sm:gap-x-2 gap-y-3 sm:gap-y-4 w-full justify-items-center mb-4">
            <RotaryKnob label="GAIN" min={0} max={100} value={gainB} onChange={setGainB} defaultValue={50} colorClass="text-zinc-300" />
            <RotaryKnob label="FILTER" min={-50} max={50} value={filterB} onChange={setFilterB} defaultValue={0} colorClass={filterB < 0 ? "text-amber-500" : filterB > 0 ? "text-cyan-400" : "text-gray-400"} />
            <RotaryKnob label="HIGH" min={-12} max={12} value={eqHighB} onChange={setEqHighB} defaultValue={0} />
            <RotaryKnob label="MID" min={-12} max={12} value={eqMidB} onChange={setEqMidB} defaultValue={0} />
            <div className="col-span-2">
              <RotaryKnob label="LOW" min={-12} max={12} value={eqLowB} onChange={setEqLowB} defaultValue={0} />
            </div>
          </div>

          {/* Cue Headphone Button */}
          <button
            onClick={() => setCueB(!cueB)}
            className={`w-14 py-1.5 text-[10px] font-mono font-bold uppercase rounded-md tracking-wider border transition-all duration-150 ${
              cueB
                ? "bg-orange-500/20 text-orange-400 border-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.3)]"
                : "bg-zinc-800 text-zinc-500 border-transparent hover:text-zinc-300 hover:bg-zinc-700"
            }`}
            id="btn-cue-b"
          >
            CUE
          </button>

          {/* Volume Fader */}
          <div className="w-full flex flex-col items-center mt-4">
            <div className="relative h-32 w-10 flex items-center justify-center bg-zinc-950 rounded-lg border border-zinc-800 shadow-inner cursor-pointer">
              {/* Ticks markings */}
              <div className="absolute inset-y-2 left-1.5 flex flex-col justify-between text-[6px] font-mono text-zinc-600 select-none">
                <span>10</span><span>8</span><span>6</span><span>4</span><span>2</span><span>0</span>
              </div>
              <div className="absolute inset-y-2 right-1.5 flex flex-col justify-between text-[6px] font-mono text-zinc-600 select-none">
                <span>10</span><span>8</span><span>6</span><span>4</span><span>2</span><span>0</span>
              </div>
              {/* Slider Track line */}
              <div className="w-[3px] h-28 bg-zinc-900 rounded" />
              {/* Actual Fader Slider */}
              <input
                type="range"
                min="0"
                max="100"
                value={volB}
                onChange={(e) => setVolB(Number(e.target.value))}
                className="absolute opacity-0 cursor-pointer"
                style={{
                  width: "128px",
                  height: "40px",
                  top: "50%",
                  left: "50%",
                  WebkitAppearance: "none",
                  transform: "translate(-50%, -50%) rotate(270deg)",
                }}
              />
              {/* Simulated DJ Fader Knob */}
              <div
                className="absolute w-8 h-4 bg-zinc-200 border-t border-b-2 border-zinc-400 rounded shadow-md pointer-events-none flex items-center justify-center"
                style={{
                  bottom: `${(volB / 100) * 92 + 8}px`,
                  transform: "translateY(50%)"
                }}
              >
                <div className="w-5 h-[2px] bg-red-600" />
              </div>
            </div>
            <span className="text-[10px] font-mono text-gray-500 mt-1">{volB}%</span>
          </div>
        </div>
      </div>

      {/* ================= CROSSFADER PANEL ================= */}
      <div className="w-full flex flex-col items-center mt-6 border-t border-zinc-800/80 pt-4 z-10" id="crossfader-container">
        <div className="flex items-center justify-between w-full text-[8px] font-mono text-zinc-500 px-4 mb-1 uppercase tracking-wider">
          <span>DECK A</span>
          <span>CROSSFADER</span>
          <span>DECK B</span>
        </div>
        <div className="relative w-4/5 h-10 bg-zinc-950 rounded-xl border border-zinc-800 shadow-inner flex items-center px-4 cursor-pointer">
          {/* Tic ticks */}
          <div className="absolute inset-x-4 top-1 flex justify-between text-[6px] font-mono text-zinc-700 select-none pointer-events-none">
            <span>|</span><span>|</span><span>|</span><span>|</span><span className="text-zinc-500">|</span><span>|</span><span>|</span><span>|</span><span>|</span>
          </div>
          {/* Track line */}
          <div className="w-full h-1 bg-zinc-900 rounded" />
          {/* Range input */}
          <input
            type="range"
            min="-100"
            max="100"
            value={crossfader}
            onChange={(e) => setCrossfader(Number(e.target.value))}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
          />
          {/* Slider Knob */}
          <div
            className="absolute w-10 h-6 bg-zinc-100 border border-zinc-300 rounded shadow-lg flex items-center justify-center pointer-events-none transition-transform hover:scale-105 active:scale-95"
            style={{
              left: `calc(${(crossfader + 100) / 200 * 100}% - 20px)`
            }}
          >
            <div className="w-[3px] h-4 bg-zinc-900 rounded-sm" />
          </div>
        </div>
        <div className="flex justify-between w-4/5 text-[9px] font-mono mt-1 text-gray-500">
          <span className={crossfader < 0 ? "text-cyan-400 font-bold" : ""}>{(crossfader < 0 ? Math.abs(crossfader) : 0).toFixed(0)}%</span>
          <span className={crossfader === 0 ? "text-amber-500 font-bold" : ""}>CENTER</span>
          <span className={crossfader > 0 ? "text-orange-400 font-bold" : ""}>{(crossfader > 0 ? crossfader : 0).toFixed(0)}%</span>
        </div>
      </div>
    </div>
  );
};
