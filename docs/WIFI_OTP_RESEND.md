# WiFi Pro — OTP Resend (staged)
Adapts the Bimbel Pro email recovery pattern to existing Supabase Auth. No new database or account migration.
- Separate feature branch; no production deployment or live sender test performed.
- Existing admin-assigned recovery aliases only. Never accept a new email for an unauthenticated account.
- Required **WiFi Pro Edge Function secrets**: RESEND_API_KEY, PASSWORD_RESET_FROM (verified sender), OTP_QUEUE_ENCRYPTION_KEY (independent random 32-byte hex key). Do not put secret values in Git.
- OTP is derived using keyed HMAC per random generation; only a separate keyed verifier digest is stored. Stable provider idempotency key prevents duplicate sends on retries. No plaintext OTP at rest.
- Worker must be scheduled each minute via Supabase Cron/pg_net using the existing protected worker secret. On rate limit retry after one hour; at most eight attempts; five verification attempts; ten-minute validity after provider acceptance.
- Before deploying: apply reviewed SQL to the existing project, verify grants, configure sender, review deployment safety restriction, schedule worker with authenticated secret header (never log it), run staging tests including unknown email, expiry, concurrency, replay, 429, email delivery and reset on an authorized test account. Only promote UI when backend tests pass.
- Legacy recovery code/link handler remains unchanged. This branch must not be merged until deployment and tests are complete.
