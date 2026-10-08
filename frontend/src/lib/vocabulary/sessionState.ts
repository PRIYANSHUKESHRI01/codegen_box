import type {
  VocabularyAnswerResponse,
  VocabularyAnswerResult,
  VocabularyQuestion,
  VocabularySession,
  VocabularySummary,
} from "@/types/learningCentre";

/**
 * The state machine behind one vocabulary practice session, kept free of
 * React so every transition can be tested on its own.
 *
 *   loading → meet (new words, first) → question ⇄ feedback → summary
 *
 * A session that is picked up again (reload, coming back later) skips straight
 * to the first unanswered question, or to the summary if it was finished.
 */
export type VocabularyPhase = "loading" | "meet" | "question" | "feedback" | "summary" | "error";

export interface SessionState {
  phase: VocabularyPhase;
  session: VocabularySession | null;
  /** Which "meet the word" card is showing. */
  cardIndex: number;
  /** Index into session.questions of the question on screen. */
  current: number;
  /** The option chosen but not yet checked (multiple choice). */
  selected: number | null;
  /** What has been typed so far (recall). */
  typed: string;
  /** The server's verdict on every question answered so far, by question index. */
  results: Record<number, VocabularyAnswerResult>;
  summary: VocabularySummary | null;
  submitting: boolean;
  error: string | null;
}

export type SessionAction =
  | { type: "loaded"; session: VocabularySession }
  | { type: "failed"; message: string }
  | { type: "nextCard" }
  | { type: "prevCard" }
  | { type: "skipCards" }
  | { type: "select"; index: number }
  | { type: "type"; text: string }
  | { type: "submitting" }
  | { type: "answered"; response: VocabularyAnswerResponse }
  | { type: "answerFailed"; message: string }
  | { type: "continue" };

export const initialSessionState: SessionState = {
  phase: "loading",
  session: null,
  cardIndex: 0,
  current: 0,
  selected: null,
  typed: "",
  results: {},
  summary: null,
  submitting: false,
  error: null,
};

/** The first question that has no verdict yet, or null when every question is answered. */
export function firstUnanswered(questions: VocabularyQuestion[], results: Record<number, VocabularyAnswerResult>): number | null {
  const index = questions.findIndex((q) => results[q.index] === undefined);
  return index === -1 ? null : index;
}

export function answeredCount(state: SessionState): number {
  return Object.keys(state.results).length;
}

export function currentQuestion(state: SessionState): VocabularyQuestion | null {
  return state.session?.questions[state.current] ?? null;
}

export function currentResult(state: SessionState): VocabularyAnswerResult | null {
  const q = currentQuestion(state);
  return q ? state.results[q.index] ?? null : null;
}

/** What would be sent if the student pressed "Check" now, or null when they have not answered yet. */
export function pendingAnswer(state: SessionState): number | string | null {
  const q = currentQuestion(state);
  if (!q) return null;
  if (q.type === "recall") return state.typed.trim() === "" ? null : state.typed.trim();
  return state.selected;
}

function startOfQuestions(state: SessionState, session: VocabularySession): SessionState {
  const next = firstUnanswered(session.questions, state.results);
  if (next === null) {
    return { ...state, phase: "summary", summary: state.summary ?? session.summary };
  }
  return { ...state, phase: "question", current: next, selected: null, typed: "" };
}

export function sessionReducer(state: SessionState, action: SessionAction): SessionState {
  switch (action.type) {
    case "loaded": {
      const { session } = action;
      const results: Record<number, VocabularyAnswerResult> = {};
      for (const r of session.results) results[r.index] = r;

      const base: SessionState = { ...initialSessionState, session, results, summary: session.summary };

      if (session.complete) return { ...base, phase: "summary" };
      // A brand-new session introduces its new words first; one already under way never repeats the introductions.
      if (session.cards.length > 0 && session.results.length === 0) return { ...base, phase: "meet", cardIndex: 0 };
      return startOfQuestions(base, session);
    }

    case "failed":
      return { ...state, phase: "error", error: action.message, submitting: false };

    case "nextCard": {
      if (state.phase !== "meet" || !state.session) return state;
      if (state.cardIndex + 1 < state.session.cards.length) return { ...state, cardIndex: state.cardIndex + 1 };
      return startOfQuestions(state, state.session);
    }

    case "prevCard":
      return state.phase === "meet" ? { ...state, cardIndex: Math.max(0, state.cardIndex - 1) } : state;

    case "skipCards":
      return state.phase === "meet" && state.session ? startOfQuestions(state, state.session) : state;

    case "select":
      return state.phase === "question" && !state.submitting ? { ...state, selected: action.index } : state;

    case "type":
      return state.phase === "question" && !state.submitting ? { ...state, typed: action.text } : state;

    case "submitting":
      return state.phase === "question" ? { ...state, submitting: true, error: null } : state;

    case "answered": {
      const { response } = action;
      return {
        ...state,
        phase: "feedback",
        submitting: false,
        error: null,
        results: { ...state.results, [response.index]: response },
        summary: response.complete ? response.summary : state.summary,
      };
    }

    case "answerFailed":
      return { ...state, submitting: false, error: action.message };

    case "continue": {
      if (state.phase !== "feedback" || !state.session) return state;
      return startOfQuestions({ ...state, error: null }, state.session);
    }

    default:
      return state;
  }
}
