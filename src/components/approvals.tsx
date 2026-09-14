"use client";
import { useState } from "react";
import { ArrowRight, Check, CircleCheck, ShieldCheck, X } from "lucide-react";
import { dateLabel, timeLabel } from "@/lib/format";
import type { DashboardData, Recommendation } from "@/lib/types";
export function Approvals({
  data,
  busy,
  onDecision,
}: {
  data: DashboardData;
  busy: boolean;
  onDecision: (
    rec: Recommendation,
    decision: "approved" | "rejected",
    note: string,
  ) => Promise<boolean>;
}) {
  const [reviewing, setReviewing] = useState<string | null>(null),
    [note, setNote] = useState("");
  const pending = data.recommendations.filter(
    (r) => r.status === "pending" && !r.stale,
  );
  const stale = data.recommendations.filter(
    (r) => r.status === "pending" && r.stale,
  ).length;
  return (
    <div className="approval-layout">
      <section className="panel approval-panel">
        <div className="panel-heading">
          <div>
            <h2>
              Pending actions{" "}
              <span className="count-label">{pending.length}</span>
            </h2>
            <p>
              Your decision is recorded. Apply approved changes in the ad
              platform.
            </p>
          </div>
          <ShieldCheck size={20} className="accent-text" />
        </div>
        {stale > 0 && (
          <p className="measurement-note stale-note">
            {stale} older actions need a fresh analysis after a source change.
            Their evidence is preserved in the workspace.
          </p>
        )}
        {pending.length ? (
          pending.map((rec) => (
            <article className="approval-item" key={rec.id}>
              <div className="approval-item-top">
                <div>
                  <div className="eyebrow">
                    {data.evidence.campaigns.find(
                      (c) => c.id === rec.campaignId,
                    )?.name ?? rec.campaignId}
                  </div>
                  <h3>{rec.title}</h3>
                </div>
                <span className={`risk-label ${rec.risk}`}>
                  {rec.risk} risk
                </span>
              </div>
              <p>{rec.rationale}</p>
              <div className="action-meta">
                <span>
                  {rec.action.replaceAll("_", " ")}
                  {rec.budgetChangePercent !== null
                    ? ` · ${rec.budgetChangePercent > 0 ? "+" : ""}${rec.budgetChangePercent}% budget`
                    : ""}
                </span>
                <span>
                  {dateLabel(rec.periodStart)} to {dateLabel(rec.periodEnd)}
                </span>
              </div>
              {data.mode === "supabase" && !data.access?.permissions.approve ? (
                <p className="measurement-note">
                  An approver or administrator must review this action.
                </p>
              ) : reviewing === rec.id ? (
                <div className="inline-review">
                  <h4>Evidence behind this action</h4>
                  <ul>
                    {rec.evidence.map((f) => (
                      <li key={f}>{f}</li>
                    ))}
                  </ul>
                  <p className="muted">{rec.expectedImpact}</p>
                  <label>
                    Review note
                    <textarea
                      aria-label="Review note"
                      value={note}
                      onChange={(event) => setNote(event.target.value)}
                      maxLength={1000}
                      placeholder="What did you check? Add context for the audit trail."
                      rows={3}
                    />
                  </label>
                  <div className="review-actions">
                    <button
                      className="button primary"
                      disabled={busy || note.trim().length < 3}
                      onClick={async () => {
                        if (await onDecision(rec, "approved", note)) {
                          setReviewing(null);
                          setNote("");
                        }
                      }}
                    >
                      <Check size={16} />
                      Approve action
                    </button>
                    <button
                      className="button danger"
                      disabled={busy || note.trim().length < 3}
                      onClick={async () => {
                        if (await onDecision(rec, "rejected", note)) {
                          setReviewing(null);
                          setNote("");
                        }
                      }}
                    >
                      <X size={16} />
                      Reject
                    </button>
                    <button
                      className="text-button"
                      onClick={() => setReviewing(null)}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  className="text-button accent-text"
                  onClick={() => {
                    setReviewing(rec.id);
                    setNote("");
                  }}
                >
                  Review action <ArrowRight size={14} />
                </button>
              )}
            </article>
          ))
        ) : (
          <div className="empty-state">
            <CircleCheck size={28} />
            <h3>You’re all caught up</h3>
            <p>
              Run an analysis after your next sync to prepare new
              recommendations.
            </p>
          </div>
        )}
      </section>
      <aside className="panel audit-panel">
        <div className="panel-heading">
          <div>
            <h2>Decision history</h2>
            <p>A record of human review</p>
          </div>
        </div>
        {data.events.length ? (
          data.events.map((event) => (
            <article className="audit-event" key={event.id}>
              <span className={`audit-icon ${event.decision}`}>
                {event.decision === "approved" ? (
                  <Check size={15} />
                ) : (
                  <X size={15} />
                )}
              </span>
              <div>
                <strong>
                  {data.recommendations.find(
                    (r) => r.id === event.recommendationId,
                  )?.title ?? "Action reviewed"}
                </strong>
                <span className="audit-decision">
                  {event.decision} by {event.reviewer}
                </span>
                <p>{event.note}</p>
                <small>
                  {dateLabel(event.createdAt)} · {timeLabel(event.createdAt)}
                </small>
              </div>
            </article>
          ))
        ) : (
          <div className="empty-state small">
            <ShieldCheck size={26} />
            <p>Decisions will appear here with your note and a timestamp.</p>
          </div>
        )}
        <div className="audit-note">
          <ShieldCheck size={15} />
          <span>
            Approval events cannot be edited. Campaign execution is a separate
            handoff.
          </span>
        </div>
      </aside>
    </div>
  );
}
