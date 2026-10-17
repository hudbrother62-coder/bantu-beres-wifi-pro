-- Protect existing invoices and payments when cleaning duplicate customers.
create or replace function public.prevent_customer_financial_cascade()
returns trigger language plpgsql security invoker
set search_path=pg_catalog,public
as $$
begin
 if exists(select 1 from public.invoices where customer_id=old.id)
    or exists(select 1 from public.payments where customer_id=old.id) then
   raise exception 'Pelanggan memiliki tagihan atau pembayaran; penghapusan diblokir untuk menjaga riwayat keuangan.' using errcode='23503';
 end if;
 return old;
end;
$$;
drop trigger if exists protect_customer_financial_history on public.customers;
create trigger protect_customer_financial_history before delete on public.customers
for each row execute function public.prevent_customer_financial_cascade();
