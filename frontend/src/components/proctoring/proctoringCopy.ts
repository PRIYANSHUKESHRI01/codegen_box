/**
 * Activity-specific wording for the shared proctoring screens
 * (ProctoringConsentGate, ProctoringLockedScreen). The camera/fullscreen/
 * strike mechanics are identical everywhere; only what a lock *does* and
 * what the attempt is called differs. `contest` is the original wording,
 * verbatim, and is the default — existing contest callers pass nothing and
 * render exactly what they always did.
 */
export type ProctoringActivity = "contest" | "soft_skill" | "core_test" | "study";

interface ConsentCopy {
  title: string;
  subtitle: string;
  strikes: string;
  /** Only for attempts where the editor's clipboard is restricted (contests); omitted = no line shown. */
  paste?: string;
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
      "Leaving this window or tab, exiting fullscreen, opening developer tools, or stopping your camera or screen share counts as a strike. You get 2 warnings — a 3rd strike submits your current code and ends your attempt. This is reported to your TPO and section coordinator.",
    paste:
      "Pasting is limited to code you copied from the contest editor itself — anything copied from elsewhere is blocked and recorded in your report (it isn't a strike).",
    footer: "By continuing you consent to being recorded and monitored for the duration of this contest attempt as described above.",
  },
  soft_skill: {
    title: "This is a proctored test",
    subtitle: "Required for every Soft Skills test.",
    strikes:
      "Leaving this window or tab, exiting fullscreen, opening developer tools, or stopping your camera or screen share counts as a strike. You get 2 warnings — a 3rd strike submits the answers you've saved so far and ends your attempt. The result is marked as ended by proctoring and can't count as a pass.",
    footer: "By continuing you consent to being recorded and monitored for the duration of this test attempt.",
  },
  core_test: {
    title: "This is a proctored test",
    subtitle: "Required for every Core Prep test.",
    strikes:
      "Leaving this window or tab, exiting fullscreen, opening developer tools, or stopping your camera or screen share counts as a strike. You get 2 warnings — a 3rd strike submits the answers you've saved so far and ends your attempt. The result is marked as ended by proctoring and can't count as a pass.",
    footer: "By continuing you consent to being recorded and monitored for the duration of this test attempt.",
  },
  study: {
    title: "This is a proctored practice sitting",
    subtitle: "Core Prep practice and Skill Drills are taken under proctoring.",
    strikes:
      "Leaving this window or tab, exiting fullscreen, opening developer tools, or stopping your camera or screen share counts as a strike. You get 2 warnings — a 3rd strike closes this sitting, and you can start a new one straight away. Nothing you do here changes your readiness score.",
    footer: "By continuing you consent to being recorded and monitored for the duration of this sitting.",
  },
};

export const LOCKED_COPY: Record<ProctoringActivity, LockedCopy> = {
  contest: {
    title: "You've been locked out of this contest",
    body: "leaving the exam window, exiting fullscreen, opening developer tools, a stopped camera or screen share, or another proctoring finding. Whatever code you had open was submitted for judging before access was revoked.",
    note: "This has been reported to your TPO and section coordinator. If you believe this was a mistake, contact them directly — they can reinstate your attempt.",
    backLabel: "Back to Contest",
  },
  soft_skill: {
    title: "Your test was ended",
    body: "leaving the exam window, exiting fullscreen, opening developer tools, a stopped camera or screen share, or another proctoring finding. The answers you had saved were submitted and graded, and this attempt is marked as ended by proctoring.",
    note: "It can't count as a pass. If you believe this was a mistake, tell whoever assigned this test.",
    backLabel: "Back to Soft Skills",
  },
  core_test: {
    title: "Your test was ended",
    body: "leaving the exam window, exiting fullscreen, opening developer tools, a stopped camera or screen share, or another proctoring finding. The answers you had saved were submitted and graded, and this attempt is marked as ended by proctoring.",
    note: "It can't count as a pass. If you believe this was a mistake, tell your TPO.",
    backLabel: "Back to Core tests",
  },
  study: {
    title: "This sitting was closed",
    body: "leaving the exam window, exiting fullscreen, opening developer tools, a stopped camera or screen share, or another proctoring finding.",
    note: "The answers you had already given are kept. You can start a new sitting straight away.",
    backLabel: "Back",
  },
};
