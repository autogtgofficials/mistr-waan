"use client";

import { useEffect, useRef, useState } from "react";
import { trustCards } from "@/lib/mock/trust-cards";
import { useLocale } from "@/lib/i18n/client";
import { t } from "@/lib/i18n/dict";
import { cn } from "@/lib/utils";

const ROTATE_MS = 5000;

const TINT_CLASSES = {
  pulse: "bg-pulse-50 border-pulse-100 text-pulse-900",
  aqua: "bg-aqua-50 border-aqua-100 text-aqua-900",
  ignite: "bg-ignite-50 border-ignite-100 text-ignite-900",
} as const;

const ICON_TINT_CLASSES = {
  pulse: "text-pulse-600",
  aqua: "text-aqua-700",
  ignite: "text-ignite-600",
} as const;

export function HeroSlot() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const locale = useLocale();

  useEffect(() => {
    if (paused) return;
    const tHandle = window.setTimeout(
      () => setActiveIndex((i) => (i + 1) % trustCards.length),
      ROTATE_MS,
    );
    return () => window.clearTimeout(tHandle);
  }, [activeIndex, paused]);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const card = track.children[activeIndex] as HTMLElement | undefined;
    if (!card) return;
    track.scrollTo({ left: card.offsetLeft, behavior: "smooth" });
  }, [activeIndex]);

  function handleScroll() {
    const track = trackRef.current;
    if (!track) return;
    const cardWidth = track.firstElementChild?.clientWidth ?? track.clientWidth;
    if (cardWidth === 0) return;
    const next = Math.round(track.scrollLeft / cardWidth);
    if (next !== activeIndex) setActiveIndex(next);
  }

  return (
    <section aria-label="Featured" className="-mx-4">
      <div
        ref={trackRef}
        onScroll={handleScroll}
        onTouchStart={() => setPaused(true)}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        className="flex snap-x snap-mandatory overflow-x-auto scroll-px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {trustCards.map((card) => {
          const Icon = card.icon;
          return (
            <article
              key={card.id}
              className={cn(
                "ms-4 flex w-[calc(100%-2rem)] shrink-0 snap-start items-start gap-3 rounded-lg border p-4 last:me-4",
                TINT_CLASSES[card.tint],
              )}
            >
              <Icon
                className={cn("size-6 shrink-0", ICON_TINT_CLASSES[card.tint])}
                strokeWidth={2}
                aria-hidden
              />
              <p
                className={cn(
                  "text-base font-medium leading-snug",
                  locale === "ur" && "font-urdu",
                )}
              >
                {t(locale, card.headlineKey)}
              </p>
            </article>
          );
        })}
      </div>

      <div className="mt-3 flex items-center justify-center gap-1.5" role="tablist">
        {trustCards.map((card, i) => (
          <button
            key={card.id}
            type="button"
            role="tab"
            aria-selected={i === activeIndex}
            aria-label={`Show card ${i + 1}`}
            onClick={() => setActiveIndex(i)}
            className={cn(
              "tap h-1.5 rounded-full transition-all",
              i === activeIndex ? "w-6 bg-primary" : "w-1.5 bg-steel-300 hover:bg-steel-400",
            )}
          />
        ))}
      </div>
    </section>
  );
}
