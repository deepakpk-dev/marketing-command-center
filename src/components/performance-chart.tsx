"use client";
import { useState } from "react";
import { ArrowUpRight } from "lucide-react";
import { dateLabel, money, multiplier } from "@/lib/format";
import type { DashboardData } from "@/lib/types";
export function PerformanceChart({ data }: { data: DashboardData }) {
  const [metric, setMetric] = useState<"value" | "roas">("value");
  const [selected, setSelected] = useState<number | null>(null);
  const rows = data.timeline,
    width = 780,
    height = 255,
    left = 54,
    right = 18,
    top = 20,
    bottom = 38;
  const innerW = width - left - right,
    innerH = height - top - bottom;
  const values = rows.map((r) =>
    metric === "value" ? r.revenue : r.spend ? r.revenue / r.spend : 0,
  );
  const max = Math.max(
    1,
    Math.ceil(
      Math.max(
        ...values,
        ...(metric === "value" ? rows.map((r) => r.spend) : []),
      ) / (metric === "value" ? 2000 : 1),
    ) * (metric === "value" ? 2000 : 1),
  );
  const x = (i: number) =>
    left + (rows.length <= 1 ? innerW / 2 : (i / (rows.length - 1)) * innerW);
  const y = (v: number) => top + innerH - (v / max) * innerH;
  const line = values
    .map((v, i) => `${i ? "L" : "M"}${x(i)},${y(v)}`)
    .join(" ");
  const spendLine = rows
    .map((r, i) => `${i ? "L" : "M"}${x(i)},${y(r.spend)}`)
    .join(" ");
  const activeIndex =
    selected === null || !rows.length
      ? null
      : Math.min(selected, rows.length - 1);
  const active = activeIndex === null ? null : rows[activeIndex];
  return (
    <section className="panel trend-panel" aria-labelledby="trend-title">
      <div className="panel-heading">
        <div>
          <h2 id="trend-title">Performance trend</h2>
          <p>Platform-attributed revenue and media cost</p>
        </div>
        <div className="segmented" aria-label="Chart metric">
          <button
            className={metric === "value" ? "selected" : ""}
            onClick={() => {
              setMetric("value");
              setSelected(null);
            }}
          >
            Revenue & spend
          </button>
          <button
            className={metric === "roas" ? "selected" : ""}
            onClick={() => {
              setMetric("roas");
              setSelected(null);
            }}
          >
            ROAS
          </button>
        </div>
      </div>
      <div className="chart-summary">
        <strong>
          {metric === "value"
            ? money(data.evidence.totals.current.revenue)
            : multiplier(data.evidence.totals.current.roas)}
        </strong>
        <span>
          {metric === "value" ? "attributed revenue" : "reported return"}
        </span>
        <div className="chart-legend">
          <span>
            <i className="legend-dot revenue" />
            {metric === "value" ? "Revenue" : "ROAS"}
          </span>
          {metric === "value" && (
            <span>
              <i className="legend-dot spend" />
              Spend
            </span>
          )}
        </div>
      </div>
      <div className="chart-wrap">
        {rows.length ? (
          <svg
            viewBox={`0 0 ${width} ${height}`}
            role="img"
            aria-label={`Daily ${metric === "value" ? "revenue and spend" : "ROAS"}. Use arrow keys to inspect days.`}
            tabIndex={0}
            onPointerLeave={() => setSelected(null)}
            onPointerMove={(event) => {
              const rect = event.currentTarget.getBoundingClientRect();
              setSelected(
                Math.max(
                  0,
                  Math.min(
                    rows.length - 1,
                    Math.round(
                      ((((event.clientX - rect.left) / rect.width) * width -
                        left) /
                        innerW) *
                        (rows.length - 1),
                    ),
                  ),
                ),
              );
            }}
            onKeyDown={(event) => {
              if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
                event.preventDefault();
                setSelected(
                  Math.max(
                    0,
                    Math.min(
                      rows.length - 1,
                      (selected ?? 0) + (event.key === "ArrowRight" ? 1 : -1),
                    ),
                  ),
                );
              }
            }}
          >
            {[0, 0.25, 0.5, 0.75, 1].map((t) => (
              <g key={t}>
                <line
                  x1={left}
                  y1={y(max * t)}
                  x2={width - right}
                  y2={y(max * t)}
                  className="grid-line"
                />
                <text
                  x={left - 12}
                  y={y(max * t) + 4}
                  textAnchor="end"
                  className="axis-label"
                >
                  {metric === "value"
                    ? `${t ? "€" : ""}${(max * t) / 1000}${t ? "k" : ""}`
                    : `${(max * t).toFixed(1)}x`}
                </text>
              </g>
            ))}
            <path
              d={`${line} L${x(rows.length - 1)},${y(0)} L${x(0)},${y(0)} Z`}
              className="revenue-area"
            />
            {metric === "value" && (
              <path d={spendLine} className="spend-line" />
            )}
            <path d={line} className="revenue-line" />
            {rows.map(
              (r, i) =>
                (i === 0 ||
                  i === rows.length - 1 ||
                  (rows.length <= 7
                    ? true
                    : i % Math.ceil(rows.length / 5) === 0)) && (
                  <text
                    key={r.date}
                    x={x(i)}
                    y={height - 10}
                    textAnchor="middle"
                    className="axis-label"
                  >
                    {dateLabel(r.date)}
                  </text>
                ),
            )}
            {activeIndex !== null && (
              <g>
                <line
                  x1={x(activeIndex)}
                  y1={top}
                  x2={x(activeIndex)}
                  y2={y(0)}
                  className="cursor-line"
                />
                <circle
                  cx={x(activeIndex)}
                  cy={y(values[activeIndex])}
                  r={5}
                  className="chart-point"
                />
              </g>
            )}
          </svg>
        ) : (
          <div className="empty-state">
            Sync a source to see your daily performance.
          </div>
        )}
        {active && (
          <div className="chart-tooltip" aria-live="polite">
            <strong>{dateLabel(active.date)}</strong>
            <span>Revenue {money(active.revenue)}</span>
            <span>Spend {money(active.spend)}</span>
            <span>
              ROAS{" "}
              {multiplier(active.spend ? active.revenue / active.spend : null)}
            </span>
          </div>
        )}
      </div>
      <div className="chart-footer">
        <span>
          <ArrowUpRight size={14} /> Equal-length periods. All amounts in EUR.
        </span>
        <details>
          <summary>Daily data</summary>
          <div className="daily-table">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Revenue</th>
                  <th>Spend</th>
                  <th>ROAS</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.date}>
                    <td>{dateLabel(r.date)}</td>
                    <td>{money(r.revenue)}</td>
                    <td>{money(r.spend)}</td>
                    <td>{multiplier(r.spend ? r.revenue / r.spend : null)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </div>
    </section>
  );
}
