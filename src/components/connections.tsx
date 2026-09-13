"use client";
import { useRef, useState } from "react";
import {
  Check,
  Database,
  Download,
  FileJson,
  GitBranch,
  Plug,
  Upload,
  Copy,
} from "lucide-react";
import { ChannelMark } from "./campaign-table";
import { dateLabel, number, timeLabel } from "@/lib/format";
import type { DashboardData } from "@/lib/types";
export function Connections({
  data,
  busy,
  onUpload,
}: {
  data: DashboardData;
  busy: boolean;
  onUpload: (input: unknown) => Promise<boolean>;
}) {
  const fileRef = useRef<HTMLInputElement>(null),
    [fileError, setFileError] = useState(""),
    [copied, setCopied] = useState(false);
  const importFile = async (file?: File) => {
    if (!file) return;
    setFileError("");
    if (file.size > 2 * 1024 * 1024) {
      setFileError("Choose a JSON file smaller than 2 MB.");
      return;
    }
    try {
      const value = JSON.parse(await file.text());
      await onUpload(value);
    } catch {
      setFileError(
        "This file is not valid JSON. Download the example to check the format.",
      );
    }
    if (fileRef.current) fileRef.current.value = "";
  };
  return (
    <div className="connections-view">
      <section className="panel source-panel">
        <div className="panel-heading">
          <div>
            <h2>Data sources</h2>
            <p>
              Sample adapters are ready. Live credentials connect through
              server-side integrations.
            </p>
          </div>
          <Plug size={20} className="muted" />
        </div>
        {[
          {
            id: "google" as const,
            name: "Google Ads",
            description:
              "Campaigns, cost micros, impressions, clicks, conversions, conversion value",
            endpoint: "googleAds[]",
          },
          {
            id: "meta" as const,
            name: "Meta Ads",
            description:
              "Campaign insights, spend, clicks, purchase actions and purchase values",
            endpoint: "metaAds[]",
          },
          {
            id: "ga4" as const,
            name: "Google Analytics 4",
            description:
              "Campaign-mapped sessions, purchases, purchase revenue and first-time purchasers",
            endpoint: "ga4[]",
          },
        ].map((source) => (
          <div className="source-row" key={source.id}>
            <div className="source-name">
              {source.id === "ga4" ? (
                <span className="channel-mark ga4">A</span>
              ) : (
                <ChannelMark channel={source.id} />
              )}
              <div>
                <h3>{source.name}</h3>
                <p>{source.description}</p>
              </div>
            </div>
            <code>{source.endpoint}</code>
            <span className="status-badge healthy">
              <i />
              Sample adapter
            </span>
          </div>
        ))}
        <div className="source-row">
          <div className="source-name">
            <span className="channel-mark db">
              <Database size={17} />
            </span>
            <div>
              <h3>
                {data.mode === "demo"
                  ? "Session workspace"
                  : "Supabase / Postgres"}
              </h3>
              <p>
                {data.mode === "demo"
                  ? "Isolated sample data. Resets when the server restarts or the session expires."
                  : "Durable workspace storage with server-only access and database transactions."}
              </p>
            </div>
          </div>
          <span className="status-badge neutral">
            {data.mode === "demo" ? "Temporary" : "Connected"}
          </span>
        </div>
      </section>
      <div className="integration-grid">
        <section className="panel import-panel">
          <FileJson size={24} className="accent-text" />
          <h2>Bring a source export</h2>
          <p>
            Upload a validated JSON batch. Existing campaign/date facts are
            replaced atomically, so workflows can replay safely.
          </p>
          <div className="upload-area">
            <Upload size={22} />
            <strong>Google Ads + Meta Ads + GA4</strong>
            <span>JSON format · up to 2 MB · max 10,000 facts</span>
            <button
              className="button"
              disabled={busy}
              onClick={() => fileRef.current?.click()}
            >
              Choose JSON file
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".json,application/json"
              className="sr-only"
              aria-label="Import source JSON"
              onChange={(event) => void importFile(event.target.files?.[0])}
            />
          </div>
          {fileError && (
            <p role="alert" className="negative-text">
              {fileError}
            </p>
          )}
          <a
            className="text-button accent-text"
            href="/sample-data.json"
            download
          >
            <Download size={15} />
            Download example batch
          </a>
        </section>
        <section className="panel workflow-panel">
          <GitBranch size={24} className="accent-text" />
          <h2>Make it a workflow</h2>
          <p>
            An n8n workflow can deliver a batch, run the analyst, and hand the
            recommendations back for human review.
          </p>
          <ol className="workflow-steps">
            <li>
              <span>1</span>
              <div>
                <strong>Collect source exports</strong>
                <small>Map campaign IDs and normalize UTC date buckets.</small>
              </div>
            </li>
            <li>
              <span>2</span>
              <div>
                <strong>Ingest + analyze</strong>
                <small>
                  POST /api/workflows/run with a scoped bearer token.
                </small>
              </div>
            </li>
            <li>
              <span>3</span>
              <div>
                <strong>Review in Signal</strong>
                <small>Approve or reject with a recorded reviewer note.</small>
              </div>
            </li>
          </ol>
          <div className="endpoint-box">
            <code>POST /api/workflows/run</code>
            <button
              className="icon-button"
              aria-label="Copy workflow endpoint"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(
                    `${window.location.origin}/api/workflows/run`,
                  );
                  setCopied(true);
                } catch {
                  setCopied(false);
                }
              }}
            >
              {copied ? <Check size={15} /> : <Copy size={15} />}
            </button>
          </div>
          <p className="measurement-note">
            Bearer access covers ingestion and analysis. Approval uses the
            signed workspace session. Importable definitions are included in the
            repository’s workflows folder.
          </p>
        </section>
      </div>
      <section className="panel sync-history">
        <div className="panel-heading">
          <div>
            <h2>Sync history</h2>
            <p>
              {number(data.rowCount)} advertising and analytics facts in the
              workspace
            </p>
          </div>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Time</th>
                <th>Source</th>
                <th>Facts upserted</th>
                <th>Batch checksum</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {data.ingestions.map((run) => (
                <tr key={run.id}>
                  <td>
                    {dateLabel(run.createdAt)} · {timeLabel(run.createdAt)}
                  </td>
                  <td>{run.source}</td>
                  <td>{number(run.rowCount)}</td>
                  <td>
                    <code>{run.checksum.slice(0, 12)}</code>
                  </td>
                  <td>
                    <span className="status-badge healthy">
                      <Check size={12} />
                      Complete
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
