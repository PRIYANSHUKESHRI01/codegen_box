/**
 * Every language the judge runs, in the order the editor's language picker shows them, with the label
 * a student reads, the Monaco language id that highlights it in the editor, and the Prism grammar the
 * read-only code viewer uses. One list, so the picker, the editor and the viewer cannot drift apart.
 *
 * `id` is exactly a key of backend/config/piston.php 'languages' (and JudgeService::SUPPORTED_LANGUAGES).
 * The order and labels follow LeetCode's picker. Two of them need a note:
 *  - "Python3" is our `python` (Python 3.10) and "Python" is `python2` (Python 2.7), which is what
 *    LeetCode means by those two names. The ids stay as they are because saved drafts and past
 *    submissions are keyed by them.
 *  - Monaco has no Erlang mode and no Racket mode, so those two borrow the nearest one it has (Racket is
 *    a Lisp: `scheme`) or none (`plaintext`).
 */
export interface JudgeLanguage {
  id: string;
  label: string;
  monaco: string;
  prism: string;
}

export const JUDGE_LANGUAGES: readonly JudgeLanguage[] = [
  { id: "cpp", label: "C++", monaco: "cpp", prism: "cpp" },
  { id: "java", label: "Java", monaco: "java", prism: "java" },
  { id: "python", label: "Python3", monaco: "python", prism: "python" },
  { id: "python2", label: "Python", monaco: "python", prism: "python" },
  { id: "javascript", label: "JavaScript", monaco: "javascript", prism: "javascript" },
  { id: "typescript", label: "TypeScript", monaco: "typescript", prism: "typescript" },
  { id: "csharp", label: "C#", monaco: "csharp", prism: "csharp" },
  { id: "c", label: "C", monaco: "c", prism: "c" },
  { id: "go", label: "Go", monaco: "go", prism: "go" },
  { id: "kotlin", label: "Kotlin", monaco: "kotlin", prism: "kotlin" },
  { id: "swift", label: "Swift", monaco: "swift", prism: "swift" },
  { id: "rust", label: "Rust", monaco: "rust", prism: "rust" },
  { id: "ruby", label: "Ruby", monaco: "ruby", prism: "ruby" },
  { id: "php", label: "PHP", monaco: "php", prism: "php" },
  { id: "dart", label: "Dart", monaco: "dart", prism: "dart" },
  { id: "scala", label: "Scala", monaco: "scala", prism: "scala" },
  { id: "elixir", label: "Elixir", monaco: "elixir", prism: "elixir" },
  { id: "erlang", label: "Erlang", monaco: "plaintext", prism: "erlang" },
  { id: "racket", label: "Racket", monaco: "scheme", prism: "racket" },
];

const BY_ID = new Map(JUDGE_LANGUAGES.map((language) => [language.id, language]));

export function judgeLanguage(id: string): JudgeLanguage | undefined {
  return BY_ID.get(id);
}

/** What the student reads for a language id; an id the list doesn't know is shown as itself rather than hidden. */
export function languageLabel(id: string): string {
  return BY_ID.get(id)?.label ?? id;
}

export function monacoLanguageFor(id: string): string {
  return BY_ID.get(id)?.monaco ?? "plaintext";
}

export function prismLanguageFor(id: string): string {
  return BY_ID.get(id)?.prism ?? id;
}

/**
 * The picker's options: only the languages this problem offers, in the picker's own order. Anything the
 * server offers that this list doesn't know yet goes last, in the order the server gave it, so a language
 * added on the backend is selectable immediately instead of silently missing.
 */
export function orderedLanguageIds(available: readonly string[]): string[] {
  const offered = new Set(available);
  const known = JUDGE_LANGUAGES.filter((language) => offered.has(language.id)).map((language) => language.id);
  const unknown = available.filter((id) => !BY_ID.has(id));

  return [...known, ...unknown];
}
