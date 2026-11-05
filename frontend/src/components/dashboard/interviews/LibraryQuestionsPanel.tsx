"use client";

import { useEffect, useMemo, useState } from "react";
import { BookOpenCheck, Loader2, Plus } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { ToastTrigger } from "@/lib/toast";

interface LibraryRound {
  number: number;
  title: string;
  questions: number;
}

interface LibraryStack {
  key: string;
  name: string;
  questions: number;
  rounds: LibraryRound[];
}

interface LibraryDomain {
  key: string;
  title: string;
  stacks: LibraryStack[];
}

interface LibraryResponse {
  domains: LibraryDomain[];
  max_questions: number;
}

/** The Computer Science core domain (DBMS, OS, CN, OOP …) is what most CSE / IT placement rounds ask, so it is listed first. */
const CS_CORE_KEY = "cs_core";

/**
 * "Draw questions from the AptRun library": pick a domain and tech stack (the same ones students practise), say how many, and a
 * random non-repeating sample goes into the interview. Questions already in the interview are never added twice, and the
 * interview stops at the maximum, so pressing it again just tops the interview up.
 */
export function LibraryQuestionsPanel({
  basePath,
  interviewSlug,
  attachedCount,
  onAdded,
  onToast,
}: {
  basePath: string;
  interviewSlug: string;
  attachedCount: number;
  onAdded: () => void;
  onToast: ToastTrigger;
}) {
  const [library, setLibrary] = useState<LibraryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [domainKey, setDomainKey] = useState<string>("");
  const [stackKey, setStackKey] = useState<string>("");
  const [rounds, setRounds] = useState<number[]>([]);
  const [count, setCount] = useState(8);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    api
      .get<LibraryResponse>(`${basePath}/library`)
      .then((res) => {
        const ordered = [...res.domains].sort((a, b) => Number(b.key === CS_CORE_KEY) - Number(a.key === CS_CORE_KEY));
        setLibrary({ ...res, domains: ordered });
        setDomainKey(ordered[0]?.key ?? "");
        setStackKey(ordered[0]?.stacks[0]?.key ?? "");
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Couldn't load the question library."));
  }, [basePath]);

  const domain = useMemo(() => library?.domains.find((d) => d.key === domainKey) ?? null, [library, domainKey]);
  const stack = useMemo(() => domain?.stacks.find((s) => s.key === stackKey) ?? null, [domain, stackKey]);

  const max = library?.max_questions ?? 30;
  const room = Math.max(0, max - attachedCount);
  const pool = stack ? (rounds.length > 0 ? stack.rounds.filter((r) => rounds.includes(r.number)).reduce((n, r) => n + r.questions, 0) : stack.questions) : 0;

  const pickDomain = (key: string) => {
    setDomainKey(key);
    const first = library?.domains.find((d) => d.key === key)?.stacks[0]?.key ?? "";
    setStackKey(first);
    setRounds([]);
  };

  const add = async () => {
    if (!stack || adding) return;
    setAdding(true);
    try {
      const res = await api.post<{ message: string; added: number }>(`${basePath}/${interviewSlug}/library-questions`, {
        stack_key: stack.key,
        rounds: rounds.length > 0 ? rounds : undefined,
        count: Math.min(Math.max(1, count), max),
      });
      onToast(res.message, res.added > 0 ? "success" : "info");
      if (res.added > 0) onAdded();
    } catch (err) {
      onToast(err instanceof ApiError ? err.message : "Couldn't add those questions.", "error");
    } finally {
      setAdding(false);
    }
  };

  if (error) return <p className="py-4 text-center text-2xs text-status-danger">{error}</p>;
  if (!library) {
    return (
      <div className="flex items-center justify-center gap-2 py-6 text-xs text-text-muted">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading the library…
      </div>
    );
  }
  if (library.domains.length === 0) return <p className="py-4 text-center text-2xs text-text-muted">The library has no questions yet.</p>;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Domains">
        {library.domains.map((d) => (
          <button
            key={d.key}
            type="button"
            role="tab"
            aria-selected={d.key === domainKey}
            onClick={() => pickDomain(d.key)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-2xs font-bold transition-colors",
              d.key === domainKey ? "border-transparent bg-accent-primary text-white" : "border-border-strong bg-elevated text-text-secondary hover:text-primary"
            )}
          >
            {d.title}
          </button>
        ))}
      </div>

      {domain && (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {domain.stacks.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => {
                setStackKey(s.key);
                setRounds([]);
              }}
              aria-pressed={s.key === stackKey}
              className={cn(
                "rounded-control border p-3 text-left transition-colors",
                s.key === stackKey ? "border-accent-primary bg-accent-primary/10" : "border-border-subtle bg-elevated/60 hover:border-border-strong"
              )}
            >
              <p className="text-xs font-bold text-primary">{s.name}</p>
              <p className="mt-0.5 text-3xs text-text-muted">{s.questions} questions · {s.rounds.length} rounds</p>
            </button>
          ))}
        </div>
      )}

      {stack && (
        <div className="space-y-3 rounded-control border border-border-subtle bg-elevated/40 p-3">
          <div>
            <p className="mb-1.5 text-3xs font-bold uppercase tracking-[0.08em] text-text-muted">From which rounds? (none ticked = all)</p>
            <div className="flex flex-wrap gap-1.5">
              {stack.rounds.map((r) => {
                const on = rounds.includes(r.number);
                return (
                  <button
                    key={r.number}
                    type="button"
                    aria-pressed={on}
                    disabled={r.questions === 0}
                    onClick={() => setRounds((prev) => (on ? prev.filter((n) => n !== r.number) : [...prev, r.number]))}
                    className={cn(
                      "rounded-full border px-2.5 py-1 text-3xs font-bold transition-colors disabled:opacity-40",
                      on ? "border-transparent bg-accent-primary text-white" : "border-border-strong bg-surface text-text-secondary hover:text-primary"
                    )}
                  >
                    {r.title} <span className="opacity-70">({r.questions})</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label htmlFor="lib-count" className="mb-1 block text-3xs font-bold uppercase tracking-[0.08em] text-text-muted">
                How many?
              </label>
              <input
                id="lib-count"
                type="number"
                min={1}
                max={max}
                value={count}
                onChange={(e) => setCount(Number(e.target.value) || 1)}
                className="w-24 rounded-control border border-border-subtle bg-elevated px-2 py-2 text-xs text-primary outline-none focus:border-accent-primary"
              />
            </div>
            <button
              type="button"
              onClick={() => void add()}
              disabled={adding || room === 0 || pool === 0}
              className="inline-flex items-center gap-1.5 rounded-control bg-accent-primary px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-accent-primary-hover disabled:opacity-50"
            >
              {adding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
              Add {Math.min(count, room, pool)} from {stack.name}
            </button>
            <p className="flex items-center gap-1.5 text-3xs text-text-muted">
              <BookOpenCheck className="h-3.5 w-3.5" aria-hidden />
              {room === 0 ? `This interview is full (${max} questions).` : `${attachedCount} added so far · room for ${room} more · random, no repeats`}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
