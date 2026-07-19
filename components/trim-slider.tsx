'use client';

import React, { useRef } from 'react';
import { Scissors } from 'lucide-react';

interface TrimSliderProps {
  duration: number;
  trimStart: number;
  trimEnd: number;
  onChange: (start: number, end: number) => void;
  labels?: {
    trim?: string;
    start?: string;
    end?: string;
    duration?: string;
  };
}

export function TrimSlider({
  duration,
  trimStart,
  trimEnd,
  onChange,
  labels = {},
}: TrimSliderProps) {
  const max = duration > 0 ? duration : 1;
  const currentEnd = trimEnd > 0 ? trimEnd : max;
  const startPercent = Math.min(100, Math.max(0, (trimStart / max) * 100));
  const endPercent = Math.min(100, Math.max(0, (currentEnd / max) * 100));
  const selectedDuration = Math.max(0, currentEnd - trimStart);

  const containerRef = useRef<HTMLDivElement>(null);

  const handleStartChange = (val: number) => {
    const newStart = Math.min(val, Math.max(0, currentEnd - 0.1));
    onChange(Number(newStart.toFixed(1)), currentEnd);
  };

  const handleEndChange = (val: number) => {
    const newEnd = Math.max(val, Math.min(max, trimStart + 0.1));
    onChange(trimStart, Number(newEnd.toFixed(1)));
  };

  return (
    <div className="trim-panel rounded-sm border border-[#223029] bg-[#121815] p-4 font-tech-mono">
      {/* Header Info */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-[#223029] pb-3 text-xs">
        <div className="flex items-center gap-2 font-bold text-white">
          <Scissors className="h-4 w-4 text-[#00ff9d]" />
          <span>{labels.trim || 'TRIM RANGE'}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="rounded-sm bg-[#00ff9d]/10 px-2.5 py-1 text-[11px] font-bold text-[#00ff9d]">
            {selectedDuration.toFixed(1)}s Selected
          </span>
          <span className="text-[11px] text-slate-400">
            ({trimStart.toFixed(1)}s – {currentEnd.toFixed(1)}s / {max.toFixed(1)}s)
          </span>
        </div>
      </div>

      {/* Unified Dual-Thumb Track Container */}
      <div className="relative py-4" ref={containerRef}>
        {/* Background Track */}
        <div className="relative h-4 w-full rounded-sm bg-[#060908] border border-[#223029] overflow-hidden">
          {/* Dimmed Left Unselected Region */}
          <div
            className="absolute top-0 bottom-0 left-0 bg-black/60"
            style={{ width: `${startPercent}%` }}
          />

          {/* Active Emerald Selection Region */}
          <div
            className="absolute top-0 bottom-0 bg-[#00ff9d]/30 border-y border-[#00ff9d]/80"
            style={{
              left: `${startPercent}%`,
              width: `${Math.max(0, endPercent - startPercent)}%`,
            }}
          />

          {/* Dimmed Right Unselected Region */}
          <div
            className="absolute top-0 bottom-0 right-0 bg-black/60"
            style={{ width: `${100 - endPercent}%` }}
          />
        </div>

        {/* Dual Input Range Sliders Overlaid */}
        <input
          type="range"
          min={0}
          max={max}
          step={0.1}
          value={trimStart}
          onChange={(e) => handleStartChange(Number(e.target.value))}
          className="dual-range-thumb absolute inset-0 z-20 h-full w-full appearance-none bg-transparent pointer-events-none cursor-pointer accent-[#00ff9d]"
          aria-label={labels.start || 'Start time'}
        />
        <input
          type="range"
          min={0}
          max={max}
          step={0.1}
          value={currentEnd}
          onChange={(e) => handleEndChange(Number(e.target.value))}
          className="dual-range-thumb absolute inset-0 z-30 h-full w-full appearance-none bg-transparent pointer-events-none cursor-pointer accent-[#00ff9d]"
          aria-label={labels.end || 'End time'}
        />
      </div>

      {/* Fine-Tuning Micro Controls */}
      <div className="mt-2 grid grid-cols-2 gap-3 pt-2 text-xs">
        {/* Start Point Controls */}
        <div className="flex items-center justify-between rounded-sm border border-[#223029] bg-[#060908] px-3 py-1.5">
          <span className="text-[#8a9e95] text-[11px] font-bold">START: {trimStart.toFixed(1)}s</span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => handleStartChange(Math.max(0, trimStart - 1))}
              className="rounded-sm border border-[#223029] bg-[#121815] px-1.5 py-0.5 text-[10px] text-slate-300 hover:border-[#00ff9d] hover:text-[#00ff9d]"
              title="Minus 1 second"
            >
              -1s
            </button>
            <button
              type="button"
              onClick={() => handleStartChange(Math.min(currentEnd - 0.1, trimStart + 1))}
              className="rounded-sm border border-[#223029] bg-[#121815] px-1.5 py-0.5 text-[10px] text-slate-300 hover:border-[#00ff9d] hover:text-[#00ff9d]"
              title="Plus 1 second"
            >
              +1s
            </button>
          </div>
        </div>

        {/* End Point Controls */}
        <div className="flex items-center justify-between rounded-sm border border-[#223029] bg-[#060908] px-3 py-1.5">
          <span className="text-[#8a9e95] text-[11px] font-bold">END: {currentEnd.toFixed(1)}s</span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => handleEndChange(Math.max(trimStart + 0.1, currentEnd - 1))}
              className="rounded-sm border border-[#223029] bg-[#121815] px-1.5 py-0.5 text-[10px] text-slate-300 hover:border-[#00ff9d] hover:text-[#00ff9d]"
              title="Minus 1 second"
            >
              -1s
            </button>
            <button
              type="button"
              onClick={() => handleEndChange(Math.min(max, currentEnd + 1))}
              className="rounded-sm border border-[#223029] bg-[#121815] px-1.5 py-0.5 text-[10px] text-slate-300 hover:border-[#00ff9d] hover:text-[#00ff9d]"
              title="Plus 1 second"
            >
              +1s
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
