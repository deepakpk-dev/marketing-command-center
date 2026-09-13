"use client";
import { useEffect, useRef } from "react";
import { X, AlertTriangle, CheckCircle2 } from "lucide-react";
import { ChannelMark } from "./campaign-table";
import { dateLabel, money, multiplier, number, percent } from "@/lib/format";
import type { CampaignPerformance } from "@/lib/types";
export function CampaignDetails({
  campaign: c,
  onClose,
}: {
  campaign: CampaignPerformance;
  onClose: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    closeRef.current?.focus();
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("keydown", key);
      previous?.focus();
    };
  }, [onClose]);
  const pairs = [
    ["Ad spend", money(c.current.spend), money(c.previous.spend)],
    ["Attributed revenue", money(c.current.revenue), money(c.previous.revenue)],
    ["ROAS", multiplier(c.current.roas), multiplier(c.previous.roas)],
    ["CPA", money(c.current.cpa, 2), money(c.previous.cpa, 2)],
    ["CTR", percent(c.current.ctr), percent(c.previous.ctr)],
    ["Ad CVR", percent(c.current.cvr), percent(c.previous.cvr)],
    [
      "Ad conversions",
      number(c.current.conversions),
      number(c.previous.conversions),
    ],
    ["Modeled CAC", money(c.current.cac, 2), money(c.previous.cac, 2)],
  ];
  return (
    <aside className="details-drawer" aria-labelledby="campaign-detail-title">
      <header>
        <ChannelMark channel={c.channel} />
        <button
          ref={closeRef}
          className="icon-button"
          aria-label="Close campaign details"
          onClick={onClose}
        >
          <X size={20} />
        </button>
      </header>
      <div className="eyebrow">Campaign deep dive</div>
      <h2 id="campaign-detail-title">{c.name}</h2>
      <p className="muted">
        {dateLabel(c.start)} to {dateLabel(c.end, true)}
      </p>
      <div
        className={`campaign-health ${c.anomalies.length ? "warning" : "healthy"}`}
      >
        {c.anomalies.length ? (
          <AlertTriangle size={18} />
        ) : (
          <CheckCircle2 size={18} />
        )}
        <span>
          {c.anomalies.length
            ? `${c.anomalies.length} threshold alerts`
            : "No threshold alerts"}
        </span>
      </div>
      <table className="detail-metrics">
        <thead>
          <tr>
            <th>Metric</th>
            <th>Current</th>
            <th>Previous</th>
          </tr>
        </thead>
        <tbody>
          {pairs.map(([label, current, previous]) => (
            <tr key={label}>
              <th>{label}</th>
              <td>{current}</td>
              <td>{previous}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <h3>What changed</h3>
      {c.anomalies.length ? (
        c.anomalies.map((a) => (
          <p className="detail-alert" key={a.metric}>
            {a.explanation}
          </p>
        ))
      ) : (
        <p className="muted">
          No deterioration passed both the threshold and minimum-volume rules.
          Low-volume data can still need a manual review.
        </p>
      )}
      <h3>GA4 cross-check</h3>
      <dl className="ga4-metrics">
        <div>
          <dt>Purchase revenue</dt>
          <dd>{money(c.current.siteRevenue)}</dd>
        </div>
        <div>
          <dt>Purchases / sessions</dt>
          <dd>
            {number(c.current.purchases)} / {number(c.current.sessions)}
          </dd>
        </div>
        <div>
          <dt>Site conversion rate</dt>
          <dd>{percent(c.current.siteCvr)}</dd>
        </div>
      </dl>
      <p className="measurement-note">
        GA4 revenue is a separate measurement, never added to attributed ad
        revenue. CAC uses supplied first-time purchasers, not new site users.
      </p>
    </aside>
  );
}
