import { describe, expect, it } from "vitest";
import {
  answeredCount,
  currentQuestion,
  currentResult,
  firstUnanswered,
  initialSessionState,
  pendingAnswer,
  sessionReducer,
  type SessionAction,
  type SessionState,
} from "@/lib/vocabulary/sessionState";
import type {
  VocabularyAnswerResponse,
  VocabularyAnswerResult,
  VocabularyCard,
  VocabularyQuestion,
  VocabularySession,
  VocabularySummary,
} from "@/types/learningCentre";

const card = (word: string): VocabularyCard => ({ word_id: 1, word, part_of_speech: "noun", meaning: `meaning of ${word}`, example: `A ${word}.`, synonyms: [], note: null });

const question = (index: number, type: VocabularyQuestion["type"] = "meaning"): VocabularyQuestion => ({
  index,
  type,
  prompt: `Question ${index}`,
  part_of_speech: "noun",
  is_echo: false,
  options: type === "recall" ? undefined : ["a", "b", "c", "d"],
});

const summary: VocabularySummary = {
  score: 100, correct: 3, total: 3, duration_seconds: 30, new_words_met: 2, words_moved_up: 2, mastered_now: [], missed: [],
  daily_goal: { answered: 3, goal: 10, reached: false }, streak_days: 1, can_retry_missed: false,
};

const result = (index: number, extra: Partial<VocabularyAnswerResult> = {}): VocabularyAnswerResult => ({
  index, type: "meaning", is_correct: true, close: false, selected_index: 0, response: null, correct_index: 0, correct_answer: "a",
  explanation: "because", card: card("alpha"), progress: null, ...extra,
});

const response = (index: number, complete = false): VocabularyAnswerResponse => ({
  ...result(index), answered: index + 1, total: 3, complete, summary: complete ? summary : null,
});

const session = (extra: Partial<VocabularySession> = {}): VocabularySession => ({
  attempt_id: 7, kind: "daily", deck: null, title: "Today’s sprint", topic: "t", difficulty: "mixed", total: 3, new_count: 2, review_count: 1,
  practice: false, retry: false, cards: [card("alpha"), card("bravo")], questions: [question(0), question(1), question(2)],
  results: [], answered: 0, complete: false, summary: null, ...extra,
});

const run = (actions: SessionAction[], from: SessionState = initialSessionState) => actions.reduce(sessionReducer, from);

describe("loading a session", () => {
  it("starts a brand-new session by meeting its new words", () => {
    const s = run([{ type: "loaded", session: session() }]);
    expect(s.phase).toBe("meet");
    expect(s.cardIndex).toBe(0);
  });

  it("goes straight to the questions when there are no new words", () => {
    const s = run([{ type: "loaded", session: session({ cards: [] }) }]);
    expect(s.phase).toBe("question");
    expect(s.current).toBe(0);
  });

  it("never repeats the introductions once the student has started answering", () => {
    const s = run([{ type: "loaded", session: session({ results: [result(0), result(1)], answered: 2 }) }]);
    expect(s.phase).toBe("question");
    expect(s.current).toBe(2);
    expect(answeredCount(s)).toBe(2);
  });

  it("opens a finished session on its summary", () => {
    const s = run([{ type: "loaded", session: session({ complete: true, results: [result(0), result(1), result(2)], summary }) }]);
    expect(s.phase).toBe("summary");
    expect(s.summary).toBe(summary);
  });

  it("resumes at the first unanswered question even if answers were given out of order", () => {
    const s = run([{ type: "loaded", session: session({ cards: [], results: [result(1)] }) }]);
    expect(s.current).toBe(0);
  });

  it("shows an error state when loading fails", () => {
    const s = run([{ type: "failed", message: "nope" }]);
    expect(s.phase).toBe("error");
    expect(s.error).toBe("nope");
  });
});

describe("meeting the words", () => {
  const meeting = () => run([{ type: "loaded", session: session() }]);

  it("steps through the cards and then moves on to the questions", () => {
    let s = run([{ type: "nextCard" }], meeting());
    expect([s.phase, s.cardIndex]).toEqual(["meet", 1]);
    s = run([{ type: "nextCard" }], s);
    expect([s.phase, s.current]).toEqual(["question", 0]);
  });

  it("can go back a card but not before the first", () => {
    let s = run([{ type: "nextCard" }, { type: "prevCard" }, { type: "prevCard" }], meeting());
    expect(s.cardIndex).toBe(0);
    s = run([{ type: "nextCard" }], s);
    expect(s.cardIndex).toBe(1);
  });

  it("can be skipped entirely", () => {
    expect(run([{ type: "skipCards" }], meeting()).phase).toBe("question");
  });

  it("ignores card actions outside the meet phase", () => {
    const q = run([{ type: "loaded", session: session({ cards: [] }) }]);
    expect(run([{ type: "nextCard" }, { type: "skipCards" }, { type: "prevCard" }], q)).toBe(q);
  });
});

describe("answering", () => {
  const asking = () => run([{ type: "loaded", session: session({ cards: [] }) }]);

  it("holds a chosen option until it is checked, and lets the student change their mind", () => {
    const s = run([{ type: "select", index: 2 }, { type: "select", index: 1 }], asking());
    expect(s.selected).toBe(1);
    expect(pendingAnswer(s)).toBe(1);
  });

  it("has nothing to check before an option is chosen", () => {
    expect(pendingAnswer(asking())).toBeNull();
  });

  it("checks a typed answer trimmed, and treats blank as nothing", () => {
    const recall = run([{ type: "loaded", session: session({ cards: [], questions: [question(0, "recall")] }) }]);
    expect(pendingAnswer(run([{ type: "type", text: "   " }], recall))).toBeNull();
    expect(pendingAnswer(run([{ type: "type", text: "  alpha " }], recall))).toBe("alpha");
  });

  it("shows the verdict after an answer and counts it", () => {
    const s = run([{ type: "select", index: 0 }, { type: "submitting" }, { type: "answered", response: response(0) }], asking());
    expect(s.phase).toBe("feedback");
    expect(s.submitting).toBe(false);
    expect(answeredCount(s)).toBe(1);
    expect(currentResult(s)?.index).toBe(0);
  });

  it("cannot change the choice while the answer is being checked", () => {
    const s = run([{ type: "select", index: 0 }, { type: "submitting" }, { type: "select", index: 3 }, { type: "type", text: "x" }], asking());
    expect(s.selected).toBe(0);
    expect(s.typed).toBe("");
  });

  it("keeps the question and the choice when checking fails, so the student can retry", () => {
    const s = run([{ type: "select", index: 2 }, { type: "submitting" }, { type: "answerFailed", message: "offline" }], asking());
    expect(s.phase).toBe("question");
    expect(s.selected).toBe(2);
    expect(s.error).toBe("offline");
    expect(s.submitting).toBe(false);
  });

  it("moves to the next question on continue, with a clean slate", () => {
    const s = run(
      [{ type: "select", index: 0 }, { type: "answered", response: response(0) }, { type: "continue" }],
      asking()
    );
    expect(s.phase).toBe("question");
    expect(s.current).toBe(1);
    expect([s.selected, s.typed, s.error]).toEqual([null, "", null]);
    expect(currentQuestion(s)?.index).toBe(1);
  });

  it("goes to the summary after the last answer", () => {
    const s = run(
      [
        { type: "answered", response: response(0) },
        { type: "continue" },
        { type: "answered", response: response(1) },
        { type: "continue" },
        { type: "answered", response: response(2, true) },
        { type: "continue" },
      ],
      asking()
    );
    expect(s.phase).toBe("summary");
    expect(s.summary).toBe(summary);
  });

  it("only continues from the feedback screen", () => {
    const s = asking();
    expect(run([{ type: "continue" }], s)).toBe(s);
  });

  it("does not submit when it is not a question", () => {
    const meeting = run([{ type: "loaded", session: session() }]);
    expect(run([{ type: "submitting" }], meeting)).toBe(meeting);
  });
});

describe("firstUnanswered", () => {
  it("finds the first gap and reports none when complete", () => {
    const qs = [question(0), question(1), question(2)];
    expect(firstUnanswered(qs, {})).toBe(0);
    expect(firstUnanswered(qs, { 0: result(0), 2: result(2) })).toBe(1);
    expect(firstUnanswered(qs, { 0: result(0), 1: result(1), 2: result(2) })).toBeNull();
  });
});
