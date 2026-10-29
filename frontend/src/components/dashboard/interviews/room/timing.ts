/**
 * The pauses the interview builds in. In one object, rather than constants, so a test can shorten them without waiting through real seconds.
 */
export const timing = {
  /** The 3-2-1 after the candidate presses "Begin interview", before the interviewer speaks. */
  countdownSeconds: 3,
  /** A beat of quiet between the greeting and the first question, so it doesn't run on. */
  afterGreetingMs: 450,
};
