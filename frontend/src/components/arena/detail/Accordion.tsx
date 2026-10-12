"use client";

import { useId, useState } from "react";
import { ChevronDown } from "lucide-react";

export interface AccordionItem {
  question: string;
  answer: string;
}

/**
 * A FAQ accordion with a real height animation (a 0fr → 1fr grid track, so there is no measuring and no
 * JavaScript in the animation) and the full disclosure pattern: each question is a button that owns
 * `aria-expanded` / `aria-controls`, and a collapsed answer is `visibility: hidden` so keyboard focus and
 * screen readers skip it. The first answer starts open so the section never looks like a bare list.
 */
export function Accordion({ items }: { items: AccordionItem[] }) {
  const base = useId();
  const [open, setOpen] = useState<Set<number>>(() => new Set([0]));

  const toggle = (i: number) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });

  return (
    <ul className="space-y-2.5">
      {items.map((f, i) => {
        const isOpen = open.has(i);
        const buttonId = `${base}-q${i}`;
        const panelId = `${base}-a${i}`;

        return (
          <li key={f.question} className="dt-acc ar-raised overflow-hidden transition-colors hover:border-white/20" data-open={isOpen}>
            <h3>
              <button
                id={buttonId}
                type="button"
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => toggle(i)}
                className="group flex w-full items-center gap-4 px-4 py-4 text-left sm:px-5"
              >
                <span aria-hidden className="ar-num w-6 shrink-0 text-[13px] font-semibold text-[color:var(--ar-text-3)]">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="min-w-0 flex-1 text-[15px] font-semibold leading-snug text-white">{f.question}</span>
                <span className="dt-acc-chevron inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/[0.07] text-[color:var(--ar-text-2)]">
                  <ChevronDown className="h-4 w-4" aria-hidden />
                </span>
              </button>
            </h3>

            <div id={panelId} role="region" aria-labelledby={buttonId} className="dt-acc-body">
              <div>
                <p className="px-4 pb-5 pl-[56px] pr-5 text-[14.5px] leading-[1.7] text-[color:var(--ar-text-2)] sm:pl-[60px]">{f.answer}</p>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
