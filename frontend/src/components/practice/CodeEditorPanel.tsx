"use client";

import dynamic from "next/dynamic";
import { Minus, Plus, RotateCcw } from "lucide-react";
import type { OnMount } from "@monaco-editor/react";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), { ssr: false });

/**
 * Monaco's own built-in "auto-scroll the viewport while dragging a
 * selection past the top/bottom edge" doesn't fire in this app's layout
 * (confirmed: mouse wheel, scrollbar-drag, and keyboard cursor navigation
 * all correctly move `editor.getScrollTop()`, but dragging a selection to
 * hold at the bottom edge does not — isolated via direct testing, not just
 * a hunch). This reimplements that one behavior on top of
 * `setScrollTop()`, which is proven to work, rather than chasing the exact
 * root cause somewhere inside Monaco's internal drag-tracking.
 */
const AUTOSCROLL_EDGE_PX = 24;
const AUTOSCROLL_MAX_SPEED = 18;

function attachDragAutoScroll(editorInstance: Parameters<OnMount>[0]) {
  const domNode = editorInstance.getDomNode();
  if (!domNode) return;

  let rafId: number | null = null;

  const stop = () => {
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  };

  const tick = (direction: number, speed: number) => {
    editorInstance.setScrollTop(editorInstance.getScrollTop() + direction * speed);
    rafId = requestAnimationFrame(() => tick(direction, speed));
  };

  const onMouseMove = (e: MouseEvent) => {
    // Only while actively dragging (left button held) — a plain hover near
    // the edge should never scroll anything.
    if (e.buttons !== 1) {
      stop();
      return;
    }

    const rect = domNode.getBoundingClientRect();
    const y = e.clientY;
    let direction = 0;
    let overshoot = 0;

    if (y < rect.top + AUTOSCROLL_EDGE_PX) {
      direction = -1;
      overshoot = rect.top + AUTOSCROLL_EDGE_PX - y;
    } else if (y > rect.bottom - AUTOSCROLL_EDGE_PX) {
      direction = 1;
      overshoot = y - (rect.bottom - AUTOSCROLL_EDGE_PX);
    }

    stop();
    if (direction !== 0) {
      tick(direction, Math.min(AUTOSCROLL_MAX_SPEED, 4 + Math.max(0, overshoot) * 0.5));
    }
  };

  const onMouseUp = () => stop();

  domNode.addEventListener("mousemove", onMouseMove);
  window.addEventListener("mouseup", onMouseUp);

  editorInstance.onDidDispose(() => {
    stop();
    domNode.removeEventListener("mousemove", onMouseMove);
    window.removeEventListener("mouseup", onMouseUp);
  });
}

const LANGUAGE_LABELS: Record<string, string> = {
  javascript: "JavaScript",
  python: "Python",
  java: "Java",
  cpp: "C++",
};

const MONACO_LANGUAGE: Record<string, string> = {
  javascript: "javascript",
  python: "python",
  java: "java",
  cpp: "cpp",
};

interface CodeEditorPanelProps {
  language: string;
  availableLanguages: string[];
  onLanguageChange: (lang: string) => void;
  code: string;
  onCodeChange: (code: string) => void;
  onReset: () => void;
  fontSize: number;
  onFontSizeChange: (size: number) => void;
  savedAt: number | null;
}

export function CodeEditorPanel({
  language,
  availableLanguages,
  onLanguageChange,
  code,
  onCodeChange,
  onReset,
  fontSize,
  onFontSizeChange,
  savedAt,
}: CodeEditorPanelProps) {
  return (
    <div className="h-full flex flex-col bg-[#1e1e1e]">
      <div className="flex items-center justify-between gap-2 px-3 h-11 border-b border-black/30 bg-surface shrink-0">
        <select
          value={language}
          onChange={(e) => onLanguageChange(e.target.value)}
          className="px-2.5 py-1 rounded-control bg-elevated border border-border-subtle text-xs font-semibold text-primary outline-none focus:border-accent-primary"
        >
          {availableLanguages.map((lang) => (
            <option key={lang} value={lang}>
              {LANGUAGE_LABELS[lang] ?? lang}
            </option>
          ))}
        </select>

        <div className="flex items-center gap-1">
          <span className="text-2xs text-text-muted font-mono w-8 text-center select-none">{fontSize}px</span>
          <button
            onClick={() => onFontSizeChange(Math.max(11, fontSize - 1))}
            className="p-1 rounded-control text-text-muted hover:text-primary hover:bg-surface-hover transition-colors"
            aria-label="Decrease font size"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onFontSizeChange(Math.min(22, fontSize + 1))}
            className="p-1 rounded-control text-text-muted hover:text-primary hover:bg-surface-hover transition-colors"
            aria-label="Increase font size"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>

          <div className="w-px h-4 bg-border-subtle mx-1" />

          <button
            onClick={onReset}
            className="inline-flex items-center gap-1.5 px-2 py-1 rounded-control text-2xs font-semibold text-text-muted hover:text-primary hover:bg-surface-hover transition-colors"
            title="Reset to starter code"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Reset</span>
          </button>

          {savedAt !== null && (
            <span className="hidden md:inline text-3xs text-text-muted ml-1 whitespace-nowrap">
              Draft saved
            </span>
          )}
        </div>
      </div>

      <div className="flex-1 min-h-0">
        <MonacoEditor
          language={MONACO_LANGUAGE[language] ?? "plaintext"}
          value={code}
          onChange={(value) => onCodeChange(value ?? "")}
          onMount={attachDragAutoScroll}
          theme="vs-dark"
          loading={<div className="h-full bg-[#1e1e1e]" />}
          options={{
            fontSize,
            minimap: { enabled: false },
            automaticLayout: true,
            scrollBeyondLastLine: false,
            smoothScrolling: true,
            tabSize: language === "javascript" ? 2 : 4,
            padding: { top: 14 },
            renderLineHighlight: "gutter",
            fontLigatures: true,
            // Monaco renders its text as real DOM spans (not canvas), so it
            // reads var(--font-mono) exactly like any other element —
            // meaning the editor is the one place in the app that was
            // hardcoding its own mono stack rather than using the site's.
            // 'SF Mono' listed first meant every Mac visitor saw the code
            // editor in a visibly different typeface from every other
            // monospace value on the page (ratings, timestamps, table
            // figures), which is the exact cross-page drift this pass
            // fixes elsewhere via the shared type scale.
            fontFamily: "var(--font-mono), 'JetBrains Mono', 'SF Mono', Menlo, Consolas, monospace",
            cursorBlinking: "smooth",
          }}
        />
      </div>
    </div>
  );
}
