/**
 * A person's name starts every word with a capital, whatever they typed at sign-up ("alex chen" -> "Alex Chen").
 *
 * The same rule as `User::properName()` on the server, which is the source of truth (it tidies the name when it is stored and
 * whenever it is read, so every screen, e-mail and report agrees). This copy exists for what the server has not touched: the
 * session cached in the browser before it was deployed, and a response from an older API - so the signed-in person never sees
 * their own name in lower case, not even for a frame.
 *
 * It only ever RAISES a lowercase letter that opens a word (or a hyphenated part: "anne-marie" -> "Anne-Marie") and collapses
 * stray spaces. Nothing else is touched, so "McDonald", "O'Brien" and an all-capitals "AKASH" stay exactly as typed.
 */
export function properName(name: string): string;
export function properName(name: string | null | undefined): string | null | undefined;
export function properName(name: string | null | undefined): string | null | undefined {
  if (name == null) return name;
  return name.replace(/\s+/g, " ").trim().replace(new RegExp("(^|[\\s-])(\\p{Ll})", "gu"), (_, lead: string, letter: string) => lead + letter.toUpperCase());
}

/** The same user, with a properly capitalised name. Returns the object it was given when nothing needs changing. */
export function withProperName<T extends { name?: string | null }>(user: T): T;
export function withProperName<T extends { name?: string | null }>(user: T | null): T | null;
export function withProperName<T extends { name?: string | null }>(user: T | null): T | null {
  if (!user || typeof user.name !== "string") return user;
  const name = properName(user.name);
  return name === user.name ? user : { ...user, name };
}
