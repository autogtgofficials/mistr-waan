"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Photo upload — drag/drop or tap-to-pick. V0 mock: we hold object URLs in
 * local state and report the count + names to the parent. Files don't
 * persist across navigation in V0 — fine for the demo.
 */

interface PhotoUploadProps {
  max?: number;
  onChange: (count: number, names: string[]) => void;
}

export function PhotoUpload({ max = 6, onChange }: PhotoUploadProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [previews, setPreviews] = useState<{ url: string; name: string }[]>([]);

  useEffect(() => {
    onChange(previews.length, previews.map((p) => p.name));
  }, [previews, onChange]);

  function pick(files: FileList | null) {
    if (!files) return;
    const incoming = Array.from(files)
      .slice(0, max - previews.length)
      .map((f) => ({ url: URL.createObjectURL(f), name: f.name }));
    setPreviews((prev) => [...prev, ...incoming]);
  }

  function remove(idx: number) {
    setPreviews((prev) => {
      URL.revokeObjectURL(prev[idx].url);
      return prev.filter((_, i) => i !== idx);
    });
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        capture="environment"
        className="sr-only"
        onChange={(e) => pick(e.target.files)}
      />

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={previews.length >= max}
        className={cn(
          "tap flex h-40 w-full flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed text-center transition-colors",
          previews.length >= max
            ? "border-steel-200 bg-muted/40 text-muted-foreground cursor-not-allowed"
            : "border-steel-300 bg-card text-foreground hover:border-primary hover:bg-primary-soft",
        )}
      >
        <Camera className="size-8" strokeWidth={1.75} />
        <span className="text-sm font-medium">
          {previews.length >= max
            ? `Max ${max} photos`
            : `Tap to add a photo${previews.length === 0 ? "" : ` (${previews.length}/${max})`}`}
        </span>
        <span className="text-xs text-muted-foreground">
          {previews.length < max ? "Camera or gallery" : ""}
        </span>
      </button>

      {previews.length > 0 ? (
        <ul className="mt-3 grid grid-cols-3 gap-2">
          {previews.map((p, i) => (
            <li key={p.url} className="relative aspect-square overflow-hidden rounded-md">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.url}
                alt={`Damage photo ${i + 1}`}
                className="size-full object-cover"
              />
              <button
                type="button"
                onClick={() => remove(i)}
                aria-label="Remove photo"
                className="tap absolute right-1 top-1 flex size-7 items-center justify-center rounded-full bg-black/60 text-white"
              >
                <X className="size-4" strokeWidth={2.5} />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
