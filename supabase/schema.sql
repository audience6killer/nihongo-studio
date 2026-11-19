-- Nihongo Studio / Supabase sync schema
-- Run this once in the Supabase SQL editor for your project.
-- It creates one row per authenticated user and an atomic save function
-- that refuses to overwrite a newer revision.
--
-- Adapted from the Chinese sibling instance. The table is language-agnostic, but
-- each instance keeps its own Supabase project so two apps signed in with the
-- same email can never overwrite each other's row.

create table if not exists public.progress (
  user_id uuid primary key references auth.users(id) on delete cascade,
  state jsonb not null,
  rev bigint not null default 1,
  updated_at timestamptz not null default now()
);

alter table public.progress enable row level security;

drop policy if exists "progress_select_own" on public.progress;
create policy "progress_select_own" on public.progress
  for select to authenticated
  using (auth.uid() = user_id);

-- The client never writes the table directly; only the function below does.
revoke all on public.progress from anon, authenticated;
grant select on public.progress to authenticated;

create or replace function public.save_progress(p_state jsonb, p_base_rev bigint)
returns table (rev bigint, state jsonb, conflict boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v public.progress%rowtype;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  select * into v
    from public.progress
   where user_id = auth.uid()
   for update;

  if not found then
    insert into public.progress (user_id, state, rev)
    values (auth.uid(), p_state, 1)
    returning * into v;
    return query select v.rev, v.state, false;
    return;
  end if;

  if v.rev <> coalesce(p_base_rev, 0) then
    return query select v.rev, v.state, true;
    return;
  end if;

  update public.progress
     set state = p_state,
         rev = v.rev + 1,
         updated_at = now()
   where user_id = auth.uid()
   returning * into v;

  return query select v.rev, v.state, false;
end;
$$;

revoke all on function public.save_progress(jsonb, bigint) from public;
grant execute on function public.save_progress(jsonb, bigint) to authenticated;
