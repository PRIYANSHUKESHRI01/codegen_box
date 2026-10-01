"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import SyntaxHighlighter from "react-syntax-highlighter/dist/esm/prism-light";
import vscDarkPlus from "react-syntax-highlighter/dist/esm/styles/prism/vsc-dark-plus";
import go from "react-syntax-highlighter/dist/esm/languages/prism/go";
import python from "react-syntax-highlighter/dist/esm/languages/prism/python";
import cpp from "react-syntax-highlighter/dist/esm/languages/prism/cpp";
import bash from "react-syntax-highlighter/dist/esm/languages/prism/bash";
import json from "react-syntax-highlighter/dist/esm/languages/prism/json";
import javascript from "react-syntax-highlighter/dist/esm/languages/prism/javascript";
import typescript from "react-syntax-highlighter/dist/esm/languages/prism/typescript";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

// Registered once at module load — only the handful of languages this
// platform's seed content (and likely near-future content) actually needs,
// not the full Prism language bundle (400KB+ minified).
SyntaxHighlighter.registerLanguage("go", go);
SyntaxHighlighter.registerLanguage("python", python);
SyntaxHighlighter.registerLanguage("cpp", cpp);
SyntaxHighlighter.registerLanguage("bash", bash);
SyntaxHighlighter.registerLanguage("json", json);
SyntaxHighlighter.registerLanguage("javascript", javascript);
SyntaxHighlighter.registerLanguage("typescript", typescript);

function CodeBlock({ language, code }: { language: string; code: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard API unavailable (e.g. insecure context) — nothing sensible to fall back to.
    }
  };

  return (
    <div className="relative my-4 rounded-control overflow-hidden border border-border-subtle not-prose">
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#1e1e1e] border-b border-white/10">
        <span className="text-3xs font-mono uppercase tracking-wide text-white/40">{language || "text"}</span>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1 text-3xs font-semibold text-white/50 hover:text-white/90 transition-colors"
        >
          {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <SyntaxHighlighter
        language={language || "text"}
        style={vscDarkPlus}
        customStyle={{ margin: 0, padding: "14px 16px", fontSize: "12.5px", lineHeight: 1.6, background: "#1e1e1e" }}
        wrapLongLines
      >
        {code}
      </SyntaxHighlighter>
    </div>
  );
}

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

/**
 * The one shared markdown render surface for Articles — used by both the
 * student reader and the admin editor's live-preview pane, so what an Ops
 * author sees while writing is exactly what a student will see. Code
 * always renders dark (vscDarkPlus) regardless of the site's light/dark
 * toggle, matching the one other code-rendering surface in this app
 * (CodeEditorPanel's Monaco instance is hardcoded vs-dark too).
 */
export function MarkdownRenderer({ content, className }: MarkdownRendererProps) {
  return (
    <div className={cn("text-[14.5px] leading-[1.8] text-text-secondary", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => <h1 className="text-2xl font-extrabold text-primary mt-8 mb-4 first:mt-0">{children}</h1>,
          h2: ({ children }) => (
            <h2 className="text-xl font-extrabold text-primary mt-10 mb-4 pb-2 border-b border-border-subtle first:mt-0">{children}</h2>
          ),
          h3: ({ children }) => <h3 className="text-base font-bold text-primary mt-7 mb-3">{children}</h3>,
          h4: ({ children }) => <h4 className="text-sm font-bold text-primary mt-5 mb-2">{children}</h4>,
          p: ({ children }) => <p className="mb-4">{children}</p>,
          a: ({ children, href }) => (
            <a href={href} target="_blank" rel="noopener noreferrer" className="text-accent-primary font-semibold hover:underline">
              {children}
            </a>
          ),
          strong: ({ children }) => <strong className="font-bold text-primary">{children}</strong>,
          ul: ({ children }) => <ul className="mb-4 pl-5 space-y-1.5 list-disc marker:text-text-muted">{children}</ul>,
          ol: ({ children }) => <ol className="mb-4 pl-5 space-y-1.5 list-decimal marker:text-text-muted">{children}</ol>,
          li: ({ children }) => <li className="pl-1">{children}</li>,
          blockquote: ({ children }) => (
            <blockquote className="my-4 pl-4 border-l-2 border-accent-primary/40 text-text-muted italic">{children}</blockquote>
          ),
          hr: () => <hr className="my-8 border-border-subtle" />,
          table: ({ children }) => (
            <div className="my-4 overflow-x-auto rounded-control border border-border-subtle">
              <table className="w-full text-13">{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead className="bg-elevated">{children}</thead>,
          tr: ({ children }) => <tr className="border-b border-border-subtle last:border-0">{children}</tr>,
          th: ({ children }) => <th className="px-3 py-2 text-left font-bold text-primary">{children}</th>,
          td: ({ children }) => <td className="px-3 py-2 text-text-secondary">{children}</td>,
          code({ className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || "");
            if (!match) {
              return (
                <code className="px-1.5 py-0.5 rounded bg-elevated text-accent-primary text-[0.85em] font-mono" {...props}>
                  {children}
                </code>
              );
            }
            return <CodeBlock language={match[1]} code={String(children).replace(/\n$/, "")} />;
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
