"use client";
import { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ChartNoAxesCombined,
  FileUp,
  ShieldCheck,
} from "lucide-react";
import { sampleDataset } from "@/lib/sandbox";
import type { SandboxDataset } from "@/lib/report-import";
import { ReportUploader } from "./report-uploader";
import { SandboxWorkspace } from "./sandbox-workspace";

export function PublicSandbox() {
  const [dataset, setDataset] = useState<SandboxDataset | null>(null),
    [uploading, setUploading] = useState(false),
    [revision, setRevision] = useState(0);
  return (
    <div className="public-sandbox">
      <a
        className="skip-link"
        href={dataset && !uploading ? "#sandbox-main" : "#public-main"}
      >
        Skip to content
      </a>
      <header className="public-header">
        <Link className="public-brand" href="/" aria-label="Signal home">
          <span>
            <ChartNoAxesCombined size={23} />
          </span>
          signal<span className="brand-dot">.</span>
        </Link>
        <Link className="private-link" href="/workspace">
          Sign in to your workspace <ArrowRight size={14} />
        </Link>
      </header>
      {dataset && (
        <div hidden={uploading}>
          <SandboxWorkspace
            key={revision}
            dataset={dataset}
            onClear={() => setDataset(null)}
            onUpload={() => setUploading(true)}
            onSample={() => {
              setDataset(sampleDataset());
              setRevision((n) => n + 1);
            }}
          />
        </div>
      )}
      {uploading && (
        <ReportUploader
          onImport={(value) => {
            setDataset(value);
            setRevision((n) => n + 1);
            setUploading(false);
          }}
          onCancel={() => setUploading(false)}
        />
      )}
      {!dataset && !uploading && (
        <main className="sandbox-welcome" id="public-main">
          <p className="eyebrow">MARKETING PERFORMANCE, MADE CLEAR</p>
          <h1>See what your marketing data is telling you.</h1>
          <p className="welcome-description">
            Find what needs attention, check the evidence and choose your next
            move.
          </p>
          <div className="welcome-paths">
            <section className="welcome-path">
              <ChartNoAxesCombined size={25} />
              <h2>Explore sample data</h2>
              <p>Try a realistic campaign review. No account needed.</p>
              <button
                className="button primary"
                onClick={() => setDataset(sampleDataset())}
              >
                Explore sample data <ArrowRight size={17} />
              </button>
              <small>
                Ready-to-explore campaigns, insights and simulated decisions.
              </small>
            </section>
            <section className="welcome-path">
              <FileUp size={25} />
              <h2>Upload my report</h2>
              <p>
                Review your Google Ads or Meta campaign export. No connection
                needed.
              </p>
              <button
                className="button primary"
                onClick={() => setUploading(true)}
              >
                Upload my report <ArrowRight size={17} />
              </button>
              <small>
                Your CSV stays in this browser. No advertising credentials.
              </small>
            </section>
          </div>
          <p className="sandbox-privacy">
            <ShieldCheck size={17} /> A private, temporary sandbox. Nothing
            changes in your advertising accounts.
          </p>
        </main>
      )}
    </div>
  );
}
