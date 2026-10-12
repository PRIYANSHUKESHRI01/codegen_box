"use client";

import { useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Copy, Crown, Loader2, LogOut, Lock, Plus, UserMinus, Users } from "lucide-react";
import { ArenaDialog } from "@/components/arena/ArenaDialog";
import { useCopy } from "@/components/arena/detail/shared";
import { Reveal } from "@/components/arena/motion";
import { ArenaAvatar, PageNotice } from "@/components/arena/primitives";
import { arenaApi, errorMessage } from "@/lib/hackathon";
import { cn } from "@/lib/utils";
import type { HackathonDetail, TeamMember } from "@/types/hackathon";

interface TeamPanelProps {
  hackathon: HackathonDetail;
  onChange: (hackathon: HackathonDetail) => void;
  /** Called after the student leaves the hackathon entirely. */
  onLeft: (hackathon: HackathonDetail) => void;
}

export function TeamPanel({ hackathon, onChange, onLeft }: TeamPanelProps) {
  const team = hackathon.my_team;
  const codeInput = useRef<HTMLInputElement>(null);
  const { copied, copy } = useCopy();
  const [leaving, setLeaving] = useState(false);
  const [removing, setRemoving] = useState<TeamMember | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!team) return null;

  const needsMore = team.members.length < team.min_size;
  const full = team.members.length >= team.max_size;
  const solo = hackathon.team_size.max === 1;
  const open = Math.max(0, team.max_size - team.members.length);

  const run = async (fn: () => Promise<{ hackathon: HackathonDetail }>, done: (h: HackathonDetail) => void) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fn();
      done(res.hackathon);
    } catch (err) {
      setError(errorMessage(err, "That didn't work. Please try again."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Reveal y={12}>
        <section aria-labelledby="team-heading" className="ar-raised overflow-hidden">
          <div className="relative px-5 pb-5 pt-5 sm:px-6 sm:pt-6">
            <div aria-hidden className="pointer-events-none absolute -right-10 -top-16 h-44 w-44 rounded-full bg-[rgb(var(--ar-a)/0.22)] blur-3xl" />

            <div className="relative flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="ar-eyebrow mb-2.5">{solo ? "Your entry" : "Your team"}</p>
                <h2 id="team-heading" className="ar-h1 truncate text-white">
                  {team.name}
                </h2>
              </div>

              {!solo && (
                <div className="flex flex-col items-end gap-2">
                  <div className="flex items-center" aria-hidden>
                    {team.members.map((m, i) => (
                      <span key={m.user_id} className={cn(i > 0 && "-ml-2.5")} title={m.name}>
                        <ArenaAvatar name={m.name} url={m.avatar_url} size={36} className="!ring-[3px] !ring-[#0d1020]" />
                      </span>
                    ))}
                    {team.max_size <= 6 &&
                      Array.from({ length: open }).map((_, i) => (
                        <span key={`slot-${i}`} className="dt-slot-empty -ml-2.5 h-9 w-9 bg-[#0d1020]" title="Open spot">
                          <Plus className="h-4 w-4" />
                        </span>
                      ))}
                  </div>
                  <span className="ar-chip">
                    <Users className="h-3.5 w-3.5" aria-hidden />
                    <span className="ar-num">
                      {team.members.length} / {team.max_size}
                    </span>{" "}
                    members
                  </span>
                </div>
              )}
            </div>

            {team.locked && (
              <div className="relative mt-5 flex items-start gap-2.5 rounded-xl border border-amber-300/25 bg-amber-300/[0.07] px-3.5 py-3 text-[13px] leading-relaxed text-amber-100">
                <Lock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                <span>The team is locked — it has submitted its project, or the deadline has passed.</span>
              </div>
            )}

            {!solo && needsMore && !team.locked && (
              <div className="relative mt-5 rounded-xl border border-sky-300/25 bg-sky-300/[0.07] px-3.5 py-3 text-[13px] leading-relaxed text-sky-100">
                This hackathon needs teams of at least <strong className="font-semibold">{team.min_size}</strong>. Share your invite code to add {team.min_size - team.members.length} more.
              </div>
            )}
          </div>

          {!solo && (
            <ul className="divide-y divide-white/[0.06] border-t border-white/[0.07]" aria-label="Team members">
              {team.members.map((m) => (
                <li key={m.user_id} className="flex items-center gap-3.5 px-5 py-3 transition-colors hover:bg-white/[0.035] sm:px-6">
                  <ArenaAvatar name={m.name} url={m.avatar_url} size={40} />
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 truncate text-[14.5px] font-semibold text-white">
                      {m.name}
                      {m.is_you && <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[color:var(--ar-text-2)]">You</span>}
                    </p>
                    <p className="truncate text-[12.5px] text-[color:var(--ar-text-3)]">{m.handle ? `@${m.handle}` : "AptRun student"}</p>
                  </div>
                  {m.is_leader ? (
                    <span className="ar-chip" style={{ color: "#fde9a8", background: "rgba(251,191,36,0.12)", borderColor: "rgba(251,191,36,0.4)" }}>
                      <Crown className="h-3.5 w-3.5" aria-hidden /> Leader
                    </span>
                  ) : (
                    team.is_leader &&
                    !team.locked && (
                      <button
                        type="button"
                        onClick={() => setRemoving(m)}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-full text-[color:var(--ar-text-3)] transition-colors hover:bg-rose-500/15 hover:text-rose-200"
                        aria-label={`Remove ${m.name} from the team`}
                        title="Remove from team"
                      >
                        <UserMinus className="h-4 w-4" aria-hidden />
                      </button>
                    )
                  )}
                </li>
              ))}
            </ul>
          )}

          {!solo && !team.locked && (
            <div className="border-t border-white/[0.07] p-4 sm:p-5">
              <div className="dt-code rounded-2xl p-4">
                <label htmlFor="invite-code-display" className="ar-label">
                  Invite code
                </label>
                <div className="flex items-stretch gap-2.5">
                  <input
                    ref={codeInput}
                    id="invite-code-display"
                    readOnly
                    value={team.invite_code}
                    onFocus={(e) => e.currentTarget.select()}
                    onClick={() => copy(team.invite_code, codeInput.current)}
                    className="ar-input min-w-0 cursor-copy !min-h-[52px] !bg-black/30 text-center font-mono !text-[20px] font-bold tracking-[0.32em]"
                    aria-describedby="invite-hint"
                  />
                  <button
                    type="button"
                    onClick={() => copy(team.invite_code, codeInput.current)}
                    className={cn("ar-btn shrink-0 !h-auto min-w-[112px]", copied ? "ar-btn-ghost !border-emerald-300/50 !bg-emerald-400/15 !text-emerald-100" : "ar-btn-ghost")}
                    aria-live="polite"
                  >
                    <AnimatePresence mode="wait" initial={false}>
                      <motion.span
                        key={copied ? "done" : "idle"}
                        initial={{ scale: 0.4, opacity: 0, rotate: -40 }}
                        animate={{ scale: 1, opacity: 1, rotate: 0 }}
                        exit={{ scale: 0.4, opacity: 0 }}
                        transition={{ type: "spring", stiffness: 500, damping: 24 }}
                        className="inline-flex"
                      >
                        {copied ? <Check className="h-4 w-4 text-emerald-300" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
                      </motion.span>
                    </AnimatePresence>
                    {copied ? "Copied" : "Copy"}
                  </button>
                </div>
                <p id="invite-hint" className="ar-hint">
                  {full ? "Your team is full." : "Share this with classmates — they enter it under “Join a team” when registering."}
                </p>
              </div>
            </div>
          )}

          {error && (
            <div className="px-5 pb-4 sm:px-6">
              <PageNotice>{error}</PageNotice>
            </div>
          )}

          {!team.locked && (
            <div className="border-t border-white/[0.07] px-5 py-3.5 sm:px-6">
              <button
                type="button"
                onClick={() => setLeaving(true)}
                className="inline-flex min-h-[40px] items-center gap-2 text-[13px] font-semibold text-[color:var(--ar-text-3)] transition-colors hover:text-rose-200"
              >
                <LogOut className="h-4 w-4" aria-hidden />
                {solo ? "Withdraw from this hackathon" : "Leave this team and hackathon"}
              </button>
            </div>
          )}
        </section>
      </Reveal>

      <ArenaDialog
        open={leaving}
        onClose={() => !busy && setLeaving(false)}
        dismissible={!busy}
        size="sm"
        tone="danger"
        icon={<LogOut className="h-5 w-5" aria-hidden />}
        title="Leave this hackathon?"
        description={
          solo || team.members.length === 1
            ? "Your entry and any saved draft will be removed. You can register again while registration is open."
            : team.is_leader
              ? "Leadership passes to the teammate who joined first. You can rejoin with the invite code while registration is open."
              : "You'll be removed from the team. You can rejoin with the invite code while registration is open."
        }
        footer={
          <>
            <button type="button" className="ar-btn ar-btn-ghost" onClick={() => setLeaving(false)} disabled={busy}>
              Stay
            </button>
            <button
              type="button"
              className="ar-btn ar-btn-danger"
              disabled={busy}
              onClick={() =>
                run(
                  () => arenaApi.withdraw(hackathon.slug),
                  (h) => {
                    setLeaving(false);
                    onLeft(h);
                  }
                )
              }
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
              Leave
            </button>
          </>
        }
      >
        {error && <PageNotice>{error}</PageNotice>}
      </ArenaDialog>

      <ArenaDialog
        open={removing !== null}
        onClose={() => !busy && setRemoving(null)}
        dismissible={!busy}
        size="sm"
        tone="danger"
        icon={<UserMinus className="h-5 w-5" aria-hidden />}
        title={`Remove ${removing?.name ?? "teammate"}?`}
        description="They'll lose access to the team's project and can rejoin with the invite code while registration is open."
        footer={
          <>
            <button type="button" className="ar-btn ar-btn-ghost" onClick={() => setRemoving(null)} disabled={busy}>
              Cancel
            </button>
            <button
              type="button"
              className="ar-btn ar-btn-danger"
              disabled={busy}
              onClick={() =>
                removing &&
                run(
                  () => arenaApi.removeMember(hackathon.slug, removing.user_id),
                  (h) => {
                    setRemoving(null);
                    onChange(h);
                  }
                )
              }
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
              Remove
            </button>
          </>
        }
      >
        {error && <PageNotice>{error}</PageNotice>}
      </ArenaDialog>
    </>
  );
}
