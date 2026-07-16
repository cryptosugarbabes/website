import { describe, expect, it } from "vitest";
import { csvCell, csvRow } from "../lib/csv";

describe("CSV member export", () => {
  it("quotes values and escapes embedded quotes", () => {
    expect(csvCell('Jo "Sugar"')).toBe('"Jo ""Sugar"""');
    expect(csvRow(["one@example.com", "Creator"])).toBe('"one@example.com","Creator"');
  });

  it("prevents spreadsheet formula execution", () => {
    expect(csvCell("=HYPERLINK(\"bad\")")).toBe('"\'=HYPERLINK(""bad"")"');
    expect(csvCell("+441234")).toBe('"\'+441234"');
  });

  it("removes line breaks from exported cells", () => {
    expect(csvCell("line one\nline two")).toBe('"line one line two"');
  });
});
