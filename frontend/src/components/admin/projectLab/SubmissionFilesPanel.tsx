"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronRight, Download, File as FileIcon, FolderOpen, Loader2, Search } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { formatBytes, saveBlob } from "@/lib/projectLab";
import { cn } from "@/lib/utils";
import type { SaveData } from "@/types/projectLab";

interface FileRow {
  path: string;
  size: number;
  mtime: string;
}

interface Listing {
  files: FileRow[];
  total_files: number;
  total_bytes: number;
  truncated: boolean;
  unreadable?: boolean;
  message?: string;
}

interface Preview {
  path: string;
  size: number;
  binary: boolean;
  truncated: boolean;
  content: string | null;
}

const when = (iso: string) => new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

/**
 * What the student handed in, without downloading it: every file of the submitted snapshot with its size and the time it was last
 * written (a file much older than the project is worth a question), one file at a time as text, and the checkpoints the student saved
 * along the way (each one downloadable as a zip) so a reviewer sees how the project grew.
 */
export function SubmissionFilesPanel({ submissionId, saves }: { submissionId: number; saves: SaveData[] }) {
  const [listing, setListing] = useState<Listing | null>(null);
  const [filter, setFilter] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loadingFile, setLoadingFile] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setListing(null);
    api
      .get<Listing>(`/admin/project-lab/submissions/${submissionId}/files`)
      .then(setListing)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Couldn't read the snapshot."));
  }, [submissionId]);

  const show = useCallback(
    async (path: string) => {
      setOpen(path);
      setLoadingFile(true);
      setPreview(null);
      try {
        setPreview(await api.get<Preview>(`/admin/project-lab/submissions/${submissionId}/file?path=${encodeURIComponent(path)}`));
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Couldn't open that file.");
      } finally {
        setLoadingFile(false);
      }
    },
    [submissionId]
  );

  const files = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return (listing?.files ?? []).filter((f) => q === "" || f.path.toLowerCase().includes(q));
  }, [listing, filter]);

  const downloadSave = async (s: SaveData) => {
    try {
      saveBlob(await api.getFile(`/admin/project-lab/saves/${s.id}/download`), `save-${s.id}.zip`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't download that checkpoint.");
    }
  };

  return (
    <section className="rounded-panel border border-border-subtle bg-surface shadow-subtle" aria-label="Submitted files">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle px-5 py-3.5">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-sm font-extrabold text-primary">
            <FolderOpen className="h-4 w-4 text-accent-primary" aria-hidden /> What was handed in
          </h2>
          <p className="text-2xs text-text-secondary">
            {listing ? `${listing.total_files} file${listing.total_files === 1 ? "" : "s"} · ${formatBytes(listing.total_bytes)}` : "Reading the snapshot…"} · packed by AptRun from the student&apos;s editor
          </p>
        </div>
        <label className="relative block">
          <span className="sr-only">Filter files</span>
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted" />
          <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter by path" className="h-8 w-52 rounded-control border border-border-subtle bg-elevated pl-8 pr-2 text-xs text-primary placeholder:text-text-muted focus:border-accent-primary focus:outline-none" />
        </label>
      </div>

      {error && (
        <p role="alert" className="mx-5 mt-3 rounded-control border border-status-danger/25 bg-status-danger/10 p-2.5 text-2xs text-status-danger">
          {error}
        </p>
      )}

      {!listing && !error && (
        <p role="status" className="flex items-center gap-2 px-5 py-6 text-xs text-text-muted">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading files…
        </p>
      )}

      {listing?.unreadable && <p className="px-5 py-6 text-xs text-text-muted">{listing.message ?? "This snapshot can't be listed."} Use “Download .zip” above.</p>}

      {listing && !listing.unreadable && (
        <div className="grid gap-0 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          <ul className="max-h-[28rem] divide-y divide-border-subtle overflow-y-auto border-b border-border-subtle lg:border-b-0 lg:border-r" aria-label="Files">
            {files.map((f) => (
              <li key={f.path}>
                <button type="button" onClick={() => show(f.path)} aria-pressed={open === f.path} className={cn("flex w-full items-center gap-2 px-4 py-2 text-left text-2xs hover:bg-elevated/60", open === f.path && "bg-accent-primary/5")}>
                  <FileIcon className="h-3.5 w-3.5 shrink-0 text-text-muted" aria-hidden />
                  <span className="min-w-0 flex-1 truncate font-mono text-primary" title={f.path}>
                    {f.path}
                  </span>
                  <span className="shrink-0 tabular-nums text-text-muted">{formatBytes(f.size)}</span>
                  <ChevronRight className="h-3 w-3 shrink-0 text-text-muted" aria-hidden />
                </button>
              </li>
            ))}
            {files.length === 0 && <li className="px-4 py-6 text-center text-2xs text-text-muted">No file matches.</li>}
            {listing.truncated && <li className="px-4 py-2 text-3xs text-text-muted">Showing the first {listing.files.length} of {listing.total_files}. Download the zip for the rest.</li>}
          </ul>

          <div className="min-h-[10rem] min-w-0 p-4">
            {!open && <p className="text-2xs text-text-muted">Pick a file to read it here.</p>}
            {open && loadingFile && (
              <p className="flex items-center gap-2 text-xs text-text-muted">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Opening…
              </p>
            )}
            {preview && (
              <>
                <p className="mb-2 truncate font-mono text-2xs font-bold text-primary">
                  {preview.path} <span className="font-normal text-text-muted">· {formatBytes(preview.size)}</span>
                </p>
                {preview.binary ? (
                  <p className="rounded-control border border-dashed border-border-strong p-4 text-center text-2xs text-text-muted">A binary file — not shown. It is in the zip.</p>
                ) : (
                  <>
                    <pre className="max-h-[24rem] overflow-auto rounded-control border border-border-subtle bg-elevated p-3 font-mono text-2xs leading-relaxed text-primary">{preview.content}</pre>
                    {preview.truncated && <p className="mt-1 text-3xs text-text-muted">Only the start of this file is shown.</p>}
                  </>
                )}
              </>
            )}
          </div>
        </div>
      )}

      <div className="border-t border-border-subtle px-5 py-4">
        <h3 className="text-xs font-extrabold text-primary">Saved checkpoints ({saves.length})</h3>
        {saves.length === 0 ? (
          <p className="mt-1 text-2xs text-text-muted">The student never pressed “Save progress”: only the final hand-in exists.</p>
        ) : (
          <ol className="mt-2 space-y-1.5">
            {saves.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 text-2xs">
                <span className="text-text-secondary">
                  <b className="text-primary">{when(s.saved_at)}</b> · {s.files} files · {formatBytes(s.size_bytes)} · {s.milestones_done}/{s.milestones_total} milestones
                  {s.imported_files > 0 && <span className="ml-1.5 font-semibold text-amber-700 dark:text-amber-300">· {s.imported_files} file(s) older than the workspace</span>}
                </span>
                <button type="button" onClick={() => downloadSave(s)} className="inline-flex items-center gap-1 rounded-control border border-border-strong bg-elevated px-2 py-1 font-bold text-primary hover:bg-surface-hover">
                  <Download className="h-3 w-3" aria-hidden /> .zip
                </button>
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}
