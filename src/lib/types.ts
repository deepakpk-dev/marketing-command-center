export type Channel = "google" | "meta";
export type ChannelFilter = Channel | "all";
export type Period = 7 | 14 | 28;
export interface Campaign {
  id: string;
  externalId: string;
  name: string;
  channel: Channel;
  status: "active" | "paused";
}
export interface AdFact {
  campaignId: string;
  date: string;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  revenue: number;
}
export interface AnalyticsFact {
  campaignId: string;
  date: string;
  sessions: number;
  purchases: number;
  revenue: number;
  newCustomers: number | null;
}
export interface NormalizedBatch {
  campaigns: Campaign[];
  ads: AdFact[];
  analytics: AnalyticsFact[];
}
export interface Kpis {
  spend: number;
  revenue: number;
  impressions: number;
  clicks: number;
  conversions: number;
  sessions: number;
  purchases: number;
  siteRevenue: number;
  newCustomers: number | null;
  customerCoverage: number;
  roas: number | null;
  cpa: number | null;
  ctr: number | null;
  cvr: number | null;
  cac: number | null;
  siteCvr: number | null;
}
export interface PeriodComparison {
  current: Kpis;
  previous: Kpis;
  start: string;
  end: string;
  previousStart: string;
  previousEnd: string;
}
export interface Anomaly {
  campaignId: string;
  metric: "cpa" | "roas" | "ctr" | "cvr";
  change: number;
  current: number;
  previous: number;
  severity: "warning" | "critical";
  explanation: string;
}
export interface CampaignPerformance extends Campaign, PeriodComparison {
  anomalies: Anomaly[];
}
export interface Evidence {
  dataVersion: number;
  days: Period;
  channel: ChannelFilter;
  start: string;
  end: string;
  totals: PeriodComparison;
  campaigns: CampaignPerformance[];
  caveats: string[];
}
export interface Finding {
  title: string;
  explanation: string;
  evidence: string[];
}
export interface SuggestedAction {
  campaignId: string;
  title: string;
  action: "budget" | "creative" | "landing_page" | "investigate";
  rationale: string;
  risk: "low" | "medium" | "high";
  budgetChangePercent: number | null;
  evidence: string[];
  expectedImpact: string;
}
export interface AnalysisOutput {
  summary: string;
  findings: Finding[];
  recommendations: SuggestedAction[];
  caveats: string[];
}
export interface AnalysisRun {
  id: string;
  provider: "demo" | "openai";
  createdAt: string;
  evidence: Evidence;
  output: AnalysisOutput;
}
export interface Recommendation extends SuggestedAction {
  id: string;
  fingerprint: string;
  analysisId: string;
  dataVersion: number;
  stale?: boolean;
  createdAt: string;
  periodStart: string;
  periodEnd: string;
  status: "pending" | "approved" | "rejected";
}
export interface ApprovalEvent {
  id: string;
  recommendationId: string;
  decision: "approved" | "rejected";
  note: string;
  reviewer: string;
  createdAt: string;
}
export interface IngestionRun {
  id: string;
  createdAt: string;
  rowCount: number;
  checksum: string;
  source: "sample" | "upload" | "workflow";
}
export interface StoreState extends NormalizedBatch {
  dataVersion: number;
  analyses: AnalysisRun[];
  recommendations: Recommendation[];
  events: ApprovalEvent[];
  ingestions: IngestionRun[];
}
export interface DashboardData {
  mode: "demo" | "supabase";
  aiProvider: "demo" | "openai";
  evidence: Evidence;
  timeline: { date: string; spend: number; revenue: number }[];
  recommendations: Recommendation[];
  events: ApprovalEvent[];
  analysis: AnalysisRun | null;
  ingestions: IngestionRun[];
  rowCount: number;
}
