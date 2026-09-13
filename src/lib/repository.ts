import { createHash, randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { buildSampleExports } from "./samples";
import { normalizeBatch } from "./ingestion";
import {
  analyzeDemo,
  buildEvidence,
  createAnalysisRun,
  metricFacts,
} from "./analyst";
import { getDataMode } from "./auth";
import { shiftDate } from "./metrics";
import { ApiError } from "./errors";
import type {
  AnalysisRun,
  ApprovalEvent,
  IngestionRun,
  NormalizedBatch,
  Recommendation,
  StoreState,
} from "./types";
export interface Repository {
  read(): Promise<StoreState>;
  ingest(
    batch: NormalizedBatch,
    source?: IngestionRun["source"],
  ): Promise<IngestionRun>;
  saveAnalysis(
    run: AnalysisRun,
    recommendations: Recommendation[],
  ): Promise<void>;
  decide(
    id: string,
    decision: "approved" | "rejected",
    note: string,
    reviewer: string,
  ): Promise<ApprovalEvent>;
}
export function makeIngestion(
  batch: NormalizedBatch,
  source: IngestionRun["source"],
): IngestionRun {
  return {
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    rowCount: batch.ads.length + batch.analytics.length,
    checksum: createHash("sha256").update(JSON.stringify(batch)).digest("hex"),
    source,
  };
}
function validateDecision(note: string, reviewer: string): void {
  z.string().trim().min(3).max(1000).parse(note);
  z.string().trim().min(1).max(100).parse(reviewer);
}
export class DemoRepository implements Repository {
  private state: StoreState;
  constructor() {
    const batch = normalizeBatch(buildSampleExports());
    const evidence = buildEvidence({ ...batch, dataVersion: 1 }, 7, "all"),
      initial = createAnalysisRun(evidence, analyzeDemo(evidence), "demo");
    this.state = {
      ...batch,
      dataVersion: 1,
      analyses: [initial.run],
      recommendations: initial.recommendations,
      events: [],
      ingestions: [makeIngestion(batch, "sample")],
    };
  }
  async read(): Promise<StoreState> {
    return structuredClone(this.state);
  }
  async ingest(
    batch: NormalizedBatch,
    source: IngestionRun["source"] = "sample",
  ): Promise<IngestionRun> {
    const campaigns = new Map(this.state.campaigns.map((c) => [c.id, c]));
    batch.campaigns.forEach((c) => campaigns.set(c.id, c));
    if (
      [...batch.ads, ...batch.analytics].some(
        (row) => !campaigns.has(row.campaignId),
      )
    )
      throw new ApiError(
        400,
        "Batch references a campaign that has not been ingested.",
      );
    const upsert = <T extends { campaignId: string; date: string }>(
      existing: T[],
      incoming: T[],
    ) => {
      const map = new Map(
        existing.map((row) => [`${row.campaignId}:${row.date}`, row]),
      );
      incoming.forEach((row) => map.set(`${row.campaignId}:${row.date}`, row));
      return [...map.values()];
    };
    const ingestion = makeIngestion(batch, source);
    const merged = {
      campaigns: [...campaigns.values()],
      ads: upsert(this.state.ads, batch.ads),
      analytics: upsert(this.state.analytics, batch.analytics),
    };
    const oldData = {
      campaigns: this.state.campaigns,
      ads: this.state.ads,
      analytics: this.state.analytics,
    };
    this.state = {
      ...this.state,
      ...merged,
      dataVersion:
        this.state.dataVersion +
        (JSON.stringify(oldData) === JSON.stringify(merged) ? 0 : 1),
      ingestions: [ingestion, ...this.state.ingestions].slice(0, 20),
    };
    return ingestion;
  }
  async saveAnalysis(
    run: AnalysisRun,
    recommendations: Recommendation[],
  ): Promise<void> {
    if (run.evidence.dataVersion !== this.state.dataVersion)
      throw new ApiError(
        409,
        "Data changed while analysis ran. Run a fresh analysis.",
      );
    const known = new Set(this.state.recommendations.map((r) => r.fingerprint));
    this.state.analyses = [structuredClone(run), ...this.state.analyses].slice(
      0,
      10,
    );
    this.state.recommendations = [
      ...recommendations.filter((r) => !known.has(r.fingerprint)),
      ...this.state.recommendations,
    ].slice(0, 100);
  }
  async decide(
    id: string,
    decision: "approved" | "rejected",
    note: string,
    reviewer: string,
  ): Promise<ApprovalEvent> {
    validateDecision(note, reviewer);
    const recommendation = this.state.recommendations.find((r) => r.id === id);
    if (!recommendation) throw new ApiError(404, "Recommendation not found.");
    if (recommendation.status !== "pending")
      throw new ApiError(409, "Decision conflict: action already reviewed.");
    if (decision !== "approved" && decision !== "rejected")
      throw new ApiError(400, "Invalid decision.");
    if (
      decision === "approved" &&
      recommendation.dataVersion !== this.state.dataVersion
    )
      throw new ApiError(
        409,
        "Data changed. Run a fresh analysis before approving this action.",
      );
    const run = this.state.analyses.find(
      (a) => a.id === recommendation.analysisId,
    );
    if (decision === "approved" && run) {
      const fresh = buildEvidence(
        this.state,
        run.evidence.days,
        run.evidence.channel,
      );
      const campaign = fresh.campaigns.find(
        (c) => c.id === recommendation.campaignId,
      );
      const currentFacts = campaign
        ? metricFacts(campaign.name, campaign.current, campaign.previous)
        : [];
      if (
        fresh.end !== run.evidence.end ||
        recommendation.evidence.some((f) => !currentFacts.includes(f))
      )
        throw new ApiError(
          409,
          "Data changed. Run a fresh analysis before approving this action.",
        );
    }
    const event: ApprovalEvent = {
      id: randomUUID(),
      recommendationId: id,
      decision,
      note: note.trim(),
      reviewer: reviewer.trim(),
      createdAt: new Date().toISOString(),
    };
    recommendation.status = decision;
    this.state.events.unshift(event);
    return structuredClone(event);
  }
}
type Row = Record<string, unknown>;
function dbFailure(error: { message: string } | null): void {
  if (error)
    throw new ApiError(
      503,
      "Database operation failed. Check the server configuration and apply the migration.",
    );
}
export class SupabaseRepository implements Repository {
  private client: SupabaseClient;
  private workspace: string;
  constructor() {
    const url = z.url().parse(process.env.SUPABASE_URL);
    const key =
      process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!key)
      throw new ApiError(
        503,
        "Supabase mode requires a server-side secret key.",
      );
    this.workspace = z
      .uuid()
      .parse(
        process.env.WORKSPACE_ID || "11111111-1111-4111-8111-111111111111",
      );
    this.client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  private async rows(
    table: string,
    from?: string,
    limit?: number,
  ): Promise<Row[]> {
    const result: Row[] = [];
    for (let offset = 0; offset < (limit ?? 20000); offset += 1000) {
      let query = this.client
        .from(table)
        .select("*")
        .eq("workspace_id", this.workspace);
      if (from)
        query = query.gte("date", from).order("date").order("campaign_id");
      else
        query = query.order(table === "campaigns" ? "id" : "created_at", {
          ascending: table === "campaigns",
        });
      const { data, error } = await query.range(
        offset,
        offset + Math.min(1000, limit ?? 1000) - 1,
      );
      dbFailure(error);
      const rows = (data ?? []) as Row[];
      result.push(...rows);
      if (rows.length < 1000 || limit) return result;
    }
    throw new ApiError(
      503,
      "Reporting window exceeds 20,000 rows. Add warehouse aggregation before expanding this workspace.",
    );
  }
  async read(): Promise<StoreState> {
    const { data: workspace, error: workspaceError } = await this.client
      .from("workspaces")
      .select("data_version")
      .eq("id", this.workspace)
      .single();
    dbFailure(workspaceError);
    const { data: latest, error } = await this.client
      .from("ad_daily")
      .select("date")
      .eq("workspace_id", this.workspace)
      .order("date", { ascending: false })
      .limit(1);
    dbFailure(error);
    const from = latest?.[0]?.date
      ? shiftDate(String(latest[0].date), -55)
      : "2000-01-01";
    const [
      campaigns,
      ads,
      analytics,
      analyses,
      recommendations,
      events,
      ingestions,
    ] = await Promise.all([
      this.rows("campaigns"),
      this.rows("ad_daily", from),
      this.rows("ga4_daily", from),
      this.rows("analysis_runs", undefined, 10),
      this.rows("recommendations", undefined, 100),
      this.rows("approval_events", undefined, 100),
      this.rows("ingestion_runs", undefined, 20),
    ]);
    return {
      dataVersion: Number(workspace?.data_version ?? 0),
      campaigns: campaigns.map((r) => ({
        id: String(r.id),
        externalId: String(r.external_id),
        name: String(r.name),
        channel: r.channel as "google" | "meta",
        status: r.status as "active" | "paused",
      })),
      ads: ads.map((r) => ({
        campaignId: String(r.campaign_id),
        date: String(r.date),
        spend: Number(r.spend),
        impressions: Number(r.impressions),
        clicks: Number(r.clicks),
        conversions: Number(r.conversions),
        revenue: Number(r.revenue),
      })),
      analytics: analytics.map((r) => ({
        campaignId: String(r.campaign_id),
        date: String(r.date),
        sessions: Number(r.sessions),
        purchases: Number(r.purchases),
        revenue: Number(r.revenue),
        newCustomers: r.new_customers === null ? null : Number(r.new_customers),
      })),
      analyses: analyses.map((r) => ({
        id: String(r.id),
        provider: r.provider as AnalysisRun["provider"],
        createdAt: String(r.created_at),
        evidence: r.evidence as AnalysisRun["evidence"],
        output: r.output as AnalysisRun["output"],
      })),
      recommendations: recommendations.map((r) => ({
        id: String(r.id),
        analysisId: String(r.analysis_id),
        dataVersion: Number(r.data_version),
        fingerprint: String(r.fingerprint),
        campaignId: String(r.campaign_id),
        title: String(r.title),
        action: r.action as Recommendation["action"],
        rationale: String(r.rationale),
        risk: r.risk as Recommendation["risk"],
        budgetChangePercent:
          r.budget_change_percent === null
            ? null
            : Number(r.budget_change_percent),
        evidence: r.evidence as string[],
        expectedImpact: String(r.expected_impact),
        status: r.status as Recommendation["status"],
        createdAt: String(r.created_at),
        periodStart: String(r.period_start),
        periodEnd: String(r.period_end),
      })),
      events: events.map((r) => ({
        id: String(r.id),
        recommendationId: String(r.recommendation_id),
        decision: r.decision as ApprovalEvent["decision"],
        note: String(r.note),
        reviewer: String(r.reviewer),
        createdAt: String(r.created_at),
      })),
      ingestions: ingestions.map((r) => ({
        id: String(r.id),
        createdAt: String(r.created_at),
        rowCount: Number(r.row_count),
        checksum: String(r.checksum),
        source: r.source as IngestionRun["source"],
      })),
    };
  }
  async ingest(
    batch: NormalizedBatch,
    source: IngestionRun["source"] = "workflow",
  ): Promise<IngestionRun> {
    const run = makeIngestion(batch, source);
    const { error } = await this.client.rpc("ingest_batch", {
      p_workspace: this.workspace,
      p_campaigns: batch.campaigns,
      p_ads: batch.ads,
      p_analytics: batch.analytics,
      p_run: run,
    });
    dbFailure(error);
    return run;
  }
  async saveAnalysis(
    run: AnalysisRun,
    recommendations: Recommendation[],
  ): Promise<void> {
    const { error } = await this.client.rpc("save_analysis", {
      p_workspace: this.workspace,
      p_run: run,
      p_recommendations: recommendations,
    });
    if (error?.message.includes("changed"))
      throw new ApiError(
        409,
        "Data changed while analysis ran. Run a fresh analysis.",
      );
    dbFailure(error);
  }
  async decide(
    id: string,
    decision: "approved" | "rejected",
    note: string,
    reviewer: string,
  ): Promise<ApprovalEvent> {
    validateDecision(note, reviewer);
    const { data, error } = await this.client.rpc("record_decision", {
      p_workspace: this.workspace,
      p_id: id,
      p_decision: decision,
      p_note: note,
      p_reviewer: reviewer,
    });
    if (error?.message.includes("conflict"))
      throw new ApiError(
        409,
        "Decision conflict: action missing, already reviewed, or source data changed. Run a fresh analysis if needed.",
      );
    dbFailure(error);
    return {
      id: data.id,
      recommendationId: data.recommendation_id,
      decision: data.decision,
      note: data.note,
      reviewer: data.reviewer,
      createdAt: data.created_at,
    };
  }
}
const globals = globalThis as typeof globalThis & {
  signalRepositories?: Map<string, { repo: DemoRepository; touched: number }>;
};
export function getRepository(sessionId: string): Repository {
  if (getDataMode() === "supabase") return new SupabaseRepository();
  const cache = (globals.signalRepositories ??= new Map());
  const now = Date.now();
  for (const [id, entry] of cache)
    if (now - entry.touched > 86400000) cache.delete(id);
  let entry = cache.get(sessionId);
  if (!entry) {
    if (cache.size >= 100) cache.delete(cache.keys().next().value!);
    entry = { repo: new DemoRepository(), touched: now };
    cache.set(sessionId, entry);
  }
  entry.touched = now;
  return entry.repo;
}
