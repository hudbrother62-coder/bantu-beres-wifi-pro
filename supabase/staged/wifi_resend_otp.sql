-- Staged migration; apply only after sender configuration and review.
alter table public.wifi_recovery_queue
 add column if not exists generation uuid not null default gen_random_uuid(),
 add column if not exists target_user_id uuid references auth.users(id) on delete cascade,
 add column if not exists otp_digest text,
 add column if not exists provider_id text;
create or replace function public.wifi_resend_enqueue(p_email text) returns void language plpgsql security invoker set search_path='' as $$
begin
 insert into public.wifi_recovery_queue(email,target_user_id)
 select a.login_email,a.user_id from public.account_login_aliases a where a.login_email=p_email
 on conflict(email) do update set generation=gen_random_uuid(),target_user_id=excluded.target_user_id,
 status='pending',created_at=now(),next_attempt_at=now(),attempts=0,verify_attempts=0,sent_at=null,otp_digest=null,provider_id=null
 where (wifi_recovery_queue.status='sent' and wifi_recovery_queue.sent_at<now()-interval '10 minutes')
 or (wifi_recovery_queue.status='failed' and wifi_recovery_queue.created_at<now()-interval '10 minutes');
end $$;
create or replace function public.wifi_resend_claim() returns table(id uuid,email text,generation uuid,attempts integer) language plpgsql security invoker set search_path='' as $$
begin
 perform 1 from public.wifi_recovery_worker_control c where c.singleton and c.next_send_at<=now() for update skip locked;
 if not found then return; end if;
 update public.wifi_recovery_queue q set status='failed',otp_digest=null where q.status in ('pending','sending') and (q.attempts>=8 or q.created_at<now()-interval '24 hours');
 return query with candidate as (
 select q.id from public.wifi_recovery_queue q join public.account_login_aliases a on a.login_email=q.email and a.user_id=q.target_user_id
 where q.status in ('pending','sending') and q.next_attempt_at<=now() order by q.created_at,q.id limit 1 for update of q skip locked
 ) update public.wifi_recovery_queue q set status='sending',attempts=q.attempts+1,next_attempt_at=now()+interval '1 hour'
 from candidate where q.id=candidate.id returning q.id,q.email,q.generation,q.attempts;
 if found then update public.wifi_recovery_worker_control set next_send_at=now()+interval '1 minute' where singleton; end if;
end $$;
create or replace function public.wifi_resend_consume(p_email text,p_generation uuid,p_digest text) returns uuid language plpgsql security invoker set search_path='' as $$
declare job public.wifi_recovery_queue%rowtype;
begin
 select q.* into job from public.wifi_recovery_queue q where q.email=p_email and q.generation=p_generation and q.status='sent'
 and q.sent_at>=now()-interval '10 minutes' and q.verify_attempts<5 and q.otp_digest is not null for update;
 if not found then return null; end if;
 update public.wifi_recovery_queue set verify_attempts=verify_attempts+1 where id=job.id;
 if job.otp_digest<>p_digest or not exists(select 1 from public.account_login_aliases a where a.login_email=p_email and a.user_id=job.target_user_id) then return null; end if;
 update public.wifi_recovery_queue set otp_digest=null,verify_attempts=5 where id=job.id;
 return job.target_user_id;
end $$;
revoke all on function public.wifi_resend_enqueue(text),public.wifi_resend_claim(),public.wifi_resend_consume(text,uuid,text) from public,anon,authenticated;
grant execute on function public.wifi_resend_enqueue(text),public.wifi_resend_claim(),public.wifi_resend_consume(text,uuid,text) to service_role;
