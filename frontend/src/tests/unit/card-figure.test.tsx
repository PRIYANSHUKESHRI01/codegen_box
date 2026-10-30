import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { CardFigure } from "@/components/dashboard/interviews/room/CardFigure";

afterEach(cleanup);

describe("the picture of a Rule of the Road card", () => {
  it("shows the card with its real proportions, described without saying what the vessel is", () => {
    render(<CardFigure src="/ror-cards/card-029.png" />);

    const img = screen.getByTestId("card-figure").querySelector("img");
    expect(img?.getAttribute("src")).toBe("/ror-cards/card-029.png");
    expect(img?.getAttribute("width")).toBe("360");
    expect(img?.getAttribute("height")).toBe("180");
    expect(img?.getAttribute("alt")).toMatch(/plan view/i);
    expect(img?.getAttribute("alt")).not.toMatch(/trawl|fishing|aground|pilot|tug|anchor|sailing|mine|cushion/i);
  });

  it("can be enlarged, and closed with the button, the backdrop or Escape", () => {
    render(<CardFigure src="/ror-cards/card-029.png" />);
    expect(screen.queryByTestId("card-figure-enlarged")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Enlarge the card" }));
    const dialog = screen.getByRole("dialog", { name: "The card, enlarged" });
    expect(dialog.querySelector("img")?.getAttribute("src")).toBe("/ror-cards/card-029.png");
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Close the enlarged card" }));

    fireEvent.click(screen.getByRole("button", { name: "Close the enlarged card" }));
    expect(screen.queryByTestId("card-figure-enlarged")).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Enlarge the card" }));

    fireEvent.click(screen.getByRole("button", { name: "Enlarge the card" }));
    fireEvent.click(screen.getByTestId("card-figure-enlarged")); // the backdrop
    expect(screen.queryByTestId("card-figure-enlarged")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Enlarge the card" }));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByTestId("card-figure-enlarged")).toBeNull();
  });

  it("does not close when the picture itself is clicked", () => {
    render(<CardFigure src="/ror-cards/card-029.png" />);
    fireEvent.click(screen.getByRole("button", { name: "Enlarge the card" }));

    fireEvent.click(screen.getByRole("dialog").querySelector("img") as HTMLImageElement);
    expect(screen.getByTestId("card-figure-enlarged")).toBeTruthy();
  });
});
