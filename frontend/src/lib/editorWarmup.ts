/**
 * The code editor (Monaco) is the heaviest thing on the solve screen and is fetched from a CDN the
 * first time it is needed, which is where "the editor takes a while to appear" comes from. Starting
 * that download the moment a student shows intent to open a problem (hover, focus, touch, click on
 * Solve) means it is usually already in the browser cache when the solve screen mounts.
 *
 * Idempotent and silent: it only ever starts a download, never throws, and does nothing on the
 * server or in an environment where the editor package is not available.
 */

let started = false;

export function warmUpEditor(): void {
  if (started || typeof window === "undefined") return;
  started = true;

  import("@monaco-editor/react")
    .then((mod) => mod.loader.init())
    .catch(() => {
      // Offline, blocked CDN, …: the editor itself will show its own failure state when opened.
      started = false;
    });
}

/** Test seam. */
export function __resetEditorWarmupForTests(): void {
  started = false;
}
