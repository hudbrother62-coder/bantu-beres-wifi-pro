-- Prevent replay of an email-authenticated recovery session.
create table if not exists public.account_email_recovery_redemptions (
  verifier_user_id uuid not null references auth.users(id) on delete cascade,
  signed_in_at timestamptz not null,
  recovered_user_id uuid not null references auth.users(id) on delete cascade,
  redeemed_at timestamptz not null default now(),
  primary key (verifier_user_id,signed_in_at)
);
alter table public.account_email_recovery_redemptions enable row level security;
revoke all on public.account_email_recovery_redemptions from public, anon, authenticated;
