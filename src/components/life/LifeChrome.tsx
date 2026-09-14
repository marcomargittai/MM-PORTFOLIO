"use client";

type LifeChromeProps = {
  serifClassName: string;
  playing: boolean;
  status: string;
  speed: number;
  speedMin: number;
  speedMax: number;
  generation: number;
  overlayOpen: boolean;
  onTogglePlay: () => void;
  onStep: () => void;
  onClear: () => void;
  onChance: () => void;
  onSpeed: (value: number) => void;
  onInspirations: () => void;
};

const word =
  "cursor-pointer bg-transparent p-0 text-[11px] font-medium uppercase tracking-[0.22em] text-white transition-opacity duration-200 hover:opacity-45 focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-4 focus-visible:outline-white";

function formatGen(n: number): string {
  return n.toLocaleString("en-US");
}

export function LifeChrome({
  serifClassName,
  playing,
  status,
  speed,
  speedMin,
  speedMax,
  generation,
  overlayOpen,
  onTogglePlay,
  onStep,
  onClear,
  onChance,
  onSpeed,
  onInspirations,
}: LifeChromeProps) {
  const verbs = [
    { label: playing ? "Pause" : "Play", onClick: onTogglePlay },
    { label: "Step", onClick: onStep },
    { label: "Clear", onClick: onClear },
    { label: "Chance", onClick: onChance },
  ];

  return (
    <>
      <header className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between px-5 pt-5 mix-blend-difference sm:px-8 sm:pt-8 md:px-12 md:pt-10">
        <div>
          <h1 className={`${serifClassName} text-[34px] leading-none text-white italic sm:text-[44px] md:text-[52px]`}>
            MM
          </h1>
          <p className={`${serifClassName} mt-3 hidden max-w-[16ch] text-[22px] leading-[0.95] text-white italic sm:block md:text-[28px]`}>
            Form that keeps living.
          </p>
        </div>
        <button type="button" className={`${word} pointer-events-auto pt-2`} onClick={onInspirations}>
          {overlayOpen ? "Close" : "Inspirations"}
        </button>
      </header>

      <footer className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex flex-col gap-6 px-5 pb-5 mix-blend-difference sm:px-8 sm:pb-8 md:flex-row md:items-end md:justify-between md:px-12 md:pb-10">
        <div className="flex flex-col gap-3">
          <p className="text-[10px] uppercase tracking-[0.22em] text-white/70" aria-live="polite">
            {status}
          </p>
          <nav aria-label="Life" className="pointer-events-auto flex flex-wrap items-center gap-x-3 gap-y-2">
            {verbs.map((verb, index) => (
              <span key={verb.label} className="flex items-center gap-3">
                {index > 0 && (
                  <span aria-hidden className="text-[11px] tracking-[0.22em] opacity-35">
                    ·
                  </span>
                )}
                <button type="button" className={word} onClick={verb.onClick}>
                  {verb.label}
                </button>
              </span>
            ))}
          </nav>
        </div>

        <div className="pointer-events-auto flex w-full max-w-xs flex-col gap-3 md:w-64">
          <label className="flex flex-col gap-2">
            <span className="flex items-baseline justify-between text-[10px] uppercase tracking-[0.22em]">
              <span>Pace</span>
              <span className="tabular-nums">
                {speed}
                <span className="opacity-40"> /s</span>
              </span>
            </span>
            <div className="relative flex h-7 items-center">
              <div aria-hidden className="pointer-events-none absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-white" />
              <input
                type="range"
                min={speedMin}
                max={speedMax}
                step={1}
                value={speed}
                aria-label="Play speed in generations per second"
                className="relative z-10 h-7 w-full cursor-ew-resize appearance-none bg-transparent [&::-moz-range-thumb]:h-2 [&::-moz-range-thumb]:w-2 [&::-moz-range-thumb]:rounded-none [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-white [&::-moz-range-track]:h-px [&::-moz-range-track]:bg-white [&::-webkit-slider-runnable-track]:h-px [&::-webkit-slider-runnable-track]:bg-transparent [&::-webkit-slider-thumb]:h-2 [&::-webkit-slider-thumb]:w-2 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-none [&::-webkit-slider-thumb]:bg-white"
                onChange={(event) => onSpeed(Number(event.target.value))}
              />
            </div>
          </label>
          <p className="text-[10px] uppercase tracking-[0.22em] text-white/40 tabular-nums">
            Gen. {formatGen(generation)}
          </p>
        </div>
      </footer>
    </>
  );
}
