"use client";

import { useState } from "react";
import { Check, Copy, Loader2 } from "lucide-react";
import SyntaxHighlighter from "react-syntax-highlighter/dist/esm/prism-light";
import vscDarkPlus from "react-syntax-highlighter/dist/esm/styles/prism/vsc-dark-plus";
import javascript from "react-syntax-highlighter/dist/esm/languages/prism/javascript";
import python from "react-syntax-highlighter/dist/esm/languages/prism/python";
import java from "react-syntax-highlighter/dist/esm/languages/prism/java";
import cpp from "react-syntax-highlighter/dist/esm/languages/prism/cpp";
import { cn } from "@/lib/utils";
import { Modal } from "@/components/ui/Modal";

// Exactly JudgeService::SUPPORTED_LANGUAGES on the backend — this viewer
// only ever renders a real submission's own language, never arbitrary user
// text, so there's no "unknown language" case to plan around.
SyntaxHighlighter.registerLanguage("javascript", javascript);
SyntaxHighlighter.registerLanguage("python", python);
SyntaxHighlighter.registerLanguage("java", java);
SyntaxHighlighter.registerLanguage("cpp", cpp);

const VERDICT_TONE: Record<string, string> = {
  accepted: "bg-status-success/15 text-status-success border-status-success/25",
  wrong_answer: "bg-status-danger/15 text-status-danger border-status-danger/25",
  runtime_error: "bg-status-warning/15 text-status-warning border-status-warning/25",
  compile_error: "bg-status-warning/15 text-status-warning border-status-warning/25",
};

const VERDICT_LABEL: Record<string, string> = {
  accepted: "Accepted",
  wrong_answer: "Wrong Answer",
  runtime_error: "Runtime Error",
  compile_error: "Compile Error",
};

export interface CodeViewData {
  /** Real problem/contest title — this viewer is always opened FOR a specific submission, never in the abstract. */
  title: string;
  subtitle?: string;
  language: string;
  status: string;
  submittedAt: string;
  runtimeMs?: number | null;
  memoryKb?: number | null;
  /**
   * Three real states, not two: `undefined` while the code is still being
   * fetched (the caller opens this modal the instant "Code" is clicked,
   * before the network call resolves — everything else on this screen is
   * already known from the row that was clicked, so only this one field
   * starts empty); `null` once fetched but genuinely never captured (a
   * submission made before code persistence shipped); a `string` once it
   * arrives. Collapsing "loading" and "nothing to show" into one falsy
   * value would make an in-flight fetch look identical to a submission
   * with no code at all.
   */
  code: string | null | undefined;
}

interface CodeViewModalProps {
  data: CodeViewData | null;
  onClose: () => void;
}

/**
 * Read-only source viewer for a student's own submission — the "TPO/admin
 * can see the exact code" screen. Deliberately read-only (no edit affordance
 * of any kind): this is someone else's submitted work being reviewed, not a
 * scratchpad.
 *
 * Built on the shared Modal shell; `bodyClassName` drops Modal's default
 * padding/text-xs so the syntax-highlighted code can render edge-to-edge
 * with its own dark background instead of sitting in a padded, prose-sized
 * box. The verdict/language/runtime meta strip is `sticky top-0` inside
 * that scrollable body so it stays pinned above the code while only the
 * code itself scrolls, mirroring the original's fixed-header/scrolling-body
 * split.
 */
export function CodeViewModal({ data, onClose }: CodeViewModalProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!data?.code) return;
    await navigator.clipboard.writeText(data.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  if (!data) return null;

  return (
    <Modal
      onClose={onClose}
      title={data.title}
      subtitle={data.subtitle}
      size="3xl"
      bodyClassName=""
    >
      <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 border-b border-border-subtle bg-surface px-4 py-2.5">
        <span
          className={cn(
            "rounded-full border px-2 py-0.5 text-3xs font-bold uppercase tracking-wide",
            VERDICT_TONE[data.status] ?? "bg-elevated text-text-muted border-border-subtle"
          )}
        >
          {VERDICT_LABEL[data.status] ?? data.status}
        </span>
        <span className="rounded-full border border-border-subtle bg-elevated px-2 py-0.5 text-3xs font-bold uppercase text-text-secondary">
          {data.language}
        </span>
        {data.runtimeMs != null && <span className="font-mono text-3xs text-text-muted">{data.runtimeMs}ms</span>}
        {data.memoryKb != null && <span className="font-mono text-3xs text-text-muted">{data.memoryKb}KB</span>}
        <span className="ml-auto text-3xs text-text-muted">{new Date(data.submittedAt).toLocaleString()}</span>
      </div>

      {data.code === undefined ? (
        <div className="flex flex-col items-center justify-center gap-3 p-16 text-center">
          <Loader2 className="h-5 w-5 animate-spin text-accent-primary" />
          <p className="text-2xs font-semibold text-text-muted">Fetching submitted code…</p>
        </div>
      ) : data.code === null ? (
        <div className="flex flex-col items-center justify-center gap-2 p-12 text-center">
          <p className="text-xs font-semibold text-text-secondary">Code not recorded</p>
          <p className="max-w-sm text-2xs text-text-muted">
            This submission was made before source code capture was enabled. Nothing was ever saved for it — there is nothing to recover.
          </p>
        </div>
      ) : (
        <div className="relative">
          <button
            onClick={handleCopy}
            className="absolute right-3 top-3 z-10 flex items-center gap-1 rounded-control border border-white/10 bg-black/40 px-2 py-1 text-3xs font-semibold text-white/70 backdrop-blur-sm transition-colors hover:text-white"
          >
            {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            {copied ? "Copied" : "Copy"}
          </button>
          <SyntaxHighlighter
            language={data.language}
            style={vscDarkPlus}
            customStyle={{
              margin: 0,
              padding: "18px 16px",
              fontSize: "13px",
              lineHeight: 1.6,
              background: "#1e1e1e",
              fontFamily: "var(--font-mono), monospace",
            }}
            showLineNumbers
            wrapLongLines
          >
            {data.code}
          </SyntaxHighlighter>
        </div>
      )}
    </Modal>
  );
}
