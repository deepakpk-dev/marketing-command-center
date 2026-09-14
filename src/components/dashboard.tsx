"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Activity,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  ChartNoAxesCombined,
  CheckCheck,
  Download,
  Layers,
  LayoutDashboard,
  LogOut,
  Menu,
  Plug,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import { PerformanceChart } from "./performance-chart";
import { CampaignTable } from "./campaign-table";
import { AnalystBrief, AnalystView } from "./analyst";
import { Approvals } from "./approvals";
import { Connections } from "./connections";
import { CampaignDetails } from "./campaign-details";
import { WorkspaceAccess } from "./workspace-access";
import {
  money,
  multiplier,
  dateLabel,
  number,
  percent,
  timeLabel,
} from "@/lib/format";
import { relativeChange } from "@/lib/metrics";
import type {
  CampaignPerformance,
  ChannelFilter,
  DashboardData,
  Period,
  Recommendation,
} from "@/lib/types";
type View =
  | "overview"
  | "campaigns"
  | "analyst"
  | "approvals"
  | "connections"
  | "access";
const navigation = [
  { id: "overview" as const, label: "Overview", icon: LayoutDashboard },
  { id: "campaigns" as const, label: "Campaigns", icon: Layers },
  { id: "analyst" as const, label: "AI analyst", icon: Sparkles },
  { id: "approvals" as const, label: "Approvals", icon: CheckCheck },
  { id: "connections" as const, label: "Connections", icon: Plug },
  { id: "access" as const, label: "Workspace access", icon: ShieldCheck },
];
const headings: Record<View, string> = {
  overview: "Performance overview",
  campaigns: "Campaign performance",
  analyst: "Your AI analyst",
  approvals: "Review, then act",
  connections: "Your data, connected",
  access: "People and permissions",
};
const subtitles: Record<View, string> = {
  overview: "A clear view of spend, return, and what needs attention.",
  campaigns: "Find the campaigns that earn their next euro.",
  analyst: "Understand the change. Check the evidence. Choose the next test.",
  approvals: "Turn recommendations into deliberate, recorded decisions.",
  connections: "Repeatable ingestion and clear paths to live integrations.",
  access: "Individual identities. Clear responsibilities. Recorded decisions.",
};
export function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null),
    [view, setView] = useState<View>("overview"),
    [days, setDays] = useState<Period>(7),
    [channel, setChannel] = useState<ChannelFilter>("all"),
    [refresh, setRefresh] = useState(0);
  const [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [needsLogin, setNeedsLogin] = useState(false),
    [password, setPassword] = useState(""),
    [email, setEmail] = useState(""),
    [mobileNav, setMobileNav] = useState(false),
    [selected, setSelected] = useState<CampaignPerformance | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/dashboard?days=${days}&channel=${channel}`, {
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (response) => {
        const body = await response.json();
        if (controller.signal.aborted) return;
        if (response.status === 401 || response.status === 403) {
          setNeedsLogin(true);
          setData(null);
          if (response.status === 403) setError(body.error);
          return;
        }
        if (!response.ok)
          throw new Error(body.error || "Could not load this workspace.");
        setData(body);
        setError("");
        setNeedsLogin(false);
      })
      .catch((e) => {
        if (controller.signal.aborted || e.name === "AbortError") return;
        setData(null);
        setSelected(null);
        setError(e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [days, channel, refresh]);
  const navigate = (next: View) => {
    setView(next);
    setMobileNav(false);
    setSelected(null);
  };
  const closeDetails = useCallback(() => setSelected(null), []);
  const mutate = async (
    endpoint: string,
    method: string,
    body: unknown,
  ): Promise<boolean> => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await response.json();
      if (!response.ok) {
        if (response.status === 401) setNeedsLogin(true);
        throw new Error(result.error || "The request failed.");
      }
      setNotice(result.message || "Workspace updated.");
      setRefresh((value) => value + 1);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "The request failed.");
      return false;
    } finally {
      setBusy(false);
    }
  };
  const onAnalyze = () =>
    void mutate("/api/analyze", "POST", { days, channel });
  const exportReport = async () => {
    setBusy(true);
    try {
      const response = await fetch(
        `/api/export?days=${days}&channel=${channel}`,
      );
      if (!response.ok)
        throw new Error("Report export failed. Sign in and retry.");
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = `signal-${channel}-${data?.evidence.end}-${days}d.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Export failed.");
    } finally {
      setBusy(false);
    }
  };
  const onDecision = (
    rec: Recommendation,
    decision: "approved" | "rejected",
    note: string,
  ) =>
    mutate(`/api/recommendations/${rec.id}/decision`, "POST", {
      decision,
      note,
    });
  const pending =
    data?.recommendations.filter((r) => r.status === "pending" && !r.stale)
      .length ?? 0;
  const current = data?.evidence.totals.current,
    previous = data?.evidence.totals.previous;
  const metrics =
    current && previous
      ? [
          {
            label: "Ad spend",
            value: money(current.spend),
            change: relativeChange(current.spend, previous.spend),
            direction: "neutral",
            foot: "Across selected campaigns",
          },
          {
            label: "Attributed revenue",
            value: money(current.revenue),
            change: relativeChange(current.revenue, previous.revenue),
            direction: "up",
            foot: "Platform-reported, may overlap",
          },
          {
            label: "Return on ad spend",
            value: multiplier(current.roas),
            change: relativeChange(current.roas, previous.roas),
            direction: "up",
            foot: "Revenue ÷ ad spend",
          },
          {
            label: "Cost per conversion",
            value: money(current.cpa, 2),
            change: relativeChange(current.cpa, previous.cpa),
            direction: "down",
            foot: `${number(current.conversions)} ad conversions`,
          },
          {
            label: "Modeled CAC",
            value: money(current.cac, 2),
            change: relativeChange(current.cac, previous.cac),
            direction: "down",
            foot:
              current.cac === null
                ? "First-time purchaser coverage missing"
                : `${number(current.newCustomers)} first-time purchasers`,
          },
        ]
      : [];
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to performance
      </a>
      <aside className={`sidebar ${mobileNav ? "open" : ""}`}>
        <Link className="brand" href="/" aria-label="Signal home">
          <span className="brand-mark">
            <ChartNoAxesCombined size={22} />
          </span>
          <div>
            <strong>
              signal<span>.</span>
            </strong>
            <small>Performance marketing</small>
          </div>
        </Link>
        <button
          className="icon-button mobile-close"
          aria-label="Close navigation"
          onClick={() => setMobileNav(false)}
        >
          <X size={18} />
        </button>
        <div className="workspace-switch">
          <span className="workspace-avatar">AC</span>
          <div>
            <strong>Acme Commerce</strong>
            <small>Portfolio workspace</small>
          </div>
        </div>
        <div className="nav-label">WORKSPACE</div>
        <nav aria-label="Main navigation">
          {navigation
            .filter((item) => item.id !== "access" || data?.mode === "supabase")
            .map((item) => (
              <button
                key={item.id}
                className={`nav-item ${view === item.id ? "active" : ""}`}
                onClick={() => navigate(item.id)}
                aria-current={view === item.id ? "page" : undefined}
              >
                <item.icon size={18} />
                <span>{item.label}</span>
                {item.id === "approvals" && pending > 0 && (
                  <span className="nav-count" aria-hidden="true">
                    {pending}
                  </span>
                )}
              </button>
            ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="automation-status">
            <span className="live-dot" />
            <strong>Human review enabled</strong>
            <p>Insight → decision → audit trail</p>
          </div>
          <div className="workspace-mode">
            <ShieldCheck size={15} />
            <span>
              {data?.mode === "supabase"
                ? "Connected workspace"
                : "Sample workspace"}
            </span>
          </div>
          <div className="profile-row">
            <span className="profile-avatar">PM</span>
            <div>
              <strong>{data?.access?.user.email || "Performance team"}</strong>
              <small>
                {data?.mode === "supabase"
                  ? data.access?.role || "Workspace access"
                  : "Explore the demo"}
              </small>
            </div>
            {data?.mode === "supabase" && (
              <button
                className="icon-button"
                aria-label="Sign out"
                onClick={async () => {
                  const response = await fetch("/api/session", {
                    method: "DELETE",
                  });
                  if (response.ok) {
                    setNeedsLogin(true);
                    setData(null);
                    setSelected(null);
                    setView("overview");
                    setNotice("");
                  } else
                    setError("Sign-out could not be confirmed. Please retry.");
                }}
              >
                <LogOut size={16} />
              </button>
            )}
          </div>
        </div>
      </aside>
      {mobileNav && (
        <button
          className="nav-backdrop"
          aria-label="Dismiss navigation"
          onClick={() => setMobileNav(false)}
        />
      )}
      <div className="main-shell">
        <header className="topbar">
          <div className="topbar-start">
            <button
              className="icon-button mobile-menu"
              aria-label="Open navigation"
              onClick={() => setMobileNav(true)}
            >
              <Menu size={21} />
            </button>
            <span className="breadcrumb">
              Workspace <span>/</span>{" "}
              <strong>{navigation.find((n) => n.id === view)?.label}</strong>
            </span>
          </div>
          <div className="topbar-end">
            <span className="sync-state">
              <span className="live-dot" />
              {data
                ? `${data.mode === "demo" ? "Sample data" : "Data synced"} · ${data.ingestions[0] ? timeLabel(data.ingestions[0].createdAt) : "No sync yet"}`
                : "Loading workspace"}
            </span>
            <button
              className="button compact"
              disabled={
                busy ||
                !data ||
                (data.mode === "supabase" && !data.access?.permissions.ingest)
              }
              onClick={() =>
                void mutate("/api/ingest", "PUT", { source: "sample" })
              }
            >
              <RefreshCw size={14} className={busy ? "spin" : ""} />
              Sync sample data
            </button>
          </div>
        </header>
        <main id="main-content">
          <div className="page-heading">
            <div>
              <div className="eyebrow">
                {view === "overview" ? "THE BIG PICTURE" : "ACME COMMERCE"}
              </div>
              <h1>{headings[view]}</h1>
              <p>{subtitles[view]}</p>
            </div>
            {data && (
              <div className="heading-actions">
                <button
                  className="button"
                  disabled={busy}
                  onClick={() => void exportReport()}
                >
                  <Download size={15} />
                  Export report
                </button>
              </div>
            )}
          </div>
          {notice && (
            <div className="toast success" role="status">
              <CheckCheck size={16} />
              <span>{notice}</span>
              <button
                className="icon-button"
                aria-label="Dismiss notification"
                onClick={() => setNotice("")}
              >
                <X size={14} />
              </button>
            </div>
          )}
          {error && (
            <div className="toast error" role="alert">
              <span>{error}</span>
              <button
                className="text-button"
                onClick={() => {
                  setLoading(true);
                  setRefresh((v) => v + 1);
                }}
              >
                Retry
              </button>
            </div>
          )}
          {needsLogin ? (
            <section className="panel login-panel">
              <ShieldCheck size={30} />
              <h2>Open your workspace</h2>
              <p>
                Sign in with your invited email address and individual password.
                Workspace permissions control access to connected marketing
                data.
              </p>
              <form
                onSubmit={async (event) => {
                  event.preventDefault();
                  if (
                    await mutate("/api/session", "POST", { email, password })
                  ) {
                    setPassword("");
                    setNeedsLogin(false);
                  }
                }}
              >
                <label>
                  Email address
                  <input
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                  />
                </label>
                <label>
                  Your password
                  <input
                    type="password"
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                  />
                </label>
                <button className="button primary" disabled={busy}>
                  Sign in
                </button>
              </form>
                <p><a href="/auth/recover" className="text-button">Forgot your password?</a></p>
                <p className="measurement-note">
                  First time here? Open your invitation email to set your
                password. Access is invite-only.
              </p>
            </section>
          ) : (
            <>
              <div className="filterbar">
                <div className="filters">
                  <label className="select-field">
                    <CalendarDays size={15} />
                    <select
                      aria-label="Reporting period"
                      value={days}
                      onChange={(event) => {
                        setLoading(true);
                        setDays(Number(event.target.value) as Period);
                        setSelected(null);
                      }}
                    >
                      <option value={7}>Last 7 days</option>
                      <option value={14}>Last 14 days</option>
                      <option value={28}>Last 28 days</option>
                    </select>
                  </label>
                  <label className="select-field">
                    <Layers size={15} />
                    <select
                      aria-label="Channel"
                      value={channel}
                      onChange={(event) => {
                        setLoading(true);
                        setChannel(event.target.value as ChannelFilter);
                        setSelected(null);
                      }}
                    >
                      <option value="all">All channels</option>
                      <option value="google">Google Ads</option>
                      <option value="meta">Meta Ads</option>
                    </select>
                  </label>
                  <span className="currency-label">
                    EUR <span>·</span> UTC
                  </span>
                </div>
                {data && (
                  <span className="date-context">
                    {dateLabel(data.evidence.start)} to{" "}
                    {dateLabel(data.evidence.end, true)}{" "}
                    <span>vs. previous {data.evidence.days} days</span>
                  </span>
                )}
              </div>
              {loading && !data ? (
                <div
                  className="dashboard-skeleton"
                  aria-label="Loading performance"
                >
                  <div />
                  <div />
                  <div />
                </div>
              ) : data ? (
                <div
                  className={loading ? "content-loading" : ""}
                  aria-busy={loading}
                >
                  {(view === "overview" || view === "campaigns") && (
                    <section
                      className="kpi-strip"
                      aria-label="Key performance indicators"
                    >
                      {metrics.map((metric) => {
                        const good =
                          metric.change !== null &&
                          (metric.direction === "up"
                            ? metric.change >= 0
                            : metric.direction === "down"
                              ? metric.change <= 0
                              : null);
                        return (
                          <div className="kpi" key={metric.label}>
                            <span className="kpi-label">{metric.label}</span>
                            <strong>{metric.value}</strong>
                            <div
                              className={`kpi-change ${metric.direction === "neutral" ? "neutral-text" : good ? "positive-text" : "negative-text"}`}
                            >
                              {metric.change !== null ? (
                                <>
                                  {metric.change >= 0 ? (
                                    <ArrowUpRight size={13} />
                                  ) : (
                                    <ArrowDownRight size={13} />
                                  )}{" "}
                                  {percent(Math.abs(metric.change), 1)}{" "}
                                  <span>vs. previous</span>
                                </>
                              ) : (
                                <span>No comparable baseline</span>
                              )}
                            </div>
                            <small>{metric.foot}</small>
                          </div>
                        );
                      })}
                    </section>
                  )}
                  {view === "overview" && (
                    <>
                      <div className="overview-grid">
                        <PerformanceChart data={data} />
                        <AnalystBrief
                          data={data}
                          onReview={() => navigate("analyst")}
                        />
                      </div>
                      <CampaignTable
                        campaigns={data.evidence.campaigns}
                        onSelect={setSelected}
                      />
                      <section className="ga4-strip">
                        <span className="ga4-icon">
                          <Activity size={18} />
                        </span>
                        <div>
                          <strong>GA4 cross-check</strong>
                          <small>
                            Separate attribution, same review window
                          </small>
                        </div>
                        <dl>
                          <div>
                            <dt>Purchase revenue</dt>
                            <dd>{money(current!.siteRevenue)}</dd>
                          </div>
                          <div>
                            <dt>Purchases</dt>
                            <dd>{number(current!.purchases)}</dd>
                          </div>
                          <div>
                            <dt>Site CVR</dt>
                            <dd>{percent(current!.siteCvr)}</dd>
                          </div>
                        </dl>
                        <button
                          className="text-button accent-text"
                          onClick={() => navigate("connections")}
                        >
                          View sources <ArrowRight size={14} />
                        </button>
                      </section>
                    </>
                  )}
                  {view === "campaigns" && (
                    <>
                      <CampaignTable
                        full
                        campaigns={data.evidence.campaigns}
                        onSelect={setSelected}
                      />
                      <p className="measurement-note page-note">
                        ROAS and CPA use platform conversions and attributed
                        revenue. The campaign deep dive includes GA4 comparisons
                        and modeled CAC. Cross-channel reported revenue can
                        overlap.
                      </p>
                    </>
                  )}
                  {view === "analyst" && (
                    <AnalystView
                      data={data}
                      busy={busy}
                      onAnalyze={onAnalyze}
                      onApprovals={() => navigate("approvals")}
                    />
                  )}
                  {view === "approvals" && (
                    <Approvals
                      data={data}
                      busy={busy}
                      onDecision={onDecision}
                    />
                  )}
                  {view === "connections" && (
                    <Connections
                      data={data}
                      busy={busy}
                      onUpload={(input) => mutate("/api/ingest", "POST", input)}
                    />
                  )}
                  {view === "access" && (
                    <WorkspaceAccess
                      data={data}
                      onChanged={() => setRefresh((value) => value + 1)}
                    />
                  )}
                  <footer className="workspace-footer">
                    <span>
                      <ShieldCheck size={13} />
                      {data.mode === "demo"
                        ? "Modeled sample data. No live accounts connected."
                        : "Human approval required for action handoff."}
                    </span>
                    <span>Signal · Performance with context</span>
                  </footer>
                </div>
              ) : (
                !error && (
                  <div className="empty-state">
                    No workspace data is available.
                  </div>
                )
              )}
            </>
          )}
        </main>
      </div>
      {selected && (
        <CampaignDetails campaign={selected} onClose={closeDetails} />
      )}
    </div>
  );
}
