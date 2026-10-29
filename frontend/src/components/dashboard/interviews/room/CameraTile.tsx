"use client";

import { useEffect, useRef } from "react";
import { VideoOff } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The candidate's own camera, Zoom/Meet-style. Always visible while the interview runs — the one deliberate difference from contest
 * proctoring, where showing it would only be a distraction (see InterviewSessionHud). Mirrored, because that's how everyone expects a
 * self-view to behave; the recording itself is never mirrored.
 */
export function CameraTile({ stream, name, className }: { stream: MediaStream | null; name: string; className?: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    if (el.srcObject !== stream) el.srcObject = stream;
    if (stream) void el.play().catch(() => undefined);
  }, [stream]);

  return (
    <div className={cn("relative overflow-hidden rounded-[22px] border border-border-subtle bg-slate-950 shadow-card ring-1 ring-black/5", className)}>
      {stream ? (
        <video ref={videoRef} muted playsInline autoPlay aria-label="Your camera" className="aspect-[4/3] w-full -scale-x-100 object-cover" />
      ) : (
        <div className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-2 text-slate-400">
          <VideoOff className="h-7 w-7" aria-hidden />
          <span className="text-2xs font-semibold">Camera unavailable</span>
        </div>
      )}

      <div className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-black/60 px-2.5 py-1">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" aria-hidden />
        <span className="text-3xs font-bold tracking-wide text-white">REC</span>
      </div>
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent px-3.5 pb-2.5 pt-8">
        <span className="block truncate text-2xs font-semibold text-white">{name}</span>
      </div>
    </div>
  );
}
