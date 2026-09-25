"use client";

import { useState } from "react";
import { X } from "lucide-react";

interface SkillsTagInputProps {
  value: string[];
  onChange: (skills: string[]) => void;
  max?: number;
}

/** Add-on-Enter/comma chip input for the skills list — replaces a raw comma-separated text field with removable tags. */
export function SkillsTagInput({ value, onChange, max = 20 }: SkillsTagInputProps) {
  const [draft, setDraft] = useState("");

  const addSkill = () => {
    const trimmed = draft.trim();
    if (!trimmed || value.length >= max) {
      setDraft("");
      return;
    }
    if (value.some((s) => s.toLowerCase() === trimmed.toLowerCase())) {
      setDraft("");
      return;
    }
    onChange([...value, trimmed]);
    setDraft("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addSkill();
    } else if (e.key === "Backspace" && draft === "" && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  };

  return (
    <div className="w-full px-2.5 py-2 rounded-control bg-elevated border border-border-subtle focus-within:border-accent-primary transition-colors flex flex-wrap gap-1.5 items-center">
      {value.map((skill) => (
        <span
          key={skill}
          className="flex items-center gap-1 px-2 py-1 rounded-control bg-accent-primary/10 border border-accent-primary/25 text-[11px] font-semibold text-accent-primary"
        >
          {skill}
          <button
            type="button"
            onClick={() => onChange(value.filter((s) => s !== skill))}
            className="hover:text-status-danger transition-colors"
          >
            <X className="w-3 h-3" />
          </button>
        </span>
      ))}
      {value.length < max && (
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={addSkill}
          placeholder={value.length === 0 ? "e.g. React, Laravel, SQL — press Enter to add" : "Add another..."}
          className="flex-1 min-w-[140px] bg-transparent text-xs text-primary outline-none placeholder:text-text-muted"
        />
      )}
    </div>
  );
}
