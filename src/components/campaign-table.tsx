"use client";
import { useMemo, useState } from "react";
import { ArrowDown, ArrowUpRight, Search, ChevronRight } from "lucide-react";
import { money, multiplier, number, percent } from "@/lib/format";
import type { CampaignPerformance } from "@/lib/types";
export function ChannelMark({ channel }: { channel: "google" | "meta" }) {
  return (
    <span
      className={`channel-mark ${channel}`}
      aria-label={channel === "google" ? "Google Ads" : "Meta Ads"}
    >
      {channel === "google" ? (
        <span className="google-g">G</span>
      ) : (
        <span className="meta-mark">∞</span>
      )}
    </span>
  );
}
export function CampaignTable({
  campaigns,
  onSelect,
  full = false,
}: {
  campaigns: CampaignPerformance[];
  onSelect: (c: CampaignPerformance) => void;
  full?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"spend" | "roas" | "cpa">("spend");
  const rows = useMemo(
    () =>
      campaigns
        .filter((c) => c.name.toLowerCase().includes(query.toLowerCase()))
        .sort((a, b) => (b.current[sort] ?? -1) - (a.current[sort] ?? -1)),
    [campaigns, query, sort],
  );
  return (
    <section
      className="panel campaign-panel"
      aria-labelledby="campaign-table-title"
    >
      <div className="panel-heading">
        <div>
          <h2 id="campaign-table-title">
            {full ? "All campaigns" : "Campaign performance"}
            <span className="count-label">{campaigns.length}</span>
          </h2>
          <p>Compare efficiency, then inspect the evidence.</p>
        </div>
        <label className="search-field">
          <Search size={15} />
          <input
            aria-label="Search campaigns"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search campaigns"
          />
        </label>
      </div>
      <div className="table-scroll">
        <table className="campaign-table">
          <thead>
            <tr>
              <th>Campaign</th>
              <th>Status</th>
              <th>
                <button onClick={() => setSort("spend")}>
                  Spend {sort === "spend" && <ArrowDown size={12} />}
                </button>
              </th>
              <th>Revenue</th>
              <th>
                <button onClick={() => setSort("roas")}>
                  ROAS {sort === "roas" && <ArrowDown size={12} />}
                </button>
              </th>
              <th>
                <button onClick={() => setSort("cpa")}>
                  CPA {sort === "cpa" && <ArrowDown size={12} />}
                </button>
              </th>
              <th>CTR</th>
              <th>CVR</th>
              <th aria-label="View details" />
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id}>
                <td>
                  <div className="campaign-cell">
                    <ChannelMark channel={c.channel} />
                    <div>
                      <button
                        className="campaign-name"
                        aria-label={`View ${c.name} performance`}
                        onClick={() => onSelect(c)}
                      >
                        {c.name}
                      </button>
                      <small>
                        {c.channel === "google" ? "Google Ads" : "Meta Ads"}
                      </small>
                    </div>
                  </div>
                </td>
                <td>
                  <span
                    className={`status-badge ${c.anomalies.length ? "warning" : c.status === "active" ? "healthy" : "neutral"}`}
                  >
                    <i />
                    {c.anomalies.length
                      ? "Needs review"
                      : c.status === "active"
                        ? "On track"
                        : "Paused"}
                  </span>
                </td>
                <td>{money(c.current.spend)}</td>
                <td>{money(c.current.revenue)}</td>
                <td>
                  <span
                    className={
                      c.anomalies.some((a) => a.metric === "roas")
                        ? "negative-text"
                        : "roas-value"
                    }
                  >
                    {multiplier(c.current.roas)}
                  </span>
                </td>
                <td>{money(c.current.cpa, 2)}</td>
                <td>{percent(c.current.ctr)}</td>
                <td>{percent(c.current.cvr)}</td>
                <td>
                  <button
                    className="icon-button"
                    aria-label={`Inspect ${c.name}`}
                    onClick={() => onSelect(c)}
                  >
                    <ChevronRight size={16} />
                  </button>
                </td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={9}>
                  <div className="empty-state">
                    No campaigns match this selection. Try another channel or
                    search.
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="table-footer">
        <span>{number(rows.length)} campaigns · Platform attribution</span>
        <span>
          Rates are weighted by volume <ArrowUpRight size={12} />
        </span>
      </div>
    </section>
  );
}
