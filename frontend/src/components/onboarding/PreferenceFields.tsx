"use client";

import { useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { JUDGE_LANGUAGES, languageLabel } from "@/lib/judgeLanguages";
import { MAX_LANGUAGES, POPULAR_LANGUAGE_IDS, type Choice } from "@/lib/studentPreferences";

/**
 * The form controls shared by the first-login wizard and Settings → Coding
 * preferences, so both ask the same questions the same way and neither can
 * drift from the other.
 */

const cardBase =
  "rounded-xl border text-left transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface";
const cardOff = "border-border-subtle bg-surface hover:border-border-strong hover:bg-elevated";
const cardOn = "border-accent-primary bg-accent-primary/10 ring-1 ring-accent-primary/40";

/** Single choice from a short list, as large tappable cards. */
export function RadioCards<T extends string>({
  label,
  value,
  onChange,
  choices,
  columns = 3,
}: {
  label: string;
  value: T | null | undefined;
  onChange: (id: T) => void;
  choices: readonly Choice<T>[];
  columns?: 2 | 3;
}) {
  return (
    <div role="radiogroup" aria-label={label} className={cn("grid grid-cols-1 gap-2", columns === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2")}>
      {choices.map((choice) => {
        const selected = value === choice.id;
        return (
          <button
            key={choice.id}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(choice.id)}
            className={cn(cardBase, "flex flex-col gap-0.5 p-3", selected ? cardOn : cardOff)}
          >
            <span className="flex items-center justify-between gap-2 text-xs font-bold text-primary">
              {choice.label}
              {selected && <Check className="h-3.5 w-3.5 shrink-0 text-accent-primary" aria-hidden />}
            </span>
            <span className="text-2xs leading-snug text-text-muted">{choice.hint}</span>
          </button>
        );
      })}
    </div>
  );
}

/** Any number of choices from a short list, as toggleable chips. */
export function ChipMulti<T extends string>({
  label,
  value,
  onChange,
  choices,
}: {
  label: string;
  value: readonly T[];
  onChange: (next: T[]) => void;
  choices: readonly Choice<T>[];
}) {
  const toggle = (id: T) => onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);

  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {choices.map((choice) => {
        const selected = value.includes(choice.id);
        return (
          <button
            key={choice.id}
            type="button"
            aria-pressed={selected}
            onClick={() => toggle(choice.id)}
            title={choice.hint}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-2xs font-semibold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary",
              selected ? "border-accent-primary bg-accent-primary/10 text-accent-primary" : "border-border-subtle bg-surface text-text-secondary hover:border-border-strong hover:bg-elevated"
            )}
          >
            {selected && <Check className="h-3 w-3" aria-hidden />}
            {choice.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * "Which language do you code in most?" — the popular ones up front, the rest of
 * what the judge runs behind a disclosure. If the chosen language is one of the
 * hidden ones the list opens by itself, so a selection is never out of sight.
 */
export function PrimaryLanguageChoice({ value, onChange }: { value: string | null | undefined; onChange: (id: string) => void }) {
  const popular = POPULAR_LANGUAGE_IDS;
  const others = JUDGE_LANGUAGES.filter((l) => !popular.includes(l.id));
  const [expanded, setExpanded] = useState(false);
  const showOthers = expanded || (!!value && !popular.includes(value));

  const option = (id: string) => {
    const selected = value === id;
    return (
      <button
        key={id}
        type="button"
        role="radio"
        aria-checked={selected}
        onClick={() => onChange(id)}
        className={cn(cardBase, "flex items-center justify-between gap-2 px-3 py-2.5 text-xs font-bold text-primary", selected ? cardOn : cardOff)}
      >
        {languageLabel(id)}
        {selected && <Check className="h-3.5 w-3.5 shrink-0 text-accent-primary" aria-hidden />}
      </button>
    );
  };

  return (
    <div role="radiogroup" aria-label="Main programming language" className="space-y-2">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{popular.map(option)}</div>

      {showOthers && <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{others.map((l) => option(l.id))}</div>}

      {!(!!value && !popular.includes(value)) && (
        <button
          type="button"
          onClick={() => setExpanded((open) => !open)}
          aria-expanded={showOthers}
          className="inline-flex items-center gap-1 rounded-md text-2xs font-semibold text-accent-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary"
        >
          {showOthers ? "Fewer languages" : `More languages (${others.length})`}
          <ChevronDown className={cn("h-3 w-3 transition-transform", showOthers && "rotate-180")} aria-hidden />
        </button>
      )}
    </div>
  );
}

/** "Also comfortable with" — every other language, as chips, capped so the list stays a preference and not a résumé. */
export function OtherLanguagesChoice({
  primary,
  value,
  onChange,
}: {
  primary: string | null | undefined;
  value: readonly string[];
  onChange: (next: string[]) => void;
}) {
  const options = JUDGE_LANGUAGES.filter((l) => l.id !== primary);
  const room = MAX_LANGUAGES - 1; // the primary takes one of the slots
  const atCap = value.length >= room;

  const toggle = (id: string) => {
    if (value.includes(id)) onChange(value.filter((v) => v !== id));
    else if (!atCap) onChange([...value, id]);
  };

  return (
    <div>
      <div role="group" aria-label="Other languages you know" className="flex flex-wrap gap-1.5">
        {options.map((language) => {
          const selected = value.includes(language.id);
          const blocked = !selected && atCap;
          return (
            <button
              key={language.id}
              type="button"
              aria-pressed={selected}
              disabled={blocked}
              onClick={() => toggle(language.id)}
              className={cn(
                "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-2xs font-semibold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary",
                selected
                  ? "border-accent-primary bg-accent-primary/10 text-accent-primary"
                  : "border-border-subtle bg-surface text-text-secondary hover:border-border-strong hover:bg-elevated",
                blocked && "cursor-not-allowed opacity-40 hover:border-border-subtle hover:bg-surface"
              )}
            >
              {selected && <Check className="h-3 w-3" aria-hidden />}
              {language.label}
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-3xs text-text-muted" aria-live="polite">
        {value.length}/{room} selected{atCap ? " — that's the limit" : ""}
      </p>
    </div>
  );
}
