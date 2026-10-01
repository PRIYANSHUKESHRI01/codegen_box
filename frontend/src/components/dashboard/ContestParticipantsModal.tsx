"use client";

import { useEffect, useState } from "react";
import { Loader2, Trophy, ArrowLeft, FileCode2, Medal } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { cn, withMinDelay } from "@/lib/utils";
import { CodeViewModal, type CodeViewData } from "./CodeViewModal";
import type { ContestParticipantRow, ContestParticipantSubmission } from "@/types/studentReport";
import { Modal } from "@/components/ui/Modal";

interface ContestParticipantsModalProps {
  /** "/tpo/contests" or "/admin/contests" — the role-scoped controller base, same convention ReviewSessionsModal uses for interviews. */
  basePath: string;
  contestSlug: string;
  contestTitle: string;
  onClose: () => void;
}

const VERDICT_TONE: Record<string, string> = {
  accepted: "text-status-success",
  wrong_answer: "text-status-danger",
  runtime_error: "text-status-warning",
  compile_error: "text-status-warning",
};

const VERDICT_LABEL: Record<string, string> = {
  accepted: "Accepted",
  wrong_answer: "Wrong Answer",
  runtime_error: "Runtime Error",
  compile_error: "Compile Error",
};

/**
 * The report a contest's creator opens to see how it actually went — every
 * registrant ranked, drilling into one participant's per-problem submissions
 * (code included). Previously nonexistent: Mock Contests only ever showed a
 * bare registrant count. Mirrors ReviewSessionsModal's list→detail shape.
 */
export function ContestParticipantsModal({ basePath, contestSlug, contestTitle, onClose }: ContestParticipantsModalProps) {
  const [participants, setParticipants] = useState<ContestParticipantRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<ContestParticipantRow | null>(null);

  useEffect(() => {
    api
      .get<{ participants: ContestParticipantRow[] }>(`${basePath}/${contestSlug}/participants`)
      .then((res) => setParticipants(res.participants))
      .catch(() => setParticipants([]))
      .finally(() => setLoading(false));
  }, [basePath, contestSlug]);

  return (
    <Modal onClose={onClose} title={`Participants — ${contestTitle}`} icon={Trophy} size="2xl" bodyClassName="p-4">
      {loading ? (
        <div className="flex items-center justify-center gap-2 py-8 text-xs text-text-muted">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading participants...
        </div>
      ) : participants.length === 0 ? (
        <p className="py-6 text-center text-xs text-text-muted">No one has registered for this contest yet.</p>
      ) : selected ? (
        <ParticipantSubmissions
          basePath={basePath}
          contestSlug={contestSlug}
          contestTitle={contestTitle}
          participant={selected}
          onBack={() => setSelected(null)}
        />
      ) : (
        <div className="space-y-1.5">
          {participants.map((p) => (
            <button
              key={p.participant_id}
              onClick={() => setSelected(p)}
              className="flex w-full items-center justify-between gap-3 rounded-control border border-border-subtle bg-elevated/60 p-3 text-left text-xs transition-colors hover:bg-elevated"
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <div
                  className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-3xs font-bold",
                    p.rank && p.rank <= 3
                      ? "border-amber-500/30 bg-amber-500/15 text-amber-500"
                      : "border-border-subtle bg-surface text-text-muted"
                  )}
                >
                  {p.rank && p.rank <= 3 ? <Medal className="h-3.5 w-3.5" /> : p.rank ?? "—"}
                </div>
                <div className="min-w-0">
                  <div className="truncate font-semibold text-primary">{p.name}</div>
                  <div className="truncate text-3xs text-text-muted">
                    {p.roll_number ?? p.email}
                    {p.section ? ` · Sec ${p.section}` : ""}
                  </div>
                </div>
              </div>
              <div className="shrink-0 text-right">
                <div className="font-mono text-xs font-bold text-primary">{p.score ?? 0} pts</div>
                {p.penalty_minutes ? (
                  <div className="text-3xs text-text-muted">+{p.penalty_minutes}m penalty</div>
                ) : null}
              </div>
            </button>
          ))}
        </div>
      )}
    </Modal>
  );
}

function ParticipantSubmissions({
  basePath,
  contestSlug,
  contestTitle,
  participant,
  onBack,
}: {
  basePath: string;
  contestSlug: string;
  contestTitle: string;
  participant: ContestParticipantRow;
  onBack: () => void;
}) {
  const [submissions, setSubmissions] = useState<ContestParticipantSubmission[] | "loading" | "error">("loading");
  const [viewingCode, setViewingCode] = useState<CodeViewData | null>(null);

  // `basePath` is "/tpo/contests" or "/admin/contests" — the code-view
  // endpoint for a specific submission instead lives under that same
  // role's `/students/{id}/contest-submissions/{id}`, not under `/contests`
  // at all (see TpoStudentReportController). Deriving it here means this
  // component never needs a second prop just to know its own role.
  const studentApiBase = basePath.replace(/\/contests$/, "");

  useEffect(() => {
    setSubmissions("loading");
    api
      .get<{ submissions: ContestParticipantSubmission[] }>(`${basePath}/${contestSlug}/participants/${participant.user_id}/submissions`)
      .then((res) => setSubmissions(res.submissions))
      .catch(() => setSubmissions("error"));
  }, [basePath, contestSlug, participant.user_id]);

  // Opens instantly with everything this row already has (problem, verdict,
  // language, timestamp) and `code: undefined` — this list never carries
  // code (see ContestParticipantSubmission's docblock), so the fetch here
  // only ever has to bring back that one field. Floored at 350ms so it
  // never flickers open-and-shut on a fast connection.
  const openCode = async (s: ContestParticipantSubmission) => {
    setViewingCode({
      title: s.problem_title,
      subtitle: `${contestTitle} — ${participant.name}`,
      language: s.language,
      status: s.status,
      submittedAt: s.submitted_at,
      code: undefined,
    });

    try {
      const res = await withMinDelay(
        api.get<{ submission: { code: string | null } }>(`${studentApiBase}/students/${participant.user_id}/contest-submissions/${s.id}`),
        350
      );
      setViewingCode((prev) => (prev ? { ...prev, code: res.submission.code } : prev));
    } catch (err) {
      setViewingCode(null);
      window.alert(err instanceof ApiError ? err.message : "Failed to load submitted code.");
    }
  };

  return (
    <div className="space-y-3">
      <button onClick={onBack} className="flex items-center gap-1.5 text-2xs font-bold text-text-muted hover:text-primary">
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to participants
      </button>

      <div className="rounded-control border border-border-subtle bg-elevated/60 p-3">
        <div className="font-semibold text-primary">{participant.name}</div>
        <div className="mt-0.5 text-3xs text-text-muted">
          {participant.roll_number ?? participant.email} · Rank {participant.rank ?? "—"} · {participant.score ?? 0} pts
        </div>
      </div>

      {submissions === "loading" ? (
        <div className="flex items-center gap-2 py-6 text-xs text-text-muted">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading submissions...
        </div>
      ) : submissions === "error" ? (
        <p className="py-4 text-center text-2xs text-status-danger">Failed to load submissions.</p>
      ) : submissions.length === 0 ? (
        <p className="py-4 text-center text-2xs text-text-muted">No submissions from this participant.</p>
      ) : (
        <ul className="space-y-1.5">
          {submissions.map((s) => (
            <li
              key={s.id}
              className="flex items-center justify-between gap-2 rounded-control border border-border-subtle bg-surface p-2.5 text-xs"
            >
              <div className="min-w-0">
                <div className="truncate font-semibold text-primary">{s.problem_title}</div>
                <div className={cn("mt-0.5 text-3xs font-bold", VERDICT_TONE[s.status] ?? "text-text-muted")}>
                  {VERDICT_LABEL[s.status] ?? s.status}
                  {s.points_awarded != null && ` · ${s.points_awarded} pts`}
                </div>
              </div>
              <button
                onClick={() => openCode(s)}
                className="flex shrink-0 items-center gap-1 rounded-control border border-border-subtle bg-elevated px-2 py-1 text-3xs font-bold text-text-secondary transition-colors hover:text-primary active:scale-95"
              >
                <FileCode2 className="h-3.5 w-3.5" />
                Code
              </button>
            </li>
          ))}
        </ul>
      )}

      <CodeViewModal data={viewingCode} onClose={() => setViewingCode(null)} />
    </div>
  );
}
