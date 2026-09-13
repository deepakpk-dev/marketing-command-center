begin;

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  data_version bigint not null default 0,
  currency text not null default 'EUR' check (currency = 'EUR'),
  timezone text not null default 'UTC' check (timezone = 'UTC')
);
insert into public.workspaces(id,name) values ('11111111-1111-4111-8111-111111111111','Signal portfolio workspace');

create table public.campaigns (
  workspace_id uuid not null references public.workspaces(id),
  id text not null, external_id text not null, name text not null,
  channel text not null check (channel in ('google','meta')),
  status text not null check (status in ('active','paused')),
  primary key (workspace_id,id)
);
create table public.ad_daily (
  workspace_id uuid not null, campaign_id text not null, date date not null,
  spend numeric(20,6) not null check (spend >= 0),
  impressions bigint not null check (impressions >= 0),
  clicks bigint not null check (clicks >= 0),
  conversions numeric(20,6) not null check (conversions >= 0),
  revenue numeric(20,6) not null check (revenue >= 0),
  primary key(workspace_id,campaign_id,date),
  foreign key(workspace_id,campaign_id) references public.campaigns(workspace_id,id)
);
create table public.ga4_daily (
  workspace_id uuid not null, campaign_id text not null, date date not null,
  sessions bigint not null check (sessions >= 0),
  purchases bigint not null check (purchases >= 0),
  revenue numeric(20,6) not null check (revenue >= 0),
  new_customers bigint check (new_customers >= 0),
  primary key(workspace_id,campaign_id,date),
  foreign key(workspace_id,campaign_id) references public.campaigns(workspace_id,id)
);
create index ad_daily_workspace_date on public.ad_daily(workspace_id,date);
create index ga4_daily_workspace_date on public.ga4_daily(workspace_id,date);
create table public.ingestion_runs (
  id uuid primary key, workspace_id uuid not null references public.workspaces(id),
  created_at timestamptz not null default now(), row_count integer not null check(row_count >= 0),
  checksum text not null, source text not null default 'workflow' check(source in ('sample','upload','workflow'))
);
create table public.analysis_runs (
  id uuid primary key, workspace_id uuid not null references public.workspaces(id),
  provider text not null check(provider in ('demo','openai')),
  evidence jsonb not null, output jsonb not null, created_at timestamptz not null default now(),
  unique(workspace_id,id)
);
create table public.recommendations (
  id uuid primary key, workspace_id uuid not null,
  analysis_id uuid not null, fingerprint text not null, campaign_id text not null,
  data_version bigint not null,
  title text not null, action text not null check(action in ('budget','creative','landing_page','investigate')),
  rationale text not null, risk text not null check(risk in ('low','medium','high')),
  budget_change_percent integer check(budget_change_percent between -20 and 20),
  evidence jsonb not null, expected_impact text not null,
  period_start date, period_end date, created_at timestamptz not null default now(),
  status text not null default 'pending' check(status in ('pending','approved','rejected')),
  check ((action = 'budget' and budget_change_percent is not null) or (action <> 'budget' and budget_change_percent is null)),
  unique(workspace_id,fingerprint), unique(workspace_id,id),
  foreign key(workspace_id,campaign_id) references public.campaigns(workspace_id,id),
  foreign key(workspace_id,analysis_id) references public.analysis_runs(workspace_id,id)
);
create index recommendations_workspace_status on public.recommendations(workspace_id,status);
create table public.approval_events (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null,
  recommendation_id uuid not null, decision text not null check(decision in ('approved','rejected')),
  note text not null check(length(trim(note)) between 3 and 1000),
  reviewer text not null check(length(trim(reviewer)) between 1 and 100), created_at timestamptz not null default now(),
  unique(recommendation_id),
  foreign key(workspace_id,recommendation_id) references public.recommendations(workspace_id,id)
);

create function public.immutable_approval() returns trigger language plpgsql as $$
begin raise exception 'Approval audit events are immutable'; end; $$;
create trigger prevent_audit_mutation before update or delete on public.approval_events
for each row execute function public.immutable_approval();

create function public.ingest_batch(p_workspace uuid, p_campaigns jsonb, p_ads jsonb, p_analytics jsonb, p_run jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare affected integer; changed integer := 0;
begin
  perform 1 from public.workspaces where id=p_workspace for update;
  if jsonb_array_length(p_ads) + jsonb_array_length(p_analytics) > 10000 then raise exception 'Batch exceeds 10000 rows'; end if;
  insert into public.campaigns(workspace_id,id,external_id,name,channel,status)
  select p_workspace,v->>'id',v->>'externalId',v->>'name',v->>'channel',v->>'status' from jsonb_array_elements(p_campaigns) v
  on conflict(workspace_id,id) do update set external_id=excluded.external_id,name=excluded.name,channel=excluded.channel,status=excluded.status
  where (campaigns.external_id,campaigns.name,campaigns.channel,campaigns.status) is distinct from (excluded.external_id,excluded.name,excluded.channel,excluded.status);
  get diagnostics affected = row_count; changed := changed + affected;
  insert into public.ad_daily(workspace_id,campaign_id,date,spend,impressions,clicks,conversions,revenue)
  select p_workspace,v->>'campaignId',(v->>'date')::date,(v->>'spend')::numeric,(v->>'impressions')::bigint,(v->>'clicks')::bigint,(v->>'conversions')::numeric,(v->>'revenue')::numeric from jsonb_array_elements(p_ads) v
  on conflict(workspace_id,campaign_id,date) do update set spend=excluded.spend,impressions=excluded.impressions,clicks=excluded.clicks,conversions=excluded.conversions,revenue=excluded.revenue
  where (ad_daily.spend,ad_daily.impressions,ad_daily.clicks,ad_daily.conversions,ad_daily.revenue) is distinct from (excluded.spend,excluded.impressions,excluded.clicks,excluded.conversions,excluded.revenue);
  get diagnostics affected = row_count; changed := changed + affected;
  insert into public.ga4_daily(workspace_id,campaign_id,date,sessions,purchases,revenue,new_customers)
  select p_workspace,v->>'campaignId',(v->>'date')::date,(v->>'sessions')::bigint,(v->>'purchases')::bigint,(v->>'revenue')::numeric,(v->>'newCustomers')::bigint from jsonb_array_elements(p_analytics) v
  on conflict(workspace_id,campaign_id,date) do update set sessions=excluded.sessions,purchases=excluded.purchases,revenue=excluded.revenue,new_customers=excluded.new_customers
  where (ga4_daily.sessions,ga4_daily.purchases,ga4_daily.revenue,ga4_daily.new_customers) is distinct from (excluded.sessions,excluded.purchases,excluded.revenue,excluded.new_customers);
  get diagnostics affected = row_count; changed := changed + affected;
  if changed > 0 then update public.workspaces set data_version=data_version+1 where id=p_workspace; end if;
  insert into public.ingestion_runs(id,workspace_id,row_count,checksum,source)
  values ((p_run->>'id')::uuid,p_workspace,(p_run->>'rowCount')::integer,p_run->>'checksum',coalesce(p_run->>'source','workflow'));
  return jsonb_build_object('ads',jsonb_array_length(p_ads),'analytics',jsonb_array_length(p_analytics));
end; $$;

create function public.save_analysis(p_workspace uuid, p_run jsonb, p_recommendations jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare version bigint;
begin
  select data_version into version from public.workspaces where id=p_workspace for update;
  if coalesce((p_run->'evidence'->>'dataVersion')::bigint,version) <> version then raise exception 'Data changed while analysis ran'; end if;
  insert into public.analysis_runs(id,workspace_id,provider,evidence,output)
  values ((p_run->>'id')::uuid,p_workspace,p_run->>'provider',p_run->'evidence',p_run->'output');
  insert into public.recommendations(id,workspace_id,analysis_id,data_version,fingerprint,campaign_id,title,action,rationale,risk,budget_change_percent,evidence,expected_impact,period_start,period_end)
  select (v->>'id')::uuid,p_workspace,(p_run->>'id')::uuid,version,v->>'fingerprint',v->>'campaignId',v->>'title',v->>'action',v->>'rationale',v->>'risk',(v->>'budgetChangePercent')::integer,v->'evidence',v->>'expectedImpact',(v->>'periodStart')::date,(v->>'periodEnd')::date from jsonb_array_elements(p_recommendations) v
  on conflict(workspace_id,fingerprint) do nothing;
end; $$;

create function public.record_decision(p_workspace uuid, p_id uuid, p_decision text, p_note text, p_reviewer text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare event public.approval_events;
begin
  perform 1 from public.workspaces where id=p_workspace for update;
  if p_decision not in ('approved','rejected') then raise exception 'Invalid decision'; end if;
  if length(trim(p_note)) not between 3 and 1000 or length(trim(p_reviewer)) not between 1 and 100 then raise exception 'Invalid review note or reviewer'; end if;
  update public.recommendations set status=p_decision where workspace_id=p_workspace and id=p_id and status='pending'
  and (p_decision='rejected' or data_version=(select w.data_version from public.workspaces w where w.id=p_workspace));
  if not found then raise exception 'Decision conflict: recommendation missing or already reviewed'; end if;
  insert into public.approval_events(workspace_id,recommendation_id,decision,note,reviewer)
  values (p_workspace,p_id,p_decision,trim(p_note),trim(p_reviewer)) returning * into event;
  return to_jsonb(event);
end; $$;

alter table public.workspaces enable row level security;
alter table public.campaigns enable row level security;
alter table public.ad_daily enable row level security;
alter table public.ga4_daily enable row level security;
alter table public.ingestion_runs enable row level security;
alter table public.analysis_runs enable row level security;
alter table public.recommendations enable row level security;
alter table public.approval_events enable row level security;

-- Server-only design. No anonymous/authenticated policies grant browser data access.
revoke all on function public.ingest_batch(uuid,jsonb,jsonb,jsonb,jsonb) from public;
revoke all on function public.save_analysis(uuid,jsonb,jsonb) from public;
revoke all on function public.record_decision(uuid,uuid,text,text,text) from public;
do $$
begin
  if exists(select 1 from pg_roles where rolname='anon') then
    revoke all on public.workspaces,public.campaigns,public.ad_daily,public.ga4_daily,public.ingestion_runs,public.analysis_runs,public.recommendations,public.approval_events from anon;
  end if;
  if exists(select 1 from pg_roles where rolname='authenticated') then
    revoke all on public.workspaces,public.campaigns,public.ad_daily,public.ga4_daily,public.ingestion_runs,public.analysis_runs,public.recommendations,public.approval_events from authenticated;
  end if;
  if exists(select 1 from pg_roles where rolname='service_role') then
    grant select on public.workspaces,public.campaigns,public.ad_daily,public.ga4_daily,public.ingestion_runs,public.analysis_runs,public.recommendations,public.approval_events to service_role;
    grant execute on function public.ingest_batch(uuid,jsonb,jsonb,jsonb,jsonb) to service_role;
    grant execute on function public.save_analysis(uuid,jsonb,jsonb) to service_role;
    grant execute on function public.record_decision(uuid,uuid,text,text,text) to service_role;
  end if;
end; $$;
commit;
