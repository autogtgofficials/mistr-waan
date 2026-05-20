"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Hourly slot picker — date strip + time chips.
 *
 * Mock V0: 7 days starting today, 10 AM – 7 PM hourly. Some slots are
 * deterministically marked unavailable so the UI shows mixed states.
 */

export interface SlotValue {
  date: string; // ISO yyyy-mm-dd
  time: string; // 24h "16:00"
  label: string; // "Today, 8 May · 4 PM"
}

interface SlotPickerProps {
  initial?: SlotValue;
  onChange?: (value: SlotValue | null) => void;
}

const TIMES = ["10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00", "19:00"];

function formatHour(time: string) {
  const [h] = time.split(":").map(Number);
  if (h === 12) return "12 PM";
  if (h === 0) return "12 AM";
  return h > 12 ? `${h - 12} PM` : `${h} AM`;
}

function isUnavailable(dateIdx: number, time: string) {
  // Deterministic mock: skip every 3rd slot starting at offset (dateIdx)
  const idx = TIMES.indexOf(time);
  return (idx + dateIdx) % 3 === 2;
}

function isPast(dateIdx: number, time: string) {
  if (dateIdx > 0) return false;
  const now = new Date();
  const [h] = time.split(":").map(Number);
  return h <= now.getHours();
}

function dateStripLabels(): { iso: string; label: string; sub: string }[] {
  const result: { iso: string; label: string; sub: string }[] = [];
  const now = new Date();
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  for (let i = 0; i < 7; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() + i);
    const iso = d.toISOString().slice(0, 10);
    const label = i === 0 ? "Today" : i === 1 ? "Tomr" : days[d.getDay()];
    const sub = `${d.getDate()} ${months[d.getMonth()]}`;
    result.push({ iso, label, sub });
  }
  return result;
}

export function SlotPicker({ initial, onChange }: SlotPickerProps) {
  const dates = useMemo(() => dateStripLabels(), []);
  const [activeDateIdx, setActiveDateIdx] = useState(0);
  const [picked, setPicked] = useState<SlotValue | null>(initial ?? null);

  function pickTime(time: string) {
    const date = dates[activeDateIdx];
    const value: SlotValue = {
      date: date.iso,
      time,
      label: `${date.label}, ${date.sub} · ${formatHour(time)}`,
    };
    setPicked(value);
    onChange?.(value);
  }

  return (
    <div>
      {/* Date strip */}
      <div className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex gap-2">
          {dates.map((d, i) => {
            const isActive = i === activeDateIdx;
            return (
              <button
                key={d.iso}
                type="button"
                onClick={() => setActiveDateIdx(i)}
                className={cn(
                  "tap flex shrink-0 flex-col items-center justify-center rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "bg-card border border-border text-foreground hover:bg-muted",
                )}
              >
                <span className="text-xs leading-tight">{d.label}</span>
                <span className="tabular text-sm leading-tight font-semibold">{d.sub}</span>
              </button>
            );
          })}
        </div>
      </div>

      <h2 className="mt-6 text-base font-semibold text-foreground">
        {dates[activeDateIdx].label}, {dates[activeDateIdx].sub}
      </h2>

      <div className="mt-3 grid grid-cols-4 gap-2">
        {TIMES.map((t) => {
          const unavailable = isUnavailable(activeDateIdx, t);
          const past = isPast(activeDateIdx, t);
          const disabled = unavailable || past;
          const isPicked =
            picked?.date === dates[activeDateIdx].iso && picked?.time === t;
          return (
            <button
              key={t}
              type="button"
              onClick={() => !disabled && pickTime(t)}
              disabled={disabled}
              className={cn(
                "tap h-12 rounded-md text-sm font-medium transition-colors",
                isPicked
                  ? "bg-primary text-primary-foreground"
                  : disabled
                    ? "bg-muted/50 text-muted-foreground line-through cursor-not-allowed"
                    : "bg-card border border-border text-foreground hover:border-primary",
              )}
            >
              {formatHour(t)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
