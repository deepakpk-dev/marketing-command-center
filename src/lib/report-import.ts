import type { Channel } from "./types";

export interface SandboxRow {
  campaignId: string;
  name: string;
  channel: Channel;
  status: "active" | "paused";
  date: string;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number | null;
  revenue: number | null;
}
export interface SandboxDataset {
  kind: "sample" | "upload";
  source: Channel | "both";
  currency: string;
  rows: SandboxRow[];
}
export const reportFields = [
  "campaignId",
  "name",
  "date",
  "spend",
  "impressions",
  "clicks",
  "conversions",
  "revenue",
  "currency",
  "endDate",
  "status",
] as const;
export type ReportField = (typeof reportFields)[number];
export type ReportMapping = Partial<Record<ReportField, string>>;
export interface ParsedReport {
  headers: string[];
  rows: string[][];
  rowNumbers: number[];
  mapping: ReportMapping;
  source: Channel | null;
  currency: string;
  decimalComma: boolean;
}
export interface ImportResult {
  dataset: SandboxDataset | null;
  errors: { row?: number; message: string }[];
}
const aliases: Record<ReportField, string[]> = {
  campaignId: ["campaignid"],
  name: ["campaign", "campaignname"],
  date: ["day", "date", "reportingstarts", "datestart", "startdate"],
  endDate: ["reportingends", "dateend", "enddate"],
  spend: ["cost", "spend", "amountspent"],
  impressions: ["impressions"],
  clicks: ["clicks", "clicksall"],
  conversions: ["conversions", "purchases", "websitepurchases"],
  revenue: [
    "convvalue",
    "conversionvalue",
    "conversionsvalue",
    "purchaseconversionvalue",
    "websitepurchaseconversionvalue",
    "purchasesconversionvalue",
  ],
  currency: ["currency", "currencycode", "accountcurrency"],
  status: ["campaignstatus", "status"],
};
const normalize = (value: string) =>
  value
    .toLowerCase()
    .replace(/\([a-z]{3}\)/gi, "")
    .replace(/[^a-z0-9]/g, "");
export function readReport(text: string): ParsedReport {
  if (new TextEncoder().encode(text).length > 2 * 1024 * 1024)
    throw new Error("Choose a CSV smaller than 2 MB.");
  text = text.replace(/^\ufeff/, "");
  if (!text.trim()) throw new Error("Choose a CSV containing campaign rows.");
  const firstLine =
    text.split(/\r?\n/).find((line) => /campaign/i.test(line)) ??
    text.split(/\r?\n/)[0];
  const delimiter = [",", ";", "\t"].sort(
    (a, b) => firstLine.split(b).length - firstLine.split(a).length,
  )[0];
  const matrix: string[][] = [],
    numbers: number[] = [];
  let row: string[] = [],
    field = "",
    quoted = false,
    closed = false,
    line = 1,
    rowLine = 1;
  const finish = () => {
    row.push(field.trim());
    if (row.some((cell) => cell !== "")) {
      matrix.push(row);
      numbers.push(rowLine);
    }
    row = [];
    field = "";
    closed = false;
  };
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') {
        quoted = false;
        closed = true;
      } else {
        field += c;
        if (c === "\n") line++;
      }
    } else if (c === '"') {
      if (field.trim() || closed)
        throw new Error(`Check the CSV quotes near row ${line}.`);
      quoted = true;
    } else if (c === delimiter) {
      row.push(field.trim());
      field = "";
      closed = false;
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      finish();
      line++;
      rowLine = line;
    } else {
      if (closed && c.trim())
        throw new Error(`Check the CSV quotes near row ${line}.`);
      field += c;
    }
  }
  if (quoted)
    throw new Error("A CSV quote is not closed. Export the file again.");
  if (row.length || field) finish();
  // Google exports may include a report title and date-range preamble.
  const found = matrix.findIndex(
    (cells) =>
      cells.filter((cell) =>
        Object.values(aliases).some((list) => list.includes(normalize(cell))),
      ).length >= 3,
  );
  const headerIndex = found >= 0 ? found : 0;
  const headers = matrix[headerIndex] ?? [];
  if (
    headers.length < 2 ||
    new Set(headers).size !== headers.length ||
    headers.some((h) => !h)
  )
    throw new Error("The CSV needs unique, named columns. Export it again.");
  const rows = matrix.slice(headerIndex + 1),
    rowNumbers = numbers.slice(headerIndex + 1);
  if (!rows.length)
    throw new Error("This CSV has headings but no campaign rows.");
  if (rows.length > 10000)
    throw new Error("Choose a report with at most 10,000 daily campaign rows.");
  const mapping: ReportMapping = {};
  for (const key of reportFields) {
    const matches = headers.filter((h) => aliases[key].includes(normalize(h)));
    if (matches.length === 1) mapping[key] = matches[0];
  }
  const meta = headers.some((h) =>
    /amount spent|reporting starts|clicks \(all\)/i.test(h),
  );
  const google = headers.some((h) =>
    /^(cost|day|conv\. value|campaign status)$/i.test(h),
  );
  const currency =
    mapping.spend?.match(/\(([A-Z]{3})\)/i)?.[1].toUpperCase() ?? "";
  return {
    headers,
    rows,
    rowNumbers,
    mapping,
    source: meta ? "meta" : google ? "google" : null,
    currency,
    decimalComma: delimiter === ";",
  };
}
function calendarDate(value: string): string | null {
  const normalized = value.replace(/\//g, "-");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return null;
  const date = new Date(`${normalized}T00:00:00Z`);
  return Number.isFinite(date.valueOf()) &&
    date.toISOString().slice(0, 10) === normalized
    ? normalized
    : null;
}
export function validateReport(
  parsed: ParsedReport,
  mapping: ReportMapping,
  source: Channel,
  fallbackCurrency: string,
): ImportResult {
  const errors: ImportResult["errors"] = [],
    rows: SandboxRow[] = [],
    currencies = new Set<string>(),
    seen = new Set<string>();
  const matched = Object.values(mapping).filter(Boolean);
  if (new Set(matched).size !== matched.length)
    errors.push({
      message:
        "Each column can match only one field. Check your column matches.",
    });
  for (const key of [
    "campaignId",
    "name",
    "date",
    "spend",
    "impressions",
    "clicks",
  ] as const) {
    if (!mapping[key] || !parsed.headers.includes(mapping[key]!))
      errors.push({
        message: `Choose the ${key === "campaignId" ? "campaign ID" : key} column.`,
      });
  }
  if (errors.length) return { dataset: null, errors };
  const indexes = Object.fromEntries(
    reportFields.map((key) => [
      key,
      parsed.headers.indexOf(mapping[key] ?? ""),
    ]),
  );
  for (let i = 0; i < parsed.rows.length; i++) {
    const cells = parsed.rows[i],
      row = parsed.rowNumbers[i];
    const get = (key: ReportField) =>
      indexes[key] < 0 ? "" : (cells[indexes[key]] ?? "");
    const error = (message: string) => errors.push({ row, message });
    if (cells.length !== parsed.headers.length) {
      error(
        "The number of columns does not match the headings. Export this row again.",
      );
      continue;
    }
    const campaignId = get("campaignId"),
      name = get("name"),
      date = calendarDate(get("date"));
    if (!campaignId || campaignId.length > 120 || !name || name.length > 200)
      error("Provide a campaign ID and name. Remove report total rows.");
    if (!date) error("Use a daily date in YYYY-MM-DD format.");
    if (get("endDate") && calendarDate(get("endDate")) !== date)
      error("This is a multi-day summary. Export a daily breakdown instead.");
    const currency = (get("currency") || parsed.currency || fallbackCurrency)
      .trim()
      .toUpperCase();
    try {
      if (!/^[A-Z]{3}$/.test(currency)) throw Error();
      new Intl.NumberFormat("en", { style: "currency", currency }).format(1);
      currencies.add(currency);
    } catch {
      error("Choose the report's three-letter currency code.");
    }
    if (parsed.currency && currency !== parsed.currency)
      error(
        "The spend heading and row currency disagree. Export one currency per report.",
      );
    const numeric = (
      key: "spend" | "impressions" | "clicks" | "conversions" | "revenue",
      optional = false,
    ) => {
      const raw = get(key);
      if (optional && (!mapping[key] || !raw || /^(--|—|n\/a)$/i.test(raw)))
        return null;
      if (
        !parsed.decimalComma &&
        raw.includes(",") &&
        !/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(raw)
      ) {
        error(
          `Check ${key}: use a decimal point, or export a semicolon CSV for decimal commas.`,
        );
        return null;
      }
      const clean = parsed.decimalComma
        ? raw.replace(/\s/g, "").replace(",", ".")
        : raw.replace(/,/g, "").replace(/\s/g, "");
      const value = Number(clean);
      if (
        !raw ||
        !/^\d+(\.\d+)?$/.test(clean) ||
        !Number.isFinite(value) ||
        value < 0 ||
        value > 1e12 ||
        ((key === "clicks" || key === "impressions") &&
          !Number.isInteger(value))
      ) {
        error(
          `Check ${key}: use a non-negative ${key === "clicks" || key === "impressions" ? "whole number" : "number"}.`,
        );
        return null;
      }
      return value;
    };
    const spend = numeric("spend"),
      impressions = numeric("impressions"),
      clicks = numeric("clicks"),
      conversions = numeric("conversions", true),
      revenue = numeric("revenue", true);
    const key = `${source}:${campaignId}:${date}`;
    if (seen.has(key))
      error(
        "Duplicate campaign/date row. Export campaign-level daily data without extra breakdowns.",
      );
    seen.add(key);
    const status = get("status").toLowerCase();
    if (date && spend !== null && impressions !== null && clicks !== null)
      rows.push({
        campaignId: `${source}:${campaignId}`,
        name,
        date,
        channel: source,
        status: status.includes("paused") ? "paused" : "active",
        spend,
        impressions,
        clicks,
        conversions,
        revenue,
      });
  }
  if (currencies.size > 1)
    errors.push({
      message:
        "This report contains multiple currencies. Upload one currency at a time.",
    });
  if (!rows.length && !errors.length)
    errors.push({ message: "The report has no daily campaign rows." });
  return {
    dataset: errors.length
      ? null
      : { kind: "upload", source, currency: [...currencies][0], rows },
    errors,
  };
}
