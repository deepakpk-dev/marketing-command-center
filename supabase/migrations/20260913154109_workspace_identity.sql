begin;

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated, service_role;

create table public.workspace_members (
  workspace_id uuid not null references public.workspaces(id),
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check(role in ('viewer','analyst','approver','admin')),
  created_at timestamptz not null default now(),
  primary key(workspace_id,user_id)
);
create index workspace_members_user_workspace on public.workspace_members(user_id,workspace_id);
alter table public.workspace_members enable row level security;
revoke all on public.workspace_members from public,anon,authenticated;
grant select on public.workspace_members to authenticated,service_role;

create function private.has_active_session() returns boolean
language sql stable security definer set search_path = '' as $$
  select (select auth.uid()) is not null and exists (
    select 1 from auth.sessions s where s.user_id=(select auth.uid())
    and s.id::text=current_setting('request.jwt.claims',true)::jsonb->>'session_id'
  );
$$;
revoke all on function private.has_active_session() from public,anon;
grant execute on function private.has_active_session() to authenticated,service_role;

create function private.has_workspace_access(p_workspace uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select (select private.has_active_session()) and exists (
    select 1 from public.workspace_members m where m.workspace_id=p_workspace and m.user_id=(select auth.uid())
  );
$$;
revoke all on function private.has_workspace_access(uuid) from public,anon;
grant execute on function private.has_workspace_access(uuid) to authenticated,service_role;
create policy own_membership on public.workspace_members for select to authenticated
using(user_id=(select auth.uid()) and (select private.has_active_session()));

create function private.assert_permission(p_workspace uuid,p_roles text[],p_workflow boolean default false)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_workflow and current_setting('request.jwt.claims',true)::jsonb->>'role'='service_role' then return; end if;
  if not private.has_active_session() then raise exception 'Valid sign-in session required' using errcode='42501'; end if;
  if not exists(select 1 from public.workspace_members where workspace_id=p_workspace and user_id=(select auth.uid()) and role=any(p_roles))
  then raise exception 'Workspace permission denied' using errcode='42501'; end if;
end; $$;
revoke all on function private.assert_permission(uuid,text[],boolean) from public,anon,authenticated,service_role;

-- Preserve existing transactional implementations, but make raw privileged functions inaccessible.
alter function public.ingest_batch(uuid,jsonb,jsonb,jsonb,jsonb) set schema private;
alter function public.save_analysis(uuid,jsonb,jsonb) set schema private;
drop function public.record_decision(uuid,uuid,text,text,text);
revoke all on function private.ingest_batch(uuid,jsonb,jsonb,jsonb,jsonb) from public,anon,authenticated,service_role;
revoke all on function private.save_analysis(uuid,jsonb,jsonb) from public,anon,authenticated,service_role;

create function private.guarded_ingest(p_workspace uuid,p_campaigns jsonb,p_ads jsonb,p_analytics jsonb,p_run jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  perform 1 from public.workspaces where id=p_workspace for update;
  perform private.assert_permission(p_workspace,array['admin','analyst'],true);
  return private.ingest_batch(p_workspace,p_campaigns,p_ads,p_analytics,p_run);
end; $$;
create function public.ingest_batch(p_workspace uuid,p_campaigns jsonb,p_ads jsonb,p_analytics jsonb,p_run jsonb)
returns jsonb language sql security invoker set search_path = '' as $$ select private.guarded_ingest($1,$2,$3,$4,$5); $$;

create function private.guarded_analysis(p_workspace uuid,p_run jsonb,p_recommendations jsonb)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform 1 from public.workspaces where id=p_workspace for update;
  perform private.assert_permission(p_workspace,array['admin','analyst'],true);
  perform private.save_analysis(p_workspace,p_run,p_recommendations);
end; $$;
create function public.save_analysis(p_workspace uuid,p_run jsonb,p_recommendations jsonb)
returns void language sql security invoker set search_path = '' as $$ select private.guarded_analysis($1,$2,$3); $$;

alter table public.approval_events add column reviewer_user_id uuid;
alter table public.approval_events drop constraint approval_events_reviewer_check;
alter table public.approval_events add constraint approval_events_reviewer_check check(length(trim(reviewer)) between 1 and 320);
alter function public.immutable_approval() set search_path = '';
alter function private.ingest_batch(uuid,jsonb,jsonb,jsonb,jsonb) set search_path = '';
alter function private.save_analysis(uuid,jsonb,jsonb) set search_path = '';
-- Historic events remain unchanged. New authenticated decisions always contain verified identity.
create function private.guarded_decision(p_workspace uuid,p_id uuid,p_decision text,p_note text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare event public.approval_events; actor uuid; actor_email text;
begin
  perform 1 from public.workspaces where id=p_workspace for update;
  perform private.assert_permission(p_workspace,array['admin','approver']);
  actor := (select auth.uid());
  select email into actor_email from auth.users where id=actor;
  if actor_email is null then raise exception 'Verified user required' using errcode='42501'; end if;
  if p_decision not in ('approved','rejected') or length(trim(p_note)) not between 3 and 1000 then raise exception 'Invalid decision or note'; end if;
  update public.recommendations set status=p_decision where workspace_id=p_workspace and id=p_id and status='pending'
  and (p_decision='rejected' or data_version=(select w.data_version from public.workspaces w where w.id=p_workspace));
  if not found then raise exception 'Decision conflict: action missing, reviewed or stale'; end if;
  insert into public.approval_events(workspace_id,recommendation_id,decision,note,reviewer,reviewer_user_id)
  values(p_workspace,p_id,p_decision,trim(p_note),actor_email,actor) returning * into event;
  return to_jsonb(event);
end; $$;
create function public.record_decision(p_workspace uuid,p_id uuid,p_decision text,p_note text)
returns jsonb language sql security invoker set search_path = '' as $$ select private.guarded_decision($1,$2,$3,$4); $$;

create function private.guarded_set_member(p_workspace uuid,p_user uuid,p_role text)
returns void language plpgsql security definer set search_path = '' as $$
declare existing_role text;
begin
  perform 1 from public.workspaces where id=p_workspace for update;
  perform private.assert_permission(p_workspace,array['admin']);
  if p_role is not null and p_role not in ('viewer','analyst','approver','admin') then raise exception 'Invalid member role'; end if;
  select role into existing_role from public.workspace_members where workspace_id=p_workspace and user_id=p_user;
  if existing_role='admin' and p_role is distinct from 'admin' and (select count(*) from public.workspace_members where workspace_id=p_workspace and role='admin') <= 1
  then raise exception 'Cannot remove or demote the last administrator'; end if;
  if p_role is null then delete from public.workspace_members where workspace_id=p_workspace and user_id=p_user;
  else insert into public.workspace_members(workspace_id,user_id,role) values(p_workspace,p_user,p_role)
    on conflict(workspace_id,user_id) do update set role=excluded.role;
  end if;
end; $$;
create function public.set_member(p_workspace uuid,p_user uuid,p_role text)
returns void language sql security invoker set search_path = '' as $$ select private.guarded_set_member($1,$2,$3); $$;

create function private.guarded_list_members(p_workspace uuid)
returns table(user_id uuid,email text,role text,created_at timestamptz)
language plpgsql security definer set search_path = '' as $$
begin
  perform private.assert_permission(p_workspace,array['admin']);
  return query select m.user_id,u.email::text,m.role,m.created_at from public.workspace_members m join auth.users u on u.id=m.user_id
    where m.workspace_id=p_workspace order by m.created_at,m.user_id;
end; $$;
create function public.list_members(p_workspace uuid)
returns table(user_id uuid,email text,role text,created_at timestamptz)
language sql security invoker set search_path = '' as $$ select * from private.guarded_list_members($1); $$;

do $$ declare tbl text;
begin
  foreach tbl in array array['campaigns','ad_daily','ga4_daily','ingestion_runs','analysis_runs','recommendations','approval_events'] loop
    execute format('grant select on public.%I to authenticated',tbl);
    execute format('create policy workspace_read on public.%I for select to authenticated using(private.has_workspace_access(workspace_id))',tbl);
  end loop;
end; $$;
grant select on public.workspaces to authenticated;
create policy workspace_read on public.workspaces for select to authenticated using(private.has_workspace_access(id));

revoke all on function public.ingest_batch(uuid,jsonb,jsonb,jsonb,jsonb),public.save_analysis(uuid,jsonb,jsonb),public.record_decision(uuid,uuid,text,text),public.set_member(uuid,uuid,text),public.list_members(uuid) from public,anon;
revoke all on function private.guarded_ingest(uuid,jsonb,jsonb,jsonb,jsonb),private.guarded_analysis(uuid,jsonb,jsonb),private.guarded_decision(uuid,uuid,text,text),private.guarded_set_member(uuid,uuid,text),private.guarded_list_members(uuid) from public,anon;
grant execute on function public.ingest_batch(uuid,jsonb,jsonb,jsonb,jsonb),public.save_analysis(uuid,jsonb,jsonb),private.guarded_ingest(uuid,jsonb,jsonb,jsonb,jsonb),private.guarded_analysis(uuid,jsonb,jsonb) to authenticated,service_role;
grant execute on function public.record_decision(uuid,uuid,text,text),public.set_member(uuid,uuid,text),public.list_members(uuid),private.guarded_decision(uuid,uuid,text,text),private.guarded_set_member(uuid,uuid,text),private.guarded_list_members(uuid) to authenticated;
revoke all on function public.record_decision(uuid,uuid,text,text),private.guarded_decision(uuid,uuid,text,text),public.set_member(uuid,uuid,text),private.guarded_set_member(uuid,uuid,text),public.list_members(uuid),private.guarded_list_members(uuid) from service_role;

commit;
