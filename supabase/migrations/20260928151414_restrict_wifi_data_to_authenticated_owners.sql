DROP POLICY IF EXISTS "profiles are private to owner" ON public.profiles;
CREATE POLICY "profiles are private to owner" ON public.profiles FOR ALL TO authenticated
 USING (id = (SELECT auth.uid())) WITH CHECK (id = (SELECT auth.uid()));
DROP POLICY IF EXISTS "packages are private to owner" ON public.internet_packages;
CREATE POLICY "packages are private to owner" ON public.internet_packages FOR ALL TO authenticated
 USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS "customers are private to owner" ON public.customers;
CREATE POLICY "customers are private to owner" ON public.customers FOR ALL TO authenticated
 USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS "invoices are private to owner" ON public.invoices;
CREATE POLICY "invoices are private to owner" ON public.invoices FOR ALL TO authenticated
 USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS "payments are private to owner" ON public.payments;
CREATE POLICY "payments are private to owner" ON public.payments FOR ALL TO authenticated
 USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS "templates are private to owner" ON public.message_templates;
CREATE POLICY "templates are private to owner" ON public.message_templates FOR ALL TO authenticated
 USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));
REVOKE ALL ON public.profiles, public.internet_packages, public.customers, public.invoices, public.payments, public.message_templates FROM anon;
CREATE INDEX IF NOT EXISTS customers_package_id_idx ON public.customers(package_id);
CREATE INDEX IF NOT EXISTS packages_user_id_idx ON public.internet_packages(user_id);
CREATE INDEX IF NOT EXISTS invoices_customer_id_idx ON public.invoices(customer_id);
CREATE INDEX IF NOT EXISTS templates_user_id_idx ON public.message_templates(user_id);
CREATE INDEX IF NOT EXISTS payments_customer_id_idx ON public.payments(customer_id);
CREATE INDEX IF NOT EXISTS payments_invoice_id_idx ON public.payments(invoice_id);
