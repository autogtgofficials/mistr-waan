"use client";

import { useState } from "react";
import { Camera, Loader2, Trash2, X } from "lucide-react";

/**
 * Photo uploader for repair / denting bookings.
 *
 * Posts files one-at-a-time to `POST /api/bookings/[id]/photos` so a
 * single bad file doesn't abort an upload run. Server enforces size +
 * mime; we mirror those limits client-side for a faster reject.
 *
 * The component is intentionally optimistic: it shows the local preview
 * immediately, then swaps to the signed URL once the server responds.
 */

interface BookingPhoto {
  id: string;
  bookingId: string;
  storagePath: string;
  signedUrl?: string | null;
}

const MAX_BYTES = 8 * 1024 * 1024;
const ACCEPT = "image/jpeg,image/png,image/webp,image/heic";

type LocalPhoto = {
  /** Temporary id while uploading; replaced by the server id on success. */
  tempId: string;
  previewUrl: string;
  state: "uploading" | "done" | "error";
  error?: string;
  serverPhoto?: BookingPhoto;
};

export function PhotoUploader({
  bookingId,
  initialPhotos = [],
}: {
  bookingId: string;
  initialPhotos?: BookingPhoto[];
}) {
  const [photos, setPhotos] = useState<LocalPhoto[]>(
    initialPhotos.map((p, i) => ({
      tempId: `seed-${i}`,
      previewUrl: p.signedUrl ?? "",
      state: "done" as const,
      serverPhoto: p,
    })),
  );

  async function uploadOne(file: File): Promise<void> {
    const tempId = `tmp-${crypto.randomUUID()}`;
    const previewUrl = URL.createObjectURL(file);
    setPhotos((prev) => [...prev, { tempId, previewUrl, state: "uploading" }]);

    if (file.size > MAX_BYTES) {
      setPhotos((prev) =>
        prev.map((p) =>
          p.tempId === tempId
            ? { ...p, state: "error", error: "Too large (max 8 MB)" }
            : p,
        ),
      );
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch(`/api/bookings/${bookingId}/photos`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      const data = (await res.json()) as { photo?: BookingPhoto; error?: string };
      if (!res.ok || !data.photo) {
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      setPhotos((prev) =>
        prev.map((p) =>
          p.tempId === tempId
            ? { ...p, state: "done", serverPhoto: data.photo }
            : p,
        ),
      );
    } catch (err) {
      setPhotos((prev) =>
        prev.map((p) =>
          p.tempId === tempId
            ? { ...p, state: "error", error: err instanceof Error ? err.message : "upload failed" }
            : p,
        ),
      );
    }
  }

  function handleFiles(files: FileList | null) {
    if (!files) return;
    for (const file of Array.from(files)) {
      void uploadOne(file);
    }
  }

  function removeLocal(tempId: string) {
    setPhotos((prev) => prev.filter((p) => p.tempId !== tempId));
    // NB: we don't currently call DELETE on the server. The photo row stays;
    // ops can still see it. We may add server-side delete in a later week.
  }

  return (
    <div>
      <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-md border border-border bg-card px-4 text-sm font-medium text-foreground hover:bg-muted">
        <Camera className="size-4" strokeWidth={2} />
        Add photos
        <input
          type="file"
          accept={ACCEPT}
          multiple
          className="sr-only"
          onChange={(e) => {
            handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </label>

      {photos.length > 0 ? (
        <ul className="mt-3 grid grid-cols-3 gap-2">
          {photos.map((p) => {
            const src = p.serverPhoto?.signedUrl || p.previewUrl;
            return (
              <li
                key={p.tempId}
                className="relative aspect-square overflow-hidden rounded-md border border-border-subtle bg-muted"
              >
                {src ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={src} alt="" className="h-full w-full object-cover" />
                ) : null}
                {p.state === "uploading" ? (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/30 text-white">
                    <Loader2 className="size-5 animate-spin" />
                  </div>
                ) : null}
                {p.state === "error" ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-ignite-700/80 text-white text-[10px] text-center px-1">
                    <X className="size-4" />
                    <span className="line-clamp-2">{p.error}</span>
                  </div>
                ) : null}
                {p.state !== "uploading" ? (
                  <button
                    type="button"
                    onClick={() => removeLocal(p.tempId)}
                    aria-label="Remove"
                    className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white hover:bg-black/80"
                  >
                    <Trash2 className="size-3" />
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}

      <p className="mt-2 text-xs text-muted-foreground">
        JPEG/PNG/WebP/HEIC, up to 8 MB each. Photos help our team quote accurately.
      </p>
    </div>
  );
}
