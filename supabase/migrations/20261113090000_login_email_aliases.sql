-- An optional login-only alias for legacy username accounts. Passwords remain in Supabase Auth.
create table if not exists public.account_login_aliases (
  user_id uuid primary key references auth.users(id) on delete cascade,
  login_email text not null,
  created_at timestamptz not null default now(),
  constraint account_login_aliases_email_format check (
    login_email = lower(btrim(login_email))
    and length(login_email) between 6 and 254
    and login_email ~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
  )
);
create unique index if not exists account_login_aliases_email_unique on public.account_login_aliases (lower(login_email));
alter table public.account_login_aliases enable row level security;
revoke all on public.account_login_aliases from public, anon, authenticated;
-- Aliases are assigned by an authorized administrator and do not grant password recovery.
