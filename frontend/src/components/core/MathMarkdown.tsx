"use client";

import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkMath from "remark-math";
import "katex/dist/katex.min.css";
import { cn } from "@/lib/utils";

/**
 * Renders question text: Markdown with LaTeX maths — inline `$V = IR$` and display `$$\int_0^1 x^2\,dx$$`.
 *
 * Safe for imported content: raw HTML in the source is NOT rendered (react-markdown escapes it, and
 * rehype-raw is deliberately not used), links are plain, and KaTeX runs with `trust: false`, so a vendor's
 * sheet can never inject markup or script. A formula KaTeX cannot parse is shown as written, in red, instead
 * of breaking the page.
 */
export function MathMarkdown({ children, className, inline = false }: { children: string; className?: string; inline?: boolean }) {
  return (
    <div
      className={cn(
        "min-w-0 break-words text-sm leading-relaxed text-primary",
        "[&_p]:my-2 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5",
        "[&_code]:rounded [&_code]:bg-elevated [&_code]:px-1 [&_code]:py-px [&_code]:font-mono [&_code]:text-[0.85em] [&_pre]:my-2 [&_pre]:overflow-x-auto [&_pre]:rounded-control [&_pre]:bg-elevated [&_pre]:p-3",
        "[&_table]:my-2 [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-border-subtle [&_td]:px-2 [&_td]:py-1 [&_th]:border [&_th]:border-border-subtle [&_th]:bg-elevated [&_th]:px-2 [&_th]:py-1",
        "[&_.katex-display]:my-3 [&_.katex-display]:overflow-x-auto [&_.katex-display]:overflow-y-hidden",
        inline && "[&_p]:inline",
        className
      )}
    >
      <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[[rehypeKatex, { throwOnError: false, strict: "ignore", trust: false, errorColor: "#dc2626" }]]}>
        {children}
      </ReactMarkdown>
    </div>
  );
}
