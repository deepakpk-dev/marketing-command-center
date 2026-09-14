"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  CheckCheck,
  Download,
  FileUp,
  Layers,
  LayoutDashboard,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import {
  measureDataset,
  type SandboxDecision,
  type SandboxRecommendation,
} from "@/lib/sandbox";
import type { SandboxDataset } from "@/lib/report-import";
import type { ChannelFilter, Period } from "@/lib/types";
import { csvCell } from "@/lib/csv";

type View = "overview" | "campaigns" | "insights" | "decisions" | "data";
const navigation = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "campaigns", label: "Campaigns", icon: Layers },
  { id: "insights", label: "Insights", icon: Sparkles },
  { id: "decisions", label: "Decisions", icon: CheckCheck },
  { id: "data", label: "Data", icon: FileUp },
] as const;
const titles: Record<View, string> = {
  overview: "Performance overview",
  campaigns: "Campaign performance",
  insights: "Your insights",
  decisions: "Review, then decide",
  data: "Your sandbox data",
};
export function SandboxWorkspace({
  dataset,
  onClear,
  onUpload,
  onSample,
}: {
  dataset: SandboxDataset;
  onClear: () => void;
  onUpload: () => void;
  onSample: () => void;
}) {
  const [view, setView] = useState<View>("overview"),
    [days, setDays] = useState<Period>(7),
    [channel, setChannel] = useState<ChannelFilter>("all"),
    [query, setQuery] = useState(""),
    [sort, setSort] = useState<"spend" | "roas" | "cpa">("spend"),
    [selected, setSelected] = useState<string | null>(null),
    [hint, setHint] = useState(true),
    [decisions, setDecisions] = useState<SandboxDecision[]>([]),
    [reviewing, setReviewing] = useState<string | null>(null),
    [note, setNote] = useState(""),
    [confirm, setConfirm] = useState<"clear" | "upload" | "sample" | null>(
      null,
    );
  const report = useMemo(
    () => measureDataset(dataset, days, channel),
    [dataset, days, channel],
  );
  const titleRef = useRef<HTMLHeadingElement>(null),
    evidenceRef = useRef<HTMLHeadingElement>(null),
    confirmRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    titleRef.current?.focus();
  }, [view]);
  useEffect(() => {
    if (selected) evidenceRef.current?.focus();
  }, [selected]);
  useEffect(() => {
    if (confirm) confirmRef.current?.focus();
  }, [confirm]);
  const money = (n: number | null) =>
    n === null
      ? "Unavailable"
      : new Intl.NumberFormat("en-GB", {
          style: "currency",
          currency: dataset.currency,
          maximumFractionDigits: 0,
        }).format(n);
  const decimal = (n: number | null, suffix = "") =>
    n === null ? "Unavailable" : `${n.toFixed(2)}${suffix}`;
  const number = (n: number | null) =>
    n === null
      ? "Unavailable"
      : new Intl.NumberFormat("en-GB", { maximumFractionDigits: 1 }).format(n);
  const campaign = report.campaigns.find((c) => c.campaignId === selected);
  const recommendations = report.recommendations.filter(
    (r) => !decisions.some((d) => d.id === r.id),
  );
  const insightRecommendations = [...report.recommendations].sort(
    (a, b) =>
      Number(b.campaignId === selected) - Number(a.campaignId === selected),
  );
  const rows = report.campaigns
    .filter((c) => c.name.toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => (b.totals[sort] ?? -1) - (a.totals[sort] ?? -1));
  function navigate(next: View) {
    setView(next);
    setSelected(null);
    setReviewing(null);
    setNote("");
  }
  function review(rec: SandboxRecommendation) {
    setView("decisions");
    setSelected(null);
    setReviewing(rec.id);
    setNote("");
  }
  function decide(
    rec: SandboxRecommendation,
    decision: "approved" | "rejected",
  ) {
    if (note.trim().length < 3) return;
    setDecisions((old) => [
      ...old,
      {
        id: rec.id,
        title: rec.title,
        decision,
        note: note.trim(),
        evidence: [...rec.evidence],
        createdAt: new Date().toISOString(),
      },
    ]);
    setReviewing(null);
    setNote("");
  }
  function exportReport() {
    const cells = [
      [
        "Campaign",
        "Platform",
        "Currency",
        "Period start",
        "Period end",
        "Spend",
        "Revenue",
        "Conversions",
        "ROAS",
        "CPA",
        "Complete comparison",
      ],
      ...report.campaigns.map((c) => [
        c.name,
        c.channel,
        dataset.currency,
        report.start,
        report.end,
        c.totals.spend,
        c.totals.revenue,
        c.totals.conversions,
        c.totals.roas,
        c.totals.cpa,
        c.complete,
      ]),
    ];
    const url = URL.createObjectURL(
      new Blob([cells.map((r) => r.map(csvCell).join(",")).join("\r\n")], {
        type: "text/csv;charset=utf-8",
      }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `signal-${dataset.kind}-${report.end}.csv`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const trend = useMemo(() => {
    const grouped = new Map<
      string,
      { spend: number; revenue: number | null }
    >();
    for (const r of dataset.rows) {
      if (
        r.date < report.start ||
        r.date > report.end ||
        (channel !== "all" && r.channel !== channel)
      )
        continue;
      const value = grouped.get(r.date) ?? { spend: 0, revenue: 0 };
      value.spend += r.spend;
      value.revenue =
        value.revenue === null || r.revenue === null
          ? null
          : value.revenue + r.revenue;
      grouped.set(r.date, value);
    }
    return [...grouped].sort(([a], [b]) => a.localeCompare(b));
  }, [dataset, report.start, report.end, channel]);
  const max = Math.max(
    1,
    ...trend.flatMap(([, v]) => [v.spend, v.revenue ?? 0]),
  );
  return (
    <div className="sandbox-layout">
      <aside className="sandbox-sidebar">
        <div className="sandbox-identity">
          <span className="workspace-avatar">
            {dataset.kind === "sample" ? "AC" : "MY"}
          </span>
          <div>
            <strong>
              {dataset.kind === "sample"
                ? "Acme Commerce"
                : "My campaign report"}
            </strong>
            <small>
              {dataset.kind === "sample"
                ? "Sample data · Sandbox"
                : "Uploaded data · Sandbox"}
            </small>
          </div>
        </div>
        <nav aria-label="Sandbox navigation">
          {navigation.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              aria-current={view === id ? "page" : undefined}
              onClick={() => navigate(id)}
            >
              <Icon size={18} />
              {label}
            </button>
          ))}
        </nav>
        <p className="sandbox-side-note">
          <ShieldCheck size={17} /> You’re in a sandbox. Decisions never change
          your ad accounts.
        </p>
        <button className="text-button" onClick={() => setConfirm("upload")}>
          Upload another report
        </button>
        <button className="text-button" onClick={() => setConfirm("clear")}>
          Clear my data
        </button>
      </aside>
      <main className="sandbox-main" id="sandbox-main">
        {confirm && (
          <section
            className="sandbox-confirm"
            aria-label="Confirm sandbox change"
          >
            <h2 ref={confirmRef} tabIndex={-1}>
              {confirm === "clear"
                ? "Clear this sandbox?"
                : "Start with a different dataset?"}
            </h2>
            <p>
              {confirm === "upload"
                ? "You can check a new file before replacing this dataset. Your current data stays available if you go back."
                : "This removes the current dataset and simulated decisions from this tab."}
            </p>
            <div className="button-row">
              <button
                className="button primary"
                onClick={() => {
                  const action = confirm;
                  setConfirm(null);
                  if (action === "clear") onClear();
                  else if (action === "upload") onUpload();
                  else onSample();
                }}
              >
                {confirm === "clear"
                  ? "Clear sandbox"
                  : confirm === "upload"
                    ? "Choose new report"
                    : "Load sample data"}
              </button>
              <button className="button" onClick={() => setConfirm(null)}>
                Keep current data
              </button>
            </div>
          </section>
        )}
        <div className="sandbox-toolbar">
          <p>
            {dataset.currency} · {report.start} to {report.end}
          </p>
          <button className="button compact" onClick={exportReport}>
            <Download size={15} /> Export report
          </button>
        </div>
        <div className="sandbox-title">
          <div>
            <p className="eyebrow">
              {dataset.kind === "sample"
                ? "EXPLORE WITH CONFIDENCE"
                : "YOUR REPORT, MADE CLEAR"}
            </p>
            <h1 ref={titleRef} tabIndex={-1}>
              {titles[view]}
            </h1>
          </div>
          <div className="sandbox-filters">
            <label>
              Reporting period
              <select
                value={days}
                onChange={(e) => {
                  setDays(Number(e.target.value) as Period);
                  setReviewing(null);
                  setNote("");
                }}
              >
                <option value={7}>Last 7 days</option>
                <option value={14}>Last 14 days</option>
                <option value={28}>Last 28 days</option>
              </select>
            </label>
            <label>
              Channel
              <select
                value={channel}
                onChange={(e) => {
                  setChannel(e.target.value as ChannelFilter);
                  setReviewing(null);
                  setNote("");
                }}
              >
                <option value="all">All channels</option>
                <option value="google">Google Ads</option>
                <option value="meta">Meta Ads</option>
              </select>
            </label>
          </div>
        </div>
        {!report.complete && view !== "data" && (
          <p className="inline-guidance">
            {report.campaigns.length
              ? `Some campaigns lack two complete ${days}-day windows. Totals show the supplied rows; incomplete campaign comparisons are not flagged as declines. Try a shorter period or upload more daily history.`
              : "No campaigns for this channel. Choose All channels to review your report."}
          </p>
        )}
        {(view === "overview" || view === "campaigns") && (
          <>
            <dl className="sandbox-metrics">
              <div>
                <dt>Ad spend</dt>
                <dd>{money(report.totals.spend)}</dd>
                <small>Selected reporting window</small>
              </div>
              <div>
                <dt>Attributed revenue</dt>
                <dd>{money(report.totals.revenue)}</dd>
                <small>Platform-reported value</small>
              </div>
              <div>
                <dt>Return on ad spend</dt>
                <dd>{decimal(report.totals.roas, "x")}</dd>
                <small>Revenue ÷ spend</small>
              </div>
              <div>
                <dt>Cost per conversion</dt>
                <dd>{money(report.totals.cpa)}</dd>
                <small>{number(report.totals.conversions)} conversions</small>
              </div>
            </dl>
            {dataset.kind === "sample" &&
              view === "overview" &&
              hint &&
              recommendations.length > 0 && (
                <div className="first-review">
                  <div>
                    <strong>A campaign needs attention.</strong>
                    <p>
                      Start with the evidence, then try recording a decision.
                    </p>
                  </div>
                  <button
                    className="button primary"
                    onClick={() => {
                      setSelected(recommendations[0].campaignId);
                      setView("campaigns");
                      setHint(false);
                    }}
                  >
                    Review the evidence <ArrowRight size={15} />
                  </button>
                  <button
                    className="icon-button"
                    aria-label="Dismiss getting-started hint"
                    onClick={() => setHint(false)}
                  >
                    <X size={17} />
                  </button>
                </div>
              )}
            {view === "overview" && (
              <div className="sandbox-overview-split">
                <section className="panel sandbox-trend">
                  <h2>Daily performance</h2>
                  <p>Spend and attributed revenue ({dataset.currency})</p>
                  <svg
                    viewBox="0 0 600 160"
                    role="img"
                    aria-label="Daily spend and revenue trend, exact values are available below"
                  >
                    <line
                      x1="0"
                      y1="145"
                      x2="600"
                      y2="145"
                      stroke="var(--border)"
                    />
                    {trend.map(([date, v], i) => {
                      const width = 570 / Math.max(trend.length, 1);
                      return (
                        <g key={date}>
                          <rect
                            x={15 + i * width}
                            y={145 - (v.spend / max) * 130}
                            width={width * 0.34}
                            height={(v.spend / max) * 130}
                            fill="var(--spend)"
                          />
                          <rect
                            x={15 + i * width + width * 0.38}
                            y={145 - ((v.revenue ?? 0) / max) * 130}
                            width={width * 0.34}
                            height={((v.revenue ?? 0) / max) * 130}
                            fill="var(--accent)"
                          />
                        </g>
                      );
                    })}
                  </svg>
                  <p className="chart-key">
                    ● Revenue <span>● Spend</span>
                  </p>
                  <details>
                    <summary>View daily values</summary>
                    <div className="table-scroll">
                      <table>
                        <thead>
                          <tr>
                            <th>Date</th>
                            <th>Spend</th>
                            <th>Revenue</th>
                          </tr>
                        </thead>
                        <tbody>
                          {trend.map(([date, v]) => (
                            <tr key={date}>
                              <td>{date}</td>
                              <td>{money(v.spend)}</td>
                              <td>{money(v.revenue)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </details>
                </section>
                <section className="panel sandbox-brief">
                  <Sparkles size={22} />
                  <p className="eyebrow">RULE-BASED INSIGHTS</p>
                  <h2>
                    {recommendations.length
                      ? `${recommendations.length} ${recommendations.length === 1 ? "action needs" : "actions need"} a closer look.`
                      : "Keep the next test measured."}
                  </h2>
                  <p>
                    {recommendations.length
                      ? "Review the observations, consider alternative explanations and record your decision."
                      : "No unreviewed actions crossed the complete-data thresholds in this window. That is not proof that every campaign is healthy."}
                  </p>
                  <button
                    className="button"
                    onClick={() => navigate("insights")}
                  >
                    Review insights <ArrowRight size={15} />
                  </button>
                </section>
              </div>
            )}
            <section className="panel sandbox-campaigns">
              <div className="panel-heading">
                <h2>
                  Campaigns <span className="count-label">{rows.length}</span>
                </h2>
                <label className="sandbox-search">
                  Search campaigns
                  <input
                    aria-label="Search campaigns"
                    placeholder="Find a campaign"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </label>
              </div>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Campaign</th>
                      <th>
                        <button
                          onClick={() => setSort("spend")}
                          aria-label="Sort by spend"
                        >
                          Spend {sort === "spend" ? "↓" : ""}
                        </button>
                      </th>
                      <th>Revenue</th>
                      <th>
                        <button
                          onClick={() => setSort("roas")}
                          aria-label="Sort by ROAS"
                        >
                          ROAS {sort === "roas" ? "↓" : ""}
                        </button>
                      </th>
                      <th>
                        <button
                          onClick={() => setSort("cpa")}
                          aria-label="Sort by CPA"
                        >
                          CPA {sort === "cpa" ? "↓" : ""}
                        </button>
                      </th>
                      <th>Review</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((c) => (
                      <tr key={c.campaignId}>
                        <td>
                          <button
                            className="campaign-name"
                            onClick={() => setSelected(c.campaignId)}
                          >
                            {c.name}
                          </button>
                          <small>
                            {c.channel === "google" ? "Google Ads" : "Meta Ads"}{" "}
                            · {c.status}
                          </small>
                        </td>
                        <td>{money(c.totals.spend)}</td>
                        <td>{money(c.totals.revenue)}</td>
                        <td>{decimal(c.totals.roas, "x")}</td>
                        <td>{money(c.totals.cpa)}</td>
                        <td>
                          <button
                            className="text-button"
                            aria-label={`Inspect ${c.name}`}
                            onClick={() => setSelected(c.campaignId)}
                          >
                            {c.anomalies.length
                              ? "Needs review"
                              : c.complete
                                ? "View evidence"
                                : "Limited history"}{" "}
                            →
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!rows.length && (
                <p className="inline-guidance">
                  No matching campaigns. Clear your search or change the
                  channel.
                </p>
              )}
            </section>
            {campaign && (
              <section
                className="panel campaign-evidence"
                aria-labelledby="evidence-title"
              >
                <div className="panel-heading">
                  <h2 id="evidence-title" ref={evidenceRef} tabIndex={-1}>
                    Campaign evidence
                  </h2>
                  <button
                    className="icon-button"
                    aria-label="Close campaign evidence"
                    onClick={() => setSelected(null)}
                  >
                    <X size={17} />
                  </button>
                </div>
                <h3>{campaign.name}</h3>
                <p>
                  {campaign.rowCount} daily rows in the selected window.{" "}
                  {campaign.complete
                    ? "Complete adjacent reporting windows."
                    : "Incomplete history: period changes are not reliable."}
                </p>
                <dl className="evidence-values">
                  <div>
                    <dt>Click-through rate</dt>
                    <dd>
                      {campaign.totals.ctr === null
                        ? "Unavailable"
                        : decimal(campaign.totals.ctr * 100, "%")}
                    </dd>
                  </div>
                  <div>
                    <dt>Conversion rate</dt>
                    <dd>
                      {campaign.totals.cvr === null
                        ? "Unavailable"
                        : decimal(campaign.totals.cvr * 100, "%")}
                    </dd>
                  </div>
                </dl>
                {campaign.anomalies.map((a) => (
                  <p key={a.metric}>
                    {a.explanation}: {Math.abs(a.change * 100).toFixed(1)}%
                    change.
                  </p>
                ))}
                {report.recommendations.some(
                  (r) => r.campaignId === campaign.campaignId,
                ) ? (
                  <button
                    className="button primary"
                    onClick={() => setView("insights")}
                  >
                    View recommendation <ArrowRight size={15} />
                  </button>
                ) : (
                  <p className="inline-guidance">
                    No threshold recommendation for this campaign. Review
                    measurement quality before drawing conclusions.
                  </p>
                )}
              </section>
            )}
          </>
        )}
        {view === "insights" && (
          <section className="sandbox-insights">
            <p className="inline-guidance">
              Computed in your browser using fixed thresholds and complete daily
              comparisons. No data is sent to an AI provider.
            </p>
            {report.recommendations.length ? (
              insightRecommendations.map((rec) => (
                <article className="panel sandbox-action" key={rec.id}>
                  <p className="eyebrow">EVIDENCE BEFORE ACTION</p>
                  <h2>{rec.title}</h2>
                  <p>{rec.rationale}</p>
                  <ul>
                    {rec.evidence.map((fact) => (
                      <li key={fact}>{fact}</li>
                    ))}
                  </ul>
                  {decisions.some((d) => d.id === rec.id) ? (
                    <p className="decision-status">
                      Simulation recorded. View Decisions for the history.
                    </p>
                  ) : (
                    <button
                      className="button primary"
                      onClick={() => review(rec)}
                    >
                      Review decision <ArrowRight size={15} />
                    </button>
                  )}
                </article>
              ))
            ) : (
              <div className="panel sandbox-action">
                <h2>No threshold alerts in this window</h2>
                <p>
                  Low volume, incomplete reporting or stable metrics can all
                  produce this result. Inspect campaigns or upload additional
                  daily history.
                </p>
                <button
                  className="button"
                  onClick={() => navigate("campaigns")}
                >
                  Inspect campaigns
                </button>
              </div>
            )}
          </section>
        )}
        {view === "decisions" && (
          <div className="sandbox-decisions">
            <p className="inline-guidance">
              Practice your review workflow. Approvals and rejections only
              record a simulation in this tab.
            </p>
            <section className="panel sandbox-action">
              <h2>
                Pending decisions{" "}
                <span className="count-label">{recommendations.length}</span>
              </h2>
              {recommendations.length ? (
                recommendations.map((rec) => (
                  <article className="sandbox-pending" key={rec.id}>
                    <h3>{rec.title}</h3>
                    {reviewing === rec.id ? (
                      <>
                        <ul>
                          {rec.evidence.map((fact) => (
                            <li key={fact}>{fact}</li>
                          ))}
                        </ul>
                        <label>
                          Decision note
                          <textarea
                            aria-label="Decision note"
                            maxLength={1000}
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            placeholder="What did you check, and why this decision?"
                          />
                        </label>
                        <small>
                          Add at least 3 characters so the decision has a
                          reason.
                        </small>
                        <div className="button-row">
                          <button
                            className="button primary"
                            disabled={note.trim().length < 3}
                            onClick={() => decide(rec, "approved")}
                          >
                            Approve simulation
                          </button>
                          <button
                            className="button"
                            disabled={note.trim().length < 3}
                            onClick={() => decide(rec, "rejected")}
                          >
                            Reject simulation
                          </button>
                          <button
                            className="text-button"
                            onClick={() => {
                              setReviewing(null);
                              setNote("");
                            }}
                          >
                            Cancel review
                          </button>
                        </div>
                      </>
                    ) : (
                      <button className="button" onClick={() => review(rec)}>
                        Review decision
                      </button>
                    )}
                  </article>
                ))
              ) : (
                <p>
                  No pending recommendations for this reporting window. Try
                  another period or review your campaign evidence.
                </p>
              )}
            </section>
            <section className="panel sandbox-action" aria-live="polite">
              <h2>Simulated decision history</h2>
              {decisions.length ? (
                [...decisions].reverse().map((d) => (
                  <article className="sandbox-pending" key={d.id}>
                    <p className="decision-status">
                      {d.decision === "approved" ? "Approved" : "Rejected"} ·
                      Simulation · {new Date(d.createdAt).toLocaleTimeString()}
                    </p>
                    <h3>{d.title}</h3>
                    <p>{d.note}</p>
                    <details>
                      <summary>Evidence at decision time</summary>
                      <ul>
                        {d.evidence.map((fact) => (
                          <li key={fact}>{fact}</li>
                        ))}
                      </ul>
                    </details>
                  </article>
                ))
              ) : (
                <p>
                  Your first decision will appear here with its note and
                  evidence.
                </p>
              )}
            </section>
          </div>
        )}
        {view === "data" && (
          <section className="panel sandbox-action">
            <h2>
              {dataset.kind === "sample"
                ? "A realistic sample workspace"
                : "Your imported campaign report"}
            </h2>
            <p>
              {dataset.rows.length} daily rows ·{" "}
              {new Set(dataset.rows.map((r) => r.campaignId)).size} campaigns ·{" "}
              {dataset.currency}
            </p>
            <p>
              Reports, insights and decision history stay in browser memory.
              Refreshing or closing the tab clears them. No live accounts are
              connected.
            </p>
            {dataset.kind === "sample" && (
              <p>
                All sample campaign data is modeled for evaluation, not actual
                business performance.
              </p>
            )}
            {dataset.rows.some((r) => r.revenue === null) && (
              <>
                <h3>Revenue is missing</h3>
                <p>
                  ROAS and revenue show as unavailable for incomplete
                  selections. Include conversion or purchase value in your
                  export to review these metrics.
                </p>
              </>
            )}
            {dataset.rows.some((r) => r.conversions === null) && (
              <>
                <h3>Conversions are missing</h3>
                <p>
                  Include the conversion or purchase column to review CPA and
                  conversion rate.
                </p>
              </>
            )}
            <h3>Measurement limits</h3>
            <p>
              Platform attribution windows differ and revenue can overlap across
              channels. CAC and site metrics require customer and analytics
              data; this sandbox does not invent those values. Fixed thresholds
              are not significance tests or proof of causation.
            </p>
            <div className="button-row">
              <button
                className="button primary"
                onClick={() => setConfirm("upload")}
              >
                Upload another report
              </button>
              {dataset.kind === "upload" && (
                <button className="button" onClick={() => setConfirm("sample")}>
                  Explore sample data
                </button>
              )}
              <button className="button" onClick={() => setConfirm("clear")}>
                Clear my data
              </button>
            </div>
          </section>
        )}
        {dataset.rows.some((r) => r.revenue === null) && view !== "data" && (
          <p className="inline-guidance">
            <strong>Revenue is missing</strong>. Revenue and ROAS are
            unavailable for incomplete selections. Include conversion value in
            your export to use these metrics.
          </p>
        )}
        <footer className="sandbox-footer">
          {dataset.kind === "sample"
            ? "Modeled sample data"
            : "Your uploaded report"}{" "}
          · Browser-local sandbox · Changes are simulations
        </footer>
      </main>
    </div>
  );
}
