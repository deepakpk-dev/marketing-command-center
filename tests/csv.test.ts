import { expect, it } from "vitest";
import { csvCell } from "../src/lib/csv";
it("escapes spreadsheet formulas and embedded quotes", () => {
  expect(csvCell('=HYPERLINK("https://evil.test")')).toBe(
    '"\'=HYPERLINK(""https://evil.test"")"',
  );
  expect(csvCell("Brand, UK")).toBe('"Brand, UK"');
  expect(csvCell(null)).toBe('""');
});
