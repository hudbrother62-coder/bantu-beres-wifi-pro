-- Hashed, single-use recovery codes for username-only Supabase Auth accounts.
CREATE TABLE IF NOT EXISTS public.account_recovery_codes (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  code_hash text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  used_at timestamptz
);
ALTER TABLE public.account_recovery_codes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.account_recovery_codes FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.account_recovery_codes TO service_role;
CREATE INDEX IF NOT EXISTS account_recovery_unused_idx
 ON public.account_recovery_codes(code_hash) WHERE used_at IS NULL;
