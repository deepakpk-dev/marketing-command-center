"use client";
import { useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, FileUp, ShieldCheck } from "lucide-react";
import {
  readReport,
  reportFields,
  validateReport,
  type ParsedReport,
  type ReportField,
  type ReportMapping,
  type SandboxDataset,
} from "@/lib/report-import";
import type { Channel } from "@/lib/types";

const labels: Record<ReportField, string> = {
  campaignId: "Campaign ID",
  name: "Campaign name",
  date: "Daily date",
  spend: "Spend",
  impressions: "Impressions",
  clicks: "Clicks",
  conversions: "Conversions / purchases",
  revenue: "Conversion / purchase value",
  currency: "Currency",
  endDate: "Reporting end date",
  status: "Campaign status",
};
const required: ReportField[] = [
  "campaignId",
  "name",
  "date",
  "spend",
  "impressions",
  "clicks",
];
export function ReportUploader({
  onImport,
  onCancel,
}: {
  onImport: (dataset: SandboxDataset) => void;
  onCancel: () => void;
}) {
  const [parsed, setParsed] = useState<ParsedReport | null>(null),
    [mapping, setMapping] = useState<ReportMapping>({}),
    [source, setSource] = useState<Channel | "">(""),
    [currency, setCurrency] = useState(""),
    [error, setError] = useState(""),
    [name, setName] = useState(""),
    [reading, setReading] = useState(false);
  const input = useRef<HTMLInputElement>(null),
    generation = useRef(0);
  const result = useMemo(
    () =>
      parsed && source
        ? validateReport(parsed, mapping, source, currency)
        : null,
    [parsed, mapping, source, currency],
  );
  const dataset = result?.dataset;
  const missing = required.filter((field) => !mapping[field]);
  async function choose(file?: File) {
    if (!file) return;
    const current = ++generation.current;
    setError("");
    setReading(true);
    setParsed(null);
    try {
      if (!/\.csv$/i.test(file.name))
        throw new Error("Choose a .csv report, not a spreadsheet or PDF.");
      if (file.size > 2 * 1024 * 1024)
        throw new Error("Choose a CSV smaller than 2 MB.");
      const value = readReport(await file.text());
      if (current !== generation.current) return;
      setParsed(value);
      setMapping(value.mapping);
      setSource(value.source ?? "");
      setCurrency(value.currency);
      setName(file.name);
    } catch (e) {
      if (current === generation.current)
        setError(
          e instanceof Error
            ? e.message
            : "Could not read this report. Export it again as CSV.",
        );
    } finally {
      if (current === generation.current) setReading(false);
      if (input.current) input.current.value = "";
    }
  }
  function fieldSelect(field: ReportField) {
    return (
      <label key={field}>
        {labels[field]}
        {required.includes(field) ? " *" : " (optional)"}
        <select
          value={mapping[field] ?? ""}
          onChange={(e) =>
            setMapping({ ...mapping, [field]: e.target.value || undefined })
          }
        >
          <option value="">
            {required.includes(field) ? "Choose a column" : "Not supplied"}
          </option>
          {parsed?.headers.map((h) => (
            <option key={h} value={h}>
              {h}
            </option>
          ))}
        </select>
      </label>
    );
  }
  return (
    <main className="sandbox-onboarding" id="public-main">
      <button className="text-button" onClick={onCancel}>
        <ArrowLeft size={16} /> Back
      </button>
      <ol className="import-progress" aria-label="Import progress">
        <li aria-current={!parsed ? "step" : undefined}>1 Choose report</li>
        <li aria-current={parsed ? "step" : undefined}>2 Check data</li>
        <li>3 View insights</li>
      </ol>
      <h1>{parsed ? "Check your report" : "Bring your campaign report"}</h1>
      <p className="onboarding-subtitle">
        No login, credentials or live connection. Your file stays in this
        browser tab.
      </p>
      {!parsed ? (
        <>
          <div
            className="report-drop"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              void choose(e.dataTransfer.files[0]);
            }}
          >
            <FileUp size={32} />
            <h2>Drop a Google Ads or Meta CSV</h2>
            <p>Campaign-level daily data · Up to 2 MB and 10,000 rows</p>
            <button
              className="button primary"
              disabled={reading}
              onClick={() => input.current?.click()}
            >
              {reading ? "Reading report…" : "Choose CSV report"}
            </button>
          </div>
          <details className="context-help">
            <summary>Where do I get this file?</summary>
            <p>
              In Google Ads, download a campaign report as CSV with a Day
              breakdown. In Meta Ads Manager, export campaign data as CSV with a
              daily breakdown. Include campaign ID, name, spend, impressions and
              clicks. Include conversions and conversion value if available.
            </p>
            <p>
              Dates should use YYYY-MM-DD. Export one currency and one row per
              campaign per day. More history gives stronger comparisons; 56 days
              supports two complete 28-day windows.
            </p>
          </details>
          <div className="example-reports">
            <span>No report handy? Try an example:</span>
            <a href="/example-google-ads.csv" download>
              Google Ads CSV ↓
            </a>
            <a href="/example-meta-ads.csv" download>
              Meta CSV ↓
            </a>
          </div>
        </>
      ) : (
        <section className="report-preview">
          <div className="report-file">
            <strong>{name}</strong>
            <button
              className="text-button"
              onClick={() => {
                generation.current++;
                setParsed(null);
                setError("");
              }}
            >
              Choose a different file
            </button>
          </div>
          <div className="report-options">
            <label>
              Report source
              <select
                value={source}
                onChange={(e) => setSource(e.target.value as Channel)}
              >
                <option value="">Choose the platform</option>
                <option value="google">Google Ads</option>
                <option value="meta">Meta Ads</option>
              </select>
            </label>
            {!parsed.currency && !mapping.currency && (
              <label>
                Report currency
                <input
                  placeholder="e.g. USD"
                  maxLength={3}
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                />
                <small>
                  Use the currency from your advertising account. We do not
                  convert amounts.
                </small>
              </label>
            )}
          </div>
          {missing.length > 0 && (
            <div className="mapping-fields">
              <p>We need a little help matching these columns.</p>
              {missing.map(fieldSelect)}
            </div>
          )}
          <details className="context-help">
            <summary>Check or change column matches</summary>
            <div className="mapping-fields">
              {reportFields
                .filter((field) => !missing.includes(field))
                .map(fieldSelect)}
            </div>
          </details>
          {dataset && (
            <>
              <dl className="report-summary">
                <div>
                  <dt>Campaigns</dt>
                  <dd>{new Set(dataset.rows.map((r) => r.campaignId)).size}</dd>
                </div>
                <div>
                  <dt>Daily rows</dt>
                  <dd>{dataset.rows.length}</dd>
                </div>
                <div>
                  <dt>Currency</dt>
                  <dd>{dataset.currency}</dd>
                </div>
                <div>
                  <dt>Dates</dt>
                  <dd>
                    {[...dataset.rows.map((r) => r.date)].sort()[0]} to{" "}
                    {[...dataset.rows.map((r) => r.date)].sort().at(-1)}
                  </dd>
                </div>
              </dl>
              <div className="table-scroll">
                <table className="preview-table">
                  <caption>First three rows</caption>
                  <thead>
                    <tr>
                      <th>Campaign</th>
                      <th>Date</th>
                      <th>Spend ({dataset.currency})</th>
                      <th>Clicks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dataset.rows.slice(0, 3).map((r) => (
                      <tr key={`${r.campaignId}:${r.date}`}>
                        <td>{r.name}</td>
                        <td>{r.date}</td>
                        <td>{r.spend.toLocaleString()}</td>
                        <td>{r.clicks}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {dataset.rows.some((r) => r.revenue === null) && (
                <p className="inline-guidance">
                  Revenue is not supplied for every row. Revenue and ROAS will
                  show as unavailable where incomplete.
                </p>
              )}
              {dataset.rows.some((r) => r.conversions === null) && (
                <p className="inline-guidance">
                  Conversions are not supplied for every row. CPA and conversion
                  rate will show as unavailable where incomplete.
                </p>
              )}
            </>
          )}
          {!source && (
            <p className="inline-guidance">
              Choose the platform this report came from to continue.
            </p>
          )}
          {result && missing.length === 0 && result.errors.length > 0 && (
            <div role="alert" className="import-errors">
              <strong>
                {result.errors.length}{" "}
                {result.errors.length === 1 ? "issue" : "issues"} to fix before
                continuing
              </strong>
              <ul>
                {result.errors.slice(0, 8).map((e, i) => (
                  <li key={i}>
                    {e.row ? `Row ${e.row}: ` : ""}
                    {e.message}
                  </li>
                ))}
              </ul>
              {result.errors.length > 8 && (
                <p>
                  Showing the first 8 issues. Correct the export and upload it
                  again.
                </p>
              )}
            </div>
          )}
          <button
            className="button primary"
            disabled={!dataset}
            onClick={() => {
              if (dataset) onImport(dataset);
            }}
          >
            View my insights <ArrowRight size={16} />
          </button>
        </section>
      )}
      <input
        ref={input}
        type="file"
        className="sr-only"
        aria-label="Choose CSV report"
        accept=".csv,text/csv"
        onChange={(e) => void choose(e.target.files?.[0])}
      />
      {error && (
        <p className="import-errors" role="alert">
          {error}
        </p>
      )}
      <p className="sandbox-privacy">
        <ShieldCheck size={16} /> Reports are processed locally. Refreshing or
        closing this tab clears the sandbox.
      </p>
    </main>
  );
}
