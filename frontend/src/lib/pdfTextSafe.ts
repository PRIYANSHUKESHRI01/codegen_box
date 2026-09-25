/** jsPDF's built-in "helvetica" font only covers WinAnsi (roughly Latin-1) —
 * characters like ₹, Δ, ↑/↓/→ silently render as garbled glyphs instead of
 * throwing, so every string that reaches doc.text()/autoTable needs to be
 * routed through this rather than trusting the source data's Unicode as-is.
 * Shared by every jsPDF-based report generator in this app. */
export function pdfSafe(text: string): string {
  return text
    .replace(/₹/g, "Rs. ")
    .replace(/Δ/g, "Change")
    .replace(/↑/g, "Up")
    .replace(/↓/g, "Down")
    .replace(/→/g, "Flat");
}
