import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { JUDGE_LANGUAGES, judgeLanguage, languageLabel, monacoLanguageFor, orderedLanguageIds, prismLanguageFor } from "@/lib/judgeLanguages";

// LeetCode's picker, top to bottom, left to right — the order and the labels the editor must show.
const PICKER_ORDER = ["C++", "Java", "Python3", "Python", "JavaScript", "TypeScript", "C#", "C", "Go", "Kotlin", "Swift", "Rust", "Ruby", "PHP", "Dart", "Scala", "Elixir", "Erlang", "Racket"];

// src/tests/unit -> src/tests -> src -> frontend -> repo root
const JUDGE_SERVICE = path.resolve(__dirname, "../../../../backend/app/Services/JudgeService.php");

describe("judge language registry", () => {
  it("lists the 19 languages in the picker's order, with the picker's labels", () => {
    expect(JUDGE_LANGUAGES.map((l) => l.label)).toEqual(PICKER_ORDER);
  });

  it("has unique ids", () => {
    const ids = JUDGE_LANGUAGES.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  // The registry and the judge are two lists in two stacks with no build-time link. This is the link: if a language is
  // added to (or dropped from) JudgeService::SUPPORTED_LANGUAGES without the editor learning about it, this fails.
  it.skipIf(!existsSync(JUDGE_SERVICE))("names exactly the languages the backend judge supports", () => {
    const source = readFileSync(JUDGE_SERVICE, "utf8");
    const list = /SUPPORTED_LANGUAGES\s*=\s*\[([\s\S]*?)\];/.exec(source)?.[1] ?? "";
    const backend: string[] = [];
    const quoted = /'([a-z0-9]+)'/g;
    for (let match = quoted.exec(list); match !== null; match = quoted.exec(list)) backend.push(match[1]);

    expect(backend.length).toBe(19);
    expect([...backend].sort()).toEqual(JUDGE_LANGUAGES.map((l) => l.id).sort());
  });

  it("keeps the ids saved drafts and past submissions were keyed by", () => {
    // `python` is Python 3 (LeetCode's "Python3") and `python2` is the legacy one (its "Python"); renaming either id
    // would orphan students' saved code.
    expect(languageLabel("python")).toBe("Python3");
    expect(languageLabel("python2")).toBe("Python");
    expect(judgeLanguage("cpp")?.label).toBe("C++");
    expect(judgeLanguage("csharp")?.label).toBe("C#");
  });

  it("maps every language to an editor mode and a highlighter grammar", () => {
    for (const language of JUDGE_LANGUAGES) {
      expect(language.monaco.length).toBeGreaterThan(0);
      expect(language.prism.length).toBeGreaterThan(0);
    }
    expect(monacoLanguageFor("python2")).toBe("python");
    expect(monacoLanguageFor("racket")).toBe("scheme"); // Monaco has no Racket mode; it is a Lisp
    expect(monacoLanguageFor("erlang")).toBe("plaintext"); // ...and no Erlang mode at all
    expect(prismLanguageFor("python2")).toBe("python");
    expect(prismLanguageFor("erlang")).toBe("erlang");
  });

  it("degrades gracefully for a language it doesn't know", () => {
    expect(languageLabel("cobol")).toBe("cobol");
    expect(monacoLanguageFor("cobol")).toBe("plaintext");
    expect(prismLanguageFor("cobol")).toBe("cobol");
    expect(judgeLanguage("cobol")).toBeUndefined();
  });
});

describe("orderedLanguageIds", () => {
  it("returns only what the problem offers, in the picker's order, whatever order the server sent", () => {
    expect(orderedLanguageIds(["php", "javascript", "rust", "cpp", "python"])).toEqual(["cpp", "python", "javascript", "rust", "php"]);
  });

  it("puts a language the registry doesn't know yet last, in the server's order, instead of hiding it", () => {
    expect(orderedLanguageIds(["zig", "cpp", "nim", "java"])).toEqual(["cpp", "java", "zig", "nim"]);
  });

  it("copes with nothing", () => {
    expect(orderedLanguageIds([])).toEqual([]);
  });
});
