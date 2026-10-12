import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LanguagePicker } from "@/components/practice/LanguagePicker";
import { JUDGE_LANGUAGES } from "@/lib/judgeLanguages";

const ALL = JUDGE_LANGUAGES.map((l) => l.id);

afterEach(cleanup);

function setup(props: Partial<{ value: string; options: string[] }> = {}) {
  const onChange = vi.fn();
  render(<LanguagePicker value={props.value ?? "javascript"} options={props.options ?? ALL} onChange={onChange} />);
  return { onChange, trigger: screen.getByRole("button", { expanded: false }) };
}

const open = (trigger: HTMLElement) => {
  fireEvent.click(trigger);
  return screen.getByRole("listbox", { name: "Programming language" });
};

describe("LanguagePicker", () => {
  it("shows the current language on the button and nothing else until it is opened", () => {
    const { trigger } = setup({ value: "csharp" });

    expect(trigger.textContent).toBe("C#");
    expect(trigger.getAttribute("aria-haspopup")).toBe("listbox");
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("lists every language in LeetCode's order, in columns of 8 / 8 / 3", () => {
    const { trigger } = setup({ options: [...ALL].reverse() }); // the server's order must not matter
    const list = open(trigger);

    expect(within(list).getAllByRole("option").map((o) => o.textContent)).toEqual([
      "C++", "Java", "Python3", "Python", "JavaScript", "TypeScript", "C#", "C",
      "Go", "Kotlin", "Swift", "Rust", "Ruby", "PHP", "Dart", "Scala",
      "Elixir", "Erlang", "Racket",
    ]);
    expect(Array.from(list.children).map((column) => column.querySelectorAll('[role="option"]').length)).toEqual([8, 8, 3]);
  });

  it("marks only the selected language", () => {
    const { trigger } = setup({ value: "go" });
    const list = open(trigger);

    const selected = within(list).getAllByRole("option").filter((o) => o.getAttribute("aria-selected") === "true");
    expect(selected.map((o) => o.textContent)).toEqual(["Go"]);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
  });

  it("offers only the languages the problem has", () => {
    const { trigger } = setup({ options: ["python", "cpp", "rust"] });

    expect(within(open(trigger)).getAllByRole("option").map((o) => o.textContent)).toEqual(["C++", "Python3", "Rust"]);
  });

  it("shows a language it has never heard of rather than hiding it", () => {
    const { trigger } = setup({ options: ["cpp", "zig"] });

    expect(within(open(trigger)).getAllByRole("option").map((o) => o.textContent)).toEqual(["C++", "zig"]);
  });

  it("picks on click and closes", () => {
    const { onChange, trigger } = setup();
    const list = open(trigger);

    fireEvent.click(within(list).getByRole("option", { name: "Rust" }));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith("rust");
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it("closes on Escape without changing anything, and gives focus back to the button", () => {
    const { onChange, trigger } = setup();
    const list = open(trigger);

    fireEvent.keyDown(list, { key: "Escape" });

    expect(screen.queryByRole("listbox")).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(trigger);
  });

  it("closes when you press anywhere outside it", () => {
    const { onChange, trigger } = setup();
    open(trigger);

    fireEvent.mouseDown(document.body);

    expect(screen.queryByRole("listbox")).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
  });

  it("opens with ArrowDown on the button and starts the keyboard on the current language", () => {
    const { trigger } = setup({ value: "swift" });
    trigger.focus();

    fireEvent.keyDown(trigger, { key: "ArrowDown" });

    expect(screen.getByRole("listbox")).toBeTruthy();
    expect(document.activeElement?.textContent).toBe("Swift");
  });

  it("moves through the list with the arrow keys, Home and End, stopping at both ends", () => {
    const { trigger } = setup({ value: "cpp" });
    const list = open(trigger);
    const focused = () => document.activeElement?.textContent;

    expect(focused()).toBe("C++");
    fireEvent.keyDown(list, { key: "ArrowUp" });
    expect(focused()).toBe("C++"); // already first
    fireEvent.keyDown(list, { key: "ArrowDown" });
    fireEvent.keyDown(list, { key: "ArrowDown" });
    expect(focused()).toBe("Python3");
    fireEvent.keyDown(list, { key: "End" });
    expect(focused()).toBe("Racket");
    fireEvent.keyDown(list, { key: "ArrowDown" });
    expect(focused()).toBe("Racket"); // already last
    fireEvent.keyDown(list, { key: "Home" });
    expect(focused()).toBe("C++");
  });

  it("walks down one column and then continues at the top of the next, in reading order", () => {
    const { trigger } = setup({ value: "c" }); // the 8th and last item of the first column
    const list = open(trigger);

    expect(document.activeElement?.textContent).toBe("C");
    fireEvent.keyDown(list, { key: "ArrowDown" });
    expect(document.activeElement?.textContent).toBe("Go"); // top of the second column
  });

  it("closes on Tab so focus is never stuck in a hidden popover", () => {
    const { trigger } = setup();
    const list = open(trigger);

    fireEvent.keyDown(list, { key: "Tab" });

    expect(screen.queryByRole("listbox")).toBeNull();
  });
});
