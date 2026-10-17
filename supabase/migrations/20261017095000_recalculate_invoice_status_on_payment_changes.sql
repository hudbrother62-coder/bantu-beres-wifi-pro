-- Automatic, atomic invoice-status recalculation on payment changes.
create or replace function public.wifi_recalculate_invoice_status(p_invoice uuid)
returns void language plpgsql security invoker
set search_path=pg_catalog,public as $$
declare bill_amount numeric; received numeric; new_status text;
begin
 if p_invoice is null then return; end if;
 select amount into bill_amount from public.invoices where id=p_invoice for update;
 if not found then return; end if;
 select coalesce(sum(amount),0) into received from public.payments where invoice_id=p_invoice;
 new_status:=case when received<=0 then 'unpaid' when received>=bill_amount then 'paid' else 'partial' end;
 update public.invoices set status=new_status where id=p_invoice and status is distinct from new_status;
end; $$;
create or replace function public.wifi_validate_payment_links()
returns trigger language plpgsql security invoker set search_path=pg_catalog,public as $$
begin
 if new.invoice_id is not null and not exists (
 select 1 from public.invoices where id=new.invoice_id and user_id=new.user_id and customer_id=new.customer_id
 ) then raise exception 'Tagihan harus milik pelanggan dan pemilik akun yang sama.' using errcode='23514'; end if;
 return new;
end; $$;
drop trigger if exists wifi_validate_payment_links_trigger on public.payments;
create trigger wifi_validate_payment_links_trigger before insert or update of customer_id,invoice_id,user_id on public.payments
for each row execute function public.wifi_validate_payment_links();
create or replace function public.wifi_payment_refresh_invoice()
returns trigger language plpgsql security invoker set search_path=pg_catalog,public as $$
begin
 if tg_op in ('UPDATE','DELETE') and old.invoice_id is not null then
  perform public.wifi_recalculate_invoice_status(old.invoice_id); end if;
 if tg_op in ('INSERT','UPDATE') and new.invoice_id is not null then
  perform public.wifi_recalculate_invoice_status(new.invoice_id); end if;
 return null;
end; $$;
drop trigger if exists wifi_payment_refresh_invoice_trigger on public.payments;
create trigger wifi_payment_refresh_invoice_trigger after insert or update or delete on public.payments
for each row execute function public.wifi_payment_refresh_invoice();
create or replace function public.wifi_invoice_amount_refresh()
returns trigger language plpgsql security invoker set search_path=pg_catalog,public as $$
begin perform public.wifi_recalculate_invoice_status(new.id); return null; end; $$;
drop trigger if exists wifi_invoice_amount_refresh_trigger on public.invoices;
create trigger wifi_invoice_amount_refresh_trigger after update of amount on public.invoices
for each row when (old.amount is distinct from new.amount)
execute function public.wifi_invoice_amount_refresh();
revoke all on function public.wifi_recalculate_invoice_status(uuid) from public,anon;
revoke all on function public.wifi_validate_payment_links() from public,anon;
revoke all on function public.wifi_payment_refresh_invoice() from public,anon;
revoke all on function public.wifi_invoice_amount_refresh() from public,anon;
grant execute on function public.wifi_recalculate_invoice_status(uuid) to authenticated;
