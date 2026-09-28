-- Tracks public registration attempts for server-side rate limiting.
-- No raw IP addresses or passwords are stored.
create table if not exists public.registration_attempts (
  id bigint generated always as identity primary key,
  attempt_key text,
  username text not null,
  attempted_at timestamptz not null default now()
);
create index if not exists registration_attempts_key_time_idx on public.registration_attempts(attempt_key, attempted_at desc);
create index if not exists registration_attempts_username_time_idx on public.registration_attempts(username, attempted_at desc);
alter table public.registration_attempts enable row level security;
revoke all on public.registration_attempts from anon, authenticated;
grant select, insert on public.registration_attempts to service_role;
grant usage, select on sequence public.registration_attempts_id_seq to service_role;
