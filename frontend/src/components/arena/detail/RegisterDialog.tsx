"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Check, KeyRound, Loader2, Rocket, User, Users } from "lucide-react";
import { ArenaDialog } from "@/components/arena/ArenaDialog";
import { Confetti } from "@/components/arena/motion";
import { PageNotice } from "@/components/arena/primitives";
import { arenaApi, errorCode, errorMessage } from "@/lib/hackathon";
import { cn } from "@/lib/utils";
import type { HackathonDetail } from "@/types/hackathon";

type Choice = "solo" | "create" | "join";

const OPTIONS: { key: Choice; title: string; body: string; icon: typeof User }[] = [
  { key: "solo", title: "Go solo", body: "Build on your own. You can still invite teammates later.", icon: User },
  { key: "create", title: "Create a team", body: "Start a team and share the invite code with friends.", icon: Users },
  { key: "join", title: "Join a team", body: "Got an invite code from a teammate? Enter it here.", icon: KeyRound },
];

interface RegisterDialogProps {
  hackathon: HackathonDetail;
  open: boolean;
  onClose: () => void;
  /** Called with the refreshed hackathon once registration succeeds. */
  onRegistered: (hackathon: HackathonDetail) => void;
}

export function RegisterDialog({ hackathon, open, onClose, onRegistered }: RegisterDialogProps) {
  const { allows_teams: allowsTeams, team_required: teamRequired } = hackathon.registration;
  const available = OPTIONS.filter((o) => (o.key === "solo" ? !teamRequired : allowsTeams));

  const [choice, setChoice] = useState<Choice>(available[0]?.key ?? "solo");
  const [teamName, setTeamName] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<"team_name" | "invite_code" | null>(null);
  const [burst, setBurst] = useState(0);

  useEffect(() => {
    if (open) {
      setChoice(available[0]?.key ?? "solo");
      setTeamName("");
      setCode("");
      setError(null);
      setFieldError(null);
    }
    // Reset only when the dialog opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const submit = async () => {
    setError(null);
    setFieldError(null);

    if (choice === "create" && teamName.trim().length < 3) {
      setFieldError("team_name");
      setError("Give your team a name — at least 3 characters.");
      return;
    }

    if (choice === "join" && code.trim().length === 0) {
      setFieldError("invite_code");
      setError("Enter the invite code your teammate shared.");
      return;
    }

    setBusy(true);
    try {
      const res = await arenaApi.register(hackathon.slug, {
        mode: choice,
        ...(choice === "create" ? { team_name: teamName.trim() } : {}),
        ...(choice === "join" ? { invite_code: code.trim() } : {}),
      });
      // Celebrate first: the burst outlives the dialog (it is drawn by this component, not inside the panel).
      setBurst(Date.now());
      onRegistered(res.hackathon);
    } catch (err) {
      const reason = errorCode(err);
      setError(errorMessage(err, "Couldn't register you. Please try again."));
      if (reason === "team_name_taken" || reason === "invalid_team_name") setFieldError("team_name");
      if (reason === "invalid_invite_code" || reason === "team_full" || reason === "team_locked") setFieldError("invite_code");
      if (reason === "already_registered")
        onRegistered(
          await arenaApi
            .detail(hackathon.slug)
            .then((r) => r.hackathon)
            .catch(() => hackathon)
        );
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div aria-hidden className="pointer-events-none fixed inset-x-0 top-[24%] z-[90]">
        <Confetti burst={burst} pieces={72} />
      </div>

      <ArenaDialog
        open={open}
        onClose={onClose}
        dismissible={!busy}
        icon={<Rocket className="h-6 w-6" aria-hidden />}
        title={`Join ${hackathon.title}`}
        description={
          teamRequired
            ? `Teams of ${hackathon.team_size.min}–${hackathon.team_size.max} students. Create a team or join one with an invite code.`
            : allowsTeams
              ? `Solo or in a team of up to ${hackathon.team_size.max}. You can pick now and invite people later.`
              : "This hackathon is solo only. You'll compete on your own."
        }
        footer={
          <>
            <button type="button" className="ar-btn ar-btn-ghost" onClick={onClose} disabled={busy}>
              Cancel
            </button>
            <button type="button" className="ar-btn ar-btn-primary" onClick={submit} disabled={busy}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
              {choice === "join" ? "Join team" : choice === "create" ? "Create team & register" : "Register"}
            </button>
          </>
        }
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          className="space-y-5"
        >
          {available.length > 1 && (
            <fieldset>
              <legend className="sr-only">How do you want to take part?</legend>
              <div className="grid gap-2.5">
                {available.map((o) => {
                  const selected = choice === o.key;

                  return (
                    <label key={o.key} data-selected={selected} className="dt-option">
                      <input type="radio" name="choice" value={o.key} checked={selected} onChange={() => setChoice(o.key)} className="sr-only" />
                      <span
                        className={cn(
                          "mt-px inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors",
                          selected
                            ? "bg-gradient-to-br from-[rgb(var(--ar-a))] to-[rgb(var(--ar-b))] text-white shadow-[0_10px_22px_-10px_rgb(var(--ar-a)/0.9)]"
                            : "bg-white/10 text-[color:var(--ar-text-2)]"
                        )}
                      >
                        <o.icon className="h-[18px] w-[18px]" aria-hidden />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[14.5px] font-semibold text-white">{o.title}</span>
                        <span className="mt-0.5 block text-[13px] leading-snug text-[color:var(--ar-text-2)]">{o.body}</span>
                      </span>
                      <span aria-hidden className="dt-radio">
                        <Check className="h-3 w-3" strokeWidth={3.5} />
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
          )}

          {choice === "create" && (
            <Field label="Team name" htmlFor="team-name" error={fieldError === "team_name" ? error : null} hint="Shown to everyone on the leaderboard.">
              <input
                id="team-name"
                data-autofocus
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                maxLength={60}
                placeholder="e.g. Byte Brigade"
                className="ar-input"
                aria-invalid={fieldError === "team_name"}
                autoComplete="off"
              />
            </Field>
          )}

          {choice === "join" && (
            <Field label="Invite code" htmlFor="invite-code" error={fieldError === "invite_code" ? error : null} hint="8 characters, from your team leader.">
              <input
                id="invite-code"
                data-autofocus
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                maxLength={12}
                placeholder="K7M2XQ4P"
                className="ar-input !min-h-[50px] text-center font-mono !text-[18px] font-semibold tracking-[0.3em]"
                aria-invalid={fieldError === "invite_code"}
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
              />
            </Field>
          )}

          {error && !fieldError && <PageNotice>{error}</PageNotice>}

          {/* Lets Enter submit the form without a visible duplicate button. */}
          <button type="submit" className="sr-only" tabIndex={-1} aria-hidden>
            Submit
          </button>
        </form>
      </ArenaDialog>
    </>
  );
}

function Field({ label, htmlFor, hint, error, children }: { label: string; htmlFor: string; hint?: string; error?: string | null; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="ar-label">
        {label}
      </label>
      {children}
      {error ? (
        <p role="alert" className="ar-error">
          {error}
        </p>
      ) : (
        hint && <p className="ar-hint">{hint}</p>
      )}
    </div>
  );
}
