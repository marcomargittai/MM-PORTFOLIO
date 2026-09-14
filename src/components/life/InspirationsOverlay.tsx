"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { PATTERNS, type LifePattern } from "@/lib/life/patterns";
import { PatternThumb } from "./PatternThumb";

type InspirationsOverlayProps = {
  open: boolean;
  serifClassName: string;
  onClose: () => void;
  onSelect: (pattern: LifePattern) => void;
};

const CATEGORY_ORDER = [
  "gun",
  "setup",
  "oscillator",
  "spaceship",
  "puffer",
  "methuselah",
  "still-life",
];

function categoryLabel(value: string) {
  return value.replace(/[-_]/g, " ");
}

export function InspirationsOverlay({
  open,
  serifClassName,
  onClose,
  onSelect,
}: InspirationsOverlayProps) {
  const [hoverId, setHoverId] = useState<string | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  const groups = useMemo(() => {
    const featured = PATTERNS.filter((p) => p.featured);
    const rest = PATTERNS.filter((p) => !p.featured);
    const ordered = [...featured, ...rest];
    const map = new Map<string, LifePattern[]>();
    for (const pattern of ordered) {
      const list = map.get(pattern.category);
      if (list) list.push(pattern);
      else map.set(pattern.category, [pattern]);
    }
    return [...map.entries()]
      .sort((a, b) => CATEGORY_ORDER.indexOf(a[0]) - CATEGORY_ORDER.indexOf(b[0]))
      .map(([key, items]) => ({ key, label: categoryLabel(key), items }));
  }, []);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="inspirations-title"
      className="fixed inset-0 z-50 overflow-y-auto bg-black text-white"
    >
      <div className="mx-auto min-h-dvh w-full max-w-6xl px-5 py-8 sm:px-10 sm:py-12 md:px-16 md:py-16">
        <header className="mb-14 flex items-start justify-between gap-8">
          <div className="space-y-4">
            <p className="text-[10px] uppercase tracking-[0.28em] text-white/40">Archive</p>
            <h2
              id="inspirations-title"
              className={`${serifClassName} text-[40px] leading-none italic md:text-[64px]`}
            >
              Inspirations
            </h2>
            <p className={`${serifClassName} max-w-[28ch] text-[18px] leading-snug text-white/55 italic`}>
              The forms that made Life famous. Click one and it takes the field.
            </p>
          </div>
          <button
            ref={closeRef}
            type="button"
            className="bg-transparent p-0 pt-2 text-[11px] uppercase tracking-[0.22em] text-white transition-opacity duration-200 hover:opacity-40"
            onClick={onClose}
          >
            Close
          </button>
        </header>

        <div className="flex flex-col gap-16 pb-24">
          {groups.map((group) => (
            <section key={group.key} className="space-y-5">
              <h3 className="text-[10px] uppercase tracking-[0.28em] text-white/35">{group.label}</h3>
              <ul>
                {group.items.map((pattern, index) => {
                  const active = hoverId === pattern.id;
                  return (
                    <li key={pattern.id}>
                      <button
                        type="button"
                        className="flex w-full items-center gap-6 border-t border-white/10 bg-transparent py-5 text-left transition-opacity duration-200 hover:opacity-70"
                        onMouseEnter={() => setHoverId(pattern.id)}
                        onFocus={() => setHoverId(pattern.id)}
                        onClick={() => onSelect(pattern)}
                      >
                        <span className="w-8 shrink-0 text-[10px] uppercase tracking-[0.22em] text-white/30 tabular-nums">
                          {String(index + 1).padStart(2, "0")}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className={`${serifClassName} block text-[26px] leading-none italic md:text-[34px]`}>
                            {pattern.name}
                          </span>
                          <span className="mt-2 block max-w-xl text-[13px] leading-relaxed text-white/40">
                            {pattern.description}
                          </span>
                        </span>
                        <span className="hidden shrink-0 text-[10px] uppercase tracking-[0.22em] text-white/30 sm:block">
                          {pattern.period ? `p${pattern.period}` : pattern.category}
                        </span>
                        <PatternThumb pattern={pattern} active={active || hoverId === null} />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
