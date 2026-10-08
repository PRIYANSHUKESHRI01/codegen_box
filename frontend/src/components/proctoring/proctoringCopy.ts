/**
 * Activity-specific wording for the shared proctoring screens
 * (ProctoringConsentGate, ProctoringLockedScreen). The camera/fullscreen/
 * strike mechanics are identical everywhere; only what a lock *does* and
 * what the attempt is called differs. `contest` is the original wording,
 * verbatim, and is the default — existing contest callers pass nothing and
 * render exactly what they always did.
 */
export type ProctoringActivity = "contest" | "soft_skill";

interface ConsentCopy {
  title: string;
  subtitle: string;
  strikes: string;
  footer: string;
}

interface LockedCopy {
  title: string;
  body: string;
  note: string;
  backLabel: string;
}

export const CONSENT_COPY: Record<ProctoringActivity, ConsentCopy> = {
  contest: {
    title: "This is a proctored contest",
    subtitle: "Required for every contest problem — not for practice.",
    strikes:
      "Switching tabs, exiting fullscreen, or opening developer tools counts as a strike. You get 2 warnings — a 3rd strike submits your current code and ends your attempt. This is reported to your TPO and section coordinator.",
    footer: "By continuing you consent to being recorded and monitored for the duration of this contest attempt.",
  },
  soft_skill: {
    title: "This is a proctored test",
    subtitle: "Required for every Soft Skills test.",
    strikes:
      "Switching tabs, exiting fullscreen, or opening developer tools counts as a strike. You get 2 warnings — a 3rd strike submits the answers you've saved so far and ends your attempt. The result is marked as ended by proctoring and can't count as a pass.",
    footer: "By continuing you consent to being recorded and monitored for the duration of this test attempt.",
  },
};

export const LOCKED_COPY: Record<ProctoringActivity, LockedCopy> = {
  contest: {
    title: "You've been locked out of this contest",
    body: "exiting fullscreen, switching tabs, or a detected developer-tools open. Whatever code you had open was submitted for judging before access was revoked.",
    note: "This has been reported to your TPO and section coordinator. If you believe this was a mistake, contact them directly — they can reinstate your attempt.",
    backLabel: "Back to Contest",
  },
  soft_skill: {
    title: "Your test was ended",
    body: "exiting fullscreen, switching tabs, or a detected developer-tools open. The answers you had saved were submitted and graded, and this attempt is marked as ended by proctoring.",
    note: "It can't count as a pass. If you believe this was a mistake, tell whoever assigned this test.",
    backLabel: "Back to Soft Skills",
  },
};
