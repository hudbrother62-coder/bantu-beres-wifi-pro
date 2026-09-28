-- Restrict registration throttling data to the trusted server.
create policy "signup attempts service only"
on public.registration_attempts
for all to service_role
using (true)
with check (true);
