"use client";
import {
  ArrowRight,
  RefreshCw,
  Sparkles,
  ShieldCheck,
  AlertTriangle,
} from "lucide-react";
import { dateLabel } from "@/lib/format";
import type { DashboardData } from "@/lib/types";
export function AnalystBrief({
  data,
  onReview,
}: {
  data: DashboardData;
  onReview: () => void;
}) {
  const count = data.evidence.campaigns.filter(
    (c) => c.anomalies.length,
  ).length;
  return (
    <aside className="panel analyst-brief">
      <div className="brief-heading">
        <span className="analyst-icon">
          <Sparkles size={17} />
        </span>
        <h2>Your analyst brief</h2>
        <span className="sample-tag">
          {data.aiProvider === "demo" ? "Demo" : "AI"}
        </span>
      </div>
      <h3>
        {count
          ? `${count} campaigns are pulling efficiency down.`
          : "A steady window. Keep the next test measured."}
      </h3>
      <p>
        {data.analysis?.output.summary ??
          "Run an analysis for this filter to turn observed changes into a reviewable action plan."}
      </p>
      <div className="brief-divider" />
      <div className="brief-stat">
        <span className="stat-icon">
          <AlertTriangle size={15} />
        </span>
        <div>
          <strong>{count} campaigns need attention</strong>
          <small>Volume and change thresholds applied</small>
        </div>
      </div>
      <div className="brief-stat">
        <span className="stat-icon">
          <ShieldCheck size={15} />
        </span>
        <div>
          <strong>
            {
              data.recommendations.filter(
                (r) => r.status === "pending" && !r.stale,
              ).length
            }{" "}
            actions awaiting review
          </strong>
          <small>Every decision leaves an audit record</small>
        </div>
      </div>
      <button className="button primary brief-button" onClick={onReview}>
        Review insights <ArrowRight size={16} />
      </button>
      <div className="brief-footnote">
        <Sparkles size={12} />
        {data.aiProvider === "demo"
          ? "Evidence-based sample analysis"
          : "AI explanations grounded in supplied metrics"}
      </div>
    </aside>
  );
}
export function AnalystView({
  data,
  busy,
  onAnalyze,
  onApprovals,
}: {
  data: DashboardData;
  busy: boolean;
  onAnalyze: () => void;
  onApprovals: () => void;
}) {
  const analysis = data.analysis;
  return (
    <div className="analyst-view">
      <section className="panel analyst-report">
        <div className="panel-heading">
          <div className="report-label">
            <Sparkles size={19} />
            <div>
              <h2>Performance analysis</h2>
              <p>
                {dateLabel(data.evidence.start)} to{" "}
                {dateLabel(data.evidence.end, true)} ·{" "}
                {data.aiProvider === "demo"
                  ? "Deterministic sample analyst"
                  : "OpenAI analyst"}
              </p>
            </div>
          </div>
          <button
            className="button primary"
            disabled={busy}
            onClick={onAnalyze}
          >
            <RefreshCw size={15} className={busy ? "spin" : ""} />
            Run analysis
          </button>
        </div>
        {analysis ? (
          <>
            <div className="analysis-summary">
              <span className="eyebrow">The readout</span>
              <h3>{analysis.output.summary}</h3>
            </div>
            <div className="findings">
              {analysis.output.findings.map((f, i) => (
                <article key={f.title}>
                  <span className="finding-number">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div>
                    <h3>{f.title}</h3>
                    <p>{f.explanation}</p>
                    <details>
                      <summary>View metric evidence</summary>
                      <ul className="evidence-list">
                        {f.evidence.map((e) => (
                          <li key={e}>{e}</li>
                        ))}
                      </ul>
                    </details>
                  </div>
                </article>
              ))}
            </div>
          </>
        ) : (
          <div className="empty-state">
            <Sparkles size={28} />
            <h3>Build a brief for this selection</h3>
            <p>
              Run the analyst to compare this period and prepare actions for
              review.
            </p>
          </div>
        )}
        <div className="report-footer">
          <span>
            <ShieldCheck size={16} />
            Explanations are hypotheses. Your review controls the action.
          </span>
          <button className="text-button accent-text" onClick={onApprovals}>
            Open approval queue <ArrowRight size={15} />
          </button>
        </div>
      </section>
      <section className="measurement-section">
        <h2>How to read this analysis</h2>
        <div className="measurement-copy">
          {data.evidence.caveats.map((c) => (
            <p key={c}>{c}</p>
          ))}
        </div>
      </section>
    </div>
  );
}
